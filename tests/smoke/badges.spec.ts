import { expect, type Page, test } from "@playwright/test";

type ApiEnvelope<T> = {
  ok: boolean;
  data?: T;
  error?: string;
};

test("profile Badges tab renders real empty state", async ({ page }) => {
  await mockProfileWithBadges(page, []);

  await page.goto("/@thia");
  await page.getByRole("tab", { name: /Badges/ }).click();

  await expect(page.getByRole("heading", { name: "No badges yet" })).toBeVisible();

  for (const badgeName of [
    "Founder",
    "Early User",
    "Bug Hunter",
    "Moderator",
    "Room Owner",
    "Mutual Magnet",
  ]) {
    await expect(page.getByText(badgeName, { exact: true })).toHaveCount(0);
  }
});

test("admin badge grant panel renders for admin", async ({ page }) => {
  await mockAdminBadgePanel(page);

  await page.goto("/admin");

  await expect(page.getByRole("heading", { name: "Badge management" })).toBeVisible();
  await expect(page.getByLabel("Handle")).toBeVisible();
  await expect(page.getByLabel("Badge")).toBeVisible();
  await expect(page.getByRole("button", { name: "Grant badge" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Founder" })).toBeVisible();
});

test("grant badge endpoint requires auth/admin", async ({ page }) => {
  test.skip(
    !process.env.THIA_BASE_URL,
    "Set THIA_BASE_URL to run API-backed badge endpoint smoke tests.",
  );

  await page.goto("/");

  const result = await page.evaluate(async () => {
    const response = await fetch("/api/admin/badges/grant", {
      method: "POST",
      credentials: "include",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ handle: "thia", badgeKey: "founder" }),
    });
    const json = (await response.json().catch(() => null)) as ApiEnvelope<unknown> | null;

    return {
      ok: json?.ok,
      status: response.status,
    };
  });

  expect(result.ok).toBe(false);
  expect([401, 403]).toContain(result.status);
});

test("profile badge endpoint works", async ({ page }) => {
  test.skip(
    !process.env.THIA_BASE_URL,
    "Set THIA_BASE_URL to run API-backed badge endpoint smoke tests.",
  );

  await page.goto("/");

  const result = await page.evaluate(async () => {
    const response = await fetch("/api/profiles/thia/badges", {
      credentials: "include",
      headers: { Accept: "application/json" },
    });
    const json = (await response.json()) as ApiEnvelope<{
      badges: unknown[];
      featuredBadges: unknown[];
    }>;

    return {
      body: json,
      status: response.status,
    };
  });

  expect(result.status).toBe(200);
  expect(result.body.ok).toBe(true);
  expect(Array.isArray(result.body.data?.badges)).toBe(true);
  expect(Array.isArray(result.body.data?.featuredBadges)).toBe(true);
});

async function mockProfileWithBadges(page: Page, badges: unknown[]) {
  await page.route("**/api/auth/me", async (route) => {
    await route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({ ok: false, error: "Unauthenticated." }),
    });
  });

  await page.route("**/api/profiles/thia", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: {
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
        },
      }),
    });
  });

  await page.route("**/api/profiles/thia/badges", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: {
          badges,
          featuredBadges: [],
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

async function mockAdminBadgePanel(page: Page) {
  await page.route("**/api/auth/me", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: {
          user: {
            id: 1,
            handle: "admin",
            email: "admin@example.test",
            role: "admin",
            status: "active",
            displayName: "Admin",
            avatarUrl: null,
          },
          profile: {
            displayName: "Admin",
            bio: "",
            location: "",
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
      body: JSON.stringify({
        ok: true,
        data: {
          notifications: [],
          unreadCount: 0,
        },
      }),
    });
  });

  await page.route("**/api/admin/reports", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, data: [] }),
    });
  });

  await page.route("**/api/admin/rooms", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, data: [] }),
    });
  });

  await page.route("**/api/admin/badges", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: {
          badges: [
            {
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
          ],
          recentGrants: [],
        },
      }),
    });
  });
}
