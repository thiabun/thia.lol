import type { Pool, PoolConnection } from "mysql2/promise";
import { describe, expect, it, vi } from "vitest";

import {
  chronologicalMessageRows,
  conversationSelectSql,
  createChatRepository,
  latestMessageWindowSql,
  roomChatViewerCanPost,
} from "./chat.js";
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

    const payload = await repository.listMessages(7, 42);

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
    expect(payload.messages[2]).toMatchObject({
      body: "",
      bodyEntities: [],
      attachments: [],
      deletedAt: "2026-07-10 04:00:00",
    });

    const entityCalls = calls.filter(({ sql }) => sql.includes("FROM text_entities e"));
    const attachmentCalls = calls.filter(({ sql }) => sql.includes("FROM message_attachments"));
    expect(entityCalls).toHaveLength(1);
    expect(attachmentCalls).toHaveLength(1);
    expect(entityCalls[0]?.params).toEqual([1, 2]);
    expect(attachmentCalls[0]?.params).toEqual([1, 2]);
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

      if (sql.includes("FROM text_entities e") || sql.includes("FROM message_attachments")) {
        return [[], []];
      }

      throw new Error(`Unexpected room chat query: ${sql}`);
    });
    const repository = createChatRepository({ execute } as unknown as Pool);

    const payload = await repository.listRoomChannelMessages(session(), "garden", "general");

    expect(payload.messages.map((message) => message.id)).toEqual([10, 11]);
    expect(calls.filter(({ sql }) => sql.includes("FROM text_entities e"))).toHaveLength(1);
    expect(calls.filter(({ sql }) => sql.includes("FROM message_attachments"))).toHaveLength(1);
    expect(calls.find(({ sql }) => sql.includes("FROM text_entities e"))?.params).toEqual([10, 11]);
    expect(calls.find(({ sql }) => sql.includes("FROM message_attachments"))?.params).toEqual([10, 11]);
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

function session(): RequestSession {
  return {
    userId: 7,
    role: "member",
  } as RequestSession;
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
