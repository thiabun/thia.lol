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

  await page.setViewportSize({ width: 320, height: 568 });
  const themeToggle = page.getByTestId("theme-menu-trigger");
  await expect(themeToggle).toHaveAccessibleName("Choose theme, current Light");
  await themeToggle.tap();

  const themeMenu = page.getByTestId("theme-menu");
  await expect(themeMenu).toBeVisible();
  const lightChoice = themeMenu.getByRole("radio", { name: "Light", exact: true });
  const darkChoice = themeMenu.getByRole("radio", { name: "Dark", exact: true });
  const profileChoice = themeMenu.getByRole("radio", {
    name: "Profile Theme",
    exact: true,
  });
  await expect(lightChoice).toBeChecked();
  await expect(darkChoice).toBeEnabled();
  await expect(profileChoice).toBeDisabled();

  const menuBox = await themeMenu.boundingBox();
  expect(menuBox).not.toBeNull();
  expect(menuBox!.x).toBeGreaterThanOrEqual(0);
  expect(menuBox!.x + menuBox!.width).toBeLessThanOrEqual(320);

  const undersizedThemeChoices = await themeMenu
    .getByRole("radio")
    .evaluateAll((controls) =>
      controls
        .map((control) => {
          const rect = control.getBoundingClientRect();
          return { height: rect.height, width: rect.width };
        })
        .filter((control) => control.height < 44 || control.width < 44),
    );
  expect(undersizedThemeChoices).toEqual([]);

  await darkChoice.tap();
  await expect(themeMenu).toHaveCount(0);
  await expect(themeToggle).toHaveAccessibleName("Choose theme, current Dark");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.locator("html")).toHaveAttribute("data-theme-choice", "dark");
  await expect
    .poll(() => page.evaluate(() => window.localStorage.getItem("thia.lol.theme")))
    .toBe("dark");

  await page.goto("/");
  await expect(page.getByTestId("anonymous-home-header")).toBeVisible();
  await page.getByRole("button", { name: "Open navigation menu" }).click();
  await expect(page.locator('[data-testid="theme-menu-trigger"]:visible')).toHaveAccessibleName(
    "Choose theme, current Dark",
  );
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth + 1,
      ),
    )
    .toBe(true);
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
