import { expect, test, type Page } from "@playwright/test";

test("mobile Chrome keeps shell forms contained and touch sized", async ({ page }) => {
  await mockAnonymousApi(page);
  await page.goto("/login");
  await page.getByTestId("cookie-notice").getByRole("button", { name: "Continue" }).tap();
  await expect(page.getByRole("heading", { name: "Sign in", exact: true })).toBeVisible();

  for (const viewport of [
    { width: 320, height: 568 },
    { width: 360, height: 780 },
    { width: 390, height: 844 },
    { width: 430, height: 932 },
    { width: 844, height: 390 },
  ]) {
    await page.setViewportSize(viewport);
    await expect
      .poll(() =>
        page.evaluate(
          () => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
        ),
      )
      .toBe(true);

    const undersized = await page
      .locator('main button:visible, main input:visible, header button:visible')
      .evaluateAll((controls) =>
        controls
          .map((control) => {
            const rect = control.getBoundingClientRect();
            return {
              label:
                control.getAttribute("aria-label") ??
                control.getAttribute("name") ??
                control.textContent?.trim() ??
                control.tagName,
              height: rect.height,
              width: rect.width,
            };
          })
          .filter(
            (control) =>
              control.height > 0 &&
              control.width > 0 &&
              (control.height < 44 || control.width < 44),
          ),
      );

    expect(undersized).toEqual([]);
  }

  const themeToggle = page.getByRole("button", { name: /Switch to/ });
  const initialLabel = await themeToggle.getAttribute("aria-label");
  await themeToggle.tap();
  await expect(themeToggle).not.toHaveAttribute("aria-label", initialLabel ?? "");
});

async function mockAnonymousApi(page: Page) {
  await page.route("**/api/**", (route) =>
    route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({ ok: false, error: "Not authenticated." }),
    }),
  );
}
