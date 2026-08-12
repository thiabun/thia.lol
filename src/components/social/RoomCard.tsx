import { ArrowRight, MessageCircle, Radio, UsersRound } from "lucide-react";
import { motion } from "motion/react";
import { Link } from "react-router";
import { Panel } from "../ui/Panel";
import type { Room } from "../../lib/types";
import { formatCountWithUnit } from "../../lib/pluralize";
import {
  cardEntrance,
  cardTap,
} from "../../lib/motionPresets";
import { roomThemeSwatchCssProperties } from "../../lib/roomThemes";
import { cn } from "../../lib/classNames";
import { distinctContextText } from "../../lib/displayText";

export type RoomCardVariant = "list" | "attachment";

export type RoomCardProps = {
  room: Room;
  index?: number;
  variant?: RoomCardVariant;
};

export function RoomCard({ index = 0, room, variant = "list" }: RoomCardProps) {
  const isAttachment = variant === "attachment";
  const showSlug = Boolean(distinctContextText(room.slug, room.name));
  const summary = distinctContextText(room.summary, room.name, room.slug);

  return (
    <motion.article
      className={isAttachment ? "group min-w-0 w-full" : "group h-full"}
      variants={cardEntrance}
      custom={index}
      initial={isAttachment ? false : "hidden"}
      animate="show"
      {...(!isAttachment ? { whileTap: cardTap } : {})}
      data-render-deferred={isAttachment ? undefined : "room-list-item"}
      data-testid={isAttachment ? "room-attachment-card" : "room-card"}
    >
      <Panel
        className={cn(
          "relative overflow-hidden p-3 shadow-none transition duration-fluid ease-fluid group-hover:border-line-strong group-hover:bg-surface/86",
          isAttachment
            ? "min-w-0 w-full rounded-card bg-surface/82 shadow-inner-soft"
            : "h-full",
        )}
        style={roomThemeSwatchCssProperties(room)}
      >
        <div className="relative flex h-full min-w-0 flex-col gap-2">
          <div className="flex min-w-0 items-start gap-3">
            <div
              className="mt-0.5 grid size-10 shrink-0 place-items-center overflow-hidden rounded-card border border-line bg-canvas/65"
              style={{
                background:
                  "linear-gradient(135deg, color-mix(in oklab, var(--room-accent) 24%, transparent), var(--room-surface))",
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
              <h2 className="truncate text-sm font-semibold text-text">
                {room.name}
              </h2>
              {showSlug || room.visibility !== "public" ? (
                <span className="mt-0.5 block truncate text-xs text-muted">
                  {showSlug ? `/${room.slug}` : ""}
                  {showSlug && room.visibility !== "public" ? " · " : ""}
                  {room.visibility !== "public"
                    ? roomVisibilityLabel(room.visibility)
                    : ""}
                </span>
              ) : null}
              {summary ? (
                <span
                  className={cn(
                    "mt-1 block text-sm leading-5 text-muted",
                    isAttachment ? "line-clamp-2" : "line-clamp-1",
                  )}
                >
                  {summary}
                </span>
              ) : null}
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
          </div>
          {isAttachment ? (
            <div className="flex justify-end border-t border-line/55 pt-2">
              <Link
                to={`/rooms/${room.slug}`}
                className="app-control inline-flex min-h-11 items-center justify-center gap-2 rounded-control px-3 text-sm font-semibold text-accent-strong transition duration-fluid ease-fluid hover:bg-surface-strong/72 hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                aria-label={`Open ${room.name}`}
              >
                Open room
                <ArrowRight aria-hidden="true" size={15} />
              </Link>
            </div>
          ) : null}
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
