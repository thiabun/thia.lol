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
  await expect(page.getByText("Personal space")).toHaveCount(0);
  await expect(section.getByTestId("profile-module-grid")).toBeVisible();
  await expect(section.getByTestId("profile-grid-module-profile_info")).toHaveAttribute(
    "data-profile-grid-size",
    "3x2",
  );
  await expect(section.getByTestId("profile-module-grid")).toHaveAttribute(
    "data-profile-canvas-rows",
    "9",
  );
  await expect(section.getByTestId("profile-grid-module-about")).toHaveAttribute(
    "data-profile-grid-size",
    "2x1",
  );
  await expect(section.getByTestId("profile-grid-module-about")).toHaveAttribute(
    "data-profile-module-purpose",
    "status",
  );
  await expect(section.getByTestId("profile-grid-module-about")).toHaveAttribute(
    "data-profile-module-span-role",
    "glance",
  );
  await expect(section.getByTestId("profile-module-about")).toHaveAttribute(
    "data-profile-module-shell",
    "true",
  );
  await expect(section.getByTestId("profile-grid-module-links")).toHaveAttribute(
    "data-profile-grid-size",
    "2x1",
  );
  await expect(section.getByTestId("profile-grid-module-links")).toHaveAttribute(
    "data-profile-module-action",
    "open",
  );
  await expect(section.getByTestId("profile-grid-module-featured_badges")).toHaveAttribute(
    "data-profile-grid-size",
    "2x1",
  );
  await expectTextOrder(section, [
    "Thia",
    "About this space",
    "Elsewhere",
    "Badge shelf",
  ]);
  await expect(section.getByRole("heading", { name: "About this space" })).toBeVisible();
  await expect(section).toContainText("Literal <strong>plain</strong> text");
  await expect(section.locator("strong")).toHaveCount(0);
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
    "rich",
  );
  await expect(modules.locator('img[src="/uploads/media/2026/06/profile-gallery-one.webp"]')).toBeVisible();
  await expect(modules.getByText("Studio corner")).toBeVisible();
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
      linksModule({
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
    ],
  });
  await acknowledgeCookieNotice(page);
  await page.goto("/@thia");

  const about = page.getByTestId("profile-grid-module-about");
  await expect(about).toHaveAttribute("data-profile-grid-size", "1x1");
  await expect(about).toHaveAttribute("data-profile-module-compact", "true");
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
      activityModule({ id: 9, title: "Latest activity", position: 1 }),
      aboutModule({ id: 1, title: "About", body: "A compact intro.", position: 2 }),
    ],
    profilePosts: [postFixture({ body: "Profile activity post." })],
  });
  await acknowledgeCookieNotice(page);
  await page.goto("/@thia");

  const section = page.getByTestId("profile-modules");
  await expect(section).toBeVisible();
  await expect(section.getByTestId("profile-grid-module-activity")).toBeVisible();
  await expect(section.getByTestId("profile-module-activity")).toBeVisible();
  await expect(section.getByRole("heading", { name: "Latest activity" })).toBeVisible();

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
});

test("activity keeps long feeds inside an internal scroll area", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  await mockProfileModules(page, {
    authenticated: false,
    modules: [activityModule({ id: 9, title: "Latest activity", position: 1 })],
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
  await expect(module).toHaveAttribute("data-profile-activity-max-rows", "3");
  await expect(body).toHaveAttribute("data-profile-activity-scroll", "internal");
  await expect(tabs.getByRole("tab", { name: /Feed/ })).toBeVisible();
  await expect(page.getByText("Long activity item 14.")).toBeVisible();

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

    if (!moduleElement || !bodyElement || !tabsElement) {
      throw new Error("Activity module elements were not rendered.");
    }

    const moduleRect = moduleElement.getBoundingClientRect();
    const tabsRect = tabsElement.getBoundingClientRect();

    return {
      bodyClientHeight: bodyElement.clientHeight,
      bodyOverflowY: window.getComputedStyle(bodyElement).overflowY,
      bodyScrollHeight: bodyElement.scrollHeight,
      documentScrollHeight: document.documentElement.scrollHeight,
      moduleHeight: moduleRect.height,
      moduleMaxHeight: Number.parseFloat(window.getComputedStyle(moduleElement).maxHeight),
      tabsBottom: tabsRect.bottom,
      tabsTop: tabsRect.top,
      moduleBottom: moduleRect.bottom,
      moduleTop: moduleRect.top,
    };
  });

  expect(metrics.bodyOverflowY).toBe("auto");
  expect(metrics.bodyScrollHeight).toBeGreaterThan(metrics.bodyClientHeight + 100);
  expect(metrics.moduleHeight).toBeLessThanOrEqual(metrics.moduleMaxHeight + 2);
  expect(metrics.tabsTop).toBeGreaterThanOrEqual(metrics.moduleTop);
  expect(metrics.tabsBottom).toBeLessThanOrEqual(metrics.moduleBottom);
  expect(metrics.documentScrollHeight).toBeLessThan(metrics.bodyScrollHeight + 1_600);
});

test("activity respects hidden module preferences", async ({ page }) => {
  await mockProfileModules(page, {
    authenticated: false,
    modules: [
      {
        ...activityModule({ id: 9, title: "Hidden activity", position: 1 }),
        visibility: "hidden",
      },
    ],
    profilePosts: [postFixture({ body: "Hidden activity post." })],
  });
  await acknowledgeCookieNotice(page);
  await page.goto("/@thia");

  await expect(page.getByTestId("profile-module-activity")).toHaveCount(0);
  await expect(page.getByText("Hidden activity post.")).toHaveCount(0);
});

test("public empty activity module stays hidden on minimal profiles", async ({ page }) => {
  await mockProfileModules(page, {
    authenticated: false,
    modules: [activityModule({ id: 9 })],
  });
  await acknowledgeCookieNotice(page);
  await page.goto("/@thia");

  await expect(page.getByTestId("profile-module-activity")).toHaveCount(0);
  await expect(page.getByTestId("profile-activity-tabs")).toHaveCount(0);
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
  await expect(grid).toHaveAttribute("data-profile-canvas-columns", "6");
  await expectGridColumnCount(grid, 1);

  await page.setViewportSize({ width: 900, height: 900 });
  await expectGridColumnCount(grid, 2);

  await page.setViewportSize({ width: 1366, height: 900 });
  await expectGridColumnCount(grid, 6);
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

    if (!backdropElement || !gridElement) {
      throw new Error("Profile background or grid did not render.");
    }

    const backdropRect = backdropElement.getBoundingClientRect();
    const gridStyles = window.getComputedStyle(gridElement);

    return {
      backdropHeight: Math.round(backdropRect.height),
      backdropWidth: Math.round(backdropRect.width),
      gridBackground: gridStyles.backgroundColor,
      viewportHeight: window.innerHeight,
      viewportWidth: window.innerWidth,
    };
  });

  expect(metrics.backdropWidth).toBeGreaterThanOrEqual(metrics.viewportWidth);
  expect(metrics.backdropHeight).toBeGreaterThanOrEqual(metrics.viewportHeight);
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
          description: "Current writing playlist.",
          label: "Focus playlist",
          platform: "spotify",
          url: "https://open.spotify.com/playlist/profile-test",
          integration: {
            provider: "spotify",
            resourceType: "playlist",
            resourceId: "profile-test",
            resourceKey: "spotify:playlist:profile-test",
            sourceUrl: "https://open.spotify.com/playlist/profile-test",
            metadata: {
              title: "Focus playlist",
              subtitle: "Spotify playlist",
              recentLabel: "Recently updated",
              recentFetchedAt: "2026-06-16T10:00:00Z",
            },
            embed: {
              type: "iframe",
              src: "https://open.spotify.com/embed/playlist/profile-test",
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

  const spotifyEmbed = page.getByTestId("profile-integration-embed-spotify");
  await expect(spotifyEmbed).toHaveAttribute(
    "src",
    "https://open.spotify.com/embed/playlist/profile-test",
  );
  await expect(spotifyEmbed).toHaveAttribute(
    "sandbox",
    /allow-scripts allow-same-origin/,
  );
  await expect(page.getByText("Recently updated · Spotify")).toBeVisible();
  await expect(page.getByText("Public repository metadata.")).toBeVisible();
  await expect(page.getByTestId("profile-integration-embed-github")).toHaveCount(0);
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

test("public logged-out users do not see canvas edit controls", async ({ page }) => {
  await mockProfileModules(page, {
    authenticated: false,
    modules: [aboutModule({ title: "About", body: "Public profile." })],
  });
  await acknowledgeCookieNotice(page);
  await page.goto("/@thia");

  await expect(page.getByTestId("profile-canvas-edit-button")).toHaveCount(0);
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
  await expect(banner).toHaveAttribute("data-profile-banner-treatment", "clear");
  await expect(module.getByRole("button", { name: "Report" })).toBeVisible();

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

    if (!moduleElement || !headerElement || !bannerElement) {
      throw new Error("Profile info module, header, or banner did not render.");
    }

    return {
      bannerHeight: Math.round(bannerElement.getBoundingClientRect().height),
      headerHeight: Math.round(headerElement.getBoundingClientRect().height),
      moduleHeight: Math.round(moduleElement.getBoundingClientRect().height),
    };
  });

  expect(metrics.headerHeight).toBeGreaterThanOrEqual(metrics.moduleHeight * 0.92);
  expect(metrics.bannerHeight).toBeGreaterThanOrEqual(150);
});

test("owner edits background blur, module placement, and visibility", async ({
  page,
}) => {
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
    onCanvasSave: (payload) => {
      savedPayload = payload;
    },
  });
  await acknowledgeCookieNotice(page);
  await page.goto("/@thia");

  await page.getByTestId("profile-canvas-edit-button").click();
  await expect(page.getByTestId("profile-canvas-editor")).toBeVisible();
  await expect(page.getByTestId("profile-canvas-editor")).toHaveAttribute(
    "data-profile-canvas-panel",
    "left",
  );
  await expect(
    page
      .getByTestId("profile-canvas-dock")
      .getByTestId("profile-canvas-background-controls"),
  ).toHaveCount(0);
  await expect(page.getByTestId("profile-canvas-background-surface")).toBeVisible();
  await expect(page.getByTestId("profile-canvas-background-controls")).toBeVisible();
  await expect(page.getByTestId("profile-canvas-background-trigger")).toBeVisible();
  await expect(page.getByText("Background clarity")).toHaveCount(0);
  await expect(page.getByText("6 x 9 canvas")).toHaveCount(0);
  await expect(page.getByText(/is selected\./)).toHaveCount(0);
  await page.getByTestId("profile-canvas-background-trigger").click();
  await expect(page.getByTestId("profile-canvas-background-popover")).toBeVisible();
  await expect(page.getByText("Background clarity")).toBeVisible();
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
  await page.getByTestId("profile-grid-module-about").click();
  const aboutEdit = page
    .getByTestId("profile-grid-module-about")
    .getByTestId("profile-selected-module-controls");
  await expect(
    aboutEdit,
  ).toBeVisible();
  const aboutModuleBox = await page.getByTestId("profile-grid-module-about").boundingBox();
  const dragHandleBox = await page
    .getByTestId("profile-canvas-drag-handle-1")
    .boundingBox();
  expect(aboutModuleBox).not.toBeNull();
  expect(dragHandleBox).not.toBeNull();
  expect(dragHandleBox!.x).toBeGreaterThan(
    aboutModuleBox!.x + aboutModuleBox!.width / 2,
  );
  await expect(page.getByTestId("profile-canvas-position-grid")).toHaveCount(0);
  await aboutEdit.getByTestId("profile-canvas-visibility-button").click();
  await expect(
    aboutEdit.getByRole("button", { name: "Show module" }),
  ).toBeVisible();
  await page.getByTestId("profile-module-grid").dispatchEvent("click", {
    bubbles: true,
    cancelable: true,
  });
  await expect(aboutEdit).toHaveCount(0);
  await page.getByTestId("profile-canvas-save-button").click();

  await expect(page.getByTestId("profile-canvas-editor")).toHaveCount(0);
  expect(savedPayload?.backgroundBlur).toBe("heavy");
  expect(savedPayload?.canvasVersion).toBe(1);

  const savedModules = savedPayload?.modules as Array<Record<string, unknown>>;
  const aboutPlacement = savedModules.find((module) => module.id === 1);
  expect(aboutPlacement).toMatchObject({
    visible: false,
  });
  await expect(page.getByTestId("profile-personal-backdrop")).toHaveAttribute(
    "data-profile-background-blur",
    "heavy",
  );
  await expect(page.getByText("Move me.")).toHaveCount(0);
});

test("owner edits profile info inside the selected module", async ({ page }) => {
  let savedProfile: Record<string, unknown> | undefined;

  await mockProfileModules(page, {
    authenticated: true,
    modules: [],
    onProfileSave: (payload) => {
      savedProfile = payload;
    },
  });
  await acknowledgeCookieNotice(page);
  await page.goto("/@thia");

  await page.getByTestId("profile-canvas-edit-button").click();
  await page.getByTestId("profile-grid-module-profile_info").click();
  await expect(
    page
      .getByTestId("profile-grid-module-profile_info")
      .getByTestId("profile-selected-module-controls"),
  ).toBeVisible();

  await page.getByTestId("profile-info-display-name-input").fill("Thia Canvas");
  await page.getByTestId("profile-info-bio-input").fill("Edited inside the profile module.");
  await page.getByTestId("profile-canvas-save-button").click();

  expect(savedProfile).toMatchObject({
    displayName: "Thia Canvas",
    bio: "Edited inside the profile module.",
  });
});

test("owner can use larger profile info and activity spans", async ({ page }) => {
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
  await expect(profileInfoEdit.getByTestId("profile-canvas-size-4x3")).toBeVisible();
  await profileInfoEdit.getByTestId("profile-canvas-size-6x3").click();

  await page.getByTestId("profile-grid-module-activity").click();
  const activityEdit = page
    .getByTestId("profile-grid-module-activity")
    .getByTestId("profile-selected-module-controls");
  await expect(activityEdit.getByTestId("profile-canvas-size-3x4")).toBeVisible();
  await activityEdit.getByTestId("profile-canvas-size-3x6").click();
  await page.getByTestId("profile-canvas-save-button").click();
  await expect(page.getByTestId("profile-canvas-editor")).toHaveCount(0);
  await expect.poll(() => savedPayload).toBeDefined();

  const savedModules = savedPayload?.modules as Array<Record<string, unknown>>;
  expect(savedModules.find((module) => module.id === 9001)).toMatchObject({
    colSpan: 6,
    rowSpan: 3,
  });
  expect(savedModules.find((module) => module.id === 9)).toMatchObject({
    colSpan: 3,
    rowSpan: 6,
  });
});

test("owner edits connections inside the selected module", async ({ page }) => {
  let updatedLinks: Array<Record<string, unknown>> = [];

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

  await page.getByTestId("profile-connection-add-open-button").click();
  await page.getByTestId("profile-connection-platform-twitch").click();
  await page.getByTestId("profile-connection-value-input").fill("thiabun");
  await page.getByTestId("profile-connection-add-button").click();
  await page.getByTestId("profile-canvas-save-button").click();

  expect(updatedLinks).toContainEqual(
    expect.objectContaining({
      platform: "twitch",
      url: "https://www.twitch.tv/thiabun",
    }),
  );
});

test("owner drags a canvas module and save includes pushed placement", async ({
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

test("owner adds modules and deletes featured modules from the canvas editor", async ({
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

test("owner uses OAuth-first integrations from the editor panel", async ({
  page,
}) => {
  const createdPayloads: Array<Record<string, unknown>> = [];
  let oauthStartPayload: Record<string, unknown> | undefined;

  await mockProfileModules(page, {
    authenticated: true,
    modules: [],
    onCreate: (payload) => {
      createdPayloads.push(payload);
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
  await page.route("**/api/me/integrations/github/suggestions", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: {
          provider: "github",
          status: {
            provider: "github",
            configured: true,
            oauthEnabled: true,
            linkSupported: true,
            metadataEnabled: true,
            missingConfigKeys: [],
          },
          account: {
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
          items: [
            {
              id: "github-repo-thia-lol",
              label: "thia.lol",
              description: "Public repository metadata.",
              sourceUrl: "https://github.com/thiabun/thia.lol",
              moduleType: "creator_live",
              moduleTitle: null,
              card: {
                provider: "github",
                resourceType: "repository",
                resourceId: "thiabun/thia.lol",
                resourceKey: "github:repo:thiabun/thia.lol",
                sourceUrl: "https://github.com/thiabun/thia.lol",
                apiBacked: true,
                fetchedAt: "2026-06-17T00:00:00Z",
                expiresAt: "2026-06-17T01:00:00Z",
                staleAt: "2026-06-18T00:00:00Z",
                metadata: {
                  title: "thia.lol",
                  subtitle: "GitHub",
                  description: "Public repository metadata.",
                  imageUrl: null,
                  live: false,
                  liveFetchedAt: null,
                  recentLabel: null,
                  recentFetchedAt: null,
                  stats: {},
                },
                embed: null,
              },
            },
          ],
          message: null,
          generatedAt: "2026-06-17T00:00:00Z",
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
  await page.getByTestId("profile-integration-suggestions-github").click();
  const githubSuggestion = page.getByTestId(
    "profile-integration-suggestion-github-github-repo-thia-lol",
  );
  await expect(githubSuggestion).toBeVisible();
  await githubSuggestion.click();

  expect(createdPayloads.at(-1)).toMatchObject({
    type: "creator_live",
    visibility: "public",
    status: "active",
    config: {
      platform: "github",
      label: "thia.lol",
      url: "https://github.com/thiabun/thia.lol",
      description: "Public repository metadata.",
    },
  });

  await page.getByTestId("profile-integration-connect-spotify").click();
  expect(oauthStartPayload).toMatchObject({
    redirectPath: "/@thia?editCanvas=1",
  });
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
  await expectGridColumnCount(grid, 1);
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
        layout: { column: 1, row: 2, colSpan: 1, rowSpan: 1 },
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
  await expect(music).toHaveAttribute("data-profile-grid-size", "2x1");
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
  await expect(malformed).toHaveAttribute("data-profile-grid-size", "1x1");
  await expect(malformed).toHaveAttribute("data-profile-grid-column-span", "1");
  await expect(malformed).toHaveAttribute("data-profile-grid-row-span", "1");
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
  await expectTextOrder(section, ["Visible first", "Visible second"]);
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
  await expectGridColumnCount(grid, 6);

  await page.setViewportSize({ width: 390, height: 844 });
  await expectGridColumnCount(grid, 1);
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
    "3",
  );
  await expect(page.getByTestId("profile-grid-module-profile_info")).toHaveAttribute(
    "data-profile-grid-row-span",
    "2",
  );
  await expectTextOrder(page.getByTestId("profile-modules"), [
    "Thia",
    "Lead note",
    "Small note",
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
  await expect(page.getByTestId("profile-canvas-edit-button")).toBeVisible();
  await expect(
    page.getByTestId("profile-header").getByRole("button", { name: "Customize profile" }),
  ).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "No modules yet" })).toHaveCount(0);
  await expect(page.getByText("Customize profile to add modules.")).toHaveCount(0);
  await expect(page.getByText("Profile customization is being rebuilt for P3.")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Customize profile" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Customize layout" })).toHaveCount(0);
});

test("owner customization uses inline canvas editing instead of the retired modal", async ({
  page,
}) => {
  await mockProfileModules(page, {
    authenticated: true,
    modules: [aboutModule({ body: "Saved profile note" })],
  });
  await acknowledgeCookieNotice(page);
  await page.goto("/@thia");

  await expect(page.getByTestId("profile-canvas-edit-button")).toBeVisible();
  await expect(page.getByRole("button", { name: "Customize profile" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Customize layout" })).toHaveCount(0);
  await expect(page.getByTestId("profile-customization-modal")).toHaveCount(0);
  await expect(page.getByTestId("profile-module-editor")).toHaveCount(0);
  await expect(page.getByText("Saved profile note")).toBeVisible();
});

test("mobile profile modules stay stable with compact canvas editing", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockProfileModules(page, {
    authenticated: true,
    modules: [aboutModule({ body: "Mobile profile module" })],
  });
  await acknowledgeCookieNotice(page);
  await page.goto("/@thia");

  await expect(page.getByRole("button", { name: "Customize profile" })).toHaveCount(0);
  await expect(page.getByTestId("profile-customization-modal")).toHaveCount(0);
  await expect(page.getByTestId("profile-canvas-edit-button")).toBeVisible();
  await page.getByTestId("profile-canvas-edit-button").click();
  await expect(page.getByTestId("profile-canvas-editor")).toBeVisible();
  await expect(page.getByTestId("profile-canvas-save-button-mobile")).toBeVisible();
  await expect(page.getByTestId("profile-canvas-save-button")).toBeHidden();
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
  expect(modulesApi).toContain("const PROFILE_INFO_MODULE_TYPE = 'profile_info'");
  expect(modulesApi).toContain("const PROFILE_ACTIVITY_MODULE_TYPE = 'activity'");
  expect(modulesApi).toContain("const PROFILE_FEATURED_POST_MODULE_TYPE = 'featured_post'");
  expect(modulesApi).toContain("const PROFILE_FEATURED_ROOM_MODULE_TYPE = 'featured_room'");
  expect(modulesApi).toContain("const PROFILE_GALLERY_MEDIA_MODULE_TYPE = 'gallery_media'");
  expect(modulesApi).toContain("const PROFILE_CREATOR_LIVE_MODULE_TYPE = 'creator_live'");
  expect(modulesApi).toContain("const PROFILE_MUSIC_MODULE_TYPE = 'music'");
  expect(modulesApi).toContain("const PROFILE_FEATURED_LEGACY_MODULE_TYPE = 'featured'");
  expect(modulesApi).toContain("PROFILE_BUILT_IN_MODULE_TYPES");
  expect(modulesApi).toContain("PROFILE_PROTECTED_MODULE_TYPES = [PROFILE_INFO_MODULE_TYPE]");
  expect(modulesApi).toContain("PROFILE_SINGLETON_MODULE_TYPES");
  expect(modulesApi).toContain("PROFILE_RETIRED_MODULE_TYPES");
  expect(modulesApi).toContain("ensure_profile_canvas_builtin_modules");
  expect(modulesApi).toContain("ensure_profile_info_module");
  expect(modulesApi).toContain("includeDeleted");
  expect(modulesApi).toContain("profile_modules_restore");
  expect(modulesApi).toContain("profile_canvas_reflow_existing_modules");
  expect(modulesApi).toContain("restoreFeaturedPostId");
  expect(modulesApi).toContain("restoreFeaturedRoomId");
  expect(modulesApi).toContain("visibility = 'hidden'");
  expect(modulesApi).toContain("profile_module_gallery_media_config");
  expect(modulesApi).toContain("profile_module_music_config");
  expect(modulesApi).toContain("profile_integration_card_for_module");
  expect(modulesApi).toContain("profile_module_validate_url_platform");
  expect(modulesApi).toContain("require_csrf_token($session)");
  expect(modulesApi).toContain("Profile module storage is not ready. Run pending migrations.");
  expect(modulesApi).toContain("profile_module_reject_unknown_keys");
  expect(modulesApi).toContain("profile_module_text_is_unsafe");
  expect(modulesApi).toContain("profile_canvas_update");
  expect(modulesApi).toContain("profile_canvas_background_blur");
  expect(modulesApi).toContain("anchorModuleId");
  expect(modulesApi).toContain("profile_canvas_push_collisions");
  expect(modulesApi).toContain("Canvas layout does not fit the 6 by 9 grid.");
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
  expect(uploadsApi).toContain("VIDEO_UPLOAD_MAX_BYTES");
  expect(uploadsApi).toContain("profile_background");
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
  expect(moduleRegistry).toContain("export const PROFILE_ACTIVITY_MAX_ROW_SPAN = 6");
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
    onDelete?: (id: number) => void;
    onOrder?: (ids: number[]) => void;
    onProfileSave?: (payload: Record<string, unknown>) => void;
    onUpdate?: (id: number, payload: Record<string, unknown>) => void;
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
        profileCanvasVersion: 1,
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
        visibility: placement.visible === false ? "hidden" : "public",
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
          canvasVersion: 1,
          modules: ownerModules,
        },
      }),
    });
  });

  await page.route("**/api/profiles/thia/modules", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: ownerModules.filter(
          (module) => module.visibility === "public" && module.status === "active",
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
    config: payload.config ?? base.config ?? {},
  };
}

function ensureTestBuiltInModules(modules: Array<Record<string, unknown>>) {
  const result = [...modules];

  if (!result.some((module) => module.type === "profile_info")) {
    result.unshift(profileInfoModule());
  }

  return result.map((module, index) => ({
    ...module,
    position: typeof module.position === "number" ? module.position : index,
  }));
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
        column: Math.max(1, Math.min(6 - colSpan + 1, Number(placement.column ?? 1))),
        row: Math.max(1, Math.min(9 - rowSpan + 1, Number(placement.row ?? 1))),
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
  const maxColumn = 6 - colSpan + 1;
  const maxRow = 9 - rowSpan + 1;
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
    profileCanvasVersion: 1,
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
    title: overrides.title ?? "Activity",
    config: {},
    visibility: "public",
    position: overrides.position ?? 1,
    status: "active",
    schemaVersion: 1,
    createdAt: "2026-06-12 00:00:00",
    updatedAt: "2026-06-12 00:00:00",
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
