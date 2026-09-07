import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getYouTubeVideoId } from "../../youtube/youtubeVideoId";

describe("getYouTubeVideoId", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("extracts the video ID from a standard YouTube watch URL", () => {
    expect(
      getYouTubeVideoId("https://www.youtube.com/watch?v=M7lc1UVf-VE"),
    ).toBe("M7lc1UVf-VE");
  });

  it("extracts the video ID from a youtu.be URL", () => {
    expect(getYouTubeVideoId("https://youtu.be/M7lc1UVf-VE")).toBe(
      "M7lc1UVf-VE",
    );
  });

  it("extracts the video ID from a mobile YouTube URL", () => {
    expect(
      getYouTubeVideoId("https://m.youtube.com/watch?v=M7lc1UVf-VE&t=30"),
    ).toBe("M7lc1UVf-VE");
  });

  it("extracts the video ID when extra query parameters are present", () => {
    expect(
      getYouTubeVideoId(
        "https://www.youtube.com/watch?v=M7lc1UVf-VE&list=test&index=2",
      ),
    ).toBe("M7lc1UVf-VE");
  });

  it("extracts the video ID from an embed URL", () => {
    expect(getYouTubeVideoId("https://www.youtube.com/embed/M7lc1UVf-VE")).toBe(
      "M7lc1UVf-VE",
    );
  });

  it("returns null for an unsupported hostname", () => {
    expect(
      getYouTubeVideoId("https://example.com/watch?v=M7lc1UVf-VE"),
    ).toBeNull();
  });

  it("returns null when a YouTube URL has no video ID", () => {
    expect(getYouTubeVideoId("https://www.youtube.com/watch")).toBeNull();
  });

  it("returns null for an invalid URL", () => {
    expect(getYouTubeVideoId("not-a-url")).toBeNull();
  });
});
