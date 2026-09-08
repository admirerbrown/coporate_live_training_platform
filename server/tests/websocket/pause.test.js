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

import {
  calculateEffectivePosition,
} from "../../../shared/playbackSync";

describe("WebSocket playback controls", () => {
  let server;
  let wss;
  let ws;
  let baseUrl;

  beforeEach(async () => {
    await pool.query(
      "DELETE FROM session_participants",
    );

    await pool.query(
      "DELETE FROM session_playback_state",
    );

    await pool.query(
      "DELETE FROM training_sessions",
    );

    server = http.createServer(app);

    wss = attachWebSocketServer(
      server,
      pool,
    );

    await new Promise((resolve) => {
      server.listen(0, resolve);
    });

    const { port } = server.address();

    baseUrl = `ws://localhost:${port}`;
  });

  afterEach(async () => {
    if (
      ws &&
      (
        ws.readyState === WebSocket.OPEN ||
        ws.readyState === WebSocket.CONNECTING
      )
    ) {
      ws.terminate();
    }

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

  it(
    "freezes playback at the current effective position when instructor pauses",
    async () => {
      const sessionResult =
        await pool.query(
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
            "Pause Test Session",
            "https://www.youtube.com/watch?v=test123",
            "test-instructor-token",
          ],
        );

      const sessionId =
        sessionResult.rows[0].id;

      const startedAt = new Date(
        Date.now() - 10_000,
      );

      await pool.query(
        `
          INSERT INTO session_playback_state (
            session_id,
            position,
            is_playing,
            version,
            updated_at
          )
          VALUES ($1, $2, $3, $4, $5)
        `,
        [
          sessionId,
          25,
          true,
          1,
          startedAt,
        ],
      );

      ws = new WebSocket(
        `${baseUrl}/ws?sessionId=${sessionId}`,
      );

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

      const authMessage =
        await new Promise((resolve, reject) => {
          ws.once("message", (data) => {
            resolve(
              JSON.parse(data.toString()),
            );
          });

          ws.once("error", reject);
        });

      expect(authMessage).toEqual({
        type: "auth:success",
      });

      const pauseSentAt = new Date();

      ws.send(
        JSON.stringify({
          type: "playback:pause",
        }),
      );

      const message =
        await new Promise((resolve, reject) => {
          ws.once("message", (data) => {
            resolve(
              JSON.parse(data.toString()),
            );
          });

          ws.once("error", reject);
        });

      const expectedPosition =
        calculateEffectivePosition({
          position: 25,
          isPlaying: true,
          updatedAt:
            startedAt.toISOString(),
          serverTime:
            pauseSentAt.toISOString(),
        });

      expect(message).toMatchObject({
        type: "playback:state",
        isPlaying: false,
        version: 2,
      });

      expect(
        message.position,
      ).toBeGreaterThanOrEqual(
        expectedPosition,
      );

      expect(
        message.position,
      ).toBeLessThanOrEqual(
        expectedPosition + 1,
      );

      expect(message.updatedAt).toBeTruthy();
      expect(message.serverTime).toBeTruthy();

      expect(
        Number.isNaN(
          Date.parse(message.updatedAt),
        ),
      ).toBe(false);

      expect(
        Number.isNaN(
          Date.parse(message.serverTime),
        ),
      ).toBe(false);

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
        position: String(message.position),
        is_playing: false,
        version: 2,
      });
    },
  );
});
