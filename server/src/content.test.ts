import type { Pool, PoolConnection } from "mysql2/promise";
import { describe, expect, it, vi } from "vitest";

import {
  assertCurrentRoomRulesVersion,
  ContentRouteError,
  createContentMutationsRepository,
  roomFeedViewerCanPost,
  roomInvitationAllowsJoin,
  roomRulesAcceptanceVersion,
  validatePostAttachments,
  validatePostMedia,
} from "./content.js";
import type { PostPayload } from "./profiles.js";
import type { RoomPayload, UserPayload } from "./rooms.js";
import type { RequestSession } from "./sessions.js";

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

  it("rejects forged KLIPY metadata that would make viewers contact another host", () => {
    expect(() =>
      validatePostAttachments({
        attachments: [
          {
            kind: "gif",
            provider: "klipy",
            resourceId: "gif-1",
            resourceKey: "klipy:gif-1",
            url: "https://tracker.example/gif-1.gif",
          },
        ],
      }),
    ).toThrow("Choose a KLIPY GIF.");

    expect(() =>
      validatePostAttachments({
        attachments: [
          {
            kind: "gif",
            provider: "klipy",
            resourceId: "gif-1",
            resourceKey: "klipy:gif-1",
            url: "https://media.klipy.com/gif-1.gif",
            sourceUrl: "https://tracker.example/open",
          },
        ],
      }),
    ).toThrow("Post GIF source URL is invalid.");
  });

  it("rejects attachment metadata outside upload and database bounds", () => {
    const base = {
      kind: "video",
      url: "/uploads/media/2026/06/post_media-bounds.mp4",
      mime: "video/mp4",
      posterUrl: "/uploads/media/2026/06/post_media-bounds-poster.webp",
    };

    expect(() => validatePostAttachments({
      attachments: [{ ...base, sizeBytes: 100 * 1024 * 1024 + 1 }],
    })).toThrow("Attachment size is invalid.");
    expect(() => validatePostAttachments({
      attachments: [{ ...base, width: 4_294_967_296 }],
    })).toThrow("Attachment width is invalid.");
    expect(() => validatePostAttachments({
      attachments: [{ ...base, durationSeconds: 10_000_000 }],
    })).toThrow("Attachment duration is invalid.");
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

const nativeShareSession: RequestSession = {
  sessionId: 7,
  userId: 42,
  tokenHash: "session-token-hash",
  handle: "viewer",
  role: "member",
};

function nativeShareUser(id: number): UserPayload {
  return {
    id,
    handle: `member${id}`,
    displayName: `Member ${id}`,
    initials: "M",
    aura: "frost",
    avatarUrl: null,
  };
}

const nativeShareRoom: RoomPayload = {
  id: 77,
  slug: "secret-garden",
  name: "Secret Garden",
  summary: "A private garden.",
  description: "A private garden.",
  mood: "verdant",
  members: 4,
  memberCount: 4,
  live: false,
  theme: "elphaba",
  themeConfig: { mode: "preset", preset: "elphaba" },
  iconUrl: null,
  bannerUrl: null,
  rules: "Be kind.",
  rulesVersion: 1,
  visibility: "private",
  createdBy: 41,
  owner: nativeShareUser(41),
  joinedByMe: true,
  myRoomRole: "member",
  viewerCanViewPosts: true,
  viewerCanPost: true,
  viewerCanReact: true,
  viewerCanJoin: false,
  viewerCanRequestAccess: false,
  accessRequestStatus: null,
  postCount: 3,
  latestActivityAt: "2026-07-16 10:00:00",
  createdAt: "2026-07-10 10:00:00",
  updatedAt: "2026-07-16 10:00:00",
};

const nativeSharePost = {
  id: 99,
  publicId: "p123456789abc",
  body: "A native Post share.",
  createdAt: "2026-07-16 10:00:00",
  mediaUrl: null,
  mediaType: null,
  mediaMime: null,
  mediaPosterUrl: null,
  author: nativeShareUser(41),
  room: null,
} as PostPayload;

interface NativeShareRepositoryInternals {
  schemaCapabilities(): Promise<Record<string, boolean>>;
  requireRichMessageAttachmentStorage(): Promise<void>;
  fetchPostPayloadByIdentifier(
    identifier: string,
    viewerUserId: number,
    capabilities: Record<string, boolean>,
  ): Promise<PostPayload | null>;
  fetchShareRecipient(recipientUserId: number): Promise<UserPayload | null>;
  userPairBlockState(
    viewerUserId: number,
    recipientUserId: number,
    capabilities: Record<string, boolean>,
  ): Promise<{ viewerBlocksTarget: boolean; targetBlocksViewer: boolean }>;
  isMutualFollow(viewerUserId: number, recipientUserId: number): Promise<boolean>;
  createDirectNativeShareMessage(
    senderUserId: number,
    recipientUserId: number,
    body: string,
    attachment: { postId: number } | { roomId: number },
  ): Promise<{ conversationId: number; messageId: number }>;
  createNotification(...args: unknown[]): Promise<void>;
  roomRecordBySlug(slug: string): Promise<Record<string, unknown> | null>;
  roomCanViewPostsForViewer(room: Record<string, unknown>, viewer: Record<string, unknown>): Promise<boolean>;
  fetchRoomBySlugForSession(
    slug: string,
    session: RequestSession,
    capabilities: Record<string, boolean>,
  ): Promise<RoomPayload>;
}

function nativeShareRepositoryHarness() {
  const repository = createContentMutationsRepository(
    { execute: vi.fn(), getConnection: vi.fn() } as unknown as Pool,
    { publicBaseUrl: "https://thia.lol" },
  );
  const internals = repository as unknown as NativeShareRepositoryInternals;
  const schemaCapabilities = vi.fn(async () => ({
    hasConversations: true,
    hasConversationMembers: true,
    hasMessages: true,
    hasUserFollows: true,
    hasUserBlocks: true,
    hasMessageAttachments: true,
    hasRoomMemberships: true,
    hasRoomCustomizationColumns: true,
    hasRoomSoftDeleteColumn: true,
  }));
  const requireRichMessageAttachmentStorage = vi.fn(async () => undefined);
  const fetchPostPayloadByIdentifier = vi.fn(async () => nativeSharePost);
  const fetchShareRecipient = vi.fn(async (recipientUserId: number) =>
    recipientUserId === 45 ? null : nativeShareUser(recipientUserId));
  const userPairBlockState = vi.fn(async () => ({
    viewerBlocksTarget: false,
    targetBlocksViewer: false,
  }));
  const isMutualFollow = vi.fn(async (_viewerUserId: number, recipientUserId: number) => recipientUserId === 43);
  const createDirectNativeShareMessage = vi.fn(async () => ({ conversationId: 91, messageId: 501 }));
  const createNotification = vi.fn(async () => undefined);
  const roomRecordBySlug = vi.fn(async () => ({
    id: 77,
    slug: "secret-garden",
    visibility: "private",
  }));
  const roomCanViewPostsForViewer = vi.fn(async () => true);
  const fetchRoomBySlugForSession = vi.fn(async () => nativeShareRoom);

  Object.assign(internals, {
    schemaCapabilities,
    requireRichMessageAttachmentStorage,
    fetchPostPayloadByIdentifier,
    fetchShareRecipient,
    userPairBlockState,
    isMutualFollow,
    createDirectNativeShareMessage,
    createNotification,
    roomRecordBySlug,
    roomCanViewPostsForViewer,
    fetchRoomBySlugForSession,
  });

  return {
    repository,
    mocks: {
      createDirectNativeShareMessage,
      createNotification,
      fetchPostPayloadByIdentifier,
      fetchRoomBySlugForSession,
      fetchShareRecipient,
      isMutualFollow,
      roomCanViewPostsForViewer,
      roomRecordBySlug,
      userPairBlockState,
    },
  };
}

function nativeShareTransactionHarness(options: { failAttachmentInsert?: boolean } = {}) {
  const execute = vi.fn(async (sql: string) => {
    if (/INSERT INTO message_attachments/u.test(sql) && options.failAttachmentInsert === true) {
      throw new Error("attachment insert failed");
    }

    if (/SELECT id\s+FROM conversations/u.test(sql)) {
      return [[{ id: 91 }], []];
    }

    if (/INSERT INTO messages/u.test(sql)) {
      return [{ affectedRows: 1, insertId: 501 }, []];
    }

    return [{ affectedRows: 1, insertId: 0 }, []];
  });
  const beginTransaction = vi.fn(async () => undefined);
  const commit = vi.fn(async () => undefined);
  const rollback = vi.fn(async () => undefined);
  const release = vi.fn();
  const connection = {
    execute,
    beginTransaction,
    commit,
    rollback,
    release,
  } as unknown as PoolConnection;
  const pool = {
    getConnection: vi.fn(async () => connection),
  } as unknown as Pool;
  const repository = createContentMutationsRepository(pool, { publicBaseUrl: "https://thia.lol" });
  const internals = repository as unknown as Pick<NativeShareRepositoryInternals, "createDirectNativeShareMessage">;

  return {
    internals,
    execute,
    beginTransaction,
    commit,
    rollback,
    release,
  };
}

describe("native Post and Room message shares", () => {
  it("returns per-recipient Post results and only writes for mutual follows", async () => {
    const { repository, mocks } = nativeShareRepositoryHarness();

    const payload = await repository.sharePostToMessages("p123456789abc", 42, {
      recipientUserIds: [43, 44, 45, 42],
      note: "  Look at this  ",
    });

    expect(payload).toMatchObject({
      post: {
        id: 99,
        publicId: "p123456789abc",
        canonicalPath: "/@member41/posts/p123456789abc",
        canonicalUrl: "https://thia.lol/@member41/posts/p123456789abc",
      },
      sentCount: 1,
      failedCount: 3,
      results: [
        {
          recipientUserId: 43,
          status: "sent",
          conversationId: 91,
          messageId: 501,
        },
        {
          recipientUserId: 44,
          status: "failed",
          error: "Follow each other to chat.",
        },
        {
          recipientUserId: 45,
          status: "failed",
          error: "Profile not found.",
        },
        {
          recipientUserId: 42,
          status: "failed",
          error: "Choose another member.",
        },
      ],
    });
    expect(mocks.isMutualFollow).toHaveBeenCalledTimes(2);
    expect(mocks.isMutualFollow).toHaveBeenNthCalledWith(1, 42, 43);
    expect(mocks.isMutualFollow).toHaveBeenNthCalledWith(2, 42, 44);
    expect(mocks.createDirectNativeShareMessage).toHaveBeenCalledOnce();
    expect(mocks.createDirectNativeShareMessage).toHaveBeenCalledWith(
      42,
      43,
      "Look at this",
      { postId: 99 },
    );
    expect(mocks.createNotification).toHaveBeenCalledOnce();
  });

  it("does not reveal or share a Room the viewer cannot access", async () => {
    const { repository, mocks } = nativeShareRepositoryHarness();
    mocks.roomCanViewPostsForViewer.mockResolvedValue(false);

    await expect(repository.shareRoomToMessages("secret-garden", nativeShareSession, {
      recipientUserIds: [43],
    })).rejects.toEqual(new ContentRouteError("Room not found.", 404));

    expect(mocks.roomRecordBySlug).toHaveBeenCalledWith("secret-garden");
    expect(mocks.fetchRoomBySlugForSession).not.toHaveBeenCalled();
    expect(mocks.fetchShareRecipient).not.toHaveBeenCalled();
    expect(mocks.createDirectNativeShareMessage).not.toHaveBeenCalled();
  });

  it("writes an accessible Room as a native attachment only for a mutual follow", async () => {
    const { repository, mocks } = nativeShareRepositoryHarness();

    const payload = await repository.shareRoomToMessages("secret-garden", nativeShareSession, {
      recipientUserIds: [43, 44],
      note: "  Join me here  ",
    });

    expect(payload).toMatchObject({
      room: { id: 77, slug: "secret-garden" },
      sentCount: 1,
      failedCount: 1,
      results: [
        { recipientUserId: 43, status: "sent", conversationId: 91, messageId: 501 },
        { recipientUserId: 44, status: "failed", error: "Follow each other to chat." },
      ],
    });
    expect(mocks.createDirectNativeShareMessage).toHaveBeenCalledOnce();
    expect(mocks.createDirectNativeShareMessage).toHaveBeenCalledWith(
      42,
      43,
      "Join me here",
      { roomId: 77 },
    );
  });

  it.each([
    {
      label: "Post",
      attachment: { postId: 99 } as const,
      expectedAttachmentValues: [501, "post", 99, null],
    },
    {
      label: "Room",
      attachment: { roomId: 77 } as const,
      expectedAttachmentValues: [501, "room", null, 77],
    },
  ])("persists a native $label attachment and commits its message transaction", async ({
    attachment,
    expectedAttachmentValues,
  }) => {
    const harness = nativeShareTransactionHarness();

    await expect(harness.internals.createDirectNativeShareMessage(42, 7, "A note", attachment)).resolves.toEqual({
      conversationId: 91,
      messageId: 501,
    });

    expect(harness.beginTransaction).toHaveBeenCalledOnce();
    expect(harness.execute).toHaveBeenCalledWith(
      expect.stringContaining("INSERT IGNORE INTO conversations"),
      [7, 42],
    );
    expect(harness.execute).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO messages"),
      [91, 42, "A note"],
    );
    expect(harness.execute).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO message_attachments"),
      expectedAttachmentValues,
    );
    expect(harness.execute).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE conversation_members"),
      [91, 42],
    );
    expect(harness.commit).toHaveBeenCalledOnce();
    expect(harness.rollback).not.toHaveBeenCalled();
    expect(harness.release).toHaveBeenCalledOnce();
  });

  it("rolls back the message when native attachment persistence fails", async () => {
    const harness = nativeShareTransactionHarness({ failAttachmentInsert: true });

    await expect(harness.internals.createDirectNativeShareMessage(42, 43, "", { postId: 99 }))
      .rejects.toThrow("attachment insert failed");

    expect(harness.commit).not.toHaveBeenCalled();
    expect(harness.rollback).toHaveBeenCalledOnce();
    expect(harness.release).toHaveBeenCalledOnce();
  });
});
