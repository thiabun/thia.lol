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
      await route.fallback();
      return;
    }

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

  await page.route("**/api/rooms", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, data: [] }),
    });
  });
}
