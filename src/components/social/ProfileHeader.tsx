import {
  Award,
  AtSign,
  CalendarDays,
  ExternalLink,
  Globe,
  Link as LinkIcon,
  MapPin,
  MessageCircle,
  Music,
  Radio,
  Reply,
  Heart,
  UserCheck,
  UserPlus,
  Users,
} from "lucide-react";
import { motion } from "motion/react";
import { Avatar } from "../ui/Avatar";
import { Badge } from "../ui/Badge";
import { Button, ButtonLink } from "../ui/Button";
import { Panel } from "../ui/Panel";
import { cn } from "../../lib/classNames";
import {
  cardEntrance,
  sectionItem,
  staggerChildren,
} from "../../lib/motionPresets";
import { formatMonthYear } from "../../lib/dates";
import type { Profile, UserBadge } from "../../lib/types";
import type {
  ProfileConnectionPlatform,
  ProfileExternalConnection,
} from "../../lib/types";

type ProfileHeaderProps = {
  profile: Profile;
  badgeCount?: number;
  followError?: string | undefined;
  followPosting?: boolean;
  isOwnProfile?: boolean;
  messageToHandle?: string | undefined;
  onFollowToggle?: () => void;
  onEditProfile?: (() => void) | undefined;
  onOpenPanel?: (panel: "followers" | "following" | "badges") => void;
  featuredBadges?: UserBadge[] | undefined;
  showChatHint?: boolean;
};

export function ProfileHeader({
  followError,
  followPosting = false,
  isOwnProfile = false,
  badgeCount = 0,
  featuredBadges = [],
  messageToHandle,
  onEditProfile,
  onFollowToggle,
  onOpenPanel,
  profile,
  showChatHint = false,
}: ProfileHeaderProps) {
  const links = profile.links;
  const followLabel = profile.isFollowing ? "Following" : "Follow";

  return (
    <motion.div variants={cardEntrance} custom={0} initial="hidden" animate="show">
      <Panel className="relative overflow-hidden">
        {safeImageUrl(profile.profileBackground) ? (
          <img
            alt=""
            aria-hidden="true"
            className="absolute inset-0 size-full object-cover opacity-15"
            src={profile.profileBackground ?? undefined}
          />
        ) : null}
        <div className="relative">
          {safeImageUrl(profile.bannerUrl) ? (
            <img
              alt=""
              className="h-32 w-full bg-surface-strong object-cover sm:h-40"
              src={profile.bannerUrl ?? undefined}
            />
          ) : (
            <div className="h-32 border-b border-line bg-surface-strong sm:h-40" />
          )}
        </div>
        <motion.div
          className="relative p-5 sm:p-6"
          variants={staggerChildren}
          initial="hidden"
          animate="show"
        >
          <div className="-mt-16 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <Avatar
              user={profile.user}
              size="lg"
              className="size-24 border-4 border-surface text-2xl"
            />
            <div className="flex flex-wrap items-center gap-2">
              {!isOwnProfile && profile.isMoot ? <Badge>Moot</Badge> : null}
              {isOwnProfile ? (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={onEditProfile}
                >
                  Edit profile
                </Button>
              ) : (
                <>
                  {messageToHandle ? (
                    <ButtonLink
                      data-testid="profile-message-button"
                      icon={<MessageCircle aria-hidden="true" size={17} />}
                      to={`/chat?with=${encodeURIComponent(messageToHandle)}`}
                      variant="secondary"
                    >
                      Message
                    </ButtonLink>
                  ) : null}
                  <Button
                    type="button"
                    variant={profile.isFollowing ? "secondary" : "primary"}
                    disabled={followPosting}
                    data-testid="profile-follow-button"
                    icon={
                      profile.isFollowing ? (
                        <UserCheck aria-hidden="true" size={17} />
                      ) : (
                        <UserPlus aria-hidden="true" size={17} />
                      )
                    }
                    onClick={onFollowToggle}
                  >
                    {followPosting ? "Saving" : followLabel}
                  </Button>
                </>
              )}
            </div>
          </div>
          {followError ? (
            <motion.p className="mt-3 text-sm text-rose" variants={sectionItem}>
              {followError}
            </motion.p>
          ) : null}
          {showChatHint ? (
            <motion.p className="mt-3 text-sm text-muted" variants={sectionItem}>
              Follow each other to chat
            </motion.p>
          ) : null}
          <motion.div className="mt-4" variants={sectionItem}>
            <h1 className="text-2xl font-semibold tracking-normal text-text">
              {profile.user.displayName}
            </h1>
            <p className="mt-1 text-sm text-muted">@{profile.user.handle}</p>
            <p className="mt-4 max-w-2xl text-pretty text-base leading-7 text-text">
              {profile.bio || "No bio yet."}
            </p>
          </motion.div>
          <motion.div
            className="mt-4 flex flex-wrap gap-3 text-sm text-muted"
            variants={sectionItem}
          >
            {profile.location ? (
              <span className="inline-flex items-center gap-2">
                <MapPin aria-hidden="true" size={15} />
                {profile.location}
              </span>
            ) : null}
            {profile.createdAt ? (
              <span className="inline-flex items-center gap-2">
                <CalendarDays aria-hidden="true" size={15} />
                Joined {formatJoinedDate(profile.createdAt)}
              </span>
            ) : null}
          </motion.div>
          {links.length > 0 ? (
            <motion.div className="mt-5" variants={sectionItem}>
              <h2 className="text-sm font-semibold text-text">Connections</h2>
              <div className="mt-2 flex flex-wrap gap-2">
                {links.map((link) => (
                  <ProfileConnectionPill key={`${link.platform}-${link.value}`} link={link} />
                ))}
              </div>
            </motion.div>
          ) : null}
          {featuredBadges.length > 0 ? (
            <motion.div className="mt-5" variants={sectionItem}>
              <h2 className="text-sm font-semibold text-text">Featured badges</h2>
              <div className="mt-2 flex flex-wrap gap-2">
                {featuredBadges.map((userBadge) => (
                  <span
                    key={userBadge.id}
                    className={cn(
                      "inline-flex min-h-10 items-center gap-2 rounded-full border px-3 text-sm font-semibold shadow-soft",
                      rarityClass(userBadge.badge.rarity),
                    )}
                    title={userBadge.badge.description ?? userBadge.badge.name}
                  >
                    <Award aria-hidden="true" size={16} />
                    {userBadge.badge.name}
                  </span>
                ))}
              </div>
            </motion.div>
          ) : null}
          <motion.div
            className="mt-6 grid grid-cols-2 gap-2 sm:max-w-2xl sm:grid-cols-4"
            variants={sectionItem}
          >
            <ProfileStat label="Posts" value={profile.stats.posts} icon={MessageCircle} />
            <ProfileStat label="Replies" value={profile.stats.replies} icon={Reply} />
            <ProfileStat label="Rooms" value={profile.stats.rooms} icon={Radio} />
            <ProfileStat label="Likes" value={profile.stats.echoes} icon={Heart} />
          </motion.div>
          <motion.div
            className="mt-3 flex flex-wrap gap-2"
            variants={sectionItem}
            aria-label="Profile details"
          >
            <ProfilePanelPill
              label="Followers"
              value={profile.stats.followers}
              icon={Users}
              onClick={() => onOpenPanel?.("followers")}
            />
            <ProfilePanelPill
              label="Following"
              value={profile.stats.following}
              icon={UserCheck}
              onClick={() => onOpenPanel?.("following")}
            />
            <ProfilePanelPill label="Moots" value={profile.stats.moots} icon={UserPlus} />
            <ProfilePanelPill
              label="Badges"
              value={badgeCount}
              icon={Award}
              onClick={() => onOpenPanel?.("badges")}
            />
          </motion.div>
        </motion.div>
      </Panel>
    </motion.div>
  );
}

type ProfileStatProps = {
  label: string;
  value: number;
  icon: typeof MessageCircle;
};

function ProfileStat({ label, value, icon: Icon }: ProfileStatProps) {
  return (
    <div className="rounded-card border border-line bg-canvas/45 p-3">
      <div className="flex items-center gap-2 text-xs text-muted">
        <Icon aria-hidden="true" size={14} />
        {label}
      </div>
      <p className="mt-2 text-lg font-semibold text-text">{value.toLocaleString()}</p>
    </div>
  );
}

type ProfilePanelPillProps = {
  label: string;
  value: number;
  icon: typeof MessageCircle;
  onClick?: () => void;
};

function ProfilePanelPill({
  label,
  onClick,
  value,
  icon: Icon,
}: ProfilePanelPillProps) {
  const className =
    "inline-flex min-h-10 items-center gap-2 rounded-full border border-line bg-canvas/45 px-3 text-sm font-semibold text-text shadow-soft transition duration-fluid ease-fluid";

  if (!onClick) {
    return (
      <span className={className}>
        <Icon aria-hidden="true" size={15} />
        {value.toLocaleString()} {label}
      </span>
    );
  }

  return (
    <button
      type="button"
      className={`${className} hover:border-line-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus`}
      onClick={onClick}
    >
      <Icon aria-hidden="true" size={15} />
      {value.toLocaleString()} {label}
    </button>
  );
}

function ProfileConnectionPill({ link }: { link: ProfileExternalConnection }) {
  const content = (
    <>
      {connectionIconElement(link.platform)}
      {link.label}
      {link.platform !== "discord" || link.url ? (
        <ExternalLink aria-hidden="true" size={13} />
      ) : null}
    </>
  );

  if (!link.url) {
    return (
      <span className="inline-flex min-h-9 items-center gap-2 rounded-control border border-line bg-canvas/45 px-3 text-sm font-medium text-muted">
        {content}
      </span>
    );
  }

  return (
    <a
      className="inline-flex min-h-9 items-center gap-2 rounded-control border border-line bg-canvas/45 px-3 text-sm font-medium text-muted transition duration-fluid ease-fluid hover:border-line-strong hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      href={link.url}
      rel="noopener noreferrer"
      target="_blank"
    >
      {content}
    </a>
  );
}

function connectionIconElement(platform: ProfileConnectionPlatform) {
  if (platform === "website") {
    return <Globe aria-hidden="true" size={15} />;
  }

  if (platform === "youtube" || platform === "twitch") {
    return <Radio aria-hidden="true" size={15} />;
  }

  if (platform === "tiktok" || platform === "spotify") {
    return <Music aria-hidden="true" size={15} />;
  }

  if (platform === "github") {
    return <LinkIcon aria-hidden="true" size={15} />;
  }

  if (platform === "discord") {
    return <MessageCircle aria-hidden="true" size={15} />;
  }

  return <AtSign aria-hidden="true" size={15} />;
}

function safeImageUrl(value: string | null | undefined): boolean {
  if (!value) {
    return false;
  }

  if (/^\/uploads\/media\/[0-9]{4}\/[0-9]{2}\/[a-z0-9_-]+\.webp$/.test(value)) {
    return true;
  }

  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function formatJoinedDate(value: string): string {
  return formatMonthYear(value);
}

function rarityClass(rarity: UserBadge["badge"]["rarity"]): string {
  const classes: Record<UserBadge["badge"]["rarity"], string> = {
    common: "border-line bg-surface text-text",
    rare: "border-cool/35 bg-cool/15 text-cool-ink",
    epic: "border-rose/35 bg-rose/15 text-rose-ink",
    legendary: "border-warm/40 bg-warm/20 text-warm-ink",
    founder: "border-accent/45 bg-accent/15 text-accent-strong",
  };

  return classes[rarity];
}
