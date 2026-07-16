import type { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";

import { chatLinkEntities, nativeChatLinks, removeNativeChatLinks, type NativeChatLink } from "./chatLinks.js";
import { ContentRouteError, validatePostAttachments, type ValidatedPostAttachment } from "./content.js";
import { createPostsRepository, type PostDetailPayload, type PostsRepository } from "./posts.js";
import type { PostAttachmentPayload } from "./profiles.js";
import { createRoomsRepository, type RoomPayload, type RoomsRepository } from "./rooms.js";
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
    previewText: string;
    createdAt: string | null;
    sender: ChatUserPayload;
  } | null;
}

export interface RoomChannelPayload {
  id: number;
  roomId: number;
  slug: string;
  name: string;
  description: string | null;
  position: number;
  kind: "chat" | "announcement";
  readOnly: boolean;
  archivedAt: string | null;
  conversationId: number;
  unreadCount: number;
  lastMessageAt: string | null;
  viewerCanPost: boolean;
  createdAt: string | null;
  updatedAt: string | null;
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

export interface RoomChannelMessagesPayload {
  channel: RoomChannelPayload;
  messages: ChatMessagePayload[];
}

export interface ChatReadPayload {
  conversationId: number;
  readAt: string;
}

export type ChatMessageAttachmentPayload = {
  type: "post";
  post: PostDetailPayload | null;
} | {
  type: "room";
  room: ChatRoomAttachmentPayload | null;
} | {
  type: "media";
  media: PostAttachmentPayload;
} | {
  type: "gif";
  gif: GifAttachmentPayload;
};

export interface ChatRoomAttachmentPayload extends RoomPayload {
  canonicalPath: string;
  canonicalUrl: string;
}

export interface GifAttachmentPayload {
  provider: "klipy";
  resourceType: "gif";
  resourceId: string;
  resourceKey: string;
  url: string;
  mime: "image/gif";
  width: number | null;
  height: number | null;
  sourceUrl: string | null;
  card: unknown | null;
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
  listMessages(session: RequestSession, conversationId: number): Promise<ChatMessagesPayload>;
  createMessage(session: RequestSession, conversationId: number, body: Record<string, unknown>): Promise<ChatMessagePayload>;
  markConversationRead(userId: number, conversationId: number): Promise<ChatReadPayload>;
  listRoomChannels(session: RequestSession, slug: string): Promise<RoomChannelPayload[]>;
  createRoomChannel(session: RequestSession, slug: string, body: Record<string, unknown>): Promise<RoomChannelPayload>;
  updateRoomChannel(session: RequestSession, slug: string, channelSlug: string, body: Record<string, unknown>): Promise<RoomChannelPayload>;
  listRoomChannelMessages(session: RequestSession, slug: string, channelSlug: string): Promise<RoomChannelMessagesPayload>;
  createRoomChannelMessage(session: RequestSession, slug: string, channelSlug: string, body: Record<string, unknown>): Promise<ChatMessagePayload>;
  markRoomChannelRead(session: RequestSession, slug: string, channelSlug: string): Promise<ChatReadPayload>;
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
  message_id: number | string;
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
  id: number | string;
  message_id: number | string;
  position: number | string | null;
  type: string | null;
  post_id: number | string | null;
  room_id: number | string | null;
  url: string | null;
  mime: string | null;
  size_bytes: number | string | null;
  width: number | string | null;
  height: number | string | null;
  duration_seconds: number | string | null;
  poster_url: string | null;
  provider: string | null;
  resource_type: string | null;
  resource_id: string | null;
  resource_key: string | null;
  source_url: string | null;
  card_json: string | null;
  created_at: string | null;
}

interface RoomRecordRow extends RowDataPacket {
  id: number | string;
  slug: string;
  name: string;
  visibility: string | null;
  created_by: number | string | null;
}

interface RoomMembershipRow extends RowDataPacket {
  id: number | string;
  role: string | null;
  banned_at: string | null;
}

interface RoomChannelRow extends RowDataPacket {
  id: number | string;
  room_id: number | string;
  slug: string;
  name: string;
  description: string | null;
  position: number | string;
  kind: string | null;
  read_only: number | string | boolean | null;
  archived_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  conversation_id: number | string | null;
  last_message_at: string | null;
  last_read_at: string | null;
  unread_count: number | string | null;
}

interface NotificationPreferenceRow extends RowDataPacket {
  notification_preferences_json: string | null;
}

type ConversationNotificationContext =
  | { kind: "direct" }
  | {
      kind: "room";
      roomId: number;
      roomSlug: string;
      channelSlug: string;
    };

export interface ChatRepositoryOptions {
  postsRepository?: PostsRepository;
  roomsRepository?: RoomsRepository;
}

export function createChatRepository(
  pool: Pool,
  publicBaseUrl = "https://thia.lol",
  options: ChatRepositoryOptions = {},
): ChatRepository {
  return new MariaDbChatRepository(
    pool,
    publicBaseUrl,
    options.postsRepository ?? createPostsRepository(pool),
    options.roomsRepository ?? createRoomsRepository(pool),
  );
}

class MariaDbChatRepository implements ChatRepository {
  private tableCache = new Map<string, Promise<boolean>>();

  constructor(
    private readonly pool: Pool,
    private readonly publicBaseUrl: string,
    private readonly postsRepository: PostsRepository,
    private readonly roomsRepository: RoomsRepository,
  ) {}

  async listConversations(userId: number): Promise<ChatConversationPayload[]> {
    await this.requireChatTables();
    const [rows] = await this.pool.execute<ConversationRow[]>(
      `${conversationSelectSql()}
       ORDER BY COALESCE(c.last_message_at, c.created_at) DESC, c.id DESC
       LIMIT 100`,
      [userId, userId],
    );

    const previews = await this.attachmentPreviewsForMessages(
      rows.map((row) => nullableNumberValue(row.last_message_id)).filter((id): id is number => id !== null),
    );

    return rows.map((row) =>
      conversationPayloadFromRow(row, previews, this.publicBaseUrl),
    );
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

  async listMessages(session: RequestSession, conversationId: number): Promise<ChatMessagesPayload> {
    await this.requireChatTables();
    const conversation = await this.conversationForUser(conversationId, session.userId);
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
       ${latestMessageWindowSql(100)}`,
      [conversationId],
    );

    return {
      conversation,
      messages: await this.messagePayloadsFromRows(session, chronologicalMessageRows(rows)),
    };
  }

  async createMessage(session: RequestSession, conversationId: number, body: Record<string, unknown>): Promise<ChatMessagePayload> {
    await this.requireChatTables();
    const conversation = await this.conversationForUser(conversationId, session.userId);

    await this.rejectBlockedChat(session.userId, conversation.otherParticipant.id);

    const draft = await this.chatMessageDraft(session, body);
    const messageId = await this.insertMessage(conversationId, session.userId, draft.body, draft.attachments, draft.entities);

    await this.notifyConversationRecipientsBestEffort(conversationId, session.userId, messageId, { kind: "direct" });

    return this.messageById(messageId, session);
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

  async listRoomChannels(session: RequestSession, slug: string): Promise<RoomChannelPayload[]> {
    await this.requireRoomChannelTables();
    const room = await this.requireRoomForViewing(session, slug);

    await this.ensureDefaultRoomChannel(room);

    const [rows] = await this.pool.execute<RoomChannelRow[]>(
      `${roomChannelSelectSql()}
       WHERE rc.room_id = ?
         AND rc.archived_at IS NULL
       ORDER BY rc.position ASC, rc.id ASC`,
      [session.userId, session.userId, numberValue(room.id)],
    );

    return Promise.all(rows.map((row) => this.roomChannelPayloadFromRow(row, session, room)));
  }

  async createRoomChannel(session: RequestSession, slug: string, body: Record<string, unknown>): Promise<RoomChannelPayload> {
    await this.requireRoomChannelTables();
    const room = await this.requireRoomForManaging(session, slug);
    const name = roomChannelName(body.name);
    const channelSlug = roomChannelSlug(body.slug ?? name);
    const description = optionalRoomChannelDescription(body.description);
    const kind = roomChannelKind(body.kind);
    const readOnly = roomChannelReadOnly(body.readOnly ?? body.read_only, kind);
    const position = await this.nextRoomChannelPosition(numberValue(room.id));

    const channelId = await this.withTransaction(async (connection) => {
      const [result] = await connection.execute<ResultSetHeader>(
        `INSERT INTO room_channels (room_id, slug, name, description, position, kind, read_only, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [numberValue(room.id), channelSlug, name, description, position, kind, readOnly ? 1 : 0, session.userId],
      );
      const id = result.insertId;

      await connection.execute<ResultSetHeader>(
        `INSERT IGNORE INTO conversations (type, room_id, room_channel_id)
         VALUES ('room_channel', ?, ?)`,
        [numberValue(room.id), id],
      );

      return id;
    }).catch((error: unknown) => {
      if (isDuplicateError(error)) {
        throw new ChatRouteError("A channel with that slug already exists.", 409);
      }

      throw error;
    });

    return this.roomChannelByIdForSession(session, room, channelId);
  }

  async updateRoomChannel(
    session: RequestSession,
    slug: string,
    channelSlug: string,
    body: Record<string, unknown>,
  ): Promise<RoomChannelPayload> {
    await this.requireRoomChannelTables();
    const room = await this.requireRoomForManaging(session, slug);
    const channel = await this.requireRoomChannel(room, channelSlug, { includeArchived: true });
    const updates: string[] = [];
    const params: Array<string | number | null> = [];

    if ("name" in body) {
      updates.push("name = ?");
      params.push(roomChannelName(body.name));
    }

    if ("slug" in body) {
      updates.push("slug = ?");
      params.push(roomChannelSlug(body.slug));
    }

    if ("description" in body) {
      updates.push("description = ?");
      params.push(optionalRoomChannelDescription(body.description));
    }

    if ("position" in body) {
      updates.push("position = ?");
      params.push(optionalRoomChannelPosition(body.position));
    }

    if ("kind" in body) {
      updates.push("kind = ?");
      params.push(roomChannelKind(body.kind));
    }

    if ("readOnly" in body || "read_only" in body) {
      updates.push("read_only = ?");
      params.push(roomChannelReadOnly(body.readOnly ?? body.read_only, null) ? 1 : 0);
    }

    if ("archived" in body || "archivedAt" in body || "archived_at" in body) {
      const archived = Boolean(body.archived ?? body.archivedAt ?? body.archived_at);

      if (archived) {
        const [activeRows] = await this.pool.execute<CountRow[]>(
          `SELECT COUNT(*) AS value
           FROM room_channels
           WHERE room_id = ?
             AND archived_at IS NULL
             AND id <> ?`,
          [numberValue(room.id), numberValue(channel.id)],
        );

        if (numberValue(activeRows[0]?.value ?? 0) === 0) {
          throw new ChatRouteError("A room must keep at least one active channel.", 422);
        }
      }

      updates.push(`archived_at = ${archived ? "UTC_TIMESTAMP()" : "NULL"}`);
    }

    if (updates.length === 0) {
      throw new ChatRouteError("No supported channel updates were provided.", 422);
    }

    params.push(numberValue(channel.id));

    await this.pool.execute<ResultSetHeader>(
      `UPDATE room_channels
       SET ${updates.join(", ")},
           updated_at = UTC_TIMESTAMP()
       WHERE id = ?`,
      params,
    ).catch((error: unknown) => {
      if (isDuplicateError(error)) {
        throw new ChatRouteError("A channel with that slug already exists.", 409);
      }

      throw error;
    });

    return this.roomChannelByIdForSession(session, room, numberValue(channel.id), true);
  }

  async listRoomChannelMessages(session: RequestSession, slug: string, channelSlug: string): Promise<RoomChannelMessagesPayload> {
    await this.requireRoomChannelTables();
    const room = await this.requireRoomForViewing(session, slug);
    const channel = await this.requireRoomChannel(room, channelSlug);
    const conversationId = await this.ensureRoomChannelConversation(room, channel);

    await this.ensureConversationMember(conversationId, session.userId);

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
       ${latestMessageWindowSql(150)}`,
      [conversationId],
    );

    return {
      channel: await this.roomChannelByIdForSession(session, room, numberValue(channel.id)),
      messages: await this.messagePayloadsFromRows(session, chronologicalMessageRows(rows)),
    };
  }

  async createRoomChannelMessage(
    session: RequestSession,
    slug: string,
    channelSlug: string,
    body: Record<string, unknown>,
  ): Promise<ChatMessagePayload> {
    await this.requireRoomChannelTables();
    const room = await this.requireRoomForPosting(session, slug);
    const channel = await this.requireRoomChannel(room, channelSlug);

    if (booleanValue(channel.read_only) && !(await this.roomViewerIsStaff(room, session))) {
      throw new ChatRouteError("Only room staff can post in this channel.", 403);
    }

    const conversationId = await this.ensureRoomChannelConversation(room, channel);
    const draft = await this.chatMessageDraft(session, body);
    const messageId = await this.insertMessage(conversationId, session.userId, draft.body, draft.attachments, draft.entities);

    await this.notifyConversationRecipientsBestEffort(conversationId, session.userId, messageId, {
      kind: "room",
      roomId: numberValue(room.id),
      roomSlug: room.slug,
      channelSlug: channel.slug,
    });

    return this.messageById(messageId, session);
  }

  async markRoomChannelRead(session: RequestSession, slug: string, channelSlug: string): Promise<ChatReadPayload> {
    await this.requireRoomChannelTables();
    const room = await this.requireRoomForViewing(session, slug);
    const channel = await this.requireRoomChannel(room, channelSlug);
    const conversationId = await this.ensureRoomChannelConversation(room, channel);
    const readAt = await this.currentDatabaseTimestamp();

    await this.ensureConversationMember(conversationId, session.userId);
    await this.pool.execute<ResultSetHeader>(
      `UPDATE conversation_members
       SET last_read_at = ?
       WHERE conversation_id = ?
         AND user_id = ?`,
      [readAt, conversationId, session.userId],
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

  private async requireRoomForViewing(session: RequestSession, slug: string): Promise<RoomRecordRow> {
    const room = await this.roomBySlug(slug);

    if (room === null || !(await this.roomCanView(room, session))) {
      throw new ChatRouteError("Room not found.", 404);
    }

    return room;
  }

  private async requireRoomForPosting(session: RequestSession, slug: string): Promise<RoomRecordRow> {
    const room = await this.roomBySlug(slug);

    if (room === null) {
      throw new ChatRouteError("Room not found.", 404);
    }

    if (!(await this.roomCanPost(room, session))) {
      throw new ChatRouteError("You cannot post in this room.", 403);
    }

    return room;
  }

  private async requireRoomForManaging(session: RequestSession, slug: string): Promise<RoomRecordRow> {
    const room = await this.roomBySlug(slug);

    if (room === null) {
      throw new ChatRouteError("Room not found.", 404);
    }

    if (!(await this.roomViewerIsStaff(room, session))) {
      throw new ChatRouteError("Only room staff can manage channels.", 403);
    }

    return room;
  }

  private async roomBySlug(slug: string): Promise<RoomRecordRow | null> {
    const normalized = normalizeRoomSlug(slug);

    if (normalized === null) {
      return null;
    }

    const [rows] = await this.pool.execute<RoomRecordRow[]>(
      `SELECT id, slug, name, visibility, created_by
       FROM rooms
       WHERE slug = ?
         AND deleted_at IS NULL
       LIMIT 1`,
      [normalized],
    );

    return rows[0] ?? null;
  }

  private async roomMembership(roomId: number, userId: number): Promise<RoomMembershipRow | null> {
    const [rows] = await this.pool.execute<RoomMembershipRow[]>(
      `SELECT id, role, banned_at
       FROM room_memberships
       WHERE room_id = ?
         AND user_id = ?
       LIMIT 1`,
      [roomId, userId],
    );

    return rows[0] ?? null;
  }

  private async roomCanView(room: RoomRecordRow, session: RequestSession): Promise<boolean> {
    if (session.role === "admin" || room.visibility === "public" || room.visibility === "view_only") {
      return true;
    }

    const membership = await this.roomMembership(numberValue(room.id), session.userId);

    return membership !== null && membership.banned_at === null;
  }

  private async roomCanPost(room: RoomRecordRow, session: RequestSession): Promise<boolean> {
    const membership = await this.roomMembership(numberValue(room.id), session.userId);

    return roomChatViewerCanPost(
      room.visibility,
      session.role,
      membership === null
        ? null
        : { role: membership.role, bannedAt: membership.banned_at },
    );
  }

  private async roomViewerIsStaff(room: RoomRecordRow, session: RequestSession): Promise<boolean> {
    if (session.role === "admin" || nullableNumberValue(room.created_by) === session.userId) {
      return true;
    }

    return roomMembershipIsStaff(await this.roomMembership(numberValue(room.id), session.userId));
  }

  private async ensureDefaultRoomChannel(room: RoomRecordRow): Promise<void> {
    await this.pool.execute<ResultSetHeader>(
      `INSERT IGNORE INTO room_channels (room_id, slug, name, description, position, kind, read_only, created_by)
       VALUES (?, 'general', 'general', 'Room chat', 0, 'chat', 0, ?)`,
      [numberValue(room.id), nullableNumberValue(room.created_by)],
    );
    const channel = await this.requireRoomChannel(room, "general");

    await this.ensureRoomChannelConversation(room, channel);
  }

  private async nextRoomChannelPosition(roomId: number): Promise<number> {
    const [rows] = await this.pool.execute<Array<RowDataPacket & { value: number | string | null }>>(
      `SELECT COALESCE(MAX(position), -1) + 1 AS value
       FROM room_channels
       WHERE room_id = ?`,
      [roomId],
    );

    return numberValue(rows[0]?.value ?? 0);
  }

  private async requireRoomChannel(
    room: RoomRecordRow,
    slug: string,
    options: { includeArchived?: boolean } = {},
  ): Promise<RoomChannelRow> {
    const normalized = roomChannelSlug(slug);
    const [rows] = await this.pool.execute<RoomChannelRow[]>(
      `SELECT
          rc.id,
          rc.room_id,
          rc.slug,
          rc.name,
          rc.description,
          rc.position,
          rc.kind,
          rc.read_only,
          rc.archived_at,
          rc.created_at,
          rc.updated_at,
          c.id AS conversation_id,
          c.last_message_at,
          NULL AS last_read_at,
          0 AS unread_count
       FROM room_channels rc
       LEFT JOIN conversations c
         ON c.room_channel_id = rc.id
        AND c.type = 'room_channel'
       WHERE rc.room_id = ?
         AND rc.slug = ?
         ${options.includeArchived ? "" : "AND rc.archived_at IS NULL"}
       LIMIT 1`,
      [numberValue(room.id), normalized],
    );
    const row = rows[0];

    if (row === undefined) {
      throw new ChatRouteError("Channel not found.", 404);
    }

    return row;
  }

  private async ensureRoomChannelConversation(room: RoomRecordRow, channel: RoomChannelRow): Promise<number> {
    const existing = nullableNumberValue(channel.conversation_id);

    if (existing !== null) {
      return existing;
    }

    return this.withTransaction(async (connection) => {
      await connection.execute<ResultSetHeader>(
        `INSERT IGNORE INTO conversations (type, room_id, room_channel_id)
         VALUES ('room_channel', ?, ?)`,
        [numberValue(room.id), numberValue(channel.id)],
      );
      const [rows] = await connection.execute<IdRow[]>(
        `SELECT id
         FROM conversations
         WHERE type = 'room_channel'
           AND room_channel_id = ?
         LIMIT 1`,
        [numberValue(channel.id)],
      );
      const row = rows[0];

      if (row === undefined) {
        throw new ChatStorageNotReadyError();
      }

      return numberValue(row.id);
    });
  }

  private async ensureConversationMember(conversationId: number, userId: number): Promise<void> {
    await this.pool.execute<ResultSetHeader>(
      `INSERT IGNORE INTO conversation_members (conversation_id, user_id)
       VALUES (?, ?)`,
      [conversationId, userId],
    );
  }

  private async roomChannelByIdForSession(
    session: RequestSession,
    room: RoomRecordRow,
    channelId: number,
    includeArchived = false,
  ): Promise<RoomChannelPayload> {
    const [rows] = await this.pool.execute<RoomChannelRow[]>(
      `${roomChannelSelectSql()}
       WHERE rc.id = ?
         ${includeArchived ? "" : "AND rc.archived_at IS NULL"}
       LIMIT 1`,
      [session.userId, session.userId, channelId],
    );
    const row = rows[0];

    if (row === undefined) {
      throw new ChatRouteError("Channel not found.", 404);
    }

    return this.roomChannelPayloadFromRow(row, session, room);
  }

  private async roomChannelPayloadFromRow(
    row: RoomChannelRow,
    session: RequestSession,
    room: RoomRecordRow,
  ): Promise<RoomChannelPayload> {
    const conversationId = await this.ensureRoomChannelConversation(room, row);
    const readOnly = booleanValue(row.read_only);

    return {
      id: numberValue(row.id),
      roomId: numberValue(row.room_id),
      slug: stringValue(row.slug),
      name: stringValue(row.name),
      description: nullableStringValue(row.description),
      position: numberValue(row.position),
      kind: row.kind === "announcement" ? "announcement" : "chat",
      readOnly,
      archivedAt: nullableStringValue(row.archived_at),
      conversationId,
      unreadCount: numberValue(row.unread_count ?? 0),
      lastMessageAt: nullableStringValue(row.last_message_at),
      viewerCanPost: (await this.roomCanPost(room, session)) && (!readOnly || (await this.roomViewerIsStaff(room, session))),
      createdAt: nullableStringValue(row.created_at),
      updatedAt: nullableStringValue(row.updated_at),
    };
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

    const previews = await this.attachmentPreviewsForMessages(
      row.last_message_id === null ? [] : [numberValue(row.last_message_id)],
    );

    return conversationPayloadFromRow(row, previews, this.publicBaseUrl);
  }

  private async messageById(messageId: number, session: RequestSession): Promise<ChatMessagePayload> {
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

    const messages = await this.messagePayloadsFromRows(session, [row]);
    const message = messages[0];

    if (message === undefined) {
      throw new ChatRouteError("Message not found.", 404);
    }

    return message;
  }

  private async messagePayloadsFromRows(session: RequestSession, rows: readonly MessageRow[]): Promise<ChatMessagePayload[]> {
    const visibleMessageIds = [...new Set(
      rows
        .filter((row) => row.deleted_at === null)
        .map((row) => numberValue(row.id)),
    )];
    const [entitiesByMessageId, attachmentsByMessageId] = await Promise.all([
      this.textEntitiesForMessages(visibleMessageIds),
      this.messageAttachmentsForMessages(session, visibleMessageIds),
    ]);

    return rows.map((row) => this.messagePayloadFromRow(
      row,
      entitiesByMessageId.get(numberValue(row.id)) ?? [],
      attachmentsByMessageId.get(numberValue(row.id)) ?? [],
    ));
  }

  private messagePayloadFromRow(
    row: MessageRow,
    bodyEntities: TextEntityPayload[],
    attachments: ChatMessageAttachmentPayload[],
  ): ChatMessagePayload {
    const deleted = row.deleted_at !== null;
    const messageId = numberValue(row.id);

    return {
      id: messageId,
      conversationId: numberValue(row.conversation_id),
      body: deleted ? "" : stringValue(row.body),
      bodyEntities: deleted ? [] : bodyEntities,
      attachments: deleted ? [] : attachments,
      deletedAt: nullableStringValue(row.deleted_at),
      createdAt: nullableStringValue(row.created_at),
      sender: userPayloadFromParts(row.sender_user_id, row.sender_handle, row.sender_display_name, row.sender_avatar_url),
    };
  }

  private async chatMessageDraft(
    session: RequestSession,
    body: Record<string, unknown>,
  ): Promise<ValidatedMessageDraft> {
    const originalBody = typeof body.body === "string" ? body.body.trim() : "";

    if (originalBody.length > 2000) {
      throw new ChatRouteError("Message body must be 2000 characters or fewer.", 422);
    }

    const candidates = validateMessageAttachmentInputs(body.attachments);
    const attachments: ValidatedMessageAttachment[] = [];
    const attachmentKeys = new Set<string>();

    for (const candidate of candidates) {
      if (candidate.type === "media") {
        attachments.push({ ...candidate.attachment, type: "media", position: attachments.length });
        continue;
      }

      if (candidate.type === "post") {
        const post = await this.postsRepository.getPublicPost(
          String(candidate.postId),
          session.userId,
          this.publicBaseUrl,
        );

        if (post === null) {
          throw new ChatRouteError("Post is unavailable or inaccessible.", 422);
        }

        const key = `post:${post.id}`;

        if (!attachmentKeys.has(key)) {
          attachmentKeys.add(key);
          attachments.push({ type: "post", postId: post.id, position: attachments.length });
        }

        continue;
      }

      const room = (await this.roomsForViewer([candidate.roomId], session)).get(
        candidate.roomId,
      );

      if (!room?.viewerCanViewPosts) {
        throw new ChatRouteError("Room is unavailable or inaccessible.", 422);
      }

      const key = `room:${candidate.roomId}`;

      if (!attachmentKeys.has(key)) {
        attachmentKeys.add(key);
        attachments.push({ type: "room", roomId: candidate.roomId, position: attachments.length });
      }
    }

    const strippedLinks: NativeChatLink[] = [];

    let nativeLinkResolutionCount = 0;

    for (const link of nativeChatLinks(originalBody, this.publicBaseUrl)) {
      if (attachments.length >= maxMessageAttachments || nativeLinkResolutionCount >= maxMessageAttachments) {
        break;
      }

      nativeLinkResolutionCount += 1;

      if (link.kind === "post") {
        const post = await this.postsRepository.getPublicPost(
          link.identifier,
          session.userId,
          this.publicBaseUrl,
        );

        if (post === null || post.author.handle.toLowerCase() !== link.handle) {
          continue;
        }

        const key = `post:${post.id}`;

        if (!attachmentKeys.has(key)) {
          if (attachments.length >= maxMessageAttachments) {
            continue;
          }

          attachmentKeys.add(key);
          attachments.push({ type: "post", postId: post.id, position: attachments.length });
        }

        strippedLinks.push(link);
        continue;
      }

      const room = await this.roomsRepository.getPublicRoom(link.slug, roomViewerFromSession(session));

      if (room === null || !room.viewerCanViewPosts) {
        continue;
      }

      const key = `room:${room.id}`;

      if (!attachmentKeys.has(key)) {
        if (attachments.length >= maxMessageAttachments) {
          continue;
        }

        attachmentKeys.add(key);
        attachments.push({ type: "room", roomId: room.id, position: attachments.length });
      }

      strippedLinks.push(link);
    }

    const messageBody = removeNativeChatLinks(originalBody, strippedLinks);

    if (messageBody === "" && attachments.length === 0) {
      throw new ChatRouteError("Message body is required.", 422);
    }

    return {
      body: messageBody,
      attachments,
      entities: chatLinkEntities(messageBody),
    };
  }

  private async insertMessage(
    conversationId: number,
    senderUserId: number,
    body: string,
    attachments: ValidatedMessageAttachment[] = [],
    entities: ValidatedMessageEntity[] = [],
  ): Promise<number> {
    if (attachments.length > 0) {
      await this.requireMessageAttachmentColumns();
    }

    const persistEntities = entities.length > 0 && await this.hasTable("text_entities");

    return this.withTransaction(async (connection) => {
      const [messageResult] = await connection.execute<ResultSetHeader>(
        `INSERT INTO messages (conversation_id, sender_id, body)
         VALUES (?, ?, ?)`,
        [conversationId, senderUserId, body],
      );
      const messageId = messageResult.insertId;

      await this.insertMessageAttachments(connection, messageId, attachments);
      await this.insertMessageTextEntities(connection, messageId, persistEntities ? entities : []);

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

  private async insertMessageAttachments(
    connection: PoolConnection,
    messageId: number,
    attachments: ValidatedMessageAttachment[],
  ): Promise<void> {
    if (attachments.length === 0) {
      return;
    }

    for (const attachment of attachments) {
      await connection.execute<ResultSetHeader>(
        `INSERT INTO message_attachments (
            message_id,
            position,
            type,
            post_id,
            room_id,
            url,
            mime,
            size_bytes,
            width,
            height,
            duration_seconds,
            poster_url,
            provider,
            resource_type,
            resource_id,
            resource_key,
            source_url,
            card_json
         )
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          messageId,
          attachment.position,
          storedAttachmentType(attachment),
          attachment.type === "post" ? attachment.postId : null,
          attachment.type === "room" ? attachment.roomId : null,
          attachment.type === "media" ? attachment.url : null,
          attachment.type === "media" ? attachment.mime : null,
          attachment.type === "media" ? attachment.sizeBytes : null,
          attachment.type === "media" ? attachment.width : null,
          attachment.type === "media" ? attachment.height : null,
          attachment.type === "media" ? attachment.durationSeconds : null,
          attachment.type === "media" ? attachment.posterUrl : null,
          attachment.type === "media" ? attachment.provider : null,
          attachment.type === "media" ? attachment.resourceType : null,
          attachment.type === "media" ? attachment.resourceId : null,
          attachment.type === "media" ? attachment.resourceKey : null,
          attachment.type === "media" ? attachment.sourceUrl : null,
          attachment.type === "media" ? attachment.cardJson : null,
        ],
      );
    }
  }

  private async insertMessageTextEntities(
    connection: PoolConnection,
    messageId: number,
    entities: ValidatedMessageEntity[],
  ): Promise<void> {
    if (entities.length === 0) {
      return;
    }

    for (const entity of entities) {
      await connection.execute<ResultSetHeader>(
        `INSERT INTO text_entities
           (content_type, content_id, field_name, entity_type, entity_start, entity_length, text_value, target_user_id, url, card_json)
         VALUES ('message', ?, 'body', 'link', ?, ?, ?, NULL, ?, NULL)`,
        [messageId, entity.start, entity.length, entity.text, entity.url],
      );
    }
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

  private async attachmentPreviewsForMessages(messageIds: readonly number[]): Promise<Map<number, string>> {
    const previews = new Map<number, string>();
    const uniqueIds = [...new Set(messageIds.filter((id) => Number.isSafeInteger(id) && id > 0))];

    if (uniqueIds.length === 0 || !(await this.hasTable("message_attachments"))) {
      return previews;
    }

    const placeholders = uniqueIds.map(() => "?").join(", ");
    const [rows] = await this.pool.execute<Array<RowDataPacket & { message_id: number | string; type: string | null }>>(
      `SELECT message_id, type
       FROM message_attachments
       WHERE message_id IN (${placeholders})
       ORDER BY message_id ASC, id ASC`,
      uniqueIds,
    );

    for (const row of rows) {
      const messageId = numberValue(row.message_id);

      if (!previews.has(messageId)) {
        previews.set(messageId, attachmentPreviewText(row.type));
      }
    }

    return previews;
  }

  private async notifyConversationRecipients(
    conversationId: number,
    senderUserId: number,
    messageId: number,
    context: ConversationNotificationContext,
  ): Promise<void> {
    if (!(await this.hasTable("notifications"))) {
      return;
    }

    const [rows] = context.kind === "room"
      ? await this.pool.execute<CountRow[]>(
          `SELECT members.user_id AS value
           FROM conversation_members members
           INNER JOIN room_memberships room_members
             ON room_members.user_id = members.user_id
            AND room_members.room_id = ?
            AND room_members.banned_at IS NULL
           WHERE members.conversation_id = ?
             AND members.user_id <> ?`,
          [context.roomId, conversationId, senderUserId],
        )
      : await this.pool.execute<CountRow[]>(
          `SELECT user_id AS value
           FROM conversation_members
           WHERE conversation_id = ?
             AND user_id <> ?`,
          [conversationId, senderUserId],
        );
    const notificationData = context.kind === "room"
      ? {
          conversationId,
          messageId,
          messageContext: "room",
          roomSlug: context.roomSlug,
          channelSlug: context.channelSlug,
        }
      : {
          conversationId,
          messageId,
          messageContext: "direct",
        };
    const roomId = context.kind === "room" ? context.roomId : null;

    for (const row of rows) {
      const recipientId = numberValue(row.value);

      if (await this.notificationUserAllowsType(recipientId, "message")) {
        await this.pool.execute<ResultSetHeader>(
          `INSERT INTO notifications (user_id, actor_id, type, post_id, room_id, data)
           VALUES (?, ?, 'message', NULL, ?, ?)`,
          [recipientId, senderUserId, roomId, JSON.stringify(notificationData)],
        );
      }
    }
  }

  private async notifyConversationRecipientsBestEffort(
    conversationId: number,
    senderUserId: number,
    messageId: number,
    context: ConversationNotificationContext,
  ): Promise<void> {
    try {
      await this.notifyConversationRecipients(conversationId, senderUserId, messageId, context);
    } catch {
      // The message is already committed. Notification delivery must never make
      // the send look failed and invite a duplicate retry from the client.
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

  private async messageAttachmentsForMessages(
    session: RequestSession,
    messageIds: readonly number[],
  ): Promise<Map<number, ChatMessageAttachmentPayload[]>> {
    const attachmentsByMessageId = new Map<number, ChatMessageAttachmentPayload[]>();

    if (messageIds.length === 0) {
      return attachmentsByMessageId;
    }

    if (!(await this.hasTable("message_attachments"))) {
      return attachmentsByMessageId;
    }

    const [hasMediaColumns, hasPosition, hasRoomId, hasSizeBytes, hasDurationSeconds, hasPosterUrl] = await Promise.all([
      this.hasColumn("message_attachments", "url"),
      this.hasColumn("message_attachments", "position"),
      this.hasColumn("message_attachments", "room_id"),
      this.hasColumn("message_attachments", "size_bytes"),
      this.hasColumn("message_attachments", "duration_seconds"),
      this.hasColumn("message_attachments", "poster_url"),
    ]);
    const placeholders = messageIds.map(() => "?").join(", ");
    const [rows] = await this.pool.execute<AttachmentRow[]>(
      `SELECT
          id,
          message_id,
          ${hasPosition ? "position" : "NULL AS position"},
          type,
          post_id,
          ${hasRoomId ? "room_id" : "NULL AS room_id"},
          ${hasMediaColumns ? "url, mime" : "NULL AS url, NULL AS mime"},
          ${hasSizeBytes ? "size_bytes" : "NULL AS size_bytes"},
          ${hasMediaColumns ? "width, height" : "NULL AS width, NULL AS height"},
          ${hasDurationSeconds ? "duration_seconds" : "NULL AS duration_seconds"},
          ${hasPosterUrl ? "poster_url" : "NULL AS poster_url"},
          ${hasMediaColumns
            ? "provider, resource_type, resource_id, resource_key, source_url, card_json"
            : "NULL AS provider, NULL AS resource_type, NULL AS resource_id, NULL AS resource_key, NULL AS source_url, NULL AS card_json"},
          created_at
       FROM message_attachments
       WHERE message_id IN (${placeholders})
       ORDER BY message_id ASC, ${hasPosition ? "CASE WHEN position IS NULL THEN 1 ELSE 0 END ASC, position ASC," : ""} id ASC`,
      [...messageIds],
    );
    const rowsByMessageId = new Map<number, AttachmentRow[]>();

    for (const row of rows) {
      const messageId = numberValue(row.message_id);
      const messageRows = rowsByMessageId.get(messageId) ?? [];

      if (messageRows.length < 10) {
        messageRows.push({ ...row, position: nullableNumberValue(row.position) ?? messageRows.length });
        rowsByMessageId.set(messageId, messageRows);
      }
    }

    const postIds = uniquePositiveIds(rows.filter((row) => row.type === "post").map((row) => row.post_id));
    const roomIds = uniquePositiveIds(rows.filter((row) => row.type === "room").map((row) => row.room_id));
    const [postsById, roomsById] = await Promise.all([
      this.postsForViewer(postIds, session),
      this.roomsForViewer(roomIds, session),
    ]);

    for (const [messageId, messageRows] of rowsByMessageId.entries()) {
      const attachments = messageRows.map((row) => messageAttachmentPayloadFromRow(row, postsById, roomsById));

      attachmentsByMessageId.set(
        messageId,
        attachments.filter((attachment): attachment is ChatMessageAttachmentPayload => attachment !== null),
      );
    }

    return attachmentsByMessageId;
  }

  private async postsForViewer(
    postIds: readonly number[],
    session: RequestSession,
  ): Promise<Map<number, PostDetailPayload>> {
    return this.postsRepository.getPublicPostsByIds(postIds, session.userId, this.publicBaseUrl);
  }

  private async roomsForViewer(
    roomIds: readonly number[],
    session: RequestSession,
  ): Promise<Map<number, ChatRoomAttachmentPayload>> {
    if (roomIds.length === 0) {
      return new Map();
    }

    const rooms = await this.roomsRepository.getPublicRoomsByIds(roomIds, roomViewerFromSession(session));

    return new Map([...rooms].map(([roomId, room]) => [
      roomId,
      chatRoomAttachmentPayload(room, this.publicBaseUrl),
    ]));
  }

  private async textEntitiesForMessages(messageIds: readonly number[]): Promise<Map<number, TextEntityPayload[]>> {
    const entitiesByMessageId = new Map<number, TextEntityPayload[]>();

    if (messageIds.length === 0) {
      return entitiesByMessageId;
    }

    if (!(await this.hasTable("text_entities"))) {
      return entitiesByMessageId;
    }

    const placeholders = messageIds.map(() => "?").join(", ");
    const [rows] = await this.pool.execute<TextEntityRow[]>(
      `SELECT
          e.content_id AS message_id,
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
         AND e.content_id IN (${placeholders})
         AND e.field_name = 'body'
       ORDER BY e.content_id ASC, e.entity_start ASC, e.id ASC`,
      [...messageIds],
    );

    for (const row of rows) {
      const entity = textEntityPayloadFromRow(row);

      if (entity !== null) {
        const messageId = numberValue(row.message_id);
        const entities = entitiesByMessageId.get(messageId) ?? [];
        entities.push(entity);
        entitiesByMessageId.set(messageId, entities);
      }
    }

    return entitiesByMessageId;
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

  private async requireRoomChannelTables(): Promise<void> {
    await this.requireChatTables();

    if (!(await this.hasTable("room_channels")) || !(await this.hasTable("room_memberships"))) {
      throw new ChatStorageNotReadyError("Room channel storage is not ready. Run pending migrations.");
    }
  }

  private async requireMessageAttachmentColumns(): Promise<void> {
    const columns = ["position", "room_id", "url", "size_bytes", "duration_seconds", "poster_url"];

    if (
      !(await this.hasTable("message_attachments")) ||
      !(await Promise.all(columns.map((column) => this.hasColumn("message_attachments", column)))).every(Boolean)
    ) {
      throw new ChatStorageNotReadyError("Message attachment storage is not ready. Run pending migrations.");
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

export function latestMessageWindowSql(limit: number): string {
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 500) {
    throw new Error("Message window limit is invalid.");
  }

  return `ORDER BY m.created_at DESC, m.id DESC
       LIMIT ${limit}`;
}

export function chronologicalMessageRows<T>(rows: readonly T[]): T[] {
  return [...rows].reverse();
}

export function conversationSelectSql(): string {
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

function roomChannelSelectSql(): string {
  return `SELECT
      rc.id,
      rc.room_id,
      rc.slug,
      rc.name,
      rc.description,
      rc.position,
      rc.kind,
      rc.read_only,
      rc.archived_at,
      rc.created_at,
      rc.updated_at,
      c.id AS conversation_id,
      c.last_message_at,
      viewer_member.last_read_at,
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
    FROM room_channels rc
    LEFT JOIN conversations c
      ON c.room_channel_id = rc.id
     AND c.type = 'room_channel'
    LEFT JOIN conversation_members viewer_member
      ON viewer_member.conversation_id = c.id
     AND viewer_member.user_id = ?`;
}

function conversationPayloadFromRow(
  row: ConversationRow,
  attachmentPreviews: ReadonlyMap<number, string> = new Map(),
  publicBaseUrl = "https://thia.lol",
): ChatConversationPayload {
  const lastMessage = row.last_message_id === null
    ? null
    : (() => {
        const id = numberValue(row.last_message_id);
        const body = stringValue(row.last_message_body);
        const attachmentPreview = attachmentPreviews.get(id);
        const nativeKind = attachmentPreview === "Post"
          ? "post"
          : attachmentPreview === "Room"
            ? "room"
            : null;
        const nativeLinks = nativeKind === null
          ? []
          : nativeChatLinks(body, publicBaseUrl).filter(
              (link) => link.kind === nativeKind,
            );
        const previewBody = nativeLinks.length > 0
          ? removeNativeChatLinks(body, nativeLinks)
          : body.trim();

        return {
        id,
        body,
        previewText: previewBody || attachmentPreview || "Message",
        createdAt: nullableStringValue(row.last_message_created_at),
        sender: userPayloadFromParts(
          row.last_sender_user_id,
          row.last_sender_handle,
          row.last_sender_display_name,
          row.last_sender_avatar_url,
        ),
      };
    })();

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

type ValidatedMessageAttachment = {
  type: "post";
  position: number;
  postId: number;
} | {
  type: "room";
  position: number;
  roomId: number;
} | ({
  type: "media";
} & ValidatedPostAttachment);

type MessageAttachmentCandidate = {
  type: "post";
  postId: number;
} | {
  type: "room";
  roomId: number;
} | {
  type: "media";
  attachment: ValidatedPostAttachment;
};

interface ValidatedMessageEntity {
  start: number;
  length: number;
  text: string;
  url: string;
}

interface ValidatedMessageDraft {
  body: string;
  attachments: ValidatedMessageAttachment[];
  entities: ValidatedMessageEntity[];
}

const maxMessageAttachments = 8;

export function validateMessageAttachmentInputs(value: unknown): MessageAttachmentCandidate[] {
  if (value === undefined || value === null) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw new ChatRouteError("Message attachments must be a list.", 422);
  }

  if (value.length > maxMessageAttachments) {
    throw new ChatRouteError(`Messages can include up to ${maxMessageAttachments} attachments.`, 422);
  }

  return value.map((candidate) => {
    if (candidate === null || typeof candidate !== "object" || Array.isArray(candidate)) {
      throw new ChatRouteError("Message attachment is invalid.", 422);
    }

    const attachment = candidate as Record<string, unknown>;
    const type = attachment.type ?? attachment.kind;

    if (type === "post") {
      return {
        type: "post",
        postId: nativeAttachmentId(attachment, "postId", "post_id", "post"),
      };
    }

    if (type === "room") {
      return {
        type: "room",
        roomId: nativeAttachmentId(attachment, "roomId", "room_id", "room"),
      };
    }

    const media = type === "media" ? attachment.media : attachment;

    try {
      const validated = validatePostAttachments({ attachments: [media] })[0];

      if (validated === undefined) {
        throw new ChatRouteError("Message attachment is invalid.", 422);
      }

      return { type: "media", attachment: validated };
    } catch (error) {
      if (error instanceof ContentRouteError) {
        throw new ChatRouteError(
          error.message.replace(/^Posts\b/u, "Messages").replace(/^Post\b/u, "Message"),
          error.statusCode,
        );
      }

      throw error;
    }
  });
}

function nativeAttachmentId(
  attachment: Record<string, unknown>,
  camelKey: string,
  snakeKey: string,
  nestedKey: string,
): number {
  const nested = attachment[nestedKey];
  const nestedId = nested !== null && typeof nested === "object" && !Array.isArray(nested)
    ? (nested as Record<string, unknown>).id
    : undefined;

  return positiveInteger(attachment[camelKey] ?? attachment[snakeKey] ?? attachment.id ?? nestedId, `${nestedKey} id`);
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

function normalizeRoomSlug(value: string): string | null {
  try {
    const decoded = decodeURIComponent(value);
    const normalized = decoded.toLowerCase();

    return /^[a-z0-9-]{1,80}$/u.test(normalized) ? normalized : null;
  } catch {
    return null;
  }
}

function roomChannelName(value: unknown): string {
  if (typeof value !== "string") {
    throw new ChatRouteError("Channel name is required.", 422);
  }

  const trimmed = value.trim().replace(/\s+/gu, " ");

  if (trimmed.length < 1 || trimmed.length > 80) {
    throw new ChatRouteError("Channel name must be 1-80 characters.", 422);
  }

  return trimmed;
}

function roomChannelSlug(value: unknown): string {
  if (typeof value !== "string") {
    throw new ChatRouteError("Channel slug is required.", 422);
  }

  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/^#/u, "")
    .replace(/[^a-z0-9-]+/gu, "-")
    .replace(/^-+|-+$/gu, "")
    .replace(/-{2,}/gu, "-");

  if (!/^[a-z0-9-]{1,48}$/u.test(normalized)) {
    throw new ChatRouteError("Channel slug must use letters, numbers, and dashes.", 422);
  }

  return normalized;
}

function optionalRoomChannelDescription(value: unknown): string | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  if (typeof value !== "string") {
    throw new ChatRouteError("Channel description is invalid.", 422);
  }

  const trimmed = value.trim();

  if (trimmed.length > 240) {
    throw new ChatRouteError("Channel description must be 240 characters or fewer.", 422);
  }

  return trimmed === "" ? null : trimmed;
}

function roomChannelKind(value: unknown): "chat" | "announcement" {
  return value === "announcement" ? "announcement" : "chat";
}

function roomChannelReadOnly(value: unknown, kind: "chat" | "announcement" | null): boolean {
  if (value === undefined || value === null || value === "") {
    return kind === "announcement";
  }

  return value === true || value === "1" || value === "true" || value === 1;
}

function optionalRoomChannelPosition(value: unknown): number {
  const number = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;

  if (!Number.isInteger(number) || number < 0 || number > 10000) {
    throw new ChatRouteError("Channel position is invalid.", 422);
  }

  return number;
}

function roomMembershipIsStaff(membership: RoomMembershipRow | null): boolean {
  return membership !== null && membership.banned_at === null && (membership.role === "owner" || membership.role === "moderator");
}

export function roomChatViewerCanPost(
  visibility: string | null,
  sessionRole: string | null,
  membership: { role: string | null; bannedAt: string | null } | null,
): boolean {
  if (sessionRole === "admin") {
    return true;
  }

  if (membership === null || membership.bannedAt !== null) {
    return false;
  }

  if (visibility === "view_only") {
    return membership.role === "owner" || membership.role === "moderator";
  }

  return true;
}

function gifAttachmentPayloadFromRow(row: AttachmentRow): GifAttachmentPayload | null {
  if (row.provider !== "klipy" || row.resource_id === null || row.url === null) {
    return null;
  }

  return {
    provider: "klipy",
    resourceType: "gif",
    resourceId: stringValue(row.resource_id),
    resourceKey: stringValue(row.resource_key, `klipy:${row.resource_id}`),
    url: stringValue(row.url),
    mime: "image/gif",
    width: nullableNumberValue(row.width),
    height: nullableNumberValue(row.height),
    sourceUrl: nullableStringValue(row.source_url),
    card: jsonObjectOrArray(row.card_json),
  };
}

function messageAttachmentPayloadFromRow(
  row: AttachmentRow,
  postsById: ReadonlyMap<number, PostDetailPayload>,
  roomsById: ReadonlyMap<number, ChatRoomAttachmentPayload>,
): ChatMessageAttachmentPayload | null {
  if (row.type === "post") {
    const postId = nullableNumberValue(row.post_id);

    return {
      type: "post",
      post: postId === null ? null : postsById.get(postId) ?? null,
    };
  }

  if (row.type === "room") {
    const roomId = nullableNumberValue(row.room_id);

    return {
      type: "room",
      room: roomId === null ? null : roomsById.get(roomId) ?? null,
    };
  }

  if (row.type === "gif") {
    const gif = gifAttachmentPayloadFromRow(row);

    return gif === null ? null : { type: "gif", gif };
  }

  if (row.type !== "image" && row.type !== "video" && row.type !== "audio" && row.type !== "integration") {
    return null;
  }

  return {
    type: "media",
    media: {
      id: numberValue(row.id),
      position: numberValue(row.position ?? 0),
      kind: row.type,
      url: nullableStringValue(row.url),
      mime: nullableStringValue(row.mime),
      sizeBytes: nullableNumberValue(row.size_bytes),
      width: nullableNumberValue(row.width),
      height: nullableNumberValue(row.height),
      durationSeconds: nullableNumberValue(row.duration_seconds),
      posterUrl: nullableStringValue(row.poster_url),
      provider: nullableStringValue(row.provider),
      resourceType: nullableStringValue(row.resource_type),
      resourceId: nullableStringValue(row.resource_id),
      resourceKey: nullableStringValue(row.resource_key),
      sourceUrl: nullableStringValue(row.source_url),
      card: jsonObjectOrArray(row.card_json),
      createdAt: nullableStringValue(row.created_at),
      updatedAt: null,
    },
  };
}

function storedAttachmentType(attachment: ValidatedMessageAttachment): string {
  return attachment.type === "media" ? attachment.kind : attachment.type;
}

function uniquePositiveIds(values: readonly (number | string | null)[]): number[] {
  return [...new Set(values.flatMap((value) => {
    const id = nullableNumberValue(value);

    return id === null || id < 1 ? [] : [id];
  }))];
}

function roomViewerFromSession(session: RequestSession): { userId: number; role: string } {
  return {
    userId: session.userId,
    role: session.role,
  };
}

function chatRoomAttachmentPayload(room: RoomPayload, publicBaseUrl: string): ChatRoomAttachmentPayload {
  const canonicalPath = `/rooms/${encodeURIComponent(room.slug)}`;

  return {
    ...room,
    canonicalPath,
    canonicalUrl: `${publicBaseUrl.replace(/\/+$/u, "")}${canonicalPath}`,
  };
}

function attachmentPreviewText(type: string | null): string {
  switch (type) {
    case "post":
      return "Post";
    case "room":
      return "Room";
    case "image":
      return "Photo";
    case "video":
      return "Video";
    case "audio":
      return "Audio";
    case "integration":
      return "Music";
    case "gif":
      return "GIF";
    default:
      return "Attachment";
  }
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

function booleanValue(value: boolean | number | string | null | undefined): boolean {
  if (typeof value === "boolean") {
    return value;
  }

  if (value === null || value === undefined || value === "") {
    return false;
  }

  return Number(value) !== 0;
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

function jsonObject(value: string): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(value);

    return parsed !== null && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

function jsonObjectOrArray(value: string | null): Record<string, unknown> | unknown[] | null {
  if (value === null || value === "") {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(value);

    return parsed !== null && typeof parsed === "object"
      ? parsed as Record<string, unknown> | unknown[]
      : null;
  } catch {
    return null;
  }
}

function isDuplicateError(error: unknown): boolean {
  if (error === null || typeof error !== "object") {
    return false;
  }

  const record = error as Record<string, unknown>;

  return record.code === "ER_DUP_ENTRY" || record.errno === 1062;
}
