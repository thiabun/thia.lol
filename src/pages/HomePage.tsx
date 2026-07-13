import {
  ArrowRight,
  Compass,
  Gamepad2,
  MessageCircle,
  PenLine,
  Radio,
  Search,
  UserRound,
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
import { RouteHeader } from "../components/ui/RouteState";
import { PostCard } from "../components/social/PostCard";
import { RoomCard } from "../components/social/RoomCard";
import { deletePost, getDiscoverFeed, getHomeFeed, getRooms, updatePost } from "../lib/api";
import { postCreatedEventName } from "../lib/postEvents";
import { canDeletePost, canHidePost } from "../lib/postPermissions";
import { cardEntrance, pageEntrance } from "../lib/motionPresets";
import type { Post, Room } from "../lib/types";
import { useAsyncData } from "../lib/useAsyncData";
import { useAuth } from "../lib/useAuth";

export function HomePage() {
  const { status } = useAuth();

  if (status === "loading") {
    return (
      <div className="mx-auto w-full max-w-3xl py-6" data-testid="home-auth-loading">
        <ApiStateNotice
          kind="loading"
          title="Loading thia.lol"
          text="Finding your place."
        />
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
  const roomsState = useAsyncData(getRooms);
  const discoverPosts = discoverState.data?.posts ?? [];
  const publicHomePosts = publicHomeState.data?.posts ?? [];
  const posts = discoverPosts.length > 0 ? discoverPosts : publicHomePosts;
  const activeRooms = useMemo(
    () => discoverState.data?.activeRooms ?? [],
    [discoverState.data?.activeRooms],
  );
  const starterRooms = useMemo(
    () => selectStarterRooms(roomsState.data ?? [], activeRooms),
    [activeRooms, roomsState.data],
  );
  const heroPost =
    posts.find((post) => post.room && starterRoomSlugSet.has(post.room.slug)) ??
    posts[0];
  const freshPosts = posts
    .filter((post) => post.id !== heroPost?.id)
    .slice(0, 4);
  const publicActivityUnavailable = Boolean(
    discoverState.error && publicHomeState.error && posts.length === 0,
  );

  return (
    <motion.div
      className="mx-auto max-w-6xl space-y-10 pb-6 sm:space-y-14"
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

      <section className="py-4 sm:py-8" aria-labelledby="home-intro-title">
        <div className="grid min-w-0 gap-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(20rem,0.95fr)] lg:items-center">
          <div className="min-w-0">
            <h1
              id="home-intro-title"
              className="max-w-3xl text-balance text-4xl font-semibold leading-[1.04] tracking-[-0.035em] text-text sm:text-5xl lg:text-6xl"
            >
              A calmer social home for creative people and small internet circles.
            </h1>
            <p className="mt-5 max-w-2xl text-pretty text-base leading-7 text-muted sm:text-lg sm:leading-8">
              Make a profile that feels like you, gather in rooms, and post what
              you’re making, playing, or thinking about—without ads, engagement
              traps, or AI sludge.
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <ButtonLink
                to="/rooms"
                className="min-h-12 justify-between px-5 text-base sm:min-w-48"
              >
                <span>Explore rooms</span>
                <ArrowRight aria-hidden="true" size={18} />
              </ButtonLink>
              <ButtonLink
                to="/register"
                variant="secondary"
                className="min-h-12 px-5 text-base sm:min-w-48"
                icon={<UserRound aria-hidden="true" size={18} />}
              >
                Create your profile
              </ButtonLink>
            </div>
          </div>

          {heroPost ? (
            <div
              className="min-w-0 rounded-panel border border-line/75 bg-surface/58 p-2 shadow-soft sm:p-3"
              data-testid="anonymous-product-preview"
            >
              <PostCard post={heroPost} index={0} />
            </div>
          ) : (
            <Panel className="grid min-h-64 place-items-center p-6 text-center">
              <div>
                <Radio aria-hidden="true" className="mx-auto text-accent" size={28} />
                <p className="mt-3 text-base font-semibold text-text">
                  A place that starts with people.
                </p>
                <p className="mt-1 text-sm leading-6 text-muted">
                  Public posts will appear here as the community wakes up.
                </p>
              </div>
            </Panel>
          )}
        </div>

        <HowItWorks />
      </section>

      {publicActivityUnavailable ? (
        <ApiStateNotice
          kind="error"
          title="Public activity is not available"
          text="Try refreshing in a moment."
        />
      ) : null}

      <StarterCommunities
        rooms={starterRooms}
        loading={roomsState.loading && starterRooms.length === 0}
        error={Boolean(roomsState.error && starterRooms.length === 0)}
      />

      <section className="space-y-4" aria-label="Fresh from the community">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-text sm:text-3xl">
              Fresh from the community
            </h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-muted sm:text-base">
              Art, game worlds, works in progress, and small thoughts from around thia.lol.
            </p>
          </div>
          <ButtonLink
            to="/discover"
            variant="quiet"
            size="sm"
            icon={<ArrowRight aria-hidden="true" size={15} />}
          >
            Open Discover
          </ButtonLink>
        </div>

        {discoverState.loading || (discoverPosts.length === 0 && publicHomeState.loading) ? (
          <ApiStateNotice
            kind="loading"
            title="Loading public posts"
            text="Loading public posts."
          />
        ) : null}

        {!discoverState.loading &&
        !publicHomeState.loading &&
        !publicActivityUnavailable &&
        freshPosts.length === 0 ? (
          <EmptyState icon={MessageCircle} title="No posts yet" text="No public posts." />
        ) : null}

        {freshPosts.length > 0 ? (
          <div className="grid min-w-0 gap-4 lg:grid-cols-2">
            {freshPosts.map((post, index) => (
              <PostCard key={post.id} post={post} index={index} />
            ))}
          </div>
        ) : null}
      </section>

      <Panel className="p-5 sm:p-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-text sm:text-3xl">
              Bring your corner of the internet.
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted sm:text-base">
              Make a profile, join a room, or invite a few people you already like.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <ButtonLink
              to="/register"
              className="min-h-11 px-5"
            >
              <span>Create your profile</span>
              <ArrowRight aria-hidden="true" size={17} />
            </ButtonLink>
            <ButtonLink
              to="/rooms"
              variant="secondary"
              className="min-h-11 px-5"
            >
              <span>Explore rooms</span>
              <ArrowRight aria-hidden="true" size={17} />
            </ButtonLink>
          </div>
        </div>
      </Panel>
    </motion.div>
  );
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

function HowItWorks() {
  const items = [
    {
      title: "Profiles",
      text: "Your little corner of the internet.",
      icon: UserRound,
    },
    {
      title: "Rooms",
      text: "Shared spaces for an interest or group.",
      icon: Radio,
    },
    {
      title: "Posts",
      text: "Share on your profile or into a room.",
      icon: PenLine,
    },
  ];

  return (
    <div className="mt-10 grid divide-y divide-line/75 border-y border-line/75 lg:grid-cols-3 lg:divide-x lg:divide-y-0">
      {items.map((item) => {
        const Icon = item.icon;

        return (
          <div key={item.title} className="flex items-center gap-4 px-2 py-5 sm:px-4">
            <span className="grid size-12 shrink-0 place-items-center rounded-card border border-line bg-accent/10 text-text">
              <Icon aria-hidden="true" size={21} />
            </span>
            <span>
              <h2 className="text-base font-semibold text-text">{item.title}</h2>
              <span className="mt-0.5 block text-sm leading-5 text-muted">{item.text}</span>
            </span>
          </div>
        );
      })}
    </div>
  );
}

function StarterCommunities({
  error,
  loading,
  rooms,
}: {
  error: boolean;
  loading: boolean;
  rooms: Room[];
}) {
  return (
    <section className="space-y-4" aria-label="Starter communities">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-text sm:text-3xl">
            Start somewhere
          </h2>
          <p className="mt-1 text-sm leading-6 text-muted sm:text-base">
            Three rooms with a reason to walk in.
          </p>
        </div>
        <ButtonLink
          to="/rooms"
          variant="quiet"
          size="sm"
          icon={<ArrowRight aria-hidden="true" size={15} />}
        >
          Browse all rooms
        </ButtonLink>
      </div>

      {loading ? (
        <ApiStateNotice
          kind="loading"
          title="Loading starter rooms"
          text="Loading starter rooms."
        />
      ) : null}

      {error ? (
        <ApiStateNotice
          kind="error"
          title="Starter rooms are not available"
          text="Explore all rooms or try again in a moment."
        />
      ) : null}

      <div className="space-y-2">
        {rooms.length > 0 ? (
          <div className="grid auto-rows-fr gap-3 md:grid-cols-2 xl:grid-cols-3">
            {rooms.map((room, index) => (
              <RoomCard key={room.id} room={room} index={index} />
            ))}
          </div>
        ) : null}
      </div>

      {!loading && !error && rooms.length === 0 ? (
        <EmptyState
          icon={Gamepad2}
          title="No starter rooms yet"
          text="Explore all rooms while new communities get ready."
        />
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
