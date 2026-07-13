import { existsSync } from "node:fs";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import sharp from "sharp";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { PostsRepository } from "./posts.js";
import type { PostPayload, ProfilePayload, ProfilesRepository } from "./profiles.js";
import type { RoomsRepository } from "./rooms.js";
import {
  createShareCardService,
  shareCardReadySelector,
  type ShareCardRenderer,
} from "./share-cards.js";
import { shareCardCacheVersion } from "./share-card-version.js";

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
  it("waits for a ready frontend canvas matching the current cache version", () => {
    expect(shareCardReadySelector()).toBe(
      `[data-share-card-canvas][data-share-card-ready='true'][data-share-card-render-version='${shareCardCacheVersion}']`,
    );
  });

  it("renders missing post share cards through the frontend screenshot renderer", async () => {
    const { renderer, service, uploadRoot } = await shareCardServiceFixture();

    const image = await service.postCard("pc359fe2da759", null);

    expect(image.contentType).toBe("image/jpeg");
    expect(image.body.byteLength).toBeGreaterThan(0);
    expect(renderer.render).toHaveBeenCalledWith("https://thia.test/share-render/post/pc359fe2da759");
    expect(existsSync(path.join(uploadRoot, "share-cards", "posts", "pc359fe2da759-screenshot-v8.jpg"))).toBe(true);
  });

  it("renders missing profile share cards through the frontend screenshot renderer", async () => {
    const { renderer, service, uploadRoot } = await shareCardServiceFixture();

    const image = await service.profileCard("thia");

    expect(image.contentType).toBe("image/jpeg");
    expect(image.body.byteLength).toBeGreaterThan(0);
    expect(renderer.render).toHaveBeenCalledWith("https://thia.test/share-render/profile/thia");
    expect(existsSync(path.join(uploadRoot, "share-cards", "profiles", "thia-screenshot-v8.jpg"))).toBe(true);
  });

  it("ignores legacy v6 profile cards and writes the current screenshot artifact", async () => {
    const { renderer, service, uploadRoot } = await shareCardServiceFixture();
    const cacheDirectory = path.join(uploadRoot, "share-cards", "profiles");
    await mkdir(cacheDirectory, { recursive: true });
    await writeFile(
      path.join(cacheDirectory, "thia-screenshot-v6.jpg"),
      await testShareCardJpeg(),
    );

    await service.profileCard("thia");

    expect(renderer.render).toHaveBeenCalledOnce();
    expect(existsSync(path.join(cacheDirectory, "thia-screenshot-v8.jpg"))).toBe(true);
  });

  it("refreshes profile cards even when a cached frontend screenshot already exists", async () => {
    const { renderer, service } = await shareCardServiceFixture();

    await service.profileCard("thia");
    await service.profileCard("thia");
    await service.refreshProfileCard("thia");

    expect(renderer.render).toHaveBeenCalledTimes(2);
  });

  it("purges current and legacy profile cards when a profile is no longer public", async () => {
    const { getPublicProfile, service, uploadRoot } = await shareCardServiceFixture();
    const cacheDirectory = path.join(uploadRoot, "share-cards", "profiles");

    await service.profileCard("thia");
    await writeFile(path.join(cacheDirectory, "thia-screenshot-v6.jpg"), await testShareCardJpeg());
    getPublicProfile.mockResolvedValue({ ...profile, viewerCanView: false });

    await expect(service.refreshProfileCard("thia")).resolves.toBeNull();

    expect(existsSync(path.join(cacheDirectory, "thia-screenshot-v6.jpg"))).toBe(false);
    expect(existsSync(path.join(cacheDirectory, "thia-screenshot-v8.jpg"))).toBe(false);
  });

  it("purges current and legacy post cards when a post is no longer public", async () => {
    const { getPublicPost, service, uploadRoot } = await shareCardServiceFixture();
    const cacheDirectory = path.join(uploadRoot, "share-cards", "posts");

    await service.postCard("pc359fe2da759", null);
    await writeFile(path.join(cacheDirectory, "pc359fe2da759-screenshot-v6.png"), await testShareCardPng());
    getPublicPost.mockResolvedValue(null);

    await expect(service.refreshPostCard("pc359fe2da759", null)).resolves.toBeNull();

    expect(existsSync(path.join(cacheDirectory, "pc359fe2da759-screenshot-v6.png"))).toBe(false);
    expect(existsSync(path.join(cacheDirectory, "pc359fe2da759-screenshot-v8.jpg"))).toBe(false);
  });

  it("runs a trailing forced render when another refresh arrives in flight", async () => {
    const firstRender = deferred<Buffer>();
    const secondRender = deferred<Buffer>();
    const renderer: ShareCardRenderer = {
      render: vi.fn()
        .mockImplementationOnce(() => firstRender.promise)
        .mockImplementationOnce(() => secondRender.promise),
    };
    const { service } = await shareCardServiceFixture(renderer);
    const firstRefresh = service.refreshProfileCard("thia");

    await vi.waitFor(() => expect(renderer.render).toHaveBeenCalledTimes(1));
    const secondRefresh = service.refreshProfileCard("thia");
    firstRender.resolve(await testShareCardJpeg());
    await vi.waitFor(() => expect(renderer.render).toHaveBeenCalledTimes(2));
    secondRender.resolve(await testShareCardJpeg());

    await expect(Promise.all([firstRefresh, secondRefresh])).resolves.toHaveLength(2);
    expect(renderer.render).toHaveBeenCalledTimes(2);
  });

  it("waits out an in-flight render before purging a newly private profile", async () => {
    const pendingRender = deferred<Buffer>();
    const renderer: ShareCardRenderer = {
      render: vi.fn(() => pendingRender.promise),
    };
    const { getPublicProfile, service, uploadRoot } = await shareCardServiceFixture(renderer);
    const cacheDirectory = path.join(uploadRoot, "share-cards", "profiles");
    await mkdir(cacheDirectory, { recursive: true });
    await writeFile(path.join(cacheDirectory, "thia-screenshot-v6.jpg"), await testShareCardJpeg());
    const publicRefresh = service.refreshProfileCard("thia");

    await vi.waitFor(() => expect(renderer.render).toHaveBeenCalledOnce());
    getPublicProfile.mockResolvedValue({ ...profile, viewerCanView: false });
    const privacyRefresh = service.refreshProfileCard("thia");
    pendingRender.resolve(await testShareCardJpeg());

    await expect(publicRefresh).rejects.toMatchObject({ statusCode: 404 });
    await expect(privacyRefresh).resolves.toBeNull();
    expect(existsSync(path.join(cacheDirectory, "thia-screenshot-v6.jpg"))).toBe(false);
    expect(existsSync(path.join(cacheDirectory, "thia-screenshot-v8.jpg"))).toBe(false);
  });
});

async function shareCardServiceFixture(rendererOverride?: ShareCardRenderer) {
  const uploadRoot = await mkdtemp(path.join(tmpdir(), "thia-share-cards-"));
  temporaryUploadRoot = uploadRoot;
  const renderer: ShareCardRenderer = rendererOverride ?? {
    render: vi.fn(() => testShareCardJpeg()),
  };
  const getPublicPost = vi.fn().mockResolvedValue(post);
  const postsRepository = {
    getPublicPost,
  } as unknown as PostsRepository;
  const getPublicProfile = vi.fn().mockResolvedValue(profile);
  const profilesRepository = {
    getPublicProfile,
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
    getPublicPost,
    getPublicProfile,
    renderer,
    service,
    uploadRoot,
  };
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return { promise, reject, resolve };
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

function testShareCardPng(): Promise<Buffer> {
  return sharp({
    create: {
      width: 2400,
      height: 1260,
      channels: 3,
      background: "#092119",
    },
  })
    .png()
    .toBuffer();
}
