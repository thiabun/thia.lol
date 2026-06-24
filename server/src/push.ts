import { createHash } from "node:crypto";

import type { Pool, ResultSetHeader, RowDataPacket } from "mysql2/promise";

export class PushRouteError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
  ) {
    super(message);
    this.name = "PushRouteError";
  }
}

export interface PushStatusPayload {
  supported: true;
  configured: boolean;
  storageReady: boolean;
  publicKey: string | null;
  subject: string;
  enabled: boolean;
  subscriptionCount: number;
  subscriptions: PushSubscriptionPayload[];
  diagnostics: {
    missingConfigKeys: string[];
    curlAvailable: boolean;
    opensslAvailable: boolean;
  };
}

interface PushSubscriptionPayload {
  id: number;
  endpointHash: string;
  userAgent: string | null;
  lastSuccessAt: string | null;
  lastErrorAt: string | null;
  lastError: string | null;
  failureCount: number;
  disabledAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface PushTestPayload extends PushStatusPayload {
  lastSend: {
    attempted: number;
    sent: number;
    failed: number;
    disabled: number;
  };
}

export interface PushRepository {
  status(userId: number): Promise<PushStatusPayload>;
  saveSubscription(userId: number, body: Record<string, unknown>): Promise<PushStatusPayload>;
  disableSubscription(userId: number, body: Record<string, unknown>): Promise<PushStatusPayload>;
  testSend(userId: number): Promise<PushTestPayload>;
}

interface SubscriptionRow extends RowDataPacket {
  id: number | string;
  endpoint_hash: string | null;
  user_agent: string | null;
  last_success_at: string | null;
  last_error_at: string | null;
  last_error: string | null;
  failure_count: number | string | null;
  disabled_at: string | null;
  created_at: string | null;
  updated_at: string | null;
}

interface ActiveSubscriptionRow extends RowDataPacket {
  id: number | string;
}

interface CountRow extends RowDataPacket {
  value: number | string;
}

export interface PushOptions {
  publicKey: string;
  privateKey: string;
  subject: string;
}

export function createPushRepository(pool: Pool, options: PushOptions): PushRepository {
  return new MariaDbPushRepository(pool, options);
}

class MariaDbPushRepository implements PushRepository {
  constructor(
    private readonly pool: Pool,
    private readonly options: PushOptions,
  ) {}

  async status(userId: number): Promise<PushStatusPayload> {
    return this.statusPayload(userId);
  }

  async saveSubscription(userId: number, body: Record<string, unknown>): Promise<PushStatusPayload> {
    await this.requireStorage();
    this.requireConfigured();
    const subscription = subscriptionInput(body);
    const endpointHash = createHash("sha256").update(subscription.endpoint).digest("hex");

    await this.pool.execute<ResultSetHeader>(
      `INSERT INTO push_subscriptions
          (user_id, endpoint_hash, endpoint, p256dh_key, auth_secret, content_encoding, user_agent, disabled_at, last_error_at, last_error, failure_count)
       VALUES
          (?, ?, ?, ?, ?, 'aes128gcm', ?, NULL, NULL, NULL, 0)
       ON DUPLICATE KEY UPDATE
          user_id = VALUES(user_id),
          endpoint = VALUES(endpoint),
          p256dh_key = VALUES(p256dh_key),
          auth_secret = VALUES(auth_secret),
          content_encoding = VALUES(content_encoding),
          user_agent = VALUES(user_agent),
          disabled_at = NULL,
          last_error_at = NULL,
          last_error = NULL,
          failure_count = 0,
          updated_at = CURRENT_TIMESTAMP()`,
      [userId, endpointHash, subscription.endpoint, subscription.p256dh, subscription.auth, userAgent(body.userAgent ?? body.user_agent)],
    );

    return this.statusPayload(userId);
  }

  async disableSubscription(userId: number, body: Record<string, unknown>): Promise<PushStatusPayload> {
    await this.requireStorage();
    const params: Array<string | number> = [userId];
    let where = "user_id = ? AND disabled_at IS NULL";

    if (body.id !== undefined) {
      where += " AND id = ?";
      params.push(positiveInteger(body.id, "Subscription id"));
    } else if (body.endpoint !== undefined) {
      where += " AND endpoint_hash = ?";
      params.push(createHash("sha256").update(endpointValue(body.endpoint)).digest("hex"));
    } else {
      throw new PushRouteError("Choose a desktop notification subscription to disable.", 422);
    }

    await this.pool.execute<ResultSetHeader>(
      `UPDATE push_subscriptions
       SET disabled_at = CURRENT_TIMESTAMP(),
           last_error_at = CURRENT_TIMESTAMP(),
           last_error = 'Disabled by user',
           updated_at = CURRENT_TIMESTAMP()
       WHERE ${where}`,
      params,
    );

    return this.statusPayload(userId);
  }

  async testSend(userId: number): Promise<PushTestPayload> {
    await this.requireStorage();
    this.requireConfigured();
    const status = await this.statusPayload(userId);
    const [rows] = await this.pool.execute<ActiveSubscriptionRow[]>(
      `SELECT id
       FROM push_subscriptions
       WHERE user_id = ?
         AND disabled_at IS NULL
       LIMIT 20`,
      [userId],
    );

    return {
      ...status,
      lastSend: {
        attempted: rows.length,
        sent: 0,
        failed: rows.length,
        disabled: 0,
      },
    };
  }

  private async statusPayload(userId: number): Promise<PushStatusPayload> {
    const storageReady = await this.storageReady();
    const subscriptions = storageReady ? await this.subscriptionRows(userId) : [];
    const activeSubscriptions = subscriptions.filter((subscription) => subscription.disabledAt === null);
    const configured = this.configured();

    return {
      supported: true,
      configured,
      storageReady,
      publicKey: configured ? this.options.publicKey : null,
      subject: this.options.subject,
      enabled: activeSubscriptions.length > 0,
      subscriptionCount: activeSubscriptions.length,
      subscriptions,
      diagnostics: {
        missingConfigKeys: this.missingConfigKeys(),
        curlAvailable: false,
        opensslAvailable: true,
      },
    };
  }

  private async subscriptionRows(userId: number): Promise<PushSubscriptionPayload[]> {
    const [rows] = await this.pool.execute<SubscriptionRow[]>(
      `SELECT id, endpoint_hash, user_agent, last_success_at, last_error_at, last_error,
              failure_count, disabled_at, created_at, updated_at
       FROM push_subscriptions
       WHERE user_id = ?
       ORDER BY disabled_at IS NULL DESC, updated_at DESC, id DESC
       LIMIT 20`,
      [userId],
    );

    return rows.map((row) => ({
      id: numberValue(row.id),
      endpointHash: stringValue(row.endpoint_hash),
      userAgent: nullableString(row.user_agent),
      lastSuccessAt: nullableString(row.last_success_at),
      lastErrorAt: nullableString(row.last_error_at),
      lastError: nullableString(row.last_error),
      failureCount: numberValue(row.failure_count ?? 0),
      disabledAt: nullableString(row.disabled_at),
      createdAt: nullableString(row.created_at),
      updatedAt: nullableString(row.updated_at),
    }));
  }

  private async requireStorage(): Promise<void> {
    if (!(await this.storageReady())) {
      throw new PushRouteError("Desktop notification storage is not ready. Run pending migrations.", 503);
    }
  }

  private requireConfigured(): void {
    if (!this.configured()) {
      throw new PushRouteError("Desktop notifications are not configured on this server.", 503);
    }
  }

  private async storageReady(): Promise<boolean> {
    const [rows] = await this.pool.execute<CountRow[]>(
      `SELECT COUNT(*) AS value
       FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'push_subscriptions'`,
    );

    return numberValue(rows[0]?.value ?? 0) > 0;
  }

  private configured(): boolean {
    return this.missingConfigKeys().length === 0;
  }

  private missingConfigKeys(): string[] {
    const missing: string[] = [];

    if (this.options.publicKey.trim() === "") {
      missing.push("public_key");
    }

    if (this.options.privateKey.trim() === "") {
      missing.push("private_key");
    }

    if (this.options.subject.trim() === "") {
      missing.push("subject");
    }

    return missing;
  }
}

function subscriptionInput(body: Record<string, unknown>): { endpoint: string; p256dh: string; auth: string } {
  const endpoint = endpointValue(body.endpoint);
  const keys = body.keys;

  if (keys === null || typeof keys !== "object" || Array.isArray(keys)) {
    throw new PushRouteError("Desktop notification key is required.", 422);
  }

  return {
    endpoint,
    p256dh: subscriptionKey((keys as Record<string, unknown>).p256dh, "Desktop notification public key"),
    auth: subscriptionKey((keys as Record<string, unknown>).auth, "Desktop notification auth secret"),
  };
}

function endpointValue(value: unknown): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new PushRouteError("Desktop notification endpoint is required.", 422);
  }

  const endpoint = value.trim();

  try {
    const parsed = new URL(endpoint);

    if (parsed.protocol !== "https:") {
      throw new Error("invalid protocol");
    }
  } catch {
    throw new PushRouteError("Desktop notification endpoint must be a valid HTTPS URL.", 422);
  }

  return endpoint;
}

function subscriptionKey(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new PushRouteError(`${label} is required.`, 422);
  }

  if (!/^[A-Za-z0-9_-]+={0,2}$/u.test(value.trim())) {
    throw new PushRouteError(`${label} is invalid.`, 422);
  }

  return value.trim();
}

function userAgent(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim().slice(0, 255) : null;
}

function positiveInteger(value: unknown, label: string): number {
  if (typeof value !== "number" && !(typeof value === "string" && /^[0-9]+$/u.test(value))) {
    throw new PushRouteError(`${label} must be numeric.`, 422);
  }

  const number = Number(value);

  if (!Number.isSafeInteger(number) || number < 1) {
    throw new PushRouteError(`${label} must be numeric.`, 422);
  }

  return number;
}

function numberValue(value: string | number): number {
  const number = Number(value);

  return Number.isFinite(number) ? number : 0;
}

function stringValue(value: string | null | undefined): string {
  return value ?? "";
}

function nullableString(value: string | null | undefined): string | null {
  return value === undefined ? null : value;
}
