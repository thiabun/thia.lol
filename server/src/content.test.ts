import { describe, expect, it } from "vitest";

import { validatePostMedia } from "./content.js";

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
