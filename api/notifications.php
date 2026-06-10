<?php

declare(strict_types=1);

require_once __DIR__ . '/auth.php';
require_once __DIR__ . '/read.php';

const NOTIFICATION_TYPES = ['follow', 'moot', 'like', 'reply', 'reblog', 'message'];

function notifications_dispatch(array $segments, string $method): void
{
    if (($segments[0] ?? null) !== 'notifications') {
        json_error('Not found.', 404);
    }

    if (count($segments) === 1 && ($method === 'GET' || $method === 'HEAD')) {
        notifications_index();
    }

    if (count($segments) === 2 && $segments[1] === 'read' && $method === 'POST') {
        notifications_read();
    }

    if (count($segments) === 2 && $segments[1] === 'read-all' && $method === 'POST') {
        notifications_read_all();
    }

    if (
        count($segments) === 3 &&
        preg_match('/^\d+$/', $segments[1]) === 1 &&
        $segments[2] === 'read' &&
        $method === 'POST'
    ) {
        notifications_read_one((int) $segments[1]);
    }

    json_error('Method not allowed.', 405);
}

function notifications_index(): void
{
    $session = require_authenticated_session();
    require_notifications_table();
    $userId = (int) $session['user_id'];

    $statement = db_query(
        "SELECT
            n.id,
            n.user_id,
            n.actor_id,
            n.type,
            n.post_id,
            n.room_id,
            n.data,
            n.read_at,
            n.created_at,
            actor.handle AS actor_handle,
            actor_profile.display_name AS actor_display_name,
            actor_profile.avatar_url AS actor_avatar_url,
            p.body AS post_body,
            p.created_at AS post_created_at,
            post_author.id AS post_author_user_id,
            post_author.handle AS post_author_handle,
            post_author_profile.display_name AS post_author_display_name,
            post_author_profile.avatar_url AS post_author_avatar_url,
            r.id AS joined_room_id,
            r.slug AS room_slug,
            r.name AS room_name,
            r.summary AS room_summary,
            r.mood AS room_mood,
            r.member_count AS room_member_count,
            r.is_live AS room_is_live,
            r.accent AS room_accent,
            r.visibility AS room_visibility,
            r.created_by AS room_created_by,
            room_owner.id AS owner_user_id,
            room_owner.handle AS owner_handle,
            room_owner_profile.display_name AS owner_display_name,
            room_owner_profile.avatar_url AS owner_avatar_url,
            0 AS room_post_count,
            NULL AS room_latest_activity_at,
            r.created_at AS room_created_at,
            r.updated_at AS room_updated_at
         FROM notifications n
         LEFT JOIN users actor ON actor.id = n.actor_id
         LEFT JOIN profiles actor_profile ON actor_profile.user_id = actor.id
         LEFT JOIN posts p ON p.id = n.post_id
         LEFT JOIN users post_author ON post_author.id = p.author_id
         LEFT JOIN profiles post_author_profile ON post_author_profile.user_id = post_author.id
         LEFT JOIN rooms r ON r.id = COALESCE(n.room_id, p.room_id)
         LEFT JOIN users room_owner ON room_owner.id = r.created_by
         LEFT JOIN profiles room_owner_profile ON room_owner_profile.user_id = room_owner.id
         WHERE n.user_id = :user_id
         ORDER BY n.created_at DESC, n.id DESC
         LIMIT 50",
        ['user_id' => $userId]
    );

    $count = db_query(
        'SELECT COUNT(*) AS unread_count
         FROM notifications
         WHERE user_id = :user_id
           AND read_at IS NULL',
        ['user_id' => $userId]
    )->fetch();

    json_success([
        'notifications' => array_map('notification_payload', $statement->fetchAll()),
        'unreadCount' => is_array($count) ? (int) $count['unread_count'] : 0,
    ]);
}

function notifications_read(): void
{
    $session = require_authenticated_session();
    require_csrf_token($session);
    require_notifications_table();

    $body = request_json_body();
    $ids = [];

    if (isset($body['id'])) {
        $ids[] = notification_id_from_value($body['id']);
    }

    if (isset($body['ids'])) {
        if (!is_array($body['ids'])) {
            json_error('Notification ids must be an array.', 422);
        }

        foreach ($body['ids'] as $id) {
            $ids[] = notification_id_from_value($id);
        }
    }

    $ids = array_values(array_unique($ids));

    if ($ids === []) {
        json_error('At least one notification id is required.', 422);
    }

    if (count($ids) > 100) {
        json_error('Too many notification ids.', 422);
    }

    mark_notifications_read((int) $session['user_id'], $ids);
}

function notifications_read_one(int $notificationId): void
{
    $session = require_authenticated_session();
    require_csrf_token($session);
    require_notifications_table();

    mark_notifications_read((int) $session['user_id'], [$notificationId]);
}

function notifications_read_all(): void
{
    $session = require_authenticated_session();
    require_csrf_token($session);
    require_notifications_table();
    $readAt = current_database_timestamp();

    db_query(
        'UPDATE notifications
         SET read_at = COALESCE(read_at, :read_at)
         WHERE user_id = :user_id
           AND read_at IS NULL',
        [
            'read_at' => $readAt,
            'user_id' => (int) $session['user_id'],
        ]
    );

    json_success([
        'readAt' => $readAt,
        'unreadCount' => 0,
    ]);
}

function mark_notifications_read(int $userId, array $ids): void
{
    $readAt = current_database_timestamp();
    $placeholders = [];
    $params = [
        'read_at' => $readAt,
        'user_id' => $userId,
    ];

    foreach ($ids as $index => $id) {
        $key = 'id_' . $index;
        $placeholders[] = ':' . $key;
        $params[$key] = $id;
    }

    db_query(
        sprintf(
            'UPDATE notifications
             SET read_at = COALESCE(read_at, :read_at)
             WHERE user_id = :user_id
               AND id IN (%s)',
            implode(', ', $placeholders)
        ),
        $params
    );

    json_success([
        'ids' => $ids,
        'readAt' => $readAt,
        'unreadCount' => unread_notification_count($userId),
    ]);
}

function notification_id_from_value(mixed $value): int
{
    if (!is_int($value) && !(is_string($value) && preg_match('/^\d+$/', $value) === 1)) {
        json_error('Notification id must be numeric.', 422);
    }

    $id = (int) $value;

    if ($id < 1) {
        json_error('Notification id must be numeric.', 422);
    }

    return $id;
}

function current_database_timestamp(): string
{
    $row = db_query('SELECT CURRENT_TIMESTAMP() AS now')->fetch();

    return is_array($row) ? (string) $row['now'] : gmdate('Y-m-d H:i:s');
}

function unread_notification_count(int $userId): int
{
    $row = db_query(
        'SELECT COUNT(*) AS unread_count
         FROM notifications
         WHERE user_id = :user_id
           AND read_at IS NULL',
        ['user_id' => $userId]
    )->fetch();

    return is_array($row) ? (int) $row['unread_count'] : 0;
}

function notification_payload(array $row): array
{
    $type = (string) $row['type'];
    $actor = notification_actor_payload($row);
    $post = notification_post_payload($row);
    $room = notification_room_payload($row);

    return [
        'id' => (int) $row['id'],
        'type' => $type,
        'createdAt' => $row['created_at'],
        'readAt' => $row['read_at'] ?? null,
        'actor' => $actor,
        'post' => $post,
        'room' => $room,
        'targetUrl' => notification_target_url($type, $actor, $post, $room),
        'data' => notification_data_payload($row['data'] ?? null),
    ];
}

function notification_actor_payload(array $row): ?array
{
    if (($row['actor_id'] ?? null) === null || ($row['actor_handle'] ?? null) === null) {
        return null;
    }

    return user_payload([
        'user_id' => $row['actor_id'],
        'handle' => $row['actor_handle'],
        'display_name' => $row['actor_display_name'] ?? $row['actor_handle'],
        'avatar_url' => $row['actor_avatar_url'] ?? null,
    ]);
}

function notification_post_payload(array $row): ?array
{
    if (($row['post_id'] ?? null) === null || ($row['post_body'] ?? null) === null) {
        return null;
    }

    $author = null;

    if (($row['post_author_user_id'] ?? null) !== null) {
        $author = user_payload([
            'user_id' => $row['post_author_user_id'],
            'handle' => $row['post_author_handle'],
            'display_name' => $row['post_author_display_name'] ?? $row['post_author_handle'],
            'avatar_url' => $row['post_author_avatar_url'] ?? null,
        ]);
    }

    return [
        'id' => (int) $row['post_id'],
        'bodySnippet' => notification_snippet((string) $row['post_body'], 140),
        'author' => $author,
        'createdAt' => $row['post_created_at'] ?? null,
    ];
}

function notification_room_payload(array $row): ?array
{
    if (($row['joined_room_id'] ?? null) === null || ($row['room_slug'] ?? null) === null) {
        return null;
    }

    return room_payload([
        'room_id' => $row['joined_room_id'],
        'room_slug' => $row['room_slug'],
        'room_name' => $row['room_name'],
        'room_summary' => $row['room_summary'],
        'room_mood' => $row['room_mood'],
        'room_member_count' => $row['room_member_count'],
        'room_is_live' => $row['room_is_live'],
        'room_accent' => $row['room_accent'],
        'room_visibility' => $row['room_visibility'],
        'room_created_by' => $row['room_created_by'],
        'owner_user_id' => $row['owner_user_id'],
        'owner_handle' => $row['owner_handle'],
        'owner_display_name' => $row['owner_display_name'],
        'owner_avatar_url' => $row['owner_avatar_url'],
        'room_post_count' => $row['room_post_count'],
        'room_latest_activity_at' => $row['room_latest_activity_at'],
        'room_created_at' => $row['room_created_at'],
        'room_updated_at' => $row['room_updated_at'],
    ]);
}

function notification_data_payload(mixed $value): ?array
{
    if (!is_string($value) || trim($value) === '') {
        return null;
    }

    try {
        $decoded = json_decode($value, true, 512, JSON_THROW_ON_ERROR);
    } catch (JsonException) {
        return null;
    }

    return is_array($decoded) ? $decoded : null;
}

function notification_target_url(string $type, ?array $actor, ?array $post, ?array $room): string
{
    if ($type === 'message') {
        return '/chat';
    }

    if (in_array($type, ['follow', 'moot'], true) && $actor !== null) {
        return '/@' . rawurlencode((string) $actor['handle']);
    }

    if ($post !== null && is_array($post['author'] ?? null)) {
        return sprintf(
            '/@%s#post-%d',
            rawurlencode((string) $post['author']['handle']),
            (int) $post['id']
        );
    }

    if ($room !== null) {
        return '/rooms/' . rawurlencode((string) $room['slug']);
    }

    return '/';
}

function notification_snippet(string $value, int $maxLength): string
{
    $normalized = trim(preg_replace('/\s+/', ' ', $value) ?? $value);

    if (strlen($normalized) <= $maxLength) {
        return $normalized;
    }

    return rtrim(substr($normalized, 0, $maxLength - 3)) . '...';
}

function notification_create(
    int $userId,
    ?int $actorId,
    string $type,
    ?int $postId = null,
    ?int $roomId = null,
    ?array $data = null,
    bool $dedupe = false
): void {
    if ($actorId !== null && $userId === $actorId) {
        return;
    }

    if (!in_array($type, NOTIFICATION_TYPES, true) || !notifications_table_exists()) {
        return;
    }

    if ($dedupe && notification_exists($userId, $actorId, $type, $postId, $roomId)) {
        return;
    }

    $jsonData = $data === null ? null : json_encode($data, JSON_UNESCAPED_SLASHES);

    db_query(
        'INSERT INTO notifications (user_id, actor_id, type, post_id, room_id, data)
         VALUES (:user_id, :actor_id, :type, :post_id, :room_id, :data)',
        [
            'user_id' => $userId,
            'actor_id' => $actorId,
            'type' => $type,
            'post_id' => $postId,
            'room_id' => $roomId,
            'data' => $jsonData === false ? null : $jsonData,
        ]
    );
}

function notification_exists(
    int $userId,
    ?int $actorId,
    string $type,
    ?int $postId,
    ?int $roomId
): bool {
    $statement = db_query(
        'SELECT id
         FROM notifications
         WHERE user_id = :user_id
           AND actor_id <=> :actor_id
           AND type = :type
           AND post_id <=> :post_id
           AND room_id <=> :room_id
         LIMIT 1',
        [
            'user_id' => $userId,
            'actor_id' => $actorId,
            'type' => $type,
            'post_id' => $postId,
            'room_id' => $roomId,
        ]
    );

    return (bool) $statement->fetch();
}

function require_notifications_table(): void
{
    if (!notifications_table_exists()) {
        json_error('Notification storage is not ready. Run pending migrations.', 503);
    }
}

function notifications_table_exists(): bool
{
    return database_table_exists('notifications');
}
