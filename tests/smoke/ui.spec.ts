import { expect, type Page, test } from "@playwright/test";
import { mockSpotifyIframeApi, spotifyPlayCalls } from "../helpers/spotify";

const strokeJokeCooldownStorageKey = "thia.strokeJoke.cooldownUntil:v1";

const retiredMockCopy = [
  "Mira Vale",
  "Sol Anka",
  "Ior Rune",
  "Easygoing rooms",
  "Quiet operators",
  "Solarized socials",
  "The nicest launch state might be one where the platform feels awake",
  "A secondary profile on the platform",
  "Showing a saved view",
  "A softer place to post",
  "Fresh notes from around the site",
  "friendly profiles",
  "Signals from public posts",
  "sexy social",
  "Your corner of thia.lol",
  "soft systems",
  "moon notes",
  "platform rituals",
  "Moon Table",
  "Soft Launch",
  "Garden Protocol",
  "Afterglow",
  "low blue",
  "green signal",
  "honey static",
  "backend",
  "dev",
  "API",
  "fallback",
  "mock",
  "demo",
];

test("anonymous desktop home header focuses on discovery and joining", async ({ page }) => {
  await mockPublicShell(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");

  await expect(page.getByLabel("thia.lol home")).toBeVisible();
  await expect(page.getByTestId("brand-logo")).toBeVisible();
  await expect(page.getByText("social app")).toHaveCount(0);

  const nav = page.getByTestId("desktop-nav");
  await expect(nav).toBeVisible();

  for (const label of ["Discover", "Rooms", "Sign in", "Create account"]) {
    await expect(nav.getByRole("link", { name: label })).toBeVisible();
  }

  for (const label of ["Home", "Search", "Chat"]) {
    await expect(nav.getByRole("link", { name: label })).toHaveCount(0);
  }

  await expect(nav.getByRole("link", { name: "Admin" })).toHaveCount(0);
  await expect(page.getByTestId("desktop-post-action")).toHaveCount(0);
});

test("reply button opens the canonical continuous thread", async ({ page }) => {
  await mockPublicShell(page, {
    discoverPosts: [makePost({ commentCount: 1 })],
  });
  await page.route("**/api/posts/42", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ ok: true, data: makePost({ commentCount: 1 }) }),
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
            body: "A continuous thread reply.",
          }),
        ],
      }),
    }),
  );

  await page.goto("/");
  await page.getByRole("button", { name: /open replies/i }).first().click();

  await expect(page).toHaveURL(/\/@alex\/posts\/42$/);
  const thread = page.getByTestId("thread-view");
  await expect(thread).toBeVisible();
  await expect(thread.getByText("A public post.")).toBeVisible();
  await expect(thread.getByText("A continuous thread reply.")).toBeVisible();
  await expect(page.getByTestId("thread-modal")).toHaveCount(0);
});

test("anonymous mobile home header keeps conversion links accessible without a dock", async ({
  page,
}) => {
  await mockPublicShell(page);
  await acknowledgeCookieNotice(page);
  for (const width of [320, 390, 430]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/");

    await expect(page.getByLabel("thia.lol home")).toBeVisible();
    await expect(page.getByTestId("brand-logo")).toBeVisible();
    await expect(page.getByText("social app")).toHaveCount(0);
    await expectNoHorizontalOverflow(page);

    const header = page.getByTestId("anonymous-home-header");
    const createAccount = header.getByRole("link", { name: "Create account" });
    const menuButton = header.getByRole("button", { name: "Open navigation menu" });
    await expect(createAccount).toBeVisible();

    for (const control of [createAccount, menuButton]) {
      const box = await control.boundingBox();
      expect(box?.height).toBeGreaterThanOrEqual(44);
    }

    await menuButton.click();

    const menu = page.getByTestId("anonymous-home-menu");
    for (const label of ["Discover", "Rooms", "Sign in"]) {
      await expect(menu.getByRole("menuitem", { name: label })).toBeVisible();
    }

    await expect(page.getByTestId("mobile-nav")).toHaveCount(0);
    await expect(page.getByTestId("mobile-post-action")).toHaveCount(0);
    await expect(page.getByTestId("desktop-post-action")).toHaveCount(0);
  }
});

test("coffee support opens a closable Ko-fi panel on desktop", async ({ page }) => {
  await mockPublicShell(page);
  await acknowledgeCookieNotice(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/discover");

  const coffeeButton = page.getByTestId("coffee-support-button");
  const postButton = page.getByTestId("desktop-post-action");
  await expect(coffeeButton).toBeVisible();
  await expect(coffeeButton).toHaveAttribute("aria-expanded", "false");

  const floatingControls = await Promise.all([
    coffeeButton.boundingBox(),
    postButton.boundingBox(),
  ]);
  expect(floatingControls[0]).not.toBeNull();
  expect(floatingControls[1]).not.toBeNull();
  expect(floatingControls[0]!.x + floatingControls[0]!.width).toBeLessThan(
    floatingControls[1]!.x,
  );

  await coffeeButton.click();

  const panel = page.getByTestId("kofi-support-panel");
  const iframe = panel.locator("#kofiframe");
  await expect(panel).toBeVisible();
  await expect(panel).toHaveAttribute("aria-label", "Ko-fi support");
  await expect(panel.locator("header")).toHaveCount(0);
  await expect(iframe).toHaveAttribute(
    "src",
    "https://ko-fi.com/thiabun/?hidefeed=true&widget=true&embed=true&preview=true",
  );
  await expect(iframe).toHaveAttribute("height", "712");
  await expect(iframe).toHaveAttribute("title", "thiabun");

  await panel.getByRole("button", { name: "Close Ko-fi support panel" }).click();
  await expect(panel).toBeHidden();
  await expect(coffeeButton).toBeFocused();
});

test("coffee support clears the mobile dock and keeps the Ko-fi panel scrollable", async ({
  page,
}) => {
  await mockPublicShell(page);
  await acknowledgeCookieNotice(page);
  await page.setViewportSize({ width: 390, height: 667 });
  await page.goto("/discover");

  const coffeeButton = page.getByTestId("coffee-support-button");
  const mobileDock = page.getByTestId("mobile-nav");
  const positions = await Promise.all([
    coffeeButton.boundingBox(),
    mobileDock.boundingBox(),
  ]);

  expect(positions[0]).not.toBeNull();
  expect(positions[1]).not.toBeNull();
  expect(positions[0]!.width).toBeGreaterThanOrEqual(44);
  expect(positions[0]!.height).toBeGreaterThanOrEqual(44);
  expect(positions[0]!.y + positions[0]!.height).toBeLessThanOrEqual(
    positions[1]!.y,
  );
  await expectNoHorizontalOverflow(page);

  await coffeeButton.click();

  const panel = page.getByTestId("kofi-support-panel");
  const iframe = panel.locator("#kofiframe");
  await expect(panel).toBeVisible();
  await expect(iframe).toBeVisible();
  await expect
    .poll(async () => {
      const box = await panel.boundingBox();

      return box ? box.y + box.height : Number.POSITIVE_INFINITY;
    })
    .toBeLessThanOrEqual(667);

  const panelState = await panel.evaluate((element) => {
    const body = element.querySelector("#kofiframe")?.parentElement;
    const panelRect = element.getBoundingClientRect();

    return {
      bodyScrollable: body ? body.scrollHeight > body.clientHeight : false,
      bottom: panelRect.bottom,
      left: panelRect.left,
      right: panelRect.right,
      top: panelRect.top,
    };
  });

  expect(panelState.left).toBeGreaterThanOrEqual(0);
  expect(panelState.right).toBeLessThanOrEqual(390);
  expect(panelState.top).toBeGreaterThanOrEqual(0);
  expect(panelState.bottom).toBeLessThanOrEqual(667);
  expect(panelState.bodyScrollable).toBe(true);

  await page.keyboard.press("Escape");
  await expect(panel).toBeHidden();
});

test("stroke joke popup celebrates with confetti", async ({ page }) => {
  await mockPublicShell(page);
  await forceStrokeJokeRoll(page);
  await page.goto("/discover");

  const popup = page.getByTestId("stroke-joke-popup");
  await expect(popup).toBeVisible();
  await expect(popup).toContainText(
    "Congrats on reaching 200000 strokes! Most people finish after only 100!",
  );
  await expect(popup.getByRole("button", { name: "Celebrate!" })).toBeVisible();
  await expect(popup.getByRole("button", { name: /close/i })).toHaveCount(0);

  await popup.getByRole("button", { name: "Celebrate!" }).click();
  await expect(popup).toBeHidden();
  await expect(page.getByTestId("stroke-joke-confetti")).toBeVisible();

  const cooldownUntil = await page.evaluate(
    (key) => window.localStorage.getItem(key),
    strokeJokeCooldownStorageKey,
  );

  expect(Number(cooldownUntil)).toBeGreaterThan(Date.now());
});

test("stroke joke popup waits for cookie notice dismissal", async ({ page }) => {
  await mockPublicShell(page);
  await forceStrokeJokeRoll(page, { acknowledgeCookieNotice: false });
  await page.goto("/discover");

  const popup = page.getByTestId("stroke-joke-popup");
  await expect(page.getByTestId("cookie-notice")).toBeVisible();
  await expect(popup).toHaveCount(0);

  await page.getByTestId("cookie-notice").getByRole("button", { name: "Continue" }).click();
  await expect(popup).toBeVisible();
});

test("stroke joke popup respects cooldown storage", async ({ page }) => {
  await mockPublicShell(page);
  await forceStrokeJokeRoll(page, {
    cooldownUntil: Date.now() + 14 * 24 * 60 * 60 * 1000,
  });
  await page.goto("/discover");

  await expect(page.getByLabel("thia.lol home")).toBeVisible();
  await expect(page.getByTestId("stroke-joke-popup")).toHaveCount(0);
  await expect(page.getByTestId("stroke-joke-confetti")).toHaveCount(0);
});

test("stroke joke popup stays off excluded routes", async ({ page }) => {
  await mockPublicShell(page);
  await forceStrokeJokeRoll(page);
  await page.goto("/login");

  await expect(page.getByLabel("thia.lol home")).toBeVisible();
  await expect(page.getByTestId("stroke-joke-popup")).toHaveCount(0);
  await expect(page.getByTestId("stroke-joke-confetti")).toHaveCount(0);
});

test("authenticated account menu uses one row pattern", async ({ page }) => {
  await mockAuthenticatedShell(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");

  await page.getByRole("button", { name: /account menu/i }).click();
  const menu = page.getByTestId("account-menu");
  await expect(menu).toBeVisible();

  const profile = menu.getByRole("menuitem", { name: "Profile" });
  const legal = menu.getByRole("menuitem", { name: "Legal" });
  const logout = menu.getByRole("menuitem", { name: "Log out" });

  await expect(profile).toBeVisible();
  await expect(legal).toBeVisible();
  await expect(logout).toBeVisible();

  const profileClass = await profile.evaluate((element) =>
    element.getAttribute("class"),
  );
  const legalClass = await legal.evaluate((element) => element.getAttribute("class"));
  const logoutClass = await logout.evaluate((element) =>
    element.getAttribute("class"),
  );
  const profileBox = await profile.boundingBox();
  const logoutBox = await logout.boundingBox();

  expect(legalClass).toBe(profileClass);
  expect(logoutClass).toBe(profileClass);
  expect(Math.abs((profileBox?.height ?? 0) - (logoutBox?.height ?? 0))).toBeLessThan(1);

  await page.keyboard.press("Escape");
  await expect(menu).toBeHidden();
});

test("mobile bottom nav stays fixed while footer reserves its clearance", async ({ page }) => {
  await mockPublicShell(page);
  await acknowledgeCookieNotice(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/login");
  await page.evaluate(() => {
    window.scrollTo(0, document.documentElement.scrollHeight);
  });

  const nav = page.getByTestId("mobile-nav");
  const footer = page.getByTestId("site-footer");
  await expect(nav).toBeVisible();
  await expect(footer).toBeVisible();

  const boxes = await page.evaluate(() => {
    const navRect = document
      .querySelector('[data-testid="mobile-nav"]')
      ?.getBoundingClientRect();
    const footerRect = document
      .querySelector('[data-testid="site-footer"]')
      ?.getBoundingClientRect();

    return {
      documentHeight: document.documentElement.scrollHeight,
      footer: footerRect
        ? {
            bottom: footerRect.bottom,
            top: footerRect.top,
          }
        : null,
      nav: navRect
        ? {
            bottom: navRect.bottom,
            height: navRect.height,
            top: navRect.top,
          }
        : null,
      footerPaddingBottom: footerRect
        ? Number.parseFloat(
            window.getComputedStyle(
              document.querySelector('[data-testid="site-footer"]')!,
            ).paddingBottom,
          )
        : null,
      navPosition: navRect
        ? window.getComputedStyle(
            document.querySelector('[data-testid="mobile-nav"]')!,
          ).position
        : null,
      scrollY: window.scrollY,
      viewportBottomGap: navRect ? window.innerHeight - navRect.bottom : null,
    };
  });

  expect(boxes.nav).not.toBeNull();
  expect(boxes.footer).not.toBeNull();
  expect(boxes.footer!.bottom + boxes.scrollY).toBeCloseTo(boxes.documentHeight, 0);
  expect(boxes.navPosition).toBe("fixed");
  expect(boxes.footerPaddingBottom).not.toBeNull();
  expect(boxes.footerPaddingBottom!).toBeGreaterThanOrEqual(boxes.nav!.height);
  expect(boxes.viewportBottomGap).not.toBeNull();
  expect(boxes.viewportBottomGap!).toBeGreaterThanOrEqual(-6);
});

test("auth pages show compact brand identity without horizontal overflow", async ({
  page,
}) => {
  await mockPublicShell(page);
  await acknowledgeCookieNotice(page);
  await page.setViewportSize({ width: 390, height: 844 });

  for (const path of ["/login", "/register"]) {
    await page.goto(path);

    await expect(page.getByTestId("auth-brand-logo-main")).toBeVisible();
    await expect(page.getByRole("link", { name: "Terms of Service" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Privacy Policy" })).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Community Guidelines" }),
    ).toBeVisible();
    await expectNoHorizontalOverflow(page);
  }
});

test("login returnTo accepts internal paths", async ({ page }) => {
  const authState = { authenticated: false };

  await mockPublicShell(page, { authState });
  await acknowledgeCookieNotice(page);
  await page.goto("/login?returnTo=%2F%40thia");

  await page.getByRole("textbox", { name: "Email" }).fill("viewer@example.test");
  await page.getByLabel("Password").fill("password12345");
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page).toHaveURL(/\/@thia$/);
});

test("login returnTo rejects external paths", async ({ page }) => {
  const authState = { authenticated: false };

  await mockPublicShell(page, { authState });
  await acknowledgeCookieNotice(page);
  await page.goto("/login?returnTo=https%3A%2F%2Fevil.test%2Fprofile");

  await page.getByRole("textbox", { name: "Email" }).fill("viewer@example.test");
  await page.getByLabel("Password").fill("password12345");
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page).toHaveURL(/\/$/);
  expect(new URL(page.url()).pathname).toBe("/");
  expect(new URL(page.url()).origin).not.toBe("https://evil.test");
});

test("two-factor login preserves safe returnTo", async ({ page }) => {
  const authState = { authenticated: false };

  await mockPublicShell(page, { authState });
  await acknowledgeCookieNotice(page);
  await page.goto("/login?returnTo=%2F%40thia%3Ffrom%3Dspotify");

  await page.getByRole("textbox", { name: "Email" }).fill("twofactor@example.test");
  await page.getByLabel("Password").fill("password12345");
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(
    page.getByRole("textbox", { name: "Authenticator or recovery code" }),
  ).toBeVisible();
  await page
    .getByRole("textbox", { name: "Authenticator or recovery code" })
    .fill("123456");
  await page.getByRole("button", { name: "Verify code" }).click();

  await expect(page).toHaveURL(/\/@thia\?from=spotify$/);
});

test("mobile primary nav shows one Post affordance and no Admin", async ({ page }) => {
  await mockPublicShell(page);
  await acknowledgeCookieNotice(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/discover");

  const nav = page.getByTestId("mobile-nav");
  await expect(nav).toBeVisible();

  for (const label of ["Home", "Discover", "Rooms", "Chat"]) {
    await expect(nav.getByRole("link", { name: label })).toBeVisible();
  }

  await expect(nav.getByRole("button", { name: "Post" })).toHaveCount(1);
  await expect(nav.getByRole("link", { name: "Search" })).toHaveCount(0);
  await expect(
    page.locator("header").getByRole("link", { name: "Search" }),
  ).toBeVisible();
  await expect(nav.getByRole("link", { name: "Admin" })).toHaveCount(0);
});

test("mobile primary nav remains usable on main routes", async ({ page }) => {
  await mockPublicShell(page);
  await acknowledgeCookieNotice(page);
  await page.setViewportSize({ width: 390, height: 844 });

  for (const path of ["/discover", "/search", "/rooms", "/chat", "/@thia"]) {
    await page.goto(path);

    const nav = page.getByTestId("mobile-nav");
    await expect(nav).toBeVisible();

    for (const label of ["Home", "Discover", "Rooms", "Chat"]) {
      await expect(nav.getByRole("link", { name: label })).toBeVisible();
    }

    await expect(nav.getByRole("button", { name: "Post" })).toHaveCount(1);
    await expect(nav.getByRole("link", { name: "Search" })).toHaveCount(0);
    await expectNoHorizontalOverflow(page);
    await expectRefinedMobileDock(page);
  }
});

test("route changes keep the mobile bottom nav clickable", async ({ page }) => {
  await mockPublicShell(page);
  await acknowledgeCookieNotice(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/discover");

  for (const item of [
    { label: "Rooms", pattern: /\/rooms$/ },
    { label: "Chat", pattern: /\/chat$/ },
    { label: "Discover", pattern: /\/discover$/ },
  ]) {
    const nav = page.getByTestId("mobile-nav");
    await expect(nav).toBeVisible();
    await nav.getByRole("link", { name: item.label }).click();
    await expect(page).toHaveURL(item.pattern);
    await expect(nav.getByRole("button", { name: "Post" })).toHaveCount(1);
    await expectChatHitTargetClear(page);
  }
});

test("mobile room route uses one contextual Post action", async ({ page }) => {
  await mockAuthenticatedShell(page, { rooms: [makeRoom()] });
  await acknowledgeCookieNotice(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/rooms/sun-room");

  await expect(page.getByTestId("room-page")).toBeVisible();
  await expect(page.getByTestId("room-header")).toBeVisible();
  await expect(page.getByTestId("room-meta")).toContainText("0 posts");
  await expect(page.getByTestId("room-meta")).toContainText("1 member");
  await expect(page.getByText("No activity yet")).toHaveCount(0);
  await expect(page.getByText("No room rules have been added yet.")).toHaveCount(0);
  await expect(page.getByText("No extra moderators yet.")).toHaveCount(0);
  await expect(page.getByTestId("room-post-button")).toBeHidden();

  const nav = page.getByTestId("mobile-nav");
  await expect(nav.getByRole("button", { name: "Post" })).toHaveCount(1);
  await nav.getByTestId("mobile-post-action").click();

  const dialog = page.getByTestId("composer-modal");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByTestId("composer-room-selector")).toHaveValue("sun-room");

  const box = await dialog.boundingBox();
  const viewport = page.viewportSize();

  expect(box).not.toBeNull();
  expect(viewport).not.toBeNull();
  expect(box!.height).toBeGreaterThanOrEqual(viewport!.height * 0.9);
});

test("chat page is honest about sign-in state", async ({ page }) => {
  await mockPublicShell(page);
  await page.goto("/chat");

  await expect(page.getByRole("heading", { name: "Chat" })).toBeVisible();
  await expect(page.getByText("Sign in to see messages.")).toBeVisible();
});

test("public profile route renders the default Feed for a blank profile", async ({
  page,
}) => {
  await mockPublicShell(page);
  await page.goto("/@thia");

  await expect(page.getByRole("heading", { name: "Thia" })).toBeVisible();
  await expect(page.getByText("@thia")).toBeVisible();
  await expect(page.getByRole("button", { name: "0 Followers" })).toBeVisible();
  await expect(page.getByRole("button", { name: "0 Following" })).toBeVisible();

  await expect(page.getByTestId("profile-grid-module-activity")).toHaveAttribute(
    "data-profile-grid-size",
    "4x6",
  );
  await expect(page.getByTestId("profile-module-activity")).toBeVisible();
  await expect(page.getByTestId("profile-activity-tabs")).toBeVisible();
  await expect(page.getByText("No posts yet")).toBeVisible();
});

test("authenticated post button opens the shared progressive composer", async ({
  page,
}) => {
  await mockAuthenticatedShell(page, { rooms: [makeRoom()] });
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Account menu for @viewer" })).toBeVisible();

  const desktopPost = page.getByTestId("desktop-post-action");
  await expect(desktopPost).toBeVisible();
  const desktopPostBox = await desktopPost.boundingBox();
  expect(desktopPostBox?.height).toBeGreaterThanOrEqual(48);
  expect(desktopPostBox?.width).toBeGreaterThanOrEqual(88);

  await page.getByTestId("desktop-post-action").click();

  const dialog = page.getByTestId("composer-modal");
  await expect(dialog).toBeVisible();
  const composerPost = dialog.getByRole("button", { name: "Post", exact: true });
  await expect(composerPost).toBeVisible();
  await expect(composerPost).toHaveCSS("min-height", "44px");
  await expect(dialog.getByTestId("unified-composer")).toBeVisible();
  await expect(dialog.getByRole("textbox", { name: "Post" })).toBeVisible();
  await expect(dialog.getByTestId("post-composer-markdown-toolbar")).toHaveCount(0);
  await expect(dialog.getByTestId("post-composer-markdown-preview")).toHaveCount(0);
  await dialog.getByRole("button", { name: "Format" }).click();
  await expect(dialog.getByTestId("post-composer-markdown-toolbar")).toBeVisible();
  await expect(dialog.getByTitle("Upload image or video")).toBeVisible();
  const gifButton = dialog.getByRole("button", { name: "Add GIF" });
  await expect(gifButton).toBeVisible();
  await expect(
    gifButton.locator('svg[data-icon="gif"][data-icon-source="heroicons"]'),
  ).toHaveAttribute("stroke-width", "2");
  await expect(dialog.getByRole("button", { name: "Add music" })).toBeVisible();
  await expect(dialog.getByText("Post to a profile or room.")).toHaveCount(0);
  await expect(dialog.getByText("Post to your profile.")).toHaveCount(0);
  await expect(dialog.getByText("Images are converted to WebP")).toHaveCount(0);
  await expect(dialog.getByText(/anyone.*reply/i)).toHaveCount(0);

  const destinationControl = dialog.getByTestId("composer-destination-control");
  const selector = dialog.getByRole("combobox", { name: "Post to" });
  await expect(destinationControl).toBeVisible();
  await expect(selector).toBeVisible();
  await expect(selector).toHaveCSS("appearance", "none");
  await expect(selector.locator('option[value="sun-room"]')).toHaveCount(1);

  const destinationControlBox = await destinationControl.boundingBox();
  const selectorBox = await selector.boundingBox();
  expect(destinationControlBox).not.toBeNull();
  expect(selectorBox).not.toBeNull();
  expect(selectorBox!.width).toBeGreaterThanOrEqual(destinationControlBox!.width - 2);
  expect(selectorBox!.height).toBeGreaterThanOrEqual(destinationControlBox!.height - 2);

  await selector.focus();
  await expect(selector).toBeFocused();
  await selector.selectOption("sun-room");
  await expect(selector).toHaveValue("sun-room");
  await expect(selector).not.toBeFocused();

  await dialog.getByRole("button", { name: "Close post composer" }).click();
  await expect(dialog).toBeHidden();
});

test("post composer submits Markdown and Spotify/YouTube music attachments", async ({
  page,
}) => {
  await mockAuthenticatedShell(page);
  let postPayload: Record<string, unknown> | undefined;
  const testArtwork =
    "data:image/gif;base64,R0lGODlhAQABAAAAACwAAAAAAQABAAA=";

  await mockMusicSuggestionRoutes(page, {
    spotifyItems: [
      {
        id: "spotify-playlist-1",
        label: "Test Playlist",
        description: "Saved from Spotify",
        sourceUrl: "https://open.spotify.com/playlist/test-playlist",
        moduleType: "music",
        moduleTitle: "Test Playlist",
        card: makeMusicIntegrationCard("spotify", "playlist", "test-playlist", {
          imageUrl: testArtwork,
          title: "Test Playlist",
          subtitle: "Spotify",
        }),
      },
    ],
  });
  await mockSpotifyIframeApi(page);
  await page.route(/^https:\/\/open\.spotify\.com\/embed\/(?:album|artist|episode|playlist|show|track)\//, (route) =>
    route.fulfill({
      contentType: "text/html",
      body: "<!doctype html><html><body>Spotify embed stub</body></html>",
    }),
  );
  await page.route(/^https:\/\/www\.youtube-nocookie\.com\/embed\//, (route) =>
    route.fulfill({
      contentType: "text/html",
      body: "<!doctype html><html><body>YouTube embed stub</body></html>",
    }),
  );

  await page.route("**/api/me/integrations/metadata/resolve", async (route) => {
    const payload = (await route.request().postDataJSON()) as {
      provider?: "spotify" | "youtube";
      url?: string;
    };
    const provider = payload.provider ?? "youtube";

    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: makeMusicIntegrationCard(provider, "video", "abc123", {
          imageUrl: testArtwork,
          sourceUrl: payload.url ?? "https://www.youtube.com/watch?v=abc123",
          title: provider === "youtube" ? "YouTube Test" : "Spotify Test",
          subtitle: provider === "youtube" ? "YouTube" : "Spotify",
        }),
      }),
    });
  });

  await page.route("**/api/posts", async (route) => {
    if (route.request().method() === "POST") {
      postPayload = (await route.request().postDataJSON()) as Record<string, unknown>;
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          data: makePost({
            id: 99,
            body: String(postPayload.body),
            bodyFormat: "markdown",
            contentVersion: 3,
            attachments: mockPostAttachmentsWithArtwork(
              postPayload.attachments,
              testArtwork,
            ),
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

  await page.goto("/");
  await expect(page.getByRole("button", { name: "Account menu for @viewer" })).toBeVisible();
  await page.getByRole("button", { name: "Post", exact: true }).click();

  const dialog = page.getByTestId("composer-modal");
  const body = dialog.getByTestId("post-composer-body");
  await body.fill("Favorite track");
  await expect(body).not.toHaveCSS("color", "rgba(0, 0, 0, 0)");
  await body.evaluate((element) => {
    const textarea = element as HTMLTextAreaElement;
    textarea.setSelectionRange(0, "Favorite".length);
  });
  await dialog.getByRole("button", { name: "Format" }).click();
  await dialog.getByTestId("post-composer-markdown-button-bold").click();
  await expect(body).toHaveValue("**Favorite** track");
  await dialog.getByRole("button", { name: "Preview" }).click();
  await expect(dialog.getByTestId("post-composer-markdown-preview")).not.toHaveCSS(
    "position",
    "absolute",
  );
  await expect(
    dialog.getByTestId("post-composer-markdown-preview").locator("strong").filter({
      hasText: "Favorite",
    }),
  ).toBeVisible();
  await expect(dialog.getByTestId("post-composer-markdown-preview")).toContainText(
    "track",
  );
  await body.fill("Oh so if i do\n## ");
  await expect(dialog.getByTestId("post-composer-markdown-preview")).toContainText(
    "##",
  );
  await body.fill("# Alpha\n## Beta\n### Gamma\nPlain paragraph");
  await expect(
    dialog.getByTestId("post-composer-markdown-preview").getByRole("heading", {
      name: "Alpha",
    }),
  ).toBeVisible();
  const headingSizes = await dialog
    .getByTestId("post-composer-markdown-preview")
    .evaluate((element) => {
      const byText = (selector: string, text: string) =>
        Array.from(element.querySelectorAll<HTMLElement>(selector)).find((node) =>
          node.textContent?.includes(text),
        );
      const sizeOf = (node: HTMLElement | undefined) =>
        node ? Number.parseFloat(window.getComputedStyle(node).fontSize) : 0;

      return {
        h1: sizeOf(byText("h3", "Alpha")),
        h2: sizeOf(byText("h4", "Beta")),
        h3: sizeOf(byText("h4", "Gamma")),
        paragraph: sizeOf(byText("p", "Plain paragraph")),
      };
    });

  expect(headingSizes.h1).toBeGreaterThan(headingSizes.h2);
  expect(headingSizes.h2).toBeGreaterThan(headingSizes.h3);
  expect(headingSizes.h3).toBeGreaterThan(headingSizes.paragraph);
  await body.fill("**Favorite** track");

  await dialog.getByRole("button", { name: "Add music" }).click();
  await expect(dialog.getByTestId("post-music-picker")).toBeVisible();
  await dialog.getByTestId("post-music-suggestion-spotify-0").click();
  await expect(dialog.getByTestId("composer-attachments")).toContainText("Test Playlist");

  await dialog.getByRole("button", { name: "Add music" }).click();
  await dialog
    .getByTestId("post-music-url-input")
    .fill("https://www.youtube.com/watch?v=abc123");
  await dialog.getByTestId("post-music-url-submit").click();
  await expect(dialog.getByTestId("composer-attachments")).toContainText("YouTube Test");

  await dialog.getByRole("button", { name: "Post", exact: true }).click();

  await expect.poll(() => postPayload).toMatchObject({
    body: "**Favorite** track",
    attachments: [
      { kind: "integration", provider: "spotify" },
      { kind: "integration", provider: "youtube" },
    ],
  });
  const createdPost = page
    .getByTestId("post-card-open-thread")
    .filter({ hasText: "Favorite track" })
    .first();
  const spotifyPlayer = createdPost.getByTestId("post-attachments-0-music-player");
  await expect(spotifyPlayer).toContainText(
    "Test Playlist",
  );
  await expect(spotifyPlayer).toContainText("Spotify");
  await expect(spotifyPlayer.getByTestId("post-attachments-0-music-artwork")).toBeVisible();
  await expect(createdPost.getByTestId("post-attachments-0-music-embed-spotify")).toHaveCount(0);
  await expect(createdPost.getByTestId("post-attachments-0-provider-frame-spotify")).toHaveCSS(
    "opacity",
    "0",
  );
  await expect(createdPost.getByTestId("post-attachments-0-provider-iframe-spotify")).toBeAttached();
  await spotifyPlayer.getByTestId("post-attachments-0-music-play-button").click();
  await expect.poll(() => spotifyPlayCalls(page)).toBeGreaterThan(0);
  await expect(spotifyPlayer.getByTestId("post-attachments-0-music-progress-time")).toHaveText(
    /1:0\d \/ 3:00/,
  );

  const youtubePlayer = createdPost.getByTestId("post-attachments-1-music-player");
  await expect(youtubePlayer).toContainText(
    "YouTube Test",
  );
  await expect(youtubePlayer).toContainText("YouTube Music");
  await expect(youtubePlayer.getByTestId("post-attachments-1-music-artwork")).toBeVisible();
  await expect(createdPost.getByTestId("post-attachments-1-music-embed-youtube")).toHaveCount(0);
  await expect(createdPost.getByTestId("post-attachments-1-provider-frame-youtube")).toHaveCSS(
    "opacity",
    "0",
  );
  await expect(
    createdPost.getByTestId("post-attachments-1-provider-iframe-youtube"),
  ).toHaveAttribute("src", /https:\/\/www\.youtube-nocookie\.com\/embed\/abc123/);
  await youtubePlayer.getByTestId("post-attachments-1-music-play-button").click();
  await expect(youtubePlayer.getByTestId("post-attachments-1-music-progress-time")).toHaveText(
    "Playing",
  );
  await expect(youtubePlayer.getByTestId("post-attachments-1-music-progress-bar")).toHaveAttribute(
    "aria-valuenow",
    "100",
  );
});

test("public pages do not render retired social copy", async ({ page }) => {
  await mockPublicShell(page);

  for (const path of ["/", "/discover", "/rooms", "/chat", "/@thia"]) {
    await page.goto(path);
    await expect(page.locator("body")).toBeVisible();

    const bodyText = await page.locator("body").innerText();

    for (const copy of retiredMockCopy) {
      expect(bodyText).not.toMatch(retiredCopyPattern(copy));
    }
  }
});

function retiredCopyPattern(copy: string): RegExp {
  const escapedCopy = copy
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\s+/g, "\\s+");

  return new RegExp(`(^|[^\\p{L}\\p{N}_])${escapedCopy}([^\\p{L}\\p{N}_]|$)`, "iu");
}

async function expectNoHorizontalOverflow(page: Page) {
  const hasOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(hasOverflow).toBe(false);
}

async function acknowledgeCookieNotice(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem("thia_cookie_notice_ack", "1");
  });
}

async function forceStrokeJokeRoll(
  page: Page,
  options: {
    acknowledgeCookieNotice?: boolean;
    cooldownUntil?: number;
    roll?: number;
  } = {},
) {
  await page.addInitScript(
    ({ acknowledgeCookieNotice, cooldownKey, cooldownUntil, roll }) => {
      if (acknowledgeCookieNotice) {
        window.localStorage.setItem("thia_cookie_notice_ack", "1");
      } else {
        window.localStorage.removeItem("thia_cookie_notice_ack");
      }

      window.localStorage.removeItem(cooldownKey);
      window.sessionStorage.removeItem("thia.strokeJoke.roll:v1");

      if (typeof cooldownUntil === "number") {
        window.localStorage.setItem(cooldownKey, String(cooldownUntil));
      }

      Math.random = () => roll;
    },
    {
      acknowledgeCookieNotice: options.acknowledgeCookieNotice ?? true,
      cooldownKey: strokeJokeCooldownStorageKey,
      cooldownUntil: options.cooldownUntil,
      roll: options.roll ?? 0.01,
    },
  );
}

async function expectRefinedMobileDock(page: Page) {
  const boxes = await page.evaluate(() => {
    const nav = document
      .querySelector('[data-testid="mobile-nav"]')
      ?.getBoundingClientRect();
    const post = document
      .querySelector('[data-testid="mobile-post-action"]')
      ?.getBoundingClientRect();
    const links = Array.from(
      document.querySelectorAll('[data-testid="mobile-nav"] a'),
    ).map((link) => {
      const rect = link.getBoundingClientRect();

      return {
        active: link.getAttribute("aria-current") === "page",
        bottom: rect.bottom,
        height: rect.height,
        href: link.getAttribute("href"),
        left: rect.left,
        right: rect.right,
        top: rect.top,
        width: rect.width,
      };
    });

    return {
      nav: nav
        ? {
            bottom: nav.bottom,
            height: nav.height,
            left: nav.left,
            right: nav.right,
            top: nav.top,
            width: nav.width,
          }
        : null,
      post: post
        ? {
            bottom: post.bottom,
            height: post.height,
            left: post.left,
            right: post.right,
            top: post.top,
            width: post.width,
          }
        : null,
      links,
    };
  });

  expect(boxes.nav).not.toBeNull();
  expect(boxes.post).not.toBeNull();
  expect(boxes.nav!.height).toBeGreaterThanOrEqual(56);
  expect(boxes.nav!.height).toBeLessThanOrEqual(76);
  expect(boxes.post!.width).toBeGreaterThanOrEqual(43.5);
  expect(boxes.post!.height).toBeGreaterThanOrEqual(43.5);
  expect(boxes.post!.top).toBeGreaterThanOrEqual(boxes.nav!.top - 8);
  expect(boxes.post!.bottom).toBeLessThanOrEqual(boxes.nav!.bottom + 1);
  expect(boxes.post!.left).toBeGreaterThanOrEqual(boxes.nav!.left);
  expect(boxes.post!.right).toBeLessThanOrEqual(boxes.nav!.right);

  const navCenterY = boxes.nav!.top + boxes.nav!.height / 2;
  const postCenterY = boxes.post!.top + boxes.post!.height / 2;
  expect(Math.abs(postCenterY - navCenterY)).toBeLessThanOrEqual(1.5);

  expect(boxes.links).toHaveLength(4);
  for (const link of boxes.links) {
    expect(link.height).toBeGreaterThanOrEqual(43.5);
    expect(link.height).toBeLessThanOrEqual(48);
    expect(link.width).toBeLessThanOrEqual(80);
  }

  const activeLink = boxes.links.find((link) => link.active);
  if (activeLink) {
    expect(activeLink.height).toBeLessThanOrEqual(48);
  }
}

async function expectChatHitTargetClear(page: Page) {
  const clear = await page.evaluate(() => {
    const chat = document
      .querySelector('[data-testid="mobile-nav"] a[href="/chat"]')
      ?.getBoundingClientRect();

    if (!chat) {
      return false;
    }

    const x = chat.left + chat.width / 2;
    const y = chat.top + chat.height / 2;
    const hit = document.elementFromPoint(x, y);

    return Boolean(hit?.closest('a[href="/chat"]'));
  });

  expect(clear).toBe(true);
}

type ShellOptions = {
  authState?: { authenticated: boolean };
  authenticated?: boolean;
  discoverPosts?: ReturnType<typeof makePost>[];
  homePosts?: ReturnType<typeof makePost>[];
  rooms?: ReturnType<typeof makeRoom>[];
};

async function mockPublicShell(page: Page, options: ShellOptions = {}) {
  await mockShell(page, { ...options, authenticated: false });
}

async function mockAuthenticatedShell(page: Page, options: ShellOptions = {}) {
  await mockShell(page, { ...options, authenticated: true });
}

async function mockMusicSuggestionRoutes(
  page: Page,
  options: {
    spotifyItems?: Array<Record<string, unknown>>;
    youtubeItems?: Array<Record<string, unknown>>;
  } = {},
) {
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
            account: {
              provider,
              providerAccountId: `${provider}-viewer`,
              displayName: `${provider} viewer`,
              scopes: [],
            },
            items:
              provider === "spotify"
                ? options.spotifyItems ?? []
                : options.youtubeItems ?? [],
            generatedAt: "2026-06-25T12:00:00.000Z",
          },
        }),
      }),
    );
  }
}

async function mockShell(
  page: Page,
  {
    authState,
    authenticated = false,
    discoverPosts = [],
    homePosts = [],
    rooms = [],
  }: ShellOptions = {},
) {
  const currentAuthenticated = () => authState?.authenticated ?? authenticated;
  const authSession = () => ({
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
  });

  await page.route("**/api/auth/me", (route) =>
    route.fulfill({
      status: currentAuthenticated() ? 200 : 401,
      contentType: "application/json",
      body: JSON.stringify(
        currentAuthenticated()
          ? authSession()
          : { ok: false, error: "Not authenticated." },
      ),
    }),
  );

  if (authState) {
    await page.route("**/api/auth/login", async (route) => {
      const payload = (await route.request().postDataJSON()) as {
        email?: string;
      };

      if (payload.email === "twofactor@example.test") {
        await route.fulfill({
          contentType: "application/json",
          body: JSON.stringify({
            ok: true,
            data: {
              twoFactorRequired: true,
              challengeId: "challenge-return",
            },
          }),
        });
        return;
      }

      authState.authenticated = true;
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ ok: true, data: {} }),
      });
    });

    await page.route("**/api/auth/2fa/verify", async (route) => {
      authState.authenticated = true;
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify(authSession()),
      });
    });
  }

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

  await page.route("**/api/me/onboarding", (route) =>
    route.fulfill({
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
          completedSteps: [],
          skippedSteps: [],
          providerLinks: {},
          finishedAt: "2026-06-10 10:00:00",
          dismissedAt: null,
          createdAt: "2026-06-10 09:00:00",
          updatedAt: "2026-06-10 10:00:00",
        },
      }),
    }),
  );

  await page.route("**/api/me/integrations", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: {
          providers: [],
          accounts: [],
        },
      }),
    }),
  );

  await page.route("**/api/feed/home", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: { posts: homePosts, personalized: currentAuthenticated() },
      }),
    }),
  );

  await page.route("**/api/feed/discover", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: { posts: discoverPosts, activeRooms: [], peopleToWatch: [] },
      }),
    }),
  );

  await page.route("**/api/stats", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: {
          publicRooms: rooms.length,
          publicPosts: homePosts.length + discoverPosts.length,
          activeUsers: 1,
          totalReactions: 0,
        },
      }),
    }),
  );

  for (const room of rooms) {
    await page.route(`**/api/rooms/${room.slug}`, (route) =>
      route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ ok: true, data: room }),
      }),
    );
    await page.route(`**/api/rooms/${room.slug}/posts`, (route) =>
      route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ ok: true, data: [] }),
      }),
    );
    await page.route(`**/api/rooms/${room.slug}/members`, (route) =>
      route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ ok: true, data: [] }),
      }),
    );
  }

  await page.route("**/api/rooms", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ ok: true, data: rooms }),
    }),
  );

  await mockProfileRoutes(page, "thia");
}

async function mockProfileRoutes(page: Page, handle: string) {
  await page.route(`**/api/profiles/${handle}`, (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ ok: true, data: makeProfile(handle) }),
    }),
  );

  for (const suffix of [
    "posts",
    "replies",
    "reblogs",
    "rooms",
    "followers",
    "following",
  ]) {
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
      body: JSON.stringify({
        ok: true,
        data: [profileInfoModule(), defaultFeedModule()],
      }),
    }),
  );

  await page.route(`**/api/profiles/${handle}/badges`, (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ ok: true, data: { badges: [], featuredBadges: [] } }),
    }),
  );
}

function makeProfile(handle: string) {
  return {
    user: {
      id: 2,
      handle,
      displayName: handle === "thia" ? "Thia" : "Member",
      initials: handle.charAt(0).toUpperCase(),
      aura: "frost",
      avatarUrl: null,
    },
    bio: "A public profile.",
    location: "",
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
    createdAt: "2026-06-10 09:00:00",
    updatedAt: "2026-06-10 09:00:00",
  };
}

function makeRoom() {
  return {
    id: 1,
    slug: "sun-room",
    name: "Sun Room",
    summary: "A public room.",
    description: "A public room.",
    mood: "",
    members: 1,
    memberCount: 1,
    live: false,
    theme: "glinda",
    themeConfig: { mode: "preset", preset: "glinda" },
    iconUrl: null,
    bannerUrl: null,
    rules: "",
    visibility: "public",
    owner: {
      id: 2,
      handle: "owner",
      displayName: "Owner",
      initials: "O",
      aura: "frost",
      avatarUrl: null,
    },
    joinedByMe: false,
    myRoomRole: null,
    viewerCanPost: true,
    viewerCanViewPosts: true,
    postCount: 0,
    latestActivityAt: null,
    createdAt: "2026-06-10 00:00:00",
    updatedAt: "2026-06-10 00:00:00",
  };
}

function profileInfoModule() {
  return {
    id: 0,
    type: "profile_info",
    title: "Profile info",
    config: {},
    visibility: "public",
    position: 1,
    pinned: true,
    layout: {
      column: 3,
      row: 1,
      colSpan: 8,
      rowSpan: 3,
    },
    status: "active",
    schemaVersion: 1,
    createdAt: null,
    updatedAt: null,
  };
}

function defaultFeedModule() {
  return {
    id: 0,
    type: "activity",
    title: "Feed",
    config: {},
    visibility: "public",
    position: 2,
    pinned: false,
    layout: {
      column: 1,
      row: 4,
      colSpan: 4,
      rowSpan: 6,
    },
    status: "active",
    schemaVersion: 1,
    createdAt: null,
    updatedAt: null,
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
    profile: makeProfile("alex"),
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
      theme: "elphaba",
      themeConfig: { mode: "preset", preset: "elphaba" },
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

function makeMusicIntegrationCard(
  provider: "spotify" | "youtube",
  resourceType: string,
  resourceId: string,
  overrides: {
    imageUrl?: string;
    sourceUrl?: string;
    subtitle?: string;
    title?: string;
  } = {},
) {
  const sourceUrl =
    overrides.sourceUrl ??
    (provider === "spotify"
      ? `https://open.spotify.com/${resourceType}/${resourceId}`
      : `https://www.youtube.com/watch?v=${resourceId}`);

  return {
    provider,
    resourceType,
    resourceId,
    resourceKey: `${provider}:${resourceType}:${resourceId}`,
    sourceUrl,
    apiBacked: true,
    embed: null,
    metadata: {
      title: overrides.title ?? "Music item",
      subtitle: overrides.subtitle ?? (provider === "spotify" ? "Spotify" : "YouTube"),
      description: null,
      imageUrl: overrides.imageUrl ?? null,
      stats: {},
    },
  };
}

function mockPostAttachmentsWithArtwork(value: unknown, imageUrl: string): unknown {
  if (!Array.isArray(value)) {
    return value;
  }

  return value.map((rawAttachment, index) => {
    if (
      typeof rawAttachment !== "object" ||
      rawAttachment === null ||
      Array.isArray(rawAttachment)
    ) {
      return rawAttachment;
    }

    const attachment = rawAttachment as Record<string, unknown>;
    if (attachment.kind !== "integration") {
      return {
        position: index + 1,
        ...attachment,
      };
    }

    const card = recordValue(attachment.card);
    const metadata = recordValue(card?.metadata);

    return {
      position: index + 1,
      ...attachment,
      card: {
        provider: attachment.provider,
        resourceType: attachment.resourceType,
        resourceId: attachment.resourceId,
        resourceKey: attachment.resourceKey,
        sourceUrl: attachment.sourceUrl,
        ...(card ?? {}),
        metadata: {
          ...(metadata ?? {}),
          imageUrl: typeof metadata?.imageUrl === "string" ? metadata.imageUrl : imageUrl,
        },
      },
    };
  });
}

function recordValue(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}
