import type { ProfileBackgroundBlur } from "./types";

export const PROFILE_CANVAS_GLASS_DEFAULT = 58;
export const PROFILE_CANVAS_GLASS_MAX = 92;

export type ProfileCanvasGlassTreatment = {
  canvasSurfacePercent: number;
  moduleSurfacePercent: number;
  normalizedGlass: number;
};

export function profileCanvasGlassTreatment(
  value: unknown = PROFILE_CANVAS_GLASS_DEFAULT,
): ProfileCanvasGlassTreatment {
  const numericValue =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim() !== ""
        ? Number(value)
        : PROFILE_CANVAS_GLASS_DEFAULT;
  const normalizedGlass = Number.isFinite(numericValue)
    ? Math.min(PROFILE_CANVAS_GLASS_MAX, Math.max(0, Math.round(numericValue)))
    : PROFILE_CANVAS_GLASS_DEFAULT;

  return {
    normalizedGlass,
    canvasSurfacePercent: Math.round(
      94 - (normalizedGlass / PROFILE_CANVAS_GLASS_MAX) * 82,
    ),
    moduleSurfacePercent: Math.round(
      78 - (normalizedGlass / PROFILE_CANVAS_GLASS_MAX) * 42,
    ),
  };
}

export type ProfileBackgroundTreatment = {
  baseOverlay: string;
  blurClass: string;
  mediaOpacity: string;
  name: "clear" | "soft" | "muted" | "veiled";
  sideVignette: string;
  verticalOverlay: string;
};

export const profileBackgroundTreatments: Record<
  ProfileBackgroundBlur,
  ProfileBackgroundTreatment
> = {
  none: {
    baseOverlay: "bg-canvas/10",
    blurClass: "",
    mediaOpacity: "opacity-[0.84]",
    name: "clear",
    sideVignette: "from-surface/18 to-surface/18",
    verticalOverlay: "from-canvas/28 via-canvas/5 to-canvas/42",
  },
  soft: {
    baseOverlay: "bg-canvas/18",
    blurClass: "blur-[3px]",
    mediaOpacity: "opacity-[0.72]",
    name: "soft",
    sideVignette: "from-surface/28 to-surface/28",
    verticalOverlay: "from-canvas/40 via-canvas/12 to-canvas/54",
  },
  medium: {
    baseOverlay: "bg-canvas/28",
    blurClass: "blur-[18px]",
    mediaOpacity: "opacity-[0.6]",
    name: "muted",
    sideVignette: "from-surface/40 to-surface/40",
    verticalOverlay: "from-canvas/52 via-canvas/22 to-canvas/66",
  },
  heavy: {
    baseOverlay: "bg-canvas/42",
    blurClass: "blur-[42px]",
    mediaOpacity: "opacity-[0.46]",
    name: "veiled",
    sideVignette: "from-surface/54 to-surface/54",
    verticalOverlay: "from-canvas/68 via-canvas/40 to-canvas/80",
  },
};

export function profileBackgroundTreatment(
  treatment: ProfileBackgroundBlur,
): ProfileBackgroundTreatment {
  return profileBackgroundTreatments[treatment];
}
