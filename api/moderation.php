<?php

declare(strict_types=1);

require_once __DIR__ . '/auth.php';
require_once __DIR__ . '/read.php';

function reports_dispatch(array $segments, string $method): void
{
    if (count($segments) === 1 && $method === 'POST') {
        reports_create();
    }

    if (count($segments) === 1) {
        json_error('Method not allowed.', 405);
    }

    json_error('Not found.', 404);
}

function admin_dispatch(array $segments, string $method): void
{
    if (count($segments) === 2 && $segments[1] === 'rooms' && ($method === 'GET' || $method === 'HEAD')) {
        admin_rooms_index();
    }

    if (count($segments) === 2 && $segments[1] === 'reports' && ($method === 'GET' || $method === 'HEAD')) {
        admin_reports_index();
    }

    if (count($segments) === 4 && $segments[1] === 'posts' && preg_match('/^\d+$/', $segments[2]) === 1 && $segments[3] === 'hide') {
        if ($method === 'POST') {
            admin_posts_hide((int) $segments[2]);
        }

        json_error('Method not allowed.', 405);
    }

    if (count($segments) === 4 && $segments[1] === 'users' && preg_match('/^\d+$/', $segments[2]) === 1 && $segments[3] === 'suspend') {
        if ($method === 'POST') {
            admin_users_suspend((int) $segments[2]);
        }

        json_error('Method not allowed.', 405);
    }

    if (count($segments) === 4 && $segments[1] === 'reports' && preg_match('/^\d+$/', $segments[2]) === 1 && $segments[3] === 'resolve') {
        if ($method === 'POST') {
            admin_reports_resolve((int) $segments[2]);
        }

        json_error('Method not allowed.', 405);
    }

    json_error('Not found.', 404);
}

function reports_create(): void
{
    $session = require_authenticated_session();
    require_csrf_token($session);

    $body = auth_json_body();
    $reason = moderation_reason($body['reason'] ?? null);
    $details = moderation_optional_text($body['details'] ?? null, 2000, 'Report details');
    $postId = moderation_optional_id($body['postId'] ?? $body['post_id'] ?? null, 'Post id');
    $reportedUserId = moderation_optional_id($body['reportedUserId'] ?? $body['reported_user_id'] ?? null, 'Reported user id');

    if ($postId === null && $reportedUserId === null) {
        json_error('Report target is required.', 422);
    }

    if ($postId !== null) {
        $post = moderation_post_record($postId);

        if ($post === null || $post['deleted_at'] !== null || (string) $post['visibility'] !== 'public') {
            json_error('Post not found.', 404);
        }

        $reportedUserId ??= (int) $post['author_id'];
    }

    if ($reportedUserId !== null && moderation_user_record($reportedUserId) === null) {
        json_error('Reported user not found.', 404);
    }

    db_query(
        'INSERT INTO reports (reporter_id, reported_user_id, post_id, reason, details, status)
         VALUES (:reporter_id, :reported_user_id, :post_id, :reason, :details, :status)',
        [
            'reporter_id' => (int) $session['user_id'],
            'reported_user_id' => $reportedUserId,
            'post_id' => $postId,
            'reason' => $reason,
            'details' => $details,
            'status' => 'open',
        ]
    );

    json_success(moderation_report_by_id((int) db()->lastInsertId()), 201);
}

function admin_reports_index(): void
{
    require_moderator_session();

    $statement = db_query(
        moderation_report_select_sql() . "
        ORDER BY FIELD(rep.status, 'open', 'reviewing', 'resolved', 'dismissed'), rep.created_at DESC
        LIMIT 100"
    );

    json_success(array_map('moderation_report_payload', $statement->fetchAll()));
}

function admin_rooms_index(): void
{
    require_moderator_session();

    $statement = db_query(
        "SELECT
            rooms.id AS room_id,
            rooms.slug AS room_slug,
            rooms.name AS room_name,
            rooms.summary AS room_summary,
            rooms.mood AS room_mood,
            " . room_membership_count_select_sql('rooms') . "
            rooms.is_live AS room_is_live,
            rooms.accent AS room_accent,
            " . room_customization_select_sql('rooms') . "
            rooms.visibility AS room_visibility,
            rooms.created_by AS room_created_by,
            NULL AS current_room_role,
            0 AS current_room_joined,
            owner.id AS owner_user_id,
            owner.handle AS owner_handle,
            owner_profile.display_name AS owner_display_name,
            owner_profile.avatar_url AS owner_avatar_url,
            COALESCE(room_posts.post_count, 0) AS room_post_count,
            room_posts.latest_activity_at AS room_latest_activity_at,
            rooms.created_at AS room_created_at,
            rooms.updated_at AS room_updated_at
        FROM rooms
        LEFT JOIN users owner ON owner.id = rooms.created_by
        LEFT JOIN profiles owner_profile ON owner_profile.user_id = owner.id
        " . room_membership_count_join_sql('rooms') . "
        LEFT JOIN (
            SELECT
                room_id,
                SUM(parent_id IS NULL) AS post_count,
                MAX(created_at) AS latest_activity_at
            FROM posts
            WHERE room_id IS NOT NULL
              AND visibility = 'public'
              AND status = 'published'
              AND deleted_at IS NULL
            GROUP BY room_id
        ) room_posts ON room_posts.room_id = rooms.id
        ORDER BY rooms.visibility ASC, room_posts.latest_activity_at DESC, rooms.name ASC
        LIMIT 200"
    );

    json_success(array_map('room_payload', $statement->fetchAll()));
}

function admin_posts_hide(int $postId): void
{
    $session = require_moderator_session();
    require_csrf_token($session);

    $body = auth_json_body();
    $post = moderation_post_record($postId);

    if ($post === null) {
        json_error('Post not found.', 404);
    }

    $reportId = moderation_optional_id($body['reportId'] ?? $body['report_id'] ?? null, 'Report id');
    $notes = moderation_optional_text($body['notes'] ?? null, 2000, 'Moderation notes');

    if ($reportId !== null && moderation_report_exists($reportId) === false) {
        json_error('Report not found.', 404);
    }

    db_query(
        "UPDATE posts
         SET status = 'hidden',
             deleted_at = NULL,
             updated_at = CURRENT_TIMESTAMP()
         WHERE id = :id",
        ['id' => $postId]
    );

    moderation_action_log($session, [
        'action' => 'hide_post',
        'report_id' => $reportId,
        'target_user_id' => (int) $post['author_id'],
        'target_post_id' => $postId,
        'notes' => $notes,
    ]);

    json_success([
        'id' => $postId,
        'status' => 'hidden',
    ]);
}

function admin_users_suspend(int $userId): void
{
    $session = require_moderator_session();
    require_csrf_token($session);

    if ((int) $session['user_id'] === $userId) {
        json_error('You cannot suspend your own account.', 422);
    }

    $body = auth_json_body();
    $user = moderation_user_record($userId);

    if ($user === null) {
        json_error('User not found.', 404);
    }

    if ((string) $user['target_role'] === 'admin' && (string) $session['role'] !== 'admin') {
        json_error('Only admins can suspend admin accounts.', 403);
    }

    $reportId = moderation_optional_id($body['reportId'] ?? $body['report_id'] ?? null, 'Report id');
    $notes = moderation_optional_text($body['notes'] ?? null, 2000, 'Moderation notes');

    if ($reportId !== null && moderation_report_exists($reportId) === false) {
        json_error('Report not found.', 404);
    }

    db_query(
        "UPDATE users
         SET status = 'suspended',
             updated_at = CURRENT_TIMESTAMP()
         WHERE id = :id",
        ['id' => $userId]
    );
    db_query('DELETE FROM sessions WHERE user_id = :user_id', ['user_id' => $userId]);

    moderation_action_log($session, [
        'action' => 'suspend_user',
        'report_id' => $reportId,
        'target_user_id' => $userId,
        'target_post_id' => null,
        'notes' => $notes,
    ]);

    json_success(moderation_user_payload(moderation_user_record($userId), 'target'));
}

function admin_reports_resolve(int $reportId): void
{
    $session = require_moderator_session();
    require_csrf_token($session);

    if (moderation_report_exists($reportId) === false) {
        json_error('Report not found.', 404);
    }

    $body = auth_json_body();
    $status = moderation_report_resolution_status($body['status'] ?? null);
    $notes = moderation_optional_text($body['notes'] ?? null, 2000, 'Resolution notes');

    db_query(
        'UPDATE reports
         SET status = :status,
             reviewed_by = :reviewed_by,
             reviewed_at = CURRENT_TIMESTAMP()
         WHERE id = :id',
        [
            'status' => $status,
            'reviewed_by' => (int) $session['user_id'],
            'id' => $reportId,
        ]
    );

    $report = moderation_report_record($reportId);
    moderation_action_log($session, [
        'action' => $status === 'dismissed' ? 'dismiss_report' : 'note',
        'report_id' => $reportId,
        'target_user_id' => $report['reported_user_id'] === null ? null : (int) $report['reported_user_id'],
        'target_post_id' => $report['post_id'] === null ? null : (int) $report['post_id'],
        'notes' => $notes ?? ($status === 'dismissed' ? 'Report dismissed.' : 'Report resolved.'),
    ]);

    json_success(moderation_report_by_id($reportId));
}

function require_moderator_session(): array
{
    $session = require_authenticated_session();

    if (!in_array((string) $session['role'], ['moderator', 'admin'], true)) {
        json_error('Moderator access is required.', 403);
    }

    return $session;
}

function moderation_reason(mixed $value): string
{
    $allowedReasons = ['spam', 'harassment', 'abuse', 'self_harm', 'illegal', 'other'];

    if (!is_string($value) || !in_array($value, $allowedReasons, true)) {
        json_error('Report reason is required.', 422);
    }

    return $value;
}

function moderation_report_resolution_status(mixed $value): string
{
    if ($value === null || $value === '') {
        return 'resolved';
    }

    if (!is_string($value) || !in_array($value, ['resolved', 'dismissed'], true)) {
        json_error('Report status must be resolved or dismissed.', 422);
    }

    return $value;
}

function moderation_optional_id(mixed $value, string $label): ?int
{
    if ($value === null || $value === '') {
        return null;
    }

    if (!is_int($value) && !(is_string($value) && preg_match('/^\d+$/', $value) === 1)) {
        json_error($label . ' must be numeric.', 422);
    }

    $id = (int) $value;

    if ($id < 1) {
        json_error($label . ' must be numeric.', 422);
    }

    return $id;
}

function moderation_optional_text(mixed $value, int $maxLength, string $label): ?string
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

function moderation_post_record(int $postId): ?array
{
    $statement = db_query(
        'SELECT id, author_id, room_id, visibility, status, deleted_at
         FROM posts
         WHERE id = :id
         LIMIT 1',
        ['id' => $postId]
    );
    $post = $statement->fetch();

    return is_array($post) ? $post : null;
}

function moderation_user_record(int $userId): ?array
{
    $statement = db_query(
        "SELECT
            u.id AS target_user_id,
            u.handle AS target_handle,
            u.email AS target_email,
            u.role AS target_role,
            u.status AS target_status,
            p.display_name AS target_display_name,
            p.avatar_url AS target_avatar_url
         FROM users u
         INNER JOIN profiles p ON p.user_id = u.id
         WHERE u.id = :id
         LIMIT 1",
        ['id' => $userId]
    );
    $user = $statement->fetch();

    return is_array($user) ? $user : null;
}

function moderation_report_record(int $reportId): array
{
    $statement = db_query(
        'SELECT id, reported_user_id, post_id
         FROM reports
         WHERE id = :id
         LIMIT 1',
        ['id' => $reportId]
    );
    $report = $statement->fetch();

    if (!is_array($report)) {
        json_error('Report not found.', 404);
    }

    return $report;
}

function moderation_report_exists(int $reportId): bool
{
    $statement = db_query(
        'SELECT id
         FROM reports
         WHERE id = :id
         LIMIT 1',
        ['id' => $reportId]
    );

    return (bool) $statement->fetch();
}

function moderation_report_by_id(int $reportId): array
{
    $statement = db_query(
        moderation_report_select_sql() . ' WHERE rep.id = :id LIMIT 1',
        ['id' => $reportId]
    );
    $report = $statement->fetch();

    if (!is_array($report)) {
        json_error('Report not found.', 404);
    }

    return moderation_report_payload($report);
}

function moderation_action_log(array $session, array $action): void
{
    db_query(
        'INSERT INTO moderation_actions (moderator_id, report_id, target_user_id, target_post_id, action, notes)
         VALUES (:moderator_id, :report_id, :target_user_id, :target_post_id, :action, :notes)',
        [
            'moderator_id' => (int) $session['user_id'],
            'report_id' => $action['report_id'] ?? null,
            'target_user_id' => $action['target_user_id'] ?? null,
            'target_post_id' => $action['target_post_id'] ?? null,
            'action' => $action['action'],
            'notes' => $action['notes'] ?? null,
        ]
    );
}

function moderation_report_select_sql(): string
{
    return "SELECT
        rep.id AS report_id,
        rep.reason AS report_reason,
        rep.details AS report_details,
        rep.status AS report_status,
        rep.created_at AS report_created_at,
        rep.updated_at AS report_updated_at,
        rep.reviewed_at AS report_reviewed_at,
        reporter.id AS reporter_user_id,
        reporter.handle AS reporter_handle,
        reporter.role AS reporter_role,
        reporter.status AS reporter_status,
        reporter_profile.display_name AS reporter_display_name,
        reported.id AS reported_user_id,
        reported.handle AS reported_handle,
        reported.role AS reported_role,
        reported.status AS reported_status,
        reported_profile.display_name AS reported_display_name,
        reviewer.id AS reviewer_user_id,
        reviewer.handle AS reviewer_handle,
        reviewer.role AS reviewer_role,
        reviewer.status AS reviewer_status,
        reviewer_profile.display_name AS reviewer_display_name,
        p.id AS post_id,
        p.body AS post_body,
        p.status AS post_status,
        p.visibility AS post_visibility,
        p.created_at AS post_created_at,
        post_author.id AS post_author_user_id,
        post_author.handle AS post_author_handle,
        post_author.role AS post_author_role,
        post_author.status AS post_author_status,
        post_author_profile.display_name AS post_author_display_name,
        COALESCE(actions.action_count, 0) AS action_count
    FROM reports rep
    LEFT JOIN users reporter ON reporter.id = rep.reporter_id
    LEFT JOIN profiles reporter_profile ON reporter_profile.user_id = reporter.id
    LEFT JOIN users reported ON reported.id = rep.reported_user_id
    LEFT JOIN profiles reported_profile ON reported_profile.user_id = reported.id
    LEFT JOIN users reviewer ON reviewer.id = rep.reviewed_by
    LEFT JOIN profiles reviewer_profile ON reviewer_profile.user_id = reviewer.id
    LEFT JOIN posts p ON p.id = rep.post_id
    LEFT JOIN users post_author ON post_author.id = p.author_id
    LEFT JOIN profiles post_author_profile ON post_author_profile.user_id = post_author.id
    LEFT JOIN (
        SELECT report_id, COUNT(*) AS action_count
        FROM moderation_actions
        WHERE report_id IS NOT NULL
        GROUP BY report_id
    ) actions ON actions.report_id = rep.id";
}

function moderation_report_payload(array $row): array
{
    return [
        'id' => (int) $row['report_id'],
        'reason' => (string) $row['report_reason'],
        'details' => $row['report_details'] ?? null,
        'status' => (string) $row['report_status'],
        'createdAt' => $row['report_created_at'],
        'updatedAt' => $row['report_updated_at'],
        'reviewedAt' => $row['report_reviewed_at'] ?? null,
        'reporter' => moderation_user_payload($row, 'reporter'),
        'reportedUser' => moderation_user_payload($row, 'reported'),
        'reviewedBy' => moderation_user_payload($row, 'reviewer'),
        'post' => moderation_post_payload($row),
        'actionCount' => (int) ($row['action_count'] ?? 0),
    ];
}

function moderation_user_payload(?array $row, string $prefix): ?array
{
    if ($row === null || ($row[$prefix . '_user_id'] ?? null) === null) {
        return null;
    }

    return [
        'id' => (int) $row[$prefix . '_user_id'],
        'handle' => (string) $row[$prefix . '_handle'],
        'displayName' => (string) $row[$prefix . '_display_name'],
        'role' => (string) $row[$prefix . '_role'],
        'status' => (string) ($row[$prefix . '_status'] ?? 'active'),
    ];
}

function moderation_post_payload(array $row): ?array
{
    if (($row['post_id'] ?? null) === null) {
        return null;
    }

    return [
        'id' => (int) $row['post_id'],
        'body' => (string) $row['post_body'],
        'status' => (string) $row['post_status'],
        'visibility' => (string) $row['post_visibility'],
        'createdAt' => $row['post_created_at'],
        'author' => moderation_user_payload($row, 'post_author'),
    ];
}
