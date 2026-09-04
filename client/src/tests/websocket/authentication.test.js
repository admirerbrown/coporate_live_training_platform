import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  createAuthenticationClient,
} from "../../websocket/authentication";

function createSocketClientMock() {
  const messageListeners = new Set();
  const statusListeners = new Set();

  return {
    send: vi.fn(() => true),

    onMessage: vi.fn((listener) => {
      messageListeners.add(listener);

      return () => {
        messageListeners.delete(listener);
      };
    }),

    onStatusChange: vi.fn((listener) => {
      statusListeners.add(listener);

      return () => {
        statusListeners.delete(listener);
      };
    }),

    emitMessage(message) {
      for (const listener of messageListeners) {
        listener(message);
      }
    },

    emitStatus(status) {
      for (const listener of statusListeners) {
        listener(status);
      }
    },

    setSendResult(result) {
      this.send.mockReturnValue(result);
    },
  };
}

describe("WebSocket authentication", () => {
  let socketClient;
  let authClient;

  beforeEach(() => {
    socketClient = createSocketClientMock();

    authClient = createAuthenticationClient({
      socketClient,
    });
  });

  it("starts as a participant", () => {
    expect(authClient.getRole()).toBe("participant");
  });

  it("sends the instructor authentication message", async () => {
    const authentication = authClient.authenticate(
      "test-instructor-token",
    );

    expect(socketClient.send).toHaveBeenCalledWith({
      type: "auth",
      token: "test-instructor-token",
    });

    socketClient.emitMessage({
      type: "auth:success",
    });

    await expect(authentication).resolves.toEqual({
      ok: true,
    });
  });

  it("becomes an instructor after auth:success", async () => {
    const authentication = authClient.authenticate(
      "test-instructor-token",
    );

    socketClient.emitMessage({
      type: "auth:success",
    });

    const result = await authentication;

    expect(result).toEqual({
      ok: true,
    });

    expect(authClient.getRole()).toBe("instructor");
  });

  it("remains a participant after auth:error", async () => {
    const authentication = authClient.authenticate(
      "wrong-instructor-token",
    );

    socketClient.emitMessage({
      type: "auth:error",
      code: "INVALID_TOKEN",
    });

    const result = await authentication;

    expect(result).toEqual({
      ok: false,
      code: "INVALID_TOKEN",
    });

    expect(authClient.getRole()).toBe("participant");
  });

  it("preserves the server authentication error code", async () => {
    const authentication = authClient.authenticate(
      "wrong-token",
    );

    socketClient.emitMessage({
      type: "auth:error",
      code: "INVALID_TOKEN",
    });

    await expect(authentication).resolves.toEqual({
      ok: false,
      code: "INVALID_TOKEN",
    });
  });

  it("ignores unrelated WebSocket messages", async () => {
    const authentication = authClient.authenticate(
      "test-instructor-token",
    );

    socketClient.emitMessage({
      type: "playback:state",
      position: 50,
      isPlaying: true,
      version: 2,
    });

    expect(authClient.getRole()).toBe("participant");

    socketClient.emitMessage({
      type: "auth:success",
    });

    await expect(authentication).resolves.toEqual({
      ok: true,
    });

    expect(authClient.getRole()).toBe("instructor");
  });

  it("rejects when the authentication message cannot be sent", async () => {
    socketClient.setSendResult(false);

    await expect(
      authClient.authenticate("test-instructor-token"),
    ).rejects.toThrow("WebSocket is not connected");

    expect(authClient.getRole()).toBe("participant");
  });

  it("notifies role subscribers when authentication succeeds", async () => {
    const onRoleChange = vi.fn();

    authClient.onRoleChange(onRoleChange);

    const authentication = authClient.authenticate(
      "test-instructor-token",
    );

    socketClient.emitMessage({
      type: "auth:success",
    });

    await authentication;

    expect(onRoleChange).toHaveBeenCalledWith(
      "instructor",
    );
  });

  it("supports unsubscribing from role changes", async () => {
    const onRoleChange = vi.fn();

    const unsubscribe =
      authClient.onRoleChange(onRoleChange);

    unsubscribe();

    const authentication = authClient.authenticate(
      "test-instructor-token",
    );

    socketClient.emitMessage({
      type: "auth:success",
    });

    await authentication;

    expect(onRoleChange).not.toHaveBeenCalled();
  });

  it("rejects a second authentication attempt while one is pending", async () => {
    const firstAuthentication =
      authClient.authenticate("first-token");

    await expect(
      authClient.authenticate("second-token"),
    ).rejects.toThrow("Authentication already in progress");

    expect(socketClient.send).toHaveBeenCalledTimes(1);

    socketClient.emitMessage({
      type: "auth:success",
    });

    await expect(firstAuthentication).resolves.toEqual({
      ok: true,
    });
  });

  it("does not downgrade an instructor after a failed re-authentication", async () => {
    const firstAuthentication =
      authClient.authenticate("correct-token");

    socketClient.emitMessage({
      type: "auth:success",
    });

    await firstAuthentication;

    expect(authClient.getRole()).toBe("instructor");

    const secondAuthentication =
      authClient.authenticate("wrong-token");

    socketClient.emitMessage({
      type: "auth:error",
      code: "INVALID_TOKEN",
    });

    await expect(secondAuthentication).resolves.toEqual({
      ok: false,
      code: "INVALID_TOKEN",
    });

    expect(authClient.getRole()).toBe("instructor");
  });

  it("remains an instructor after successful re-authentication", async () => {
    const firstAuthentication =
      authClient.authenticate("correct-token");

    socketClient.emitMessage({
      type: "auth:success",
    });

    await firstAuthentication;

    expect(authClient.getRole()).toBe("instructor");

    const secondAuthentication =
      authClient.authenticate("correct-token");

    socketClient.emitMessage({
      type: "auth:success",
    });

    await expect(secondAuthentication).resolves.toEqual({
      ok: true,
    });

    expect(authClient.getRole()).toBe("instructor");
  });

  it("rejects a pending authentication when the WebSocket disconnects", async () => {
    const authentication =
      authClient.authenticate("test-token");

    socketClient.emitStatus("disconnected");

    await expect(authentication).rejects.toThrow(
      "WebSocket disconnected",
    );

    expect(authClient.getRole()).toBe("participant");
  });
});
