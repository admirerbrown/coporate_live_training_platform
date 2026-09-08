import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { MemoryRouter, useLocation } from "react-router";

import App, { AppRoutes } from "../App";

import { getSession } from "../api/sessions";

vi.mock("../api/sessions", () => ({
  getSession: vi.fn(),
}));

vi.mock("../pages/CreateSessionPage", () => ({
  default: ({ onSessionCreated }) => (
    <button
      type="button"
      onClick={() =>
        onSessionCreated({
          id: "session-123",
          name: "React Training",
          youtubeUrl: "https://www.youtube.com/watch?v=test123",
          status: "CREATED",
          instructorToken: "secret-token",
        })
      }
    >
      Mock Create Session
    </button>
  ),
}));

vi.mock("../pages/JoinSessionPage", () => ({
  default: ({ sessionId, onJoined }) => (
    <button
      type="button"
      onClick={() =>
        onJoined({
          id: sessionId,
          name: "React Training",
        })
      }
    >
      Join {sessionId}
    </button>
  ),
}));

vi.mock("../pages/InstructorSessionPage", () => ({
  default: ({ session }) => (
    <div>
      <h1>Instructor: {session.name}</h1>

      <span>token:{session.instructorToken}</span>
    </div>
  ),
}));

vi.mock("../pages/ParticipantSessionPage", () => ({
  default: ({ session }) => (
    <div>
      <h1>Participant: {session.name}</h1>
    </div>
  ),
}));

function LocationProbe() {
  const location = useLocation();

  return <output data-testid="location">{location.pathname}</output>;
}

function renderRoutes(initialEntry) {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <AppRoutes />
      <LocationProbe />
    </MemoryRouter>,
  );
}

describe("App routing", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    sessionStorage.clear();

    getSession.mockResolvedValue({
      id: "session-123",
      name: "React Training",
      youtubeUrl: "https://www.youtube.com/watch?v=test123",
      status: "LIVE",
      position: 25,
      isPlaying: true,
    });
  });

  afterEach(() => {
    cleanup();
    sessionStorage.clear();
  });

  it("renders the create session page at the root route", () => {
    renderRoutes("/");

    expect(
      screen.getByRole("button", {
        name: "Mock Create Session",
      }),
    ).toBeInTheDocument();
  });

  it("navigates to the instructor session after creating a session", () => {
    renderRoutes("/");

    fireEvent.click(
      screen.getByRole("button", {
        name: "Mock Create Session",
      }),
    );

    expect(screen.getByTestId("location")).toHaveTextContent(
      "/sessions/session-123/instructor",
    );

    expect(
      sessionStorage.getItem("training:instructor-token:session-123"),
    ).toBe("secret-token");
  });

  it("renders the join page with the session ID from the URL", () => {
    renderRoutes("/sessions/session-123/join");

    expect(
      screen.getByRole("button", {
        name: "Join session-123",
      }),
    ).toBeInTheDocument();
  });

  it("navigates to the participant session after joining", () => {
    renderRoutes("/sessions/session-123/join");

    fireEvent.click(
      screen.getByRole("button", {
        name: "Join session-123",
      }),
    );

    expect(screen.getByTestId("location")).toHaveTextContent(
      "/sessions/session-123/live",
    );
  });

  it("loads and renders the instructor session", async () => {
    sessionStorage.setItem(
      "training:instructor-token:session-123",
      "secret-token",
    );

    renderRoutes("/sessions/session-123/instructor");

    expect(
      await screen.findByRole("heading", {
        name: "Instructor: React Training",
      }),
    ).toBeInTheDocument();

    expect(screen.getByText("token:secret-token")).toBeInTheDocument();

    expect(getSession).toHaveBeenCalledWith("session-123");
  });

  it("renders an instructor access error when the token is unavailable", () => {
    renderRoutes("/sessions/session-123/instructor");

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Instructor access is unavailable",
    );

    expect(getSession).not.toHaveBeenCalled();
  });

  it("loads and renders the participant session", async () => {
    renderRoutes("/sessions/session-123/live");

    expect(
      await screen.findByRole("heading", {
        name: "Participant: React Training",
      }),
    ).toBeInTheDocument();

    expect(getSession).toHaveBeenCalledWith("session-123");
  });

  it("shows a session-loading error when the participant session cannot be loaded", async () => {
    getSession.mockRejectedValue(new Error("Session not found"));

    renderRoutes("/sessions/session-123/live");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Session not found",
    );
  });
});

describe("App", () => {
  it("provides browser routing", () => {
    window.history.pushState({}, "", "/");

    render(<App />);

    expect(
      screen.getByRole("button", {
        name: "Mock Create Session",
      }),
    ).toBeInTheDocument();
  });
});
