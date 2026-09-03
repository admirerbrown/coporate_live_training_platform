import "dotenv/config";
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { attachWebSocketServer } from "../../src/websocket";
import WebSocket from "ws";
import http from "http";

import { app } from "../../src/app";
import pool from "../../src/db/pool";

describe("WebSocket connection", () => {
  let server;
  let baseUrl;

  beforeEach(async () => {
    await pool.query("DELETE FROM session_participants");
    await pool.query("DELETE FROM session_playback_state");
    await pool.query("DELETE FROM training_sessions");


    server = http.createServer(app);

    attachWebSocketServer(server, pool);

    await new Promise((resolve) => {
      server.listen(0, resolve);
    });

    const { port } = server.address();
    baseUrl = `ws://localhost:${port}`;
  });

  afterAll(async () => {
    await pool.end();
  });

  it("sends the current playback state when a client connects", async () => {
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
        "WebSocket Test Session",
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
        VALUES ($1, 0, false, 0)
      `,
      [sessionId],
    );

    const ws = new WebSocket(`${baseUrl}/ws?sessionId=${sessionId}`);

    const message = await new Promise((resolve, reject) => {
      ws.on("message", (data) => {
        resolve(JSON.parse(data.toString()));
      });

      ws.on("error", reject);
    });

    expect(message).toEqual({
      type: "playback:state",
      position: 0,
      isPlaying: false,
      version: 0,
    });

    ws.close();
    server.close();
  });
});
