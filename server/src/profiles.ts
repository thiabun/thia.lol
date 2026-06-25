import type { Pool, RowDataPacket } from "mysql2/promise";

import { initialsFromName, roomPayloadFromRow, type RoomPayload, type RoomRow, type UserPayload } from "./rooms.js";

export interface ProfilesRepository {
  getPublicProfile(handle: string): Promise<ProfilePayload | null>;
  getPublicProfileRooms(handle: string): Promise<RoomPayload[] | null>;
  getPublicProfileModules(handle: string): Promise<ProfileModulePayload[] | null>;
  getPublicProfileBadges(handle: string): Promise<ProfileBadgesPayload | null>;
  getPublicProfileFollowers(handle: string): Promise<FollowUserCardPayload[] | null>;
  getPublicProfileFollowing(handle: string): Promise<FollowUserCardPayload[] | null>;
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

export interface ProfileModulePayload {
  id: number;
  type: string;
  title: string | null;
  config: Record<string, unknown>;
  visibility: string;
  position: number;
  pinned: boolean;
  layout: ProfileModuleLayoutPayload | null;
  status: string;
  schemaVersion: number;
  createdAt: string | null;
  updatedAt: string | null;
  textEntities?: {
    body: TextEntityPayload[];
  };
}

export interface ProfileModuleLayoutPayload {
  column: number;
  row: number;
  colSpan: number;
  rowSpan: number;
}

export interface BadgePayload {
  id: number;
  badgeKey: string;
  name: string;
  description: string | null;
  rarity: string;
  source: string;
  icon: string | null;
  accent: string | null;
  isActive: boolean;
  createdAt: string | null;
}

export interface UserBadgePayload {
  id: number;
  badge: BadgePayload;
  reason: string | null;
  earnedAt: string | null;
  featuredOrder: number | null;
  isVisible: boolean;
  grantedBy: UserPayload | null;
  user?: UserPayload;
}

export interface ProfileBadgesPayload {
  badges: UserBadgePayload[];
  featuredBadges: UserBadgePayload[];
}

export interface FollowUserCardPayload {
  handle: string;
  displayName: string;
  initials: string;
  avatarUrl: string | null;
  bioSnippet: string;
  isFollowing: boolean;
  isMoot: boolean;
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
  hasProfileModules: boolean;
  hasProfileModuleLayoutColumns: boolean;
  hasProfileModulePinnedColumn: boolean;
  hasBadges: boolean;
  hasUserBadges: boolean;
  hasProfileIntegrationAccounts: boolean;
  hasProfileIntegrationMetadataCache: boolean;
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

export interface ProfileModuleRow extends RowDataPacket {
  id: number | string;
  user_id: number | string;
  type: string;
  title: string | null;
  config_json: string | null;
  visibility: string;
  position: number | string;
  grid_column: number | string | null;
  grid_row: number | string | null;
  grid_col_span: number | string | null;
  grid_row_span: number | string | null;
  grid_pinned: number | string | boolean | null;
  status: string;
  schema_version: number | string;
  created_at: Date | string | null;
  updated_at: Date | string | null;
}

export interface UserBadgeRow extends RowDataPacket {
  user_badge_id: number | string;
  user_badge_user_id: number | string;
  user_badge_badge_id: number | string;
  user_badge_reason: string | null;
  user_badge_earned_at: Date | string | null;
  user_badge_featured_order: number | string | null;
  user_badge_is_visible: number | string | boolean | null;
  badge_id: number | string;
  badge_key: string;
  badge_name: string;
  badge_description: string | null;
  badge_rarity: string | null;
  badge_source: string;
  badge_icon: string | null;
  badge_accent: string | null;
  badge_is_active: number | string | boolean | null;
  badge_created_at: Date | string | null;
  user_id: number | string | null;
  handle: string | null;
  display_name: string | null;
  avatar_url: string | null;
  grantor_user_id: number | string | null;
  grantor_handle: string | null;
  grantor_display_name: string | null;
  grantor_avatar_url: string | null;
}

export interface FollowUserRow extends RowDataPacket {
  user_id: number | string;
  handle: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  followed_at: Date | string | null;
  is_following: number | string | boolean | null;
  is_followed_by: number | string | boolean | null;
}

interface ProfileIntegrationAccountRow extends RowDataPacket {
  provider: string;
  provider_account_id: string;
  provider_handle: string | null;
  display_name: string | null;
  revoked_at: Date | string | null;
}

export interface ProfileIntegrationCacheRow extends RowDataPacket {
  provider: string;
  resource_type: string;
  resource_id: string;
  resource_key: string;
  source_url: string;
  metadata_json: string | null;
  embed_json: string | null;
  api_backed: number | string | boolean | null;
  fetched_at: Date | string | null;
  expires_at: Date | string | null;
  stale_at: Date | string | null;
  error_message: string | null;
}

interface PublicProfileContext {
  row: ProfileRow;
  userId: number;
  viewerCanView: boolean;
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
const profileModuleTypes = new Set([
  "profile_info",
  "about",
  "links",
  "featured_badges",
  "custom_text",
  "gallery_media",
  "creator_live",
  "music",
  "featured_post",
  "featured_room",
  "activity",
  "connections",
  "text",
  "badge_display",
  "github_repo",
  "twitch_channel",
  "youtube_video",
  "youtube_stream",
  "youtube_playlist",
  "uploaded_video",
  "spotify_song",
  "apple_music_song",
  "youtube_music_song",
  "spotify_playlist",
  "apple_music_playlist",
  "youtube_music_playlist",
  "spotify_artist",
  "apple_music_artist",
  "youtube_music_artist",
  "uploaded_image",
  "gallery_slideshow",
  "gallery_feed",
]);
const profileModuleVideoTypes = new Set([
  "twitch_channel",
  "youtube_video",
  "youtube_stream",
  "youtube_playlist",
  "uploaded_video",
]);
const profileModuleMusicSpecificTypes = new Set([
  "spotify_song",
  "apple_music_song",
  "youtube_music_song",
  "spotify_playlist",
  "apple_music_playlist",
  "youtube_music_playlist",
  "spotify_artist",
  "apple_music_artist",
  "youtube_music_artist",
]);
const maxFeaturedBadges = 4;

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
  viewerCanViewOverride?: boolean,
): ProfilePayload {
  const payload: ProfilePayload = {
    ...profilePayloadFromRow(row, social, bioEntities),
    featuredPost,
    featuredRoom,
  };
  const viewerCanView = viewerCanViewOverride ?? payload.visibility !== "private";

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
                    OR (profile_post_rooms.visibility IN ('public', 'view_only') ${roomNotDeletedSql("profile_post_rooms", capabilities)})
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
                  AND profile_rooms.visibility IN ('public', 'view_only')
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

export function buildPublicProfileRoomsQuery(capabilities: ProfileSchemaCapabilities): string {
  return `${roomSelectSql(capabilities)}
        WHERE owner.handle = ?
          AND rooms.visibility IN ('public', 'view_only')
          ${roomNotDeletedSql("rooms", capabilities)}
        ORDER BY rooms.created_at DESC, rooms.name ASC`;
}

export function buildPublicProfileModulesQuery(capabilities: ProfileSchemaCapabilities): string {
  const layoutSelect = capabilities.hasProfileModuleLayoutColumns
    ? "grid_column, grid_row, grid_col_span, grid_row_span,"
    : "NULL AS grid_column, NULL AS grid_row, NULL AS grid_col_span, NULL AS grid_row_span,";
  const pinnedSelect = capabilities.hasProfileModulePinnedColumn ? "grid_pinned," : "0 AS grid_pinned,";

  return `SELECT
            id,
            user_id,
            type,
            title,
            config_json,
            visibility,
            position,
            ${layoutSelect}
            ${pinnedSelect}
            status,
            schema_version,
            created_at,
            updated_at
        FROM profile_modules
        WHERE user_id = ?
          AND (visibility = 'public' OR type = 'activity')
          AND status = 'active'
        ORDER BY position ASC, id ASC`;
}

export function buildProfileBadgesQuery(): string {
  return `${userBadgeSelectSql()}
        WHERE ub.is_visible = 1
          AND b.is_active = 1
          AND ub.user_id = ?
        ORDER BY
          CASE WHEN ub.featured_order IS NULL THEN 1 ELSE 0 END,
          ub.featured_order ASC,
          ub.earned_at DESC,
          ub.id DESC`;
}

export function buildProfileFollowListQuery(
  kind: "followers" | "following",
  capabilities: ProfileSchemaCapabilities,
): string {
  const joinColumn = kind === "followers" ? "follower_id" : "following_id";
  const targetColumn = kind === "followers" ? "following_id" : "follower_id";

  return `SELECT
            u.id AS user_id,
            u.handle,
            p.display_name,
            p.avatar_url,
            p.bio,
            follows.created_at AS followed_at,
            EXISTS (
                SELECT 1
                FROM user_follows viewer_following
                WHERE viewer_following.follower_id = ?
                  AND viewer_following.following_id = u.id
            ) AS is_following,
            EXISTS (
                SELECT 1
                FROM user_follows viewer_followed_by
                WHERE viewer_followed_by.follower_id = u.id
                  AND viewer_followed_by.following_id = ?
            ) AS is_followed_by
        FROM user_follows follows
        INNER JOIN users u ON u.id = follows.${joinColumn}
        INNER JOIN profiles p ON p.user_id = u.id
        WHERE follows.${targetColumn} = ?
          AND u.status = 'active'
          ${pairNotBlockedSql("follows.follower_id", "follows.following_id", capabilities)}
        ORDER BY follows.created_at DESC, u.handle ASC
        LIMIT 100`;
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

  async getPublicProfileRooms(handle: string): Promise<RoomPayload[] | null> {
    const capabilities = await this.schemaCapabilities();
    const context = await this.publicProfileContext(handle, capabilities);

    if (context === null) {
      return null;
    }

    if (!context.viewerCanView) {
      return [];
    }

    const [rows] = await this.pool.execute<RoomRow[]>(buildPublicProfileRoomsQuery(capabilities), [handle]);

    return rows.map((row) => roomPayloadFromRow(row));
  }

  async getPublicProfileModules(handle: string): Promise<ProfileModulePayload[] | null> {
    const capabilities = await this.schemaCapabilities();
    const context = await this.publicProfileContext(handle, capabilities);

    if (context === null) {
      return null;
    }

    if (!context.viewerCanView) {
      return [];
    }

    if (!capabilities.hasProfileModules) {
      throw new Error("Profile module storage is not ready.");
    }

    const [rows] = await this.pool.execute<ProfileModuleRow[]>(buildPublicProfileModulesQuery(capabilities), [
      context.userId,
    ]);
    const modules = await this.profileModulesPayload(rows, context.userId, capabilities);

    if (!profileModulesPayloadContainsType(modules, "profile_info")) {
      modules.push(profileInfoModulePayload(0));
    }

    if (
      !profileModulesPayloadContainsType(modules, "activity") &&
      profileModulesPayloadIsBlankProfile(modules) &&
      (await this.profileModulesShouldHaveDefaultFeed(context.userId))
    ) {
      modules.push(profileActivityModulePayload(2));
    }

    return profileModulesSortPayload(modules);
  }

  async getPublicProfileBadges(handle: string): Promise<ProfileBadgesPayload | null> {
    const capabilities = await this.schemaCapabilities();
    const context = await this.publicProfileContext(handle, capabilities);

    if (context === null) {
      return null;
    }

    if (!context.viewerCanView) {
      return {
        badges: [],
        featuredBadges: [],
      };
    }

    if (!capabilities.hasBadges || !capabilities.hasUserBadges) {
      throw new Error("Badge storage is not ready.");
    }

    const [rows] = await this.pool.execute<UserBadgeRow[]>(buildProfileBadgesQuery(), [context.userId]);

    return profileBadgesPayloadFromRows(rows);
  }

  async getPublicProfileFollowers(handle: string): Promise<FollowUserCardPayload[] | null> {
    return this.publicProfileFollowList(handle, "followers");
  }

  async getPublicProfileFollowing(handle: string): Promise<FollowUserCardPayload[] | null> {
    return this.publicProfileFollowList(handle, "following");
  }

  private async publicProfileContext(
    handle: string,
    capabilities: ProfileSchemaCapabilities,
  ): Promise<PublicProfileContext | null> {
    const [rows] = await this.pool.execute<ProfileRow[]>(buildProfileByHandleQuery(capabilities), [handle]);
    const row = rows[0];

    if (row === undefined) {
      return null;
    }

    return {
      row,
      userId: numberValue(row.user_id),
      viewerCanView: profileVisibility(row.visibility) !== "private",
    };
  }

  private async publicProfileFollowList(
    handle: string,
    kind: "followers" | "following",
  ): Promise<FollowUserCardPayload[] | null> {
    const capabilities = await this.schemaCapabilities();
    const context = await this.publicProfileContext(handle, capabilities);

    if (context === null) {
      return null;
    }

    if (!context.viewerCanView) {
      return [];
    }

    if (!capabilities.hasUserFollows) {
      throw new Error("Follow storage is not ready.");
    }

    const [rows] = await this.pool.execute<FollowUserRow[]>(buildProfileFollowListQuery(kind, capabilities), [
      null,
      null,
      context.userId,
    ]);

    return rows.map((row) => followUserCardPayloadFromRow(row));
  }

  private async profileModulesPayload(
    rows: ProfileModuleRow[],
    userId: number,
    capabilities: ProfileSchemaCapabilities,
  ): Promise<ProfileModulePayload[]> {
    const modules: ProfileModulePayload[] = [];

    for (const row of rows) {
      const module = await this.profileModulePayload(row, userId, capabilities);

      if (module !== null) {
        modules.push(module);
      }
    }

    return modules;
  }

  private async profileModulePayload(
    row: ProfileModuleRow,
    userId: number,
    capabilities: ProfileSchemaCapabilities,
  ): Promise<ProfileModulePayload | null> {
    const type = stringValue(row.type);

    if (!profileModuleTypes.has(type)) {
      return null;
    }

    const config = await this.profileModuleOutputConfig(type, profileModuleJson(row.config_json), userId, capabilities);
    const payload: ProfileModulePayload = {
      id: numberValue(row.id),
      type,
      title: nullableStringValue(row.title),
      config,
      visibility: stringValue(row.visibility),
      position: numberValue(row.position),
      pinned: profileModuleGridPinned(row.grid_pinned),
      layout: profileModuleLayoutPayload(row),
      status: stringValue(row.status),
      schemaVersion: numberValue(row.schema_version),
      createdAt: nullableStringValue(row.created_at),
      updatedAt: nullableStringValue(row.updated_at),
    };

    if (typeof config.body === "string" && config.body.trim() !== "") {
      payload.textEntities = {
        body: await this.textEntities("profile_module", numberValue(row.id), "body", capabilities),
      };
    }

    return payload;
  }

  private async profileModuleOutputConfig(
    type: string,
    config: Record<string, unknown>,
    userId: number,
    capabilities: ProfileSchemaCapabilities,
  ): Promise<Record<string, unknown>> {
    if (type === "links" || type === "connections") {
      return {
        links: await this.profileModuleLinksWithConnectedIntegrations(config, userId, capabilities),
      };
    }

    if (
      type === "creator_live" ||
      type === "music" ||
      type === "github_repo" ||
      profileModuleVideoTypes.has(type) ||
      profileModuleMusicSpecificTypes.has(type)
    ) {
      const integration = await this.profileIntegrationCardForModule(config, capabilities);

      if (integration !== null) {
        return {
          ...config,
          integration,
        };
      }
    }

    if (type === "featured_badges") {
      return {
        userBadgeIds: await this.profileModuleVisibleUserBadgeIds(userId, config.userBadgeIds, capabilities),
      };
    }

    return config;
  }

  private async profileModuleLinksWithConnectedIntegrations(
    config: Record<string, unknown>,
    userId: number,
    capabilities: ProfileSchemaCapabilities,
  ): Promise<unknown[]> {
    const links = Array.isArray(config.links) ? [...config.links] : [];
    const seen = new Set<string>();

    for (const link of links) {
      if (isRecord(link) && typeof link.url === "string") {
        seen.add(`${String(link.platform ?? "website").toLowerCase()}:${link.url.toLowerCase()}`);
      }
    }

    for (const link of await this.profileModuleConnectedIntegrationLinks(userId, capabilities)) {
      const key = `${link.platform.toLowerCase()}:${link.url.toLowerCase()}`;

      if (seen.has(key)) {
        continue;
      }

      seen.add(key);
      links.push(link);
    }

    return links;
  }

  private async profileModuleConnectedIntegrationLinks(
    userId: number,
    capabilities: ProfileSchemaCapabilities,
  ): Promise<{ label: string; platform: string; url: string }[]> {
    if (!capabilities.hasProfileIntegrationAccounts) {
      return [];
    }

    const [rows] = await this.pool.execute<ProfileIntegrationAccountRow[]>(
      `SELECT provider, provider_account_id, provider_handle, display_name, revoked_at
       FROM profile_integration_accounts
       WHERE user_id = ?
       ORDER BY provider ASC`,
      [userId],
    );

    return rows.flatMap((row) => {
      if (row.revoked_at !== null) {
        return [];
      }

      const link = profileModuleLinkForIntegrationAccount(row);

      return link === null ? [] : [link];
    });
  }

  private async profileModuleVisibleUserBadgeIds(
    userId: number,
    values: unknown,
    capabilities: ProfileSchemaCapabilities,
  ): Promise<number[]> {
    if (!Array.isArray(values)) {
      return [];
    }

    const ids = new Set<number>();

    for (const value of values) {
      const id =
        typeof value === "number" || typeof value === "string" || typeof value === "bigint"
          ? nullableNumberValue(value)
          : null;

      if (id !== null && id > 0) {
        ids.add(id);
      }
    }

    if (ids.size === 0) {
      return [];
    }

    if (!capabilities.hasBadges || !capabilities.hasUserBadges) {
      throw new Error("Badge storage is not ready.");
    }

    const orderedIds = [...ids];
    const placeholders = orderedIds.map(() => "?").join(", ");
    const [rows] = await this.pool.execute<(RowDataPacket & { id: number | string })[]>(
      `SELECT ub.id
       FROM user_badges ub
       INNER JOIN badges b ON b.id = ub.badge_id
       WHERE ub.user_id = ?
         AND ub.is_visible = 1
         AND b.is_active = 1
         AND ub.id IN (${placeholders})`,
      [userId, ...orderedIds],
    );
    const available = new Set(rows.map((row) => numberValue(row.id)));

    return orderedIds.filter((id) => available.has(id));
  }

  private async profileIntegrationCardForModule(
    config: Record<string, unknown>,
    capabilities: ProfileSchemaCapabilities,
  ): Promise<Record<string, unknown> | null> {
    if (!capabilities.hasProfileIntegrationMetadataCache || typeof config.url !== "string" || config.url.trim() === "") {
      return null;
    }

    const normalized = profileIntegrationNormalizeUrl(
      config.url,
      typeof config.platform === "string" ? profileIntegrationProviderFromPlatform(config.platform) : null,
    );

    if (normalized === null) {
      return null;
    }

    const [rows] = await this.pool.execute<ProfileIntegrationCacheRow[]>(
      `SELECT provider, resource_type, resource_id, resource_key, source_url, metadata_json, embed_json,
              api_backed, fetched_at, expires_at, stale_at, error_message
       FROM profile_integration_metadata_cache
       WHERE provider = ?
         AND resource_key = ?
       LIMIT 1`,
      [normalized.provider, normalized.resourceKey],
    );
    const row = rows[0];

    if (row === undefined) {
      return null;
    }

    return profileIntegrationCachePayload(row);
  }

  private async profileModulesShouldHaveDefaultFeed(userId: number): Promise<boolean> {
    const [rows] = await this.pool.execute<(RowDataPacket & { module_count: number | string | null })[]>(
      `SELECT COUNT(*) AS module_count
       FROM profile_modules
       WHERE user_id = ?
         AND status <> 'deleted'
         AND type <> 'profile_info'
         AND type <> 'featured'
         AND type <> 'activity'`,
      [userId],
    );
    const nonDefaultCount = rows[0] === undefined ? 0 : numberValue(rows[0].module_count);

    if (nonDefaultCount !== 0) {
      return false;
    }

    const [activityRows] = await this.pool.execute<RowDataPacket[]>(
      `SELECT id
       FROM profile_modules
       WHERE user_id = ?
         AND type = 'activity'
       LIMIT 1`,
      [userId],
    );

    return activityRows[0] === undefined;
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
    contentType: "post" | "profile" | "profile_module",
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

export function profileBadgesPayloadFromRows(rows: UserBadgeRow[]): ProfileBadgesPayload {
  const badges = rows.map((row) => userBadgePayloadFromRow(row));
  let featuredBadges = badges.filter((badge) => badge.featuredOrder !== null && badge.isVisible);

  if (featuredBadges.length === 0) {
    featuredBadges = badges.filter((badge) => badge.isVisible).slice(0, maxFeaturedBadges);
  }

  return {
    badges,
    featuredBadges: featuredBadges.slice(0, maxFeaturedBadges),
  };
}

export function userBadgePayloadFromRow(row: UserBadgeRow): UserBadgePayload {
  const payload: UserBadgePayload = {
    id: numberValue(row.user_badge_id),
    badge: badgePayloadFromRow(row),
    reason: nullableStringValue(row.user_badge_reason),
    earnedAt: nullableStringValue(row.user_badge_earned_at),
    featuredOrder: nullableNumberValue(row.user_badge_featured_order),
    isVisible: booleanValue(row.user_badge_is_visible),
    grantedBy: compactUserPayload(
      row.grantor_user_id,
      row.grantor_handle,
      row.grantor_display_name,
      row.grantor_avatar_url,
    ),
  };

  const user = compactUserPayload(row.user_id, row.handle, row.display_name, row.avatar_url);

  if (user !== null) {
    payload.user = user;
  }

  return payload;
}

export function badgePayloadFromRow(row: UserBadgeRow): BadgePayload {
  return {
    id: numberValue(row.badge_id),
    badgeKey: stringValue(row.badge_key),
    name: stringValue(row.badge_name),
    description: nullableStringValue(row.badge_description),
    rarity: badgeRarity(row.badge_rarity),
    source: stringValue(row.badge_source),
    icon: nullableStringValue(row.badge_icon),
    accent: nullableStringValue(row.badge_accent),
    isActive: booleanValue(row.badge_is_active),
    createdAt: nullableStringValue(row.badge_created_at),
  };
}

export function followUserCardPayloadFromRow(row: FollowUserRow): FollowUserCardPayload {
  const handle = stringValue(row.handle);
  const displayName = stringValue(row.display_name, handle);
  const isFollowing = booleanValue(row.is_following);
  const isFollowedBy = booleanValue(row.is_followed_by);

  return {
    handle,
    displayName,
    initials: initialsFromName(displayName),
    avatarUrl: nullableStringValue(row.avatar_url),
    bioSnippet: followBioSnippet(row.bio),
    isFollowing,
    isMoot: isFollowing && isFollowedBy,
  };
}

export function profileModuleLayoutPayload(row: ProfileModuleRow): ProfileModuleLayoutPayload | null {
  const type = stringValue(row.type);
  let column = profileModuleSavedGridValue(row.grid_column);
  let rowNumber = profileModuleSavedGridValue(row.grid_row);
  let colSpan = profileModuleSavedGridValue(row.grid_col_span);
  let rowSpan = profileModuleSavedGridValue(row.grid_row_span);

  if (column === null || rowNumber === null || colSpan === null || rowSpan === null) {
    return null;
  }

  [colSpan, rowSpan] = profileCanvasNormalizeSpan(type, colSpan, rowSpan);

  if (!profileCanvasSpanAllowed(type, colSpan, rowSpan)) {
    return null;
  }

  column = Math.max(1, Math.min(12 - colSpan + 1, column));
  rowNumber = Math.max(1, Math.min(16 - rowSpan + 1, rowNumber));

  return {
    column,
    row: rowNumber,
    colSpan,
    rowSpan,
  };
}

function profileModulesPayloadContainsType(modules: ProfileModulePayload[], type: string): boolean {
  return modules.some((module) => module.type === type);
}

function profileModulesPayloadIsBlankProfile(modules: ProfileModulePayload[]): boolean {
  return modules.every((module) => module.type === "profile_info");
}

function profileInfoModulePayload(position: number): ProfileModulePayload {
  return {
    id: 0,
    type: "profile_info",
    title: "Profile info",
    config: {},
    visibility: "public",
    position,
    pinned: true,
    layout: {
      column: 3,
      row: 1,
      colSpan: 8,
      rowSpan: 3,
    },
    status: "active",
    schemaVersion: 1,
    createdAt: null,
    updatedAt: null,
  };
}

function profileActivityModulePayload(position: number): ProfileModulePayload {
  return {
    id: 0,
    type: "activity",
    title: "Feed",
    config: {},
    visibility: "public",
    position,
    pinned: false,
    layout: {
      column: 5,
      row: 4,
      colSpan: 4,
      rowSpan: 6,
    },
    status: "active",
    schemaVersion: 1,
    createdAt: null,
    updatedAt: null,
  };
}

function profileModulesSortPayload(modules: ProfileModulePayload[]): ProfileModulePayload[] {
  return [...modules].sort((first, second) => {
    const positionCompare = first.position - second.position;

    if (positionCompare !== 0) {
      return positionCompare;
    }

    const typeCompare = profileModuleDefaultSortOrder(first.type) - profileModuleDefaultSortOrder(second.type);

    if (typeCompare !== 0) {
      return typeCompare;
    }

    return first.id - second.id;
  });
}

function profileModuleDefaultSortOrder(type: string): number {
  if (type === "profile_info") {
    return -1;
  }

  if (type === "featured_post") {
    return 0;
  }

  if (type === "featured_room") {
    return 1;
  }

  return type === "activity" ? 3 : 2;
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
          AND rooms.visibility IN ('public', 'view_only')
          ${roomNotDeletedSql("rooms", capabilities)}
          AND ${profileFeaturedRoomEligibilitySql(profileUserId, "rooms", capabilities)}
        LIMIT 1`;
}

export function postSelectSql(
  whereClause: string,
  orderClause: string,
  extraSelect: string,
  capabilities: ProfileSchemaCapabilities,
  viewerUserId: number | null = null,
  extraJoins = "",
  visibilitySqlOverride: string | null = null,
): string {
  const viewerSql = viewerUserId === null ? "NULL" : String(viewerUserId);
  const followSelect = capabilities.hasUserFollows
    ? `IF(viewer_follows_author.following_id IS NULL, 0, 1) AS current_user_follows_author,
        IF(author_follows_viewer.follower_id IS NULL, 0, 1) AS author_follows_current_user,
        COALESCE(followed_likes.followed_like_count, 0) AS followed_like_count,`
    : `0 AS current_user_follows_author,
        0 AS author_follows_current_user,
        0 AS followed_like_count,`;
  const followJoins = capabilities.hasUserFollows
    ? `LEFT JOIN user_follows viewer_follows_author
        ON viewer_follows_author.follower_id = ${viewerSql}
       AND viewer_follows_author.following_id = u.id
    LEFT JOIN user_follows author_follows_viewer
        ON author_follows_viewer.follower_id = u.id
       AND author_follows_viewer.following_id = ${viewerSql}
    LEFT JOIN (
        SELECT reactions.post_id, COUNT(*) AS followed_like_count
        FROM post_reactions reactions
        INNER JOIN user_follows followed_reactors
            ON followed_reactors.following_id = reactions.user_id
           AND followed_reactors.follower_id = ${viewerSql}
        WHERE reactions.type = 'glow'
        GROUP BY reactions.post_id
    ) followed_likes ON followed_likes.post_id = p.id`
    : "";
  const reblogSelect = capabilities.hasPostReblogs
    ? `COALESCE(reblogs.reblog_count, 0) AS reblog_count,
        current_reblog.user_id AS current_reblog_user_id,`
    : `0 AS reblog_count,
        NULL AS current_reblog_user_id,`;
  const reblogJoins = capabilities.hasPostReblogs
    ? `LEFT JOIN (
        SELECT post_id, COUNT(*) AS reblog_count
        FROM post_reblogs
        GROUP BY post_id
    ) reblogs ON reblogs.post_id = p.id
    LEFT JOIN post_reblogs current_reblog
        ON current_reblog.post_id = p.id
       AND current_reblog.user_id = ${viewerSql}`
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
        0 AS current_viewer_signed_in,
        0 AS current_viewer_is_admin,
        NULL AS current_room_access_request_status,
        owner.id AS owner_user_id,
        owner.handle AS owner_handle,
        owner_profile.display_name AS owner_display_name,
        owner_profile.avatar_url AS owner_avatar_url,
        NULL AS room_pending_access_request_count,
        COALESCE(room_posts.post_count, 0) AS room_post_count,
        room_posts.latest_activity_at AS room_latest_activity_at,
        r.created_at AS room_created_at,
        r.updated_at AS room_updated_at,
        COALESCE(reactions.glow_count, 0) AS reaction_glow_count,
        COALESCE(reactions.echo_count, 0) AS reaction_echo_count,
        COALESCE(reactions.hush_count, 0) AS reaction_hush_count,
        COALESCE(replies.reply_count, 0) AS reply_count,
        current_like.user_id AS current_like_user_id,
        ${viewerSql} AS current_viewer_user_id,
        ${followSelect}
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
            OR (profile_post_rooms.visibility IN ('public', 'view_only') ${roomNotDeletedSql("profile_post_rooms", capabilities)})
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
        WHERE visibility IN ('public', 'view_only')
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
    LEFT JOIN post_reactions current_like
        ON current_like.post_id = p.id
       AND current_like.user_id = ${viewerSql}
       AND current_like.type = 'glow'
    ${followJoins}
    ${reblogJoins}
    ${extraJoins}
    WHERE ${visibilitySqlOverride ?? publicPostVisibleSql("p", "r", capabilities)}
      AND ${userPubliclyAvailableSql("u", capabilities)}
      AND ${postAncestorVisibilitySql("p", capabilities)}
      ${profileAuthorVisibilitySql("u", "pr", capabilities, viewerUserId)}
      ${whereClause}
    ORDER BY ${orderClause}
    LIMIT 50`;
}

export function postPayloadFromRow(
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
            0 AS current_viewer_signed_in,
            0 AS current_viewer_is_admin,
            NULL AS current_room_access_request_status,
            owner.id AS owner_user_id,
            owner.handle AS owner_handle,
            owner_profile.display_name AS owner_display_name,
            owner_profile.avatar_url AS owner_avatar_url,
            NULL AS room_pending_access_request_count,
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

function userBadgeSelectSql(): string {
  return `SELECT
        ub.id AS user_badge_id,
        ub.user_id AS user_badge_user_id,
        ub.badge_id AS user_badge_badge_id,
        ub.reason AS user_badge_reason,
        ub.earned_at AS user_badge_earned_at,
        ub.featured_order AS user_badge_featured_order,
        ub.is_visible AS user_badge_is_visible,
        b.id AS badge_id,
        b.badge_key AS badge_key,
        b.name AS badge_name,
        b.description AS badge_description,
        b.rarity AS badge_rarity,
        b.source AS badge_source,
        b.icon AS badge_icon,
        b.accent AS badge_accent,
        b.is_active AS badge_is_active,
        b.created_at AS badge_created_at,
        target_user.id AS user_id,
        target_user.handle AS handle,
        target_profile.display_name AS display_name,
        target_profile.avatar_url AS avatar_url,
        grantor.id AS grantor_user_id,
        grantor.handle AS grantor_handle,
        grantor_profile.display_name AS grantor_display_name,
        grantor_profile.avatar_url AS grantor_avatar_url
      FROM user_badges ub
      INNER JOIN badges b ON b.id = ub.badge_id
      INNER JOIN users target_user ON target_user.id = ub.user_id
      INNER JOIN profiles target_profile ON target_profile.user_id = target_user.id
      LEFT JOIN users grantor ON grantor.id = ub.granted_by
      LEFT JOIN profiles grantor_profile ON grantor_profile.user_id = grantor.id`;
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

function compactUserPayload(
  id: number | string | null | undefined,
  handleValue: string | null | undefined,
  displayNameValue: string | null | undefined,
  avatarUrlValue: string | null | undefined,
): UserPayload | null {
  if (id === null || id === undefined || handleValue === null || handleValue === undefined) {
    return null;
  }

  const handle = stringValue(handleValue);
  const displayName = stringValue(displayNameValue, handle);

  return {
    id: numberValue(id),
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

export function publicPostVisibleSql(
  postAlias: string,
  roomAlias: string,
  capabilities: ProfileSchemaCapabilities,
): string {
  validateSchemaIdentifier(postAlias);
  validateSchemaIdentifier(roomAlias);

  return `${postAlias}.visibility = 'public'
        AND ${postAlias}.status = 'published'
        AND ${postAlias}.deleted_at IS NULL
        AND (
            ${postAlias}.room_id IS NULL
            OR (${roomAlias}.visibility IN ('public', 'view_only') ${roomNotDeletedSql(roomAlias, capabilities)})
        )`;
}

export function postAncestorVisibilityJoinsSql(postAlias: string): string {
  validateSchemaIdentifier(postAlias);

  return `LEFT JOIN posts parent_post ON parent_post.id = ${postAlias}.parent_id
    LEFT JOIN rooms parent_post_room ON parent_post_room.id = parent_post.room_id
    LEFT JOIN posts grandparent_post ON grandparent_post.id = parent_post.parent_id
    LEFT JOIN rooms grandparent_post_room ON grandparent_post_room.id = grandparent_post.room_id
    LEFT JOIN posts great_grandparent_post ON great_grandparent_post.id = grandparent_post.parent_id
    LEFT JOIN rooms great_grandparent_post_room ON great_grandparent_post_room.id = great_grandparent_post.room_id`;
}

export function postAncestorVisibilitySql(postAlias: string, capabilities: ProfileSchemaCapabilities): string {
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
  viewerUserId: number | null = null,
): string {
  validateSchemaIdentifier(userAlias);
  validateSchemaIdentifier(profileAlias);

  if (!capabilities.hasProfileVisibilityColumn) {
    return "";
  }

  if (!capabilities.hasUserFollows) {
    return `AND ${profileAlias}.visibility = 'public'`;
  }

  const viewerSql = viewerUserId === null ? "NULL" : String(viewerUserId);

  return `AND (
        ${profileAlias}.visibility = 'public'
        OR ${userAlias}.id = ${viewerSql}
        OR EXISTS (
            SELECT 1
            FROM user_follows private_profile_follows
            WHERE private_profile_follows.follower_id = ${viewerSql}
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

function badgeRarity(value: string | null | undefined): string {
  return value === "common" || value === "rare" || value === "epic" || value === "legendary" || value === "founder"
    ? value
    : "common";
}

function followBioSnippet(value: string | null | undefined): string {
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

function profileModuleJson(value: string | null | undefined): Record<string, unknown> {
  const decoded = jsonArrayOrObject(value);

  return decoded !== null && !Array.isArray(decoded) ? decoded : {};
}

function profileModuleGridPinned(value: boolean | number | string | null | undefined): boolean {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return value === 1;
  }

  return value === "1";
}

function profileModuleSavedGridValue(value: boolean | number | string | null | undefined): number | null {
  if (typeof value === "number" && Number.isInteger(value)) {
    return value;
  }

  if (typeof value === "string" && /^[0-9]+$/.test(value)) {
    return Number(value);
  }

  return null;
}

function profileCanvasNormalizeSpan(type: string, colSpan: number, rowSpan: number): [number, number] {
  if (type === "creator_live" && colSpan === 3 && rowSpan === 5) {
    return [5, 3];
  }

  return [
    Math.max(1, Math.min(profileCanvasMaxAllowedSizeAxis(type, 0, 6), colSpan)),
    Math.max(1, Math.min(profileCanvasMaxAllowedSizeAxis(type, 1, 6), rowSpan)),
  ];
}

function profileCanvasSpanAllowed(type: string, colSpan: number, rowSpan: number): boolean {
  return profileCanvasAllowedSizes(type).includes(`${colSpan}x${rowSpan}`);
}

function profileCanvasMaxAllowedSizeAxis(type: string, axis: 0 | 1, fallback: number): number {
  let max = fallback;

  for (const size of profileCanvasAllowedSizes(type)) {
    const match = /^([1-8])x(10|[1-9])$/.exec(size);

    if (match === null) {
      continue;
    }

    max = Math.max(max, Number(match[axis + 1]));
  }

  return axis === 0 ? Math.min(8, max) : Math.min(10, max);
}

function profileCanvasAllowedSizes(type: string): string[] {
  const wideSlimOneRowSizes = ["5x1", "6x1", "8x1"];
  const wideSlimTwoRowSizes = ["5x2", "6x2", "8x2"];
  const wideSlimSizes = profileCanvasUniqueSizes(wideSlimOneRowSizes, wideSlimTwoRowSizes);
  const uploadedImageSizes = profileCanvasUniqueSizes(profileCanvasSizeRange(1, 6, 1, 6), wideSlimTwoRowSizes);
  const gallerySlideshowSizes = profileCanvasUniqueSizes(profileCanvasSizeRange(2, 6, 2, 6), wideSlimTwoRowSizes);
  const textSizes = profileCanvasUniqueSizes(profileCanvasSizeRange(3, 4, 2, 5), wideSlimSizes);
  const connectionSizes = profileCanvasUniqueSizes(["2x2", "2x3", "3x2", "4x2", "3x3", "3x4"], wideSlimSizes);
  const badgeSizes = profileCanvasUniqueSizes(["2x2", "3x2"], wideSlimSizes);
  const providerCardSizes = profileCanvasUniqueSizes(["3x2", "4x3", "6x4"], wideSlimTwoRowSizes);
  const videoCardSizes = profileCanvasUniqueSizes(["4x3", "6x4"], wideSlimTwoRowSizes);
  const musicSongSizes = profileCanvasUniqueSizes(["2x1", "2x2", "3x2", "4x2", "4x3", "4x4"], wideSlimSizes);
  const playlistSizes = profileCanvasUniqueSizes(["3x2", "4x3", "3x6", "4x6"], wideSlimTwoRowSizes);
  const activitySizes = profileCanvasUniqueSizes(["3x4", "4x6", "6x10"], ["5x2", "6x2", "8x2", "8x3"]);

  switch (type) {
    case "profile_info":
      return ["3x2", "3x3", "4x3", "6x3", "8x3", "8x4"];
    case "about":
    case "custom_text":
    case "text":
      return textSizes;
    case "links":
    case "connections":
      return connectionSizes;
    case "featured_badges":
    case "badge_display":
      return badgeSizes;
    case "featured_post":
      return ["3x4", "4x5"];
    case "featured_room":
      return ["3x1", "4x2"];
    case "gallery_media":
    case "gallery_slideshow":
      return gallerySlideshowSizes;
    case "uploaded_image":
      return uploadedImageSizes;
    case "gallery_feed":
      return profileCanvasUniqueSizes(["3x6", "4x6"], wideSlimTwoRowSizes);
    case "creator_live":
      return profileCanvasUniqueSizes(["2x1", "3x2", "4x3", "5x3", "6x4"], wideSlimTwoRowSizes);
    case "twitch_channel":
      return profileCanvasUniqueSizes(["2x1", "3x2", "4x3", "5x3", "6x4", "8x6"], wideSlimTwoRowSizes);
    case "youtube_video":
      return profileCanvasUniqueSizes(["3x4"], videoCardSizes);
    case "youtube_stream":
      return profileCanvasUniqueSizes(["4x3", "5x3", "6x4"], wideSlimTwoRowSizes);
    case "youtube_playlist":
      return profileCanvasUniqueSizes(["4x3", "5x3", "2x4", "3x6"], wideSlimTwoRowSizes);
    case "uploaded_video":
      return profileCanvasUniqueSizes(["4x3", "6x4", "4x6"], wideSlimTwoRowSizes);
    case "music":
    case "spotify_song":
    case "apple_music_song":
    case "youtube_music_song":
      return musicSongSizes;
    case "spotify_playlist":
    case "apple_music_playlist":
    case "youtube_music_playlist":
      return playlistSizes;
    case "spotify_artist":
    case "apple_music_artist":
    case "youtube_music_artist":
    case "github_repo":
      return providerCardSizes;
    case "activity":
      return activitySizes;
    default:
      return ["1x1"];
  }
}

function profileCanvasUniqueSizes(...groups: string[][]): string[] {
  return [...new Set(groups.flat())];
}

function profileCanvasSizeRange(minColumns: number, maxColumns: number, minRows: number, maxRows: number): string[] {
  const sizes: string[] = [];

  for (let column = minColumns; column <= maxColumns; column += 1) {
    for (let row = minRows; row <= maxRows; row += 1) {
      sizes.push(`${column}x${row}`);
    }
  }

  return sizes;
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

function profileModuleLinkForIntegrationAccount(
  account: ProfileIntegrationAccountRow,
): { label: string; platform: string; url: string } | null {
  const provider = stringValue(account.provider);
  const handle = profileModuleIntegrationAccountHandle(account);
  const accountId = stringValue(account.provider_account_id).trim();
  const platform = profileIntegrationProviderToPlatform(provider);

  if (platform === null) {
    return null;
  }

  const url = (() => {
    if (provider === "github") {
      return handle === null ? null : `https://github.com/${encodeURIComponent(handle.replace(/^@/, ""))}`;
    }

    if (provider === "spotify") {
      return accountId === "" ? null : `https://open.spotify.com/user/${encodeURIComponent(accountId)}`;
    }

    if (provider === "twitch") {
      return handle === null ? null : `https://www.twitch.tv/${encodeURIComponent(handle.replace(/^@/, ""))}`;
    }

    if (provider === "youtube") {
      if (handle !== null && /^@[A-Za-z0-9_.-]+$/.test(handle)) {
        return `https://www.youtube.com/${handle}`;
      }

      return accountId === "" ? null : `https://www.youtube.com/channel/${encodeURIComponent(accountId)}`;
    }

    return null;
  })();

  if (url === null) {
    return null;
  }

  return {
    label: profileModuleIntegrationLinkLabel(account.display_name ?? handle, profileIntegrationProviderLabel(provider)),
    platform,
    url,
  };
}

function profileModuleIntegrationAccountHandle(account: ProfileIntegrationAccountRow): string | null {
  for (const value of [account.provider_handle, account.display_name, account.provider_account_id]) {
    if (typeof value === "string" && value.trim() !== "") {
      return value.trim();
    }
  }

  return null;
}

function profileModuleIntegrationLinkLabel(value: string | null, fallback: string): string {
  if (typeof value !== "string") {
    return fallback;
  }

  const label = value.replace(/\s+/g, " ").trim();

  return label === "" || label.length > 60 ? fallback : label;
}

function profileIntegrationProviderToPlatform(provider: string): string | null {
  if (provider === "github" || provider === "spotify" || provider === "twitch" || provider === "youtube") {
    return provider;
  }

  return null;
}

function profileIntegrationProviderFromPlatform(platform: string): string | null {
  switch (platform) {
    case "spotify":
      return "spotify";
    case "apple_music":
      return "apple_music";
    case "youtube":
    case "youtube_music":
      return "youtube";
    case "twitch":
      return "twitch";
    case "github":
      return "github";
    default:
      return null;
  }
}

function profileIntegrationProviderLabel(provider: string): string {
  switch (provider) {
    case "spotify":
      return "Spotify";
    case "apple_music":
      return "Apple Music";
    case "youtube":
      return "YouTube";
    case "twitch":
      return "Twitch";
    case "github":
      return "GitHub";
    default:
      return "Integration";
  }
}

export function profileIntegrationCachePayload(row: ProfileIntegrationCacheRow): Record<string, unknown> {
  const embed = jsonRecord(row.embed_json);

  return {
    provider: stringValue(row.provider),
    resourceType: stringValue(row.resource_type),
    resourceId: stringValue(row.resource_id),
    resourceKey: stringValue(row.resource_key),
    sourceUrl: stringValue(row.source_url),
    metadata: jsonRecord(row.metadata_json),
    embed: embed === null || Object.keys(embed).length === 0 ? null : embed,
    apiBacked: booleanValue(row.api_backed),
    fetchedAt: nullableStringValue(row.fetched_at),
    expiresAt: nullableStringValue(row.expires_at),
    staleAt: nullableStringValue(row.stale_at),
    stale: false,
    lastError: nullableStringValue(row.error_message),
  };
}

export function profileIntegrationNormalizeUrl(
  rawUrl: string,
  preferredProvider: string | null,
): { provider: string; resourceType: string; resourceId: string; resourceKey: string; sourceUrl: string } | null {
  let url: URL;

  try {
    url = new URL(rawUrl.trim());
  } catch {
    return null;
  }

  if (url.protocol !== "https:") {
    return null;
  }

  const host = url.hostname.toLowerCase();
  const segments = url.pathname
    .split("/")
    .map((segment) => segment.trim())
    .filter((segment) => segment !== "");
  const provider = preferredProvider ?? profileIntegrationProviderFromHost(host);

  if (provider === null) {
    return null;
  }

  let resourceType = "link";
  let resourceId = "";
  let sourceUrl = url.toString();

  if (provider === "spotify" && host === "open.spotify.com" && segments.length >= 2) {
    resourceType = segments[0]?.toLowerCase() ?? "";
    resourceId = segments[1]?.replace(/[^A-Za-z0-9]/g, "") ?? "";
    sourceUrl = `https://open.spotify.com/${resourceType}/${resourceId}`;
  } else if (provider === "apple_music" && ["music.apple.com", "itunes.apple.com"].includes(host) && segments.length >= 2) {
    resourceType = url.pathname.includes("/artist/")
      ? "artist"
      : url.pathname.includes("/playlist/")
        ? "playlist"
        : url.pathname.includes("/album/")
          ? "album"
          : "song";
    resourceId = profileIntegrationLastIdentifier(url);
  } else if (
    provider === "youtube" &&
    ["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be", "music.youtube.com"].includes(host)
  ) {
    const firstSegment = segments[0] ?? "";
    const playlistId = profileIntegrationYoutubeIdentifier(url.searchParams.get("list") ?? "");
    let videoId = "";

    if (host === "youtu.be" && segments[0] !== undefined) {
      videoId = profileIntegrationYoutubeIdentifier(segments[0]);
    } else if (firstSegment === "watch") {
      videoId = profileIntegrationYoutubeIdentifier(url.searchParams.get("v") ?? "");
    } else if (["shorts", "live", "embed"].includes(firstSegment) && segments[1] !== undefined) {
      videoId = profileIntegrationYoutubeIdentifier(segments[1]);
    }

    if (videoId !== "") {
      resourceType = "video";
      resourceId = videoId;
      sourceUrl = `https://www.youtube.com/watch?v=${encodeURIComponent(resourceId)}`;
    } else if (playlistId !== "") {
      resourceType = "playlist";
      resourceId = playlistId;
      sourceUrl = `https://www.youtube.com/playlist?list=${encodeURIComponent(resourceId)}`;
    } else if (firstSegment.startsWith("@")) {
      resourceType = "channel";
      resourceId = profileIntegrationYoutubeIdentifier(firstSegment, true);
      sourceUrl = `https://www.youtube.com/${resourceId}`;
    } else if (firstSegment === "channel" && segments[1] !== undefined) {
      resourceType = "channel";
      resourceId = profileIntegrationYoutubeIdentifier(segments[1]);
      sourceUrl = `https://www.youtube.com/channel/${encodeURIComponent(resourceId)}`;
    }
  } else if (provider === "twitch" && ["twitch.tv", "www.twitch.tv"].includes(host) && segments[0] !== undefined) {
    resourceType = segments[0] === "videos" && segments[1] !== undefined ? "video" : "channel";
    resourceId = resourceType === "video" ? (segments[1] ?? "") : segments[0];
  } else if (provider === "github" && ["github.com", "www.github.com"].includes(host) && segments.length >= 2) {
    resourceType = "repo";
    resourceId = `${segments[0]}/${segments[1]}`.toLowerCase();
    sourceUrl = `https://github.com/${resourceId}`;
  }

  resourceId = resourceId.trim();

  if (resourceId === "") {
    return null;
  }

  return {
    provider,
    resourceType,
    resourceId,
    resourceKey: `${provider}:${resourceType}:${resourceId}`,
    sourceUrl,
  };
}

function profileIntegrationProviderFromHost(host: string): string | null {
  if (host === "open.spotify.com") {
    return "spotify";
  }

  if (host === "music.apple.com" || host === "itunes.apple.com") {
    return "apple_music";
  }

  if (["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be", "music.youtube.com"].includes(host)) {
    return "youtube";
  }

  if (host === "twitch.tv" || host === "www.twitch.tv") {
    return "twitch";
  }

  if (host === "github.com" || host === "www.github.com") {
    return "github";
  }

  return null;
}

function profileIntegrationYoutubeIdentifier(value: string, allowHandle = false): string {
  const trimmed = value.trim();

  if (allowHandle && trimmed.startsWith("@")) {
    const handle = trimmed.slice(1).replace(/[^A-Za-z0-9._-]/g, "");

    return handle === "" ? "" : `@${handle}`;
  }

  return trimmed.replace(/[^A-Za-z0-9_-]/g, "");
}

function profileIntegrationLastIdentifier(url: URL): string {
  const queryId = url.searchParams.get("i");

  if (queryId !== null && queryId !== "") {
    return queryId.replace(/[^A-Za-z0-9._-]/g, "");
  }

  const segments = url.pathname
    .split("/")
    .map((segment) => segment.trim())
    .filter((segment) => segment !== "");

  return (segments.at(-1) ?? "").replace(/[^A-Za-z0-9._-]/g, "");
}

function jsonRecord(value: string | null | undefined): Record<string, unknown> {
  const decoded = jsonArrayOrObject(value);

  return decoded !== null && !Array.isArray(decoded) ? decoded : {};
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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
