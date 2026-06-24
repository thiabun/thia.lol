import type { Pool, RowDataPacket } from "mysql2/promise";

export interface SitemapService {
  xml(): Promise<string>;
}

interface SitemapRow extends RowDataPacket {
  handle?: string | null;
  slug?: string | null;
  id?: number | string;
  public_id?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export function createSitemapService(pool: Pool, baseUrl: string): SitemapService {
  return new MariaDbSitemapService(pool, baseUrl.replace(/\/+$/u, ""));
}

class MariaDbSitemapService implements SitemapService {
  constructor(
    private readonly pool: Pool,
    private readonly baseUrl: string,
  ) {}

  async xml(): Promise<string> {
    const urls: SitemapUrl[] = [
      sitemapUrl(this.baseUrl, "/", null, "daily"),
      sitemapUrl(this.baseUrl, "/discover", null, "hourly"),
      sitemapUrl(this.baseUrl, "/search", null, "weekly"),
      sitemapUrl(this.baseUrl, "/rooms", null, "daily"),
      sitemapUrl(this.baseUrl, "/terms", null, "monthly"),
      sitemapUrl(this.baseUrl, "/privacy", null, "monthly"),
      sitemapUrl(this.baseUrl, "/community-guidelines", null, "monthly"),
      sitemapUrl(this.baseUrl, "/copyright", null, "monthly"),
      sitemapUrl(this.baseUrl, "/moderation", null, "monthly"),
    ];

    try {
      for (const row of await this.profileRows()) {
        urls.push(sitemapUrl(this.baseUrl, `/@${encodeURIComponent(stringValue(row.handle))}`, row.updated_at ?? row.created_at ?? null, "weekly"));
      }

      for (const row of await this.roomRows()) {
        urls.push(sitemapUrl(this.baseUrl, `/rooms/${encodeURIComponent(stringValue(row.slug))}`, row.updated_at ?? row.created_at ?? null, "daily"));
      }

      for (const row of await this.postRows()) {
        const identifier = stringValue(row.public_id, String(row.id ?? ""));
        urls.push(
          sitemapUrl(
            this.baseUrl,
            `/@${encodeURIComponent(stringValue(row.handle))}/posts/${encodeURIComponent(identifier)}`,
            row.updated_at ?? row.created_at ?? null,
            "weekly",
          ),
        );
      }
    } catch {
      // Keep crawler responses valid when a database-backed section is temporarily unavailable.
    }

    return renderXml(urls);
  }

  private async profileRows(): Promise<SitemapRow[]> {
    const visibilityFilter = await this.hasColumn("profiles", "visibility") ? "AND p.visibility = 'public'" : "";
    const [rows] = await this.pool.execute<SitemapRow[]>(
      `SELECT u.handle, p.created_at, p.updated_at
       FROM users u
       INNER JOIN profiles p ON p.user_id = u.id
       WHERE u.status = 'active'
         ${visibilityFilter}
       ORDER BY p.updated_at DESC
       LIMIT 1000`,
    );

    return rows;
  }

  private async roomRows(): Promise<SitemapRow[]> {
    const deletedFilter = await this.hasColumn("rooms", "deleted_at") ? "AND deleted_at IS NULL" : "";
    const [rows] = await this.pool.execute<SitemapRow[]>(
      `SELECT slug, created_at, updated_at
       FROM rooms
       WHERE visibility = 'public'
         ${deletedFilter}
       ORDER BY updated_at DESC
       LIMIT 1000`,
    );

    return rows;
  }

  private async postRows(): Promise<SitemapRow[]> {
    const profileVisibilityFilter = await this.hasColumn("profiles", "visibility") ? "AND pr.visibility = 'public'" : "";
    const publicIdSelect = await this.hasColumn("posts", "public_id") ? "p.public_id" : "NULL AS public_id";
    const roomDeletedFilter = await this.hasColumn("rooms", "deleted_at") ? "AND r.deleted_at IS NULL" : "";
    const [rows] = await this.pool.execute<SitemapRow[]>(
      `SELECT p.id, ${publicIdSelect}, p.created_at, p.updated_at, u.handle
       FROM posts p
       INNER JOIN users u ON u.id = p.author_id
       INNER JOIN profiles pr ON pr.user_id = u.id
       LEFT JOIN rooms r ON r.id = p.room_id
       WHERE p.visibility = 'public'
         AND p.status = 'published'
         AND p.deleted_at IS NULL
         AND u.status = 'active'
         ${profileVisibilityFilter}
         AND (p.room_id IS NULL OR (r.visibility = 'public' ${roomDeletedFilter}))
       ORDER BY p.updated_at DESC
       LIMIT 1000`,
    );

    return rows;
  }

  private async hasColumn(tableName: string, columnName: string): Promise<boolean> {
    const [rows] = await this.pool.execute<Array<RowDataPacket & { value: number | string }>>(
      `SELECT COUNT(*) AS value
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = ?
         AND COLUMN_NAME = ?`,
      [tableName, columnName],
    );

    return Number(rows[0]?.value ?? 0) > 0;
  }
}

interface SitemapUrl {
  loc: string;
  lastmod: string | null;
  changefreq: string;
}

function sitemapUrl(baseUrl: string, path: string, lastmod: string | null, changefreq: string): SitemapUrl {
  return {
    loc: `${baseUrl}${path}`,
    lastmod: sitemapLastmod(lastmod),
    changefreq,
  };
}

function sitemapLastmod(value: string | null): string | null {
  if (value === null || value.trim() === "") {
    return null;
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

function renderXml(urls: SitemapUrl[]): string {
  const lines = ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'];

  for (const url of urls) {
    lines.push("  <url>");
    lines.push(`    <loc>${xmlEscape(url.loc)}</loc>`);

    if (url.lastmod !== null) {
      lines.push(`    <lastmod>${xmlEscape(url.lastmod)}</lastmod>`);
    }

    lines.push(`    <changefreq>${xmlEscape(url.changefreq)}</changefreq>`);
    lines.push("  </url>");
  }

  lines.push("</urlset>");

  return `${lines.join("\n")}\n`;
}

function xmlEscape(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&apos;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function stringValue(value: string | number | null | undefined, fallback = ""): string {
  if (value === null || value === undefined) {
    return fallback;
  }

  return String(value);
}
