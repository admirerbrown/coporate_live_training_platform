import {
  applyPlaybackState,
  createInitialPlaybackState,
} from "../state/playbackState";

export function createSessionClient({ socketClient, authenticationClient }) {
  let playback = createInitialPlaybackState();
  let destroyed = false;

  let state = {
    connectionStatus: "disconnected",
    role: "participant",
    playback,
  };

  const stateListeners = new Set();

  function getState() {
    return state;
  }

  function notifyStateChange() {
    if (destroyed) {
      return;
    }

    for (const listener of stateListeners) {
      listener(state);
    }
  }

  function updateState(nextValues) {
    if (destroyed) {
      return;
    }

    state = {
      ...state,
      ...nextValues,
    };

    notifyStateChange();
  }

  const unsubscribeStatus = socketClient.onStatusChange((status) => {
    if (destroyed) {
      return;
    }

    updateState({
      connectionStatus: status,
      role: status === "disconnected" ? "participant" : state.role,
    });
  });

  const unsubscribeMessage = socketClient.onMessage((message) => {
    if (destroyed) {
      return;
    }

    const nextPlayback = applyPlaybackState(playback, message);

    if (nextPlayback === playback) {
      return;
    }

    playback = nextPlayback;

    updateState({
      playback,
    });
  });

  const unsubscribeRole = authenticationClient.onRoleChange((nextRole) => {
    if (destroyed || state.role === nextRole) {
      return;
    }

    updateState({
      role: nextRole,
    });
  });

  function connect() {
    if (destroyed) {
      return;
    }

    socketClient.connect();
  }

  function disconnect() {
    if (destroyed) {
      return;
    }

    socketClient.disconnect();
  }

  function authenticate(token) {
    if (destroyed) {
      return Promise.reject(new Error("Session client destroyed"));
    }

    return authenticationClient.authenticate(token);
  }

  function send(message) {
    if (destroyed) {
      return false;
    }

    return socketClient.send(message);
  }

  function onStateChange(listener) {
    if (destroyed) {
      return () => {};
    }

    stateListeners.add(listener);

    return () => {
      stateListeners.delete(listener);
    };
  }

  function destroy() {
    if (destroyed) {
      return;
    }

    destroyed = true;

    unsubscribeStatus();
    unsubscribeMessage();
    unsubscribeRole();

    stateListeners.clear();
  }

  return {
    connect,
    disconnect,
    authenticate,
    send,
    getState,
    onStateChange,
    destroy,
  };
}
