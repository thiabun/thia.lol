import { Activity, ArrowRight, Radio, Sparkles, UsersRound } from "lucide-react";
import { motion } from "motion/react";
import { useMemo, useState } from "react";
import { PageMeta } from "../components/PageMeta";
import { ButtonLink } from "../components/ui/Button";
import { AmbientImage } from "../components/ui/AmbientImage";
import { ApiStateNotice } from "../components/ui/ApiStateNotice";
import { Badge } from "../components/ui/Badge";
import { Panel } from "../components/ui/Panel";
import { Composer } from "../components/social/Composer";
import { PostCard } from "../components/social/PostCard";
import { RoomCard } from "../components/social/RoomCard";
import { posts as fallbackPosts, rooms as fallbackRooms } from "../data/mockData";
import { deletePost, getFeed, getRooms, updatePost } from "../lib/api";
import { canDeletePost, canHidePost } from "../lib/postPermissions";
import type { Post } from "../lib/types";
import { useAsyncData } from "../lib/useAsyncData";
import { useAuth } from "../lib/useAuth";

export function HomePage() {
  const { csrfToken, user } = useAuth();
  const feedState = useAsyncData(getFeed, fallbackPosts);
  const roomsState = useAsyncData(getRooms, fallbackRooms);
  const [createdPosts, setCreatedPosts] = useState<Post[]>([]);
  const [removedPostIds, setRemovedPostIds] = useState<Set<number>>(() => new Set());
  const [pendingPostId, setPendingPostId] = useState<number | undefined>();
  const [postActionError, setPostActionError] = useState<string | undefined>();
  const feedPosts = feedState.data ?? fallbackPosts;
  const posts = useMemo(
    () =>
      [...createdPosts, ...feedPosts]
        .filter((post, index, allPosts) => {
          if (removedPostIds.has(post.id)) {
            return false;
          }

          return allPosts.findIndex((item) => item.id === post.id) === index;
        }),
    [createdPosts, feedPosts, removedPostIds],
  );
  const rooms = roomsState.data ?? fallbackRooms;

  function handlePostCreated(post: Post) {
    setCreatedPosts((current) => [post, ...current]);
    setRemovedPostIds((current) => {
      const next = new Set(current);
      next.delete(post.id);
      return next;
    });
  }

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
    setCreatedPosts((current) => current.filter((post) => post.id !== postId));
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_370px]">
      <PageMeta
        title="thia.lol"
        description="A soft social platform for rooms, signals, profiles, and slow return."
        path="/"
      />
      <section className="space-y-5" aria-label="Home feed">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 180, damping: 24 }}
        >
          <Panel className="overflow-hidden">
            <div className="grid gap-0 md:grid-cols-[minmax(0,1fr)_290px]">
              <div className="p-5 sm:p-6">
                <Badge tone="warm">platform pulse</Badge>
                <h1 className="mt-4 max-w-2xl text-3xl font-semibold tracking-normal text-text sm:text-4xl">
                  A soft social surface for rooms, signals, and slow return.
                </h1>
                <p className="mt-4 max-w-2xl text-base leading-7 text-muted">
                  thia.lol opens on the living platform: live rooms, recent posts,
                  and a studio-ready stream with room-first presence.
                </p>
                <div className="mt-5 flex flex-wrap gap-3">
                  <ButtonLink
                    to="/discover"
                    icon={<Sparkles aria-hidden="true" size={17} />}
                  >
                    Discover
                  </ButtonLink>
                  <ButtonLink
                    to="/rooms"
                    variant="secondary"
                    icon={<Radio aria-hidden="true" size={17} />}
                  >
                    Rooms
                  </ButtonLink>
                </div>
              </div>
              <div className="relative min-h-64 overflow-hidden border-t border-line md:border-l md:border-t-0">
                <AmbientImage
                  className="absolute inset-0"
                  loading="eager"
                  priority
                  overlay
                />
                <div className="absolute inset-x-4 bottom-4 rounded-card border border-white/35 bg-surface/72 p-4 shadow-soft backdrop-blur-veil">
                  <p className="text-xs font-medium uppercase text-muted">
                    Current atmosphere
                  </p>
                  <p className="mt-2 text-lg font-semibold text-text">
                    Sunveil active · Frostveil ready
                  </p>
                </div>
              </div>
            </div>
          </Panel>
        </motion.div>

        <Composer rooms={rooms} onCreated={handlePostCreated} />

        {feedState.loading ? (
          <ApiStateNotice
            kind="loading"
            title="Loading platform pulse"
            text="Recent public posts are loading from the read-only API."
          />
        ) : null}

        {feedState.usingFallback ? (
          <ApiStateNotice
            kind="fallback"
            title="Showing local pulse"
            text="The PHP API did not answer, so recent signals are using bundled mock data."
          />
        ) : null}

        {postActionError ? (
          <p className="rounded-card border border-rose/30 bg-rose/15 p-3 text-sm text-rose-ink">
            {postActionError}
          </p>
        ) : null}

        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-text">Recent signals</h2>
            <p className="mt-1 text-sm text-muted">Room-first posts from the platform.</p>
          </div>
          <ButtonLink
            to="/discover"
            variant="ghost"
            icon={<ArrowRight aria-hidden="true" size={16} />}
          >
            More
          </ButtonLink>
        </div>

        {posts.map((post, index) => (
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
      </section>

      <aside className="space-y-5" aria-label="Platform sidebar">
        <Panel className="p-5">
          <div className="flex items-center gap-3">
            <div className="grid size-11 place-items-center rounded-full bg-surface-strong text-accent-strong">
              <Activity aria-hidden="true" size={20} />
            </div>
            <div>
              <h2 className="text-base font-semibold text-text">Live texture</h2>
              <p className="text-sm text-muted">soft, active, moderated</p>
            </div>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <Metric label="Rooms" value={rooms.length || 4} icon={Radio} />
            <Metric label="Members" value="1.1k" icon={UsersRound} />
          </div>
        </Panel>

        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-semibold text-text">Live rooms</h2>
            <Badge tone="leaf">open</Badge>
          </div>
          <div className="space-y-3">
            {rooms.slice(0, 2).map((room) => (
              <RoomCard key={room.id} room={room} />
            ))}
          </div>
          {roomsState.usingFallback ? (
            <div className="mt-3">
              <ApiStateNotice
                kind="fallback"
                title="Showing local rooms"
                text="Room cards are using bundled data until the API responds."
              />
            </div>
          ) : null}
        </div>
      </aside>
    </div>
  );
}

type MetricProps = {
  label: string;
  value: string | number;
  icon: typeof Radio;
};

function Metric({ label, value, icon: Icon }: MetricProps) {
  return (
    <div className="rounded-card border border-line bg-canvas/50 p-3">
      <div className="flex items-center gap-2 text-xs text-muted">
        <Icon aria-hidden="true" size={14} />
        {label}
      </div>
      <p className="mt-2 text-xl font-semibold text-text">{value}</p>
    </div>
  );
}
