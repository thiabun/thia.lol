import type { CSSProperties } from "react";
import {
  profileThemeConfigColors,
  profileThemeConfigToCssProperties,
} from "./profileThemes";
import type { ProfileThemeConfig, Room } from "./types";

export function roomThemeConfig(room: Pick<Room, "theme" | "themeConfig"> | null | undefined): ProfileThemeConfig | null {
  if (!room) {
    return null;
  }

  if (room.themeConfig) {
    return room.themeConfig;
  }

  return room.theme && room.theme !== "custom"
    ? { mode: "preset", preset: room.theme }
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
