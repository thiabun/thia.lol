import {
  Compass,
  MessageCircle,
  PenLine,
  Radio,
  Search,
  UsersRound,
} from "lucide-react";
import { motion } from "motion/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router";
import type { AppShellOutletContext } from "../components/layout/AppShell";
import { PageMeta } from "../components/PageMeta";
import { FeedRefreshControls } from "../components/social/FeedRefreshControls";
import { Button, ButtonLink } from "../components/ui/Button";
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
  const { openPostComposer } = useOutletContext<AppShellOutletContext>();
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
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div className="max-w-2xl">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <h1 className="text-3xl font-semibold tracking-normal text-text">
                    Home
                  </h1>
                  <span className="rounded-control border border-line bg-canvas/65 px-2.5 py-1 text-xs font-medium text-muted">
                    For you
                  </span>
                </div>
                <p className="mt-2 text-sm leading-6 text-muted">
                  {isAnonymous
                    ? "Recent posts from thia.lol."
                    : "Posts from follows, moots, rooms, and recent conversations."}
                </p>
              </div>
              <div className="flex flex-col gap-3 md:items-end">
                <FeedRefreshControls
                  lastLoadedAt={feedState.lastLoadedAt}
                  refreshError={feedState.refreshError}
                  refreshing={feedState.refreshing}
                  disabled={feedState.loading}
                  onRefresh={feedState.reload}
                />
                {isAnonymous ? (
                  <ButtonLink
                    to="/login"
                    size="sm"
                    icon={<UsersRound aria-hidden="true" size={16} />}
                  >
                    Sign in
                  </ButtonLink>
                ) : null}
              </div>
            </div>
          </Panel>
        </motion.div>

        {feedState.loading ? (
          <ApiStateNotice
            kind="loading"
            title="Loading posts"
            text="Loading posts."
          />
        ) : null}

        {feedState.error && posts.length === 0 ? (
          <ApiStateNotice
            kind="error"
            title="Home feed is not available"
            text="Try refreshing in a moment."
            actions={
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => void feedState.reload()}
              >
                Retry
              </Button>
            }
          />
        ) : null}

        {postActionError ? (
          <p className="rounded-card border border-rose/30 bg-rose/15 p-3 text-sm text-rose-ink">
            {postActionError}
          </p>
        ) : null}

        <h2 className="text-xl font-semibold text-text">For you</h2>

        {!feedState.loading && !feedState.error && posts.length === 0 ? (
          <EmptyState
            icon={MessageCircle}
            title="No posts yet"
            text="No public posts."
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
          <h2 className="mb-3 text-base font-semibold text-text">Rooms</h2>
          <div className="space-y-2">
            {rooms.slice(0, 3).map((room, index) => (
              <RoomCard key={room.id} room={room} index={index} />
            ))}
          </div>
          {!roomsState.loading && !roomsState.error && rooms.length === 0 ? (
            <EmptyState
              icon={Radio}
              title="No rooms yet"
              text="No rooms."
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
        <HomeExploreRail onPostClick={() => openPostComposer()} />
      </aside>
    </motion.div>
  );
}

function HomeExploreRail({ onPostClick }: { onPostClick: () => void }) {
  return (
    <Panel className="p-3">
      <h2 className="mb-3 text-base font-semibold text-text">Explore</h2>
      <div className="grid gap-2">
        <ButtonLink
          to="/search"
          variant="secondary"
          size="sm"
          className="justify-start"
          icon={<Search aria-hidden="true" size={16} />}
        >
          Search
        </ButtonLink>
        <ButtonLink
          to="/rooms"
          variant="secondary"
          size="sm"
          className="justify-start"
          icon={<Radio aria-hidden="true" size={16} />}
        >
          Browse rooms
        </ButtonLink>
        <ButtonLink
          to="/discover"
          variant="secondary"
          size="sm"
          className="justify-start"
          icon={<Compass aria-hidden="true" size={16} />}
        >
          Discover
        </ButtonLink>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="justify-start"
          icon={<PenLine aria-hidden="true" size={16} />}
          onClick={onPostClick}
        >
          Write a post
        </Button>
      </div>
    </Panel>
  );
}
