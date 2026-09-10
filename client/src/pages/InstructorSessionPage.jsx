import { useState } from "react";

import { useTrainingSession } from "../hooks/useTrainingSession";

import YouTubePlayer from "../components/player/YouTubePlayer";

import { endSession, startSession } from "../api/sessions";

export default function InstructorSessionPage({ session }) {
  const { connectionStatus, role, playback, send } = useTrainingSession({
    sessionId: session.id,
    instructorToken: session.instructorToken,
    websocketBaseUrl: import.meta.env.VITE_WS_BASE_URL,
  });

  const [sessionStatus, setSessionStatus] = useState(session.status);

  const [seekPosition, setSeekPosition] = useState(playback.position);

  const [lifecycleError, setLifecycleError] = useState(null);

  const [isStarting, setIsStarting] = useState(false);

  const [isEnding, setIsEnding] = useState(false);

  const [copyStatus, setCopyStatus] = useState("Copy join link");

  const statusLabel =
    {
      CREATED: "Ready to start",
      LIVE: "Live",
      ENDED: "Ended",
    }[sessionStatus] ?? "Unknown";

  const canStart = role === "instructor" && sessionStatus === "CREATED";

  const canEnd = role === "instructor" && sessionStatus === "LIVE";

  const canControlPlayback = role === "instructor" && sessionStatus === "LIVE";

  const joinLink = `${window.location.origin}/sessions/${session.id}/join`;

  async function handleStart() {
    if (!canStart || isStarting) {
      return;
    }

    setIsStarting(true);
    setLifecycleError(null);

    try {
      const updatedSession = await startSession(
        session.id,
        session.instructorToken,
      );

      setSessionStatus(updatedSession.status);
    } catch (error) {
      setLifecycleError(
        error instanceof Error ? error.message : "Failed to start session",
      );
    } finally {
      setIsStarting(false);
    }
  }

  async function handleEnd() {
    if (!canEnd || isEnding) {
      return;
    }

    setIsEnding(true);
    setLifecycleError(null);

    try {
      const updatedSession = await endSession(
        session.id,
        session.instructorToken,
      );

      setSessionStatus(updatedSession.status);

      // Tell the WebSocket server that the
      // session has ended. The server will
      // notify and close connected clients.
      send({
        type: "session:end",
      });
    } catch (error) {
      setLifecycleError(
        error instanceof Error ? error.message : "Failed to end session",
      );
    } finally {
      setIsEnding(false);
    }
  }

  async function handleCopyJoinLink() {
    try {
      await navigator.clipboard.writeText(joinLink);

      setCopyStatus("Copied!");

      window.setTimeout(() => {
        setCopyStatus("Copy join link");
      }, 2000);
    } catch {
      setCopyStatus("Copy failed");

      window.setTimeout(() => {
        setCopyStatus("Copy join link");
      }, 2000);
    }
  }

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
    <main className="h-screen overflow-hidden bg-[#071f24] px-4 py-5 text-white sm:px-6 sm:py-8">
      <div className="mx-auto flex h-full max-w-300 flex-col">
        <header className="mb-6 flex flex-col gap-5 border-b border-white/10 pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-4 flex items-center gap-3"><span className="grid size-9 place-items-center rounded-lg bg-teal text-xs font-bold">CT</span><span className="font-mono text-[10px] tracking-[0.2em] text-teal-soft uppercase">Instructor control room</span></div>
            <div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-teal px-3 py-1 text-xs font-bold text-white">{statusLabel}</span><span className="font-mono text-xs text-white/45">Session / <strong>{session.id}</strong></span></div>
            <h1 className="mt-3 max-w-3xl text-3xl font-bold leading-tight sm:text-5xl">{session.name}</h1>
          </div>
          <p className="flex items-center gap-2 pb-1 font-mono text-xs text-white/60"><span className="size-2 rounded-full bg-teal shadow-[0_0_0_4px_rgba(8,127,120,0.2)]" /><strong className="text-teal-soft">{connectionStatus}</strong><span>room link active</span></p>
        </header>

        <div className="grid min-h-0 flex-1 items-start gap-5 overflow-hidden lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.34fr)]">
          <section className="aspect-video overflow-hidden rounded-xl border border-white/10 bg-[#102d32] p-2 shadow-[0_25px_80px_rgba(0,0,0,0.24)]" aria-label="Training video">
            <YouTubePlayer className="aspect-video" videoUrl={session.youtubeUrl} playback={playback} />
          </section>
          <aside className="grid max-h-full gap-4 overflow-y-auto pr-1">
          <section className="overflow-hidden rounded-xl border border-white/10 bg-[#f5fbf8] text-ink shadow-[0_20px_50px_rgba(0,0,0,0.14)]" aria-label="Session controls">
            <div className="flex items-start justify-between border-b border-forest/10 px-5 pb-4 pt-5">
              <div><p className="mb-2 font-mono text-[10px] tracking-[0.16em] text-teal uppercase">Room index</p><h2 className="text-xl font-bold">Session Controls</h2></div>
              <span className="font-mono text-xs text-muted">{sessionStatus === "LIVE" ? "03 / 03" : "01 / 03"}</span>
            </div>
            {lifecycleError && <div className="mx-5 mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-red-700" role="alert">{lifecycleError}</div>}
            <nav className="grid gap-px bg-forest/10" aria-label="Session actions">
              {sessionStatus === "CREATED" && <div className="bg-[#f5fbf8] p-2">
                <button className="group flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left transition hover:bg-teal hover:text-white disabled:cursor-not-allowed disabled:opacity-50" type="button" onClick={handleStart} disabled={!canStart || isStarting} aria-label={isStarting ? "Starting Session..." : "Start Session"}>
                  <span className="font-mono text-xs text-teal group-hover:text-white/70">01</span><span className="flex-1 font-bold">{isStarting ? "Starting Session..." : "Start Session"}</span><span className="text-lg leading-none text-teal group-hover:text-white">-&gt;</span>
                </button>
              </div>}
              <div className="bg-[#f5fbf8] p-2">
                <button className="group flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left transition hover:bg-forest hover:text-white disabled:cursor-not-allowed disabled:opacity-50" type="button" onClick={handleCopyJoinLink} aria-label={copyStatus}>
                  <span className="font-mono text-xs text-teal group-hover:text-teal-soft">02</span><span className="flex-1 font-bold">{copyStatus}</span><span className="text-lg leading-none text-teal group-hover:text-white" aria-hidden="true">-&gt;</span>
                </button>
              </div>
              {sessionStatus === "LIVE" && <div className="bg-[#f5fbf8] p-2">
                <button className="group flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left transition hover:bg-red-700 hover:text-white disabled:cursor-not-allowed disabled:opacity-50" type="button" onClick={handleEnd} disabled={!canEnd || isEnding} aria-label={isEnding ? "Ending Session..." : "End Session"}>
                  <span className="font-mono text-xs text-red-700 group-hover:text-white/70">03</span><span className="flex-1 font-bold">{isEnding ? "Ending Session..." : "End Session"}</span><span className="text-lg leading-none text-red-700 group-hover:text-white">-&gt;</span>
                </button>
              </div>}
            </nav>
          </section>
          <section className="rounded-xl border border-white/10 bg-[#d9efeb] p-5 text-ink" aria-label="Participant join link">
            <p className="mb-2 font-mono text-[10px] tracking-[0.16em] text-teal uppercase">Share / Room entry</p><h2 className="mb-4 text-xl font-bold">Participant Join Link</h2>
            <input className="mb-2 min-h-11 w-full rounded-md border border-teal/20 bg-white/70 px-3 font-mono text-xs" type="text" value={joinLink} readOnly aria-label="Participant join link" />
            <p className="mt-3 text-sm text-muted">Invite your room with one link. Everyone stays in sync.</p>
          </section>
          <section className="rounded-xl border border-white/10 bg-white p-5 text-ink" aria-label="Playback controls">
            <div className="mb-4 flex items-start justify-between"><div><p className="mb-2 font-mono text-[10px] tracking-[0.16em] text-teal uppercase">Navigate / Timeline</p><h2 className="text-xl font-bold">Playback Controls</h2></div><span className="font-mono text-xs text-muted">{Math.floor(playback.position)}s</span></div>
            <div className="grid grid-cols-2 gap-2">
              <button className="rounded-lg bg-teal px-4 py-2 text-left font-bold text-white transition hover:bg-forest disabled:opacity-50" type="button" onClick={handlePlay} disabled={!canControlPlayback} aria-label="Play"><span className="mr-2" aria-hidden="true">&gt;</span>Play</button>
              <button className="rounded-lg border border-line bg-white px-4 py-2 text-left font-bold text-navy transition hover:border-teal disabled:opacity-50" type="button" onClick={handlePause} disabled={!canControlPlayback} aria-label="Pause"><span className="mr-2" aria-hidden="true">||</span>Pause</button>
            </div>
            <div>
              <label className="mt-4 block text-sm font-bold text-muted" htmlFor="seek-position">Seek position</label>
              <div className="mt-2 flex gap-2"><input id="seek-position" type="number" min="0" step="1" className="min-h-11 w-full rounded-md border border-line px-3" value={seekPosition} onChange={(event) => setSeekPosition(event.target.value)} disabled={!canControlPlayback} /><button className="rounded-md border border-line bg-white px-4 py-2 font-bold text-navy disabled:opacity-50" type="button" onClick={handleSeek} disabled={!canControlPlayback}>Seek</button></div>
            </div>
          </section>
          </aside>
        </div>
        {role !== "instructor" && <p className="mt-5 rounded-md bg-amber-50 p-3 text-amber-800" role="status">Instructor controls are unavailable.</p>}
      </div>
    </main>
  );
}
