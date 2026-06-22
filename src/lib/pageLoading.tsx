import { AnimatePresence, motion } from "motion/react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useLocation } from "react-router";
import { BrandMark } from "../components/BrandLogo";
import { cn } from "./classNames";
import { fluidEase, softSpring } from "./motionPresets";
import { PageLoadingContext } from "./pageLoadingContext";

const pageLoadingGraceMs = 1000;

export function PageLoadingProvider({ children }: { children: ReactNode }) {
  const location = useLocation();
  const [activeTasks, setActiveTasks] = useState<Set<symbol>>(() => new Set());
  const locationKey = pageLoadingLocationKey(location.pathname, location.search);
  const routeLabel = pageLoadingLabel(location.pathname);
  const [graceState, setGraceState] = useState(() => ({
    complete: false,
    key: locationKey,
  }));
  const [assetState, setAssetState] = useState(() => ({
    key: locationKey,
    ready: false,
  }));
  const graceComplete = graceState.key === locationKey && graceState.complete;
  const routeAssetsReady = assetState.key === locationKey && assetState.ready;

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setGraceState({ complete: true, key: locationKey });
    }, pageLoadingGraceMs);

    return () => {
      window.clearTimeout(timer);
    };
  }, [locationKey]);

  useEffect(() => {
    if (!graceComplete || activeTasks.size > 0) {
      return undefined;
    }

    let active = true;

    waitForRouteAssets().then(() => {
      if (active) {
        setAssetState({ key: locationKey, ready: true });
      }
    });

    return () => {
      active = false;
    };
  }, [activeTasks.size, graceComplete, locationKey]);

  const registerTask = useCallback(() => {
    const id = Symbol("page-load-task");
    let disposed = false;

    setActiveTasks((current) => {
      const next = new Set(current);
      next.add(id);
      return next;
    });

    return () => {
      if (disposed) {
        return;
      }

      disposed = true;
      setActiveTasks((current) => {
        if (!current.has(id)) {
          return current;
        }

        const next = new Set(current);
        next.delete(id);
        return next;
      });
    };
  }, []);

  const value = useMemo(() => ({ registerTask }), [registerTask]);
  const visible = activeTasks.size > 0 || !graceComplete || !routeAssetsReady;

  return (
    <PageLoadingContext.Provider value={value}>
      {children}
      <PageLoadingOverlay
        activeTaskCount={activeTasks.size}
        label={routeLabel}
        visible={visible}
      />
    </PageLoadingContext.Provider>
  );
}

function PageLoadingOverlay({
  activeTaskCount,
  label,
  visible,
}: {
  activeTaskCount: number;
  label: string;
  visible: boolean;
}) {
  return (
    <AnimatePresence>
      {visible ? (
        <motion.div
          key="page-loading"
          className="fixed inset-0 z-[90] grid place-items-center overflow-hidden bg-canvas px-5 text-text"
          data-testid="page-loading-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.32, ease: fluidEase }}
          role="status"
          aria-live="polite"
          aria-busy="true"
        >
          <div className="absolute inset-0 bg-page-wash" />
          <motion.div
            className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-accent/18 to-transparent"
            initial={{ opacity: 0, y: -28 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -14 }}
            transition={softSpring}
          />
          <motion.div
            className="relative flex w-full max-w-sm flex-col items-center gap-6 text-center"
            initial={{ opacity: 0, y: 18, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.985 }}
            transition={softSpring}
          >
            <div className="relative grid size-28 place-items-center">
              <motion.div
                className="absolute inset-0 rounded-full border border-accent/28"
                animate={{ rotate: 360, scale: [1, 1.04, 1] }}
                transition={{
                  duration: 2.2,
                  ease: "linear",
                  repeat: Infinity,
                }}
              />
              <motion.div
                className="absolute inset-3 rounded-full border border-line-strong border-t-accent"
                animate={{ rotate: -360 }}
                transition={{
                  duration: 1.55,
                  ease: "linear",
                  repeat: Infinity,
                }}
              />
              <motion.div
                animate={{ scale: [1, 1.04, 1] }}
                style={{ transformOrigin: "center" }}
                transition={{
                  duration: 1.8,
                  ease: fluidEase,
                  repeat: Infinity,
                }}
              >
                <BrandMark
                  className="shadow-lift"
                  data-testid="route-loading-brand"
                  shape="circle"
                  size="lg"
                  variant="pink"
                />
              </motion.div>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-accent-strong">
                thia.lol
              </p>
              <h1 className="text-2xl font-semibold tracking-normal text-text">
                Loading {label}
              </h1>
              <p className="text-sm leading-6 text-muted">
                Getting everything ready before the page opens.
              </p>
            </div>

            <div
              className="flex items-center gap-2"
              aria-label={
                activeTaskCount > 0
                  ? `${activeTaskCount} loading task${activeTaskCount === 1 ? "" : "s"} remaining`
                  : "Finalizing page transition"
              }
            >
              {[0, 1, 2].map((index) => (
                <motion.span
                  key={index}
                  className={cn(
                    "block size-2 rounded-full",
                    index === 1 ? "bg-accent" : "bg-line-strong",
                  )}
                  animate={{ y: [0, -6, 0], opacity: [0.45, 1, 0.45] }}
                  transition={{
                    duration: 0.92,
                    ease: fluidEase,
                    repeat: Infinity,
                    delay: index * 0.14,
                  }}
                />
              ))}
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function pageLoadingLabel(pathname: string): string {
  if (pathname === "/") {
    return "home";
  }

  if (pathname === "/discover") {
    return "Discover";
  }

  if (pathname === "/search") {
    return "Search";
  }

  if (pathname === "/rooms") {
    return "Rooms";
  }

  if (pathname.startsWith("/rooms/")) {
    return "room";
  }

  if (pathname === "/chat") {
    return "Chat";
  }

  if (pathname === "/notifications") {
    return "Notifications";
  }

  if (pathname === "/settings") {
    return "Settings";
  }

  if (pathname === "/onboarding") {
    return "setup";
  }

  if (pathname.includes("/posts/")) {
    return "post";
  }

  if (pathname.startsWith("/@")) {
    return "profile";
  }

  if (pathname === "/login" || pathname === "/register") {
    return "account";
  }

  return "page";
}

function pageLoadingLocationKey(pathname: string, search: string): string {
  if (pathname === "/search") {
    return pathname;
  }

  return `${pathname}${search}`;
}

async function waitForRouteAssets() {
  const settlePromises: Array<Promise<unknown>> = [nextPaint(), nextPaint()];

  if ("fonts" in document) {
    settlePromises.push(document.fonts.ready.catch(() => undefined));
  }

  const scope = document.querySelector("main") ?? document.body;
  const images = Array.from(scope.querySelectorAll("img")).filter(
    (image) =>
      image.loading !== "lazy" &&
      !image.complete &&
      image.currentSrc.trim() !== "",
  );

  settlePromises.push(
    ...images.map(
      (image) =>
        new Promise<void>((resolve) => {
          function finish() {
            image.removeEventListener("load", finish);
            image.removeEventListener("error", finish);
            resolve();
          }

          image.addEventListener("load", finish, { once: true });
          image.addEventListener("error", finish, { once: true });
        }),
    ),
  );

  await Promise.race([
    Promise.allSettled(settlePromises),
    new Promise((resolve) => window.setTimeout(resolve, 1800)),
  ]);
}

function nextPaint() {
  return new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => {
      resolve();
    });
  });
}
