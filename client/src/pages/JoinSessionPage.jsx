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

      sessionStorage.setItem(
        `training:participant-name:${session.id}`,
        participantName,
      );

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
      <main className="min-h-screen bg-paper px-4 py-10 text-ink sm:px-6 sm:py-16">
        <p className="mx-auto max-w-170 animate-pulse text-muted" role="status">Loading session...</p>
      </main>
    );
  }

  if (currentLoadError) {
    return (
      <main className="min-h-screen bg-paper px-4 py-10 text-ink sm:px-6 sm:py-16">
        <div className="mx-auto max-w-170 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700" role="alert">{currentLoadError}</div>
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
    <main className="min-h-screen bg-paper px-4 py-8 text-ink sm:px-6 sm:py-12">
      <div className="mx-auto grid min-h-[calc(100vh-6rem)] max-w-260 overflow-hidden rounded-3xl border border-line bg-white shadow-[0_24px_80px_rgba(28,53,68,0.1)] lg:grid-cols-[1fr_0.9fr]">
      <section className="relative flex flex-col justify-between overflow-hidden bg-forest p-7 text-white sm:p-12">
        <div className="absolute -bottom-24 -left-24 size-72 rounded-full border border-white/10" aria-hidden="true" />
        <div className="relative"><span className="inline-grid size-9 place-items-center rounded-lg bg-teal text-xs font-bold">CT</span><span className="ml-3 text-xs font-bold tracking-wider text-white/70 uppercase">Corporate Training</span></div>
        <div className="relative my-16 lg:my-0"><p className="mb-4 font-mono text-xs tracking-[0.18em] text-teal-soft uppercase">You are invited</p><h1 className="max-w-lg text-5xl font-semibold leading-[0.95] tracking-tight sm:text-6xl">Step into the room.</h1><p className="mt-6 max-w-sm text-white/60">Join the live session and learn in sync with your team.</p></div>
        <p className="relative mb-0 font-mono text-xs text-white/40">02 / JOIN SESSION</p>
      </section>
      <section className="flex items-center p-6 sm:p-12">
      <div className="w-full">
      <header className="mb-8">
        <span className="inline-flex rounded-full bg-teal-soft px-3 py-1 text-xs font-bold text-teal">{sessionStatusLabel}</span>
        <h1 className="my-3 text-4xl font-bold leading-tight tracking-tight text-ink sm:text-5xl">{session.name}</h1>
        <p className="font-mono text-sm text-muted">Session ID: <strong>{session.id}</strong></p>
      </header>

      <form className="grid gap-5" onSubmit={handleSubmit}>
        <div className="grid gap-2">
          <label className="text-sm font-bold" htmlFor="participant-name">Participant name</label>

          <input
            id="participant-name"
            name="participantName"
            type="text"
            required
            value={participantName}
            onChange={(event) => setParticipantName(event.target.value)}
            disabled={isJoining}
            className="min-h-11.5 w-full rounded-md border border-[#c9d6d4] bg-[#fbfcfc] px-3"
          />
        </div>

        {joinError && <div className="rounded-md border border-red-200 bg-red-50 p-3 text-red-700" role="alert">{joinError}</div>}

        <button className="min-h-11.5 rounded-md bg-teal px-5 font-bold text-white transition hover:bg-[#066b65] disabled:opacity-50" type="submit" disabled={isJoining}>
          {isJoining ? "Joining Session..." : "Join Session"}
        </button>
      </form>
      </div>
      </section>
      </div>
    </main>
  );
}
