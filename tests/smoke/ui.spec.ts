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
  "A softer place to post",
  "Fresh notes from around the site",
  "friendly profiles",
  "Signals from public posts",
  "sexy social",
  "Your corner of thia.lol",
  "soft systems",
  "moon notes",
  "platform rituals",
  "Moon Table",
  "Soft Launch",
  "Garden Protocol",
  "Afterglow",
  "low blue",
  "green signal",
  "honey static",
  "backend",
  "dev",
  "API",
  "fallback",
  "mock",
  "demo",
];

test("desktop primary nav shows platform sections without Admin", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");

  const nav = page.getByTestId("desktop-nav");
  await expect(nav).toBeVisible();

  for (const label of ["Home", "Discover", "Rooms", "Chat"]) {
    await expect(nav.getByRole("link", { name: label })).toBeVisible();
  }

  await expect(nav.getByRole("link", { name: "Admin" })).toHaveCount(0);
});

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

  const nav = page.getByTestId("mobile-nav");
  await expect(nav).toBeVisible();
  await expect(nav.getByRole("button", { name: "Post" })).toBeVisible();
});

test("mobile primary nav shows platform sections without Admin", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  const nav = page.getByTestId("mobile-nav");
  await expect(nav).toBeVisible();

  for (const label of ["Home", "Discover", "Rooms", "Chat"]) {
    await expect(nav.getByRole("link", { name: label })).toBeVisible();
  }

  await expect(nav.getByRole("button", { name: "Post" })).toBeVisible();
  await expect(nav.getByRole("link", { name: "Admin" })).toHaveCount(0);
});

test("chat page is honest about placeholder status", async ({ page }) => {
  await page.goto("/chat");

  await expect(page.getByRole("heading", { name: "Chat is coming soon" })).toBeVisible();
  await expect(page.getByText("Direct messages are not available yet.")).toBeVisible();
});

test("public profile route loads profile tabs", async ({ page }) => {
  await page.goto("/@thia");

  await expect(page.getByRole("heading", { name: "Thia" })).toBeVisible();
  await expect(page.getByText("@thia")).toBeVisible();
  await expect(page.getByText("Joined")).toBeVisible();

  const tabs = page.getByRole("tablist", { name: "Profile sections" });
  await expect(tabs.getByRole("tab", { name: /Posts/ })).toBeVisible();
  await expect(tabs.getByRole("tab", { name: /Replies/ })).toBeVisible();
  await expect(tabs.getByRole("tab", { name: /Reblogs/ })).toBeVisible();
  await expect(tabs.getByRole("tab", { name: /Rooms/ })).toBeVisible();
  await expect(tabs.getByRole("tab", { name: "Badges" })).toBeVisible();
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
  for (const path of ["/", "/discover", "/rooms", "/chat", "/@thia"]) {
    await page.goto(path);
    await expect(page.locator("body")).toBeVisible();

    const bodyText = await page.locator("body").innerText();

    for (const copy of retiredMockCopy) {
      expect(bodyText).not.toContain(copy);
    }
  }
});
