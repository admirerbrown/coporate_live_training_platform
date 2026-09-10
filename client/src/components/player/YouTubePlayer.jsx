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

const DRIFT_THRESHOLD_SECONDS = 1.5;

const SOFT_SYNC_MAX_DRIFT_SECONDS = 4;

const SOFT_SYNC_PLAYBACK_RATE = 1.1;

const SOFT_SYNC_SLOWDOWN_RATE = 0.9;

const NORMAL_PLAYBACK_RATE = 1;

const RECONCILIATION_INTERVAL_MS = 1000;

export default function YouTubePlayer({
  videoUrl,
  playback,
}) {
  const containerRef = useRef(null);

  const playerRef = useRef(null);

  const playerReadyRef = useRef(false);

  const previousAppliedPlaybackRef =
    useRef(null);

  const playbackRef = useRef(playback);

  const playbackRateRef = useRef(
    NORMAL_PLAYBACK_RATE,
  );

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

  function setPlaybackRate(
    player,
    rate,
  ) {
    if (
      playbackRateRef.current ===
      rate
    ) {
      return;
    }

    player.setPlaybackRate(rate);

    playbackRateRef.current = rate;
  }

  function resetPlaybackRate(player) {
    setPlaybackRate(
      player,
      NORMAL_PLAYBACK_RATE,
    );
  }

  function getEffectivePosition(
    currentPlayback,
  ) {
    return calculateEffectivePosition({
      ...currentPlayback,
      serverTime:
        new Date().toISOString(),
    });
  }

  function reconcilePlayback(
    player,
    currentPlayback,
    { forceSeek = false } = {},
  ) {
    const effectivePosition =
      getEffectivePosition(
        currentPlayback,
      );

    // The IFrame API exposes getCurrentTime(),
    // but keep the hard-seek fallback so initialization
    // and unusual test/dummy players remain safe.
    const actualPosition =
      typeof player.getCurrentTime ===
      "function"
        ? Number(
            player.getCurrentTime(),
          )
        : Number.NaN;

    if (
      !Number.isFinite(
        actualPosition,
      )
    ) {
      resetPlaybackRate(player);

      player.seekTo(
        effectivePosition,
        true,
      );

      previousAppliedPlaybackRef.current =
        {
          effectivePosition,
          isPlaying:
            currentPlayback.isPlaying,
        };

      return;
    }

    const drift =
      effectivePosition -
      actualPosition;

    const absoluteDrift =
      Math.abs(drift);

    if (!currentPlayback.isPlaying) {
      resetPlaybackRate(player);

      if (
        forceSeek ||
        absoluteDrift >
          DRIFT_THRESHOLD_SECONDS
      ) {
        player.seekTo(
          effectivePosition,
          true,
        );
      }

      previousAppliedPlaybackRef.current =
        {
          effectivePosition,
          isPlaying:
            currentPlayback.isPlaying,
        };

      return;
    }

    if (
      absoluteDrift <=
      DRIFT_THRESHOLD_SECONDS
    ) {
      resetPlaybackRate(player);
    } else if (
      absoluteDrift <=
      SOFT_SYNC_MAX_DRIFT_SECONDS
    ) {
      setPlaybackRate(
        player,
        drift > 0
          ? SOFT_SYNC_PLAYBACK_RATE
          : SOFT_SYNC_SLOWDOWN_RATE,
      );
    } else {
      resetPlaybackRate(player);

      player.seekTo(
        effectivePosition,
        true,
      );
    }

    previousAppliedPlaybackRef.current =
      {
        effectivePosition,
        isPlaying:
          currentPlayback.isPlaying,
      };
  }

  function applyInitialPlayback(
    player,
    currentPlayback,
  ) {
    // Initial application is a hard seek because
    // the player has just been created and may be
    // many seconds behind the authoritative session position.
    const effectivePosition =
      getEffectivePosition(
        currentPlayback,
      );

    resetPlaybackRate(player);

    player.seekTo(
      effectivePosition,
      true,
    );

    if (currentPlayback.isPlaying) {
      player.playVideo();
    } else {
      player.pauseVideo();
    }

    previousAppliedPlaybackRef.current =
      {
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
    let intervalId = null;

    loadYouTubeIframeApi()
      .then(({ Player }) => {
        if (
          cancelled ||
          !containerRef.current
        ) {
          return;
        }

        const player =
          new Player(
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

                  // Validate against the
                  // specific player instance
                  // created by this effect.
                  if (
                    event.target !==
                    player
                  ) {
                    return;
                  }

                  playerReadyRef.current =
                    true;

                  setLoadError(null);

                  applyInitialPlayback(
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

        // Start reconciliation only after
        // the player instance exists.
        //
        // The callback itself waits for
        // playerReadyRef.current so it is safe
        // if YouTube has not fired onReady yet.
        intervalId =
          window.setInterval(() => {
            if (
              playerRef.current !==
                player ||
              !playerReadyRef.current
            ) {
              return;
            }

            reconcilePlayback(
              player,
              playbackRef.current,
            );
          }, RECONCILIATION_INTERVAL_MS);
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

      if (intervalId !== null) {
        window.clearInterval(
          intervalId,
        );
      }

      const player =
        playerRef.current;

      playerRef.current = null;

      playerReadyRef.current = false;

      previousAppliedPlaybackRef.current =
        null;

      playbackRateRef.current =
        NORMAL_PLAYBACK_RATE;

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
      return undefined;
    }

    const currentPlayback =
      playback;

    const effectivePosition =
      getEffectivePosition(
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

    if (
      positionChanged ||
      playingChanged
    ) {
      if (playingChanged) {
        resetPlaybackRate(player);

        if (
          currentPlayback.isPlaying
        ) {
          player.playVideo();
        } else {
          player.pauseVideo();
        }
      }

      reconcilePlayback(
        player,
        currentPlayback,
        {
          forceSeek:
            !currentPlayback.isPlaying &&
            (
              positionChanged ||
              playingChanged
            ),
        },
      );
    }

    return undefined;
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
};
