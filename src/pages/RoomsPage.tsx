import { Radio, UsersRound } from "lucide-react";
import { useMemo } from "react";
import { useSearchParams } from "react-router";
import { PageMeta } from "../components/PageMeta";
import { AmbientImage } from "../components/ui/AmbientImage";
import { ApiStateNotice } from "../components/ui/ApiStateNotice";
import { Badge } from "../components/ui/Badge";
import { EmptyState } from "../components/ui/EmptyState";
import { SearchField } from "../components/ui/Field";
import { Panel } from "../components/ui/Panel";
import { RoomCard } from "../components/social/RoomCard";
import { rooms as fallbackRooms } from "../data/mockData";
import { getRoom, getRooms } from "../lib/api";
import { formatCountWithUnit } from "../lib/pluralize";
import { useAsyncData } from "../lib/useAsyncData";

export function RoomsPage() {
  const [searchParams] = useSearchParams();
  const selectedSlug = searchParams.get("room") ?? "soft-launch";
  const roomsState = useAsyncData(getRooms, fallbackRooms);
  const selectedFallback = useMemo(
    () =>
      fallbackRooms.find(
        (room) => room.slug === selectedSlug || String(room.id) === selectedSlug,
      ),
    [selectedSlug],
  );
  const selectedLoader = useMemo(
    () => () => getRoom(selectedSlug),
    [selectedSlug],
  );
  const selectedState = useAsyncData(selectedLoader, selectedFallback);
  const rooms = roomsState.data ?? fallbackRooms;
  const selectedRoom = selectedState.data ?? rooms[0];

  return (
    <div className="space-y-6">
      <PageMeta
        title="Rooms"
        description="Browse rooms on thia.lol."
        path="/rooms"
      />
      <section className="grid gap-5 lg:grid-cols-[360px_minmax(0,1fr)]">
        <Panel className="p-5 sm:p-6">
          <Badge tone="leaf">rooms</Badge>
          <h1 className="mt-4 text-3xl font-semibold tracking-normal text-text">
            Pick a room and settle in.
          </h1>
          <p className="mt-3 text-base leading-7 text-muted">
            Each room has its own pace, topic, and little crowd.
          </p>
          <SearchField
            id="room-search"
            label="Search rooms"
            placeholder="Search rooms"
            className="mt-5"
          />
        </Panel>

        {selectedRoom ? (
          <Panel className="overflow-hidden">
            <div className="grid gap-0 md:grid-cols-[minmax(0,1fr)_260px]">
              <div className="p-5 sm:p-6">
                <Badge tone={selectedRoom.live ? "leaf" : "default"}>
                  {selectedRoom.live ? "live now" : "slow room"}
                </Badge>
                <h2 className="mt-4 text-2xl font-semibold text-text">
                  {selectedRoom.name}
                </h2>
                <p className="mt-3 max-w-2xl text-base leading-7 text-muted">
                  {selectedRoom.summary}
                </p>
                <div className="mt-5 flex flex-wrap gap-3 text-sm text-muted">
                  <span className="inline-flex items-center gap-2">
                    <UsersRound aria-hidden="true" size={16} />
                    {formatCountWithUnit(selectedRoom.members, "member")}
                  </span>
                  <span className="inline-flex items-center gap-2">
                    <Radio aria-hidden="true" size={16} />
                    {selectedRoom.mood}
                  </span>
                </div>
              </div>
              <AmbientImage className="h-56 w-full md:h-full" />
            </div>
          </Panel>
        ) : null}
      </section>

      {roomsState.loading || selectedState.loading ? (
        <ApiStateNotice
          kind="loading"
          title="Opening rooms"
          text="Rooms are loading."
        />
      ) : null}

      {roomsState.usingFallback || selectedState.usingFallback ? (
        <ApiStateNotice
          kind="fallback"
          title="Showing a saved view"
          text="Rooms are taking a moment to refresh."
        />
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4" aria-label="Rooms">
        {rooms.length > 0 ? (
          rooms.map((room) => (
            <RoomCard key={room.id} room={room} />
          ))
        ) : (
          <EmptyState
            icon={Radio}
            title="No public rooms yet"
            text="Rooms will appear here once there is something to show."
            className="md:col-span-2 xl:col-span-4"
          />
        )}
      </section>
    </div>
  );
}
