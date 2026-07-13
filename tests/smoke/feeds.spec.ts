import { expect, test, type Locator, type Page } from "@playwright/test";
import { loginWithEnv, skipWithoutCredentials } from "../helpers/auth";

const portraitMediaFixture = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920"><rect width="1080" height="1920" fill="#f6e8b8"/><circle cx="540" cy="500" r="320" fill="#8fb7b1"/><rect x="360" y="980" width="360" height="640" rx="120" fill="#42526b"/></svg>',
)}`;

test("Anonymous home explains the product and renders real starter communities", async ({
  page,
}) => {
  await mockCommonApi(page);
  await page.route("**/api/rooms", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: [
          makeDiscoverRoom({
            id: 3,
            name: "Cozy Games",
            slug: "cozy-games",
            summary: "Minecraft builds, clips, and odd discoveries.",
            memberCount: 8,
            postCount: 5,
          }),
          makeDiscoverRoom({
            id: 9,
            name: "Garden",
            slug: "garden",
            summary: "An active public fallback room.",
            memberCount: 5,
          }),
          makeDiscoverRoom({
            id: 1,
            name: "Start Here",
            slug: "start-here",
            summary: "New around here? Say hello and meet people.",
            memberCount: 12,
            postCount: 3,
          }),
          makeDiscoverRoom({
            id: 2,
            name: "Show Your Work",
            slug: "show-your-work",
            summary: "Art, edits, music, writing, code, and unfinished things.",
            memberCount: 7,
            postCount: 4,
          }),
        ],
      }),
    }),
  );
  await page.route("**/api/feed/discover", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: {
          posts: [
            makePost({ id: 41, body: "First public note." }),
            makePost({ id: 42, body: "Second public note." }),
            makePost({ id: 43, body: "Third public note." }),
            makePost({ id: 44, body: "Fourth public note." }),
            makePost({ id: 45, body: "Fifth public note." }),
          ],
          activeRooms: [makeDiscoverRoom({ name: "Garden", slug: "garden" })],
          peopleToWatch: [
            makeDiscoverPerson({ handle: "alex", displayName: "Alex" }),
          ],
        },
      }),
    }),
  );

  await page.goto("/");

  const anonymousHome = page.getByTestId("anonymous-home");
  await expect(anonymousHome).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "A calmer social home for creative people and small internet circles.",
    }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "Make a profile that feels like you, gather in rooms, and post what you\u2019re making, playing, or thinking about. No ads, no engagement traps, and no AI sludge.",
    ),
  ).toBeVisible();
  await expect(
    anonymousHome.getByRole("link", { name: "Explore rooms" }).first(),
  ).toHaveAttribute("href", "/rooms");
  await expect(
    anonymousHome.getByRole("link", { name: "Create your profile" }).first(),
  ).toHaveAttribute("href", "/register");
  const header = page.getByRole("banner");
  await expect(header.getByRole("link", { name: "Discover" })).toHaveAttribute(
    "href",
    "/discover",
  );
  await expect(header.getByRole("link", { name: "Rooms" })).toHaveAttribute(
    "href",
    "/rooms",
  );
  await expect(
    header.getByRole("link", { name: "Sign in" }),
  ).toHaveAttribute("href", "/login");
  await expect(
    header.getByRole("link", { name: "Create account" }),
  ).toHaveAttribute("href", "/register");

  for (const section of ["Profiles", "Rooms", "Posts"]) {
    await expect(anonymousHome.getByText(section, { exact: true })).toBeVisible();
  }

  await expect(anonymousHome.getByRole("heading", { name: "Start somewhere" })).toBeVisible();
  const starterCommunities = anonymousHome.getByRole("region", {
    name: "Starter communities",
  });
  await expect(starterCommunities).toBeVisible();
  const roomCards = starterCommunities.getByTestId("room-card");
  await expect(roomCards).toHaveCount(3);
  await expect(roomCards.nth(0).getByRole("heading", { name: "Start Here" })).toBeVisible();
  await expect(roomCards.nth(1).getByRole("heading", { name: "Show Your Work" })).toBeVisible();
  await expect(roomCards.nth(2).getByRole("heading", { name: "Cozy Games" })).toBeVisible();
  await expect(roomCards.nth(0).getByText("12 members")).toBeVisible();
  await expect(roomCards.getByRole("heading", { name: "Garden" })).toHaveCount(0);

  await expect(
    anonymousHome.getByRole("heading", { name: "Fresh from the community" }),
  ).toBeVisible();
  await expect(
    anonymousHome.getByRole("region", { name: "Fresh from the community" }),
  ).toBeVisible();
  await expect(anonymousHome.getByText("First public note.")).toBeVisible();
  await expect(anonymousHome.getByText("Fourth public note.")).toBeVisible();
  await expect(anonymousHome.getByText("Fifth public note.")).toBeVisible();
  await expect(
    anonymousHome
      .getByRole("region", { name: "Fresh from the community" })
      .getByTestId("post-card-open-thread"),
  ).toHaveCount(4);
  await expect(anonymousHome.getByRole("link", { name: "Open Discover" })).toHaveAttribute(
    "href",
    "/discover",
  );

  await expect(
    anonymousHome.getByRole("heading", { name: "Bring your corner of the internet." }),
  ).toBeVisible();
  await expect(
    anonymousHome.getByText(
      "Make a profile, join a room, or invite a few people you already like.",
    ),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Search" })).toHaveCount(0);
  await expect(
    anonymousHome.getByRole("heading", { exact: true, name: "People" }),
  ).toHaveCount(0);
  await expect(anonymousHome.getByRole("region", { name: "People to find" })).toHaveCount(0);

  await page.goto("/discover");
  await expect(page.getByTestId("anonymous-home-header")).toHaveCount(0);
  await expect(page.getByRole("banner").getByRole("link", { name: "Search" })).toHaveAttribute(
    "href",
    "/search",
  );
});

test("Anonymous home replaces unavailable starter rooms with active public rooms", async ({
  page,
}) => {
  await mockCommonApi(page);
  await page.route("**/api/rooms", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: [
          makeDiscoverRoom({
            id: 1,
            name: "Start Here",
            slug: "start-here",
            memberCount: 1,
            postCount: 3,
          }),
          makeDiscoverRoom({
            id: 2,
            name: "Show Your Work",
            slug: "show-your-work",
            visibility: "private",
          }),
          makeDiscoverRoom({
            id: 8,
            name: "Active Artists",
            slug: "active-artists",
            latestActivityAt: "2026-07-13 11:00:00",
          }),
          makeDiscoverRoom({
            id: 9,
            name: "Tiny Web",
            slug: "tiny-web",
            latestActivityAt: "2026-07-13 10:00:00",
          }),
          makeDiscoverRoom({
            id: 10,
            name: "Garden",
            slug: "garden",
            latestActivityAt: "2026-07-13 09:00:00",
          }),
        ],
      }),
    }),
  );
  await page.route("**/api/feed/discover", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: { posts: [], activeRooms: [], peopleToWatch: [] },
      }),
    }),
  );

  await page.goto("/");

  const roomCards = page.getByTestId("anonymous-home").getByTestId("room-card");
  await expect(roomCards).toHaveCount(3);
  await expect(roomCards.nth(0).getByRole("heading", { name: "Active Artists" })).toBeVisible();
  await expect(roomCards.nth(1).getByRole("heading", { name: "Tiny Web" })).toBeVisible();
  await expect(roomCards.nth(2).getByRole("heading", { name: "Garden" })).toBeVisible();
  await expect(roomCards.getByRole("heading", { name: "Start Here" })).toHaveCount(0);
  await expect(roomCards.getByRole("heading", { name: "Show Your Work" })).toHaveCount(0);
  await expect(roomCards.getByRole("heading", { name: "Cozy Games" })).toHaveCount(0);
});

test("Anonymous home renders honest empty states for rooms and public posts", async ({
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
  await page.route("**/api/feed/home", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ ok: true, data: { posts: [], personalized: false } }),
    }),
  );

  await page.goto("/");

  await expect(page.getByRole("heading", { name: "No starter rooms yet" })).toBeVisible();
  await expect(
    page.getByText("Explore all rooms while new communities get ready."),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "No posts yet" })).toBeVisible();
  await expect(page.getByText("No public posts.")).toBeVisible();
});

test("Anonymous home keeps rooms and activity failures separate", async ({ page }) => {
  await mockCommonApi(page);
  for (const path of ["rooms", "feed/discover", "feed/home"]) {
    await page.route(`**/api/${path}`, (route) =>
      route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ ok: false, error: "Temporary failure." }),
      }),
    );
  }

  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: "Starter rooms are not available" }),
  ).toBeVisible();
  await expect(
    page.getByText("Explore all rooms or try again in a moment."),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Public activity is not available" }),
  ).toBeVisible();
  await expect(page.getByText("Try refreshing in a moment.")).toBeVisible();
});

test("Home waits for authentication before choosing an anonymous or signed-in branch", async ({
  page,
}) => {
  await mockCommonApi(page);
  let releaseAuth: (() => void) | undefined;
  await page.route("**/api/auth/me", async (route) => {
    await new Promise<void>((resolve) => {
      releaseAuth = resolve;
    });
    await route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({ ok: false, error: "Not authenticated." }),
    });
  });

  await page.goto("/");

  await expect.poll(() => Boolean(releaseAuth)).toBe(true);
  await expect(page.getByTestId("anonymous-home")).toHaveCount(0);
  await expect(page.getByRole("heading", { exact: true, name: "Home" })).toHaveCount(0);

  releaseAuth?.();

  await expect(page.getByTestId("anonymous-home")).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "A calmer social home for creative people and small internet circles.",
    }),
  ).toBeVisible();
});

test("Authenticated home loads the feed empty state", async ({ page }) => {
  await mockAuthenticatedApi(page);
  await page.route("**/api/feed/home", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ ok: true, data: { posts: [], personalized: false } }),
    }),
  );

  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Home" })).toBeVisible();
  await expect(page.getByText("No posts yet").first()).toBeVisible();
  await expect(page.getByTestId("anonymous-home")).toHaveCount(0);
  await expect(
    page.getByRole("heading", {
      name: "A calmer social home for creative people and small internet circles.",
    }),
  ).toHaveCount(0);
});

test("Anonymous home stays contained across supported phone widths", async ({ page }) => {
  await mockCommonApi(page);
  await page.route("**/api/rooms", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: [
          makeDiscoverRoom({ id: 1, name: "Start Here", slug: "start-here" }),
          makeDiscoverRoom({ id: 2, name: "Show Your Work", slug: "show-your-work" }),
          makeDiscoverRoom({ id: 3, name: "Cozy Games", slug: "cozy-games" }),
        ],
      }),
    }),
  );
  await page.route("**/api/feed/discover", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: {
          posts: [makePost({ body: `Long public note ${"unbroken".repeat(45)}` })],
          activeRooms: [],
          peopleToWatch: [],
        },
      }),
    }),
  );

  await page.goto("/");
  await expect(page.getByTestId("anonymous-home")).toBeVisible();

  for (const width of [320, 360, 390, 430]) {
    await page.setViewportSize({ width, height: 844 });

    if (width === 320) {
      await page.getByRole("button", { name: "Open navigation menu" }).click();
      const menu = page.getByTestId("anonymous-home-menu");
      await expect(menu.getByRole("menuitem", { name: "Discover" })).toHaveAttribute(
        "href",
        "/discover",
      );
      await expect(menu.getByRole("menuitem", { name: "Rooms" })).toHaveAttribute(
        "href",
        "/rooms",
      );
      await expect(menu.getByRole("menuitem", { name: "Sign in" })).toHaveAttribute(
        "href",
        "/login",
      );
      await page.keyboard.press("Escape");
      await expect(menu).toHaveCount(0);
    }

    await expectViewportContained(page, [
      '[data-testid="anonymous-home"]',
      '[data-testid="anonymous-home"] h1',
      '[data-testid="anonymous-home"] a',
      "header a",
    ]);

    for (const linkName of ["Explore rooms", "Create your profile"]) {
      const box = await page
        .getByTestId("anonymous-home")
        .getByRole("link", { name: linkName })
        .first()
        .boundingBox();
      expect(box).not.toBeNull();
      expect(box!.height).toBeGreaterThanOrEqual(40);
    }
  }
});

test.describe("mobile Home media containment", () => {
  test.use({ hasTouch: true, isMobile: true });

  test("landscape and portrait videos stay inside every supported phone viewport", async ({
    page,
  }) => {
    await mockAuthenticatedApi(page);
    await page.route("**/mobile-layout-*.mp4", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 120));
      await route.fulfill({ status: 204, body: "" });
    });
    await page.route("**/api/feed/home", (route) =>
      route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          data: {
            personalized: false,
            posts: [
              makePost({
                id: 201,
                body: "Wide landscape clip",
                attachments: [
                  {
                    id: 1,
                    position: 1,
                    kind: "video",
                    url: "/mobile-layout-wide.mp4",
                    mime: "video/mp4",
                    width: 960,
                    height: 720,
                    posterUrl: portraitMediaFixture,
                  },
                ],
              }),
              makePost({
                id: 202,
                body: `Long content ${"unbroken".repeat(90)}`,
                attachments: [
                  {
                    id: 2,
                    position: 1,
                    kind: "video",
                    url: "/mobile-layout-tall.mp4",
                    mime: "video/mp4",
                    width: 556,
                    height: 720,
                    posterUrl: portraitMediaFixture,
                  },
                ],
              }),
              makePost({
                id: 203,
                body: "Legacy landscape clip without dimensions",
                attachments: [
                  {
                    id: 3,
                    position: 1,
                    kind: "video",
                    url: "/mobile-layout-legacy.mp4",
                    mime: "video/mp4",
                    width: null,
                    height: null,
                    posterUrl: portraitMediaFixture,
                  },
                ],
              }),
            ],
          },
        }),
      }),
    );

    await page.goto("/");
    await expect(page.getByText("Wide landscape clip")).toBeVisible();

    for (const viewport of [
      { width: 320, height: 568 },
      { width: 360, height: 780 },
      { width: 390, height: 844 },
      { width: 430, height: 932 },
      { width: 844, height: 390 },
    ]) {
      await page.setViewportSize(viewport);
      const videos = page.locator('[data-testid^="post-attachments-"][data-testid$="-video"]');

      await expect(videos).toHaveCount(3);
      for (let index = 0; index < 3; index += 1) {
        const video = videos.nth(index);
        await video.scrollIntoViewIfNeeded();
        const before = await video.boundingBox();
        await page.waitForTimeout(150);
        const after = await video.boundingBox();

        expect(before).not.toBeNull();
        expect(after).not.toBeNull();
        expect(Math.abs((after?.width ?? 0) - (before?.width ?? 0))).toBeLessThanOrEqual(1);
      }

      await expectViewportContained(page, [
        '[data-testid="post-card-open-thread"]',
        '[data-testid^="post-attachments-"][data-testid$="-video"]',
      ]);
    }
  });
});

test("Home refresh keeps the current feed visible until new posts arrive", async ({
  page,
}) => {
  await mockAuthenticatedApi(page);
  let refreshRequested = false;
  let releaseRefresh: (() => void) | undefined;

  await page.route("**/api/feed/home", async (route) => {
    if (refreshRequested) {
      await new Promise<void>((resolve) => {
        releaseRefresh = resolve;
      });
    }

    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: {
          posts: [
            makePost({
              body: refreshRequested ? "Fresh refreshed post." : "First visible post.",
            }),
          ],
          personalized: false,
        },
      }),
    });
  });

  await page.goto("/");

  await expect(page.getByText("First visible post.")).toBeVisible();
  await expect(page.getByTestId("page-loading-overlay")).toBeHidden({
    timeout: 5000,
  });
  await expectCircularControl(page.getByRole("button", { name: "Refresh" }));
  await expectCompactActionControl(
    page.getByRole("button", { name: /Open replies/ }).first(),
  );
  refreshRequested = true;
  await page.getByRole("button", { name: "Refresh" }).click();
  await expect(page.getByText("First visible post.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Refreshing" })).toBeVisible();

  releaseRefresh?.();

  await expect(page.getByText("Fresh refreshed post.")).toBeVisible();
  await expect(page.getByTestId("feed-refresh-controls-updated")).toContainText(
    "Updated",
  );
  await expectVisuallyClipped(page.getByTestId("feed-refresh-controls-updated"));
});

test("Home refresh failure preserves posts and offers retry", async ({ page }) => {
  await mockAuthenticatedApi(page);
  let refreshRequested = false;

  await page.route("**/api/feed/home", async (route) => {
    if (refreshRequested) {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ ok: false, error: "Refresh failed." }),
      });
      return;
    }

    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: {
          posts: [makePost({ body: "Keep this post visible." })],
          personalized: false,
        },
      }),
    });
  });

  await page.goto("/");

  await expect(page.getByText("Keep this post visible.")).toBeVisible();
  await expect(page.getByTestId("page-loading-overlay")).toBeHidden({
    timeout: 5000,
  });
  refreshRequested = true;
  await page.getByRole("button", { name: "Refresh" }).click();

  await expect(page.getByText("Keep this post visible.")).toBeVisible();
  await expect(page.getByTestId("feed-refresh-controls-error")).toContainText(
    "Could not refresh.",
  );
  await expect(page.getByRole("button", { name: "Retry" })).toBeVisible();
});

test("Home keeps post context identity-first and renders real discovery paths", async ({
  page,
}) => {
  await mockAuthenticatedApi(page);
  await page.route("**/api/feed/home", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: {
          posts: [
            makePost({
              room: makeDiscoverRoom({
                name: "Garden",
                slug: "garden",
              }),
              socialContext: {
                authorRelationship: "following",
                likedByFollowedCount: 2,
              },
            }),
          ],
          personalized: false,
        },
      }),
    }),
  );

  await page.goto("/");

  await expect(page.getByText("Following", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Liked by follows", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Garden" })).toHaveAttribute(
    "href",
    "/rooms/garden",
  );
  const main = page.locator("main");
  await expect(main.getByRole("link", { name: "Search" })).toHaveAttribute(
    "href",
    "/search",
  );
  await expect(main.getByRole("link", { name: "Browse rooms" })).toHaveAttribute(
    "href",
    "/rooms",
  );
  await expect(main.getByRole("link", { name: "Discover" })).toHaveAttribute(
    "href",
    "/discover",
  );
});

test("Discover loads the feed empty state without unbacked sections", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1600, height: 900 });
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

  await expect(
    page.getByRole("heading", { exact: true, name: "Discover" }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Rising" })).toBeVisible();
  await expect(page.getByText("No posts yet").first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Active rooms" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "People" })).toHaveCount(0);
  const main = page.locator("main");
  await expect(main.getByRole("link", { name: "Search" })).toHaveAttribute(
    "href",
    "/search",
  );
  await expect(main.getByRole("link", { name: "Browse rooms" })).toHaveAttribute(
    "href",
    "/rooms",
  );
  await expect
    .poll(async () =>
      page
        .getByTestId("discover-layout")
        .evaluate((node) =>
          window
            .getComputedStyle(node)
            .gridTemplateColumns.split(" ")
            .filter(Boolean).length,
        ),
    )
    .toBe(1);
});

test("Discover refresh updates the rising feed without losing existing posts", async ({
  page,
}) => {
  await mockCommonApi(page);
  let refreshRequested = false;
  let releaseRefresh: (() => void) | undefined;

  await page.route("**/api/feed/discover", async (route) => {
    if (refreshRequested) {
      await new Promise<void>((resolve) => {
        releaseRefresh = resolve;
      });
    }

    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: {
          posts: [
            makePost({
              body:
                refreshRequested
                  ? "Updated rising post."
                  : "Original rising post.",
            }),
          ],
          activeRooms: [],
          peopleToWatch: [],
        },
      }),
    });
  });

  await page.goto("/discover");

  await expect(page.getByText("Original rising post.")).toBeVisible();
  await expect(page.getByTestId("page-loading-overlay")).toBeHidden({
    timeout: 5000,
  });
  refreshRequested = true;
  await page.getByRole("button", { name: "Refresh" }).click();
  await expect(page.getByText("Original rising post.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Refreshing" })).toBeVisible();

  releaseRefresh?.();

  await expect(page.getByText("Updated rising post.")).toBeVisible();
  await expect(page.getByTestId("feed-refresh-controls-updated")).toContainText(
    "Updated",
  );
  await expectVisuallyClipped(page.getByTestId("feed-refresh-controls-updated"));
});

test("global loading overlay skips non-protected grace after route data", async ({
  page,
}) => {
  await mockCommonApi(page);
  let discoverReleased = false;
  const pendingDiscoverResolvers: Array<() => void> = [];
  await page.route("**/api/feed/discover", async (route) => {
    if (!discoverReleased) {
      await new Promise<void>((resolve) => {
        pendingDiscoverResolvers.push(resolve);
      });
    }

    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: { posts: [], activeRooms: [], peopleToWatch: [] },
      }),
    });
  });

  await page.goto("/discover");

  await expect(page.getByTestId("page-loading-overlay")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Loading activity" })).toBeVisible();

  discoverReleased = true;
  pendingDiscoverResolvers.splice(0).forEach((resolve) => resolve());
  await expect(page.getByRole("heading", { name: "Rising" })).toBeVisible();
  await expect(page.getByTestId("page-loading-overlay")).toHaveCount(0);
});

test("site theme changes mark the root transition state", async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("thia.lol.theme", "light");
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => undefined,
        removeListener: () => undefined,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        dispatchEvent: () => false,
      }),
    });
  });
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
  await expect(page.getByTestId("page-loading-overlay")).toHaveCount(0);

  const transitionSeen = page.evaluate(
    () =>
      new Promise<boolean>((resolve) => {
        const root = document.documentElement;

        if (root.dataset.themeTransition === "true") {
          resolve(true);
          return;
        }

        const observer = new MutationObserver(() => {
          if (root.dataset.themeTransition === "true") {
            observer.disconnect();
            resolve(true);
          }
        });

        observer.observe(root, {
          attributes: true,
          attributeFilter: ["data-theme-transition"],
        });

        window.setTimeout(() => {
          observer.disconnect();
          resolve(false);
        }, 1000);
      }),
  );

  await page.getByRole("button", { name: "Switch to Dark mode" }).click();

  expect(await transitionSeen).toBe(true);
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.dataset.themeTransition ?? "",
      ),
    )
    .toBe("");
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
              mood: "glinda",
              members: 0,
              live: false,
              theme: "glinda",
              themeConfig: { mode: "preset", preset: "glinda" },
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
              starCount: 2,
            },
          ],
        },
      }),
    }),
  );

  await page.goto("/discover");

  await expect(page.getByRole("heading", { name: "Active rooms" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "People" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "General" })).toBeVisible();
  await expect(page.getByText("@alex")).toBeVisible();
  await expect(page.getByText("2 stars")).toBeVisible();
});

test("Discover keeps context sections stacked on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 760 });
  await mockCommonApi(page);
  await page.route("**/api/feed/discover", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: {
          posts: [makePost()],
          activeRooms: [makeDiscoverRoom()],
          peopleToWatch: [makeDiscoverPerson()],
        },
      }),
    }),
  );

  await page.goto("/discover");

  const risingBox = await page.getByTestId("discover-rising-feed").boundingBox();
  const roomsBox = await page.getByTestId("discover-rooms-rail").boundingBox();
  const peopleBox = await page.getByTestId("discover-people-rail").boundingBox();

  expect(risingBox).not.toBeNull();
  expect(roomsBox).not.toBeNull();
  expect(peopleBox).not.toBeNull();
  expect(risingBox!.y).toBeLessThan(roomsBox!.y);
  expect(roomsBox!.y).toBeLessThan(peopleBox!.y);

  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  );
  expect(hasHorizontalOverflow).toBe(false);
});

test("Discover uses desktop side rails around the rising feed", async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  await mockCommonApi(page);
  await page.route("**/api/feed/discover", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: {
          posts: [makePost()],
          activeRooms: Array.from({ length: 6 }, (_, index) =>
            makeDiscoverRoom({
              id: index + 1,
              slug: `room-${index + 1}`,
              name: `Room ${index + 1}`,
            }),
          ),
          peopleToWatch: [
            makeDiscoverPerson({
              handle: "smoketest1",
              displayName: "Smoke Test 1",
            }),
            ...Array.from({ length: 6 }, (_, index) =>
              makeDiscoverPerson({
                handle: `person${index + 1}`,
                displayName: `Person ${index + 1}`,
              }),
            ),
          ],
        },
      }),
    }),
  );

  await page.goto("/discover");

  const roomsRail = page.getByTestId("discover-rooms-rail");
  const risingFeed = page.getByTestId("discover-rising-feed");
  const peopleRail = page.getByTestId("discover-people-rail");
  const roomsBox = await roomsRail.boundingBox();
  const risingBox = await risingFeed.boundingBox();
  const peopleBox = await peopleRail.boundingBox();

  expect(roomsBox).not.toBeNull();
  expect(risingBox).not.toBeNull();
  expect(peopleBox).not.toBeNull();
  expect(roomsBox!.x).toBeLessThan(risingBox!.x);
  expect(risingBox!.x).toBeLessThan(peopleBox!.x);
  expect(risingBox!.width).toBeLessThanOrEqual(620);
  await expect(roomsRail.getByTestId("room-card")).toHaveCount(5);
  await expect(peopleRail.locator("article")).toHaveCount(5);
  await expect(peopleRail.getByText("@smoketest1")).toHaveCount(0);
  await expect(peopleRail.getByText("@person5")).toBeVisible();

  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  );
  expect(hasHorizontalOverflow).toBe(false);
});

test("PostCard reblog action updates count and state", async ({ page }) => {
  await mockAuthenticatedApi(page);
  let reblogged = false;
  let reblogCount = 2;

  await page.route("**/api/feed/home", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: {
          posts: [makePost({ reblogCount, rebloggedByMe: reblogged })],
          personalized: true,
        },
      }),
    }),
  );
  await page.route("**/api/posts/42/reblog", async (route) => {
    if (route.request().method() === "POST") {
      reblogged = true;
      reblogCount = 3;
    } else if (route.request().method() === "DELETE") {
      reblogged = false;
      reblogCount = 2;
    }

    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: {
          postId: 42,
          reblogCount,
          rebloggedByMe: reblogged,
          rebloggedByCurrentUser: reblogged,
        },
      }),
    });
  });

  await page.goto("/");

  await expect(page.getByRole("button", { name: /Reblog this post/ })).toBeEnabled();
  await page.getByRole("button", { name: /Reblog this post/ }).click();
  await expect(page.getByRole("button", { name: /Undo reblog/ })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByRole("button", { name: /Undo reblog/ })).toContainText("3");

  await page.getByRole("button", { name: /Undo reblog/ }).click();
  await expect(page.getByRole("button", { name: /Reblog this post/ })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  await expect(page.getByRole("button", { name: /Reblog this post/ })).toContainText(
    "2",
  );
});

test("PostCard share modal copies, saves, and sends typed post attachments", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (text: string) => {
          (window as unknown as { __copiedText?: string }).__copiedText = text;
        },
      },
    });
  });

  await mockAuthenticatedApi(page);
  const publicId = "pabc123def456";
  const post = makePost({
    publicId,
    canonicalPath: `/@alex/posts/${publicId}`,
    canonicalUrl: `https://thia.lol/@alex/posts/${publicId}`,
  });
  post.author.id = 1;
  post.profile.user.id = 1;
  const moot = {
    id: 7,
    handle: "mootpal",
    displayName: "Moot Pal",
    initials: "MP",
    aura: "frost",
    avatarUrl: null,
  };
  let sharePayload: Record<string, unknown> | undefined;
  let cardCacheUploads = 0;

  await page.route("**/api/feed/home", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: { posts: [post], personalized: true },
      }),
    }),
  );
  await page.route("**/api/chat/moots", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ ok: true, data: [moot] }),
    }),
  );
  await page.route(`**/api/posts/${publicId}/shares/messages`, async (route) => {
    sharePayload = route.request().postDataJSON() as Record<string, unknown>;
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: {
          post: {
            id: 42,
            publicId,
            canonicalPath: `/@alex/posts/${publicId}`,
            canonicalUrl: `https://thia.lol/@alex/posts/${publicId}`,
            bodySnippet: "A public post.",
            createdAt: "2026-06-10 10:00:00",
            mediaUrl: null,
            author: post.author,
            room: null,
          },
          results: [
            {
              recipientUserId: 7,
              recipient: moot,
              status: "sent",
              conversationId: 31,
              messageId: 501,
            },
          ],
          sentCount: 1,
          failedCount: 0,
        },
      }),
    });
  });
  await page.route(`**/share-render/post/${publicId}`, (route) =>
    route.fulfill({
      contentType: "text/html",
      body: `<!doctype html>
        <html>
          <body style="margin:0">
            <main
              data-share-card-canvas="true"
              data-share-card-ready="true"
              style="box-sizing:border-box;width:1200px;height:630px;padding:80px;background:#071820;color:#ecfbfb;font-family:Arial,sans-serif"
            >
              <div style="border:2px solid rgba(97,226,212,.5);border-radius:34px;height:100%;padding:48px">
                <h1 style="font-size:64px;margin:0">Alex</h1>
                <p style="font-size:42px">A public post.</p>
              </div>
            </main>
          </body>
        </html>`,
    }),
  );
  await page.route(`**/api/posts/${publicId}/share-card-cache`, async (route) => {
    cardCacheUploads += 1;
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: {
          url: `/uploads/share-cards/posts/${publicId}.png`,
          width: 2400,
          height: 1260,
        },
      }),
    });
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Share post" }).first().click();

  await expect(page).toHaveURL(/\/$/);
  const modal = page.getByTestId("post-share-modal");
  await expect(modal).toBeVisible();

  await modal.getByTestId("post-share-copy-link").click();
  await expect(modal.getByTestId("post-share-copy-link")).toContainText("Copied");
  await expect
    .poll(() =>
      page.evaluate(() => (window as unknown as { __copiedText?: string }).__copiedText),
    )
    .toBe(
      `https://thia.lol/@alex/posts/${publicId}?utm_source=thia.lol&utm_medium=share&utm_campaign=post-share&thia_share=post%3A${publicId}`,
    );

  const downloadPromise = page.waitForEvent("download");
  await modal.getByTestId("post-share-save-image").click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe(`thia-post-${publicId}.png`);
  await expect.poll(() => cardCacheUploads).toBeGreaterThan(0);

  await expect(modal.getByTestId("post-share-moot-list")).toContainText("Moot Pal");
  await modal.getByTestId("post-share-moot-7").click();
  await modal.getByTestId("post-share-note").fill("thought you would like this");
  await modal.getByTestId("post-share-send-moots").click();

  await expect(modal.getByText("Sent to 1 moot.")).toBeVisible();
  await expect(modal.getByRole("link", { name: "Open chat" })).toHaveAttribute(
    "href",
    "/chat?conversation=31",
  );
  expect(sharePayload).toMatchObject({
    recipientUserIds: [7],
    note: "thought you would like this",
  });
});

test("post permalink route loads canonical post and replies", async ({ page }) => {
  await mockCommonApi(page);
  const publicId = "pabc123def456";
  await page.route(`**/api/posts/${publicId}`, (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: makePost({
          publicId,
          canonicalPath: `/@alex/posts/${publicId}`,
          canonicalUrl: `https://thia.lol/@alex/posts/${publicId}`,
          commentCount: 1,
        }),
      }),
    }),
  );
  await page.route("**/api/posts/42/replies", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: [
          makePost({
            id: 73,
            parentId: 42,
            body: "A permalink reply.",
            canonicalPath: "/@alex/posts/73",
            canonicalUrl: "https://thia.lol/@alex/posts/73",
          }),
        ],
      }),
    }),
  );
  await page.goto(`/@stale/posts/${publicId}`);

  await expect(page).toHaveURL(new RegExp(`/@alex/posts/${publicId}$`));
  await expect(page.getByTestId("post-page")).toBeVisible();
  await expect(page.getByText("A public post.")).toBeVisible();
  await expect(page.getByText("A permalink reply.")).toBeVisible();
});

test("nested permalink preserves the full ancestor path in one conversation", async ({
  page,
}) => {
  await mockCommonApi(page);
  const nestedPublicId = "pnested123456";
  const root = makePost({ commentCount: 1 });
  const parent = makePost({
    id: 50,
    parentId: 42,
    body: "Parent reply context.",
    commentCount: 1,
  });
  const nested = makePost({
    id: 60,
    publicId: nestedPublicId,
    parentId: 50,
    body: "Deep reply in focus.",
    canonicalPath: `/@mira/posts/${nestedPublicId}`,
    canonicalUrl: `https://thia.lol/@mira/posts/${nestedPublicId}`,
    author: {
      id: 3,
      handle: "mira",
      displayName: "Mira",
      initials: "M",
      aura: "frost",
      avatarUrl: null,
    },
  });

  for (const [identifier, post] of [
    [nestedPublicId, nested],
    ["50", parent],
    ["42", root],
  ] as const) {
    await page.route(`**/api/posts/${identifier}`, (route) =>
      route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ ok: true, data: post }),
      }),
    );
  }
  await page.route("**/api/posts/42/replies", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ ok: true, data: [parent] }),
    }),
  );
  await page.route("**/api/posts/50/replies", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ ok: true, data: [nested] }),
    }),
  );
  await page.route("**/api/posts/60/replies", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ ok: true, data: [] }),
    }),
  );

  await page.goto(`/@stale/posts/${nestedPublicId}`);

  await expect(page).toHaveURL(new RegExp(`/@mira/posts/${nestedPublicId}$`));
  const thread = page.getByTestId("thread-view");
  const rootCard = thread.locator('[data-variant="focus"]');
  const parentCard = thread.locator('[data-variant="reply"]').filter({
    hasText: "Parent reply context.",
  });
  const nestedCard = thread.locator('[data-variant="reply"]').filter({
    hasText: "Deep reply in focus.",
  });

  await expect(rootCard.getByText("A public post.")).toBeVisible();
  await expect(parentCard).toHaveAttribute("data-depth", "1");
  await expect(nestedCard).toHaveAttribute("data-depth", "2");
  await expect(nestedCard).toHaveAttribute("id", "post-60");

  const [rootBox, parentBox, nestedBox] = await Promise.all([
    rootCard.boundingBox(),
    parentCard.boundingBox(),
    nestedCard.boundingBox(),
  ]);
  expect(rootBox).not.toBeNull();
  expect(parentBox).not.toBeNull();
  expect(nestedBox).not.toBeNull();
  expect(rootBox!.y).toBeLessThan(parentBox!.y);
  expect(parentBox!.y).toBeLessThan(nestedBox!.y);
});

test("post permalink route shows unavailable state", async ({ page }) => {
  await mockCommonApi(page);
  await page.route("**/api/posts/pnotfound1234", (route) =>
    route.fulfill({
      status: 404,
      contentType: "application/json",
      body: JSON.stringify({ ok: false, error: "Post not found." }),
    }),
  );

  await page.goto("/@alex/posts/pnotfound1234");

  await expect(page.getByRole("heading", { name: "Post not available" })).toBeVisible();
  await expect(page.getByText("Post not found.")).toBeVisible();
});

test("PostCard author avatar, name, and handle navigate to profile", async ({
  page,
}) => {
  await mockAuthenticatedApi(page);
  await mockProfileRoutes(page, "alex");
  await page.route("**/api/feed/home", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: { posts: [makePost()], personalized: true },
      }),
    }),
  );

  await page.goto("/");

  const post = page.locator("article").first();
  await expect(post.getByRole("link", { name: "Alex's profile" })).toHaveAttribute(
    "href",
    "/@alex",
  );
  await expect(post.getByRole("link", { name: "Alex", exact: true })).toHaveAttribute(
    "href",
    "/@alex",
  );
  await expect(post.getByRole("link", { name: "@alex" })).toHaveAttribute(
    "href",
    "/@alex",
  );

  await post.getByRole("link", { name: "Alex", exact: true }).click();
  await expect(page).toHaveURL(/\/@alex$/);
  await expect(page.getByRole("heading", { name: "Alex" })).toBeVisible();
});

test("roomless posts link their destination to the author profile", async ({ page }) => {
  await mockAuthenticatedApi(page);
  await mockProfileRoutes(page, "alex");
  await page.route("**/api/feed/home", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: { posts: [makePost({ room: null })], personalized: true },
      }),
    }),
  );

  await page.goto("/");

  const post = page.getByTestId("post-card-open-thread").first();
  const destination = post.getByRole("link", { name: "Profile feed" });
  await expect(destination).toHaveAttribute("href", "/@alex");
  await expect(page.locator('a[href="/rooms/profile"]')).toHaveCount(0);

  await destination.click();
  await expect(page).toHaveURL(/\/@alex$/);
});

test("feed and thread keep provider embeds while generic links stay inline", async ({
  page,
}) => {
  await mockAuthenticatedApi(page);
  await page.route(/^https:\/\/www\.youtube-nocookie\.com\/embed\//, (route) =>
    route.fulfill({
      contentType: "text/html",
      body: "<!doctype html><html><body>YouTube embed stub</body></html>",
    }),
  );

  const thia = {
    id: 3,
    handle: "thia",
    displayName: "Thia",
    initials: "T",
    aura: "frost",
    avatarUrl: null,
  };
  const bio = "Bio says hi to @alex";
  await mockProfileRoutes(page, "thia", {
    user: thia,
    bio,
    bioEntities: [richMentionEntity(bio, "@alex")],
  });

  const body =
    "Hi @thia check https://example.com/notes and https://www.youtube.com/watch?v=abc123";
  const replyBody = "Reply to @thia with https://example.com/reply";

  await page.route("**/api/feed/home", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: {
          posts: [
            makePost({
              body,
              bodyEntities: [
                richMentionEntity(body, "@thia", thia),
                richLinkEntity(body, "https://example.com/notes", richWebsiteCard("https://example.com/notes", "Example notes")),
                richLinkEntity(body, "https://www.youtube.com/watch?v=abc123", richYouTubeCard("https://www.youtube.com/watch?v=abc123")),
              ],
            }),
          ],
          personalized: true,
        },
      }),
    }),
  );
  await page.route("**/api/posts/42/replies", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: [
          makePost({
            id: 50,
            parentId: 42,
            body: replyBody,
            bodyEntities: [
              richMentionEntity(replyBody, "@thia", thia),
              richLinkEntity(replyBody, "https://example.com/reply", richWebsiteCard("https://example.com/reply", "Reply card")),
            ],
          }),
        ],
      }),
    }),
  );
  await page.route("**/api/posts/42", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: makePost({
          body,
          bodyEntities: [
            richMentionEntity(body, "@thia", thia),
            richLinkEntity(body, "https://example.com/notes", richWebsiteCard("https://example.com/notes", "Example notes")),
            richLinkEntity(body, "https://www.youtube.com/watch?v=abc123", richYouTubeCard("https://www.youtube.com/watch?v=abc123")),
          ],
          commentCount: 1,
        }),
      }),
    }),
  );

  await page.goto("/");

  const postCard = page.getByTestId("post-card-open-thread").first();
  await expect(postCard.getByTestId("rich-mention-link")).toHaveAttribute(
    "href",
    "/@thia",
  );
  await expect(postCard.getByTestId("rich-inline-link").first()).toHaveAttribute(
    "href",
    "https://example.com/notes",
  );
  await expect(postCard.getByTestId("rich-inline-link")).toHaveCount(2);
  await expect(postCard.getByTestId("rich-inline-link").nth(1)).toHaveAttribute(
    "href",
    "https://www.youtube.com/watch?v=abc123",
  );
  await expect(postCard.getByTestId("rich-link-preview")).toHaveCount(1);
  await expect(postCard.getByTestId("rich-link-embed-youtube")).toBeVisible();
  await expect(postCard.getByText("Example notes")).toHaveCount(0);

  await postCard.getByTestId("rich-mention-link").click();
  await expect(page).toHaveURL(/\/@thia$/);
  await expect(page.getByTestId("profile-bio").getByTestId("rich-mention-link")).toHaveAttribute(
    "href",
    "/@alex",
  );

  await page.goto("/");
  await postCard.getByRole("link", { name: "Open thread by Alex", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/@alex\/posts\/42$/);
  const thread = page.getByTestId("thread-view");
  await expect(thread).toBeVisible();
  const root = thread.locator('[data-variant="focus"]');
  const reply = thread.locator('[data-variant="reply"]').first();

  await expect(root.getByTestId("rich-mention-link")).toHaveAttribute(
    "href",
    "/@thia",
  );
  await expect(reply.getByTestId("rich-mention-link")).toHaveAttribute(
    "href",
    "/@thia",
  );
  await expect(
    reply.getByTestId("rich-inline-link"),
  ).toHaveAttribute("href", "https://example.com/reply");
  await expect(
    root.getByTestId("rich-link-embed-youtube"),
  ).toBeVisible();
  await expect(
    reply.getByTestId("rich-link-preview"),
  ).toHaveCount(0);
});

test("fallback embeds persist for YouTube, Spotify, Apple Music, and Twitch", async ({
  page,
}) => {
  await mockAuthenticatedApi(page);
  await page.route(
    /^https:\/\/(?:www\.youtube-nocookie\.com|open\.spotify\.com|embed\.music\.apple\.com|player\.twitch\.tv)\//,
    (route) => route.fulfill({
      contentType: "text/html",
      body: "<!doctype html><html><body>Provider embed stub</body></html>",
    }),
  );

  const body = [
    "Watch https://youtu.be/abc123",
    "listen https://open.spotify.com/track/spotify123",
    "play https://music.apple.com/us/album/example/123456789?i=987654321",
    "and read https://example.com/story",
  ].join(" ");
  const replyBody = "Live at https://www.twitch.tv/thiabun";

  await page.route("**/api/feed/home", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: {
          posts: [makePost({ body })],
          personalized: true,
        },
      }),
    }),
  );
  await page.route("**/api/posts/42/replies", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: [
          makePost({
            id: 50,
            parentId: 42,
            body: replyBody,
            bodyEntities: [
              richLinkEntityWithoutCard(
                replyBody,
                "https://www.twitch.tv/thiabun",
              ),
            ],
          }),
        ],
      }),
    }),
  );
  await page.route("**/api/posts/42", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ ok: true, data: makePost({ body, commentCount: 1 }) }),
    }),
  );

  await page.goto("/");

  const postCard = page.getByTestId("post-card-open-thread").first();
  await expect(postCard.getByTestId("rich-inline-link").first()).toHaveAttribute(
    "href",
    "https://youtu.be/abc123",
  );
  await expect(postCard.getByTestId("rich-inline-link")).toHaveCount(4);
  await expect(postCard.getByTestId("rich-inline-link").nth(3)).toHaveAttribute(
    "href",
    "https://example.com/story",
  );
  await expect(postCard.getByTestId("rich-link-preview")).toHaveCount(3);
  await expect(postCard.locator('a[data-testid="rich-link-preview"]')).toHaveCount(0);
  await expect(postCard.getByTestId("rich-link-embed-youtube")).toHaveAttribute(
    "src",
    "https://www.youtube-nocookie.com/embed/abc123",
  );
  await expect(postCard.getByTestId("rich-link-embed-spotify")).toHaveAttribute(
    "src",
    "https://open.spotify.com/embed/track/spotify123?theme=0",
  );
  await expect(postCard.getByTestId("rich-link-embed-apple_music")).toHaveAttribute(
    "src",
    "https://embed.music.apple.com/us/album/example/123456789?i=987654321",
  );

  await postCard.getByRole("link", { name: "Open thread by Alex", exact: true }).focus();
  await page.keyboard.press("Enter");
  const thread = page.getByTestId("thread-view");
  await expect(thread).toBeVisible();
  const root = thread.locator('[data-variant="focus"]');
  const reply = thread.locator('[data-variant="reply"]').first();
  await expect(
    root.getByTestId("rich-inline-link"),
  ).toHaveCount(4);
  await expect(
    reply.getByTestId("rich-inline-link"),
  ).toHaveAttribute("href", "https://www.twitch.tv/thiabun");
  await expect(
    reply.getByTestId("rich-link-embed-twitch"),
  ).toHaveAttribute("src", /https:\/\/player\.twitch\.tv\/.*channel=thiabun.*parent=/);
  await expect(thread.getByTestId("rich-link-preview")).toHaveCount(4);
});

test("Profile Feed renders API-backed reblogs", async ({ page }) => {
  await mockAuthenticatedApi(page);
  await page.route("**/api/profiles/alex", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: {
          user: {
            id: 2,
            handle: "alex",
            displayName: "Alex",
            initials: "A",
            aura: "frost",
            avatarUrl: null,
          },
          bio: "Writes public posts.",
          location: "",
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
          createdAt: "2026-06-10 09:00:00",
          updatedAt: "2026-06-10 09:00:00",
        },
      }),
    }),
  );
  await page.route("**/api/profiles/alex/posts", (route) =>
    route.fulfill({ contentType: "application/json", body: JSON.stringify({ ok: true, data: [] }) }),
  );
  await page.route("**/api/profiles/alex/replies", (route) =>
    route.fulfill({ contentType: "application/json", body: JSON.stringify({ ok: true, data: [] }) }),
  );
  await page.route("**/api/profiles/alex/reblogs", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: [
          makePost({
            body: "A post Alex shared.",
            rebloggedBy: {
              id: 2,
              handle: "alex",
              displayName: "Alex",
              initials: "A",
              aura: "frost",
              avatarUrl: null,
            },
            rebloggedAt: "2026-06-10 10:00:00",
          }),
        ],
      }),
    }),
  );
  await page.route("**/api/profiles/alex/badges", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: { badges: [], featuredBadges: [] },
      }),
    }),
  );
  await page.route("**/api/profiles/alex/modules", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ ok: true, data: [activityModule()] }),
    }),
  );
  await page.route("**/api/profiles/alex/rooms", (route) =>
    route.fulfill({ contentType: "application/json", body: JSON.stringify({ ok: true, data: [] }) }),
  );
  await page.route("**/api/profiles/alex/followers", (route) =>
    route.fulfill({ contentType: "application/json", body: JSON.stringify({ ok: true, data: [] }) }),
  );
  await page.route("**/api/profiles/alex/following", (route) =>
    route.fulfill({ contentType: "application/json", body: JSON.stringify({ ok: true, data: [] }) }),
  );

  await page.goto("/@alex");

  await expect(page.getByText("@alex reblogged")).toBeVisible();
  await expect(page.getByText("A post Alex shared.")).toBeVisible();
});

test("feed post and reply actions use the canonical thread while controls stay isolated", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await mockAuthenticatedApi(page);
  let likeCalled = false;
  let reblogCalled = false;

  await page.route("**/api/feed/home", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: {
          posts: [
            makePost({
              commentCount: 1,
              mediaUrl: portraitMediaFixture,
              room: {
                id: 1,
                slug: "general",
                name: "General",
                theme: "elphaba",
                themeConfig: { mode: "preset", preset: "elphaba" },
                viewerCanPost: true,
                viewerCanViewPosts: true,
              },
            }),
          ],
          personalized: true,
        },
      }),
    }),
  );
  await page.route("**/api/posts/42/replies", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: [makePost({ id: 50, parentId: 42, body: "Thread reply." })],
      }),
    }),
  );
  await page.route("**/api/posts/42", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: makePost({
          commentCount: 1,
          mediaUrl: portraitMediaFixture,
          room: {
            id: 1,
            slug: "general",
            name: "General",
            theme: "elphaba",
            themeConfig: { mode: "preset", preset: "elphaba" },
            viewerCanPost: true,
            viewerCanViewPosts: true,
          },
        }),
      }),
    }),
  );
  await page.route("**/api/posts/42/like", async (route) => {
    likeCalled = true;
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: { postId: 42, likeCount: 1, likedByCurrentUser: true },
      }),
    });
  });
  await page.route("**/api/posts/42/reblog", async (route) => {
    reblogCalled = true;
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: {
          postId: 42,
          reblogCount: 1,
          rebloggedByMe: true,
          rebloggedByCurrentUser: true,
        },
      }),
    });
  });

  await page.goto("/");
  const post = page.getByTestId("post-card-open-thread").first();
  await expect(post).toBeVisible();
  const bodyOpenTarget = post.getByTestId("post-body-open-thread");
  await expect(bodyOpenTarget).toBeVisible();
  await expect(bodyOpenTarget).toHaveJSProperty("tagName", "DIV");
  await expect(bodyOpenTarget).not.toHaveAttribute(
    "class",
    /hover:|focus-visible:|rounded|ring|shadow|border|bg-/,
  );
  await expect(bodyOpenTarget).toHaveCSS("width", /\d+px/);
  await expect(bodyOpenTarget.locator("img")).toBeVisible();

  const postBox = await post.boundingBox();
  const bodyBox = await bodyOpenTarget.boundingBox();
  expect(postBox).not.toBeNull();
  expect(bodyBox).not.toBeNull();
  expect(postBox!.width).toBeLessThanOrEqual(610);
  expect(bodyBox!.width).toBeGreaterThan(postBox!.width * 0.8);

  await page.getByRole("button", { name: /Like this post/ }).first().click();
  await expect(page).toHaveURL(/\/$/);
  expect(likeCalled).toBe(true);

  await page.getByRole("button", { name: /Reblog this post/ }).first().click();
  await expect(page).toHaveURL(/\/$/);
  expect(reblogCalled).toBe(true);

  await bodyOpenTarget.click({ position: { x: 24, y: 24 } });
  await expect(page).toHaveURL(/\/@alex\/posts\/42$/);
  const thread = page.getByTestId("thread-view");
  await expect(thread).toBeVisible();
  await expect(thread.locator('[data-variant="focus"]')).toBeVisible();
  await expect(thread.locator('[data-variant="reply"]')).toHaveCount(1);
  await expect(thread.getByText("Thread reply.")).toBeVisible();

  await page.goBack();
  await expect(page).toHaveURL(/\/$/);
  await page.getByRole("button", { name: /Open replies/ }).first().click();
  await expect(page).toHaveURL(/\/@alex\/posts\/42$/);
  await expect(page.getByTestId("reply-composer")).toBeVisible();
  await expect(page.getByTestId("thread-modal")).toHaveCount(0);
});

test("focused post video autoplays muted, pauses offscreen, and keeps controls isolated", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.addInitScript(() => {
    const playbackCalls = { pause: 0, play: 0 };

    Object.defineProperty(window, "__thiaVideoPlaybackCalls", {
      configurable: true,
      value: playbackCalls,
    });
    HTMLMediaElement.prototype.play = function play() {
      playbackCalls.play += 1;
      return Promise.resolve();
    };
    HTMLMediaElement.prototype.pause = function pause() {
      playbackCalls.pause += 1;
    };
  });
  await mockAuthenticatedApi(page);
  let repliesRequested = false;

  await page.route("**/api/feed/home", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: {
          posts: [
            makePost({
              body: "A video upload.",
              mediaUrl: "/uploads/media/2026/06/video-upload.mp4",
              mediaType: "video",
              mediaMime: "video/mp4",
              mediaPosterUrl: portraitMediaFixture,
            }),
          ],
          personalized: true,
        },
      }),
    }),
  );
  await page.route("**/api/posts/42/replies", async (route) => {
    repliesRequested = true;
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ ok: true, data: [] }),
    });
  });
  await page.route("**/api/posts/42", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: makePost({
          body: "A video upload.",
          mediaUrl: "/uploads/media/2026/06/video-upload.mp4",
          mediaType: "video",
          mediaMime: "video/mp4",
          mediaPosterUrl: portraitMediaFixture,
        }),
      }),
    }),
  );

  await page.goto("/");

  const post = page.getByTestId("post-card-open-thread").first();
  await expect(post).toBeVisible();
  const videoFrame = post.getByTestId("post-attachments-0");
  await expect(videoFrame).toHaveAttribute("data-thread-open-ignore", "true");
  const video = post.getByTestId("post-attachments-0-video");
  await expect(video).toBeVisible();
  await expect(video).toHaveAttribute("data-focus-autoplay", "true");
  await expect(video).toHaveJSProperty("muted", true);
  await expect
    .poll(() =>
      page.evaluate(() =>
        (window as unknown as { __thiaVideoPlaybackCalls: { play: number } })
          .__thiaVideoPlaybackCalls.play,
      ),
    )
    .toBeGreaterThan(0);

  const videoBox = await video.boundingBox();
  expect(videoBox).not.toBeNull();
  await video.click({
    position: {
      x: 24,
      y: Math.max(24, videoBox!.height - 24),
    },
  });
  await expect(page).toHaveURL(/\/$/);
  expect(repliesRequested).toBe(false);

  await videoFrame.evaluate((element) => {
    element.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  });
  await expect(page).toHaveURL(/\/$/);
  expect(repliesRequested).toBe(false);

  await post.getByTestId("post-body-open-thread").click({ position: { x: 24, y: 24 } });
  await expect(page).toHaveURL(/\/@alex\/posts\/42$/);
  await expect(page.getByTestId("thread-view")).toBeVisible();

  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await expect
    .poll(() =>
      page.evaluate(() =>
        (window as unknown as { __thiaVideoPlaybackCalls: { pause: number } })
          .__thiaVideoPlaybackCalls.pause,
      ),
    )
    .toBeGreaterThan(0);
});

test("post body and media hover stay visually flat in Light and Dark", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await mockAuthenticatedApi(page);

  await page.route("**/api/feed/home", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: {
          posts: [makePost({ mediaUrl: portraitMediaFixture })],
          personalized: true,
        },
      }),
    }),
  );
  await page.route("**/api/posts/42/replies", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ ok: true, data: [] }),
    }),
  );

  for (const theme of ["light", "dark"] as const) {
    await page.goto("/");
    await page.evaluate((nextTheme) => {
      window.localStorage.setItem("thia.lol.theme", nextTheme);
      document.documentElement.dataset.theme = nextTheme;
      document.documentElement.style.colorScheme =
        nextTheme === "dark" ? "dark" : "light";
    }, theme);

    const post = page.getByTestId("post-card-open-thread").first();
    const bodyOpenTarget = post.getByTestId("post-body-open-thread");
    const mediaFrame = bodyOpenTarget.getByTestId("post-attachments-0");
    const mediaImage = bodyOpenTarget.getByTestId("post-attachments-0-image");

    await expect(bodyOpenTarget).toBeVisible();
    await expect(mediaFrame).toBeVisible();
    await expect(mediaImage).toBeVisible();
    const mediaBox = await mediaImage.boundingBox();
    expect(mediaBox).not.toBeNull();
    expect(mediaBox!.height).toBeGreaterThan(mediaBox!.width);
    expect(mediaBox!.height).toBeLessThanOrEqual(560);
    await expect(mediaImage).toHaveCSS("object-fit", "contain");
    await expectHoverToKeepSurfaceFlat(bodyOpenTarget);
    await expectHoverToKeepSurfaceFlat(mediaImage);
  }
});

test("post card open target supports keyboard navigation to its canonical thread", async ({ page }) => {
  await mockAuthenticatedApi(page);

  await page.route("**/api/feed/home", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: { posts: [makePost()], personalized: true },
      }),
    }),
  );
  await page.route("**/api/posts/42/replies", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ ok: true, data: [] }),
    }),
  );
  await page.route("**/api/posts/42", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ ok: true, data: makePost() }),
    }),
  );

  await page.goto("/");
  const openThreadLink = page
    .getByTestId("post-card-open-thread")
    .first()
    .getByRole("link", { name: "Open thread by Alex", exact: true });
  await openThreadLink.focus();
  await expect(openThreadLink).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/@alex\/posts\/42$/);
  await expect(page.getByTestId("thread-view")).toBeVisible();
});

test("post profile and room links do not open the thread target", async ({
  page,
}) => {
  await mockAuthenticatedApi(page);
  await mockProfileRoutes(page, "alex");
  await mockRoomRoutes(page, "general");

  await page.route("**/api/feed/home", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: {
          posts: [
            makePost({
              room: {
                id: 1,
                slug: "general",
                name: "General",
                theme: "elphaba",
                themeConfig: { mode: "preset", preset: "elphaba" },
              },
            }),
          ],
          personalized: true,
        },
      }),
    }),
  );

  await page.goto("/");
  await page
    .getByTestId("post-card-open-thread")
    .first()
    .getByRole("link", { name: "Alex's profile" })
    .click();
  await expect(page.getByTestId("thread-modal")).toHaveCount(0);
  await expect(page).toHaveURL(/\/@alex$/);

  await page.goto("/");
  await page
    .getByTestId("post-card-open-thread")
    .first()
    .getByRole("link", { name: "Alex", exact: true })
    .click();
  await expect(page.getByTestId("thread-modal")).toHaveCount(0);
  await expect(page).toHaveURL(/\/@alex$/);

  await page.goto("/");
  await page
    .getByTestId("post-card-open-thread")
    .first()
    .getByRole("link", { name: "@alex" })
    .click();
  await expect(page.getByTestId("thread-modal")).toHaveCount(0);
  await expect(page).toHaveURL(/\/@alex$/);

  await page.goto("/");
  await page
    .getByTestId("post-card-open-thread")
    .first()
    .getByRole("link", { name: "General" })
    .click();
  await expect(page.getByTestId("thread-modal")).toHaveCount(0);
  await expect(page).toHaveURL(/\/rooms\/general$/);
});

test("post report and delete controls stay isolated from body open", async ({
  page,
}) => {
  await mockAuthenticatedApi(page);
  let deleted = false;

  await page.route("**/api/feed/home", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: {
          posts: [
            makePost({
              author: {
                id: 1,
                handle: "viewer",
                displayName: "Viewer",
                initials: "V",
                aura: "frost",
                avatarUrl: null,
              },
            }),
            makePost({ id: 43, body: "Reportable post." }),
          ],
          personalized: true,
        },
      }),
    }),
  );
  await page.route("**/api/posts/42", async (route) => {
    deleted = true;
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: { id: 42, status: "removed", deletedAt: "2026-06-10 11:00:00" },
      }),
    });
  });

  await page.goto("/");
  await page
    .getByTestId("post-card-open-thread")
    .first()
    .getByRole("button", { name: "Delete post" })
    .click();
  await expect(page.getByTestId("thread-modal")).toHaveCount(0);
  expect(deleted).toBe(true);

  await page
    .getByTestId("post-card-open-thread")
    .first()
    .getByRole("button", { name: "Report post" })
    .click();
  await expect(page.getByTestId("thread-modal")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Report post" })).toBeVisible();
});

test("post permalink shows a trash delete action for the author", async ({
  page,
}) => {
  await mockAuthenticatedApi(page);
  let deleted = false;

  await page.route(/\/api\/posts\/[^/]+(?:\?.*)?$/u, async (route) => {
    if (route.request().method() === "DELETE") {
      deleted = true;
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          data: { id: 42, status: "removed", deletedAt: "2026-06-10 11:00:00" },
        }),
      });
      return;
    }

    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: makePost({
          author: {
            id: 1,
            handle: "viewer",
            displayName: "Viewer",
            initials: "V",
            aura: "frost",
            avatarUrl: null,
          },
        }),
      }),
    });
  });
  await page.route("**/api/posts/42/replies", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ ok: true, data: [] }),
    }),
  );

  await page.goto("/@viewer/posts/42");

  await page.getByRole("button", { name: "Delete post" }).click();

  await expect(page).toHaveURL(/\/@viewer$/u);
  await expect(page.getByTestId("post-card-open-thread")).toHaveCount(0);
  expect(deleted).toBe(true);
});

test("continuous thread keeps root and reply identities independently navigable", async ({ page }) => {
  await mockAuthenticatedApi(page);

  await page.route("**/api/feed/home", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: {
          posts: [
            makePost({
              commentCount: 1,
              room: {
                id: 1,
                slug: "general",
                name: "General",
                theme: "elphaba",
                themeConfig: { mode: "preset", preset: "elphaba" },
              },
            }),
          ],
          personalized: true,
        },
      }),
    }),
  );
  await page.route("**/api/posts/42/replies", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: [
          makePost({
            id: 50,
            parentId: 42,
            body: "Reply from Mira.",
            author: {
              id: 3,
              handle: "mira",
              displayName: "Mira",
              initials: "M",
              aura: "frost",
              avatarUrl: null,
            },
          }),
        ],
      }),
    }),
  );
  await page.route("**/api/posts/42", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: makePost({
          commentCount: 1,
          room: {
            id: 1,
            slug: "general",
            name: "General",
            theme: "elphaba",
            themeConfig: { mode: "preset", preset: "elphaba" },
          },
        }),
      }),
    }),
  );

  await page.goto("/");
  await page.getByTestId("post-body-open-thread").first().click();

  await expect(page).toHaveURL(/\/@alex\/posts\/42$/);
  const thread = page.getByTestId("thread-view");
  await expect(thread).toBeVisible();
  await expect(thread.getByRole("link", { name: "Alex's profile" })).toHaveAttribute(
    "href",
    "/@alex",
  );
  await expect(thread.getByRole("link", { name: "Mira's profile" })).toHaveAttribute(
    "href",
    "/@mira",
  );
  await expect(thread.getByRole("link", { name: "General" })).toHaveAttribute(
    "href",
    "/rooms/general",
  );
  const rootPost = thread.locator('[data-variant="focus"]');
  const replyItem = thread.locator('[data-variant="reply"]').first();
  await rootPost.hover();
  await replyItem.hover();
  await thread.getByRole("link", { name: "Mira's profile" }).hover();
  await thread.getByRole("link", { name: "General" }).hover();
  await thread.getByRole("button", { name: /Open replies/ }).first().hover();
  await page.waitForTimeout(100);

  await expect(rootPost).toBeVisible();
  await expect(replyItem).toBeVisible();
  await expect(rootPost).toHaveAttribute("data-depth", "0");
  await expect(replyItem).toHaveAttribute("data-depth", "1");
  await expect(page.getByTestId("thread-modal")).toHaveCount(0);
});

test("thread inline composer shares progressive formatting and media controls", async ({
  page,
}) => {
  await mockAuthenticatedApi(page);
  let replyPayload: Record<string, unknown> | undefined;
  let audioUploadPurpose: string | undefined;

  await page.route("**/api/feed/home", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: { posts: [makePost()], personalized: true },
      }),
    }),
  );
  await page.route("**/api/posts/42/replies", async (route) => {
    if (route.request().method() === "POST") {
      replyPayload = (await route.request().postDataJSON()) as Record<string, unknown>;
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          data: makePost({
            id: 51,
            parentId: 42,
            body: String(replyPayload.body),
            bodyFormat: "markdown",
            contentVersion: 3,
            attachments: replyPayload.attachments,
            author: {
              id: 1,
              handle: "viewer",
              displayName: "Viewer",
              initials: "V",
              aura: "frost",
              avatarUrl: null,
            },
          }),
        }),
      });
      return;
    }

    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ ok: true, data: [] }),
    });
  });
  await page.route("**/api/posts/42", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ ok: true, data: makePost() }),
    }),
  );
  for (const provider of ["spotify", "youtube"] as const) {
    await page.route(`**/api/me/integrations/${provider}/suggestions`, (route) =>
      route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          data: {
            provider,
            status: {
              provider,
              configured: true,
              oauthEnabled: true,
              metadataEnabled: true,
            },
            account: null,
            items: [],
          },
        }),
      }),
    );
  }
  await page.route("**/api/uploads/audio", async (route) => {
    const postData = route.request().postData() ?? "";
    audioUploadPurpose =
      postData.match(/name="purpose"\r\n\r\n([^\r\n]+)/)?.[1] ?? undefined;

    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: {
          url: "/uploads/media/2026/06/post_media-track.mp3",
          mime: "audio/mpeg",
          type: "audio/mpeg",
          size: 3072,
          purpose: "post_media",
        },
      }),
    });
  });

  await page.goto("/");
  await page.getByTestId("post-body-open-thread").first().click();

  const thread = page.getByTestId("thread-view");
  await expect(thread).toBeVisible();
  const composer = thread.getByTestId("reply-composer");
  await expect(composer).toBeVisible();
  await expect(composer.getByRole("button", { name: "Add music" })).toBeVisible();
  await expect(composer.getByRole("button", { name: "Reply", exact: true })).toBeDisabled();
  await expect(composer.getByTestId("reply-composer-markdown-toolbar")).toHaveCount(0);
  await expect(composer.getByTestId("reply-composer-markdown-preview")).toHaveCount(0);

  await composer.getByRole("button", { name: "Format" }).click();
  await expect(composer.getByTestId("reply-composer-markdown-toolbar")).toBeVisible();
  await composer.getByRole("button", { name: "Add music" }).click();
  await composer
    .getByTestId("post-music-audio-input")
    .setInputFiles(sampleMp3File("reply-track.mp3"));
  await expect.poll(() => audioUploadPurpose).toBe("post_media");
  await expect(composer.getByTestId("reply-composer-attachments")).toContainText("MP3");

  const replyBody = composer.getByRole("textbox", { name: "Reply" });
  await replyBody.fill("A **compact** reply.");
  await expect(replyBody).not.toHaveCSS("color", "rgba(0, 0, 0, 0)");
  await composer.getByRole("button", { name: "Preview" }).click();
  await expect(composer.getByTestId("reply-composer-markdown-preview")).not.toHaveCSS(
    "position",
    "absolute",
  );
  await expect(
    composer.getByTestId("reply-composer-markdown-preview").locator("strong").filter({
      hasText: "compact",
    }),
  ).toBeVisible();
  await composer.getByRole("button", { name: "Reply", exact: true }).click();

  await expect.poll(() => replyPayload).toMatchObject({
    body: "A **compact** reply.",
    attachments: [
      {
        kind: "audio",
        mime: "audio/mpeg",
        url: "/uploads/media/2026/06/post_media-track.mp3",
      },
    ],
  });
  await expect(
    thread.locator('[data-variant="reply"]').filter({ hasText: "A compact reply." }),
  ).toBeVisible();
  await expect(
    thread
      .locator('[data-variant="focus"]')
      .getByRole("button", { name: "Open replies and reply. 1 reply." }),
  ).toBeVisible();
  await expect(page.locator("header").getByText("1 reply", { exact: true })).toBeVisible();
  const createdReply = thread
    .locator('[data-variant="reply"]')
    .filter({ hasText: "A compact reply." });
  const musicPlayer = createdReply.getByTestId("post-attachments-0-music-player");
  await expect(musicPlayer).toContainText(
    "MP3 attachment 1",
  );
  await expect(musicPlayer).toHaveAttribute("data-post-music-layout", "compact");
  await expect(musicPlayer.getByTestId("post-attachments-0-music-play-button")).toBeVisible();
  await expect(musicPlayer.getByTestId("post-attachments-0-music-progress-time")).toHaveText(
    "Ready",
  );
  await expect(musicPlayer.getByTestId("post-attachments-0-music-progress-bar")).toHaveAttribute(
    "aria-valuenow",
    "0",
  );
  await expect(musicPlayer.locator("audio[controls]")).toHaveCount(0);
  await expect(createdReply.getByTestId("post-attachments-0-audio")).toBeAttached();
  await expect(createdReply.getByTestId("post-attachments-0-audio")).not.toBeVisible();
});

test("mobile thread keeps nested context focused and gates reply controls", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 760 });
  await mockAuthenticatedApi(page);
  let deletedPostId: number | undefined;
  let rebloggedReply = false;

  await page.route("**/api/feed/home", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: { posts: [makePost({ commentCount: 2 })], personalized: true },
      }),
    }),
  );
  await page.route("**/api/posts/42/replies", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: [
          makePost({
            id: 50,
            parentId: 42,
            body: "My reply.",
            commentCount: 1,
            author: {
              id: 1,
              handle: "viewer",
              displayName: "Viewer",
              initials: "V",
              aura: "frost",
              avatarUrl: null,
            },
          }),
          makePost({ id: 52, parentId: 42, body: "Rebloggable reply." }),
        ],
      }),
    }),
  );
  await page.route("**/api/posts/42", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ ok: true, data: makePost({ commentCount: 2 }) }),
    }),
  );
  await page.route("**/api/posts/50/replies", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: [makePost({ id: 60, parentId: 50, body: "Nested reply." })],
      }),
    }),
  );
  await page.route("**/api/posts/50", async (route) => {
    if (route.request().method() === "DELETE") {
      deletedPostId = 50;
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          data: { id: 50, status: "removed", deletedAt: "2026-06-10 10:30:00" },
        }),
      });
      return;
    }

    await route.continue();
  });
  await page.route("**/api/posts/52/reblog", async (route) => {
    rebloggedReply = route.request().method() === "POST";
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: {
          postId: 52,
          reblogCount: rebloggedReply ? 1 : 0,
          rebloggedByMe: rebloggedReply,
          rebloggedByCurrentUser: rebloggedReply,
        },
      }),
    });
  });

  await page.goto("/");
  await page.getByTestId("post-body-open-thread").first().click();
  await expect(page).toHaveURL(/\/@alex\/posts\/42$/);
  const thread = page.getByTestId("thread-view");

  await expect(page.getByTestId("mobile-nav")).toHaveCount(0);
  await expect(thread.getByText("My reply.")).toBeVisible();
  await expect(thread.getByText("Rebloggable reply.")).toBeVisible();
  const firstReply = thread.locator('[data-variant="reply"]').filter({ hasText: "My reply." });
  const secondReply = thread.locator('[data-variant="reply"]').filter({ hasText: "Rebloggable reply." });
  await expect(firstReply).toHaveAttribute("data-depth", "1");
  await expect(secondReply).toHaveAttribute("data-depth", "1");
  await thread.getByRole("button", { name: "Show 1 reply" }).click();
  await expect(thread.getByText("Nested reply.")).toBeVisible();

  const topReplyBox = await firstReply.boundingBox();
  const nestedReply = thread.locator('[data-variant="reply"]').filter({ hasText: "Nested reply." });
  const nestedReplyBox = await nestedReply.boundingBox();
  expect(topReplyBox).not.toBeNull();
  expect(nestedReplyBox).not.toBeNull();
  expect(nestedReplyBox!.x - topReplyBox!.x).toBeGreaterThan(6);
  expect(nestedReplyBox!.x - topReplyBox!.x).toBeLessThan(52);
  await expect(nestedReply).toHaveAttribute("data-depth", "2");

  const conversationOverflow = await thread
    .evaluate((node) => node.scrollWidth > node.clientWidth + 1);
  expect(conversationOverflow).toBe(false);

  await thread.getByRole("button", { name: "Format" }).first().click();
  for (const control of [
    page.getByRole("button", { name: "Back" }),
    thread.getByRole("button", { name: "Add music" }).first(),
    thread.getByRole("button", { name: "Bold" }).first(),
    thread.getByRole("button", { name: "Reply", exact: true }).first(),
  ]) {
    const box = await control.boundingBox();
    expect(box?.height).toBeGreaterThanOrEqual(44);
  }

  await secondReply.getByRole("button", { name: /Reblog this post/ }).click();
  await expect.poll(() => rebloggedReply).toBe(true);

  await firstReply.getByRole("button", { name: "Delete reply" }).click();
  await expect.poll(() => deletedPostId).toBe(50);
  await expect(thread.getByText("My reply.")).toHaveCount(0);
  await expect(
    thread
      .locator('[data-variant="focus"]')
      .getByRole("button", { name: "Open replies and reply. 1 reply." }),
  ).toBeVisible();
  await expect(page.locator("header").getByText("1 reply", { exact: true })).toBeVisible();
});

test("thread report flow submits the post target", async ({ page }) => {
  await mockAuthenticatedApi(page);
  let reportPayload: Record<string, unknown> | undefined;

  await page.route("**/api/feed/home", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: { posts: [makePost()], personalized: true },
      }),
    }),
  );
  await page.route("**/api/posts/42/replies", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ ok: true, data: [] }),
    }),
  );
  await page.route("**/api/posts/42", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ ok: true, data: makePost() }),
    }),
  );
  await page.route("**/api/reports", async (route) => {
    reportPayload = (await route.request().postDataJSON()) as Record<string, unknown>;
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ ok: true, data: { id: 1, ...reportPayload } }),
    });
  });

  await page.goto("/");
  await page.getByTestId("post-body-open-thread").first().click();
  const thread = page.getByTestId("thread-view");
  await expect(thread).toBeVisible();

  await thread.getByRole("button", { name: "Report post" }).first().click();
  const reportDialog = page.getByRole("dialog", { name: "Report post" });
  await expect(reportDialog).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(reportDialog).toBeHidden();
  await expect(thread).toBeVisible();

  await thread.getByRole("button", { name: "Report post" }).first().click();
  await expect(reportDialog).toBeVisible();
  await reportDialog.getByRole("button", { name: "Report", exact: true }).click();

  await expect.poll(() => reportPayload).toMatchObject({
    targetType: "post",
    targetId: 42,
    postId: 42,
    reportedUserId: 2,
  });
});

test("reblog and undo work against the API", async ({ page }) => {
  skipWithoutCredentials();

  const session = await loginWithEnv(page);
  const userId = session.data?.user?.id;
  const csrfToken = session.data?.csrfToken;

  expect(userId).toEqual(expect.any(Number));
  expect(csrfToken).toEqual(expect.any(String));

  const feed = await page.evaluate(async () => {
    const response = await fetch("/api/feed/home", {
      credentials: "include",
      headers: { Accept: "application/json" },
    });

    return (await response.json()) as {
      ok: boolean;
      data?: {
        posts: Array<{
          id: number;
          author: { id: number };
          rebloggedByMe?: boolean;
          rebloggedByCurrentUser?: boolean;
        }>;
      };
    };
  });

  expect(feed.ok).toBe(true);

  const target = feed.data?.posts.find((post) => post.author.id !== userId);

  test.skip(!target, "A public post by another user is required for reblog smoke.");

  const wasReblogged =
    target?.rebloggedByMe ?? target?.rebloggedByCurrentUser ?? false;

  async function mutateReblog(method: "POST" | "DELETE") {
    return page.evaluate(
      async ({ postId, requestMethod, token }) => {
        const response = await fetch(`/api/posts/${postId}/reblog`, {
          method: requestMethod,
          credentials: "include",
          headers: {
            Accept: "application/json",
            "X-CSRF-Token": token,
          },
        });

        return {
          status: response.status,
          body: (await response.json()) as {
            ok: boolean;
            data?: {
              reblogCount: number;
              rebloggedByMe?: boolean;
              rebloggedByCurrentUser?: boolean;
            };
            error?: string;
          },
        };
      },
      {
        postId: target!.id,
        requestMethod: method,
        token: csrfToken!,
      },
    );
  }

  const first = await mutateReblog(wasReblogged ? "DELETE" : "POST");
  expect(first.status).toBe(200);
  expect(first.body.ok).toBe(true);
  expect(
    first.body.data?.rebloggedByMe ??
      first.body.data?.rebloggedByCurrentUser,
  ).toBe(!wasReblogged);

  const second = await mutateReblog(wasReblogged ? "POST" : "DELETE");
  expect(second.status).toBe(200);
  expect(second.body.ok).toBe(true);
  expect(
    second.body.data?.rebloggedByMe ??
      second.body.data?.rebloggedByCurrentUser,
  ).toBe(wasReblogged);
});

async function expectHoverToKeepSurfaceFlat(target: Locator) {
  const before = await getSurfaceStyle(target);

  await target.hover();

  const after = await getSurfaceStyle(target);

  expect(after).toEqual(before);
}

function completedOnboardingState() {
  const steps = [
    "profile_basics",
    "spotify",
    "youtube",
    "twitch",
    "github",
    "apple_music",
    "profile_canvas",
  ];

  return {
    steps,
    completedSteps: steps,
    skippedSteps: [],
    providerLinks: {},
    finishedAt: "2026-06-19 12:00:00",
    dismissedAt: null,
    createdAt: "2026-06-19 12:00:00",
    updatedAt: "2026-06-19 12:00:00",
  };
}

async function getSurfaceStyle(target: Locator) {
  return target.evaluate((element) => {
    const style = window.getComputedStyle(element);

    return {
      backgroundColor: style.backgroundColor,
      boxShadow: style.boxShadow,
      outlineColor: style.outlineColor,
      outlineOffset: style.outlineOffset,
      outlineStyle: style.outlineStyle,
      outlineWidth: style.outlineWidth,
    };
  });
}

async function mockCommonApi(page: Page) {
  await page.route("**/api/auth/me", (route) =>
    route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({ ok: false, error: "Not authenticated." }),
    }),
  );

  await page.route("**/api/feed/home", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: { posts: [], personalized: false },
      }),
    }),
  );

  await page.route("**/api/feed/discover", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: { posts: [], activeRooms: [], peopleToWatch: [] },
      }),
    }),
  );

  await page.route("**/api/me/onboarding", (route) =>
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

  await page.route("**/api/notifications", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: {
          notifications: [],
          unreadCount: 0,
        },
      }),
    }),
  );
}

async function mockAuthenticatedApi(page: Page) {
  await page.route("**/api/auth/me", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: {
          user: {
            id: 1,
            handle: "viewer",
            email: "viewer@example.test",
            role: "member",
            status: "active",
            displayName: "Viewer",
            avatarUrl: null,
          },
          profile: {
            displayName: "Viewer",
            bio: "",
            location: "",
            avatarUrl: null,
            links: [],
            traits: [],
          },
          csrfToken: "test-csrf",
        },
      }),
    }),
  );

  await page.route("**/api/me/onboarding", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: completedOnboardingState(),
      }),
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
          publicPosts: 1,
          activeUsers: 2,
          totalReactions: 0,
        },
      }),
    }),
  );

  await page.route("**/api/notifications", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: {
          notifications: [],
          unreadCount: 0,
        },
      }),
    }),
  );
}

async function mockProfileRoutes(
  page: Page,
  handle: string,
  profileOverrides: Record<string, unknown> = {},
) {
  await page.route(`**/api/profiles/${handle}`, (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: {
          ...makePost().profile,
          ...profileOverrides,
        },
      }),
    }),
  );

  for (const suffix of ["posts", "replies", "reblogs", "rooms", "followers", "following"]) {
    await page.route(`**/api/profiles/${handle}/${suffix}`, (route) =>
      route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ ok: true, data: [] }),
      }),
    );
  }

  await page.route(`**/api/profiles/${handle}/modules`, (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ ok: true, data: [activityModule()] }),
    }),
  );

  await page.route(`**/api/profiles/${handle}/badges`, (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ ok: true, data: { badges: [], featuredBadges: [] } }),
    }),
  );
}

async function mockRoomRoutes(page: Page, slug: string) {
  await page.route(`**/api/rooms/${slug}`, (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: {
          id: 1,
          slug,
          name: "General",
          summary: "Open conversation.",
          description: "A public room.",
          mood: "glinda",
          members: 1,
          memberCount: 1,
          live: false,
          theme: "elphaba",
          themeConfig: { mode: "preset", preset: "elphaba" },
          iconUrl: null,
          bannerUrl: null,
          rules: "",
          visibility: "public",
          createdBy: 2,
          owner: {
            id: 2,
            handle: "alex",
            displayName: "Alex",
            initials: "A",
            aura: "frost",
            avatarUrl: null,
          },
          joinedByMe: false,
          myRoomRole: null,
          postCount: 0,
          latestActivityAt: "2026-06-10 10:00:00",
          createdAt: "2026-06-10 09:00:00",
          updatedAt: "2026-06-10 10:00:00",
        },
      }),
    }),
  );
  await page.route(`**/api/rooms/${slug}/posts`, (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ ok: true, data: [] }),
    }),
  );
  await page.route(`**/api/rooms/${slug}/members`, (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ ok: true, data: [] }),
    }),
  );
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

function richMentionEntity(
  body: string,
  mention: string,
  user = {
    id: 2,
    handle: mention.replace(/^@/, ""),
    displayName: mention.replace(/^@/, ""),
    initials: mention.replace(/^@/, "").slice(0, 2).toUpperCase(),
    aura: "frost",
    avatarUrl: null,
  },
) {
  return {
    type: "mention",
    start: body.indexOf(mention),
    length: mention.length,
    text: mention,
    mention: {
      handle: user.handle,
      user,
    },
  };
}

function richLinkEntity(body: string, url: string, card: Record<string, unknown>) {
  return {
    type: "link",
    start: body.indexOf(url),
    length: url.length,
    text: url,
    link: {
      url,
      card,
    },
  };
}

function richLinkEntityWithoutCard(body: string, url: string) {
  return {
    type: "link",
    start: body.indexOf(url),
    length: url.length,
    text: url,
    link: {
      url,
    },
  };
}

function richWebsiteCard(url: string, title: string) {
  return {
    provider: "website",
    resourceType: "url",
    resourceId: title.toLowerCase().replace(/\s+/g, "-"),
    resourceKey: `website:url:${title.toLowerCase().replace(/\s+/g, "-")}`,
    sourceUrl: url,
    metadata: {
      title,
      subtitle: new URL(url).hostname,
      description: "A safe server-rendered link card.",
      imageUrl: null,
      live: false,
      stats: {},
    },
    embed: null,
    apiBacked: true,
    fetchedAt: "2026-06-10T10:00:00Z",
    expiresAt: null,
    staleAt: null,
    stale: false,
    lastError: null,
  };
}

function richYouTubeCard(url: string) {
  return {
    provider: "youtube",
    resourceType: "video",
    resourceId: "abc123",
    resourceKey: "youtube:video:abc123",
    sourceUrl: url,
    metadata: {
      title: "YouTube demo",
      subtitle: "YouTube",
      description: null,
      imageUrl: null,
      live: false,
      stats: {},
    },
    embed: {
      type: "iframe",
      src: "https://www.youtube-nocookie.com/embed/abc123",
      title: "YouTube demo",
      height: 220,
      allow: "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share",
    },
    apiBacked: false,
    fetchedAt: "2026-06-10T10:00:00Z",
    expiresAt: null,
    staleAt: null,
    stale: false,
    lastError: null,
  };
}

function makePost(overrides: Record<string, unknown> = {}) {
  return {
    id: 42,
    body: "A public post.",
    mood: "glinda",
    mediaUrl: null,
    visibility: "public",
    status: "published",
    parentId: null,
    deletedAt: null,
    createdAt: "2026-06-10 10:00:00",
    updatedAt: "2026-06-10 10:00:00",
    author: {
      id: 2,
      handle: "alex",
      displayName: "Alex",
      initials: "A",
      aura: "frost",
      avatarUrl: null,
    },
    profile: {
      user: {
        id: 2,
        handle: "alex",
        displayName: "Alex",
        initials: "A",
        aura: "frost",
        avatarUrl: null,
      },
      bio: "",
      location: "",
      links: [],
      traits: [],
      stats: {
        posts: 1,
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
      createdAt: "2026-06-10 09:00:00",
      updatedAt: "2026-06-10 09:00:00",
    },
    room: null,
    commentCount: 0,
    reactions: {
      glow: 0,
      echo: 0,
      hush: 0,
    },
    likeCount: 0,
    likedByCurrentUser: false,
    reblogCount: 0,
    rebloggedByMe: false,
    rebloggedByCurrentUser: false,
    socialContext: {
      authorRelationship: null,
      likedByFollowedCount: 0,
    },
    ...overrides,
  };
}

async function expectViewportContained(page: Page, selectors: string[]) {
  const result = await page.evaluate((targetSelectors) => {
    const viewportWidth = document.documentElement.clientWidth;
    const escaped = targetSelectors.flatMap((selector) =>
      Array.from(document.querySelectorAll<HTMLElement>(selector))
        .filter((element) => {
          const styles = window.getComputedStyle(element);
          return styles.display !== "none" && styles.visibility !== "hidden";
        })
        .map((element) => {
          const rect = element.getBoundingClientRect();
          return {
            selector,
            left: rect.left,
            right: rect.right,
            width: rect.width,
          };
        })
        .filter((rect) => rect.left < -1 || rect.right > viewportWidth + 1),
    );

    return {
      documentWidth: document.documentElement.scrollWidth,
      escaped,
      scrollX: window.scrollX,
      viewportWidth,
    };
  }, selectors);

  expect(result.documentWidth).toBeLessThanOrEqual(result.viewportWidth + 1);
  expect(result.scrollX).toBe(0);
  expect(result.escaped).toEqual([]);
}

async function expectCircularControl(locator: Locator) {
  const shape = await readControlShape(locator);

  expect(shape.radius).toBeGreaterThanOrEqual(shape.height / 2 - 1);
}

async function expectCompactActionControl(locator: Locator) {
  const shape = await readControlShape(locator);

  expect(shape.height).toBeGreaterThanOrEqual(35);
  expect(shape.radius).toBeGreaterThanOrEqual(8);
  expect(shape.width).toBeGreaterThan(shape.height);
}

async function expectVisuallyClipped(locator: Locator) {
  await expect(locator).toHaveClass(/sr-only/);

  const box = await locator.boundingBox();
  expect(box?.width ?? 0).toBeLessThanOrEqual(1);
  expect(box?.height ?? 0).toBeLessThanOrEqual(1);
}

async function readControlShape(locator: Locator) {
  await expect(locator).toBeVisible();

  return locator.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const styles = window.getComputedStyle(element);

    return {
      height: rect.height,
      radius: Number.parseFloat(styles.borderTopLeftRadius),
      width: rect.width,
    };
  });
}

function sampleMp3File(name: string) {
  return {
    name,
    mimeType: "audio/mpeg",
    buffer: Buffer.from("SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjYwLjMuMTAwAAAAAAAA", "base64"),
  };
}

function makeDiscoverRoom(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    slug: "general",
    name: "General",
    summary: "Open conversation.",
    mood: "glinda",
    members: 0,
    live: false,
    theme: "glinda",
    themeConfig: { mode: "preset", preset: "glinda" },
    visibility: "public",
    postCount: 2,
    latestActivityAt: "2026-06-10 10:00:00",
    createdAt: "2026-06-10 09:00:00",
    updatedAt: "2026-06-10 10:00:00",
    ...overrides,
  };
}

function makeDiscoverPerson(overrides: Record<string, unknown> = {}) {
  return {
    handle: "alex",
    displayName: "Alex",
    initials: "A",
    avatarUrl: null,
    bioSnippet: "Writes public posts.",
    isFollowing: false,
    isMoot: false,
    postCount: 3,
    followerCount: 1,
    starCount: 2,
    ...overrides,
  };
}
