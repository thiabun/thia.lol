import type { ProfileLayoutPreset } from "./types";

export const defaultProfileLayoutPreset: ProfileLayoutPreset = "balanced";

export const profileLayoutPresets = {
  balanced: {
    label: "Balanced",
    description: "Mixed grid with compact highlights.",
  },
  compact: {
    label: "Compact",
    description: "Tighter two-column desktop stack.",
  },
  showcase: {
    label: "Showcase",
    description: "Gives highlights more room.",
  },
} satisfies Record<ProfileLayoutPreset, { description: string; label: string }>;

export const profileLayoutPresetOptions = Object.entries(profileLayoutPresets).map(
  ([value, preset]) => ({
    value: value as ProfileLayoutPreset,
    ...preset,
  }),
);

export function normalizeProfileLayoutPreset(value: unknown): ProfileLayoutPreset {
  return isProfileLayoutPreset(value) ? value : defaultProfileLayoutPreset;
}

export function isProfileLayoutPreset(value: unknown): value is ProfileLayoutPreset {
  return (
    typeof value === "string" &&
    Object.hasOwn(profileLayoutPresets, value)
  );
}

export function profileLayoutMaxColumns(
  preset: ProfileLayoutPreset,
): 5 {
  void preset;

  return 5;
}
