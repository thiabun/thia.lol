import { ArrowRight, Clock3, MessageCircle, Radio, UsersRound } from "lucide-react";
import { motion } from "motion/react";
import { Link } from "react-router";
import { Badge } from "../ui/Badge";
import { Panel } from "../ui/Panel";
import { InlineUserProfileLink } from "./UserProfileLink";
import type { Room } from "../../lib/types";
import { formatRelativeTime } from "../../lib/dates";
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
        <div className="relative flex h-full flex-col">
          <Link
            to={`/rooms/${room.slug}`}
            className="rounded-card focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-focus"
            aria-label={`Open ${room.name}`}
          >
            {room.bannerUrl ? (
              <img
                alt=""
                src={room.bannerUrl}
                className="-mx-5 -mt-5 mb-4 h-24 w-[calc(100%+2.5rem)] object-cover"
              />
            ) : null}
            <div className="flex items-start justify-between gap-4">
              <div
                className="grid size-12 place-items-center overflow-hidden rounded-card border border-white/30 shadow-soft"
                style={{
                  background:
                    "linear-gradient(135deg, color-mix(in oklab, var(--room-accent) 58%, transparent), var(--app-surface))",
                }}
              >
                {room.iconUrl ? (
                  <img alt="" src={room.iconUrl} className="size-full object-cover" />
                ) : (
                  <Radio aria-hidden="true" size={19} className="text-text" />
                )}
              </div>
              {room.joinedByMe ? (
                <Badge tone="leaf">Joined</Badge>
              ) : room.live ? (
                <Badge tone="leaf">Active</Badge>
              ) : null}
            </div>
            <h2 className="mt-5 text-lg font-semibold text-text">{room.name}</h2>
            <p className="mt-1 text-sm text-muted">/{room.slug}</p>
          </Link>
          <p className="mt-2 flex-1 text-sm leading-6 text-muted">{room.summary}</p>
          {room.owner ? (
            <p className="mt-3 text-xs font-medium text-muted">
              Owner:{" "}
              <InlineUserProfileLink user={room.owner}>
                @{room.owner.handle}
              </InlineUserProfileLink>
            </p>
          ) : null}
          <div className="mt-5 flex items-end justify-between gap-3 text-sm text-muted">
            <div className="space-y-2">
              <span className="flex items-center gap-2">
                <MessageCircle aria-hidden="true" size={16} />
                {formatCountWithUnit(room.postCount, "post")}
              </span>
              <span className="flex items-center gap-2">
                <UsersRound aria-hidden="true" size={16} />
                {formatCountWithUnit(room.memberCount, "member")}
              </span>
              {room.latestActivityAt ? (
                <span className="flex items-center gap-2">
                  <Clock3 aria-hidden="true" size={16} />
                  {formatActivityTime(room.latestActivityAt)}
                </span>
              ) : null}
            </div>
            <Link
              to={`/rooms/${room.slug}`}
              aria-label={`Open ${room.name}`}
              className="rounded-full p-1 transition duration-fluid ease-fluid hover:bg-canvas/70 hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            >
              <ArrowRight
                aria-hidden="true"
                size={17}
                className="transition duration-fluid ease-fluid group-hover:translate-x-1"
              />
            </Link>
          </div>
        </div>
      </Panel>
    </motion.article>
  );
}

function formatActivityTime(value: string): string {
  return formatRelativeTime(value).replace(/^now$/, "active now");
}
