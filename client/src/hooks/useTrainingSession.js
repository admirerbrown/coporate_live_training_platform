import { useEffect, useRef, useState } from "react";

import { createWebSocketClient } from "../websocket/client";

import { createAuthenticationClient } from "../websocket/authentication";

import { createSessionClient } from "../session/sessionClient";

export function useTrainingSession({
  sessionId,
  instructorToken,
  websocketBaseUrl,
}) {
  const sessionClientRef = useRef(null);

  const previousConnectionStatusRef = useRef("disconnected");

  const connectionStatusRef = useRef("disconnected");

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

    const authenticationClient = createAuthenticationClient({
      socketClient,
    });

    const sessionClient = createSessionClient({
      socketClient,
      authenticationClient,
    });

    sessionClientRef.current = sessionClient;

    const unsubscribe = sessionClient.onStateChange((nextState) => {
      connectionStatusRef.current = nextState.connectionStatus;

      setState(nextState);
    });

    sessionClient.connect();

    return () => {
      unsubscribe();

      sessionClient.destroy();

      sessionClientRef.current = null;

      connectionStatusRef.current = "disconnected";

      previousConnectionStatusRef.current = "disconnected";
    };
  }, [sessionId, websocketBaseUrl]);

  useEffect(() => {
    const sessionClient = sessionClientRef.current;

    if (!sessionClient || state.connectionStatus !== "connected") {
      previousConnectionStatusRef.current = state.connectionStatus;

      return;
    }

    sessionClient.send({
      type: "playback:request-state",
    });

    if (!instructorToken) {
      previousConnectionStatusRef.current = state.connectionStatus;

      return;
    }

    const wasConnected = previousConnectionStatusRef.current === "connected";

    const shouldAuthenticate = !wasConnected;

    previousConnectionStatusRef.current = state.connectionStatus;

    if (!shouldAuthenticate) {
      return;
    }

    sessionClient.authenticate(instructorToken).catch(() => {
      /*
       * Authentication failures are represented
       * by the session client's role/state.
       *
       * Prevent a rejected authentication promise
       * from becoming an unhandled rejection.
       */
    });
  }, [state.connectionStatus, instructorToken]);

  function send(message) {
    return sessionClientRef.current
      ? sessionClientRef.current.send(message)
      : false;
  }

  function requestPlaybackState() {
    return send({
      type: "playback:request-state",
    });
  }

  function requestPlaybackResync() {
    return send({
      type: "playback:resync",
    });
  }

  function disconnect() {
    sessionClientRef.current?.disconnect();
  }

  function connect() {
    sessionClientRef.current?.connect();
  }

  /*
   * When a tab becomes visible again,
   * request a fresh read-only playback snapshot.
   *
   * This does NOT trigger pause/play.
   */
  useEffect(() => {
    function handleVisibilityChange() {
      if (document.visibilityState !== "visible") {
        return;
      }

      sessionClientRef.current?.send({
        type: "playback:request-state",
      });
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  return {
    ...state,
    connect,
    disconnect,
    send,
    requestPlaybackState,
    requestPlaybackResync,
  };
}
