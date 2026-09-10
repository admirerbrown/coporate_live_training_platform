import CreateSessionForm from "../components/sessions/CreateSessionForm";

export default function CreateSessionPage({ onSessionCreated }) {
  return (
    <main className="h-screen overflow-hidden bg-paper text-ink">
      <div className="mx-auto grid h-full lg:grid-cols-[35fr_65fr]">
        <section className="relative hidden overflow-hidden bg-forest p-12 text-white lg:flex lg:flex-col lg:justify-between">
          <div className="absolute -right-28 -top-28 size-80 rounded-full border border-white/10" aria-hidden="true" />
          <div className="absolute bottom-20 right-12 size-36 rounded-full border border-teal/60" aria-hidden="true" />
          <div className="relative"><span className="inline-grid size-10 place-items-center rounded-xl bg-teal font-display text-sm font-bold">CT</span><span className="ml-3 text-sm font-semibold tracking-wide text-white/75 uppercase">Corporate Training</span></div>
          <div className="relative max-w-md">
            <p className="mb-5 font-mono text-xs tracking-[0.18em] text-teal-soft uppercase">Live learning, aligned</p>
            <h2 className="text-5xl font-semibold leading-[0.98] tracking-tight">Bring the room into focus.</h2>
            <p className="mt-6 max-w-sm text-base leading-relaxed text-white/65">Create a shared training space where every participant sees the same lesson, at the same moment.</p>
          </div>
          <p className="relative mb-0 text-xs text-white/40">LIVE TRAINING / 01</p>
        </section>
        <section className="relative flex items-center overflow-hidden px-5 py-12 sm:px-12 lg:px-28 xl:px-36">
          <div className="pointer-events-none absolute right-0 top-0 z-0 size-72 rounded-bl-full bg-teal-soft" aria-hidden="true" />
          <div className="relative z-10 w-full max-w-135">
            <div className="mb-9 lg:hidden"><span className="inline-grid size-9 place-items-center rounded-lg bg-teal text-xs font-bold text-white">CT</span></div>
            <p className="mb-3 text-xs font-extrabold tracking-[0.12em] text-teal uppercase">Instructor workspace</p>
            <h1 className="mb-3 text-3xl font-bold leading-tight tracking-tight sm:text-5xl">Create a Training Session</h1>
            <p className="mb-9 max-w-lg text-lg leading-relaxed text-muted">Start a live training session by adding a name and YouTube video.</p>
            <CreateSessionForm onSuccess={onSessionCreated} />
          </div>
        </section>
      </div>
    </main>
  );
}
