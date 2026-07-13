import { describe, expect, it } from "vitest";

import {
  profileBackgroundTreatment,
  profileCanvasGlassTreatment,
} from "./profileVisualTreatments";

describe("profile visual treatments", () => {
  it.each([
    [0, 94, 78],
    [58, 42, 52],
    [70, 32, 46],
    [92, 12, 36],
  ])(
    "maps canvas glass %i to canvas %i and module %i surface opacity",
    (glass, canvasSurfacePercent, moduleSurfacePercent) => {
      expect(profileCanvasGlassTreatment(glass)).toEqual({
        canvasSurfacePercent,
        moduleSurfacePercent,
        normalizedGlass: glass,
      });
    },
  );

  it("normalizes, clamps, and falls back to the default glass treatment", () => {
    expect(profileCanvasGlassTreatment(58.6).normalizedGlass).toBe(59);
    expect(profileCanvasGlassTreatment("70").normalizedGlass).toBe(70);
    expect(profileCanvasGlassTreatment(-12).normalizedGlass).toBe(0);
    expect(profileCanvasGlassTreatment(104).normalizedGlass).toBe(92);
    expect(profileCanvasGlassTreatment(undefined).normalizedGlass).toBe(58);
    expect(profileCanvasGlassTreatment("").normalizedGlass).toBe(58);
    expect(profileCanvasGlassTreatment(Number.NaN).normalizedGlass).toBe(58);
    expect(profileCanvasGlassTreatment(Number.POSITIVE_INFINITY).normalizedGlass).toBe(58);
  });

  it.each([
    ["none", "opacity-[0.84]", "", "clear"],
    ["soft", "opacity-[0.72]", "blur-[3px]", "soft"],
    ["medium", "opacity-[0.6]", "blur-[18px]", "muted"],
    ["heavy", "opacity-[0.46]", "blur-[42px]", "veiled"],
  ] as const)(
    "keeps the %s backdrop opacity, blur, and visibility name exact",
    (treatment, mediaOpacity, blurClass, name) => {
      const visualTreatment = profileBackgroundTreatment(treatment);

      expect({
        blurClass: visualTreatment.blurClass,
        mediaOpacity: visualTreatment.mediaOpacity,
        name: visualTreatment.name,
      }).toEqual({ blurClass, mediaOpacity, name });
    },
  );
});
