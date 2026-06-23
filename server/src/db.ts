import { sql } from "drizzle-orm";
import { drizzle, type MySql2Database } from "drizzle-orm/mysql2";
import mysql, { type Pool } from "mysql2/promise";

import type { ServerConfig } from "./config.js";

export interface DatabaseClient {
  readonly pool: Pool;
  readonly db: MySql2Database;
  check(): Promise<void>;
  close(): Promise<void>;
}

export function createDatabaseClient(config: ServerConfig): DatabaseClient {
  const pool = mysql.createPool({
    host: config.THIA_DB_HOST,
    port: config.THIA_DB_PORT,
    database: config.THIA_DB_NAME,
    user: config.THIA_DB_USER,
    password: config.THIA_DB_PASSWORD,
    charset: config.THIA_DB_CHARSET,
    dateStrings: true,
    waitForConnections: true,
    connectionLimit: 5,
    maxIdle: 2,
    idleTimeout: 60_000,
  });
  const db = drizzle(pool);

  return {
    pool,
    db,
    async check() {
      await db.execute(sql`SELECT 1 AS ok`);
    },
    async close() {
      await pool.end();
    },
  };
}
