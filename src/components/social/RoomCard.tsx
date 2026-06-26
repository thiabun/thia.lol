import { ArrowRight, Clock3, MessageCircle, Radio, UsersRound } from "lucide-react";
import { motion } from "motion/react";
import { Link } from "react-router";
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
import { roomThemeSwatchCssProperties } from "../../lib/roomThemes";

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
        className="relative h-full overflow-hidden p-3 shadow-none transition duration-fluid ease-fluid group-hover:border-line-strong"
        style={roomThemeSwatchCssProperties(room)}
      >
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-2 left-0 w-1 rounded-r-full opacity-55"
          style={{
            background: "var(--room-accent)",
          }}
        />
        <div className="relative flex h-full min-w-0 flex-col gap-2 pl-1">
          <div className="flex min-w-0 items-start gap-3">
            <div
              className="mt-0.5 grid size-10 shrink-0 place-items-center overflow-hidden rounded-card border border-line bg-canvas/65"
              style={{
                background:
                  "linear-gradient(135deg, color-mix(in oklab, var(--room-accent) 38%, transparent), var(--room-surface))",
              }}
            >
              {room.iconUrl ? (
                <img alt="" src={room.iconUrl} className="size-full object-cover" />
              ) : (
                <Radio aria-hidden="true" size={17} className="text-text" />
              )}
            </div>
            <Link
              to={`/rooms/${room.slug}`}
              className="min-w-0 flex-1 rounded-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
              aria-label={`Open ${room.name}`}
              title={`Open ${room.name}`}
            >
              <div className="flex min-w-0 items-center gap-2">
                <h2 className="truncate text-sm font-semibold text-text">
                  {room.name}
                </h2>
                {room.joinedByMe ? (
                  <span className="shrink-0 rounded-full bg-leaf/15 px-2 py-0.5 text-[0.68rem] font-semibold text-leaf-ink">
                    Joined
                  </span>
                ) : room.visibility !== "public" ? (
                  <span className="shrink-0 rounded-full bg-accent/15 px-2 py-0.5 text-[0.68rem] font-semibold text-text">
                    {roomVisibilityLabel(room.visibility)}
                  </span>
                ) : room.live ? (
                  <span className="shrink-0 rounded-full bg-leaf/15 px-2 py-0.5 text-[0.68rem] font-semibold text-leaf-ink">
                    Active
                  </span>
                ) : null}
              </div>
              <span className="mt-0.5 block truncate text-xs text-muted">
                /{room.slug}
              </span>
              <span className="mt-1 block line-clamp-1 text-sm leading-5 text-muted">
                {room.summary}
              </span>
            </Link>
            <Link
              to={`/rooms/${room.slug}`}
              aria-label={`Open ${room.name}`}
              title={`Open ${room.name}`}
              className="grid size-8 shrink-0 place-items-center rounded-full text-muted transition duration-fluid ease-fluid hover:bg-canvas/70 hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            >
              <ArrowRight
                aria-hidden="true"
                size={16}
                className="transition duration-fluid ease-fluid group-hover:translate-x-0.5"
              />
            </Link>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pl-[3.25rem] text-xs text-muted">
            <span className="inline-flex items-center gap-1.5">
              <MessageCircle aria-hidden="true" size={13} />
              {formatCountWithUnit(room.postCount, "post")}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <UsersRound aria-hidden="true" size={13} />
              {formatCountWithUnit(room.memberCount, "member")}
            </span>
            {room.latestActivityAt ? (
              <span className="inline-flex items-center gap-1.5">
                <Clock3 aria-hidden="true" size={13} />
                {formatActivityTime(room.latestActivityAt)}
              </span>
            ) : null}
            {room.owner ? (
              <span className="inline-flex min-w-0 items-center gap-1">
                <span className="text-muted/75">by</span>
                <InlineUserProfileLink user={room.owner}>
                  @{room.owner.handle}
                </InlineUserProfileLink>
              </span>
            ) : null}
          </div>
        </div>
      </Panel>
    </motion.article>
  );
}

function roomVisibilityLabel(visibility: Room["visibility"]): string {
  if (visibility === "private") {
    return "Private";
  }

  if (visibility === "invite") {
    return "Invite";
  }

  if (visibility === "view_only") {
    return "View-only";
  }

  return "Public";
}

function formatActivityTime(value: string): string {
  return formatRelativeTime(value).replace(/^now$/, "active now");
}
