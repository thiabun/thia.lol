import { expect, type Page, test } from "@playwright/test";

const bugReportUrl =
  "https://github.com/thiabun/thia.lol/issues/new?template=bug_report.yml";

const legalPages = [
  { path: "/terms", heading: "Terms of Service" },
  { path: "/privacy", heading: "Privacy Policy" },
  { path: "/cookies", heading: "Cookie Policy" },
  { path: "/community-guidelines", heading: "Community Guidelines" },
  { path: "/copyright", heading: "Copyright and Takedown Policy" },
  { path: "/moderation", heading: "Moderation Policy" },
  { path: "/legal", heading: "Legal and trust" },
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
  }
});

test("legal contact route resolves to the legal index", async ({ page }) => {
  await page.goto("/legal/contact");

  await expect(page).toHaveURL(/\/legal$/);
  await expect(
    page.getByRole("heading", { name: "Legal and trust", level: 1 }),
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
  await expect(footerLinks).toBeVisible();

  for (const label of [
    "Terms",
    "Privacy",
    "Cookies",
    "Guidelines",
    "Copyright",
    "Moderation",
    "Legal",
  ]) {
    await expect(footerLinks.getByRole("link", { name: label })).toBeVisible();
  }

  await expect(footerLinks.getByRole("link", { name: "Report a bug" })).toHaveAttribute(
    "href",
    bugReportUrl,
  );

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
  expect(bodyText).not.toContain("Analytics cookies help us");
  expect(bodyText).not.toContain("Marketing cookies help us");
});

test("privacy and terms explain integrations, embeds, and rich media", async ({
  page,
}) => {
  await page.goto("/privacy");
  await expect(
    page.getByRole("heading", { name: "Privacy Policy", level: 1 }),
  ).toBeVisible();
  const privacyText = await page.locator("body").innerText();

  expect(privacyText).toContain("Spotify, Apple Music, YouTube, Twitch, GitHub");
  expect(privacyText).toContain("OAuth access and refresh tokens");
  expect(privacyText).toContain("encrypted server-side");
  expect(privacyText).toContain("Metadata cache records");
  expect(privacyText).toContain("User-supplied iframe HTML is not stored or rendered.");
  expect(privacyText).toContain("Provider passwords are never requested or stored");

  await page.goto("/terms");
  await expect(
    page.getByRole("heading", { name: "Terms of Service", level: 1 }),
  ).toBeVisible();
  const termsText = await page.locator("body").innerText();

  expect(termsText).toContain("Profiles, modules, and integrations");
  expect(termsText).toContain("Image backgrounds");
  expect(termsText).toContain("video backgrounds");
  expect(termsText).toContain("Removing a profile module removes it from the canvas");
  expect(termsText).toContain("The platform does not allow arbitrary user-supplied iframe HTML.");
});

test("guidelines and moderation cover external profile content", async ({
  page,
}) => {
  await page.goto("/community-guidelines");
  await expect(
    page.getByRole("heading", { name: "Community Guidelines", level: 1 }),
  ).toBeVisible();
  await expect(page.getByText("Profiles and external content")).toBeVisible();
  await expect(page.getByText("thia.lol can moderate what appears on thia.lol")).toBeVisible();

  await page.goto("/moderation");
  await expect(
    page.getByRole("heading", { name: "Moderation Policy", level: 1 }),
  ).toBeVisible();
  const moderationText = await page.locator("body").innerText();
  expect(moderationText).toContain("Profile reports can include profile modules");
  expect(moderationText).toContain("third-party services remain responsible");
});

test("copyright page includes third-party icon attribution", async ({ page }) => {
  await page.goto("/copyright");

  await expect(
    page.getByRole("heading", { name: "Third-party brand icons" }),
  ).toBeVisible();
  await expect(page.getByText("Simple Icons via react-icons")).toBeVisible();
  await expect(page.getByText("does not imply endorsement")).toBeVisible();
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
