import { expect, test } from "@playwright/test";

const legalPages = [
  { path: "/terms", heading: "Terms of Service" },
  { path: "/privacy", heading: "Privacy Policy" },
  { path: "/cookies", heading: "Cookie Policy" },
  { path: "/community-guidelines", heading: "Community Guidelines" },
  { path: "/copyright", heading: "Copyright and Takedown Policy" },
  { path: "/moderation", heading: "Moderation Policy" },
  { path: "/legal", heading: "Legal and trust" },
];

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
    "It does not currently use analytics or marketing cookies.",
  );
  expect(bodyText).not.toContain("Analytics cookies help us");
  expect(bodyText).not.toContain("Marketing cookies help us");
});
