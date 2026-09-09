export function createWebSocketClient({
  baseUrl,
  sessionId,
  WebSocketImpl = WebSocket,
}) {
  let socket = null;
  let status = "disconnected";

  const statusListeners = new Set();
  const messageListeners = new Set();
  const errorListeners = new Set();

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
    };

    socket.onmessage = (event) => {
      try {
        const message =
          typeof event.data === "string"
            ? JSON.parse(event.data)
            : JSON.parse(
                String(event.data),
              );

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
  };
}
