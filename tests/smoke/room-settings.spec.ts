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
  await modal.getByTestId("profile-markdown-button-preview").click();
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
  await expect(page.getByRole("heading", { name: "Be kind" })).toBeVisible();
  await expect(page.getByRole("listitem").filter({ hasText: "No spam" })).toBeVisible();
  await expect(page.getByRole("link", { name: "the guide" })).toHaveAttribute(
    "href",
    "https://example.com/rules",
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
  await modal.getByRole("button", { name: "Add" }).click();

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

async function mockOwnedRoom(
  page: Page,
  summary: () => string,
  onPatch?: (payload: Record<string, unknown>) => void,
  callbacks: {
    onAddModerator?: (handle: string) => void;
    onRemoveModerator?: (handle: string) => void;
    onDeleteRoom?: () => void;
    rules?: () => string;
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

  await page.route("**/api/rooms", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, data: [roomBody(summary(), callbacks.rules?.())] }),
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
          data: roomBody(String(payload.summary), String(payload.rules ?? "")),
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
      body: JSON.stringify({ ok: true, data: roomBody(summary(), callbacks.rules?.()) }),
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

function roomBody(summary: string, rules = "Keep it useful.") {
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
    accent: "var(--accent-sun)",
    iconUrl: null,
    bannerUrl: null,
    rules,
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
    joinedByMe: true,
    myRoomRole: "owner",
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
