<?php

declare(strict_types=1);

require_once __DIR__ . '/auth.php';
require_once __DIR__ . '/read.php';

const PROFILE_INTEGRATION_PROVIDERS = ['spotify', 'apple_music', 'youtube', 'twitch', 'github'];
const PROFILE_INTEGRATION_TTL_SECONDS = 3600;
const PROFILE_INTEGRATION_STALE_SECONDS = 86400;
const PROFILE_INTEGRATION_OAUTH_STATE_SECONDS = 600;
const PROFILE_INTEGRATION_ENCRYPTION_KEY_BYTES = 32;
const PROFILE_INTEGRATION_OPENSSL_PREFIX = 'openssl:';

function integrations_dispatch(array $segments, string $method): void
{
    if (($segments[0] ?? null) === 'me' && ($segments[1] ?? null) === 'integrations') {
        if (count($segments) === 2 && ($method === 'GET' || $method === 'HEAD')) {
            profile_integrations_owner_index();
        }

        if (count($segments) === 3 && $method === 'DELETE') {
            profile_integrations_disconnect($segments[2]);
        }

        if (count($segments) === 4 && $segments[3] === 'suggestions' && ($method === 'GET' || $method === 'HEAD')) {
            profile_integrations_provider_suggestions($segments[2]);
        }

        if (count($segments) === 4 && $segments[3] === 'start' && $method === 'POST') {
            profile_integrations_oauth_start($segments[2]);
        }

        if (count($segments) === 4 && $segments[2] === 'metadata' && $segments[3] === 'resolve' && $method === 'POST') {
            profile_integrations_metadata_resolve();
        }

        json_error('Method not allowed.', 405);
    }

    if (($segments[0] ?? null) === 'integrations' && count($segments) === 3 && $segments[2] === 'callback') {
        if ($method === 'GET' || $method === 'HEAD') {
            profile_integrations_oauth_callback($segments[1]);
        }

        json_error('Method not allowed.', 405);
    }

    json_error('Not found.', 404);
}

function profile_integrations_owner_index(): void
{
    $session = require_authenticated_session();
    require_profile_integrations_storage();

    json_success([
        'providers' => array_map(
            static fn (string $provider): array => profile_integration_provider_public_status($provider),
            PROFILE_INTEGRATION_PROVIDERS
        ),
        'accounts' => profile_integration_accounts_for_user((int) $session['user_id']),
    ]);
}

function profile_integrations_oauth_start(string $rawProvider): void
{
    $session = require_authenticated_session();
    require_csrf_token($session);
    require_profile_integrations_storage();

    $provider = profile_integration_provider($rawProvider);
    $providerConfig = profile_integration_provider_config($provider);

    if (!profile_integration_provider_oauth_enabled($provider, $providerConfig)) {
        json_error('This integration is not configured yet.', 503);
    }

    profile_integration_require_encryption_key();

    $state = base64_url_encode(random_bytes(32));
    $codeVerifier = base64_url_encode(random_bytes(48));
    $redirectPath = profile_integration_redirect_path((request_json_body()['redirectPath'] ?? null));
    $authUrl = profile_integration_authorization_url($provider, $providerConfig, $state, $codeVerifier);
    $expiresAt = gmdate('Y-m-d H:i:s', time() + PROFILE_INTEGRATION_OAUTH_STATE_SECONDS);

    db_query(
        'INSERT INTO profile_integration_oauth_states
            (user_id, provider, state_hash, code_verifier_cipher, redirect_path, expires_at)
         VALUES
            (:user_id, :provider, :state_hash, :code_verifier_cipher, :redirect_path, :expires_at)',
        [
            'user_id' => (int) $session['user_id'],
            'provider' => $provider,
            'state_hash' => hash('sha256', $state),
            'code_verifier_cipher' => profile_integration_encrypt($codeVerifier),
            'redirect_path' => $redirectPath,
            'expires_at' => $expiresAt,
        ]
    );

    json_success([
        'provider' => $provider,
        'authorizationUrl' => $authUrl,
        'stateExpiresIn' => PROFILE_INTEGRATION_OAUTH_STATE_SECONDS,
    ], 201);
}

function profile_integrations_oauth_callback(string $rawProvider): void
{
    $session = require_authenticated_session();
    require_profile_integrations_storage();

    $provider = profile_integration_provider($rawProvider);
    $state = $_GET['state'] ?? null;
    $code = $_GET['code'] ?? null;
    $oauthError = $_GET['error'] ?? null;

    if (is_string($oauthError) && $oauthError !== '') {
        profile_integration_redirect_to_app('/settings', [
            'integrationProvider' => $provider,
            'integrationStatus' => 'error',
            'integrationError' => substr($oauthError, 0, 80),
        ]);
    }

    if (!is_string($state) || $state === '' || !is_string($code) || $code === '') {
        profile_integration_redirect_to_app('/settings', [
            'integrationProvider' => $provider,
            'integrationStatus' => 'error',
            'integrationError' => 'missing_callback_parameters',
        ]);
    }

    $stateRow = profile_integration_oauth_state_row($provider, $state, (int) $session['user_id']);

    if ($stateRow === null) {
        profile_integration_redirect_to_app('/settings', [
            'integrationProvider' => $provider,
            'integrationStatus' => 'error',
            'integrationError' => 'invalid_or_expired_state',
        ]);
    }

    $codeVerifier = profile_integration_decrypt((string) $stateRow['code_verifier_cipher']);
    $token = profile_integration_exchange_code($provider, $code, $codeVerifier);
    $identity = profile_integration_fetch_identity($provider, $token);

    $pdo = db();
    $pdo->beginTransaction();

    try {
        db_query(
            'UPDATE profile_integration_oauth_states
             SET consumed_at = UTC_TIMESTAMP()
             WHERE id = :id',
            ['id' => (int) $stateRow['id']]
        );

        profile_integration_upsert_account((int) $session['user_id'], $provider, $token, $identity);

        $pdo->commit();
    } catch (Throwable $exception) {
        $pdo->rollBack();
        throw $exception;
    }

    profile_integration_redirect_to_app((string) ($stateRow['redirect_path'] ?? '/settings'), [
        'integrationProvider' => $provider,
        'integrationStatus' => 'connected',
    ]);
}

function profile_integrations_provider_suggestions(string $rawProvider): void
{
    $session = require_authenticated_session();
    require_profile_integrations_storage();

    $provider = profile_integration_provider($rawProvider);
    $userId = (int) $session['user_id'];
    $status = profile_integration_provider_public_status($provider);
    $account = profile_integration_account_for_user($userId, $provider);
    $activeAccount = $account !== null && ($account['revokedAt'] ?? null) === null ? $account : null;
    $items = [];
    $message = null;

    if (!$status['configured']) {
        $message = 'This provider is not configured yet.';
    } elseif ($provider === 'apple_music') {
        $message = 'Paste an Apple Music URL to add a music card.';
    } elseif ($activeAccount === null) {
        $message = 'Connect this provider to see suggestions, or paste a supported URL.';
    } else {
        try {
            $items = profile_integration_suggestion_items($provider, $userId, $activeAccount);
        } catch (Throwable $exception) {
            $message = 'Suggestions are not available right now. Pasted URLs still work.';
        }
    }

    json_success([
        'provider' => $provider,
        'status' => $status,
        'account' => $activeAccount,
        'items' => $items,
        'message' => $message,
        'generatedAt' => gmdate('c'),
    ]);
}

function profile_integrations_disconnect(string $rawProvider): void
{
    $session = require_authenticated_session();
    require_csrf_token($session);
    require_profile_integrations_storage();

    $provider = profile_integration_provider($rawProvider);

    db_query(
        'UPDATE profile_integration_accounts
         SET revoked_at = UTC_TIMESTAMP(),
             updated_at = UTC_TIMESTAMP()
         WHERE user_id = :user_id
           AND provider = :provider
           AND revoked_at IS NULL',
        [
            'user_id' => (int) $session['user_id'],
            'provider' => $provider,
        ]
    );

    json_success([
        'providers' => array_map(
            static fn (string $item): array => profile_integration_provider_public_status($item),
            PROFILE_INTEGRATION_PROVIDERS
        ),
        'accounts' => profile_integration_accounts_for_user((int) $session['user_id']),
    ]);
}

function profile_integrations_metadata_resolve(): void
{
    $session = require_authenticated_session();
    require_csrf_token($session);
    require_profile_integrations_storage();

    $body = request_json_body();
    profile_integration_reject_unknown_keys($body, ['url', 'provider']);

    $url = profile_integration_url($body['url'] ?? null);
    $preferredProvider = isset($body['provider']) ? profile_integration_provider((string) $body['provider']) : null;
    $card = profile_integration_resolve_url($url, $preferredProvider, (int) $session['user_id']);

    if ($card === null) {
        json_error('Choose a supported integration URL.', 422);
    }

    json_success($card);
}

function profile_integration_card_for_module(array $config, int $userId): ?array
{
    if (!isset($config['url']) || !is_string($config['url']) || trim($config['url']) === '') {
        return null;
    }

    $platform = isset($config['platform']) && is_string($config['platform']) ? $config['platform'] : null;
    $provider = profile_integration_provider_from_platform($platform);

    try {
        return profile_integration_resolve_url($config['url'], $provider, $userId);
    } catch (Throwable) {
        return null;
    }
}

function require_profile_integrations_storage(): void
{
    if (!profile_integrations_storage_exists()) {
        json_error('Profile integration storage is not ready. Run pending migrations.', 503);
    }
}

function profile_integrations_storage_exists(): bool
{
    return database_table_exists('profile_integration_accounts')
        && database_table_exists('profile_integration_oauth_states')
        && database_table_exists('profile_integration_metadata_cache')
        && database_column_exists('profile_integration_accounts', 'access_token_cipher')
        && database_column_exists('profile_integration_accounts', 'refresh_token_cipher')
        && database_column_exists('profile_integration_accounts', 'provider_account_id')
        && database_column_exists('profile_integration_accounts', 'scopes_json')
        && database_column_exists('profile_integration_oauth_states', 'code_verifier_cipher')
        && database_column_exists('profile_integration_oauth_states', 'redirect_path')
        && database_column_exists('profile_integration_metadata_cache', 'metadata_json')
        && database_column_exists('profile_integration_metadata_cache', 'embed_json');
}

function profile_integration_provider(string $value): string
{
    $provider = strtolower(trim($value));

    if ($provider === 'google') {
        $provider = 'youtube';
    }

    if (!in_array($provider, PROFILE_INTEGRATION_PROVIDERS, true)) {
        json_error('Choose a supported integration provider.', 422);
    }

    return $provider;
}

function profile_integration_provider_from_platform(?string $platform): ?string
{
    return match ($platform) {
        'spotify' => 'spotify',
        'apple_music' => 'apple_music',
        'youtube', 'youtube_music' => 'youtube',
        'twitch' => 'twitch',
        'github' => 'github',
        default => null,
    };
}

function profile_integration_provider_config(string $provider): array
{
    $config = api_config()['integrations'][$provider] ?? [];

    return is_array($config) ? $config : [];
}

function profile_integration_provider_public_status(string $provider): array
{
    $config = profile_integration_provider_config($provider);

    return [
        'provider' => $provider,
        'configured' => profile_integration_provider_configured($provider, $config),
        'oauthEnabled' => profile_integration_provider_oauth_enabled($provider, $config),
        'linkSupported' => true,
        'metadataEnabled' => profile_integration_provider_metadata_enabled($provider, $config),
        'missingConfigKeys' => profile_integration_provider_missing_config_keys($provider, $config),
    ];
}

function profile_integration_provider_configured(string $provider, array $config): bool
{
    return match ($provider) {
        'spotify', 'youtube', 'twitch', 'github' => (string) ($config['client_id'] ?? '') !== '',
        'apple_music' => (string) ($config['developer_token'] ?? '') !== '',
        default => false,
    };
}

function profile_integration_provider_oauth_enabled(string $provider, array $config): bool
{
    if ($provider === 'apple_music') {
        return false;
    }

    return (string) ($config['client_id'] ?? '') !== ''
        && (string) ($config['client_secret'] ?? '') !== '';
}

function profile_integration_provider_metadata_enabled(string $provider, array $config): bool
{
    return match ($provider) {
        'spotify', 'twitch' => (string) ($config['client_id'] ?? '') !== ''
            && (string) ($config['client_secret'] ?? '') !== '',
        'youtube' => (string) ($config['api_key'] ?? '') !== '',
        'github' => true,
        'apple_music' => (string) ($config['developer_token'] ?? '') !== '',
        default => false,
    };
}

function profile_integration_provider_missing_config_keys(string $provider, array $config): array
{
    $requiredKeys = match ($provider) {
        'spotify', 'twitch', 'github' => ['client_id', 'client_secret'],
        'youtube' => ['client_id', 'client_secret', 'api_key'],
        'apple_music' => ['developer_token'],
        default => [],
    };
    $missing = [];

    foreach ($requiredKeys as $key) {
        if ((string) ($config[$key] ?? '') === '') {
            $missing[] = $key;
        }
    }

    return $missing;
}

function profile_integration_accounts_for_user(int $userId): array
{
    $statement = db_query(
        'SELECT provider, provider_account_id, provider_handle, display_name, avatar_url,
                scopes_json, token_expires_at, connected_at, refreshed_at, revoked_at, last_error, error_at
         FROM profile_integration_accounts
         WHERE user_id = :user_id
         ORDER BY provider ASC',
        ['user_id' => $userId]
    );

    return array_values(array_map(
        static fn (array $row): array => profile_integration_account_payload($row),
        $statement->fetchAll()
    ));
}

function profile_integration_account_for_user(int $userId, string $provider): ?array
{
    $statement = db_query(
        'SELECT provider, provider_account_id, provider_handle, display_name, avatar_url,
                scopes_json, token_expires_at, connected_at, refreshed_at, revoked_at, last_error, error_at
         FROM profile_integration_accounts
         WHERE user_id = :user_id
           AND provider = :provider
         LIMIT 1',
        [
            'user_id' => $userId,
            'provider' => $provider,
        ]
    );
    $row = $statement->fetch();

    return is_array($row) ? profile_integration_account_payload($row) : null;
}

function profile_integration_account_payload(array $row): array
{
    return [
        'provider' => (string) $row['provider'],
        'providerAccountId' => (string) $row['provider_account_id'],
        'providerHandle' => $row['provider_handle'] === null ? null : (string) $row['provider_handle'],
        'displayName' => $row['display_name'] === null ? null : (string) $row['display_name'],
        'avatarUrl' => $row['avatar_url'] === null ? null : (string) $row['avatar_url'],
        'scopes' => profile_integration_json_list($row['scopes_json'] ?? null),
        'tokenExpiresAt' => $row['token_expires_at'] ?? null,
        'connectedAt' => $row['connected_at'] ?? null,
        'refreshedAt' => $row['refreshed_at'] ?? null,
        'revokedAt' => $row['revoked_at'] ?? null,
        'lastError' => $row['last_error'] === null ? null : (string) $row['last_error'],
        'errorAt' => $row['error_at'] ?? null,
    ];
}

function profile_integration_json_list(mixed $value): array
{
    if (!is_string($value) || trim($value) === '') {
        return [];
    }

    try {
        $decoded = json_decode($value, true, 512, JSON_THROW_ON_ERROR);
    } catch (JsonException) {
        return [];
    }

    if (!is_array($decoded) || !array_is_list($decoded)) {
        return [];
    }

    return array_values(array_filter($decoded, static fn (mixed $item): bool => is_string($item)));
}

function profile_integration_oauth_state(string $provider, string $state, int $userId): array
{
    $row = profile_integration_oauth_state_row($provider, $state, $userId);

    if (!is_array($row)) {
        json_error('OAuth state is invalid or expired.', 403);
    }

    return $row;
}

function profile_integration_oauth_state_row(string $provider, string $state, int $userId): ?array
{
    $statement = db_query(
        'SELECT *
         FROM profile_integration_oauth_states
         WHERE provider = :provider
           AND state_hash = :state_hash
           AND user_id = :user_id
           AND consumed_at IS NULL
           AND expires_at > UTC_TIMESTAMP()
         LIMIT 1',
        [
            'provider' => $provider,
            'state_hash' => hash('sha256', $state),
            'user_id' => $userId,
        ]
    );
    $row = $statement->fetch();

    return is_array($row) ? $row : null;
}

function profile_integration_upsert_account(int $userId, string $provider, array $token, array $identity): void
{
    $accessToken = isset($token['access_token']) && is_string($token['access_token']) ? $token['access_token'] : '';
    $refreshToken = isset($token['refresh_token']) && is_string($token['refresh_token']) ? $token['refresh_token'] : '';
    $expiresIn = isset($token['expires_in']) && is_numeric($token['expires_in']) ? max(0, (int) $token['expires_in']) : null;
    $tokenExpiresAt = $expiresIn === null ? null : gmdate('Y-m-d H:i:s', time() + $expiresIn);
    $scopes = profile_integration_token_scopes($token['scope'] ?? '');

    db_query(
        'INSERT INTO profile_integration_accounts
            (user_id, provider, provider_account_id, provider_handle, display_name, avatar_url,
             scopes_json, access_token_cipher, refresh_token_cipher, token_expires_at, connected_at, refreshed_at)
         VALUES
            (:user_id, :provider, :provider_account_id, :provider_handle, :display_name, :avatar_url,
             :scopes_json, :access_token_cipher, :refresh_token_cipher,
             :token_expires_at, UTC_TIMESTAMP(), UTC_TIMESTAMP())
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
             updated_at = UTC_TIMESTAMP()',
        [
            'user_id' => $userId,
            'provider' => $provider,
            'provider_account_id' => (string) ($identity['id'] ?? $provider . ':' . $userId),
            'provider_handle' => $identity['handle'] ?? null,
            'display_name' => $identity['displayName'] ?? null,
            'avatar_url' => $identity['avatarUrl'] ?? null,
            'scopes_json' => json_encode($scopes, JSON_THROW_ON_ERROR),
            'access_token_cipher' => $accessToken === '' ? null : profile_integration_encrypt($accessToken),
            'refresh_token_cipher' => $refreshToken === '' ? null : profile_integration_encrypt($refreshToken),
            'token_expires_at' => $tokenExpiresAt,
        ]
    );
}

function profile_integration_token_scopes(mixed $value): array
{
    if (is_string($value)) {
        return array_values(array_filter(preg_split('/\s+/', trim($value)) ?: []));
    }

    if (is_array($value) && array_is_list($value)) {
        return array_values(array_filter($value, static fn (mixed $item): bool => is_string($item) && $item !== ''));
    }

    return [];
}

function profile_integration_authorization_url(string $provider, array $config, string $state, string $codeVerifier): string
{
    $redirectUri = profile_integration_redirect_uri($provider, $config);
    $clientId = (string) ($config['client_id'] ?? '');
    $scope = profile_integration_scope($provider);

    if ($provider === 'apple_music') {
        json_error('Apple Music uses MusicKit user authorization instead of this OAuth redirect flow.', 422);
    }

    $baseUrl = match ($provider) {
        'spotify' => 'https://accounts.spotify.com/authorize',
        'youtube' => 'https://accounts.google.com/o/oauth2/v2/auth',
        'twitch' => 'https://id.twitch.tv/oauth2/authorize',
        'github' => 'https://github.com/login/oauth/authorize',
        default => json_error('Choose a supported integration provider.', 422),
    };

    $params = [
        'client_id' => $clientId,
        'redirect_uri' => $redirectUri,
        'response_type' => 'code',
        'scope' => $scope,
        'state' => $state,
    ];

    if ($provider === 'youtube') {
        $params['access_type'] = 'offline';
        $params['prompt'] = 'consent';
        $params['code_challenge'] = base64_url_encode(hash('sha256', $codeVerifier, true));
        $params['code_challenge_method'] = 'S256';
    }

    return $baseUrl . '?' . http_build_query($params, '', '&', PHP_QUERY_RFC3986);
}

function profile_integration_scope(string $provider): string
{
    return match ($provider) {
        'spotify' => 'user-read-currently-playing user-read-recently-played',
        'youtube' => 'https://www.googleapis.com/auth/youtube.readonly',
        'twitch' => 'user:read:email',
        'github' => 'read:user public_repo',
        default => '',
    };
}

function profile_integration_redirect_uri(string $provider, array $config): string
{
    $configured = $config['redirect_uri'] ?? null;

    if (is_string($configured) && filter_var($configured, FILTER_VALIDATE_URL) !== false) {
        return $configured;
    }

    $baseUrl = rtrim((string) (api_config()['app']['base_url'] ?? 'https://thia.lol'), '/');

    return "{$baseUrl}/api/integrations/{$provider}/callback";
}

function profile_integration_redirect_path(mixed $value): string
{
    if (!is_string($value) || $value === '') {
        return '/settings';
    }

    $trimmed = trim($value);

    if (preg_match('#^/[a-zA-Z0-9/_@?.=&%-]{0,240}$#', $trimmed) !== 1) {
        return '/settings';
    }

    return $trimmed;
}

function profile_integration_exchange_code(string $provider, string $code, string $codeVerifier): array
{
    $config = profile_integration_provider_config($provider);
    $redirectUri = profile_integration_redirect_uri($provider, $config);
    $clientId = (string) ($config['client_id'] ?? '');
    $clientSecret = (string) ($config['client_secret'] ?? '');

    $url = match ($provider) {
        'spotify' => 'https://accounts.spotify.com/api/token',
        'youtube' => 'https://oauth2.googleapis.com/token',
        'twitch' => 'https://id.twitch.tv/oauth2/token',
        'github' => 'https://github.com/login/oauth/access_token',
        default => json_error('Choose a supported integration provider.', 422),
    };

    $body = [
        'grant_type' => 'authorization_code',
        'code' => $code,
        'redirect_uri' => $redirectUri,
        'client_id' => $clientId,
        'client_secret' => $clientSecret,
    ];

    if ($provider === 'youtube') {
        $body['code_verifier'] = $codeVerifier;
    }

    $headers = ['Accept: application/json'];

    if ($provider === 'spotify') {
        $headers[] = 'Authorization: Basic ' . base64_encode($clientId . ':' . $clientSecret);
        unset($body['client_secret']);
    }

    $response = profile_integration_http_json('POST', $url, $headers, $body);

    if (!isset($response['access_token']) || !is_string($response['access_token'])) {
        json_error('OAuth token exchange failed.', 502);
    }

    return $response;
}

function profile_integration_fetch_identity(string $provider, array $token): array
{
    $accessToken = isset($token['access_token']) && is_string($token['access_token']) ? $token['access_token'] : '';

    if ($accessToken === '') {
        return [];
    }

    $headers = ['Authorization: Bearer ' . $accessToken];
    $url = match ($provider) {
        'spotify' => 'https://api.spotify.com/v1/me',
        'youtube' => 'https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true',
        'twitch' => 'https://api.twitch.tv/helix/users',
        'github' => 'https://api.github.com/user',
        default => null,
    };

    if ($url === null) {
        return [];
    }

    if ($provider === 'twitch') {
        $config = profile_integration_provider_config('twitch');
        $headers[] = 'Client-Id: ' . (string) ($config['client_id'] ?? '');
    }

    $response = profile_integration_http_json('GET', $url, $headers);

    return match ($provider) {
        'spotify' => [
            'id' => $response['id'] ?? '',
            'handle' => $response['display_name'] ?? null,
            'displayName' => $response['display_name'] ?? null,
            'avatarUrl' => $response['images'][0]['url'] ?? null,
        ],
        'youtube' => [
            'id' => $response['items'][0]['id'] ?? '',
            'handle' => $response['items'][0]['snippet']['customUrl'] ?? null,
            'displayName' => $response['items'][0]['snippet']['title'] ?? null,
            'avatarUrl' => $response['items'][0]['snippet']['thumbnails']['default']['url'] ?? null,
        ],
        'twitch' => [
            'id' => $response['data'][0]['id'] ?? '',
            'handle' => $response['data'][0]['login'] ?? null,
            'displayName' => $response['data'][0]['display_name'] ?? null,
            'avatarUrl' => $response['data'][0]['profile_image_url'] ?? null,
        ],
        'github' => [
            'id' => isset($response['id']) ? (string) $response['id'] : '',
            'handle' => $response['login'] ?? null,
            'displayName' => $response['name'] ?? ($response['login'] ?? null),
            'avatarUrl' => $response['avatar_url'] ?? null,
        ],
        default => [],
    };
}

function profile_integration_resolve_url(string $rawUrl, ?string $preferredProvider = null, ?int $userId = null): ?array
{
    if (!profile_integrations_storage_exists()) {
        return profile_integration_generated_card($rawUrl, $preferredProvider);
    }

    $normalized = profile_integration_normalize_url($rawUrl, $preferredProvider);

    if ($normalized === null) {
        return null;
    }

    $cached = profile_integration_cache_record($normalized['provider'], $normalized['resourceKey']);

    if ($cached !== null && profile_integration_cache_is_fresh($cached)) {
        return profile_integration_cache_payload($cached);
    }

    try {
        $fresh = profile_integration_fetch_metadata($normalized, $userId);
        profile_integration_cache_upsert($fresh, null);

        return $fresh;
    } catch (Throwable $exception) {
        if ($cached !== null) {
            profile_integration_cache_mark_error((int) $cached['id'], $exception->getMessage());
            return profile_integration_cache_payload($cached, true);
        }

        $fallback = profile_integration_generated_card($rawUrl, $preferredProvider);

        if ($fallback !== null) {
            profile_integration_cache_upsert($fallback, $exception->getMessage());
        }

        return $fallback;
    }
}

function profile_integration_generated_card(string $rawUrl, ?string $preferredProvider = null): ?array
{
    $normalized = profile_integration_normalize_url($rawUrl, $preferredProvider);

    if ($normalized === null) {
        return null;
    }

    return profile_integration_card_payload(
        $normalized,
        profile_integration_fallback_metadata($normalized),
        profile_integration_embed_payload($normalized),
        false
    );
}

function profile_integration_fetch_metadata(array $normalized, ?int $userId): array
{
    $metadata = profile_integration_fallback_metadata($normalized);

    if ($normalized['provider'] === 'github') {
        $metadata = array_merge($metadata, profile_integration_fetch_github_repo($normalized));
    } elseif ($normalized['provider'] === 'spotify') {
        $metadata = array_merge($metadata, profile_integration_fetch_spotify_resource($normalized));
    } elseif ($normalized['provider'] === 'youtube') {
        $metadata = array_merge($metadata, profile_integration_fetch_youtube_resource($normalized));
    } elseif ($normalized['provider'] === 'twitch') {
        $metadata = array_merge($metadata, profile_integration_fetch_twitch_resource($normalized));
    } elseif ($normalized['provider'] === 'apple_music') {
        $metadata = array_merge($metadata, profile_integration_fetch_apple_music_resource($normalized));
    }

    return profile_integration_card_payload(
        $normalized,
        $metadata,
        profile_integration_embed_payload($normalized),
        true
    );
}

function profile_integration_card_payload(array $normalized, array $metadata, ?array $embed, bool $apiBacked): array
{
    return [
        'provider' => $normalized['provider'],
        'resourceType' => $normalized['resourceType'],
        'resourceId' => $normalized['resourceId'],
        'resourceKey' => $normalized['resourceKey'],
        'sourceUrl' => $normalized['sourceUrl'],
        'metadata' => $metadata,
        'embed' => $embed,
        'apiBacked' => $apiBacked,
        'fetchedAt' => gmdate('c'),
        'expiresAt' => gmdate('c', time() + PROFILE_INTEGRATION_TTL_SECONDS),
        'staleAt' => gmdate('c', time() + PROFILE_INTEGRATION_STALE_SECONDS),
    ];
}

function profile_integration_normalize_url(string $rawUrl, ?string $preferredProvider = null): ?array
{
    $url = profile_integration_url($rawUrl);
    $parts = parse_url($url);
    $host = strtolower((string) ($parts['host'] ?? ''));
    $path = trim((string) ($parts['path'] ?? ''), '/');
    $segments = $path === '' ? [] : explode('/', $path);
    $provider = $preferredProvider ?? profile_integration_provider_from_host($host);

    if ($provider === null) {
        return null;
    }

    $resourceType = 'link';
    $resourceId = '';
    $sourceUrl = $url;

    if ($provider === 'spotify' && $host === 'open.spotify.com' && count($segments) >= 2) {
        $resourceType = strtolower($segments[0]);
        $resourceId = preg_replace('/[^A-Za-z0-9]/', '', $segments[1]) ?? '';
        $sourceUrl = "https://open.spotify.com/{$resourceType}/{$resourceId}";
    } elseif ($provider === 'apple_music' && in_array($host, ['music.apple.com', 'itunes.apple.com'], true) && count($segments) >= 2) {
        $resourceType = str_contains($path, '/playlist/') ? 'playlist' : (str_contains($path, '/album/') ? 'album' : 'song');
        $resourceId = profile_integration_last_identifier($url);
    } elseif ($provider === 'youtube' && in_array($host, ['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be', 'music.youtube.com'], true)) {
        $playlistId = profile_integration_youtube_identifier(profile_integration_query_value($url, 'list'));
        $firstSegment = $segments[0] ?? '';
        $videoId = '';

        if ($host === 'youtu.be' && isset($segments[0])) {
            $videoId = profile_integration_youtube_identifier($segments[0]);
        } elseif ($firstSegment === 'watch') {
            $videoId = profile_integration_youtube_identifier(profile_integration_query_value($url, 'v'));
        } elseif (in_array($firstSegment, ['shorts', 'live', 'embed'], true) && isset($segments[1])) {
            $videoId = profile_integration_youtube_identifier($segments[1]);
        }

        if ($videoId !== '') {
            $resourceType = 'video';
            $resourceId = $videoId;
            $sourceUrl = 'https://www.youtube.com/watch?v=' . rawurlencode($resourceId);
        } elseif ($playlistId !== '') {
            $resourceType = 'playlist';
            $resourceId = $playlistId;
            $sourceUrl = 'https://www.youtube.com/playlist?list=' . rawurlencode($resourceId);
        } elseif (str_starts_with($firstSegment, '@')) {
            $resourceType = 'channel';
            $resourceId = profile_integration_youtube_identifier($firstSegment, true);
            $sourceUrl = 'https://www.youtube.com/' . $resourceId;
        } elseif ($firstSegment === 'channel' && isset($segments[1])) {
            $resourceType = 'channel';
            $resourceId = profile_integration_youtube_identifier($segments[1]);
            $sourceUrl = 'https://www.youtube.com/channel/' . rawurlencode($resourceId);
        }
    } elseif ($provider === 'twitch' && in_array($host, ['twitch.tv', 'www.twitch.tv'], true) && isset($segments[0])) {
        $resourceType = ($segments[0] === 'videos' && isset($segments[1])) ? 'video' : 'channel';
        $resourceId = $resourceType === 'video' ? $segments[1] : $segments[0];
    } elseif ($provider === 'github' && in_array($host, ['github.com', 'www.github.com'], true) && count($segments) >= 2) {
        $resourceType = 'repo';
        $resourceId = strtolower($segments[0] . '/' . $segments[1]);
        $sourceUrl = 'https://github.com/' . $resourceId;
    }

    $resourceId = trim($resourceId);

    if ($resourceId === '') {
        return null;
    }

    return [
        'provider' => $provider,
        'resourceType' => $resourceType,
        'resourceId' => $resourceId,
        'resourceKey' => "{$provider}:{$resourceType}:{$resourceId}",
        'sourceUrl' => $sourceUrl,
    ];
}

function profile_integration_provider_from_host(string $host): ?string
{
    return match (true) {
        $host === 'open.spotify.com' => 'spotify',
        in_array($host, ['music.apple.com', 'itunes.apple.com'], true) => 'apple_music',
        in_array($host, ['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be', 'music.youtube.com'], true) => 'youtube',
        in_array($host, ['twitch.tv', 'www.twitch.tv'], true) => 'twitch',
        in_array($host, ['github.com', 'www.github.com'], true) => 'github',
        default => null,
    };
}

function profile_integration_youtube_identifier(string $value, bool $allowHandle = false): string
{
    $trimmed = trim($value);

    if ($allowHandle && str_starts_with($trimmed, '@')) {
        $handle = preg_replace('/[^A-Za-z0-9._-]/', '', substr($trimmed, 1)) ?? '';

        return $handle === '' ? '' : '@' . $handle;
    }

    return preg_replace('/[^A-Za-z0-9_-]/', '', $trimmed) ?? '';
}

function profile_integration_url(mixed $value): string
{
    if (!is_string($value)) {
        json_error('Integration URL is invalid.', 422);
    }

    $trimmed = trim($value);

    if (strlen($trimmed) > 500 || filter_var($trimmed, FILTER_VALIDATE_URL) === false) {
        json_error('Integration URL is invalid.', 422);
    }

    $scheme = strtolower((string) parse_url($trimmed, PHP_URL_SCHEME));

    if ($scheme !== 'https') {
        json_error('Integration URL must use HTTPS.', 422);
    }

    return $trimmed;
}

function profile_integration_query_value(string $url, string $key): string
{
    $query = parse_url($url, PHP_URL_QUERY);

    if (!is_string($query)) {
        return '';
    }

    parse_str($query, $params);
    $value = $params[$key] ?? '';

    return is_string($value) ? $value : '';
}

function profile_integration_last_identifier(string $url): string
{
    $queryId = profile_integration_query_value($url, 'i');

    if ($queryId !== '') {
        return preg_replace('/[^A-Za-z0-9._-]/', '', $queryId) ?? '';
    }

    $path = trim((string) parse_url($url, PHP_URL_PATH), '/');
    $parts = array_values(array_filter(explode('/', $path)));

    return preg_replace('/[^A-Za-z0-9._-]/', '', end($parts) ?: '') ?? '';
}

function profile_integration_fallback_metadata(array $normalized): array
{
    $providerLabel = profile_integration_provider_label($normalized['provider']);
    $title = match ($normalized['provider']) {
        'github' => $normalized['resourceId'],
        'twitch' => $normalized['resourceType'] === 'channel' ? '@' . $normalized['resourceId'] : 'Twitch video',
        'youtube' => $normalized['resourceType'] === 'channel' ? $normalized['resourceId'] : 'YouTube video',
        'spotify' => 'Spotify ' . $normalized['resourceType'],
        'apple_music' => 'Apple Music ' . $normalized['resourceType'],
        default => $providerLabel,
    };

    return [
        'title' => $title,
        'subtitle' => $providerLabel,
        'description' => null,
        'imageUrl' => null,
        'live' => false,
        'liveFetchedAt' => null,
        'recentLabel' => null,
        'recentFetchedAt' => null,
        'stats' => [],
    ];
}

function profile_integration_provider_label(string $provider): string
{
    return match ($provider) {
        'spotify' => 'Spotify',
        'apple_music' => 'Apple Music',
        'youtube' => 'YouTube',
        'twitch' => 'Twitch',
        'github' => 'GitHub',
        default => 'Integration',
    };
}

function profile_integration_embed_payload(array $normalized): ?array
{
    $src = match ($normalized['provider']) {
        'spotify' => 'https://open.spotify.com/embed/' . rawurlencode($normalized['resourceType']) . '/' . rawurlencode($normalized['resourceId']) . '?theme=0',
        'apple_music' => 'https://embed.music.apple.com/us/' . rawurlencode($normalized['resourceType']) . '/' . rawurlencode($normalized['resourceId']),
        'youtube' => match ($normalized['resourceType']) {
            'video' => 'https://www.youtube-nocookie.com/embed/' . rawurlencode($normalized['resourceId']),
            'playlist' => 'https://www.youtube-nocookie.com/embed/videoseries?list=' . rawurlencode($normalized['resourceId']),
            default => null,
        },
        'twitch' => profile_integration_twitch_embed_src($normalized),
        default => null,
    };

    if ($src === null) {
        return null;
    }

    return [
        'type' => 'iframe',
        'src' => $src,
        'title' => profile_integration_provider_label($normalized['provider']) . ' embed',
        'allow' => 'autoplay; encrypted-media; picture-in-picture; fullscreen',
        'height' => profile_integration_embed_height($normalized),
    ];
}

function profile_integration_embed_height(array $normalized): int
{
    if ($normalized['provider'] === 'spotify') {
        return $normalized['resourceType'] === 'track' ? 80 : 152;
    }

    if ($normalized['provider'] === 'apple_music') {
        return 152;
    }

    return 220;
}

function profile_integration_twitch_embed_src(array $normalized): ?string
{
    $parent = (string) (profile_integration_provider_config('twitch')['embed_parent'] ?? 'thia.lol');

    if ($normalized['resourceType'] === 'channel') {
        return 'https://player.twitch.tv/?channel=' . rawurlencode($normalized['resourceId']) . '&parent=' . rawurlencode($parent) . '&muted=true&autoplay=false';
    }

    if ($normalized['resourceType'] === 'video') {
        return 'https://player.twitch.tv/?video=v' . rawurlencode(ltrim($normalized['resourceId'], 'v')) . '&parent=' . rawurlencode($parent) . '&muted=true&autoplay=false';
    }

    return null;
}

function profile_integration_fetch_github_repo(array $normalized): array
{
    [$owner, $repo] = explode('/', $normalized['resourceId'], 2);
    $response = profile_integration_http_json(
        'GET',
        "https://api.github.com/repos/" . rawurlencode($owner) . '/' . rawurlencode($repo),
        ['Accept: application/vnd.github+json']
    );

    return [
        'title' => $response['full_name'] ?? $normalized['resourceId'],
        'subtitle' => 'GitHub repository',
        'description' => $response['description'] ?? null,
        'imageUrl' => $response['owner']['avatar_url'] ?? null,
        'stats' => [
            'stars' => $response['stargazers_count'] ?? null,
            'forks' => $response['forks_count'] ?? null,
            'language' => $response['language'] ?? null,
            'updatedAt' => $response['updated_at'] ?? null,
        ],
    ];
}

function profile_integration_fetch_spotify_resource(array $normalized): array
{
    $token = profile_integration_spotify_app_token();
    $resourceType = $normalized['resourceType'];

    if (!in_array($resourceType, ['track', 'album', 'playlist', 'artist', 'episode', 'show'], true)) {
        return [];
    }

    $response = profile_integration_http_json(
        'GET',
        'https://api.spotify.com/v1/' . rawurlencode($resourceType . 's') . '/' . rawurlencode($normalized['resourceId']),
        ['Authorization: Bearer ' . $token]
    );

    $artists = $response['artists'] ?? ($response['owner']['display_name'] ?? null);
    $subtitle = is_array($artists)
        ? implode(', ', array_map(static fn (array $artist): string => (string) ($artist['name'] ?? ''), $artists))
        : (is_string($artists) ? $artists : 'Spotify');

    return [
        'title' => $response['name'] ?? 'Spotify ' . $resourceType,
        'subtitle' => trim($subtitle) === '' ? 'Spotify' : $subtitle,
        'description' => $response['description'] ?? null,
        'imageUrl' => $response['images'][0]['url'] ?? ($response['album']['images'][0]['url'] ?? null),
    ];
}

function profile_integration_spotify_app_token(): string
{
    $config = profile_integration_provider_config('spotify');
    $clientId = (string) ($config['client_id'] ?? '');
    $clientSecret = (string) ($config['client_secret'] ?? '');

    if ($clientId === '' || $clientSecret === '') {
        throw new RuntimeException('Spotify credentials are not configured.');
    }

    $response = profile_integration_http_json(
        'POST',
        'https://accounts.spotify.com/api/token',
        ['Authorization: Basic ' . base64_encode($clientId . ':' . $clientSecret)],
        ['grant_type' => 'client_credentials']
    );

    if (!isset($response['access_token']) || !is_string($response['access_token'])) {
        throw new RuntimeException('Spotify app token response was invalid.');
    }

    return $response['access_token'];
}

function profile_integration_fetch_youtube_resource(array $normalized): array
{
    $config = profile_integration_provider_config('youtube');
    $apiKey = (string) ($config['api_key'] ?? '');

    if ($apiKey === '') {
        throw new RuntimeException('YouTube API key is not configured.');
    }

    $params = [
        'part' => 'snippet,statistics',
        'key' => $apiKey,
    ];

    if ($normalized['resourceType'] === 'video') {
        $params['id'] = $normalized['resourceId'];
        $url = 'https://www.googleapis.com/youtube/v3/videos?' . http_build_query($params);
    } elseif ($normalized['resourceType'] === 'playlist') {
        $params['id'] = $normalized['resourceId'];
        $params['part'] = 'snippet,contentDetails';
        $url = 'https://www.googleapis.com/youtube/v3/playlists?' . http_build_query($params);
    } else {
        $params[str_starts_with($normalized['resourceId'], '@') ? 'forHandle' : 'id'] = $normalized['resourceId'];
        $url = 'https://www.googleapis.com/youtube/v3/channels?' . http_build_query($params);
    }

    $response = profile_integration_http_json('GET', $url);
    $item = $response['items'][0] ?? [];

    if (!is_array($item)) {
        return [];
    }

    return [
        'title' => $item['snippet']['title'] ?? 'YouTube',
        'subtitle' => 'YouTube',
        'description' => $item['snippet']['description'] ?? null,
        'imageUrl' => $item['snippet']['thumbnails']['medium']['url'] ?? ($item['snippet']['thumbnails']['default']['url'] ?? null),
        'stats' => [
            'views' => $item['statistics']['viewCount'] ?? null,
            'subscribers' => $item['statistics']['subscriberCount'] ?? null,
            'items' => $item['contentDetails']['itemCount'] ?? null,
        ],
    ];
}

function profile_integration_fetch_twitch_resource(array $normalized): array
{
    $token = profile_integration_twitch_app_token();
    $config = profile_integration_provider_config('twitch');
    $headers = [
        'Authorization: Bearer ' . $token,
        'Client-Id: ' . (string) ($config['client_id'] ?? ''),
    ];

    if ($normalized['resourceType'] !== 'channel') {
        return [];
    }

    $user = profile_integration_http_json(
        'GET',
        'https://api.twitch.tv/helix/users?login=' . rawurlencode($normalized['resourceId']),
        $headers
    );
    $stream = profile_integration_http_json(
        'GET',
        'https://api.twitch.tv/helix/streams?user_login=' . rawurlencode($normalized['resourceId']),
        $headers
    );
    $userData = $user['data'][0] ?? [];
    $streamData = $stream['data'][0] ?? null;

    return [
        'title' => $userData['display_name'] ?? '@' . $normalized['resourceId'],
        'subtitle' => 'Twitch channel',
        'description' => $userData['description'] ?? null,
        'imageUrl' => $userData['profile_image_url'] ?? null,
        'live' => is_array($streamData),
        'liveFetchedAt' => gmdate('c'),
        'recentLabel' => is_array($streamData) ? ($streamData['title'] ?? 'Live now') : null,
        'recentFetchedAt' => is_array($streamData) ? gmdate('c') : null,
        'stats' => [
            'viewers' => is_array($streamData) ? ($streamData['viewer_count'] ?? null) : null,
            'game' => is_array($streamData) ? ($streamData['game_name'] ?? null) : null,
        ],
    ];
}

function profile_integration_twitch_app_token(): string
{
    $config = profile_integration_provider_config('twitch');
    $clientId = (string) ($config['client_id'] ?? '');
    $clientSecret = (string) ($config['client_secret'] ?? '');

    if ($clientId === '' || $clientSecret === '') {
        throw new RuntimeException('Twitch credentials are not configured.');
    }

    $response = profile_integration_http_json(
        'POST',
        'https://id.twitch.tv/oauth2/token',
        ['Accept: application/json'],
        [
            'client_id' => $clientId,
            'client_secret' => $clientSecret,
            'grant_type' => 'client_credentials',
        ]
    );

    if (!isset($response['access_token']) || !is_string($response['access_token'])) {
        throw new RuntimeException('Twitch app token response was invalid.');
    }

    return $response['access_token'];
}

function profile_integration_fetch_apple_music_resource(array $normalized): array
{
    $config = profile_integration_provider_config('apple_music');
    $developerToken = (string) ($config['developer_token'] ?? '');
    $storefront = preg_replace('/[^a-zA-Z0-9_-]/', '', (string) ($config['storefront'] ?? 'us')) ?: 'us';

    if ($developerToken === '') {
        throw new RuntimeException('Apple Music developer token is not configured.');
    }

    $resourceType = $normalized['resourceType'] === 'song' ? 'songs' : $normalized['resourceType'] . 's';
    $response = profile_integration_http_json(
        'GET',
        "https://api.music.apple.com/v1/catalog/{$storefront}/{$resourceType}/" . rawurlencode($normalized['resourceId']),
        ['Authorization: Bearer ' . $developerToken]
    );
    $item = $response['data'][0]['attributes'] ?? [];

    if (!is_array($item)) {
        return [];
    }

    return [
        'title' => $item['name'] ?? 'Apple Music',
        'subtitle' => $item['artistName'] ?? 'Apple Music',
        'description' => is_array($item['description'] ?? null)
            ? ($item['description']['standard'] ?? null)
            : ($item['description'] ?? null),
        'imageUrl' => isset($item['artwork']['url'])
            ? str_replace(['{w}', '{h}'], ['300', '300'], (string) $item['artwork']['url'])
            : null,
    ];
}

function profile_integration_http_json(string $method, string $url, array $headers = [], array $body = []): array
{
    if (!function_exists('curl_init')) {
        throw new RuntimeException('cURL is not available.');
    }

    $curl = curl_init($url);

    if ($curl === false) {
        throw new RuntimeException('Could not initialize provider request.');
    }

    $headers[] = 'User-Agent: thia.lol integrations';
    $headers[] = 'Accept: application/json';

    curl_setopt_array($curl, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 8,
        CURLOPT_FOLLOWLOCATION => false,
        CURLOPT_HTTPHEADER => array_values(array_unique($headers)),
    ]);

    if ($method === 'POST') {
        curl_setopt($curl, CURLOPT_POST, true);
        curl_setopt($curl, CURLOPT_POSTFIELDS, http_build_query($body));
    }

    $raw = curl_exec($curl);
    $status = (int) curl_getinfo($curl, CURLINFO_RESPONSE_CODE);
    $error = curl_error($curl);
    curl_close($curl);

    if (!is_string($raw) || $raw === false || $status < 200 || $status >= 300) {
        throw new RuntimeException($error !== '' ? $error : "Provider request failed with HTTP {$status}.");
    }

    try {
        $decoded = json_decode($raw, true, 512, JSON_THROW_ON_ERROR);
    } catch (JsonException $exception) {
        throw new RuntimeException('Provider response was not valid JSON.', 0, $exception);
    }

    if (!is_array($decoded)) {
        throw new RuntimeException('Provider response was not an object.');
    }

    return $decoded;
}

function profile_integration_cache_record(string $provider, string $resourceKey): ?array
{
    $statement = db_query(
        'SELECT *
         FROM profile_integration_metadata_cache
         WHERE provider = :provider
           AND resource_key = :resource_key
         LIMIT 1',
        [
            'provider' => $provider,
            'resource_key' => $resourceKey,
        ]
    );
    $row = $statement->fetch();

    return is_array($row) ? $row : null;
}

function profile_integration_cache_is_fresh(array $row): bool
{
    $expiresAt = strtotime((string) ($row['expires_at'] ?? ''));

    return $expiresAt !== false && $expiresAt > time();
}

function profile_integration_cache_payload(array $row, bool $stale = false): array
{
    $metadata = profile_integration_decode_object($row['metadata_json'] ?? null);
    $embed = profile_integration_decode_object($row['embed_json'] ?? null);

    return [
        'provider' => (string) $row['provider'],
        'resourceType' => (string) $row['resource_type'],
        'resourceId' => (string) $row['resource_id'],
        'resourceKey' => (string) $row['resource_key'],
        'sourceUrl' => (string) $row['source_url'],
        'metadata' => $metadata,
        'embed' => $embed === [] ? null : $embed,
        'apiBacked' => (bool) ($row['api_backed'] ?? false),
        'fetchedAt' => $row['fetched_at'] ?? null,
        'expiresAt' => $row['expires_at'] ?? null,
        'staleAt' => $row['stale_at'] ?? null,
        'stale' => $stale,
        'lastError' => $row['error_message'] ?? null,
    ];
}

function profile_integration_decode_object(mixed $value): array
{
    if (!is_string($value) || trim($value) === '') {
        return [];
    }

    try {
        $decoded = json_decode($value, true, 512, JSON_THROW_ON_ERROR);
    } catch (JsonException) {
        return [];
    }

    return is_array($decoded) && !array_is_list($decoded) ? $decoded : [];
}

function profile_integration_cache_upsert(array $card, ?string $error): void
{
    $expiresAt = gmdate('Y-m-d H:i:s', time() + PROFILE_INTEGRATION_TTL_SECONDS);
    $staleAt = gmdate('Y-m-d H:i:s', time() + PROFILE_INTEGRATION_STALE_SECONDS);

    db_query(
        'INSERT INTO profile_integration_metadata_cache
            (provider, resource_type, resource_id, resource_key, source_url, metadata_json, embed_json,
             api_backed, fetched_at, expires_at, stale_at, error_message, error_at)
         VALUES
            (:provider, :resource_type, :resource_id, :resource_key, :source_url, :metadata_json, :embed_json,
             :api_backed, UTC_TIMESTAMP(), :expires_at, :stale_at, :error_message, :error_at)
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
             updated_at = UTC_TIMESTAMP()',
        [
            'provider' => $card['provider'],
            'resource_type' => $card['resourceType'],
            'resource_id' => $card['resourceId'],
            'resource_key' => $card['resourceKey'],
            'source_url' => $card['sourceUrl'],
            'metadata_json' => json_encode($card['metadata'], JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
            'embed_json' => $card['embed'] === null ? null : json_encode($card['embed'], JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
            'api_backed' => $card['apiBacked'] ? 1 : 0,
            'expires_at' => $expiresAt,
            'stale_at' => $staleAt,
            'error_message' => $error,
            'error_at' => $error === null ? null : gmdate('Y-m-d H:i:s'),
        ]
    );
}

function profile_integration_cache_mark_error(int $cacheId, string $message): void
{
    db_query(
        'UPDATE profile_integration_metadata_cache
         SET error_message = :error_message,
             error_at = UTC_TIMESTAMP(),
             updated_at = UTC_TIMESTAMP()
         WHERE id = :id',
        [
            'id' => $cacheId,
            'error_message' => substr($message, 0, 240),
        ]
    );
}

function profile_integration_encryption_key(): ?string
{
    $value = api_config()['security']['integration_encryption_key'] ?? '';

    if (!is_string($value) || trim($value) === '') {
        return null;
    }

    $trimmed = trim($value);
    $decoded = base64_decode($trimmed, true);

    if (is_string($decoded) && strlen($decoded) === PROFILE_INTEGRATION_ENCRYPTION_KEY_BYTES) {
        return $decoded;
    }

    if (strlen($trimmed) >= PROFILE_INTEGRATION_ENCRYPTION_KEY_BYTES) {
        return substr($trimmed, 0, PROFILE_INTEGRATION_ENCRYPTION_KEY_BYTES);
    }

    return null;
}

function profile_integration_crypto_method(): ?string
{
    if (
        defined('SODIUM_CRYPTO_SECRETBOX_KEYBYTES')
        && defined('SODIUM_CRYPTO_SECRETBOX_NONCEBYTES')
        && function_exists('sodium_crypto_secretbox')
        && function_exists('sodium_crypto_secretbox_open')
    ) {
        return 'sodium';
    }

    if (
        function_exists('openssl_encrypt')
        && function_exists('openssl_decrypt')
        && function_exists('openssl_get_cipher_methods')
    ) {
        $methods = array_map('strtolower', openssl_get_cipher_methods(true));

        if (in_array('aes-256-gcm', $methods, true)) {
            return 'openssl';
        }
    }

    return null;
}

function profile_integration_require_encryption_key(): string
{
    $key = profile_integration_encryption_key();

    if ($key === null) {
        json_error('Integration encryption is not configured.', 503);
    }

    if (profile_integration_crypto_method() === null) {
        json_error('Integration encryption is not available on this server. Enable PHP Sodium or OpenSSL.', 503);
    }

    return $key;
}

function profile_integration_encrypt(string $value): string
{
    $key = profile_integration_require_encryption_key();

    if (profile_integration_crypto_method() === 'openssl') {
        return PROFILE_INTEGRATION_OPENSSL_PREFIX . profile_integration_encrypt_openssl($value, $key);
    }

    $nonce = random_bytes(SODIUM_CRYPTO_SECRETBOX_NONCEBYTES);
    $cipher = sodium_crypto_secretbox($value, $nonce, $key);

    return base64_encode($nonce . $cipher);
}

function profile_integration_decrypt(string $value): string
{
    $key = profile_integration_require_encryption_key();

    if (str_starts_with($value, PROFILE_INTEGRATION_OPENSSL_PREFIX)) {
        return profile_integration_decrypt_openssl(substr($value, strlen(PROFILE_INTEGRATION_OPENSSL_PREFIX)), $key);
    }

    if (profile_integration_crypto_method() !== 'sodium') {
        json_error('Stored integration token requires PHP Sodium to decrypt.', 500);
    }

    $decoded = base64_decode($value, true);

    if (!is_string($decoded) || strlen($decoded) <= SODIUM_CRYPTO_SECRETBOX_NONCEBYTES) {
        json_error('Stored integration token is invalid.', 500);
    }

    $nonce = substr($decoded, 0, SODIUM_CRYPTO_SECRETBOX_NONCEBYTES);
    $cipher = substr($decoded, SODIUM_CRYPTO_SECRETBOX_NONCEBYTES);
    $plain = sodium_crypto_secretbox_open($cipher, $nonce, $key);

    if (!is_string($plain)) {
        json_error('Stored integration token could not be decrypted.', 500);
    }

    return $plain;
}

function profile_integration_encrypt_openssl(string $value, string $key): string
{
    $nonce = random_bytes(12);
    $tag = '';
    $cipher = openssl_encrypt($value, 'aes-256-gcm', $key, OPENSSL_RAW_DATA, $nonce, $tag);

    if (!is_string($cipher) || $tag === '') {
        json_error('Integration encryption failed.', 500);
    }

    return base64_encode($nonce . $tag . $cipher);
}

function profile_integration_decrypt_openssl(string $value, string $key): string
{
    $decoded = base64_decode($value, true);

    if (!is_string($decoded) || strlen($decoded) <= 28) {
        json_error('Stored integration token is invalid.', 500);
    }

    $nonce = substr($decoded, 0, 12);
    $tag = substr($decoded, 12, 16);
    $cipher = substr($decoded, 28);
    $plain = openssl_decrypt($cipher, 'aes-256-gcm', $key, OPENSSL_RAW_DATA, $nonce, $tag);

    if (!is_string($plain)) {
        json_error('Stored integration token could not be decrypted.', 500);
    }

    return $plain;
}

function profile_integration_redirect_to_app(string $redirectPath, array $query): void
{
    $safePath = profile_integration_redirect_path($redirectPath);
    $baseUrl = rtrim((string) (api_config()['app']['base_url'] ?? 'https://thia.lol'), '/');
    $separator = str_contains($safePath, '?') ? '&' : '?';
    $target = $baseUrl . $safePath . $separator . http_build_query($query, '', '&', PHP_QUERY_RFC3986);

    header('Location: ' . $target, true, 303);
    exit;
}

function profile_integration_suggestion_items(string $provider, int $userId, array $account): array
{
    return match ($provider) {
        'spotify' => profile_integration_spotify_suggestions($userId),
        'youtube' => profile_integration_youtube_suggestions($account),
        'twitch' => profile_integration_twitch_suggestions($account, $userId),
        'github' => profile_integration_github_suggestions($userId),
        default => [],
    };
}

function profile_integration_suggestion_item(string $id, string $label, string $description, string $sourceUrl, string $moduleType, ?array $card): array
{
    return [
        'id' => $id,
        'label' => $label,
        'description' => $description,
        'sourceUrl' => $sourceUrl,
        'moduleType' => $moduleType,
        'moduleTitle' => $moduleType === 'music' ? 'Music' : 'Creator',
        'card' => $card,
    ];
}

function profile_integration_spotify_suggestions(int $userId): array
{
    $token = profile_integration_access_token($userId, 'spotify');

    if ($token === null) {
        return [];
    }

    $response = profile_integration_http_json(
        'GET',
        'https://api.spotify.com/v1/me/player/recently-played?limit=5',
        ['Authorization: Bearer ' . $token]
    );
    $items = [];

    foreach (($response['items'] ?? []) as $item) {
        if (!is_array($item)) {
            continue;
        }

        $track = $item['track'] ?? [];
        $url = is_array($track) ? ($track['external_urls']['spotify'] ?? null) : null;

        if (!is_string($url) || $url === '') {
            continue;
        }

        $card = profile_integration_resolve_url($url, 'spotify', $userId);
        $title = is_array($track) && is_string($track['name'] ?? null) ? (string) $track['name'] : 'Spotify track';

        $items[] = profile_integration_suggestion_item(
            'spotify:' . md5($url),
            $title,
            'Recently played on Spotify',
            $url,
            'music',
            $card
        );
    }

    return $items;
}

function profile_integration_youtube_suggestions(array $account): array
{
    $handle = profile_integration_account_handle($account);

    if ($handle === null) {
        return [];
    }

    $sourceUrl = str_starts_with($handle, '@')
        ? 'https://www.youtube.com/' . preg_replace('/[^A-Za-z0-9_@.-]/', '', $handle)
        : 'https://www.youtube.com/channel/' . rawurlencode((string) $account['providerAccountId']);
    $card = profile_integration_generated_card($sourceUrl, 'youtube');

    return [
        profile_integration_suggestion_item(
            'youtube:channel:' . (string) $account['providerAccountId'],
            (string) ($account['displayName'] ?? $handle),
            'Connected YouTube channel',
            $sourceUrl,
            'creator_live',
            $card
        ),
    ];
}

function profile_integration_twitch_suggestions(array $account, int $userId): array
{
    $handle = profile_integration_account_handle($account);

    if ($handle === null) {
        return [];
    }

    $sourceUrl = 'https://www.twitch.tv/' . rawurlencode(ltrim($handle, '@'));
    $card = profile_integration_resolve_url($sourceUrl, 'twitch', $userId);

    return [
        profile_integration_suggestion_item(
            'twitch:channel:' . ltrim($handle, '@'),
            (string) ($account['displayName'] ?? '@' . ltrim($handle, '@')),
            'Connected Twitch channel',
            $sourceUrl,
            'creator_live',
            $card
        ),
    ];
}

function profile_integration_github_suggestions(int $userId): array
{
    $token = profile_integration_access_token($userId, 'github');

    if ($token === null) {
        return [];
    }

    $response = profile_integration_http_json(
        'GET',
        'https://api.github.com/user/repos?visibility=public&sort=updated&per_page=5',
        [
            'Authorization: Bearer ' . $token,
            'Accept: application/vnd.github+json',
        ]
    );
    $items = [];

    foreach (($response ?? []) as $repo) {
        if (!is_array($repo) || !is_string($repo['html_url'] ?? null) || !is_string($repo['full_name'] ?? null)) {
            continue;
        }

        $url = (string) $repo['html_url'];
        $card = profile_integration_resolve_url($url, 'github', $userId);

        $items[] = profile_integration_suggestion_item(
            'github:repo:' . strtolower((string) $repo['full_name']),
            (string) $repo['full_name'],
            is_string($repo['description'] ?? null) && $repo['description'] !== ''
                ? (string) $repo['description']
                : 'Public GitHub repository',
            $url,
            'creator_live',
            $card
        );
    }

    return $items;
}

function profile_integration_access_token(int $userId, string $provider): ?string
{
    $statement = db_query(
        'SELECT access_token_cipher
         FROM profile_integration_accounts
         WHERE user_id = :user_id
           AND provider = :provider
           AND revoked_at IS NULL
         LIMIT 1',
        [
            'user_id' => $userId,
            'provider' => $provider,
        ]
    );
    $row = $statement->fetch();

    if (!is_array($row) || !is_string($row['access_token_cipher'] ?? null) || $row['access_token_cipher'] === '') {
        return null;
    }

    return profile_integration_decrypt((string) $row['access_token_cipher']);
}

function profile_integration_account_handle(array $account): ?string
{
    $handle = $account['providerHandle'] ?? null;

    if (is_string($handle) && trim($handle) !== '') {
        return trim($handle);
    }

    $accountId = $account['providerAccountId'] ?? null;

    return is_string($accountId) && trim($accountId) !== '' ? trim($accountId) : null;
}

function profile_integration_reject_unknown_keys(array $body, array $allowed): void
{
    foreach (array_keys($body) as $key) {
        if (!in_array($key, $allowed, true)) {
            json_error("Unsupported integration field: {$key}.", 422);
        }
    }
}
