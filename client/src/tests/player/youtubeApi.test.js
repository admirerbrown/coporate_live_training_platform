import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { loadYouTubeIframeApi } from "../../youtube/youtubeApi";

const SCRIPT_SELECTOR = 'script[src="https://www.youtube.com/iframe_api"]';

describe("YouTube IFrame API loader", () => {
  beforeEach(() => {
    vi.resetAllMocks();

    delete window.YT;
    delete window.onYouTubeIframeAPIReady;

    document
      .querySelectorAll(SCRIPT_SELECTOR)
      .forEach((script) => script.remove());
  });

  afterEach(() => {
    delete window.YT;
    delete window.onYouTubeIframeAPIReady;

    document
      .querySelectorAll(SCRIPT_SELECTOR)
      .forEach((script) => script.remove());
  });

  it("resolves immediately when the API is already available", async () => {
    const youtubeApi = {
      Player: vi.fn(),
    };

    window.YT = youtubeApi;

    await expect(loadYouTubeIframeApi()).resolves.toBe(youtubeApi);

    expect(document.querySelector(SCRIPT_SELECTOR)).not.toBeInTheDocument();
  });

  it("adds the YouTube IFrame API script and resolves when the API is ready", async () => {
    const promise = loadYouTubeIframeApi();

    const script = document.querySelector(SCRIPT_SELECTOR);

    expect(script).toBeInTheDocument();
    expect(script.async).toBe(true);

    const youtubeApi = {
      Player: vi.fn(),
    };

    window.YT = youtubeApi;

    expect(window.onYouTubeIframeAPIReady).toEqual(expect.any(Function));

    window.onYouTubeIframeAPIReady();

    await expect(promise).resolves.toBe(youtubeApi);
  });

  it("reuses the same in-flight loading request", async () => {
    const first = loadYouTubeIframeApi();
    const second = loadYouTubeIframeApi();

    expect(first).toBe(second);

    expect(document.querySelectorAll(SCRIPT_SELECTOR)).toHaveLength(1);

    const youtubeApi = {
      Player: vi.fn(),
    };

    window.YT = youtubeApi;

    window.onYouTubeIframeAPIReady();

    await expect(first).resolves.toBe(youtubeApi);

    await expect(second).resolves.toBe(youtubeApi);
  });

  it("clears the loading request after a successful load", async () => {
    const first = loadYouTubeIframeApi();

    window.YT = {
      Player: vi.fn(),
    };

    window.onYouTubeIframeAPIReady();

    await expect(first).resolves.toBe(window.YT);

    delete window.YT;

    const second = loadYouTubeIframeApi();

    expect(second).not.toBe(first);

    expect(document.querySelectorAll(SCRIPT_SELECTOR)).toHaveLength(2);

    const secondScript = document.querySelectorAll(SCRIPT_SELECTOR)[1];

    expect(secondScript).toBeInTheDocument();

    window.YT = {
      Player: vi.fn(),
    };

    window.onYouTubeIframeAPIReady();

    await expect(second).resolves.toBe(window.YT);

    secondScript.remove();
  });

  it("clears the failed request and allows a clean retry", async () => {
    const first = loadYouTubeIframeApi();

    const firstScript = document.querySelector(SCRIPT_SELECTOR);

    expect(firstScript).toBeInTheDocument();

    firstScript.onerror?.();

    await expect(first).rejects.toThrow("Failed to load YouTube IFrame API");

    expect(document.querySelectorAll(SCRIPT_SELECTOR)).toHaveLength(0);

    const second = loadYouTubeIframeApi();

    expect(second).not.toBe(first);

    expect(document.querySelectorAll(SCRIPT_SELECTOR)).toHaveLength(1);

    const secondScript = document.querySelector(SCRIPT_SELECTOR);

    expect(secondScript).toBeInTheDocument();

    window.YT = {
      Player: vi.fn(),
    };

    window.onYouTubeIframeAPIReady();

    await expect(second).resolves.toBe(window.YT);

    expect(document.querySelectorAll(SCRIPT_SELECTOR)).toHaveLength(1);
  });
});
