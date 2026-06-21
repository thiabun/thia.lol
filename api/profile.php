<?php

declare(strict_types=1);

require_once __DIR__ . '/auth.php';
require_once __DIR__ . '/read.php';
require_once __DIR__ . '/text_entities.php';

const PROFILE_LAYOUT_PRESETS = ['balanced', 'compact', 'showcase'];
const PROFILE_THEME_PRESETS = ['sunveil', 'frostveil', 'roseveil', 'leafveil', 'violet', 'ember', 'ocean'];

function me_dispatch(array $segments, string $method): void
{
    if (($segments[0] ?? null) !== 'me' || ($segments[1] ?? null) !== 'profile') {
        json_error('Not found.', 404);
    }

    if (count($segments) === 3 && $segments[2] === 'featured') {
        if ($method === 'PATCH') {
            me_profile_featured_update();
        }

        json_error('Method not allowed.', 405);
    }

    if (count($segments) !== 2) {
        json_error('Not found.', 404);
    }

    if ($method !== 'PATCH') {
        json_error('Method not allowed.', 405);
    }

    me_profile_update();
}

function me_profile_update(): void
{
    $session = require_authenticated_session();
    require_csrf_token($session);

    $body = request_json_body();
    $payload = profile_update_for_user((int) $session['user_id'], (string) $session['handle'], $body);

    json_success($payload);
}

function me_profile_featured_update(): void
{
    $session = require_authenticated_session();
    require_csrf_token($session);

    $body = request_json_body();
    $payload = profile_featured_update_for_user((int) $session['user_id'], (string) $session['handle'], $body);

    json_success($payload);
}

function profile_update_for_user(int $userId, string $handle, array $body): array
{
    $statement = profile_update_statement_for_body($body, $userId);

    try {
        db_query($statement['sql'], $statement['params']);
    } catch (PDOException $exception) {
        if (profile_update_failed_on_missing_customization_column($exception)) {
            json_error('Profile customization migration has not been applied.', 409, $exception);
        }

        if (profile_update_failed_on_invalid_json($exception)) {
            json_error('Profile data could not be saved. Check profile links and try again.', 422, $exception);
        }

        throw $exception;
    }

    if (array_key_exists('bio', $statement['params'])) {
        $bio = $statement['params']['bio'];

        if (is_string($bio) && $bio !== '') {
            text_entities_store_for_content('profile', $userId, 'bio', $bio, $userId, [
                'notifyMentions' => true,
                'targetUrl' => '/@' . rawurlencode($handle),
            ]);
        } else {
            text_entities_delete_for_content('profile', $userId, 'bio');
        }
    }

    $profile = fetch_profile_by_handle($handle);

    if ($profile === null) {
        json_error('Profile not found.', 404);
    }

    return profile_payload_with_featured(
        $profile,
        null,
        profile_social_context((int) $profile['user_id'], $userId),
        $userId
    );
}

function profile_featured_update_for_user(int $userId, string $handle, array $body): array
{
    require_profile_featured_storage();

    $statement = profile_featured_update_statement_for_body($body, $userId);
    db_query($statement['sql'], $statement['params']);

    $profile = fetch_profile_by_handle($handle);

    if ($profile === null) {
        json_error('Profile not found.', 404);
    }

    return profile_payload_with_featured(
        $profile,
        null,
        profile_social_context((int) $profile['user_id'], $userId),
        $userId
    );
}

function profile_featured_update_statement_for_body(array $body, int $userId): array
{
    if (array_is_list($body)) {
        json_error('JSON body must be an object.', 400);
    }

    profile_featured_reject_unknown_keys($body, [
        'featuredPostId',
        'featured_post_id',
        'featuredRoomId',
        'featured_room_id',
    ]);

    $updates = [];
    $params = ['user_id' => $userId];

    if (array_key_exists('featuredPostId', $body) || array_key_exists('featured_post_id', $body)) {
        $updates[] = 'featured_post_id = :featured_post_id';
        $params['featured_post_id'] = profile_featured_post_id_for_user(
            profile_body_value($body, 'featuredPostId', 'featured_post_id'),
            $userId
        );
    }

    if (array_key_exists('featuredRoomId', $body) || array_key_exists('featured_room_id', $body)) {
        $updates[] = 'featured_room_id = :featured_room_id';
        $params['featured_room_id'] = profile_featured_room_id_for_user(
            profile_body_value($body, 'featuredRoomId', 'featured_room_id'),
            $userId
        );
    }

    if ($updates === []) {
        json_error('No featured content updates were provided.', 422);
    }

    return [
        'sql' => sprintf(
            'UPDATE profiles SET %s, updated_at = CURRENT_TIMESTAMP() WHERE user_id = :user_id',
            implode(', ', $updates)
        ),
        'params' => $params,
        'updates' => $updates,
    ];
}

function profile_update_statement_for_body(
    array $body,
    int $userId,
    ?bool $hasCustomizationColumns = null,
    ?bool $hasLayoutPresetColumn = null,
    ?bool $hasThemeConfigColumn = null
): array
{
    if (array_is_list($body)) {
        json_error('JSON body must be an object.', 400);
    }

    $updates = [];
    $params = ['user_id' => $userId];
    $hasCustomizationColumns = $hasCustomizationColumns ?? profile_customization_columns_exist();
    $hasLayoutPresetColumn = $hasLayoutPresetColumn ?? profile_layout_preset_column_exists();
    $hasThemeConfigColumn = $hasThemeConfigColumn ?? profile_theme_config_column_exists();

    if (array_key_exists('displayName', $body) || array_key_exists('display_name', $body)) {
        $updates[] = 'display_name = :display_name';
        $params['display_name'] = validate_profile_text(
            profile_body_value($body, 'displayName', 'display_name'),
            1,
            120,
            'Display name'
        );
    }

    if (array_key_exists('bio', $body)) {
        $updates[] = 'bio = :bio';
        $params['bio'] = validate_profile_bio($body['bio']);
    }

    if (array_key_exists('location', $body)) {
        $updates[] = 'location = :location';
        $params['location'] = validate_profile_nullable_text($body['location'], 120, 'Location');
    }

    if (array_key_exists('avatarUrl', $body) || array_key_exists('avatar_url', $body)) {
        $updates[] = 'avatar_url = :avatar_url';
        $params['avatar_url'] = validate_profile_image_url(
            profile_body_value($body, 'avatarUrl', 'avatar_url'),
            'Avatar'
        );
    }

    if (array_key_exists('bannerUrl', $body) || array_key_exists('banner_url', $body)) {
        $bannerUrl = validate_profile_image_url(profile_body_value($body, 'bannerUrl', 'banner_url'), 'Banner');
        add_profile_customization_update($updates, $params, $hasCustomizationColumns, 'banner_url', $bannerUrl);
    }

    if (array_key_exists('profileBackground', $body) || array_key_exists('profile_background', $body)) {
        $profileBackground = validate_profile_image_url(
            profile_body_value($body, 'profileBackground', 'profile_background'),
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

    if (array_key_exists('profileBackgroundVideo', $body) || array_key_exists('profile_background_video_url', $body)) {
        $profileBackgroundVideo = validate_profile_video_url(
            profile_body_value($body, 'profileBackgroundVideo', 'profile_background_video_url'),
            'Profile background video'
        );
        add_profile_customization_update(
            $updates,
            $params,
            $hasCustomizationColumns && profile_update_background_video_columns_exist(),
            'profile_background_video_url',
            $profileBackgroundVideo
        );
    }

    if (array_key_exists('profileBackgroundVideoPoster', $body) || array_key_exists('profile_background_video_poster_url', $body)) {
        $profileBackgroundVideoPoster = validate_profile_image_url(
            profile_body_value($body, 'profileBackgroundVideoPoster', 'profile_background_video_poster_url'),
            'Profile background video poster'
        );
        add_profile_customization_update(
            $updates,
            $params,
            $hasCustomizationColumns && profile_update_background_video_columns_exist(),
            'profile_background_video_poster_url',
            $profileBackgroundVideoPoster
        );
    }

    if (array_key_exists('profileAccent', $body) || array_key_exists('profile_accent', $body)) {
        $profileAccent = validate_profile_token(
            profile_body_value($body, 'profileAccent', 'profile_accent'),
            'Accent'
        );
        add_profile_customization_update($updates, $params, $hasCustomizationColumns, 'profile_accent', $profileAccent);
    }

    if (array_key_exists('profileTheme', $body) || array_key_exists('profile_theme', $body)) {
        $profileTheme = validate_profile_token(
            profile_body_value($body, 'profileTheme', 'profile_theme'),
            'Theme'
        );
        add_profile_customization_update($updates, $params, $hasCustomizationColumns, 'profile_theme', $profileTheme);
    }

    if (array_key_exists('profileThemeConfig', $body) || array_key_exists('profile_theme_config_json', $body)) {
        $profileThemeConfig = validate_profile_theme_config(
            profile_body_value($body, 'profileThemeConfig', 'profile_theme_config_json')
        );
        add_profile_theme_config_update($updates, $params, $hasThemeConfigColumn, $profileThemeConfig);
    }

    if (array_key_exists('profileLayoutPreset', $body) || array_key_exists('profile_layout_preset', $body)) {
        $profileLayoutPreset = validate_profile_layout_preset(
            profile_body_value($body, 'profileLayoutPreset', 'profile_layout_preset')
        );
        add_profile_layout_preset_update($updates, $params, $hasLayoutPresetColumn, $profileLayoutPreset);
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

    return [
        'sql' => sprintf(
            'UPDATE profiles SET %s, updated_at = CURRENT_TIMESTAMP() WHERE user_id = :user_id',
            implode(', ', $updates)
        ),
        'params' => $params,
        'updates' => $updates,
    ];
}

function require_profile_featured_storage(): void
{
    if (!profile_featured_columns_exist()) {
        json_error('Featured profile content storage is not ready. Run pending migrations.', 503);
    }
}

function profile_featured_post_id_for_user(mixed $value, int $userId): ?int
{
    $postId = profile_featured_nullable_input_id($value, 'Featured post');

    if ($postId === null) {
        return null;
    }

    $post = profile_featured_post_record($postId);

    if ($post === null) {
        json_error('Featured post is not available.', 422);
    }

    if ((int) $post['author_id'] !== $userId) {
        json_error('You can only feature your own posts.', 403);
    }

    $roomDeletedAt = $post['room_deleted_at'] ?? null;

    if (
        (string) $post['visibility'] !== 'public'
        || (string) $post['status'] !== 'published'
        || (string) $post['author_status'] !== 'active'
        || $post['deleted_at'] !== null
        || (
            $post['room_id'] !== null
            && (
                (string) ($post['room_visibility'] ?? '') !== 'public'
                || $roomDeletedAt !== null
            )
        )
        || !profile_featured_public_post_exists($postId, $userId)
    ) {
        json_error('Featured post is not available.', 422);
    }

    return $postId;
}

function profile_featured_room_id_for_user(mixed $value, int $userId): ?int
{
    $roomId = profile_featured_nullable_input_id($value, 'Featured room');

    if ($roomId === null) {
        return null;
    }

    $room = profile_featured_room_record($roomId, $userId);

    if ($room === null) {
        json_error('Featured room is not available.', 422);
    }

    if ((string) $room['visibility'] !== 'public' || ($room['deleted_at'] ?? null) !== null) {
        json_error('Featured room is not available.', 422);
    }

    if (!(bool) ($room['is_eligible'] ?? false)) {
        json_error('You can only feature rooms you own or belong to.', 403);
    }

    return $roomId;
}

function profile_featured_nullable_input_id(mixed $value, string $label): ?int
{
    if ($value === null || $value === '') {
        return null;
    }

    if (is_int($value) && $value > 0) {
        return $value;
    }

    if (is_string($value) && preg_match('/^[0-9]+$/', $value) === 1 && (int) $value > 0) {
        return (int) $value;
    }

    json_error("{$label} is invalid.", 422);
}

function profile_featured_post_record(int $postId): ?array
{
    $roomDeletedSelect = room_soft_delete_column_exists() ? 'rooms.deleted_at AS room_deleted_at,' : 'NULL AS room_deleted_at,';
    $statement = db_query(
        "SELECT
            posts.id,
            posts.author_id,
            posts.room_id,
            posts.parent_id,
            posts.visibility,
            posts.status,
            posts.deleted_at,
            rooms.visibility AS room_visibility,
            {$roomDeletedSelect}
            users.status AS author_status
         FROM posts
         INNER JOIN users ON users.id = posts.author_id
         LEFT JOIN rooms ON rooms.id = posts.room_id
         WHERE posts.id = :post_id
         LIMIT 1",
        ['post_id' => $postId]
    );
    $row = $statement->fetch();

    return is_array($row) ? $row : null;
}

function profile_featured_public_post_exists(int $postId, int $userId): bool
{
    $statement = db_query(
        "SELECT posts.id
         FROM posts
         INNER JOIN users ON users.id = posts.author_id
         LEFT JOIN rooms ON rooms.id = posts.room_id
         " . post_ancestor_visibility_joins_sql('posts') . "
         WHERE posts.id = :post_id
           AND posts.author_id = :user_id
           AND users.status = 'active'
           AND " . public_post_visible_sql('posts', 'rooms') . "
           AND " . post_ancestor_visibility_sql('posts') . "
         LIMIT 1",
        [
            'post_id' => $postId,
            'user_id' => $userId,
        ]
    );

    return (bool) $statement->fetch();
}

function profile_featured_room_record(int $roomId, int $userId): ?array
{
    $roomDeletedSelect = room_soft_delete_column_exists() ? 'rooms.deleted_at AS deleted_at,' : 'NULL AS deleted_at,';
    $statement = db_query(
        "SELECT
            rooms.id,
            rooms.visibility,
            rooms.created_by,
            {$roomDeletedSelect}
            IF(" . profile_featured_room_eligibility_sql($userId, 'rooms') . ", 1, 0) AS is_eligible
         FROM rooms
         WHERE rooms.id = :room_id
         LIMIT 1",
        ['room_id' => $roomId]
    );
    $row = $statement->fetch();

    return is_array($row) ? $row : null;
}

function profile_featured_reject_unknown_keys(array $body, array $allowed): void
{
    foreach (array_keys($body) as $key) {
        if (!in_array($key, $allowed, true)) {
            json_error("Unsupported featured profile field: {$key}.", 422);
        }
    }
}

function profile_body_value(array $body, string $camelKey, string $snakeKey): mixed
{
    if (array_key_exists($camelKey, $body)) {
        return $body[$camelKey];
    }

    return $body[$snakeKey] ?? null;
}

function profile_update_failed_on_missing_customization_column(PDOException $exception): bool
{
    $message = strtolower($exception->getMessage());

    return str_contains($message, 'unknown column')
        && (
            str_contains($message, 'banner_url')
            || str_contains($message, 'profile_accent')
            || str_contains($message, 'profile_background')
            || str_contains($message, 'profile_background_video_url')
            || str_contains($message, 'profile_background_video_poster_url')
            || str_contains($message, 'profile_theme')
            || str_contains($message, 'profile_theme_config_json')
            || str_contains($message, 'profile_layout_preset')
        );
}

function profile_update_failed_on_invalid_json(PDOException $exception): bool
{
    $message = strtolower($exception->getMessage());

    return str_contains($message, 'json')
        && (
            str_contains($message, 'links')
            || str_contains($message, 'traits')
            || str_contains($message, 'profile_theme_config_json')
            || str_contains($message, 'constraint')
            || str_contains($message, 'check')
        );
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

function add_profile_layout_preset_update(
    array &$updates,
    array &$params,
    bool $hasLayoutPresetColumn,
    string $value
): void {
    if (!$hasLayoutPresetColumn) {
        json_error('Profile layout preference migration has not been applied.', 409);
    }

    $updates[] = 'profile_layout_preset = :profile_layout_preset';
    $params['profile_layout_preset'] = $value;
}

function add_profile_theme_config_update(
    array &$updates,
    array &$params,
    bool $hasThemeConfigColumn,
    ?string $value
): void {
    if (!$hasThemeConfigColumn) {
        if ($value !== null) {
            json_error('Profile theme migration has not been applied.', 409);
        }

        return;
    }

    $updates[] = 'profile_theme_config_json = :profile_theme_config_json';
    $params['profile_theme_config_json'] = $value;
}

function validate_profile_layout_preset(mixed $value): string
{
    if ($value === null) {
        return 'balanced';
    }

    if (!is_string($value)) {
        json_error('Choose a supported profile layout.', 422);
    }

    $preset = strtolower(trim($value));

    if ($preset === '') {
        return 'balanced';
    }

    if (!in_array($preset, PROFILE_LAYOUT_PRESETS, true)) {
        json_error('Choose a supported profile layout.', 422);
    }

    return $preset;
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

function validate_profile_bio(mixed $value): ?string
{
    if ($value === null) {
        return null;
    }

    if (!is_string($value)) {
        json_error('Bio is invalid.', 422);
    }

    $normalized = str_replace(["\r\n", "\r"], "\n", $value);
    $trimmed = trim($normalized);

    if ($trimmed === '') {
        return null;
    }

    if (preg_match('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/', $trimmed) === 1) {
        json_error('Bio is invalid.', 422);
    }

    if (profile_text_length($trimmed) > 500) {
        json_error('Bio is too long.', 422);
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

    if (preg_match('#^/uploads/media/[0-9]{4}/[0-9]{2}/[a-z0-9_-]+\.(?:jpe?g|png|webp|gif)$#', $trimmed) === 1) {
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

function validate_profile_video_url(mixed $value, string $label): ?string
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

    if (profile_text_length($trimmed) > 500) {
        json_error("{$label} URL is too long.", 422);
    }

    if (preg_match('#^/uploads/media/[0-9]{4}/[0-9]{2}/profile_background-[a-z0-9_-]+\.(?:mp4|webm)$#', $trimmed) === 1) {
        return $trimmed;
    }

    json_error("{$label} must come from the video upload endpoint.", 422);
}

function profile_update_background_video_columns_exist(): bool
{
    return database_column_exists('profiles', 'profile_background_video_url')
        && database_column_exists('profiles', 'profile_background_video_poster_url');
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

function validate_profile_theme_config(mixed $value): ?string
{
    if ($value === null) {
        return null;
    }

    if (is_string($value)) {
        $trimmed = trim($value);

        if ($trimmed === '') {
            return null;
        }

        try {
            $value = json_decode($trimmed, true, 512, JSON_THROW_ON_ERROR);
        } catch (JsonException) {
            json_error('Profile theme is invalid.', 422);
        }
    }

    if (!is_array($value) || array_is_list($value)) {
        json_error('Profile theme is invalid.', 422);
    }

    profile_theme_reject_unknown_keys($value, ['mode', 'preset', 'colors']);

    $mode = $value['mode'] ?? null;

    if ($mode === 'preset') {
        $preset = $value['preset'] ?? null;

        if (!is_string($preset) || !in_array($preset, PROFILE_THEME_PRESETS, true)) {
            json_error('Choose a supported profile theme preset.', 422);
        }

        $normalized = ['mode' => 'preset', 'preset' => $preset];
    } elseif ($mode === 'custom') {
        $colors = $value['colors'] ?? null;

        if (!is_array($colors) || array_is_list($colors)) {
            json_error('Custom profile theme colors are invalid.', 422);
        }

        profile_theme_reject_unknown_keys($colors, profile_theme_color_keys());

        $normalizedColors = [];
        foreach (profile_theme_color_keys() as $key) {
            $color = $colors[$key] ?? null;

            if (!is_string($color) || preg_match('/^#[0-9a-fA-F]{6}$/', $color) !== 1) {
                json_error('Custom profile theme colors must use #RRGGBB hex values.', 422);
            }

            $normalizedColors[$key] = strtoupper($color);
        }

        $normalized = ['mode' => 'custom', 'colors' => $normalizedColors];
    } else {
        json_error('Choose a supported profile theme mode.', 422);
    }

    $encoded = json_encode($normalized, JSON_THROW_ON_ERROR);

    if (strlen($encoded) > 2048) {
        json_error('Profile theme is too large.', 422);
    }

    return $encoded;
}

function profile_theme_reject_unknown_keys(array $body, array $allowed): void
{
    foreach (array_keys($body) as $key) {
        if (!is_string($key) || !in_array($key, $allowed, true)) {
            json_error('Unsupported profile theme field was provided.', 422);
        }
    }
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
    if (!str_starts_with(strtolower($value), 'https://')) {
        json_error('Website URL must be a valid https URL.', 422);
    }

    $url = profile_https_url($value, 'Website URL');

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
