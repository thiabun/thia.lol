import type { Pool, PoolConnection } from "mysql2/promise";
import { describe, expect, it, vi } from "vitest";

import {
  chronologicalMessageRows,
  conversationAccessAllowed,
  conversationSelectSql,
  createChatRepository,
  latestMessageWindowSql,
  roomChatViewerCanPost,
  type ChatRealtimeEventPayload,
  validateMessageAttachmentInputs,
  validateMessageReactionEmoji,
} from "./chat.js";
import type { PostDetailPayload, PostsRepository } from "./posts.js";
import type { RoomPayload, RoomsRepository } from "./rooms.js";
import type { RequestSession } from "./sessions.js";

describe("chat conversation boundaries", () => {
  it("keeps generic chat conversation reads direct-message only", () => {
    expect(conversationSelectSql()).toContain("AND c.type = 'direct'");
  });
});

describe("room chat participation", () => {
  it("requires an active membership for public room writes", () => {
    expect(roomChatViewerCanPost("public", "member", null)).toBe(false);
    expect(
      roomChatViewerCanPost("public", "member", { role: "member", bannedAt: null }),
    ).toBe(true);
    expect(
      roomChatViewerCanPost("public", "member", {
        role: "member",
        bannedAt: "2026-07-10 01:00:00",
      }),
    ).toBe(false);
  });

  it("limits view-only room writes to room staff while preserving admins", () => {
    expect(
      roomChatViewerCanPost("view_only", "member", { role: "member", bannedAt: null }),
    ).toBe(false);
    expect(
      roomChatViewerCanPost("view_only", "member", { role: "moderator", bannedAt: null }),
    ).toBe(true);
    expect(roomChatViewerCanPost("view_only", "admin", null)).toBe(true);
  });
});

describe("message reaction validation and access", () => {
  it("accepts normalized emoji graphemes, flags, and keycaps", () => {
    expect(validateMessageReactionEmoji("👍🏽")).toBe("👍🏽");
    expect(validateMessageReactionEmoji("✌️🏽")).toBe("✌️🏽");
    expect(validateMessageReactionEmoji("👨‍👩‍👧‍👦")).toBe("👨‍👩‍👧‍👦");
    expect(validateMessageReactionEmoji("🇳🇴")).toBe("🇳🇴");
    expect(validateMessageReactionEmoji("1️⃣")).toBe("1️⃣");
  });

  it("rejects text, multiple graphemes, whitespace, controls, and bidi controls", () => {
    for (const value of ["ok", "😀😀", " 😀", "😀\n", "😀\u202E", "😀\u200C"]) {
      expect(() => validateMessageReactionEmoji(value)).toThrow("Reaction must be exactly one emoji.");
    }
  });

  it("allows direct members, public viewers, and private members while denying public bans", () => {
    expect(conversationAccessAllowed(accessRow({
      conversation_type: "direct",
      direct_member_user_id: 7,
    }), { role: "member", userId: 7 })).toBe(true);
    expect(conversationAccessAllowed(accessRow({
      room_visibility: "public",
    }), { role: "member", userId: 7 })).toBe(true);
    expect(conversationAccessAllowed(accessRow({
      room_visibility: "public",
      room_membership_id: 3,
      room_membership_banned_at: "2026-08-13 00:00:00",
    }), { role: "member", userId: 7 })).toBe(false);
    expect(conversationAccessAllowed(accessRow({
      room_visibility: "private",
      room_membership_id: 3,
    }), { role: "member", userId: 7 })).toBe(true);
    expect(conversationAccessAllowed(accessRow({
      room_visibility: "invite",
    }), { role: "member", userId: 7 })).toBe(false);
  });
});

describe("chat attachment validation", () => {
  it("reuses the Post media and music contract", () => {
    const attachments = validateMessageAttachmentInputs([
      {
        type: "media",
        media: {
          kind: "image",
          url: "/uploads/media/2026/07/post_media-photo.webp",
          mime: "image/webp",
          width: 1200,
          height: 900,
        },
      },
      {
        kind: "audio",
        url: "/uploads/media/2026/07/post_media-song.mp3",
        mime: "audio/mpeg",
        durationSeconds: 123.5,
      },
      {
        kind: "integration",
        provider: "spotify",
        resourceType: "track",
        resourceId: "track-1",
        resourceKey: "spotify:track:track-1",
        sourceUrl: "https://open.spotify.com/track/track-1",
        card: { title: "A song" },
      },
      { type: "post", postId: 9 },
      { type: "room", room: { id: 4 } },
    ]);

    expect(attachments.map((attachment) => attachment.type)).toEqual([
      "media",
      "media",
      "media",
      "post",
      "room",
    ]);
    expect(attachments[2]).toMatchObject({
      type: "media",
      attachment: { kind: "integration", provider: "spotify", resourceId: "track-1" },
    });
  });

  it("enforces the shared eight-attachment cap and music allowlist", () => {
    expect(() => validateMessageAttachmentInputs(Array.from({ length: 9 }, () => ({
      kind: "image",
      url: "/uploads/media/2026/07/post_media-photo.webp",
    })))).toThrow("Messages can include up to 8 attachments.");

    expect(() => validateMessageAttachmentInputs([{
      kind: "integration",
      provider: "soundcloud",
      sourceUrl: "https://soundcloud.com/example/song",
    }])).toThrow("Message music integration provider is invalid.");
  });

  it("bounds automatic native-link resolution and stops once the attachment tray is full", async () => {
    const postsRepository = {
      getPublicPost: vi.fn().mockResolvedValue(null),
    } as unknown as PostsRepository;
    const roomsRepository = {
      getPublicRoom: vi.fn().mockResolvedValue(null),
    } as unknown as RoomsRepository;
    const repository = createChatRepository(
      {} as Pool,
      "https://thia.lol",
      { postsRepository, roomsRepository },
    ) as unknown as {
      chatMessageDraft(session: RequestSession, body: Record<string, unknown>): Promise<{ attachments: unknown[] }>;
    };
    const links = Array.from({ length: 10 }, (_, index) => index % 2 === 0
      ? `https://thia.lol/@thia/posts/p000000${index}`
      : `https://thia.lol/rooms/room-${index}`);

    await expect(repository.chatMessageDraft(session(), { body: links.join(" ") })).resolves.toMatchObject({
      attachments: [],
    });
    expect(postsRepository.getPublicPost.mock.calls.length + roomsRepository.getPublicRoom.mock.calls.length).toBe(8);

    postsRepository.getPublicPost.mockClear();
    roomsRepository.getPublicRoom.mockClear();

    await expect(repository.chatMessageDraft(session(), {
      body: links[0],
      attachments: Array.from({ length: 8 }, (_, index) => ({
        kind: "image",
        url: `/uploads/media/2026/07/post_media-photo-${index}.webp`,
      })),
    })).resolves.toMatchObject({ attachments: expect.any(Array) });
    expect(postsRepository.getPublicPost).not.toHaveBeenCalled();
    expect(roomsRepository.getPublicRoom).not.toHaveBeenCalled();
  });

  it("does not recognize an invite-only Room shell as a shareable native attachment", async () => {
    const roomsRepository = {
      getPublicRoom: vi.fn().mockResolvedValue({
        id: 4,
        slug: "secret-garden",
        viewerCanViewPosts: false,
      } as RoomPayload),
      getPublicRoomsByIds: vi.fn().mockResolvedValue(new Map([[4, {
        id: 4,
        slug: "secret-garden",
        viewerCanViewPosts: false,
      } as RoomPayload]])),
    } as unknown as RoomsRepository;
    const repository = createChatRepository(
      {} as Pool,
      "https://thia.lol",
      { roomsRepository },
    ) as unknown as {
      chatMessageDraft(
        session: RequestSession,
        body: Record<string, unknown>,
      ): Promise<{ body: string; attachments: unknown[] }>;
    };
    const roomUrl = "https://thia.lol/rooms/secret-garden";

    await expect(repository.chatMessageDraft(session(), { body: roomUrl })).resolves.toEqual(expect.objectContaining({
      body: roomUrl,
      attachments: [],
    }));
    expect(roomsRepository.getPublicRoom).toHaveBeenCalledOnce();

    await expect(repository.chatMessageDraft(session(), {
      body: "A forged native Room share",
      attachments: [{ type: "room", room: { id: 4 } }],
    })).rejects.toThrow("Room is unavailable or inaccessible.");
    expect(roomsRepository.getPublicRoomsByIds).toHaveBeenCalledWith(
      [4],
      expect.objectContaining({ userId: 7 }),
    );
  });
});

describe("chat message windows", () => {
  it("queries the newest bounded window and returns it chronologically", () => {
    expect(latestMessageWindowSql(150)).toBe(
      "ORDER BY m.created_at DESC, m.id DESC\n       LIMIT 150",
    );
    expect(chronologicalMessageRows([{ id: 3 }, { id: 2 }, { id: 1 }])).toEqual([
      { id: 1 },
      { id: 2 },
      { id: 3 },
    ]);
  });

  it("uses native attachment labels instead of legacy raw share URLs in conversation previews", async () => {
    const execute = vi.fn(async (sqlValue: unknown) => {
      const sql = String(sqlValue);

      if (sql.includes("information_schema.TABLES")) {
        return [[{ value: 1 }], []];
      }

      if (sql.includes("FROM conversation_members viewer_member")) {
        return [[{
          ...conversationRow(),
          last_message_id: 91,
          last_message_body: "https://thia.lol/@alex/posts/pabc123def456",
          last_message_created_at: "2026-07-16 01:00:00",
          last_sender_user_id: 8,
          last_sender_handle: "friend",
          last_sender_display_name: "Friend",
        }], []];
      }

      if (sql.includes("FROM message_attachments")) {
        return [[{ message_id: 91, type: "post" }], []];
      }

      throw new Error(`Unexpected preview query: ${sql}`);
    });
    const repository = createChatRepository({ execute } as unknown as Pool);

    const conversations = await repository.listConversations(7);

    expect(conversations[0]?.lastMessage).toMatchObject({
      body: "https://thia.lol/@alex/posts/pabc123def456",
      previewText: "Post",
    });
  });

  it("hydrates a full direct-message window with one entity query and one attachment query", async () => {
    const calls: Array<{ sql: string; params: unknown[] }> = [];
    const execute = vi.fn(async (sqlValue: unknown, paramsValue: unknown[] = []) => {
      const sql = String(sqlValue);
      const params = [...paramsValue];
      calls.push({ sql, params });

      if (sql.includes("information_schema.TABLES") || sql.includes("information_schema.COLUMNS")) {
        return [[{ value: 1 }], []];
      }

      if (sql.includes("FROM conversation_members viewer_member")) {
        return [[conversationRow()], []];
      }

      if (sql.includes("FROM messages m")) {
        return [[
          messageRow(3, "removed", "2026-07-10 03:00:00", "2026-07-10 04:00:00"),
          messageRow(2, "hello @friend", "2026-07-10 02:00:00"),
          messageRow(1, "", "2026-07-10 01:00:00"),
        ], []];
      }

      if (sql.includes("FROM text_entities e")) {
        return [[{
          message_id: 2,
          entity_type: "mention",
          entity_start: 6,
          entity_length: 7,
          text_value: "@friend",
          url: null,
          card_json: null,
          target_user_id: 8,
          target_handle: "friend",
          target_display_name: "Friend",
          target_avatar_url: null,
        }], []];
      }

      if (sql.includes("FROM message_reactions mr")) {
        return [[
          { message_id: 1, emoji: "✨", reaction_count: 2, reacted_by_me: 1, first_reaction_id: 10 },
          { message_id: 2, emoji: "👍", reaction_count: 1, reacted_by_me: 0, first_reaction_id: 12 },
        ], []];
      }

      if (sql.includes("FROM message_attachments")) {
        return [[{
          message_id: 1,
          type: "gif",
          post_id: null,
          url: "https://media.example.test/wave.gif",
          mime: "image/gif",
          width: 320,
          height: 180,
          provider: "klipy",
          resource_type: "gif",
          resource_id: "wave",
          resource_key: "klipy:wave",
          source_url: "https://example.test/wave",
          card_json: "{\"label\":\"wave\"}",
        }], []];
      }

      throw new Error(`Unexpected chat query: ${sql}`);
    });
    const repository = createChatRepository({ execute } as unknown as Pool);

    const payload = await repository.listMessages(session(), 42);

    expect(payload.messages.map((message) => message.id)).toEqual([1, 2, 3]);
    expect(payload.messages[0]?.attachments).toEqual([{
      type: "gif",
      gif: {
        provider: "klipy",
        resourceType: "gif",
        resourceId: "wave",
        resourceKey: "klipy:wave",
        url: "https://media.example.test/wave.gif",
        mime: "image/gif",
        width: 320,
        height: 180,
        sourceUrl: "https://example.test/wave",
        card: { label: "wave" },
      },
    }]);
    expect(payload.messages[1]?.bodyEntities).toMatchObject([{
      type: "mention",
      start: 6,
      length: 7,
      text: "@friend",
      mention: { handle: "friend", user: { id: 8, handle: "friend" } },
    }]);
    expect(payload.messages[0]?.reactions).toEqual([{ emoji: "✨", count: 2, reactedByMe: true }]);
    expect(payload.messages[0]?.reactionVersion).toBe(0);
    expect(payload.messages[1]?.reactions).toEqual([{ emoji: "👍", count: 1, reactedByMe: false }]);
    expect(payload.messages[2]).toMatchObject({
      body: "",
      bodyEntities: [],
      attachments: [],
      reactions: [],
      deletedAt: "2026-07-10 04:00:00",
    });

    const entityCalls = calls.filter(({ sql }) => sql.includes("FROM text_entities e"));
    const attachmentCalls = calls.filter(({ sql }) => sql.includes("FROM message_attachments"));
    const reactionCalls = calls.filter(({ sql }) => sql.includes("FROM message_reactions mr"));
    expect(entityCalls).toHaveLength(1);
    expect(attachmentCalls).toHaveLength(1);
    expect(reactionCalls).toHaveLength(1);
    expect(entityCalls[0]?.params).toEqual([1, 2]);
    expect(attachmentCalls[0]?.params).toEqual([1, 2]);
    expect(reactionCalls[0]?.params).toEqual([7, 1, 2]);
  });

  it("hydrates multiple distinct native references with one viewer-aware batch per type", async () => {
    const execute = vi.fn(async (sqlValue: unknown) => {
      const sql = String(sqlValue);

      if (sql.includes("information_schema.TABLES") || sql.includes("information_schema.COLUMNS")) {
        return [[{ value: 1 }], []];
      }

      if (sql.includes("FROM conversation_members viewer_member")) {
        return [[conversationRow()], []];
      }

      if (sql.includes("FROM messages m")) {
        return [[messageRow(1, "", "2026-07-16 01:00:00")], []];
      }

      if (sql.includes("FROM text_entities e")) {
        return [[], []];
      }

      if (sql.includes("FROM message_attachments")) {
        return [[
          attachmentRow(1, 0, "image", {
            url: "/uploads/media/2026/07/post_media-photo.webp",
            mime: "image/webp",
            size_bytes: 5000,
            width: 1200,
            height: 900,
          }),
          attachmentRow(2, 1, "integration", {
            provider: "spotify",
            resource_type: "track",
            resource_id: "track-1",
            resource_key: "spotify:track:track-1",
            source_url: "https://open.spotify.com/track/track-1",
            card_json: "{\"title\":\"A song\"}",
          }),
          attachmentRow(3, 2, "post", { post_id: 9 }),
          attachmentRow(4, 3, "post", { post_id: 10 }),
          attachmentRow(5, 4, "post", { post_id: 9 }),
          attachmentRow(6, 5, "room", { room_id: 4 }),
          attachmentRow(7, 6, "room", { room_id: 5 }),
          attachmentRow(8, 7, "room", { room_id: 4 }),
        ], []];
      }

      if (sql.includes("FROM message_reactions mr")) {
        return [[], []];
      }

      throw new Error(`Unexpected rich attachment query: ${sql}`);
    });
    const post = {
      id: 9,
      publicId: "pc359fe2da759",
      canonicalPath: "/@thia/posts/pc359fe2da759",
      canonicalUrl: "https://thia.lol/@thia/posts/pc359fe2da759",
      author: { handle: "thia" },
      attachments: [{ kind: "video" }],
      likedByCurrentUser: true,
    } as unknown as PostDetailPayload;
    const room = {
      id: 4,
      slug: "moon-garden",
      name: "Moon Garden",
      visibility: "public",
      viewerCanViewPosts: true,
    } as unknown as RoomPayload;
    const postsRepository = {
      getPublicPostsByIds: vi.fn().mockResolvedValue(new Map([[9, post]])),
    } as unknown as PostsRepository;
    const roomsRepository = {
      getPublicRoomsByIds: vi.fn().mockResolvedValue(new Map([[4, room]])),
    } as unknown as RoomsRepository;
    const repository = createChatRepository(
      { execute } as unknown as Pool,
      "https://thia.lol",
      { postsRepository, roomsRepository },
    );

    const payload = await repository.listMessages(session(), 42);

    expect(payload.messages[0]?.attachments).toMatchObject([
      { type: "media", media: { kind: "image", position: 0, sizeBytes: 5000 } },
      { type: "media", media: { kind: "integration", provider: "spotify", card: { title: "A song" } } },
      { type: "post", post: { id: 9, likedByCurrentUser: true } },
      { type: "post", post: null },
      { type: "post", post: { id: 9, likedByCurrentUser: true } },
      { type: "room", room: { id: 4, canonicalPath: "/rooms/moon-garden" } },
      { type: "room", room: null },
      { type: "room", room: { id: 4, canonicalPath: "/rooms/moon-garden" } },
    ]);
    expect(postsRepository.getPublicPostsByIds).toHaveBeenCalledOnce();
    expect(postsRepository.getPublicPostsByIds).toHaveBeenCalledWith([9, 10], 7, "https://thia.lol");
    expect(roomsRepository.getPublicRoomsByIds).toHaveBeenCalledOnce();
    expect(roomsRepository.getPublicRoomsByIds).toHaveBeenCalledWith([4, 5], { userId: 7, role: "member" });
  });

  it("uses the same bounded bulk hydration for room-channel windows", async () => {
    const calls: Array<{ sql: string; params: unknown[] }> = [];
    const execute = vi.fn(async (sqlValue: unknown, paramsValue: unknown[] = []) => {
      const sql = String(sqlValue);
      const params = [...paramsValue];
      calls.push({ sql, params });

      if (sql.includes("information_schema.TABLES") || sql.includes("information_schema.COLUMNS")) {
        return [[{ value: 1 }], []];
      }

      if (sql.includes("FROM rooms") && sql.includes("WHERE slug = ?")) {
        return [[{ id: 9, slug: "garden", name: "Garden", visibility: "public", created_by: 5 }], []];
      }

      if (sql.includes("FROM room_channels rc")) {
        return [[roomChannelRow()], []];
      }

      if (sql.includes("INSERT IGNORE INTO conversation_members")) {
        return [{ affectedRows: 1 }, []];
      }

      if (sql.includes("FROM messages m")) {
        return [[
          messageRow(11, "later", "2026-07-10 02:00:00", null, 77),
          messageRow(10, "earlier", "2026-07-10 01:00:00", null, 77),
        ], []];
      }

      if (sql.includes("FROM room_memberships")) {
        return [[{ id: 19, role: "member", banned_at: null }], []];
      }

      if (
        sql.includes("FROM text_entities e") ||
        sql.includes("FROM message_attachments") ||
        sql.includes("FROM message_reactions mr")
      ) {
        return [[], []];
      }

      throw new Error(`Unexpected room chat query: ${sql}`);
    });
    const repository = createChatRepository({ execute } as unknown as Pool);

    const payload = await repository.listRoomChannelMessages(session(), "garden", "general");

    expect(payload.messages.map((message) => message.id)).toEqual([10, 11]);
    expect(calls.filter(({ sql }) => sql.includes("FROM text_entities e"))).toHaveLength(1);
    expect(calls.filter(({ sql }) => sql.includes("FROM message_attachments"))).toHaveLength(1);
    expect(calls.filter(({ sql }) => sql.includes("FROM message_reactions mr"))).toHaveLength(1);
    expect(calls.find(({ sql }) => sql.includes("FROM text_entities e"))?.params).toEqual([10, 11]);
    expect(calls.find(({ sql }) => sql.includes("FROM message_attachments"))?.params).toEqual([10, 11]);
  });

  it("degrades pre-migration history and discovers reaction storage after migration", async () => {
    const calls: Array<{ sql: string; params: unknown[] }> = [];
    let reactionTableChecks = 0;
    const execute = vi.fn(async (sqlValue: unknown, paramsValue: unknown[] = []) => {
      const sql = String(sqlValue);
      const params = [...paramsValue];
      calls.push({ sql, params });

      if (sql.includes("information_schema.TABLES")) {
        if (params[0] === "message_reactions") {
          reactionTableChecks += 1;
          return [[{ value: reactionTableChecks === 1 ? 0 : 1 }], []];
        }

        return [[{ value: 1 }], []];
      }

      if (sql.includes("information_schema.COLUMNS")) {
        return [[{ value: 1 }], []];
      }

      if (sql.includes("FROM conversation_members viewer_member")) {
        return [[conversationRow()], []];
      }

      if (sql.includes("FROM messages m")) {
        return [[messageRow(1, "hello", "2026-08-13 01:00:00")], []];
      }

      if (sql.includes("FROM text_entities e") || sql.includes("FROM message_attachments")) {
        return [[], []];
      }

      if (sql.includes("FROM message_reactions mr")) {
        return [[{
          message_id: 1,
          emoji: "✨",
          reaction_count: 2,
          reacted_by_me: 1,
          first_reaction_id: 14,
        }], []];
      }

      throw new Error(`Unexpected pre-migration chat query: ${sql}`);
    });
    const repository = createChatRepository({ execute } as unknown as Pool);

    const beforeMigration = await repository.listMessages(session(), 42);

    expect(beforeMigration.messages[0]).toMatchObject({ reactionVersion: 0, reactions: [] });

    const afterMigration = await repository.listMessages(session(), 42);

    expect(afterMigration.messages[0]).toMatchObject({
      reactionVersion: 0,
      reactions: [{ emoji: "✨", count: 2, reactedByMe: true }],
    });
    expect(reactionTableChecks).toBe(2);
    expect(calls.filter(({ sql }) => sql.includes("FROM message_reactions mr"))).toHaveLength(1);
  });

  it("serializes idempotent reaction mutations and only publishes changed versions after commit", async () => {
    const events: unknown[] = [];
    const connection = reactionConnection([
      { reactionCount: 0, matchingCount: 0, version: 4 },
      { reactionCount: 1, matchingCount: 1, version: 4 },
    ]);
    const execute = vi.fn(async (sqlValue: unknown, paramsValue: unknown[] = []) => {
      const sql = String(sqlValue);
      const params = [...paramsValue];

      if (sql.includes("information_schema.TABLES") || sql.includes("information_schema.COLUMNS")) {
        return [[{ value: 1 }], []];
      }

      if (sql.includes("FROM conversations c")) {
        return [[{ conversation_id: 42, ...accessRow({
          conversation_type: "direct",
          direct_member_user_id: 7,
        }) }], []];
      }

      throw new Error(`Unexpected reaction pool query (${params.join(",")}): ${sql}`);
    });
    const repository = createChatRepository({
      execute,
      getConnection: vi.fn().mockResolvedValue(connection),
    } as unknown as Pool);
    const unsubscribe = await repository.subscribeToConversationEvents(session(), 42, (event) => events.push(event));

    await expect(repository.addMessageReaction(session(), 91, "👍")).resolves.toMatchObject({
      changed: true,
      reaction: { emoji: "👍", reacted: true },
      reactionVersion: 4,
      reactions: [{ emoji: "👍", count: 1, reactedByMe: true }],
    });
    await vi.waitFor(() => expect(events).toHaveLength(1));
    expect(events[0]).toMatchObject({
      schemaVersion: 1,
      type: "message.reactions.updated",
      reactionVersion: 4,
      reactions: [{ emoji: "👍", count: 1 }],
    });

    await expect(repository.addMessageReaction(session(), 91, "👍")).resolves.toMatchObject({
      changed: false,
      reactionVersion: 4,
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(events).toHaveLength(1);
    expect(connection.execute.mock.calls.filter(([sql]) => String(sql).includes("UPDATE messages"))).toHaveLength(1);
    expect(connection.commit).toHaveBeenCalledTimes(2);
    unsubscribe();
  });

  it("groups reaction participants in one bounded detail query", async () => {
    const calls: string[] = [];
    const detailRows = Array.from({ length: 501 }, (_, index) => ({
      reaction_id: index + 1,
      emoji: "👍",
      reaction_count: 501,
      reacted_by_me: 1,
      total_rows: 501,
      user_id: index + 1,
      handle: `member${index + 1}`,
      display_name: `Member ${index + 1}`,
      avatar_url: null,
    }));
    const execute = vi.fn(async (sqlValue: unknown) => {
      const sql = String(sqlValue);
      calls.push(sql);

      if (sql.includes("information_schema.TABLES") || sql.includes("information_schema.COLUMNS")) {
        return [[{ value: 1 }], []];
      }

      if (sql.includes("FROM messages m")) {
        return [[{
          message_id: 91,
          message_deleted_at: null,
          reaction_version: 7,
          conversation_id: 42,
          ...accessRow({
            conversation_type: "direct",
            direct_member_user_id: 7,
          }),
        }], []];
      }

      if (sql.includes("COUNT(*) OVER (PARTITION BY mr.emoji)")) {
        return [detailRows, []];
      }

      throw new Error(`Unexpected reaction detail query: ${sql}`);
    });
    const repository = createChatRepository({ execute } as unknown as Pool);

    const payload = await repository.messageReactionDetails(session(), 91);

    expect(payload).toMatchObject({
      messageId: 91,
      conversationId: 42,
      reactionVersion: 7,
      truncated: true,
      reactions: [{ emoji: "👍", count: 501, reactedByMe: true }],
    });
    expect(payload.reactions[0]?.users).toHaveLength(500);
    expect(calls.filter((sql) => sql.includes("COUNT(*) OVER (PARTITION BY mr.emoji)"))).toHaveLength(1);
    expect(calls.find((sql) => sql.includes("COUNT(*) OVER (PARTITION BY mr.emoji)"))).toContain("LIMIT 501");
  });

  it("requires migrated storage for reaction mutations and details", async () => {
    const getConnection = vi.fn();
    const execute = vi.fn(async (sqlValue: unknown, paramsValue: unknown[] = []) => {
      const sql = String(sqlValue);

      if (sql.includes("information_schema.TABLES")) {
        return [[{ value: paramsValue[0] === "message_reactions" ? 0 : 1 }], []];
      }

      throw new Error(`Unexpected missing reaction storage query: ${sql}`);
    });
    const repository = createChatRepository({ execute, getConnection } as unknown as Pool);

    await expect(repository.addMessageReaction(session(), 91, "👍")).rejects.toThrow(
      "Message reaction storage is not ready. Run pending migrations.",
    );
    await expect(repository.messageReactionDetails(session(), 91)).rejects.toThrow(
      "Message reaction storage is not ready. Run pending migrations.",
    );
    expect(getConnection).not.toHaveBeenCalled();
  });

  it("rechecks stream authorization and detaches a viewer after access is revoked", async () => {
    let accessChecks = 0;
    const execute = vi.fn(async (sqlValue: unknown) => {
      const sql = String(sqlValue);

      if (sql.includes("FROM conversations c")) {
        accessChecks += 1;

        return accessChecks === 1
          ? [[{ conversation_id: 42, ...accessRow({
              conversation_type: "direct",
              direct_member_user_id: 7,
            }) }], []]
          : [[], []];
      }

      throw new Error(`Unexpected stream access query: ${sql}`);
    });
    const repository = createChatRepository({ execute } as unknown as Pool);
    const listener = vi.fn();

    await repository.subscribeToConversationEvents(session(), 42, listener);
    const broker = repository as unknown as {
      publishConversationEvent(event: ChatRealtimeEventPayload): void;
    };
    const event: ChatRealtimeEventPayload = {
      schemaVersion: 1,
      type: "message.reactions.updated",
      messageId: 91,
      conversationId: 42,
      actorUserId: 8,
      emoji: "👍",
      reacted: true,
      reactionVersion: 5,
      reactions: [{ emoji: "👍", count: 1 }],
    };

    broker.publishConversationEvent(event);
    await vi.waitFor(() => expect(accessChecks).toBe(2));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(listener).not.toHaveBeenCalled();

    broker.publishConversationEvent({ ...event, reactionVersion: 6 });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(accessChecks).toBe(2);
    expect(listener).not.toHaveBeenCalled();
  });

  it("enforces the per-member reaction limit and rolls the transaction back", async () => {
    const connection = reactionConnection([{ reactionCount: 20, matchingCount: 0, version: 8 }]);
    const execute = vi.fn(async (sqlValue: unknown) => {
      const sql = String(sqlValue);

      if (sql.includes("information_schema.TABLES") || sql.includes("information_schema.COLUMNS")) {
        return [[{ value: 1 }], []];
      }

      throw new Error(`Unexpected reaction limit pool query: ${sql}`);
    });
    const repository = createChatRepository({
      execute,
      getConnection: vi.fn().mockResolvedValue(connection),
    } as unknown as Pool);

    await expect(repository.addMessageReaction(session(), 91, "✨")).rejects.toThrow(
      "You can add up to 20 distinct reactions to a message.",
    );
    expect(connection.rollback).toHaveBeenCalledOnce();
    expect(connection.commit).not.toHaveBeenCalled();
  });

  it("returns a committed send even when notification delivery fails", async () => {
    const connection = notificationFailureConnection();
    const execute = vi.fn(async (sqlValue: unknown, paramsValue: unknown[] = []) => {
      const sql = String(sqlValue);
      const params = [...paramsValue];

      if (sql.includes("information_schema.TABLES")) {
        const tableName = String(params[0] ?? "");
        return [[{
          value: ["conversations", "conversation_members", "messages", "notifications"].includes(tableName) ? 1 : 0,
        }], []];
      }

      if (sql.includes("FROM conversation_members viewer_member")) {
        return [[conversationRow()], []];
      }

      if (sql.includes("SELECT user_id AS value") && sql.includes("FROM conversation_members")) {
        throw new Error("notification storage unavailable");
      }

      if (sql.includes("FROM messages m") && sql.includes("WHERE m.id = ?")) {
        return [[messageRow(99, "delivered once", "2026-07-10 05:00:00")], []];
      }

      throw new Error(`Unexpected chat query: ${sql}`);
    });
    const repository = createChatRepository({
      execute,
      getConnection: vi.fn().mockResolvedValue(connection),
    } as unknown as Pool);

    await expect(repository.createMessage(session(), 42, { body: "delivered once" })).resolves.toMatchObject({
      id: 99,
      body: "delivered once",
    });
    expect(connection.commit).toHaveBeenCalledOnce();
    expect(connection.rollback).not.toHaveBeenCalled();
    expect(connection.execute.mock.calls.filter(([sql]) => String(sql).includes("INSERT INTO messages"))).toHaveLength(1);
  });
});

function conversationRow(): Record<string, unknown> {
  return {
    id: 42,
    type: "direct",
    created_at: "2026-07-10 00:00:00",
    updated_at: "2026-07-10 03:00:00",
    last_message_at: "2026-07-10 03:00:00",
    last_read_at: null,
    muted_at: null,
    archived_at: null,
    unread_count: 0,
    other_user_id: 8,
    other_handle: "friend",
    other_display_name: "Friend",
    other_avatar_url: null,
    last_message_id: null,
    last_message_body: null,
    last_message_created_at: null,
    last_sender_user_id: null,
    last_sender_handle: null,
    last_sender_display_name: null,
    last_sender_avatar_url: null,
  };
}

function accessRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    conversation_type: "room_channel",
    direct_user_one_id: 7,
    direct_user_two_id: 8,
    room_id: 9,
    room_visibility: "public",
    room_deleted_at: null,
    room_channel_id: 17,
    channel_room_id: 9,
    channel_archived_at: null,
    direct_member_user_id: null,
    room_membership_id: null,
    room_membership_banned_at: null,
    ...overrides,
  };
}

function messageRow(
  id: number,
  body: string,
  createdAt: string,
  deletedAt: string | null = null,
  conversationId = 42,
): Record<string, unknown> {
  return {
    id,
    conversation_id: conversationId,
    sender_user_id: 7,
    body,
    deleted_at: deletedAt,
    created_at: createdAt,
    sender_handle: "thia",
    sender_display_name: "Thia",
    sender_avatar_url: null,
  };
}

function roomChannelRow(): Record<string, unknown> {
  return {
    id: 17,
    room_id: 9,
    slug: "general",
    name: "general",
    description: "Room chat",
    position: 0,
    kind: "chat",
    read_only: 0,
    archived_at: null,
    created_at: "2026-07-10 00:00:00",
    updated_at: "2026-07-10 00:00:00",
    conversation_id: 77,
    last_message_at: "2026-07-10 02:00:00",
    last_read_at: null,
    unread_count: 0,
  };
}

function attachmentRow(
  id: number,
  position: number,
  type: string,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    id,
    message_id: 1,
    position,
    type,
    post_id: null,
    room_id: null,
    url: null,
    mime: null,
    size_bytes: null,
    width: null,
    height: null,
    duration_seconds: null,
    poster_url: null,
    provider: null,
    resource_type: null,
    resource_id: null,
    resource_key: null,
    source_url: null,
    card_json: null,
    created_at: "2026-07-16 01:00:00",
    ...overrides,
  };
}

function session(): RequestSession {
  return {
    userId: 7,
    role: "member",
  } as RequestSession;
}

function reactionConnection(
  states: Array<{ reactionCount: number; matchingCount: number; version: number }>,
): PoolConnection & {
  beginTransaction: ReturnType<typeof vi.fn>;
  commit: ReturnType<typeof vi.fn>;
  rollback: ReturnType<typeof vi.fn>;
  release: ReturnType<typeof vi.fn>;
  execute: ReturnType<typeof vi.fn>;
} {
  let transactionIndex = 0;
  const connection = {
    beginTransaction: vi.fn(async () => undefined),
    commit: vi.fn(async () => {
      transactionIndex += 1;
    }),
    rollback: vi.fn(async () => undefined),
    release: vi.fn(),
    execute: vi.fn(async (sqlValue: unknown) => {
      const sql = String(sqlValue);
      const state = states[Math.min(transactionIndex, states.length - 1)] ?? {
        reactionCount: 0,
        matchingCount: 0,
        version: 0,
      };

      if (sql.includes("FROM messages m") && sql.includes("FOR UPDATE")) {
        return [[{
          message_id: 91,
          message_deleted_at: null,
          reaction_version: state.version - (state.matchingCount === 0 ? 1 : 0),
          conversation_id: 42,
          ...accessRow({
            conversation_type: "direct",
            direct_member_user_id: 7,
          }),
        }], []];
      }

      if (sql.includes("COUNT(*) AS reaction_count") && sql.includes("matching_count")) {
        return [[{
          reaction_count: state.reactionCount,
          matching_count: state.matchingCount,
        }], []];
      }

      if (sql.includes("INSERT IGNORE INTO message_reactions")) {
        return [{ affectedRows: 1, insertId: 11 }, []];
      }

      if (sql.includes("UPDATE messages")) {
        return [{ affectedRows: 1 }, []];
      }

      if (sql.includes("FROM message_reactions mr")) {
        return [[{
          message_id: 91,
          emoji: "👍",
          reaction_count: 1,
          reacted_by_me: 1,
          first_reaction_id: 11,
        }], []];
      }

      if (sql.includes("SELECT reaction_version")) {
        return [[{ reaction_version: state.version }], []];
      }

      throw new Error(`Unexpected reaction transaction query: ${sql}`);
    }),
  };

  return connection as unknown as PoolConnection & typeof connection;
}

function notificationFailureConnection(): PoolConnection & {
  beginTransaction: ReturnType<typeof vi.fn>;
  commit: ReturnType<typeof vi.fn>;
  rollback: ReturnType<typeof vi.fn>;
  release: ReturnType<typeof vi.fn>;
  execute: ReturnType<typeof vi.fn>;
} {
  const connection = {
    beginTransaction: vi.fn().mockResolvedValue(undefined),
    commit: vi.fn().mockResolvedValue(undefined),
    rollback: vi.fn().mockResolvedValue(undefined),
    release: vi.fn(),
    execute: vi.fn(async (sqlValue: unknown) => {
      const sql = String(sqlValue);

      if (sql.includes("INSERT INTO messages")) {
        return [{ insertId: 99, affectedRows: 1 }, []];
      }

      if (sql.includes("UPDATE conversations") || sql.includes("UPDATE conversation_members")) {
        return [{ affectedRows: 1 }, []];
      }

      throw new Error(`Unexpected transaction query: ${sql}`);
    }),
  };

  return connection as unknown as PoolConnection & typeof connection;
}
