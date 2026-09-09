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

function createSocketClientMock() {
  const statusListeners = new Set();
  const messageListeners = new Set();

  return {
    connect: vi.fn(),

    disconnect: vi.fn(),

    send: vi.fn(() => true),

    getStatus: vi.fn(
      () => "disconnected",
    ),

    onStatusChange: vi.fn(
      (listener) => {
        statusListeners.add(listener);

        return () => {
          statusListeners.delete(
            listener,
          );
        };
      },
    ),

    onMessage: vi.fn(
      (listener) => {
        messageListeners.add(listener);

        return () => {
          messageListeners.delete(
            listener,
          );
        };
      },
    ),

    emitStatus(status) {
      for (const listener of statusListeners) {
        listener(status);
      }
    },

    emitMessage(message) {
      for (const listener of messageListeners) {
        listener(message);
      }
    },
  };
}

function createAuthenticationClientMock() {
  const roleListeners = new Set();

  return {
    authenticate: vi.fn(
      () =>
        Promise.resolve({
          ok: true,
        }),
    ),

    getRole: vi.fn(
      () => "participant",
    ),

    onRoleChange: vi.fn(
      (listener) => {
        roleListeners.add(listener);

        return () => {
          roleListeners.delete(
            listener,
          );
        };
      },
    ),

    emitRole(role) {
      for (const listener of roleListeners) {
        listener(role);
      }
    },
  };
}

describe(
  "Client session coordinator",
  () => {
    let socketClient;
    let authenticationClient;
    let sessionClient;

    beforeEach(() => {
      socketClient =
        createSocketClientMock();

      authenticationClient =
        createAuthenticationClientMock();

      sessionClient =
        createSessionClient({
          socketClient,
          authenticationClient,
        });
    });

    it(
      "starts disconnected as a participant with the initial playback state",
      () => {
        expect(
          sessionClient.getState(),
        ).toEqual({
          connectionStatus:
            "disconnected",

          role: "participant",

          playback: {
            position: 0,
            isPlaying: false,
            version: -1,
            updatedAt: null,
            serverTime: null,
          },
        });
      },
    );

    it(
      "delegates connect to the WebSocket client",
      () => {
        sessionClient.connect();

        expect(
          socketClient.connect,
        ).toHaveBeenCalledTimes(1);
      },
    );

    it(
      "updates connection status from WebSocket events",
      () => {
        sessionClient.connect();

        socketClient.emitStatus(
          "connecting",
        );

        expect(
          sessionClient.getState()
            .connectionStatus,
        ).toBe("connecting");

        socketClient.emitStatus(
          "connected",
        );

        expect(
          sessionClient.getState()
            .connectionStatus,
        ).toBe("connected");

        socketClient.emitStatus(
          "disconnected",
        );

        expect(
          sessionClient.getState()
            .connectionStatus,
        ).toBe("disconnected");
      },
    );

    it(
      "accepts a newer playback state through the playback adapter",
      () => {
        socketClient.emitMessage({
          type: "playback:state",
          position: 125,
          isPlaying: false,
          version: 1,
          updatedAt:
            "2026-01-01T12:00:00.000Z",
          serverTime:
            "2026-01-01T12:00:05.000Z",
        });

        expect(
          sessionClient.getState()
            .playback,
        ).toEqual({
          position: 125,
          isPlaying: false,
          version: 1,
          updatedAt:
            "2026-01-01T12:00:00.000Z",
          serverTime:
            "2026-01-01T12:00:05.000Z",
        });
      },
    );

    it(
      "accepts a newer equal-version playback state",
      () => {
        socketClient.emitMessage({
          type: "playback:state",
          position: 125,
          isPlaying: true,
          version: 1,
          updatedAt:
            "2026-01-01T12:00:00.000Z",
          serverTime:
            "2026-01-01T12:00:05.000Z",
        });

        const before =
          sessionClient.getState();

        socketClient.emitMessage({
          type: "playback:state",
          position: 125,
          isPlaying: true,
          version: 1,
          updatedAt:
            "2026-01-01T12:00:00.000Z",
          serverTime:
            "2026-01-01T12:00:10.000Z",
        });

        const after =
          sessionClient.getState();

        expect(after).not.toBe(before);

        expect(
          after.playback.version,
        ).toBe(1);

        expect(
          after.playback.isPlaying,
        ).toBe(true);

        expect(
          after.playback.serverTime,
        ).toBe(
          "2026-01-01T12:00:10.000Z",
        );
      },
    );

    it(
      "ignores an older playback state",
      () => {
        socketClient.emitMessage({
          type: "playback:state",
          position: 200,
          isPlaying: true,
          version: 2,
          updatedAt:
            "2026-01-01T12:00:00.000Z",
          serverTime:
            "2026-01-01T12:00:01.000Z",
        });

        const before =
          sessionClient.getState();

        socketClient.emitMessage({
          type: "playback:state",
          position: 50,
          isPlaying: false,
          version: 1,
          updatedAt:
            "2026-01-01T11:59:00.000Z",
          serverTime:
            "2026-01-01T11:59:01.000Z",
        });

        expect(
          sessionClient.getState(),
        ).toBe(before);
      },
    );

    it(
      "delegates instructor authentication",
      async () => {
        await sessionClient.authenticate(
          "test-instructor-token",
        );

        expect(
          authenticationClient
            .authenticate,
        ).toHaveBeenCalledWith(
          "test-instructor-token",
        );
      },
    );

    it(
      "updates the role when authentication succeeds",
      () => {
        authenticationClient.emitRole(
          "instructor",
        );

        expect(
          sessionClient.getState().role,
        ).toBe("instructor");
      },
    );

    it(
      "resets the effective role when the connection is lost",
      () => {
        authenticationClient.emitRole(
          "instructor",
        );

        expect(
          sessionClient.getState().role,
        ).toBe("instructor");

        socketClient.emitStatus(
          "disconnected",
        );

        expect(
          sessionClient.getState().role,
        ).toBe("participant");
      },
    );

    it(
      "delegates outbound messages to the WebSocket client",
      () => {
        const message = {
          type: "playback:play",
        };

        const result =
          sessionClient.send(
            message,
          );

        expect(
          socketClient.send,
        ).toHaveBeenCalledWith(
          message,
        );

        expect(result).toBe(true);
      },
    );

    it(
      "notifies state subscribers when session state changes",
      () => {
        const listener = vi.fn();

        sessionClient.onStateChange(
          listener,
        );

        socketClient.emitStatus(
          "connected",
        );

        expect(
          listener,
        ).toHaveBeenCalledWith(
          expect.objectContaining({
            connectionStatus:
              "connected",
          }),
        );
      },
    );

    it(
      "supports unsubscribing from state changes",
      () => {
        const listener = vi.fn();

        const unsubscribe =
          sessionClient.onStateChange(
            listener,
          );

        unsubscribe();

        socketClient.emitStatus(
          "connected",
        );

        expect(
          listener,
        ).not.toHaveBeenCalled();
      },
    );

    it(
      "disconnects the WebSocket client",
      () => {
        sessionClient.disconnect();

        expect(
          socketClient.disconnect,
        ).toHaveBeenCalledTimes(1);
      },
    );

    it(
      "does not expose authentication or transport internals through playback state",
      () => {
        const state =
          sessionClient.getState();

        expect(state).not.toHaveProperty(
          "socketClient",
        );

        expect(state).not.toHaveProperty(
          "authenticationClient",
        );
      },
    );

    it(
      "stops reacting to WebSocket status after destroy",
      () => {
        const listener = vi.fn();

        sessionClient.onStateChange(
          listener,
        );

        sessionClient.destroy();

        socketClient.emitStatus(
          "connected",
        );

        expect(
          listener,
        ).not.toHaveBeenCalled();

        expect(
          sessionClient.getState()
            .connectionStatus,
        ).toBe("disconnected");
      },
    );

    it(
      "stops reacting to playback messages after destroy",
      () => {
        sessionClient.destroy();

        socketClient.emitMessage({
          type: "playback:state",
          position: 125,
          isPlaying: false,
          version: 1,
          updatedAt:
            "2026-01-01T12:00:00.000Z",
          serverTime:
            "2026-01-01T12:00:00.000Z",
        });

        expect(
          sessionClient.getState()
            .playback,
        ).toEqual({
          position: 0,
          isPlaying: false,
          version: -1,
          updatedAt: null,
          serverTime: null,
        });
      },
    );

    it(
      "stops reacting to role changes after destroy",
      () => {
        const listener = vi.fn();

        sessionClient.onStateChange(
          listener,
        );

        sessionClient.destroy();

        authenticationClient.emitRole(
          "instructor",
        );

        expect(
          listener,
        ).not.toHaveBeenCalled();

        expect(
          sessionClient.getState().role,
        ).toBe("participant");
      },
    );

    it(
      "clears state subscribers when destroyed",
      () => {
        const listener = vi.fn();

        sessionClient.onStateChange(
          listener,
        );

        sessionClient.destroy();

        socketClient.emitStatus(
          "connected",
        );

        socketClient.emitMessage({
          type: "playback:state",
          position: 50,
          isPlaying: false,
          version: 1,
          updatedAt:
            "2026-01-01T12:00:00.000Z",
          serverTime:
            "2026-01-01T12:00:00.000Z",
        });

        authenticationClient.emitRole(
          "instructor",
        );

        expect(
          listener,
        ).not.toHaveBeenCalled();
      },
    );

    it(
      "is safe to destroy more than once",
      () => {
        expect(() => {
          sessionClient.destroy();
          sessionClient.destroy();
        }).not.toThrow();
      },
    );
  },
);
