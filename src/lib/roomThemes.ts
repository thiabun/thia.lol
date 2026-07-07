import type { CSSProperties } from "react";
import {
  canonicalProfileThemePresetId,
  profileThemeConfigColors,
  profileThemeConfigToCssProperties,
} from "./profileThemes";
import type { ProfileThemeConfig, Room } from "./types";

export function roomThemeConfig(room: Pick<Room, "theme" | "themeConfig"> | null | undefined): ProfileThemeConfig | null {
  if (!room) {
    return null;
  }

  if (room.themeConfig?.mode === "preset") {
    return {
      mode: "preset",
      preset: canonicalProfileThemePresetId(room.themeConfig.preset) ?? room.themeConfig.preset,
    };
  }

  if (room.themeConfig) {
    return room.themeConfig;
  }

  const preset = canonicalProfileThemePresetId(room.theme);

  return preset && preset !== "custom"
    ? { mode: "preset", preset }
    : null;
}

export function roomThemeRootCssProperties(
  room: Pick<Room, "theme" | "themeConfig"> | null | undefined,
): CSSProperties | undefined {
  return profileThemeConfigToCssProperties(roomThemeConfig(room));
}

export function roomThemeSwatchCssProperties(
  room: Pick<Room, "theme" | "themeConfig"> | null | undefined,
): CSSProperties {
  const colors = profileThemeConfigColors(roomThemeConfig(room));

  return {
    "--room-accent": colors?.accent ?? "var(--app-accent)",
    "--room-surface": colors?.surface ?? "var(--app-surface)",
    "--room-canvas": colors?.canvas ?? "var(--app-canvas)",
    "--room-line": colors?.line ?? "var(--app-line)",
  } as CSSProperties;
}
