import { expect, test } from "@playwright/test";
import { loginWithEnv, skipWithoutCredentials } from "../helpers/auth";

test("/rooms renders API rooms or the real empty state", async ({ page }) => {
  await page.goto("/rooms");

  await expect(page.getByTestId("rooms-page")).toBeVisible();
  await expect(page.getByRole("heading", { name: /rooms|find a place to post/i })).toBeVisible();

  await expect
    .poll(async () => {
      const roomCards = await page.getByTestId("room-card").count();
      const emptyStates = await page.getByText("No public rooms yet").count();

      return roomCards > 0 || emptyStates > 0;
    }, { message: "Rooms should render from the API or show the empty state" })
    .toBe(true);
});

test("clicking a room opens its detail page", async ({ page }) => {
  await page.goto("/rooms");

  await expect
    .poll(async () => {
      const roomCards = await page.getByTestId("room-card").count();
      const emptyStates = await page.getByText("No public rooms yet").count();

      return roomCards > 0 || emptyStates > 0;
    }, { message: "Rooms should finish loading" })
    .toBe(true);

  const firstRoom = page.getByTestId("room-card").first();

  test.skip((await firstRoom.count()) === 0, "No rooms are available to open.");

  const link = firstRoom.getByRole("link").first();
  const href = await link.getAttribute("href");

  expect(href).toMatch(/^\/rooms\/[a-z0-9-]+$/);

  await link.click();
  await expect(page).toHaveURL(new RegExp(`${href!.replace("/", "\\/")}$`));
  await expect(page.getByTestId("room-page")).toBeVisible();
});

test("room page Post button opens composer with room preselected", async ({ page }) => {
  skipWithoutCredentials();

  await loginWithEnv(page);
  await page.goto("/rooms");

  await expect
    .poll(async () => {
      const roomCards = await page.getByTestId("room-card").count();
      const emptyStates = await page.getByText("No public rooms yet").count();

      return roomCards > 0 || emptyStates > 0;
    }, { message: "Rooms should finish loading" })
    .toBe(true);

  const firstRoom = page.getByTestId("room-card").first();

  test.skip((await firstRoom.count()) === 0, "No rooms are available for posting.");

  const link = firstRoom.getByRole("link").first();
  const href = await link.getAttribute("href");
  const slug = href?.split("/").pop();

  expect(slug).toBeTruthy();

  await link.click();
  await page.getByTestId("room-post-button").click();

  const dialog = page.getByTestId("composer-modal");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByTestId("composer-room-selector")).toHaveValue(slug!);
  await expect(dialog.getByText(`/${slug}`)).toBeVisible();
});
