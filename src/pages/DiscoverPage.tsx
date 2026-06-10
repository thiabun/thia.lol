import { Hash, Radio, UserRound } from "lucide-react";
import { useMemo, useState } from "react";
import { PageMeta } from "../components/PageMeta";
import { PostCard } from "../components/social/PostCard";
import { RoomCard } from "../components/social/RoomCard";
import { ApiStateNotice } from "../components/ui/ApiStateNotice";
import { Badge } from "../components/ui/Badge";
import { EmptyState } from "../components/ui/EmptyState";
import { Panel } from "../components/ui/Panel";
import { AmbientImage } from "../components/ui/AmbientImage";
import { SearchField } from "../components/ui/Field";
import { deletePost, getFeed, getRooms, getStats, updatePost } from "../lib/api";
import { canDeletePost, canHidePost } from "../lib/postPermissions";
import { pluralize } from "../lib/pluralize";
import type { Post, PublicStats } from "../lib/types";
import { useAsyncData } from "../lib/useAsyncData";
import { useAuth } from "../lib/useAuth";

const icons = {
  thread: Hash,
  person: UserRound,
  room: Radio,
};

export function DiscoverPage() {
  const { csrfToken, user } = useAuth();
  const postsState = useAsyncData(getFeed);
  const roomsState = useAsyncData(getRooms);
  const statsState = useAsyncData(getStats);
  const [removedPostIds, setRemovedPostIds] = useState<Set<number>>(() => new Set());
  const [pendingPostId, setPendingPostId] = useState<number | undefined>();
  const [postActionError, setPostActionError] = useState<string | undefined>();
  const rooms = roomsState.data ?? [];
  const stats = statsState.data;
  const discoverItems = useMemo(
    () => makeDiscoverItems(stats, Boolean(statsState.error)),
    [stats, statsState.error],
  );
  const visiblePosts = useMemo(
    () => (postsState.data ?? []).filter((post) => !removedPostIds.has(post.id)),
    [postsState.data, removedPostIds],
  );

  async function handleDeletePost(post: Post) {
    if (!csrfToken) {
      setPostActionError("Your session needs to refresh before deleting.");
      return;
    }

    setPendingPostId(post.id);
    setPostActionError(undefined);

    try {
      await deletePost(post.id, csrfToken);
      markPostRemoved(post.id);
    } catch (caught) {
      setPostActionError(caught instanceof Error ? caught.message : "Post could not be deleted.");
    } finally {
      setPendingPostId(undefined);
    }
  }

  async function handleHidePost(post: Post) {
    if (!csrfToken) {
      setPostActionError("Your session needs to refresh before hiding.");
      return;
    }

    setPendingPostId(post.id);
    setPostActionError(undefined);

    try {
      await updatePost(post.id, { status: "hidden" }, csrfToken);
      markPostRemoved(post.id);
    } catch (caught) {
      setPostActionError(caught instanceof Error ? caught.message : "Post could not be hidden.");
    } finally {
      setPendingPostId(undefined);
    }
  }

  function markPostRemoved(postId: number) {
    setRemovedPostIds((current) => new Set(current).add(postId));
  }

  return (
    <div className="space-y-6">
      <PageMeta
        title="Discover"
        description="Find rooms, people, and recent posts across thia.lol."
        path="/discover"
      />
      <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Panel className="p-5 sm:p-6">
          <Badge tone="cool">discover</Badge>
          <h1 className="mt-4 text-3xl font-semibold tracking-normal text-text">
            Find rooms, people, and recent posts.
          </h1>
          <SearchField
            id="discover-search"
            label="Search"
            placeholder="Search people, rooms, posts"
            className="mt-5"
          />
        </Panel>

        <Panel className="overflow-hidden">
          <AmbientImage className="aspect-[16/10] w-full" />
          <div className="p-5">
            <p className="text-sm font-semibold text-text">Browse around</p>
            <p className="mt-2 text-sm leading-6 text-muted">
              A few good places to start, from active rooms to friendly profiles.
            </p>
          </div>
        </Panel>
      </section>

      {postsState.loading ? (
        <ApiStateNotice
          kind="loading"
          title="Loading recent posts"
          text="Fresh posts are on the way."
        />
      ) : null}

      {postsState.error ? (
        <ApiStateNotice
          kind="error"
          title="Posts are not available"
          text="Try refreshing in a moment."
        />
      ) : null}

      {postActionError ? (
        <p className="rounded-card border border-rose/30 bg-rose/15 p-3 text-sm text-rose-ink">
          {postActionError}
        </p>
      ) : null}

      <section aria-label="Recent public posts">
        <div className="mb-3 flex items-center justify-between gap-4">
          <h2 className="text-xl font-semibold text-text">Recent posts</h2>
          <Badge tone="warm">public</Badge>
        </div>
        <div className="space-y-4">
          {!postsState.loading && !postsState.error && visiblePosts.length === 0 ? (
            <EmptyState
              icon={Hash}
              title="No posts yet"
              text="Public posts will appear here."
            />
          ) : null}

          {visiblePosts.map((post, index) => (
            <PostCard
              key={post.id}
              post={post}
              index={index}
              canDelete={canDeletePost(user, post)}
              canHide={canHidePost(user)}
              actionPending={pendingPostId === post.id}
              onDelete={(targetPost) => void handleDeletePost(targetPost)}
              onHide={(targetPost) => void handleHidePost(targetPost)}
            />
          ))}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4" aria-label="Discovery">
        {discoverItems.map((item) => {
          const Icon = icons[item.kind];
          return (
            <Panel key={item.id} interactive className="p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="grid size-11 place-items-center rounded-card bg-surface-strong text-accent-strong">
                  <Icon aria-hidden="true" size={19} />
                </div>
                <Badge>{item.count}</Badge>
              </div>
              <h2 className="mt-5 text-lg font-semibold text-text">{item.label}</h2>
              <p className="mt-2 text-sm leading-6 text-muted">{item.description}</p>
            </Panel>
          );
        })}
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between gap-4">
          <h2 className="text-xl font-semibold text-text">Rooms to visit</h2>
          <Badge tone="leaf">public</Badge>
        </div>
        {roomsState.loading ? (
          <ApiStateNotice
            kind="loading"
            title="Loading rooms"
            text="Public rooms are loading."
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
            title="No rooms yet"
            text="Public rooms will appear here."
          />
        ) : null}
        {rooms.length > 0 ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {rooms.slice(0, 6).map((room) => (
              <RoomCard key={room.id} room={room} />
            ))}
          </div>
        ) : null}
      </section>
    </div>
  );
}

function makeDiscoverItems(stats: PublicStats | undefined, unavailable: boolean) {
  const countText = (value: number | undefined, noun: string) => {
    if (value !== undefined) {
      return pluralize(value, noun);
    }

    return unavailable ? "Unavailable" : "Loading";
  };

  return [
    {
      id: 1,
      label: "Public rooms",
      description: "Open places for shared topics and conversations.",
      count: countText(stats?.publicRooms, "room"),
      kind: "room" as const,
    },
    {
      id: 2,
      label: "Recent posts",
      description: "Fresh public notes from across the site.",
      count: countText(stats?.publicPosts, "post"),
      kind: "thread" as const,
    },
    {
      id: 3,
      label: "Active members",
      description: "Profiles that can read, post, and join the conversation.",
      count: countText(stats?.activeUsers, "member"),
      kind: "person" as const,
    },
    {
      id: 4,
      label: "Likes",
      description: "Signals from public posts people have appreciated.",
      count: countText(stats?.totalReactions, "like"),
      kind: "thread" as const,
    },
  ];
}
