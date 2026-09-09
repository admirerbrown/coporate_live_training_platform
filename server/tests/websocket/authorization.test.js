import "dotenv/config";

import { describe, it, expect, beforeEach, afterEach, afterAll } from "vitest";

import WebSocket from "ws";
import http from "http";

import { app } from "../../src/app";
import pool from "../../src/db/pool";
import { attachWebSocketServer } from "../../src/websocket";

describe("WebSocket authentication", () => {
  let server;
  let wss;
  let sockets;
  let baseUrl;

  beforeEach(async () => {
    await pool.query("DELETE FROM session_participants");
    await pool.query("DELETE FROM session_playback_state");
    await pool.query("DELETE FROM training_sessions");

    server = http.createServer(app);
    wss = attachWebSocketServer(server, pool);

    await new Promise((resolve) => {
      server.listen(0, resolve);
    });

    const { port } = server.address();
    baseUrl = `ws://localhost:${port}`;

    // Track every socket opened during a test so afterEach can close
    // all of them, including tests with multiple connections.
    sockets = [];
  });

  afterEach(async () => {
    for (const socket of sockets) {
      if (
        socket.readyState === WebSocket.OPEN ||
        socket.readyState === WebSocket.CONNECTING
      ) {
        socket.close();
      }
    }

    await new Promise((resolve) => {
      wss.close(resolve);
    });

    await new Promise((resolve) => {
      server.close(resolve);
    });
  });

  afterAll(async () => {
    await pool.end();
  });

  // ---------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------

  async function createLiveSession({
    name = "Test Session",
    youtubeUrl = "https://www.youtube.com/watch?v=test123",
    instructorToken = "test-instructor-token",
  } = {}) {
    const sessionResult = await pool.query(
      `
        INSERT INTO training_sessions (
          name,
          youtube_url,
          instructor_token,
          status
        )
        VALUES ($1, $2, $3, 'LIVE')
        RETURNING id
      `,
      [name, youtubeUrl, instructorToken],
    );

    const sessionId = sessionResult.rows[0].id;

    await pool.query(
      `
        INSERT INTO session_playback_state (
          session_id
        )
        VALUES ($1)
      `,
      [sessionId],
    );

    return { sessionId, instructorToken };
  }

  async function connect(sessionId) {
    const socket = new WebSocket(`${baseUrl}/ws?sessionId=${sessionId}`);
    sockets.push(socket);

    await new Promise((resolve, reject) => {
      socket.once("open", resolve);
      socket.once("error", reject);
    });

    const initialMessage = await new Promise((resolve, reject) => {
      socket.once("message", (data) => resolve(JSON.parse(data.toString())));
      socket.once("error", reject);
    });

    return { socket, initialMessage };
  }

  function nextMessage(socket) {
    return new Promise((resolve, reject) => {
      socket.once("message", (data) => resolve(JSON.parse(data.toString())));
      socket.once("error", reject);
    });
  }

  function authenticate(socket, token) {
    socket.send(JSON.stringify({ type: "auth", token }));
    return nextMessage(socket);
  }

  // ---------------------------------------------------------------------
  // Handshake
  // ---------------------------------------------------------------------

  it("sends a valid initial playback-state message on connect", async () => {
    const { sessionId } = await createLiveSession();
    const { initialMessage } = await connect(sessionId);

    expect(initialMessage).toMatchObject({
      type: "playback:state",
      position: 0,
      isPlaying: false,
    });
  });

  it("authenticates an instructor with the correct session token", async () => {
    const { sessionId, instructorToken } = await createLiveSession({
      name: "Authentication Test Session",
      instructorToken: "session-a-instructor-token",
    });

    const { socket } = await connect(sessionId);
    const message = await authenticate(socket, instructorToken);

    expect(message).toEqual({ type: "auth:success" });
  });

  it("rejects an invalid instructor token", async () => {
    const { sessionId } = await createLiveSession({
      name: "Invalid Token Test Session",
      instructorToken: "correct-instructor-token",
    });

    const { socket } = await connect(sessionId);
    const message = await authenticate(socket, "wrong-instructor-token");

    expect(message).toEqual({ type: "auth:error", code: "INVALID_TOKEN" });
  });

  it("rejects a valid instructor token belonging to another session", async () => {
    await createLiveSession({
      name: "First Session",
      youtubeUrl: "https://www.youtube.com/watch?v=first123",
      instructorToken: "first-session-token",
    });

    const { sessionId: secondSessionId } = await createLiveSession({
      name: "Second Session",
      youtubeUrl: "https://www.youtube.com/watch?v=second123",
      instructorToken: "second-session-token",
    });

    const { socket } = await connect(secondSessionId);

    // This token is valid, but belongs to the first session.
    const message = await authenticate(socket, "first-session-token");

    expect(message).toEqual({ type: "auth:error", code: "INVALID_TOKEN" });
  });

  it("rejects an auth message with no token", async () => {
    const { sessionId } = await createLiveSession();
    const { socket } = await connect(sessionId);

    socket.send(JSON.stringify({ type: "auth" }));
    const message = await nextMessage(socket);

    expect(message).toEqual({ type: "auth:error", code: "INVALID_TOKEN" });
  });

  // ---------------------------------------------------------------------
  // Authorization gate
  // ---------------------------------------------------------------------

  it("rejects a play command from a connection that never authenticated", async () => {
    const { sessionId } = await createLiveSession();
    const { socket } = await connect(sessionId);

    socket.send(JSON.stringify({ type: "playback:play" }));
    const message = await nextMessage(socket);

    expect(message).toEqual({ type: "playback:error", code: "UNAUTHORIZED" });
  });

  it("rejects a play command sent after a failed authentication attempt", async () => {
    const { sessionId } = await createLiveSession({
      instructorToken: "correct-instructor-token",
    });

    const { socket } = await connect(sessionId);
    await authenticate(socket, "wrong-instructor-token");

    socket.send(JSON.stringify({ type: "playback:play" }));
    const message = await nextMessage(socket);

    expect(message).toEqual({ type: "playback:error", code: "UNAUTHORIZED" });
  });

  it("accepts a play command after successful instructor authentication", async () => {
    const { sessionId, instructorToken } = await createLiveSession();
    const { socket } = await connect(sessionId);

    await authenticate(socket, instructorToken);

    socket.send(JSON.stringify({ type: "playback:play" }));
    const message = await nextMessage(socket);

    // The complete playback-state response is tested in play.test.js.
    // This test only verifies that authentication grants control access.
    expect(message.type).not.toBe("playback:error");
  });

  it("does not grant instructor rights to a second unauthenticated connection on the same session", async () => {
    const { sessionId, instructorToken } = await createLiveSession();

    const { socket: instructorSocket } = await connect(sessionId);
    await authenticate(instructorSocket, instructorToken);

    const { socket: participantSocket } = await connect(sessionId);

    participantSocket.send(JSON.stringify({ type: "playback:play" }));
    const message = await nextMessage(participantSocket);

    expect(message).toEqual({ type: "playback:error", code: "UNAUTHORIZED" });
  });

  it("does not let a new connection inherit instructor rights after an authenticated connection disconnects", async () => {
    const { sessionId, instructorToken } = await createLiveSession();

    const { socket: firstInstructorSocket } = await connect(sessionId);
    await authenticate(firstInstructorSocket, instructorToken);
    firstInstructorSocket.close();

    const { socket: newSocket } = await connect(sessionId);

    newSocket.send(JSON.stringify({ type: "playback:play" }));
    const message = await nextMessage(newSocket);

    expect(message).toEqual({ type: "playback:error", code: "UNAUTHORIZED" });
  });

  it("rejects all playback commands when the session is not live", async () => {
    const { sessionId, instructorToken } = await createLiveSession();

    await pool.query(
      `
        UPDATE training_sessions
        SET status = 'CREATED'
        WHERE id = $1
      `,
      [sessionId],
    );

    const { socket } = await connect(sessionId);

    await authenticate(socket, instructorToken);

    const commands = [
      {
        type: "playback:play",
      },
      {
        type: "playback:pause",
      },
      {
        type: "playback:seek",
        position: 42,
      },
    ];

    for (const command of commands) {
      socket.send(JSON.stringify(command));

      const message = await nextMessage(socket);

      expect(message).toEqual({
        type: "playback:error",
        code: "SESSION_NOT_LIVE",
      });
    }

    const result = await pool.query(
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

    expect(result.rows[0]).toEqual({
      position: "0",
      is_playing: false,
      version: 0,
    });
  });

  it("rejects playback commands when a live session becomes ended after the instructor connects", async () => {
    const { sessionId, instructorToken } = await createLiveSession();

    const { socket } = await connect(sessionId);

    await authenticate(socket, instructorToken);

    await pool.query(
      `
        UPDATE training_sessions
        SET status = 'ENDED'
        WHERE id = $1
      `,
      [sessionId],
    );

    socket.send(
      JSON.stringify({
        type: "playback:pause",
      }),
    );

    const message = await nextMessage(socket);

    expect(message).toEqual({
      type: "playback:error",
      code: "SESSION_NOT_LIVE",
    });

    const result = await pool.query(
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

    expect(result.rows[0]).toEqual({
      position: "0",
      is_playing: false,
      version: 0,
    });
  });
  it("rejects session:end from an unauthenticated connection", async () => {
    const { sessionId } = await createLiveSession();

    const { socket } = await connect(sessionId);

    socket.send(
      JSON.stringify({
        type: "session:end",
      }),
    );

    const message = await nextMessage(socket);

    expect(message).toEqual({
      type: "session:error",
      code: "UNAUTHORIZED",
    });
  });

  it("rejects session:end when the session has not ended yet", async () => {
    const { sessionId, instructorToken } = await createLiveSession();

    const { socket } = await connect(sessionId);

    await authenticate(socket, instructorToken);

    socket.send(
      JSON.stringify({
        type: "session:end",
      }),
    );

    const message = await nextMessage(socket);

    expect(message).toEqual({
      type: "session:error",
      code: "SESSION_NOT_ENDED",
    });
  });
});
