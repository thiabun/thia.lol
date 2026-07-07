import { Hash, MessageCircle, Radio, Search, Star, UsersRound } from "lucide-react";
import { motion } from "motion/react";
import { useMemo, useState } from "react";
import { Link } from "react-router";
import { PageMeta } from "../components/PageMeta";
import { FeedRefreshControls } from "../components/social/FeedRefreshControls";
import { PostCard } from "../components/social/PostCard";
import { RoomCard } from "../components/social/RoomCard";
import { ApiStateNotice } from "../components/ui/ApiStateNotice";
import { Avatar } from "../components/ui/Avatar";
import { Badge } from "../components/ui/Badge";
import { Button, ButtonLink } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { Panel } from "../components/ui/Panel";
import { RouteHeader } from "../components/ui/RouteState";
import { deletePost, getDiscoverFeed, updatePost } from "../lib/api";
import { cn } from "../lib/classNames";
import { canDeletePost, canHidePost } from "../lib/postPermissions";
import { cardEntrance, pageEntrance } from "../lib/motionPresets";
import { formatCountWithUnit } from "../lib/pluralize";
import type { DiscoverPerson, Post, Room } from "../lib/types";
import { useAsyncData } from "../lib/useAsyncData";
import { useAuth } from "../lib/useAuth";

export function DiscoverPage() {
  const { csrfToken, user } = useAuth();
  const discoverState = useAsyncData(getDiscoverFeed);
  const [removedPostIds, setRemovedPostIds] = useState<Set<number>>(() => new Set());
  const [pendingPostId, setPendingPostId] = useState<number | undefined>();
  const [postActionError, setPostActionError] = useState<string | undefined>();
  const rooms = discoverState.data?.activeRooms ?? [];
  const people = (discoverState.data?.peopleToWatch ?? []).filter(
    (person) => !/^smoketest[0-9]+$/i.test(person.handle),
  );
  const visibleRooms = rooms.slice(0, 5);
  const visiblePeople = people.slice(0, 5);
  const visiblePosts = useMemo(
    () =>
      (discoverState.data?.posts ?? []).filter((post) => !removedPostIds.has(post.id)),
    [discoverState.data?.posts, removedPostIds],
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
    <motion.div
      className="space-y-4"
      variants={pageEntrance}
      initial="hidden"
      animate="show"
    >
      <PageMeta
        title="Discover"
        description="Public activity."
        path="/discover"
      />
      <section>
        <motion.div variants={cardEntrance} custom={0} initial="hidden" animate="show">
          <RouteHeader
            surface="bare"
            title="Discover"
            description="Public posts, rooms, and people."
            meta={
              <div className="flex flex-wrap gap-2">
                <ButtonLink
                  to="/search"
                  variant="secondary"
                  size="sm"
                  icon={<Search aria-hidden="true" size={15} />}
                >
                  Search
                </ButtonLink>
                <ButtonLink
                  to="/rooms"
                  variant="secondary"
                  size="sm"
                  icon={<Radio aria-hidden="true" size={15} />}
                >
                  Browse rooms
                </ButtonLink>
              </div>
            }
            actions={
              <FeedRefreshControls
                className="md:self-end"
                lastLoadedAt={discoverState.lastLoadedAt}
                refreshError={discoverState.refreshError}
                refreshing={discoverState.refreshing}
                disabled={discoverState.loading}
                onRefresh={discoverState.reload}
              />
            }
          />
        </motion.div>
      </section>

      {discoverState.loading ? (
        <ApiStateNotice
          kind="loading"
          title="Loading activity"
          text="Loading activity."
        />
      ) : null}

      {discoverState.error && !discoverState.data ? (
        <ApiStateNotice
          kind="error"
          title="Discovery feed is not available"
          text="Try refreshing in a moment."
          actions={
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => void discoverState.reload()}
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

      <div
        className={discoverLayoutClass(visibleRooms.length > 0, visiblePeople.length > 0)}
        data-testid="discover-layout"
      >
        {visibleRooms.length > 0 ? (
          <DiscoverRoomsSection
            rooms={visibleRooms}
            className={discoverRoomsSectionClass()}
          />
        ) : null}

        <DiscoverRisingSection
          posts={visiblePosts}
          loading={discoverState.loading}
          error={discoverState.error}
          pendingPostId={pendingPostId}
          canDelete={(post) => canDeletePost(user, post)}
          canHide={() => canHidePost(user)}
          onDelete={(post) => void handleDeletePost(post)}
          onHide={(post) => void handleHidePost(post)}
          className={discoverRisingSectionClass(visibleRooms.length > 0)}
        />

        {visiblePeople.length > 0 ? (
          <DiscoverPeopleSection
            people={visiblePeople}
            className={discoverPeopleSectionClass(visibleRooms.length > 0)}
          />
        ) : null}
      </div>
    </motion.div>
  );
}

function DiscoverRisingSection({
  canDelete,
  canHide,
  className,
  error,
  loading,
  onDelete,
  onHide,
  pendingPostId,
  posts,
}: {
  canDelete: (post: Post) => boolean;
  canHide: (post: Post) => boolean;
  className?: string;
  error: unknown;
  loading: boolean;
  onDelete: (post: Post) => void;
  onHide: (post: Post) => void;
  pendingPostId: number | undefined;
  posts: Post[];
}) {
  return (
    <section
      className={className}
      aria-label="Rising posts"
      data-testid="discover-rising-feed"
    >
      <div className="mb-3 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-text">Rising</h2>
        </div>
      </div>
      <div className="space-y-4">
        {!loading && !error && posts.length === 0 ? (
          <EmptyState
            icon={Hash}
            title="No posts yet"
            text="No public posts."
          />
        ) : null}

        {posts.map((post, index) => (
          <PostCard
            key={post.id}
            post={post}
            index={index}
            canDelete={canDelete(post)}
            canHide={canHide(post)}
            actionPending={pendingPostId === post.id}
            onDelete={(targetPost) => onDelete(targetPost)}
            onHide={(targetPost) => onHide(targetPost)}
          />
        ))}
      </div>
    </section>
  );
}

function DiscoverRoomsSection({
  className,
  rooms,
}: {
  className?: string;
  rooms: Room[];
}) {
  return (
    <section
      className={className}
      aria-label="Active rooms"
      data-testid="discover-rooms-rail"
    >
      <div className="mb-3 flex items-center justify-between gap-4">
        <h2 className="text-xl font-semibold text-text">Active rooms</h2>
        <Link
          to="/rooms"
          className="text-sm font-medium text-accent-strong underline-offset-4 hover:underline"
        >
          View all
        </Link>
      </div>
      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-1">
        {rooms.map((room, index) => (
          <RoomCard key={room.id} room={room} index={index} />
        ))}
      </div>
    </section>
  );
}

function DiscoverPeopleSection({
  className,
  people,
}: {
  className?: string;
  people: DiscoverPerson[];
}) {
  return (
    <section
      className={className}
      aria-label="People"
      data-testid="discover-people-rail"
    >
      <div className="mb-3 flex items-center justify-between gap-4">
        <h2 className="text-xl font-semibold text-text">People</h2>
        <Link
          to="/search"
          className="text-sm font-medium text-accent-strong underline-offset-4 hover:underline"
        >
          Search
        </Link>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-1">
        {people.map((person, index) => (
          <PersonCard key={person.handle} person={person} index={index} />
        ))}
      </div>
    </section>
  );
}

function discoverLayoutClass(hasRooms: boolean, hasPeople: boolean) {
  return cn(
    "grid gap-4 xl:items-start xl:justify-center",
    hasRooms && hasPeople &&
      "xl:grid-cols-[minmax(14rem,18rem)_minmax(0,38rem)_minmax(14rem,18rem)]",
    hasRooms && !hasPeople &&
      "xl:grid-cols-[minmax(14rem,20rem)_minmax(0,38rem)]",
    !hasRooms && hasPeople &&
      "xl:grid-cols-[minmax(0,38rem)_minmax(14rem,20rem)]",
    !hasRooms && !hasPeople && "xl:grid-cols-[minmax(0,38rem)]",
  );
}

function discoverRoomsSectionClass() {
  return "order-2 min-w-0 xl:sticky xl:top-20 xl:order-none xl:col-start-1 xl:row-start-1 xl:max-h-[calc(100vh-6rem)] xl:overflow-y-auto xl:pr-1";
}

function discoverRisingSectionClass(hasRooms: boolean) {
  return cn(
    "order-1 min-w-0 xl:order-none xl:row-start-1",
    hasRooms ? "xl:col-start-2" : "xl:col-start-1",
  );
}

function discoverPeopleSectionClass(hasRooms: boolean) {
  return cn(
    "order-3 min-w-0 xl:sticky xl:top-20 xl:order-none xl:row-start-1 xl:max-h-[calc(100vh-6rem)] xl:overflow-y-auto xl:pl-1",
    hasRooms ? "xl:col-start-3" : "xl:col-start-2",
  );
}

function PersonCard({
  index,
  person,
}: {
  index: number;
  person: DiscoverPerson;
}) {
  return (
    <motion.article
      variants={cardEntrance}
      custom={index}
      initial="hidden"
      animate="show"
      data-render-deferred="side-rail"
    >
      <Panel interactive className="h-full p-3 shadow-none">
        <Link
          to={`/@${person.handle}`}
          className="flex h-full flex-col focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-focus"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <Avatar
                user={{
                  displayName: person.displayName,
                  initials: person.initials,
                  aura: "frost",
                  avatarUrl: person.avatarUrl ?? null,
                }}
              />
              <div className="min-w-0">
                <h3 className="truncate text-sm font-semibold text-text">
                  {person.displayName}
                </h3>
                <p className="truncate text-sm text-muted">@{person.handle}</p>
              </div>
            </div>
            {person.isMoot ? (
              <Badge tone="leaf">Moot</Badge>
            ) : person.isFollowing ? (
              <Badge tone="cool">Following</Badge>
            ) : null}
          </div>
          {person.bioSnippet ? (
            <p className="mt-3 line-clamp-2 flex-1 text-sm leading-5 text-muted">
              {person.bioSnippet}
            </p>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted">
            <span className="inline-flex items-center gap-1 rounded-control bg-canvas/55 px-1.5 py-0.5">
              <MessageCircle aria-hidden="true" size={14} />
              {formatCountWithUnit(person.postCount, "post")}
            </span>
            <span className="inline-flex items-center gap-1 rounded-control bg-canvas/55 px-1.5 py-0.5">
              <Star aria-hidden="true" size={14} />
              {formatCountWithUnit(person.starCount, "star")}
            </span>
            <span className="inline-flex items-center gap-1 rounded-control bg-canvas/55 px-1.5 py-0.5">
              <UsersRound aria-hidden="true" size={14} />
              {formatCountWithUnit(person.followerCount, "follower")}
            </span>
          </div>
        </Link>
      </Panel>
    </motion.article>
  );
}
