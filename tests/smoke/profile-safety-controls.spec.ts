import { expect, type Page, test } from "@playwright/test";

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

test("profile safety actions block, unblock, mute, and unmute another profile", async ({
  page,
}) => {
  const calls: string[] = [];

  await mockProfileSafetyPage(page, {
    viewerHandle: "viewer",
    profile: profileBody({
      handle: "alex",
      id: 2,
      isFollowing: true,
      isFollowedBy: true,
      isMoot: true,
      followerCount: 3,
      followingCount: 4,
      mootCount: 2,
    }),
    onBlock: async (method) => {
      calls.push(`${method} /api/profiles/alex/block`);

      return method === "POST"
        ? relationshipBody({
            isFollowing: false,
            isFollowedBy: false,
            isMoot: false,
            isBlocked: true,
            followerCount: 2,
            followingCount: 3,
            mootCount: 1,
          })
        : relationshipBody({
            isFollowing: false,
            isFollowedBy: false,
            isMoot: false,
            isBlocked: false,
            followerCount: 2,
            followingCount: 3,
            mootCount: 1,
          });
    },
    onMute: async (method) => {
      calls.push(`${method} /api/profiles/alex/mute`);

      return method === "POST"
        ? relationshipBody({
            isFollowing: true,
            isFollowedBy: true,
            isMoot: true,
            isMuted: true,
            followerCount: 3,
            followingCount: 4,
            mootCount: 2,
          })
        : relationshipBody({
            isFollowing: true,
            isFollowedBy: true,
            isMoot: true,
            isMuted: false,
            followerCount: 3,
            followingCount: 4,
            mootCount: 2,
          });
    },
  });

  await acknowledgeCookieNotice(page);
  await page.goto("/@alex");

  await expect(page.getByTestId("profile-header")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Alex" })).toBeVisible();
  await expect(page.getByText("@alex")).toBeVisible();
  await expect(page.getByRole("button", { name: "3 Followers" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Report" })).toBeVisible();
  await expect(page.getByTestId("profile-message-button")).toBeVisible();
  await expect(page.getByTestId("profile-follow-button")).toBeVisible();
  await expect(page.getByRole("button", { name: "Mute" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Block" })).toBeVisible();

  await page.getByRole("button", { name: "Mute" }).click();
  await expect(page.getByText(/Muted @alex/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Unmute" })).toBeVisible();

  await page.getByRole("button", { name: "Unmute" }).click();
  await expect(page.getByText("Unmuted @alex.")).toBeVisible();

  await page.getByRole("button", { name: "Block" }).click();
  await expect(page.getByText("Blocked @alex.")).toBeVisible();
  await expect(page.getByTestId("profile-message-button")).toHaveCount(0);
  await expect(page.getByTestId("profile-follow-button")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Report" })).toBeVisible();

  await page.getByRole("button", { name: "Unblock" }).click();
  await expect(page.getByText("Unblocked @alex.")).toBeVisible();

  expect(calls).toEqual([
    "POST /api/profiles/alex/mute",
    "DELETE /api/profiles/alex/mute",
    "POST /api/profiles/alex/block",
    "DELETE /api/profiles/alex/block",
  ]);
});

test("profile safety actions are not shown on your own profile", async ({ page }) => {
  await mockProfileSafetyPage(page, {
    viewerHandle: "thia",
    profile: profileBody({ handle: "thia", id: 1 }),
  });

  await acknowledgeCookieNotice(page);
  await page.goto("/@thia");

  await expect(page.getByRole("button", { name: "Customize profile" })).toHaveCount(0);
  await expect(page.getByTestId("profile-actions-button")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Block/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Mute/ })).toHaveCount(0);
});

test("remove follower is available only on own followers panel", async ({ page }) => {
  const calls: string[] = [];

  await mockProfileSafetyPage(page, {
    viewerHandle: "thia",
    profile: profileBody({
      handle: "thia",
      id: 1,
      followerCount: 1,
      followingCount: 1,
      mootCount: 1,
    }),
    followers: [
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
    onRemoveFollower: async (handle) => {
      calls.push(`DELETE /api/profiles/${handle}/follower`);

      return {
        removedFollower: true,
        relationship: relationshipBody({
          isFollowing: true,
          isFollowedBy: false,
          isMoot: false,
          followerCount: 3,
          followingCount: 1,
          mootCount: 0,
        }),
      };
    },
  });

  await acknowledgeCookieNotice(page);
  await page.goto("/@thia");

  await page.getByRole("button", { name: /Followers/ }).click();
  const dialog = page.getByRole("dialog", { name: "Followers" });
  await expect(dialog.getByRole("link", { name: "Alex's profile" })).toBeVisible();
  await dialog.getByRole("button", { name: "Remove follower" }).click();
  await expect(dialog).toContainText("They can follow you again unless you block them.");
  await dialog
    .getByRole("button", { name: "Remove follower" })
    .last()
    .click();

  await expect(dialog.getByRole("link", { name: "Alex's profile" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /0 Followers/ })).toBeVisible();
  expect(calls).toEqual(["DELETE /api/profiles/alex/follower"]);
});

test("remove follower is not shown on another profile followers panel", async ({
  page,
}) => {
  await mockProfileSafetyPage(page, {
    viewerHandle: "viewer",
    profile: profileBody({
      handle: "alex",
      id: 2,
      followerCount: 1,
    }),
    followers: [
      {
        handle: "mira",
        displayName: "Mira",
        initials: "M",
        avatarUrl: null,
        bioSnippet: "",
        isFollowing: false,
        isMoot: false,
      },
    ],
  });

  await acknowledgeCookieNotice(page);
  await page.goto("/@alex");
  await page.getByRole("button", { name: /Followers/ }).click();

  const dialog = page.getByRole("dialog", { name: "Followers" });
  await expect(dialog.getByRole("link", { name: "Mira's profile" })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Remove follower" })).toHaveCount(0);
});

async function mockProfileSafetyPage(
  page: Page,
  options: {
    viewerHandle: string;
    profile: ReturnType<typeof profileBody>;
    followers?: unknown[];
    onBlock?: (method: "POST" | "DELETE") => Promise<ReturnType<typeof relationshipBody>>;
    onMute?: (method: "POST" | "DELETE") => Promise<ReturnType<typeof relationshipBody>>;
    onRemoveFollower?: (handle: string) => Promise<{
      removedFollower: boolean;
      relationship: ReturnType<typeof relationshipBody>;
    }>;
  },
) {
  const viewerId = options.viewerHandle === options.profile.user.handle ? options.profile.user.id : 1;

  await page.route("**/api/auth/me", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: {
          user: {
            id: viewerId,
            handle: options.viewerHandle,
            email: `${options.viewerHandle}@example.test`,
            role: "member",
            status: "active",
            displayName: titleCase(options.viewerHandle),
            avatarUrl: null,
          },
          profile: {
            displayName: titleCase(options.viewerHandle),
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

  await page.route(`**/api/profiles/${options.profile.user.handle}`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, data: options.profile }),
    });
  });

  await page.route(`**/api/profiles/${options.profile.user.handle}/block`, async (route) => {
    const method = route.request().method() as "POST" | "DELETE";
    const relationship = options.onBlock
      ? await options.onBlock(method)
      : relationshipBody({ isBlocked: method === "POST" });

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: {
          isBlocked: relationship.isBlocked,
          isMuted: relationship.isMuted,
          relationship,
        },
      }),
    });
  });

  await page.route(`**/api/profiles/${options.profile.user.handle}/mute`, async (route) => {
    const method = route.request().method() as "POST" | "DELETE";
    const relationship = options.onMute
      ? await options.onMute(method)
      : relationshipBody({ isMuted: method === "POST" });

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: {
          isBlocked: relationship.isBlocked,
          isMuted: relationship.isMuted,
          relationship,
        },
      }),
    });
  });

  await page.route("**/api/profiles/*/follower", async (route) => {
    const url = new URL(route.request().url());
    const handle = url.pathname.split("/").at(-2) ?? "";
    const result = options.onRemoveFollower
      ? await options.onRemoveFollower(handle)
      : { removedFollower: false, relationship: relationshipBody() };

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, data: result }),
    });
  });

  await page.route(`**/api/profiles/${options.profile.user.handle}/followers`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, data: options.followers ?? [] }),
    });
  });

  await page.route(`**/api/profiles/${options.profile.user.handle}/following`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, data: [] }),
    });
  });

  await page.route(`**/api/profiles/${options.profile.user.handle}/badges`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, data: { badges: [], featuredBadges: [] } }),
    });
  });

  for (const suffix of ["posts", "replies", "reblogs", "rooms", "modules"]) {
    await page.route(`**/api/profiles/${options.profile.user.handle}/${suffix}`, async (route) => {
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

function profileBody(overrides: Partial<{
  handle: string;
  id: number;
  isFollowing: boolean;
  isFollowedBy: boolean;
  isMoot: boolean;
  isBlocked: boolean;
  isMuted: boolean;
  followerCount: number;
  followingCount: number;
  mootCount: number;
}> = {}) {
  const handle = overrides.handle ?? "alex";
  const displayName = titleCase(handle);
  const followerCount = overrides.followerCount ?? 0;
  const followingCount = overrides.followingCount ?? 0;
  const mootCount = overrides.mootCount ?? 0;

  return {
    user: {
      id: overrides.id ?? 2,
      handle,
      displayName,
      initials: displayName.slice(0, 1),
      aura: "frost",
      avatarUrl: null,
    },
    bio: "Public profile.",
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
      followers: followerCount,
      following: followingCount,
      moots: mootCount,
    },
    followerCount,
    followingCount,
    mootCount,
    isFollowing: overrides.isFollowing ?? false,
    isFollowedBy: overrides.isFollowedBy ?? false,
    isMoot: overrides.isMoot ?? false,
    isBlocked: overrides.isBlocked ?? false,
    isMuted: overrides.isMuted ?? false,
    createdAt: "2026-06-10 09:00:00",
    updatedAt: "2026-06-10 09:00:00",
  };
}

function relationshipBody(overrides: Partial<{
  isFollowing: boolean;
  isFollowedBy: boolean;
  isMoot: boolean;
  isBlocked: boolean;
  isMuted: boolean;
  followerCount: number;
  followingCount: number;
  mootCount: number;
}> = {}) {
  return {
    isFollowing: overrides.isFollowing ?? false,
    isFollowedBy: overrides.isFollowedBy ?? false,
    isMoot: overrides.isMoot ?? false,
    isBlocked: overrides.isBlocked ?? false,
    isMuted: overrides.isMuted ?? false,
    followerCount: overrides.followerCount ?? 0,
    followingCount: overrides.followingCount ?? 0,
    mootCount: overrides.mootCount ?? 0,
  };
}

function titleCase(value: string): string {
  return value.slice(0, 1).toUpperCase() + value.slice(1);
}
