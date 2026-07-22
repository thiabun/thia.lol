import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

import nacl from "tweetnacl";
import type { Pool, RowDataPacket } from "mysql2/promise";

import type { RequestSession } from "./sessions.js";

export const integrationProviders = ["spotify", "apple_music", "youtube", "twitch", "github"] as const;
export type IntegrationProvider = (typeof integrationProviders)[number];

const integrationTtlSeconds = 3600;
const twitchIntegrationTtlSeconds = 60;
const integrationStaleSeconds = 86400;
const oauthStateSeconds = 600;
const opensslPrefix = "openssl:";

export class IntegrationRouteError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
  ) {
    super(message);
    this.name = "IntegrationRouteError";
  }
}

export class IntegrationStorageNotReadyError extends Error {
  constructor() {
    super("Profile integration storage is not ready. Run pending migrations.");
    this.name = "IntegrationStorageNotReadyError";
  }
}

export interface IntegrationProviderConfig {
  clientId?: string;
  clientSecret?: string;
  apiKey?: string;
  developerToken?: string;
  storefront?: string;
  embedParent?: string;
  redirectUri?: string;
}

export interface IntegrationsRepositoryOptions {
  publicBaseUrl: string;
  encryptionKey: string;
  providers: Record<IntegrationProvider, IntegrationProviderConfig>;
  httpJson?: IntegrationHttpJson;
  now?: () => Date;
  onOAuthCallbackError?: (event: IntegrationOAuthCallbackErrorEvent) => void;
}

export interface IntegrationOAuthCallbackErrorEvent {
  error: Error;
  provider: IntegrationProvider;
  stage:
    | "state_decryption"
    | "token_exchange"
    | "identity_fetch"
    | "account_persistence"
    | "state_consumption";
}

export type IntegrationHttpJson = (
  method: "GET" | "POST",
  url: string,
  headers?: string[],
  body?: Record<string, string>,
) => Promise<unknown>;

export interface IntegrationsRepository {
  ownerIndex(session: RequestSession): Promise<IntegrationOwnerPayload>;
  diagnostics(): Promise<IntegrationDiagnosticsPayload>;
  startOAuth(session: RequestSession, provider: string, body: Record<string, unknown>): Promise<IntegrationOAuthStartPayload>;
  oauthCallback(provider: string, query: Record<string, unknown>): Promise<IntegrationRedirectPayload>;
  disconnect(session: RequestSession, provider: string): Promise<IntegrationOwnerPayload>;
  suggestions(session: RequestSession, provider: string): Promise<IntegrationSuggestionsPayload>;
  resolveMetadata(session: RequestSession, body: Record<string, unknown>): Promise<IntegrationCardPayload>;
  resolvePublicMetadata(rawUrl: string, preferredProvider: string | null): Promise<IntegrationCardPayload | null>;
}

export interface IntegrationProviderStatusPayload {
  provider: IntegrationProvider;
  configured: boolean;
  oauthEnabled: boolean;
  linkSupported: true;
  metadataEnabled: boolean;
  missingConfigKeys: string[];
}

export interface IntegrationAccountPayload {
  provider: string;
  providerAccountId: string;
  providerHandle: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  scopes: string[];
  tokenExpiresAt: string | null;
  connectedAt: string | null;
  refreshedAt: string | null;
  revokedAt: string | null;
  lastError: string | null;
  errorAt: string | null;
}

export interface IntegrationOwnerPayload {
  providers: IntegrationProviderStatusPayload[];
  accounts: IntegrationAccountPayload[];
}

export interface IntegrationDiagnosticsPayload {
  storageReady: boolean;
  encryptionConfigured: boolean;
  encryptionAvailable: boolean;
  cryptoMethod: "openssl" | null;
  oauthStateExpiresIn: number;
  providers: (IntegrationProviderStatusPayload & { redirectUri: string | null })[];
}

export interface IntegrationOAuthStartPayload {
  provider: IntegrationProvider;
  authorizationUrl: string;
  stateExpiresIn: number;
}

export interface IntegrationRedirectPayload {
  location: string;
}

export interface IntegrationCardPayload {
  provider: IntegrationProvider;
  resourceType: string;
  resourceId: string;
  resourceKey: string;
  sourceUrl: string;
  metadata: IntegrationMetadataPayload;
  embed: IntegrationEmbedPayload | null;
  apiBacked: boolean;
  fetchedAt: string | null;
  expiresAt: string | null;
  staleAt: string | null;
  stale?: boolean;
  lastError?: string | null;
}

export interface IntegrationEmbedPayload {
  type: "iframe";
  src: string;
  title: string;
  allow: string;
  height: number;
}

export interface IntegrationMetadataPayload {
  title: string;
  subtitle: string;
  description: string | null;
  imageUrl: string | null;
  live: boolean;
  liveFetchedAt: string | null;
  recentLabel: string | null;
  recentFetchedAt: string | null;
  stats: Record<string, unknown>;
}

interface IntegrationPlaylistTrackPayload {
  artist?: string;
  duration?: number;
  id?: string;
  sourceUrl?: string;
  title: string;
}

export interface IntegrationSuggestionsPayload {
  provider: IntegrationProvider;
  status: IntegrationProviderStatusPayload;
  account: IntegrationAccountPayload | null;
  items: IntegrationSuggestionItemPayload[];
  message: string | null;
  generatedAt: string;
}

export interface IntegrationSuggestionItemPayload {
  id: string;
  label: string;
  description: string;
  sourceUrl: string;
  moduleType: "creator_live" | "music";
  moduleTitle: "Creator" | "Music";
  card: IntegrationCardPayload | null;
}

interface IntegrationAccountRow extends RowDataPacket {
  provider: string;
  provider_account_id: string;
  provider_handle: string | null;
  display_name: string | null;
  avatar_url: string | null;
  scopes_json: string | null;
  token_expires_at: string | null;
  connected_at: string | null;
  refreshed_at: string | null;
  revoked_at: string | null;
  last_error: string | null;
  error_at: string | null;
  access_token_cipher?: string | null;
}

interface IntegrationStateRow extends RowDataPacket {
  id: number | string;
  user_id: number | string;
  provider: string;
  code_verifier_cipher: string | null;
  redirect_path: string | null;
}

interface IntegrationCacheRow extends RowDataPacket {
  id: number | string;
  provider: string;
  resource_type: string;
  resource_id: string;
  resource_key: string;
  source_url: string;
  metadata_json: string | null;
  embed_json: string | null;
  api_backed: number | boolean | string | null;
  fetched_at: string | null;
  expires_at: string | null;
  stale_at: string | null;
  error_message: string | null;
}

interface ExistsRow extends RowDataPacket {
  item_count: number | string;
}

interface NormalizedIntegrationUrl {
  provider: IntegrationProvider;
  resourceType: string;
  resourceId: string;
  resourceKey: string;
  sourceUrl: string;
}

interface OAuthTokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number | string;
  scope?: string | string[];
}

interface IntegrationIdentity {
  id?: string | null;
  handle?: string | null;
  displayName?: string | null;
  avatarUrl?: string | null;
}

export function createIntegrationsRepository(
  pool: Pool,
  options: IntegrationsRepositoryOptions,
): IntegrationsRepository {
  return new MysqlIntegrationsRepository(pool, options);
}

class MysqlIntegrationsRepository implements IntegrationsRepository {
  private storageReadyPromise?: Promise<boolean>;

  constructor(
    private readonly pool: Pool,
    private readonly options: IntegrationsRepositoryOptions,
  ) {}

  async ownerIndex(session: RequestSession): Promise<IntegrationOwnerPayload> {
    await this.requireStorage();

    return this.ownerPayload(session.userId);
  }

  async diagnostics(): Promise<IntegrationDiagnosticsPayload> {
    const storageReady = await this.storageReady();
    const encryptionConfigured = this.encryptionKey() !== null;

    return {
      storageReady,
      encryptionConfigured,
      encryptionAvailable: encryptionConfigured,
      cryptoMethod: encryptionConfigured ? "openssl" : null,
      oauthStateExpiresIn: oauthStateSeconds,
      providers: integrationProviders.map((provider) => ({
        ...this.providerStatus(provider),
        redirectUri: provider === "apple_music" ? null : this.redirectUri(provider),
      })),
    };
  }

  async startOAuth(
    session: RequestSession,
    rawProvider: string,
    body: Record<string, unknown>,
  ): Promise<IntegrationOAuthStartPayload> {
    await this.requireStorage();
    const provider = providerFromInput(rawProvider);
    const config = this.config(provider);

    if (!providerOauthEnabled(provider, config)) {
      throw new IntegrationRouteError("This integration is not configured yet.", 503);
    }

    this.requireEncryptionKey();

    const state = base64Url(randomBytes(32));
    const codeVerifier = base64Url(randomBytes(48));
    const redirectPath = redirectPathFromValue(body.redirectPath);
    const authorizationUrl = this.authorizationUrl(provider, state, codeVerifier);
    const expiresAt = sqlDate(new Date(this.now().getTime() + oauthStateSeconds * 1000));

    await this.pool.execute(
      `INSERT INTO profile_integration_oauth_states
          (user_id, provider, state_hash, code_verifier_cipher, redirect_path, expires_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        session.userId,
        provider,
        sha256(state),
        this.encrypt(codeVerifier),
        redirectPath,
        expiresAt,
      ],
    );

    return {
      provider,
      authorizationUrl,
      stateExpiresIn: oauthStateSeconds,
    };
  }

  async oauthCallback(rawProvider: string, query: Record<string, unknown>): Promise<IntegrationRedirectPayload> {
    await this.requireStorage();
    const provider = providerFromInput(rawProvider);
    const state = scalarString(query.state);
    const code = scalarString(query.code);
    const oauthError = scalarString(query.error);
    const stateRow = state === "" ? null : await this.oauthStateRow(provider, state);
    const redirectPath = stateRow?.redirect_path ?? "/settings";

    if (oauthError !== "") {
      if (stateRow !== null) {
        await this.consumeOAuthState(stateRow);
      }

      return this.redirectToApp(redirectPath, {
        integrationProvider: provider,
        integrationStatus: "error",
        integrationError: oauthErrorCode(oauthError, "provider_error"),
      });
    }

    if (state === "" || code === "") {
      if (stateRow !== null) {
        await this.consumeOAuthState(stateRow);
      }

      return this.redirectToApp(redirectPath, {
        integrationProvider: provider,
        integrationStatus: "error",
        integrationError: "missing_callback_parameters",
      });
    }

    if (stateRow === null) {
      return this.redirectToApp("/settings/connections", {
        integrationProvider: provider,
        integrationStatus: "error",
        integrationError: "invalid_or_expired_state",
      });
    }

    let codeVerifier: string;

    try {
      codeVerifier = this.decryptOrThrow(stateRow.code_verifier_cipher ?? "");
    } catch (error) {
      this.reportOAuthCallbackError(provider, "state_decryption", error);
      return this.redirectToApp(redirectPath, {
        integrationProvider: provider,
        integrationStatus: "error",
        integrationError: "oauth_callback_failed",
      });
    }

    try {
      await this.consumeOAuthState(stateRow);
    } catch (error) {
      this.reportOAuthCallbackError(provider, "state_consumption", error);
      return this.redirectToApp(redirectPath, {
        integrationProvider: provider,
        integrationStatus: "error",
        integrationError: "oauth_callback_failed",
      });
    }

    let token: OAuthTokenResponse;

    try {
      token = await this.exchangeCode(provider, code, codeVerifier);
    } catch (error) {
      this.reportOAuthCallbackError(provider, "token_exchange", error);
      return this.redirectToApp(redirectPath, {
        integrationProvider: provider,
        integrationStatus: "error",
        integrationError: "oauth_callback_failed",
      });
    }

    let identity: IntegrationIdentity = {};

    try {
      identity = await this.fetchIdentity(provider, token);
    } catch (error) {
      this.reportOAuthCallbackError(provider, "identity_fetch", error);
    }

    try {
      await this.upsertAccount(Number(stateRow.user_id), provider, token, identity);
    } catch (error) {
      this.reportOAuthCallbackError(provider, "account_persistence", error);
      return this.redirectToApp(redirectPath, {
        integrationProvider: provider,
        integrationStatus: "error",
        integrationError: "oauth_callback_failed",
      });
    }

    return this.redirectToApp(redirectPath, {
      integrationProvider: provider,
      integrationStatus: "connected",
    });
  }

  async disconnect(session: RequestSession, rawProvider: string): Promise<IntegrationOwnerPayload> {
    await this.requireStorage();
    const provider = providerFromInput(rawProvider);

    await this.pool.execute(
      `UPDATE profile_integration_accounts
       SET revoked_at = UTC_TIMESTAMP(),
           updated_at = UTC_TIMESTAMP()
       WHERE user_id = ?
         AND provider = ?
         AND revoked_at IS NULL`,
      [session.userId, provider],
    );

    return this.ownerPayload(session.userId);
  }

  async suggestions(session: RequestSession, rawProvider: string): Promise<IntegrationSuggestionsPayload> {
    await this.requireStorage();
    const provider = providerFromInput(rawProvider);
    const status = this.providerStatus(provider);
    const account = await this.accountForUser(session.userId, provider);
    const activeAccount = account !== null && account.revokedAt === null ? account : null;
    let items: IntegrationSuggestionItemPayload[] = [];
    let message: string | null = null;

    if (!status.configured) {
      message = "This provider is not configured yet.";
    } else if (provider === "apple_music") {
      message = "Paste an Apple Music URL to add a music card.";
    } else if (activeAccount === null) {
      message = "Connect this provider to see suggestions, or paste a supported URL.";
    } else {
      try {
        items = await this.suggestionItems(provider, session.userId, activeAccount);
      } catch {
        message = "Suggestions are not available right now. Pasted URLs still work.";
      }
    }

    return {
      provider,
      status,
      account: activeAccount,
      items,
      message,
      generatedAt: this.isoNow(),
    };
  }

  async resolveMetadata(session: RequestSession, body: Record<string, unknown>): Promise<IntegrationCardPayload> {
    await this.requireStorage();
    rejectUnknownKeys(body, ["url", "provider"]);
    const url = integrationUrl(body.url);
    const preferredProvider = body.provider === undefined ? null : providerFromInput(String(body.provider));
    const card = await this.resolveUrl(url, preferredProvider, session.userId);

    if (card === null) {
      throw new IntegrationRouteError("Choose a supported integration URL.", 422);
    }

    return card;
  }

  async resolvePublicMetadata(
    rawUrl: string,
    preferredProvider: string | null,
  ): Promise<IntegrationCardPayload | null> {
    const provider = preferredProvider === null ? null : providerFromInput(preferredProvider);

    return this.resolveUrl(rawUrl, provider, null);
  }

  private async ownerPayload(userId: number): Promise<IntegrationOwnerPayload> {
    return {
      providers: integrationProviders.map((provider) => this.providerStatus(provider)),
      accounts: await this.accountsForUser(userId),
    };
  }

  private providerStatus(provider: IntegrationProvider): IntegrationProviderStatusPayload {
    const config = this.config(provider);

    return {
      provider,
      configured: providerConfigured(provider, config),
      oauthEnabled: providerOauthEnabled(provider, config),
      linkSupported: true,
      metadataEnabled: providerMetadataEnabled(provider, config),
      missingConfigKeys: providerMissingConfigKeys(provider, config),
    };
  }

  private async accountsForUser(userId: number): Promise<IntegrationAccountPayload[]> {
    const [rows] = await this.pool.execute<IntegrationAccountRow[]>(
      `SELECT provider, provider_account_id, provider_handle, display_name, avatar_url,
              scopes_json, token_expires_at, connected_at, refreshed_at, revoked_at, last_error, error_at
       FROM profile_integration_accounts
       WHERE user_id = ?
       ORDER BY provider ASC`,
      [userId],
    );

    return rows.map((row) => accountPayload(row));
  }

  private async accountForUser(
    userId: number,
    provider: IntegrationProvider,
  ): Promise<IntegrationAccountPayload | null> {
    const [rows] = await this.pool.execute<IntegrationAccountRow[]>(
      `SELECT provider, provider_account_id, provider_handle, display_name, avatar_url,
              scopes_json, token_expires_at, connected_at, refreshed_at, revoked_at, last_error, error_at
       FROM profile_integration_accounts
       WHERE user_id = ?
         AND provider = ?
       LIMIT 1`,
      [userId, provider],
    );
    const row = rows[0];

    return row === undefined ? null : accountPayload(row);
  }

  private async oauthStateRow(
    provider: IntegrationProvider,
    state: string,
  ): Promise<IntegrationStateRow | null> {
    const [rows] = await this.pool.execute<IntegrationStateRow[]>(
      `SELECT *
       FROM profile_integration_oauth_states
       WHERE provider = ?
         AND state_hash = ?
         AND consumed_at IS NULL
         AND expires_at > UTC_TIMESTAMP()
       LIMIT 1`,
      [provider, sha256(state)],
    );

    return rows[0] ?? null;
  }

  private async consumeOAuthState(stateRow: IntegrationStateRow): Promise<void> {
    await this.pool.execute(
      `UPDATE profile_integration_oauth_states
       SET consumed_at = UTC_TIMESTAMP()
       WHERE id = ?
         AND consumed_at IS NULL`,
      [stateRow.id],
    );
  }

  private async upsertAccount(
    userId: number,
    provider: IntegrationProvider,
    token: OAuthTokenResponse,
    identity: IntegrationIdentity,
  ): Promise<void> {
    const accessToken = typeof token.access_token === "string" ? token.access_token : "";
    const refreshToken = typeof token.refresh_token === "string" ? token.refresh_token : "";
    const expiresIn = numericValue(token.expires_in);
    const tokenExpiresAt = expiresIn === null ? null : sqlDate(new Date(this.now().getTime() + Math.max(0, expiresIn) * 1000));
    const scopes = tokenScopes(token.scope);

    await this.pool.execute(
      `INSERT INTO profile_integration_accounts
          (user_id, provider, provider_account_id, provider_handle, display_name, avatar_url,
           scopes_json, access_token_cipher, refresh_token_cipher, token_expires_at, connected_at, refreshed_at)
       VALUES
          (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, UTC_TIMESTAMP(), UTC_TIMESTAMP())
       ON DUPLICATE KEY UPDATE
           provider_account_id = VALUES(provider_account_id),
           provider_handle = VALUES(provider_handle),
           display_name = VALUES(display_name),
           avatar_url = VALUES(avatar_url),
           scopes_json = VALUES(scopes_json),
           access_token_cipher = VALUES(access_token_cipher),
           refresh_token_cipher = COALESCE(VALUES(refresh_token_cipher), refresh_token_cipher),
           token_expires_at = VALUES(token_expires_at),
           refreshed_at = UTC_TIMESTAMP(),
           revoked_at = NULL,
           last_error = NULL,
           error_at = NULL,
           updated_at = UTC_TIMESTAMP()`,
      [
        userId,
        provider,
        String(identity.id ?? `${provider}:${userId}`),
        identity.handle ?? null,
        identity.displayName ?? null,
        identity.avatarUrl ?? null,
        JSON.stringify(scopes),
        accessToken === "" ? null : this.encrypt(accessToken),
        refreshToken === "" ? null : this.encrypt(refreshToken),
        tokenExpiresAt,
      ],
    );
  }

  private authorizationUrl(provider: IntegrationProvider, state: string, codeVerifier: string): string {
    const config = this.config(provider);
    const redirectUri = this.redirectUri(provider);
    const clientId = config.clientId ?? "";
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: integrationScope(provider),
      state,
    });
    let baseUrl: string;

    if (provider === "apple_music") {
      throw new IntegrationRouteError("Apple Music uses MusicKit user authorization instead of this OAuth redirect flow.", 422);
    }

    if (provider === "spotify") {
      baseUrl = "https://accounts.spotify.com/authorize";
    } else if (provider === "youtube") {
      baseUrl = "https://accounts.google.com/o/oauth2/v2/auth";
      params.set("access_type", "offline");
      params.set("prompt", "consent");
      params.set("code_challenge", base64Url(createHash("sha256").update(codeVerifier).digest()));
      params.set("code_challenge_method", "S256");
    } else if (provider === "twitch") {
      baseUrl = "https://id.twitch.tv/oauth2/authorize";
    } else {
      baseUrl = "https://github.com/login/oauth/authorize";
    }

    return `${baseUrl}?${params.toString()}`;
  }

  private async exchangeCode(
    provider: IntegrationProvider,
    code: string,
    codeVerifier: string,
  ): Promise<OAuthTokenResponse> {
    const config = this.config(provider);
    const clientId = config.clientId ?? "";
    const clientSecret = config.clientSecret ?? "";
    const redirectUri = this.redirectUri(provider);
    const url = tokenUrl(provider);
    const body: Record<string, string> = {
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      client_secret: clientSecret,
    };
    const headers = ["Accept: application/json"];

    if (provider === "youtube") {
      body.code_verifier = codeVerifier;
    }

    if (provider === "spotify") {
      headers.push(`Authorization: Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`);
      delete body.client_id;
      delete body.client_secret;
    }

    const response = await this.httpJson("POST", url, headers, body);

    if (!isRecord(response) || typeof response.access_token !== "string") {
      throw new Error("OAuth token exchange failed.");
    }

    return response as OAuthTokenResponse;
  }

  private async fetchIdentity(
    provider: IntegrationProvider,
    token: OAuthTokenResponse,
  ): Promise<IntegrationIdentity> {
    const accessToken = typeof token.access_token === "string" ? token.access_token : "";

    if (accessToken === "") {
      return {};
    }

    const headers = [`Authorization: Bearer ${accessToken}`];
    const config = this.config(provider);
    let url: string | null = null;

    if (provider === "spotify") {
      url = "https://api.spotify.com/v1/me";
    } else if (provider === "youtube") {
      url = "https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true";
    } else if (provider === "twitch") {
      url = "https://api.twitch.tv/helix/users";
      headers.push(`Client-Id: ${config.clientId ?? ""}`);
    } else if (provider === "github") {
      url = "https://api.github.com/user";
    }

    if (url === null) {
      return {};
    }

    const response = await this.httpJson("GET", url, headers);

    if (!isRecord(response)) {
      return {};
    }

    if (provider === "spotify") {
      return {
        id: stringRecordValue(response, "id"),
        handle: stringRecordValue(response, "display_name"),
        displayName: stringRecordValue(response, "display_name"),
        avatarUrl: nestedString(response, ["images", 0, "url"]),
      };
    }

    if (provider === "youtube") {
      return {
        id: nestedString(response, ["items", 0, "id"]),
        handle: nestedString(response, ["items", 0, "snippet", "customUrl"]),
        displayName: nestedString(response, ["items", 0, "snippet", "title"]),
        avatarUrl: nestedString(response, ["items", 0, "snippet", "thumbnails", "default", "url"]),
      };
    }

    if (provider === "twitch") {
      return {
        id: nestedString(response, ["data", 0, "id"]),
        handle: nestedString(response, ["data", 0, "login"]),
        displayName: nestedString(response, ["data", 0, "display_name"]),
        avatarUrl: nestedString(response, ["data", 0, "profile_image_url"]),
      };
    }

    return {
      id: valueToString(response.id) ?? null,
      handle: stringRecordValue(response, "login"),
      displayName: stringRecordValue(response, "name") ?? stringRecordValue(response, "login"),
      avatarUrl: stringRecordValue(response, "avatar_url"),
    };
  }

  private async resolveUrl(
    rawUrl: string,
    preferredProvider: IntegrationProvider | null,
    userId: number | null,
  ): Promise<IntegrationCardPayload | null> {
    if (!(await this.storageReady())) {
      return this.generatedCard(rawUrl, preferredProvider);
    }

    const normalized = normalizeIntegrationUrl(rawUrl, preferredProvider);

    if (normalized === null) {
      return null;
    }

    const cached = await this.cacheRecord(normalized.provider, normalized.resourceKey);

    if (cached !== null && cacheIsFresh(cached, this.now())) {
      return cachePayload(cached);
    }

    try {
      const fresh = await this.fetchMetadata(normalized, userId);
      await this.cacheUpsert(fresh, null);

      return fresh;
    } catch (error) {
      if (cached !== null) {
        await this.cacheMarkError(Number(cached.id), error instanceof Error ? error.message : String(error));
        return cachePayload(cached, true);
      }

      const fallback = this.generatedCard(rawUrl, preferredProvider);

      if (fallback !== null) {
        await this.cacheUpsert(fallback, error instanceof Error ? error.message : String(error));
      }

      return fallback;
    }
  }

  private generatedCard(rawUrl: string, preferredProvider: IntegrationProvider | null): IntegrationCardPayload | null {
    const normalized = normalizeIntegrationUrl(rawUrl, preferredProvider);

    if (normalized === null) {
      return null;
    }

    return this.cardPayload(normalized, fallbackMetadata(normalized), embedPayload(normalized, this.config("twitch")), false);
  }

  private async fetchMetadata(
    normalized: NormalizedIntegrationUrl,
    userId: number | null,
  ): Promise<IntegrationCardPayload> {
    let metadata = fallbackMetadata(normalized);

    if (normalized.provider === "github") {
      metadata = mergeMetadata(metadata, await this.fetchGithubRepo(normalized));
    } else if (normalized.provider === "spotify") {
      metadata = mergeMetadata(metadata, await this.fetchSpotifyResource(normalized));
    } else if (normalized.provider === "youtube") {
      metadata = mergeMetadata(metadata, await this.fetchYoutubeResource(normalized));
    } else if (normalized.provider === "twitch") {
      metadata = mergeMetadata(metadata, await this.fetchTwitchResource(normalized));
    } else if (normalized.provider === "apple_music") {
      metadata = mergeMetadata(metadata, await this.fetchAppleMusicResource(normalized));
    }

    void userId;

    return this.cardPayload(normalized, metadata, embedPayload(normalized, this.config("twitch")), true);
  }

  private cardPayload(
    normalized: NormalizedIntegrationUrl,
    metadata: IntegrationMetadataPayload,
    embed: IntegrationEmbedPayload | null,
    apiBacked: boolean,
  ): IntegrationCardPayload {
    const now = this.now();
    const ttlSeconds = integrationCacheTtlSeconds(normalized.provider);

    return {
      provider: normalized.provider,
      resourceType: normalized.resourceType,
      resourceId: normalized.resourceId,
      resourceKey: normalized.resourceKey,
      sourceUrl: normalized.sourceUrl,
      metadata,
      embed,
      apiBacked,
      fetchedAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + ttlSeconds * 1000).toISOString(),
      staleAt: new Date(now.getTime() + integrationStaleSeconds * 1000).toISOString(),
    };
  }

  private async fetchGithubRepo(normalized: NormalizedIntegrationUrl): Promise<Partial<IntegrationMetadataPayload>> {
    const [owner, repo] = normalized.resourceId.split("/", 2);
    const response = await this.httpJson(
      "GET",
      `https://api.github.com/repos/${encodeURIComponent(owner ?? "")}/${encodeURIComponent(repo ?? "")}`,
      ["Accept: application/vnd.github+json"],
    );

    if (!isRecord(response)) {
      return {};
    }

    return {
      title: stringRecordValue(response, "full_name") ?? normalized.resourceId,
      subtitle: "GitHub repository",
      description: stringRecordValue(response, "description"),
      imageUrl: nestedString(response, ["owner", "avatar_url"]),
      stats: {
        stars: response.stargazers_count ?? null,
        forks: response.forks_count ?? null,
        language: response.language ?? null,
        updatedAt: response.updated_at ?? null,
      },
    };
  }

  private async fetchSpotifyResource(normalized: NormalizedIntegrationUrl): Promise<Partial<IntegrationMetadataPayload>> {
    const token = await this.spotifyAppToken();
    const resourceType = normalized.resourceType;

    if (!["track", "album", "playlist", "artist", "episode", "show"].includes(resourceType)) {
      return {};
    }

    const response = await this.httpJson(
      "GET",
      `https://api.spotify.com/v1/${encodeURIComponent(`${resourceType}s`)}/${encodeURIComponent(normalized.resourceId)}`,
      [`Authorization: Bearer ${token}`],
    );

    if (!isRecord(response)) {
      return {};
    }

    const artists = response.artists ?? nestedValue(response, ["owner", "display_name"]);
    const subtitle = Array.isArray(artists)
      ? artists
          .map((artist) => (isRecord(artist) && typeof artist.name === "string" ? artist.name : ""))
          .join(", ")
      : typeof artists === "string"
        ? artists
        : "Spotify";
    const stats: Record<string, unknown> = {};

    if (resourceType === "artist") {
      const genres = Array.isArray(response.genres) ? response.genres.filter((item) => typeof item === "string") : [];
      stats.followers = nestedValue(response, ["followers", "total"]) ?? null;
      stats.popularity = response.popularity ?? null;
      stats.genres = genres.slice(0, 2).join(", ") || null;
    }

    if (resourceType === "playlist") {
      stats.items = nestedValue(response, ["tracks", "total"]) ?? null;
      stats.tracks = spotifyPlaylistTracks(response);
    }

    return {
      title: stringRecordValue(response, "name") ?? `Spotify ${resourceType}`,
      subtitle: subtitle.trim() === "" ? "Spotify" : subtitle,
      description: stringRecordValue(response, "description") ?? (typeof stats.genres === "string" ? stats.genres : null),
      imageUrl: nestedString(response, ["images", 0, "url"]) ?? nestedString(response, ["album", "images", 0, "url"]),
      stats,
    };
  }

  private async spotifyAppToken(): Promise<string> {
    const config = this.config("spotify");
    const clientId = config.clientId ?? "";
    const clientSecret = config.clientSecret ?? "";

    if (clientId === "" || clientSecret === "") {
      throw new Error("Spotify credentials are not configured.");
    }

    const response = await this.httpJson(
      "POST",
      "https://accounts.spotify.com/api/token",
      [`Authorization: Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`],
      { grant_type: "client_credentials" },
    );

    if (!isRecord(response) || typeof response.access_token !== "string") {
      throw new Error("Spotify app token response was invalid.");
    }

    return response.access_token;
  }

  private async fetchYoutubeResource(normalized: NormalizedIntegrationUrl): Promise<Partial<IntegrationMetadataPayload>> {
    const apiKey = this.config("youtube").apiKey ?? "";

    if (apiKey === "") {
      throw new Error("YouTube API key is not configured.");
    }

    const params = new URLSearchParams({
      part: "snippet,statistics",
      key: apiKey,
    });
    let url: string;

    if (normalized.resourceType === "video") {
      params.set("id", normalized.resourceId);
      url = `https://www.googleapis.com/youtube/v3/videos?${params.toString()}`;
    } else if (normalized.resourceType === "playlist") {
      params.set("id", normalized.resourceId);
      params.set("part", "snippet,contentDetails");
      url = `https://www.googleapis.com/youtube/v3/playlists?${params.toString()}`;
    } else {
      params.set(normalized.resourceId.startsWith("@") ? "forHandle" : "id", normalized.resourceId);
      url = `https://www.googleapis.com/youtube/v3/channels?${params.toString()}`;
    }

    const response = await this.httpJson("GET", url);
    const item = nestedValue(response, ["items", 0]);

    if (!isRecord(item)) {
      return {};
    }

    const stats: Record<string, unknown> = {
      views: nestedValue(item, ["statistics", "viewCount"]) ?? null,
      subscribers: nestedValue(item, ["statistics", "subscriberCount"]) ?? null,
      items: nestedValue(item, ["contentDetails", "itemCount"]) ?? null,
    };

    if (normalized.resourceType === "playlist") {
      stats.tracks = await this.fetchYoutubePlaylistTracks(normalized.resourceId, apiKey);
    }

    return {
      title: nestedString(item, ["snippet", "title"]) ?? "YouTube",
      subtitle: "YouTube",
      description: nestedString(item, ["snippet", "description"]),
      imageUrl: nestedString(item, ["snippet", "thumbnails", "medium", "url"]) ?? nestedString(item, ["snippet", "thumbnails", "default", "url"]),
      stats,
    };
  }

  private async fetchYoutubePlaylistTracks(
    playlistId: string,
    apiKey: string,
  ): Promise<IntegrationPlaylistTrackPayload[]> {
    const params = new URLSearchParams({
      part: "snippet,contentDetails",
      playlistId,
      maxResults: "12",
      key: apiKey,
    });
    const response = await this.httpJson(
      "GET",
      `https://www.googleapis.com/youtube/v3/playlistItems?${params.toString()}`,
    );
    const rows = Array.isArray(nestedValue(response, ["items"]))
      ? nestedValue(response, ["items"]) as unknown[]
      : [];

    const tracks: IntegrationPlaylistTrackPayload[] = [];

    for (const row of rows) {
      const title = nestedString(row, ["snippet", "title"]);
      const videoId =
        nestedString(row, ["contentDetails", "videoId"]) ??
        nestedString(row, ["snippet", "resourceId", "videoId"]);

      if (title === null || title === "" || videoId === null || videoId === "") {
        continue;
      }

      tracks.push({
        id: videoId,
        title,
        artist: nestedString(row, ["snippet", "videoOwnerChannelTitle"]) ?? "YouTube",
        sourceUrl: `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`,
      });
    }

    return tracks;
  }

  private async fetchTwitchResource(normalized: NormalizedIntegrationUrl): Promise<Partial<IntegrationMetadataPayload>> {
    const token = await this.twitchAppToken();
    const config = this.config("twitch");
    const headers = [
      `Authorization: Bearer ${token}`,
      `Client-Id: ${config.clientId ?? ""}`,
    ];

    if (normalized.resourceType !== "channel") {
      return {};
    }

    const user = await this.httpJson(
      "GET",
      `https://api.twitch.tv/helix/users?login=${encodeURIComponent(normalized.resourceId)}`,
      headers,
    );
    const stream = await this.httpJson(
      "GET",
      `https://api.twitch.tv/helix/streams?user_login=${encodeURIComponent(normalized.resourceId)}`,
      headers,
    );
    const userData = nestedValue(user, ["data", 0]);
    const streamData = nestedValue(stream, ["data", 0]);
    const isLive = isRecord(streamData);

    return {
      title: (isRecord(userData) ? stringRecordValue(userData, "display_name") : null) ?? `@${normalized.resourceId}`,
      subtitle: "Twitch channel",
      description: isRecord(userData) ? stringRecordValue(userData, "description") : null,
      imageUrl: isRecord(userData) ? stringRecordValue(userData, "profile_image_url") : null,
      live: isLive,
      liveFetchedAt: this.isoNow(),
      recentLabel: isLive ? stringRecordValue(streamData, "title") ?? "Live now" : null,
      recentFetchedAt: isLive ? this.isoNow() : null,
      stats: {
        viewers: isLive ? streamData.viewer_count ?? null : null,
        game: isLive ? streamData.game_name ?? null : null,
      },
    };
  }

  private async twitchAppToken(): Promise<string> {
    const config = this.config("twitch");
    const clientId = config.clientId ?? "";
    const clientSecret = config.clientSecret ?? "";

    if (clientId === "" || clientSecret === "") {
      throw new Error("Twitch credentials are not configured.");
    }

    const response = await this.httpJson(
      "POST",
      "https://id.twitch.tv/oauth2/token",
      ["Accept: application/json"],
      {
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "client_credentials",
      },
    );

    if (!isRecord(response) || typeof response.access_token !== "string") {
      throw new Error("Twitch app token response was invalid.");
    }

    return response.access_token;
  }

  private async fetchAppleMusicResource(normalized: NormalizedIntegrationUrl): Promise<Partial<IntegrationMetadataPayload>> {
    const config = this.config("apple_music");
    const developerToken = config.developerToken ?? "";
    const storefront = (config.storefront ?? "us").replace(/[^a-zA-Z0-9_-]/gu, "") || "us";

    if (developerToken === "") {
      throw new Error("Apple Music developer token is not configured.");
    }

    const resourceType = normalized.resourceType === "song" ? "songs" : `${normalized.resourceType}s`;
    const params = normalized.resourceType === "playlist"
      ? "?include=tracks"
      : "";
    const response = await this.httpJson(
      "GET",
      `https://api.music.apple.com/v1/catalog/${storefront}/${resourceType}/${encodeURIComponent(normalized.resourceId)}${params}`,
      [`Authorization: Bearer ${developerToken}`],
    );
    const item = nestedValue(response, ["data", 0, "attributes"]);

    if (!isRecord(item)) {
      return {};
    }

    const description = item.description;

    return {
      title: stringRecordValue(item, "name") ?? "Apple Music",
      subtitle: stringRecordValue(item, "artistName") ?? "Apple Music",
      description: isRecord(description) ? stringRecordValue(description, "standard") : typeof description === "string" ? description : null,
      imageUrl: stringRecordValue(item.artwork, "url")?.replaceAll("{w}", "300").replaceAll("{h}", "300") ?? null,
      stats: normalized.resourceType === "playlist"
        ? {
            tracks: appleMusicPlaylistTracks(response),
          }
        : {},
    };
  }

  private async suggestionItems(
    provider: IntegrationProvider,
    userId: number,
    account: IntegrationAccountPayload,
  ): Promise<IntegrationSuggestionItemPayload[]> {
    if (provider === "spotify") {
      return this.spotifySuggestions(userId);
    }

    if (provider === "youtube") {
      return this.youtubeSuggestions(account, userId);
    }

    if (provider === "twitch") {
      return this.twitchSuggestions(account, userId);
    }

    if (provider === "github") {
      return this.githubSuggestions(userId);
    }

    return [];
  }

  private async spotifySuggestions(userId: number): Promise<IntegrationSuggestionItemPayload[]> {
    const token = await this.accessToken(userId, "spotify");

    if (token === null) {
      return [];
    }

    const items: IntegrationSuggestionItemPayload[] = [];
    const seenUrls = new Set<string>();

    const addSpotifyUrl = async (url: string | null, label: string, description: string) => {
      if (url === null || url === "" || seenUrls.has(url)) {
        return;
      }

      seenUrls.add(url);
      const card = await this.resolveUrl(url, "spotify", userId);
      items.push(suggestionItem(`spotify:${md5(url)}`, label, description, url, "music", card));
    };

    const recent = await this.httpJson(
      "GET",
      "https://api.spotify.com/v1/me/player/recently-played?limit=5",
      [`Authorization: Bearer ${token}`],
    ).catch(() => null);
    const recentRows = Array.isArray(nestedValue(recent, ["items"])) ? nestedValue(recent, ["items"]) as unknown[] : [];

    for (const item of recentRows) {
      const track = isRecord(item) ? item.track : null;
      const title = isRecord(track) && typeof track.name === "string" ? track.name : "Spotify track";

      await addSpotifyUrl(nestedString(track, ["external_urls", "spotify"]), title, "Recently played on Spotify");
    }

    const top = await this.httpJson(
      "GET",
      "https://api.spotify.com/v1/me/top/tracks?limit=5&time_range=short_term",
      [`Authorization: Bearer ${token}`],
    ).catch(() => null);
    const topRows = Array.isArray(nestedValue(top, ["items"])) ? nestedValue(top, ["items"]) as unknown[] : [];

    for (const track of topRows) {
      const title = isRecord(track) && typeof track.name === "string" ? track.name : "Spotify track";

      await addSpotifyUrl(nestedString(track, ["external_urls", "spotify"]), title, "Top track on Spotify");
    }

    const playlists = await this.httpJson(
      "GET",
      "https://api.spotify.com/v1/me/playlists?limit=5",
      [`Authorization: Bearer ${token}`],
    ).catch(() => null);
    const playlistRows = Array.isArray(nestedValue(playlists, ["items"])) ? nestedValue(playlists, ["items"]) as unknown[] : [];

    for (const playlist of playlistRows) {
      const title = isRecord(playlist) && typeof playlist.name === "string" ? playlist.name : "Spotify playlist";

      await addSpotifyUrl(nestedString(playlist, ["external_urls", "spotify"]), title, "Spotify playlist");
    }

    return items;
  }

  private async youtubeSuggestions(
    account: IntegrationAccountPayload,
    userId: number,
  ): Promise<IntegrationSuggestionItemPayload[]> {
    const handle = accountHandle(account);

    if (handle === null) {
      return [];
    }

    const sourceUrl = handle.startsWith("@")
      ? `https://www.youtube.com/${handle.replace(/[^A-Za-z0-9_@.-]/gu, "")}`
      : `https://www.youtube.com/channel/${encodeURIComponent(account.providerAccountId)}`;
    const card = this.generatedCard(sourceUrl, "youtube");
    const items: IntegrationSuggestionItemPayload[] = [];
    const token = await this.accessToken(userId, "youtube");

    if (token !== null) {
      const playlists = await this.httpJson(
        "GET",
        "https://www.googleapis.com/youtube/v3/playlists?part=snippet&mine=true&maxResults=5",
        [`Authorization: Bearer ${token}`],
      ).catch(() => null);
      const rows = Array.isArray(nestedValue(playlists, ["items"])) ? nestedValue(playlists, ["items"]) as unknown[] : [];

      for (const playlist of rows) {
        const playlistId = nestedString(playlist, ["id"]);

        if (playlistId === null || playlistId === "") {
          continue;
        }

        const playlistUrl = `https://www.youtube.com/playlist?list=${encodeURIComponent(playlistId)}`;
        const playlistCard = await this.resolveUrl(playlistUrl, "youtube", userId);
        const title = nestedString(playlist, ["snippet", "title"]) ?? "YouTube playlist";

        items.push(suggestionItem(`youtube:playlist:${playlistId}`, title, "YouTube playlist", playlistUrl, "music", playlistCard));
      }
    }

    items.push(
      suggestionItem(
        `youtube:channel:${account.providerAccountId}`,
        account.displayName ?? handle,
        "Connected YouTube channel",
        sourceUrl,
        "creator_live",
        card,
      ),
    );

    return items;
  }

  private async twitchSuggestions(
    account: IntegrationAccountPayload,
    userId: number,
  ): Promise<IntegrationSuggestionItemPayload[]> {
    const handle = accountHandle(account);

    if (handle === null) {
      return [];
    }

    const cleanHandle = handle.replace(/^@/u, "");
    const sourceUrl = `https://www.twitch.tv/${encodeURIComponent(cleanHandle)}`;
    const card = await this.resolveUrl(sourceUrl, "twitch", userId);

    return [
      suggestionItem(
        `twitch:channel:${cleanHandle}`,
        account.displayName ?? `@${cleanHandle}`,
        "Connected Twitch channel",
        sourceUrl,
        "creator_live",
        card,
      ),
    ];
  }

  private async githubSuggestions(userId: number): Promise<IntegrationSuggestionItemPayload[]> {
    const token = await this.accessToken(userId, "github");

    if (token === null) {
      return [];
    }

    const response = await this.httpJson(
      "GET",
      "https://api.github.com/user/repos?visibility=public&sort=updated&per_page=5",
      [
        `Authorization: Bearer ${token}`,
        "Accept: application/vnd.github+json",
      ],
    );
    const repos = Array.isArray(response) ? response : [];
    const items: IntegrationSuggestionItemPayload[] = [];

    for (const repo of repos) {
      if (!isRecord(repo) || typeof repo.html_url !== "string" || typeof repo.full_name !== "string") {
        continue;
      }

      const card = await this.resolveUrl(repo.html_url, "github", userId);
      items.push(
        suggestionItem(
          `github:repo:${repo.full_name.toLowerCase()}`,
          repo.full_name,
          typeof repo.description === "string" && repo.description !== "" ? repo.description : "Public GitHub repository",
          repo.html_url,
          "creator_live",
          card,
        ),
      );
    }

    return items;
  }

  private async accessToken(userId: number, provider: IntegrationProvider): Promise<string | null> {
    const [rows] = await this.pool.execute<IntegrationAccountRow[]>(
      `SELECT access_token_cipher
       FROM profile_integration_accounts
       WHERE user_id = ?
         AND provider = ?
         AND revoked_at IS NULL
       LIMIT 1`,
      [userId, provider],
    );
    const cipher = rows[0]?.access_token_cipher;

    if (typeof cipher !== "string" || cipher === "") {
      return null;
    }

    return this.decryptOrThrow(cipher);
  }

  private async cacheRecord(provider: IntegrationProvider, resourceKey: string): Promise<IntegrationCacheRow | null> {
    const [rows] = await this.pool.execute<IntegrationCacheRow[]>(
      `SELECT *
       FROM profile_integration_metadata_cache
       WHERE provider = ?
         AND resource_key = ?
       LIMIT 1`,
      [provider, resourceKey],
    );

    return rows[0] ?? null;
  }

  private async cacheUpsert(card: IntegrationCardPayload, error: string | null): Promise<void> {
    const expiresAt = sqlDate(new Date(
      this.now().getTime() + integrationCacheTtlSeconds(card.provider) * 1000,
    ));
    const staleAt = sqlDate(new Date(this.now().getTime() + integrationStaleSeconds * 1000));

    await this.pool.execute(
      `INSERT INTO profile_integration_metadata_cache
          (provider, resource_type, resource_id, resource_key, source_url, metadata_json, embed_json,
           api_backed, fetched_at, expires_at, stale_at, error_message, error_at)
       VALUES
          (?, ?, ?, ?, ?, ?, ?, ?, UTC_TIMESTAMP(), ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
           resource_type = VALUES(resource_type),
           resource_id = VALUES(resource_id),
           source_url = VALUES(source_url),
           metadata_json = VALUES(metadata_json),
           embed_json = VALUES(embed_json),
           api_backed = VALUES(api_backed),
           fetched_at = UTC_TIMESTAMP(),
           expires_at = VALUES(expires_at),
           stale_at = VALUES(stale_at),
           error_message = VALUES(error_message),
           error_at = VALUES(error_at),
           updated_at = UTC_TIMESTAMP()`,
      [
        card.provider,
        card.resourceType,
        card.resourceId,
        card.resourceKey,
        card.sourceUrl,
        JSON.stringify(card.metadata),
        card.embed === null ? null : JSON.stringify(card.embed),
        card.apiBacked ? 1 : 0,
        expiresAt,
        staleAt,
        error,
        error === null ? null : sqlDate(this.now()),
      ],
    );
  }

  private async cacheMarkError(cacheId: number, message: string): Promise<void> {
    await this.pool.execute(
      `UPDATE profile_integration_metadata_cache
       SET error_message = ?,
           error_at = UTC_TIMESTAMP(),
           updated_at = UTC_TIMESTAMP()
       WHERE id = ?`,
      [message.slice(0, 240), cacheId],
    );
  }

  private async requireStorage(): Promise<void> {
    if (!(await this.storageReady())) {
      throw new IntegrationStorageNotReadyError();
    }
  }

  private storageReady(): Promise<boolean> {
    this.storageReadyPromise ??= this.computeStorageReady();

    return this.storageReadyPromise;
  }

  private async computeStorageReady(): Promise<boolean> {
    const checks = await Promise.all([
      this.tableExists("profile_integration_accounts"),
      this.tableExists("profile_integration_oauth_states"),
      this.tableExists("profile_integration_metadata_cache"),
      this.columnExists("profile_integration_accounts", "access_token_cipher"),
      this.columnExists("profile_integration_accounts", "refresh_token_cipher"),
      this.columnExists("profile_integration_accounts", "provider_account_id"),
      this.columnExists("profile_integration_accounts", "scopes_json"),
      this.columnExists("profile_integration_oauth_states", "code_verifier_cipher"),
      this.columnExists("profile_integration_oauth_states", "redirect_path"),
      this.columnExists("profile_integration_metadata_cache", "metadata_json"),
      this.columnExists("profile_integration_metadata_cache", "embed_json"),
    ]);

    return checks.every(Boolean);
  }

  private async tableExists(tableName: string): Promise<boolean> {
    const [rows] = await this.pool.execute<ExistsRow[]>(
      `SELECT COUNT(*) AS item_count
       FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = ?`,
      [tableName],
    );

    return Number(rows[0]?.item_count ?? 0) > 0;
  }

  private async columnExists(tableName: string, columnName: string): Promise<boolean> {
    const [rows] = await this.pool.execute<ExistsRow[]>(
      `SELECT COUNT(*) AS item_count
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = ?
         AND COLUMN_NAME = ?`,
      [tableName, columnName],
    );

    return Number(rows[0]?.item_count ?? 0) > 0;
  }

  private redirectUri(provider: IntegrationProvider): string {
    const configured = this.config(provider).redirectUri;

    if (configured !== undefined && configured !== "" && validAbsoluteUrl(configured)) {
      return configured;
    }

    return `${this.publicBaseUrl()}/api/integrations/${provider}/callback`;
  }

  private redirectToApp(redirectPath: string, query: Record<string, string>): IntegrationRedirectPayload {
    const safePath = redirectPathFromValue(redirectPath);
    const separator = safePath.includes("?") ? "&" : "?";
    const params = new URLSearchParams(query);

    return {
      location: `${this.publicBaseUrl()}${safePath}${separator}${params.toString()}`,
    };
  }

  private config(provider: IntegrationProvider): IntegrationProviderConfig {
    return this.options.providers[provider] ?? {};
  }

  private httpJson(method: "GET" | "POST", url: string, headers: string[] = [], body?: Record<string, string>): Promise<unknown> {
    return (this.options.httpJson ?? defaultHttpJson)(method, url, headers, body);
  }

  private reportOAuthCallbackError(
    provider: IntegrationProvider,
    stage: IntegrationOAuthCallbackErrorEvent["stage"],
    error: unknown,
  ): void {
    this.options.onOAuthCallbackError?.({
      error: error instanceof Error ? error : new Error("Unknown OAuth callback error."),
      provider,
      stage,
    });
  }

  private now(): Date {
    return this.options.now?.() ?? new Date();
  }

  private isoNow(): string {
    return this.now().toISOString();
  }

  private publicBaseUrl(): string {
    const trimmed = this.options.publicBaseUrl.replace(/\/+$/u, "");

    return trimmed === "" ? "https://thia.lol" : trimmed;
  }

  private encryptionKey(): Buffer | null {
    const value = this.options.encryptionKey.trim();

    if (value === "") {
      return null;
    }

    const decoded = Buffer.from(value, "base64");

    if (decoded.length === 32 && decoded.toString("base64").replace(/=+$/u, "") === value.replace(/=+$/u, "")) {
      return decoded;
    }

    const raw = Buffer.from(value);

    return raw.length >= 32 ? raw.subarray(0, 32) : null;
  }

  private requireEncryptionKey(): Buffer {
    const key = this.encryptionKey();

    if (key === null) {
      throw new IntegrationRouteError("Integration encryption is not configured.", 503);
    }

    return key;
  }

  private encrypt(value: string): string {
    const key = this.requireEncryptionKey();
    const nonce = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", key, nonce);
    const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();

    return `${opensslPrefix}${Buffer.concat([nonce, tag, encrypted]).toString("base64")}`;
  }

  private decryptOrThrow(value: string): string {
    const key = this.requireEncryptionKey();

    if (value.startsWith(opensslPrefix)) {
      return decryptOpenssl(value.slice(opensslPrefix.length), key);
    }

    return decryptSodium(value, key);
  }
}

function providerFromInput(value: string): IntegrationProvider {
  let provider = value.trim().toLowerCase();

  if (provider === "google") {
    provider = "youtube";
  }

  if (integrationProviders.includes(provider as IntegrationProvider)) {
    return provider as IntegrationProvider;
  }

  throw new IntegrationRouteError("Choose a supported integration provider.", 422);
}

function providerFromPlatform(platform: string | null): IntegrationProvider | null {
  if (platform === "spotify") {
    return "spotify";
  }

  if (platform === "apple_music") {
    return "apple_music";
  }

  if (platform === "youtube" || platform === "youtube_music") {
    return "youtube";
  }

  if (platform === "twitch") {
    return "twitch";
  }

  if (platform === "github") {
    return "github";
  }

  return null;
}

function providerConfigured(provider: IntegrationProvider, config: IntegrationProviderConfig): boolean {
  if (provider === "apple_music") {
    return (config.developerToken ?? "") !== "";
  }

  return (config.clientId ?? "") !== "";
}

function providerOauthEnabled(provider: IntegrationProvider, config: IntegrationProviderConfig): boolean {
  if (provider === "apple_music") {
    return false;
  }

  return (config.clientId ?? "") !== "" && (config.clientSecret ?? "") !== "";
}

function providerMetadataEnabled(provider: IntegrationProvider, config: IntegrationProviderConfig): boolean {
  if (provider === "spotify" || provider === "twitch") {
    return (config.clientId ?? "") !== "" && (config.clientSecret ?? "") !== "";
  }

  if (provider === "youtube") {
    return (config.apiKey ?? "") !== "";
  }

  if (provider === "github") {
    return true;
  }

  return (config.developerToken ?? "") !== "";
}

function providerMissingConfigKeys(provider: IntegrationProvider, config: IntegrationProviderConfig): string[] {
  const required = provider === "youtube"
    ? ["client_id", "client_secret", "api_key"]
    : provider === "apple_music"
      ? ["developer_token"]
      : ["client_id", "client_secret"];

  return required.filter((key) => {
    if (key === "client_id") {
      return (config.clientId ?? "") === "";
    }

    if (key === "client_secret") {
      return (config.clientSecret ?? "") === "";
    }

    if (key === "api_key") {
      return (config.apiKey ?? "") === "";
    }

    return (config.developerToken ?? "") === "";
  });
}

function accountPayload(row: IntegrationAccountRow): IntegrationAccountPayload {
  return {
    provider: row.provider,
    providerAccountId: row.provider_account_id,
    providerHandle: row.provider_handle,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    scopes: jsonList(row.scopes_json),
    tokenExpiresAt: row.token_expires_at,
    connectedAt: row.connected_at,
    refreshedAt: row.refreshed_at,
    revokedAt: row.revoked_at,
    lastError: row.last_error,
    errorAt: row.error_at,
  };
}

function jsonList(value: string | null | undefined): string[] {
  if (typeof value !== "string" || value.trim() === "") {
    return [];
  }

  try {
    const decoded: unknown = JSON.parse(value);

    return Array.isArray(decoded) ? decoded.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function integrationScope(provider: IntegrationProvider): string {
  if (provider === "spotify") {
    return "user-read-private user-read-email user-read-recently-played user-top-read playlist-read-private playlist-read-collaborative";
  }

  if (provider === "youtube") {
    return "https://www.googleapis.com/auth/youtube.readonly";
  }

  if (provider === "twitch") {
    return "user:read:email";
  }

  if (provider === "github") {
    return "read:user public_repo";
  }

  return "";
}

function tokenUrl(provider: IntegrationProvider): string {
  if (provider === "spotify") {
    return "https://accounts.spotify.com/api/token";
  }

  if (provider === "youtube") {
    return "https://oauth2.googleapis.com/token";
  }

  if (provider === "twitch") {
    return "https://id.twitch.tv/oauth2/token";
  }

  if (provider === "github") {
    return "https://github.com/login/oauth/access_token";
  }

  throw new IntegrationRouteError("Choose a supported integration provider.", 422);
}

function tokenScopes(value: unknown): string[] {
  if (typeof value === "string") {
    return value.trim().split(/\s+/u).filter(Boolean);
  }

  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string" && item !== "");
  }

  return [];
}

function normalizeIntegrationUrl(rawUrl: string, preferredProvider: IntegrationProvider | null): NormalizedIntegrationUrl | null {
  const url = integrationUrl(rawUrl);
  const parsed = new URL(url);
  const host = parsed.hostname.toLowerCase();
  const path = parsed.pathname.replace(/^\/+|\/+$/gu, "");
  const segments = path === "" ? [] : path.split("/");
  const provider = preferredProvider ?? providerFromHost(host);

  if (provider === null) {
    return null;
  }

  let resourceType = "link";
  let resourceId = "";
  let sourceUrl = url;

  if (provider === "spotify" && host === "open.spotify.com" && segments.length >= 2) {
    resourceType = segments[0]?.toLowerCase() ?? "";
    resourceId = (segments[1] ?? "").replace(/[^A-Za-z0-9]/gu, "");
    sourceUrl = `https://open.spotify.com/${resourceType}/${resourceId}`;
  } else if (provider === "apple_music" && ["music.apple.com", "itunes.apple.com"].includes(host) && segments.length >= 2) {
    if (path.includes("/artist/")) {
      resourceType = "artist";
    } else if (path.includes("/playlist/")) {
      resourceType = "playlist";
    } else if (path.includes("/album/")) {
      resourceType = "album";
    } else {
      resourceType = "song";
    }

    resourceId = lastIdentifier(url);
  } else if (provider === "youtube" && ["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be", "music.youtube.com"].includes(host)) {
    const playlistId = youtubeIdentifier(parsed.searchParams.get("list") ?? "");
    const firstSegment = segments[0] ?? "";
    let videoId = "";

    if (host === "youtu.be" && segments[0] !== undefined) {
      videoId = youtubeIdentifier(segments[0]);
    } else if (firstSegment === "watch") {
      videoId = youtubeIdentifier(parsed.searchParams.get("v") ?? "");
    } else if (["shorts", "live", "embed"].includes(firstSegment) && segments[1] !== undefined) {
      videoId = youtubeIdentifier(segments[1]);
    }

    if (videoId !== "") {
      resourceType = "video";
      resourceId = videoId;
      sourceUrl = `https://www.youtube.com/watch?v=${encodeURIComponent(resourceId)}`;
    } else if (playlistId !== "") {
      resourceType = "playlist";
      resourceId = playlistId;
      sourceUrl = `https://www.youtube.com/playlist?list=${encodeURIComponent(resourceId)}`;
    } else if (firstSegment.startsWith("@")) {
      resourceType = "channel";
      resourceId = youtubeIdentifier(firstSegment, true);
      sourceUrl = `https://www.youtube.com/${resourceId}`;
    } else if (firstSegment === "channel" && segments[1] !== undefined) {
      resourceType = "channel";
      resourceId = youtubeIdentifier(segments[1]);
      sourceUrl = `https://www.youtube.com/channel/${encodeURIComponent(resourceId)}`;
    }
  } else if (provider === "twitch" && ["twitch.tv", "www.twitch.tv"].includes(host) && segments[0] !== undefined) {
    resourceType = segments[0] === "videos" && segments[1] !== undefined ? "video" : "channel";
    resourceId = resourceType === "video" ? segments[1] ?? "" : segments[0];
  } else if (provider === "github" && ["github.com", "www.github.com"].includes(host) && segments.length >= 2) {
    resourceType = "repo";
    resourceId = `${segments[0]}/${segments[1]}`.toLowerCase();
    sourceUrl = `https://github.com/${resourceId}`;
  }

  resourceId = resourceId.trim();

  if (resourceId === "") {
    return null;
  }

  return {
    provider,
    resourceType,
    resourceId,
    resourceKey: `${provider}:${resourceType}:${resourceId}`,
    sourceUrl,
  };
}

function providerFromHost(host: string): IntegrationProvider | null {
  if (host === "open.spotify.com") {
    return "spotify";
  }

  if (["music.apple.com", "itunes.apple.com"].includes(host)) {
    return "apple_music";
  }

  if (["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be", "music.youtube.com"].includes(host)) {
    return "youtube";
  }

  if (["twitch.tv", "www.twitch.tv"].includes(host)) {
    return "twitch";
  }

  if (["github.com", "www.github.com"].includes(host)) {
    return "github";
  }

  return null;
}

function youtubeIdentifier(value: string, allowHandle = false): string {
  const trimmed = value.trim();

  if (allowHandle && trimmed.startsWith("@")) {
    const handle = trimmed.slice(1).replace(/[^A-Za-z0-9._-]/gu, "");

    return handle === "" ? "" : `@${handle}`;
  }

  return trimmed.replace(/[^A-Za-z0-9_-]/gu, "");
}

function integrationUrl(value: unknown): string {
  if (typeof value !== "string") {
    throw new IntegrationRouteError("Integration URL is invalid.", 422);
  }

  const trimmed = value.trim();

  if (trimmed.length > 500 || !validAbsoluteUrl(trimmed)) {
    throw new IntegrationRouteError("Integration URL is invalid.", 422);
  }

  if (new URL(trimmed).protocol !== "https:") {
    throw new IntegrationRouteError("Integration URL must use HTTPS.", 422);
  }

  return trimmed;
}

function lastIdentifier(url: string): string {
  const parsed = new URL(url);
  const queryId = parsed.searchParams.get("i") ?? "";

  if (queryId !== "") {
    return queryId.replace(/[^A-Za-z0-9._-]/gu, "");
  }

  const parts = parsed.pathname.replace(/^\/+|\/+$/gu, "").split("/").filter(Boolean);

  return (parts.at(-1) ?? "").replace(/[^A-Za-z0-9._-]/gu, "");
}

function fallbackMetadata(normalized: NormalizedIntegrationUrl): IntegrationMetadataPayload {
  const providerLabel = providerLabelFor(normalized.provider);
  let title = providerLabel;

  if (normalized.provider === "github") {
    title = normalized.resourceId;
  } else if (normalized.provider === "twitch") {
    title = normalized.resourceType === "channel" ? `@${normalized.resourceId}` : "Twitch video";
  } else if (normalized.provider === "youtube") {
    title = normalized.resourceType === "channel" ? normalized.resourceId : "YouTube video";
  } else if (normalized.provider === "spotify") {
    title = `Spotify ${normalized.resourceType}`;
  } else if (normalized.provider === "apple_music") {
    title = `Apple Music ${normalized.resourceType}`;
  }

  return {
    title,
    subtitle: providerLabel,
    description: null,
    imageUrl: null,
    live: false,
    liveFetchedAt: null,
    recentLabel: null,
    recentFetchedAt: null,
    stats: {},
  };
}

function providerLabelFor(provider: IntegrationProvider): string {
  if (provider === "spotify") {
    return "Spotify";
  }

  if (provider === "apple_music") {
    return "Apple Music";
  }

  if (provider === "youtube") {
    return "YouTube";
  }

  if (provider === "twitch") {
    return "Twitch";
  }

  return "GitHub";
}

function embedPayload(
  normalized: NormalizedIntegrationUrl,
  twitchConfig: IntegrationProviderConfig,
): IntegrationEmbedPayload | null {
  let src: string | null = null;

  if (normalized.provider === "spotify") {
    src = `https://open.spotify.com/embed/${encodeURIComponent(normalized.resourceType)}/${encodeURIComponent(normalized.resourceId)}?theme=0`;
  } else if (normalized.provider === "apple_music") {
    src = `https://embed.music.apple.com/us/${encodeURIComponent(normalized.resourceType)}/${encodeURIComponent(normalized.resourceId)}`;
  } else if (normalized.provider === "youtube") {
    if (normalized.resourceType === "video") {
      src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(normalized.resourceId)}`;
    } else if (normalized.resourceType === "playlist") {
      src = `https://www.youtube-nocookie.com/embed/videoseries?list=${encodeURIComponent(normalized.resourceId)}`;
    }
  } else if (normalized.provider === "twitch") {
    const parent = twitchConfig.embedParent ?? "thia.lol";

    if (normalized.resourceType === "channel") {
      src = `https://player.twitch.tv/?channel=${encodeURIComponent(normalized.resourceId)}&parent=${encodeURIComponent(parent)}&muted=true&autoplay=false`;
    } else if (normalized.resourceType === "video") {
      src = `https://player.twitch.tv/?video=v${encodeURIComponent(normalized.resourceId.replace(/^v/u, ""))}&parent=${encodeURIComponent(parent)}&muted=true&autoplay=false`;
    }
  }

  if (src === null) {
    return null;
  }

  return {
    type: "iframe",
    src,
    title: `${providerLabelFor(normalized.provider)} embed`,
    allow: "autoplay; encrypted-media; picture-in-picture; fullscreen",
    height: embedHeight(normalized),
  };
}

function embedHeight(normalized: NormalizedIntegrationUrl): number {
  if (normalized.provider === "spotify") {
    return normalized.resourceType === "track" ? 80 : 152;
  }

  if (normalized.provider === "apple_music") {
    return 152;
  }

  return 220;
}

function cachePayload(row: IntegrationCacheRow, stale = false): IntegrationCardPayload {
  const metadata = decodeObject(row.metadata_json);
  const embed = decodeObject(row.embed_json);

  return {
    provider: providerFromInput(row.provider),
    resourceType: row.resource_type,
    resourceId: row.resource_id,
    resourceKey: row.resource_key,
    sourceUrl: row.source_url,
    metadata: normalizeMetadata(metadata),
    embed: Object.keys(embed).length === 0 ? null : embed as unknown as IntegrationEmbedPayload,
    apiBacked: Boolean(row.api_backed),
    fetchedAt: row.fetched_at,
    expiresAt: row.expires_at,
    staleAt: row.stale_at,
    stale,
    lastError: row.error_message,
  };
}

function cacheIsFresh(row: IntegrationCacheRow, now: Date): boolean {
  const time = Date.parse(`${row.expires_at ?? ""}Z`);

  return Number.isFinite(time) && time > now.getTime();
}

function integrationCacheTtlSeconds(provider: IntegrationProvider): number {
  return provider === "twitch" ? twitchIntegrationTtlSeconds : integrationTtlSeconds;
}

function normalizeMetadata(value: Record<string, unknown>): IntegrationMetadataPayload {
  return {
    title: typeof value.title === "string" ? value.title : "Integration",
    subtitle: typeof value.subtitle === "string" ? value.subtitle : "Integration",
    description: typeof value.description === "string" ? value.description : null,
    imageUrl: typeof value.imageUrl === "string" ? value.imageUrl : null,
    live: value.live === true,
    liveFetchedAt: typeof value.liveFetchedAt === "string" ? value.liveFetchedAt : null,
    recentLabel: typeof value.recentLabel === "string" ? value.recentLabel : null,
    recentFetchedAt: typeof value.recentFetchedAt === "string" ? value.recentFetchedAt : null,
    stats: isRecord(value.stats) ? value.stats : {},
  };
}

function decodeObject(value: string | null | undefined): Record<string, unknown> {
  if (typeof value !== "string" || value.trim() === "") {
    return {};
  }

  try {
    const decoded: unknown = JSON.parse(value);

    return isRecord(decoded) && !Array.isArray(decoded) ? decoded : {};
  } catch {
    return {};
  }
}

function mergeMetadata(
  base: IntegrationMetadataPayload,
  patch: Partial<IntegrationMetadataPayload>,
): IntegrationMetadataPayload {
  return {
    ...base,
    ...patch,
    stats: patch.stats ?? base.stats,
  };
}

function suggestionItem(
  id: string,
  label: string,
  description: string,
  sourceUrl: string,
  moduleType: "creator_live" | "music",
  card: IntegrationCardPayload | null,
): IntegrationSuggestionItemPayload {
  return {
    id,
    label,
    description,
    sourceUrl,
    moduleType,
    moduleTitle: moduleType === "music" ? "Music" : "Creator",
    card,
  };
}

function accountHandle(account: IntegrationAccountPayload): string | null {
  if (account.providerHandle !== null && account.providerHandle.trim() !== "") {
    return account.providerHandle.trim();
  }

  return account.providerAccountId.trim() === "" ? null : account.providerAccountId.trim();
}

function rejectUnknownKeys(body: Record<string, unknown>, allowed: string[]): void {
  for (const key of Object.keys(body)) {
    if (!allowed.includes(key)) {
      throw new IntegrationRouteError(`Unsupported integration field: ${key}.`, 422);
    }
  }
}

function redirectPathFromValue(value: unknown): string {
  if (typeof value !== "string" || value === "") {
    return "/settings/connections";
  }

  const trimmed = value.trim();

  return /^\/[a-zA-Z0-9/_@?.=&%-]{0,240}$/u.test(trimmed)
    ? trimmed
    : "/settings/connections";
}

function oauthErrorCode(value: unknown, fallback: string): string {
  if (typeof value !== "string") {
    return fallback;
  }

  const trimmed = value.trim().slice(0, 80);

  return trimmed !== "" && /^[A-Za-z0-9_.-]+$/u.test(trimmed) ? trimmed : fallback;
}

function validAbsoluteUrl(value: string): boolean {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

function scalarString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function valueToString(value: unknown): string | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }

  return String(value);
}

function stringRecordValue(value: unknown, key: string): string | null {
  if (!isRecord(value)) {
    return null;
  }

  return typeof value[key] === "string" ? value[key] : null;
}

function nestedString(value: unknown, path: (string | number)[]): string | null {
  const nested = nestedValue(value, path);

  return typeof nested === "string" ? nested : null;
}

function nestedValue(value: unknown, path: (string | number)[]): unknown {
  let current = value;

  for (const part of path) {
    if (typeof part === "number") {
      if (!Array.isArray(current)) {
        return undefined;
      }

      current = current[part];
      continue;
    }

    if (!isRecord(current)) {
      return undefined;
    }

    current = current[part];
  }

  return current;
}

function numericValue(value: unknown): number | null {
  if (typeof value !== "string" && typeof value !== "number") {
    return null;
  }

  const number = Number(value);

  return Number.isFinite(number) ? Math.trunc(number) : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function spotifyPlaylistTracks(response: Record<string, unknown>): IntegrationPlaylistTrackPayload[] {
  const rows = Array.isArray(nestedValue(response, ["tracks", "items"]))
    ? nestedValue(response, ["tracks", "items"]) as unknown[]
    : [];

  const tracks: IntegrationPlaylistTrackPayload[] = [];

  for (const item of rows.slice(0, 12)) {
    const track = nestedValue(item, ["track"]);
    const title = nestedString(track, ["name"]);
    const sourceUrl = nestedString(track, ["external_urls", "spotify"]);

    if (title === null || title === "") {
      continue;
    }

    const id = nestedString(track, ["id"]);
    const durationMs = numericValue(nestedValue(track, ["duration_ms"]));

    tracks.push({
      title,
      artist: spotifyArtistsLabel(nestedValue(track, ["artists"])) ?? "Spotify",
      ...(id ? { id } : {}),
      ...(sourceUrl ? { sourceUrl } : {}),
      ...(durationMs !== null && durationMs > 0 ? { duration: Math.round(durationMs / 1000) } : {}),
    });
  }

  return tracks;
}

function appleMusicPlaylistTracks(response: unknown): IntegrationPlaylistTrackPayload[] {
  const rows = Array.isArray(nestedValue(response, ["data", 0, "relationships", "tracks", "data"]))
    ? nestedValue(response, ["data", 0, "relationships", "tracks", "data"]) as unknown[]
    : [];

  const tracks: IntegrationPlaylistTrackPayload[] = [];

  for (const item of rows.slice(0, 12)) {
    const attributes = nestedValue(item, ["attributes"]);
    const title = stringRecordValue(attributes, "name");

    if (title === null || title === "") {
      continue;
    }

    const durationMs = numericValue(nestedValue(attributes, ["durationInMillis"]));
    const id = stringRecordValue(item, "id");
    const sourceUrl = stringRecordValue(attributes, "url");

    tracks.push({
      title,
      artist: stringRecordValue(attributes, "artistName") ?? "Apple Music",
      ...(id ? { id } : {}),
      ...(sourceUrl ? { sourceUrl } : {}),
      ...(durationMs !== null && durationMs > 0 ? { duration: Math.round(durationMs / 1000) } : {}),
    });
  }

  return tracks;
}

function spotifyArtistsLabel(value: unknown): string | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const artists = value
    .map((artist) => (isRecord(artist) && typeof artist.name === "string" ? artist.name.trim() : ""))
    .filter((artist) => artist !== "");

  return artists.length > 0 ? artists.join(", ") : null;
}

function base64Url(bytes: Buffer): string {
  return bytes.toString("base64").replace(/\+/gu, "-").replace(/\//gu, "_").replace(/=+$/u, "");
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function md5(value: string): string {
  return createHash("md5").update(value).digest("hex");
}

function sqlDate(date: Date): string {
  return date.toISOString().slice(0, 19).replace("T", " ");
}

function decryptOpenssl(value: string, key: Buffer): string {
  const decoded = Buffer.from(value, "base64");

  if (decoded.length <= 28) {
    throw new Error("Stored integration token is invalid.");
  }

  const nonce = decoded.subarray(0, 12);
  const tag = decoded.subarray(12, 28);
  const cipherText = decoded.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", key, nonce);
  decipher.setAuthTag(tag);

  try {
    return Buffer.concat([decipher.update(cipherText), decipher.final()]).toString("utf8");
  } catch {
    throw new Error("Stored integration token could not be decrypted.");
  }
}

function decryptSodium(value: string, key: Buffer): string {
  const decoded = Buffer.from(value, "base64");
  const nonceLength = nacl.secretbox.nonceLength;

  if (decoded.length <= nonceLength) {
    throw new Error("Stored integration token is invalid.");
  }

  const nonce = decoded.subarray(0, nonceLength);
  const cipherText = decoded.subarray(nonceLength);
  const plain = nacl.secretbox.open(
    new Uint8Array(cipherText),
    new Uint8Array(nonce),
    new Uint8Array(key),
  );

  if (plain === null) {
    throw new Error("Stored integration token could not be decrypted.");
  }

  return Buffer.from(plain).toString("utf8");
}

async function defaultHttpJson(
  method: "GET" | "POST",
  url: string,
  headers: string[] = [],
  body: Record<string, string> = {},
): Promise<unknown> {
  const requestHeaders = headerObject([
    ...headers,
    "User-Agent: thia.lol integrations",
    "Accept: application/json",
  ]);
  const init: RequestInit = {
    method,
    headers: requestHeaders,
    redirect: "manual",
    signal: AbortSignal.timeout(8000),
  };

  if (method === "POST") {
    init.body = new URLSearchParams(body).toString();
    requestHeaders["content-type"] = "application/x-www-form-urlencoded";
  }

  const response = await fetch(url, init);
  const raw = await response.text();

  if (!response.ok) {
    throw new Error(`Provider request failed with HTTP ${response.status}.`);
  }

  try {
    const parsed: unknown = JSON.parse(raw);

    if (parsed === null || typeof parsed !== "object") {
      throw new Error("Provider response was not an object.");
    }

    return parsed;
  } catch (error) {
    if (error instanceof Error && error.message === "Provider response was not an object.") {
      throw error;
    }

    throw new Error("Provider response was not valid JSON.", { cause: error });
  }
}

function headerObject(headers: string[]): Record<string, string> {
  const result: Record<string, string> = {};

  for (const header of headers) {
    const index = header.indexOf(":");

    if (index === -1) {
      continue;
    }

    const name = header.slice(0, index).trim().toLowerCase();
    const value = header.slice(index + 1).trim();

    if (name !== "") {
      result[name] = value;
    }
  }

  return result;
}

export function integrationProviderFromModulePlatform(platform: string | null): IntegrationProvider | null {
  return providerFromPlatform(platform);
}
