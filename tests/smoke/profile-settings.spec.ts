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

test("profile canvas editor replaces the retired customization modal", async ({ page }) => {
  await mockOwnProfile(page, () => [
    {
      platform: "github",
      label: "GitHub",
      value: "thiabun",
      url: "https://github.com/thiabun",
    },
  ]);

  await acknowledgeCookieNotice(page);
  await page.goto("/@thia");
  await expect(page.getByRole("button", { name: "Customize profile" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Edit personal space" })).toHaveCount(0);
  await expect(page.getByTestId("profile-edit-button")).toBeVisible();
  await page.getByTestId("profile-edit-button").click();
  await expect(page.getByTestId("profile-canvas-editor")).toBeVisible();
  await expect(page.getByTestId("profile-editor")).toHaveCount(0);
  await expect(page.getByTestId("profile-identity-editor")).toHaveCount(0);
  await expect(page.getByTestId("profile-customization-modal")).toHaveCount(0);
});

test("mobile profile stays stable with compact profile editor", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockOwnProfile(page, () => []);

  await acknowledgeCookieNotice(page);
  await page.goto("/@thia");

  await expect(page.getByRole("button", { name: "Customize profile" })).toHaveCount(0);
  await expect(page.getByTestId("profile-edit-button")).toBeVisible();
  await page.getByTestId("profile-edit-button").click();
  await expect(page.getByTestId("profile-canvas-editor")).toBeVisible();
  await expect(page.getByTestId("profile-editor")).toHaveCount(0);
  await expect(page.getByTestId("profile-customization-modal")).toHaveCount(0);
  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(hasHorizontalOverflow).toBe(false);
});

test("profile banners stay behind identity in public header", async ({ page }) => {
  await mockOwnProfile(page, () => [], undefined, {
    bannerUrl: "/uploads/media/2026/06/profile-test.webp",
    profileBackground: "/uploads/media/2026/06/profile-test.webp",
  });

  await acknowledgeCookieNotice(page);
  await page.goto("/@thia");

  await expect(page.getByTestId("profile-personal-backdrop")).toHaveAttribute(
    "data-profile-background-source",
    "image",
  );
  await expect(page.getByTestId("profile-personal-backdrop")).toHaveAttribute(
    "data-profile-background-blur",
    "medium",
  );
  await expect(page.getByTestId("profile-header-banner")).toBeVisible();
  await expect(page.getByTestId("profile-grid-module-profile_info")).toHaveAttribute(
    "data-profile-grid-size",
    "8x3",
  );
  await expect(page.getByTestId("profile-grid-module-profile_info")).toHaveAttribute(
    "data-profile-grid-row-span",
    "3",
  );
  await expect(page.getByRole("heading", { name: "Thia" })).toBeVisible();
  await expect(page.getByText("@thia")).toBeVisible();
  await expectElementAtPointBelongsTo(
    page,
    page.getByRole("heading", { name: "Thia" }),
    ["profile-info-content-cluster", "profile-info-identity-row"],
  );
});

test("profile API keeps legacy link saves guarded by source inspection", async () => {
  const profileApi = readFileSync("api/profile.php", "utf8");

  expect(profileApi).toContain("function profile_connection_from_legacy_map");
  expect(profileApi).toContain("!array_key_exists('platform', $value)");
  expect(profileApi).toContain("profile_website_connection($trimmed)");
  expect(profileApi).toContain("Website URL must be a valid https URL.");
  expect(profileApi).toContain("profile_update_failed_on_missing_customization_column");
  expect(profileApi).toContain("Profile customization migration has not been applied.");
  expect(profileApi).toContain("profile_update_failed_on_invalid_json");
  expect(profileApi).toContain("Profile data could not be saved. Check profile links and try again.");
});

test("profile API accepts null optional fields by backend regression fixture", async () => {
  const output = execFileSync("php", ["tests/backend/profile-save-regression.php"], {
    encoding: "utf8",
  });

  expect(output).toContain("profile save regression ok");
});

test("profile followers and following use compact panels", async ({ page }) => {
  await mockOwnProfile(page, () => [
    {
      platform: "youtube",
      label: "YouTube",
      value: "thia",
      url: "https://www.youtube.com/@thia",
    },
  ]);

  await acknowledgeCookieNotice(page);
  await page.goto("/@thia");

  const tabs = page.getByRole("tablist", { name: "Profile sections" });
  await expect(tabs.getByRole("tab", { name: /Feed/ })).toBeVisible();
  await expect(tabs.getByRole("tab", { name: /Replies/ })).toBeVisible();
  await expect(tabs.getByRole("tab", { name: /Rooms/ })).toBeVisible();
  await expect(tabs.getByRole("tab", { name: /Followers/ })).toHaveCount(0);
  await expect(tabs.getByRole("tab", { name: /Badges/ })).toHaveCount(0);
  await expect(page.getByRole("link", { name: /YouTube/ })).toBeVisible();

  await page.getByRole("button", { name: /Followers/ }).click();
  let dialog = page.getByRole("dialog", { name: "Followers" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("link", { name: "Alex's profile" })).toHaveAttribute(
    "href",
    "/@alex",
  );
  await page.getByRole("button", { name: "Close panel" }).click();

  await page.getByRole("button", { name: /Following/ }).click();
  dialog = page.getByRole("dialog", { name: "Following" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("link", { name: "Mira's profile" })).toHaveAttribute(
    "href",
    "/@mira",
  );
  await page.getByRole("button", { name: "Close panel" }).click();

  await expect(page.getByRole("button", { name: /Badges/ })).toHaveCount(0);
});

test("profile layout renders identity, essential social stats, activity module, and mobile stack", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockOwnProfile(page, () => [
    {
      platform: "github",
      label: "GitHub",
      value: "thiabun",
      url: "https://github.com/thiabun",
    },
  ]);

  await acknowledgeCookieNotice(page);
  await page.goto("/@thia");

  await expect(page.getByTestId("profile-personal-backdrop")).toHaveAttribute(
    "data-profile-background-source",
    "fallback",
  );
  await expect(page.getByTestId("profile-grid-module-profile_info")).toHaveAttribute(
    "data-profile-grid-size",
    "8x3",
  );
  await expect(page.getByTestId("profile-grid-module-profile_info")).toHaveAttribute(
    "data-profile-grid-column-span",
    "8",
  );
  await expect(page.getByTestId("profile-grid-module-profile_info")).toHaveAttribute(
    "data-profile-grid-row-span",
    "3",
  );
  await expect(page.getByTestId("profile-header")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Thia" })).toBeVisible();
  await expect(page.getByText("@thia")).toBeVisible();
  await expect(page.getByText("Founder profile for thia.lol.")).toBeVisible();
  await expect(page.getByRole("link", { name: /GitHub/ })).toBeVisible();
  await expect(page.getByText("Founder", { exact: true })).toBeVisible();

  const socialContext = page.getByTestId("profile-social-context");
  await expect(socialContext.getByText("Likes")).toBeVisible();
  await expect(socialContext.getByText("Followers")).toBeVisible();
  await expect(socialContext.getByText("Following")).toBeVisible();
  await expect(socialContext.getByText("Posts")).toHaveCount(0);
  await expect(socialContext.getByText("Replies")).toHaveCount(0);
  await expect(socialContext.getByText("Rooms")).toHaveCount(0);
  await expect(socialContext.getByText("Moots")).toHaveCount(0);
  await expect(socialContext.getByText("Badges")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /1 Followers/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /1 Following/ })).toBeVisible();
  await expect(page.getByText("1 Moots")).toHaveCount(0);

  await expect(page.getByTestId("profile-grid-module-activity")).toBeVisible();
  const tabs = page.getByTestId("profile-activity-tabs");
  await expect(tabs.getByRole("tab", { name: /Feed/ })).toBeVisible();
  await expect(tabs.getByRole("tab", { name: /Replies/ })).toBeVisible();
  await expect(tabs.getByRole("tab", { name: /Rooms/ })).toBeVisible();
  await expect(page.getByText("No posts.")).toBeVisible();

  await tabs.getByRole("tab", { name: /Replies/ }).click();
  await expect(page.getByText("No replies.")).toBeVisible();

  await tabs.getByRole("tab", { name: /Rooms/ }).click();
  await expect(page.getByText("No rooms.")).toBeVisible();

  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(hasHorizontalOverflow).toBe(false);
});

async function mockOwnProfile(
  page: Page,
  links: () => unknown[],
  onSave?: (payload: Record<string, unknown>) => void,
  profileOverrides: Partial<ReturnType<typeof profileBody>> = {},
) {
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

  await page.route("**/api/me/profile", async (route) => {
    const payload = (await route.request().postDataJSON()) as Record<string, unknown>;
    onSave?.(payload);
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, data: profileBody(links(), profileOverrides) }),
    });
  });

  await page.route("**/api/profiles/thia", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, data: profileBody(links(), profileOverrides) }),
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

  await page.route("**/api/profiles/thia/modules", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, data: [profileInfoModule(), activityModule()] }),
    });
  });

  await page.route("**/api/me/profile/modules", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, data: [profileInfoModule(), activityModule()] }),
    });
  });

  await page.route("**/api/me/profile/canvas-draft**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: {
          backgroundBlur: profileOverrides.profileBackgroundBlur ?? "medium",
          canvasGlass: profileOverrides.profileCanvasGlass ?? 58,
          canvasVersion: 2,
          modules: [profileInfoModule(), activityModule()],
          selectedModuleId: null,
          updatedAt: null,
        },
      }),
    });
  });

  await page.route("**/api/profiles/thia/followers", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: [
          {
            handle: "alex",
            displayName: "Alex",
            initials: "A",
            avatarUrl: null,
            bioSnippet: "",
            isFollowing: true,
            isMoot: true,
          },
        ],
      }),
    });
  });

  await page.route("**/api/profiles/thia/following", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: [
          {
            handle: "mira",
            displayName: "Mira",
            initials: "M",
            avatarUrl: null,
            bioSnippet: "",
            isFollowing: true,
            isMoot: false,
          },
        ],
      }),
    });
  });

  for (const suffix of ["posts", "replies", "reblogs", "rooms"]) {
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

function profileBody(links: unknown[], overrides: Partial<ProfileBody> = {}): ProfileBody {
  const body: ProfileBody = {
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
    profileBackgroundBlur: "medium",
    profileTheme: null,
    profileLayoutPreset: "balanced",
    profileCanvasGlass: 58,
    profileCanvasVersion: 2,
    links,
    traits: [],
    stats: {
      posts: 0,
      replies: 0,
      rooms: 0,
      echoes: 0,
      followers: 1,
      following: 1,
      moots: 1,
    },
    followerCount: 1,
    followingCount: 1,
    mootCount: 1,
    isFollowing: false,
    isFollowedBy: false,
    isMoot: false,
    createdAt: "2026-06-10 00:00:00",
    updatedAt: "2026-06-10 00:00:00",
  };

  return {
    ...body,
    ...overrides,
    user: {
      ...body.user,
      ...(overrides.user ?? {}),
    },
  };
}

type ProfileBody = {
  user: {
    id: number;
    handle: string;
    displayName: string;
    initials: string;
    aura: string;
    avatarUrl: string | null;
  };
  bio: string;
  location: string;
  bannerUrl: string | null;
  profileAccent: string | null;
  profileBackground: string | null;
  profileBackgroundBlur: "none" | "soft" | "medium" | "heavy";
  profileTheme: string | null;
  profileLayoutPreset: "balanced" | "compact" | "showcase";
  profileCanvasGlass: number;
  profileCanvasVersion: 1 | 2;
  links: unknown[];
  traits: unknown[];
  stats: {
    posts: number;
    replies: number;
    rooms: number;
    echoes: number;
    followers: number;
    following: number;
    moots: number;
  };
  followerCount: number;
  followingCount: number;
  mootCount: number;
  isFollowing: boolean;
  isFollowedBy: boolean;
  isMoot: boolean;
  createdAt: string;
  updatedAt: string;
};

function profileInfoModule() {
  return {
    id: 1,
    type: "profile_info",
    title: "Profile info",
    config: {},
    visibility: "public",
    position: 0,
    status: "active",
    schemaVersion: 1,
    createdAt: "2026-06-12 00:00:00",
    updatedAt: "2026-06-12 00:00:00",
  };
}

function activityModule() {
  return {
    id: 9,
    type: "activity",
    title: "Feed",
    config: {},
    visibility: "public",
    position: 1,
    status: "active",
    schemaVersion: 1,
    createdAt: "2026-06-12 00:00:00",
    updatedAt: "2026-06-12 00:00:00",
  };
}

async function expectElementAtPointBelongsTo(
  page: Page,
  locator: Locator,
  testIds: string | string[],
) {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();

  const owner = await page.evaluate(
    ({ x, y }) => {
      const element = document.elementFromPoint(x, y);
      return element?.closest("[data-testid]")?.getAttribute("data-testid") ?? null;
    },
    {
      x: (box?.x ?? 0) + Math.min((box?.width ?? 0) - 4, 96),
      y: (box?.y ?? 0) + Math.min((box?.height ?? 0) - 4, 24),
    },
  );

  const expectedTestIds = Array.isArray(testIds) ? testIds : [testIds];
  expect(expectedTestIds).toContain(owner);
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
