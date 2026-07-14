import { expect, test, type Page } from "@playwright/test";

const profileBackgroundUrl =
  "/uploads/media/2026/07/profile_background-theme-smoke.webp";

const profileThemeColors = {
  canvas: "#14212B",
  canvasSoft: "#1A2E3B",
  surface: "#203A49",
  surfaceStrong: "#2B4D60",
  text: "#F3F7F9",
  muted: "#B2C3CB",
  line: "#416071",
  lineStrong: "#5F8192",
  accent: "#73E4C2",
  accentInk: "#10271F",
  accentStrong: "#A5F1DC",
  focus: "#8DF0D4",
};

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("thia_cookie_notice_ack", "1");
    window.sessionStorage.setItem("thia.strokeJoke.roll:v1", "1");
    if (window.localStorage.getItem("thia.lol.theme") === null) {
      window.localStorage.setItem("thia.lol.theme", "light");
    }
    if (window.localStorage.getItem("thia.lol.theme.standard") === null) {
      window.localStorage.setItem("thia.lol.theme.standard", "light");
    }
  });
  await mockAuthenticatedThemeApi(page);
});

test("Light, Dark, and Profile Theme stay distinct and persist across the app", async ({
  page,
}) => {
  await page.goto("/discover");
  await expect(page.getByRole("heading", { name: "Discover", exact: true })).toBeVisible();

  const root = page.locator("html");
  const trigger = page.getByTestId("theme-menu-trigger");
  await expect(root).toHaveAttribute("data-theme", "light");
  await expect(root).toHaveAttribute("data-theme-choice", "light");
  await expect(trigger).toHaveAccessibleName("Choose theme, current Light");
  await expectStoredTheme(page, "light", "light");

  await trigger.click();
  const menu = page.getByTestId("theme-menu");
  await expect(menu).toBeVisible();
  await expect(menu).toHaveAttribute("role", "radiogroup");
  await expect(menu.getByRole("radio")).toHaveCount(3);
  await expect(
    menu.getByRole("radio", { name: "Light", exact: true }),
  ).toBeChecked();
  await expect(
    menu.getByRole("radio", { name: "Dark", exact: true }),
  ).toBeEnabled();
  await expect(
    menu.getByRole("radio", { name: "Profile Theme", exact: true }),
  ).toBeEnabled();
  const lightChoice = menu.getByRole("radio", { name: "Light", exact: true });
  const darkChoice = menu.getByRole("radio", { name: "Dark", exact: true });
  await lightChoice.focus();
  await page.keyboard.press("ArrowRight");
  await expect(darkChoice).toBeChecked();
  await expect(darkChoice).toBeFocused();
  await page.keyboard.press("Home");
  await expect(lightChoice).toBeChecked();
  await expect(lightChoice).toBeFocused();
  await menu
    .getByRole("radio", { name: "Profile Theme", exact: true })
    .click();

  await expect(menu).toHaveCount(0);
  await expect(trigger).toHaveAccessibleName(
    "Choose theme, current Profile Theme",
  );
  await expect(root).toHaveAttribute("data-theme", "light");
  await expect(root).toHaveAttribute("data-theme-choice", "profile");
  await expect(root).toHaveAttribute("data-profile-theme", /.+/);
  await expectStoredTheme(page, "profile", "light");

  await expectProfileThemeApplied(page);

  await page.getByTestId("desktop-post-action").click();
  const composerModal = page.getByTestId("composer-modal");
  await expect(composerModal).toBeVisible();
  const composer = composerModal.getByTestId("unified-composer");
  await expect(composer).toHaveClass(/site-profile-glass-surface/);
  await expect
    .poll(() =>
      composerModal.evaluate((element) => {
        const composer = element.querySelector<HTMLElement>(
          '[data-testid="unified-composer"]',
        );

        return {
          inheritedModuleAlpha: getComputedStyle(element)
            .getPropertyValue("--site-profile-module-alpha")
            .trim(),
          isPortaled: element.parentElement?.parentElement === document.body,
          modalUsesSharedGlassSurface: element.classList.contains(
            "site-profile-glass-surface",
          ),
          composerUsesModuleAlpha:
            composer
              ? getComputedStyle(composer)
                  .getPropertyValue("--site-profile-module-alpha")
                  .trim()
              : "",
        };
      }),
    )
    .toEqual({
      composerUsesModuleAlpha: "41%",
      inheritedModuleAlpha: "41%",
      isPortaled: true,
      modalUsesSharedGlassSurface: true,
    });
  await composerModal
    .getByRole("button", { name: "Close post composer" })
    .click();

  await page.getByRole("link", { name: "Rooms", exact: true }).first().click();
  await expect(page).toHaveURL(/\/rooms$/);
  await expect(root).toHaveAttribute("data-theme-choice", "profile");
  await expectProfileThemeApplied(page);

  await page.reload();
  await expect(trigger).toHaveAccessibleName(
    "Choose theme, current Profile Theme",
  );
  await expect(root).toHaveAttribute("data-theme-choice", "profile");
  await expectStoredTheme(page, "profile", "light");
  await expectProfileThemeApplied(page);

  await chooseTheme(page, "Light");
  await expect(root).toHaveAttribute("data-theme", "light");
  await expect(root).toHaveAttribute("data-theme-choice", "light");
  await expect(root).not.toHaveAttribute("data-profile-theme");
  await expect(page.locator('[data-site-profile-theme="true"]')).toHaveCount(0);
  await expect(page.locator('[data-site-profile-backdrop="true"]')).toHaveCount(0);
  await expectStoredTheme(page, "light", "light");
  await expectProfileRootPropertiesCleared(page);
  await expect
    .poll(() => page.evaluate(() => document.documentElement.style.colorScheme))
    .toBe("light");
  await expectThemeColor(page, "#fff6fb");

  await chooseTheme(page, "Dark");
  await expect(root).toHaveAttribute("data-theme", "dark");
  await expect(root).toHaveAttribute("data-theme-choice", "dark");
  await expect(root).not.toHaveAttribute("data-profile-theme");
  await expect(page.locator('[data-site-profile-theme="true"]')).toHaveCount(0);
  await expect(page.locator('[data-site-profile-backdrop="true"]')).toHaveCount(0);
  await expectStoredTheme(page, "dark", "dark");
  await expectProfileRootPropertiesCleared(page);
  await expect
    .poll(() => page.evaluate(() => document.documentElement.style.colorScheme))
    .toBe("dark");
  await expectThemeColor(page, "#092119");

  await chooseTheme(page, "Profile Theme");
  await expect(root).toHaveAttribute("data-theme", "dark");
  await expect(root).toHaveAttribute("data-theme-choice", "profile");
  await expectStoredTheme(page, "profile", "dark");
  await expectProfileThemeApplied(page);

  await page.reload();
  await expect(root).toHaveAttribute("data-theme", "dark");
  await expect(root).toHaveAttribute("data-theme-choice", "profile");
  await expectStoredTheme(page, "profile", "dark");
  await expectProfileThemeApplied(page);
});

async function chooseTheme(
  page: Page,
  choice: "Light" | "Dark" | "Profile Theme",
) {
  await page.getByTestId("theme-menu-trigger").click();
  const menu = page.getByTestId("theme-menu");
  await expect(menu).toBeVisible();
  await menu.getByRole("radio", { name: choice, exact: true }).click();
  await expect(menu).toHaveCount(0);
  await expect(page.getByTestId("theme-menu-trigger")).toHaveAccessibleName(
    `Choose theme, current ${choice}`,
  );
}

async function expectStoredTheme(
  page: Page,
  preference: "light" | "dark" | "profile",
  standard: "light" | "dark",
) {
  await expect
    .poll(() =>
      page.evaluate(() => ({
        preference: window.localStorage.getItem("thia.lol.theme"),
        standard: window.localStorage.getItem("thia.lol.theme.standard"),
      })),
    )
    .toEqual({ preference, standard });
}

async function expectProfileThemeApplied(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(() => {
        const rootStyle = document.documentElement.style;

        return {
          accent: rootStyle.getPropertyValue("--app-accent").trim(),
          accentContrast: rootStyle
            .getPropertyValue("--app-accent-contrast")
            .trim(),
          canvas: rootStyle.getPropertyValue("--app-canvas").trim(),
          canvasSoft: rootStyle.getPropertyValue("--app-canvas-soft").trim(),
          leaf: rootStyle.getPropertyValue("--accent-leaf").trim(),
          leafInk: rootStyle.getPropertyValue("--accent-leaf-ink").trim(),
          surface: rootStyle.getPropertyValue("--app-surface").trim(),
          surfaceStrong: rootStyle
            .getPropertyValue("--app-surface-strong")
            .trim(),
        };
      }),
    )
    .toEqual({
      accent: profileThemeColors.accent,
      accentContrast: profileThemeColors.accentInk,
      canvas: profileThemeColors.canvas,
      canvasSoft: profileThemeColors.canvasSoft,
      leaf: profileThemeColors.accent,
      leafInk: profileThemeColors.accentStrong,
      surface: profileThemeColors.surface,
      surfaceStrong: profileThemeColors.surfaceStrong,
    });

  const root = page.locator("html");
  const wrapper = page.locator('[data-site-profile-canvas-glass]');
  await expect(root).toHaveAttribute(
    "data-site-profile-theme",
    "true",
  );
  await expect(wrapper).toHaveCount(1);
  await expect(wrapper).toHaveAttribute("data-site-profile-canvas-glass", "80");
  await expect
    .poll(() =>
      wrapper.evaluate((element) => ({
        canvasAlpha: (element as HTMLElement).style
          .getPropertyValue("--site-profile-canvas-alpha")
          .trim(),
        moduleAlpha: (element as HTMLElement).style
          .getPropertyValue("--site-profile-module-alpha")
          .trim(),
      })),
    )
    .toEqual({ canvasAlpha: "23%", moduleAlpha: "41%" });

  const siteBackdrop = page.locator('[data-site-profile-backdrop="true"]');
  await expect(siteBackdrop).toHaveCount(1);
  await expect(siteBackdrop).toHaveAttribute(
    "data-profile-background-source",
    "image",
  );
  await expect(siteBackdrop).toHaveAttribute(
    "data-profile-background-blur",
    "heavy",
  );
  await expect(siteBackdrop).toHaveAttribute(
    "data-profile-background-visibility",
    "veiled",
  );
  const image = siteBackdrop.locator("img");
  await expect(image).toHaveAttribute("src", profileBackgroundUrl);
  await expect(image).toHaveCSS("opacity", "0.46");
  await expect(image).toHaveCSS("filter", /blur\(42px\)/);
  await expect
    .poll(() => page.evaluate(() => document.documentElement.style.colorScheme))
    .toBe("dark");
  await expectThemeColor(page, profileThemeColors.canvas);
}

async function expectThemeColor(page: Page, color: string) {
  await expect
    .poll(() =>
      page
        .locator('meta[name="theme-color"]')
        .getAttribute("content"),
    )
    .toBe(color);
}

async function expectProfileRootPropertiesCleared(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(() => {
        const style = document.documentElement.style;

        const properties = [
          "--app-canvas",
          "--app-canvas-soft",
          "--app-surface",
          "--app-surface-strong",
          "--app-text",
          "--app-muted",
          "--app-line",
          "--app-line-strong",
          "--app-accent",
          "--app-accent-ink",
          "--app-accent-strong",
          "--app-accent-contrast",
          "--app-focus",
          "--accent-sun",
          "--accent-sun-ink",
          "--accent-frost",
          "--accent-frost-ink",
          "--accent-leaf",
          "--accent-leaf-ink",
          "--accent-rose",
          "--accent-rose-ink",
          "--site-profile-canvas-alpha",
          "--site-profile-module-alpha",
        ];

        return properties.map((property) =>
          style.getPropertyValue(property).trim(),
        );
      }),
    )
    .toEqual(new Array(23).fill(""));
}

async function mockAuthenticatedThemeApi(page: Page) {
  await page.route("**/api/**", (route) =>
    route.fulfill({
      status: 404,
      contentType: "application/json",
      body: JSON.stringify({
        ok: false,
        error: `Unmocked API route: ${route.request().method()} ${new URL(route.request().url()).pathname}`,
      }),
    }),
  );

  await page.route("**/api/auth/me", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: {
          user: {
            id: 1,
            handle: "viewer",
            email: "viewer@example.test",
            role: "member",
            status: "active",
            displayName: "Viewer",
            avatarUrl: null,
          },
          profile: {
            displayName: "Viewer",
            bio: "A profile theme smoke fixture.",
            location: "Oslo",
            avatarUrl: null,
            bannerUrl: null,
            profileAccent: "custom",
            profileBackground: profileBackgroundUrl,
            profileBackgroundVideo: null,
            profileBackgroundVideoPoster: null,
            profileBackgroundBlur: "heavy",
            profileTheme: "custom",
            profileThemeConfig: { mode: "custom", colors: profileThemeColors },
            profileCanvasGlass: 80,
            links: [],
            traits: [],
          },
          csrfToken: "test-csrf",
        },
      }),
    }),
  );

  await page.route("**/api/me/onboarding", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: completedOnboardingState(),
      }),
    }),
  );

  await page.route("**/api/notifications", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: { notifications: [], unreadCount: 0 },
      }),
    }),
  );

  await page.route("**/api/feed/discover", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: { posts: [], activeRooms: [], peopleToWatch: [] },
      }),
    }),
  );

  await page.route("**/api/rooms", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ ok: true, data: [] }),
    }),
  );

  await page.route("**/api/stats", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: {
          publicRooms: 0,
          publicPosts: 0,
          activeUsers: 1,
          totalReactions: 0,
        },
      }),
    }),
  );

  await page.route(`**${profileBackgroundUrl}`, (route) =>
    route.fulfill({
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900"><rect width="1200" height="900" fill="#35586b"/></svg>',
    }),
  );
}

function completedOnboardingState() {
  const steps = [
    "profile_basics",
    "spotify",
    "youtube",
    "twitch",
    "github",
    "apple_music",
    "profile_canvas",
  ];

  return {
    steps,
    completedSteps: steps,
    skippedSteps: [],
    providerLinks: {},
    finishedAt: "2026-07-14 12:00:00",
    dismissedAt: null,
    createdAt: "2026-07-14 12:00:00",
    updatedAt: "2026-07-14 12:00:00",
  };
}
