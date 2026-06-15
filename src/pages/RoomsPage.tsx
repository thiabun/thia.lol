import { Plus, Radio, SearchX } from "lucide-react";
import { motion } from "motion/react";
import { lazy, Suspense, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { PageMeta } from "../components/PageMeta";
import { ApiStateNotice } from "../components/ui/ApiStateNotice";
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

const RoomEditModal = lazy(() =>
  import("../components/social/RoomEditModal").then((module) => ({
    default: module.RoomEditModal,
  })),
);

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
      className="space-y-4"
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
        <Panel className="p-4 sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl">
              <h1 className="text-3xl font-semibold tracking-normal text-text">
                Rooms
              </h1>
              <p className="mt-2 text-sm leading-6 text-muted">
                Public rooms for shared posts.
              </p>
            </div>
            <div className="flex w-full flex-col gap-2 sm:flex-row lg:max-w-xl">
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
                  size="sm"
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
        <ApiStateNotice
          kind="loading"
          title="Loading rooms"
          text="Loading rooms."
        />
      ) : null}

      {roomsState.error ? (
        <ApiStateNotice
          kind="error"
          title="Rooms are not available"
          text="Try refreshing in a moment."
        />
      ) : null}

      {!roomsState.loading && !roomsState.error && rooms.length === 0 ? (
        <EmptyState
          icon={Radio}
          title="No public rooms yet"
          text="No public rooms."
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
        <section className="grid gap-2 md:grid-cols-2 xl:grid-cols-3" aria-label="Rooms">
          {filteredRooms.map((room, index) => (
            <RoomCard key={room.id} room={room} index={index} />
          ))}
        </section>
      ) : null}

      {createOpen ? (
        <Suspense fallback={<RoomEditorLoadingNotice />}>
          <RoomEditModal
            mode="create"
            open={createOpen}
            onClose={() => setCreateOpen(false)}
            onSave={handleCreateRoom}
            onUpload={handleUpload}
          />
        </Suspense>
      ) : null}
    </motion.div>
  );
}

function RoomEditorLoadingNotice() {
  return (
    <div
      className="fixed inset-x-4 bottom-24 z-50 mx-auto max-w-sm rounded-panel border border-line bg-surface/96 px-4 py-3 text-sm text-muted shadow-lift backdrop-blur-veil"
      role="status"
    >
      Opening room editor.
    </div>
  );
}
