import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import type { PostsRepository } from "./posts.js";
import type { PostPayload, ProfilesRepository } from "./profiles.js";
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
    await writeFile(path.join(cacheDirectory, "pc359fe2da759-screenshot-v6.jpg"), "jpeg");

    const response = await service.postShare({
      handle: "thia",
      postId: "pc359fe2da759",
    });

    expect(response.kind).toBe("html");

    if (response.kind !== "html") {
      return;
    }

    expect(metaContent(response.html, "og:image")).toContain("/uploads/share-cards/posts/pc359fe2da759-screenshot-v6.jpg");
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
});

async function shareShellFixture() {
  const root = await mkdtemp(path.join(tmpdir(), "thia-share-shells-"));
  temporaryRoot = root;
  const uploadRoot = path.join(root, "uploads");
  const webRoot = path.join(root, "www");
  const postsRepository = {
    getPublicPost: vi.fn().mockResolvedValue(post),
  } as unknown as PostsRepository;
  const profilesRepository = {} as ProfilesRepository;
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
