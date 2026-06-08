import type { LucideIcon } from "lucide-react";
import { cn } from "../../lib/classNames";
import { Panel } from "./Panel";

type EmptyStateProps = {
  icon: LucideIcon;
  title: string;
  text: string;
  className?: string;
};

export function EmptyState({
  icon: Icon,
  title,
  text,
  className,
}: EmptyStateProps) {
  return (
    <Panel className={cn("p-8 text-center", className)}>
      <div className="mx-auto grid size-12 place-items-center rounded-full bg-surface-strong text-accent-strong">
        <Icon aria-hidden="true" size={22} />
      </div>
      <h2 className="mt-4 text-lg font-semibold text-text">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted">{text}</p>
    </Panel>
  );
}
