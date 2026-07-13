import { mkdir, mkdtemp, rm, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import type { PostsRepository } from "./posts.js";
import type { PostPayload, ProfilePayload, ProfilesRepository } from "./profiles.js";
import type { RoomsRepository } from "./rooms.js";
import { createShareShellService } from "./share-shells.js";

const post = {
  id: 99,
  publicId: "pc359fe2da759",
  body: "A post with a pretty share card.",
  mediaUrl: null,
  mediaPosterUrl: null,
  updatedAt: "2026-07-08 12:00:00",
  createdAt: "2026-07-08 12:00:00",
  author: {
    id: 1,
    handle: "thia",
    displayName: "Thia",
  },
} as PostPayload;

const profile = {
  bio: "A profile with a faithful share card.",
  bannerUrl: null,
  profileBackground: null,
  profileThemeConfig: null,
  updatedAt: "2026-07-13 12:00:00",
  user: {
    id: 1,
    handle: "thia",
    displayName: "Thia",
    avatarUrl: null,
  },
  viewerCanView: true,
} as ProfilePayload;

let temporaryRoot: string | null = null;

afterEach(async () => {
  if (temporaryRoot !== null) {
    await rm(temporaryRoot, { force: true, recursive: true });
    temporaryRoot = null;
  }
});

describe("share shell service", () => {
  it("uses cached frontend screenshot cards for post OG images", async () => {
    const { service, uploadRoot } = await shareShellFixture();
    const cacheDirectory = path.join(uploadRoot, "share-cards", "posts");
    await mkdir(cacheDirectory, { recursive: true });
    await writeFile(path.join(cacheDirectory, "pc359fe2da759-screenshot-v7.jpg"), "jpeg");

    const response = await service.postShare({
      handle: "thia",
      postId: "pc359fe2da759",
    });

    expect(response.kind).toBe("html");

    if (response.kind !== "html") {
      return;
    }

    expect(metaContent(response.html, "og:image")).toContain("/uploads/share-cards/posts/pc359fe2da759-screenshot-v7.jpg");
    expect(metaContent(response.html, "og:image:type")).toBe("image/jpeg");
    expect(metaContent(response.html, "og:image")).not.toContain("/api/posts/pc359fe2da759/share-card.png");
  });

  it("marks uncached post share-card API fallbacks as frontend-rendered JPEG images", async () => {
    const { service } = await shareShellFixture();

    const response = await service.postShare({
      handle: "thia",
      postId: "pc359fe2da759",
    });

    expect(response.kind).toBe("html");

    if (response.kind !== "html") {
      return;
    }

    expect(metaContent(response.html, "og:image")).toContain("/api/posts/pc359fe2da759/share-card.png");
    expect(metaContent(response.html, "og:image:type")).toBe("image/jpeg");
  });

  it("ignores legacy v6 profile cards when the current artifact is missing", async () => {
    const { service, uploadRoot } = await shareShellFixture();
    const cacheDirectory = path.join(uploadRoot, "share-cards", "profiles");
    await mkdir(cacheDirectory, { recursive: true });
    await writeFile(path.join(cacheDirectory, "thia-screenshot-v6.jpg"), "legacy jpeg");

    const response = await service.profileShare({ handle: "thia" });

    expect(response.kind).toBe("html");

    if (response.kind !== "html") {
      return;
    }

    expect(metaContent(response.html, "og:image")).toContain("/api/profiles/thia/share-card.png");
    expect(metaContent(response.html, "og:image")).not.toContain("screenshot-v6");
    expect(metaContent(response.html, "og:image:type")).toBe("image/jpeg");
  });

  it("selects the v7 profile card even when a legacy v6 artifact remains", async () => {
    const { service, uploadRoot } = await shareShellFixture();
    const cacheDirectory = path.join(uploadRoot, "share-cards", "profiles");
    await mkdir(cacheDirectory, { recursive: true });
    await writeFile(path.join(cacheDirectory, "thia-screenshot-v6.jpg"), "legacy jpeg");
    await writeFile(path.join(cacheDirectory, "thia-screenshot-v7.jpg"), "current jpeg");

    const response = await service.profileShare({ handle: "thia" });

    expect(response.kind).toBe("html");

    if (response.kind !== "html") {
      return;
    }

    expect(metaContent(response.html, "og:image")).toContain("/uploads/share-cards/profiles/thia-screenshot-v7.jpg");
    expect(metaContent(response.html, "og:image")).not.toContain("screenshot-v6");
  });

  it("changes the profile card cache buster for writes within the same second", async () => {
    const { service, uploadRoot } = await shareShellFixture();
    const cacheDirectory = path.join(uploadRoot, "share-cards", "profiles");
    const cachePath = path.join(cacheDirectory, "thia-screenshot-v7.jpg");
    await mkdir(cacheDirectory, { recursive: true });
    await writeFile(cachePath, "current jpeg");
    await utimes(cachePath, new Date("2026-07-13T12:00:00.100Z"), new Date("2026-07-13T12:00:00.100Z"));

    const first = await service.profileShare({ handle: "thia" });
    await utimes(cachePath, new Date("2026-07-13T12:00:00.900Z"), new Date("2026-07-13T12:00:00.900Z"));
    const second = await service.profileShare({ handle: "thia" });

    expect(first.kind).toBe("html");
    expect(second.kind).toBe("html");

    if (first.kind !== "html" || second.kind !== "html") {
      return;
    }

    expect(metaContent(first.html, "og:image")).not.toBe(metaContent(second.html, "og:image"));
  });
});

async function shareShellFixture() {
  const root = await mkdtemp(path.join(tmpdir(), "thia-share-shells-"));
  temporaryRoot = root;
  const uploadRoot = path.join(root, "uploads");
  const webRoot = path.join(root, "www");
  const postsRepository = {
    getPublicPost: vi.fn().mockResolvedValue(post),
  } as unknown as PostsRepository;
  const profilesRepository = {
    getPublicProfile: vi.fn().mockResolvedValue(profile),
  } as unknown as ProfilesRepository;
  const roomsRepository = {} as RoomsRepository;
  const service = createShareShellService({
    postsRepository,
    profilesRepository,
    roomsRepository,
    publicBaseUrl: "https://thia.test",
    uploadRoot,
    webRoot,
  });

  return {
    service,
    uploadRoot,
  };
}

function metaContent(html: string, key: string): string {
  const normalizedKey = key.toLowerCase();

  for (const match of html.matchAll(/<meta\b[^>]*>/giu)) {
    const tag = match[0];
    const property = readAttribute(tag, "property").toLowerCase();
    const name = readAttribute(tag, "name").toLowerCase();

    if (property === normalizedKey || name === normalizedKey) {
      return readAttribute(tag, "content");
    }
  }

  return "";
}

function readAttribute(tag: string, name: string): string {
  const pattern = new RegExp(`${name}=["']([^"']*)["']`, "iu");
  const match = pattern.exec(tag);

  return match?.[1] ?? "";
}
