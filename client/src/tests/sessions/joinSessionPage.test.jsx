import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import JoinSessionPage from "../../pages/JoinSessionPage";

import { getSession, joinSession } from "../../api/sessions";

vi.mock("../../api/sessions", () => ({
  getSession: vi.fn(),
  joinSession: vi.fn(),
}));

describe("JoinSessionPage", () => {
  const session = {
    id: "session-123",
    name: "JavaScript Training",
    youtubeUrl: "https://www.youtube.com/watch?v=test123",
    status: "LIVE",
    createdAt: "2026-09-06T18:00:00.000Z",
    position: 45,
    isPlaying: true,
  };

  const participant = {
    sessionId: "session-123",
    participantName: "Samuel",
    participantId: "participant-123",
    joinedAt: "2026-09-06T18:05:00.000Z",
  };

  const onJoined = vi.fn();

  beforeEach(() => {
    vi.resetAllMocks();

    getSession.mockResolvedValue(session);
    joinSession.mockResolvedValue(participant);
  });

  afterEach(() => {
    cleanup();
  });

  it("loads the requested session", async () => {
    render(<JoinSessionPage sessionId="session-123" onJoined={onJoined} />);

    expect(
      await screen.findByRole("heading", {
        name: "JavaScript Training",
      }),
    ).toBeInTheDocument();

    expect(getSession).toHaveBeenCalledWith("session-123");
  });

  it("renders the participant name field after the session loads", async () => {
    render(<JoinSessionPage sessionId="session-123" onJoined={onJoined} />);

    expect(await screen.findByLabelText(/participant name/i)).toBeRequired();

    expect(
      screen.getByRole("button", {
        name: "Join Session",
      }),
    ).toBeInTheDocument();
  });

  it("shows the session status", async () => {
    render(<JoinSessionPage sessionId="session-123" onJoined={onJoined} />);

    expect(await screen.findByText("Live")).toBeInTheDocument();
  });

  it("shows an error when the session cannot be loaded", async () => {
    getSession.mockRejectedValue(new Error("Session not found"));

    render(<JoinSessionPage sessionId="session-123" onJoined={onJoined} />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Session not found",
    );

    expect(
      screen.queryByLabelText(/participant name/i),
    ).not.toBeInTheDocument();
  });

  it("joins the session with the entered participant name", async () => {
    render(<JoinSessionPage sessionId="session-123" onJoined={onJoined} />);

    const input = await screen.findByLabelText(/participant name/i);

    fireEvent.change(input, {
      target: {
        value: "Samuel",
      },
    });

    fireEvent.submit(input.closest("form"));

    await vi.waitFor(() => {
      expect(joinSession).toHaveBeenCalledWith("session-123", "Samuel");
    });
  });

  it("disables the form while joining", async () => {
    let resolveJoin;

    joinSession.mockReturnValue(
      new Promise((resolve) => {
        resolveJoin = resolve;
      }),
    );

    render(<JoinSessionPage sessionId="session-123" onJoined={onJoined} />);

    const input = await screen.findByLabelText(/participant name/i);

    fireEvent.change(input, {
      target: {
        value: "Samuel",
      },
    });

    fireEvent.submit(input.closest("form"));

    expect(input).toBeDisabled();

    expect(
      screen.getByRole("button", {
        name: /joining session/i,
      }),
    ).toBeDisabled();

    resolveJoin(participant);

    await vi.waitFor(() => {
      expect(onJoined).toHaveBeenCalledWith(session);
    });
  });

  it("shows the join error", async () => {
    joinSession.mockRejectedValue(new Error("Session has ended"));

    render(<JoinSessionPage sessionId="session-123" onJoined={onJoined} />);

    const input = await screen.findByLabelText(/participant name/i);

    fireEvent.change(input, {
      target: {
        value: "Samuel",
      },
    });

    fireEvent.submit(input.closest("form"));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Session has ended",
    );

    expect(onJoined).not.toHaveBeenCalled();
  });

  it("does not expose sensitive session data", async () => {
    render(<JoinSessionPage sessionId="session-123" onJoined={onJoined} />);

    expect(
      await screen.findByRole("heading", {
        name: "JavaScript Training",
      }),
    ).toBeInTheDocument();

    expect(
      screen.queryByText("https://www.youtube.com/watch?v=test123"),
    ).not.toBeInTheDocument();
  });
});
