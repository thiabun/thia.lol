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
import { PostCard } from "../components/social/PostCard";
import { RoomCard } from "../components/social/RoomCard";
import { deletePost, getDiscoverFeed, getHomeFeed, getRooms, getStats, updatePost } from "../lib/api";
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
                  Posts from follows, moots, rooms, and recent conversations.
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

function AnonymousHomePage() {
  const discoverState = useAsyncData(getDiscoverFeed);
  const statsState = useAsyncData(getStats);
  const posts = discoverState.data?.posts.slice(0, 4) ?? [];
  const rooms = discoverState.data?.activeRooms.slice(0, 3) ?? [];
  const people = (discoverState.data?.peopleToWatch ?? [])
    .filter((person) => !/^smoketest[0-9]+$/i.test(person.handle))
    .slice(0, 4);
  const stats = statsState.data;

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

      <Panel className="p-5 sm:p-6">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div className="min-w-0">
            <BrandLogoMain size="md" data-testid="home-brand-logo-main" />
            <h1 className="mt-5 max-w-3xl text-3xl font-semibold tracking-normal text-text sm:text-4xl">
              A small social place for profiles, rooms, and public posts.
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted sm:text-base sm:leading-7">
              Find people, follow conversations, and make a public profile that feels like a place instead of a dashboard.
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
      </Panel>

      <section className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4" aria-label="thia.lol public stats">
        <StatTile label="Public posts" value={stats?.publicPosts} loading={statsState.loading} />
        <StatTile label="Public rooms" value={stats?.publicRooms} loading={statsState.loading} />
        <StatTile label="Active members" value={stats?.activeUsers} loading={statsState.loading} />
        <StatTile label="Reactions" value={stats?.totalReactions} loading={statsState.loading} />
      </section>

      {discoverState.error && !discoverState.data ? (
        <ApiStateNotice
          kind="error"
          title="Public activity is not available"
          text="Try refreshing in a moment."
        />
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="space-y-4" aria-label="Public posts">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-text">Rising now</h2>
              <p className="mt-1 text-sm text-muted">Public posts people can open from anywhere.</p>
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
          {discoverState.loading ? (
            <ApiStateNotice kind="loading" title="Loading public posts" text="Loading public posts." />
          ) : null}
          {!discoverState.loading && !discoverState.error && posts.length === 0 ? (
            <EmptyState icon={MessageCircle} title="No posts yet" text="No public posts." />
          ) : null}
          {posts.map((post, index) => (
            <PostCard key={post.id} post={post} index={index} />
          ))}
        </section>

        <aside className="space-y-5" aria-label="Public discovery">
          <AnonymousRooms rooms={rooms} loading={discoverState.loading} />
          <AnonymousPeople people={people} loading={discoverState.loading} />
        </aside>
      </div>
    </motion.div>
  );
}

function StatTile({
  label,
  loading,
  value,
}: {
  label: string;
  loading: boolean;
  value: number | undefined;
}) {
  return (
    <Panel className="p-3">
      <p className="text-xs font-medium uppercase tracking-normal text-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-text">
        {loading && value === undefined ? "..." : formatPublicStat(value ?? 0)}
      </p>
    </Panel>
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

function formatPublicStat(value: number): string {
  return new Intl.NumberFormat("en", { notation: "compact" }).format(value);
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
