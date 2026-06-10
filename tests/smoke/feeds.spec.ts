import { expect, test, type Page } from "@playwright/test";
import { loginWithEnv, skipWithoutCredentials } from "../helpers/auth";

test("Home loads the feed empty state", async ({ page }) => {
  await mockCommonApi(page);
  await page.route("**/api/feed/home", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ ok: true, data: { posts: [], personalized: false } }),
    }),
  );

  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Home" })).toBeVisible();
  await expect(page.getByText("No posts yet").first()).toBeVisible();
});

test("Discover loads the feed empty state without unbacked sections", async ({
  page,
}) => {
  await mockCommonApi(page);
  await page.route("**/api/feed/discover", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: { posts: [], activeRooms: [], peopleToWatch: [] },
      }),
    }),
  );

  await page.goto("/discover");

  await expect(page.getByRole("heading", { name: "Discover" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Rising" })).toBeVisible();
  await expect(page.getByText("No posts yet").first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Active rooms" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "People to watch" })).toHaveCount(0);
});

test("Discover renders primary sections only when backed by data", async ({
  page,
}) => {
  await mockCommonApi(page);
  await page.route("**/api/feed/discover", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: {
          posts: [],
          activeRooms: [
            {
              id: 1,
              slug: "general",
              name: "General",
              summary: "Open conversation.",
              mood: "sunveil",
              members: 0,
              live: false,
              accent: "var(--accent-warm)",
              visibility: "public",
              postCount: 2,
              latestActivityAt: "2026-06-10 10:00:00",
              createdAt: "2026-06-10 09:00:00",
              updatedAt: "2026-06-10 10:00:00",
            },
          ],
          peopleToWatch: [
            {
              handle: "alex",
              displayName: "Alex",
              initials: "A",
              avatarUrl: null,
              bioSnippet: "Writes public posts.",
              isFollowing: false,
              isMoot: false,
              postCount: 3,
              followerCount: 1,
            },
          ],
        },
      }),
    }),
  );

  await page.goto("/discover");

  await expect(page.getByRole("heading", { name: "Active rooms" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "People to watch" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "General" })).toBeVisible();
  await expect(page.getByText("@alex")).toBeVisible();
});

test("PostCard reblog action updates count and state", async ({ page }) => {
  await mockAuthenticatedApi(page);
  let reblogged = false;
  let reblogCount = 2;

  await page.route("**/api/feed/home", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: {
          posts: [makePost({ reblogCount, rebloggedByMe: reblogged })],
          personalized: true,
        },
      }),
    }),
  );
  await page.route("**/api/posts/42/reblog", async (route) => {
    if (route.request().method() === "POST") {
      reblogged = true;
      reblogCount = 3;
    } else if (route.request().method() === "DELETE") {
      reblogged = false;
      reblogCount = 2;
    }

    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: {
          postId: 42,
          reblogCount,
          rebloggedByMe: reblogged,
          rebloggedByCurrentUser: reblogged,
        },
      }),
    });
  });

  await page.goto("/");

  await expect(page.getByRole("button", { name: /Reblog this post/ })).toBeEnabled();
  await page.getByRole("button", { name: /Reblog this post/ }).click();
  await expect(page.getByRole("button", { name: /Undo reblog/ })).toContainText(
    "Reblogged",
  );
  await expect(page.getByRole("button", { name: /Undo reblog/ })).toContainText("3");

  await page.getByRole("button", { name: /Undo reblog/ }).click();
  await expect(page.getByRole("button", { name: /Reblog this post/ })).toContainText(
    "Reblog",
  );
  await expect(page.getByRole("button", { name: /Reblog this post/ })).toContainText(
    "2",
  );
});

test("Profile Reblogs tab renders API-backed reblogs", async ({ page }) => {
  await mockAuthenticatedApi(page);
  await page.route("**/api/profiles/alex", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: {
          user: {
            id: 2,
            handle: "alex",
            displayName: "Alex",
            initials: "A",
            aura: "frost",
            avatarUrl: null,
          },
          bio: "Writes public posts.",
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
        },
      }),
    }),
  );
  await page.route("**/api/profiles/alex/posts", (route) =>
    route.fulfill({ contentType: "application/json", body: JSON.stringify({ ok: true, data: [] }) }),
  );
  await page.route("**/api/profiles/alex/replies", (route) =>
    route.fulfill({ contentType: "application/json", body: JSON.stringify({ ok: true, data: [] }) }),
  );
  await page.route("**/api/profiles/alex/reblogs", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: [
          makePost({
            body: "A post Alex shared.",
            rebloggedBy: {
              id: 2,
              handle: "alex",
              displayName: "Alex",
              initials: "A",
              aura: "frost",
              avatarUrl: null,
            },
            rebloggedAt: "2026-06-10 10:00:00",
          }),
        ],
      }),
    }),
  );
  await page.route("**/api/profiles/alex/rooms", (route) =>
    route.fulfill({ contentType: "application/json", body: JSON.stringify({ ok: true, data: [] }) }),
  );
  await page.route("**/api/profiles/alex/followers", (route) =>
    route.fulfill({ contentType: "application/json", body: JSON.stringify({ ok: true, data: [] }) }),
  );
  await page.route("**/api/profiles/alex/following", (route) =>
    route.fulfill({ contentType: "application/json", body: JSON.stringify({ ok: true, data: [] }) }),
  );

  await page.goto("/@alex");
  await page.getByRole("tab", { name: /Reblogs/ }).click();

  await expect(page.getByText("@alex reblogged")).toBeVisible();
  await expect(page.getByText("A post Alex shared.")).toBeVisible();
});

test("reblog and undo work against the API", async ({ page }) => {
  skipWithoutCredentials();

  const session = await loginWithEnv(page);
  const userId = session.data?.user?.id;
  const csrfToken = session.data?.csrfToken;

  expect(userId).toEqual(expect.any(Number));
  expect(csrfToken).toEqual(expect.any(String));

  const feed = await page.evaluate(async () => {
    const response = await fetch("/api/feed/home", {
      credentials: "include",
      headers: { Accept: "application/json" },
    });

    return (await response.json()) as {
      ok: boolean;
      data?: {
        posts: Array<{
          id: number;
          author: { id: number };
          rebloggedByMe?: boolean;
          rebloggedByCurrentUser?: boolean;
        }>;
      };
    };
  });

  expect(feed.ok).toBe(true);

  const target = feed.data?.posts.find((post) => post.author.id !== userId);

  test.skip(!target, "A public post by another user is required for reblog smoke.");

  const wasReblogged =
    target?.rebloggedByMe ?? target?.rebloggedByCurrentUser ?? false;

  async function mutateReblog(method: "POST" | "DELETE") {
    return page.evaluate(
      async ({ postId, requestMethod, token }) => {
        const response = await fetch(`/api/posts/${postId}/reblog`, {
          method: requestMethod,
          credentials: "include",
          headers: {
            Accept: "application/json",
            "X-CSRF-Token": token,
          },
        });

        return {
          status: response.status,
          body: (await response.json()) as {
            ok: boolean;
            data?: {
              reblogCount: number;
              rebloggedByMe?: boolean;
              rebloggedByCurrentUser?: boolean;
            };
            error?: string;
          },
        };
      },
      {
        postId: target!.id,
        requestMethod: method,
        token: csrfToken!,
      },
    );
  }

  const first = await mutateReblog(wasReblogged ? "DELETE" : "POST");
  expect(first.status).toBe(200);
  expect(first.body.ok).toBe(true);
  expect(
    first.body.data?.rebloggedByMe ??
      first.body.data?.rebloggedByCurrentUser,
  ).toBe(!wasReblogged);

  const second = await mutateReblog(wasReblogged ? "POST" : "DELETE");
  expect(second.status).toBe(200);
  expect(second.body.ok).toBe(true);
  expect(
    second.body.data?.rebloggedByMe ??
      second.body.data?.rebloggedByCurrentUser,
  ).toBe(wasReblogged);
});

async function mockCommonApi(page: Page) {
  await page.route("**/api/auth/me", (route) =>
    route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({ ok: false, error: "Not authenticated." }),
    }),
  );

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
          publicPosts: 0,
          activeUsers: 0,
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

async function mockAuthenticatedApi(page: Page) {
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
    }),
  );

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

function makePost(overrides: Record<string, unknown> = {}) {
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
    ...overrides,
  };
}
