import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

test("report modal opens with categories and legal links", async ({ page }) => {
  await mockAuthenticatedApi(page, "member");
  await mockHomeFeed(page);

  await page.goto("/");
  await page.getByRole("button", { name: "Report post" }).click();

  const reportDialog = page.getByRole("dialog", { name: "Report post" });
  await expect(reportDialog).toBeVisible();
  await expect(reportDialog.getByLabel("What's wrong?")).toBeVisible();
  await expect(
    reportDialog.getByRole("link", { name: "Community Guidelines" }),
  ).toHaveAttribute(
    "href",
    "/community-guidelines",
  );
  await expect(
    reportDialog.getByRole("link", { name: "Moderation Policy" }),
  ).toHaveAttribute(
    "href",
    "/moderation",
  );
  await expect(page.locator("article").first().getByRole("dialog")).toHaveCount(0);

  await reportDialog.getByLabel("What's wrong?").selectOption("copyright");
  await expect(
    reportDialog.getByRole("link", { name: "Copyright Policy" }),
  ).toHaveAttribute(
    "href",
    "/copyright",
  );

  await page.keyboard.press("Escape");
  await expect(reportDialog).toBeHidden();
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
  await page.getByRole("button", { name: "Report post" }).click();
  const reportDialog = page.getByRole("dialog", { name: "Report post" });
  await reportDialog.getByLabel("What's wrong?").selectOption("private_info");
  await reportDialog
    .getByLabel("Add details")
    .fill("This includes private information.");
  await reportDialog.getByRole("button", { name: "Report", exact: true }).click();

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

test("profile report submits the profile target", async ({ page }) => {
  await mockProfileReportApi(page);

  let reportPayload: Record<string, unknown> | undefined;
  await page.route("**/api/reports", async (route) => {
    reportPayload = route.request().postDataJSON() as Record<string, unknown>;
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: makeReport({
          targetType: "profile",
          targetId: 2,
          reportedUser: makeReport().reportedUser,
          post: null,
        }),
      }),
    });
  });

  await page.goto("/@alex");
  await page.getByRole("button", { name: "Report" }).click();
  const reportDialog = page.getByRole("dialog", { name: "Report profile" });

  await expect(reportDialog).toContainText("reports @alex's profile");
  await reportDialog.getByLabel("What's wrong?").selectOption("impersonation");
  await reportDialog.getByRole("button", { name: "Report", exact: true }).click();

  await expect(page.getByText("Report sent.")).toBeVisible();
  expect(reportPayload).toMatchObject({
    targetType: "profile",
    targetId: 2,
    reportedUserId: 2,
    category: "impersonation",
  });
});

test("room report submits the room target", async ({ page }) => {
  await mockRoomReportApi(page);

  let reportPayload: Record<string, unknown> | undefined;
  await page.route("**/api/reports", async (route) => {
    reportPayload = route.request().postDataJSON() as Record<string, unknown>;
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: makeReport({
          targetType: "room",
          targetId: 9,
          post: null,
          room: mockModerationRoom(),
        }),
      }),
    });
  });

  await page.goto("/rooms/general");
  await page.getByRole("button", { name: "Report" }).click();
  const reportDialog = page.getByRole("dialog", { name: "Report room" });

  await expect(reportDialog).toContainText("reports /general");
  await reportDialog.getByLabel("What's wrong?").selectOption("spam_or_scam");
  await reportDialog.getByRole("button", { name: "Report", exact: true }).click();

  await expect(page.getByText("Report sent.")).toBeVisible();
  expect(reportPayload).toMatchObject({
    targetType: "room",
    targetId: 9,
    reportedUserId: 3,
    category: "spam_or_scam",
  });
});

test("report submit requires auth", async ({ page }) => {
  await mockAnonymousApi(page);
  await mockHomeFeed(page);

  await page.goto("/");
  await page.getByRole("button", { name: "Report post" }).click();
  const reportDialog = page.getByRole("dialog", { name: "Report post" });
  await reportDialog.getByRole("button", { name: "Report", exact: true }).click();

  await expect(reportDialog.getByText("Log in to continue.")).toBeVisible();
});

test("admin report queue renders open reports first", async ({ page }) => {
  await mockAuthenticatedApi(page, "admin");
  await mockAdminApi(page);

  await page.goto("/admin");

  await expect(page.getByRole("heading", { name: "Report queue" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Reported post" })).toBeVisible();
  await expect(page.getByText("Private information", { exact: true })).toBeVisible();
  await expect(page.getByText("Target summary")).toBeVisible();
  await expect(page.getByRole("link", { name: "Viewer (@viewer)" })).toHaveAttribute(
    "href",
    "/@viewer",
  );
  await expect(page.getByRole("link", { name: "Alex (@alex)" }).first()).toHaveAttribute(
    "href",
    "/@alex",
  );
  await expect(page.getByRole("button", { name: "Mark reviewed" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Dismiss" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Hide post" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Remove post" })).toBeVisible();
});

test("admin report queue renders profile, room, and message summaries", async ({
  page,
}) => {
  await mockAuthenticatedApi(page, "admin");
  await mockAdminApi(page, [
    makeReport({
      id: 8,
      targetType: "profile",
      targetId: 2,
      post: null,
      profile: {
        id: 2,
        handle: "alex",
        displayName: "Alex",
        role: "member",
        status: "active",
      },
    }),
    makeReport({
      id: 9,
      targetType: "room",
      targetId: 9,
      post: null,
      room: mockModerationRoom(),
    }),
    makeReport({
      id: 10,
      targetType: "message",
      targetId: 100,
      post: null,
      message: {
        id: 100,
        conversationId: 10,
        body: "unsafe private message",
        deletedAt: null,
        createdAt: "2026-06-10 10:00:00",
        sender: {
          id: 2,
          handle: "alex",
          displayName: "Alex",
          role: "member",
          status: "active",
        },
      },
    }),
  ]);

  await page.goto("/admin");

  await expect(page.getByRole("heading", { name: "Reported profile" })).toBeVisible();
  await expect(page.getByText("Alex (@alex) · active")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Reported room" })).toBeVisible();
  await expect(page.getByText("/general · public · not live")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Reported message" })).toBeVisible();
  await expect(page.getByText("unsafe private message")).toBeVisible();
});

test("report API validates message membership by source inspection", async () => {
  const moderationApi = readFileSync("api/moderation.php", "utf8");
  const messageRecordStart = moderationApi.indexOf(
    "function moderation_message_record",
  );
  const messageRecordEnd = moderationApi.indexOf(
    "function moderation_report_actioned",
  );
  const messageRecord = moderationApi.slice(messageRecordStart, messageRecordEnd);

  expect(messageRecordStart).toBeGreaterThan(-1);
  expect(messageRecord).toContain("INNER JOIN conversation_members viewer_member");
  expect(messageRecord).toContain("viewer_member.conversation_id = m.conversation_id");
  expect(messageRecord).toContain("viewer_member.user_id = :viewer_user_id");
  expect(moderationApi).toContain(
    "moderation_message_record($targetId, (int) $session['user_id'])",
  );
  expect(moderationApi).toContain("if ($message === null)");
  expect(moderationApi).toContain("json_error('Message not found.', 404)");
});

test("moderation policy copy does not claim unavailable report targets", async ({
  page,
}) => {
  await mockAnonymousApi(page);
  await page.goto("/moderation");
  await expect(
    page.getByRole("heading", { name: "Moderation Policy", level: 1 }),
  ).toBeVisible();
  const bodyText = await page.locator("body").innerText();

  expect(bodyText).toContain(
    "Logged-in users can report posts, replies, profiles, rooms, and chat messages",
  );
  expect(bodyText).not.toContain(
    "Built-in profile, room, and message reports are not fully available yet.",
  );
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

async function mockProfileReportApi(page: Page) {
  await mockAuthenticatedApi(page, "member");
  await page.route("**/api/profiles/alex", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ ok: true, data: profileBody() }),
    }),
  );
  await page.route("**/api/profiles/alex/badges", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ ok: true, data: { badges: [], featuredBadges: [] } }),
    }),
  );
  for (const suffix of ["posts", "replies", "reblogs", "rooms"]) {
    await page.route(`**/api/profiles/alex/${suffix}`, (route) =>
      route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ ok: true, data: [] }),
      }),
    );
  }
}

async function mockRoomReportApi(page: Page) {
  await mockAuthenticatedApi(page, "member");
  await page.route("**/api/rooms/general/posts", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ ok: true, data: [] }),
    }),
  );
  await page.route("**/api/rooms/general/members", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ ok: true, data: [] }),
    }),
  );
  await page.route("**/api/rooms/general", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ ok: true, data: roomBody() }),
    }),
  );
}

async function mockAdminApi(page: Page, reports = [makeReport()]) {
  await page.route("**/api/admin/reports", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: reports,
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

function profileBody() {
  return {
    user: {
      id: 2,
      handle: "alex",
      displayName: "Alex",
      initials: "A",
      aura: "frost",
      avatarUrl: null,
    },
    bio: "Public profile.",
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
  };
}

function roomBody() {
  return {
    id: 9,
    slug: "general",
    name: "General",
    summary: "General room.",
    description: "General room.",
    mood: "",
    members: 2,
    memberCount: 2,
    live: false,
    accent: "var(--accent-sun)",
    iconUrl: null,
    bannerUrl: null,
    rules: "",
    visibility: "public",
    createdBy: 3,
    owner: {
      id: 3,
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
    createdAt: "2026-06-10 09:00:00",
    updatedAt: "2026-06-10 09:00:00",
  };
}

function mockModerationRoom() {
  return {
    id: 9,
    slug: "general",
    name: "General",
    summary: "General room.",
    visibility: "public",
    live: false,
    owner: {
      id: 3,
      handle: "owner",
      displayName: "Owner",
      role: "member",
      status: "active",
    },
  };
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
