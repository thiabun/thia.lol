import { describe, expect, it } from "vitest";

import { normalizeSignupAttribution } from "./growth.js";

describe("growth attribution normalization", () => {
  it("keeps normalized share and campaign context", () => {
    expect(
      normalizeSignupAttribution({
        source: " Thia.LOL ",
        medium: " Share ",
        campaign: "Profile Share!",
        shareKind: "profile",
        shareRef: "@Thia",
        referrerHost: "Example.COM.",
        landingPath: "/@thia?utm_source=x",
      }),
    ).toEqual({
      source: "thia.lol",
      medium: "share",
      campaign: "profile-share",
      shareKind: "profile",
      shareRef: "thia",
      referrerHost: "example.com",
      landingPath: "/@thia",
    });
  });

  it("drops invalid fields without rejecting the attribution object", () => {
    expect(
      normalizeSignupAttribution({
        source: "External Network",
        shareKind: "profile",
        shareRef: "not valid!",
        referrerHost: "bad..host",
        landingPath: "https://thia.lol/@thia",
      }),
    ).toEqual({
      source: "external-network",
      medium: null,
      campaign: null,
      shareKind: null,
      shareRef: null,
      referrerHost: null,
      landingPath: null,
    });
  });

  it("returns null when no useful signal remains", () => {
    expect(
      normalizeSignupAttribution({
        shareKind: "room",
        shareRef: "bad_room",
        landingPath: "//evil.test",
      }),
    ).toBeNull();
  });
});
