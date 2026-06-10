import { expect, test, type Page } from "@playwright/test";

test("Home loads the feed empty state", async ({ page }) => {
  await mockCommonApi(page);
  await page.route("**/api/feed/home", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ ok: true, data: { posts: [], personalized: false } }),
    }),
  );

  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Home" })).toBeVisible();
  await expect(page.getByText("No posts yet").first()).toBeVisible();
});

test("Discover loads the feed empty state without unbacked sections", async ({
  page,
}) => {
  await mockCommonApi(page);
  await page.route("**/api/feed/discover", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: { posts: [], activeRooms: [], peopleToWatch: [] },
      }),
    }),
  );

  await page.goto("/discover");

  await expect(page.getByRole("heading", { name: "Discover" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Rising" })).toBeVisible();
  await expect(page.getByText("No posts yet").first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Active rooms" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "People to watch" })).toHaveCount(0);
});

test("Discover renders primary sections only when backed by data", async ({
  page,
}) => {
  await mockCommonApi(page);
  await page.route("**/api/feed/discover", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: {
          posts: [],
          activeRooms: [
            {
              id: 1,
              slug: "general",
              name: "General",
              summary: "Open conversation.",
              mood: "sunveil",
              members: 0,
              live: false,
              accent: "var(--accent-warm)",
              visibility: "public",
              postCount: 2,
              latestActivityAt: "2026-06-10 10:00:00",
              createdAt: "2026-06-10 09:00:00",
              updatedAt: "2026-06-10 10:00:00",
            },
          ],
          peopleToWatch: [
            {
              handle: "alex",
              displayName: "Alex",
              initials: "A",
              avatarUrl: null,
              bioSnippet: "Writes public posts.",
              isFollowing: false,
              isMoot: false,
              postCount: 3,
              followerCount: 1,
            },
          ],
        },
      }),
    }),
  );

  await page.goto("/discover");

  await expect(page.getByRole("heading", { name: "Active rooms" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "People to watch" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "General" })).toBeVisible();
  await expect(page.getByText("@alex")).toBeVisible();
});

async function mockCommonApi(page: Page) {
  await page.route("**/api/auth/me", (route) =>
    route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({ ok: false, error: "Not authenticated." }),
    }),
  );

  await page.route("**/api/rooms", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ ok: true, data: [] }),
    }),
  );

  await page.route("**/api/stats", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: {
          publicRooms: 0,
          publicPosts: 0,
          activeUsers: 0,
          totalReactions: 0,
        },
      }),
    }),
  );
}
