import type { Pool, RowDataPacket } from "mysql2/promise";

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

export interface BadgesRepository {
  listPublicBadges(): Promise<BadgePayload[]>;
}

export interface BadgeSchemaCapabilities {
  hasBadges: boolean;
  hasUserBadges: boolean;
}

export interface BadgeRow extends RowDataPacket {
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
}

type CountRow = RowDataPacket & {
  table_count?: number | string;
};

export class BadgeStorageNotReadyError extends Error {
  constructor() {
    super("Badge storage is not ready. Run pending migrations.");
    this.name = "BadgeStorageNotReadyError";
  }
}

export function badgePayloadFromRow(row: BadgeRow): BadgePayload {
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

export function buildPublicBadgesQuery(): string {
  return `${badgeDefinitionSelectSql()}
         WHERE b.is_active = 1
         ORDER BY ${badgeRaritySortSql("b")}, b.name ASC`;
}

export function badgeStorageReady(capabilities: BadgeSchemaCapabilities): boolean {
  return capabilities.hasBadges && capabilities.hasUserBadges;
}

export function createBadgesRepository(pool: Pool): BadgesRepository {
  return new MysqlBadgesRepository(pool);
}

class MysqlBadgesRepository implements BadgesRepository {
  private capabilities?: Promise<BadgeSchemaCapabilities>;

  constructor(private readonly pool: Pool) {}

  async listPublicBadges(): Promise<BadgePayload[]> {
    const capabilities = await this.schemaCapabilities();

    if (!badgeStorageReady(capabilities)) {
      throw new BadgeStorageNotReadyError();
    }

    const [rows] = await this.pool.execute<BadgeRow[]>(buildPublicBadgesQuery());

    return rows.map((row) => badgePayloadFromRow(row));
  }

  private schemaCapabilities(): Promise<BadgeSchemaCapabilities> {
    this.capabilities ??= this.detectSchemaCapabilities();

    return this.capabilities;
  }

  private async detectSchemaCapabilities(): Promise<BadgeSchemaCapabilities> {
    const [hasBadges, hasUserBadges] = await Promise.all([
      this.tableExists("badges"),
      this.tableExists("user_badges"),
    ]);

    return {
      hasBadges,
      hasUserBadges,
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
}

function badgeDefinitionSelectSql(): string {
  return `SELECT
        b.id AS badge_id,
        b.badge_key AS badge_key,
        b.name AS badge_name,
        b.description AS badge_description,
        b.rarity AS badge_rarity,
        b.source AS badge_source,
        b.icon AS badge_icon,
        b.accent AS badge_accent,
        b.is_active AS badge_is_active,
        b.created_at AS badge_created_at
      FROM badges b`;
}

function badgeRaritySortSql(alias: string): string {
  return `CASE ${alias}.rarity
      WHEN 'founder' THEN 1
      WHEN 'legendary' THEN 2
      WHEN 'epic' THEN 3
      WHEN 'rare' THEN 4
      WHEN 'common' THEN 5
      ELSE 6
    END`;
}

function badgeRarity(value: string | null | undefined): string {
  return value === "common" || value === "rare" || value === "epic" || value === "legendary" || value === "founder"
    ? value
    : "common";
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
