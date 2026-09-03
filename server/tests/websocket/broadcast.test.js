import "dotenv/config";

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
} from "vitest";

import WebSocket from "ws";
import http from "http";

import { app } from "../../src/app";
import pool from "../../src/db/pool";
import { attachWebSocketServer } from "../../src/websocket";

describe("WebSocket playback broadcasting", () => {
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

  async function createLiveSession({
    name = "Broadcast Test",
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
        name,
        "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        instructorToken,
      ],
    );

    const session = result.rows[0];

    await pool.query(
      `
        INSERT INTO session_playback_state (
          session_id
        )
        VALUES ($1)
      `,
      [session.id],
    );

    return session;
  }

  async function connect(sessionId) {
    const socket = new WebSocket(
      `${baseUrl}?sessionId=${sessionId}`,
    );

    sockets.push(socket);

    await new Promise((resolve, reject) => {
      socket.once("open", resolve);
      socket.once("error", reject);
    });

    // Consume the initial playback state before returning the socket.
    const initialMessage = await nextMessage(socket);

    expect(initialMessage).toMatchObject({
      type: "playback:state",
      position: 0,
      isPlaying: false,
      version: 0,
    });

    expect(initialMessage.updatedAt).toBeTruthy();
    expect(initialMessage.serverTime).toBeTruthy();

    return {
      socket,
      initialMessage,
    };
  }

  function nextMessage(socket) {
    return new Promise((resolve, reject) => {
      const handleMessage = (data) => {
        socket.off("error", handleError);

        resolve(JSON.parse(data.toString()));
      };

      const handleError = (error) => {
        socket.off("message", handleMessage);

        reject(error);
      };

      socket.once("message", handleMessage);
      socket.once("error", handleError);
    });
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

  async function waitForClose(socket) {
    if (socket.readyState === WebSocket.CLOSED) {
      return;
    }

    await new Promise((resolve) => {
      socket.once("close", resolve);
    });
  }

  function expectValidPlaybackState(message, expectedState) {
    expect(message).toMatchObject({
      type: "playback:state",
      ...expectedState,
    });

    expect(message.updatedAt).toBeTruthy();
    expect(message.serverTime).toBeTruthy();

    expect(
      Number.isNaN(Date.parse(message.updatedAt)),
    ).toBe(false);

    expect(
      Number.isNaN(Date.parse(message.serverTime)),
    ).toBe(false);
  }

  it("broadcasts playback state to the instructor and two participants in the same session", async () => {
    const session = await createLiveSession();

    const { socket: instructor } = await connect(session.id);
    const { socket: participantA } = await connect(session.id);
    const { socket: participantB } = await connect(session.id);

    await authenticate(
      instructor,
      session.instructor_token,
    );

    const instructorState = nextMessage(instructor);
    const participantAState = nextMessage(participantA);
    const participantBState = nextMessage(participantB);

    instructor.send(
      JSON.stringify({
        type: "playback:play",
      }),
    );

    const messages = await Promise.all([
      instructorState,
      participantAState,
      participantBState,
    ]);

    for (const message of messages) {
      expectValidPlaybackState(message, {
        position: 0,
        isPlaying: true,
        version: 1,
      });
    }

    expect(messages[0].updatedAt).toBe(
      messages[1].updatedAt,
    );

    expect(messages[1].updatedAt).toBe(
      messages[2].updatedAt,
    );

    expect(messages[0].serverTime).toBe(
      messages[1].serverTime,
    );

    expect(messages[1].serverTime).toBe(
      messages[2].serverTime,
    );
  });

  it("does not broadcast session A playback changes to session B", async () => {
    const sessionA = await createLiveSession({
      name: "Session A",
      instructorToken: "session-a-token",
    });

    const sessionB = await createLiveSession({
      name: "Session B",
      instructorToken: "session-b-token",
    });

    const { socket: instructorA } = await connect(sessionA.id);
    const { socket: participantA } = await connect(sessionA.id);
    const { socket: participantB } = await connect(sessionB.id);

    await authenticate(
      instructorA,
      sessionA.instructor_token,
    );

    const participantAMessage = nextMessage(
      participantA,
    );

    let sessionBReceived = false;

    const onMessage = () => {
      sessionBReceived = true;
    };

    participantB.on("message", onMessage);

    instructorA.send(
      JSON.stringify({
        type: "playback:play",
      }),
    );

    const message = await participantAMessage;

    participantB.off("message", onMessage);

    expectValidPlaybackState(message, {
      position: 0,
      isPlaying: true,
      version: 1,
    });

    await new Promise((resolve) => {
      setTimeout(resolve, 50);
    });

    expect(sessionBReceived).toBe(false);
  });

  it("broadcasts playback state to participants who never authenticated", async () => {
    const session = await createLiveSession();

    const { socket: instructor } = await connect(session.id);
    const { socket: participant } = await connect(session.id);

    await authenticate(
      instructor,
      session.instructor_token,
    );

    const participantState = nextMessage(participant);

    instructor.send(
      JSON.stringify({
        type: "playback:pause",
      }),
    );

    const message = await participantState;

    expectValidPlaybackState(message, {
      position: 0,
      isPlaying: false,
      version: 1,
    });
  });

  it("continues broadcasting after one participant disconnects", async () => {
    const session = await createLiveSession();

    const { socket: instructor } = await connect(session.id);
    const { socket: participantA } = await connect(session.id);
    const { socket: participantB } = await connect(session.id);

    await authenticate(
      instructor,
      session.instructor_token,
    );

    participantA.close();

    await waitForClose(participantA);

    const instructorState = nextMessage(instructor);
    const participantBState = nextMessage(participantB);

    instructor.send(
      JSON.stringify({
        type: "playback:seek",
        position: 42,
      }),
    );

    const [
      instructorMessage,
      participantBMessage,
    ] = await Promise.all([
      instructorState,
      participantBState,
    ]);

    expectValidPlaybackState(instructorMessage, {
      position: 42,
      isPlaying: false,
      version: 1,
    });

    expectValidPlaybackState(participantBMessage, {
      position: 42,
      isPlaying: false,
      version: 1,
    });

    expect(
      instructorMessage.updatedAt,
    ).toBe(participantBMessage.updatedAt);

    expect(
      instructorMessage.serverTime,
    ).toBe(participantBMessage.serverTime);
  });

  it("persists the updated playback state before broadcasting it", async () => {
    const session = await createLiveSession();

    const { socket: instructor } = await connect(session.id);
    const { socket: participant } = await connect(session.id);

    await authenticate(
      instructor,
      session.instructor_token,
    );

    const participantState = nextMessage(participant);

    instructor.send(
      JSON.stringify({
        type: "playback:seek",
        position: 125,
      }),
    );

    const message = await participantState;

    expectValidPlaybackState(message, {
      position: 125,
      isPlaying: false,
      version: 1,
    });

    const result = await pool.query(
      `
        SELECT
          position,
          is_playing,
          version,
          updated_at
        FROM session_playback_state
        WHERE session_id = $1
      `,
      [session.id],
    );

    expect(result.rows).toHaveLength(1);

    expect(result.rows[0]).toEqual({
      position: "125",
      is_playing: false,
      version: 1,
      updated_at: expect.any(Date),
    });

    expect(message.updatedAt).toBe(
      result.rows[0].updated_at.toISOString(),
    );

    expect(
      Date.parse(message.updatedAt),
    ).toBeLessThanOrEqual(
      Date.parse(message.serverTime),
    );
  });
});
