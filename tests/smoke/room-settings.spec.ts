import { expect, type Page, test } from "@playwright/test";

test("room edit save uses the API and updates the header", async ({ page }) => {
  let summary = "Original room summary.";
  let rules = "Keep it useful.";
  let patchPayload: Record<string, unknown> | undefined;

  await mockOwnedRoom(page, () => summary, (payload) => {
    patchPayload = payload;
    summary = String(payload.summary ?? summary);
    rules = String(payload.rules ?? rules);
  }, {
    rules: () => rules,
  });

  await acknowledgeCookieNotice(page);
  await page.goto("/rooms/sun-room");
  await expect(page.getByRole("button", { name: "Account menu for @owner" })).toBeVisible();
  await page.getByRole("button", { name: "Edit room" }).click();

  const modal = page.getByTestId("room-edit-modal");
  await modal.getByLabel("Summary").fill("Updated room summary for public testing.");
  await modal
    .getByLabel("Room rules")
    .fill("## Be kind\n- No spam\nRead [the guide](https://example.com/rules).");
  await expect(modal.getByTestId("profile-markdown-surface").getByTestId("room-rules")).toBeVisible();
  await expect(modal.getByTestId("room-rules")).not.toHaveCSS("color", "rgba(0, 0, 0, 0)");
  await expect(modal.getByTestId("profile-markdown-surface").getByTestId("profile-markdown-preview")).toBeVisible();
  await expect(modal.getByTestId("profile-markdown-preview")).not.toHaveCSS(
    "position",
    "absolute",
  );
  await expect(modal.getByTestId("profile-markdown-preview").getByRole("heading", { name: "Be kind" })).toBeVisible();
  await expect(modal.getByTestId("profile-markdown-preview").getByRole("listitem").filter({ hasText: "No spam" })).toBeVisible();
  await modal.getByRole("button", { name: "Save changes" }).click();

  await expect.poll(() => patchPayload).toBeTruthy();
  expect(patchPayload).toMatchObject({
    summary: "Updated room summary for public testing.",
    iconUrl: null,
    bannerUrl: null,
    rules: "## Be kind\n- No spam\nRead [the guide](https://example.com/rules).",
    visibility: "public",
  });
  await expect(page.getByText("Updated room summary for public testing.")).toBeVisible();
  await page.getByTestId("room-rules-button").click();
  const rulesModal = page.getByTestId("room-rules-modal");
  await expect(rulesModal.getByRole("heading", { name: "Be kind" })).toBeVisible();
  await expect(rulesModal.getByRole("listitem").filter({ hasText: "No spam" })).toBeVisible();
  await expect(rulesModal.getByRole("link", { name: "the guide" })).toHaveAttribute(
    "href",
    "https://example.com/rules",
  );
});

test("room edit saves room themes and applies them to the room page", async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("thia.lol.theme", "dark");
  });

  const patches: Record<string, unknown>[] = [];
  let theme: string | null = "glinda";
  let themeConfig: unknown = { mode: "preset", preset: "glinda" };

  await mockOwnedRoom(page, () => "Original room summary.", (payload) => {
    patches.push(payload);
    theme = typeof payload.theme === "string" ? payload.theme : null;
    themeConfig = payload.themeConfig ?? null;
  }, {
    theme: () => theme,
    themeConfig: () => themeConfig,
  });

  await acknowledgeCookieNotice(page);
  await page.goto("/rooms/sun-room");
  await page.getByRole("button", { name: "Edit room" }).click();

  const modal = page.getByTestId("room-edit-modal");
  await modal.getByTestId("room-theme-trigger").click();
  await expect(modal.getByTestId("room-theme-popover")).toBeVisible();
  await modal.getByTestId("room-theme-preset-roseveil").click();
  await modal.getByRole("button", { name: "Save changes" }).click();

  await expect.poll(() => patches.length).toBe(1);
  expect(patches[0]).toMatchObject({
    theme: "roseveil",
    themeConfig: { mode: "preset", preset: "roseveil" },
  });
  await expect
    .poll(() =>
      page.evaluate(() =>
        document.documentElement.style.getPropertyValue("--app-accent").trim(),
      ),
    )
    .toBe("#F48CA2");
  await expect
    .poll(() =>
      page.evaluate(() => ({
        accentContrast: document.documentElement.style
          .getPropertyValue("--app-accent-contrast")
          .trim(),
        leafInk: document.documentElement.style
          .getPropertyValue("--accent-leaf-ink")
          .trim(),
        roseInk: document.documentElement.style
          .getPropertyValue("--accent-rose-ink")
          .trim(),
      })),
    )
    .toEqual({
      accentContrast: "#32131D",
      leafInk: "#FFB0C2",
      roseInk: "#FFB0C2",
    });
});

test("room chat channels are managed inside Edit room", async ({ page }) => {
  await mockOwnedRoom(page, () => "Original room summary.");
  await acknowledgeCookieNotice(page);
  await page.goto("/rooms/sun-room");

  await expect(page.getByTestId("room-channel-settings")).toHaveCount(0);
  const channelApi = await mockRoomChannelManagement(page);
  await page.getByTestId("room-chat-tab").click();
  const roomChatDraft = page.getByLabel("Write a message");
  await expect(page.getByText("No messages yet", { exact: true })).toBeVisible();
  await roomChatDraft.fill("Keep this draft while channel settings refresh");

  await page.getByRole("button", { name: "Edit room" }).click();

  const modal = page.getByTestId("room-edit-modal");
  const settings = modal.getByTestId("room-channel-settings");
  await expect(settings).toBeVisible();
  await expect(
    settings.getByRole("heading", { name: "Chat channels" }),
  ).toBeVisible();
  await expect(
    settings.getByTestId("room-channel-settings-channel-general"),
  ).toBeVisible();

  await settings.getByLabel("Channel name").fill("Welcome");
  await settings.getByLabel("Channel description").fill("Start here.");
  await settings.getByLabel("Channel kind").selectOption("announcement");
  await settings.getByLabel("Staff-only posting").check();
  await settings.getByRole("button", { name: "Save channel" }).click();

  await expect.poll(() => channelApi.patches().length).toBe(1);
  expect(channelApi.patches()[0]).toMatchObject({
    slug: "general",
    payload: {
      name: "Welcome",
      description: "Start here.",
      kind: "announcement",
      readOnly: true,
    },
  });
  await expect(settings.getByTestId("room-channel-settings-status")).toHaveText(
    "Channel updated",
  );

  await settings.getByTestId("room-channel-settings-add").click();
  await settings.getByLabel("New channel name").fill("Updates");
  await settings.getByLabel("Channel description").fill("Room news.");
  await settings.getByRole("button", { name: "Create channel" }).click();

  await expect.poll(() => channelApi.created()).toMatchObject({
    name: "Updates",
    description: "Room news.",
    kind: "chat",
    readOnly: false,
  });
  await expect(
    settings.getByTestId("room-channel-settings-channel-updates"),
  ).toBeVisible();

  await settings.getByRole("button", { name: "Move #updates up" }).click();
  await expect.poll(() => channelApi.patches().length).toBe(3);
  expect(channelApi.patches().slice(1)).toEqual(
    expect.arrayContaining([
      { slug: "updates", payload: { position: 0 } },
      { slug: "general", payload: { position: 1 } },
    ]),
  );
  await expect(settings.getByTestId("room-channel-settings-status")).toHaveText(
    "Channel order updated",
  );

  channelApi.failNextPatch("general");
  await settings.getByRole("button", { name: "Move #updates down" }).click();
  await expect(settings.getByTestId("room-channel-settings-status")).toContainText(
    "current channel order was reloaded",
  );
  await expect.poll(() => channelApi.positions()).toEqual({
    general: 1,
    updates: 0,
  });

  await settings.getByTestId("room-channel-settings-channel-updates").click();
  await expect(
    settings.getByRole("heading", { name: "Edit #updates" }),
  ).toBeVisible();

  await settings.getByRole("button", { name: "Archive channel" }).click();
  await expect.poll(() => channelApi.archived()).toContain("updates");
  await expect(
    settings.getByTestId("room-channel-settings-channel-updates"),
  ).toHaveCount(0);
  await expect(settings.getByTestId("room-channel-settings-status")).toHaveText(
    "Channel archived",
  );
  await modal.getByRole("button", { name: "Cancel" }).click();
  await expect(roomChatDraft).toHaveValue(
    "Keep this draft while channel settings refresh",
  );
});

test("room moderator controls are gated to owners and admins", async ({ page }) => {
  let addedHandle: string | undefined;
  let removedHandle: string | undefined;

  await mockOwnedRoom(page, () => "Original room summary.", undefined, {
    onAddModerator: (handle) => {
      addedHandle = handle;
    },
    onRemoveModerator: (handle) => {
      removedHandle = handle;
    },
  });

  await acknowledgeCookieNotice(page);
  await page.goto("/rooms/sun-room");
  await expect(page.getByRole("link", { name: "@owner" })).toHaveAttribute(
    "href",
    "/@owner",
  );
  await expect(page.getByRole("link", { name: "Owner's profile" }).first()).toHaveAttribute(
    "href",
    "/@owner",
  );
  await expect(page.getByRole("link", { name: "Mira's profile" })).toHaveAttribute(
    "href",
    "/@mira",
  );
  await page.getByRole("button", { name: "Edit room" }).click();

  const modal = page.getByTestId("room-edit-modal");
  await expect(modal.getByLabel("Add moderator by handle")).toBeVisible();
  await expect(modal.getByRole("link", { name: "Owner's profile" })).toHaveAttribute(
    "href",
    "/@owner",
  );
  await expect(modal.getByRole("link", { name: "Mira's profile" })).toHaveAttribute(
    "href",
    "/@mira",
  );
  await expect(modal.getByTestId("room-moderator-handle-prefix")).toHaveCount(0);
  await modal.getByLabel("Add moderator by handle").fill("alex");
  await expect(modal.getByTestId("room-moderator-handle-prefix")).toBeVisible();
  await modal.getByLabel("Add moderator by handle").fill("@alex");
  await expect(modal.getByTestId("room-moderator-handle-prefix")).toHaveCount(0);
  await modal.getByRole("button", { name: "Add", exact: true }).click();

  await expect.poll(() => addedHandle).toBe("alex");
  await expect(modal.getByText("Moderator added")).toBeVisible();

  await modal.getByRole("button", { name: "Remove @mira as moderator" }).click();
  await expect.poll(() => removedHandle).toBe("mira");
});

test("room deletion flow requires confirmation and calls delete", async ({ page }) => {
  let deleted = false;

  await mockOwnedRoom(page, () => "Original room summary.", undefined, {
    onDeleteRoom: () => {
      deleted = true;
    },
  });

  await acknowledgeCookieNotice(page);
  await page.goto("/rooms/sun-room");
  await page.getByRole("button", { name: "Edit room" }).click();

  const modal = page.getByTestId("room-edit-modal");
  const deleteButton = modal.getByRole("button", { name: "Delete room" });
  await expect(deleteButton).toBeDisabled();

  await modal.getByLabel("Type /sun-room to confirm").fill("/sun-room");
  await expect(deleteButton).toBeEnabled();
  await deleteButton.click();

  await expect.poll(() => deleted).toBe(true);
  await expect(page).toHaveURL(/\/rooms$/);
});

test("room edit saves each visibility mode", async ({ page }) => {
  let summary = "Original room summary.";
  let rules = "Keep it useful.";
  let visibility = "public";
  const patches: Record<string, unknown>[] = [];

  await mockOwnedRoom(page, () => summary, (payload) => {
    patches.push(payload);
    summary = String(payload.summary ?? summary);
    rules = String(payload.rules ?? rules);
    visibility = String(payload.visibility ?? visibility);
  }, {
    rules: () => rules,
    visibility: () => visibility,
  });

  await acknowledgeCookieNotice(page);
  await page.goto("/rooms/sun-room");
  await expect(page.getByRole("button", { name: "Edit room" })).toBeVisible();

  for (const [index, option] of [
    ["Public", "public"],
    ["Private", "private"],
    ["Invite", "invite"],
    ["View-only", "view_only"],
  ].entries()) {
    await page.getByRole("button", { name: "Edit room" }).click();

    const modal = page.getByTestId("room-edit-modal");
    await modal.locator(`label:has(input[name="room-visibility"][value="${option[1]}"])`).click();
    await modal.getByRole("button", { name: "Save changes" }).click();

    await expect.poll(() => patches.length).toBe(index + 1);
    expect(patches[index]).toMatchObject({ visibility: option[1] });
  }
});

async function mockOwnedRoom(
  page: Page,
  summary: () => string,
  onPatch?: (payload: Record<string, unknown>) => void,
  callbacks: {
    onAddModerator?: (handle: string) => void;
    onRemoveModerator?: (handle: string) => void;
    onDeleteRoom?: () => void;
    rules?: () => string;
    visibility?: () => string;
    theme?: () => string | null;
    themeConfig?: () => unknown;
  } = {},
) {
  await page.route("**/api/auth/me", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: {
          user: {
            id: 1,
            handle: "owner",
            email: "owner@example.test",
            role: "member",
            status: "active",
            displayName: "Owner",
            avatarUrl: null,
          },
          profile: {
            displayName: "Owner",
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
      body: JSON.stringify({
        ok: true,
        data: completedOnboardingState(),
      }),
    });
  });

  await page.route(/\/api\/rooms$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, data: [roomBody(summary(), callbacks)] }),
    });
  });

  await page.route("**/api/rooms/sun-room", async (route) => {
    if (route.request().method() === "PATCH") {
      const payload = (await route.request().postDataJSON()) as Record<string, unknown>;
      onPatch?.(payload);
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          data: roomBody(
            String(payload.summary ?? summary()),
            {
              ...callbacks,
              rules: () => String(payload.rules ?? callbacks.rules?.() ?? ""),
              visibility: () => String(payload.visibility ?? callbacks.visibility?.() ?? "public"),
              theme: () => (typeof payload.theme === "string" ? payload.theme : callbacks.theme?.() ?? null),
              themeConfig: () => payload.themeConfig ?? callbacks.themeConfig?.() ?? null,
            },
          ),
        }),
      });
      return;
    }

    if (route.request().method() === "DELETE") {
      callbacks.onDeleteRoom?.();
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          data: { slug: "sun-room", deletedAt: "2026-06-10T00:00:00Z" },
        }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, data: roomBody(summary(), callbacks) }),
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
      body: JSON.stringify({ ok: true, data: roomMembers() }),
    });
  });

  await page.route("**/api/rooms/sun-room/access-requests", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, data: [] }),
    });
  });

  await page.route("**/api/rooms/sun-room/channels", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, data: [] }),
    });
  });

  await page.route("**/api/rooms/sun-room/moderators", async (route) => {
    const payload = readJsonBody(route.request());

    if (route.request().method() === "POST") {
      callbacks.onAddModerator?.(payload.handle ?? "");
    } else {
      callbacks.onRemoveModerator?.(payload.handle ?? "");
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, data: roomMembers(payload.handle) }),
    });
  });
}

async function mockRoomChannelManagement(page: Page) {
  let channels = [mockRoomChannel()];
  let createdPayload: Record<string, unknown> | undefined;
  const patchPayloads: Array<{
    payload: Record<string, unknown>;
    slug: string;
  }> = [];
  const archivedSlugs: string[] = [];
  let nextChannelId = 702;
  let updateSequence = 0;
  let failingPatchSlug: string | undefined;

  await page.route("**/api/rooms/sun-room/channels", async (route) => {
    if (route.request().method() === "POST") {
      createdPayload = route.request().postDataJSON() as Record<string, unknown>;
      const name = String(createdPayload.name ?? "channel");
      const created = mockRoomChannel({
        id: nextChannelId,
        slug: slugFromName(name),
        name,
        description:
          typeof createdPayload.description === "string"
            ? createdPayload.description
            : null,
        position: channels.length,
        kind: createdPayload.kind === "announcement" ? "announcement" : "chat",
        readOnly: createdPayload.readOnly === true,
      });
      nextChannelId += 1;
      channels = [...channels, created];

      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, data: created }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, data: channels }),
    });
  });

  await page.route("**/api/rooms/sun-room/channels/*", async (route) => {
    const slug = decodeURIComponent(new URL(route.request().url()).pathname.split("/").pop() ?? "");
    const payload = route.request().postDataJSON() as Record<string, unknown>;
    patchPayloads.push({ slug, payload });
    const current = channels.find((channel) => channel.slug === slug);

    if (!current) {
      await route.fulfill({
        status: 404,
        contentType: "application/json",
        body: JSON.stringify({ ok: false, error: "Channel not found." }),
      });
      return;
    }

    if (failingPatchSlug === slug) {
      failingPatchSlug = undefined;
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ ok: false, error: "Channel update interrupted." }),
      });
      return;
    }

    updateSequence += 1;
    const updated = {
      ...current,
      ...(typeof payload.name === "string" ? { name: payload.name } : {}),
      ...(payload.description === null || typeof payload.description === "string"
        ? { description: payload.description }
        : {}),
      ...(payload.kind === "chat" || payload.kind === "announcement"
        ? { kind: payload.kind }
        : {}),
      ...(typeof payload.readOnly === "boolean"
        ? { readOnly: payload.readOnly }
        : {}),
      ...(typeof payload.position === "number"
        ? { position: payload.position }
        : {}),
      ...(payload.archived === true
        ? { archivedAt: "2026-07-10 12:00:00" }
        : {}),
      updatedAt: `2026-07-10 12:00:${String(updateSequence).padStart(2, "0")}`,
    };

    channels = channels.map((channel) =>
      channel.id === updated.id ? updated : channel,
    );
    if (payload.archived === true) {
      archivedSlugs.push(slug);
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, data: updated }),
    });
  });

  await page.route("**/api/rooms/sun-room/channels/*/messages", async (route) => {
    const slug = decodeURIComponent(
      new URL(route.request().url()).pathname.split("/").at(-2) ?? "general",
    );
    const channel = channels.find((item) => item.slug === slug) ?? channels[0];

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: {
          channel,
          messages: [],
        },
      }),
    });
  });

  await page.route("**/api/rooms/sun-room/channels/*/read", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: { conversationId: 9701, readAt: "2026-07-10 12:00:00" },
      }),
    });
  });

  return {
    archived: () => archivedSlugs,
    created: () => createdPayload,
    failNextPatch: (slug: string) => {
      failingPatchSlug = slug;
    },
    patches: () => patchPayloads,
    positions: () => Object.fromEntries(
      channels.map((channel) => [channel.slug, channel.position]),
    ),
  };
}

async function acknowledgeCookieNotice(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem("thia_cookie_notice_ack", "1");
  });
}

function readJsonBody(request: import("@playwright/test").Request): { handle?: string } {
  try {
    return request.postDataJSON() as { handle?: string };
  } catch {
    return {};
  }
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

type MockRoomChannel = {
  archivedAt: string | null;
  conversationId: number;
  createdAt: string;
  description: string | null;
  id: number;
  kind: "announcement" | "chat";
  lastMessageAt: string | null;
  name: string;
  position: number;
  readOnly: boolean;
  roomId: number;
  slug: string;
  unreadCount: number;
  updatedAt: string;
  viewerCanPost: boolean;
};

function mockRoomChannel(
  overrides: Partial<MockRoomChannel> = {},
): MockRoomChannel {
  return {
    id: 701,
    roomId: 1,
    slug: "general",
    name: "general",
    description: "Room chat",
    position: 0,
    kind: "chat",
    readOnly: false,
    archivedAt: null,
    conversationId: 9701,
    unreadCount: 0,
    lastMessageAt: null,
    viewerCanPost: true,
    createdAt: "2026-07-10 00:00:00",
    updatedAt: "2026-07-10 00:00:00",
    ...overrides,
  };
}

function slugFromName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "")
    .slice(0, 48);
}

function roomBody(
  summary: string,
  callbacks: {
    rules?: () => string;
    visibility?: () => string;
    theme?: () => string | null;
    themeConfig?: () => unknown;
  } = {},
) {
  const theme = callbacks.theme?.() ?? "glinda";
  const themeConfig = callbacks.themeConfig?.() ?? { mode: "preset", preset: "glinda" };

  return {
    id: 1,
    slug: "sun-room",
    name: "Sun Room",
    summary,
    description: summary,
    mood: "",
    members: 2,
    memberCount: 2,
    live: false,
    theme,
    themeConfig,
    iconUrl: null,
    bannerUrl: null,
    rules: callbacks.rules?.() ?? "Keep it useful.",
    visibility: callbacks.visibility?.() ?? "public",
    createdBy: 1,
    owner: {
      id: 1,
      handle: "owner",
      displayName: "Owner",
      initials: "O",
      aura: "frost",
      avatarUrl: null,
    },
    joinedByMe: true,
    myRoomRole: "owner",
    viewerCanViewPosts: true,
    viewerCanPost: true,
    viewerCanReact: true,
    viewerCanRequestAccess: false,
    accessRequestStatus: null,
    pendingAccessRequestCount: 0,
    postCount: 0,
    latestActivityAt: null,
    createdAt: "2026-06-10 00:00:00",
    updatedAt: "2026-06-10 00:00:00",
  };
}

function roomMembers(extraModerator?: string) {
  const members = [
    {
      id: 1,
      role: "owner",
      joinedAt: "2026-06-10 00:00:00",
      user: {
        id: 1,
        handle: "owner",
        displayName: "Owner",
        initials: "O",
        aura: "frost",
        avatarUrl: null,
      },
    },
    {
      id: 2,
      role: "moderator",
      joinedAt: "2026-06-10 00:00:00",
      user: {
        id: 2,
        handle: "mira",
        displayName: "Mira",
        initials: "M",
        aura: "frost",
        avatarUrl: null,
      },
    },
  ];

  if (extraModerator) {
    members.push({
      id: 3,
      role: "moderator",
      joinedAt: "2026-06-10 00:00:00",
      user: {
        id: 3,
        handle: extraModerator,
        displayName: "Alex",
        initials: "A",
        aura: "frost",
        avatarUrl: null,
      },
    });
  }

  return members;
}
