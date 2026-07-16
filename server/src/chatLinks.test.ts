import { describe, expect, it } from "vitest";

import { chatLinkEntities, nativeChatLinks, removeNativeChatLinks } from "./chatLinks.js";

describe("native Chat links", () => {
  it("recognizes exact same-origin Post and Room links", () => {
    const body = [
      "Look",
      "https://thia.lol/@Thia/posts/pc359fe2da759?utm_source=chat#reply",
      "and https://thia.lol/rooms/moon-garden.",
    ].join(" ");

    expect(nativeChatLinks(body, "https://thia.lol/")).toMatchObject([
      {
        kind: "post",
        handle: "thia",
        identifier: "pc359fe2da759",
      },
      {
        kind: "room",
        slug: "moon-garden",
      },
    ]);
  });

  it("does not recognize insecure or lookalike hosts", () => {
    const body = [
      "http://thia.lol/rooms/moon-garden",
      "https://thia.lol.evil.test/rooms/moon-garden",
      "https://user:secret@thia.lol/rooms/moon-garden",
      "https://thia.lol/not-a-room/moon-garden",
    ].join(" ");

    expect(nativeChatLinks(body, "https://thia.lol")).toEqual([]);
  });

  it("removes only resolved native URLs and preserves ordinary links", () => {
    const body = "Open https://thia.lol/rooms/moon-garden then https://example.com/help";
    const links = nativeChatLinks(body, "https://thia.lol");

    expect(removeNativeChatLinks(body, links)).toBe("Open then https://example.com/help");
    expect(chatLinkEntities(removeNativeChatLinks(body, links))).toMatchObject([
      { text: "https://example.com/help", url: "https://example.com/help" },
    ]);
  });
});
