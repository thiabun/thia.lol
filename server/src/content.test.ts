import { describe, expect, it } from "vitest";

import {
  assertCurrentRoomRulesVersion,
  ContentRouteError,
  roomFeedViewerCanPost,
  roomInvitationAllowsJoin,
  roomRulesAcceptanceVersion,
  validatePostAttachments,
  validatePostMedia,
} from "./content.js";

describe("room rules acceptance", () => {
  it("requires explicit acceptance and a positive rules version", () => {
    expect(() => roomRulesAcceptanceVersion({ acceptedRulesVersion: 2 })).toThrow(
      new ContentRouteError("Review and accept the room rules before continuing.", 422),
    );
    expect(() => roomRulesAcceptanceVersion({ acceptedRules: true })).toThrow(
      new ContentRouteError("Review and accept the current room rules before continuing.", 422),
    );
    expect(() => roomRulesAcceptanceVersion({ acceptedRules: true, acceptedRulesVersion: 0 })).toThrow(
      new ContentRouteError("Accepted room rules version is invalid.", 422),
    );
    expect(roomRulesAcceptanceVersion({ acceptedRules: true, acceptedRulesVersion: 3 })).toBe(3);
  });

  it("rejects stale rules acceptance versions", () => {
    expect(() => assertCurrentRoomRulesVersion({ rules_version: 4 }, 3)).toThrow(
      new ContentRouteError("Room rules changed. Review the current rules before continuing.", 409),
    );
    expect(() => assertCurrentRoomRulesVersion({ rules_version: 4 }, 4)).not.toThrow();
  });

  it("allows public joins and active invitations without opening private rooms generally", () => {
    expect(roomInvitationAllowsJoin("public", null)).toBe(true);
    expect(roomInvitationAllowsJoin("private", "pending")).toBe(true);
    expect(roomInvitationAllowsJoin("invite", "pending")).toBe(true);
    expect(roomInvitationAllowsJoin("view_only", "pending")).toBe(true);
    expect(roomInvitationAllowsJoin("private", "accepted")).toBe(false);
    expect(roomInvitationAllowsJoin("private", "revoked")).toBe(false);
    expect(roomInvitationAllowsJoin("private", null)).toBe(false);
  });

  it("requires accepted membership before room feed writes", () => {
    expect(roomFeedViewerCanPost("public", "member", null)).toBe(false);
    expect(
      roomFeedViewerCanPost("public", "member", { role: "member", bannedAt: null }),
    ).toBe(true);
    expect(
      roomFeedViewerCanPost("view_only", "member", { role: "member", bannedAt: null }),
    ).toBe(false);
    expect(
      roomFeedViewerCanPost("view_only", "member", { role: "moderator", bannedAt: null }),
    ).toBe(true);
    expect(roomFeedViewerCanPost("private", "admin", null)).toBe(true);
  });
});

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

  it("accepts provider-backed KLIPY GIF attachments", () => {
    expect(
      validatePostAttachments({
        attachments: [
          {
            kind: "gif",
            provider: "klipy",
            resourceId: "gif-1",
            resourceKey: "klipy:gif-1",
            url: "https://media.klipy.com/gif-1.gif",
            width: 320,
            height: 180,
            sourceUrl: "https://klipy.com/gif/gif-1",
            card: {
              title: "Wave",
              provider: "klipy",
            },
          },
        ],
      }),
    ).toEqual([
      {
        position: 1,
        kind: "gif",
        url: "https://media.klipy.com/gif-1.gif",
        mime: "image/gif",
        sizeBytes: null,
        width: 320,
        height: 180,
        durationSeconds: null,
        posterUrl: null,
        provider: "klipy",
        resourceType: "gif",
        resourceId: "gif-1",
        resourceKey: "klipy:gif-1",
        sourceUrl: "https://klipy.com/gif/gif-1",
        cardJson: JSON.stringify({
          title: "Wave",
          provider: "klipy",
        }),
      },
    ]);
  });

  it("rejects GIF attachments from unknown providers", () => {
    expect(() =>
      validatePostAttachments({
        attachments: [
          {
            kind: "gif",
            provider: "giphy",
            resourceId: "gif-1",
            url: "https://media.example.test/gif-1.gif",
          },
        ],
      }),
    ).toThrow("Post GIF provider is invalid.");
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
