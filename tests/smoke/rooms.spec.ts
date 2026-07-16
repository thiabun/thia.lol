import { expect, test, type Page } from "@playwright/test";
import { fetchAuthMe, loginWithEnv, skipWithoutCredentials } from "../helpers/auth";
import {
  CURRENT_WHATS_NEW_RELEASE,
  whatsNewStorageKey,
} from "../../src/lib/whatsNew";

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

test("/rooms uses inline loading before revealing rooms", async ({
  page,
}) => {
  let releaseRooms: (() => void) | undefined;
  const roomsResponseDelay = new Promise<void>((resolve) => {
    releaseRooms = resolve;
  });
  await mockRoomCards(page, { roomsResponseDelay });

  await page.goto("/rooms");

  await expect(page.getByTestId("page-loading-overlay")).toHaveCount(0);
  await expect(page.getByTestId("rooms-page")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Loading rooms" })).toBeVisible();

  releaseRooms?.();
  await expect(page.getByTestId("rooms-page")).toBeVisible();
  await expect(page.getByTestId("room-card").first()).toBeVisible();
  await expect(page.getByTestId("page-loading-overlay")).toHaveCount(0);
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

test("authenticated room share copies attribution and sends the native Room to a moot", async ({
  page,
}) => {
  const moot = {
    id: 17,
    handle: "moonfriend",
    displayName: "Moon Friend",
    initials: "MF",
    aura: "tide",
    avatarUrl: null,
  };
  let shareRequest:
    | {
        csrfToken: string | undefined;
        method: string;
        payload: Record<string, unknown>;
      }
    | undefined;

  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (text: string) => {
          (window as unknown as { __copiedText?: string }).__copiedText = text;
        },
      },
    });
  });
  await mockRoomCards(page);
  await mockAuthenticatedShell(page);
  await page.route("**/api/chat/moots", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, data: [moot] }),
    });
  });
  await page.route("**/api/rooms/sun-room/shares/messages", async (route) => {
    shareRequest = {
      csrfToken: route.request().headers()["x-csrf-token"],
      method: route.request().method(),
      payload: route.request().postDataJSON() as Record<string, unknown>,
    };
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: {
          room: mockRoom({
            canonicalPath: "/rooms/sun-room",
            canonicalUrl: "https://thia.lol/rooms/sun-room",
          }),
          results: [
            {
              recipientUserId: moot.id,
              recipient: moot,
              status: "sent",
              conversationId: 41,
              messageId: 701,
            },
          ],
          sentCount: 1,
          failedCount: 0,
        },
      }),
    });
  });

  await page.goto("/rooms/sun-room");

  await page.getByTestId("room-share-button").click();
  const modal = page.getByTestId("room-share-modal");
  await expect(modal).toBeVisible();
  await expect(modal.getByRole("link", { name: "/rooms/sun-room" })).toHaveAttribute(
    "href",
    "/rooms/sun-room",
  );
  await expect(modal.getByTestId("room-share-card-link")).toHaveAttribute(
    "href",
    "/api/rooms/sun-room/share-card.png",
  );

  await modal.getByTestId("room-share-copy-link").click();
  await expect(modal.getByTestId("room-share-copy-link")).toContainText("Copied");
  await expect
    .poll(() =>
      page.evaluate(() => (window as unknown as { __copiedText?: string }).__copiedText),
    )
    .toContain(
      "/rooms/sun-room?utm_source=thia.lol&utm_medium=share&utm_campaign=room-share&thia_share=room%3Asun-room",
    );

  await expect(modal.getByTestId("room-share-moot-list")).toContainText("Moon Friend");
  await modal.getByTestId("room-share-moot-17").click();
  await expect(modal.getByTestId("room-share-moot-17")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await modal.getByTestId("room-share-note").fill("Meet me in this room");
  await modal.getByTestId("room-share-send-moots").click();

  await expect(modal.getByText("Sent to 1 moot.")).toBeVisible();
  await expect(modal.getByRole("link", { name: "Open chat" })).toHaveAttribute(
    "href",
    "/chat?conversation=41",
  );
  await expect.poll(() => shareRequest).toMatchObject({
    method: "POST",
    csrfToken: "test-csrf",
    payload: {
      recipientUserIds: [17],
      note: "Meet me in this room",
    },
  });
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
  await acknowledgeWhatsNewRelease(page, 9);

  for (const [index, mode] of [
    ["Public", "public"],
    ["Private", "private"],
    ["Invite", "invite"],
    ["View-only", "view_only"],
  ].entries()) {
    const slug = `${mode[1].replace("_", "-")}-room`;

    await page.goto("/rooms");
    await page.getByTestId("create-room-button").click();

    const modal = page.getByTestId("room-edit-modal");
    await modal.getByLabel("Name").fill(`${mode[0]} room`);
    await modal.getByLabel("Slug").fill(slug);
    await modal.getByLabel("Summary").fill(`A ${mode[0].toLowerCase()} room for smoke testing.`);
    await modal.locator(`label:has(input[name="room-visibility"][value="${mode[1]}"])`).click();
    await modal.getByRole("button", { name: "Create room" }).click();

    await expect.poll(() => createdPayloads.length).toBe(index + 1);
    expect(createdPayloads[index]).toMatchObject({ visibility: mode[1] });
    await expect(page).toHaveURL(new RegExp(`/rooms/${slug}$`));
    await expect(modal).toBeHidden();
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
  const rulesModal = page.getByTestId("room-rules-modal");
  await expect(rulesModal).toBeVisible();
  await expect.poll(() => actions.requested()).toBe(0);
  await rulesModal.getByLabel("I agree to follow these rules").check();
  await rulesModal.getByRole("button", { name: "Agree & request access" }).click();
  await expect.poll(() => actions.requested()).toBe(1);
  expect(actions.requestPayloads()).toEqual([
    { acceptedRules: true, acceptedRulesVersion: 1 },
  ]);
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

test("room Feed and Chat tabs stay exclusive and chat loading settles", async ({ page }) => {
  let channelRequests = 0;
  let messageRequests = 0;
  let readRequests = 0;
  let introductionRequests = 0;
  let releaseInitialChannels: (() => void) | undefined;
  let releaseInitialMessages: (() => void) | undefined;
  const initialChannelsDelay = new Promise<void>((resolve) => {
    releaseInitialChannels = resolve;
  });
  const initialMessagesDelay = new Promise<void>((resolve) => {
    releaseInitialMessages = resolve;
  });
  let delayNextGeneralRefresh = false;
  let staleRefreshStarted = false;
  let delaySendResponse = false;
  let delayedSendStarted = false;
  let delaySuccessfulRead = false;
  let failNextReadForCsrf = false;
  let includeSentMessagesInReads = false;
  let messageResponseUnreadCount = 0;
  let successfulReadStarted = false;
  let releaseSendResponse: (() => void) | undefined;
  const sendResponseDelay = new Promise<void>((resolve) => {
    releaseSendResponse = resolve;
  });
  const sentMessages: Array<Record<string, unknown>> = [];
  let releaseStaleRefresh: (() => void) | undefined;
  const staleRefreshDelay = new Promise<void>((resolve) => {
    releaseStaleRefresh = resolve;
  });
  let releaseSuccessfulRead: (() => void) | undefined;
  const successfulReadDelay = new Promise<void>((resolve) => {
    releaseSuccessfulRead = resolve;
  });
  const room = mockRoom({
    slug: "stable-room",
    name: "Stable Room",
    joinedByMe: true,
    myRoomRole: "member",
    viewerCanPost: true,
    rules: "Be kind.",
    rulesVersion: 2,
  });
  const channels = [
    {
      id: 701,
      roomId: room.id,
      slug: "general",
      name: "general",
      description: "Room chat",
      position: 0,
      kind: "chat",
      readOnly: false,
      archivedAt: null,
      conversationId: 9701,
      unreadCount: 1,
      lastMessageAt: "2026-07-10 09:15:00",
      viewerCanPost: true,
      createdAt: "2026-07-10 00:00:00",
      updatedAt: "2026-07-10 00:00:00",
    },
    {
      id: 702,
      roomId: room.id,
      slug: "introductions",
      name: "introductions",
      description: "Say hello",
      position: 1,
      kind: "chat",
      readOnly: false,
      archivedAt: null,
      conversationId: 9702,
      unreadCount: 0,
      lastMessageAt: null,
      viewerCanPost: true,
      createdAt: "2026-07-10 00:00:00",
      updatedAt: "2026-07-10 00:00:00",
    },
  ];

  await mockAuthenticatedShell(page);
  await acknowledgeCookieNotice(page);
  await page.route("**/api/rooms/stable-room", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, data: room }),
    });
  });
  await page.route("**/api/rooms/stable-room/posts", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, data: [mockPost(room)] }),
    });
  });
  await page.route("**/api/rooms/stable-room/members", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, data: [] }),
    });
  });
  await page.route("**/api/rooms/stable-room/channels", async (route) => {
    channelRequests += 1;
    if (channelRequests === 1) {
      await initialChannelsDelay;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, data: channels }),
    });
  });
  await page.route("**/api/rooms/stable-room/channels/general/messages", async (route) => {
    if (route.request().method() === "POST") {
      const payload = route.request().postDataJSON() as { body?: unknown };
      const message = {
        id: 8301 + sentMessages.length,
        conversationId: 9701,
        body: typeof payload.body === "string" ? payload.body : "",
        bodyEntities: [],
        attachments: [],
        deletedAt: null,
        createdAt: new Date().toISOString(),
        sender: {
          id: 9,
          handle: "viewer",
          displayName: "Viewer",
          avatarUrl: null,
        },
      };
      sentMessages.push(message);
      if (delaySendResponse) {
        delayedSendStarted = true;
        await sendResponseDelay;
      }
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          data: message,
        }),
      });
      return;
    }

    messageRequests += 1;
    if (messageRequests === 1) {
      await initialMessagesDelay;
    } else if (delayNextGeneralRefresh) {
      delayNextGeneralRefresh = false;
      staleRefreshStarted = true;
      await staleRefreshDelay;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: {
          channel: { ...channels[0], unreadCount: messageResponseUnreadCount },
          messages: [
            {
              id: 8101,
              conversationId: 9701,
              body: "The room chat is stable.",
              bodyEntities: [],
              attachments: [],
              deletedAt: null,
              createdAt: "2026-07-10 09:15:00",
              sender: {
                id: 10,
                handle: "mira",
                displayName: "Mira",
                avatarUrl: null,
              },
            },
            {
              id: 8102,
              conversationId: 9701,
              body: "Room link https://example.com/room",
              bodyEntities: [
                {
                  type: "link",
                  start: 10,
                  length: 24,
                  text: "https://example.com/room",
                  link: { url: "https://example.com/room" },
                },
              ],
              attachments: [],
              deletedAt: null,
              createdAt: "2026-07-10 09:15:30",
              sender: {
                id: 10,
                handle: "mira",
                displayName: "Mira",
                avatarUrl: null,
              },
            },
            ...(includeSentMessagesInReads ? sentMessages : []),
          ],
        },
      }),
    });
  });
  await page.route("**/api/rooms/stable-room/channels/introductions/messages", async (route) => {
    introductionRequests += 1;
    await new Promise((resolve) => setTimeout(resolve, 300));
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: {
          channel: channels[1],
          messages: [
            {
              id: 8201,
              conversationId: 9702,
              body: "This delayed response belongs to introductions.",
              bodyEntities: [],
              attachments: [],
              deletedAt: null,
              createdAt: "2026-07-10 09:16:00",
              sender: {
                id: 11,
                handle: "alex",
                displayName: "Alex",
                avatarUrl: null,
              },
            },
          ],
        },
      }),
    });
  });
  await page.route(/\/api\/rooms\/stable-room\/channels\/(general|introductions)\/read$/, async (route) => {
    readRequests += 1;

    if (failNextReadForCsrf) {
      failNextReadForCsrf = false;
      await route.fulfill({
        status: 403,
        contentType: "application/json",
        body: JSON.stringify({ ok: false, error: "CSRF token is invalid." }),
      });
      return;
    }

    if (delaySuccessfulRead) {
      successfulReadStarted = true;
      await successfulReadDelay;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: { conversationId: 9701, readAt: "2026-07-10 09:15:01" },
      }),
    });
  });

  await page.addInitScript(() => {
    const actualNow = Date.now.bind(Date);
    let offset = 0;
    const testWindow = window as Window & {
      __advanceRoomChatClock?: (milliseconds: number) => void;
    };

    testWindow.__advanceRoomChatClock = (milliseconds: number) => {
      offset += milliseconds;
    };
    Date.now = () => actualNow() + offset;
  });

  await page.goto("/rooms/stable-room");
  await expect(page.getByTestId("room-feed-tab")).toHaveAttribute("aria-selected", "true");
  await expect(page.locator("#room-feed-panel")).toBeVisible();
  await expect(page.getByTestId("room-channel-workspace")).toBeHidden();
  expect(channelRequests).toBe(0);
  expect(messageRequests).toBe(0);

  await page.getByTestId("room-feed-tab").focus();
  await page.getByTestId("room-feed-tab").press("ArrowRight");
  await expect(page).toHaveURL(/\/rooms\/stable-room\?tab=chat$/);
  await expect(page.getByTestId("room-channel-workspace")).toBeVisible();
  await expect(page.getByText("Loading channels", { exact: true })).toBeVisible();
  await expect(page.getByText("No channels", { exact: true })).toHaveCount(0);
  await expect(page.getByText("No messages yet", { exact: true })).toHaveCount(0);
  await expect(page.getByLabel("Write a message")).toBeDisabled();
  releaseInitialChannels?.();
  await expect(page.getByText("Loading messages", { exact: true })).toBeVisible();
  await expect(page.getByText("No messages yet", { exact: true })).toHaveCount(0);
  await expect(page.getByLabel("Write a message")).toBeDisabled();
  releaseInitialMessages?.();
  await expect(page.getByTestId("room-channel-settings")).toHaveCount(0);
  await expect(page.locator("#room-feed-panel")).toBeHidden();
  await expect(page.getByText("The room chat is stable.")).toBeVisible();
  const roomMessageList = page.getByTestId("room-channel-message-list");
  await expect(roomMessageList.getByTestId("rich-inline-link")).toHaveAttribute(
    "href",
    "https://example.com/room",
  );
  await expect(roomMessageList.getByTestId("rich-link-preview")).toHaveCount(0);
  expect(channelRequests).toBe(1);
  await expect.poll(() => messageRequests).toBe(1);
  await page.waitForTimeout(400);
  expect(messageRequests).toBe(1);
  expect(readRequests).toBe(0);

  delayNextGeneralRefresh = true;
  await page.evaluate(() => {
    const testWindow = window as Window & {
      __advanceRoomChatClock?: (milliseconds: number) => void;
    };

    for (let index = 0; index < 20; index += 1) {
      testWindow.__advanceRoomChatClock?.(8001);
      window.dispatchEvent(new Event("focus"));
    }
  });
  await expect.poll(() => staleRefreshStarted).toBe(true);
  expect(channelRequests).toBe(2);
  await page.getByLabel("Write a message").fill("Keep the selected-channel draft");
  await page.getByTestId("room-channel-general").click();
  expect(messageRequests).toBe(2);
  await expect(page.getByText("The room chat is stable.")).toBeVisible();
  await expect(page.getByLabel("Write a message")).toHaveValue("Keep the selected-channel draft");
  await page.getByLabel("Write a message").fill("A polled message must render once");
  await page.getByTestId("room-channel-message-composer").getByRole("button", { name: "Send" }).click();
  await expect(page.getByText("A polled message must render once")).toBeVisible();
  releaseStaleRefresh?.();
  await page.waitForTimeout(150);
  await expect(page.getByText("The room chat is stable.")).toBeVisible();
  await expect(page.getByText("A polled message must render once")).toBeVisible();
  expect(messageRequests).toBe(2);
  expect(readRequests).toBe(0);
  includeSentMessagesInReads = true;

  await page.getByTestId("room-channel-introductions").click();
  await expect.poll(() => introductionRequests).toBe(1);
  await page.getByTestId("room-channel-general").click();
  await expect(page.getByText("The room chat is stable.")).toBeVisible();
  await page.waitForTimeout(400);
  await expect(page.getByText("This delayed response belongs to introductions.")).toHaveCount(0);
  expect(messageRequests).toBe(3);

  delaySendResponse = true;
  delaySuccessfulRead = true;
  failNextReadForCsrf = true;
  messageResponseUnreadCount = 1;
  await page.getByLabel("Write a message").fill("A polled message must render once");
  await page.getByTestId("room-channel-message-composer").getByRole("button", { name: "Send" }).click();
  await expect.poll(() => delayedSendStarted).toBe(true);
  await page.evaluate(() => {
    const testWindow = window as Window & {
      __advanceRoomChatClock?: (milliseconds: number) => void;
    };

    for (let index = 0; index < 20; index += 1) {
      testWindow.__advanceRoomChatClock?.(8001);
      window.dispatchEvent(new Event("focus"));
    }
  });
  await expect.poll(() => messageRequests).toBe(4);
  await expect.poll(() => readRequests).toBe(2);
  await expect.poll(() => successfulReadStarted).toBe(true);
  await page.waitForTimeout(300);
  expect(messageRequests).toBe(4);
  await page.evaluate(() => {
    const testWindow = window as Window & {
      __advanceRoomChatClock?: (milliseconds: number) => void;
    };

    testWindow.__advanceRoomChatClock?.(8001);
    window.dispatchEvent(new Event("focus"));
  });
  await expect.poll(() => messageRequests).toBe(5);
  await page.waitForTimeout(300);
  expect(readRequests).toBe(2);
  releaseSuccessfulRead?.();
  messageResponseUnreadCount = 0;
  await expect(
    roomMessageList.getByText("A polled message must render once", { exact: true }),
  ).toHaveCount(2);
  releaseSendResponse?.();
  await expect(
    page.getByTestId("room-channel-message-composer").getByRole("button", { name: "Sending" }),
  ).toHaveCount(0);
  await expect(
    roomMessageList.getByText("A polled message must render once", { exact: true }),
  ).toHaveCount(2);

  await page.getByLabel("Write a message").fill("Keep this room draft");
  await page.getByTestId("room-feed-tab").click();
  await expect(page).toHaveURL(/\/rooms\/stable-room$/);
  await page.waitForTimeout(250);
  expect(messageRequests).toBe(5);
  await page.getByTestId("room-chat-tab").click();
  await expect(page.getByLabel("Write a message")).toHaveValue("Keep this room draft");
  expect(messageRequests).toBe(5);

  await page.evaluate(() => {
    const testWindow = window as Window & {
      __advanceRoomChatClock?: (milliseconds: number) => void;
    };

    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "hidden",
    });
    testWindow.__advanceRoomChatClock?.(8001);
    document.dispatchEvent(new Event("visibilitychange"));
    window.dispatchEvent(new Event("focus"));
  });
  await page.waitForTimeout(150);
  expect(messageRequests).toBe(5);
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "visible",
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect.poll(() => messageRequests).toBe(6);

  await page.goto("/rooms/stable-room?channel=general");
  await expect(page.getByTestId("room-chat-tab")).toHaveAttribute("aria-selected", "true");
  await expect(page.getByTestId("room-channel-workspace")).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  const roomComposer = page.getByTestId("room-channel-message-composer");
  await expect(roomComposer).toBeVisible();
  await expect(
    roomComposer
      .getByRole("button", { name: "Add GIF" })
      .locator('svg[data-icon="gif"][data-icon-source="heroicons"]'),
  ).toHaveAttribute("stroke-width", "2");
  const compactComposerLayout = await roomComposer.evaluate((element) => {
    const toolbar = element.querySelector<HTMLElement>(
      '[aria-label="Add message attachments"]',
    );
    const inputShell = element.querySelector<HTMLElement>(
      '[data-testid="room-channel-message-composer-input-shell"]',
    );
    const composerBox = element.getBoundingClientRect();
    const toolbarBox = toolbar?.getBoundingClientRect();
    const inputShellBox = inputShell?.getBoundingClientRect();

    return {
      bottomDelta:
        toolbarBox && inputShellBox
          ? Math.abs(toolbarBox.bottom - inputShellBox.bottom)
          : 999,
      composerHeight: composerBox.height,
      idleCountVisible: Boolean(
        element.querySelector('[data-testid="room-attachment-composer-count"]'),
      ),
    };
  });
  expect(compactComposerLayout.bottomDelta).toBeLessThanOrEqual(1);
  expect(compactComposerLayout.composerHeight).toBeLessThanOrEqual(72);
  expect(compactComposerLayout.idleCountVisible).toBe(false);
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    )
    .toBe(true);
});

test("Room Chat shares the native renderer and persists attachment-only composer sends", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const chat = await mockPersistentRoomAttachmentChat(page);

  await page.goto("/rooms/attachment-room?channel=general");

  const messageList = page.getByTestId("room-channel-message-list");
  await expect(messageList).toBeVisible();
  await expect(
    messageList.getByText(chat.sharedRoom.canonicalUrl, { exact: true }),
  ).toHaveCount(0);

  const nativeRoomAttachment = messageList.getByTestId("message-room-attachment");
  await expect(nativeRoomAttachment.getByTestId("room-attachment-card")).toContainText(
    "Moon Room",
  );
  await expect(
    nativeRoomAttachment.getByRole("link", { name: "Open Moon Room" }).last(),
  ).toHaveAttribute("href", "/rooms/moon-room");
  await expect(messageList.getByTestId("message-post-attachment-unavailable")).toContainText(
    "Post unavailable",
  );
  await expect(messageList.getByTestId("message-room-attachment-unavailable")).toContainText(
    "Room unavailable",
  );

  await selectRoomGifAttachment(page, "Wave");
  await selectRoomGifAttachment(page, "Spark");

  const attachmentItems = page.getByTestId("room-attachment-composer-items");
  const previews = attachmentItems.getByTestId("room-attachment-composer-item");
  await expect(previews).toHaveCount(2);
  await expect(previews.nth(0).locator("img")).toHaveAttribute(
    "src",
    roomMockGifResult.url,
  );
  await expect(previews.nth(1).locator("img")).toHaveAttribute(
    "src",
    roomMockSecondGifResult.url,
  );

  const mobileLayout = await page.evaluate(() => {
    const tray = document.querySelector(
      '[data-testid="room-attachment-composer-items"]',
    );
    const trayBox = tray?.getBoundingClientRect();
    const attachmentSurfaces = Array.from(
      document.querySelectorAll<HTMLElement>(
        '[data-testid="room-message-attachments"], [data-testid="room-attachment-composer-items"]',
      ),
    ).map((surface) => surface.getBoundingClientRect());
    const controls = Array.from(
      document.querySelectorAll<HTMLElement>(
        '[data-testid="room-attachment-composer"] [aria-label="Add message attachments"] .app-control',
      ),
    ).map((control) => ({
      height: control.offsetHeight,
      width: control.offsetWidth,
    }));

    return {
      controlsAreTouchSized: controls.every(
        (box) => box.width >= 44 && box.height >= 44,
      ),
      documentHasNoOverflow:
        document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      surfacesFitViewport: attachmentSurfaces.every(
        (box) => box.left >= 0 && box.right <= window.innerWidth,
      ),
      trayFitsViewport:
        Boolean(trayBox) &&
        (trayBox?.left ?? -1) >= 0 &&
        (trayBox?.right ?? window.innerWidth + 1) <= window.innerWidth,
      trayScrollsInternally:
        Boolean(tray) && (tray?.scrollWidth ?? 0) > (tray?.clientWidth ?? 0),
    };
  });

  expect(mobileLayout.documentHasNoOverflow).toBe(true);
  expect(mobileLayout.surfacesFitViewport).toBe(true);
  expect(mobileLayout.trayFitsViewport).toBe(true);
  expect(mobileLayout.trayScrollsInternally).toBe(true);
  expect(mobileLayout.controlsAreTouchSized).toBe(true);

  await previews.nth(0).getByRole("button", { name: "Move attachment 1 later" }).click();
  await expect(previews.nth(0).locator("img")).toHaveAttribute(
    "src",
    roomMockSecondGifResult.url,
  );
  await previews.nth(0).getByRole("button", { name: "Remove attachment 1" }).click();
  await expect(previews).toHaveCount(1);
  await expect(previews.nth(0).locator("img")).toHaveAttribute(
    "src",
    roomMockGifResult.url,
  );

  const composer = page.getByTestId("room-channel-message-composer");
  await expect(composer.getByLabel("Write a message")).toHaveValue("");
  await expect(composer.getByRole("button", { name: "Send" })).toBeEnabled();
  await composer.getByRole("button", { name: "Send" }).click();

  await expect.poll(() => chat.sentPayloads.length).toBe(1);
  expect(chat.sentPayloads[0]).toMatchObject({
    body: "",
    attachments: [
      {
        kind: "gif",
        provider: "klipy",
        resourceType: "gif",
        resourceId: "room-gif-1",
        resourceKey: "klipy:room-gif-1",
        url: "https://media.klipy.com/room-gif-1.gif",
      },
    ],
  });
  await expect(messageList.getByTestId("message-gif-attachment")).toHaveAttribute(
    "href",
    "https://klipy.com/room-gif-1",
  );

  await page.reload();
  await expect(page.getByTestId("room-channel-message-list")).toBeVisible();
  await expect(page.getByTestId("message-gif-attachment")).toHaveAttribute(
    "href",
    "https://klipy.com/room-gif-1",
  );
  await expect(page.getByTestId("message-room-attachment")).toBeVisible();
});

test("joining waits for explicit rules agreement and rules remain available", async ({ page }) => {
  let joined = false;
  const joinPayloads: Record<string, unknown>[] = [];
  const room = () =>
    mockRoom({
      slug: "rules-room",
      name: "Rules Room",
      rules: "1. Be kind.\n2. Stay on topic.\n\n[Read the guide](https://example.com/rules)",
      rulesVersion: 4,
      joinedByMe: joined,
      myRoomRole: joined ? "member" : null,
      memberCount: joined ? 2 : 1,
      members: joined ? 2 : 1,
      viewerCanPost: joined,
    });

  await mockAuthenticatedShell(page);
  await acknowledgeCookieNotice(page);
  await page.route("**/api/rooms/rules-room", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, data: room() }),
    });
  });
  await page.route("**/api/rooms/rules-room/posts", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, data: [] }),
    });
  });
  await page.route("**/api/rooms/rules-room/members", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, data: [] }),
    });
  });
  await page.route("**/api/rooms/rules-room/join", async (route) => {
    joinPayloads.push((await route.request().postDataJSON()) as Record<string, unknown>);
    joined = true;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, data: room() }),
    });
  });

  await page.goto("/rooms/rules-room");
  await page.getByTestId("room-join-button").click();

  const modal = page.getByTestId("room-rules-modal");
  await expect(modal).toBeVisible();
  await expect(modal.getByText("Be kind.")).toBeVisible();
  await expect(modal.getByRole("link", { name: "Read the guide" })).toHaveAttribute(
    "href",
    "https://example.com/rules",
  );
  await expect(modal.getByTestId("rich-link-preview")).toHaveCount(0);
  await expect(modal.getByRole("button", { name: "Agree & join" })).toBeDisabled();
  expect(joinPayloads).toHaveLength(0);

  await modal.getByRole("button", { name: "Not now" }).click();
  await expect(modal).toHaveCount(0);
  expect(joinPayloads).toHaveLength(0);

  await page.getByTestId("room-join-button").click();
  await modal.getByLabel("I agree to follow these rules").check();
  await modal.getByRole("button", { name: "Agree & join" }).click();

  await expect.poll(() => joinPayloads).toHaveLength(1);
  expect(joinPayloads[0]).toEqual({ acceptedRules: true, acceptedRulesVersion: 4 });
  await expect(page.getByTestId("room-join-button")).toContainText("Leave room");

  await page.getByTestId("room-rules-button").click();
  await expect(modal).toBeVisible();
  await expect(modal.getByLabel("I agree to follow these rules")).toHaveCount(0);
  await expect(modal.getByRole("button", { name: "Close", exact: true })).toBeVisible();
});

test("private Room invitees accept rules before membership and then load the Feed", async ({ page }) => {
  let joined = false;
  let postsRequests = 0;
  const joinPayloads: Record<string, unknown>[] = [];
  const room = () =>
    mockRoom({
      slug: "invited-room",
      name: "Invited Room",
      rules: "Keep this private Room kind.",
      rulesVersion: 3,
      visibility: "private",
      joinedByMe: joined,
      myRoomRole: joined ? "member" : null,
      viewerCanViewPosts: joined,
      viewerCanPost: joined,
      viewerCanReact: joined,
      viewerCanJoin: !joined,
      memberCount: joined ? 2 : 0,
      members: joined ? 2 : 0,
    });

  await mockAuthenticatedShell(page);
  await acknowledgeCookieNotice(page);
  await page.route("**/api/rooms/invited-room", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, data: room() }),
    });
  });
  await page.route("**/api/rooms/invited-room/posts", async (route) => {
    postsRequests += 1;
    await route.fulfill({
      status: joined ? 200 : 403,
      contentType: "application/json",
      body: JSON.stringify(
        joined
          ? {
              ok: true,
              data: [
                mockPost(room(), {
                  id: 611,
                  publicId: "pcprivate611",
                  body: "Only current members should see this private post.",
                }),
              ],
            }
          : { ok: false, error: "Room membership required." },
      ),
    });
  });
  await page.route("**/api/rooms/invited-room/members", async (route) => {
    await route.fulfill({
      status: joined ? 200 : 403,
      contentType: "application/json",
      body: JSON.stringify(
        joined
          ? { ok: true, data: [] }
          : { ok: false, error: "Room membership required." },
      ),
    });
  });
  await page.route("**/api/rooms/invited-room/join", async (route) => {
    if (route.request().method() === "DELETE") {
      joined = false;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, data: room() }),
      });
      return;
    }

    joinPayloads.push((await route.request().postDataJSON()) as Record<string, unknown>);
    joined = true;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, data: room() }),
    });
  });

  await page.goto("/rooms/invited-room");
  await expect(page.getByText("Room is private")).toBeVisible();
  await expect(page.getByTestId("room-join-button")).toBeVisible();
  await expect(page.getByTestId("room-chat-tab")).toBeDisabled();

  await page.getByTestId("room-join-button").click();
  const modal = page.getByTestId("room-rules-modal");
  await modal.getByLabel("I agree to follow these rules").check();
  await modal.getByRole("button", { name: "Agree & join" }).click();

  await expect.poll(() => joinPayloads).toEqual([
    { acceptedRules: true, acceptedRulesVersion: 3 },
  ]);
  await expect(page.getByTestId("room-join-button")).toContainText("Leave room");
  await expect(page.getByTestId("room-chat-tab")).toBeEnabled();
  await expect(page.getByText("Only current members should see this private post.")).toBeVisible();
  await expect(page.getByText("Posts are not available")).toHaveCount(0);
  await expect.poll(() => postsRequests).toBeGreaterThanOrEqual(2);

  await page.getByTestId("room-join-button").click();
  await expect(page.getByText("Room is private")).toBeVisible();
  await expect(page.getByText("Only current members should see this private post.")).toHaveCount(0);
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
  await expect(page).toHaveURL(/\/@author\/posts\/pcviewonly501$/);
  await expect(page.getByTestId("thread-view")).toBeVisible();
  await expect(page.getByTestId("reply-composer")).toHaveCount(0);
});

test("room themes recolor active post reactions against the active room theme", async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("thia.lol.theme", "dark");
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
      leafInk: "#C82F68",
      roseInk: "#C82F68",
    });
  await expect(page.getByRole("button", { name: /Unlike this post/i })).toHaveCSS(
    "color",
    "rgb(200, 47, 104)",
  );
  await expect(page.getByRole("button", { name: /Undo reblog/i })).toHaveCSS(
    "color",
    "rgb(200, 47, 104)",
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

async function mockRoomCards(
  page: Page,
  options: { roomsResponseDelay?: Promise<void> } = {},
) {
  await page.route("**/api/auth/me", async (route) => {
    await route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({ ok: false, error: "Unauthenticated." }),
    });
  });
  await page.route(/\/api\/rooms$/, async (route) => {
    await options.roomsResponseDelay;
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
  const requestPayloads: Record<string, unknown>[] = [];
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
      requestPayloads.push(
        (await route.request().postDataJSON()) as Record<string, unknown>,
      );
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
    requestPayloads: () => requestPayloads,
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
  await mockRoomChannelRoutes(page, "invite-room", room());
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
  const post = mockPost(room, options.post);

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
      body: JSON.stringify({ ok: true, data: [post] }),
    });
  });
  await page.route("**/api/rooms/read-room/members", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, data: [] }),
    });
  });
  await mockRoomChannelRoutes(page, "read-room", room);
  await page.route("**/api/posts/pcviewonly501", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, data: post }),
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

async function acknowledgeWhatsNewRelease(page: Page, userId: number) {
  await page.addInitScript(
    ({ releaseId, storageKey }) => {
      window.localStorage.setItem(storageKey, releaseId);
    },
    {
      releaseId: CURRENT_WHATS_NEW_RELEASE.id,
      storageKey: whatsNewStorageKey(userId),
    },
  );
}

async function mockPersistentRoomAttachmentChat(page: Page) {
  const room = mockRoom({
    slug: "attachment-room",
    name: "Attachment Room",
    joinedByMe: true,
    myRoomRole: "member",
    viewerCanPost: true,
    viewerCanReact: true,
  });
  const sharedRoom = {
    ...mockRoom({
      id: 72,
      slug: "moon-room",
      name: "Moon Room",
      summary: "A moonlit room for long-form listening.",
      description: "A moonlit room for long-form listening.",
      joinedByMe: true,
      myRoomRole: "member",
      memberCount: 18,
      members: 18,
      postCount: 12,
      viewerCanPost: true,
      viewerCanReact: true,
    }),
    canonicalPath: "/rooms/moon-room",
    canonicalUrl: "https://thia.lol/rooms/moon-room",
  };
  const channel = {
    id: 711,
    roomId: room.id,
    slug: "general",
    name: "general",
    description: "Attachment testing",
    position: 0,
    kind: "chat",
    readOnly: false,
    archivedAt: null,
    conversationId: 9711,
    unreadCount: 0,
    lastMessageAt: "2026-07-16 09:00:00",
    viewerCanPost: true,
    createdAt: "2026-07-16 08:00:00",
    updatedAt: "2026-07-16 09:00:00",
  };
  const sender = {
    id: 10,
    handle: "mira",
    displayName: "Mira",
    initials: "M",
    aura: "frost",
    avatarUrl: null,
  };
  const sentPayloads: Array<Record<string, unknown>> = [];
  const messages: Array<Record<string, unknown>> = [
    {
      id: 8401,
      conversationId: channel.conversationId,
      body: `A native Room share\n${sharedRoom.canonicalUrl}`,
      bodyEntities: [],
      attachments: [{ type: "room", room: sharedRoom }],
      deletedAt: null,
      createdAt: "2026-07-16 09:00:00",
      sender,
    },
    {
      id: 8402,
      conversationId: channel.conversationId,
      body: "Unavailable native shares",
      bodyEntities: [],
      attachments: [
        { type: "post", post: null },
        { type: "room", room: null },
      ],
      deletedAt: null,
      createdAt: "2026-07-16 09:01:00",
      sender,
    },
  ];

  await mockAuthenticatedShell(page);
  await acknowledgeCookieNotice(page);
  await mockRoomChatGifSearch(page, [roomMockGifResult, roomMockSecondGifResult]);

  await page.route("**/api/rooms/attachment-room", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, data: room }),
    });
  });
  await page.route("**/api/rooms/attachment-room/posts", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, data: [] }),
    });
  });
  await page.route("**/api/rooms/attachment-room/members", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, data: [] }),
    });
  });
  await page.route("**/api/rooms/attachment-room/channels", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, data: [channel] }),
    });
  });
  await page.route(
    "**/api/rooms/attachment-room/channels/general/messages",
    async (route) => {
      if (route.request().method() === "POST") {
        const payload = route.request().postDataJSON() as Record<string, unknown>;
        sentPayloads.push(payload);
        const message = {
          id: 8500 + sentPayloads.length,
          conversationId: channel.conversationId,
          body: typeof payload.body === "string" ? payload.body : "",
          bodyEntities: [],
          attachments: roomChatAttachmentsFromRequest(payload.attachments),
          deletedAt: null,
          createdAt: "2026-07-16 09:05:00",
          sender: {
            id: 9,
            handle: "viewer",
            displayName: "Viewer",
            initials: "V",
            aura: "glow",
            avatarUrl: null,
          },
        };
        messages.push(message);

        await route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify({ ok: true, data: message }),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          data: { channel, messages },
        }),
      });
    },
  );
  await page.route(
    "**/api/rooms/attachment-room/channels/general/read",
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          data: {
            conversationId: channel.conversationId,
            readAt: "2026-07-16 09:05:01",
          },
        }),
      });
    },
  );

  return { sentPayloads, sharedRoom };
}

async function selectRoomGifAttachment(page: Page, title: string) {
  await page.getByTestId("room-attachment-composer-gif-button").click();
  await expect(page.getByTestId("gif-picker-results")).toBeVisible();
  await page.getByRole("button", { name: `Select GIF ${title}` }).click();
}

async function mockRoomChatGifSearch(
  page: Page,
  items: Array<Record<string, unknown>>,
) {
  await page.route("https://media.klipy.com/**", async (route) => {
    await route.fulfill({
      contentType: "image/gif",
      body: Buffer.from(roomTransparentGifBase64, "base64"),
    });
  });

  for (const endpoint of ["trending", "search"] as const) {
    await page.route(`**/api/gifs/${endpoint}**`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          data: {
            available: true,
            provider: "klipy",
            query: endpoint === "search" ? "wave" : null,
            next: null,
            items,
          },
        }),
      });
    });
  }
}

function roomChatAttachmentsFromRequest(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((rawAttachment, position) => {
    if (!plainRecord(rawAttachment)) {
      return [];
    }

    const attachment =
      rawAttachment.type === "media" && plainRecord(rawAttachment.media)
        ? rawAttachment.media
        : rawAttachment;
    const kind = stringValue(attachment.kind) || stringValue(attachment.type);
    const card = plainRecord(attachment.card) ? attachment.card : null;

    if (kind === "gif") {
      return [
        {
          type: "gif",
          gif: {
            provider: "klipy",
            resourceType: "gif",
            resourceId: stringValue(attachment.resourceId),
            resourceKey: stringValue(attachment.resourceKey),
            url: stringValue(attachment.url),
            previewUrl: stringValue(card?.previewUrl) || stringValue(attachment.url),
            mime: "image/gif" as const,
            width: numberOrNull(attachment.width),
            height: numberOrNull(attachment.height),
            sourceUrl: stringValue(attachment.sourceUrl) || null,
            title: stringValue(card?.title) || "KLIPY GIF",
            card,
          },
        },
      ];
    }

    if (!["image", "video", "audio", "integration"].includes(kind)) {
      return [];
    }

    return [
      {
        type: "media",
        media: {
          position,
          kind,
          url: stringValue(attachment.url) || null,
          mime: stringValue(attachment.mime) || null,
          sizeBytes: numberOrNull(attachment.sizeBytes),
          width: numberOrNull(attachment.width),
          height: numberOrNull(attachment.height),
          durationSeconds: numberOrNull(attachment.durationSeconds),
          posterUrl: stringValue(attachment.posterUrl) || null,
          provider: stringValue(attachment.provider) || null,
          resourceType: stringValue(attachment.resourceType) || null,
          resourceId: stringValue(attachment.resourceId) || null,
          resourceKey: stringValue(attachment.resourceKey) || null,
          sourceUrl: stringValue(attachment.sourceUrl) || null,
          card,
        },
      },
    ];
  });
}

function plainRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function numberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const number = Number(value);

  return Number.isFinite(number) ? number : null;
}

async function mockRoomChannelRoutes(
  page: Page,
  slug: string,
  room: Record<string, unknown>,
) {
  const channel = {
    id: 701,
    roomId: room.id ?? 1,
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
    viewerCanPost: Boolean(room.viewerCanPost),
    createdAt: "2026-07-10 00:00:00",
    updatedAt: "2026-07-10 00:00:00",
  };

  await page.route(`**/api/rooms/${slug}/channels`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, data: [channel] }),
    });
  });
  await page.route(`**/api/rooms/${slug}/channels/general/messages`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, data: { channel, messages: [] } }),
    });
  });
  await page.route(`**/api/rooms/${slug}/channels/general/read`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: {
          conversationId: channel.conversationId,
          readAt: "2026-07-10 00:00:00",
        },
      }),
    });
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
    theme: "glinda",
    themeConfig: { mode: "preset", preset: "glinda" },
    iconUrl: null,
    bannerUrl: null,
    rules: "",
    rulesVersion: 1,
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

const roomMockGifResult = {
  id: "room-gif-1",
  title: "Wave",
  provider: "klipy",
  resourceType: "gif",
  resourceId: "room-gif-1",
  resourceKey: "klipy:room-gif-1",
  url: "https://media.klipy.com/room-gif-1.gif",
  previewUrl: "https://media.klipy.com/room-gif-1-small.gif",
  mime: "image/gif",
  width: 320,
  height: 180,
  sourceUrl: "https://klipy.com/room-gif-1",
  card: {
    provider: "klipy",
    title: "Wave",
    previewUrl: "https://media.klipy.com/room-gif-1-small.gif",
    url: "https://media.klipy.com/room-gif-1.gif",
    sourceUrl: "https://klipy.com/room-gif-1",
    width: 320,
    height: 180,
  },
};

const roomMockSecondGifResult = {
  ...roomMockGifResult,
  id: "room-gif-2",
  title: "Spark",
  resourceId: "room-gif-2",
  resourceKey: "klipy:room-gif-2",
  url: "https://media.klipy.com/room-gif-2.gif",
  previewUrl: "https://media.klipy.com/room-gif-2-small.gif",
  sourceUrl: "https://klipy.com/room-gif-2",
  card: {
    ...roomMockGifResult.card,
    title: "Spark",
    previewUrl: "https://media.klipy.com/room-gif-2-small.gif",
    url: "https://media.klipy.com/room-gif-2.gif",
    sourceUrl: "https://klipy.com/room-gif-2",
  },
};

const roomTransparentGifBase64 = "R0lGODlhAQABAAAAACwAAAAAAQABAAA=";

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
