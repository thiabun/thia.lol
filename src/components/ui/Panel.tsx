import type { HTMLAttributes } from "react";
import { cn } from "../../lib/classNames";

type PanelProps = HTMLAttributes<HTMLDivElement> & {
  interactive?: boolean;
};

export function Panel({ className, interactive = false, ...props }: PanelProps) {
  return (
    <div
      className={cn(
        "rounded-panel border border-line bg-surface/84 shadow-soft backdrop-blur-veil",
        interactive &&
          "transition duration-fluid ease-fluid hover:-translate-y-1 hover:border-line-strong hover:shadow-lift motion-reduce:hover:translate-y-0",
        className,
      )}
      {...props}
    />
  );
}
