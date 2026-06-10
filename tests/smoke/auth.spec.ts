import { expect, test } from "@playwright/test";
import { fetchAuthMe, loginWithEnv, skipWithoutCredentials } from "../helpers/auth";

test.describe("authenticated smoke", () => {
  test.beforeEach(() => {
    skipWithoutCredentials();
  });

  test("auth persists across repeated /api/auth/me calls", async ({ page }) => {
    await loginWithEnv(page);

    const checks = [];

    for (let index = 0; index < 3; index += 1) {
      checks.push(await fetchAuthMe(page));
    }

    for (const check of checks) {
      expect(check.ok).toBe(true);
      expect(check.data?.user?.email).toBe(process.env.THIA_TEST_EMAIL);
      expect(check.data?.csrfToken).toEqual(expect.any(String));
    }
  });

  test("account menu shows authenticated actions for admin user", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    const session = await loginWithEnv(page);

    test.skip(
      session.data?.user?.role !== "admin",
      "THIA_TEST_EMAIL must be an admin user for this account-menu smoke test.",
    );

    const desktopNav = page.getByTestId("desktop-nav");
    await expect(desktopNav).toBeVisible();
    await expect(desktopNav.getByRole("link", { name: "Admin" })).toHaveCount(0);

    await page.getByRole("button", { name: /account menu/i }).click();
    const menu = page.getByRole("menu");

    await expect(menu.getByRole("menuitem", { name: "View profile" })).toBeVisible();
    await expect(menu.getByRole("menuitem", { name: "Admin" })).toBeVisible();
    await expect(menu.getByRole("menuitem", { name: "Log out" })).toBeVisible();

    await page.setViewportSize({ width: 390, height: 844 });
    const mobileNav = page.getByTestId("mobile-nav");
    await expect(mobileNav).toBeVisible();
    await expect(mobileNav.getByRole("link", { name: "Admin" })).toHaveCount(0);
  });

  test("composer shows destination, media, and text controls in order", async ({
    page,
  }) => {
    await loginWithEnv(page);

    await page.getByRole("button", { name: "Post" }).click();
    const dialog = page.getByRole("dialog", { name: "New post" });
    await expect(dialog).toBeVisible();

    const destination = dialog.getByLabel("Post to");
    const media = dialog.getByText("Add image or video");
    const body = dialog.getByLabel("Post");

    await expect(destination).toBeVisible();
    await expect(media).toBeVisible();
    await expect(body).toBeVisible();

    const destinationBox = await destination.boundingBox();
    const mediaBox = await media.boundingBox();
    const bodyBox = await body.boundingBox();

    expect(destinationBox).not.toBeNull();
    expect(mediaBox).not.toBeNull();
    expect(bodyBox).not.toBeNull();
    expect(destinationBox!.y).toBeLessThan(mediaBox!.y);
    expect(mediaBox!.y).toBeLessThan(bodyBox!.y);
  });
});
