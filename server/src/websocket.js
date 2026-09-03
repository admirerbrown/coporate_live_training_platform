const { WebSocketServer, WebSocket } = require("ws");
const { verifyInstructorToken } = require("./services/sessions");

function attachWebSocketServer(server, db) {
  const connectionsBySession = new Map();

  function createPlaybackStateMessage(state) {
    return {
      type: "playback:state",
      position: Number(state.position),
      isPlaying: state.is_playing,
      version: state.version,
      updatedAt: new Date(state.updated_at).toISOString(),
      serverTime: new Date().toISOString(),
    };
  }

  function broadcastPlaybackState(sessionId, state) {
    const connections = connectionsBySession.get(sessionId);

    if (!connections) {
      return;
    }

    const message = JSON.stringify(createPlaybackStateMessage(state));

    for (const socket of connections) {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(message);
      }
    }
  }

  function sendError(ws, type, code) {
    ws.send(
      JSON.stringify({
        type,
        code,
      }),
    );
  }

  const wss = new WebSocketServer({
    server,
    path: "/ws",
  });

  wss.on("connection", async (ws, req) => {
    const url = new URL(req.url, "http://localhost");
    const sessionId = url.searchParams.get("sessionId");

    ws.isInstructor = false;

    if (!sessionId) {
      ws.close();
      return;
    }

    const result = await db.query(
      `
        SELECT
          s.status,
          p.position,
          p.is_playing,
          p.version,
          p.updated_at
        FROM training_sessions s
        INNER JOIN session_playback_state p
          ON p.session_id = s.id
        WHERE s.id = $1
      `,
      [sessionId],
    );

    if (result.rows.length === 0) {
      ws.close();
      return;
    }

    const state = result.rows[0];

    if (state.status === "ENDED") {
      sendError(ws, "session:error", "SESSION_ENDED");

      ws.close();

      return;
    }

    if (!connectionsBySession.has(sessionId)) {
      connectionsBySession.set(sessionId, new Set());
    }

    connectionsBySession.get(sessionId).add(ws);

    ws.send(JSON.stringify(createPlaybackStateMessage(state)));

    ws.on("message", async (data) => {
      try {
        const message = JSON.parse(data.toString());

        if (
          message === null ||
          typeof message !== "object" ||
          Array.isArray(message)
        ) {
          sendError(ws, "error", "INVALID_MESSAGE");

          return;
        }

        // Instructor authentication
        if (message.type === "auth") {
          const authorization = await verifyInstructorToken(
            {
              sessionId,
              instructorToken: message.token,
            },
            db,
          );

          if (authorization.type !== "AUTHORIZED") {
            sendError(ws, "auth:error", "INVALID_TOKEN");

            return;
          }

          ws.isInstructor = true;

          ws.send(
            JSON.stringify({
              type: "auth:success",
            }),
          );

          return;
        }

        // Only authenticated instructors can control playback.
        if (
          message.type === "playback:play" ||
          message.type === "playback:pause" ||
          message.type === "playback:seek"
        ) {
          if (!ws.isInstructor) {
            sendError(ws, "playback:error", "UNAUTHORIZED");

            return;
          }
        }

        // Play
        if (message.type === "playback:play") {
          const updateResult = await db.query(
            `
              UPDATE session_playback_state
              SET
                is_playing = true,
                version = version + 1,
                updated_at = now()
              WHERE session_id = $1
              RETURNING
                position,
                is_playing,
                version,
                updated_at
            `,
            [sessionId],
          );

          if (updateResult.rows.length === 0) {
            return;
          }

          broadcastPlaybackState(sessionId, updateResult.rows[0]);

          return;
        }

        // Pause
        if (message.type === "playback:pause") {
          const updateResult = await db.query(
            `
              UPDATE session_playback_state
              SET
                is_playing = false,
                version = version + 1,
                updated_at = now()
              WHERE session_id = $1
              RETURNING
                position,
                is_playing,
                version,
                updated_at
            `,
            [sessionId],
          );

          if (updateResult.rows.length === 0) {
            return;
          }

          broadcastPlaybackState(sessionId, updateResult.rows[0]);

          return;
        }

        // Seek
        if (message.type === "playback:seek") {
          if (
            typeof message.position !== "number" ||
            !Number.isFinite(message.position) ||
            message.position < 0
          ) {
            sendError(ws, "playback:error", "INVALID_POSITION");

            return;
          }

          const updateResult = await db.query(
            `
              UPDATE session_playback_state
              SET
                position = $1,
                version = version + 1,
                updated_at = now()
              WHERE session_id = $2
              RETURNING
                position,
                is_playing,
                version,
                updated_at
            `,
            [message.position, sessionId],
          );

          if (updateResult.rows.length === 0) {
            return;
          }

          broadcastPlaybackState(sessionId, updateResult.rows[0]);

          return;
        }
      } catch (error) {
        console.error("WebSocket message handling error:", error);

        sendError(ws, "error", "INVALID_MESSAGE");
      }
    });

    function removeConnection() {
      const connections = connectionsBySession.get(sessionId);

      if (!connections) {
        return;
      }

      connections.delete(ws);

      if (connections.size === 0) {
        connectionsBySession.delete(sessionId);
      }
    }

    ws.on("close", removeConnection);
    ws.on("error", removeConnection);
  });

  return wss;
}

module.exports = {
  attachWebSocketServer,
};
