import { Clock3, MessageCircle, PenLine, Radio } from "lucide-react";
import { motion } from "motion/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useOutletContext, useParams } from "react-router";
import { PageMeta } from "../components/PageMeta";
import { PostCard } from "../components/social/PostCard";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { Panel } from "../components/ui/Panel";
import {
  deletePost,
  getRoom,
  getRoomPosts,
  updatePost,
} from "../lib/api";
import { ApiClientError } from "../lib/apiClient";
import { postCreatedEventName } from "../lib/postEvents";
import { canDeletePost, canHidePost } from "../lib/postPermissions";
import { cardEntrance, pageEntrance } from "../lib/motionPresets";
import { formatCountWithUnit } from "../lib/pluralize";
import type { AppShellOutletContext } from "../components/layout/AppShell";
import type { Post, Room } from "../lib/types";
import { useAsyncData } from "../lib/useAsyncData";
import { useAuth } from "../lib/useAuth";

export function RoomPage() {
  const { csrfToken, user } = useAuth();
  const { openPostComposer } = useOutletContext<AppShellOutletContext>();
  const { slug = "" } = useParams();
  const normalizedSlug = slug.toLowerCase();
  const roomLoader = useMemo(
    () => () => getRoom(normalizedSlug),
    [normalizedSlug],
  );
  const postsLoader = useMemo(
    () => () => getRoomPosts(normalizedSlug),
    [normalizedSlug],
  );
  const roomState = useAsyncData(roomLoader);
  const postsState = useAsyncData(postsLoader);
  const [createdPosts, setCreatedPosts] = useState<Post[]>([]);
  const [removedPostIds, setRemovedPostIds] = useState<Set<number>>(
    () => new Set(),
  );
  const [pendingPostId, setPendingPostId] = useState<number | undefined>();
  const [postActionError, setPostActionError] = useState<string | undefined>();
  const room = roomState.data;
  const posts = useMemo(
    () => {
      const roomPosts = postsState.data ?? [];

      return [
        ...createdPosts.filter((post) => post.room.slug === normalizedSlug),
        ...roomPosts,
      ].filter((post, index, allPosts) => {
        if (removedPostIds.has(post.id)) {
          return false;
        }

        return allPosts.findIndex((item) => item.id === post.id) === index;
      });
    },
    [createdPosts, normalizedSlug, postsState.data, removedPostIds],
  );
  const roomMissing =
    roomState.error instanceof ApiClientError && roomState.error.status === 404;

  const handlePostCreated = useCallback(
    (post: Post) => {
      if (post.room.slug !== normalizedSlug) {
        return;
      }

      setCreatedPosts((current) => [post, ...current]);
      setRemovedPostIds((current) => {
        const next = new Set(current);
        next.delete(post.id);
        return next;
      });
    },
    [normalizedSlug],
  );

  useEffect(() => {
    function handleCreated(event: Event) {
      const post = (event as CustomEvent<Post>).detail;

      if (post) {
        handlePostCreated(post);
      }
    }

    window.addEventListener(postCreatedEventName, handleCreated);

    return () => window.removeEventListener(postCreatedEventName, handleCreated);
  }, [handlePostCreated]);

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
      setPostActionError(
        caught instanceof Error ? caught.message : "Post could not be deleted.",
      );
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
      setPostActionError(
        caught instanceof Error ? caught.message : "Post could not be hidden.",
      );
    } finally {
      setPendingPostId(undefined);
    }
  }

  function markPostRemoved(postId: number) {
    setRemovedPostIds((current) => new Set(current).add(postId));
    setCreatedPosts((current) => current.filter((post) => post.id !== postId));
  }

  if (roomMissing) {
    return (
      <motion.div
        className="space-y-6"
        data-testid="room-page"
        variants={pageEntrance}
        initial="hidden"
        animate="show"
      >
        <PageMeta
          title="Room not found"
          description="This room could not be found on thia.lol."
          path={`/rooms/${normalizedSlug}`}
        />
        <EmptyState
          icon={Radio}
          title="Room not found"
          text="This room may have moved or is not public."
        />
      </motion.div>
    );
  }

  return (
    <motion.div
      className="space-y-6"
      data-testid="room-page"
      variants={pageEntrance}
      initial="hidden"
      animate="show"
    >
      <PageMeta
        title={room ? `${room.name} Room` : "Room"}
        description={room?.summary ?? "A public room on thia.lol."}
        path={`/rooms/${normalizedSlug}`}
      />

      {room ? (
        <RoomHeader
          room={room}
          postCount={posts.length > room.postCount ? posts.length : room.postCount}
          onPost={() => openPostComposer(room.slug)}
        />
      ) : roomState.loading ? (
        <RoomNotice title="Opening room" text="The room is loading." />
      ) : (
        <RoomNotice
          title="Room is not available"
          text="Try refreshing in a moment."
          tone="rose"
        />
      )}

      {postsState.loading ? (
        <RoomNotice title="Loading posts" text="The feed is filling in." />
      ) : null}

      {postsState.error && !postsState.loading ? (
        <RoomNotice
          title="Posts are not available"
          text="Try refreshing in a moment."
          tone="rose"
        />
      ) : null}

      {postActionError ? (
        <p className="rounded-card border border-rose/30 bg-rose/15 p-3 text-sm text-rose-ink">
          {postActionError}
        </p>
      ) : null}

      {!postsState.loading && !postsState.error && room && posts.length === 0 ? (
        <EmptyState
          icon={MessageCircle}
          title="No posts here yet"
          text="Start the room with the first post."
        />
      ) : null}

      {posts.length > 0 ? (
        <section className="space-y-4" aria-label={`${room?.name ?? "Room"} posts`}>
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
      ) : null}
    </motion.div>
  );
}

function RoomHeader({
  onPost,
  postCount,
  room,
}: {
  onPost: () => void;
  postCount: number;
  room: Room;
}) {
  return (
    <motion.div variants={cardEntrance} custom={0} initial="hidden" animate="show">
      <Panel className="overflow-hidden">
        <div
          className="h-2"
          style={{
            background:
              "linear-gradient(90deg, var(--room-accent), color-mix(in oklab, var(--room-accent) 28%, transparent))",
            ["--room-accent" as string]: room.accent,
          }}
        />
        <div className="p-5 sm:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 max-w-3xl">
              <div className="flex flex-wrap gap-2">
                <Badge tone="leaf">room</Badge>
                {room.mood ? <Badge>{room.mood}</Badge> : null}
                {room.visibility ? <Badge tone="cool">{room.visibility}</Badge> : null}
              </div>
              <h1 className="mt-4 text-3xl font-semibold tracking-normal text-text sm:text-4xl">
                {room.name}
              </h1>
              <p className="mt-1 text-base text-muted">/{room.slug}</p>
              <p className="mt-4 max-w-2xl text-base leading-7 text-muted">
                {room.description || room.summary}
              </p>
            </div>
            <Button
              type="button"
              className="w-full shrink-0 sm:w-auto"
              data-testid="room-post-button"
              icon={<PenLine aria-hidden="true" size={17} />}
              onClick={onPost}
            >
              Post
            </Button>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:max-w-xl">
            <RoomMetric
              icon={MessageCircle}
              label="Posts"
              value={formatCountWithUnit(postCount, "post")}
            />
            <RoomMetric
              icon={Clock3}
              label="Latest"
              value={
                room.latestActivityAt
                  ? formatActivityTime(room.latestActivityAt)
                  : "No activity yet"
              }
            />
          </div>
        </div>
      </Panel>
    </motion.div>
  );
}

function RoomMetric({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof MessageCircle;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-card border border-line bg-canvas/50 p-3">
      <div className="flex items-center gap-2 text-xs text-muted">
        <Icon aria-hidden="true" size={14} />
        {label}
      </div>
      <p className="mt-2 text-sm font-semibold text-text">{value}</p>
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

function formatActivityTime(value: string): string {
  const parsed = new Date(value.includes("T") ? value : value.replace(" ", "T"));

  if (Number.isNaN(parsed.getTime())) {
    return "active recently";
  }

  const seconds = Math.round((parsed.getTime() - Date.now()) / 1000);
  const absSeconds = Math.abs(seconds);

  if (absSeconds < 60) {
    return "active now";
  }

  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ["year", 60 * 60 * 24 * 365],
    ["month", 60 * 60 * 24 * 30],
    ["day", 60 * 60 * 24],
    ["hour", 60 * 60],
    ["minute", 60],
  ];
  const [unit, divisor] =
    units.find(([, unitSeconds]) => absSeconds >= unitSeconds) ?? units.at(-1)!;

  return new Intl.RelativeTimeFormat(undefined, { numeric: "auto" }).format(
    Math.round(seconds / divisor),
    unit,
  );
}
