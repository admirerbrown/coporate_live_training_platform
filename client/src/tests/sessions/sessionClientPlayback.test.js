import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  createSessionClient,
} from "../../session/sessionClient";

describe("sessionClient playback integration", () => {
  let socketClient;
  let authenticationClient;
  let notifyMessage;

  beforeEach(() => {
    notifyMessage = null;

    socketClient = {
      connect: vi.fn(),
      disconnect: vi.fn(),
      send: vi.fn(),

      onMessage: vi.fn((listener) => {
        notifyMessage = listener;

        return () => {
          notifyMessage = null;
        };
      }),

      onStatusChange: vi.fn(() => {
        return () => {};
      }),
    };

    authenticationClient = {
      authenticate: vi.fn(),

      onRoleChange: vi.fn(() => {
        return () => {};
      }),
    };
  });

  it("applies an incoming playback state and notifies subscribers", () => {
    const sessionClient = createSessionClient({
      socketClient,
      authenticationClient,
    });

    const listener = vi.fn();

    sessionClient.onStateChange(listener);

    notifyMessage({
      type: "playback:state",
      position: 125,
      isPlaying: true,
      version: 0,
      updatedAt:
        "2026-01-01T12:00:00.000Z",
      serverTime:
        "2026-01-01T12:00:05.000Z",
    });

    expect(listener).toHaveBeenCalledWith({
      connectionStatus: "disconnected",
      role: "participant",
      playback: {
        position: 125,
        isPlaying: true,
        version: 0,
        updatedAt:
          "2026-01-01T12:00:00.000Z",
        serverTime:
          "2026-01-01T12:00:05.000Z",
      },
    });

    sessionClient.destroy();
  });

  it("ignores an older playback message", () => {
    const sessionClient = createSessionClient({
      socketClient,
      authenticationClient,
    });

    const listener = vi.fn();

    sessionClient.onStateChange(listener);

    notifyMessage({
      type: "playback:state",
      position: 125,
      isPlaying: true,
      version: 2,
      updatedAt:
        "2026-01-01T12:00:00.000Z",
      serverTime:
        "2026-01-01T12:00:05.000Z",
    });

    listener.mockClear();

    notifyMessage({
      type: "playback:state",
      position: 50,
      isPlaying: false,
      version: 1,
      updatedAt:
        "2026-01-01T11:59:00.000Z",
      serverTime:
        "2026-01-01T11:59:05.000Z",
    });

    expect(listener).not.toHaveBeenCalled();

    expect(
      sessionClient.getState().playback,
    ).toEqual({
      position: 125,
      isPlaying: true,
      version: 2,
      updatedAt:
        "2026-01-01T12:00:00.000Z",
      serverTime:
        "2026-01-01T12:00:05.000Z",
    });

    sessionClient.destroy();
  });
});
