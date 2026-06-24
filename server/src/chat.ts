import type { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";

import type { RequestSession } from "./sessions.js";

export class ChatRouteError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
  ) {
    super(message);
    this.name = "ChatRouteError";
  }
}

export class ChatStorageNotReadyError extends Error {
  constructor(message = "Chat storage is not ready. Run pending migrations.") {
    super(message);
    this.name = "ChatStorageNotReadyError";
  }
}

export interface ChatUserPayload {
  id: number;
  handle: string;
  displayName: string;
  initials: string;
  aura: "frost";
  avatarUrl: string | null;
}

export interface ChatConversationPayload {
  id: number;
  type: string;
  createdAt: string | null;
  updatedAt: string | null;
  lastMessageAt: string | null;
  lastReadAt: string | null;
  mutedAt: string | null;
  archivedAt: string | null;
  unreadCount: number;
  otherParticipant: ChatUserPayload;
  lastMessage: {
    id: number;
    body: string;
    createdAt: string | null;
    sender: ChatUserPayload;
  } | null;
}

export interface ChatMessagePayload {
  id: number;
  conversationId: number;
  body: string;
  bodyEntities: TextEntityPayload[];
  attachments: ChatMessageAttachmentPayload[];
  deletedAt: string | null;
  createdAt: string | null;
  sender: ChatUserPayload;
}

export interface ChatMessagesPayload {
  conversation: ChatConversationPayload;
  messages: ChatMessagePayload[];
}

export interface ChatReadPayload {
  conversationId: number;
  readAt: string;
}

export interface ChatMessageAttachmentPayload {
  type: "post";
  post: PostShareSummaryPayload | null;
}

interface PostShareSummaryPayload {
  id: number;
  publicId: string;
  canonicalPath: string;
  canonicalUrl: string;
  bodySnippet: string;
  createdAt: string | null;
  mediaUrl: string | null;
  author: ChatUserPayload;
  room: {
    id: number;
    slug: string;
    name: string;
  } | null;
}

interface TextEntityPayload {
  type: string;
  start: number;
  length: number;
  text: string;
  mention?: {
    handle: string;
    user: ChatUserPayload;
  };
  link?: {
    url: string;
    card?: unknown;
  };
}

export interface ChatRepository {
  listConversations(userId: number): Promise<ChatConversationPayload[]>;
  listMoots(userId: number): Promise<ChatUserPayload[]>;
  createConversation(session: RequestSession, body: Record<string, unknown>): Promise<ChatConversationPayload>;
  listMessages(userId: number, conversationId: number): Promise<ChatMessagesPayload>;
  createMessage(session: RequestSession, conversationId: number, body: Record<string, unknown>): Promise<ChatMessagePayload>;
  markConversationRead(userId: number, conversationId: number): Promise<ChatReadPayload>;
}

interface ConversationRow extends RowDataPacket {
  id: number | string;
  type: string | null;
  created_at: string | null;
  updated_at: string | null;
  last_message_at: string | null;
  last_read_at: string | null;
  muted_at: string | null;
  archived_at: string | null;
  unread_count: number | string | null;
  other_user_id: number | string | null;
  other_handle: string | null;
  other_display_name: string | null;
  other_avatar_url: string | null;
  last_message_id: number | string | null;
  last_message_body: string | null;
  last_message_created_at: string | null;
  last_sender_user_id: number | string | null;
  last_sender_handle: string | null;
  last_sender_display_name: string | null;
  last_sender_avatar_url: string | null;
}

interface MessageRow extends RowDataPacket {
  id: number | string;
  conversation_id: number | string;
  sender_user_id: number | string;
  body: string | null;
  deleted_at: string | null;
  created_at: string | null;
  sender_handle: string | null;
  sender_display_name: string | null;
  sender_avatar_url: string | null;
}

interface UserRow extends RowDataPacket {
  user_id: number | string;
  handle: string | null;
  display_name: string | null;
  avatar_url: string | null;
  user_status?: string | null;
}

interface IdRow extends RowDataPacket {
  id: number | string;
}

interface CountRow extends RowDataPacket {
  value: number | string;
}

interface BlockStateRow extends RowDataPacket {
  viewer_blocks_target: number | string | null;
  target_blocks_viewer: number | string | null;
}

interface MootStateRow extends RowDataPacket {
  first_follows_second: number | string | null;
  second_follows_first: number | string | null;
}

interface TextEntityRow extends RowDataPacket {
  entity_type: string | null;
  entity_start: number | string | null;
  entity_length: number | string | null;
  text_value: string | null;
  url: string | null;
  card_json: string | null;
  target_user_id: number | string | null;
  target_handle: string | null;
  target_display_name: string | null;
  target_avatar_url: string | null;
}

interface AttachmentRow extends RowDataPacket {
  type: string | null;
  post_id: number | string | null;
}

interface PostSummaryRow extends RowDataPacket {
  post_id: number | string;
  post_public_id: string | null;
  body: string | null;
  media_url: string | null;
  created_at: string | null;
  author_user_id: number | string;
  author_handle: string | null;
  author_display_name: string | null;
  author_avatar_url: string | null;
  room_id: number | string | null;
  room_slug: string | null;
  room_name: string | null;
}

interface NotificationPreferenceRow extends RowDataPacket {
  notification_preferences_json: string | null;
}

export function createChatRepository(pool: Pool, publicBaseUrl = "https://thia.lol"): ChatRepository {
  return new MariaDbChatRepository(pool, publicBaseUrl);
}

class MariaDbChatRepository implements ChatRepository {
  private tableCache = new Map<string, Promise<boolean>>();

  constructor(
    private readonly pool: Pool,
    private readonly publicBaseUrl: string,
  ) {}

  async listConversations(userId: number): Promise<ChatConversationPayload[]> {
    await this.requireChatTables();
    const [rows] = await this.pool.execute<ConversationRow[]>(
      `${conversationSelectSql()}
       ORDER BY COALESCE(c.last_message_at, c.created_at) DESC, c.id DESC
       LIMIT 100`,
      [userId, userId],
    );

    return rows.map(conversationPayloadFromRow);
  }

  async listMoots(userId: number): Promise<ChatUserPayload[]> {
    await this.requireChatTables();
    await this.requireFollowsTable();
    const blockFilter = await this.hasTable("user_blocks") ? blockedPairFilterSql("u.id") : "";
    const [rows] = await this.pool.execute<UserRow[]>(
      `SELECT
          u.id AS user_id,
          u.handle,
          p.display_name,
          p.avatar_url
       FROM user_follows mine
       INNER JOIN user_follows reciprocal
          ON reciprocal.follower_id = mine.following_id
         AND reciprocal.following_id = mine.follower_id
       INNER JOIN users u ON u.id = mine.following_id
       INNER JOIN profiles p ON p.user_id = u.id
       WHERE mine.follower_id = ?
         AND u.status = 'active'
         ${blockFilter}
       ORDER BY p.display_name ASC, u.handle ASC
       LIMIT 100`,
      [userId],
    );

    return rows.map(userPayloadFromRow);
  }

  async createConversation(session: RequestSession, body: Record<string, unknown>): Promise<ChatConversationPayload> {
    await this.requireChatTables();
    await this.requireFollowsTable();
    const target = await this.targetUserFromBody(body);

    if (target.id === session.userId) {
      throw new ChatRouteError("Choose another member to message.", 422);
    }

    await this.rejectBlockedChat(session.userId, target.id);

    if (!(await this.usersAreMoots(session.userId, target.id))) {
      throw new ChatRouteError("Follow each other to chat.", 403);
    }

    const conversationId = await this.findOrCreateDirectConversation(session.userId, target.id);

    return this.conversationForUser(conversationId, session.userId);
  }

  async listMessages(userId: number, conversationId: number): Promise<ChatMessagesPayload> {
    await this.requireChatTables();
    const conversation = await this.conversationForUser(conversationId, userId);
    const [rows] = await this.pool.execute<MessageRow[]>(
      `SELECT
          m.id,
          m.conversation_id,
          m.sender_id AS sender_user_id,
          m.body,
          m.deleted_at,
          m.created_at,
          sender.handle AS sender_handle,
          sender_profile.display_name AS sender_display_name,
          sender_profile.avatar_url AS sender_avatar_url
       FROM messages m
       INNER JOIN users sender ON sender.id = m.sender_id
       INNER JOIN profiles sender_profile ON sender_profile.user_id = sender.id
       WHERE m.conversation_id = ?
       ORDER BY m.created_at ASC, m.id ASC
       LIMIT 100`,
      [conversationId],
    );

    return {
      conversation,
      messages: await Promise.all(rows.map((row) => this.messagePayloadFromRow(row))),
    };
  }

  async createMessage(session: RequestSession, conversationId: number, body: Record<string, unknown>): Promise<ChatMessagePayload> {
    await this.requireChatTables();
    const conversation = await this.conversationForUser(conversationId, session.userId);

    await this.rejectBlockedChat(session.userId, conversation.otherParticipant.id);

    const messageBody = chatMessageBody(body);
    const messageId = await this.insertMessage(conversationId, session.userId, messageBody);

    await this.notifyConversationRecipients(conversationId, session.userId, messageId);

    return this.messageById(messageId);
  }

  async markConversationRead(userId: number, conversationId: number): Promise<ChatReadPayload> {
    await this.requireChatTables();
    await this.conversationForUser(conversationId, userId);
    const readAt = await this.currentDatabaseTimestamp();

    await this.pool.execute<ResultSetHeader>(
      `UPDATE conversation_members
       SET last_read_at = ?
       WHERE conversation_id = ?
         AND user_id = ?`,
      [readAt, conversationId, userId],
    );

    return {
      conversationId,
      readAt,
    };
  }

  private async targetUserFromBody(body: Record<string, unknown>): Promise<{ id: number }> {
    let targetUserId: number | null = null;

    if (body.targetUserId !== undefined) {
      targetUserId = positiveInteger(body.targetUserId, "Target user id");
    }

    let targetHandle: string | null = null;

    for (const key of ["targetHandle", "handle"]) {
      const value = body[key];

      if (typeof value === "string" && value.trim() !== "") {
        targetHandle = normalizeHandle(value);
        break;
      }
    }

    if (targetUserId === null && targetHandle === null) {
      throw new ChatRouteError("Choose someone to message.", 422);
    }

    const params = targetUserId === null ? [targetHandle] : [targetUserId];
    const [rows] = await this.pool.execute<UserRow[]>(
      `SELECT
          u.id AS user_id,
          u.handle,
          u.status AS user_status,
          p.display_name,
          p.avatar_url
       FROM users u
       INNER JOIN profiles p ON p.user_id = u.id
       WHERE ${targetUserId === null ? "u.handle = ?" : "u.id = ?"}
       LIMIT 1`,
      params,
    );
    const row = rows[0];

    if (row === undefined || stringValue(row.user_status, "active") !== "active") {
      throw new ChatRouteError("Profile not found.", 404);
    }

    return { id: numberValue(row.user_id) };
  }

  private async conversationForUser(conversationId: number, viewerUserId: number): Promise<ChatConversationPayload> {
    const [rows] = await this.pool.execute<ConversationRow[]>(`${conversationSelectSql()} AND c.id = ? LIMIT 1`, [
      viewerUserId,
      viewerUserId,
      conversationId,
    ]);
    const row = rows[0];

    if (row === undefined) {
      throw new ChatRouteError("Conversation not found.", 404);
    }

    return conversationPayloadFromRow(row);
  }

  private async messageById(messageId: number): Promise<ChatMessagePayload> {
    const [rows] = await this.pool.execute<MessageRow[]>(
      `SELECT
          m.id,
          m.conversation_id,
          m.sender_id AS sender_user_id,
          m.body,
          m.deleted_at,
          m.created_at,
          sender.handle AS sender_handle,
          sender_profile.display_name AS sender_display_name,
          sender_profile.avatar_url AS sender_avatar_url
       FROM messages m
       INNER JOIN users sender ON sender.id = m.sender_id
       INNER JOIN profiles sender_profile ON sender_profile.user_id = sender.id
       WHERE m.id = ?
       LIMIT 1`,
      [messageId],
    );
    const row = rows[0];

    if (row === undefined) {
      throw new ChatRouteError("Message not found.", 404);
    }

    return this.messagePayloadFromRow(row);
  }

  private async messagePayloadFromRow(row: MessageRow): Promise<ChatMessagePayload> {
    const deleted = row.deleted_at !== null;
    const messageId = numberValue(row.id);

    return {
      id: messageId,
      conversationId: numberValue(row.conversation_id),
      body: deleted ? "" : stringValue(row.body),
      bodyEntities: deleted ? [] : await this.textEntitiesForMessage(messageId),
      attachments: deleted ? [] : await this.messageAttachments(messageId),
      deletedAt: nullableStringValue(row.deleted_at),
      createdAt: nullableStringValue(row.created_at),
      sender: userPayloadFromParts(row.sender_user_id, row.sender_handle, row.sender_display_name, row.sender_avatar_url),
    };
  }

  private async insertMessage(conversationId: number, senderUserId: number, body: string): Promise<number> {
    return this.withTransaction(async (connection) => {
      const [messageResult] = await connection.execute<ResultSetHeader>(
        `INSERT INTO messages (conversation_id, sender_id, body)
         VALUES (?, ?, ?)`,
        [conversationId, senderUserId, body],
      );
      const messageId = messageResult.insertId;

      await connection.execute<ResultSetHeader>(
        `UPDATE conversations
         SET last_message_at = CURRENT_TIMESTAMP(),
             updated_at = CURRENT_TIMESTAMP()
         WHERE id = ?`,
        [conversationId],
      );
      await connection.execute<ResultSetHeader>(
        `UPDATE conversation_members
         SET last_read_at = CURRENT_TIMESTAMP()
         WHERE conversation_id = ?
           AND user_id = ?`,
        [conversationId, senderUserId],
      );

      return messageId;
    });
  }

  private async findOrCreateDirectConversation(viewerUserId: number, targetUserId: number): Promise<number> {
    return this.withTransaction(async (connection) => {
      const [firstUserId, secondUserId] =
        viewerUserId < targetUserId ? [viewerUserId, targetUserId] : [targetUserId, viewerUserId];

      await connection.execute<ResultSetHeader>(
        `INSERT IGNORE INTO conversations (type, direct_user_one_id, direct_user_two_id)
         VALUES ('direct', ?, ?)`,
        [firstUserId, secondUserId],
      );
      const [rows] = await connection.execute<IdRow[]>(
        `SELECT id
         FROM conversations
         WHERE type = 'direct'
           AND direct_user_one_id = ?
           AND direct_user_two_id = ?
         LIMIT 1`,
        [firstUserId, secondUserId],
      );
      const row = rows[0];

      if (row === undefined) {
        throw new ChatStorageNotReadyError();
      }

      const conversationId = numberValue(row.id);

      await connection.execute<ResultSetHeader>(
        `INSERT IGNORE INTO conversation_members (conversation_id, user_id)
         VALUES (?, ?), (?, ?)`,
        [conversationId, firstUserId, conversationId, secondUserId],
      );

      return conversationId;
    });
  }

  private async notifyConversationRecipients(conversationId: number, senderUserId: number, messageId: number): Promise<void> {
    if (!(await this.hasTable("notifications"))) {
      return;
    }

    const [rows] = await this.pool.execute<CountRow[]>(
      `SELECT user_id AS value
       FROM conversation_members
       WHERE conversation_id = ?
         AND user_id <> ?`,
      [conversationId, senderUserId],
    );

    for (const row of rows) {
      const recipientId = numberValue(row.value);

      if (await this.notificationUserAllowsType(recipientId, "message")) {
        await this.pool.execute<ResultSetHeader>(
          `INSERT INTO notifications (user_id, actor_id, type, post_id, room_id, data)
           VALUES (?, ?, 'message', NULL, NULL, ?)`,
          [recipientId, senderUserId, JSON.stringify({ conversationId, messageId })],
        );
      }
    }
  }

  private async notificationUserAllowsType(userId: number, type: string): Promise<boolean> {
    if (!(await this.hasTable("user_preferences"))) {
      return true;
    }

    const [rows] = await this.pool.execute<NotificationPreferenceRow[]>(
      `SELECT notification_preferences_json
       FROM user_preferences
       WHERE user_id = ?
       LIMIT 1`,
      [userId],
    );
    const raw = rows[0]?.notification_preferences_json;

    if (raw === null || raw === undefined || raw === "") {
      return true;
    }

    const parsed = jsonObject(raw);
    const value = parsed?.[type === "message" ? "messages" : type];

    return value === undefined || Boolean(value);
  }

  private async messageAttachments(messageId: number): Promise<ChatMessageAttachmentPayload[]> {
    if (!(await this.hasTable("message_attachments"))) {
      return [];
    }

    const [rows] = await this.pool.execute<AttachmentRow[]>(
      `SELECT type, post_id
       FROM message_attachments
       WHERE message_id = ?
       ORDER BY id ASC
       LIMIT 10`,
      [messageId],
    );
    const attachments: ChatMessageAttachmentPayload[] = [];

    for (const row of rows) {
      if (row.type !== "post") {
        continue;
      }

      const postId = nullableNumberValue(row.post_id);

      if (postId === null) {
        continue;
      }

      attachments.push({
        type: "post",
        post: await this.publicPostSummary(postId),
      });
    }

    return attachments;
  }

  private async publicPostSummary(postId: number): Promise<PostShareSummaryPayload | null> {
    const publicIdSelect = await this.hasColumn("posts", "public_id") ? "p.public_id AS post_public_id" : "NULL AS post_public_id";
    const roomDeletedFilter = await this.hasColumn("rooms", "deleted_at") ? "AND r.deleted_at IS NULL" : "";
    const [rows] = await this.pool.execute<PostSummaryRow[]>(
      `SELECT
          p.id AS post_id,
          ${publicIdSelect},
          p.body,
          p.media_url,
          p.created_at,
          author.id AS author_user_id,
          author.handle AS author_handle,
          author_profile.display_name AS author_display_name,
          author_profile.avatar_url AS author_avatar_url,
          r.id AS room_id,
          r.slug AS room_slug,
          r.name AS room_name
       FROM posts p
       INNER JOIN users author ON author.id = p.author_id
       INNER JOIN profiles author_profile ON author_profile.user_id = author.id
       LEFT JOIN rooms r ON r.id = p.room_id
       WHERE p.id = ?
         AND p.visibility = 'public'
         AND p.status = 'published'
         AND p.deleted_at IS NULL
         AND author.status = 'active'
         AND (p.room_id IS NULL OR (r.visibility = 'public' ${roomDeletedFilter}))
       LIMIT 1`,
      [postId],
    );
    const row = rows[0];

    if (row === undefined) {
      return null;
    }

    const publicId = stringValue(row.post_public_id, String(numberValue(row.post_id)));
    const author = userPayloadFromParts(row.author_user_id, row.author_handle, row.author_display_name, row.author_avatar_url);
    const canonicalPath = `/@${encodeURIComponent(author.handle)}/posts/${encodeURIComponent(publicId)}`;

    return {
      id: numberValue(row.post_id),
      publicId,
      canonicalPath,
      canonicalUrl: `${this.publicBaseUrl.replace(/\/+$/u, "")}${canonicalPath}`,
      bodySnippet: bodySnippet(stringValue(row.body), 160),
      createdAt: nullableStringValue(row.created_at),
      mediaUrl: nullableStringValue(row.media_url),
      author,
      room: row.room_id === null
        ? null
        : {
            id: numberValue(row.room_id),
            slug: stringValue(row.room_slug),
            name: stringValue(row.room_name),
          },
    };
  }

  private async textEntitiesForMessage(messageId: number): Promise<TextEntityPayload[]> {
    if (!(await this.hasTable("text_entities"))) {
      return [];
    }

    const [rows] = await this.pool.execute<TextEntityRow[]>(
      `SELECT
          e.entity_type,
          e.entity_start,
          e.entity_length,
          e.text_value,
          e.url,
          e.card_json,
          target_user.id AS target_user_id,
          target_user.handle AS target_handle,
          target_profile.display_name AS target_display_name,
          target_profile.avatar_url AS target_avatar_url
       FROM text_entities e
       LEFT JOIN users target_user ON target_user.id = e.target_user_id
       LEFT JOIN profiles target_profile ON target_profile.user_id = target_user.id
       WHERE e.content_type = 'message'
         AND e.content_id = ?
         AND e.field_name = 'body'
       ORDER BY e.entity_start ASC, e.id ASC`,
      [messageId],
    );

    return rows.map(textEntityPayloadFromRow).filter((entity): entity is TextEntityPayload => entity !== null);
  }

  private async rejectBlockedChat(viewerUserId: number, targetUserId: number): Promise<void> {
    const state = await this.userPairBlockState(viewerUserId, targetUserId);

    if (state.viewerBlocksTarget) {
      throw new ChatRouteError("Unblock this member before messaging.", 409);
    }

    if (state.targetBlocksViewer) {
      throw new ChatRouteError("You cannot message this member.", 403);
    }
  }

  private async userPairBlockState(viewerUserId: number, targetUserId: number): Promise<{ viewerBlocksTarget: boolean; targetBlocksViewer: boolean }> {
    if (!(await this.hasTable("user_blocks"))) {
      return {
        viewerBlocksTarget: false,
        targetBlocksViewer: false,
      };
    }

    const [rows] = await this.pool.execute<BlockStateRow[]>(
      `SELECT
          EXISTS (
            SELECT 1
            FROM user_blocks
            WHERE blocker_id = ?
              AND blocked_id = ?
          ) AS viewer_blocks_target,
          EXISTS (
            SELECT 1
            FROM user_blocks
            WHERE blocker_id = ?
              AND blocked_id = ?
          ) AS target_blocks_viewer`,
      [viewerUserId, targetUserId, targetUserId, viewerUserId],
    );
    const row = rows[0];

    return {
      viewerBlocksTarget: Boolean(row?.viewer_blocks_target),
      targetBlocksViewer: Boolean(row?.target_blocks_viewer),
    };
  }

  private async usersAreMoots(firstUserId: number, secondUserId: number): Promise<boolean> {
    const [rows] = await this.pool.execute<MootStateRow[]>(
      `SELECT
          EXISTS (
            SELECT 1
            FROM user_follows
            WHERE follower_id = ?
              AND following_id = ?
          ) AS first_follows_second,
          EXISTS (
            SELECT 1
            FROM user_follows
            WHERE follower_id = ?
              AND following_id = ?
          ) AS second_follows_first`,
      [firstUserId, secondUserId, secondUserId, firstUserId],
    );
    const row = rows[0];

    return Boolean(row?.first_follows_second) && Boolean(row?.second_follows_first);
  }

  private async requireChatTables(): Promise<void> {
    if (!(await this.hasTable("conversations")) || !(await this.hasTable("conversation_members")) || !(await this.hasTable("messages"))) {
      throw new ChatStorageNotReadyError();
    }
  }

  private async requireFollowsTable(): Promise<void> {
    if (!(await this.hasTable("user_follows"))) {
      throw new ChatStorageNotReadyError("Follow storage is not ready. Run pending migrations.");
    }
  }

  private async currentDatabaseTimestamp(): Promise<string> {
    const [rows] = await this.pool.execute<Array<RowDataPacket & { now_value: string }>>(`SELECT UTC_TIMESTAMP() AS now_value`);

    return String(rows[0]?.now_value ?? new Date().toISOString().slice(0, 19).replace("T", " "));
  }

  private async hasTable(tableName: string): Promise<boolean> {
    let cached = this.tableCache.get(tableName);

    if (cached === undefined) {
      cached = this.tableExists(tableName);
      this.tableCache.set(tableName, cached);
    }

    return cached;
  }

  private async tableExists(tableName: string): Promise<boolean> {
    const [rows] = await this.pool.execute<CountRow[]>(
      `SELECT COUNT(*) AS value
       FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = ?`,
      [tableName],
    );

    return numberValue(rows[0]?.value ?? 0) > 0;
  }

  private async hasColumn(tableName: string, columnName: string): Promise<boolean> {
    const [rows] = await this.pool.execute<CountRow[]>(
      `SELECT COUNT(*) AS value
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = ?
         AND COLUMN_NAME = ?`,
      [tableName, columnName],
    );

    return numberValue(rows[0]?.value ?? 0) > 0;
  }

  private async withTransaction<T>(callback: (connection: PoolConnection) => Promise<T>): Promise<T> {
    const connection = await this.pool.getConnection();

    try {
      await connection.beginTransaction();
      const result = await callback(connection);
      await connection.commit();

      return result;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
}

function conversationSelectSql(): string {
  return `SELECT
      c.id,
      c.type,
      c.created_at,
      c.updated_at,
      c.last_message_at,
      viewer_member.last_read_at,
      viewer_member.muted_at,
      viewer_member.archived_at,
      other_user.id AS other_user_id,
      other_user.handle AS other_handle,
      other_profile.display_name AS other_display_name,
      other_profile.avatar_url AS other_avatar_url,
      last_message.id AS last_message_id,
      last_message.body AS last_message_body,
      last_message.created_at AS last_message_created_at,
      last_sender.id AS last_sender_user_id,
      last_sender.handle AS last_sender_handle,
      last_sender_profile.display_name AS last_sender_display_name,
      last_sender_profile.avatar_url AS last_sender_avatar_url,
      (
        SELECT COUNT(*)
        FROM messages unread_messages
        WHERE unread_messages.conversation_id = c.id
          AND unread_messages.sender_id <> ?
          AND unread_messages.deleted_at IS NULL
          AND (
            viewer_member.last_read_at IS NULL
            OR unread_messages.created_at > viewer_member.last_read_at
          )
      ) AS unread_count
    FROM conversation_members viewer_member
    INNER JOIN conversations c ON c.id = viewer_member.conversation_id
    INNER JOIN conversation_members other_member
      ON other_member.conversation_id = c.id
     AND other_member.user_id <> viewer_member.user_id
    INNER JOIN users other_user ON other_user.id = other_member.user_id
    INNER JOIN profiles other_profile ON other_profile.user_id = other_user.id
    LEFT JOIN messages last_message
      ON last_message.id = (
        SELECT newest_message.id
        FROM messages newest_message
        WHERE newest_message.conversation_id = c.id
          AND newest_message.deleted_at IS NULL
        ORDER BY newest_message.created_at DESC, newest_message.id DESC
        LIMIT 1
      )
    LEFT JOIN users last_sender ON last_sender.id = last_message.sender_id
    LEFT JOIN profiles last_sender_profile ON last_sender_profile.user_id = last_sender.id
    WHERE viewer_member.user_id = ?
      AND c.type = 'direct'
      AND other_user.status = 'active'`;
}

function conversationPayloadFromRow(row: ConversationRow): ChatConversationPayload {
  const lastMessage = row.last_message_id === null
    ? null
    : {
        id: numberValue(row.last_message_id),
        body: stringValue(row.last_message_body),
        createdAt: nullableStringValue(row.last_message_created_at),
        sender: userPayloadFromParts(
          row.last_sender_user_id,
          row.last_sender_handle,
          row.last_sender_display_name,
          row.last_sender_avatar_url,
        ),
      };

  return {
    id: numberValue(row.id),
    type: stringValue(row.type),
    createdAt: nullableStringValue(row.created_at),
    updatedAt: nullableStringValue(row.updated_at),
    lastMessageAt: nullableStringValue(row.last_message_at),
    lastReadAt: nullableStringValue(row.last_read_at),
    mutedAt: nullableStringValue(row.muted_at),
    archivedAt: nullableStringValue(row.archived_at),
    unreadCount: numberValue(row.unread_count ?? 0),
    otherParticipant: userPayloadFromParts(row.other_user_id, row.other_handle, row.other_display_name, row.other_avatar_url),
    lastMessage,
  };
}

function userPayloadFromRow(row: UserRow): ChatUserPayload {
  return userPayloadFromParts(row.user_id, row.handle, row.display_name, row.avatar_url);
}

function userPayloadFromParts(
  id: number | string | null | undefined,
  handleValue: string | null | undefined,
  displayNameValue: string | null | undefined,
  avatarUrlValue: string | null | undefined,
): ChatUserPayload {
  const handle = stringValue(handleValue);
  const displayName = stringValue(displayNameValue, handle);

  return {
    id: numberValue(id ?? 0),
    handle,
    displayName,
    initials: initialsFromName(displayName),
    aura: "frost",
    avatarUrl: nullableStringValue(avatarUrlValue),
  };
}

function textEntityPayloadFromRow(row: TextEntityRow): TextEntityPayload | null {
  const type = stringValue(row.entity_type);
  const payload: TextEntityPayload = {
    type,
    start: numberValue(row.entity_start ?? 0),
    length: numberValue(row.entity_length ?? 0),
    text: stringValue(row.text_value),
  };

  if (type === "mention") {
    if (row.target_user_id === null || row.target_handle === null) {
      return null;
    }

    const handle = stringValue(row.target_handle);
    payload.mention = {
      handle,
      user: userPayloadFromParts(row.target_user_id, handle, row.target_display_name, row.target_avatar_url),
    };
  }

  if (type === "link") {
    if (row.url === null) {
      return null;
    }

    payload.link = {
      url: row.url,
    };

    const card = jsonObjectOrArray(row.card_json);

    if (card !== null) {
      payload.link.card = card;
    }
  }

  return payload;
}

function chatMessageBody(body: Record<string, unknown>): string {
  if (typeof body.body !== "string") {
    throw new ChatRouteError("Message body is required.", 422);
  }

  const value = body.body.trim();

  if (value === "") {
    throw new ChatRouteError("Message body is required.", 422);
  }

  if (value.length > 2000) {
    throw new ChatRouteError("Message body must be 2000 characters or fewer.", 422);
  }

  return value;
}

function positiveInteger(value: unknown, label: string): number {
  if (typeof value !== "number" && !(typeof value === "string" && /^[0-9]+$/u.test(value))) {
    throw new ChatRouteError(`${label} must be numeric.`, 422);
  }

  const number = Number(value);

  if (!Number.isSafeInteger(number) || number < 1) {
    throw new ChatRouteError(`${label} must be numeric.`, 422);
  }

  return number;
}

function normalizeHandle(value: string): string {
  return value.trim().replace(/^@/u, "").toLowerCase();
}

function blockedPairFilterSql(targetUserSql: string): string {
  return `AND NOT EXISTS (
      SELECT 1
      FROM user_blocks chat_pair_blocks
      WHERE (chat_pair_blocks.blocker_id = mine.follower_id AND chat_pair_blocks.blocked_id = ${targetUserSql})
         OR (chat_pair_blocks.blocker_id = ${targetUserSql} AND chat_pair_blocks.blocked_id = mine.follower_id)
    )`;
}

function stringValue(value: string | number | null | undefined, fallback = ""): string {
  if (value === null || value === undefined) {
    return fallback;
  }

  return String(value);
}

function nullableStringValue(value: string | null | undefined): string | null {
  return value === undefined ? null : value;
}

function numberValue(value: string | number): number {
  const number = Number(value);

  return Number.isFinite(number) ? number : 0;
}

function nullableNumberValue(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  const number = Number(value);

  return Number.isFinite(number) ? number : null;
}

function initialsFromName(name: string): string {
  const letters = name
    .trim()
    .split(/\s+/u)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .filter(Boolean)
    .slice(0, 2);

  return letters.length > 0 ? letters.join("") : "TH";
}

function bodySnippet(value: string, maxLength: number): string {
  const snippet = value.replace(/\s+/gu, " ").trim();

  if (snippet.length <= maxLength) {
    return snippet;
  }

  return `${snippet.slice(0, Math.max(1, maxLength - 1)).trimEnd()}...`;
}

function jsonObject(value: string): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(value);

    return parsed !== null && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

function jsonObjectOrArray(value: string | null): unknown | null {
  if (value === null || value === "") {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(value);

    return parsed !== null && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}
