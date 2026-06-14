import { expect, test, type Locator, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
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

test("API reply queries require visible ancestors by inspection", async () => {
  const readApi = readFileSync("api/read.php", "utf8");
  const postsApi = readFileSync("api/posts.php", "utf8");

  expect(readApi).toContain("function post_ancestor_visibility_sql");
  expect(readApi).toContain("post_ancestor_visibility_sql('p')");
  expect(readApi).toContain("post_ancestor_visibility_sql('profile_replies')");
  expect(readApi).toContain("SELECT profile_replies.author_id AS author_id, COUNT(*) AS reply_count");
  expect(readApi).toContain("GROUP BY profile_replies.author_id");
  expect(readApi).not.toContain("SELECT author_id, COUNT(*) AS reply_count");
  expect(readApi).toContain("stat_posts.parent_id IS NULL");
  expect(postsApi).toContain("validate_post_media_url($body['mediaUrl']");
  expect(postsApi).toContain("post_ancestor_visibility_sql('p')");
  expect(postsApi).toContain("post_ancestor_visibility_sql('reply_posts')");
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

  await expect(
    page.getByRole("heading", { exact: true, name: "Discover" }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Rising" })).toBeVisible();
  await expect(page.getByText("No posts yet").first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Active rooms" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "People" })).toHaveCount(0);
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
  await expect(page.getByRole("heading", { name: "People" })).toBeVisible();
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
  await expect(page.getByRole("button", { name: /Undo reblog/ })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByRole("button", { name: /Undo reblog/ })).toContainText("3");

  await page.getByRole("button", { name: /Undo reblog/ }).click();
  await expect(page.getByRole("button", { name: /Reblog this post/ })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  await expect(page.getByRole("button", { name: /Reblog this post/ })).toContainText(
    "2",
  );
});

test("PostCard author avatar, name, and handle navigate to profile", async ({
  page,
}) => {
  await mockAuthenticatedApi(page);
  await mockProfileRoutes(page, "alex");
  await page.route("**/api/feed/home", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: { posts: [makePost()], personalized: true },
      }),
    }),
  );

  await page.goto("/");

  const post = page.locator("article").first();
  await expect(post.getByRole("link", { name: "Alex's profile" })).toHaveAttribute(
    "href",
    "/@alex",
  );
  await expect(post.getByRole("link", { name: "Alex", exact: true })).toHaveAttribute(
    "href",
    "/@alex",
  );
  await expect(post.getByRole("link", { name: "@alex" })).toHaveAttribute(
    "href",
    "/@alex",
  );

  await post.getByRole("link", { name: "Alex", exact: true }).click();
  await expect(page).toHaveURL(/\/@alex$/);
  await expect(page.getByRole("heading", { name: "Alex" })).toBeVisible();
});

test("Profile Feed renders API-backed reblogs", async ({ page }) => {
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
  await page.route("**/api/profiles/alex/badges", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: { badges: [], featuredBadges: [] },
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

  await expect(page.getByText("@alex reblogged")).toBeVisible();
  await expect(page.getByText("A post Alex shared.")).toBeVisible();
});

test("post body opens thread while controls keep their own behavior", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await mockAuthenticatedApi(page);
  let likeCalled = false;
  let reblogCalled = false;

  await page.route("**/api/feed/home", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: {
          posts: [
            makePost({
              commentCount: 1,
              mediaUrl: "/uploads/thread-media.webp",
              room: {
                id: 1,
                slug: "general",
                name: "General",
                accent: "var(--accent-frost)",
              },
            }),
          ],
          personalized: true,
        },
      }),
    }),
  );
  await page.route("**/api/posts/42/replies", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: [makePost({ id: 50, parentId: 42, body: "Thread reply." })],
      }),
    }),
  );
  await page.route("**/api/posts/42/like", async (route) => {
    likeCalled = true;
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: { postId: 42, likeCount: 1, likedByCurrentUser: true },
      }),
    });
  });
  await page.route("**/api/posts/42/reblog", async (route) => {
    reblogCalled = true;
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: {
          postId: 42,
          reblogCount: 1,
          rebloggedByMe: true,
          rebloggedByCurrentUser: true,
        },
      }),
    });
  });

  await page.goto("/");
  const post = page.getByTestId("post-card-open-thread").first();
  await expect(post).toBeVisible();
  const bodyOpenTarget = post.getByTestId("post-body-open-thread");
  await expect(bodyOpenTarget).toBeVisible();
  await expect(bodyOpenTarget).toHaveJSProperty("tagName", "DIV");
  await expect(bodyOpenTarget).toHaveAttribute("class", "mt-4 block w-full text-left");
  await expect(bodyOpenTarget).not.toHaveAttribute(
    "class",
    /hover:|focus-visible:|rounded|ring|shadow|border|bg-/,
  );
  await expect(bodyOpenTarget).toHaveCSS("width", /\d+px/);
  await expect(bodyOpenTarget.locator("img")).toBeVisible();

  const postBox = await post.boundingBox();
  const bodyBox = await bodyOpenTarget.boundingBox();
  expect(postBox).not.toBeNull();
  expect(bodyBox).not.toBeNull();
  expect(bodyBox!.width).toBeGreaterThan(postBox!.width * 0.8);

  await page.mouse.click(postBox!.x + postBox!.width - 24, postBox!.y + 24);

  const dialog = page.getByTestId("thread-modal");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByTestId("thread-conversation")).toBeVisible();
  await expect(dialog.getByTestId("thread-root-post")).toBeVisible();
  await expect(dialog.getByTestId("thread-reply-item")).toHaveCount(1);
  await expect(dialog.getByText("Thread reply.")).toBeVisible();

  const box = await dialog.boundingBox();
  expect(box?.width).toBeGreaterThan(850);

  await dialog.getByRole("button", { name: "Close thread" }).click();
  await expect(dialog).toBeHidden();

  await bodyOpenTarget.click();
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Close thread" }).click();
  await expect(dialog).toBeHidden();

  await bodyOpenTarget.locator("img").click();
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Close thread" }).click();
  await expect(dialog).toBeHidden();

  await page.getByRole("button", { name: /Open replies/ }).first().click();
  await expect(dialog).toBeVisible();
  await expect(dialog.getByTestId("reply-composer")).toBeVisible();
  await expect(page.getByTestId("thread-modal")).toHaveCount(1);
  await dialog.getByRole("button", { name: "Close thread" }).click();
  await expect(dialog).toBeHidden();

  await page.getByRole("button", { name: /Like this post/ }).first().click();
  await expect(page.getByTestId("thread-modal")).toHaveCount(0);
  expect(likeCalled).toBe(true);

  await page.getByRole("button", { name: /Reblog this post/ }).first().click();
  await expect(page.getByTestId("thread-modal")).toHaveCount(0);
  expect(reblogCalled).toBe(true);
});

test("post body and media hover stay visually flat in Sunveil and Frostveil", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await mockAuthenticatedApi(page);

  await page.route("**/api/feed/home", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: {
          posts: [makePost({ mediaUrl: "/uploads/thread-media.webp" })],
          personalized: true,
        },
      }),
    }),
  );
  await page.route("**/api/posts/42/replies", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ ok: true, data: [] }),
    }),
  );

  for (const theme of ["sunveil", "frostveil"] as const) {
    await page.goto("/");
    await page.evaluate((nextTheme) => {
      window.localStorage.setItem("thia.lol.theme", nextTheme);
      document.documentElement.dataset.theme = nextTheme;
      document.documentElement.style.colorScheme =
        nextTheme === "frostveil" ? "dark" : "light";
    }, theme);

    const post = page.getByTestId("post-card-open-thread").first();
    const bodyOpenTarget = post.getByTestId("post-body-open-thread");
    const mediaImage = bodyOpenTarget.locator("img");

    await expect(bodyOpenTarget).toBeVisible();
    await expect(mediaImage).toBeVisible();
    await expectHoverToKeepSurfaceFlat(bodyOpenTarget);
    await expectHoverToKeepSurfaceFlat(mediaImage);
  }
});

test("post card open target supports keyboard activation", async ({ page }) => {
  await mockAuthenticatedApi(page);

  await page.route("**/api/feed/home", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: { posts: [makePost()], personalized: true },
      }),
    }),
  );
  await page.route("**/api/posts/42/replies", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ ok: true, data: [] }),
    }),
  );

  await page.goto("/");
  await page.getByTestId("post-card-open-thread").first().focus();
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("thread-modal")).toBeVisible();
});

test("post profile and room links do not open the thread target", async ({
  page,
}) => {
  await mockAuthenticatedApi(page);
  await mockProfileRoutes(page, "alex");
  await mockRoomRoutes(page, "general");

  await page.route("**/api/feed/home", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: {
          posts: [
            makePost({
              room: {
                id: 1,
                slug: "general",
                name: "General",
                accent: "var(--accent-frost)",
              },
            }),
          ],
          personalized: true,
        },
      }),
    }),
  );

  await page.goto("/");
  await page
    .getByTestId("post-card-open-thread")
    .first()
    .getByRole("link", { name: "Alex's profile" })
    .click();
  await expect(page.getByTestId("thread-modal")).toHaveCount(0);
  await expect(page).toHaveURL(/\/@alex$/);

  await page.goto("/");
  await page
    .getByTestId("post-card-open-thread")
    .first()
    .getByRole("link", { name: "Alex", exact: true })
    .click();
  await expect(page.getByTestId("thread-modal")).toHaveCount(0);
  await expect(page).toHaveURL(/\/@alex$/);

  await page.goto("/");
  await page
    .getByTestId("post-card-open-thread")
    .first()
    .getByRole("link", { name: "@alex" })
    .click();
  await expect(page.getByTestId("thread-modal")).toHaveCount(0);
  await expect(page).toHaveURL(/\/@alex$/);

  await page.goto("/");
  await page
    .getByTestId("post-card-open-thread")
    .first()
    .getByRole("link", { name: "General" })
    .click();
  await expect(page.getByTestId("thread-modal")).toHaveCount(0);
  await expect(page).toHaveURL(/\/rooms\/general$/);
});

test("post report and delete controls stay isolated from body open", async ({
  page,
}) => {
  await mockAuthenticatedApi(page);
  let deleted = false;

  await page.route("**/api/feed/home", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: {
          posts: [
            makePost({
              author: {
                id: 1,
                handle: "viewer",
                displayName: "Viewer",
                initials: "V",
                aura: "frost",
                avatarUrl: null,
              },
            }),
            makePost({ id: 43, body: "Reportable post." }),
          ],
          personalized: true,
        },
      }),
    }),
  );
  await page.route("**/api/posts/42", async (route) => {
    deleted = true;
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: { id: 42, status: "removed", deletedAt: "2026-06-10 11:00:00" },
      }),
    });
  });

  await page.goto("/");
  await page
    .getByTestId("post-card-open-thread")
    .first()
    .getByRole("button", { name: "Delete post" })
    .click();
  await expect(page.getByTestId("thread-modal")).toHaveCount(0);
  expect(deleted).toBe(true);

  await page
    .getByTestId("post-card-open-thread")
    .first()
    .getByRole("button", { name: "Report post" })
    .click();
  await expect(page.getByTestId("thread-modal")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Report post" })).toBeVisible();
});

test("thread modal root and reply identities navigate to profiles", async ({ page }) => {
  await mockAuthenticatedApi(page);

  await page.route("**/api/feed/home", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: {
          posts: [
            makePost({
              commentCount: 1,
              room: {
                id: 1,
                slug: "general",
                name: "General",
                accent: "var(--accent-frost)",
              },
            }),
          ],
          personalized: true,
        },
      }),
    }),
  );
  await page.route("**/api/posts/42/replies", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: [
          makePost({
            id: 50,
            parentId: 42,
            body: "Reply from Mira.",
            author: {
              id: 3,
              handle: "mira",
              displayName: "Mira",
              initials: "M",
              aura: "frost",
              avatarUrl: null,
            },
          }),
        ],
      }),
    }),
  );

  await page.goto("/");
  await page.getByTestId("post-body-open-thread").first().click();

  const dialog = page.getByTestId("thread-modal");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("link", { name: "Alex's profile" })).toHaveAttribute(
    "href",
    "/@alex",
  );
  await expect(dialog.getByRole("link", { name: "Mira's profile" })).toHaveAttribute(
    "href",
    "/@mira",
  );
  await expect(dialog.getByRole("link", { name: "General" })).toHaveAttribute(
    "href",
    "/rooms/general",
  );
  await expect(dialog.getByRole("button", { name: /Open replies/ }).first()).toBeVisible();
  await page.waitForTimeout(250);

  await dialog.getByTestId("thread-root-post").click();
  await expect(page.getByTestId("thread-modal")).toHaveCount(1);
  await expect(
    dialog.getByTestId("thread-root-actions").getByRole("button", {
      name: /Open replies/,
    }),
  ).toBeVisible();

  const rootPost = dialog.getByTestId("thread-root-post");
  const replyItem = dialog.getByTestId("thread-reply-item").first();
  const rootBoxBefore = await rootPost.boundingBox();
  const replyBoxBefore = await replyItem.boundingBox();
  expect(rootBoxBefore).not.toBeNull();
  expect(replyBoxBefore).not.toBeNull();

  await rootPost.hover();
  await replyItem.hover();
  await dialog.getByRole("link", { name: "Mira's profile" }).hover();
  await dialog.getByRole("link", { name: "General" }).hover();
  await dialog.getByRole("button", { name: /Open replies/ }).first().hover();
  await page.waitForTimeout(100);

  const rootBoxAfter = await rootPost.boundingBox();
  const replyBoxAfter = await replyItem.boundingBox();
  expect(rootBoxAfter).not.toBeNull();
  expect(replyBoxAfter).not.toBeNull();
  expect(Math.abs(rootBoxAfter!.width - rootBoxBefore!.width)).toBeLessThanOrEqual(1);
  expect(Math.abs(rootBoxAfter!.height - rootBoxBefore!.height)).toBeLessThanOrEqual(1);
  expect(Math.abs(replyBoxAfter!.width - replyBoxBefore!.width)).toBeLessThanOrEqual(1);
  expect(Math.abs(replyBoxAfter!.height - replyBoxBefore!.height)).toBeLessThanOrEqual(1);

  const rootActionsBelongToRoot = await rootPost.evaluate((root) =>
    root.contains(document.querySelector('[data-testid="thread-root-actions"]')),
  );
  expect(rootActionsBelongToRoot).toBe(true);
  await expect(
    replyItem.getByTestId("thread-reply-actions").getByRole("button", {
      name: /Open replies/,
    }),
  ).toBeVisible();
  await expect(replyItem.getByTestId("thread-reply-content")).toHaveAttribute(
    "class",
    "min-w-0 py-1",
  );
  await expect(dialog.getByTestId("thread-avatar-rail")).toHaveCount(2);
  for (const bubble of await dialog.getByTestId("thread-avatar-bubble").all()) {
    const bubbleBox = await bubble.boundingBox();
    expect(bubbleBox).not.toBeNull();
    expect(bubbleBox!.width).toBeLessThanOrEqual(50);
    expect(bubbleBox!.height).toBeLessThanOrEqual(50);
  }
  await expect(dialog.getByTestId("thread-rail-line-after")).toHaveCount(2);
});

test("thread reply composer is hidden until Reply and exposes media UI", async ({
  page,
}) => {
  await mockAuthenticatedApi(page);
  let replyPayload: Record<string, unknown> | undefined;

  await page.route("**/api/feed/home", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: { posts: [makePost()], personalized: true },
      }),
    }),
  );
  await page.route("**/api/posts/42/replies", async (route) => {
    if (route.request().method() === "POST") {
      replyPayload = (await route.request().postDataJSON()) as Record<string, unknown>;
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          data: makePost({
            id: 51,
            parentId: 42,
            body: String(replyPayload.body),
            author: {
              id: 1,
              handle: "viewer",
              displayName: "Viewer",
              initials: "V",
              aura: "frost",
              avatarUrl: null,
            },
          }),
        }),
      });
      return;
    }

    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ ok: true, data: [] }),
    });
  });

  await page.goto("/");
  await page.getByTestId("post-body-open-thread").first().click();

  const dialog = page.getByTestId("thread-modal");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByTestId("thread-conversation")).toBeVisible();
  await expect(dialog.getByTestId("thread-state")).toContainText("No replies yet");
  await expect(dialog.getByTestId("thread-state")).toContainText(
    "Start the conversation with a reply.",
  );
  await expect(dialog.getByTestId("reply-composer")).toHaveCount(0);
  await expect(dialog.getByRole("button", { name: /Open replies/ })).toHaveCount(1);

  await dialog.getByRole("button", { name: /Open replies/ }).first().click();
  await expect(dialog.getByTestId("reply-composer")).toBeVisible();
  await expect(dialog.getByText("Upload image")).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Send" })).toBeDisabled();

  await dialog.getByRole("textbox", { name: "Reply" }).fill("A compact reply.");
  await dialog.getByRole("button", { name: "Send" }).click();

  await expect.poll(() => replyPayload).toMatchObject({ body: "A compact reply." });
  await expect(dialog.getByText("A compact reply.")).toBeVisible();
});

test("thread renders nested replies and gates reply delete controls", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 760 });
  await mockAuthenticatedApi(page);
  let deletedPostId: number | undefined;
  let rebloggedReply = false;

  await page.route("**/api/feed/home", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: { posts: [makePost({ commentCount: 2 })], personalized: true },
      }),
    }),
  );
  await page.route("**/api/posts/42/replies", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: [
          makePost({
            id: 50,
            parentId: 42,
            body: "My reply.",
            commentCount: 1,
            author: {
              id: 1,
              handle: "viewer",
              displayName: "Viewer",
              initials: "V",
              aura: "frost",
              avatarUrl: null,
            },
          }),
          makePost({ id: 52, parentId: 42, body: "Rebloggable reply." }),
        ],
      }),
    }),
  );
  await page.route("**/api/posts/50/replies", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: [makePost({ id: 60, parentId: 50, body: "Nested reply." })],
      }),
    }),
  );
  await page.route("**/api/posts/50", async (route) => {
    if (route.request().method() === "DELETE") {
      deletedPostId = 50;
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          data: { id: 50, status: "removed", deletedAt: "2026-06-10 10:30:00" },
        }),
      });
      return;
    }

    await route.continue();
  });
  await page.route("**/api/posts/52/reblog", async (route) => {
    rebloggedReply = route.request().method() === "POST";
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: {
          postId: 52,
          reblogCount: rebloggedReply ? 1 : 0,
          rebloggedByMe: rebloggedReply,
          rebloggedByCurrentUser: rebloggedReply,
        },
      }),
    });
  });

  await page.goto("/");
  await page.getByTestId("post-body-open-thread").first().click();
  const dialog = page.getByTestId("thread-modal");

  await expect(dialog.getByText("My reply.")).toBeVisible();
  await expect(dialog.getByText("Rebloggable reply.")).toBeVisible();
  await dialog.getByRole("button", { name: "Show 1 reply" }).click();
  await expect(dialog.getByText("Nested reply.")).toBeVisible();
  await expect(dialog.getByTestId("thread-nested-replies")).toBeVisible();
  await expect(dialog.getByTestId("thread-rail-branch")).toHaveCount(1);

  const topReplyBox = await dialog
    .getByText("My reply.")
    .locator('xpath=ancestor::*[@data-testid="thread-reply-item"][1]')
    .boundingBox();
  const nestedReply = dialog
    .getByText("Nested reply.")
    .locator('xpath=ancestor::*[@data-testid="thread-reply-item"][1]');
  const nestedReplyBox = await nestedReply.boundingBox();
  expect(topReplyBox).not.toBeNull();
  expect(nestedReplyBox).not.toBeNull();
  expect(nestedReplyBox!.x - topReplyBox!.x).toBeGreaterThan(6);
  expect(nestedReplyBox!.x - topReplyBox!.x).toBeLessThan(52);
  await expect(nestedReply).toHaveClass(/border-l/);

  const conversationOverflow = await dialog
    .getByTestId("thread-conversation")
    .evaluate((node) => node.scrollWidth > node.clientWidth + 1);
  expect(conversationOverflow).toBe(false);

  await dialog.getByRole("button", { name: /Reblog this post/ }).last().click();
  await expect.poll(() => rebloggedReply).toBe(true);

  await dialog.getByRole("button", { name: "Delete reply" }).click();
  await expect.poll(() => deletedPostId).toBe(50);
  await expect(dialog.getByText("My reply.")).toHaveCount(0);
});

test("thread report flow submits the post target", async ({ page }) => {
  await mockAuthenticatedApi(page);
  let reportPayload: Record<string, unknown> | undefined;

  await page.route("**/api/feed/home", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: { posts: [makePost()], personalized: true },
      }),
    }),
  );
  await page.route("**/api/posts/42/replies", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ ok: true, data: [] }),
    }),
  );
  await page.route("**/api/reports", async (route) => {
    reportPayload = (await route.request().postDataJSON()) as Record<string, unknown>;
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ ok: true, data: { id: 1, ...reportPayload } }),
    });
  });

  await page.goto("/");
  await page.getByTestId("post-body-open-thread").first().click();
  const dialog = page.getByTestId("thread-modal");

  await dialog.getByRole("button", { name: "Report post" }).click();
  const reportDialog = page.getByRole("dialog", { name: "Report post" });
  await expect(reportDialog).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(reportDialog).toBeHidden();
  await expect(dialog).toBeVisible();

  await dialog.getByRole("button", { name: "Report post" }).click();
  await expect(reportDialog).toBeVisible();
  await reportDialog.getByRole("button", { name: "Report", exact: true }).click();

  await expect.poll(() => reportPayload).toMatchObject({
    targetType: "post",
    targetId: 42,
    postId: 42,
    reportedUserId: 2,
  });
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

async function expectHoverToKeepSurfaceFlat(target: Locator) {
  const before = await getSurfaceStyle(target);

  await target.hover();

  const after = await getSurfaceStyle(target);

  expect(after).toEqual(before);
}

async function getSurfaceStyle(target: Locator) {
  return target.evaluate((element) => {
    const style = window.getComputedStyle(element);

    return {
      backgroundColor: style.backgroundColor,
      boxShadow: style.boxShadow,
      outlineColor: style.outlineColor,
      outlineOffset: style.outlineOffset,
      outlineStyle: style.outlineStyle,
      outlineWidth: style.outlineWidth,
    };
  });
}

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

async function mockProfileRoutes(page: Page, handle: string) {
  await page.route(`**/api/profiles/${handle}`, (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ ok: true, data: makePost().profile }),
    }),
  );

  for (const suffix of ["posts", "replies", "reblogs", "rooms", "followers", "following"]) {
    await page.route(`**/api/profiles/${handle}/${suffix}`, (route) =>
      route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ ok: true, data: [] }),
      }),
    );
  }

  await page.route(`**/api/profiles/${handle}/badges`, (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ ok: true, data: { badges: [], featuredBadges: [] } }),
    }),
  );
}

async function mockRoomRoutes(page: Page, slug: string) {
  await page.route(`**/api/rooms/${slug}`, (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: {
          id: 1,
          slug,
          name: "General",
          summary: "Open conversation.",
          description: "A public room.",
          mood: "sunveil",
          members: 1,
          memberCount: 1,
          live: false,
          accent: "var(--accent-frost)",
          iconUrl: null,
          bannerUrl: null,
          rules: "",
          visibility: "public",
          createdBy: 2,
          owner: {
            id: 2,
            handle: "alex",
            displayName: "Alex",
            initials: "A",
            aura: "frost",
            avatarUrl: null,
          },
          joinedByMe: false,
          myRoomRole: null,
          postCount: 0,
          latestActivityAt: "2026-06-10 10:00:00",
          createdAt: "2026-06-10 09:00:00",
          updatedAt: "2026-06-10 10:00:00",
        },
      }),
    }),
  );
  await page.route(`**/api/rooms/${slug}/posts`, (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ ok: true, data: [] }),
    }),
  );
  await page.route(`**/api/rooms/${slug}/members`, (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ ok: true, data: [] }),
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
