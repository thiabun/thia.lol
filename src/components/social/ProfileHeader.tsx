import { Link as LinkIcon, MapPin, MessageCircle, Radio } from "lucide-react";
import { Avatar } from "../ui/Avatar";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Panel } from "../ui/Panel";
import type { Profile } from "../../lib/types";

type ProfileHeaderProps = {
  profile: Profile;
};

export function ProfileHeader({ profile }: ProfileHeaderProps) {
  return (
    <Panel className="overflow-hidden">
      <div className="h-28 bg-ambient-texture" />
      <div className="p-5 sm:p-6">
        <div className="-mt-14 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <Avatar user={profile.user} size="lg" className="border-4 border-surface" />
          <Button type="button" variant="secondary">
            Follow
          </Button>
        </div>
        <div className="mt-4">
          <h1 className="text-2xl font-semibold tracking-normal text-text">
            {profile.user.displayName}
          </h1>
          <p className="mt-1 text-sm text-muted">@{profile.user.handle}</p>
          <p className="mt-4 max-w-2xl text-pretty text-base leading-7 text-text">
            {profile.bio}
          </p>
        </div>
        <div className="mt-4 flex flex-wrap gap-3 text-sm text-muted">
          <span className="inline-flex items-center gap-2">
            <MapPin aria-hidden="true" size={15} />
            {profile.location}
          </span>
          {profile.links.map((link) => (
            <span key={link} className="inline-flex items-center gap-2">
              <LinkIcon aria-hidden="true" size={15} />
              {link}
            </span>
          ))}
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          {profile.traits.map((trait) => (
            <Badge key={trait}>{trait}</Badge>
          ))}
        </div>
        <div className="mt-6 grid grid-cols-3 gap-2 sm:max-w-lg">
          <ProfileStat label="Posts" value={profile.stats.posts} icon={MessageCircle} />
          <ProfileStat label="Rooms" value={profile.stats.rooms} icon={Radio} />
          <ProfileStat label="Echoes" value={profile.stats.echoes} icon={LinkIcon} />
        </div>
      </div>
    </Panel>
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
