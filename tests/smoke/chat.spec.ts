import { expect, type Locator, type Page, test } from "@playwright/test";
import { loginWithEnv, skipWithoutCredentials } from "../helpers/auth";

type ApiEnvelope<T> = {
  ok: boolean;
  data?: T;
  error?: string;
};

test("chat route shows an honest logged-out state and keeps Chat in nav", async ({
  page,
}) => {
  await mockAnonymousShell(page);
  await page.goto("/chat");

  await expect(page.getByRole("heading", { name: "Chat", exact: true })).toBeVisible();
  await expect(page.getByText("Sign in to see messages.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();

  const nav = page.getByTestId("desktop-nav");
  await expect(nav.getByRole("link", { name: "Chat" })).toBeVisible();
  await expect(nav.getByRole("link", { name: "Admin" })).toHaveCount(0);
});

test("authenticated chat renders conversations and message composer", async ({
  page,
}) => {
  await mockAuthenticatedChat(page);
  await page.goto("/chat");

  await expect(page.getByRole("heading", { name: "Chat", exact: true })).toBeVisible();
  await expect(page.getByTestId("chat-new-chat-button")).toBeVisible();
  await expect(page.getByTestId("chat-conversation-list")).toContainText("Moot Friend");
  await expect(
    page
      .getByTestId("chat-conversation-list")
      .getByRole("link", { name: "Moot Friend's profile" }),
  ).toHaveAttribute("href", "/@mootfriend");
  await expect(
    page.getByRole("link", { name: "Moot Friend's profile" }).first(),
  ).toHaveAttribute("href", "/@mootfriend");
  await page
    .getByTestId("chat-conversation-row-10")
    .getByTestId("chat-conversation-open-10")
    .click();
  await expect(page).toHaveURL(/\/chat\?conversation=10$/);
  await expect(page.getByTestId("chat-message-list")).toContainText("hello from a moot");
  await expect(page.getByTestId("chat-message-composer")).toBeVisible();
  const messageInput = page.getByPlaceholder("Write a message");
  const sendButton = page.getByRole("button", { name: "Send" });
  await expect(messageInput).toBeVisible();
  await expect(sendButton).toBeDisabled();
  const composerMetrics = await page.evaluate(() => {
    const inputBox = document
      .querySelector("#chat-message-body")
      ?.getBoundingClientRect();
    const buttonBox = document
      .querySelector('[data-testid="chat-message-composer"] button[type="submit"]')
      ?.getBoundingClientRect();

    return {
      heightDelta:
        inputBox && buttonBox ? Math.abs(inputBox.height - buttonBox.height) : 999,
      topDelta: inputBox && buttonBox ? Math.abs(inputBox.top - buttonBox.top) : 999,
    };
  });
  expect(composerMetrics.topDelta).toBeLessThanOrEqual(1);
  expect(composerMetrics.heightDelta).toBeLessThanOrEqual(2);
  await messageInput.fill("line one");
  await messageInput.press("Control+Enter");
  await expect(messageInput).toHaveValue("line one\n");
  await messageInput.fill("line two");
  await messageInput.press("Meta+Enter");
  await expect(messageInput).toHaveValue("line two\n");
  await messageInput.fill("keyboard send");
  await messageInput.press("Enter");
  await expect(page.getByTestId("chat-message-list")).toContainText("keyboard send");
  await expect(messageInput).toHaveValue("");
  await expect(page.getByTestId("chat-workspace")).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
      ),
    )
    .toBe(false);
});

test("mobile chat keeps the composer clear of the dock", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockAuthenticatedChat(page);
  await page.goto("/chat");

  const composer = page.getByTestId("chat-message-composer");
  const mobileNav = page.getByTestId("mobile-nav");
  const chatDockItem = mobileNav.getByRole("link", { name: "Chat" });
  const postAction = page.getByTestId("mobile-post-action");

  await composer.scrollIntoViewIfNeeded();
  await expect(composer).toBeVisible();
  await expect(chatDockItem).toBeVisible();
  await expect(postAction).toBeVisible();

  const layout = await page.evaluate(() => {
    const composerBox = document
      .querySelector('[data-testid="chat-message-composer"]')
      ?.getBoundingClientRect();
    const navBox = document
      .querySelector('[data-testid="mobile-nav"]')
      ?.getBoundingClientRect();
    const chatBox = Array.from(
      document.querySelectorAll('[data-testid="mobile-nav"] a'),
    )
      .find((element) => element.textContent?.trim() === "Chat")
      ?.getBoundingClientRect();
    const postBox = document
      .querySelector('[data-testid="mobile-post-action"]')
      ?.getBoundingClientRect();

    return {
      horizontalOverflow:
        document.documentElement.scrollWidth > document.documentElement.clientWidth,
      composerBottom: composerBox?.bottom ?? 0,
      navTop: navBox?.top ?? window.innerHeight,
      dockHitboxesOverlap:
        chatBox && postBox
          ? !(
              postBox.right <= chatBox.left ||
              postBox.left >= chatBox.right ||
              postBox.bottom <= chatBox.top ||
              postBox.top >= chatBox.bottom
            )
          : true,
    };
  });

  expect(layout.horizontalOverflow).toBe(false);
  expect(layout.composerBottom).toBeLessThanOrEqual(layout.navTop - 8);
  expect(layout.dockHitboxesOverlap).toBe(false);
});

test("switching conversations does not show stale messages under the next participant", async ({
  page,
}) => {
  let conversationListRequests = 0;
  let releaseUnreadMessages: (() => void) | undefined;
  const unreadMessagesDelay = new Promise<void>((resolve) => {
    releaseUnreadMessages = resolve;
  });
  page.on("request", (request) => {
    if (
      request.method() === "GET" &&
      new URL(request.url()).pathname === "/api/chat/conversations"
    ) {
      conversationListRequests += 1;
    }
  });

  await mockAuthenticatedChat(page, {
    conversations: [mockConversation, mockUnreadConversation],
    messageResponseDelays: { 11: unreadMessagesDelay },
  });
  await page.goto("/chat?conversation=10");

  const messageList = page.getByTestId("chat-message-list");
  await expect(messageList).toContainText("hello from a moot");
  const requestsBeforeNavigation = conversationListRequests;

  await page.evaluate(() => {
    window.history.pushState(null, "", "/chat?conversation=11");
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
  await expect(page).toHaveURL(/\/chat\?conversation=11$/);
  await expect(page.getByText("Unread Moot", { exact: true }).last()).toBeVisible();
  await expect(messageList).not.toContainText("hello from a moot");
  await expect(messageList).toContainText("Loading messages");
  expect(conversationListRequests).toBe(requestsBeforeNavigation);

  releaseUnreadMessages?.();
  await expect(messageList).toContainText("new unread note");

  const requestsBeforeMissingConversation = conversationListRequests;
  await page.evaluate(() => {
    window.history.pushState(null, "", "/chat?conversation=999");
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
  await expect(messageList).toHaveCount(0);
  await expect(page.getByText("Conversation not available", { exact: true })).toBeVisible();
  await expect.poll(() => conversationListRequests).toBe(
    requestsBeforeMissingConversation + 1,
  );
});

test("a delayed send cannot overwrite the next conversation or its draft", async ({ page }) => {
  let sendStarted = false;
  let releaseSend: (() => void) | undefined;
  const sendDelay = new Promise<void>((resolve) => {
    releaseSend = resolve;
  });

  await mockAuthenticatedChat(page, {
    conversations: [mockConversation, mockUnreadConversation],
    onSendMessage: async () => {
      sendStarted = true;
      await sendDelay;
    },
  });
  await page.goto("/chat?conversation=10");

  const composer = page.getByLabel("Write a message");
  await composer.fill("Message for the first conversation");
  await page.getByTestId("chat-message-composer").getByRole("button", { name: "Send" }).click();
  await expect.poll(() => sendStarted).toBe(true);

  await page.getByTestId("chat-conversation-open-11").click();
  await expect(page).toHaveURL(/\/chat\?conversation=11$/);
  await composer.fill("Draft for the second conversation");

  releaseSend?.();
  await expect(page.getByText("Unread Moot", { exact: true }).last()).toBeVisible();
  await expect(page.getByTestId("chat-message-list")).toContainText("new unread note");
  await expect(page.getByTestId("chat-message-list")).not.toContainText(
    "Message for the first conversation",
  );
  await expect(composer).toHaveValue("Draft for the second conversation");
});

test("authenticated chat renders rich message entities", async ({ page }) => {
  await page.route(/^https:\/\/www\.youtube-nocookie\.com\/embed\//, async (route) => {
    await route.fulfill({
      contentType: "text/html",
      body: "<!doctype html><html><body>YouTube embed stub</body></html>",
    });
  });

  const body =
    "hello @mootfriend with https://example.com/chat and https://www.youtube.com/watch?v=abc123";
  const richConversation = {
    ...mockConversation,
    lastMessage: {
      ...mockConversation.lastMessage,
      body,
      bodyEntities: [
        richMentionEntity(body, "@mootfriend", mockConversation.otherParticipant),
        richLinkEntity(
          body,
          "https://example.com/chat",
          richWebsiteCard("https://example.com/chat", "Chat card"),
        ),
        richLinkEntity(
          body,
          "https://www.youtube.com/watch?v=abc123",
          richYouTubeCard("https://www.youtube.com/watch?v=abc123"),
        ),
      ],
    },
  } as typeof mockConversation;

  await mockAuthenticatedChat(page, {
    conversations: [richConversation],
  });

  await page.goto("/chat");

  const messages = page.getByTestId("chat-message-list");
  await expect(messages.getByTestId("rich-mention-link")).toHaveAttribute(
    "href",
    "/@mootfriend",
  );
  await expect(messages.getByTestId("rich-inline-link").first()).toHaveAttribute(
    "href",
    "https://example.com/chat",
  );
  await expect(messages.getByText("Chat card")).toBeVisible();
  await expect(messages.getByTestId("rich-link-embed-youtube")).toBeVisible();
});

test("authenticated chat renders post attachments", async ({ page }) => {
  const attachedPost = {
    id: 42,
    publicId: "pabc123def456",
    canonicalPath: "/@alex/posts/pabc123def456",
    canonicalUrl: "https://thia.lol/@alex/posts/pabc123def456",
    bodySnippet: "A shared post from Alex.",
    createdAt: "2026-06-10 10:00:00",
    mediaUrl: null,
    author: {
      id: 4,
      handle: "alex",
      displayName: "Alex",
      initials: "A",
      aura: "frost",
      avatarUrl: null,
    },
    room: null,
  };
  const sharedConversation = {
    ...mockConversation,
    lastMessage: {
      ...mockConversation.lastMessage,
      body: "you should see this",
      attachments: [{ type: "post", post: attachedPost }],
    },
  } as unknown as typeof mockConversation;
  const unavailableConversation = {
    ...mockUnreadConversation,
    lastMessage: {
      ...mockUnreadConversation.lastMessage,
      body: "this one disappeared",
      attachments: [{ type: "post", post: null }],
    },
  } as unknown as typeof mockConversation;

  await mockAuthenticatedChat(page, {
    conversations: [sharedConversation, unavailableConversation],
  });

  await page.goto("/chat?conversation=10");

  await expect(page.getByTestId("chat-post-attachment")).toHaveAttribute(
    "href",
    "/@alex/posts/pabc123def456",
  );
  await expect(page.getByTestId("chat-post-attachment")).toContainText(
    "A shared post from Alex.",
  );

  await page.getByTestId("chat-conversation-row-11").click();
  await expect(page.getByTestId("chat-post-attachment-unavailable")).toContainText(
    "Post unavailable.",
  );
});

test("chat GIF picker shows an unavailable KLIPY state", async ({ page }) => {
  await mockAuthenticatedChat(page);
  await mockGifSearch(page, { available: false, items: [] });
  await page.goto("/chat?conversation=10");

  await page.getByRole("button", { name: "Add GIF" }).click();

  await expect(page.getByText("KLIPY unavailable")).toBeVisible();
  await expect(page.getByText("GIF search is unavailable.")).toBeVisible();
});

test("chat GIF picker selects and sends provider-backed GIF attachments", async ({
  page,
}) => {
  let sendBody: Record<string, unknown> | undefined;
  await mockAuthenticatedChat(page, {
    onSendMessage: async (body) => {
      sendBody = body as Record<string, unknown>;
    },
  });
  await mockGifSearch(page, {
    available: true,
    items: [mockGifResult],
  });
  await page.goto("/chat?conversation=10");

  await page.getByRole("button", { name: "Add GIF" }).click();
  await expect(page.getByTestId("gif-picker-results")).toBeVisible();
  await page.getByRole("button", { name: "Select GIF Wave" }).click();

  await expect(page.getByTestId("chat-selected-gifs")).toContainText("KLIPY");
  await page.getByRole("button", { name: "Send" }).click();

  expect(sendBody).toMatchObject({
    attachments: [
      {
        type: "gif",
        provider: "klipy",
        resourceType: "gif",
        resourceId: "gif-1",
        resourceKey: "klipy:gif-1",
        url: "https://media.klipy.example/gif-1.gif",
      },
    ],
  });
  await expect(page.getByTestId("chat-gif-attachment")).toHaveAttribute(
    "href",
    "https://klipy.example/gif-1",
  );
});

test("chat composer inserts mention suggestions", async ({ page }) => {
  await mockAuthenticatedChat(page);
  await page.route("**/api/search?**", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: {
          query: "mo",
          minQueryLength: 2,
          results: {
            profiles: [
              {
                user: mockConversation.otherParticipant,
                bioSnippet: "A moot.",
              },
            ],
            rooms: [],
          },
        },
      }),
    });
  });

  await page.goto("/chat");
  const composer = page.getByPlaceholder("Write a message");

  await composer.fill("hello @mo");
  await expect(page.getByTestId("mention-suggestions")).toBeVisible();
  await page.getByTestId("mention-suggestion-mootfriend").click();

  await expect(composer).toHaveValue("hello @mootfriend ");
});

test("chat conversation row separates profile links from open targets", async ({
  page,
}) => {
  await mockAuthenticatedChat(page, {
    conversations: [mockConversation, mockUnreadConversation],
  });

  await expectChatReset(page);
  const row = page.getByTestId("chat-conversation-row-10");

  await expect(row.getByTestId("chat-conversation-avatar-10")).toHaveAttribute(
    "href",
    "/@mootfriend",
  );
  await expect(row.getByTestId("chat-conversation-name-10")).toHaveAttribute(
    "href",
    "/@mootfriend",
  );
  await expect(row.getByTestId("chat-conversation-handle-10")).toHaveAttribute(
    "href",
    "/@mootfriend",
  );

  await row.getByTestId("chat-conversation-avatar-10").click();
  await expect(page).toHaveURL(/\/@mootfriend$/);

  await expectChatReset(page);
  await page.getByTestId("chat-conversation-name-10").click();
  await expect(page).toHaveURL(/\/@mootfriend$/);

  await expectChatReset(page);
  await page.getByTestId("chat-conversation-handle-10").click();
  await expect(page).toHaveURL(/\/@mootfriend$/);

  await expectOpenFromConversationTarget(
    page,
    page.getByTestId("chat-conversation-preview-10"),
  );
  await expectOpenFromConversationTarget(
    page,
    page.getByTestId("chat-conversation-timestamp-10"),
  );
  await expectOpenFromConversationTarget(
    page,
    page.getByTestId("chat-conversation-unread-11"),
    11,
  );

  await expectChatReset(page);
  const rowBox = await page.getByTestId("chat-conversation-row-10").boundingBox();
  if (!rowBox) {
    throw new Error("Conversation row did not render.");
  }
  await page.mouse.click(rowBox.x + rowBox.width - 6, rowBox.y + 6);
  await expect(page).toHaveURL(/\/chat\?conversation=10$/);

  await expectChatReset(page);
  const openButton = page.getByTestId("chat-conversation-open-10");
  await openButton.focus();
  await expect(openButton).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/chat\?conversation=10$/);

  await expectChatReset(page);
  const nameLink = page.getByTestId("chat-conversation-name-10");
  await nameLink.focus();
  await expect(nameLink).toBeFocused();
});

test("authenticated chat empty state stays route-level", async ({ page }) => {
  let roomRequestCount = 0;

  await page.route(/\/api\/rooms(?:[/?]|$)/u, async (route) => {
    roomRequestCount += 1;
    const pathname = new URL(route.request().url()).pathname;
    const data = pathname.endsWith("/channels")
      ? [
          {
            id: 901,
            roomId: 90,
            slug: "general",
            name: "general",
            description: "Room chat",
            position: 0,
            kind: "chat",
            readOnly: false,
            archivedAt: null,
            conversationId: 9901,
            unreadCount: 2,
            lastMessageAt: "2026-06-10 10:00:00",
            viewerCanPost: true,
            createdAt: "2026-06-10 09:00:00",
            updatedAt: "2026-06-10 10:00:00",
          },
        ]
      : [
          {
            id: 90,
            slug: "joined-room",
            name: "Joined Room",
            joinedByMe: true,
          },
        ];

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, data }),
    });
  });
  await mockAuthenticatedChat(page, { conversations: [] });
  await page.goto("/chat");

  await expect(page.getByRole("heading", { name: "Chat", exact: true })).toBeVisible();
  await expect(page.getByText("No chats yet")).toBeVisible();
  await expect(page.getByTestId("chat-conversation-list")).toHaveCount(0);
  await expect(page.getByTestId("chat-message-composer")).toHaveCount(0);
  await expect(page.getByTestId("chat-room-summary")).toHaveCount(0);
  await page.waitForLoadState("networkidle");
  expect(roomRequestCount).toBe(0);
});

test("chat moot picker shows empty state when the user has no moots", async ({
  page,
}) => {
  await mockAuthenticatedChat(page, { conversations: [], moots: [] });
  await page.goto("/chat");

  await page.getByTestId("chat-new-chat-button").click();

  await expect(page.getByTestId("chat-moot-picker")).toBeVisible();
  await expect(page.getByTestId("chat-moot-empty")).toContainText(
    "Follow each other to chat.",
  );
});

test("chat moot picker lists only eligible mocked moots", async ({ page }) => {
  await mockAuthenticatedChat(page, {
    conversations: [],
    moots: [mockMoot],
  });
  await page.goto("/chat");

  await page.getByTestId("chat-new-chat-button").click();

  await expect(page.getByTestId("chat-moot-list")).toContainText("Moot Friend");
  await expect(page.getByTestId("chat-moot-list")).toContainText("@mootfriend");
  await expect(
    page
      .getByTestId("chat-moot-list")
      .getByRole("link", { name: "Moot Friend's profile" }),
  ).toHaveAttribute("href", "/@mootfriend");
  await expect(page.getByTestId("chat-moot-list")).not.toContainText("Not A Moot");
});

test("selecting a moot opens or creates the direct conversation", async ({
  page,
}) => {
  let createBody: unknown;
  await mockAuthenticatedChat(page, {
    conversations: [],
    moots: [mockMoot],
    onCreateConversation: async (body) => {
      createBody = body;
      return mockConversation;
    },
  });
  await page.goto("/chat");

  await page.getByTestId("chat-new-chat-button").click();
  await page.getByTestId("chat-moot-option-mootfriend").click();

  await expect(page.getByTestId("chat-moot-picker")).toHaveCount(0);
  await expect(page.getByTestId("chat-conversation-list")).toContainText("Moot Friend");
  await expect(page.getByTestId("chat-message-list")).toContainText("hello from a moot");
  expect(createBody).toMatchObject({ targetUserId: 2 });
});

test("conversation member can report an individual chat message", async ({ page }) => {
  let reportPayload: Record<string, unknown> | undefined;
  await mockAuthenticatedChat(page);
  await page.route("**/api/reports", async (route) => {
    reportPayload = route.request().postDataJSON() as Record<string, unknown>;
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: {
          id: 7,
          ...reportPayload,
          reason: reportPayload.category,
          status: "open",
          createdAt: "2026-06-10 10:00:00",
          updatedAt: "2026-06-10 10:00:00",
          reviewedAt: null,
          actionTaken: null,
          moderatorNote: null,
          reporter: null,
          reportedUser: null,
          reviewedBy: null,
          post: null,
          profile: null,
          room: null,
          message: null,
          actionCount: 0,
        },
      }),
    });
  });

  await page.goto("/chat");
  await expect(page.getByTestId("chat-message-list")).toContainText(
    "hello from a moot",
  );
  const reportTrigger = page.getByRole("button", { name: "Report message" });
  await expect(reportTrigger).toHaveAttribute("title", "Report message");
  await reportTrigger.click();
  const reportDialog = page.getByRole("dialog", { name: "Report message" });

  await expect(reportDialog).toContainText("reports this chat message");
  await reportDialog.getByLabel("What's wrong?").selectOption("harassment");
  await reportDialog.getByRole("button", { name: "Report", exact: true }).click();

  await expect(page.getByText("Report sent.")).toBeVisible();
  expect(reportPayload).toMatchObject({
    targetType: "message",
    targetId: 100,
    reportedUserId: 2,
    category: "harassment",
  });
});

test("authenticated conversations API requires login", async ({ page }) => {
  test.skip(
    process.env.THIA_BASE_URL === undefined,
    "Set THIA_BASE_URL to run API-backed chat smoke tests against a working API.",
  );

  await page.goto("/");

  const response = await page.evaluate(async () => {
    const result = await fetch("/api/chat/conversations", {
      credentials: "include",
      headers: { Accept: "application/json" },
    });
    const json = (await result.json()) as ApiEnvelope<unknown>;

    return {
      ...json,
      status: result.status,
    };
  });

  expect(response.ok).toBe(false);
  expect(response.status).toBe(401);
});

test("authenticated chat moots API requires login", async ({ page }) => {
  test.skip(
    process.env.THIA_BASE_URL === undefined,
    "Set THIA_BASE_URL to run API-backed chat smoke tests against a working API.",
  );

  await page.goto("/");

  const response = await page.evaluate(async () => {
    const result = await fetch("/api/chat/moots", {
      credentials: "include",
      headers: { Accept: "application/json" },
    });
    const json = (await result.json()) as ApiEnvelope<unknown>;

    return {
      ...json,
      status: result.status,
    };
  });

  expect(response.ok).toBe(false);
  expect(response.status).toBe(401);
});

test("non-member cannot read a conversation", async ({ page }) => {
  test.skip(
    process.env.THIA_BASE_URL === undefined,
    "Set THIA_BASE_URL to run API-backed chat smoke tests against a working API.",
  );
  skipWithoutCredentials();

  const conversationId = process.env.THIA_NON_MEMBER_CONVERSATION_ID;
  test.skip(
    !conversationId,
    "Set THIA_NON_MEMBER_CONVERSATION_ID to a conversation the test user does not belong to.",
  );

  await loginWithEnv(page);

  const response = await page.evaluate(async (id) => {
    const result = await fetch(`/api/chat/conversations/${id}/messages`, {
      credentials: "include",
      headers: { Accept: "application/json" },
    });
    const json = (await result.json()) as ApiEnvelope<unknown>;

    return {
      ...json,
      status: result.status,
    };
  }, conversationId);

  expect(response.ok).toBe(false);
  expect(response.status).toBe(404);
});

test("moots-only conversation creation works with configured test users", async ({
  page,
}) => {
  test.skip(
    process.env.THIA_BASE_URL === undefined,
    "Set THIA_BASE_URL to run API-backed chat smoke tests against a working API.",
  );
  skipWithoutCredentials();

  const mootHandle = process.env.THIA_MOOT_TARGET_HANDLE?.replace(/^@/, "");
  test.skip(
    !mootHandle,
    "Set THIA_MOOT_TARGET_HANDLE to a mutual-follow profile for the test account.",
  );

  const session = await loginWithEnv(page);
  const csrfToken = session.data?.csrfToken;
  expect(csrfToken).toEqual(expect.any(String));

  const response = await page.evaluate(
    async ({ csrf, handle }) => {
      const result = await fetch("/api/chat/conversations", {
        method: "POST",
        credentials: "include",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "X-CSRF-Token": csrf,
        },
        body: JSON.stringify({ targetHandle: handle }),
      });
      const json = (await result.json()) as ApiEnvelope<{
        id: number;
        type: string;
        otherParticipant: { handle: string };
      }>;

      return {
        ...json,
        status: result.status,
      };
    },
    { csrf: csrfToken, handle: mootHandle },
  );

  expect(response.ok).toBe(true);
  expect(response.status).toBe(201);
  expect(response.data).toMatchObject({
    type: "direct",
    otherParticipant: { handle: mootHandle?.toLowerCase() },
  });
});

async function expectChatReset(page: Page) {
  await page.goto("/chat");
  await expect(page).toHaveURL(/\/chat$/);
  await expect(page.getByTestId("chat-conversation-row-10")).toBeVisible();
}

async function expectOpenFromConversationTarget(
  page: Page,
  target: Locator,
  conversationId = 10,
) {
  await expectChatReset(page);
  await clickLocatorCenter(page, target);
  await expect(page).toHaveURL(new RegExp(`/chat\\?conversation=${conversationId}$`));
}

async function clickLocatorCenter(page: Page, locator: Locator) {
  const box = await locator.boundingBox();

  if (!box) {
    throw new Error("Conversation target did not render.");
  }

  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
}

async function mockAnonymousShell(page: Page) {
  await page.route("**/api/auth/me", async (route) => {
    await route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({ ok: false, error: "Unauthenticated." }),
    });
  });
}

type MockAuthenticatedChatOptions = {
  conversations?: typeof mockConversation[];
  messageResponseDelays?: Record<number, Promise<void>>;
  moots?: typeof mockMoot[];
  onCreateConversation?: (body: unknown) => Promise<typeof mockConversation>;
  onSendMessage?: (body: unknown) => Promise<void>;
};

async function mockAuthenticatedChat(
  page: Page,
  options: MockAuthenticatedChatOptions = {},
) {
  let conversations = options.conversations ?? [mockConversation];
  const moots = options.moots ?? [mockMoot];
  const currentUser = {
    id: 1,
    handle: "member",
    email: "member@example.test",
    role: "member",
    status: "active",
    displayName: "Member",
    initials: "M",
    aura: "glow",
    avatarUrl: null,
  };
  const messageStore = new Map<number, Array<Record<string, unknown>>>();

  function messagesForConversation(conversation: typeof mockConversation) {
    const existing = messageStore.get(conversation.id);

    if (existing) {
      return existing;
    }

    const initialMessages = [
      {
        id: conversation.lastMessage?.id ?? 100 + conversation.id,
        conversationId: conversation.id,
        body: conversation.lastMessage?.body ?? "hello from a moot",
        bodyEntities:
          (conversation.lastMessage as { bodyEntities?: unknown } | null)
            ?.bodyEntities ?? [],
        attachments:
          (conversation.lastMessage as { attachments?: unknown } | null)
            ?.attachments ?? [],
        deletedAt: null,
        createdAt: "2026-06-10 10:00:00",
        sender: conversation.otherParticipant,
      },
    ];

    messageStore.set(conversation.id, initialMessages);
    return initialMessages;
  }

  await page.route("**/api/auth/me", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: {
          user: {
            ...currentUser,
          },
          profile: {
            displayName: "Member",
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
      body: JSON.stringify({
        ok: true,
        data: {
          notifications: [],
          unreadCount: 0,
        },
      }),
    });
  });

  await mockProfileRoutes(page, mockConversation.otherParticipant);

  await page.route("**/api/chat/conversations", async (route) => {
    if (route.request().method() === "POST") {
      const requestBody = route.request().postDataJSON();
      const conversation = options.onCreateConversation
        ? await options.onCreateConversation(requestBody)
        : mockConversation;
      conversations = upsertMockConversation(conversations, conversation);

      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          data: conversation,
        }),
      });
      return;
    }

    if (route.request().method() !== "GET") {
      await route.fallback();
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: conversations,
      }),
    });
  });

  await page.route("**/api/chat/moots", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: moots,
      }),
    });
  });

  await page.route("**/api/chat/conversations/*/messages", async (route) => {
    const conversationId = chatConversationIdFromUrl(route.request().url());
    const conversation =
      conversations.find((item) => item.id === conversationId) ?? mockConversation;
    const messages = messagesForConversation(conversation);

    if (route.request().method() === "POST") {
      const requestBody = route.request().postDataJSON() as {
        attachments?: unknown;
        body?: unknown;
      };
      await options.onSendMessage?.(requestBody);
      const attachments = chatAttachmentsFromRequest(requestBody.attachments);
      const message = {
        id: 900 + messages.length,
        conversationId: conversation.id,
        body: typeof requestBody.body === "string" ? requestBody.body : "",
        bodyEntities: [],
        attachments,
        deletedAt: null,
        createdAt: "2026-06-10 10:05:00",
        sender: currentUser,
      };

      messages.push(message);
      conversations = conversations.map((item) =>
        item.id === conversation.id
          ? {
              ...item,
              lastMessage: {
                id: message.id,
                body: message.body,
                createdAt: message.createdAt,
                sender: message.sender,
              },
              lastMessageAt: message.createdAt,
            }
          : item,
      );

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

    if (route.request().method() !== "GET") {
      await route.fallback();
      return;
    }

    await options.messageResponseDelays?.[conversationId];

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: {
          conversation,
          messages,
        },
      }),
    });
  });

  await page.route("**/api/chat/conversations/*/read", async (route) => {
    const conversationId = chatConversationIdFromUrl(route.request().url());

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: {
          conversationId,
          readAt: "2026-06-10 10:00:01",
        },
      }),
    });
  });
}

function chatConversationIdFromUrl(url: string): number {
  const match = new URL(url).pathname.match(/\/chat\/conversations\/(\d+)\//);

  return match ? Number(match[1]) : 10;
}

async function mockGifSearch(
  page: Page,
  result: { available: boolean; items: unknown[] },
) {
  await page.route("https://media.klipy.example/**", async (route) => {
    await route.fulfill({
      contentType: "image/gif",
      body: Buffer.from(transparentGifBase64, "base64"),
    });
  });

  await page.route("**/api/gifs/trending**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: {
          available: result.available,
          provider: "klipy",
          query: null,
          next: null,
          items: result.items,
        },
      }),
    });
  });

  await page.route("**/api/gifs/search**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: {
          available: result.available,
          provider: "klipy",
          query: "wave",
          next: null,
          items: result.items,
        },
      }),
    });
  });
}

function chatAttachmentsFromRequest(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((attachment) => {
    if (!plainRecord(attachment) || attachment.type !== "gif") {
      return [];
    }

    const card = plainRecord(attachment.card) ? attachment.card : null;

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
          mime: "image/gif",
          width: numberOrNull(attachment.width),
          height: numberOrNull(attachment.height),
          sourceUrl: stringValue(attachment.sourceUrl) || null,
          title: stringValue(card?.title) || "KLIPY GIF",
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
  const number = Number(value);

  return Number.isFinite(number) ? number : null;
}

async function mockProfileRoutes(
  page: Page,
  user: typeof mockConversation.otherParticipant,
) {
  await page.route(`**/api/profiles/${user.handle}`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, data: makeProfile(user) }),
    });
  });

  for (const suffix of [
    "posts",
    "replies",
    "reblogs",
    "rooms",
    "followers",
    "following",
    "modules",
  ]) {
    await page.route(`**/api/profiles/${user.handle}/${suffix}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, data: [] }),
      });
    });
  }

  await page.route(`**/api/profiles/${user.handle}/badges`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: { badges: [], featuredBadges: [] },
      }),
    });
  });
}

function makeProfile(user: typeof mockConversation.otherParticipant) {
  return {
    user,
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
    isFollowing: true,
    isFollowedBy: true,
    isMoot: true,
    blockedByMe: false,
    mutedByMe: false,
    createdAt: "2026-06-10 09:00:00",
    updatedAt: "2026-06-10 09:00:00",
  };
}

function richMentionEntity(
  body: string,
  mention: string,
  user = mockConversation.otherParticipant,
) {
  return {
    type: "mention",
    start: body.indexOf(mention),
    length: mention.length,
    text: mention,
    mention: {
      handle: user.handle,
      user,
    },
  };
}

function richLinkEntity(body: string, url: string, card: Record<string, unknown>) {
  return {
    type: "link",
    start: body.indexOf(url),
    length: url.length,
    text: url,
    link: {
      url,
      card,
    },
  };
}

function richWebsiteCard(url: string, title: string) {
  return {
    provider: "website",
    resourceType: "url",
    resourceId: title.toLowerCase().replace(/\s+/g, "-"),
    resourceKey: `website:url:${title.toLowerCase().replace(/\s+/g, "-")}`,
    sourceUrl: url,
    metadata: {
      title,
      subtitle: new URL(url).hostname,
      description: "A safe server-rendered link card.",
      imageUrl: null,
      live: false,
      stats: {},
    },
    embed: null,
    apiBacked: true,
    fetchedAt: "2026-06-10T10:00:00Z",
    expiresAt: null,
    staleAt: null,
    stale: false,
    lastError: null,
  };
}

function richYouTubeCard(url: string) {
  return {
    provider: "youtube",
    resourceType: "video",
    resourceId: "abc123",
    resourceKey: "youtube:video:abc123",
    sourceUrl: url,
    metadata: {
      title: "YouTube demo",
      subtitle: "YouTube",
      description: null,
      imageUrl: null,
      live: false,
      stats: {},
    },
    embed: {
      type: "iframe",
      src: "https://www.youtube-nocookie.com/embed/abc123",
      title: "YouTube demo",
      height: 220,
      allow:
        "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share",
    },
    apiBacked: false,
    fetchedAt: "2026-06-10T10:00:00Z",
    expiresAt: null,
    staleAt: null,
    stale: false,
    lastError: null,
  };
}

const mockConversation = {
  id: 10,
  type: "direct",
  createdAt: "2026-06-10 09:00:00",
  updatedAt: null,
  lastMessageAt: "2026-06-10 10:00:00",
  lastReadAt: null,
  mutedAt: null,
  archivedAt: null,
  unreadCount: 1,
  otherParticipant: {
    id: 2,
    handle: "mootfriend",
    displayName: "Moot Friend",
    initials: "MF",
    aura: "frost",
    avatarUrl: null,
  },
  lastMessage: {
    id: 100,
    body: "hello from a moot",
    createdAt: "2026-06-10 10:00:00",
    sender: {
      id: 2,
      handle: "mootfriend",
      displayName: "Moot Friend",
      initials: "MF",
      aura: "frost",
      avatarUrl: null,
    },
  },
};

const mockUnreadConversation = {
  ...mockConversation,
  id: 11,
  lastMessageAt: "2026-06-10 09:30:00",
  unreadCount: 3,
  otherParticipant: {
    id: 3,
    handle: "unreadmoot",
    displayName: "Unread Moot",
    initials: "UM",
    aura: "tide",
    avatarUrl: null,
  },
  lastMessage: {
    id: 110,
    body: "new unread note",
    createdAt: "2026-06-10 09:30:00",
    sender: {
      id: 3,
      handle: "unreadmoot",
      displayName: "Unread Moot",
      initials: "UM",
      aura: "tide",
      avatarUrl: null,
    },
  },
};

const mockGifResult = {
  id: "gif-1",
  title: "Wave",
  provider: "klipy",
  resourceType: "gif",
  resourceId: "gif-1",
  resourceKey: "klipy:gif-1",
  url: "https://media.klipy.example/gif-1.gif",
  previewUrl: "https://media.klipy.example/gif-1-small.gif",
  mime: "image/gif",
  width: 320,
  height: 180,
  sourceUrl: "https://klipy.example/gif-1",
  card: {
    provider: "klipy",
    title: "Wave",
    previewUrl: "https://media.klipy.example/gif-1-small.gif",
    url: "https://media.klipy.example/gif-1.gif",
    sourceUrl: "https://klipy.example/gif-1",
    width: 320,
    height: 180,
  },
};

const transparentGifBase64 = "R0lGODlhAQABAAAAACwAAAAAAQABAAA=";

const mockMoot = {
  id: 2,
  handle: "mootfriend",
  displayName: "Moot Friend",
  initials: "MF",
  aura: "frost",
  avatarUrl: null,
};

function upsertMockConversation(
  conversations: typeof mockConversation[],
  conversation: typeof mockConversation,
): typeof mockConversation[] {
  const exists = conversations.some((item) => item.id === conversation.id);

  return exists
    ? conversations.map((item) => (item.id === conversation.id ? conversation : item))
    : [conversation, ...conversations];
}
