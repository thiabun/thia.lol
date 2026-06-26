import type { Pool, RowDataPacket } from "mysql2/promise";

import type { RequestSession } from "./sessions.js";

export type GrowthShareKind = "profile" | "post" | "room";

export interface GrowthAttributionPayload {
  source: string | null;
  medium: string | null;
  campaign: string | null;
  shareKind: GrowthShareKind | null;
  shareRef: string | null;
  referrerHost: string | null;
  landingPath: string | null;
}

export interface AdminGrowthMetricBucket {
  key: string;
  count: number;
}

export interface AdminGrowthSharedEntityMetric {
  shareKind: GrowthShareKind;
  shareRef: string;
  count: number;
}

export interface AdminGrowthMetricsPayload {
  windowDays: number;
  totalSignups: number;
  attributedSignups: number;
  bySource: AdminGrowthMetricBucket[];
  byCampaign: AdminGrowthMetricBucket[];
  byShareKind: AdminGrowthMetricBucket[];
  topSharedEntities: AdminGrowthSharedEntityMetric[];
}

export interface GrowthRepository {
  adminMetrics(session: RequestSession, windowDays?: number): Promise<AdminGrowthMetricsPayload>;
}

export class GrowthRouteError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
  ) {
    super(message);
    this.name = "GrowthRouteError";
  }
}

interface SummaryRow extends RowDataPacket {
  total_signups: number | string | null;
  attributed_signups: number | string | null;
}

interface BucketRow extends RowDataPacket {
  bucket_key: string | null;
  bucket_count: number | string | null;
}

interface SharedEntityRow extends RowDataPacket {
  share_kind: string | null;
  share_ref: string | null;
  bucket_count: number | string | null;
}

type CountRow = RowDataPacket & {
  table_count?: number | string;
};

const attributionMax = {
  source: 80,
  medium: 80,
  campaign: 120,
  shareRef: 120,
  referrerHost: 255,
  landingPath: 255,
};

export function createGrowthRepository(pool: Pool): GrowthRepository {
  return new MysqlGrowthRepository(pool);
}

export function normalizeSignupAttribution(value: unknown): GrowthAttributionPayload | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const share = normalizeShare(record.shareKind ?? record.share_kind, record.shareRef ?? record.share_ref);
  const attribution: GrowthAttributionPayload = {
    source: normalizeToken(record.source, attributionMax.source),
    medium: normalizeToken(record.medium, attributionMax.medium),
    campaign: normalizeToken(record.campaign, attributionMax.campaign),
    shareKind: share.kind,
    shareRef: share.ref,
    referrerHost: normalizeHost(record.referrerHost ?? record.referrer_host),
    landingPath: normalizeLandingPath(record.landingPath ?? record.landing_path),
  };

  return growthAttributionHasValue(attribution) ? attribution : null;
}

export function growthAttributionHasValue(value: GrowthAttributionPayload): boolean {
  return Object.values(value).some((item) => item !== null && item !== "");
}

class MysqlGrowthRepository implements GrowthRepository {
  private tableExistsPromise?: Promise<boolean>;

  constructor(private readonly pool: Pool) {}

  async adminMetrics(session: RequestSession, windowDays = 30): Promise<AdminGrowthMetricsPayload> {
    if (session.role !== "admin") {
      throw new GrowthRouteError("Admin access required.", 403);
    }

    const normalizedWindowDays = normalizeWindowDays(windowDays);

    if (!(await this.tableExists())) {
      return emptyMetrics(normalizedWindowDays);
    }

    const cutoff = mysqlDate(new Date(Date.now() - normalizedWindowDays * 24 * 60 * 60 * 1000));
    const [summaryRows] = await this.pool.execute<SummaryRow[]>(
      `SELECT
          COUNT(*) AS total_signups,
          SUM(source IS NOT NULL OR medium IS NOT NULL OR campaign IS NOT NULL OR share_kind IS NOT NULL OR referrer_host IS NOT NULL OR landing_path IS NOT NULL) AS attributed_signups
       FROM user_signup_attributions
       WHERE created_at >= ?`,
      [cutoff],
    );
    const [sourceRows, campaignRows, shareKindRows, sharedEntityRows] = await Promise.all([
      this.bucketRows("COALESCE(NULLIF(source, ''), 'direct')", cutoff),
      this.bucketRows("COALESCE(NULLIF(campaign, ''), 'none')", cutoff),
      this.bucketRows("COALESCE(share_kind, 'none')", cutoff),
      this.sharedEntityRows(cutoff),
    ]);

    return {
      windowDays: normalizedWindowDays,
      totalSignups: numberValue(summaryRows[0]?.total_signups),
      attributedSignups: numberValue(summaryRows[0]?.attributed_signups),
      bySource: sourceRows.map(metricBucketFromRow),
      byCampaign: campaignRows.map(metricBucketFromRow),
      byShareKind: shareKindRows.map(metricBucketFromRow),
      topSharedEntities: sharedEntityRows
        .filter((row) => isGrowthShareKind(row.share_kind) && stringValue(row.share_ref) !== "")
        .map((row) => ({
          shareKind: row.share_kind as GrowthShareKind,
          shareRef: stringValue(row.share_ref),
          count: numberValue(row.bucket_count),
        })),
    };
  }

  private async bucketRows(expression: string, cutoff: string): Promise<BucketRow[]> {
    const [rows] = await this.pool.execute<BucketRow[]>(
      `SELECT ${expression} AS bucket_key, COUNT(*) AS bucket_count
       FROM user_signup_attributions
       WHERE created_at >= ?
       GROUP BY bucket_key
       ORDER BY bucket_count DESC, bucket_key ASC
       LIMIT 12`,
      [cutoff],
    );

    return rows;
  }

  private async sharedEntityRows(cutoff: string): Promise<SharedEntityRow[]> {
    const [rows] = await this.pool.execute<SharedEntityRow[]>(
      `SELECT share_kind, share_ref, COUNT(*) AS bucket_count
       FROM user_signup_attributions
       WHERE created_at >= ?
         AND share_kind IS NOT NULL
         AND share_ref IS NOT NULL
       GROUP BY share_kind, share_ref
       ORDER BY bucket_count DESC, share_kind ASC, share_ref ASC
       LIMIT 12`,
      [cutoff],
    );

    return rows;
  }

  private tableExists(): Promise<boolean> {
    this.tableExistsPromise ??= this.detectTable();

    return this.tableExistsPromise;
  }

  private async detectTable(): Promise<boolean> {
    const [rows] = await this.pool.execute<CountRow[]>(
      `SELECT COUNT(*) AS table_count
       FROM INFORMATION_SCHEMA.TABLES
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'user_signup_attributions'`,
    );

    return numberValue(rows[0]?.table_count) > 0;
  }
}

function normalizeToken(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_.:-]+/gu, "-")
    .replace(/^-+|-+$/gu, "")
    .slice(0, maxLength);

  return normalized === "" ? null : normalized;
}

function normalizeShare(kindValue: unknown, refValue: unknown): { kind: GrowthShareKind | null; ref: string | null } {
  if (!isGrowthShareKind(kindValue)) {
    return { kind: null, ref: null };
  }

  const ref = normalizeShareRef(refValue, kindValue);

  return ref === null ? { kind: null, ref: null } : { kind: kindValue, ref };
}

function normalizeShareRef(value: unknown, kind: GrowthShareKind): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toLowerCase().replace(/^@/u, "").slice(0, attributionMax.shareRef);
  const valid =
    kind === "room"
      ? /^[a-z0-9-]{1,80}$/u.test(normalized)
      : /^[a-z0-9_-]{1,120}$/u.test(normalized);

  return valid ? normalized : null;
}

function normalizeHost(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const host = value.trim().toLowerCase().replace(/\.$/u, "").slice(0, attributionMax.referrerHost);

  if (host === "" || !/^[a-z0-9.-]+$/u.test(host) || host.includes("..")) {
    return null;
  }

  return host;
}

function normalizeLandingPath(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const path = value.trim().slice(0, attributionMax.landingPath);

  if (!path.startsWith("/") || path.startsWith("//") || hasControlCharacter(path)) {
    return null;
  }

  return path.split(/[?#]/u, 1)[0] || null;
}

function hasControlCharacter(value: string): boolean {
  for (const character of value) {
    const code = character.charCodeAt(0);

    if (code <= 31 || code === 127) {
      return true;
    }
  }

  return false;
}

function isGrowthShareKind(value: unknown): value is GrowthShareKind {
  return value === "profile" || value === "post" || value === "room";
}

function metricBucketFromRow(row: BucketRow): AdminGrowthMetricBucket {
  return {
    key: stringValue(row.bucket_key, "none"),
    count: numberValue(row.bucket_count),
  };
}

function emptyMetrics(windowDays: number): AdminGrowthMetricsPayload {
  return {
    windowDays,
    totalSignups: 0,
    attributedSignups: 0,
    bySource: [],
    byCampaign: [],
    byShareKind: [],
    topSharedEntities: [],
  };
}

function normalizeWindowDays(value: number): number {
  return Number.isFinite(value) ? Math.min(365, Math.max(1, Math.trunc(value))) : 30;
}

function mysqlDate(date: Date): string {
  return date.toISOString().slice(0, 19).replace("T", " ");
}

function stringValue(value: string | number | null | undefined, fallback = ""): string {
  if (value === null || value === undefined) {
    return fallback;
  }

  return String(value);
}

function numberValue(value: number | string | null | undefined, fallback = 0): number {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }

  const number = Number(value);

  return Number.isFinite(number) ? number : fallback;
}
