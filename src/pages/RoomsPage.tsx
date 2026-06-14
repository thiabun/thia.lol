import { Plus, Radio, SearchX } from "lucide-react";
import { motion } from "motion/react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { PageMeta } from "../components/PageMeta";
import { RoomEditModal } from "../components/social/RoomEditModal";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { SearchField } from "../components/ui/Field";
import { Panel } from "../components/ui/Panel";
import { RoomCard } from "../components/social/RoomCard";
import { createRoom, getRooms, uploadImage } from "../lib/api";
import { cardEntrance, pageEntrance } from "../lib/motionPresets";
import type { ImageUploadPurpose, RoomInput } from "../lib/api";
import type { Room } from "../lib/types";
import { useAsyncData } from "../lib/useAsyncData";
import { useAuth } from "../lib/useAuth";

export function RoomsPage() {
  const navigate = useNavigate();
  const { csrfToken, user } = useAuth();
  const [query, setQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [createdRooms, setCreatedRooms] = useState<Room[]>([]);
  const roomsState = useAsyncData(getRooms);
  const rooms = useMemo(() => {
    const loaded = roomsState.data ?? [];
    const loadedIds = new Set(loaded.map((room) => room.id));

    return [
      ...createdRooms.filter((room) => !loadedIds.has(room.id)),
      ...loaded,
    ];
  }, [createdRooms, roomsState.data]);
  const normalizedQuery = query.trim().toLowerCase();
  const filteredRooms = useMemo(() => {
    if (!normalizedQuery) {
      return rooms;
    }

    return rooms.filter((room) =>
      [room.name, room.slug, room.summary]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(normalizedQuery)),
    );
  }, [normalizedQuery, rooms]);

  async function handleCreateRoom(input: RoomInput) {
    if (!csrfToken) {
      throw new Error("Please log in again before creating a room.");
    }

    const created = await createRoom(input, csrfToken);
    setCreatedRooms((current) => [created, ...current]);
    navigate(`/rooms/${created.slug}`);

    return created;
  }

  async function handleUpload(file: File, purpose: ImageUploadPurpose) {
    if (!csrfToken) {
      throw new Error("Please log in again before uploading.");
    }

    return uploadImage(file, purpose, csrfToken);
  }

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
            <div className="flex w-full flex-col gap-3 sm:flex-row lg:max-w-xl">
              <SearchField
                id="room-search"
                label="Search rooms"
                placeholder="Search rooms"
                className="w-full"
                value={query}
                onChange={(event) => setQuery(event.currentTarget.value)}
              />
              {user ? (
                <Button
                  type="button"
                  className="w-full shrink-0 sm:w-auto"
                  data-testid="create-room-button"
                  icon={<Plus aria-hidden="true" size={17} />}
                  onClick={() => setCreateOpen(true)}
                >
                  Create room
                </Button>
              ) : null}
            </div>
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
          text="Rooms people create will appear here."
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

      {createOpen ? (
        <RoomEditModal
          mode="create"
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          onSave={handleCreateRoom}
          onUpload={handleUpload}
        />
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
