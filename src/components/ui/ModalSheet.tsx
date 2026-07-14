import { AnimatePresence, motion } from "motion/react";
import { X } from "lucide-react";
import {
  useEffect,
  useId,
  useRef,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { cn } from "../../lib/classNames";
import { modalOverlay, modalPanel } from "../../lib/motionPresets";
import { Button } from "./Button";

type ModalSheetSize = "sm" | "md" | "lg" | "xl" | "wide";
type ModalSheetMobile = "dialog" | "sheet" | "full";
type ModalSheetHeaderAlign = "start" | "center";

type ModalSheetProps = {
  bodyClassName?: string;
  // Non-busy sheets close on Escape and overlay press by default.
  // Busy sheets keep focus and require the active task to finish first.
  busy?: boolean;
  children: ReactNode;
  closeLabel?: string;
  closeOnEscape?: boolean;
  closeOnOutsideClick?: boolean;
  description?: ReactNode;
  footer?: ReactNode;
  footerClassName?: string;
  headerAlign?: ModalSheetHeaderAlign;
  initialFocusRef?: RefObject<HTMLElement | null>;
  mobile?: ModalSheetMobile;
  onClose: () => void;
  open: boolean;
  panelClassName?: string;
  showCloseButton?: boolean;
  size?: ModalSheetSize;
  testId?: string;
  title: string;
};

const modalStack: string[] = [];

const overlayMobileClasses: Record<ModalSheetMobile, string> = {
  dialog: "grid place-items-center p-3",
  full: "grid place-items-stretch p-0",
  sheet: "grid items-end justify-items-stretch p-0",
};

const panelMobileClasses: Record<ModalSheetMobile, string> = {
  dialog: "max-h-[calc(var(--app-visual-viewport-height,100dvh)-1.5rem)] rounded-panel",
  full: "h-[var(--app-visual-viewport-height,100dvh)] max-h-[var(--app-visual-viewport-height,100dvh)] rounded-none",
  sheet:
    "h-[calc(var(--app-visual-viewport-height,100dvh)-0.75rem)] max-h-[40rem] rounded-t-panel border-b-0",
};

const panelSizeClasses: Record<ModalSheetSize, string> = {
  sm: "lg:max-w-md",
  md: "lg:max-w-xl",
  lg: "lg:max-w-2xl",
  xl: "lg:max-w-5xl",
  wide: "lg:max-w-7xl",
};

export function ModalSheet({
  bodyClassName,
  busy = false,
  children,
  closeLabel,
  closeOnEscape = true,
  closeOnOutsideClick = true,
  description,
  footer,
  footerClassName,
  headerAlign = "start",
  initialFocusRef,
  mobile = "sheet",
  onClose,
  open,
  panelClassName,
  showCloseButton = true,
  size = "md",
  testId,
  title,
}: ModalSheetProps) {
  const generatedTitleId = useId();
  const generatedDescriptionId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const busyRef = useRef(busy);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const stackIdRef = useRef(generatedTitleId);
  const titleId = `${generatedTitleId}-title`;
  const descriptionId = description ? `${generatedDescriptionId}-description` : undefined;
  const resolvedCloseLabel = closeLabel ?? `Close ${title.toLowerCase()}`;

  useEffect(() => {
    busyRef.current = busy;
  }, [busy]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const stackId = stackIdRef.current;
    modalStack.push(stackId);

    return () => {
      const index = modalStack.lastIndexOf(stackId);
      if (index >= 0) {
        modalStack.splice(index, 1);
      }
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    restoreFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusFrame = window.requestAnimationFrame(() => {
      const target = initialFocusRef?.current ?? dialogRef.current;
      target?.focus();
    });

    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.body.style.overflow = previousOverflow;

      const restoreTarget = restoreFocusRef.current;
      if (restoreTarget && document.contains(restoreTarget)) {
        restoreTarget.focus();
      }
    };
  }, [initialFocusRef, open]);

  useEffect(() => {
    if (!open || !closeOnEscape) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      const isTopmost = modalStack[modalStack.length - 1] === stackIdRef.current;

      if (event.key === "Escape" && isTopmost && !busyRef.current) {
        onClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [closeOnEscape, onClose, open]);

  if (typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          className={cn(
            "fixed inset-x-0 top-[var(--app-visual-viewport-top,0px)] z-50 h-[var(--app-visual-viewport-height,100dvh)] bg-text/28 backdrop-blur-veil lg:inset-0 lg:h-auto lg:place-items-center lg:px-4 lg:py-6",
            overlayMobileClasses[mobile],
          )}
          variants={modalOverlay}
          initial="hidden"
          animate="show"
          exit="exit"
          onMouseDown={(event) => {
            if (
              event.target === event.currentTarget &&
              closeOnOutsideClick &&
              !busyRef.current
            ) {
              onClose();
            }
          }}
        >
          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={descriptionId}
            className={cn(
              "site-profile-glass-surface flex w-full flex-col overflow-hidden border border-line bg-surface shadow-lift outline-none lg:h-auto lg:max-h-[calc(100dvh-3rem)] lg:rounded-panel",
              panelMobileClasses[mobile],
              panelSizeClasses[size],
              panelClassName,
            )}
            data-testid={testId}
            tabIndex={-1}
            variants={modalPanel}
          >
            <ModalSheetHeader
              align={headerAlign}
              busy={busy}
              closeLabel={resolvedCloseLabel}
              description={description}
              descriptionId={descriptionId}
              onClose={onClose}
              showCloseButton={showCloseButton}
              title={title}
              titleId={titleId}
            />

            <div
              className={cn(
                "min-h-0 flex-1 overflow-y-auto px-4 py-4 lg:px-5",
                bodyClassName,
              )}
            >
              {children}
            </div>

            {footer ? (
              <div
                className={cn(
                  "site-profile-glass-surface shrink-0 border-t border-line bg-surface px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 lg:px-5 lg:pb-3",
                  footerClassName,
                )}
              >
                {footer}
              </div>
            ) : null}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}

function ModalSheetHeader({
  align,
  busy,
  closeLabel,
  description,
  descriptionId,
  onClose,
  showCloseButton,
  title,
  titleId,
}: {
  align: ModalSheetHeaderAlign;
  busy: boolean;
  closeLabel: string;
  description?: ReactNode;
  descriptionId: string | undefined;
  onClose: () => void;
  showCloseButton: boolean;
  title: string;
  titleId: string;
}) {
  const copy = (
    <div className={cn("min-w-0", align === "center" && "text-center")}>
      <h2
        id={titleId}
        className={cn(
          "text-lg font-semibold text-text",
          align === "center" && "truncate text-base",
        )}
      >
        {title}
      </h2>
      {description ? (
        <p
          id={descriptionId}
          className={cn(
            "mt-1 text-sm leading-6 text-muted",
            align === "center" && "truncate text-xs leading-5",
          )}
        >
          {description}
        </p>
      ) : null}
    </div>
  );
  const closeButton = showCloseButton ? (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={closeLabel}
      title="Close"
      icon={<X aria-hidden="true" size={18} />}
      disabled={busy}
      onClick={onClose}
    />
  ) : null;

  return (
    <div className="site-profile-glass-surface shrink-0 border-b border-line bg-surface px-4 py-3 lg:px-5">
      {align === "center" ? (
        <div className="grid grid-cols-[2.5rem_1fr_2.5rem] items-center gap-3">
          <span aria-hidden="true" />
          {copy}
          {closeButton ?? <span aria-hidden="true" />}
        </div>
      ) : (
        <div className="flex items-start justify-between gap-4">
          {copy}
          {closeButton}
        </div>
      )}
    </div>
  );
}

type ModalSheetStatusTone = "neutral" | "success" | "error";

type ModalSheetStatusProps = {
  children: ReactNode;
  className?: string;
  tone?: ModalSheetStatusTone;
};

const statusClasses: Record<ModalSheetStatusTone, string> = {
  error: "border-rose/30 bg-rose/15 text-rose-ink",
  neutral: "border-line bg-canvas/55 text-text",
  success: "border-leaf/30 bg-leaf/15 text-leaf-ink",
};

export function ModalSheetStatus({
  children,
  className,
  tone = "neutral",
}: ModalSheetStatusProps) {
  return (
    <p
      className={cn(
        "rounded-card border p-3 text-sm leading-6",
        statusClasses[tone],
        className,
      )}
      role={tone === "error" ? "alert" : "status"}
    >
      {children}
    </p>
  );
}
