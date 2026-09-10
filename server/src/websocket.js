const {
  WebSocketServer,
  WebSocket,
} = require("ws");

const {
  calculateEffectivePosition,
} = require("../../shared/playbackSync");

const {
  verifyInstructorToken,
} = require("./services/sessions");

const RESYNC_PAUSE_DURATION_MS = 150;

function attachWebSocketServer(server, db) {
  const connectionsBySession = new Map();

  const resyncsInProgress = new Set();

  function createPlaybackStateMessage(
    state,
    serverTime = new Date().toISOString(),
  ) {
    return {
      type: "playback:state",
      position: Number(state.position),
      isPlaying: state.is_playing,
      version: state.version,
      updatedAt: new Date(
        state.updated_at,
      ).toISOString(),
      serverTime,
    };
  }

  function broadcastPlaybackState(
    sessionId,
    state,
    serverTime,
  ) {
    const connections =
      connectionsBySession.get(
        sessionId,
      );

    if (!connections) {
      return;
    }

    const message = JSON.stringify(
      createPlaybackStateMessage(
        state,
        serverTime,
      ),
    );

    for (const socket of connections) {
      if (
        socket.readyState ===
        WebSocket.OPEN
      ) {
        socket.send(message);
      }
    }
  }

  function broadcastSessionEnded(
    sessionId,
  ) {
    const connections =
      connectionsBySession.get(
        sessionId,
      );

    if (!connections) {
      return;
    }

    const message = JSON.stringify({
      type: "session:ended",
    });

    for (const socket of connections) {
      if (
        socket.readyState ===
        WebSocket.OPEN
      ) {
        socket.send(message);

        socket.close(
          1000,
          "SESSION_ENDED",
        );
      }
    }
  }

  function sendError(
    ws,
    type,
    code,
  ) {
    ws.send(
      JSON.stringify({
        type,
        code,
      }),
    );
  }

  async function getSessionPlaybackState(
    sessionId,
  ) {
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
      return null;
    }

    return result.rows[0];
  }

  /*
   * Synchronization pulse.
   *
   * Any connected member of the session
   * may request this after a browser reload.
   *
   * The synchronization mechanism deliberately
   * uses the same pause/play sequence that has
   * already been proven to bring all clients
   * back onto the same playback position.
   */
  function resyncPlayback(
    sessionId,
  ) {
    if (resyncsInProgress.has(sessionId)) {
      return;
    }

    resyncsInProgress.add(sessionId);

    return performPlaybackResync(
      sessionId,
    ).finally(() => {
      resyncsInProgress.delete(sessionId);
    });
  }

  async function performPlaybackResync(
    sessionId,
  ) {
    const currentState =
      await getSessionPlaybackState(
        sessionId,
      );

    if (!currentState) {
      return;
    }

    if (currentState.status !== "LIVE") {
      return;
    }

    if (!currentState.is_playing) {
      return;
    }

    /*
     * Capture the exact effective position
     * before pausing.
     */
    const pauseServerTime =
      new Date().toISOString();

    const effectivePosition =
      calculateEffectivePosition({
        position: Number(
          currentState.position,
        ),
        isPlaying:
          currentState.is_playing,
        updatedAt: new Date(
          currentState.updated_at,
        ).toISOString(),
        serverTime:
          pauseServerTime,
      });

    /*
     * PAUSE
     *
     * Establish a fresh authoritative
     * position and broadcast the paused state.
     */
    const pauseResult =
      await db.query(
        `
          UPDATE session_playback_state
          SET
            position = $1,
            is_playing = false,
            version = version + 1,
            updated_at = now()
          WHERE session_id = $2
          RETURNING
            position,
            is_playing,
            version,
            updated_at
        `,
        [
          effectivePosition,
          sessionId,
        ],
      );

    if (
      pauseResult.rows.length === 0
    ) {
      return;
    }

    const pauseState =
      pauseResult.rows[0];

    broadcastPlaybackState(
      sessionId,
      pauseState,
    );

    /*
     * Allow connected clients a brief window
     * to process the pause before the play
     * state arrives.
     */
    await new Promise((resolve) => {
      setTimeout(
        resolve,
        RESYNC_PAUSE_DURATION_MS,
      );
    });

    /*
     * PLAY
     *
     * Resume immediately from exactly the
     * position established by the pause.
     */
    const playResult =
      await db.query(
        `
          UPDATE session_playback_state
          SET
            position = $1,
            is_playing = true,
            version = version + 1,
            updated_at = now()
          WHERE session_id = $2
          RETURNING
            position,
            is_playing,
            version,
            updated_at
        `,
        [
          Number(
            pauseState.position,
          ),
          sessionId,
        ],
      );

    if (
      playResult.rows.length === 0
    ) {
      return;
    }

    broadcastPlaybackState(
      sessionId,
      playResult.rows[0],
    );
  }

  const wss =
    new WebSocketServer({
      server,
      path: "/ws",
    });

  wss.on(
    "connection",
    async (ws, req) => {
      const url = new URL(
        req.url,
        "http://localhost",
      );

      const sessionId =
        url.searchParams.get(
          "sessionId",
        );

      ws.isInstructor = false;

      if (!sessionId) {
        ws.close();
        return;
      }

      const state =
        await getSessionPlaybackState(
          sessionId,
        );

      if (!state) {
        ws.close();
        return;
      }

      if (state.status === "ENDED") {
        sendError(
          ws,
          "session:error",
          "SESSION_ENDED",
        );

        ws.close();
        return;
      }

      if (
        !connectionsBySession.has(
          sessionId,
        )
      ) {
        connectionsBySession.set(
          sessionId,
          new Set(),
        );
      }

      connectionsBySession
        .get(sessionId)
        .add(ws);

      /*
       * Send the current playback state
       * immediately when the socket connects.
       */
      ws.send(
        JSON.stringify(
          createPlaybackStateMessage(
            state,
          ),
        ),
      );

      ws.on(
        "message",
        async (data) => {
          try {
            const message =
              JSON.parse(
                data.toString(),
              );

            if (
              message === null ||
              typeof message !==
                "object" ||
              Array.isArray(message)
            ) {
              sendError(
                ws,
                "error",
                "INVALID_MESSAGE",
              );

              return;
            }

            /*
             * Instructor authentication.
             */
            if (
              message.type === "auth"
            ) {
              const authorization =
                await verifyInstructorToken(
                  {
                    sessionId,
                    instructorToken:
                      message.token,
                  },
                  db,
                );

              if (
                authorization.type !==
                "AUTHORIZED"
              ) {
                sendError(
                  ws,
                  "auth:error",
                  "INVALID_TOKEN",
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

            /*
             * Read-only playback state request.
             *
             * Available to instructors and
             * participants.
             */
            if (
              message.type ===
              "playback:request-state"
            ) {
              const currentState =
                await getSessionPlaybackState(
                  sessionId,
                );

              if (!currentState) {
                sendError(
                  ws,
                  "playback:error",
                  "SESSION_NOT_FOUND",
                );

                return;
              }

              if (
                currentState.status ===
                "ENDED"
              ) {
                sendError(
                  ws,
                  "session:error",
                  "SESSION_ENDED",
                );

                ws.close(
                  1000,
                  "SESSION_ENDED",
                );

                return;
              }

              ws.send(
                JSON.stringify(
                  createPlaybackStateMessage(
                    currentState,
                  ),
                ),
              );

              return;
            }

            /*
             * Reload synchronization pulse.
             *
             * Available to any connected
             * member of the session.
             */
            if (
              message.type ===
              "playback:resync"
            ) {
              try {
                await resyncPlayback(
                  sessionId,
                );
              } catch (error) {
                console.error(
                  "Playback resync error:",
                  error,
                );

                sendError(
                  ws,
                  "playback:error",
                  "RESYNC_FAILED",
                );
              }

              return;
            }

            /*
             * Session lifecycle.
             *
             * The REST /end endpoint is the
             * authoritative operation that changes
             * the database status to ENDED.
             */
            if (
              message.type ===
              "session:end"
            ) {
              if (!ws.isInstructor) {
                sendError(
                  ws,
                  "session:error",
                  "UNAUTHORIZED",
                );

                return;
              }

              const currentState =
                await getSessionPlaybackState(
                  sessionId,
                );

              if (!currentState) {
                sendError(
                  ws,
                  "session:error",
                  "SESSION_NOT_FOUND",
                );

                return;
              }

              if (
                currentState.status !==
                "ENDED"
              ) {
                sendError(
                  ws,
                  "session:error",
                  "SESSION_NOT_ENDED",
                );

                return;
              }

              broadcastSessionEnded(
                sessionId,
              );

              return;
            }

            const isPlaybackCommand =
              message.type ===
                "playback:play" ||
              message.type ===
                "playback:pause" ||
              message.type ===
                "playback:seek";

            /*
             * Only authenticated instructors
             * can control playback.
             */
            if (isPlaybackCommand) {
              if (!ws.isInstructor) {
                sendError(
                  ws,
                  "playback:error",
                  "UNAUTHORIZED",
                );

                return;
              }

              const currentState =
                await getSessionPlaybackState(
                  sessionId,
                );

              if (!currentState) {
                sendError(
                  ws,
                  "playback:error",
                  "SESSION_NOT_FOUND",
                );

                return;
              }

              if (
                currentState.status !==
                "LIVE"
              ) {
                sendError(
                  ws,
                  "playback:error",
                  "SESSION_NOT_LIVE",
                );

                return;
              }

              // Play
              if (
                message.type ===
                "playback:play"
              ) {
                const updateResult =
                  await db.query(
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

                if (
                  updateResult.rows
                    .length === 0
                ) {
                  return;
                }

                broadcastPlaybackState(
                  sessionId,
                  updateResult.rows[0],
                );

                return;
              }

              // Pause
              if (
                message.type ===
                "playback:pause"
              ) {
                const pauseServerTime =
                  new Date().toISOString();

                const effectivePosition =
                  calculateEffectivePosition(
                    {
                      position: Number(
                        currentState.position,
                      ),
                      isPlaying:
                        currentState.is_playing,
                      updatedAt:
                        new Date(
                          currentState.updated_at,
                        ).toISOString(),
                      serverTime:
                        pauseServerTime,
                    },
                  );

                const updateResult =
                  await db.query(
                    `
                      UPDATE session_playback_state
                      SET
                        position = $1,
                        is_playing = false,
                        version = version + 1,
                        updated_at = now()
                      WHERE session_id = $2
                      RETURNING
                        position,
                        is_playing,
                        version,
                        updated_at
                    `,
                    [
                      effectivePosition,
                      sessionId,
                    ],
                  );

                if (
                  updateResult.rows
                    .length === 0
                ) {
                  return;
                }

                broadcastPlaybackState(
                  sessionId,
                  updateResult.rows[0],
                );

                return;
              }

              // Seek
              if (
                message.type ===
                "playback:seek"
              ) {
                if (
                  typeof message.position !==
                    "number" ||
                  !Number.isFinite(
                    message.position,
                  ) ||
                  message.position < 0
                ) {
                  sendError(
                    ws,
                    "playback:error",
                    "INVALID_POSITION",
                  );

                  return;
                }

                const updateResult =
                  await db.query(
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
                    [
                      message.position,
                      sessionId,
                    ],
                  );

                if (
                  updateResult.rows
                    .length === 0
                ) {
                  return;
                }

                broadcastPlaybackState(
                  sessionId,
                  updateResult.rows[0],
                );

                return;
              }
            }
          } catch (error) {
            console.error(
              "WebSocket message handling error:",
              error,
            );

            sendError(
              ws,
              "error",
              "INVALID_MESSAGE",
            );
          }
        },
      );

      function removeConnection() {
        const connections =
          connectionsBySession.get(
            sessionId,
          );

        if (!connections) {
          return;
        }

        connections.delete(ws);

        if (connections.size === 0) {
          connectionsBySession.delete(
            sessionId,
          );
        }
      }

      ws.on(
        "close",
        removeConnection,
      );

      ws.on(
        "error",
        removeConnection,
      );
    },
  );

  return wss;
}

module.exports = {
  attachWebSocketServer,
};
