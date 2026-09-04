export function createAuthenticationClient({ socketClient }) {
  let role = "participant";
  let pendingAuthentication = null;

  const roleListeners = new Set();

  socketClient.onMessage((message) => {
    if (
      !message ||
      typeof message !== "object"
    ) {
      return;
    }

    if (message.type === "auth:success") {
      role = "instructor";

      if (pendingAuthentication) {
        const pending = pendingAuthentication;
        pendingAuthentication = null;

        pending.resolve({
          ok: true,
        });
      }

      notifyRoleChange();
      return;
    }

    if (message.type === "auth:error") {
      if (!pendingAuthentication) {
        return;
      }

      const pending = pendingAuthentication;
      pendingAuthentication = null;

      pending.resolve({
        ok: false,
        code: message.code,
      });

      return;
    }
  });

  socketClient.onStatusChange((status) => {
    if (
      status !== "disconnected" ||
      !pendingAuthentication
    ) {
      return;
    }

    const pending = pendingAuthentication;
    pendingAuthentication = null;

    pending.reject(
      new Error("WebSocket disconnected"),
    );
  });

  function authenticate(token) {
    if (pendingAuthentication) {
      return Promise.reject(
        new Error("Authentication already in progress"),
      );
    }

    const sent = socketClient.send({
      type: "auth",
      token,
    });

    if (!sent) {
      return Promise.reject(
        new Error("WebSocket is not connected"),
      );
    }

    return new Promise((resolve, reject) => {
      pendingAuthentication = {
        resolve,
        reject,
      };
    });
  }

  function getRole() {
    return role;
  }

  function onRoleChange(listener) {
    roleListeners.add(listener);

    return () => {
      roleListeners.delete(listener);
    };
  }

  function notifyRoleChange() {
    for (const listener of roleListeners) {
      listener(role);
    }
  }

  return {
    authenticate,
    getRole,
    onRoleChange,
  };
}