import {
  Award,
  Bug,
  CalendarDays,
  MessageCircle,
  Radio,
  Repeat2,
  Reply,
  Shield,
  Sparkles,
  Star,
  UserCheck,
  Users,
} from "lucide-react";
import { motion } from "motion/react";
import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { PageMeta } from "../components/PageMeta";
import { ProfileEditModal } from "../components/social/ProfileEditModal";
import { PostCard } from "../components/social/PostCard";
import { ProfileHeader } from "../components/social/ProfileHeader";
import { RoomCard } from "../components/social/RoomCard";
import { ApiStateNotice } from "../components/ui/ApiStateNotice";
import { Avatar } from "../components/ui/Avatar";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import {
  followProfile,
  getProfile,
  getProfileBadges,
  getProfileFollowers,
  getProfileFollowing,
  getProfilePosts,
  getProfileReblogs,
  getProfileReplies,
  getProfileRooms,
  unfollowProfile,
  updateFeaturedBadges,
  updateMyProfile,
  uploadImage,
  type FollowRelationship,
  type ImageUploadPurpose,
  type UpdateProfileInput,
  type UploadedImage,
} from "../lib/api";
import { ApiClientError } from "../lib/apiClient";
import { cn } from "../lib/classNames";
import { cardEntrance, pageEntrance } from "../lib/motionPresets";
import type {
  BadgeDefinition,
  Post,
  Profile,
  ProfileConnection,
  UserBadge,
} from "../lib/types";
import { useAsyncData } from "../lib/useAsyncData";
import { useAuth } from "../lib/useAuth";

type ProfileTab =
  | "posts"
  | "replies"
  | "reblogs"
  | "rooms"
  | "followers"
  | "following"
  | "badges";

export function ProfilePage() {
  const { handle, profileHandle } = useParams();
  const navigate = useNavigate();
  const { refreshSession, runWithAuth, status, user } = useAuth();
  const [activeTab, setActiveTab] = useState<ProfileTab>("posts");
  const [editingProfileHandle, setEditingProfileHandle] = useState<string | undefined>();
  const [profileOverride, setProfileOverride] = useState<Profile | undefined>();
  const [badgesOverride, setBadgesOverride] = useState<
    { handle: string; result: Awaited<ReturnType<typeof getProfileBadges>> } | undefined
  >();
  const [followState, setFollowState] = useState<
    { handle: string; relationship: FollowRelationship } | undefined
  >();
  const [followPosting, setFollowPosting] = useState(false);
  const [followError, setFollowError] = useState<
    { handle: string; message: string } | undefined
  >();
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
  const reblogsLoader = useMemo(
    () => () => getProfileReblogs(normalizedHandle),
    [normalizedHandle],
  );
  const roomsLoader = useMemo(
    () => () => getProfileRooms(normalizedHandle),
    [normalizedHandle],
  );
  const followersLoader = useMemo(
    () => () => getProfileFollowers(normalizedHandle),
    [normalizedHandle],
  );
  const followingLoader = useMemo(
    () => () => getProfileFollowing(normalizedHandle),
    [normalizedHandle],
  );
  const badgesLoader = useMemo(
    () => () => getProfileBadges(normalizedHandle),
    [normalizedHandle],
  );
  const profileState = useAsyncData(profileLoader);
  const postsState = useAsyncData(postsLoader);
  const repliesState = useAsyncData(repliesLoader);
  const reblogsState = useAsyncData(reblogsLoader);
  const roomsState = useAsyncData(roomsLoader);
  const followersState = useAsyncData(followersLoader);
  const followingState = useAsyncData(followingLoader);
  const badgesState = useAsyncData(badgesLoader);
  const activeFollowState =
    followState?.handle === normalizedHandle ? followState.relationship : undefined;
  const activeFollowError =
    followError?.handle === normalizedHandle ? followError.message : undefined;
  const sourceProfile =
    profileOverride?.user.handle.toLowerCase() === normalizedHandle
      ? profileOverride
      : profileState.data;
  const profile = mergeFollowState(sourceProfile, activeFollowState);
  const profilePosts = postsState.data ?? [];
  const profileReplies = repliesState.data ?? [];
  const profileReblogs = reblogsState.data ?? [];
  const profileRooms = roomsState.data ?? [];
  const profileFollowers = followersState.data ?? [];
  const profileFollowing = followingState.data ?? [];
  const profileBadgesResult =
    badgesOverride?.handle === normalizedHandle ? badgesOverride.result : badgesState.data;
  const profileBadges = profileBadgesResult?.badges ?? [];
  const featuredBadges = profileBadgesResult?.featuredBadges ?? [];
  const profileMissing =
    profileState.error instanceof ApiClientError && profileState.error.status === 404;
  const isOwnProfile =
    status === "authenticated" &&
    Boolean(user) &&
    user?.handle.toLowerCase() === normalizedHandle;
  const editingProfile = editingProfileHandle === normalizedHandle;

  async function handleFollowToggle() {
    if (!profile || isOwnProfile || followPosting) {
      return;
    }

    if (status !== "authenticated") {
      navigate("/login");
      return;
    }

    setFollowPosting(true);
    setFollowError(undefined);

    try {
      const nextState = await runWithAuth(
        (csrfToken) =>
          profile.isFollowing
            ? unfollowProfile(profile.user.handle, csrfToken)
            : followProfile(profile.user.handle, csrfToken),
        { retryOnCsrf: true },
      );

      setFollowState({
        handle: normalizedHandle,
        relationship: nextState,
      });
    } catch (error) {
      setFollowError({
        handle: normalizedHandle,
        message:
          error instanceof Error ? error.message : "Could not update follow state.",
      });
    } finally {
      setFollowPosting(false);
    }
  }

  async function handleProfileSave(input: UpdateProfileInput): Promise<Profile> {
    const updated = await runWithAuth(
      (csrfToken) => updateMyProfile(input, csrfToken),
      { retryOnCsrf: true },
    );

    setProfileOverride(updated);

    try {
      await refreshSession();
    } catch {
      // The visible profile is already refreshed; auth profile data can retry later.
    }

    return updated;
  }

  async function handleProfileImageUpload(
    file: File,
    purpose: ImageUploadPurpose,
  ): Promise<UploadedImage> {
    return runWithAuth((csrfToken) => uploadImage(file, purpose, csrfToken), {
      retryOnCsrf: true,
    });
  }

  async function handleFeaturedBadgesChange(featuredBadgeIds: number[]) {
    const updated = await runWithAuth(
      (csrfToken) => updateFeaturedBadges({ featuredBadgeIds }, csrfToken),
      { retryOnCsrf: true },
    );

    setBadgesOverride({ handle: normalizedHandle, result: updated });
  }

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
      <ProfileHeader
        profile={profile}
        featuredBadges={featuredBadges}
        followError={activeFollowError}
        followPosting={followPosting}
        isOwnProfile={isOwnProfile}
        messageToHandle={
          status === "authenticated" && !isOwnProfile && profile.isMoot
            ? profile.user.handle
            : undefined
        }
        onFollowToggle={handleFollowToggle}
        onEditProfile={
          isOwnProfile ? () => setEditingProfileHandle(normalizedHandle) : undefined
        }
        showChatHint={
          status === "authenticated" && !isOwnProfile && !profile.isMoot
        }
      />
      {isOwnProfile && editingProfile ? (
        <ProfileEditModal
          key={`${profile.user.handle}-${profile.updatedAt ?? ""}`}
          open={editingProfile}
          profile={profile}
          onClose={() => setEditingProfileHandle(undefined)}
          onSave={handleProfileSave}
          onUpload={handleProfileImageUpload}
        />
      ) : null}
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
            count={profileReblogs.length}
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
            active={activeTab === "followers"}
            count={profile.stats.followers}
            label="Followers"
            onClick={() => setActiveTab("followers")}
          />
          <ProfileTabButton
            active={activeTab === "following"}
            count={profile.stats.following}
            label="Following"
            onClick={() => setActiveTab("following")}
          />
          <ProfileTabButton
            active={activeTab === "badges"}
            count={profileBadges.length}
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
          <ProfilePostList
            emptyIcon={Repeat2}
            emptyText="No reblogs yet"
            error={reblogsState.error}
            items={profileReblogs}
            loading={reblogsState.loading}
            loadingText="Reblogs are loading."
          />
        ) : null}
        {activeTab === "rooms" ? (
          <ProfileRoomList
            error={roomsState.error}
            loading={roomsState.loading}
            rooms={profileRooms}
          />
        ) : null}
        {activeTab === "followers" ? (
          <ProfileConnectionList
            emptyIcon={Users}
            emptyText="No followers yet"
            error={followersState.error}
            items={profileFollowers}
            loading={followersState.loading}
            loadingText="Followers are loading."
          />
        ) : null}
        {activeTab === "following" ? (
          <ProfileConnectionList
            emptyIcon={UserCheck}
            emptyText="Not following anyone yet"
            error={followingState.error}
            items={profileFollowing}
            loading={followingState.loading}
            loadingText="Following is loading."
          />
        ) : null}
        {activeTab === "badges" ? (
          <ProfileBadgeList
            badges={profileBadges}
            error={badgesState.error}
            featuredBadges={featuredBadges}
            isOwnProfile={isOwnProfile}
            loading={badgesState.loading}
            onFeaturedChange={handleFeaturedBadgesChange}
          />
        ) : null}
      </motion.div>
    </motion.div>
  );
}

function mergeFollowState(
  profile: Profile | undefined,
  followState: FollowRelationship | undefined,
): Profile | undefined {
  if (!profile || !followState) {
    return profile;
  }

  const mootCount = followState.mootCount ?? profile.mootCount;

  return {
    ...profile,
    followerCount: followState.followerCount,
    followingCount: followState.followingCount,
    mootCount,
    isFollowing: followState.isFollowing,
    isFollowedBy: followState.isFollowedBy,
    isMoot: followState.isMoot,
    stats: {
      ...profile.stats,
      followers: followState.followerCount,
      following: followState.followingCount,
      moots: mootCount,
    },
  };
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

type ProfileBadgeListProps = {
  badges: UserBadge[];
  error: unknown;
  featuredBadges: UserBadge[];
  isOwnProfile: boolean;
  loading: boolean;
  onFeaturedChange: (featuredBadgeIds: number[]) => Promise<void>;
};

function ProfileBadgeList({
  badges,
  error,
  featuredBadges,
  isOwnProfile,
  loading,
  onFeaturedChange,
}: ProfileBadgeListProps) {
  const [pendingBadgeId, setPendingBadgeId] = useState<number | undefined>();
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const featuredIds = featuredBadges.map((userBadge) => userBadge.badge.id);
  const featuredIdSet = new Set(featuredIds);

  async function handleFeatureToggle(userBadge: UserBadge) {
    const badgeId = userBadge.badge.id;
    const nextIds = featuredIdSet.has(badgeId)
      ? featuredIds.filter((id) => id !== badgeId)
      : [...featuredIds, badgeId];

    setPendingBadgeId(userBadge.id);
    setErrorMessage(undefined);

    try {
      await onFeaturedChange(nextIds);
    } catch (caught) {
      setErrorMessage(
        caught instanceof Error ? caught.message : "Featured badges could not be saved.",
      );
    } finally {
      setPendingBadgeId(undefined);
    }
  }

  if (loading) {
    return (
      <ApiStateNotice
        kind="loading"
        title="Loading badges"
        text="Badges are loading."
      />
    );
  }

  if (error) {
    return (
      <ApiStateNotice
        kind="error"
        title="Badges are not available"
        text="Try refreshing in a moment."
      />
    );
  }

  if (badges.length === 0) {
    return <EmptyState icon={Award} title="No badges yet" text="No badges yet" />;
  }

  return (
    <div className="space-y-4">
      {errorMessage ? (
        <p className="rounded-card border border-rose/30 bg-rose/15 p-3 text-sm text-rose-ink">
          {errorMessage}
        </p>
      ) : null}
      <div className="grid gap-3 md:grid-cols-2">
        {badges.map((userBadge) => {
          const isFeatured = featuredIdSet.has(userBadge.badge.id);
          const featureLimitReached = featuredIds.length >= 3 && !isFeatured;

          return (
            <ProfileBadgeCard
              key={userBadge.id}
              userBadge={userBadge}
              featured={isFeatured}
              featureDisabled={featureLimitReached || pendingBadgeId !== undefined}
              isOwnProfile={isOwnProfile}
              pending={pendingBadgeId === userBadge.id}
              onFeatureToggle={() => void handleFeatureToggle(userBadge)}
            />
          );
        })}
      </div>
    </div>
  );
}

type ProfileBadgeCardProps = {
  userBadge: UserBadge;
  featured: boolean;
  featureDisabled: boolean;
  isOwnProfile: boolean;
  pending: boolean;
  onFeatureToggle: () => void;
};

function ProfileBadgeCard({
  featureDisabled,
  featured,
  isOwnProfile,
  onFeatureToggle,
  pending,
  userBadge,
}: ProfileBadgeCardProps) {
  const badge = userBadge.badge;

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-card border bg-surface p-4 shadow-soft",
        rarityBorderClass(badge.rarity),
      )}
    >
      <div
        className={cn(
          "absolute inset-x-0 top-0 h-1",
          rarityStripeClass(badge.rarity),
        )}
      />
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "grid size-12 shrink-0 place-items-center rounded-card border",
            rarityIconClass(badge.rarity),
          )}
        >
          {badgeIconElement(badge)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-text">{badge.name}</h3>
            <Badge tone={badgeTone(badge.rarity)}>{rarityLabel(badge.rarity)}</Badge>
            {featured ? <Badge tone="warm">Featured</Badge> : null}
          </div>
          <p className="mt-1 text-xs text-muted">
            Earned {formatBadgeDate(userBadge.earnedAt)}
          </p>
        </div>
      </div>
      {badge.description ? (
        <p className="mt-4 text-sm leading-6 text-muted">{badge.description}</p>
      ) : null}
      {userBadge.reason ? (
        <p className="mt-3 rounded-card border border-line bg-canvas/45 p-3 text-sm leading-6 text-text">
          <span className="font-semibold">Reason</span>: {userBadge.reason}
        </p>
      ) : null}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <span className="text-xs font-medium uppercase text-muted">
          {sourceLabel(badge.source)}
        </span>
        {isOwnProfile ? (
          <Button
            type="button"
            variant={featured ? "secondary" : "ghost"}
            size="sm"
            disabled={featureDisabled}
            icon={<Star aria-hidden="true" size={15} />}
            onClick={onFeatureToggle}
          >
            {pending ? "Saving" : featured ? "Unfeature" : "Feature"}
          </Button>
        ) : null}
      </div>
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

type ProfileConnectionListProps = {
  emptyIcon: typeof Users;
  emptyText: string;
  error: unknown;
  items: ProfileConnection[] | undefined;
  loading: boolean;
  loadingText: string;
};

function ProfileConnectionList({
  emptyIcon,
  emptyText,
  error,
  items,
  loading,
  loadingText,
}: ProfileConnectionListProps) {
  const connections = items ?? [];

  if (loading) {
    return <ApiStateNotice kind="loading" title="Loading" text={loadingText} />;
  }

  if (error) {
    return (
      <ApiStateNotice
        kind="error"
        title="Profiles are not available"
        text="Try refreshing in a moment."
      />
    );
  }

  if (connections.length === 0) {
    return <EmptyState icon={emptyIcon} title={emptyText} text={emptyText} />;
  }

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {connections.map((connection) => (
        <Link
          key={connection.handle}
          className="flex min-h-24 items-center gap-3 rounded-card border border-line bg-surface p-4 shadow-soft transition duration-fluid ease-fluid hover:-translate-y-0.5 hover:border-line-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus motion-reduce:hover:translate-y-0"
          to={`/@${connection.handle}`}
        >
          <Avatar
            user={{
              aura: "frost",
              avatarUrl: connection.avatarUrl ?? null,
              displayName: connection.displayName,
              initials: connection.initials,
            }}
            size="md"
          />
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-2">
              <span className="truncate text-sm font-semibold text-text">
                {connection.displayName}
              </span>
              {connection.isMoot ? <Badge>Moot</Badge> : null}
            </span>
            <span className="mt-0.5 block truncate text-xs text-muted">
              @{connection.handle}
            </span>
            {connection.bioSnippet ? (
              <span className="mt-2 line-clamp-2 block text-sm leading-6 text-muted">
                {connection.bioSnippet}
              </span>
            ) : null}
          </span>
        </Link>
      ))}
    </div>
  );
}

type BadgeTone = "default" | "warm" | "cool" | "leaf" | "rose";

function badgeIconElement(badge: BadgeDefinition) {
  if (badge.icon === "bug") {
    return <Bug aria-hidden="true" size={22} />;
  }

  if (badge.icon === "calendar-days") {
    return <CalendarDays aria-hidden="true" size={22} />;
  }

  if (badge.icon === "radio") {
    return <Radio aria-hidden="true" size={22} />;
  }

  if (badge.icon === "shield") {
    return <Shield aria-hidden="true" size={22} />;
  }

  if (badge.icon === "sparkles") {
    return <Sparkles aria-hidden="true" size={22} />;
  }

  if (badge.icon === "users") {
    return <Users aria-hidden="true" size={22} />;
  }

  return <Award aria-hidden="true" size={22} />;
}

function badgeTone(rarity: BadgeDefinition["rarity"]): BadgeTone {
  const tones: Record<BadgeDefinition["rarity"], BadgeTone> = {
    common: "default",
    rare: "cool",
    epic: "rose",
    legendary: "warm",
    founder: "leaf",
  };

  return tones[rarity];
}

function rarityLabel(rarity: BadgeDefinition["rarity"]): string {
  const labels: Record<BadgeDefinition["rarity"], string> = {
    common: "Common",
    rare: "Rare",
    epic: "Epic",
    legendary: "Legendary",
    founder: "Founder",
  };

  return labels[rarity];
}

function rarityBorderClass(rarity: BadgeDefinition["rarity"]): string {
  const classes: Record<BadgeDefinition["rarity"], string> = {
    common: "border-line",
    rare: "border-cool/30",
    epic: "border-rose/30",
    legendary: "border-warm/35",
    founder: "border-accent/40",
  };

  return classes[rarity];
}

function rarityStripeClass(rarity: BadgeDefinition["rarity"]): string {
  const classes: Record<BadgeDefinition["rarity"], string> = {
    common: "bg-line-strong",
    rare: "bg-cool",
    epic: "bg-rose",
    legendary: "bg-warm",
    founder: "bg-accent",
  };

  return classes[rarity];
}

function rarityIconClass(rarity: BadgeDefinition["rarity"]): string {
  const classes: Record<BadgeDefinition["rarity"], string> = {
    common: "border-line bg-canvas/60 text-muted",
    rare: "border-cool/30 bg-cool/15 text-cool-ink",
    epic: "border-rose/30 bg-rose/15 text-rose-ink",
    legendary: "border-warm/35 bg-warm/20 text-warm-ink",
    founder: "border-accent/40 bg-accent/15 text-accent-strong",
  };

  return classes[rarity];
}

function sourceLabel(source: string): string {
  const labels: Record<string, string> = {
    "admin-granted": "Admin granted",
    system: "System",
    "room-earned": "Room earned",
    event: "Event",
    social: "Social",
  };

  return labels[source] ?? source;
}

function formatBadgeDate(value: string): string {
  const parsed = new Date(value.includes("T") ? value : value.replace(" ", "T"));

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(parsed);
}
