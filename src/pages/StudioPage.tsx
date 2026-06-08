import {
  Eye,
  Image,
  LayoutTemplate,
  LockKeyhole,
  PenLine,
  Radio,
  Send,
} from "lucide-react";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Panel } from "../components/ui/Panel";

export function StudioPage() {
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <section className="space-y-5">
        <Panel className="p-5 sm:p-6">
          <Badge tone="warm">studio</Badge>
          <h1 className="mt-4 text-3xl font-semibold tracking-normal text-text">
            Draft a signal with room-aware texture.
          </h1>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-2 flex items-center gap-2 text-sm font-medium text-text">
                <Radio aria-hidden="true" size={16} />
                Room
              </span>
              <select className="min-h-12 w-full rounded-card border border-line bg-canvas/55 px-4 text-sm text-text outline-none focus:border-line-strong">
                <option>Soft Launch</option>
                <option>Moon Table</option>
                <option>Garden Protocol</option>
                <option>Afterglow</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-2 flex items-center gap-2 text-sm font-medium text-text">
                <LockKeyhole aria-hidden="true" size={16} />
                Visibility
              </span>
              <select className="min-h-12 w-full rounded-card border border-line bg-canvas/55 px-4 text-sm text-text outline-none focus:border-line-strong">
                <option>Public room</option>
                <option>Room members</option>
                <option>Private draft</option>
              </select>
            </label>
          </div>
          <label className="mt-4 block">
            <span className="mb-2 flex items-center gap-2 text-sm font-medium text-text">
              <PenLine aria-hidden="true" size={16} />
              Signal
            </span>
            <textarea
              className="min-h-64 w-full resize-none rounded-card border border-line bg-canvas/55 px-4 py-3 text-sm leading-6 text-text shadow-inner-soft outline-none transition duration-fluid placeholder:text-muted/70 focus:border-line-strong focus:bg-surface"
              placeholder="Write from the room outward."
            />
          </label>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex gap-2">
              <Button
                type="button"
                variant="secondary"
                icon={<Image aria-hidden="true" size={17} />}
              >
                Media
              </Button>
              <Button
                type="button"
                variant="secondary"
                icon={<LayoutTemplate aria-hidden="true" size={17} />}
              >
                Template
              </Button>
            </div>
            <Button type="button" icon={<Send aria-hidden="true" size={17} />}>
              Publish
            </Button>
          </div>
        </Panel>
      </section>

      <aside className="space-y-5">
        <Panel className="overflow-hidden">
          <img
            src="/ambient-veil.png"
            alt=""
            className="aspect-[16/10] w-full object-cover"
            loading="lazy"
          />
          <div className="p-5">
            <Badge tone="cool">
              <Eye aria-hidden="true" size={13} />
              preview
            </Badge>
            <h2 className="mt-4 text-lg font-semibold text-text">Signal preview</h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              Draft previews will inherit room mood, theme tokens, and reaction affordances.
            </p>
          </div>
        </Panel>
        <Panel className="p-5">
          <h2 className="text-lg font-semibold text-text">Publishing state</h2>
          <div className="mt-4 space-y-3">
            <ChecklistItem label="Room selected" active />
            <ChecklistItem label="Draft saved locally" active />
            <ChecklistItem label="API connection" />
          </div>
        </Panel>
      </aside>
    </div>
  );
}

function ChecklistItem({ label, active = false }: { label: string; active?: boolean }) {
  return (
    <div className="flex items-center gap-3 rounded-card border border-line bg-canvas/45 p-3">
      <span
        className={
          active
            ? "size-2.5 rounded-full bg-leaf shadow-glow"
            : "size-2.5 rounded-full bg-muted/35"
        }
      />
      <span className="text-sm text-text">{label}</span>
    </div>
  );
}
