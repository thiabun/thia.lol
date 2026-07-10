import { expect, type Page, type Route, test } from "@playwright/test";

const providers = ["spotify", "youtube", "twitch", "github"] as const;

test("connections manages real provider accounts from one canonical route", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const state = await mockConnectionsShell(page, {
    accounts: [connectedAccount("spotify", "Thia on Spotify")],
    unavailableProviders: ["github"],
  });

  await page.goto("/settings/connections");
  await expect(
    page.getByRole("heading", { name: "Connections", exact: true }),
  ).toBeVisible();
  await expect(page.getByTestId("connections-loading")).toHaveCount(0);

  const order = await page.evaluate(() =>
    Array.from(document.querySelectorAll('[data-testid^="connections-provider-row-"]')).map(
      (element) => element.getAttribute("data-testid"),
    ),
  );
  expect(order).toEqual(
    providers.map((provider) => `connections-provider-row-${provider}`),
  );

  await expect(page.getByTestId("connections-status-spotify")).toHaveText("Connected");
  await expect(page.getByTestId("connections-status-youtube")).toHaveText(
    "Ready to connect",
  );
  await expect(page.getByTestId("connections-connect-github")).toBeDisabled();
  await expect(page.getByText("integrations.github.client_id")).toHaveCount(0);
  await expect(page.getByText("Apple Music", { exact: true })).toHaveCount(0);

  await page.getByTestId("connections-connect-youtube").click();
  await expect(page).toHaveURL("/settings/connections");
  await expect(page.getByTestId("connections-notice-success")).toContainText(
    "YouTube connected.",
  );
  expect(state.startRedirectPath).toBe("/settings/connections");
  await expect(page.getByTestId("connections-status-youtube")).toHaveText("Connected");

  await page.getByTestId("connections-disconnect-spotify").click();
  const dialog = page.getByRole("dialog", { name: "Disconnect Spotify?" });
  await expect(dialog).toContainText("Existing public modules and links stay visible");
  await dialog.getByTestId("connections-confirm-disconnect").click();

  await expect(page.getByTestId("connections-notice-success")).toContainText(
    "Spotify disconnected.",
  );
  await expect(page.getByTestId("connections-status-spotify")).toHaveText(
    "Ready to connect",
  );
  expect(state.disconnectedProvider).toBe("spotify");

  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(hasHorizontalOverflow).toBe(false);
});

test("connections shows callback errors without leaking raw provider config", async ({
  page,
}) => {
  await mockConnectionsShell(page, { unavailableProviders: ["github"] });

  await page.goto(
    "/settings/connections?integrationProvider=github&integrationStatus=error&integrationError=invalid_or_expired_state",
  );

  await expect(page).toHaveURL("/settings/connections");
  await expect(page.getByTestId("connections-notice-error")).toContainText(
    "The connection expired. Try connecting again.",
  );
  await expect(page.getByText("integrations.github.client_secret")).toHaveCount(0);
});

test("connections can retry after owner state fails to load", async ({ page }) => {
  let ownerRequests = 0;
  await mockConnectionsShell(page, {
    onOwnerRequest: () => {
      ownerRequests += 1;
      return ownerRequests > 1;
    },
  });

  await page.goto("/settings/connections");
  await expect(page.getByTestId("connections-error")).toBeVisible();
  await page.getByRole("button", { name: "Try again" }).click();

  await expect(page.getByTestId("connections-provider-list")).toBeVisible();
  expect(ownerRequests).toBe(2);
});

test("connections preserves its destination through sign in", async ({ page }) => {
  await page.route("**/api/auth/me", (route) =>
    route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({ ok: false, error: "Not authenticated." }),
    }),
  );

  await page.goto("/settings/connections");
  await expect(page).toHaveURL(
    "/login?returnTo=%2Fsettings%2Fconnections",
  );
});

async function mockConnectionsShell(
  page: Page,
  options: {
    accounts?: Array<Record<string, unknown>>;
    onOwnerRequest?: () => boolean;
    unavailableProviders?: Array<(typeof providers)[number]>;
  } = {},
) {
  let accounts = options.accounts ?? [];
  const unavailable = new Set(options.unavailableProviders ?? []);
  const state: {
    disconnectedProvider?: string;
    startRedirectPath?: string;
  } = {};

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

  await page.route("**/api/me/integrations**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;

    if (path.endsWith("/diagnostics")) {
      await fulfillData(route, {
        storageReady: true,
        encryptionConfigured: true,
        encryptionAvailable: true,
        cryptoMethod: "openssl",
        oauthStateExpiresIn: 600,
        providers: providerStatuses(unavailable),
      });
      return;
    }

    if (request.method() === "POST" && path.endsWith("/youtube/start")) {
      expect(request.headers()["x-csrf-token"]).toBe("csrf-token");
      const payload = (await request.postDataJSON()) as { redirectPath?: string };
      state.startRedirectPath = payload.redirectPath;
      accounts = [...accounts, connectedAccount("youtube", "Viewer on YouTube")];
      await fulfillData(route, {
        provider: "youtube",
        authorizationUrl:
          "/settings/connections?integrationProvider=youtube&integrationStatus=connected",
        stateExpiresIn: 600,
      });
      return;
    }

    if (request.method() === "DELETE" && path.endsWith("/spotify")) {
      expect(request.headers()["x-csrf-token"]).toBe("csrf-token");
      state.disconnectedProvider = "spotify";
      accounts = accounts.map((account) =>
        account.provider === "spotify"
          ? { ...account, revokedAt: "2026-07-10T10:00:00.000Z" }
          : account,
      );
      await fulfillData(route, {
        providers: providerStatuses(unavailable),
        accounts,
      });
      return;
    }

    if (request.method() === "GET" && path.endsWith("/me/integrations")) {
      if (options.onOwnerRequest && !options.onOwnerRequest()) {
        await route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({ ok: false, error: "Connections are temporarily unavailable." }),
        });
        return;
      }

      await fulfillData(route, {
        providers: providerStatuses(unavailable),
        accounts,
      });
      return;
    }

    await route.fulfill({
      status: 404,
      contentType: "application/json",
      body: JSON.stringify({ ok: false, error: "Not found." }),
    });
  });

  await page.route("**/api/me/onboarding", (route) =>
    fulfillData(route, {
      steps: [],
      completedSteps: [],
      skippedSteps: [],
      providerLinks: {},
      finishedAt: "2026-06-26 12:00:00",
      dismissedAt: null,
      createdAt: "2026-06-26 12:00:00",
      updatedAt: "2026-06-26 12:00:00",
    }),
  );
  await page.route("**/api/me/push", (route) =>
    fulfillData(route, {
      supported: false,
      configured: false,
      storageReady: true,
      publicKey: "",
      enabled: false,
      subscriptionCount: 0,
      subscriptions: [],
      diagnostics: { missingConfigKeys: [], curlAvailable: true, opensslAvailable: true },
    }),
  );
  await page.route("**/api/rooms", (route) => fulfillData(route, []));
  await page.route("**/api/notifications", (route) =>
    fulfillData(route, { notifications: [], unreadCount: 0 }),
  );

  return state;
}

function providerStatuses(unavailable: Set<string>) {
  return [...providers, "apple_music"].map((provider) => ({
    provider,
    configured: provider !== "apple_music" && !unavailable.has(provider),
    oauthEnabled: provider !== "apple_music" && !unavailable.has(provider),
    linkSupported: true,
    metadataEnabled: true,
    missingConfigKeys: unavailable.has(provider)
      ? [`integrations.${provider}.client_id`, `integrations.${provider}.client_secret`]
      : [],
  }));
}

function connectedAccount(provider: string, displayName: string) {
  return {
    provider,
    providerAccountId: `${provider}-viewer`,
    providerHandle: "viewer",
    displayName,
    avatarUrl: null,
    scopes: [],
    tokenExpiresAt: null,
    connectedAt: "2026-07-10T09:00:00.000Z",
    refreshedAt: "2026-07-10T09:00:00.000Z",
    revokedAt: null,
    lastError: null,
    errorAt: null,
  };
}

async function fulfillData(route: Route, data: unknown) {
  await route.fulfill({
    contentType: "application/json",
    body: JSON.stringify({ ok: true, data }),
  });
}
