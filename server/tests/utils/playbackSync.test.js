import "dotenv/config";

import { describe, it, expect } from "vitest";

import {
  calculateEffectivePosition,
} from "../../src/utils/playbackSync";

describe("calculateEffectivePosition", () => {
  it("returns the exact position for a paused session", () => {
    const position = calculateEffectivePosition({
      position: 125,
      isPlaying: false,
      updatedAt: "2026-01-01T12:00:00.000Z",
      serverTime: "2026-01-01T12:10:00.000Z",
    });

    expect(position).toBe(125);
  });

  it("returns the exact position when a playing session has zero elapsed time", () => {
    const position = calculateEffectivePosition({
      position: 125,
      isPlaying: true,
      updatedAt: "2026-01-01T12:00:00.000Z",
      serverTime: "2026-01-01T12:00:00.000Z",
    });

    expect(position).toBe(125);
  });

  it("adds whole elapsed seconds to a playing position", () => {
    const position = calculateEffectivePosition({
      position: 125,
      isPlaying: true,
      updatedAt: "2026-01-01T12:00:00.000Z",
      serverTime: "2026-01-01T12:00:05.000Z",
    });

    expect(position).toBe(130);
  });

  it("preserves fractional elapsed seconds", () => {
    const position = calculateEffectivePosition({
      position: 125,
      isPlaying: true,
      updatedAt: "2026-01-01T12:00:00.000Z",
      serverTime: "2026-01-01T12:00:00.500Z",
    });

    expect(position).toBe(125.5);
  });

  it("clamps negative elapsed time to zero", () => {
    const position = calculateEffectivePosition({
      position: 125,
      isPlaying: true,
      updatedAt: "2026-01-01T12:00:05.000Z",
      serverTime: "2026-01-01T12:00:04.000Z",
    });

    expect(position).toBe(125);
  });

  it("handles large elapsed periods without an artificial cap", () => {
    const position = calculateEffectivePosition({
      position: 100,
      isPlaying: true,
      updatedAt: "2026-01-01T10:00:00.000Z",
      serverTime: "2026-01-01T12:00:00.000Z",
    });

    expect(position).toBe(7300);
  });

  it.each([
    {
      name: "missing updatedAt",
      updatedAt: undefined,
      serverTime: "2026-01-01T12:00:05.000Z",
    },
    {
      name: "missing serverTime",
      updatedAt: "2026-01-01T12:00:00.000Z",
      serverTime: undefined,
    },
    {
      name: "invalid updatedAt",
      updatedAt: "not-a-date",
      serverTime: "2026-01-01T12:00:05.000Z",
    },
    {
      name: "invalid serverTime",
      updatedAt: "2026-01-01T12:00:00.000Z",
      serverTime: "not-a-date",
    },
  ])(
    "falls back to the raw position for $name",
    ({ updatedAt, serverTime }) => {
      const position = calculateEffectivePosition({
        position: 125,
        isPlaying: true,
        updatedAt,
        serverTime,
      });

      expect(position).toBe(125);
    },
  );

  it("coerces a numeric string position before adding elapsed time", () => {
    const position = calculateEffectivePosition({
      position: "125",
      isPlaying: true,
      updatedAt: "2026-01-01T12:00:00.000Z",
      serverTime: "2026-01-01T12:00:05.000Z",
    });

    expect(position).toBe(130);
  });

  it("preserves the zero-position boundary", () => {
    const position = calculateEffectivePosition({
      position: 0,
      isPlaying: true,
      updatedAt: "2026-01-01T12:00:00.000Z",
      serverTime: "2026-01-01T12:00:00.000Z",
    });

    expect(position).toBe(0);
  });
});