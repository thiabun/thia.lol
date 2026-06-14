import { LoaderCircle, WifiOff } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "../../lib/classNames";
import { Badge } from "./Badge";
import { Panel } from "./Panel";

type ApiStateNoticeProps = {
  actions?: ReactNode;
  className?: string;
  kind: "loading" | "error";
  testId?: string;
  title: string;
  text: string;
};

export function ApiStateNotice({
  actions,
  className,
  kind,
  testId,
  title,
  text,
}: ApiStateNoticeProps) {
  const Icon = kind === "loading" ? LoaderCircle : WifiOff;

  return (
    <Panel className={cn("p-4", className)} data-testid={testId}>
      <div className="flex items-start gap-3">
        <div className="grid size-10 shrink-0 place-items-center rounded-full bg-surface-strong text-accent-strong">
          <Icon
            aria-hidden="true"
            size={18}
            className={kind === "loading" ? "animate-spin motion-reduce:animate-none" : undefined}
          />
        </div>
        <div className="min-w-0">
          <Badge tone={kind === "loading" ? "cool" : "rose"}>
            {kind === "loading" ? "loading" : "notice"}
          </Badge>
          <h2 className="mt-2 text-sm font-semibold text-text">{title}</h2>
          <p className="mt-1 text-sm leading-6 text-muted">{text}</p>
          {actions ? (
            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
              {actions}
            </div>
          ) : null}
        </div>
      </div>
    </Panel>
  );
}
