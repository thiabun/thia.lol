import { expect, type Locator, type Page, test } from "@playwright/test";
import { Buffer } from "node:buffer";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const PROFILE_CANVAS_VERSION = 2;
const PROFILE_CANVAS_COLUMNS = 12;
const PROFILE_CANVAS_ROWS = 16;
const PROFILE_CANVAS_MOBILE_COLUMNS = 6;
const PROFILE_CANVAS_MOBILE_ROWS = 32;

test.describe.configure({ mode: "default" });

test.beforeEach(async ({ context }) => {
  await context.route(
    /^https:\/\/open\.spotify\.com\/embed\/(album|artist|episode|playlist|show|track)\//,
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "text/html",
        body: "<!doctype html><html><body>Spotify embed stub</body></html>",
      });
    },
  );
  await context.route(/^https:\/\/i\.scdn\.co\/image\//, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "image/png",
      body: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
        "base64",
      ),
    });
  });
  await context.route(/^https:\/\/player\.twitch\.tv\//, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "text/html",
      body: "<!doctype html><html><body>Twitch player stub</body></html>",
    });
  });
  await context.route(/^https:\/\/www\.twitch\.tv\/embed\//, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "text/html",
      body: "<!doctype html><html><body>Twitch chat stub</body></html>",
    });
  });
  await context.route(
    /^https:\/\/www\.youtube-nocookie\.com\/embed\//,
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "text/html",
        body: "<!doctype html><html><body>YouTube embed stub</body></html>",
      });
    },
  );
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

test("profile renders public modules safely", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const aboutBody =
    "Literal <strong>plain</strong> text @alex https://example.com/notes";
  await mockProfileModules(page, {
    authenticated: false,
    modules: [
      {
        id: 1,
        type: "about",
        title: "About this space",
        config: { body: aboutBody },
        textEntities: {
          body: [
            {
              type: "mention",
              start: aboutBody.indexOf("@alex"),
              length: "@alex".length,
              text: "@alex",
              mention: {
                handle: "alex",
                user: {
                  id: 2,
                  handle: "alex",
                  displayName: "Alex",
                  initials: "A",
                  aura: "frost",
                  avatarUrl: null,
                },
              },
            },
            {
              type: "link",
              start: aboutBody.indexOf("https://example.com/notes"),
              length: "https://example.com/notes".length,
              text: "https://example.com/notes",
              link: {
                url: "https://example.com/notes",
                card: {
                  provider: "website",
                  resourceType: "url",
                  resourceId: "example-notes",
                  resourceKey: "website:url:example-notes",
                  sourceUrl: "https://example.com/notes",
                  metadata: {
                    title: "Example notes",
                    subtitle: "example.com",
                    description: "A safe profile module card.",
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
                },
              },
            },
          ],
        },
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
  await expect(section).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("Personal space")).toHaveCount(0);
  await expect(section.getByTestId("profile-module-grid")).toBeVisible();
  await expect(section.getByTestId("profile-grid-module-profile_info")).toHaveAttribute(
    "data-profile-grid-size",
    "8x3",
  );
  await expect(section.getByTestId("profile-module-grid")).toHaveAttribute(
    "data-profile-canvas-rows",
    String(PROFILE_CANVAS_MOBILE_ROWS),
  );
  await expect(section.getByTestId("profile-grid-module-about")).toHaveAttribute(
    "data-profile-grid-size",
    "3x2",
  );
  await expect(section.getByTestId("profile-grid-module-about")).toHaveAttribute(
    "data-profile-module-purpose",
    "status",
  );
  await expect(section.getByTestId("profile-grid-module-about")).toHaveAttribute(
    "data-profile-module-span-role",
    "rich",
  );
  await expect(section.getByTestId("profile-module-about")).toHaveAttribute(
    "data-profile-module-shell",
    "true",
  );
  await expect(section.getByTestId("profile-grid-module-links")).toHaveAttribute(
    "data-profile-grid-size",
    "3x2",
  );
  await expect(section.getByTestId("profile-grid-module-links")).toHaveAttribute(
    "data-profile-module-action",
    "open",
  );
  await expect(section.getByTestId("profile-module-links")).toHaveAttribute(
    "data-profile-module-transparent-surface",
    "true",
  );
  await expect(section.getByTestId("profile-module-links")).toHaveCSS(
    "background-color",
    "rgba(0, 0, 0, 0)",
  );
  await expect(section.getByTestId("profile-grid-module-featured_badges")).toHaveAttribute(
    "data-profile-grid-size",
    "2x2",
  );
  await expect(section.getByTestId("profile-module-featured_badges")).toHaveAttribute(
    "data-profile-module-transparent-surface",
    "true",
  );
  await expect(section.getByTestId("profile-module-featured_badges")).toHaveCSS(
    "background-color",
    "rgba(0, 0, 0, 0)",
  );
  await expectTextOrder(section, ["Thia", "Literal <strong>plain</strong> text"]);
  await expect(section.getByRole("heading", { name: "About this space" })).toHaveCount(0);
  await expect(section.getByRole("heading", { name: "Elsewhere" })).toHaveCount(0);
  await expect(section.getByRole("heading", { name: "Badge shelf" })).toHaveCount(0);
  await expect(section).toContainText("Literal <strong>plain</strong> text");
  await expect(section.locator("strong")).toHaveCount(0);
  await expect(
    section.getByTestId("profile-grid-module-about").getByTestId("rich-mention-link"),
  ).toHaveAttribute("href", "/@alex");
  await expect(
    section.getByTestId("profile-grid-module-about").getByTestId("rich-inline-link"),
  ).toHaveAttribute("href", "https://example.com/notes");
  await expect(section.getByRole("link", { name: "Personal site" })).toHaveAttribute(
    "href",
    "https://example.com/",
  );
  await expect(
    section
      .getByTestId("profile-module-featured_badges")
      .getByText("Founder", { exact: true }),
  ).toBeVisible();

  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(hasHorizontalOverflow).toBe(false);
});

test("P2 expressive modules render compact link-first cards", async ({ page }) => {
  await mockProfileModules(page, {
    authenticated: false,
    modules: [
      aboutModule({
        id: 1,
        title: "About / status",
        body: "Building thia.lol in compact slices.",
        position: 1,
      }),
      {
        ...aboutModule({
          id: 7,
          title: "Now",
          body: "Current profile mood.",
          position: 2,
        }),
        config: {
          body: "Current profile mood.",
          statusText: "Frostveil focus",
          workingOn: "Expressive profile modules",
        },
      },
      linksModule({
        id: 2,
        position: 3,
        links: [
          {
            label: "GitHub",
            platform: "github",
            url: "https://github.com/thiabun",
          },
          {
            label: "Personal site",
            platform: "custom",
            url: "https://example.com/about",
          },
        ],
      }),
      galleryModule({ id: 3, position: 4 }),
      creatorModule({ id: 4, position: 5 }),
      musicModule({ id: 5, position: 6 }),
    ],
  });
  await acknowledgeCookieNotice(page);
  await page.goto("/@thia");

  const modules = page.getByTestId("profile-modules");
  await expect(modules.getByText("Frostveil focus")).toBeVisible();
  await expect(modules.getByText("Expressive profile modules")).toBeVisible();
  await expect(modules.getByTestId("connection-icon-github")).toBeVisible();
  await expect(modules.getByRole("link", { name: /GitHub/ })).toHaveAttribute(
    "href",
    "https://github.com/thiabun",
  );
  await expect(modules.getByRole("link", { name: /Personal site/ })).toHaveAttribute(
    "href",
    "https://example.com/about",
  );
  await expect(modules.getByTestId("profile-grid-module-gallery_media")).toHaveAttribute(
    "data-profile-grid-size",
    "2x2",
  );
  await expect(modules.getByTestId("profile-grid-module-gallery_media")).toHaveAttribute(
    "data-profile-module-span-role",
    "glance",
  );
  const gallerySurface = modules
    .getByTestId("profile-grid-module-gallery_media")
    .getByTestId("profile-module-gallery_media");
  await expect(gallerySurface).toBeVisible();
  const galleryBackground = await gallerySurface.evaluate(
    (element) => window.getComputedStyle(element).backgroundColor,
  );
  expect(galleryBackground).not.toBe("rgba(0, 0, 0, 0)");
  await expect(modules.locator('img[src="/uploads/media/2026/06/profile-gallery-one.webp"]')).toBeVisible();
  await expect(modules.getByText("Studio corner")).toHaveCount(0);
  await expect(modules.getByRole("link", { name: /Find me on Twitch/ })).toHaveAttribute(
    "href",
    "https://www.twitch.tv/thiabun",
  );
  await expect(modules.getByRole("link", { name: /Focus playlist/ })).toHaveAttribute(
    "href",
    "https://open.spotify.com/playlist/profile-test",
  );
  await expect(modules.locator("iframe")).toHaveCount(0);
  await expect(modules.locator("audio, video")).toHaveCount(0);
});

test("module shells keep compact content glanceable without public overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockProfileModules(page, {
    authenticated: false,
    modules: [
      {
        ...aboutModule({
          id: 1,
          title: "Short signal",
          body: "This is intentionally long enough to need compact clamping inside a small module surface so it stays glanceable.",
          position: 1,
        }),
        config: {
          body: "This is intentionally long enough to need compact clamping inside a small module surface so it stays glanceable.",
          canvasSize: "1x1",
          statusText: "Status stays bounded.",
          workingOn: "A compact module design rubric.",
        },
      },
      {
        ...linksModule({
          id: 2,
          position: 2,
          links: [
            { label: "Site", platform: "website", url: "https://example.com/" },
            { label: "GitHub", platform: "github", url: "https://github.com/thiabun" },
            { label: "YouTube", platform: "youtube", url: "https://www.youtube.com/@thia" },
            { label: "Twitch", platform: "twitch", url: "https://www.twitch.tv/thiabun" },
            { label: "Music", platform: "spotify", url: "https://open.spotify.com/playlist/profile-test" },
          ],
        }),
        layout: { column: 1, row: 3, colSpan: 2, rowSpan: 2 },
      },
    ],
  });
  await acknowledgeCookieNotice(page);
  await page.goto("/@thia");

  const about = page.getByTestId("profile-grid-module-about");
  await expect(about).toHaveAttribute("data-profile-grid-size", "3x2");
  await expect(about).toHaveAttribute("data-profile-module-compact", "false");
  await expect(about).toHaveAttribute("data-profile-module-density", "summary");
  await expect(page.getByTestId("profile-module-about")).toHaveAttribute(
    "data-profile-module-empty-policy",
    "hide-public",
  );

  const links = page.getByTestId("profile-module-links");
  await expect(links.locator("[data-profile-module-visible-links]")).toHaveAttribute(
    "data-profile-module-visible-links",
    "5",
  );
  await expect(links.locator('[data-profile-connections-compact="icons"]')).toBeVisible();
  await expect(links.getByText("+1 more")).toHaveCount(0);

  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(hasHorizontalOverflow).toBe(false);
});

test("unsafe public module URLs are ignored before rendering", async ({ page }) => {
  await mockProfileModules(page, {
    authenticated: false,
    modules: [
      linksModule({
        links: [
          { label: "Unsafe", platform: "custom", url: "javascript:alert(1)" },
          { label: "Safe", platform: "custom", url: "https://example.com/" },
        ],
      }),
      {
        ...galleryModule(),
        config: {
          mediaItems: [
            { caption: "Bad", url: "https://example.com/not-an-upload.webp" },
          ],
        },
      },
    ],
  });
  await acknowledgeCookieNotice(page);
  await page.goto("/@thia");

  const modules = page.getByTestId("profile-modules");
  await expect(modules.getByRole("link", { name: /Safe/ })).toBeVisible();
  await expect(modules.getByText("Unsafe")).toHaveCount(0);
  await expect(modules.getByTestId("profile-grid-module-gallery_media")).toHaveCount(0);
});

test("activity renders through the module grid without a duplicate fixed section", async ({
  page,
}) => {
  await mockProfileModules(page, {
    authenticated: false,
    modules: [
      {
        ...activityModule({ id: 9, title: "Latest activity", position: 1 }),
        config: { canvasSize: "4x6", configured: true },
        layout: { column: 1, row: 1, colSpan: 4, rowSpan: 6 },
      },
      aboutModule({ id: 1, title: "About", body: "A compact intro.", position: 2 }),
    ],
    profilePosts: [postFixture({ body: "Profile activity post." })],
    profileRooms: [
      roomFixture({
        description: "This longer room description should not render in the compact activity card.",
        name: "Studio",
        slug: "studio",
        summary: "This room summary should stay out of the compact activity card.",
      }),
    ],
  });
  await acknowledgeCookieNotice(page);
  await page.goto("/@thia");

  const section = page.getByTestId("profile-modules");
  await expect(section).toBeVisible();
  await expect(section.getByTestId("profile-grid-module-activity")).toBeVisible();
  await expect(section.getByTestId("profile-grid-module-activity")).toHaveAttribute(
    "data-profile-grid-size",
    "4x6",
  );
  await expect(section.getByTestId("profile-module-activity")).toBeVisible();
  await expect(section.getByTestId("profile-module-activity")).toHaveAttribute(
    "data-profile-activity-surface",
    "public",
  );
  const activityBackground = await section
    .getByTestId("profile-module-activity")
    .evaluate((element) => window.getComputedStyle(element).backgroundColor);
  expect(activityBackground).not.toBe("rgba(0, 0, 0, 0)");
  await expect(section.getByRole("heading", { name: "Latest activity" })).toHaveCount(0);

  const tabs = section.getByTestId("profile-activity-tabs");
  await expect(tabs.getByRole("tab", { name: /Feed/ })).toBeVisible();
  await expect(tabs.getByRole("tab", { name: /Replies/ })).toBeVisible();
  await expect(tabs.getByRole("tab", { name: /Rooms/ })).toBeVisible();
  await expect(section.getByText("Profile activity post.")).toBeVisible();
  await expect(page.getByTestId("profile-activity")).toHaveCount(1);
  await expect(
    page
      .getByTestId("profile-module-grid")
      .getByTestId("profile-grid-module-activity")
      .getByTestId("profile-activity"),
  ).toBeVisible();
  await tabs.getByRole("tab", { name: /Rooms/ }).click();
  await expect(section.getByTestId("profile-activity-room-compact-card")).toBeVisible();
  await expect(section.getByText("Studio", { exact: true })).toBeVisible();
  await expect(
    section.getByText("This room summary should stay out of the compact activity card."),
  ).toHaveCount(0);
  await expect(
    section.getByText("This longer room description should not render in the compact activity card."),
  ).toHaveCount(0);
});

test("activity keeps long feeds inside an internal scroll area", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  await mockProfileModules(page, {
    authenticated: false,
    modules: [
      {
        ...activityModule({ id: 9, title: "Latest activity", position: 1 }),
        layout: { column: 1, row: 4, colSpan: 3, rowSpan: 3 },
      },
      {
        ...aboutModule({
          id: 10,
          title: "Neighbor",
          body: "This module should keep its own row height.",
          position: 2,
        }),
        layout: { column: 4, row: 4, colSpan: 2, rowSpan: 1 },
      },
    ],
    profilePosts: Array.from({ length: 14 }, (_, index) =>
      postFixture({
        id: 100 + index,
        body: `Long activity item ${index + 1}.`,
      }),
    ),
  });
  await acknowledgeCookieNotice(page);
  await page.goto("/@thia");

  const module = page.getByTestId("profile-module-activity");
  const body = page.getByTestId("profile-activity");
  const tabs = page.getByTestId("profile-activity-tabs");
  await expect(module).toHaveAttribute("data-profile-activity-max-rows", "4");
  await expect(body).toHaveAttribute("data-profile-activity-scroll", "internal");
  await expect(tabs.getByRole("tab", { name: /Feed/ })).toBeVisible();
  await expect(page.getByText("Long activity item 14.")).toHaveCount(1);
  await expectModuleAspectRatio(
    page.getByTestId("profile-grid-module-activity"),
    3 / 4,
  );

  const metrics = await page.evaluate(() => {
    const moduleElement = document.querySelector<HTMLElement>(
      '[data-testid="profile-module-activity"]',
    );
    const bodyElement = document.querySelector<HTMLElement>(
      '[data-testid="profile-activity"]',
    );
    const tabsElement = document.querySelector<HTMLElement>(
      '[data-testid="profile-activity-tabs"]',
    );
    const neighborElement = document.querySelector<HTMLElement>(
      '[data-testid="profile-grid-module-about"]',
    );

    if (!moduleElement || !bodyElement || !tabsElement || !neighborElement) {
      throw new Error("Activity module elements were not rendered.");
    }

    const moduleRect = moduleElement.getBoundingClientRect();
    const tabsRect = tabsElement.getBoundingClientRect();
    const neighborRect = neighborElement.getBoundingClientRect();

    return {
      bodyClientHeight: bodyElement.clientHeight,
      bodyOverflowY: window.getComputedStyle(bodyElement).overflowY,
      bodyScrollHeight: bodyElement.scrollHeight,
      documentScrollHeight: document.documentElement.scrollHeight,
      moduleHeight: moduleRect.height,
      moduleBackground: window.getComputedStyle(moduleElement).backgroundColor,
      neighborHeight: neighborRect.height,
      tabsBottom: tabsRect.bottom,
      tabsTop: tabsRect.top,
      moduleBottom: moduleRect.bottom,
      moduleTop: moduleRect.top,
    };
  });

  expect(metrics.bodyOverflowY).toBe("auto");
  expect(metrics.bodyScrollHeight).toBeGreaterThan(metrics.bodyClientHeight + 100);
  expect(metrics.moduleBackground).not.toBe("rgba(0, 0, 0, 0)");
  expect(metrics.moduleHeight).toBeLessThan(540);
  expect(metrics.neighborHeight).toBeLessThan(190);
  expect(metrics.tabsTop).toBeGreaterThanOrEqual(metrics.moduleTop);
  expect(metrics.tabsBottom).toBeLessThanOrEqual(metrics.moduleBottom);
  expect(metrics.documentScrollHeight).toBeLessThan(metrics.bodyScrollHeight + 1_600);
});

test("active hidden activity modules recover into the public profile", async ({ page }) => {
  await mockProfileModules(page, {
    authenticated: false,
    modules: [
      {
        ...activityModule({ id: 9, title: "Recovered activity", position: 1 }),
        visibility: "hidden",
      },
    ],
    profilePosts: [postFixture({ body: "Recovered activity post." })],
  });
  await acknowledgeCookieNotice(page);
  await page.goto("/@thia");

  await expect(page.getByTestId("profile-module-activity")).toBeVisible();
  await expect(page.getByText("Recovered activity post.")).toBeVisible();
});

test("public empty activity module still renders its configured canvas slot", async ({ page }) => {
  await mockProfileModules(page, {
    authenticated: false,
    modules: [activityModule({ id: 9 })],
  });
  await acknowledgeCookieNotice(page);
  await page.goto("/@thia");

  await expect(page.getByTestId("profile-grid-module-activity")).toBeVisible();
  await expect(page.getByTestId("profile-module-activity")).toHaveAttribute(
    "data-profile-activity-surface",
    "public",
  );
  await expect(page.getByTestId("profile-activity-tabs")).toBeVisible();
  await expect(page.getByText("No posts yet")).toBeVisible();
});

test("profile module grid keeps responsive columns bounded", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockProfileModules(page, {
    authenticated: false,
    modules: [
      aboutModule({ id: 1, title: "About", body: "A compact intro.", position: 1 }),
      aboutModule({ id: 2, title: "Work", body: "Current work.", position: 2 }),
      aboutModule({ id: 3, title: "Now", body: "Current status.", position: 3 }),
    ],
  });
  await acknowledgeCookieNotice(page);
  await page.goto("/@thia");

  const grid = page.getByTestId("profile-module-grid");
  await expect(grid).toHaveAttribute(
    "data-profile-canvas-columns",
    String(PROFILE_CANVAS_COLUMNS),
  );
  await expectGridColumnCount(grid, PROFILE_CANVAS_MOBILE_COLUMNS);

  await page.setViewportSize({ width: 900, height: 900 });
  await expectGridColumnCount(grid, PROFILE_CANVAS_MOBILE_COLUMNS);

  await page.setViewportSize({ width: 1366, height: 900 });
  await expectGridColumnCount(grid, PROFILE_CANVAS_COLUMNS);
});

test("full-page profile background and glass grid render safely", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  await mockProfileModules(page, {
    authenticated: false,
    profileOverrides: {
      profileBackground: "/uploads/media/2026/06/profile-background.webp",
      profileBackgroundBlur: "heavy",
    },
    modules: [aboutModule({ title: "About", body: "Background readable." })],
  });
  await acknowledgeCookieNotice(page);
  await page.goto("/@thia");

  const backdrop = page.getByTestId("profile-personal-backdrop");
  await expect(backdrop).toHaveAttribute("data-profile-background-source", "image");
  await expect(backdrop).toHaveAttribute("data-profile-background-blur", "heavy");
  await expect(backdrop).toHaveAttribute("data-profile-background-visibility", "veiled");
  await expect(
    backdrop.locator('img[src="/uploads/media/2026/06/profile-background.webp"]'),
  ).toBeVisible();
  const heavyFilter = await backdrop
    .locator('img[src="/uploads/media/2026/06/profile-background.webp"]')
    .evaluate((image) => window.getComputedStyle(image).filter);
  expect(heavyFilter).toContain("blur(42px)");
  await expect(page.getByTestId("profile-module-grid")).toBeVisible();

  const metrics = await page.evaluate(() => {
    const backdropElement = document.querySelector<HTMLElement>(
      '[data-testid="profile-personal-backdrop"]',
    );
    const gridElement = document.querySelector<HTMLElement>(
      '[data-testid="profile-module-grid"]',
    );
    const footerElement = document.querySelector<HTMLElement>(
      '[data-testid="site-footer"]',
    );

    if (!backdropElement || !gridElement || !footerElement) {
      throw new Error("Profile background, grid, or footer did not render.");
    }

    const backdropRect = backdropElement.getBoundingClientRect();
    const footerRect = footerElement.getBoundingClientRect();
    const gridStyles = window.getComputedStyle(gridElement);

    return {
      backdropBottom: Math.round(backdropRect.bottom),
      backdropHeight: Math.round(backdropRect.height),
      backdropWidth: Math.round(backdropRect.width),
      footerTop: Math.round(footerRect.top),
      gridBackground: gridStyles.backgroundColor,
      viewportHeight: window.innerHeight,
      viewportWidth: window.innerWidth,
    };
  });

  expect(metrics.backdropWidth).toBeGreaterThanOrEqual(metrics.viewportWidth);
  expect(metrics.backdropHeight).toBeGreaterThanOrEqual(metrics.viewportHeight);
  expect(metrics.backdropBottom).toBeLessThanOrEqual(metrics.footerTop + 1);
  expect(metrics.gridBackground).not.toBe("rgba(0, 0, 0, 0)");
});

test("no-blur profile background remains visibly present", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  await mockProfileModules(page, {
    authenticated: false,
    profileOverrides: {
      profileBackground: "/uploads/media/2026/06/profile-background-clear.webp",
      profileBackgroundBlur: "none",
    },
    modules: [aboutModule({ title: "About", body: "Clear background." })],
  });
  await acknowledgeCookieNotice(page);
  await page.goto("/@thia");

  const backdrop = page.getByTestId("profile-personal-backdrop");
  await expect(backdrop).toHaveAttribute("data-profile-background-blur", "none");
  await expect(backdrop).toHaveAttribute("data-profile-background-visibility", "clear");

  const backgroundStyle = await page.evaluate(() => {
    const image = document.querySelector<HTMLImageElement>(
      '[data-testid="profile-personal-backdrop"] img',
    );

    if (!image) {
      throw new Error("Profile background image did not render.");
    }

    const styles = window.getComputedStyle(image);

    return {
      filter: styles.filter,
      opacity: Number(styles.opacity),
    };
  });

  expect(backgroundStyle.filter).not.toContain("blur(");
  expect(backgroundStyle.opacity).toBeGreaterThanOrEqual(0.8);
});

test("video background and allowlisted rich integrations render safely", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  await mockSpotifyIframeApi(page);
  await mockProfileModules(page, {
    authenticated: false,
    profileOverrides: {
      profileBackgroundVideo: "/uploads/media/2026/06/profile_background-loop.mp4",
      profileBackgroundVideoPoster: "/uploads/media/2026/06/profile-video-poster.webp",
    },
    modules: [
      {
        ...musicModule({ id: 6, position: 2 }),
        config: {
          description: "Current writing song.",
          label: "Focus track",
          platform: "spotify",
          url: "https://open.spotify.com/track/profile-test",
          integration: {
            provider: "spotify",
            resourceType: "track",
            resourceId: "profile-test",
            resourceKey: "spotify:track:profile-test",
            sourceUrl: "https://open.spotify.com/track/profile-test",
            metadata: {
              title: "Focus track",
              subtitle: "Spotify track",
              imageUrl: "https://i.scdn.co/image/focus-track",
              recentLabel: "Recently updated",
              recentFetchedAt: "2026-06-16T10:00:00Z",
            },
            embed: {
              type: "iframe",
              src: "https://open.spotify.com/embed/track/profile-test",
              title: "Spotify player",
              height: 152,
              allow: "encrypted-media; fullscreen; clipboard-write",
            },
            apiBacked: true,
            fetchedAt: "2026-06-16T10:00:00Z",
            stale: false,
          },
        },
      },
      {
        ...creatorModule({ id: 5, position: 3 }),
        config: {
          description: "Source and release notes.",
          label: "GitHub project",
          platform: "github",
          url: "https://github.com/thiabun/thia.lol",
          integration: {
            provider: "github",
            resourceType: "repo",
            resourceId: "thiabun/thia.lol",
            resourceKey: "github:repo:thiabun/thia.lol",
            sourceUrl: "https://github.com/thiabun/thia.lol",
            metadata: {
              title: "thiabun/thia.lol",
              subtitle: "GitHub project",
              description: "Public repository metadata.",
            },
            embed: null,
            apiBacked: true,
            fetchedAt: "2026-06-16T10:00:00Z",
            stale: false,
          },
        },
      },
    ],
  });
  await acknowledgeCookieNotice(page);
  await page.goto("/@thia");

  const backdrop = page.getByTestId("profile-personal-backdrop");
  await expect(backdrop).toHaveAttribute("data-profile-background-source", "video");
  await expect(
    backdrop.locator('source[src="/uploads/media/2026/06/profile_background-loop.mp4"]'),
  ).toHaveAttribute("type", "video/mp4");
  await expect(
    backdrop.locator('img[src="/uploads/media/2026/06/profile-video-poster.webp"]'),
  ).toBeAttached();

  await expectSpotifyCustomPlayer(page);
  const spotifyEmbed = page.getByTestId("profile-integration-embed-spotify");
  await expect(spotifyEmbed).toHaveAttribute(
    "src",
    "https://open.spotify.com/embed/track/profile-test?theme=0",
  );
  await expect(spotifyEmbed).toHaveAttribute("height", "80");
  await expect(spotifyEmbed).toHaveAttribute("data-profile-embed-provider", "spotify");
  await expect(spotifyEmbed).toHaveAttribute(
    "allow",
    /encrypted-media/,
  );
  await expect(page.getByTestId("profile-spotify-artwork")).toHaveAttribute(
    "src",
    "https://i.scdn.co/image/focus-track",
  );
  await expect(page.getByText("Recently updated · Spotify")).toBeVisible();
  await expect(page.getByText("Public repository metadata.")).toBeVisible();
  await expect(page.getByTestId("profile-integration-embed-github")).toHaveCount(0);
});

test("YouTube video modules render allowlisted nocookie embeds", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  await mockProfileModules(page, {
    authenticated: false,
    modules: [youtubeVideoModule({ id: 8 })],
  });
  await acknowledgeCookieNotice(page);
  await page.goto("/@thia");

  const module = page.getByTestId("profile-grid-module-youtube_video");
  await expect(module).toBeVisible();
  await expect(module).toHaveAttribute("data-profile-grid-size", "4x3");
  const embed = module.getByTestId("profile-integration-embed-youtube");
  await expect(embed).toBeVisible();
  await expect(embed).toHaveAttribute(
    "src",
    "https://www.youtube-nocookie.com/embed/watch123",
  );
  await expect(embed).toHaveAttribute("data-profile-media-only-embed", "true");
  await expect(embed).toHaveAttribute(
    "sandbox",
    /allow-scripts allow-same-origin/,
  );
});

test("Spotify music player fills each allowed music module span", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1366, height: 1000 });
  await mockSpotifyIframeApi(page);
  await mockProfileModules(page, {
    authenticated: true,
    modules: [
      musicModuleWithSize({ id: 61, row: 1, size: "2x1" }),
      musicModuleWithSize({ id: 62, row: 1, size: "2x2", column: 3 }),
      musicModuleWithSize({ id: 63, row: 1, size: "3x2", column: 5 }),
      musicModuleWithSize({ id: 64, row: 3, size: "4x2" }),
    ],
  });
  await acknowledgeCookieNotice(page);
  await page.goto("/@thia");

  await expect(page.getByTestId("profile-spotify-custom-player")).toHaveCount(4);
  const metrics = await page
    .getByTestId("profile-module-grid")
    .evaluate(() =>
      Array.from(
        document.querySelectorAll<HTMLElement>(
          '[data-testid="profile-grid-module-music"]',
        ),
      ).map((module) => {
        const player = module.querySelector<HTMLElement>(
          '[data-testid="profile-spotify-custom-player"]',
        );
        const artwork = module.querySelector<HTMLElement>(
          '[data-testid="profile-spotify-artwork-frame"]',
        );

        if (!player || !artwork) {
          throw new Error("Music player did not render.");
        }

        const moduleRect = module.getBoundingClientRect();
        const playerRect = player.getBoundingClientRect();
        const artworkRect = artwork.getBoundingClientRect();

        return {
          artworkHeight: Math.round(artworkRect.height),
          heightCoverage: playerRect.height / moduleRect.height,
          layout: player.dataset.profileSpotifyLayout,
          size: module.dataset.profileGridSize,
          widthCoverage: playerRect.width / moduleRect.width,
        };
      }),
    );

  expect(metrics).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ layout: "compact", size: "2x1" }),
      expect.objectContaining({ layout: "compact", size: "2x2" }),
      expect.objectContaining({ layout: "rich", size: "3x2" }),
      expect.objectContaining({ layout: "rich", size: "4x2" }),
    ]),
  );

  for (const metric of metrics) {
    expect(metric.heightCoverage).toBeGreaterThanOrEqual(0.94);
    expect(metric.widthCoverage).toBeGreaterThanOrEqual(0.94);
    expect(metric.artworkHeight).toBeGreaterThanOrEqual(
      metric.size === "3x2" || metric.size === "4x2" ? 96 : 56,
    );
  }
});

test("compact music modules choose black or white text from album art", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  await mockSpotifyIframeApi(page);

  const darkArtworkUrl = "https://assets.example.test/uploads/test/dark-album-art.png";
  const lightArtworkUrl = "https://assets.example.test/uploads/test/light-album-art.png";
  await mockAlbumArtwork(page, darkArtworkUrl, darkAlbumArtworkPng);
  await mockAlbumArtwork(page, lightArtworkUrl, lightAlbumArtworkPng);
  await mockProfileModules(page, {
    authenticated: true,
    modules: [
      withAuditLayout(
        spotifyEmbedMusicModule({
          id: 81,
          imageUrl: darkArtworkUrl,
          position: 81,
        }),
        "2x2",
        1,
      ),
      withAuditLayout(
        appleMusicEmbedModule({
          id: 82,
          imageUrl: lightArtworkUrl,
          position: 82,
        }),
        "2x2",
        1,
        3,
      ),
    ],
  });
  await acknowledgeCookieNotice(page);
  await page.goto("/@thia");

  const spotifyPlayer = page.getByTestId("profile-spotify-custom-player");
  await expect(spotifyPlayer).toHaveAttribute("data-profile-spotify-text-tone", "white");
  await expect(spotifyPlayer.locator('[data-profile-spotify-title="true"]')).toHaveCSS(
    "color",
    "rgb(255, 255, 255)",
  );

  const appleMusicTile = page.locator('[data-profile-music-text-tone]').filter({
    hasText: "Apple song",
  });
  await expect(appleMusicTile).toHaveAttribute("data-profile-music-text-tone", "black");
  await expect(appleMusicTile.locator('[data-profile-music-title="true"]')).toHaveCSS(
    "color",
    "rgb(0, 0, 0)",
  );
});

test("desktop module spans render with square-cell geometry", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 1100 });
  await mockProfileModules(page, {
    authenticated: true,
    modules: [
      withAuditLayout(profileInfoModule(), "4x3", 1),
      withAuditLayout(
        activityModule({ id: 9, position: 2 }),
        "3x4",
        4,
        1,
      ),
      withAuditLayout(twitchStreamChatModule({ id: 5, row: 6 }), "6x4", 6),
    ],
    profilePosts: Array.from({ length: 8 }, (_, index) =>
      postFixture({ id: 500 + index, body: `Geometry post ${index + 1}.` }),
    ),
  });
  await acknowledgeCookieNotice(page);
  await page.goto("/@thia");

  await expectModuleAspectRatio(page.getByTestId("profile-grid-module-profile_info"), 4 / 3);
  await expectModuleAspectRatio(page.getByTestId("profile-grid-module-activity"), 3 / 4);
  await expectModuleAspectRatio(page.getByTestId("profile-grid-module-creator_live"), 6 / 4);
  await expect(page.getByTestId("profile-activity")).toHaveAttribute(
    "data-profile-activity-scroll",
    "internal",
  );
});

test("public visitor continues before Spotify profile music starts", async ({
  page,
}) => {
  await mockSpotifyIframeApi(page);
  await mockProfileModules(page, {
    authenticated: false,
    modules: [spotifyEmbedMusicModule()],
  });
  await acknowledgeCookieNotice(page);
  await page.goto("/@thia");

  const overlay = page.getByTestId("profile-music-continue-overlay");
  await expect(overlay).toBeVisible();
  await expectSpotifyCustomPlayer(page);
  await expect.poll(() => spotifyPlayCalls(page)).toBe(0);

  const button = page.getByTestId("profile-music-continue-button");
  await button.focus();
  await page.keyboard.press("Enter");

  await expect(overlay).toHaveCount(0);
  await expect.poll(() => spotifyPlayCalls(page)).toBe(1);
  await expectSpotifyProgress(page, { max: 38, min: 33 }, /1:0\d \/ 3:00/);
  const stored = await page.evaluate(() =>
    window.localStorage.getItem("thia.profile.musicAutoplayConsent.v1:1"),
  );

  expect(stored).not.toBeNull();
  expect(JSON.parse(stored ?? "{}")).toMatchObject({
    handle: "thia",
    profileId: 1,
    provider: "spotify",
  });
});

test("stored Spotify music consent skips the continue overlay", async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      "thia.profile.musicAutoplayConsent.v1:1",
      JSON.stringify({
        grantedAt: "2026-06-17T00:00:00.000Z",
        handle: "thia",
        profileId: 1,
        provider: "spotify",
      }),
    );
  });
  await mockSpotifyIframeApi(page);
  await mockProfileModules(page, {
    authenticated: false,
    modules: [spotifyEmbedMusicModule()],
  });
  await acknowledgeCookieNotice(page);
  await page.goto("/@thia");

  await expect(page.getByTestId("profile-music-continue-overlay")).toHaveCount(0);
  await expectSpotifyCustomPlayer(page);
  await expect.poll(() => spotifyPlayCalls(page)).toBe(1);
  await expectSpotifyProgress(page, { max: 38, min: 33 }, /1:0\d \/ 3:00/);
});

test("invalid Spotify music consent falls back to the continue overlay", async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("thia.profile.musicAutoplayConsent.v1:1", "{bad");
  });
  await mockSpotifyIframeApi(page);
  await mockProfileModules(page, {
    authenticated: false,
    modules: [spotifyEmbedMusicModule()],
  });
  await acknowledgeCookieNotice(page);
  await page.goto("/@thia");

  await expect(page.getByTestId("profile-music-continue-overlay")).toBeVisible();
  await expect.poll(() => spotifyPlayCalls(page)).toBe(0);
});

test("profile music continue overlay excludes owners and non-Spotify embeds", async ({
  page,
}) => {
  await mockSpotifyIframeApi(page);
  await mockProfileModules(page, {
    authenticated: true,
    modules: [spotifyEmbedMusicModule()],
  });
  await acknowledgeCookieNotice(page);
  await page.goto("/@thia");
  await expect(page.getByTestId("profile-music-continue-overlay")).toHaveCount(0);
  await expect.poll(() => spotifyPlayCalls(page)).toBe(0);

  await page.unrouteAll({ behavior: "ignoreErrors" });
  await mockProfileModules(page, {
    authenticated: false,
    modules: [appleMusicEmbedModule()],
  });
  await page.goto("/@thia");
  await expect(page.getByTestId("profile-music-continue-overlay")).toHaveCount(0);
});

test("profile music continue overlay only follows the first visible music module", async ({
  page,
}) => {
  await mockSpotifyIframeApi(page);
  await mockProfileModules(page, {
    authenticated: false,
    modules: [
      appleMusicEmbedModule({ id: 21, position: 1 }),
      spotifyEmbedMusicModule({ id: 22, position: 2 }),
    ],
  });
  await acknowledgeCookieNotice(page);
  await page.goto("/@thia");

  await expect(page.getByTestId("profile-music-continue-overlay")).toHaveCount(0);
  await expectSpotifyCustomPlayer(page);
  await expect.poll(() => spotifyPlayCalls(page)).toBe(0);
});

test("Spotify playback failure still opens the profile", async ({ page }) => {
  await mockSpotifyIframeApi(page, { rejectPlay: true });
  await mockProfileModules(page, {
    authenticated: false,
    modules: [spotifyEmbedMusicModule()],
  });
  await acknowledgeCookieNotice(page);
  await page.goto("/@thia");

  await page.getByTestId("profile-music-continue-button").click();

  await expect(page.getByTestId("profile-music-continue-overlay")).toHaveCount(0);
  await expectSpotifyCustomPlayer(page);
  await expect.poll(() => spotifyPlayCalls(page)).toBe(1);
  await expectSpotifyProgress(page, 0, "Ready");
});

test("uploaded MP3 music modules use the continue overlay", async ({ page }) => {
  await mockProfileModules(page, {
    authenticated: false,
    modules: [uploadedMp3MusicModule()],
  });
  await acknowledgeCookieNotice(page);
  await page.goto("/@thia");

  await expect(page.getByTestId("profile-music-continue-overlay")).toBeVisible();
  await expect(page.getByTestId("profile-uploaded-audio-player")).toBeVisible();

  await page.getByTestId("profile-music-continue-button").click();
  await expect(page.getByTestId("profile-music-continue-overlay")).toHaveCount(0);

  const stored = await page.evaluate(() =>
    window.localStorage.getItem("thia.profile.musicAutoplayConsent.v1:1"),
  );

  expect(stored).not.toBeNull();
  expect(JSON.parse(stored ?? "{}")).toMatchObject({
    handle: "thia",
    profileId: 1,
    provider: "upload",
  });
});

test("integration modules do not fake live or recent labels without API backing", async ({
  page,
}) => {
  await mockProfileModules(page, {
    authenticated: false,
    modules: [
      {
        ...musicModule({ id: 6, position: 1 }),
        config: {
          description: "A static playlist link.",
          label: "Static playlist",
          platform: "spotify",
          url: "https://open.spotify.com/playlist/profile-test",
          integration: {
            provider: "spotify",
            resourceType: "playlist",
            resourceId: "profile-test",
            resourceKey: "spotify:playlist:profile-test",
            sourceUrl: "https://open.spotify.com/playlist/profile-test",
            metadata: {
              title: "Static playlist",
              recentLabel: "Recently updated",
              recentFetchedAt: "2026-06-16T10:00:00Z",
            },
            embed: null,
            apiBacked: false,
            fetchedAt: "2026-06-16T10:00:00Z",
            stale: false,
          },
        },
      },
      {
        ...creatorModule({ id: 5, position: 2 }),
        config: {
          description: "Fetched stream state.",
          label: "Thia live",
          platform: "twitch",
          url: "https://www.twitch.tv/thiabun",
          integration: {
            provider: "twitch",
            resourceType: "channel",
            resourceId: "thiabun",
            resourceKey: "twitch:channel:thiabun",
            sourceUrl: "https://www.twitch.tv/thiabun",
            metadata: {
              title: "Thia live",
              live: true,
              liveFetchedAt: "2026-06-16T10:00:00Z",
            },
            embed: null,
            apiBacked: true,
            fetchedAt: "2026-06-16T10:00:00Z",
            stale: false,
          },
        },
      },
    ],
  });
  await acknowledgeCookieNotice(page);
  await page.goto("/@thia");

  await expect(page.getByTestId("profile-grid-module-music")).toHaveAttribute(
    "data-profile-module-freshness",
    "cached",
  );
  await expect(page.getByText("Spotify link")).toBeVisible();
  await expect(page.getByText("Recently updated · Spotify")).toHaveCount(0);
  await expect(page.getByText("Live now on Twitch")).toBeVisible();
});

test("Twitch stream chat fills the creator module when embed metadata is available", async ({
  page,
}) => {
  await mockProfileModules(page, {
    authenticated: false,
    modules: [twitchStreamChatModule()],
  });
  await acknowledgeCookieNotice(page);
  await page.goto("/@thia");

  const creator = page.getByTestId("profile-grid-module-creator_live");
  await expect(creator).toHaveAttribute("data-profile-grid-size", "6x4");
  await expect(creator.getByTestId("profile-integration-embed-twitch")).toBeVisible();
  await expect(creator.getByTestId("profile-integration-embed-twitch")).toHaveAttribute(
    "src",
    /autoplay=false/,
  );
  await expect(creator.getByTestId("profile-integration-embed-twitch-chat")).toBeVisible();
  const twitchSurface = creator.locator(
    '[data-profile-twitch-embed-surface="true"]',
  );
  await expect(twitchSurface).toHaveAttribute("data-profile-twitch-grid-columns", "6");
  await expect(twitchSurface).toHaveAttribute(
    "data-profile-twitch-stream-columns",
    "4",
  );
  await expect(twitchSurface).toHaveAttribute("data-profile-twitch-chat-columns", "2");
  await expectTwitchStreamChatWidthRatio(creator, {
    max: 2.1,
    min: 1.7,
  });
  await expect(creator.getByRole("link")).toHaveCount(0);
});

test("largest Twitch stream chat uses a six plus two desktop split", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1920, height: 1100 });
  await mockProfileModules(page, {
    authenticated: false,
    modules: [
      {
        ...twitchStreamChatModule({ id: 12 }),
        type: "twitch_channel",
        layout: { column: 1, row: 1, colSpan: 8, rowSpan: 6 },
      },
    ],
  });
  await acknowledgeCookieNotice(page);
  await page.goto("/@thia");

  const twitch = page.getByTestId("profile-grid-module-twitch_channel");
  await expect(twitch).toHaveAttribute("data-profile-grid-size", "8x6");
  const twitchSurface = twitch.locator(
    '[data-profile-twitch-embed-surface="true"]',
  );
  await expect(twitchSurface).toHaveAttribute("data-profile-twitch-grid-columns", "8");
  await expect(twitchSurface).toHaveAttribute(
    "data-profile-twitch-stream-columns",
    "6",
  );
  await expect(twitchSurface).toHaveAttribute("data-profile-twitch-chat-columns", "2");
  await expectTwitchStreamChatWidthRatio(twitch, {
    max: 2.75,
    min: 2.15,
  });
  const largeEmbedMetrics = await twitchSurface
    .locator(".profile-twitch-embed-grid")
    .evaluate((element) => {
      const styles = window.getComputedStyle(element);
      const stream = element.querySelector<HTMLElement>(
        '[data-testid="profile-integration-embed-twitch"]',
      );
      const chat = element.querySelector<HTMLElement>(
        '[data-testid="profile-integration-embed-twitch-chat"]',
      );

      return {
        chatMinHeight: chat ? window.getComputedStyle(chat).minHeight : "",
        streamMinHeight: stream ? window.getComputedStyle(stream).minHeight : "",
        transform: styles.transform,
      };
    });
  expect(largeEmbedMetrics.streamMinHeight).toBe("0px");
  expect(largeEmbedMetrics.chatMinHeight).toBe("0px");
  expect(largeEmbedMetrics.transform).not.toBe("none");
});

test("owner direct canvas editor preserves lower-row 6x4 creator modules", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1366, height: 1100 });

  await mockProfileModules(page, {
    authenticated: true,
    modules: [
      {
        ...aboutModule({ id: 1, title: "About", body: "Stays above.", position: 1 }),
        layout: { column: 1, row: 1, colSpan: 2, rowSpan: 1 },
      },
      twitchStreamChatModule({ id: 5, position: 2, row: 8 }),
    ],
  });
  await acknowledgeCookieNotice(page);
  await page.goto("/@thia");

  const creator = page.getByTestId("profile-grid-module-creator_live");
  await expect(creator).toHaveAttribute("data-profile-grid-size", "6x4");
  await expect(creator).toHaveCSS("--profile-grid-row", "8");

  await page.getByTestId("profile-edit-button").click();
  await expect(page.getByTestId("profile-canvas-editor")).toBeVisible();
  const editorCreator = page.getByTestId("profile-canvas-module-5");
  await expect(editorCreator).toHaveCSS("--profile-grid-row", "8");
  await expect(editorCreator).not.toHaveAttribute("data-profile-module-dragging", "true");
});

test.skip("retired canvas editor pin controls stay backend-only during transition", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  let savedPayload: Record<string, unknown> | undefined;

  await mockProfileModules(page, {
    authenticated: true,
    modules: [
      {
        ...aboutModule({ id: 1, title: "Pinned about", body: "Pinned in place." }),
        layout: { column: 1, row: 4, colSpan: 2, rowSpan: 1 },
        pinned: true,
      },
      {
        ...linksModule({ id: 2, title: "Links", position: 2 }),
        layout: { column: 3, row: 4, colSpan: 2, rowSpan: 1 },
      },
    ],
    onCanvasDraftSave: (payload) => {
      savedPayload = payload;
    },
  });
  await acknowledgeCookieNotice(page);
  await page.goto("/@thia");

  await page.getByTestId("profile-canvas-edit-button").click();
  const pinnedModule = page.getByTestId("profile-grid-module-about");
  await pinnedModule.click();
  await expect(pinnedModule).toHaveAttribute("data-profile-module-pinned", "true");
  await expect(page.getByTestId("profile-canvas-drag-handle-1")).toBeDisabled();
  await expect(page.getByTestId("profile-canvas-pin-module-button")).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  await page.getByTestId("profile-canvas-save-button").click();
  await expect.poll(() => savedPayload).toBeDefined();
  const savedModules = savedPayload?.modules as Array<Record<string, unknown>>;
  expect(savedModules.find((module) => module.id === 1)).toMatchObject({
    column: 1,
    pinned: true,
    row: 4,
  });
});

test("public logged-out users do not see profile edit controls", async ({ page }) => {
  await mockProfileModules(page, {
    authenticated: false,
    modules: [aboutModule({ title: "About", body: "Public profile." })],
  });
  await acknowledgeCookieNotice(page);
  await page.goto("/@thia");

  await expect(page.getByTestId("profile-edit-button")).toHaveCount(0);
  await expect(page.getByTestId("profile-canvas-editor")).toHaveCount(0);
});

test("profile info banner fills large module space cleanly", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  await mockProfileModules(page, {
    authenticated: false,
    profileOverrides: {
      bannerUrl: "/uploads/media/2026/06/profile-banner.webp",
    },
    modules: [
      {
        ...profileInfoModule(),
        layout: { column: 1, row: 1, colSpan: 6, rowSpan: 3 },
      },
    ],
  });
  await acknowledgeCookieNotice(page);
  await page.goto("/@thia");

  const module = page.getByTestId("profile-grid-module-profile_info");
  const info = module.getByTestId("profile-module-profile-info");
  const banner = module.getByTestId("profile-header-banner");

  await expect(info).toHaveAttribute("data-profile-info-columns", "6");
  await expect(info).toHaveAttribute("data-profile-info-rows", "3");
  await expect(banner).toHaveAttribute("data-profile-banner-treatment", "cover");
  await expect(module.getByTestId("profile-social-context")).toHaveAttribute(
    "data-profile-info-stats-variant",
    "row",
  );
  await expect(module.getByTestId("profile-social-context")).toContainText("Likes");
  await expect(module.getByTestId("profile-info-action-rail")).toBeVisible();
  await expect(module.getByTestId("profile-info-actions-menu")).toHaveCount(0);
  await module.getByTestId("profile-info-overflow-button").click();
  await expect(module.getByTestId("profile-info-actions-menu")).toBeVisible();
  await expect(
    module.getByRole("button", { name: "Report profile" }),
  ).toBeVisible();
  const statStyles = await module
    .getByTestId("profile-social-context")
    .evaluate((element) =>
      Array.from(element.querySelectorAll<HTMLElement>("[data-profile-info-stat]")).map(
        (stat) => {
          const label = stat.querySelector<HTMLElement>(
            "[data-profile-info-stat-label]",
          );
          const value = stat.querySelector<HTMLElement>(
            "[data-profile-info-stat-value]",
          );

          if (!label || !value) {
            throw new Error("Profile info stat did not render label and value spans.");
          }

          const labelStyles = window.getComputedStyle(label);
          const valueStyles = window.getComputedStyle(value);

          return {
            label: stat.getAttribute("data-profile-info-stat"),
            labelFontSize: labelStyles.fontSize,
            valueFontSize: valueStyles.fontSize,
          };
        },
      ),
    );
  expect(statStyles).toHaveLength(3);
  expect(new Set(statStyles.map((stat) => stat.labelFontSize)).size).toBe(1);
  expect(new Set(statStyles.map((stat) => stat.valueFontSize)).size).toBe(1);

  const metrics = await page.evaluate(() => {
    const moduleElement = document.querySelector<HTMLElement>(
      '[data-testid="profile-grid-module-profile_info"]',
    );
    const headerElement = document.querySelector<HTMLElement>(
      '[data-testid="profile-grid-module-profile_info"] [data-testid="profile-header"]',
    );
    const bannerElement = document.querySelector<HTMLElement>(
      '[data-testid="profile-grid-module-profile_info"] [data-testid="profile-header-banner"]',
    );
    const bannerImage = document.querySelector<HTMLElement>(
      '[data-testid="profile-grid-module-profile_info"] [data-testid="profile-header-banner-image"]',
    );
    const actionRail = document.querySelector<HTMLElement>(
      '[data-testid="profile-grid-module-profile_info"] [data-testid="profile-info-action-rail"]',
    );
    const actionMenu = document.querySelector<HTMLElement>(
      '[data-testid="profile-grid-module-profile_info"] [data-testid="profile-info-actions-menu"]',
    );

    if (!moduleElement || !headerElement || !bannerElement || !bannerImage || !actionRail || !actionMenu) {
      throw new Error("Profile info module, header, banner, or actions did not render.");
    }

    const moduleRect = moduleElement.getBoundingClientRect();
    const actionRailRect = actionRail.getBoundingClientRect();
    const actionMenuRect = actionMenu.getBoundingClientRect();

    return {
      actionMenuBottom: Math.round(actionMenuRect.bottom),
      actionMenuRight: Math.round(actionMenuRect.right),
      actionRailRight: Math.round(actionRailRect.right),
      bannerHeight: Math.round(bannerElement.getBoundingClientRect().height),
      headerHeight: Math.round(headerElement.getBoundingClientRect().height),
      infoHeight: Math.round(
        document
          .querySelector<HTMLElement>(
            '[data-testid="profile-grid-module-profile_info"] [data-testid="profile-module-profile-info"]',
          )!
          .getBoundingClientRect().height,
      ),
      moduleBottom: Math.round(moduleRect.bottom),
      moduleHeight: Math.round(moduleRect.height),
      moduleRight: Math.round(moduleRect.right),
      objectFit: window.getComputedStyle(bannerImage).objectFit,
    };
  });

  expect(metrics.actionRailRight).toBeLessThanOrEqual(metrics.moduleRight + 1);
  expect(metrics.actionMenuRight).toBeLessThanOrEqual(metrics.moduleRight + 1);
  expect(metrics.actionMenuBottom).toBeLessThanOrEqual(metrics.moduleBottom + 1);
  expect(metrics.headerHeight).toBeGreaterThanOrEqual(metrics.moduleHeight * 0.92);
  expect(metrics.infoHeight).toBeGreaterThanOrEqual(metrics.moduleHeight * 0.92);
  expect(metrics.bannerHeight).toBeGreaterThan(metrics.moduleHeight * 0.3);
  expect(metrics.bannerHeight).toBeLessThan(metrics.moduleHeight * 0.62);
  expect(metrics.objectFit).toBe("cover");
});

test("wide profile info keeps cover banner and avatar overlap at high resolution", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await mockProfileModules(page, {
    authenticated: false,
    profileOverrides: {
      bio: "The queen, owner and creator of thia.lol.",
      bannerUrl: "/uploads/media/2026/06/profile-banner.webp",
      user: {
        id: 1,
        handle: "thia",
        displayName: "Thia",
        initials: "T",
        aura: "frost",
        avatarUrl: "/uploads/media/2026/06/avatar.webp",
      },
    },
    modules: [
      {
        ...profileInfoModule(),
        layout: { column: 3, row: 1, colSpan: 8, rowSpan: 3 },
        config: { canvasSize: "8x3" },
      },
    ],
  });
  await acknowledgeCookieNotice(page);
  await page.goto("/@thia");

  const module = page.getByTestId("profile-grid-module-profile_info");
  await expect(module).toHaveAttribute("data-profile-grid-size", "8x3");
  await expect(module.getByTestId("profile-header-banner")).toHaveAttribute(
    "data-profile-banner-treatment",
    "cover",
  );

  const metrics = await module.evaluate((element) => {
    const header = element.querySelector<HTMLElement>('[data-testid="profile-header"]');
    const banner = element.querySelector<HTMLElement>(
      '[data-testid="profile-header-banner"]',
    );
    const bannerImage = banner?.querySelector<HTMLImageElement>(
      '[data-testid="profile-header-banner-image"]',
    );
    const scaledInfo = element.querySelector<HTMLElement>(
      '[data-testid="profile-module-profile-info"]',
    );
    const avatar = element.querySelector<HTMLElement>(
      '[data-testid="profile-info-avatar-frame"]',
    );
    const contentCluster = element.querySelector<HTMLElement>(
      '[data-testid="profile-info-content-cluster"]',
    );
    const displayName = element.querySelector<HTMLElement>(
      '[data-testid="profile-info-identity-row"] h1',
    );
    const socialContext = element.querySelector<HTMLElement>(
      '[data-testid="profile-social-context"]',
    );
    const actionRail = element.querySelector<HTMLElement>(
      '[data-testid="profile-info-action-rail"]',
    );
    const bio = element.querySelector<HTMLElement>('[data-testid="profile-bio"]');

    if (
      !header ||
      !banner ||
      !bannerImage ||
      !scaledInfo ||
      !avatar ||
      !contentCluster ||
      !displayName ||
      !socialContext ||
      !actionRail ||
      !bio
    ) {
      throw new Error("Expected profile info banner, avatar, and bio to render.");
    }

    const moduleRect = element.getBoundingClientRect();
    const headerRect = header.getBoundingClientRect();
    const bannerRect = banner.getBoundingClientRect();
    const scaledInfoRect = scaledInfo.getBoundingClientRect();
    const avatarRect = avatar.getBoundingClientRect();
    const contentRect = contentCluster.getBoundingClientRect();
    const displayNameRect = displayName.getBoundingClientRect();
    const socialRect = socialContext.getBoundingClientRect();
    const actionRailRect = actionRail.getBoundingClientRect();
    const bioRect = bio.getBoundingClientRect();
    const topElement = document.elementFromPoint(
      avatarRect.left + avatarRect.width / 2,
      Math.min(bannerRect.bottom - 2, avatarRect.top + avatarRect.height * 0.32),
    );

    return {
      actionRailBottom: actionRailRect.bottom,
      actionRailRight: actionRailRect.right,
      actionRailTop: actionRailRect.top,
      avatarBottom: avatarRect.bottom,
      avatarLeft: avatarRect.left,
      avatarRight: avatarRect.right,
      avatarFrontAtBannerOverlap:
        topElement === avatar || avatar.contains(topElement),
      avatarTop: avatarRect.top,
      bannerBottom: bannerRect.bottom,
      bannerHeight: bannerRect.height,
      bioBottom: bioRect.bottom,
      contentBottom: contentRect.bottom,
      contentGapFromBanner: contentRect.top - bannerRect.bottom,
      contentTop: contentRect.top,
      displayNameLeft: displayNameRect.left,
      displayNameRight: displayNameRect.right,
      displayNameTop: displayNameRect.top,
      headerHeight: headerRect.height,
      headerRight: headerRect.right,
      headerWidth: headerRect.width,
      infoHeight: scaledInfoRect.height,
      infoWidth: scaledInfoRect.width,
      moduleBottom: moduleRect.bottom,
      moduleHeight: moduleRect.height,
      moduleRight: moduleRect.right,
      moduleWidth: moduleRect.width,
      objectFit: window.getComputedStyle(bannerImage).objectFit,
      socialTop: socialRect.top,
      socialVariant: socialContext.getAttribute("data-profile-info-stats-variant"),
    };
  });

  expect(metrics.objectFit).toBe("cover");
  expect(metrics.socialVariant).toBe("row");
  expect(metrics.infoWidth).toBeGreaterThanOrEqual(metrics.moduleWidth - 2);
  expect(metrics.infoHeight).toBeGreaterThanOrEqual(metrics.moduleHeight - 2);
  expect(metrics.bannerHeight).toBeGreaterThan(metrics.moduleHeight * 0.3);
  expect(metrics.avatarFrontAtBannerOverlap).toBe(true);
  expect(metrics.avatarTop).toBeLessThan(metrics.bannerBottom);
  expect(metrics.avatarBottom).toBeGreaterThan(metrics.bannerBottom);
  expect(metrics.displayNameTop).toBeGreaterThan(metrics.avatarBottom - 1);
  expect(metrics.displayNameLeft).toBeGreaterThanOrEqual(metrics.avatarLeft - 1);
  expect(metrics.actionRailTop).toBeGreaterThan(metrics.bannerBottom);
  expect(metrics.actionRailRight).toBeLessThanOrEqual(metrics.moduleRight + 1);
  expect(metrics.socialTop).toBeGreaterThanOrEqual(metrics.bioBottom - 1);
  expect(metrics.contentTop).toBeGreaterThan(metrics.bannerBottom);
  expect(metrics.contentGapFromBanner).toBeLessThan(metrics.moduleHeight * 0.2);
  expect(metrics.contentBottom).toBeLessThanOrEqual(metrics.moduleBottom + 1);
  expect(metrics.bioBottom).toBeLessThanOrEqual(metrics.moduleBottom + 1);
  expect(metrics.headerWidth).toBeGreaterThanOrEqual(metrics.moduleWidth - 2);
  expect(metrics.headerHeight).toBeGreaterThanOrEqual(metrics.moduleHeight - 2);
  expect(metrics.headerRight).toBeLessThanOrEqual(metrics.moduleRight + 1);
});

test("profile info variants stay within each supported size", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await acknowledgeCookieNotice(page);

  const cases = [
    { size: "3x2", variant: "compact", column: 1 },
    { size: "3x3", variant: "compact", column: 1 },
    { size: "4x3", variant: "balanced", column: 1 },
    { size: "6x3", variant: "wide", column: 1 },
    { size: "8x3", variant: "wide", column: 3 },
    { size: "8x4", variant: "expanded", column: 3 },
  ];

  for (const profileInfoCase of cases) {
    await page.unrouteAll({ behavior: "ignoreErrors" });
    await mockProfileModules(page, {
      authenticated: false,
      profileOverrides: {
        bannerUrl: "/uploads/media/2026/06/profile-banner.webp",
        bio: "A founder profile with enough bio text to prove this size does not clip its identity, actions, stats, and badges.",
      },
      modules: [
        withAuditLayout(
          profileInfoModule(),
          profileInfoCase.size,
          1,
          profileInfoCase.column,
        ),
      ],
    });
    await page.goto(`/@thia?profileInfo=${profileInfoCase.size}`);

    const module = page.getByTestId("profile-grid-module-profile_info");
    const header = module.getByTestId("profile-header");
    await expect(module).toHaveAttribute("data-profile-grid-size", profileInfoCase.size);
    await expect(header).toHaveAttribute(
      "data-profile-info-variant",
      profileInfoCase.variant,
    );
    const socialContext = module.getByTestId("profile-social-context");
    await expect(socialContext).toContainText("Followers");
    await expect(socialContext).toContainText("Following");
    await expect(socialContext).toContainText("Likes");
    await expect(socialContext).toHaveAttribute(
      "data-profile-info-stats-variant",
      ["3x2", "3x3"].includes(profileInfoCase.size) ? "compact" : "row",
    );
    if (["4x3", "6x3", "8x3", "8x4"].includes(profileInfoCase.size)) {
      await expect(module.getByTestId("profile-info-identity-row")).toBeVisible();
      await expect(module.getByTestId("profile-info-overflow-button")).toBeVisible();
    }
    if (["6x3", "8x3", "8x4"].includes(profileInfoCase.size)) {
      await expect(module.getByTestId("profile-info-badge-row")).toContainText("Founder");
    } else {
      await expect(module.getByTestId("profile-info-badge-row")).toHaveCount(0);
    }
    const statStyles = await socialContext.evaluate((element) =>
      Array.from(element.querySelectorAll<HTMLElement>("[data-profile-info-stat]")).map(
        (stat) => {
          const label = stat.querySelector<HTMLElement>(
            "[data-profile-info-stat-label]",
          );
          const value = stat.querySelector<HTMLElement>(
            "[data-profile-info-stat-value]",
          );

          if (!label || !value) {
            throw new Error("Profile info stat did not render label and value spans.");
          }

          const labelStyles = window.getComputedStyle(label);
          const valueStyles = window.getComputedStyle(value);

          return {
            label: stat.getAttribute("data-profile-info-stat"),
            labelFontSize: labelStyles.fontSize,
            valueFontSize: valueStyles.fontSize,
          };
        },
      ),
    );
    expect(statStyles.map((stat) => stat.label)).toEqual([
      "Followers",
      "Following",
      "Likes",
    ]);
    expect(new Set(statStyles.map((stat) => stat.labelFontSize)).size).toBe(1);
    expect(new Set(statStyles.map((stat) => stat.valueFontSize)).size).toBe(1);
    if (["3x2", "3x3"].includes(profileInfoCase.size)) {
      await expect(module.getByTestId("profile-header-banner")).toHaveCount(0);
    }
    if (["4x3", "6x3", "8x3", "8x4"].includes(profileInfoCase.size)) {
      await expect(module.getByTestId("profile-header-banner")).toHaveAttribute(
        "data-profile-banner-treatment",
        "cover",
      );
      await expect(module.getByTestId("profile-header-banner-image")).toHaveCSS(
        "object-fit",
        "cover",
      );
    }

    const metrics = await module.evaluate((element) => {
      const headerElement = element.querySelector<HTMLElement>(
        '[data-testid="profile-header"]',
      );
      const bioElement = element.querySelector<HTMLElement>('[data-testid="profile-bio"]');
      const gridElement = element.closest<HTMLElement>(
        '[data-testid="profile-module-grid"]',
      );

      if (!headerElement || !gridElement) {
        throw new Error("Profile info header or grid did not render.");
      }

      const moduleRect = element.getBoundingClientRect();
      const headerRect = headerElement.getBoundingClientRect();
      const bioStyles = bioElement ? window.getComputedStyle(bioElement) : null;
      const gridStyles = window.getComputedStyle(gridElement);
      const columnGap = Number.parseFloat(gridStyles.columnGap) || 0;
      const rowGap = Number.parseFloat(gridStyles.rowGap) || columnGap;
      const paddingLeft = Number.parseFloat(gridStyles.paddingLeft) || 0;
      const paddingRight = Number.parseFloat(gridStyles.paddingRight) || 0;
      const activeColumns = Number(
        gridElement.getAttribute("data-profile-canvas-columns") ?? 12,
      );
      const cellSize =
        Number.parseFloat(gridStyles.getPropertyValue("--profile-grid-cell-size")) ||
        (gridElement.clientWidth -
          paddingLeft -
          paddingRight -
          columnGap * (activeColumns - 1)) /
          activeColumns;
      const colSpan = Number(
        element.getAttribute("data-profile-grid-column-span") ?? 1,
      );
      const rowSpan = Number(
        element.getAttribute("data-profile-grid-row-span") ?? 1,
      );

      return {
        bioLineClamp:
          bioStyles?.getPropertyValue("-webkit-line-clamp") ??
          bioStyles?.webkitLineClamp ??
          "",
        bioOverflow: bioStyles?.overflow ?? "",
        expectedModuleHeight: Math.round(cellSize * rowSpan + rowGap * (rowSpan - 1)),
        expectedModuleWidth: Math.round(
          cellSize * colSpan + columnGap * (colSpan - 1),
        ),
        headerBottom: headerRect.bottom,
        headerHeight: Math.round(headerRect.height),
        headerRight: headerRect.right,
        headerWidth: Math.round(headerRect.width),
        moduleBottom: moduleRect.bottom,
        moduleHeight: Math.round(moduleRect.height),
        moduleRight: moduleRect.right,
        moduleWidth: Math.round(moduleRect.width),
      };
    });

    expect(Math.abs(metrics.moduleWidth - metrics.expectedModuleWidth)).toBeLessThanOrEqual(2);
    expect(Math.abs(metrics.moduleHeight - metrics.expectedModuleHeight)).toBeLessThanOrEqual(2);
    expect(metrics.headerWidth).toBeGreaterThanOrEqual(metrics.moduleWidth - 2);
    expect(metrics.headerHeight).toBeGreaterThanOrEqual(metrics.moduleHeight - 2);
    expect(metrics.headerRight).toBeLessThanOrEqual(metrics.moduleRight + 1);
    expect(metrics.headerBottom).toBeLessThanOrEqual(metrics.moduleBottom + 1);
    if (profileInfoCase.size !== "3x2") {
      expect(metrics.bioOverflow).toBe("hidden");
      expect(metrics.bioLineClamp).not.toBe("none");
    }
  }
});

test("owner edits background clarity in the direct canvas draft", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  let savedPayload: Record<string, unknown> | undefined;

  await mockProfileModules(page, {
    authenticated: true,
    profileOverrides: {
      profileBackground: "/uploads/media/2026/06/profile-background-clear.webp",
      profileBackgroundBlur: "none",
    },
    modules: [
      {
        ...aboutModule({ id: 1, title: "About", body: "Move me.", position: 2 }),
        layout: { column: 1, row: 2, colSpan: 2, rowSpan: 1 },
      },
      linksModule({ id: 2, title: "Links", position: 3 }),
    ],
    onCanvasDraftSave: (payload) => {
      savedPayload = payload;
    },
  });
  await acknowledgeCookieNotice(page);
  await page.goto("/@thia");

  await page.getByTestId("profile-edit-button").click();
  await expect(page.getByTestId("profile-canvas-editor")).toBeVisible();
  await expect(page.getByTestId("profile-canvas-background-controls")).toBeVisible();
  await expect(page.getByTestId("profile-canvas-background-trigger")).toBeVisible();
  await expect(page.getByText("Background clarity")).toHaveCount(0);
  await expect(page.getByText("6 x 12 canvas")).toHaveCount(0);
  await expect(page.getByText(/is selected\./)).toHaveCount(0);
  await page.getByTestId("profile-canvas-background-trigger").click();
  await expect(page.getByTestId("profile-canvas-background-popover")).toBeVisible();
  await expect(page.getByText("Clarity")).toBeVisible();
  await expect(page.getByTestId("profile-canvas-add-label-input")).toHaveCount(0);
  await expect(page.getByTestId("profile-personal-backdrop")).toHaveAttribute(
    "data-profile-background-blur",
    "none",
  );

  await page.getByTestId("profile-background-blur-heavy").click();
  await expect(page.getByTestId("profile-canvas-background-popover")).toHaveCount(0);
  await expect(page.getByTestId("profile-personal-backdrop")).toHaveAttribute(
    "data-profile-background-blur",
    "heavy",
  );
  const previewFilter = await page
    .getByTestId("profile-personal-backdrop")
    .locator("img")
    .evaluate((image) => window.getComputedStyle(image).filter);
  expect(previewFilter).toContain("blur(42px)");
  await expect(page.getByTestId("profile-selected-module-popover")).toHaveCount(0);
  await expect(page.getByTestId("profile-canvas-drag-handle-1")).toHaveCount(0);
  await expect(page.getByTestId("profile-canvas-position-grid")).toHaveCount(0);
  await expect
    .poll(() => savedPayload?.backgroundBlur)
    .toBe("heavy");
  expect(savedPayload?.canvasVersion).toBe(PROFILE_CANVAS_VERSION);
  await expect(page.getByTestId("profile-personal-backdrop")).toHaveAttribute(
    "data-profile-background-blur",
    "heavy",
  );
  await expect(page.getByText("Move me.")).toBeVisible();
});

test("direct canvas point selection creates a draft module through picker and settings", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  let draftPayload: Record<string, unknown> | undefined;
  let commitPayload: Record<string, unknown> | undefined;

  await mockProfileModules(page, {
    authenticated: true,
    modules: [],
    onCanvasDraftSave: (payload) => {
      draftPayload = payload;
    },
    onCanvasSave: (payload) => {
      commitPayload = payload;
    },
  });
  await acknowledgeCookieNotice(page);
  await page.goto("/@thia");

  await page.getByTestId("profile-edit-button").click();
  const editor = page.getByTestId("profile-canvas-editor");
  await expect(editor).toBeVisible();
  await expect(page.getByTestId("profile-canvas-direct-grid")).toHaveAttribute(
    "data-profile-canvas-columns",
    String(PROFILE_CANVAS_COLUMNS),
  );
  await expect(page.getByTestId("profile-canvas-direct-grid")).toHaveAttribute(
    "data-profile-canvas-rows",
    String(PROFILE_CANVAS_ROWS),
  );

  const startCell = page.getByTestId("profile-canvas-cell-5-4");
  await startCell.click();
  await expect(startCell).toHaveClass(/border-focus/);

  const hoverCell = page.getByTestId("profile-canvas-cell-7-5");
  await hoverCell.hover();
  await expect(page.getByTestId("profile-canvas-selection-preview")).toBeVisible();
  await expect(page.getByTestId("profile-canvas-selection-examples")).toBeVisible();
  await expect(page.getByTestId("profile-canvas-selection-examples")).toContainText(
    "Fits 3x2",
  );
  await expect(page.getByTestId("profile-canvas-selection-example-music")).toBeVisible();
  await expect(page.getByTestId("profile-canvas-selection-example-text")).toBeVisible();
  await expect(
    page.getByTestId("profile-canvas-selection-example-uploaded_image"),
  ).toBeVisible();
  await expect(
    page.getByTestId("profile-canvas-selection-example-twitch_channel"),
  ).toBeVisible();
  await expect(
    page.getByTestId("profile-canvas-selection-example-github_repo"),
  ).toHaveCount(0);
  await expect
    .poll(() =>
      page.evaluate(() => {
        const preview = document.querySelector(
          '[data-testid="profile-canvas-selection-preview"]',
        );
        const examples = document.querySelector(
          '[data-testid="profile-canvas-selection-examples"]',
        );

        if (!preview || !examples) {
          return false;
        }

        const previewRect = preview.getBoundingClientRect();
        const examplesRect = examples.getBoundingClientRect();

        return (
          examplesRect.left >= previewRect.left - 1 &&
          examplesRect.right <= previewRect.right + 1 &&
          examplesRect.top >= previewRect.top - 1 &&
          examplesRect.bottom <= previewRect.bottom + 1 &&
          document.documentElement.scrollWidth <=
            document.documentElement.clientWidth
        );
      }),
    )
    .toBe(true);
  await expect
    .poll(() =>
      hoverCell.evaluate((element) => window.getComputedStyle(element).opacity),
    )
    .toBe("0");
  await hoverCell.click();

  const blankModule = page.locator('[data-testid^="profile-canvas-add-module-"]');
  await expect(blankModule).toBeVisible();
  await expect(blankModule).toContainText("Click to add module");
  await expect
    .poll(() =>
      startCell.evaluate((element) => window.getComputedStyle(element).opacity),
    )
    .toBe("0");
  await expect(
    blankModule.evaluate((element) => window.getComputedStyle(element).filter),
  ).resolves.toBe("none");
  await expect(page.getByTestId("profile-module-picker")).toBeVisible();
  await expect(page.getByRole("tab", { name: "Video" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  const youtubeVideo = page.getByTestId("profile-module-picker-youtube_video");
  await expect(youtubeVideo).toBeDisabled();
  await expect(youtubeVideo.getByTestId("connection-icon-youtube")).toBeVisible();
  await expect(youtubeVideo).toContainText("Video");
  await expect(youtubeVideo).not.toContainText("YouTube video");
  await expect(youtubeVideo).toContainText("Selection too small");
  await expect(youtubeVideo).toContainText("(3x4)");

  await page.getByRole("tab", { name: "Info" }).click();
  await page.getByTestId("profile-module-picker-text").click();
  await expect(page.getByTestId("profile-module-settings")).toBeVisible();
  await expect(page.getByText("Available sizes")).toHaveCount(0);
  await expect(page.locator('[data-testid^="profile-canvas-size-"]')).toHaveCount(0);
  const sizeStepper = page.getByTestId("profile-module-size-stepper");
  await expect(sizeStepper).toBeVisible();
  await expect(sizeStepper.getByTestId("profile-module-size-current")).toContainText(
    "3 x 2",
  );
  await sizeStepper.getByTestId("profile-module-size-increase").click();
  await expect(sizeStepper.getByTestId("profile-module-size-current")).toContainText(
    "3x3",
  );
  await sizeStepper.getByTestId("profile-module-size-decrease").click();
  await expect(sizeStepper.getByTestId("profile-module-size-current")).toContainText(
    "3x2",
  );
  const pickedContent = page.locator(
    '[data-testid^="profile-canvas-module-content-"][data-profile-canvas-module-configured="false"]',
  );
  await expect(pickedContent).toHaveAttribute(
    "data-profile-canvas-module-configured",
    "false",
  );
  await expect(
    pickedContent.evaluate((element) => window.getComputedStyle(element).filter),
  ).resolves.toBe("none");
  await page
    .getByTestId("profile-module-settings-body")
    .fill("Canvas note configured from settings.");
  const configuredContent = page.locator(
    '[data-testid^="profile-canvas-module-content-"]',
    { hasText: "Canvas note configured from settings." },
  );
  await expect(configuredContent).toBeVisible();
  await expect(configuredContent).toHaveAttribute(
    "data-profile-canvas-module-configured",
    "true",
  );
  await expect(
    configuredContent.evaluate((element) => window.getComputedStyle(element).filter),
  ).resolves.toContain("blur(18px)");
  await expect(configuredContent).toHaveAttribute(
    "data-profile-canvas-module-frame",
    "inset",
  );
  await expect
    .poll(() =>
      configuredContent.evaluate(
        (element) => window.getComputedStyle(element).scale,
      ),
    )
    .not.toBe("none");
  await page.getByRole("button", { name: "Pin" }).click();
  const pinnedShell = page.locator(
    '[data-testid^="profile-canvas-module-"][data-profile-module-pinned="true"]',
  );
  await expect(pinnedShell).toBeVisible();
  await expect
    .poll(() =>
      pinnedShell.evaluate((element) => window.getComputedStyle(element).outlineWidth),
    )
    .toBe("2px");
  await page.getByTestId("profile-module-settings-done").click();
  await expect(page.getByTestId("profile-module-settings")).toHaveCount(0);
  await page.getByTestId("profile-canvas-save-button").click();
  await expect(page.getByTestId("profile-canvas-editor")).toHaveCount(0);

  await expect.poll(() => draftPayload?.canvasVersion).toBe(PROFILE_CANVAS_VERSION);
  await expect.poll(() => commitPayload).toBeDefined();
  const committedModules = commitPayload?.modules as Array<Record<string, unknown>>;
  const textModule = committedModules.find((module) => module.type === "text");

  expect(textModule).toMatchObject({
    config: {
      body: "Canvas note configured from settings.",
      configured: true,
    },
    layout: {
      column: 5,
      row: 4,
      colSpan: 3,
      rowSpan: 2,
    },
    pinned: true,
    visibility: "public",
  });
});

test("direct canvas selection examples adapt to tiny selections", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  await mockProfileModules(page, {
    authenticated: true,
    modules: [],
  });
  await acknowledgeCookieNotice(page);
  await page.goto("/@thia");

  await page.getByTestId("profile-edit-button").click();
  await page.getByTestId("profile-canvas-cell-6-4").click();

  await expect(page.getByTestId("profile-canvas-selection-preview")).toBeVisible();
  await expect(page.getByTestId("profile-canvas-selection-examples")).toBeVisible();
  await expect(
    page.getByTestId("profile-canvas-selection-example-uploaded_image"),
  ).toBeVisible();
  await expect(page.getByText("Fits 1x1")).toHaveCount(0);
  await expect
    .poll(() =>
      page.evaluate(() => {
        const preview = document.querySelector(
          '[data-testid="profile-canvas-selection-preview"]',
        );
        const examples = document.querySelector(
          '[data-testid="profile-canvas-selection-examples"]',
        );

        if (!preview || !examples) {
          return false;
        }

        const previewRect = preview.getBoundingClientRect();
        const examplesRect = examples.getBoundingClientRect();

        return (
          examplesRect.left >= previewRect.left - 1 &&
          examplesRect.right <= previewRect.right + 1 &&
          examplesRect.top >= previewRect.top - 1 &&
          examplesRect.bottom <= previewRect.bottom + 1
        );
      }),
    )
    .toBe(true);
});

test("direct canvas selection examples show empty state for unsupported exact sizes", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  await mockProfileModules(page, {
    authenticated: true,
    modules: [],
  });
  await acknowledgeCookieNotice(page);
  await page.goto("/@thia");

  await page.getByTestId("profile-edit-button").click();
  await page.getByTestId("profile-canvas-cell-5-10").click();
  await page.getByTestId("profile-canvas-cell-11-10").hover();

  await expect(page.getByTestId("profile-canvas-selection-preview")).toBeVisible();
  await expect(page.getByTestId("profile-canvas-selection-examples")).toBeVisible();
  await expect(page.getByTestId("profile-canvas-selection-examples-empty")).toBeVisible();
  await expect(page.getByTestId("profile-canvas-selection-example-music")).toHaveCount(
    0,
  );
});

test("direct canvas supports a 6x10 activity selection envelope", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1400 });
  await mockProfileModules(page, {
    authenticated: true,
    modules: [profileInfoModule()],
  });
  await acknowledgeCookieNotice(page);
  await page.goto("/@thia");

  await page.getByTestId("profile-edit-button").click();
  await page.getByTestId("profile-canvas-cell-1-4").click();
  await page.getByTestId("profile-canvas-cell-6-13").click();
  await expect(page.getByTestId("profile-module-picker")).toBeVisible();

  await page.getByRole("tab", { name: "Info" }).click();
  const activity = page.getByTestId("profile-module-picker-activity");

  await expect(activity).toBeEnabled();
  await expect(activity).toContainText("Full");
});

test("direct canvas keeps 4x6 activity blurred in editor and public after save", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  let commitPayload: Record<string, unknown> | undefined;

  await mockProfileModules(page, {
    authenticated: true,
    modules: [profileInfoModule()],
    profilePosts: [postFixture({ id: 44, body: "Fresh 4x6 activity item." })],
    onCanvasSave: (payload) => {
      commitPayload = payload;
    },
  });
  await acknowledgeCookieNotice(page);
  await page.goto("/@thia");

  await page.getByTestId("profile-edit-button").click();
  await page.getByTestId("profile-canvas-cell-1-4").click();
  await page.getByTestId("profile-canvas-cell-4-9").click();
  await page.getByRole("tab", { name: "Info" }).click();
  await page.getByTestId("profile-module-picker-activity").click();

  const activityContent = page.locator(
    '[data-testid^="profile-canvas-module-content-"]',
    { has: page.getByTestId("profile-activity") },
  );
  await expect(activityContent).toHaveAttribute(
    "data-profile-canvas-module-configured",
    "true",
  );
  await expect(
    activityContent.evaluate((element) => window.getComputedStyle(element).filter),
  ).resolves.toContain("blur(18px)");

  const settings = page.getByTestId("profile-module-settings");
  await expect(settings).toBeVisible();
  await settings.getByRole("button", { name: "Close activity" }).click();
  await expect(settings).toHaveCount(0);
  await page.getByTestId("profile-canvas-save-button").click();
  await expect(page.getByTestId("profile-canvas-editor")).toHaveCount(0);
  await expect.poll(() => commitPayload).toBeDefined();

  const committedModules = commitPayload?.modules as Array<Record<string, unknown>>;
  expect(committedModules.find((module) => module.type === "activity")).toMatchObject({
    config: {
      canvasSize: "4x6",
      configured: true,
    },
    layout: {
      column: 1,
      row: 4,
      colSpan: 4,
      rowSpan: 6,
    },
    visibility: "public",
  });
  await expect(page.getByTestId("profile-grid-module-activity")).toBeVisible();
  await expect(page.getByTestId("profile-module-activity")).toHaveAttribute(
    "data-profile-activity-surface",
    "public",
  );
  await expect(page.getByText("Fresh 4x6 activity item.")).toBeVisible();
});

test("direct canvas blocks new selections that overlap existing modules", async ({
  page,
}) => {
  await mockProfileModules(page, {
    authenticated: true,
    modules: [profileInfoModule()],
  });
  await acknowledgeCookieNotice(page);
  await page.goto("/@thia");

  await page.getByTestId("profile-edit-button").click();
  const startCell = page.getByTestId("profile-canvas-cell-1-4");
  const blockedEndCell = page.getByTestId("profile-canvas-cell-12-1");

  await startCell.click();
  await expect(startCell).toHaveClass(/border-focus/);
  await blockedEndCell.hover();
  await expect(page.getByTestId("profile-canvas-selection-preview")).toHaveCount(0);
  await expect(page.getByTestId("profile-canvas-selection-examples")).toHaveCount(0);
  await expect(startCell).toHaveClass(/border-rose/);
  await blockedEndCell.click();
  await expect(page.getByTestId("profile-module-picker")).toHaveCount(0);
  await expect(page.locator('[data-testid^="profile-canvas-blank-module-"]')).toHaveCount(0);
});

test("module picker blocks selections larger than designed module sizes", async ({
  page,
}) => {
  await mockProfileModules(page, {
    authenticated: true,
    modules: [],
  });
  await acknowledgeCookieNotice(page);
  await page.goto("/@thia");

  await page.getByTestId("profile-edit-button").click();
  await page.getByTestId("profile-canvas-cell-7-4").click();
  await page.getByTestId("profile-canvas-cell-12-9").click();
  await expect(page.getByTestId("profile-module-picker")).toBeVisible();

  const twitchChannel = page.getByTestId("profile-module-picker-twitch_channel");
  await expect(twitchChannel).toBeDisabled();
  await expect(twitchChannel).toContainText("Selection too large.");
  await expect(twitchChannel).toContainText("(8x6)");

  await page.getByRole("tab", { name: "Projects" }).click();
  const githubRepo = page.getByTestId("profile-module-picker-github_repo");
  await expect(githubRepo).toBeDisabled();
  await expect(githubRepo.getByTestId("connection-icon-github")).toBeVisible();
  await expect(githubRepo).toContainText("Repository");
  await expect(githubRepo).not.toContainText("GitHub repo");
  await expect(githubRepo).toContainText("Selection too large.");
  await expect(githubRepo).toContainText("(6x4)");

  await page.getByRole("tab", { name: "Music" }).click();
  const mp3Upload = page.getByTestId("profile-module-picker-music");
  await expect(mp3Upload).toHaveAttribute("aria-label", "MP3 music upload");
  await expect(mp3Upload.getByTestId("profile-module-picker-icon-music")).toBeVisible();
  await expect(mp3Upload).toContainText("MP3");

  const spotifySong = page.getByTestId("profile-module-picker-spotify_song");
  await expect(spotifySong.getByTestId("connection-icon-spotify")).toBeVisible();
  await expect(spotifySong).toContainText("Music");
  await expect(spotifySong).not.toContainText("Spotify song");

  const appleMusicSong = page.getByTestId("profile-module-picker-apple_music_song");
  await expect(appleMusicSong.getByTestId("connection-icon-apple_music")).toBeVisible();
  await expect(appleMusicSong).toContainText("Music");
  await expect(appleMusicSong).not.toContainText("Apple Music song");

  const youtubeMusicPlaylist = page.getByTestId(
    "profile-module-picker-youtube_music_playlist",
  );
  await expect(youtubeMusicPlaylist.getByTestId("connection-icon-youtube")).toBeVisible();
  await expect(youtubeMusicPlaylist).toContainText("Playlist");
  await expect(youtubeMusicPlaylist).not.toContainText("YouTube Music playlist");
});

test("module picker creates MP3 upload music modules", async ({ page }) => {
  let draftPayload: Record<string, unknown> | undefined;
  const uploadPurposes: string[] = [];

  await mockMediaMetadata(page);
  await mockProfileModules(page, {
    authenticated: true,
    modules: [],
    onCanvasDraftSave: (payload) => {
      draftPayload = payload;
    },
    onAudioUpload: (purpose) => {
      uploadPurposes.push(purpose);
    },
  });
  await acknowledgeCookieNotice(page);
  await page.goto("/@thia");

  await page.getByTestId("profile-edit-button").click();
  await page.getByTestId("profile-canvas-cell-5-4").click();
  await page.getByTestId("profile-canvas-cell-7-5").click();
  await page.getByRole("tab", { name: "Music" }).click();

  const mp3Upload = page.getByTestId("profile-module-picker-music");
  await expect(mp3Upload).toBeEnabled();
  await expect(mp3Upload).toContainText("MP3");
  await mp3Upload.click();

  const settings = page.getByTestId("profile-module-settings");
  await expect(settings.getByTestId("profile-audio-module-settings")).toBeVisible();
  await expect(settings.getByTestId("profile-module-settings-url")).toHaveCount(0);
  await expect
    .poll(() => {
      const modules = Array.isArray(draftPayload?.modules)
        ? (draftPayload.modules as Array<Record<string, unknown>>)
        : [];
      const music = modules.find((module) => module.type === "music");
      const config =
        music?.config && typeof music.config === "object"
          ? (music.config as Record<string, unknown>)
          : undefined;

      return JSON.stringify({
        configured: config?.configured,
        platform: config?.platform,
        sourceMode: config?.sourceMode,
        type: music?.type,
      });
    })
    .toBe(
      JSON.stringify({
        configured: false,
        platform: "custom",
        sourceMode: "upload",
        type: "music",
      }),
    );

  await settings
    .getByTestId("profile-module-settings-audio-input")
    .setInputFiles(sampleMp3File("custom-track.mp3"));
  await expect.poll(() => uploadPurposes.includes("profile_music")).toBe(true);
  await expect(settings.getByTestId("profile-module-audio-preview")).toBeVisible();
  await expect(page.getByTestId("profile-uploaded-audio-player")).toBeVisible();
  await expect
    .poll(() => {
      const modules = Array.isArray(draftPayload?.modules)
        ? (draftPayload.modules as Array<Record<string, unknown>>)
        : [];
      const music = modules.find((module) => module.type === "music");
      const config =
        music?.config && typeof music.config === "object"
          ? (music.config as Record<string, unknown>)
          : undefined;

      return config?.audio;
    })
    .toMatchObject({
      mime: "audio/mpeg",
      title: "custom track",
      url: "/uploads/media/2026/06/profile_music-track.mp3",
    });
});

test("authenticated integrations hide the connect prompt in module settings", async ({
  page,
}) => {
  await mockProfileModules(page, {
    authenticated: true,
    modules: [],
    integrations: {
      providers: [
        {
          provider: "github",
          configured: true,
          oauthEnabled: true,
          linkSupported: true,
          metadataEnabled: true,
          missingConfigKeys: [],
        },
      ],
      accounts: [
        {
          provider: "github",
          providerAccountId: "thiabun",
          providerHandle: "thiabun",
          displayName: "thiabun",
          avatarUrl: null,
          scopes: ["read:user"],
          tokenExpiresAt: null,
          connectedAt: "2026-06-17T00:00:00Z",
          refreshedAt: null,
          revokedAt: null,
          lastError: null,
          errorAt: null,
        },
      ],
    },
  });
  await acknowledgeCookieNotice(page);
  await page.goto("/@thia");

  await page.getByTestId("profile-edit-button").click();
  await page.getByTestId("profile-canvas-cell-1-4").click();
  await page.getByTestId("profile-canvas-cell-3-5").click();
  await page.getByRole("tab", { name: "Projects" }).click();
  await page.getByTestId("profile-module-picker-github_repo").click();

  const settings = page.getByTestId("profile-module-settings");
  await expect(settings).toBeVisible();
  await expect(settings.getByRole("button", { name: "Connect" })).toHaveCount(0);
  await expect(settings.getByTestId("profile-module-settings-url")).toBeVisible();
});

test("YouTube module settings prompt for provider connection", async ({ page }) => {
  let oauthStartPayload: Record<string, unknown> | undefined;
  await mockProfileModules(page, {
    authenticated: true,
    modules: [],
    integrations: {
      providers: [
        {
          provider: "youtube",
          configured: true,
          oauthEnabled: true,
          linkSupported: true,
          metadataEnabled: true,
          missingConfigKeys: [],
        },
      ],
      accounts: [],
    },
  });
  await page.route("**/api/me/integrations/youtube/start", async (route) => {
    oauthStartPayload = (await route.request().postDataJSON()) as Record<
      string,
      unknown
    >;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: {
          provider: "youtube",
          authorizationUrl: "",
          stateExpiresIn: 600,
        },
      }),
    });
  });
  await acknowledgeCookieNotice(page);
  await page.goto("/@thia");

  await page.getByTestId("profile-edit-button").click();
  await page.getByTestId("profile-canvas-cell-1-4").click();
  await page.getByTestId("profile-canvas-cell-4-6").click();
  await page.getByTestId("profile-module-picker-youtube_video").click();

  const settings = page.getByTestId("profile-module-settings");
  await expect(settings).toBeVisible();
  await expect(settings).toContainText("Connect YouTube");
  await expect(settings.getByTestId("profile-integration-connect-youtube")).toBeVisible();
  await expect(settings.getByTestId("profile-module-settings-url")).toBeVisible();

  await settings.getByTestId("profile-integration-connect-youtube").click();
  await expect
    .poll(() => oauthStartPayload?.redirectPath)
    .toBe("/@thia?editCanvas=1");
  expect(readFileSync("src/pages/ProfilePage.tsx", "utf8")).toContain(
    'if (type.startsWith("youtube_"))',
  );
});

test("connected integrations seed Connections links and Twitch stream modules", async ({
  page,
}) => {
  let draftPayload: Record<string, unknown> | undefined;

  await mockProfileModules(page, {
    authenticated: true,
    modules: [
      {
        ...linksModule({ id: 9, links: [] }),
        type: "connections",
        layout: { column: 1, row: 5, colSpan: 3, rowSpan: 2 },
      },
    ],
    integrations: {
      providers: [
        {
          provider: "twitch",
          configured: true,
          oauthEnabled: true,
          linkSupported: true,
          metadataEnabled: true,
          missingConfigKeys: [],
        },
      ],
      accounts: [
        {
          provider: "twitch",
          providerAccountId: "123",
          providerHandle: "thiabun",
          displayName: "Thia",
          avatarUrl: null,
          scopes: ["user:read:email"],
          tokenExpiresAt: null,
          connectedAt: "2026-06-17T00:00:00Z",
          refreshedAt: null,
          revokedAt: null,
          lastError: null,
          errorAt: null,
        },
      ],
    },
    onCanvasDraftSave: (payload) => {
      draftPayload = payload;
    },
  });
  await acknowledgeCookieNotice(page);
  await page.goto("/@thia");

  await page.getByTestId("profile-edit-button").click();

  await expect
    .poll(() => {
      const modules = Array.isArray(draftPayload?.modules)
        ? (draftPayload.modules as Array<Record<string, unknown>>)
        : [];
      const connections = modules.find((module) => module.type === "connections");
      const config = connections?.config as Record<string, unknown> | undefined;
      const links = Array.isArray(config?.links)
        ? (config.links as Array<Record<string, unknown>>)
        : [];

      return links.map((link) => link.url).join("|");
    })
    .toContain("https://www.twitch.tv/thiabun");

  await page.getByTestId("profile-canvas-cell-1-10").click();
  await page.getByTestId("profile-canvas-cell-8-15").click();
  if (!(await page.getByTestId("profile-module-picker").isVisible())) {
    const closeBlankSettings = page.getByRole("button", {
      name: "Close blank module",
    });
    if (await closeBlankSettings.isVisible()) {
      await closeBlankSettings.click();
    }
    const addBlankModule = page
      .locator('[data-testid^="profile-canvas-add-module-"]')
      .first();
    await expect(addBlankModule).toBeVisible();
    await addBlankModule.click();
  }
  const twitchChannel = page.getByTestId("profile-module-picker-twitch_channel");
  await expect(twitchChannel).toBeEnabled();
  await twitchChannel.click();

  const settings = page.getByTestId("profile-module-settings");
  await expect(settings).toBeVisible();
  await expect(settings.getByRole("button", { name: "Connect" })).toHaveCount(0);
  await expect(settings.getByTestId("profile-module-settings-url")).toHaveValue(
    "https://www.twitch.tv/thiabun",
  );

  await expect
    .poll(() => {
      const modules = Array.isArray(draftPayload?.modules)
        ? (draftPayload.modules as Array<Record<string, unknown>>)
        : [];
      const twitch = modules.find((module) => module.type === "twitch_channel");
      const config = twitch?.config as Record<string, unknown> | undefined;
      const layout = twitch?.layout as Record<string, unknown> | undefined;

      return JSON.stringify({
        displayMode: config?.displayMode,
        url: config?.url,
        colSpan: layout?.colSpan,
        rowSpan: layout?.rowSpan,
      });
    })
    .toContain(
      JSON.stringify({
        displayMode: "stream_chat",
        url: "https://www.twitch.tv/thiabun",
        colSpan: 8,
        rowSpan: 6,
      }).slice(1, -1),
    );
});

test("YouTube Music modules render working players across song sizes", async ({
  page,
}) => {
  const placements = [
    { column: 1, row: 4, size: "2x1" },
    { column: 4, row: 4, size: "2x2" },
    { column: 7, row: 4, size: "3x2" },
    { column: 1, row: 7, size: "4x2" },
    { column: 6, row: 7, size: "4x3" },
    { column: 1, row: 11, size: "4x4" },
  ];
  const modules = placements.map((placement, index) =>
    withAuditLayout(
      youtubeMusicEmbedModule({ id: 300 + index, position: index + 1 }),
      placement.size,
      placement.row,
      placement.column,
    ),
  );

  await mockProfileModules(page, {
    authenticated: false,
    modules,
  });
  await acknowledgeCookieNotice(page);
  await page.goto("/@thia");

  await expect(page.getByTestId("profile-youtube-music-player")).toHaveCount(
    placements.length,
  );

  for (const { size } of placements) {
    await expect(
      page.locator(`[data-profile-grid-size="${size}"]`).getByTestId(
        "profile-youtube-music-player",
      ),
    ).toBeVisible();
  }

  const firstPlayer = page.getByTestId("profile-youtube-music-player").first();
  await expect(page.getByTestId("profile-music-continue-overlay")).toBeVisible();
  await page.getByTestId("profile-music-continue-button").click();
  await expect
    .poll(() =>
      firstPlayer
        .locator('iframe[data-profile-embed-provider="youtube"]')
        .first()
        .getAttribute("src"),
    )
    .toContain("autoplay=1");
});

test("connections settings manage brand links as a compact list", async ({
  page,
}) => {
  let draftPayload: Record<string, unknown> | undefined;

  await mockProfileModules(page, {
    authenticated: true,
    modules: [
      {
        ...linksModule({
          id: 9,
          title: "Connections",
          links: [
            {
              label: "Twitch",
              platform: "twitch",
              url: "https://www.twitch.tv/thiabun",
            },
            {
              label: "Spotify",
              platform: "spotify",
              url: "https://open.spotify.com/user/thia",
            },
          ],
        }),
        type: "connections",
        layout: { column: 1, row: 5, colSpan: 3, rowSpan: 2 },
      },
    ],
    onCanvasDraftSave: (payload) => {
      draftPayload = payload;
    },
  });
  await acknowledgeCookieNotice(page);
  await page.goto("/@thia");

  await page.getByTestId("profile-edit-button").click();
  await page.getByTestId("profile-canvas-edit-module-9").click();

  const settings = page.getByTestId("profile-module-settings");
  await expect(settings).toBeVisible();
  await expect(settings.getByTestId("profile-connection-settings-list")).toBeVisible();
  await expect(settings.getByTestId("profile-connection-settings-row-0")).toContainText(
    "Twitch",
  );
  await expect(settings.getByTestId("profile-connection-settings-row-1")).toContainText(
    "Spotify",
  );

  await settings.getByTestId("profile-connection-add-open-button").click();
  await settings.getByTestId("profile-connection-platform-github").click();
  await settings.getByTestId("profile-connection-value-input").fill("thiabun");
  await settings.getByTestId("profile-connection-add-button").click();

  await expect(settings.getByTestId("profile-connection-settings-row-2")).toContainText(
    "GitHub",
  );
  await expect
    .poll(() => draftConnectionLinks(draftPayload).map((link) => link.url).join("|"))
    .toContain("https://github.com/thiabun");

  await settings.getByTestId("profile-connection-move-up-2").click();
  await settings.getByTestId("profile-connection-move-up-1").click();
  await expect(settings.getByTestId("profile-connection-settings-row-0")).toContainText(
    "GitHub",
  );
  await expect
    .poll(() => draftConnectionLinks(draftPayload).map((link) => link.platform).join("|"))
    .toBe("github|twitch|spotify");

  await settings.getByTestId("profile-connection-remove-1").click();
  await expect(settings.getByTestId("profile-connection-settings-row-1")).toContainText(
    "Spotify",
  );
  await expect
    .poll(() => draftConnectionLinks(draftPayload).map((link) => link.platform).join("|"))
    .toBe("github|spotify");
});

test("public and editor canvas shell scales wide and glass slider changes opacity", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await mockProfileModules(page, {
    authenticated: true,
    modules: [aboutModule({ id: 1, title: "About", body: "Wide canvas." })],
  });
  await acknowledgeCookieNotice(page);
  await page.goto("/@thia");

  const backdropBox = await page.getByTestId("profile-personal-backdrop").boundingBox();
  expect(backdropBox).not.toBeNull();
  expect(Math.round(backdropBox!.x)).toBe(0);
  expect(Math.round(backdropBox!.width)).toBe(1280);

  const publicGrid = page.getByTestId("profile-module-grid");
  const publicWidth1280 = await publicGrid.evaluate(
    (element) => element.getBoundingClientRect().width,
  );
  expect(publicWidth1280).toBeGreaterThanOrEqual(930);
  expect(publicWidth1280).toBeLessThanOrEqual(990);
  const publicMetrics1280 = await page.evaluate(() => {
    const shell = document.querySelector<HTMLElement>(".profile-canvas-page-shell");
    const grid = document.querySelector<HTMLElement>('[data-testid="profile-module-grid"]');

    if (!shell || !grid) {
      throw new Error("Profile canvas shell or grid did not render.");
    }

    const shellRect = shell.getBoundingClientRect();

    return {
      centerDelta: Math.abs(
        shellRect.left + shellRect.width / 2 - window.innerWidth / 2,
      ),
      contentScale: Number(grid.dataset.profileGridContentScale),
    };
  });
  expect(publicMetrics1280.centerDelta).toBeLessThanOrEqual(2);
  expect(publicMetrics1280.contentScale).toBeGreaterThanOrEqual(0.74);
  expect(publicMetrics1280.contentScale).toBeLessThan(1);

  await page.setViewportSize({ width: 1920, height: 1000 });
  await expect
    .poll(() =>
      publicGrid.evaluate((element) => element.getBoundingClientRect().width),
    )
    .toBeGreaterThan(1320);
  await expect
    .poll(() =>
      publicGrid.evaluate((element) =>
        Number(element.getAttribute("data-profile-grid-content-scale")),
      ),
    )
    .toBeGreaterThan(publicMetrics1280.contentScale);
  const publicMetrics1920 = await page.evaluate(() => {
    const shell = document.querySelector<HTMLElement>(".profile-canvas-page-shell");
    const grid = document.querySelector<HTMLElement>('[data-testid="profile-module-grid"]');

    if (!shell || !grid) {
      throw new Error("Profile canvas shell or grid did not render.");
    }

    const shellRect = shell.getBoundingClientRect();

    return {
      centerDelta: Math.abs(
        shellRect.left + shellRect.width / 2 - window.innerWidth / 2,
      ),
      contentScale: Number(grid.dataset.profileGridContentScale),
    };
  });
  expect(publicMetrics1920.centerDelta).toBeLessThanOrEqual(2);
  expect(publicMetrics1920.contentScale).toBeLessThanOrEqual(1.3);
  expect(publicMetrics1920.contentScale).toBeGreaterThan(
    publicMetrics1280.contentScale,
  );

  await page.getByTestId("profile-edit-button").click();
  const directGrid = page.getByTestId("profile-canvas-direct-grid");
  await expect(directGrid).toHaveAttribute("data-profile-canvas-glass", "58");
  const initialBackground = await directGrid.evaluate(
    (element) => window.getComputedStyle(element).backgroundColor,
  );
  const slider = page.getByTestId("profile-canvas-glass-slider");
  await slider.focus();
  await page.keyboard.press("End");
  await expect(directGrid).toHaveAttribute("data-profile-canvas-glass", "92");
  const clearBackground = await directGrid.evaluate(
    (element) => window.getComputedStyle(element).backgroundColor,
  );

  expect(clearBackground).not.toBe(initialBackground);
});

test("background popover stays within narrow viewport", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await mockProfileModules(page, {
    authenticated: true,
    modules: [aboutModule({ id: 1, title: "About", body: "Narrow popover." })],
  });
  await acknowledgeCookieNotice(page);
  await page.goto("/@thia");

  await page.getByTestId("profile-edit-button").click();
  await page.getByTestId("profile-canvas-background-trigger").click();

  const box = await page.getByTestId("profile-canvas-background-popover").boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(360);
  await expect(page.getByText("Clarity")).toBeVisible();
  await expect(page.getByText("Media and clarity")).toHaveCount(0);
});

test("direct canvas cancel discards an uncommitted draft module", async ({ page }) => {
  await mockProfileModules(page, {
    authenticated: true,
    modules: [],
  });
  await acknowledgeCookieNotice(page);
  await page.goto("/@thia");

  await page.getByTestId("profile-edit-button").click();
  await page.getByTestId("profile-canvas-cell-1-5").click();
  await page.getByTestId("profile-canvas-cell-2-6").click();
  await expect(page.locator('[data-testid^="profile-canvas-add-module-"]')).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByTestId("profile-canvas-editor")).toHaveCount(0);

  await page.getByTestId("profile-edit-button").click();
  await expect(page.locator('[data-testid^="profile-canvas-add-module-"]')).toHaveCount(0);
});

test("direct canvas commit drops unpicked placeholder envelopes", async ({ page }) => {
  let commitPayload: Record<string, unknown> | undefined;

  await mockProfileModules(page, {
    authenticated: true,
    modules: [],
    onCanvasSave: (payload) => {
      commitPayload = payload;
    },
  });
  await acknowledgeCookieNotice(page);
  await page.goto("/@thia");

  await page.getByTestId("profile-edit-button").click();
  await page.getByTestId("profile-canvas-cell-4-5").click();
  await page.getByTestId("profile-canvas-cell-5-6").click();
  await expect(page.getByTestId("profile-module-picker")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator('[data-testid^="profile-canvas-add-module-"]')).toBeVisible();
  await page.getByTestId("profile-canvas-save-button").click();

  await expect.poll(() => commitPayload).toBeDefined();
  const committedModules = commitPayload?.modules as Array<Record<string, unknown>>;
  expect(committedModules.some((module) => module.type === "placeholder")).toBe(false);
  expect(committedModules.map((module) => module.type)).toEqual(["profile_info"]);
});

test("blank draft modules can be pinned moved and deleted in the editor", async ({
  page,
}) => {
  let draftPayload: Record<string, unknown> | undefined;

  await mockProfileModules(page, {
    authenticated: true,
    modules: [],
    onCanvasDraftSave: (payload) => {
      draftPayload = payload;
    },
  });
  await acknowledgeCookieNotice(page);
  await page.goto("/@thia");

  await page.getByTestId("profile-edit-button").click();
  await page.getByTestId("profile-canvas-cell-4-6").click();
  await page.getByTestId("profile-canvas-cell-5-7").click();
  await expect(page.getByTestId("profile-module-picker")).toBeVisible();
  await page.keyboard.press("Escape");

  const blankModule = page.locator('[data-testid^="profile-canvas-blank-module-"]');
  await expect(blankModule).toBeVisible();
  await expect(page.locator('[data-testid^="profile-canvas-pin-placeholder-"]')).toBeVisible();
  await expect(
    page.locator('[data-testid^="profile-canvas-delete-placeholder-"]'),
  ).toBeVisible();

  await page.locator('[data-testid^="profile-canvas-pin-placeholder-"]').click();
  await expect(
    page.locator('[data-testid^="profile-canvas-module-"][data-profile-module-pinned="true"]'),
  ).toBeVisible();
  await expect
    .poll(() => placeholderDraftModule(draftPayload)?.pinned)
    .toBe(true);

  await page.locator('[data-testid^="profile-canvas-pin-placeholder-"]').click();
  await expect
    .poll(() => placeholderDraftModule(draftPayload)?.pinned)
    .toBe(false);

  const blankBox = await blankModule.boundingBox();
  const gridBox = await page.getByTestId("profile-canvas-direct-grid").boundingBox();

  if (!blankBox || !gridBox) {
    throw new Error("Blank placeholder or direct canvas grid did not render.");
  }

  const pointerStart = {
    button: 0,
    buttons: 1,
    clientX: blankBox.x + blankBox.width / 2,
    clientY: blankBox.y + blankBox.height / 2,
    pointerId: 7,
    pointerType: "mouse",
  };
  const pointerTarget = {
    ...pointerStart,
    clientX: Math.min(gridBox.x + gridBox.width - 8, pointerStart.clientX + blankBox.width),
    clientY: pointerStart.clientY,
  };

  await blankModule.dispatchEvent("pointerdown", pointerStart);
  await page.dispatchEvent("body", "pointermove", pointerTarget);
  await page.dispatchEvent("body", "pointerup", {
    ...pointerTarget,
    buttons: 0,
  });
  await expect
    .poll(() => {
      const layout = placeholderDraftModule(draftPayload)?.layout as
        | Record<string, unknown>
        | undefined;

      return Number(layout?.column ?? 4);
    })
    .toBeGreaterThan(4);

  await page.locator('[data-testid^="profile-canvas-delete-placeholder-"]').click();
  await expect(page.locator('[data-testid^="profile-canvas-blank-module-"]')).toHaveCount(0);
  await expect
    .poll(() => Boolean(placeholderDraftModule(draftPayload)))
    .toBe(false);
});

test("one-cell blank module keeps its add affordance inside the module", async ({
  page,
}) => {
  await mockProfileModules(page, {
    authenticated: true,
    modules: [],
  });
  await acknowledgeCookieNotice(page);
  await page.goto("/@thia");

  await page.getByTestId("profile-edit-button").click();
  await page.getByTestId("profile-canvas-cell-2-5").click();
  await page.getByTestId("profile-canvas-cell-2-5").click();

  const blankModule = page.locator('[data-testid^="profile-canvas-add-module-"]');
  await expect(blankModule).toBeVisible();
  await expect(blankModule).toContainText("Add");
  await expect(blankModule).not.toContainText("Click to add module");

  const overflows = await blankModule.evaluate((element) => {
    const bounds = element.getBoundingClientRect();

    return Array.from(element.querySelectorAll<HTMLElement>("span, svg"))
      .filter((child) => !child.classList.contains("sr-only"))
      .some((child) => {
        const childBounds = child.getBoundingClientRect();

        return (
          childBounds.width > 0 &&
          childBounds.height > 0 &&
          (childBounds.left < bounds.left - 1 ||
            childBounds.right > bounds.right + 1 ||
            childBounds.top < bounds.top - 1 ||
            childBounds.bottom > bounds.bottom + 1)
        );
      });
  });
  expect(overflows).toBe(false);
});

test("owner crops a profile background image before upload", async ({ page }) => {
  let uploadedPurpose: string | undefined;
  let savedProfilePayload: Record<string, unknown> | undefined;

  await mockProfileModules(page, {
    authenticated: true,
    modules: [aboutModule({ id: 1, title: "About", body: "Crop background." })],
    onImageUpload: (purpose) => {
      uploadedPurpose = purpose;
    },
    onProfileSave: (payload) => {
      savedProfilePayload = payload;
    },
  });
  await acknowledgeCookieNotice(page);
  await page.goto("/@thia");

  await page.getByTestId("profile-edit-button").click();
  await page.getByTestId("profile-canvas-background-trigger").click();
  const backgroundImageAccept = await page
    .getByTestId("profile-background-image-input")
    .getAttribute("accept");
  const backgroundVideoAccept = await page
    .getByTestId("profile-background-video-input")
    .getAttribute("accept");
  expect(backgroundImageAccept).toContain("image/avif");
  expect(backgroundImageAccept).toContain(".heic");
  expect(backgroundVideoAccept).toContain("video/quicktime");
  expect(backgroundVideoAccept).toContain(".mov");
  await page
    .getByTestId("profile-background-image-input")
    .setInputFiles(samplePngFile("profile-background.png"));

  await expect(page.getByTestId("image-crop-modal")).toBeVisible();
  await expect(page.getByText("Landscape crop")).toBeVisible();
  await expect(page.getByTestId("image-crop-aspect-square")).toHaveCount(0);

  const preview = page.getByTestId("image-crop-preview");
  const frame = page.getByTestId("image-crop-frame");
  await expect(preview).toBeVisible();
  const frameBox = await frame.boundingBox();
  expect(frameBox).not.toBeNull();
  expect(frameBox!.width).toBeLessThanOrEqual(580);
  const beforeZoomBox = await preview.boundingBox();
  expect(beforeZoomBox).not.toBeNull();
  await page.getByTestId("image-crop-zoom").fill("1.6");
  const afterZoomBox = await preview.boundingBox();
  expect(afterZoomBox).not.toBeNull();
  expect(afterZoomBox!.width).toBeGreaterThan(beforeZoomBox!.width);
  const dragStart = {
    x: frameBox!.x + frameBox!.width / 2,
    y: frameBox!.y + frameBox!.height / 2,
  };
  await page.mouse.move(dragStart.x, dragStart.y);
  await page.mouse.down();
  await page.mouse.move(dragStart.x + 24, dragStart.y);
  await page.mouse.up();
  const afterDragBox = await preview.boundingBox();
  expect(afterDragBox).not.toBeNull();
  expect(Math.round(afterDragBox!.x)).not.toBe(Math.round(afterZoomBox!.x));

  await page.getByRole("button", { name: "Apply crop" }).click();
  await expect(page.getByTestId("image-crop-modal")).toHaveCount(0);
  expect(uploadedPurpose).toBe("profile_background");
  await expect(
    page
      .getByTestId("profile-personal-backdrop")
      .locator('img[src="/uploads/media/2026/06/profile_background-cropped.webp"]'),
  ).toBeVisible();
  await expect
    .poll(() => savedProfilePayload?.profileBackground)
    .toBe("/uploads/media/2026/06/profile_background-cropped.webp");

  await page.reload();
  await expect(
    page
      .getByTestId("profile-personal-backdrop")
      .locator('img[src="/uploads/media/2026/06/profile_background-cropped.webp"]'),
  ).toBeVisible();
});

test("profile-info settings change picture and banner through crop controls", async ({
  page,
}) => {
  const uploadPurposes: string[] = [];
  let savedProfilePayload: Record<string, unknown> | undefined;

  await mockProfileModules(page, {
    authenticated: true,
    modules: [
      {
        ...profileInfoModule(),
        layout: { column: 3, row: 1, colSpan: 8, rowSpan: 3 },
        pinned: true,
      },
    ],
    onImageUpload: (purpose) => {
      uploadPurposes.push(purpose);
    },
    onProfileSave: (payload) => {
      savedProfilePayload = payload;
    },
  });
  await acknowledgeCookieNotice(page);
  await page.goto("/@thia");

  await page.getByTestId("profile-edit-button").click();
  await page.getByTestId("profile-canvas-edit-module-9001").click();

  const settings = page.getByTestId("profile-module-settings");
  await expect(settings.getByTestId("profile-info-media-settings")).toBeVisible();
  await settings
    .getByTestId("profile-info-modal-avatar-input")
    .setInputFiles(samplePngFile("profile-avatar.png"));

  await expect(page.getByTestId("image-crop-modal")).toBeVisible();
  await expect(page.getByText("Square crop")).toBeVisible();
  await page.getByRole("button", { name: "Apply crop" }).click();
  await expect(page.getByTestId("image-crop-modal")).toHaveCount(0);
  await expect.poll(() => uploadPurposes.at(-1)).toBe("avatar");
  await expect
    .poll(() => savedProfilePayload?.avatarUrl)
    .toBe("/uploads/media/2026/06/avatar-cropped.webp");
  await expect(
    settings.locator('img[src="/uploads/media/2026/06/avatar-cropped.webp"]'),
  ).toBeVisible();

  await settings
    .getByTestId("profile-info-modal-banner-input")
    .setInputFiles(samplePngFile("profile-banner.png"));

  await expect(page.getByTestId("image-crop-modal")).toBeVisible();
  await expect(page.getByText("Wide crop")).toBeVisible();
  await page.getByRole("button", { name: "Apply crop" }).click();
  await expect(page.getByTestId("image-crop-modal")).toHaveCount(0);
  await expect.poll(() => uploadPurposes.at(-1)).toBe("banner");
  await expect
    .poll(() => savedProfilePayload?.bannerUrl)
    .toBe("/uploads/media/2026/06/banner-cropped.webp");
  await expect(
    settings.locator('img[src="/uploads/media/2026/06/banner-cropped.webp"]'),
  ).toBeVisible();
  await expect(settings.getByTestId("profile-info-preview-banner")).toHaveAttribute(
    "data-profile-banner-treatment",
    "cover",
  );
  await expect(settings.getByTestId("profile-info-preview-banner-image")).toHaveCSS(
    "object-fit",
    "cover",
  );
});

test("image module settings crop and add multiple photos", async ({ page }) => {
  const uploadPurposes: string[] = [];
  let draftPayload: Record<string, unknown> | undefined;

  await mockProfileModules(page, {
    authenticated: true,
    modules: [
      {
        id: 12,
        type: "uploaded_image",
        title: "Photos",
        config: { configured: false, mediaItems: [] },
        layout: { column: 1, row: 4, colSpan: 3, rowSpan: 3 },
        visibility: "draft",
        position: 1,
        status: "active",
        schemaVersion: 1,
        createdAt: "2026-06-12 00:00:00",
        updatedAt: "2026-06-12 00:00:00",
      },
    ],
    onCanvasDraftSave: (payload) => {
      draftPayload = payload;
    },
    onImageUpload: (purpose) => {
      uploadPurposes.push(purpose);
    },
  });
  await acknowledgeCookieNotice(page);
  await page.goto("/@thia");

  await page.getByTestId("profile-edit-button").click();
  await page.getByTestId("profile-canvas-edit-module-12").click();

  const settings = page.getByTestId("profile-module-settings");
  await expect(settings.getByTestId("profile-image-module-settings")).toBeVisible();
  await settings
    .getByTestId("profile-module-settings-image-input")
    .setInputFiles([
      samplePngFile("module-photo-one.png"),
      samplePngFile("module-photo-two.png"),
    ]);

  await expect(page.getByTestId("image-crop-modal")).toBeVisible();
  await expect(page.getByTestId("image-crop-aspect-original")).toBeVisible();
  await page.getByRole("button", { name: "Apply crop" }).click();
  await expect.poll(() => uploadPurposes.length).toBe(1);
  await expect(page.getByTestId("image-crop-modal")).toBeVisible();
  await page.getByRole("button", { name: "Apply crop" }).click();
  await expect(page.getByTestId("image-crop-modal")).toHaveCount(0);
  await expect.poll(() => uploadPurposes).toEqual(["post_media", "post_media"]);

  await expect(settings.getByTestId("profile-module-media-item-0")).toBeVisible();
  await expect(settings.getByTestId("profile-module-media-item-1")).toBeVisible();
  await expect
    .poll(() => {
      const modules = Array.isArray(draftPayload?.modules)
        ? (draftPayload.modules as Array<Record<string, unknown>>)
        : [];
      const imageModule = modules.find((module) => module.id === 12);
      const config = imageModule?.config as Record<string, unknown> | undefined;
      const mediaItems = Array.isArray(config?.mediaItems)
        ? config.mediaItems
        : [];

      return JSON.stringify({
        configured: config?.configured,
        mediaCount: mediaItems.length,
      });
    })
    .toBe(JSON.stringify({ configured: true, mediaCount: 2 }));
});

test("uploaded video and custom MP3 module settings use file uploads", async ({
  page,
}) => {
  const uploadPurposes: string[] = [];
  let draftPayload: Record<string, unknown> | undefined;

  await mockMediaMetadata(page);
  await mockProfileModules(page, {
    authenticated: true,
    modules: [
      {
        id: 21,
        type: "uploaded_video",
        title: "Video",
        config: { configured: false, sourceMode: "upload" },
        layout: { column: 1, row: 4, colSpan: 4, rowSpan: 3 },
        visibility: "draft",
        position: 1,
        status: "active",
        schemaVersion: 1,
        createdAt: "2026-06-12 00:00:00",
        updatedAt: "2026-06-12 00:00:00",
      },
      {
        id: 22,
        type: "music",
        title: "Music",
        config: { configured: false, sourceMode: "upload" },
        layout: { column: 5, row: 4, colSpan: 3, rowSpan: 2 },
        visibility: "draft",
        position: 2,
        status: "active",
        schemaVersion: 1,
        createdAt: "2026-06-12 00:00:00",
        updatedAt: "2026-06-12 00:00:00",
      },
    ],
    onCanvasDraftSave: (payload) => {
      draftPayload = payload;
    },
    onVideoUpload: (purpose) => {
      uploadPurposes.push(purpose);
    },
    onAudioUpload: (purpose) => {
      uploadPurposes.push(purpose);
    },
  });
  await acknowledgeCookieNotice(page);
  await page.goto("/@thia");

  await page.getByTestId("profile-edit-button").click();
  await page.getByTestId("profile-canvas-edit-module-21").click();

  const videoSettings = page.getByTestId("profile-module-settings");
  await expect(videoSettings.getByTestId("profile-video-module-settings")).toBeVisible();
  await expect(videoSettings.getByTestId("profile-module-settings-url")).toHaveCount(0);
  const videoAccept = await videoSettings
    .getByTestId("profile-module-settings-video-input")
    .getAttribute("accept");
  expect(videoAccept).toContain("video/quicktime");
  expect(videoAccept).toContain(".mov");
  expect(videoAccept).toContain(".mkv");
  expect(videoAccept).toContain(".3gp");
  await videoSettings
    .getByTestId("profile-module-settings-video-input")
    .setInputFiles(sampleMp4File("launch-clip.mp4"));
  await expect.poll(() => uploadPurposes.includes("profile_module_video")).toBe(true);
  await expect(videoSettings.getByTestId("profile-module-video-preview")).toBeVisible();
  await expect
    .poll(() => moduleConfigFromDraft(draftPayload, 21)?.video)
    .toMatchObject({
      url: "/uploads/media/2026/06/profile_module_video-clip.mp4",
      mime: "video/mp4",
      title: "launch clip",
    });

  await videoSettings.getByTestId("profile-module-settings-done").click();
  await page.getByTestId("profile-canvas-edit-module-22").click();

  const musicSettings = page.getByTestId("profile-module-settings");
  await expect(musicSettings.getByTestId("profile-audio-module-settings")).toBeVisible();
  await expect(musicSettings.getByTestId("profile-module-settings-url")).toHaveCount(0);
  await musicSettings
    .getByTestId("profile-module-settings-audio-input")
    .setInputFiles(sampleMp3File("custom-track.mp3"));
  await expect.poll(() => uploadPurposes.includes("profile_music")).toBe(true);
  await expect(musicSettings.getByTestId("profile-module-audio-preview")).toBeVisible();
  await expect
    .poll(() => moduleConfigFromDraft(draftPayload, 22)?.audio)
    .toMatchObject({
      url: "/uploads/media/2026/06/profile_music-track.mp3",
      mime: "audio/mpeg",
      title: "custom track",
    });
});

test("image crop modal is wired to current image upload surfaces", () => {
  const cropModal = readFileSync("src/components/ui/ImageCropModal.tsx", "utf8");
  const profilePage = readFileSync("src/pages/ProfilePage.tsx", "utf8");
  const postComposer = readFileSync(
    "src/components/social/PostComposerModal.tsx",
    "utf8",
  );
  const postCard = readFileSync("src/components/social/PostCard.tsx", "utf8");
  const roomEditor = readFileSync(
    "src/components/social/RoomEditModal.tsx",
    "utf8",
  );

  for (const purpose of [
    "avatar",
    "banner",
    "profile_background",
    "post_media",
    "room_icon",
    "room_banner",
  ]) {
    expect(cropModal).toContain(purpose);
  }

  for (const source of [profilePage, postComposer, postCard, roomEditor]) {
    expect(source).toContain("ImageCropModal");
    expect(source).toContain("validateImageCropFile");
    expect(source).toContain("imageUploadAccept");
  }

  expect(readFileSync("src/lib/mediaFormats.ts", "utf8")).toContain("image/heic");
  expect(readFileSync("src/lib/mediaFormats.ts", "utf8")).toContain("video/quicktime");
});

test("low-resolution desktop uses compact direct canvas chrome", async ({ page }) => {
  await page.setViewportSize({ width: 1080, height: 720 });
  await mockProfileModules(page, {
    authenticated: true,
    modules: [
      aboutModule({ id: 1, title: "About", body: "Compact editor." }),
      linksModule({ id: 2, title: "Links" }),
    ],
  });
  await acknowledgeCookieNotice(page);
  await page.goto("/@thia");

  await page.getByTestId("profile-edit-button").click();

  const editor = page.getByTestId("profile-canvas-editor");
  await expect(editor).toBeVisible();
  await expectGridColumnCount(page.getByTestId("profile-canvas-direct-grid"), PROFILE_CANVAS_COLUMNS);

  const metrics = await page.evaluate(() => {
    const editorElement = document.querySelector<HTMLElement>(
      '[data-testid="profile-canvas-editor"]',
    );
    const gridElement = document.querySelector<HTMLElement>(
      '[data-testid="profile-canvas-direct-grid"]',
    );

    if (!editorElement || !gridElement) {
      throw new Error("Editor or profile grid did not render.");
    }

    const editorRect = editorElement.getBoundingClientRect();
    const gridRect = gridElement.getBoundingClientRect();

    return {
      editorBottom: Math.round(editorRect.bottom),
      gridTop: Math.round(gridRect.top),
      hasHorizontalOverflow:
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth,
    };
  });

  expect(metrics.editorBottom).toBeGreaterThan(0);
  expect(metrics.gridTop).toBeGreaterThan(0);
  expect(metrics.hasHorizontalOverflow).toBe(false);
});

test("mobile direct canvas editor uses a 6 by 32 point grid", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  let draftPayload: Record<string, unknown> | undefined;
  await mockProfileModules(page, {
    authenticated: true,
    modules: [],
    onCanvasDraftSave: (payload) => {
      draftPayload = payload;
    },
  });
  await acknowledgeCookieNotice(page);
  await page.goto("/@thia");

  await page.getByTestId("profile-edit-button").click();

  const grid = page.getByTestId("profile-canvas-direct-grid");
  await expect(grid).toBeVisible();
  await expect(grid).toHaveAttribute(
    "data-profile-canvas-columns",
    String(PROFILE_CANVAS_MOBILE_COLUMNS),
  );
  await expect(grid).toHaveAttribute(
    "data-profile-canvas-rows",
    String(PROFILE_CANVAS_MOBILE_ROWS),
  );
  await expectGridColumnCount(grid, PROFILE_CANVAS_MOBILE_COLUMNS);
  await expect(page.getByTestId("profile-canvas-cell-6-32")).toBeVisible();
  await expect(page.getByTestId("profile-canvas-cell-7-1")).toHaveCount(0);

  await page.getByTestId("profile-canvas-cell-1-5").click();
  await page.getByTestId("profile-canvas-cell-2-5").click();
  await expect(page.locator('[data-testid^="profile-canvas-blank-module-"]')).toBeVisible();
  await expect
    .poll(() => {
      const layout = placeholderDraftModule(draftPayload)?.layout as
        | Record<string, unknown>
        | undefined;

      return `${layout?.column}:${layout?.row}:${layout?.colSpan}:${layout?.rowSpan}`;
    })
    .toBe("1:3:2:1");
});

test("mobile canvas packs profile info first and activity last", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockProfileModules(page, {
    authenticated: false,
    modules: [
      withAuditLayout(activityModule({ id: 9, position: 1 }), "3x4", 1),
      withAuditLayout(
        textModule({ id: 2, body: "Middle note.", position: 2 }),
        "3x2",
        5,
      ),
      withAuditLayout(
        {
          ...profileInfoModule(),
          position: 3,
        },
        "8x3",
        8,
        3,
      ),
    ],
    profilePosts: [postFixture({ id: 77, body: "A compact activity item." })],
  });
  await acknowledgeCookieNotice(page);
  await page.goto("/@thia");

  const grid = page.getByTestId("profile-module-grid");
  await expectGridColumnCount(grid, PROFILE_CANVAS_MOBILE_COLUMNS);
  const order = await grid.evaluate((element) =>
    Array.from(
      element.querySelectorAll<HTMLElement>('[data-profile-grid-module="true"]'),
    ).map((module) => module.getAttribute("data-testid")),
  );

  expect(order[0]).toBe("profile-grid-module-profile_info");
  expect(order.at(-1)).toBe("profile-grid-module-activity");
});

test("mobile profile info projection keeps content close to the banner", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockProfileModules(page, {
    authenticated: false,
    profileOverrides: {
      bannerUrl: "/uploads/media/2026/06/profile-banner.webp",
      bio: "The queen, owner and creator of thia.lol",
    },
    modules: [
      withAuditLayout(
        {
          ...profileInfoModule(),
          position: 1,
        },
        "8x3",
        1,
        3,
      ),
    ],
  });
  await acknowledgeCookieNotice(page);
  await page.goto("/@thia");

  const module = page.getByTestId("profile-grid-module-profile_info");
  const info = module.getByTestId("profile-module-profile-info");
  await expect(module).toHaveAttribute("data-profile-grid-size", "8x3");
  await expect(info).toHaveAttribute("data-profile-info-mobile-projection", "true");
  await expect(info).toHaveAttribute("data-profile-info-columns", "6");
  await expect(info).toHaveAttribute("data-profile-info-rows", "4");
  await expect(module.getByTestId("profile-header")).toHaveAttribute(
    "data-profile-info-mobile-projection",
    "true",
  );

  const metrics = await module.evaluate((element) => {
    const banner = element.querySelector<HTMLElement>(
      '[data-testid="profile-header-banner"]',
    );
    const avatar = element.querySelector<HTMLElement>(
      '[data-testid="profile-info-avatar-frame"]',
    );
    const content = element.querySelector<HTMLElement>(
      '[data-testid="profile-info-content-cluster"]',
    );
    const bio = element.querySelector<HTMLElement>('[data-testid="profile-bio"]');

    if (!banner || !avatar || !content || !bio) {
      throw new Error("Expected mobile profile info pieces to render.");
    }

    const moduleRect = element.getBoundingClientRect();
    const bannerRect = banner.getBoundingClientRect();
    const avatarRect = avatar.getBoundingClientRect();
    const contentRect = content.getBoundingClientRect();
    const bioRect = bio.getBoundingClientRect();

    return {
      avatarBottom: avatarRect.bottom,
      avatarTop: avatarRect.top,
      bannerBottom: bannerRect.bottom,
      bannerHeight: bannerRect.height,
      bioBottom: bioRect.bottom,
      contentBottom: contentRect.bottom,
      contentGapFromBanner: contentRect.top - bannerRect.bottom,
      moduleBottom: moduleRect.bottom,
      moduleHeight: moduleRect.height,
    };
  });

  expect(metrics.bannerHeight).toBeGreaterThan(metrics.moduleHeight * 0.18);
  expect(metrics.bannerHeight).toBeLessThan(metrics.moduleHeight * 0.36);
  expect(metrics.avatarTop).toBeLessThan(metrics.bannerBottom);
  expect(metrics.avatarBottom).toBeGreaterThan(metrics.bannerBottom);
  expect(metrics.contentGapFromBanner).toBeLessThan(metrics.moduleHeight * 0.18);
  expect(metrics.contentBottom).toBeLessThanOrEqual(metrics.moduleBottom + 1);
  expect(metrics.bioBottom).toBeLessThanOrEqual(metrics.moduleBottom + 1);
});

test.skip("obsolete profile details panel autosave coverage", async ({ page }) => {
  let savedProfile: Record<string, unknown> | undefined;
  const multilineBio = "Edited inside the profile editor.\nWith a second line.";

  await mockProfileModules(page, {
    authenticated: true,
    modules: [],
    onProfileSave: (payload) => {
      savedProfile = payload;
    },
  });
  await acknowledgeCookieNotice(page);
  await page.goto("/@thia");

  await page.getByTestId("profile-edit-button").click();
  await expect(page.getByTestId("profile-editor")).toBeVisible();
  await expect(page.getByTestId("profile-selected-module-popover")).toHaveCount(0);

  await page.getByTestId("profile-info-display-name-input").fill("Thia Canvas");
  await page.getByTestId("profile-info-bio-input").fill(multilineBio);
  await expect(page.getByTestId("profile-info-autosave-status")).toContainText(
    /Profile edits save automatically|Saving profile|Profile saved/,
  );
  await expect
    .poll(() => savedProfile)
    .toMatchObject({
      displayName: "Thia Canvas",
      bio: multilineBio,
    });
  await expect(page.getByTestId("profile-info-autosave-status")).toContainText(
    "Profile saved.",
  );

  await expect(page.getByTestId("profile-bio")).toHaveText(multilineBio);
  expect(savedProfile).toMatchObject({
    displayName: "Thia Canvas",
    bio: multilineBio,
  });
  const bioWhiteSpace = await page
    .getByTestId("profile-bio")
    .evaluate((element) => window.getComputedStyle(element).whiteSpace);
  expect(bioWhiteSpace).toBe("pre-wrap");
});

test.skip("obsolete blank profile details panel coverage", async ({ page }) => {
  await mockProfileModules(page, {
    authenticated: true,
    profileOverrides: {
      user: {
        id: 1,
        handle: "thia",
        displayName: "Thia",
        initials: "T",
        aura: "frost",
        avatarUrl: null,
      },
      bio: "",
      location: "",
      bannerUrl: null,
    },
    modules: [],
  });
  await acknowledgeCookieNotice(page);
  await page.goto("/@thia");

  await page.getByTestId("profile-edit-button").click();

  await expect(page.getByTestId("profile-editor")).toBeVisible();
  await expect(
    page.getByText("Edit the profile identity and media shown publicly."),
  ).toBeVisible();
  await expect(page.getByTestId("profile-selected-module-popover")).toHaveCount(0);
  await expect(page.getByTestId("profile-info-display-name-input")).toBeVisible();
  await expect(page.getByTestId("profile-info-bio-input")).toBeVisible();
});

test.skip("retired canvas size controls stay backend-only during transition", async ({ page }) => {
  let savedPayload: Record<string, unknown> | undefined;

  await mockProfileModules(page, {
    authenticated: true,
    modules: [
      {
        ...profileInfoModule(),
        layout: { column: 1, row: 1, colSpan: 3, rowSpan: 3 },
      },
      {
        ...activityModule({ id: 9, position: 2 }),
        layout: { column: 4, row: 1, colSpan: 3, rowSpan: 3 },
      },
    ],
    onCanvasSave: (payload) => {
      savedPayload = payload;
    },
  });
  await acknowledgeCookieNotice(page);
  await page.goto("/@thia");

  await page.getByTestId("profile-canvas-edit-button").click();
  await page.getByTestId("profile-grid-module-profile_info").click();
  const profileInfoEdit = page
    .getByTestId("profile-grid-module-profile_info")
    .getByTestId("profile-selected-module-controls");
  await expect(page.getByTestId("profile-selected-module-popover")).toBeVisible();
  await expect(profileInfoEdit.getByText("Full", { exact: true })).toBeVisible();
  await expect(profileInfoEdit.getByText("6 x 3", { exact: true })).toHaveCount(0);
  await expect(profileInfoEdit.getByTestId("profile-canvas-size-4x3")).toBeVisible();
  await profileInfoEdit.getByTestId("profile-canvas-size-6x3").click();

  await page.getByTestId("profile-grid-module-activity").click();
  const activityEdit = page
    .getByTestId("profile-grid-module-activity")
    .getByTestId("profile-selected-module-controls");
  await expect(activityEdit.getByText("Full", { exact: true })).toBeVisible();
  await expect(activityEdit.getByText("3 x 6", { exact: true })).toHaveCount(0);
  await expect(activityEdit.getByTestId("profile-canvas-size-3x4")).toBeVisible();
  await activityEdit.getByTestId("profile-canvas-size-6x10").click();
  await page.getByTestId("profile-canvas-save-button").click();
  await expect(page.getByTestId("profile-canvas-editor")).toHaveCount(0);
  await expect.poll(() => savedPayload).toBeDefined();

  const savedModules = savedPayload?.modules as Array<Record<string, unknown>>;
  expect(savedModules.find((module) => module.id === 9001)).toMatchObject({
    colSpan: 6,
    rowSpan: 3,
  });
  expect(savedModules.find((module) => module.id === 9)).toMatchObject({
    colSpan: 6,
    rowSpan: 10,
  });
});

test.skip("retired module content popovers stay backend-only during transition", async ({ page }) => {
  let updatedLinks: Array<Record<string, unknown>> = [];
  let savedPayload: Record<string, unknown> | undefined;

  await mockProfileModules(page, {
    authenticated: true,
    modules: [
      {
        ...linksModule({ id: 2, title: "Connections", position: 2, links: [] }),
        layout: { column: 1, row: 2, colSpan: 2, rowSpan: 1 },
      },
    ],
    onUpdate: (id, payload) => {
      if (id === 2) {
        const config = payload.config as Record<string, unknown> | undefined;
        updatedLinks = (config?.links as Array<Record<string, unknown>> | undefined) ?? [];
      }
    },
    onCanvasSave: (payload) => {
      savedPayload = payload;
    },
  });
  await acknowledgeCookieNotice(page);
  await page.goto("/@thia");

  await page.getByTestId("profile-canvas-edit-button").click();
  await page.getByTestId("profile-grid-module-links").click();
  await expect(
    page
      .getByTestId("profile-grid-module-links")
      .getByTestId("profile-selected-module-controls"),
  ).toBeVisible();
  await expect(page.getByTestId("profile-selected-module-popover")).toBeVisible();
  await expect(page.getByTestId("profile-grid-module-links")).toContainText(
    "Select to add connections",
  );
  await expect(page.getByTestId("profile-canvas-size-3x2")).toHaveText("Showcase");
  await page.getByTestId("profile-canvas-size-3x2").click();

  await page.getByTestId("profile-connection-add-open-button").click();
  await page.getByTestId("profile-connection-platform-twitch").click();
  await page.getByTestId("profile-connection-value-input").fill("thiabun");
  await page.getByTestId("profile-connection-add-button").click();
  await page.getByTestId("profile-canvas-save-button").click();
  await expect.poll(() => savedPayload).toBeDefined();

  expect(updatedLinks).toContainEqual(
    expect.objectContaining({
      platform: "twitch",
      url: "https://www.twitch.tv/thiabun",
    }),
  );
  const savedModules = savedPayload?.modules as Array<Record<string, unknown>>;
  expect(savedModules.find((module) => module.id === 2)).toMatchObject({
    colSpan: 3,
    rowSpan: 2,
  });
});

test.skip("retired canvas dragging UI stays backend-only during transition", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  let savedPayload: Record<string, unknown> | undefined;

  await mockProfileModules(page, {
    authenticated: true,
    modules: [
      {
        ...aboutModule({ id: 1, title: "About", body: "Drag target.", position: 2 }),
        layout: { column: 4, row: 1, colSpan: 2, rowSpan: 1 },
      },
      {
        ...linksModule({ id: 2, title: "Links", position: 3 }),
        layout: { column: 1, row: 1, colSpan: 2, rowSpan: 1 },
      },
    ],
    onCanvasSave: (payload) => {
      savedPayload = payload;
    },
  });
  await acknowledgeCookieNotice(page);
  await page.goto("/@thia");

  await page.getByTestId("profile-canvas-edit-button").click();
  await page.getByTestId("profile-grid-module-about").click();
  await expect(
    page
      .getByTestId("profile-grid-module-about")
      .getByTestId("profile-selected-module-controls"),
  ).toBeVisible();
  const grid = page.getByTestId("profile-module-grid");
  const gridBox = await grid.boundingBox();
  const handleBox = await page.getByTestId("profile-canvas-drag-handle-1").boundingBox();

  if (!gridBox || !handleBox) {
    throw new Error("Canvas grid or drag handle did not render.");
  }

  const pointerStart = {
    button: 0,
    buttons: 1,
    clientX: handleBox.x + handleBox.width / 2,
    clientY: handleBox.y + handleBox.height / 2,
    pointerId: 1,
    pointerType: "mouse",
  };
  const pointerTarget = {
    button: 0,
    buttons: 1,
    clientX: gridBox.x + gridBox.width / 12,
    clientY: gridBox.y + 2,
    pointerId: 1,
    pointerType: "mouse",
  };

  await page.getByTestId("profile-canvas-drag-handle-1").dispatchEvent(
    "pointerdown",
    pointerStart,
  );
  await page.dispatchEvent("body", "pointermove", pointerTarget);
  await page.dispatchEvent("body", "pointerup", {
    ...pointerTarget,
    buttons: 0,
  });

  await page.getByTestId("profile-canvas-save-button").click();
  await expect(page.getByTestId("profile-canvas-editor")).toHaveCount(0);

  expect(savedPayload?.anchorModuleId).toBe(1);
  const savedModules = savedPayload?.modules as Array<Record<string, unknown>>;
  const aboutPlacement = savedModules.find((module) => module.id === 1);
  expect(aboutPlacement).toMatchObject({
    column: 1,
    row: 1,
    visible: true,
  });
  expectNoOverlappingPlacements(savedModules);
});

test.skip("retired module add and delete UI stays backend-only during transition", async ({
  page,
}) => {
  const createdPayloads: Array<Record<string, unknown>> = [];
  const deletedIds: number[] = [];
  const featuredPost = postFixture({ id: 42, body: "Pinned post can be removed." });

  await mockProfileModules(page, {
    authenticated: true,
    modules: [
      {
        id: 20,
        type: "featured_post",
        title: "Featured post",
        config: {},
        visibility: "public",
        position: 2,
        status: "active",
        schemaVersion: 1,
        createdAt: "2026-06-12 00:00:00",
        updatedAt: "2026-06-12 00:00:00",
      },
      {
        id: 21,
        type: "featured_room",
        title: "Featured room",
        config: {},
        visibility: "public",
        position: 3,
        status: "active",
        schemaVersion: 1,
        createdAt: "2026-06-12 00:00:00",
        updatedAt: "2026-06-12 00:00:00",
      },
    ],
    onCreate: (payload) => {
      createdPayloads.push(payload);
    },
    onDelete: (id) => {
      deletedIds.push(id);
    },
    profileOverrides: {
      featuredPost,
      featuredPostId: 42,
      featuredRoom: featuredPost.room,
      featuredRoomId: 1,
    },
  });
  await acknowledgeCookieNotice(page);
  await page.goto("/@thia");

  await page.getByTestId("profile-canvas-edit-button").click();
  await page.getByTestId("profile-canvas-category-media").click();
  await expect(page.getByTestId("profile-canvas-add-label-input")).toHaveCount(0);
  await expect(page.getByTestId("profile-canvas-add-type-select")).toHaveCount(0);
  await expect(page.getByTestId("profile-canvas-add-body-input")).toHaveCount(0);
  await expect(
    page
      .getByTestId("profile-canvas-add-module-custom_text")
      .getByRole("button", { name: "Add" }),
  ).toBeVisible();
  await page
    .getByTestId("profile-canvas-add-module-custom_text")
    .getByRole("button", { name: "Add" })
    .click();

  expect(createdPayloads.at(-1)).toMatchObject({
    type: "custom_text",
    visibility: "public",
    status: "active",
    config: { body: "" },
  });
  const textModule = page.getByTestId("profile-grid-module-custom_text");
  await expect(page.getByTestId("profile-selected-module-popover")).toBeVisible();
  await expect(textModule.getByTestId("profile-selected-module-controls")).toBeVisible();
  await page.getByTestId("profile-module-grid").dispatchEvent("click");
  await expect(textModule.getByText("Select to add text")).toBeVisible();
  await textModule.click();
  await expect(textModule.getByTestId("profile-selected-module-controls")).toBeVisible();
  await textModule.getByTestId("profile-module-body-input").fill("Canvas-added note");
  await expect(textModule.getByTestId("profile-module-body-input")).toHaveValue(
    "Canvas-added note",
  );
  await page.getByTestId("profile-module-grid").dispatchEvent("click");
  await expect(
    textModule.getByText("Canvas-added note").first(),
  ).toBeVisible();

  await page.getByTestId("profile-grid-module-featured_post").click();
  await expect(
    page
      .getByTestId("profile-grid-module-featured_post")
      .getByTestId("profile-selected-module-controls"),
  ).toBeVisible();
  await page
    .getByTestId("profile-grid-module-featured_post")
    .getByTestId("profile-canvas-delete-module-button")
    .click();
  await expect.poll(() => deletedIds).toContain(20);
  await expect(page.getByText("Pinned post can be removed.")).toHaveCount(0);

  await page.getByTestId("profile-grid-module-featured_room").click();
  await page
    .getByTestId("profile-grid-module-featured_room")
    .getByTestId("profile-canvas-delete-module-button")
    .click();
  await expect.poll(() => deletedIds).toContain(21);
  await expect(page.getByText("General")).toHaveCount(0);

  await page.getByTestId("profile-canvas-category-removed").click();
  await page.getByTestId("profile-canvas-restore-module-20").getByRole("button", { name: "Restore" }).click();
  await expect(page.getByTestId("profile-grid-module-featured_post")).toBeVisible();
});

test.skip("retired canvas integration panel stays backend-only during transition", async ({
  page,
}) => {
  const createdPayloads: Array<Record<string, unknown>> = [];
  const updatedPayloads: Array<{ id: number; payload: Record<string, unknown> }> = [];
  let oauthStartPayload: Record<string, unknown> | undefined;

  await mockProfileModules(page, {
    authenticated: true,
    modules: [],
    onCreate: (payload) => {
      createdPayloads.push(payload);
    },
    onUpdate: (id, payload) => {
      updatedPayloads.push({ id, payload });
    },
  });
  await page.route("**/api/me/integrations", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: {
          providers: [
            {
              provider: "spotify",
              configured: true,
              oauthEnabled: true,
              linkSupported: true,
              metadataEnabled: true,
              missingConfigKeys: [],
            },
            {
              provider: "apple_music",
              configured: true,
              oauthEnabled: false,
              linkSupported: true,
              metadataEnabled: true,
              missingConfigKeys: [],
            },
            {
              provider: "youtube",
              configured: false,
              oauthEnabled: false,
              linkSupported: true,
              metadataEnabled: false,
              missingConfigKeys: ["integrations.youtube.api_key"],
            },
            {
              provider: "twitch",
              configured: false,
              oauthEnabled: false,
              linkSupported: true,
              metadataEnabled: false,
              missingConfigKeys: [
                "integrations.twitch.client_id",
                "integrations.twitch.client_secret",
              ],
            },
            {
              provider: "github",
              configured: true,
              oauthEnabled: true,
              linkSupported: true,
              metadataEnabled: true,
              missingConfigKeys: [],
            },
          ],
          accounts: [
            {
              provider: "github",
              providerAccountId: "thiabun",
              providerHandle: "thiabun",
              displayName: "thiabun",
              avatarUrl: null,
              scopes: ["read:user"],
              tokenExpiresAt: null,
              connectedAt: "2026-06-17T00:00:00Z",
              refreshedAt: null,
              revokedAt: null,
              lastError: null,
              errorAt: null,
            },
          ],
        },
      }),
    });
  });
  await page.route("**/api/me/integrations/metadata/resolve", async (route) => {
    const payload = (await route.request().postDataJSON()) as Record<string, unknown>;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: {
          provider: payload.provider ?? "twitch",
          resourceType: "channel",
          resourceId: "thiabun",
          resourceKey: `${payload.provider ?? "twitch"}:channel:thiabun`,
          sourceUrl: payload.url,
          apiBacked: true,
          fetchedAt: "2026-06-17T00:00:00Z",
          expiresAt: "2026-06-17T01:00:00Z",
          staleAt: "2026-06-18T00:00:00Z",
          metadata: {
            title: "thiabun",
            subtitle: "Twitch",
            description: "Live channel.",
            imageUrl: null,
            live: false,
            liveFetchedAt: null,
            recentLabel: null,
            recentFetchedAt: null,
            stats: {},
          },
          embed: {
            type: "iframe",
            src: "https://player.twitch.tv/?channel=thiabun&parent=thia.lol&muted=true&autoplay=false",
            title: "Twitch embed",
            allow: "autoplay; encrypted-media; picture-in-picture; fullscreen",
            height: 220,
          },
        },
      }),
    });
  });
  await page.route("**/api/me/integrations/spotify/start", async (route) => {
    oauthStartPayload = (await route.request().postDataJSON()) as Record<
      string,
      unknown
    >;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: {
          provider: "spotify",
          authorizationUrl: "/@thia?editCanvas=1&integration=spotify",
          stateExpiresIn: 600,
        },
      }),
    });
  });
  await acknowledgeCookieNotice(page);
  await page.goto("/@thia");

  await page.getByTestId("profile-canvas-edit-button").click();
  await expect(page.getByTestId("profile-canvas-category-integrations")).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(page.getByTestId("profile-integration-logo-spotify")).toBeVisible();
  await expect(page.getByText("Links ready")).toHaveCount(0);
  await expect(page.getByText("Use link")).toHaveCount(0);
  await expect(page.getByTestId("profile-integration-url-input")).toHaveCount(0);
  await expect(page.getByTestId("profile-integration-card-youtube")).toContainText(
    "OAuth setup needed",
  );
  await expect(page.getByTestId("profile-integration-card-twitch")).toContainText(
    "OAuth setup needed",
  );
  await expect(page.getByText("Add cards")).toHaveCount(0);
  await page.getByTestId("profile-integration-add-module-github").click();

  expect(createdPayloads.at(-1)).toMatchObject({
    type: "creator_live",
    visibility: "public",
    status: "active",
    config: {
      platform: "github",
      sourceMode: "github",
      displayMode: "project",
      label: "thiabun",
      url: "https://github.com/thiabun",
    },
  });

  const creatorModule = page.getByTestId("profile-grid-module-creator_live");
  await expect(creatorModule.getByTestId("profile-creator-config")).toBeVisible();
  await creatorModule.getByTestId("profile-creator-provider-twitch").click();
  await creatorModule.getByTestId("profile-creator-mode-stream_chat").click();
  await expect(creatorModule).toHaveAttribute("data-profile-grid-size", "4x3");
  await expect(creatorModule.getByTestId("profile-canvas-size-5x3")).toBeVisible();
  await expect(creatorModule.getByTestId("profile-canvas-size-6x4")).toBeVisible();
  await creatorModule.getByTestId("profile-canvas-size-6x4").click();
  await expect(creatorModule).toHaveAttribute("data-profile-grid-size", "6x4");
  await creatorModule.getByTestId("profile-creator-url-input").fill("https://www.twitch.tv/thiabun");
  await creatorModule.getByTestId("profile-creator-preview-button").click();
  await expect(creatorModule.getByTestId("profile-integration-preview-summary")).toContainText(
    "thiabun",
  );
  await page.getByTestId("profile-canvas-save-button").click();
  await expect
    .poll(() => updatedPayloads.at(-1)?.payload.config)
    .toMatchObject({
      platform: "twitch",
      sourceMode: "twitch",
      displayMode: "stream_chat",
      label: "thiabun",
      url: "https://www.twitch.tv/thiabun",
      description: "Live channel.",
    });
  expect(updatedPayloads.at(-1)?.payload.config).not.toHaveProperty("integration");

  await page.getByTestId("profile-canvas-edit-button").click();
  await page.getByTestId("profile-integration-connect-spotify").click();
  expect(oauthStartPayload).toMatchObject({
    redirectPath: "/@thia?editCanvas=1",
  });
});

test.skip("retired music module configuration UI stays backend-only during transition", async ({
  page,
}) => {
  const updatedPayloads: Array<{ id: number; payload: Record<string, unknown> }> = [];

  await mockProfileModules(page, {
    authenticated: true,
    modules: [
      {
        ...musicModule({ id: 30 }),
        config: {
          platform: "spotify",
          sourceMode: "spotify",
        },
      },
    ],
    onUpdate: (id, payload) => {
      updatedPayloads.push({ id, payload });
    },
  });
  await page.route("**/api/me/integrations", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: {
          providers: [
            {
              provider: "spotify",
              configured: true,
              oauthEnabled: true,
              linkSupported: true,
              metadataEnabled: true,
              missingConfigKeys: [],
            },
          ],
          accounts: [],
        },
      }),
    });
  });
  await page.route("**/api/me/integrations/metadata/resolve", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: {
          provider: "spotify",
          resourceType: "playlist",
          resourceId: "profile-test",
          resourceKey: "spotify:playlist:profile-test",
          sourceUrl: "https://open.spotify.com/playlist/profile-test",
          apiBacked: true,
          fetchedAt: "2026-06-17T00:00:00Z",
          expiresAt: "2026-06-17T01:00:00Z",
          staleAt: "2026-06-18T00:00:00Z",
          metadata: {
            title: "Focus playlist",
            subtitle: "Spotify",
            description: "No autoplay.",
            imageUrl: null,
            live: false,
            liveFetchedAt: null,
            recentLabel: null,
            recentFetchedAt: null,
            stats: {},
          },
          embed: {
            type: "iframe",
            src: "https://open.spotify.com/embed/playlist/profile-test",
            title: "Spotify embed",
            allow: "autoplay; encrypted-media; picture-in-picture; fullscreen",
            height: 152,
          },
        },
      }),
    });
  });

  await acknowledgeCookieNotice(page);
  await page.goto("/@thia");
  await page.getByTestId("profile-canvas-edit-button").click();
  const music = page.getByTestId("profile-grid-module-music");
  await music.click();
  await expect(music.getByTestId("profile-music-config")).toBeVisible();
  await expect(music.getByTestId("profile-music-connect-spotify")).toBeVisible();
  await music.getByTestId("profile-music-url-input").fill("https://open.spotify.com/playlist/profile-test");
  await music.getByTestId("profile-music-preview-button").click();
  await expect(music.getByTestId("profile-integration-preview-summary")).toContainText(
    "Focus playlist",
  );
  await page.getByTestId("profile-canvas-save-button").click();

  await expect
    .poll(() => updatedPayloads.at(-1)?.payload.config)
    .toMatchObject({
      platform: "spotify",
      sourceMode: "spotify",
      displayMode: "embed",
      label: "Focus playlist",
      url: "https://open.spotify.com/playlist/profile-test",
      description: "No autoplay.",
    });
  expect(updatedPayloads.at(-1)?.payload.config).not.toHaveProperty("integration");
});

test("mobile stack ignores saved desktop placement", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockProfileModules(page, {
    authenticated: false,
    modules: [
      {
        ...aboutModule({
          id: 1,
          title: "Placed low",
          body: "Still stacks.",
          position: 2,
        }),
        layout: { column: 5, row: 8, colSpan: 2, rowSpan: 1 },
      },
    ],
  });
  await acknowledgeCookieNotice(page);
  await page.goto("/@thia");

  const grid = page.getByTestId("profile-module-grid");
  await expectGridColumnCount(grid, PROFILE_CANVAS_MOBILE_COLUMNS);
  await expect(page.getByText("Still stacks.")).toBeVisible();
  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(hasHorizontalOverflow).toBe(false);
});

test("legacy profile links render through Connections instead of Profile Info", async ({
  page,
}) => {
  await mockProfileModules(page, {
    authenticated: false,
    modules: [],
    profileOverrides: {
      links: [
        {
          platform: "twitch",
          label: "Twitch legacy",
          value: "thiabun",
          url: "https://www.twitch.tv/thiabun",
        },
      ],
    },
  });
  await acknowledgeCookieNotice(page);
  await page.goto("/@thia");

  await expect(page.getByTestId("profile-grid-module-links")).toBeVisible();
  await expect(
    page.getByTestId("profile-modules").getByRole("link", { name: "Twitch" }),
  ).toHaveAttribute("href", "https://www.twitch.tv/thiabun");
  await expect(page.getByTestId("profile-header").getByText("Twitch legacy")).toHaveCount(0);
});

test("compact Connections renders icon-only without horizontal overflow", async ({
  page,
}) => {
  await mockProfileModules(page, {
    authenticated: false,
    modules: [
      {
        ...linksModule({
          id: 2,
          links: [
            {
              label: "GitHub",
              platform: "github",
              url: "https://github.com/thiabun",
            },
            {
              label: "Twitch",
              platform: "twitch",
              url: "https://www.twitch.tv/thiabun",
            },
            {
              label: "YouTube",
              platform: "youtube",
              url: "https://www.youtube.com/@thiabun",
            },
          ],
        }),
        layout: { column: 1, row: 2, colSpan: 2, rowSpan: 2 },
      },
    ],
  });
  await acknowledgeCookieNotice(page);
  await page.goto("/@thia");

  await expect(page.locator('[data-profile-connections-compact="icons"]')).toBeVisible();
  await expect(page.locator('[data-profile-connections-compact="rows"]')).toHaveCount(0);
  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(hasHorizontalOverflow).toBe(false);
});

test("narrow Connections shows five rows before the overflow marker", async ({
  page,
}) => {
  await mockProfileModules(page, {
    authenticated: false,
    modules: [
      {
        ...linksModule({
          id: 2,
          links: [
            { label: "GitHub", platform: "github", url: "https://github.com/thiabun" },
            { label: "Spotify", platform: "spotify", url: "https://open.spotify.com/user/thia" },
            { label: "Twitch", platform: "twitch", url: "https://www.twitch.tv/thiabun" },
            { label: "YouTube", platform: "youtube", url: "https://www.youtube.com/@thiabun" },
            { label: "Website", platform: "website", url: "https://thia.lol" },
          ],
        }),
        layout: { column: 1, row: 2, colSpan: 2, rowSpan: 3 },
      },
    ],
  });
  await acknowledgeCookieNotice(page);
  await page.goto("/@thia");

  const links = page.getByTestId("profile-module-links");
  await expect(links.locator('[data-profile-connections-compact="stack"]')).toBeVisible();
  await expect(links.locator("[data-profile-module-visible-links]")).toHaveAttribute(
    "data-profile-module-visible-links",
    "5",
  );
  await expect(links.getByText("+")).toHaveCount(0);
  await expect(links.getByText("Website")).toBeVisible();
});

test("invalid saved placement falls back without manual grid placement", async ({
  page,
}) => {
  await mockProfileModules(page, {
    authenticated: false,
    modules: [
      {
        ...musicModule({ id: 6 }),
        layout: { column: 1, row: 1, colSpan: 3, rowSpan: 3 },
      },
    ],
  });
  await acknowledgeCookieNotice(page);
  await page.goto("/@thia");

  const music = page.getByTestId("profile-grid-module-music");
  await expect(music).toHaveAttribute("data-profile-grid-size", "3x2");
  await expect(music).toHaveAttribute("data-profile-grid-placement", "auto");
});

test("profile canvas falls back safely for invalid mocked spans", async ({ page }) => {
  await mockProfileModules(page, {
    authenticated: false,
    modules: [
      {
        ...textModule({
          id: 4,
          title: "Malformed span",
          body: "Still renders compactly.",
        }),
        config: { body: "Still renders compactly.", canvasSize: "giant" },
      },
    ],
  });
  await acknowledgeCookieNotice(page);
  await page.goto("/@thia");

  const malformed = page.getByTestId("profile-grid-module-custom_text");
  await expect(malformed).toHaveAttribute("data-profile-grid-size", "3x2");
  await expect(malformed).toHaveAttribute("data-profile-grid-column-span", "3");
  await expect(malformed).toHaveAttribute("data-profile-grid-row-span", "2");
  await expect(page.getByText("Still renders compactly.")).toBeVisible();
});

test("public modules ignore hidden and retired module records", async ({ page }) => {
  await mockProfileModules(page, {
    authenticated: false,
    modules: [
      {
        id: 9,
        type: "unsafe_embed",
        title: "Unsupported embed",
        config: { body: "This should not render" },
        visibility: "public",
        position: 1,
        status: "active",
        schemaVersion: 1,
        createdAt: "2026-06-12 00:00:00",
        updatedAt: "2026-06-12 00:00:00",
      },
      aboutModule({ id: 2, title: "Visible first", body: "Shown", position: 2 }),
      {
        ...aboutModule({ id: 3, title: "Hidden note", body: "Hidden body", position: 3 }),
        visibility: "hidden",
      },
      textModule({ id: 4, title: "Visible second", body: "Also shown", position: 4 }),
    ],
  });
  await acknowledgeCookieNotice(page);
  await page.goto("/@thia");

  const section = page.getByTestId("profile-modules");
  await expect(section).toBeVisible();
  await expectTextOrder(section, ["Shown", "Also shown"]);
  await expect(section.getByText("Unsupported embed")).toHaveCount(0);
  await expect(section.getByText("This should not render")).toHaveCount(0);
  await expect(section.getByText("Hidden note")).toHaveCount(0);
  await expect(section.getByText("Hidden body")).toHaveCount(0);
});

test("layout presets affect the public module grid without breaking mobile", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  await mockProfileModules(page, {
    authenticated: false,
    profileOverrides: { profileLayoutPreset: "compact" },
    modules: [
      aboutModule({ id: 1, title: "About", body: "A compact intro.", position: 1 }),
      textModule({ id: 2, title: "Now", body: "Current status.", position: 2 }),
      textModule({ id: 3, title: "Work", body: "Current work.", position: 3 }),
    ],
  });
  await acknowledgeCookieNotice(page);
  await page.goto("/@thia");

  const grid = page.getByTestId("profile-module-grid");
  await expect(grid).toHaveAttribute("data-profile-layout-preset", "compact");
  await expectGridColumnCount(grid, PROFILE_CANVAS_COLUMNS);

  await page.setViewportSize({ width: 390, height: 844 });
  await expectGridColumnCount(grid, PROFILE_CANVAS_MOBILE_COLUMNS);
  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(hasHorizontalOverflow).toBe(false);
});

test("showcase layout gives the first about module more presence", async ({ page }) => {
  await mockProfileModules(page, {
    authenticated: false,
    profileOverrides: { profileLayoutPreset: "showcase" },
    modules: [
      aboutModule({ id: 1, title: "Lead note", body: "Shown first.", position: 1 }),
      textModule({ id: 2, title: "Small note", body: "Shown second.", position: 2 }),
    ],
  });
  await acknowledgeCookieNotice(page);
  await page.goto("/@thia");

  const grid = page.getByTestId("profile-module-grid");
  await expect(grid).toHaveAttribute("data-profile-layout-preset", "showcase");
  await expect(page.getByTestId("profile-grid-module-profile_info")).toHaveAttribute(
    "data-profile-grid-column-span",
    "8",
  );
  await expect(page.getByTestId("profile-grid-module-profile_info")).toHaveAttribute(
    "data-profile-grid-row-span",
    "3",
  );
  await expectTextOrder(page.getByTestId("profile-modules"), [
    "Thia",
    "Shown first.",
    "Shown second.",
  ]);
});

test("visitor with no modules does not see fake module scaffolding", async ({ page }) => {
  await mockProfileModules(page, { authenticated: false, modules: [] });
  await acknowledgeCookieNotice(page);
  await page.goto("/@thia");

  await expect(page.getByTestId("profile-modules")).toBeVisible();
  await expect(page.getByTestId("profile-grid-module-profile_info")).toBeVisible();
  await expect(page.getByTestId("profile-owner-tools")).toHaveCount(0);
  await expect(page.getByText("No modules yet")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Customize profile" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Customize layout" })).toHaveCount(0);
});

test("owner empty module state is honest", async ({ page }) => {
  await mockProfileModules(page, { authenticated: true, modules: [] });
  await acknowledgeCookieNotice(page);
  await page.goto("/@thia");

  await expect(page.getByTestId("profile-owner-tools")).toHaveCount(0);
  await expect(page.getByTestId("profile-modules")).toBeVisible();
  await expect(page.getByTestId("profile-grid-module-profile_info")).toBeVisible();
  await expect(page.getByTestId("profile-edit-button")).toBeVisible();
  await expect(
    page.getByTestId("profile-header").getByRole("button", { name: "Customize profile" }),
  ).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "No modules yet" })).toHaveCount(0);
  await expect(page.getByText("Customize profile to add modules.")).toHaveCount(0);
  await expect(page.getByText("Profile customization is being rebuilt for P3.")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Customize profile" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Customize layout" })).toHaveCount(0);
});

test("owner customization uses the direct canvas editor instead of the retired modal", async ({
  page,
}) => {
  await mockProfileModules(page, {
    authenticated: true,
    modules: [aboutModule({ body: "Saved profile note" })],
  });
  await acknowledgeCookieNotice(page);
  await page.goto("/@thia");

  await expect(page.getByTestId("profile-edit-button")).toBeVisible();
  await page.getByTestId("profile-edit-button").click();
  await expect(page.getByTestId("profile-canvas-editor")).toBeVisible();
  await expect(page.getByRole("button", { name: "Customize profile" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Customize layout" })).toHaveCount(0);
  await expect(page.getByTestId("profile-customization-modal")).toHaveCount(0);
  await expect(page.getByTestId("profile-module-editor")).toHaveCount(0);
  await expect(page.getByText("Saved profile note")).toBeVisible();
});

test("mobile profile modules stay stable with compact profile editing", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockProfileModules(page, {
    authenticated: true,
    modules: [aboutModule({ body: "Mobile profile module" })],
  });
  await acknowledgeCookieNotice(page);
  await page.goto("/@thia");

  await expect(page.getByRole("button", { name: "Customize profile" })).toHaveCount(0);
  await expect(page.getByTestId("profile-customization-modal")).toHaveCount(0);
  await expect(page.getByTestId("profile-edit-button")).toBeVisible();
  await page.getByTestId("profile-edit-button").click();
  const editor = page.getByTestId("profile-canvas-editor");
  await expect(editor).toBeVisible();
  await expect(page.getByTestId("mobile-nav")).toBeHidden();

  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(hasHorizontalOverflow).toBe(false);
});

test("profile module API guardrails are present by inspection", async () => {
  const router = readFileSync("api/index.php", "utf8");
  const integrationsApi = readFileSync("api/integrations.php", "utf8");
  const profileApi = readFileSync("api/profile.php", "utf8");
  const modulesApi = readFileSync("api/profile_modules.php", "utf8");
  const uploadsApi = readFileSync("api/uploads.php", "utf8");
  const configExample = readFileSync("backend/config/config.example.php", "utf8");
  const moduleRegistry = readFileSync("src/lib/profileModuleRegistry.ts", "utf8");
  const profilePage = readFileSync("src/pages/ProfilePage.tsx", "utf8");
  const profileEvolution = readFileSync("docs/profile-personal-space-evolution.md", "utf8");
  const safetyRules = readFileSync("docs/profile-customization-safety-rules.md", "utf8");
  const productGuidelines = readFileSync("docs/product-ui-ux-guidelines.md", "utf8");
  const schema = readFileSync("backend/database/schema.sql", "utf8");
  const migration = readFileSync(
    "backend/database/migrations/20260612_0001_add_profile_modules.sql",
    "utf8",
  );
  const layoutMigration = readFileSync(
    "backend/database/migrations/20260615_0001_add_profile_layout_preset.sql",
    "utf8",
  );
  const canvasMigration = readFileSync(
    "backend/database/migrations/20260616_0001_add_profile_canvas_layout.sql",
    "utf8",
  );
  const integrationsMigration = readFileSync(
    "backend/database/migrations/20260616_0002_add_profile_integrations_and_video_backgrounds.sql",
    "utf8",
  );

  expect(router).toContain("profile_modules.php");
  expect(router).toContain("integrations.php");
  expect(router).toContain("profile_modules_dispatch($segments, $method)");
  expect(router).toContain("integrations_dispatch($segments, $method)");
  expect(router).toContain("'canvas'");
  expect(router).toContain("'canvas-draft'");
  expect(modulesApi).toContain("const PROFILE_INFO_MODULE_TYPE = 'profile_info'");
  expect(modulesApi).toContain("const PROFILE_ACTIVITY_MODULE_TYPE = 'activity'");
  expect(modulesApi).toContain("const PROFILE_FEATURED_POST_MODULE_TYPE = 'featured_post'");
  expect(modulesApi).toContain("const PROFILE_FEATURED_ROOM_MODULE_TYPE = 'featured_room'");
  expect(modulesApi).toContain("const PROFILE_GALLERY_MEDIA_MODULE_TYPE = 'gallery_media'");
  expect(modulesApi).toContain("const PROFILE_CREATOR_LIVE_MODULE_TYPE = 'creator_live'");
  expect(modulesApi).toContain("const PROFILE_MUSIC_MODULE_TYPE = 'music'");
  expect(moduleRegistry).toContain(
    'allowedSizes: ["2x2", "2x3", "3x2", "4x2", "3x3", "3x4"]',
  );
  expect(modulesApi).toContain(
    "'links', PROFILE_CONNECTIONS_MODULE_TYPE => ['2x2', '2x3', '3x2', '4x2', '3x3', '3x4']",
  );
  expect(moduleRegistry).toContain('profile_info: {\n    allowedSizes: ["3x2", "3x3", "4x3", "6x3", "8x3", "8x4"]');
  expect(modulesApi).toContain(
    "PROFILE_INFO_MODULE_TYPE => ['3x2', '3x3', '4x3', '6x3', '8x3', '8x4']",
  );
  expect(modulesApi).toContain("const PROFILE_FEATURED_LEGACY_MODULE_TYPE = 'featured'");
  expect(modulesApi).toContain("PROFILE_BUILT_IN_MODULE_TYPES");
  expect(modulesApi).toContain("PROFILE_PROTECTED_MODULE_TYPES = [PROFILE_INFO_MODULE_TYPE]");
  expect(modulesApi).toContain("PROFILE_SINGLETON_MODULE_TYPES");
  expect(modulesApi).toContain("PROFILE_RETIRED_MODULE_TYPES");
  expect(modulesApi).toContain("ensure_profile_canvas_builtin_modules");
  expect(modulesApi).toContain("ensure_profile_info_module");
  expect(modulesApi).toContain("ensure_profile_feed_module($userId);");
  expect(modulesApi).toContain("function profile_activity_module_payload");
  expect(modulesApi).toContain("PROFILE_ACTIVITY_MODULE_TYPE => 'Feed'");
  expect(modulesApi).toContain("PROFILE_ACTIVITY_MODULE_TYPE => '4x6'");
  expect(modulesApi).toContain(
    "profile_module_preference_exists_including_deleted($userId, PROFILE_ACTIVITY_MODULE_TYPE)",
  );
  expect(modulesApi).toContain("profile_upgrade_default_feed_module($userId);");
  expect(moduleRegistry).toContain("label: \"Feed\"");
  expect(moduleRegistry).toContain("fallbackTitle: \"Feed\"");
  expect(moduleRegistry).toContain("defaultSize: \"4x6\"");
  expect(modulesApi).toContain("includeDeleted");
  expect(modulesApi).toContain("profile_modules_restore");
  expect(modulesApi).toContain("profile_canvas_reflow_existing_modules");
  expect(modulesApi).toContain("restoreFeaturedPostId");
  expect(modulesApi).toContain("restoreFeaturedRoomId");
  expect(modulesApi).toContain("visibility = 'hidden'");
  expect(modulesApi).toContain("profile_module_gallery_media_config");
  expect(modulesApi).toContain("profile_module_music_config");
  expect(modulesApi).toContain("profile_module_uploaded_audio");
  expect(modulesApi).toContain("profile_module_uploaded_video_config");
  expect(moduleRegistry).toContain('"music",\n    "spotify_song"');
  expect(moduleRegistry).toContain('description: "Upload and play a custom MP3 track."');
  expect(profilePage).toContain('music: "MP3"');
  expect(profilePage).toContain('music: "MP3 music upload"');
  expect(profilePage).toContain('platform: "custom", sourceMode: "upload"');
  expect(modulesApi).toContain("profile_integration_card_for_module");
  expect(modulesApi).toContain("profile_module_validate_url_platform");
  expect(modulesApi).toContain("require_csrf_token($session)");
  expect(modulesApi).toContain("Profile module storage is not ready. Run pending migrations.");
  expect(modulesApi).toContain("profile_module_reject_unknown_keys");
  expect(modulesApi).toContain("profile_module_text_is_unsafe");
  expect(modulesApi).toContain("profile_canvas_update");
  expect(modulesApi).toContain("profile_canvas_draft_commit");
  expect(modulesApi).toContain("profile_canvas_glass_opacity");
  expect(modulesApi).toContain("max(0, min(92");
  expect(modulesApi).toContain("PROFILE_CANVAS_PLACEHOLDER_MODULE_TYPE");
  expect(modulesApi).toContain("profile_canvas_placeholder_config");
  expect(modulesApi).toContain("module['type'] ?? null) === PROFILE_CANVAS_PLACEHOLDER_MODULE_TYPE");
  expect(modulesApi).toContain("profile_canvas_background_blur");
  expect(modulesApi).toContain("anchorModuleId");
  expect(modulesApi).toContain("profile_canvas_push_collisions");
  expect(modulesApi).toContain("Canvas layout does not fit the %d by %d grid.");
  expect(modulesApi).toContain("profile_canvas_span_allowed");
  expect(modulesApi).toContain("Module type cannot be changed.");
  expect(modulesApi).toContain("visibility = :visibility");
  expect(modulesApi).toContain("status = 'deleted'");
  expect(modulesApi).toContain("featured_post_id = NULL");
  expect(modulesApi).toContain("featured_room_id = NULL");
  expect(modulesApi).toContain("profile_module_type_is_supported");
  expect(profileApi).toContain("const PROFILE_LAYOUT_PRESETS = ['balanced', 'compact', 'showcase']");
  expect(profileApi).toContain("validate_profile_layout_preset");
  expect(profileApi).toContain("validate_profile_video_url");
  expect(profileApi).toContain("profile_background_video_url");
  expect(uploadsApi).toContain("uploads_video_create");
  expect(uploadsApi).toContain("uploads_audio_create");
  expect(uploadsApi).toContain("VIDEO_UPLOAD_MAX_BYTES");
  expect(uploadsApi).toContain("AUDIO_UPLOAD_MAX_BYTES");
  expect(uploadsApi).toContain("profile_background");
  expect(uploadsApi).toContain("profile_module_video");
  expect(uploadsApi).toContain("profile_music");
  expect(integrationsApi).toContain("profile_integration_encrypt");
  expect(integrationsApi).toContain("profile_integrations_oauth_start");
  expect(integrationsApi).toContain("profile_integrations_oauth_callback");
  expect(integrationsApi).toContain("profile_integrations_provider_suggestions");
  expect(integrationsApi).toContain("profile_integration_redirect_to_app");
  expect(integrationsApi).toContain("profile_integrations_metadata_resolve");
  expect(integrationsApi).toContain("profile_integration_card_for_module");
  expect(integrationsApi).toContain("sodium_crypto_secretbox");
  expect(integrationsApi).toContain("https://www.youtube-nocookie.com/embed/");
  expect(integrationsApi).toContain("embed_parent");
  expect(integrationsApi).toContain("parent=' . rawurlencode($parent)");
  expect(configExample).toContain("integration_encryption_key");
  expect(configExample).toContain("'spotify'");
  expect(configExample).toContain("'apple_music'");
  expect(configExample).toContain("'youtube'");
  expect(configExample).toContain("'twitch'");
  expect(configExample).toContain("'github'");
  expect(moduleRegistry).toContain(
    "export const PROFILE_ACTIVITY_MAX_ROW_SPAN =\n  PROFILE_CANVAS_ACTIVITY_MAX_MODULE_ROWS",
  );
  expect(moduleRegistry).toContain("export type ProfileModulePurpose");
  expect(moduleRegistry).toContain("export type ProfileModuleDensity");
  expect(moduleRegistry).toContain("export type ProfileModuleFreshness");
  expect(moduleRegistry).toContain("export type ProfileModuleEmptyPolicy");
  expect(moduleRegistry).toContain("profileModuleSpanRole");
  expect(moduleRegistry).toContain("profileModuleSizeHasRoomForDetails");
  expect(moduleRegistry).toContain(
    "clampProfileGridModuleSpan(span, PROFILE_ACTIVITY_MAX_ROW_SPAN)",
  );
  expect(profileEvolution).toContain("Module Design Rubric");
  expect(profileEvolution).toContain("1x1` and `2x1`: one idea");
  expect(safetyRules).toContain("Module presentation metadata");
  expect(safetyRules).toContain("API-backed and timestamped");
  expect(productGuidelines).toContain("Profile Modules As Glanceable Surfaces");
  expect(productGuidelines).toContain("Live/recent labels require API-backed timestamps");
  expect(schema).toContain("CREATE TABLE IF NOT EXISTS profile_modules");
  expect(schema).toContain("CREATE TABLE IF NOT EXISTS profile_integration_accounts");
  expect(schema).toContain("CREATE TABLE IF NOT EXISTS profile_integration_oauth_states");
  expect(schema).toContain("CREATE TABLE IF NOT EXISTS profile_integration_metadata_cache");
  expect(schema).toContain("profile_layout_preset VARCHAR(20) NOT NULL DEFAULT 'balanced'");
  expect(schema).toContain("profile_background_blur VARCHAR(20) NOT NULL DEFAULT 'medium'");
  expect(schema).toContain("profile_background_video_url VARCHAR(500) NULL");
  expect(schema).toContain("profile_background_video_poster_url VARCHAR(500) NULL");
  expect(schema).toContain("grid_column TINYINT UNSIGNED NULL");
  expect(migration).toContain("KEY profile_modules_user_position_idx (user_id, position)");
  expect(layoutMigration).toContain("ADD COLUMN profile_layout_preset VARCHAR(20) NOT NULL DEFAULT ''balanced''");
  expect(canvasMigration).toContain("ADD COLUMN profile_background_blur VARCHAR(20) NOT NULL DEFAULT ''medium''");
  expect(canvasMigration).toContain("ADD COLUMN grid_row_span TINYINT UNSIGNED NULL");
  expect(integrationsMigration).toContain("profile_integration_accounts");
  expect(integrationsMigration).toContain("profile_integration_oauth_states");
  expect(integrationsMigration).toContain("profile_integration_metadata_cache");
  expect(integrationsMigration).toContain("profile_background_video_url");
});

test("profile module validation passes backend regression fixture", async () => {
  const output = execFileSync("php", ["tests/backend/profile-modules-regression.php"], {
    encoding: "utf8",
  });

  expect(output).toContain("profile modules regression ok");
});

test("profile integration validation passes backend regression fixture", async () => {
  const output = execFileSync("php", ["tests/backend/profile-integrations-regression.php"], {
    encoding: "utf8",
  });

  expect(output).toContain("profile integrations regression ok");
});

async function mockProfileModules(
  page: Page,
  options: {
    authenticated: boolean;
    modules: unknown[];
    onCreate?: (payload: Record<string, unknown>) => void;
    onCanvasSave?: (payload: Record<string, unknown>) => void;
    onCanvasDraftSave?: (payload: Record<string, unknown>) => void;
    onDelete?: (id: number) => void;
    onAudioUpload?: (purpose: string) => void;
    onImageUpload?: (purpose: string) => void;
    onVideoUpload?: (purpose: string) => void;
    onOrder?: (ids: number[]) => void;
    onProfileSave?: (payload: Record<string, unknown>) => void;
    onUpdate?: (id: number, payload: Record<string, unknown>) => void;
    integrations?: {
      accounts?: unknown[];
      providers?: unknown[];
    };
    profilePosts?: unknown[];
    profileOverrides?: Record<string, unknown>;
    profileReblogs?: unknown[];
    profileReplies?: unknown[];
    profileRooms?: unknown[];
  },
) {
  let ownerModules = ensureTestBuiltInModules(
    [...options.modules] as Array<Record<string, unknown>>,
  );
  let profileOverrides = { ...(options.profileOverrides ?? {}) };
  let canvasDraft = profileCanvasDraftState(ownerModules, profileOverrides);
  let nextModuleId = Math.max(
    10,
    ...ownerModules.map((module) =>
      typeof module.id === "number" ? module.id : 0,
    ),
  ) + 1;

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

  await page.route("**/api/me/onboarding", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: {
          steps: [
            "profile_basics",
            "spotify",
            "youtube",
            "twitch",
            "github",
            "apple_music",
            "profile_canvas",
          ],
          completedSteps: [],
          skippedSteps: [],
          providerLinks: {},
          finishedAt: null,
          dismissedAt: "2026-06-19T00:00:00Z",
          createdAt: "2026-06-19T00:00:00Z",
          updatedAt: "2026-06-19T00:00:00Z",
        },
      }),
    });
  });

  await page.route("**/api/me/integrations/metadata/resolve", async (route) => {
    if (route.request().method() !== "POST") {
      await route.fulfill({
        status: 405,
        contentType: "application/json",
        body: JSON.stringify({ ok: false, error: "Method not allowed." }),
      });
      return;
    }

    const payload = (await route.request().postDataJSON()) as Record<string, unknown>;
    const url = typeof payload.url === "string" ? payload.url : "";
    const provider = typeof payload.provider === "string" ? payload.provider : "twitch";

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: integrationResolveCard(url, provider),
      }),
    });
  });

  await page.route("**/api/me/integrations", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: {
          providers: options.integrations?.providers ?? [],
          accounts: options.integrations?.accounts ?? [],
        },
      }),
    });
  });

  await page.route("**/api/rooms", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, data: [] }),
    });
  });

  await page.route("**/api/uploads/image", async (route) => {
    if (route.request().method() !== "POST") {
      await route.fulfill({
        status: 405,
        contentType: "application/json",
        body: JSON.stringify({ ok: false, error: "Method not allowed." }),
      });
      return;
    }

    const postData = route.request().postData() ?? "";
    const purpose =
      postData.match(/name="purpose"\r\n\r\n([^\r\n]+)/)?.[1] ?? "post_media";
    options.onImageUpload?.(purpose);

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: {
          url: `/uploads/media/2026/06/${purpose}-cropped.webp`,
          width: purpose === "avatar" || purpose === "room_icon" ? 512 : 1600,
          height: purpose === "avatar" || purpose === "room_icon" ? 512 : 900,
          mime: "image/webp",
          type: "image/webp",
          size: 2048,
          purpose,
        },
      }),
    });
  });

  await page.route("**/api/uploads/video", async (route) => {
    if (route.request().method() !== "POST") {
      await route.fulfill({
        status: 405,
        contentType: "application/json",
        body: JSON.stringify({ ok: false, error: "Method not allowed." }),
      });
      return;
    }

    const postData = route.request().postData() ?? "";
    const purpose =
      postData.match(/name="purpose"\r\n\r\n([^\r\n]+)/)?.[1] ??
      "profile_module_video";
    options.onVideoUpload?.(purpose);

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: {
          url: `/uploads/media/2026/06/${purpose}-clip.mp4`,
          mime: "video/mp4",
          type: "video/mp4",
          size: 4096,
          purpose,
        },
      }),
    });
  });

  await page.route("**/api/uploads/audio", async (route) => {
    if (route.request().method() !== "POST") {
      await route.fulfill({
        status: 405,
        contentType: "application/json",
        body: JSON.stringify({ ok: false, error: "Method not allowed." }),
      });
      return;
    }

    const postData = route.request().postData() ?? "";
    const purpose =
      postData.match(/name="purpose"\r\n\r\n([^\r\n]+)/)?.[1] ??
      "profile_music";
    options.onAudioUpload?.(purpose);

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: {
          url: `/uploads/media/2026/06/${purpose}-track.mp3`,
          mime: "audio/mpeg",
          type: "audio/mpeg",
          size: 3072,
          purpose,
        },
      }),
    });
  });

  await page.route("**/api/profiles/thia", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, data: profileBody(profileOverrides) }),
    });
  });

  await page.route("**/api/me/profile", async (route) => {
    if (route.request().method() !== "PATCH") {
      await route.fulfill({
        status: 405,
        contentType: "application/json",
        body: JSON.stringify({ ok: false, error: "Method not allowed." }),
      });
      return;
    }

    const payload = (await route.request().postDataJSON()) as Record<string, unknown>;
    options.onProfileSave?.(payload);

    if (payload.profileLayoutPreset !== undefined) {
      profileOverrides = {
        ...profileOverrides,
        profileLayoutPreset: payload.profileLayoutPreset,
      };
    }

    if (typeof payload.displayName === "string") {
      profileOverrides = {
        ...profileOverrides,
        user: {
          ...(profileBody(profileOverrides).user as Record<string, unknown>),
          displayName: payload.displayName,
        },
      };
    }

    if (typeof payload.bio === "string") {
      profileOverrides = { ...profileOverrides, bio: payload.bio };
    }

    if (typeof payload.location === "string") {
      profileOverrides = { ...profileOverrides, location: payload.location };
    }

    if (typeof payload.avatarUrl === "string" || payload.avatarUrl === null) {
      profileOverrides = {
        ...profileOverrides,
        user: {
          ...(profileBody(profileOverrides).user as Record<string, unknown>),
          avatarUrl: payload.avatarUrl,
        },
      };
    }

    if (typeof payload.bannerUrl === "string" || payload.bannerUrl === null) {
      profileOverrides = { ...profileOverrides, bannerUrl: payload.bannerUrl };
    }

    if (typeof payload.profileBackground === "string" || payload.profileBackground === null) {
      profileOverrides = { ...profileOverrides, profileBackground: payload.profileBackground };
    }

    if (
      typeof payload.profileBackgroundVideo === "string" ||
      payload.profileBackgroundVideo === null
    ) {
      profileOverrides = {
        ...profileOverrides,
        profileBackgroundVideo: payload.profileBackgroundVideo,
      };
    }

    if (
      typeof payload.profileBackgroundVideoPoster === "string" ||
      payload.profileBackgroundVideoPoster === null
    ) {
      profileOverrides = {
        ...profileOverrides,
        profileBackgroundVideoPoster: payload.profileBackgroundVideoPoster,
      };
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, data: profileBody(profileOverrides) }),
    });
  });

  await page.route("**/api/me/profile/canvas", async (route) => {
    if (route.request().method() !== "PATCH") {
      await route.fulfill({
        status: 405,
        contentType: "application/json",
        body: JSON.stringify({ ok: false, error: "Method not allowed." }),
      });
      return;
    }

    const payload = (await route.request().postDataJSON()) as Record<string, unknown>;
    options.onCanvasSave?.(payload);

    if (typeof payload.backgroundBlur === "string") {
      profileOverrides = {
        ...profileOverrides,
        profileBackgroundBlur: payload.backgroundBlur,
        profileCanvasVersion: PROFILE_CANVAS_VERSION,
      };
    }

    const placements = Array.isArray(payload.modules)
      ? (payload.modules as Array<Record<string, unknown>>)
      : [];
    const normalizedPlacements = pushMockCanvasPlacements(
      placements,
      typeof payload.anchorModuleId === "number" ? payload.anchorModuleId : undefined,
    );
    ownerModules = ownerModules.map((module) => {
      const placement = normalizedPlacements.find((item) => item.id === module.id);

      if (!placement) {
        return module;
      }

      return {
        ...module,
        layout: {
          column: placement.column,
          row: placement.row,
          colSpan: placement.colSpan,
          rowSpan: placement.rowSpan,
        },
        pinned: placement.pinned === true,
        visibility:
          module.type === "activity"
            ? "public"
            : placement.visible === false
              ? "hidden"
              : "public",
        status: "active",
      };
    });
    ownerModules = sortModulesByLayout(ownerModules);

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: {
          backgroundBlur: profileOverrides.profileBackgroundBlur ?? "medium",
          canvasGlass:
            typeof profileOverrides.profileCanvasGlass === "number"
              ? profileOverrides.profileCanvasGlass
              : 58,
          canvasVersion: PROFILE_CANVAS_VERSION,
          modules: ownerModules,
        },
      }),
    });
  });

  await page.route("**/api/me/profile/canvas-draft**", async (route) => {
    const url = new URL(route.request().url());
    const method = route.request().method();

    if (url.pathname.endsWith("/commit")) {
      if (method !== "POST") {
        await route.fulfill({
          status: 405,
          contentType: "application/json",
          body: JSON.stringify({ ok: false, error: "Method not allowed." }),
        });
        return;
      }

      const committedModules = (canvasDraft.modules as Array<Record<string, unknown>>)
        .filter((module) => module.status !== "deleted" && module.type !== "placeholder")
        .map((module, index) => {
          const existingId = typeof module.id === "number" && module.id > 0
            ? module.id
            : nextModuleId++;
          const config = module.config as Record<string, unknown> | undefined;

          return {
            ...module,
            id: existingId,
            position: index + 1,
            visibility:
              module.type === "activity"
                ? "public"
                : config?.configured === false
                  ? "hidden"
                  : module.visibility ?? "public",
            status: "active",
          };
        });

      ownerModules = sortModulesByLayout(committedModules);
      profileOverrides = {
        ...profileOverrides,
        profileBackgroundBlur: canvasDraft.backgroundBlur,
        profileCanvasGlass: canvasDraft.canvasGlass,
        profileCanvasVersion: PROFILE_CANVAS_VERSION,
      };
      canvasDraft = profileCanvasDraftState(ownerModules, profileOverrides);
      options.onCanvasSave?.({ ...canvasDraft, modules: ownerModules });

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          data: {
            backgroundBlur: profileOverrides.profileBackgroundBlur ?? "medium",
            canvasGlass: canvasDraft.canvasGlass,
            canvasVersion: PROFILE_CANVAS_VERSION,
            modules: ownerModules,
          },
        }),
      });
      return;
    }

    if (method === "GET") {
      canvasDraft = profileCanvasDraftState(ownerModules, profileOverrides, canvasDraft);
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, data: canvasDraft }),
      });
      return;
    }

    if (method === "PATCH") {
      const payload = (await route.request().postDataJSON()) as Record<string, unknown>;
      options.onCanvasDraftSave?.(payload);
      canvasDraft = {
        ...canvasDraft,
        backgroundBlur:
          typeof payload.backgroundBlur === "string"
            ? payload.backgroundBlur
            : canvasDraft.backgroundBlur,
        canvasGlass:
          typeof payload.canvasGlass === "number"
            ? payload.canvasGlass
            : canvasDraft.canvasGlass,
        canvasVersion: PROFILE_CANVAS_VERSION,
        modules: Array.isArray(payload.modules)
          ? payload.modules
          : canvasDraft.modules,
        selectedModuleId:
          typeof payload.selectedModuleId === "number" ||
          typeof payload.selectedModuleId === "string" ||
          payload.selectedModuleId === null
            ? payload.selectedModuleId
            : canvasDraft.selectedModuleId,
        updatedAt: new Date().toISOString(),
      };

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, data: canvasDraft }),
      });
      return;
    }

    if (method === "DELETE") {
      canvasDraft = profileCanvasDraftState(ownerModules, profileOverrides);
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          data: { discarded: true, canvasVersion: PROFILE_CANVAS_VERSION },
        }),
      });
      return;
    }

    await route.fulfill({
      status: 405,
      contentType: "application/json",
      body: JSON.stringify({ ok: false, error: "Method not allowed." }),
    });
  });

  await page.route("**/api/profiles/thia/modules", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: ownerModules.filter(
          (module) =>
            module.status === "active" &&
            (module.visibility === "public" || module.type === "activity"),
        ),
      }),
    });
  });

  await page.route("**/api/me/profile/module-order", async (route) => {
    const payload = (await route.request().postDataJSON()) as {
      moduleIds?: number[];
    };
    const ids = payload.moduleIds ?? [];
    options.onOrder?.(ids);
    ownerModules = ids
      .map((id, index) => {
        const module = ownerModules.find((item) => item.id === id);
        return module ? { ...module, position: index + 1 } : undefined;
      })
      .filter((module): module is Record<string, unknown> => module !== undefined);
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, data: ownerModules }),
    });
  });

  await page.route("**/api/me/profile/modules/**", async (route) => {
    const url = new URL(route.request().url());
    const pathParts = url.pathname.split("/");
    const isRestore = pathParts.at(-1) === "restore";
    const rawId = isRestore ? pathParts.at(-2) : pathParts.at(-1);
    const id = Number(rawId);

    if (isRestore && route.request().method() === "POST") {
      ownerModules = ownerModules.map((module) =>
        module.id === id
          ? { ...module, status: "active", visibility: "public" }
          : module,
      );
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, data: ownerModules }),
      });
      return;
    }

    if (route.request().method() === "PATCH") {
      const payload = (await route.request().postDataJSON()) as Record<string, unknown>;
      options.onUpdate?.(id, payload);
      ownerModules = ownerModules.map((module) =>
        module.id === id ? moduleFromPayload(payload, module) : module,
      );
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, data: ownerModules }),
      });
      return;
    }

    if (route.request().method() === "DELETE") {
      options.onDelete?.(id);
      const moduleToDelete = ownerModules.find((module) => module.id === id);
      ownerModules = ownerModules.map((module) => {
        if (module.id !== id) {
          return module;
        }

        return module.type === "profile_info"
          ? { ...module, visibility: "hidden", status: "active" }
          : { ...module, visibility: "hidden", status: "deleted" };
      });
      if (moduleToDelete?.type === "featured_post") {
        profileOverrides = { ...profileOverrides, featuredPostId: null, featuredPost: null };
      }
      if (moduleToDelete?.type === "featured_room") {
        profileOverrides = { ...profileOverrides, featuredRoomId: null, featuredRoom: null };
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          data: ownerModules.filter((module) => module.status !== "deleted"),
        }),
      });
      return;
    }

    await route.fulfill({
      status: 405,
      contentType: "application/json",
      body: JSON.stringify({ ok: false, error: "Method not allowed." }),
    });
  });

  await page.route("**/api/me/profile/modules", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, data: ownerModules }),
      });
      return;
    }

    if (route.request().method() === "POST") {
      const payload = (await route.request().postDataJSON()) as Record<string, unknown>;
      options.onCreate?.(payload);
      ownerModules = [
        ...ownerModules,
        moduleFromPayload(payload, {
          id: nextModuleId++,
          position: ownerModules.length + 1,
          schemaVersion: 1,
          createdAt: "2026-06-12 00:00:00",
          updatedAt: "2026-06-12 00:00:00",
        }),
      ];
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, data: ownerModules }),
      });
      return;
    }

    await route.fulfill({
      status: 405,
      contentType: "application/json",
      body: JSON.stringify({ ok: false, error: "Method not allowed." }),
    });
  });

  await page.route(/\/api\/me\/profile\/modules\?/, async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, data: ownerModules }),
      });
      return;
    }

    await route.fulfill({
      status: 405,
      contentType: "application/json",
      body: JSON.stringify({ ok: false, error: "Method not allowed." }),
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

  const profileRouteData: Record<string, unknown[]> = {
    posts: options.profilePosts ?? [],
    replies: options.profileReplies ?? [],
    reblogs: options.profileReblogs ?? [],
    rooms: options.profileRooms ?? [],
    followers: [],
    following: [],
  };

  for (const [suffix, data] of Object.entries(profileRouteData)) {
    await page.route(`**/api/profiles/thia/${suffix}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, data }),
      });
    });
  }
}

function moduleFromPayload(
  payload: Record<string, unknown>,
  base: Record<string, unknown>,
) {
  return {
    ...base,
    ...payload,
    title: payload.title ?? base.title ?? null,
    visibility: payload.visibility ?? base.visibility ?? "public",
    status: payload.status ?? base.status ?? "active",
    pinned: payload.pinned ?? base.pinned ?? false,
    config: payload.config ?? base.config ?? {},
  };
}

function ensureTestBuiltInModules(modules: Array<Record<string, unknown>>) {
  const shouldAddDefaultFeed = modules.length === 0;
  const result = [...modules];

  if (!result.some((module) => module.type === "profile_info")) {
    result.unshift(profileInfoModule());
  }

  if (
    shouldAddDefaultFeed &&
    !result.some((module) => module.type === "activity")
  ) {
    result.push(
      withAuditLayout(
        activityModule({ id: 9, position: 2 }),
        "4x6",
        4,
        1,
      ),
    );
  }

  return result.map((module, index) => ({
    ...module,
    pinned: module.pinned === true,
    position: typeof module.position === "number" ? module.position : index,
  }));
}

function profileCanvasDraftState(
  modules: Array<Record<string, unknown>>,
  profileOverrides: Record<string, unknown>,
  previous?: Record<string, unknown>,
) {
  return {
    backgroundBlur:
      typeof profileOverrides.profileBackgroundBlur === "string"
        ? profileOverrides.profileBackgroundBlur
        : typeof previous?.backgroundBlur === "string"
          ? previous.backgroundBlur
          : "medium",
    canvasGlass:
      typeof previous?.canvasGlass === "number" ? previous.canvasGlass : 58,
    canvasVersion: PROFILE_CANVAS_VERSION,
    modules: sortModulesByLayout(modules).map((module) => ({ ...module })),
    selectedModuleId: previous?.selectedModuleId ?? null,
    updatedAt: new Date().toISOString(),
  };
}

function placeholderDraftModule(payload: Record<string, unknown> | undefined) {
  const modules = Array.isArray(payload?.modules)
    ? (payload.modules as Array<Record<string, unknown>>)
    : [];

  return modules.find((module) => module.type === "placeholder");
}

function draftConnectionLinks(payload: Record<string, unknown> | undefined) {
  const modules = Array.isArray(payload?.modules)
    ? (payload.modules as Array<Record<string, unknown>>)
    : [];
  const connections = modules.find((module) => module.type === "connections");
  const config = connections?.config as Record<string, unknown> | undefined;

  return Array.isArray(config?.links)
    ? (config.links as Array<Record<string, string>>)
    : [];
}

function sortModulesByLayout(modules: Array<Record<string, unknown>>) {
  return [...modules]
    .sort((first, second) => {
      const firstLayout = first.layout as Record<string, number> | undefined;
      const secondLayout = second.layout as Record<string, number> | undefined;

      if (firstLayout && secondLayout) {
        const rowCompare = (firstLayout.row ?? 1) - (secondLayout.row ?? 1);

        if (rowCompare !== 0) {
          return rowCompare;
        }

        return (firstLayout.column ?? 1) - (secondLayout.column ?? 1);
      }

      return Number(first.position ?? 0) - Number(second.position ?? 0);
    })
    .map((module, index) => ({ ...module, position: index + 1 }));
}

function pushMockCanvasPlacements(
  placements: Array<Record<string, unknown>>,
  anchorModuleId?: number,
) {
  const visible = placements
    .filter((placement) => placement.visible !== false)
    .sort((first, second) => {
      if (first.pinned === true && second.pinned !== true) {
        return -1;
      }

      if (second.pinned === true && first.pinned !== true) {
        return 1;
      }

      if (anchorModuleId !== undefined) {
        if (first.id === anchorModuleId && second.id !== anchorModuleId) {
          return -1;
        }

        if (second.id === anchorModuleId && first.id !== anchorModuleId) {
          return 1;
        }
      }

      return Number(first.row ?? 1) - Number(second.row ?? 1) ||
        Number(first.column ?? 1) - Number(second.column ?? 1);
    });
  const hidden = placements.filter((placement) => placement.visible === false);
  const occupied = new Set<string>();

  return [
    ...visible.map((placement) => {
      const colSpan = Number(placement.colSpan ?? 1);
      const rowSpan = Number(placement.rowSpan ?? 1);
      const requested = {
        ...placement,
        column: Math.max(
          1,
          Math.min(PROFILE_CANVAS_COLUMNS - colSpan + 1, Number(placement.column ?? 1)),
        ),
        row: Math.max(
          1,
          Math.min(PROFILE_CANVAS_ROWS - rowSpan + 1, Number(placement.row ?? 1)),
        ),
        colSpan,
        rowSpan,
      };
      const layout = mockLayoutFits(requested, occupied)
        ? requested
        : mockNextLayout(requested, occupied);

      if (!layout) {
        return requested;
      }

      occupyMockLayout(layout, occupied);
      return layout;
    }),
    ...hidden,
  ];
}

function mockNextLayout(
  placement: Record<string, unknown>,
  occupied: Set<string>,
) {
  const colSpan = Number(placement.colSpan ?? 1);
  const rowSpan = Number(placement.rowSpan ?? 1);
  const maxColumn = PROFILE_CANVAS_COLUMNS - colSpan + 1;
  const maxRow = PROFILE_CANVAS_ROWS - rowSpan + 1;
  const baseColumn = Math.max(1, Math.min(maxColumn, Number(placement.column ?? 1)));
  const baseRow = Math.max(1, Math.min(maxRow, Number(placement.row ?? 1)));

  for (const column of mockSameRowSidewaysColumns(baseColumn, maxColumn)) {
    const candidate = {
      ...placement,
      column,
      row: baseRow,
      colSpan,
      rowSpan,
    };

    if (mockLayoutFits(candidate, occupied)) {
      return candidate;
    }
  }

  for (let row = baseRow + 1; row <= maxRow; row += 1) {
    for (const column of mockNearbyColumns(baseColumn, maxColumn)) {
      const candidate = {
        ...placement,
        column,
        row,
        colSpan,
        rowSpan,
      };

      if (mockLayoutFits(candidate, occupied)) {
        return candidate;
      }
    }
  }

  return undefined;
}

function mockSameRowSidewaysColumns(baseColumn: number, maxColumn: number) {
  const columns: number[] = [];

  for (let column = baseColumn + 1; column <= maxColumn; column += 1) {
    columns.push(column);
  }

  for (let column = baseColumn - 1; column >= 1; column -= 1) {
    columns.push(column);
  }

  return columns;
}

function mockNearbyColumns(baseColumn: number, maxColumn: number) {
  const columns = [baseColumn];

  for (let distance = 1; distance < maxColumn; distance += 1) {
    const right = baseColumn + distance;
    const left = baseColumn - distance;

    if (right <= maxColumn) {
      columns.push(right);
    }

    if (left >= 1) {
      columns.push(left);
    }
  }

  return columns;
}

function mockLayoutFits(
  placement: Record<string, unknown>,
  occupied: Set<string>,
) {
  const column = Number(placement.column ?? 1);
  const row = Number(placement.row ?? 1);
  const colSpan = Number(placement.colSpan ?? 1);
  const rowSpan = Number(placement.rowSpan ?? 1);

  for (let y = row; y < row + rowSpan; y += 1) {
    for (let x = column; x < column + colSpan; x += 1) {
      if (occupied.has(`${x}:${y}`)) {
        return false;
      }
    }
  }

  return true;
}

function occupyMockLayout(
  placement: Record<string, unknown>,
  occupied: Set<string>,
) {
  const column = Number(placement.column ?? 1);
  const row = Number(placement.row ?? 1);
  const colSpan = Number(placement.colSpan ?? 1);
  const rowSpan = Number(placement.rowSpan ?? 1);

  for (let y = row; y < row + rowSpan; y += 1) {
    for (let x = column; x < column + colSpan; x += 1) {
      occupied.add(`${x}:${y}`);
    }
  }
}

async function acknowledgeCookieNotice(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem("thia_cookie_notice_ack", "1");
  });
}

async function mockSpotifyIframeApi(
  page: Page,
  options: { rejectPlay?: boolean } = {},
) {
  await page.addInitScript(() => {
    Object.assign(window, {
      __spotifyPlayCalls: 0,
    });
  });
  await page.route("https://open.spotify.com/embed/iframe-api/v1", async (route) => {
    await route.fulfill({
      contentType: "application/javascript",
      status: 200,
      body: `
        window.onSpotifyIframeApiReady({
          createController: function(element, options, callback) {
            window.__spotifyControllerOptions = (window.__spotifyControllerOptions || []).concat(options);
            var listeners = {};
            var currentPosition = 60000;
            var duration = 180000;
            function addListener(event, listener) {
              listeners[event] = listeners[event] || [];
              listeners[event].push(listener);
            }
            function removeListener(event, listener) {
              listeners[event] = (listeners[event] || []).filter(function(item) {
                return item !== listener;
              });
            }
            function emitProgress(isPaused) {
              (listeners.playback_update || []).forEach(function(listener) {
                listener({
                  data: {
                    duration: duration,
                    isBuffering: false,
                    isPaused: isPaused,
                    playingURI: options.uri,
                    position: currentPosition
                  }
                });
              });
            }
            var parts = String(options.uri || "").split(":");
            var iframe = document.createElement("iframe");
            iframe.src = "https://open.spotify.com/embed/" + parts[1] + "/" + parts[2] + "?theme=0";
            iframe.height = options.height;
            element.appendChild(iframe);
            callback({
              addListener: addListener,
              destroy: function() {},
              pause: function() {
                emitProgress(true);
                return Promise.resolve();
              },
              play: function() {
                window.__spotifyPlayCalls = (window.__spotifyPlayCalls || 0) + 1;
                ${
                  options.rejectPlay
                    ? "return Promise.reject(new Error('blocked'));"
                    : "emitProgress(false); return Promise.resolve();"
                }
              },
              removeListener: removeListener,
              togglePlay: function() {
                window.__spotifyPlayCalls = (window.__spotifyPlayCalls || 0) + 1;
                emitProgress(false);
                return Promise.resolve();
              }
            });
          }
        });
      `,
    });
  });
}

async function expectSpotifyCustomPlayer(page: Page) {
  const player = page.getByTestId("profile-spotify-custom-player");

  await expect(player).toBeVisible();
  await expect(player.getByText("Focus track")).toBeVisible();
  await expect(player.getByText("Spotify track")).toBeVisible();
  await expect(page.getByTestId("profile-spotify-play-button")).toBeVisible();
  await expect(page.getByTestId("profile-spotify-play-button")).toBeEnabled();
  await expect(page.getByTestId("profile-integration-embed-spotify")).toBeAttached();
}

const darkAlbumArtworkPng =
  "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAEUlEQVR4nGNg5eD9D8IMMAYAIbAEZULJ3y0AAAAASUVORK5CYII=";
const lightAlbumArtworkPng =
  "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAEUlEQVR4nGP48eXFfxBmgDEAiawPTRXeMb4AAAAASUVORK5CYII=";

async function mockAlbumArtwork(page: Page, path: string, pngBase64: string) {
  await page.route(`**${path}`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "image/png",
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-store",
      },
      body: Buffer.from(pngBase64, "base64"),
    });
  });
}

async function expectSpotifyProgress(
  page: Page,
  expectedPercent: number | { max: number; min: number },
  expectedText: string | RegExp,
) {
  const progress = page.getByTestId("profile-spotify-progress-bar");
  const expectedRange =
    typeof expectedPercent === "number"
      ? { max: expectedPercent, min: expectedPercent }
      : expectedPercent;

  await expect
    .poll(async () => {
      const value = Number(await progress.getAttribute("aria-valuenow"));

      return value >= expectedRange.min && value <= expectedRange.max;
    })
    .toBe(true);
  await expect(progress).toHaveCSS("width", /.+/);
  await expect(page.getByTestId("profile-spotify-progress-time")).toHaveText(
    expectedText,
  );
}

async function spotifyPlayCalls(page: Page): Promise<number> {
  return page.evaluate(() => {
    const testWindow = window as Window & { __spotifyPlayCalls?: number };

    return Number(testWindow.__spotifyPlayCalls ?? 0);
  });
}

async function expectGridColumnCount(locator: Locator, expectedCount: number) {
  await expect
    .poll(async () =>
      locator.evaluate((element) => {
        const columns = window.getComputedStyle(element).gridTemplateColumns;
        return columns.split(" ").filter(Boolean).length;
      }),
    )
    .toBe(expectedCount);
}

async function expectModuleAspectRatio(locator: Locator, expectedRatio: number) {
  await expect
    .poll(async () =>
      locator.evaluate((element) => {
        const rect = element.getBoundingClientRect();

        return rect.height > 0 ? rect.width / rect.height : 0;
      }),
    )
    .toBeGreaterThan(expectedRatio - 0.08);
  await expect
    .poll(async () =>
      locator.evaluate((element) => {
        const rect = element.getBoundingClientRect();

        return rect.height > 0 ? rect.width / rect.height : 0;
      }),
    )
    .toBeLessThan(expectedRatio + 0.08);
}

async function expectTwitchStreamChatWidthRatio(
  locator: Locator,
  expectedRatio:
    | number
    | {
        max: number;
        min: number;
      },
) {
  const minRatio =
    typeof expectedRatio === "number" ? expectedRatio - 0.12 : expectedRatio.min;
  const maxRatio =
    typeof expectedRatio === "number" ? expectedRatio + 0.12 : expectedRatio.max;
  const measureRatio = async () =>
    locator.evaluate((element) => {
      const stream = element.querySelector<HTMLElement>(
        '[data-testid="profile-integration-embed-twitch"]',
      );
      const chat = element.querySelector<HTMLElement>(
        '[data-testid="profile-integration-embed-twitch-chat"]',
      );

      if (!stream || !chat) {
        return 0;
      }

      const streamRect = stream.getBoundingClientRect();
      const chatRect = chat.getBoundingClientRect();

      return chatRect.width > 0 ? streamRect.width / chatRect.width : 0;
    });

  await expect.poll(measureRatio).toBeGreaterThan(minRatio);
  await expect.poll(measureRatio).toBeLessThan(maxRatio);
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

function expectNoOverlappingPlacements(modules: Array<Record<string, unknown>>) {
  const occupied = new Set<string>();

  for (const module of modules) {
    if (module.visible === false) {
      continue;
    }

    const column = Number(module.column ?? 1);
    const row = Number(module.row ?? 1);
    const colSpan = Number(module.colSpan ?? 1);
    const rowSpan = Number(module.rowSpan ?? 1);

    for (let y = row; y < row + rowSpan; y += 1) {
      for (let x = column; x < column + colSpan; x += 1) {
        const key = `${x}:${y}`;
        expect(occupied.has(key)).toBe(false);
        occupied.add(key);
      }
    }
  }
}

type ProfileModuleSizeAuditType =
  | "profile_info"
  | "about"
  | "custom_text"
  | "links"
  | "featured_badges"
  | "featured_post"
  | "featured_room"
  | "gallery_media"
  | "creator_live"
  | "music"
  | "activity";

type ProfileModuleSizeAuditMock = Parameters<typeof mockProfileModules>[1];

const profileModuleSizeAuditMatrix: Array<{
  sizes: string[];
  type: ProfileModuleSizeAuditType;
}> = [
  { type: "profile_info", sizes: ["3x2", "3x3", "4x3", "6x3"] },
  { type: "about", sizes: ["3x2", "4x3", "4x5"] },
  { type: "custom_text", sizes: ["3x2", "4x3", "4x5"] },
  { type: "links", sizes: ["2x2", "2x3", "3x2", "4x2", "3x4"] },
  { type: "featured_badges", sizes: ["2x2", "3x2"] },
  { type: "featured_post", sizes: ["3x4", "4x5"] },
  { type: "featured_room", sizes: ["3x1", "4x2"] },
  { type: "gallery_media", sizes: ["2x2", "3x2", "3x3", "4x3"] },
  {
    type: "creator_live",
    sizes: ["2x1", "3x2", "4x3", "5x3", "6x4"],
  },
  { type: "music", sizes: ["2x1", "2x2", "3x2", "4x2", "4x3", "4x4"] },
  { type: "activity", sizes: ["3x4", "4x6", "6x10"] },
];

function profileModuleSizeAuditCases(): Array<{
  mock: ProfileModuleSizeAuditMock;
  size: string;
  type: ProfileModuleSizeAuditType;
}> {
  return profileModuleSizeAuditMatrix.flatMap(({ sizes, type }, groupIndex) =>
    sizes.map((size, sizeIndex) => ({
      mock: profileModuleSizeAuditMock(type, size, groupIndex * 20 + sizeIndex + 1),
      size,
      type,
    })),
  );
}

function profileModuleSizeAuditMock(
  type: ProfileModuleSizeAuditType,
  size: string,
  id: number,
): ProfileModuleSizeAuditMock {
  const featuredPost = postFixture({ id: 42, body: "Pinned post preview." });
  const module = profileModuleSizeAuditModule(type, size, id);

  return {
    authenticated: true,
    modules: [module],
    profileOverrides: {
      ...(type === "featured_post"
        ? { featuredPost, featuredPostId: 42 }
        : {}),
      ...(type === "featured_room"
        ? { featuredRoom: featuredPost.room, featuredRoomId: 1 }
        : {}),
      ...(type === "links"
        ? {
            links: [
              {
                label: "GitHub",
                platform: "github",
                url: "https://github.com/thiabun",
                value: "thiabun",
              },
            ],
          }
        : {}),
    },
    profilePosts:
      type === "activity"
        ? [
            postFixture({ id: 100, body: "Activity size audit post." }),
            postFixture({ id: 101, body: "Second activity item." }),
          ]
        : undefined,
  };
}

function profileModuleSizeAuditModule(
  type: ProfileModuleSizeAuditType,
  size: string,
  id: number,
): Record<string, unknown> {
  const row = type === "profile_info" ? 1 : 4;

  if (type === "profile_info") {
    return withAuditLayout(profileInfoModule(), size, row);
  }

  if (type === "about") {
    return withAuditLayout(
      aboutModule({
        id,
        body: "A concise intro with enough text to exercise wrapping.",
      }),
      size,
      row,
    );
  }

  if (type === "custom_text") {
    return withAuditLayout(
      textModule({
        id,
        body: "A short note with a clear point.",
      }),
      size,
      row,
    );
  }

  if (type === "links") {
    return withAuditLayout(
      linksModule({
        id,
        links: [
          { label: "GitHub", platform: "github", url: "https://github.com/thiabun" },
          { label: "Twitch", platform: "twitch", url: "https://www.twitch.tv/thiabun" },
          { label: "YouTube", platform: "youtube", url: "https://www.youtube.com/@thia" },
        ],
      }),
      size,
      row,
    );
  }

  if (type === "featured_badges") {
    return withAuditLayout(
      {
        id,
        type: "featured_badges",
        title: "Badges",
        config: { userBadgeIds: [1] },
        visibility: "public",
        position: 1,
        status: "active",
        schemaVersion: 1,
        createdAt: "2026-06-12 00:00:00",
        updatedAt: "2026-06-12 00:00:00",
      },
      size,
      row,
    );
  }

  if (type === "featured_post") {
    return withAuditLayout(
      {
        id,
        type: "featured_post",
        title: "Featured post",
        config: {},
        visibility: "public",
        position: 1,
        status: "active",
        schemaVersion: 1,
        createdAt: "2026-06-12 00:00:00",
        updatedAt: "2026-06-12 00:00:00",
      },
      size,
      row,
    );
  }

  if (type === "featured_room") {
    return withAuditLayout(
      {
        id,
        type: "featured_room",
        title: "Featured room",
        config: {},
        visibility: "public",
        position: 1,
        status: "active",
        schemaVersion: 1,
        createdAt: "2026-06-12 00:00:00",
        updatedAt: "2026-06-12 00:00:00",
      },
      size,
      row,
    );
  }

  if (type === "gallery_media") {
    return withAuditLayout(galleryModule({ id }), size, row);
  }

  if (type === "creator_live") {
    const module = ["4x3", "5x3", "6x4"].includes(size)
      ? twitchStreamChatModule({ id })
      : creatorModule({ id });

    return withAuditLayout(module, size, row);
  }

  if (type === "music") {
    return withAuditLayout(musicModule({ id }), size, row);
  }

  return withAuditLayout(activityModule({ id }), size, row);
}

function musicModuleWithSize({
  column = 1,
  id,
  row,
  size,
}: {
  column?: number;
  id: number;
  row: number;
  size: string;
}) {
  return withAuditLayout(
    spotifyEmbedMusicModule({ id, position: id }),
    size,
    row,
    column,
  );
}

function withAuditLayout(
  module: Record<string, unknown>,
  size: string,
  row: number,
  column = 1,
) {
  const span = profileModuleSizeAuditSpan(size);
  const config =
    module.config && typeof module.config === "object" && !Array.isArray(module.config)
      ? { ...(module.config as Record<string, unknown>), canvasSize: size }
      : { canvasSize: size };

  return {
    ...module,
    config,
    layout: {
      column,
      row,
      colSpan: span.colSpan,
      rowSpan: span.rowSpan,
    },
  };
}

function profileModuleSizeAuditSpan(size: string): {
  colSpan: number;
  rowSpan: number;
} {
  const [columns, rows] = size.split("x").map(Number);

  return {
    colSpan: Number.isFinite(columns) ? columns : 1,
    rowSpan: Number.isFinite(rows) ? rows : 1,
  };
}

test.describe("allowed module sizes smoke render one at a time without overflow", () => {
  for (const auditCase of profileModuleSizeAuditCases()) {
    test(`${auditCase.type} ${auditCase.size}`, async ({ page }) => {
      await page.setViewportSize({ width: 1366, height: 1100 });
      await acknowledgeCookieNotice(page);
      await mockProfileModules(page, auditCase.mock);
      await page.goto(`/@thia?sizeAudit=${auditCase.type}-${auditCase.size}`);

      await expectAuditModule(page, auditCase);
    });
  }
});

async function expectAuditModule(
  page: Page,
  auditCase: { size: string; type: ProfileModuleSizeAuditType },
) {
  const module = page.getByTestId(`profile-grid-module-${auditCase.type}`);
  await expect(module).toBeVisible();
  await expect(module).toHaveAttribute("data-profile-grid-size", auditCase.size);

  const metrics = await module.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const meaningfulContent = Array.from(
      element.querySelectorAll<HTMLElement>(
        'a,button,img,iframe,[data-profile-module-visible-links],[data-profile-module-visible-badges],[data-profile-module-visible-media],[data-testid="profile-header"],[data-testid="profile-activity"],[data-testid="profile-spotify-custom-player"]',
      ),
    ).filter((item) => {
      const itemRect = item.getBoundingClientRect();
      const styles = window.getComputedStyle(item);

      return (
        itemRect.width > 0 &&
        itemRect.height > 0 &&
        styles.visibility !== "hidden" &&
        styles.display !== "none"
      );
    });

    return {
      documentOverflowX:
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth + 1,
      height: Math.round(rect.height),
      hasVisibleContent:
        meaningfulContent.length > 0 ||
        (element.textContent?.trim().length ?? 0) > 0,
      width: Math.round(rect.width),
    };
  });

  expect(metrics.documentOverflowX).toBe(false);
  expect(metrics.hasVisibleContent).toBe(true);
  expect(metrics.height).toBeGreaterThan(56);
  expect(metrics.width).toBeGreaterThan(80);
}

async function mockMediaMetadata(page: Page) {
  await page.addInitScript(() => {
    const originalAddEventListener = HTMLMediaElement.prototype.addEventListener;

    HTMLMediaElement.prototype.addEventListener = function (
      type,
      listener,
      options,
    ) {
      if (type === "loadedmetadata" && listener) {
        window.setTimeout(() => {
          if (typeof listener === "function") {
            listener.call(this, new Event("loadedmetadata"));
          } else {
            listener.handleEvent(new Event("loadedmetadata"));
          }
        }, 0);
      }

      return originalAddEventListener.call(this, type, listener, options);
    };

    Object.defineProperty(HTMLMediaElement.prototype, "duration", {
      configurable: true,
      get() {
        return 12.5;
      },
    });
  });
}

function moduleConfigFromDraft(
  draftPayload: Record<string, unknown> | undefined,
  moduleId: number,
): Record<string, unknown> | undefined {
  const modules = Array.isArray(draftPayload?.modules)
    ? (draftPayload.modules as Array<Record<string, unknown>>)
    : [];
  const module = modules.find((item) => item.id === moduleId);

  return module?.config && typeof module.config === "object"
    ? (module.config as Record<string, unknown>)
    : undefined;
}

function samplePngFile(name: string) {
  return {
    name,
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
      "base64",
    ),
  };
}

function sampleMp4File(name: string) {
  return {
    name,
    mimeType: "video/mp4",
    buffer: Buffer.from("AAAAIGZ0eXBpc29tAAACAGlzb21pc28yYXZjMW1wNDE=", "base64"),
  };
}

function sampleMp3File(name: string) {
  return {
    name,
    mimeType: "audio/mpeg",
    buffer: Buffer.from("SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjYwLjMuMTAwAAAAAAAA", "base64"),
  };
}

function profileBody(overrides: Record<string, unknown> = {}) {
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
    profileBackgroundVideo: null,
    profileBackgroundVideoPoster: null,
    profileBackgroundBlur: "medium",
    profileTheme: null,
    profileLayoutPreset: "balanced",
    profileCanvasGlass: 58,
    profileCanvasVersion: PROFILE_CANVAS_VERSION,
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
    ...overrides,
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

function profileInfoModule() {
  return {
    id: 9001,
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

function aboutModule(
  overrides: {
    id?: number;
    title?: string;
    body?: string;
    position?: number;
  } = {},
) {
  return {
    id: overrides.id ?? 1,
    type: "about",
    title: overrides.title ?? "About this space",
    config: { body: overrides.body ?? "Saved profile note" },
    visibility: "public",
    position: overrides.position ?? 1,
    status: "active",
    schemaVersion: 1,
    createdAt: "2026-06-12 00:00:00",
    updatedAt: "2026-06-12 00:00:00",
  };
}

function textModule(
  overrides: {
    id?: number;
    title?: string;
    body?: string;
    position?: number;
  } = {},
) {
  return {
    id: overrides.id ?? 2,
    type: "custom_text",
    title: overrides.title ?? "Note",
    config: { body: overrides.body ?? "Saved note" },
    visibility: "public",
    position: overrides.position ?? 1,
    status: "active",
    schemaVersion: 1,
    createdAt: "2026-06-12 00:00:00",
    updatedAt: "2026-06-12 00:00:00",
  };
}

function linksModule(
  overrides: {
    id?: number;
    position?: number;
    title?: string;
    links?: Array<Record<string, unknown>>;
  } = {},
) {
  return {
    id: overrides.id ?? 3,
    type: "links",
    title: overrides.title ?? "Connections",
    config: {
      links: overrides.links ?? [
        {
          label: "GitHub",
          platform: "github",
          url: "https://github.com/thiabun",
        },
      ],
    },
    visibility: "public",
    position: overrides.position ?? 1,
    status: "active",
    schemaVersion: 1,
    createdAt: "2026-06-12 00:00:00",
    updatedAt: "2026-06-12 00:00:00",
  };
}

function galleryModule(overrides: { id?: number; position?: number } = {}) {
  return {
    id: overrides.id ?? 4,
    type: "gallery_media",
    title: "Gallery",
    config: {
      mediaItems: [
        {
          caption: "Studio corner",
          url: "/uploads/media/2026/06/profile-gallery-one.webp",
        },
        {
          caption: "Room sketch",
          url: "/uploads/media/2026/06/profile-gallery-two.webp",
        },
      ],
    },
    visibility: "public",
    position: overrides.position ?? 1,
    status: "active",
    schemaVersion: 1,
    createdAt: "2026-06-12 00:00:00",
    updatedAt: "2026-06-12 00:00:00",
  };
}

function creatorModule(overrides: { id?: number; position?: number } = {}) {
  return {
    id: overrides.id ?? 5,
    type: "creator_live",
    title: "Creator",
    config: {
      description: "Streams and build notes live here.",
      label: "Find me on Twitch",
      platform: "twitch",
      url: "https://www.twitch.tv/thiabun",
    },
    visibility: "public",
    position: overrides.position ?? 1,
    status: "active",
    schemaVersion: 1,
    createdAt: "2026-06-12 00:00:00",
    updatedAt: "2026-06-12 00:00:00",
  };
}

function musicModule(overrides: { id?: number; position?: number } = {}) {
  return {
    id: overrides.id ?? 6,
    type: "music",
    title: "Music",
    config: {
      description: "Current writing playlist.",
      label: "Focus playlist",
      platform: "spotify",
      url: "https://open.spotify.com/playlist/profile-test",
    },
    visibility: "public",
    position: overrides.position ?? 1,
    status: "active",
    schemaVersion: 1,
    createdAt: "2026-06-12 00:00:00",
    updatedAt: "2026-06-12 00:00:00",
  };
}

function spotifyEmbedMusicModule(
  overrides: { id?: number; imageUrl?: string; position?: number } = {},
) {
  return {
    ...musicModule(overrides),
    config: {
      description: "Current writing song.",
      displayMode: "embed",
      label: "Focus track",
      platform: "spotify",
      sourceMode: "spotify",
      url: "https://open.spotify.com/track/profile-test",
      integration: {
        provider: "spotify",
        resourceType: "track",
        resourceId: "profile-test",
        resourceKey: "spotify:track:profile-test",
        sourceUrl: "https://open.spotify.com/track/profile-test",
        metadata: {
          title: "Focus track",
          subtitle: "Spotify track",
          imageUrl: overrides.imageUrl ?? "https://i.scdn.co/image/focus-track",
        },
        embed: {
          type: "iframe",
          src: "https://open.spotify.com/embed/track/profile-test",
          title: "Spotify player",
          height: 80,
          allow: "autoplay; encrypted-media; picture-in-picture; fullscreen",
        },
        apiBacked: true,
        fetchedAt: "2026-06-16T10:00:00Z",
        stale: false,
      },
    },
  };
}

function uploadedMp3MusicModule(
  overrides: { id?: number; position?: number } = {},
) {
  return {
    ...musicModule(overrides),
    config: {
      audio: {
        duration: 180,
        mime: "audio/mpeg",
        size: 123456,
        title: "Custom track",
        type: "audio/mpeg",
        uploadedAt: "2026-06-19T12:00:00.000Z",
        url: "/uploads/media/2026/06/profile_music-track.mp3",
      },
      configured: true,
      displayMode: "player",
      label: "Custom track",
      platform: "custom",
      sourceMode: "upload",
    },
  };
}

function youtubeMusicEmbedModule(
  overrides: { id?: number; imageUrl?: string; position?: number } = {},
) {
  return {
    ...musicModule(overrides),
    type: "youtube_music_song",
    config: {
      displayMode: "embed",
      label: "YouTube Music song",
      platform: "youtube_music",
      sourceMode: "youtube_music",
      url: "https://music.youtube.com/watch?v=music123",
      integration: {
        provider: "youtube",
        resourceType: "video",
        resourceId: "music123",
        resourceKey: "youtube:video:music123",
        sourceUrl: "https://www.youtube.com/watch?v=music123",
        metadata: {
          imageUrl: overrides.imageUrl,
          title: "YouTube Music song",
          subtitle: "YouTube Music",
        },
        embed: {
          type: "iframe",
          src: "https://www.youtube-nocookie.com/embed/music123",
          title: "YouTube Music embed",
          height: 220,
          allow: "autoplay; encrypted-media; picture-in-picture; fullscreen",
        },
        apiBacked: true,
        fetchedAt: "2026-06-16T10:00:00Z",
        stale: false,
      },
    },
  };
}

function youtubeIntegrationCard(
  resourceId: string,
  sourceUrl: string,
  title = "YouTube video",
) {
  return {
    provider: "youtube",
    resourceType: "video",
    resourceId,
    resourceKey: `youtube:video:${resourceId}`,
    sourceUrl,
    metadata: {
      title,
      subtitle: "YouTube",
      imageUrl: null,
    },
    embed: {
      type: "iframe",
      src: `https://www.youtube-nocookie.com/embed/${resourceId}`,
      title: "YouTube embed",
      height: 220,
      allow: "autoplay; encrypted-media; picture-in-picture; fullscreen",
    },
    apiBacked: false,
    fetchedAt: "2026-06-16T10:00:00Z",
    stale: false,
  };
}

function youtubeVideoModule(overrides: { id?: number; position?: number } = {}) {
  const url = "https://www.youtube.com/watch?v=watch123";

  return {
    id: overrides.id ?? 7,
    type: "youtube_video",
    title: "YouTube video",
    config: {
      displayMode: "embed",
      label: "Build log",
      platform: "youtube",
      sourceMode: "youtube",
      url,
      integration: youtubeIntegrationCard("watch123", url, "Build log"),
    },
    visibility: "public",
    position: overrides.position ?? 1,
    status: "active",
    schemaVersion: 1,
    createdAt: "2026-06-12 00:00:00",
    updatedAt: "2026-06-12 00:00:00",
  };
}

function twitchStreamChatModule(
  overrides: { id?: number; position?: number; row?: number } = {},
) {
  return {
    ...creatorModule(overrides),
    layout: { column: 1, row: overrides.row ?? 1, colSpan: 6, rowSpan: 4 },
    config: {
      description: "Live channel.",
      displayMode: "stream_chat",
      label: "Thia live",
      platform: "twitch",
      sourceMode: "twitch",
      url: "https://www.twitch.tv/thiabun",
      integration: {
        provider: "twitch",
        resourceType: "channel",
        resourceId: "thiabun",
        resourceKey: "twitch:channel:thiabun",
        sourceUrl: "https://www.twitch.tv/thiabun",
        metadata: {
          title: "Thia live",
          subtitle: "Twitch",
          imageUrl: null,
        },
        embed: {
          type: "iframe",
          src: "https://player.twitch.tv/?channel=thiabun&parent=localhost&muted=true&autoplay=false",
          title: "Twitch stream",
          height: 360,
          allow: "autoplay; fullscreen; picture-in-picture",
        },
        apiBacked: true,
        fetchedAt: "2026-06-16T10:00:00Z",
        stale: false,
      },
    },
  };
}

function integrationResolveCard(url: string, provider: string) {
  const resolvedProvider = provider === "youtube" ? "youtube" : "twitch";
  const resourceId =
    resolvedProvider === "youtube"
      ? youtubeResourceIdFromUrl(url)
      : url.split("/").filter(Boolean).at(-1) ?? "thiabun";

  if (resolvedProvider === "youtube") {
    return {
      provider: "youtube",
      resourceType: "video",
      resourceId,
      resourceKey: `youtube:video:${resourceId}`,
      sourceUrl: url,
      metadata: {
        title: "YouTube video",
        subtitle: "YouTube",
        imageUrl: null,
      },
      embed: {
        type: "iframe",
        src: `https://www.youtube-nocookie.com/embed/${resourceId}`,
        title: "YouTube embed",
        height: 220,
        allow: "autoplay; encrypted-media; picture-in-picture; fullscreen",
      },
      apiBacked: false,
      fetchedAt: "2026-06-16T10:00:00Z",
      stale: false,
    };
  }

  return {
    provider: "twitch",
    resourceType: "channel",
    resourceId,
    resourceKey: `twitch:channel:${resourceId}`,
    sourceUrl: url,
    metadata: {
      title: "Thia live",
      subtitle: "Twitch",
      imageUrl: null,
    },
    embed: {
      type: "iframe",
      src: `https://player.twitch.tv/?channel=${resourceId}&parent=localhost&muted=true&autoplay=false`,
      title: "Twitch stream",
      height: 360,
      allow: "autoplay; fullscreen; picture-in-picture",
    },
    apiBacked: true,
    fetchedAt: "2026-06-16T10:00:00Z",
    stale: false,
  };
}

function youtubeResourceIdFromUrl(value: string): string {
  try {
    const url = new URL(value);
    const segments = url.pathname.split("/").filter(Boolean);

    if (url.hostname === "youtu.be" && segments[0]) {
      return segments[0];
    }

    if (segments[0] === "watch") {
      return url.searchParams.get("v") || "watch";
    }

    if (["shorts", "live", "embed"].includes(segments[0] ?? "") && segments[1]) {
      return segments[1];
    }
  } catch {
    return "youtube-video";
  }

  return value.split("/").filter(Boolean).at(-1) ?? "youtube-video";
}

function appleMusicEmbedModule(
  overrides: { id?: number; imageUrl?: string; position?: number } = {},
) {
  return {
    ...musicModule(overrides),
    config: {
      displayMode: "embed",
      label: "Apple song",
      platform: "apple_music",
      sourceMode: "apple_music",
      url: "https://music.apple.com/us/album/example/1",
      integration: {
        provider: "apple_music",
        resourceType: "song",
        resourceId: "1",
        resourceKey: "apple_music:song:1",
        sourceUrl: "https://music.apple.com/us/album/example/1",
        metadata: {
          imageUrl: overrides.imageUrl,
          title: "Apple song",
          subtitle: "Apple Music",
        },
        embed: {
          type: "iframe",
          src: "https://embed.music.apple.com/us/song/1",
          title: "Apple Music embed",
          height: 152,
          allow: "autoplay; encrypted-media; picture-in-picture; fullscreen",
        },
        apiBacked: false,
        fetchedAt: "2026-06-16T10:00:00Z",
        stale: false,
      },
    },
  };
}

function activityModule(
  overrides: {
    id?: number;
    title?: string | null;
    position?: number;
  } = {},
) {
  return {
    id: overrides.id ?? 9,
    type: "activity",
    title: overrides.title ?? "Feed",
    config: {},
    visibility: "public",
    position: overrides.position ?? 1,
    status: "active",
    schemaVersion: 1,
    createdAt: "2026-06-12 00:00:00",
    updatedAt: "2026-06-12 00:00:00",
  };
}

function roomFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    slug: "general",
    name: "General",
    summary: "Open conversation.",
    description: "Open conversation.",
    mood: "",
    members: 1,
    memberCount: 1,
    live: false,
    accent: "var(--accent-frost)",
    iconUrl: null,
    bannerUrl: null,
    visibility: "public",
    createdBy: 1,
    owner: null,
    joinedByMe: false,
    myRoomRole: null,
    postCount: 1,
    latestActivityAt: "2026-06-10 10:00:00",
    createdAt: "2026-06-10 10:00:00",
    updatedAt: "2026-06-10 10:00:00",
    ...overrides,
  };
}

function postFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: 42,
    body: "A profile post.",
    mood: "sunveil",
    mediaUrl: null,
    visibility: "public",
    status: "published",
    parentId: null,
    deletedAt: null,
    createdAt: "2026-06-10 10:00:00",
    updatedAt: "2026-06-10 10:00:00",
    author: {
      id: 1,
      handle: "thia",
      displayName: "Thia",
      initials: "T",
      aura: "frost",
      avatarUrl: null,
    },
    room: {
      id: 1,
      slug: "general",
      name: "General",
      summary: "Open conversation.",
      description: "Open conversation.",
      mood: "",
      members: 1,
      memberCount: 1,
      live: false,
      accent: "var(--accent-frost)",
      postCount: 1,
    },
    commentCount: 0,
    reactions: { glow: 0, echo: 0, hush: 0 },
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
