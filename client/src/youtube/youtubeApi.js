const YOUTUBE_IFRAME_API_URL = "https://www.youtube.com/iframe_api";

let loadingPromise = null;

export function loadYouTubeIframeApi() {
  if (window.YT) {
    return Promise.resolve(window.YT);
  }

  if (loadingPromise) {
    return loadingPromise;
  }

  loadingPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");

    let settled = false;

    function cleanup() {
      script.onerror = null;

      if (window.onYouTubeIframeAPIReady === handleReady) {
        window.onYouTubeIframeAPIReady = null;
      }
    }

    function succeed() {
      if (settled) {
        return;
      }

      settled = true;

      const api = window.YT;

      cleanup();

      if (!api) {
        reject(
          new Error(
            "YouTube IFrame API became ready without exposing window.YT",
          ),
        );
        return;
      }

      resolve(api);
    }

    function fail() {
      if (settled) {
        return;
      }

      settled = true;

      script.remove();
      cleanup();

      reject(new Error("Failed to load YouTube IFrame API"));
    }

    function handleReady() {
      succeed();
    }

    script.src = YOUTUBE_IFRAME_API_URL;
    script.async = true;
    script.onerror = fail;

    window.onYouTubeIframeAPIReady = handleReady;

    document.head.appendChild(script);
  });

  loadingPromise = loadingPromise.finally(() => {
    loadingPromise = null;
  });

  return loadingPromise;
}
