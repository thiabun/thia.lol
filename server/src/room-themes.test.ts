import { describe, expect, it } from "vitest";

import {
  normalizeRoomThemeConfig,
  roomThemeConfigPayload,
  roomThemeFromLegacyAccent,
  validateRoomThemeToken,
} from "./room-themes.js";

describe("room theme helpers", () => {
  it("maps legacy room accents to preset theme ids", () => {
    expect(roomThemeFromLegacyAccent("var(--accent-sun)")).toBe("glinda");
    expect(roomThemeFromLegacyAccent("var(--accent-frost)")).toBe("elphaba");
    expect(roomThemeFromLegacyAccent("var(--accent-leaf)")).toBe("leafveil");
    expect(roomThemeFromLegacyAccent("var(--accent-rose)")).toBe("roseveil");
    expect(roomThemeFromLegacyAccent("var(--app-accent)")).toBeNull();
    expect(roomThemeFromLegacyAccent(null)).toBeNull();
  });

  it("normalizes preset room theme config JSON", () => {
    expect(roomThemeConfigPayload('{"mode":"preset","preset":"roseveil"}')).toEqual({
      mode: "preset",
      preset: "roseveil",
    });
    expect(roomThemeConfigPayload('{"mode":"preset","preset":"unknown"}')).toBeNull();
  });

  it("normalizes custom room theme colors", () => {
    expect(
      normalizeRoomThemeConfig({
        mode: "custom",
        colors: {
          canvas: "#ffffff",
          canvasSoft: "#eeeeee",
          surface: "#dddddd",
          surfaceStrong: "#cccccc",
          text: "#111111",
          muted: "#222222",
          line: "#333333",
          lineStrong: "#444444",
          accent: "#abcdef",
          accentInk: "#123456",
          accentStrong: "#654321",
          focus: "#fedcba",
        },
      }),
    ).toMatchObject({
      mode: "custom",
      colors: {
        accent: "#ABCDEF",
        focus: "#FEDCBA",
      },
    });
  });

  it("rejects unsupported tokens and malformed configs", () => {
    expect(validateRoomThemeToken("sunveil")).toBe("glinda");
    expect(validateRoomThemeToken("glinda")).toBe("glinda");
    expect(validateRoomThemeToken("var(--accent-sun)")).toBeUndefined();
    expect(normalizeRoomThemeConfig({ mode: "custom", colors: { accent: "#ffffff" } })).toBeUndefined();
    expect(roomThemeConfigPayload("not json")).toBeNull();
  });
});
