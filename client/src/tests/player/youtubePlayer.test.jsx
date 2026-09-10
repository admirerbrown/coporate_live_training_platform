import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { cleanup, render, screen, waitFor } from "@testing-library/react";

import YouTubePlayer from "../../components/player/YouTubePlayer";

import { loadYouTubeIframeApi } from "../../youtube/youtubeApi";

import { calculateEffectivePosition } from "../../../../shared/playbackSync";

vi.mock("../../youtube/youtubeApi", () => ({
  loadYouTubeIframeApi: vi.fn(),
}));

vi.mock("../../youtube/youtubeVideoId", () => ({
  getYouTubeVideoId: vi.fn(() => "M7lc1UVf-VE"),
}));

vi.mock("../../../../shared/playbackSync", () => ({
  calculateEffectivePosition: vi.fn((playback) => playback.position),
}));

describe("YouTubePlayer", () => {
  let player;
  let Player;
  let onReady;

  const basePlayback = {
    position: 25,
    isPlaying: true,
    version: 1,
    updatedAt: "2026-01-01T12:00:00.000Z",
    serverTime: "2026-01-01T12:00:05.000Z",
  };

  beforeEach(() => {
    vi.resetAllMocks();

    calculateEffectivePosition.mockImplementation(
      (playback) => playback.position,
    );

    player = {
      playVideo: vi.fn(),
      pauseVideo: vi.fn(),
      seekTo: vi.fn(),
      destroy: vi.fn(),
    };

    Player = vi.fn(function MockPlayer(container, options) {
      onReady = options.events.onReady;

      return player;
    });

    loadYouTubeIframeApi.mockResolvedValue({
      Player,
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("creates a YouTube player for the supplied video", async () => {
    render(
      <YouTubePlayer
        videoUrl="https://www.youtube.com/watch?v=M7lc1UVf-VE"
        playback={basePlayback}
      />,
    );

    await waitFor(() => {
      expect(Player).toHaveBeenCalledTimes(1);
    });

    expect(Player).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        videoId: "M7lc1UVf-VE",
      }),
    );
  });

  it("calculates the effective position when the player becomes ready", async () => {
    render(
      <YouTubePlayer
        videoUrl="https://www.youtube.com/watch?v=M7lc1UVf-VE"
        playback={basePlayback}
      />,
    );

    await waitFor(() => {
      expect(onReady).toEqual(expect.any(Function));
    });

    calculateEffectivePosition.mockReturnValue(37);

    onReady({
      target: player,
    });

    expect(calculateEffectivePosition).toHaveBeenCalledWith(
      expect.objectContaining({
        position: basePlayback.position,
        isPlaying: basePlayback.isPlaying,
        version: basePlayback.version,
        updatedAt: basePlayback.updatedAt,
        serverTime: expect.any(String),
      }),
    );

    expect(player.seekTo).toHaveBeenCalledWith(37, true);

    expect(player.playVideo).toHaveBeenCalledTimes(1);
  });

  it("uses the latest playback when onReady fires after props change", async () => {
    const { rerender } = render(
      <YouTubePlayer
        videoUrl="https://www.youtube.com/watch?v=M7lc1UVf-VE"
        playback={basePlayback}
      />,
    );

    await waitFor(() => {
      expect(onReady).toEqual(expect.any(Function));
    });

    const latestPlayback = {
      ...basePlayback,
      position: 80,
      version: 2,
    };

    calculateEffectivePosition.mockReturnValue(80);

    rerender(
      <YouTubePlayer
        videoUrl="https://www.youtube.com/watch?v=M7lc1UVf-VE"
        playback={latestPlayback}
      />,
    );

    onReady({
      target: player,
    });

    expect(calculateEffectivePosition).toHaveBeenLastCalledWith(
      expect.objectContaining({
        position: latestPlayback.position,
        isPlaying: latestPlayback.isPlaying,
        version: latestPlayback.version,
        updatedAt: latestPlayback.updatedAt,
        serverTime: expect.any(String),
      }),
    );

    expect(player.seekTo).toHaveBeenLastCalledWith(80, true);
  });

  it("recomputes serverTime freshly when applying playback, instead of reusing the stale message value", async () => {
    // Regression test: the effective position must be calculated using
    // the real time at the moment the player is actually ready, not
    // the serverTime captured whenever the WebSocket message originally
    // arrived. Without this, a late-joining or reconnecting client whose
    // player takes real time to initialize ends up seeking to a
    // position that's already stale by the time it's applied.
    render(
      <YouTubePlayer
        videoUrl="https://www.youtube.com/watch?v=M7lc1UVf-VE"
        playback={basePlayback}
      />,
    );

    await waitFor(() => {
      expect(onReady).toEqual(expect.any(Function));
    });

    const before = Date.now();

    onReady({
      target: player,
    });

    const after = Date.now();

    const calledWith = calculateEffectivePosition.mock.calls[0][0];
    const calledServerTime = Date.parse(calledWith.serverTime);

    expect(calledWith.serverTime).not.toBe(basePlayback.serverTime);
    expect(calledServerTime).toBeGreaterThanOrEqual(before);
    expect(calledServerTime).toBeLessThanOrEqual(after);
  });

  it("plays when playback changes to playing without seeking unnecessarily", async () => {
    const { rerender } = render(
      <YouTubePlayer
        videoUrl="https://www.youtube.com/watch?v=M7lc1UVf-VE"
        playback={{
          ...basePlayback,
          isPlaying: false,
        }}
      />,
    );

    await waitFor(() => {
      expect(onReady).toEqual(expect.any(Function));
    });

    onReady({
      target: player,
    });

    player.seekTo.mockClear();
    player.playVideo.mockClear();
    player.pauseVideo.mockClear();

    rerender(
      <YouTubePlayer
        videoUrl="https://www.youtube.com/watch?v=M7lc1UVf-VE"
        playback={{
          ...basePlayback,
          isPlaying: true,
        }}
      />,
    );

    await waitFor(() => {
      expect(player.playVideo).toHaveBeenCalledTimes(1);
    });

    expect(player.seekTo).not.toHaveBeenCalled();
    expect(player.pauseVideo).not.toHaveBeenCalled();
  });

  it("pauses when playback changes to paused without seeking unnecessarily", async () => {
    const { rerender } = render(
      <YouTubePlayer
        videoUrl="https://www.youtube.com/watch?v=M7lc1UVf-VE"
        playback={basePlayback}
      />,
    );

    await waitFor(() => {
      expect(onReady).toEqual(expect.any(Function));
    });

    onReady({
      target: player,
    });

    player.seekTo.mockClear();
    player.playVideo.mockClear();
    player.pauseVideo.mockClear();

    rerender(
      <YouTubePlayer
        videoUrl="https://www.youtube.com/watch?v=M7lc1UVf-VE"
        playback={{
          ...basePlayback,
          isPlaying: false,
        }}
      />,
    );

    await waitFor(() => {
      expect(player.pauseVideo).toHaveBeenCalledTimes(1);
    });

    expect(player.seekTo).not.toHaveBeenCalled();
    expect(player.playVideo).not.toHaveBeenCalled();
  });

  it("seeks when the playback position changes without changing play state", async () => {
    const { rerender } = render(
      <YouTubePlayer
        videoUrl="https://www.youtube.com/watch?v=M7lc1UVf-VE"
        playback={basePlayback}
      />,
    );

    await waitFor(() => {
      expect(onReady).toEqual(expect.any(Function));
    });

    onReady({
      target: player,
    });

    player.seekTo.mockClear();
    player.playVideo.mockClear();
    player.pauseVideo.mockClear();

    calculateEffectivePosition.mockReturnValue(60);

    rerender(
      <YouTubePlayer
        videoUrl="https://www.youtube.com/watch?v=M7lc1UVf-VE"
        playback={{
          ...basePlayback,
          position: 60,
          version: 2,
        }}
      />,
    );

    await waitFor(() => {
      expect(player.seekTo).toHaveBeenCalledWith(60, true);
    });

    expect(player.playVideo).not.toHaveBeenCalled();
    expect(player.pauseVideo).not.toHaveBeenCalled();
  });

  it("does not resynchronize the player when playback props are unchanged", async () => {
    const { rerender } = render(
      <YouTubePlayer
        videoUrl="https://www.youtube.com/watch?v=M7lc1UVf-VE"
        playback={basePlayback}
      />,
    );

    await waitFor(() => {
      expect(onReady).toEqual(expect.any(Function));
    });

    onReady({
      target: player,
    });

    player.seekTo.mockClear();
    player.playVideo.mockClear();
    player.pauseVideo.mockClear();
    calculateEffectivePosition.mockClear();

    rerender(
      <YouTubePlayer
        videoUrl="https://www.youtube.com/watch?v=M7lc1UVf-VE"
        playback={{
          ...basePlayback,
        }}
      />,
    );

    expect(player.seekTo).not.toHaveBeenCalled();
    expect(player.playVideo).not.toHaveBeenCalled();
    expect(player.pauseVideo).not.toHaveBeenCalled();
  });

  it("shows an error when the YouTube API fails to load", async () => {
    loadYouTubeIframeApi.mockRejectedValue(
      new Error("Failed to load YouTube IFrame API"),
    );

    render(
      <YouTubePlayer
        videoUrl="https://www.youtube.com/watch?v=M7lc1UVf-VE"
        playback={basePlayback}
      />,
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Failed to load YouTube IFrame API",
    );

    expect(Player).not.toHaveBeenCalled();
  });

  it("does not create or control a player if unmounted before initialization completes", async () => {
    let resolveApi;

    loadYouTubeIframeApi.mockReturnValue(
      new Promise((resolve) => {
        resolveApi = resolve;
      }),
    );

    const { unmount } = render(
      <YouTubePlayer
        videoUrl="https://www.youtube.com/watch?v=M7lc1UVf-VE"
        playback={basePlayback}
      />,
    );

    unmount();

    resolveApi({
      Player,
    });

    await Promise.resolve();

    expect(Player).not.toHaveBeenCalled();
    expect(player.destroy).not.toHaveBeenCalled();
  });

  it("destroys the player on unmount after initialization", async () => {
    const { unmount } = render(
      <YouTubePlayer
        videoUrl="https://www.youtube.com/watch?v=M7lc1UVf-VE"
        playback={basePlayback}
      />,
    );

    await waitFor(() => {
      expect(onReady).toEqual(expect.any(Function));
    });

    onReady({
      target: player,
    });

    unmount();

    expect(player.destroy).toHaveBeenCalledTimes(1);
  });
});
