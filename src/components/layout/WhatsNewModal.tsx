import {
  Activity,
  CircleCheckBig,
  Coffee,
  Compass,
  Layers3,
  Link2,
  MessageCircle,
  Music2,
  Palette,
  Play,
  RefreshCw,
  Share2,
  Smartphone,
  Sparkles,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import type { RefObject } from "react";
import {
  CURRENT_WHATS_NEW_RELEASE,
  type WhatsNewGroup,
  type WhatsNewGroupId,
  type WhatsNewIconName,
} from "../../lib/whatsNew";
import { Button } from "../ui/Button";
import { ModalSheet } from "../ui/ModalSheet";

type WhatsNewModalProps = {
  open: boolean;
  onClose: () => void;
  returnFocusRef?: RefObject<HTMLElement | null>;
};

const itemIcons: Record<WhatsNewIconName, LucideIcon> = {
  activity: Activity,
  coffee: Coffee,
  compass: Compass,
  layers: Layers3,
  link: Link2,
  message: MessageCircle,
  music: Music2,
  palette: Palette,
  play: Play,
  refresh: RefreshCw,
  share: Share2,
  smartphone: Smartphone,
  sparkles: Sparkles,
  wrench: Wrench,
};

const groupIcons: Record<WhatsNewGroupId, LucideIcon> = {
  new: Sparkles,
  improved: Layers3,
  fixed: CircleCheckBig,
};

const groupToneClasses: Record<
  WhatsNewGroupId,
  {
    icon: string;
    label: string;
    rail: string;
  }
> = {
  new: {
    icon: "border-accent/28 bg-accent/12 text-accent-strong",
    label: "text-accent-strong",
    rail: "bg-accent",
  },
  improved: {
    icon: "border-cool/28 bg-cool/12 text-cool-ink",
    label: "text-cool-ink",
    rail: "bg-cool",
  },
  fixed: {
    icon: "border-leaf/30 bg-leaf/12 text-leaf-ink",
    label: "text-leaf-ink",
    rail: "bg-leaf",
  },
};

export function WhatsNewModal({
  open,
  onClose,
  returnFocusRef,
}: WhatsNewModalProps) {
  return (
    <ModalSheet
      {...(returnFocusRef ? { returnFocusRef } : {})}
      bodyClassName="overscroll-contain px-0 py-0 lg:px-0"
      closeLabel="Close what’s new"
      description={CURRENT_WHATS_NEW_RELEASE.sinceLabel}
      footer={
        <div className="flex items-center justify-between gap-3">
          <p className="max-w-40 text-xs leading-4 text-muted sm:max-w-none">
            Reopen anytime from your menu or the site footer.
          </p>
          <Button
            type="button"
            className="min-h-11 min-w-24 shrink-0"
            data-testid="whats-new-got-it"
            onClick={onClose}
          >
            Got it
          </Button>
        </div>
      }
      mobile="sheet"
      onClose={onClose}
      open={open}
      panelClassName="lg:max-w-3xl"
      size="lg"
      testId="whats-new-modal"
      title={CURRENT_WHATS_NEW_RELEASE.title}
      titleClassName="text-xl tracking-[-0.02em] lg:text-2xl"
    >
      <div data-testid="whats-new-content">
        <div className="border-b border-line/72 bg-gradient-to-r from-accent/12 via-canvas/38 to-cool/10 px-4 py-4 lg:px-6">
          <p className="max-w-2xl text-sm font-medium leading-6 text-text">
            {CURRENT_WHATS_NEW_RELEASE.supportingLine}
          </p>
        </div>

        <div className="divide-y divide-line/72">
          {CURRENT_WHATS_NEW_RELEASE.groups.map((group) => (
            <WhatsNewGroupSection key={group.id} group={group} />
          ))}
        </div>
      </div>
    </ModalSheet>
  );
}

function WhatsNewGroupSection({ group }: { group: WhatsNewGroup }) {
  const tone = groupToneClasses[group.id];
  const GroupIcon = groupIcons[group.id];

  return (
    <section
      className="relative grid min-w-0 grid-cols-[0.25rem_minmax(0,1fr)]"
      aria-labelledby={`whats-new-${group.id}-heading`}
      data-testid={`whats-new-group-${group.id}`}
    >
      <div aria-hidden="true" className={tone.rail} />
      <div className="min-w-0 px-4 py-5 lg:px-6">
        <header className="flex items-center gap-2.5">
          <span
            className={`grid size-8 shrink-0 place-items-center rounded-full border ${tone.icon}`}
          >
            <GroupIcon aria-hidden="true" size={16} strokeWidth={2.15} />
          </span>
          <h3
            id={`whats-new-${group.id}-heading`}
            className={`text-sm font-semibold uppercase tracking-[0.12em] ${tone.label}`}
          >
            {group.label}
          </h3>
        </header>

        <ul className="mt-3 divide-y divide-line/66">
          {group.items.map((item) => {
            const ItemIcon = itemIcons[item.icon];

            return (
              <li
                key={item.id}
                className="grid min-w-0 grid-cols-[2rem_minmax(0,1fr)] gap-3 py-3 first:pt-0 last:pb-0"
              >
                <span
                  aria-hidden="true"
                  className={`mt-0.5 grid size-8 place-items-center rounded-full border ${tone.icon}`}
                >
                  <ItemIcon size={15} strokeWidth={2} />
                </span>
                <div className="min-w-0">
                  <h4 className="text-sm font-semibold leading-5 text-text">
                    {item.title}
                  </h4>
                  <p className="mt-0.5 text-sm leading-5 text-muted">
                    {item.description}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
