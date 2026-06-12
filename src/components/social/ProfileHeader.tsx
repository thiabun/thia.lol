import {
  Award,
  AtSign,
  CalendarDays,
  ExternalLink,
  Globe,
  Link as LinkIcon,
  MapPin,
  MessageCircle,
  MoreHorizontal,
  Music,
  Radio,
  Reply,
  Heart,
  ShieldOff,
  UserCheck,
  UserPlus,
  Users,
  VolumeX,
  X,
} from "lucide-react";
import { motion } from "motion/react";
import { useState } from "react";
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
  profileControlBusy?: "block" | "mute" | undefined;
  profileControlError?: string | undefined;
  profileControlMessage?: string | undefined;
  onBlockToggle?: (() => Promise<void> | void) | undefined;
  onFollowToggle?: () => void;
  onEditProfile?: (() => void) | undefined;
  onMuteToggle?: (() => Promise<void> | void) | undefined;
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
  profileControlBusy,
  profileControlError,
  profileControlMessage,
  onBlockToggle,
  onEditProfile,
  onFollowToggle,
  onMuteToggle,
  onOpenPanel,
  profile,
  showChatHint = false,
}: ProfileHeaderProps) {
  const [actionsOpen, setActionsOpen] = useState(false);
  const [confirmBlockOpen, setConfirmBlockOpen] = useState(false);
  const links = profile.links;
  const followLabel = profile.isFollowing ? "Following" : "Follow";
  const showProfileControls = !isOwnProfile && Boolean(onBlockToggle || onMuteToggle);
  const directActionsDisabled = profile.blockedByMe === true;

  async function handleBlockAction() {
    setActionsOpen(false);

    if (!onBlockToggle) {
      return;
    }

    if (!profile.blockedByMe) {
      setConfirmBlockOpen(true);
      return;
    }

    await onBlockToggle();
  }

  async function handleConfirmBlock() {
    if (!onBlockToggle) {
      return;
    }

    await onBlockToggle();
    setConfirmBlockOpen(false);
  }

  async function handleMuteAction() {
    setActionsOpen(false);
    await onMuteToggle?.();
  }

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
              {!isOwnProfile && profile.mutedByMe ? <Badge tone="cool">Muted</Badge> : null}
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
                  {messageToHandle && !directActionsDisabled ? (
                    <ButtonLink
                      data-testid="profile-message-button"
                      icon={<MessageCircle aria-hidden="true" size={17} />}
                      to={`/chat?with=${encodeURIComponent(messageToHandle)}`}
                      variant="secondary"
                    >
                      Message
                    </ButtonLink>
                  ) : null}
                  {!directActionsDisabled ? (
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
                  ) : null}
                  {showProfileControls ? (
                    <div className="relative">
                      <Button
                        type="button"
                        variant="secondary"
                        size="icon"
                        aria-haspopup="menu"
                        aria-expanded={actionsOpen}
                        aria-label={`Profile actions for @${profile.user.handle}`}
                        data-testid="profile-actions-button"
                        icon={<MoreHorizontal aria-hidden="true" size={18} />}
                        onClick={() => setActionsOpen((open) => !open)}
                      />
                      {actionsOpen ? (
                        <div
                          role="menu"
                          data-testid="profile-actions-menu"
                          className="absolute right-0 z-20 mt-2 w-64 overflow-hidden rounded-card border border-line bg-surface p-2 text-sm shadow-lift"
                        >
                          {onMuteToggle ? (
                            <button
                              type="button"
                              role="menuitem"
                              className="flex w-full items-start gap-3 rounded-card px-3 py-2 text-left text-text transition duration-fluid hover:bg-surface-strong focus-visible:outline-2 focus-visible:outline-focus"
                              disabled={profileControlBusy !== undefined}
                              onClick={() => void handleMuteAction()}
                            >
                              <VolumeX aria-hidden="true" size={16} className="mt-0.5 shrink-0" />
                              <span>
                                <span className="block font-semibold">
                                  {profile.mutedByMe ? "Unmute" : "Mute"}
                                </span>
                                <span className="mt-1 block text-xs leading-5 text-muted">
                                  Muted posts are hidden from your feeds where possible. They will not be notified.
                                </span>
                              </span>
                            </button>
                          ) : null}
                          {onBlockToggle ? (
                            <button
                              type="button"
                              role="menuitem"
                              className="mt-1 flex w-full items-start gap-3 rounded-card px-3 py-2 text-left text-text transition duration-fluid hover:bg-surface-strong focus-visible:outline-2 focus-visible:outline-focus"
                              disabled={profileControlBusy !== undefined}
                              onClick={() => void handleBlockAction()}
                            >
                              <ShieldOff aria-hidden="true" size={16} className="mt-0.5 shrink-0" />
                              <span>
                                <span className="block font-semibold">
                                  {profile.blockedByMe ? "Unblock" : "Block"}
                                </span>
                                <span className="mt-1 block text-xs leading-5 text-muted">
                                  Blocking removes follows between you, prevents messages, and limits interaction where possible.
                                </span>
                              </span>
                            </button>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
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
          {!isOwnProfile && profile.blockedByMe ? (
            <motion.p className="mt-3 rounded-card border border-line bg-canvas/55 p-3 text-sm text-muted" variants={sectionItem}>
              You blocked @{profile.user.handle}. Follow and Message are unavailable until you unblock them.
            </motion.p>
          ) : null}
          {!isOwnProfile && profile.mutedByMe && !profile.blockedByMe ? (
            <motion.p className="mt-3 text-sm text-muted" variants={sectionItem}>
              Muted posts are hidden from your feeds where possible.
            </motion.p>
          ) : null}
          {profileControlMessage ? (
            <motion.p className="mt-3 text-sm text-muted" variants={sectionItem}>
              {profileControlMessage}
            </motion.p>
          ) : null}
          {profileControlError ? (
            <motion.p className="mt-3 text-sm text-rose" variants={sectionItem}>
              {profileControlError}
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
      {confirmBlockOpen ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-text/28 px-4 py-6 backdrop-blur-veil"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setConfirmBlockOpen(false);
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Block @${profile.user.handle}?`}
            className="w-full max-w-md rounded-panel border border-line bg-surface p-5 shadow-lift"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-text">
                  Block @{profile.user.handle}?
                </h2>
                <p className="mt-2 text-sm leading-6 text-muted">
                  Blocking removes follows between you, prevents messages, and limits interaction where possible. This does not hide public content everywhere.
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Cancel block"
                icon={<X aria-hidden="true" size={18} />}
                onClick={() => setConfirmBlockOpen(false)}
              />
            </div>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setConfirmBlockOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={profileControlBusy === "block"}
                onClick={() => void handleConfirmBlock()}
              >
                {profileControlBusy === "block" ? "Blocking" : "Block"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
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
