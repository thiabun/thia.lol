import { Image, LockKeyhole, Send, Sparkles } from "lucide-react";
import { Button } from "../ui/Button";
import { Panel } from "../ui/Panel";
import { Badge } from "../ui/Badge";

export function Composer() {
  return (
    <Panel className="p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-text">New signal</p>
          <p className="mt-1 text-xs text-muted">Soft Launch · public room</p>
        </div>
        <Badge tone="warm">
          <Sparkles aria-hidden="true" size={13} />
          gentle
        </Badge>
      </div>
      <label className="mt-4 block">
        <span className="sr-only">Post body</span>
        <textarea
          className="min-h-28 w-full resize-none rounded-card border border-line bg-canvas/50 px-4 py-3 text-sm leading-6 text-text shadow-inner-soft outline-none transition duration-fluid placeholder:text-muted/70 focus:border-line-strong focus:bg-surface"
          placeholder="What wants to be shared?"
        />
      </label>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-muted">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            title="Attach image"
            aria-label="Attach image"
            icon={<Image aria-hidden="true" size={18} />}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            title="Visibility"
            aria-label="Visibility"
            icon={<LockKeyhole aria-hidden="true" size={18} />}
          />
        </div>
        <Button
          type="button"
          icon={<Send aria-hidden="true" size={17} />}
          onClick={(event) => event.currentTarget.blur()}
        >
          Post
        </Button>
      </div>
    </Panel>
  );
}
