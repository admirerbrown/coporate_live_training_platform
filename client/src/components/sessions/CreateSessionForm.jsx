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
    <form onSubmit={handleSubmit}>
      <div>
        <label htmlFor="session-name">Session name</label>

        <input
          id="session-name"
          name="name"
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
          disabled={submitting}
        />
      </div>

      <div>
        <label htmlFor="youtube-url">YouTube URL</label>

        <input
          id="youtube-url"
          name="youtubeUrl"
          type="url"
          value={youtubeUrl}
          onChange={(event) => setYoutubeUrl(event.target.value)}
          required
          disabled={submitting}
        />
      </div>

      {error && <div role="alert">{error}</div>}

      <button type="submit" disabled={submitting}>
        {submitting ? "Creating Session..." : "Create Session"}
      </button>
    </form>
  );
}
