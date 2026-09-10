import { useTrainingSession } from "../hooks/useTrainingSession";

import YouTubePlayer from "../components/player/YouTubePlayer";

export default function ParticipantSessionPage({
  session,
}) {
  const {
    connectionStatus,
    role,
    playback,
  } = useTrainingSession({
    sessionId: session.id,
    instructorToken: null,
    websocketBaseUrl:
      import.meta.env.VITE_WS_BASE_URL,
  });

  const statusLabel =
    {
      CREATED: "Waiting to start",
      LIVE: "Live",
      ENDED: "Ended",
    }[session.status] ?? "Unknown";

  return (
    <main>
      <header>
        <div>
          <span>{statusLabel}</span>
          <span>Participant</span>
        </div>

        <h1>{session.name}</h1>

        <p>
          Session ID:{" "}
          <strong>{session.id}</strong>
        </p>

        <p>
          Connection:{" "}
          <strong>{connectionStatus}</strong>
        </p>
      </header>

      <section aria-label="Training video">
        <YouTubePlayer
          videoUrl={session.youtubeUrl}
          playback={playback}
        />
      </section>

      <p role="status">
        {role === "participant"
          ? "You are viewing this training session."
          : "Participant access is initializing."}
      </p>
    </main>
  );
};
