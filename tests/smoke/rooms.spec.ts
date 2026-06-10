import { expect, test } from "@playwright/test";
import { fetchAuthMe, loginWithEnv, skipWithoutCredentials } from "../helpers/auth";

test("/rooms renders API rooms or the real empty state", async ({ page }) => {
  await page.goto("/rooms");

  await expect(page.getByTestId("rooms-page")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Find a place to post." })).toBeVisible();

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

test("Create room button shows for logged-in users", async ({ page }) => {
  skipWithoutCredentials();

  await loginWithEnv(page);
  await page.goto("/rooms");

  await expect(page.getByTestId("rooms-page")).toBeVisible();
  await expect(page.getByTestId("create-room-button")).toBeVisible();

  await page.getByTestId("create-room-button").click();
  const modal = page.getByTestId("room-edit-modal");

  await expect(modal).toBeVisible();
  await expect(modal.getByLabel("Name")).toBeVisible();
  await expect(modal.getByLabel("Slug")).toBeVisible();
  await expect(modal.getByLabel("Summary")).toBeVisible();
  await expect(modal.getByLabel("Room rules")).toBeVisible();
  await expect(modal.getByText("Change icon")).toBeVisible();
  await expect(modal.getByText("Change banner")).toBeVisible();
});

test("join and leave room API require auth", async ({ page }) => {
  await page.goto("/rooms");

  const slug = await firstApiRoomSlug(page);

  test.skip(!slug, "No rooms are available for join API checks.");

  const joinResult = await page.evaluate(async (roomSlug) => {
    const response = await fetch(`/api/rooms/${roomSlug}/join`, {
      method: "POST",
      credentials: "include",
      headers: { Accept: "application/json" },
    });

    return {
      status: response.status,
      body: await response.json().catch(() => null),
    };
  }, slug!);

  expect(joinResult.status).toBe(401);

  const leaveResult = await page.evaluate(async (roomSlug) => {
    const response = await fetch(`/api/rooms/${roomSlug}/join`, {
      method: "DELETE",
      credentials: "include",
      headers: { Accept: "application/json" },
    });

    return {
      status: response.status,
      body: await response.json().catch(() => null),
    };
  }, slug!);

  expect(leaveResult.status).toBe(401);
});

test("room page shows join and edit states based on auth and role", async ({ page }) => {
  skipWithoutCredentials();

  await loginWithEnv(page);
  await page.goto("/rooms");

  const slug = await firstRoomSlug(page);

  test.skip(!slug, "No rooms are available for room state checks.");

  await page.goto(`/rooms/${slug}`);
  await expect(page.getByTestId("room-page")).toBeVisible();
  await expect(page.getByTestId("room-join-button")).toBeVisible();

  const auth = await fetchAuthMe(page);
  const room = await page.evaluate(async (roomSlug) => {
    const response = await fetch(`/api/rooms/${roomSlug}`, {
      credentials: "include",
      headers: { Accept: "application/json" },
    });
    const body = await response.json();

    return body.data;
  }, slug!);
  const canEdit =
    auth.data?.user?.role === "admin" ||
    room?.myRoomRole === "owner" ||
    room?.myRoomRole === "moderator";

  await expect(page.getByTestId("edit-room-button")).toHaveCount(canEdit ? 1 : 0);
});

test("rooms do not render retired room copy", async ({ page }) => {
  await page.goto("/rooms");

  await expect(page.getByText("A good room has affordances")).toHaveCount(0);
  await expect(page.getByText("mock", { exact: false })).toHaveCount(0);
  await expect(page.getByText("demo", { exact: false })).toHaveCount(0);
});

async function firstRoomSlug(page: import("@playwright/test").Page) {
  await expect
    .poll(async () => {
      const roomCards = await page.getByTestId("room-card").count();
      const emptyStates = await page.getByText("No public rooms yet").count();

      return roomCards > 0 || emptyStates > 0;
    }, { message: "Rooms should finish loading" })
    .toBe(true);

  const firstRoom = page.getByTestId("room-card").first();

  if ((await firstRoom.count()) === 0) {
    return undefined;
  }

  const href = await firstRoom.getByRole("link").first().getAttribute("href");

  return href?.split("/").pop();
}

async function firstApiRoomSlug(page: import("@playwright/test").Page) {
  const rooms = await page.evaluate(async () => {
    const response = await fetch("/api/rooms", {
      credentials: "include",
      headers: { Accept: "application/json" },
    });
    const body = await response.json().catch(() => null);

    return Array.isArray(body?.data) ? body.data : [];
  });

  const first = rooms.find((room) => typeof room?.slug === "string");

  return first?.slug as string | undefined;
}
