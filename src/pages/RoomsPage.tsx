import { Radio, SearchX } from "lucide-react";
import { motion } from "motion/react";
import { useMemo, useState } from "react";
import { PageMeta } from "../components/PageMeta";
import { Badge } from "../components/ui/Badge";
import { EmptyState } from "../components/ui/EmptyState";
import { SearchField } from "../components/ui/Field";
import { Panel } from "../components/ui/Panel";
import { RoomCard } from "../components/social/RoomCard";
import { getRooms } from "../lib/api";
import { cardEntrance, pageEntrance } from "../lib/motionPresets";
import { useAsyncData } from "../lib/useAsyncData";

export function RoomsPage() {
  const [query, setQuery] = useState("");
  const roomsState = useAsyncData(getRooms);
  const rooms = useMemo(() => roomsState.data ?? [], [roomsState.data]);
  const normalizedQuery = query.trim().toLowerCase();
  const filteredRooms = useMemo(() => {
    if (!normalizedQuery) {
      return rooms;
    }

    return rooms.filter((room) =>
      [room.name, room.slug, room.summary, room.mood]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(normalizedQuery)),
    );
  }, [normalizedQuery, rooms]);

  return (
    <motion.div
      className="space-y-6"
      data-testid="rooms-page"
      variants={pageEntrance}
      initial="hidden"
      animate="show"
    >
      <PageMeta
        title="Rooms"
        description="Browse public rooms on thia.lol."
        path="/rooms"
      />

      <motion.div variants={cardEntrance} custom={0} initial="hidden" animate="show">
      <Panel className="p-5 sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <Badge tone="leaf">rooms</Badge>
            <h1 className="mt-4 text-3xl font-semibold tracking-normal text-text">
              Find a place to post.
            </h1>
            <p className="mt-3 text-base leading-7 text-muted">
              Public rooms for shared topics and conversations.
            </p>
          </div>
          <SearchField
            id="room-search"
            label="Search rooms"
            placeholder="Search rooms"
            className="w-full lg:max-w-sm"
            value={query}
            onChange={(event) => setQuery(event.currentTarget.value)}
          />
        </div>
      </Panel>
      </motion.div>

      {roomsState.loading ? (
        <RoomNotice title="Loading rooms" text="The room list is loading." />
      ) : null}

      {roomsState.error ? (
        <RoomNotice
          title="Rooms are not available"
          text="Try refreshing in a moment."
          tone="rose"
        />
      ) : null}

      {!roomsState.loading && !roomsState.error && rooms.length === 0 ? (
        <EmptyState
          icon={Radio}
          title="No public rooms yet"
          text="Public rooms will appear here."
        />
      ) : null}

      {!roomsState.loading &&
      !roomsState.error &&
      rooms.length > 0 &&
      filteredRooms.length === 0 ? (
        <EmptyState
          icon={SearchX}
          title="No rooms found"
          text="Try a shorter search."
        />
      ) : null}

      {filteredRooms.length > 0 ? (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" aria-label="Rooms">
          {filteredRooms.map((room, index) => (
            <RoomCard key={room.id} room={room} index={index} />
          ))}
        </section>
      ) : null}
    </motion.div>
  );
}

function RoomNotice({
  text,
  title,
  tone = "cool",
}: {
  text: string;
  title: string;
  tone?: "cool" | "rose";
}) {
  return (
    <Panel className="p-4">
      <Badge tone={tone}>{tone === "rose" ? "notice" : "loading"}</Badge>
      <h2 className="mt-3 text-sm font-semibold text-text">{title}</h2>
      <p className="mt-1 text-sm leading-6 text-muted">{text}</p>
    </Panel>
  );
}
