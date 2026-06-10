import { expect, test } from "@playwright/test";
import { loginWithEnv, skipWithoutCredentials } from "../helpers/auth";

test.describe("image uploads", () => {
  test.beforeEach(() => {
    skipWithoutCredentials();
  });

  test("upload endpoint rejects unauthenticated requests", async ({ page }) => {
    await page.goto("/");

    const result = await page.evaluate(async () => {
      const formData = new FormData();
      formData.set("purpose", "post_media");
      formData.set("file", new File(["not an image"], "note.txt", { type: "text/plain" }));

      const response = await fetch("/api/uploads/image", {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      return {
        status: response.status,
        body: await response.json().catch(() => null),
      };
    });

    expect(result.status).toBe(401);
  });

  test("upload endpoint rejects unsupported and oversized files", async ({ page }) => {
    const session = await loginWithEnv(page);
    const csrfToken = session.data?.csrfToken;

    expect(csrfToken).toEqual(expect.any(String));

    const result = await page.evaluate(async (csrf) => {
      const formData = new FormData();
      formData.set("purpose", "post_media");
      formData.set("file", new File(["not an image"], "note.txt", { type: "text/plain" }));

      const response = await fetch("/api/uploads/image", {
        method: "POST",
        body: formData,
        credentials: "include",
        headers: {
          "X-CSRF-Token": csrf,
        },
      });

      return {
        status: response.status,
        body: await response.json().catch(() => null),
      };
    }, csrfToken!);

    expect(result.status).toBe(415);
    expect(result.body?.error).toContain("Unsupported image type");

    const oversized = await page.evaluate(async (csrf) => {
      const bytes = new Uint8Array(10 * 1024 * 1024 + 1);
      const formData = new FormData();
      formData.set("purpose", "post_media");
      formData.set("file", new File([bytes], "large.png", { type: "image/png" }));

      const response = await fetch("/api/uploads/image", {
        method: "POST",
        body: formData,
        credentials: "include",
        headers: {
          "X-CSRF-Token": csrf,
        },
      });

      return {
        status: response.status,
        body: await response.json().catch(() => null),
      };
    }, csrfToken!);

    expect(oversized.status).toBe(413);

    if (oversized.body !== null) {
      expect(oversized.body?.error).toBe("Image must be 10 MB or smaller.");
    }
  });
});
