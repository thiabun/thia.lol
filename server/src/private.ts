import { createHmac } from "node:crypto";

import type { Pool, RowDataPacket } from "mysql2/promise";

import { initialsFromName, roomPayloadFromRow, type RoomPayload, type RoomRow, type UserPayload } from "./rooms.js";
import type { RequestSession } from "./sessions.js";

export interface PrivateReadsRepository {
  authSessionPayload(session: RequestSession): AuthSessionPayload;
  csrfTokenForSession(session: RequestSession): string;
  getSettings(session: RequestSession): Promise<SettingsPayload>;
  getOnboardingState(userId: number): Promise<OnboardingStatePayload>;
  getNotifications(userId: number): Promise<NotificationsPayload>;
  getFollowRequests(userId: number): Promise<FollowRequestPayload[]>;
  getMyPosts(userId: number, kind: string): Promise<MyPostPayload[]>;
  markNotificationsRead(userId: number, ids: number[]): Promise<NotificationsReadPayload>;
  markAllNotificationsRead(userId: number): Promise<NotificationsReadAllPayload>;
  updateOnboardingState(userId: number, body: Record<string, unknown>): Promise<OnboardingStatePayload>;
  updatePrivacy(session: RequestSession, body: Record<string, unknown>): Promise<SettingsPayload>;
  updatePreferences(session: RequestSession, body: Record<string, unknown>): Promise<SettingsPayload>;
}

export interface PrivateReadsRepositoryOptions {
  csrfSecret: string;
  encryptionConfigured: boolean;
  encryptionAvailable: boolean;
}

export interface AuthSessionPayload {
  user: {
    id: number;
    handle: string;
    email: string;
    role: string;
    status: string;
    displayName: string;
    avatarUrl: string | null;
  };
  profile: {
    displayName: string;
    bio: string;
    location: string;
    avatarUrl: string | null;
    links: unknown[];
    traits: unknown[];
  };
  csrfToken: string;
}

export interface SettingsPayload {
  account: {
    id: number;
    handle: string;
    email: string;
    displayName: string;
    status: string;
    handleChange: {
      canChange: boolean;
      nextAllowedAt: string | null;
    };
  };
  privacy: {
    profileVisibility: "public" | "private" | "followers";
  };
  preferences: {
    analyticsConsent: boolean;
    personalizationConsent: boolean;
    richEmbedsConsent: boolean;
    autoplayMediaConsent: boolean;
    sensitiveContentVisible: boolean;
    notifications: Record<string, unknown> | unknown[];
    emailNotifications: Record<string, unknown> | unknown[];
    pushNotifications: Record<string, unknown> | unknown[];
  };
  twoFactor: {
    enabled: boolean;
    backupCodeCount: number;
    encryptionConfigured: boolean;
    encryptionAvailable: boolean;
  };
  deletion: {
    requestedAt: string | null;
    scheduledFor: string | null;
    canceledAt: string | null;
    completedAt: string | null;
  } | null;
}

export interface OnboardingStatePayload {
  steps: string[];
  completedSteps: string[];
  skippedSteps: string[];
  providerLinks: Record<string, unknown>;
  finishedAt: string | null;
  dismissedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface NotificationsPayload {
  notifications: NotificationPayload[];
  unreadCount: number;
}

export interface NotificationsReadPayload {
  ids: number[];
  readAt: string;
  unreadCount: number;
}

export interface NotificationsReadAllPayload {
  readAt: string;
  unreadCount: 0;
}

export interface NotificationPayload {
  id: number;
  type: string;
  createdAt: string | null;
  readAt: string | null;
  actor: UserPayload | null;
  post: {
    id: number;
    bodySnippet: string;
    author: UserPayload | null;
    createdAt: string | null;
  } | null;
  room: RoomPayload | null;
  targetUrl: string;
  data: Record<string, unknown> | unknown[] | null;
}

export interface FollowRequestPayload {
  id: number;
  createdAt: string | null;
  user: UserPayload;
  bioSnippet: string;
}

export interface MyPostPayload {
  id: number;
  publicId: string | null;
  kind: "post" | "reply";
  body: string;
  mediaUrl: string | null;
  mediaType: "image" | "video" | null;
  mediaMime: string | null;
  mediaPosterUrl: string | null;
  status: string;
  deletedAt: string | null;
  createdAt: string | null;
}

interface CountRow extends RowDataPacket {
  table_count?: number | string;
}

interface CurrentTimestampRow extends RowDataPacket {
  now: string | null;
}

interface SettingsProfileRow extends RowDataPacket {
  visibility: string | null;
}

interface SettingsPreferencesRow extends RowDataPacket {
  analytics_consent: boolean | number | string | null;
  personalization_consent: boolean | number | string | null;
  rich_embeds_consent: boolean | number | string | null;
  autoplay_media_consent: boolean | number | string | null;
  sensitive_content_visible: boolean | number | string | null;
  notification_preferences_json: string | null;
  email_notification_preferences_json: string | null;
  push_notification_preferences_json: string | null;
}

interface AccountDeletionRow extends RowDataPacket {
  requested_at: string | null;
  scheduled_for: string | null;
  canceled_at: string | null;
  completed_at: string | null;
}

interface HandleHistoryRow extends RowDataPacket {
  created_at: string | null;
}

interface TwoFactorRow extends RowDataPacket {
  enabled_at: string | null;
}

interface BackupCodeCountRow extends RowDataPacket {
  code_count: number | string | null;
}

interface OnboardingRow extends RowDataPacket {
  completed_steps_json: string | null;
  skipped_steps_json: string | null;
  provider_links_json: string | null;
  finished_at: string | null;
  dismissed_at: string | null;
  created_at: string | null;
  updated_at: string | null;
}

interface NotificationRow extends RowDataPacket {
  id: number | string;
  user_id: number | string;
  actor_id: number | string | null;
  type: string;
  post_id: number | string | null;
  room_id: number | string | null;
  data: string | null;
  read_at: string | null;
  created_at: string | null;
  actor_handle: string | null;
  actor_display_name: string | null;
  actor_avatar_url: string | null;
  post_body: string | null;
  post_created_at: string | null;
  post_author_user_id: number | string | null;
  post_author_handle: string | null;
  post_author_display_name: string | null;
  post_author_avatar_url: string | null;
  joined_room_id: number | string | null;
  room_slug: string | null;
  room_name: string | null;
  room_summary: string | null;
  room_mood: string | null;
  room_member_count: number | string | null;
  room_is_live: number | boolean | null;
  room_theme: string | null;
  room_theme_config_json: string | null;
  room_legacy_accent: string | null;
  room_visibility: string | null;
  room_created_by: number | string | null;
  owner_user_id: number | string | null;
  owner_handle: string | null;
  owner_display_name: string | null;
  owner_avatar_url: string | null;
  room_created_at: string | null;
  room_updated_at: string | null;
}

interface UnreadCountRow extends RowDataPacket {
  unread_count: number | string | null;
}

interface FollowRequestRow extends RowDataPacket {
  id: number | string;
  created_at: string | null;
  user_id: number | string;
  handle: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
}

interface MyPostRow extends RowDataPacket {
  id: number | string;
  public_id: string | null;
  parent_id: number | string | null;
  body: string | null;
  media_url: string | null;
  media_type: string | null;
  media_mime: string | null;
  media_poster_url: string | null;
  status: string | null;
  deleted_at: string | null;
  created_at: string | null;
}

const accountHandleCooldownSeconds = 2_592_000;
const onboardingSteps = [
  "profile_basics",
  "spotify",
  "youtube",
  "twitch",
  "github",
  "apple_music",
  "profile_canvas",
  "desktop_notifications",
];

const profileIntegrationProviders = [
  "github",
  "spotify",
  "apple_music",
  "twitch",
  "youtube",
];

export class PrivateStorageNotReadyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PrivateStorageNotReadyError";
  }
}

export class PrivateRouteError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
  ) {
    super(message);
    this.name = "PrivateRouteError";
  }
}

export function createPrivateReadsRepository(
  pool: Pool,
  options: PrivateReadsRepositoryOptions,
): PrivateReadsRepository {
  return new MysqlPrivateReadsRepository(pool, options);
}

export function csrfTokenForSession(session: RequestSession, secret: string): string {
  const message = ["csrf", String(session.sessionId), String(session.userId), session.tokenHash].join("|");
  const hmac = createHmac("sha256", secret).update(message).digest();

  return hmac.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/u, "");
}

export function authSessionPayload(session: RequestSession, csrfSecret: string): AuthSessionPayload {
  const displayName = stringValue(session.displayName, session.handle);

  return {
    user: {
      id: session.userId,
      handle: session.handle,
      email: stringValue(session.email),
      role: session.role,
      status: stringValue(session.status, "active"),
      displayName,
      avatarUrl: nullableStringValue(session.avatarUrl),
    },
    profile: {
      displayName,
      bio: stringValue(session.bio),
      location: stringValue(session.location),
      avatarUrl: nullableStringValue(session.avatarUrl),
      links: jsonArrayValue(session.links),
      traits: jsonArrayValue(session.traits),
    },
    csrfToken: csrfTokenForSession(session, csrfSecret),
  };
}

export function settingsPostKind(value: unknown): "all" | "posts" | "replies" {
  return value === "posts" || value === "replies" || value === "all" ? value : "all";
}

export function notificationIdsFromPayload(payload: Record<string, unknown>): number[] {
  const ids: number[] = [];

  if (payload.id !== undefined && payload.id !== null) {
    ids.push(notificationIdFromValue(payload.id));
  }

  if (payload.ids !== undefined && payload.ids !== null) {
    if (!Array.isArray(payload.ids)) {
      throw new PrivateRouteError("Notification ids must be an array.", 422);
    }

    for (const id of payload.ids) {
      ids.push(notificationIdFromValue(id));
    }
  }

  const uniqueIds = [...new Set(ids)];

  if (uniqueIds.length === 0) {
    throw new PrivateRouteError("At least one notification id is required.", 422);
  }

  if (uniqueIds.length > 100) {
    throw new PrivateRouteError("Too many notification ids.", 422);
  }

  return uniqueIds;
}

export function onboardingStepListForStoredJson(value: string | null): string[] {
  return onboardingStepList(value);
}

export function notificationPayloadFromRow(row: NotificationRow): NotificationPayload {
  const type = row.type;
  const actor = notificationActorPayload(row);
  const post = notificationPostPayload(row);
  const room = notificationRoomPayload(row);
  const data = jsonObjectOrArrayValue(row.data);

  return {
    id: numberValue(row.id),
    type,
    createdAt: nullableStringValue(row.created_at),
    readAt: nullableStringValue(row.read_at),
    actor,
    post,
    room,
    targetUrl: notificationTargetUrl(type, actor, post, room, data),
    data,
  };
}

class MysqlPrivateReadsRepository implements PrivateReadsRepository {
  private tableCache = new Map<string, Promise<boolean>>();

  constructor(
    private readonly pool: Pool,
    private readonly options: PrivateReadsRepositoryOptions,
  ) {}

  authSessionPayload(session: RequestSession): AuthSessionPayload {
    return authSessionPayload(session, this.options.csrfSecret);
  }

  csrfTokenForSession(session: RequestSession): string {
    return csrfTokenForSession(session, this.options.csrfSecret);
  }

  async getSettings(session: RequestSession): Promise<SettingsPayload> {
    await this.requireTable("user_preferences", "Account settings storage is not ready. Run pending migrations.");
    await this.ensurePreferences(session.userId);

    const [profileRows, preferenceRows, deletion, handleChange, twoFactor] = await Promise.all([
      this.settingsProfileRows(session.userId),
      this.settingsPreferenceRows(session.userId),
      this.deletionPayload(session.userId),
      this.handleChangePayload(session.userId),
      this.twoFactorPayload(session.userId),
    ]);
    const profile = profileRows[0];
    const preferences = preferenceRows[0];
    const displayName = stringValue(session.displayName, session.handle);

    return {
      account: {
        id: session.userId,
        handle: session.handle,
        email: stringValue(session.email),
        displayName,
        status: stringValue(session.status, "active"),
        handleChange,
      },
      privacy: {
        profileVisibility: profileVisibility(profile?.visibility),
      },
      preferences: settingsPreferencesPayload(preferences),
      twoFactor,
      deletion,
    };
  }

  async getOnboardingState(userId: number): Promise<OnboardingStatePayload> {
    await this.requireTable("user_onboarding_state", "Onboarding storage is not ready. Run pending migrations.");
    await this.ensureOnboardingState(userId);

    const [rows] = await this.pool.execute<OnboardingRow[]>(
      `SELECT completed_steps_json, skipped_steps_json, provider_links_json,
              finished_at, dismissed_at, created_at, updated_at
       FROM user_onboarding_state
       WHERE user_id = ?
       LIMIT 1`,
      [userId],
    );
    const row = rows[0];

    if (row === undefined) {
      await this.ensureOnboardingState(userId);
      return this.getOnboardingState(userId);
    }

    return {
      steps: onboardingSteps,
      completedSteps: onboardingStepList(row.completed_steps_json),
      skippedSteps: onboardingStepList(row.skipped_steps_json),
      providerLinks: onboardingProviderLinks(row.provider_links_json),
      finishedAt: nullableStringValue(row.finished_at),
      dismissedAt: nullableStringValue(row.dismissed_at),
      createdAt: nullableStringValue(row.created_at),
      updatedAt: nullableStringValue(row.updated_at),
    };
  }

  async getNotifications(userId: number): Promise<NotificationsPayload> {
    await this.requireTable("notifications", "Notification storage is not ready. Run pending migrations.");
    const roomThemeSelect = await this.roomThemeSelectSql("r");

    const [notificationRows, countRows] = await Promise.all([
      this.pool.execute<NotificationRow[]>(
        `SELECT
            n.id,
            n.user_id,
            n.actor_id,
            n.type,
            n.post_id,
            n.room_id,
            n.data,
            n.read_at,
            n.created_at,
            actor.handle AS actor_handle,
            actor_profile.display_name AS actor_display_name,
            actor_profile.avatar_url AS actor_avatar_url,
            p.body AS post_body,
            p.created_at AS post_created_at,
            post_author.id AS post_author_user_id,
            post_author.handle AS post_author_handle,
            post_author_profile.display_name AS post_author_display_name,
            post_author_profile.avatar_url AS post_author_avatar_url,
            r.id AS joined_room_id,
            r.slug AS room_slug,
            r.name AS room_name,
            r.summary AS room_summary,
            r.mood AS room_mood,
            r.member_count AS room_member_count,
            r.is_live AS room_is_live,
            ${roomThemeSelect}
            r.visibility AS room_visibility,
            r.created_by AS room_created_by,
            room_owner.id AS owner_user_id,
            room_owner.handle AS owner_handle,
            room_owner_profile.display_name AS owner_display_name,
            room_owner_profile.avatar_url AS owner_avatar_url,
            0 AS room_post_count,
            NULL AS room_latest_activity_at,
            r.created_at AS room_created_at,
            r.updated_at AS room_updated_at
         FROM notifications n
         LEFT JOIN users actor ON actor.id = n.actor_id
         LEFT JOIN profiles actor_profile ON actor_profile.user_id = actor.id
         LEFT JOIN posts p ON p.id = n.post_id
         LEFT JOIN users post_author ON post_author.id = p.author_id
         LEFT JOIN profiles post_author_profile ON post_author_profile.user_id = post_author.id
         LEFT JOIN rooms r ON r.id = COALESCE(n.room_id, p.room_id)
         LEFT JOIN users room_owner ON room_owner.id = r.created_by
         LEFT JOIN profiles room_owner_profile ON room_owner_profile.user_id = room_owner.id
         WHERE n.user_id = ?
         ORDER BY n.created_at DESC, n.id DESC
         LIMIT 50`,
        [userId],
      ),
      this.pool.execute<UnreadCountRow[]>(
        `SELECT COUNT(*) AS unread_count
         FROM notifications
         WHERE user_id = ?
           AND read_at IS NULL`,
        [userId],
      ),
    ]);

    return {
      notifications: notificationRows[0].map((row) => notificationPayloadFromRow(row)),
      unreadCount: numberValue(countRows[0][0]?.unread_count),
    };
  }

  async getFollowRequests(userId: number): Promise<FollowRequestPayload[]> {
    await this.requireTable("user_follow_requests", "Follow request storage is not ready. Run pending migrations.");

    const [rows] = await this.pool.execute<FollowRequestRow[]>(
      `SELECT
          requests.id,
          requests.created_at,
          requester.id AS user_id,
          requester.handle,
          requester_profile.display_name,
          requester_profile.avatar_url,
          requester_profile.bio
       FROM user_follow_requests requests
       INNER JOIN users requester ON requester.id = requests.requester_id
       INNER JOIN profiles requester_profile ON requester_profile.user_id = requester.id
       WHERE requests.target_user_id = ?
         AND requests.status = ?
         AND requester.status = ?
       ORDER BY requests.created_at ASC`,
      [userId, "pending", "active"],
    );

    return rows.map((row) => followRequestPayloadFromRow(row));
  }

  async getMyPosts(userId: number, kind: string): Promise<MyPostPayload[]> {
    const where = kind === "posts" ? "AND parent_id IS NULL" : kind === "replies" ? "AND parent_id IS NOT NULL" : "";
    const hasPostMediaMetadataColumns =
      (await this.columnExists("posts", "media_type")) &&
      (await this.columnExists("posts", "media_mime")) &&
      (await this.columnExists("posts", "media_poster_url"));
    const postMediaMetadataSelect = hasPostMediaMetadataColumns
      ? "media_type, media_mime, media_poster_url"
      : "NULL AS media_type, NULL AS media_mime, NULL AS media_poster_url";
    const [rows] = await this.pool.execute<MyPostRow[]>(
      `SELECT id, public_id, parent_id, body, media_url, ${postMediaMetadataSelect}, status, deleted_at, created_at
       FROM posts
       WHERE author_id = ?
         ${where}
       ORDER BY created_at DESC
       LIMIT 100`,
      [userId],
    );

    return rows.map((row) => ({
      id: numberValue(row.id),
      publicId: nullableStringValue(row.public_id),
      kind: row.parent_id === null ? "post" : "reply",
      body: stringValue(row.body),
      mediaUrl: nullableStringValue(row.media_url),
      mediaType: myPostMediaType(row),
      mediaMime: nullableStringValue(row.media_mime),
      mediaPosterUrl: nullableStringValue(row.media_poster_url),
      status: stringValue(row.status),
      deletedAt: nullableStringValue(row.deleted_at),
      createdAt: nullableStringValue(row.created_at),
    }));
  }

  async markNotificationsRead(userId: number, ids: number[]): Promise<NotificationsReadPayload> {
    await this.requireTable("notifications", "Notification storage is not ready. Run pending migrations.");

    const readAt = await this.currentDatabaseTimestamp();
    const placeholders = ids.map(() => "?").join(", ");

    await this.pool.execute(
      `UPDATE notifications
       SET read_at = COALESCE(read_at, ?)
       WHERE user_id = ?
         AND id IN (${placeholders})`,
      [readAt, userId, ...ids],
    );

    return {
      ids,
      readAt,
      unreadCount: await this.unreadNotificationCount(userId),
    };
  }

  async markAllNotificationsRead(userId: number): Promise<NotificationsReadAllPayload> {
    await this.requireTable("notifications", "Notification storage is not ready. Run pending migrations.");

    const readAt = await this.currentDatabaseTimestamp();

    await this.pool.execute(
      `UPDATE notifications
       SET read_at = COALESCE(read_at, ?)
       WHERE user_id = ?
         AND read_at IS NULL`,
      [readAt, userId],
    );

    return {
      readAt,
      unreadCount: 0,
    };
  }

  async updateOnboardingState(userId: number, body: Record<string, unknown>): Promise<OnboardingStatePayload> {
    await this.requireTable("user_onboarding_state", "Onboarding storage is not ready. Run pending migrations.");
    rejectUnknownKeys(body, ["action", "step", "provider", "url"], "Unsupported onboarding field was provided.");
    await this.ensureOnboardingState(userId);

    const state = await this.getOnboardingState(userId);
    const action = onboardingAction(body.action);
    let completed = state.completedSteps;
    let skipped = state.skippedSteps;
    let providerLinks = { ...state.providerLinks };
    let finishedAt = state.finishedAt;
    let dismissedAt = state.dismissedAt;

    if (action === "complete_step") {
      const step = onboardingStep(body.step);
      completed = addOnboardingStep(completed, step);
      skipped = removeOnboardingStep(skipped, step);
    } else if (action === "skip_step") {
      const step = onboardingStep(body.step);
      skipped = addOnboardingStep(skipped, step);
      completed = removeOnboardingStep(completed, step);
    } else if (action === "save_provider_link") {
      const link = onboardingProviderLink(body.provider, body.url);
      providerLinks = {
        ...providerLinks,
        [link.provider]: link,
      };
      completed = addOnboardingStep(completed, link.provider);
      skipped = removeOnboardingStep(skipped, link.provider);
    } else if (action === "finish") {
      finishedAt = utcDatabaseTimestamp();
      dismissedAt = null;
    } else if (action === "dismiss") {
      dismissedAt = utcDatabaseTimestamp();
    } else if (action === "reset") {
      completed = [];
      skipped = [];
      providerLinks = {};
      finishedAt = null;
      dismissedAt = null;
    }

    await this.pool.execute(
      `UPDATE user_onboarding_state
       SET completed_steps_json = ?,
           skipped_steps_json = ?,
           provider_links_json = ?,
           finished_at = ?,
           dismissed_at = ?,
           updated_at = CURRENT_TIMESTAMP()
       WHERE user_id = ?`,
      [
        JSON.stringify(normalizedOnboardingStepList(completed)),
        JSON.stringify(normalizedOnboardingStepList(skipped)),
        JSON.stringify(providerLinks),
        finishedAt,
        dismissedAt,
        userId,
      ],
    );

    return this.getOnboardingState(userId);
  }

  async updatePrivacy(session: RequestSession, body: Record<string, unknown>): Promise<SettingsPayload> {
    await this.requireSettingsStorage();
    const visibility = updateProfileVisibility(body.profileVisibility ?? body.profile_visibility);

    await this.pool.execute(
      `UPDATE profiles
       SET visibility = ?,
           updated_at = CURRENT_TIMESTAMP()
       WHERE user_id = ?`,
      [visibility, session.userId],
    );

    return this.getSettings(session);
  }

  async updatePreferences(session: RequestSession, body: Record<string, unknown>): Promise<SettingsPayload> {
    await this.requireSettingsStorage();
    await this.ensurePreferences(session.userId);

    const preferences = settingsPreferencesInput(body);

    await this.pool.execute(
      `UPDATE user_preferences
       SET analytics_consent = ?,
           personalization_consent = ?,
           rich_embeds_consent = ?,
           autoplay_media_consent = ?,
           sensitive_content_visible = ?,
           notification_preferences_json = ?,
           email_notification_preferences_json = ?,
           push_notification_preferences_json = ?,
           updated_at = CURRENT_TIMESTAMP()
       WHERE user_id = ?`,
      [
        preferences.analyticsConsent ? 1 : 0,
        preferences.personalizationConsent ? 1 : 0,
        preferences.richEmbedsConsent ? 1 : 0,
        preferences.autoplayMediaConsent ? 1 : 0,
        preferences.sensitiveContentVisible ? 1 : 0,
        jsonForPhpPreferenceMap(preferences.notifications),
        jsonForPhpPreferenceMap(preferences.emailNotifications),
        jsonForPhpPreferenceMap(preferences.pushNotifications),
        session.userId,
      ],
    );

    return this.getSettings(session);
  }

  private async settingsProfileRows(userId: number): Promise<SettingsProfileRow[]> {
    const [rows] = await this.pool.execute<SettingsProfileRow[]>(
      `SELECT visibility
       FROM profiles
       WHERE user_id = ?
       LIMIT 1`,
      [userId],
    );

    return rows;
  }

  private async settingsPreferenceRows(userId: number): Promise<SettingsPreferencesRow[]> {
    const [rows] = await this.pool.execute<SettingsPreferencesRow[]>(
      `SELECT *
       FROM user_preferences
       WHERE user_id = ?
       LIMIT 1`,
      [userId],
    );

    return rows;
  }

  private async ensurePreferences(userId: number): Promise<void> {
    await this.pool.execute(
      `INSERT IGNORE INTO user_preferences
          (user_id, notification_preferences_json, email_notification_preferences_json, push_notification_preferences_json)
       VALUES (?, JSON_OBJECT(), JSON_OBJECT(), JSON_OBJECT())`,
      [userId],
    );
  }

  private async ensureOnboardingState(userId: number): Promise<void> {
    await this.pool.execute(
      `INSERT IGNORE INTO user_onboarding_state
          (user_id, completed_steps_json, skipped_steps_json, provider_links_json)
       VALUES
          (?, JSON_ARRAY(), JSON_ARRAY(), JSON_OBJECT())`,
      [userId],
    );
  }

  private async deletionPayload(userId: number): Promise<SettingsPayload["deletion"]> {
    if (!(await this.tableExists("account_deletion_requests"))) {
      return null;
    }

    const [rows] = await this.pool.execute<AccountDeletionRow[]>(
      `SELECT requested_at, scheduled_for, canceled_at, completed_at
       FROM account_deletion_requests
       WHERE user_id = ?
       ORDER BY requested_at DESC
       LIMIT 1`,
      [userId],
    );
    const row = rows[0];

    if (row === undefined) {
      return null;
    }

    return {
      requestedAt: nullableStringValue(row.requested_at),
      scheduledFor: nullableStringValue(row.scheduled_for),
      canceledAt: nullableStringValue(row.canceled_at),
      completedAt: nullableStringValue(row.completed_at),
    };
  }

  private async handleChangePayload(userId: number): Promise<SettingsPayload["account"]["handleChange"]> {
    if (!(await this.tableExists("user_handle_history"))) {
      return {
        canChange: true,
        nextAllowedAt: null,
      };
    }

    const [rows] = await this.pool.execute<HandleHistoryRow[]>(
      `SELECT created_at
       FROM user_handle_history
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT 1`,
      [userId],
    );
    const row = rows[0];

    if (row === undefined || row.created_at === null) {
      return {
        canChange: true,
        nextAllowedAt: null,
      };
    }

    const createdAt = new Date(`${row.created_at.replace(" ", "T")}Z`).getTime();
    const nextAllowedAtMs = createdAt + accountHandleCooldownSeconds * 1000;

    return {
      canChange: nextAllowedAtMs <= Date.now(),
      nextAllowedAt: new Date(nextAllowedAtMs).toISOString(),
    };
  }

  private async twoFactorPayload(userId: number): Promise<SettingsPayload["twoFactor"]> {
    const hasTwoFactorTable = await this.tableExists("user_two_factor");
    let enabled = false;

    if (hasTwoFactorTable) {
      const [rows] = await this.pool.execute<TwoFactorRow[]>(
        `SELECT enabled_at
         FROM user_two_factor
         WHERE user_id = ?
         LIMIT 1`,
        [userId],
      );
      enabled = rows[0]?.enabled_at !== null && rows[0]?.enabled_at !== undefined;
    }

    let backupCodeCount = 0;

    if (enabled && (await this.tableExists("user_two_factor_backup_codes"))) {
      const [rows] = await this.pool.execute<BackupCodeCountRow[]>(
        `SELECT COUNT(*) AS code_count
         FROM user_two_factor_backup_codes
         WHERE user_id = ?
           AND used_at IS NULL`,
        [userId],
      );
      backupCodeCount = numberValue(rows[0]?.code_count);
    }

    return {
      enabled,
      backupCodeCount,
      encryptionConfigured: this.options.encryptionConfigured,
      encryptionAvailable: this.options.encryptionAvailable,
    };
  }

  private async requireTable(tableName: string, message: string): Promise<void> {
    if (!(await this.tableExists(tableName))) {
      throw new PrivateStorageNotReadyError(message);
    }
  }

  private async requireSettingsStorage(): Promise<void> {
    if (!(await this.columnExists("profiles", "visibility")) || !(await this.tableExists("user_preferences"))) {
      throw new PrivateStorageNotReadyError("Account settings storage is not ready. Run pending migrations.");
    }
  }

  private async roomThemeSelectSql(alias: string): Promise<string> {
    validateSchemaIdentifier(alias);
    const [hasThemeColumn, hasThemeConfigColumn, hasLegacyAccentColumn] = await Promise.all([
      this.columnExists("rooms", "theme"),
      this.columnExists("rooms", "theme_config_json"),
      this.columnExists("rooms", "accent"),
    ]);
    const legacyAccentSelect = hasLegacyAccentColumn
      ? `${alias}.accent AS room_legacy_accent,`
      : "NULL AS room_legacy_accent,";

    if (hasThemeColumn && hasThemeConfigColumn) {
      return `${alias}.theme AS room_theme,
            ${alias}.theme_config_json AS room_theme_config_json,
            ${legacyAccentSelect}`;
    }

    return `NULL AS room_theme,
            NULL AS room_theme_config_json,
            ${legacyAccentSelect}`;
  }

  private tableExists(tableName: string): Promise<boolean> {
    validateSchemaIdentifier(tableName);

    const cached = this.tableCache.get(tableName);

    if (cached !== undefined) {
      return cached;
    }

    const promise = this.detectTable(tableName);
    this.tableCache.set(tableName, promise);

    return promise;
  }

  private columnExists(tableName: string, columnName: string): Promise<boolean> {
    validateSchemaIdentifier(tableName);
    validateSchemaIdentifier(columnName);

    const key = `${tableName}.${columnName}`;
    const cached = this.tableCache.get(key);

    if (cached !== undefined) {
      return cached;
    }

    const promise = this.detectColumn(tableName, columnName);
    this.tableCache.set(key, promise);

    return promise;
  }

  private async detectTable(tableName: string): Promise<boolean> {
    const [rows] = await this.pool.execute<CountRow[]>(
      `SELECT COUNT(*) AS table_count
       FROM INFORMATION_SCHEMA.TABLES
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = ?`,
      [tableName],
    );

    return numberValue(rows[0]?.table_count) > 0;
  }

  private async detectColumn(tableName: string, columnName: string): Promise<boolean> {
    const [rows] = await this.pool.execute<CountRow[]>(
      `SELECT COUNT(*) AS table_count
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = ?
         AND COLUMN_NAME = ?`,
      [tableName, columnName],
    );

    return numberValue(rows[0]?.table_count) > 0;
  }

  private async currentDatabaseTimestamp(): Promise<string> {
    const [rows] = await this.pool.execute<CurrentTimestampRow[]>("SELECT CURRENT_TIMESTAMP() AS now");

    return nullableStringValue(rows[0]?.now) ?? utcDatabaseTimestamp();
  }

  private async unreadNotificationCount(userId: number): Promise<number> {
    const [rows] = await this.pool.execute<UnreadCountRow[]>(
      `SELECT COUNT(*) AS unread_count
       FROM notifications
       WHERE user_id = ?
         AND read_at IS NULL`,
      [userId],
    );

    return numberValue(rows[0]?.unread_count);
  }
}

function settingsPreferencesPayload(row: SettingsPreferencesRow | undefined): SettingsPayload["preferences"] {
  return {
    analyticsConsent: booleanValue(row?.analytics_consent, false),
    personalizationConsent: booleanValue(row?.personalization_consent, true),
    richEmbedsConsent: booleanValue(row?.rich_embeds_consent, true),
    autoplayMediaConsent: booleanValue(row?.autoplay_media_consent, false),
    sensitiveContentVisible: booleanValue(row?.sensitive_content_visible, false),
    notifications: jsonSettingsObjectValue(row?.notification_preferences_json),
    emailNotifications: jsonSettingsObjectValue(row?.email_notification_preferences_json),
    pushNotifications: jsonSettingsObjectValue(row?.push_notification_preferences_json),
  };
}

function notificationActorPayload(row: NotificationRow): UserPayload | null {
  if (row.actor_id === null || row.actor_handle === null) {
    return null;
  }

  return compactUserPayload(
    numberValue(row.actor_id),
    row.actor_handle,
    row.actor_display_name,
    row.actor_avatar_url,
  );
}

function notificationPostPayload(row: NotificationRow): NotificationPayload["post"] {
  if (row.post_id === null || row.post_body === null) {
    return null;
  }

  let author: UserPayload | null = null;

  if (row.post_author_user_id !== null && row.post_author_handle !== null) {
    author = compactUserPayload(
      numberValue(row.post_author_user_id),
      row.post_author_handle,
      row.post_author_display_name,
      row.post_author_avatar_url,
    );
  }

  return {
    id: numberValue(row.post_id),
    bodySnippet: snippet(row.post_body, 140),
    author,
    createdAt: nullableStringValue(row.post_created_at),
  };
}

function notificationRoomPayload(row: NotificationRow): RoomPayload | null {
  if (row.joined_room_id === null || row.room_slug === null) {
    return null;
  }

  return roomPayloadFromRow({
    room_id: row.joined_room_id,
    room_slug: row.room_slug,
    room_name: stringValue(row.room_name),
    room_summary: row.room_summary,
    room_mood: row.room_mood,
    room_member_count: row.room_member_count,
    room_is_live: row.room_is_live,
    room_theme: row.room_theme,
    room_theme_config_json: row.room_theme_config_json,
    room_legacy_accent: row.room_legacy_accent,
    room_icon_url: null,
    room_banner_url: null,
    room_rules: null,
    room_visibility: row.room_visibility,
    room_created_by: row.room_created_by,
    current_room_role: null,
    current_room_joined: 0,
    owner_user_id: row.owner_user_id,
    owner_handle: row.owner_handle,
    owner_display_name: row.owner_display_name,
    owner_avatar_url: row.owner_avatar_url,
    room_post_count: 0,
    room_latest_activity_at: null,
    room_created_at: row.room_created_at,
    room_updated_at: row.room_updated_at,
  } as RoomRow);
}

function notificationTargetUrl(
  type: string,
  actor: UserPayload | null,
  post: NotificationPayload["post"],
  room: RoomPayload | null,
  data: Record<string, unknown> | unknown[] | null,
): string {
  if (type === "message") {
    return "/chat";
  }

  if (type === "mention" && data !== null && !Array.isArray(data) && typeof data.targetUrl === "string") {
    return data.targetUrl;
  }

  if (type === "badge_granted" && data !== null && !Array.isArray(data) && typeof data.profileHandle === "string") {
    return `/@${encodeURIComponent(data.profileHandle)}`;
  }

  if ((type === "follow" || type === "moot") && actor !== null) {
    return `/@${encodeURIComponent(actor.handle)}`;
  }

  if (post !== null && post.author !== null) {
    return `/@${encodeURIComponent(post.author.handle)}#post-${post.id}`;
  }

  if (room !== null) {
    return `/rooms/${encodeURIComponent(room.slug)}`;
  }

  return "/";
}

function followRequestPayloadFromRow(row: FollowRequestRow): FollowRequestPayload {
  const user = compactUserPayload(numberValue(row.user_id), row.handle, row.display_name, row.avatar_url);

  return {
    id: numberValue(row.id),
    createdAt: nullableStringValue(row.created_at),
    user,
    bioSnippet: snippet(stringValue(row.bio), 140),
  };
}

function compactUserPayload(
  id: number,
  handle: string,
  displayNameValue: string | null,
  avatarUrl: string | null,
): UserPayload {
  const displayName = stringValue(displayNameValue, handle);

  return {
    id,
    handle,
    displayName,
    initials: initialsFromName(displayName),
    aura: "frost",
    avatarUrl: nullableStringValue(avatarUrl),
  };
}

function profileVisibility(value: string | null | undefined): "public" | "private" | "followers" {
  return value === "private" || value === "followers" ? value : "public";
}

function updateProfileVisibility(value: unknown): "public" | "private" {
  return value === "private" ? "private" : "public";
}

function settingsPreferencesInput(body: Record<string, unknown>): {
  analyticsConsent: boolean;
  personalizationConsent: boolean;
  richEmbedsConsent: boolean;
  autoplayMediaConsent: boolean;
  sensitiveContentVisible: boolean;
  notifications: Record<string, boolean>;
  emailNotifications: Record<string, boolean>;
  pushNotifications: Record<string, boolean>;
} {
  return {
    analyticsConsent: settingsBool(body.analyticsConsent ?? body.analytics_consent ?? false),
    personalizationConsent: settingsBool(body.personalizationConsent ?? body.personalization_consent ?? true),
    richEmbedsConsent: settingsBool(body.richEmbedsConsent ?? body.rich_embeds_consent ?? true),
    autoplayMediaConsent: settingsBool(body.autoplayMediaConsent ?? body.autoplay_media_consent ?? false),
    sensitiveContentVisible: settingsBool(body.sensitiveContentVisible ?? body.sensitive_content_visible ?? false),
    notifications: settingsPreferenceMap(body.notifications ?? {}),
    emailNotifications: settingsPreferenceMap(body.emailNotifications ?? body.email_notifications ?? {}),
    pushNotifications: settingsPreferenceMap(body.pushNotifications ?? body.push_notifications ?? {}),
  };
}

function settingsPreferenceMap(value: unknown): Record<string, boolean> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const allowed = ["mentions", "follows", "moots", "messages", "likes", "replies", "reblogs", "badges", "reports"];
  const record = value as Record<string, unknown>;
  const result: Record<string, boolean> = {};

  for (const key of allowed) {
    if (Object.hasOwn(record, key)) {
      result[key] = settingsBool(record[key]);
    }
  }

  return result;
}

function settingsBool(value: unknown): boolean {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) && Math.trunc(value) === 1;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();

    if (trimmed !== "" && !Number.isNaN(Number(trimmed))) {
      return Number.parseInt(trimmed, 10) === 1;
    }

    return ["1", "true", "yes", "on"].includes(trimmed.toLowerCase());
  }

  return false;
}

function jsonForPhpPreferenceMap(value: Record<string, boolean>): string {
  return Object.keys(value).length === 0 ? "[]" : JSON.stringify(value);
}

function notificationIdFromValue(value: unknown): number {
  if (typeof value === "number") {
    if (!Number.isInteger(value) || value < 1) {
      throw new PrivateRouteError("Notification id must be numeric.", 422);
    }

    return value;
  }

  if (typeof value !== "string" || !/^\d+$/.test(value)) {
    throw new PrivateRouteError("Notification id must be numeric.", 422);
  }

  const id = Number(value);

  if (!Number.isSafeInteger(id) || id < 1) {
    throw new PrivateRouteError("Notification id must be numeric.", 422);
  }

  return id;
}

function onboardingAction(value: unknown): "complete_step" | "skip_step" | "save_provider_link" | "finish" | "dismiss" | "reset" {
  if (typeof value !== "string") {
    throw new PrivateRouteError("Choose an onboarding action.", 422);
  }

  const action = value.trim();

  if (
    action !== "complete_step" &&
    action !== "skip_step" &&
    action !== "save_provider_link" &&
    action !== "finish" &&
    action !== "dismiss" &&
    action !== "reset"
  ) {
    throw new PrivateRouteError("Choose an onboarding action.", 422);
  }

  return action;
}

function onboardingStep(value: unknown): string {
  if (typeof value !== "string") {
    throw new PrivateRouteError("Choose an onboarding step.", 422);
  }

  const step = value.trim();

  if (!onboardingSteps.includes(step)) {
    throw new PrivateRouteError("Choose an onboarding step.", 422);
  }

  return step;
}

function onboardingProvider(value: unknown): string {
  if (typeof value !== "string") {
    throw new PrivateRouteError("Choose a supported integration provider.", 422);
  }

  const provider = value.trim().toLowerCase() === "google" ? "youtube" : value.trim().toLowerCase();

  if (!profileIntegrationProviders.includes(provider)) {
    throw new PrivateRouteError("Choose a supported integration provider.", 422);
  }

  return provider;
}

function onboardingProviderLink(providerValue: unknown, urlValue: unknown): {
  provider: string;
  url: string;
  resourceType: string;
  resourceId: string;
  savedAt: string;
} {
  const provider = onboardingProvider(providerValue);
  const url = integrationUrl(urlValue);
  const normalized = normalizeIntegrationUrl(url, provider);

  if (normalized === null || normalized.provider !== provider) {
    throw new PrivateRouteError("Choose a supported integration URL.", 422);
  }

  return {
    provider,
    url: normalized.sourceUrl,
    resourceType: normalized.resourceType,
    resourceId: normalized.resourceId,
    savedAt: utcIsoPhp(),
  };
}

function integrationUrl(value: unknown): string {
  if (typeof value !== "string") {
    throw new PrivateRouteError("Integration URL is invalid.", 422);
  }

  const trimmed = value.trim();

  let url: URL;

  try {
    url = new URL(trimmed);
  } catch {
    throw new PrivateRouteError("Integration URL is invalid.", 422);
  }

  if (trimmed.length > 500) {
    throw new PrivateRouteError("Integration URL is invalid.", 422);
  }

  if (url.protocol !== "https:") {
    throw new PrivateRouteError("Integration URL must use HTTPS.", 422);
  }

  return trimmed;
}

function normalizeIntegrationUrl(rawUrl: string, preferredProvider: string): {
  provider: string;
  resourceType: string;
  resourceId: string;
  sourceUrl: string;
} | null {
  const url = new URL(rawUrl);
  const host = url.hostname.toLowerCase();
  const segments = url.pathname.replace(/^\/+|\/+$/gu, "") === ""
    ? []
    : url.pathname.replace(/^\/+|\/+$/gu, "").split("/");
  let resourceType = "link";
  let resourceId = "";
  let sourceUrl = rawUrl;

  if (preferredProvider === "spotify" && host === "open.spotify.com" && segments.length >= 2) {
    resourceType = segments[0]?.toLowerCase() ?? "";
    resourceId = (segments[1] ?? "").replace(/[^A-Za-z0-9]/gu, "");
    sourceUrl = `https://open.spotify.com/${resourceType}/${resourceId}`;
  } else if (
    preferredProvider === "apple_music" &&
    (host === "music.apple.com" || host === "itunes.apple.com") &&
    segments.length >= 2
  ) {
    resourceType = url.pathname.includes("/artist/")
      ? "artist"
      : url.pathname.includes("/playlist/")
        ? "playlist"
        : url.pathname.includes("/album/")
          ? "album"
          : "song";
    resourceId = lastPathIdentifier(rawUrl);
  } else if (
    preferredProvider === "youtube" &&
    ["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be", "music.youtube.com"].includes(host)
  ) {
    const playlistId = youtubeIdentifier(url.searchParams.get("list") ?? "");
    const firstSegment = segments[0] ?? "";
    let videoId = "";

    if (host === "youtu.be" && firstSegment !== "") {
      videoId = youtubeIdentifier(firstSegment);
    } else if (firstSegment === "watch") {
      videoId = youtubeIdentifier(url.searchParams.get("v") ?? "");
    } else if (["shorts", "live", "embed"].includes(firstSegment) && segments[1] !== undefined) {
      videoId = youtubeIdentifier(segments[1]);
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
      resourceId = youtubeIdentifier(firstSegment, true);
      sourceUrl = `https://www.youtube.com/${resourceId}`;
    } else if (firstSegment === "channel" && segments[1] !== undefined) {
      resourceType = "channel";
      resourceId = youtubeIdentifier(segments[1]);
      sourceUrl = `https://www.youtube.com/channel/${encodeURIComponent(resourceId)}`;
    }
  } else if (preferredProvider === "twitch" && (host === "twitch.tv" || host === "www.twitch.tv") && segments[0] !== undefined) {
    resourceType = segments[0] === "videos" && segments[1] !== undefined ? "video" : "channel";
    resourceId = resourceType === "video" ? segments[1] ?? "" : segments[0] ?? "";
  } else if (preferredProvider === "github" && (host === "github.com" || host === "www.github.com") && segments.length >= 2) {
    resourceType = "repo";
    resourceId = `${segments[0] ?? ""}/${segments[1] ?? ""}`.toLowerCase();
    sourceUrl = `https://github.com/${resourceId}`;
  }

  resourceId = resourceId.trim();

  if (resourceId === "") {
    return null;
  }

  return {
    provider: preferredProvider,
    resourceType,
    resourceId,
    sourceUrl,
  };
}

function youtubeIdentifier(value: string, allowHandle = false): string {
  const trimmed = value.trim();

  if (allowHandle && trimmed.startsWith("@")) {
    const handle = trimmed.slice(1).replace(/[^A-Za-z0-9._-]/gu, "");

    return handle === "" ? "" : `@${handle}`;
  }

  return trimmed.replace(/[^A-Za-z0-9_-]/gu, "");
}

function lastPathIdentifier(rawUrl: string): string {
  const url = new URL(rawUrl);
  const segments = url.pathname.replace(/^\/+|\/+$/gu, "").split("/").filter(Boolean);
  const last = segments.at(-1) ?? "";
  const match = /(?:^|[?&])i=(\d+)/u.exec(url.search);

  return match?.[1] ?? last;
}

function addOnboardingStep(steps: string[], step: string): string[] {
  return normalizedOnboardingStepList([...steps, step]);
}

function removeOnboardingStep(steps: string[], step: string): string[] {
  return normalizedOnboardingStepList(steps.filter((item) => item !== step));
}

function normalizedOnboardingStepList(steps: string[]): string[] {
  const allowed = new Map(onboardingSteps.map((step, index) => [step, index]));
  const unique = [...new Set(steps.filter((step) => allowed.has(step)))];

  return unique.sort((left, right) => (allowed.get(left) ?? 0) - (allowed.get(right) ?? 0));
}

function rejectUnknownKeys(body: Record<string, unknown>, allowedKeys: string[], message: string): void {
  const allowed = new Set(allowedKeys);

  for (const key of Object.keys(body)) {
    if (!allowed.has(key)) {
      throw new PrivateRouteError(message, 422);
    }
  }
}

function onboardingStepList(value: string | null): string[] {
  const decoded = jsonObjectOrArrayValue(value);

  if (!Array.isArray(decoded)) {
    return [];
  }

  const allowed = new Map(onboardingSteps.map((step, index) => [step, index]));
  const unique = [...new Set(decoded.filter((step): step is string => typeof step === "string" && allowed.has(step)))];

  return unique.sort((left, right) => (allowed.get(left) ?? 0) - (allowed.get(right) ?? 0));
}

function onboardingProviderLinks(value: string | null): Record<string, unknown> {
  const decoded = jsonObjectOrArrayValue(value);

  if (decoded === null || Array.isArray(decoded)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(decoded).filter(([provider, link]) => {
      if (!profileIntegrationProviders.includes(provider) || link === null || typeof link !== "object") {
        return false;
      }

      const url = (link as Record<string, unknown>).url;

      return typeof url === "string" && url.length <= 500 && url.startsWith("https://");
    }),
  );
}

function jsonArrayValue(value: string | null | undefined): unknown[] {
  const decoded = jsonObjectOrArrayValue(value);

  return Array.isArray(decoded) ? decoded : [];
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

function snippet(value: string, maxLength: number): string {
  const normalized = value.replace(/\s+/gu, " ").trim();

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 3).trimEnd()}...`;
}

function booleanValue(value: boolean | number | string | null | undefined, fallback: boolean): boolean {
  if (typeof value === "boolean") {
    return value;
  }

  if (value === null || value === undefined || value === "") {
    return fallback;
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

function stringValue(value: string | null | undefined, fallback = ""): string {
  return nullableStringValue(value) ?? fallback;
}

function nullableStringValue(value: string | null | undefined): string | null {
  return value ?? null;
}

function myPostMediaType(row: MyPostRow): "image" | "video" | null {
  if (row.media_type === "image" || row.media_type === "video") {
    return row.media_type;
  }

  const mediaUrl = nullableStringValue(row.media_url);

  if (mediaUrl === null) {
    return null;
  }

  return /\.(?:mp4|webm)$/iu.test(mediaUrl) ? "video" : "image";
}

function utcDatabaseTimestamp(date = new Date()): string {
  return date.toISOString().slice(0, 19).replace("T", " ");
}

function utcIsoPhp(date = new Date()): string {
  return `${date.toISOString().slice(0, 19)}+00:00`;
}

function validateSchemaIdentifier(identifier: string): void {
  if (!/^[a-zA-Z0-9_]+$/.test(identifier)) {
    throw new Error("Invalid schema identifier.");
  }
}
