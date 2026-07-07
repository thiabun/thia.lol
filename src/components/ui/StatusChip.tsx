import {
  AlertCircle,
  CheckCircle2,
  LoaderCircle,
  type LucideIcon,
} from "lucide-react";
import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../../lib/classNames";

type StatusChipTone = "neutral" | "success" | "warning" | "error" | "loading";

const tones: Record<StatusChipTone, string> = {
  neutral: "border-line bg-surface/70 text-muted",
  success: "border-leaf/28 bg-leaf/9 text-leaf-ink",
  warning: "border-warm/30 bg-warm/12 text-warm-ink",
  error: "border-rose/30 bg-rose/12 text-rose-ink",
  loading: "border-warm/30 bg-warm/12 text-warm-ink",
};

const defaultIcons: Partial<Record<StatusChipTone, LucideIcon>> = {
  error: AlertCircle,
  loading: LoaderCircle,
  success: CheckCircle2,
};

type StatusChipProps = HTMLAttributes<HTMLSpanElement> & {
  children: ReactNode;
  icon?: ReactNode;
  tone?: StatusChipTone;
};

export function StatusChip({
  children,
  className,
  icon,
  tone = "neutral",
  ...props
}: StatusChipProps) {
  const DefaultIcon = defaultIcons[tone];

  return (
    <span
      className={cn(
        "inline-flex min-h-8 items-center gap-1.5 rounded-control border px-2.5 text-xs font-medium leading-none",
        tones[tone],
        className,
      )}
      {...props}
    >
      {icon ??
        (DefaultIcon ? (
          <DefaultIcon
            aria-hidden="true"
            size={14}
            className={tone === "loading" ? "animate-spin motion-reduce:animate-none" : undefined}
          />
        ) : null)}
      {children}
    </span>
  );
}
