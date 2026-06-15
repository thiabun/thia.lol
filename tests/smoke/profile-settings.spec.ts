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

test("profile connections normalize, save, and render", async ({ page }) => {
  let profileLinks: unknown[] = [];
  let savedPayload: Record<string, unknown> | undefined;

  await mockOwnProfile(page, () => profileLinks, (payload) => {
    savedPayload = payload;
    profileLinks = Array.isArray(payload.links) ? payload.links : [];
  });

  await acknowledgeCookieNotice(page);
  await page.goto("/@thia");
  await expect(page.getByRole("button", { name: "Customize profile" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Edit personal space" })).toHaveCount(0);

  await page.getByRole("button", { name: "Customize profile" }).click();
  const modal = page.getByTestId("profile-customization-modal");
  await expect(modal).toBeVisible();
  const modalBox = await modal.boundingBox();
  expect(modalBox?.width ?? 0).toBeLessThanOrEqual(1154);
  await expect(modal.getByRole("heading", { name: "Identity" })).toBeVisible();
  await expect(modal.getByRole("button", { name: /Appearance/ })).toBeVisible();
  await expect(modal.getByRole("button", { name: /Connections/ })).toBeVisible();
  await expect(modal.getByRole("button", { name: /Modules/ })).toBeVisible();
  await expect(modal.getByRole("button", { name: /Preview/ })).toHaveCount(0);
  await expect(modal.getByTestId("profile-customization-preview")).toBeVisible();
  await modal.getByRole("textbox", { name: "Display name" }).fill("Thia Studio");
  await expect(modal.getByTestId("profile-customization-preview")).toContainText(
    "Thia Studio",
  );
  await modal.getByRole("button", { name: /Appearance/ }).click();
  await expect(modal.getByRole("heading", { name: "Appearance" })).toBeVisible();
  await modal.getByRole("button", { name: /Connections/ }).click();
  await expect(modal.getByRole("heading", { name: "Connections" })).toBeVisible();
  await expect(modal.getByLabel("Accent")).toHaveCount(0);
  await expect(modal.getByLabel("Theme")).toHaveCount(0);
  await expect(modal.getByLabel("Traits")).toHaveCount(0);
  for (const [platform, iconName] of Object.entries({
    website: "lucide",
    twitch: "simple-icons:twitch",
    instagram: "simple-icons:instagram",
    bluesky: "simple-icons:bluesky",
    youtube: "simple-icons:youtube",
    tiktok: "simple-icons:tiktok",
    x: "simple-icons:x",
    github: "simple-icons:github",
    discord: "simple-icons:discord",
    spotify: "simple-icons:spotify",
  })) {
    const icon = modal.getByTestId(`connection-icon-${platform}`).first();
    await expect(icon).toBeVisible();

    if (platform === "website") {
      await expect(icon).toHaveAttribute("data-icon-source", "lucide");
    } else {
      await expect(icon).toHaveAttribute("data-icon-source", "simple-icons");
      await expect(icon).toHaveAttribute("data-icon", iconName);
    }
  }

  await modal.getByRole("button", { name: "Add connection" }).click();
  await modal.getByRole("combobox", { name: "Platform" }).last().selectOption("github");
  await modal.getByRole("textbox", { name: "GitHub" }).fill("thiabun");
  await expect(modal.getByTestId("profile-customization-preview")).toContainText("GitHub");
  await expect(modal.getByTestId("connection-icon-github").first()).toBeVisible();
  await modal.getByRole("button", { name: "Save profile" }).click();

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
  await expect(page.getByTestId("connection-icon-github").first()).toHaveAttribute(
    "data-icon",
    "simple-icons:github",
  );
});

test("valid connection cards collapse into compact summaries", async ({ page }) => {
  await mockOwnProfile(page, () => [
    {
      platform: "website",
      label: "thia.lol",
      value: "https://thia.lol/",
      url: "https://thia.lol/",
    },
    {
      platform: "twitch",
      label: "Twitch",
      value: "thiachannel",
      url: "https://www.twitch.tv/thiachannel",
    },
  ]);

  await acknowledgeCookieNotice(page);
  await page.goto("/@thia");
  await page.getByRole("button", { name: "Customize profile" }).click();
  const modal = page.getByTestId("profile-customization-modal");
  await expect(modal).toBeVisible();
  await modal.getByRole("button", { name: /Connections/ }).click();

  await expect(modal.getByText("https://thia.lol/")).toBeVisible();
  await expect(modal.getByText("thiachannel")).toBeVisible();
  await expect(modal.getByTestId("connection-icon-website").first()).toHaveAttribute(
    "data-icon-source",
    "lucide",
  );
  await expect(modal.getByTestId("connection-icon-twitch").first()).toHaveAttribute(
    "data-icon",
    "simple-icons:twitch",
  );
  await expect(modal.getByText("Connection 1")).toHaveCount(0);
  await expect(modal.getByText("Connection 2")).toHaveCount(0);
  await expect(modal.getByRole("textbox", { name: "Website" })).toHaveCount(0);
  await expect(modal.getByRole("textbox", { name: "Twitch" })).toHaveCount(0);

  await modal.getByRole("button", { name: "Edit Website connection" }).click();
  await expect(modal.getByRole("textbox", { name: "Website" })).toBeVisible();
  await modal.getByRole("button", { name: "Done" }).click();
  await expect(modal.getByRole("textbox", { name: "Website" })).toHaveCount(0);

  await modal.getByRole("button", { name: "Edit Twitch connection" }).click();
  await modal.getByRole("textbox", { name: "Twitch" }).fill("");
  await modal.getByRole("button", { name: "Save profile" }).click();
  await expect(modal.getByText("Twitch value is required.")).toBeVisible();
  await expect(modal.getByRole("textbox", { name: "Twitch" })).toBeVisible();

  await modal.getByRole("button", { name: "Remove Twitch connection" }).click();
  await expect(modal.getByText("thiachannel")).toHaveCount(0);
});

test("legacy string profile links normalize before save", async ({ page }) => {
  let profileLinks: unknown[] = ["thia.lol"];
  let savedPayload: Record<string, unknown> | undefined;

  await mockOwnProfile(page, () => profileLinks, (payload) => {
    savedPayload = payload;
    profileLinks = Array.isArray(payload.links) ? payload.links : [];
  });

  await acknowledgeCookieNotice(page);
  await page.goto("/@thia");
  await page.getByRole("button", { name: "Customize profile" }).click();
  await page.getByRole("button", { name: "Save profile" }).click();

  await expect.poll(() => savedPayload).toBeTruthy();
  expect(savedPayload?.links).toMatchObject([
    {
      platform: "website",
      label: "thia.lol",
      value: "https://thia.lol/",
      url: "https://thia.lol/",
    },
  ]);
  await expect(page.getByRole("link", { name: "thia.lol", exact: true })).toBeVisible();
});

test("profile connections show platform-aware validation errors", async ({ page }) => {
  let savedPayload: Record<string, unknown> | undefined;

  await mockOwnProfile(page, () => [], (payload) => {
    savedPayload = payload;
  });

  await acknowledgeCookieNotice(page);
  await page.goto("/@thia");
  await page.getByRole("button", { name: "Customize profile" }).click();
  const modal = page.getByTestId("profile-customization-modal");
  await expect(modal).toBeVisible();
  await modal.getByRole("button", { name: /Connections/ }).click();

  await modal.getByRole("button", { name: "Add connection" }).click();
  await modal.getByRole("textbox", { name: "Website" }).fill("thia.lol");
  await modal.getByRole("button", { name: "Save profile" }).click();
  await expect(modal.getByText("Website requires a full https:// URL.")).toBeVisible();
  expect(savedPayload).toBeUndefined();

  await modal.getByRole("textbox", { name: "Website" }).fill("https://thia.lol/");
  await modal.getByRole("button", { name: "Add connection" }).click();
  await modal.getByRole("combobox", { name: "Platform" }).last().selectOption("spotify");
  await modal.getByRole("textbox", { name: "Spotify" }).fill("thia");
  await modal.getByRole("button", { name: "Save profile" }).click();
  await expect(modal.getByText("Spotify requires an open.spotify.com URL.")).toBeVisible();
  expect(savedPayload).toBeUndefined();

  await modal.getByRole("textbox", { name: "Spotify" }).fill(
    "https://open.spotify.com/artist/123",
  );
  await modal.getByRole("button", { name: "Add connection" }).click();
  await modal.getByRole("combobox", { name: "Platform" }).last().selectOption("twitch");
  await modal.getByRole("button", { name: "Save profile" }).click();
  await expect(modal.getByText("Twitch value is required.")).toBeVisible();
  expect(savedPayload).toBeUndefined();

  await modal.getByRole("textbox", { name: "Twitch" }).fill("thia");
  await modal.getByRole("button", { name: "Save profile" }).click();

  await expect.poll(() => savedPayload).toBeTruthy();
  expect(savedPayload?.links).toMatchObject([
    {
      platform: "website",
      value: "https://thia.lol/",
      url: "https://thia.lol/",
    },
    {
      platform: "spotify",
      value: "https://open.spotify.com/artist/123",
      url: "https://open.spotify.com/artist/123",
    },
    {
      platform: "twitch",
      value: "thia",
      url: "https://www.twitch.tv/thia",
    },
  ]);
});

test("mobile edit profile modal has no horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockOwnProfile(page, () => []);

  await acknowledgeCookieNotice(page);
  await page.goto("/@thia");
  await page.getByRole("button", { name: "Customize profile" }).click();

  const modal = page.getByTestId("profile-customization-modal");
  await expect(modal).toBeVisible();
  await modal.getByRole("button", { name: /Identity/ }).click();
  await expect(modal.getByRole("heading", { name: "Identity" })).toBeVisible();
  await modal.getByRole("button", { name: /Appearance/ }).click();
  await expect(modal.getByRole("heading", { name: "Appearance" })).toBeVisible();
  await modal.getByRole("button", { name: /Connections/ }).click();
  await expect(modal.getByRole("heading", { name: "Connections" })).toBeVisible();
  await modal.getByRole("button", { name: /Featured/ }).click();
  await expect(modal.getByTestId("profile-featured-editor")).toBeVisible();
  await modal.getByRole("button", { name: /Modules/ }).click();
  await expect(modal.getByTestId("profile-layout-editor")).toBeVisible();
  await expect(modal.getByRole("button", { name: /Preview/ })).toBeVisible();
  await modal.getByRole("button", { name: /Preview/ }).click();
  await expect(modal.getByTestId("profile-customization-preview-mobile")).toBeVisible();
  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(hasHorizontalOverflow).toBe(false);
});

test("profile customization cancel closes without saving identity edits", async ({ page }) => {
  let savedPayload: Record<string, unknown> | undefined;

  await mockOwnProfile(page, () => [], (payload) => {
    savedPayload = payload;
  });

  await acknowledgeCookieNotice(page);
  await page.goto("/@thia");
  await page.getByRole("button", { name: "Customize profile" }).click();
  const modal = page.getByTestId("profile-customization-modal");
  await modal.getByRole("textbox", { name: "Display name" }).fill("Unsaved Thia");
  await expect(modal.getByTestId("profile-customization-preview")).toContainText(
    "Unsaved Thia",
  );
  await modal.getByRole("button", { name: "Cancel" }).click();

  await expect(modal).toHaveCount(0);
  expect(savedPayload).toBeUndefined();
  await expect(page.getByTestId("profile-identity")).toContainText("Thia");
  await expect(page.getByTestId("profile-identity")).not.toContainText("Unsaved Thia");
});

test("profile banners stay behind identity in public header and preview", async ({ page }) => {
  await mockOwnProfile(page, () => [], undefined, {
    bannerUrl: "/uploads/media/2026/06/profile-test.webp",
    profileBackground: "/uploads/media/2026/06/profile-test.webp",
  });

  await acknowledgeCookieNotice(page);
  await page.goto("/@thia");

  await expect(page.getByTestId("profile-header-banner")).toBeVisible();
  await expect(page.getByTestId("profile-identity")).toContainText("Thia");
  await expect(page.getByTestId("profile-identity")).toContainText("@thia");
  await expectElementAtPointBelongsTo(
    page,
    page.getByTestId("profile-identity"),
    "profile-identity",
  );

  await page.getByRole("button", { name: "Customize profile" }).click();
  const modal = page.getByTestId("profile-customization-modal");
  const desktopPreview = modal.getByTestId("profile-customization-preview");
  await expect(desktopPreview.getByTestId("profile-preview-banner")).toBeVisible();
  await expect(desktopPreview.getByTestId("profile-preview-identity")).toContainText("Thia");
  await expect(desktopPreview.getByTestId("profile-preview-identity")).toContainText("@thia");
  await expectElementAtPointBelongsTo(
    page,
    desktopPreview.getByTestId("profile-preview-identity"),
    "profile-preview-identity",
  );
});

test("profile API keeps legacy link saves guarded by source inspection", async () => {
  const profileApi = readFileSync("api/profile.php", "utf8");

  expect(profileApi).toContain("function profile_connection_from_legacy_map");
  expect(profileApi).toContain("!array_key_exists('platform', $value)");
  expect(profileApi).toContain("profile_website_connection($trimmed)");
  expect(profileApi).toContain("Website URL must be a valid https URL.");
  expect(profileApi).toContain("profile_update_failed_on_missing_customization_column");
  expect(profileApi).toContain("Profile customization migration has not been applied.");
  expect(profileApi).toContain("profile_update_failed_on_invalid_json");
  expect(profileApi).toContain("Profile data could not be saved. Check profile links and try again.");
});

test("profile API accepts null optional fields by backend regression fixture", async () => {
  const output = execFileSync("php", ["tests/backend/profile-save-regression.php"], {
    encoding: "utf8",
  });

  expect(output).toContain("profile save regression ok");
});

test("profile followers and following use compact panels", async ({ page }) => {
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
  let dialog = page.getByRole("dialog", { name: "Followers" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("link", { name: "Alex's profile" })).toHaveAttribute(
    "href",
    "/@alex",
  );
  await page.getByRole("button", { name: "Close panel" }).click();

  await page.getByRole("button", { name: /Following/ }).click();
  dialog = page.getByRole("dialog", { name: "Following" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("link", { name: "Mira's profile" })).toHaveAttribute(
    "href",
    "/@mira",
  );
  await page.getByRole("button", { name: "Close panel" }).click();

  await expect(page.getByRole("button", { name: /Badges/ })).toHaveCount(0);
});

test("profile layout renders identity, essential social stats, activity module, and mobile stack", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockOwnProfile(page, () => [
    {
      platform: "github",
      label: "GitHub",
      value: "thiabun",
      url: "https://github.com/thiabun",
    },
  ]);

  await acknowledgeCookieNotice(page);
  await page.goto("/@thia");

  await expect(page.getByTestId("profile-header")).toBeVisible();
  await expect(page.getByTestId("profile-identity")).toContainText("Thia");
  await expect(page.getByTestId("profile-identity")).toContainText("@thia");
  await expect(page.getByText("Founder profile for thia.lol.")).toBeVisible();
  await expect(page.getByText("Oslo")).toBeVisible();
  await expect(page.getByText(/Joined/)).toBeVisible();
  await expect(page.getByRole("link", { name: /GitHub/ })).toBeVisible();
  await expect(page.getByText("Founder", { exact: true })).toBeVisible();

  const socialContext = page.getByTestId("profile-social-context");
  await expect(socialContext.getByText("Likes")).toBeVisible();
  await expect(socialContext.getByText("Followers")).toBeVisible();
  await expect(socialContext.getByText("Following")).toBeVisible();
  await expect(socialContext.getByText("Posts")).toHaveCount(0);
  await expect(socialContext.getByText("Replies")).toHaveCount(0);
  await expect(socialContext.getByText("Rooms")).toHaveCount(0);
  await expect(socialContext.getByText("Moots")).toHaveCount(0);
  await expect(socialContext.getByText("Badges")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /1 Followers/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /1 Following/ })).toBeVisible();
  await expect(page.getByText("1 Moots")).toHaveCount(0);

  await expect(page.getByTestId("profile-grid-module-activity")).toBeVisible();
  const tabs = page.getByTestId("profile-activity-tabs");
  await expect(tabs.getByRole("tab", { name: /Feed/ })).toBeVisible();
  await expect(tabs.getByRole("tab", { name: /Replies/ })).toBeVisible();
  await expect(tabs.getByRole("tab", { name: /Rooms/ })).toBeVisible();
  await expect(page.getByText("No posts.")).toBeVisible();

  await tabs.getByRole("tab", { name: /Replies/ }).click();
  await expect(page.getByText("No replies.")).toBeVisible();

  await tabs.getByRole("tab", { name: /Rooms/ }).click();
  await expect(page.getByText("No rooms.")).toBeVisible();

  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(hasHorizontalOverflow).toBe(false);
});

async function mockOwnProfile(
  page: Page,
  links: () => unknown[],
  onSave?: (payload: Record<string, unknown>) => void,
  profileOverrides: Partial<ReturnType<typeof profileBody>> = {},
) {
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
      body: JSON.stringify({ ok: true, data: profileBody(links(), profileOverrides) }),
    });
  });

  await page.route("**/api/profiles/thia", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, data: profileBody(links(), profileOverrides) }),
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

  await page.route("**/api/profiles/thia/modules", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, data: [activityModule()] }),
    });
  });

  await page.route("**/api/me/profile/modules", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, data: [activityModule()] }),
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

function profileBody(links: unknown[], overrides: Partial<ProfileBody> = {}): ProfileBody {
  const body: ProfileBody = {
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

  return {
    ...body,
    ...overrides,
    user: {
      ...body.user,
      ...(overrides.user ?? {}),
    },
  };
}

type ProfileBody = {
  user: {
    id: number;
    handle: string;
    displayName: string;
    initials: string;
    aura: string;
    avatarUrl: string | null;
  };
  bio: string;
  location: string;
  bannerUrl: string | null;
  profileAccent: string | null;
  profileBackground: string | null;
  profileTheme: string | null;
  links: unknown[];
  traits: unknown[];
  stats: {
    posts: number;
    replies: number;
    rooms: number;
    echoes: number;
    followers: number;
    following: number;
    moots: number;
  };
  followerCount: number;
  followingCount: number;
  mootCount: number;
  isFollowing: boolean;
  isFollowedBy: boolean;
  isMoot: boolean;
  createdAt: string;
  updatedAt: string;
};

function activityModule() {
  return {
    id: 9,
    type: "activity",
    title: "Activity",
    config: {},
    visibility: "public",
    position: 1,
    status: "active",
    schemaVersion: 1,
    createdAt: "2026-06-12 00:00:00",
    updatedAt: "2026-06-12 00:00:00",
  };
}

async function expectElementAtPointBelongsTo(
  page: Page,
  locator: Locator,
  testId: string,
) {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();

  const owner = await page.evaluate(
    ({ x, y }) => {
      const element = document.elementFromPoint(x, y);
      return element?.closest("[data-testid]")?.getAttribute("data-testid") ?? null;
    },
    {
      x: (box?.x ?? 0) + Math.min((box?.width ?? 0) - 4, 96),
      y: (box?.y ?? 0) + Math.min((box?.height ?? 0) - 4, 24),
    },
  );

  expect(owner).toBe(testId);
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
