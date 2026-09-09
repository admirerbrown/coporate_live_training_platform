import { describe, it, expect } from "vitest";

import {
  applyPlaybackState,
  createInitialPlaybackState,
} from "../../state/playbackState";

import { calculateEffectivePosition } from "../../../../shared/playbackSync";

describe("playback state adapter", () => {
  it("accepts the initial playback state", () => {
    const currentState = createInitialPlaybackState();

    const message = {
      type: "playback:state",
      position: 125,
      isPlaying: true,
      version: 0,
      updatedAt: "2026-01-01T12:00:00.000Z",
      serverTime: "2026-01-01T12:00:05.000Z",
    };

    const nextState = applyPlaybackState(currentState, message);

    expect(nextState).toEqual({
      position: 130,
      isPlaying: true,
      version: 0,
      updatedAt: "2026-01-01T12:00:00.000Z",
      serverTime: "2026-01-01T12:00:05.000Z",
    });
  });

  it("replaces the current state when the incoming version is newer", () => {
    const currentState = {
      position: 100,
      isPlaying: false,
      version: 3,
      updatedAt: "2026-01-01T12:00:00.000Z",
      serverTime: "2026-01-01T12:00:00.000Z",
    };

    const message = {
      type: "playback:state",
      position: 125,
      isPlaying: true,
      version: 4,
      updatedAt: "2026-01-01T12:01:00.000Z",
      serverTime: "2026-01-01T12:01:02.000Z",
    };

    const nextState = applyPlaybackState(currentState, message);

    expect(nextState.version).toBe(4);
    expect(nextState.isPlaying).toBe(true);
    expect(nextState.updatedAt).toBe(message.updatedAt);
  });

  it("ignores a message with the same version and older server time", () => {
    const currentState = {
      position: 100,
      isPlaying: false,
      version: 4,
      updatedAt: "2026-01-01T12:00:00.000Z",
      serverTime: "2026-01-01T12:00:05.000Z",
    };

    const message = {
      type: "playback:state",
      position: 200,
      isPlaying: true,
      version: 4,
      updatedAt: "2026-01-01T12:01:00.000Z",
      serverTime: "2026-01-01T12:00:04.000Z",
    };

    const nextState = applyPlaybackState(currentState, message);

    expect(nextState).toBe(currentState);
  });
  it("ignores a message with an older version", () => {
    const currentState = {
      position: 200,
      isPlaying: true,
      version: 5,
      updatedAt: "2026-01-01T12:01:00.000Z",
      serverTime: "2026-01-01T12:01:05.000Z",
    };

    const message = {
      type: "playback:state",
      position: 100,
      isPlaying: false,
      version: 4,
      updatedAt: "2026-01-01T12:00:00.000Z",
      serverTime: "2026-01-01T12:00:01.000Z",
    };

    const nextState = applyPlaybackState(currentState, message);

    expect(nextState).toBe(currentState);
  });

  it("uses calculateEffectivePosition for a playing state", () => {
    const currentState = createInitialPlaybackState();

    const message = {
      type: "playback:state",
      position: 125,
      isPlaying: true,
      version: 1,
      updatedAt: "2026-01-01T12:00:00.000Z",
      serverTime: "2026-01-01T12:00:05.500Z",
    };

    const nextState = applyPlaybackState(currentState, message);

    const expectedPosition = calculateEffectivePosition(message);

    expect(nextState.position).toBe(expectedPosition);
  });

  it("preserves the exact position for a paused state", () => {
    const currentState = createInitialPlaybackState();

    const message = {
      type: "playback:state",
      position: 125,
      isPlaying: false,
      version: 1,
      updatedAt: "2026-01-01T12:00:00.000Z",
      serverTime: "2026-01-01T13:00:00.000Z",
    };

    const nextState = applyPlaybackState(currentState, message);

    expect(nextState.position).toBe(125);
  });

  it.each([null, undefined, [], "playback:state", 42])(
    "ignores malformed message %j without throwing",
    (message) => {
      const currentState = createInitialPlaybackState();

      expect(() => {
        applyPlaybackState(currentState, message);
      }).not.toThrow();

      expect(applyPlaybackState(currentState, message)).toBe(currentState);
    },
  );

  it.each([
    {
      type: "wrong:type",
      position: 100,
      isPlaying: false,
      version: 1,
      updatedAt: "2026-01-01T12:00:00.000Z",
      serverTime: "2026-01-01T12:00:00.000Z",
    },
    {
      type: "playback:state",
      position: "100",
      isPlaying: false,
      version: 1,
      updatedAt: "2026-01-01T12:00:00.000Z",
      serverTime: "2026-01-01T12:00:00.000Z",
    },
    {
      type: "playback:state",
      position: 100,
      isPlaying: "false",
      version: 1,
      updatedAt: "2026-01-01T12:00:00.000Z",
      serverTime: "2026-01-01T12:00:00.000Z",
    },
    {
      type: "playback:state",
      position: 100,
      isPlaying: false,
      version: "1",
      updatedAt: "2026-01-01T12:00:00.000Z",
      serverTime: "2026-01-01T12:00:00.000Z",
    },
  ])("ignores a message with an invalid playback shape", (message) => {
    const currentState = createInitialPlaybackState();

    const nextState = applyPlaybackState(currentState, message);

    expect(nextState).toBe(currentState);
  });
  it("accepts a newer playback snapshot with the same version", () => {
    const currentState = {
      position: 100,
      isPlaying: true,
      version: 4,
      updatedAt: "2026-01-01T12:00:00.000Z",
      serverTime: "2026-01-01T12:00:05.000Z",
    };

    const message = {
      type: "playback:state",
      position: 100,
      isPlaying: true,
      version: 4,
      updatedAt: "2026-01-01T12:00:00.000Z",
      serverTime: "2026-01-01T12:00:15.000Z",
    };

    const nextState = applyPlaybackState(currentState, message);

    expect(nextState).not.toBe(currentState);

    expect(nextState.version).toBe(4);
    expect(nextState.isPlaying).toBe(true);
    expect(nextState.serverTime).toBe(message.serverTime);
  });
});
