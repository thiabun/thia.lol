import { expect, type Page, test } from "@playwright/test";
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

test("visitor profile renders featured post and room above modules", async ({ page }) => {
  await mockFeaturedProfile(page, {
    authenticated: false,
    featuredPost: postOption(),
    featuredRoom: roomOption(),
    modules: [aboutModule()],
  });
  await acknowledgeCookieNotice(page);
  await page.goto("/@thia");

  const featured = page.getByTestId("profile-featured-content");
  await expect(featured).toBeVisible();
  await expect(featured.getByRole("heading", { name: "Featured post" })).toBeVisible();
  await expect(featured).toContainText("A launch note worth keeping close.");
  await expect(featured.getByRole("heading", { name: "Featured room" })).toBeVisible();
  await expect(featured).toContainText("General");

  const modules = page.getByTestId("profile-modules");
  await expect(modules).toBeVisible();
  const featuredBox = await featured.boundingBox();
  const modulesBox = await modules.boundingBox();
  expect(featuredBox?.y ?? 0).toBeLessThan(modulesBox?.y ?? 0);
});

test("visitor without featured content sees no fake featured section", async ({ page }) => {
  await mockFeaturedProfile(page, {
    authenticated: false,
    featuredPost: null,
    featuredRoom: null,
    modules: [],
  });
  await acknowledgeCookieNotice(page);
  await page.goto("/@thia");

  await expect(page.getByTestId("profile-featured-content")).toHaveCount(0);
  await expect(page.getByText("Feature a post")).toHaveCount(0);
  await expect(page.getByText("Feature a room")).toHaveCount(0);
});

test("owner can select and clear featured content from customization", async ({ page }) => {
  const savedPayloads: Array<Record<string, unknown>> = [];
  await mockFeaturedProfile(page, {
    authenticated: true,
    featuredPost: null,
    featuredRoom: null,
    modules: [],
    onFeaturedSave: (payload) => {
      savedPayloads.push(payload);
    },
  });
  await acknowledgeCookieNotice(page);
  await page.goto("/@thia");

  await page.getByTestId("profile-header").getByRole("button", { name: "Customize profile" }).click();
  const modal = page.getByTestId("profile-customization-modal");
  await modal.getByRole("button", { name: /Featured/ }).click();

  const editor = modal.getByTestId("profile-featured-editor");
  await expect(editor).toBeVisible();
  await editor.getByLabel("Search posts").fill("launch");
  await editor.getByRole("button", { name: /A launch note worth keeping close/ }).click();
  await editor.getByLabel("Search rooms").fill("general");
  await editor.getByRole("button", { name: /General/ }).click();
  await editor.getByRole("button", { name: "Save featured content" }).click();

  await expect.poll(() => savedPayloads).toEqual([
    {
      featuredPostId: 101,
      featuredRoomId: 201,
    },
  ]);
  await expect(
    modal.getByTestId("profile-customization-preview").getByTestId("profile-featured-preview"),
  ).toContainText("A launch note worth keeping close.");

  await editor.getByRole("button", { name: "Clear" }).first().click();
  await editor.getByRole("button", { name: "Clear" }).last().click();
  await editor.getByRole("button", { name: "Save featured content" }).click();

  await expect.poll(() => savedPayloads).toEqual([
    {
      featuredPostId: 101,
      featuredRoomId: 201,
    },
    {
      featuredPostId: null,
      featuredRoomId: null,
    },
  ]);
});

test("owner empty featured state stays compact on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockFeaturedProfile(page, {
    authenticated: true,
    featuredPost: null,
    featuredRoom: null,
    modules: [],
  });
  await acknowledgeCookieNotice(page);
  await page.goto("/@thia");

  const featured = page.getByTestId("profile-featured-content");
  await expect(featured).toBeVisible();
  await expect(featured.getByText("Feature a post")).toBeVisible();
  await expect(featured.getByText("Feature a room")).toBeVisible();
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
      body: JSON.stringify({ ok: true, data: [roomOption(), roomOption({ id: 202, slug: "quiet", name: "Quiet Room" })] }),
    });
  });

  await page.route("**/api/profiles/thia", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: profileBody(featuredPost, featuredRoom),
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
        data: profileBody(featuredPost, featuredRoom),
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
      body: JSON.stringify({ ok: true, data: [postOption(), postOption({ id: 102, body: "A quiet archive note." })] }),
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
) {
  return {
    user: user(),
    bio: "Founder profile for thia.lol.",
    location: "Oslo",
    bannerUrl: null,
    profileAccent: null,
    profileBackground: null,
    profileTheme: null,
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

function aboutModule() {
  return {
    id: 1,
    type: "about",
    title: "About this space",
    config: { body: "Saved profile note" },
    visibility: "public",
    position: 1,
    status: "active",
    schemaVersion: 1,
    createdAt: "2026-06-12 00:00:00",
    updatedAt: "2026-06-12 00:00:00",
  };
}
