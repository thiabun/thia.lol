import {
  Eye,
  Image,
  LayoutTemplate,
  LockKeyhole,
  PenLine,
  Radio,
  Send,
} from "lucide-react";
import { PageMeta } from "../components/PageMeta";
import { AmbientImage } from "../components/ui/AmbientImage";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { SelectField, TextareaField } from "../components/ui/Field";
import { Panel } from "../components/ui/Panel";

export function StudioPage() {
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <PageMeta
        title="Post"
        description="Draft a post for thia.lol."
        path="/studio"
      />
      <section className="space-y-5">
        <Panel className="p-5 sm:p-6">
          <Badge tone="warm">post</Badge>
          <h1 className="mt-4 text-3xl font-semibold tracking-normal text-text">
            Draft a post for a room.
          </h1>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <SelectField
              id="studio-room"
              label="Room"
              icon={Radio}
              options={["Soft Launch", "Moon Table", "Garden Protocol", "Afterglow"]}
            />
            <SelectField
              id="studio-visibility"
              label="Visibility"
              icon={LockKeyhole}
              options={["Public room", "Room members", "Private draft"]}
            />
          </div>
          <TextareaField
            id="studio-post"
            label="Post"
            icon={PenLine}
            className="mt-4 min-h-64"
            placeholder="Write what you want to share."
          />
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
          <AmbientImage className="aspect-[16/10] w-full" />
          <div className="p-5">
            <Badge tone="cool">
              <Eye aria-hidden="true" size={13} />
              preview
            </Badge>
            <h2 className="mt-4 text-lg font-semibold text-text">Post preview</h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              Draft previews will use the selected room and visibility.
            </p>
          </div>
        </Panel>
        <Panel className="p-5">
          <h2 className="text-lg font-semibold text-text">Publishing state</h2>
          <div className="mt-4 space-y-3">
            <ChecklistItem label="Room selected" active />
            <ChecklistItem label="Draft saved locally" active />
            <ChecklistItem label="Ready to publish" />
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
