export const integrationProviders = [
  "spotify",
  "apple_music",
  "youtube",
  "twitch",
  "github",
] as const;

export type IntegrationProvider = (typeof integrationProviders)[number];

export type IntegrationUrlFailureReason =
  | "invalid"
  | "too_long"
  | "https_required"
  | "credentials_forbidden"
  | "unsupported_host"
  | "unsupported_resource";

export interface NormalizedIntegrationUrl {
  provider: IntegrationProvider;
  resourceType: string;
  resourceId: string;
  resourceKey: string;
  sourceUrl: string;
}

export type IntegrationUrlNormalizationResult =
  | {
      ok: true;
      value: NormalizedIntegrationUrl;
    }
  | {
      ok: false;
      reason: IntegrationUrlFailureReason;
    };

const spotifyResourceTypes = new Set([
  "album",
  "artist",
  "episode",
  "playlist",
  "show",
  "track",
]);
const appleMusicResourceTypes = new Set([
  "album",
  "artist",
  "music-video",
  "playlist",
  "song",
]);
const youtubeHosts = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtu.be",
]);

export function normalizeIntegrationUrl(
  value: unknown,
): IntegrationUrlNormalizationResult {
  if (typeof value !== "string") {
    return failure("invalid");
  }

  const trimmed = value.trim();

  if (trimmed === "") {
    return failure("invalid");
  }

  if (trimmed.length > 500) {
    return failure("too_long");
  }

  let url: URL;

  try {
    url = new URL(trimmed);
  } catch {
    return failure("invalid");
  }

  if (url.protocol !== "https:") {
    return failure("https_required");
  }

  if (url.username !== "" || url.password !== "") {
    return failure("credentials_forbidden");
  }

  if (url.port !== "") {
    return failure("unsupported_host");
  }

  url.hash = "";
  const host = url.hostname.toLowerCase();
  const provider = integrationProviderFromHost(host);

  if (provider === null) {
    return failure("unsupported_host");
  }

  const normalized = normalizeProviderResource(provider, host, url);

  if (normalized === null) {
    return failure("unsupported_resource");
  }

  return {
    ok: true,
    value: {
      ...normalized,
      provider,
      resourceKey: `${provider}:${normalized.resourceType}:${normalized.resourceId}`,
    },
  };
}

export function integrationProviderFromHost(
  host: string,
): IntegrationProvider | null {
  const normalizedHost = host.trim().toLowerCase();

  if (normalizedHost === "open.spotify.com") {
    return "spotify";
  }

  if (
    normalizedHost === "music.apple.com" ||
    normalizedHost === "itunes.apple.com"
  ) {
    return "apple_music";
  }

  if (youtubeHosts.has(normalizedHost)) {
    return "youtube";
  }

  if (
    normalizedHost === "twitch.tv" ||
    normalizedHost === "www.twitch.tv"
  ) {
    return "twitch";
  }

  if (
    normalizedHost === "github.com" ||
    normalizedHost === "www.github.com"
  ) {
    return "github";
  }

  return null;
}

function normalizeProviderResource(
  provider: IntegrationProvider,
  host: string,
  url: URL,
): Omit<NormalizedIntegrationUrl, "provider" | "resourceKey"> | null {
  if (provider === "spotify") {
    return normalizeSpotifyResource(url);
  }

  if (provider === "apple_music") {
    return normalizeAppleMusicResource(url);
  }

  if (provider === "youtube") {
    return normalizeYoutubeResource(host, url);
  }

  if (provider === "twitch") {
    return normalizeTwitchResource(url);
  }

  return normalizeGithubResource(url);
}

function normalizeSpotifyResource(
  url: URL,
): Omit<NormalizedIntegrationUrl, "provider" | "resourceKey"> | null {
  const segments = pathSegments(url);

  if (/^intl-[a-z]{2}(?:-[a-z]{2})?$/u.test(segments[0]?.toLowerCase() ?? "")) {
    segments.shift();
  }

  const resourceType = segments[0]?.toLowerCase() ?? "";
  const resourceId = safeIdentifier(segments[1], /^[A-Za-z0-9_-]+$/u);

  if (!spotifyResourceTypes.has(resourceType) || resourceId === null) {
    return null;
  }

  return {
    resourceType,
    resourceId,
    sourceUrl: `https://open.spotify.com/${resourceType}/${resourceId}`,
  };
}

function normalizeAppleMusicResource(
  url: URL,
): Omit<NormalizedIntegrationUrl, "provider" | "resourceKey"> | null {
  const segments = pathSegments(url);
  const typeIndex = segments.findIndex((segment) =>
    appleMusicResourceTypes.has(segment.toLowerCase()),
  );

  if (typeIndex < 0 || typeIndex >= segments.length - 1) {
    return null;
  }

  const querySongId = safeIdentifier(
    url.searchParams.get("i") ?? undefined,
    /^[A-Za-z0-9._-]+$/u,
  );
  const resourceType = querySongId === null
    ? segments[typeIndex]!.toLowerCase()
    : "song";
  const resourceId = querySongId ?? safeIdentifier(
    segments.at(-1),
    /^[A-Za-z0-9._-]+$/u,
  );

  if (resourceId === null) {
    return null;
  }

  return {
    resourceType,
    resourceId,
    sourceUrl: url.toString(),
  };
}

function normalizeYoutubeResource(
  host: string,
  url: URL,
): Omit<NormalizedIntegrationUrl, "provider" | "resourceKey"> | null {
  const segments = pathSegments(url);
  const firstSegment = segments[0] ?? "";
  const playlistId = youtubeIdentifier(url.searchParams.get("list"));
  let videoId: string | null = null;

  if (host === "youtu.be") {
    videoId = youtubeIdentifier(firstSegment);
  } else if (firstSegment === "watch") {
    videoId = youtubeIdentifier(url.searchParams.get("v"));
  } else if (
    ["shorts", "live", "embed"].includes(firstSegment) &&
    segments[1] !== undefined
  ) {
    videoId = youtubeIdentifier(segments[1]);
  }

  if (videoId !== null) {
    return {
      resourceType: "video",
      resourceId: videoId,
      sourceUrl: `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`,
    };
  }

  if (playlistId !== null) {
    return {
      resourceType: "playlist",
      resourceId: playlistId,
      sourceUrl: `https://www.youtube.com/playlist?list=${encodeURIComponent(playlistId)}`,
    };
  }

  if (firstSegment.startsWith("@")) {
    const handle = youtubeHandle(firstSegment);

    return handle === null
      ? null
      : {
          resourceType: "channel",
          resourceId: handle,
          sourceUrl: `https://www.youtube.com/${handle}`,
        };
  }

  if (firstSegment === "channel") {
    const channelId = youtubeIdentifier(segments[1]);

    return channelId === null
      ? null
      : {
          resourceType: "channel",
          resourceId: channelId,
          sourceUrl: `https://www.youtube.com/channel/${encodeURIComponent(channelId)}`,
        };
  }

  return null;
}

function normalizeTwitchResource(
  url: URL,
): Omit<NormalizedIntegrationUrl, "provider" | "resourceKey"> | null {
  const segments = pathSegments(url);

  if (segments[0] === "videos") {
    const videoId = safeIdentifier(segments[1], /^v?[0-9]+$/u);

    if (videoId === null) {
      return null;
    }

    const canonicalVideoId = videoId.replace(/^v/u, "");

    return {
      resourceType: "video",
      resourceId: canonicalVideoId,
      sourceUrl: `https://www.twitch.tv/videos/${canonicalVideoId}`,
    };
  }

  const channel = safeIdentifier(segments[0], /^[A-Za-z0-9_]+$/u);

  return channel === null
    ? null
    : {
        resourceType: "channel",
        resourceId: channel.toLowerCase(),
        sourceUrl: `https://www.twitch.tv/${channel.toLowerCase()}`,
      };
}

function normalizeGithubResource(
  url: URL,
): Omit<NormalizedIntegrationUrl, "provider" | "resourceKey"> | null {
  const segments = pathSegments(url);
  const owner = safeIdentifier(segments[0], /^[A-Za-z0-9_.-]+$/u);
  const repository = safeIdentifier(
    segments[1]?.replace(/\.git$/iu, ""),
    /^[A-Za-z0-9_.-]+$/u,
  );

  if (owner === null || repository === null) {
    return null;
  }

  const resourceId = `${owner}/${repository}`.toLowerCase();

  return {
    resourceType: "repo",
    resourceId,
    sourceUrl: `https://github.com/${resourceId}`,
  };
}

function pathSegments(url: URL): string[] {
  return url.pathname
    .split("/")
    .map((segment) => segment.trim())
    .filter((segment) => segment !== "");
}

function safeIdentifier(
  value: string | undefined,
  pattern: RegExp,
): string | null {
  if (value === undefined || value === "" || !pattern.test(value)) {
    return null;
  }

  return value;
}

function youtubeIdentifier(value: string | null | undefined): string | null {
  return safeIdentifier(value ?? undefined, /^[A-Za-z0-9_-]+$/u);
}

function youtubeHandle(value: string): string | null {
  if (!value.startsWith("@")) {
    return null;
  }

  const name = safeIdentifier(value.slice(1), /^[A-Za-z0-9._-]+$/u);

  return name === null ? null : `@${name}`;
}

function failure(
  reason: IntegrationUrlFailureReason,
): IntegrationUrlNormalizationResult {
  return { ok: false, reason };
}
