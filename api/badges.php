<?php

declare(strict_types=1);

require_once __DIR__ . '/auth.php';
require_once __DIR__ . '/notifications.php';
require_once __DIR__ . '/read.php';

const BADGE_RARITIES = ['common', 'rare', 'epic', 'legendary', 'founder'];
const MAX_FEATURED_BADGES = 4;

function badges_dispatch(array $segments, string $method): void
{
    if (($segments[0] ?? null) === 'badges' && count($segments) === 1) {
        if ($method === 'GET' || $method === 'HEAD') {
            badges_index();
        }

        json_error('Method not allowed.', 405);
    }

    if (($segments[0] ?? null) === 'profiles' && count($segments) === 3 && $segments[2] === 'badges') {
        if ($method === 'GET' || $method === 'HEAD') {
            profile_badges_index($segments[1]);
        }

        json_error('Method not allowed.', 405);
    }

    if (($segments[0] ?? null) === 'me' && count($segments) === 3 && $segments[1] === 'badges' && $segments[2] === 'featured') {
        if ($method === 'PATCH') {
            me_badges_featured_update();
        }

        json_error('Method not allowed.', 405);
    }

    if (($segments[0] ?? null) === 'admin' && count($segments) === 2 && $segments[1] === 'badges') {
        if ($method === 'GET' || $method === 'HEAD') {
            admin_badges_index();
        }

        json_error('Method not allowed.', 405);
    }

    if (($segments[0] ?? null) === 'admin' && count($segments) === 3 && $segments[1] === 'badges' && $segments[2] === 'grant') {
        if ($method === 'POST') {
            admin_badges_grant();
        }

        json_error('Method not allowed.', 405);
    }

    if (($segments[0] ?? null) === 'admin' && count($segments) === 3 && $segments[1] === 'badges' && $segments[2] === 'revoke') {
        if ($method === 'POST') {
            admin_badges_revoke();
        }

        json_error('Method not allowed.', 405);
    }

    json_error('Not found.', 404);
}

function badges_index(): void
{
    require_badges_storage();

    $statement = db_query(
        badge_definition_select_sql() . '
         WHERE b.is_active = 1
         ORDER BY ' . badge_rarity_sort_sql('b') . ', b.name ASC'
    );

    json_success(array_map('badge_payload', $statement->fetchAll()));
}

function profile_badges_index(string $handle): void
{
    require_badges_storage();

    $profile = fetch_profile_by_handle(normalize_handle($handle));

    $viewerUserId = current_request_user_id();

    if ($profile === null || !profile_public_account_available($profile, $viewerUserId)) {
        json_error('Profile not found.', 404);
    }

    if (!profile_viewer_can_view_row($profile, $viewerUserId)) {
        json_success([
            'badges' => [],
            'featuredBadges' => [],
        ]);
    }

    json_success(badges_for_user((int) $profile['user_id']));
}

function me_badges_featured_update(): void
{
    $session = require_authenticated_session();
    require_csrf_token($session);
    require_badges_storage();

    $body = request_json_body();
    $featuredIds = badge_ids_from_body($body, 'featuredBadgeIds', 'featuredBadgeKeys', true, MAX_FEATURED_BADGES);
    $visibleIds = badge_ids_from_body($body, 'visibleBadgeIds', 'visibleBadgeKeys', false, 50);
    $hiddenIds = badge_ids_from_body($body, 'hiddenBadgeIds', 'hiddenBadgeKeys', false, 50);
    $userId = (int) $session['user_id'];
    $ownedIds = user_owned_badge_ids($userId);

    foreach (array_merge($featuredIds, $visibleIds, $hiddenIds) as $badgeId) {
        if (!isset($ownedIds[$badgeId])) {
            json_error('Badge is not available on this profile.', 422);
        }
    }

    $pdo = db();
    $pdo->beginTransaction();

    try {
        if ($hiddenIds !== []) {
            update_user_badge_visibility($userId, $hiddenIds, false);
        }

        if ($visibleIds !== []) {
            update_user_badge_visibility($userId, $visibleIds, true);
        }

        db_query(
            'UPDATE user_badges
             SET featured_order = NULL
             WHERE user_id = :user_id',
            ['user_id' => $userId]
        );

        foreach ($featuredIds as $index => $badgeId) {
            db_query(
                'UPDATE user_badges
                 SET featured_order = :featured_order,
                     is_visible = 1
                 WHERE user_id = :user_id
                   AND badge_id = :badge_id',
                [
                    'featured_order' => $index + 1,
                    'user_id' => $userId,
                    'badge_id' => $badgeId,
                ]
            );
        }

        $pdo->commit();
    } catch (Throwable $exception) {
        $pdo->rollBack();
        throw $exception;
    }

    json_success(badges_for_user($userId, true));
}

function admin_badges_index(): void
{
    require_badge_moderator_session();
    require_badges_storage();

    $badges = db_query(
        badge_definition_select_sql() . '
         ORDER BY b.is_active DESC, ' . badge_rarity_sort_sql('b') . ', b.name ASC'
    )->fetchAll();

    $grants = db_query(
        user_badge_select_sql() . '
         ORDER BY ub.earned_at DESC, ub.id DESC
         LIMIT 50'
    )->fetchAll();

    json_success([
        'badges' => array_map('badge_payload', $badges),
        'recentGrants' => array_map('user_badge_payload', $grants),
    ]);
}

function admin_badges_grant(): void
{
    $session = require_badge_moderator_session();
    require_csrf_token($session);
    require_badges_storage();

    $body = request_json_body();
    $target = badge_user_from_body($body);
    $badge = badge_definition_from_body($body);
    $reason = badge_optional_text($body['reason'] ?? null, 255, 'Reason');
    $existing = user_badge_record((int) $target['user_id'], (int) $badge['badge_id']);
    $pdo = db();
    $pdo->beginTransaction();

    try {
        if ($existing === null) {
            db_query(
                'INSERT INTO user_badges (user_id, badge_id, granted_by, reason)
                 VALUES (:user_id, :badge_id, :granted_by, :reason)',
                [
                    'user_id' => (int) $target['user_id'],
                    'badge_id' => (int) $badge['badge_id'],
                    'granted_by' => (int) $session['user_id'],
                    'reason' => $reason,
                ]
            );
        } else {
            db_query(
                'UPDATE user_badges
                 SET granted_by = :granted_by,
                     reason = :reason,
                     is_visible = 1
                 WHERE id = :id',
                [
                    'granted_by' => (int) $session['user_id'],
                    'reason' => $reason,
                    'id' => (int) $existing['id'],
                ]
            );
        }

        $pdo->commit();
    } catch (Throwable $exception) {
        $pdo->rollBack();
        throw $exception;
    }

    if ($existing === null) {
        notification_create(
            (int) $target['user_id'],
            (int) $session['user_id'],
            'badge_granted',
            null,
            null,
            [
                'badgeKey' => (string) $badge['badge_key'],
                'badgeName' => (string) $badge['badge_name'],
                'profileHandle' => (string) $target['handle'],
            ],
            false
        );
    }

    json_success(user_badge_record((int) $target['user_id'], (int) $badge['badge_id']), $existing === null ? 201 : 200);
}

function admin_badges_revoke(): void
{
    $session = require_badge_moderator_session();
    require_csrf_token($session);
    require_badges_storage();

    $body = request_json_body();
    $target = badge_user_from_body($body);
    $badge = badge_definition_from_body($body, false);
    $record = user_badge_record((int) $target['user_id'], (int) $badge['badge_id']);

    if ($record === null) {
        json_error('Badge grant not found.', 404);
    }

    db_query(
        'DELETE FROM user_badges
         WHERE user_id = :user_id
           AND badge_id = :badge_id',
        [
            'user_id' => (int) $target['user_id'],
            'badge_id' => (int) $badge['badge_id'],
        ]
    );

    json_success([
        'revoked' => true,
        'handle' => (string) $target['handle'],
        'badge' => badge_payload($badge),
        'revokedBy' => (int) $session['user_id'],
    ]);
}

function badges_for_user(int $userId, bool $includeHidden = false): array
{
    $where = $includeHidden ? '' : ' WHERE ub.is_visible = 1 AND b.is_active = 1';

    $statement = db_query(
        user_badge_select_sql() . $where . ($where === '' ? ' WHERE' : ' AND') . ' ub.user_id = :user_id
         ORDER BY
           CASE WHEN ub.featured_order IS NULL THEN 1 ELSE 0 END,
           ub.featured_order ASC,
           ub.earned_at DESC,
           ub.id DESC',
        ['user_id' => $userId]
    );
    $badges = array_map('user_badge_payload', $statement->fetchAll());
    $featured = array_values(array_filter(
        $badges,
        static fn (array $badge): bool => ($badge['featuredOrder'] ?? null) !== null && (bool) $badge['isVisible']
    ));

    if ($featured === []) {
        $featured = array_slice(
            array_values(array_filter($badges, static fn (array $badge): bool => (bool) $badge['isVisible'])),
            0,
            MAX_FEATURED_BADGES
        );
    }

    return [
        'badges' => $badges,
        'featuredBadges' => array_slice($featured, 0, MAX_FEATURED_BADGES),
    ];
}

function badge_definition_select_sql(): string
{
    return 'SELECT
        b.id AS badge_id,
        b.badge_key AS badge_key,
        b.name AS badge_name,
        b.description AS badge_description,
        b.rarity AS badge_rarity,
        b.source AS badge_source,
        b.icon AS badge_icon,
        b.accent AS badge_accent,
        b.is_active AS badge_is_active,
        b.created_at AS badge_created_at
      FROM badges b';
}

function user_badge_select_sql(): string
{
    return 'SELECT
        ub.id AS user_badge_id,
        ub.user_id AS user_badge_user_id,
        ub.badge_id AS user_badge_badge_id,
        ub.reason AS user_badge_reason,
        ub.earned_at AS user_badge_earned_at,
        ub.featured_order AS user_badge_featured_order,
        ub.is_visible AS user_badge_is_visible,
        b.id AS badge_id,
        b.badge_key AS badge_key,
        b.name AS badge_name,
        b.description AS badge_description,
        b.rarity AS badge_rarity,
        b.source AS badge_source,
        b.icon AS badge_icon,
        b.accent AS badge_accent,
        b.is_active AS badge_is_active,
        b.created_at AS badge_created_at,
        target_user.id AS user_id,
        target_user.handle AS handle,
        target_profile.display_name AS display_name,
        target_profile.avatar_url AS avatar_url,
        grantor.id AS grantor_user_id,
        grantor.handle AS grantor_handle,
        grantor_profile.display_name AS grantor_display_name,
        grantor_profile.avatar_url AS grantor_avatar_url
      FROM user_badges ub
      INNER JOIN badges b ON b.id = ub.badge_id
      INNER JOIN users target_user ON target_user.id = ub.user_id
      INNER JOIN profiles target_profile ON target_profile.user_id = target_user.id
      LEFT JOIN users grantor ON grantor.id = ub.granted_by
      LEFT JOIN profiles grantor_profile ON grantor_profile.user_id = grantor.id';
}

function badge_rarity_sort_sql(string $alias): string
{
    return "CASE {$alias}.rarity
      WHEN 'founder' THEN 1
      WHEN 'legendary' THEN 2
      WHEN 'epic' THEN 3
      WHEN 'rare' THEN 4
      WHEN 'common' THEN 5
      ELSE 6
    END";
}

function badge_payload(array $row): array
{
    return [
        'id' => (int) $row['badge_id'],
        'badgeKey' => (string) $row['badge_key'],
        'name' => (string) $row['badge_name'],
        'description' => $row['badge_description'] ?? null,
        'rarity' => badge_rarity((string) $row['badge_rarity']),
        'source' => (string) $row['badge_source'],
        'icon' => $row['badge_icon'] ?? null,
        'accent' => $row['badge_accent'] ?? null,
        'isActive' => (bool) $row['badge_is_active'],
        'createdAt' => $row['badge_created_at'] ?? null,
    ];
}

function user_badge_payload(array $row): array
{
    $grantedBy = null;

    if (($row['grantor_user_id'] ?? null) !== null) {
        $grantedBy = user_payload([
            'user_id' => $row['grantor_user_id'],
            'handle' => $row['grantor_handle'],
            'display_name' => $row['grantor_display_name'] ?? $row['grantor_handle'],
            'avatar_url' => $row['grantor_avatar_url'] ?? null,
        ]);
    }

    $payload = [
        'id' => (int) $row['user_badge_id'],
        'badge' => badge_payload($row),
        'reason' => $row['user_badge_reason'] ?? null,
        'earnedAt' => $row['user_badge_earned_at'],
        'featuredOrder' => $row['user_badge_featured_order'] === null ? null : (int) $row['user_badge_featured_order'],
        'isVisible' => (bool) $row['user_badge_is_visible'],
        'grantedBy' => $grantedBy,
    ];

    if (($row['user_id'] ?? null) !== null) {
        $payload['user'] = user_payload($row);
    }

    return $payload;
}

function badge_rarity(string $value): string
{
    return in_array($value, BADGE_RARITIES, true) ? $value : 'common';
}

function require_badge_moderator_session(): array
{
    $session = require_authenticated_session();

    if (!in_array((string) $session['role'], ['moderator', 'admin'], true)) {
        json_error('Moderator access is required.', 403);
    }

    return $session;
}

function require_badges_storage(): void
{
    if (!badges_storage_exists()) {
        json_error('Badge storage is not ready. Run pending migrations.', 503);
    }
}

function badges_storage_exists(): bool
{
    return database_table_exists('badges') && database_table_exists('user_badges');
}

function badge_ids_from_body(array $body, string $idKey, string $badgeKeyKey, bool $required, int $max): array
{
    $ids = [];

    if (array_key_exists($idKey, $body)) {
        if (!is_array($body[$idKey])) {
            json_error('Badge ids must be an array.', 422);
        }

        if (count($body[$idKey]) > $max) {
            json_error('Too many badges were selected.', 422);
        }

        foreach ($body[$idKey] as $value) {
            $ids[] = badge_id_value($value);
        }
    }

    if (array_key_exists($badgeKeyKey, $body)) {
        if (!is_array($body[$badgeKeyKey])) {
            json_error('Badge keys must be an array.', 422);
        }

        if (count($body[$badgeKeyKey]) > $max) {
            json_error('Too many badges were selected.', 422);
        }

        foreach (badge_ids_for_keys($body[$badgeKeyKey]) as $id) {
            $ids[] = $id;
        }
    }

    if ($required && !array_key_exists($idKey, $body) && !array_key_exists($badgeKeyKey, $body)) {
        json_error('Featured badges are required.', 422);
    }

    $ids = array_values(array_unique($ids));

    if (count($ids) > $max) {
        json_error('Too many badges were selected.', 422);
    }

    return $ids;
}

function badge_id_value(mixed $value): int
{
    if (!is_int($value) && !(is_string($value) && preg_match('/^\d+$/', $value) === 1)) {
        json_error('Badge id must be numeric.', 422);
    }

    $id = (int) $value;

    if ($id < 1) {
        json_error('Badge id must be numeric.', 422);
    }

    return $id;
}

function badge_ids_for_keys(array $keys): array
{
    $normalized = [];

    foreach ($keys as $value) {
        if (!is_string($value)) {
            json_error('Badge keys are invalid.', 422);
        }

        $key = badge_key_value($value);
        $normalized[$key] = true;
    }

    if ($normalized === []) {
        return [];
    }

    $params = [];
    $placeholders = [];

    foreach (array_keys($normalized) as $index => $key) {
        $param = 'badge_key_' . $index;
        $params[$param] = $key;
        $placeholders[] = ':' . $param;
    }

    $statement = db_query(
        sprintf(
            'SELECT id, badge_key
             FROM badges
             WHERE badge_key IN (%s)',
            implode(', ', $placeholders)
        ),
        $params
    );

    $ids = [];

    foreach ($statement->fetchAll() as $row) {
        unset($normalized[(string) $row['badge_key']]);
        $ids[] = (int) $row['id'];
    }

    if ($normalized !== []) {
        json_error('Badge not found.', 404);
    }

    return $ids;
}

function badge_key_value(string $value): string
{
    $key = strtolower(trim($value));

    if (preg_match('/^[a-z0-9_]{1,80}$/', $key) !== 1) {
        json_error('Badge key is invalid.', 422);
    }

    return $key;
}

function user_owned_badge_ids(int $userId): array
{
    $statement = db_query(
        'SELECT badge_id
         FROM user_badges
         WHERE user_id = :user_id',
        ['user_id' => $userId]
    );
    $ids = [];

    foreach ($statement->fetchAll() as $row) {
        $ids[(int) $row['badge_id']] = true;
    }

    return $ids;
}

function update_user_badge_visibility(int $userId, array $badgeIds, bool $visible): void
{
    if ($badgeIds === []) {
        return;
    }

    $params = [
        'user_id' => $userId,
        'is_visible' => $visible ? 1 : 0,
    ];
    $placeholders = [];

    foreach ($badgeIds as $index => $badgeId) {
        $param = 'badge_id_' . $index;
        $params[$param] = $badgeId;
        $placeholders[] = ':' . $param;
    }

    db_query(
        sprintf(
            'UPDATE user_badges
             SET is_visible = :is_visible,
                 featured_order = ' . ($visible ? 'featured_order' : 'NULL') . '
             WHERE user_id = :user_id
               AND badge_id IN (%s)',
            implode(', ', $placeholders)
        ),
        $params
    );
}

function badge_user_from_body(array $body): array
{
    $handle = $body['handle'] ?? $body['targetHandle'] ?? $body['userHandle'] ?? null;

    if (!is_string($handle)) {
        json_error('Handle is required.', 422);
    }

    $statement = db_query(
        "SELECT
            u.id AS user_id,
            u.handle,
            p.display_name,
            p.avatar_url
         FROM users u
         INNER JOIN profiles p ON p.user_id = u.id
         WHERE u.handle = :handle
         LIMIT 1",
        ['handle' => normalize_handle($handle)]
    );
    $user = $statement->fetch();

    if (!is_array($user)) {
        json_error('User not found.', 404);
    }

    return $user;
}

function badge_definition_from_body(array $body, bool $activeOnly = true): array
{
    if (array_key_exists('badgeId', $body) || array_key_exists('badge_id', $body)) {
        $where = 'b.id = :badge_id';
        $params = ['badge_id' => badge_id_value($body['badgeId'] ?? $body['badge_id'])];
    } else {
        $value = $body['badgeKey'] ?? $body['badge_key'] ?? null;

        if (!is_string($value)) {
            json_error('Badge is required.', 422);
        }

        $where = 'b.badge_key = :badge_key';
        $params = ['badge_key' => badge_key_value($value)];
    }

    if ($activeOnly) {
        $where .= ' AND b.is_active = 1';
    }

    $statement = db_query(
        badge_definition_select_sql() . ' WHERE ' . $where . ' LIMIT 1',
        $params
    );
    $badge = $statement->fetch();

    if (!is_array($badge)) {
        json_error('Badge not found.', 404);
    }

    return $badge;
}

function badge_optional_text(mixed $value, int $maxLength, string $label): ?string
{
    if ($value === null || $value === '') {
        return null;
    }

    if (!is_string($value)) {
        json_error($label . ' must be text.', 422);
    }

    $text = trim($value);

    if ($text === '') {
        return null;
    }

    if (text_length($text) > $maxLength) {
        json_error($label . ' is too long.', 422);
    }

    return $text;
}

function user_badge_record(int $userId, int $badgeId): ?array
{
    $statement = db_query(
        user_badge_select_sql() . '
         WHERE ub.user_id = :user_id
           AND ub.badge_id = :badge_id
         LIMIT 1',
        [
            'user_id' => $userId,
            'badge_id' => $badgeId,
        ]
    );
    $row = $statement->fetch();

    return is_array($row) ? user_badge_payload($row) : null;
}
