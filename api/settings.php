<?php

declare(strict_types=1);

require_once __DIR__ . '/auth.php';
require_once __DIR__ . '/read.php';
require_once __DIR__ . '/account_security.php';

const ACCOUNT_HANDLE_COOLDOWN_SECONDS = 2592000;
const ACCOUNT_DELETION_GRACE_SECONDS = 2592000;

function settings_dispatch(array $segments, string $method): void
{
    if (($segments[0] ?? null) !== 'me') {
        json_error('Not found.', 404);
    }

    if (count($segments) === 2 && $segments[1] === 'settings') {
        if ($method === 'GET' || $method === 'HEAD') {
            settings_show();
        }

        json_error('Method not allowed.', 405);
    }

    if (($segments[1] ?? null) === 'account') {
        settings_account_dispatch($segments, $method);
    }

    if (($segments[1] ?? null) === 'security' && ($segments[2] ?? null) === '2fa') {
        settings_two_factor_dispatch($segments, $method);
    }

    if (count($segments) === 2 && $segments[1] === 'privacy') {
        if ($method === 'PATCH') {
            settings_privacy_update();
        }

        json_error('Method not allowed.', 405);
    }

    if (count($segments) === 2 && $segments[1] === 'preferences') {
        if ($method === 'PATCH') {
            settings_preferences_update();
        }

        json_error('Method not allowed.', 405);
    }

    if (($segments[1] ?? null) === 'follow-requests') {
        settings_follow_requests_dispatch($segments, $method);
    }

    if (count($segments) === 2 && $segments[1] === 'posts') {
        if ($method === 'GET' || $method === 'HEAD') {
            settings_posts_index();
        }

        if ($method === 'DELETE') {
            settings_posts_delete_bulk();
        }

        json_error('Method not allowed.', 405);
    }

    json_error('Not found.', 404);
}

function settings_account_dispatch(array $segments, string $method): void
{
    if (count($segments) === 2 && $method === 'DELETE') {
        settings_account_delete_schedule();
    }

    if (count($segments) === 3 && $method === 'PATCH') {
        if ($segments[2] === 'email') {
            settings_email_update();
        }

        if ($segments[2] === 'handle') {
            settings_handle_update();
        }

        if ($segments[2] === 'password') {
            settings_password_update();
        }
    }

    if (count($segments) === 3 && $segments[2] === 'deletion') {
        if ($method === 'DELETE') {
            settings_account_delete_schedule();
        }

        json_error('Method not allowed.', 405);
    }

    if (count($segments) === 4 && $segments[2] === 'deletion' && $segments[3] === 'cancel') {
        if ($method === 'POST') {
            settings_account_delete_cancel();
        }

        json_error('Method not allowed.', 405);
    }

    json_error('Not found.', 404);
}

function settings_two_factor_dispatch(array $segments, string $method): void
{
    if (count($segments) === 4 && $segments[3] === 'setup') {
        if ($method === 'POST') {
            settings_two_factor_setup();
        }

        json_error('Method not allowed.', 405);
    }

    if (count($segments) === 4 && $segments[3] === 'enable') {
        if ($method === 'POST') {
            settings_two_factor_enable();
        }

        json_error('Method not allowed.', 405);
    }

    if (count($segments) === 4 && $segments[3] === 'recovery-codes') {
        if ($method === 'POST') {
            settings_two_factor_recovery_codes();
        }

        json_error('Method not allowed.', 405);
    }

    if (count($segments) === 3) {
        if ($method === 'DELETE') {
            settings_two_factor_disable();
        }

        json_error('Method not allowed.', 405);
    }

    json_error('Not found.', 404);
}

function settings_follow_requests_dispatch(array $segments, string $method): void
{
    if (count($segments) === 2) {
        if ($method === 'GET' || $method === 'HEAD') {
            settings_follow_requests_index();
        }

        json_error('Method not allowed.', 405);
    }

    if (count($segments) === 4 && $segments[3] === 'approve') {
        if ($method === 'POST') {
            settings_follow_request_approve((int) $segments[2]);
        }

        json_error('Method not allowed.', 405);
    }

    if (count($segments) === 3) {
        if ($method === 'DELETE') {
            settings_follow_request_deny((int) $segments[2]);
        }

        json_error('Method not allowed.', 405);
    }

    json_error('Not found.', 404);
}

function settings_show(): void
{
    $session = require_authenticated_session();
    settings_require_storage();
    settings_ensure_preferences((int) $session['user_id']);

    json_success(settings_payload($session));
}

function settings_email_update(): void
{
    $session = settings_authenticated_mutation();
    $body = request_json_body();
    settings_require_password($session, $body['currentPassword'] ?? $body['current_password'] ?? null);
    $email = validate_email($body['email'] ?? null);

    try {
        db_query(
            'UPDATE users
             SET email = :email,
                 updated_at = CURRENT_TIMESTAMP()
             WHERE id = :user_id',
            [
                'email' => $email,
                'user_id' => (int) $session['user_id'],
            ]
        );
    } catch (PDOException $exception) {
        if ($exception->getCode() === '23000') {
            json_error('Email is already in use.', 409);
        }

        throw $exception;
    }

    json_success(settings_payload(settings_reload_session((int) $session['session_id'])));
}

function settings_handle_update(): void
{
    $session = settings_authenticated_mutation();
    $body = request_json_body();
    settings_require_password($session, $body['currentPassword'] ?? $body['current_password'] ?? null);
    $nextHandle = validate_handle($body['handle'] ?? null);
    $currentHandle = (string) $session['handle'];

    if ($nextHandle === $currentHandle) {
        json_success(settings_payload($session));
    }

    settings_reject_handle_cooldown((int) $session['user_id']);
    settings_reject_reserved_handle($nextHandle, (int) $session['user_id']);

    try {
        db()->beginTransaction();

        db_query(
            'UPDATE users
             SET handle = :handle,
                 updated_at = CURRENT_TIMESTAMP()
             WHERE id = :user_id',
            [
                'handle' => $nextHandle,
                'user_id' => (int) $session['user_id'],
            ]
        );

        db_query(
            'INSERT INTO user_handle_history (user_id, old_handle, new_handle, reserved_until)
             VALUES (:user_id, :old_handle, :new_handle, :reserved_until)',
            [
                'user_id' => (int) $session['user_id'],
                'old_handle' => $currentHandle,
                'new_handle' => $nextHandle,
                'reserved_until' => gmdate('Y-m-d H:i:s', time() + ACCOUNT_HANDLE_COOLDOWN_SECONDS),
            ]
        );

        db()->commit();
    } catch (PDOException $exception) {
        if (db()->inTransaction()) {
            db()->rollBack();
        }

        if ($exception->getCode() === '23000') {
            json_error('Handle is already in use.', 409);
        }

        throw $exception;
    } catch (Throwable $exception) {
        if (db()->inTransaction()) {
            db()->rollBack();
        }

        throw $exception;
    }

    json_success(settings_payload(settings_reload_session((int) $session['session_id'])));
}

function settings_password_update(): void
{
    $session = settings_authenticated_mutation();
    $body = request_json_body();
    settings_require_password($session, $body['currentPassword'] ?? $body['current_password'] ?? null);
    $password = validate_password($body['newPassword'] ?? $body['new_password'] ?? null);

    db()->beginTransaction();

    db_query(
        'UPDATE users
         SET password_hash = :password_hash,
             updated_at = CURRENT_TIMESTAMP()
         WHERE id = :user_id',
        [
            'password_hash' => password_hash($password, PASSWORD_DEFAULT),
            'user_id' => (int) $session['user_id'],
        ]
    );

    db_query(
        'DELETE FROM sessions
         WHERE user_id = :user_id
           AND id <> :session_id',
        [
            'user_id' => (int) $session['user_id'],
            'session_id' => (int) $session['session_id'],
        ]
    );

    db()->commit();

    json_success([
        'changed' => true,
    ]);
}

function settings_privacy_update(): void
{
    $session = settings_authenticated_mutation();
    $body = request_json_body();
    $visibility = settings_profile_visibility($body['profileVisibility'] ?? $body['profile_visibility'] ?? null);

    db_query(
        'UPDATE profiles
         SET visibility = :visibility,
             updated_at = CURRENT_TIMESTAMP()
         WHERE user_id = :user_id',
        [
            'visibility' => $visibility,
            'user_id' => (int) $session['user_id'],
        ]
    );

    json_success(settings_payload($session));
}

function settings_preferences_update(): void
{
    $session = settings_authenticated_mutation();
    $body = request_json_body();
    settings_ensure_preferences((int) $session['user_id']);

    $preferences = settings_preferences_input($body);

    db_query(
        'UPDATE user_preferences
         SET analytics_consent = :analytics_consent,
             personalization_consent = :personalization_consent,
             rich_embeds_consent = :rich_embeds_consent,
             autoplay_media_consent = :autoplay_media_consent,
             sensitive_content_visible = :sensitive_content_visible,
             notification_preferences_json = :notification_preferences_json,
             email_notification_preferences_json = :email_notification_preferences_json,
             push_notification_preferences_json = :push_notification_preferences_json,
             updated_at = CURRENT_TIMESTAMP()
         WHERE user_id = :user_id',
        [
            'user_id' => (int) $session['user_id'],
            'analytics_consent' => $preferences['analyticsConsent'] ? 1 : 0,
            'personalization_consent' => $preferences['personalizationConsent'] ? 1 : 0,
            'rich_embeds_consent' => $preferences['richEmbedsConsent'] ? 1 : 0,
            'autoplay_media_consent' => $preferences['autoplayMediaConsent'] ? 1 : 0,
            'sensitive_content_visible' => $preferences['sensitiveContentVisible'] ? 1 : 0,
            'notification_preferences_json' => json_encode($preferences['notifications'], JSON_THROW_ON_ERROR),
            'email_notification_preferences_json' => json_encode($preferences['emailNotifications'], JSON_THROW_ON_ERROR),
            'push_notification_preferences_json' => json_encode($preferences['pushNotifications'], JSON_THROW_ON_ERROR),
        ]
    );

    json_success(settings_payload($session));
}

function settings_two_factor_setup(): void
{
    $session = settings_authenticated_mutation();
    $body = request_json_body();
    settings_require_password($session, $body['currentPassword'] ?? $body['current_password'] ?? null);

    json_success([
        'setup' => account_two_factor_setup_payload($session),
        'twoFactor' => account_two_factor_status((int) $session['user_id']),
    ]);
}

function settings_two_factor_enable(): void
{
    $session = settings_authenticated_mutation();
    $body = request_json_body();
    $code = is_string($body['code'] ?? null) ? (string) $body['code'] : '';
    $result = account_two_factor_enable((int) $session['user_id'], $code);

    json_success([
        'twoFactor' => account_two_factor_status((int) $session['user_id']),
        'backupCodes' => $result['backupCodes'],
    ]);
}

function settings_two_factor_disable(): void
{
    $session = settings_authenticated_mutation();
    $body = request_json_body();
    settings_require_password($session, $body['currentPassword'] ?? $body['current_password'] ?? null);
    account_two_factor_disable((int) $session['user_id']);

    json_success([
        'twoFactor' => account_two_factor_status((int) $session['user_id']),
    ]);
}

function settings_two_factor_recovery_codes(): void
{
    $session = settings_authenticated_mutation();
    $body = request_json_body();
    settings_require_password($session, $body['currentPassword'] ?? $body['current_password'] ?? null);
    $codes = account_two_factor_regenerate_backup_codes((int) $session['user_id']);

    json_success([
        'backupCodes' => $codes,
        'twoFactor' => account_two_factor_status((int) $session['user_id']),
    ]);
}

function settings_follow_requests_index(): void
{
    $session = settings_authenticated_mutation(false);
    settings_require_follow_request_storage();

    $rows = db_query(
        'SELECT
            requests.id,
            requests.created_at,
            requester.id AS user_id,
            requester.handle,
            requester_profile.display_name,
            requester_profile.avatar_url,
            requester_profile.bio
         FROM user_follow_requests requests
         INNER JOIN users requester ON requester.id = requests.requester_id
         INNER JOIN profiles requester_profile ON requester_profile.user_id = requester.id
         WHERE requests.target_user_id = :user_id
           AND requests.status = :status
           AND requester.status = :active
         ORDER BY requests.created_at ASC',
        [
            'user_id' => (int) $session['user_id'],
            'status' => 'pending',
            'active' => 'active',
        ]
    )->fetchAll();

    json_success(array_map('settings_follow_request_payload', $rows));
}

function settings_follow_request_approve(int $requestId): void
{
    $session = settings_authenticated_mutation();
    settings_require_follow_request_storage();

    $request = settings_follow_request_for_owner($requestId, (int) $session['user_id']);

    db()->beginTransaction();

    db_query(
        'UPDATE user_follow_requests
         SET status = :status,
             updated_at = CURRENT_TIMESTAMP()
         WHERE id = :id',
        [
            'status' => 'approved',
            'id' => $requestId,
        ]
    );

    db_query(
        'INSERT IGNORE INTO user_follows (follower_id, following_id)
         VALUES (:follower_id, :following_id)',
        [
            'follower_id' => (int) $request['requester_id'],
            'following_id' => (int) $session['user_id'],
        ]
    );

    db()->commit();

    json_success(['approved' => true]);
}

function settings_follow_request_deny(int $requestId): void
{
    $session = settings_authenticated_mutation();
    settings_require_follow_request_storage();
    settings_follow_request_for_owner($requestId, (int) $session['user_id']);

    db_query(
        'UPDATE user_follow_requests
         SET status = :status,
             updated_at = CURRENT_TIMESTAMP()
         WHERE id = :id',
        [
            'status' => 'denied',
            'id' => $requestId,
        ]
    );

    json_success(['denied' => true]);
}

function settings_posts_index(): void
{
    $session = settings_authenticated_mutation(false);
    $kind = settings_post_kind($_GET['kind'] ?? 'all');
    $where = settings_posts_kind_where($kind);

    $rows = db_query(
        "SELECT id, public_id, parent_id, body, media_url, status, deleted_at, created_at
         FROM posts
         WHERE author_id = :user_id
           {$where}
         ORDER BY created_at DESC
         LIMIT 100",
        ['user_id' => (int) $session['user_id']]
    )->fetchAll();

    json_success(array_map(static function (array $row): array {
        return [
            'id' => (int) $row['id'],
            'publicId' => $row['public_id'] ?? null,
            'kind' => $row['parent_id'] === null ? 'post' : 'reply',
            'body' => (string) $row['body'],
            'mediaUrl' => $row['media_url'] ?? null,
            'status' => (string) $row['status'],
            'deletedAt' => $row['deleted_at'] ?? null,
            'createdAt' => $row['created_at'] ?? null,
        ];
    }, $rows));
}

function settings_posts_delete_bulk(): void
{
    $session = settings_authenticated_mutation();
    $kind = settings_post_kind($_GET['kind'] ?? 'all');
    $where = settings_posts_kind_where($kind);

    $statement = db_query(
        "UPDATE posts
         SET status = 'removed',
             deleted_at = COALESCE(deleted_at, CURRENT_TIMESTAMP()),
             updated_at = CURRENT_TIMESTAMP()
         WHERE author_id = :user_id
           AND deleted_at IS NULL
           {$where}",
        ['user_id' => (int) $session['user_id']]
    );

    json_success([
        'deletedCount' => $statement->rowCount(),
        'kind' => $kind,
    ]);
}

function settings_account_delete_schedule(): void
{
    $session = settings_authenticated_mutation();
    $body = request_json_body();
    settings_require_password($session, $body['currentPassword'] ?? $body['current_password'] ?? null);
    $reason = settings_optional_text($body['reason'] ?? null, 255);
    $scheduledFor = gmdate('Y-m-d H:i:s', time() + ACCOUNT_DELETION_GRACE_SECONDS);

    db()->beginTransaction();

    db_query(
        'INSERT INTO account_deletion_requests (user_id, requested_at, scheduled_for, reason)
         VALUES (:user_id, UTC_TIMESTAMP(), :scheduled_for, :reason)
         ON DUPLICATE KEY UPDATE
           requested_at = UTC_TIMESTAMP(),
           scheduled_for = VALUES(scheduled_for),
           canceled_at = NULL,
           completed_at = NULL,
           reason = VALUES(reason),
           updated_at = CURRENT_TIMESTAMP()',
        [
            'user_id' => (int) $session['user_id'],
            'scheduled_for' => $scheduledFor,
            'reason' => $reason,
        ]
    );

    db_query(
        'DELETE FROM sessions
         WHERE user_id = :user_id',
        ['user_id' => (int) $session['user_id']]
    );

    db()->commit();
    clear_session_cookie();

    json_success([
        'scheduled' => true,
        'scheduledFor' => $scheduledFor,
    ]);
}

function settings_account_delete_cancel(): void
{
    $session = settings_authenticated_mutation();

    db_query(
        'UPDATE account_deletion_requests
         SET canceled_at = UTC_TIMESTAMP(),
             updated_at = CURRENT_TIMESTAMP()
         WHERE user_id = :user_id
           AND canceled_at IS NULL
           AND completed_at IS NULL',
        ['user_id' => (int) $session['user_id']]
    );

    json_success(settings_payload($session));
}

function settings_authenticated_mutation(bool $csrf = true): array
{
    $session = require_authenticated_session();

    if ($csrf) {
        require_csrf_token($session);
    }

    settings_require_storage();

    return $session;
}

function settings_require_storage(): void
{
    if (!database_column_exists('profiles', 'visibility') || !database_table_exists('user_preferences')) {
        json_error('Account settings storage is not ready. Run pending migrations.', 503);
    }
}

function settings_require_follow_request_storage(): void
{
    if (!database_table_exists('user_follow_requests') || !database_table_exists('user_follows')) {
        json_error('Follow request storage is not ready. Run pending migrations.', 503);
    }
}

function settings_payload(array $session): array
{
    $userId = (int) $session['user_id'];
    settings_ensure_preferences($userId);
    $profile = settings_profile_row($userId);
    $preferences = settings_preferences_row($userId);
    $deletion = settings_deletion_row($userId);

    return [
        'account' => [
            'id' => $userId,
            'handle' => (string) $session['handle'],
            'email' => (string) $session['email'],
            'displayName' => (string) $session['display_name'],
            'status' => (string) ($session['status'] ?? 'active'),
            'handleChange' => settings_handle_change_state($userId),
        ],
        'privacy' => [
            'profileVisibility' => settings_profile_visibility($profile['visibility'] ?? 'public'),
        ],
        'preferences' => settings_preferences_payload($preferences),
        'twoFactor' => account_two_factor_status($userId),
        'deletion' => $deletion === null ? null : [
            'requestedAt' => $deletion['requested_at'],
            'scheduledFor' => $deletion['scheduled_for'],
            'canceledAt' => $deletion['canceled_at'],
            'completedAt' => $deletion['completed_at'],
        ],
    ];
}

function settings_reload_session(int $sessionId): array
{
    $row = db_query(
        "SELECT
            s.id AS session_id,
            s.user_id,
            s.token_hash,
            s.expires_at,
            u.handle,
            u.email,
            u.role,
            u.status,
            p.display_name,
            p.bio,
            p.location,
            p.avatar_url,
            p.links,
            p.traits
         FROM sessions s
         INNER JOIN users u ON u.id = s.user_id
         INNER JOIN profiles p ON p.user_id = u.id
         WHERE s.id = :session_id
         LIMIT 1",
        ['session_id' => $sessionId]
    )->fetch();

    if (!is_array($row)) {
        json_error('Session not found.', 401);
    }

    return $row;
}

function settings_profile_row(int $userId): array
{
    $row = db_query(
        'SELECT visibility
         FROM profiles
         WHERE user_id = :user_id
         LIMIT 1',
        ['user_id' => $userId]
    )->fetch();

    return is_array($row) ? $row : ['visibility' => 'public'];
}

function settings_preferences_row(int $userId): array
{
    $row = db_query(
        'SELECT *
         FROM user_preferences
         WHERE user_id = :user_id
         LIMIT 1',
        ['user_id' => $userId]
    )->fetch();

    return is_array($row) ? $row : [];
}

function settings_ensure_preferences(int $userId): void
{
    if (!database_table_exists('user_preferences')) {
        return;
    }

    db_query(
        'INSERT IGNORE INTO user_preferences (user_id, notification_preferences_json, email_notification_preferences_json, push_notification_preferences_json)
         VALUES (:user_id, JSON_OBJECT(), JSON_OBJECT(), JSON_OBJECT())',
        ['user_id' => $userId]
    );
}

function settings_deletion_row(int $userId): ?array
{
    if (!database_table_exists('account_deletion_requests')) {
        return null;
    }

    $row = db_query(
        'SELECT requested_at, scheduled_for, canceled_at, completed_at
         FROM account_deletion_requests
         WHERE user_id = :user_id
         ORDER BY requested_at DESC
         LIMIT 1',
        ['user_id' => $userId]
    )->fetch();

    return is_array($row) ? $row : null;
}

function settings_preferences_payload(array $row): array
{
    return [
        'analyticsConsent' => (bool) ($row['analytics_consent'] ?? false),
        'personalizationConsent' => (bool) ($row['personalization_consent'] ?? true),
        'richEmbedsConsent' => (bool) ($row['rich_embeds_consent'] ?? true),
        'autoplayMediaConsent' => (bool) ($row['autoplay_media_consent'] ?? false),
        'sensitiveContentVisible' => (bool) ($row['sensitive_content_visible'] ?? false),
        'notifications' => settings_json_object($row['notification_preferences_json'] ?? null),
        'emailNotifications' => settings_json_object($row['email_notification_preferences_json'] ?? null),
        'pushNotifications' => settings_json_object($row['push_notification_preferences_json'] ?? null),
    ];
}

function settings_preferences_input(array $body): array
{
    $current = settings_preferences_payload([]);

    return [
        'analyticsConsent' => settings_bool($body['analyticsConsent'] ?? $body['analytics_consent'] ?? $current['analyticsConsent']),
        'personalizationConsent' => settings_bool($body['personalizationConsent'] ?? $body['personalization_consent'] ?? $current['personalizationConsent']),
        'richEmbedsConsent' => settings_bool($body['richEmbedsConsent'] ?? $body['rich_embeds_consent'] ?? $current['richEmbedsConsent']),
        'autoplayMediaConsent' => settings_bool($body['autoplayMediaConsent'] ?? $body['autoplay_media_consent'] ?? $current['autoplayMediaConsent']),
        'sensitiveContentVisible' => settings_bool($body['sensitiveContentVisible'] ?? $body['sensitive_content_visible'] ?? $current['sensitiveContentVisible']),
        'notifications' => settings_preference_map($body['notifications'] ?? []),
        'emailNotifications' => settings_preference_map($body['emailNotifications'] ?? $body['email_notifications'] ?? []),
        'pushNotifications' => settings_preference_map($body['pushNotifications'] ?? $body['push_notifications'] ?? []),
    ];
}

function settings_preference_map(mixed $value): array
{
    if (!is_array($value) || array_is_list($value)) {
        return [];
    }

    $allowed = ['mentions', 'follows', 'moots', 'messages', 'likes', 'replies', 'reblogs', 'badges', 'reports'];
    $result = [];

    foreach ($allowed as $key) {
        if (array_key_exists($key, $value)) {
            $result[$key] = settings_bool($value[$key]);
        }
    }

    return $result;
}

function settings_json_object(mixed $value): array
{
    if (!is_string($value) || $value === '') {
        return [];
    }

    try {
        $decoded = json_decode($value, true, 512, JSON_THROW_ON_ERROR);
    } catch (JsonException) {
        return [];
    }

    return is_array($decoded) && !array_is_list($decoded) ? $decoded : [];
}

function settings_bool(mixed $value): bool
{
    if (is_bool($value)) {
        return $value;
    }

    if (is_numeric($value)) {
        return (int) $value === 1;
    }

    if (is_string($value)) {
        return in_array(strtolower(trim($value)), ['1', 'true', 'yes', 'on'], true);
    }

    return false;
}

function settings_profile_visibility(mixed $value): string
{
    return $value === 'private' ? 'private' : 'public';
}

function settings_require_password(array $session, mixed $value): void
{
    if (!is_string($value) || $value === '') {
        json_error('Current password is required.', 422);
    }

    $row = db_query(
        'SELECT password_hash
         FROM users
         WHERE id = :user_id
         LIMIT 1',
        ['user_id' => (int) $session['user_id']]
    )->fetch();

    if (!is_array($row) || !is_string($row['password_hash'] ?? null) || !password_verify($value, (string) $row['password_hash'])) {
        json_error('Current password is incorrect.', 403);
    }
}

function settings_reject_handle_cooldown(int $userId): void
{
    $row = db_query(
        'SELECT created_at
         FROM user_handle_history
         WHERE user_id = :user_id
         ORDER BY created_at DESC
         LIMIT 1',
        ['user_id' => $userId]
    )->fetch();

    if (!is_array($row)) {
        return;
    }

    $nextAllowedAt = strtotime((string) $row['created_at']) + ACCOUNT_HANDLE_COOLDOWN_SECONDS;

    if ($nextAllowedAt > time()) {
        json_error('You can change your handle again after ' . gmdate('Y-m-d', $nextAllowedAt) . '.', 429);
    }
}

function settings_reject_reserved_handle(string $handle, int $userId): void
{
    $row = db_query(
        'SELECT user_id
         FROM user_handle_history
         WHERE old_handle = :handle
           AND reserved_until > UTC_TIMESTAMP()
         ORDER BY created_at DESC
         LIMIT 1',
        ['handle' => $handle]
    )->fetch();

    if (is_array($row) && (int) $row['user_id'] !== $userId) {
        json_error('Handle is temporarily reserved.', 409);
    }
}

function settings_handle_change_state(int $userId): array
{
    if (!database_table_exists('user_handle_history')) {
        return ['canChange' => true, 'nextAllowedAt' => null];
    }

    $row = db_query(
        'SELECT created_at
         FROM user_handle_history
         WHERE user_id = :user_id
         ORDER BY created_at DESC
         LIMIT 1',
        ['user_id' => $userId]
    )->fetch();

    if (!is_array($row)) {
        return ['canChange' => true, 'nextAllowedAt' => null];
    }

    $nextAllowedAt = strtotime((string) $row['created_at']) + ACCOUNT_HANDLE_COOLDOWN_SECONDS;

    return [
        'canChange' => $nextAllowedAt <= time(),
        'nextAllowedAt' => gmdate('c', $nextAllowedAt),
    ];
}

function settings_follow_request_for_owner(int $requestId, int $userId): array
{
    $row = db_query(
        'SELECT id, requester_id, target_user_id
         FROM user_follow_requests
         WHERE id = :id
           AND target_user_id = :user_id
           AND status = :status
         LIMIT 1',
        [
            'id' => $requestId,
            'user_id' => $userId,
            'status' => 'pending',
        ]
    )->fetch();

    if (!is_array($row)) {
        json_error('Follow request not found.', 404);
    }

    return $row;
}

function settings_follow_request_payload(array $row): array
{
    return [
        'id' => (int) $row['id'],
        'createdAt' => $row['created_at'],
        'user' => user_payload($row),
        'bioSnippet' => profile_bio_snippet($row['bio'] ?? ''),
    ];
}

function settings_post_kind(mixed $value): string
{
    return in_array($value, ['posts', 'replies', 'all'], true) ? (string) $value : 'all';
}

function settings_posts_kind_where(string $kind): string
{
    if ($kind === 'posts') {
        return 'AND parent_id IS NULL';
    }

    if ($kind === 'replies') {
        return 'AND parent_id IS NOT NULL';
    }

    return '';
}

function settings_optional_text(mixed $value, int $max): ?string
{
    if ($value === null) {
        return null;
    }

    if (!is_string($value)) {
        json_error('Value must be text.', 422);
    }

    $trimmed = trim($value);

    if ($trimmed === '') {
        return null;
    }

    if (text_length($trimmed) > $max) {
        json_error('Value is too long.', 422);
    }

    return $trimmed;
}
