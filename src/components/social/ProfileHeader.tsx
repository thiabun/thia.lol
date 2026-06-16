import {
  Award,
  CalendarDays,
  ExternalLink,
  MapPin,
  MessageCircle,
  MoreHorizontal,
  Heart,
  ShieldOff,
  UserCheck,
  UserPlus,
  Users,
  VolumeX,
} from "lucide-react";
import { motion } from "motion/react";
import { useState } from "react";
import { Avatar } from "../ui/Avatar";
import { Badge } from "../ui/Badge";
import { Button, ButtonLink } from "../ui/Button";
import { ModalSheet } from "../ui/ModalSheet";
import { cn } from "../../lib/classNames";
import {
  cardEntrance,
  sectionItem,
  staggerChildren,
} from "../../lib/motionPresets";
import { formatMonthYear } from "../../lib/dates";
import { safeProfileImageUrl } from "../../lib/profileMedia";
import type { Profile, UserBadge } from "../../lib/types";
import type { ProfileExternalConnection } from "../../lib/types";
import { ProfileConnectionIcon } from "./ProfileConnectionIcon";

type ProfileHeaderProps = {
  profile: Profile;
  followError?: string | undefined;
  followPosting?: boolean;
  isOwnProfile?: boolean;
  messageToHandle?: string | undefined;
  profileControlBusy?: "block" | "mute" | undefined;
  profileControlError?: string | undefined;
  profileControlMessage?: string | undefined;
  onBlockToggle?: (() => Promise<void> | void) | undefined;
  onFollowToggle?: () => void;
  onMuteToggle?: (() => Promise<void> | void) | undefined;
  onOpenPanel?: (panel: "followers" | "following" | "badges") => void;
  featuredBadges?: UserBadge[] | undefined;
  showChatHint?: boolean;
};

export function ProfileHeader({
  followError,
  followPosting = false,
  isOwnProfile = false,
  featuredBadges = [],
  messageToHandle,
  profileControlBusy,
  profileControlError,
  profileControlMessage,
  onBlockToggle,
  onFollowToggle,
  onMuteToggle,
  onOpenPanel,
  profile,
  showChatHint = false,
}: ProfileHeaderProps) {
  const [actionsOpen, setActionsOpen] = useState(false);
  const [confirmBlockOpen, setConfirmBlockOpen] = useState(false);
  const links = profile.links;
  const bannerUrl = safeProfileImageUrl(profile.bannerUrl);
  const backgroundUrl = safeProfileImageUrl(profile.profileBackground);
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
      <motion.section
        className="relative overflow-hidden rounded-panel border border-line-strong bg-surface/86 shadow-soft backdrop-blur-veil"
        data-testid="profile-header"
      >
        <ProfileHeaderBackdrop backgroundUrl={backgroundUrl} />
        {bannerUrl ? <ProfileBanner src={bannerUrl} /> : <ProfileTopAccent />}
        <motion.div
          className={cn("relative z-10 p-4 sm:p-5", bannerUrl ? "pt-0" : undefined)}
          variants={staggerChildren}
          initial="hidden"
          animate="show"
        >
          <div
            className={cn(
              "relative z-10 flex flex-col gap-3 sm:flex-row sm:justify-between",
              bannerUrl ? "-mt-8 sm:-mt-10 sm:items-start" : "sm:items-center",
            )}
          >
            <div
              className={cn(
                "relative z-10 flex min-w-0 gap-3",
                bannerUrl ? "items-end" : "items-center",
              )}
              data-testid="profile-identity"
            >
              <Avatar
                user={profile.user}
                size="lg"
                className="size-16 border-[3px] border-surface text-lg shadow-soft ring-1 ring-line/70 sm:size-20"
              />
              <div className="min-w-0 pb-0.5">
                <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                  <h1 className="break-words text-2xl font-semibold tracking-normal text-text">
                    {profile.user.displayName}
                  </h1>
                  {!isOwnProfile && profile.isMoot ? (
                    <Badge className="min-h-6 px-2 text-[0.7rem]">Moot</Badge>
                  ) : null}
                  {!isOwnProfile && profile.mutedByMe ? (
                    <Badge className="min-h-6 px-2 text-[0.7rem]" tone="cool">
                      Muted
                    </Badge>
                  ) : null}
                </div>
                <p className="mt-1 break-all text-sm text-muted">@{profile.user.handle}</p>
              </div>
            </div>
            <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
              {!isOwnProfile ? (
                <>
                  {messageToHandle && !directActionsDisabled ? (
                    <ButtonLink
                      className="flex-1 sm:flex-none"
                      data-testid="profile-message-button"
                      icon={<MessageCircle aria-hidden="true" size={17} />}
                      size="sm"
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
                      className="flex-1 sm:flex-none"
                      data-testid="profile-follow-button"
                      size="sm"
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
                        className="size-9 shadow-none"
                        aria-haspopup="menu"
                        aria-expanded={actionsOpen}
                        aria-label={`Profile actions for @${profile.user.handle}`}
                        title={`Profile actions for @${profile.user.handle}`}
                        data-testid="profile-actions-button"
                        icon={<MoreHorizontal aria-hidden="true" size={18} />}
                        onClick={() => setActionsOpen((open) => !open)}
                      />
                      {actionsOpen ? (
                        <div
                          role="menu"
                          data-testid="profile-actions-menu"
                          className="absolute right-0 z-20 mt-2 w-64 overflow-hidden rounded-card border border-line bg-surface p-2 text-sm shadow-lift max-[340px]:right-auto max-[340px]:left-0 max-[340px]:w-[calc(100vw-2rem)]"
                        >
                          {onMuteToggle ? (
                            <button
                              type="button"
                              role="menuitem"
                              className="flex w-full items-center gap-3 rounded-card px-3 py-2 text-left text-text transition duration-fluid hover:bg-surface-strong focus-visible:outline-2 focus-visible:outline-focus"
                              disabled={profileControlBusy !== undefined}
                              onClick={() => void handleMuteAction()}
                            >
                              <VolumeX aria-hidden="true" size={16} className="shrink-0" />
                              <span className="font-semibold">
                                {profile.mutedByMe ? "Unmute" : "Mute"}
                              </span>
                            </button>
                          ) : null}
                          {onBlockToggle ? (
                            <button
                              type="button"
                              role="menuitem"
                              className="mt-1 flex w-full items-center gap-3 rounded-card px-3 py-2 text-left text-text transition duration-fluid hover:bg-surface-strong focus-visible:outline-2 focus-visible:outline-focus"
                              disabled={profileControlBusy !== undefined}
                              onClick={() => void handleBlockAction()}
                            >
                              <ShieldOff aria-hidden="true" size={16} className="shrink-0" />
                              <span className="font-semibold">
                                {profile.blockedByMe ? "Unblock" : "Block"}
                              </span>
                            </button>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </>
              ) : null}
            </div>
          </div>
          <ProfileStatusMessages
            followError={followError}
            isOwnProfile={isOwnProfile}
            profile={profile}
            profileControlError={profileControlError}
            profileControlMessage={profileControlMessage}
            showChatHint={showChatHint}
          />
          {profile.bio ? (
            <motion.div className="mt-3" variants={sectionItem}>
              <p className="max-w-3xl text-pretty text-sm leading-6 text-text">
                {profile.bio}
              </p>
            </motion.div>
          ) : null}
          <ProfileMetaRow profile={profile} />
          <ProfileSocialContext
            onOpenPanel={onOpenPanel}
            profile={profile}
          />
          <ProfileSignalStrip featuredBadges={featuredBadges} links={links} />
        </motion.div>
      </motion.section>
      <ModalSheet
        open={confirmBlockOpen}
        onClose={() => setConfirmBlockOpen(false)}
        title={`Block @${profile.user.handle}?`}
        closeLabel="Close block confirmation"
        size="sm"
        mobile="dialog"
        busy={profileControlBusy === "block"}
        footer={
          <div className="flex flex-wrap justify-end gap-2">
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
        }
      >
        <p className="text-sm leading-6 text-muted">
          Blocking removes follows and prevents messages. Public content may still appear elsewhere.
        </p>
      </ModalSheet>
    </motion.div>
  );
}

function ProfileHeaderBackdrop({
  backgroundUrl,
}: {
  backgroundUrl?: string | undefined;
}) {
  if (!backgroundUrl) {
    return null;
  }

  return (
    <div className="pointer-events-none absolute inset-0 z-0" aria-hidden="true">
      <img
        alt=""
        className="size-full scale-105 object-cover opacity-[0.16] blur-md"
        src={backgroundUrl}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-surface/90 via-surface/78 to-surface/96" />
    </div>
  );
}

function ProfileBanner({ src }: { src: string }) {
  return (
    <div
      className="relative z-0 h-20 overflow-hidden bg-canvas/60 sm:h-24 md:h-28"
      data-testid="profile-header-banner"
    >
      <img
        alt=""
        className="h-full w-full object-cover object-center"
        src={src}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-surface/88 via-surface/20 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-px bg-line/80" />
    </div>
  );
}

function ProfileTopAccent() {
  return (
    <div
      aria-hidden="true"
      className="absolute inset-x-0 top-0 z-0 h-1 bg-gradient-to-r from-accent/50 via-cool/35 to-leaf/35"
    />
  );
}

type ProfileStatusMessagesProps = {
  followError?: string | undefined;
  isOwnProfile: boolean;
  profile: Profile;
  profileControlError?: string | undefined;
  profileControlMessage?: string | undefined;
  showChatHint: boolean;
};

function ProfileStatusMessages({
  followError,
  isOwnProfile,
  profile,
  profileControlError,
  profileControlMessage,
  showChatHint,
}: ProfileStatusMessagesProps) {
  return (
    <>
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
        <motion.p className="mt-3 text-sm text-muted" variants={sectionItem}>
          @{profile.user.handle} is blocked.
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
    </>
  );
}

function ProfileMetaRow({ profile }: { profile: Profile }) {
  if (!profile.location && !profile.createdAt) {
    return null;
  }

  return (
    <motion.div
      className="mt-3 flex flex-wrap gap-x-3 gap-y-1.5 text-sm text-muted"
      variants={sectionItem}
    >
      {profile.location ? (
        <span className="inline-flex items-center gap-1.5">
          <MapPin aria-hidden="true" size={14} />
          {profile.location}
        </span>
      ) : null}
      {profile.createdAt ? (
        <span className="inline-flex items-center gap-1.5">
          <CalendarDays aria-hidden="true" size={14} />
          Joined {formatJoinedDate(profile.createdAt)}
        </span>
      ) : null}
    </motion.div>
  );
}

type ProfileSocialContextProps = {
  onOpenPanel?: ((panel: "followers" | "following" | "badges") => void) | undefined;
  profile: Profile;
};

function ProfileSocialContext({
  onOpenPanel,
  profile,
}: ProfileSocialContextProps) {
  return (
    <motion.div
      className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5"
      variants={sectionItem}
      data-testid="profile-social-context"
      aria-label="Profile details"
    >
      <ProfileStat label="Likes" value={profile.stats.echoes} icon={Heart} />
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
    </motion.div>
  );
}

function ProfileSignalStrip({
  featuredBadges,
  links,
}: {
  featuredBadges: UserBadge[];
  links: ProfileExternalConnection[];
}) {
  if (links.length === 0 && featuredBadges.length === 0) {
    return null;
  }

  return (
    <motion.div
      className="mt-3 flex flex-wrap items-center gap-2"
      variants={sectionItem}
      aria-label="Connections and featured badges"
    >
      {links.map((link) => (
        <ProfileConnectionChip key={`${link.platform}-${link.value}`} link={link} />
      ))}
      {featuredBadges.map((userBadge) => (
        <ProfileFeaturedBadgeChip key={userBadge.id} userBadge={userBadge} />
      ))}
    </motion.div>
  );
}

function ProfileFeaturedBadgeChip({ userBadge }: { userBadge: UserBadge }) {
  return (
    <span
      className={cn(
        "inline-flex min-h-8 max-w-full items-center gap-1.5 rounded-full border px-2.5 text-xs font-semibold",
        rarityClass(userBadge.badge.rarity),
      )}
      title={userBadge.badge.description ?? userBadge.badge.name}
    >
      <Award aria-hidden="true" size={14} />
      <span className="min-w-0 truncate">{userBadge.badge.name}</span>
    </span>
  );
}

type ProfileStatProps = {
  label: string;
  value: number;
  icon: typeof MessageCircle;
};

function ProfileStat({ label, value, icon: Icon }: ProfileStatProps) {
  return (
    <span className="inline-flex min-h-7 items-center gap-1.5 whitespace-nowrap text-sm text-muted">
      <Icon aria-hidden="true" size={14} />
      <span className="font-semibold text-text">{value.toLocaleString()}</span>
      {" "}
      <span>{label}</span>
    </span>
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
    "inline-flex min-h-7 items-center gap-1.5 whitespace-nowrap rounded-control text-sm text-muted transition duration-fluid ease-fluid";
  const content = (
    <>
      <Icon aria-hidden="true" size={14} />
      <span className="font-semibold text-text">{value.toLocaleString()}</span>
      {" "}
      <span>{label}</span>
    </>
  );

  if (!onClick) {
    return <span className={className}>{content}</span>;
  }

  return (
    <button
      type="button"
      className={cn(
        className,
        "-mx-1 px-1 hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
      )}
      title={`Open ${label.toLowerCase()} panel`}
      onClick={onClick}
    >
      {content}
    </button>
  );
}

function ProfileConnectionChip({ link }: { link: ProfileExternalConnection }) {
  const content = (
    <>
      <ProfileConnectionIcon platform={link.platform} size={14} />
      <span className="min-w-0 truncate">{link.label}</span>
      {link.platform !== "discord" || link.url ? (
        <ExternalLink aria-hidden="true" className="shrink-0" size={12} />
      ) : null}
    </>
  );

  if (!link.url) {
    return (
      <span className="inline-flex min-h-8 max-w-full items-center gap-1.5 rounded-full border border-line bg-canvas/55 px-2.5 text-xs font-medium text-muted">
        {content}
      </span>
    );
  }

  return (
    <a
      className="inline-flex min-h-8 max-w-full items-center gap-1.5 rounded-full border border-line bg-canvas/55 px-2.5 text-xs font-medium text-muted transition duration-fluid ease-fluid hover:border-line-strong hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      href={link.url}
      rel="noopener noreferrer"
      target="_blank"
    >
      {content}
    </a>
  );
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
