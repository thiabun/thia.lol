import { randomBytes } from "node:crypto";

import type { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";

import {
  normalizePostIdentifier,
  postCanonicalPath,
} from "./posts.js";
import {
  normalizeProfileHandle,
  postAncestorVisibilityJoinsSql,
  postAncestorVisibilitySql,
  postPayloadFromRow,
  postSelectSql,
  publicPostVisibleSql,
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
  type RoomMemberPayload,
  type RoomMemberRow,
  type RoomPayload,
  type RoomRow,
  type RoomSchemaCapabilities,
  type UserPayload,
} from "./rooms.js";
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
  reblogPost(postId: number, viewerUserId: number): Promise<ReblogPayload>;
  unreblogPost(postId: number, viewerUserId: number): Promise<ReblogPayload>;
  reactToPost(postId: number, viewerUserId: number, body: Record<string, unknown>): Promise<ReactionPayload>;
  deletePostReaction(postId: number, viewerUserId: number, type: string): Promise<ReactionPayload>;
  sharePostToMessages(
    identifier: string,
    viewerUserId: number,
    body: Record<string, unknown>,
  ): Promise<PostShareMessagesPayload>;
  createRoom(session: RequestSession, body: Record<string, unknown>): Promise<RoomPayload>;
  updateRoom(session: RequestSession, slug: string, body: Record<string, unknown>): Promise<RoomPayload>;
  deleteRoom(session: RequestSession, slug: string): Promise<RoomDeletePayload>;
  joinRoom(session: RequestSession, slug: string): Promise<RoomPayload>;
  leaveRoom(session: RequestSession, slug: string): Promise<RoomPayload>;
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

export interface PostShareSummaryPayload {
  id: number;
  publicId: string;
  canonicalPath: string;
  canonicalUrl: string;
  bodySnippet: string;
  createdAt: string | null;
  mediaUrl: string | null;
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

interface ContentCapabilities extends ProfileSchemaCapabilities {
  hasNotifications: boolean;
  hasUserPreferences: boolean;
  hasConversations: boolean;
  hasConversationMembers: boolean;
  hasMessages: boolean;
  hasMessageAttachments: boolean;
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
  accent: string | null;
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

interface ConversationRow extends RowDataPacket {
  id: number | string;
}

const reactionTypes = ["glow", "echo", "hush"] as const;
const roomAccents = new Set([
  "var(--accent-sun)",
  "var(--accent-frost)",
  "var(--accent-leaf)",
  "var(--accent-rose)",
  "var(--app-accent)",
]);

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
    const roomId = await this.resolveRoomId(body, capabilities);
    const parentId = await this.resolveParentId(body.parentId ?? body.parent_id, capabilities);
    const mood = validateOptionalText(body.mood, 80, "Mood") ?? "sunveil";
    const mediaUrl = validatePostMediaUrl(body.mediaUrl ?? body.media_url);
    const publicId = capabilities.hasPostPublicIdColumn ? await this.generatePostPublicId() : null;
    const insertColumns = ["author_id", "room_id", "parent_id", "body", "mood", "media_url", "visibility", "status"];
    const insertValues: Array<number | string | null> = [
      session.userId,
      roomId,
      parentId,
      postBody,
      mood,
      mediaUrl,
      "public",
      "published",
    ];

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

    await this.storeTextEntitiesForPost(postId, postBody, session.userId, roomId, postId, capabilities);

    return this.fetchPostPayloadById(postId, session.userId, capabilities);
  }

  async createReply(session: RequestSession, postId: number, body: Record<string, unknown>): Promise<PostPayload> {
    const capabilities = await this.schemaCapabilities();
    const parent = await this.fetchReplyablePostRecord(postId, capabilities);

    if (parent === null) {
      throw new ContentRouteError("Post not found.", 404);
    }

    const postBody = validatePostBody(body.body);
    const mediaUrl = validatePostMediaUrl(body.mediaUrl ?? body.media_url);
    const roomId = nullableNumberValue(parent.room_id);
    const publicId = capabilities.hasPostPublicIdColumn ? await this.generatePostPublicId() : null;
    const insertColumns = ["author_id", "room_id", "parent_id", "body", "mood", "media_url", "visibility", "status"];
    const insertValues: Array<number | string | null> = [
      session.userId,
      roomId,
      postId,
      postBody,
      parent.mood ?? "sunveil",
      mediaUrl,
      "public",
      "published",
    ];

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

      updatedRoomId = await this.resolveRoomId(body, capabilities);
      updates.push("room_id = ?");
      params.push(updatedRoomId);
    }

    if ("parentId" in body || "parent_id" in body) {
      if (!isAuthor) {
        throw new ContentRouteError("Only the author can update the parent post.", 403);
      }

      const parentId = await this.resolveParentId(body.parentId ?? body.parent_id, capabilities);

      if (parentId === postId) {
        throw new ContentRouteError("A post cannot be its own parent.", 422);
      }

      updates.push("parent_id = ?");
      params.push(parentId);
    }

    if ("mediaUrl" in body || "media_url" in body) {
      if (!isAuthor) {
        throw new ContentRouteError("Only the author can update this post image.", 403);
      }

      updates.push("media_url = ?");
      params.push(validatePostMediaUrl(body.mediaUrl ?? body.media_url));
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
    const post = await this.fetchReactablePostRecord(postId, capabilities);

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

    await this.requireReactablePost(postId, capabilities);
    await this.pool.execute<ResultSetHeader>(
      `DELETE FROM post_reactions
       WHERE post_id = ?
         AND user_id = ?
         AND type = 'glow'`,
      [postId, viewerUserId],
    );

    return this.likePayloadForPost(postId, viewerUserId);
  }

  async reblogPost(postId: number, viewerUserId: number): Promise<ReblogPayload> {
    const capabilities = await this.schemaCapabilities();
    this.requireTable(capabilities.hasPostReblogs, "Reblog storage is not ready. Run pending migrations.");
    const post = await this.fetchReactablePostRecord(postId, capabilities);

    if (post === null) {
      throw new ContentRouteError("Post not found.", 404);
    }

    const postAuthorId = numberValue(post.author_id);

    if (postAuthorId === viewerUserId) {
      throw new ContentRouteError("You cannot reblog your own post.", 409);
    }

    const [insert] = await this.pool.execute<ResultSetHeader>(
      `INSERT IGNORE INTO post_reblogs (post_id, user_id)
       VALUES (?, ?)`,
      [postId, viewerUserId],
    );

    if (insert.affectedRows > 0) {
      await this.createNotification(
        postAuthorId,
        viewerUserId,
        "reblog",
        postId,
        nullableNumberValue(post.room_id),
        null,
        true,
        capabilities,
      );
    }

    return this.reblogPayloadForPost(postId, viewerUserId);
  }

  async unreblogPost(postId: number, viewerUserId: number): Promise<ReblogPayload> {
    const capabilities = await this.schemaCapabilities();
    this.requireTable(capabilities.hasPostReblogs, "Reblog storage is not ready. Run pending migrations.");
    await this.requireReactablePost(postId, capabilities);
    await this.pool.execute<ResultSetHeader>(
      `DELETE FROM post_reblogs
       WHERE post_id = ?
         AND user_id = ?`,
      [postId, viewerUserId],
    );

    return this.reblogPayloadForPost(postId, viewerUserId);
  }

  async reactToPost(postId: number, viewerUserId: number, body: Record<string, unknown>): Promise<ReactionPayload> {
    const capabilities = await this.schemaCapabilities();
    const post = await this.fetchReactablePostRecord(postId, capabilities);

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
    await this.requireReactablePost(postId, capabilities);
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

    const post = await this.fetchPostPayloadByIdentifier(identifier, viewerUserId, capabilities);

    if (post === null) {
      throw new ContentRouteError("Post not found.", 404);
    }

    const recipientIds = validatePostShareRecipientIds(body.recipientUserIds);
    const note = validatePostShareNote(body.note);
    const canonicalUrl = `${this.options.publicBaseUrl.replace(/\/+$/u, "")}${postCanonicalPath(post)}`;
    const messageBody = `${note === null ? "Shared a post with you." : note}\n${canonicalUrl}`.trim();
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

      const { conversationId, messageId } = await this.createDirectPostShareMessage(
        viewerUserId,
        recipientUserId,
        messageBody,
        post.id,
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

  async createRoom(session: RequestSession, body: Record<string, unknown>): Promise<RoomPayload> {
    const capabilities = await this.schemaCapabilities();

    this.requireRoomStorage(capabilities);
    const name = roomText(body.name, "Name", 2, 80);
    const slug = roomSlugFromValue(body.slug, name);
    const summary = roomText(bodyValue(body, "summary", "description"), "Summary", 5, 500);
    const mood = roomOptionalToken(body.mood, "Mood", 40);
    const accent = roomAccent(body.accent);
    const iconUrl = roomUploadUrl(bodyValue(body, "iconUrl", "icon_url"), "Icon URL");
    const bannerUrl = roomUploadUrl(bodyValue(body, "bannerUrl", "banner_url"), "Banner URL");
    const rules = roomOptionalText(body.rules, "Room rules", 3000);
    const visibility = roomVisibility(body.visibility ?? "public");

    try {
      await this.withTransaction(async (connection) => {
        const [result] = await connection.execute<ResultSetHeader>(
          `INSERT INTO rooms (slug, name, summary, mood, member_count, is_live, accent, icon_url, banner_url, rules, visibility, created_by)
           VALUES (?, ?, ?, ?, 1, 0, ?, ?, ?, ?, ?, ?)`,
          [slug, name, summary, mood, accent, iconUrl, bannerUrl, rules, visibility, session.userId],
        );
        const roomId = result.insertId;

        await connection.execute<ResultSetHeader>(
          `INSERT INTO room_memberships (room_id, user_id, role)
           VALUES (?, ?, 'owner')`,
          [roomId, session.userId],
        );
        await this.syncRoomMemberCount(roomId, connection);
        await this.grantOwnerBadgeIfFirstRoom(session.userId, connection, capabilities);
      });
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        throw new ContentRouteError("Room slug is already in use.", 409);
      }

      throw error;
    }

    return this.fetchPublicRoomBySlug(slug, capabilities);
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

    if ("accent" in body) {
      updates.push("accent = ?");
      params.push(roomAccent(body.accent));
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
      updates.push("rules = ?");
      params.push(roomOptionalText(body.rules, "Room rules", 3000));
    }

    if ("visibility" in body) {
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

    return this.fetchPublicRoomBySlug(room.slug, capabilities);
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

  async joinRoom(session: RequestSession, slug: string): Promise<RoomPayload> {
    const capabilities = await this.schemaCapabilities();

    this.requireRoomStorage(capabilities);
    const room = await this.roomRecordBySlug(slug);

    if (room === null || room.visibility !== "public") {
      throw new ContentRouteError("Room not found.", 404);
    }

    const membership = await this.roomMembershipRecord(numberValue(room.id), session.userId);

    if (membership !== null && membership.banned_at !== null) {
      throw new ContentRouteError("You cannot join this room.", 403);
    }

    await this.pool.execute<ResultSetHeader>(
      `INSERT INTO room_memberships (room_id, user_id, role)
       VALUES (?, ?, 'member')
       ON DUPLICATE KEY UPDATE
         role = IF(role IN ('owner', 'moderator'), role, 'member'),
         banned_at = banned_at`,
      [numberValue(room.id), session.userId],
    );
    await this.syncRoomMemberCount(numberValue(room.id), this.pool);

    return this.fetchPublicRoomBySlug(room.slug, capabilities);
  }

  async leaveRoom(session: RequestSession, slug: string): Promise<RoomPayload> {
    const capabilities = await this.schemaCapabilities();

    this.requireRoomStorage(capabilities);
    const room = await this.roomRecordBySlug(slug);

    if (room === null || room.visibility !== "public") {
      throw new ContentRouteError("Room not found.", 404);
    }

    const membership = await this.roomMembershipRecord(numberValue(room.id), session.userId);

    if (membership === null || membership.banned_at !== null) {
      return this.fetchPublicRoomBySlug(room.slug, capabilities);
    }

    if (membership.role === "owner") {
      throw new ContentRouteError("Room owners cannot leave until ownership transfer exists.", 422);
    }

    await this.pool.execute<ResultSetHeader>(
      `DELETE FROM room_memberships
       WHERE room_id = ?
         AND user_id = ?`,
      [numberValue(room.id), session.userId],
    );
    await this.syncRoomMemberCount(numberValue(room.id), this.pool);

    return this.fetchPublicRoomBySlug(room.slug, capabilities);
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

    if (existing !== null && existing.banned_at !== null) {
      throw new ContentRouteError("Banned members cannot be made moderators.", 422);
    }

    await this.pool.execute<ResultSetHeader>(
      `INSERT INTO room_memberships (room_id, user_id, role)
       VALUES (?, ?, 'moderator')
       ON DUPLICATE KEY UPDATE
         role = IF(role = 'owner', role, 'moderator'),
         banned_at = banned_at`,
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

    return postPayloadFromRow(row, postEntities, profileEntities);
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
  ): Promise<PostRecordRow | null> {
    const [rows] = await this.pool.execute<PostRecordRow[]>(
      `SELECT p.id, p.author_id, p.room_id, p.mood, p.status
       FROM posts p
       LEFT JOIN rooms r ON r.id = p.room_id
       ${postAncestorVisibilityJoinsSql("p")}
       WHERE p.id = ?
         AND ${publicPostVisibleSql("p", "r", capabilities)}
         AND ${postAncestorVisibilitySql("p", capabilities)}
       LIMIT 1`,
      [postId],
    );

    return rows[0] ?? null;
  }

  private async fetchReactablePostRecord(
    postId: number,
    capabilities: ContentCapabilities,
  ): Promise<PostRecordRow | null> {
    const [rows] = await this.pool.execute<PostRecordRow[]>(
      `SELECT p.id, p.author_id, p.room_id, p.status
       FROM posts p
       LEFT JOIN rooms r ON r.id = p.room_id
       ${postAncestorVisibilityJoinsSql("p")}
       WHERE p.id = ?
         AND ${publicPostVisibleSql("p", "r", capabilities)}
         AND ${postAncestorVisibilitySql("p", capabilities)}
       LIMIT 1`,
      [postId],
    );

    return rows[0] ?? null;
  }

  private async requireReactablePost(postId: number, capabilities: ContentCapabilities): Promise<void> {
    if ((await this.fetchReactablePostRecord(postId, capabilities)) === null) {
      throw new ContentRouteError("Post not found.", 404);
    }
  }

  private async resolveRoomId(body: Record<string, unknown>, capabilities: ContentCapabilities): Promise<number | null> {
    if ("roomId" in body || "room_id" in body) {
      const rawRoomId = body.roomId ?? body.room_id;

      if (!isPositiveIntegerLike(rawRoomId)) {
        throw new ContentRouteError("Room id must be numeric.", 422);
      }

      return this.requireRoomId(Number(rawRoomId), capabilities);
    }

    if ("roomSlug" in body || "room_slug" in body) {
      const rawSlug = body.roomSlug ?? body.room_slug;

      if (typeof rawSlug !== "string") {
        throw new ContentRouteError("Room slug must be text.", 422);
      }

      return this.requireRoomSlug(rawSlug, capabilities);
    }

    return null;
  }

  private async requireRoomId(roomId: number, capabilities: ContentCapabilities): Promise<number> {
    const [rows] = await this.pool.execute<IdRow[]>(
      `SELECT id
       FROM rooms
       WHERE id = ?
         AND visibility = 'public'
         ${roomNotDeletedSql("rooms", capabilities)}
       LIMIT 1`,
      [roomId],
    );

    if (rows[0] === undefined) {
      throw new ContentRouteError("Room not found.", 422);
    }

    return roomId;
  }

  private async requireRoomSlug(roomSlug: string, capabilities: ContentCapabilities): Promise<number> {
    const slug = normalizeRoomSlug(roomSlug);

    if (slug === null) {
      throw new ContentRouteError("Room not found.", 422);
    }

    const [rows] = await this.pool.execute<IdRow[]>(
      `SELECT id
       FROM rooms
       WHERE slug = ?
         AND visibility = 'public'
         ${roomNotDeletedSql("rooms", capabilities)}
       LIMIT 1`,
      [slug],
    );
    const row = rows[0];

    if (row === undefined) {
      throw new ContentRouteError("Room not found.", 422);
    }

    return numberValue(row.id);
  }

  private async resolveParentId(value: unknown, capabilities: ContentCapabilities): Promise<number | null> {
    if (value === null || value === undefined || value === "") {
      return null;
    }

    if (!isPositiveIntegerLike(value)) {
      throw new ContentRouteError("Parent id must be numeric.", 422);
    }

    const parentId = Number(value);
    const [rows] = await this.pool.execute<IdRow[]>(
      `SELECT p.id
       FROM posts p
       LEFT JOIN rooms r ON r.id = p.room_id
       ${postAncestorVisibilityJoinsSql("p")}
       WHERE p.id = ?
         AND ${publicPostVisibleSql("p", "r", capabilities)}
         AND ${postAncestorVisibilitySql("p", capabilities)}
       LIMIT 1`,
      [parentId],
    );

    if (rows[0] === undefined) {
      throw new ContentRouteError("Parent post not found.", 422);
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
    const [rows] = await this.pool.execute<RowDataPacket[]>(
      `SELECT 1
       FROM user_follows
       WHERE follower_id = ?
         AND following_id = ?
       LIMIT 1`,
      [followingId, followerId],
    );

    return rows[0] !== undefined;
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

  private async createDirectPostShareMessage(
    senderUserId: number,
    recipientUserId: number,
    body: string,
    postId: number,
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
        `INSERT IGNORE INTO message_attachments (message_id, type, post_id)
         VALUES (?, 'post', ?)`,
        [messageId, postId],
      );
      await connection.execute<ResultSetHeader>(
        `UPDATE conversations
         SET last_message_at = CURRENT_TIMESTAMP(),
             updated_at = CURRENT_TIMESTAMP()
         WHERE id = ?`,
        [conversationId],
      );

      return { conversationId, messageId };
    });
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

  private async roomRecordBySlug(slug: string): Promise<RoomRecordRow | null> {
    const normalized = normalizeRoomSlug(slug);

    if (normalized === null) {
      return null;
    }

    const [rows] = await this.pool.execute<RoomRecordRow[]>(
      `SELECT id, slug, name, summary, mood, accent, visibility, created_by, deleted_at
       FROM rooms
       WHERE slug = ?
         AND deleted_at IS NULL
       LIMIT 1`,
      [normalized],
    );

    return rows[0] ?? null;
  }

  private async roomMembershipRecord(roomId: number, userId: number): Promise<RoomMembershipRow | null> {
    const [rows] = await this.pool.execute<RoomMembershipRow[]>(
      `SELECT id, room_id, user_id, role, muted_at, banned_at
       FROM room_memberships
       WHERE room_id = ?
         AND user_id = ?
       LIMIT 1`,
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

  private async fetchPublicRoomBySlug(slug: string, capabilities: ContentCapabilities): Promise<RoomPayload> {
    const roomCapabilities = roomCapabilitiesFromContent(capabilities);
    const [rows] = await this.pool.execute<RoomRow[]>(buildPublicRoomBySlugQuery(roomCapabilities), [slug]);
    const row = rows[0];

    if (row === undefined) {
      throw new ContentRouteError("Room not found.", 404);
    }

    return roomPayloadFromRow(row);
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

  private schemaCapabilities(): Promise<ContentCapabilities> {
    this.capabilities ??= this.detectSchemaCapabilities();

    return this.capabilities;
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
      hasRoomSoftDeleteColumn,
      hasPostPublicIdColumn,
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
      this.columnExists("rooms", "deleted_at"),
      this.columnExists("posts", "public_id"),
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
      hasRoomSoftDeleteColumn,
      hasPostPublicIdColumn,
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
  post_mood: string | null;
  post_media_url: string | null;
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

function validatePostMediaUrl(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value !== "string") {
    throw new ContentRouteError("Post image is invalid.", 422);
  }

  const trimmed = value.trim();

  if (trimmed === "") {
    return null;
  }

  if (trimmed.length > 255) {
    throw new ContentRouteError("Post image URL is too long.", 422);
  }

  if (!/^\/uploads\/media\/[0-9]{4}\/[0-9]{2}\/[a-z0-9_-]+\.(?:jpe?g|png|webp|gif)$/u.test(trimmed)) {
    throw new ContentRouteError("Use Upload image to attach an image.", 422);
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

function roomAccent(value: unknown): string {
  if (value === null || value === undefined || value === "") {
    return "var(--accent-sun)";
  }

  if (typeof value !== "string" || !roomAccents.has(value)) {
    throw new ContentRouteError("Choose a supported room accent.", 422);
  }

  return value;
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

function roomVisibility(value: unknown): "public" {
  if (typeof value !== "string" || value !== "public") {
    throw new ContentRouteError("Only public rooms are supported right now.", 422);
  }

  return "public";
}

function bodyValue(body: Record<string, unknown>, primaryKey: string, secondaryKey: string): unknown {
  if (primaryKey in body) {
    return body[primaryKey];
  }

  if (secondaryKey in body) {
    return body[secondaryKey];
  }

  return undefined;
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
    hasRoomSoftDeleteColumn: capabilities.hasRoomSoftDeleteColumn,
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
