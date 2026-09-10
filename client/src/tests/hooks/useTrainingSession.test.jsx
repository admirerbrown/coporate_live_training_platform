import {
  act,
  cleanup,
  renderHook,
  waitFor,
} from "@testing-library/react";

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { useTrainingSession } from "../../hooks/useTrainingSession";

import { createWebSocketClient } from "../../websocket/client";
import {
  createAuthenticationClient,
} from "../../websocket/authentication";
import {
  createSessionClient,
} from "../../session/sessionClient";

vi.mock("../../websocket/client", () => ({
  createWebSocketClient: vi.fn(),
}));

vi.mock("../../websocket/authentication", () => ({
  createAuthenticationClient: vi.fn(),
}));

vi.mock("../../session/sessionClient", () => ({
  createSessionClient: vi.fn(),
}));

describe("useTrainingSession", () => {
  let socketClient;
  let authenticationClient;
  let sessionClient;

  const initialState = {
    connectionStatus: "disconnected",
    role: "participant",
    playback: {
      position: 0,
      isPlaying: false,
      version: -1,
      updatedAt: null,
      serverTime: null,
    },
  };

  beforeEach(() => {
    vi.resetAllMocks();

    socketClient = {
      connect: vi.fn(),
      disconnect: vi.fn(),
      send: vi.fn(() => true),
    };

    authenticationClient = {
      authenticate: vi.fn(() =>
        Promise.resolve({ ok: true }),
      ),
    };

    sessionClient = {
      connect: vi.fn(),
      disconnect: vi.fn(),
      authenticate: vi.fn(() =>
        Promise.resolve({ ok: true }),
      ),
      send: vi.fn(() => true),
      getState: vi.fn(() => initialState),
      onStateChange: vi.fn(() => () => {}),
      destroy: vi.fn(),
    };

    createWebSocketClient.mockReturnValue(socketClient);

    createAuthenticationClient.mockReturnValue(
      authenticationClient,
    );

    createSessionClient.mockReturnValue(
      sessionClient,
    );
  });

  afterEach(() => {
    cleanup();
  });

  it("creates the session client for the requested session", () => {
    renderHook(() =>
      useTrainingSession({
        sessionId: "session-123",
        instructorToken: null,
        websocketBaseUrl: "ws://localhost:4000",
      }),
    );

    expect(createWebSocketClient).toHaveBeenCalledWith({
      baseUrl: "ws://localhost:4000",
      sessionId: "session-123",
    });

    expect(
      createAuthenticationClient,
    ).toHaveBeenCalledWith({
      socketClient,
    });

    expect(
      createSessionClient,
    ).toHaveBeenCalledWith({
      socketClient,
      authenticationClient,
    });
  });

  it("connects the session client when mounted", () => {
    renderHook(() =>
      useTrainingSession({
        sessionId: "session-123",
        instructorToken: null,
        websocketBaseUrl: "ws://localhost:4000",
      }),
    );

    expect(
      sessionClient.connect,
    ).toHaveBeenCalledTimes(1);
  });

  it("returns the current session state", () => {
    const { result } = renderHook(() =>
      useTrainingSession({
        sessionId: "session-123",
        instructorToken: null,
        websocketBaseUrl: "ws://localhost:4000",
      }),
    );

    expect(result.current).toMatchObject({
      connectionStatus: "disconnected",
      role: "participant",
      playback: {
        position: 0,
        isPlaying: false,
        version: -1,
        updatedAt: null,
        serverTime: null,
      },
    });
  });

  it("updates when the session client state changes", async () => {
    let stateListener;

    sessionClient.onStateChange.mockImplementation(
      (listener) => {
        stateListener = listener;

        return () => {};
      },
    );

    const { result } = renderHook(() =>
      useTrainingSession({
        sessionId: "session-123",
        instructorToken: null,
        websocketBaseUrl: "ws://localhost:4000",
      }),
    );

    const nextState = {
      connectionStatus: "connected",
      role: "participant",
      playback: {
        position: 25,
        isPlaying: true,
        version: 1,
        updatedAt: "2026-01-01T12:00:00.000Z",
        serverTime: "2026-01-01T12:00:01.000Z",
      },
    };

    act(() => {
      stateListener(nextState);
    });

    await waitFor(() => {
      expect(result.current).toMatchObject(
        nextState,
      );
    });
  });

  it("requests a private playback snapshot after connecting", () => {
    let stateListener;

    sessionClient.onStateChange.mockImplementation(
      (listener) => {
        stateListener = listener;

        return () => {};
      },
    );

    renderHook(() =>
      useTrainingSession({
        sessionId: "session-123",
        instructorToken: null,
        websocketBaseUrl: "ws://localhost:4000",
      }),
    );

    act(() => {
      stateListener({
        connectionStatus: "connected",
        role: "participant",
        playback: initialState.playback,
      });
    });

    expect(sessionClient.send).toHaveBeenCalledWith({
      type: "playback:request-state",
    });
  });

  it("authenticates an instructor after the WebSocket connects", async () => {
    let stateListener;

    sessionClient.onStateChange.mockImplementation(
      (listener) => {
        stateListener = listener;

        return () => {};
      },
    );

    renderHook(() =>
      useTrainingSession({
        sessionId: "session-123",
        instructorToken: "secret-token",
        websocketBaseUrl: "ws://localhost:4000",
      }),
    );

    expect(
      sessionClient.authenticate,
    ).not.toHaveBeenCalled();

    act(() => {
      stateListener({
        connectionStatus: "connected",
        role: "participant",
        playback: initialState.playback,
      });
    });

    await waitFor(() => {
      expect(
        sessionClient.authenticate,
      ).toHaveBeenCalledWith("secret-token");
    });
  });

  it("does not authenticate participants", async () => {
    let stateListener;

    sessionClient.onStateChange.mockImplementation(
      (listener) => {
        stateListener = listener;

        return () => {};
      },
    );

    renderHook(() =>
      useTrainingSession({
        sessionId: "session-123",
        instructorToken: null,
        websocketBaseUrl: "ws://localhost:4000",
      }),
    );

    act(() => {
      stateListener({
        connectionStatus: "connected",
        role: "participant",
        playback: initialState.playback,
      });
    });

    await waitFor(() => {
      expect(
        sessionClient.authenticate,
      ).not.toHaveBeenCalled();
    });
  });

  it("authenticates again after a reconnect", async () => {
    let stateListener;

    sessionClient.onStateChange.mockImplementation(
      (listener) => {
        stateListener = listener;

        return () => {};
      },
    );

    renderHook(() =>
      useTrainingSession({
        sessionId: "session-123",
        instructorToken: "secret-token",
        websocketBaseUrl: "ws://localhost:4000",
      }),
    );

    act(() => {
      stateListener({
        connectionStatus: "connected",
        role: "participant",
        playback: initialState.playback,
      });
    });

    await waitFor(() => {
      expect(
        sessionClient.authenticate,
      ).toHaveBeenCalledTimes(1);
    });

    act(() => {
      stateListener({
        connectionStatus: "disconnected",
        role: "participant",
        playback: initialState.playback,
      });
    });

    act(() => {
      stateListener({
        connectionStatus: "connected",
        role: "participant",
        playback: initialState.playback,
      });
    });

    await waitFor(() => {
      expect(
        sessionClient.authenticate,
      ).toHaveBeenCalledTimes(2);
    });
  });

  it("does not authenticate twice for duplicate connected states", async () => {
    let stateListener;

    sessionClient.onStateChange.mockImplementation(
      (listener) => {
        stateListener = listener;

        return () => {};
      },
    );

    renderHook(() =>
      useTrainingSession({
        sessionId: "session-123",
        instructorToken: "secret-token",
        websocketBaseUrl: "ws://localhost:4000",
      }),
    );

    const connectedState = {
      connectionStatus: "connected",
      role: "participant",
      playback: initialState.playback,
    };

    act(() => {
      stateListener(connectedState);
    });

    await waitFor(() => {
      expect(
        sessionClient.authenticate,
      ).toHaveBeenCalledTimes(1);
    });

    act(() => {
      stateListener(connectedState);
    });

    await waitFor(() => {
      expect(
        sessionClient.authenticate,
      ).toHaveBeenCalledTimes(1);
    });
  });

  it("handles failed authentication without throwing", async () => {
    let stateListener;

    sessionClient.authenticate.mockRejectedValue(
      new Error("Authentication failed"),
    );

    sessionClient.onStateChange.mockImplementation(
      (listener) => {
        stateListener = listener;

        return () => {};
      },
    );

    const { result } = renderHook(() =>
      useTrainingSession({
        sessionId: "session-123",
        instructorToken: "secret-token",
        websocketBaseUrl: "ws://localhost:4000",
      }),
    );

    act(() => {
      stateListener({
        connectionStatus: "connected",
        role: "participant",
        playback: initialState.playback,
      });
    });

    await waitFor(() => {
      expect(
        sessionClient.authenticate,
      ).toHaveBeenCalledWith("secret-token");
    });

    expect(result.current).toMatchObject({
      connectionStatus: "connected",
      role: "participant",
    });
  });

  it("does not resync automatically when a participant connects", () => {
    vi.useFakeTimers();

    let stateListener;

    sessionClient.onStateChange.mockImplementation(
      (listener) => {
        stateListener = listener;

        return () => {};
      },
    );

    const { unmount } = renderHook(() =>
      useTrainingSession({
        sessionId: "session-123",
        instructorToken: null,
        websocketBaseUrl: "ws://localhost:4000",
      }),
    );

    act(() => {
      stateListener({
        connectionStatus: "connected",
        role: "participant",
        playback: initialState.playback,
      });
    });

    act(() => {
      vi.advanceTimersByTime(6000);
    });

    expect(sessionClient.send).toHaveBeenCalledTimes(1);
    expect(sessionClient.send).not.toHaveBeenCalledWith({
      type: "playback:resync",
    });

    unmount();

    vi.useRealTimers();
  });

  it("exposes session commands", () => {
    const { result } = renderHook(() =>
      useTrainingSession({
        sessionId: "session-123",
        instructorToken: null,
        websocketBaseUrl: "ws://localhost:4000",
      }),
    );

    result.current.send({
      type: "playback:play",
    });

    result.current.disconnect();

    expect(
      sessionClient.send,
    ).toHaveBeenCalledWith({
      type: "playback:play",
    });

    expect(
      sessionClient.disconnect,
    ).toHaveBeenCalledTimes(1);
  });

  it("destroys the session client on unmount", () => {
    const { unmount } = renderHook(() =>
      useTrainingSession({
        sessionId: "session-123",
        instructorToken: null,
        websocketBaseUrl: "ws://localhost:4000",
      }),
    );

    unmount();

    expect(
      sessionClient.destroy,
    ).toHaveBeenCalledTimes(1);
  });

  it("cleans up the session state subscription on unmount", () => {
    const unsubscribe = vi.fn();

    sessionClient.onStateChange.mockReturnValue(
      unsubscribe,
    );

    const { unmount } = renderHook(() =>
      useTrainingSession({
        sessionId: "session-123",
        instructorToken: null,
        websocketBaseUrl: "ws://localhost:4000",
      }),
    );

    unmount();

    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });
});

