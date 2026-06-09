import { expect, test } from "@playwright/test";

test("reply button opens an unclipped thread modal", async ({ page }) => {
  await page.goto("/");

  const replyButton = page.getByRole("button", { name: /open replies/i }).first();

  test.skip((await replyButton.count()) === 0, "No posts are available to open.");

  await replyButton.click();

  const dialog = page.getByRole("dialog", { name: "Thread" });
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
  await expect(page.getByRole("menu")).toBeVisible();

  await expect(page.getByRole("navigation", { name: "Primary" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Create post" })).toBeVisible();
});
