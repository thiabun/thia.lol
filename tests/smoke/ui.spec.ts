import { expect, type Page, test } from "@playwright/test";

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

test("desktop primary nav shows platform sections without Admin", async ({ page }) => {
  await mockPublicShell(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");

  await expect(page.getByLabel("thia.lol home")).toBeVisible();
  await expect(page.getByText("social app")).toHaveCount(0);

  const nav = page.getByTestId("desktop-nav");
  await expect(nav).toBeVisible();

  for (const label of ["Home", "Discover", "Search", "Rooms", "Chat"]) {
    await expect(nav.getByRole("link", { name: label })).toBeVisible();
  }

  await expect(nav.getByRole("link", { name: "Admin" })).toHaveCount(0);
});

test("reply button opens an unclipped thread modal", async ({ page }) => {
  await mockPublicShell(page, {
    homePosts: [makePost({ commentCount: 1 })],
  });
  await page.route("**/api/posts/42/replies", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ ok: true, data: [] }),
    }),
  );

  await page.goto("/");
  await page.getByRole("button", { name: /open replies/i }).first().click();

  const dialog = page.getByTestId("thread-modal");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Close thread" })).toBeVisible();

  const portalStatus = await page.evaluate(() => {
    const dialogElement = document.querySelector('[role="dialog"][aria-modal="true"]');

    return dialogElement?.parentElement?.parentElement === document.body;
  });

  expect(portalStatus).toBe(true);

  const box = await dialog.boundingBox();
  const viewport = page.viewportSize();

  expect(box).not.toBeNull();
  expect(viewport).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(viewport!.width);
  expect(box!.y + box!.height).toBeLessThanOrEqual(viewport!.height);

  await dialog.getByRole("button", { name: "Close thread" }).click();
  await expect(dialog).toBeHidden();
});

test("mobile header, account menu, and bottom nav fit the viewport", async ({
  page,
}) => {
  await mockPublicShell(page);
  await acknowledgeCookieNotice(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  await expect(page.getByLabel("thia.lol home")).toBeVisible();
  await expect(page.getByText("social app")).toHaveCount(0);
  await expectNoHorizontalOverflow(page);

  await page.getByRole("button", { name: /account menu/i }).click();
  await expect(page.getByTestId("account-menu")).toBeVisible();

  const nav = page.getByTestId("mobile-nav");
  await expect(nav).toBeVisible();
  await expect(nav.getByRole("button", { name: "Post" })).toHaveCount(1);
  await expectRefinedMobileDock(page);
  await expectChatHitTargetClear(page);
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

test("mobile bottom nav releases before the footer", async ({ page }) => {
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
            top: navRect.top,
          }
        : null,
      scrollY: window.scrollY,
      viewportBottomGap: navRect ? window.innerHeight - navRect.bottom : null,
    };
  });

  expect(boxes.nav).not.toBeNull();
  expect(boxes.footer).not.toBeNull();
  expect(boxes.nav!.bottom).toBeLessThanOrEqual(boxes.footer!.top + 1);
  expect(boxes.footer!.bottom + boxes.scrollY).toBeCloseTo(boxes.documentHeight, 0);
  expect(boxes.viewportBottomGap).not.toBeNull();
  expect(boxes.viewportBottomGap!).toBeGreaterThanOrEqual(-4);
  expect(boxes.viewportBottomGap!).toBeLessThanOrEqual(32);
});

test("mobile primary nav shows one Post affordance and no Admin", async ({ page }) => {
  await mockPublicShell(page);
  await acknowledgeCookieNotice(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  const nav = page.getByTestId("mobile-nav");
  await expect(nav).toBeVisible();

  for (const label of ["Home", "Discover", "Rooms", "Chat"]) {
    await expect(nav.getByRole("link", { name: label })).toBeVisible();
  }

  await expect(nav.getByRole("button", { name: "Post" })).toHaveCount(1);
  await expect(nav.getByRole("link", { name: "Search" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Search" })).toBeVisible();
  await expect(nav.getByRole("link", { name: "Admin" })).toHaveCount(0);
});

test("mobile primary nav remains usable on main routes", async ({ page }) => {
  await mockPublicShell(page);
  await acknowledgeCookieNotice(page);
  await page.setViewportSize({ width: 390, height: 844 });

  for (const path of ["/", "/discover", "/search", "/rooms", "/chat", "/@thia"]) {
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
  await page.goto("/");

  for (const item of [
    { label: "Discover", pattern: /\/discover$/ },
    { label: "Rooms", pattern: /\/rooms$/ },
    { label: "Chat", pattern: /\/chat$/ },
    { label: "Home", pattern: /\/$/ },
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
  await expect(page.getByText("Sign in to see your messages.")).toBeVisible();
});

test("public profile route loads profile tabs", async ({ page }) => {
  await mockPublicShell(page);
  await page.goto("/@thia");

  await expect(page.getByRole("heading", { name: "Thia" })).toBeVisible();
  await expect(page.getByText("@thia")).toBeVisible();
  await expect(page.getByText("Joined")).toBeVisible();

  const tabs = page.getByRole("tablist", { name: "Profile sections" });
  await expect(tabs.getByRole("tab", { name: /Feed/ })).toBeVisible();
  await expect(tabs.getByRole("tab", { name: /Replies/ })).toBeVisible();
  await expect(tabs.getByRole("tab", { name: /Rooms/ })).toBeVisible();
  await expect(tabs.getByRole("tab", { name: /Followers/ })).toHaveCount(0);
  await expect(tabs.getByRole("tab", { name: /Badges/ })).toHaveCount(0);
});

test("authenticated post button opens an accessible composer select", async ({
  page,
}) => {
  await mockAuthenticatedShell(page, { rooms: [makeRoom()] });
  await page.goto("/");

  await page.getByRole("button", { name: "Post" }).click();

  const dialog = page.getByTestId("composer-modal");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Post", exact: true })).toBeVisible();
  await expect(dialog.getByRole("textbox", { name: "Post" })).toBeVisible();
  await expect(dialog.getByTitle("Upload image")).toBeVisible();
  await expect(dialog.getByText("Post to a profile or room.")).toHaveCount(0);
  await expect(dialog.getByText("Post to your profile.")).toHaveCount(0);
  await expect(dialog.getByText("Images are converted to WebP")).toHaveCount(0);

  const destinationControl = dialog.getByTestId("composer-destination-control");
  const selector = dialog.getByRole("combobox", { name: "Post to" });
  await expect(destinationControl).toBeVisible();
  await expect(selector).toBeVisible();
  await expect(selector).toHaveCSS("appearance", "none");

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

  await dialog.getByRole("button", { name: "Close post composer" }).click();
  await expect(dialog).toBeHidden();
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

async function mockShell(
  page: Page,
  {
    authenticated = false,
    discoverPosts = [],
    homePosts = [],
    rooms = [],
  }: ShellOptions = {},
) {
  await page.route("**/api/auth/me", (route) =>
    route.fulfill({
      status: authenticated ? 200 : 401,
      contentType: "application/json",
      body: JSON.stringify(
        authenticated
          ? {
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
            }
          : { ok: false, error: "Not authenticated." },
      ),
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

  await page.route("**/api/feed/home", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: { posts: homePosts, personalized: authenticated },
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
    "modules",
  ]) {
    await page.route(`**/api/profiles/${handle}/${suffix}`, (route) =>
      route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ ok: true, data: [] }),
      }),
    );
  }

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
    accent: "var(--accent-sun)",
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
    postCount: 0,
    latestActivityAt: null,
    createdAt: "2026-06-10 00:00:00",
    updatedAt: "2026-06-10 00:00:00",
  };
}

function makePost(overrides: Record<string, unknown> = {}) {
  return {
    id: 42,
    body: "A public post.",
    mood: "sunveil",
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
