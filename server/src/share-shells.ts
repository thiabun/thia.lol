import { createHash } from "node:crypto";
import { existsSync, statSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { normalizePostIdentifier, postCanonicalPath, type PostsRepository } from "./posts.js";
import { normalizeProfileHandle, type ProfilePayload, type ProfilesRepository, type PostPayload } from "./profiles.js";
import { normalizeRoomSlug, type RoomPayload, type RoomsRepository } from "./rooms.js";

const shareCardCacheVersion = "mosaic-v6";

export interface ShareShellService {
  postShare(query: Record<string, unknown>): Promise<ShareShellResponse>;
  profileShare(query: Record<string, unknown>): Promise<ShareShellResponse>;
  roomShare(query: Record<string, unknown>): Promise<ShareShellResponse>;
}

export interface ShareShellServiceOptions {
  postsRepository: PostsRepository;
  profilesRepository: ProfilesRepository;
  roomsRepository: RoomsRepository;
  publicBaseUrl: string;
  webRoot: string;
  uploadRoot: string;
}

export type ShareShellResponse =
  | {
      kind: "html";
      statusCode: number;
      html: string;
    }
  | {
      kind: "redirect";
      statusCode: 302;
      location: string;
    };

export function createShareShellService(options: ShareShellServiceOptions): ShareShellService {
  return new NodeShareShellService(options);
}

class NodeShareShellService implements ShareShellService {
  constructor(private readonly options: ShareShellServiceOptions) {}

  async postShare(query: Record<string, unknown>): Promise<ShareShellResponse> {
    const rawHandle = scalarString(query.handle);
    const rawPostIdentifier = scalarString(query.postId);
    const normalizedPostIdentifier = normalizePostIdentifier(rawPostIdentifier);

    if (!/^[a-z0-9_-]{1,40}$/iu.test(rawHandle) || normalizedPostIdentifier === null) {
      return this.postNotFound();
    }

    const post = await this.options.postsRepository.getPublicPost(rawPostIdentifier, null, this.publicBaseUrl());

    if (post === null) {
      return this.postNotFound();
    }

    const currentHandle = post.author.handle;
    const currentIdentifier = postIdentifier(post);

    if (rawHandle.toLowerCase() !== currentHandle.toLowerCase() || rawPostIdentifier.toLowerCase() !== currentIdentifier.toLowerCase()) {
      return {
        kind: "redirect",
        statusCode: 302,
        location: postCanonicalPath(post),
      };
    }

    return this.postHtml(post);
  }

  async profileShare(query: Record<string, unknown>): Promise<ShareShellResponse> {
    const rawHandle = scalarString(query.handle);
    const normalizedHandle = normalizeProfileHandle(rawHandle);

    if (normalizedHandle === null) {
      return this.profileNotFound();
    }

    const profile = await this.options.profilesRepository.getPublicProfile(normalizedHandle);

    if (profile === null || profile.viewerCanView === false) {
      return this.profileNotFound();
    }

    const currentHandle = profile.user.handle;

    if (rawHandle.toLowerCase() !== currentHandle.toLowerCase()) {
      return {
        kind: "redirect",
        statusCode: 302,
        location: profileCanonicalPath(profile),
      };
    }

    return this.profileHtml(profile);
  }

  async roomShare(query: Record<string, unknown>): Promise<ShareShellResponse> {
    const rawSlug = scalarString(query.slug);
    const normalizedSlug = normalizeRoomSlug(rawSlug);

    if (normalizedSlug === null) {
      return this.roomNotFound();
    }

    const room = await this.options.roomsRepository.getPublicRoom(normalizedSlug);

    if (room === null || !room.viewerCanViewPosts) {
      return this.roomNotFound();
    }

    if (rawSlug.toLowerCase() !== room.slug.toLowerCase()) {
      return {
        kind: "redirect",
        statusCode: 302,
        location: roomCanonicalPath(room),
      };
    }

    return this.roomHtml(room);
  }

  private async postHtml(post: PostPayload): Promise<ShareShellResponse> {
    const authorName = post.author.displayName ?? post.author.handle ?? "thia.lol";
    const authorHandle = post.author.handle ?? "profile";
    const title = `${authorName} on thia.lol`;
    const description = bodySnippet(post.body ?? "", 220);
    const canonicalUrl = httpsUrl(`${this.publicBaseUrl()}${postCanonicalPath(post)}`);
    const imageUrl = httpsUrl(`${this.publicBaseUrl()}${postShareCardPath(post)}?v=${postCardVersion(post)}`);
    const imageAlt = `Post by @${authorHandle} on thia.lol.`;
    const meta = [
      metaName("description", description),
      metaName("theme-color", "#092119"),
      metaProperty("og:site_name", "thia.lol"),
      metaProperty("og:type", "article"),
      metaProperty("og:title", title),
      metaProperty("og:description", description),
      metaProperty("og:url", canonicalUrl),
      metaProperty("og:image", imageUrl),
      metaProperty("og:image:secure_url", imageUrl),
      metaProperty("og:image:type", "image/png"),
      metaProperty("og:image:width", "2400"),
      metaProperty("og:image:height", "1260"),
      metaProperty("og:image:alt", imageAlt),
      metaName("twitter:card", "summary_large_image"),
      metaName("twitter:title", title),
      metaName("twitter:description", description),
      metaName("twitter:image", imageUrl),
      metaName("twitter:image:alt", imageAlt),
      canonicalLink(canonicalUrl),
      jsonLd({
        "@context": "https://schema.org",
        "@type": "SocialMediaPosting",
        headline: title,
        text: description,
        url: canonicalUrl,
        image: imageUrl,
        datePublished: post.createdAt ? isoDate(post.createdAt) : undefined,
        author: {
          "@type": "Person",
          name: authorName,
          identifier: authorHandle,
        },
        publisher: sitePublisherJsonLd(),
      }),
      titleTag(title),
    ];

    if (post.createdAt !== null && post.createdAt !== "") {
      meta.push(metaProperty("article:published_time", isoDate(post.createdAt)));
    }

    return {
      kind: "html",
      statusCode: 200,
      html: await this.emitShell(meta.join("\n    "), fallbackHtml(title, description, canonicalUrl, imageUrl, imageAlt, "Open post on thia.lol"), "post"),
    };
  }

  private async postNotFound(): Promise<ShareShellResponse> {
    const title = "Post not found | thia.lol";
    const description = "This post is not available on thia.lol.";
    const canonicalUrl = httpsUrl(`${this.publicBaseUrl()}/discover`);
    const imageUrl = httpsUrl(`${this.publicBaseUrl()}/brand/thia-og.png`);
    const imageAlt = "thia.lol bunny mark and wordmark.";
    const meta = notFoundMeta(title, description, canonicalUrl, imageUrl, imageAlt);

    return {
      kind: "html",
      statusCode: 404,
      html: await this.emitShell(meta, fallbackHtml(title, description, canonicalUrl, imageUrl, imageAlt, "Open post on thia.lol"), "post"),
    };
  }

  private async profileHtml(profile: ProfilePayload): Promise<ShareShellResponse> {
    const displayName = profile.user.displayName ?? profile.user.handle ?? "thia.lol";
    const handle = profile.user.handle ?? "profile";
    const title = `${displayName} (@${handle}) | thia.lol`;
    const description = profileDescription(profile);
    const canonicalUrl = httpsUrl(`${this.publicBaseUrl()}${profileCanonicalPath(profile)}`);
    const imagePath = this.profileCardImagePath(profile);
    const imageUrl = httpsUrl(`${this.publicBaseUrl()}${imagePath}?v=${this.profileCardVersion(profile)}`);
    const imageAlt = `Profile card for @${handle} on thia.lol.`;
    const meta = [
      metaName("description", description),
      metaName("theme-color", "#092119"),
      metaProperty("og:site_name", "thia.lol"),
      metaProperty("og:type", "profile"),
      metaProperty("profile:username", handle),
      metaProperty("og:title", title),
      metaProperty("og:description", description),
      metaProperty("og:url", canonicalUrl),
      metaProperty("og:image", imageUrl),
      metaProperty("og:image:secure_url", imageUrl),
      metaProperty("og:image:type", cardImageType(imagePath)),
      metaProperty("og:image:width", "2400"),
      metaProperty("og:image:height", "1260"),
      metaProperty("og:image:alt", imageAlt),
      metaName("twitter:card", "summary_large_image"),
      metaName("twitter:title", title),
      metaName("twitter:description", description),
      metaName("twitter:image", imageUrl),
      metaName("twitter:image:alt", imageAlt),
      canonicalLink(canonicalUrl),
      jsonLd({
        "@context": "https://schema.org",
        "@type": "ProfilePage",
        name: title,
        description,
        url: canonicalUrl,
        image: imageUrl,
        mainEntity: {
          "@type": "Person",
          name: displayName,
          alternateName: `@${handle}`,
          identifier: handle,
        },
      }),
      titleTag(title),
    ].join("\n    ");

    return {
      kind: "html",
      statusCode: 200,
      html: await this.emitShell(meta, fallbackHtml(title, description, canonicalUrl, imageUrl, imageAlt, "Open profile on thia.lol"), "profile"),
    };
  }

  private async profileNotFound(): Promise<ShareShellResponse> {
    const title = "Profile not found | thia.lol";
    const description = "This profile is not available on thia.lol.";
    const canonicalUrl = httpsUrl(`${this.publicBaseUrl()}/discover`);
    const imageUrl = httpsUrl(`${this.publicBaseUrl()}/brand/thia-og.png`);
    const imageAlt = "thia.lol bunny mark and wordmark.";

    return {
      kind: "html",
      statusCode: 404,
      html: await this.emitShell(notFoundMeta(title, description, canonicalUrl, imageUrl, imageAlt), fallbackHtml(title, description, canonicalUrl, imageUrl, imageAlt, "Open thia.lol"), "profile"),
    };
  }

  private async roomHtml(room: RoomPayload): Promise<ShareShellResponse> {
    const title = `${room.name} /${room.slug} | thia.lol`;
    const description = roomDescription(room);
    const canonicalUrl = httpsUrl(`${this.publicBaseUrl()}${roomCanonicalPath(room)}`);
    const imageUrl = httpsUrl(`${this.publicBaseUrl()}${roomShareCardPath(room)}?v=${roomCardVersion(room)}`);
    const imageAlt = `Room card for /${room.slug} on thia.lol.`;
    const meta = [
      metaName("description", description),
      metaName("theme-color", "#092119"),
      metaProperty("og:site_name", "thia.lol"),
      metaProperty("og:type", "website"),
      metaProperty("og:title", title),
      metaProperty("og:description", description),
      metaProperty("og:url", canonicalUrl),
      metaProperty("og:image", imageUrl),
      metaProperty("og:image:secure_url", imageUrl),
      metaProperty("og:image:type", "image/png"),
      metaProperty("og:image:width", "2400"),
      metaProperty("og:image:height", "1260"),
      metaProperty("og:image:alt", imageAlt),
      metaName("twitter:card", "summary_large_image"),
      metaName("twitter:title", title),
      metaName("twitter:description", description),
      metaName("twitter:image", imageUrl),
      metaName("twitter:image:alt", imageAlt),
      canonicalLink(canonicalUrl),
      jsonLd({
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        name: title,
        description,
        url: canonicalUrl,
        image: imageUrl,
        about: {
          "@type": "DiscussionForumPosting",
          name: room.name,
          url: canonicalUrl,
        },
        interactionStatistic: [
          {
            "@type": "InteractionCounter",
            interactionType: "https://schema.org/CommentAction",
            userInteractionCount: room.postCount,
          },
          {
            "@type": "InteractionCounter",
            interactionType: "https://schema.org/JoinAction",
            userInteractionCount: room.memberCount,
          },
        ],
      }),
      titleTag(title),
    ].join("\n    ");

    return {
      kind: "html",
      statusCode: 200,
      html: await this.emitShell(meta, fallbackHtml(title, description, canonicalUrl, imageUrl, imageAlt, "Open room on thia.lol"), "room"),
    };
  }

  private async roomNotFound(): Promise<ShareShellResponse> {
    const title = "Room not found | thia.lol";
    const description = "This room is not available on thia.lol.";
    const canonicalUrl = httpsUrl(`${this.publicBaseUrl()}/rooms`);
    const imageUrl = httpsUrl(`${this.publicBaseUrl()}/brand/thia-og.png`);
    const imageAlt = "thia.lol bunny mark and wordmark.";

    return {
      kind: "html",
      statusCode: 404,
      html: await this.emitShell(notFoundMeta(title, description, canonicalUrl, imageUrl, imageAlt), fallbackHtml(title, description, canonicalUrl, imageUrl, imageAlt, "Open rooms on thia.lol"), "room"),
    };
  }

  private async emitShell(metaHtml: string, fallback: string, kind: "post" | "profile" | "room"): Promise<string> {
    const indexPath = path.join(this.options.webRoot, "index.html");
    let html: string | null;

    try {
      html = await readFile(indexPath, "utf8");
    } catch {
      html = null;
    }

    if (html === null || html === "") {
      return `<!doctype html><html lang="en"><head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" />${metaHtml}</head><body><noscript>${fallback}</noscript><div id="root"></div></body></html>`;
    }

    const metaPattern = kind === "profile"
      ? /\s*<meta\b(?=[^>]*(?:name|property)=["'](?:description|theme-color|og:[^"']+|profile:[^"']+|twitter:[^"']+)["'])[^>]*>\s*/gis
      : /\s*<meta\b(?=[^>]*(?:name|property)=["'](?:description|theme-color|og:[^"']+|twitter:[^"']+)["'])[^>]*>\s*/gis;

    return html
      .replace(/\s*<title\b[^>]*>.*?<\/title>\s*/gis, "\n")
      .replace(metaPattern, "\n")
      .replace(/\s*<link\b(?=[^>]*rel=["']canonical["'])[^>]*>\s*/gis, "\n")
      .replace(/<\/head>/i, `    ${metaHtml}\n  </head>`)
      .replace(/<body([^>]*)>/i, `<body$1><noscript>${fallback}</noscript>`);
  }

  private profileCardImagePath(profile: ProfilePayload): string {
    const handle = profile.user.handle ?? "";
    const cached = cachedProfileCardPath(this.options.uploadRoot, handle);

    if (cached !== null && existsSync(cached)) {
      const cachedUrl = cachedProfileCardUrlPath(handle);

      if (cachedUrl !== null) {
        return cachedUrl;
      }
    }

    return `/api/profiles/${encodeURIComponent(handle)}/share-card.png`;
  }

  private profileCardVersion(profile: ProfilePayload): string {
    const cached = cachedProfileCardPath(this.options.uploadRoot, profile.user.handle ?? "");
    const cachedMtime = cached !== null && existsSync(cached)
      ? String(Math.trunc(statSync(cached).mtimeMs / 1000))
      : "uncached";
    const basis = [
      shareCardCacheVersion,
      cachedMtime,
      profile.user.handle ?? "",
      profile.updatedAt ?? "",
      profile.profileBackground ?? "",
      profile.bannerUrl ?? "",
      profile.user.avatarUrl ?? "",
    ].join("|");

    return sha256(basis).slice(0, 16);
  }

  private publicBaseUrl(): string {
    const trimmed = this.options.publicBaseUrl.replace(/\/+$/u, "");

    return trimmed === "" ? "https://thia.lol" : trimmed;
  }
}

function scalarString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function postIdentifier(post: PostPayload): string {
  return post.publicId !== "" ? post.publicId : String(post.id);
}

function postShareCardPath(post: PostPayload): string {
  return `/api/posts/${encodeURIComponent(postIdentifier(post))}/share-card.png`;
}

function profileCanonicalPath(profile: ProfilePayload): string {
  return `/@${encodeURIComponent(profile.user.handle)}`;
}

function roomCanonicalPath(room: RoomPayload): string {
  return `/rooms/${encodeURIComponent(room.slug)}`;
}

function roomShareCardPath(room: RoomPayload): string {
  return `/api/rooms/${encodeURIComponent(room.slug)}/share-card.png`;
}

function profileDescription(profile: ProfilePayload): string {
  const bio = profile.bio.trim();

  if (bio !== "") {
    return bodySnippet(bio, 180);
  }

  return `@${profile.user.handle ?? "profile"} on thia.lol.`;
}

function roomDescription(room: RoomPayload): string {
  const summary = (room.summary || room.description || "").trim();

  if (summary !== "") {
    return bodySnippet(summary, 180);
  }

  return `/${room.slug} on thia.lol.`;
}

function bodySnippet(body: string, maxLength: number): string {
  const snippet = body.replace(/\s+/gu, " ").trim();

  if (snippet === "") {
    return "A post on thia.lol.";
  }

  if (snippet.length <= maxLength) {
    return snippet;
  }

  return `${snippet.slice(0, Math.max(1, maxLength - 1)).trimEnd()}...`;
}

function fallbackHtml(
  title: string,
  description: string,
  canonicalUrl: string,
  imageUrl: string,
  imageAlt: string,
  linkLabel: string,
): string {
  return `<main><a href="${escapeHtml(canonicalUrl)}"><img src="${escapeHtml(imageUrl)}" width="2400" height="1260" alt="${escapeHtml(imageAlt)}" /></a><h1>${escapeHtml(title)}</h1><p>${escapeHtml(description)}</p><p><a href="${escapeHtml(canonicalUrl)}">${escapeHtml(linkLabel)}</a></p></main>`;
}

function notFoundMeta(
  title: string,
  description: string,
  canonicalUrl: string,
  imageUrl: string,
  imageAlt: string,
): string {
  return [
    metaName("description", description),
    metaName("theme-color", "#092119"),
    metaProperty("og:site_name", "thia.lol"),
    metaProperty("og:type", "website"),
    metaProperty("og:title", title),
    metaProperty("og:description", description),
    metaProperty("og:url", canonicalUrl),
    metaProperty("og:image", imageUrl),
    metaProperty("og:image:secure_url", imageUrl),
    metaProperty("og:image:type", "image/png"),
    metaProperty("og:image:width", "2400"),
    metaProperty("og:image:height", "1260"),
    metaProperty("og:image:alt", imageAlt),
    metaName("twitter:card", "summary_large_image"),
    metaName("twitter:title", title),
    metaName("twitter:description", description),
    metaName("twitter:image", imageUrl),
    metaName("twitter:image:alt", imageAlt),
    canonicalLink(canonicalUrl),
    titleTag(title),
  ].join("\n    ");
}

function metaName(name: string, content: string): string {
  return `<meta name="${escapeHtml(name)}" content="${escapeHtml(content)}" />`;
}

function metaProperty(property: string, content: string): string {
  return `<meta property="${escapeHtml(property)}" content="${escapeHtml(content)}" />`;
}

function canonicalLink(url: string): string {
  return `<link rel="canonical" href="${escapeHtml(url)}" />`;
}

function titleTag(title: string): string {
  return `<title>${escapeHtml(title)}</title>`;
}

function jsonLd(value: Record<string, unknown>): string {
  return `<script type="application/ld+json">${scriptSafeJson(removeUndefined(value))}</script>`;
}

function httpsUrl(url: string): string {
  const trimmed = url.trim();

  if (trimmed.startsWith("//")) {
    return `https:${trimmed}`;
  }

  return trimmed.replace(/^http:\/\//iu, "https://");
}

function isoDate(value: string): string {
  const time = Date.parse(value);

  return Number.isFinite(time) ? new Date(time).toISOString() : value;
}

function postCardVersion(post: PostPayload): string {
  const basis = [
    shareCardCacheVersion,
    postIdentifier(post),
    post.updatedAt ?? "",
    post.mediaUrl ?? "",
    post.mediaPosterUrl ?? "",
  ].join("|");

  return sha256(basis).slice(0, 16);
}

function roomCardVersion(room: RoomPayload): string {
  const basis = [
    shareCardCacheVersion,
    room.slug,
    room.updatedAt ?? "",
    room.iconUrl ?? "",
    room.bannerUrl ?? "",
    room.postCount,
    room.memberCount,
  ].join("|");

  return sha256(basis).slice(0, 16);
}

function sitePublisherJsonLd(): Record<string, unknown> {
  return {
    "@type": "Organization",
    name: "thia.lol",
    url: "https://thia.lol/",
  };
}

function removeUndefined(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => removeUndefined(item));
  }

  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, item]) => item !== undefined)
        .map(([key, item]) => [key, removeUndefined(item)]),
    );
  }

  return value;
}

function scriptSafeJson(value: unknown): string {
  return JSON.stringify(value)
    .replaceAll("<", "\\u003c")
    .replaceAll(">", "\\u003e")
    .replaceAll("&", "\\u0026");
}

function cachedProfileCardPath(uploadRoot: string, handle: string): string | null {
  const normalized = handle.trim().toLowerCase();

  if (!/^[a-z0-9_-]{1,80}$/u.test(normalized)) {
    return null;
  }

  return path.join(uploadRoot, "share-cards", "profiles", `${normalized}-${shareCardCacheVersion}.jpg`);
}

function cachedProfileCardUrlPath(handle: string): string | null {
  const normalized = handle.trim().toLowerCase();

  if (!/^[a-z0-9_-]{1,80}$/u.test(normalized)) {
    return null;
  }

  return `/uploads/share-cards/profiles/${encodeURIComponent(`${normalized}-${shareCardCacheVersion}.jpg`)}`;
}

function cardImageType(imagePath: string): string {
  const extension = path.extname(new URL(imagePath, "https://thia.lol").pathname).toLowerCase();

  return extension === ".jpg" || extension === ".jpeg" ? "image/jpeg" : "image/png";
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#039;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
