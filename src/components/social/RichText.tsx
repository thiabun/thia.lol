import { ExternalLink, Link as LinkIcon, Play } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router";
import { cn } from "../../lib/classNames";
import type { RichLinkCard, RichTextEntity } from "../../lib/types";

type RichTextProps = {
  className?: string;
  entities?: RichTextEntity[] | undefined;
  previewClassName?: string;
  showPreviews?: boolean;
  text: string;
};

export function RichText({
  className,
  entities,
  previewClassName,
  showPreviews = true,
  text,
}: RichTextProps) {
  const resolvedEntities =
    entities && entities.length > 0 ? entities : fallbackEntities(text);
  const inlineEntities = normalizedInlineEntities(text, resolvedEntities);
  const previewCards = showPreviews ? richLinkPreviewItems(inlineEntities).slice(0, 3) : [];

  return (
    <>
      <span className={className}>
        {inlineEntities.length === 0
          ? text
          : renderInlineRichText(text, inlineEntities)}
      </span>
      {previewCards.length > 0 ? (
        <div className={cn("mt-3 grid gap-2", previewClassName)}>
          {previewCards.map((item) => (
            <RichLinkPreview
              key={`${item.start}:${item.url}`}
              card={item.card}
              url={item.url}
            />
          ))}
        </div>
      ) : null}
    </>
  );
}

function renderInlineRichText(text: string, entities: RichTextEntity[]) {
  const nodes: ReactNode[] = [];
  let cursor = 0;

  entities.forEach((entity) => {
    const start = Math.max(0, Math.min(text.length, entity.start));
    const end = Math.max(start, Math.min(text.length, entity.start + entity.length));

    if (start > cursor) {
      nodes.push(text.slice(cursor, start));
    }

    const label = text.slice(start, end) || entity.text;

    if (entity.type === "mention") {
      nodes.push(
        <Link
          key={`mention:${entity.start}:${entity.mention.handle}`}
          to={`/@${entity.mention.handle}`}
          className="font-semibold text-accent-strong underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          data-testid="rich-mention-link"
        >
          {label}
        </Link>,
      );
    } else {
      nodes.push(
        <a
          key={`link:${entity.start}:${entity.link.url}`}
          href={entity.link.url}
          rel="noopener noreferrer"
          target="_blank"
          className="font-medium text-accent-strong underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          data-testid="rich-inline-link"
        >
          {label}
        </a>,
      );
    }

    cursor = end;
  });

  if (cursor < text.length) {
    nodes.push(text.slice(cursor));
  }

  return nodes;
}

function normalizedInlineEntities(
  text: string,
  entities: RichTextEntity[],
): RichTextEntity[] {
  const result: RichTextEntity[] = [];
  let cursor = 0;

  [...entities]
    .sort((first, second) => first.start - second.start)
    .forEach((entity) => {
      const start = entity.start;
      const end = entity.start + entity.length;

      if (start < cursor || start < 0 || end > text.length) {
        return;
      }

      result.push(entity);
      cursor = end;
    });

  return result;
}

function fallbackEntities(text: string): RichTextEntity[] {
  const entities: RichTextEntity[] = [];
  const occupied: Array<{ start: number; end: number }> = [];
  const linkPattern = /https:\/\/[^\s<>"']+/gi;
  let linkMatch: RegExpExecArray | null;

  while ((linkMatch = linkPattern.exec(text)) !== null) {
    const raw = trimUrlToken(linkMatch[0]);
    const url = safeHttpsUrl(raw);

    if (!url) {
      continue;
    }

    const start = linkMatch.index;
    const length = raw.length;
    occupied.push({ start, end: start + length });
    entities.push({
      type: "link",
      start,
      length,
      text: raw,
      link: { url },
    });
  }

  const mentionPattern = /(^|[^A-Za-z0-9_])@([A-Za-z0-9][A-Za-z0-9_-]{1,38}[A-Za-z0-9])/g;
  let mentionMatch: RegExpExecArray | null;

  while ((mentionMatch = mentionPattern.exec(text)) !== null) {
    const prefix = mentionMatch[1] ?? "";
    const handle = (mentionMatch[2] ?? "").toLowerCase();
    const start = mentionMatch.index + prefix.length;
    const mentionText = `@${handle}`;

    if (
      occupied.some((range) => start < range.end && start + mentionText.length > range.start)
    ) {
      continue;
    }

    entities.push({
      type: "mention",
      start,
      length: mentionText.length,
      text: mentionText,
      mention: {
        handle,
        user: {
          id: 0,
          handle,
          displayName: handle,
          initials: handle.slice(0, 2).toUpperCase(),
          aura: "frost",
          avatarUrl: null,
        },
      },
    });
  }

  return entities.sort((first, second) => first.start - second.start);
}

function trimUrlToken(value: string): string {
  let trimmed = value.replace(/[.,!?;:]+$/g, "");

  while (/[)\]}]$/.test(trimmed)) {
    const close = trimmed.at(-1);
    const open = close === ")" ? "(" : close === "]" ? "[" : "{";

    if (count(trimmed, open) >= count(trimmed, close ?? "")) {
      break;
    }

    trimmed = trimmed.slice(0, -1);
  }

  return trimmed;
}

function count(value: string, token: string): number {
  return token ? value.split(token).length - 1 : 0;
}

function safeHttpsUrl(value: string): string | undefined {
  try {
    const url = new URL(value);

    if (url.protocol !== "https:" || url.username || url.password) {
      return undefined;
    }

    return url.toString();
  } catch {
    return undefined;
  }
}

type RichLinkPreviewItem = {
  card: RichLinkCard;
  start: number;
  url: string;
};

function richLinkPreviewItems(entities: RichTextEntity[]): RichLinkPreviewItem[] {
  const seen = new Set<string>();
  const items: RichLinkPreviewItem[] = [];

  for (const entity of entities) {
    if (entity.type !== "link" || seen.has(entity.link.url)) {
      continue;
    }

    seen.add(entity.link.url);

    const card = entity.link.card ?? fallbackCardForUrl(entity.link.url);

    if (!card) {
      continue;
    }

    items.push({
      card,
      start: entity.start,
      url: entity.link.url,
    });
  }

  return items;
}

function fallbackCardForUrl(value: string): RichLinkCard | undefined {
  const safeUrl = safeHttpsUrl(value);

  if (!safeUrl) {
    return undefined;
  }

  const url = new URL(safeUrl);

  return (
    fallbackYouTubeCard(url) ??
    fallbackSpotifyCard(url) ??
    fallbackAppleMusicCard(url) ??
    fallbackTwitchCard(url) ??
    fallbackWebsiteCard(url)
  );
}

function fallbackYouTubeCard(url: URL): RichLinkCard | undefined {
  const host = normalizedHost(url);
  const segments = pathSegments(url);

  if (!["youtube.com", "m.youtube.com", "music.youtube.com", "youtu.be"].includes(host)) {
    return undefined;
  }

  const playlistId = cleanProviderId(url.searchParams.get("list") ?? "");
  let resourceType = "video";
  let resourceId = "";

  if (host === "youtu.be") {
    resourceId = cleanProviderId(segments[0] ?? "");
  } else if ((segments[0] ?? "") === "watch") {
    resourceId = cleanProviderId(url.searchParams.get("v") ?? "");
  } else if (["shorts", "live", "embed"].includes(segments[0] ?? "")) {
    resourceId = cleanProviderId(segments[1] ?? "");
  }

  if (!resourceId && playlistId) {
    resourceType = "playlist";
    resourceId = playlistId;
  }

  if (!resourceId) {
    return undefined;
  }

  const sourceUrl =
    resourceType === "playlist"
      ? `https://www.youtube.com/playlist?list=${encodeURIComponent(resourceId)}`
      : `https://www.youtube.com/watch?v=${encodeURIComponent(resourceId)}`;
  const embedSrc =
    resourceType === "playlist"
      ? `https://www.youtube-nocookie.com/embed/videoseries?list=${encodeURIComponent(resourceId)}`
      : `https://www.youtube-nocookie.com/embed/${encodeURIComponent(resourceId)}`;

  return fallbackProviderCard({
    provider: "youtube",
    resourceType,
    resourceId,
    resourceKey: `youtube:${resourceType}:${resourceId}`,
    sourceUrl,
    title: resourceType === "playlist" ? "YouTube playlist" : "YouTube video",
    subtitle: host === "music.youtube.com" ? "YouTube Music" : "YouTube",
    embed: {
      type: "iframe",
      src: embedSrc,
      title: resourceType === "playlist" ? "YouTube playlist" : "YouTube video",
      height: 220,
      allow: "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share",
    },
  });
}

function fallbackSpotifyCard(url: URL): RichLinkCard | undefined {
  if (normalizedHost(url) !== "open.spotify.com") {
    return undefined;
  }

  const [resourceType, rawResourceId] = pathSegments(url);
  const resourceId = cleanProviderId(rawResourceId ?? "");
  const supportedTypes = new Set(["album", "artist", "episode", "playlist", "show", "track"]);

  if (!resourceType || !supportedTypes.has(resourceType) || !resourceId) {
    return undefined;
  }

  const sourceUrl = `https://open.spotify.com/${resourceType}/${resourceId}`;

  return fallbackProviderCard({
    provider: "spotify",
    resourceType,
    resourceId,
    resourceKey: `spotify:${resourceType}:${resourceId}`,
    sourceUrl,
    title: `Spotify ${resourceType}`,
    subtitle: "Spotify",
    embed: {
      type: "iframe",
      src: `https://open.spotify.com/embed/${resourceType}/${resourceId}?theme=0`,
      title: `Spotify ${resourceType}`,
      height: resourceType === "track" ? 80 : 152,
      allow: "autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture",
    },
  });
}

function fallbackAppleMusicCard(url: URL): RichLinkCard | undefined {
  const host = normalizedHost(url);

  if (!["music.apple.com", "itunes.apple.com"].includes(host) || url.pathname === "/") {
    return undefined;
  }

  const segments = pathSegments(url);
  const resourceType = segments.includes("playlist")
    ? "playlist"
    : segments.includes("album")
      ? "album"
      : "song";
  const resourceId = cleanProviderId(segments.at(-1) ?? url.searchParams.get("i") ?? "");

  if (!resourceId) {
    return undefined;
  }

  return fallbackProviderCard({
    provider: "apple_music",
    resourceType,
    resourceId,
    resourceKey: `apple_music:${resourceType}:${resourceId}`,
    sourceUrl: url.toString(),
    title: `Apple Music ${resourceType}`,
    subtitle: "Apple Music",
    embed: {
      type: "iframe",
      src: `https://embed.music.apple.com${url.pathname}${url.search}`,
      title: `Apple Music ${resourceType}`,
      height: 152,
      allow: "autoplay; encrypted-media",
    },
  });
}

function fallbackTwitchCard(url: URL): RichLinkCard | undefined {
  if (!["twitch.tv", "www.twitch.tv"].includes(normalizedHost(url))) {
    return undefined;
  }

  const segments = pathSegments(url);
  const isVideo = segments[0] === "videos" && Boolean(segments[1]);
  const resourceType = isVideo ? "video" : "channel";
  const resourceId = cleanProviderId(isVideo ? segments[1] ?? "" : segments[0] ?? "");

  if (!resourceId) {
    return undefined;
  }

  const embedQuery = isVideo ? `video=${resourceId}` : `channel=${resourceId}`;

  return fallbackProviderCard({
    provider: "twitch",
    resourceType,
    resourceId,
    resourceKey: `twitch:${resourceType}:${resourceId}`,
    sourceUrl: url.toString(),
    title: isVideo ? "Twitch video" : "Twitch stream",
    subtitle: "Twitch",
    embed: {
      type: "iframe",
      src: `https://player.twitch.tv/?${embedQuery}&muted=true&autoplay=false`,
      title: isVideo ? "Twitch video" : "Twitch stream",
      height: 220,
      allow: "autoplay; fullscreen; picture-in-picture",
    },
  });
}

function fallbackWebsiteCard(url: URL): RichLinkCard {
  const host = url.hostname;
  const sourceUrl = url.toString();
  const resourceId = stableUrlHash(sourceUrl);

  return fallbackProviderCard({
    provider: "website",
    resourceType: "url",
    resourceId,
    resourceKey: `website:url:${resourceId}`,
    sourceUrl,
    title: host,
    subtitle: host,
    embed: null,
  });
}

function fallbackProviderCard({
  embed,
  provider,
  resourceId,
  resourceKey,
  resourceType,
  sourceUrl,
  subtitle,
  title,
}: {
  embed: RichLinkCard["embed"];
  provider: RichLinkCard["provider"];
  resourceId: string;
  resourceKey: string;
  resourceType: string;
  sourceUrl: string;
  subtitle: string;
  title: string;
}): RichLinkCard {
  return {
    provider,
    resourceType,
    resourceId,
    resourceKey,
    sourceUrl,
    metadata: {
      title,
      subtitle,
      description: null,
      imageUrl: null,
      live: false,
      stats: {},
    },
    embed,
    apiBacked: false,
    fetchedAt: null,
    expiresAt: null,
    staleAt: null,
    stale: false,
    lastError: null,
  };
}

function normalizedHost(url: URL): string {
  return url.hostname.toLowerCase().replace(/^www\./, "");
}

function pathSegments(url: URL): string[] {
  return url.pathname.split("/").filter(Boolean);
}

function cleanProviderId(value: string): string {
  return value.replace(/[^A-Za-z0-9_-]/g, "");
}

function stableUrlHash(value: string): string {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (Math.imul(31, hash) + value.charCodeAt(index)) | 0;
  }

  return Math.abs(hash).toString(36);
}

function RichLinkPreview({ card, url }: { card: RichLinkCard; url: string }) {
  const embedSrc = safeEmbedSrc(card);
  const title = card.metadata.title ?? hostnameLabel(url);
  const subtitle = card.metadata.subtitle ?? providerLabel(card.provider);

  if (embedSrc) {
    return (
      <span
        className="block overflow-hidden rounded-card border border-line bg-canvas/60"
        data-thread-open-ignore
        data-testid="rich-link-preview"
      >
        <iframe
          className={cn(
            "block w-full border-0 bg-black",
            card.provider === "spotify" || card.provider === "apple_music"
              ? "bg-transparent"
              : "aspect-video h-auto",
          )}
          title={card.embed?.title ?? title}
          src={embedSrc}
          height={embedHeight(card)}
          loading="lazy"
          referrerPolicy="strict-origin-when-cross-origin"
          sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-forms"
          allow={card.embed?.allow}
          allowFullScreen
          data-testid={`rich-link-embed-${card.provider}`}
        />
        <RichLinkSummary card={card} title={title} subtitle={subtitle} url={url} compact />
      </span>
    );
  }

  return (
    <a
      className="flex min-w-0 gap-3 rounded-card border border-line bg-canvas/60 p-3 text-left transition duration-fluid ease-fluid hover:border-line-strong hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      href={url}
      rel="noopener noreferrer"
      target="_blank"
      data-thread-open-ignore
      data-testid="rich-link-preview"
    >
      <span className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-card border border-line bg-surface/80 text-muted">
        {card.metadata.imageUrl ? (
          <img
            src={card.metadata.imageUrl}
            alt=""
            className="size-full object-cover"
            loading="lazy"
            decoding="async"
          />
        ) : card.provider === "youtube" || card.provider === "twitch" ? (
          <Play aria-hidden="true" size={18} />
        ) : (
          <LinkIcon aria-hidden="true" size={18} />
        )}
      </span>
      <RichLinkSummary card={card} title={title} subtitle={subtitle} url={url} />
    </a>
  );
}

function RichLinkSummary({
  card,
  compact = false,
  subtitle,
  title,
  url,
}: {
  card: RichLinkCard;
  compact?: boolean;
  subtitle: string;
  title: string;
  url: string;
}) {
  return (
    <span className={cn("min-w-0 flex-1", compact ? "block p-3" : "block")}>
      <span className="block truncate text-sm font-semibold text-text">{title}</span>
      <span className="mt-0.5 block truncate text-xs text-muted">{subtitle}</span>
      {card.metadata.description ? (
        <span className="mt-1 line-clamp-2 block text-sm leading-5 text-muted">
          {card.metadata.description}
        </span>
      ) : null}
      <span className="mt-2 inline-flex max-w-full items-center gap-1 text-xs font-semibold text-accent-strong">
        <span className="truncate">{url}</span>
        <ExternalLink aria-hidden="true" size={12} className="shrink-0" />
      </span>
    </span>
  );
}

function safeEmbedSrc(card: RichLinkCard): string | undefined {
  if (!card.embed?.src) {
    return undefined;
  }

  try {
    const url = new URL(card.embed.src);
    const allowedHosts = new Set([
      "open.spotify.com",
      "embed.music.apple.com",
      "www.youtube-nocookie.com",
      "player.twitch.tv",
    ]);

    if (url.protocol !== "https:" || !allowedHosts.has(url.hostname)) {
      return undefined;
    }

    if (card.provider === "twitch" && url.hostname === "player.twitch.tv") {
      url.searchParams.set(
        "parent",
        typeof window === "undefined" ? "thia.lol" : window.location.hostname || "thia.lol",
      );
      url.searchParams.set("muted", "true");
      url.searchParams.set("autoplay", "false");
    }

    return url.toString();
  } catch {
    return undefined;
  }
}

function embedHeight(card: RichLinkCard): number {
  if (card.provider === "spotify") {
    return card.resourceType === "track" ? 80 : 152;
  }

  if (card.provider === "apple_music") {
    return 152;
  }

  return card.embed?.height ?? 220;
}

function hostnameLabel(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "Link";
  }
}

function providerLabel(provider: RichLinkCard["provider"]): string {
  return {
    apple_music: "Apple Music",
    github: "GitHub",
    spotify: "Spotify",
    twitch: "Twitch",
    website: "Website",
    youtube: "YouTube",
  }[provider];
}
