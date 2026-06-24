import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

import type { MultipartFile } from "@fastify/multipart";
import sharp from "sharp";

import type { PostsRepository } from "./posts.js";
import type { ProfilesRepository } from "./profiles.js";
import type { RequestSession } from "./sessions.js";

export const shareCardWidth = 2400;
export const shareCardHeight = 1260;
const shareCardCacheVersion = "mosaic-v6";
const shareCardMaxUploadBytes = 32 * 1024 * 1024;

export class ShareCardRouteError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
  ) {
    super(message);
    this.name = "ShareCardRouteError";
  }
}

export interface ShareCardImage {
  body: Buffer;
  contentType: "image/png" | "image/jpeg" | "image/webp" | "image/gif";
  cacheControl: string;
}

export interface ShareCardCachePayload {
  url: string;
  width: number;
  height: number;
}

export interface ShareCardService {
  postCard(identifier: string, viewerUserId: number | null): Promise<ShareCardImage>;
  profileCard(handle: string): Promise<ShareCardImage>;
  cachePostCard(identifier: string, session: RequestSession, file: MultipartFile | undefined): Promise<ShareCardCachePayload>;
  cacheProfileCard(handle: string, session: RequestSession, file: MultipartFile | undefined): Promise<ShareCardCachePayload>;
  proxyImage(rawUrl: string): Promise<ShareCardImage | null>;
}

export interface ShareCardServiceOptions {
  postsRepository: PostsRepository;
  profilesRepository: ProfilesRepository;
  uploadRoot: string;
  publicBaseUrl: string;
}

export function createShareCardService(options: ShareCardServiceOptions): ShareCardService {
  return new NodeShareCardService(options);
}

class NodeShareCardService implements ShareCardService {
  constructor(private readonly options: ShareCardServiceOptions) {}

  async postCard(identifier: string, viewerUserId: number | null): Promise<ShareCardImage> {
    const post = await this.options.postsRepository.getPublicPost(identifier, viewerUserId, this.options.publicBaseUrl);

    if (post === null) {
      throw new ShareCardRouteError("Post not found.", 404);
    }

    const publicId = String(post.publicId ?? post.id);
    const cached = await this.cachedImage("post", publicId);

    if (cached !== null) {
      return cached;
    }

    const authorName = String(post.author?.displayName ?? post.author?.handle ?? "thia.lol");
    const authorHandle = String(post.author?.handle ?? "profile");
    const body = String(post.body ?? "");
    const svg = shareCardSvg({
      eyebrow: "thia.lol post",
      title: authorName,
      subtitle: `@${authorHandle}`,
      body: bodySnippet(body, 220),
      statLine: `${Number(post.commentCount ?? 0)} replies  ·  ${Number(post.likeCount ?? 0)} likes  ·  ${Number(post.reblogCount ?? 0)} reblogs`,
      canonical: post.canonicalPath,
      accent: "#f48cad",
    });

    return pngImage(await sharp(Buffer.from(svg)).png().toBuffer());
  }

  async profileCard(handle: string): Promise<ShareCardImage> {
    const profile = await this.options.profilesRepository.getPublicProfile(handle);

    if (profile === null || profile.viewerCanView === false) {
      throw new ShareCardRouteError("Profile not found.", 404);
    }

    const profileHandle = String(profile.user?.handle ?? handle);
    const cached = await this.cachedImage("profile", profileHandle);

    if (cached !== null) {
      return cached;
    }

    const displayName = String(profile.user?.displayName ?? profileHandle);
    const bio = String(profile.bio ?? "");
    const stats = profile.stats ?? {};
    const svg = shareCardSvg({
      eyebrow: "thia.lol profile",
      title: displayName,
      subtitle: `@${profileHandle}`,
      body: bodySnippet(bio === "" ? "A thia.lol profile." : bio, 220),
      statLine: `${Number(stats.posts ?? 0)} posts  ·  ${Number(stats.followers ?? 0)} followers  ·  ${Number(stats.stars ?? 0)} stars`,
      canonical: `/@${encodeURIComponent(profileHandle)}`,
      accent: "#58e2e0",
    });

    return pngImage(await sharp(Buffer.from(svg)).png().toBuffer());
  }

  async cachePostCard(identifier: string, session: RequestSession, file: MultipartFile | undefined): Promise<ShareCardCachePayload> {
    const post = await this.options.postsRepository.getPublicPost(identifier, session.userId, this.options.publicBaseUrl);

    if (post === null) {
      throw new ShareCardRouteError("Post not found.", 404);
    }

    if (Number(post.author?.id ?? 0) !== session.userId) {
      throw new ShareCardRouteError("Only the post author can publish this share card preview.", 403);
    }

    return this.storeUploadedCard("post", String(post.publicId ?? post.id), file);
  }

  async cacheProfileCard(handle: string, session: RequestSession, file: MultipartFile | undefined): Promise<ShareCardCachePayload> {
    const profile = await this.options.profilesRepository.getPublicProfile(handle);

    if (profile === null || profile.viewerCanView === false) {
      throw new ShareCardRouteError("Profile not found.", 404);
    }

    if (Number(profile.user?.id ?? 0) !== session.userId) {
      throw new ShareCardRouteError("Only the profile owner can publish this share card preview.", 403);
    }

    return this.storeUploadedCard("profile", String(profile.user?.handle ?? handle), file);
  }

  async proxyImage(rawUrl: string): Promise<ShareCardImage | null> {
    const url = rawUrl.trim();

    if (url === "") {
      return null;
    }

    const localPath = this.localMediaPath(url);

    if (localPath !== null) {
      return imageFromFile(localPath);
    }

    if (!providerImageUrlAllowed(url)) {
      return null;
    }

    const response = await fetch(url, {
      headers: {
        accept: "image/avif,image/webp,image/png,image/jpeg,image/gif;q=0.9,*/*;q=0.1",
        "user-agent": "thia.lol share-card",
      },
      redirect: "manual",
      signal: AbortSignal.timeout(1800),
    });

    if (!response.ok) {
      return null;
    }

    const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
    const bytes = Buffer.from(await response.arrayBuffer());

    if (bytes.byteLength === 0 || bytes.byteLength > 3_000_000 || !allowedImageContentType(contentType)) {
      return null;
    }

    const image = await imageFromBuffer(bytes);

    return image;
  }

  private async storeUploadedCard(
    kind: "post" | "profile",
    key: string,
    file: MultipartFile | undefined,
  ): Promise<ShareCardCachePayload> {
    if (file === undefined) {
      throw new ShareCardRouteError("Share card image is required.", 422);
    }

    let buffer: Buffer;

    try {
      buffer = await file.toBuffer();
    } catch {
      throw new ShareCardRouteError("Share card image is invalid.", 422);
    }

    if (buffer.byteLength <= 0 || buffer.byteLength > shareCardMaxUploadBytes) {
      throw new ShareCardRouteError("Share card image is invalid.", 422);
    }

    const metadata = await sharp(buffer).metadata();
    const extension = metadata.format === "jpeg" ? "jpg" : metadata.format;

    if (metadata.width !== shareCardWidth || metadata.height !== shareCardHeight || (extension !== "jpg" && extension !== "png")) {
      throw new ShareCardRouteError("Share card must be a 2400x1260 PNG or JPEG.", 422);
    }

    const cachePath = this.cachePath(kind, key, extension);
    const temporaryPath = `${cachePath}.${Date.now()}.tmp`;

    await mkdir(path.dirname(cachePath), { recursive: true, mode: 0o755 });
    await writeFile(temporaryPath, buffer, { mode: 0o644 });
    await rename(temporaryPath, cachePath);

    return {
      url: this.cacheUrl(kind, key, extension),
      width: shareCardWidth,
      height: shareCardHeight,
    };
  }

  private async cachedImage(kind: "post" | "profile", key: string): Promise<ShareCardImage | null> {
    for (const extension of ["jpg", "png"] as const) {
      const cachePath = this.cachePath(kind, key, extension);

      if (existsSync(cachePath)) {
        return imageFromFile(cachePath);
      }
    }

    return null;
  }

  private cachePath(kind: "post" | "profile", key: string, extension: "jpg" | "png"): string {
    const directory = kind === "profile" ? "profiles" : "posts";
    const safeKey = shareCardCacheKey(key);

    if (safeKey === null) {
      throw new ShareCardRouteError("Share card target is invalid.", 422);
    }

    return path.join(this.options.uploadRoot, "share-cards", directory, `${safeKey}.${extension}`);
  }

  private cacheUrl(kind: "post" | "profile", key: string, extension: "jpg" | "png"): string {
    const directory = kind === "profile" ? "profiles" : "posts";
    const safeKey = shareCardCacheKey(key) ?? "card";

    return `/uploads/share-cards/${directory}/${safeKey}.${extension}`;
  }

  private localMediaPath(rawUrl: string): string | null {
    let pathname: string;

    try {
      const parsed = new URL(rawUrl, this.options.publicBaseUrl);
      const baseHost = new URL(this.options.publicBaseUrl).host.toLowerCase();

      if (parsed.host !== "" && parsed.host.toLowerCase() !== baseHost) {
        return null;
      }

      if (parsed.protocol !== "https:" && rawUrl.startsWith("http")) {
        return null;
      }

      pathname = parsed.pathname;
    } catch {
      return null;
    }

    if (!/^\/uploads\/media\/[0-9]{4}\/[0-9]{2}\/[a-z0-9_-]+\.(?:jpe?g|png|webp|gif)$/u.test(pathname)) {
      return null;
    }

    const filePath = path.join(this.options.uploadRoot, pathname.replace(/^\/uploads\//u, ""));

    return existsSync(filePath) ? filePath : null;
  }
}

async function imageFromFile(filePath: string): Promise<ShareCardImage | null> {
  try {
    return imageFromBuffer(await readFile(filePath));
  } catch {
    return null;
  }
}

async function imageFromBuffer(buffer: Buffer): Promise<ShareCardImage | null> {
  try {
    const metadata = await sharp(buffer).metadata();
    const contentType = imageContentTypeFromFormat(metadata.format);

    if (contentType === null) {
      return null;
    }

    return {
      body: buffer,
      contentType,
      cacheControl: "public, max-age=604800, stale-while-revalidate=86400",
    };
  } catch {
    return null;
  }
}

function pngImage(body: Buffer): ShareCardImage {
  return {
    body,
    contentType: "image/png",
    cacheControl: "public, max-age=1800",
  };
}

function shareCardSvg(input: {
  eyebrow: string;
  title: string;
  subtitle: string;
  body: string;
  statLine: string;
  canonical: string;
  accent: string;
}): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${shareCardWidth}" height="${shareCardHeight}" viewBox="0 0 ${shareCardWidth} ${shareCardHeight}">
  <rect width="2400" height="1260" fill="#0d1f29"/>
  <circle cx="500" cy="260" r="360" fill="#163642" opacity="0.78"/>
  <circle cx="1850" cy="940" r="420" fill="${input.accent}" opacity="0.28"/>
  <rect x="88" y="192" width="2224" height="884" rx="60" fill="#16333d" opacity="0.92" stroke="#417e92" stroke-opacity="0.45" stroke-width="2"/>
  <text x="184" y="290" fill="${input.accent}" font-family="Noto Sans, Arial, sans-serif" font-size="42" font-weight="700">${escapeXml(input.eyebrow)}</text>
  <text x="184" y="420" fill="#e8f7f8" font-family="Noto Sans, Arial, sans-serif" font-size="86" font-weight="800">${escapeXml(trimForSvg(input.title, 34))}</text>
  <text x="184" y="500" fill="#9ec0ca" font-family="Noto Sans, Arial, sans-serif" font-size="44">${escapeXml(trimForSvg(input.subtitle, 52))}</text>
  ${wrappedSvgText(input.body, 184, 645, 54, 62, 5, "#e8f7f8")}
  <text x="184" y="940" fill="#9ec0ca" font-family="Noto Sans, Arial, sans-serif" font-size="38">${escapeXml(trimForSvg(input.statLine, 82))}</text>
  <text x="184" y="1016" fill="#9ec0ca" font-family="Noto Sans, Arial, sans-serif" font-size="32">${escapeXml(trimForSvg(input.canonical, 96))}</text>
  <text x="1840" y="1016" text-anchor="end" fill="#e8f7f8" font-family="Noto Sans, Arial, sans-serif" font-size="50" font-weight="800">thia.lol</text>
</svg>`;
}

function wrappedSvgText(text: string, x: number, y: number, fontSize: number, lineHeight: number, maxLines: number, fill: string): string {
  const words = text.split(/\s+/u).filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const next = current === "" ? word : `${current} ${word}`;

    if (next.length > 62 && current !== "") {
      lines.push(current);
      current = word;
      continue;
    }

    current = next;
  }

  if (current !== "") {
    lines.push(current);
  }

  const visible = lines.slice(0, maxLines);

  if (lines.length > maxLines && visible.length > 0) {
    visible[visible.length - 1] = `${visible[visible.length - 1]?.replace(/\s+$/u, "") ?? ""}...`;
  }

  return visible
    .map((line, index) => `<text x="${x}" y="${y + index * lineHeight}" fill="${fill}" font-family="Noto Sans, Arial, sans-serif" font-size="${fontSize}">${escapeXml(line)}</text>`)
    .join("\n");
}

function providerImageUrlAllowed(value: string): boolean {
  if (value.length > 1200) {
    return false;
  }

  let parsed: URL;

  try {
    parsed = new URL(value);
  } catch {
    return false;
  }

  if (parsed.protocol !== "https:" || parsed.username !== "" || parsed.password !== "") {
    return false;
  }

  const host = parsed.hostname.toLowerCase().replace(/\.$/u, "");
  const exactHosts = new Set([
    "avatars.githubusercontent.com",
    "i.scdn.co",
    "i.ytimg.com",
    "image-cdn-ak.spotifycdn.com",
    "img.youtube.com",
    "mosaic.scdn.co",
    "opengraph.githubassets.com",
    "static-cdn.jtvnw.net",
    "static-cdn.twitchcdn.net",
    "yt3.ggpht.com",
  ]);

  return exactHosts.has(host) || host === "mzstatic.com" || host.endsWith(".mzstatic.com");
}

function allowedImageContentType(contentType: string): boolean {
  return ["image/jpeg", "image/png", "image/webp", "image/gif", ""].some((type) => contentType === type || (type !== "" && contentType.startsWith(type)));
}

function imageContentTypeFromFormat(format: string | undefined): ShareCardImage["contentType"] | null {
  if (format === "jpeg") {
    return "image/jpeg";
  }

  if (format === "png") {
    return "image/png";
  }

  if (format === "webp") {
    return "image/webp";
  }

  if (format === "gif") {
    return "image/gif";
  }

  return null;
}

function shareCardCacheKey(value: string): string | null {
  const normalized = value.trim().toLowerCase();

  return /^[a-z0-9_-]{1,80}$/u.test(normalized) ? `${normalized}-${shareCardCacheVersion}` : null;
}

function bodySnippet(value: string, maxLength: number): string {
  const normalized = value.replace(/\s+/gu, " ").trim();

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, Math.max(1, maxLength - 1)).trimEnd()}...`;
}

function trimForSvg(value: string, maxLength: number): string {
  return value.length <= maxLength ? value : `${value.slice(0, Math.max(1, maxLength - 1)).trimEnd()}...`;
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&apos;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
