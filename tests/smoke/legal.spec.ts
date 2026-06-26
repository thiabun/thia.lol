import { expect, type Page, test } from "@playwright/test";

const bugReportUrl =
  "https://github.com/thiabun/thia.lol/issues/new?template=bug_report.yml";
const supportUrl = "https://ko-fi.com/thiabun";

const legalPages = [
  { path: "/legal", heading: "Trust Center" },
  { path: "/terms", heading: "Terms of Service" },
  { path: "/privacy", heading: "Privacy Policy" },
  { path: "/cookies", heading: "Cookie Policy" },
  { path: "/community-guidelines", heading: "Community Guidelines" },
  { path: "/copyright", heading: "Copyright and Takedown Policy" },
  { path: "/moderation", heading: "Moderation Policy" },
  { path: "/data-export", heading: "Data Export / Portability Policy" },
  { path: "/account-deletion", heading: "Data Deletion and Account Closure Policy" },
  { path: "/refunds", heading: "Paid Features, Billing and Refund Policy" },
  { path: "/appeals", heading: "Appeals Policy" },
  { path: "/safety", heading: "Safety and Abuse Response Policy" },
  { path: "/content-ownership", heading: "Content Ownership and License Policy" },
  { path: "/no-dark-patterns", heading: "No Dark Patterns Policy" },
  { path: "/monetization-ethics", heading: "Advertising and Monetization Ethics Policy" },
  { path: "/ai-policy", heading: "AI Policy" },
  { path: "/security", heading: "Security Policy" },
  { path: "/vulnerability-disclosure", heading: "Vulnerability Disclosure Policy" },
  { path: "/transparency", heading: "Transparency Report Policy" },
  { path: "/law-enforcement", heading: "Law Enforcement and Government Request Policy" },
  { path: "/creator-marketplace", heading: "Creator / Marketplace Policy" },
  { path: "/accessibility", heading: "Accessibility Policy" },
  { path: "/incident-response", heading: "Incident Response Policy" },
];

test.beforeEach(async ({ page }) => {
  await mockPublicShell(page);
});

test("public legal and trust pages load", async ({ page }) => {
  for (const legalPage of legalPages) {
    await page.goto(legalPage.path);
    await expect(
      page.getByRole("heading", { name: legalPage.heading, level: 1 }),
    ).toBeVisible();

    if (legalPage.path === "/legal") {
      await expect(page.getByTestId("legal-brand-logo-main")).toBeVisible();
    } else {
      await expect(page.getByTestId("policy-brand-mark")).toBeVisible();
    }
  }
});

test("legal contact route resolves to the legal index", async ({ page }) => {
  await page.goto("/legal/contact");

  await expect(page).toHaveURL(/\/legal$/);
  await expect(
    page.getByRole("heading", { name: "Trust Center", level: 1 }),
  ).toBeVisible();
});

test("footer and account menu expose legal links discreetly", async ({ page }) => {
  await page.goto("/privacy");

  const footer = page.getByTestId("site-footer");
  await expect(footer).toContainText(
    "© 2026 Thia Markussen. Alle rettigheter forbeholdt / All rights reserved.",
  );
  await expect(footer).toContainText(
    "Beskyttet etter norsk opphavsrett og internasjonal opphavsrett / Protected under Norwegian and international copyright law.",
  );

  const footerLinks = page.getByTestId("legal-footer-links");
  await expect(page.getByTestId("site-footer-brand")).toHaveCount(0);
  await expect(page.getByTestId("site-footer-brand-lockup")).toHaveCount(0);
  await expect(footerLinks).toBeVisible();

  for (const label of [
    "Trust Center",
    "Terms",
    "Privacy",
    "Guidelines",
  ]) {
    await expect(footerLinks.getByRole("link", { name: label })).toBeVisible();
  }

  await expect(footerLinks.getByRole("link", { name: "Report a bug" })).toHaveAttribute(
    "href",
    bugReportUrl,
  );
  await expect(
    footerLinks.getByRole("link", { name: "Hey, want to support thia.lol?" }),
  ).toHaveAttribute("href", supportUrl);

  await page.getByRole("button", { name: /account menu/i }).click();
  await expect(page.getByTestId("account-menu")).toBeVisible();
  await expect(
    page.getByTestId("account-menu").getByRole("menuitem", { name: "Legal" }),
  ).toBeVisible();
});

test("cookie notice explains necessary cookies and can be dismissed", async ({
  page,
}) => {
  await page.goto("/cookies");
  await page.evaluate(() => window.localStorage.removeItem("thia_cookie_notice_ack"));
  await page.reload();

  const notice = page.getByTestId("cookie-notice");
  await expect(notice).toBeVisible();
  await expect(page.getByTestId("cookie-brand-mark")).toBeVisible();
  await expect(notice).toContainText("necessary cookies");
  await expect(notice).toContainText("No analytics or marketing cookies");
  await expect(notice.getByRole("link", { name: "Cookie policy" })).toBeVisible();

  await notice.getByRole("button", { name: "Continue" }).click();
  await expect(notice).toBeHidden();
  await expect(
    page.evaluate(() => window.localStorage.getItem("thia_cookie_notice_ack")),
  ).resolves.toBe("1");
});

test("primary navigation stays focused", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/terms");

  const mobileNav = page.getByTestId("mobile-nav");
  await expect(mobileNav).toBeVisible();

  for (const label of [
    "Trust Center",
    "Terms",
    "Privacy",
    "Cookies",
    "Guidelines",
    "Copyright",
    "Moderation",
    "Legal",
  ]) {
    await expect(mobileNav.getByRole("link", { name: label })).toHaveCount(0);
  }
});

test("cookie policy does not claim analytics are active", async ({ page }) => {
  await page.goto("/cookies");
  await expect(
    page.getByRole("heading", { name: "Cookie Policy", level: 1 }),
  ).toBeVisible();

  const bodyText = await page.locator("body").innerText();
  expect(bodyText).toContain(
    "It does not currently use thia.lol analytics or marketing cookies.",
  );
  expect(bodyText).toContain("Third-party embeds");
  expect(bodyText).toContain("thia.lol does not control provider cookies.");
  expect(bodyText).toContain("Spotify music embeds may already be present");
  expect(bodyText).toContain("Continue to profile");
  expect(bodyText).not.toContain("Analytics cookies help us");
  expect(bodyText).not.toContain("Marketing cookies help us");
});

test("trust center groups policies around rights, safety, promises, and operations", async ({
  page,
}) => {
  await page.goto("/legal");
  await expect(
    page.getByRole("heading", { name: "Trust Center", level: 1 }),
  ).toBeVisible();

  for (const heading of [
    "Your rights",
    "Your safety",
    "Our promises",
    "Platform operations",
  ]) {
    await expect(page.getByRole("heading", { name: heading })).toBeVisible();
  }

  await expect(page.getByRole("link", { name: /Data Export/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /AI Policy/i })).toBeVisible();
  await expect(page.locator("body")).toContainText(
    "thia.lol exists because users choose to trust us.",
  );
});

test("privacy and terms explain user-first data and content rules", async ({
  page,
}) => {
  await page.goto("/privacy");
  await expect(
    page.getByRole("heading", { name: "Privacy Policy", level: 1 }),
  ).toBeVisible();
  const privacyText = await page.locator("body").innerText();

  expect(privacyText).toContain("thia.lol does not sell personal data.");
  expect(privacyText).toContain("does not use invasive third-party trackers during public testing.");
  expect(privacyText).toContain("does not build creepy behavioral ad profiles.");
  expect(privacyText).toContain("You can download a self-service JSON export from Settings.");
  expect(privacyText).toContain("Third-party providers may receive data");

  await page.goto("/terms");
  await expect(
    page.getByRole("heading", { name: "Terms of Service", level: 1 }),
  ).toBeVisible();
  const termsText = await page.locator("body").innerText();

  expect(termsText).toContain(
    "thia.lol is intended for users 16 and older, with a mature European 16+ baseline",
  );
  expect(termsText).toContain("You should be mature in your jurisdiction");
  expect(termsText).toContain("You keep ownership");
  expect(termsText).toContain("limited, worldwide, non-exclusive license");
  expect(termsText).toContain("This license does not transfer ownership to thia.lol.");
});

test("guidelines, moderation, appeals, and AI policy cover trust promises", async ({
  page,
}) => {
  await page.goto("/community-guidelines");
  await expect(
    page.getByRole("heading", { name: "Community Guidelines", level: 1 }),
  ).toBeVisible();
  await expect(page.getByText("Community constitution")).toBeVisible();
  const communityGuidelinesText = await page.locator("body").innerText();
  expect(
    communityGuidelinesText.match(/Adults can be messy, funny, flirty, weird/g) ?? [],
  ).toHaveLength(1);
  await expect(page.locator("body")).toContainText("mature European 16+ baseline");
  await expect(page.locator("body")).toContainText("adult-first in tone");
  await expect(page.locator("body")).toContainText("You should be mature in your jurisdiction");

  await page.goto("/moderation");
  await expect(
    page.getByRole("heading", { name: "Moderation Policy", level: 1 }),
  ).toBeVisible();
  const moderationText = await page.locator("body").innerText();
  expect(moderationText).toContain("Logged-in users can report posts, replies, profiles, rooms, and chat messages");
  expect(moderationText).toContain("give users a meaningful way to appeal");

  await page.goto("/appeals");
  await expect(page.locator("body")).toContainText("We can make mistakes. You can challenge decisions.");

  await page.goto("/ai-policy");
  await expect(page.locator("body")).toContainText("AI-generated media is not allowed");
  await expect(page.locator("body")).toContainText("will not train AI models on private user content");
});

test("copyright page includes third-party icon attribution", async ({ page }) => {
  await page.goto("/copyright");

  await expect(
    page.getByRole("heading", { name: "Third-party brand icons" }),
  ).toBeVisible();
  await expect(page.getByText("Simple Icons via react-icons")).toBeVisible();
  await expect(page.getByText("does not imply endorsement")).toBeVisible();
});

test("refund, deletion, and export policies expose user-friendly rights", async ({
  page,
}) => {
  await page.goto("/refunds");
  await expect(page.locator("body")).toContainText("30-day refund promise");
  await expect(page.locator("body")).toContainText("hello@thia.lol");

  await page.goto("/account-deletion");
  await expect(page.locator("body")).toContainText("30-day grace period");
  await expect(page.locator("body")).toContainText("Export your account data before scheduling deletion");

  await page.goto("/data-export");
  await expect(page.locator("body")).toContainText("The export requires your current password");
  await expect(page.locator("body")).toContainText("Password hashes");
});

test("settings can download a mocked account data export", async ({ page }) => {
  await mockAuthenticatedSettingsShell(page);
  await page.goto("/settings");

  await expect(
    page.getByRole("heading", { name: "Data rights" }),
  ).toBeVisible();
  const dataRights = page.locator("#data-rights");
  await dataRights.getByLabel("Current password").fill("correct-password");

  const downloadPromise = page.waitForEvent("download");
  await dataRights.getByRole("button", { name: "Download export" }).click();
  const download = await downloadPromise;

  expect(download.suggestedFilename()).toMatch(
    /^thia-lol-data-export-viewer-\d{4}-\d{2}-\d{2}\.json$/,
  );
  await expect(page.getByText("Data export downloaded.")).toBeVisible();
});

async function mockPublicShell(page: Page) {
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

async function mockAuthenticatedSettingsShell(page: Page) {
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
  await page.route("**/api/me/posts**", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ ok: true, data: [] }),
    }),
  );
  await page.route("**/api/me/data-export", async (route) => {
    expect(route.request().headers()["x-csrf-token"]).toBe("csrf-token");
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: {
          schemaVersion: 1,
          generatedAt: "2026-06-26 12:00:00",
          account: {
            handle: "viewer",
          },
          profile: {
            details: null,
            modules: [],
            canvasDraft: null,
            badges: [],
          },
          preferences: {
            settings: null,
            onboarding: null,
          },
          deletion: null,
          content: {
            postsAndReplies: [],
            attachments: [],
            reactions: [],
            reblogs: [],
          },
          media: {
            profileMedia: null,
            postMedia: [],
            attachments: [],
          },
          rooms: {
            created: [],
            memberships: [],
          },
          relationships: {
            following: [],
            followers: [],
            blocks: [],
            mutes: [],
            stars: [],
            followRequestsSent: [],
            followRequestsReceived: [],
          },
          messages: {
            sentMessages: [],
          },
          moderation: {
            submittedReports: [],
            accountReportStatuses: [],
          },
          integrations: {
            accounts: [],
          },
          purchases: {
            purchases: [],
            note: "No purchase history.",
          },
          limits: {
            perSection: 500,
            note: "Large sections are capped per export request.",
          },
        },
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
}
