import { describe, expect, it } from "vitest";
import { safeKlipyUrl, safeProviderImageUrl } from "./providerMedia";

describe("provider media URL safety", () => {
  it("allows known provider media and rejects tracking hosts", () => {
    expect(safeKlipyUrl("https://media.klipy.com/wave.gif")).toBe(
      "https://media.klipy.com/wave.gif",
    );
    expect(safeKlipyUrl("https://tracker.example/wave.gif")).toBeNull();
    expect(safeProviderImageUrl("https://i.ytimg.com/vi/demo/hqdefault.jpg")).toBe(
      "https://i.ytimg.com/vi/demo/hqdefault.jpg",
    );
    expect(safeProviderImageUrl("https://tracker.example/art.jpg")).toBeNull();
  });
});
