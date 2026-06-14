import { ArrowRight, Hash, MessageCircle, UsersRound } from "lucide-react";
import { motion } from "motion/react";
import { useMemo, useState } from "react";
import { Link } from "react-router";
import { PageMeta } from "../components/PageMeta";
import { PostCard } from "../components/social/PostCard";
import { RoomCard } from "../components/social/RoomCard";
import { ApiStateNotice } from "../components/ui/ApiStateNotice";
import { Avatar } from "../components/ui/Avatar";
import { Badge } from "../components/ui/Badge";
import { ButtonLink } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { Panel } from "../components/ui/Panel";
import { deletePost, getDiscoverFeed, updatePost } from "../lib/api";
import { canDeletePost, canHidePost } from "../lib/postPermissions";
import { cardEntrance, pageEntrance } from "../lib/motionPresets";
import { formatCountWithUnit } from "../lib/pluralize";
import type { DiscoverPerson, Post } from "../lib/types";
import { useAsyncData } from "../lib/useAsyncData";
import { useAuth } from "../lib/useAuth";

export function DiscoverPage() {
  const { csrfToken, user } = useAuth();
  const discoverState = useAsyncData(getDiscoverFeed);
  const [removedPostIds, setRemovedPostIds] = useState<Set<number>>(() => new Set());
  const [pendingPostId, setPendingPostId] = useState<number | undefined>();
  const [postActionError, setPostActionError] = useState<string | undefined>();
  const rooms = discoverState.data?.activeRooms ?? [];
  const people = discoverState.data?.peopleToWatch ?? [];
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
      className="space-y-5"
      variants={pageEntrance}
      initial="hidden"
      animate="show"
    >
      <PageMeta
        title="Discover"
        description="Discover rising posts, active rooms, and people to watch on thia.lol."
        path="/discover"
      />
      <section>
        <motion.div variants={cardEntrance} custom={0} initial="hidden" animate="show">
          <Panel className="p-4 sm:p-5">
            <h1 className="text-3xl font-semibold tracking-normal text-text">
              Discover
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
              Public posts, active rooms, and members.
            </p>
          </Panel>
        </motion.div>
      </section>

      {discoverState.loading ? (
        <ApiStateNotice
          kind="loading"
          title="Loading Discover"
          text="Public activity is loading."
        />
      ) : null}

      {discoverState.error ? (
        <ApiStateNotice
          kind="error"
          title="Discovery feed is not available"
          text="Try refreshing in a moment."
        />
      ) : null}

      {postActionError ? (
        <p className="rounded-card border border-rose/30 bg-rose/15 p-3 text-sm text-rose-ink">
          {postActionError}
        </p>
      ) : null}

      <section aria-label="Rising posts">
        <div className="mb-3 flex items-center justify-between gap-4">
          <h2 className="text-xl font-semibold text-text">Rising</h2>
        </div>
        <div className="space-y-4">
          {!discoverState.loading && !discoverState.error && visiblePosts.length === 0 ? (
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

      {rooms.length > 0 ? (
        <section aria-label="Active rooms">
          <div className="mb-3 flex items-center justify-between gap-4">
            <h2 className="text-xl font-semibold text-text">Active rooms</h2>
            <ButtonLink
              to="/rooms"
              variant="ghost"
              size="icon"
              aria-label="Open Rooms"
              title="Open Rooms"
              icon={<ArrowRight aria-hidden="true" size={16} />}
            />
          </div>
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {rooms.map((room, index) => (
              <RoomCard key={room.id} room={room} index={index} />
            ))}
          </div>
        </section>
      ) : null}

      {people.length > 0 ? (
        <section aria-label="People">
          <div className="mb-3 flex items-center justify-between gap-4">
            <h2 className="text-xl font-semibold text-text">People</h2>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {people.map((person, index) => (
              <PersonCard key={person.handle} person={person} index={index} />
            ))}
          </div>
        </section>
      ) : null}
    </motion.div>
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
            <span className="inline-flex items-center gap-1.5 rounded-full bg-canvas/55 px-2 py-1">
              <MessageCircle aria-hidden="true" size={14} />
              {formatCountWithUnit(person.postCount, "post")}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-canvas/55 px-2 py-1">
              <UsersRound aria-hidden="true" size={14} />
              {formatCountWithUnit(person.followerCount, "follower")}
            </span>
          </div>
        </Link>
      </Panel>
    </motion.article>
  );
}
