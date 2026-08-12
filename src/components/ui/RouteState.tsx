import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "../../lib/classNames";
import { Panel } from "./Panel";

type RouteStateNoticeKind = "neutral" | "loading" | "error";

type RouteStateNoticeProps = {
  actions?: ReactNode;
  className?: string;
  icon: LucideIcon;
  kind?: RouteStateNoticeKind;
  testId?: string;
  text?: string;
  title: string;
};

const iconStyles: Record<RouteStateNoticeKind, string> = {
  neutral: "bg-surface-strong text-accent-strong",
  loading: "bg-cool/15 text-cool-ink",
  error: "bg-rose/15 text-rose-ink",
};

export function RouteStateNotice({
  actions,
  className,
  icon: Icon,
  kind = "neutral",
  testId,
  text,
  title,
}: RouteStateNoticeProps) {
  return (
    <Panel className={cn("p-4", className)} data-testid={testId}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <div
          className={cn(
            "grid size-9 shrink-0 place-items-center rounded-control",
            iconStyles[kind],
          )}
        >
          <Icon
            aria-hidden="true"
            size={20}
            className={kind === "loading" ? "animate-spin motion-reduce:animate-none" : undefined}
          />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold text-text">{title}</h2>
          {stateTextIsUseful(title, text) ? (
            <p className="mt-1 max-w-xl text-sm leading-6 text-muted">{text}</p>
          ) : null}
          {actions ? (
            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
              {actions}
            </div>
          ) : null}
        </div>
      </div>
    </Panel>
  );
}

type CompactStateNoticeProps = {
  actions?: ReactNode;
  centered?: boolean;
  className?: string;
  icon: LucideIcon;
  kind?: RouteStateNoticeKind;
  testId?: string;
  text?: string;
  title: string;
};

export function CompactStateNotice({
  actions,
  centered = false,
  className,
  icon: Icon,
  kind = "neutral",
  testId,
  text,
  title,
}: CompactStateNoticeProps) {
  return (
    <div
      className={cn(
        centered
          ? "grid flex-1 place-items-center p-6 text-center"
          : "rounded-card bg-canvas/55 p-2.5",
        className,
      )}
      data-testid={testId}
      role={kind === "error" ? "alert" : "status"}
    >
      <div className={cn(centered ? "mx-auto max-w-sm" : "flex items-start gap-3")}>
        <div
          className={cn(
            "grid size-9 shrink-0 place-items-center rounded-control",
            centered ? "mx-auto" : "",
            iconStyles[kind],
          )}
        >
          <Icon
            aria-hidden="true"
            size={20}
            className={kind === "loading" ? "animate-spin motion-reduce:animate-none" : undefined}
          />
        </div>
        <div className={cn("min-w-0", centered ? "mt-3" : "")}>
          <h2 className="text-sm font-semibold text-text">{title}</h2>
          {stateTextIsUseful(title, text) ? (
            <p className="mt-1 text-sm leading-6 text-muted">{text}</p>
          ) : null}
          {actions ? (
            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
              {actions}
            </div>
          ) : null}
        </div>
      </div>
    </div>
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
