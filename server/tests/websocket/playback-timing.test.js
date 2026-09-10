import "dotenv/config";

import { describe, it, expect, beforeEach, afterEach, afterAll } from "vitest";

import WebSocket from "ws";
import http from "http";

import { app } from "../../src/app";
import pool from "../../src/db/pool";
import { attachWebSocketServer } from "../../src/websocket";

describe("WebSocket playback timing", () => {
  let server;
  let wss;
  let baseUrl;
  const sockets = [];

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
    for (const socket of sockets) {
      if (
        socket.readyState === WebSocket.OPEN ||
        socket.readyState === WebSocket.CONNECTING
      ) {
        socket.terminate();
      }
    }

    sockets.length = 0;

    await new Promise((resolve) => {
      if (wss) {
        wss.close(resolve);
      } else {
        resolve();
      }
    });

    await new Promise((resolve) => {
      if (server) {
        server.close(resolve);
      } else {
        resolve();
      }
    });
  });

  afterAll(async () => {
    await pool.end();
  });

  async function createSession({
    position = 0,
    isPlaying = false,
    version = 0,
    updatedAt = null,
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
        RETURNING id, instructor_token
      `,
      [
        "Playback Timing Test",
        "https://www.youtube.com/watch?v=test123",
        instructorToken,
      ],
    );

    const session = sessionResult.rows[0];

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
      [session.id, position, isPlaying, version],
    );

    if (updatedAt) {
      await pool.query(
        `
          UPDATE session_playback_state
          SET updated_at = $1
          WHERE session_id = $2
        `,
        [updatedAt, session.id],
      );
    }

    return session;
  }

  async function connect(sessionId) {
    const socket = new WebSocket(`${baseUrl}?sessionId=${sessionId}`);

    sockets.push(socket);

    socket.messageQueue = [];
    socket.messageWaiters = [];

    socket.on("message", (data) => {
      const message = JSON.parse(data.toString());

      if (socket.messageWaiters.length > 0) {
        const waiter = socket.messageWaiters.shift();
        waiter.resolve(message);
        return;
      }

      socket.messageQueue.push(message);
    });

    socket.on("error", (error) => {
      while (socket.messageWaiters.length > 0) {
        const waiter = socket.messageWaiters.shift();
        waiter.reject(error);
      }
    });

    socket.on("close", () => {
      const error = new Error("WebSocket closed");

      while (socket.messageWaiters.length > 0) {
        const waiter = socket.messageWaiters.shift();
        waiter.reject(error);
      }
    });

    await new Promise((resolve, reject) => {
      socket.once("open", resolve);
      socket.once("error", reject);
    });

    return socket;
  }

  function nextMessage(socket) {
    if (socket.messageQueue.length > 0) {
      return Promise.resolve(socket.messageQueue.shift());
    }

    return new Promise((resolve, reject) => {
      socket.messageWaiters.push({
        resolve,
        reject,
      });
    });
  }

  async function consumeInitialState(socket) {
    return nextMessage(socket);
  }

  async function authenticate(socket, token) {
    socket.send(
      JSON.stringify({
        type: "auth",
        token,
      }),
    );

    const message = await nextMessage(socket);

    expect(message).toEqual({
      type: "auth:success",
    });
  }

  it("sends updatedAt matching the persisted playback state's updated_at on connect", async () => {
    const knownUpdatedAt = new Date("2026-01-01T12:00:00.000Z");

    const session = await createSession({
      position: 125,
      isPlaying: true,
      version: 7,
      updatedAt: knownUpdatedAt,
    });

    const socket = await connect(session.id);
    const message = await consumeInitialState(socket);

    expect(message).toMatchObject({
      type: "playback:state",
      position: 125,
      isPlaying: true,
      version: 7,
      updatedAt: knownUpdatedAt.toISOString(),
    });
  });

  it("includes a parseable serverTime on the initial playback state", async () => {
    const session = await createSession();

    const before = Date.now();

    const socket = await connect(session.id);
    const message = await consumeInitialState(socket);

    const after = Date.now();

    expect(message).toHaveProperty("serverTime");

    const serverTime = Date.parse(message.serverTime);

    expect(Number.isNaN(serverTime)).toBe(false);
    expect(serverTime).toBeGreaterThanOrEqual(before);
    expect(serverTime).toBeLessThanOrEqual(after);
  });

  it("coalesces simultaneous refresh resync requests", async () => {
    const session = await createSession({
      isPlaying: true,
      version: 0,
    });

    const firstSocket = await connect(session.id);
    const secondSocket = await connect(session.id);

    await consumeInitialState(firstSocket);
    await consumeInitialState(secondSocket);

    firstSocket.send(
      JSON.stringify({
        type: "playback:resync",
      }),
    );

    secondSocket.send(
      JSON.stringify({
        type: "playback:resync",
      }),
    );

    const [firstPause, secondPause] = await Promise.all([
      nextMessage(firstSocket),
      nextMessage(secondSocket),
    ]);

    const [firstPlay, secondPlay] = await Promise.all([
      nextMessage(firstSocket),
      nextMessage(secondSocket),
    ]);

    expect(firstPause).toMatchObject({
      type: "playback:state",
      isPlaying: false,
      version: 1,
    });

    expect(secondPause).toMatchObject({
      type: "playback:state",
      isPlaying: false,
      version: 1,
    });

    expect(firstPlay).toMatchObject({
      type: "playback:state",
      isPlaying: true,
      version: 2,
    });

    expect(secondPlay).toMatchObject({
      type: "playback:state",
      isPlaying: true,
      version: 2,
    });

    const result = await pool.query(
      `
        SELECT version, is_playing
        FROM session_playback_state
        WHERE session_id = $1
      `,
      [session.id],
    );

    expect(result.rows[0]).toEqual({
      version: 2,
      is_playing: true,
    });
  });

  it("produces strictly increasing updatedAt values for sequential playback actions", async () => {
    const session = await createSession();

    const socket = await connect(session.id);

    await consumeInitialState(socket);

    await authenticate(socket, session.instructor_token);

    const firstState = nextMessage(socket);

    socket.send(
      JSON.stringify({
        type: "playback:play",
      }),
    );

    const playState = await firstState;

    const secondState = nextMessage(socket);

    socket.send(
      JSON.stringify({
        type: "playback:pause",
      }),
    );

    const pauseState = await secondState;

    expect(playState).toHaveProperty("updatedAt");
    expect(pauseState).toHaveProperty("updatedAt");

    expect(Date.parse(pauseState.updatedAt)).toBeGreaterThan(
      Date.parse(playState.updatedAt),
    );
  });

  it("does not reuse updatedAt as serverTime for a late joiner", async () => {
    const oldUpdatedAt = new Date("2026-01-01T12:00:00.000Z");

    const session = await createSession({
      position: 125,
      isPlaying: true,
      version: 3,
      updatedAt: oldUpdatedAt,
    });

    const socket = await connect(session.id);
    const message = await consumeInitialState(socket);

    expect(message.updatedAt).toBe(oldUpdatedAt.toISOString());

    expect(message.serverTime).not.toBe(message.updatedAt);

    expect(Date.parse(message.serverTime)).toBeGreaterThan(
      Date.parse(message.updatedAt),
    );
  });

  it("sends the exact stored position for a paused session without time drift", async () => {
    const oldUpdatedAt = new Date("2026-01-01T12:00:00.000Z");

    const session = await createSession({
      position: 77.5,
      isPlaying: false,
      version: 4,
      updatedAt: oldUpdatedAt,
    });

    const socket = await connect(session.id);
    const message = await consumeInitialState(socket);

    expect(message).toMatchObject({
      type: "playback:state",
      position: 77.5,
      isPlaying: false,
      version: 4,
      updatedAt: oldUpdatedAt.toISOString(),
    });

    expect(message.position).toBe(77.5);
  });

  it("includes updatedAt and serverTime on a broadcast playback state", async () => {
    const session = await createSession();

    const socket = await connect(session.id);

    await consumeInitialState(socket);

    await authenticate(socket, session.instructor_token);

    const before = Date.now();

    const broadcast = nextMessage(socket);

    socket.send(
      JSON.stringify({
        type: "playback:seek",
        position: 125,
      }),
    );

    const message = await broadcast;

    const after = Date.now();

    expect(message).toMatchObject({
      type: "playback:state",
      position: 125,
      isPlaying: false,
      version: 1,
    });

    expect(message).toHaveProperty("updatedAt");
    expect(message).toHaveProperty("serverTime");

    const updatedAt = Date.parse(message.updatedAt);

    const serverTime = Date.parse(message.serverTime);

    expect(Number.isNaN(updatedAt)).toBe(false);
    expect(Number.isNaN(serverTime)).toBe(false);

    expect(updatedAt).toBeLessThanOrEqual(serverTime);

    expect(serverTime).toBeGreaterThanOrEqual(before);
    expect(serverTime).toBeLessThanOrEqual(after);
  });
});
