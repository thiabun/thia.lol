import { expect, type Page, test } from "@playwright/test";

const steps = [
  "profile_basics",
  "spotify",
  "youtube",
  "twitch",
  "github",
  "apple_music",
  "profile_canvas",
];

test.beforeEach(async ({ page }) => {
  await page.route("**/api/**", async (route) => {
    await route.fulfill({
      status: 404,
      contentType: "application/json",
      body: JSON.stringify({
        ok: false,
        error: `Unmocked API route: ${route.request().method()} ${new URL(route.request().url()).pathname}`,
      }),
    });
  });
});

test("registration lands in the guided onboarding flow", async ({ page }) => {
  let authenticated = false;
  let registerPayload: Record<string, unknown> | undefined;
  const state = onboardingState();

  await mockAuth(page, () => authenticated);
  await page.route("**/api/auth/register", async (route) => {
    registerPayload = (await route.request().postDataJSON()) as Record<
      string,
      unknown
    >;
    authenticated = true;
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, data: authSession() }),
    });
  });
  await mockNotifications(page);
  await mockOnboarding(page, state);
  await mockIntegrations(page);

  await page.goto("/register");
  await expect(page.getByTestId("handle-prefix")).toHaveCount(0);
  await page.getByLabel("Display name").fill("Onboard Tester");
  await page.getByLabel("Handle").fill("onboardtester");
  await expect(page.getByTestId("handle-prefix")).toBeVisible();
  await page.getByLabel("Email").fill("onboard@example.test");
  await page.getByLabel("Password").fill("password-12345");
  await page.getByRole("button", { name: "Create account" }).click();

  await expect.poll(() => registerPayload?.handle).toBe("onboardtester");
  await expect(page).toHaveURL(/\/onboarding$/);
  await expect(page.getByRole("heading", { name: "Profile setup" })).toBeVisible();
  await expect(page.getByTestId("onboarding-step-welcome")).toBeVisible();
});

test("registration accepts an explicit @ handle without a duplicate prefix", async ({
  page,
}) => {
  let authenticated = false;
  let registerPayload: Record<string, unknown> | undefined;
  const state = onboardingState();

  await mockAuth(page, () => authenticated);
  await page.route("**/api/auth/register", async (route) => {
    registerPayload = (await route.request().postDataJSON()) as Record<
      string,
      unknown
    >;
    authenticated = true;
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, data: authSession() }),
    });
  });
  await mockNotifications(page);
  await mockOnboarding(page, state);
  await mockIntegrations(page);

  await page.goto("/register");
  await page.getByLabel("Display name").fill("At Tester");
  await page.getByLabel("Handle").fill("@attester");
  await expect(page.getByTestId("handle-prefix")).toHaveCount(0);
  await page.getByLabel("Email").fill("at-tester@example.test");
  await page.getByLabel("Password").fill("password-12345");
  await page.getByRole("button", { name: "Create account" }).click();

  await expect.poll(() => registerPayload?.handle).toBe("attester");
  await expect(page).toHaveURL(/\/onboarding$/);
});

test("existing authenticated users are routed into onboarding when unfinished", async ({
  page,
}) => {
  const state = onboardingState();

  await mockAuth(page, () => true);
  await mockNotifications(page);
  await mockOnboarding(page, state);
  await mockIntegrations(page);

  await page.goto("/discover");
  await expect(page).toHaveURL(/\/onboarding$/);
  await expect(page.getByRole("heading", { name: "Profile setup" })).toBeVisible();
});

test("unfinished users can open their profile and editor from onboarding", async ({
  page,
}) => {
  const state = onboardingState();

  await mockAuth(page, () => true);
  await mockNotifications(page);
  await mockOnboarding(page, state);
  await mockIntegrations(page);

  await page.goto("/onboarding");
  await page.getByTestId("onboarding-nav-profile_basics").click();
  await page.getByTestId("onboarding-open-profile-tour").click();

  await expect(page).toHaveURL(/\/@thia\?editCanvas=1&tour=profile-editor$/);
  await page.waitForTimeout(250);
  await expect(page).not.toHaveURL(/\/onboarding$/);

  await page.goto("/onboarding");
  await page.getByTestId("onboarding-nav-profile_basics").click();
  await page.getByRole("link", { name: "View profile" }).click();

  await expect(page).toHaveURL(/\/@thia$/);
  await page.waitForTimeout(250);
  await expect(page).not.toHaveURL(/\/onboarding$/);
});

test("onboarding handles OAuth returns, manual links, skip, connect, and finish", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  const state = onboardingState();
  const patches: Array<Record<string, unknown>> = [];
  let spotifyStartPayload: Record<string, unknown> | undefined;

  await mockAuth(page, () => true);
  await mockNotifications(page);
  await mockOnboarding(page, state, patches);
  await mockIntegrations(page, [
    {
      provider: "youtube",
      providerAccountId: "channel-1",
      providerHandle: "@thia",
      displayName: "Thia",
      avatarUrl: null,
      scopes: [],
      connectedAt: "2026-06-19 12:00:00",
    },
  ]);
  await page.route("**/api/me/integrations/spotify/start", async (route) => {
    spotifyStartPayload = (await route.request().postDataJSON()) as Record<
      string,
      unknown
    >;
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: {
          provider: "spotify",
          authorizationUrl:
            "/onboarding?integrationProvider=spotify&integrationStatus=connected",
          stateExpiresIn: 600,
        },
      }),
    });
  });
  await page.route("**/api/me/integrations/metadata/resolve", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: appleMusicCard(),
      }),
    });
  });

  await page.goto("/onboarding?integrationProvider=youtube&integrationStatus=connected");
  await expect(page.getByText("YouTube connected.")).toBeVisible();
  await expect(page).toHaveURL(/\/onboarding$/);
  await expect(page.getByTestId("onboarding-step-integrations")).toBeVisible();
  await expect
    .poll(() => patches.some((patch) => patch.action === "complete_step" && patch.step === "youtube"))
    .toBe(true);

  await page.getByTestId("onboarding-nav-profile_basics").click();
  await page.getByTestId("onboarding-profile-basics-skip").click();
  await expect
    .poll(() => patches.some((patch) => patch.action === "skip_step" && patch.step === "profile_basics"))
    .toBe(true);

  await page.getByTestId("onboarding-nav-apple_music").click();
  await page
    .getByTestId("onboarding-apple-music-url")
    .fill("https://music.apple.com/us/album/example/1?i=2");
  await page.getByTestId("onboarding-apple-music-save").click();
  await expect(page.getByText("Apple Music link saved.")).toBeVisible();
  await expect
    .poll(() =>
      patches.some(
        (patch) =>
          patch.action === "save_provider_link" &&
          patch.provider === "apple_music",
      ),
    )
    .toBe(true);

  await page.getByTestId("onboarding-nav-integrations").click();
  await page.getByTestId("onboarding-connect-spotify").click();
  await expect.poll(() => spotifyStartPayload?.redirectPath).toBe("/onboarding");

  await page.getByTestId("onboarding-nav-finish").click();
  await page.getByTestId("onboarding-finish").click();
  await expect
    .poll(() => patches.some((patch) => patch.action === "finish"))
    .toBe(true);
});

test("onboarding stays usable when integration storage is unavailable", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  const state = onboardingState();

  await mockAuth(page, () => true);
  await mockNotifications(page);
  await mockOnboarding(page, state);
  await page.route("**/api/me/integrations", async (route) => {
    await route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ ok: false, error: "Integration storage is not ready." }),
    });
  });
  await mockIntegrationDiagnostics(page, {
    storageReady: false,
    encryptionConfigured: true,
    encryptionAvailable: true,
  });

  await page.goto("/onboarding");
  await page.getByTestId("onboarding-nav-integrations").click();

  await expect(page.getByTestId("onboarding-step-integrations")).toBeVisible();
  await expect(page.getByTestId("onboarding-integrations-error")).toContainText(
    "Integration storage is not ready",
  );
  await expect(page.getByTestId("onboarding-provider-message-spotify")).toContainText(
    "Integration tables are not ready",
  );
  await expect(page.getByTestId("onboarding-connect-spotify")).toBeDisabled();
});

async function mockAuth(page: Page, authenticated: () => boolean) {
  await page.route("**/api/auth/me", async (route) => {
    if (!authenticated()) {
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ ok: false, error: "Unauthenticated." }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, data: authSession() }),
    });
  });
}

async function mockNotifications(page: Page) {
  await page.route("**/api/notifications", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, data: { notifications: [], unreadCount: 0 } }),
    });
  });
}

async function mockOnboarding(
  page: Page,
  state: ReturnType<typeof onboardingState>,
  patches: Array<Record<string, unknown>> = [],
) {
  await page.route("**/api/me/onboarding", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, data: state }),
      });
      return;
    }

    if (route.request().method() === "PATCH") {
      const patch = (await route.request().postDataJSON()) as Record<string, unknown>;
      patches.push(patch);
      applyOnboardingPatch(state, patch);
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, data: state }),
      });
      return;
    }

    await route.fulfill({
      status: 405,
      contentType: "application/json",
      body: JSON.stringify({ ok: false, error: "Method not allowed." }),
    });
  });
}

async function mockIntegrations(
  page: Page,
  accounts: Array<Record<string, unknown>> = [],
) {
  await page.route("**/api/me/integrations", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: {
          providers: ["spotify", "youtube", "twitch", "github", "apple_music"].map(
            (provider) => ({
              provider,
              configured: provider !== "apple_music",
              oauthEnabled: provider !== "apple_music",
              linkSupported: true,
              metadataEnabled: true,
              missingConfigKeys: [],
            }),
          ),
          accounts,
        },
      }),
    });
  });
  await mockIntegrationDiagnostics(page);
}

async function mockIntegrationDiagnostics(
  page: Page,
  overrides: Partial<{
    storageReady: boolean;
    encryptionConfigured: boolean;
    encryptionAvailable: boolean;
  }> = {},
) {
  await page.route("**/api/me/integrations/diagnostics", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: {
          storageReady: overrides.storageReady ?? true,
          encryptionConfigured: overrides.encryptionConfigured ?? true,
          encryptionAvailable: overrides.encryptionAvailable ?? true,
          cryptoMethod: "sodium",
          oauthStateExpiresIn: 600,
          providers: ["spotify", "youtube", "twitch", "github", "apple_music"].map(
            (provider) => ({
              provider,
              configured: provider !== "apple_music",
              oauthEnabled: provider !== "apple_music",
              linkSupported: true,
              metadataEnabled: true,
              redirectUri:
                provider === "apple_music"
                  ? null
                  : `https://thia.lol/api/integrations/${provider}/callback`,
              missingConfigKeys: [],
            }),
          ),
        },
      }),
    });
  });
}

function authSession() {
  return {
    user: {
      id: 1,
      handle: "thia",
      email: "thia@example.test",
      role: "member",
      status: "active",
      displayName: "Thia",
      avatarUrl: null,
    },
    profile: {
      displayName: "Thia",
      bio: "",
      location: "",
      avatarUrl: null,
      links: [],
      traits: [],
    },
    csrfToken: "test-csrf",
  };
}

function onboardingState() {
  return {
    steps: [...steps],
    completedSteps: [] as string[],
    skippedSteps: [] as string[],
    providerLinks: {} as Record<string, unknown>,
    finishedAt: null,
    dismissedAt: null,
    createdAt: "2026-06-19 12:00:00",
    updatedAt: "2026-06-19 12:00:00",
  };
}

function applyOnboardingPatch(
  state: ReturnType<typeof onboardingState>,
  patch: Record<string, unknown>,
) {
  if (patch.action === "complete_step" && typeof patch.step === "string") {
    state.completedSteps = unique([...state.completedSteps, patch.step]);
    state.skippedSteps = state.skippedSteps.filter((step) => step !== patch.step);
  }

  if (patch.action === "skip_step" && typeof patch.step === "string") {
    state.skippedSteps = unique([...state.skippedSteps, patch.step]);
    state.completedSteps = state.completedSteps.filter((step) => step !== patch.step);
  }

  if (
    patch.action === "save_provider_link" &&
    typeof patch.provider === "string" &&
    typeof patch.url === "string"
  ) {
    state.providerLinks[patch.provider] = {
      provider: patch.provider,
      url: patch.url,
      resourceType: "album",
      resourceId: "2",
      savedAt: "2026-06-19T12:00:00Z",
    };
    state.completedSteps = unique([...state.completedSteps, patch.provider]);
  }

  if (patch.action === "finish") {
    state.finishedAt = "2026-06-19 12:10:00";
  }
}

function unique(values: string[]) {
  return [...new Set(values)].filter((value) => steps.includes(value));
}

function appleMusicCard() {
  return {
    provider: "apple_music",
    resourceType: "album",
    resourceId: "2",
    resourceKey: "apple_music:album:2",
    sourceUrl: "https://music.apple.com/us/album/example/1?i=2",
    apiBacked: false,
    fetchedAt: "2026-06-19T12:00:00Z",
    expiresAt: "2026-06-19T13:00:00Z",
    staleAt: "2026-06-20T12:00:00Z",
    metadata: {
      title: "Apple Music album",
      subtitle: "Apple Music",
      description: null,
      imageUrl: null,
      live: false,
      liveFetchedAt: null,
      recentLabel: null,
      recentFetchedAt: null,
      stats: {},
    },
    embed: null,
  };
}
