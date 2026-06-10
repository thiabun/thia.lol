import { Award, MessageCircle, Radio, Repeat2, Reply } from "lucide-react";
import { motion } from "motion/react";
import { useMemo, useState } from "react";
import { useParams } from "react-router";
import { PageMeta } from "../components/PageMeta";
import { PostCard } from "../components/social/PostCard";
import { ProfileHeader } from "../components/social/ProfileHeader";
import { RoomCard } from "../components/social/RoomCard";
import { ApiStateNotice } from "../components/ui/ApiStateNotice";
import { EmptyState } from "../components/ui/EmptyState";
import {
  getProfile,
  getProfilePosts,
  getProfileReplies,
  getProfileRooms,
} from "../lib/api";
import { ApiClientError } from "../lib/apiClient";
import { cn } from "../lib/classNames";
import { cardEntrance, pageEntrance } from "../lib/motionPresets";
import type { Post } from "../lib/types";
import { useAsyncData } from "../lib/useAsyncData";
import { useAuth } from "../lib/useAuth";

type ProfileTab = "posts" | "replies" | "reblogs" | "rooms" | "badges";

export function ProfilePage() {
  const { handle, profileHandle } = useParams();
  const { status, user } = useAuth();
  const [activeTab, setActiveTab] = useState<ProfileTab>("posts");
  const normalizedHandle = (handle ?? profileHandle ?? "thia")
    .replace(/^@/, "")
    .toLowerCase();
  const profileLoader = useMemo(
    () => () => getProfile(normalizedHandle),
    [normalizedHandle],
  );
  const postsLoader = useMemo(
    () => () => getProfilePosts(normalizedHandle),
    [normalizedHandle],
  );
  const repliesLoader = useMemo(
    () => () => getProfileReplies(normalizedHandle),
    [normalizedHandle],
  );
  const roomsLoader = useMemo(
    () => () => getProfileRooms(normalizedHandle),
    [normalizedHandle],
  );
  const profileState = useAsyncData(profileLoader);
  const postsState = useAsyncData(postsLoader);
  const repliesState = useAsyncData(repliesLoader);
  const roomsState = useAsyncData(roomsLoader);
  const profile = profileState.data;
  const profilePosts = postsState.data ?? [];
  const profileReplies = repliesState.data ?? [];
  const profileRooms = roomsState.data ?? [];
  const profileMissing =
    profileState.error instanceof ApiClientError && profileState.error.status === 404;
  const isOwnProfile =
    status === "authenticated" &&
    Boolean(user) &&
    user?.handle.toLowerCase() === normalizedHandle;

  if (profileMissing) {
    return (
      <motion.div
        className="mx-auto max-w-4xl space-y-5"
        variants={pageEntrance}
        initial="hidden"
        animate="show"
      >
        <PageMeta
          title="Profile not found"
          description="This profile could not be found on thia.lol."
          path={`/@${normalizedHandle}`}
        />
        <EmptyState
          icon={MessageCircle}
          title="Profile not found"
          text="This profile may have moved or is not public."
        />
      </motion.div>
    );
  }

  if (!profile) {
    return (
      <motion.div
        className="mx-auto max-w-4xl space-y-5"
        variants={pageEntrance}
        initial="hidden"
        animate="show"
      >
        <PageMeta
          title={`@${normalizedHandle}`}
          description={`Profile for @${normalizedHandle} on thia.lol.`}
          path={`/@${normalizedHandle}`}
        />
        {profileState.loading ? (
          <ApiStateNotice
            kind="loading"
            title={`Loading @${normalizedHandle}`}
            text="Profile details are loading."
          />
        ) : (
          <ApiStateNotice
            kind="error"
            title="Profile is not available"
            text="Try refreshing in a moment."
          />
        )}
      </motion.div>
    );
  }

  return (
    <motion.div
      className="mx-auto max-w-4xl space-y-5"
      variants={pageEntrance}
      initial="hidden"
      animate="show"
    >
      <PageMeta
        title={`${profile.user.displayName} (@${profile.user.handle})`}
        description={profile.bio}
        path={`/@${profile.user.handle}`}
      />
      <ProfileHeader profile={profile} isOwnProfile={isOwnProfile} />
      <motion.div variants={cardEntrance} custom={1} initial="hidden" animate="show">
        <div
          aria-label="Profile sections"
          className="mb-4 flex gap-2 overflow-x-auto pb-1"
          role="tablist"
        >
          <ProfileTabButton
            active={activeTab === "posts"}
            count={profile.stats.posts}
            label="Posts"
            onClick={() => setActiveTab("posts")}
          />
          <ProfileTabButton
            active={activeTab === "replies"}
            count={profile.stats.replies}
            label="Replies"
            onClick={() => setActiveTab("replies")}
          />
          <ProfileTabButton
            active={activeTab === "reblogs"}
            comingLater
            disabled
            label="Reblogs"
            onClick={() => setActiveTab("reblogs")}
          />
          <ProfileTabButton
            active={activeTab === "rooms"}
            count={profile.stats.rooms}
            label="Rooms"
            onClick={() => setActiveTab("rooms")}
          />
          <ProfileTabButton
            active={activeTab === "badges"}
            label="Badges"
            onClick={() => setActiveTab("badges")}
          />
        </div>

        {activeTab === "posts" ? (
          <ProfilePostList
            emptyIcon={MessageCircle}
            emptyText="No posts yet"
            error={postsState.error}
            items={profilePosts}
            loading={postsState.loading}
            loadingText="Posts are loading."
          />
        ) : null}
        {activeTab === "replies" ? (
          <ProfilePostList
            emptyIcon={Reply}
            emptyText="No replies yet"
            error={repliesState.error}
            items={profileReplies}
            loading={repliesState.loading}
            loadingText="Replies are loading."
          />
        ) : null}
        {activeTab === "reblogs" ? (
          <EmptyState
            icon={Repeat2}
            title="Reblogs are coming later"
            text="Reblogs are not available yet."
          />
        ) : null}
        {activeTab === "rooms" ? (
          <ProfileRoomList
            error={roomsState.error}
            loading={roomsState.loading}
            rooms={profileRooms}
          />
        ) : null}
        {activeTab === "badges" ? (
          <EmptyState
            icon={Award}
            title="Badges"
            text="Badges are coming later."
          />
        ) : null}
      </motion.div>
    </motion.div>
  );
}

type ProfileTabButtonProps = {
  active: boolean;
  comingLater?: boolean;
  count?: number;
  disabled?: boolean;
  label: string;
  onClick: () => void;
};

function ProfileTabButton({
  active,
  comingLater = false,
  count,
  disabled = false,
  label,
  onClick,
}: ProfileTabButtonProps) {
  return (
    <button
      aria-selected={active}
      className={cn(
        "inline-flex min-h-10 shrink-0 items-center gap-2 rounded-control border px-4 text-sm font-semibold transition duration-fluid ease-fluid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
        active
          ? "border-line-strong bg-surface text-text shadow-soft"
          : "border-line bg-canvas/55 text-muted hover:border-line-strong hover:text-text",
        disabled && "cursor-not-allowed opacity-60 hover:border-line hover:text-muted",
      )}
      disabled={disabled}
      role="tab"
      title={comingLater ? "Coming later" : undefined}
      type="button"
      onClick={onClick}
    >
      {label}
      {comingLater ? (
        <span className="text-xs font-medium text-muted">Coming later</span>
      ) : null}
      {count !== undefined ? (
        <span className="text-xs font-medium text-muted">{count.toLocaleString()}</span>
      ) : null}
    </button>
  );
}

type ProfilePostListProps = {
  emptyIcon: typeof MessageCircle;
  emptyText: string;
  error: unknown;
  items: Post[] | undefined;
  loading: boolean;
  loadingText: string;
};

function ProfilePostList({
  emptyIcon,
  emptyText,
  error,
  items,
  loading,
  loadingText,
}: ProfilePostListProps) {
  const posts = items ?? [];

  if (loading) {
    return <ApiStateNotice kind="loading" title="Loading" text={loadingText} />;
  }

  if (error) {
    return (
      <ApiStateNotice
        kind="error"
        title="Posts are not available"
        text="Try refreshing in a moment."
      />
    );
  }

  if (posts.length === 0) {
    return <EmptyState icon={emptyIcon} title={emptyText} text={emptyText} />;
  }

  return (
    <div className="space-y-4">
      {posts.map((post, index) => (
        <PostCard key={post.id} post={post} index={index} />
      ))}
    </div>
  );
}

type ProfileRoomListProps = {
  error: unknown;
  loading: boolean;
  rooms: Awaited<ReturnType<typeof getProfileRooms>>;
};

function ProfileRoomList({ error, loading, rooms }: ProfileRoomListProps) {
  if (loading) {
    return (
      <ApiStateNotice kind="loading" title="Loading rooms" text="Rooms are loading." />
    );
  }

  if (error) {
    return (
      <ApiStateNotice
        kind="error"
        title="Rooms are not available"
        text="Try refreshing in a moment."
      />
    );
  }

  if (rooms.length === 0) {
    return <EmptyState icon={Radio} title="No rooms yet" text="No rooms yet" />;
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {rooms.map((room, index) => (
        <RoomCard key={room.slug} room={room} index={index} />
      ))}
    </div>
  );
}
