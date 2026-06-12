import type {
  ProfileConnectionPlatform,
  ProfileExternalConnection,
} from "./types";

export const maxProfileConnections = 10;

export const profileConnectionPlatforms: Array<{
  value: ProfileConnectionPlatform;
  label: string;
  help: string;
  placeholder: string;
}> = [
  {
    value: "website",
    label: "Website",
    help: "Use a full https:// URL.",
    placeholder: "https://example.com",
  },
  {
    value: "youtube",
    label: "YouTube",
    help: "Use a YouTube channel URL or @handle.",
    placeholder: "@channel or YouTube URL",
  },
  {
    value: "twitch",
    label: "Twitch",
    help: "Use a Twitch username.",
    placeholder: "channel",
  },
  {
    value: "tiktok",
    label: "TikTok",
    help: "Use a TikTok @handle or profile URL.",
    placeholder: "@handle",
  },
  {
    value: "instagram",
    label: "Instagram",
    help: "Use an Instagram username.",
    placeholder: "handle",
  },
  {
    value: "x",
    label: "X / Twitter",
    help: "Use an X/Twitter handle or profile URL.",
    placeholder: "handle",
  },
  {
    value: "bluesky",
    label: "Bluesky",
    help: "Use a Bluesky handle.",
    placeholder: "handle.bsky.social",
  },
  {
    value: "github",
    label: "GitHub",
    help: "Use a GitHub username or profile URL.",
    placeholder: "username",
  },
  {
    value: "discord",
    label: "Discord",
    help: "Use a safe display value or Discord invite URL.",
    placeholder: "discord.gg/invite or display name",
  },
  {
    value: "spotify",
    label: "Spotify",
    help: "Use an open.spotify.com URL.",
    placeholder: "https://open.spotify.com/...",
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
    if (!/^https:\/\//i.test(trimmed)) {
      return { error: "Website requires a full https:// URL." };
    }

    const connection = normalizeWebsite(trimmed);
    return connection ? { connection } : { error: "Website URL is invalid." };
  }

  if (platform === "spotify") {
    const connection = normalizeSpotify(trimmed);
    return connection ? { connection } : { error: "Spotify requires an open.spotify.com URL." };
  }

  if (platform === "discord") {
    const connection = normalizeDiscord(trimmed);
    return connection
      ? { connection }
      : { error: "Discord requires a safe display value or invite URL." };
  }

  if (["twitch", "instagram", "bluesky"].includes(platform)) {
    if (/^https?:\/\//i.test(trimmed)) {
      return { error: `${label} requires a username or handle.` };
    }

    const connection = normalizePlatformHandle(platform, trimmed);
    return connection ? { connection } : { error: `${label} username is invalid.` };
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
