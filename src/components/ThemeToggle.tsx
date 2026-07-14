import { Check, Moon, Palette, Sun } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { Button } from "./ui/Button";
import { useTheme } from "../lib/useTheme";
import type { ThemePreference } from "../lib/types";
import { cn } from "../lib/classNames";
import { popoverPanel } from "../lib/motionPresets";

const themes: Array<{
  value: ThemePreference;
  label: string;
  description: string;
  icon: typeof Sun;
}> = [
  {
    value: "light",
    label: "Light",
    description: "Warm, calm standard theme",
    icon: Sun,
  },
  {
    value: "dark",
    label: "Dark",
    description: "Deep green standard theme",
    icon: Moon,
  },
  {
    value: "profile",
    label: "Profile Theme",
    description: "Use your profile appearance site-wide",
    icon: Palette,
  },
];

export function ThemeToggle({
  compact = false,
  disabled = false,
  disabledReason = "Theme controls are disabled here",
  profileThemeAvailable = false,
}: {
  compact?: boolean;
  disabled?: boolean;
  disabledReason?: string;
  profileThemeAvailable?: boolean;
}) {
  const {
    theme,
    themePreference,
    themePreferenceLabel,
    setThemePreference,
  } = useTheme();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuId = `theme-menu-${useId().replace(/:/g, "")}`;

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    function handlePointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        window.requestAnimationFrame(() => triggerRef.current?.focus());
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (!disabled) {
      return undefined;
    }

    const timeout = window.setTimeout(() => setOpen(false), 0);
    return () => window.clearTimeout(timeout);
  }, [disabled]);

  function chooseTheme(value: ThemePreference) {
    setThemePreference(value);
    setOpen(false);
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  }

  function handleRadioGroupKeyDown(event: ReactKeyboardEvent<HTMLElement>) {
    if (
      event.key !== "ArrowDown" &&
      event.key !== "ArrowLeft" &&
      event.key !== "ArrowRight" &&
      event.key !== "ArrowUp" &&
      event.key !== "End" &&
      event.key !== "Home"
    ) {
      return;
    }

    const choices = Array.from(
      event.currentTarget.querySelectorAll<HTMLButtonElement>(
        '[role="radio"]:not(:disabled)',
      ),
    );
    if (choices.length === 0) {
      return;
    }

    event.preventDefault();
    const activeIndex = choices.indexOf(document.activeElement as HTMLButtonElement);
    const nextIndex =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? choices.length - 1
          : event.key === "ArrowLeft" || event.key === "ArrowUp"
            ? (Math.max(activeIndex, 0) - 1 + choices.length) % choices.length
            : (Math.max(activeIndex, -1) + 1) % choices.length;
    const nextChoice = choices[nextIndex];
    const nextPreference = nextChoice?.dataset.themeValue as
      | ThemePreference
      | undefined;

    if (!nextChoice || !nextPreference) {
      return;
    }

    setThemePreference(nextPreference);
    window.requestAnimationFrame(() => nextChoice.focus());
  }

  const tabbablePreference =
    themePreference === "profile" && !profileThemeAvailable
      ? theme
      : themePreference;

  if (!compact) {
    return (
      <div
        className="inline-grid max-w-full grid-cols-3 rounded-panel border border-line bg-surface/80 p-1 shadow-soft backdrop-blur-veil"
        aria-disabled={disabled}
        role="radiogroup"
        aria-label={disabled ? disabledReason : "Site theme"}
        onKeyDown={handleRadioGroupKeyDown}
        title={disabled ? disabledReason : undefined}
      >
        {themes.map(({ value, label, icon: Icon }) => {
          const unavailable = value === "profile" && !profileThemeAvailable;

          return (
            <button
              key={value}
              type="button"
              aria-label={label}
              aria-checked={themePreference === value}
              data-theme-value={value}
              disabled={disabled || unavailable}
              onClick={() => chooseTheme(value)}
              className={cn(
                "inline-flex min-h-11 min-w-0 items-center justify-center gap-1.5 rounded-control px-2 text-xs font-medium transition duration-fluid ease-fluid disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
                themePreference === value
                  ? "bg-accent text-accent-contrast shadow-soft"
                  : "text-muted hover:bg-surface-strong hover:text-text",
              )}
              role="radio"
              tabIndex={tabbablePreference === value ? 0 : -1}
              title={unavailable ? "Sign in to use your profile theme" : label}
            >
              <Icon aria-hidden="true" size={15} />
              <span className="truncate">{label}</span>
            </button>
          );
        })}
      </div>
    );
  }

  const ActiveIcon =
    themePreference === "profile"
      ? Palette
      : themePreference === "dark"
        ? Moon
        : Sun;
  const triggerLabel = disabled
    ? disabledReason
    : `Choose theme, current ${themePreferenceLabel}`;

  return (
    <div ref={containerRef} className="relative shrink-0">
      <Button
        ref={triggerRef}
        aria-controls={menuId}
        aria-expanded={open}
        aria-label={triggerLabel}
        className="size-11 lg:size-9"
        data-testid="theme-menu-trigger"
        disabled={disabled}
        title={triggerLabel}
        variant="secondary"
        size="icon"
        icon={<ActiveIcon aria-hidden="true" size={18} />}
        onClick={() => setOpen((current) => !current)}
      />
      <AnimatePresence>
        {open ? (
          <motion.div
            id={menuId}
            variants={popoverPanel}
            initial="hidden"
            animate="show"
            exit="exit"
            className="site-profile-glass-surface fixed inset-x-3 top-[3.75rem] z-[60] w-auto origin-top rounded-panel border border-line bg-surface/96 p-1.5 shadow-lift sm:absolute sm:inset-x-auto sm:right-0 sm:top-auto sm:mt-2 sm:w-72 sm:origin-top-right"
            data-testid="theme-menu"
            role="radiogroup"
            aria-label="Site theme"
            onKeyDown={handleRadioGroupKeyDown}
          >
            {themes.map(({ value, label, description, icon: Icon }) => {
              const selected = themePreference === value;
              const unavailable = value === "profile" && !profileThemeAvailable;

              return (
                <button
                  key={value}
                  type="button"
                  aria-label={label}
                  aria-checked={selected}
                  data-theme-value={value}
                  className={cn(
                    "flex min-h-12 w-full items-center gap-3 rounded-control px-3 py-2 text-left transition duration-fluid ease-fluid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
                    selected
                      ? "bg-accent/16 text-text"
                      : "text-muted hover:bg-surface-strong/68 hover:text-text",
                    unavailable && "cursor-not-allowed opacity-50",
                  )}
                  disabled={unavailable}
                  onClick={() => chooseTheme(value)}
                  role="radio"
                  tabIndex={tabbablePreference === value ? 0 : -1}
                >
                  <span
                    className={cn(
                      "grid size-9 shrink-0 place-items-center rounded-full border",
                      selected
                        ? "border-accent/45 bg-accent text-accent-contrast"
                        : "border-line bg-canvas/55 text-muted",
                    )}
                  >
                    <Icon aria-hidden="true" size={17} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-text">{label}</span>
                    <span className="block text-xs leading-snug text-muted">
                      {unavailable ? "Sign in to use your profile theme" : description}
                    </span>
                  </span>
                  {selected ? (
                    <Check aria-hidden="true" className="shrink-0 text-accent-strong" size={17} />
                  ) : null}
                </button>
              );
            })}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
