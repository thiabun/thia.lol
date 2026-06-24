import { describe, expect, it } from "vitest";

import {
  AuthRouteError,
  buildClearSessionCookies,
  buildSessionCookie,
  hashPhpPassword,
  validateAuthDisplayName,
  validateAuthEmail,
  validateAuthHandle,
  validateAuthPassword,
  verifyPhpPassword,
} from "./auth.js";

describe("auth password compatibility", () => {
  it("creates PHP-compatible bcrypt hashes and verifies them", async () => {
    const hash = await hashPhpPassword("correct-password");

    expect(hash.startsWith("$2y$")).toBe(true);
    await expect(verifyPhpPassword("correct-password", hash)).resolves.toBe(true);
    await expect(verifyPhpPassword("wrong-password", hash)).resolves.toBe(false);
  });

  it("verifies existing PHP $2y$ hashes", async () => {
    const hash = await hashPhpPassword("another-password");

    await expect(verifyPhpPassword("another-password", hash)).resolves.toBe(true);
  });
});

describe("auth validation", () => {
  it("normalizes and validates auth inputs like PHP", () => {
    expect(validateAuthEmail(" Viewer@Example.TEST ")).toBe("viewer@example.test");
    expect(validateAuthHandle("@Viewer_01")).toBe("viewer_01");
    expect(validateAuthDisplayName(" Viewer ")).toBe("Viewer");
    expect(validateAuthPassword("1234567890")).toBe("1234567890");
  });

  it("rejects invalid auth inputs with PHP-compatible messages", () => {
    expect(() => validateAuthEmail("bad")).toThrow(new AuthRouteError("Enter a valid email address.", 422));
    expect(() => validateAuthHandle("no")).toThrow(
      new AuthRouteError("Handle must be 3-40 characters using letters, numbers, dashes, or underscores.", 422),
    );
    expect(() => validateAuthDisplayName("")).toThrow(new AuthRouteError("Display name must be 1-120 visible characters.", 422));
    expect(() => validateAuthPassword("short")).toThrow(new AuthRouteError("Password must be between 10 and 255 characters.", 422));
  });
});

describe("auth session cookies", () => {
  it("serializes PHP-compatible session cookies", () => {
    expect(
      buildSessionCookie("thia_session", "token value", new Date("2026-06-24T12:00:00Z"), {
        domain: ".thia.lol",
        secure: true,
      }),
    ).toBe(
      "thia_session=token%20value; Expires=Wed, 24 Jun 2026 12:00:00 GMT; Path=/; Domain=.thia.lol; Secure; HttpOnly; SameSite=Lax",
    );
  });

  it("generates clear-cookie variants for host and thia.lol domains", () => {
    const cookies = buildClearSessionCookies("thia_session", {
      domain: null,
      host: "thia.lol",
      secure: true,
    });

    expect(cookies.some((cookie) => cookie.includes("thia_session=;"))).toBe(true);
    expect(cookies.some((cookie) => cookie.includes("Path=/api"))).toBe(true);
    expect(cookies.some((cookie) => cookie.includes("Domain=.thia.lol"))).toBe(true);
  });
});
