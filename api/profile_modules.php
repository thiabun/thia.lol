<?php

declare(strict_types=1);

require_once __DIR__ . '/auth.php';
require_once __DIR__ . '/read.php';

const PROFILE_ACTIVITY_MODULE_TYPE = 'activity';
const PROFILE_FEATURED_LEGACY_MODULE_TYPE = 'featured';
const PROFILE_FEATURED_POST_MODULE_TYPE = 'featured_post';
const PROFILE_FEATURED_ROOM_MODULE_TYPE = 'featured_room';
const PROFILE_MODULE_TYPES = ['about', 'links', 'featured_badges', 'custom_text', PROFILE_FEATURED_POST_MODULE_TYPE, PROFILE_FEATURED_ROOM_MODULE_TYPE, PROFILE_ACTIVITY_MODULE_TYPE];
const PROFILE_BUILT_IN_MODULE_TYPES = [PROFILE_FEATURED_POST_MODULE_TYPE, PROFILE_FEATURED_ROOM_MODULE_TYPE, PROFILE_ACTIVITY_MODULE_TYPE];
const PROFILE_RETIRED_MODULE_TYPES = [PROFILE_FEATURED_LEGACY_MODULE_TYPE];
const PROFILE_MODULE_VISIBILITIES = ['public', 'hidden', 'draft'];
const PROFILE_MODULE_STATUSES = ['active', 'hidden', 'deleted'];
const PROFILE_MODULE_SCHEMA_VERSION = 1;
const PROFILE_MODULE_MAX_PER_PROFILE = 8;
const PROFILE_MODULE_TITLE_MAX = 80;
const PROFILE_MODULE_TEXT_MAX = 500;
const PROFILE_MODULE_LINKS_MAX = 10;
const PROFILE_MODULE_LINK_LABEL_MAX = 60;
const PROFILE_MODULE_FEATURED_BADGES_MAX = 12;

function profile_modules_dispatch(array $segments, string $method): void
{
    if (($segments[0] ?? null) === 'profiles' && count($segments) === 3 && $segments[2] === 'modules') {
        if ($method === 'GET' || $method === 'HEAD') {
            profile_modules_public_index($segments[1]);
        }

        json_error('Method not allowed.', 405);
    }

    if (
        ($segments[0] ?? null) === 'me'
        && ($segments[1] ?? null) === 'profile'
        && ($segments[2] ?? null) === 'modules'
    ) {
        if (count($segments) === 3) {
            if ($method === 'GET' || $method === 'HEAD') {
                profile_modules_owner_index();
            }

            if ($method === 'POST') {
                profile_modules_create();
            }

            json_error('Method not allowed.', 405);
        }

        if (count($segments) === 4) {
            if ($method === 'PATCH') {
                profile_modules_update($segments[3]);
            }

            if ($method === 'DELETE') {
                profile_modules_delete($segments[3]);
            }

            json_error('Method not allowed.', 405);
        }
    }

    if (
        ($segments[0] ?? null) === 'me'
        && ($segments[1] ?? null) === 'profile'
        && ($segments[2] ?? null) === 'module-order'
        && count($segments) === 3
    ) {
        if ($method === 'PATCH') {
            profile_modules_order_update();
        }

        json_error('Method not allowed.', 405);
    }

    json_error('Not found.', 404);
}

function profile_modules_public_index(string $handle): void
{
    require_profile_modules_storage();

    $profile = fetch_profile_by_handle(normalize_handle($handle));

    if ($profile === null || (string) ($profile['user_status'] ?? '') !== 'active') {
        json_error('Profile not found.', 404);
    }

    $statement = db_query(
        'SELECT *
         FROM profile_modules
         WHERE user_id = :user_id
           AND visibility = :visibility
           AND status = :status
         ORDER BY position ASC, id ASC',
        [
            'user_id' => (int) $profile['user_id'],
            'visibility' => 'public',
            'status' => 'active',
        ]
    );

    $userId = (int) $profile['user_id'];
    $modules = profile_modules_payload($statement->fetchAll(), true);
    $legacyFeaturedModule = profile_legacy_featured_module_record($userId);

    if (!profile_featured_post_module_preference_exists($userId) && profile_legacy_featured_module_allows_public_default($legacyFeaturedModule)) {
        $modules[] = profile_featured_post_module_payload(
            profile_legacy_featured_module_position($legacyFeaturedModule, 1)
        );
    }

    if (!profile_featured_room_module_preference_exists($userId) && profile_legacy_featured_module_allows_public_default($legacyFeaturedModule)) {
        $modules[] = profile_featured_room_module_payload(
            profile_legacy_featured_module_position($legacyFeaturedModule, 1) + 1
        );
    }

    if (!profile_activity_module_preference_exists($userId)) {
        $modules[] = profile_activity_module_payload(
            max(3, profile_modules_next_position($userId))
        );
    }

    profile_modules_sort_payload($modules);

    json_success($modules);
}

function profile_modules_owner_index(): void
{
    $session = require_authenticated_session();
    require_profile_modules_storage();

    json_success(profile_modules_for_owner((int) $session['user_id']));
}

function profile_modules_create(): void
{
    $session = require_authenticated_session();
    require_csrf_token($session);
    require_profile_modules_storage();

    $userId = (int) $session['user_id'];

    if (profile_modules_active_count($userId) >= PROFILE_MODULE_MAX_PER_PROFILE) {
        json_error('Profiles can have up to 8 modules.', 422);
    }

    $body = request_json_body();
    profile_module_require_object($body, 'JSON body');
    profile_module_reject_unknown_keys($body, ['type', 'title', 'config', 'visibility', 'status']);

    $type = profile_module_type($body['type'] ?? null);
    $title = profile_module_title($body['title'] ?? null);
    $visibility = profile_module_visibility($body['visibility'] ?? 'public');
    $status = profile_module_status($body['status'] ?? 'active');

    if (profile_module_type_is_built_in($type) && profile_builtin_module_preference_exists($userId, $type)) {
        json_error(profile_module_type_label($type) . ' module already exists.', 422);
    }

    if ($status === 'deleted') {
        json_error('New modules cannot be created as deleted.', 422);
    }

    $config = profile_module_config($type, $body['config'] ?? null, $userId);
    $position = profile_modules_next_position($userId);

    db_query(
        'INSERT INTO profile_modules
            (user_id, type, title, config_json, visibility, position, status, schema_version)
         VALUES
            (:user_id, :type, :title, :config_json, :visibility, :position, :status, :schema_version)',
        [
            'user_id' => $userId,
            'type' => $type,
            'title' => $title,
            'config_json' => json_encode($config, JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
            'visibility' => $visibility,
            'position' => $position,
            'status' => $status,
            'schema_version' => PROFILE_MODULE_SCHEMA_VERSION,
        ]
    );

    json_success(profile_modules_for_owner($userId), 201);
}

function profile_modules_update(string $rawModuleId): void
{
    $session = require_authenticated_session();
    require_csrf_token($session);
    require_profile_modules_storage();

    $moduleId = profile_module_id($rawModuleId);
    $module = profile_module_record($moduleId);

    if ($module === null) {
        json_error('Profile module not found.', 404);
    }

    $userId = (int) $session['user_id'];

    if ((int) $module['user_id'] !== $userId) {
        json_error('You cannot edit this profile module.', 403);
    }

    if ((string) $module['status'] === 'deleted') {
        json_error('Profile module not found.', 404);
    }

    $body = request_json_body();
    profile_module_require_object($body, 'JSON body');
    profile_module_reject_unknown_keys($body, ['title', 'config', 'visibility', 'status', 'type']);

    if (array_key_exists('type', $body)) {
        json_error('Module type cannot be changed.', 422);
    }

    $updates = [];
    $params = ['id' => $moduleId];

    if (array_key_exists('title', $body)) {
        $updates[] = 'title = :title';
        $params['title'] = profile_module_title($body['title']);
    }

    if (array_key_exists('config', $body)) {
        $updates[] = 'config_json = :config_json';
        $config = profile_module_config((string) $module['type'], $body['config'], $userId);
        $params['config_json'] = json_encode($config, JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    }

    if (array_key_exists('visibility', $body)) {
        $updates[] = 'visibility = :visibility';
        $params['visibility'] = profile_module_visibility($body['visibility']);
    }

    if (array_key_exists('status', $body)) {
        $updates[] = 'status = :status';
        $params['status'] = profile_module_status($body['status']);
    }

    if ($updates === []) {
        json_error('No supported module updates were provided.', 422);
    }

    db_query(
        sprintf(
            'UPDATE profile_modules SET %s, updated_at = CURRENT_TIMESTAMP() WHERE id = :id',
            implode(', ', $updates)
        ),
        $params
    );

    json_success(profile_modules_for_owner($userId));
}

function profile_modules_delete(string $rawModuleId): void
{
    $session = require_authenticated_session();
    require_csrf_token($session);
    require_profile_modules_storage();

    $moduleId = profile_module_id($rawModuleId);
    $module = profile_module_record($moduleId);

    if ($module === null) {
        json_error('Profile module not found.', 404);
    }

    $userId = (int) $session['user_id'];

    if ((int) $module['user_id'] !== $userId) {
        json_error('You cannot delete this profile module.', 403);
    }

    if (profile_module_type_is_built_in((string) $module['type'])) {
        json_error(profile_module_delete_message((string) $module['type']), 422);
    }

    db_query(
        "UPDATE profile_modules
         SET status = 'deleted',
             visibility = 'hidden',
             updated_at = CURRENT_TIMESTAMP()
         WHERE id = :id",
        ['id' => $moduleId]
    );

    json_success([
        'id' => $moduleId,
        'deleted' => true,
    ]);
}

function profile_modules_order_update(): void
{
    $session = require_authenticated_session();
    require_csrf_token($session);
    require_profile_modules_storage();

    $userId = (int) $session['user_id'];
    $body = request_json_body();
    profile_module_require_object($body, 'JSON body');
    profile_module_reject_unknown_keys($body, ['moduleIds']);

    $moduleIds = profile_module_order_ids($body['moduleIds'] ?? null);
    $currentIds = profile_module_owner_ids($userId);

    if (count($moduleIds) !== count($currentIds)) {
        json_error('Module order must include every profile module.', 422);
    }

    sort($moduleIds);
    $sortedCurrentIds = $currentIds;
    sort($sortedCurrentIds);

    if ($moduleIds !== $sortedCurrentIds) {
        json_error('Module order contains unavailable modules.', 422);
    }

    $pdo = db();
    $pdo->beginTransaction();

    try {
        foreach ($body['moduleIds'] as $index => $rawId) {
            db_query(
                'UPDATE profile_modules
                 SET position = :position,
                     updated_at = CURRENT_TIMESTAMP()
                 WHERE id = :id
                   AND user_id = :user_id
                   AND status <> :deleted_status',
                [
                    'position' => $index + 1,
                    'id' => profile_module_id($rawId),
                    'user_id' => $userId,
                    'deleted_status' => 'deleted',
                ]
            );
        }

        $pdo->commit();
    } catch (Throwable $exception) {
        $pdo->rollBack();
        throw $exception;
    }

    json_success(profile_modules_for_owner($userId));
}

function require_profile_modules_storage(): void
{
    if (!profile_modules_storage_exists()) {
        json_error('Profile module storage is not ready. Run pending migrations.', 503);
    }
}

function profile_modules_storage_exists(): bool
{
    return database_table_exists('profile_modules');
}

function profile_modules_for_owner(int $userId): array
{
    ensure_profile_featured_modules($userId);
    ensure_profile_activity_module($userId);

    $statement = db_query(
        'SELECT *
         FROM profile_modules
         WHERE user_id = :user_id
           AND status <> :deleted_status
         ORDER BY position ASC, id ASC',
        [
            'user_id' => $userId,
            'deleted_status' => 'deleted',
        ]
    );

    return profile_modules_payload($statement->fetchAll(), false);
}

function profile_modules_payload(array $rows, bool $public): array
{
    $modules = [];

    foreach ($rows as $row) {
        $module = profile_module_payload($row, $public);

        if ($module !== null) {
            $modules[] = $module;
        }
    }

    return $modules;
}

function profile_module_payload(array $row, bool $public): ?array
{
    if (!profile_module_type_is_supported($row['type'] ?? null)) {
        return null;
    }

    $config = profile_module_json((string) $row['config_json']);
    $config = profile_module_output_config((string) $row['type'], $config, (int) $row['user_id']);

    return [
        'id' => (int) $row['id'],
        'type' => (string) $row['type'],
        'title' => $row['title'] === null ? null : (string) $row['title'],
        'config' => $config,
        'visibility' => (string) $row['visibility'],
        'position' => (int) $row['position'],
        'status' => (string) $row['status'],
        'schemaVersion' => (int) $row['schema_version'],
        'createdAt' => $row['created_at'] ?? null,
        'updatedAt' => $row['updated_at'] ?? null,
    ];
}

function profile_module_type_is_supported(mixed $value): bool
{
    return is_string($value) && in_array($value, PROFILE_MODULE_TYPES, true);
}

function profile_module_type_is_retired(mixed $value): bool
{
    return is_string($value) && in_array($value, PROFILE_RETIRED_MODULE_TYPES, true);
}

function profile_module_type_is_built_in(string $type): bool
{
    return in_array($type, PROFILE_BUILT_IN_MODULE_TYPES, true);
}

function profile_module_type_label(string $type): string
{
    return match ($type) {
        PROFILE_FEATURED_POST_MODULE_TYPE => 'Featured post',
        PROFILE_FEATURED_ROOM_MODULE_TYPE => 'Featured room',
        PROFILE_ACTIVITY_MODULE_TYPE => 'Activity',
        default => 'Module',
    };
}

function profile_module_delete_message(string $type): string
{
    return match ($type) {
        PROFILE_FEATURED_POST_MODULE_TYPE => 'Featured post can be hidden instead of deleted.',
        PROFILE_FEATURED_ROOM_MODULE_TYPE => 'Featured room can be hidden instead of deleted.',
        PROFILE_ACTIVITY_MODULE_TYPE => 'Activity can be hidden instead of deleted.',
        default => 'Module can be hidden instead of deleted.',
    };
}

function profile_module_output_config(string $type, array $config, int $userId): array
{
    if ($type !== 'featured_badges') {
        return $config;
    }

    return [
        'userBadgeIds' => profile_module_visible_user_badge_ids($userId, $config['userBadgeIds'] ?? []),
    ];
}

function profile_module_json(string $value): array
{
    try {
        $decoded = json_decode($value, true, 512, JSON_THROW_ON_ERROR);
    } catch (JsonException) {
        return [];
    }

    return is_array($decoded) && !array_is_list($decoded) ? $decoded : [];
}

function profile_module_record(int $moduleId): ?array
{
    $statement = db_query(
        'SELECT *
         FROM profile_modules
         WHERE id = :id
         LIMIT 1',
        ['id' => $moduleId]
    );
    $row = $statement->fetch();

    return is_array($row) ? $row : null;
}

function profile_modules_active_count(int $userId): int
{
    $statement = db_query(
        'SELECT COUNT(*) AS module_count
         FROM profile_modules
         WHERE user_id = :user_id
           AND status <> :deleted_status
           AND type <> :featured_post_type
           AND type <> :featured_room_type
           AND type <> :legacy_featured_type
           AND type <> :activity_type',
        [
            'user_id' => $userId,
            'deleted_status' => 'deleted',
            'featured_post_type' => PROFILE_FEATURED_POST_MODULE_TYPE,
            'featured_room_type' => PROFILE_FEATURED_ROOM_MODULE_TYPE,
            'legacy_featured_type' => PROFILE_FEATURED_LEGACY_MODULE_TYPE,
            'activity_type' => PROFILE_ACTIVITY_MODULE_TYPE,
        ]
    );
    $row = $statement->fetch();

    return is_array($row) ? (int) ($row['module_count'] ?? 0) : 0;
}

function profile_modules_next_position(int $userId): int
{
    $statement = db_query(
        'SELECT COALESCE(MAX(position), 0) + 1 AS next_position
         FROM profile_modules
         WHERE user_id = :user_id
           AND status <> :deleted_status',
        [
            'user_id' => $userId,
            'deleted_status' => 'deleted',
        ]
    );
    $row = $statement->fetch();

    return is_array($row) ? max(1, (int) ($row['next_position'] ?? 1)) : 1;
}

function profile_activity_module_preference_exists(int $userId): bool
{
    return profile_builtin_module_preference_exists($userId, PROFILE_ACTIVITY_MODULE_TYPE);
}

function profile_featured_post_module_preference_exists(int $userId): bool
{
    return profile_builtin_module_preference_exists($userId, PROFILE_FEATURED_POST_MODULE_TYPE);
}

function profile_featured_room_module_preference_exists(int $userId): bool
{
    return profile_builtin_module_preference_exists($userId, PROFILE_FEATURED_ROOM_MODULE_TYPE);
}

function profile_builtin_module_preference_exists(int $userId, string $type): bool
{
    $statement = db_query(
        'SELECT id
         FROM profile_modules
         WHERE user_id = :user_id
           AND type = :module_type
           AND status <> :deleted_status
         LIMIT 1',
        [
            'user_id' => $userId,
            'module_type' => $type,
            'deleted_status' => 'deleted',
        ]
    );

    return is_array($statement->fetch());
}

function profile_builtin_module_position(int $userId, string $type): ?int
{
    $statement = db_query(
        'SELECT position
         FROM profile_modules
         WHERE user_id = :user_id
           AND type = :module_type
           AND status <> :deleted_status
         LIMIT 1',
        [
            'user_id' => $userId,
            'module_type' => $type,
            'deleted_status' => 'deleted',
        ]
    );
    $row = $statement->fetch();

    return is_array($row) ? max(1, (int) ($row['position'] ?? 1)) : null;
}

function profile_legacy_featured_module_record(int $userId): ?array
{
    $statement = db_query(
        'SELECT *
         FROM profile_modules
         WHERE user_id = :user_id
           AND type = :module_type
           AND status <> :deleted_status
         ORDER BY position ASC, id ASC
         LIMIT 1',
        [
            'user_id' => $userId,
            'module_type' => PROFILE_FEATURED_LEGACY_MODULE_TYPE,
            'deleted_status' => 'deleted',
        ]
    );
    $row = $statement->fetch();

    return is_array($row) ? $row : null;
}

function profile_legacy_featured_module_position(?array $legacyModule, int $fallback): int
{
    if ($legacyModule === null) {
        return $fallback;
    }

    return max(1, (int) ($legacyModule['position'] ?? $fallback));
}

function profile_legacy_featured_module_allows_public_default(?array $legacyModule): bool
{
    if ($legacyModule === null) {
        return true;
    }

    return ($legacyModule['visibility'] ?? 'public') === 'public'
        && ($legacyModule['status'] ?? 'active') === 'active';
}

function profile_legacy_featured_module_visibility(?array $legacyModule): string
{
    $visibility = $legacyModule['visibility'] ?? null;

    return is_string($visibility) && in_array($visibility, PROFILE_MODULE_VISIBILITIES, true)
        ? $visibility
        : 'public';
}

function profile_legacy_featured_module_status(?array $legacyModule): string
{
    $status = $legacyModule['status'] ?? null;

    return is_string($status) && in_array($status, PROFILE_MODULE_STATUSES, true) && $status !== 'deleted'
        ? $status
        : 'active';
}

function ensure_profile_featured_modules(int $userId): void
{
    $hasPost = profile_featured_post_module_preference_exists($userId);
    $hasRoom = profile_featured_room_module_preference_exists($userId);

    if ($hasPost && $hasRoom) {
        return;
    }

    $legacyModule = profile_legacy_featured_module_record($userId);
    $basePosition = profile_legacy_featured_module_position($legacyModule, 1);
    $visibility = profile_legacy_featured_module_visibility($legacyModule);
    $status = profile_legacy_featured_module_status($legacyModule);
    $pdo = db();
    $pdo->beginTransaction();

    try {
        if (!$hasPost) {
            profile_insert_builtin_module_at(
                $userId,
                PROFILE_FEATURED_POST_MODULE_TYPE,
                $basePosition,
                $visibility,
                $status
            );
        }

        if (!$hasRoom) {
            $postPosition = profile_builtin_module_position($userId, PROFILE_FEATURED_POST_MODULE_TYPE);
            profile_insert_builtin_module_at(
                $userId,
                PROFILE_FEATURED_ROOM_MODULE_TYPE,
                ($postPosition ?? $basePosition) + 1,
                $visibility,
                $status
            );
        }

        $pdo->commit();
    } catch (Throwable $exception) {
        $pdo->rollBack();
        throw $exception;
    }
}

function profile_insert_builtin_module_at(
    int $userId,
    string $type,
    int $position,
    string $visibility,
    string $status
): void {
    $position = max(1, $position);

    db_query(
        'UPDATE profile_modules
         SET position = position + 1,
             updated_at = CURRENT_TIMESTAMP()
         WHERE user_id = :user_id
           AND status <> :deleted_status
           AND position >= :position',
        [
            'user_id' => $userId,
            'deleted_status' => 'deleted',
            'position' => $position,
        ]
    );

    db_query(
        'INSERT INTO profile_modules
            (user_id, type, title, config_json, visibility, position, status, schema_version)
         VALUES
            (:user_id, :type, NULL, :config_json, :visibility, :position, :status, :schema_version)',
        [
            'user_id' => $userId,
            'type' => $type,
            'config_json' => '{}',
            'visibility' => $visibility,
            'position' => $position,
            'status' => $status,
            'schema_version' => PROFILE_MODULE_SCHEMA_VERSION,
        ]
    );
}

function ensure_profile_activity_module(int $userId): void
{
    if (profile_activity_module_preference_exists($userId)) {
        return;
    }

    db_query(
        'INSERT INTO profile_modules
            (user_id, type, title, config_json, visibility, position, status, schema_version)
         VALUES
            (:user_id, :type, NULL, :config_json, :visibility, :position, :status, :schema_version)',
        [
            'user_id' => $userId,
            'type' => PROFILE_ACTIVITY_MODULE_TYPE,
            'config_json' => '{}',
            'visibility' => 'public',
            'position' => profile_modules_next_position($userId),
            'status' => 'active',
            'schema_version' => PROFILE_MODULE_SCHEMA_VERSION,
        ]
    );
}

function profile_activity_module_payload(int $position): array
{
    return [
        'id' => 0,
        'type' => PROFILE_ACTIVITY_MODULE_TYPE,
        'title' => null,
        'config' => [],
        'visibility' => 'public',
        'position' => $position,
        'status' => 'active',
        'schemaVersion' => PROFILE_MODULE_SCHEMA_VERSION,
        'createdAt' => null,
        'updatedAt' => null,
    ];
}

function profile_featured_post_module_payload(int $position): array
{
    return [
        'id' => 0,
        'type' => PROFILE_FEATURED_POST_MODULE_TYPE,
        'title' => null,
        'config' => [],
        'visibility' => 'public',
        'position' => $position,
        'status' => 'active',
        'schemaVersion' => PROFILE_MODULE_SCHEMA_VERSION,
        'createdAt' => null,
        'updatedAt' => null,
    ];
}

function profile_featured_room_module_payload(int $position): array
{
    return [
        'id' => 0,
        'type' => PROFILE_FEATURED_ROOM_MODULE_TYPE,
        'title' => null,
        'config' => [],
        'visibility' => 'public',
        'position' => $position,
        'status' => 'active',
        'schemaVersion' => PROFILE_MODULE_SCHEMA_VERSION,
        'createdAt' => null,
        'updatedAt' => null,
    ];
}

function profile_modules_sort_payload(array &$modules): void
{
    usort(
        $modules,
        static function (array $first, array $second): int {
            $positionCompare = ((int) ($first['position'] ?? 0)) <=> ((int) ($second['position'] ?? 0));

            if ($positionCompare !== 0) {
                return $positionCompare;
            }

            $typeCompare = profile_module_default_sort_order((string) ($first['type'] ?? ''))
                <=> profile_module_default_sort_order((string) ($second['type'] ?? ''));

            if ($typeCompare !== 0) {
                return $typeCompare;
            }

            return ((int) ($first['id'] ?? 0)) <=> ((int) ($second['id'] ?? 0));
        }
    );
}

function profile_module_default_sort_order(string $type): int
{
    return match ($type) {
        PROFILE_FEATURED_POST_MODULE_TYPE => 0,
        PROFILE_FEATURED_ROOM_MODULE_TYPE => 1,
        PROFILE_ACTIVITY_MODULE_TYPE => 3,
        default => 2,
    };
}

function profile_module_owner_ids(int $userId): array
{
    $statement = db_query(
        'SELECT id
         FROM profile_modules
         WHERE user_id = :user_id
           AND status <> :deleted_status
         ORDER BY position ASC, id ASC',
        [
            'user_id' => $userId,
            'deleted_status' => 'deleted',
        ]
    );

    $ids = [];

    foreach ($statement->fetchAll() as $row) {
        if (profile_module_type_is_supported($row['type'] ?? null)) {
            $ids[] = (int) $row['id'];
        }
    }

    return $ids;
}

function profile_module_config(string $type, mixed $value, int $userId): array
{
    if (profile_module_type_is_built_in($type)) {
        if (!is_array($value) || ($value !== [] && array_is_list($value))) {
            json_error('Module config must be an object.', 422);
        }

        return profile_module_builtin_config($value);
    }

    if (!is_array($value) || array_is_list($value)) {
        json_error('Module config must be an object.', 422);
    }

    return match ($type) {
        'about' => profile_module_about_config($value),
        'custom_text' => profile_module_custom_text_config($value),
        'links' => profile_module_links_config($value),
        'featured_badges' => profile_module_featured_badges_config($value, $userId),
        default => json_error('Choose a supported module type.', 422),
    };
}

function profile_module_builtin_config(array $config): array
{
    profile_module_reject_unknown_keys($config, []);

    return [];
}

function profile_module_activity_config(array $config): array
{
    return profile_module_builtin_config($config);
}

function profile_module_featured_post_config(array $config): array
{
    return profile_module_builtin_config($config);
}

function profile_module_featured_room_config(array $config): array
{
    return profile_module_builtin_config($config);
}

function profile_module_about_config(array $config): array
{
    profile_module_reject_unknown_keys($config, ['body']);

    return [
        'body' => profile_module_text($config['body'] ?? null, PROFILE_MODULE_TEXT_MAX, 'About text'),
    ];
}

function profile_module_custom_text_config(array $config): array
{
    profile_module_reject_unknown_keys($config, ['body', 'link']);

    $normalized = [
        'body' => profile_module_text($config['body'] ?? null, PROFILE_MODULE_TEXT_MAX, 'Module text'),
    ];

    if (array_key_exists('link', $config) && $config['link'] !== null) {
        $normalized['link'] = profile_module_link($config['link']);
    }

    return $normalized;
}

function profile_module_links_config(array $config): array
{
    profile_module_reject_unknown_keys($config, ['links']);

    if (!array_key_exists('links', $config) || !is_array($config['links']) || !array_is_list($config['links'])) {
        json_error('Links must be an array.', 422);
    }

    if (count($config['links']) > PROFILE_MODULE_LINKS_MAX) {
        json_error('Profiles can have up to 10 links in a module.', 422);
    }

    $links = [];
    $seen = [];

    foreach ($config['links'] as $item) {
        $link = profile_module_link($item);
        $key = strtolower($link['url']);

        if (isset($seen[$key])) {
            continue;
        }

        $seen[$key] = true;
        $links[] = $link;
    }

    if ($links === []) {
        json_error('At least one link is required.', 422);
    }

    return ['links' => $links];
}

function profile_module_featured_badges_config(array $config, int $userId): array
{
    profile_module_reject_unknown_keys($config, ['userBadgeIds']);

    if (!array_key_exists('userBadgeIds', $config) || !is_array($config['userBadgeIds']) || !array_is_list($config['userBadgeIds'])) {
        json_error('Featured badge ids must be an array.', 422);
    }

    if (count($config['userBadgeIds']) > PROFILE_MODULE_FEATURED_BADGES_MAX) {
        json_error('Too many badges were selected.', 422);
    }

    $ids = [];

    foreach ($config['userBadgeIds'] as $value) {
        $id = profile_module_id($value);

        if (isset($ids[$id])) {
            continue;
        }

        $ids[$id] = true;
    }

    $visibleIds = profile_module_visible_user_badge_ids($userId, array_keys($ids));

    if (count($visibleIds) !== count($ids)) {
        json_error('Badge is not available on this profile.', 422);
    }

    return ['userBadgeIds' => $visibleIds];
}

function profile_module_visible_user_badge_ids(int $userId, mixed $values): array
{
    if (!is_array($values)) {
        return [];
    }

    $ids = [];

    foreach ($values as $value) {
        if (!is_int($value) && !(is_string($value) && preg_match('/^[0-9]+$/', $value) === 1)) {
            continue;
        }

        $id = (int) $value;

        if ($id > 0) {
            $ids[$id] = true;
        }
    }

    if ($ids === []) {
        return [];
    }

    if (!database_table_exists('badges') || !database_table_exists('user_badges')) {
        json_error('Badge storage is not ready. Run pending migrations.', 503);
    }

    $params = ['user_id' => $userId];
    $placeholders = [];

    foreach (array_keys($ids) as $index => $id) {
        $param = 'badge_id_' . $index;
        $params[$param] = $id;
        $placeholders[] = ':' . $param;
    }

    $statement = db_query(
        sprintf(
            'SELECT ub.id
             FROM user_badges ub
             INNER JOIN badges b ON b.id = ub.badge_id
             WHERE ub.user_id = :user_id
               AND ub.is_visible = 1
               AND b.is_active = 1
               AND ub.id IN (%s)',
            implode(', ', $placeholders)
        ),
        $params
    );

    $available = [];

    foreach ($statement->fetchAll() as $row) {
        $available[(int) $row['id']] = true;
    }

    return array_values(array_filter(
        array_keys($ids),
        static fn (int $id): bool => isset($available[$id])
    ));
}

function profile_module_link(mixed $value): array
{
    if (!is_array($value) || array_is_list($value)) {
        json_error('Link must be an object.', 422);
    }

    profile_module_reject_unknown_keys($value, ['label', 'url']);

    return [
        'label' => profile_module_text($value['label'] ?? null, PROFILE_MODULE_LINK_LABEL_MAX, 'Link label'),
        'url' => profile_module_url($value['url'] ?? null, 'Link URL'),
    ];
}

function profile_module_type(mixed $value): string
{
    if (!is_string($value)) {
        json_error('Choose a supported module type.', 422);
    }

    $type = strtolower(trim($value));

    if (!in_array($type, PROFILE_MODULE_TYPES, true)) {
        json_error('Choose a supported module type.', 422);
    }

    return $type;
}

function profile_module_title(mixed $value): ?string
{
    if ($value === null) {
        return null;
    }

    if (!is_string($value)) {
        json_error('Module title is invalid.', 422);
    }

    $trimmed = trim($value);

    if ($trimmed === '') {
        return null;
    }

    return profile_module_text($trimmed, PROFILE_MODULE_TITLE_MAX, 'Module title');
}

function profile_module_visibility(mixed $value): string
{
    if (!is_string($value)) {
        json_error('Choose a supported module visibility.', 422);
    }

    $visibility = strtolower(trim($value));

    if (!in_array($visibility, PROFILE_MODULE_VISIBILITIES, true)) {
        json_error('Choose a supported module visibility.', 422);
    }

    return $visibility;
}

function profile_module_status(mixed $value): string
{
    if (!is_string($value)) {
        json_error('Choose a supported module status.', 422);
    }

    $status = strtolower(trim($value));

    if (!in_array($status, PROFILE_MODULE_STATUSES, true)) {
        json_error('Choose a supported module status.', 422);
    }

    return $status;
}

function profile_module_order_ids(mixed $value): array
{
    if (!is_array($value) || !array_is_list($value)) {
        json_error('Module ids must be an array.', 422);
    }

    $ids = [];
    $seen = [];

    foreach ($value as $item) {
        $id = profile_module_id($item);

        if (isset($seen[$id])) {
            json_error('Module order cannot contain duplicates.', 422);
        }

        $seen[$id] = true;
        $ids[] = $id;
    }

    return $ids;
}

function profile_module_id(mixed $value): int
{
    if (is_int($value) && $value > 0) {
        return $value;
    }

    if (is_string($value) && preg_match('/^[0-9]+$/', $value) === 1 && (int) $value > 0) {
        return (int) $value;
    }

    json_error('Profile module id is invalid.', 422);
}

function profile_module_text(mixed $value, int $maxLength, string $label): string
{
    if (!is_string($value)) {
        json_error("{$label} is invalid.", 422);
    }

    $trimmed = trim(preg_replace('/\s+/', ' ', $value) ?? $value);

    if ($trimmed === '') {
        json_error("{$label} is required.", 422);
    }

    if (profile_module_text_length($trimmed) > $maxLength) {
        json_error("{$label} is too long.", 422);
    }

    if (profile_module_text_is_unsafe($trimmed)) {
        json_error("{$label} must be plain text.", 422);
    }

    return $trimmed;
}

function profile_module_text_is_unsafe(string $value): bool
{
    if (preg_match('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/', $value) === 1) {
        return true;
    }

    if (preg_match('/<\s*\/?\s*[a-z][^>]*>/i', $value) === 1) {
        return true;
    }

    if (preg_match('/(?:javascript|data)\s*:/i', $value) === 1) {
        return true;
    }

    if (preg_match('/\bon[a-z]+\s*=/i', $value) === 1) {
        return true;
    }

    return false;
}

function profile_module_url(mixed $value, string $label): string
{
    if (!is_string($value)) {
        json_error("{$label} is invalid.", 422);
    }

    $trimmed = trim($value);

    if ($trimmed === '' || profile_module_text_length($trimmed) > 500 || profile_module_text_is_unsafe($trimmed)) {
        json_error("{$label} is invalid.", 422);
    }

    if (filter_var($trimmed, FILTER_VALIDATE_URL) === false) {
        json_error("{$label} must be a valid HTTPS URL.", 422);
    }

    $parts = parse_url($trimmed);

    if (!is_array($parts) || strtolower((string) ($parts['scheme'] ?? '')) !== 'https') {
        json_error("{$label} must be a valid HTTPS URL.", 422);
    }

    if (!isset($parts['host']) || isset($parts['user']) || isset($parts['pass'])) {
        json_error("{$label} must be a valid HTTPS URL.", 422);
    }

    $path = (string) ($parts['path'] ?? '');

    if (preg_match('/\.svg$/i', $path) === 1) {
        json_error("{$label} cannot reference SVG media.", 422);
    }

    return profile_module_build_url($parts);
}

function profile_module_build_url(array $parts): string
{
    $url = 'https://' . strtolower((string) $parts['host']);

    if (isset($parts['port'])) {
        $url .= ':' . (int) $parts['port'];
    }

    $url .= $parts['path'] ?? '/';

    if (isset($parts['query']) && $parts['query'] !== '') {
        $url .= '?' . $parts['query'];
    }

    if (isset($parts['fragment']) && $parts['fragment'] !== '') {
        $url .= '#' . $parts['fragment'];
    }

    return $url;
}

function profile_module_require_object(array $value, string $label): void
{
    if (array_is_list($value)) {
        json_error("{$label} must be an object.", 400);
    }
}

function profile_module_reject_unknown_keys(array $value, array $allowedKeys): void
{
    $allowed = array_fill_keys($allowedKeys, true);

    foreach (array_keys($value) as $key) {
        if (!is_string($key) || !isset($allowed[$key])) {
            json_error('Unsupported module field was provided.', 422);
        }
    }
}

function profile_module_text_length(string $value): int
{
    if (function_exists('mb_strlen')) {
        return mb_strlen($value);
    }

    return strlen($value);
}
