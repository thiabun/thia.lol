import {
  MessageCircle,
  Radio,
} from "lucide-react";
import { motion } from "motion/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PageMeta } from "../components/PageMeta";
import { FeedRefreshControls } from "../components/social/FeedRefreshControls";
import { InfiniteFeedTrigger } from "../components/social/InfiniteFeedTrigger";
import { Button, ButtonLink } from "../components/ui/Button";
import { ApiStateNotice } from "../components/ui/ApiStateNotice";
import { EmptyState } from "../components/ui/EmptyState";
import { PostCard } from "../components/social/PostCard";
import { RoomCard } from "../components/social/RoomCard";
import { deletePost, getHomeFeed, getLandingFeed, getRooms, updatePost } from "../lib/api";
import { postCreatedEventName } from "../lib/postEvents";
import { canDeletePost, canHidePost } from "../lib/postPermissions";
import { pageEntrance } from "../lib/motionPresets";
import type { HomeFeed, Post, Room } from "../lib/types";
import { useAsyncData } from "../lib/useAsyncData";
import { useAuth } from "../lib/useAuth";
import { usePaginatedData } from "../lib/usePaginatedData";

export function HomePage() {
  const { status } = useAuth();

  if (status === "loading") {
    return (
      <div className="mx-auto w-full max-w-3xl py-6" data-testid="home-auth-loading">
        <ApiStateNotice kind="loading" title="Loading thia.lol" />
      </div>
    );
  }

  if (status === "anonymous") {
    return <AnonymousHomePage />;
  }

  return <AuthenticatedHomePage />;
}

function AuthenticatedHomePage() {
  const { csrfToken, user } = useAuth();
  const feedState = usePaginatedData(getHomeFeed, mergeHomeFeedPages);
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
      className="grid min-w-0 max-w-full gap-4 lg:grid-cols-[minmax(0,1fr)_300px]"
      variants={pageEntrance}
      initial="hidden"
      animate="show"
    >
      <PageMeta
        title="thia.lol"
        description="A small social place for posts, rooms, and profiles."
        path="/"
      />
      <section className="min-w-0 max-w-full space-y-3" aria-label="Home feed">
        <h1 className="sr-only">Home</h1>
        <div className="flex justify-end">
          <FeedRefreshControls
            lastLoadedAt={feedState.lastLoadedAt}
            refreshError={feedState.refreshError}
            refreshing={feedState.refreshing}
            disabled={feedState.loading}
            onRefresh={feedState.reload}
          />
        </div>

        {feedState.loading ? (
          <ApiStateNotice kind="loading" title="Loading posts" />
        ) : null}

        {feedState.error && posts.length === 0 ? (
          <ApiStateNotice
            kind="error"
            title="Home feed is not available"
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

        {!feedState.loading && !feedState.error && posts.length === 0 ? (
          <EmptyState icon={MessageCircle} title="No posts yet" />
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

        <InfiniteFeedTrigger
          hasMore={feedState.hasMore}
          loading={feedState.loadingMore}
          loadMoreError={feedState.loadMoreError}
          onLoadMore={feedState.loadMore}
        />
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
            <EmptyState icon={Radio} title="No rooms yet" />
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

function AnonymousHomePage() {
  const landingState = useAsyncData(getLandingFeed);
  const posts = landingState.data?.posts ?? [];
  const activeRooms = useMemo(
    () => landingState.data?.activeRooms ?? [],
    [landingState.data?.activeRooms],
  );
  const starterRooms = useMemo(
    () => selectStarterRooms(activeRooms, activeRooms),
    [activeRooms],
  );
  const visiblePosts = posts.slice(0, 6);
  const publicActivityUnavailable = Boolean(landingState.error && posts.length === 0);

  return (
    <motion.div
      className="mx-auto max-w-6xl space-y-4 pb-6"
      variants={pageEntrance}
      initial="hidden"
      animate="show"
      data-testid="anonymous-home"
    >
      <PageMeta
        title="thia.lol"
        description="A calmer social home for creative people and small internet circles."
        path="/"
      />

      <h1 className="sr-only">thia.lol</h1>

      {publicActivityUnavailable ? (
        <ApiStateNotice
          kind="error"
          title="Public activity is not available"
          text="Try refreshing in a moment."
        />
      ) : null}

      <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start">
        <section className="min-w-0 space-y-3" aria-label="Recent posts">
          <h2 className="text-base font-semibold text-text">Recent posts</h2>
          {landingState.loading ? (
            <ApiStateNotice kind="loading" title="Loading public posts" />
          ) : null}
          {!landingState.loading &&
          !publicActivityUnavailable &&
          visiblePosts.length === 0 ? (
            <EmptyState icon={MessageCircle} title="No posts yet" />
          ) : null}
          {visiblePosts.map((post, index) => (
            <PostCard key={post.id} post={post} index={index} />
          ))}
        </section>

        <aside className="space-y-3" aria-label="Rooms">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-text">Rooms</h2>
            <ButtonLink to="/rooms" variant="quiet" size="sm" className="min-h-11">
              View all
            </ButtonLink>
          </div>
          <div className="space-y-2">
            {starterRooms.map((room, index) => (
              <RoomCard key={room.id} room={room} index={index} />
            ))}
          </div>
          {!landingState.loading && !landingState.error && starterRooms.length === 0 ? (
            <EmptyState icon={Radio} title="No rooms yet" />
          ) : null}
        </aside>
      </div>
    </motion.div>
  );
}

function mergeHomeFeedPages(current: HomeFeed, next: HomeFeed): HomeFeed {
  const posts = [...current.posts, ...next.posts].filter(
    (post, index, allPosts) =>
      allPosts.findIndex((candidate) => candidate.id === post.id) === index,
  );

  return {
    ...next,
    personalized: current.personalized || next.personalized,
    posts,
  };
}

const starterRoomSlugs = ["start-here", "show-your-work", "cozy-games"] as const;
const starterRoomSlugSet = new Set<string>(starterRoomSlugs);

function selectStarterRooms(rooms: Room[], activeRooms: Room[]): Room[] {
  const publicRooms = rooms.filter((room) => room.visibility === "public");
  const publicActiveRooms = activeRooms.filter((room) => room.visibility === "public");
  const roomBySlug = new Map(
    publicRooms
      .filter(roomMeetsStarterCommunityBaseline)
      .map((room) => [room.slug, room]),
  );
  const selected = starterRoomSlugs.flatMap((slug) => {
    const room = roomBySlug.get(slug);
    return room ? [room] : [];
  });
  const selectedSlugs = new Set(selected.map((room) => room.slug));

  for (const room of [...publicActiveRooms, ...publicRooms]) {
    if (selected.length >= 3) {
      break;
    }

    if (!starterRoomSlugSet.has(room.slug) && !selectedSlugs.has(room.slug)) {
      selected.push(room);
      selectedSlugs.add(room.slug);
    }
  }

  return selected.slice(0, 3);
}

function roomMeetsStarterCommunityBaseline(room: Room): boolean {
  // Reply quality remains a human launch check because room summaries do not expose reply counts.
  return room.memberCount >= 3 && room.postCount >= 3;
}
