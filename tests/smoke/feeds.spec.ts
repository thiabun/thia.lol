import { expect, test, type Locator, type Page } from "@playwright/test";
import { Buffer } from "node:buffer";
import { readFileSync } from "node:fs";
import { loginWithEnv, skipWithoutCredentials } from "../helpers/auth";

const portraitMediaFixture = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920"><rect width="1080" height="1920" fill="#f6e8b8"/><circle cx="540" cy="500" r="320" fill="#8fb7b1"/><rect x="360" y="980" width="360" height="640" rx="120" fill="#42526b"/></svg>',
)}`;

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

test("PostCard share modal copies, saves, and sends typed post attachments", async ({
  page,
}) => {
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

  await mockAuthenticatedApi(page);
  const publicId = "pabc123def456";
  const post = makePost({
    publicId,
    canonicalPath: `/@alex/posts/${publicId}`,
    canonicalUrl: `https://thia.lol/@alex/posts/${publicId}`,
  });
  const moot = {
    id: 7,
    handle: "mootpal",
    displayName: "Moot Pal",
    initials: "MP",
    aura: "frost",
    avatarUrl: null,
  };
  let sharePayload: Record<string, unknown> | undefined;

  await page.route("**/api/feed/home", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: { posts: [post], personalized: true },
      }),
    }),
  );
  await page.route("**/api/chat/moots", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ ok: true, data: [moot] }),
    }),
  );
  await page.route(`**/api/posts/${publicId}/shares/messages`, async (route) => {
    sharePayload = route.request().postDataJSON() as Record<string, unknown>;
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: {
          post: {
            id: 42,
            publicId,
            canonicalPath: `/@alex/posts/${publicId}`,
            canonicalUrl: `https://thia.lol/@alex/posts/${publicId}`,
            bodySnippet: "A public post.",
            createdAt: "2026-06-10 10:00:00",
            mediaUrl: null,
            author: post.author,
            room: null,
          },
          results: [
            {
              recipientUserId: 7,
              recipient: moot,
              status: "sent",
              conversationId: 31,
              messageId: 501,
            },
          ],
          sentCount: 1,
          failedCount: 0,
        },
      }),
    });
  });
  await page.route(`**/api/posts/${publicId}/share-card.png`, (route) =>
    route.fulfill({
      contentType: "image/png",
      body: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/lulc9QAAAABJRU5ErkJggg==",
        "base64",
      ),
    }),
  );

  await page.goto("/");
  await page.getByRole("button", { name: "Share post" }).first().click();

  await expect(page.getByTestId("thread-modal")).toHaveCount(0);
  const modal = page.getByTestId("post-share-modal");
  await expect(modal).toBeVisible();

  await modal.getByTestId("post-share-copy-link").click();
  await expect(modal.getByTestId("post-share-copy-link")).toContainText("Copied");
  await expect
    .poll(() =>
      page.evaluate(() => (window as unknown as { __copiedText?: string }).__copiedText),
    )
    .toBe(`https://thia.lol/@alex/posts/${publicId}`);

  await expect(modal.getByTestId("post-share-save-image")).toHaveAttribute(
    "href",
    `/api/posts/${publicId}/share-card.png`,
  );
  await expect(modal.getByTestId("post-share-save-image")).toHaveAttribute(
    "download",
    `thia-post-${publicId}.png`,
  );

  await expect(modal.getByTestId("post-share-moot-list")).toContainText("Moot Pal");
  await modal.getByTestId("post-share-moot-7").click();
  await modal.getByTestId("post-share-note").fill("thought you would like this");
  await modal.getByTestId("post-share-send-moots").click();

  await expect(modal.getByText("Sent to 1 moot.")).toBeVisible();
  await expect(modal.getByRole("link", { name: "Open chat" })).toHaveAttribute(
    "href",
    "/chat?conversation=31",
  );
  expect(sharePayload).toMatchObject({
    recipientUserIds: [7],
    note: "thought you would like this",
  });
});

test("post permalink route loads canonical post and replies", async ({ page }) => {
  await mockCommonApi(page);
  const publicId = "pabc123def456";
  await page.route(`**/api/posts/${publicId}`, (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: makePost({
          publicId,
          canonicalPath: `/@alex/posts/${publicId}`,
          canonicalUrl: `https://thia.lol/@alex/posts/${publicId}`,
          commentCount: 1,
        }),
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
            id: 73,
            parentId: 42,
            body: "A permalink reply.",
            canonicalPath: "/@alex/posts/73",
            canonicalUrl: "https://thia.lol/@alex/posts/73",
          }),
        ],
      }),
    }),
  );

  await page.goto(`/@stale/posts/${publicId}`);

  await expect(page).toHaveURL(new RegExp(`/@alex/posts/${publicId}$`));
  await expect(page.getByRole("heading", { name: "Post", exact: true })).toBeVisible();
  await expect(page.getByText("A public post.")).toBeVisible();
  await expect(page.getByText("A permalink reply.")).toBeVisible();
});

test("post permalink route shows unavailable state", async ({ page }) => {
  await mockCommonApi(page);
  await page.route("**/api/posts/pnotfound1234", (route) =>
    route.fulfill({
      status: 404,
      contentType: "application/json",
      body: JSON.stringify({ ok: false, error: "Post not found." }),
    }),
  );

  await page.goto("/@alex/posts/pnotfound1234");

  await expect(page.getByRole("heading", { name: "Post not found" })).toBeVisible();
  await expect(page.getByText("Post not found.")).toBeVisible();
});

test("post permalink server renderer emits social metadata by inspection", async () => {
  const renderer = readFileSync("api/post-share.php", "utf8");
  const htaccess = readFileSync("public/.htaccess", "utf8");

  expect(htaccess).toContain("api/post-share.php?handle=$1&postId=$2");
  expect(renderer).toContain('<meta property="og:title"');
  expect(renderer).toContain('<meta property="og:description"');
  expect(renderer).toContain('<meta property="og:url"');
  expect(renderer).toContain('<meta property="og:image"');
  expect(renderer).toContain('<meta name="twitter:card" content="summary_large_image"');
  expect(renderer).toContain("post_share_page_escape");
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

test("feed, thread, and profile surfaces render rich text entities", async ({
  page,
}) => {
  await mockAuthenticatedApi(page);
  await page.route(/^https:\/\/www\.youtube-nocookie\.com\/embed\//, (route) =>
    route.fulfill({
      contentType: "text/html",
      body: "<!doctype html><html><body>YouTube embed stub</body></html>",
    }),
  );

  const thia = {
    id: 3,
    handle: "thia",
    displayName: "Thia",
    initials: "T",
    aura: "frost",
    avatarUrl: null,
  };
  const bio = "Bio says hi to @alex";
  await mockProfileRoutes(page, "thia", {
    user: thia,
    bio,
    bioEntities: [richMentionEntity(bio, "@alex")],
  });

  const body =
    "Hi @thia check https://example.com/notes and https://www.youtube.com/watch?v=abc123";
  const replyBody = "Reply to @thia with https://example.com/reply";

  await page.route("**/api/feed/home", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: {
          posts: [
            makePost({
              body,
              bodyEntities: [
                richMentionEntity(body, "@thia", thia),
                richLinkEntity(body, "https://example.com/notes", richWebsiteCard("https://example.com/notes", "Example notes")),
                richLinkEntity(body, "https://www.youtube.com/watch?v=abc123", richYouTubeCard("https://www.youtube.com/watch?v=abc123")),
              ],
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
            body: replyBody,
            bodyEntities: [
              richMentionEntity(replyBody, "@thia", thia),
              richLinkEntity(replyBody, "https://example.com/reply", richWebsiteCard("https://example.com/reply", "Reply card")),
            ],
          }),
        ],
      }),
    }),
  );

  await page.goto("/");

  const postCard = page.getByTestId("post-card-open-thread").first();
  await expect(postCard.getByTestId("rich-mention-link")).toHaveAttribute(
    "href",
    "/@thia",
  );
  await expect(postCard.getByTestId("rich-inline-link").first()).toHaveAttribute(
    "href",
    "https://example.com/notes",
  );
  await expect(postCard.getByTestId("rich-link-preview").first()).toContainText(
    "Example notes",
  );
  await expect(postCard.getByTestId("rich-link-embed-youtube")).toBeVisible();

  await postCard.getByTestId("rich-mention-link").click();
  await expect(page).toHaveURL(/\/@thia$/);
  await expect(page.getByTestId("profile-bio").getByTestId("rich-mention-link")).toHaveAttribute(
    "href",
    "/@alex",
  );

  await page.goto("/");
  await postCard.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByTestId("thread-modal");
  await expect(dialog).toBeVisible();

  await expect(dialog.getByTestId("thread-root-post").getByTestId("rich-mention-link")).toHaveAttribute(
    "href",
    "/@thia",
  );
  await expect(dialog.getByTestId("thread-reply-item").getByTestId("rich-mention-link")).toHaveAttribute(
    "href",
    "/@thia",
  );
  await expect(dialog.getByText("Reply card")).toBeVisible();
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
  await page.route("**/api/profiles/alex/modules", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ ok: true, data: [activityModule()] }),
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
              mediaUrl: portraitMediaFixture,
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
  expect(postBox!.width).toBeLessThanOrEqual(610);
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
          posts: [makePost({ mediaUrl: portraitMediaFixture })],
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
    const mediaFrame = bodyOpenTarget.getByTestId("post-media");
    const mediaImage = bodyOpenTarget.getByTestId("post-media-image");

    await expect(bodyOpenTarget).toBeVisible();
    await expect(mediaFrame).toBeVisible();
    await expect(mediaImage).toBeVisible();
    const mediaBox = await mediaImage.boundingBox();
    expect(mediaBox).not.toBeNull();
    expect(mediaBox!.height).toBeGreaterThan(mediaBox!.width);
    expect(mediaBox!.height).toBeLessThanOrEqual(560);
    await expect(mediaImage).toHaveCSS("object-fit", "contain");
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
  await expect(rootPost.getByTestId("thread-rail-line-after")).toHaveCount(1);
  await expect(replyItem.getByTestId("thread-rail-line-before")).toHaveCount(1);
  await expect(replyItem.getByTestId("thread-rail-line-after")).toHaveCount(0);
  await expect(dialog.getByTestId("thread-rail-line-after")).toHaveCount(1);
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
  await expect(dialog.getByTestId("thread-rail-line-before")).toHaveCount(2);
  await expect(dialog.getByTestId("thread-rail-line-after")).toHaveCount(2);
  await expect(dialog.getByTestId("thread-rail-branch")).toHaveCount(0);
  await dialog.getByRole("button", { name: "Show 1 reply" }).click();
  await expect(dialog.getByText("Nested reply.")).toBeVisible();
  await expect(dialog.getByTestId("thread-nested-replies")).toBeVisible();
  await expect(dialog.getByTestId("thread-rail-branch")).toHaveCount(1);
  await expect(dialog.getByTestId("thread-rail-line-before")).toHaveCount(3);
  await expect(dialog.getByTestId("thread-rail-line-after")).toHaveCount(2);

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
  await expect(nestedReply).not.toHaveClass(/border-l/);

  const nestedIncomingLineBox = await nestedReply
    .getByTestId("thread-rail-line-before")
    .boundingBox();
  const nestedBranchBox = await nestedReply
    .getByTestId("thread-rail-branch")
    .boundingBox();
  expect(nestedIncomingLineBox).not.toBeNull();
  expect(nestedBranchBox).not.toBeNull();
  expect(nestedIncomingLineBox!.y + nestedIncomingLineBox!.height).toBeGreaterThanOrEqual(
    nestedBranchBox!.y,
  );

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

async function mockProfileRoutes(
  page: Page,
  handle: string,
  profileOverrides: Record<string, unknown> = {},
) {
  await page.route(`**/api/profiles/${handle}`, (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: {
          ...makePost().profile,
          ...profileOverrides,
        },
      }),
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

  await page.route(`**/api/profiles/${handle}/modules`, (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ ok: true, data: [activityModule()] }),
    }),
  );

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

function activityModule() {
  return {
    id: 9,
    type: "activity",
    title: "Feed",
    config: {},
    visibility: "public",
    position: 1,
    status: "active",
    schemaVersion: 1,
    createdAt: "2026-06-12 00:00:00",
    updatedAt: "2026-06-12 00:00:00",
  };
}

function richMentionEntity(
  body: string,
  mention: string,
  user = {
    id: 2,
    handle: mention.replace(/^@/, ""),
    displayName: mention.replace(/^@/, ""),
    initials: mention.replace(/^@/, "").slice(0, 2).toUpperCase(),
    aura: "frost",
    avatarUrl: null,
  },
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
      allow: "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share",
    },
    apiBacked: false,
    fetchedAt: "2026-06-10T10:00:00Z",
    expiresAt: null,
    staleAt: null,
    stale: false,
    lastError: null,
  };
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
