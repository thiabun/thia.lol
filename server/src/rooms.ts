import type { Pool, RowDataPacket } from "mysql2/promise";

export type RoomRole = "owner" | "moderator" | "member";

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
  accent: string;
  iconUrl: string | null;
  bannerUrl: string | null;
  rules: string;
  visibility: string;
  createdBy: number | null;
  owner: UserPayload | null;
  joinedByMe: boolean;
  myRoomRole: RoomRole | null;
  postCount: number;
  latestActivityAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface RoomsRepository {
  listPublicRooms(): Promise<RoomPayload[]>;
  getPublicRoom(slug: string): Promise<RoomPayload | null>;
}

export interface RoomSchemaCapabilities {
  hasRoomMemberships: boolean;
  hasRoomCustomizationColumns: boolean;
  hasRoomSoftDeleteColumn: boolean;
}

export interface RoomRow extends RowDataPacket {
  room_id: number | string;
  room_slug: string;
  room_name: string;
  room_summary: string | null;
  room_mood: string | null;
  room_member_count: number | string | null;
  room_is_live: number | boolean | null;
  room_accent: string | null;
  room_icon_url: string | null;
  room_banner_url: string | null;
  room_rules: string | null;
  room_visibility: string | null;
  room_created_by: number | string | null;
  current_room_role: string | null;
  current_room_joined: number | boolean | null;
  owner_user_id: number | string | null;
  owner_handle: string | null;
  owner_display_name: string | null;
  owner_avatar_url: string | null;
  room_post_count: number | string | null;
  room_latest_activity_at: Date | string | null;
  room_created_at: Date | string | null;
  room_updated_at: Date | string | null;
}

type CountRow = RowDataPacket & {
  table_count?: number | string;
  column_count?: number | string;
};

const roomSlugPattern = /^[a-z0-9-]{1,80}$/;

const roomListOrder = "room_posts.latest_activity_at DESC, rooms.is_live DESC, rooms.name ASC";

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

  return {
    id: numberValue(row.room_id),
    slug: stringValue(row.room_slug),
    name: stringValue(row.room_name),
    summary,
    description: summary,
    mood: stringValue(row.room_mood),
    members: memberCount,
    memberCount,
    live: booleanValue(row.room_is_live),
    accent: stringValue(row.room_accent),
    iconUrl: nullableStringValue(row.room_icon_url),
    bannerUrl: nullableStringValue(row.room_banner_url),
    rules: stringValue(row.room_rules),
    visibility: stringValue(row.room_visibility, "public"),
    createdBy: nullableNumberValue(row.room_created_by),
    owner,
    joinedByMe: booleanValue(row.current_room_joined),
    myRoomRole: roomRoleValue(row.current_room_role),
    postCount: numberValue(row.room_post_count),
    latestActivityAt: nullableStringValue(row.room_latest_activity_at),
    createdAt: nullableStringValue(row.room_created_at),
    updatedAt: nullableStringValue(row.room_updated_at),
  };
}

export function buildPublicRoomsQuery(capabilities: RoomSchemaCapabilities): string {
  return `${roomSelectSql(capabilities)}
        WHERE rooms.visibility = 'public'
          ${roomNotDeletedSql(capabilities)}
        ORDER BY ${roomListOrder}`;
}

export function buildPublicRoomBySlugQuery(capabilities: RoomSchemaCapabilities): string {
  return `${roomSelectSql(capabilities)}
        WHERE rooms.slug = ?
          AND rooms.visibility = 'public'
          ${roomNotDeletedSql(capabilities)}
        LIMIT 1`;
}

export function createRoomsRepository(pool: Pool): RoomsRepository {
  return new MysqlRoomsRepository(pool);
}

class MysqlRoomsRepository implements RoomsRepository {
  private capabilities?: Promise<RoomSchemaCapabilities>;

  constructor(private readonly pool: Pool) {}

  async listPublicRooms(): Promise<RoomPayload[]> {
    const capabilities = await this.schemaCapabilities();
    const [rows] = await this.pool.execute<RoomRow[]>(buildPublicRoomsQuery(capabilities));

    return rows.map((row) => roomPayloadFromRow(row));
  }

  async getPublicRoom(slug: string): Promise<RoomPayload | null> {
    const capabilities = await this.schemaCapabilities();
    const [rows] = await this.pool.execute<RoomRow[]>(buildPublicRoomBySlugQuery(capabilities), [slug]);
    const row = rows[0];

    return row === undefined ? null : roomPayloadFromRow(row);
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
      hasRoomSoftDeleteColumn,
    ] = await Promise.all([
      this.tableExists("room_memberships"),
      this.columnExists("rooms", "icon_url"),
      this.columnExists("rooms", "banner_url"),
      this.columnExists("rooms", "rules"),
      this.columnExists("rooms", "deleted_at"),
    ]);

    return {
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

function roomSelectSql(capabilities: RoomSchemaCapabilities): string {
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
