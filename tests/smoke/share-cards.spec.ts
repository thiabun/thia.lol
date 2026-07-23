import { expect, test, type Locator, type Page } from "@playwright/test";
import { Buffer } from "node:buffer";

test.beforeEach(async ({ page }) => {
  await page.route("**/api/auth/me", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ ok: true, user: null }),
    }),
  );
});

test("profile share render uses the real profile canvas treatments and modules", async ({
  page,
}) => {
  await mockProfileShareRender(page);

  await page.goto("/share-render/profile/thia");
  const shareCanvas = page.locator(
    "[data-share-card-canvas][data-share-card-ready='true']",
  );
  const profileCanvas = page.getByTestId("profile-module-grid");

  await expect(shareCanvas).toBeVisible();
  await expect(shareCanvas).toHaveAttribute(
    "data-share-card-render-version",
    "screenshot-v9",
  );
  await expect(page.locator("[data-share-card-brand]")).toHaveCSS(
    "height",
    "52px",
  );
  await expect(
    page.locator("[data-share-card-profile-screenshot]"),
  ).toBeVisible();
  await expect(
    page.locator("[data-share-card-profile-canvas]"),
  ).toHaveAttribute("data-share-card-profile-canvas-glass", "92");
  await expect(
    page.locator("[data-share-card-profile-canvas]"),
  ).toHaveAttribute("data-share-card-profile-canvas-alpha", "12");
  await expect(
    page.locator("[data-share-card-profile-canvas]"),
  ).toHaveAttribute("data-share-card-profile-module-alpha", "36");

  const backdrop = page.getByTestId("profile-personal-backdrop");
  await expect(backdrop).toHaveAttribute(
    "data-profile-background-source",
    "video",
  );
  await expect(backdrop).toHaveAttribute(
    "data-profile-background-blur",
    "none",
  );
  await expect(backdrop).toHaveAttribute(
    "data-profile-background-visibility",
    "clear",
  );
  await expect(backdrop.locator("video")).toHaveCSS("opacity", "0.84");

  await expect(profileCanvas).toHaveAttribute(
    "data-profile-canvas-glass",
    "92",
  );
  const glassVariables = await profileCanvas.evaluate((element) => {
    const styles = window.getComputedStyle(element);

    return {
      canvas: styles.getPropertyValue("--profile-canvas-glass-alpha").trim(),
      modules: styles.getPropertyValue("--profile-module-glass-alpha").trim(),
    };
  });
  expect(glassVariables).toEqual({ canvas: "12%", modules: "36%" });

  const profileInfo = page.getByTestId("profile-module-profile-info");
  const activity = page.getByTestId("profile-module-activity");
  await expect(profileInfo).toContainText("Thia");
  await expect(profileInfo.getByText("Founder", { exact: true })).toBeVisible();
  await expect(activity).toContainText("Feed");
  await expect(
    activity
      .getByTestId("profile-activity-tabs")
      .getByRole("tab", { name: /Feed/ }),
  ).toContainText("2");
  await expect(
    activity.locator("[data-rich-embed-static='true']"),
  ).toHaveCount(1);
  await expect(
    activity.locator("[data-post-capture-music-fallback='spotify']"),
  ).toHaveCount(1);
  expect(
    await computedColorAlpha(
      profileInfo.locator("[data-profile-info-card='true']"),
    ),
  ).toBeCloseTo(0.36, 2);
  expect(await computedColorAlpha(activity)).toBeCloseTo(0.58, 2);

  const imageModule = page.getByTestId("profile-grid-module-uploaded_image");
  await expect(
    imageModule.getByTestId("profile-image-module-photo"),
  ).toHaveCount(1);
  await expect(
    imageModule.getByText(/uploaded image|image module/i),
  ).toHaveCount(0);

  const linksModule = page.getByTestId("profile-module-links");
  await expect(linksModule).toContainText("Portfolio");
  await expect(linksModule).toContainText("example.com");
  await expect(linksModule).toHaveAttribute(
    "data-profile-module-transparent-surface",
    "true",
  );
  expect(await computedColorAlpha(linksModule)).toBe(0);

  const spotifyModule = page.getByTestId("profile-grid-module-spotify_song");
  await expect(spotifyModule).toContainText("Crystal Song");
  await expect(
    spotifyModule.getByTestId("profile-spotify-custom-player"),
  ).toBeVisible();
  await expect(spotifyModule.locator("iframe")).toHaveCount(0);
  const spotifyCaptureControl = await spotifyModule
    .getByTestId("profile-spotify-play-button")
    .evaluate((element) => ({
      disabled: (element as HTMLButtonElement).disabled,
      opacity: getComputedStyle(element).opacity,
      pointerEvents: getComputedStyle(element).pointerEvents,
    }));
  expect(spotifyCaptureControl).toEqual({
    disabled: false,
    opacity: "1",
    pointerEvents: "none",
  });

  const appleMusicModule = page.getByTestId(
    "profile-grid-module-apple_music_song",
  );
  await expect(appleMusicModule).toContainText("Afterglow");
  await expect(
    appleMusicModule.getByRole("link", { name: "Afterglow Apple Music" }),
  ).toHaveAttribute(
    "href",
    "https://music.apple.com/us/song/afterglow/123456789",
  );
  await expect(appleMusicModule.locator("iframe")).toHaveCount(0);

  const twitchModule = page.getByTestId("profile-grid-module-twitch_channel");
  await expect(
    twitchModule.locator("[data-profile-capture-embed-fallback='video']"),
  ).toBeVisible();
  await expect(
    twitchModule.locator("[data-profile-capture-embed-fallback='chat']"),
  ).toBeVisible();
  await expect(twitchModule.locator("iframe")).toHaveCount(0);
  await expect(page.locator("iframe")).toHaveCount(0);

  const geometry = await shareCanvas.evaluate((element) => {
    const rect = element.getBoundingClientRect();

    return { height: rect.height, width: rect.width };
  });
  expect(geometry).toEqual({ height: 630, width: 1200 });
});

test("profile share render preserves opaque canvas and heavy backdrop treatments", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await mockProfileShareRender(page, {
    profileOverrides: {
      profileBackgroundBlur: "heavy",
      profileCanvasGlass: 0,
      profileThemeConfig: null,
    },
  });

  await page.goto("/share-render/profile/thia");
  await expect(
    page.locator("[data-share-card-canvas][data-share-card-ready='true']"),
  ).toBeVisible();

  const shareProfileCanvas = page.locator("[data-share-card-profile-canvas]");
  await expect(shareProfileCanvas).toHaveAttribute(
    "data-share-card-profile-canvas-glass",
    "0",
  );
  await expect(shareProfileCanvas).toHaveAttribute(
    "data-share-card-profile-canvas-alpha",
    "94",
  );
  await expect(shareProfileCanvas).toHaveAttribute(
    "data-share-card-profile-module-alpha",
    "78",
  );

  const inheritedTheme = await page.evaluate(() => {
    const shareCard = document.querySelector<HTMLElement>(
      "[data-share-card-canvas]",
    );

    if (!shareCard) {
      throw new Error("Share-card canvas did not render.");
    }

    return {
      cardCanvas: getComputedStyle(shareCard)
        .getPropertyValue("--app-canvas")
        .trim(),
      rootCanvas: getComputedStyle(document.documentElement)
        .getPropertyValue("--app-canvas")
        .trim(),
    };
  });
  expect(inheritedTheme.cardCanvas).toBe(inheritedTheme.rootCanvas);
  expect(inheritedTheme.cardCanvas).not.toBe("");

  const profileCanvas = page.getByTestId("profile-module-grid");
  const glassVariables = await profileCanvas.evaluate((element) => {
    const styles = window.getComputedStyle(element);

    return {
      canvas: styles.getPropertyValue("--profile-canvas-glass-alpha").trim(),
      modules: styles.getPropertyValue("--profile-module-glass-alpha").trim(),
    };
  });
  expect(glassVariables).toEqual({ canvas: "94%", modules: "78%" });

  const backdrop = page.getByTestId("profile-personal-backdrop");
  await expect(backdrop).toHaveAttribute(
    "data-profile-background-blur",
    "heavy",
  );
  await expect(backdrop).toHaveAttribute(
    "data-profile-background-visibility",
    "veiled",
  );
  const backdropMedia = backdrop.locator("video");
  await expect(backdropMedia).toHaveCSS("opacity", "0.46");
  expect(
    await backdropMedia.evaluate((element) => getComputedStyle(element).filter),
  ).toContain("blur(42px)");
});

test("profile share render does not expose a private profile canvas", async ({
  page,
}) => {
  await mockProfileShareRender(page, {
    profileOverrides: {
      isPrivate: true,
      viewerCanView: false,
    },
  });

  await page.goto("/share-render/profile/thia");
  await expect(page.getByText("This share card is unavailable.")).toBeVisible();
  await expect(
    page.locator("[data-share-card-canvas][data-share-card-ready='true']"),
  ).toHaveCount(0);
  await expect(page.getByTestId("profile-modules")).toHaveCount(0);
});

test("profile share render does not cache a partial canvas after a data failure", async ({
  page,
}) => {
  await mockProfileShareRender(page, { failModules: true });

  await page.goto("/share-render/profile/thia");
  await expect(page.getByText("This share card is unavailable.")).toBeVisible();
  await expect(
    page.locator("[data-share-card-canvas][data-share-card-ready='true']"),
  ).toHaveCount(0);
  await expect(page.getByTestId("profile-modules")).toHaveCount(0);
});

test("post share render uses the post author avatar and post media", async ({
  page,
}) => {
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
  await expect(
    page.locator("[data-share-card-canvas][data-share-card-ready='true']"),
  ).toBeVisible();
  await expect(page.locator("[data-share-card-brand]")).toHaveCSS(
    "height",
    "52px",
  );
  await expect(page.locator("[data-share-card-post-screenshot]")).toBeVisible();
  await expectShareMetricPill(
    page.locator("[data-share-card-post-metric='Replies']"),
  );
  await expectShareMetricPill(
    page.locator("[data-share-card-post-metric='Likes']"),
  );
  await expectShareMetricPill(
    page.locator("[data-share-card-post-metric='Reposts']"),
  );

  const avatarSrc = await page
    .locator("[data-share-card-post-author-avatar]")
    .getAttribute("src");
  const mediaSrc = await page
    .locator("[data-share-card-post-media]")
    .getAttribute("src");

  expect(decodeURIComponent(avatarSrc ?? "")).toContain(
    "/uploads/media/2026/06/post-author.jpg",
  );
  expect(decodeURIComponent(mediaSrc ?? "")).toContain(
    "/uploads/media/2026/06/post-media.jpg",
  );
  expect(decodeURIComponent(mediaSrc ?? "")).not.toContain(
    "/uploads/media/2026/06/post-author.jpg",
  );
});

async function mockShareCardImages(page: Page) {
  await page.route("**/api/share-card/image?**", (route) =>
    route.fulfill({
      contentType: "image/png",
      body: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
        "base64",
      ),
    }),
  );
}

type ProfileShareMockOptions = {
  failModules?: boolean | undefined;
  profileOverrides?: Record<string, unknown> | undefined;
};

async function mockProfileShareRender(
  page: Page,
  options: ProfileShareMockOptions = {},
) {
  await mockShareCardImages(page);
  await page.route("**/api/profiles/thia", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: profileFixture(options.profileOverrides),
      }),
    }),
  );
  await page.route("**/api/profiles/thia/modules", (route) =>
    options.failModules
      ? route.fulfill({
          contentType: "application/json",
          status: 503,
          body: JSON.stringify({
            ok: false,
            error: { message: "Profile modules are temporarily unavailable." },
          }),
        })
      : route.fulfill({
          contentType: "application/json",
          body: JSON.stringify({
            ok: true,
            data: [
          moduleFixture("profile_info", {
            id: 1,
            title: "Profile info",
            layout: { column: 1, row: 1, colSpan: 6, rowSpan: 3 },
          }),
          moduleFixture("activity", {
            id: 2,
            title: "Feed",
            layout: { column: 1, row: 4, colSpan: 4, rowSpan: 6 },
          }),
          moduleFixture("uploaded_image", {
            id: 3,
            config: {
              mediaItems: [{ url: "/uploads/media/2026/06/shareimage.jpg" }],
            },
            layout: { column: 7, row: 1, colSpan: 3, rowSpan: 4 },
          }),
          moduleFixture("links", {
            id: 4,
            config: {
              links: [
                { label: "Portfolio", url: "https://example.com/work" },
                { label: "Music", url: "https://open.spotify.com/user/thia" },
              ],
            },
            layout: { column: 10, row: 1, colSpan: 3, rowSpan: 2 },
          }),
          moduleFixture("spotify_song", {
            id: 5,
            config: {
              integration: spotifyTrackCard(),
              url: "https://open.spotify.com/track/track-1",
            },
            layout: { column: 10, row: 3, colSpan: 3, rowSpan: 2 },
          }),
          moduleFixture("apple_music_song", {
            id: 6,
            config: {
              integration: appleMusicTrackCard(),
              url: "https://music.apple.com/us/song/afterglow/123456789",
            },
            layout: { column: 5, row: 5, colSpan: 4, rowSpan: 2 },
          }),
          moduleFixture("twitch_channel", {
            id: 7,
            config: {
              displayMode: "stream_chat",
              integration: twitchChannelCard(),
              url: "https://www.twitch.tv/thia",
            },
            layout: { column: 5, row: 7, colSpan: 8, rowSpan: 6 },
          }),
            ],
          }),
        }),
  );
  await page.route("**/api/profiles/thia/posts", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ ok: true, data: [profileActivityPostFixture()] }),
    }),
  );
  await page.route("**/api/profiles/thia/reblogs", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ ok: true, data: [reblogFixture()] }),
    }),
  );
  await page.route("**/api/profiles/thia/badges", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: {
          badges: [founderBadgeFixture()],
          featuredBadges: [founderBadgeFixture()],
        },
      }),
    }),
  );
}

function profileFixture(overrides: Record<string, unknown> = {}) {
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
    profileBackgroundVideo:
      "/uploads/media/2026/06/profile_background-video.webm",
    profileBackgroundVideoPoster:
      "/uploads/media/2026/06/profile_background-poster.jpg",
    profileBackgroundBlur: "none",
    profileAccent: null,
    profileTheme: null,
    profileThemeConfig: { mode: "preset", preset: "leafveil" },
    profileLayoutPreset: "showcase",
    profileCanvasVersion: 1,
    profileCanvasGlass: 92,
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
    ...overrides,
  };
}

function moduleFixture(type: string, overrides: Record<string, unknown> = {}) {
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
    embed: {
      type: "iframe",
      src: "https://open.spotify.com/embed/track/track-1",
      title: "Crystal Song on Spotify",
      height: 152,
      allow: "autoplay; encrypted-media",
    },
    apiBacked: true,
    fetchedAt: "2026-06-22 12:00:00",
    expiresAt: null,
    staleAt: null,
    stale: false,
    lastError: null,
  };
}

function appleMusicTrackCard() {
  return {
    provider: "apple_music",
    resourceType: "song",
    resourceId: "123456789",
    resourceKey: "apple_music:song:123456789",
    sourceUrl: "https://music.apple.com/us/song/afterglow/123456789",
    metadata: {
      title: "Afterglow",
      subtitle: "Moon Artist",
      description: "A favorite Apple Music song.",
      imageUrl: "https://is1-ssl.mzstatic.com/image/thumb/share-card-art",
      stats: {},
    },
    embed: {
      type: "iframe",
      src: "https://embed.music.apple.com/us/song/afterglow/123456789",
      title: "Afterglow on Apple Music",
      height: 152,
      allow: "autoplay; encrypted-media",
    },
    apiBacked: true,
    fetchedAt: "2026-06-22 12:00:00",
    expiresAt: null,
    staleAt: null,
    stale: false,
    lastError: null,
  };
}

function twitchChannelCard() {
  return {
    provider: "twitch",
    resourceType: "channel",
    resourceId: "thia",
    resourceKey: "twitch:channel:thia",
    sourceUrl: "https://www.twitch.tv/thia",
    metadata: {
      title: "Thia live",
      subtitle: "Twitch",
      description: "A live studio session.",
      imageUrl: "/uploads/media/2026/06/twitch-preview.jpg",
      live: true,
    },
    embed: {
      type: "iframe",
      src: "https://player.twitch.tv/?channel=thia&parent=thia.lol",
      title: "Thia on Twitch",
      height: 360,
      allow: "autoplay; fullscreen",
    },
    apiBacked: true,
    fetchedAt: "2026-06-22 12:00:00",
    expiresAt: null,
    staleAt: null,
    stale: false,
    lastError: null,
  };
}

function founderBadgeFixture() {
  return {
    id: 1,
    badge: {
      id: 1,
      badgeKey: "founder",
      name: "Founder",
      description: "Founding member",
      rarity: "founder",
      source: "system",
      icon: null,
      accent: "#f7a7c4",
      isActive: true,
      createdAt: "2026-06-01 12:00:00",
    },
    reason: "Founding member",
    earnedAt: "2026-06-01 12:00:00",
    featuredOrder: 0,
    isVisible: true,
    grantedBy: null,
  };
}

function reblogFixture() {
  return {
    ...postFixture(),
    id: 45,
    publicId: "reblog123",
    body: "A reblogged post in the profile feed.",
    canonicalPath: "/@poster/posts/reblog123",
    canonicalUrl: "https://thia.lol/@poster/posts/reblog123",
  };
}

async function computedColorAlpha(locator: Locator): Promise<number> {
  return locator.evaluate((element) => {
    const color = getComputedStyle(element).backgroundColor;
    const slashAlpha = color.match(/\/\s*([\d.]+)\s*\)$/)?.[1];

    if (slashAlpha !== undefined) {
      return Number(slashAlpha);
    }

    const rgbaAlpha = color.match(
      /rgba\([^,]+,[^,]+,[^,]+,\s*([\d.]+)\s*\)/,
    )?.[1];

    if (rgbaAlpha !== undefined) {
      return Number(rgbaAlpha);
    }

    return color === "rgba(0, 0, 0, 0)" || color === "transparent" ? 0 : 1;
  });
}

async function expectShareMetricPill(locator: Locator) {
  await expect(locator).toBeVisible();

  const shape = await locator.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const styles = window.getComputedStyle(element);

    return {
      height: rect.height,
      radius: Number.parseFloat(styles.borderTopLeftRadius),
      width: rect.width,
    };
  });

  expect(shape.radius).toBeGreaterThanOrEqual(shape.height / 2 - 1);
  expect(shape.width).toBeGreaterThan(shape.height);
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

function profileActivityPostFixture() {
  const youtubeUrl = "https://www.youtube.com/watch?v=sharecard123";
  const body = `A profile activity post with ${youtubeUrl}`;
  const linkStart = body.indexOf(youtubeUrl);

  return {
    ...postFixture(),
    body,
    bodyEntities: [
      {
        type: "link",
        start: linkStart,
        length: youtubeUrl.length,
        text: youtubeUrl,
        link: { url: youtubeUrl },
      },
    ],
    mediaUrl: null,
    attachments: [
      {
        kind: "integration",
        position: 1,
        provider: "spotify",
        resourceId: "track-1",
        resourceType: "track",
        sourceUrl: "https://open.spotify.com/track/track-1",
        card: spotifyTrackCard(),
      },
    ],
  };
}
