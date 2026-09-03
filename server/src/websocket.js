const { WebSocketServer } = require("ws");
const { verifyInstructorToken } = require("./services/sessions");

function attachWebSocketServer(server, db) {
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
          position,
          is_playing,
          version
        FROM session_playback_state
        WHERE session_id = $1
      `,
      [sessionId],
    );

    if (result.rows.length === 0) {
      ws.close();
      return;
    }

    const state = result.rows[0];

    ws.send(
      JSON.stringify({
        type: "playback:state",
        position: Number(state.position),
        isPlaying: state.is_playing,
        version: state.version,
      }),
    );

    ws.on("message", async (data) => {
      const message = JSON.parse(data.toString());

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
          ws.send(
            JSON.stringify({
              type: "auth:error",
              code: "INVALID_TOKEN",
            }),
          );

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

      // Only authenticated instructors can control playback
      if (
        message.type === "playback:play" ||
        message.type === "playback:pause" ||
        message.type === "playback:seek"
      ) {
        if (!ws.isInstructor) {
          ws.send(
            JSON.stringify({
              type: "playback:error",
              code: "UNAUTHORIZED",
            }),
          );

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
              version
          `,
          [sessionId],
        );

        if (updateResult.rows.length === 0) {
          return;
        }

        const updatedState = updateResult.rows[0];

        ws.send(
          JSON.stringify({
            type: "playback:state",
            position: Number(updatedState.position),
            isPlaying: updatedState.is_playing,
            version: updatedState.version,
          }),
        );
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
              version
          `,
          [sessionId],
        );

        if (updateResult.rows.length === 0) {
          return;
        }

        const updatedState = updateResult.rows[0];

        ws.send(
          JSON.stringify({
            type: "playback:state",
            position: Number(updatedState.position),
            isPlaying: updatedState.is_playing,
            version: updatedState.version,
          }),
        );
      }

      // Seek
      if (message.type === "playback:seek") {
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
              version
          `,
          [message.position, sessionId],
        );

        if (updateResult.rows.length === 0) {
          return;
        }

        const updatedState = updateResult.rows[0];

        ws.send(
          JSON.stringify({
            type: "playback:state",
            position: Number(updatedState.position),
            isPlaying: updatedState.is_playing,
            version: updatedState.version,
          }),
        );
      }
    });
  });

  return wss;
}

module.exports = {
  attachWebSocketServer,
};