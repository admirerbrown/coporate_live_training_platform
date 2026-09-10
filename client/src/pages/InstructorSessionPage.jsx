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
    <main className="relative h-dvh overflow-hidden bg-[#f2eee7] px-4 py-5 text-[#171525] sm:px-6 sm:py-7">
      <div className="relative mx-auto flex h-full min-h-0 max-w-300 flex-col">
        <header className="relative mb-4 grid shrink-0 gap-4 border-b border-[#171525]/12 pb-4 sm:mb-6 sm:grid-cols-[minmax(170px,0.3fr)_minmax(0,1fr)] sm:gap-6 sm:pb-5">
          <div className="flex min-w-0 flex-col justify-between gap-2 border-b border-[#171525]/10 pb-3 sm:border-b-0 sm:border-r sm:pb-0 sm:pr-6">
            <div className="flex items-center gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#c97967] font-display text-sm font-bold text-[#171525]">CT</span><span className="whitespace-nowrap font-mono text-[10px] tracking-[0.22em] text-[#9f5d50] uppercase">Instructor room</span></div>
            <div className="flex flex-wrap items-center gap-4"><span className="inline-flex shrink-0 items-center gap-2 rounded-full border border-[#9f5d50]/40 bg-[#c97967]/12 px-3 py-1 font-mono text-[10px] font-bold tracking-[0.12em] text-[#9f5d50] uppercase"><span className="size-1.5 rounded-full bg-[#87945a]" />{statusLabel}</span><p className="hidden items-center gap-2 font-mono text-xs text-[#171525]/60 sm:flex"><span className="size-2 rounded-full bg-[#87945a]" /><strong className="text-[#687443]">{connectionStatus}</strong></p></div>
          </div>
          <div className="min-w-0 text-center sm:absolute sm:left-1/2 sm:top-1/2 sm:w-[min(52%,30rem)] sm:-translate-x-1/2 sm:-translate-y-1/2">
            <h1 aria-label={session.name} className="truncate font-display text-xl font-bold leading-tight tracking-tight text-[#171525] sm:text-2xl"><span className="mr-2 text-[#171525]/40">Session:</span>{session.name}</h1>
            <p className="mt-2 truncate font-mono text-[10px] tracking-[0.14em] text-[#171525]/45 uppercase">ROOM / <strong className="text-[#171525]/70">{session.id}</strong></p>
          </div>
          <p className="flex items-center justify-end font-mono text-[10px] text-[#9f5d50] sm:text-xs"><span className="mr-2 text-[#171525]/40">Host controls</span>Active</p>
        </header>

        <div className="grid min-h-0 flex-1 gap-4 overflow-hidden lg:h-full lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.34fr)] lg:gap-5">
          <section className="flex min-h-32 min-w-0 flex-col overflow-hidden rounded-2xl border border-[#171525]/15 bg-[#e6e0d6] p-2 shadow-[0_30px_90px_rgba(43,34,27,0.14)] lg:h-full lg:min-h-0" aria-label="Training video">
            <div className="mb-2 flex items-center justify-between px-2 pt-1 font-mono text-[10px] tracking-[0.14em] uppercase"><span className="text-[#171525]/45">Broadcast / Room feed</span><span className={sessionStatus === "LIVE" ? "text-[#687443]" : "font-bold text-[#9f5d50]"}>{sessionStatus === "LIVE" ? "Live to room" : sessionStatus === "CREATED" ? "Standby" : "Room closed"}</span></div>
            <YouTubePlayer className="min-h-0 h-full w-full flex-1 aspect-auto overflow-hidden rounded-lg" videoUrl={session.youtubeUrl} playback={playback} />
          </section>

          <aside className="grid min-h-0 content-start gap-3 overflow-hidden pr-1">
            <section className="h-fit self-start overflow-visible rounded-2xl border border-[#9f5d50]/30 bg-white text-[#171525] shadow-[0_20px_50px_rgba(43,34,27,0.12)]" aria-label="Session controls">
              <div className="border-b border-[#171525]/10 px-4 py-2"><p className="mb-1 font-mono text-[10px] tracking-[0.16em] text-[#9f5d50] uppercase">Host / Room index</p><h2 className="text-base font-bold">Session Controls</h2></div>
              {lifecycleError && <div className="mx-5 mt-4 rounded-md bg-[#c97967]/12 p-3 text-[#9f5d50]" role="alert">{lifecycleError}</div>}
              <nav className="flex flex-wrap gap-2 p-2" aria-label="Session actions">
                {sessionStatus === "CREATED" && <button className="group inline-flex items-center gap-2 rounded-lg bg-[#c97967] px-3 py-1.5 text-xs font-bold text-[#171525] transition hover:bg-[#aeb98a] disabled:cursor-not-allowed disabled:opacity-50" type="button" onClick={handleStart} disabled={!canStart || isStarting} aria-label={isStarting ? "Starting Session..." : "Start Session"}>{isStarting ? "Starting Session..." : "Start Session"}<span aria-hidden="true">-&gt;</span></button>}
                {sessionStatus === "LIVE" && <button className="group inline-flex items-center gap-2 rounded-lg bg-[#c97967] px-3 py-2 text-sm font-bold text-[#171525] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50" type="button" onClick={handleEnd} disabled={!canEnd || isEnding} aria-label={isEnding ? "Ending Session..." : "End Session"}>{isEnding ? "Ending Session..." : "End Session"}<span aria-hidden="true">-&gt;</span></button>}
              </nav>
            </section>
            <section className="rounded-2xl border border-[#87945a]/30 bg-[#e7eadb] p-3 text-[#171525]" aria-label="Participant join link"><div className="flex items-center justify-between gap-3"><div><p className="mb-1 font-mono text-[10px] tracking-[0.16em] text-[#687443] uppercase">Share / Room entry</p><h2 className="text-base font-bold">Participant Join Link</h2></div><button className="shrink-0 rounded-lg bg-[#aeb98a] px-3 py-2 text-xs font-bold text-[#171525]" type="button" onClick={handleCopyJoinLink} aria-label={copyStatus}>{copyStatus === "Copy join link" ? "Copy" : copyStatus}</button></div><input className="mt-3 min-h-9 w-full rounded-md border border-[#171525]/15 bg-white/70 px-3 font-mono text-[10px] text-[#171525]" type="text" value={joinLink} readOnly aria-label="Participant join link" /></section>
            <section className="rounded-2xl border border-[#171525]/12 bg-white p-3 text-[#171525]" aria-label="Playback controls"><div className="mb-2 flex items-start justify-between"><div><p className="mb-1 font-mono text-[10px] tracking-[0.16em] text-[#9f5d50] uppercase">Navigate / Timeline</p><h2 className="text-base font-bold">Playback Controls</h2></div><span className="font-mono text-xs text-[#9f5d50]">{Math.floor(playback.position)}s</span></div><div className="grid grid-cols-2 gap-2"><button className="rounded-lg bg-[#c97967] px-2.5 py-1.5 text-sm font-bold text-[#171525] transition hover:bg-[#aeb98a] disabled:opacity-50" type="button" onClick={handlePlay} disabled={!canControlPlayback} aria-label="Play"><span className="mr-2" aria-hidden="true">&gt;</span>Play</button><button className="rounded-lg border border-[#171525]/15 bg-transparent px-2.5 py-1.5 text-sm font-bold text-[#171525] transition hover:border-[#9f5d50] disabled:opacity-50" type="button" onClick={handlePause} disabled={!canControlPlayback} aria-label="Pause"><span className="mr-2" aria-hidden="true">||</span>Pause</button></div><div><label className="mt-2 block text-xs font-bold text-[#171525]/60" htmlFor="seek-position">Seek position</label><div className="mt-1 flex gap-2"><input id="seek-position" type="number" min="0" step="1" className="min-h-8 w-full rounded-md border border-[#171525]/15 bg-white/60 px-2" value={seekPosition} onChange={(event) => setSeekPosition(event.target.value)} disabled={!canControlPlayback} /><button className="rounded-md border border-[#171525]/15 bg-transparent px-2.5 py-1.5 text-sm font-bold text-[#171525] disabled:opacity-50" type="button" onClick={handleSeek} disabled={!canControlPlayback}>Seek</button></div></div></section>
          </aside>
        </div>
        {role !== "instructor" && <p className="mt-5 rounded-md bg-amber-50 p-3 text-amber-800" role="status">Instructor controls are unavailable.</p>}
      </div>
    </main>
  );
}
