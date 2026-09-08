import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  cleanup,
  render,
  screen,
} from "@testing-library/react";

import ParticipantSessionPage from "../../pages/ParticipantSessionPage";

import {
  useTrainingSession,
} from "../../hooks/useTrainingSession";

import YouTubePlayer from "../../components/player/YouTubePlayer";

vi.mock("../../hooks/useTrainingSession", () => ({
  useTrainingSession: vi.fn(),
}));

vi.mock("../../components/player/YouTubePlayer", () => ({
  default: vi.fn(
    ({ videoUrl, playback }) => (
      <div
        data-testid="youtube-player"
        data-video-url={videoUrl}
        data-playing={String(
          playback.isPlaying,
        )}
        data-position={String(
          playback.position,
        )}
      />
    ),
  ),
}));

describe("ParticipantSessionPage", () => {
  const session = {
    id: "session-123",
    name: "JavaScript Training",
    youtubeUrl:
      "https://www.youtube.com/watch?v=test123",
    instructorToken: "secret-token",
    status: "LIVE",
  };

  const playback = {
    position: 45,
    isPlaying: true,
    version: 3,
    updatedAt: "2026-01-01T12:00:00.000Z",
    serverTime: "2026-01-01T12:00:05.000Z",
  };

  beforeEach(() => {
    vi.resetAllMocks();

    useTrainingSession.mockReturnValue({
      connectionStatus: "connected",
      role: "participant",
      playback,
      connect: vi.fn(),
      disconnect: vi.fn(),
      send: vi.fn(),
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("renders the participant session", () => {
    render(
      <ParticipantSessionPage
        session={session}
      />,
    );

    expect(
      screen.getByRole("heading", {
        name: "JavaScript Training",
      }),
    ).toBeInTheDocument();

    expect(
      screen.getByText("session-123"),
    ).toBeInTheDocument();

    expect(
      screen.getByText(/participant/i),
    ).toBeInTheDocument();

    expect(
      screen.getByText(/connected/i),
    ).toBeInTheDocument();
  });

  it("uses the session ID without an instructor token", () => {
    render(
      <ParticipantSessionPage
        session={session}
      />,
    );

    expect(
      useTrainingSession,
    ).toHaveBeenCalledWith({
      sessionId: "session-123",
      instructorToken: null,
      websocketBaseUrl:
        import.meta.env.VITE_WS_BASE_URL,
    });
  });

  it("passes the session video and playback state to YouTubePlayer", () => {
    render(
      <ParticipantSessionPage
        session={session}
      />,
    );

    expect(YouTubePlayer).toHaveBeenCalledWith(
      expect.objectContaining({
        videoUrl: session.youtubeUrl,
        playback,
      }),
      undefined,
    );
  });

  it("does not render instructor playback controls", () => {
    render(
      <ParticipantSessionPage
        session={session}
      />,
    );

    expect(
      screen.queryByRole("button", {
        name: "Play",
      }),
    ).not.toBeInTheDocument();

    expect(
      screen.queryByRole("button", {
        name: "Pause",
      }),
    ).not.toBeInTheDocument();

    expect(
      screen.queryByRole("button", {
        name: "Seek",
      }),
    ).not.toBeInTheDocument();
  });

  it("does not expose the instructor token", () => {
    render(
      <ParticipantSessionPage
        session={session}
      />,
    );

    expect(
      screen.queryByText("secret-token"),
    ).not.toBeInTheDocument();

    expect(
      screen.queryByDisplayValue("secret-token"),
    ).not.toBeInTheDocument();
  });

  it("identifies a live session as live", () => {
    render(
      <ParticipantSessionPage
        session={{
          ...session,
          status: "LIVE",
        }}
      />,
    );

    expect(
      screen.getByText("Live"),
    ).toBeInTheDocument();
  });

  it("does not show Live for an ended session", () => {
    render(
      <ParticipantSessionPage
        session={{
          ...session,
          status: "ENDED",
        }}
      />,
    );

    expect(
      screen.queryByText("Live"),
    ).not.toBeInTheDocument();

    expect(
      screen.getByText(/ended/i),
    ).toBeInTheDocument();
  });

  it("does not send playback commands as a participant", () => {
    const send = vi.fn();

    useTrainingSession.mockReturnValue({
      connectionStatus: "connected",
      role: "participant",
      playback,
      connect: vi.fn(),
      disconnect: vi.fn(),
      send,
    });

    render(
      <ParticipantSessionPage
        session={session}
      />,
    );

    expect(send).not.toHaveBeenCalled();
  });
});
