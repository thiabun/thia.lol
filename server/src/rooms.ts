import type { Pool, RowDataPacket } from "mysql2/promise";
import {
  canonicalRoomThemePreset,
  roomThemeConfigPayload,
  roomThemeFromLegacyAccent,
  type RoomThemeConfig,
} from "./room-themes.js";

export type RoomRole = "owner" | "moderator" | "member";
export type RoomVisibility = "public" | "private" | "invite" | "view_only";
export type RoomAccessRequestStatus = "pending" | "approved" | "denied" | "canceled";

export interface RoomViewer {
  userId: number | null;
  role?: string | null;
}

export interface UserPayload {
  id: number;
  handle: string;
  displayName: string;
  initials: string;
  aura: string;
  avatarUrl: string | null;
}

export interface RoomPayload {
  id: number;
  slug: string;
  name: string;
  summary: string;
  description: string;
  mood: string;
  members: number;
  memberCount: number;
  live: boolean;
  theme: string | null;
  themeConfig: RoomThemeConfig | null;
  iconUrl: string | null;
  bannerUrl: string | null;
  rules: string;
  visibility: RoomVisibility;
  createdBy: number | null;
  owner: UserPayload | null;
  joinedByMe: boolean;
  myRoomRole: RoomRole | null;
  viewerCanViewPosts: boolean;
  viewerCanPost: boolean;
  viewerCanReact: boolean;
  viewerCanRequestAccess: boolean;
  accessRequestStatus: RoomAccessRequestStatus | null;
  pendingAccessRequestCount?: number;
  postCount: number;
  latestActivityAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface RoomMemberPayload {
  id: number;
  role: RoomRole;
  joinedAt: string | null;
  user: UserPayload;
}

export interface RoomsRepository {
  listPublicRooms(viewer?: RoomViewer): Promise<RoomPayload[]>;
  getPublicRoom(slug: string, viewer?: RoomViewer): Promise<RoomPayload | null>;
  getPublicRoomMembers(slug: string, viewer?: RoomViewer): Promise<RoomMemberPayload[] | null>;
}

export interface RoomSchemaCapabilities {
  hasRoomMemberships: boolean;
  hasRoomCustomizationColumns: boolean;
  hasRoomThemeColumns: boolean;
  hasLegacyRoomAccentColumn: boolean;
  hasRoomSoftDeleteColumn: boolean;
  hasRoomAccessRequests: boolean;
}

export interface RoomRow extends RowDataPacket {
  room_id: number | string;
  room_slug: string;
  room_name: string;
  room_summary: string | null;
  room_mood: string | null;
  room_member_count: number | string | null;
  room_is_live: number | boolean | null;
  room_theme: string | null;
  room_theme_config_json: string | null;
  room_legacy_accent: string | null;
  room_icon_url: string | null;
  room_banner_url: string | null;
  room_rules: string | null;
  room_visibility: string | null;
  room_created_by: number | string | null;
  current_room_role: string | null;
  current_room_joined: number | boolean | null;
  current_viewer_signed_in: number | boolean | null;
  current_viewer_is_admin: number | boolean | null;
  current_room_access_request_status: string | null;
  owner_user_id: number | string | null;
  owner_handle: string | null;
  owner_display_name: string | null;
  owner_avatar_url: string | null;
  room_pending_access_request_count: number | string | null;
  room_post_count: number | string | null;
  room_latest_activity_at: Date | string | null;
  room_created_at: Date | string | null;
  room_updated_at: Date | string | null;
}

export interface RoomMemberRow extends RowDataPacket {
  id: number | string;
  role: string | null;
  joined_at: Date | string | null;
  user_id: number | string;
  handle: string;
  display_name: string | null;
  avatar_url: string | null;
}

interface RoomRecordRow extends RowDataPacket {
  id: number | string;
}

type CountRow = RowDataPacket & {
  table_count?: number | string;
  column_count?: number | string;
};

const roomSlugPattern = /^[a-z0-9-]{1,80}$/;

const roomListOrder = "room_posts.latest_activity_at DESC, rooms.is_live DESC, rooms.name ASC";
const publicRoomVisibilitySql = "('public', 'view_only')";
const listedRoomVisibilitySql = "('public', 'invite', 'view_only')";
const defaultRoomSchemaCapabilities: RoomSchemaCapabilities = {
  hasRoomMemberships: true,
  hasRoomCustomizationColumns: true,
  hasRoomThemeColumns: true,
  hasLegacyRoomAccentColumn: false,
  hasRoomSoftDeleteColumn: true,
  hasRoomAccessRequests: false,
};

export class RoomStorageNotReadyError extends Error {
  constructor() {
    super("Room membership storage is not ready. Run pending migrations.");
    this.name = "RoomStorageNotReadyError";
  }
}

export function normalizeRoomSlug(slug: string): string | null {
  try {
    const decoded = decodeURIComponent(slug);
    const normalized = decoded.toLowerCase();

    return roomSlugPattern.test(normalized) ? normalized : null;
  } catch {
    return null;
  }
}

export function initialsFromName(displayName: string): string {
  const letters = displayName
    .trim()
    .split(/\s+/)
    .filter((word) => word !== "")
    .slice(0, 2)
    .map((word) => word.slice(0, 1).toUpperCase());

  return letters.length === 0 ? "TH" : letters.join("");
}

export function roomPayloadFromRow(row: RoomRow): RoomPayload {
  const summary = stringValue(row.room_summary);
  const memberCount = numberValue(row.room_member_count);
  const owner = ownerPayloadFromRow(row);
  const visibility = roomVisibilityValue(row.room_visibility);
  const joinedByMe = booleanValue(row.current_room_joined);
  const myRoomRole = roomRoleValue(row.current_room_role);
  const viewerSignedIn = booleanValue(row.current_viewer_signed_in);
  const viewerIsAdmin = booleanValue(row.current_viewer_is_admin);
  const viewerIsStaff = viewerIsAdmin || myRoomRole === "owner" || myRoomRole === "moderator";
  const viewerCanViewPosts =
    visibility === "public" ||
    visibility === "view_only" ||
    viewerIsAdmin ||
    joinedByMe;
  const viewerCanPost =
    viewerSignedIn &&
    (visibility === "public" ||
      viewerIsStaff ||
      ((visibility === "private" || visibility === "invite") && joinedByMe));
  const viewerCanReact = viewerSignedIn && viewerCanViewPosts;
  const accessRequestStatus = roomAccessRequestStatusValue(row.current_room_access_request_status);
  const viewerCanRequestAccess =
    visibility === "invite" &&
    viewerSignedIn &&
    !joinedByMe &&
    !viewerIsAdmin &&
    accessRequestStatus !== "pending" &&
    accessRequestStatus !== "approved";
  const pendingAccessRequestCount = nullableNumberValue(row.room_pending_access_request_count);
  const visibleMemberCount = viewerCanViewPosts ? memberCount : 0;
  const visiblePostCount = viewerCanViewPosts ? numberValue(row.room_post_count) : 0;
  const rawThemeConfig = roomThemeConfigPayload(row.room_theme_config_json);
  const rowTheme = canonicalRoomThemePreset(nullableStringValue(row.room_theme));
  const theme =
    rowTheme ??
    (rawThemeConfig?.mode === "preset" ? rawThemeConfig.preset : null) ??
    roomThemeFromLegacyAccent(row.room_legacy_accent);
  const themeConfig =
    rawThemeConfig ?? (theme && theme !== "custom" ? { mode: "preset", preset: theme } : null);

  const payload: RoomPayload = {
    id: numberValue(row.room_id),
    slug: stringValue(row.room_slug),
    name: stringValue(row.room_name),
    summary,
    description: summary,
    mood: stringValue(row.room_mood),
    members: visibleMemberCount,
    memberCount: visibleMemberCount,
    live: booleanValue(row.room_is_live),
    theme,
    themeConfig,
    iconUrl: nullableStringValue(row.room_icon_url),
    bannerUrl: nullableStringValue(row.room_banner_url),
    rules: stringValue(row.room_rules),
    visibility,
    createdBy: nullableNumberValue(row.room_created_by),
    owner,
    joinedByMe,
    myRoomRole,
    viewerCanViewPosts,
    viewerCanPost,
    viewerCanReact,
    viewerCanRequestAccess,
    accessRequestStatus,
    postCount: visiblePostCount,
    latestActivityAt: nullableStringValue(row.room_latest_activity_at),
    createdAt: nullableStringValue(row.room_created_at),
    updatedAt: nullableStringValue(row.room_updated_at),
  };

  if (pendingAccessRequestCount !== null) {
    payload.pendingAccessRequestCount = pendingAccessRequestCount;
  }

  return payload;
}

export function roomMemberPayloadFromRow(row: RoomMemberRow): RoomMemberPayload {
  const handle = stringValue(row.handle);
  const displayName = stringValue(row.display_name, handle);

  return {
    id: numberValue(row.id),
    role: roomRoleValue(row.role) ?? "member",
    joinedAt: nullableStringValue(row.joined_at),
    user: {
      id: numberValue(row.user_id),
      handle,
      displayName,
      initials: initialsFromName(displayName),
      aura: "frost",
      avatarUrl: nullableStringValue(row.avatar_url),
    },
  };
}

export function buildPublicRoomsQuery(
  capabilities: RoomSchemaCapabilities = defaultRoomSchemaCapabilities,
  viewer: RoomViewer = anonymousRoomViewer,
): string {
  return `${roomSelectSql(capabilities, viewer)}
        WHERE (rooms.visibility IN ${listedRoomVisibilitySql}
          ${roomViewerAccessOrSql(capabilities, viewer)})
          ${roomNotDeletedSql(capabilities)}
        ORDER BY ${roomListOrder}`;
}

export function buildPublicRoomBySlugQuery(
  capabilities: RoomSchemaCapabilities = defaultRoomSchemaCapabilities,
  viewer: RoomViewer = anonymousRoomViewer,
): string {
  return `${roomSelectSql(capabilities, viewer)}
        WHERE rooms.slug = ?
          AND (rooms.visibility <> 'private'
            ${roomViewerAccessOrSql(capabilities, viewer)})
          ${roomNotDeletedSql(capabilities)}
        LIMIT 1`;
}

export function buildPublicRoomMemberRoomQuery(
  capabilities: RoomSchemaCapabilities = defaultRoomSchemaCapabilities,
  viewer: RoomViewer = anonymousRoomViewer,
): string {
  return `SELECT rooms.id
         FROM rooms
         ${roomViewerMembershipJoinSql(capabilities, viewer)}
         WHERE rooms.slug = ?
           AND (rooms.visibility IN ${publicRoomVisibilitySql}
             ${roomViewerAccessOrSql(capabilities, viewer)})
           ${roomNotDeletedSql(capabilities)}
         LIMIT 1`;
}

export function buildPublicRoomMembersQuery(): string {
  return `SELECT
            memberships.id,
            memberships.role,
            memberships.joined_at,
            users.id AS user_id,
            users.handle,
            profiles.display_name,
            profiles.avatar_url
         FROM room_memberships memberships
         INNER JOIN users ON users.id = memberships.user_id
         INNER JOIN profiles ON profiles.user_id = users.id
         WHERE memberships.room_id = ?
           AND memberships.banned_at IS NULL
           AND users.status = 'active'
         ORDER BY
            FIELD(memberships.role, 'owner', 'moderator', 'member'),
            memberships.joined_at ASC
         LIMIT 100`;
}

export function roomStorageReady(capabilities: RoomSchemaCapabilities): boolean {
  return capabilities.hasRoomMemberships && capabilities.hasRoomCustomizationColumns && capabilities.hasRoomSoftDeleteColumn;
}

export function createRoomsRepository(pool: Pool): RoomsRepository {
  return new MysqlRoomsRepository(pool);
}

class MysqlRoomsRepository implements RoomsRepository {
  private capabilities?: Promise<RoomSchemaCapabilities>;

  constructor(private readonly pool: Pool) {}

  async listPublicRooms(viewer: RoomViewer = anonymousRoomViewer): Promise<RoomPayload[]> {
    const capabilities = await this.schemaCapabilities();
    const [rows] = await this.pool.execute<RoomRow[]>(buildPublicRoomsQuery(capabilities, viewer));

    return rows.map((row) => roomPayloadFromRow(row));
  }

  async getPublicRoom(slug: string, viewer: RoomViewer = anonymousRoomViewer): Promise<RoomPayload | null> {
    const capabilities = await this.schemaCapabilities();
    const [rows] = await this.pool.execute<RoomRow[]>(buildPublicRoomBySlugQuery(capabilities, viewer), [slug]);
    const row = rows[0];

    return row === undefined ? null : roomPayloadFromRow(row);
  }

  async getPublicRoomMembers(slug: string, viewer: RoomViewer = anonymousRoomViewer): Promise<RoomMemberPayload[] | null> {
    const capabilities = await this.schemaCapabilities();

    if (!roomStorageReady(capabilities)) {
      throw new RoomStorageNotReadyError();
    }

    const [roomRows] = await this.pool.execute<RoomRecordRow[]>(buildPublicRoomMemberRoomQuery(capabilities, viewer), [slug]);
    const room = roomRows[0];

    if (room === undefined) {
      return null;
    }

    const [memberRows] = await this.pool.execute<RoomMemberRow[]>(buildPublicRoomMembersQuery(), [numberValue(room.id)]);

    return memberRows.map((row) => roomMemberPayloadFromRow(row));
  }

  private schemaCapabilities(): Promise<RoomSchemaCapabilities> {
    this.capabilities ??= this.detectSchemaCapabilities();

    return this.capabilities;
  }

  private async detectSchemaCapabilities(): Promise<RoomSchemaCapabilities> {
    const [
      hasRoomMemberships,
      hasIconUrlColumn,
      hasBannerUrlColumn,
      hasRulesColumn,
      hasRoomThemeColumn,
      hasRoomThemeConfigColumn,
      hasLegacyRoomAccentColumn,
      hasRoomSoftDeleteColumn,
      hasRoomAccessRequests,
    ] = await Promise.all([
      this.tableExists("room_memberships"),
      this.columnExists("rooms", "icon_url"),
      this.columnExists("rooms", "banner_url"),
      this.columnExists("rooms", "rules"),
      this.columnExists("rooms", "theme"),
      this.columnExists("rooms", "theme_config_json"),
      this.columnExists("rooms", "accent"),
      this.columnExists("rooms", "deleted_at"),
      this.tableExists("room_access_requests"),
    ]);

    return {
      hasRoomMemberships,
      hasRoomCustomizationColumns: hasIconUrlColumn && hasBannerUrlColumn && hasRulesColumn,
      hasRoomThemeColumns: hasRoomThemeColumn && hasRoomThemeConfigColumn,
      hasLegacyRoomAccentColumn,
      hasRoomSoftDeleteColumn,
      hasRoomAccessRequests,
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

function roomSelectSql(
  capabilities: RoomSchemaCapabilities,
  viewer: RoomViewer = anonymousRoomViewer,
): string {
  return `SELECT
            rooms.id AS room_id,
            rooms.slug AS room_slug,
            rooms.name AS room_name,
            rooms.summary AS room_summary,
            rooms.mood AS room_mood,
            ${roomMembershipCountSelectSql(capabilities)}
            rooms.is_live AS room_is_live,
            ${roomThemeSelectSql(capabilities)}
            ${roomCustomizationSelectSql(capabilities)}
            rooms.visibility AS room_visibility,
            rooms.created_by AS room_created_by,
            ${roomViewerSelectSql(capabilities, viewer)}
            owner.id AS owner_user_id,
            owner.handle AS owner_handle,
            owner_profile.display_name AS owner_display_name,
            owner_profile.avatar_url AS owner_avatar_url,
            ${roomAccessRequestCountSelectSql(capabilities, viewer)}
            COALESCE(room_posts.post_count, 0) AS room_post_count,
            room_posts.latest_activity_at AS room_latest_activity_at,
            rooms.created_at AS room_created_at,
            rooms.updated_at AS room_updated_at
        FROM rooms
        LEFT JOIN users owner ON owner.id = rooms.created_by
        LEFT JOIN profiles owner_profile ON owner_profile.user_id = owner.id
        ${roomMembershipCountJoinSql(capabilities)}
        ${roomViewerMembershipJoinSql(capabilities, viewer)}
        ${roomAccessRequestJoinSql(capabilities, viewer)}
        ${roomAccessRequestCountJoinSql(capabilities)}
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

function roomViewerSelectSql(
  capabilities: RoomSchemaCapabilities,
  viewer: RoomViewer,
): string {
  const signedInSql = viewer.userId === null ? "0" : "1";
  const adminSql = roomViewerIsAdmin(viewer) ? "1" : "0";

  if (!capabilities.hasRoomMemberships) {
    return `NULL AS current_room_role,
            0 AS current_room_joined,
            ${signedInSql} AS current_viewer_signed_in,
            ${adminSql} AS current_viewer_is_admin,
            ${roomAccessRequestStatusSelectSql(capabilities)},`;
  }

  return `viewer_room_membership.role AS current_room_role,
            IF(viewer_room_membership.id IS NULL, 0, 1) AS current_room_joined,
            ${signedInSql} AS current_viewer_signed_in,
            ${adminSql} AS current_viewer_is_admin,
            ${roomAccessRequestStatusSelectSql(capabilities)},`;
}

function roomAccessRequestStatusSelectSql(capabilities: RoomSchemaCapabilities): string {
  return capabilities.hasRoomAccessRequests
    ? "viewer_room_access_request.status AS current_room_access_request_status"
    : "NULL AS current_room_access_request_status";
}

function roomAccessRequestCountSelectSql(
  capabilities: RoomSchemaCapabilities,
  viewer: RoomViewer,
): string {
  if (!capabilities.hasRoomAccessRequests) {
    return "NULL AS room_pending_access_request_count,";
  }

  const staffSql = roomViewerIsAdmin(viewer)
    ? "1 = 1"
    : capabilities.hasRoomMemberships
      ? "viewer_room_membership.role IN ('owner', 'moderator')"
      : "1 = 0";

  return `CASE
              WHEN ${staffSql} THEN COALESCE(room_access_request_counts.pending_count, 0)
              ELSE NULL
            END AS room_pending_access_request_count,`;
}

function roomViewerMembershipJoinSql(
  capabilities: RoomSchemaCapabilities,
  viewer: RoomViewer,
): string {
  if (!capabilities.hasRoomMemberships) {
    return "";
  }

  return `LEFT JOIN room_memberships viewer_room_membership
            ON viewer_room_membership.room_id = rooms.id
           AND viewer_room_membership.user_id = ${roomViewerSqlValue(viewer)}
           AND viewer_room_membership.banned_at IS NULL`;
}

function roomAccessRequestJoinSql(
  capabilities: RoomSchemaCapabilities,
  viewer: RoomViewer,
): string {
  if (!capabilities.hasRoomAccessRequests) {
    return "";
  }

  return `LEFT JOIN room_access_requests viewer_room_access_request
            ON viewer_room_access_request.room_id = rooms.id
           AND viewer_room_access_request.requester_id = ${roomViewerSqlValue(viewer)}`;
}

function roomAccessRequestCountJoinSql(capabilities: RoomSchemaCapabilities): string {
  if (!capabilities.hasRoomAccessRequests) {
    return "";
  }

  return `LEFT JOIN (
            SELECT room_id, COUNT(*) AS pending_count
            FROM room_access_requests
            WHERE status = 'pending'
            GROUP BY room_id
        ) room_access_request_counts ON room_access_request_counts.room_id = rooms.id`;
}

function roomMembershipCountSelectSql(capabilities: RoomSchemaCapabilities): string {
  return capabilities.hasRoomMemberships
    ? "COALESCE(room_member_counts.member_count, 0) AS room_member_count,"
    : "rooms.member_count AS room_member_count,";
}

function roomMembershipCountJoinSql(capabilities: RoomSchemaCapabilities): string {
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

function roomThemeSelectSql(capabilities: RoomSchemaCapabilities): string {
  const legacyAccentSelect = capabilities.hasLegacyRoomAccentColumn
    ? "rooms.accent AS room_legacy_accent,"
    : "NULL AS room_legacy_accent,";

  if (capabilities.hasRoomThemeColumns) {
    return `rooms.theme AS room_theme,
            rooms.theme_config_json AS room_theme_config_json,
            ${legacyAccentSelect}`;
  }

  return `NULL AS room_theme,
            NULL AS room_theme_config_json,
            ${legacyAccentSelect}`;
}

function roomCustomizationSelectSql(capabilities: RoomSchemaCapabilities): string {
  if (capabilities.hasRoomCustomizationColumns) {
    return `rooms.icon_url AS room_icon_url,
            rooms.banner_url AS room_banner_url,
            rooms.rules AS room_rules,`;
  }

  return `NULL AS room_icon_url,
            NULL AS room_banner_url,
            NULL AS room_rules,`;
}

function roomNotDeletedSql(capabilities: RoomSchemaCapabilities): string {
  return capabilities.hasRoomSoftDeleteColumn ? "AND rooms.deleted_at IS NULL" : "";
}

function roomViewerAccessOrSql(
  capabilities: RoomSchemaCapabilities,
  viewer: RoomViewer,
): string {
  if (roomViewerIsAdmin(viewer)) {
    return " OR 1 = 1";
  }

  if (!capabilities.hasRoomMemberships || viewer.userId === null) {
    return "";
  }

  return " OR viewer_room_membership.id IS NOT NULL";
}

function ownerPayloadFromRow(row: RoomRow): UserPayload | null {
  if (row.owner_user_id === null || row.owner_handle === null) {
    return null;
  }

  const handle = stringValue(row.owner_handle);
  const displayName = stringValue(row.owner_display_name, handle);

  return {
    id: numberValue(row.owner_user_id),
    handle,
    displayName,
    initials: initialsFromName(displayName),
    aura: "frost",
    avatarUrl: nullableStringValue(row.owner_avatar_url),
  };
}

function roomRoleValue(value: string | null): RoomRole | null {
  return value === "owner" || value === "moderator" || value === "member" ? value : null;
}

function roomVisibilityValue(value: string | null): RoomVisibility {
  return value === "private" || value === "invite" || value === "view_only"
    ? value
    : "public";
}

function roomAccessRequestStatusValue(value: string | null): RoomAccessRequestStatus | null {
  return value === "pending" || value === "approved" || value === "denied" || value === "canceled"
    ? value
    : null;
}

const anonymousRoomViewer: RoomViewer = {
  userId: null,
  role: null,
};

function roomViewerIsAdmin(viewer: RoomViewer): boolean {
  return viewer.role === "admin";
}

function roomViewerSqlValue(viewer: RoomViewer): string {
  return viewer.userId === null ? "NULL" : String(Math.max(0, Math.trunc(viewer.userId)));
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

function stringValue(value: Date | string | null | undefined, fallback = ""): string {
  return nullableStringValue(value) ?? fallback;
}

function nullableStringValue(value: Date | string | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  return value;
}

function validateSchemaIdentifier(identifier: string): void {
  if (!/^[a-zA-Z0-9_]+$/.test(identifier)) {
    throw new Error("Invalid schema identifier.");
  }
}
