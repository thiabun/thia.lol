import { expect, test, type Page } from "@playwright/test";

test("report modal opens with categories and legal links", async ({ page }) => {
  await mockAuthenticatedApi(page, "member");
  await mockHomeFeed(page);

  await page.goto("/");
  await page.getByRole("button", { name: "Report" }).click();

  await expect(page.getByRole("heading", { name: "Report post" })).toBeVisible();
  await expect(page.getByLabel("What's wrong?")).toBeVisible();
  await expect(page.getByRole("link", { name: "Community Guidelines" })).toHaveAttribute(
    "href",
    "/community-guidelines",
  );
  await expect(page.getByRole("link", { name: "Moderation Policy" })).toHaveAttribute(
    "href",
    "/moderation",
  );

  await page.getByLabel("What's wrong?").selectOption("copyright");
  await expect(page.getByRole("link", { name: "Copyright Policy" })).toHaveAttribute(
    "href",
    "/copyright",
  );
});

test("report category selector submits a post report", async ({ page }) => {
  await mockAuthenticatedApi(page, "member");
  await mockHomeFeed(page);

  let reportPayload: Record<string, unknown> | undefined;
  await page.route("**/api/reports", async (route) => {
    reportPayload = route.request().postDataJSON() as Record<string, unknown>;
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: makeReport({ category: reportPayload.category }),
      }),
    });
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Report" }).click();
  const reportForm = page.getByRole("heading", { name: "Report post" }).locator("..");
  await page.getByLabel("What's wrong?").selectOption("private_info");
  await page.getByLabel("Add details").fill("This includes private information.");
  await reportForm.getByRole("button", { name: "Report", exact: true }).click();

  await expect(page.getByText("Report sent.")).toBeVisible();
  expect(reportPayload).toMatchObject({
    targetType: "post",
    targetId: 42,
    postId: 42,
    reportedUserId: 2,
    category: "private_info",
    details: "This includes private information.",
  });
});

test("report submit requires auth", async ({ page }) => {
  await mockAnonymousApi(page);
  await mockHomeFeed(page);

  await page.goto("/");
  await page.getByRole("button", { name: "Report" }).click();
  const reportForm = page.getByRole("heading", { name: "Report post" }).locator("..");
  await reportForm.getByRole("button", { name: "Report", exact: true }).click();

  await expect(page.getByText("Log in to continue.")).toBeVisible();
});

test("admin report queue renders open reports first", async ({ page }) => {
  await mockAuthenticatedApi(page, "admin");
  await mockAdminApi(page);

  await page.goto("/admin");

  await expect(page.getByRole("heading", { name: "Report queue" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Reported post" })).toBeVisible();
  await expect(page.getByText("Private information", { exact: true })).toBeVisible();
  await expect(page.getByText("Target summary")).toBeVisible();
  await expect(page.getByRole("button", { name: "Mark reviewed" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Dismiss" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Hide post" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Remove post" })).toBeVisible();
});

test("admin actions are gated", async ({ page }) => {
  await mockAuthenticatedApi(page, "member");

  await page.goto("/admin");

  await expect(
    page.getByRole("heading", { name: "Moderator access required" }),
  ).toBeVisible();
});

async function mockAnonymousApi(page: Page) {
  await page.route("**/api/auth/me", (route) =>
    route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({ ok: false, error: "Not authenticated." }),
    }),
  );
  await mockShellApi(page);
}

async function mockAuthenticatedApi(page: Page, role: "admin" | "member") {
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
            role,
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
  await mockShellApi(page);
}

async function mockShellApi(page: Page) {
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

async function mockHomeFeed(page: Page) {
  await page.route("**/api/feed/home", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: {
          posts: [makePost()],
          personalized: true,
        },
      }),
    }),
  );
}

async function mockAdminApi(page: Page) {
  await page.route("**/api/admin/reports", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: [makeReport()],
      }),
    }),
  );
  await page.route("**/api/admin/rooms", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ ok: true, data: [] }),
    }),
  );
  await page.route("**/api/admin/badges", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ ok: true, data: { badges: [], recentGrants: [] } }),
    }),
  );
}

function makeReport(overrides: Record<string, unknown> = {}) {
  return {
    id: 7,
    targetType: "post",
    targetId: 42,
    category: "private_info",
    reason: "private_info",
    details: "This includes private information.",
    status: "open",
    createdAt: "2026-06-10 10:00:00",
    updatedAt: "2026-06-10 10:00:00",
    reviewedAt: null,
    actionTaken: null,
    moderatorNote: null,
    reporter: {
      id: 1,
      handle: "viewer",
      displayName: "Viewer",
      role: "member",
      status: "active",
    },
    reportedUser: {
      id: 2,
      handle: "alex",
      displayName: "Alex",
      role: "member",
      status: "active",
    },
    reviewedBy: null,
    post: {
      id: 42,
      body: "A public post.",
      status: "published",
      visibility: "public",
      createdAt: "2026-06-10 10:00:00",
      author: {
        id: 2,
        handle: "alex",
        displayName: "Alex",
        role: "member",
        status: "active",
      },
    },
    actionCount: 0,
    ...overrides,
  };
}

function makePost() {
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
  };
}
