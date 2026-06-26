import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import net from "node:net";

import type { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import nacl from "tweetnacl";

import { hashPhpPassword, verifyPhpPassword } from "./passwords.js";
import { authSessionPayload, csrfTokenForSession, type AuthSessionPayload } from "./private.js";
import { hashSessionToken, type RequestSession } from "./sessions.js";

const genericLoginError = "Invalid email or password.";
const twoFactorIssuer = "thia.lol";
const twoFactorStepSeconds = 30;
const twoFactorChallengeSeconds = 600;
const twoFactorMaxAttempts = 8;
const opensslPrefix = "openssl:";

export interface AuthRepository {
  login(body: Record<string, unknown>, context: AuthRequestContext): Promise<AuthSessionResult | TwoFactorChallengePayload>;
  register(body: Record<string, unknown>, context: AuthRequestContext): Promise<AuthSessionResult>;
  logout(cookieHeader: string | undefined, context: AuthRequestContext): Promise<AuthLogoutResult>;
  verifyTwoFactor(body: Record<string, unknown>, context: AuthRequestContext): Promise<AuthSessionResult>;
  setupTwoFactor(session: RequestSession, body: Record<string, unknown>): Promise<TwoFactorSetupPayload>;
  enableTwoFactor(session: RequestSession, body: Record<string, unknown>): Promise<TwoFactorEnablePayload>;
  disableTwoFactor(session: RequestSession, body: Record<string, unknown>): Promise<TwoFactorStatusPayload>;
  regenerateTwoFactorRecoveryCodes(session: RequestSession, body: Record<string, unknown>): Promise<TwoFactorRecoveryCodesPayload>;
  csrfTokenForSession(session: RequestSession): string;
}

export interface AuthRepositoryOptions {
  cookieName: string;
  cookieDomain: string | null;
  csrfSecret: string;
  encryptionKey: string;
  sessionLifetimeSeconds: number;
}

export interface AuthRequestContext {
  ipAddress: string;
  userAgent: string;
  host: string;
  secure: boolean;
}

export interface AuthSessionResult {
  payload: AuthSessionPayload;
  cookie: string;
}

export interface AuthLogoutResult {
  loggedOut: true;
  cookies: string[];
}

export interface TwoFactorChallengePayload {
  twoFactorRequired: true;
  challengeId: string;
  expiresAt: string;
}

export interface TwoFactorSetupPayload {
  setup: {
    manualSecret: string;
    otpauthUri: string;
  };
  twoFactor: TwoFactorStatusPayload["twoFactor"];
}

export interface TwoFactorEnablePayload {
  twoFactor: TwoFactorStatusPayload["twoFactor"];
  backupCodes: string[];
}

export interface TwoFactorRecoveryCodesPayload {
  backupCodes: string[];
  twoFactor: TwoFactorStatusPayload["twoFactor"];
}

export interface TwoFactorStatusPayload {
  twoFactor: {
    enabled: boolean;
    backupCodeCount: number;
    encryptionConfigured: boolean;
    encryptionAvailable: boolean;
  };
}

export class AuthRouteError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
  ) {
    super(message);
    this.name = "AuthRouteError";
  }
}

interface UserLoginRow extends RowDataPacket {
  id: number | string;
  password_hash: string | null;
  status: string | null;
  deletion_pending: number | string | null;
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
  links: string | null;
  traits: string | null;
}

interface CountRow extends RowDataPacket {
  table_count?: number | string;
}

interface RateLimitRow extends RowDataPacket {
  attempts: number | string;
}

interface TwoFactorEnabledRow extends RowDataPacket {
  enabled_at: string | null;
}

interface TwoFactorPendingRow extends RowDataPacket {
  pending_secret_cipher: string | null;
}

interface TwoFactorSecretRow extends RowDataPacket {
  secret_cipher: string | null;
}

interface TwoFactorChallengeRow extends RowDataPacket {
  id: string;
  user_id: number | string;
  attempts: number | string;
}

interface BackupCodeRow extends RowDataPacket {
  id: number | string;
  code_hash: string;
}

interface UserPasswordRow extends RowDataPacket {
  password_hash: string | null;
}

interface BackupCodeCountRow extends RowDataPacket {
  code_count: number | string | null;
}

export function createAuthRepository(pool: Pool, options: AuthRepositoryOptions): AuthRepository {
  return new MysqlAuthRepository(pool, options);
}

export { hashPhpPassword, verifyPhpPassword } from "./passwords.js";

export function validateAuthEmail(value: unknown): string {
  if (typeof value !== "string") {
    throw new AuthRouteError("Email is required.", 422);
  }

  const email = value.trim().toLowerCase();

  if (email.length > 191 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email)) {
    throw new AuthRouteError("Enter a valid email address.", 422);
  }

  return email;
}

export function validateAuthPassword(value: unknown): string {
  if (typeof value !== "string") {
    throw new AuthRouteError("Password is required.", 422);
  }

  if (Buffer.byteLength(value) < 10 || Buffer.byteLength(value) > 255) {
    throw new AuthRouteError("Password must be between 10 and 255 characters.", 422);
  }

  return value;
}

export function validateAuthHandle(value: unknown): string {
  if (typeof value !== "string") {
    throw new AuthRouteError("Handle is required.", 422);
  }

  const handle = value.trim().replace(/^@+/u, "").toLowerCase();

  if (!/^[a-z0-9](?:[a-z0-9_-]{1,38}[a-z0-9])$/u.test(handle)) {
    throw new AuthRouteError("Handle must be 3-40 characters using letters, numbers, dashes, or underscores.", 422);
  }

  return handle;
}

export function validateAuthDisplayName(value: unknown): string {
  if (typeof value !== "string") {
    throw new AuthRouteError("Display name is required.", 422);
  }

  const displayName = value.trim();
  const displayNameLength = Array.from(displayName).length;

  if (displayNameLength < 1 || displayNameLength > 120 || containsControlCharacter(displayName)) {
    throw new AuthRouteError("Display name must be 1-120 visible characters.", 422);
  }

  return displayName;
}

export function buildSessionCookie(
  cookieName: string,
  token: string,
  expiresAt: Date,
  options: {
    domain: string | null;
    secure: boolean;
  },
): string {
  return serializeCookie(cookieName, token, {
    expires: expiresAt,
    path: "/",
    domain: options.domain,
    secure: options.secure,
    httpOnly: true,
    sameSite: "Lax",
  });
}

export function buildClearSessionCookies(
  cookieName: string,
  options: {
    domain: string | null;
    host: string;
    secure: boolean;
  },
): string[] {
  const expires = new Date(Date.now() - 3_600_000);
  const domains = new Set<string | null>([options.domain, null]);

  if (options.host === "thia.lol" || options.host === "www.thia.lol") {
    domains.add("thia.lol");
    domains.add(".thia.lol");
  }

  if (options.domain !== null) {
    domains.add(options.domain.replace(/^\./u, ""));
    domains.add(`.${options.domain.replace(/^\./u, "")}`);
  }

  const cookies: string[] = [];

  for (const path of ["/", "/api"]) {
    for (const domain of domains) {
      cookies.push(
        serializeCookie(cookieName, "", {
          expires,
          path,
          domain,
          secure: options.secure,
          httpOnly: true,
          sameSite: "Lax",
        }),
      );
    }
  }

  return [...new Set(cookies)];
}

class MysqlAuthRepository implements AuthRepository {
  private tableCache = new Map<string, Promise<boolean>>();

  constructor(
    private readonly pool: Pool,
    private readonly options: AuthRepositoryOptions,
  ) {}

  csrfTokenForSession(session: RequestSession): string {
    return csrfTokenForSession(session, this.options.csrfSecret);
  }

  async login(body: Record<string, unknown>, context: AuthRequestContext): Promise<AuthSessionResult | TwoFactorChallengePayload> {
    const email = validateAuthEmail(body.email);
    const password = typeof body.password === "string" ? body.password : "";

    await this.consumeRateLimit(
      "login",
      `${context.ipAddress}|${email}`,
      8,
      900,
    );

    const user = await this.loginUser(email);

    if (
      user === null ||
      user.status !== "active" ||
      numberValue(user.deletion_pending) > 0 ||
      typeof user.password_hash !== "string" ||
      !(await verifyPhpPassword(password, user.password_hash))
    ) {
      throw new AuthRouteError(genericLoginError, 401);
    }

    const userId = numberValue(user.id);

    if (await this.twoFactorEnabled(userId)) {
      return this.createTwoFactorChallenge(userId);
    }

    return this.createSessionForUser(userId, context);
  }

  async register(body: Record<string, unknown>, context: AuthRequestContext): Promise<AuthSessionResult> {
    const email = validateAuthEmail(body.email);
    const password = validateAuthPassword(body.password);
    const handle = validateAuthHandle(body.handle);
    const displayName = validateAuthDisplayName(body.displayName ?? body.display_name);

    await this.consumeRateLimit("register", context.ipAddress, 5, 3_600);

    const connection = await this.pool.getConnection();

    try {
      await connection.beginTransaction();

      const [userResult] = await connection.execute<ResultSetHeader>(
        `INSERT INTO users (handle, email, password_hash, role)
         VALUES (?, ?, ?, ?)`,
        [handle, email, await hashPhpPassword(password), "member"],
      );
      const userId = userResult.insertId;

      await connection.execute(
        `INSERT INTO profiles (user_id, display_name, bio, location, avatar_url, links, traits)
         VALUES (?, ?, NULL, NULL, NULL, JSON_ARRAY(), JSON_ARRAY())`,
        [userId, displayName],
      );

      await this.ensureOnboardingState(connection, userId);
      await this.ensurePreferences(connection, userId);
      await connection.commit();

      return this.createSessionForUser(userId, context);
    } catch (error) {
      await connection.rollback().catch(() => undefined);

      if (isDuplicateError(error)) {
        throw new AuthRouteError("Email or handle is already in use.", 409);
      }

      throw error;
    } finally {
      connection.release();
    }
  }

  async logout(cookieHeader: string | undefined, context: AuthRequestContext): Promise<AuthLogoutResult> {
    const tokens = sessionCookieTokens(cookieHeader, this.options.cookieName);

    for (const token of tokens) {
      await this.pool.execute(
        `DELETE FROM sessions
         WHERE token_hash = ?`,
        [hashSessionToken(token)],
      );
    }

    return {
      loggedOut: true,
      cookies: buildClearSessionCookies(this.options.cookieName, {
        domain: this.options.cookieDomain,
        host: context.host,
        secure: context.secure,
      }),
    };
  }

  async verifyTwoFactor(body: Record<string, unknown>, context: AuthRequestContext): Promise<AuthSessionResult> {
    const challengeId = stringValue(body.challengeId ?? body.challenge_id);
    const code = stringValue(body.code);

    if (challengeId === "" || code === "") {
      throw new AuthRouteError("Two-factor challenge and code are required.", 422);
    }

    const userId = await this.verifyTwoFactorChallenge(challengeId, code);

    return this.createSessionForUser(userId, context);
  }

  async setupTwoFactor(session: RequestSession, body: Record<string, unknown>): Promise<TwoFactorSetupPayload> {
    await this.requireCurrentPassword(session.userId, body.currentPassword ?? body.current_password);
    await this.requireTwoFactorStorage();
    const key = encryptionKey(this.options.encryptionKey);

    if (key === null) {
      throw new AuthRouteError("Account security encryption is not configured.", 503);
    }

    const secret = base32Encode(randomBytes(20));
    const cipher = encryptOpenssl(secret, key);

    await this.pool.execute(
      `INSERT INTO user_two_factor (user_id, pending_secret_cipher, updated_at)
       VALUES (?, ?, UTC_TIMESTAMP())
       ON DUPLICATE KEY UPDATE
         pending_secret_cipher = VALUES(pending_secret_cipher),
         updated_at = UTC_TIMESTAMP()`,
      [session.userId, cipher],
    );

    const label = `${twoFactorIssuer}:${session.email ?? ""}`;

    return {
      setup: {
        manualSecret: secret,
        otpauthUri: `otpauth://totp/${encodeURIComponent(label)}?secret=${encodeURIComponent(secret)}&issuer=${encodeURIComponent(twoFactorIssuer)}&algorithm=SHA1&digits=6&period=30`,
      },
      twoFactor: await this.twoFactorStatus(session.userId),
    };
  }

  async enableTwoFactor(session: RequestSession, body: Record<string, unknown>): Promise<TwoFactorEnablePayload> {
    await this.requireTwoFactorStorage();
    const code = typeof body.code === "string" ? body.code : "";
    const [rows] = await this.pool.execute<TwoFactorPendingRow[]>(
      `SELECT pending_secret_cipher
       FROM user_two_factor
       WHERE user_id = ?
       LIMIT 1`,
      [session.userId],
    );
    const pendingCipher = rows[0]?.pending_secret_cipher;

    if (typeof pendingCipher !== "string" || pendingCipher === "") {
      throw new AuthRouteError("Start two-factor setup first.", 422);
    }

    const secret = await this.decryptTwoFactorSecret(pendingCipher, "Two-factor setup secret could not be read.");

    if (!verifyTotpCode(secret, code)) {
      throw new AuthRouteError("Enter a valid authenticator code.", 422);
    }

    const connection = await this.pool.getConnection();

    try {
      await connection.beginTransaction();
      await connection.execute(
        `UPDATE user_two_factor
         SET secret_cipher = pending_secret_cipher,
             pending_secret_cipher = NULL,
             enabled_at = UTC_TIMESTAMP(),
             updated_at = UTC_TIMESTAMP()
         WHERE user_id = ?`,
        [session.userId],
      );
      await connection.execute(`DELETE FROM user_two_factor_backup_codes WHERE user_id = ?`, [session.userId]);
      const backupCodes = await this.insertBackupCodes(connection, session.userId);
      await connection.commit();

      return {
        twoFactor: await this.twoFactorStatus(session.userId),
        backupCodes,
      };
    } catch (error) {
      await connection.rollback().catch(() => undefined);
      throw error;
    } finally {
      connection.release();
    }
  }

  async disableTwoFactor(session: RequestSession, body: Record<string, unknown>): Promise<TwoFactorStatusPayload> {
    await this.requireCurrentPassword(session.userId, body.currentPassword ?? body.current_password);
    await this.requireTwoFactorStorage();
    const connection = await this.pool.getConnection();

    try {
      await connection.beginTransaction();
      await connection.execute(`DELETE FROM user_two_factor_backup_codes WHERE user_id = ?`, [session.userId]);
      await connection.execute(`DELETE FROM auth_two_factor_challenges WHERE user_id = ?`, [session.userId]);
      await connection.execute(`DELETE FROM user_two_factor WHERE user_id = ?`, [session.userId]);
      await connection.commit();

      return {
        twoFactor: await this.twoFactorStatus(session.userId),
      };
    } catch (error) {
      await connection.rollback().catch(() => undefined);
      throw error;
    } finally {
      connection.release();
    }
  }

  async regenerateTwoFactorRecoveryCodes(
    session: RequestSession,
    body: Record<string, unknown>,
  ): Promise<TwoFactorRecoveryCodesPayload> {
    await this.requireCurrentPassword(session.userId, body.currentPassword ?? body.current_password);
    await this.requireTwoFactorStorage();

    if (!(await this.twoFactorEnabled(session.userId))) {
      throw new AuthRouteError("Two-factor authentication is not enabled.", 422);
    }

    const connection = await this.pool.getConnection();

    try {
      await connection.beginTransaction();
      await connection.execute(`DELETE FROM user_two_factor_backup_codes WHERE user_id = ?`, [session.userId]);
      const backupCodes = await this.insertBackupCodes(connection, session.userId);
      await connection.commit();

      return {
        backupCodes,
        twoFactor: await this.twoFactorStatus(session.userId),
      };
    } catch (error) {
      await connection.rollback().catch(() => undefined);
      throw error;
    } finally {
      connection.release();
    }
  }

  private async loginUser(email: string): Promise<UserLoginRow | null> {
    const hasDeletionTable = await this.tableExists("account_deletion_requests");
    const deletionSelect = hasDeletionTable
      ? `EXISTS (
          SELECT 1
          FROM account_deletion_requests deletion_requests
          WHERE deletion_requests.user_id = users.id
            AND deletion_requests.canceled_at IS NULL
            AND deletion_requests.completed_at IS NULL
          LIMIT 1
        ) AS deletion_pending`
      : "0 AS deletion_pending";
    const [rows] = await this.pool.execute<UserLoginRow[]>(
      `SELECT id, password_hash, status, ${deletionSelect}
       FROM users
       WHERE email = ?
       LIMIT 1`,
      [email],
    );

    return rows[0] ?? null;
  }

  private async createSessionForUser(userId: number, context: AuthRequestContext): Promise<AuthSessionResult> {
    await this.pool.execute(`DELETE FROM sessions WHERE expires_at <= UTC_TIMESTAMP()`);
    const token = randomBytes(32).toString("base64url");
    const tokenHash = hashSessionToken(token);
    const expiresAt = new Date(Date.now() + this.options.sessionLifetimeSeconds * 1000);

    await this.pool.execute(
      `INSERT INTO sessions (user_id, token_hash, user_agent, ip_address, expires_at, last_seen_at)
       VALUES (?, ?, ?, ?, ?, UTC_TIMESTAMP())`,
      [
        userId,
        tokenHash,
        context.userAgent.slice(0, 255),
        packedIpAddress(context.ipAddress),
        mysqlDate(expiresAt),
      ],
    );

    const session = await this.sessionByTokenHash(tokenHash);

    if (session === null) {
      throw new Error("Created session could not be loaded.");
    }

    return {
      payload: authSessionPayload(session, this.options.csrfSecret),
      cookie: buildSessionCookie(this.options.cookieName, token, expiresAt, {
        domain: this.options.cookieDomain,
        secure: context.secure,
      }),
    };
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
      links: row.links,
      traits: row.traits,
    };
  }

  private async consumeRateLimit(
    action: "login" | "register",
    identifier: string,
    maxAttempts: number,
    windowSeconds: number,
  ): Promise<void> {
    const identifierHash = createHash("sha256").update(`${action}|${identifier}`).digest("hex");
    const cutoff = mysqlDate(new Date(Date.now() - windowSeconds * 1000));

    await this.pool.execute(
      `INSERT INTO auth_rate_limits (action, identifier_hash, attempts, window_starts_at, last_attempt_at)
       VALUES (?, ?, 1, UTC_TIMESTAMP(), UTC_TIMESTAMP())
       ON DUPLICATE KEY UPDATE
         attempts = IF(window_starts_at < ?, 1, attempts + 1),
         window_starts_at = IF(window_starts_at < ?, UTC_TIMESTAMP(), window_starts_at),
         last_attempt_at = UTC_TIMESTAMP()`,
      [action, identifierHash, cutoff, cutoff],
    );

    const [rows] = await this.pool.execute<RateLimitRow[]>(
      `SELECT attempts
       FROM auth_rate_limits
       WHERE action = ?
         AND identifier_hash = ?
       LIMIT 1`,
      [action, identifierHash],
    );

    if (numberValue(rows[0]?.attempts) > maxAttempts) {
      throw new AuthRouteError("Too many attempts. Please try again later.", 429);
    }
  }

  private async twoFactorEnabled(userId: number): Promise<boolean> {
    if (!(await this.tableExists("user_two_factor"))) {
      return false;
    }

    const [rows] = await this.pool.execute<TwoFactorEnabledRow[]>(
      `SELECT enabled_at
       FROM user_two_factor
       WHERE user_id = ?
       LIMIT 1`,
      [userId],
    );

    return rows[0]?.enabled_at !== null && rows[0]?.enabled_at !== undefined;
  }

  private async createTwoFactorChallenge(userId: number): Promise<TwoFactorChallengePayload> {
    await this.requireTwoFactorStorage();
    const challengeId = randomBytes(24).toString("hex");
    const expiresAt = mysqlDate(new Date(Date.now() + twoFactorChallengeSeconds * 1000));

    await this.pool.execute(
      `INSERT INTO auth_two_factor_challenges (id, user_id, expires_at)
       VALUES (?, ?, ?)`,
      [challengeId, userId, expiresAt],
    );

    return {
      twoFactorRequired: true,
      challengeId,
      expiresAt,
    };
  }

  private async verifyTwoFactorChallenge(challengeId: string, code: string): Promise<number> {
    await this.requireTwoFactorStorage();
    const [rows] = await this.pool.execute<TwoFactorChallengeRow[]>(
      `SELECT id, user_id, attempts
       FROM auth_two_factor_challenges
       WHERE id = ?
         AND consumed_at IS NULL
         AND expires_at > UTC_TIMESTAMP()
       LIMIT 1`,
      [challengeId],
    );
    const challenge = rows[0];

    if (challenge === undefined) {
      throw new AuthRouteError("Two-factor challenge expired. Sign in again.", 401);
    }

    if (numberValue(challenge.attempts) >= twoFactorMaxAttempts) {
      throw new AuthRouteError("Too many two-factor attempts. Sign in again.", 429);
    }

    const userId = numberValue(challenge.user_id);

    if (!(await this.verifyUserTwoFactorCode(userId, code))) {
      await this.pool.execute(
        `UPDATE auth_two_factor_challenges
         SET attempts = attempts + 1
         WHERE id = ?`,
        [challengeId],
      );
      throw new AuthRouteError("Enter a valid authenticator or recovery code.", 422);
    }

    await this.pool.execute(
      `UPDATE auth_two_factor_challenges
       SET consumed_at = UTC_TIMESTAMP()
       WHERE id = ?`,
      [challengeId],
    );

    return userId;
  }

  private async verifyUserTwoFactorCode(userId: number, code: string): Promise<boolean> {
    const normalized = normalizeTwoFactorCode(code);
    const [rows] = await this.pool.execute<TwoFactorSecretRow[]>(
      `SELECT secret_cipher
       FROM user_two_factor
       WHERE user_id = ?
         AND enabled_at IS NOT NULL
       LIMIT 1`,
      [userId],
    );
    const secretCipher = rows[0]?.secret_cipher;

    if (typeof secretCipher !== "string" || secretCipher === "") {
      return false;
    }

    let secret: string;

    try {
      secret = await this.decryptTwoFactorSecret(secretCipher);
    } catch {
      return false;
    }

    if (verifyTotpCode(secret, normalized)) {
      return true;
    }

    return this.consumeBackupCode(userId, normalized);
  }

  private async consumeBackupCode(userId: number, code: string): Promise<boolean> {
    if (code === "") {
      return false;
    }

    const [rows] = await this.pool.execute<BackupCodeRow[]>(
      `SELECT id, code_hash
       FROM user_two_factor_backup_codes
       WHERE user_id = ?
         AND used_at IS NULL`,
      [userId],
    );

    for (const row of rows) {
      if (await verifyPhpPassword(code, row.code_hash)) {
        await this.pool.execute(
          `UPDATE user_two_factor_backup_codes
           SET used_at = UTC_TIMESTAMP()
           WHERE id = ?`,
          [numberValue(row.id)],
        );
        return true;
      }
    }

    return false;
  }

  private async requireCurrentPassword(userId: number, value: unknown): Promise<void> {
    if (typeof value !== "string" || value === "") {
      throw new AuthRouteError("Current password is required.", 422);
    }

    const [rows] = await this.pool.execute<UserPasswordRow[]>(
      `SELECT password_hash
       FROM users
       WHERE id = ?
       LIMIT 1`,
      [userId],
    );
    const passwordHash = rows[0]?.password_hash;

    if (typeof passwordHash !== "string" || !(await verifyPhpPassword(value, passwordHash))) {
      throw new AuthRouteError("Current password is incorrect.", 403);
    }
  }

  private async twoFactorStatus(userId: number): Promise<TwoFactorStatusPayload["twoFactor"]> {
    const enabled = await this.twoFactorEnabled(userId);
    let backupCodeCount = 0;

    if (enabled && (await this.tableExists("user_two_factor_backup_codes"))) {
      const [rows] = await this.pool.execute<BackupCodeCountRow[]>(
        `SELECT COUNT(*) AS code_count
         FROM user_two_factor_backup_codes
         WHERE user_id = ?
           AND used_at IS NULL`,
        [userId],
      );
      backupCodeCount = numberValue(rows[0]?.code_count);
    }

    return {
      enabled,
      backupCodeCount,
      encryptionConfigured: encryptionKey(this.options.encryptionKey) !== null,
      encryptionAvailable: true,
    };
  }

  private async decryptTwoFactorSecret(value: string, errorMessage = "Stored secret could not be read."): Promise<string> {
    const key = encryptionKey(this.options.encryptionKey);

    if (key === null) {
      throw new AuthRouteError(errorMessage, 503);
    }

    try {
      if (value.startsWith(opensslPrefix)) {
        return decryptOpenssl(value.slice(opensslPrefix.length), key);
      }

      return decryptSodiumSecretbox(value, key);
    } catch {
      throw new AuthRouteError(errorMessage, 503);
    }
  }

  private async insertBackupCodes(connection: PoolConnection, userId: number): Promise<string[]> {
    const codes: string[] = [];

    for (let index = 0; index < 10; index += 1) {
      const code = randomBytes(5).toString("hex").slice(0, 10).toUpperCase();
      codes.push(code);
      await connection.execute(
        `INSERT INTO user_two_factor_backup_codes (user_id, code_hash)
         VALUES (?, ?)`,
        [userId, await hashPhpPassword(code)],
      );
    }

    return codes;
  }

  private async requireTwoFactorStorage(): Promise<void> {
    const ready =
      (await this.tableExists("user_two_factor")) &&
      (await this.tableExists("user_two_factor_backup_codes")) &&
      (await this.tableExists("auth_two_factor_challenges"));

    if (!ready) {
      throw new AuthRouteError("Account security storage is not ready. Run pending migrations.", 503);
    }
  }

  private async ensureOnboardingState(connection: PoolConnection, userId: number): Promise<void> {
    if (!(await this.tableExists("user_onboarding_state"))) {
      return;
    }

    await connection.execute(
      `INSERT IGNORE INTO user_onboarding_state
          (user_id, completed_steps_json, skipped_steps_json, provider_links_json)
       VALUES
          (?, JSON_ARRAY(), JSON_ARRAY(), JSON_OBJECT())`,
      [userId],
    );
  }

  private async ensurePreferences(connection: PoolConnection, userId: number): Promise<void> {
    if (!(await this.tableExists("user_preferences"))) {
      return;
    }

    await connection.execute(
      `INSERT IGNORE INTO user_preferences
          (user_id, notification_preferences_json, email_notification_preferences_json, push_notification_preferences_json)
       VALUES (?, JSON_OBJECT(), JSON_OBJECT(), JSON_OBJECT())`,
      [userId],
    );
  }

  private tableExists(tableName: string): Promise<boolean> {
    if (!/^[a-zA-Z0-9_]+$/u.test(tableName)) {
      throw new Error("Invalid schema identifier.");
    }

    const cached = this.tableCache.get(tableName);

    if (cached !== undefined) {
      return cached;
    }

    const promise = this.detectTable(tableName);
    this.tableCache.set(tableName, promise);

    return promise;
  }

  private async detectTable(tableName: string): Promise<boolean> {
    const [rows] = await this.pool.execute<CountRow[]>(
      `SELECT COUNT(*) AS table_count
       FROM INFORMATION_SCHEMA.TABLES
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = ?`,
      [tableName],
    );

    return numberValue(rows[0]?.table_count) > 0;
  }
}

function sessionCookieTokens(cookieHeader: string | undefined, cookieName: string): string[] {
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

function isDuplicateError(error: unknown): boolean {
  return (
    error !== null &&
    typeof error === "object" &&
    "code" in error &&
    (error as { code?: unknown }).code === "ER_DUP_ENTRY"
  );
}

function serializeCookie(
  name: string,
  value: string,
  options: {
    expires: Date;
    path: string;
    domain: string | null;
    secure: boolean;
    httpOnly: boolean;
    sameSite: "Lax";
  },
): string {
  const parts = [`${encodeURIComponent(name)}=${encodeURIComponent(value)}`];
  parts.push(`Expires=${options.expires.toUTCString()}`);
  parts.push(`Path=${options.path}`);

  if (options.domain !== null) {
    parts.push(`Domain=${options.domain}`);
  }

  if (options.secure) {
    parts.push("Secure");
  }

  if (options.httpOnly) {
    parts.push("HttpOnly");
  }

  parts.push(`SameSite=${options.sameSite}`);

  return parts.join("; ");
}

function safeDecodeURIComponent(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function numberValue(value: boolean | number | string | bigint | null | undefined): number {
  if (typeof value === "boolean") {
    return value ? 1 : 0;
  }

  if (typeof value === "bigint") {
    return Number(value);
  }

  if (value === null || value === undefined || value === "") {
    return 0;
  }

  const number = Number(value);

  return Number.isFinite(number) ? number : 0;
}

function containsControlCharacter(value: string): boolean {
  for (const character of value) {
    const codePoint = character.codePointAt(0) ?? 0;

    if (codePoint <= 0x1f || codePoint === 0x7f) {
      return true;
    }
  }

  return false;
}

function mysqlDate(date: Date): string {
  return date.toISOString().slice(0, 19).replace("T", " ");
}

function packedIpAddress(value: string): Buffer | null {
  if (net.isIPv4(value)) {
    return Buffer.from(value.split(".").map((part) => Number(part)));
  }

  return null;
}

function encryptionKey(value: string): Buffer | null {
  const trimmed = value.trim();

  if (trimmed === "") {
    return null;
  }

  const decoded = Buffer.from(trimmed, "base64");

  if (decoded.length === 32) {
    return decoded;
  }

  const raw = Buffer.from(trimmed);

  return raw.length >= 32 ? raw.subarray(0, 32) : null;
}

function encryptOpenssl(value: string, key: Buffer): string {
  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, nonce);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `${opensslPrefix}${Buffer.concat([nonce, tag, encrypted]).toString("base64")}`;
}

function decryptOpenssl(value: string, key: Buffer): string {
  const decoded = Buffer.from(value, "base64");

  if (decoded.length <= 28) {
    throw new Error("Stored secret is invalid.");
  }

  const nonce = decoded.subarray(0, 12);
  const tag = decoded.subarray(12, 28);
  const cipherText = decoded.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", key, nonce);
  decipher.setAuthTag(tag);

  return Buffer.concat([decipher.update(cipherText), decipher.final()]).toString("utf8");
}

function decryptSodiumSecretbox(value: string, key: Buffer): string {
  const decoded = Buffer.from(value, "base64");

  if (decoded.length <= 24) {
    throw new Error("Stored secret is invalid.");
  }

  const nonce = decoded.subarray(0, 24);
  const cipherText = decoded.subarray(24);
  const plain = nacl.secretbox.open(new Uint8Array(cipherText), new Uint8Array(nonce), new Uint8Array(key));

  if (plain === null) {
    throw new Error("Stored secret could not be decrypted.");
  }

  return Buffer.from(plain).toString("utf8");
}

function normalizeTwoFactorCode(code: string): string {
  return code.trim().replace(/[^A-Za-z0-9]/gu, "").toUpperCase();
}

function verifyTotpCode(secret: string, code: string): boolean {
  const normalized = normalizeTwoFactorCode(code);

  if (!/^[0-9]{6}$/u.test(normalized)) {
    return false;
  }

  const counter = Math.floor(Date.now() / 1000 / twoFactorStepSeconds);

  for (let offset = -1; offset <= 1; offset += 1) {
    if (safeEqual(totpCode(secret, counter + offset), normalized)) {
      return true;
    }
  }

  return false;
}

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function totpCode(secret: string, counter: number): string {
  const key = base32Decode(secret);
  const buffer = Buffer.alloc(8);
  buffer.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
  buffer.writeUInt32BE(counter >>> 0, 4);
  const hash = createHmac("sha1", key).update(buffer).digest();
  const offset = (hash[19] ?? 0) & 0x0f;
  const value = (
    (((hash[offset] ?? 0) & 0x7f) << 24) |
    (((hash[offset + 1] ?? 0) & 0xff) << 16) |
    (((hash[offset + 2] ?? 0) & 0xff) << 8) |
    ((hash[offset + 3] ?? 0) & 0xff)
  ) % 1_000_000;

  return String(value).padStart(6, "0");
}

function base32Encode(bytes: Buffer): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  let output = "";

  for (const byte of bytes) {
    bits += byte.toString(2).padStart(8, "0");
  }

  for (let index = 0; index < bits.length; index += 5) {
    const chunk = bits.slice(index, index + 5).padEnd(5, "0");
    output += alphabet[Number.parseInt(chunk, 2)];
  }

  return output;
}

function base32Decode(value: string): Buffer {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const clean = value.toUpperCase().replace(/[^A-Z2-7]/gu, "");
  let bits = "";
  const output: number[] = [];

  for (const character of clean) {
    const position = alphabet.indexOf(character);

    if (position >= 0) {
      bits += position.toString(2).padStart(5, "0");
    }
  }

  for (let index = 0; index < bits.length; index += 8) {
    const chunk = bits.slice(index, index + 8);

    if (chunk.length === 8) {
      output.push(Number.parseInt(chunk, 2));
    }
  }

  return Buffer.from(output);
}
