export function createWebSocketClient({
  baseUrl,
  sessionId,
  WebSocketImpl = WebSocket,
}) {
  const CLOCK_SYNC_INTERVAL_MS = 30000;

  let socket = null;
  let status = "disconnected";
  let clockOffsetMs = 0;
  let bestClockRttMs = Number.POSITIVE_INFINITY;
  let clockSyncIntervalId = null;

  const statusListeners = new Set();
  const messageListeners = new Set();
  const errorListeners = new Set();
  const clockOffsetListeners = new Set();

  function setStatus(nextStatus) {
    if (status === nextStatus) {
      return;
    }

    status = nextStatus;

    for (const listener of statusListeners) {
      listener(status);
    }
  }

  function buildUrl() {
    const normalizedBaseUrl =
      baseUrl.replace(/\/+$/, "");

    return `${normalizedBaseUrl}/ws?sessionId=${encodeURIComponent(
      sessionId,
    )}`;
  }

  function notifyClockOffsetChange() {
    for (const listener of clockOffsetListeners) {
      listener(clockOffsetMs);
    }
  }

  function synchronizeClock() {
    if (!socket || socket.readyState !== WebSocketImpl.OPEN) {
      return;
    }

    send({
      type: "clock:sync",
      t0: Date.now(),
    });
  }

  function handleClockSync(message) {
    const t2 = Date.now();
    const t0 = Number(message.t0);
    const serverTime = Number(message.serverTime);

    if (
      !Number.isFinite(t0) ||
      !Number.isFinite(serverTime) ||
      t2 < t0
    ) {
      return;
    }

    const rttMs = t2 - t0;

    if (rttMs >= bestClockRttMs) {
      return;
    }

    bestClockRttMs = rttMs;
    clockOffsetMs =
      serverTime - (t0 + rttMs / 2);

    notifyClockOffsetChange();
  }

  function stopClockSynchronization() {
    if (clockSyncIntervalId !== null) {
      clearInterval(clockSyncIntervalId);
      clockSyncIntervalId = null;
    }
  }

  function connect() {
    if (
      socket &&
      (
        socket.readyState ===
          WebSocketImpl.CONNECTING ||
        socket.readyState ===
          WebSocketImpl.OPEN
      )
    ) {
      return;
    }

    setStatus("connecting");

    const url = buildUrl();

    socket = new WebSocketImpl(url);

    socket.onopen = () => {
      setStatus("connected");

      bestClockRttMs = Number.POSITIVE_INFINITY;
      synchronizeClock();
      stopClockSynchronization();
      clockSyncIntervalId = setInterval(
        synchronizeClock,
        CLOCK_SYNC_INTERVAL_MS,
      );
    };

    socket.onmessage = (event) => {
      try {
        const message =
          typeof event.data === "string"
            ? JSON.parse(event.data)
            : JSON.parse(
                String(event.data),
              );

        if (message.type === "clock:sync") {
          handleClockSync(message);
        }

        for (const listener of messageListeners) {
          listener(message);
        }
      } catch (error) {
        for (const listener of errorListeners) {
          listener(error);
        }
      }
    };

    socket.onerror = (error) => {
      for (const listener of errorListeners) {
        listener(error);
      }

      setStatus("disconnected");
    };

    socket.onclose = () => {
      stopClockSynchronization();
      socket = null;
      setStatus("disconnected");
    };
  }

  function send(message) {
    if (
      !socket ||
      socket.readyState !==
        WebSocketImpl.OPEN
    ) {
      return false;
    }

    try {
      socket.send(
        JSON.stringify(message),
      );

      return true;
    } catch (error) {
      console.error(
        "[WebSocket] send error:",
        error,
      );

      for (const listener of errorListeners) {
        listener(error);
      }

      return false;
    }
  }

  function disconnect() {
    if (!socket) {
      setStatus("disconnected");
      return;
    }

    const currentSocket = socket;

    socket = null;
    stopClockSynchronization();

    if (
      currentSocket.readyState ===
        WebSocketImpl.OPEN ||
      currentSocket.readyState ===
        WebSocketImpl.CONNECTING
    ) {
      currentSocket.close();
    }

    setStatus("disconnected");
  }

  function onStatusChange(listener) {
    statusListeners.add(listener);

    return () => {
      statusListeners.delete(listener);
    };
  }

  function onMessage(listener) {
    messageListeners.add(listener);

    return () => {
      messageListeners.delete(listener);
    };
  }

  function onError(listener) {
    errorListeners.add(listener);

    return () => {
      errorListeners.delete(listener);
    };
  }

  function onClockOffsetChange(listener) {
    clockOffsetListeners.add(listener);

    return () => {
      clockOffsetListeners.delete(listener);
    };
  }

  function getClockOffset() {
    return clockOffsetMs;
  }

  function getStatus() {
    return status;
  }

  return {
    connect,
    disconnect,
    send,
    getStatus,
    onStatusChange,
    onMessage,
    onError,
    onClockOffsetChange,
    getClockOffset,
  };
}
