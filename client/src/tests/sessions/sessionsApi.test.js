import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  createSession,
  getSession,
  joinSession,
} from "../../api/sessions";

describe("sessions API", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  describe("createSession", () => {
    it("creates a training session with the supplied name and YouTube URL", async () => {
      const response = {
        id: "session-123",
        name: "React Training",
        youtubeUrl:
          "https://www.youtube.com/watch?v=test123",
        status: "CREATED",
        createdAt: "2026-09-06T18:00:00.000Z",
        instructorToken: "secret-token",
      };

      vi.stubGlobal(
        "fetch",
        vi.fn(() =>
          Promise.resolve({
            ok: true,
            json: () => Promise.resolve(response),
          }),
        ),
      );

      const result = await createSession({
        name: "React Training",
        youtubeUrl:
          "https://www.youtube.com/watch?v=test123",
      });

      expect(fetch).toHaveBeenCalledWith(
        "/api/sessions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: "React Training",
            youtubeUrl:
              "https://www.youtube.com/watch?v=test123",
          }),
        },
      );

      expect(result).toEqual(response);
    });

    it("throws when the API returns a failure response", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn(() =>
          Promise.resolve({
            ok: false,
            status: 400,
            json: () =>
              Promise.resolve({
                error: "Invalid session name",
              }),
          }),
        ),
      );

      await expect(
        createSession({
          name: "",
          youtubeUrl:
            "https://www.youtube.com/watch?v=test123",
        }),
      ).rejects.toThrow("Invalid session name");
    });

    it("uses a generic error when the API failure has no message", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn(() =>
          Promise.resolve({
            ok: false,
            status: 500,
            json: () => Promise.resolve({}),
          }),
        ),
      );

      await expect(
        createSession({
          name: "Training",
          youtubeUrl:
            "https://www.youtube.com/watch?v=test123",
        }),
      ).rejects.toThrow("Failed to create session");
    });

    it("propagates network errors", async () => {
      const networkError = new Error(
        "Network unavailable",
      );

      vi.stubGlobal(
        "fetch",
        vi.fn(() =>
          Promise.reject(networkError),
        ),
      );

      await expect(
        createSession({
          name: "Training",
          youtubeUrl:
            "https://www.youtube.com/watch?v=test123",
        }),
      ).rejects.toThrow("Network unavailable");
    });
  });

  describe("getSession", () => {
    it("gets a session by ID", async () => {
      const session = {
        id: "session-123",
        name: "JavaScript Training",
        youtubeUrl:
          "https://www.youtube.com/watch?v=test123",
        status: "LIVE",
        createdAt:
          "2026-09-06T18:00:00.000Z",
        position: 45,
        isPlaying: true,
      };

      vi.stubGlobal(
        "fetch",
        vi.fn(() =>
          Promise.resolve({
            ok: true,
            json: () => Promise.resolve(session),
          }),
        ),
      );

      const result = await getSession(
        "session-123",
      );

      expect(fetch).toHaveBeenCalledWith(
        "/api/sessions/session-123",
        {
          method: "GET",
        },
      );

      expect(result).toEqual(session);
    });

    it("throws when the API returns a session error", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn(() =>
          Promise.resolve({
            ok: false,
            status: 404,
            json: () =>
              Promise.resolve({
                error: "Session not found",
              }),
          }),
        ),
      );

      await expect(
        getSession("session-123"),
      ).rejects.toThrow("Session not found");
    });

    it("uses a generic error when the session API failure has no message", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn(() =>
          Promise.resolve({
            ok: false,
            status: 500,
            json: () => Promise.resolve({}),
          }),
        ),
      );

      await expect(
        getSession("session-123"),
      ).rejects.toThrow(
        "Failed to get session",
      );
    });

    it("propagates network errors when getting a session", async () => {
      const networkError = new Error(
        "Network unavailable",
      );

      vi.stubGlobal(
        "fetch",
        vi.fn(() =>
          Promise.reject(networkError),
        ),
      );

      await expect(
        getSession("session-123"),
      ).rejects.toThrow("Network unavailable");
    });
  });

  describe("joinSession", () => {
    it("joins a session with the supplied participant name", async () => {
      const participant = {
        sessionId: "session-123",
        participantName: "Samuel",
        participantId: "participant-123",
        joinedAt:
          "2026-09-06T18:05:00.000Z",
      };

      vi.stubGlobal(
        "fetch",
        vi.fn(() =>
          Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve(participant),
          }),
        ),
      );

      const result = await joinSession(
        "session-123",
        "Samuel",
      );

      expect(fetch).toHaveBeenCalledWith(
        "/api/sessions/session-123/join",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            participantName: "Samuel",
          }),
        },
      );

      expect(result).toEqual(participant);
    });

    it("throws when joining fails", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn(() =>
          Promise.resolve({
            ok: false,
            status: 409,
            json: () =>
              Promise.resolve({
                error: "Session has ended",
              }),
          }),
        ),
      );

      await expect(
        joinSession(
          "session-123",
          "Samuel",
        ),
      ).rejects.toThrow(
        "Session has ended",
      );
    });

    it("uses a generic error when the join API failure has no message", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn(() =>
          Promise.resolve({
            ok: false,
            status: 500,
            json: () => Promise.resolve({}),
          }),
        ),
      );

      await expect(
        joinSession(
          "session-123",
          "Samuel",
        ),
      ).rejects.toThrow(
        "Failed to join session",
      );
    });

    it("propagates network errors when joining", async () => {
      const networkError = new Error(
        "Network unavailable",
      );

      vi.stubGlobal(
        "fetch",
        vi.fn(() =>
          Promise.reject(networkError),
        ),
      );

      await expect(
        joinSession(
          "session-123",
          "Samuel",
        ),
      ).rejects.toThrow(
        "Network unavailable",
      );
    });
  });
});
