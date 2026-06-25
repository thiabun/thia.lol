import type { Pool } from "mysql2/promise";
import { describe, expect, it, vi } from "vitest";

import {
  createIntegrationsRepository,
  type IntegrationHttpJson,
  type IntegrationProvider,
  type IntegrationProviderConfig,
} from "./integrations.js";
import type { RequestSession } from "./sessions.js";

const session: RequestSession = {
  sessionId: 7,
  userId: 42,
  tokenHash: "hash",
  handle: "viewer",
  role: "member",
};

const providers: Record<IntegrationProvider, IntegrationProviderConfig> = {
  spotify: {
    clientId: "spotify-client",
    clientSecret: "spotify-secret",
  },
  youtube: {
    clientId: "youtube-client",
    clientSecret: "youtube-secret",
    apiKey: "youtube-key",
  },
  apple_music: {},
  twitch: {},
  github: {},
};

describe("integration OAuth music flows", () => {
  it("uses read-only OAuth scopes for Spotify and YouTube", async () => {
    const repository = createTestRepository(new FakeIntegrationPool());

    const spotify = await repository.startOAuth(session, "spotify", {});
    const spotifyUrl = new URL(spotify.authorizationUrl);

    expect(spotifyUrl.origin).toBe("https://accounts.spotify.com");
    expect(spotifyUrl.searchParams.get("scope")?.split(" ")).toEqual([
      "user-read-private",
      "user-read-email",
      "user-read-recently-played",
      "user-top-read",
      "playlist-read-private",
      "playlist-read-collaborative",
    ]);
    expect(spotifyUrl.searchParams.get("scope")).not.toContain("streaming");
    expect(spotifyUrl.searchParams.get("scope")).not.toContain("user-modify-playback-state");

    const youtube = await repository.startOAuth(session, "youtube", {});
    const youtubeUrl = new URL(youtube.authorizationUrl);

    expect(youtubeUrl.origin).toBe("https://accounts.google.com");
    expect(youtubeUrl.searchParams.get("scope")).toBe("https://www.googleapis.com/auth/youtube.readonly");
    expect(youtubeUrl.searchParams.get("access_type")).toBe("offline");
    expect(youtubeUrl.searchParams.get("code_challenge_method")).toBe("S256");
    expect(youtubeUrl.searchParams.get("code_challenge")).toEqual(expect.any(String));
  });

  it("stores Spotify OAuth tokens encrypted and returns music suggestions", async () => {
    const pool = new FakeIntegrationPool();
    const httpJson = vi.fn<IntegrationHttpJson>(async (method, url, _headers, body) => {
      if (method === "POST" && url === "https://accounts.spotify.com/api/token") {
        if (body?.grant_type === "authorization_code") {
          return {
            access_token: "spotify-user-token",
            refresh_token: "spotify-refresh-token",
            expires_in: 3600,
            scope: "user-read-private user-read-recently-played user-top-read playlist-read-private",
          };
        }

        return {
          access_token: "spotify-app-token",
        };
      }

      if (method === "GET" && url === "https://api.spotify.com/v1/me") {
        return {
          id: "spotify-user",
          display_name: "Thia",
          images: [{ url: "https://cdn.example.com/avatar.webp" }],
        };
      }

      if (method === "GET" && url.includes("/recently-played")) {
        return {
          items: [
            {
              track: {
                name: "Recently Played",
                external_urls: {
                  spotify: "https://open.spotify.com/track/recent123",
                },
              },
            },
          ],
        };
      }

      if (method === "GET" && url.includes("/top/tracks")) {
        return {
          items: [
            {
              name: "Top Track",
              external_urls: {
                spotify: "https://open.spotify.com/track/top123",
              },
            },
          ],
        };
      }

      if (method === "GET" && url.includes("/me/playlists")) {
        return {
          items: [
            {
              name: "Playlist",
              external_urls: {
                spotify: "https://open.spotify.com/playlist/list123",
              },
            },
          ],
        };
      }

      if (method === "GET" && url.includes("api.spotify.com/v1/tracks")) {
        return {
          name: "Track metadata",
          artists: [{ name: "Artist" }],
          album: {
            images: [{ url: "https://cdn.example.com/track.webp" }],
          },
        };
      }

      if (method === "GET" && url.includes("api.spotify.com/v1/playlists")) {
        return {
          name: "Playlist metadata",
          owner: {
            display_name: "Owner",
          },
          images: [{ url: "https://cdn.example.com/playlist.webp" }],
        };
      }

      throw new Error(`Unexpected integration request: ${method} ${url}`);
    });
    const repository = createTestRepository(pool, httpJson);
    const start = await repository.startOAuth(session, "spotify", { redirectPath: "/@thia" });
    const state = new URL(start.authorizationUrl).searchParams.get("state") ?? "";

    const redirect = await repository.oauthCallback("spotify", { state, code: "spotify-code" });

    expect(redirect.location).toBe(
      "https://thia.lol/@thia?integrationProvider=spotify&integrationStatus=connected",
    );
    expect(pool.accounts.get("42:spotify")).toMatchObject({
      provider: "spotify",
      provider_account_id: "spotify-user",
      provider_handle: "Thia",
      display_name: "Thia",
      scopes_json: JSON.stringify([
        "user-read-private",
        "user-read-recently-played",
        "user-top-read",
        "playlist-read-private",
      ]),
      token_expires_at: "2026-06-25 13:00:00",
    });
    expect(pool.accounts.get("42:spotify")?.access_token_cipher).toMatch(/^openssl:/u);
    expect(pool.accounts.get("42:spotify")?.refresh_token_cipher).toMatch(/^openssl:/u);

    const suggestions = await repository.suggestions(session, "spotify");

    expect(suggestions.message).toBeNull();
    expect(suggestions.items).toEqual([
      expect.objectContaining({
        label: "Recently Played",
        description: "Recently played on Spotify",
        sourceUrl: "https://open.spotify.com/track/recent123",
        moduleType: "music",
        moduleTitle: "Music",
      }),
      expect.objectContaining({
        label: "Top Track",
        description: "Top track on Spotify",
        sourceUrl: "https://open.spotify.com/track/top123",
        moduleType: "music",
        moduleTitle: "Music",
      }),
      expect.objectContaining({
        label: "Playlist",
        description: "Spotify playlist",
        sourceUrl: "https://open.spotify.com/playlist/list123",
        moduleType: "music",
        moduleTitle: "Music",
      }),
    ]);
  });

  it("returns YouTube playlist music suggestions from a connected account", async () => {
    const pool = new FakeIntegrationPool();
    const httpJson = vi.fn<IntegrationHttpJson>(async (method, url, _headers, body) => {
      if (method === "POST" && url === "https://oauth2.googleapis.com/token" && body?.grant_type === "authorization_code") {
        return {
          access_token: "youtube-user-token",
          refresh_token: "youtube-refresh-token",
          expires_in: 3600,
          scope: "https://www.googleapis.com/auth/youtube.readonly",
        };
      }

      if (method === "GET" && url === "https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true") {
        return {
          items: [
            {
              id: "UC123",
              snippet: {
                customUrl: "@thia",
                title: "Thia Channel",
                thumbnails: {
                  default: {
                    url: "https://cdn.example.com/channel.webp",
                  },
                },
              },
            },
          ],
        };
      }

      if (method === "GET" && url === "https://www.googleapis.com/youtube/v3/playlists?part=snippet&mine=true&maxResults=5") {
        return {
          items: [
            {
              id: "PL123",
              snippet: {
                title: "Music shelf",
              },
            },
          ],
        };
      }

      if (method === "GET" && url.includes("www.googleapis.com/youtube/v3/playlists?part=snippet%2CcontentDetails")) {
        return {
          items: [
            {
              snippet: {
                title: "Music shelf",
                description: "Favorite tracks.",
                thumbnails: {
                  medium: {
                    url: "https://cdn.example.com/playlist.webp",
                  },
                },
              },
              contentDetails: {
                itemCount: 12,
              },
            },
          ],
        };
      }

      throw new Error(`Unexpected integration request: ${method} ${url}`);
    });
    const repository = createTestRepository(pool, httpJson);
    const start = await repository.startOAuth(session, "youtube", {});
    const state = new URL(start.authorizationUrl).searchParams.get("state") ?? "";

    await repository.oauthCallback("youtube", { state, code: "youtube-code" });

    const suggestions = await repository.suggestions(session, "youtube");

    expect(suggestions.message).toBeNull();
    expect(suggestions.items).toEqual([
      expect.objectContaining({
        label: "Music shelf",
        description: "YouTube playlist",
        sourceUrl: "https://www.youtube.com/playlist?list=PL123",
        moduleType: "music",
        moduleTitle: "Music",
      }),
      expect.objectContaining({
        label: "Thia Channel",
        description: "Connected YouTube channel",
        sourceUrl: "https://www.youtube.com/@thia",
        moduleType: "creator_live",
        moduleTitle: "Creator",
      }),
    ]);
  });
});

function createTestRepository(pool: FakeIntegrationPool, httpJson?: IntegrationHttpJson) {
  return createIntegrationsRepository(pool as unknown as Pool, {
    publicBaseUrl: "https://thia.lol",
    encryptionKey: "12345678901234567890123456789012",
    providers,
    httpJson,
    now: () => new Date("2026-06-25T12:00:00.000Z"),
  });
}

type FakeOAuthState = {
  id: number;
  user_id: number;
  provider: string;
  state_hash: string;
  code_verifier_cipher: string;
  redirect_path: string | null;
  consumed_at: string | null;
};

type FakeAccountRow = {
  provider: string;
  provider_account_id: string;
  provider_handle: string | null;
  display_name: string | null;
  avatar_url: string | null;
  scopes_json: string | null;
  access_token_cipher: string | null;
  refresh_token_cipher: string | null;
  token_expires_at: string | null;
  connected_at: string | null;
  refreshed_at: string | null;
  revoked_at: string | null;
  last_error: string | null;
  error_at: string | null;
};

class FakeIntegrationPool {
  readonly oauthStates: FakeOAuthState[] = [];
  readonly accounts = new Map<string, FakeAccountRow>();
  private nextStateId = 1;

  async execute(sql: string, params: readonly unknown[] = []): Promise<[unknown[], unknown]> {
    if (sql.includes("information_schema.TABLES") || sql.includes("information_schema.COLUMNS")) {
      return [[{ item_count: 1 }], []];
    }

    if (sql.includes("INSERT INTO profile_integration_oauth_states")) {
      const [userId, provider, stateHash, codeVerifierCipher, redirectPath] = params;

      this.oauthStates.push({
        id: this.nextStateId,
        user_id: Number(userId),
        provider: String(provider),
        state_hash: String(stateHash),
        code_verifier_cipher: String(codeVerifierCipher),
        redirect_path: typeof redirectPath === "string" ? redirectPath : null,
        consumed_at: null,
      });
      this.nextStateId += 1;

      return [[], []];
    }

    if (sql.includes("FROM profile_integration_oauth_states")) {
      const [provider, stateHash] = params;
      const state = this.oauthStates.find(
        (row) => row.provider === provider && row.state_hash === stateHash && row.consumed_at === null,
      );

      return [state === undefined ? [] : [state], []];
    }

    if (sql.includes("UPDATE profile_integration_oauth_states")) {
      const [stateId] = params;
      const state = this.oauthStates.find((row) => row.id === Number(stateId));

      if (state !== undefined) {
        state.consumed_at = "2026-06-25 12:00:00";
      }

      return [[], []];
    }

    if (sql.includes("INSERT INTO profile_integration_accounts")) {
      const [
        userId,
        provider,
        providerAccountId,
        providerHandle,
        displayName,
        avatarUrl,
        scopesJson,
        accessTokenCipher,
        refreshTokenCipher,
        tokenExpiresAt,
      ] = params;
      const account: FakeAccountRow = {
        provider: String(provider),
        provider_account_id: String(providerAccountId),
        provider_handle: typeof providerHandle === "string" ? providerHandle : null,
        display_name: typeof displayName === "string" ? displayName : null,
        avatar_url: typeof avatarUrl === "string" ? avatarUrl : null,
        scopes_json: typeof scopesJson === "string" ? scopesJson : null,
        access_token_cipher: typeof accessTokenCipher === "string" ? accessTokenCipher : null,
        refresh_token_cipher: typeof refreshTokenCipher === "string" ? refreshTokenCipher : null,
        token_expires_at: typeof tokenExpiresAt === "string" ? tokenExpiresAt : null,
        connected_at: "2026-06-25 12:00:00",
        refreshed_at: "2026-06-25 12:00:00",
        revoked_at: null,
        last_error: null,
        error_at: null,
      };

      this.accounts.set(`${Number(userId)}:${String(provider)}`, account);

      return [[], []];
    }

    if (sql.includes("SELECT provider, provider_account_id") && sql.includes("FROM profile_integration_accounts")) {
      const [userId, provider] = params;

      if (provider === undefined) {
        return [[...this.accounts.values()].filter((row) => String(row.provider) !== ""), []];
      }

      const account = this.accounts.get(`${Number(userId)}:${String(provider)}`);

      return [account === undefined ? [] : [account], []];
    }

    if (sql.includes("SELECT access_token_cipher") && sql.includes("FROM profile_integration_accounts")) {
      const [userId, provider] = params;
      const account = this.accounts.get(`${Number(userId)}:${String(provider)}`);

      return [account === undefined ? [] : [{ access_token_cipher: account.access_token_cipher }], []];
    }

    if (sql.includes("FROM profile_integration_metadata_cache")) {
      return [[], []];
    }

    if (sql.includes("INSERT INTO profile_integration_metadata_cache")) {
      return [[], []];
    }

    return [[], []];
  }
}
