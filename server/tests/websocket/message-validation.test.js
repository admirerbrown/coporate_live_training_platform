import "dotenv/config";

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  afterAll,
} from "vitest";

import WebSocket from "ws";
import http from "http";

import { app } from "../../src/app";
import pool from "../../src/db/pool";
import { attachWebSocketServer } from "../../src/websocket";

describe("WebSocket message validation", () => {
  let server;
  let wss;
  let ws;
  let baseUrl;

  beforeEach(async () => {
    await pool.query("DELETE FROM session_participants");
    await pool.query("DELETE FROM session_playback_state");
    await pool.query("DELETE FROM training_sessions");

    server = http.createServer(app);

    wss = attachWebSocketServer(server, pool);

    await new Promise((resolve) => {
      server.listen(0, "127.0.0.1", resolve);
    });

    const { port } = server.address();
    baseUrl = `ws://127.0.0.1:${port}/ws`;
  });

  afterEach(async () => {
    if (
      ws &&
      (ws.readyState === WebSocket.OPEN ||
        ws.readyState === WebSocket.CONNECTING)
    ) {
      ws.terminate();
    }

    await new Promise((resolve) => {
      if (!wss) {
        resolve();
        return;
      }

      wss.close(resolve);
    });

    await new Promise((resolve) => {
      if (!server) {
        resolve();
        return;
      }

      server.close(resolve);
    });
  });

  afterAll(async () => {
    await pool.end();
  });

  async function createLiveSession({
    instructorToken = "test-instructor-token",
  } = {}) {
    const result = await pool.query(
      `
        INSERT INTO training_sessions (
          name,
          youtube_url,
          instructor_token,
          status
        )
        VALUES ($1, $2, $3, 'LIVE')
        RETURNING id, instructor_token
      `,
      [
        "Message Validation Test",
        "https://www.youtube.com/watch?v=test123",
        instructorToken,
      ],
    );

    const session = result.rows[0];

    await pool.query(
      `
        INSERT INTO session_playback_state (
          session_id,
          position,
          is_playing,
          version
        )
        VALUES ($1, $2, $3, $4)
      `,
      [session.id, 15, true, 4],
    );

    return session;
  }

  async function createEndedSession() {
    const result = await pool.query(
      `
        INSERT INTO training_sessions (
          name,
          youtube_url,
          instructor_token,
          status
        )
        VALUES ($1, $2, $3, 'ENDED')
        RETURNING id
      `,
      [
        "Ended Session",
        "https://www.youtube.com/watch?v=test123",
        "test-instructor-token",
      ],
    );

    const sessionId = result.rows[0].id;

    await pool.query(
      `
        INSERT INTO session_playback_state (
          session_id
        )
        VALUES ($1)
      `,
      [sessionId],
    );

    return sessionId;
  }

  function connect(sessionId) {
    ws = new WebSocket(
      `${baseUrl}?sessionId=${sessionId}`,
    );

    return new Promise((resolve, reject) => {
      ws.once("open", resolve);
      ws.once("error", reject);
    });
  }

  function nextMessage() {
    return new Promise((resolve, reject) => {
      ws.once("message", (data) => {
        resolve(JSON.parse(data.toString()));
      });

      ws.once("error", reject);
    });
  }

  async function consumeInitialState() {
    const message = await nextMessage();

    expect(message).toEqual({
      type: "playback:state",
      position: 15,
      isPlaying: true,
      version: 4,
    });
  }

  async function authenticate(token) {
    ws.send(
      JSON.stringify({
        type: "auth",
        token,
      }),
    );

    return nextMessage();
  }

  it("rejects malformed JSON without killing the connection", async () => {
    const session = await createLiveSession();

    await connect(session.id);
    await consumeInitialState();

    ws.send('{"type":"auth"');

    const errorMessage = await nextMessage();

    expect(errorMessage).toEqual({
      type: "error",
      code: "INVALID_MESSAGE",
    });

    const authMessage = await authenticate(
      session.instructor_token,
    );

    expect(authMessage).toEqual({
      type: "auth:success",
    });
  });

  it.each([
    ["null payload", null],
    ["array payload", []],
    ["string payload", "playback:play"],
    ["number payload", 42],
  ])(
    "rejects %s as an invalid message",
    async (_description, payload) => {
      const session = await createLiveSession();

      await connect(session.id);
      await consumeInitialState();

      ws.send(JSON.stringify(payload));

      const message = await nextMessage();

      expect(message).toEqual({
        type: "error",
        code: "INVALID_MESSAGE",
      });
    },
  );

  it("rejects a seek command with a missing position", async () => {
    const session = await createLiveSession();

    await connect(session.id);
    await consumeInitialState();

    await authenticate(session.instructor_token);

    ws.send(
      JSON.stringify({
        type: "playback:seek",
      }),
    );

    const message = await nextMessage();

    expect(message).toEqual({
      type: "playback:error",
      code: "INVALID_POSITION",
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
      [session.id],
    );

    expect(result.rows[0]).toEqual({
      position: "15",
      is_playing: true,
      version: 4,
    });
  });

  it("rejects a seek command with a non-numeric position", async () => {
    const session = await createLiveSession();

    await connect(session.id);
    await consumeInitialState();

    await authenticate(session.instructor_token);

    ws.send(
      JSON.stringify({
        type: "playback:seek",
        position: "42.5",
      }),
    );

    const message = await nextMessage();

    expect(message).toEqual({
      type: "playback:error",
      code: "INVALID_POSITION",
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
      [session.id],
    );

    expect(result.rows[0]).toEqual({
      position: "15",
      is_playing: true,
      version: 4,
    });
  });

  it("rejects a seek command with a negative position", async () => {
    const session = await createLiveSession();

    await connect(session.id);
    await consumeInitialState();

    await authenticate(session.instructor_token);

    ws.send(
      JSON.stringify({
        type: "playback:seek",
        position: -1,
      }),
    );

    const message = await nextMessage();

    expect(message).toEqual({
      type: "playback:error",
      code: "INVALID_POSITION",
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
      [session.id],
    );

    expect(result.rows[0]).toEqual({
      position: "15",
      is_playing: true,
      version: 4,
    });
  });

  it("rejects a WebSocket connection to an ended session", async () => {
    const sessionId = await createEndedSession();

    await connect(sessionId);

    const message = await nextMessage();

    expect(message).toEqual({
      type: "session:error",
      code: "SESSION_ENDED",
    });

    await new Promise((resolve) => {
      ws.once("close", resolve);
    });
  });
});