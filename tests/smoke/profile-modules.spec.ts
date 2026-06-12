import { expect, type Page, test } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

test("profile renders public modules safely", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockProfileModules(page, {
    authenticated: false,
    modules: [
      {
        id: 1,
        type: "about",
        title: "About this space",
        config: { body: "Literal <strong>plain</strong> text" },
        visibility: "public",
        position: 1,
        status: "active",
        schemaVersion: 1,
        createdAt: "2026-06-12 00:00:00",
        updatedAt: "2026-06-12 00:00:00",
      },
      {
        id: 2,
        type: "links",
        title: "Elsewhere",
        config: {
          links: [{ label: "Personal site", url: "https://example.com/" }],
        },
        visibility: "public",
        position: 2,
        status: "active",
        schemaVersion: 1,
        createdAt: "2026-06-12 00:00:00",
        updatedAt: "2026-06-12 00:00:00",
      },
      {
        id: 3,
        type: "featured_badges",
        title: "Badge shelf",
        config: { userBadgeIds: [1] },
        visibility: "public",
        position: 3,
        status: "active",
        schemaVersion: 1,
        createdAt: "2026-06-12 00:00:00",
        updatedAt: "2026-06-12 00:00:00",
      },
    ],
  });

  await acknowledgeCookieNotice(page);
  await page.goto("/@thia");

  const section = page.getByTestId("profile-modules");
  await expect(section).toBeVisible();
  await expect(section.getByRole("heading", { name: "Personal space" })).toBeVisible();
  await expect(section.getByRole("heading", { name: "About this space" })).toBeVisible();
  await expect(section).toContainText("Literal <strong>plain</strong> text");
  await expect(section.locator("strong")).toHaveCount(0);
  await expect(section.getByRole("link", { name: "Personal site" })).toHaveAttribute(
    "href",
    "https://example.com/",
  );
  await expect(section.getByText("Founder", { exact: true })).toBeVisible();

  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(hasHorizontalOverflow).toBe(false);
});

test("visitor with no modules does not see fake module scaffolding", async ({ page }) => {
  await mockProfileModules(page, { authenticated: false, modules: [] });
  await acknowledgeCookieNotice(page);
  await page.goto("/@thia");

  await expect(page.getByTestId("profile-modules")).toHaveCount(0);
  await expect(page.getByTestId("profile-owner-tools")).toHaveCount(0);
  await expect(page.getByText("No profile modules yet")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Customize profile" })).toHaveCount(0);
});

test("owner empty module state is honest", async ({ page }) => {
  await mockProfileModules(page, { authenticated: true, modules: [] });
  await acknowledgeCookieNotice(page);
  await page.goto("/@thia");

  await expect(page.getByTestId("profile-owner-tools")).toHaveCount(0);
  await expect(page.getByTestId("profile-modules")).toBeVisible();
  await expect(page.getByRole("heading", { name: "No profile modules yet" })).toBeVisible();
  await expect(page.getByText("This space is empty for now.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Customize profile" })).toBeVisible();
});

test("owner editor lists modules and previews plain text", async ({ page }) => {
  await mockProfileModules(page, {
    authenticated: true,
    modules: [aboutModule({ body: "Saved profile note" })],
  });
  await acknowledgeCookieNotice(page);
  await page.goto("/@thia");

  await page.getByRole("button", { name: "Customize profile" }).click();
  const modal = page.getByTestId("profile-customization-modal");
  await modal.getByRole("button", { name: /Modules/ }).click();
  const editor = modal.getByTestId("profile-module-editor");
  await expect(editor).toBeVisible();
  await expect(editor.getByTestId("profile-module-list")).toContainText("About this space");
  await expect(editor.getByTestId("profile-module-expanded")).toHaveCount(0);

  const moduleCard = editor.getByTestId("profile-module-card-1");
  await expect(moduleCard.getByTestId("profile-module-toggle-1")).toHaveAttribute(
    "aria-expanded",
    "false",
  );
  await moduleCard.getByRole("button", { name: "Edit About this space" }).click();
  await expect(moduleCard.getByTestId("profile-module-expanded")).toBeVisible();
  await expect(moduleCard.getByTestId("profile-module-toggle-1")).toHaveAttribute(
    "aria-expanded",
    "true",
  );
  await editor.getByLabel("Body").fill("Literal <strong>plain</strong> preview");
  const preview = modal.getByTestId("profile-module-preview");
  await expect(preview).toContainText("Literal <strong>plain</strong> preview");
  await expect(preview.locator("strong")).toHaveCount(0);
});

test("owner can add and save an about module", async ({ page }) => {
  let createdPayload: Record<string, unknown> | undefined;
  await mockProfileModules(page, {
    authenticated: true,
    modules: [],
    onCreate: (payload) => {
      createdPayload = payload;
    },
  });
  await acknowledgeCookieNotice(page);
  await page.goto("/@thia");

  await page.getByRole("button", { name: "Customize profile" }).click();
  const modal = page.getByTestId("profile-customization-modal");
  await modal.getByRole("button", { name: /Modules/ }).click();
  const editor = modal.getByTestId("profile-module-editor");
  await editor.getByRole("button", { name: "About" }).click();
  await expect(editor.getByTestId("profile-module-expanded")).toBeVisible();
  await editor.getByLabel("Title").fill("My intro");
  await editor.getByLabel("Body").fill("A safe public intro.");
  await editor.getByRole("button", { name: "Draft" }).click();
  await editor.getByRole("button", { name: "Save module" }).click();

  await expect.poll(() => createdPayload).toBeTruthy();
  expect(createdPayload).toMatchObject({
    type: "about",
    title: "My intro",
    visibility: "draft",
    status: "active",
    config: { body: "A safe public intro." },
  });
  await expect(editor.getByText("Module saved")).toBeVisible();
  await expect(editor.getByTestId("profile-module-expanded")).toHaveCount(0);
  await expect(editor.getByText("My intro")).toBeVisible();
});

test("links editor rejects unsafe URL before save", async ({ page }) => {
  let created = false;
  await mockProfileModules(page, {
    authenticated: true,
    modules: [],
    onCreate: () => {
      created = true;
    },
  });
  await acknowledgeCookieNotice(page);
  await page.goto("/@thia");

  await page.getByRole("button", { name: "Customize profile" }).click();
  const modal = page.getByTestId("profile-customization-modal");
  await modal.getByRole("button", { name: /Modules/ }).click();
  const editor = modal.getByTestId("profile-module-editor");
  await editor.getByRole("button", { name: "Links" }).click();
  await expect(editor.getByTestId("profile-module-expanded")).toBeVisible();
  await editor.getByLabel("Link 1 label").fill("Bad link");
  await editor.getByLabel("Link 1 URL").fill("javascript:alert(1)");
  await editor.getByRole("button", { name: "Save module" }).click();

  await expect(editor.getByText("Link URL is invalid.")).toBeVisible();
  await expect(editor.getByTestId("profile-module-expanded")).toBeVisible();
  expect(created).toBe(false);
});

test("owner can delete and reorder modules with confirmation", async ({ page }) => {
  const deletedIds: number[] = [];
  let orderedIds: number[] | undefined;
  await mockProfileModules(page, {
    authenticated: true,
    modules: [
      aboutModule({ id: 1, title: "First", body: "First body", position: 1 }),
      aboutModule({ id: 2, title: "Second", body: "Second body", position: 2 }),
    ],
    onDelete: (id) => {
      deletedIds.push(id);
    },
    onOrder: (ids) => {
      orderedIds = ids;
    },
  });
  page.on("dialog", (dialog) => void dialog.accept());
  await acknowledgeCookieNotice(page);
  await page.goto("/@thia");

  await page.getByRole("button", { name: "Customize profile" }).click();
  const modal = page.getByTestId("profile-customization-modal");
  await modal.getByRole("button", { name: /Modules/ }).click();
  const editor = modal.getByTestId("profile-module-editor");
  await editor.getByRole("button", { name: "Move Second up" }).click();
  await editor.getByRole("button", { name: "Save order" }).click();

  await expect.poll(() => orderedIds).toEqual([2, 1]);

  await editor.getByRole("button", { name: "Delete Second" }).click();
  await expect.poll(() => deletedIds).toEqual([2]);
});

test("mobile module editor and preview do not overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockProfileModules(page, {
    authenticated: true,
    modules: [aboutModule({ body: "Mobile profile module" })],
  });
  await acknowledgeCookieNotice(page);
  await page.goto("/@thia");
  await page.getByRole("button", { name: "Customize profile" }).click();
  const modal = page.getByTestId("profile-customization-modal");
  await modal.getByRole("button", { name: /Modules/ }).click();

  await expect(page.getByTestId("profile-module-editor")).toBeVisible();
  const modalBox = await modal.boundingBox();
  expect(modalBox?.x).toBeLessThanOrEqual(1);
  expect(modalBox?.y).toBeLessThanOrEqual(1);
  expect(Math.round(modalBox?.width ?? 0)).toBe(390);
  expect(Math.round(modalBox?.height ?? 0)).toBeGreaterThanOrEqual(840);
  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(hasHorizontalOverflow).toBe(false);
});

test("profile module API guardrails are present by inspection", async () => {
  const router = readFileSync("api/index.php", "utf8");
  const modulesApi = readFileSync("api/profile_modules.php", "utf8");
  const schema = readFileSync("backend/database/schema.sql", "utf8");
  const migration = readFileSync(
    "backend/database/migrations/20260612_0001_add_profile_modules.sql",
    "utf8",
  );

  expect(router).toContain("profile_modules.php");
  expect(router).toContain("profile_modules_dispatch($segments, $method)");
  expect(modulesApi).toContain("const PROFILE_MODULE_TYPES = ['about', 'links', 'featured_badges', 'custom_text']");
  expect(modulesApi).toContain("require_csrf_token($session)");
  expect(modulesApi).toContain("Profile module storage is not ready. Run pending migrations.");
  expect(modulesApi).toContain("profile_module_reject_unknown_keys");
  expect(modulesApi).toContain("profile_module_text_is_unsafe");
  expect(modulesApi).toContain("Module type cannot be changed.");
  expect(modulesApi).toContain("visibility = :visibility");
  expect(modulesApi).toContain("status = 'deleted'");
  expect(schema).toContain("CREATE TABLE IF NOT EXISTS profile_modules");
  expect(migration).toContain("KEY profile_modules_user_position_idx (user_id, position)");
});

test("profile module validation passes backend regression fixture", async () => {
  const output = execFileSync("php", ["tests/backend/profile-modules-regression.php"], {
    encoding: "utf8",
  });

  expect(output).toContain("profile modules regression ok");
});

async function mockProfileModules(
  page: Page,
  options: {
    authenticated: boolean;
    modules: unknown[];
    onCreate?: (payload: Record<string, unknown>) => void;
    onDelete?: (id: number) => void;
    onOrder?: (ids: number[]) => void;
    onUpdate?: (id: number, payload: Record<string, unknown>) => void;
  },
) {
  let ownerModules = [...options.modules] as Array<Record<string, unknown>>;
  let nextModuleId = Math.max(
    10,
    ...ownerModules.map((module) =>
      typeof module.id === "number" ? module.id : 0,
    ),
  ) + 1;

  await page.route("**/api/**", async (route) => {
    await route.fulfill({
      status: 404,
      contentType: "application/json",
      body: JSON.stringify({
        ok: false,
        error: `Unmocked API route: ${route.request().method()} ${new URL(route.request().url()).pathname}`,
      }),
    });
  });

  await page.route("**/api/auth/me", async (route) => {
    if (!options.authenticated) {
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ ok: false, error: "Unauthenticated." }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: {
          user: {
            id: 1,
            handle: "thia",
            email: "thia@example.test",
            role: "member",
            status: "active",
            displayName: "Thia",
            avatarUrl: null,
          },
          profile: {
            displayName: "Thia",
            bio: "Founder profile for thia.lol.",
            location: "Oslo",
            avatarUrl: null,
            links: [],
            traits: [],
          },
          csrfToken: "test-csrf",
        },
      }),
    });
  });

  await page.route("**/api/notifications", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, data: { notifications: [], unreadCount: 0 } }),
    });
  });

  await page.route("**/api/rooms", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, data: [] }),
    });
  });

  await page.route("**/api/profiles/thia", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, data: profileBody() }),
    });
  });

  await page.route("**/api/profiles/thia/modules", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: ownerModules.filter(
          (module) => module.visibility === "public" && module.status === "active",
        ),
      }),
    });
  });

  await page.route("**/api/me/profile/module-order", async (route) => {
    const payload = (await route.request().postDataJSON()) as {
      moduleIds?: number[];
    };
    const ids = payload.moduleIds ?? [];
    options.onOrder?.(ids);
    ownerModules = ids
      .map((id, index) => {
        const module = ownerModules.find((item) => item.id === id);
        return module ? { ...module, position: index + 1 } : undefined;
      })
      .filter((module): module is Record<string, unknown> => module !== undefined);
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, data: ownerModules }),
    });
  });

  await page.route("**/api/me/profile/modules/**", async (route) => {
    const url = new URL(route.request().url());
    const rawId = url.pathname.split("/").at(-1);
    const id = Number(rawId);

    if (route.request().method() === "PATCH") {
      const payload = (await route.request().postDataJSON()) as Record<string, unknown>;
      options.onUpdate?.(id, payload);
      ownerModules = ownerModules.map((module) =>
        module.id === id ? moduleFromPayload(payload, module) : module,
      );
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, data: ownerModules }),
      });
      return;
    }

    if (route.request().method() === "DELETE") {
      options.onDelete?.(id);
      ownerModules = ownerModules.filter((module) => module.id !== id);
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, data: { id, deleted: true } }),
      });
      return;
    }

    await route.fulfill({
      status: 405,
      contentType: "application/json",
      body: JSON.stringify({ ok: false, error: "Method not allowed." }),
    });
  });

  await page.route("**/api/me/profile/modules", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, data: ownerModules }),
      });
      return;
    }

    if (route.request().method() === "POST") {
      const payload = (await route.request().postDataJSON()) as Record<string, unknown>;
      options.onCreate?.(payload);
      ownerModules = [
        ...ownerModules,
        moduleFromPayload(payload, {
          id: nextModuleId++,
          position: ownerModules.length + 1,
          schemaVersion: 1,
          createdAt: "2026-06-12 00:00:00",
          updatedAt: "2026-06-12 00:00:00",
        }),
      ];
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, data: ownerModules }),
      });
      return;
    }

    await route.fulfill({
      status: 405,
      contentType: "application/json",
      body: JSON.stringify({ ok: false, error: "Method not allowed." }),
    });
  });

  await page.route("**/api/profiles/thia/badges", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: {
          badges: [badgeGrant()],
          featuredBadges: [badgeGrant()],
        },
      }),
    });
  });

  for (const suffix of ["posts", "replies", "reblogs", "rooms", "followers", "following"]) {
    await page.route(`**/api/profiles/thia/${suffix}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, data: [] }),
      });
    });
  }
}

function moduleFromPayload(
  payload: Record<string, unknown>,
  base: Record<string, unknown>,
) {
  return {
    ...base,
    ...payload,
    title: payload.title ?? base.title ?? null,
    visibility: payload.visibility ?? base.visibility ?? "public",
    status: payload.status ?? base.status ?? "active",
    config: payload.config ?? base.config ?? {},
  };
}

async function acknowledgeCookieNotice(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem("thia_cookie_notice_ack", "1");
  });
}

function profileBody() {
  return {
    user: {
      id: 1,
      handle: "thia",
      displayName: "Thia",
      initials: "T",
      aura: "frost",
      avatarUrl: null,
    },
    bio: "Founder profile for thia.lol.",
    location: "Oslo",
    bannerUrl: null,
    profileAccent: null,
    profileBackground: null,
    profileTheme: null,
    links: [],
    traits: [],
    stats: {
      posts: 0,
      replies: 0,
      rooms: 0,
      echoes: 0,
      followers: 0,
      following: 0,
      moots: 0,
    },
    followerCount: 0,
    followingCount: 0,
    mootCount: 0,
    isFollowing: false,
    isFollowedBy: false,
    isMoot: false,
    createdAt: "2026-06-10 00:00:00",
    updatedAt: "2026-06-10 00:00:00",
  };
}

function badgeGrant() {
  return {
    id: 1,
    reason: null,
    earnedAt: "2026-06-10 00:00:00",
    featuredOrder: 1,
    isVisible: true,
    grantedBy: null,
    badge: {
      id: 1,
      badgeKey: "founder",
      name: "Founder",
      description: "Granted to people who helped establish thia.lol.",
      rarity: "founder",
      source: "admin-granted",
      icon: "sparkles",
      accent: "founder",
      isActive: true,
      createdAt: "2026-06-10 00:00:00",
    },
  };
}

function aboutModule(
  overrides: {
    id?: number;
    title?: string;
    body?: string;
    position?: number;
  } = {},
) {
  return {
    id: overrides.id ?? 1,
    type: "about",
    title: overrides.title ?? "About this space",
    config: { body: overrides.body ?? "Saved profile note" },
    visibility: "public",
    position: overrides.position ?? 1,
    status: "active",
    schemaVersion: 1,
    createdAt: "2026-06-12 00:00:00",
    updatedAt: "2026-06-12 00:00:00",
  };
}
