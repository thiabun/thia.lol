import { describe, expect, it } from "vitest";

import {
  integrationProviderFromHost,
  normalizeIntegrationUrl,
} from "./integration-urls.js";

describe("normalizeIntegrationUrl", () => {
  it("normalizes Spotify resources and locale-prefixed playlist URLs", () => {
    expect(
      normalizeIntegrationUrl(
        "https://open.spotify.com/intl-no/playlist/list-123?si=share#fragment",
      ),
    ).toEqual({
      ok: true,
      value: {
        provider: "spotify",
        resourceType: "playlist",
        resourceId: "list-123",
        resourceKey: "spotify:playlist:list-123",
        sourceUrl: "https://open.spotify.com/playlist/list-123",
      },
    });

    expect(
      normalizeIntegrationUrl("https://open.spotify.com/track/track123"),
    ).toMatchObject({
      ok: true,
      value: {
        provider: "spotify",
        resourceType: "track",
        resourceId: "track123",
      },
    });
  });

  it("preserves Apple Music and iTunes paths and query parameters", () => {
    expect(
      normalizeIntegrationUrl(
        "https://music.apple.com/no/playlist/my-list/pl.u-abc?l=nb#fragment",
      ),
    ).toEqual({
      ok: true,
      value: {
        provider: "apple_music",
        resourceType: "playlist",
        resourceId: "pl.u-abc",
        resourceKey: "apple_music:playlist:pl.u-abc",
        sourceUrl: "https://music.apple.com/no/playlist/my-list/pl.u-abc?l=nb",
      },
    });

    expect(
      normalizeIntegrationUrl(
        "https://itunes.apple.com/us/album/album-name/id123?i=track456&l=en",
      ),
    ).toEqual({
      ok: true,
      value: {
        provider: "apple_music",
        resourceType: "song",
        resourceId: "track456",
        resourceKey: "apple_music:song:track456",
        sourceUrl:
          "https://itunes.apple.com/us/album/album-name/id123?i=track456&l=en",
      },
    });
  });

  it("normalizes supported YouTube video, playlist, and channel hosts", () => {
    expect(
      normalizeIntegrationUrl(
        "https://music.youtube.com/playlist?list=PL123&feature=share",
      ),
    ).toMatchObject({
      ok: true,
      value: {
        provider: "youtube",
        resourceType: "playlist",
        resourceId: "PL123",
        sourceUrl: "https://www.youtube.com/playlist?list=PL123",
      },
    });

    expect(normalizeIntegrationUrl("https://youtu.be/video_123?t=10")).toMatchObject({
      ok: true,
      value: {
        provider: "youtube",
        resourceType: "video",
        resourceId: "video_123",
        sourceUrl: "https://www.youtube.com/watch?v=video_123",
      },
    });

    expect(normalizeIntegrationUrl("https://www.youtube.com/@Thia.Lol")).toMatchObject({
      ok: true,
      value: {
        provider: "youtube",
        resourceType: "channel",
        resourceId: "@Thia.Lol",
        sourceUrl: "https://www.youtube.com/@Thia.Lol",
      },
    });
  });

  it("normalizes Twitch channels and videos", () => {
    expect(normalizeIntegrationUrl("https://twitch.tv/ThiaBun")).toMatchObject({
      ok: true,
      value: {
        provider: "twitch",
        resourceType: "channel",
        resourceId: "thiabun",
        sourceUrl: "https://www.twitch.tv/thiabun",
      },
    });

    expect(normalizeIntegrationUrl("https://www.twitch.tv/videos/v12345")).toMatchObject({
      ok: true,
      value: {
        provider: "twitch",
        resourceType: "video",
        resourceId: "12345",
        sourceUrl: "https://www.twitch.tv/videos/12345",
      },
    });
  });

  it("normalizes GitHub repository URLs", () => {
    expect(normalizeIntegrationUrl("https://github.com/ThiaBun/Thia.Lol.git")).toEqual({
      ok: true,
      value: {
        provider: "github",
        resourceType: "repo",
        resourceId: "thiabun/thia.lol",
        resourceKey: "github:repo:thiabun/thia.lol",
        sourceUrl: "https://github.com/thiabun/thia.lol",
      },
    });
  });

  it.each([
    [null, "invalid"],
    ["not a URL", "invalid"],
    ["http://open.spotify.com/playlist/list123", "https_required"],
    [
      "https://listener:secret@open.spotify.com/playlist/list123",
      "credentials_forbidden",
    ],
    ["https://example.com/playlist/list123", "unsupported_host"],
    ["https://open.spotify.com/playlist/", "unsupported_resource"],
  ])("rejects %s with the %s reason", (value, reason) => {
    expect(normalizeIntegrationUrl(value)).toEqual({ ok: false, reason });
  });

  it("rejects URLs longer than the persistence limit", () => {
    expect(
      normalizeIntegrationUrl(
        `https://open.spotify.com/playlist/${"a".repeat(500)}`,
      ),
    ).toEqual({ ok: false, reason: "too_long" });
  });
});

describe("integrationProviderFromHost", () => {
  it.each([
    ["open.spotify.com", "spotify"],
    ["MUSIC.APPLE.COM", "apple_music"],
    ["music.youtube.com", "youtube"],
    ["www.twitch.tv", "twitch"],
    ["github.com", "github"],
    ["open.spotify.com.example.org", null],
  ])("maps %s to %s", (host, provider) => {
    expect(integrationProviderFromHost(host)).toBe(provider);
  });
});
