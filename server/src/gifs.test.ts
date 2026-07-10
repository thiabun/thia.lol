import { afterEach, describe, expect, it, vi } from "vitest";

import { createGifRepository } from "./gifs.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("KLIPY GIF repository", () => {
  it("returns an unavailable payload when no server key is configured", async () => {
    const repository = createGifRepository({ apiKey: "" });

    await expect(repository.trending({ limit: "12" })).resolves.toEqual({
      available: false,
      provider: "klipy",
      query: null,
      next: null,
      items: [],
    });
    await expect(repository.lookup("gif-1")).resolves.toBeNull();
    await expect(repository.registerShare({ id: "gif-1" })).resolves.toEqual({
      registered: false,
    });
  });

  it("normalizes KLIPY search results and caps requested limits", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));

      expect(url.pathname).toBe("/api/v1/secret/gifs/search");
      expect(url.searchParams.get("q")).toBe("wave");
      expect(url.searchParams.get("limit")).toBe("40");
      expect(url.searchParams.get("pos")).toBe("abc");
      expect(url.searchParams.get("country")).toBe("US");
      expect(url.searchParams.get("locale")).toBe("en_US");

      return new Response(
        JSON.stringify({
          next: "next-pos",
          results: [
            {
              id: "gif-1",
              title: "Wave",
              itemurl: "https://klipy.com/gif/gif-1",
              media_formats: {
                gif: {
                  url: "https://media.klipy.com/gif-1.gif",
                  dims: [320, 180],
                },
                tinygif: {
                  url: "https://media.klipy.com/gif-1-tiny.gif",
                  dims: [120, 68],
                },
              },
            },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const repository = createGifRepository({
      apiKey: "secret",
      baseUrl: "https://api.example.test/api/v1",
      country: "US",
      locale: "en_US",
    });
    const result = await repository.search({ q: "wave", limit: "100", cursor: "abc" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      available: true,
      provider: "klipy",
      query: "wave",
      next: "next-pos",
      items: [
        {
          id: "gif-1",
          title: "Wave",
          provider: "klipy",
          resourceType: "gif",
          resourceId: "gif-1",
          resourceKey: "klipy:gif-1",
          url: "https://media.klipy.com/gif-1.gif",
          previewUrl: "https://media.klipy.com/gif-1-tiny.gif",
          sourceUrl: "https://klipy.com/gif/gif-1",
          width: 320,
          height: 180,
          mime: "image/gif",
        },
      ],
    });
  });

  it("looks up GIFs by id and best-effort registers shares", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));

      if (url.pathname === "/api/v1/secret/gifs/registershare") {
        expect(url.searchParams.get("id")).toBe("gif-2");
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }

      expect(url.pathname).toBe("/api/v1/secret/gifs/gif-2");

      return new Response(
        JSON.stringify({
          id: "gif-2",
          content_description: "Spin",
          media_formats: {
            gif: {
              url: "https://media.klipy.com/gif-2.gif",
              width: 400,
              height: 300,
            },
            tinygif: { url: "https://media.klipy.com/gif-2-small.gif" },
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const repository = createGifRepository({
      apiKey: "secret",
      baseUrl: "https://api.example.test/api/v1",
    });

    await expect(repository.lookup("gif-2")).resolves.toMatchObject({
      id: "gif-2",
      title: "Spin",
      width: 400,
      height: 300,
    });
    await expect(repository.registerShare({ id: "gif-2", q: "spin" })).resolves.toEqual({
      registered: true,
    });
  });
});
