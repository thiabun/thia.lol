import {
  CalendarDays,
  Link as LinkIcon,
  MapPin,
  MessageCircle,
  Radio,
  Reply,
  Sparkles,
  UserCheck,
  UserPlus,
  Users,
} from "lucide-react";
import { motion } from "motion/react";
import { Avatar } from "../ui/Avatar";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Panel } from "../ui/Panel";
import {
  cardEntrance,
  sectionItem,
  staggerChildren,
} from "../../lib/motionPresets";
import type { Profile } from "../../lib/types";

type ProfileHeaderProps = {
  profile: Profile;
  followError?: string | undefined;
  followPosting?: boolean;
  isOwnProfile?: boolean;
  onFollowToggle?: () => void;
};

export function ProfileHeader({
  followError,
  followPosting = false,
  isOwnProfile = false,
  onFollowToggle,
  profile,
}: ProfileHeaderProps) {
  const links = profile.links.map(normalizeExternalLink).filter(isProfileLink);
  const followLabel = profile.isFollowing ? "Following" : "Follow";

  return (
    <motion.div variants={cardEntrance} custom={0} initial="hidden" animate="show">
      <Panel className="overflow-hidden">
        <div className="h-32 bg-ambient-texture sm:h-40" />
        <motion.div
          className="p-5 sm:p-6"
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
                <Button type="button" variant="secondary" disabled>
                  Edit profile
                </Button>
              ) : (
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
              )}
            </div>
          </div>
          {followError ? (
            <motion.p className="mt-3 text-sm text-rose" variants={sectionItem}>
              {followError}
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
              <h2 className="text-sm font-semibold text-text">Links</h2>
              <div className="mt-2 flex flex-wrap gap-2">
                {links.map((link) => (
                  <a
                    key={link.href}
                    className="inline-flex min-h-9 items-center gap-2 rounded-control border border-line bg-canvas/45 px-3 text-sm font-medium text-muted transition duration-fluid ease-fluid hover:border-line-strong hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                    href={link.href}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    <LinkIcon aria-hidden="true" size={15} />
                    {link.label}
                  </a>
                ))}
              </div>
            </motion.div>
          ) : null}
          {profile.traits.length > 0 ? (
            <motion.div className="mt-5 flex flex-wrap gap-2" variants={sectionItem}>
              {profile.traits.map((trait) => (
                <Badge key={trait}>{trait}</Badge>
              ))}
            </motion.div>
          ) : null}
          <motion.div
            className="mt-6 grid grid-cols-2 gap-2 sm:max-w-2xl sm:grid-cols-4"
            variants={sectionItem}
          >
            <ProfileStat label="Posts" value={profile.stats.posts} icon={MessageCircle} />
            <ProfileStat label="Replies" value={profile.stats.replies} icon={Reply} />
            <ProfileStat label="Rooms" value={profile.stats.rooms} icon={Radio} />
            <ProfileStat label="Reactions" value={profile.stats.echoes} icon={Sparkles} />
            <ProfileStat label="Followers" value={profile.stats.followers} icon={Users} />
            <ProfileStat label="Following" value={profile.stats.following} icon={UserCheck} />
            <ProfileStat label="Moots" value={profile.stats.moots} icon={UserPlus} />
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

type ProfileLink = {
  href: string;
  label: string;
};

function normalizeExternalLink(value: string): ProfileLink | null {
  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  try {
    const url = new URL(candidate);

    if (url.protocol !== "https:" && url.protocol !== "http:") {
      return null;
    }

    return {
      href: url.toString(),
      label: url.hostname.replace(/^www\./, ""),
    };
  } catch {
    return null;
  }
}

function isProfileLink(link: ProfileLink | null): link is ProfileLink {
  return link !== null;
}

function formatJoinedDate(value: string): string {
  const parsed = new Date(value.includes("T") ? value : value.replace(" ", "T"));

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    year: "numeric",
  }).format(parsed);
}
