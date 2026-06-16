import { expect, type Locator, type Page, test } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

test.beforeEach(async ({ context }) => {
  await context.route("**/api/**", async (route) => {
    await route.fulfill({
      status: 404,
      contentType: "application/json",
      body: JSON.stringify({
        ok: false,
        error: `Unmocked API route: ${route.request().method()} ${new URL(route.request().url()).pathname}`,
      }),
    });
  });
});

test("visitor profile renders featured post and room through the module grid", async ({ page }) => {
  await mockFeaturedProfile(page, {
    authenticated: false,
    featuredPost: postOption(),
    featuredRoom: roomOption(),
    modules: [
      featuredPostModule({ position: 1, title: "Pinned post" }),
      featuredRoomModule({ position: 2, title: "Pinned room" }),
      aboutModule({ position: 3 }),
    ],
  });
  await acknowledgeCookieNotice(page);
  await page.goto("/@thia");

  await expect(page.getByTestId("profile-featured-content")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Change" })).toHaveCount(0);

  const modules = page.getByTestId("profile-modules");
  await expect(modules).toBeVisible();
  await expect(modules.getByTestId("profile-grid-module-featured_post")).toBeVisible();
  await expect(modules.getByTestId("profile-grid-module-featured_post")).toHaveAttribute(
    "data-profile-grid-size",
    "3x2",
  );
  await expect(modules.getByTestId("profile-grid-module-featured_room")).toBeVisible();
  await expect(modules.getByTestId("profile-grid-module-featured_room")).toHaveAttribute(
    "data-profile-grid-size",
    "2x1",
  );

  const featuredPost = modules.getByTestId("profile-module-featured-post");
  await expect(featuredPost).toBeVisible();
  await expect(featuredPost.getByText("Pinned post", { exact: true })).toBeVisible();
  await expect(featuredPost.getByRole("heading", { name: "Featured post" })).toBeVisible();
  await expect(featuredPost).toContainText("A launch note worth keeping close.");

  const featuredRoom = modules.getByTestId("profile-module-featured-room");
  await expect(featuredRoom).toBeVisible();
  await expect(featuredRoom.getByText("Pinned room", { exact: true })).toBeVisible();
  await expect(featuredRoom.getByRole("heading", { name: "Featured room" })).toBeVisible();
  await expect(featuredRoom).toContainText("General");
  await expectTextOrder(modules, [
    "Pinned post",
    "A launch note worth keeping close.",
    "Pinned room",
    "About this space",
  ]);
});

test("visitor without featured content sees no fake featured module", async ({ page }) => {
  await mockFeaturedProfile(page, {
    authenticated: false,
    featuredPost: null,
    featuredRoom: null,
    modules: [featuredPostModule(), featuredRoomModule()],
  });
  await acknowledgeCookieNotice(page);
  await page.goto("/@thia");

  await expect(page.getByTestId("profile-featured-content")).toHaveCount(0);
  await expect(page.getByTestId("profile-grid-module-featured_post")).toHaveCount(0);
  await expect(page.getByTestId("profile-grid-module-featured_room")).toHaveCount(0);
  await expect(page.getByText("Feature a post")).toHaveCount(0);
  await expect(page.getByText("Feature a room")).toHaveCount(0);
});

test("visitor hidden featured module preference suppresses featured content", async ({ page }) => {
  await mockFeaturedProfile(page, {
    authenticated: false,
    featuredPost: postOption(),
    featuredRoom: roomOption(),
    modules: [
      featuredPostModule({ visibility: "hidden" }),
      featuredRoomModule({ visibility: "hidden" }),
    ],
  });
  await acknowledgeCookieNotice(page);
  await page.goto("/@thia");

  await expect(page.getByTestId("profile-grid-module-featured_post")).toHaveCount(0);
  await expect(page.getByTestId("profile-grid-module-featured_room")).toHaveCount(0);
  await expect(page.getByText("A launch note worth keeping close.")).toHaveCount(0);
  await expect(page.getByText("General")).toHaveCount(0);
});

test("visitor featured module respects profile layout and order", async ({ page }) => {
  await mockFeaturedProfile(page, {
    authenticated: false,
    featuredPost: postOption(),
    featuredRoom: null,
    modules: [aboutModule({ position: 1 }), featuredPostModule({ position: 2 })],
    profileOverrides: { profileLayoutPreset: "showcase" },
  });
  await acknowledgeCookieNotice(page);
  await page.goto("/@thia");

  const modules = page.getByTestId("profile-modules");
  const grid = modules.getByTestId("profile-module-grid");
  await expect(grid).toHaveAttribute("data-profile-layout-preset", "showcase");
  await expect(modules.getByTestId("profile-grid-module-featured_post")).toHaveAttribute(
    "data-profile-grid-size",
    "3x2",
  );
  await expectTextOrder(modules, [
    "Thia",
    "About this space",
    "Featured post",
    "A launch note worth keeping close.",
  ]);
});

test("first featured module can lead the showcase layout", async ({ page }) => {
  await mockFeaturedProfile(page, {
    authenticated: false,
    featuredPost: postOption(),
    featuredRoom: roomOption(),
    modules: [
      featuredPostModule({ position: 1 }),
      featuredRoomModule({ position: 2 }),
      aboutModule({ position: 3 }),
    ],
    profileOverrides: { profileLayoutPreset: "showcase" },
  });
  await acknowledgeCookieNotice(page);
  await page.goto("/@thia");

  const modules = page.getByTestId("profile-modules");
  await expect(modules.getByTestId("profile-grid-module-featured_post")).toHaveAttribute(
    "data-profile-grid-size",
    "3x2",
  );
  await expect(modules.getByTestId("profile-grid-module-featured_room")).toHaveAttribute(
    "data-profile-grid-size",
    "2x1",
  );
  await expectTextOrder(modules, [
    "Thia",
    "Featured post",
    "A launch note worth keeping close.",
    "Featured room",
    "About this space",
  ]);
});

test("owner can select and clear featured content from customization", async ({ page }) => {
  const savedPayloads: Array<Record<string, unknown>> = [];
  await mockFeaturedProfile(page, {
    authenticated: true,
    featuredPost: null,
    featuredRoom: null,
    modules: [featuredPostModule({ id: 8 }), featuredRoomModule({ id: 9, position: 2 })],
    onFeaturedSave: (payload) => {
      savedPayloads.push(payload);
    },
  });
  await acknowledgeCookieNotice(page);
  await page.goto("/@thia");

  await page.getByRole("button", { name: "Customize profile" }).click();
  const modal = page.getByTestId("profile-customization-modal");
  await modal.getByRole("button", { name: /Modules/ }).click();

  let moduleCard = modal.getByTestId("profile-module-card-8");
  await moduleCard.getByRole("button", { name: "Edit Featured post" }).click();
  let editor = moduleCard.getByTestId("profile-featured-editor");
  await expect(editor).toBeVisible();
  await editor.getByLabel("Search posts").fill("launch");
  await editor.getByRole("button", { name: /A launch note worth keeping close/ }).click();
  await moduleCard.getByRole("button", { name: "Save module" }).click();

  await expect.poll(() => savedPayloads).toEqual([
    {
      featuredPostId: 101,
      featuredRoomId: null,
    },
  ]);
  await expect(
    modal.getByTestId("profile-customization-preview").getByTestId("profile-featured-post-preview"),
  ).toContainText("A launch note worth keeping close.");

  moduleCard = modal.getByTestId("profile-module-card-9");
  await moduleCard.getByRole("button", { name: "Edit Featured room" }).click();
  editor = moduleCard.getByTestId("profile-featured-editor");
  await editor.getByLabel("Search rooms").fill("general");
  await editor.getByRole("button", { name: /General/ }).click();
  await moduleCard.getByRole("button", { name: "Save module" }).click();

  await expect.poll(() => savedPayloads).toEqual([
    {
      featuredPostId: 101,
      featuredRoomId: null,
    },
    {
      featuredPostId: 101,
      featuredRoomId: 201,
    },
  ]);
  await expect(
    modal.getByTestId("profile-customization-preview").getByTestId("profile-featured-room-preview"),
  ).toContainText("General");

  moduleCard = modal.getByTestId("profile-module-card-8");
  await moduleCard.getByRole("button", { name: "Edit Featured post" }).click();
  editor = moduleCard.getByTestId("profile-featured-editor");
  await editor.getByRole("button", { name: "Clear" }).click();
  await moduleCard.getByRole("button", { name: "Save module" }).click();

  await expect.poll(() => savedPayloads).toEqual([
    {
      featuredPostId: 101,
      featuredRoomId: null,
    },
    {
      featuredPostId: 101,
      featuredRoomId: 201,
    },
    {
      featuredPostId: null,
      featuredRoomId: 201,
    },
  ]);
});

test("owner empty featured state stays compact on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockFeaturedProfile(page, {
    authenticated: true,
    featuredPost: null,
    featuredRoom: null,
    modules: [featuredPostModule(), featuredRoomModule({ id: 9, position: 2 })],
  });
  await acknowledgeCookieNotice(page);
  await page.goto("/@thia");

  await expect(page.getByTestId("profile-featured-content")).toHaveCount(0);
  await expect(page.getByTestId("profile-grid-module-featured_post")).toHaveCount(0);
  await expect(page.getByTestId("profile-grid-module-featured_room")).toHaveCount(0);
  await expect(page.getByText("Feature a post or room")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Customize profile" })).toBeVisible();
  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(hasHorizontalOverflow).toBe(false);
});

test("featured content API guardrails are present by inspection", async () => {
  const profileApi = readFileSync("api/profile.php", "utf8");
  const readApi = readFileSync("api/read.php", "utf8");
  const schema = readFileSync("backend/database/schema.sql", "utf8");
  const migration = readFileSync(
    "backend/database/migrations/20260613_0001_add_profile_featured_content.sql",
    "utf8",
  );

  expect(profileApi).toContain("profile_featured_post_id_for_user");
  expect(profileApi).toContain("You can only feature your own posts.");
  expect(profileApi).toContain("Featured post is not available.");
  expect(profileApi).toContain("You can only feature rooms you own or belong to.");
  expect(profileApi).toContain("public_post_visible_sql('posts', 'rooms')");
  expect(profileApi).toContain("post_ancestor_visibility_sql('posts')");
  expect(readApi).toContain("fetch_profile_featured_post");
  expect(readApi).toContain("fetch_profile_featured_room");
  expect(readApi).toContain("viewer_feed_relationship_filter_sql");
  expect(schema).toContain("featured_post_id BIGINT UNSIGNED NULL");
  expect(schema).toContain("featured_room_id BIGINT UNSIGNED NULL");
  expect(migration).toContain("profiles_featured_post_idx");
  expect(migration).toContain("profiles_featured_room_idx");
});

test("profile featured validation passes backend regression fixture", async () => {
  const output = execFileSync("php", ["tests/backend/profile-featured-regression.php"], {
    encoding: "utf8",
  });

  expect(output).toContain("profile featured regression ok");
});

async function mockFeaturedProfile(
  page: Page,
  options: {
    authenticated: boolean;
    featuredPost: ReturnType<typeof postOption> | null;
    featuredRoom: ReturnType<typeof roomOption> | null;
    modules: unknown[];
    onFeaturedSave?: (payload: Record<string, unknown>) => void;
    profileOverrides?: Record<string, unknown>;
  },
) {
  let featuredPost = options.featuredPost;
  let featuredRoom = options.featuredRoom;

  await page.route("**/api/**", async (route) => {
    await route.fulfill({
      status: 404,
      contentType: "application/json",
      body: JSON.stringify({
        ok: false,
        error: `Unmocked API route: ${route.request().method()} ${new URL(route.request().url()).pathname}`,
      }),
    });
  });

  await page.route("**/api/auth/me", async (route) => {
    if (!options.authenticated) {
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ ok: false, error: "Unauthenticated." }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: {
          user: {
            id: 1,
            handle: "thia",
            email: "thia@example.test",
            role: "member",
            status: "active",
            displayName: "Thia",
            avatarUrl: null,
          },
          profile: {
            displayName: "Thia",
            bio: "Founder profile for thia.lol.",
            location: "Oslo",
            avatarUrl: null,
            links: [],
            traits: [],
          },
          csrfToken: "test-csrf",
        },
      }),
    });
  });

  await page.route("**/api/notifications", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, data: { notifications: [], unreadCount: 0 } }),
    });
  });

  await page.route("**/api/rooms", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: [roomOption(), roomOption({ id: 202, slug: "quiet", name: "Quiet Room" })],
      }),
    });
  });

  await page.route("**/api/profiles/thia", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: profileBody(featuredPost, featuredRoom, options.profileOverrides),
      }),
    });
  });

  await page.route("**/api/me/profile/featured", async (route) => {
    const payload = (await route.request().postDataJSON()) as Record<string, unknown>;
    options.onFeaturedSave?.(payload);
    featuredPost = payload.featuredPostId === 101 ? postOption() : null;
    featuredRoom = payload.featuredRoomId === 201 ? roomOption() : null;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: profileBody(featuredPost, featuredRoom, options.profileOverrides),
      }),
    });
  });

  await page.route("**/api/profiles/thia/modules", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: options.modules.filter(
          (module) =>
            typeof module === "object" &&
            module !== null &&
            "visibility" in module &&
            module.visibility === "public" &&
            "status" in module &&
            module.status === "active",
        ),
      }),
    });
  });

  await page.route("**/api/me/profile/modules", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, data: options.modules }),
    });
  });

  await page.route("**/api/profiles/thia/badges", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, data: { badges: [], featuredBadges: [] } }),
    });
  });

  await page.route("**/api/profiles/thia/posts", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: [postOption(), postOption({ id: 102, body: "A quiet archive note." })],
      }),
    });
  });

  for (const suffix of ["replies", "reblogs", "rooms", "followers", "following"]) {
    await page.route(`**/api/profiles/thia/${suffix}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          data: suffix === "rooms" ? [roomOption()] : [],
        }),
      });
    });
  }
}

async function acknowledgeCookieNotice(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem("thia_cookie_notice_ack", "1");
  });
}

function profileBody(
  featuredPost: ReturnType<typeof postOption> | null,
  featuredRoom: ReturnType<typeof roomOption> | null,
  overrides: Record<string, unknown> = {},
) {
  return {
    user: user(),
    bio: "Founder profile for thia.lol.",
    location: "Oslo",
    bannerUrl: null,
    profileAccent: null,
    profileBackground: null,
    profileTheme: null,
    profileLayoutPreset: "balanced",
    featuredPostId: featuredPost?.id ?? null,
    featuredRoomId: featuredRoom?.id ?? null,
    featuredPost,
    featuredRoom,
    links: [],
    traits: [],
    stats: {
      posts: 1,
      replies: 0,
      rooms: 1,
      echoes: 0,
      followers: 0,
      following: 0,
      moots: 0,
    },
    followerCount: 0,
    followingCount: 0,
    mootCount: 0,
    isFollowing: false,
    isFollowedBy: false,
    isMoot: false,
    createdAt: "2026-06-10 00:00:00",
    updatedAt: "2026-06-10 00:00:00",
    ...overrides,
  };
}

function user() {
  return {
    id: 1,
    handle: "thia",
    displayName: "Thia",
    initials: "T",
    aura: "frost",
    avatarUrl: null,
  };
}

function postOption(overrides: Partial<ReturnType<typeof postOptionShape>> = {}) {
  return {
    ...postOptionShape(),
    ...overrides,
  };
}

function postOptionShape() {
  return {
    id: 101,
    author: user(),
    room: roomOption(),
    body: "A launch note worth keeping close.",
    createdAt: "2026-06-13 10:00:00",
    updatedAt: "2026-06-13 10:00:00",
    mood: "sunveil",
    parentId: null,
    commentCount: 2,
    reactions: { glow: 3, echo: 0, hush: 0 },
    likeCount: 3,
    likedByCurrentUser: false,
    reblogCount: 0,
    rebloggedByMe: false,
    rebloggedByCurrentUser: false,
    rebloggedBy: null,
    rebloggedAt: null,
    visibility: "public",
    status: "published",
    deletedAt: null,
    socialContext: {
      authorRelationship: "self",
      likedByFollowedCount: 0,
    },
  };
}

function roomOption(overrides: Partial<ReturnType<typeof roomOptionShape>> = {}) {
  return {
    ...roomOptionShape(),
    ...overrides,
  };
}

function roomOptionShape() {
  return {
    id: 201,
    slug: "general",
    name: "General",
    summary: "A public room for everyday posts.",
    description: "A public room for everyday posts.",
    mood: "open",
    members: 1,
    memberCount: 1,
    live: false,
    accent: "var(--accent-sun)",
    iconUrl: null,
    bannerUrl: null,
    rules: "",
    visibility: "public",
    createdBy: 1,
    owner: user(),
    joinedByMe: true,
    myRoomRole: "owner",
    postCount: 4,
    latestActivityAt: "2026-06-13 10:00:00",
    createdAt: "2026-06-10 00:00:00",
    updatedAt: "2026-06-10 00:00:00",
  };
}

async function expectTextOrder(locator: Locator, texts: string[]) {
  const indexes = await locator.evaluate(
    (element, expectedTexts) =>
      expectedTexts.map((text) => element.textContent?.indexOf(text) ?? -1),
    texts,
  );

  for (const index of indexes) {
    expect(index).toBeGreaterThanOrEqual(0);
  }

  expect([...indexes].sort((a, b) => a - b)).toEqual(indexes);
}

function featuredPostModule(
  overrides: {
    id?: number;
    position?: number;
    status?: string;
    title?: string | null;
    visibility?: string;
  } = {},
) {
  return {
    id: overrides.id ?? 8,
    type: "featured_post",
    title: overrides.title ?? "Featured post",
    config: {},
    visibility: overrides.visibility ?? "public",
    position: overrides.position ?? 1,
    status: overrides.status ?? "active",
    schemaVersion: 1,
    createdAt: "2026-06-12 00:00:00",
    updatedAt: "2026-06-12 00:00:00",
  };
}

function featuredRoomModule(
  overrides: {
    id?: number;
    position?: number;
    status?: string;
    title?: string | null;
    visibility?: string;
  } = {},
) {
  return {
    id: overrides.id ?? 9,
    type: "featured_room",
    title: overrides.title ?? "Featured room",
    config: {},
    visibility: overrides.visibility ?? "public",
    position: overrides.position ?? 2,
    status: overrides.status ?? "active",
    schemaVersion: 1,
    createdAt: "2026-06-12 00:00:00",
    updatedAt: "2026-06-12 00:00:00",
  };
}

function aboutModule(
  overrides: {
    body?: string;
    id?: number;
    position?: number;
    status?: string;
    title?: string;
    visibility?: string;
  } = {},
) {
  return {
    id: overrides.id ?? 1,
    type: "about",
    title: overrides.title ?? "About this space",
    config: { body: overrides.body ?? "Saved profile note" },
    visibility: overrides.visibility ?? "public",
    position: overrides.position ?? 1,
    status: overrides.status ?? "active",
    schemaVersion: 1,
    createdAt: "2026-06-12 00:00:00",
    updatedAt: "2026-06-12 00:00:00",
  };
}
