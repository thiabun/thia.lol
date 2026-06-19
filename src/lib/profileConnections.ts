import type {
  ProfileConnectionPlatform,
  ProfileExternalConnection,
} from "./types";

export const maxProfileConnections = 10;

export type ProfileConnectionValidationMode =
  | "https-url"
  | "profile-url-or-handle"
  | "handle"
  | "discord-display-or-invite"
  | "spotify-url";

export type ProfileConnectionIconName =
  | "generic-globe"
  | "simple-icons:twitch"
  | "simple-icons:instagram"
  | "simple-icons:bluesky"
  | "simple-icons:youtube"
  | "simple-icons:tiktok"
  | "simple-icons:x"
  | "simple-icons:github"
  | "simple-icons:discord"
  | "simple-icons:spotify";

export const profileConnectionPlatforms: Array<{
  value: ProfileConnectionPlatform;
  label: string;
  validationMode: ProfileConnectionValidationMode;
  help: string;
  placeholder: string;
  icon: ProfileConnectionIconName;
  attributionName?: string;
  tone: "warm" | "cool" | "rose" | "leaf" | "neutral";
}> = [
  {
    value: "website",
    label: "Website",
    validationMode: "https-url",
    help: "Use a domain or full https:// URL.",
    placeholder: "example.com or https://example.com",
    icon: "generic-globe",
    tone: "warm",
  },
  {
    value: "youtube",
    label: "YouTube",
    validationMode: "profile-url-or-handle",
    help: "Use a YouTube channel URL or @handle.",
    placeholder: "@channel or YouTube URL",
    icon: "simple-icons:youtube",
    attributionName: "YouTube",
    tone: "rose",
  },
  {
    value: "twitch",
    label: "Twitch",
    validationMode: "profile-url-or-handle",
    help: "Use a Twitch username or channel URL.",
    placeholder: "channel or Twitch URL",
    icon: "simple-icons:twitch",
    attributionName: "Twitch",
    tone: "cool",
  },
  {
    value: "tiktok",
    label: "TikTok",
    validationMode: "profile-url-or-handle",
    help: "Use a TikTok @handle or profile URL.",
    placeholder: "@handle",
    icon: "simple-icons:tiktok",
    attributionName: "TikTok",
    tone: "neutral",
  },
  {
    value: "instagram",
    label: "Instagram",
    validationMode: "handle",
    help: "Use an Instagram username.",
    placeholder: "handle",
    icon: "simple-icons:instagram",
    attributionName: "Instagram",
    tone: "rose",
  },
  {
    value: "x",
    label: "X / Twitter",
    validationMode: "profile-url-or-handle",
    help: "Use an X/Twitter handle or profile URL.",
    placeholder: "handle",
    icon: "simple-icons:x",
    attributionName: "X",
    tone: "neutral",
  },
  {
    value: "bluesky",
    label: "Bluesky",
    validationMode: "handle",
    help: "Use a Bluesky handle.",
    placeholder: "handle.bsky.social",
    icon: "simple-icons:bluesky",
    attributionName: "Bluesky",
    tone: "cool",
  },
  {
    value: "github",
    label: "GitHub",
    validationMode: "profile-url-or-handle",
    help: "Use a GitHub username or profile URL.",
    placeholder: "username",
    icon: "simple-icons:github",
    attributionName: "GitHub",
    tone: "neutral",
  },
  {
    value: "discord",
    label: "Discord",
    validationMode: "discord-display-or-invite",
    help: "Use a safe display value or Discord invite URL.",
    placeholder: "discord.gg/invite or display name",
    icon: "simple-icons:discord",
    attributionName: "Discord",
    tone: "cool",
  },
  {
    value: "spotify",
    label: "Spotify",
    validationMode: "profile-url-or-handle",
    help: "Use a Spotify profile URL or username.",
    placeholder: "username or open.spotify.com URL",
    icon: "simple-icons:spotify",
    attributionName: "Spotify",
    tone: "leaf",
  },
];

type RawProfileConnection =
  | string
  | Partial<ProfileExternalConnection> & {
      href?: string | null;
      handle?: string | null;
      username?: string | null;
    };

export function normalizeProfileConnection(
  raw: RawProfileConnection,
): ProfileExternalConnection | null {
  if (typeof raw === "string") {
    return normalizeWebsite(raw);
  }

  const platform = normalizePlatform(raw.platform);
  const rawValue = raw.value ?? raw.url ?? raw.href ?? raw.handle ?? raw.username ?? "";
  const value = sanitizeInput(String(rawValue));

  if (!platform || !value) {
    return null;
  }

  if (platform === "website") {
    return normalizeWebsite(value);
  }

  if (platform === "discord") {
    return normalizeDiscord(value);
  }

  if (platform === "spotify") {
    return normalizeSpotify(value);
  }

  const urlConnection = normalizePlatformUrl(platform, value);

  if (urlConnection) {
    return urlConnection;
  }

  return normalizePlatformHandle(platform, value);
}

export function connectionPlatformLabel(platform: ProfileConnectionPlatform): string {
  return (
    profileConnectionPlatforms.find((item) => item.value === platform)?.label ??
    "Connection"
  );
}

export function connectionPlatformHelp(platform: ProfileConnectionPlatform): string {
  return (
    profileConnectionPlatforms.find((item) => item.value === platform)?.help ??
    "Enter a valid connection value."
  );
}

export function connectionPlatformIconName(
  platform: ProfileConnectionPlatform,
): ProfileConnectionIconName {
  return (
    profileConnectionPlatforms.find((item) => item.value === platform)?.icon ??
    "generic-globe"
  );
}

export function formatProfileConnectionValue(connection: ProfileExternalConnection): string {
  if (/^https:\/\//i.test(connection.value)) {
    return connection.value;
  }

  if (["instagram", "tiktok", "x", "youtube"].includes(connection.platform)) {
    return connection.value.startsWith("@") ? connection.value : `@${connection.value}`;
  }

  return connection.value;
}

export function validateProfileConnectionDraft(
  platform: ProfileConnectionPlatform,
  value: string,
): { connection: ProfileExternalConnection; error?: never } | { connection?: never; error: string } {
  const trimmed = sanitizeInput(value);
  const label = connectionPlatformLabel(platform);

  if (!trimmed) {
    return { error: `${label} value is required.` };
  }

  if (isUnsafeText(trimmed)) {
    return { error: `${label} must be plain text without HTML or scripts.` };
  }

  if (platform === "website") {
    const connection = normalizeWebsite(trimmed);
    return connection ? { connection } : { error: "Website URL is invalid." };
  }

  if (platform === "spotify") {
    const connection =
      normalizeSpotify(trimmed) ?? normalizePlatformHandle(platform, trimmed);
    return connection
      ? { connection }
      : { error: "Spotify requires a profile URL or username." };
  }

  if (platform === "discord") {
    const connection = normalizeDiscord(trimmed);
    return connection
      ? { connection }
      : { error: "Discord requires a safe display value or invite URL." };
  }

  if (["twitch", "instagram", "bluesky"].includes(platform)) {
    const connection =
      normalizePlatformUrl(platform, trimmed) ??
      normalizePlatformHandle(platform, trimmed);
    return connection
      ? { connection }
      : { error: `${label} username or URL is invalid.` };
  }

  const urlConnection = normalizePlatformUrl(platform, trimmed);

  if (urlConnection) {
    return { connection: urlConnection };
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return { error: `${label} URL is invalid.` };
  }

  const handleConnection = normalizePlatformHandle(platform, trimmed);
  return handleConnection
    ? { connection: handleConnection }
    : { error: `${label} username is invalid.` };
}

function normalizeWebsite(value: string): ProfileExternalConnection | null {
  const trimmed = sanitizeInput(value);
  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  const url = safeUrl(candidate);

  if (!url || url.protocol !== "https:") {
    return null;
  }

  return {
    platform: "website",
    label: url.hostname.replace(/^www\./, ""),
    value: url.toString(),
    url: url.toString(),
  };
}

function normalizeDiscord(value: string): ProfileExternalConnection | null {
  const trimmed = sanitizeInput(value);
  const maybeUrl = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  const url = safeUrl(maybeUrl);

  if (
    url &&
    url.protocol === "https:" &&
    ["discord.gg", "www.discord.gg", "discord.com", "www.discord.com"].includes(
      url.hostname.toLowerCase(),
    ) &&
    /^\/(?:invite\/)?[a-z0-9-]+\/?$/i.test(url.pathname)
  ) {
    return {
      platform: "discord",
      label: "Discord",
      value: trimmed,
      url: url.toString(),
    };
  }

  if (/^[a-zA-Z0-9_. -]{2,40}$/.test(trimmed)) {
    return {
      platform: "discord",
      label: "Discord",
      value: trimmed,
      url: null,
    };
  }

  return null;
}

function normalizeSpotify(value: string): ProfileExternalConnection | null {
  const url = safeUrl(sanitizeInput(value));

  if (!url || url.protocol !== "https:" || url.hostname !== "open.spotify.com") {
    return null;
  }

  return {
    platform: "spotify",
    label: "Spotify",
    value: url.toString(),
    url: url.toString(),
  };
}

function normalizePlatformUrl(
  platform: ProfileConnectionPlatform,
  value: string,
): ProfileExternalConnection | null {
  const url = safeUrl(value);

  if (!url || url.protocol !== "https:") {
    return null;
  }

  const hostname = url.hostname.replace(/^www\./, "").toLowerCase();
  const allowedHosts: Partial<Record<ProfileConnectionPlatform, string[]>> = {
    youtube: ["youtube.com", "youtu.be"],
    twitch: ["twitch.tv"],
    tiktok: ["tiktok.com"],
    instagram: ["instagram.com"],
    x: ["x.com", "twitter.com"],
    bluesky: ["bsky.app"],
    github: ["github.com"],
  };

  if (!allowedHosts[platform]?.includes(hostname)) {
    return null;
  }

  return {
    platform,
    label: connectionPlatformLabel(platform),
    value: value.trim(),
    url: url.toString(),
  };
}

function normalizePlatformHandle(
  platform: ProfileConnectionPlatform,
  value: string,
): ProfileExternalConnection | null {
  const handle = value.trim().replace(/^@/, "");

  if (!/^[a-zA-Z0-9._-]{1,80}$/.test(handle)) {
    return null;
  }

  const paths: Partial<Record<ProfileConnectionPlatform, string>> = {
    youtube: `https://www.youtube.com/@${handle}`,
    twitch: `https://www.twitch.tv/${handle}`,
    tiktok: `https://www.tiktok.com/@${handle}`,
    instagram: `https://www.instagram.com/${handle}`,
    x: `https://x.com/${handle}`,
    bluesky: `https://bsky.app/profile/${handle}`,
    github: `https://github.com/${handle}`,
    spotify: `https://open.spotify.com/user/${handle}`,
  };
  const url = paths[platform];

  if (!url) {
    return null;
  }

  return {
    platform,
    label: connectionPlatformLabel(platform),
    value: handle,
    url,
  };
}

function normalizePlatform(
  platform: unknown,
): ProfileConnectionPlatform | undefined {
  if (typeof platform !== "string") {
    return undefined;
  }

  if (platform === "twitter") {
    return "x";
  }

  return profileConnectionPlatforms.some((item) => item.value === platform)
    ? (platform as ProfileConnectionPlatform)
    : undefined;
}

function sanitizeInput(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function isUnsafeText(value: string): boolean {
  return /[<>]/.test(value)
    || /javascript\s*:/i.test(value)
    || /data\s*:/i.test(value)
    || /\bon[a-z]+\s*=/i.test(value);
}

function safeUrl(value: string): URL | null {
  if (isUnsafeText(value)) {
    return null;
  }

  try {
    const url = new URL(value);

    if (url.username || url.password) {
      return null;
    }

    return url;
  } catch {
    return null;
  }
}
