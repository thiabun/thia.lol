import type { Pool, RowDataPacket } from "mysql2/promise";

import { initialsFromName, roomPayloadFromRow, type RoomPayload, type RoomRow, type UserPayload } from "./rooms.js";

export interface SearchRepository {
  search(rawQuery: unknown, viewerUserId: number | null, viewerRole?: string | null): Promise<SearchPayload>;
}

export interface SearchPayload {
  query: string;
  minQueryLength: number;
  results: {
    profiles: SearchProfilePayload[];
    rooms: RoomPayload[];
    posts: SearchPostPayload[];
  };
}

export interface SearchPostPayload {
  id: number;
  publicId: string;
  canonicalPath: string;
  bodySnippet: string;
  createdAt: string | null;
  author: UserPayload;
  room: { name: string; slug: string } | null;
}

export interface SearchProfilePayload {
  user: UserPayload;
  bioSnippet: string;
}

export interface SearchSchemaCapabilities {
  hasAccountDeletionRequests: boolean;
  hasProfileVisibilityColumn: boolean;
  hasUserBlocks: boolean;
  hasUserMutes: boolean;
  hasRoomMemberships: boolean;
  hasRoomCustomizationColumns: boolean;
  hasRoomThemeColumns: boolean;
  hasLegacyRoomAccentColumn: boolean;
  hasRoomSoftDeleteColumn: boolean;
  hasRoomAccessRequests: boolean;
  hasPostPublicIdColumn: boolean;
}

export interface SearchProfileRow extends RowDataPacket {
  user_id: number | string;
  handle: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  search_rank: number | string;
}

export interface SearchPostRow extends RowDataPacket {
  post_id: number | string;
  post_public_id: string | null;
  post_body: string | null;
  post_created_at: string | null;
  user_id: number | string;
  handle: string;
  display_name: string | null;
  avatar_url: string | null;
  room_slug: string | null;
  room_name: string | null;
  search_rank: number | string;
}

type CountRow = RowDataPacket & {
  table_count?: number | string;
  column_count?: number | string;
};

export const searchMinQueryLength = 2;
export const searchResultLimit = 8;

export function normalizeSearchQuery(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }

  const query = value.replace(/\s+/g, " ").trim();
  const characters = [...query];

  return characters.length > 80 ? characters.slice(0, 80).join("") : query;
}

export function searchPayloadFromResults(
  query: string,
  profiles: SearchProfilePayload[],
  rooms: RoomPayload[],
  posts: SearchPostPayload[] = [],
): SearchPayload {
  return {
    query,
    minQueryLength: searchMinQueryLength,
    results: {
      profiles,
      rooms,
      posts,
    },
  };
}

export function searchPostPayloadFromRow(row: SearchPostRow): SearchPostPayload {
  const id = numberValue(row.post_id);
  const handle = stringValue(row.handle);
  const displayName = stringValue(row.display_name, handle);
  const publicId = nullableStringValue(row.post_public_id) ?? String(id);
  const roomSlug = nullableStringValue(row.room_slug);
  const roomName = nullableStringValue(row.room_name);

  return {
    id,
    publicId,
    canonicalPath: `/@${encodeURIComponent(handle)}/posts/${encodeURIComponent(publicId)}`,
    bodySnippet: postBodySnippet(row.post_body),
    createdAt: nullableStringValue(row.post_created_at),
    author: {
      id: numberValue(row.user_id),
      handle,
      displayName,
      initials: initialsFromName(displayName),
      aura: "frost",
      avatarUrl: nullableStringValue(row.avatar_url),
    },
    room:
      roomSlug && roomName
        ? {
            slug: roomSlug,
            name: roomName,
          }
        : null,
  };
}

export function searchProfilePayloadFromRow(row: SearchProfileRow): SearchProfilePayload {
  const handle = stringValue(row.handle);
  const displayName = stringValue(row.display_name, handle);

  return {
    user: {
      id: numberValue(row.user_id),
      handle,
      displayName,
      initials: initialsFromName(displayName),
      aura: "frost",
      avatarUrl: nullableStringValue(row.avatar_url),
    },
    bioSnippet: profileBioSnippet(row.bio),
  };
}

export function searchLikePattern(query: string, prefixOnly: boolean): string {
  const escaped = query.toLowerCase().replace(/[\\%_]/g, (match) => `\\${match}`);

  return prefixOnly ? `${escaped}%` : `%${escaped}%`;
}

export function buildSearchProfilesQuery(
  capabilities: SearchSchemaCapabilities,
  viewerUserId: number | null,
): string {
  const viewerSql = viewerSqlValue(viewerUserId);
  const profileVisibilityFilter = capabilities.hasProfileVisibilityColumn ? "AND p.visibility = 'public'" : "";

  return `SELECT
            u.id AS user_id,
            u.handle,
            p.display_name,
            p.avatar_url,
            p.bio,
            CASE
                WHEN LOWER(u.handle) = ? THEN 0
                WHEN LOWER(u.handle) LIKE ? THEN 1
                WHEN LOWER(p.display_name) LIKE ? THEN 2
                WHEN LOWER(u.handle) LIKE ? THEN 3
                WHEN LOWER(p.display_name) LIKE ? THEN 4
                ELSE 5
            END AS search_rank
         FROM users u
         INNER JOIN profiles p ON p.user_id = u.id
         WHERE ${userPubliclyAvailableSql("u", capabilities)}
           ${profileVisibilityFilter}
           AND (${viewerSql} IS NULL OR u.id <> ${viewerSql})
           ${viewerFeedRelationshipFilterSql(viewerUserId, "u.id", capabilities)}
           AND (
                LOWER(u.handle) LIKE ?
                OR LOWER(p.display_name) LIKE ?
                OR LOWER(COALESCE(p.bio, '')) LIKE ?
           )
         ORDER BY search_rank ASC, u.created_at DESC, u.id DESC
         LIMIT ${searchResultLimit}`;
}

export function buildSearchRoomsQuery(
  capabilities: SearchSchemaCapabilities,
  viewerUserId: number | null = null,
  viewerRole: string | null = null,
): string {
  const viewerSql = viewerUserId === null ? "NULL" : String(viewerUserId);
  const viewerIsAdmin = viewerRole === "admin";
  const viewerMembershipSelect = capabilities.hasRoomMemberships
    ? `viewer_room_membership.role AS current_room_role,
            IF(viewer_room_membership.id IS NULL, 0, 1) AS current_room_joined,`
    : `NULL AS current_room_role,
            0 AS current_room_joined,`;
  const viewerMembershipJoin = capabilities.hasRoomMemberships
    ? `LEFT JOIN room_memberships viewer_room_membership
            ON viewer_room_membership.room_id = rooms.id
           AND viewer_room_membership.user_id = ${viewerSql}
           AND viewer_room_membership.banned_at IS NULL`
    : "";
  const accessRequestSelect = capabilities.hasRoomAccessRequests
    ? "viewer_room_access_request.status AS current_room_access_request_status,"
    : "NULL AS current_room_access_request_status,";
  const accessRequestJoin = capabilities.hasRoomAccessRequests
    ? `LEFT JOIN room_access_requests viewer_room_access_request
            ON viewer_room_access_request.room_id = rooms.id
           AND viewer_room_access_request.requester_id = ${viewerSql}`
    : "";
  const memberRoomSql = viewerIsAdmin
    ? "OR 1 = 1"
    : capabilities.hasRoomMemberships
      ? "OR viewer_room_membership.id IS NOT NULL"
      : "";

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
            ${viewerMembershipSelect}
            IF(${viewerSql} IS NULL, 0, 1) AS current_viewer_signed_in,
            ${viewerIsAdmin ? "1" : "0"} AS current_viewer_is_admin,
            ${accessRequestSelect}
            owner.id AS owner_user_id,
            owner.handle AS owner_handle,
            owner_profile.display_name AS owner_display_name,
            owner_profile.avatar_url AS owner_avatar_url,
            NULL AS room_pending_access_request_count,
            COALESCE(room_posts.post_count, 0) AS room_post_count,
            room_posts.latest_activity_at AS room_latest_activity_at,
            rooms.created_at AS room_created_at,
            rooms.updated_at AS room_updated_at,
            CASE
                WHEN LOWER(rooms.slug) = ? THEN 0
                WHEN LOWER(rooms.slug) LIKE ? THEN 1
                WHEN LOWER(rooms.name) LIKE ? THEN 2
                WHEN LOWER(rooms.slug) LIKE ? THEN 3
                WHEN LOWER(rooms.name) LIKE ? THEN 4
                ELSE 5
            END AS search_rank
        FROM rooms
        LEFT JOIN users owner ON owner.id = rooms.created_by
        LEFT JOIN profiles owner_profile ON owner_profile.user_id = owner.id
        ${roomMembershipCountJoinSql(capabilities)}
        ${viewerMembershipJoin}
        ${accessRequestJoin}
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
        ) room_posts ON room_posts.room_id = rooms.id
        WHERE (rooms.visibility IN ('public', 'invite', 'view_only')
          ${memberRoomSql})
          ${roomNotDeletedSql("rooms", capabilities)}
          AND (
                LOWER(rooms.slug) LIKE ?
                OR LOWER(rooms.name) LIKE ?
                OR LOWER(COALESCE(rooms.summary, '')) LIKE ?
          )
        ORDER BY search_rank ASC, room_posts.latest_activity_at DESC, rooms.name ASC
        LIMIT ${searchResultLimit}`;
}

export function buildSearchPostsQuery(
  capabilities: SearchSchemaCapabilities,
  viewerUserId: number | null,
): string {
  const profileVisibilityFilter = capabilities.hasProfileVisibilityColumn
    ? "AND pr.visibility = 'public'"
    : "";
  const publicIdSelect = capabilities.hasPostPublicIdColumn
    ? "p.public_id"
    : "NULL";

  return `SELECT
            p.id AS post_id,
            ${publicIdSelect} AS post_public_id,
            p.body AS post_body,
            p.created_at AS post_created_at,
            u.id AS user_id,
            u.handle,
            pr.display_name,
            pr.avatar_url,
            rooms.slug AS room_slug,
            rooms.name AS room_name,
            CASE
                WHEN LOWER(TRIM(p.body)) = ? THEN 0
                WHEN LOWER(p.body) LIKE ? THEN 1
                ELSE 2
            END AS search_rank
         FROM posts p
         INNER JOIN users u ON u.id = p.author_id
         INNER JOIN profiles pr ON pr.user_id = u.id
         LEFT JOIN rooms ON rooms.id = p.room_id
         WHERE p.parent_id IS NULL
           AND p.visibility = 'public'
           AND p.status = 'published'
           AND p.deleted_at IS NULL
           AND p.body IS NOT NULL
           AND TRIM(p.body) <> ''
           AND (p.room_id IS NULL OR (rooms.visibility IN ('public', 'view_only') ${roomNotDeletedSql("rooms", capabilities)}))
           AND ${userPubliclyAvailableSql("u", capabilities)}
           ${profileVisibilityFilter}
           ${viewerFeedRelationshipFilterSql(viewerUserId, "u.id", capabilities)}
           AND LOWER(p.body) LIKE ?
         ORDER BY search_rank ASC, p.created_at DESC, p.id DESC
         LIMIT ${searchResultLimit}`;
}

export function createSearchRepository(pool: Pool): SearchRepository {
  return new MysqlSearchRepository(pool);
}

class MysqlSearchRepository implements SearchRepository {
  private capabilities?: Promise<SearchSchemaCapabilities>;

  constructor(private readonly pool: Pool) {}

  async search(rawQuery: unknown, viewerUserId: number | null, viewerRole: string | null = null): Promise<SearchPayload> {
    const query = normalizeSearchQuery(rawQuery);

    if ([...query].length < searchMinQueryLength) {
      return searchPayloadFromResults(query, [], []);
    }

    const capabilities = await this.schemaCapabilities();
    const exact = query.toLowerCase();
    const likePrefix = searchLikePattern(query, true);
    const likeAnywhere = searchLikePattern(query, false);
    const [profileResult, roomResult, postResult] = await Promise.all([
      this.pool.execute<SearchProfileRow[]>(
        buildSearchProfilesQuery(capabilities, viewerUserId),
        [exact, likePrefix, likePrefix, likeAnywhere, likeAnywhere, likeAnywhere, likeAnywhere, likeAnywhere],
      ),
      this.pool.execute<(RoomRow & RowDataPacket)[]>(
        buildSearchRoomsQuery(capabilities, viewerUserId, viewerRole),
        [exact, likePrefix, likePrefix, likeAnywhere, likeAnywhere, likeAnywhere, likeAnywhere, likeAnywhere],
      ),
      this.pool.execute<SearchPostRow[]>(
        buildSearchPostsQuery(capabilities, viewerUserId),
        [exact, likePrefix, likeAnywhere],
      ),
    ]);
    const [profileRows] = profileResult;
    const [roomRows] = roomResult;
    const [postRows] = postResult;

    return searchPayloadFromResults(
      query,
      profileRows.map((row) => searchProfilePayloadFromRow(row)),
      roomRows.map((row) => roomPayloadFromRow(row)),
      postRows.map((row) => searchPostPayloadFromRow(row)),
    );
  }

  private schemaCapabilities(): Promise<SearchSchemaCapabilities> {
    this.capabilities ??= this.detectSchemaCapabilities();

    return this.capabilities;
  }

  private async detectSchemaCapabilities(): Promise<SearchSchemaCapabilities> {
    const [
      hasAccountDeletionRequests,
      hasProfileVisibilityColumn,
      hasUserBlocks,
      hasUserMutes,
      hasRoomMemberships,
      hasIconUrlColumn,
      hasBannerUrlColumn,
      hasRulesColumn,
      hasRoomThemeColumn,
      hasRoomThemeConfigColumn,
      hasLegacyRoomAccentColumn,
      hasRoomSoftDeleteColumn,
      hasRoomAccessRequests,
      hasPostPublicIdColumn,
    ] = await Promise.all([
      this.tableExists("account_deletion_requests"),
      this.columnExists("profiles", "visibility"),
      this.tableExists("user_blocks"),
      this.tableExists("user_mutes"),
      this.tableExists("room_memberships"),
      this.columnExists("rooms", "icon_url"),
      this.columnExists("rooms", "banner_url"),
      this.columnExists("rooms", "rules"),
      this.columnExists("rooms", "theme"),
      this.columnExists("rooms", "theme_config_json"),
      this.columnExists("rooms", "accent"),
      this.columnExists("rooms", "deleted_at"),
      this.tableExists("room_access_requests"),
      this.columnExists("posts", "public_id"),
    ]);

    return {
      hasAccountDeletionRequests,
      hasProfileVisibilityColumn,
      hasUserBlocks,
      hasUserMutes,
      hasRoomMemberships,
      hasRoomCustomizationColumns: hasIconUrlColumn && hasBannerUrlColumn && hasRulesColumn,
      hasRoomThemeColumns: hasRoomThemeColumn && hasRoomThemeConfigColumn,
      hasLegacyRoomAccentColumn,
      hasRoomSoftDeleteColumn,
      hasRoomAccessRequests,
      hasPostPublicIdColumn,
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

function postBodySnippet(value: string | null): string {
  const body = stringValue(value).replace(/\s+/g, " ").trim();
  const characters = [...body];

  return characters.length > 180
    ? `${characters.slice(0, 177).join("")}…`
    : body;
}

function userPubliclyAvailableSql(alias: string, capabilities: SearchSchemaCapabilities): string {
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

function viewerFeedRelationshipFilterSql(
  viewerUserId: number | null,
  authorUserSql: string,
  capabilities: SearchSchemaCapabilities,
): string {
  if (viewerUserId === null) {
    return "";
  }

  const viewerSql = viewerSqlValue(viewerUserId);
  let filters = pairNotBlockedSql(viewerSql, authorUserSql, capabilities);

  if (capabilities.hasUserMutes) {
    filters += ` AND NOT EXISTS (
            SELECT 1
            FROM user_mutes feed_mutes
            WHERE feed_mutes.muter_id = ${viewerSql}
              AND feed_mutes.muted_id = ${authorUserSql}
        )`;
  }

  return filters;
}

function pairNotBlockedSql(
  firstUserSql: string,
  secondUserSql: string,
  capabilities: SearchSchemaCapabilities,
): string {
  if (!capabilities.hasUserBlocks) {
    return "";
  }

  return ` AND NOT EXISTS (
        SELECT 1
        FROM user_blocks pair_blocks
        WHERE (pair_blocks.blocker_id = ${firstUserSql} AND pair_blocks.blocked_id = ${secondUserSql})
           OR (pair_blocks.blocker_id = ${secondUserSql} AND pair_blocks.blocked_id = ${firstUserSql})
    )`;
}

function roomMembershipCountSelectSql(capabilities: SearchSchemaCapabilities): string {
  return capabilities.hasRoomMemberships
    ? "COALESCE(room_member_counts.member_count, 0) AS room_member_count,"
    : "rooms.member_count AS room_member_count,";
}

function roomMembershipCountJoinSql(capabilities: SearchSchemaCapabilities): string {
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

function roomThemeSelectSql(capabilities: SearchSchemaCapabilities): string {
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

function roomCustomizationSelectSql(capabilities: SearchSchemaCapabilities): string {
  if (capabilities.hasRoomCustomizationColumns) {
    return `rooms.icon_url AS room_icon_url,
            rooms.banner_url AS room_banner_url,
            rooms.rules AS room_rules,`;
  }

  return `NULL AS room_icon_url,
            NULL AS room_banner_url,
            NULL AS room_rules,`;
}

function roomNotDeletedSql(alias: string, capabilities: SearchSchemaCapabilities): string {
  return capabilities.hasRoomSoftDeleteColumn ? `AND ${alias}.deleted_at IS NULL` : "";
}

function viewerSqlValue(viewerUserId: number | null): string {
  return viewerUserId === null ? "NULL" : String(Math.max(0, Math.trunc(viewerUserId)));
}

function profileBioSnippet(value: string | null | undefined): string {
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
