<?php

declare(strict_types=1);

require_once __DIR__ . '/auth.php';
require_once __DIR__ . '/read.php';
require_once __DIR__ . '/integrations.php';
require_once __DIR__ . '/profile.php';

const PROFILE_INFO_MODULE_TYPE = 'profile_info';
const PROFILE_ACTIVITY_MODULE_TYPE = 'activity';
const PROFILE_FEATURED_LEGACY_MODULE_TYPE = 'featured';
const PROFILE_FEATURED_POST_MODULE_TYPE = 'featured_post';
const PROFILE_FEATURED_ROOM_MODULE_TYPE = 'featured_room';
const PROFILE_GALLERY_MEDIA_MODULE_TYPE = 'gallery_media';
const PROFILE_CREATOR_LIVE_MODULE_TYPE = 'creator_live';
const PROFILE_MUSIC_MODULE_TYPE = 'music';
const PROFILE_CONNECTIONS_MODULE_TYPE = 'connections';
const PROFILE_TEXT_MODULE_TYPE = 'text';
const PROFILE_BADGE_DISPLAY_MODULE_TYPE = 'badge_display';
const PROFILE_GITHUB_REPO_MODULE_TYPE = 'github_repo';
const PROFILE_CANVAS_PLACEHOLDER_MODULE_TYPE = 'placeholder';
const PROFILE_VIDEO_MODULE_TYPES = ['twitch_channel', 'youtube_video', 'youtube_stream', 'youtube_playlist', 'uploaded_video'];
const PROFILE_MUSIC_SPECIFIC_MODULE_TYPES = ['spotify_song', 'apple_music_song', 'youtube_music_song', 'spotify_playlist', 'apple_music_playlist', 'youtube_music_playlist', 'spotify_artist', 'apple_music_artist', 'youtube_music_artist'];
const PROFILE_IMAGE_MODULE_TYPES = ['uploaded_image', 'gallery_slideshow', 'gallery_feed'];
const PROFILE_MODULE_TYPES = [
    PROFILE_INFO_MODULE_TYPE,
    'about',
    'links',
    'featured_badges',
    'custom_text',
    PROFILE_GALLERY_MEDIA_MODULE_TYPE,
    PROFILE_CREATOR_LIVE_MODULE_TYPE,
    PROFILE_MUSIC_MODULE_TYPE,
    PROFILE_FEATURED_POST_MODULE_TYPE,
    PROFILE_FEATURED_ROOM_MODULE_TYPE,
    PROFILE_ACTIVITY_MODULE_TYPE,
    PROFILE_CONNECTIONS_MODULE_TYPE,
    PROFILE_TEXT_MODULE_TYPE,
    PROFILE_BADGE_DISPLAY_MODULE_TYPE,
    PROFILE_GITHUB_REPO_MODULE_TYPE,
    'twitch_channel',
    'youtube_video',
    'youtube_stream',
    'youtube_playlist',
    'uploaded_video',
    'spotify_song',
    'apple_music_song',
    'youtube_music_song',
    'spotify_playlist',
    'apple_music_playlist',
    'youtube_music_playlist',
    'spotify_artist',
    'apple_music_artist',
    'youtube_music_artist',
    'uploaded_image',
    'gallery_slideshow',
    'gallery_feed',
];
const PROFILE_BUILT_IN_MODULE_TYPES = [PROFILE_INFO_MODULE_TYPE, PROFILE_FEATURED_POST_MODULE_TYPE, PROFILE_FEATURED_ROOM_MODULE_TYPE, PROFILE_ACTIVITY_MODULE_TYPE];
const PROFILE_PROTECTED_MODULE_TYPES = [PROFILE_INFO_MODULE_TYPE];
const PROFILE_SINGLETON_MODULE_TYPES = [PROFILE_INFO_MODULE_TYPE, PROFILE_FEATURED_POST_MODULE_TYPE, PROFILE_FEATURED_ROOM_MODULE_TYPE, PROFILE_ACTIVITY_MODULE_TYPE];
const PROFILE_RETIRED_MODULE_TYPES = [PROFILE_FEATURED_LEGACY_MODULE_TYPE];
const PROFILE_MODULE_VISIBILITIES = ['public', 'hidden', 'draft'];
const PROFILE_MODULE_STATUSES = ['active', 'hidden', 'deleted'];
const PROFILE_MODULE_SCHEMA_VERSION = 1;
const PROFILE_CANVAS_VERSION = 2;
const PROFILE_CANVAS_COLUMNS = 12;
const PROFILE_CANVAS_ROWS = 16;
const PROFILE_CANVAS_MOBILE_COLUMNS = 6;
const PROFILE_CANVAS_MOBILE_ROWS = 32;
const PROFILE_CANVAS_MAX_MODULE_SPAN = 6;
const PROFILE_CANVAS_PROFILE_INFO_MAX_COLUMNS = 8;
const PROFILE_BACKGROUND_BLUR_LEVELS = ['none', 'soft', 'medium', 'heavy'];
const PROFILE_MODULE_MAX_PER_PROFILE = 24;
const PROFILE_MODULE_TITLE_MAX = 80;
const PROFILE_MODULE_TEXT_MAX = 500;
const PROFILE_MODULE_STATUS_TEXT_MAX = 120;
const PROFILE_MODULE_SHORT_TEXT_MAX = 180;
const PROFILE_MODULE_LINKS_MAX = 10;
const PROFILE_MODULE_LINK_LABEL_MAX = 60;
const PROFILE_MODULE_FEATURED_BADGES_MAX = 12;
const PROFILE_MODULE_GALLERY_MEDIA_MAX = 6;
const PROFILE_MODULE_GALLERY_CAPTION_MAX = 80;
const PROFILE_MODULE_LINK_PLATFORMS = ['website', 'youtube', 'twitch', 'tiktok', 'instagram', 'x', 'bluesky', 'github', 'discord', 'spotify', 'custom'];
const PROFILE_MODULE_CREATOR_PLATFORMS = ['website', 'youtube', 'twitch', 'tiktok', 'instagram', 'x', 'bluesky', 'github', 'discord', 'custom'];
const PROFILE_MODULE_MUSIC_PLATFORMS = ['spotify', 'apple_music', 'youtube_music', 'soundcloud', 'bandcamp', 'custom'];

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

        if (count($segments) === 5 && $segments[4] === 'restore') {
            if ($method === 'POST') {
                profile_modules_restore($segments[3]);
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
        && ($segments[2] ?? null) === 'canvas'
        && count($segments) === 3
    ) {
        if ($method === 'PATCH') {
            profile_canvas_update();
        }

        json_error('Method not allowed.', 405);
    }

    if (
        ($segments[0] ?? null) === 'me'
        && ($segments[1] ?? null) === 'profile'
        && ($segments[2] ?? null) === 'canvas-draft'
    ) {
        if (count($segments) === 3) {
            if ($method === 'GET' || $method === 'HEAD') {
                profile_canvas_draft_get();
            }

            if ($method === 'PATCH') {
                profile_canvas_draft_update();
            }

            if ($method === 'DELETE') {
                profile_canvas_draft_delete();
            }

            json_error('Method not allowed.', 405);
        }

        if (count($segments) === 4 && $segments[3] === 'commit') {
            if ($method === 'POST') {
                profile_canvas_draft_commit();
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

    if (!profile_modules_payload_contains_type($modules, PROFILE_INFO_MODULE_TYPE)) {
        $modules[] = profile_info_module_payload(0);
    }

    profile_modules_sort_payload($modules);

    json_success($modules);
}

function profile_modules_owner_index(): void
{
    $session = require_authenticated_session();
    require_profile_modules_storage();

    json_success(profile_modules_for_owner((int) $session['user_id'], profile_modules_include_deleted_requested()));
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

    if (profile_module_type_is_singleton($type) && profile_singleton_module_preference_exists($userId, $type)) {
        json_error(profile_module_type_label($type) . ' module already exists.', 422);
    }

    if ($status === 'deleted') {
        json_error('New modules cannot be created as deleted.', 422);
    }

    if ($type === PROFILE_INFO_MODULE_TYPE && ($visibility !== 'public' || $status !== 'active')) {
        json_error('Profile info cannot be hidden.', 422);
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
        if ((string) $module['type'] === PROFILE_INFO_MODULE_TYPE && profile_module_visibility($body['visibility']) !== 'public') {
            json_error('Profile info cannot be hidden.', 422);
        }

        $updates[] = 'visibility = :visibility';
        $params['visibility'] = profile_module_visibility($body['visibility']);
    }

    if (array_key_exists('status', $body)) {
        if ((string) $module['type'] === PROFILE_INFO_MODULE_TYPE && profile_module_status($body['status']) !== 'active') {
            json_error('Profile info cannot be hidden.', 422);
        }

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

    if (profile_module_type_is_protected((string) $module['type'])) {
        json_error('Profile info cannot be deleted.', 422);
    }

    $pdo = db();
    $pdo->beginTransaction();

    try {
        $config = profile_module_delete_snapshot_config($module, $userId);

        db_query(
            "UPDATE profile_modules
             SET status = 'deleted',
                 visibility = 'hidden',
                 config_json = :config_json,
                 updated_at = CURRENT_TIMESTAMP()
             WHERE id = :id",
            [
                'config_json' => json_encode($config, JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
                'id' => $moduleId,
            ]
        );

        profile_module_apply_delete_side_effects((string) $module['type'], $userId);

        $pdo->commit();
    } catch (Throwable $exception) {
        $pdo->rollBack();
        throw $exception;
    }

    json_success(profile_modules_for_owner($userId));
}

function profile_modules_restore(string $rawModuleId): void
{
    $session = require_authenticated_session();
    require_csrf_token($session);
    require_profile_modules_storage();
    require_profile_canvas_storage();

    $moduleId = profile_module_id($rawModuleId);
    $module = profile_module_record($moduleId);

    if ($module === null) {
        json_error('Profile module not found.', 404);
    }

    $userId = (int) $session['user_id'];

    if ((int) $module['user_id'] !== $userId) {
        json_error('You cannot restore this profile module.', 403);
    }

    $type = (string) $module['type'];

    if (!profile_module_type_is_supported($type) || profile_module_type_is_retired($type)) {
        json_error('This profile module can no longer be restored.', 422);
    }

    if (profile_module_type_is_protected($type)) {
        json_error('Profile info is always active.', 422);
    }

    if ((string) $module['status'] !== 'deleted') {
        json_success(profile_modules_for_owner($userId, true));
    }

    if (profile_modules_active_count($userId) >= PROFILE_MODULE_MAX_PER_PROFILE) {
        json_error('Profiles can have up to 8 modules.', 422);
    }

    $pdo = db();
    $pdo->beginTransaction();

    try {
        db_query(
            "UPDATE profile_modules
             SET status = 'active',
                 visibility = 'public',
                 updated_at = CURRENT_TIMESTAMP()
             WHERE id = :id
               AND user_id = :user_id",
            [
                'id' => $moduleId,
                'user_id' => $userId,
            ]
        );

        profile_module_apply_restore_side_effects($module, $userId);
        profile_canvas_reflow_existing_modules($userId, $moduleId);

        $pdo->commit();
    } catch (Throwable $exception) {
        $pdo->rollBack();
        throw $exception;
    }

    json_success(profile_modules_for_owner($userId, true));
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

function profile_canvas_update(): void
{
    $session = require_authenticated_session();
    require_csrf_token($session);
    require_profile_modules_storage();
    require_profile_canvas_storage();

    $userId = (int) $session['user_id'];
    ensure_profile_canvas_builtin_modules($userId);

    $body = request_json_body();
    profile_module_require_object($body, 'JSON body');
    profile_module_reject_unknown_keys($body, ['canvasVersion', 'backgroundBlur', 'modules', 'anchorModuleId', 'movementContext']);

    $hasBlur = array_key_exists('backgroundBlur', $body);
    $hasModules = array_key_exists('modules', $body);

    if (!$hasBlur && !$hasModules) {
        json_error('No canvas updates were provided.', 422);
    }

    profile_canvas_request_version($body['canvasVersion'] ?? PROFILE_CANVAS_VERSION);

    $backgroundBlur = $hasBlur
        ? profile_canvas_background_blur($body['backgroundBlur'])
        : null;
    $anchorModuleId = $hasModules
        ? profile_canvas_anchor_module_id($body['anchorModuleId'] ?? null)
        : null;
    $movementContext = $hasModules
        ? profile_canvas_movement_context($body['movementContext'] ?? null, $anchorModuleId)
        : null;
    $placements = $hasModules
        ? profile_canvas_module_placements($body['modules'], $userId, $anchorModuleId, $movementContext)
        : null;

    $pdo = db();
    $pdo->beginTransaction();

    try {
        if ($backgroundBlur !== null) {
            db_query(
                'UPDATE profiles
                 SET profile_background_blur = :profile_background_blur,
                     profile_canvas_version = :profile_canvas_version,
                     updated_at = CURRENT_TIMESTAMP()
                 WHERE user_id = :user_id',
                [
                    'profile_background_blur' => $backgroundBlur,
                    'profile_canvas_version' => PROFILE_CANVAS_VERSION,
                    'user_id' => $userId,
                ]
            );
        }

        if (is_array($placements)) {
            profile_canvas_apply_module_placements($placements, $userId);
        }

        $pdo->commit();
    } catch (Throwable $exception) {
        $pdo->rollBack();
        throw $exception;
    }

    $preferences = profile_canvas_profile_preferences($userId);

    json_success([
        'backgroundBlur' => $preferences['backgroundBlur'],
        'canvasGlass' => $preferences['canvasGlass'],
        'canvasVersion' => $preferences['canvasVersion'],
        'modules' => profile_modules_for_owner($userId),
    ]);
}

function profile_canvas_draft_get(): void
{
    $session = require_authenticated_session();
    require_profile_modules_storage();
    require_profile_canvas_storage();
    require_profile_canvas_draft_storage();

    $userId = (int) $session['user_id'];
    ensure_profile_canvas_builtin_modules($userId);

    json_success(profile_canvas_draft_state($userId));
}

function profile_canvas_draft_update(): void
{
    $session = require_authenticated_session();
    require_csrf_token($session);
    require_profile_modules_storage();
    require_profile_canvas_storage();
    require_profile_canvas_draft_storage();

    $userId = (int) $session['user_id'];
    ensure_profile_canvas_builtin_modules($userId);

    $body = request_json_body();
    profile_module_require_object($body, 'JSON body');
    profile_module_reject_unknown_keys($body, ['canvasVersion', 'backgroundBlur', 'canvasGlass', 'modules', 'selectedModuleId']);
    profile_canvas_request_version($body['canvasVersion'] ?? PROFILE_CANVAS_VERSION);

    $state = profile_canvas_draft_state($userId);

    if (array_key_exists('backgroundBlur', $body)) {
        $state['backgroundBlur'] = profile_canvas_background_blur($body['backgroundBlur']);
    }

    if (array_key_exists('canvasGlass', $body)) {
        $state['canvasGlass'] = profile_canvas_glass_opacity($body['canvasGlass']);
    }

    if (array_key_exists('selectedModuleId', $body)) {
        $state['selectedModuleId'] = profile_canvas_draft_selected_module_id($body['selectedModuleId']);
    }

    if (array_key_exists('modules', $body)) {
        $state['modules'] = profile_canvas_draft_modules($body['modules'], $userId);
    }

    profile_canvas_save_draft_state($userId, $state);

    json_success(profile_canvas_draft_state($userId));
}

function profile_canvas_draft_delete(): void
{
    $session = require_authenticated_session();
    require_csrf_token($session);
    require_profile_modules_storage();
    require_profile_canvas_storage();
    require_profile_canvas_draft_storage();

    $userId = (int) $session['user_id'];
    db_query('DELETE FROM profile_canvas_drafts WHERE user_id = :user_id', ['user_id' => $userId]);

    json_success(profile_canvas_draft_default_state($userId));
}

function profile_canvas_draft_commit(): void
{
    $session = require_authenticated_session();
    require_csrf_token($session);
    require_profile_modules_storage();
    require_profile_canvas_storage();
    require_profile_canvas_draft_storage();

    $userId = (int) $session['user_id'];
    ensure_profile_canvas_builtin_modules($userId);
    $state = profile_canvas_draft_state($userId);
    $modules = profile_canvas_draft_modules($state['modules'] ?? [], $userId);

    $pdo = db();
    $pdo->beginTransaction();

    try {
        db_query(
            'UPDATE profiles
             SET profile_background_blur = :profile_background_blur,
                 profile_canvas_version = :profile_canvas_version,
                 profile_canvas_glass_opacity = :profile_canvas_glass_opacity,
                 updated_at = CURRENT_TIMESTAMP()
             WHERE user_id = :user_id',
            [
                'profile_background_blur' => $state['backgroundBlur'],
                'profile_canvas_version' => PROFILE_CANVAS_VERSION,
                'profile_canvas_glass_opacity' => profile_canvas_glass_opacity($state['canvasGlass'] ?? 58),
                'user_id' => $userId,
            ]
        );

        $placements = profile_canvas_commit_draft_modules($modules, $userId);
        $placements = profile_canvas_push_collisions($placements, null);
        profile_canvas_apply_module_placements($placements, $userId);

        db_query('DELETE FROM profile_canvas_drafts WHERE user_id = :user_id', ['user_id' => $userId]);
        $pdo->commit();
    } catch (Throwable $exception) {
        $pdo->rollBack();
        throw $exception;
    }

    $preferences = profile_canvas_profile_preferences($userId);

    json_success([
        'backgroundBlur' => $preferences['backgroundBlur'],
        'canvasGlass' => $preferences['canvasGlass'],
        'canvasVersion' => $preferences['canvasVersion'],
        'modules' => profile_modules_for_owner($userId),
    ]);
}

function profile_canvas_commit_draft_modules(array $modules, int $userId): array
{
    $records = profile_canvas_owner_module_records($userId);
    $seen = [];
    $placements = [];

    foreach ($modules as $index => $module) {
        if (($module['type'] ?? null) === PROFILE_CANVAS_PLACEHOLDER_MODULE_TYPE) {
            continue;
        }

        $draftId = profile_canvas_draft_module_id($module['id'] ?? null);
        $type = profile_module_type($module['type'] ?? null);
        $status = profile_module_status($module['status'] ?? 'active');
        $visibility = profile_module_visibility($module['visibility'] ?? 'public');
        $title = profile_module_title($module['title'] ?? null);
        $config = profile_module_config($type, $module['config'] ?? [], $userId);
        $pinned = profile_canvas_pinned($module['pinned'] ?? false);

        if ($type === PROFILE_INFO_MODULE_TYPE) {
            $visibility = 'public';
            $status = 'active';
            $pinned = true;
        }

        if ($draftId > 0 && isset($records[$draftId])) {
            $record = $records[$draftId];

            if ((string) $record['type'] !== $type) {
                json_error('Existing module type cannot be changed.', 422);
            }

            db_query(
                'UPDATE profile_modules
                 SET title = :title,
                     config_json = :config_json,
                     visibility = :visibility,
                     status = :status,
                     updated_at = CURRENT_TIMESTAMP()
                 WHERE id = :id
                   AND user_id = :user_id',
                [
                    'title' => $title,
                    'config_json' => json_encode($config, JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
                    'visibility' => $visibility,
                    'status' => $status,
                    'id' => $draftId,
                    'user_id' => $userId,
                ]
            );

            $moduleId = $draftId;
        } elseif ($status !== 'deleted') {
            if (profile_modules_active_count($userId) >= PROFILE_MODULE_MAX_PER_PROFILE) {
                json_error('Profiles can have up to 24 modules.', 422);
            }

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
                    'position' => $index + 1,
                    'status' => $status,
                    'schema_version' => PROFILE_MODULE_SCHEMA_VERSION,
                ]
            );
            $moduleId = (int) db()->lastInsertId();
        } else {
            continue;
        }

        $seen[$moduleId] = true;

        if ($status === 'deleted') {
            continue;
        }

        $layout = is_array($module['layout'] ?? null) && !array_is_list($module['layout'])
            ? $module['layout']
            : profile_canvas_default_layout_for_type($type, $index);
        $placement = profile_canvas_module_placement(
            [
                'id' => $moduleId,
                'column' => $layout['column'] ?? 1,
                'row' => $layout['row'] ?? 1,
                'colSpan' => $layout['colSpan'] ?? 1,
                'rowSpan' => $layout['rowSpan'] ?? 1,
            ],
            [
                'id' => $moduleId,
                'type' => $type,
            ],
            $visibility === 'public',
            $pinned
        );
        $placements[] = $placement;
    }

    foreach ($records as $id => $record) {
        if (isset($seen[$id]) || (string) $record['status'] === 'deleted') {
            continue;
        }

        $placements[] = profile_canvas_existing_module_placement($record, count($placements));
    }

    return $placements;
}

function profile_canvas_default_layout_for_type(string $type, int $index): array
{
    $size = profile_canvas_default_size($type, $index);
    [$colSpan, $rowSpan] = array_map('intval', explode('x', $size, 2));

    return [
        'column' => $type === PROFILE_INFO_MODULE_TYPE ? 3 : 1,
        'row' => $type === PROFILE_INFO_MODULE_TYPE ? 1 : min(PROFILE_CANVAS_ROWS, $index + 1),
        'colSpan' => $colSpan,
        'rowSpan' => $rowSpan,
    ];
}

function profile_canvas_draft_state(int $userId): array
{
    $row = profile_canvas_draft_row($userId);

    if ($row === null) {
        return profile_canvas_draft_default_state($userId);
    }

    $state = profile_module_json((string) $row['draft_json']);
    $default = profile_canvas_draft_default_state($userId);

    return [
        'backgroundBlur' => profile_canvas_background_blur($state['backgroundBlur'] ?? $default['backgroundBlur']),
        'canvasGlass' => profile_canvas_glass_opacity($state['canvasGlass'] ?? $default['canvasGlass']),
        'canvasVersion' => PROFILE_CANVAS_VERSION,
        'modules' => profile_canvas_draft_modules($state['modules'] ?? $default['modules'], $userId),
        'selectedModuleId' => profile_canvas_draft_selected_module_id($state['selectedModuleId'] ?? null),
        'updatedAt' => $row['updated_at'] ?? null,
    ];
}

function profile_canvas_draft_default_state(int $userId): array
{
    $preferences = profile_canvas_profile_preferences($userId);

    return [
        'backgroundBlur' => $preferences['backgroundBlur'],
        'canvasGlass' => $preferences['canvasGlass'],
        'canvasVersion' => PROFILE_CANVAS_VERSION,
        'modules' => profile_modules_for_owner($userId),
        'selectedModuleId' => null,
        'updatedAt' => null,
    ];
}

function profile_canvas_draft_row(int $userId): ?array
{
    $statement = db_query(
        'SELECT draft_json, updated_at
         FROM profile_canvas_drafts
         WHERE user_id = :user_id
         LIMIT 1',
        ['user_id' => $userId]
    );
    $row = $statement->fetch();

    return is_array($row) ? $row : null;
}

function profile_canvas_save_draft_state(int $userId, array $state): void
{
    $state['canvasVersion'] = PROFILE_CANVAS_VERSION;
    $payload = json_encode($state, JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);

    db_query(
        'INSERT INTO profile_canvas_drafts
            (user_id, draft_json, selected_module_id, updated_at)
         VALUES
            (:user_id, :draft_json, :selected_module_id, CURRENT_TIMESTAMP())
         ON DUPLICATE KEY UPDATE
            draft_json = VALUES(draft_json),
            selected_module_id = VALUES(selected_module_id),
            updated_at = CURRENT_TIMESTAMP()',
        [
            'user_id' => $userId,
            'draft_json' => $payload,
            'selected_module_id' => $state['selectedModuleId'] === null ? null : (string) $state['selectedModuleId'],
        ]
    );
}

function profile_canvas_draft_modules(mixed $value, int $userId): array
{
    if (!is_array($value) || !array_is_list($value)) {
        json_error('Canvas draft modules must be an array.', 422);
    }

    $modules = [];

    foreach ($value as $index => $item) {
        if (!is_array($item) || array_is_list($item)) {
            json_error('Canvas draft module must be an object.', 422);
        }

        profile_module_reject_unknown_keys($item, ['id', 'draftId', 'type', 'title', 'config', 'visibility', 'position', 'pinned', 'layout', 'status', 'schemaVersion', 'createdAt', 'updatedAt']);
        $type = profile_canvas_draft_module_type($item['type'] ?? null);
        $layout = profile_canvas_draft_module_layout($type, $item['layout'] ?? null, $index);
        $config = $type === PROFILE_CANVAS_PLACEHOLDER_MODULE_TYPE
            ? profile_canvas_placeholder_config($item['config'] ?? [], $layout)
            : profile_module_config($type, $item['config'] ?? [], $userId);

        $modules[] = [
            'id' => profile_canvas_draft_module_id($item['id'] ?? null),
            'type' => $type,
            'title' => profile_module_title($item['title'] ?? null),
            'config' => $config,
            'visibility' => $type === PROFILE_CANVAS_PLACEHOLDER_MODULE_TYPE
                ? 'draft'
                : profile_module_visibility($item['visibility'] ?? 'public'),
            'position' => $index + 1,
            'pinned' => $type === PROFILE_CANVAS_PLACEHOLDER_MODULE_TYPE
                ? false
                : profile_canvas_pinned($item['pinned'] ?? false),
            'layout' => $layout,
            'status' => $type === PROFILE_CANVAS_PLACEHOLDER_MODULE_TYPE
                ? 'active'
                : profile_module_status($item['status'] ?? 'active'),
            'schemaVersion' => PROFILE_MODULE_SCHEMA_VERSION,
            'createdAt' => $item['createdAt'] ?? null,
            'updatedAt' => $item['updatedAt'] ?? null,
        ];
    }

    return $modules;
}

function profile_canvas_draft_module_type(mixed $value): string
{
    if (!is_string($value)) {
        json_error('Choose a supported module type.', 422);
    }

    $type = strtolower(trim($value));

    if ($type === PROFILE_CANVAS_PLACEHOLDER_MODULE_TYPE) {
        return $type;
    }

    return profile_module_type($type);
}

function profile_canvas_placeholder_config(mixed $value, array $layout): array
{
    if (!is_array($value) || ($value !== [] && array_is_list($value))) {
        json_error('Module config must be an object.', 422);
    }

    profile_module_reject_unknown_keys($value, ['canvasSize', 'configured', 'placeholder']);

    if (array_key_exists('configured', $value) && $value['configured'] !== false) {
        json_error('Placeholder modules must stay unconfigured.', 422);
    }

    if (array_key_exists('placeholder', $value) && $value['placeholder'] !== true) {
        json_error('Placeholder module config is invalid.', 422);
    }

    $size = "{$layout['colSpan']}x{$layout['rowSpan']}";

    if (array_key_exists('canvasSize', $value)) {
        if (!is_string($value['canvasSize']) || !in_array($value['canvasSize'], profile_canvas_allowed_sizes(PROFILE_CANVAS_PLACEHOLDER_MODULE_TYPE), true)) {
            json_error('Choose a supported canvas size.', 422);
        }

        $size = $value['canvasSize'];
    }

    return [
        'configured' => false,
        'placeholder' => true,
        'canvasSize' => $size,
    ];
}

function profile_canvas_draft_module_layout(string $type, mixed $value, int $index): array
{
    if (!is_array($value) || array_is_list($value)) {
        return profile_canvas_default_layout_for_type($type, $index);
    }

    profile_module_reject_unknown_keys($value, ['column', 'row', 'colSpan', 'rowSpan']);

    $placement = profile_canvas_module_placement(
        [
            'id' => 1,
            'column' => $value['column'] ?? 1,
            'row' => $value['row'] ?? 1,
            'colSpan' => $value['colSpan'] ?? 1,
            'rowSpan' => $value['rowSpan'] ?? 1,
        ],
        [
            'id' => 1,
            'type' => $type,
        ],
        true,
        false
    );

    return [
        'column' => $placement['column'],
        'row' => $placement['row'],
        'colSpan' => $placement['colSpan'],
        'rowSpan' => $placement['rowSpan'],
    ];
}

function profile_canvas_draft_module_id(mixed $value): int
{
    if (is_int($value)) {
        return $value;
    }

    if (is_string($value) && preg_match('/^-?[0-9]+$/', $value) === 1) {
        return (int) $value;
    }

    json_error('Canvas draft module id is invalid.', 422);
}

function profile_canvas_draft_selected_module_id(mixed $value): int|string|null
{
    if ($value === null || $value === '') {
        return null;
    }

    if (is_int($value) || is_string($value)) {
        return $value;
    }

    json_error('Selected module is invalid.', 422);
}

function require_profile_modules_storage(): void
{
    if (!profile_modules_storage_exists()) {
        json_error('Profile module storage is not ready. Run pending migrations.', 503);
    }
}

function require_profile_canvas_storage(): void
{
    if (!profile_canvas_storage_exists()) {
        json_error('Profile canvas storage is not ready. Run pending migrations.', 503);
    }
}

function require_profile_canvas_draft_storage(): void
{
    if (!profile_canvas_draft_storage_exists()) {
        json_error('Profile canvas draft storage is not ready. Run pending migrations.', 503);
    }
}

function profile_modules_storage_exists(): bool
{
    return database_table_exists('profile_modules');
}

function profile_canvas_draft_storage_exists(): bool
{
    return database_table_exists('profile_canvas_drafts');
}

function profile_canvas_storage_exists(): bool
{
    return database_column_exists('profiles', 'profile_background_blur')
        && database_column_exists('profiles', 'profile_canvas_version')
        && database_column_exists('profiles', 'profile_canvas_glass_opacity')
        && database_column_exists('profile_modules', 'grid_column')
        && database_column_exists('profile_modules', 'grid_row')
        && database_column_exists('profile_modules', 'grid_col_span')
        && database_column_exists('profile_modules', 'grid_row_span')
        && database_column_exists('profile_modules', 'grid_pinned');
}

function profile_canvas_profile_preferences(int $userId): array
{
    $glassSelect = database_column_exists('profiles', 'profile_canvas_glass_opacity')
        ? 'profile_canvas_glass_opacity'
        : '58 AS profile_canvas_glass_opacity';
    $statement = db_query(
        "SELECT profile_background_blur, profile_canvas_version, {$glassSelect}
         FROM profiles
         WHERE user_id = :user_id
         LIMIT 1",
        ['user_id' => $userId]
    );
    $row = $statement->fetch();

    return [
        'backgroundBlur' => is_array($row)
            ? profile_canvas_background_blur($row['profile_background_blur'] ?? null)
            : 'medium',
        'canvasVersion' => is_array($row)
            ? profile_canvas_output_version($row['profile_canvas_version'] ?? null)
            : PROFILE_CANVAS_VERSION,
        'canvasGlass' => is_array($row)
            ? profile_canvas_glass_opacity($row['profile_canvas_glass_opacity'] ?? 58)
            : 58,
    ];
}

function profile_canvas_glass_opacity(mixed $value): int
{
    if (is_int($value)) {
        return max(0, min(92, $value));
    }

    if (is_string($value) && preg_match('/^[0-9]+$/', $value) === 1) {
        return max(0, min(92, (int) $value));
    }

    json_error('Choose a supported canvas glass opacity.', 422);
}

function profile_canvas_request_version(mixed $value): int
{
    if (is_int($value) && $value === PROFILE_CANVAS_VERSION) {
        return PROFILE_CANVAS_VERSION;
    }

    if (is_string($value) && $value === (string) PROFILE_CANVAS_VERSION) {
        return PROFILE_CANVAS_VERSION;
    }

    if ($value === 1 || $value === '1') {
        return PROFILE_CANVAS_VERSION;
    }

    json_error('Profile canvas version is not supported.', 422);
}

function profile_canvas_output_version(mixed $value): int
{
    return (int) $value === PROFILE_CANVAS_VERSION
        ? PROFILE_CANVAS_VERSION
        : PROFILE_CANVAS_VERSION;
}

function profile_canvas_background_blur(mixed $value): string
{
    if (!is_string($value)) {
        json_error('Choose a supported background blur.', 422);
    }

    $blur = strtolower(trim($value));

    if (!in_array($blur, PROFILE_BACKGROUND_BLUR_LEVELS, true)) {
        json_error('Choose a supported background blur.', 422);
    }

    return $blur;
}

function profile_canvas_anchor_module_id(mixed $value): ?int
{
    if ($value === null || $value === '') {
        return null;
    }

    return profile_module_id($value);
}

function profile_canvas_movement_context(mixed $value, ?int $anchorModuleId): ?array
{
    if ($value === null) {
        return null;
    }

    if (!is_array($value) || array_is_list($value)) {
        json_error('Canvas movement context must be an object.', 422);
    }

    profile_module_reject_unknown_keys($value, ['anchorModuleId', 'from', 'to']);
    $contextAnchorModuleId = profile_canvas_anchor_module_id($value['anchorModuleId'] ?? null);

    if ($contextAnchorModuleId === null) {
        json_error('Canvas movement context anchor is invalid.', 422);
    }

    if ($anchorModuleId !== null && $contextAnchorModuleId !== $anchorModuleId) {
        json_error('Canvas movement context anchor does not match the canvas anchor.', 422);
    }

    return [
        'anchorModuleId' => $contextAnchorModuleId,
        'from' => profile_canvas_movement_point($value['from'] ?? null, 'from'),
        'to' => profile_canvas_movement_point($value['to'] ?? null, 'to'),
    ];
}

function profile_canvas_movement_point(mixed $value, string $label): array
{
    if (!is_array($value) || array_is_list($value)) {
        json_error("Canvas movement {$label} point is invalid.", 422);
    }

    profile_module_reject_unknown_keys($value, ['column', 'row']);

    return [
        'column' => profile_canvas_position_value($value['column'] ?? null, 'Column', PROFILE_CANVAS_COLUMNS),
        'row' => profile_canvas_position_value($value['row'] ?? null, 'Row', PROFILE_CANVAS_ROWS),
    ];
}

function profile_canvas_module_placements(mixed $value, int $userId, ?int $anchorModuleId, ?array $movementContext = null): array
{
    if (!is_array($value) || !array_is_list($value)) {
        json_error('Canvas modules must be an array.', 422);
    }

    $records = profile_canvas_owner_module_records($userId);

    if (count($value) !== count($records)) {
        json_error('Canvas layout must include every profile module.', 422);
    }

    if ($anchorModuleId !== null && !isset($records[$anchorModuleId])) {
        json_error('Canvas anchor module is unavailable.', 422);
    }

    $placements = [];
    $seen = [];

    foreach ($value as $item) {
        if (!is_array($item) || array_is_list($item)) {
            json_error('Canvas module placement must be an object.', 422);
        }

        profile_module_reject_unknown_keys($item, ['id', 'column', 'row', 'colSpan', 'rowSpan', 'visible', 'pinned']);

        $id = profile_module_id($item['id'] ?? null);

        if (isset($seen[$id])) {
            json_error('Canvas layout cannot contain duplicate modules.', 422);
        }

        if (!isset($records[$id])) {
            json_error('Canvas layout contains unavailable modules.', 422);
        }

        $record = $records[$id];
        $type = (string) $record['type'];
        $visible = profile_canvas_visibility($item['visible'] ?? true);
        $pinned = profile_canvas_pinned($item['pinned'] ?? false);

        if ($type === PROFILE_INFO_MODULE_TYPE && !$visible) {
            json_error('Profile info cannot be hidden.', 422);
        }

        $placements[] = profile_canvas_module_placement($item, $record, $visible, $pinned);
        $seen[$id] = true;
    }

    $placements = profile_canvas_push_collisions($placements, $anchorModuleId, $movementContext);

    usort(
        $placements,
        static function (array $first, array $second): int {
            $visibleCompare = (int) (!$first['visible']) <=> (int) (!$second['visible']);

            if ($visibleCompare !== 0) {
                return $visibleCompare;
            }

            $rowCompare = $first['row'] <=> $second['row'];

            if ($rowCompare !== 0) {
                return $rowCompare;
            }

            $columnCompare = $first['column'] <=> $second['column'];

            if ($columnCompare !== 0) {
                return $columnCompare;
            }

            return profile_module_default_sort_order($first['type']) <=> profile_module_default_sort_order($second['type']);
        }
    );

    return $placements;
}

function profile_canvas_owner_module_records(int $userId): array
{
    $statement = db_query(
        'SELECT id, type, visibility, status, position, grid_column, grid_row, grid_col_span, grid_row_span, grid_pinned
         FROM profile_modules
         WHERE user_id = :user_id
           AND status <> :deleted_status
         ORDER BY position ASC, id ASC',
        [
            'user_id' => $userId,
            'deleted_status' => 'deleted',
        ]
    );

    $records = [];

    foreach ($statement->fetchAll() as $row) {
        if (!profile_module_type_is_supported($row['type'] ?? null)) {
            continue;
        }

        $records[(int) $row['id']] = $row;
    }

    return $records;
}

function profile_canvas_module_placement(array $item, array $record, bool $visible, bool $pinned = false): array
{
    $type = (string) $record['type'];
    $colSpan = profile_canvas_int_value($item['colSpan'] ?? null, 'Column span');
    $rowSpan = profile_canvas_int_value($item['rowSpan'] ?? null, 'Row span');
    [$colSpan, $rowSpan] = profile_canvas_normalize_span($type, $colSpan, $rowSpan);

    if (!profile_canvas_span_allowed($type, $colSpan, $rowSpan)) {
        json_error('Canvas span is not allowed for this module.', 422);
    }

    $column = profile_canvas_position_value($item['column'] ?? null, 'Column', PROFILE_CANVAS_COLUMNS);
    $row = profile_canvas_position_value($item['row'] ?? null, 'Row', PROFILE_CANVAS_ROWS);
    $column = min($column, PROFILE_CANVAS_COLUMNS - $colSpan + 1);
    $row = min($row, PROFILE_CANVAS_ROWS - $rowSpan + 1);

    return [
        'id' => (int) $record['id'],
        'type' => $type,
        'column' => max(1, $column),
        'row' => max(1, $row),
        'colSpan' => $colSpan,
        'rowSpan' => $rowSpan,
        'visible' => $visible,
        'pinned' => $pinned,
    ];
}

function profile_canvas_visibility(mixed $value): bool
{
    if (is_bool($value)) {
        return $value;
    }

    json_error('Canvas module visibility is invalid.', 422);
}

function profile_canvas_pinned(mixed $value): bool
{
    if (is_bool($value)) {
        return $value;
    }

    json_error('Canvas module pin state is invalid.', 422);
}

function profile_canvas_span_value(mixed $value, string $label): int
{
    $number = profile_canvas_int_value($value, $label);

    return max(1, min(PROFILE_CANVAS_PROFILE_INFO_MAX_COLUMNS, $number));
}

function profile_canvas_position_value(mixed $value, string $label, int $max): int
{
    $number = profile_canvas_int_value($value, $label);

    return max(1, min($max, $number));
}

function profile_canvas_int_value(mixed $value, string $label): int
{
    if (is_int($value)) {
        return $value;
    }

    if (is_string($value) && preg_match('/^-?[0-9]+$/', $value) === 1) {
        return (int) $value;
    }

    json_error("{$label} is invalid.", 422);
}

function profile_canvas_span_allowed(string $type, int $colSpan, int $rowSpan): bool
{
    $size = "{$colSpan}x{$rowSpan}";

    return in_array($size, profile_canvas_allowed_sizes($type), true);
}

function profile_canvas_allowed_sizes(string $type): array
{
    $uploadedImageSizes = profile_canvas_size_range(1, 6, 1, 6);
    $gallerySlideshowSizes = profile_canvas_size_range(2, 6, 2, 6);
    $textSizes = profile_canvas_size_range(3, 4, 2, 5);

    return match ($type) {
        PROFILE_INFO_MODULE_TYPE => ['3x2', '3x3', '4x3', '6x3', '8x3', '8x4'],
        'about', 'custom_text', PROFILE_TEXT_MODULE_TYPE => $textSizes,
        'links', PROFILE_CONNECTIONS_MODULE_TYPE => ['3x2', '4x2', '3x3', '3x4'],
        'featured_badges', PROFILE_BADGE_DISPLAY_MODULE_TYPE => ['2x2', '3x2'],
        PROFILE_FEATURED_POST_MODULE_TYPE => ['3x4', '4x5'],
        PROFILE_FEATURED_ROOM_MODULE_TYPE => ['3x1', '4x2'],
        PROFILE_GALLERY_MEDIA_MODULE_TYPE, 'gallery_slideshow' => $gallerySlideshowSizes,
        'uploaded_image' => $uploadedImageSizes,
        'gallery_feed' => ['3x6', '4x6'],
        PROFILE_CREATOR_LIVE_MODULE_TYPE, 'twitch_channel' => ['2x1', '3x2', '4x3', '5x3', '6x4'],
        'youtube_video' => ['3x4', '4x3', '6x4'],
        'youtube_stream' => ['4x3', '5x3', '6x4'],
        'youtube_playlist' => ['4x3', '5x3', '2x4', '3x6'],
        'uploaded_video' => ['4x3', '6x4', '4x6'],
        PROFILE_MUSIC_MODULE_TYPE,
        'spotify_song',
        'apple_music_song',
        'youtube_music_song' => ['2x1', '3x2', '4x2', '4x3', '4x4'],
        'spotify_playlist',
        'apple_music_playlist',
        'youtube_music_playlist' => ['3x2', '4x3', '3x6', '4x6'],
        'spotify_artist',
        'apple_music_artist',
        'youtube_music_artist' => ['3x2', '4x3', '6x4'],
        PROFILE_GITHUB_REPO_MODULE_TYPE => ['3x2', '4x3', '6x4'],
        PROFILE_ACTIVITY_MODULE_TYPE => ['3x4', '4x6'],
        PROFILE_CANVAS_PLACEHOLDER_MODULE_TYPE => $uploadedImageSizes,
        default => ['1x1'],
    };
}

function profile_canvas_size_range(int $minColumns, int $maxColumns, int $minRows, int $maxRows): array
{
    $sizes = [];

    for ($column = $minColumns; $column <= $maxColumns; $column++) {
        for ($row = $minRows; $row <= $maxRows; $row++) {
            $sizes[] = "{$column}x{$row}";
        }
    }

    return $sizes;
}

function profile_canvas_normalize_span(string $type, int $colSpan, int $rowSpan): array
{
    if ($type === PROFILE_CREATOR_LIVE_MODULE_TYPE && $colSpan === 3 && $rowSpan === 5) {
        return [5, 3];
    }

    $maxColumns = $type === PROFILE_INFO_MODULE_TYPE
        ? PROFILE_CANVAS_PROFILE_INFO_MAX_COLUMNS
        : PROFILE_CANVAS_MAX_MODULE_SPAN;

    return [
        max(1, min($maxColumns, $colSpan)),
        max(1, min(PROFILE_CANVAS_MAX_MODULE_SPAN, $rowSpan)),
    ];
}

function profile_canvas_push_collisions(array $placements, ?int $anchorModuleId, ?array $movementContext = null): array
{
    $visible = [];
    $hidden = [];

    foreach ($placements as $placement) {
        $placement['pinned'] = profile_module_grid_pinned($placement['pinned'] ?? false);

        if ($placement['visible']) {
            $visible[] = $placement;
        } else {
            $hidden[] = $placement;
        }
    }

    $anchor = null;

    foreach ($visible as $placement) {
        if ($anchorModuleId !== null && $placement['id'] === $anchorModuleId) {
            $anchor = $placement;
            break;
        }
    }

    if ($anchor !== null && $movementContext !== null && $anchor['pinned']) {
        json_error('Pinned modules must be unpinned before moving.', 422);
    }

    usort(
        $visible,
        static fn (array $first, array $second): int => profile_canvas_placement_sort($first, $second)
    );

    $occupied = [];
    $pushed = [];
    $placedIds = [];

    foreach ($visible as $placement) {
        if (!$placement['pinned']) {
            continue;
        }

        if (!profile_canvas_layout_fits($placement, $occupied)) {
            json_error('Pinned canvas modules overlap. Unpin or move one module before saving.', 422);
        }

        profile_canvas_occupy_layout($placement, $occupied);
        $pushed[] = $placement;
        $placedIds[$placement['id']] = true;
    }

    $anchorLayout = null;

    if ($anchor !== null && !isset($placedIds[$anchor['id']])) {
        $anchorLayout = profile_canvas_anchor_layout(
            $anchor,
            $visible,
            $occupied,
            $movementContext
        );

        if ($anchorLayout === null) {
            json_error(
                sprintf('Canvas layout does not fit the %d by %d grid.', PROFILE_CANVAS_COLUMNS, PROFILE_CANVAS_ROWS),
                422
            );
        }

        profile_canvas_occupy_layout($anchorLayout, $occupied);
        $pushed[] = $anchorLayout;
        $placedIds[$anchor['id']] = true;
    }

    $movable = array_values(array_filter(
        $visible,
        static fn (array $placement): bool => !isset($placedIds[$placement['id']])
    ));

    usort(
        $movable,
        static function (array $first, array $second) use ($anchorLayout, $movementContext): int {
            if ($anchorLayout !== null && $movementContext !== null) {
                $firstIntent = profile_canvas_displacement_intent($anchorLayout, $first, $movementContext);
                $secondIntent = profile_canvas_displacement_intent($anchorLayout, $second, $movementContext);

                if (($firstIntent !== null) !== ($secondIntent !== null)) {
                    return $firstIntent !== null ? -1 : 1;
                }
            }

            return profile_canvas_placement_sort($first, $second);
        }
    );

    foreach ($movable as $placement) {
        $intent = $anchorLayout !== null && $movementContext !== null
            ? profile_canvas_displacement_intent($anchorLayout, $placement, $movementContext)
            : null;
        $layout = profile_canvas_layout_fits($placement, $occupied)
            ? $placement
            : profile_canvas_next_available_layout($placement, $occupied, $intent);

        if ($layout === null) {
            json_error(
                sprintf('Canvas layout does not fit the %d by %d grid.', PROFILE_CANVAS_COLUMNS, PROFILE_CANVAS_ROWS),
                422
            );
        }

        profile_canvas_occupy_layout($layout, $occupied);
        $pushed[] = $layout;
    }

    return array_merge($pushed, $hidden);
}

function profile_canvas_placement_sort(array $first, array $second): int
{
    $rowCompare = $first['row'] <=> $second['row'];

    if ($rowCompare !== 0) {
        return $rowCompare;
    }

    $columnCompare = $first['column'] <=> $second['column'];

    if ($columnCompare !== 0) {
        return $columnCompare;
    }

    return profile_module_default_sort_order($first['type']) <=> profile_module_default_sort_order($second['type']);
}

function profile_canvas_anchor_layout(array $anchor, array $visible, array $fixedOccupied, ?array $movementContext): ?array
{
    if ($movementContext === null) {
        return profile_canvas_layout_fits($anchor, $fixedOccupied)
            ? $anchor
            : profile_canvas_next_available_layout($anchor, $fixedOccupied);
    }

    $intent = profile_canvas_anchor_intent($movementContext);
    $targetLayout = $anchor;

    if (!profile_canvas_layout_fits($targetLayout, $fixedOccupied)) {
        return profile_canvas_next_available_layout($targetLayout, $fixedOccupied, $intent);
    }

    if (!profile_canvas_anchor_crossed_collision_half($targetLayout, $visible, $movementContext)) {
        $fromLayout = [
            ...$targetLayout,
            'column' => min(
                PROFILE_CANVAS_COLUMNS - $targetLayout['colSpan'] + 1,
                max(1, (int) $movementContext['from']['column'])
            ),
            'row' => min(
                PROFILE_CANVAS_ROWS - $targetLayout['rowSpan'] + 1,
                max(1, (int) $movementContext['from']['row'])
            ),
        ];

        if (profile_canvas_layout_fits($fromLayout, $fixedOccupied)) {
            return $fromLayout;
        }
    }

    return $targetLayout;
}

function profile_canvas_anchor_crossed_collision_half(array $anchor, array $visible, array $movementContext): bool
{
    foreach ($visible as $placement) {
        if ($placement['id'] === $anchor['id'] || !$placement['visible'] || $placement['pinned']) {
            continue;
        }

        if (!profile_canvas_layout_intersects($anchor, $placement)) {
            continue;
        }

        if (profile_canvas_displacement_intent($anchor, $placement, $movementContext) === null) {
            return false;
        }
    }

    return true;
}

function profile_canvas_anchor_intent(array $movementContext): ?array
{
    $deltaColumn = (int) $movementContext['to']['column'] - (int) $movementContext['from']['column'];
    $deltaRow = (int) $movementContext['to']['row'] - (int) $movementContext['from']['row'];

    if (abs($deltaColumn) >= abs($deltaRow) && $deltaColumn !== 0) {
        return ['dx' => $deltaColumn > 0 ? 1 : -1, 'dy' => 0];
    }

    if ($deltaRow !== 0) {
        return ['dx' => 0, 'dy' => $deltaRow > 0 ? 1 : -1];
    }

    return null;
}

function profile_canvas_displacement_intent(array $anchor, array $placement, array $movementContext): ?array
{
    if (!profile_canvas_layout_intersects($anchor, $placement)) {
        return null;
    }

    $deltaColumn = (int) $movementContext['to']['column'] - (int) $movementContext['from']['column'];
    $deltaRow = (int) $movementContext['to']['row'] - (int) $movementContext['from']['row'];

    if (abs($deltaColumn) >= abs($deltaRow) && $deltaColumn !== 0) {
        $overlap = profile_canvas_axis_overlap($anchor, $placement, 'column');

        if ($overlap * 2 <= $placement['colSpan']) {
            return null;
        }

        return ['dx' => $deltaColumn > 0 ? -1 : 1, 'dy' => 0];
    }

    if ($deltaRow !== 0) {
        $overlap = profile_canvas_axis_overlap($anchor, $placement, 'row');

        if ($overlap * 2 <= $placement['rowSpan']) {
            return null;
        }

        return ['dx' => 0, 'dy' => $deltaRow > 0 ? -1 : 1];
    }

    return null;
}

function profile_canvas_axis_overlap(array $first, array $second, string $axis): int
{
    if ($axis === 'column') {
        $start = max($first['column'], $second['column']);
        $end = min(
            $first['column'] + $first['colSpan'] - 1,
            $second['column'] + $second['colSpan'] - 1
        );

        return max(0, $end - $start + 1);
    }

    $start = max($first['row'], $second['row']);
    $end = min(
        $first['row'] + $first['rowSpan'] - 1,
        $second['row'] + $second['rowSpan'] - 1
    );

    return max(0, $end - $start + 1);
}

function profile_canvas_layout_intersects(array $first, array $second): bool
{
    return $first['column'] < $second['column'] + $second['colSpan']
        && $first['column'] + $first['colSpan'] > $second['column']
        && $first['row'] < $second['row'] + $second['rowSpan']
        && $first['row'] + $first['rowSpan'] > $second['row'];
}

function profile_canvas_next_available_layout(array $placement, array $occupied, ?array $intent = null): ?array
{
    $maxColumn = PROFILE_CANVAS_COLUMNS - $placement['colSpan'] + 1;
    $maxRow = PROFILE_CANVAS_ROWS - $placement['rowSpan'] + 1;
    $baseColumn = min(max(1, (int) $placement['column']), $maxColumn);
    $baseRow = min(max(1, (int) $placement['row']), $maxRow);
    $candidates = [];

    if ($intent !== null) {
        foreach (profile_canvas_directional_candidates($baseColumn, $baseRow, $maxColumn, $maxRow, $intent) as $candidate) {
            $candidates[] = $candidate;
        }
    }

    foreach (profile_canvas_nearest_candidates($baseColumn, $baseRow, $maxColumn, $maxRow) as $candidate) {
        $candidates[] = $candidate;
    }

    $seen = [];

    foreach ($candidates as $candidatePoint) {
        $key = "{$candidatePoint['column']}:{$candidatePoint['row']}";

        if (isset($seen[$key])) {
            continue;
        }

        $seen[$key] = true;
        $candidate = [
            ...$placement,
            'column' => $candidatePoint['column'],
            'row' => $candidatePoint['row'],
        ];

        if (profile_canvas_layout_fits($candidate, $occupied)) {
            return $candidate;
        }
    }

    return null;
}

function profile_canvas_directional_candidates(int $baseColumn, int $baseRow, int $maxColumn, int $maxRow, array $intent): array
{
    $candidates = [];
    $dx = (int) ($intent['dx'] ?? 0);
    $dy = (int) ($intent['dy'] ?? 0);

    if ($dx !== 0) {
        for ($column = $baseColumn + $dx; $column >= 1 && $column <= $maxColumn; $column += $dx) {
            $candidates[] = ['column' => $column, 'row' => $baseRow];
        }

        foreach (profile_canvas_nearby_rows($baseRow, $maxRow) as $row) {
            if ($row === $baseRow) {
                continue;
            }

            $candidates[] = ['column' => $baseColumn, 'row' => $row];
        }
    }

    if ($dy !== 0) {
        for ($row = $baseRow + $dy; $row >= 1 && $row <= $maxRow; $row += $dy) {
            $candidates[] = ['column' => $baseColumn, 'row' => $row];
        }

        foreach (profile_canvas_nearby_columns($baseColumn, $maxColumn) as $column) {
            if ($column === $baseColumn) {
                continue;
            }

            $candidates[] = ['column' => $column, 'row' => $baseRow];
        }
    }

    return $candidates;
}

function profile_canvas_nearest_candidates(int $baseColumn, int $baseRow, int $maxColumn, int $maxRow): array
{
    $candidates = [];

    foreach (profile_canvas_same_row_sideways_columns($baseColumn, $maxColumn) as $column) {
        $candidates[] = ['column' => $column, 'row' => $baseRow];
    }

    foreach (profile_canvas_nearby_rows($baseRow, $maxRow) as $row) {
        if ($row === $baseRow) {
            continue;
        }

        foreach (profile_canvas_nearby_columns($baseColumn, $maxColumn) as $column) {
            $candidates[] = ['column' => $column, 'row' => $row];
        }
    }

    return $candidates;
}

function profile_canvas_same_row_sideways_columns(int $baseColumn, int $maxColumn): array
{
    $columns = [];

    for ($distance = 1; $distance <= $maxColumn; $distance++) {
        $right = $baseColumn + $distance;
        $left = $baseColumn - $distance;

        if ($right <= $maxColumn) {
            $columns[] = $right;
        }

        if ($left >= 1) {
            $columns[] = $left;
        }
    }

    return $columns;
}

function profile_canvas_nearby_columns(int $baseColumn, int $maxColumn): array
{
    $columns = [$baseColumn];

    for ($distance = 1; $distance <= $maxColumn; $distance++) {
        $right = $baseColumn + $distance;
        $left = $baseColumn - $distance;

        if ($right <= $maxColumn) {
            $columns[] = $right;
        }

        if ($left >= 1) {
            $columns[] = $left;
        }
    }

    return array_values(array_unique($columns));
}

function profile_canvas_nearby_rows(int $baseRow, int $maxRow): array
{
    $rows = [$baseRow];

    for ($distance = 1; $distance <= $maxRow; $distance++) {
        $down = $baseRow + $distance;
        $up = $baseRow - $distance;

        if ($down <= $maxRow) {
            $rows[] = $down;
        }

        if ($up >= 1) {
            $rows[] = $up;
        }
    }

    return array_values(array_unique($rows));
}

function profile_canvas_layout_fits(array $placement, array $occupied): bool
{
    if (
        $placement['column'] < 1
        || $placement['row'] < 1
        || $placement['column'] + $placement['colSpan'] - 1 > PROFILE_CANVAS_COLUMNS
        || $placement['row'] + $placement['rowSpan'] - 1 > PROFILE_CANVAS_ROWS
    ) {
        return false;
    }

    for ($row = $placement['row']; $row < $placement['row'] + $placement['rowSpan']; $row++) {
        for ($column = $placement['column']; $column < $placement['column'] + $placement['colSpan']; $column++) {
            if (isset($occupied["{$column}:{$row}"])) {
                return false;
            }
        }
    }

    return true;
}

function profile_canvas_occupy_layout(array $placement, array &$occupied): void
{
    for ($row = $placement['row']; $row < $placement['row'] + $placement['rowSpan']; $row++) {
        for ($column = $placement['column']; $column < $placement['column'] + $placement['colSpan']; $column++) {
            $occupied["{$column}:{$row}"] = true;
        }
    }
}

function profile_canvas_apply_module_placements(array $placements, int $userId): void
{
    foreach ($placements as $index => $placement) {
        db_query(
            'UPDATE profile_modules
             SET position = :position,
                 grid_column = :grid_column,
                 grid_row = :grid_row,
                 grid_col_span = :grid_col_span,
                 grid_row_span = :grid_row_span,
                 grid_pinned = :grid_pinned,
                 visibility = :visibility,
                 status = :status,
                 updated_at = CURRENT_TIMESTAMP()
             WHERE id = :id
               AND user_id = :user_id
               AND status <> :deleted_status',
            [
                'position' => $index + 1,
                'grid_column' => $placement['column'],
                'grid_row' => $placement['row'],
                'grid_col_span' => $placement['colSpan'],
                'grid_row_span' => $placement['rowSpan'],
                'grid_pinned' => $placement['pinned'] ? 1 : 0,
                'visibility' => $placement['visible'] ? 'public' : 'hidden',
                'status' => 'active',
                'id' => $placement['id'],
                'user_id' => $userId,
                'deleted_status' => 'deleted',
            ]
        );
    }
}

function profile_canvas_reflow_existing_modules(int $userId, ?int $anchorModuleId): void
{
    $records = profile_canvas_owner_module_records($userId);
    $placements = [];

    foreach (array_values($records) as $index => $record) {
        $placements[] = profile_canvas_existing_module_placement($record, $index);
    }

    $placements = profile_canvas_push_collisions($placements, $anchorModuleId);

    usort(
        $placements,
        static function (array $first, array $second): int {
            $visibleCompare = (int) (!$first['visible']) <=> (int) (!$second['visible']);

            if ($visibleCompare !== 0) {
                return $visibleCompare;
            }

            $rowCompare = $first['row'] <=> $second['row'];

            if ($rowCompare !== 0) {
                return $rowCompare;
            }

            $columnCompare = $first['column'] <=> $second['column'];

            if ($columnCompare !== 0) {
                return $columnCompare;
            }

            return profile_module_default_sort_order($first['type']) <=> profile_module_default_sort_order($second['type']);
        }
    );

    profile_canvas_apply_module_placements($placements, $userId);
}

function profile_canvas_existing_module_placement(array $record, int $index): array
{
    $type = (string) $record['type'];
    $span = profile_canvas_existing_span($record, $index);
    $column = profile_module_saved_grid_value($record['grid_column'] ?? null) ?? 1;
    $row = profile_module_saved_grid_value($record['grid_row'] ?? null) ?? 1;
    $column = max(1, min(PROFILE_CANVAS_COLUMNS - $span['colSpan'] + 1, $column));
    $row = max(1, min(PROFILE_CANVAS_ROWS - $span['rowSpan'] + 1, $row));

    return [
        'id' => (int) $record['id'],
        'type' => $type,
        'column' => $column,
        'row' => $row,
        'colSpan' => $span['colSpan'],
        'rowSpan' => $span['rowSpan'],
        'visible' => $type === PROFILE_INFO_MODULE_TYPE || (string) $record['visibility'] === 'public',
        'pinned' => profile_module_grid_pinned($record['grid_pinned'] ?? null),
    ];
}

function profile_canvas_existing_span(array $record, int $index): array
{
    $type = (string) $record['type'];
    $colSpan = profile_module_saved_grid_value($record['grid_col_span'] ?? null);
    $rowSpan = profile_module_saved_grid_value($record['grid_row_span'] ?? null);

    if ($colSpan !== null && $rowSpan !== null) {
        [$colSpan, $rowSpan] = profile_canvas_normalize_span($type, $colSpan, $rowSpan);
    }

    if ($colSpan !== null && $rowSpan !== null && profile_canvas_span_allowed($type, $colSpan, $rowSpan)) {
        return [
            'colSpan' => $colSpan,
            'rowSpan' => $rowSpan,
        ];
    }

    $size = profile_canvas_default_size($type, $index);
    [$defaultColSpan, $defaultRowSpan] = array_map('intval', explode('x', $size, 2));

    return [
        'colSpan' => $defaultColSpan,
        'rowSpan' => $defaultRowSpan,
    ];
}

function profile_canvas_default_size(string $type, int $index): string
{
    return match ($type) {
        PROFILE_INFO_MODULE_TYPE => '8x3',
        'about', 'custom_text', PROFILE_TEXT_MODULE_TYPE => '3x2',
        'links', PROFILE_CONNECTIONS_MODULE_TYPE => '3x2',
        'featured_badges', PROFILE_BADGE_DISPLAY_MODULE_TYPE => '2x2',
        PROFILE_FEATURED_POST_MODULE_TYPE => '3x4',
        PROFILE_FEATURED_ROOM_MODULE_TYPE => '3x1',
        PROFILE_GALLERY_MEDIA_MODULE_TYPE => '2x2',
        'uploaded_image' => '2x2',
        'gallery_slideshow' => '3x3',
        'gallery_feed' => '3x6',
        PROFILE_CREATOR_LIVE_MODULE_TYPE,
        'twitch_channel',
        PROFILE_GITHUB_REPO_MODULE_TYPE => '3x2',
        'youtube_video',
        'youtube_stream',
        'youtube_playlist',
        'uploaded_video' => '4x3',
        PROFILE_MUSIC_MODULE_TYPE,
        'spotify_song',
        'apple_music_song',
        'youtube_music_song' => '3x2',
        'spotify_playlist',
        'apple_music_playlist',
        'youtube_music_playlist',
        'spotify_artist',
        'apple_music_artist',
        'youtube_music_artist' => '4x3',
        PROFILE_ACTIVITY_MODULE_TYPE => $index <= 2 ? '3x4' : '4x6',
        PROFILE_CANVAS_PLACEHOLDER_MODULE_TYPE => '1x1',
        default => '1x1',
    };
}

function profile_modules_for_owner(int $userId, bool $includeDeleted = false): array
{
    ensure_profile_canvas_builtin_modules($userId);

    $where = $includeDeleted
        ? 'WHERE user_id = :user_id'
        : 'WHERE user_id = :user_id AND status <> :deleted_status';
    $params = ['user_id' => $userId];

    if (!$includeDeleted) {
        $params['deleted_status'] = 'deleted';
    }

    $statement = db_query(
        "SELECT *
         FROM profile_modules
         {$where}
         ORDER BY FIELD(status, 'active', 'hidden', 'deleted'), position ASC, id ASC",
        $params
    );

    return profile_modules_payload($statement->fetchAll(), false);
}

function profile_modules_include_deleted_requested(): bool
{
    $value = $_GET['includeDeleted'] ?? $_GET['include_deleted'] ?? null;

    if (is_string($value)) {
        return in_array(strtolower(trim($value)), ['1', 'true', 'yes'], true);
    }

    return $value === 1 || $value === true;
}

function ensure_profile_canvas_builtin_modules(int $userId): void
{
    ensure_profile_info_module($userId);
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

function profile_modules_payload_contains_type(array $modules, string $type): bool
{
    foreach ($modules as $module) {
        if (($module['type'] ?? null) === $type) {
            return true;
        }
    }

    return false;
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
        'pinned' => profile_module_grid_pinned($row['grid_pinned'] ?? null),
        'layout' => profile_module_layout_payload($row),
        'status' => (string) $row['status'],
        'schemaVersion' => (int) $row['schema_version'],
        'createdAt' => $row['created_at'] ?? null,
        'updatedAt' => $row['updated_at'] ?? null,
    ];
}

function profile_module_layout_payload(array $row): ?array
{
    $type = (string) ($row['type'] ?? '');
    $column = profile_module_saved_grid_value($row['grid_column'] ?? null);
    $rowNumber = profile_module_saved_grid_value($row['grid_row'] ?? null);
    $colSpan = profile_module_saved_grid_value($row['grid_col_span'] ?? null);
    $rowSpan = profile_module_saved_grid_value($row['grid_row_span'] ?? null);

    if ($column === null || $rowNumber === null || $colSpan === null || $rowSpan === null) {
        return null;
    }

    [$colSpan, $rowSpan] = profile_canvas_normalize_span($type, $colSpan, $rowSpan);

    if (!profile_canvas_span_allowed($type, $colSpan, $rowSpan)) {
        return null;
    }

    $column = max(1, min(PROFILE_CANVAS_COLUMNS - $colSpan + 1, $column));
    $rowNumber = max(1, min(PROFILE_CANVAS_ROWS - $rowSpan + 1, $rowNumber));

    return [
        'column' => $column,
        'row' => $rowNumber,
        'colSpan' => $colSpan,
        'rowSpan' => $rowSpan,
    ];
}

function profile_module_saved_grid_value(mixed $value): ?int
{
    if (is_int($value)) {
        return $value;
    }

    if (is_string($value) && preg_match('/^[0-9]+$/', $value) === 1) {
        return (int) $value;
    }

    return null;
}

function profile_module_grid_pinned(mixed $value): bool
{
    if (is_bool($value)) {
        return $value;
    }

    if (is_int($value)) {
        return $value === 1;
    }

    if (is_string($value)) {
        return $value === '1';
    }

    return false;
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

function profile_module_type_is_protected(string $type): bool
{
    return in_array($type, PROFILE_PROTECTED_MODULE_TYPES, true);
}

function profile_module_type_is_singleton(string $type): bool
{
    return in_array($type, PROFILE_SINGLETON_MODULE_TYPES, true);
}

function profile_module_type_label(string $type): string
{
    return match ($type) {
        PROFILE_INFO_MODULE_TYPE => 'Profile info',
        PROFILE_FEATURED_POST_MODULE_TYPE => 'Featured post',
        PROFILE_FEATURED_ROOM_MODULE_TYPE => 'Featured room',
        PROFILE_ACTIVITY_MODULE_TYPE => 'Activity',
        default => 'Module',
    };
}

function profile_module_delete_message(string $type): string
{
    return match ($type) {
        PROFILE_INFO_MODULE_TYPE => 'Profile info stays visible as the identity anchor.',
        PROFILE_FEATURED_POST_MODULE_TYPE => 'Featured post was removed from the profile canvas.',
        PROFILE_FEATURED_ROOM_MODULE_TYPE => 'Featured room was removed from the profile canvas.',
        PROFILE_ACTIVITY_MODULE_TYPE => 'Activity was removed from the profile canvas.',
        default => 'Module was removed from the profile canvas.',
    };
}

function profile_module_apply_delete_side_effects(string $type, int $userId): void
{
    if ($type === PROFILE_FEATURED_POST_MODULE_TYPE) {
        db_query(
            'UPDATE profiles
             SET featured_post_id = NULL,
                 updated_at = CURRENT_TIMESTAMP()
             WHERE user_id = :user_id',
            ['user_id' => $userId]
        );
    }

    if ($type === PROFILE_FEATURED_ROOM_MODULE_TYPE) {
        db_query(
            'UPDATE profiles
             SET featured_room_id = NULL,
                 updated_at = CURRENT_TIMESTAMP()
             WHERE user_id = :user_id',
            ['user_id' => $userId]
        );
    }
}

function profile_module_delete_snapshot_config(array $module, int $userId): array
{
    $type = (string) $module['type'];
    $config = profile_module_json((string) $module['config_json']);

    if ($type !== PROFILE_FEATURED_POST_MODULE_TYPE && $type !== PROFILE_FEATURED_ROOM_MODULE_TYPE) {
        return $config;
    }

    $statement = db_query(
        'SELECT featured_post_id, featured_room_id
         FROM profiles
         WHERE user_id = :user_id
         LIMIT 1',
        ['user_id' => $userId]
    );
    $row = $statement->fetch();

    if (!is_array($row)) {
        return $config;
    }

    if ($type === PROFILE_FEATURED_POST_MODULE_TYPE && $row['featured_post_id'] !== null) {
        $config['restoreFeaturedPostId'] = (int) $row['featured_post_id'];
    }

    if ($type === PROFILE_FEATURED_ROOM_MODULE_TYPE && $row['featured_room_id'] !== null) {
        $config['restoreFeaturedRoomId'] = (int) $row['featured_room_id'];
    }

    return $config;
}

function profile_module_apply_restore_side_effects(array $module, int $userId): void
{
    $type = (string) $module['type'];
    $config = profile_module_json((string) $module['config_json']);

    if ($type === PROFILE_FEATURED_POST_MODULE_TYPE) {
        $postId = profile_module_restore_id($config['restoreFeaturedPostId'] ?? null);

        if ($postId !== null && profile_module_featured_post_can_restore($postId, $userId)) {
            db_query(
                'UPDATE profiles
                 SET featured_post_id = :featured_post_id,
                     updated_at = CURRENT_TIMESTAMP()
                 WHERE user_id = :user_id',
                [
                    'featured_post_id' => $postId,
                    'user_id' => $userId,
                ]
            );
        }
    }

    if ($type === PROFILE_FEATURED_ROOM_MODULE_TYPE) {
        $roomId = profile_module_restore_id($config['restoreFeaturedRoomId'] ?? null);

        if ($roomId !== null && profile_module_featured_room_can_restore($roomId, $userId)) {
            db_query(
                'UPDATE profiles
                 SET featured_room_id = :featured_room_id,
                     updated_at = CURRENT_TIMESTAMP()
                 WHERE user_id = :user_id',
                [
                    'featured_room_id' => $roomId,
                    'user_id' => $userId,
                ]
            );
        }
    }
}

function profile_module_restore_id(mixed $value): ?int
{
    if (is_int($value) && $value > 0) {
        return $value;
    }

    if (is_string($value) && preg_match('/^[0-9]+$/', $value) === 1 && (int) $value > 0) {
        return (int) $value;
    }

    return null;
}

function profile_module_featured_post_can_restore(int $postId, int $userId): bool
{
    $post = profile_featured_post_record($postId);

    if ($post === null || (int) $post['author_id'] !== $userId) {
        return false;
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
    ) {
        return false;
    }

    return profile_featured_public_post_exists($postId, $userId);
}

function profile_module_featured_room_can_restore(int $roomId, int $userId): bool
{
    $room = profile_featured_room_record($roomId, $userId);

    return is_array($room)
        && (string) $room['visibility'] === 'public'
        && ($room['deleted_at'] ?? null) === null
        && (bool) ($room['is_eligible'] ?? false);
}

function profile_module_output_config(string $type, array $config, int $userId): array
{
    if (
        $type === PROFILE_CREATOR_LIVE_MODULE_TYPE ||
        $type === PROFILE_MUSIC_MODULE_TYPE ||
        in_array($type, PROFILE_VIDEO_MODULE_TYPES, true) ||
        in_array($type, PROFILE_MUSIC_SPECIFIC_MODULE_TYPES, true) ||
        $type === PROFILE_GITHUB_REPO_MODULE_TYPE
    ) {
        $integration = profile_integration_card_for_module($config, $userId);

        if ($integration !== null) {
            $config['integration'] = $integration;
        }

        return $config;
    }

    if ($type === 'featured_badges') {
        return [
            'userBadgeIds' => profile_module_visible_user_badge_ids($userId, $config['userBadgeIds'] ?? []),
        ];
    }

    return $config;
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
           AND type <> :profile_info_type
           AND type <> :legacy_featured_type
           ',
        [
            'user_id' => $userId,
            'deleted_status' => 'deleted',
            'profile_info_type' => PROFILE_INFO_MODULE_TYPE,
            'legacy_featured_type' => PROFILE_FEATURED_LEGACY_MODULE_TYPE,
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

function profile_info_module_preference_exists(int $userId): bool
{
    return profile_singleton_module_preference_exists($userId, PROFILE_INFO_MODULE_TYPE);
}

function profile_singleton_module_preference_exists(int $userId, string $type): bool
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

function ensure_profile_info_module(int $userId): void
{
    if (profile_info_module_preference_exists($userId)) {
        return;
    }

    profile_insert_builtin_module_at(
        $userId,
        PROFILE_INFO_MODULE_TYPE,
        1,
        'public',
        'active'
    );
}

function profile_insert_builtin_module_at(
    int $userId,
    string $type,
    int $position,
    string $visibility,
    string $status
): void {
    $position = max(1, $position);
    [$defaultColSpan, $defaultRowSpan] = array_map('intval', explode('x', profile_canvas_default_size($type, 0), 2));
    $defaultColumn = $type === PROFILE_INFO_MODULE_TYPE ? 3 : 1;
    $defaultRow = $type === PROFILE_INFO_MODULE_TYPE ? 1 : 1;
    $defaultPinned = $type === PROFILE_INFO_MODULE_TYPE ? 1 : 0;

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
            (user_id, type, title, config_json, visibility, position, grid_column, grid_row, grid_col_span, grid_row_span, grid_pinned, status, schema_version)
         VALUES
            (:user_id, :type, NULL, :config_json, :visibility, :position, :grid_column, :grid_row, :grid_col_span, :grid_row_span, :grid_pinned, :status, :schema_version)',
        [
            'user_id' => $userId,
            'type' => $type,
            'config_json' => '{}',
            'visibility' => $visibility,
            'position' => $position,
            'grid_column' => $defaultColumn,
            'grid_row' => $defaultRow,
            'grid_col_span' => $defaultColSpan,
            'grid_row_span' => $defaultRowSpan,
            'grid_pinned' => $defaultPinned,
            'status' => $status,
            'schema_version' => PROFILE_MODULE_SCHEMA_VERSION,
        ]
    );
}

function profile_info_module_payload(int $position): array
{
    return [
        'id' => 0,
        'type' => PROFILE_INFO_MODULE_TYPE,
        'title' => 'Profile info',
        'config' => [],
        'visibility' => 'public',
        'position' => $position,
        'pinned' => true,
        'layout' => [
            'column' => 3,
            'row' => 1,
            'colSpan' => 8,
            'rowSpan' => 3,
        ],
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
        PROFILE_INFO_MODULE_TYPE => -1,
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
    if (!is_array($value) || ($value !== [] && array_is_list($value))) {
        json_error('Module config must be an object.', 422);
    }

    unset($value['integration'], $value['hasBanner']);

    $configured = null;

    if (array_key_exists('configured', $value)) {
        if (!is_bool($value['configured'])) {
            json_error('Module configured state is invalid.', 422);
        }

        $configured = $value['configured'];
        unset($value['configured']);
    }

    $canvasSize = null;

    if (array_key_exists('canvasSize', $value)) {
        if (!is_string($value['canvasSize']) || !in_array($value['canvasSize'], profile_canvas_allowed_sizes($type), true)) {
            json_error('Choose a supported canvas size.', 422);
        }

        $canvasSize = $value['canvasSize'];
        unset($value['canvasSize']);
    }

    if ($configured === false) {
        $draftConfig = ['configured' => false];

        if ($canvasSize !== null) {
            $draftConfig['canvasSize'] = $canvasSize;
        }

        return $draftConfig;
    }

    $normalized = match ($type) {
        PROFILE_INFO_MODULE_TYPE,
        PROFILE_FEATURED_POST_MODULE_TYPE,
        PROFILE_FEATURED_ROOM_MODULE_TYPE,
        PROFILE_ACTIVITY_MODULE_TYPE => profile_module_builtin_config($value),
        'about', PROFILE_TEXT_MODULE_TYPE => profile_module_about_config($value),
        'custom_text' => profile_module_custom_text_config($value),
        'links', PROFILE_CONNECTIONS_MODULE_TYPE => profile_module_links_config($value),
        'featured_badges', PROFILE_BADGE_DISPLAY_MODULE_TYPE => profile_module_featured_badges_config($value, $userId),
        PROFILE_GALLERY_MEDIA_MODULE_TYPE,
        'uploaded_image',
        'gallery_slideshow',
        'gallery_feed' => profile_module_gallery_media_config($value),
        PROFILE_CREATOR_LIVE_MODULE_TYPE,
        'twitch_channel',
        'youtube_video',
        'youtube_stream',
        'youtube_playlist',
        'uploaded_video',
        PROFILE_GITHUB_REPO_MODULE_TYPE => profile_module_creator_live_config($value),
        PROFILE_MUSIC_MODULE_TYPE,
        'spotify_song',
        'apple_music_song',
        'youtube_music_song',
        'spotify_playlist',
        'apple_music_playlist',
        'youtube_music_playlist',
        'spotify_artist',
        'apple_music_artist',
        'youtube_music_artist' => profile_module_music_config($value),
        default => json_error('Choose a supported module type.', 422),
    };

    if ($configured !== null) {
        $normalized['configured'] = $configured;
    }

    if ($canvasSize !== null) {
        $normalized['canvasSize'] = $canvasSize;
    }

    return $normalized;
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
    profile_module_reject_unknown_keys($config, ['body', 'statusText', 'workingOn']);

    $normalized = [];
    $body = profile_module_optional_text($config['body'] ?? null, PROFILE_MODULE_TEXT_MAX, 'About text');
    $statusText = profile_module_optional_text($config['statusText'] ?? null, PROFILE_MODULE_STATUS_TEXT_MAX, 'Status text');
    $workingOn = profile_module_optional_text($config['workingOn'] ?? null, PROFILE_MODULE_STATUS_TEXT_MAX, 'Working on text');

    if ($body !== null) {
        $normalized['body'] = $body;
    }

    if ($statusText !== null) {
        $normalized['statusText'] = $statusText;
    }

    if ($workingOn !== null) {
        $normalized['workingOn'] = $workingOn;
    }

    return $normalized;
}

function profile_module_custom_text_config(array $config): array
{
    profile_module_reject_unknown_keys($config, ['body', 'link']);

    $normalized = [];
    $body = profile_module_optional_text($config['body'] ?? null, PROFILE_MODULE_TEXT_MAX, 'Module text');

    if ($body !== null) {
        $normalized['body'] = $body;
    }

    if (array_key_exists('link', $config) && $config['link'] !== null) {
        $normalized['link'] = profile_module_link($config['link']);
    }

    return $normalized;
}

function profile_module_links_config(array $config): array
{
    profile_module_reject_unknown_keys($config, ['links']);

    if (!array_key_exists('links', $config)) {
        return ['links' => []];
    }

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

    return ['links' => $links];
}

function profile_module_gallery_media_config(array $config): array
{
    profile_module_reject_unknown_keys($config, ['mediaItems']);

    if (!array_key_exists('mediaItems', $config)) {
        return ['mediaItems' => []];
    }

    if (!array_key_exists('mediaItems', $config) || !is_array($config['mediaItems']) || !array_is_list($config['mediaItems'])) {
        json_error('Gallery media must be an array.', 422);
    }

    if (count($config['mediaItems']) > PROFILE_MODULE_GALLERY_MEDIA_MAX) {
        json_error('Gallery modules can show up to 6 media items.', 422);
    }

    $mediaItems = [];
    $seen = [];

    foreach ($config['mediaItems'] as $item) {
        $mediaItem = profile_module_gallery_media_item($item);

        if (isset($seen[$mediaItem['url']])) {
            continue;
        }

        $seen[$mediaItem['url']] = true;
        $mediaItems[] = $mediaItem;
    }

    return ['mediaItems' => $mediaItems];
}

function profile_module_creator_live_config(array $config): array
{
    profile_module_reject_unknown_keys($config, ['platform', 'label', 'url', 'description', 'displayMode', 'sourceMode']);
    $displayMode = profile_module_optional_choice(
        $config['displayMode'] ?? null,
        ['stream_status', 'stream', 'stream_chat', 'latest_video', 'playlist', 'video', 'project', 'link'],
        'Display mode'
    );
    $sourceMode = profile_module_optional_choice(
        $config['sourceMode'] ?? null,
        ['twitch', 'youtube', 'github', 'link'],
        'Source mode'
    );

    if (
        !array_key_exists('url', $config) ||
        $config['url'] === null ||
        (is_string($config['url']) && trim($config['url']) === '')
    ) {
        $normalized = [];
        $platform = profile_module_platform($config['platform'] ?? null, PROFILE_MODULE_CREATOR_PLATFORMS, 'custom');
        $label = profile_module_optional_text($config['label'] ?? null, PROFILE_MODULE_LINK_LABEL_MAX, 'Creator title');
        $description = profile_module_optional_text($config['description'] ?? null, PROFILE_MODULE_SHORT_TEXT_MAX, 'Card description');

        if (array_key_exists('platform', $config)) {
            $normalized['platform'] = $platform;
        }

        if ($label !== null) {
            $normalized['label'] = $label;
        }

        if ($description !== null) {
            $normalized['description'] = $description;
        }

        if ($displayMode !== null) {
            $normalized['displayMode'] = $displayMode;
        }

        if ($sourceMode !== null) {
            $normalized['sourceMode'] = $sourceMode;
        }

        return $normalized;
    }

    $url = profile_module_url($config['url'] ?? null, 'Creator link');
    $platform = profile_module_platform(
        $config['platform'] ?? null,
        PROFILE_MODULE_CREATOR_PLATFORMS,
        profile_module_infer_link_platform($url, PROFILE_MODULE_CREATOR_PLATFORMS)
    );

    profile_module_validate_url_platform($url, $platform, 'Creator link');

    $normalized = profile_module_link_card_config(
        $platform,
        $url,
        $config['label'] ?? null,
        $config['description'] ?? null,
        'Creator title'
    );

    if ($displayMode !== null) {
        $normalized['displayMode'] = $displayMode;
    }

    if ($sourceMode !== null) {
        $normalized['sourceMode'] = $sourceMode;
    }

    return $normalized;
}

function profile_module_music_config(array $config): array
{
    profile_module_reject_unknown_keys($config, ['platform', 'label', 'url', 'description', 'displayMode', 'sourceMode']);
    $displayMode = profile_module_optional_choice(
        $config['displayMode'] ?? null,
        ['embed', 'link', 'now_playing'],
        'Display mode'
    );
    $sourceMode = profile_module_optional_choice(
        $config['sourceMode'] ?? null,
        ['spotify', 'apple_music', 'youtube_music', 'link'],
        'Source mode'
    );

    if (
        !array_key_exists('url', $config) ||
        $config['url'] === null ||
        (is_string($config['url']) && trim($config['url']) === '')
    ) {
        $normalized = [];
        $platform = profile_module_platform($config['platform'] ?? null, PROFILE_MODULE_MUSIC_PLATFORMS, 'custom');
        $label = profile_module_optional_text($config['label'] ?? null, PROFILE_MODULE_LINK_LABEL_MAX, 'Music title');
        $description = profile_module_optional_text($config['description'] ?? null, PROFILE_MODULE_SHORT_TEXT_MAX, 'Card description');

        if (array_key_exists('platform', $config)) {
            $normalized['platform'] = $platform;
        }

        if ($label !== null) {
            $normalized['label'] = $label;
        }

        if ($description !== null) {
            $normalized['description'] = $description;
        }

        if ($displayMode !== null) {
            $normalized['displayMode'] = $displayMode;
        }

        if ($sourceMode !== null) {
            $normalized['sourceMode'] = $sourceMode;
        }

        return $normalized;
    }

    $url = profile_module_url($config['url'] ?? null, 'Music link');
    $platform = profile_module_platform(
        $config['platform'] ?? null,
        PROFILE_MODULE_MUSIC_PLATFORMS,
        profile_module_infer_music_platform($url)
    );

    profile_module_validate_url_platform($url, $platform, 'Music link');

    $normalized = profile_module_link_card_config(
        $platform,
        $url,
        $config['label'] ?? null,
        $config['description'] ?? null,
        'Music title'
    );

    if ($displayMode !== null) {
        $normalized['displayMode'] = $displayMode;
    }

    if ($sourceMode !== null) {
        $normalized['sourceMode'] = $sourceMode;
    }

    return $normalized;
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

function profile_module_gallery_media_item(mixed $value): array
{
    if (!is_array($value) || array_is_list($value)) {
        json_error('Gallery media item must be an object.', 422);
    }

    profile_module_reject_unknown_keys($value, ['url', 'caption']);

    $mediaItem = [
        'url' => profile_module_uploaded_media_url($value['url'] ?? null, 'Gallery image'),
    ];
    $caption = profile_module_optional_text($value['caption'] ?? null, PROFILE_MODULE_GALLERY_CAPTION_MAX, 'Gallery caption');

    if ($caption !== null) {
        $mediaItem['caption'] = $caption;
    }

    return $mediaItem;
}

function profile_module_uploaded_media_url(mixed $value, string $label): string
{
    if (!is_string($value)) {
        json_error("{$label} must be an uploaded image URL.", 422);
    }

    $trimmed = trim($value);

    if (preg_match('#^/uploads/media/[0-9]{4}/[0-9]{2}/[a-z0-9_-]+\.webp$#', $trimmed) !== 1) {
        json_error("{$label} must come from the image upload endpoint.", 422);
    }

    return $trimmed;
}

function profile_module_link_card_config(
    string $platform,
    string $url,
    mixed $label,
    mixed $description,
    string $labelName
): array {
    $normalized = [
        'platform' => $platform,
        'label' => profile_module_text($label, PROFILE_MODULE_LINK_LABEL_MAX, $labelName),
        'url' => $url,
    ];
    $descriptionText = profile_module_optional_text($description, PROFILE_MODULE_SHORT_TEXT_MAX, 'Card description');

    if ($descriptionText !== null) {
        $normalized['description'] = $descriptionText;
    }

    return $normalized;
}

function profile_module_link(mixed $value): array
{
    if (!is_array($value) || array_is_list($value)) {
        json_error('Link must be an object.', 422);
    }

    profile_module_reject_unknown_keys($value, ['label', 'url', 'platform']);

    $url = profile_module_url($value['url'] ?? null, 'Link URL');
    $platform = profile_module_platform(
        $value['platform'] ?? null,
        PROFILE_MODULE_LINK_PLATFORMS,
        profile_module_infer_link_platform($url, PROFILE_MODULE_LINK_PLATFORMS)
    );

    profile_module_validate_url_platform($url, $platform, 'Link URL');

    return [
        'label' => profile_module_text($value['label'] ?? null, PROFILE_MODULE_LINK_LABEL_MAX, 'Link label'),
        'platform' => $platform,
        'url' => $url,
    ];
}

function profile_module_platform(mixed $value, array $allowedPlatforms, string $fallback): string
{
    if ($value === null || $value === '') {
        return $fallback;
    }

    if (!is_string($value)) {
        json_error('Platform is invalid.', 422);
    }

    $platform = strtolower(trim($value));

    if ($platform === 'twitter') {
        $platform = 'x';
    }

    if (!in_array($platform, $allowedPlatforms, true)) {
        json_error('Choose a supported platform.', 422);
    }

    return $platform;
}

function profile_module_infer_link_platform(string $url, array $allowedPlatforms): string
{
    $host = profile_module_url_host($url);
    $platform = match (true) {
        in_array($host, ['youtube.com', 'www.youtube.com', 'youtu.be'], true) => 'youtube',
        in_array($host, ['twitch.tv', 'www.twitch.tv'], true) => 'twitch',
        in_array($host, ['tiktok.com', 'www.tiktok.com'], true) => 'tiktok',
        in_array($host, ['instagram.com', 'www.instagram.com'], true) => 'instagram',
        in_array($host, ['x.com', 'www.x.com', 'twitter.com', 'www.twitter.com'], true) => 'x',
        in_array($host, ['bsky.app', 'www.bsky.app'], true) => 'bluesky',
        in_array($host, ['github.com', 'www.github.com'], true) => 'github',
        in_array($host, ['discord.gg', 'www.discord.gg', 'discord.com', 'www.discord.com'], true) => 'discord',
        $host === 'open.spotify.com' => 'spotify',
        default => 'custom',
    };

    return in_array($platform, $allowedPlatforms, true) ? $platform : 'custom';
}

function profile_module_infer_music_platform(string $url): string
{
    $host = profile_module_url_host($url);

    return match (true) {
        $host === 'open.spotify.com' => 'spotify',
        in_array($host, ['music.apple.com', 'itunes.apple.com'], true) => 'apple_music',
        in_array($host, ['music.youtube.com', 'youtube.com', 'www.youtube.com', 'youtu.be'], true) => 'youtube_music',
        in_array($host, ['soundcloud.com', 'www.soundcloud.com'], true) => 'soundcloud',
        str_ends_with($host, '.bandcamp.com') || $host === 'bandcamp.com' || $host === 'www.bandcamp.com' => 'bandcamp',
        default => 'custom',
    };
}

function profile_module_validate_url_platform(string $url, string $platform, string $label): void
{
    if ($platform === 'custom' || $platform === 'website') {
        return;
    }

    $host = profile_module_url_host($url);
    $allowedHosts = match ($platform) {
        'youtube', 'youtube_music' => ['youtube.com', 'www.youtube.com', 'youtu.be', 'music.youtube.com'],
        'twitch' => ['twitch.tv', 'www.twitch.tv'],
        'tiktok' => ['tiktok.com', 'www.tiktok.com'],
        'instagram' => ['instagram.com', 'www.instagram.com'],
        'x' => ['x.com', 'www.x.com', 'twitter.com', 'www.twitter.com'],
        'bluesky' => ['bsky.app', 'www.bsky.app'],
        'github' => ['github.com', 'www.github.com'],
        'discord' => ['discord.gg', 'www.discord.gg', 'discord.com', 'www.discord.com'],
        'spotify' => ['open.spotify.com'],
        'apple_music' => ['music.apple.com', 'itunes.apple.com'],
        'soundcloud' => ['soundcloud.com', 'www.soundcloud.com'],
        'bandcamp' => ['bandcamp.com', 'www.bandcamp.com'],
        default => [],
    };

    if (
        $platform === 'bandcamp'
        && (str_ends_with($host, '.bandcamp.com') || in_array($host, $allowedHosts, true))
    ) {
        return;
    }

    if (!in_array($host, $allowedHosts, true)) {
        json_error("{$label} does not match the selected platform.", 422);
    }
}

function profile_module_url_host(string $url): string
{
    $parts = parse_url($url);

    return is_array($parts) ? strtolower((string) ($parts['host'] ?? '')) : '';
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

function profile_module_optional_text(mixed $value, int $maxLength, string $label): ?string
{
    if ($value === null || $value === '') {
        return null;
    }

    if (!is_string($value)) {
        json_error("{$label} is invalid.", 422);
    }

    $trimmed = trim(preg_replace('/\s+/', ' ', $value) ?? $value);

    if ($trimmed === '') {
        return null;
    }

    if (profile_module_text_length($trimmed) > $maxLength) {
        json_error("{$label} is too long.", 422);
    }

    if (profile_module_text_is_unsafe($trimmed)) {
        json_error("{$label} must be plain text.", 422);
    }

    return $trimmed;
}

function profile_module_optional_choice(mixed $value, array $allowedValues, string $label): ?string
{
    if ($value === null || $value === '') {
        return null;
    }

    if (!is_string($value)) {
        json_error("{$label} is invalid.", 422);
    }

    $normalized = strtolower(trim($value));

    if (!in_array($normalized, $allowedValues, true)) {
        json_error("Choose a supported {$label}.", 422);
    }

    return $normalized;
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
