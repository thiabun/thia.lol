import { Moon, Sun } from "lucide-react";
import { Button } from "./ui/Button";
import { useTheme } from "../lib/useTheme";
import type { ThemeName } from "../lib/types";
import { cn } from "../lib/classNames";

const themes: Array<{
  value: ThemeName;
  label: string;
  icon: typeof Sun;
}> = [
  { value: "light", label: "Light mode", icon: Sun },
  { value: "dark", label: "Dark mode", icon: Moon },
];

export function ThemeToggle({
  compact = false,
  disabled = false,
  disabledReason = "Theme controls are disabled here",
}: {
  compact?: boolean;
  disabled?: boolean;
  disabledReason?: string;
}) {
  const { theme, setTheme } = useTheme();

  if (compact) {
    const Icon = theme === "light" ? Moon : Sun;
    const next = theme === "light" ? "Dark mode" : "Light mode";
    const label = disabled ? disabledReason : `Switch to ${next}`;

    return (
      <Button
        aria-label={label}
        disabled={disabled}
        title={label}
        variant="secondary"
        size="icon"
        icon={<Icon aria-hidden="true" size={18} />}
        onClick={() => setTheme(theme === "light" ? "dark" : "light")}
      />
    );
  }

  return (
    <div
      className="inline-grid grid-cols-2 rounded-full border border-line bg-surface/80 p-1 shadow-soft backdrop-blur-veil"
      aria-disabled={disabled}
      role="group"
      aria-label={disabled ? disabledReason : "Theme"}
      title={disabled ? disabledReason : undefined}
    >
      {themes.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          type="button"
          aria-label={label}
          aria-pressed={theme === value}
          disabled={disabled}
          title={label}
          onClick={() => setTheme(value)}
          className={cn(
            "inline-flex min-h-9 min-w-9 items-center justify-center rounded-full px-2 text-xs font-medium transition duration-fluid ease-fluid disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
            theme === value
              ? "bg-accent text-accent-ink shadow-soft"
              : "text-muted hover:bg-surface-strong hover:text-text",
          )}
        >
          <Icon aria-hidden="true" size={15} />
        </button>
      ))}
    </div>
  );
}
