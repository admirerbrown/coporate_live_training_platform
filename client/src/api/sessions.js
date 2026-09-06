import { request } from "./request";

export function createSession({ name, youtubeUrl }) {
  return request(
    "/api/sessions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name,
        youtubeUrl,
      }),
    },
    {
      fallbackMessage: "Failed to create session",
    },
  );
}
