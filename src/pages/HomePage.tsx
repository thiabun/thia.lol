import {
  ArrowRight,
  Compass,
  MessageCircle,
  Radio,
  UsersRound,
} from "lucide-react";
import { motion } from "motion/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PageMeta } from "../components/PageMeta";
import { ButtonLink } from "../components/ui/Button";
import { ApiStateNotice } from "../components/ui/ApiStateNotice";
import { EmptyState } from "../components/ui/EmptyState";
import { Panel } from "../components/ui/Panel";
import { PostCard } from "../components/social/PostCard";
import { RoomCard } from "../components/social/RoomCard";
import { deletePost, getHomeFeed, getRooms, updatePost } from "../lib/api";
import { postCreatedEventName } from "../lib/postEvents";
import { canDeletePost, canHidePost } from "../lib/postPermissions";
import { cardEntrance, pageEntrance } from "../lib/motionPresets";
import type { Post } from "../lib/types";
import { useAsyncData } from "../lib/useAsyncData";
import { useAuth } from "../lib/useAuth";

export function HomePage() {
  const { csrfToken, status, user } = useAuth();
  const feedState = useAsyncData(getHomeFeed);
  const roomsState = useAsyncData(getRooms);
  const [createdPosts, setCreatedPosts] = useState<Post[]>([]);
  const [removedPostIds, setRemovedPostIds] = useState<Set<number>>(
    () => new Set(),
  );
  const [pendingPostId, setPendingPostId] = useState<number | undefined>();
  const [postActionError, setPostActionError] = useState<string | undefined>();
  const posts = useMemo(
    () => {
      const feedPosts = feedState.data?.posts ?? [];

      return [...createdPosts, ...feedPosts].filter((post, index, allPosts) => {
        if (removedPostIds.has(post.id)) {
          return false;
        }

        return allPosts.findIndex((item) => item.id === post.id) === index;
      });
    },
    [createdPosts, feedState.data, removedPostIds],
  );
  const rooms = roomsState.data ?? [];
  const isAnonymous = status === "anonymous";

  const handlePostCreated = useCallback((post: Post) => {
    setCreatedPosts((current) => [post, ...current]);
    setRemovedPostIds((current) => {
      const next = new Set(current);
      next.delete(post.id);
      return next;
    });
  }, []);

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

  return (
    <motion.div
      className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]"
      variants={pageEntrance}
      initial="hidden"
      animate="show"
    >
      <PageMeta
        title="thia.lol"
        description="A small social place for posts, rooms, and profiles."
        path="/"
      />
      <section className="space-y-4" aria-label="Home feed">
        <motion.div
          variants={cardEntrance}
          custom={0}
          initial="hidden"
          animate="show"
        >
          <Panel className="p-4 sm:p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div className="max-w-2xl">
                <h1 className="text-3xl font-semibold tracking-normal text-text">
                  Home
                </h1>
                <p className="mt-2 text-sm leading-6 text-muted">
                  {isAnonymous
                    ? "Recent posts from thia.lol."
                    : "Posts from follows, moots, rooms, and recent conversations."}
                </p>
              </div>
              <div className="flex flex-wrap gap-2 sm:flex-nowrap sm:justify-end">
                {isAnonymous ? (
                  <ButtonLink
                    to="/login"
                    size="sm"
                    icon={<UsersRound aria-hidden="true" size={16} />}
                  >
                    Sign in
                  </ButtonLink>
                ) : null}
                <ButtonLink
                  to="/discover"
                  size="sm"
                  variant={isAnonymous ? "secondary" : "primary"}
                  icon={<Compass aria-hidden="true" size={16} />}
                >
                  Discover
                </ButtonLink>
                <ButtonLink
                  to="/rooms"
                  size="sm"
                  variant="secondary"
                  icon={<Radio aria-hidden="true" size={16} />}
                >
                  Rooms
                </ButtonLink>
              </div>
            </div>
          </Panel>
        </motion.div>

        {feedState.loading ? (
          <ApiStateNotice
            kind="loading"
            title="Loading posts"
            text="Recent posts are loading."
          />
        ) : null}

        {feedState.error ? (
          <ApiStateNotice
            kind="error"
            title="Home feed is not available"
            text="Try refreshing in a moment."
          />
        ) : null}

        {postActionError ? (
          <p className="rounded-card border border-rose/30 bg-rose/15 p-3 text-sm text-rose-ink">
            {postActionError}
          </p>
        ) : null}

        <div className="flex items-center justify-between gap-4">
          <h2 className="text-xl font-semibold text-text">Recent posts</h2>
          <ButtonLink
            to="/discover"
            variant="ghost"
            size="icon"
            aria-label="Open Discover"
            title="Open Discover"
            icon={<ArrowRight aria-hidden="true" size={16} />}
          />
        </div>

        {!feedState.loading && !feedState.error && posts.length === 0 ? (
          <EmptyState
            icon={MessageCircle}
            title="No posts yet"
            text="Public posts will appear here."
          />
        ) : null}

        {posts.length > 0
          ? posts.map((post, index) => (
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
            ))
          : null}
      </section>

      <aside className="space-y-4" aria-label="Platform sidebar">
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-semibold text-text">Rooms</h2>
            <ButtonLink
              to="/rooms"
              variant="ghost"
              size="icon"
              aria-label="Open Rooms"
              title="Open Rooms"
              icon={<ArrowRight aria-hidden="true" size={16} />}
            />
          </div>
          <div className="space-y-2">
            {rooms.slice(0, 3).map((room, index) => (
              <RoomCard key={room.id} room={room} index={index} />
            ))}
          </div>
          {!roomsState.loading && !roomsState.error && rooms.length === 0 ? (
            <EmptyState
              icon={Radio}
              title="No rooms yet"
              text="Public rooms will appear here."
            />
          ) : null}
          {roomsState.error ? (
            <div className="mt-3">
              <ApiStateNotice
                kind="error"
                title="Rooms are not available"
                text="Try refreshing in a moment."
              />
            </div>
          ) : null}
        </div>
      </aside>
    </motion.div>
  );
}
