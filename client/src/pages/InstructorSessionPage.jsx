export default function InstructorSessionPage({ session }) {
  const statusLabel =
    {
      CREATED: "Ready to start",
      LIVE: "Live",
      ENDED: "Ended",
    }[session.status] ?? "Unknown";

  return (
    <main>
      <header>
        <span>{statusLabel}</span>
        <span>Instructor</span>

        <h1>{session.name}</h1>

        <p>
          Session ID: <strong>{session.id}</strong>
        </p>
      </header>

      <section aria-label="Training video">
        <p>Training video</p>

        <a href={session.youtubeUrl} target="_blank" rel="noreferrer">
          {session.youtubeUrl}
        </a>
      </section>

      <section aria-label="Playback">
        <h2>Playback</h2>
        <p>Playback controls will appear here.</p>
      </section>
    </main>
  );
}
