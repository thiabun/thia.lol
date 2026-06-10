import { readFileSync } from "node:fs";
import { expect, type Page, test } from "@playwright/test";
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
  await expect(page.getByText("Sign in to see your messages.")).toBeVisible();
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
  await expect(page.getByTestId("chat-message-list")).toContainText("hello from a moot");
  await expect(page.getByTestId("chat-message-composer")).toBeVisible();
  await expect(page.getByPlaceholder("Write a message")).toBeVisible();
  await expect(page.getByRole("button", { name: "Send" })).toBeDisabled();
});

test("chat moot picker shows empty state when the user has no moots", async ({
  page,
}) => {
  await mockAuthenticatedChat(page, { conversations: [], moots: [] });
  await page.goto("/chat");

  await page.getByTestId("chat-new-chat-button").click();

  await expect(page.getByTestId("chat-moot-picker")).toBeVisible();
  await expect(page.getByTestId("chat-moot-empty")).toContainText(
    "Chats are moots-only",
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

test("authenticated conversations API requires login", async ({ page }) => {
  test.skip(
    process.env.THIA_BASE_URL === undefined,
    "Set THIA_BASE_URL to run API-backed chat smoke tests against a working API.",
  );

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

test("chat moots endpoint is authenticated and reciprocal-follow only by inspection", async () => {
  const chatApi = readFileSync("api/chat.php", "utf8");
  const mootsIndexStart = chatApi.indexOf("function chat_moots_index()");
  const mootsIndexEnd = chatApi.indexOf("function chat_conversations_create()");
  const mootsIndex = chatApi.slice(mootsIndexStart, mootsIndexEnd);

  expect(mootsIndexStart).toBeGreaterThan(-1);
  expect(mootsIndex).toContain("require_authenticated_session()");
  expect(mootsIndex).toContain("require_chat_follows_table()");
  expect(mootsIndex).toContain("INNER JOIN user_follows reciprocal");
  expect(mootsIndex).toContain("reciprocal.follower_id = mine.following_id");
  expect(mootsIndex).toContain("reciprocal.following_id = mine.follower_id");
  expect(mootsIndex).toContain("u.status = 'active'");

  expect(chatApi).toContain("if (!chat_users_are_moots($viewerUserId, $targetUserId))");
  expect(chatApi).toContain("json_error('Follow each other to chat.', 403)");
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

async function mockAnonymousShell(page: Page) {
  await page.route("**/api/auth/me", async (route) => {
    await route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({ ok: false, error: "Unauthenticated." }),
    });
  });

  await page.route("**/api/rooms", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, data: [] }),
    });
  });
}

type MockAuthenticatedChatOptions = {
  conversations?: typeof mockConversation[];
  moots?: typeof mockMoot[];
  onCreateConversation?: (body: unknown) => Promise<typeof mockConversation>;
};

async function mockAuthenticatedChat(
  page: Page,
  options: MockAuthenticatedChatOptions = {},
) {
  let conversations = options.conversations ?? [mockConversation];
  const moots = options.moots ?? [mockMoot];

  await page.route("**/api/auth/me", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: {
          user: {
            id: 1,
            handle: "member",
            email: "member@example.test",
            role: "member",
            status: "active",
            displayName: "Member",
            avatarUrl: null,
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

  await page.route("**/api/rooms", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, data: [] }),
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

  await page.route("**/api/chat/conversations/10/messages", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: {
          conversation: mockConversation,
          messages: [
            {
              id: 100,
              conversationId: 10,
              body: "hello from a moot",
              deletedAt: null,
              createdAt: "2026-06-10 10:00:00",
              sender: mockConversation.otherParticipant,
            },
          ],
        },
      }),
    });
  });

  await page.route("**/api/chat/conversations/10/read", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: {
          conversationId: 10,
          readAt: "2026-06-10 10:00:01",
        },
      }),
    });
  });
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
