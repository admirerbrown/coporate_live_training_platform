
import { useEffect, useRef, useState } from "react";

import {
  calculateEffectivePosition,
} from "../../../../shared/playbackSync";

import {
  loadYouTubeIframeApi,
} from "../../youtube/youtubeApi";

import {
  getYouTubeVideoId,
} from "../../youtube/youtubeVideoId";

export default function YouTubePlayer({
  videoUrl,
  playback,
}) {
  const containerRef = useRef(null);
  const playerRef = useRef(null);
  const playerReadyRef = useRef(false);
  const previousAppliedPlaybackRef =
    useRef(null);

  // Keep the latest playback available to
  // async callbacks such as YouTube's onReady.
  const playbackRef = useRef(playback);

  const [loadError, setLoadError] =
    useState(null);

  useEffect(() => {
    playbackRef.current = playback;
  }, [playback]);

  const videoId =
    getYouTubeVideoId(videoUrl);

  const error =
    !videoId
      ? "Invalid YouTube video URL"
      : loadError?.videoUrl === videoUrl
        ? loadError.message
        : null;

  function applyPlayback(
    player,
    currentPlayback,
  ) {
    const effectivePosition =
      calculateEffectivePosition(
        currentPlayback,
      );

    player.seekTo(
      effectivePosition,
      true,
    );

    if (currentPlayback.isPlaying) {
      player.playVideo();
    } else {
      player.pauseVideo();
    }

    previousAppliedPlaybackRef.current = {
      effectivePosition,
      isPlaying:
        currentPlayback.isPlaying,
    };
  }

  useEffect(() => {
    if (!videoId) {
      return undefined;
    }

    let cancelled = false;

    loadYouTubeIframeApi()
      .then(({ Player }) => {
        if (
          cancelled ||
          !containerRef.current
        ) {
          return;
        }

        const player = new Player(
          containerRef.current,
          {
            videoId,

            playerVars: {
              controls: 0,
              disablekb: 1,
              fs: 0,
              modestbranding: 1,
              rel: 0,
              origin:
                window.location.origin,
              playsinline: 1,
            },

            events: {
              onReady(event) {
                if (cancelled) {
                  return;
                }

                if (
                  playerRef.current !==
                  event.target
                ) {
                  return;
                }

                playerReadyRef.current =
                  true;

                setLoadError(null);

                applyPlayback(
                  event.target,
                  playbackRef.current,
                );
              },
            },
          },
        );

        if (cancelled) {
          player.destroy();
          return;
        }

        playerRef.current = player;
      })
      .catch((err) => {
        if (cancelled) {
          return;
        }

        setLoadError({
          videoUrl,
          message:
            err instanceof Error
              ? err.message
              : "Failed to load YouTube player",
        });
      });

    return () => {
      cancelled = true;

      const player =
        playerRef.current;

      playerRef.current = null;
      playerReadyRef.current = false;
      previousAppliedPlaybackRef.current =
        null;

      if (player) {
        player.destroy();
      }
    };
  }, [videoId, videoUrl]);

  useEffect(() => {
    const player =
      playerRef.current;

    if (
      !player ||
      !playerReadyRef.current
    ) {
      return;
    }

    const currentPlayback = playback;

    const effectivePosition =
      calculateEffectivePosition(
        currentPlayback,
      );

    const previous =
      previousAppliedPlaybackRef.current;

    const positionChanged =
      previous?.effectivePosition !==
      effectivePosition;

    const playingChanged =
      previous?.isPlaying !==
      currentPlayback.isPlaying;

    if (positionChanged) {
      player.seekTo(
        effectivePosition,
        true,
      );
    }

    if (playingChanged) {
      if (currentPlayback.isPlaying) {
        player.playVideo();
      } else {
        player.pauseVideo();
      }
    }

    if (
      positionChanged ||
      playingChanged
    ) {
      previousAppliedPlaybackRef.current = {
        effectivePosition,
        isPlaying:
          currentPlayback.isPlaying,
      };
    }
  }, [playback]);

  return (
    <section aria-label="YouTube player">
      {error ? (
        <div role="alert">
          {error}
        </div>
      ) : (
        <div
          ref={containerRef}
          aria-label="Training video"
          style={{
            pointerEvents: "none",
          }}
        />
      )}
    </section>
  );
}
;
