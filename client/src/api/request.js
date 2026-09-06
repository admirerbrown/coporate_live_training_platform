const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "").replace(
  /\/$/,
  "",
);

export async function request(
  path,
  options = {},
  { fallbackMessage = "Request failed" } = {},
) {
  const response = await fetch(`${API_BASE_URL}${path}`, options);

  if (response.ok) {
    return response.json();
  }

  let message = fallbackMessage;

  try {
    const body = await response.json();

    if (body?.error) {
      message = body.error;
    }
  } catch {
    // Keep the caller's fallback message.
  }

  throw new Error(message);
}
