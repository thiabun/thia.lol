import { expect, test, type Page } from "@playwright/test";
import { fetchAuthMe, loginWithEnv, skipWithoutCredentials } from "../helpers/auth";

test("/rooms renders API rooms or the real empty state", async ({ page }) => {
  await mockRoomCards(page);
  await page.goto("/rooms");

  await expect(page.getByTestId("rooms-page")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1, name: "Rooms", exact: true })).toBeVisible();

  await expect
    .poll(async () => {
      const roomCards = await page.getByTestId("room-card").count();
      const emptyStates = await page.getByText("No public rooms yet").count();

      return roomCards > 0 || emptyStates > 0;
    }, { message: "Rooms should render from the API or show the empty state" })
    .toBe(true);
});

test("clicking a room opens its detail page", async ({ page }) => {
  await mockRoomCards(page);
  await page.goto("/rooms");

  await expect
    .poll(async () => {
      const roomCards = await page.getByTestId("room-card").count();
      const emptyStates = await page.getByText("No public rooms yet").count();

      return roomCards > 0 || emptyStates > 0;
    }, { message: "Rooms should finish loading" })
    .toBe(true);

  const firstRoom = page.getByTestId("room-card").first();

  test.skip((await firstRoom.count()) === 0, "No rooms are available to open.");

  const link = firstRoom.getByRole("link").first();
  const href = await link.getAttribute("href");

  expect(href).toMatch(/^\/rooms\/[a-z0-9-]+$/);

  await link.click();
  await expect(page).toHaveURL(new RegExp(`${href!.replace("/", "\\/")}$`));
  await expect(page.getByTestId("room-page")).toBeVisible();
});

test("room cards keep room navigation and owner profile navigation separate", async ({
  page,
}) => {
  await mockRoomCards(page);

  await page.goto("/rooms");

  const firstRoom = page.getByTestId("room-card").first();
  await expect(
    firstRoom.getByRole("link", { name: "Open Sun Room" }).first(),
  ).toHaveAttribute("href", "/rooms/sun-room");
  await expect(firstRoom.getByRole("link", { name: "@owner" })).toHaveAttribute(
    "href",
    "/@owner",
  );
});

test("room page Post button opens composer with room preselected", async ({ page }) => {
  skipWithoutCredentials();

  await loginWithEnv(page);
  await page.goto("/rooms");

  await expect
    .poll(async () => {
      const roomCards = await page.getByTestId("room-card").count();
      const emptyStates = await page.getByText("No public rooms yet").count();

      return roomCards > 0 || emptyStates > 0;
    }, { message: "Rooms should finish loading" })
    .toBe(true);

  const firstRoom = page.getByTestId("room-card").first();

  test.skip((await firstRoom.count()) === 0, "No rooms are available for posting.");

  const link = firstRoom.getByRole("link").first();
  const href = await link.getAttribute("href");
  const slug = href?.split("/").pop();

  expect(slug).toBeTruthy();

  await link.click();
  await page.getByTestId("room-post-button").click();

  const dialog = page.getByTestId("composer-modal");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByTestId("composer-room-selector")).toHaveValue(slug!);
});

test("Create room button shows for logged-in users", async ({ page }) => {
  skipWithoutCredentials();

  await loginWithEnv(page);
  await page.goto("/rooms");

  await expect(page.getByTestId("rooms-page")).toBeVisible();
  await expect(page.getByTestId("create-room-button")).toBeVisible();

  await page.getByTestId("create-room-button").click();
  const modal = page.getByTestId("room-edit-modal");

  await expect(modal).toBeVisible();
  await expect(modal.getByLabel("Name")).toBeVisible();
  await expect(modal.getByLabel("Slug")).toBeVisible();
  await expect(modal.getByLabel("Summary")).toBeVisible();
  await expect(modal.getByTestId("room-theme-trigger")).toBeVisible();
  await expect(modal.getByLabel("Accent")).toHaveCount(0);
  await expect(modal.getByLabel("Room rules")).toBeVisible();
  await expect(modal.locator("label", { hasText: "Change icon" })).toBeVisible();
  await expect(modal.locator("label", { hasText: "Change banner" })).toBeVisible();
});

test("creating rooms can submit each visibility mode", async ({ page }) => {
  const createdPayloads: Record<string, unknown>[] = [];

  await mockRoomCreation(page, createdPayloads);
  await acknowledgeCookieNotice(page);

  for (const [index, mode] of [
    ["Public", "public"],
    ["Private", "private"],
    ["Invite", "invite"],
    ["View-only", "view_only"],
  ].entries()) {
    await page.goto("/rooms");
    await page.getByTestId("create-room-button").click();

    const modal = page.getByTestId("room-edit-modal");
    await modal.getByLabel("Name").fill(`${mode[0]} room`);
    await modal.getByLabel("Slug").fill(`${mode[1].replace("_", "-")}-room`);
    await modal.getByLabel("Summary").fill(`A ${mode[0].toLowerCase()} room for smoke testing.`);
    await modal.locator(`label:has(input[name="room-visibility"][value="${mode[1]}"])`).click();
    await modal.getByRole("button", { name: "Create room" }).click();

    await expect.poll(() => createdPayloads.length).toBe(index + 1);
    expect(createdPayloads[index]).toMatchObject({ visibility: mode[1] });
  }
});

test("invite room access requests can be requested and canceled", async ({ page }) => {
  const actions = await mockInviteRequestRoom(page);

  await acknowledgeCookieNotice(page);
  await page.goto("/rooms/invite-room");

  await expect(page.getByTestId("room-page")).toBeVisible();
  await expect(page.getByText("Access required")).toBeVisible();
  await expect(page.getByTestId("room-request-access-button")).toContainText("Request access");

  await page.getByTestId("room-request-access-button").click();
  await expect.poll(() => actions.requested()).toBe(1);
  await expect(page.getByTestId("room-request-access-button")).toContainText("Access requested");

  await page.getByTestId("room-request-access-button").click();
  await expect.poll(() => actions.canceled()).toBe(1);
  await expect(page.getByTestId("room-request-access-button")).toContainText("Request access");
});

test("room staff can approve and deny invite access requests", async ({ page }) => {
  const actions = await mockStaffInviteRoom(page);

  await acknowledgeCookieNotice(page);
  await page.goto("/rooms/invite-room");

  const panel = page.getByTestId("room-access-requests");
  await expect(panel).toBeVisible();
  await expect(panel).toContainText("Asha");
  await expect(panel).toContainText("Ben");

  await panel.getByRole("button", { name: "Deny" }).first().click();
  await expect.poll(() => actions.denied()).toEqual([101]);
  await expect(panel).not.toContainText("Asha");

  await panel.getByRole("button", { name: "Approve" }).first().click();
  await expect.poll(() => actions.approved()).toEqual([102]);
  await expect(page.getByTestId("room-access-requests")).toHaveCount(0);
});

test("view-only rooms hide posting but keep reaction affordances", async ({ page }) => {
  await mockViewOnlyRoom(page);
  await acknowledgeCookieNotice(page);

  await page.goto("/rooms/read-room");

  await expect(page.getByTestId("room-page")).toBeVisible();
  await expect(page.getByTestId("room-header").getByText("View-only")).toBeVisible();
  await expect(page.getByTestId("room-post-button")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Like this post/i })).toBeVisible();

  await page.getByRole("button", { name: /Open replies/i }).click();
  await expect(page.getByTestId("thread-conversation")).toBeVisible();
  await expect(page.getByTestId("reply-composer")).toHaveCount(0);
});

test("room themes recolor active post reactions against the saved site theme", async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("thia.lol.theme", "frostveil");
  });
  await mockViewOnlyRoom(page, {
    post: {
      likedByCurrentUser: true,
      likeCount: 1,
      rebloggedByMe: true,
      reblogCount: 1,
    },
  });
  await acknowledgeCookieNotice(page);

  await page.goto("/rooms/read-room");

  await expect
    .poll(() =>
      page.evaluate(() => ({
        leafInk: document.documentElement.style
          .getPropertyValue("--accent-leaf-ink")
          .trim(),
        roseInk: document.documentElement.style
          .getPropertyValue("--accent-rose-ink")
          .trim(),
      })),
    )
    .toEqual({
      leafInk: "#A56B18",
      roseInk: "#A56B18",
    });
  await expect(page.getByRole("button", { name: /Unlike this post/i })).toHaveCSS(
    "color",
    "rgb(165, 107, 24)",
  );
  await expect(page.getByRole("button", { name: /Undo reblog/i })).toHaveCSS(
    "color",
    "rgb(165, 107, 24)",
  );
});

test("rooms footer keeps legal links without the footer brand lockup", async ({ page }) => {
  await mockRoomCards(page);
  await page.goto("/rooms");

  await expect(page.getByTestId("site-footer")).toBeVisible();
  await expect(page.getByTestId("site-footer-brand-lockup")).toHaveCount(0);
  await expect(page.getByTestId("site-footer-brand")).toHaveCount(0);
  await expect(page.getByTestId("legal-footer-links").getByRole("link", { name: "Terms" })).toBeVisible();
});

test("join and leave room API require auth", async ({ page }) => {
  await page.goto("/rooms");

  const slug = await firstApiRoomSlug(page);

  test.skip(!slug, "No rooms are available for join API checks.");

  const joinResult = await page.evaluate(async (roomSlug) => {
    const response = await fetch(`/api/rooms/${roomSlug}/join`, {
      method: "POST",
      credentials: "include",
      headers: { Accept: "application/json" },
    });

    return {
      status: response.status,
      body: await response.json().catch(() => null),
    };
  }, slug!);

  expect(joinResult.status).toBe(401);

  const leaveResult = await page.evaluate(async (roomSlug) => {
    const response = await fetch(`/api/rooms/${roomSlug}/join`, {
      method: "DELETE",
      credentials: "include",
      headers: { Accept: "application/json" },
    });

    return {
      status: response.status,
      body: await response.json().catch(() => null),
    };
  }, slug!);

  expect(leaveResult.status).toBe(401);
});

test("room page shows join and edit states based on auth and role", async ({ page }) => {
  skipWithoutCredentials();

  await loginWithEnv(page);
  await page.goto("/rooms");

  const slug = await firstRoomSlug(page);

  test.skip(!slug, "No rooms are available for room state checks.");

  await page.goto(`/rooms/${slug}`);
  await expect(page.getByTestId("room-page")).toBeVisible();
  await expect(page.getByTestId("room-join-button")).toBeVisible();

  const auth = await fetchAuthMe(page);
  const room = await page.evaluate(async (roomSlug) => {
    const response = await fetch(`/api/rooms/${roomSlug}`, {
      credentials: "include",
      headers: { Accept: "application/json" },
    });
    const body = await response.json();

    return body.data;
  }, slug!);
  const canEdit =
    auth.data?.user?.role === "admin" ||
    room?.myRoomRole === "owner" ||
    room?.myRoomRole === "moderator";

  await expect(page.getByTestId("edit-room-button")).toHaveCount(canEdit ? 1 : 0);
});

test("rooms do not render retired room copy", async ({ page }) => {
  await page.goto("/rooms");

  await expect(page.getByText("A good room has affordances")).toHaveCount(0);
  await expect(page.getByText("mock", { exact: false })).toHaveCount(0);
  await expect(page.getByText("demo", { exact: false })).toHaveCount(0);
});

async function mockRoomCards(page: Page) {
  await page.route("**/api/auth/me", async (route) => {
    await route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({ ok: false, error: "Unauthenticated." }),
    });
  });
  await page.route(/\/api\/rooms$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, data: [mockRoom()] }),
    });
  });
  await page.route("**/api/stats", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: {
          publicRooms: 1,
          publicPosts: 0,
          activeUsers: 1,
          totalReactions: 0,
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
  await page.route("**/api/rooms/sun-room", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, data: mockRoom() }),
    });
  });
  await page.route("**/api/rooms/sun-room/posts", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, data: [] }),
    });
  });
  await page.route("**/api/rooms/sun-room/members", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, data: [] }),
    });
  });
}

async function mockRoomCreation(page: Page, createdPayloads: Record<string, unknown>[]) {
  let createdRoom = mockRoom({ joinedByMe: true, myRoomRole: "owner", viewerCanPost: true });

  await mockAuthenticatedShell(page);
  await mockStats(page);
  await page.route(/\/api\/rooms$/, async (route) => {
    if (route.request().method() === "POST") {
      const payload = (await route.request().postDataJSON()) as Record<string, unknown>;
      createdPayloads.push(payload);
      createdRoom = mockRoom({
        slug: String(payload.slug ?? "created-room"),
        name: String(payload.name ?? "Created room"),
        summary: String(payload.summary ?? ""),
        description: String(payload.summary ?? ""),
        visibility: String(payload.visibility ?? "public"),
        joinedByMe: true,
        myRoomRole: "owner",
        viewerCanViewPosts: true,
        viewerCanPost: true,
        viewerCanReact: true,
        viewerCanRequestAccess: false,
        accessRequestStatus: null,
      });
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, data: createdRoom }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, data: [] }),
    });
  });
  await page.route(/\/api\/rooms\/[^/]+$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, data: createdRoom }),
    });
  });
  await page.route(/\/api\/rooms\/[^/]+\/posts$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, data: [] }),
    });
  });
  await page.route(/\/api\/rooms\/[^/]+\/members$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, data: [] }),
    });
  });
}

async function mockInviteRequestRoom(page: Page) {
  let accessRequestStatus: "pending" | null = null;
  let requested = 0;
  let canceled = 0;
  const room = () =>
    mockRoom({
      slug: "invite-room",
      name: "Invite Room",
      summary: "Requestable shell.",
      description: "Requestable shell.",
      visibility: "invite",
      members: 0,
      memberCount: 0,
      postCount: 0,
      viewerCanViewPosts: false,
      viewerCanPost: false,
      viewerCanReact: false,
      viewerCanRequestAccess: accessRequestStatus !== "pending",
      accessRequestStatus,
    });

  await mockAuthenticatedShell(page);
  await page.route("**/api/rooms/invite-room", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, data: room() }),
    });
  });
  await page.route("**/api/rooms/invite-room/posts", async (route) => {
    await route.fulfill({
      status: 404,
      contentType: "application/json",
      body: JSON.stringify({ ok: false, error: "Room not found." }),
    });
  });
  await page.route("**/api/rooms/invite-room/members", async (route) => {
    await route.fulfill({
      status: 404,
      contentType: "application/json",
      body: JSON.stringify({ ok: false, error: "Room not found." }),
    });
  });
  await page.route("**/api/rooms/invite-room/access-requests", async (route) => {
    if (route.request().method() === "POST") {
      requested += 1;
      accessRequestStatus = "pending";
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, data: room() }),
    });
  });
  await page.route("**/api/rooms/invite-room/access-requests/me", async (route) => {
    if (route.request().method() === "DELETE") {
      canceled += 1;
      accessRequestStatus = null;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, data: room() }),
    });
  });

  return {
    requested: () => requested,
    canceled: () => canceled,
  };
}

async function mockStaffInviteRoom(page: Page) {
  let requests = [roomAccessRequest(101, "asha", "Asha"), roomAccessRequest(102, "ben", "Ben")];
  const deniedIds: number[] = [];
  const approvedIds: number[] = [];
  const room = () =>
    mockRoom({
      slug: "invite-room",
      name: "Invite Room",
      visibility: "invite",
      joinedByMe: true,
      myRoomRole: "moderator",
      viewerCanViewPosts: true,
      viewerCanPost: true,
      viewerCanReact: true,
      viewerCanRequestAccess: false,
      accessRequestStatus: null,
      pendingAccessRequestCount: requests.length,
    });

  await mockAuthenticatedShell(page);
  await page.route("**/api/rooms/invite-room", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, data: room() }),
    });
  });
  await page.route("**/api/rooms/invite-room/posts", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, data: [] }),
    });
  });
  await page.route("**/api/rooms/invite-room/members", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, data: [] }),
    });
  });
  await page.route(/\/api\/rooms\/invite-room\/access-requests(?:\/(\d+)\/(approve|deny))?$/, async (route) => {
    const match = route.request().url().match(/\/access-requests(?:\/(\d+)\/(approve|deny))?$/);
    const requestId = match?.[1] ? Number(match[1]) : undefined;
    const action = match?.[2];

    if (route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, data: requests }),
      });
      return;
    }

    if (requestId && action === "deny") {
      deniedIds.push(requestId);
      requests = requests.filter((request) => request.id !== requestId);
    }

    if (requestId && action === "approve") {
      approvedIds.push(requestId);
      requests = requests.filter((request) => request.id !== requestId);
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, data: requests }),
    });
  });

  return {
    approved: () => approvedIds,
    denied: () => deniedIds,
  };
}

async function mockViewOnlyRoom(
  page: Page,
  options: {
    post?: Record<string, unknown>;
    room?: Record<string, unknown>;
  } = {},
) {
  const room = mockRoom({
    slug: "read-room",
    name: "Read Room",
    summary: "Read-only community room.",
    description: "Read-only community room.",
    visibility: "view_only",
    viewerCanViewPosts: true,
    viewerCanPost: false,
    viewerCanReact: true,
    viewerCanRequestAccess: false,
    accessRequestStatus: null,
    ...options.room,
  });

  await mockAuthenticatedShell(page);
  await page.route("**/api/rooms/read-room", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, data: room }),
    });
  });
  await page.route("**/api/rooms/read-room/posts", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, data: [mockPost(room, options.post)] }),
    });
  });
  await page.route("**/api/rooms/read-room/members", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, data: [] }),
    });
  });
  await page.route("**/api/posts/501/replies", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, data: [] }),
    });
  });
}

async function mockAuthenticatedShell(page: Page) {
  await page.route("**/api/auth/me", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: {
          user: {
            id: 9,
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
      body: JSON.stringify({ ok: true, data: completedOnboardingState() }),
    });
  });
}

async function mockStats(page: Page) {
  await page.route("**/api/stats", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: {
          publicRooms: 1,
          publicPosts: 0,
          activeUsers: 1,
          totalReactions: 0,
        },
      }),
    });
  });
}

async function acknowledgeCookieNotice(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem("thia_cookie_notice_ack", "1");
  });
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

function roomAccessRequest(id: number, handle: string, displayName: string) {
  return {
    id,
    status: "pending",
    requester: {
      id,
      handle,
      displayName,
      initials: displayName.slice(0, 1),
      aura: "frost",
      avatarUrl: null,
    },
    reviewedBy: null,
    reviewedAt: null,
    createdAt: "2026-06-10 00:00:00",
    updatedAt: "2026-06-10 00:00:00",
  };
}

function mockPost(
  room: Record<string, unknown>,
  overrides: Record<string, unknown> = {},
) {
  return {
    id: 501,
    publicId: "pcviewonly501",
    author: {
      id: 2,
      handle: "author",
      displayName: "Author",
      initials: "A",
      aura: "frost",
      avatarUrl: null,
    },
    room,
    body: "View-only rooms still allow reactions.",
    bodyEntities: [],
    createdAt: "2026-06-10 00:00:00",
    updatedAt: "2026-06-10 00:00:00",
    mood: "",
    parentId: null,
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
    rebloggedBy: null,
    rebloggedAt: null,
    socialContext: {
      authorRelationship: null,
      likedByFollowedCount: 0,
    },
    ...overrides,
  };
}

function mockRoom(overrides: Record<string, unknown> = {}) {
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
    theme: "sunveil",
    themeConfig: { mode: "preset", preset: "sunveil" },
    iconUrl: null,
    bannerUrl: null,
    rules: "",
    visibility: "public",
    createdBy: 1,
    owner: {
      id: 1,
      handle: "owner",
      displayName: "Owner",
      initials: "O",
      aura: "frost",
      avatarUrl: null,
    },
    joinedByMe: false,
    myRoomRole: null,
    viewerCanViewPosts: true,
    viewerCanPost: false,
    viewerCanReact: false,
    viewerCanRequestAccess: false,
    accessRequestStatus: null,
    postCount: 0,
    latestActivityAt: null,
    createdAt: "2026-06-10 00:00:00",
    updatedAt: "2026-06-10 00:00:00",
    ...overrides,
  };
}

async function firstRoomSlug(page: Page) {
  await expect
    .poll(async () => {
      const roomCards = await page.getByTestId("room-card").count();
      const emptyStates = await page.getByText("No public rooms yet").count();

      return roomCards > 0 || emptyStates > 0;
    }, { message: "Rooms should finish loading" })
    .toBe(true);

  const firstRoom = page.getByTestId("room-card").first();

  if ((await firstRoom.count()) === 0) {
    return undefined;
  }

  const href = await firstRoom.getByRole("link").first().getAttribute("href");

  return href?.split("/").pop();
}

async function firstApiRoomSlug(page: Page) {
  const rooms = await page.evaluate(async () => {
    const response = await fetch("/api/rooms", {
      credentials: "include",
      headers: { Accept: "application/json" },
    });
    const body = await response.json().catch(() => null);

    return Array.isArray(body?.data) ? body.data : [];
  });

  const first = rooms.find((room) => typeof room?.slug === "string");

  return first?.slug as string | undefined;
}
