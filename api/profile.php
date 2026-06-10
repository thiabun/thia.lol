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

function me_profile_update(): void
{
    $session = require_authenticated_session();
    require_csrf_token($session);

    $body = request_json_body();
    $updates = [];
    $params = ['user_id' => (int) $session['user_id']];
    $hasCustomizationColumns = profile_customization_columns_exist();

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
        $params['links'] = json_encode(validate_profile_string_list($body['links'], 5, 160, 'Links'), JSON_THROW_ON_ERROR);
    }

    if (array_key_exists('traits', $body)) {
        $updates[] = 'traits = :traits';
        $params['traits'] = json_encode(validate_profile_string_list($body['traits'], 8, 40, 'Traits'), JSON_THROW_ON_ERROR);
    }

    if ($updates === []) {
        json_error('No supported profile updates were provided.', 422);
    }

    db_query(
        sprintf(
            'UPDATE profiles SET %s, updated_at = CURRENT_TIMESTAMP() WHERE user_id = :user_id',
            implode(', ', $updates)
        ),
        $params
    );

    $profile = fetch_profile_by_handle((string) $session['handle']);

    if ($profile === null) {
        json_error('Profile not found.', 404);
    }

    json_success(profile_payload(
        $profile,
        null,
        profile_social_context((int) $profile['user_id'], (int) $session['user_id'])
    ));
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

function profile_text_length(string $value): int
{
    return function_exists('mb_strlen') ? mb_strlen($value) : strlen($value);
}
