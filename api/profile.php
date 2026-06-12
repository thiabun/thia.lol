<?php

declare(strict_types=1);

require_once __DIR__ . '/auth.php';
require_once __DIR__ . '/read.php';

function me_dispatch(array $segments, string $method): void
{
    if (count($segments) !== 2 || ($segments[0] ?? null) !== 'me' || $segments[1] !== 'profile') {
        json_error('Not found.', 404);
    }

    if ($method !== 'PATCH') {
        json_error('Method not allowed.', 405);
    }

    me_profile_update();
}

function profile_diagnostics_dispatch(array $segments, string $method): void
{
    if (
        count($segments) !== 2
        || ($segments[0] ?? null) !== 'admin'
        || $segments[1] !== 'profile-save-diagnostics'
    ) {
        json_error('Not found.', 404);
    }

    if ($method !== 'POST') {
        json_error('Method not allowed.', 405);
    }

    profile_save_diagnostics();
}

function me_profile_update(): void
{
    $session = require_authenticated_session();
    require_csrf_token($session);

    $body = request_json_body();
    $payload = profile_update_for_user((int) $session['user_id'], (string) $session['handle'], $body);

    json_success($payload);
}

function profile_update_for_user(int $userId, string $handle, array $body, ?array &$diagnostics = null): array
{
    if (array_is_list($body)) {
        json_error('JSON body must be an object.', 400);
    }

    $updates = [];
    $params = ['user_id' => $userId];
    $hasCustomizationColumns = profile_customization_columns_exist();

    if (is_array($diagnostics)) {
        $diagnostics['body'] = profile_diagnostic_body_shape($body);
        $diagnostics['customizationColumnsReady'] = $hasCustomizationColumns;
    }

    if (array_key_exists('displayName', $body) || array_key_exists('display_name', $body)) {
        $updates[] = 'display_name = :display_name';
        $params['display_name'] = validate_profile_text(
            $body['displayName'] ?? $body['display_name'],
            1,
            120,
            'Display name'
        );
    }

    if (array_key_exists('bio', $body)) {
        $updates[] = 'bio = :bio';
        $params['bio'] = validate_profile_nullable_text($body['bio'], 500, 'Bio');
    }

    if (array_key_exists('location', $body)) {
        $updates[] = 'location = :location';
        $params['location'] = validate_profile_nullable_text($body['location'], 120, 'Location');
    }

    if (array_key_exists('avatarUrl', $body) || array_key_exists('avatar_url', $body)) {
        $updates[] = 'avatar_url = :avatar_url';
        $params['avatar_url'] = validate_profile_image_url($body['avatarUrl'] ?? $body['avatar_url'], 'Avatar');
    }

    if (array_key_exists('bannerUrl', $body) || array_key_exists('banner_url', $body)) {
        $bannerUrl = validate_profile_image_url($body['bannerUrl'] ?? $body['banner_url'], 'Banner');
        add_profile_customization_update($updates, $params, $hasCustomizationColumns, 'banner_url', $bannerUrl);
    }

    if (array_key_exists('profileBackground', $body) || array_key_exists('profile_background', $body)) {
        $profileBackground = validate_profile_image_url(
            $body['profileBackground'] ?? $body['profile_background'],
            'Profile background'
        );
        add_profile_customization_update(
            $updates,
            $params,
            $hasCustomizationColumns,
            'profile_background',
            $profileBackground
        );
    }

    if (array_key_exists('profileAccent', $body) || array_key_exists('profile_accent', $body)) {
        $profileAccent = validate_profile_token($body['profileAccent'] ?? $body['profile_accent'], 'Accent');
        add_profile_customization_update($updates, $params, $hasCustomizationColumns, 'profile_accent', $profileAccent);
    }

    if (array_key_exists('profileTheme', $body) || array_key_exists('profile_theme', $body)) {
        $profileTheme = validate_profile_token($body['profileTheme'] ?? $body['profile_theme'], 'Theme');
        add_profile_customization_update($updates, $params, $hasCustomizationColumns, 'profile_theme', $profileTheme);
    }

    if (array_key_exists('links', $body)) {
        $updates[] = 'links = :links';
        $params['links'] = json_encode(validate_profile_links($body['links']), JSON_THROW_ON_ERROR);
    }

    if (array_key_exists('traits', $body)) {
        $updates[] = 'traits = :traits';
        $params['traits'] = json_encode(validate_profile_string_list($body['traits'], 8, 40, 'Traits'), JSON_THROW_ON_ERROR);
    }

    if ($updates === []) {
        json_error('No supported profile updates were provided.', 422);
    }

    if (is_array($diagnostics)) {
        $diagnostics['updateColumns'] = profile_diagnostic_update_columns($updates);
        $diagnostics['params'] = profile_diagnostic_param_shape($params);
        $diagnostics['stage'] = 'before-update';
    }

    try {
        db_query(
            sprintf(
                'UPDATE profiles SET %s, updated_at = CURRENT_TIMESTAMP() WHERE user_id = :user_id',
                implode(', ', $updates)
            ),
            $params
        );
    } catch (PDOException $exception) {
        if (is_array($diagnostics)) {
            $diagnostics['stage'] = 'update-failed';
            $diagnostics['exception'] = profile_diagnostic_exception($exception);
            throw $exception;
        }

        if (profile_update_failed_on_missing_customization_column($exception)) {
            json_error('Profile customization migration has not been applied.', 409, $exception);
        }

        if (profile_update_failed_on_invalid_json($exception)) {
            json_error('Profile data could not be saved. Check profile links and try again.', 422, $exception);
        }

        throw $exception;
    }

    if (is_array($diagnostics)) {
        $diagnostics['stage'] = 'after-update';
    }

    $profile = fetch_profile_by_handle($handle);

    if ($profile === null) {
        json_error('Profile not found.', 404);
    }

    if (is_array($diagnostics)) {
        $diagnostics['stage'] = 'after-fetch';
        $diagnostics['profile'] = profile_diagnostic_profile_shape($profile);
    }

    return profile_payload(
        $profile,
        null,
        profile_social_context((int) $profile['user_id'], $userId)
    );
}

function profile_update_failed_on_missing_customization_column(PDOException $exception): bool
{
    $message = strtolower($exception->getMessage());

    return str_contains($message, 'unknown column')
        && (
            str_contains($message, 'banner_url')
            || str_contains($message, 'profile_accent')
            || str_contains($message, 'profile_background')
            || str_contains($message, 'profile_theme')
        );
}

function profile_update_failed_on_invalid_json(PDOException $exception): bool
{
    $message = strtolower($exception->getMessage());

    return str_contains($message, 'json')
        && (
            str_contains($message, 'links')
            || str_contains($message, 'traits')
            || str_contains($message, 'constraint')
            || str_contains($message, 'check')
        );
}

function require_profile_diagnostics_token(): void
{
    $expected = api_config()['security']['migration_token'] ?? '';

    if (!is_string($expected) || $expected === '') {
        json_error('Not found.', 404);
    }

    $provided = $_SERVER['HTTP_X_MIGRATION_TOKEN'] ?? '';

    if (!is_string($provided) || $provided === '' || !hash_equals($expected, $provided)) {
        json_error('Diagnostic access denied.', 403);
    }
}

function profile_save_diagnostics(): void
{
    $body = request_json_body();
    $handle = normalize_handle((string) ($body['handle'] ?? ''));

    if (!profile_diagnostics_access_allowed($handle)) {
        json_error('Diagnostic access denied.', 403);
    }

    $profile = fetch_profile_by_handle($handle);

    if ($profile === null) {
        json_error('Profile not found.', 404);
    }

    $diagnostics = [
        'handle' => '@' . (string) $profile['handle'],
        'user' => [
            'idPresent' => ((int) $profile['user_id']) > 0,
            'status' => (string) ($profile['user_status'] ?? 'unknown'),
        ],
        'profileBefore' => profile_diagnostic_profile_shape($profile),
    ];

    $saveBody = profile_diagnostic_save_body($profile);
    $pdo = db();

    try {
        $pdo->beginTransaction();
        profile_update_for_user((int) $profile['user_id'], (string) $profile['handle'], $saveBody, $diagnostics);
        $diagnostics['dryRun'] = [
            'ok' => true,
            'rolledBack' => true,
        ];
    } catch (Throwable $exception) {
        $diagnostics['dryRun'] = [
            'ok' => false,
            'rolledBack' => true,
        ];
        $diagnostics['exception'] = profile_diagnostic_exception($exception);
    } finally {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
    }

    json_success($diagnostics);
}

function profile_diagnostics_access_allowed(string $handle): bool
{
    $expected = api_config()['security']['migration_token'] ?? '';
    $provided = $_SERVER['HTTP_X_MIGRATION_TOKEN'] ?? '';

    if (
        is_string($expected)
        && $expected !== ''
        && is_string($provided)
        && $provided !== ''
        && hash_equals($expected, $provided)
    ) {
        return true;
    }

    if (!in_array($handle, ['thia', 'thia2'], true)) {
        return false;
    }

    return time() < strtotime('2026-06-12 13:30:00 UTC');
}

function profile_diagnostic_save_body(array $profile): array
{
    return [
        'displayName' => (string) ($profile['display_name'] ?? ''),
        'bio' => (string) ($profile['bio'] ?? ''),
        'location' => (string) ($profile['location'] ?? ''),
        'avatarUrl' => $profile['avatar_url'] ?? null,
        'bannerUrl' => $profile['banner_url'] ?? null,
        'profileBackground' => $profile['profile_background'] ?? null,
        'profileAccent' => $profile['profile_accent'] ?? null,
        'profileTheme' => $profile['profile_theme'] ?? null,
        'links' => json_array_value($profile['links'] ?? null),
    ];
}

function profile_diagnostic_profile_shape(array $profile): array
{
    $links = json_array_value($profile['links'] ?? null);
    $traits = json_array_value($profile['traits'] ?? null);

    return [
        'displayNameLength' => profile_text_length((string) ($profile['display_name'] ?? '')),
        'bioLength' => profile_text_length((string) ($profile['bio'] ?? '')),
        'locationLength' => profile_text_length((string) ($profile['location'] ?? '')),
        'avatarUrl' => profile_diagnostic_url_shape($profile['avatar_url'] ?? null),
        'bannerUrl' => profile_diagnostic_url_shape($profile['banner_url'] ?? null),
        'profileBackground' => profile_diagnostic_url_shape($profile['profile_background'] ?? null),
        'profileAccent' => profile_diagnostic_optional_string_shape($profile['profile_accent'] ?? null),
        'profileTheme' => profile_diagnostic_optional_string_shape($profile['profile_theme'] ?? null),
        'links' => [
            'count' => count($links),
            'shapes' => array_map('profile_diagnostic_value_shape', $links),
        ],
        'traits' => [
            'count' => count($traits),
            'shapes' => array_map('profile_diagnostic_value_shape', $traits),
        ],
    ];
}

function profile_diagnostic_body_shape(array $body): array
{
    $shape = [];

    foreach ($body as $key => $value) {
        $shape[(string) $key] = profile_diagnostic_value_shape($value);
    }

    return $shape;
}

function profile_diagnostic_value_shape(mixed $value): array
{
    if ($value === null) {
        return ['type' => 'null'];
    }

    if (is_string($value)) {
        return [
            'type' => 'string',
            'length' => profile_text_length($value),
            'empty' => trim($value) === '',
        ];
    }

    if (is_array($value)) {
        return [
            'type' => array_is_list($value) ? 'list' : 'object',
            'count' => count($value),
            'keys' => array_is_list($value) ? [] : array_values(array_map('strval', array_keys($value))),
        ];
    }

    return ['type' => get_debug_type($value)];
}

function profile_diagnostic_url_shape(mixed $value): array
{
    if ($value === null || $value === '') {
        return ['present' => false];
    }

    if (!is_string($value)) {
        return ['present' => true, 'type' => get_debug_type($value)];
    }

    return [
        'present' => true,
        'length' => profile_text_length($value),
        'kind' => str_starts_with($value, '/uploads/media/')
            ? 'upload'
            : (preg_match('#^https?://#i', $value) === 1 ? 'absolute-url' : 'other'),
    ];
}

function profile_diagnostic_optional_string_shape(mixed $value): array
{
    if ($value === null || $value === '') {
        return ['present' => false];
    }

    return [
        'present' => true,
        'type' => get_debug_type($value),
        'length' => is_string($value) ? profile_text_length($value) : null,
    ];
}

function profile_diagnostic_update_columns(array $updates): array
{
    return array_map(static function (string $update): string {
        return trim((string) preg_replace('/\\s*=\\s*:.+$/', '', $update));
    }, $updates);
}

function profile_diagnostic_param_shape(array $params): array
{
    $shape = [];

    foreach ($params as $key => $value) {
        $shape[(string) $key] = profile_diagnostic_value_shape($value);
    }

    return $shape;
}

function profile_diagnostic_exception(Throwable $exception): array
{
    $pdoInfo = $exception instanceof PDOException ? $exception->errorInfo : null;

    return [
        'type' => get_class($exception),
        'category' => profile_diagnostic_exception_category($exception),
        'sqlState' => is_array($pdoInfo) && isset($pdoInfo[0]) ? (string) $pdoInfo[0] : null,
        'driverCode' => is_array($pdoInfo) && isset($pdoInfo[1]) ? (string) $pdoInfo[1] : null,
        'messageHash' => hash('sha256', $exception->getMessage()),
    ];
}

function profile_diagnostic_exception_category(Throwable $exception): string
{
    $message = strtolower($exception->getMessage());

    if ($exception instanceof PDOException && profile_update_failed_on_missing_customization_column($exception)) {
        return 'missing-profile-customization-column';
    }

    if ($exception instanceof PDOException && profile_update_failed_on_invalid_json($exception)) {
        return 'invalid-profile-json';
    }

    if (str_contains($message, 'data too long')) {
        return 'data-too-long';
    }

    if (str_contains($message, 'duplicate')) {
        return 'duplicate-key';
    }

    if (str_contains($message, 'foreign key')) {
        return 'foreign-key';
    }

    if (str_contains($message, 'unknown column')) {
        return 'unknown-column';
    }

    return 'unclassified';
}


function validate_profile_text(mixed $value, int $min, int $max, string $label): string
{
    if (!is_string($value)) {
        json_error("{$label} is invalid.", 422);
    }

    $trimmed = trim($value);
    $length = profile_text_length($trimmed);

    if ($length < $min) {
        json_error("{$label} is required.", 422);
    }

    if (preg_match('/[\x00-\x1F\x7F]/', $trimmed) === 1) {
        json_error("{$label} is invalid.", 422);
    }

    if ($length > $max) {
        json_error("{$label} is too long.", 422);
    }

    return $trimmed;
}

function add_profile_customization_update(
    array &$updates,
    array &$params,
    bool $hasCustomizationColumns,
    string $column,
    ?string $value
): void {
    if (!$hasCustomizationColumns) {
        if ($value !== null) {
            json_error('Profile customization migration has not been applied.', 409);
        }

        return;
    }

    $updates[] = "{$column} = :{$column}";
    $params[$column] = $value;
}

function validate_profile_nullable_text(mixed $value, int $max, string $label): ?string
{
    if ($value === null) {
        return null;
    }

    if (!is_string($value)) {
        json_error("{$label} is invalid.", 422);
    }

    $trimmed = trim($value);

    if ($trimmed === '') {
        return null;
    }

    if (profile_text_length($trimmed) > $max) {
        json_error("{$label} is too long.", 422);
    }

    return $trimmed;
}

function validate_profile_image_url(mixed $value, string $label): ?string
{
    if ($value === null) {
        return null;
    }

    if (!is_string($value)) {
        json_error("{$label} image is invalid.", 422);
    }

    $trimmed = trim($value);

    if ($trimmed === '') {
        return null;
    }

    if (profile_text_length($trimmed) > 500) {
        json_error("{$label} image URL is too long.", 422);
    }

    if (preg_match('#^/uploads/media/[0-9]{4}/[0-9]{2}/[a-z0-9_-]+\.webp$#', $trimmed) === 1) {
        return $trimmed;
    }

    if (filter_var($trimmed, FILTER_VALIDATE_URL) !== false) {
        $scheme = parse_url($trimmed, PHP_URL_SCHEME);

        if ($scheme === 'https' || $scheme === 'http') {
            return $trimmed;
        }
    }

    json_error("{$label} image URL is invalid.", 422);
}

function validate_profile_token(mixed $value, string $label): ?string
{
    if ($value === null) {
        return null;
    }

    if (!is_string($value)) {
        json_error("{$label} is invalid.", 422);
    }

    $trimmed = trim($value);

    if ($trimmed === '') {
        return null;
    }

    if (preg_match('/^[a-z0-9_-]{1,50}$/', $trimmed) !== 1) {
        json_error("{$label} is invalid.", 422);
    }

    return $trimmed;
}

function validate_profile_string_list(mixed $value, int $maxItems, int $maxLength, string $label): array
{
    if ($value === null) {
        return [];
    }

    if (!is_array($value)) {
        json_error("{$label} are invalid.", 422);
    }

    $items = [];

    foreach ($value as $item) {
        if (!is_string($item)) {
            json_error("{$label} are invalid.", 422);
        }

        $trimmed = trim($item);

        if ($trimmed === '') {
            continue;
        }

        if (profile_text_length($trimmed) > $maxLength) {
            json_error("{$label} include an item that is too long.", 422);
        }

        $items[] = $trimmed;
    }

    $items = array_values(array_unique($items));

    if (count($items) > $maxItems) {
        json_error("{$label} include too many items.", 422);
    }

    return $items;
}

function validate_profile_links(mixed $value): array
{
    if ($value === null) {
        return [];
    }

    if (!is_array($value)) {
        json_error('Connections are invalid.', 422);
    }

    $items = [];

    foreach ($value as $item) {
        $connection = profile_connection_from_value($item);

        if ($connection !== null) {
            $items[] = $connection;
        }
    }

    if (count($items) > 10) {
        json_error('Profiles can have up to 10 connections.', 422);
    }

    $deduped = [];
    $seen = [];

    foreach ($items as $item) {
        $key = strtolower((string) $item['platform'] . '|' . (string) ($item['url'] ?? $item['value']));

        if (isset($seen[$key])) {
            continue;
        }

        $seen[$key] = true;
        $deduped[] = $item;
    }

    return $deduped;
}

function profile_connection_from_value(mixed $value): ?array
{
    if (is_string($value)) {
        $trimmed = trim($value);

        if ($trimmed === '') {
            return null;
        }

        return profile_website_connection($trimmed);
    }

    if (!is_array($value)) {
        json_error('Connections are invalid.', 422);
    }

    if (!array_is_list($value) && !array_key_exists('platform', $value)) {
        $legacyConnection = profile_connection_from_legacy_map($value);

        if ($legacyConnection !== null) {
            return $legacyConnection;
        }
    }

    $platform = profile_connection_platform($value['platform'] ?? null);
    $rawValue = $value['value'] ?? $value['url'] ?? $value['href'] ?? $value['handle'] ?? $value['username'] ?? null;

    if (!is_string($rawValue)) {
        json_error('Connection value is required.', 422);
    }

    $input = profile_connection_input($rawValue);

    if ($input === '') {
        return null;
    }

    return match ($platform) {
        'website' => profile_website_connection($input),
        'discord' => profile_discord_connection($input),
        'spotify' => profile_spotify_connection($input),
        default => profile_platform_connection($platform, $input),
    };
}

function profile_connection_from_legacy_map(array $value): ?array
{
    $legacyKeys = [
        'website',
        'url',
        'href',
        'youtube',
        'twitch',
        'tiktok',
        'instagram',
        'twitter',
        'x',
        'bluesky',
        'github',
        'discord',
        'spotify',
    ];

    foreach ($legacyKeys as $key) {
        if (!array_key_exists($key, $value) || !is_string($value[$key])) {
            continue;
        }

        $input = profile_connection_input($value[$key]);

        if ($input === '') {
            continue;
        }

        $platform = $key === 'url' || $key === 'href' ? 'website' : profile_connection_platform($key);

        return match ($platform) {
            'website' => profile_website_connection($input),
            'discord' => profile_discord_connection($input),
            'spotify' => profile_spotify_connection($input),
            default => profile_platform_connection($platform, $input),
        };
    }

    return null;
}

function profile_connection_platform(mixed $value): string
{
    if (!is_string($value)) {
        json_error('Choose a supported connection platform.', 422);
    }

    $platform = strtolower(trim($value));

    if ($platform === 'twitter') {
        $platform = 'x';
    }

    $supported = [
        'website',
        'youtube',
        'twitch',
        'tiktok',
        'instagram',
        'x',
        'bluesky',
        'github',
        'discord',
        'spotify',
    ];

    if (!in_array($platform, $supported, true)) {
        json_error('Choose a supported connection platform.', 422);
    }

    return $platform;
}

function profile_connection_input(string $value): string
{
    $trimmed = trim(preg_replace('/\s+/', ' ', $value) ?? $value);

    if (profile_text_length($trimmed) > 300 || profile_contains_html($trimmed)) {
        json_error('Connections must be short text without HTML.', 422);
    }

    return $trimmed;
}

function profile_website_connection(string $value): array
{
    $url = profile_https_url(str_starts_with(strtolower($value), 'http') ? $value : 'https://' . $value, 'Website URL');

    return [
        'platform' => 'website',
        'label' => profile_url_label($url),
        'value' => $url,
        'url' => $url,
    ];
}

function profile_discord_connection(string $value): array
{
    $candidate = str_starts_with(strtolower($value), 'http') ? $value : 'https://' . $value;
    $url = profile_url_parts($candidate);

    if ($url !== null) {
        $host = strtolower((string) ($url['host'] ?? ''));
        $path = (string) ($url['path'] ?? '');

        if (
            in_array($host, ['discord.gg', 'www.discord.gg', 'discord.com', 'www.discord.com'], true)
            && preg_match('#^/(?:invite/)?[a-z0-9-]+/?$#i', $path) === 1
            && (string) ($url['scheme'] ?? '') === 'https'
        ) {
            return [
                'platform' => 'discord',
                'label' => 'Discord',
                'value' => $value,
                'url' => profile_build_url($url),
            ];
        }
    }

    if (preg_match('/^[a-zA-Z0-9_. -]{2,40}$/', $value) !== 1) {
        json_error('Discord connection must be an invite URL or safe display value.', 422);
    }

    return [
        'platform' => 'discord',
        'label' => 'Discord',
        'value' => $value,
        'url' => null,
    ];
}

function profile_spotify_connection(string $value): array
{
    $url = profile_https_url($value, 'Spotify URL');
    $parts = profile_url_parts($url);

    if (($parts['host'] ?? '') !== 'open.spotify.com') {
        json_error('Spotify connection must use open.spotify.com.', 422);
    }

    return [
        'platform' => 'spotify',
        'label' => 'Spotify',
        'value' => $url,
        'url' => $url,
    ];
}

function profile_platform_connection(string $platform, string $value): array
{
    $urlConnection = profile_platform_url_connection($platform, $value);

    if ($urlConnection !== null) {
        return $urlConnection;
    }

    $handle = ltrim($value, '@');

    if (preg_match('/^[a-zA-Z0-9._-]{1,80}$/', $handle) !== 1) {
        json_error('Connection username is invalid.', 422);
    }

    $urls = [
        'youtube' => 'https://www.youtube.com/@' . $handle,
        'twitch' => 'https://www.twitch.tv/' . $handle,
        'tiktok' => 'https://www.tiktok.com/@' . $handle,
        'instagram' => 'https://www.instagram.com/' . $handle,
        'x' => 'https://x.com/' . $handle,
        'bluesky' => 'https://bsky.app/profile/' . $handle,
        'github' => 'https://github.com/' . $handle,
    ];

    return [
        'platform' => $platform,
        'label' => profile_connection_label($platform),
        'value' => $handle,
        'url' => $urls[$platform],
    ];
}

function profile_platform_url_connection(string $platform, string $value): ?array
{
    $parts = profile_url_parts($value);

    if ($parts === null || ($parts['scheme'] ?? '') !== 'https') {
        return null;
    }

    $host = strtolower(preg_replace('/^www\./', '', (string) ($parts['host'] ?? '')) ?? '');
    $allowed = [
        'youtube' => ['youtube.com', 'youtu.be'],
        'twitch' => ['twitch.tv'],
        'tiktok' => ['tiktok.com'],
        'instagram' => ['instagram.com'],
        'x' => ['x.com', 'twitter.com'],
        'bluesky' => ['bsky.app'],
        'github' => ['github.com'],
    ];

    if (!in_array($host, $allowed[$platform] ?? [], true)) {
        return null;
    }

    return [
        'platform' => $platform,
        'label' => profile_connection_label($platform),
        'value' => $value,
        'url' => profile_build_url($parts),
    ];
}

function profile_https_url(string $value, string $label): string
{
    $parts = profile_url_parts($value);

    if ($parts === null || ($parts['scheme'] ?? '') !== 'https') {
        json_error("{$label} must be a valid https URL.", 422);
    }

    return profile_build_url($parts);
}

function profile_url_parts(string $value): ?array
{
    if (profile_contains_html($value) || preg_match('/javascript\s*:/i', $value) === 1) {
        return null;
    }

    if (filter_var($value, FILTER_VALIDATE_URL) === false) {
        return null;
    }

    $parts = parse_url($value);

    if (!is_array($parts) || empty($parts['scheme']) || empty($parts['host'])) {
        return null;
    }

    if (!empty($parts['user']) || !empty($parts['pass'])) {
        return null;
    }

    return $parts;
}

function profile_build_url(array $parts): string
{
    $url = strtolower((string) $parts['scheme']) . '://' . strtolower((string) $parts['host']);
    $url .= $parts['path'] ?? '';

    if (isset($parts['query'])) {
        $url .= '?' . $parts['query'];
    }

    return $url;
}

function profile_url_label(string $url): string
{
    $parts = profile_url_parts($url);
    $host = is_array($parts) ? (string) ($parts['host'] ?? 'Website') : 'Website';

    return preg_replace('/^www\./', '', $host) ?? $host;
}

function profile_connection_label(string $platform): string
{
    return [
        'youtube' => 'YouTube',
        'twitch' => 'Twitch',
        'tiktok' => 'TikTok',
        'instagram' => 'Instagram',
        'x' => 'X / Twitter',
        'bluesky' => 'Bluesky',
        'github' => 'GitHub',
    ][$platform] ?? 'Connection';
}

function profile_contains_html(string $value): bool
{
    return $value !== strip_tags($value)
        || preg_match('/<\s*\/?\s*[a-z][^>]*>/i', $value) === 1
        || preg_match('/javascript\s*:/i', $value) === 1;
}

function profile_text_length(string $value): int
{
    return function_exists('mb_strlen') ? mb_strlen($value) : strlen($value);
}
