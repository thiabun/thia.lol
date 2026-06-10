import { expect, type Page, test } from "@playwright/test";

test("profile connections normalize, save, and render", async ({ page }) => {
  let profileLinks: unknown[] = [];
  let savedPayload: Record<string, unknown> | undefined;

  await mockOwnProfile(page, () => profileLinks, (payload) => {
    savedPayload = payload;
    profileLinks = Array.isArray(payload.links) ? payload.links : [];
  });

  await acknowledgeCookieNotice(page);
  await page.goto("/@thia");
  await expect(page.getByRole("button", { name: "Edit profile" })).toBeVisible();

  await page.getByRole("button", { name: "Edit profile" }).click();
  const modal = page.getByTestId("profile-edit-modal");
  await expect(modal.getByRole("heading", { name: "Connections" })).toBeVisible();
  await expect(modal.getByLabel("Traits")).toHaveCount(0);

  await modal.getByRole("button", { name: "Add connection" }).click();
  await modal.getByRole("combobox", { name: "Connection 1" }).selectOption("github");
  await modal.getByRole("textbox", { name: "GitHub" }).fill("thiabun");
  await modal.getByRole("button", { name: "Save changes" }).click();

  await expect.poll(() => savedPayload).toBeTruthy();
  expect(savedPayload?.links).toMatchObject([
    {
      platform: "github",
      label: "GitHub",
      value: "thiabun",
      url: "https://github.com/thiabun",
    },
  ]);
  await expect(page.getByRole("link", { name: /GitHub/ })).toBeVisible();
});

test("profile followers, following, and badges use compact panels", async ({ page }) => {
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
  await expect(page.getByRole("dialog", { name: "Followers" })).toBeVisible();
  await expect(page.getByText("@alex")).toBeVisible();
  await page.getByRole("button", { name: "Close panel" }).click();

  await page.getByRole("button", { name: /Following/ }).click();
  await expect(page.getByRole("dialog", { name: "Following" })).toBeVisible();
  await expect(page.getByText("@mira")).toBeVisible();
  await page.getByRole("button", { name: "Close panel" }).click();

  await page.getByRole("button", { name: /Badges/ }).click();
  await expect(page.getByRole("dialog", { name: "Badges" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Founder" })).toBeVisible();
});

async function mockOwnProfile(
  page: Page,
  links: () => unknown[],
  onSave?: (payload: Record<string, unknown>) => void,
) {
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
      body: JSON.stringify({ ok: true, data: profileBody(links()) }),
    });
  });

  await page.route("**/api/profiles/thia", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, data: profileBody(links()) }),
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

function profileBody(links: unknown[]) {
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
