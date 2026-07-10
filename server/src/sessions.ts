import { createHash } from "node:crypto";

import type { Pool, RowDataPacket } from "mysql2/promise";

export interface RequestSession {
  sessionId: number;
  userId: number;
  tokenHash: string;
  handle: string;
  email?: string;
  role: string;
  status?: string;
  displayName?: string;
  bio?: string | null;
  location?: string | null;
  avatarUrl?: string | null;
  profileTheme?: string | null;
  profileThemeConfig?: string | null;
  links?: string | null;
  traits?: string | null;
}

export interface SessionsRepository {
  currentSession(cookieHeader: string | undefined): Promise<RequestSession | null>;
}

interface SessionRow extends RowDataPacket {
  session_id: number | string;
  user_id: number | string;
  token_hash: string;
  handle: string;
  email: string;
  role: string;
  status: string;
  display_name: string | null;
  bio: string | null;
  location: string | null;
  avatar_url: string | null;
  profile_theme: string | null;
  profile_theme_config_json: string | null;
  links: string | null;
  traits: string | null;
}

export function createSessionsRepository(pool: Pool, cookieName: string): SessionsRepository {
  return new MysqlSessionsRepository(pool, cookieName);
}

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function sessionCookieTokens(cookieHeader: string | undefined, cookieName: string): string[] {
  if (typeof cookieHeader !== "string" || cookieHeader === "") {
    return [];
  }

  const tokens: string[] = [];

  for (const part of cookieHeader.split(";")) {
    const pair = part.trim().split(/=(.*)/s, 2);

    if (pair.length !== 2) {
      continue;
    }

    const [rawName, rawValue] = pair;
    const name = safeDecodeURIComponent(rawName ?? "");

    if (name !== cookieName) {
      continue;
    }

    const value = safeDecodeURIComponent(rawValue ?? "");

    if (value !== "") {
      tokens.push(value);
    }
  }

  return [...new Set(tokens)];
}

class MysqlSessionsRepository implements SessionsRepository {
  constructor(
    private readonly pool: Pool,
    private readonly cookieName: string,
  ) {}

  async currentSession(cookieHeader: string | undefined): Promise<RequestSession | null> {
    const tokens = sessionCookieTokens(cookieHeader, this.cookieName);

    for (const token of tokens) {
      const tokenHash = hashSessionToken(token);
      const session = await this.sessionByTokenHash(tokenHash);

      if (session !== null) {
        await this.pool.execute(
          `UPDATE sessions
           SET last_seen_at = UTC_TIMESTAMP()
           WHERE id = ?`,
          [session.sessionId],
        );

        return session;
      }
    }

    return null;
  }

  private async sessionByTokenHash(tokenHash: string): Promise<RequestSession | null> {
    const [rows] = await this.pool.execute<SessionRow[]>(
      `SELECT
            s.id AS session_id,
            s.user_id,
            s.token_hash,
            u.handle,
            u.email,
            u.role,
            u.status,
            p.display_name,
            p.bio,
            p.location,
            p.avatar_url,
            p.profile_theme,
            p.profile_theme_config_json,
            p.links,
            p.traits
         FROM sessions s
         INNER JOIN users u ON u.id = s.user_id
         INNER JOIN profiles p ON p.user_id = u.id
         WHERE s.token_hash = ?
           AND s.expires_at > UTC_TIMESTAMP()
           AND u.status = 'active'
         LIMIT 1`,
      [tokenHash],
    );
    const row = rows[0];

    if (row === undefined) {
      return null;
    }

    return {
      sessionId: numberValue(row.session_id),
      userId: numberValue(row.user_id),
      tokenHash: row.token_hash,
      handle: row.handle,
      email: row.email,
      role: row.role,
      status: row.status,
      displayName: row.display_name ?? row.handle,
      bio: row.bio,
      location: row.location,
      avatarUrl: row.avatar_url,
      profileTheme: row.profile_theme,
      profileThemeConfig: row.profile_theme_config_json,
      links: row.links,
      traits: row.traits,
    };
  }
}

function safeDecodeURIComponent(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function numberValue(value: number | string | null | undefined): number {
  if (value === null || value === undefined || value === "") {
    return 0;
  }

  const number = Number(value);

  return Number.isFinite(number) ? number : 0;
}
