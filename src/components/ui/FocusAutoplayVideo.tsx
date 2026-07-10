import {
  createContext,
  useContext,
  useEffect,
  useRef,
  type ReactNode,
  type VideoHTMLAttributes,
} from "react";

const defaultFocusThreshold = 0.6;
const VideoAutoplayBlockedContext = createContext(false);

type FocusVideoState = {
  blocked: boolean;
  ratio: number;
  threshold: number;
};

const focusVideos = new Map<HTMLVideoElement, FocusVideoState>();
let activeFocusVideo: HTMLVideoElement | undefined;
let focusUpdateQueued = false;
let visibilityListenerAttached = false;

export function VideoAutoplayPriorityProvider({
  blocked,
  children,
}: {
  blocked: boolean;
  children: ReactNode;
}) {
  return (
    <VideoAutoplayBlockedContext.Provider value={blocked}>
      {children}
    </VideoAutoplayBlockedContext.Provider>
  );
}

type FocusAutoplayVideoProps = Omit<
  VideoHTMLAttributes<HTMLVideoElement>,
  "autoPlay"
> & {
  autoplayBlocked?: boolean | undefined;
  focusThreshold?: number | undefined;
};

export function FocusAutoplayVideo({
  autoplayBlocked = false,
  controls = true,
  focusThreshold = defaultFocusThreshold,
  muted = true,
  onPlay,
  playsInline = true,
  preload = "metadata",
  ...props
}: FocusAutoplayVideoProps) {
  const contextBlocked = useContext(VideoAutoplayBlockedContext);
  const blocked = contextBlocked || autoplayBlocked;
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const normalizedThreshold = Math.min(1, Math.max(0.25, focusThreshold));

  useEffect(() => {
    const video = videoRef.current;

    if (!video || typeof IntersectionObserver === "undefined") {
      return undefined;
    }

    focusVideos.set(video, {
      blocked: false,
      ratio: 0,
      threshold: normalizedThreshold,
    });
    attachVisibilityListener();

    const observer = new IntersectionObserver(
      ([entry]) => {
        const state = focusVideos.get(video);

        if (!state) {
          return;
        }

        state.ratio = entry?.isIntersecting ? entry.intersectionRatio : 0;
        scheduleFocusVideoUpdate();
      },
      {
        threshold: [0, 0.25, 0.5, normalizedThreshold, 0.75, 1],
      },
    );

    observer.observe(video);
    scheduleFocusVideoUpdate();

    return () => {
      observer.disconnect();
      focusVideos.delete(video);

      if (activeFocusVideo === video) {
        video.pause();
        activeFocusVideo = undefined;
      }

      detachVisibilityListenerWhenIdle();
      scheduleFocusVideoUpdate();
    };
  }, [normalizedThreshold]);

  useEffect(() => {
    const video = videoRef.current;

    if (!video) {
      return;
    }

    const state = focusVideos.get(video);

    if (state) {
      state.blocked = blocked;
      state.threshold = normalizedThreshold;
    }

    if (blocked) {
      video.pause();
    }

    scheduleFocusVideoUpdate();
  }, [blocked, normalizedThreshold]);

  return (
    <video
      {...props}
      ref={videoRef}
      controls={controls}
      muted={muted}
      playsInline={playsInline}
      preload={preload}
      data-focus-autoplay="true"
      data-focus-autoplay-blocked={blocked ? "true" : "false"}
      onPlay={(event) => {
        const video = event.currentTarget;
        pauseOtherFocusVideos(video);
        activeFocusVideo = video;

        onPlay?.(event);
      }}
    />
  );
}

function scheduleFocusVideoUpdate() {
  if (focusUpdateQueued) {
    return;
  }

  focusUpdateQueued = true;
  queueMicrotask(updateFocusedVideo);
}

function updateFocusedVideo() {
  focusUpdateQueued = false;

  if (typeof document !== "undefined" && document.visibilityState !== "visible") {
    pauseOtherFocusVideos();
    activeFocusVideo = undefined;
    return;
  }

  let candidate: HTMLVideoElement | undefined;
  let candidateRatio = 0;

  focusVideos.forEach((state, video) => {
    if (
      !state.blocked &&
      state.ratio >= state.threshold &&
      state.ratio > candidateRatio
    ) {
      candidate = video;
      candidateRatio = state.ratio;
    }
  });

  pauseOtherFocusVideos(candidate);
  activeFocusVideo = candidate;

  if (candidate?.paused) {
    void candidate.play().catch(() => undefined);
  }
}

function pauseOtherFocusVideos(exception?: HTMLVideoElement) {
  focusVideos.forEach((_state, video) => {
    if (video !== exception) {
      video.pause();
    }
  });
}

function handleDocumentVisibilityChange() {
  scheduleFocusVideoUpdate();
}

function attachVisibilityListener() {
  if (visibilityListenerAttached || typeof document === "undefined") {
    return;
  }

  document.addEventListener("visibilitychange", handleDocumentVisibilityChange);
  visibilityListenerAttached = true;
}

function detachVisibilityListenerWhenIdle() {
  if (
    !visibilityListenerAttached ||
    focusVideos.size > 0 ||
    typeof document === "undefined"
  ) {
    return;
  }

  document.removeEventListener("visibilitychange", handleDocumentVisibilityChange);
  visibilityListenerAttached = false;
}
