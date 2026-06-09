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
  { value: "sunveil", label: "Light mode", icon: Sun },
  { value: "frostveil", label: "Dark mode", icon: Moon },
];

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const { theme, setTheme } = useTheme();

  if (compact) {
    const Icon = theme === "sunveil" ? Moon : Sun;
    const next = theme === "sunveil" ? "Dark mode" : "Light mode";

    return (
      <Button
        aria-label={`Switch to ${next}`}
        title={`Switch to ${next}`}
        variant="secondary"
        size="icon"
        icon={<Icon aria-hidden="true" size={18} />}
        onClick={() => setTheme(theme === "sunveil" ? "frostveil" : "sunveil")}
      />
    );
  }

  return (
    <div
      className="inline-grid grid-cols-2 rounded-full border border-line bg-surface/80 p-1 shadow-soft backdrop-blur-veil"
      role="group"
      aria-label="Theme"
    >
      {themes.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          type="button"
          aria-label={label}
          aria-pressed={theme === value}
          title={label}
          onClick={() => setTheme(value)}
          className={cn(
            "inline-flex min-h-9 min-w-9 items-center justify-center rounded-full px-2 text-xs font-medium transition duration-fluid ease-fluid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
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
