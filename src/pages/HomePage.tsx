import {
  ArrowRight,
  Compass,
  MessageCircle,
  PenLine,
  Radio,
  Search,
  Sparkles,
  UserPlus,
} from "lucide-react";
import { motion } from "motion/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useOutletContext } from "react-router";
import type { AppShellOutletContext } from "../components/layout/AppShell";
import { PageMeta } from "../components/PageMeta";
import { BrandLogoMain } from "../components/BrandLogo";
import { FeedRefreshControls } from "../components/social/FeedRefreshControls";
import { Button, ButtonLink } from "../components/ui/Button";
import { ApiStateNotice } from "../components/ui/ApiStateNotice";
import { Avatar } from "../components/ui/Avatar";
import { EmptyState } from "../components/ui/EmptyState";
import { Panel } from "../components/ui/Panel";
import { RouteHeader } from "../components/ui/RouteState";
import { PostCard } from "../components/social/PostCard";
import { RoomCard } from "../components/social/RoomCard";
import { deletePost, getDiscoverFeed, getHomeFeed, getRooms, updatePost } from "../lib/api";
import { postCreatedEventName } from "../lib/postEvents";
import { canDeletePost, canHidePost } from "../lib/postPermissions";
import { cardEntrance, pageEntrance } from "../lib/motionPresets";
import type { DiscoverPerson, Post, Room } from "../lib/types";
import { useAsyncData } from "../lib/useAsyncData";
import { useAuth } from "../lib/useAuth";

export function HomePage() {
  const { status } = useAuth();

  if (status === "anonymous") {
    return <AnonymousHomePage />;
  }

  return <AuthenticatedHomePage />;
}

function AuthenticatedHomePage() {
  const { csrfToken, user } = useAuth();
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
        <motion.div
          variants={cardEntrance}
          custom={0}
          initial="hidden"
          animate="show"
        >
          <RouteHeader
            surface="bare"
            title="Home"
            description="Posts from follows, rooms, and recent conversations."
            actions={
              <FeedRefreshControls
                lastLoadedAt={feedState.lastLoadedAt}
                refreshError={feedState.refreshError}
                refreshing={feedState.refreshing}
                disabled={feedState.loading}
                onRefresh={feedState.reload}
              />
            }
          />
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

        <h2 className="text-base font-semibold text-text">For you</h2>

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

function AnonymousHomePage() {
  const discoverState = useAsyncData(getDiscoverFeed);
  const publicHomeState = useAsyncData(getHomeFeed);
  const discoverPosts = discoverState.data?.posts ?? [];
  const publicHomePosts = publicHomeState.data?.posts ?? [];
  const posts = (discoverPosts.length > 0 ? discoverPosts : publicHomePosts).slice(0, 4);
  const rooms = discoverState.data?.activeRooms.slice(0, 3) ?? [];
  const people = (discoverState.data?.peopleToWatch ?? [])
    .filter((person) => !/^smoketest[0-9]+$/i.test(person.handle))
    .slice(0, 4);

  return (
    <motion.div
      className="mx-auto max-w-6xl space-y-5"
      variants={pageEntrance}
      initial="hidden"
      animate="show"
      data-testid="anonymous-home"
    >
      <PageMeta
        title="thia.lol"
        description="A living social place for public profiles, rooms, posts, and shared presence."
        path="/"
      />

      <section className="py-3 sm:py-4" aria-labelledby="home-intro-title">
        <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div className="min-w-0">
            <BrandLogoMain size="md" data-testid="home-brand-logo-main" />
            <h1
              id="home-intro-title"
              className="mt-4 max-w-3xl text-2xl font-semibold tracking-normal text-text sm:text-3xl"
            >
              A small social place for profiles, rooms, and public posts.
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
              Find people, follow conversations, and make a public profile that feels like a place.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 lg:justify-end">
            <ButtonLink
              to="/register"
              icon={<UserPlus aria-hidden="true" size={16} />}
            >
              Create account
            </ButtonLink>
            <ButtonLink
              to="/discover"
              variant="secondary"
              icon={<Compass aria-hidden="true" size={16} />}
            >
              Discover
            </ButtonLink>
            <ButtonLink
              to="/search"
              variant="secondary"
              icon={<Search aria-hidden="true" size={16} />}
            >
              Search
            </ButtonLink>
          </div>
        </div>
      </section>

      {discoverState.error && !discoverState.data ? (
        <ApiStateNotice
          kind="error"
          title="Public activity is not available"
          text="Try refreshing in a moment."
        />
      ) : null}

      <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        <section className="space-y-3" aria-label="Public posts">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-text">Rising now</h2>
            </div>
            <ButtonLink
              to="/discover"
              variant="quiet"
              size="sm"
              icon={<ArrowRight aria-hidden="true" size={15} />}
            >
              Discover
            </ButtonLink>
          </div>
          {discoverState.loading || (discoverPosts.length === 0 && publicHomeState.loading) ? (
            <ApiStateNotice kind="loading" title="Loading public posts" text="Loading public posts." />
          ) : null}
          {!discoverState.loading && !publicHomeState.loading && !discoverState.error && posts.length === 0 ? (
            <EmptyState icon={MessageCircle} title="No posts yet" text="No public posts." />
          ) : null}
          {posts.map((post, index) => (
            <PostCard key={post.id} post={post} index={index} />
          ))}
        </section>

        <aside className="space-y-4" aria-label="Public discovery" data-render-deferred="side-rail">
          <AnonymousRooms rooms={rooms} loading={discoverState.loading} />
          <AnonymousPeople people={people} loading={discoverState.loading} />
        </aside>
      </div>
    </motion.div>
  );
}

function AnonymousRooms({
  loading,
  rooms,
}: {
  loading: boolean;
  rooms: Room[];
}) {
  return (
    <section className="space-y-3" aria-label="Rooms to explore">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-text">Rooms</h2>
        <ButtonLink to="/rooms" variant="quiet" size="sm">
          Browse
        </ButtonLink>
      </div>
      <div className="space-y-2">
        {rooms.map((room, index) => (
          <RoomCard key={room.id} room={room} index={index} />
        ))}
      </div>
      {!loading && rooms.length === 0 ? (
        <EmptyState icon={Radio} title="No rooms yet" text="No public rooms." />
      ) : null}
    </section>
  );
}

function AnonymousPeople({
  loading,
  people,
}: {
  loading: boolean;
  people: DiscoverPerson[];
}) {
  return (
    <section className="space-y-3" aria-label="People to find">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-text">People</h2>
        <ButtonLink to="/search" variant="quiet" size="sm">
          Search
        </ButtonLink>
      </div>
      <div className="grid gap-2">
        {people.map((person) => (
          <Link
            key={person.handle}
            to={`/@${person.handle}`}
            className="flex items-center gap-3 rounded-card border border-line bg-surface/70 p-3 shadow-soft transition duration-fluid hover:border-line-strong"
          >
            <Avatar user={{ ...person, aura: "frost" }} size="sm" />
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-text">{person.displayName}</span>
              <span className="block truncate text-xs text-muted">@{person.handle}</span>
            </span>
          </Link>
        ))}
      </div>
      {!loading && people.length === 0 ? (
        <EmptyState icon={Sparkles} title="No people yet" text="No public profiles." />
      ) : null}
    </section>
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
          size="sm"
          className="min-h-10 justify-start font-semibold shadow-soft"
          icon={<PenLine aria-hidden="true" size={16} />}
          onClick={onPostClick}
        >
          Write a post
        </Button>
      </div>
    </Panel>
  );
}
