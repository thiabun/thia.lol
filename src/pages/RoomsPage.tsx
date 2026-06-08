import { Radio, UsersRound } from "lucide-react";
import { useMemo } from "react";
import { useSearchParams } from "react-router";
import { PageMeta } from "../components/PageMeta";
import { AmbientImage } from "../components/ui/AmbientImage";
import { Badge } from "../components/ui/Badge";
import { SearchField } from "../components/ui/Field";
import { Panel } from "../components/ui/Panel";
import { RoomCard } from "../components/social/RoomCard";
import { getRoom, getRooms } from "../lib/api";
import { useAsyncData } from "../lib/useAsyncData";

export function RoomsPage() {
  const [searchParams] = useSearchParams();
  const selectedSlug = searchParams.get("room") ?? "soft-launch";
  const { data } = useAsyncData(getRooms);
  const selectedLoader = useMemo(
    () => () => getRoom(selectedSlug),
    [selectedSlug],
  );
  const selectedState = useAsyncData(selectedLoader);
  const rooms = data ?? [];
  const selectedRoom = selectedState.data ?? rooms[0];

  return (
    <div className="space-y-6">
      <PageMeta
        title="Rooms"
        description="Browse live and slow rooms shaping the thia.lol platform."
        path="/rooms"
      />
      <section className="grid gap-5 lg:grid-cols-[360px_minmax(0,1fr)]">
        <Panel className="p-5 sm:p-6">
          <Badge tone="leaf">rooms</Badge>
          <h1 className="mt-4 text-3xl font-semibold tracking-normal text-text">
            Rooms shape the platform.
          </h1>
          <p className="mt-3 text-base leading-7 text-muted">
            Join places with a mood, a pace, and a little bit of memory.
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
                    {selectedRoom.members.toLocaleString()} members
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

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4" aria-label="Rooms">
        {rooms.map((room) => (
          <RoomCard key={room.id} room={room} />
        ))}
      </section>
    </div>
  );
}
