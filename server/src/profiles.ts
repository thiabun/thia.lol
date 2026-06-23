import type { Pool, RowDataPacket } from "mysql2/promise";

import { initialsFromName, roomPayloadFromRow, type RoomPayload, type RoomRow, type UserPayload } from "./rooms.js";

export interface ProfilesRepository {
  getPublicProfile(handle: string): Promise<ProfilePayload | null>;
}

export interface ProfilePayload {
  user: UserPayload;
  bio: string;
  bioEntities: TextEntityPayload[];
  location: string;
  avatarUrl: string | null;
  bannerUrl: string | null;
  profileAccent: string | null;
  profileBackground: string | null;
  profileBackgroundVideo: string | null;
  profileBackgroundVideoPoster: string | null;
  profileBackgroundBlur: string;
  profileTheme: string | null;
  profileThemeConfig: ProfileThemeConfig | null;
  profileLayoutPreset: string;
  profileCanvasVersion: number;
  profileCanvasGlass: number;
  visibility: ProfileVisibility;
  isPrivate: boolean;
  viewerCanView: boolean;
  featuredPostId: number | null;
  featuredRoomId: number | null;
  links: unknown[];
  traits: unknown[];
  stats: ProfileStatsPayload;
  followerCount: number;
  followingCount: number;
  mootCount: number;
  starCount: number;
  isFollowing: boolean;
  isFollowedBy: boolean;
  isMoot: boolean;
  isStarred: boolean;
  isFollowRequestPending: boolean;
  isBlocked: boolean;
  isMuted: boolean;
  createdAt: string | null;
  updatedAt: string | null;
  featuredPost: PostPayload | null;
  featuredRoom: RoomPayload | null;
}

export interface ProfileStatsPayload {
  posts: number;
  replies: number;
  rooms: number;
  echoes: number;
  followers: number;
  following: number;
  moots: number;
  stars: number;
}

export interface TextEntityPayload {
  type: string;
  start: number;
  length: number;
  text: string;
  mention?: {
    handle: string;
    user: UserPayload;
  };
  link?: {
    url: string;
    card?: Record<string, unknown> | unknown[];
  };
}

export interface PostPayload {
  id: number;
  publicId: string;
  body: string;
  bodyEntities: TextEntityPayload[];
  mood: string;
  mediaUrl: string | null;
  visibility: string;
  status: string;
  parentId: number | null;
  deletedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  author: UserPayload;
  profile: Omit<ProfilePayload, "featuredPost" | "featuredRoom">;
  room: RoomPayload | null;
  commentCount: number;
  reactions: {
    glow: number;
    echo: number;
    hush: number;
  };
  likeCount: number;
  likedByCurrentUser: boolean;
  reblogCount: number;
  rebloggedByMe: boolean;
  rebloggedByCurrentUser: boolean;
  rebloggedBy: UserPayload | null;
  rebloggedAt: string | null;
  socialContext: {
    authorRelationship: "self" | "moot" | "following" | null;
    likedByFollowedCount: number;
  };
}

export interface ProfileSchemaCapabilities {
  hasAccountDeletionRequests: boolean;
  hasUserFollows: boolean;
  hasUserFollowRequests: boolean;
  hasUserBlocks: boolean;
  hasUserMutes: boolean;
  hasProfileStars: boolean;
  hasProfileCustomizationColumns: boolean;
  hasProfileBackgroundVideoColumns: boolean;
  hasProfileBackgroundBlurColumn: boolean;
  hasProfileLayoutPresetColumn: boolean;
  hasProfileCanvasVersionColumn: boolean;
  hasProfileCanvasGlassColumn: boolean;
  hasProfileThemeConfigColumn: boolean;
  hasProfileFeaturedColumns: boolean;
  hasProfileVisibilityColumn: boolean;
  hasRoomMemberships: boolean;
  hasRoomCustomizationColumns: boolean;
  hasRoomSoftDeleteColumn: boolean;
  hasPostPublicIdColumn: boolean;
  hasPostReblogs: boolean;
  hasTextEntities: boolean;
}

export interface ProfileRow extends RowDataPacket {
  user_id: number | string;
  handle: string;
  user_status?: string | null;
  display_name: string | null;
  bio: string | null;
  location: string | null;
  avatar_url: string | null;
  banner_url: string | null;
  profile_accent: string | null;
  profile_background: string | null;
  profile_background_video_url: string | null;
  profile_background_video_poster_url: string | null;
  profile_background_blur: string | null;
  profile_theme: string | null;
  profile_theme_config_json: string | null;
  profile_layout_preset: string | null;
  profile_canvas_version: number | string | null;
  profile_canvas_glass_opacity: number | string | null;
  visibility: string | null;
  featured_post_id: number | string | null;
  featured_room_id: number | string | null;
  links: string | null;
  traits: string | null;
  profile_created_at: string | null;
  profile_updated_at: string | null;
  post_count: number | string | null;
  profile_reply_count: number | string | null;
  room_count: number | string | null;
  profile_like_count: number | string | null;
  star_count: number | string | null;
  follower_count?: number | string | null;
  following_count?: number | string | null;
  moot_count?: number | string | null;
  is_following?: number | string | boolean | null;
  is_followed_by?: number | string | boolean | null;
  is_moot?: number | string | boolean | null;
  is_starred?: number | string | boolean | null;
  is_follow_request_pending?: number | string | boolean | null;
  is_blocked?: number | string | boolean | null;
  is_muted?: number | string | boolean | null;
}

export interface ProfileSocialContext {
  followerCount: number;
  followingCount: number;
  mootCount: number;
  starCount: number;
  isFollowing: boolean;
  isFollowedBy: boolean;
  isMoot: boolean;
  isStarred: boolean;
  isFollowRequestPending: boolean;
  isBlocked: boolean;
  isMuted: boolean;
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

type CountRow = RowDataPacket & {
  table_count?: number | string;
  column_count?: number | string;
};

type ProfileVisibility = "public" | "private";

type ProfileThemeConfig =
  | {
      mode: "preset";
      preset: string;
    }
  | {
      mode: "custom";
      colors: Record<(typeof profileThemeColorKeys)[number], string>;
    };

const profileHandlePattern = /^[a-z0-9_-]{1,40}$/;
const profileThemeColorKeys = [
  "canvas",
  "canvasSoft",
  "surface",
  "surfaceStrong",
  "text",
  "muted",
  "line",
  "lineStrong",
  "accent",
  "accentInk",
  "accentStrong",
  "focus",
] as const;

export function normalizeProfileHandle(handle: string): string | null {
  try {
    const decoded = decodeURIComponent(handle);
    const normalized = decoded.replace(/^@/, "").toLowerCase();

    return profileHandlePattern.test(normalized) ? normalized : null;
  } catch {
    return null;
  }
}

export function profilePayloadFromRow(
  row: ProfileRow,
  social: ProfileSocialContext = profileSocialContextFromRow(row),
  bioEntities: TextEntityPayload[] = [],
): Omit<ProfilePayload, "featuredPost" | "featuredRoom"> {
  const stats = {
    posts: numberValue(row.post_count),
    replies: numberValue(row.profile_reply_count),
    rooms: numberValue(row.room_count),
    echoes: numberValue(row.profile_like_count),
    followers: social.followerCount,
    following: social.followingCount,
    moots: social.mootCount,
    stars: social.starCount,
  };
  const visibility = profileVisibility(row.visibility);

  return {
    user: userPayloadFromRow(row),
    bio: stringValue(row.bio),
    bioEntities,
    location: stringValue(row.location),
    avatarUrl: nullableStringValue(row.avatar_url),
    bannerUrl: nullableStringValue(row.banner_url),
    profileAccent: nullableStringValue(row.profile_accent),
    profileBackground: nullableStringValue(row.profile_background),
    profileBackgroundVideo: nullableStringValue(row.profile_background_video_url),
    profileBackgroundVideoPoster: nullableStringValue(row.profile_background_video_poster_url),
    profileBackgroundBlur: profileBackgroundBlur(row.profile_background_blur),
    profileTheme: nullableStringValue(row.profile_theme),
    profileThemeConfig: profileThemeConfigPayload(row.profile_theme_config_json),
    profileLayoutPreset: profileLayoutPreset(row.profile_layout_preset),
    profileCanvasVersion: 2,
    profileCanvasGlass: profileCanvasGlass(row.profile_canvas_glass_opacity),
    visibility,
    isPrivate: visibility === "private",
    viewerCanView: true,
    featuredPostId: profileNullableId(row.featured_post_id),
    featuredRoomId: profileNullableId(row.featured_room_id),
    links: jsonArrayValue(row.links),
    traits: jsonArrayValue(row.traits),
    stats,
    followerCount: social.followerCount,
    followingCount: social.followingCount,
    mootCount: social.mootCount,
    starCount: social.starCount,
    isFollowing: social.isFollowing,
    isFollowedBy: social.isFollowedBy,
    isMoot: social.isMoot,
    isStarred: social.isStarred,
    isFollowRequestPending: social.isFollowRequestPending,
    isBlocked: social.isBlocked,
    isMuted: social.isMuted,
    createdAt: nullableStringValue(row.profile_created_at),
    updatedAt: nullableStringValue(row.profile_updated_at),
  };
}

export function profilePayloadWithFeatured(
  row: ProfileRow,
  social: ProfileSocialContext,
  bioEntities: TextEntityPayload[],
  featuredPost: PostPayload | null,
  featuredRoom: RoomPayload | null,
): ProfilePayload {
  const payload: ProfilePayload = {
    ...profilePayloadFromRow(row, social, bioEntities),
    featuredPost,
    featuredRoom,
  };
  const viewerCanView = payload.visibility !== "private";

  payload.viewerCanView = viewerCanView;

  if (!viewerCanView) {
    payload.bio = "";
    payload.bioEntities = [];
    payload.location = "";
    payload.profileBackground = null;
    payload.profileBackgroundVideo = null;
    payload.profileBackgroundVideoPoster = null;
    payload.links = [];
    payload.traits = [];
    payload.featuredPost = null;
    payload.featuredRoom = null;
  }

  return payload;
}

export function buildProfileByHandleQuery(capabilities: ProfileSchemaCapabilities): string {
  return `SELECT
            u.id AS user_id,
            u.handle,
            u.status AS user_status,
            p.display_name,
            p.bio,
            p.location,
            p.avatar_url,
            ${profileCustomizationSelectSql("p", capabilities)}
            ${profileFeaturedSelectSql("p", capabilities)}
            ${profileVisibilitySelectSql("p", capabilities)}
            p.links,
            p.traits,
            p.created_at AS profile_created_at,
            p.updated_at AS profile_updated_at,
            (
                SELECT COUNT(*)
                FROM posts profile_posts
                LEFT JOIN rooms profile_post_rooms ON profile_post_rooms.id = profile_posts.room_id
                WHERE profile_posts.author_id = u.id
                  AND profile_posts.parent_id IS NULL
                  AND profile_posts.visibility = 'public'
                  AND profile_posts.status = 'published'
                  AND profile_posts.deleted_at IS NULL
                  AND (
                    profile_posts.room_id IS NULL
                    OR (profile_post_rooms.visibility = 'public' ${roomNotDeletedSql("profile_post_rooms", capabilities)})
                  )
            ) AS post_count,
            (
                SELECT COUNT(*)
                FROM posts profile_replies
                LEFT JOIN rooms profile_reply_rooms ON profile_reply_rooms.id = profile_replies.room_id
                ${postAncestorVisibilityJoinsSql("profile_replies")}
                WHERE profile_replies.author_id = u.id
                  AND profile_replies.parent_id IS NOT NULL
                  AND ${publicPostVisibleSql("profile_replies", "profile_reply_rooms", capabilities)}
                  AND ${postAncestorVisibilitySql("profile_replies", capabilities)}
            ) AS profile_reply_count,
            (
                SELECT COUNT(*)
                FROM rooms profile_rooms
                WHERE profile_rooms.created_by = u.id
                  AND profile_rooms.visibility = 'public'
                  ${roomNotDeletedSql("profile_rooms", capabilities)}
            ) AS room_count,
            ${profileReceivedLikesCountSql("u.id", capabilities)} AS profile_like_count,
            ${profileStarCountSql("u.id", capabilities)} AS star_count
        FROM users u
        INNER JOIN profiles p ON p.user_id = u.id
        WHERE u.handle = ?
          AND ${userPubliclyAvailableSql("u", capabilities)}
        LIMIT 1`;
}

export function createProfilesRepository(pool: Pool): ProfilesRepository {
  return new MysqlProfilesRepository(pool);
}

class MysqlProfilesRepository implements ProfilesRepository {
  private capabilities?: Promise<ProfileSchemaCapabilities>;

  constructor(private readonly pool: Pool) {}

  async getPublicProfile(handle: string): Promise<ProfilePayload | null> {
    const capabilities = await this.schemaCapabilities();
    const [rows] = await this.pool.execute<ProfileRow[]>(buildProfileByHandleQuery(capabilities), [handle]);
    const row = rows[0];

    if (row === undefined) {
      return null;
    }

    const social = await this.profileSocialContext(numberValue(row.user_id), capabilities);
    const bioEntities = await this.textEntities("profile", numberValue(row.user_id), "bio", capabilities);

    if (profileVisibility(row.visibility) === "private") {
      return profilePayloadWithFeatured(row, social, bioEntities, null, null);
    }

    const [featuredPost, featuredRoom] = await Promise.all([
      this.featuredPost(row, capabilities),
      this.featuredRoom(row, capabilities),
    ]);

    return profilePayloadWithFeatured(row, social, bioEntities, featuredPost, featuredRoom);
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
      hasRoomSoftDeleteColumn,
      hasPostPublicIdColumn,
      hasPostReblogs,
      hasTextEntities,
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
    };
  }

  private async profileSocialContext(
    profileUserId: number,
    capabilities: ProfileSchemaCapabilities,
  ): Promise<ProfileSocialContext> {
    const context = defaultProfileSocialContext();

    if (capabilities.hasProfileStars) {
      const [rows] = await this.pool.execute<(RowDataPacket & { star_count: number | string | null })[]>(
        `SELECT ${profileStarCountSql("?", capabilities)} AS star_count`,
        [profileUserId],
      );
      const row = rows[0];
      context.starCount = row === undefined ? 0 : numberValue(row.star_count);
    }

    if (!capabilities.hasUserFollows) {
      return context;
    }

    const [rows] = await this.pool.execute<
      (RowDataPacket & {
        follower_count: number | string | null;
        following_count: number | string | null;
        moot_count: number | string | null;
      })[]
    >(
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
      [profileUserId, profileUserId, profileUserId],
    );
    const row = rows[0];

    if (row !== undefined) {
      context.followerCount = numberValue(row.follower_count);
      context.followingCount = numberValue(row.following_count);
      context.mootCount = numberValue(row.moot_count);
    }

    return context;
  }

  private async featuredPost(row: ProfileRow, capabilities: ProfileSchemaCapabilities): Promise<PostPayload | null> {
    const postId = profileNullableId(row.featured_post_id);

    if (postId === null) {
      return null;
    }

    const [rows] = await this.pool.execute<PostRow[]>(buildFeaturedPostQuery(capabilities), [
      postId,
      numberValue(row.user_id),
    ]);
    const postRow = rows[0];

    if (postRow === undefined) {
      return null;
    }

    const [postEntities, profileEntities] = await Promise.all([
      this.textEntities("post", numberValue(postRow.post_id), "body", capabilities),
      this.textEntities("profile", numberValue(postRow.user_id), "bio", capabilities),
    ]);

    return postPayloadFromRow(postRow, postEntities, profileEntities);
  }

  private async featuredRoom(row: ProfileRow, capabilities: ProfileSchemaCapabilities): Promise<RoomPayload | null> {
    const roomId = profileNullableId(row.featured_room_id);

    if (roomId === null) {
      return null;
    }

    const [rows] = await this.pool.execute<RoomRow[]>(buildFeaturedRoomQuery(numberValue(row.user_id), capabilities), [
      roomId,
    ]);
    const roomRow = rows[0];

    return roomRow === undefined ? null : roomPayloadFromRow(roomRow);
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

    return rows.flatMap((entityRow) => {
      const entity = textEntityPayloadFromRow(entityRow);

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

function defaultProfileSocialContext(): ProfileSocialContext {
  return {
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
}

function profileSocialContextFromRow(row: ProfileRow): ProfileSocialContext {
  return {
    followerCount: numberValue(row.follower_count),
    followingCount: numberValue(row.following_count),
    mootCount: numberValue(row.moot_count),
    starCount: numberValue(row.star_count),
    isFollowing: booleanValue(row.is_following),
    isFollowedBy: booleanValue(row.is_followed_by),
    isMoot: booleanValue(row.is_moot),
    isStarred: booleanValue(row.is_starred),
    isFollowRequestPending: booleanValue(row.is_follow_request_pending),
    isBlocked: booleanValue(row.is_blocked),
    isMuted: booleanValue(row.is_muted),
  };
}

function buildFeaturedPostQuery(capabilities: ProfileSchemaCapabilities): string {
  return `${postSelectSql(
    `AND p.id = ?
     AND p.author_id = ?`,
    "p.created_at DESC, p.id DESC",
    "",
    capabilities,
  )}`;
}

function buildFeaturedRoomQuery(profileUserId: number, capabilities: ProfileSchemaCapabilities): string {
  return `${roomSelectSql(capabilities)}
        WHERE rooms.id = ?
          AND rooms.visibility = 'public'
          ${roomNotDeletedSql("rooms", capabilities)}
          AND ${profileFeaturedRoomEligibilitySql(profileUserId, "rooms", capabilities)}
        LIMIT 1`;
}

function postSelectSql(
  whereClause: string,
  orderClause: string,
  extraSelect: string,
  capabilities: ProfileSchemaCapabilities,
): string {
  const reblogSelect = capabilities.hasPostReblogs
    ? `COALESCE(reblogs.reblog_count, 0) AS reblog_count,
        NULL AS current_reblog_user_id,`
    : `0 AS reblog_count,
        NULL AS current_reblog_user_id,`;
  const reblogJoins = capabilities.hasPostReblogs
    ? `LEFT JOIN (
        SELECT post_id, COUNT(*) AS reblog_count
        FROM post_reblogs
        GROUP BY post_id
    ) reblogs ON reblogs.post_id = p.id`
    : "";
  const resolvedExtraSelect = extraSelect.trim() === "" ? "" : `,\n        ${extraSelect}`;

  return `SELECT
        p.id AS post_id,
        ${postPublicIdSelectSql(capabilities)}
        p.parent_id AS post_parent_id,
        p.body AS post_body,
        p.mood AS post_mood,
        p.media_url AS post_media_url,
        p.visibility AS post_visibility,
        p.status AS post_status,
        p.deleted_at AS post_deleted_at,
        p.created_at AS post_created_at,
        p.updated_at AS post_updated_at,
        u.id AS user_id,
        u.handle,
        pr.display_name,
        pr.bio,
        pr.location,
        pr.avatar_url,
        ${profileCustomizationSelectSql("pr", capabilities)}
        ${profileVisibilitySelectSql("pr", capabilities)}
        NULL AS featured_post_id,
        NULL AS featured_room_id,
        pr.links,
        pr.traits,
        pr.created_at AS profile_created_at,
        pr.updated_at AS profile_updated_at,
        COALESCE(profile_posts.post_count, 0) AS post_count,
        COALESCE(profile_replies.reply_count, 0) AS profile_reply_count,
        COALESCE(profile_rooms.room_count, 0) AS room_count,
        COALESCE(profile_likes.like_count, 0) AS profile_like_count,
        COALESCE(profile_stars.star_count, 0) AS star_count,
        r.id AS room_id,
        r.slug AS room_slug,
        r.name AS room_name,
        r.summary AS room_summary,
        r.mood AS room_mood,
        r.member_count AS room_member_count,
        r.is_live AS room_is_live,
        r.accent AS room_accent,
        NULL AS room_icon_url,
        NULL AS room_banner_url,
        NULL AS room_rules,
        r.visibility AS room_visibility,
        r.created_by AS room_created_by,
        NULL AS current_room_role,
        0 AS current_room_joined,
        owner.id AS owner_user_id,
        owner.handle AS owner_handle,
        owner_profile.display_name AS owner_display_name,
        owner_profile.avatar_url AS owner_avatar_url,
        COALESCE(room_posts.post_count, 0) AS room_post_count,
        room_posts.latest_activity_at AS room_latest_activity_at,
        r.created_at AS room_created_at,
        r.updated_at AS room_updated_at,
        COALESCE(reactions.glow_count, 0) AS reaction_glow_count,
        COALESCE(reactions.echo_count, 0) AS reaction_echo_count,
        COALESCE(reactions.hush_count, 0) AS reaction_hush_count,
        COALESCE(replies.reply_count, 0) AS reply_count,
        NULL AS current_like_user_id,
        NULL AS current_viewer_user_id,
        0 AS current_user_follows_author,
        0 AS author_follows_current_user,
        0 AS followed_like_count,
        ${reblogSelect}
        NULL AS reblogged_by_user_id,
        NULL AS reblogged_by_handle,
        NULL AS reblogged_by_display_name,
        NULL AS reblogged_by_avatar_url,
        NULL AS reblogged_at,
        1 AS feed_row_marker${resolvedExtraSelect}
    FROM posts p
    INNER JOIN users u ON u.id = p.author_id
    INNER JOIN profiles pr ON pr.user_id = u.id
    LEFT JOIN rooms r ON r.id = p.room_id
    ${postAncestorVisibilityJoinsSql("p")}
    LEFT JOIN users owner ON owner.id = r.created_by
    LEFT JOIN profiles owner_profile ON owner_profile.user_id = owner.id
    LEFT JOIN (
        SELECT
            room_id,
            SUM(parent_id IS NULL) AS post_count,
            MAX(created_at) AS latest_activity_at
        FROM posts
        WHERE room_id IS NOT NULL
          AND visibility = 'public'
          AND status = 'published'
          AND deleted_at IS NULL
        GROUP BY room_id
    ) room_posts ON room_posts.room_id = r.id
    LEFT JOIN (
        SELECT author_id, COUNT(*) AS post_count
        FROM posts profile_posts
        LEFT JOIN rooms profile_post_rooms ON profile_post_rooms.id = profile_posts.room_id
        WHERE profile_posts.visibility = 'public'
          AND profile_posts.parent_id IS NULL
          AND profile_posts.status = 'published'
          AND profile_posts.deleted_at IS NULL
          AND (
            profile_posts.room_id IS NULL
            OR (profile_post_rooms.visibility = 'public' ${roomNotDeletedSql("profile_post_rooms", capabilities)})
          )
        GROUP BY author_id
    ) profile_posts ON profile_posts.author_id = u.id
    LEFT JOIN (
        SELECT profile_replies.author_id AS author_id, COUNT(*) AS reply_count
        FROM posts profile_replies
        LEFT JOIN rooms profile_reply_rooms ON profile_reply_rooms.id = profile_replies.room_id
        ${postAncestorVisibilityJoinsSql("profile_replies")}
        WHERE profile_replies.parent_id IS NOT NULL
          AND ${publicPostVisibleSql("profile_replies", "profile_reply_rooms", capabilities)}
          AND ${postAncestorVisibilitySql("profile_replies", capabilities)}
        GROUP BY profile_replies.author_id
    ) profile_replies ON profile_replies.author_id = u.id
    LEFT JOIN (
        SELECT created_by, COUNT(*) AS room_count
        FROM rooms
        WHERE visibility = 'public'
          ${roomNotDeletedSql("rooms", capabilities)}
        GROUP BY created_by
    ) profile_rooms ON profile_rooms.created_by = u.id
    LEFT JOIN (
        ${profileReceivedLikesAggregateSql(capabilities)}
    ) profile_likes ON profile_likes.author_id = u.id
    LEFT JOIN (
        ${profileStarsAggregateSql(capabilities)}
    ) profile_stars ON profile_stars.starred_user_id = u.id
    LEFT JOIN (
        SELECT
            post_id,
            SUM(type = 'glow') AS glow_count,
            SUM(type = 'echo') AS echo_count,
            SUM(type = 'hush') AS hush_count
        FROM post_reactions
        GROUP BY post_id
    ) reactions ON reactions.post_id = p.id
    LEFT JOIN (
        SELECT reply_posts.parent_id, COUNT(*) AS reply_count
        FROM posts reply_posts
        LEFT JOIN rooms reply_rooms ON reply_rooms.id = reply_posts.room_id
        ${postAncestorVisibilityJoinsSql("reply_posts")}
        WHERE reply_posts.parent_id IS NOT NULL
          AND ${publicPostVisibleSql("reply_posts", "reply_rooms", capabilities)}
          AND ${postAncestorVisibilitySql("reply_posts", capabilities)}
        GROUP BY reply_posts.parent_id
    ) replies ON replies.parent_id = p.id
    ${reblogJoins}
    WHERE ${publicPostVisibleSql("p", "r", capabilities)}
      AND ${userPubliclyAvailableSql("u", capabilities)}
      AND ${postAncestorVisibilitySql("p", capabilities)}
      ${profileAuthorVisibilitySql("u", "pr", capabilities)}
      ${whereClause}
    ORDER BY ${orderClause}
    LIMIT 50`;
}

function postPayloadFromRow(
  row: PostRow,
  bodyEntities: TextEntityPayload[],
  profileBioEntities: TextEntityPayload[],
): PostPayload {
  const profile = profilePayloadFromRow(row, profileSocialContextFromRow(row), profileBioEntities);
  const likeCount = numberValue(row.reaction_glow_count);
  const currentViewerUserId = nullableNumberValue(row.current_viewer_user_id);
  const userId = numberValue(row.user_id);
  const isCurrentUser = currentViewerUserId !== null && userId === currentViewerUserId;
  const isFollowingAuthor = booleanValue(row.current_user_follows_author);
  const isFollowedByAuthor = booleanValue(row.author_follows_current_user);

  return {
    id: numberValue(row.post_id),
    publicId: postRowPublicId(row),
    body: stringValue(row.post_body),
    bodyEntities,
    mood: stringValue(row.post_mood),
    mediaUrl: nullableStringValue(row.post_media_url),
    visibility: stringValue(row.post_visibility),
    status: stringValue(row.post_status),
    parentId: nullableNumberValue(row.post_parent_id),
    deletedAt: nullableStringValue(row.post_deleted_at),
    createdAt: nullableStringValue(row.post_created_at),
    updatedAt: nullableStringValue(row.post_updated_at),
    author: profile.user,
    profile,
    room: nullableRoomPayload(row),
    commentCount: numberValue(row.reply_count),
    reactions: {
      glow: likeCount,
      echo: numberValue(row.reaction_echo_count),
      hush: numberValue(row.reaction_hush_count),
    },
    likeCount,
    likedByCurrentUser: row.current_like_user_id !== null,
    reblogCount: numberValue(row.reblog_count),
    rebloggedByMe: row.current_reblog_user_id !== null,
    rebloggedByCurrentUser: row.current_reblog_user_id !== null,
    rebloggedBy: reblogContextUserPayload(row),
    rebloggedAt: nullableStringValue(row.reblogged_at),
    socialContext: {
      authorRelationship: authorRelationship(isCurrentUser, isFollowingAuthor, isFollowedByAuthor),
      likedByFollowedCount: numberValue(row.followed_like_count),
    },
  };
}

function roomSelectSql(capabilities: ProfileSchemaCapabilities): string {
  return `SELECT
            rooms.id AS room_id,
            rooms.slug AS room_slug,
            rooms.name AS room_name,
            rooms.summary AS room_summary,
            rooms.mood AS room_mood,
            ${roomMembershipCountSelectSql(capabilities)}
            rooms.is_live AS room_is_live,
            rooms.accent AS room_accent,
            ${roomCustomizationSelectSql(capabilities)}
            rooms.visibility AS room_visibility,
            rooms.created_by AS room_created_by,
            NULL AS current_room_role,
            0 AS current_room_joined,
            owner.id AS owner_user_id,
            owner.handle AS owner_handle,
            owner_profile.display_name AS owner_display_name,
            owner_profile.avatar_url AS owner_avatar_url,
            COALESCE(room_posts.post_count, 0) AS room_post_count,
            room_posts.latest_activity_at AS room_latest_activity_at,
            rooms.created_at AS room_created_at,
            rooms.updated_at AS room_updated_at
        FROM rooms
        LEFT JOIN users owner ON owner.id = rooms.created_by
        LEFT JOIN profiles owner_profile ON owner_profile.user_id = owner.id
        ${roomMembershipCountJoinSql(capabilities)}
        LEFT JOIN (
            SELECT
                room_id,
                SUM(parent_id IS NULL) AS post_count,
                MAX(created_at) AS latest_activity_at
            FROM posts
            WHERE room_id IS NOT NULL
              AND visibility = 'public'
              AND status = 'published'
              AND deleted_at IS NULL
            GROUP BY room_id
        ) room_posts ON room_posts.room_id = rooms.id`;
}

function userPayloadFromRow(row: ProfileRow): UserPayload {
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
    payload.mention = {
      handle,
      user: {
        id: numberValue(row.target_user_id),
        handle,
        displayName: stringValue(row.target_display_name, handle),
        initials: initialsFromName(stringValue(row.target_display_name, handle)),
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

function profileCustomizationSelectSql(alias: string, capabilities: ProfileSchemaCapabilities): string {
  validateSchemaIdentifier(alias);

  const layoutSelect = capabilities.hasProfileLayoutPresetColumn
    ? `${alias}.profile_layout_preset,`
    : "NULL AS profile_layout_preset,";
  const backgroundBlurSelect = capabilities.hasProfileBackgroundBlurColumn
    ? `${alias}.profile_background_blur,`
    : "NULL AS profile_background_blur,";
  const canvasVersionSelect = capabilities.hasProfileCanvasVersionColumn
    ? `${alias}.profile_canvas_version,`
    : "2 AS profile_canvas_version,";
  const canvasGlassSelect = capabilities.hasProfileCanvasGlassColumn
    ? `${alias}.profile_canvas_glass_opacity,`
    : "58 AS profile_canvas_glass_opacity,";
  const backgroundVideoSelect = capabilities.hasProfileBackgroundVideoColumns
    ? `${alias}.profile_background_video_url,
            ${alias}.profile_background_video_poster_url,`
    : `NULL AS profile_background_video_url,
            NULL AS profile_background_video_poster_url,`;
  const themeConfigSelect = capabilities.hasProfileThemeConfigColumn
    ? `${alias}.profile_theme_config_json,`
    : "NULL AS profile_theme_config_json,";

  if (capabilities.hasProfileCustomizationColumns) {
    return `${alias}.banner_url,
            ${alias}.profile_accent,
            ${alias}.profile_background,
            ${backgroundVideoSelect}
            ${backgroundBlurSelect}
            ${alias}.profile_theme,
            ${themeConfigSelect}
            ${layoutSelect}
            ${canvasVersionSelect}
            ${canvasGlassSelect}`;
  }

  return `NULL AS banner_url,
            NULL AS profile_accent,
            NULL AS profile_background,
            NULL AS profile_background_video_url,
            NULL AS profile_background_video_poster_url,
            NULL AS profile_background_blur,
            NULL AS profile_theme,
            NULL AS profile_theme_config_json,
            ${layoutSelect}
            ${canvasVersionSelect}
            ${canvasGlassSelect}`;
}

function profileFeaturedSelectSql(alias: string, capabilities: ProfileSchemaCapabilities): string {
  validateSchemaIdentifier(alias);

  if (capabilities.hasProfileFeaturedColumns) {
    return `${alias}.featured_post_id,
            ${alias}.featured_room_id,`;
  }

  return `NULL AS featured_post_id,
            NULL AS featured_room_id,`;
}

function profileVisibilitySelectSql(alias: string, capabilities: ProfileSchemaCapabilities): string {
  validateSchemaIdentifier(alias);

  return capabilities.hasProfileVisibilityColumn ? `${alias}.visibility,` : "'public' AS visibility,";
}

function postPublicIdSelectSql(capabilities: ProfileSchemaCapabilities): string {
  return capabilities.hasPostPublicIdColumn ? "p.public_id AS post_public_id," : "NULL AS post_public_id,";
}

function roomMembershipCountSelectSql(capabilities: ProfileSchemaCapabilities): string {
  return capabilities.hasRoomMemberships
    ? "COALESCE(room_member_counts.member_count, 0) AS room_member_count,"
    : "rooms.member_count AS room_member_count,";
}

function roomMembershipCountJoinSql(capabilities: ProfileSchemaCapabilities): string {
  if (!capabilities.hasRoomMemberships) {
    return "";
  }

  return `LEFT JOIN (
            SELECT room_id, COUNT(*) AS member_count
            FROM room_memberships
            WHERE banned_at IS NULL
            GROUP BY room_id
        ) room_member_counts ON room_member_counts.room_id = rooms.id`;
}

function roomCustomizationSelectSql(capabilities: ProfileSchemaCapabilities): string {
  if (capabilities.hasRoomCustomizationColumns) {
    return `rooms.icon_url AS room_icon_url,
            rooms.banner_url AS room_banner_url,
            rooms.rules AS room_rules,`;
  }

  return `NULL AS room_icon_url,
            NULL AS room_banner_url,
            NULL AS room_rules,`;
}

function roomNotDeletedSql(alias: string, capabilities: ProfileSchemaCapabilities): string {
  validateSchemaIdentifier(alias);

  return capabilities.hasRoomSoftDeleteColumn ? `AND ${alias}.deleted_at IS NULL` : "";
}

function publicPostVisibleSql(postAlias: string, roomAlias: string, capabilities: ProfileSchemaCapabilities): string {
  validateSchemaIdentifier(postAlias);
  validateSchemaIdentifier(roomAlias);

  return `${postAlias}.visibility = 'public'
        AND ${postAlias}.status = 'published'
        AND ${postAlias}.deleted_at IS NULL
        AND (
            ${postAlias}.room_id IS NULL
            OR (${roomAlias}.visibility = 'public' ${roomNotDeletedSql(roomAlias, capabilities)})
        )`;
}

function postAncestorVisibilityJoinsSql(postAlias: string): string {
  validateSchemaIdentifier(postAlias);

  return `LEFT JOIN posts parent_post ON parent_post.id = ${postAlias}.parent_id
    LEFT JOIN rooms parent_post_room ON parent_post_room.id = parent_post.room_id
    LEFT JOIN posts grandparent_post ON grandparent_post.id = parent_post.parent_id
    LEFT JOIN rooms grandparent_post_room ON grandparent_post_room.id = grandparent_post.room_id
    LEFT JOIN posts great_grandparent_post ON great_grandparent_post.id = grandparent_post.parent_id
    LEFT JOIN rooms great_grandparent_post_room ON great_grandparent_post_room.id = great_grandparent_post.room_id`;
}

function postAncestorVisibilitySql(postAlias: string, capabilities: ProfileSchemaCapabilities): string {
  validateSchemaIdentifier(postAlias);

  const parentVisible = publicPostVisibleSql("parent_post", "parent_post_room", capabilities);
  const grandparentVisible = publicPostVisibleSql("grandparent_post", "grandparent_post_room", capabilities);
  const greatGrandparentVisible = publicPostVisibleSql(
    "great_grandparent_post",
    "great_grandparent_post_room",
    capabilities,
  );

  return `(
        ${postAlias}.parent_id IS NULL
        OR (
            parent_post.id IS NOT NULL
            AND ${parentVisible}
            AND (
                parent_post.parent_id IS NULL
                OR (
                    grandparent_post.id IS NOT NULL
                    AND ${grandparentVisible}
                    AND (
                        grandparent_post.parent_id IS NULL
                        OR (
                            great_grandparent_post.id IS NOT NULL
                            AND ${greatGrandparentVisible}
                        )
                    )
                )
            )
        )
    )`;
}

function profileReceivedLikesCountSql(authorSql: string, capabilities: ProfileSchemaCapabilities): string {
  return `(SELECT COUNT(*)
            FROM post_reactions profile_likes
            INNER JOIN posts profile_like_posts ON profile_like_posts.id = profile_likes.post_id
            LEFT JOIN rooms profile_like_rooms ON profile_like_rooms.id = profile_like_posts.room_id
            ${postAncestorVisibilityJoinsSql("profile_like_posts")}
            WHERE profile_like_posts.author_id = ${authorSql}
              AND profile_likes.type = 'glow'
              AND ${publicPostVisibleSql("profile_like_posts", "profile_like_rooms", capabilities)}
              AND ${postAncestorVisibilitySql("profile_like_posts", capabilities)})`;
}

function profileReceivedLikesAggregateSql(capabilities: ProfileSchemaCapabilities): string {
  return `SELECT profile_like_posts.author_id, COUNT(*) AS like_count
        FROM post_reactions profile_likes
        INNER JOIN posts profile_like_posts ON profile_like_posts.id = profile_likes.post_id
        LEFT JOIN rooms profile_like_rooms ON profile_like_rooms.id = profile_like_posts.room_id
        ${postAncestorVisibilityJoinsSql("profile_like_posts")}
        WHERE profile_likes.type = 'glow'
          AND ${publicPostVisibleSql("profile_like_posts", "profile_like_rooms", capabilities)}
          AND ${postAncestorVisibilitySql("profile_like_posts", capabilities)}
        GROUP BY profile_like_posts.author_id`;
}

function profileStarCountSql(profileUserSql: string, capabilities: ProfileSchemaCapabilities): string {
  if (!capabilities.hasProfileStars) {
    return "0";
  }

  return `(SELECT COUNT(*)
            FROM profile_stars profile_star_counts
            INNER JOIN users profile_star_users ON profile_star_users.id = profile_star_counts.starrer_id
            WHERE profile_star_counts.starred_user_id = ${profileUserSql}
              AND profile_star_users.status = 'active'
              ${pairNotBlockedSql("profile_star_counts.starrer_id", "profile_star_counts.starred_user_id", capabilities)})`;
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

function profileAuthorVisibilitySql(
  userAlias: string,
  profileAlias: string,
  capabilities: ProfileSchemaCapabilities,
): string {
  validateSchemaIdentifier(userAlias);
  validateSchemaIdentifier(profileAlias);

  if (!capabilities.hasProfileVisibilityColumn) {
    return "";
  }

  if (!capabilities.hasUserFollows) {
    return `AND ${profileAlias}.visibility = 'public'`;
  }

  return `AND (
        ${profileAlias}.visibility = 'public'
        OR ${userAlias}.id = NULL
        OR EXISTS (
            SELECT 1
            FROM user_follows private_profile_follows
            WHERE private_profile_follows.follower_id = NULL
              AND private_profile_follows.following_id = ${userAlias}.id
        )
    )`;
}

function profileFeaturedRoomEligibilitySql(
  profileUserId: number,
  roomAlias: string,
  capabilities: ProfileSchemaCapabilities,
): string {
  validateSchemaIdentifier(roomAlias);

  let membershipSql = "";

  if (capabilities.hasRoomMemberships) {
    membershipSql = ` OR EXISTS (
            SELECT 1
            FROM room_memberships featured_room_memberships
            WHERE featured_room_memberships.room_id = ${roomAlias}.id
              AND featured_room_memberships.user_id = ${profileUserId}
              AND featured_room_memberships.banned_at IS NULL
              AND featured_room_memberships.role IN ('owner', 'moderator', 'member')
        )`;
  }

  return `(${roomAlias}.created_by = ${profileUserId}${membershipSql})`;
}

function nullableRoomPayload(row: PostRow): RoomPayload | null {
  return row.room_id === null ? null : roomPayloadFromRow(row);
}

function reblogContextUserPayload(row: PostRow): UserPayload | null {
  if (row.reblogged_by_user_id === null || row.reblogged_by_handle === null) {
    return null;
  }

  const handle = stringValue(row.reblogged_by_handle);
  const displayName = stringValue(row.reblogged_by_display_name, handle);

  return {
    id: numberValue(row.reblogged_by_user_id),
    handle,
    displayName,
    initials: initialsFromName(displayName),
    aura: "frost",
    avatarUrl: nullableStringValue(row.reblogged_by_avatar_url),
  };
}

function authorRelationship(
  isCurrentUser: boolean,
  isFollowingAuthor: boolean,
  isFollowedByAuthor: boolean,
): "self" | "moot" | "following" | null {
  if (isCurrentUser) {
    return "self";
  }

  if (isFollowingAuthor && isFollowedByAuthor) {
    return "moot";
  }

  if (isFollowingAuthor) {
    return "following";
  }

  return null;
}

function profileVisibility(value: string | null | undefined): ProfileVisibility {
  return value === "private" ? "private" : "public";
}

function profileLayoutPreset(value: string | null | undefined): string {
  if (typeof value !== "string") {
    return "balanced";
  }

  const preset = value.trim().toLowerCase();

  return preset === "balanced" || preset === "compact" || preset === "showcase" ? preset : "balanced";
}

function profileBackgroundBlur(value: string | null | undefined): string {
  if (typeof value !== "string") {
    return "medium";
  }

  const blur = value.trim().toLowerCase();

  return blur === "none" || blur === "soft" || blur === "medium" || blur === "heavy" ? blur : "medium";
}

function profileCanvasGlass(value: number | string | null | undefined): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.min(92, Math.trunc(value)));
  }

  if (typeof value === "string" && /^[0-9]+$/.test(value)) {
    return Math.max(0, Math.min(92, Number(value)));
  }

  return 58;
}

function profileThemeConfigPayload(value: string | null | undefined): ProfileThemeConfig | null {
  const decoded = jsonArrayOrObject(value);

  if (decoded === null || Array.isArray(decoded)) {
    return null;
  }

  const mode = decoded.mode;

  if (mode === "preset") {
    const preset = decoded.preset;

    return typeof preset === "string" && /^[a-z0-9_-]{1,40}$/.test(preset)
      ? {
          mode,
          preset,
        }
      : null;
  }

  if (mode !== "custom" || typeof decoded.colors !== "object" || decoded.colors === null || Array.isArray(decoded.colors)) {
    return null;
  }

  const rawColors = decoded.colors as Record<string, unknown>;
  const colors = Object.fromEntries(
    profileThemeColorKeys.map((key) => {
      const color = rawColors[key];

      if (typeof color !== "string" || !/^#[0-9a-fA-F]{6}$/.test(color)) {
        return [key, null];
      }

      return [key, color.toUpperCase()];
    }),
  ) as Record<(typeof profileThemeColorKeys)[number], string | null>;

  if (Object.values(colors).some((color) => color === null)) {
    return null;
  }

  return {
    mode,
    colors: colors as Record<(typeof profileThemeColorKeys)[number], string>,
  };
}

function profileNullableId(value: number | string | null | undefined): number | null {
  const id = numberValue(value);

  return id > 0 ? id : null;
}

function postRowPublicId(row: PostRow): string {
  const publicId = stringValue(row.post_public_id);

  return publicId === "" ? String(numberValue(row.post_id)) : publicId;
}

function jsonArrayValue(value: string | null | undefined): unknown[] {
  const decoded = jsonArrayOrObject(value);

  if (decoded === null) {
    return [];
  }

  return Array.isArray(decoded) ? decoded : Object.values(decoded);
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

function nullableNumberValue(value: boolean | number | string | bigint | null | undefined): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  return numberValue(value);
}

function stringValue(value: Date | string | number | null | undefined, fallback = ""): string {
  return nullableStringValue(value) ?? fallback;
}

function nullableStringValue(value: Date | string | number | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  return String(value);
}

function validateSchemaIdentifier(identifier: string): void {
  if (!/^[a-zA-Z0-9_]+$/.test(identifier)) {
    throw new Error("Invalid schema identifier.");
  }
}
