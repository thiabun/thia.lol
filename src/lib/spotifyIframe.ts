export type SpotifyIframeApi = {
  createController: (
    element: HTMLElement,
    options: {
      height: string;
      theme?: "0" | "1";
      uri: string;
      width: string;
    },
    callback: (controller: SpotifyEmbedController) => void,
  ) => void;
};

export type SpotifyEmbedController = {
  addListener?: (
    event: "playback_started" | "playback_update",
    listener: (event: SpotifyPlaybackEvent) => void,
  ) => void;
  destroy?: () => void;
  pause?: () => Promise<void> | void;
  play?: () => Promise<void> | void;
  removeListener?: (
    event: "playback_started" | "playback_update",
    listener: (event: SpotifyPlaybackEvent) => void,
  ) => void;
  resume?: () => Promise<void> | void;
  togglePlay?: () => Promise<void> | void;
};

export type SpotifyPlaybackEvent = {
  data?: {
    duration?: number;
    isBuffering?: boolean;
    isPaused?: boolean;
    playingURI?: string;
    position?: number;
  };
};

export type SpotifyPlaybackProgress = {
  duration: number;
  isBuffering: boolean;
  isPaused: boolean;
  known: boolean;
  position: number;
};

type SpotifyPlayableResource = {
  provider?: string | null | undefined;
  resourceId?: string | null | undefined;
  resourceType?: string | null | undefined;
};

const spotifyPlayableResourceTypes = new Set([
  "album",
  "artist",
  "episode",
  "playlist",
  "show",
  "track",
]);

export const emptySpotifyPlaybackProgress: SpotifyPlaybackProgress = {
  duration: 0,
  isBuffering: false,
  isPaused: true,
  known: false,
  position: 0,
};

declare global {
  interface Window {
    __thiaSpotifyIframeApi?: SpotifyIframeApi | undefined;
    onSpotifyIframeApiReady?: ((api: SpotifyIframeApi) => void) | undefined;
  }
}

let spotifyIframeApiPromise: Promise<SpotifyIframeApi> | undefined;

export function loadSpotifyIframeApi(): Promise<SpotifyIframeApi> {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return Promise.reject(new Error("Spotify embeds require a browser."));
  }

  if (window.__thiaSpotifyIframeApi) {
    return Promise.resolve(window.__thiaSpotifyIframeApi);
  }

  if (spotifyIframeApiPromise) {
    return spotifyIframeApiPromise;
  }

  const promise = new Promise<SpotifyIframeApi>((resolve, reject) => {
    const existingCallback = window.onSpotifyIframeApiReady;
    const timeout = window.setTimeout(() => {
      reject(new Error("Spotify embed API did not load."));
    }, 10000);

    window.onSpotifyIframeApiReady = (api) => {
      window.clearTimeout(timeout);
      window.__thiaSpotifyIframeApi = api;
      existingCallback?.(api);
      resolve(api);
    };

    const existingScript = document.querySelector<HTMLScriptElement>(
      'script[data-thia-spotify-iframe-api="true"]',
    );

    if (existingScript) {
      existingScript.addEventListener("error", () => {
        window.clearTimeout(timeout);
        reject(new Error("Spotify embed API failed to load."));
      }, { once: true });
      return;
    }

    const script = document.createElement("script");
    script.async = true;
    script.dataset.thiaSpotifyIframeApi = "true";
    script.src = "https://open.spotify.com/embed/iframe-api/v1";
    script.addEventListener("error", () => {
      window.clearTimeout(timeout);
      reject(new Error("Spotify embed API failed to load."));
    }, { once: true });
    document.body.appendChild(script);
  }).catch((error) => {
    spotifyIframeApiPromise = undefined;
    throw error;
  });
  spotifyIframeApiPromise = promise;

  return promise;
}

export function attachSpotifyPlaybackListeners(
  controller: SpotifyEmbedController,
  onProgress: (progress: SpotifyPlaybackProgress) => void,
): () => void {
  if (!controller.addListener) {
    return () => {};
  }

  const handlePlaybackUpdate = (event: SpotifyPlaybackEvent) => {
    onProgress(spotifyPlaybackProgressFromEvent(event));
  };

  controller.addListener("playback_update", handlePlaybackUpdate);

  return () => {
    controller.removeListener?.("playback_update", handlePlaybackUpdate);
  };
}

export function spotifyPlaybackProgressFromEvent(
  event: SpotifyPlaybackEvent,
): SpotifyPlaybackProgress {
  const rawDuration = event.data?.duration;
  const duration =
    typeof rawDuration === "number" && Number.isFinite(rawDuration)
      ? Math.max(0, rawDuration)
      : 0;
  const rawPosition = event.data?.position;
  const position =
    typeof rawPosition === "number" && Number.isFinite(rawPosition)
      ? Math.min(duration, Math.max(0, rawPosition))
      : 0;

  return {
    duration,
    isBuffering: event.data?.isBuffering === true,
    isPaused: event.data?.isPaused !== false,
    known: duration > 0,
    position,
  };
}

export function spotifyPlaybackProgressPercent(progress: SpotifyPlaybackProgress): number {
  if (!progress.known || progress.duration <= 0) {
    return 0;
  }

  return Math.min(100, Math.max(0, (progress.position / progress.duration) * 100));
}

export function formatSpotifyPlaybackTime(value: number): string {
  const totalSeconds = Math.max(0, Math.floor(value / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export async function playSpotifyEmbed(
  controller: SpotifyEmbedController,
): Promise<boolean> {
  try {
    if (controller.play) {
      await controller.play();
      return true;
    }

    if (controller.resume) {
      await controller.resume();
      return true;
    }

    await controller.togglePlay?.();
    return true;
  } catch {
    return false;
  }
}

export async function toggleSpotifyPlayback(
  controller: SpotifyEmbedController,
  playing: boolean,
): Promise<boolean | undefined> {
  try {
    if (playing && controller.pause) {
      await controller.pause();
      return false;
    }

    if (controller.togglePlay) {
      await controller.togglePlay();
      return !playing;
    }

    return (await playSpotifyEmbed(controller)) ? true : undefined;
  } catch {
    return undefined;
  }
}

export function spotifyResourceUri(
  resource: SpotifyPlayableResource,
): string | undefined {
  const resourceType = resource.resourceType;
  const resourceId = resource.resourceId;

  if (
    resource.provider !== "spotify" ||
    typeof resourceType !== "string" ||
    typeof resourceId !== "string" ||
    !spotifyPlayableResourceTypes.has(resourceType) ||
    resourceId.trim() === ""
  ) {
    return undefined;
  }

  return `spotify:${resourceType}:${resourceId}`;
}
