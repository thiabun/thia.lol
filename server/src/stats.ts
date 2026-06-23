import type { Pool, RowDataPacket } from "mysql2/promise";

export interface PublicStatsPayload {
  publicRooms: number;
  publicPosts: number;
  activeUsers: number;
  totalReactions: number;
}

export interface StatsRepository {
  getPublicStats(): Promise<PublicStatsPayload>;
}

export interface StatsSchemaCapabilities {
  hasRoomSoftDeleteColumn: boolean;
}

export interface StatsRow extends RowDataPacket {
  public_rooms: number | string | null;
  public_posts: number | string | null;
  active_users: number | string | null;
  total_reactions: number | string | null;
}

type CountRow = RowDataPacket & {
  column_count?: number | string;
};

export function statsPayloadFromRow(row: Partial<StatsRow> | undefined): PublicStatsPayload {
  return {
    publicRooms: numberValue(row?.public_rooms),
    publicPosts: numberValue(row?.public_posts),
    activeUsers: numberValue(row?.active_users),
    totalReactions: numberValue(row?.total_reactions),
  };
}

export function buildPublicStatsQuery(capabilities: StatsSchemaCapabilities): string {
  const roomsNotDeleted = roomNotDeletedSql("rooms", capabilities);
  const statRoomsNotDeleted = roomNotDeletedSql("stat_rooms", capabilities);
  const reactionRoomsNotDeleted = roomNotDeletedSql("reaction_rooms", capabilities);

  return `SELECT
            (
                SELECT COUNT(*)
                FROM rooms
                WHERE visibility = ?
                  ${roomsNotDeleted}
            ) AS public_rooms,
            (
                SELECT COUNT(*)
                FROM posts stat_posts
                LEFT JOIN rooms stat_rooms ON stat_rooms.id = stat_posts.room_id
                WHERE stat_posts.visibility = ?
                  AND stat_posts.parent_id IS NULL
                  AND stat_posts.status = ?
                  AND stat_posts.deleted_at IS NULL
                  AND (
                    stat_posts.room_id IS NULL
                    OR (stat_rooms.visibility = ? ${statRoomsNotDeleted})
                  )
            ) AS public_posts,
            (
                SELECT COUNT(*)
                FROM users
                WHERE status = ?
            ) AS active_users,
            (
                SELECT COUNT(*)
                FROM post_reactions reactions
                INNER JOIN posts reaction_posts ON reaction_posts.id = reactions.post_id
                LEFT JOIN rooms reaction_rooms ON reaction_rooms.id = reaction_posts.room_id
                WHERE reactions.type = ?
                  AND reaction_posts.visibility = ?
                  AND reaction_posts.status = ?
                  AND reaction_posts.deleted_at IS NULL
                  AND (
                    reaction_posts.room_id IS NULL
                    OR (reaction_rooms.visibility = ? ${reactionRoomsNotDeleted})
                  )
            ) AS total_reactions`;
}

export function createStatsRepository(pool: Pool): StatsRepository {
  return new MysqlStatsRepository(pool);
}

class MysqlStatsRepository implements StatsRepository {
  private capabilities?: Promise<StatsSchemaCapabilities>;

  constructor(private readonly pool: Pool) {}

  async getPublicStats(): Promise<PublicStatsPayload> {
    const capabilities = await this.schemaCapabilities();
    const [rows] = await this.pool.execute<StatsRow[]>(buildPublicStatsQuery(capabilities), [
      "public",
      "public",
      "published",
      "public",
      "active",
      "glow",
      "public",
      "published",
      "public",
    ]);

    return statsPayloadFromRow(rows[0]);
  }

  private schemaCapabilities(): Promise<StatsSchemaCapabilities> {
    this.capabilities ??= this.detectSchemaCapabilities();

    return this.capabilities;
  }

  private async detectSchemaCapabilities(): Promise<StatsSchemaCapabilities> {
    return {
      hasRoomSoftDeleteColumn: await this.columnExists("rooms", "deleted_at"),
    };
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

function roomNotDeletedSql(alias: string, capabilities: StatsSchemaCapabilities): string {
  validateSchemaIdentifier(alias);

  return capabilities.hasRoomSoftDeleteColumn ? `AND ${alias}.deleted_at IS NULL` : "";
}

function numberValue(value: number | string | null | undefined, fallback = 0): number {
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
