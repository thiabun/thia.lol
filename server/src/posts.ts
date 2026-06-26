import type { Pool, RowDataPacket } from "mysql2/promise";

import {
  hydratePostAttachments,
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
import { initialsFromName, normalizeRoomSlug, type RoomPayload, type RoomRow, type UserPayload } from "./rooms.js";

export interface PostDetailPayload extends PostPayload {
  canonicalPath: string;
  canonicalUrl: string;
}

export interface HomeFeedPayload {
  posts: PostPayload[];
  personalized: boolean;
}

export interface DiscoverPersonPayload {
  handle: string;
  displayName: string;
  initials: string;
  avatarUrl: string | null;
  bioSnippet: string;
  isFollowing: boolean;
  isMoot: boolean;
  postCount: number;
  followerCount: number;
  starCount: number;
}

export interface DiscoverFeedPayload {
  posts: PostPayload[];
  activeRooms: RoomPayload[];
  peopleToWatch: DiscoverPersonPayload[];
}

export interface PostsRepository {
  listPublicPosts(viewerUserId: number | null): Promise<PostPayload[]>;
  getPublicPost(identifier: string, viewerUserId: number | null, publicBaseUrl: string): Promise<PostDetailPayload | null>;
  listPostReplies(postId: number, viewerUserId: number | null): Promise<PostPayload[] | null>;
  listRoomPosts(slug: string, viewerUserId: number | null, viewerRole?: string | null): Promise<PostPayload[] | null>;
  listProfilePosts(handle: string, viewerUserId: number | null): Promise<PostPayload[] | null>;
  listProfileReplies(handle: string, viewerUserId: number | null): Promise<PostPayload[] | null>;
  listProfileReblogs(handle: string, viewerUserId: number | null): Promise<PostPayload[] | null>;
  getHomeFeed(viewerUserId: number | null): Promise<HomeFeedPayload>;
  listDiscoverPosts(viewerUserId: number | null): Promise<PostPayload[]>;
  listPeopleToWatch(viewerUserId: number | null): Promise<DiscoverPersonPayload[]>;
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

interface ProfileContextRow extends RowDataPacket {
  user_id: number | string;
  visibility: string | null;
}

interface PeopleToWatchRow extends RowDataPacket {
  user_id: number | string;
  handle: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  is_following: number | string | boolean | null;
  is_followed_by: number | string | boolean | null;
  star_count: number | string | null;
  post_count: number | string | null;
  follower_count: number | string | null;
}

interface RoomAccessRow extends RowDataPacket {
  id: number | string;
  visibility: string | null;
  viewer_member_id: number | string | null;
}

type CountRow = RowDataPacket & {
  table_count?: number | string;
  column_count?: number | string;
};

const postIdentifierPattern = /^(?:[0-9]+|[a-z][a-z0-9_-]{7,31})$/;

export function normalizePostIdentifier(identifier: string): string | null {
  try {
    const normalized = decodeURIComponent(identifier).trim().toLowerCase();

    return postIdentifierPattern.test(normalized) ? normalized : null;
  } catch {
    return null;
  }
}

export function createPostsRepository(pool: Pool): PostsRepository {
  return new MysqlPostsRepository(pool);
}

export function postCanonicalPath(post: PostPayload): string {
  return `/@${encodeURIComponent(post.author.handle)}/posts/${encodeURIComponent(post.publicId || String(post.id))}`;
}

class MysqlPostsRepository implements PostsRepository {
  private capabilities?: Promise<ProfileSchemaCapabilities>;

  constructor(private readonly pool: Pool) {}

  async listPublicPosts(viewerUserId: number | null): Promise<PostPayload[]> {
    return this.postsFromQuery(buildPublicPostsQuery(await this.schemaCapabilities(), viewerUserId), []);
  }

  async getPublicPost(
    identifier: string,
    viewerUserId: number | null,
    publicBaseUrl: string,
  ): Promise<PostDetailPayload | null> {
    const normalized = normalizePostIdentifier(identifier);

    if (normalized === null) {
      return null;
    }

    const capabilities = await this.schemaCapabilities();
    const usesPublicId = capabilities.hasPostPublicIdColumn && !/^[0-9]+$/.test(normalized);
    const query = postSelectSql(
      usesPublicId ? "AND p.public_id = ?" : "AND p.id = ?",
      "p.created_at DESC, p.id DESC",
      "",
      capabilities,
      viewerUserId,
    );
    const posts = await this.postsFromQuery(query, [normalized]);
    const post = posts[0];

    if (post === undefined) {
      return null;
    }

    const canonicalPath = postCanonicalPath(post);

    return {
      ...post,
      canonicalPath,
      canonicalUrl: `${publicBaseUrl.replace(/\/+$/, "")}${canonicalPath}`,
    };
  }

  async listPostReplies(postId: number, viewerUserId: number | null): Promise<PostPayload[] | null> {
    const capabilities = await this.schemaCapabilities();

    if (!(await this.publicPostExists(postId, capabilities))) {
      return null;
    }

    const query = postSelectSql(
      "AND p.parent_id = ?",
      "p.created_at ASC, p.id ASC",
      "",
      capabilities,
      viewerUserId,
    ).replace(/LIMIT 50\s*$/u, "LIMIT 100");

    return this.postsFromQuery(query, [postId]);
  }

  async listRoomPosts(
    slug: string,
    viewerUserId: number | null,
    viewerRole: string | null = null,
  ): Promise<PostPayload[] | null> {
    const normalizedSlug = normalizeRoomSlug(slug);

    if (normalizedSlug === null) {
      return null;
    }

    const capabilities = await this.schemaCapabilities();

    if (!(await this.viewerCanViewRoomPosts(normalizedSlug, viewerUserId, viewerRole, capabilities))) {
      return null;
    }

    return this.postsFromQuery(buildRoomPostsQuery(capabilities, viewerUserId), [normalizedSlug]);
  }

  async listProfilePosts(handle: string, viewerUserId: number | null): Promise<PostPayload[] | null> {
    return this.listProfilePostKind("posts", handle, viewerUserId);
  }

  async listProfileReplies(handle: string, viewerUserId: number | null): Promise<PostPayload[] | null> {
    return this.listProfilePostKind("replies", handle, viewerUserId);
  }

  async listProfileReblogs(handle: string, viewerUserId: number | null): Promise<PostPayload[] | null> {
    return this.listProfilePostKind("reblogs", handle, viewerUserId);
  }

  async getHomeFeed(viewerUserId: number | null): Promise<HomeFeedPayload> {
    const capabilities = await this.schemaCapabilities();

    return {
      posts: await this.postsFromQuery(buildHomeFeedQuery(capabilities, viewerUserId), []),
      personalized: viewerUserId !== null,
    };
  }

  async listDiscoverPosts(viewerUserId: number | null): Promise<PostPayload[]> {
    return this.postsFromQuery(buildDiscoverFeedQuery(await this.schemaCapabilities(), viewerUserId), []);
  }

  async listPeopleToWatch(viewerUserId: number | null): Promise<DiscoverPersonPayload[]> {
    const capabilities = await this.schemaCapabilities();
    const [rows] = await this.pool.execute<PeopleToWatchRow[]>(buildPeopleToWatchQuery(capabilities, viewerUserId));

    return rows.map((row) => discoverPersonPayloadFromRow(row));
  }

  private async listProfilePostKind(
    kind: "posts" | "replies" | "reblogs",
    handle: string,
    viewerUserId: number | null,
  ): Promise<PostPayload[] | null> {
    const normalizedHandle = normalizeProfileHandle(handle);

    if (normalizedHandle === null) {
      return null;
    }

    const capabilities = await this.schemaCapabilities();
    const profile = await this.profileContext(normalizedHandle, viewerUserId, capabilities);

    if (profile === null) {
      return null;
    }

    if (!profile.viewerCanView) {
      return [];
    }

    if (kind === "reblogs" && !capabilities.hasPostReblogs) {
      throw new Error("Reblog storage is not ready.");
    }

    const query =
      kind === "posts"
        ? buildPublicProfilePostsQuery(capabilities, viewerUserId)
        : kind === "replies"
          ? buildPublicProfileRepliesQuery(capabilities, viewerUserId)
          : buildPublicProfileReblogsQuery(capabilities, viewerUserId);

    return this.postsFromQuery(query, [normalizedHandle]);
  }

  private async profileContext(
    handle: string,
    viewerUserId: number | null,
    capabilities: ProfileSchemaCapabilities,
  ): Promise<{ userId: number; viewerCanView: boolean } | null> {
    const [rows] = await this.pool.execute<ProfileContextRow[]>(
      `SELECT
            u.id AS user_id,
            ${capabilities.hasProfileVisibilityColumn ? "p.visibility" : "'public' AS visibility"}
         FROM users u
         INNER JOIN profiles p ON p.user_id = u.id
         WHERE u.handle = ?
           AND ${userPubliclyAvailableSql("u", capabilities)}
         LIMIT 1`,
      [handle],
    );
    const row = rows[0];

    if (row === undefined) {
      return null;
    }

    const userId = numberValue(row.user_id);
    const visibility = row.visibility === "private" ? "private" : "public";

    if (visibility !== "private" || viewerUserId === userId) {
      return {
        userId,
        viewerCanView: true,
      };
    }

    if (viewerUserId === null || !capabilities.hasUserFollows) {
      return {
        userId,
        viewerCanView: false,
      };
    }

    const [followRows] = await this.pool.execute<RowDataPacket[]>(
      `SELECT 1
       FROM user_follows
       WHERE follower_id = ?
         AND following_id = ?
       LIMIT 1`,
      [viewerUserId, userId],
    );

    return {
      userId,
      viewerCanView: followRows[0] !== undefined,
    };
  }

  private async postsFromQuery(
    query: string,
    params: Array<number | string>,
  ): Promise<PostPayload[]> {
    const capabilities = await this.schemaCapabilities();
    const [rows] = await this.pool.execute<PostRow[]>(query, params);
    const posts = await Promise.all(rows.map((row) => this.postPayload(row, capabilities)));

    return hydratePostAttachments(this.pool, capabilities, posts);
  }

  private async postPayload(row: PostRow, capabilities: ProfileSchemaCapabilities): Promise<PostPayload> {
    const [postEntities, profileEntities] = await Promise.all([
      this.textEntities("post", numberValue(row.post_id), "body", capabilities),
      this.textEntities("profile", numberValue(row.user_id), "bio", capabilities),
    ]);

    return postPayloadFromRow(row, postEntities, profileEntities);
  }

  private async publicPostExists(postId: number, capabilities: ProfileSchemaCapabilities): Promise<boolean> {
    const [rows] = await this.pool.execute<RowDataPacket[]>(
      `SELECT p.id
       FROM posts p
       LEFT JOIN rooms r ON r.id = p.room_id
       ${postAncestorVisibilityJoinsSql("p")}
       WHERE p.id = ?
         AND ${publicPostVisibleSql("p", "r", capabilities)}
         AND ${postAncestorVisibilitySql("p", capabilities)}
       LIMIT 1`,
      [postId],
    );

    return rows[0] !== undefined;
  }

  private async viewerCanViewRoomPosts(
    slug: string,
    viewerUserId: number | null,
    viewerRole: string | null,
    capabilities: ProfileSchemaCapabilities,
  ): Promise<boolean> {
    const viewerSql = viewerUserId === null ? "NULL" : String(viewerUserId);
    const membershipSelect = capabilities.hasRoomMemberships
      ? "viewer_membership.id AS viewer_member_id"
      : "NULL AS viewer_member_id";
    const membershipJoin = capabilities.hasRoomMemberships
      ? `LEFT JOIN room_memberships viewer_membership
           ON viewer_membership.room_id = rooms.id
          AND viewer_membership.user_id = ${viewerSql}
          AND viewer_membership.banned_at IS NULL`
      : "";
    const [rows] = await this.pool.execute<RoomAccessRow[]>(
      `SELECT rooms.id, rooms.visibility, ${membershipSelect}
       FROM rooms
       ${membershipJoin}
       WHERE slug = ?
         ${roomNotDeletedSql("rooms", capabilities)}
       LIMIT 1`,
      [slug],
    );

    const room = rows[0];

    if (room === undefined) {
      return false;
    }

    if (room.visibility === "public" || room.visibility === "view_only") {
      return true;
    }

    if (viewerRole === "admin") {
      return true;
    }

    return viewerUserId !== null && room.viewer_member_id !== null;
  }

  private schemaCapabilities(): Promise<ProfileSchemaCapabilities> {
    this.capabilities ??= this.detectSchemaCapabilities();

    return this.capabilities;
  }

  private async detectSchemaCapabilities(): Promise<ProfileSchemaCapabilities> {
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
    };
  }

  private async textEntities(
    contentType: "post" | "profile",
    contentId: number,
    fieldName: "bio" | "body",
    capabilities: ProfileSchemaCapabilities,
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

  private async tableExists(tableName: string): Promise<boolean> {
    validateSchemaIdentifier(tableName);

    const [rows] = await this.pool.execute<CountRow[]>(
      `SELECT COUNT(*) AS table_count
       FROM INFORMATION_SCHEMA.TABLES
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = ?`,
      [tableName],
    );
    const row = rows[0];

    return row === undefined ? false : numberValue(row.table_count) > 0;
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
    const row = rows[0];

    return row === undefined ? false : numberValue(row.column_count) > 0;
  }
}

export function buildPublicPostsQuery(capabilities: ProfileSchemaCapabilities, viewerUserId: number | null): string {
  return postSelectSql("AND p.parent_id IS NULL", "p.created_at DESC, p.id DESC", "", capabilities, viewerUserId);
}

export function buildRoomPostsQuery(
  capabilities: ProfileSchemaCapabilities,
  viewerUserId: number | null,
): string {
  const roomScopedVisibleSql = `p.visibility = 'public'
        AND p.status = 'published'
        AND p.deleted_at IS NULL
        AND p.room_id IS NOT NULL
        AND r.id IS NOT NULL
        ${roomNotDeletedSql("r", capabilities)}`;

  return postSelectSql(
    "AND r.slug = ? AND p.parent_id IS NULL",
    "p.created_at DESC, p.id DESC",
    "",
    capabilities,
    viewerUserId,
    "",
    roomScopedVisibleSql,
  );
}

export function buildPublicProfilePostsQuery(
  capabilities: ProfileSchemaCapabilities,
  viewerUserId: number | null,
): string {
  return postSelectSql(
    "AND u.handle = ? AND p.parent_id IS NULL",
    "p.created_at DESC, p.id DESC",
    "",
    capabilities,
    viewerUserId,
  );
}

export function buildPublicProfileRepliesQuery(
  capabilities: ProfileSchemaCapabilities,
  viewerUserId: number | null,
): string {
  return postSelectSql(
    "AND u.handle = ? AND p.parent_id IS NOT NULL",
    "p.created_at DESC, p.id DESC",
    "",
    capabilities,
    viewerUserId,
  );
}

export function buildPublicProfileReblogsQuery(
  capabilities: ProfileSchemaCapabilities,
  viewerUserId: number | null,
): string {
  return postSelectSql(
    `AND profile_reblogger.handle = ?
     AND profile_reblogger.status = 'active'`,
    "profile_reblogs.created_at DESC, profile_reblogs.id DESC",
    `profile_reblogger.id AS reblogged_by_user_id,
            profile_reblogger.handle AS reblogged_by_handle,
            profile_reblogger_profile.display_name AS reblogged_by_display_name,
            profile_reblogger_profile.avatar_url AS reblogged_by_avatar_url,
            profile_reblogs.created_at AS reblogged_at`,
    capabilities,
    viewerUserId,
    `INNER JOIN post_reblogs profile_reblogs ON profile_reblogs.post_id = p.id
            INNER JOIN users profile_reblogger ON profile_reblogger.id = profile_reblogs.user_id
            INNER JOIN profiles profile_reblogger_profile ON profile_reblogger_profile.user_id = profile_reblogger.id`,
  );
}

export function buildHomeFeedQuery(capabilities: ProfileSchemaCapabilities, viewerUserId: number | null): string {
  const scoreSql = homeRankScoreSql(capabilities, viewerUserId);

  return postSelectSql(
    `AND p.parent_id IS NULL${viewerFeedRelationshipFilterSql(capabilities, viewerUserId)}`,
    "feed_rank_score DESC, p.created_at DESC, p.id DESC",
    `${scoreSql} AS feed_rank_score,
            ${followedReblogContextSelectSql(capabilities, viewerUserId)}`,
    capabilities,
    viewerUserId,
  );
}

export function buildDiscoverFeedQuery(capabilities: ProfileSchemaCapabilities, viewerUserId: number | null): string {
  const scoreSql = discoverRankScoreSql(capabilities);

  return postSelectSql(
    `AND p.parent_id IS NULL${viewerFeedRelationshipFilterSql(capabilities, viewerUserId)}`,
    "feed_rank_score DESC, p.created_at DESC, p.id DESC",
    `${scoreSql} AS feed_rank_score`,
    capabilities,
    viewerUserId,
  );
}

export function buildPeopleToWatchQuery(
  capabilities: ProfileSchemaCapabilities,
  viewerUserId: number | null,
): string {
  const viewerSql = viewerUserId === null ? "NULL" : String(viewerUserId);
  const followSelect = capabilities.hasUserFollows
    ? `IF(viewer_follows.following_id IS NULL, 0, 1) AS is_following,
        IF(viewer_followed_by.follower_id IS NULL, 0, 1) AS is_followed_by,
        COALESCE(followers.follower_count, 0) AS follower_count,`
    : `0 AS is_following,
        0 AS is_followed_by,
        0 AS follower_count,`;
  const followJoins = capabilities.hasUserFollows
    ? `LEFT JOIN (
            SELECT following_id, COUNT(*) AS follower_count
            FROM user_follows
            GROUP BY following_id
        ) followers ON followers.following_id = u.id
        LEFT JOIN user_follows viewer_follows
            ON viewer_follows.follower_id = ${viewerSql}
           AND viewer_follows.following_id = u.id
        LEFT JOIN user_follows viewer_followed_by
            ON viewer_followed_by.follower_id = u.id
           AND viewer_followed_by.following_id = ${viewerSql}`
    : "";
  const moduleJoin = capabilities.hasProfileModules
    ? `LEFT JOIN (
            SELECT user_id, COUNT(*) AS module_count
            FROM profile_modules
            WHERE visibility = 'public'
              AND status = 'active'
              AND type <> 'placeholder'
            GROUP BY user_id
        ) profile_modules ON profile_modules.user_id = u.id`
    : "";
  const badgeJoin = capabilities.hasBadges && capabilities.hasUserBadges
    ? `LEFT JOIN (
            SELECT ub.user_id, COUNT(*) AS badge_count
            FROM user_badges ub
            INNER JOIN badges b ON b.id = ub.badge_id
            WHERE ub.is_visible = 1
              AND ub.featured_order IS NOT NULL
              AND b.is_active = 1
            GROUP BY ub.user_id
        ) featured_badges ON featured_badges.user_id = u.id`
    : "";
  const moduleCountSql = capabilities.hasProfileModules ? "COALESCE(profile_modules.module_count, 0)" : "0";
  const badgeCountSql = capabilities.hasBadges && capabilities.hasUserBadges ? "COALESCE(featured_badges.badge_count, 0)" : "0";
  const followerCountSql = capabilities.hasUserFollows ? "COALESCE(followers.follower_count, 0)" : "0";
  const profileVisibilityFilter = capabilities.hasProfileVisibilityColumn ? "AND p.visibility = 'public'" : "";
  const profileQualityScore = `(
        CASE WHEN p.avatar_url IS NULL OR p.avatar_url = '' THEN 0 ELSE 8 END
        + CASE
            WHEN p.banner_url IS NOT NULL AND p.banner_url <> '' THEN 6
            WHEN p.profile_background IS NOT NULL AND p.profile_background <> '' THEN 5
            WHEN p.profile_background_video_url IS NOT NULL AND p.profile_background_video_url <> '' THEN 5
            ELSE 0
          END
        + CASE WHEN p.bio IS NULL OR TRIM(p.bio) = '' THEN 0 ELSE 6 END
        + LEAST(${moduleCountSql}, 5) * 3
        + LEAST(${badgeCountSql}, 3) * 2
    )`;
  const recentActivityScore = `CASE
        WHEN profile_posts.latest_post_at IS NULL THEN 0
        WHEN TIMESTAMPDIFF(DAY, profile_posts.latest_post_at, UTC_TIMESTAMP()) <= 7 THEN 10
        WHEN TIMESTAMPDIFF(DAY, profile_posts.latest_post_at, UTC_TIMESTAMP()) <= 30 THEN 5
        ELSE 0
    END`;
  const rankScore = `(
        COALESCE(profile_stars.star_count, 0) * 12
        + COALESCE(profile_posts.like_count, 0) * 2
        + ${followerCountSql} * 3
        + COALESCE(profile_posts.post_count, 0) * 4
        + ${profileQualityScore}
        + ${recentActivityScore}
    )`;

  return `SELECT
            u.id AS user_id,
            u.handle,
            p.display_name,
            p.avatar_url,
            p.bio,
            ${followSelect}
            COALESCE(profile_stars.star_count, 0) AS star_count,
            COALESCE(profile_posts.post_count, 0) AS post_count,
            profile_posts.latest_post_at,
            ${rankScore} AS discover_rank_score
         FROM users u
         INNER JOIN profiles p ON p.user_id = u.id
         LEFT JOIN (
            SELECT
                posts.author_id,
                COUNT(*) AS post_count,
                MAX(posts.created_at) AS latest_post_at,
                COALESCE(SUM(reaction_counts.glow_count), 0) AS like_count
            FROM posts
            LEFT JOIN rooms post_rooms ON post_rooms.id = posts.room_id
            LEFT JOIN (
                SELECT post_id, SUM(type = 'glow') AS glow_count
                FROM post_reactions
                GROUP BY post_id
            ) reaction_counts ON reaction_counts.post_id = posts.id
            WHERE posts.parent_id IS NULL
              AND posts.visibility = 'public'
              AND posts.status = 'published'
              AND posts.deleted_at IS NULL
              AND (posts.room_id IS NULL OR (post_rooms.visibility IN ('public', 'view_only') ${roomNotDeletedSql("post_rooms", capabilities)}))
            GROUP BY posts.author_id
         ) profile_posts ON profile_posts.author_id = u.id
         LEFT JOIN (
            ${profileStarsAggregateSql(capabilities)}
         ) profile_stars ON profile_stars.starred_user_id = u.id
         ${followJoins}
         ${moduleJoin}
         ${badgeJoin}
         WHERE ${userPubliclyAvailableSql("u", capabilities)}
           ${profileVisibilityFilter}
           AND u.handle NOT REGEXP '^smoketest[0-9]+$'
           AND (${viewerSql} IS NULL OR u.id <> ${viewerSql})
           ${viewerFeedRelationshipFilterSql(capabilities, viewerUserId)}
         ORDER BY
            discover_rank_score DESC,
            COALESCE(profile_stars.star_count, 0) DESC,
            profile_posts.latest_post_at DESC,
            profile_posts.like_count DESC,
            ${followerCountSql} DESC,
            u.created_at DESC
         LIMIT 24`;
}

function discoverRankScoreSql(capabilities: ProfileSchemaCapabilities): string {
  const relationshipScore = relationshipScoreSql(capabilities, 8, 12);
  const reblogScore = reblogScoreSql(capabilities);

  return `(
        COALESCE(reactions.glow_count, 0) * 3
        + COALESCE(replies.reply_count, 0) * 4
        + ${reblogScore} * 5
        + LEAST(COALESCE(room_posts.post_count, 0), 10)
        + ${relationshipScore}
        + CASE
            WHEN TIMESTAMPDIFF(HOUR, p.created_at, UTC_TIMESTAMP()) <= 6 THEN 30
            WHEN TIMESTAMPDIFF(HOUR, p.created_at, UTC_TIMESTAMP()) <= 24 THEN 18
            WHEN TIMESTAMPDIFF(HOUR, p.created_at, UTC_TIMESTAMP()) <= 72 THEN 8
            ELSE 0
          END
        - LEAST(40, TIMESTAMPDIFF(HOUR, p.created_at, UTC_TIMESTAMP()) / 6)
    )`;
}

function homeRankScoreSql(capabilities: ProfileSchemaCapabilities, viewerUserId: number | null): string {
  if (viewerUserId === null) {
    return discoverRankScoreSql(capabilities);
  }

  const relationshipScore = relationshipScoreSql(capabilities, 80, 120);
  const reblogScore = reblogScoreSql(capabilities);
  const followedReblogScore = capabilities.hasPostReblogs && capabilities.hasUserFollows
    ? `CASE WHEN EXISTS (
            SELECT 1
            FROM post_reblogs home_reblogs
            INNER JOIN user_follows home_reblog_follows
                ON home_reblog_follows.following_id = home_reblogs.user_id
               AND home_reblog_follows.follower_id = ${viewerUserId}
            WHERE home_reblogs.post_id = p.id
        ) THEN 70 ELSE 0 END`
    : "0";

  return `(
        ${relationshipScore}
        + ${followedReblogScore}
        + CASE WHEN u.id = ${viewerUserId} THEN -45 ELSE 0 END
        + COALESCE(reactions.glow_count, 0) * 3
        + COALESCE(replies.reply_count, 0) * 4
        + ${reblogScore} * 5
        + LEAST(COALESCE(room_posts.post_count, 0), 12)
        + CASE
            WHEN TIMESTAMPDIFF(HOUR, p.created_at, UTC_TIMESTAMP()) <= 24 THEN 24
            WHEN TIMESTAMPDIFF(HOUR, p.created_at, UTC_TIMESTAMP()) <= 72 THEN 12
            WHEN TIMESTAMPDIFF(HOUR, p.created_at, UTC_TIMESTAMP()) <= 168 THEN 6
            ELSE 0
          END
        - LEAST(35, TIMESTAMPDIFF(HOUR, p.created_at, UTC_TIMESTAMP()) / 8)
    )`;
}

function followedReblogContextSelectSql(capabilities: ProfileSchemaCapabilities, viewerUserId: number | null): string {
  if (viewerUserId === null || !capabilities.hasPostReblogs || !capabilities.hasUserFollows) {
    return `NULL AS reblogged_by_user_id,
        NULL AS reblogged_by_handle,
        NULL AS reblogged_by_display_name,
        NULL AS reblogged_by_avatar_url,
        NULL AS reblogged_at`;
  }

  return `(SELECT reblog_user.id
            FROM post_reblogs feed_reblogs
            INNER JOIN user_follows feed_reblog_follows
                ON feed_reblog_follows.following_id = feed_reblogs.user_id
               AND feed_reblog_follows.follower_id = ${viewerUserId}
            INNER JOIN users reblog_user ON reblog_user.id = feed_reblogs.user_id
            WHERE feed_reblogs.post_id = p.id
              AND reblog_user.status = 'active'
            ORDER BY feed_reblogs.created_at DESC, feed_reblogs.id DESC
            LIMIT 1) AS reblogged_by_user_id,
        (SELECT reblog_user.handle
            FROM post_reblogs feed_reblogs
            INNER JOIN user_follows feed_reblog_follows
                ON feed_reblog_follows.following_id = feed_reblogs.user_id
               AND feed_reblog_follows.follower_id = ${viewerUserId}
            INNER JOIN users reblog_user ON reblog_user.id = feed_reblogs.user_id
            WHERE feed_reblogs.post_id = p.id
              AND reblog_user.status = 'active'
            ORDER BY feed_reblogs.created_at DESC, feed_reblogs.id DESC
            LIMIT 1) AS reblogged_by_handle,
        (SELECT reblogger_profile.display_name
            FROM post_reblogs feed_reblogs
            INNER JOIN user_follows feed_reblog_follows
                ON feed_reblog_follows.following_id = feed_reblogs.user_id
               AND feed_reblog_follows.follower_id = ${viewerUserId}
            INNER JOIN users reblog_user ON reblog_user.id = feed_reblogs.user_id
            INNER JOIN profiles reblogger_profile ON reblogger_profile.user_id = reblog_user.id
            WHERE feed_reblogs.post_id = p.id
              AND reblog_user.status = 'active'
            ORDER BY feed_reblogs.created_at DESC, feed_reblogs.id DESC
            LIMIT 1) AS reblogged_by_display_name,
        (SELECT reblogger_profile.avatar_url
            FROM post_reblogs feed_reblogs
            INNER JOIN user_follows feed_reblog_follows
                ON feed_reblog_follows.following_id = feed_reblogs.user_id
               AND feed_reblog_follows.follower_id = ${viewerUserId}
            INNER JOIN users reblog_user ON reblog_user.id = feed_reblogs.user_id
            INNER JOIN profiles reblogger_profile ON reblogger_profile.user_id = reblog_user.id
            WHERE feed_reblogs.post_id = p.id
              AND reblog_user.status = 'active'
            ORDER BY feed_reblogs.created_at DESC, feed_reblogs.id DESC
            LIMIT 1) AS reblogged_by_avatar_url,
        (SELECT feed_reblogs.created_at
            FROM post_reblogs feed_reblogs
            INNER JOIN user_follows feed_reblog_follows
                ON feed_reblog_follows.following_id = feed_reblogs.user_id
               AND feed_reblog_follows.follower_id = ${viewerUserId}
            INNER JOIN users reblog_user ON reblog_user.id = feed_reblogs.user_id
            WHERE feed_reblogs.post_id = p.id
              AND reblog_user.status = 'active'
            ORDER BY feed_reblogs.created_at DESC, feed_reblogs.id DESC
            LIMIT 1) AS reblogged_at`;
}

function relationshipScoreSql(capabilities: ProfileSchemaCapabilities, followBonus: number, mootBonus: number): string {
  if (!capabilities.hasUserFollows) {
    return "0";
  }

  return `CASE
        WHEN viewer_follows_author.following_id IS NOT NULL
         AND author_follows_viewer.follower_id IS NOT NULL THEN ${mootBonus}
        WHEN viewer_follows_author.following_id IS NOT NULL THEN ${followBonus}
        ELSE 0
    END`;
}

function reblogScoreSql(capabilities: ProfileSchemaCapabilities): string {
  return capabilities.hasPostReblogs ? "COALESCE(reblogs.reblog_count, 0)" : "0";
}

function viewerFeedRelationshipFilterSql(
  capabilities: ProfileSchemaCapabilities,
  viewerUserId: number | null,
  authorUserSql = "u.id",
  includeMutes = true,
): string {
  if (viewerUserId === null) {
    return "";
  }

  let filters = pairNotBlockedSql(String(viewerUserId), authorUserSql, capabilities);

  if (includeMutes && capabilities.hasUserMutes) {
    filters += ` AND NOT EXISTS (
            SELECT 1
            FROM user_mutes feed_mutes
            WHERE feed_mutes.muter_id = ${viewerUserId}
              AND feed_mutes.muted_id = ${authorUserSql}
        )`;
  }

  return filters === "" ? "" : ` ${filters.trimStart()}`;
}

function userPubliclyAvailableSql(alias: string, capabilities: ProfileSchemaCapabilities): string {
  validateSchemaIdentifier(alias);

  if (!capabilities.hasAccountDeletionRequests) {
    return `${alias}.status = 'active'`;
  }

  return `${alias}.status = 'active'
        AND NOT EXISTS (
            SELECT 1
            FROM account_deletion_requests public_account_deletions
            WHERE public_account_deletions.user_id = ${alias}.id
              AND public_account_deletions.canceled_at IS NULL
              AND public_account_deletions.completed_at IS NULL
        )`;
}

function profileStarsAggregateSql(capabilities: ProfileSchemaCapabilities): string {
  if (!capabilities.hasProfileStars) {
    return "SELECT 0 AS starred_user_id, 0 AS star_count WHERE 1 = 0";
  }

  return `SELECT profile_star_counts.starred_user_id, COUNT(*) AS star_count
        FROM profile_stars profile_star_counts
        INNER JOIN users profile_star_users ON profile_star_users.id = profile_star_counts.starrer_id
        WHERE profile_star_users.status = 'active'
          ${pairNotBlockedSql("profile_star_counts.starrer_id", "profile_star_counts.starred_user_id", capabilities)}
        GROUP BY profile_star_counts.starred_user_id`;
}

function pairNotBlockedSql(
  firstUserSql: string,
  secondUserSql: string,
  capabilities: ProfileSchemaCapabilities,
): string {
  if (!capabilities.hasUserBlocks) {
    return "";
  }

  return `AND NOT EXISTS (
        SELECT 1
        FROM user_blocks pair_blocks
        WHERE (pair_blocks.blocker_id = ${firstUserSql} AND pair_blocks.blocked_id = ${secondUserSql})
           OR (pair_blocks.blocker_id = ${secondUserSql} AND pair_blocks.blocked_id = ${firstUserSql})
    )`;
}

function roomNotDeletedSql(alias: string, capabilities: ProfileSchemaCapabilities): string {
  validateSchemaIdentifier(alias);

  return capabilities.hasRoomSoftDeleteColumn ? `AND ${alias}.deleted_at IS NULL` : "";
}

function discoverPersonPayloadFromRow(row: PeopleToWatchRow): DiscoverPersonPayload {
  const handle = stringValue(row.handle);
  const displayName = stringValue(row.display_name, handle);
  const isFollowing = booleanValue(row.is_following);
  const isFollowedBy = booleanValue(row.is_followed_by);

  return {
    handle,
    displayName,
    initials: initialsFromName(displayName),
    avatarUrl: nullableStringValue(row.avatar_url),
    bioSnippet: bioSnippet(row.bio),
    isFollowing,
    isMoot: isFollowing && isFollowedBy,
    postCount: numberValue(row.post_count),
    followerCount: numberValue(row.follower_count),
    starCount: numberValue(row.star_count),
  };
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
      user: compactUserPayload(numberValue(row.target_user_id), handle, displayName, row.target_avatar_url),
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

function compactUserPayload(
  id: number,
  handle: string,
  displayName: string,
  avatarUrl: string | null | undefined,
): UserPayload {
  return {
    id,
    handle,
    displayName,
    initials: initialsFromName(displayName),
    aura: "frost",
    avatarUrl: nullableStringValue(avatarUrl),
  };
}

function bioSnippet(value: string | null | undefined): string {
  if (typeof value !== "string") {
    return "";
  }

  const trimmed = value.replace(/\s+/g, " ").trim();
  const bytes = Buffer.from(trimmed, "utf8");

  if (bytes.length <= 140) {
    return trimmed;
  }

  return `${bytes.subarray(0, 137).toString("utf8").trimEnd()}...`;
}

function jsonArrayOrObject(value: string | null | undefined): Record<string, unknown> | unknown[] | null {
  if (typeof value !== "string" || value.trim() === "") {
    return null;
  }

  try {
    const decoded = JSON.parse(value) as unknown;

    if (Array.isArray(decoded)) {
      return decoded;
    }

    return typeof decoded === "object" && decoded !== null ? (decoded as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function nullableStringValue(value: Date | string | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  return String(value);
}

function stringValue(value: Date | string | null | undefined, fallback = ""): string {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }

  return String(value);
}

function booleanValue(value: boolean | number | string | null | undefined): boolean {
  if (typeof value === "boolean") {
    return value;
  }

  return numberValue(value) !== 0;
}

function numberValue(value: boolean | number | string | bigint | null | undefined, fallback = 0): number {
  if (typeof value === "boolean") {
    return value ? 1 : 0;
  }

  if (typeof value === "bigint") {
    return Number(value);
  }

  if (value === null || value === undefined || value === "") {
    return fallback;
  }

  const number = Number(value);

  return Number.isFinite(number) ? number : fallback;
}

function validateSchemaIdentifier(identifier: string): void {
  if (!/^[a-zA-Z0-9_]+$/.test(identifier)) {
    throw new Error("Invalid schema identifier.");
  }
}
