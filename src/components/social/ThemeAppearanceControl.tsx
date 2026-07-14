import { Palette, RotateCcw, X } from "lucide-react";
import { useState } from "react";
import { cn } from "../../lib/classNames";
import {
  defaultProfileThemePresetId,
  canonicalProfileThemePresetId,
  profileThemeColorKeys,
  profileThemeConfigColors,
  profileThemeConfigToCssProperties,
  profileThemeCustomFromPreset,
  profileThemeHasBlockingContrastIssue,
  profileThemePresetById,
  profileThemePresets,
  profileThemeContrastWarnings,
} from "../../lib/profileThemes";
import type { ProfileThemeColors, ProfileThemeConfig } from "../../lib/types";

type ThemeAppearanceControlProps = {
  compact?: boolean | undefined;
  config: ProfileThemeConfig | null | undefined;
  controlAttribute: "data-profile-edit-control" | "data-room-edit-control";
  description: string;
  label: string;
  previewTitle: string;
  previewSubtitle: string;
  previewLinkLabel: string;
  presentation?: "trigger" | "inline" | undefined;
  testIdKind: "profile" | "room";
  onChange: (config: ProfileThemeConfig | null) => void;
};

export function ThemeAppearanceControl({
  compact = false,
  config,
  controlAttribute,
  description,
  label,
  previewLinkLabel,
  previewSubtitle,
  previewTitle,
  presentation = "trigger",
  testIdKind,
  onChange,
}: ThemeAppearanceControlProps) {
  const [open, setOpen] = useState(false);
  const activeConfig =
    config?.mode === "preset"
      ? { mode: "preset" as const, preset: canonicalProfileThemePresetId(config.preset) ?? config.preset }
      : config ?? null;
  const activeColors = profileThemeConfigColors(activeConfig);
  const activeLabel = activeConfig
    ? activeConfig.mode === "custom"
      ? "Custom"
      : profileThemePresetById(activeConfig.preset).label
    : "Default";
  const swatchColors = activeColors ?? profileThemePresetById(defaultProfileThemePresetId).colors;
  const customConfig =
    activeConfig?.mode === "custom"
      ? activeConfig
      : profileThemeCustomFromPreset(
          activeConfig?.mode === "preset"
            ? activeConfig.preset
            : defaultProfileThemePresetId,
        );
  const customWarnings = profileThemeContrastWarnings(customConfig.colors);
  const customBlocked = profileThemeHasBlockingContrastIssue(customConfig.colors);
  const controlAttrs = { [controlAttribute]: "true" };
  const rootTestId =
    testIdKind === "profile" ? "profile-appearance-controls" : "room-theme-controls";
  const triggerTestId =
    testIdKind === "profile" ? "profile-appearance-trigger" : "room-theme-trigger";
  const popoverTestId =
    testIdKind === "profile" ? "profile-appearance-popover" : "room-theme-popover";
  const presetTestId = (preset: string) =>
    testIdKind === "profile"
      ? `profile-theme-preset-${preset}`
      : `room-theme-preset-${preset}`;
  const customStartTestId =
    testIdKind === "profile" ? "profile-theme-custom-start" : "room-theme-custom-start";
  const resetTestId =
    testIdKind === "profile" ? "profile-theme-reset" : "room-theme-reset";
  const previewTestId =
    testIdKind === "profile" ? "profile-theme-preview" : "room-theme-preview";
  const colorTestId = (colorKey: keyof ProfileThemeColors) =>
    testIdKind === "profile"
      ? `profile-theme-color-${colorKey}`
      : `room-theme-color-${colorKey}`;

  function updateCustomColor(key: keyof ProfileThemeColors, color: string) {
    if (!/^#[0-9a-fA-F]{6}$/.test(color)) {
      return;
    }

    onChange({
      mode: "custom",
      colors: {
        ...customConfig.colors,
        [key]: color.toUpperCase(),
      },
    });
  }

  const inline = presentation === "inline";
  const visible = inline || open;

  return (
    <div className="relative" data-testid={rootTestId}>
      {!inline ? (
        <button
          type="button"
        className={cn(
          "flex w-full items-center rounded-control border border-line bg-canvas/50 text-left transition duration-fluid ease-fluid hover:border-line-strong hover:bg-canvas/70 focus-visible:outline-2 focus-visible:outline-focus",
          compact ? "min-h-9 gap-2 px-2" : "min-h-11 gap-3 px-3",
        )}
        aria-haspopup="dialog"
        aria-expanded={open}
        data-testid={triggerTestId}
        onClick={() => setOpen((current) => !current)}
        {...controlAttrs}
      >
        <span
          className={cn(
            "grid shrink-0 place-items-center rounded-card border border-line text-text",
            compact ? "size-7" : "size-8",
          )}
          style={{
            background: `linear-gradient(135deg, ${swatchColors.accent}, ${swatchColors.surface})`,
          }}
        >
          <Palette aria-hidden="true" size={compact ? 15 : 17} />
        </span>
        <span className="min-w-0 flex-1">
          <span className={cn("block truncate font-semibold text-text", compact ? "text-xs" : "text-sm")}>
            {label}
          </span>
          <span className="block truncate text-xs text-muted">{activeLabel}</span>
        </span>
      </button>
      ) : null}

      {visible ? (
        <div
          className={cn(
            "bg-surface/95 p-3 backdrop-blur-veil",
            inline
              ? "w-full"
              : "absolute left-0 top-full z-20 mt-2 w-[min(30rem,calc(100vw-2rem))] rounded-card border border-line shadow-lift",
          )}
          role={inline ? "group" : "dialog"}
          aria-label={label}
          data-testid={popoverTestId}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-text">{label}</p>
              <p className="mt-0.5 text-xs text-muted">{description}</p>
            </div>
            {!inline ? (
              <button
                type="button"
              className="grid size-8 shrink-0 place-items-center rounded-full border border-line bg-canvas/55 text-muted hover:text-text focus-visible:outline-2 focus-visible:outline-focus"
              aria-label={`Close ${label.toLowerCase()} settings`}
              onClick={() => setOpen(false)}
              {...controlAttrs}
            >
              <X aria-hidden="true" size={15} />
            </button>
            ) : null}
          </div>

          <div
            className={cn(
              "mt-3 grid grid-cols-2 gap-2",
              !inline ? "sm:grid-cols-4" : undefined,
            )}
          >
            <button
              type="button"
              className="min-h-20 rounded-card border border-line bg-canvas/55 p-2 text-left transition hover:border-line-strong focus-visible:outline-2 focus-visible:outline-focus aria-pressed:border-accent aria-pressed:bg-accent/12"
              aria-pressed={!activeConfig}
              data-testid={presetTestId("default")}
              onClick={() => onChange(null)}
              {...controlAttrs}
            >
              <span className="flex gap-1">
                <span className="h-4 flex-1 rounded-full bg-warm" />
                <span className="h-4 flex-1 rounded-full bg-cool" />
              </span>
              <span className="mt-2 block text-xs font-semibold text-text">Default</span>
              <span className="block text-[0.68rem] text-muted">Viewer theme</span>
            </button>
            {profileThemePresets.map((preset) => (
              <button
                key={preset.id}
                type="button"
                className="min-h-20 rounded-card border border-line bg-canvas/55 p-2 text-left transition hover:border-line-strong focus-visible:outline-2 focus-visible:outline-focus aria-pressed:border-accent aria-pressed:bg-accent/12"
                aria-pressed={activeConfig?.mode === "preset" && activeConfig.preset === preset.id}
                data-testid={presetTestId(preset.id)}
                onClick={() => onChange({ mode: "preset", preset: preset.id })}
                {...controlAttrs}
              >
                <span className="flex gap-1">
                  <span
                    className="h-4 flex-1 rounded-full"
                    style={{ backgroundColor: preset.colors.canvas }}
                  />
                  <span
                    className="h-4 flex-1 rounded-full"
                    style={{ backgroundColor: preset.colors.surface }}
                  />
                  <span
                    className="h-4 flex-1 rounded-full"
                    style={{ backgroundColor: preset.colors.accent }}
                  />
                </span>
                <span className="mt-2 block text-xs font-semibold text-text">{preset.label}</span>
                <span className="block truncate text-[0.68rem] text-muted">
                  {preset.description}
                </span>
              </button>
            ))}
          </div>

          <div className="mt-3 rounded-card border border-line bg-canvas/38 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-xs font-semibold uppercase text-muted">Custom</p>
                <p className="text-sm font-semibold text-text">Fine-tune your palette</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="inline-flex min-h-8 items-center gap-1.5 rounded-control border border-line bg-surface/62 px-2.5 text-xs font-semibold text-text transition hover:border-line-strong focus-visible:outline-2 focus-visible:outline-focus"
                  data-testid={customStartTestId}
                  onClick={() => onChange(customConfig)}
                  {...controlAttrs}
                >
                  <Palette aria-hidden="true" size={14} />
                  Custom
                </button>
                <button
                  type="button"
                  className="inline-flex min-h-8 items-center gap-1.5 rounded-control border border-line bg-surface/62 px-2.5 text-xs font-semibold text-text transition hover:border-line-strong focus-visible:outline-2 focus-visible:outline-focus"
                  data-testid={resetTestId}
                  onClick={() => onChange(null)}
                  {...controlAttrs}
                >
                  <RotateCcw aria-hidden="true" size={14} />
                  Reset
                </button>
              </div>
            </div>

            <div
              className="mt-3 overflow-hidden rounded-card border border-line"
              style={profileThemeConfigToCssProperties(customConfig)}
              data-testid={previewTestId}
            >
              <div className="bg-canvas p-3">
                <div className="rounded-card border border-line bg-surface p-3">
                  <p className="text-sm font-semibold text-text">{previewTitle}</p>
                  <p className="text-xs text-muted">{previewSubtitle}</p>
                  <div className="mt-3 flex items-center gap-2">
                    <span className="rounded-full bg-accent px-2.5 py-1 text-xs font-bold text-accent-ink">
                      Accent
                    </span>
                    <span className="text-xs font-semibold text-accent-strong">
                      {previewLinkLabel}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {customWarnings.length > 0 ? (
              <div
                className={cn(
                  "mt-3 rounded-card border p-2 text-xs font-medium",
                  customBlocked
                    ? "border-rose/35 bg-rose/12 text-rose-ink"
                    : "border-warm/35 bg-warm/14 text-warm-ink",
                )}
                role={customBlocked ? "alert" : "status"}
              >
                {customWarnings[0]}
              </div>
            ) : null}

            <div
              className={cn(
                "mt-3 grid gap-2",
                inline ? "grid-cols-1" : "sm:grid-cols-3",
              )}
            >
              {(["canvas", "surface", "text", "accent", "accentInk", "accentStrong"] as const).map(
                (key) => (
                  <ThemeColorInput
                    key={key}
                    colorKey={key}
                    testId={colorTestId(key)}
                    value={customConfig.colors[key]}
                    onChange={(color) => updateCustomColor(key, color)}
                    controlAttrs={controlAttrs}
                  />
                ),
              )}
            </div>

            <details className="mt-3 rounded-card border border-line bg-surface/46 p-2">
              <summary className="cursor-pointer text-xs font-semibold text-muted">
                Advanced colors
              </summary>
              <div
                className={cn(
                  "mt-3 grid gap-2",
                  inline ? "grid-cols-1" : "sm:grid-cols-3",
                )}
              >
                {profileThemeColorKeys
                  .filter(
                    (key) =>
                      ![
                        "canvas",
                        "surface",
                        "text",
                        "accent",
                        "accentInk",
                        "accentStrong",
                      ].includes(key),
                  )
                  .map((key) => (
                    <ThemeColorInput
                      key={key}
                      colorKey={key}
                      testId={colorTestId(key)}
                      value={customConfig.colors[key]}
                      onChange={(color) => updateCustomColor(key, color)}
                      controlAttrs={controlAttrs}
                    />
                  ))}
              </div>
            </details>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ThemeColorInput({
  colorKey,
  controlAttrs,
  testId,
  value,
  onChange,
}: {
  colorKey: keyof ProfileThemeColors;
  controlAttrs: Record<string, string>;
  testId: string;
  value: string;
  onChange: (color: string) => void;
}) {
  return (
    <label className="flex min-w-0 items-center gap-2 rounded-control border border-line bg-surface/58 p-2">
      <input
        className="size-8 shrink-0 cursor-pointer rounded-control border border-line bg-transparent"
        type="color"
        value={value}
        data-testid={testId}
        onChange={(event) => onChange(event.currentTarget.value)}
        {...controlAttrs}
      />
      <span className="min-w-0">
        <span className="block truncate text-xs font-semibold text-text">
          {themeColorLabel(colorKey)}
        </span>
        <span className="block font-mono text-[0.68rem] text-muted">{value}</span>
      </span>
    </label>
  );
}

function themeColorLabel(key: keyof ProfileThemeColors): string {
  const labels: Record<keyof ProfileThemeColors, string> = {
    canvas: "Page",
    canvasSoft: "Page soft",
    surface: "Surface",
    surfaceStrong: "Surface strong",
    text: "Text",
    muted: "Muted",
    line: "Line",
    lineStrong: "Line strong",
    accent: "Accent",
    accentInk: "Accent text",
    accentStrong: "Accent link",
    focus: "Focus",
  };

  return labels[key];
}
