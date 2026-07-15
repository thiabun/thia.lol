import { expect, type Page, test } from "@playwright/test";
import { getTestCredentialsFromConfig } from "../test-config";
import {
  CURRENT_WHATS_NEW_RELEASE,
  whatsNewStorageKey,
} from "../../src/lib/whatsNew";

export type AuthMeResponse = {
  ok: boolean;
  data?: {
    user?: {
      id: number;
      handle: string;
      email: string;
      role: string;
      status: string;
      displayName: string;
    };
    csrfToken?: string;
  };
  error?: string;
};

export function getTestCredentials() {
  return getTestCredentialsFromConfig(process.env, currentWorkerAccountIndex());
}

export function skipWithoutCredentials() {
  const { email, password } = getTestCredentials();

  test.skip(
    !email || !password,
    "Set THIA_TEST_EMAIL and THIA_TEST_PASSWORD or enable the smoke test config to run authenticated smoke tests.",
  );
}

export async function fetchAuthMe(page: Page): Promise<AuthMeResponse> {
  return page.evaluate(async () => {
    const response = await fetch("/api/auth/me", {
      credentials: "include",
      headers: { Accept: "application/json" },
    });
    const body = await response.text();

    if (!body) {
      return {
        ok: false,
        error: `Empty /api/auth/me response (${response.status})`,
      };
    }

    try {
      return JSON.parse(body) as AuthMeResponse;
    } catch {
      return {
        ok: false,
        error: `Invalid /api/auth/me JSON response (${response.status})`,
      };
    }
  });
}

export async function loginWithEnv(page: Page): Promise<AuthMeResponse> {
  const { email, password } = getTestCredentials();

  if (!email || !password) {
    throw new Error("Missing THIA_TEST_EMAIL or THIA_TEST_PASSWORD.");
  }

  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("/", { timeout: 15_000 });

  await expect
    .poll(() => fetchAuthMe(page), {
      message: "/api/auth/me should return the authenticated user",
      timeout: 15_000,
    })
    .toMatchObject({ ok: true });

  const authMe = await fetchAuthMe(page);
  expect(authMe.data?.user?.email).toBe(email);

  const userId = authMe.data?.user?.id;
  if (userId !== undefined) {
    await page.evaluate(
      ({ releaseId, storageKey }) => {
        window.localStorage.setItem(storageKey, releaseId);
      },
      {
        releaseId: CURRENT_WHATS_NEW_RELEASE.id,
        storageKey: whatsNewStorageKey(userId),
      },
    );
    await page.reload();
  }

  return fetchAuthMe(page);
}

function currentWorkerAccountIndex() {
  try {
    return test.info().parallelIndex;
  } catch {
    return 0;
  }
}
