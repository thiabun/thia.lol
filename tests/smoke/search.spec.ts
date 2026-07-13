import { expect, test, type Page } from "@playwright/test";

test("/search renders an empty query state", async ({ page }) => {
  await mockShellRequests(page);
  await page.goto("/search");

  await expect(page.getByTestId("search-page")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Search", exact: true })).toBeVisible();
  await expect(page.getByLabel("Search thia.lol")).toBeVisible();
  await expect(page.getByText("Start with a name or room")).toHaveCount(0);
  await expect(page.getByText("Search uses public profile and room data only.")).toHaveCount(0);
});

test("/search shows the too-short query state", async ({ page }) => {
  await mockShellRequests(page);
  await page.goto("/search?q=t");

  await expect(page.getByText("Use at least 2 characters.")).toBeVisible();
  await expect(page.getByText("Keep typing")).toHaveCount(0);
});

test("/search shows successful profile and room results", async ({ page }) => {
  await mockShellRequests(page);
  await mockSearch(page, {
    ok: true,
    data: {
      query: "thi",
      minQueryLength: 2,
      results: {
        profiles: [
          {
            user: {
              id: 1,
              handle: "thia",
              displayName: "Thia",
              initials: "T",
              aura: "frost",
              avatarUrl: null,
            },
            bioSnippet: "Founder profile for thia.lol.",
          },
        ],
        rooms: [
          {
            id: 2,
            slug: "general",
            name: "General",
            summary: "Open conversation for public testing.",
            description: "Open conversation for public testing.",
            mood: "",
            members: 5,
            memberCount: 5,
            live: false,
            theme: "glinda",
            themeConfig: { mode: "preset", preset: "glinda" },
            iconUrl: null,
            bannerUrl: null,
            rules: "",
            visibility: "public",
            owner: null,
            joinedByMe: false,
            myRoomRole: null,
            postCount: 4,
            latestActivityAt: null,
            createdAt: "2026-06-10 00:00:00",
            updatedAt: "2026-06-10 00:00:00",
          },
        ],
      },
    },
  });

  await page.goto("/search?q=thi");

  await expect(page.getByText("2 results")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Profiles" })).toBeVisible();
  await expect(page.getByTestId("search-profile-result")).toHaveCount(1);
  await expect(page.getByRole("link", { name: /Thia @thia/ })).toHaveAttribute(
    "href",
    "/@thia",
  );
  await expect(page.getByRole("heading", { name: "Rooms" })).toBeVisible();
  await expect(page.getByTestId("search-room-result")).toHaveCount(1);
  await expect(page.getByRole("link", { name: /General \/general/ })).toHaveAttribute(
    "href",
    "/rooms/general",
  );
});

test("/search keeps typing local without reopening the full page loader", async ({
  page,
}) => {
  await mockShellRequests(page);
  await mockSearch(page, {
    ok: true,
    data: {
      query: "thi",
      minQueryLength: 2,
      results: {
        profiles: [],
        rooms: [],
      },
    },
  });

  await page.goto("/search");
  await expect(page.getByTestId("page-loading-overlay")).toHaveCount(0);

  await page.getByLabel("Search thia.lol").fill("thi");

  await expect(page).toHaveURL(/\/search\?q=thi$/);
  await expect(page.getByTestId("page-loading-overlay")).toHaveCount(0);
  await expect(page.getByText("No results found")).toBeVisible();
});

test("/search shows the no-results state", async ({ page }) => {
  await mockShellRequests(page);
  await mockSearch(page, {
    ok: true,
    data: {
      query: "zz",
      minQueryLength: 2,
      results: {
        profiles: [],
        rooms: [],
      },
    },
  });

  await page.goto("/search?q=zz");

  await expect(page.getByText("No results found")).toBeVisible();
  await expect(page.getByTestId("search-profile-result")).toHaveCount(0);
  await expect(page.getByTestId("search-room-result")).toHaveCount(0);
});

test("/search shows the API error state", async ({ page }) => {
  await mockShellRequests(page);
  await page.route("**/api/search?**", async (route) => {
    await route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ ok: false, error: "Could not load this right now." }),
    });
  });

  await page.goto("/search?q=thia");

  await expect(page.getByText("Search is not available")).toBeVisible();
  await expect(page.getByText("Try again in a moment.")).toBeVisible();
});

test("navigation exposes Search without overcrowding the mobile dock", async ({
  page,
}) => {
  await mockShellRequests(page);

  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/discover");
  await expect(
    page.getByTestId("desktop-nav").getByRole("link", { name: "Search" }),
  ).toHaveAttribute("href", "/search");

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/discover");

  const mobileNav = page.getByTestId("mobile-nav");
  await expect(mobileNav).toBeVisible();
  await expect(mobileNav.getByRole("link", { name: "Search" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Search" })).toBeVisible();

  for (const label of ["Home", "Discover", "Rooms", "Chat"]) {
    await expect(mobileNav.getByRole("link", { name: label })).toBeVisible();
  }
});

async function mockShellRequests(page: Page) {
  await page.route("**/api/auth/me", async (route) => {
    await route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({ ok: false, error: "Unauthenticated." }),
    });
  });
  await page.route("**/api/rooms", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, data: [] }),
    });
  });
  await page.route("**/api/feed/home", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: {
          posts: [],
          personalized: false,
        },
      }),
    });
  });
  await page.route("**/api/stats", async (route) => {
    await route.fulfill({
      status: 200,
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
    });
  });
}

async function mockSearch(page: Page, body: unknown) {
  await page.route("**/api/search?**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  });
}
