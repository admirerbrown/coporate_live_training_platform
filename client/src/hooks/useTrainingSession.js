import { useEffect, useRef, useState } from "react";

import { createWebSocketClient } from "../websocket/client";
import {
  createAuthenticationClient,
} from "../websocket/authentication";
import {
  createSessionClient,
} from "../session/sessionClient";

export function useTrainingSession({
  sessionId,
  instructorToken,
  websocketBaseUrl,
}) {
  const sessionClientRef = useRef(null);
  const previousConnectionStatusRef =
    useRef("disconnected");

  const [state, setState] = useState({
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

  useEffect(() => {
    const socketClient = createWebSocketClient({
      baseUrl: websocketBaseUrl,
      sessionId,
    });

    const authenticationClient =
      createAuthenticationClient({
        socketClient,
      });

    const sessionClient = createSessionClient({
      socketClient,
      authenticationClient,
    });

    sessionClientRef.current = sessionClient;


    const unsubscribe =
      sessionClient.onStateChange((nextState) => {
        setState(nextState);
      });

    sessionClient.connect();

    return () => {
      unsubscribe();
      sessionClient.destroy();

      sessionClientRef.current = null;
      previousConnectionStatusRef.current =
        "disconnected";
    };
  }, [
    sessionId,
    websocketBaseUrl,
  ]);

  useEffect(() => {
    const sessionClient = sessionClientRef.current;

    if (
      !sessionClient ||
      !instructorToken ||
      state.connectionStatus !== "connected"
    ) {
      previousConnectionStatusRef.current =
        state.connectionStatus;

      return;
    }

    const wasConnected =
      previousConnectionStatusRef.current ===
      "connected";

    const shouldAuthenticate =
      !wasConnected;

    previousConnectionStatusRef.current =
      state.connectionStatus;

    if (!shouldAuthenticate) {
      return;
    }

    sessionClient
      .authenticate(instructorToken)
      .catch(() => {
        // Authentication failures are represented
        // by the session client's role/state.
        // Prevent a rejected authentication promise
        // from becoming an unhandled rejection.
      });
  }, [
    state.connectionStatus,
    instructorToken,
  ]);

  function send(message) {
    return sessionClientRef.current
      ? sessionClientRef.current.send(message)
      : false;
  }

  function disconnect() {
    sessionClientRef.current?.disconnect();
  }

  function connect() {
    sessionClientRef.current?.connect();
  }

  return {
    ...state,
    connect,
    disconnect,
    send,
  };
}
