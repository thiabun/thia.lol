<?php

declare(strict_types=1);

require_once __DIR__ . '/auth.php';
require_once __DIR__ . '/integrations.php';
require_once __DIR__ . '/read.php';

const ONBOARDING_STEPS = [
    'profile_basics',
    'spotify',
    'youtube',
    'twitch',
    'github',
    'apple_music',
    'profile_canvas',
    'desktop_notifications',
];

function onboarding_dispatch(array $segments, string $method): void
{
    if (
        ($segments[0] ?? null) === 'me'
        && ($segments[1] ?? null) === 'onboarding'
        && count($segments) === 2
    ) {
        if ($method === 'GET' || $method === 'HEAD') {
            onboarding_get();
        }

        if ($method === 'PATCH') {
            onboarding_update();
        }

        json_error('Method not allowed.', 405);
    }

    json_error('Not found.', 404);
}

function onboarding_get(): void
{
    $session = require_authenticated_session();
    require_onboarding_storage();

    $userId = (int) $session['user_id'];
    onboarding_ensure_user_state($userId);

    json_success(onboarding_state_for_user($userId));
}

function onboarding_update(): void
{
    $session = require_authenticated_session();
    require_csrf_token($session);
    require_onboarding_storage();

    $body = request_json_body();
    onboarding_require_object($body, 'JSON body');
    onboarding_reject_unknown_keys($body, ['action', 'step', 'provider', 'url']);

    $userId = (int) $session['user_id'];
    onboarding_ensure_user_state($userId);
    $state = onboarding_state_for_user($userId);
    $action = onboarding_action($body['action'] ?? null);
    $completed = $state['completedSteps'];
    $skipped = $state['skippedSteps'];
    $providerLinks = (array) $state['providerLinks'];
    $finishedAt = $state['finishedAt'];
    $dismissedAt = $state['dismissedAt'];

    if ($action === 'complete_step') {
        $step = onboarding_step($body['step'] ?? null);
        $completed = onboarding_step_list_add($completed, $step);
        $skipped = onboarding_step_list_remove($skipped, $step);
    } elseif ($action === 'skip_step') {
        $step = onboarding_step($body['step'] ?? null);
        $skipped = onboarding_step_list_add($skipped, $step);
        $completed = onboarding_step_list_remove($completed, $step);
    } elseif ($action === 'save_provider_link') {
        $link = onboarding_provider_link($body['provider'] ?? null, $body['url'] ?? null);
        $providerLinks[$link['provider']] = $link;
        $completed = onboarding_step_list_add($completed, $link['provider']);
        $skipped = onboarding_step_list_remove($skipped, $link['provider']);
    } elseif ($action === 'finish') {
        $finishedAt = gmdate('Y-m-d H:i:s');
        $dismissedAt = null;
    } elseif ($action === 'dismiss') {
        $dismissedAt = gmdate('Y-m-d H:i:s');
    } elseif ($action === 'reset') {
        $completed = [];
        $skipped = [];
        $providerLinks = [];
        $finishedAt = null;
        $dismissedAt = null;
    }

    onboarding_save_state($userId, $completed, $skipped, $providerLinks, $finishedAt, $dismissedAt);

    json_success(onboarding_state_for_user($userId));
}

function require_onboarding_storage(): void
{
    if (!database_table_exists('user_onboarding_state')) {
        json_error('Onboarding storage is not ready. Run pending migrations.', 503);
    }
}

function onboarding_ensure_user_state(int $userId): void
{
    db_query(
        'INSERT IGNORE INTO user_onboarding_state
            (user_id, completed_steps_json, skipped_steps_json, provider_links_json)
         VALUES
            (:user_id, JSON_ARRAY(), JSON_ARRAY(), JSON_OBJECT())',
        ['user_id' => $userId]
    );
}

function onboarding_state_for_user(int $userId): array
{
    $statement = db_query(
        'SELECT completed_steps_json, skipped_steps_json, provider_links_json,
                finished_at, dismissed_at, created_at, updated_at
         FROM user_onboarding_state
         WHERE user_id = :user_id
         LIMIT 1',
        ['user_id' => $userId]
    );
    $row = $statement->fetch();

    if (!is_array($row)) {
        onboarding_ensure_user_state($userId);
        return onboarding_state_for_user($userId);
    }

    $completed = onboarding_step_list($row['completed_steps_json'] ?? null);
    $skipped = onboarding_step_list($row['skipped_steps_json'] ?? null);
    $providerLinks = onboarding_provider_links($row['provider_links_json'] ?? null);

    return [
        'steps' => ONBOARDING_STEPS,
        'completedSteps' => $completed,
        'skippedSteps' => $skipped,
        'providerLinks' => (object) $providerLinks,
        'finishedAt' => $row['finished_at'] ?? null,
        'dismissedAt' => $row['dismissed_at'] ?? null,
        'createdAt' => $row['created_at'] ?? null,
        'updatedAt' => $row['updated_at'] ?? null,
    ];
}

function onboarding_save_state(
    int $userId,
    array $completed,
    array $skipped,
    array $providerLinks,
    ?string $finishedAt,
    ?string $dismissedAt
): void {
    db_query(
        'UPDATE user_onboarding_state
         SET completed_steps_json = :completed_steps_json,
             skipped_steps_json = :skipped_steps_json,
             provider_links_json = :provider_links_json,
             finished_at = :finished_at,
             dismissed_at = :dismissed_at,
             updated_at = CURRENT_TIMESTAMP()
         WHERE user_id = :user_id',
        [
            'user_id' => $userId,
            'completed_steps_json' => json_encode(onboarding_step_list_normalized($completed), JSON_THROW_ON_ERROR),
            'skipped_steps_json' => json_encode(onboarding_step_list_normalized($skipped), JSON_THROW_ON_ERROR),
            'provider_links_json' => json_encode((object) $providerLinks, JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
            'finished_at' => $finishedAt,
            'dismissed_at' => $dismissedAt,
        ]
    );
}

function onboarding_action(mixed $value): string
{
    if (!is_string($value)) {
        json_error('Choose an onboarding action.', 422);
    }

    $action = trim($value);
    $allowed = ['complete_step', 'skip_step', 'save_provider_link', 'finish', 'dismiss', 'reset'];

    if (!in_array($action, $allowed, true)) {
        json_error('Choose an onboarding action.', 422);
    }

    return $action;
}

function onboarding_step(mixed $value): string
{
    if (!is_string($value)) {
        json_error('Choose an onboarding step.', 422);
    }

    $step = trim($value);

    if (!in_array($step, ONBOARDING_STEPS, true)) {
        json_error('Choose an onboarding step.', 422);
    }

    return $step;
}

function onboarding_provider_link(mixed $providerValue, mixed $urlValue): array
{
    if (!is_string($providerValue)) {
        json_error('Choose a supported integration provider.', 422);
    }

    $provider = profile_integration_provider($providerValue);
    $url = profile_integration_url($urlValue);
    $normalized = profile_integration_normalize_url($url, $provider);

    if ($normalized === null || $normalized['provider'] !== $provider) {
        json_error('Choose a supported integration URL.', 422);
    }

    return [
        'provider' => $provider,
        'url' => $normalized['sourceUrl'],
        'resourceType' => $normalized['resourceType'],
        'resourceId' => $normalized['resourceId'],
        'savedAt' => gmdate('c'),
    ];
}

function onboarding_step_list(mixed $value): array
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

    return onboarding_step_list_normalized($decoded);
}

function onboarding_step_list_normalized(array $steps): array
{
    $allowed = array_flip(ONBOARDING_STEPS);
    $seen = [];
    $normalized = [];

    foreach ($steps as $step) {
        if (!is_string($step) || !array_key_exists($step, $allowed) || isset($seen[$step])) {
            continue;
        }

        $seen[$step] = true;
        $normalized[] = $step;
    }

    usort(
        $normalized,
        static fn (string $first, string $second): int => $allowed[$first] <=> $allowed[$second]
    );

    return $normalized;
}

function onboarding_step_list_add(array $steps, string $step): array
{
    return onboarding_step_list_normalized([...$steps, $step]);
}

function onboarding_step_list_remove(array $steps, string $step): array
{
    return onboarding_step_list_normalized(
        array_values(array_filter($steps, static fn (string $item): bool => $item !== $step))
    );
}

function onboarding_provider_links(mixed $value): array
{
    if (!is_string($value) || trim($value) === '') {
        return [];
    }

    try {
        $decoded = json_decode($value, true, 512, JSON_THROW_ON_ERROR);
    } catch (JsonException) {
        return [];
    }

    if (!is_array($decoded) || array_is_list($decoded)) {
        return [];
    }

    $links = [];

    foreach ($decoded as $provider => $link) {
        if (!is_string($provider) || !in_array($provider, PROFILE_INTEGRATION_PROVIDERS, true) || !is_array($link)) {
            continue;
        }

        $url = $link['url'] ?? null;

        if (
            !is_string($url)
            || strlen($url) > 500
            || filter_var($url, FILTER_VALIDATE_URL) === false
            || strtolower((string) parse_url($url, PHP_URL_SCHEME)) !== 'https'
        ) {
            continue;
        }

        $normalized = profile_integration_normalize_url($url, $provider);

        if ($normalized === null || $normalized['provider'] !== $provider) {
            continue;
        }

        $links[$provider] = [
            'provider' => $provider,
            'url' => $normalized['sourceUrl'],
            'resourceType' => $normalized['resourceType'],
            'resourceId' => $normalized['resourceId'],
            'savedAt' => is_string($link['savedAt'] ?? null) ? (string) $link['savedAt'] : null,
        ];
    }

    return $links;
}

function onboarding_require_object(array $value, string $label): void
{
    if (array_is_list($value)) {
        json_error("{$label} must be an object.", 400);
    }
}

function onboarding_reject_unknown_keys(array $value, array $allowedKeys): void
{
    $allowed = array_flip($allowedKeys);

    foreach (array_keys($value) as $key) {
        if (!array_key_exists($key, $allowed)) {
            json_error('Unsupported onboarding field was provided.', 422);
        }
    }
}
