import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "../../lib/classNames";
import { Panel } from "./Panel";

type EmptyStateProps = {
  actions?: ReactNode;
  icon: LucideIcon;
  title: string;
  text?: string;
  className?: string;
};

export function EmptyState({
  actions,
  icon: Icon,
  title,
  text,
  className,
}: EmptyStateProps) {
  return (
    <Panel className={cn("p-4 text-center sm:p-5", className)}>
      <div className="mx-auto grid size-10 place-items-center rounded-control bg-surface-strong text-accent-strong">
        <Icon aria-hidden="true" size={20} />
      </div>
      <h2 className="mt-3 text-base font-semibold text-text">{title}</h2>
      {stateTextIsUseful(title, text) ? (
        <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-muted">{text}</p>
      ) : null}
      {actions ? <div className="mt-3">{actions}</div> : null}
    </Panel>
  );
}

function stateTextIsUseful(title: string, text?: string) {
  if (!text?.trim()) {
    return false;
  }

  const normalize = (value: string) =>
    value.toLocaleLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

  return normalize(title) !== normalize(text);
}
