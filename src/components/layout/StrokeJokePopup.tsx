import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";
import { Button } from "../ui/Button";
import { ModalSheet } from "../ui/ModalSheet";

const strokeJokeCooldownStorageKey = "thia.strokeJoke.cooldownUntil:v1";
const strokeJokeSessionRollStorageKey = "thia.strokeJoke.roll:v1";
const strokeJokeCooldownMs = 14 * 24 * 60 * 60 * 1000;
const strokeJokeRollChance = 0.02;
const strokeJokeRollDelayMs = 2200;
const confettiDurationMs = 3200;

const legalAndSystemPaths = new Set([
  "/account-deletion",
  "/admin",
  "/ai-policy",
  "/appeals",
  "/accessibility",
  "/chat",
  "/community-guidelines",
  "/content-ownership",
  "/cookies",
  "/copyright",
  "/creator-marketplace",
  "/data-export",
  "/incident-response",
  "/law-enforcement",
  "/legal",
  "/legal/contact",
  "/login",
  "/moderation",
  "/monetization-ethics",
  "/no-dark-patterns",
  "/notifications",
  "/onboarding",
  "/privacy",
  "/refunds",
  "/register",
  "/safety",
  "/security",
  "/settings",
  "/terms",
  "/transparency",
  "/vulnerability-disclosure",
]);

const confettiColors = [
  "var(--app-accent)",
  "var(--accent-sun)",
  "var(--accent-frost)",
  "var(--accent-leaf)",
  "var(--accent-rose)",
];

const confettiPieces = Array.from({ length: 44 }, (_, index) => ({
  color: confettiColors[index % confettiColors.length],
  delay: (index % 11) * 0.045,
  drift: ((index * 43) % 90) - 45,
  duration: 1.7 + (index % 7) * 0.14,
  height: 9 + (index % 4) * 2,
  id: index,
  left: 3 + ((index * 37) % 94),
  rotate: ((index * 53) % 540) - 270,
  width: 5 + (index % 3) * 2,
}));

type StrokeJokePopupProps = {
  blocked: boolean;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  pathname: string;
};

export function StrokeJokePopup({
  blocked,
  onOpenChange,
  open,
  pathname,
}: StrokeJokePopupProps) {
  const [confettiBurst, setConfettiBurst] = useState(0);

  useEffect(() => {
    if (
      blocked ||
      open ||
      !strokeJokePathIsEligible(pathname) ||
      strokeJokeCooldownIsActive() ||
      strokeJokeSessionRollHasRun()
    ) {
      return;
    }

    const rollTimer = window.setTimeout(() => {
      markStrokeJokeSessionRoll();

      if (Math.random() < strokeJokeRollChance) {
        onOpenChange(true);
      }
    }, strokeJokeRollDelayMs);

    return () => {
      window.clearTimeout(rollTimer);
    };
  }, [blocked, onOpenChange, open, pathname]);

  useEffect(() => {
    if (confettiBurst === 0) {
      return;
    }

    const timer = window.setTimeout(() => {
      setConfettiBurst(0);
    }, confettiDurationMs);

    return () => {
      window.clearTimeout(timer);
    };
  }, [confettiBurst]);

  function handleCelebrate() {
    writeStrokeJokeCooldown();
    onOpenChange(false);
    setConfettiBurst((current) => current + 1);
  }

  return (
    <>
      <ModalSheet
        closeOnEscape={false}
        closeOnOutsideClick={false}
        mobile="dialog"
        onClose={handleCelebrate}
        open={open}
        panelClassName="max-w-sm"
        showCloseButton={false}
        size="sm"
        testId="stroke-joke-popup"
        title="Milestone unlocked"
      >
        <div className="space-y-5">
          <p className="text-base leading-7 text-text">
            Congrats on reaching 200000 strokes! Most people finish after only
            100!
          </p>
          <div className="flex justify-end">
            <Button type="button" onClick={handleCelebrate}>
              Celebrate!
            </Button>
          </div>
        </div>
      </ModalSheet>
      <StrokeJokeConfetti burst={confettiBurst} />
    </>
  );
}

function StrokeJokeConfetti({ burst }: { burst: number }) {
  const reducedMotion = useReducedMotion();

  return (
    <AnimatePresence>
      {burst > 0 ? (
        <motion.div
          key={burst}
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 z-[60] overflow-hidden"
          data-testid="stroke-joke-confetti"
          initial={{ opacity: 1 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
        >
          {confettiPieces.map((piece) => (
            <motion.span
              key={piece.id}
              className="absolute top-0 block rounded-[2px] shadow-soft"
              style={{
                backgroundColor: piece.color,
                height: piece.height,
                left: `${piece.left}%`,
                width: piece.width,
              }}
              initial={{
                opacity: 0,
                rotate: reducedMotion ? piece.rotate : 0,
                scale: reducedMotion ? 0.92 : 1,
                x: 0,
                y: reducedMotion ? 24 : -80,
              }}
              animate={
                reducedMotion
                  ? { opacity: [0, 1, 0], scale: [0.92, 1, 0.96] }
                  : {
                      opacity: [0, 1, 1, 0],
                      rotate: piece.rotate,
                      x: piece.drift,
                      y: "105vh",
                    }
              }
              transition={{
                delay: reducedMotion ? Math.min(piece.delay, 0.16) : piece.delay,
                duration: reducedMotion ? 0.7 : piece.duration,
                ease: "easeOut",
              }}
            />
          ))}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function strokeJokePathIsEligible(pathname: string): boolean {
  const normalizedPathname = normalizePathname(pathname);

  if (
    normalizedPathname.startsWith("/share-render") ||
    legalAndSystemPaths.has(normalizedPathname)
  ) {
    return false;
  }

  if (
    normalizedPathname === "/" ||
    normalizedPathname === "/discover" ||
    normalizedPathname === "/search" ||
    normalizedPathname === "/rooms"
  ) {
    return true;
  }

  return false;
}

function normalizePathname(pathname: string): string {
  if (!pathname || pathname === "/") {
    return "/";
  }

  return pathname.replace(/\/+$/, "").toLowerCase();
}

function strokeJokeSessionRollHasRun(): boolean {
  try {
    return window.sessionStorage.getItem(strokeJokeSessionRollStorageKey) === "1";
  } catch {
    return true;
  }
}

function markStrokeJokeSessionRoll() {
  try {
    window.sessionStorage.setItem(strokeJokeSessionRollStorageKey, "1");
  } catch {
    // If storage is unavailable, avoid repeated random popups in fragile contexts.
  }
}

function strokeJokeCooldownIsActive(): boolean {
  try {
    const stored = window.localStorage.getItem(strokeJokeCooldownStorageKey);
    const cooldownUntil = stored ? Number(stored) : 0;

    if (!Number.isFinite(cooldownUntil) || cooldownUntil <= 0) {
      window.localStorage.removeItem(strokeJokeCooldownStorageKey);
      return false;
    }

    if (cooldownUntil <= Date.now()) {
      window.localStorage.removeItem(strokeJokeCooldownStorageKey);
      return false;
    }

    return true;
  } catch {
    return true;
  }
}

function writeStrokeJokeCooldown() {
  try {
    window.localStorage.setItem(
      strokeJokeCooldownStorageKey,
      String(Date.now() + strokeJokeCooldownMs),
    );
  } catch {
    // The dismissal still applies for this page view through component state.
  }
}
