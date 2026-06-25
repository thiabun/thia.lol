import { createHash, timingSafeEqual } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import type { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";

import { hashPhpPassword } from "./auth.js";
import type { RequestSession } from "./sessions.js";

export class OpsRouteError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
  ) {
    super(message);
    this.name = "OpsRouteError";
  }
}

export interface SetupPayload {
  activated: true;
  handle: "thia";
}

export interface MigrationStatusPayload {
  path: "migrations";
  migrations: MigrationStatusRow[];
}

export interface MigrationRunPayload {
  path: "migrations";
  appliedCount: number;
  skippedCount: number;
  migrations: MigrationRunRow[];
}

export interface MigrationStatusRow {
  migration: string;
  checksum: string;
  applied: boolean;
  appliedAt: string | null;
  checksumMismatch?: true;
  appliedChecksum?: string;
}

export interface MigrationRunRow {
  migration: string;
  checksum: string;
  status: "applied" | "skipped";
  appliedAt?: string | null;
}

export interface AuthDiagnosticsPayload {
  cookieName: string;
  rawCookieHeaderPresent: boolean;
  rawCookieCandidateCount: number;
  configuredCookieDomain: string | null;
  requestHost: string;
  nodeRuntime: true;
}

export interface OpsService {
  activateThia(body: Record<string, unknown>, setupToken: string): Promise<SetupPayload>;
  migrationStatus(session: RequestSession, migrationToken: string): Promise<MigrationStatusPayload>;
  runMigrations(session: RequestSession, migrationToken: string): Promise<MigrationRunPayload>;
  authDiagnostics(cookieHeader: string | undefined, host: string, migrationToken: string): AuthDiagnosticsPayload;
}

export interface OpsServiceOptions {
  setupToken: string;
  migrationToken: string;
  migrationsDir: string;
  sessionCookieName: string;
  sessionCookieDomain: string | null;
}

interface AppliedMigrationRow extends RowDataPacket {
  migration: string;
  checksum: string;
  applied_at: string | null;
}

export function createOpsService(pool: Pool, options: OpsServiceOptions): OpsService {
  return new NodeOpsService(pool, options);
}

class NodeOpsService implements OpsService {
  constructor(
    private readonly pool: Pool,
    private readonly options: OpsServiceOptions,
  ) {}

  async activateThia(body: Record<string, unknown>, setupToken: string): Promise<SetupPayload> {
    this.requireSetupToken(setupToken);
    const email = validateEmail(body.email);
    const password = validatePassword(body.password);
    const [result] = await this.pool.execute<ResultSetHeader>(
      `UPDATE users
       SET email = ?,
           password_hash = ?,
           role = 'admin',
           status = 'active'
       WHERE handle = 'thia'
       LIMIT 1`,
      [email, await hashPhpPassword(password)],
    );

    if (result.affectedRows < 1) {
      throw new OpsRouteError("Seeded thia account was not found.", 404);
    }

    return {
      activated: true,
      handle: "thia",
    };
  }

  async migrationStatus(session: RequestSession, migrationToken: string): Promise<MigrationStatusPayload> {
    this.requireMigrationAccess(session, migrationToken);
    await this.ensureSchemaMigrationsTable();

    return {
      path: "migrations",
      migrations: await this.migrationStatusRows(),
    };
  }

  async runMigrations(session: RequestSession, migrationToken: string): Promise<MigrationRunPayload> {
    this.requireMigrationAccess(session, migrationToken);
    await this.ensureSchemaMigrationsTable();
    const appliedRows = await this.appliedMigrationRows();
    const results: MigrationRunRow[] = [];
    let appliedCount = 0;
    let skippedCount = 0;

    for (const file of await this.migrationFiles()) {
      const existing = appliedRows.get(file.migration);

      if (existing !== undefined) {
        if (!safeEquals(existing.checksum, file.checksum)) {
          throw new OpsRouteError("Migration checksum mismatch.", 409);
        }

        skippedCount++;
        results.push({
          migration: file.migration,
          checksum: file.checksum,
          status: "skipped",
          appliedAt: existing.applied_at,
        });
        continue;
      }

      await this.applyMigrationFile(file);
      appliedCount++;
      results.push({
        migration: file.migration,
        checksum: file.checksum,
        status: "applied",
      });
    }

    return {
      path: "migrations",
      appliedCount,
      skippedCount,
      migrations: results,
    };
  }

  authDiagnostics(cookieHeader: string | undefined, host: string, migrationToken: string): AuthDiagnosticsPayload {
    this.requireDiagnosticsToken(migrationToken);
    const cookiePresent = typeof cookieHeader === "string" && cookieHeader !== "";

    return {
      cookieName: this.options.sessionCookieName,
      rawCookieHeaderPresent: cookiePresent,
      rawCookieCandidateCount: cookiePresent ? cookieHeader.split(";").filter((part) => part.trim().startsWith(`${this.options.sessionCookieName}=`)).length : 0,
      configuredCookieDomain: this.options.sessionCookieDomain,
      requestHost: host,
      nodeRuntime: true,
    };
  }

  private requireSetupToken(provided: string): void {
    if (this.options.setupToken.trim() === "") {
      throw new OpsRouteError("Account setup is disabled.", 404);
    }

    if (!safeEquals(this.options.setupToken, provided)) {
      throw new OpsRouteError("Invalid setup token.", 403);
    }
  }

  private requireMigrationAccess(session: RequestSession, provided: string): void {
    if (this.options.migrationToken === "") {
      throw new OpsRouteError("Not found.", 404);
    }

    if (provided === "" || !safeEquals(this.options.migrationToken, provided)) {
      throw new OpsRouteError("Migration access denied.", 403);
    }

    if (session.role !== "admin") {
      throw new OpsRouteError("Admin access is required.", 403);
    }
  }

  private requireDiagnosticsToken(provided: string): void {
    if (this.options.migrationToken === "") {
      throw new OpsRouteError("Not found.", 404);
    }

    if (provided === "" || !safeEquals(this.options.migrationToken, provided)) {
      throw new OpsRouteError("Diagnostics access denied.", 403);
    }
  }

  private async ensureSchemaMigrationsTable(): Promise<void> {
    await this.pool.query(
      `CREATE TABLE IF NOT EXISTS schema_migrations (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        migration VARCHAR(191) NOT NULL UNIQUE,
        checksum CHAR(64) NOT NULL,
        applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    );
  }

  private async migrationStatusRows(): Promise<MigrationStatusRow[]> {
    const appliedRows = await this.appliedMigrationRows();
    const rows: MigrationStatusRow[] = [];

    for (const file of await this.migrationFiles()) {
      const applied = appliedRows.get(file.migration);

      if (applied !== undefined && !safeEquals(applied.checksum, file.checksum)) {
        rows.push({
          migration: file.migration,
          checksum: file.checksum,
          applied: true,
          appliedAt: applied.applied_at,
          checksumMismatch: true,
          appliedChecksum: applied.checksum,
        });
        continue;
      }

      rows.push({
        migration: file.migration,
        checksum: file.checksum,
        applied: applied !== undefined,
        appliedAt: applied?.applied_at ?? null,
      });
    }

    return rows;
  }

  private async appliedMigrationRows(): Promise<Map<string, AppliedMigrationRow>> {
    const [rows] = await this.pool.execute<AppliedMigrationRow[]>(
      `SELECT migration, checksum, applied_at
       FROM schema_migrations
       ORDER BY migration ASC`,
    );

    return new Map(rows.map((row) => [row.migration, row]));
  }

  private async migrationFiles(): Promise<Array<{ migration: string; path: string; contents: string; checksum: string }>> {
    const filenames = (await readdir(this.options.migrationsDir)).filter((filename) => /^\d{8}_\d{4}_[a-z0-9_]+\.sql$/u.test(filename)).sort();
    const files = [];

    for (const migration of filenames) {
      const migrationPath = path.join(this.options.migrationsDir, migration);
      const contents = await readFile(migrationPath, "utf8");

      files.push({
        migration,
        path: migrationPath,
        contents,
        checksum: createHash("sha256").update(contents).digest("hex"),
      });
    }

    return files;
  }

  private async applyMigrationFile(file: { migration: string; contents: string; checksum: string }): Promise<void> {
    const connection = await this.pool.getConnection();

    try {
      await connection.beginTransaction();

      for (const statement of migrationSqlStatements(file.contents)) {
        await connection.query(statement);
      }

      await connection.execute(
        `INSERT INTO schema_migrations (migration, checksum)
         VALUES (?, ?)`,
        [file.migration, file.checksum],
      );
      await connection.commit();
    } catch {
      await rollbackQuietly(connection);
      throw new OpsRouteError("Migration failed.", 500);
    } finally {
      connection.release();
    }
  }
}

async function rollbackQuietly(connection: PoolConnection): Promise<void> {
  try {
    await connection.rollback();
  } catch {
    // Nothing useful to report after the original migration failure.
  }
}

function migrationSqlStatements(sql: string): string[] {
  const cleaned = sql.replace(/^\uFEFF/u, "");
  const statements: string[] = [];
  let buffer = "";
  let quote: string | null = null;

  for (let index = 0; index < cleaned.length; index++) {
    const char = cleaned[index] ?? "";

    if (quote !== null) {
      buffer += char;

      if (char === "\\" && quote !== "`" && index + 1 < cleaned.length) {
        index++;
        buffer += cleaned[index] ?? "";
        continue;
      }

      if (char === quote) {
        quote = null;
      }

      continue;
    }

    if (char === "'" || char === "\"" || char === "`") {
      quote = char;
      buffer += char;
      continue;
    }

    if (char === ";" && buffer.trim() !== "") {
      statements.push(buffer.trim());
      buffer = "";
      continue;
    }

    buffer += char;
  }

  if (buffer.trim() !== "") {
    statements.push(buffer.trim());
  }

  return statements;
}

function validateEmail(value: unknown): string {
  if (typeof value !== "string" || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/u.test(value.trim())) {
    throw new OpsRouteError("Enter a valid email address.", 422);
  }

  return value.trim().toLowerCase();
}

function validatePassword(value: unknown): string {
  if (typeof value !== "string" || value.length < 10) {
    throw new OpsRouteError("Password must be at least 10 characters.", 422);
  }

  return value;
}

function safeEquals(expected: string, provided: string): boolean {
  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(provided);

  return expectedBuffer.length === providedBuffer.length && timingSafeEqual(expectedBuffer, providedBuffer);
}
