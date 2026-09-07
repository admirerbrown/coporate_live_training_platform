export function getYouTubeVideoId(value) {
  if (typeof value !== "string") {
    return null;
  }
  let url;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  const hostname = url.hostname.toLowerCase();
  if (hostname === "youtu.be" || hostname === "www.youtu.be") {
    const id = url.pathname.split("/").filter(Boolean)[0];
    return id || null;
  }
  if (
    hostname === "youtube.com" ||
    hostname === "www.youtube.com" ||
    hostname === "m.youtube.com"
  ) {
    if (url.pathname === "/watch") {
      return url.searchParams.get("v") || null;
    }
    const embedMatch = url.pathname.match(/^\/embed\/([^/]+)/);
    if (embedMatch) {
      return embedMatch[1];
    }
  }
  return null;
}
