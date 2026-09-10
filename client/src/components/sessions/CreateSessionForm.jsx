import { useState } from "react";

import { createSession } from "../../api/sessions";

export default function CreateSessionForm({ onSuccess }) {
  const [name, setName] = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState("");

  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");

  const submitting = status === "submitting";

  async function handleSubmit(event) {
    event.preventDefault();

    if (submitting) {
      return;
    }

    setStatus("submitting");
    setError("");

    try {
      const session = await createSession({
        name,
        youtubeUrl,
      });

      onSuccess(session);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create session");

      setStatus("idle");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="relative grid gap-5 overflow-hidden rounded-2xl border border-white/70 bg-white p-6 shadow-[0_24px_70px_rgba(18,60,58,0.14)] sm:p-8">
      <div className="absolute right-0 top-0 h-24 w-24 rounded-bl-full bg-teal-soft" aria-hidden="true" />
      <div className="relative grid gap-2">
        <label className="text-sm font-bold text-ink" htmlFor="session-name">Session name</label>

        <input
          id="session-name"
          name="name"
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
          disabled={submitting}
          className="min-h-11.5 w-full rounded-md border border-[#c9d6d4] bg-[#fbfcfc] px-3 text-ink"
        />
      </div>

      <div className="relative grid gap-2">
        <label className="text-sm font-bold text-ink" htmlFor="youtube-url">Video URL</label>

        <input
          id="youtube-url"
          name="youtubeUrl"
          type="url"
          value={youtubeUrl}
          onChange={(event) => setYoutubeUrl(event.target.value)}
          required
          disabled={submitting}
          className="min-h-11.5 w-full rounded-md border border-[#c9d6d4] bg-[#fbfcfc] px-3 text-ink"
        />
      </div>

      {error && <div className="rounded-md border border-red-200 bg-red-50 p-3 text-red-700" role="alert">{error}</div>}

      <button className="relative min-h-11.5 rounded-md bg-teal px-5 font-bold text-white shadow-lg shadow-forest/15 transition hover:-translate-y-0.5 hover:bg-forest disabled:cursor-not-allowed disabled:opacity-50" type="submit" disabled={submitting}>
        {submitting ? "Creating Session..." : "Create Session"}
      </button>
    </form>
  );
}
