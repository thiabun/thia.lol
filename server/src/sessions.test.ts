import { describe, expect, it } from "vitest";

import { hashSessionToken, sessionCookieTokens } from "./sessions.js";

describe("session preview helpers", () => {
  it("hashes PHP session cookies with SHA-256", () => {
    expect(hashSessionToken("token")).toBe("3c469e9d6c5875d37a43f353d4f88e61fcf812c66eee3457465a40b0da4153e0");
  });

  it("parses repeated configured session cookies like PHP", () => {
    expect(sessionCookieTokens("theme=dark; thia_session=one; thia_session=two; other=x", "thia_session")).toEqual([
      "one",
      "two",
    ]);
  });

  it("deduplicates and URL-decodes cookie values", () => {
    expect(sessionCookieTokens("thia_session=hello%20world; thia_session=hello%20world", "thia_session")).toEqual([
      "hello world",
    ]);
  });
});
