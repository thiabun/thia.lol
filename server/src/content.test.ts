import { describe, expect, it } from "vitest";

import { validatePostAttachments, validatePostMedia } from "./content.js";

describe("post media validation", () => {
  it("accepts image upload metadata for posts and replies", () => {
    expect(
      validatePostMedia({
        mediaUrl: "/uploads/media/2026/06/post_media-abcdef1234567890abcdef1234567890.webp",
        mediaType: "image",
        mediaMime: "image/webp",
      }),
    ).toEqual({
      mime: "image/webp",
      posterUrl: null,
      type: "image",
      url: "/uploads/media/2026/06/post_media-abcdef1234567890abcdef1234567890.webp",
    });
  });

  it("accepts video upload metadata with a generated poster", () => {
    expect(
      validatePostMedia({
        mediaUrl: "/uploads/media/2026/06/post_media-abcdef1234567890abcdef1234567890.mp4",
        mediaType: "video",
        mediaMime: "video/mp4",
        mediaPosterUrl: "/uploads/media/2026/06/post_media-abcdef1234567890abcdef1234567890-poster.webp",
      }),
    ).toEqual({
      mime: "video/mp4",
      posterUrl: "/uploads/media/2026/06/post_media-abcdef1234567890abcdef1234567890-poster.webp",
      type: "video",
      url: "/uploads/media/2026/06/post_media-abcdef1234567890abcdef1234567890.mp4",
    });
  });

  it("infers old image media when metadata is absent", () => {
    expect(
      validatePostMedia({
        mediaUrl: "/uploads/media/2026/06/old-post-image.jpg",
      }),
    ).toMatchObject({
      mime: "image/jpeg",
      posterUrl: null,
      type: "image",
    });
  });

  it("rejects forged media and poster paths", () => {
    expect(() =>
      validatePostMedia({
        mediaUrl: "/uploads/avatar.webp",
        mediaType: "image",
      }),
    ).toThrow("Use Upload media to attach a file.");
    expect(() =>
      validatePostMedia({
        mediaUrl: "/uploads/media/2026/06/post_media-abcdef1234567890abcdef1234567890.mp4",
        mediaType: "video",
        mediaMime: "video/mp4",
        mediaPosterUrl: "/uploads/avatar.webp",
      }),
    ).toThrow("Post video poster URL is invalid.");
  });
});

describe("post attachment validation", () => {
  it("accepts up to eight ordered post attachments", () => {
    const attachments = [
      {
        kind: "image",
        url: "/uploads/media/2026/06/post_media-abcdef1234567890abcdef1234567890.webp",
        mime: "image/webp",
        width: 1200,
        height: 900,
      },
      {
        kind: "audio",
        url: "/uploads/media/2026/06/post_media-fedcba0987654321fedcba0987654321.mp3",
        mime: "audio/mpeg",
        sizeBytes: 4096,
        durationSeconds: 33.5,
      },
      {
        kind: "integration",
        provider: "spotify",
        resourceType: "track",
        resourceId: "spotify-track",
        resourceKey: "spotify:track:spotify-track",
        sourceUrl: "https://open.spotify.com/track/spotify-track?si=ignored",
        card: {
          title: "Track title",
          subtitle: "Artist",
        },
      },
      ...Array.from({ length: 5 }, (_value, index) => ({
        kind: "image",
        url: `/uploads/media/2026/06/post_media-extra-${index}.webp`,
        mime: "image/webp",
      })),
    ];

    const validated = validatePostAttachments({ attachments });

    expect(validated).toHaveLength(8);
    expect(validated[0]).toMatchObject({
      position: 1,
      kind: "image",
      url: "/uploads/media/2026/06/post_media-abcdef1234567890abcdef1234567890.webp",
      mime: "image/webp",
      width: 1200,
      height: 900,
    });
    expect(validated[1]).toMatchObject({
      position: 2,
      kind: "audio",
      url: "/uploads/media/2026/06/post_media-fedcba0987654321fedcba0987654321.mp3",
      mime: "audio/mpeg",
      sizeBytes: 4096,
      durationSeconds: 33.5,
    });
    expect(validated[2]).toMatchObject({
      position: 3,
      kind: "integration",
      provider: "spotify",
      resourceType: "track",
      resourceId: "spotify-track",
      resourceKey: "spotify:track:spotify-track",
      sourceUrl: "https://open.spotify.com/track/spotify-track?si=ignored",
      cardJson: JSON.stringify({
        title: "Track title",
        subtitle: "Artist",
      }),
    });
  });

  it("rejects more than eight attachments", () => {
    expect(() =>
      validatePostAttachments({
        attachments: Array.from({ length: 9 }, (_value, index) => ({
          kind: "image",
          url: `/uploads/media/2026/06/post_media-over-${index}.webp`,
          mime: "image/webp",
        })),
      }),
    ).toThrow("Posts can include up to 8 attachments.");
  });

  it("keeps legacy single media input compatible", () => {
    expect(
      validatePostAttachments({
        mediaUrl: "/uploads/media/2026/06/post_media-abcdef1234567890abcdef1234567890.mp4",
        mediaType: "video",
        mediaMime: "video/mp4",
        mediaPosterUrl: "/uploads/media/2026/06/post_media-abcdef1234567890abcdef1234567890-poster.webp",
      }),
    ).toEqual([
      {
        cardJson: null,
        durationSeconds: null,
        height: null,
        kind: "video",
        mime: "video/mp4",
        position: 1,
        posterUrl: "/uploads/media/2026/06/post_media-abcdef1234567890abcdef1234567890-poster.webp",
        provider: null,
        resourceId: null,
        resourceKey: null,
        resourceType: null,
        sizeBytes: null,
        sourceUrl: null,
        url: "/uploads/media/2026/06/post_media-abcdef1234567890abcdef1234567890.mp4",
        width: null,
      },
    ]);
  });

  it("rejects non-MP3 audio and unsupported music cards", () => {
    expect(() =>
      validatePostAttachments({
        attachments: [
          {
            kind: "audio",
            url: "/uploads/media/2026/06/post_media-abcdef1234567890abcdef1234567890.wav",
            mime: "audio/wav",
          },
        ],
      }),
    ).toThrow("Use Upload media to attach a file.");

    expect(() =>
      validatePostAttachments({
        attachments: [
          {
            kind: "integration",
            provider: "soundcloud",
            sourceUrl: "https://soundcloud.com/example/track",
          },
        ],
      }),
    ).toThrow("Post music integration provider is invalid.");
  });
});
