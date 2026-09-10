import { useState } from "react";

import { useTrainingSession } from "../hooks/useTrainingSession";

import YouTubePlayer from "../components/player/YouTubePlayer";

export default function ParticipantSessionPage({
  session,
  participantName,
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

  const playbackLabel = playback.isPlaying ? "Playing now" : "Paused by host";
  const displayParticipantName = participantName || "Name unavailable";
  const [videoDuration, setVideoDuration] = useState(0);
  const completionPercentage = videoDuration
    ? Math.min(100, Math.round((playback.position / videoDuration) * 100))
    : 0;

  return (
    <main className="relative h-dvh overflow-hidden bg-[#171525] px-4 py-5 text-white sm:px-6 sm:py-7">
      <div className="pointer-events-none absolute -right-32 -top-40 size-120 rounded-full border border-[#ff765f]/25" aria-hidden="true" />
      <div className="pointer-events-none absolute -bottom-72 -left-48 size-128 rounded-full border border-[#c8f169]/15" aria-hidden="true" />
      <div className="relative mx-auto flex h-full min-h-0 max-w-300 flex-col">
        <header className="relative mb-4 grid shrink-0 gap-4 border-b border-white/12 pb-4 sm:mb-6 sm:grid-cols-[minmax(150px,0.3fr)_minmax(0,1fr)] sm:gap-6 sm:pb-5">
          <div className="flex min-w-0 flex-col justify-between gap-2 border-b border-white/10 pb-3 sm:border-b-0 sm:border-r sm:pb-0 sm:pr-6">
            <div className="flex items-center gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#ff765f] font-display text-sm font-bold text-[#171525] shadow-[0_0_0_5px_rgba(255,118,95,0.15)]">CT</span><span className="whitespace-nowrap font-mono text-[10px] tracking-[0.24em] text-[#ffd7cf] uppercase">Participant room</span></div>
            <div className="flex flex-wrap items-center gap-4"><span className="inline-flex shrink-0 items-center gap-2 rounded-full border border-[#ff765f]/50 bg-[#ff765f]/15 px-3 py-1 font-mono text-[10px] font-bold tracking-[0.12em] text-[#ffd7cf] uppercase"><span className="size-1.5 rounded-full bg-[#c8f169] shadow-[0_0_0_4px_rgba(200,241,105,0.18)]" />{statusLabel}</span><p className="hidden items-center gap-2 font-mono text-xs text-white/55 sm:flex"><span className="size-2 rounded-full bg-[#c8f169] shadow-[0_0_0_4px_rgba(200,241,105,0.2)]" /><strong className="text-[#e9ffc0]">{connectionStatus}</strong></p></div>
          </div>
          <div className="flex min-w-0 items-center justify-end sm:pl-1">
            <p className="shrink-0 whitespace-nowrap border-l border-white/15 pl-4 font-mono text-[10px] text-[#ffd7cf] sm:pl-5 sm:text-xs"><span className="mr-1 text-white/40">Participant:</span>{" "}{displayParticipantName}</p>
          </div>
          <div className="min-w-0 text-center sm:absolute sm:left-1/2 sm:top-1/2 sm:w-[min(52%,30rem)] sm:-translate-x-1/2 sm:-translate-y-1/2">
            <h1 aria-label={session.name} className="truncate font-display text-xl font-bold leading-tight tracking-tight text-white sm:text-2xl"><span className="mr-2 text-white/40">Session:</span>{" "}{session.name}</h1>
            <p className="mt-2 truncate font-mono text-[10px] tracking-[0.14em] text-white/45 uppercase">ROOM / <strong className="text-white/70">{session.id}</strong></p>
          </div>
        </header>

        <div className="flex min-h-0 flex-1 flex-col gap-3 lg:h-full lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(240px,0.29fr)] lg:items-stretch lg:gap-5">
          <section className="flex min-h-32 min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-white/12 bg-[#25243a] p-2 shadow-[0_30px_90px_rgba(0,0,0,0.32)] lg:h-full lg:min-h-0" aria-label="Training video">
            <div className="mb-2 flex items-center justify-between px-2 pt-1 font-mono text-[10px] tracking-[0.14em] uppercase"><span className="text-white/45">Broadcast / {statusLabel}</span><span className={playback.isPlaying ? "text-[#c8f169]" : "font-bold text-[#ff765f]"}>{playbackLabel}</span></div>
            <YouTubePlayer
              className="min-h-0 h-full w-full flex-1 aspect-auto overflow-hidden rounded-lg"
              videoUrl={session.youtubeUrl}
              playback={playback}
              onDurationChange={setVideoDuration}
            />
          </section>

          <aside className="grid shrink-0 min-h-0 min-w-0 grid-cols-2 gap-3 overflow-hidden lg:grid-cols-1" aria-label="Session information">
            <section className="rounded-2xl border border-[#ff765f]/35 bg-[#3a2c42] p-3 shadow-[0_20px_50px_rgba(0,0,0,0.22)] lg:p-5">
              <p className="mb-2 font-mono text-[10px] tracking-[0.18em] text-[#ffd7cf] uppercase lg:mb-10">01 / In the room</p>
              <p className="font-display text-3xl font-bold text-white lg:text-4xl">{completionPercentage}%</p>
              <p className="mt-2 text-xs text-white/60 lg:text-sm">Lesson complete</p>
              <div className="mt-3 hidden h-1 overflow-hidden rounded-full bg-white/15 lg:mt-6 lg:block"><div className="h-full rounded-full bg-[#c8f169] transition-[width]" style={{ width: `${completionPercentage}%` }} /></div>
            </section>
            <section className="rounded-2xl border border-white/12 bg-white/[0.07] p-4 lg:p-5">
              <p className="mb-3 font-mono text-[10px] tracking-[0.18em] text-[#ffd7cf] uppercase">02 / Your view</p>
              <p className="text-sm font-semibold text-white lg:text-lg">{role === "participant" ? "You are viewing this training session." : "Participant access is initializing."}</p>
              <p className="mt-2 hidden text-sm leading-relaxed text-white/50 lg:mt-3 lg:block">The instructor controls playback for everyone in this room. Your view follows along automatically.</p>
            </section>
            <p className="col-span-2 hidden px-1 pt-0 font-mono text-[10px] tracking-[0.16em] text-white/35 uppercase lg:col-span-1 lg:block lg:pt-2">Synchronized learning / {statusLabel}</p>
          </aside>
        </div>
      </div>
    </main>
  );
};
