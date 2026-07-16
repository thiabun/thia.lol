import { randomBytes } from "node:crypto";

import type { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";

import {
  normalizePostIdentifier,
  postCanonicalPath,
} from "./posts.js";
import {
  hydratePostAttachments,
  normalizeProfileHandle,
  postPayloadFromRow,
  postSelectSql,
  type PostAttachmentKind,
  type PostPayload,
  type ProfileRow,
  type ProfileSchemaCapabilities,
  type TextEntityPayload,
} from "./profiles.js";
import {
  buildPublicRoomBySlugQuery,
  buildPublicRoomMembersQuery,
  initialsFromName,
  normalizeRoomSlug,
  roomMemberPayloadFromRow,
  roomPayloadFromRow,
  roomStorageReady,
  type RoomAccessRequestStatus,
  type RoomMemberPayload,
  type RoomMemberRow,
  type RoomPayload,
  type RoomRow,
  type RoomSchemaCapabilities,
  type RoomVisibility,
  type RoomViewer,
  type UserPayload,
} from "./rooms.js";
import {
  normalizeRoomThemeConfig,
  validateRoomThemeToken,
  type RoomThemeConfig,
} from "./room-themes.js";
import type { RequestSession } from "./sessions.js";

export class ContentRouteError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
  ) {
    super(message);
    this.name = "ContentRouteError";
  }
}

export class ContentStorageNotReadyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ContentStorageNotReadyError";
  }
}

export interface ContentMutationsRepository {
  followProfile(handle: string, viewerUserId: number): Promise<FollowRelationshipPayload>;
  unfollowProfile(handle: string, viewerUserId: number): Promise<FollowRelationshipPayload>;
  blockProfile(handle: string, viewerUserId: number): Promise<ProfileControlPayload>;
  unblockProfile(handle: string, viewerUserId: number): Promise<ProfileControlPayload>;
  muteProfile(handle: string, viewerUserId: number): Promise<ProfileControlPayload>;
  unmuteProfile(handle: string, viewerUserId: number): Promise<ProfileControlPayload>;
  starProfile(handle: string, viewerUserId: number): Promise<ProfileStarPayload>;
  unstarProfile(handle: string, viewerUserId: number): Promise<ProfileStarPayload>;
  removeFollower(handle: string, viewerUserId: number): Promise<RemoveFollowerPayload>;
  approveFollowRequest(requestId: number, viewerUserId: number): Promise<FollowRequestApprovePayload>;
  denyFollowRequest(requestId: number, viewerUserId: number): Promise<FollowRequestDenyPayload>;
  createPost(session: RequestSession, body: Record<string, unknown>): Promise<PostPayload>;
  createReply(session: RequestSession, postId: number, body: Record<string, unknown>): Promise<PostPayload>;
  updatePost(session: RequestSession, postId: number, body: Record<string, unknown>): Promise<PostPayload>;
  deletePost(session: RequestSession, postId: number): Promise<PostDeletePayload>;
  likePost(postId: number, viewerUserId: number): Promise<LikePayload>;
  unlikePost(postId: number, viewerUserId: number): Promise<LikePayload>;
  reblogPost(postId: number, session: RequestSession): Promise<ReblogPayload>;
  unreblogPost(postId: number, session: RequestSession): Promise<ReblogPayload>;
  reactToPost(postId: number, viewerUserId: number, body: Record<string, unknown>): Promise<ReactionPayload>;
  deletePostReaction(postId: number, viewerUserId: number, type: string): Promise<ReactionPayload>;
  sharePostToMessages(
    identifier: string,
    viewerUserId: number,
    body: Record<string, unknown>,
  ): Promise<PostShareMessagesPayload>;
  shareRoomToMessages(
    slug: string,
    session: RequestSession,
    body: Record<string, unknown>,
  ): Promise<RoomShareMessagesPayload>;
  createRoom(session: RequestSession, body: Record<string, unknown>): Promise<RoomPayload>;
  updateRoom(session: RequestSession, slug: string, body: Record<string, unknown>): Promise<RoomPayload>;
  deleteRoom(session: RequestSession, slug: string): Promise<RoomDeletePayload>;
  joinRoom(session: RequestSession, slug: string, body: Record<string, unknown>): Promise<RoomPayload>;
  leaveRoom(session: RequestSession, slug: string): Promise<RoomPayload>;
  requestRoomAccess(session: RequestSession, slug: string, body: Record<string, unknown>): Promise<RoomPayload>;
  cancelRoomAccessRequest(session: RequestSession, slug: string): Promise<RoomPayload>;
  listRoomAccessRequests(session: RequestSession, slug: string): Promise<RoomAccessRequestPayload[]>;
  approveRoomAccessRequest(session: RequestSession, slug: string, requestId: number): Promise<RoomAccessRequestPayload[]>;
  denyRoomAccessRequest(session: RequestSession, slug: string, requestId: number): Promise<RoomAccessRequestPayload[]>;
  addRoomMember(session: RequestSession, slug: string, body: Record<string, unknown>): Promise<RoomMemberPayload[]>;
  removeRoomMember(session: RequestSession, slug: string, body: Record<string, unknown>): Promise<RoomMemberPayload[]>;
  addRoomModerator(session: RequestSession, slug: string, body: Record<string, unknown>): Promise<RoomMemberPayload[]>;
  removeRoomModerator(session: RequestSession, slug: string, body: Record<string, unknown>): Promise<RoomMemberPayload[]>;
}

export interface ContentMutationsRepositoryOptions {
  publicBaseUrl: string;
}

export interface FollowRelationshipPayload {
  isFollowing: boolean;
  isFollowedBy: boolean;
  isMoot: boolean;
  isFollowRequestPending: boolean;
  isBlocked: boolean;
  isMuted: boolean;
  followerCount: number;
  followingCount: number;
  mootCount: number;
  starCount: number;
  isStarred: boolean;
}

export interface ProfileControlPayload {
  isBlocked: boolean;
  isMuted: boolean;
  relationship: FollowRelationshipPayload;
}

export interface ProfileStarPayload {
  isStarred: boolean;
  starCount: number;
  relationship: FollowRelationshipPayload;
  stats: {
    followers: number;
    following: number;
    moots: number;
    stars: number;
  };
}

export interface RemoveFollowerPayload {
  removedFollower: boolean;
  relationship: FollowRelationshipPayload;
}

export interface FollowRequestApprovePayload {
  approved: true;
}

export interface FollowRequestDenyPayload {
  denied: true;
}

export interface LikePayload {
  postId: number;
  likeCount: number;
  likedByCurrentUser: boolean;
}

export interface ReblogPayload {
  postId: number;
  reblogCount: number;
  rebloggedByMe: boolean;
  rebloggedByCurrentUser: boolean;
}

export interface ReactionPayload {
  postId: number;
  reactions: {
    glow: number;
    echo: number;
    hush: number;
  };
}

export interface PostDeletePayload {
  id: number;
  status: "removed";
  deletedAt: string | null;
}

export interface PostShareMessagesPayload {
  post: PostShareSummaryPayload;
  results: PostShareResultPayload[];
  sentCount: number;
  failedCount: number;
}

export interface RoomShareMessagesPayload {
  room: RoomPayload;
  results: PostShareResultPayload[];
  sentCount: number;
  failedCount: number;
}

export interface PostShareSummaryPayload {
  id: number;
  publicId: string;
  canonicalPath: string;
  canonicalUrl: string;
  bodySnippet: string;
  createdAt: string | null;
  mediaUrl: string | null;
  mediaType: "image" | "video" | null;
  mediaMime: string | null;
  mediaPosterUrl: string | null;
  author: UserPayload;
  room: RoomPayload | null;
}

export type PostShareResultPayload =
  | {
      recipientUserId: number;
      recipient: UserPayload;
      status: "sent";
      conversationId: number;
      messageId: number;
    }
  | {
      recipientUserId: number;
      status: "failed";
      error: string;
    };

export interface RoomDeletePayload {
  slug: string;
  deletedAt: string;
}

export interface RoomAccessRequestPayload {
  id: number;
  status: RoomAccessRequestStatus;
  createdAt: string | null;
  updatedAt: string | null;
  reviewedAt: string | null;
  requester: UserPayload;
  reviewedBy: UserPayload | null;
}

interface ContentCapabilities extends ProfileSchemaCapabilities {
  hasNotifications: boolean;
  hasUserPreferences: boolean;
  hasConversations: boolean;
  hasConversationMembers: boolean;
  hasMessages: boolean;
  hasMessageAttachments: boolean;
  hasRoomAccessRequests: boolean;
  hasRoomRulesVersionColumn: boolean;
  hasRoomRuleAcceptances: boolean;
  hasRoomInvitations: boolean;
}

interface CountRow extends RowDataPacket {
  table_count?: number | string | null;
  column_count?: number | string | null;
}

interface IdRow extends RowDataPacket {
  id: number | string;
}

interface ActiveProfileRow extends RowDataPacket {
  user_id: number | string;
  visibility: string | null;
}

interface BlockStateRow extends RowDataPacket {
  viewer_blocks_target: number | string | boolean | null;
  target_blocks_viewer: number | string | boolean | null;
}

interface SocialCountRow extends RowDataPacket {
  follower_count: number | string | null;
  following_count: number | string | null;
  moot_count: number | string | null;
}

interface RelationshipRow extends RowDataPacket {
  is_following: number | string | boolean | null;
  is_followed_by: number | string | boolean | null;
  is_blocked: number | string | boolean | null;
  is_blocked_by: number | string | boolean | null;
  is_muted: number | string | boolean | null;
}

interface StarCountRow extends RowDataPacket {
  star_count: number | string | null;
}

interface PendingRequestRow extends RowDataPacket {
  pending: number | string | boolean | null;
}

interface FollowRequestRow extends RowDataPacket {
  id: number | string;
  requester_id: number | string;
  target_user_id: number | string;
}

interface PostRecordRow extends RowDataPacket {
  id: number | string;
  author_id: number | string;
  room_id: number | string | null;
  parent_id?: number | string | null;
  status: string | null;
  mood?: string | null;
}

interface DeletedPostRow extends RowDataPacket {
  deleted_at: string | null;
}

interface ReactionCountRow extends RowDataPacket {
  glow_count: number | string | null;
  echo_count: number | string | null;
  hush_count: number | string | null;
}

interface LikeCountRow extends RowDataPacket {
  like_count: number | string | null;
  liked_by_current_user: number | string | null;
}

interface ReblogCountRow extends RowDataPacket {
  reblog_count: number | string | null;
  reblogged_by_me: number | string | boolean | null;
}

interface TextEntityRow extends RowDataPacket {
  id: number | string;
  entity_type: string;
  entity_start: number | string;
  entity_length: number | string;
  text_value: string;
  url: string | null;
  card_json: string | null;
  target_user_id: number | string | null;
  target_handle: string | null;
  target_display_name: string | null;
  target_avatar_url: string | null;
}

interface MentionTargetRow extends RowDataPacket {
  id: number | string;
  handle: string;
}

interface NotificationPreferenceRow extends RowDataPacket {
  notification_preferences_json: string | null;
}

interface RoomRecordRow extends RowDataPacket {
  id: number | string;
  slug: string;
  name: string;
  summary: string | null;
  mood: string | null;
  rules: string | null;
  rules_version: number | string;
  visibility: string;
  created_by: number | string | null;
  deleted_at: string | null;
}

interface RoomMembershipRow extends RowDataPacket {
  id: number | string;
  room_id: number | string;
  user_id: number | string;
  role: string | null;
  muted_at: string | null;
  banned_at: string | null;
}

interface UserRow extends RowDataPacket {
  user_id: number | string;
  handle: string;
  display_name: string | null;
  avatar_url: string | null;
}

interface RoomAccessRequestRow extends RowDataPacket {
  id: number | string;
  status: string | null;
  reviewed_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  requester_user_id: number | string;
  requester_handle: string;
  requester_display_name: string | null;
  requester_avatar_url: string | null;
  reviewer_user_id: number | string | null;
  reviewer_handle: string | null;
  reviewer_display_name: string | null;
  reviewer_avatar_url: string | null;
}

interface RoomInvitationRow extends RowDataPacket {
  id: number | string;
  status: string | null;
  invited_by: number | string | null;
}

interface ConversationRow extends RowDataPacket {
  id: number | string;
}

const reactionTypes = ["glow", "echo", "hush"] as const;
export function createContentMutationsRepository(
  pool: Pool,
  options: ContentMutationsRepositoryOptions,
): ContentMutationsRepository {
  return new MysqlContentMutationsRepository(pool, options);
}

class MysqlContentMutationsRepository implements ContentMutationsRepository {
  private capabilities?: Promise<ContentCapabilities>;

  constructor(
    private readonly pool: Pool,
    private readonly options: ContentMutationsRepositoryOptions,
  ) {}

  async followProfile(handle: string, viewerUserId: number): Promise<FollowRelationshipPayload> {
    const capabilities = await this.schemaCapabilities();
    this.requireTable(capabilities.hasUserFollows, "Follow storage is not ready. Run pending migrations.");
    const target = await this.activeProfileForFollow(handle, capabilities);
    const targetUserId = target.userId;

    if (viewerUserId === targetUserId) {
      throw new ContentRouteError("You cannot follow yourself.", 422);
    }

    await this.rejectBlockedFollow(viewerUserId, targetUserId, capabilities);

    if (target.visibility === "private" && !(await this.profileIsFollowing(viewerUserId, targetUserId))) {
      this.requireTable(capabilities.hasUserFollowRequests, "Follow request storage is not ready. Run pending migrations.");
      await this.pool.execute<ResultSetHeader>(
        `INSERT INTO user_follow_requests (requester_id, target_user_id, status)
         VALUES (?, ?, 'pending')
         ON DUPLICATE KEY UPDATE
           status = IF(status = 'approved', status, 'pending'),
           updated_at = CURRENT_TIMESTAMP()`,
        [viewerUserId, targetUserId],
      );

      return this.followRelationshipResponse(targetUserId, viewerUserId, capabilities);
    }

    const [insert] = await this.pool.execute<ResultSetHeader>(
      `INSERT IGNORE INTO user_follows (follower_id, following_id)
       VALUES (?, ?)`,
      [viewerUserId, targetUserId],
    );

    if (insert.affectedRows > 0) {
      await this.createNotification(targetUserId, viewerUserId, "follow", null, null, null, true, capabilities);

      if (await this.isMutualFollow(viewerUserId, targetUserId)) {
        await this.createNotification(viewerUserId, targetUserId, "moot", null, null, null, true, capabilities);
        await this.createNotification(targetUserId, viewerUserId, "moot", null, null, null, true, capabilities);
      }
    }

    return this.followRelationshipResponse(targetUserId, viewerUserId, capabilities);
  }

  async unfollowProfile(handle: string, viewerUserId: number): Promise<FollowRelationshipPayload> {
    const capabilities = await this.schemaCapabilities();
    this.requireTable(capabilities.hasUserFollows, "Follow storage is not ready. Run pending migrations.");
    const targetUserId = (await this.activeProfileForFollow(handle, capabilities)).userId;

    if (viewerUserId === targetUserId) {
      throw new ContentRouteError("You cannot unfollow yourself.", 422);
    }

    await this.pool.execute<ResultSetHeader>(
      `DELETE FROM user_follows
       WHERE follower_id = ?
         AND following_id = ?`,
      [viewerUserId, targetUserId],
    );

    if (capabilities.hasUserFollowRequests) {
      await this.pool.execute<ResultSetHeader>(
        `UPDATE user_follow_requests
         SET status = 'canceled',
             updated_at = CURRENT_TIMESTAMP()
         WHERE requester_id = ?
           AND target_user_id = ?
           AND status = 'pending'`,
        [viewerUserId, targetUserId],
      );
    }

    return this.followRelationshipResponse(targetUserId, viewerUserId, capabilities);
  }

  async blockProfile(handle: string, viewerUserId: number): Promise<ProfileControlPayload> {
    const capabilities = await this.schemaCapabilities();
    this.requireTable(capabilities.hasUserFollows, "Follow storage is not ready. Run pending migrations.");
    this.requireTable(capabilities.hasUserBlocks, "Block storage is not ready. Run pending migrations.");
    const targetUserId = (await this.activeProfileForFollow(handle, capabilities)).userId;

    if (viewerUserId === targetUserId) {
      throw new ContentRouteError("You cannot block yourself.", 422);
    }

    await this.withTransaction(async (connection) => {
      await connection.execute<ResultSetHeader>(
        `INSERT IGNORE INTO user_blocks (blocker_id, blocked_id)
         VALUES (?, ?)`,
        [viewerUserId, targetUserId],
      );
      await connection.execute<ResultSetHeader>(
        `DELETE FROM user_follows
         WHERE (follower_id = ? AND following_id = ?)
            OR (follower_id = ? AND following_id = ?)`,
        [viewerUserId, targetUserId, targetUserId, viewerUserId],
      );
    });

    return this.profileControlResponse(targetUserId, viewerUserId, capabilities);
  }

  async unblockProfile(handle: string, viewerUserId: number): Promise<ProfileControlPayload> {
    const capabilities = await this.schemaCapabilities();
    this.requireTable(capabilities.hasUserBlocks, "Block storage is not ready. Run pending migrations.");
    const targetUserId = (await this.activeProfileForFollow(handle, capabilities)).userId;

    if (viewerUserId === targetUserId) {
      throw new ContentRouteError("You cannot unblock yourself.", 422);
    }

    await this.pool.execute<ResultSetHeader>(
      `DELETE FROM user_blocks
       WHERE blocker_id = ?
         AND blocked_id = ?`,
      [viewerUserId, targetUserId],
    );

    return this.profileControlResponse(targetUserId, viewerUserId, capabilities);
  }

  async muteProfile(handle: string, viewerUserId: number): Promise<ProfileControlPayload> {
    const capabilities = await this.schemaCapabilities();
    this.requireTable(capabilities.hasUserMutes, "Mute storage is not ready. Run pending migrations.");
    const targetUserId = (await this.activeProfileForFollow(handle, capabilities)).userId;

    if (viewerUserId === targetUserId) {
      throw new ContentRouteError("You cannot mute yourself.", 422);
    }

    await this.pool.execute<ResultSetHeader>(
      `INSERT IGNORE INTO user_mutes (muter_id, muted_id)
       VALUES (?, ?)`,
      [viewerUserId, targetUserId],
    );

    return this.profileControlResponse(targetUserId, viewerUserId, capabilities);
  }

  async unmuteProfile(handle: string, viewerUserId: number): Promise<ProfileControlPayload> {
    const capabilities = await this.schemaCapabilities();
    this.requireTable(capabilities.hasUserMutes, "Mute storage is not ready. Run pending migrations.");
    const targetUserId = (await this.activeProfileForFollow(handle, capabilities)).userId;

    if (viewerUserId === targetUserId) {
      throw new ContentRouteError("You cannot unmute yourself.", 422);
    }

    await this.pool.execute<ResultSetHeader>(
      `DELETE FROM user_mutes
       WHERE muter_id = ?
         AND muted_id = ?`,
      [viewerUserId, targetUserId],
    );

    return this.profileControlResponse(targetUserId, viewerUserId, capabilities);
  }

  async starProfile(handle: string, viewerUserId: number): Promise<ProfileStarPayload> {
    const capabilities = await this.schemaCapabilities();
    this.requireTable(capabilities.hasProfileStars, "Profile star storage is not ready. Run pending migrations.");
    const targetUserId = (await this.activeProfileForFollow(handle, capabilities)).userId;

    if (viewerUserId === targetUserId) {
      throw new ContentRouteError("You cannot star yourself.", 422);
    }

    await this.rejectBlockedStar(viewerUserId, targetUserId, capabilities);
    await this.pool.execute<ResultSetHeader>(
      `INSERT IGNORE INTO profile_stars (starrer_id, starred_user_id)
       VALUES (?, ?)`,
      [viewerUserId, targetUserId],
    );

    return this.profileStarResponse(targetUserId, viewerUserId, capabilities);
  }

  async unstarProfile(handle: string, viewerUserId: number): Promise<ProfileStarPayload> {
    const capabilities = await this.schemaCapabilities();
    this.requireTable(capabilities.hasProfileStars, "Profile star storage is not ready. Run pending migrations.");
    const targetUserId = (await this.activeProfileForFollow(handle, capabilities)).userId;

    if (viewerUserId === targetUserId) {
      throw new ContentRouteError("You cannot unstar yourself.", 422);
    }

    await this.pool.execute<ResultSetHeader>(
      `DELETE FROM profile_stars
       WHERE starrer_id = ?
         AND starred_user_id = ?`,
      [viewerUserId, targetUserId],
    );

    return this.profileStarResponse(targetUserId, viewerUserId, capabilities);
  }

  async removeFollower(handle: string, viewerUserId: number): Promise<RemoveFollowerPayload> {
    const capabilities = await this.schemaCapabilities();
    this.requireTable(capabilities.hasUserFollows, "Follow storage is not ready. Run pending migrations.");
    const targetUserId = (await this.activeProfileForFollow(handle, capabilities)).userId;

    if (viewerUserId === targetUserId) {
      throw new ContentRouteError("You cannot remove yourself as a follower.", 422);
    }

    const [result] = await this.pool.execute<ResultSetHeader>(
      `DELETE FROM user_follows
       WHERE follower_id = ?
         AND following_id = ?`,
      [targetUserId, viewerUserId],
    );

    return {
      removedFollower: result.affectedRows > 0,
      relationship: await this.followRelationshipResponse(targetUserId, viewerUserId, capabilities),
    };
  }

  async approveFollowRequest(requestId: number, viewerUserId: number): Promise<FollowRequestApprovePayload> {
    const capabilities = await this.schemaCapabilities();
    this.requireTable(
      capabilities.hasUserFollowRequests && capabilities.hasUserFollows,
      "Follow request storage is not ready. Run pending migrations.",
    );
    const request = await this.followRequestForOwner(requestId, viewerUserId);

    await this.withTransaction(async (connection) => {
      await connection.execute<ResultSetHeader>(
        `UPDATE user_follow_requests
         SET status = 'approved',
             updated_at = CURRENT_TIMESTAMP()
         WHERE id = ?`,
        [requestId],
      );
      await connection.execute<ResultSetHeader>(
        `INSERT IGNORE INTO user_follows (follower_id, following_id)
         VALUES (?, ?)`,
        [numberValue(request.requester_id), viewerUserId],
      );
    });

    return { approved: true };
  }

  async denyFollowRequest(requestId: number, viewerUserId: number): Promise<FollowRequestDenyPayload> {
    const capabilities = await this.schemaCapabilities();
    this.requireTable(
      capabilities.hasUserFollowRequests && capabilities.hasUserFollows,
      "Follow request storage is not ready. Run pending migrations.",
    );
    await this.followRequestForOwner(requestId, viewerUserId);
    await this.pool.execute<ResultSetHeader>(
      `UPDATE user_follow_requests
       SET status = 'denied',
           updated_at = CURRENT_TIMESTAMP()
       WHERE id = ?`,
      [requestId],
    );

    return { denied: true };
  }

  async createPost(session: RequestSession, body: Record<string, unknown>): Promise<PostPayload> {
    const capabilities = await this.schemaCapabilities();
    const postBody = validatePostBody(body.body);
    const roomId = await this.resolveRoomId(body, capabilities, session);
    const parentId = await this.resolveParentId(body.parentId ?? body.parent_id, capabilities, session);
    const mood = validateOptionalText(body.mood, 80, "Mood") ?? "glinda";
    const attachments = validatePostAttachments(body);
    const media = legacyPostMediaFromAttachments(attachments);
    const publicId = capabilities.hasPostPublicIdColumn ? await this.generatePostPublicId() : null;
    this.requirePostAttachmentStorage(attachments, capabilities);
    const insertColumns = ["author_id", "room_id", "parent_id", "body"];
    const insertValues: Array<number | string | null> = [
      session.userId,
      roomId,
      parentId,
      postBody,
    ];

    if (capabilities.hasPostBodyFormatColumn) {
      insertColumns.push("body_format");
      insertValues.push("markdown");
    }

    if (capabilities.hasPostContentVersionColumn) {
      insertColumns.push("content_version");
      insertValues.push(3);
    }

    insertColumns.push("mood", "media_url", "visibility", "status");
    insertValues.push(
      mood,
      media.url,
      "public",
      "published",
    );

    if (capabilities.hasPostMediaMetadataColumns) {
      insertColumns.push("media_type", "media_mime", "media_poster_url");
      insertValues.push(media.type, media.mime, media.posterUrl);
    }

    if (publicId !== null) {
      insertColumns.unshift("public_id");
      insertValues.unshift(publicId);
    }

    const placeholders = insertColumns.map(() => "?").join(", ");
    const [result] = await this.pool.execute<ResultSetHeader>(
      `INSERT INTO posts (${insertColumns.join(", ")})
       VALUES (${placeholders})`,
      insertValues,
    );
    const postId = result.insertId;

    await this.replacePostAttachments(postId, attachments, capabilities);
    await this.storeTextEntitiesForPost(postId, postBody, session.userId, roomId, postId, capabilities);

    return this.fetchPostPayloadById(postId, session.userId, capabilities);
  }

  async createReply(session: RequestSession, postId: number, body: Record<string, unknown>): Promise<PostPayload> {
    const capabilities = await this.schemaCapabilities();
    const parent = await this.fetchReplyablePostRecord(postId, capabilities, session);

    if (parent === null) {
      throw new ContentRouteError("Post not found.", 404);
    }

    if (parent.room_id !== null) {
      await this.requireRoomPostPermission(numberValue(parent.room_id), session, capabilities);
    }

    const postBody = validatePostBody(body.body);
    const attachments = validatePostAttachments(body);
    const media = legacyPostMediaFromAttachments(attachments);
    const roomId = nullableNumberValue(parent.room_id);
    const publicId = capabilities.hasPostPublicIdColumn ? await this.generatePostPublicId() : null;
    this.requirePostAttachmentStorage(attachments, capabilities);
    const insertColumns = ["author_id", "room_id", "parent_id", "body"];
    const insertValues: Array<number | string | null> = [
      session.userId,
      roomId,
      postId,
      postBody,
    ];

    if (capabilities.hasPostBodyFormatColumn) {
      insertColumns.push("body_format");
      insertValues.push("markdown");
    }

    if (capabilities.hasPostContentVersionColumn) {
      insertColumns.push("content_version");
      insertValues.push(3);
    }

    insertColumns.push("mood", "media_url", "visibility", "status");
    insertValues.push(
      parent.mood ?? "glinda",
      media.url,
      "public",
      "published",
    );

    if (capabilities.hasPostMediaMetadataColumns) {
      insertColumns.push("media_type", "media_mime", "media_poster_url");
      insertValues.push(media.type, media.mime, media.posterUrl);
    }

    if (publicId !== null) {
      insertColumns.unshift("public_id");
      insertValues.unshift(publicId);
    }

    const [result] = await this.pool.execute<ResultSetHeader>(
      `INSERT INTO posts (${insertColumns.join(", ")})
       VALUES (${insertColumns.map(() => "?").join(", ")})`,
      insertValues,
    );
    const replyId = result.insertId;

    await this.replacePostAttachments(replyId, attachments, capabilities);
    await this.storeTextEntitiesForPost(replyId, postBody, session.userId, roomId, replyId, capabilities);

    const parentAuthorId = numberValue(parent.author_id);

    if (parentAuthorId !== session.userId) {
      await this.createNotification(
        parentAuthorId,
        session.userId,
        "reply",
        postId,
        roomId,
        { replyId },
        false,
        capabilities,
      );
    }

    return this.fetchPostPayloadById(replyId, session.userId, capabilities);
  }

  async updatePost(session: RequestSession, postId: number, body: Record<string, unknown>): Promise<PostPayload> {
    const capabilities = await this.schemaCapabilities();
    const post = await this.fetchPostRecord(postId);

    if (post === null) {
      throw new ContentRouteError("Post not found.", 404);
    }

    const updates: string[] = [];
    const params: Array<number | string | null> = [];
    const isModerator = isModeratorSession(session);
    const isAuthor = numberValue(post.author_id) === session.userId;
    let updatedPostBody: string | null = null;
    let updatedRoomId = nullableNumberValue(post.room_id);
    let updatedAttachments: ValidatedPostAttachment[] | null = null;

    if ("body" in body) {
      if (!isAuthor) {
        throw new ContentRouteError("Only the author can edit this post.", 403);
      }

      if (post.status === "removed") {
        throw new ContentRouteError("Removed posts cannot be edited.", 409);
      }

      updatedPostBody = validatePostBody(body.body);
      updates.push("body = ?");
      params.push(updatedPostBody);
    }

    if ("roomSlug" in body || "roomId" in body || "room_id" in body) {
      if (!isAuthor) {
        throw new ContentRouteError("Only the author can move this post.", 403);
      }

      updatedRoomId = await this.resolveRoomId(body, capabilities, session);
      updates.push("room_id = ?");
      params.push(updatedRoomId);
    }

    if ("parentId" in body || "parent_id" in body) {
      if (!isAuthor) {
        throw new ContentRouteError("Only the author can update the parent post.", 403);
      }

      const parentId = await this.resolveParentId(body.parentId ?? body.parent_id, capabilities, session);

      if (parentId === postId) {
        throw new ContentRouteError("A post cannot be its own parent.", 422);
      }

      updates.push("parent_id = ?");
      params.push(parentId);
    }

    if (
      "mediaUrl" in body ||
      "media_url" in body ||
      "mediaType" in body ||
      "media_type" in body ||
      "mediaMime" in body ||
      "media_mime" in body ||
      "mediaPosterUrl" in body ||
      "media_poster_url" in body ||
      "attachments" in body
    ) {
      if (!isAuthor) {
        throw new ContentRouteError("Only the author can update this post media.", 403);
      }

      updatedAttachments = validatePostAttachments(body);
      this.requirePostAttachmentStorage(updatedAttachments, capabilities);
      const media = legacyPostMediaFromAttachments(updatedAttachments);
      updates.push("media_url = ?");
      params.push(media.url);

      if (capabilities.hasPostMediaMetadataColumns) {
        updates.push("media_type = ?");
        params.push(media.type);
        updates.push("media_mime = ?");
        params.push(media.mime);
        updates.push("media_poster_url = ?");
        params.push(media.posterUrl);
      }
    }

    if ("status" in body) {
      if (!isModerator) {
        throw new ContentRouteError("Only moderators can change post status.", 403);
      }

      const status = validatePostStatus(body.status);

      if (status === "removed") {
        updates.push("deleted_at = CURRENT_TIMESTAMP()");
      } else if (post.status === "removed") {
        updates.push("deleted_at = NULL");
      }

      updates.push("status = ?");
      params.push(status);
    }

    if (updates.length === 0) {
      throw new ContentRouteError("No supported post updates were provided.", 422);
    }

    if (!isAuthor && !isModerator) {
      throw new ContentRouteError("You cannot update this post.", 403);
    }

    params.push(postId);
    await this.pool.execute<ResultSetHeader>(
      `UPDATE posts
       SET ${updates.join(", ")},
           updated_at = CURRENT_TIMESTAMP()
       WHERE id = ?`,
      params,
    );

    if (updatedPostBody !== null) {
      await this.storeTextEntitiesForPost(postId, updatedPostBody, session.userId, updatedRoomId, postId, capabilities);
    }

    if (updatedAttachments !== null) {
      await this.replacePostAttachments(postId, updatedAttachments, capabilities);
    }

    return this.fetchPostPayloadById(postId, session.userId, capabilities);
  }

  async deletePost(session: RequestSession, postId: number): Promise<PostDeletePayload> {
    const post = await this.fetchPostRecord(postId);

    if (post === null) {
      throw new ContentRouteError("Post not found.", 404);
    }

    if (numberValue(post.author_id) !== session.userId && !isModeratorSession(session)) {
      throw new ContentRouteError("You cannot delete this post.", 403);
    }

    await this.pool.execute<ResultSetHeader>(
      `UPDATE posts
       SET status = 'removed',
           deleted_at = CURRENT_TIMESTAMP(),
           updated_at = CURRENT_TIMESTAMP()
       WHERE id = ?`,
      [postId],
    );
    const [rows] = await this.pool.execute<DeletedPostRow[]>(
      `SELECT deleted_at
       FROM posts
       WHERE id = ?
       LIMIT 1`,
      [postId],
    );

    return {
      id: postId,
      status: "removed",
      deletedAt: rows[0]?.deleted_at ?? null,
    };
  }

  async likePost(postId: number, viewerUserId: number): Promise<LikePayload> {
    const capabilities = await this.schemaCapabilities();
    const post = await this.fetchReactablePostRecord(postId, capabilities, { userId: viewerUserId, role: null });

    if (post === null) {
      throw new ContentRouteError("Post not found.", 404);
    }

    const [insert] = await this.pool.execute<ResultSetHeader>(
      `INSERT IGNORE INTO post_reactions (post_id, user_id, type)
       VALUES (?, ?, 'glow')`,
      [postId, viewerUserId],
    );

    if (insert.affectedRows > 0) {
      await this.createNotification(
        numberValue(post.author_id),
        viewerUserId,
        "like",
        postId,
        nullableNumberValue(post.room_id),
        null,
        true,
        capabilities,
      );
    }

    return this.likePayloadForPost(postId, viewerUserId);
  }

  async unlikePost(postId: number, viewerUserId: number): Promise<LikePayload> {
    const capabilities = await this.schemaCapabilities();

    await this.requireReactablePost(postId, capabilities, { userId: viewerUserId, role: null });
    await this.pool.execute<ResultSetHeader>(
      `DELETE FROM post_reactions
       WHERE post_id = ?
         AND user_id = ?
         AND type = 'glow'`,
      [postId, viewerUserId],
    );

    return this.likePayloadForPost(postId, viewerUserId);
  }

  async reblogPost(postId: number, session: RequestSession): Promise<ReblogPayload> {
    const capabilities = await this.schemaCapabilities();
    this.requireTable(capabilities.hasPostReblogs, "Reblog storage is not ready. Run pending migrations.");
    const post = await this.fetchRebloggablePostRecord(postId, capabilities, session);

    if (post === null) {
      throw new ContentRouteError("Post not found.", 404);
    }

    const postAuthorId = numberValue(post.author_id);

    if (postAuthorId === session.userId) {
      throw new ContentRouteError("You cannot reblog your own post.", 409);
    }

    const [insert] = await this.pool.execute<ResultSetHeader>(
      `INSERT IGNORE INTO post_reblogs (post_id, user_id)
       VALUES (?, ?)`,
      [postId, session.userId],
    );

    if (insert.affectedRows > 0) {
      await this.createNotification(
        postAuthorId,
        session.userId,
        "reblog",
        postId,
        nullableNumberValue(post.room_id),
        null,
        true,
        capabilities,
      );
    }

    return this.reblogPayloadForPost(postId, session.userId);
  }

  async unreblogPost(postId: number, session: RequestSession): Promise<ReblogPayload> {
    const capabilities = await this.schemaCapabilities();
    this.requireTable(capabilities.hasPostReblogs, "Reblog storage is not ready. Run pending migrations.");
    const post = await this.fetchRebloggablePostRecord(postId, capabilities, session);

    if (post === null) {
      throw new ContentRouteError("Post not found.", 404);
    }

    await this.pool.execute<ResultSetHeader>(
      `DELETE FROM post_reblogs
       WHERE post_id = ?
         AND user_id = ?`,
      [postId, session.userId],
    );

    return this.reblogPayloadForPost(postId, session.userId);
  }

  async reactToPost(postId: number, viewerUserId: number, body: Record<string, unknown>): Promise<ReactionPayload> {
    const capabilities = await this.schemaCapabilities();
    const post = await this.fetchReactablePostRecord(postId, capabilities, { userId: viewerUserId, role: null });

    if (post === null) {
      throw new ContentRouteError("Post not found.", 404);
    }

    const type = validateReactionType(body.type);
    const [insert] = await this.pool.execute<ResultSetHeader>(
      `INSERT IGNORE INTO post_reactions (post_id, user_id, type)
       VALUES (?, ?, ?)`,
      [postId, viewerUserId, type],
    );

    if (type === "glow" && insert.affectedRows > 0) {
      await this.createNotification(
        numberValue(post.author_id),
        viewerUserId,
        "like",
        postId,
        nullableNumberValue(post.room_id),
        null,
        true,
        capabilities,
      );
    }

    return {
      postId,
      reactions: await this.reactionCountsForPost(postId),
    };
  }

  async deletePostReaction(postId: number, viewerUserId: number, type: string): Promise<ReactionPayload> {
    const capabilities = await this.schemaCapabilities();
    await this.requireReactablePost(postId, capabilities, { userId: viewerUserId, role: null });
    const reactionType = validateReactionType(safeDecodeURIComponent(type));

    await this.pool.execute<ResultSetHeader>(
      `DELETE FROM post_reactions
       WHERE post_id = ?
         AND user_id = ?
         AND type = ?`,
      [postId, viewerUserId, reactionType],
    );

    return {
      postId,
      reactions: await this.reactionCountsForPost(postId),
    };
  }

  async sharePostToMessages(
    identifier: string,
    viewerUserId: number,
    body: Record<string, unknown>,
  ): Promise<PostShareMessagesPayload> {
    const capabilities = await this.schemaCapabilities();
    this.requireTable(
      capabilities.hasConversations && capabilities.hasConversationMembers && capabilities.hasMessages,
      "Chat storage is not ready. Run pending migrations.",
    );
    this.requireTable(capabilities.hasUserFollows, "Follow storage is not ready. Run pending migrations.");
    this.requireTable(capabilities.hasMessageAttachments, "Message attachment storage is not ready. Run pending migrations.");
    await this.requireRichMessageAttachmentStorage();

    const post = await this.fetchPostPayloadByIdentifier(identifier, viewerUserId, capabilities);

    if (post === null) {
      throw new ContentRouteError("Post not found.", 404);
    }

    const recipientIds = validatePostShareRecipientIds(body.recipientUserIds);
    const note = validatePostShareNote(body.note);
    const messageBody = note ?? "";
    const results: PostShareResultPayload[] = [];
    let sentCount = 0;

    for (const recipientUserId of recipientIds) {
      const recipient = await this.fetchShareRecipient(recipientUserId);

      if (recipient === null) {
        results.push(postShareFailedResult(recipientUserId, "Profile not found."));
        continue;
      }

      if (recipientUserId === viewerUserId) {
        results.push(postShareFailedResult(recipientUserId, "Choose another member."));
        continue;
      }

      const blockState = await this.userPairBlockState(viewerUserId, recipientUserId, capabilities);

      if (blockState.viewerBlocksTarget) {
        results.push(postShareFailedResult(recipientUserId, "Unblock this member before messaging."));
        continue;
      }

      if (blockState.targetBlocksViewer) {
        results.push(postShareFailedResult(recipientUserId, "You cannot message this member."));
        continue;
      }

      if (!(await this.isMutualFollow(viewerUserId, recipientUserId))) {
        results.push(postShareFailedResult(recipientUserId, "Follow each other to chat."));
        continue;
      }

      const { conversationId, messageId } = await this.createDirectNativeShareMessage(
        viewerUserId,
        recipientUserId,
        messageBody,
        { postId: post.id },
      );

      await this.createNotification(recipientUserId, viewerUserId, "message", null, null, { conversationId, messageId }, false, capabilities);
      sentCount++;
      results.push({
        recipientUserId,
        recipient,
        status: "sent",
        conversationId,
        messageId,
      });
    }

    return {
      post: postShareSummaryPayload(post, this.options.publicBaseUrl),
      results,
      sentCount,
      failedCount: results.length - sentCount,
    };
  }

  async shareRoomToMessages(
    slug: string,
    session: RequestSession,
    body: Record<string, unknown>,
  ): Promise<RoomShareMessagesPayload> {
    const capabilities = await this.schemaCapabilities();
    this.requireTable(
      capabilities.hasConversations && capabilities.hasConversationMembers && capabilities.hasMessages,
      "Chat storage is not ready. Run pending migrations.",
    );
    this.requireTable(capabilities.hasUserFollows, "Follow storage is not ready. Run pending migrations.");
    this.requireTable(capabilities.hasMessageAttachments, "Message attachment storage is not ready. Run pending migrations.");
    await this.requireRichMessageAttachmentStorage();
    this.requireRoomStorage(capabilities);

    const roomRecord = await this.roomRecordBySlug(slug);

    if (
      roomRecord === null ||
      !(await this.roomCanViewPostsForViewer(roomRecord, this.roomViewerFromSession(session)))
    ) {
      throw new ContentRouteError("Room not found.", 404);
    }

    const room = await this.fetchRoomBySlugForSession(stringValue(roomRecord.slug), session, capabilities);
    const recipientIds = validatePostShareRecipientIds(body.recipientUserIds);
    const note = validatePostShareNote(body.note);
    const results: PostShareResultPayload[] = [];
    let sentCount = 0;

    for (const recipientUserId of recipientIds) {
      const recipient = await this.fetchShareRecipient(recipientUserId);

      if (recipient === null) {
        results.push(postShareFailedResult(recipientUserId, "Profile not found."));
        continue;
      }

      if (recipientUserId === session.userId) {
        results.push(postShareFailedResult(recipientUserId, "Choose another member."));
        continue;
      }

      const blockState = await this.userPairBlockState(session.userId, recipientUserId, capabilities);

      if (blockState.viewerBlocksTarget) {
        results.push(postShareFailedResult(recipientUserId, "Unblock this member before messaging."));
        continue;
      }

      if (blockState.targetBlocksViewer) {
        results.push(postShareFailedResult(recipientUserId, "You cannot message this member."));
        continue;
      }

      if (!(await this.isMutualFollow(session.userId, recipientUserId))) {
        results.push(postShareFailedResult(recipientUserId, "Follow each other to chat."));
        continue;
      }

      const { conversationId, messageId } = await this.createDirectNativeShareMessage(
        session.userId,
        recipientUserId,
        note ?? "",
        { roomId: room.id },
      );

      await this.createNotification(
        recipientUserId,
        session.userId,
        "message",
        null,
        null,
        { conversationId, messageId },
        false,
        capabilities,
      );
      sentCount++;
      results.push({
        recipientUserId,
        recipient,
        status: "sent",
        conversationId,
        messageId,
      });
    }

    return {
      room,
      results,
      sentCount,
      failedCount: results.length - sentCount,
    };
  }

  async createRoom(session: RequestSession, body: Record<string, unknown>): Promise<RoomPayload> {
    const capabilities = await this.schemaCapabilities();

    this.requireRoomStorage(capabilities);
    this.requireRoomThemeStorage(capabilities);
    this.requireRoomRuleAcceptanceStorage(capabilities);
    rejectDeprecatedRoomAccent(body);
    const name = roomText(body.name, "Name", 2, 80);
    const slug = roomSlugFromValue(body.slug, name);
    const summary = roomText(bodyValue(body, "summary", "description"), "Summary", 5, 500);
    const mood = roomOptionalToken(body.mood, "Mood", 40);
    const theme = roomThemeValues(body, true) ?? { theme: null, themeConfigJson: null };
    const iconUrl = roomUploadUrl(bodyValue(body, "iconUrl", "icon_url"), "Icon URL");
    const bannerUrl = roomUploadUrl(bodyValue(body, "bannerUrl", "banner_url"), "Banner URL");
    const rules = roomOptionalText(body.rules, "Room rules", 3000);
    const visibility = roomVisibility(body.visibility ?? "public");

    try {
      await this.withTransaction(async (connection) => {
        const [result] = await connection.execute<ResultSetHeader>(
          `INSERT INTO rooms (slug, name, summary, mood, member_count, is_live, theme, theme_config_json, icon_url, banner_url, rules, visibility, created_by)
           VALUES (?, ?, ?, ?, 1, 0, ?, ?, ?, ?, ?, ?, ?)`,
          [slug, name, summary, mood, theme.theme, theme.themeConfigJson, iconUrl, bannerUrl, rules, visibility, session.userId],
        );
        const roomId = result.insertId;

        await connection.execute<ResultSetHeader>(
          `INSERT INTO room_memberships (room_id, user_id, role)
           VALUES (?, ?, 'owner')`,
          [roomId, session.userId],
        );
        await this.recordRoomRulesAcceptance(roomId, session.userId, 1, connection);
        await this.syncRoomMemberCount(roomId, connection);
        await this.grantOwnerBadgeIfFirstRoom(session.userId, connection, capabilities);
      });
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        throw new ContentRouteError("Room slug is already in use.", 409);
      }

      throw error;
    }

    return this.fetchRoomBySlugForSession(slug, session, capabilities);
  }

  async updateRoom(session: RequestSession, slug: string, body: Record<string, unknown>): Promise<RoomPayload> {
    const capabilities = await this.schemaCapabilities();

    this.requireRoomStorage(capabilities);
    const room = await this.roomRecordBySlug(slug);

    if (room === null) {
      throw new ContentRouteError("Room not found.", 404);
    }

    if (!(await this.roomCanEdit(room, session))) {
      throw new ContentRouteError("You cannot edit this room.", 403);
    }

    const updates: string[] = [];
    const params: Array<number | string | null> = [];
    rejectDeprecatedRoomAccent(body);

    if ("name" in body) {
      updates.push("name = ?");
      params.push(roomText(body.name, "Name", 2, 80));
    }

    if ("summary" in body || "description" in body) {
      updates.push("summary = ?");
      params.push(roomText(bodyValue(body, "summary", "description"), "Summary", 5, 500));
    }

    if ("mood" in body) {
      updates.push("mood = ?");
      params.push(roomOptionalToken(body.mood, "Mood", 40));
    }

    const themeUpdate = roomThemeValues(body, false);
    if (themeUpdate) {
      this.requireRoomThemeStorage(capabilities);
      updates.push("theme = ?");
      params.push(themeUpdate.theme);
      updates.push("theme_config_json = ?");
      params.push(themeUpdate.themeConfigJson);
    }

    if ("iconUrl" in body || "icon_url" in body) {
      updates.push("icon_url = ?");
      params.push(roomUploadUrl(bodyValue(body, "iconUrl", "icon_url"), "Icon URL"));
    }

    if ("bannerUrl" in body || "banner_url" in body) {
      updates.push("banner_url = ?");
      params.push(roomUploadUrl(bodyValue(body, "bannerUrl", "banner_url"), "Banner URL"));
    }

    if ("rules" in body) {
      this.requireRoomRuleAcceptanceStorage(capabilities);
      const nextRules = roomOptionalText(body.rules, "Room rules", 3000);

      if (nextRules !== nullableStringValue(room.rules)) {
        updates.push("rules = ?");
        params.push(nextRules);
        updates.push("rules_version = rules_version + 1");
      }
    }

    if ("visibility" in body) {
      if (!(await this.roomCanManageModerators(room, session))) {
        throw new ContentRouteError("You cannot change room visibility.", 403);
      }

      updates.push("visibility = ?");
      params.push(roomVisibility(body.visibility));
    }

    if (updates.length > 0) {
      params.push(numberValue(room.id));
      await this.pool.execute<ResultSetHeader>(
        `UPDATE rooms
         SET ${updates.join(", ")},
             updated_at = CURRENT_TIMESTAMP()
         WHERE id = ?`,
        params,
      );
    }

    return this.fetchRoomBySlugForSession(room.slug, session, capabilities);
  }

  async deleteRoom(session: RequestSession, slug: string): Promise<RoomDeletePayload> {
    const capabilities = await this.schemaCapabilities();

    this.requireRoomStorage(capabilities);
    const room = await this.roomRecordBySlug(slug);

    if (room === null) {
      throw new ContentRouteError("Room not found.", 404);
    }

    if (!(await this.roomCanDelete(room, session))) {
      throw new ContentRouteError("You cannot delete this room.", 403);
    }

    await this.pool.execute<ResultSetHeader>(
      `UPDATE rooms
       SET deleted_at = CURRENT_TIMESTAMP(),
           visibility = 'private',
           updated_at = CURRENT_TIMESTAMP()
       WHERE id = ?
         AND deleted_at IS NULL`,
      [numberValue(room.id)],
    );

    return {
      slug: room.slug,
      deletedAt: new Date().toISOString(),
    };
  }

  async joinRoom(session: RequestSession, slug: string, body: Record<string, unknown>): Promise<RoomPayload> {
    const capabilities = await this.schemaCapabilities();

    this.requireRoomStorage(capabilities);
    this.requireRoomRuleAcceptanceStorage(capabilities);
    this.requireRoomInvitationStorage(capabilities);
    const acceptedRulesVersion = roomRulesAcceptanceVersion(body);
    let roomSlug = slug;

    await this.withTransaction(async (connection) => {
      const room = await this.roomRecordBySlug(slug, connection, true);

      if (room === null) {
        throw new ContentRouteError("Room not found.", 404);
      }

      const roomId = numberValue(room.id);
      const membership = await this.roomMembershipRecord(roomId, session.userId, connection, true);
      const invitation = await this.roomInvitationRecord(roomId, session.userId, connection, true);

      if (membership === null && !roomInvitationAllowsJoin(room.visibility, invitation?.status ?? null)) {
        throw new ContentRouteError("Room not found.", 404);
      }

      assertCurrentRoomRulesVersion(room, acceptedRulesVersion);

      if (membership !== null && membership.banned_at !== null) {
        throw new ContentRouteError("You cannot join this room.", 403);
      }

      await this.recordRoomRulesAcceptance(roomId, session.userId, acceptedRulesVersion, connection);
      await connection.execute<ResultSetHeader>(
        `INSERT INTO room_memberships (room_id, user_id, role)
         VALUES (?, ?, 'member')
         ON DUPLICATE KEY UPDATE
           role = IF(role IN ('owner', 'moderator'), role, 'member'),
           banned_at = banned_at`,
        [roomId, session.userId],
      );
      if (invitation?.status === "pending") {
        await connection.execute<ResultSetHeader>(
          `UPDATE room_invitations
           SET status = 'accepted',
               accepted_at = UTC_TIMESTAMP(),
               revoked_at = NULL,
               updated_at = CURRENT_TIMESTAMP()
           WHERE id = ?
             AND status = 'pending'`,
          [numberValue(invitation.id)],
        );

        if (capabilities.hasRoomAccessRequests) {
          await connection.execute<ResultSetHeader>(
            `UPDATE room_access_requests
             SET status = 'approved',
                 reviewed_by = ?,
                 reviewed_at = UTC_TIMESTAMP(),
                 updated_at = CURRENT_TIMESTAMP()
             WHERE room_id = ?
               AND requester_id = ?
               AND status <> 'approved'`,
            [nullableNumberValue(invitation.invited_by), roomId, session.userId],
          );
        }
      }
      await this.syncRoomMemberCount(roomId, connection);
      roomSlug = room.slug;
    });

    return this.fetchRoomBySlugForSession(roomSlug, session, capabilities);
  }

  async leaveRoom(session: RequestSession, slug: string): Promise<RoomPayload> {
    const capabilities = await this.schemaCapabilities();

    this.requireRoomStorage(capabilities);
    let roomSlug = slug;

    await this.withTransaction(async (connection) => {
      const room = await this.roomRecordBySlug(slug, connection, true);

      if (room === null) {
        throw new ContentRouteError("Room not found.", 404);
      }

      const roomId = numberValue(room.id);
      const membership = await this.roomMembershipRecord(roomId, session.userId, connection, true);

      if (membership === null || membership.banned_at !== null) {
        roomSlug = room.slug;
        return;
      }

      if (membership.role === "owner") {
        throw new ContentRouteError("Room owners cannot leave until ownership transfer exists.", 422);
      }

      await connection.execute<ResultSetHeader>(
        `DELETE FROM room_memberships
         WHERE room_id = ?
           AND user_id = ?`,
        [roomId, session.userId],
      );

      if (capabilities.hasRoomInvitations) {
        await connection.execute<ResultSetHeader>(
          `UPDATE room_invitations
           SET status = 'pending',
               accepted_at = NULL,
               revoked_at = NULL,
               updated_at = CURRENT_TIMESTAMP()
           WHERE room_id = ?
             AND invitee_id = ?
             AND status = 'accepted'`,
          [roomId, session.userId],
        );
      }

      if (capabilities.hasRoomAccessRequests) {
        await connection.execute<ResultSetHeader>(
          `UPDATE room_access_requests
           SET status = 'canceled',
               reviewed_by = NULL,
               reviewed_at = NULL,
               updated_at = CURRENT_TIMESTAMP()
           WHERE room_id = ?
             AND requester_id = ?
             AND status = 'approved'`,
          [roomId, session.userId],
        );
      }

      await this.syncRoomMemberCount(roomId, connection);
      roomSlug = room.slug;
    });

    return this.fetchRoomBySlugForSession(roomSlug, session, capabilities);
  }

  async requestRoomAccess(session: RequestSession, slug: string, body: Record<string, unknown>): Promise<RoomPayload> {
    const capabilities = await this.schemaCapabilities();

    this.requireRoomStorage(capabilities);
    this.requireTable(capabilities.hasRoomAccessRequests, "Room access request storage is not ready. Run pending migrations.");
    this.requireRoomRuleAcceptanceStorage(capabilities);
    const acceptedRulesVersion = roomRulesAcceptanceVersion(body);
    let roomSlug = slug;

    await this.withTransaction(async (connection) => {
      const room = await this.roomRecordBySlug(slug, connection, true);

      if (room === null || room.visibility !== "invite") {
        throw new ContentRouteError("Room not found.", 404);
      }

      assertCurrentRoomRulesVersion(room, acceptedRulesVersion);
      const roomId = numberValue(room.id);
      const membership = await this.roomMembershipRecord(roomId, session.userId, connection, true);

      if (membership !== null && membership.banned_at !== null) {
        throw new ContentRouteError("You cannot request access to this room.", 403);
      }

      await this.recordRoomRulesAcceptance(roomId, session.userId, acceptedRulesVersion, connection);

      if (membership === null) {
        await connection.execute<ResultSetHeader>(
          `INSERT INTO room_access_requests (room_id, requester_id, status, reviewed_by, reviewed_at)
           VALUES (?, ?, 'pending', NULL, NULL)
           ON DUPLICATE KEY UPDATE
             status = 'pending',
             reviewed_by = NULL,
             reviewed_at = NULL,
             updated_at = CURRENT_TIMESTAMP()`,
          [roomId, session.userId],
        );
      }

      roomSlug = room.slug;
    });

    return this.fetchRoomBySlugForSession(roomSlug, session, capabilities);
  }

  async cancelRoomAccessRequest(session: RequestSession, slug: string): Promise<RoomPayload> {
    const capabilities = await this.schemaCapabilities();

    this.requireRoomStorage(capabilities);
    this.requireTable(capabilities.hasRoomAccessRequests, "Room access request storage is not ready. Run pending migrations.");
    const room = await this.roomRecordBySlug(slug);

    if (room === null || room.visibility !== "invite") {
      throw new ContentRouteError("Room not found.", 404);
    }

    await this.pool.execute<ResultSetHeader>(
      `UPDATE room_access_requests
       SET status = 'canceled',
           updated_at = CURRENT_TIMESTAMP()
       WHERE room_id = ?
         AND requester_id = ?
         AND status = 'pending'`,
      [numberValue(room.id), session.userId],
    );

    return this.fetchRoomBySlugForSession(room.slug, session, capabilities);
  }

  async listRoomAccessRequests(session: RequestSession, slug: string): Promise<RoomAccessRequestPayload[]> {
    const capabilities = await this.schemaCapabilities();

    this.requireRoomStorage(capabilities);
    this.requireTable(capabilities.hasRoomAccessRequests, "Room access request storage is not ready. Run pending migrations.");
    const room = await this.roomRecordBySlug(slug);

    if (room === null) {
      throw new ContentRouteError("Room not found.", 404);
    }

    if (!(await this.roomCanManageMembers(room, session))) {
      throw new ContentRouteError("You cannot manage access for this room.", 403);
    }

    return this.fetchRoomAccessRequests(numberValue(room.id));
  }

  async approveRoomAccessRequest(session: RequestSession, slug: string, requestId: number): Promise<RoomAccessRequestPayload[]> {
    const capabilities = await this.schemaCapabilities();

    this.requireRoomStorage(capabilities);
    this.requireTable(capabilities.hasRoomAccessRequests, "Room access request storage is not ready. Run pending migrations.");
    this.requireRoomRuleAcceptanceStorage(capabilities);
    const room = await this.roomRecordBySlug(slug);

    if (room === null) {
      throw new ContentRouteError("Room not found.", 404);
    }

    if (!(await this.roomCanManageMembers(room, session))) {
      throw new ContentRouteError("You cannot manage access for this room.", 403);
    }

    const roomId = numberValue(room.id);

    await this.withTransaction(async (connection) => {
      const lockedRoom = await this.roomRecordBySlug(slug, connection, true);

      if (lockedRoom === null) {
        throw new ContentRouteError("Room not found.", 404);
      }

      const request = await this.roomAccessRequestRecord(roomId, requestId, connection, true, true);

      if (request === null) {
        throw new ContentRouteError("Access request not found.", 404);
      }

      const requesterId = numberValue(request.requester_user_id);
      const rulesVersion = Math.max(1, numberValue(lockedRoom.rules_version));

      if (!(await this.roomRulesAcceptanceExists(roomId, requesterId, rulesVersion, connection))) {
        throw new ContentRouteError("The requester must accept the current room rules before approval.", 409);
      }

      const existing = await this.roomMembershipRecord(roomId, requesterId, connection, true);

      if (existing !== null && existing.banned_at !== null) {
        throw new ContentRouteError("Banned members cannot be approved.", 422);
      }

      await connection.execute<ResultSetHeader>(
        `INSERT INTO room_memberships (room_id, user_id, role)
         VALUES (?, ?, 'member')
         ON DUPLICATE KEY UPDATE
           role = IF(role IN ('owner', 'moderator'), role, 'member'),
           banned_at = banned_at`,
        [roomId, requesterId],
      );
      const [approval] = await connection.execute<ResultSetHeader>(
        `UPDATE room_access_requests
         SET status = 'approved',
             reviewed_by = ?,
             reviewed_at = UTC_TIMESTAMP(),
             updated_at = CURRENT_TIMESTAMP()
         WHERE id = ?
           AND room_id = ?
           AND status = 'pending'`,
        [session.userId, requestId, roomId],
      );

      if (approval.affectedRows !== 1) {
        throw new ContentRouteError("Access request is no longer pending.", 409);
      }
      await this.syncRoomMemberCount(roomId, connection);
    });

    return this.fetchRoomAccessRequests(roomId);
  }

  async denyRoomAccessRequest(session: RequestSession, slug: string, requestId: number): Promise<RoomAccessRequestPayload[]> {
    const capabilities = await this.schemaCapabilities();

    this.requireRoomStorage(capabilities);
    this.requireTable(capabilities.hasRoomAccessRequests, "Room access request storage is not ready. Run pending migrations.");
    const room = await this.roomRecordBySlug(slug);

    if (room === null) {
      throw new ContentRouteError("Room not found.", 404);
    }

    if (!(await this.roomCanManageMembers(room, session))) {
      throw new ContentRouteError("You cannot manage access for this room.", 403);
    }

    const roomId = numberValue(room.id);

    await this.withTransaction(async (connection) => {
      if ((await this.roomAccessRequestRecord(roomId, requestId, connection, true, true)) === null) {
        throw new ContentRouteError("Access request not found.", 404);
      }

      const [denial] = await connection.execute<ResultSetHeader>(
        `UPDATE room_access_requests
         SET status = 'denied',
             reviewed_by = ?,
             reviewed_at = UTC_TIMESTAMP(),
             updated_at = CURRENT_TIMESTAMP()
         WHERE id = ?
           AND room_id = ?
           AND status = 'pending'`,
        [session.userId, requestId, roomId],
      );

      if (denial.affectedRows !== 1) {
        throw new ContentRouteError("Access request is no longer pending.", 409);
      }
    });

    return this.fetchRoomAccessRequests(roomId);
  }

  async addRoomMember(session: RequestSession, slug: string, body: Record<string, unknown>): Promise<RoomMemberPayload[]> {
    const capabilities = await this.schemaCapabilities();

    this.requireRoomStorage(capabilities);
    this.requireRoomInvitationStorage(capabilities);
    const room = await this.roomRecordBySlug(slug);

    if (room === null) {
      throw new ContentRouteError("Room not found.", 404);
    }

    if (!(await this.roomCanManageMembers(room, session))) {
      throw new ContentRouteError("You cannot manage members for this room.", 403);
    }

    const user = await this.roomUserByHandle(body.handle);

    if (user === null) {
      throw new ContentRouteError("Profile not found.", 404);
    }

    const roomId = numberValue(room.id);
    const userId = numberValue(user.user_id);

    await this.withTransaction(async (connection) => {
      const lockedRoom = await this.roomRecordBySlug(slug, connection, true);

      if (lockedRoom === null || numberValue(lockedRoom.id) !== roomId) {
        throw new ContentRouteError("Room not found.", 404);
      }

      const existing = await this.roomMembershipRecord(roomId, userId, connection, true);

      if (existing !== null && existing.banned_at !== null) {
        throw new ContentRouteError("Banned members cannot be added.", 422);
      }

      if (existing === null) {
        await connection.execute<ResultSetHeader>(
          `INSERT INTO room_invitations (room_id, invitee_id, invited_by, status, accepted_at, revoked_at)
           VALUES (?, ?, ?, 'pending', NULL, NULL)
           ON DUPLICATE KEY UPDATE
             invited_by = VALUES(invited_by),
             status = 'pending',
             accepted_at = NULL,
             revoked_at = NULL,
             updated_at = CURRENT_TIMESTAMP()`,
          [roomId, userId, session.userId],
        );
      }
    });

    return this.fetchRoomMembers(roomId);
  }

  async removeRoomMember(session: RequestSession, slug: string, body: Record<string, unknown>): Promise<RoomMemberPayload[]> {
    const capabilities = await this.schemaCapabilities();

    this.requireRoomStorage(capabilities);
    const room = await this.roomRecordBySlug(slug);

    if (room === null) {
      throw new ContentRouteError("Room not found.", 404);
    }

    if (!(await this.roomCanManageMembers(room, session))) {
      throw new ContentRouteError("You cannot manage members for this room.", 403);
    }

    const user = await this.roomUserByHandle(body.handle);

    if (user === null) {
      throw new ContentRouteError("Profile not found.", 404);
    }

    const roomId = numberValue(room.id);
    const userId = numberValue(user.user_id);

    await this.withTransaction(async (connection) => {
      const lockedRoom = await this.roomRecordBySlug(slug, connection, true);

      if (lockedRoom === null || numberValue(lockedRoom.id) !== roomId) {
        throw new ContentRouteError("Room not found.", 404);
      }

      const membership = await this.roomMembershipRecord(roomId, userId, connection, true);

      if (membership !== null && membership.role === "owner") {
        throw new ContentRouteError("Room owners cannot be removed without ownership transfer.", 422);
      }

      await connection.execute<ResultSetHeader>(
        `DELETE FROM room_memberships
         WHERE room_id = ?
           AND user_id = ?
           AND role <> 'owner'`,
        [roomId, userId],
      );

      if (capabilities.hasRoomInvitations) {
        await connection.execute<ResultSetHeader>(
          `UPDATE room_invitations
           SET status = 'revoked',
               accepted_at = NULL,
               revoked_at = UTC_TIMESTAMP(),
               updated_at = CURRENT_TIMESTAMP()
           WHERE room_id = ?
             AND invitee_id = ?
             AND status <> 'revoked'`,
          [roomId, userId],
        );
      }

      if (capabilities.hasRoomAccessRequests) {
        await connection.execute<ResultSetHeader>(
          `UPDATE room_access_requests
           SET status = 'denied',
               reviewed_by = ?,
               reviewed_at = UTC_TIMESTAMP(),
               updated_at = CURRENT_TIMESTAMP()
           WHERE room_id = ?
             AND requester_id = ?
             AND status IN ('pending', 'approved')`,
          [session.userId, roomId, userId],
        );
      }

      await this.syncRoomMemberCount(roomId, connection);
    });

    return this.fetchRoomMembers(roomId);
  }

  async addRoomModerator(session: RequestSession, slug: string, body: Record<string, unknown>): Promise<RoomMemberPayload[]> {
    const capabilities = await this.schemaCapabilities();

    this.requireRoomStorage(capabilities);
    const room = await this.roomRecordBySlug(slug);

    if (room === null) {
      throw new ContentRouteError("Room not found.", 404);
    }

    if (!(await this.roomCanManageModerators(room, session))) {
      throw new ContentRouteError("You cannot manage moderators for this room.", 403);
    }

    const user = await this.roomUserByHandle(body.handle);

    if (user === null) {
      throw new ContentRouteError("Profile not found.", 404);
    }

    const roomId = numberValue(room.id);
    const userId = numberValue(user.user_id);
    const existing = await this.roomMembershipRecord(roomId, userId);

    if (existing === null) {
      throw new ContentRouteError("Members must join and accept the room rules before becoming moderators.", 422);
    }

    if (existing.banned_at !== null) {
      throw new ContentRouteError("Banned members cannot be made moderators.", 422);
    }

    await this.pool.execute<ResultSetHeader>(
      `UPDATE room_memberships
       SET role = IF(role = 'owner', role, 'moderator')
       WHERE room_id = ?
         AND user_id = ?
         AND banned_at IS NULL`,
      [roomId, userId],
    );
    await this.syncRoomMemberCount(roomId, this.pool);

    return this.fetchRoomMembers(roomId);
  }

  async removeRoomModerator(session: RequestSession, slug: string, body: Record<string, unknown>): Promise<RoomMemberPayload[]> {
    const capabilities = await this.schemaCapabilities();

    this.requireRoomStorage(capabilities);
    const room = await this.roomRecordBySlug(slug);

    if (room === null) {
      throw new ContentRouteError("Room not found.", 404);
    }

    if (!(await this.roomCanManageModerators(room, session))) {
      throw new ContentRouteError("You cannot manage moderators for this room.", 403);
    }

    const user = await this.roomUserByHandle(body.handle);

    if (user === null) {
      throw new ContentRouteError("Profile not found.", 404);
    }

    const roomId = numberValue(room.id);
    const userId = numberValue(user.user_id);
    const membership = await this.roomMembershipRecord(roomId, userId);

    if (membership !== null && membership.role === "owner") {
      throw new ContentRouteError("Room owners cannot be demoted without ownership transfer.", 422);
    }

    await this.pool.execute<ResultSetHeader>(
      `UPDATE room_memberships
       SET role = 'member'
       WHERE room_id = ?
         AND user_id = ?
         AND role = 'moderator'`,
      [roomId, userId],
    );
    await this.syncRoomMemberCount(roomId, this.pool);

    return this.fetchRoomMembers(roomId);
  }

  private async fetchPostPayloadByIdentifier(
    identifier: string,
    viewerUserId: number | null,
    capabilities: ContentCapabilities,
  ): Promise<PostPayload | null> {
    const normalized = normalizePostIdentifier(identifier);

    if (normalized === null) {
      return null;
    }

    const usesPublicId = capabilities.hasPostPublicIdColumn && !/^[0-9]+$/u.test(normalized);
    const query = postSelectSql(
      usesPublicId ? "AND p.public_id = ?" : "AND p.id = ?",
      "p.created_at DESC, p.id DESC",
      "",
      capabilities,
      viewerUserId,
    );
    const [rows] = await this.pool.execute<PostRow[]>(query, [normalized]);
    const row = rows[0];

    return row === undefined ? null : this.postPayload(row, capabilities);
  }

  private async fetchPostPayloadById(
    postId: number,
    viewerUserId: number | null,
    capabilities: ContentCapabilities,
  ): Promise<PostPayload> {
    const query = postSelectSql("AND p.id = ?", "p.created_at DESC, p.id DESC", "", capabilities, viewerUserId);
    const [rows] = await this.pool.execute<PostRow[]>(query, [postId]);
    const row = rows[0];

    if (row === undefined) {
      throw new ContentRouteError("Post not found.", 404);
    }

    return this.postPayload(row, capabilities);
  }

  private async postPayload(row: PostRow, capabilities: ContentCapabilities): Promise<PostPayload> {
    const [postEntities, profileEntities] = await Promise.all([
      this.textEntities("post", numberValue(row.post_id), "body", capabilities),
      this.textEntities("profile", numberValue(row.user_id), "bio", capabilities),
    ]);

    const [post] = await hydratePostAttachments(
      this.pool,
      capabilities,
      [postPayloadFromRow(row, postEntities, profileEntities)],
    );

    return post ?? postPayloadFromRow(row, postEntities, profileEntities);
  }

  private requirePostAttachmentStorage(
    attachments: ValidatedPostAttachment[],
    capabilities: ContentCapabilities,
  ): void {
    if (
      capabilities.hasPostAttachments ||
      attachments.length === 0 ||
      (attachments.length === 1 && legacyPostMediaFromAttachments(attachments).url !== null)
    ) {
      return;
    }

    throw new ContentStorageNotReadyError("Post attachment storage is not ready. Run pending migrations.");
  }

  private async replacePostAttachments(
    postId: number,
    attachments: ValidatedPostAttachment[],
    capabilities: ContentCapabilities,
  ): Promise<void> {
    if (!capabilities.hasPostAttachments) {
      return;
    }

    await this.pool.execute<ResultSetHeader>(
      `DELETE FROM post_attachments
       WHERE post_id = ?`,
      [postId],
    );

    for (const attachment of attachments) {
      await this.pool.execute<ResultSetHeader>(
        `INSERT INTO post_attachments (
            post_id,
            position,
            kind,
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
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          postId,
          attachment.position,
          attachment.kind,
          attachment.url,
          attachment.mime,
          attachment.sizeBytes,
          attachment.width,
          attachment.height,
          attachment.durationSeconds,
          attachment.posterUrl,
          attachment.provider,
          attachment.resourceType,
          attachment.resourceId,
          attachment.resourceKey,
          attachment.sourceUrl,
          attachment.cardJson,
        ],
      );
    }
  }

  private async textEntities(
    contentType: "post" | "profile",
    contentId: number,
    fieldName: "bio" | "body",
    capabilities: ContentCapabilities,
  ): Promise<TextEntityPayload[]> {
    if (!capabilities.hasTextEntities) {
      return [];
    }

    const [rows] = await this.pool.execute<TextEntityRow[]>(
      `SELECT
            e.id,
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
         WHERE e.content_type = ?
           AND e.content_id = ?
           AND e.field_name = ?
         ORDER BY e.entity_start ASC, e.id ASC`,
      [contentType, contentId, fieldName],
    );

    return rows.flatMap((row) => {
      const entity = textEntityPayloadFromRow(row);

      return entity === null ? [] : [entity];
    });
  }

  private async storeTextEntitiesForPost(
    postId: number,
    body: string,
    actorUserId: number,
    roomId: number | null,
    notificationPostId: number,
    capabilities: ContentCapabilities,
  ): Promise<void> {
    if (!capabilities.hasTextEntities) {
      return;
    }

    await this.pool.execute<ResultSetHeader>(
      `DELETE FROM text_entities
       WHERE content_type = 'post'
         AND content_id = ?
         AND field_name = 'body'`,
      [postId],
    );

    const entities = await this.extractTextEntities(body);

    for (const entity of entities) {
      await this.pool.execute<ResultSetHeader>(
        `INSERT INTO text_entities
           (content_type, content_id, field_name, entity_type, entity_start, entity_length, text_value, target_user_id, url, card_json)
         VALUES ('post', ?, 'body', ?, ?, ?, ?, ?, ?, NULL)`,
        [
          postId,
          entity.type,
          entity.start,
          entity.length,
          entity.text,
          entity.targetUserId,
          entity.url,
        ],
      );

      if (entity.type === "mention" && entity.targetUserId !== null && entity.targetUserId !== actorUserId) {
        await this.createNotification(
          entity.targetUserId,
          actorUserId,
          "mention",
          notificationPostId,
          roomId,
          { targetUrl: `/posts/${notificationPostId}` },
          false,
          capabilities,
        );
      }
    }
  }

  private async extractTextEntities(body: string): Promise<Array<StoredTextEntity>> {
    const entities: Array<StoredTextEntity> = [];
    const mentionHandles = new Map<string, Array<{ start: number; text: string }>>();
    const mentionRegex = /(^|[^\w])@([A-Za-z0-9_-]{1,40})/gu;

    for (const match of body.matchAll(mentionRegex)) {
      const prefix = match[1] ?? "";
      const handle = (match[2] ?? "").toLowerCase();
      const text = `@${handle}`;
      const start = (match.index ?? 0) + prefix.length;

      if (!mentionHandles.has(handle)) {
        mentionHandles.set(handle, []);
      }

      mentionHandles.get(handle)?.push({ start, text });
    }

    for (const [handle, mentions] of mentionHandles) {
      const target = await this.mentionTarget(handle);

      if (target === null) {
        continue;
      }

      for (const mention of mentions) {
        entities.push({
          type: "mention",
          start: mention.start,
          length: mention.text.length,
          text: mention.text,
          targetUserId: numberValue(target.id),
          url: null,
        });
      }
    }

    const linkRegex = /https?:\/\/[^\s<>"']{3,1000}/giu;

    for (const match of body.matchAll(linkRegex)) {
      const text = match[0] ?? "";

      if (!/^https:\/\//iu.test(text)) {
        continue;
      }

      entities.push({
        type: "link",
        start: match.index ?? 0,
        length: text.length,
        text,
        targetUserId: null,
        url: text,
      });
    }

    return entities.sort((left, right) => left.start - right.start);
  }

  private async mentionTarget(handle: string): Promise<MentionTargetRow | null> {
    const [rows] = await this.pool.execute<MentionTargetRow[]>(
      `SELECT id, handle
       FROM users
       WHERE handle = ?
         AND status = 'active'
       LIMIT 1`,
      [handle],
    );

    return rows[0] ?? null;
  }

  private async fetchPostRecord(postId: number): Promise<PostRecordRow | null> {
    const [rows] = await this.pool.execute<PostRecordRow[]>(
      `SELECT id, author_id, room_id, parent_id, status
       FROM posts
       WHERE id = ?
       LIMIT 1`,
      [postId],
    );

    return rows[0] ?? null;
  }

  private async fetchReplyablePostRecord(
    postId: number,
    capabilities: ContentCapabilities,
    session: RequestSession,
  ): Promise<PostRecordRow | null> {
    const [rows] = await this.pool.execute<PostRecordRow[]>(
      `SELECT p.id, p.author_id, p.room_id, p.mood, p.status
       FROM posts p
       LEFT JOIN rooms r ON r.id = p.room_id
       WHERE p.id = ?
         AND p.visibility = 'public'
         AND p.status = 'published'
         AND p.deleted_at IS NULL
         AND (p.room_id IS NULL OR (r.id IS NOT NULL ${roomNotDeletedSql("r", capabilities)}))
       LIMIT 1`,
      [postId],
    );

    const post = rows[0] ?? null;

    if (post?.room_id !== null && post !== null) {
      await this.requireRoomViewPermission(numberValue(post.room_id), session, capabilities);
    }

    return post;
  }

  private async fetchReactablePostRecord(
    postId: number,
    capabilities: ContentCapabilities,
    viewer: RoomViewer,
  ): Promise<PostRecordRow | null> {
    const [rows] = await this.pool.execute<PostRecordRow[]>(
      `SELECT p.id, p.author_id, p.room_id, p.status
       FROM posts p
       LEFT JOIN rooms r ON r.id = p.room_id
       WHERE p.id = ?
         AND p.visibility = 'public'
         AND p.status = 'published'
         AND p.deleted_at IS NULL
         AND (p.room_id IS NULL OR (r.id IS NOT NULL ${roomNotDeletedSql("r", capabilities)}))
       LIMIT 1`,
      [postId],
    );

    const post = rows[0] ?? null;

    if (post?.room_id !== null && post !== null) {
      await this.requireRoomReactPermission(numberValue(post.room_id), viewer, capabilities);
    }

    return post;
  }

  private async fetchRebloggablePostRecord(
    postId: number,
    capabilities: ContentCapabilities,
    session: RequestSession,
  ): Promise<PostRecordRow | null> {
    const post = await this.fetchReactablePostRecord(postId, capabilities, this.roomViewerFromSession(session));

    if (post?.room_id !== null && post !== null) {
      await this.requireRoomPostPermission(numberValue(post.room_id), session, capabilities);
    }

    return post;
  }

  private async requireReactablePost(
    postId: number,
    capabilities: ContentCapabilities,
    viewer: RoomViewer,
  ): Promise<void> {
    if ((await this.fetchReactablePostRecord(postId, capabilities, viewer)) === null) {
      throw new ContentRouteError("Post not found.", 404);
    }
  }

  private async resolveRoomId(
    body: Record<string, unknown>,
    capabilities: ContentCapabilities,
    session: RequestSession,
  ): Promise<number | null> {
    if ("roomId" in body || "room_id" in body) {
      const rawRoomId = body.roomId ?? body.room_id;

      if (!isPositiveIntegerLike(rawRoomId)) {
        throw new ContentRouteError("Room id must be numeric.", 422);
      }

      return this.requireRoomId(Number(rawRoomId), capabilities, session);
    }

    if ("roomSlug" in body || "room_slug" in body) {
      const rawSlug = body.roomSlug ?? body.room_slug;

      if (typeof rawSlug !== "string") {
        throw new ContentRouteError("Room slug must be text.", 422);
      }

      return this.requireRoomSlug(rawSlug, capabilities, session);
    }

    return null;
  }

  private async requireRoomId(
    roomId: number,
    capabilities: ContentCapabilities,
    session: RequestSession,
  ): Promise<number> {
    await this.requireRoomPostPermission(roomId, session, capabilities, 422);
    return roomId;
  }

  private async requireRoomSlug(
    roomSlug: string,
    capabilities: ContentCapabilities,
    session: RequestSession,
  ): Promise<number> {
    const slug = normalizeRoomSlug(roomSlug);

    if (slug === null) {
      throw new ContentRouteError("Room not found.", 422);
    }

    const [rows] = await this.pool.execute<IdRow[]>(
      `SELECT id
       FROM rooms
       WHERE slug = ?
         ${roomNotDeletedSql("rooms", capabilities)}
       LIMIT 1`,
      [slug],
    );
    const row = rows[0];

    if (row === undefined) {
      throw new ContentRouteError("Room not found.", 422);
    }

    const roomId = numberValue(row.id);
    await this.requireRoomPostPermission(roomId, session, capabilities, 422);

    return roomId;
  }

  private async resolveParentId(
    value: unknown,
    capabilities: ContentCapabilities,
    session: RequestSession,
  ): Promise<number | null> {
    if (value === null || value === undefined || value === "") {
      return null;
    }

    if (!isPositiveIntegerLike(value)) {
      throw new ContentRouteError("Parent id must be numeric.", 422);
    }

    const parentId = Number(value);
    const [rows] = await this.pool.execute<PostRecordRow[]>(
      `SELECT p.id, p.author_id, p.room_id, p.status
       FROM posts p
       LEFT JOIN rooms r ON r.id = p.room_id
       WHERE p.id = ?
         AND p.visibility = 'public'
         AND p.status = 'published'
         AND p.deleted_at IS NULL
         AND (p.room_id IS NULL OR (r.id IS NOT NULL ${roomNotDeletedSql("r", capabilities)}))
       LIMIT 1`,
      [parentId],
    );

    const parent = rows[0];

    if (parent === undefined) {
      throw new ContentRouteError("Parent post not found.", 422);
    }

    if (parent.room_id !== null) {
      await this.requireRoomPostPermission(numberValue(parent.room_id), session, capabilities, 422);
    }

    return parentId;
  }

  private async generatePostPublicId(): Promise<string> {
    for (let attempt = 0; attempt < 8; attempt++) {
      const publicId = `p${randomBytes(6).toString("hex")}`;
      const [rows] = await this.pool.execute<IdRow[]>(
        `SELECT id
         FROM posts
         WHERE public_id = ?
         LIMIT 1`,
        [publicId],
      );

      if (rows[0] === undefined) {
        return publicId;
      }
    }

    throw new ContentRouteError("Could not create a post id. Try again.", 503);
  }

  private async reactionCountsForPost(postId: number): Promise<ReactionPayload["reactions"]> {
    const [rows] = await this.pool.execute<ReactionCountRow[]>(
      `SELECT
          COALESCE(SUM(type = 'glow'), 0) AS glow_count,
          COALESCE(SUM(type = 'echo'), 0) AS echo_count,
          COALESCE(SUM(type = 'hush'), 0) AS hush_count
       FROM post_reactions
       WHERE post_id = ?`,
      [postId],
    );
    const row = rows[0];

    return {
      glow: numberValue(row?.glow_count),
      echo: numberValue(row?.echo_count),
      hush: numberValue(row?.hush_count),
    };
  }

  private async likePayloadForPost(postId: number, userId: number): Promise<LikePayload> {
    const [rows] = await this.pool.execute<LikeCountRow[]>(
      `SELECT
          COUNT(*) AS like_count,
          COALESCE(SUM(user_id = ?), 0) AS liked_by_current_user
       FROM post_reactions
       WHERE post_id = ?
         AND type = 'glow'`,
      [userId, postId],
    );
    const row = rows[0];

    return {
      postId,
      likeCount: numberValue(row?.like_count),
      likedByCurrentUser: numberValue(row?.liked_by_current_user) > 0,
    };
  }

  private async reblogPayloadForPost(postId: number, userId: number): Promise<ReblogPayload> {
    const [rows] = await this.pool.execute<ReblogCountRow[]>(
      `SELECT
          COUNT(*) AS reblog_count,
          EXISTS (
            SELECT 1
            FROM post_reblogs current_reblog
            WHERE current_reblog.post_id = ?
              AND current_reblog.user_id = ?
          ) AS reblogged_by_me
       FROM post_reblogs
       WHERE post_id = ?`,
      [postId, userId, postId],
    );
    const row = rows[0];
    const rebloggedByMe = booleanValue(row?.reblogged_by_me);

    return {
      postId,
      reblogCount: numberValue(row?.reblog_count),
      rebloggedByMe,
      rebloggedByCurrentUser: rebloggedByMe,
    };
  }

  private async activeProfileForFollow(
    handle: string,
    capabilities: ContentCapabilities,
  ): Promise<{ userId: number; visibility: "public" | "private" }> {
    const normalized = normalizeProfileHandle(handle);

    if (normalized === null) {
      throw new ContentRouteError("Profile not found.", 404);
    }

    const [rows] = await this.pool.execute<ActiveProfileRow[]>(
      `SELECT
          u.id AS user_id,
          ${capabilities.hasProfileVisibilityColumn ? "p.visibility" : "'public' AS visibility"}
       FROM users u
       INNER JOIN profiles p ON p.user_id = u.id
       WHERE u.handle = ?
         AND ${userPubliclyAvailableSql("u", capabilities)}
       LIMIT 1`,
      [normalized],
    );
    const row = rows[0];

    if (row === undefined) {
      throw new ContentRouteError("Profile not found.", 404);
    }

    return {
      userId: numberValue(row.user_id),
      visibility: row.visibility === "private" ? "private" : "public",
    };
  }

  private async followRelationshipResponse(
    targetUserId: number,
    viewerUserId: number,
    capabilities: ContentCapabilities,
  ): Promise<FollowRelationshipPayload> {
    const context: FollowRelationshipPayload = {
      followerCount: 0,
      followingCount: 0,
      mootCount: 0,
      starCount: 0,
      isFollowing: false,
      isFollowedBy: false,
      isMoot: false,
      isStarred: false,
      isFollowRequestPending: false,
      isBlocked: false,
      isMuted: false,
    };

    if (capabilities.hasProfileStars) {
      const [starRows] = await this.pool.execute<StarCountRow[]>(
        `SELECT COUNT(*) AS star_count
         FROM profile_stars
         WHERE starred_user_id = ?`,
        [targetUserId],
      );
      context.starCount = numberValue(starRows[0]?.star_count);

      if (viewerUserId !== targetUserId) {
        const [starStateRows] = await this.pool.execute<RowDataPacket[]>(
          `SELECT 1
           FROM profile_stars
           WHERE starrer_id = ?
             AND starred_user_id = ?
           LIMIT 1`,
          [viewerUserId, targetUserId],
        );
        context.isStarred = starStateRows[0] !== undefined;
      }
    }

    if (!capabilities.hasUserFollows) {
      return context;
    }

    const [countRows] = await this.pool.execute<SocialCountRow[]>(
      `SELECT
          (
            SELECT COUNT(*)
            FROM user_follows followers
            INNER JOIN users follower_users ON follower_users.id = followers.follower_id
            WHERE followers.following_id = ?
              AND follower_users.status = 'active'
              ${pairNotBlockedSql("followers.follower_id", "followers.following_id", capabilities)}
          ) AS follower_count,
          (
            SELECT COUNT(*)
            FROM user_follows following
            INNER JOIN users following_users ON following_users.id = following.following_id
            WHERE following.follower_id = ?
              AND following_users.status = 'active'
              ${pairNotBlockedSql("following.follower_id", "following.following_id", capabilities)}
          ) AS following_count,
          (
            SELECT COUNT(*)
            FROM user_follows moots
            INNER JOIN user_follows reciprocal
              ON reciprocal.follower_id = moots.following_id
             AND reciprocal.following_id = moots.follower_id
            INNER JOIN users moot_users ON moot_users.id = moots.following_id
            WHERE moots.follower_id = ?
              AND moot_users.status = 'active'
              ${pairNotBlockedSql("moots.follower_id", "moots.following_id", capabilities)}
          ) AS moot_count`,
      [targetUserId, targetUserId, targetUserId],
    );
    const countRow = countRows[0];

    context.followerCount = numberValue(countRow?.follower_count);
    context.followingCount = numberValue(countRow?.following_count);
    context.mootCount = numberValue(countRow?.moot_count);

    if (viewerUserId === targetUserId) {
      return context;
    }

    if (capabilities.hasUserFollowRequests) {
      const [pendingRows] = await this.pool.execute<PendingRequestRow[]>(
        `SELECT 1 AS pending
         FROM user_follow_requests
         WHERE requester_id = ?
           AND target_user_id = ?
           AND status = 'pending'
         LIMIT 1`,
        [viewerUserId, targetUserId],
      );
      context.isFollowRequestPending = pendingRows[0] !== undefined;
    }

    const [relationshipRows] = await this.pool.execute<RelationshipRow[]>(
      `SELECT
          EXISTS (
            SELECT 1
            FROM user_follows
            WHERE follower_id = ?
              AND following_id = ?
          ) AS is_following,
          EXISTS (
            SELECT 1
            FROM user_follows
            WHERE follower_id = ?
              AND following_id = ?
          ) AS is_followed_by,
          ${capabilities.hasUserBlocks
            ? `EXISTS (
                SELECT 1
                FROM user_blocks
                WHERE blocker_id = ?
                  AND blocked_id = ?
              ) AS is_blocked,
              EXISTS (
                SELECT 1
                FROM user_blocks
                WHERE blocker_id = ?
                  AND blocked_id = ?
              ) AS is_blocked_by,`
            : "0 AS is_blocked, 0 AS is_blocked_by,"}
          ${capabilities.hasUserMutes
            ? `EXISTS (
                SELECT 1
                FROM user_mutes
                WHERE muter_id = ?
                  AND muted_id = ?
              ) AS is_muted`
            : "0 AS is_muted"}`,
      [
        viewerUserId,
        targetUserId,
        targetUserId,
        viewerUserId,
        ...(capabilities.hasUserBlocks ? [viewerUserId, targetUserId, targetUserId, viewerUserId] : []),
        ...(capabilities.hasUserMutes ? [viewerUserId, targetUserId] : []),
      ],
    );
    const relationship = relationshipRows[0];
    const isBlocked = booleanValue(relationship?.is_blocked);
    const isBlockedBy = booleanValue(relationship?.is_blocked_by);

    context.isBlocked = isBlocked;
    context.isMuted = booleanValue(relationship?.is_muted);
    context.isFollowing = !isBlocked && !isBlockedBy && booleanValue(relationship?.is_following);
    context.isFollowedBy = !isBlocked && !isBlockedBy && booleanValue(relationship?.is_followed_by);
    context.isMoot = context.isFollowing && context.isFollowedBy;

    return context;
  }

  private async profileControlResponse(
    targetUserId: number,
    viewerUserId: number,
    capabilities: ContentCapabilities,
  ): Promise<ProfileControlPayload> {
    const relationship = await this.followRelationshipResponse(targetUserId, viewerUserId, capabilities);

    return {
      isBlocked: relationship.isBlocked,
      isMuted: relationship.isMuted,
      relationship,
    };
  }

  private async profileStarResponse(
    targetUserId: number,
    viewerUserId: number,
    capabilities: ContentCapabilities,
  ): Promise<ProfileStarPayload> {
    const relationship = await this.followRelationshipResponse(targetUserId, viewerUserId, capabilities);

    return {
      isStarred: relationship.isStarred,
      starCount: relationship.starCount,
      relationship,
      stats: {
        followers: relationship.followerCount,
        following: relationship.followingCount,
        moots: relationship.mootCount,
        stars: relationship.starCount,
      },
    };
  }

  private async rejectBlockedFollow(
    viewerUserId: number,
    targetUserId: number,
    capabilities: ContentCapabilities,
  ): Promise<void> {
    const state = await this.userPairBlockState(viewerUserId, targetUserId, capabilities);

    if (state.viewerBlocksTarget) {
      throw new ContentRouteError("Unblock this member before following.", 409);
    }

    if (state.targetBlocksViewer) {
      throw new ContentRouteError("You cannot follow this member.", 403);
    }
  }

  private async rejectBlockedStar(
    viewerUserId: number,
    targetUserId: number,
    capabilities: ContentCapabilities,
  ): Promise<void> {
    const state = await this.userPairBlockState(viewerUserId, targetUserId, capabilities);

    if (state.viewerBlocksTarget) {
      throw new ContentRouteError("Unblock this member before starring.", 409);
    }

    if (state.targetBlocksViewer) {
      throw new ContentRouteError("You cannot star this member.", 403);
    }
  }

  private async userPairBlockState(
    viewerUserId: number,
    targetUserId: number,
    capabilities: ContentCapabilities,
  ): Promise<{ viewerBlocksTarget: boolean; targetBlocksViewer: boolean }> {
    if (!capabilities.hasUserBlocks) {
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
      viewerBlocksTarget: booleanValue(row?.viewer_blocks_target),
      targetBlocksViewer: booleanValue(row?.target_blocks_viewer),
    };
  }

  private async profileIsFollowing(followerId: number, followingId: number): Promise<boolean> {
    const [rows] = await this.pool.execute<RowDataPacket[]>(
      `SELECT 1
       FROM user_follows
       WHERE follower_id = ?
         AND following_id = ?
       LIMIT 1`,
      [followerId, followingId],
    );

    return rows[0] !== undefined;
  }

  private async isMutualFollow(followerId: number, followingId: number): Promise<boolean> {
    const [firstFollowsSecond, secondFollowsFirst] = await Promise.all([
      this.profileIsFollowing(followerId, followingId),
      this.profileIsFollowing(followingId, followerId),
    ]);

    return firstFollowsSecond && secondFollowsFirst;
  }

  private async followRequestForOwner(requestId: number, userId: number): Promise<FollowRequestRow> {
    if (requestId < 1) {
      throw new ContentRouteError("Follow request not found.", 404);
    }

    const [rows] = await this.pool.execute<FollowRequestRow[]>(
      `SELECT id, requester_id, target_user_id
       FROM user_follow_requests
       WHERE id = ?
         AND target_user_id = ?
         AND status = 'pending'
       LIMIT 1`,
      [requestId, userId],
    );
    const row = rows[0];

    if (row === undefined) {
      throw new ContentRouteError("Follow request not found.", 404);
    }

    return row;
  }

  private async createDirectNativeShareMessage(
    senderUserId: number,
    recipientUserId: number,
    body: string,
    attachment: { postId: number } | { roomId: number },
  ): Promise<{ conversationId: number; messageId: number }> {
    return this.withTransaction(async (connection) => {
      const conversationId = await this.findOrCreateDirectConversation(senderUserId, recipientUserId, connection);
      const [messageResult] = await connection.execute<ResultSetHeader>(
        `INSERT INTO messages (conversation_id, sender_id, body)
         VALUES (?, ?, ?)`,
        [conversationId, senderUserId, body],
      );
      const messageId = messageResult.insertId;

      await connection.execute<ResultSetHeader>(
        `INSERT INTO message_attachments (message_id, position, type, post_id, room_id)
         VALUES (?, 0, ?, ?, ?)`,
        [
          messageId,
          "postId" in attachment ? "post" : "room",
          "postId" in attachment ? attachment.postId : null,
          "roomId" in attachment ? attachment.roomId : null,
        ],
      );
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

      return { conversationId, messageId };
    });
  }

  private async requireRichMessageAttachmentStorage(): Promise<void> {
    const requiredColumns = ["position", "room_id"];
    const available = await Promise.all(
      requiredColumns.map((column) =>
        this.columnExists("message_attachments", column),
      ),
    );

    this.requireTable(
      available.every(Boolean),
      "Message attachment storage is not ready. Run pending migrations.",
    );
  }

  private async findOrCreateDirectConversation(
    userOneId: number,
    userTwoId: number,
    connection: PoolConnection,
  ): Promise<number> {
    const [firstUserId, secondUserId] = userOneId < userTwoId ? [userOneId, userTwoId] : [userTwoId, userOneId];

    await connection.execute<ResultSetHeader>(
      `INSERT IGNORE INTO conversations (type, direct_user_one_id, direct_user_two_id)
       VALUES ('direct', ?, ?)`,
      [firstUserId, secondUserId],
    );
    const [rows] = await connection.execute<ConversationRow[]>(
      `SELECT id
       FROM conversations
       WHERE type = 'direct'
         AND direct_user_one_id = ?
         AND direct_user_two_id = ?
       LIMIT 1`,
      [firstUserId, secondUserId],
    );
    const conversation = rows[0];

    if (conversation === undefined) {
      throw new ContentRouteError("Chat storage is not ready. Run pending migrations.", 503);
    }

    const conversationId = numberValue(conversation.id);

    await connection.execute<ResultSetHeader>(
      `INSERT IGNORE INTO conversation_members (conversation_id, user_id)
       VALUES (?, ?), (?, ?)`,
      [conversationId, firstUserId, conversationId, secondUserId],
    );

    return conversationId;
  }

  private async fetchShareRecipient(recipientUserId: number): Promise<UserPayload | null> {
    const [rows] = await this.pool.execute<UserRow[]>(
      `SELECT
          u.id AS user_id,
          u.handle,
          p.display_name,
          p.avatar_url
       FROM users u
       INNER JOIN profiles p ON p.user_id = u.id
       WHERE u.id = ?
         AND u.status = 'active'
       LIMIT 1`,
      [recipientUserId],
    );
    const row = rows[0];

    return row === undefined ? null : userPayloadFromRow(row);
  }

  private async roomRecordBySlug(
    slug: string,
    executor: QueryExecutor = this.pool,
    forUpdate = false,
  ): Promise<RoomRecordRow | null> {
    const normalized = normalizeRoomSlug(slug);

    if (normalized === null) {
      return null;
    }

    const [rows] = await executor.execute<RoomRecordRow[]>(
      `SELECT id, slug, name, summary, mood, rules, rules_version, visibility, created_by, deleted_at
       FROM rooms
       WHERE slug = ?
         AND deleted_at IS NULL
       LIMIT 1
       ${forUpdate ? "FOR UPDATE" : ""}`,
      [normalized],
    );

    return rows[0] ?? null;
  }

  private async roomRecordById(roomId: number): Promise<RoomRecordRow | null> {
    const [rows] = await this.pool.execute<RoomRecordRow[]>(
      `SELECT id, slug, name, summary, mood, rules, rules_version, visibility, created_by, deleted_at
       FROM rooms
       WHERE id = ?
         AND deleted_at IS NULL
       LIMIT 1`,
      [roomId],
    );

    return rows[0] ?? null;
  }

  private async roomMembershipRecord(
    roomId: number,
    userId: number,
    executor: QueryExecutor = this.pool,
    forUpdate = false,
  ): Promise<RoomMembershipRow | null> {
    const [rows] = await executor.execute<RoomMembershipRow[]>(
      `SELECT id, room_id, user_id, role, muted_at, banned_at
       FROM room_memberships
       WHERE room_id = ?
         AND user_id = ?
       LIMIT 1
       ${forUpdate ? "FOR UPDATE" : ""}`,
      [roomId, userId],
    );

    return rows[0] ?? null;
  }

  private async roomInvitationRecord(
    roomId: number,
    userId: number,
    executor: QueryExecutor = this.pool,
    forUpdate = false,
  ): Promise<RoomInvitationRow | null> {
    const [rows] = await executor.execute<RoomInvitationRow[]>(
      `SELECT id, status, invited_by
       FROM room_invitations
       WHERE room_id = ?
         AND invitee_id = ?
       LIMIT 1
       ${forUpdate ? "FOR UPDATE" : ""}`,
      [roomId, userId],
    );

    return rows[0] ?? null;
  }

  private async roomCanEdit(room: RoomRecordRow, session: RequestSession): Promise<boolean> {
    if (session.role === "admin") {
      return true;
    }

    const membership = await this.roomMembershipRecord(numberValue(room.id), session.userId);

    return membership !== null && membership.banned_at === null && ["owner", "moderator"].includes(String(membership.role));
  }

  private async roomCanDelete(room: RoomRecordRow, session: RequestSession): Promise<boolean> {
    if (session.role === "admin" || nullableNumberValue(room.created_by) === session.userId) {
      return true;
    }

    const membership = await this.roomMembershipRecord(numberValue(room.id), session.userId);

    return membership !== null && membership.banned_at === null && membership.role === "owner";
  }

  private async roomCanManageModerators(room: RoomRecordRow, session: RequestSession): Promise<boolean> {
    return this.roomCanDelete(room, session);
  }

  private async roomCanManageMembers(room: RoomRecordRow, session: RequestSession): Promise<boolean> {
    return this.roomCanEdit(room, session);
  }

  private roomViewerFromSession(session: RequestSession | RoomViewer | null): RoomViewer {
    if (session === null) {
      return { userId: null, role: null };
    }

    return {
      userId: session.userId,
      role: session.role ?? null,
    };
  }

  private roomViewerIsAdmin(session: RequestSession | RoomViewer | null): boolean {
    return this.roomViewerFromSession(session).role === "admin";
  }

  private roomMembershipIsActive(membership: RoomMembershipRow | null): boolean {
    return membership !== null && membership.banned_at === null;
  }

  private async roomCanViewPostsForViewer(room: RoomRecordRow, viewer: RoomViewer): Promise<boolean> {
    if (room.visibility === "public" || room.visibility === "view_only" || this.roomViewerIsAdmin(viewer)) {
      return true;
    }

    if (viewer.userId === null) {
      return false;
    }

    return this.roomMembershipIsActive(await this.roomMembershipRecord(numberValue(room.id), viewer.userId));
  }

  private async roomCanPostForSession(room: RoomRecordRow, session: RequestSession): Promise<boolean> {
    const membership = await this.roomMembershipRecord(numberValue(room.id), session.userId);

    return roomFeedViewerCanPost(
      room.visibility,
      session.role,
      membership === null
        ? null
        : { role: membership.role, bannedAt: membership.banned_at },
    );
  }

  private async roomCanReactForViewer(room: RoomRecordRow, viewer: RoomViewer): Promise<boolean> {
    return viewer.userId !== null && await this.roomCanViewPostsForViewer(room, viewer);
  }

  private async requireRoomViewPermission(
    roomId: number,
    session: RequestSession | RoomViewer,
    capabilities: ContentCapabilities,
    statusCode = 404,
  ): Promise<void> {
    this.requireRoomStorage(capabilities);
    const room = await this.roomRecordById(roomId);

    if (room === null || !(await this.roomCanViewPostsForViewer(room, this.roomViewerFromSession(session)))) {
      throw new ContentRouteError("Post not found.", statusCode);
    }
  }

  private async requireRoomPostPermission(
    roomId: number,
    session: RequestSession,
    capabilities: ContentCapabilities,
    statusCode = 403,
  ): Promise<void> {
    this.requireRoomStorage(capabilities);
    const room = await this.roomRecordById(roomId);

    if (room === null) {
      throw new ContentRouteError("Room not found.", statusCode);
    }

    if (!(await this.roomCanPostForSession(room, session))) {
      throw new ContentRouteError(
        room.visibility === "view_only" ? "Only room staff can post in view-only rooms." : "You cannot post in this room.",
        403,
      );
    }
  }

  private async requireRoomReactPermission(
    roomId: number,
    viewer: RoomViewer,
    capabilities: ContentCapabilities,
  ): Promise<void> {
    this.requireRoomStorage(capabilities);
    const room = await this.roomRecordById(roomId);

    if (room === null || !(await this.roomCanReactForViewer(room, viewer))) {
      throw new ContentRouteError("Post not found.", 404);
    }
  }

  private async fetchRoomBySlugForSession(
    slug: string,
    session: RequestSession,
    capabilities: ContentCapabilities,
  ): Promise<RoomPayload> {
    const roomCapabilities = roomCapabilitiesFromContent(capabilities);
    const [rows] = await this.pool.execute<RoomRow[]>(
      buildPublicRoomBySlugQuery(roomCapabilities, this.roomViewerFromSession(session)),
      [slug],
    );
    const row = rows[0];

    if (row === undefined) {
      throw new ContentRouteError("Room not found.", 404);
    }

    return roomPayloadFromRow(row);
  }

  private async roomAccessRequestRecord(
    roomId: number,
    requestId: number,
    executor: QueryExecutor = this.pool,
    pendingOnly = false,
    forUpdate = false,
  ): Promise<RoomAccessRequestRow | null> {
    if (requestId < 1) {
      return null;
    }

    const [rows] = await executor.execute<RoomAccessRequestRow[]>(
      `${roomAccessRequestSelectSql()}
       WHERE requests.room_id = ?
         AND requests.id = ?
         ${pendingOnly ? "AND requests.status = 'pending'" : ""}
       LIMIT 1
       ${forUpdate ? "FOR UPDATE" : ""}`,
      [roomId, requestId],
    );

    return rows[0] ?? null;
  }

  private async fetchRoomAccessRequests(roomId: number): Promise<RoomAccessRequestPayload[]> {
    const [rows] = await this.pool.execute<RoomAccessRequestRow[]>(
      `${roomAccessRequestSelectSql()}
       WHERE requests.room_id = ?
         AND requests.status = 'pending'
       ORDER BY requests.created_at ASC, requests.id ASC
       LIMIT 100`,
      [roomId],
    );

    return rows.map((row) => roomAccessRequestPayloadFromRow(row));
  }

  private async roomUserByHandle(rawHandle: unknown): Promise<UserRow | null> {
    if (typeof rawHandle !== "string") {
      throw new ContentRouteError("Handle is required.", 422);
    }

    const handle = normalizeProfileHandle(rawHandle);

    if (handle === null) {
      return null;
    }

    const [rows] = await this.pool.execute<UserRow[]>(
      `SELECT
          u.id AS user_id,
          u.handle,
          p.display_name,
          p.avatar_url
       FROM users u
       INNER JOIN profiles p ON p.user_id = u.id
       WHERE u.handle = ?
         AND u.status = 'active'
       LIMIT 1`,
      [handle],
    );

    return rows[0] ?? null;
  }

  private async recordRoomRulesAcceptance(
    roomId: number,
    userId: number,
    rulesVersion: number,
    executor: QueryExecutor,
  ): Promise<void> {
    await executor.execute<ResultSetHeader>(
      `INSERT INTO room_rule_acceptances (room_id, user_id, rules_version, accepted_at)
       VALUES (?, ?, ?, UTC_TIMESTAMP())
       ON DUPLICATE KEY UPDATE accepted_at = VALUES(accepted_at)`,
      [roomId, userId, rulesVersion],
    );
  }

  private async roomRulesAcceptanceExists(
    roomId: number,
    userId: number,
    rulesVersion: number,
    executor: QueryExecutor,
  ): Promise<boolean> {
    const [rows] = await executor.execute<IdRow[]>(
      `SELECT room_id AS id
       FROM room_rule_acceptances
       WHERE room_id = ?
         AND user_id = ?
         AND rules_version = ?
       LIMIT 1`,
      [roomId, userId, rulesVersion],
    );

    return rows[0] !== undefined;
  }

  private async syncRoomMemberCount(roomId: number, executor: QueryExecutor): Promise<void> {
    await executor.execute<ResultSetHeader>(
      `UPDATE rooms
       SET member_count = (
         SELECT COUNT(*)
         FROM room_memberships
         WHERE room_id = ?
           AND banned_at IS NULL
       )
       WHERE id = ?`,
      [roomId, roomId],
    );
  }

  private async grantOwnerBadgeIfFirstRoom(
    userId: number,
    executor: QueryExecutor,
    capabilities: ContentCapabilities,
  ): Promise<void> {
    if (!capabilities.hasBadges || !capabilities.hasUserBadges) {
      return;
    }

    const [rows] = await executor.execute<CountRow[]>(
      `SELECT COUNT(*) AS table_count
       FROM rooms
       WHERE created_by = ?`,
      [userId],
    );

    if (numberValue(rows[0]?.table_count) !== 1) {
      return;
    }

    await executor.execute<ResultSetHeader>(
      `INSERT IGNORE INTO user_badges (user_id, badge_id, granted_by, reason)
       SELECT ?, badges.id, NULL, 'Created a public room.'
       FROM badges
       WHERE badges.badge_key = 'room_owner'
         AND badges.is_active = 1
       LIMIT 1`,
      [userId],
    );
  }

  private async fetchRoomMembers(roomId: number): Promise<RoomMemberPayload[]> {
    const [rows] = await this.pool.execute<RoomMemberRow[]>(buildPublicRoomMembersQuery(), [roomId]);

    return rows.map((row) => roomMemberPayloadFromRow(row));
  }

  private async createNotification(
    userId: number,
    actorId: number | null,
    type: string,
    postId: number | null,
    roomId: number | null,
    data: Record<string, unknown> | null,
    dedupe: boolean,
    capabilities: ContentCapabilities,
  ): Promise<void> {
    if (actorId !== null && actorId === userId) {
      return;
    }

    if (!capabilities.hasNotifications || !notificationTypes.has(type) || !(await this.notificationUserAllowsType(userId, type, capabilities))) {
      return;
    }

    if (dedupe && await this.notificationExists(userId, actorId, type, postId, roomId)) {
      return;
    }

    const jsonData = data === null ? null : JSON.stringify(data);

    await this.pool.execute<ResultSetHeader>(
      `INSERT INTO notifications (user_id, actor_id, type, post_id, room_id, data)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [userId, actorId, type, postId, roomId, jsonData],
    );
  }

  private async notificationUserAllowsType(
    userId: number,
    type: string,
    capabilities: ContentCapabilities,
  ): Promise<boolean> {
    if (!capabilities.hasUserPreferences) {
      return true;
    }

    const [rows] = await this.pool.execute<NotificationPreferenceRow[]>(
      `SELECT notification_preferences_json
       FROM user_preferences
       WHERE user_id = ?
       LIMIT 1`,
      [userId],
    );
    const rawPreferences = rows[0]?.notification_preferences_json;

    if (rawPreferences === null || rawPreferences === undefined || rawPreferences === "") {
      return true;
    }

    const preferences = jsonObject(rawPreferences);

    if (preferences === null) {
      return true;
    }

    const key = notificationPreferenceKey(type);
    const value = preferences[key];

    return value === undefined || Boolean(value);
  }

  private async notificationExists(
    userId: number,
    actorId: number | null,
    type: string,
    postId: number | null,
    roomId: number | null,
  ): Promise<boolean> {
    const [rows] = await this.pool.execute<IdRow[]>(
      `SELECT id
       FROM notifications
       WHERE user_id = ?
         AND actor_id <=> ?
         AND type = ?
         AND post_id <=> ?
         AND room_id <=> ?
       LIMIT 1`,
      [userId, actorId, type, postId, roomId],
    );

    return rows[0] !== undefined;
  }

  private async schemaCapabilities(): Promise<ContentCapabilities> {
    const capabilities = await (this.capabilities ??= this.detectSchemaCapabilities());

    if (!capabilities.hasRoomRulesVersionColumn || !capabilities.hasRoomRuleAcceptances || !capabilities.hasRoomInvitations) {
      delete this.capabilities;
    }

    return capabilities;
  }

  private async detectSchemaCapabilities(): Promise<ContentCapabilities> {
    const [
      hasAccountDeletionRequests,
      hasUserFollows,
      hasUserFollowRequests,
      hasUserBlocks,
      hasUserMutes,
      hasProfileStars,
      hasBannerUrlColumn,
      hasProfileAccentColumn,
      hasProfileBackgroundColumn,
      hasProfileThemeColumn,
      hasProfileBackgroundVideoUrlColumn,
      hasProfileBackgroundVideoPosterColumn,
      hasProfileBackgroundBlurColumn,
      hasProfileLayoutPresetColumn,
      hasProfileCanvasVersionColumn,
      hasProfileCanvasGlassColumn,
      hasProfileThemeConfigColumn,
      hasFeaturedPostColumn,
      hasFeaturedRoomColumn,
      hasProfileVisibilityColumn,
      hasRoomMemberships,
      hasRoomIconUrlColumn,
      hasRoomBannerUrlColumn,
      hasRoomRulesColumn,
      hasRoomThemeColumn,
      hasRoomThemeConfigColumn,
      hasLegacyRoomAccentColumn,
      hasRoomSoftDeleteColumn,
      hasPostPublicIdColumn,
      hasPostBodyFormatColumn,
      hasPostContentVersionColumn,
      hasPostMediaTypeColumn,
      hasPostMediaMimeColumn,
      hasPostMediaPosterUrlColumn,
      hasPostAttachments,
      hasPostReblogs,
      hasTextEntities,
      hasProfileModules,
      hasProfileModuleGridColumn,
      hasProfileModuleGridRow,
      hasProfileModuleGridColSpan,
      hasProfileModuleGridRowSpan,
      hasProfileModulePinnedColumn,
      hasBadges,
      hasUserBadges,
      hasProfileIntegrationAccounts,
      hasProfileIntegrationMetadataCache,
      hasNotifications,
      hasUserPreferences,
      hasConversations,
      hasConversationMembers,
      hasMessages,
      hasMessageAttachments,
      hasRoomAccessRequests,
      hasRoomRulesVersionColumn,
      hasRoomRuleAcceptances,
      hasRoomInvitations,
    ] = await Promise.all([
      this.tableExists("account_deletion_requests"),
      this.tableExists("user_follows"),
      this.tableExists("user_follow_requests"),
      this.tableExists("user_blocks"),
      this.tableExists("user_mutes"),
      this.tableExists("profile_stars"),
      this.columnExists("profiles", "banner_url"),
      this.columnExists("profiles", "profile_accent"),
      this.columnExists("profiles", "profile_background"),
      this.columnExists("profiles", "profile_theme"),
      this.columnExists("profiles", "profile_background_video_url"),
      this.columnExists("profiles", "profile_background_video_poster_url"),
      this.columnExists("profiles", "profile_background_blur"),
      this.columnExists("profiles", "profile_layout_preset"),
      this.columnExists("profiles", "profile_canvas_version"),
      this.columnExists("profiles", "profile_canvas_glass_opacity"),
      this.columnExists("profiles", "profile_theme_config_json"),
      this.columnExists("profiles", "featured_post_id"),
      this.columnExists("profiles", "featured_room_id"),
      this.columnExists("profiles", "visibility"),
      this.tableExists("room_memberships"),
      this.columnExists("rooms", "icon_url"),
      this.columnExists("rooms", "banner_url"),
      this.columnExists("rooms", "rules"),
      this.columnExists("rooms", "theme"),
      this.columnExists("rooms", "theme_config_json"),
      this.columnExists("rooms", "accent"),
      this.columnExists("rooms", "deleted_at"),
      this.columnExists("posts", "public_id"),
      this.columnExists("posts", "body_format"),
      this.columnExists("posts", "content_version"),
      this.columnExists("posts", "media_type"),
      this.columnExists("posts", "media_mime"),
      this.columnExists("posts", "media_poster_url"),
      this.tableExists("post_attachments"),
      this.tableExists("post_reblogs"),
      this.tableExists("text_entities"),
      this.tableExists("profile_modules"),
      this.columnExists("profile_modules", "grid_column"),
      this.columnExists("profile_modules", "grid_row"),
      this.columnExists("profile_modules", "grid_col_span"),
      this.columnExists("profile_modules", "grid_row_span"),
      this.columnExists("profile_modules", "grid_pinned"),
      this.tableExists("badges"),
      this.tableExists("user_badges"),
      this.tableExists("profile_integration_accounts"),
      this.tableExists("profile_integration_metadata_cache"),
      this.tableExists("notifications"),
      this.tableExists("user_preferences"),
      this.tableExists("conversations"),
      this.tableExists("conversation_members"),
      this.tableExists("messages"),
      this.tableExists("message_attachments"),
      this.tableExists("room_access_requests"),
      this.columnExists("rooms", "rules_version"),
      this.tableExists("room_rule_acceptances"),
      this.tableExists("room_invitations"),
    ]);

    return {
      hasAccountDeletionRequests,
      hasUserFollows,
      hasUserFollowRequests,
      hasUserBlocks,
      hasUserMutes,
      hasProfileStars,
      hasProfileCustomizationColumns:
        hasBannerUrlColumn && hasProfileAccentColumn && hasProfileBackgroundColumn && hasProfileThemeColumn,
      hasProfileBackgroundVideoColumns: hasProfileBackgroundVideoUrlColumn && hasProfileBackgroundVideoPosterColumn,
      hasProfileBackgroundBlurColumn,
      hasProfileLayoutPresetColumn,
      hasProfileCanvasVersionColumn,
      hasProfileCanvasGlassColumn,
      hasProfileThemeConfigColumn,
      hasProfileFeaturedColumns: hasFeaturedPostColumn && hasFeaturedRoomColumn,
      hasProfileVisibilityColumn,
      hasRoomMemberships,
      hasRoomCustomizationColumns: hasRoomIconUrlColumn && hasRoomBannerUrlColumn && hasRoomRulesColumn,
      hasRoomThemeColumns: hasRoomThemeColumn && hasRoomThemeConfigColumn,
      hasLegacyRoomAccentColumn,
      hasRoomSoftDeleteColumn,
      hasPostPublicIdColumn,
      hasPostBodyFormatColumn,
      hasPostContentVersionColumn,
      hasPostMediaMetadataColumns:
        hasPostMediaTypeColumn && hasPostMediaMimeColumn && hasPostMediaPosterUrlColumn,
      hasPostAttachments,
      hasPostReblogs,
      hasTextEntities,
      hasProfileModules,
      hasProfileModuleLayoutColumns:
        hasProfileModuleGridColumn &&
        hasProfileModuleGridRow &&
        hasProfileModuleGridColSpan &&
        hasProfileModuleGridRowSpan,
      hasProfileModulePinnedColumn,
      hasBadges,
      hasUserBadges,
      hasProfileIntegrationAccounts,
      hasProfileIntegrationMetadataCache,
      hasNotifications,
      hasUserPreferences,
      hasConversations,
      hasConversationMembers,
      hasMessages,
      hasMessageAttachments,
      hasRoomAccessRequests,
      hasRoomRulesVersionColumn,
      hasRoomRuleAcceptances,
      hasRoomInvitations,
    };
  }

  private async tableExists(tableName: string): Promise<boolean> {
    validateSchemaIdentifier(tableName);

    const [rows] = await this.pool.execute<CountRow[]>(
      `SELECT COUNT(*) AS table_count
       FROM INFORMATION_SCHEMA.TABLES
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = ?`,
      [tableName],
    );

    return numberValue(rows[0]?.table_count) > 0;
  }

  private async columnExists(tableName: string, columnName: string): Promise<boolean> {
    validateSchemaIdentifier(tableName);
    validateSchemaIdentifier(columnName);

    const [rows] = await this.pool.execute<CountRow[]>(
      `SELECT COUNT(*) AS column_count
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = ?
         AND COLUMN_NAME = ?`,
      [tableName, columnName],
    );

    return numberValue(rows[0]?.column_count) > 0;
  }

  private requireTable(ready: boolean, message: string): void {
    if (!ready) {
      throw new ContentStorageNotReadyError(message);
    }
  }

  private requireRoomStorage(capabilities: ContentCapabilities): void {
    if (!roomStorageReady(roomCapabilitiesFromContent(capabilities))) {
      throw new ContentStorageNotReadyError("Room membership storage is not ready. Run pending migrations.");
    }
  }

  private requireRoomThemeStorage(capabilities: ContentCapabilities): void {
    if (!capabilities.hasRoomThemeColumns) {
      throw new ContentStorageNotReadyError("Room theme storage is not ready. Run pending migrations.");
    }
  }

  private requireRoomRuleAcceptanceStorage(capabilities: ContentCapabilities): void {
    if (!capabilities.hasRoomRulesVersionColumn || !capabilities.hasRoomRuleAcceptances) {
      throw new ContentStorageNotReadyError("Room rule acceptance storage is not ready. Run pending migrations.");
    }
  }

  private requireRoomInvitationStorage(capabilities: ContentCapabilities): void {
    if (!capabilities.hasRoomInvitations) {
      throw new ContentStorageNotReadyError("Room invitation storage is not ready. Run pending migrations.");
    }
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

interface StoredTextEntity {
  type: "mention" | "link";
  start: number;
  length: number;
  text: string;
  targetUserId: number | null;
  url: string | null;
}

interface QueryExecutor {
  execute<T extends RowDataPacket[] | ResultSetHeader>(
    sql: string,
    values?: Array<number | string | null>,
  ): Promise<[T, unknown]>;
}

interface PostRow extends ProfileRow, RoomRow {
  post_id: number | string;
  post_public_id: string | null;
  post_parent_id: number | string | null;
  post_body: string | null;
  post_body_format: string | null;
  post_content_version: number | string | null;
  post_mood: string | null;
  post_media_url: string | null;
  post_media_type: string | null;
  post_media_mime: string | null;
  post_media_poster_url: string | null;
  post_visibility: string;
  post_status: string;
  post_deleted_at: string | null;
  post_created_at: string | null;
  post_updated_at: string | null;
  reaction_glow_count: number | string | null;
  reaction_echo_count: number | string | null;
  reaction_hush_count: number | string | null;
  reply_count: number | string | null;
  current_like_user_id: number | string | null;
  current_viewer_user_id: number | string | null;
  current_user_follows_author: number | string | boolean | null;
  author_follows_current_user: number | string | boolean | null;
  followed_like_count: number | string | null;
  reblog_count: number | string | null;
  current_reblog_user_id: number | string | null;
  reblogged_by_user_id: number | string | null;
  reblogged_by_handle: string | null;
  reblogged_by_display_name: string | null;
  reblogged_by_avatar_url: string | null;
  reblogged_at: string | null;
}

const notificationTypes = new Set(["follow", "moot", "like", "reply", "reblog", "message", "mention", "badge_granted"]);

function postShareFailedResult(recipientUserId: number, error: string): PostShareResultPayload {
  return {
    recipientUserId,
    status: "failed",
    error,
  };
}

function postShareSummaryPayload(post: PostPayload, publicBaseUrl: string): PostShareSummaryPayload {
  const canonicalPath = postCanonicalPath(post);

  return {
    id: post.id,
    publicId: post.publicId || String(post.id),
    canonicalPath,
    canonicalUrl: `${publicBaseUrl.replace(/\/+$/u, "")}${canonicalPath}`,
    bodySnippet: postBodySnippet(post.body, 160),
    createdAt: post.createdAt,
    mediaUrl: post.mediaUrl,
    mediaType: post.mediaType,
    mediaMime: post.mediaMime,
    mediaPosterUrl: post.mediaPosterUrl,
    author: post.author,
    room: post.room,
  };
}

function postBodySnippet(body: string, maxLength: number): string {
  const normalized = body.replace(/\s+/gu, " ").trim();

  if (normalized === "") {
    return "A post on thia.lol.";
  }

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, Math.max(1, maxLength - 1)).trimEnd()}...`;
}

function validatePostBody(value: unknown): string {
  if (typeof value !== "string") {
    throw new ContentRouteError("Post body is required.", 422);
  }

  const body = value.trim();

  if (body.length < 1 || body.length > 2000) {
    throw new ContentRouteError("Post body must be between 1 and 2000 characters.", 422);
  }

  return body;
}

function validateOptionalText(value: unknown, maxLength: number, label: string): string | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (typeof value !== "string") {
    throw new ContentRouteError(`${label} must be text.`, 422);
  }

  const text = value.trim();

  if (text === "") {
    return null;
  }

  if (text.length > maxLength) {
    throw new ContentRouteError(`${label} is too long.`, 422);
  }

  return text;
}

function validatePostStatus(value: unknown): "published" | "hidden" | "removed" {
  if (value !== "published" && value !== "hidden" && value !== "removed") {
    throw new ContentRouteError("Post status must be published, hidden, or removed.", 422);
  }

  return value;
}

function validateReactionType(value: unknown): "glow" | "echo" | "hush" {
  if (typeof value !== "string" || !reactionTypes.includes(value as "glow" | "echo" | "hush")) {
    throw new ContentRouteError("Reaction type must be glow, echo, or hush.", 422);
  }

  return value as "glow" | "echo" | "hush";
}

export type ValidatedPostMedia = {
  mime: string | null;
  posterUrl: string | null;
  type: "image" | "video" | null;
  url: string | null;
};

export type ValidatedPostAttachment = {
  position: number;
  kind: PostAttachmentKind;
  url: string | null;
  mime: string | null;
  sizeBytes: number | null;
  width: number | null;
  height: number | null;
  durationSeconds: number | null;
  posterUrl: string | null;
  provider: string | null;
  resourceType: string | null;
  resourceId: string | null;
  resourceKey: string | null;
  sourceUrl: string | null;
  cardJson: string | null;
};

const maxPostAttachments = 8;

export function validatePostMedia(body: Record<string, unknown>): ValidatedPostMedia {
  const url = validatePostMediaUrl(body.mediaUrl ?? body.media_url);

  if (url === null) {
    return {
      mime: null,
      posterUrl: null,
      type: null,
      url: null,
    };
  }

  const type = validatePostMediaType(body.mediaType ?? body.media_type, url);
  const mime = validatePostMediaMime(body.mediaMime ?? body.media_mime, type, url);
  const posterUrl = validatePostMediaPosterUrl(body.mediaPosterUrl ?? body.media_poster_url, type);

  return {
    mime,
    posterUrl,
    type,
    url,
  };
}

export function validatePostAttachments(body: Record<string, unknown>): ValidatedPostAttachment[] {
  if ("attachments" in body) {
    if (!Array.isArray(body.attachments)) {
      throw new ContentRouteError("Post attachments must be a list.", 422);
    }

    if (body.attachments.length > maxPostAttachments) {
      throw new ContentRouteError(`Posts can include up to ${maxPostAttachments} attachments.`, 422);
    }

    return body.attachments.map((attachment, index) =>
      validatePostAttachment(attachment, index + 1),
    );
  }

  const legacyMedia = validatePostMedia(body);

  if (legacyMedia.url === null || legacyMedia.type === null) {
    return [];
  }

  return [
    {
      position: 1,
      kind: legacyMedia.type,
      url: legacyMedia.url,
      mime: legacyMedia.mime,
      sizeBytes: null,
      width: null,
      height: null,
      durationSeconds: null,
      posterUrl: legacyMedia.posterUrl,
      provider: null,
      resourceType: null,
      resourceId: null,
      resourceKey: null,
      sourceUrl: null,
      cardJson: null,
    },
  ];
}

function validatePostAttachment(value: unknown, position: number): ValidatedPostAttachment {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new ContentRouteError("Post attachment is invalid.", 422);
  }

  const attachment = value as Record<string, unknown>;
  const kind = validatePostAttachmentKind(attachment.kind ?? attachment.type, attachment.url);

  if (kind === "integration") {
    return validatePostIntegrationAttachment(attachment, position);
  }

  if (kind === "gif") {
    return validatePostGifAttachment(attachment, position);
  }

  const url = validatePostAttachmentUploadUrl(attachment.url, kind);
  const mime = validatePostAttachmentMime(attachment.mime ?? attachment.type, kind, url);
  const posterUrl = validatePostAttachmentPosterUrl(attachment.posterUrl ?? attachment.poster_url, kind);

  return {
    position,
    kind,
    url,
    mime,
    sizeBytes: validateOptionalPositiveInteger(
      attachment.sizeBytes ?? attachment.size_bytes ?? attachment.size,
      "Attachment size",
      100 * 1024 * 1024,
    ),
    width: validateOptionalPositiveInteger(attachment.width, "Attachment width", 4_294_967_295),
    height: validateOptionalPositiveInteger(attachment.height, "Attachment height", 4_294_967_295),
    durationSeconds: validateOptionalPositiveNumber(
      attachment.durationSeconds ?? attachment.duration_seconds ?? attachment.duration,
      "Attachment duration",
      9_999_999.999,
    ),
    posterUrl,
    provider: null,
    resourceType: null,
    resourceId: null,
    resourceKey: null,
    sourceUrl: null,
    cardJson: null,
  };
}

function validatePostGifAttachment(
  attachment: Record<string, unknown>,
  position: number,
): ValidatedPostAttachment {
  const resourceId = validateOptionalToken(attachment.resourceId ?? attachment.resource_id, "GIF id", 191);
  const resourceKey = validateOptionalToken(attachment.resourceKey ?? attachment.resource_key, "GIF key", 255) ?? (resourceId ? `klipy:${resourceId}` : null);
  const sourceUrl = validateOptionalGifSourceUrl(attachment.sourceUrl ?? attachment.source_url);
  const cardJson = validateAttachmentCardJson(attachment.card ?? attachment.gif);

  if (attachment.provider !== "klipy") {
    throw new ContentRouteError("Post GIF provider is invalid.", 422);
  }

  if (resourceId === null) {
    throw new ContentRouteError("Post GIF id is required.", 422);
  }

  return {
    position,
    kind: "gif",
    url: validatePostGifUrl(attachment.url),
    mime: "image/gif",
    sizeBytes: null,
    width: validateOptionalPositiveInteger(attachment.width, "GIF width", 4_294_967_295),
    height: validateOptionalPositiveInteger(attachment.height, "GIF height", 4_294_967_295),
    durationSeconds: null,
    posterUrl: null,
    provider: "klipy",
    resourceType: "gif",
    resourceId,
    resourceKey,
    sourceUrl,
    cardJson,
  };
}

function validatePostIntegrationAttachment(
  attachment: Record<string, unknown>,
  position: number,
): ValidatedPostAttachment {
  const provider = validatePostIntegrationProvider(attachment.provider);
  const resourceType = validateOptionalToken(attachment.resourceType ?? attachment.resource_type, "Integration resource type", 40);
  const resourceId = validateOptionalToken(attachment.resourceId ?? attachment.resource_id, "Integration resource id", 191);
  const resourceKey = validateOptionalToken(attachment.resourceKey ?? attachment.resource_key, "Integration resource key", 255);
  const sourceUrl = validateIntegrationSourceUrl(attachment.sourceUrl ?? attachment.source_url);
  const cardJson = validateAttachmentCardJson(attachment.card ?? attachment.integration);

  return {
    position,
    kind: "integration",
    url: null,
    mime: null,
    sizeBytes: null,
    width: null,
    height: null,
    durationSeconds: null,
    posterUrl: null,
    provider,
    resourceType,
    resourceId,
    resourceKey,
    sourceUrl,
    cardJson,
  };
}

function legacyPostMediaFromAttachments(attachments: ValidatedPostAttachment[]): ValidatedPostMedia {
  const compatible = attachments.find(
    (attachment) =>
      attachment.url !== null &&
      (attachment.kind === "image" || attachment.kind === "video"),
  );

  if (compatible === undefined || (compatible.kind !== "image" && compatible.kind !== "video")) {
    return {
      mime: null,
      posterUrl: null,
      type: null,
      url: null,
    };
  }

  return {
    mime: compatible.mime,
    posterUrl: compatible.posterUrl,
    type: compatible.kind,
    url: compatible.url,
  };
}

function validatePostAttachmentKind(value: unknown, url: unknown): PostAttachmentKind {
  if (value === "image" || value === "video" || value === "audio" || value === "integration" || value === "gif") {
    return value;
  }

  if (value !== undefined && value !== null && value !== "") {
    throw new ContentRouteError("Post attachment type is invalid.", 422);
  }

  if (typeof url === "string") {
    const trimmed = url.trim();

    if (/\.mp3$/iu.test(trimmed)) {
      return "audio";
    }

    if (/\.(?:mp4|webm)$/iu.test(trimmed)) {
      return "video";
    }
  }

  return "image";
}

function validatePostAttachmentUploadUrl(value: unknown, kind: Exclude<PostAttachmentKind, "integration" | "gif">): string {
  if (typeof value !== "string") {
    throw new ContentRouteError("Post attachment URL is invalid.", 422);
  }

  const trimmed = value.trim();

  if (trimmed.length > 500) {
    throw new ContentRouteError("Post attachment URL is too long.", 422);
  }

  const extensionPattern =
    kind === "audio"
      ? "mp3"
      : kind === "video"
        ? "mp4|webm"
        : "jpe?g|png|webp|gif";
  const pattern = new RegExp(
    `^/uploads/media/[0-9]{4}/[0-9]{2}/[a-z0-9_-]+\\.(?:${extensionPattern})$`,
    "u",
  );

  if (!pattern.test(trimmed)) {
    throw new ContentRouteError("Use Upload media to attach a file.", 422);
  }

  return trimmed;
}

function validatePostGifUrl(value: unknown): string {
  if (typeof value !== "string") {
    throw new ContentRouteError("Post GIF URL is invalid.", 422);
  }

  const trimmed = value.trim();

  if (trimmed.length > 500) {
    throw new ContentRouteError("Post GIF URL is too long.", 422);
  }

  try {
    const url = new URL(trimmed);

    if (
      url.protocol === "https:" &&
      url.username === "" &&
      url.password === "" &&
      klipyHostAllowed(url.hostname)
    ) {
      return url.toString();
    }
  } catch {
    // Fall through to a user-facing route error.
  }

  throw new ContentRouteError("Choose a KLIPY GIF.", 422);
}

function validatePostAttachmentMime(
  value: unknown,
  kind: Exclude<PostAttachmentKind, "integration" | "gif">,
  url: string,
): string {
  if (typeof value === "string" && value.trim() !== "") {
    const mime = value.trim().toLowerCase();

    if (kind === "image" && ["image/jpeg", "image/png", "image/webp", "image/gif"].includes(mime)) {
      return mime;
    }

    if (kind === "video" && ["video/mp4", "video/webm"].includes(mime)) {
      return mime;
    }

    if (kind === "audio" && mime === "audio/mpeg") {
      return mime;
    }

    throw new ContentRouteError("Post attachment MIME is invalid.", 422);
  }

  if (kind === "audio") {
    return "audio/mpeg";
  }

  return kind === "video" ? (url.endsWith(".webm") ? "video/webm" : "video/mp4") : imageMimeFromUrl(url);
}

function imageMimeFromUrl(url: string): string {
  if (url.endsWith(".png")) {
    return "image/png";
  }

  if (url.endsWith(".gif")) {
    return "image/gif";
  }

  if (url.endsWith(".jpg") || url.endsWith(".jpeg")) {
    return "image/jpeg";
  }

  return "image/webp";
}

function validatePostAttachmentPosterUrl(
  value: unknown,
  kind: Exclude<PostAttachmentKind, "integration" | "gif">,
): string | null {
  if (kind !== "video") {
    if (value !== undefined && value !== null && value !== "") {
      throw new ContentRouteError("Post attachment poster URL is invalid.", 422);
    }

    return null;
  }

  if (typeof value !== "string") {
    throw new ContentRouteError("Post video poster is required.", 422);
  }

  const trimmed = value.trim();

  if (!/^\/uploads\/media\/[0-9]{4}\/[0-9]{2}\/[a-z0-9_-]+-poster\.webp$/u.test(trimmed)) {
    throw new ContentRouteError("Post video poster URL is invalid.", 422);
  }

  return trimmed;
}

function validatePostIntegrationProvider(value: unknown): string {
  if (value === "spotify" || value === "youtube" || value === "apple_music") {
    return value;
  }

  throw new ContentRouteError("Post music integration provider is invalid.", 422);
}

function validateIntegrationSourceUrl(value: unknown): string {
  if (typeof value !== "string") {
    throw new ContentRouteError("Post music integration URL is invalid.", 422);
  }

  const trimmed = value.trim();

  if (trimmed.length > 500) {
    throw new ContentRouteError("Post music integration URL is too long.", 422);
  }

  try {
    const url = new URL(trimmed);
    const host = url.hostname.replace(/^www\./u, "").toLowerCase();

    if (
      url.protocol === "https:" &&
      ["open.spotify.com", "music.youtube.com", "youtube.com", "youtu.be", "music.apple.com", "itunes.apple.com"].includes(host)
    ) {
      return url.toString();
    }
  } catch {
    // Fall through to a user-facing route error.
  }

  throw new ContentRouteError("Choose a supported music integration URL.", 422);
}

function validateOptionalGifSourceUrl(value: unknown): string | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  if (typeof value !== "string") {
    throw new ContentRouteError("Post GIF source URL is invalid.", 422);
  }

  const trimmed = value.trim();

  if (trimmed.length > 500) {
    throw new ContentRouteError("Post GIF source URL is too long.", 422);
  }

  try {
    const url = new URL(trimmed);

    if (
      url.protocol === "https:" &&
      url.username === "" &&
      url.password === "" &&
      klipyHostAllowed(url.hostname)
    ) {
      return url.toString();
    }
  } catch {
    // Fall through to a user-facing route error.
  }

  throw new ContentRouteError("Post GIF source URL is invalid.", 422);
}

function klipyHostAllowed(value: string): boolean {
  const host = value.toLowerCase().replace(/\.$/u, "");

  return host === "klipy.com" || host.endsWith(".klipy.com");
}

function validateOptionalToken(value: unknown, label: string, maxLength: number): string | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  if (typeof value !== "string") {
    throw new ContentRouteError(`${label} is invalid.`, 422);
  }

  const trimmed = value.trim();

  if (trimmed === "") {
    return null;
  }

  if (trimmed.length > maxLength || !/^[A-Za-z0-9:_./-]+$/u.test(trimmed)) {
    throw new ContentRouteError(`${label} is invalid.`, 422);
  }

  return trimmed;
}

function validateOptionalPositiveInteger(
  value: unknown,
  label: string,
  max = Number.MAX_SAFE_INTEGER,
): number | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const number = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;

  if (!Number.isSafeInteger(number) || number <= 0 || number > max) {
    throw new ContentRouteError(`${label} is invalid.`, 422);
  }

  return number;
}

function validateOptionalPositiveNumber(
  value: unknown,
  label: string,
  max = Number.MAX_VALUE,
): number | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const number = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;

  if (!Number.isFinite(number) || number <= 0 || number > max) {
    throw new ContentRouteError(`${label} is invalid.`, 422);
  }

  return number;
}

function validateAttachmentCardJson(value: unknown): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== "object") {
    throw new ContentRouteError("Post music integration card is invalid.", 422);
  }

  const json = JSON.stringify(value);

  if (json.length > 16000) {
    throw new ContentRouteError("Post music integration card is too large.", 422);
  }

  return json;
}

function validatePostMediaUrl(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value !== "string") {
    throw new ContentRouteError("Post media is invalid.", 422);
  }

  const trimmed = value.trim();

  if (trimmed === "") {
    return null;
  }

  if (trimmed.length > 255) {
    throw new ContentRouteError("Post media URL is too long.", 422);
  }

  if (!/^\/uploads\/media\/[0-9]{4}\/[0-9]{2}\/[a-z0-9_-]+\.(?:jpe?g|png|webp|gif|mp4|webm)$/u.test(trimmed)) {
    throw new ContentRouteError("Use Upload media to attach a file.", 422);
  }

  return trimmed;
}

function validatePostMediaType(value: unknown, url: string): "image" | "video" {
  if (value === "image" || value === "video") {
    return value;
  }

  if (value !== undefined && value !== null && value !== "") {
    throw new ContentRouteError("Post media type is invalid.", 422);
  }

  return /\.(?:mp4|webm)$/iu.test(url) ? "video" : "image";
}

function validatePostMediaMime(value: unknown, type: "image" | "video", url: string): string {
  if (typeof value === "string" && value.trim() !== "") {
    const mime = value.trim().toLowerCase();

    if (type === "image" && ["image/jpeg", "image/png", "image/webp", "image/gif"].includes(mime)) {
      return mime;
    }

    if (type === "video" && ["video/mp4", "video/webm"].includes(mime)) {
      return mime;
    }

    throw new ContentRouteError("Post media MIME is invalid.", 422);
  }

  if (type === "video") {
    return url.endsWith(".webm") ? "video/webm" : "video/mp4";
  }

  if (url.endsWith(".png")) {
    return "image/png";
  }

  if (url.endsWith(".gif")) {
    return "image/gif";
  }

  if (url.endsWith(".jpg") || url.endsWith(".jpeg")) {
    return "image/jpeg";
  }

  return "image/webp";
}

function validatePostMediaPosterUrl(value: unknown, type: "image" | "video"): string | null {
  if (type === "image") {
    if (value !== undefined && value !== null && value !== "") {
      throw new ContentRouteError("Post image poster URL is invalid.", 422);
    }

    return null;
  }

  if (typeof value !== "string") {
    throw new ContentRouteError("Post video poster is required.", 422);
  }

  const trimmed = value.trim();

  if (!/^\/uploads\/media\/[0-9]{4}\/[0-9]{2}\/[a-z0-9_-]+-poster\.webp$/u.test(trimmed)) {
    throw new ContentRouteError("Post video poster URL is invalid.", 422);
  }

  return trimmed;
}

function validatePostShareRecipientIds(value: unknown): number[] {
  if (!Array.isArray(value)) {
    throw new ContentRouteError("Choose at least one moot to share with.", 422);
  }

  const ids = new Set<number>();

  for (const rawId of value) {
    if (!isPositiveIntegerLike(rawId)) {
      throw new ContentRouteError("Recipient ids must be numeric.", 422);
    }

    ids.add(Number(rawId));
  }

  const recipientIds = [...ids];

  if (recipientIds.length === 0) {
    throw new ContentRouteError("Choose at least one moot to share with.", 422);
  }

  if (recipientIds.length > 10) {
    throw new ContentRouteError("Share with up to 10 moots at once.", 422);
  }

  return recipientIds;
}

function validatePostShareNote(value: unknown): string | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (typeof value !== "string") {
    throw new ContentRouteError("Share note must be text.", 422);
  }

  const note = value.trim();

  if (note === "") {
    return null;
  }

  if (note.length > 500) {
    throw new ContentRouteError("Share note must be 500 characters or fewer.", 422);
  }

  return note;
}

function roomText(value: unknown, label: string, minLength: number, maxLength: number): string {
  if (typeof value !== "string") {
    throw new ContentRouteError(`${label} is required.`, 422);
  }

  const text = value.replace(/\s+/gu, " ").trim();

  if (text.length < minLength || text.length > maxLength || roomContainsHtml(text)) {
    throw new ContentRouteError(`${label} must be ${minLength}-${maxLength} visible characters without HTML.`, 422);
  }

  return text;
}

function roomOptionalText(value: unknown, label: string, maxLength: number): string | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (typeof value !== "string") {
    throw new ContentRouteError(`${label} must be text.`, 422);
  }

  const text = value.trim();

  if (text.length > maxLength || roomContainsHtml(text)) {
    throw new ContentRouteError(`${label} must be ${maxLength} characters or fewer without HTML.`, 422);
  }

  return text === "" ? null : text;
}

function roomOptionalToken(value: unknown, label: string, maxLength: number): string | null {
  const text = roomOptionalText(value, label, maxLength);

  if (text !== null && !new RegExp(`^[a-z0-9][a-z0-9 -]{0,${maxLength - 1}}$`, "u").test(text)) {
    throw new ContentRouteError(`${label} uses unsupported characters.`, 422);
  }

  return text;
}

function roomContainsHtml(value: string): boolean {
  return value !== value.replace(/<[^>]*>/gu, "") || /<\s*\/?\s*[a-z][^>]*>/iu.test(value) || /javascript\s*:/iu.test(value);
}

function roomSlugFromValue(value: unknown, name: string): string {
  let slug: string;

  if (value === null || value === undefined || value === "") {
    slug = name.toLowerCase().replace(/[^a-z0-9]+/gu, "-").replace(/^-+|-+$/gu, "");
  } else if (typeof value === "string") {
    slug = value.trim().toLowerCase();
  } else {
    throw new ContentRouteError("Slug must be text.", 422);
  }

  if (!/^[a-z0-9](?:[a-z0-9-]{1,78}[a-z0-9])$/u.test(slug)) {
    throw new ContentRouteError("Slug must be 3-80 characters using lowercase letters, numbers, and dashes.", 422);
  }

  return slug;
}

function rejectDeprecatedRoomAccent(body: Record<string, unknown>): void {
  if ("accent" in body || "room_accent" in body) {
    throw new ContentRouteError("Room Accent is deprecated. Choose a supported room theme.", 422);
  }
}

function roomThemeValues(
  body: Record<string, unknown>,
  create: boolean,
): { theme: string | null; themeConfigJson: string | null } | undefined {
  const hasTheme = "theme" in body || "roomTheme" in body || "room_theme" in body;
  const hasThemeConfig =
    "themeConfig" in body ||
    "roomThemeConfig" in body ||
    "theme_config_json" in body ||
    "room_theme_config_json" in body;

  if (!create && !hasTheme && !hasThemeConfig) {
    return undefined;
  }

  const theme = hasTheme
    ? roomThemeToken(bodyValue(body, "theme", "roomTheme", "room_theme"))
    : undefined;
  const config = hasThemeConfig
    ? roomThemeConfig(
        bodyValue(
          body,
          "themeConfig",
          "roomThemeConfig",
          "theme_config_json",
          "room_theme_config_json",
        ),
      )
    : undefined;

  if (config === undefined) {
    if (theme === undefined || theme === null) {
      return { theme: null, themeConfigJson: null };
    }

    if (theme === "custom") {
      throw new ContentRouteError("Custom room theme colors are required.", 422);
    }

    return {
      theme,
      themeConfigJson: JSON.stringify({ mode: "preset", preset: theme }),
    };
  }

  if (config === null) {
    if (theme && theme !== "custom") {
      return {
        theme,
        themeConfigJson: JSON.stringify({ mode: "preset", preset: theme }),
      };
    }

    return { theme: null, themeConfigJson: null };
  }

  if (config.mode === "preset") {
    if (theme && theme !== config.preset) {
      throw new ContentRouteError("Room theme does not match its saved colors.", 422);
    }

    return {
      theme: config.preset,
      themeConfigJson: JSON.stringify(config),
    };
  }

  if (theme && theme !== "custom") {
    throw new ContentRouteError("Custom room theme must use the custom theme token.", 422);
  }

  return {
    theme: "custom",
    themeConfigJson: JSON.stringify(config),
  };
}

function roomThemeToken(value: unknown): string | null | undefined {
  const normalized = validateRoomThemeToken(value);

  if (normalized !== undefined) {
    return normalized;
  }

  if (value === "custom") {
    return "custom";
  }

  throw new ContentRouteError("Choose a supported room theme.", 422);
}

function roomThemeConfig(value: unknown): RoomThemeConfig | null {
  const normalized = normalizeRoomThemeConfig(value);

  if (normalized === undefined) {
    throw new ContentRouteError("Room theme config is invalid.", 422);
  }

  return normalized;
}

function roomUploadUrl(value: unknown, label: string): string | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (typeof value !== "string") {
    throw new ContentRouteError(`${label} must be an uploaded image URL.`, 422);
  }

  const url = value.trim();

  if (!/^\/uploads\/media\/[0-9]{4}\/[0-9]{2}\/(?:room_icon|room_banner)-[a-f0-9]{32}\.(?:jpe?g|png|webp|gif)$/u.test(url)) {
    throw new ContentRouteError(`${label} must come from the image upload endpoint.`, 422);
  }

  return url;
}

function roomVisibility(value: unknown): RoomVisibility {
  if (value === "public" || value === "private" || value === "invite" || value === "view_only") {
    return value;
  }

  throw new ContentRouteError("Choose a supported room visibility.", 422);
}

export function roomRulesAcceptanceVersion(body: Record<string, unknown>): number {
  if (body.acceptedRules !== true) {
    throw new ContentRouteError("Review and accept the room rules before continuing.", 422);
  }

  const version = validateOptionalPositiveInteger(body.acceptedRulesVersion, "Accepted room rules version");

  if (version === null) {
    throw new ContentRouteError("Review and accept the current room rules before continuing.", 422);
  }

  return version;
}

export function assertCurrentRoomRulesVersion(
  room: Pick<RoomRecordRow, "rules_version">,
  acceptedRulesVersion: number,
): void {
  if (Math.max(1, numberValue(room.rules_version)) !== acceptedRulesVersion) {
    throw new ContentRouteError("Room rules changed. Review the current rules before continuing.", 409);
  }
}

export function roomInvitationAllowsJoin(
  visibility: string,
  invitationStatus: string | null,
): boolean {
  return visibility === "public" || invitationStatus === "pending";
}

export function roomFeedViewerCanPost(
  visibility: string,
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

function bodyValue(body: Record<string, unknown>, primaryKey: string, ...otherKeys: string[]): unknown {
  for (const key of [primaryKey, ...otherKeys]) {
    if (key in body) {
      return body[key];
    }
  }

  return undefined;
}

function roomAccessRequestSelectSql(): string {
  return `SELECT
            requests.id,
            requests.status,
            requests.reviewed_at,
            requests.created_at,
            requests.updated_at,
            requester.id AS requester_user_id,
            requester.handle AS requester_handle,
            requester_profile.display_name AS requester_display_name,
            requester_profile.avatar_url AS requester_avatar_url,
            reviewer.id AS reviewer_user_id,
            reviewer.handle AS reviewer_handle,
            reviewer_profile.display_name AS reviewer_display_name,
            reviewer_profile.avatar_url AS reviewer_avatar_url
          FROM room_access_requests requests
          INNER JOIN users requester ON requester.id = requests.requester_id
          INNER JOIN profiles requester_profile ON requester_profile.user_id = requester.id
          LEFT JOIN users reviewer ON reviewer.id = requests.reviewed_by
          LEFT JOIN profiles reviewer_profile ON reviewer_profile.user_id = reviewer.id`;
}

function roomAccessRequestPayloadFromRow(row: RoomAccessRequestRow): RoomAccessRequestPayload {
  const requesterHandle = stringValue(row.requester_handle);
  const requesterDisplayName = stringValue(row.requester_display_name, requesterHandle);
  const requester: UserPayload = {
    id: numberValue(row.requester_user_id),
    handle: requesterHandle,
    displayName: requesterDisplayName,
    initials: initialsFromName(requesterDisplayName),
    aura: "frost",
    avatarUrl: nullableStringValue(row.requester_avatar_url),
  };
  let reviewedBy: UserPayload | null = null;

  if (row.reviewer_user_id !== null && row.reviewer_handle !== null) {
    const reviewerHandle = stringValue(row.reviewer_handle);
    const reviewerDisplayName = stringValue(row.reviewer_display_name, reviewerHandle);
    reviewedBy = {
      id: numberValue(row.reviewer_user_id),
      handle: reviewerHandle,
      displayName: reviewerDisplayName,
      initials: initialsFromName(reviewerDisplayName),
      aura: "frost",
      avatarUrl: nullableStringValue(row.reviewer_avatar_url),
    };
  }

  return {
    id: numberValue(row.id),
    status: roomAccessRequestStatus(row.status),
    createdAt: nullableStringValue(row.created_at),
    updatedAt: nullableStringValue(row.updated_at),
    reviewedAt: nullableStringValue(row.reviewed_at),
    requester,
    reviewedBy,
  };
}

function roomAccessRequestStatus(value: string | null): RoomAccessRequestStatus {
  return value === "approved" || value === "denied" || value === "canceled" ? value : "pending";
}

function textEntityPayloadFromRow(row: TextEntityRow): TextEntityPayload | null {
  const type = stringValue(row.entity_type);
  const payload: TextEntityPayload = {
    type,
    start: numberValue(row.entity_start),
    length: numberValue(row.entity_length),
    text: stringValue(row.text_value),
  };

  if (type === "mention") {
    if (row.target_user_id === null || row.target_handle === null) {
      return null;
    }

    const handle = stringValue(row.target_handle);
    const displayName = stringValue(row.target_display_name, handle);
    payload.mention = {
      handle,
      user: {
        id: numberValue(row.target_user_id),
        handle,
        displayName,
        initials: initialsFromName(displayName),
        aura: "frost",
        avatarUrl: nullableStringValue(row.target_avatar_url),
      },
    };
  }

  if (type === "link") {
    if (row.url === null) {
      return null;
    }

    payload.link = {
      url: row.url,
    };

    const card = jsonArrayOrObject(row.card_json);

    if (card !== null) {
      payload.link.card = card;
    }
  }

  return payload;
}

function userPayloadFromRow(row: UserRow): UserPayload {
  const handle = stringValue(row.handle);
  const displayName = stringValue(row.display_name, handle);

  return {
    id: numberValue(row.user_id),
    handle,
    displayName,
    initials: initialsFromName(displayName),
    aura: "frost",
    avatarUrl: nullableStringValue(row.avatar_url),
  };
}

function isModeratorSession(session: RequestSession): boolean {
  return session.role === "admin" || session.role === "moderator";
}

function roomCapabilitiesFromContent(capabilities: ContentCapabilities): RoomSchemaCapabilities {
  return {
    hasRoomMemberships: capabilities.hasRoomMemberships,
    hasRoomCustomizationColumns: capabilities.hasRoomCustomizationColumns,
    hasRoomThemeColumns: capabilities.hasRoomThemeColumns,
    hasLegacyRoomAccentColumn: capabilities.hasLegacyRoomAccentColumn,
    hasRoomSoftDeleteColumn: capabilities.hasRoomSoftDeleteColumn,
    hasRoomAccessRequests: capabilities.hasRoomAccessRequests,
    hasRoomRulesVersionColumn: capabilities.hasRoomRulesVersionColumn,
    hasRoomInvitations: capabilities.hasRoomInvitations,
  };
}

function userPubliclyAvailableSql(alias: string, capabilities: ContentCapabilities): string {
  validateSchemaIdentifier(alias);

  if (!capabilities.hasAccountDeletionRequests) {
    return `${alias}.status = 'active'`;
  }

  return `${alias}.status = 'active'
    AND NOT EXISTS (
      SELECT 1
      FROM account_deletion_requests deletion_requests
      WHERE deletion_requests.user_id = ${alias}.id
        AND deletion_requests.completed_at IS NULL
        AND deletion_requests.canceled_at IS NULL
    )`;
}

function roomNotDeletedSql(alias: string, capabilities: ContentCapabilities): string {
  validateSchemaIdentifier(alias);

  return capabilities.hasRoomSoftDeleteColumn ? `AND ${alias}.deleted_at IS NULL` : "";
}

function pairNotBlockedSql(leftUserSql: string, rightUserSql: string, capabilities: ContentCapabilities): string {
  if (!capabilities.hasUserBlocks) {
    return "";
  }

  return `AND NOT EXISTS (
      SELECT 1
      FROM user_blocks pair_blocks
      WHERE (pair_blocks.blocker_id = ${leftUserSql} AND pair_blocks.blocked_id = ${rightUserSql})
         OR (pair_blocks.blocker_id = ${rightUserSql} AND pair_blocks.blocked_id = ${leftUserSql})
    )`;
}

function notificationPreferenceKey(type: string): string {
  switch (type) {
    case "follow":
      return "follows";
    case "moot":
      return "moots";
    case "like":
      return "likes";
    case "reply":
      return "replies";
    case "reblog":
      return "reblogs";
    case "message":
      return "messages";
    case "mention":
      return "mentions";
    case "badge_granted":
      return "badges";
    default:
      return type;
  }
}

function jsonArrayOrObject(value: string | null): Record<string, unknown> | unknown[] | null {
  if (value === null || value === "") {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(value);

    return typeof parsed === "object" && parsed !== null ? parsed as Record<string, unknown> | unknown[] : null;
  } catch {
    return null;
  }
}

function jsonObject(value: string): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(value);

    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
}

function validateSchemaIdentifier(value: string): void {
  if (!/^[A-Za-z0-9_]+$/u.test(value)) {
    throw new Error(`Invalid schema identifier: ${value}`);
  }
}

function isPositiveIntegerLike(value: unknown): boolean {
  return typeof value === "number" && Number.isInteger(value) && value > 0
    || typeof value === "string" && /^[0-9]+$/u.test(value) && Number(value) > 0;
}

function safeDecodeURIComponent(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function isDuplicateKeyError(error: unknown): boolean {
  if (error === null || typeof error !== "object") {
    return false;
  }

  const record = error as Record<string, unknown>;

  return record.code === "ER_DUP_ENTRY" || record.errno === 1062;
}

function numberValue(value: number | string | boolean | null | undefined): number {
  if (value === null || value === undefined || value === "") {
    return 0;
  }

  if (typeof value === "boolean") {
    return value ? 1 : 0;
  }

  const number = Number(value);

  return Number.isFinite(number) ? number : 0;
}

function nullableNumberValue(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const number = Number(value);

  return Number.isFinite(number) ? number : null;
}

function booleanValue(value: number | string | boolean | null | undefined): boolean {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return value !== 0;
  }

  if (typeof value === "string") {
    return value !== "" && value !== "0";
  }

  return false;
}

function stringValue(value: string | number | null | undefined, fallback = ""): string {
  if (value === null || value === undefined) {
    return fallback;
  }

  return String(value);
}

function nullableStringValue(value: string | number | Date | null | undefined): string | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  return String(value);
}
