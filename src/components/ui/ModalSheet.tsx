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
  dialog: "max-h-[calc(100dvh-1.5rem)] rounded-panel",
  full: "h-dvh max-h-dvh rounded-none",
  sheet:
    "h-[calc(100dvh-0.75rem)] max-h-[40rem] rounded-t-panel border-b-0",
};

const panelSizeClasses: Record<ModalSheetSize, string> = {
  sm: "sm:max-w-md",
  md: "sm:max-w-xl",
  lg: "sm:max-w-2xl",
  xl: "sm:max-w-5xl",
  wide: "sm:max-w-7xl",
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
            "fixed inset-0 z-50 bg-text/28 backdrop-blur-veil sm:place-items-center sm:px-4 sm:py-6",
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
              "flex w-full flex-col overflow-hidden border border-line bg-surface shadow-lift outline-none sm:h-auto sm:max-h-[calc(100dvh-3rem)] sm:rounded-panel",
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
              title={title}
              titleId={titleId}
            />

            <div
              className={cn(
                "min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5",
                bodyClassName,
              )}
            >
              {children}
            </div>

            {footer ? (
              <div
                className={cn(
                  "shrink-0 border-t border-line bg-surface px-4 py-3 sm:px-5",
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
  title,
  titleId,
}: {
  align: ModalSheetHeaderAlign;
  busy: boolean;
  closeLabel: string;
  description?: ReactNode;
  descriptionId: string | undefined;
  onClose: () => void;
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
  const closeButton = (
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
  );

  return (
    <div className="shrink-0 border-b border-line bg-surface px-4 py-3 sm:px-5">
      {align === "center" ? (
        <div className="grid grid-cols-[2.5rem_1fr_2.5rem] items-center gap-3">
          <span aria-hidden="true" />
          {copy}
          {closeButton}
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
