import type { HTMLAttributes } from "react";
import { cn } from "../../lib/classNames";

type PanelProps = HTMLAttributes<HTMLDivElement> & {
  elevated?: boolean;
  interactive?: boolean;
};

export function Panel({
  className,
  elevated = false,
  interactive = false,
  ...props
}: PanelProps) {
  return (
    <div
      className={cn(
        "rounded-panel border border-line/82 bg-surface/66",
        elevated && "shadow-soft backdrop-blur-veil",
        interactive &&
          "transition duration-fluid ease-fluid hover:border-line-strong hover:bg-surface/86",
        className,
      )}
      {...props}
    />
  );
}
