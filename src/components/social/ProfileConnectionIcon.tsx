import { Globe } from "lucide-react";
import type { IconType } from "react-icons";
import {
  SiBluesky,
  SiDiscord,
  SiGithub,
  SiInstagram,
  SiSpotify,
  SiTiktok,
  SiTwitch,
  SiX,
  SiYoutube,
} from "react-icons/si";
import { cn } from "../../lib/classNames";
import {
  connectionPlatformIconName,
  type ProfileConnectionIconName,
} from "../../lib/profileConnections";
import type { ProfileConnectionPlatform } from "../../lib/types";

type ProfileConnectionIconProps = {
  className?: string;
  platform: ProfileConnectionPlatform;
  size?: number;
};

const simpleIconComponents: Record<
  Exclude<ProfileConnectionIconName, "generic-globe">,
  IconType
> = {
  "simple-icons:bluesky": SiBluesky,
  "simple-icons:discord": SiDiscord,
  "simple-icons:github": SiGithub,
  "simple-icons:instagram": SiInstagram,
  "simple-icons:spotify": SiSpotify,
  "simple-icons:tiktok": SiTiktok,
  "simple-icons:twitch": SiTwitch,
  "simple-icons:x": SiX,
  "simple-icons:youtube": SiYoutube,
};

export function ProfileConnectionIcon({
  className,
  platform,
  size = 16,
}: ProfileConnectionIconProps) {
  const iconName = connectionPlatformIconName(platform);

  if (iconName === "generic-globe") {
    return (
      <Globe
        aria-hidden="true"
        className={className}
        data-icon-source="lucide"
        data-testid="connection-icon-website"
        size={size}
      />
    );
  }

  const Icon = simpleIconComponents[iconName];

  return (
    <Icon
      aria-hidden="true"
      className={cn("shrink-0", className)}
      data-icon-source="simple-icons"
      data-icon={iconName}
      data-testid={`connection-icon-${platform}`}
      focusable="false"
      size={size}
    />
  );
}
