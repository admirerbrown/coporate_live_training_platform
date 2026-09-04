export function createAuthenticationClient({ socketClient }) {
  let role = "participant";
  let pendingAuthentication = null;
  let destroyed = false;

  const roleListeners = new Set();

  const unsubscribeMessage = socketClient.onMessage(
    (message) => {
      if (destroyed) {
        return;
      }

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
      }
    },
  );

  const unsubscribeStatus =
    socketClient.onStatusChange((status) => {
      if (
        destroyed ||
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
    if (destroyed) {
      return Promise.reject(
        new Error("Authentication client destroyed"),
      );
    }

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
    if (destroyed) {
      return () => {};
    }

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

  function destroy() {
    if (destroyed) {
      return;
    }

    destroyed = true;

    unsubscribeMessage();
    unsubscribeStatus();

    roleListeners.clear();

    if (pendingAuthentication) {
      const pending = pendingAuthentication;
      pendingAuthentication = null;

      pending.reject(
        new Error("Authentication client destroyed"),
      );
    }
  }

  return {
    authenticate,
    getRole,
    onRoleChange,
    destroy,
  };
}