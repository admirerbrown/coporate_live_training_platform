import { useState } from "react";

import { useTrainingSession } from "../hooks/useTrainingSession";

import YouTubePlayer from "../components/player/YouTubePlayer";

export default function InstructorSessionPage({ session }) {
  const { connectionStatus, role, playback, send } = useTrainingSession({
    sessionId: session.id,
    instructorToken: session.instructorToken,
    websocketBaseUrl: import.meta.env.VITE_WS_BASE_URL,
  });

  const [seekPosition, setSeekPosition] = useState(playback.position);

  const statusLabel =
    {
      CREATED: "Ready to start",
      LIVE: "Live",
      ENDED: "Ended",
    }[session.status] ?? "Unknown";

  const canControlPlayback = role === "instructor" && session.status === "LIVE";

  function handlePlay() {
    if (!canControlPlayback) {
      return;
    }

    send({
      type: "playback:play",
    });
  }

  function handlePause() {
    if (!canControlPlayback) {
      return;
    }

    send({
      type: "playback:pause",
    });
  }

  function handleSeek() {
    if (!canControlPlayback) {
      return;
    }

    const position = Number(seekPosition);

    if (!Number.isFinite(position) || position < 0) {
      return;
    }

    send({
      type: "playback:seek",
      position,
    });
  }

  return (
    <main>
      <header>
        <div>
          <span>{statusLabel}</span>
          <span>Instructor</span>
        </div>

        <h1>{session.name}</h1>

        <p>
          Session ID: <strong>{session.id}</strong>
        </p>

        <p>
          Connection: <strong>{connectionStatus}</strong>
        </p>
      </header>

      <section aria-label="Training video">
        <YouTubePlayer videoUrl={session.youtubeUrl} playback={playback} />
      </section>

      <section aria-label="Playback controls">
        <h2>Playback Controls</h2>

        <button
          type="button"
          onClick={handlePlay}
          disabled={!canControlPlayback}
        >
          Play
        </button>

        <button
          type="button"
          onClick={handlePause}
          disabled={!canControlPlayback}
        >
          Pause
        </button>

        <div>
          <label htmlFor="seek-position">Seek position</label>

          <input
            id="seek-position"
            type="number"
            min="0"
            step="1"
            value={seekPosition}
            onChange={(event) => setSeekPosition(event.target.value)}
            disabled={!canControlPlayback}
          />

          <button
            type="button"
            onClick={handleSeek}
            disabled={!canControlPlayback}
          >
            Seek
          </button>
        </div>
      </section>

      {role !== "instructor" && (
        <p role="status">Instructor controls are unavailable.</p>
      )}
    </main>
  );
}
