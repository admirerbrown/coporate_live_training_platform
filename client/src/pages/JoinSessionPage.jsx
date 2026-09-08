import { useEffect, useState } from "react";

import { getSession, joinSession } from "../api/sessions";

export default function JoinSessionPage({ sessionId, onJoined }) {
  const [session, setSession] = useState(null);

  const [loadedSessionId, setLoadedSessionId] = useState(null);

  const [loadError, setLoadError] = useState(null);

  const [participantName, setParticipantName] = useState("");

  const [joinError, setJoinError] = useState(null);

  const [isJoining, setIsJoining] = useState(false);

  useEffect(() => {
    let cancelled = false;

    getSession(sessionId)
      .then((nextSession) => {
        if (cancelled) {
          return;
        }

        setSession(nextSession);
        setLoadedSessionId(sessionId);
        setLoadError(null);
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }

        setLoadError({
          sessionId,
          message:
            error instanceof Error ? error.message : "Failed to get session",
        });
      });

    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  const isLoading =
    loadedSessionId !== sessionId && loadError?.sessionId !== sessionId;

  const currentLoadError =
    loadError?.sessionId === sessionId ? loadError.message : null;

  async function handleSubmit(event) {
    event.preventDefault();

    if (isJoining || isLoading || !session) {
      return;
    }

    setIsJoining(true);
    setJoinError(null);

    try {
      await joinSession(session.id, participantName);

      onJoined(session);
    } catch (error) {
      setJoinError(
        error instanceof Error ? error.message : "Failed to join session",
      );
    } finally {
      setIsJoining(false);
    }
  }

  if (isLoading) {
    return (
      <main>
        <p role="status">Loading session...</p>
      </main>
    );
  }

  if (currentLoadError) {
    return (
      <main>
        <div role="alert">{currentLoadError}</div>
      </main>
    );
  }

  const sessionStatusLabel =
    {
      CREATED: "Waiting to start",
      LIVE: "Live",
      ENDED: "Ended",
    }[session.status] ?? "Unknown";

  return (
    <main>
      <header>
        <span>{sessionStatusLabel}</span>

        <h1>{session.name}</h1>

        <p>
          Session ID: <strong>{session.id}</strong>
        </p>
      </header>

      <form onSubmit={handleSubmit}>
        <div>
          <label htmlFor="participant-name">Participant name</label>

          <input
            id="participant-name"
            name="participantName"
            type="text"
            required
            value={participantName}
            onChange={(event) => setParticipantName(event.target.value)}
            disabled={isJoining}
          />
        </div>

        {joinError && <div role="alert">{joinError}</div>}

        <button type="submit" disabled={isJoining}>
          {isJoining ? "Joining Session..." : "Join Session"}
        </button>
      </form>
    </main>
  );
}
