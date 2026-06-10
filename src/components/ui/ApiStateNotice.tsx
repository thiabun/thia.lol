import { LoaderCircle, WifiOff } from "lucide-react";
import { Badge } from "./Badge";
import { Panel } from "./Panel";

type ApiStateNoticeProps = {
  kind: "loading" | "error";
  title: string;
  text: string;
};

export function ApiStateNotice({ kind, title, text }: ApiStateNoticeProps) {
  const Icon = kind === "loading" ? LoaderCircle : WifiOff;

  return (
    <Panel className="p-4">
      <div className="flex items-start gap-3">
        <div className="grid size-10 shrink-0 place-items-center rounded-full bg-surface-strong text-accent-strong">
          <Icon
            aria-hidden="true"
            size={18}
            className={kind === "loading" ? "animate-spin" : undefined}
          />
        </div>
        <div className="min-w-0">
          <Badge tone={kind === "loading" ? "cool" : "rose"}>
            {kind === "loading" ? "loading" : "notice"}
          </Badge>
          <h2 className="mt-2 text-sm font-semibold text-text">{title}</h2>
          <p className="mt-1 text-sm leading-6 text-muted">{text}</p>
        </div>
      </div>
    </Panel>
  );
}
