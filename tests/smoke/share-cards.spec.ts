import { expect, test, type Page } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.route("**/api/auth/me", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ ok: true, user: null }),
    }),
  );
});

test("profile share render uses module mosaic previews and skips Feed", async ({ page }) => {
  await mockShareCardImages(page);
  await page.route("**/api/profiles/thia", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ ok: true, data: profileFixture() }),
    }),
  );
  await page.route("**/api/profiles/thia/modules", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: [
          moduleFixture("activity", { id: 1, title: "Feed" }),
          moduleFixture("uploaded_image", {
            id: 2,
            config: {
              mediaItems: [{ url: "/uploads/media/2026/06/shareimage.jpg" }],
            },
          }),
          moduleFixture("links", {
            id: 3,
            config: {
              links: [
                { label: "Portfolio", url: "https://example.com/work" },
                { label: "Music", url: "https://open.spotify.com/user/thia" },
              ],
            },
          }),
          moduleFixture("spotify_song", {
            id: 4,
            config: {
              integration: spotifyTrackCard(),
            },
          }),
          moduleFixture("custom_text", {
            id: 5,
            config: {
              body: "**Pinned note** with a favorite lyric.",
            },
          }),
        ],
      }),
    }),
  );
  await page.route("**/api/profiles/thia/posts", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ ok: true, data: [] }),
    }),
  );

  await page.goto("/share-render/profile/thia");
  await expect(page.locator("[data-share-card-canvas][data-share-card-ready='true']")).toBeVisible();
  await expect(page.locator("[data-share-card-brand]")).toHaveCSS("height", "56px");
  await expect(page.locator('[data-share-card-module-type="activity"]')).toHaveCount(0);

  const imageModule = page.locator('[data-share-card-module-type="uploaded_image"]');
  await expect(imageModule.locator("img")).toHaveCount(1);
  await expect(imageModule.getByText(/uploaded image|image|module/i)).toHaveCount(0);

  await expect(page.locator('[data-share-card-module-type="links"]')).toContainText("Portfolio");
  await expect(page.locator('[data-share-card-module-type="links"]')).toContainText("example.com");
  await expect(page.locator('[data-share-card-module-type="spotify_song"]')).toContainText("Crystal Song");
  await expect(page.locator('[data-share-card-module-type="spotify_song"]')).toContainText("Spotify");
});

test("post share render uses the post author avatar and post media", async ({ page }) => {
  await mockShareCardImages(page);
  await page.route("**/api/posts/pcard123", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: postFixture(),
      }),
    }),
  );

  await page.goto("/share-render/post/pcard123");
  await expect(page.locator("[data-share-card-canvas][data-share-card-ready='true']")).toBeVisible();
  await expect(page.locator("[data-share-card-brand]")).toHaveCSS("height", "56px");

  const avatarSrc = await page.locator("[data-share-card-post-author-avatar]").getAttribute("src");
  const mediaSrc = await page.locator("[data-share-card-post-media]").getAttribute("src");

  expect(decodeURIComponent(avatarSrc ?? "")).toContain("/uploads/media/2026/06/post-author.jpg");
  expect(decodeURIComponent(mediaSrc ?? "")).toContain("/uploads/media/2026/06/post-media.jpg");
  expect(decodeURIComponent(mediaSrc ?? "")).not.toContain("/uploads/media/2026/06/post-author.jpg");
});

async function mockShareCardImages(page: Page) {
  await page.route("**/api/share-card/image?**", (route) =>
    route.fulfill({
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800"><rect width="800" height="800" fill="#153f3a"/><circle cx="400" cy="340" r="210" fill="#65e0c5"/><rect x="180" y="520" width="440" height="120" rx="60" fill="#061820"/></svg>',
    }),
  );
}

function profileFixture() {
  return {
    user: {
      id: 1,
      handle: "thia",
      displayName: "Thia",
      initials: "T",
      aura: "frost",
      avatarUrl: "/uploads/media/2026/06/profile-avatar.jpg",
    },
    bio: "The queen, owner and creator of thia.lol",
    bioEntities: [],
    location: "",
    bannerUrl: "/uploads/media/2026/06/profile-banner.jpg",
    profileBackground: "/uploads/media/2026/06/profile-background.jpg",
    profileBackgroundVideo: null,
    profileBackgroundVideoPoster: null,
    profileBackgroundBlur: "soft",
    profileAccent: null,
    profileTheme: null,
    profileThemeConfig: { mode: "preset", preset: "leafveil" },
    profileLayoutPreset: "showcase",
    profileCanvasVersion: 1,
    profileCanvasGlass: 70,
    visibility: "public",
    isPrivate: false,
    viewerCanView: true,
    featuredPostId: null,
    featuredRoomId: null,
    featuredPost: null,
    featuredRoom: null,
    links: [],
    traits: [],
    stats: {
      posts: 3,
      replies: 0,
      rooms: 1,
      echoes: 26,
      followers: 14,
      following: 27,
      moots: 0,
      stars: 4,
    },
    followerCount: 14,
    followingCount: 27,
    mootCount: 0,
    starCount: 4,
    isFollowing: false,
    isFollowedBy: false,
    isMoot: false,
    isStarred: false,
    isFollowRequestPending: false,
    blockedByMe: false,
    mutedByMe: false,
    createdAt: "2026-06-01 12:00:00",
    updatedAt: "2026-06-22 12:00:00",
  };
}

function moduleFixture(
  type: string,
  overrides: Record<string, unknown> = {},
) {
  return {
    id: 1,
    type,
    title: null,
    config: {},
    visibility: "public",
    position: 1,
    pinned: false,
    layout: null,
    status: "active",
    textEntities: {},
    schemaVersion: 1,
    createdAt: "2026-06-01 12:00:00",
    updatedAt: "2026-06-22 12:00:00",
    ...overrides,
  };
}

function spotifyTrackCard() {
  return {
    provider: "spotify",
    resourceType: "track",
    resourceId: "track-1",
    resourceKey: "spotify:track:track-1",
    sourceUrl: "https://open.spotify.com/track/track-1",
    metadata: {
      title: "Crystal Song",
      subtitle: "Moon Artist",
      description: "A favorite song.",
      imageUrl: "https://i.scdn.co/image/share-card-art",
      stats: {
        popularity: 88,
      },
    },
    embed: null,
    apiBacked: true,
    fetchedAt: "2026-06-22 12:00:00",
    expiresAt: null,
    staleAt: null,
    stale: false,
    lastError: null,
  };
}

function postFixture() {
  return {
    id: 44,
    publicId: "pcard123",
    body: "Post media should be the preview image.",
    bodyEntities: [],
    mood: "",
    mediaUrl: "/uploads/media/2026/06/post-media.jpg",
    visibility: "public",
    status: "published",
    parentId: null,
    deletedAt: null,
    createdAt: "2026-06-22 12:00:00",
    updatedAt: "2026-06-22 12:00:00",
    author: {
      id: 7,
      handle: "poster",
      displayName: "Actual Poster",
      initials: "AP",
      aura: "frost",
      avatarUrl: "/uploads/media/2026/06/post-author.jpg",
    },
    room: {
      id: 1,
      slug: "general",
      name: "General",
      summary: "General room.",
      description: "General room.",
      mood: "frost",
      members: 1,
      memberCount: 1,
      live: false,
      accent: "#61e2d4",
      visibility: "public",
      postCount: 1,
    },
    commentCount: 2,
    reactions: {
      glow: 9,
      echo: 0,
      hush: 0,
    },
    likeCount: 9,
    likedByCurrentUser: false,
    reblogCount: 0,
    rebloggedByMe: false,
    rebloggedByCurrentUser: false,
    rebloggedBy: null,
    rebloggedAt: null,
    socialContext: {
      authorRelationship: null,
      likedByFollowedCount: 0,
    },
    canonicalPath: "/@poster/posts/pcard123",
    canonicalUrl: "https://thia.lol/@poster/posts/pcard123",
  };
}
