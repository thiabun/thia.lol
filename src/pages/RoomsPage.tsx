import { Radio, SearchX } from "lucide-react";
import { useMemo, useState } from "react";
import { PageMeta } from "../components/PageMeta";
import { Badge } from "../components/ui/Badge";
import { EmptyState } from "../components/ui/EmptyState";
import { SearchField } from "../components/ui/Field";
import { Panel } from "../components/ui/Panel";
import { RoomCard } from "../components/social/RoomCard";
import { getRooms } from "../lib/api";
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
    <div className="space-y-6" data-testid="rooms-page">
      <PageMeta
        title="Rooms"
        description="Browse public rooms on thia.lol."
        path="/rooms"
      />

      <Panel className="p-5 sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <Badge tone="leaf">rooms</Badge>
            <h1 className="mt-4 text-3xl font-semibold tracking-normal text-text">
              Find a place to post.
            </h1>
            <p className="mt-3 text-base leading-7 text-muted">
              Public communities for shared topics, moods, and conversations.
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

      {roomsState.loading ? (
        <RoomNotice title="Opening rooms" text="The room list is loading." />
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
          text="Rooms will appear here when the first public community opens."
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
          {filteredRooms.map((room) => (
            <RoomCard key={room.id} room={room} />
          ))}
        </section>
      ) : null}
    </div>
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
