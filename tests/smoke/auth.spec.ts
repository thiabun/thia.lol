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

    await expect(menu.getByRole("menuitem", { name: "Profile" })).toBeVisible();
    await expect(menu.getByRole("menuitem", { name: "Admin" })).toBeVisible();
    await expect(menu.getByRole("menuitem", { name: "Log out" })).toBeVisible();

    const profileClass = await menu
      .getByRole("menuitem", { name: "Profile" })
      .evaluate((element) => element.getAttribute("class"));
    const logoutClass = await menu
      .getByRole("menuitem", { name: "Log out" })
      .evaluate((element) => element.getAttribute("class"));
    const profileBox = await menu
      .getByRole("menuitem", { name: "Profile" })
      .boundingBox();
    const logoutBox = await menu
      .getByRole("menuitem", { name: "Log out" })
      .boundingBox();

    expect(logoutClass).toBe(profileClass);
    expect(profileBox?.height).toBe(logoutBox?.height);

    await page.setViewportSize({ width: 390, height: 844 });
    const mobileNav = page.getByTestId("mobile-nav");
    await expect(mobileNav).toBeVisible();
    await expect(mobileNav.getByRole("link", { name: "Admin" })).toHaveCount(0);
  });

  test("account menu links to own profile with profile tabs", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    const session = await loginWithEnv(page);
    const handle = session.data?.user?.handle;

    expect(handle).toEqual(expect.any(String));

    await page.getByRole("button", { name: /account menu/i }).click();
    await page.getByRole("menuitem", { name: "Profile" }).click();
    await expect(page).toHaveURL(new RegExp(`/@${handle}$`));

    await expect(
      page.getByRole("heading", {
        level: 1,
        name: session.data?.user?.displayName ?? "",
      }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Customize profile" })).toBeVisible();

    const tabs = page.getByRole("tablist", { name: "Profile sections" });
    await expect(tabs.getByRole("tab", { name: /Feed/ })).toBeVisible();
    await expect(tabs.getByRole("tab", { name: /Replies/ })).toBeVisible();
    await expect(tabs.getByRole("tab", { name: /Rooms/ })).toBeVisible();
    await expect(tabs.getByRole("tab", { name: /Reblogs/ })).toHaveCount(0);
    await expect(tabs.getByRole("tab", { name: /Badges/ })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Badges/ })).toBeVisible();
  });

  test("composer shows destination, image upload, and text controls in order", async ({
    page,
  }) => {
    await loginWithEnv(page);

    await page.getByRole("button", { name: "Post", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "New post" });
    await expect(dialog).toBeVisible();

    const destination = dialog.getByLabel("Post to");
    const imageUpload = dialog.getByText("Upload image").first();
    const body = dialog.getByRole("textbox", { name: "Post" });

    await expect(destination).toBeVisible();
    await expect(imageUpload).toBeVisible();
    await expect(body).toBeVisible();
    await expect(dialog.getByText(/video/i)).toHaveCount(0);

    const destinationBox = await destination.boundingBox();
    const imageUploadBox = await imageUpload.boundingBox();
    const bodyBox = await body.boundingBox();

    expect(destinationBox).not.toBeNull();
    expect(imageUploadBox).not.toBeNull();
    expect(bodyBox).not.toBeNull();
    expect(destinationBox!.y).toBeLessThan(imageUploadBox!.y);
    expect(imageUploadBox!.y).toBeLessThan(bodyBox!.y);
  });

  test("profile edit opens with real image upload controls", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    const session = await loginWithEnv(page);
    const handle = session.data?.user?.handle;

    expect(handle).toEqual(expect.any(String));

    await page.goto(`/@${handle}`);
    await page.getByRole("button", { name: "Customize profile" }).click();

    const dialog = page.getByRole("dialog", { name: "Customize profile" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel("Display name")).toBeVisible();
    await dialog.getByRole("button", { name: /Appearance/ }).click();
    await expect(dialog.getByText("Change avatar").first()).toBeVisible();
    await expect(dialog.getByText("Change banner").first()).toBeVisible();
    await expect(dialog.getByText("Image must be 10 MB or smaller")).toHaveCount(3);
    await expect(dialog.getByText(/video/i)).toHaveCount(0);
  });
});
