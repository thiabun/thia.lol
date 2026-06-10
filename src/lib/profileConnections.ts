import type {
  ProfileConnectionPlatform,
  ProfileExternalConnection,
} from "./types";

export const maxProfileConnections = 10;

export const profileConnectionPlatforms: Array<{
  value: ProfileConnectionPlatform;
  label: string;
  placeholder: string;
}> = [
  { value: "website", label: "Website", placeholder: "https://example.com" },
  { value: "youtube", label: "YouTube", placeholder: "@channel or YouTube URL" },
  { value: "twitch", label: "Twitch", placeholder: "channel" },
  { value: "tiktok", label: "TikTok", placeholder: "@handle" },
  { value: "instagram", label: "Instagram", placeholder: "handle" },
  { value: "x", label: "X / Twitter", placeholder: "handle" },
  { value: "bluesky", label: "Bluesky", placeholder: "handle.bsky.social" },
  { value: "github", label: "GitHub", placeholder: "username" },
  { value: "discord", label: "Discord", placeholder: "discord.gg/invite or display name" },
  { value: "spotify", label: "Spotify", placeholder: "open.spotify.com URL" },
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

function safeUrl(value: string): URL | null {
  if (/[<>]/.test(value) || /javascript\s*:/i.test(value)) {
    return null;
  }

  try {
    return new URL(value);
  } catch {
    return null;
  }
}
