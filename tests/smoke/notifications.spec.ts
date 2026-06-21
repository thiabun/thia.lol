import { expect, type Page, test } from "@playwright/test";
import { loginWithEnv, skipWithoutCredentials } from "../helpers/auth";

type ApiEnvelope<T> = {
  ok: boolean;
  data?: T;
  error?: string;
};

test("notifications page renders empty state and keeps nav placement", async ({
  page,
}) => {
  await mockAuthenticatedEmptyNotifications(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/notifications");

  await expect(
    page.getByRole("heading", { name: "Notifications", exact: true }),
  ).toBeVisible();
  await expect(page.getByTestId("notifications-unread-count")).toHaveText(
    "0 unread",
  );
  await expect(page.getByText("No notifications yet")).toBeVisible();
  await expect(page.getByRole("button", { name: "Mark all as read" })).toBeDisabled();
  await expect(page.getByTestId("desktop-notifications-card")).toBeVisible();
  await expect(page.getByTestId("desktop-notifications-state")).toContainText(
    /setup needed|unsupported|blocked/,
  );
  await expect(page.getByTestId("desktop-notifications-enable")).toBeDisabled();

  const nav = page.getByTestId("desktop-nav");
  await expect(nav.getByRole("link", { name: "Chat" })).toBeVisible();
  await expect(nav.getByRole("link", { name: "Admin" })).toHaveCount(0);

  await page.getByRole("button", { name: /account menu/i }).click();
  await expect(
    page.getByTestId("account-menu").getByRole("menuitem", { name: "Admin" }),
  ).toBeVisible();
});

test("mobile primary nav keeps Chat while notifications use the header", async ({
  page,
}) => {
  await mockAuthenticatedEmptyNotifications(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/notifications");

  await expect(page.getByRole("link", { name: "Notifications" })).toBeVisible();

  const nav = page.getByTestId("mobile-nav");
  await expect(nav.getByRole("link", { name: "Chat" })).toBeVisible();
  await expect(nav.getByRole("link", { name: "Notifications" })).toHaveCount(0);
  await expect(nav.getByRole("link", { name: "Admin" })).toHaveCount(0);
});

test("logged-out notifications route keeps route hierarchy", async ({ page }) => {
  await mockAnonymousNotifications(page);
  await page.goto("/notifications");

  await expect(
    page.getByRole("heading", { name: "Notifications", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Sign in to see notifications.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();
});

test("notification actor identity links to the actor profile", async ({ page }) => {
  await mockAuthenticatedNotifications(page, [
    {
      id: 9,
      type: "follow",
      createdAt: "2026-06-10 10:00:00",
      readAt: null,
      actor: {
        id: 2,
        handle: "alex",
        displayName: "Alex",
        initials: "A",
        aura: "frost",
        avatarUrl: null,
      },
      post: null,
      room: null,
      targetUrl: "/@alex",
      data: null,
    },
  ]);

  await page.goto("/notifications");

  await expect(page.getByRole("link", { name: "@alex" })).toHaveAttribute(
    "href",
    "/@alex",
  );
  await expect(page.getByRole("link", { name: "Open profile" })).toHaveAttribute(
    "href",
    "/@alex",
  );
  await expect(
    page.getByRole("button", { name: "Mark notification as read" }),
  ).toBeVisible();
});

test("mark all notifications as read works against the API", async ({ page }) => {
  skipWithoutCredentials();

  const session = await loginWithEnv(page);
  const csrfToken = session.data?.csrfToken;

  expect(csrfToken).toEqual(expect.any(String));

  const result = await page.evaluate(async (csrf) => {
    const response = await fetch("/api/notifications/read-all", {
      method: "POST",
      credentials: "include",
      headers: {
        Accept: "application/json",
        "X-CSRF-Token": csrf,
      },
    });
    const json = (await response.json()) as ApiEnvelope<{
      readAt: string;
      unreadCount: number;
    }>;

    return {
      ...json,
      status: response.status,
    };
  }, csrfToken);

  expect(result.ok).toBe(true);
  expect(result.status).toBe(200);
  expect(result.data?.unreadCount).toBe(0);

  await page.goto("/notifications");
  await expect(page.getByTestId("notifications-unread-count")).toHaveText(
    "0 unread",
  );
});

async function mockAuthenticatedEmptyNotifications(page: Page) {
  await mockAuthenticatedNotifications(page, []);
}

async function mockAnonymousNotifications(page: Page) {
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

  await page.route("**/api/me/onboarding**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: {
          steps: [
            "profile_basics",
            "spotify",
            "youtube",
            "twitch",
            "github",
            "apple_music",
            "profile_canvas",
            "desktop_notifications",
          ],
          completedSteps: [],
          skippedSteps: [],
          providerLinks: {},
          finishedAt: "2026-06-19 12:00:00",
          dismissedAt: null,
          createdAt: "2026-06-19 12:00:00",
          updatedAt: "2026-06-19 12:00:00",
        },
      }),
    });
  });
}

async function mockAuthenticatedNotifications(page: Page, notifications: unknown[]) {
  await page.route("**/api/auth/me", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: {
          user: {
            id: 1,
            handle: "admin",
            email: "admin@example.test",
            role: "admin",
            status: "active",
            displayName: "Admin",
            avatarUrl: null,
          },
          profile: {
            displayName: "Admin",
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
    if (route.request().method() !== "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          data: {
            readAt: "2026-06-10 10:00:01",
            unreadCount: 0,
          },
        }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: {
          notifications,
          unreadCount: notifications.length,
        },
      }),
    });
  });

  await page.route("**/api/me/push", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          data: {
            supported: true,
            configured: false,
            storageReady: true,
            publicKey: null,
            subject: "mailto:hello@thia.lol",
            enabled: false,
            subscriptionCount: 0,
            subscriptions: [],
            diagnostics: {
              missingConfigKeys: ["push.vapid_public_key", "push.vapid_private_key"],
              curlAvailable: true,
              opensslAvailable: true,
            },
          },
        }),
      });
      return;
    }

    await route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({
        ok: false,
        error: "Desktop notifications are not configured on this server.",
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

  await page.route("**/api/me/onboarding**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: {
          steps: [
            "profile_basics",
            "spotify",
            "youtube",
            "twitch",
            "github",
            "apple_music",
            "profile_canvas",
            "desktop_notifications",
          ],
          completedSteps: [],
          skippedSteps: [],
          providerLinks: {},
          finishedAt: "2026-06-19 12:00:00",
          dismissedAt: null,
          createdAt: "2026-06-19 12:00:00",
          updatedAt: "2026-06-19 12:00:00",
        },
      }),
    });
  });
}
