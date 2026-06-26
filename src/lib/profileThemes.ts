import type { CSSProperties } from "react";
import type {
  ProfileThemeColorKey,
  ProfileThemeColors,
  ProfileThemeConfig,
} from "./types";
import { withRootThemeTransition } from "./themeTransitions";

const rootThemeCleanupDelayMs = 80;
let rootThemeActiveSignature: string | undefined;
let rootThemeActiveToken: symbol | undefined;
let rootThemeRestoreDataset: string | undefined;
let rootThemeRestoreValues: Map<string, string> | undefined;
let rootThemeCleanupTimer: number | undefined;

export const profileThemeColorKeys: ProfileThemeColorKey[] = [
  "canvas",
  "canvasSoft",
  "surface",
  "surfaceStrong",
  "text",
  "muted",
  "line",
  "lineStrong",
  "accent",
  "accentInk",
  "accentStrong",
  "focus",
];

export type ProfileThemePreset = {
  id: string;
  label: string;
  description: string;
  colors: ProfileThemeColors;
};

export const profileThemePresets: ProfileThemePreset[] = [
  {
    id: "frostveil",
    label: "Frostveil",
    description: "Icy blue dark profile.",
    colors: {
      canvas: "#0D1F29",
      canvasSoft: "#102B39",
      surface: "#16333D",
      surfaceStrong: "#22485A",
      text: "#E8F7F8",
      muted: "#9EC0CA",
      line: "#2D6172",
      lineStrong: "#417E92",
      accent: "#58E2E0",
      accentInk: "#08232D",
      accentStrong: "#92F4F2",
      focus: "#6DEBFF",
    },
  },
  {
    id: "sunveil",
    label: "Sunveil",
    description: "Warm soft light profile.",
    colors: {
      canvas: "#FFF6D8",
      canvasSoft: "#F5E7BC",
      surface: "#FFFDF2",
      surfaceStrong: "#F0E0B5",
      text: "#3F3324",
      muted: "#77694E",
      line: "#E0CC93",
      lineStrong: "#CDBB83",
      accent: "#E5B843",
      accentInk: "#3E2F12",
      accentStrong: "#A56B18",
      focus: "#B67E1F",
    },
  },
  {
    id: "roseveil",
    label: "Roseveil",
    description: "Dark pink profile glow.",
    colors: {
      canvas: "#22151D",
      canvasSoft: "#2D1A25",
      surface: "#3A202C",
      surfaceStrong: "#51283A",
      text: "#FFEAF1",
      muted: "#E7A8B9",
      line: "#7F3F59",
      lineStrong: "#B85C79",
      accent: "#F48CA2",
      accentInk: "#32131D",
      accentStrong: "#FFB0C2",
      focus: "#FF8FB6",
    },
  },
  {
    id: "leafveil",
    label: "Leafveil",
    description: "Calm green profile.",
    colors: {
      canvas: "#10231D",
      canvasSoft: "#153128",
      surface: "#18362B",
      surfaceStrong: "#22513F",
      text: "#E4FFF2",
      muted: "#9BCDB7",
      line: "#36705B",
      lineStrong: "#4B9679",
      accent: "#63D99C",
      accentInk: "#0B261A",
      accentStrong: "#9AF2C3",
      focus: "#7EF0B4",
    },
  },
  {
    id: "violet",
    label: "Violet",
    description: "Soft purple night profile.",
    colors: {
      canvas: "#171627",
      canvasSoft: "#1E1B36",
      surface: "#242141",
      surfaceStrong: "#312A5C",
      text: "#F1ECFF",
      muted: "#B6A9E2",
      line: "#53478D",
      lineStrong: "#7660C4",
      accent: "#BDA4FF",
      accentInk: "#17112B",
      accentStrong: "#D7C8FF",
      focus: "#C6A8FF",
    },
  },
  {
    id: "ember",
    label: "Ember",
    description: "Warm dark amber profile.",
    colors: {
      canvas: "#241713",
      canvasSoft: "#322018",
      surface: "#3A241C",
      surfaceStrong: "#573023",
      text: "#FFF0E4",
      muted: "#E0A984",
      line: "#814832",
      lineStrong: "#B76541",
      accent: "#FF9E57",
      accentInk: "#2D160B",
      accentStrong: "#FFC29A",
      focus: "#FFAB70",
    },
  },
  {
    id: "ocean",
    label: "Ocean",
    description: "Deep cyan profile.",
    colors: {
      canvas: "#081F2E",
      canvasSoft: "#0C2B40",
      surface: "#11384D",
      surfaceStrong: "#19506A",
      text: "#E6F8FF",
      muted: "#98C2D4",
      line: "#2A6E88",
      lineStrong: "#3F91AF",
      accent: "#5CE1FF",
      accentInk: "#062536",
      accentStrong: "#9AF1FF",
      focus: "#71E4FF",
    },
  },
];

export const defaultProfileThemePresetId = "frostveil";

const profileThemePresetMap = new Map(
  profileThemePresets.map((preset) => [preset.id, preset]),
);

export function profileThemePresetById(id: string | undefined | null): ProfileThemePreset {
  const preset =
    (id ? profileThemePresetMap.get(id) : undefined) ??
    profileThemePresetMap.get(defaultProfileThemePresetId) ??
    profileThemePresets[0];

  if (!preset) {
    throw new Error("Profile theme presets are not configured.");
  }

  return preset;
}

export function normalizeProfileThemeConfig(
  value: unknown,
): ProfileThemeConfig | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;

  if (record.mode === "preset") {
    const preset = typeof record.preset === "string" ? record.preset : undefined;

    if (!preset || !profileThemePresetMap.has(preset)) {
      return null;
    }

    return { mode: "preset", preset };
  }

  if (record.mode !== "custom" || !record.colors || typeof record.colors !== "object") {
    return null;
  }

  const colorsRecord = record.colors as Record<string, unknown>;
  const colors = {} as ProfileThemeColors;

  for (const key of profileThemeColorKeys) {
    const color = colorsRecord[key];

    if (typeof color !== "string" || !/^#[0-9a-fA-F]{6}$/.test(color)) {
      return null;
    }

    colors[key] = color.toUpperCase();
  }

  return { mode: "custom", colors };
}

export function profileThemeConfigColors(
  config: ProfileThemeConfig | null | undefined,
): ProfileThemeColors | null {
  if (!config) {
    return null;
  }

  if (config.mode === "custom") {
    return config.colors;
  }

  return profileThemePresetById(config.preset).colors;
}

export function profileThemeConfigToCssProperties(
  config: ProfileThemeConfig | null | undefined,
): CSSProperties | undefined {
  const colors = profileThemeConfigColors(config);

  if (!colors) {
    return undefined;
  }

  return profileThemeColorsToCssProperties(colors);
}

export function profileThemeColorsToCssProperties(
  colors: ProfileThemeColors,
): CSSProperties {
  return {
    "--app-canvas": colors.canvas,
    "--app-canvas-soft": colors.canvasSoft,
    "--app-surface": colors.surface,
    "--app-surface-strong": colors.surfaceStrong,
    "--app-text": colors.text,
    "--app-muted": colors.muted,
    "--app-line": colors.line,
    "--app-line-strong": colors.lineStrong,
    "--app-focus": colors.focus,
    "--app-accent": colors.accent,
    "--app-accent-ink": colors.accentInk,
    "--app-accent-strong": colors.accentStrong,
    "--app-accent-contrast": colors.accentInk,
    "--accent-sun": colors.accent,
    "--accent-sun-ink": colors.accentStrong,
    "--accent-frost": colors.accent,
    "--accent-frost-ink": colors.accentStrong,
    "--accent-leaf": colors.accent,
    "--accent-leaf-ink": colors.accentStrong,
    "--accent-rose": colors.accent,
    "--accent-rose-ink": colors.accentStrong,
  } as CSSProperties;
}

export function applyProfileThemeToRoot(
  config: ProfileThemeConfig | null | undefined,
): () => void {
  if (typeof document === "undefined" || typeof window === "undefined") {
    return () => undefined;
  }

  const colors = profileThemeConfigColors(config);

  if (!colors) {
    return () => undefined;
  }

  const root = document.documentElement;
  const properties = profileThemeColorsToCssProperties(colors);
  const signature = JSON.stringify(config ?? null);
  const token = Symbol("profile-theme-root");

  if (rootThemeCleanupTimer !== undefined) {
    window.clearTimeout(rootThemeCleanupTimer);
    rootThemeCleanupTimer = undefined;
  }

  if (!rootThemeActiveSignature) {
    rootThemeRestoreValues = new Map(
      Object.keys(properties).map((property) => [
        property,
        root.style.getPropertyValue(property),
      ]),
    );
    rootThemeRestoreDataset = root.dataset.profileTheme;
  }

  function applyProperties() {
    Object.entries(properties).forEach(([property, value]) => {
      if (typeof value !== "string") {
        return;
      }

      root.style.setProperty(property, value);
    });
    root.dataset.profileTheme = config?.mode ?? "custom";
  }

  if (rootThemeActiveSignature === signature) {
    applyProperties();
  } else {
    rootThemeActiveSignature = signature;
    withRootThemeTransition(applyProperties);
  }

  rootThemeActiveToken = token;

  return () => {
    if (rootThemeActiveToken !== token) {
      return;
    }

    rootThemeActiveToken = undefined;
    rootThemeCleanupTimer = window.setTimeout(() => {
      if (rootThemeActiveToken) {
        return;
      }

      const restoreValues = rootThemeRestoreValues;
      const restoreDataset = rootThemeRestoreDataset;

      withRootThemeTransition(() => {
        restoreValues?.forEach((value, property) => {
          if (value) {
            root.style.setProperty(property, value);
          } else {
            root.style.removeProperty(property);
          }
        });

        if (restoreDataset) {
          root.dataset.profileTheme = restoreDataset;
        } else {
          delete root.dataset.profileTheme;
        }
      });

      rootThemeActiveSignature = undefined;
      rootThemeCleanupTimer = undefined;
      rootThemeRestoreDataset = undefined;
      rootThemeRestoreValues = undefined;
    }, rootThemeCleanupDelayMs);
  };
}

export function profileThemeConfigEquals(
  first: ProfileThemeConfig | null | undefined,
  second: ProfileThemeConfig | null | undefined,
): boolean {
  return JSON.stringify(first ?? null) === JSON.stringify(second ?? null);
}

export function profileThemeCustomFromPreset(
  presetId: string | undefined | null,
): Extract<ProfileThemeConfig, { mode: "custom" }> {
  return {
    mode: "custom",
    colors: { ...profileThemePresetById(presetId).colors },
  };
}

export function profileThemeContrastWarnings(
  colors: ProfileThemeColors,
): string[] {
  const warnings: string[] = [];

  if (contrastRatio(colors.text, colors.canvas) < 4.5) {
    warnings.push("Main text needs more contrast against the page background.");
  }

  if (contrastRatio(colors.text, colors.surface) < 4.5) {
    warnings.push("Main text needs more contrast against module surfaces.");
  }

  if (contrastRatio(colors.accentInk, colors.accent) < 3) {
    warnings.push("Accent text may be hard to read on accent buttons.");
  }

  return warnings;
}

export function profileThemeHasBlockingContrastIssue(
  colors: ProfileThemeColors,
): boolean {
  return contrastRatio(colors.text, colors.canvas) < 2.4 ||
    contrastRatio(colors.text, colors.surface) < 2.4 ||
    contrastRatio(colors.accentInk, colors.accent) < 1.8;
}

function contrastRatio(first: string, second: string): number {
  const light = relativeLuminance(first);
  const dark = relativeLuminance(second);
  const lighter = Math.max(light, dark);
  const darker = Math.min(light, dark);

  return (lighter + 0.05) / (darker + 0.05);
}

function relativeLuminance(hex: string): number {
  const [red, green, blue] = hexToRgb(hex).map((channel) => {
    const normalized = channel / 255;

    return normalized <= 0.03928
      ? normalized / 12.92
      : Math.pow((normalized + 0.055) / 1.055, 2.4);
  }) as [number, number, number];

  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function hexToRgb(hex: string): [number, number, number] {
  const match = /^#([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})$/.exec(hex);

  if (!match) {
    return [0, 0, 0];
  }

  return [
    Number.parseInt(match[1]!, 16),
    Number.parseInt(match[2]!, 16),
    Number.parseInt(match[3]!, 16),
  ];
}
