import type { Pool, RowDataPacket } from "mysql2/promise";

import { initialsFromName, roomPayloadFromRow, type RoomPayload, type RoomRow, type UserPayload } from "./rooms.js";

export interface SearchRepository {
  search(rawQuery: unknown, viewerUserId: number | null): Promise<SearchPayload>;
}

export interface SearchPayload {
  query: string;
  minQueryLength: number;
  results: {
    profiles: SearchProfilePayload[];
    rooms: RoomPayload[];
  };
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
  hasRoomSoftDeleteColumn: boolean;
}

export interface SearchProfileRow extends RowDataPacket {
  user_id: number | string;
  handle: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
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
): SearchPayload {
  return {
    query,
    minQueryLength: searchMinQueryLength,
    results: {
      profiles,
      rooms,
    },
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

export function buildSearchRoomsQuery(capabilities: SearchSchemaCapabilities): string {
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
            NULL AS current_room_joined,
            NULL AS current_room_role,
            owner.id AS owner_user_id,
            owner.handle AS owner_handle,
            owner_profile.display_name AS owner_display_name,
            owner_profile.avatar_url AS owner_avatar_url,
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
        WHERE rooms.visibility = 'public'
          ${roomNotDeletedSql("rooms", capabilities)}
          AND (
                LOWER(rooms.slug) LIKE ?
                OR LOWER(rooms.name) LIKE ?
                OR LOWER(COALESCE(rooms.summary, '')) LIKE ?
          )
        ORDER BY search_rank ASC, room_posts.latest_activity_at DESC, rooms.name ASC
        LIMIT ${searchResultLimit}`;
}

export function createSearchRepository(pool: Pool): SearchRepository {
  return new MysqlSearchRepository(pool);
}

class MysqlSearchRepository implements SearchRepository {
  private capabilities?: Promise<SearchSchemaCapabilities>;

  constructor(private readonly pool: Pool) {}

  async search(rawQuery: unknown, viewerUserId: number | null): Promise<SearchPayload> {
    const query = normalizeSearchQuery(rawQuery);

    if ([...query].length < searchMinQueryLength) {
      return searchPayloadFromResults(query, [], []);
    }

    const capabilities = await this.schemaCapabilities();
    const exact = query.toLowerCase();
    const likePrefix = searchLikePattern(query, true);
    const likeAnywhere = searchLikePattern(query, false);
    const [profileRows] = await this.pool.execute<SearchProfileRow[]>(
      buildSearchProfilesQuery(capabilities, viewerUserId),
      [exact, likePrefix, likePrefix, likeAnywhere, likeAnywhere, likeAnywhere, likeAnywhere, likeAnywhere],
    );
    const [roomRows] = await this.pool.execute<(RoomRow & RowDataPacket)[]>(
      buildSearchRoomsQuery(capabilities),
      [exact, likePrefix, likePrefix, likeAnywhere, likeAnywhere, likeAnywhere, likeAnywhere, likeAnywhere],
    );

    return searchPayloadFromResults(
      query,
      profileRows.map((row) => searchProfilePayloadFromRow(row)),
      roomRows.map((row) => roomPayloadFromRow(row)),
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
      hasRoomSoftDeleteColumn,
    ] = await Promise.all([
      this.tableExists("account_deletion_requests"),
      this.columnExists("profiles", "visibility"),
      this.tableExists("user_blocks"),
      this.tableExists("user_mutes"),
      this.tableExists("room_memberships"),
      this.columnExists("rooms", "icon_url"),
      this.columnExists("rooms", "banner_url"),
      this.columnExists("rooms", "rules"),
      this.columnExists("rooms", "deleted_at"),
    ]);

    return {
      hasAccountDeletionRequests,
      hasProfileVisibilityColumn,
      hasUserBlocks,
      hasUserMutes,
      hasRoomMemberships,
      hasRoomCustomizationColumns: hasIconUrlColumn && hasBannerUrlColumn && hasRulesColumn,
      hasRoomSoftDeleteColumn,
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
