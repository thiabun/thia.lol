import { expect, test } from "@playwright/test";
import { loginWithEnv, skipWithoutCredentials } from "../helpers/auth";

const retiredMockCopy = [
  "Mira Vale",
  "Sol Anka",
  "Ior Rune",
  "Easygoing rooms",
  "Quiet operators",
  "Solarized socials",
  "The nicest launch state might be one where the platform feels awake",
  "A secondary profile on the platform",
  "Showing a saved view",
];

test("reply button opens an unclipped thread modal", async ({ page }) => {
  await page.goto("/");

  const replyButton = page.getByRole("button", { name: /open replies/i }).first();

  test.skip((await replyButton.count()) === 0, "No posts are available to open.");

  await replyButton.click();

  const dialog = page.getByTestId("thread-modal");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Close thread" })).toBeVisible();

  const portalStatus = await page.evaluate(() => {
    const dialogElement = document.querySelector('[role="dialog"][aria-modal="true"]');

    return dialogElement?.parentElement?.parentElement === document.body;
  });

  expect(portalStatus).toBe(true);

  const box = await dialog.boundingBox();
  const viewport = page.viewportSize();

  expect(box).not.toBeNull();
  expect(viewport).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(viewport!.width);
  expect(box!.y + box!.height).toBeLessThanOrEqual(viewport!.height);

  await dialog.getByRole("button", { name: "Close thread" }).click();
  await expect(dialog).toBeHidden();
});

test("mobile header, account menu, and bottom nav fit the viewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  await expect(page.getByLabel("thia.lol home")).toBeVisible();

  const hasOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(hasOverflow).toBe(false);

  await page.getByRole("button", { name: /account menu/i }).click();
  await expect(page.getByTestId("account-menu")).toBeVisible();

  await expect(page.getByTestId("mobile-nav")).toBeVisible();
  await expect(page.getByRole("button", { name: "Create post" })).toBeVisible();
});

test("authenticated post button opens the composer modal", async ({ page }) => {
  skipWithoutCredentials();

  await loginWithEnv(page);
  await page.getByRole("button", { name: "Post" }).click();

  const dialog = page.getByTestId("composer-modal");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Post" })).toBeVisible();

  await dialog.getByRole("button", { name: "Close post composer" }).click();
  await expect(dialog).toBeHidden();
});

test("public pages do not render retired mock social data", async ({ page }) => {
  for (const path of ["/", "/discover", "/rooms", "/@thia"]) {
    await page.goto(path);
    await expect(page.locator("body")).toBeVisible();

    const bodyText = await page.locator("body").innerText();

    for (const copy of retiredMockCopy) {
      expect(bodyText).not.toContain(copy);
    }
  }
});
