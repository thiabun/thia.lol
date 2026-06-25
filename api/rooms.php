<?php

declare(strict_types=1);

require_once __DIR__ . '/auth.php';
require_once __DIR__ . '/read.php';

const ROOM_ROLES = ['owner', 'moderator', 'member'];
const ROOM_VISIBILITIES = ['public', 'private', 'invite', 'view_only'];
const ROOM_ACCENTS = [
    'var(--accent-sun)',
    'var(--accent-frost)',
    'var(--accent-leaf)',
    'var(--accent-rose)',
    'var(--app-accent)',
];

function rooms_dispatch(array $segments, string $method): void
{
    if (($segments[0] ?? null) !== 'rooms') {
        json_error('Not found.', 404);
    }

    if (count($segments) === 1) {
        if ($method === 'GET' || $method === 'HEAD') {
            rooms_index();
        }

        if ($method === 'POST') {
            rooms_create();
        }

        json_error('Method not allowed.', 405);
    }

    if (count($segments) === 2) {
        if ($method === 'GET' || $method === 'HEAD') {
            rooms_show($segments[1]);
        }

        if ($method === 'PATCH') {
            rooms_update($segments[1]);
        }

        if ($method === 'DELETE') {
            rooms_delete($segments[1]);
        }

        json_error('Method not allowed.', 405);
    }

    if (count($segments) === 3 && $segments[2] === 'posts') {
        if ($method === 'GET' || $method === 'HEAD') {
            room_posts_index($segments[1]);
        }

        json_error('Method not allowed.', 405);
    }

    if (count($segments) === 3 && $segments[2] === 'join') {
        if ($method === 'POST') {
            rooms_join($segments[1]);
        }

        if ($method === 'DELETE') {
            rooms_leave($segments[1]);
        }

        json_error('Method not allowed.', 405);
    }

    if (count($segments) === 3 && $segments[2] === 'members') {
        if ($method === 'GET' || $method === 'HEAD') {
            room_members_index($segments[1]);
        }

        if ($method === 'POST') {
            room_member_add($segments[1]);
        }

        if ($method === 'DELETE') {
            room_member_remove($segments[1]);
        }

        json_error('Method not allowed.', 405);
    }

    if (count($segments) === 3 && $segments[2] === 'access-requests') {
        if ($method === 'POST') {
            room_access_request_create($segments[1]);
        }

        if ($method === 'GET' || $method === 'HEAD') {
            room_access_requests_index($segments[1]);
        }

        json_error('Method not allowed.', 405);
    }

    if (count($segments) === 4 && $segments[2] === 'access-requests' && $segments[3] === 'me') {
        if ($method === 'DELETE') {
            room_access_request_cancel($segments[1]);
        }

        json_error('Method not allowed.', 405);
    }

    if (count($segments) === 5 && $segments[2] === 'access-requests' && in_array($segments[4], ['approve', 'deny'], true)) {
        if ($method === 'POST') {
            room_access_request_review($segments[1], $segments[3], $segments[4]);
        }

        json_error('Method not allowed.', 405);
    }

    if (count($segments) === 3 && $segments[2] === 'moderators') {
        if ($method === 'POST') {
            room_moderator_add($segments[1]);
        }

        if ($method === 'DELETE') {
            room_moderator_remove($segments[1]);
        }

        json_error('Method not allowed.', 405);
    }

    json_error('Not found.', 404);
}

function rooms_create(): void
{
    $session = require_authenticated_session();
    require_csrf_token($session);
    require_rooms2_storage();

    $body = auth_json_body();
    $name = room_text($body['name'] ?? null, 'Name', 2, 80);
    $slug = room_slug_from_value($body['slug'] ?? null, $name);
    $summary = room_text(room_body_alias_value($body, 'summary', 'description'), 'Summary', 5, 500);
    $mood = room_optional_token($body['mood'] ?? null, 'Mood', 40);
    $accent = room_accent($body['accent'] ?? null);
    $iconUrl = room_upload_url(room_body_alias_value($body, 'iconUrl', 'icon_url'), 'Icon URL');
    $bannerUrl = room_upload_url(room_body_alias_value($body, 'bannerUrl', 'banner_url'), 'Banner URL');
    $rules = room_optional_text($body['rules'] ?? null, 'Room rules', 3000);
    $visibility = room_visibility($body['visibility'] ?? 'public');

    try {
        db()->beginTransaction();

        db_query(
            'INSERT INTO rooms (slug, name, summary, mood, member_count, is_live, accent, icon_url, banner_url, rules, visibility, created_by)
             VALUES (:slug, :name, :summary, :mood, 1, 0, :accent, :icon_url, :banner_url, :rules, :visibility, :created_by)',
            [
                'slug' => $slug,
                'name' => $name,
                'summary' => $summary,
                'mood' => $mood,
                'accent' => $accent,
                'icon_url' => $iconUrl,
                'banner_url' => $bannerUrl,
                'rules' => $rules,
                'visibility' => $visibility,
                'created_by' => (int) $session['user_id'],
            ]
        );

        $roomId = (int) db()->lastInsertId();

        db_query(
            'INSERT INTO room_memberships (room_id, user_id, role)
             VALUES (:room_id, :user_id, :role)',
            [
                'room_id' => $roomId,
                'user_id' => (int) $session['user_id'],
                'role' => 'owner',
            ]
        );

        room_sync_member_count($roomId);
        room_grant_owner_badge_if_first_room((int) $session['user_id']);

        db()->commit();
    } catch (PDOException $exception) {
        if (db()->inTransaction()) {
            db()->rollBack();
        }

        if ($exception->getCode() === '23000') {
            json_error('Room slug is already in use.', 409);
        }

        throw $exception;
    } catch (Throwable $exception) {
        if (db()->inTransaction()) {
            db()->rollBack();
        }

        throw $exception;
    }

    json_success(fetch_public_room_by_slug($slug), 201);
}

function rooms_update(string $slug): void
{
    $session = require_authenticated_session();
    require_csrf_token($session);
    require_rooms2_storage();

    $room = room_record_by_slug(normalize_slug($slug));

    if ($room === null) {
        json_error('Room not found.', 404);
    }

    if (!room_can_edit($room, $session)) {
        json_error('You cannot edit this room.', 403);
    }

    $body = auth_json_body();
    $updates = [];
    $params = ['id' => (int) $room['id']];

    if (array_key_exists('name', $body)) {
        $updates[] = 'name = :name';
        $params['name'] = room_text($body['name'], 'Name', 2, 80);
    }

    if (array_key_exists('summary', $body) || array_key_exists('description', $body)) {
        $updates[] = 'summary = :summary';
        $params['summary'] = room_text(room_body_alias_value($body, 'summary', 'description'), 'Summary', 5, 500);
    }

    if (array_key_exists('mood', $body)) {
        $updates[] = 'mood = :mood';
        $params['mood'] = room_optional_token($body['mood'], 'Mood', 40);
    }

    if (array_key_exists('accent', $body)) {
        $updates[] = 'accent = :accent';
        $params['accent'] = room_accent($body['accent']);
    }

    if (array_key_exists('iconUrl', $body) || array_key_exists('icon_url', $body)) {
        $updates[] = 'icon_url = :icon_url';
        $params['icon_url'] = room_upload_url(room_body_alias_value($body, 'iconUrl', 'icon_url'), 'Icon URL');
    }

    if (array_key_exists('bannerUrl', $body) || array_key_exists('banner_url', $body)) {
        $updates[] = 'banner_url = :banner_url';
        $params['banner_url'] = room_upload_url(room_body_alias_value($body, 'bannerUrl', 'banner_url'), 'Banner URL');
    }

    if (array_key_exists('rules', $body)) {
        $updates[] = 'rules = :rules';
        $params['rules'] = room_optional_text($body['rules'], 'Room rules', 3000);
    }

    if (array_key_exists('visibility', $body)) {
        if (!room_can_manage_moderators($room, $session)) {
            json_error('You cannot change room visibility.', 403);
        }

        $updates[] = 'visibility = :visibility';
        $params['visibility'] = room_visibility($body['visibility']);
    }

    if ($updates === []) {
        json_success(fetch_public_room_by_slug((string) $room['slug']));
    }

    $updates[] = 'updated_at = CURRENT_TIMESTAMP()';

    db_query(
        'UPDATE rooms SET ' . implode(', ', $updates) . ' WHERE id = :id',
        $params
    );

    json_success(fetch_public_room_by_slug((string) $room['slug']));
}

function rooms_delete(string $slug): void
{
    $session = require_authenticated_session();
    require_csrf_token($session);
    require_rooms2_storage();

    $room = room_record_by_slug(normalize_slug($slug));

    if ($room === null) {
        json_error('Room not found.', 404);
    }

    if (!room_can_delete($room, $session)) {
        json_error('You cannot delete this room.', 403);
    }

    db_query(
        'UPDATE rooms
         SET deleted_at = CURRENT_TIMESTAMP(),
             visibility = :visibility,
             updated_at = CURRENT_TIMESTAMP()
         WHERE id = :id
           AND deleted_at IS NULL',
        [
            'id' => (int) $room['id'],
            'visibility' => 'private',
        ]
    );

    json_success([
        'slug' => (string) $room['slug'],
        'deletedAt' => gmdate('c'),
    ]);
}

function room_moderator_add(string $slug): void
{
    $session = require_authenticated_session();
    require_csrf_token($session);
    require_rooms2_storage();

    $room = room_record_by_slug(normalize_slug($slug));

    if ($room === null) {
        json_error('Room not found.', 404);
    }

    if (!room_can_manage_moderators($room, $session)) {
        json_error('You cannot manage moderators for this room.', 403);
    }

    $body = auth_json_body();
    $user = room_user_by_handle($body['handle'] ?? null);

    if ($user === null) {
        json_error('Profile not found.', 404);
    }

    $existing = room_membership_record((int) $room['id'], (int) $user['id']);

    if ($existing !== null && $existing['banned_at'] !== null) {
        json_error('Banned members cannot be made moderators.', 422);
    }

    db_query(
        "INSERT INTO room_memberships (room_id, user_id, role)
         VALUES (:room_id, :user_id, 'moderator')
         ON DUPLICATE KEY UPDATE
           role = IF(role = 'owner', role, 'moderator'),
           banned_at = banned_at",
        [
            'room_id' => (int) $room['id'],
            'user_id' => (int) $user['id'],
        ]
    );
    room_sync_member_count((int) $room['id']);

    json_success(fetch_room_members((int) $room['id']));
}

function room_moderator_remove(string $slug): void
{
    $session = require_authenticated_session();
    require_csrf_token($session);
    require_rooms2_storage();

    $room = room_record_by_slug(normalize_slug($slug));

    if ($room === null) {
        json_error('Room not found.', 404);
    }

    if (!room_can_manage_moderators($room, $session)) {
        json_error('You cannot manage moderators for this room.', 403);
    }

    $body = auth_json_body();
    $user = room_user_by_handle($body['handle'] ?? null);

    if ($user === null) {
        json_error('Profile not found.', 404);
    }

    $membership = room_membership_record((int) $room['id'], (int) $user['id']);

    if ($membership !== null && (string) $membership['role'] === 'owner') {
        json_error('Room owners cannot be demoted without ownership transfer.', 422);
    }

    db_query(
        "UPDATE room_memberships
         SET role = 'member'
         WHERE room_id = :room_id
           AND user_id = :user_id
           AND role = 'moderator'",
        [
            'room_id' => (int) $room['id'],
            'user_id' => (int) $user['id'],
        ]
    );
    room_sync_member_count((int) $room['id']);

    json_success(fetch_room_members((int) $room['id']));
}

function rooms_join(string $slug): void
{
    $session = require_authenticated_session();
    require_csrf_token($session);
    require_rooms2_storage();

    $room = room_record_by_slug(normalize_slug($slug));

    if ($room === null || (string) $room['visibility'] !== 'public') {
        json_error('Room not found.', 404);
    }

    $membership = room_membership_record((int) $room['id'], (int) $session['user_id']);

    if ($membership !== null && $membership['banned_at'] !== null) {
        json_error('You cannot join this room.', 403);
    }

    db_query(
        "INSERT INTO room_memberships (room_id, user_id, role)
         VALUES (:room_id, :user_id, 'member')
         ON DUPLICATE KEY UPDATE
           role = IF(role IN ('owner', 'moderator'), role, 'member'),
           banned_at = banned_at",
        [
            'room_id' => (int) $room['id'],
            'user_id' => (int) $session['user_id'],
        ]
    );
    room_sync_member_count((int) $room['id']);

    json_success(fetch_public_room_by_slug((string) $room['slug']));
}

function rooms_leave(string $slug): void
{
    $session = require_authenticated_session();
    require_csrf_token($session);
    require_rooms2_storage();

    $room = room_record_by_slug(normalize_slug($slug));

    if ($room === null) {
        json_error('Room not found.', 404);
    }

    $membership = room_membership_record((int) $room['id'], (int) $session['user_id']);

    if ($membership === null || $membership['banned_at'] !== null) {
        json_success(fetch_public_room_by_slug((string) $room['slug']));
    }

    if ((string) $membership['role'] === 'owner') {
        json_error('Room owners cannot leave until ownership transfer exists.', 422);
    }

    db_query(
        'DELETE FROM room_memberships
         WHERE room_id = :room_id
           AND user_id = :user_id',
        [
            'room_id' => (int) $room['id'],
            'user_id' => (int) $session['user_id'],
        ]
    );
    room_sync_member_count((int) $room['id']);

    json_success(fetch_public_room_by_slug((string) $room['slug']));
}

function room_members_index(string $slug): void
{
    require_rooms2_storage();

    $room = room_record_by_slug(normalize_slug($slug));

    if ($room === null || !room_viewer_can_view_posts($room, function_exists('current_session') ? current_session() : null)) {
        json_error('Room not found.', 404);
    }

    json_success(fetch_room_members((int) $room['id']));
}

function room_member_add(string $slug): void
{
    $session = require_authenticated_session();
    require_csrf_token($session);
    require_rooms2_storage();

    $room = room_record_by_slug(normalize_slug($slug));

    if ($room === null) {
        json_error('Room not found.', 404);
    }

    if (!room_can_manage_members($room, $session)) {
        json_error('You cannot manage members for this room.', 403);
    }

    $body = auth_json_body();
    $user = room_user_by_handle($body['handle'] ?? null);

    if ($user === null) {
        json_error('Profile not found.', 404);
    }

    $existing = room_membership_record((int) $room['id'], (int) $user['id']);

    if ($existing !== null && $existing['banned_at'] !== null) {
        json_error('Banned members cannot be added.', 422);
    }

    db_query(
        "INSERT INTO room_memberships (room_id, user_id, role)
         VALUES (:room_id, :user_id, 'member')
         ON DUPLICATE KEY UPDATE
           role = IF(role IN ('owner', 'moderator'), role, 'member'),
           banned_at = banned_at",
        [
            'room_id' => (int) $room['id'],
            'user_id' => (int) $user['id'],
        ]
    );

    if (room_access_requests_table_exists()) {
        db_query(
            "UPDATE room_access_requests
             SET status = 'approved',
                 reviewed_by = :reviewed_by,
                 reviewed_at = UTC_TIMESTAMP(),
                 updated_at = CURRENT_TIMESTAMP()
             WHERE room_id = :room_id
               AND requester_id = :requester_id
               AND status = 'pending'",
            [
                'reviewed_by' => (int) $session['user_id'],
                'room_id' => (int) $room['id'],
                'requester_id' => (int) $user['id'],
            ]
        );
    }

    room_sync_member_count((int) $room['id']);

    json_success(fetch_room_members((int) $room['id']));
}

function room_member_remove(string $slug): void
{
    $session = require_authenticated_session();
    require_csrf_token($session);
    require_rooms2_storage();

    $room = room_record_by_slug(normalize_slug($slug));

    if ($room === null) {
        json_error('Room not found.', 404);
    }

    if (!room_can_manage_members($room, $session)) {
        json_error('You cannot manage members for this room.', 403);
    }

    $body = auth_json_body();
    $user = room_user_by_handle($body['handle'] ?? null);

    if ($user === null) {
        json_error('Profile not found.', 404);
    }

    $membership = room_membership_record((int) $room['id'], (int) $user['id']);

    if ($membership !== null && (string) $membership['role'] === 'owner') {
        json_error('Room owners cannot be removed without ownership transfer.', 422);
    }

    db_query(
        "DELETE FROM room_memberships
         WHERE room_id = :room_id
           AND user_id = :user_id
           AND role <> 'owner'",
        [
            'room_id' => (int) $room['id'],
            'user_id' => (int) $user['id'],
        ]
    );
    room_sync_member_count((int) $room['id']);

    json_success(fetch_room_members((int) $room['id']));
}

function room_access_request_create(string $slug): void
{
    $session = require_authenticated_session();
    require_csrf_token($session);
    require_rooms2_storage();
    require_room_access_request_storage();

    $room = room_record_by_slug(normalize_slug($slug));

    if ($room === null || (string) $room['visibility'] !== 'invite') {
        json_error('Room not found.', 404);
    }

    $membership = room_membership_record((int) $room['id'], (int) $session['user_id']);

    if ($membership !== null && $membership['banned_at'] !== null) {
        json_error('You cannot request access to this room.', 403);
    }

    if ($membership === null) {
        db_query(
            "INSERT INTO room_access_requests (room_id, requester_id, status, reviewed_by, reviewed_at)
             VALUES (:room_id, :requester_id, 'pending', NULL, NULL)
             ON DUPLICATE KEY UPDATE
               status = IF(room_access_requests.status = 'approved', room_access_requests.status, 'pending'),
               reviewed_by = IF(room_access_requests.status = 'approved', room_access_requests.reviewed_by, NULL),
               reviewed_at = IF(room_access_requests.status = 'approved', room_access_requests.reviewed_at, NULL),
               updated_at = CURRENT_TIMESTAMP()",
            [
                'room_id' => (int) $room['id'],
                'requester_id' => (int) $session['user_id'],
            ]
        );
    }

    json_success(fetch_public_room_by_slug((string) $room['slug']), 201);
}

function room_access_request_cancel(string $slug): void
{
    $session = require_authenticated_session();
    require_csrf_token($session);
    require_rooms2_storage();
    require_room_access_request_storage();

    $room = room_record_by_slug(normalize_slug($slug));

    if ($room === null || (string) $room['visibility'] !== 'invite') {
        json_error('Room not found.', 404);
    }

    db_query(
        "UPDATE room_access_requests
         SET status = 'canceled',
             updated_at = CURRENT_TIMESTAMP()
         WHERE room_id = :room_id
           AND requester_id = :requester_id
           AND status = 'pending'",
        [
            'room_id' => (int) $room['id'],
            'requester_id' => (int) $session['user_id'],
        ]
    );

    json_success(fetch_public_room_by_slug((string) $room['slug']));
}

function room_access_requests_index(string $slug): void
{
    $session = require_authenticated_session();
    require_rooms2_storage();
    require_room_access_request_storage();

    $room = room_record_by_slug(normalize_slug($slug));

    if ($room === null) {
        json_error('Room not found.', 404);
    }

    if (!room_can_manage_members($room, $session)) {
        json_error('You cannot manage access for this room.', 403);
    }

    json_success(fetch_room_access_requests((int) $room['id']));
}

function room_access_request_review(string $slug, string $requestId, string $decision): void
{
    $session = require_authenticated_session();
    require_csrf_token($session);
    require_rooms2_storage();
    require_room_access_request_storage();

    if (!preg_match('/^[0-9]+$/', $requestId)) {
        json_error('Access request not found.', 404);
    }

    $room = room_record_by_slug(normalize_slug($slug));

    if ($room === null) {
        json_error('Room not found.', 404);
    }

    if (!room_can_manage_members($room, $session)) {
        json_error('You cannot manage access for this room.', 403);
    }

    $request = room_access_request_record((int) $room['id'], (int) $requestId);

    if ($request === null) {
        json_error('Access request not found.', 404);
    }

    if ($decision === 'approve') {
        db()->beginTransaction();

        try {
            db_query(
                "INSERT INTO room_memberships (room_id, user_id, role)
                 VALUES (:room_id, :user_id, 'member')
                 ON DUPLICATE KEY UPDATE
                   role = IF(role IN ('owner', 'moderator'), role, 'member'),
                   banned_at = banned_at",
                [
                    'room_id' => (int) $room['id'],
                    'user_id' => (int) $request['requester_id'],
                ]
            );
            db_query(
                "UPDATE room_access_requests
                 SET status = 'approved',
                     reviewed_by = :reviewed_by,
                     reviewed_at = UTC_TIMESTAMP(),
                     updated_at = CURRENT_TIMESTAMP()
                 WHERE id = :id",
                [
                    'reviewed_by' => (int) $session['user_id'],
                    'id' => (int) $requestId,
                ]
            );
            room_sync_member_count((int) $room['id']);
            db()->commit();
        } catch (Throwable $exception) {
            if (db()->inTransaction()) {
                db()->rollBack();
            }

            throw $exception;
        }
    } else {
        db_query(
            "UPDATE room_access_requests
             SET status = 'denied',
                 reviewed_by = :reviewed_by,
                 reviewed_at = UTC_TIMESTAMP(),
                 updated_at = CURRENT_TIMESTAMP()
             WHERE id = :id",
            [
                'reviewed_by' => (int) $session['user_id'],
                'id' => (int) $requestId,
            ]
        );
    }

    json_success(fetch_room_access_requests((int) $room['id']));
}

function require_room_access_request_storage(): void
{
    if (!room_access_requests_table_exists()) {
        json_error('Room access request storage is not ready. Run pending migrations.', 503);
    }
}

function room_access_request_record(int $roomId, int $requestId): ?array
{
    $row = db_query(
        'SELECT id, requester_id
         FROM room_access_requests
         WHERE room_id = :room_id
           AND id = :id
         LIMIT 1',
        [
            'room_id' => $roomId,
            'id' => $requestId,
        ]
    )->fetch();

    return is_array($row) ? $row : null;
}

function fetch_room_access_requests(int $roomId): array
{
    $rows = db_query(
        "SELECT
            requests.id,
            requests.status,
            requests.created_at,
            requests.updated_at,
            requests.reviewed_at,
            requester.id AS requester_user_id,
            requester.handle AS requester_handle,
            requester_profile.display_name AS requester_display_name,
            requester_profile.avatar_url AS requester_avatar_url,
            reviewer.id AS reviewer_user_id,
            reviewer.handle AS reviewer_handle,
            reviewer_profile.display_name AS reviewer_display_name,
            reviewer_profile.avatar_url AS reviewer_avatar_url
         FROM room_access_requests requests
         INNER JOIN users requester ON requester.id = requests.requester_id
         INNER JOIN profiles requester_profile ON requester_profile.user_id = requester.id
         LEFT JOIN users reviewer ON reviewer.id = requests.reviewed_by
         LEFT JOIN profiles reviewer_profile ON reviewer_profile.user_id = reviewer.id
         WHERE requests.room_id = :room_id
           AND requests.status = 'pending'
         ORDER BY requests.created_at ASC, requests.id ASC
         LIMIT 100",
        ['room_id' => $roomId]
    )->fetchAll();

    return array_map('room_access_request_payload', $rows);
}

function room_access_request_payload(array $row): array
{
    $reviewedBy = null;

    if (($row['reviewer_user_id'] ?? null) !== null) {
        $reviewedBy = user_payload([
            'user_id' => $row['reviewer_user_id'],
            'handle' => $row['reviewer_handle'],
            'display_name' => $row['reviewer_display_name'],
            'avatar_url' => $row['reviewer_avatar_url'] ?? null,
        ]);
    }

    return [
        'id' => (int) $row['id'],
        'status' => room_access_request_status_value($row['status'] ?? null) ?? 'pending',
        'createdAt' => $row['created_at'] ?? null,
        'updatedAt' => $row['updated_at'] ?? null,
        'reviewedAt' => $row['reviewed_at'] ?? null,
        'requester' => user_payload([
            'user_id' => $row['requester_user_id'],
            'handle' => $row['requester_handle'],
            'display_name' => $row['requester_display_name'],
            'avatar_url' => $row['requester_avatar_url'] ?? null,
        ]),
        'reviewedBy' => $reviewedBy,
    ];
}

function fetch_room_members(int $roomId): array
{
    $statement = db_query(
        "SELECT
            memberships.id,
            memberships.role,
            memberships.joined_at,
            users.id AS user_id,
            users.handle,
            profiles.display_name,
            profiles.avatar_url
         FROM room_memberships memberships
         INNER JOIN users ON users.id = memberships.user_id
         INNER JOIN profiles ON profiles.user_id = users.id
         WHERE memberships.room_id = :room_id
           AND memberships.banned_at IS NULL
           AND users.status = 'active'
         ORDER BY
            FIELD(memberships.role, 'owner', 'moderator', 'member'),
            memberships.joined_at ASC
         LIMIT 100",
        ['room_id' => $roomId]
    );

    return array_map('room_member_payload', $statement->fetchAll());
}

function require_rooms2_storage(): void
{
    if (!room_memberships_table_exists() || !room_customization_columns_exist() || !room_soft_delete_column_exists()) {
        json_error('Room membership storage is not ready. Run pending migrations.', 503);
    }
}

function room_record_by_slug(string $slug): ?array
{
    $statement = db_query(
        'SELECT id, slug, name, summary, mood, accent, visibility, created_by, deleted_at
         FROM rooms
         WHERE slug = :slug
           AND deleted_at IS NULL
         LIMIT 1',
        ['slug' => $slug]
    );
    $row = $statement->fetch();

    return is_array($row) ? $row : null;
}

function room_membership_record(int $roomId, int $userId): ?array
{
    $statement = db_query(
        'SELECT id, room_id, user_id, role, muted_at, banned_at
         FROM room_memberships
         WHERE room_id = :room_id
           AND user_id = :user_id
         LIMIT 1',
        [
            'room_id' => $roomId,
            'user_id' => $userId,
        ]
    );
    $row = $statement->fetch();

    return is_array($row) ? $row : null;
}

function room_can_edit(array $room, array $session): bool
{
    if ((string) $session['role'] === 'admin') {
        return true;
    }

    $membership = room_membership_record((int) $room['id'], (int) $session['user_id']);

    return $membership !== null
        && $membership['banned_at'] === null
        && in_array((string) $membership['role'], ['owner', 'moderator'], true);
}

function room_can_delete(array $room, array $session): bool
{
    return (string) $session['role'] === 'admin'
        || (int) $room['created_by'] === (int) $session['user_id']
        || (
            ($membership = room_membership_record((int) $room['id'], (int) $session['user_id'])) !== null
            && $membership['banned_at'] === null
            && (string) $membership['role'] === 'owner'
        );
}

function room_can_manage_moderators(array $room, array $session): bool
{
    return (string) $session['role'] === 'admin'
        || (int) $room['created_by'] === (int) $session['user_id']
        || (
            ($membership = room_membership_record((int) $room['id'], (int) $session['user_id'])) !== null
            && $membership['banned_at'] === null
            && (string) $membership['role'] === 'owner'
        );
}

function room_can_manage_members(array $room, array $session): bool
{
    return room_can_edit($room, $session);
}

function room_viewer_can_view_posts(array $room, ?array $session): bool
{
    $visibility = (string) ($room['visibility'] ?? 'public');

    if (in_array($visibility, ['public', 'view_only'], true)) {
        return true;
    }

    if ($session === null) {
        return false;
    }

    if ((string) ($session['role'] ?? '') === 'admin') {
        return true;
    }

    $membership = room_membership_record((int) $room['id'], (int) $session['user_id']);

    return $membership !== null && $membership['banned_at'] === null;
}

function room_user_by_handle(mixed $handle): ?array
{
    if (!is_string($handle)) {
        json_error('Handle is required.', 422);
    }

    $normalized = normalize_handle($handle);
    $statement = db_query(
        "SELECT id, handle
         FROM users
         WHERE handle = :handle
           AND status = 'active'
         LIMIT 1",
        ['handle' => $normalized]
    );
    $user = $statement->fetch();

    return is_array($user) ? $user : null;
}

function room_sync_member_count(int $roomId): void
{
    db_query(
        'UPDATE rooms
         SET member_count = (
           SELECT COUNT(*)
           FROM room_memberships
           WHERE room_id = :count_room_id
             AND banned_at IS NULL
         )
         WHERE id = :room_id',
        [
            'count_room_id' => $roomId,
            'room_id' => $roomId,
        ]
    );
}

function room_body_alias_value(array $body, string $primaryKey, string $secondaryKey, mixed $default = null): mixed
{
    if (array_key_exists($primaryKey, $body)) {
        return $body[$primaryKey];
    }

    if (array_key_exists($secondaryKey, $body)) {
        return $body[$secondaryKey];
    }

    return $default;
}

function room_text(mixed $value, string $label, int $minLength, int $maxLength): string
{
    if (!is_string($value)) {
        json_error("{$label} is required.", 422);
    }

    $text = trim(preg_replace('/\s+/', ' ', $value) ?? $value);
    $length = text_length($text);

    if ($length < $minLength || $length > $maxLength || room_contains_html($text)) {
        json_error("{$label} must be {$minLength}-{$maxLength} visible characters without HTML.", 422);
    }

    return $text;
}

function room_optional_text(mixed $value, string $label, int $maxLength): ?string
{
    if ($value === null || $value === '') {
        return null;
    }

    if (!is_string($value)) {
        json_error("{$label} must be text.", 422);
    }

    $text = trim($value);

    if (text_length($text) > $maxLength || room_contains_html($text)) {
        json_error("{$label} must be {$maxLength} characters or fewer without HTML.", 422);
    }

    return $text === '' ? null : $text;
}

function room_optional_token(mixed $value, string $label, int $maxLength): ?string
{
    $text = room_optional_text($value, $label, $maxLength);

    if ($text !== null && !preg_match('/^[a-z0-9][a-z0-9 -]{0,' . ($maxLength - 1) . '}$/', $text)) {
        json_error("{$label} uses unsupported characters.", 422);
    }

    return $text;
}

function room_contains_html(string $value): bool
{
    return $value !== strip_tags($value)
        || preg_match('/<\s*\/?\s*[a-z][^>]*>/i', $value) === 1
        || preg_match('/javascript\s*:/i', $value) === 1;
}

function room_slug_from_value(mixed $value, string $name): string
{
    if ($value === null || $value === '') {
        $slug = strtolower(trim(preg_replace('/[^a-z0-9]+/', '-', $name) ?? ''));
        $slug = trim($slug, '-');
    } elseif (is_string($value)) {
        $slug = strtolower(trim($value));
    } else {
        json_error('Slug must be text.', 422);
    }

    if (!preg_match('/^[a-z0-9](?:[a-z0-9-]{1,78}[a-z0-9])$/', $slug)) {
        json_error('Slug must be 3-80 characters using lowercase letters, numbers, and dashes.', 422);
    }

    return $slug;
}

function room_accent(mixed $value): string
{
    if ($value === null || $value === '') {
        return 'var(--accent-sun)';
    }

    if (!is_string($value) || !in_array($value, ROOM_ACCENTS, true)) {
        json_error('Choose a supported room accent.', 422);
    }

    return $value;
}

function room_upload_url(mixed $value, string $label): ?string
{
    if ($value === null || $value === '') {
        return null;
    }

    if (!is_string($value)) {
        json_error("{$label} must be an uploaded image URL.", 422);
    }

    $url = trim($value);

    if (!preg_match('#^/uploads/media/[0-9]{4}/[0-9]{2}/(?:room_icon|room_banner)-[a-f0-9]{32}\.(?:jpe?g|png|webp|gif)$#', $url)) {
        json_error("{$label} must come from the image upload endpoint.", 422);
    }

    return $url;
}

function room_visibility(mixed $value): string
{
    if (!is_string($value) || !in_array($value, ROOM_VISIBILITIES, true)) {
        json_error('Choose a supported room visibility.', 422);
    }

    return $value;
}

function room_member_payload(array $row): array
{
    $role = (string) ($row['role'] ?? 'member');

    if (!in_array($role, ROOM_ROLES, true)) {
        $role = 'member';
    }

    return [
        'id' => (int) $row['id'],
        'role' => $role,
        'joinedAt' => $row['joined_at'] ?? null,
        'user' => user_payload($row),
    ];
}

function room_grant_owner_badge_if_first_room(int $userId): void
{
    if (!database_table_exists('badges') || !database_table_exists('user_badges')) {
        return;
    }

    $roomCount = db_query(
        'SELECT COUNT(*) AS room_count
         FROM rooms
         WHERE created_by = :user_id',
        ['user_id' => $userId]
    )->fetch();

    if (!is_array($roomCount) || (int) $roomCount['room_count'] !== 1) {
        return;
    }

    db_query(
        "INSERT IGNORE INTO user_badges (user_id, badge_id, granted_by, reason)
         SELECT :user_id, badges.id, NULL, 'Created a public room.'
         FROM badges
         WHERE badges.badge_key = 'room_owner'
           AND badges.is_active = 1
         LIMIT 1",
        ['user_id' => $userId]
    );
}
