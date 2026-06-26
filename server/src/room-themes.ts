export type RoomThemeColorKey =
  | "canvas"
  | "canvasSoft"
  | "surface"
  | "surfaceStrong"
  | "text"
  | "muted"
  | "line"
  | "lineStrong"
  | "accent"
  | "accentInk"
  | "accentStrong"
  | "focus";

export type RoomThemeColors = Record<RoomThemeColorKey, string>;

export type RoomThemeConfig =
  | {
      mode: "preset";
      preset: string;
    }
  | {
      mode: "custom";
      colors: RoomThemeColors;
    };

export const roomThemeColorKeys: RoomThemeColorKey[] = [
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

export const roomThemePresetIds = new Set([
  "frostveil",
  "sunveil",
  "roseveil",
  "leafveil",
  "violet",
  "ember",
  "ocean",
]);

export function roomThemeFromLegacyAccent(value: string | null | undefined): string | null {
  switch (value) {
    case "var(--accent-sun)":
      return "sunveil";
    case "var(--accent-frost)":
      return "frostveil";
    case "var(--accent-leaf)":
      return "leafveil";
    case "var(--accent-rose)":
      return "roseveil";
    default:
      return null;
  }
}

export function roomThemeConfigPayload(
  value: string | null | undefined,
): RoomThemeConfig | null {
  const decoded = jsonObject(value);

  if (decoded === null) {
    return null;
  }

  if (decoded.mode === "preset") {
    const preset = decoded.preset;

    return typeof preset === "string" && roomThemePresetIds.has(preset)
      ? { mode: "preset", preset }
      : null;
  }

  if (decoded.mode !== "custom" || typeof decoded.colors !== "object" || decoded.colors === null || Array.isArray(decoded.colors)) {
    return null;
  }

  const rawColors = decoded.colors as Record<string, unknown>;
  const colors = {} as RoomThemeColors;

  for (const key of roomThemeColorKeys) {
    const color = rawColors[key];

    if (typeof color !== "string" || !/^#[0-9a-fA-F]{6}$/.test(color)) {
      return null;
    }

    colors[key] = color.toUpperCase();
  }

  return { mode: "custom", colors };
}

export function validateRoomThemeToken(value: unknown): string | null | undefined {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  return typeof value === "string" && roomThemePresetIds.has(value) ? value : undefined;
}

export function normalizeRoomThemeConfig(value: unknown): RoomThemeConfig | null | undefined {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  const record = value as Record<string, unknown>;

  if (record.mode === "preset") {
    const preset = typeof record.preset === "string" ? record.preset : undefined;

    return preset && roomThemePresetIds.has(preset) ? { mode: "preset", preset } : undefined;
  }

  if (record.mode !== "custom" || typeof record.colors !== "object" || record.colors === null || Array.isArray(record.colors)) {
    return undefined;
  }

  const rawColors = record.colors as Record<string, unknown>;
  const colors = {} as RoomThemeColors;

  for (const key of roomThemeColorKeys) {
    const color = rawColors[key];

    if (typeof color !== "string" || !/^#[0-9a-fA-F]{6}$/.test(color)) {
      return undefined;
    }

    colors[key] = color.toUpperCase();
  }

  return { mode: "custom", colors };
}

function jsonObject(value: string | null | undefined): Record<string, unknown> | null {
  if (!value) {
    return null;
  }

  try {
    const decoded = JSON.parse(value) as unknown;

    return decoded && typeof decoded === "object" && !Array.isArray(decoded)
      ? decoded as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
}
