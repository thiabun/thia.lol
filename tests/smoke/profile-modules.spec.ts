import { expect, type Page, test } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

test("profile renders public modules safely", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockProfileModules(page, {
    authenticated: false,
    modules: [
      {
        id: 1,
        type: "about",
        title: "About this space",
        config: { body: "Literal <strong>plain</strong> text" },
        visibility: "public",
        position: 1,
        status: "active",
        schemaVersion: 1,
        createdAt: "2026-06-12 00:00:00",
        updatedAt: "2026-06-12 00:00:00",
      },
      {
        id: 2,
        type: "links",
        title: "Elsewhere",
        config: {
          links: [{ label: "Personal site", url: "https://example.com/" }],
        },
        visibility: "public",
        position: 2,
        status: "active",
        schemaVersion: 1,
        createdAt: "2026-06-12 00:00:00",
        updatedAt: "2026-06-12 00:00:00",
      },
      {
        id: 3,
        type: "featured_badges",
        title: "Badge shelf",
        config: { userBadgeIds: [1] },
        visibility: "public",
        position: 3,
        status: "active",
        schemaVersion: 1,
        createdAt: "2026-06-12 00:00:00",
        updatedAt: "2026-06-12 00:00:00",
      },
    ],
  });

  await acknowledgeCookieNotice(page);
  await page.goto("/@thia");

  const section = page.getByTestId("profile-modules");
  await expect(section).toBeVisible();
  await expect(section.getByRole("heading", { name: "Personal space" })).toBeVisible();
  await expect(section.getByRole("heading", { name: "About this space" })).toBeVisible();
  await expect(section).toContainText("Literal <strong>plain</strong> text");
  await expect(section.locator("strong")).toHaveCount(0);
  await expect(section.getByRole("link", { name: "Personal site" })).toHaveAttribute(
    "href",
    "https://example.com/",
  );
  await expect(section.getByText("Founder", { exact: true })).toBeVisible();

  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(hasHorizontalOverflow).toBe(false);
});

test("visitor with no modules does not see fake module scaffolding", async ({ page }) => {
  await mockProfileModules(page, { authenticated: false, modules: [] });
  await acknowledgeCookieNotice(page);
  await page.goto("/@thia");

  await expect(page.getByTestId("profile-modules")).toHaveCount(0);
  await expect(page.getByText("No profile modules yet")).toHaveCount(0);
});

test("owner empty module state is honest", async ({ page }) => {
  await mockProfileModules(page, { authenticated: true, modules: [] });
  await acknowledgeCookieNotice(page);
  await page.goto("/@thia");

  await expect(page.getByTestId("profile-modules")).toBeVisible();
  await expect(page.getByRole("heading", { name: "No profile modules yet" })).toBeVisible();
  await expect(page.getByText("This space is empty for now.")).toBeVisible();
});

test("profile module API guardrails are present by inspection", async () => {
  const router = readFileSync("api/index.php", "utf8");
  const modulesApi = readFileSync("api/profile_modules.php", "utf8");
  const schema = readFileSync("backend/database/schema.sql", "utf8");
  const migration = readFileSync(
    "backend/database/migrations/20260612_0001_add_profile_modules.sql",
    "utf8",
  );

  expect(router).toContain("profile_modules.php");
  expect(router).toContain("profile_modules_dispatch($segments, $method)");
  expect(modulesApi).toContain("const PROFILE_MODULE_TYPES = ['about', 'links', 'featured_badges', 'custom_text']");
  expect(modulesApi).toContain("require_csrf_token($session)");
  expect(modulesApi).toContain("Profile module storage is not ready. Run pending migrations.");
  expect(modulesApi).toContain("profile_module_reject_unknown_keys");
  expect(modulesApi).toContain("profile_module_text_is_unsafe");
  expect(modulesApi).toContain("Module type cannot be changed.");
  expect(modulesApi).toContain("visibility = :visibility");
  expect(modulesApi).toContain("status = 'deleted'");
  expect(schema).toContain("CREATE TABLE IF NOT EXISTS profile_modules");
  expect(migration).toContain("KEY profile_modules_user_position_idx (user_id, position)");
});

test("profile module validation passes backend regression fixture", async () => {
  const output = execFileSync("php", ["tests/backend/profile-modules-regression.php"], {
    encoding: "utf8",
  });

  expect(output).toContain("profile modules regression ok");
});

async function mockProfileModules(
  page: Page,
  options: {
    authenticated: boolean;
    modules: unknown[];
  },
) {
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
      body: JSON.stringify({ ok: true, data: [] }),
    });
  });

  await page.route("**/api/profiles/thia", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, data: profileBody() }),
    });
  });

  await page.route("**/api/profiles/thia/modules", async (route) => {
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
      body: JSON.stringify({
        ok: true,
        data: {
          badges: [badgeGrant()],
          featuredBadges: [badgeGrant()],
        },
      }),
    });
  });

  for (const suffix of ["posts", "replies", "reblogs", "rooms", "followers", "following"]) {
    await page.route(`**/api/profiles/thia/${suffix}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, data: [] }),
      });
    });
  }
}

async function acknowledgeCookieNotice(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem("thia_cookie_notice_ack", "1");
  });
}

function profileBody() {
  return {
    user: {
      id: 1,
      handle: "thia",
      displayName: "Thia",
      initials: "T",
      aura: "frost",
      avatarUrl: null,
    },
    bio: "Founder profile for thia.lol.",
    location: "Oslo",
    bannerUrl: null,
    profileAccent: null,
    profileBackground: null,
    profileTheme: null,
    links: [],
    traits: [],
    stats: {
      posts: 0,
      replies: 0,
      rooms: 0,
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

function badgeGrant() {
  return {
    id: 1,
    reason: null,
    earnedAt: "2026-06-10 00:00:00",
    featuredOrder: 1,
    isVisible: true,
    grantedBy: null,
    badge: {
      id: 1,
      badgeKey: "founder",
      name: "Founder",
      description: "Granted to people who helped establish thia.lol.",
      rarity: "founder",
      source: "admin-granted",
      icon: "sparkles",
      accent: "founder",
      isActive: true,
      createdAt: "2026-06-10 00:00:00",
    },
  };
}
