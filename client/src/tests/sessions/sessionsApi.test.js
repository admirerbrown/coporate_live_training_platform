import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  createSession,
} from "../../api/sessions";

describe("sessions API", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("creates a training session with the supplied name and YouTube URL", async () => {
    const response = {
      id: "session-123",
      name: "React Training",
      youtubeUrl: "https://www.youtube.com/watch?v=test123",
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
    const networkError = new Error("Network unavailable");

    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(networkError)),
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