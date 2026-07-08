import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import sharp from "sharp";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { PostsRepository } from "./posts.js";
import type { PostPayload, ProfilePayload, ProfilesRepository } from "./profiles.js";
import type { RoomsRepository } from "./rooms.js";
import {
  createShareCardService,
  type ShareCardRenderer,
} from "./share-cards.js";

const post = {
  id: 99,
  publicId: "pc359fe2da759",
  author: {
    id: 1,
    handle: "thia",
    displayName: "Thia",
  },
} as PostPayload;

const profile = {
  user: {
    id: 1,
    handle: "thia",
    displayName: "Thia",
  },
  viewerCanView: true,
} as ProfilePayload;

let temporaryUploadRoot: string | null = null;

afterEach(async () => {
  if (temporaryUploadRoot !== null) {
    await rm(temporaryUploadRoot, { force: true, recursive: true });
    temporaryUploadRoot = null;
  }
});

describe("share card service", () => {
  it("renders missing post share cards through the frontend screenshot renderer", async () => {
    const { renderer, service, uploadRoot } = await shareCardServiceFixture();

    const image = await service.postCard("pc359fe2da759", null);

    expect(image.contentType).toBe("image/jpeg");
    expect(image.body.byteLength).toBeGreaterThan(0);
    expect(renderer.render).toHaveBeenCalledWith("https://thia.test/share-render/post/pc359fe2da759");
    expect(existsSync(path.join(uploadRoot, "share-cards", "posts", "pc359fe2da759-screenshot-v6.jpg"))).toBe(true);
  });

  it("renders missing profile share cards through the frontend screenshot renderer", async () => {
    const { renderer, service, uploadRoot } = await shareCardServiceFixture();

    const image = await service.profileCard("thia");

    expect(image.contentType).toBe("image/jpeg");
    expect(image.body.byteLength).toBeGreaterThan(0);
    expect(renderer.render).toHaveBeenCalledWith("https://thia.test/share-render/profile/thia");
    expect(existsSync(path.join(uploadRoot, "share-cards", "profiles", "thia-screenshot-v6.jpg"))).toBe(true);
  });

  it("refreshes profile cards even when a cached frontend screenshot already exists", async () => {
    const { renderer, service } = await shareCardServiceFixture();

    await service.profileCard("thia");
    await service.profileCard("thia");
    await service.refreshProfileCard("thia");

    expect(renderer.render).toHaveBeenCalledTimes(2);
  });
});

async function shareCardServiceFixture() {
  const uploadRoot = await mkdtemp(path.join(tmpdir(), "thia-share-cards-"));
  temporaryUploadRoot = uploadRoot;
  const renderer: ShareCardRenderer = {
    render: vi.fn(() => testShareCardJpeg()),
  };
  const postsRepository = {
    getPublicPost: vi.fn().mockResolvedValue(post),
  } as unknown as PostsRepository;
  const profilesRepository = {
    getPublicProfile: vi.fn().mockResolvedValue(profile),
  } as unknown as ProfilesRepository;
  const roomsRepository = {} as RoomsRepository;
  const service = createShareCardService({
    postsRepository,
    profilesRepository,
    roomsRepository,
    uploadRoot,
    publicBaseUrl: "https://thia.test",
    renderer,
  });

  return {
    renderer,
    service,
    uploadRoot,
  };
}

function testShareCardJpeg(): Promise<Buffer> {
  return sharp({
    create: {
      width: 2400,
      height: 1260,
      channels: 3,
      background: "#092119",
    },
  })
    .jpeg({ quality: 90 })
    .toBuffer();
}
