import type { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";

import {
  hashPhpPassword,
  validateAuthEmail,
  validateAuthHandle,
  validateAuthPassword,
  verifyPhpPassword,
} from "./auth.js";
import {
  buildProfileByHandleQuery,
  profileBadgesPayloadFromRows,
  profileModuleLayoutPayload,
  profilePayloadWithFeatured,
  type ProfileBadgesPayload,
  type ProfileModulePayload,
  type ProfileModuleRow,
  type ProfilePayload,
  type ProfileRow,
  type ProfileSchemaCapabilities,
  type ProfileSocialContext,
  type UserBadgeRow,
} from "./profiles.js";
import type { SettingsPayload } from "./private.js";
import type { RequestSession } from "./sessions.js";

const accountHandleCooldownSeconds = 2_592_000;
const accountDeletionGraceSeconds = 2_592_000;
const profileModuleSchemaVersion = 1;
const profileCanvasVersion = 2;
const profileModuleMaxPerProfile = 24;
const maxFeaturedBadges = 4;

const profileLayoutPresets = new Set(["balanced", "compact", "showcase"]);
const profileBackgroundBlurs = new Set(["none", "soft", "medium", "heavy"]);
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
const singletonModuleTypes = new Set(["profile_info", "featured_post", "featured_room", "activity"]);
const protectedModuleTypes = new Set(["profile_info"]);
const moduleVisibilities = new Set(["public", "hidden", "draft"]);
const moduleStatuses = new Set(["active", "hidden", "deleted"]);

export class EditorRouteError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
  ) {
    super(message);
    this.name = "EditorRouteError";
  }
}

export class EditorStorageNotReadyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EditorStorageNotReadyError";
  }
}

export interface EditorRepository {
  updateProfile(session: RequestSession, body: Record<string, unknown>): Promise<ProfilePayload>;
  updateFeaturedProfile(session: RequestSession, body: Record<string, unknown>): Promise<ProfilePayload>;
  listOwnerModules(userId: number, includeDeleted: boolean): Promise<ProfileModulePayload[]>;
  createModule(session: RequestSession, body: Record<string, unknown>): Promise<ProfileModulePayload[]>;
  updateModule(session: RequestSession, moduleId: number, body: Record<string, unknown>): Promise<ProfileModulePayload[]>;
  deleteModule(session: RequestSession, moduleId: number): Promise<ProfileModulePayload[]>;
  restoreModule(session: RequestSession, moduleId: number): Promise<ProfileModulePayload[]>;
  updateModuleOrder(session: RequestSession, body: Record<string, unknown>): Promise<ProfileModulePayload[]>;
  updateCanvas(session: RequestSession, body: Record<string, unknown>): Promise<ProfileCanvasUpdatePayload>;
  getCanvasDraft(userId: number): Promise<ProfileCanvasDraftState>;
  updateCanvasDraft(session: RequestSession, body: Record<string, unknown>): Promise<ProfileCanvasDraftState>;
  deleteCanvasDraft(session: RequestSession): Promise<ProfileCanvasDraftState>;
  commitCanvasDraft(session: RequestSession): Promise<ProfileCanvasUpdatePayload>;
  updateFeaturedBadges(session: RequestSession, body: Record<string, unknown>): Promise<ProfileBadgesPayload>;
  deleteMyPosts(userId: number, kind: string): Promise<MyPostsDeletePayload>;
  updateAccountEmail(session: RequestSession, body: Record<string, unknown>): Promise<SettingsPayload>;
  updateAccountHandle(session: RequestSession, body: Record<string, unknown>): Promise<SettingsPayload>;
  updateAccountPassword(session: RequestSession, body: Record<string, unknown>): Promise<AccountPasswordPayload>;
  scheduleAccountDeletion(session: RequestSession, body: Record<string, unknown>): Promise<AccountDeletionSchedulePayload>;
  cancelAccountDeletion(session: RequestSession): Promise<SettingsPayload>;
}

export interface ProfileCanvasUpdatePayload {
  backgroundBlur: string;
  canvasGlass: number;
  canvasVersion: number;
  modules: ProfileModulePayload[];
}

export interface ProfileCanvasDraftState {
  backgroundBlur: string;
  canvasGlass: number;
  canvasVersion: number;
  modules: ProfileModulePayload[];
  selectedModuleId: number | string | null;
  updatedAt: string | null;
}

export interface MyPostsDeletePayload {
  deletedCount: number;
  kind: "all" | "posts" | "replies";
}

export interface AccountPasswordPayload {
  changed: true;
}

export interface AccountDeletionSchedulePayload {
  scheduled: true;
  scheduledFor: string;
}

interface CountRow extends RowDataPacket {
  table_count?: number | string | null;
  column_count?: number | string | null;
}

interface PasswordRow extends RowDataPacket {
  password_hash: string | null;
}

interface HandleHistoryRow extends RowDataPacket {
  created_at: string | null;
  user_id?: number | string | null;
}

interface SettingsUserRow extends RowDataPacket {
  user_id: number | string;
  handle: string;
  email: string;
  status: string | null;
  display_name: string | null;
  visibility: string | null;
}

interface PreferencesRow extends RowDataPacket {
  analytics_consent: number | string | boolean | null;
  personalization_consent: number | string | boolean | null;
  rich_embeds_consent: number | string | boolean | null;
  autoplay_media_consent: number | string | boolean | null;
  sensitive_content_visible: number | string | boolean | null;
  notification_preferences_json: string | null;
  email_notification_preferences_json: string | null;
  push_notification_preferences_json: string | null;
}

interface DeletionRow extends RowDataPacket {
  requested_at: string | null;
  scheduled_for: string | null;
  canceled_at: string | null;
  completed_at: string | null;
}

interface TwoFactorStatusRow extends RowDataPacket {
  enabled_at: string | null;
}

interface BackupCodeCountRow extends RowDataPacket {
  code_count: number | string | null;
}

interface IdRow extends RowDataPacket {
  id: number | string;
}

interface ModuleCountRow extends RowDataPacket {
  module_count: number | string | null;
}

interface CanvasPreferencesRow extends RowDataPacket {
  profile_background_blur: string | null;
  profile_canvas_version: number | string | null;
  profile_canvas_glass_opacity: number | string | null;
}

interface CanvasDraftRow extends RowDataPacket {
  draft_json: string | null;
  selected_module_id: string | null;
  updated_at: string | null;
}

interface PostVisibilityRow extends RowDataPacket {
  id: number | string;
  author_id: number | string;
  room_id: number | string | null;
  visibility: string | null;
  status: string | null;
  deleted_at: string | null;
  room_visibility: string | null;
  room_deleted_at: string | null;
}

interface RoomEligibilityRow extends RowDataPacket {
  id: number | string;
  visibility: string | null;
  deleted_at: string | null;
  is_eligible: number | string | boolean | null;
}

interface SchemaCapabilities extends ProfileSchemaCapabilities {
  hasUserPreferences: boolean;
  hasUserHandleHistory: boolean;
  hasAccountDeletionRequests: boolean;
  hasUserTwoFactor: boolean;
  hasBackupCodes: boolean;
  hasProfileCanvasDrafts: boolean;
  hasTextEntities: boolean;
}

export function createEditorRepository(pool: Pool): EditorRepository {
  return new MysqlEditorRepository(pool);
}

class MysqlEditorRepository implements EditorRepository {
  private capabilities?: Promise<SchemaCapabilities>;

  constructor(private readonly pool: Pool) {}

  async updateProfile(session: RequestSession, body: Record<string, unknown>): Promise<ProfilePayload> {
    const capabilities = await this.schemaCapabilities();
    this.requireProfileCustomizationStorage(capabilities);
    const updates: string[] = [];
    const params: Array<string | number | null> = [];
    let bioForTextEntities: string | null | undefined;

    addUpdate(updates, params, "display_name", bodyValue(body, "displayName", "display_name"), (value) =>
      validateVisibleText(value, 1, 120, "Display name"),
    );
    if ("bio" in body) {
      const bio = validateNullableText(body.bio, 1000, "Bio");
      updates.push("bio = ?");
      params.push(bio);
      bioForTextEntities = bio;
    }
    addUpdate(updates, params, "location", body.location, (value) => validateNullableText(value, 120, "Location"));
    addUpdate(updates, params, "avatar_url", bodyValue(body, "avatarUrl", "avatar_url"), (value) =>
      validateProfileImageUrl(value, "Avatar"),
    );
    addUpdate(updates, params, "banner_url", bodyValue(body, "bannerUrl", "banner_url"), (value) =>
      validateProfileImageUrl(value, "Banner"),
    );
    addUpdate(updates, params, "profile_background", bodyValue(body, "profileBackground", "profile_background"), (value) =>
      validateProfileImageUrl(value, "Profile background"),
    );
    addUpdate(
      updates,
      params,
      "profile_background_video_url",
      bodyValue(body, "profileBackgroundVideo", "profile_background_video_url"),
      (value) => validateProfileVideoUrl(value, "Profile background video"),
    );
    addUpdate(
      updates,
      params,
      "profile_background_video_poster_url",
      bodyValue(body, "profileBackgroundVideoPoster", "profile_background_video_poster_url"),
      (value) => validateProfileImageUrl(value, "Profile background video poster"),
    );
    addUpdate(updates, params, "profile_accent", bodyValue(body, "profileAccent", "profile_accent"), (value) =>
      validateNullableToken(value, "Accent"),
    );
    addUpdate(updates, params, "profile_theme", bodyValue(body, "profileTheme", "profile_theme"), (value) =>
      validateNullableToken(value, "Theme"),
    );
    addUpdate(
      updates,
      params,
      "profile_theme_config_json",
      bodyValue(body, "profileThemeConfig", "profile_theme_config_json"),
      validateThemeConfigJson,
    );
    addUpdate(
      updates,
      params,
      "profile_layout_preset",
      bodyValue(body, "profileLayoutPreset", "profile_layout_preset"),
      validateProfileLayoutPreset,
    );
    addUpdate(updates, params, "links", body.links, (value) => JSON.stringify(validateJsonArray(value, 20, "Links")));
    addUpdate(updates, params, "traits", body.traits, (value) =>
      JSON.stringify(validateStringList(value, 8, 40, "Traits")),
    );

    if (updates.length === 0) {
      throw new EditorRouteError("No supported profile updates were provided.", 422);
    }

    await this.pool.execute<ResultSetHeader>(
      `UPDATE profiles
       SET ${updates.join(", ")},
           updated_at = CURRENT_TIMESTAMP()
       WHERE user_id = ?`,
      [...params, session.userId],
    );

    if (bioForTextEntities !== undefined && capabilities.hasTextEntities) {
      await this.storeTextEntities("profile", session.userId, "bio", bioForTextEntities);
    }

    return this.fetchProfilePayload(session.userId);
  }

  async updateFeaturedProfile(session: RequestSession, body: Record<string, unknown>): Promise<ProfilePayload> {
    const capabilities = await this.schemaCapabilities();

    if (!capabilities.hasProfileFeaturedColumns) {
      throw new EditorStorageNotReadyError("Featured profile content storage is not ready. Run pending migrations.");
    }

    rejectUnknownKeys(body, ["featuredPostId", "featured_post_id", "featuredRoomId", "featured_room_id"]);
    const updates: string[] = [];
    const params: Array<number | null> = [];

    if ("featuredPostId" in body || "featured_post_id" in body) {
      updates.push("featured_post_id = ?");
      params.push(await this.featuredPostIdForUser(bodyValue(body, "featuredPostId", "featured_post_id"), session.userId, capabilities));
    }

    if ("featuredRoomId" in body || "featured_room_id" in body) {
      updates.push("featured_room_id = ?");
      params.push(await this.featuredRoomIdForUser(bodyValue(body, "featuredRoomId", "featured_room_id"), session.userId, capabilities));
    }

    if (updates.length === 0) {
      throw new EditorRouteError("No featured content updates were provided.", 422);
    }

    await this.pool.execute<ResultSetHeader>(
      `UPDATE profiles
       SET ${updates.join(", ")},
           updated_at = CURRENT_TIMESTAMP()
       WHERE user_id = ?`,
      [...params, session.userId],
    );

    return this.fetchProfilePayload(session.userId);
  }

  async listOwnerModules(userId: number, includeDeleted: boolean): Promise<ProfileModulePayload[]> {
    const capabilities = await this.schemaCapabilities();
    this.requireProfileModules(capabilities);
    await this.ensureBuiltinModules(userId);

    return this.modulesForOwner(userId, includeDeleted);
  }

  async createModule(session: RequestSession, body: Record<string, unknown>): Promise<ProfileModulePayload[]> {
    const capabilities = await this.schemaCapabilities();
    this.requireProfileModules(capabilities);
    rejectUnknownKeys(body, ["type", "title", "config", "visibility", "status"]);
    await this.ensureBuiltinModules(session.userId);

    if ((await this.activeModuleCount(session.userId)) >= profileModuleMaxPerProfile) {
      throw new EditorRouteError("Profiles can have up to 8 modules.", 422);
    }

    const type = validateModuleType(body.type);
    const title = validateModuleTitle(body.title);
    const visibility = validateModuleVisibility(body.visibility ?? "public");
    const status = validateModuleStatus(body.status ?? "active");

    if (singletonModuleTypes.has(type) && (await this.singletonModuleExists(session.userId, type))) {
      throw new EditorRouteError(`${moduleTypeLabel(type)} module already exists.`, 422);
    }

    if (status === "deleted") {
      throw new EditorRouteError("New modules cannot be created as deleted.", 422);
    }

    if (type === "profile_info" && (visibility !== "public" || status !== "active")) {
      throw new EditorRouteError("Profile info cannot be hidden.", 422);
    }

    const config = validateModuleConfig(body.config);
    const position = await this.nextModulePosition(session.userId);
    const [insert] = await this.pool.execute<ResultSetHeader>(
      `INSERT INTO profile_modules
          (user_id, type, title, config_json, visibility, position, status, schema_version)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        session.userId,
        type,
        title,
        JSON.stringify(config),
        visibility,
        position,
        status,
        profileModuleSchemaVersion,
      ],
    );

    await this.storeModuleTextEntities(insert.insertId, config, visibility, status);

    return this.modulesForOwner(session.userId, false);
  }

  async updateModule(session: RequestSession, moduleId: number, body: Record<string, unknown>): Promise<ProfileModulePayload[]> {
    const capabilities = await this.schemaCapabilities();
    this.requireProfileModules(capabilities);
    rejectUnknownKeys(body, ["title", "config", "visibility", "status", "type"]);

    if ("type" in body) {
      throw new EditorRouteError("Module type cannot be changed.", 422);
    }

    const module = await this.moduleRecord(moduleId);

    if (module === null || numberValue(module.user_id) !== session.userId || module.status === "deleted") {
      throw new EditorRouteError("Profile module not found.", 404);
    }

    const updates: string[] = [];
    const params: Array<string | number | null> = [];
    let nextConfig: Record<string, unknown> | null = null;
    let nextVisibility = module.visibility;
    let nextStatus = module.status;

    if ("title" in body) {
      updates.push("title = ?");
      params.push(validateModuleTitle(body.title));
    }

    if ("config" in body) {
      nextConfig = validateModuleConfig(body.config);
      updates.push("config_json = ?");
      params.push(JSON.stringify(nextConfig));
    }

    if ("visibility" in body) {
      nextVisibility = validateModuleVisibility(body.visibility);
      if (module.type === "profile_info" && nextVisibility !== "public") {
        throw new EditorRouteError("Profile info cannot be hidden.", 422);
      }
      updates.push("visibility = ?");
      params.push(nextVisibility);
    }

    if ("status" in body) {
      nextStatus = validateModuleStatus(body.status);
      if (module.type === "profile_info" && nextStatus !== "active") {
        throw new EditorRouteError("Profile info cannot be hidden.", 422);
      }
      updates.push("status = ?");
      params.push(nextStatus);
    }

    if (updates.length === 0) {
      throw new EditorRouteError("No supported module updates were provided.", 422);
    }

    await this.pool.execute<ResultSetHeader>(
      `UPDATE profile_modules
       SET ${updates.join(", ")},
           updated_at = CURRENT_TIMESTAMP()
       WHERE id = ?`,
      [...params, moduleId],
    );

    if (nextConfig !== null || "visibility" in body || "status" in body) {
      await this.storeModuleTextEntities(
        moduleId,
        nextConfig ?? jsonObject(module.config_json),
        nextVisibility,
        nextStatus,
      );
    }

    return this.modulesForOwner(session.userId, false);
  }

  async deleteModule(session: RequestSession, moduleId: number): Promise<ProfileModulePayload[]> {
    const capabilities = await this.schemaCapabilities();
    this.requireProfileModules(capabilities);
    const module = await this.moduleRecord(moduleId);

    if (module === null || numberValue(module.user_id) !== session.userId) {
      throw new EditorRouteError("Profile module not found.", 404);
    }

    if (protectedModuleTypes.has(module.type)) {
      throw new EditorRouteError("Profile info cannot be deleted.", 422);
    }

    await this.pool.execute<ResultSetHeader>(
      `UPDATE profile_modules
       SET status = 'deleted',
           visibility = 'hidden',
           updated_at = CURRENT_TIMESTAMP()
       WHERE id = ?`,
      [moduleId],
    );
    await this.deleteTextEntities("profile_module", moduleId, "body");

    return this.modulesForOwner(session.userId, false);
  }

  async restoreModule(session: RequestSession, moduleId: number): Promise<ProfileModulePayload[]> {
    const capabilities = await this.schemaCapabilities();
    this.requireProfileModules(capabilities);
    const module = await this.moduleRecord(moduleId);

    if (module === null || numberValue(module.user_id) !== session.userId) {
      throw new EditorRouteError("Profile module not found.", 404);
    }

    if (!profileModuleTypes.has(module.type)) {
      throw new EditorRouteError("This profile module can no longer be restored.", 422);
    }

    if (protectedModuleTypes.has(module.type)) {
      throw new EditorRouteError("Profile info is always active.", 422);
    }

    if (module.status !== "deleted") {
      return this.modulesForOwner(session.userId, true);
    }

    if ((await this.activeModuleCount(session.userId)) >= profileModuleMaxPerProfile) {
      throw new EditorRouteError("Profiles can have up to 8 modules.", 422);
    }

    await this.pool.execute<ResultSetHeader>(
      `UPDATE profile_modules
       SET status = 'active',
           visibility = 'public',
           updated_at = CURRENT_TIMESTAMP()
       WHERE id = ?
         AND user_id = ?`,
      [moduleId, session.userId],
    );

    return this.modulesForOwner(session.userId, true);
  }

  async updateModuleOrder(session: RequestSession, body: Record<string, unknown>): Promise<ProfileModulePayload[]> {
    const capabilities = await this.schemaCapabilities();
    this.requireProfileModules(capabilities);
    rejectUnknownKeys(body, ["moduleIds"]);
    const moduleIds = validateModuleIds(body.moduleIds);
    const currentIds = await this.ownerModuleIds(session.userId);

    if (moduleIds.length !== currentIds.length) {
      throw new EditorRouteError("Module order must include every profile module.", 422);
    }

    if ([...moduleIds].sort((a, b) => a - b).join(",") !== [...currentIds].sort((a, b) => a - b).join(",")) {
      throw new EditorRouteError("Module order contains unavailable modules.", 422);
    }

    await this.withTransaction(async (connection) => {
      for (const [index, moduleId] of moduleIds.entries()) {
        await connection.execute<ResultSetHeader>(
          `UPDATE profile_modules
           SET position = ?,
               updated_at = CURRENT_TIMESTAMP()
           WHERE id = ?
             AND user_id = ?
             AND status <> 'deleted'`,
          [index + 1, moduleId, session.userId],
        );
      }
    });

    return this.modulesForOwner(session.userId, false);
  }

  async updateCanvas(session: RequestSession, body: Record<string, unknown>): Promise<ProfileCanvasUpdatePayload> {
    const capabilities = await this.schemaCapabilities();
    this.requireProfileModules(capabilities);
    this.requireProfileCanvas(capabilities);
    rejectUnknownKeys(body, ["canvasVersion", "backgroundBlur", "modules", "anchorModuleId", "movementContext"]);
    await this.ensureBuiltinModules(session.userId);

    if (!("backgroundBlur" in body) && !("modules" in body)) {
      throw new EditorRouteError("No canvas updates were provided.", 422);
    }

    await this.withTransaction(async (connection) => {
      if ("backgroundBlur" in body) {
        await connection.execute<ResultSetHeader>(
          `UPDATE profiles
           SET profile_background_blur = ?,
               profile_canvas_version = ?,
               updated_at = CURRENT_TIMESTAMP()
           WHERE user_id = ?`,
          [validateBackgroundBlur(body.backgroundBlur), profileCanvasVersion, session.userId],
        );
      }

      if ("modules" in body) {
        await this.applyCanvasPlacements(connection, session.userId, validateCanvasPlacements(body.modules));
      }
    });

    return this.canvasUpdatePayload(session.userId);
  }

  async getCanvasDraft(userId: number): Promise<ProfileCanvasDraftState> {
    const capabilities = await this.schemaCapabilities();
    this.requireProfileModules(capabilities);
    this.requireProfileCanvas(capabilities);
    this.requireProfileCanvasDrafts(capabilities);
    await this.ensureBuiltinModules(userId);

    return this.canvasDraftState(userId);
  }

  async updateCanvasDraft(session: RequestSession, body: Record<string, unknown>): Promise<ProfileCanvasDraftState> {
    const capabilities = await this.schemaCapabilities();
    this.requireProfileModules(capabilities);
    this.requireProfileCanvas(capabilities);
    this.requireProfileCanvasDrafts(capabilities);
    rejectUnknownKeys(body, ["canvasVersion", "backgroundBlur", "canvasGlass", "modules", "selectedModuleId", "updatedAt"]);
    await this.ensureBuiltinModules(session.userId);
    const current = await this.canvasDraftState(session.userId);
    const next: ProfileCanvasDraftState = {
      ...current,
      backgroundBlur: "backgroundBlur" in body ? validateBackgroundBlur(body.backgroundBlur) : current.backgroundBlur,
      canvasGlass: "canvasGlass" in body ? validateCanvasGlass(body.canvasGlass) : current.canvasGlass,
      modules: "modules" in body ? validateDraftModules(body.modules) : current.modules,
      selectedModuleId: "selectedModuleId" in body ? validateSelectedModuleId(body.selectedModuleId) : current.selectedModuleId,
      updatedAt: current.updatedAt,
    };

    await this.saveCanvasDraft(session.userId, next);

    return this.canvasDraftState(session.userId);
  }

  async deleteCanvasDraft(session: RequestSession): Promise<ProfileCanvasDraftState> {
    const capabilities = await this.schemaCapabilities();
    this.requireProfileCanvasDrafts(capabilities);
    await this.pool.execute<ResultSetHeader>(`DELETE FROM profile_canvas_drafts WHERE user_id = ?`, [session.userId]);

    return this.defaultCanvasDraftState(session.userId);
  }

  async commitCanvasDraft(session: RequestSession): Promise<ProfileCanvasUpdatePayload> {
    const capabilities = await this.schemaCapabilities();
    this.requireProfileModules(capabilities);
    this.requireProfileCanvas(capabilities);
    this.requireProfileCanvasDrafts(capabilities);
    const state = await this.canvasDraftState(session.userId);

    await this.withTransaction(async (connection) => {
      await connection.execute<ResultSetHeader>(
        `UPDATE profiles
         SET profile_background_blur = ?,
             profile_canvas_version = ?,
             profile_canvas_glass_opacity = ?,
             updated_at = CURRENT_TIMESTAMP()
         WHERE user_id = ?`,
        [state.backgroundBlur, profileCanvasVersion, state.canvasGlass, session.userId],
      );

      const placements = validateCanvasPlacements(state.modules);
      await this.applyCanvasPlacements(connection, session.userId, placements);
      await connection.execute<ResultSetHeader>(`DELETE FROM profile_canvas_drafts WHERE user_id = ?`, [session.userId]);
    });

    return this.canvasUpdatePayload(session.userId);
  }

  async updateFeaturedBadges(session: RequestSession, body: Record<string, unknown>): Promise<ProfileBadgesPayload> {
    const capabilities = await this.schemaCapabilities();
    this.requireBadges(capabilities);
    const featuredIds = await this.badgeIdsFromBody(body, "featuredBadgeIds", "featuredBadgeKeys", true, maxFeaturedBadges);
    const visibleIds = await this.badgeIdsFromBody(body, "visibleBadgeIds", "visibleBadgeKeys", false, 50);
    const hiddenIds = await this.badgeIdsFromBody(body, "hiddenBadgeIds", "hiddenBadgeKeys", false, 50);
    const ownedIds = await this.userOwnedBadgeIds(session.userId);

    for (const badgeId of [...featuredIds, ...visibleIds, ...hiddenIds]) {
      if (!ownedIds.has(badgeId)) {
        throw new EditorRouteError("Badge is not available on this profile.", 422);
      }
    }

    await this.withTransaction(async (connection) => {
      await this.updateBadgeVisibility(connection, session.userId, hiddenIds, false);
      await this.updateBadgeVisibility(connection, session.userId, visibleIds, true);
      await connection.execute<ResultSetHeader>(
        `UPDATE user_badges
         SET featured_order = NULL
         WHERE user_id = ?`,
        [session.userId],
      );

      for (const [index, badgeId] of featuredIds.entries()) {
        await connection.execute<ResultSetHeader>(
          `UPDATE user_badges
           SET featured_order = ?,
               is_visible = 1
           WHERE user_id = ?
             AND badge_id = ?`,
          [index + 1, session.userId, badgeId],
        );
      }
    });

    return this.badgesForUser(session.userId, true);
  }

  async deleteMyPosts(userId: number, rawKind: string): Promise<MyPostsDeletePayload> {
    const kind = settingsPostKind(rawKind);
    const where = settingsPostsKindWhere(kind);
    const [result] = await this.pool.execute<ResultSetHeader>(
      `UPDATE posts
       SET status = 'removed',
           deleted_at = COALESCE(deleted_at, CURRENT_TIMESTAMP()),
           updated_at = CURRENT_TIMESTAMP()
       WHERE author_id = ?
         AND deleted_at IS NULL
         ${where}`,
      [userId],
    );

    return {
      deletedCount: result.affectedRows,
      kind,
    };
  }

  async updateAccountEmail(session: RequestSession, body: Record<string, unknown>): Promise<SettingsPayload> {
    await this.requireCurrentPassword(session.userId, body.currentPassword ?? body.current_password);
    const email = validateAuthEmail(body.email);

    try {
      await this.pool.execute<ResultSetHeader>(
        `UPDATE users
         SET email = ?,
             updated_at = CURRENT_TIMESTAMP()
         WHERE id = ?`,
        [email, session.userId],
      );
    } catch (error) {
      if (isDuplicateError(error)) {
        throw new EditorRouteError("Email is already in use.", 409);
      }

      throw error;
    }

    return this.settingsPayload(session.userId);
  }

  async updateAccountHandle(session: RequestSession, body: Record<string, unknown>): Promise<SettingsPayload> {
    await this.requireCurrentPassword(session.userId, body.currentPassword ?? body.current_password);
    const nextHandle = validateAuthHandle(body.handle);
    const currentHandle = session.handle;

    if (nextHandle === currentHandle) {
      return this.settingsPayload(session.userId);
    }

    await this.rejectHandleCooldown(session.userId);
    await this.rejectReservedHandle(nextHandle, session.userId);

    try {
      await this.withTransaction(async (connection) => {
        await connection.execute<ResultSetHeader>(
          `UPDATE users
           SET handle = ?,
               updated_at = CURRENT_TIMESTAMP()
           WHERE id = ?`,
          [nextHandle, session.userId],
        );
        await connection.execute<ResultSetHeader>(
          `INSERT INTO user_handle_history (user_id, old_handle, new_handle, reserved_until)
           VALUES (?, ?, ?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL ? SECOND))`,
          [session.userId, currentHandle, nextHandle, accountHandleCooldownSeconds],
        );
      });
    } catch (error) {
      if (isDuplicateError(error)) {
        throw new EditorRouteError("Handle is already in use.", 409);
      }

      throw error;
    }

    return this.settingsPayload(session.userId);
  }

  async updateAccountPassword(session: RequestSession, body: Record<string, unknown>): Promise<AccountPasswordPayload> {
    await this.requireCurrentPassword(session.userId, body.currentPassword ?? body.current_password);
    const password = validateAuthPassword(body.newPassword ?? body.new_password);
    const passwordHash = await hashPhpPassword(password);

    await this.withTransaction(async (connection) => {
      await connection.execute<ResultSetHeader>(
        `UPDATE users
         SET password_hash = ?,
             updated_at = CURRENT_TIMESTAMP()
         WHERE id = ?`,
        [passwordHash, session.userId],
      );
      await connection.execute<ResultSetHeader>(
        `DELETE FROM sessions
         WHERE user_id = ?
           AND id <> ?`,
        [session.userId, session.sessionId],
      );
    });

    return { changed: true };
  }

  async scheduleAccountDeletion(session: RequestSession, body: Record<string, unknown>): Promise<AccountDeletionSchedulePayload> {
    const capabilities = await this.schemaCapabilities();

    if (!capabilities.hasAccountDeletionRequests) {
      throw new EditorStorageNotReadyError("Account deletion storage is not ready. Run pending migrations.");
    }

    await this.requireCurrentPassword(session.userId, body.currentPassword ?? body.current_password);
    const reason = validateNullableText(body.reason, 255, "Reason");
    const scheduledFor = mysqlDate(new Date(Date.now() + accountDeletionGraceSeconds * 1000));

    await this.withTransaction(async (connection) => {
      await connection.execute<ResultSetHeader>(
        `INSERT INTO account_deletion_requests (user_id, requested_at, scheduled_for, reason)
         VALUES (?, UTC_TIMESTAMP(), ?, ?)
         ON DUPLICATE KEY UPDATE
           requested_at = UTC_TIMESTAMP(),
           scheduled_for = VALUES(scheduled_for),
           canceled_at = NULL,
           completed_at = NULL,
           reason = VALUES(reason),
           updated_at = CURRENT_TIMESTAMP()`,
        [session.userId, scheduledFor, reason],
      );
      await connection.execute<ResultSetHeader>(`DELETE FROM sessions WHERE user_id = ?`, [session.userId]);
    });

    return {
      scheduled: true,
      scheduledFor,
    };
  }

  async cancelAccountDeletion(session: RequestSession): Promise<SettingsPayload> {
    await this.pool.execute<ResultSetHeader>(
      `UPDATE account_deletion_requests
       SET canceled_at = UTC_TIMESTAMP(),
           updated_at = CURRENT_TIMESTAMP()
       WHERE user_id = ?
         AND canceled_at IS NULL
         AND completed_at IS NULL`,
      [session.userId],
    );

    return this.settingsPayload(session.userId);
  }

  private async fetchProfilePayload(userId: number): Promise<ProfilePayload> {
    const capabilities = await this.schemaCapabilities();
    const handle = await this.handleForUser(userId);
    const [rows] = await this.pool.execute<ProfileRow[]>(buildProfileByHandleQuery(capabilities), [handle]);
    const row = rows[0];

    if (row === undefined) {
      throw new EditorRouteError("Profile not found.", 404);
    }

    return profilePayloadWithFeatured(row, await this.profileSocialContext(userId, capabilities), [], null, null, true);
  }

  private async settingsPayload(userId: number): Promise<SettingsPayload> {
    const capabilities = await this.schemaCapabilities();
    this.requireSettingsStorage(capabilities);
    await this.ensurePreferences(userId);
    const [userRows] = await this.pool.execute<SettingsUserRow[]>(
      `SELECT
          u.id AS user_id,
          u.handle,
          u.email,
          u.status,
          p.display_name,
          p.visibility
       FROM users u
       INNER JOIN profiles p ON p.user_id = u.id
       WHERE u.id = ?
       LIMIT 1`,
      [userId],
    );
    const user = userRows[0];

    if (user === undefined) {
      throw new EditorRouteError("Session not found.", 401);
    }

    const [preferencesRows] = await this.pool.execute<PreferencesRow[]>(
      `SELECT *
       FROM user_preferences
       WHERE user_id = ?
       LIMIT 1`,
      [userId],
    );
    const preferences = preferencesRows[0];
    const deletion = await this.deletionRow(userId);

    return {
      account: {
        id: userId,
        handle: user.handle,
        email: user.email,
        displayName: user.display_name ?? user.handle,
        status: user.status ?? "active",
        handleChange: await this.handleChangeState(userId),
      },
      privacy: {
        profileVisibility: user.visibility === "private" ? "private" : "public",
      },
      preferences: preferencesPayload(preferences),
      twoFactor: await this.twoFactorStatus(userId),
      deletion: deletion === null
        ? null
        : {
            requestedAt: deletion.requested_at,
            scheduledFor: deletion.scheduled_for,
            canceledAt: deletion.canceled_at,
            completedAt: deletion.completed_at,
          },
    };
  }

  private async modulesForOwner(userId: number, includeDeleted: boolean): Promise<ProfileModulePayload[]> {
    await this.ensureBuiltinModules(userId);
    const deletedWhere = includeDeleted ? "" : "AND status <> 'deleted'";
    const [rows] = await this.pool.execute<ProfileModuleRow[]>(
      `SELECT
          id,
          user_id,
          type,
          title,
          config_json,
          visibility,
          position,
          grid_column,
          grid_row,
          grid_col_span,
          grid_row_span,
          grid_pinned,
          status,
          schema_version,
          created_at,
          updated_at
       FROM profile_modules
       WHERE user_id = ?
         ${deletedWhere}
       ORDER BY position ASC, id ASC`,
      [userId],
    );

    return rows.map((row) => modulePayload(row));
  }

  private async ensureBuiltinModules(userId: number): Promise<void> {
    await this.ensureSingletonModule(userId, "profile_info", "Profile info", {}, 0);

    if ((await this.nonDefaultActiveModuleCount(userId)) === 0) {
      await this.ensureSingletonModule(userId, "activity", "Activity", { variant: "feed" }, 2);
    }
  }

  private async ensureSingletonModule(
    userId: number,
    type: string,
    title: string,
    config: Record<string, unknown>,
    position: number,
  ): Promise<void> {
    if (await this.singletonModuleExists(userId, type)) {
      return;
    }

    await this.pool.execute<ResultSetHeader>(
      `INSERT INTO profile_modules
          (user_id, type, title, config_json, visibility, position, status, schema_version)
       VALUES (?, ?, ?, ?, 'public', ?, 'active', ?)`,
      [userId, type, title, JSON.stringify(config), position, profileModuleSchemaVersion],
    );
  }

  private async moduleRecord(moduleId: number): Promise<ProfileModuleRow | null> {
    const [rows] = await this.pool.execute<ProfileModuleRow[]>(
      `SELECT
          id,
          user_id,
          type,
          title,
          config_json,
          visibility,
          position,
          grid_column,
          grid_row,
          grid_col_span,
          grid_row_span,
          grid_pinned,
          status,
          schema_version,
          created_at,
          updated_at
       FROM profile_modules
       WHERE id = ?
       LIMIT 1`,
      [moduleId],
    );

    return rows[0] ?? null;
  }

  private async activeModuleCount(userId: number): Promise<number> {
    const [rows] = await this.pool.execute<ModuleCountRow[]>(
      `SELECT COUNT(*) AS module_count
       FROM profile_modules
       WHERE user_id = ?
         AND status <> 'deleted'`,
      [userId],
    );

    return numberValue(rows[0]?.module_count);
  }

  private async nonDefaultActiveModuleCount(userId: number): Promise<number> {
    const [rows] = await this.pool.execute<ModuleCountRow[]>(
      `SELECT COUNT(*) AS module_count
       FROM profile_modules
       WHERE user_id = ?
         AND status <> 'deleted'
         AND type NOT IN ('profile_info', 'activity')`,
      [userId],
    );

    return numberValue(rows[0]?.module_count);
  }

  private async singletonModuleExists(userId: number, type: string): Promise<boolean> {
    const [rows] = await this.pool.execute<IdRow[]>(
      `SELECT id
       FROM profile_modules
       WHERE user_id = ?
         AND type = ?
       LIMIT 1`,
      [userId, type],
    );

    return rows[0] !== undefined;
  }

  private async nextModulePosition(userId: number): Promise<number> {
    const [rows] = await this.pool.execute<ModuleCountRow[]>(
      `SELECT COALESCE(MAX(position), 0) + 1 AS module_count
       FROM profile_modules
       WHERE user_id = ?`,
      [userId],
    );

    return Math.max(1, numberValue(rows[0]?.module_count));
  }

  private async ownerModuleIds(userId: number): Promise<number[]> {
    const [rows] = await this.pool.execute<IdRow[]>(
      `SELECT id
       FROM profile_modules
       WHERE user_id = ?
         AND status <> 'deleted'
       ORDER BY position ASC, id ASC`,
      [userId],
    );

    return rows.map((row) => numberValue(row.id));
  }

  private async canvasUpdatePayload(userId: number): Promise<ProfileCanvasUpdatePayload> {
    const preferences = await this.canvasPreferences(userId);

    return {
      ...preferences,
      modules: await this.modulesForOwner(userId, false),
    };
  }

  private async canvasPreferences(userId: number): Promise<Omit<ProfileCanvasUpdatePayload, "modules">> {
    const [rows] = await this.pool.execute<CanvasPreferencesRow[]>(
      `SELECT profile_background_blur, profile_canvas_version, profile_canvas_glass_opacity
       FROM profiles
       WHERE user_id = ?
       LIMIT 1`,
      [userId],
    );
    const row = rows[0];

    return {
      backgroundBlur: validateBackgroundBlur(row?.profile_background_blur ?? "medium"),
      canvasGlass: validateCanvasGlass(row?.profile_canvas_glass_opacity ?? 58),
      canvasVersion: profileCanvasVersion,
    };
  }

  private async canvasDraftState(userId: number): Promise<ProfileCanvasDraftState> {
    const [rows] = await this.pool.execute<CanvasDraftRow[]>(
      `SELECT draft_json, selected_module_id, updated_at
       FROM profile_canvas_drafts
       WHERE user_id = ?
       LIMIT 1`,
      [userId],
    );
    const row = rows[0];

    if (row === undefined) {
      return this.defaultCanvasDraftState(userId);
    }

    const decoded = jsonObject(row.draft_json);
    const defaults = await this.defaultCanvasDraftState(userId);

    return {
      backgroundBlur: validateBackgroundBlur(decoded.backgroundBlur ?? defaults.backgroundBlur),
      canvasGlass: validateCanvasGlass(decoded.canvasGlass ?? defaults.canvasGlass),
      canvasVersion: profileCanvasVersion,
      modules: Array.isArray(decoded.modules) ? validateDraftModules(decoded.modules) : defaults.modules,
      selectedModuleId: validateSelectedModuleId(row.selected_module_id ?? decoded.selectedModuleId ?? null),
      updatedAt: row.updated_at,
    };
  }

  private async defaultCanvasDraftState(userId: number): Promise<ProfileCanvasDraftState> {
    const preferences = await this.canvasPreferences(userId);

    return {
      ...preferences,
      modules: await this.modulesForOwner(userId, false),
      selectedModuleId: null,
      updatedAt: null,
    };
  }

  private async saveCanvasDraft(userId: number, state: ProfileCanvasDraftState): Promise<void> {
    const draftJson = JSON.stringify({
      backgroundBlur: state.backgroundBlur,
      canvasGlass: state.canvasGlass,
      canvasVersion: profileCanvasVersion,
      modules: state.modules,
      selectedModuleId: state.selectedModuleId,
    });

    await this.pool.execute<ResultSetHeader>(
      `INSERT INTO profile_canvas_drafts (user_id, draft_json, selected_module_id)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE
         draft_json = VALUES(draft_json),
         selected_module_id = VALUES(selected_module_id),
         updated_at = CURRENT_TIMESTAMP()`,
      [userId, draftJson, state.selectedModuleId === null ? null : String(state.selectedModuleId)],
    );
  }

  private async applyCanvasPlacements(
    connection: PoolConnection,
    userId: number,
    placements: CanvasPlacement[],
  ): Promise<void> {
    for (const placement of placements) {
      await connection.execute<ResultSetHeader>(
        `UPDATE profile_modules
         SET grid_column = ?,
             grid_row = ?,
             grid_col_span = ?,
             grid_row_span = ?,
             grid_pinned = ?,
             visibility = ?,
             updated_at = CURRENT_TIMESTAMP()
         WHERE id = ?
           AND user_id = ?
           AND status <> 'deleted'`,
        [
          placement.column,
          placement.row,
          placement.colSpan,
          placement.rowSpan,
          placement.pinned ? 1 : 0,
          placement.visible ? "public" : "hidden",
          placement.id,
          userId,
        ],
      );
    }
  }

  private async badgesForUser(userId: number, includeHidden: boolean): Promise<ProfileBadgesPayload> {
    const visibilityWhere = includeHidden ? "" : "AND ub.is_visible = 1";
    const [rows] = await this.pool.execute<UserBadgeRow[]>(
      `${userBadgeSelectSql()}
       WHERE ub.user_id = ?
         AND b.is_active = 1
         ${visibilityWhere}
       ORDER BY
         CASE WHEN ub.featured_order IS NULL THEN 1 ELSE 0 END,
         ub.featured_order ASC,
         ub.earned_at DESC,
         ub.id DESC`,
      [userId],
    );

    return profileBadgesPayloadFromRows(rows);
  }

  private async badgeIdsFromBody(
    body: Record<string, unknown>,
    idKey: string,
    badgeKeyKey: string,
    required: boolean,
    max: number,
  ): Promise<number[]> {
    const ids: number[] = [];

    if (idKey in body) {
      ids.push(...validateBadgeIdArray(body[idKey], max, "Badge ids"));
    }

    if (badgeKeyKey in body) {
      ids.push(...await this.badgeIdsForKeys(validateBadgeKeyArray(body[badgeKeyKey], max)));
    }

    if (required && !(idKey in body) && !(badgeKeyKey in body)) {
      throw new EditorRouteError("Featured badges are required.", 422);
    }

    const unique = [...new Set(ids)];

    if (unique.length > max) {
      throw new EditorRouteError("Too many badges were selected.", 422);
    }

    return unique;
  }

  private async badgeIdsForKeys(keys: string[]): Promise<number[]> {
    if (keys.length === 0) {
      return [];
    }

    const [rows] = await this.pool.query<(RowDataPacket & { id: number | string; badge_key: string })[]>(
      `SELECT id, badge_key
       FROM badges
       WHERE badge_key IN (?)`,
      [keys],
    );
    const found = new Set(rows.map((row) => row.badge_key));

    for (const key of keys) {
      if (!found.has(key)) {
        throw new EditorRouteError("Badge not found.", 404);
      }
    }

    return rows.map((row) => numberValue(row.id));
  }

  private async userOwnedBadgeIds(userId: number): Promise<Set<number>> {
    const [rows] = await this.pool.execute<IdRow[]>(
      `SELECT badge_id AS id
       FROM user_badges
       WHERE user_id = ?`,
      [userId],
    );

    return new Set(rows.map((row) => numberValue(row.id)));
  }

  private async updateBadgeVisibility(
    connection: PoolConnection,
    userId: number,
    badgeIds: number[],
    visible: boolean,
  ): Promise<void> {
    if (badgeIds.length === 0) {
      return;
    }

    await connection.query<ResultSetHeader>(
      `UPDATE user_badges
       SET is_visible = ?,
           featured_order = ${visible ? "featured_order" : "NULL"}
       WHERE user_id = ?
         AND badge_id IN (?)`,
      [visible ? 1 : 0, userId, badgeIds],
    );
  }

  private async featuredPostIdForUser(
    value: unknown,
    userId: number,
    capabilities: SchemaCapabilities,
  ): Promise<number | null> {
    const postId = nullablePositiveInteger(value, "Featured post");

    if (postId === null) {
      return null;
    }

    const roomDeletedSelect = capabilities.hasRoomSoftDeleteColumn ? "rooms.deleted_at" : "NULL";
    const [rows] = await this.pool.execute<PostVisibilityRow[]>(
      `SELECT
          posts.id,
          posts.author_id,
          posts.room_id,
          posts.visibility,
          posts.status,
          posts.deleted_at,
          rooms.visibility AS room_visibility,
          ${roomDeletedSelect} AS room_deleted_at
       FROM posts
       LEFT JOIN rooms ON rooms.id = posts.room_id
       WHERE posts.id = ?
       LIMIT 1`,
      [postId],
    );
    const post = rows[0];

    if (post === undefined) {
      throw new EditorRouteError("Featured post is not available.", 422);
    }

    if (numberValue(post.author_id) !== userId) {
      throw new EditorRouteError("You can only feature your own posts.", 403);
    }

    if (
      post.visibility !== "public" ||
      post.status !== "published" ||
      post.deleted_at !== null ||
      (post.room_id !== null && (post.room_visibility !== "public" || post.room_deleted_at !== null))
    ) {
      throw new EditorRouteError("Featured post is not available.", 422);
    }

    return postId;
  }

  private async featuredRoomIdForUser(
    value: unknown,
    userId: number,
    capabilities: SchemaCapabilities,
  ): Promise<number | null> {
    const roomId = nullablePositiveInteger(value, "Featured room");

    if (roomId === null) {
      return null;
    }

    const roomDeletedSelect = capabilities.hasRoomSoftDeleteColumn ? "rooms.deleted_at" : "NULL";
    const membershipSelect = capabilities.hasRoomMemberships
      ? `OR EXISTS (
          SELECT 1
          FROM room_memberships memberships
          WHERE memberships.room_id = rooms.id
            AND memberships.user_id = ?
            AND memberships.banned_at IS NULL
        )`
      : "";
    const [rows] = await this.pool.execute<RoomEligibilityRow[]>(
      `SELECT
          rooms.id,
          rooms.visibility,
          ${roomDeletedSelect} AS deleted_at,
          IF(rooms.created_by = ? ${membershipSelect}, 1, 0) AS is_eligible
       FROM rooms
       WHERE rooms.id = ?
       LIMIT 1`,
      capabilities.hasRoomMemberships ? [userId, userId, roomId] : [userId, roomId],
    );
    const room = rows[0];

    if (room === undefined || room.visibility !== "public" || room.deleted_at !== null) {
      throw new EditorRouteError("Featured room is not available.", 422);
    }

    if (!booleanValue(room.is_eligible)) {
      throw new EditorRouteError("You can only feature rooms you own or belong to.", 403);
    }

    return roomId;
  }

  private async requireCurrentPassword(userId: number, value: unknown): Promise<void> {
    if (typeof value !== "string" || value === "") {
      throw new EditorRouteError("Current password is required.", 422);
    }

    const [rows] = await this.pool.execute<PasswordRow[]>(
      `SELECT password_hash
       FROM users
       WHERE id = ?
       LIMIT 1`,
      [userId],
    );
    const passwordHash = rows[0]?.password_hash;

    if (typeof passwordHash !== "string" || !(await verifyPhpPassword(value, passwordHash))) {
      throw new EditorRouteError("Current password is incorrect.", 403);
    }
  }

  private async rejectHandleCooldown(userId: number): Promise<void> {
    const capabilities = await this.schemaCapabilities();

    if (!capabilities.hasUserHandleHistory) {
      return;
    }

    const [rows] = await this.pool.execute<HandleHistoryRow[]>(
      `SELECT created_at
       FROM user_handle_history
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT 1`,
      [userId],
    );
    const createdAt = rows[0]?.created_at;

    if (createdAt === undefined || createdAt === null) {
      return;
    }

    const nextAllowedAt = new Date(`${createdAt.replace(" ", "T")}Z`).getTime() + accountHandleCooldownSeconds * 1000;

    if (nextAllowedAt > Date.now()) {
      throw new EditorRouteError(
        `You can change your handle again after ${new Date(nextAllowedAt).toISOString().slice(0, 10)}.`,
        429,
      );
    }
  }

  private async rejectReservedHandle(handle: string, userId: number): Promise<void> {
    const capabilities = await this.schemaCapabilities();

    if (!capabilities.hasUserHandleHistory) {
      return;
    }

    const [rows] = await this.pool.execute<HandleHistoryRow[]>(
      `SELECT user_id
       FROM user_handle_history
       WHERE old_handle = ?
         AND reserved_until > UTC_TIMESTAMP()
       ORDER BY created_at DESC
       LIMIT 1`,
      [handle],
    );
    const row = rows[0];

    if (row !== undefined && numberValue(row.user_id) !== userId) {
      throw new EditorRouteError("Handle is temporarily reserved.", 409);
    }
  }

  private async handleChangeState(userId: number): Promise<SettingsPayload["account"]["handleChange"]> {
    const capabilities = await this.schemaCapabilities();

    if (!capabilities.hasUserHandleHistory) {
      return { canChange: true, nextAllowedAt: null };
    }

    const [rows] = await this.pool.execute<HandleHistoryRow[]>(
      `SELECT created_at
       FROM user_handle_history
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT 1`,
      [userId],
    );
    const createdAt = rows[0]?.created_at;

    if (createdAt === undefined || createdAt === null) {
      return { canChange: true, nextAllowedAt: null };
    }

    const nextAllowedAt = new Date(`${createdAt.replace(" ", "T")}Z`).getTime() + accountHandleCooldownSeconds * 1000;

    return {
      canChange: nextAllowedAt <= Date.now(),
      nextAllowedAt: new Date(nextAllowedAt).toISOString(),
    };
  }

  private async deletionRow(userId: number): Promise<DeletionRow | null> {
    const capabilities = await this.schemaCapabilities();

    if (!capabilities.hasAccountDeletionRequests) {
      return null;
    }

    const [rows] = await this.pool.execute<DeletionRow[]>(
      `SELECT requested_at, scheduled_for, canceled_at, completed_at
       FROM account_deletion_requests
       WHERE user_id = ?
       ORDER BY requested_at DESC
       LIMIT 1`,
      [userId],
    );

    return rows[0] ?? null;
  }

  private async twoFactorStatus(userId: number): Promise<SettingsPayload["twoFactor"]> {
    const capabilities = await this.schemaCapabilities();

    if (!capabilities.hasUserTwoFactor) {
      return {
        enabled: false,
        backupCodeCount: 0,
        encryptionConfigured: false,
        encryptionAvailable: true,
      };
    }

    const [twoFactorRows] = await this.pool.execute<TwoFactorStatusRow[]>(
      `SELECT enabled_at
       FROM user_two_factor
       WHERE user_id = ?
       LIMIT 1`,
      [userId],
    );
    const [backupRows] = capabilities.hasBackupCodes
      ? await this.pool.execute<BackupCodeCountRow[]>(
          `SELECT COUNT(*) AS code_count
           FROM user_two_factor_backup_codes
           WHERE user_id = ?
             AND used_at IS NULL`,
          [userId],
        )
      : [[] as BackupCodeCountRow[]];

    return {
      enabled: twoFactorRows[0]?.enabled_at !== null && twoFactorRows[0]?.enabled_at !== undefined,
      backupCodeCount: numberValue(backupRows[0]?.code_count),
      encryptionConfigured: true,
      encryptionAvailable: true,
    };
  }

  private async ensurePreferences(userId: number): Promise<void> {
    await this.pool.execute<ResultSetHeader>(
      `INSERT IGNORE INTO user_preferences
          (user_id, notification_preferences_json, email_notification_preferences_json, push_notification_preferences_json)
       VALUES (?, JSON_OBJECT(), JSON_OBJECT(), JSON_OBJECT())`,
      [userId],
    );
  }

  private async handleForUser(userId: number): Promise<string> {
    const [rows] = await this.pool.execute<(RowDataPacket & { handle: string })[]>(
      `SELECT handle
       FROM users
       WHERE id = ?
       LIMIT 1`,
      [userId],
    );
    const handle = rows[0]?.handle;

    if (typeof handle !== "string") {
      throw new EditorRouteError("Profile not found.", 404);
    }

    return handle;
  }

  private async profileSocialContext(
    profileUserId: number,
    capabilities: SchemaCapabilities,
  ): Promise<ProfileSocialContext> {
    const followerCount = capabilities.hasUserFollows
      ? await this.count(
          `SELECT COUNT(*) AS table_count
           FROM user_follows
           WHERE following_id = ?`,
          [profileUserId],
        )
      : 0;
    const followingCount = capabilities.hasUserFollows
      ? await this.count(
          `SELECT COUNT(*) AS table_count
           FROM user_follows
           WHERE follower_id = ?`,
          [profileUserId],
        )
      : 0;
    const mootCount = capabilities.hasUserFollows
      ? await this.count(
          `SELECT COUNT(*) AS table_count
           FROM user_follows follows
           INNER JOIN user_follows back
             ON back.follower_id = follows.following_id
            AND back.following_id = follows.follower_id
           WHERE follows.follower_id = ?`,
          [profileUserId],
        )
      : 0;
    const starCount = capabilities.hasProfileStars
      ? await this.count(
          `SELECT COUNT(*) AS table_count
           FROM profile_stars
           WHERE starred_user_id = ?`,
          [profileUserId],
        )
      : 0;

    return {
      followerCount,
      followingCount,
      mootCount,
      starCount,
      isFollowing: false,
      isFollowedBy: false,
      isMoot: false,
      isStarred: false,
      isFollowRequestPending: false,
      isBlocked: false,
      isMuted: false,
    };
  }

  private async count(sql: string, params: Array<string | number | null>): Promise<number> {
    const [rows] = await this.pool.execute<CountRow[]>(sql, params);

    return numberValue(rows[0]?.table_count);
  }

  private async storeModuleTextEntities(
    moduleId: number,
    config: Record<string, unknown>,
    visibility: string,
    status: string,
  ): Promise<void> {
    const capabilities = await this.schemaCapabilities();

    if (!capabilities.hasTextEntities) {
      return;
    }

    const body = typeof config.body === "string" ? config.body : "";

    if (body === "" || visibility !== "public" || status !== "active") {
      await this.deleteTextEntities("profile_module", moduleId, "body");
      return;
    }

    await this.storeTextEntities("profile_module", moduleId, "body", body);
  }

  private async storeTextEntities(
    contentType: string,
    contentId: number,
    fieldName: string,
    body: string | null,
  ): Promise<void> {
    await this.deleteTextEntities(contentType, contentId, fieldName);

    if (body === null || body === "") {
      return;
    }

    for (const entity of extractTextEntities(body)) {
      await this.pool.execute<ResultSetHeader>(
        `INSERT INTO text_entities
            (content_type, content_id, field_name, entity_type, entity_start, entity_length, text_value, url, target_user_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          contentType,
          contentId,
          fieldName,
          entity.type,
          entity.start,
          entity.length,
          entity.text,
          entity.url,
          entity.targetUserId,
        ],
      );
    }
  }

  private async deleteTextEntities(contentType: string, contentId: number, fieldName: string): Promise<void> {
    const capabilities = await this.schemaCapabilities();

    if (!capabilities.hasTextEntities) {
      return;
    }

    await this.pool.execute<ResultSetHeader>(
      `DELETE FROM text_entities
       WHERE content_type = ?
         AND content_id = ?
         AND field_name = ?`,
      [contentType, contentId, fieldName],
    );
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

  private requireSettingsStorage(capabilities: SchemaCapabilities): void {
    if (!capabilities.hasProfileVisibilityColumn || !capabilities.hasUserPreferences) {
      throw new EditorStorageNotReadyError("Account settings storage is not ready. Run pending migrations.");
    }
  }

  private requireProfileCustomizationStorage(capabilities: SchemaCapabilities): void {
    if (!capabilities.hasProfileCustomizationColumns) {
      throw new EditorStorageNotReadyError("Profile customization migration has not been applied.");
    }
  }

  private requireProfileModules(capabilities: SchemaCapabilities): void {
    if (!capabilities.hasProfileModules) {
      throw new EditorStorageNotReadyError("Profile module storage is not ready. Run pending migrations.");
    }
  }

  private requireProfileCanvas(capabilities: SchemaCapabilities): void {
    if (!capabilities.hasProfileModuleLayoutColumns) {
      throw new EditorStorageNotReadyError("Profile canvas storage is not ready. Run pending migrations.");
    }
  }

  private requireProfileCanvasDrafts(capabilities: SchemaCapabilities): void {
    if (!capabilities.hasProfileCanvasDrafts) {
      throw new EditorStorageNotReadyError("Profile canvas draft storage is not ready. Run pending migrations.");
    }
  }

  private requireBadges(capabilities: SchemaCapabilities): void {
    if (!capabilities.hasBadges || !capabilities.hasUserBadges) {
      throw new EditorStorageNotReadyError("Badge storage is not ready. Run pending migrations.");
    }
  }

  private async schemaCapabilities(): Promise<SchemaCapabilities> {
    this.capabilities ??= Promise.all([
      this.tableExists("account_deletion_requests"),
      this.tableExists("user_follows"),
      this.tableExists("user_follow_requests"),
      this.tableExists("user_blocks"),
      this.tableExists("user_mutes"),
      this.tableExists("profile_stars"),
      this.columnExists("profiles", "banner_url"),
      this.columnExists("profiles", "profile_background_video_url"),
      this.columnExists("profiles", "profile_background_blur"),
      this.columnExists("profiles", "profile_layout_preset"),
      this.columnExists("profiles", "profile_canvas_version"),
      this.columnExists("profiles", "profile_canvas_glass_opacity"),
      this.columnExists("profiles", "profile_theme_config_json"),
      this.columnExists("profiles", "featured_post_id"),
      this.columnExists("profiles", "visibility"),
      this.tableExists("room_memberships"),
      this.columnExists("rooms", "icon_url"),
      this.columnExists("rooms", "deleted_at"),
      this.columnExists("posts", "public_id"),
      this.tableExists("post_reblogs"),
      this.tableExists("text_entities"),
      this.tableExists("profile_modules"),
      this.columnExists("profile_modules", "grid_column"),
      this.columnExists("profile_modules", "grid_pinned"),
      this.tableExists("badges"),
      this.tableExists("user_badges"),
      this.tableExists("profile_integration_accounts"),
      this.tableExists("profile_integration_metadata_cache"),
      this.tableExists("user_preferences"),
      this.tableExists("user_handle_history"),
      this.tableExists("user_two_factor"),
      this.tableExists("user_two_factor_backup_codes"),
      this.tableExists("profile_canvas_drafts"),
    ]).then(
      ([
        hasAccountDeletionRequests,
        hasUserFollows,
        hasUserFollowRequests,
        hasUserBlocks,
        hasUserMutes,
        hasProfileStars,
        hasProfileCustomizationColumns,
        hasProfileBackgroundVideoColumns,
        hasProfileBackgroundBlurColumn,
        hasProfileLayoutPresetColumn,
        hasProfileCanvasVersionColumn,
        hasProfileCanvasGlassColumn,
        hasProfileThemeConfigColumn,
        hasProfileFeaturedColumns,
        hasProfileVisibilityColumn,
        hasRoomMemberships,
        hasRoomCustomizationColumns,
        hasRoomSoftDeleteColumn,
        hasPostPublicIdColumn,
        hasPostReblogs,
        hasTextEntities,
        hasProfileModules,
        hasProfileModuleLayoutColumns,
        hasProfileModulePinnedColumn,
        hasBadges,
        hasUserBadges,
        hasProfileIntegrationAccounts,
        hasProfileIntegrationMetadataCache,
        hasUserPreferences,
        hasUserHandleHistory,
        hasUserTwoFactor,
        hasBackupCodes,
        hasProfileCanvasDrafts,
      ]) => ({
        hasAccountDeletionRequests,
        hasUserFollows,
        hasUserFollowRequests,
        hasUserBlocks,
        hasUserMutes,
        hasProfileStars,
        hasProfileCustomizationColumns,
        hasProfileBackgroundVideoColumns,
        hasProfileBackgroundBlurColumn,
        hasProfileLayoutPresetColumn,
        hasProfileCanvasVersionColumn,
        hasProfileCanvasGlassColumn,
        hasProfileThemeConfigColumn,
        hasProfileFeaturedColumns,
        hasProfileVisibilityColumn,
        hasRoomMemberships,
        hasRoomCustomizationColumns,
        hasRoomSoftDeleteColumn,
        hasPostPublicIdColumn,
        hasPostReblogs,
        hasTextEntities,
        hasProfileModules,
        hasProfileModuleLayoutColumns,
        hasProfileModulePinnedColumn,
        hasBadges,
        hasUserBadges,
        hasProfileIntegrationAccounts,
        hasProfileIntegrationMetadataCache,
        hasUserPreferences,
        hasUserHandleHistory,
        hasUserTwoFactor,
        hasBackupCodes,
        hasProfileCanvasDrafts,
      }),
    );

    return this.capabilities;
  }

  private async tableExists(tableName: string): Promise<boolean> {
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
}

function addUpdate(
  updates: string[],
  params: Array<string | number | null>,
  column: string,
  rawValue: unknown,
  validator: (value: unknown) => string | number | null,
): void {
  if (rawValue === undefined) {
    return;
  }

  updates.push(`${column} = ?`);
  params.push(validator(rawValue));
}

function modulePayload(row: ProfileModuleRow): ProfileModulePayload {
  return {
    id: numberValue(row.id),
    type: row.type,
    title: nullableString(row.title),
    config: jsonObject(row.config_json),
    visibility: row.visibility,
    position: numberValue(row.position),
    pinned: booleanValue(row.grid_pinned),
    layout: profileModuleLayoutPayload(row),
    status: row.status,
    schemaVersion: numberValue(row.schema_version),
    createdAt: stringOrNull(row.created_at),
    updatedAt: stringOrNull(row.updated_at),
  };
}

function preferencesPayload(row: PreferencesRow | undefined): SettingsPayload["preferences"] {
  return {
    analyticsConsent: booleanValue(row?.analytics_consent ?? false),
    personalizationConsent: booleanValue(row?.personalization_consent ?? true),
    richEmbedsConsent: booleanValue(row?.rich_embeds_consent ?? true),
    autoplayMediaConsent: booleanValue(row?.autoplay_media_consent ?? false),
    sensitiveContentVisible: booleanValue(row?.sensitive_content_visible ?? false),
    notifications: jsonSettingsObjectValue(row?.notification_preferences_json),
    emailNotifications: jsonSettingsObjectValue(row?.email_notification_preferences_json),
    pushNotifications: jsonSettingsObjectValue(row?.push_notification_preferences_json),
  };
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

function bodyValue(body: Record<string, unknown>, camelKey: string, snakeKey: string): unknown {
  return camelKey in body ? body[camelKey] : body[snakeKey];
}

function rejectUnknownKeys(body: Record<string, unknown>, allowed: string[]): void {
  for (const key of Object.keys(body)) {
    if (!allowed.includes(key)) {
      throw new EditorRouteError(`Unsupported field: ${key}.`, 422);
    }
  }
}

function validateVisibleText(value: unknown, min: number, max: number, label: string): string {
  if (typeof value !== "string") {
    throw new EditorRouteError(`${label} is required.`, 422);
  }

  const trimmed = value.trim();
  const length = Array.from(trimmed).length;

  if (length < min || length > max || hasControlCharacter(trimmed)) {
    throw new EditorRouteError(`${label} must be ${min}-${max} visible characters.`, 422);
  }

  return trimmed;
}

function validateNullableText(value: unknown, max: number, label: string): string | null {
  if (value === null || value === "") {
    return null;
  }

  if (typeof value !== "string") {
    throw new EditorRouteError(`${label} must be text.`, 422);
  }

  const trimmed = value.trim();

  if (Array.from(trimmed).length > max || hasControlCharacter(trimmed)) {
    throw new EditorRouteError(`${label} is too long.`, 422);
  }

  return trimmed === "" ? null : trimmed;
}

function hasControlCharacter(value: string): boolean {
  for (const character of value) {
    const codePoint = character.codePointAt(0) ?? 0;

    if (codePoint < 32 || codePoint === 127) {
      return true;
    }
  }

  return false;
}

function validateProfileImageUrl(value: unknown, label: string): string | null {
  return validateProfileMediaUrl(value, label, /\.(?:jpe?g|png|webp|gif)$/iu);
}

function validateProfileVideoUrl(value: unknown, label: string): string | null {
  return validateProfileMediaUrl(value, label, /\.(?:mp4|webm)$/iu);
}

function validateProfileMediaUrl(value: unknown, label: string, extensionPattern: RegExp): string | null {
  if (value === null || value === "") {
    return null;
  }

  if (typeof value !== "string") {
    throw new EditorRouteError(`${label} URL is invalid.`, 422);
  }

  const trimmed = value.trim();

  if (trimmed.length > 500 || !trimmed.startsWith("/uploads/media/") || !extensionPattern.test(trimmed)) {
    throw new EditorRouteError(`${label} URL is invalid.`, 422);
  }

  return trimmed;
}

function validateNullableToken(value: unknown, label: string): string | null {
  if (value === null || value === "") {
    return null;
  }

  if (typeof value !== "string" || value.length > 80 || !/^[A-Za-z0-9_().#:%\s-]+$/u.test(value)) {
    throw new EditorRouteError(`${label} is invalid.`, 422);
  }

  return value.trim();
}

function validateThemeConfigJson(value: unknown): string | null {
  if (value === null || value === "") {
    return null;
  }

  if (typeof value !== "object" || Array.isArray(value)) {
    throw new EditorRouteError("Profile theme config is invalid.", 422);
  }

  return JSON.stringify(value);
}

function validateProfileLayoutPreset(value: unknown): string {
  if (typeof value !== "string" || !profileLayoutPresets.has(value)) {
    throw new EditorRouteError("Profile layout preset is invalid.", 422);
  }

  return value;
}

function validateJsonArray(value: unknown, maxItems: number, label: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new EditorRouteError(`${label} must be an array.`, 422);
  }

  if (value.length > maxItems) {
    throw new EditorRouteError(`${label} has too many items.`, 422);
  }

  return value;
}

function validateStringList(value: unknown, maxItems: number, maxLength: number, label: string): string[] {
  const items = validateJsonArray(value, maxItems, label);

  return items.map((item) => {
    if (typeof item !== "string") {
      throw new EditorRouteError(`${label} must contain text values.`, 422);
    }

    const trimmed = item.trim();

    if (trimmed === "" || Array.from(trimmed).length > maxLength) {
      throw new EditorRouteError(`${label} contains an invalid value.`, 422);
    }

    return trimmed;
  });
}

function validateModuleType(value: unknown): string {
  if (typeof value !== "string" || !profileModuleTypes.has(value)) {
    throw new EditorRouteError("Profile module type is invalid.", 422);
  }

  return value;
}

function validateModuleTitle(value: unknown): string | null {
  return validateNullableText(value ?? null, 80, "Module title");
}

function validateModuleVisibility(value: unknown): string {
  if (typeof value !== "string" || !moduleVisibilities.has(value)) {
    throw new EditorRouteError("Module visibility is invalid.", 422);
  }

  return value;
}

function validateModuleStatus(value: unknown): string {
  if (typeof value !== "string" || !moduleStatuses.has(value)) {
    throw new EditorRouteError("Module status is invalid.", 422);
  }

  return value;
}

function validateModuleConfig(value: unknown): Record<string, unknown> {
  if (value === null || value === undefined) {
    return {};
  }

  if (typeof value !== "object" || Array.isArray(value)) {
    throw new EditorRouteError("Module config must be an object.", 422);
  }

  return value as Record<string, unknown>;
}

function moduleTypeLabel(type: string): string {
  return type
    .split("_")
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function validateModuleIds(value: unknown): number[] {
  if (!Array.isArray(value)) {
    throw new EditorRouteError("Module order must be an array.", 422);
  }

  return value.map((item) => positiveInteger(item, "Module id"));
}

interface CanvasPlacement {
  id: number;
  column: number;
  row: number;
  colSpan: number;
  rowSpan: number;
  pinned: boolean;
  visible: boolean;
}

function validateCanvasPlacements(value: unknown): CanvasPlacement[] {
  if (!Array.isArray(value)) {
    throw new EditorRouteError("Canvas modules must be an array.", 422);
  }

  return value.map((item) => {
    if (typeof item !== "object" || item === null || Array.isArray(item)) {
      throw new EditorRouteError("Canvas module is invalid.", 422);
    }

    const record = item as Record<string, unknown>;
    const layout = typeof record.layout === "object" && record.layout !== null && !Array.isArray(record.layout)
      ? record.layout as Record<string, unknown>
      : record;

    return {
      id: positiveInteger(record.id, "Module id"),
      column: boundedInteger(layout.column, "Column", 1, 12),
      row: boundedInteger(layout.row, "Row", 1, 32),
      colSpan: boundedInteger(layout.colSpan, "Column span", 1, 12),
      rowSpan: boundedInteger(layout.rowSpan, "Row span", 1, 32),
      pinned: booleanValue(record.pinned),
      visible: "visible" in record ? booleanValue(record.visible) : record.visibility !== "hidden",
    };
  });
}

function validateDraftModules(value: unknown): ProfileModulePayload[] {
  if (!Array.isArray(value)) {
    throw new EditorRouteError("Draft modules must be an array.", 422);
  }

  return value.map((item, index) => {
    if (typeof item !== "object" || item === null || Array.isArray(item)) {
      throw new EditorRouteError("Draft module is invalid.", 422);
    }

    const record = item as Record<string, unknown>;
    const layout = typeof record.layout === "object" && record.layout !== null && !Array.isArray(record.layout)
      ? record.layout as Record<string, unknown>
      : null;

    return {
      id: typeof record.id === "number" && Number.isInteger(record.id) ? record.id : -1 - index,
      type: validateModuleType(record.type),
      title: validateModuleTitle(record.title),
      config: validateModuleConfig(record.config),
      visibility: validateModuleVisibility(record.visibility ?? "public"),
      position: positiveInteger(record.position ?? index + 1, "Position"),
      pinned: booleanValue(record.pinned),
      layout: layout === null
        ? null
        : {
            column: boundedInteger(layout.column, "Column", 1, 12),
            row: boundedInteger(layout.row, "Row", 1, 32),
            colSpan: boundedInteger(layout.colSpan, "Column span", 1, 12),
            rowSpan: boundedInteger(layout.rowSpan, "Row span", 1, 32),
          },
      status: validateModuleStatus(record.status ?? "active"),
      schemaVersion: profileModuleSchemaVersion,
      createdAt: stringOrNull(record.createdAt),
      updatedAt: stringOrNull(record.updatedAt),
    };
  });
}

function validateBackgroundBlur(value: unknown): string {
  return typeof value === "string" && profileBackgroundBlurs.has(value) ? value : "medium";
}

function validateCanvasGlass(value: unknown): number {
  const number = Number(value);

  return Number.isFinite(number) ? Math.max(0, Math.min(100, Math.round(number))) : 58;
}

function validateSelectedModuleId(value: unknown): number | string | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (typeof value === "number" && Number.isInteger(value)) {
    return value;
  }

  if (typeof value === "string" && /^[A-Za-z0-9_-]{1,64}$/u.test(value)) {
    return value;
  }

  throw new EditorRouteError("Selected module id is invalid.", 422);
}

function validateBadgeIdArray(value: unknown, max: number, label: string): number[] {
  if (!Array.isArray(value)) {
    throw new EditorRouteError(`${label} must be an array.`, 422);
  }

  if (value.length > max) {
    throw new EditorRouteError("Too many badges were selected.", 422);
  }

  return value.map((item) => positiveInteger(item, "Badge id"));
}

function validateBadgeKeyArray(value: unknown, max: number): string[] {
  if (!Array.isArray(value)) {
    throw new EditorRouteError("Badge keys must be an array.", 422);
  }

  if (value.length > max) {
    throw new EditorRouteError("Too many badges were selected.", 422);
  }

  return value.map((item) => {
    if (typeof item !== "string") {
      throw new EditorRouteError("Badge keys are invalid.", 422);
    }

    const key = item.trim().toLowerCase();

    if (!/^[a-z0-9_]{1,80}$/u.test(key)) {
      throw new EditorRouteError("Badge key is invalid.", 422);
    }

    return key;
  });
}

function settingsPostKind(value: unknown): "all" | "posts" | "replies" {
  return value === "posts" || value === "replies" ? value : "all";
}

function settingsPostsKindWhere(kind: "all" | "posts" | "replies"): string {
  if (kind === "posts") {
    return "AND parent_id IS NULL";
  }

  if (kind === "replies") {
    return "AND parent_id IS NOT NULL";
  }

  return "";
}

function positiveInteger(value: unknown, label: string): number {
  if (typeof value === "number" && Number.isSafeInteger(value) && value > 0) {
    return value;
  }

  if (typeof value === "string" && /^[0-9]+$/u.test(value) && Number(value) > 0) {
    return Number(value);
  }

  throw new EditorRouteError(`${label} must be numeric.`, 422);
}

function nullablePositiveInteger(value: unknown, label: string): number | null {
  if (value === null || value === "") {
    return null;
  }

  return positiveInteger(value, label);
}

function boundedInteger(value: unknown, label: string, min: number, max: number): number {
  const number = positiveInteger(value, label);

  if (number < min || number > max) {
    throw new EditorRouteError(`${label} is invalid.`, 422);
  }

  return number;
}

function extractTextEntities(body: string): Array<{
  type: "mention" | "link";
  start: number;
  length: number;
  text: string;
  url: string | null;
  targetUserId: number | null;
}> {
  const entities: Array<{
    type: "mention" | "link";
    start: number;
    length: number;
    text: string;
    url: string | null;
    targetUserId: number | null;
  }> = [];
  const urlPattern = /https?:\/\/[^\s<>"']+/giu;
  let match: RegExpExecArray | null;

  while ((match = urlPattern.exec(body)) !== null) {
    const text = match[0] ?? "";
    entities.push({
      type: "link",
      start: match.index,
      length: text.length,
      text,
      url: text,
      targetUserId: null,
    });
  }

  return entities;
}

function jsonObject(value: unknown): Record<string, unknown> {
  if (typeof value !== "string" || value === "") {
    return {};
  }

  try {
    const decoded = JSON.parse(value) as unknown;

    return typeof decoded === "object" && decoded !== null && !Array.isArray(decoded)
      ? decoded as Record<string, unknown>
      : {};
  } catch {
    return {};
  }
}

function jsonSettingsObjectValue(value: string | null | undefined): Record<string, unknown> | unknown[] {
  const decoded = jsonObjectOrArrayValue(value);

  if (decoded !== null && !Array.isArray(decoded)) {
    return decoded;
  }

  return [];
}

function jsonObjectOrArrayValue(value: string | null | undefined): Record<string, unknown> | unknown[] | null {
  if (value === null || value === undefined || value.trim() === "") {
    return null;
  }

  try {
    const decoded: unknown = JSON.parse(value);

    if (decoded !== null && typeof decoded === "object") {
      return decoded as Record<string, unknown> | unknown[];
    }
  } catch {
    return null;
  }

  return null;
}

function booleanValue(value: unknown): boolean {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return value === 1;
  }

  if (typeof value === "string") {
    return ["1", "true", "yes", "on"].includes(value.toLowerCase());
  }

  return false;
}

function numberValue(value: number | string | null | undefined): number {
  if (value === null || value === undefined || value === "") {
    return 0;
  }

  const number = Number(value);

  return Number.isFinite(number) ? number : 0;
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function nullableString(value: string | null | undefined): string | null {
  return typeof value === "string" && value !== "" ? value : null;
}

function mysqlDate(date: Date): string {
  return date.toISOString().slice(0, 19).replace("T", " ");
}

function isDuplicateError(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: unknown }).code === "ER_DUP_ENTRY";
}
