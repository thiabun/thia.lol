import { expect, type Locator, type Page, test } from "@playwright/test";
import { Buffer } from "node:buffer";
import { readFileSync } from "node:fs";
import { mockSpotifyIframeApi, spotifyPlayCalls } from "../helpers/spotify";

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
    "data-profile-canvas-fit-rows",
    "content",
  );
  await expect
    .poll(async () =>
      Number(
        await section
          .getByTestId("profile-module-grid")
          .getAttribute("data-profile-canvas-rows"),
      ),
    )
    .toBeLessThan(PROFILE_CANVAS_MOBILE_ROWS);
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

test("image modules fill surfaces and slideshow rotates", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 980 });
  await mockProfileModules(page, {
    authenticated: false,
    modules: [
      withAuditLayout(
        {
          id: 101,
          type: "uploaded_image",
          title: "Image",
          config: {
            mediaItems: [
              { url: "/uploads/media/2026/06/profile-image-one.webp" },
              { url: "/uploads/media/2026/06/profile-image-two.webp" },
            ],
          },
          visibility: "public",
          position: 1,
          status: "active",
          schemaVersion: 1,
          createdAt: "2026-06-12 00:00:00",
          updatedAt: "2026-06-12 00:00:00",
        },
        "4x3",
        1,
      ),
      withAuditLayout(
        {
          id: 102,
          type: "gallery_slideshow",
          title: "Slideshow",
          config: {
            mediaItems: [
              { url: "/uploads/media/2026/06/profile-slide-one.webp" },
              { url: "/uploads/media/2026/06/profile-slide-two.webp" },
            ],
          },
          visibility: "public",
          position: 2,
          status: "active",
          schemaVersion: 1,
          createdAt: "2026-06-12 00:00:00",
          updatedAt: "2026-06-12 00:00:00",
        },
        "3x3",
        1,
        5,
      ),
      withAuditLayout(
        {
          id: 103,
          type: "gallery_feed",
          title: "Gallery feed",
          config: {
            mediaItems: [
              { url: "/uploads/media/2026/06/profile-feed-one.webp" },
              { url: "/uploads/media/2026/06/profile-feed-two.webp" },
            ],
          },
          visibility: "public",
          position: 3,
          status: "active",
          schemaVersion: 1,
          createdAt: "2026-06-12 00:00:00",
          updatedAt: "2026-06-12 00:00:00",
        },
        "3x6",
        5,
      ),
    ],
  });
  await acknowledgeCookieNotice(page);
  await page.goto("/@thia");

  const imageModule = page.getByTestId("profile-grid-module-uploaded_image");
  const image = imageModule.getByTestId("profile-image-module-photo");
  await expect(image).toHaveCSS("object-fit", "cover");
  await expect(
    imageModule.locator('img[src="/uploads/media/2026/06/profile-image-two.webp"]'),
  ).toHaveCount(0);

  const fillMetrics = await imageModule.evaluate((module) => {
    const photo = module.querySelector<HTMLImageElement>(
      '[data-testid="profile-image-module-photo"]',
    );

    if (!photo) {
      throw new Error("Image module photo was not rendered.");
    }

    const moduleRect = module.getBoundingClientRect();
    const imageRect = photo.getBoundingClientRect();

    return {
      heightCoverage: imageRect.height / moduleRect.height,
      widthCoverage: imageRect.width / moduleRect.width,
    };
  });
  expect(fillMetrics.heightCoverage).toBeGreaterThan(0.95);
  expect(fillMetrics.widthCoverage).toBeGreaterThan(0.95);

  const slideshow = page
    .getByTestId("profile-grid-module-gallery_slideshow")
    .getByTestId("profile-slideshow-module");
  await expect(slideshow.getByTestId("profile-slideshow-slide")).toBeVisible();
  await expect(slideshow.getByTestId("profile-slideshow-dot-0")).toBeVisible();
  await expect(slideshow.getByTestId("profile-slideshow-dot-1")).toBeVisible();
  await expect(
    slideshow.locator('img[src="/uploads/media/2026/06/profile-slide-one.webp"]'),
  ).toBeVisible();
  await slideshow.getByTestId("profile-slideshow-dot-1").click();
  await expect(
    slideshow.locator('img[src="/uploads/media/2026/06/profile-slide-two.webp"]'),
  ).toBeVisible();
  await expect(
    slideshow.locator('img[src="/uploads/media/2026/06/profile-slide-one.webp"]'),
  ).toBeVisible({ timeout: 6500 });

  const feedImages = page
    .getByTestId("profile-grid-module-gallery_feed")
    .locator("figure img");
  await expect(feedImages).toHaveCount(2);
  const feedObjectFits = await feedImages.evaluateAll((images) =>
    images.map((item) => window.getComputedStyle(item).objectFit),
  );
  expect(feedObjectFits).toEqual(["cover", "cover"]);
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

test("public profile video background is marked playing outside editor mode", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  await mockProfileModules(page, {
    authenticated: false,
    profileOverrides: {
      profileBackgroundVideo: "/uploads/media/2026/06/profile_background-loop.mp4",
      profileBackgroundVideoPoster: "/uploads/media/2026/06/profile-video-poster.webp",
    },
    modules: [aboutModule({ title: "About", body: "Video background." })],
  });
  await acknowledgeCookieNotice(page);
  await page.goto("/@thia");

  const backdrop = page.getByTestId("profile-personal-backdrop");
  await expect(backdrop).toHaveAttribute("data-profile-background-source", "video");
  await expect(backdrop).toHaveAttribute("data-profile-background-playback", "playing");
  await expect(
    backdrop.locator('source[src="/uploads/media/2026/06/profile_background-loop.mp4"]'),
  ).toHaveAttribute("type", "video/mp4");
  await expect(
    backdrop.locator('img[src="/uploads/media/2026/06/profile-video-poster.webp"]'),
  ).toBeAttached();
  await expect
    .poll(() =>
      backdrop.locator("video").evaluate((video) => (video as HTMLVideoElement).autoplay),
    )
    .toBe(true);
});

test("editor mode pauses the full-page profile video background only", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  await mockProfileModules(page, {
    authenticated: true,
    profileOverrides: {
      profileBackgroundVideo: "/uploads/media/2026/06/profile_background-loop.mp4",
      profileBackgroundVideoPoster: "/uploads/media/2026/06/profile-video-poster.webp",
    },
    modules: [
      {
        id: 24,
        type: "uploaded_video",
        title: "Uploaded video",
        config: {
          configured: true,
          sourceMode: "upload",
          video: {
            duration: 12,
            mime: "video/mp4",
            size: 4096,
            title: "Module clip",
            type: "video/mp4",
            uploadedAt: "2026-06-16T10:00:00Z",
            url: "/uploads/media/2026/06/profile_module_video-clip.mp4",
          },
        },
        layout: { column: 1, row: 4, colSpan: 4, rowSpan: 3 },
        visibility: "public",
        position: 1,
        status: "active",
        schemaVersion: 1,
        createdAt: "2026-06-12 00:00:00",
        updatedAt: "2026-06-12 00:00:00",
      },
    ],
  });
  await acknowledgeCookieNotice(page);
  await page.goto("/@thia");

  const backdrop = page.getByTestId("profile-personal-backdrop");
  await expect(backdrop).toHaveAttribute("data-profile-background-source", "video");
  await expect(backdrop).toHaveAttribute("data-profile-background-playback", "playing");
  await expect(page.getByTestId("profile-uploaded-video-player")).toBeVisible();

  await page.getByTestId("profile-edit-button").click();
  await expect(page.getByTestId("profile-canvas-editor")).toBeVisible();
  await expect(backdrop).toHaveAttribute("data-profile-background-playback", "paused");
  await expect(
    backdrop.locator('img[src="/uploads/media/2026/06/profile-video-poster.webp"]'),
  ).toBeVisible();
  await expect(backdrop.locator("video")).not.toHaveAttribute("autoplay");
  await expect
    .poll(() =>
      backdrop.locator("video").evaluate((video) => (video as HTMLVideoElement).paused),
    )
    .toBe(true);
  await expect(page.getByTestId("profile-uploaded-video-player")).toBeVisible();
  await expect(page.getByTestId("profile-uploaded-video-element")).toBeAttached();

  await page
    .getByTestId("profile-canvas-editor")
    .getByRole("button", { name: "Cancel" })
    .click();
  await expect(page.getByTestId("profile-canvas-editor")).toHaveCount(0);
  await expect(backdrop).toHaveAttribute("data-profile-background-playback", "playing");
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
      metric.size === "3x2" || metric.size === "4x2" ? 88 : 52,
    );
  }
});

test("artist music modules render as custom artist cards instead of players", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  await mockProfileModules(page, {
    authenticated: false,
    modules: [
      withAuditLayout(spotifyArtistModule({ id: 66, position: 1 }), "4x3", 1),
    ],
  });
  await acknowledgeCookieNotice(page);
  await page.goto("/@thia");

  const module = page.getByTestId("profile-grid-module-spotify_artist");
  await expect(module).toBeVisible();
  await expect(module).toHaveAttribute("data-profile-grid-size", "4x3");
  await expect(module.getByTestId("profile-integration-artist-card")).toBeVisible();
  await expect(module.getByTestId("profile-integration-artist-card")).toHaveAttribute(
    "data-profile-artist-card-layout",
    "standard",
  );
  await expect(module.getByTestId("profile-integration-artist-image")).toHaveCSS(
    "object-fit",
    "cover",
  );
  await expect(module.getByTestId("profile-integration-artist-title")).toContainText(
    "Mili",
  );
  await expect(module.getByTestId("profile-integration-artist-genres")).toContainText(
    "art pop",
  );
  await expect(module.getByTestId("profile-integration-artist-stats")).toContainText(
    "followers",
  );
  await expect(module.getByTestId("profile-integration-artist-stat-followers")).toContainText(
    "followers",
  );
  await expect(module.getByTestId("profile-integration-artist-stat-listeners")).toHaveCount(
    0,
  );
  await expect(module.getByTestId("profile-spotify-custom-player")).toHaveCount(0);
  await expect(module.getByTestId("profile-spotify-play-button")).toHaveCount(0);
  await expect(module.getByTestId("profile-integration-embed-spotify")).toHaveCount(0);
});

test("roomy artist cards show listener stats without empty side panels", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await mockProfileModules(page, {
    authenticated: false,
    modules: [
      withAuditLayout(
        spotifyArtistModule({ id: 67, listeners: 84000000, position: 1 }),
        "6x4",
        1,
      ),
    ],
  });
  await acknowledgeCookieNotice(page);
  await page.goto("/@thia");

  const module = page.getByTestId("profile-grid-module-spotify_artist");
  await expect(module).toHaveAttribute("data-profile-grid-size", "6x4");
  await expect(module.getByTestId("profile-integration-artist-card")).toHaveAttribute(
    "data-profile-artist-card-layout",
    "spacious",
  );
  await expect(module.getByTestId("profile-integration-artist-stat-listeners")).toContainText(
    "monthly listeners",
  );
  await expect(module.getByTestId("profile-integration-artist-stat-popularity")).toContainText(
    "popularity",
  );

  const coverRatio = await module.evaluate((element) => {
    const card = element.querySelector('[data-testid="profile-integration-artist-card"]');
    const image = element.querySelector('[data-testid="profile-integration-artist-image"]');

    if (!(card instanceof HTMLElement) || !(image instanceof HTMLElement)) {
      return { height: 0, width: 0 };
    }

    const cardBox = card.getBoundingClientRect();
    const imageBox = image.getBoundingClientRect();

    return {
      height: imageBox.height / cardBox.height,
      width: imageBox.width / cardBox.width,
    };
  });

  expect(coverRatio.width).toBeGreaterThan(0.95);
  expect(coverRatio.height).toBeGreaterThan(0.95);
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

test("anonymous visitor can skip Spotify connect before profile music starts", async ({
  page,
}) => {
  await mockSpotifyIframeApi(page);
  await mockProfileModules(page, {
    authenticated: false,
    modules: [spotifyEmbedMusicModule()],
  });
  await acknowledgeCookieNotice(page);
  await page.goto("/@thia");

  const prompt = page.getByTestId("profile-spotify-entry-prompt");
  await expect(prompt).toBeVisible();
  await expect(page.getByTestId("profile-entry-gate")).toHaveAttribute(
    "data-profile-entry-gate-mode",
    "spotify-signin",
  );
  await expect(page.getByTestId("profile-spotify-entry-signin-link")).toHaveAttribute(
    "href",
    "/login?returnTo=%2F%40thia",
  );
  await expectSpotifyCustomPlayer(page);
  await expect.poll(() => spotifyPlayCalls(page)).toBe(0);

  const button = page.getByTestId("profile-spotify-entry-skip-button");
  await button.focus();
  await page.keyboard.press("Enter");

  await expect(prompt).toHaveCount(0);
  await expect.poll(() => spotifyPlayCalls(page)).toBe(1);
  await expectSpotifyProgress(page, { max: 38, min: 33 }, /1:0\d \/ 3:00/);
  const stored = await page.evaluate(() =>
    window.localStorage.getItem("thia.profile.musicAutoplayConsent.v1:1"),
  );
  const spotifySkip = await page.evaluate(() =>
    window.localStorage.getItem("thia.profile.spotifyConnectPromptSkip.v1:1"),
  );

  expect(stored).not.toBeNull();
  expect(JSON.parse(stored ?? "{}")).toMatchObject({
    handle: "thia",
    profileId: 1,
    provider: "spotify",
  });
  expect(spotifySkip).not.toBeNull();
  expect(JSON.parse(spotifySkip ?? "{}")).toMatchObject({
    handle: "thia",
    profileId: 1,
  });
});

test("Spotify entry skip ignores rapid duplicate clicks", async ({
  page,
}) => {
  await mockSpotifyIframeApi(page);
  await mockProfileModules(page, {
    authenticated: false,
    modules: [spotifyEmbedMusicModule()],
  });
  await acknowledgeCookieNotice(page);
  await page.goto("/@thia");

  const button = page.getByTestId("profile-spotify-entry-skip-button");
  await expect(button).toBeVisible();

  await button.dblclick();

  await expect(page.getByTestId("profile-spotify-entry-prompt")).toHaveCount(0);
  await expect.poll(() => spotifyPlayCalls(page)).toBe(1);
});

test("stored Spotify entry skip and music consent skip the entry gate", async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      "thia.profile.spotifyConnectPromptSkip.v1:1",
      JSON.stringify({
        handle: "thia",
        profileId: 1,
        skippedAt: "2026-06-17T00:00:00.000Z",
      }),
    );
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

  await expect(page.getByTestId("profile-entry-gate")).toHaveCount(0);
  await expect(page.getByTestId("profile-spotify-entry-prompt")).toHaveCount(0);
  await expect(page.getByTestId("profile-music-continue-overlay")).toHaveCount(0);
  await expectSpotifyCustomPlayer(page);
  await expect.poll(() => spotifyPlayCalls(page)).toBe(1);
  await expectSpotifyProgress(page, { max: 38, min: 33 }, /1:0\d \/ 3:00/);
});

test("invalid Spotify music consent falls back to the Spotify entry prompt", async ({
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

  await expect(page.getByTestId("profile-spotify-entry-prompt")).toBeVisible();
  await expect.poll(() => spotifyPlayCalls(page)).toBe(0);
});

test("stored Spotify entry skip suppresses the prompt on revisit", async ({
  page,
}) => {
  await mockProfileModules(page, {
    authenticated: false,
    modules: [spotifyArtistModule({ id: 67 })],
  });
  await acknowledgeCookieNotice(page);
  await page.goto("/@thia");

  await expect(page.getByTestId("profile-spotify-entry-prompt")).toBeVisible();
  await page.getByTestId("profile-spotify-entry-skip-button").click();
  await expect(page.getByTestId("profile-entry-gate")).toHaveCount(0);

  const spotifySkip = await page.evaluate(() =>
    window.localStorage.getItem("thia.profile.spotifyConnectPromptSkip.v1:1"),
  );

  expect(spotifySkip).not.toBeNull();
  expect(JSON.parse(spotifySkip ?? "{}")).toMatchObject({
    handle: "thia",
    profileId: 1,
  });

  await page.goto("/@thia");
  await expect(page.getByTestId("profile-entry-gate")).toHaveCount(0);
  await expect(page.getByTestId("profile-spotify-entry-prompt")).toHaveCount(0);
});

test("signed-in disconnected visitors can start Spotify OAuth from profile entry", async ({
  page,
}) => {
  let oauthStartPayload: Record<string, unknown> | undefined;

  await mockSpotifyIframeApi(page);
  await mockProfileModules(page, {
    authenticated: true,
    viewerHandle: "viewer",
    modules: [spotifyEmbedMusicModule()],
    integrations: {
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
          authorizationUrl: "/@thia?integrationProvider=spotify&integrationStatus=connected",
          stateExpiresIn: 600,
        },
      }),
    });
  });
  await acknowledgeCookieNotice(page);
  await page.goto("/@thia");

  await expect(page.getByTestId("profile-spotify-entry-prompt")).toBeVisible();
  await expect(page.getByTestId("profile-entry-gate")).toHaveAttribute(
    "data-profile-entry-gate-mode",
    "spotify-connect",
  );
  await page.getByTestId("profile-spotify-entry-connect-button").click();

  await expect
    .poll(() => oauthStartPayload?.redirectPath)
    .toBe("/@thia");
});

test("connected Spotify visitors do not see the OAuth prompt", async ({
  page,
}) => {
  await mockSpotifyIframeApi(page);
  await mockProfileModules(page, {
    authenticated: true,
    viewerHandle: "viewer",
    modules: [spotifyEmbedMusicModule()],
    integrations: {
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
      accounts: [
        {
          provider: "spotify",
          providerAccountId: "spotify-viewer",
          providerHandle: "viewer",
          displayName: "Viewer",
          avatarUrl: null,
          scopes: ["user-read-private"],
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

  await expect(page.getByTestId("profile-spotify-entry-prompt")).toHaveCount(0);
  await expect(page.getByTestId("profile-music-continue-overlay")).toBeVisible();
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

test("Spotify entry prompt can appear even when autoplay follows the first music module", async ({
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

  await expect(page.getByTestId("profile-spotify-entry-prompt")).toBeVisible();
  await expect(page.getByTestId("profile-music-continue-overlay")).toHaveCount(0);
  await page.getByTestId("profile-spotify-entry-skip-button").click();
  await expect(page.getByTestId("profile-entry-gate")).toHaveCount(0);
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

  await page.getByTestId("profile-spotify-entry-skip-button").click();

  await expect(page.getByTestId("profile-entry-gate")).toHaveCount(0);
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
  await expect(module.getByTestId("profile-social-context")).toContainText("Stars");
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
  expect(statStyles).toHaveLength(4);
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
    const bannerBleed = document.querySelector<HTMLElement>(
      '[data-testid="profile-grid-module-profile_info"] [data-testid="profile-header-banner-card-bleed"]',
    );
    const actionRail = document.querySelector<HTMLElement>(
      '[data-testid="profile-grid-module-profile_info"] [data-testid="profile-info-action-rail"]',
    );
    const actionMenu = document.querySelector<HTMLElement>(
      '[data-testid="profile-grid-module-profile_info"] [data-testid="profile-info-actions-menu"]',
    );

    if (!moduleElement || !headerElement || !bannerElement || !bannerImage || !bannerBleed || !actionRail || !actionMenu) {
      throw new Error("Profile info module, header, banner, or actions did not render.");
    }

    const moduleRect = moduleElement.getBoundingClientRect();
    const bannerRect = bannerElement.getBoundingClientRect();
    const bannerBleedRect = bannerBleed.getBoundingClientRect();
    const actionRailRect = actionRail.getBoundingClientRect();
    const actionMenuRect = actionMenu.getBoundingClientRect();

    return {
      actionMenuBottom: Math.round(actionMenuRect.bottom),
      actionMenuRight: Math.round(actionMenuRect.right),
      actionRailRight: Math.round(actionRailRect.right),
      bannerBleedBottom: Math.round(bannerBleedRect.bottom),
      bannerBottom: Math.round(bannerRect.bottom),
      bannerHeight: Math.round(bannerRect.height),
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
  expect(metrics.bannerHeight).toBeGreaterThan(metrics.moduleHeight * 0.24);
  expect(metrics.bannerHeight).toBeLessThan(metrics.moduleHeight * 0.46);
  expect(metrics.bannerBleedBottom).toBeGreaterThan(metrics.bannerBottom);
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
        isMoot: true,
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
    await expect(socialContext).toContainText("Stars");
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
    await expect(module.getByTestId("profile-info-badge-row")).toHaveCount(0);
    if (["6x3", "8x3", "8x4"].includes(profileInfoCase.size)) {
      await expect(module.getByTestId("profile-info-inline-badges")).toContainText("Founder");
      const profileInfoChipMetrics = await module
        .getByTestId("profile-info-identity-row")
        .evaluate((element) => {
          const badgeElements = Array.from(
            element.querySelectorAll<HTMLElement>("span"),
          )
            .filter((badge) => badge.className.includes("inline-flex"))
            .map((badge) => {
              const rect = badge.getBoundingClientRect();

              return {
                height: Math.round(rect.height),
                text: badge.textContent?.trim() ?? "",
              };
            });

          return {
            featured: badgeElements.find((badge) => badge.text === "Founder"),
            moot: badgeElements.find((badge) => badge.text === "Moot"),
          };
        });

      expect(profileInfoChipMetrics.moot?.height).toBe(
        profileInfoChipMetrics.featured?.height,
      );
    } else {
      await expect(module.getByTestId("profile-info-inline-badges")).toHaveCount(0);
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
      "Stars",
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
    const measuredElements = [
      ["header", headerElement],
      [
        "profile info",
        element.querySelector<HTMLElement>('[data-testid="profile-module-profile-info"]'),
      ],
      [
        "avatar",
        element.querySelector<HTMLElement>('[data-testid="profile-info-avatar-frame"]'),
      ],
      [
        "identity",
        element.querySelector<HTMLElement>('[data-testid="profile-info-identity-row"]'),
      ],
      ["bio", bioElement],
      [
        "badges",
        element.querySelector<HTMLElement>('[data-testid="profile-info-inline-badges"]'),
      ],
      [
        "stats",
        element.querySelector<HTMLElement>('[data-testid="profile-social-context"]'),
      ],
      [
        "actions",
        element.querySelector<HTMLElement>('[data-testid="profile-info-action-rail"]'),
      ],
    ] as const;
    const boundedElements = measuredElements
      .filter((entry): entry is readonly [string, HTMLElement] => Boolean(entry[1]))
      .map(([name, node]) => {
        const rect = node.getBoundingClientRect();

        return {
          name,
          bottom: rect.bottom,
          height: rect.height,
          left: rect.left,
          right: rect.right,
          top: rect.top,
        };
      });
    const outOfBounds = boundedElements
      .filter(
        (item) =>
          item.height > 0 &&
          (item.top < headerRect.top - 1 ||
            item.left < headerRect.left - 1 ||
            item.right > headerRect.right + 1 ||
            item.bottom > headerRect.bottom + 1),
      )
      .map((item) => item.name);
    const statsElement = element.querySelector<HTMLElement>(
      '[data-testid="profile-social-context"]',
    );
    const statOutOfBounds = statsElement
      ? Array.from(statsElement.querySelectorAll<HTMLElement>("[data-profile-info-stat]"))
          .filter((stat) => {
            const rect = stat.getBoundingClientRect();

            return (
              rect.top < headerRect.top - 1 ||
              rect.left < headerRect.left - 1 ||
              rect.right > headerRect.right + 1 ||
              rect.bottom > headerRect.bottom + 1
            );
          })
          .map((stat) => stat.getAttribute("data-profile-info-stat") ?? "unknown")
      : ["stats missing"];
    const banner = element.querySelector<HTMLElement>(
      '[data-testid="profile-header-banner"]',
    );
    const bannerCardBleed = element.querySelector<HTMLElement>(
      '[data-testid="profile-header-banner-card-bleed"]',
    );
    const avatarElement = element.querySelector<HTMLElement>(
      '[data-testid="profile-info-avatar-frame"]',
    );
    const bannerRect = banner?.getBoundingClientRect();
    const bannerCardBleedRect = bannerCardBleed?.getBoundingClientRect();
    const avatarRect = avatarElement?.getBoundingClientRect();
    const bodyElement = banner?.nextElementSibling as HTMLElement | null;
    const bodyStyles = bodyElement ? window.getComputedStyle(bodyElement) : null;
    const bleedStyles = bannerCardBleed
      ? window.getComputedStyle(bannerCardBleed)
      : null;
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
      bodyBackgroundImage: bodyStyles?.backgroundImage ?? "",
      bodyClassName: bodyElement?.className ?? "",
      bodyBleedLayerCount: element.querySelectorAll<HTMLElement>(
        '[data-testid="profile-header-banner-card-bleed"]',
      ).length,
      oldBleedLayerCount: element.querySelectorAll<HTMLElement>(
        '[data-testid="profile-header-banner-bleed"], [data-testid="profile-header-banner-body-bleed"]',
      ).length,
      bannerCardBleedExtends:
        bannerCardBleedRect && bannerRect
          ? bannerCardBleedRect.bottom > bannerRect.bottom
          : false,
      bannerCardBleedMask:
        bleedStyles?.getPropertyValue("mask-image") ||
        bleedStyles?.getPropertyValue("-webkit-mask-image") ||
        "",
      bannerCardBleedOpacity: bleedStyles?.opacity ?? "",
      avatarOverlapsBannerBoundary:
        avatarRect && bannerRect
          ? avatarRect.top < bannerRect.bottom - 2 &&
            avatarRect.bottom > bannerRect.bottom + 2
          : false,
      expectedModuleHeight: Math.round(cellSize * rowSpan + rowGap * (rowSpan - 1)),
      expectedModuleWidth: Math.round(
        cellSize * colSpan + columnGap * (colSpan - 1),
      ),
      headerBottom: headerRect.bottom,
      headerClientHeight: headerElement.clientHeight,
      headerHeight: Math.round(headerRect.height),
      headerRight: headerRect.right,
      headerScrollHeight: headerElement.scrollHeight,
      headerWidth: Math.round(headerRect.width),
      moduleBottom: moduleRect.bottom,
      moduleHeight: Math.round(moduleRect.height),
      moduleRight: moduleRect.right,
      moduleWidth: Math.round(moduleRect.width),
      outOfBounds,
      statOutOfBounds,
    };
    });

    expect(Math.abs(metrics.moduleWidth - metrics.expectedModuleWidth)).toBeLessThanOrEqual(2);
    expect(Math.abs(metrics.moduleHeight - metrics.expectedModuleHeight)).toBeLessThanOrEqual(2);
    expect(metrics.headerWidth).toBeGreaterThanOrEqual(metrics.moduleWidth - 2);
    expect(metrics.headerHeight).toBeGreaterThanOrEqual(metrics.moduleHeight - 2);
    expect(metrics.headerRight).toBeLessThanOrEqual(metrics.moduleRight + 1);
    expect(metrics.headerBottom).toBeLessThanOrEqual(metrics.moduleBottom + 1);
    expect(metrics.outOfBounds).toEqual([]);
    expect(metrics.statOutOfBounds).toEqual([]);
    expect(metrics.headerScrollHeight).toBeLessThanOrEqual(metrics.headerClientHeight + 2);
    if (profileInfoCase.size !== "3x2") {
      expect(metrics.bioOverflow).toBe("hidden");
      expect(metrics.bioLineClamp).not.toBe("none");
    }
    if (["4x3", "6x3", "8x3", "8x4"].includes(profileInfoCase.size)) {
      expect(metrics.bodyBleedLayerCount).toBe(1);
      expect(metrics.oldBleedLayerCount).toBe(0);
      expect(metrics.bannerCardBleedExtends).toBe(true);
      expect(metrics.bannerCardBleedMask).toContain("linear-gradient");
      expect(metrics.bannerCardBleedMask).toMatch(/transparent|rgba\(0, 0, 0, 0\)/);
      expect(Number.parseFloat(metrics.bannerCardBleedOpacity)).toBeLessThanOrEqual(0.2);
      expect(metrics.bodyBackgroundImage).toContain("linear-gradient");
      expect(metrics.bodyClassName).toContain("from-surface/0");
      expect(metrics.bodyClassName).not.toContain("via-surface");
      expect(metrics.avatarOverlapsBannerBoundary).toBe(true);
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
  await expect(youtubeVideo).toContainText("(5x2)");

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
  await expect(configuredContent).toHaveAttribute(
    "data-profile-editor-render-mode",
    "light",
  );
  await expect(
    configuredContent.locator('[data-testid^="profile-canvas-light-preview-"]'),
  ).toBeVisible();
  await expect(
    configuredContent.evaluate((element) => window.getComputedStyle(element).filter),
  ).resolves.toBe("none");
  await expect(configuredContent).toHaveAttribute(
    "data-profile-canvas-module-frame",
    "light",
  );
  await expect
    .poll(() =>
      configuredContent.evaluate(
        (element) => window.getComputedStyle(element).scale,
      ),
    )
    .toBe("none");
  await expect(
    page
      .getByTestId("profile-canvas-direct-grid")
      .locator("iframe, video, audio"),
  ).toHaveCount(0);
  const configuredModuleShell = page.locator(
    '[data-testid^="profile-canvas-module-"][data-profile-grid-module="true"]',
    {
      has: page.getByText("Canvas note configured from settings."),
    },
  );
  await expect(configuredModuleShell).toHaveAttribute(
    "data-profile-grid-layout-animation",
    "false",
  );
  const configuredPinButton = configuredModuleShell.locator(
    '[data-testid^="profile-canvas-pin-module-"]',
  );
  const configuredRemoveButton = configuredModuleShell.locator(
    '[data-testid^="profile-canvas-remove-module-"]',
  );
  await expect(configuredPinButton).toBeVisible();
  await expect(configuredPinButton).toHaveAttribute("aria-pressed", "false");
  await expect(configuredRemoveButton).toBeVisible();
  await expect(
    page
      .getByTestId("profile-canvas-module-9001")
      .locator('[data-testid^="profile-canvas-remove-module-"]'),
  ).toHaveCount(0);
  await expect(
    page.getByTestId("profile-module-settings").getByRole("button", { name: /^Pin$/ }),
  ).toHaveCount(0);
  await expect(
    page.getByTestId("profile-module-settings").getByRole("button", { name: /^Unpin$/ }),
  ).toHaveCount(0);
  await page.getByTestId("profile-module-settings-done").click();
  await expect(page.getByTestId("profile-module-settings")).toHaveCount(0);
  const eastResizeHandle = configuredModuleShell.getByRole("button", {
    name: "Resize from right edge",
  });
  await expect(eastResizeHandle).toBeVisible();
  const eastHandleBox = await eastResizeHandle.boundingBox();
  expect(eastHandleBox).not.toBeNull();
  await page.mouse.move(
    eastHandleBox!.x + eastHandleBox!.width / 2,
    eastHandleBox!.y + eastHandleBox!.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    eastHandleBox!.x + eastHandleBox!.width / 2 + 150,
    eastHandleBox!.y + eastHandleBox!.height / 2,
    { steps: 6 },
  );
  await expect(page.getByTestId("profile-canvas-resize-preview")).toBeVisible();
  await page.mouse.up();
  await expect(page.getByTestId("profile-canvas-resize-preview")).toHaveCount(0);
  await expect(configuredModuleShell).toHaveAttribute("data-profile-grid-size", "6x2");
  await expect
    .poll(() => draftPayload?.modules)
    .toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          config: expect.objectContaining({ canvasSize: "6x2" }),
          layout: expect.objectContaining({ colSpan: 6, rowSpan: 2 }),
          type: "text",
        }),
      ]),
    );
  await configuredPinButton.click();
  await expect(configuredPinButton).toHaveAttribute("aria-pressed", "true");
  const pinnedShell = page.locator(
    '[data-testid^="profile-canvas-module-"][data-profile-module-pinned="true"]',
  );
  await expect(pinnedShell).toBeVisible();
  await expect(
    configuredModuleShell
      .getByRole("button", { name: "Unpin this module before resizing" })
      .first(),
  ).toBeDisabled();
  await expect(configuredModuleShell.locator('[data-testid^="profile-canvas-drag-handle-"]')).toHaveCount(0);
  await expect
    .poll(() =>
      pinnedShell.evaluate((element) => window.getComputedStyle(element).outlineWidth),
    )
    .toBe("2px");
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
      colSpan: 6,
      rowSpan: 2,
    },
    pinned: true,
    visibility: "public",
  });
});

test("direct canvas renders configured modules as light previews", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  await mockProfileModules(page, {
    authenticated: true,
    modules: [
      withAuditLayout(spotifyEmbedMusicModule({ id: 21, position: 2 }), "4x2", 4, 1),
      withAuditLayout(youtubeVideoModule({ id: 22, position: 3 }), "5x2", 4, 5),
      withAuditLayout(uploadedMp3MusicModule({ id: 23, position: 4 }), "4x2", 6, 1),
      withAuditLayout(galleryModule({ id: 24, position: 5 }), "3x2", 6, 5),
      withAuditLayout(activityModule({ id: 25, position: 6 }), "5x2", 8, 1),
    ],
    profilePosts: [
      postFixture({ id: 301, body: "This should not render as a live post card." }),
    ],
  });
  await acknowledgeCookieNotice(page);
  await page.goto("/@thia");

  await page.getByTestId("profile-edit-button").click();

  const grid = page.getByTestId("profile-canvas-direct-grid");
  await expect(grid).toBeVisible();
  await expect(grid.locator("iframe, video, audio")).toHaveCount(0);
  await expect(grid.getByTestId("profile-canvas-light-preview-21")).toBeVisible();
  await expect(grid.getByTestId("profile-canvas-light-preview-22")).toBeVisible();
  await expect(grid.getByTestId("profile-canvas-light-preview-23")).toBeVisible();
  await expect(grid.getByTestId("profile-canvas-light-preview-24")).toBeVisible();
  await expect(grid.getByTestId("profile-canvas-light-preview-25")).toBeVisible();
  await expect(grid.getByTestId("profile-spotify-custom-player")).toHaveCount(0);
  await expect(grid.getByTestId("profile-uploaded-audio-player")).toHaveCount(0);
  await expect(grid.getByTestId("profile-uploaded-video-player")).toHaveCount(0);
  await expect(grid.getByTestId("post-card")).toHaveCount(0);
});

test("profile editor guide launches from onboarding tour query and can replay", async ({
  page,
}) => {
  const onboardingPatches: Array<Record<string, unknown>> = [];

  await page.setViewportSize({ width: 1366, height: 900 });
  await mockProfileModules(page, {
    authenticated: true,
    modules: [aboutModule({ id: 1, body: "Guide target." })],
    onOnboardingUpdate: (payload) => onboardingPatches.push(payload),
  });
  await acknowledgeCookieNotice(page);
  await page.goto("/@thia?editCanvas=1&tour=profile-editor");

  await expect(page.getByTestId("profile-canvas-editor")).toBeVisible();
  await expect(page.getByTestId("profile-editor-guide")).toBeVisible();
  await expect(page.getByTestId("profile-editor-guide")).toContainText("Set the stage");
  await expect(page.getByTestId("profile-editor-guide")).toContainText("1/5");
  await expect(page.getByTestId("profile-editor-guide-target-highlight")).toBeVisible();
  await expect(page).toHaveURL(/editCanvas=1/);
  await expect(page).not.toHaveURL(/tour=profile-editor/);
  await expect(page.getByTestId("page-loading-overlay")).toHaveCount(0);

  await page.getByTestId("profile-editor-guide-next").click();
  await expect(page.getByTestId("profile-editor-guide")).toContainText("Pick a space");
  await expect(page.getByTestId("profile-editor-guide")).toContainText(
    "Select two cells to choose where your first module lives.",
  );
  await expect(page.getByTestId("profile-editor-guide")).toContainText("2/5");
  await expect(page.getByTestId("profile-editor-guide")).toHaveAttribute(
    "data-profile-editor-guide-step",
    "grid",
  );
  await expect(page.getByTestId("profile-editor-guide-target-highlight")).toBeVisible();

  await page.getByTestId("profile-editor-guide-back").click();
  await expect(page.getByTestId("profile-editor-guide")).toContainText("Set the stage");

  for (let step = 0; step < 4; step += 1) {
    await page.getByTestId("profile-editor-guide-next").click();
  }

  await expect(page.getByTestId("profile-editor-guide")).toContainText("Save the canvas");
  await page.getByTestId("profile-editor-guide-done").click();
  await expect(page.getByTestId("profile-editor-guide")).toHaveCount(0);
  await expect
    .poll(() =>
      onboardingPatches.some(
        (patch) =>
          patch.action === "complete_step" && patch.step === "profile_canvas",
      ),
    )
    .toBe(true);

  await page.getByTestId("profile-editor-guide-button").click();
  await expect(page.getByTestId("profile-editor-guide")).toBeVisible();
  await page.getByTestId("profile-editor-guide-dismiss").click();
  await expect(page.getByTestId("profile-editor-guide")).toHaveCount(0);
});

test("saving the profile canvas marks onboarding canvas complete", async ({
  page,
}) => {
  const onboardingPatches: Array<Record<string, unknown>> = [];

  await page.setViewportSize({ width: 1366, height: 900 });
  await mockProfileModules(page, {
    authenticated: true,
    modules: [aboutModule({ id: 1, body: "Save target." })],
    onOnboardingUpdate: (payload) => onboardingPatches.push(payload),
  });
  await acknowledgeCookieNotice(page);
  await page.goto("/@thia?editCanvas=1");

  await expect(page.getByTestId("profile-canvas-editor")).toBeVisible();
  await page.getByTestId("profile-canvas-save-button").click();

  await expect
    .poll(() =>
      onboardingPatches.some(
        (patch) =>
          patch.action === "complete_step" && patch.step === "profile_canvas",
      ),
    )
    .toBe(true);
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

test("direct canvas keeps 4x6 activity light in editor and public after save", async ({
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
    { hasText: "Feed" },
  );
  await expect(activityContent).toHaveAttribute(
    "data-profile-canvas-module-configured",
    "true",
  );
  await expect(activityContent).toHaveAttribute(
    "data-profile-editor-render-mode",
    "light",
  );
  await expect(activityContent).toHaveAttribute(
    "data-profile-canvas-module-frame",
    "light",
  );
  await expect(activityContent).toHaveAttribute(
    "data-profile-module-content-interactive",
    "false",
  );
  await expect(activityContent).toHaveAttribute("inert", "");
  await expect(activityContent.getByTestId("profile-activity")).toHaveCount(0);
  await expect(activityContent.getByTestId("post-body-open-thread")).toHaveCount(0);
  await expect(page.getByTestId("thread-modal")).toHaveCount(0);
  await page.getByTestId("profile-module-settings-done").click();
  await expect(page.getByTestId("profile-module-settings")).toHaveCount(0);

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

test("public profile grid trims trailing empty desktop rows", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await mockProfileModules(page, {
    authenticated: false,
    modules: [withAuditLayout(profileInfoModule(), "8x3", 1, 1)],
  });
  await acknowledgeCookieNotice(page);
  await page.goto("/@thia");

  const grid = page.getByTestId("profile-module-grid");
  await expect(grid).toHaveAttribute("data-profile-canvas-fit-rows", "content");
  await expect(grid).toHaveAttribute(
    "data-profile-canvas-columns",
    String(PROFILE_CANVAS_COLUMNS),
  );
  await expectGridRowBudget(grid, 3);

  const metrics = await grid.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const styles = window.getComputedStyle(element);

    return {
      borderRadius: Number.parseFloat(styles.borderTopLeftRadius),
      hasHorizontalOverflow:
        document.documentElement.scrollWidth > document.documentElement.clientWidth,
      height: rect.height,
    };
  });

  expect(metrics.borderRadius).toBeGreaterThan(0);
  expect(metrics.hasHorizontalOverflow).toBe(false);
  expect(metrics.height).toBeGreaterThan(0);
});

test("public profile grid preserves intentional middle gaps while trimming after content", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await mockProfileModules(page, {
    authenticated: false,
    modules: [
      withAuditLayout(profileInfoModule(), "8x3", 1, 1),
      withAuditLayout(
        aboutModule({ id: 12, title: "Lower note", body: "Kept below a gap." }),
        "3x2",
        6,
        1,
      ),
    ],
  });
  await acknowledgeCookieNotice(page);
  await page.goto("/@thia");

  const grid = page.getByTestId("profile-module-grid");
  const profileInfo = page.getByTestId("profile-grid-module-profile_info");
  const lowerNote = page.getByTestId("profile-grid-module-about");

  await expectGridRowBudget(grid, 7);

  const gap = await profileInfo.evaluate((element) => {
    const note = document.querySelector<HTMLElement>(
      '[data-testid="profile-grid-module-about"]',
    );

    if (!note) {
      throw new Error("Lower note module did not render.");
    }

    const profileRect = element.getBoundingClientRect();
    const noteRect = note.getBoundingClientRect();

    return noteRect.top - profileRect.bottom;
  });

  expect(gap).toBeGreaterThan(40);
  await expect(lowerNote).toBeVisible();
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
  await page.getByTestId("profile-canvas-cell-1-11").click();
  await page.getByTestId("profile-canvas-cell-2-12").click();
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
  await page.getByTestId("profile-canvas-cell-1-10").click();
  await page.getByTestId("profile-canvas-cell-2-11").click();
  await expect(page.getByTestId("profile-module-picker")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator('[data-testid^="profile-canvas-add-module-"]')).toBeVisible();
  await page.getByTestId("profile-canvas-save-button").click();

  await expect.poll(() => commitPayload).toBeDefined();
  const committedModules = commitPayload?.modules as Array<Record<string, unknown>>;
  expect(committedModules.some((module) => module.type === "placeholder")).toBe(false);
  expect(committedModules.map((module) => module.type)).toEqual([
    "profile_info",
    "activity",
  ]);
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
  const blankStartColumn = 1;
  await page.getByTestId("profile-canvas-cell-1-10").click();
  await page.getByTestId("profile-canvas-cell-2-11").click();
  await expect(page.getByTestId("profile-module-picker")).toBeVisible();
  await page.keyboard.press("Escape");

  const blankModule = page.locator('[data-testid^="profile-canvas-blank-module-"]');
  await expect(blankModule).toBeVisible();
  await expect
    .poll(() => {
      const layout = placeholderDraftModule(draftPayload)?.layout as
        | Record<string, unknown>
        | undefined;

      return Number(layout?.column ?? 0);
    })
    .toBe(blankStartColumn);
  const placeholderShell = page.locator('[data-testid^="profile-canvas-module-"]', {
    has: blankModule,
  });
  const placeholderPinButton = placeholderShell.locator(
    '[data-testid^="profile-canvas-pin-module-"]',
  );
  await expect(placeholderPinButton).toBeVisible();
  await expect(
    page.locator('[data-testid^="profile-canvas-delete-placeholder-"]'),
  ).toBeVisible();
  await expect(placeholderShell).toHaveAttribute(
    "data-profile-grid-layout-animation",
    "false",
  );

  await placeholderPinButton.click();
  await expect(
    page.locator('[data-testid^="profile-canvas-module-"][data-profile-module-pinned="true"]'),
  ).toBeVisible();
  await expect
    .poll(() => placeholderDraftModule(draftPayload)?.pinned)
    .toBe(true);

  await expect(placeholderPinButton).toHaveAttribute("aria-pressed", "true");
  await placeholderPinButton.click();
  await expect
    .poll(() => placeholderDraftModule(draftPayload)?.pinned)
    .toBe(false);
  await expect(placeholderPinButton).toHaveAttribute("aria-pressed", "false");

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
  await expect(page.getByTestId("profile-canvas-drag-preview")).toBeVisible();
  await expect(page.getByTestId("profile-canvas-drag-preview")).toHaveAttribute(
    "data-profile-grid-layout-animation",
    "false",
  );
  await expect
    .poll(() => {
      const layout = placeholderDraftModule(draftPayload)?.layout as
        | Record<string, unknown>
        | undefined;

      return Number(layout?.column ?? blankStartColumn);
    })
    .toBe(blankStartColumn);
  await page.dispatchEvent("body", "pointerup", {
    ...pointerTarget,
    buttons: 0,
  });
  await expect(page.getByTestId("profile-canvas-drag-preview")).toHaveCount(0);
  await expect
    .poll(() => {
      const layout = placeholderDraftModule(draftPayload)?.layout as
        | Record<string, unknown>
        | undefined;

      return Number(layout?.column ?? blankStartColumn);
    })
    .toBeGreaterThan(blankStartColumn);

  await page.locator('[data-testid^="profile-canvas-delete-placeholder-"]').click();
  await expect(page.locator('[data-testid^="profile-canvas-blank-module-"]')).toHaveCount(0);
  await expect
    .poll(() => Boolean(placeholderDraftModule(draftPayload)))
    .toBe(false);
});

test("direct canvas remove control deletes configured modules without opening settings", async ({
  page,
}) => {
  let draftPayload: Record<string, unknown> | undefined;

  await mockProfileModules(page, {
    authenticated: true,
    modules: [
      withAuditLayout(
        aboutModule({ id: 1, title: "About", body: "Remove me from canvas." }),
        "3x2",
        4,
        4,
      ),
    ],
    onCanvasDraftSave: (payload) => {
      draftPayload = payload;
    },
  });
  await acknowledgeCookieNotice(page);
  await page.goto("/@thia");

  await page.getByTestId("profile-edit-button").click();

  const moduleShell = page.getByTestId("profile-canvas-module-1");
  await expect(moduleShell).toBeVisible();
  await expect(moduleShell).toHaveAttribute(
    "data-profile-grid-layout-animation",
    "false",
  );
  await expect(page.getByTestId("profile-canvas-remove-module-1")).toBeVisible();
  await expect(
    page
      .getByTestId("profile-canvas-module-9001")
      .locator('[data-testid^="profile-canvas-remove-module-"]'),
  ).toHaveCount(0);

  await page.getByTestId("profile-canvas-remove-module-1").click();

  await expect(page.getByTestId("profile-module-settings")).toHaveCount(0);
  await expect(page.getByTestId("profile-canvas-module-1")).toHaveCount(0);
  await expect
    .poll(() => {
      const modules = Array.isArray(draftPayload?.modules)
        ? (draftPayload.modules as Array<Record<string, unknown>>)
        : [];
      const removed = modules.find((module) => module.id === 1);

      return `${removed?.status ?? ""}:${removed?.visibility ?? ""}`;
    })
    .toBe("deleted:hidden");
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
  expect(backgroundImageAccept).toContain("image/gif");
  expect(backgroundImageAccept).toContain("image/avif");
  expect(backgroundImageAccept).toContain(".heic");
  expect(backgroundImageAccept).toContain("image/tiff");
  expect(backgroundImageAccept).toContain(".bmp");
  expect(backgroundVideoAccept).toContain("video/webm");
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

test("profile-info settings change avatar and banner through crop controls", async ({
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
  await expect(settings.getByText(/^Picture$/)).toHaveCount(0);
  await expect(settings.getByText(/^Avatar$/)).toBeVisible();
  await expect(settings.getByTestId("profile-info-avatar-edit-overlay")).toBeVisible();
  await expect(settings.getByTestId("profile-info-banner-edit-overlay")).toBeVisible();
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

test("image module settings crop and replace a single photo", async ({ page }) => {
  const uploadPurposes: string[] = [];
  let draftPayload: Record<string, unknown> | undefined;

  await mockProfileModules(page, {
    authenticated: true,
    modules: [
      {
        id: 12,
        type: "uploaded_image",
        title: "Image",
        config: {
          configured: true,
          mediaItems: [
            { url: "/uploads/media/2026/06/existing-module-photo.webp" },
          ],
        },
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
  await expect(settings.getByText("Photo")).toBeVisible();
  await expect(settings.getByText("Replace")).toBeVisible();
  await expect(settings.getByTestId("profile-module-media-item-0")).toBeVisible();
  await expect(settings.getByTestId("profile-module-media-item-1")).toHaveCount(0);
  await expect(settings.getByTestId("profile-module-settings-image-input")).not.toHaveAttribute(
    "multiple",
    "",
  );
  await settings
    .getByTestId("profile-module-settings-image-input")
    .setInputFiles(samplePngFile("module-photo-one.png"));

  await expect(page.getByTestId("image-crop-modal")).toBeVisible();
  await expect(page.getByTestId("image-crop-aspect-original")).toBeVisible();
  await page.getByRole("button", { name: "Apply crop" }).click();
  await expect(page.getByTestId("image-crop-modal")).toHaveCount(0);
  await expect.poll(() => uploadPurposes).toEqual(["post_media"]);

  await expect(settings.getByTestId("profile-module-media-item-0")).toBeVisible();
  await expect(settings.getByTestId("profile-module-media-item-1")).toHaveCount(0);
  await expect
    .poll(() => {
      const config = moduleConfigFromDraft(draftPayload, 12);
      const mediaItems = Array.isArray(config?.mediaItems)
        ? config.mediaItems
        : [];
      const firstItem = mediaItems[0] as Record<string, unknown> | undefined;

      return JSON.stringify({
        configured: config?.configured,
        mediaCount: mediaItems.length,
        url: firstItem?.url,
      });
    })
    .toBe(
      JSON.stringify({
        configured: true,
        mediaCount: 1,
        url: "/uploads/media/2026/06/post_media-cropped.webp",
      }),
    );
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
  expect(videoAccept).toContain("video/mp4");
  expect(videoAccept).toContain("video/webm");
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
      posterUrl: "/uploads/media/2026/06/profile_module_video-clip-poster.webp",
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
  const profileModules = readFileSync(
    "src/components/social/ProfileModules.tsx",
    "utf8",
  );
  const roomEditor = readFileSync(
    "src/components/social/RoomEditModal.tsx",
    "utf8",
  );
  const shareCardScene = readFileSync(
    "src/components/share/ShareCardScene.tsx",
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
    expect(source).toContain("prepareImageFileForCrop");
  }

  expect(profilePage).toContain("imageUploadAccept");
  expect(roomEditor).toContain("imageUploadAccept");
  expect(postComposer).toContain("visualMediaUploadAccept");
  expect(postCard).toContain("visualMediaUploadAccept");
  expect(postComposer).toContain("PostMusicAttachmentPicker");
  expect(postCard).toContain("PostMusicAttachmentPicker");
  expect(postComposer).toContain("uploadVideo(file, \"post_media\"");
  expect(postCard).toContain("uploadVideo(file, \"post_media\"");
  expect(postCard).toContain("<video");
  expect(postCard).toContain("poster={mediaPosterUrl ?? undefined}");
  expect(profilePage).toContain("profileBackgroundVideoPoster: upload.posterUrl ?? null");
  expect(profilePage).toContain("postMediaType(post) === \"video\"");
  expect(profileModules).toContain("poster={video.posterUrl}");
  expect(shareCardScene).toContain("postMediaType(post) === \"video\" ? post.mediaPosterUrl ?? null : post.mediaUrl");

  const mediaFormats = readFileSync("src/lib/mediaFormats.ts", "utf8");
  expect(mediaFormats).toContain("image/gif");
  expect(mediaFormats).toContain("Use JPEG, PNG, WebP, GIF, AVIF, HEIC/HEIF, TIFF, or BMP.");
  expect(mediaFormats).toContain("Use MP4, WebM, MOV, M4V, 3GP, MKV, AVI, MPEG, or OGG.");
  expect(mediaFormats).toContain("image/heic");
  expect(mediaFormats).toContain("video/quicktime");
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

test.describe("mobile touch direct canvas", () => {
  test.use({
    hasTouch: true,
    isMobile: true,
    viewport: { width: 390, height: 844 },
  });

  test("editor uses a 6 by 32 point grid", async ({ page }) => {
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

    const editor = page.getByTestId("profile-canvas-editor");
    const grid = page.getByTestId("profile-canvas-direct-grid");
    await expect(editor).toHaveAttribute("data-profile-editor-input-mode", "touch");
    await expect(editor).toHaveAttribute("data-profile-editor-render-mode", "light");
    await expect(grid).toBeVisible();
    await expect(grid).toHaveAttribute(
      "data-profile-canvas-columns",
      String(PROFILE_CANVAS_MOBILE_COLUMNS),
    );
    await expect(grid).toHaveAttribute(
      "data-profile-canvas-rows",
      String(PROFILE_CANVAS_MOBILE_ROWS),
    );
    await expect(grid).toHaveAttribute("data-profile-canvas-fit-rows", "fixed");
    await expectGridColumnCount(grid, PROFILE_CANVAS_MOBILE_COLUMNS);
    await expect(page.getByTestId("profile-canvas-cell-6-32")).toBeVisible();
    await expect(page.getByTestId("profile-canvas-cell-7-1")).toHaveCount(0);

    await page.getByTestId("profile-canvas-cell-1-19").tap();
    await page.getByTestId("profile-canvas-cell-2-19").tap();
    await expect(page.getByTestId("profile-module-picker")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("profile-module-picker")).toHaveCount(0);
    const blankModuleShell = page.locator('[data-testid^="profile-canvas-module-"]', {
      has: page.locator('[data-testid^="profile-canvas-blank-module-"]'),
    });
    await expect(blankModuleShell).toBeVisible();
    await expect(blankModuleShell.getByTestId("profile-canvas-mobile-actions")).toBeVisible();
    await expect(page.locator('[data-testid^="profile-canvas-resize-handle-"]')).toHaveCount(0);
    await blankModuleShell.locator('[data-testid^="profile-canvas-mobile-size-"]').tap();
    await expect(page.getByTestId("profile-module-settings")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect
      .poll(() => {
        const layout = placeholderDraftModule(draftPayload)?.layout as
          | Record<string, unknown>
          | undefined;

        return `${layout?.column}:${layout?.row}:${layout?.colSpan}:${layout?.rowSpan}`;
      })
      .toBe("1:10:2:1");
  });
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
  await expect(grid).toHaveAttribute("data-profile-canvas-fit-rows", "content");
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
  await expectGridRowBudget(page.getByTestId("profile-module-grid"), 4);
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

test("profile text modules use the Markdown editor and preview", async ({ page }) => {
  await mockProfileModules(page, {
    authenticated: true,
    modules: [
      withAuditLayout(
        aboutModule({ id: 1, title: "About", body: "Starter about." }),
        "4x3",
        4,
        1,
      ),
      withAuditLayout(
        textModule({ id: 2, title: "Note", body: "Starter text." }),
        "4x3",
        4,
        5,
      ),
    ],
  });
  await acknowledgeCookieNotice(page);
  await page.goto("/@thia");

  await page.getByTestId("profile-edit-button").click();
  await page.getByTestId("profile-canvas-module-1").click();
  await expect(page.getByTestId("profile-markdown-editor")).toBeVisible();
  await page.getByTestId("profile-module-settings-done").click();

  await page.getByTestId("profile-canvas-module-2").click();

  const editor = page.getByTestId("profile-markdown-editor");
  const input = editor.getByTestId("profile-module-settings-body");

  await expect(editor).toBeVisible();
  await expect(editor.getByTestId("profile-markdown-toolbar")).toBeVisible();
  await expect(editor.getByTestId("profile-markdown-surface")).toContainText("Starter text.");
  await expect(editor.getByTestId("profile-markdown-surface").getByTestId("profile-module-settings-body")).toBeVisible();
  await expect(editor.getByTestId("profile-markdown-surface").getByTestId("profile-markdown-preview")).toBeVisible();
  await input.fill("Favorite artist");
  await input.selectText();
  await editor.getByTestId("profile-markdown-button-bold").click();
  await expect(input).toHaveValue("**Favorite artist**");
  await input.fill("## Favorite artist\n\n- One\n- Two\n\n[Listen](https://example.com/music)");
  await expect(editor.getByTestId("profile-markdown-preview")).toBeVisible();
  await expect(
    editor
      .getByTestId("profile-markdown-preview")
      .getByRole("heading", { name: "Favorite artist" }),
  ).toBeVisible();
  await expect(editor.getByTestId("profile-markdown-preview").getByText("Listen")).toBeVisible();
  await expect(
    editor.getByTestId("profile-markdown-preview").getByTestId("rich-link-preview"),
  ).toBeVisible();
});

test("public profile text modules render safe Markdown", async ({ page }) => {
  await mockProfileModules(page, {
    authenticated: false,
    modules: [
      withAuditLayout(
        aboutModule({
          id: 3,
          title: "About",
          body: "### About me\n\n- Maker\n- Streamer\n\n[Site](https://example.com/about)",
        }),
        "4x3",
        4,
        1,
      ),
      withAuditLayout(
        textModule({
          id: 4,
          title: "Markdown",
          body: "## Favorite artist\n\n- One\n- Two\n\n[Listen](https://example.com/music)",
        }),
        "4x3",
        4,
        5,
      ),
    ],
  });
  await acknowledgeCookieNotice(page);
  await page.goto("/@thia");

  const about = page.getByTestId("profile-grid-module-about");
  await expect(about.getByTestId("profile-markdown-rendered")).toBeVisible();
  await expect(about.getByRole("heading", { name: "About me" })).toBeVisible();
  await expect(about.getByText("Site")).toBeVisible();
  await expect(about.getByText("### About me")).toHaveCount(0);

  const text = page.getByTestId("profile-grid-module-custom_text");
  await expect(text.getByTestId("profile-markdown-rendered")).toBeVisible();
  await expect(text.getByRole("heading", { name: "Favorite artist" })).toBeVisible();
  await expect(text.getByText("Listen")).toBeVisible();
  await expect(text.getByText("## Favorite artist")).toHaveCount(0);
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

test("profile module registry and Node storage guardrails are present by inspection", async () => {
  const app = readFileSync("server/src/app.ts", "utf8");
  const editor = readFileSync("server/src/editor.ts", "utf8");
  const integrations = readFileSync("server/src/integrations.ts", "utf8");
  const uploads = readFileSync("server/src/uploads.ts", "utf8");
  const serverEnv = readFileSync("server/env.example", "utf8");
  const moduleRegistry = readFileSync("src/lib/profileModuleRegistry.ts", "utf8");
  const profilePage = readFileSync("src/pages/ProfilePage.tsx", "utf8");
  const profileGrid = readFileSync("src/components/social/ProfileGrid.tsx", "utf8");
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

  expect(app).toContain('app.post("/me/profile/modules"');
  expect(app).toContain('app.patch("/me/profile/modules/:id"');
  expect(app).toContain('app.post("/me/profile/modules/:id/restore"');
  expect(app).toContain('app.patch("/me/profile/canvas"');
  expect(app).toContain('app.post("/me/profile/canvas-draft/commit"');
  expect(app).toContain('app.post("/me/integrations/:provider/start"');
  expect(app).toContain('app.get("/integrations/:provider/callback"');
  expect(moduleRegistry).toContain('profile_info: {\n    allowedSizes: ["3x2", "3x3", "4x3", "6x3", "8x3", "8x4"]');
  expect(moduleRegistry).toContain(
    'const connectionSizes = uniqueSizes(\n  ["2x2", "2x3", "3x2", "4x2", "3x3", "3x4"],\n  wideSlimSizes',
  );
  expect(profileGrid).toContain("fitRowsToContent\n      ? new MutationObserver");
  expect(profileGrid).toContain("mutationObserver?.observe");
  expect(profilePage).toContain("requestAnimationFrame");
  expect(profilePage).toContain("profile-canvas-drag-preview");
  expect(profilePage).toContain("profile-canvas-mobile-actions");
  expect(profilePage).toContain('data-profile-editor-render-mode="light"');
  expect(profilePage).toContain('data-profile-editor-input-mode={editorGrid.mobile ? "touch" : "pointer"}');
  expect(editor).toContain('const singletonModuleTypes = new Set(["profile_info", "featured_post", "featured_room", "activity"])');
  expect(editor).toContain("async restoreModule(session: RequestSession, moduleId: number)");
  expect(editor).toContain("Profile module storage is not ready. Run pending migrations.");
  expect(editor).toContain("Module type cannot be changed.");
  expect(editor).toContain("profile_canvas_glass_opacity");
  expect(editor).toContain("profile_background_blur");
  expect(editor).toContain('this.columnExists("profiles", "featured_post_id")');
  expect(editor).toContain('updates.push("featured_room_id = ?")');
  expect(moduleRegistry).toContain("label: \"Feed\"");
  expect(moduleRegistry).toContain("fallbackTitle: \"Feed\"");
  expect(moduleRegistry).toContain("defaultSize: \"4x6\"");
  expect(moduleRegistry).toContain('"music",\n    "spotify_song"');
  expect(moduleRegistry).toContain('description: "Upload and play a custom MP3 track."');
  expect(profilePage).toContain('music: "MP3"');
  expect(profilePage).toContain('music: "MP3 music upload"');
  expect(profilePage).toContain('platform: "custom", sourceMode: "upload"');
  expect(uploads).toContain('"profile_module_video"');
  expect(uploads).toContain('"profile_music"');
  expect(integrations).toContain('integrationProviders = ["spotify", "apple_music", "youtube", "twitch", "github"]');
  expect(integrations).toContain("nacl.secretbox");
  expect(integrations).toContain("https://www.youtube-nocookie.com/embed/");
  expect(serverEnv).toContain("THIA_SECURITY_INTEGRATION_ENCRYPTION_KEY=");
  expect(serverEnv).toContain("THIA_INTEGRATION_TWITCH_EMBED_PARENT=");
  expect(serverEnv).toContain("THIA_INTEGRATION_SPOTIFY_CLIENT_ID=");
  expect(serverEnv).toContain("THIA_INTEGRATION_APPLE_MUSIC_DEVELOPER_TOKEN=");
  expect(serverEnv).toContain("THIA_INTEGRATION_YOUTUBE_CLIENT_ID=");
  expect(serverEnv).toContain("THIA_INTEGRATION_TWITCH_CLIENT_ID=");
  expect(serverEnv).toContain("THIA_INTEGRATION_GITHUB_CLIENT_ID=");
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
  expect(safetyRules).toContain("Module presentation metadata");
  expect(safetyRules).toContain("API-backed and timestamped");
  expect(productGuidelines).toContain("Profile Modules As Glanceable Surfaces");
  expect(productGuidelines).toContain("`1x1` and `2x1` modules carry one idea");
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

async function mockProfileModules(
  page: Page,
  options: {
    authenticated: boolean;
    modules: unknown[];
    onCreate?: (payload: Record<string, unknown>) => void;
    onOnboardingUpdate?: (payload: Record<string, unknown>) => void;
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
    viewerHandle?: string;
  },
) {
  let ownerModules = ensureTestBuiltInModules(
    [...options.modules] as Array<Record<string, unknown>>,
  );
  let profileOverrides = { ...(options.profileOverrides ?? {}) };
  let canvasDraft = profileCanvasDraftState(ownerModules, profileOverrides);
  const viewerHandle = options.viewerHandle ?? "thia";
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
            handle: viewerHandle,
            email: `${viewerHandle}@example.test`,
            role: "member",
            status: "active",
            displayName: viewerHandle === "thia" ? "Thia" : "Viewer",
            avatarUrl: null,
          },
          profile: {
            displayName: viewerHandle === "thia" ? "Thia" : "Viewer",
            bio:
              viewerHandle === "thia"
                ? "Founder profile for thia.lol."
                : "Signed-in visitor.",
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
    if (route.request().method() === "PATCH") {
      const payload = (await route.request().postDataJSON()) as Record<
        string,
        unknown
      >;
      options.onOnboardingUpdate?.(payload);
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
              "desktop_notifications",
            ],
            completedSteps:
              payload.action === "complete_step" && payload.step === "profile_canvas"
                ? ["profile_canvas"]
                : [],
            skippedSteps:
              payload.action === "skip_step" && payload.step === "profile_canvas"
                ? ["profile_canvas"]
                : [],
            providerLinks: {},
            finishedAt: null,
            dismissedAt: "2026-06-19T00:00:00Z",
            createdAt: "2026-06-19T00:00:00Z",
            updatedAt: "2026-06-19T00:00:00Z",
          },
        }),
      });
      return;
    }

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
          posterUrl: `/uploads/media/2026/06/${purpose}-clip-poster.webp`,
          width: 1280,
          height: 720,
          duration: purpose === "profile_background" ? 30 : 120,
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

async function expectSpotifyCustomPlayer(page: Page) {
  const player = page.getByTestId("profile-spotify-custom-player");

  await expect(player).toBeVisible();
  await expect(player).toContainText("Focus track");
  await expect(player).toContainText("Spotify track");
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

async function expectGridRowBudget(locator: Locator, expectedRows: number) {
  await expect
    .poll(async () =>
      Number(await locator.getAttribute("data-profile-canvas-rows")),
    )
    .toBe(expectedRows);
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
  { type: "about", sizes: ["3x2", "4x3", "4x5", "8x1", "8x2"] },
  { type: "custom_text", sizes: ["3x2", "4x3", "4x5", "6x1", "8x2"] },
  { type: "links", sizes: ["2x2", "2x3", "3x2", "4x2", "3x4", "8x1", "8x2"] },
  { type: "featured_badges", sizes: ["2x2", "3x2", "8x1", "8x2"] },
  { type: "featured_post", sizes: ["3x4", "4x5"] },
  { type: "featured_room", sizes: ["3x1", "4x2"] },
  { type: "gallery_media", sizes: ["2x2", "3x2", "3x3", "4x3", "8x2"] },
  {
    type: "creator_live",
    sizes: ["2x1", "3x2", "4x3", "5x3", "6x4", "8x2"],
  },
  { type: "music", sizes: ["2x1", "2x2", "3x2", "4x2", "4x3", "4x4", "8x1", "8x2"] },
  { type: "activity", sizes: ["5x2", "8x2", "8x3", "3x4", "4x6", "6x10"] },
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
      stars: 0,
    },
    followerCount: 0,
    followingCount: 0,
    mootCount: 0,
    starCount: 0,
    isFollowing: false,
    isFollowedBy: false,
    isMoot: false,
    isStarred: false,
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

function spotifyArtistModule(
  overrides: {
    id?: number;
    imageUrl?: string;
    listeners?: number;
    position?: number;
  } = {},
) {
  return {
    ...musicModule(overrides),
    type: "spotify_artist",
    title: "Artist",
    config: {
      displayMode: "embed",
      label: "Mili",
      platform: "spotify",
      sourceMode: "spotify",
      url: "https://open.spotify.com/artist/mili",
      integration: {
        provider: "spotify",
        resourceType: "artist",
        resourceId: "mili",
        resourceKey: "spotify:artist:mili",
        sourceUrl: "https://open.spotify.com/artist/mili",
        metadata: {
          title: "Mili",
          subtitle: "Spotify",
          description: "Art-pop, chamber pop",
          imageUrl: overrides.imageUrl ?? "https://i.scdn.co/image/mili",
          stats: {
            ...(typeof overrides.listeners === "number"
              ? { listeners: overrides.listeners }
              : {}),
            followers: 1200000,
            popularity: 72,
            genres: "art pop, chamber pop",
          },
        },
        embed: {
          type: "iframe",
          src: "https://open.spotify.com/embed/artist/mili",
          title: "Spotify artist player",
          height: 152,
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
    theme: "frostveil",
    themeConfig: { mode: "preset", preset: "frostveil" },
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
      theme: "frostveil",
      themeConfig: { mode: "preset", preset: "frostveil" },
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
