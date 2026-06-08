import { ArrowRight, Radio, UsersRound } from "lucide-react";
import { Link } from "react-router";
import { Badge } from "../ui/Badge";
import { Panel } from "../ui/Panel";
import type { Room } from "../../lib/types";

type RoomCardProps = {
  room: Room;
};

export function RoomCard({ room }: RoomCardProps) {
  return (
    <Panel interactive className="group h-full p-5">
      <Link
        to={`/rooms?room=${room.slug}`}
        className="flex h-full flex-col focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-focus"
      >
        <div className="flex items-start justify-between gap-4">
          <div
            className="grid size-12 place-items-center rounded-card border border-white/30 shadow-soft"
            style={{
              background:
                "linear-gradient(135deg, color-mix(in oklab, var(--room-accent) 58%, transparent), var(--app-surface))",
              ["--room-accent" as string]: room.accent,
            }}
          >
            <Radio aria-hidden="true" size={19} className="text-text" />
          </div>
          {room.live ? <Badge tone="leaf">live</Badge> : <Badge>slow</Badge>}
        </div>
        <h2 className="mt-5 text-lg font-semibold text-text">{room.name}</h2>
        <p className="mt-2 flex-1 text-sm leading-6 text-muted">{room.summary}</p>
        <div className="mt-5 flex items-center justify-between gap-3 text-sm text-muted">
          <span className="inline-flex items-center gap-2">
            <UsersRound aria-hidden="true" size={16} />
            {room.members.toLocaleString()} members
          </span>
          <ArrowRight
            aria-hidden="true"
            size={17}
            className="transition duration-fluid ease-fluid group-hover:translate-x-1"
          />
        </div>
      </Link>
    </Panel>
  );
}
