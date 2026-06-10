import { ArrowRight, Clock3, MessageCircle, Radio } from "lucide-react";
import { motion } from "motion/react";
import { Link } from "react-router";
import { Badge } from "../ui/Badge";
import { Panel } from "../ui/Panel";
import type { Room } from "../../lib/types";
import { formatCountWithUnit } from "../../lib/pluralize";
import {
  cardEntrance,
  cardTap,
  roomCardHover,
} from "../../lib/motionPresets";

type RoomCardProps = {
  room: Room;
  index?: number;
};

export function RoomCard({ index = 0, room }: RoomCardProps) {
  return (
    <motion.article
      className="group h-full"
      variants={cardEntrance}
      custom={index}
      initial="hidden"
      animate="show"
      whileHover={roomCardHover}
      whileTap={cardTap}
      data-testid="room-card"
    >
      <Panel
        className="relative h-full overflow-hidden p-5 transition duration-fluid ease-fluid group-hover:border-line-strong group-hover:shadow-lift"
        style={{ ["--room-accent" as string]: room.accent }}
      >
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-0 transition duration-fluid ease-fluid group-hover:opacity-100"
          style={{
            background:
              "linear-gradient(135deg, color-mix(in oklab, var(--room-accent) 18%, transparent), transparent 52%)",
          }}
        />
        <Link
          to={`/rooms/${room.slug}`}
          className="relative flex h-full flex-col focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-focus"
        >
          <div className="flex items-start justify-between gap-4">
            <div
              className="grid size-12 place-items-center rounded-card border border-white/30 shadow-soft"
              style={{
                background:
                  "linear-gradient(135deg, color-mix(in oklab, var(--room-accent) 58%, transparent), var(--app-surface))",
              }}
            >
              <Radio aria-hidden="true" size={19} className="text-text" />
            </div>
            {room.live ? <Badge tone="leaf">active</Badge> : <Badge>new</Badge>}
          </div>
          <h2 className="mt-5 text-lg font-semibold text-text">{room.name}</h2>
          <p className="mt-1 text-sm text-muted">/{room.slug}</p>
          <p className="mt-2 flex-1 text-sm leading-6 text-muted">{room.summary}</p>
          {room.owner ? (
            <p className="mt-3 text-xs font-medium text-muted">
              Owner: @{room.owner.handle}
            </p>
          ) : null}
          <div className="mt-4 flex flex-wrap gap-2">
            {room.mood ? <Badge>{room.mood}</Badge> : null}
            {room.visibility ? <Badge tone="cool">{room.visibility}</Badge> : null}
          </div>
          <div className="mt-5 flex items-end justify-between gap-3 text-sm text-muted">
            <div className="space-y-2">
              <span className="flex items-center gap-2">
                <MessageCircle aria-hidden="true" size={16} />
                {formatCountWithUnit(room.postCount, "post")}
              </span>
              {room.latestActivityAt ? (
                <span className="flex items-center gap-2">
                  <Clock3 aria-hidden="true" size={16} />
                  {formatActivityTime(room.latestActivityAt)}
                </span>
              ) : null}
            </div>
            <ArrowRight
              aria-hidden="true"
              size={17}
              className="transition duration-fluid ease-fluid group-hover:translate-x-1"
            />
          </div>
        </Link>
      </Panel>
    </motion.article>
  );
}

function formatActivityTime(value: string): string {
  const parsed = new Date(value.includes("T") ? value : value.replace(" ", "T"));

  if (Number.isNaN(parsed.getTime())) {
    return "active recently";
  }

  const seconds = Math.round((parsed.getTime() - Date.now()) / 1000);
  const absSeconds = Math.abs(seconds);

  if (absSeconds < 60) {
    return "active now";
  }

  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ["year", 60 * 60 * 24 * 365],
    ["month", 60 * 60 * 24 * 30],
    ["day", 60 * 60 * 24],
    ["hour", 60 * 60],
    ["minute", 60],
  ];
  const [unit, divisor] =
    units.find(([, unitSeconds]) => absSeconds >= unitSeconds) ?? units.at(-1)!;

  return new Intl.RelativeTimeFormat(undefined, { numeric: "auto" }).format(
    Math.round(seconds / divisor),
    unit,
  );
}
