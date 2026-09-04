import { describe, it, expect, vi,beforeEach, } from "vitest";

import { createWebSocketClient } from "../../websocket/client";

class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  static instances = [];

  constructor(url) {
    this.url = url;
    this.readyState = MockWebSocket.CONNECTING;
    this.send = vi.fn();
    this.close = vi.fn(() => {
      this.readyState = MockWebSocket.CLOSED;

      if (this.onclose) {
        this.onclose();
      }
    });

    MockWebSocket.instances.push(this);
  }

  open() {
    this.readyState = MockWebSocket.OPEN;

    if (this.onopen) {
      this.onopen();
    }
  }

  receive(data) {
    if (this.onmessage) {
      this.onmessage({ data });
    }
  }

  fail(error = new Error("WebSocket error")) {
    if (this.onerror) {
      this.onerror(error);
    }
  }

  closeFromServer() {
    this.readyState = MockWebSocket.CLOSED;

    if (this.onclose) {
      this.onclose();
    }
  }

  static reset() {
    MockWebSocket.instances = [];
  }
}

describe("WebSocket client", () => {
  beforeEach(() => {
    MockWebSocket.reset();
  });

  const createClient = () =>
    createWebSocketClient({
      baseUrl: "ws://localhost:4000",
      sessionId: "session-123",
      WebSocketImpl: MockWebSocket,
    });

  it("starts disconnected", () => {
    const client = createClient();

    expect(client.getStatus()).toBe("disconnected");
  });

  it("moves from connecting to connected when the socket opens", () => {
    const client = createClient();

    const statuses = [];

    client.onStatusChange((status) => {
      statuses.push(status);
    });

    client.connect();

    const socket = MockWebSocket.instances[0];

    expect(client.getStatus()).toBe("connecting");

    socket.open();

    expect(client.getStatus()).toBe("connected");

    expect(statuses).toEqual(["connecting", "connected"]);
  });

  it("creates the WebSocket with the session URL", () => {
    const client = createClient();

    client.connect();

    const socket = MockWebSocket.instances[0];

    expect(socket.url).toBe("ws://localhost:4000/ws?sessionId=session-123");
  });

  it("parses incoming JSON messages and forwards them to subscribers", () => {
    const client = createClient();

    const onMessage = vi.fn();

    client.onMessage(onMessage);

    client.connect();

    const socket = MockWebSocket.instances[0];

    socket.open();

    socket.receive(
      JSON.stringify({
        type: "playback:state",
        position: 125,
        isPlaying: true,
        version: 4,
      }),
    );

    expect(onMessage).toHaveBeenCalledWith({
      type: "playback:state",
      position: 125,
      isPlaying: true,
      version: 4,
    });
  });

  it("reports malformed incoming JSON without throwing", () => {
    const client = createClient();

    const onMessage = vi.fn();
    const onError = vi.fn();

    client.onMessage(onMessage);
    client.onError(onError);

    client.connect();

    const socket = MockWebSocket.instances[0];

    socket.open();

    expect(() => {
      socket.receive('{"type":"playback:state"');
    }).not.toThrow();

    expect(onMessage).not.toHaveBeenCalled();

    expect(onError).toHaveBeenCalledTimes(1);

    expect(client.getStatus()).toBe("connected");
  });

  it("serializes and sends a message when connected", () => {
    const client = createClient();

    client.connect();

    const socket = MockWebSocket.instances[0];

    socket.open();

    const sent = client.send({
      type: "playback:play",
    });

    expect(sent).toBe(true);

    expect(socket.send).toHaveBeenCalledWith(
      JSON.stringify({
        type: "playback:play",
      }),
    );
  });

  it("does not send when the socket is not open", () => {
    const client = createClient();

    client.connect();

    const socket = MockWebSocket.instances[0];

    const sent = client.send({
      type: "playback:play",
    });

    expect(sent).toBe(false);

    expect(socket.send).not.toHaveBeenCalled();
  });

  it("moves to disconnected when the server closes the connection", () => {
    const client = createClient();

    const statuses = [];

    client.onStatusChange((status) => {
      statuses.push(status);
    });

    client.connect();

    const socket = MockWebSocket.instances[0];

    socket.open();

    socket.closeFromServer();

    expect(client.getStatus()).toBe("disconnected");

    expect(statuses).toEqual(["connecting", "connected", "disconnected"]);
  });

  it("disconnects the active socket", () => {
    const client = createClient();

    client.connect();

    const socket = MockWebSocket.instances[0];

    socket.open();

    client.disconnect();

    expect(socket.close).toHaveBeenCalledTimes(1);

    expect(client.getStatus()).toBe("disconnected");
  });

  it("does not create a second socket when connect is called while connected", () => {
    const client = createClient();

    client.connect();

    const firstSocket = MockWebSocket.instances[0];

    firstSocket.open();

    client.connect();

    expect(MockWebSocket.instances).toHaveLength(1);
  });
});
