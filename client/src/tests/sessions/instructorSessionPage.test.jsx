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
  fireEvent,
  render,
  screen,
} from "@testing-library/react";

import InstructorSessionPage from "../../pages/InstructorSessionPage";

import { useTrainingSession } from "../../hooks/useTrainingSession";

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
        data-playing={String(playback.isPlaying)}
        data-position={String(playback.position)}
      />
    ),
  ),
}));

describe("InstructorSessionPage", () => {
  const baseSession = {
    id: "session-123",
    name: "JavaScript Training",
    youtubeUrl:
      "https://www.youtube.com/watch?v=test123",
    instructorToken: "secret-token",
    status: "LIVE",
  };

  const basePlayback = {
    position: 25,
    isPlaying: false,
    version: 1,
    updatedAt: "2026-01-01T12:00:00.000Z",
    serverTime: "2026-01-01T12:00:05.000Z",
  };

  let send;

  beforeEach(() => {
    vi.resetAllMocks();

    send = vi.fn(() => true);

    useTrainingSession.mockReturnValue({
      connectionStatus: "connected",
      role: "instructor",
      playback: basePlayback,
      connect: vi.fn(),
      disconnect: vi.fn(),
      send,
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("renders the instructor session", () => {
    render(
      <InstructorSessionPage session={baseSession} />,
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
      screen.getByText(/instructor/i),
    ).toBeInTheDocument();

    expect(
      screen.getByText("Live"),
    ).toBeInTheDocument();
  });

  it("shows Live for a live session", () => {
    render(
      <InstructorSessionPage
        session={{
          ...baseSession,
          status: "LIVE",
        }}
      />,
    );

    expect(
      screen.getByText("Live"),
    ).toBeInTheDocument();
  });

  it("does not show Live for a created session", () => {
    render(
      <InstructorSessionPage
        session={{
          ...baseSession,
          status: "CREATED",
        }}
      />,
    );

    expect(
      screen.queryByText("Live"),
    ).not.toBeInTheDocument();

    expect(
      screen.getByText(/ready to start/i),
    ).toBeInTheDocument();
  });

  it("does not show Live for an ended session", () => {
    render(
      <InstructorSessionPage
        session={{
          ...baseSession,
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

  it("does not expose the instructor token", () => {
    render(
      <InstructorSessionPage session={baseSession} />,
    );

    expect(
      screen.queryByText("secret-token"),
    ).not.toBeInTheDocument();
  });

  it("creates the training session with the session ID and instructor token", () => {
    render(
      <InstructorSessionPage session={baseSession} />,
    );

    expect(
      useTrainingSession,
    ).toHaveBeenCalledWith({
      sessionId: "session-123",
      instructorToken: "secret-token",
      websocketBaseUrl:
        import.meta.env.VITE_WS_BASE_URL,
    });
  });

  it("passes the session video and playback state to YouTubePlayer", () => {
    render(
      <InstructorSessionPage session={baseSession} />,
    );

    expect(YouTubePlayer).toHaveBeenCalledWith(
      expect.objectContaining({
        videoUrl: baseSession.youtubeUrl,
        playback: basePlayback,
      }),
      undefined,
    );
  });

  it("shows the WebSocket connection status", () => {
    render(
      <InstructorSessionPage session={baseSession} />,
    );

    expect(
      screen.getByText(/connected/i),
    ).toBeInTheDocument();
  });

  it("sends a play message when Play is clicked", () => {
    render(
      <InstructorSessionPage session={baseSession} />,
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "Play",
      }),
    );

    expect(send).toHaveBeenCalledWith({
      type: "playback:play",
    });
  });

  it("sends a pause message when Pause is clicked", () => {
    render(
      <InstructorSessionPage session={baseSession} />,
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "Pause",
      }),
    );

    expect(send).toHaveBeenCalledWith({
      type: "playback:pause",
    });
  });

  it("sends a numeric seek position", () => {
    render(
      <InstructorSessionPage session={baseSession} />,
    );

    fireEvent.change(
      screen.getByLabelText(/seek position/i),
      {
        target: {
          value: "90",
        },
      },
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "Seek",
      }),
    );

    expect(send).toHaveBeenCalledWith({
      type: "playback:seek",
      position: 90,
    });
  });

  it("does not allow playback controls for a participant", () => {
    useTrainingSession.mockReturnValue({
      connectionStatus: "connected",
      role: "participant",
      playback: basePlayback,
      connect: vi.fn(),
      disconnect: vi.fn(),
      send,
    });

    render(
      <InstructorSessionPage session={baseSession} />,
    );

    expect(
      screen.getByRole("button", {
        name: "Play",
      }),
    ).toBeDisabled();

    expect(
      screen.getByRole("button", {
        name: "Pause",
      }),
    ).toBeDisabled();

    expect(
      screen.getByRole("button", {
        name: "Seek",
      }),
    ).toBeDisabled();

    expect(send).not.toHaveBeenCalled();
  });
});
