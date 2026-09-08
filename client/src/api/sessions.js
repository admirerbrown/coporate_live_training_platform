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

export function getSession(sessionId) {
  return request(
    `/api/sessions/${sessionId}`,
    {
      method: "GET",
    },
    {
      fallbackMessage: "Failed to get session",
    },
  );
}

export function joinSession(sessionId, participantName) {
  return request(
    `/api/sessions/${sessionId}/join`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        participantName,
      }),
    },
    {
      fallbackMessage: "Failed to join session",
    },
  );
}
export function startSession(sessionId, instructorToken) {
  return request(
    `/api/sessions/${sessionId}/start`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${instructorToken}`,
      },
    },
    {
      fallbackMessage: "Failed to start session",
    },
  );
}

export function endSession(sessionId, instructorToken) {
  return request(
    `/api/sessions/${sessionId}/end`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${instructorToken}`,
      },
    },
    {
      fallbackMessage: "Failed to end session",
    },
  );
}
