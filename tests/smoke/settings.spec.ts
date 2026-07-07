import { expect, type Locator, type Page, test } from "@playwright/test";

test("settings separates readouts and confirms bulk content deletion", async ({
  page,
}) => {
  const state = await mockAuthenticatedSettingsShell(page);

  await page.goto("/settings");

  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  await expect(page.getByTestId("page-loading-overlay")).toBeHidden({
    timeout: 5000,
  });

  const account = page.locator("#account");
  await expect(account.getByTestId("settings-readout-email")).toContainText(
    "viewer@example.test",
  );
  await expect(account.getByTestId("settings-readout-handle")).toContainText(
    "@viewer",
  );
  await expectStaticReadout(account.getByTestId("settings-readout-email"));
  await expectStaticReadout(account.getByTestId("settings-readout-handle"));
  await expect(account.getByText("Change email")).toBeVisible();
  await expect(account.getByText("Change handle")).toBeVisible();

  const content = page.locator("#content");
  await expect(content).toContainText("Posts and replies");
  await expect(content).toContainText("First post to delete.");
  await expect(content).not.toContainText("Bulk delete");
  await expect(content).not.toContainText("Selected content");
  await expect(content.getByRole("button", { name: "Delete shown" })).toHaveCount(0);

  const danger = page.locator("#danger");
  const deleteAllButton = danger.getByRole("button", {
    name: "Delete all posts and replies",
  });
  await expect(deleteAllButton).toBeVisible();
  await deleteAllButton.click();

  const dialog = page.getByRole("dialog", {
    name: "Delete all posts and replies?",
  });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("not just the current Content filter");

  await dialog.getByRole("button", { name: "Delete all" }).click();

  await expect.poll(() => state.deletedKind).toBe("all");
  await expect(page.getByText("2 items deleted.")).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

async function expectStaticReadout(locator: Locator) {
  await expect(locator).toBeVisible();

  const interactiveAncestor = await locator.evaluate((element) =>
    Boolean(element.closest("a, button, summary")),
  );

  expect(interactiveAncestor).toBe(false);
}

async function expectNoHorizontalOverflow(page: Page) {
  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );

  expect(hasHorizontalOverflow).toBe(false);
}

async function mockAuthenticatedSettingsShell(page: Page) {
  const state: { deletedKind: string | undefined } = { deletedKind: undefined };

  await page.route("**/api/auth/me", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: {
          user: {
            id: 42,
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
          csrfToken: "csrf-token",
        },
      }),
    }),
  );

  await page.route("**/api/me/settings", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: {
          account: {
            id: 42,
            handle: "viewer",
            email: "viewer@example.test",
            displayName: "Viewer",
            status: "active",
            handleChange: {
              canChange: true,
              nextAllowedAt: null,
            },
          },
          privacy: {
            profileVisibility: "public",
          },
          preferences: {
            analyticsConsent: false,
            personalizationConsent: true,
            richEmbedsConsent: true,
            autoplayMediaConsent: false,
            sensitiveContentVisible: false,
            notifications: {},
            emailNotifications: {},
            pushNotifications: {},
          },
          twoFactor: {
            enabled: false,
            backupCodeCount: 0,
            encryptionConfigured: true,
            encryptionAvailable: true,
          },
          deletion: null,
        },
      }),
    }),
  );

  await page.route("**/api/me/follow-requests", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ ok: true, data: [] }),
    }),
  );

  await page.route("**/api/me/posts**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());

    if (request.method() === "DELETE") {
      expect(request.headers()["x-csrf-token"]).toBe("csrf-token");
      state.deletedKind = url.searchParams.get("kind") ?? undefined;

      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          data: { deletedCount: 2, kind: state.deletedKind },
        }),
      });
      return;
    }

    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: state.deletedKind
          ? []
          : [
              {
                id: 1,
                body: "First post to delete.",
                kind: "post",
                status: "published",
              },
              {
                id: 2,
                body: "Reply to delete.",
                kind: "reply",
                status: "published",
              },
            ],
      }),
    });
  });

  await page.route("**/api/me/onboarding", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: {
          steps: [],
          completedSteps: [],
          skippedSteps: [],
          providerLinks: {},
          finishedAt: "2026-06-26 12:00:00",
          dismissedAt: null,
          createdAt: "2026-06-26 12:00:00",
          updatedAt: "2026-06-26 12:00:00",
        },
      }),
    }),
  );

  await page.route("**/api/me/push", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: {
          supported: true,
          configured: true,
          storageReady: true,
          publicKey: "test-public-key",
          subject: "mailto:hello@thia.lol",
          enabled: false,
          subscriptionCount: 0,
          subscriptions: [],
          diagnostics: {
            missingConfigKeys: [],
            curlAvailable: true,
            opensslAvailable: true,
          },
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

  return state;
}
