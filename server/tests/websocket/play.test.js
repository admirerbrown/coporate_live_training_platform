import "dotenv/config";

import { describe, it, expect, beforeEach, afterEach, afterAll } from "vitest";

import WebSocket from "ws";
import http from "http";

import { app } from "../../src/app";
import pool from "../../src/db/pool";
import { attachWebSocketServer } from "../../src/websocket";

describe("WebSocket playback controls", () => {
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
      server.listen(0, resolve);
    });

    const { port } = server.address();
    baseUrl = `ws://localhost:${port}`;
  });

  afterEach(async () => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.close();
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

  it("updates playback state when instructor sends play", async () => {
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
      [
        "Play Test Session",
        "https://www.youtube.com/watch?v=test123",
        "test-instructor-token",
      ],
    );

    const sessionId = sessionResult.rows[0].id;

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
      [sessionId, 10, false, 0],
    );

    ws = new WebSocket(`${baseUrl}/ws?sessionId=${sessionId}`);

    await new Promise((resolve, reject) => {
      ws.once("open", resolve);
      ws.once("error", reject);
    });

    // Consume the initial playback state.
    await new Promise((resolve, reject) => {
      ws.once("message", () => resolve());
      ws.once("error", reject);
    });

    // Authenticate as the instructor.
    ws.send(
      JSON.stringify({
        type: "auth",
        token: "test-instructor-token",
      }),
    );

    const authMessage = await new Promise((resolve, reject) => {
      ws.once("message", (data) => {
        resolve(JSON.parse(data.toString()));
      });

      ws.once("error", reject);
    });

    expect(authMessage).toEqual({
      type: "auth:success",
    });

    // Instructor controls playback.
    ws.send(
      JSON.stringify({
        type: "playback:play",
      }),
    );

    const message = await new Promise((resolve, reject) => {
      ws.once("message", (data) => {
        resolve(JSON.parse(data.toString()));
      });

      ws.once("error", reject);
    });

    expect(message).toEqual({
      type: "playback:state",
      position: 10,
      isPlaying: true,
      version: 1,
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
      position: "10",
      is_playing: true,
      version: 1,
    });
  });
});
