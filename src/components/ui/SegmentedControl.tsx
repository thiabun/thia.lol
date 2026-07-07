import type { ReactNode } from "react";
import { cn } from "../../lib/classNames";

export type SegmentedControlItem<T extends string = string> = {
  disabled?: boolean;
  id: T;
  label: string;
  meta?: ReactNode;
  title?: string;
};

type SegmentedControlProps<T extends string> = {
  ariaLabel: string;
  activeId: T;
  className?: string;
  items: SegmentedControlItem<T>[];
  onChange: (id: T) => void;
  size?: "sm" | "xs";
  testId?: string;
};

export function SegmentedControl<T extends string>({
  activeId,
  ariaLabel,
  className,
  items,
  onChange,
  size = "sm",
  testId,
}: SegmentedControlProps<T>) {
  return (
    <div
      aria-label={ariaLabel}
      className={cn(
        "inline-flex max-w-full overflow-x-auto rounded-control border border-line bg-surface/58 p-0.5 shadow-inner-soft",
        className,
      )}
      role="tablist"
      data-testid={testId}
    >
      {items.map((item) => {
        const active = item.id === activeId;

        return (
          <button
            key={item.id}
            aria-selected={active}
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-[calc(var(--radius-control)-0.125rem)] font-medium transition duration-fluid ease-fluid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
              size === "xs" ? "min-h-7 px-2 text-xs" : "min-h-8 px-3 text-sm",
              active
                ? "bg-accent/16 text-text ring-1 ring-accent/24"
                : "text-muted hover:bg-surface-strong/70 hover:text-text",
              item.disabled && "cursor-not-allowed opacity-55 hover:bg-transparent hover:text-muted",
            )}
            disabled={item.disabled}
            role="tab"
            title={item.title}
            type="button"
            onClick={() => onChange(item.id)}
          >
            <span>{item.label}</span>
            {item.meta ? (
              <span className="text-xs font-medium text-muted">{item.meta}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
