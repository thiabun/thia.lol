import { Coffee, X } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { modalOverlay, modalPanel } from "../../lib/motionPresets";

const kofiEmbedUrl =
  "https://ko-fi.com/thiabun/?hidefeed=true&widget=true&embed=true&preview=true";

export function CoffeeSupport() {
  const [open, setOpen] = useState(false);
  const reducedMotion = useReducedMotion();
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const idleMotion =
    reducedMotion || open
      ? {}
      : {
          animate: { rotate: [0, -3, 3, -2, 2, 0], y: [0, -1, 0] },
          transition: {
            duration: 3.8,
            ease: "easeInOut" as const,
            repeat: Number.POSITIVE_INFINITY,
            repeatDelay: 1.2,
          },
        };
  const interactionMotion = reducedMotion
    ? {}
    : {
        whileHover: { y: -2, scale: 1.04 },
        whileTap: { scale: 0.94 },
      };

  useEffect(() => {
    if (!open) {
      return;
    }

    restoreFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusFrame = window.requestAnimationFrame(() => {
      closeButtonRef.current?.focus();
    });

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;

      const restoreTarget = restoreFocusRef.current;
      if (restoreTarget && document.contains(restoreTarget)) {
        restoreTarget.focus();
      }
    };
  }, [open]);

  return (
    <>
      <div className="fixed bottom-[calc(var(--app-mobile-content-bottom)+0.75rem)] left-1/2 z-30 -translate-x-1/2 lg:bottom-6 lg:left-6 lg:z-40 lg:translate-x-0">
        <motion.div {...idleMotion}>
          <motion.button
            type="button"
            className="app-control grid size-13 touch-manipulation place-items-center rounded-full border border-line/86 bg-surface/92 text-text shadow-lift ring-2 ring-accent/22 backdrop-blur-veil transition duration-fluid ease-fluid hover:border-line-strong hover:bg-surface hover:text-accent-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            aria-label="Support thia.lol on Ko-fi"
            aria-haspopup="dialog"
            aria-expanded={open}
            data-testid="coffee-support-button"
            title="Support thia.lol"
            onClick={() => setOpen(true)}
            {...interactionMotion}
          >
            <Coffee aria-hidden="true" size={24} strokeWidth={2.15} />
          </motion.button>
        </motion.div>
      </div>

      {typeof document === "undefined"
        ? null
        : createPortal(
            <AnimatePresence>
              {open ? (
                <motion.div
                  className="fixed inset-x-0 top-[var(--app-visual-viewport-top,0px)] z-50 grid h-[var(--app-visual-viewport-height,100dvh)] place-items-stretch bg-text/28 backdrop-blur-veil lg:place-items-center lg:p-4"
                  variants={modalOverlay}
                  initial="hidden"
                  animate="show"
                  exit="exit"
                  onMouseDown={(event) => {
                    if (event.target === event.currentTarget) {
                      setOpen(false);
                    }
                  }}
                >
                  <motion.div
                    role="dialog"
                    aria-label="Ko-fi support"
                    aria-modal="true"
                    className="relative h-[var(--app-visual-viewport-height,100dvh)] w-full overflow-y-auto border-line bg-[#f9f9f9] shadow-lift outline-none lg:h-auto lg:max-h-[calc(100dvh-2rem)] lg:max-w-[30rem] lg:rounded-panel lg:border"
                    data-testid="kofi-support-panel"
                    variants={modalPanel}
                  >
                    <div className="sticky top-0 z-10 flex h-0 justify-end pr-3 pt-3">
                      <motion.button
                        ref={closeButtonRef}
                        type="button"
                        className="app-control grid size-11 touch-manipulation place-items-center rounded-full border border-line bg-surface/92 text-text shadow-soft backdrop-blur-veil transition duration-fluid ease-fluid hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                        aria-label="Close Ko-fi support panel"
                        title="Close"
                        onClick={() => setOpen(false)}
                        {...(reducedMotion ? {} : { whileTap: { scale: 0.94 } })}
                      >
                        <X aria-hidden="true" size={19} />
                      </motion.button>
                    </div>
                    <iframe
                      id="kofiframe"
                      src={kofiEmbedUrl}
                      className="block"
                      style={{
                        border: "none",
                        width: "100%",
                        padding: "4px",
                        background: "#f9f9f9",
                      }}
                      height="712"
                      title="thiabun"
                    />
                  </motion.div>
                </motion.div>
              ) : null}
            </AnimatePresence>,
            document.body,
          )}
    </>
  );
}
