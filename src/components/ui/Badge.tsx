import type { HTMLAttributes } from "react";
import { cn } from "../../lib/classNames";

type BadgeTone = "default" | "warm" | "cool" | "leaf" | "rose";

const tones: Record<BadgeTone, string> = {
  default: "border-line bg-surface text-muted",
  warm: "border-warm/30 bg-warm/15 text-warm-ink",
  cool: "border-cool/30 bg-cool/15 text-cool-ink",
  leaf: "border-leaf/30 bg-leaf/15 text-leaf-ink",
  rose: "border-rose/30 bg-rose/15 text-rose-ink",
};

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  tone?: BadgeTone;
};

export function Badge({ className, tone = "default", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex min-h-6 items-center rounded-control border px-2 text-xs font-medium",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}
