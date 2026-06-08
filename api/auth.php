<?php

declare(strict_types=1);

require_once __DIR__ . '/db.php';

const AUTH_GENERIC_LOGIN_ERROR = 'Invalid email or password.';

function auth_dispatch(string $action, string $method): void
{
    if ($action === 'register' && $method === 'POST') {
        auth_register();
    }

    if ($action === 'login' && $method === 'POST') {
        auth_login();
    }

    if ($action === 'logout' && $method === 'POST') {
        auth_logout();
    }

    if ($action === 'me' && ($method === 'GET' || $method === 'HEAD')) {
        auth_me();
    }

    if (in_array($action, ['register', 'login', 'logout', 'me'], true)) {
        json_error('Method not allowed.', 405);
    }

    json_error('Not found.', 404);
}

function auth_register(): void
{
    $body = auth_json_body();
    $email = validate_email($body['email'] ?? null);
    $password = validate_password($body['password'] ?? null);
    $handle = validate_handle($body['handle'] ?? null);
    $displayName = validate_display_name($body['displayName'] ?? $body['display_name'] ?? null);

    rate_limit_consume(
        'register',
        client_ip_address(),
        security_config_int('register_rate_limit_attempts', 5),
        security_config_int('register_rate_limit_window_seconds', 3600)
    );

    try {
        db()->beginTransaction();

        db_query(
            'INSERT INTO users (handle, email, password_hash, role)
             VALUES (:handle, :email, :password_hash, :role)',
            [
                'handle' => $handle,
                'email' => $email,
                'password_hash' => password_hash($password, PASSWORD_DEFAULT),
                'role' => 'member',
            ]
        );

        $userId = (int) db()->lastInsertId();

        db_query(
            'INSERT INTO profiles (user_id, display_name, bio, location, avatar_url, links, traits)
             VALUES (:user_id, :display_name, NULL, NULL, NULL, JSON_ARRAY(), JSON_ARRAY())',
            [
                'user_id' => $userId,
                'display_name' => $displayName,
            ]
        );

        db()->commit();
    } catch (PDOException $exception) {
        if (db()->inTransaction()) {
            db()->rollBack();
        }

        if ($exception->getCode() === '23000') {
            json_error('Email or handle is already in use.', 409);
        }

        throw $exception;
    } catch (Throwable $exception) {
        if (db()->inTransaction()) {
            db()->rollBack();
        }

        throw $exception;
    }

    $session = create_session_for_user($userId);

    json_success([
        'user' => auth_user_payload($session),
        'profile' => auth_profile_payload($session),
        'csrfToken' => csrf_token_for_session($session),
    ], 201);
}

function auth_login(): void
{
    $body = auth_json_body();
    $email = validate_email($body['email'] ?? null);
    $password = is_string($body['password'] ?? null) ? (string) $body['password'] : '';

    rate_limit_consume(
        'login',
        client_ip_address() . '|' . $email,
        security_config_int('login_rate_limit_attempts', 8),
        security_config_int('login_rate_limit_window_seconds', 900)
    );

    $statement = db_query(
        'SELECT id, password_hash, status
         FROM users
         WHERE email = :email
         LIMIT 1',
        ['email' => $email]
    );
    $user = $statement->fetch();

    if (
        !is_array($user) ||
        (string) ($user['status'] ?? 'active') !== 'active' ||
        !is_string($user['password_hash']) ||
        !password_verify($password, $user['password_hash'])
    ) {
        json_error(AUTH_GENERIC_LOGIN_ERROR, 401);
    }

    $session = create_session_for_user((int) $user['id']);

    json_success([
        'user' => auth_user_payload($session),
        'profile' => auth_profile_payload($session),
        'csrfToken' => csrf_token_for_session($session),
    ]);
}

function auth_logout(): void
{
    $token = session_cookie_token();

    if ($token !== null) {
        db_query(
            'DELETE FROM sessions
             WHERE token_hash = :token_hash',
            ['token_hash' => hash_session_token($token)]
        );
    }

    clear_session_cookie();
    json_success(['loggedOut' => true]);
}

function auth_me(): void
{
    $session = current_session();

    if ($session === null) {
        json_error('Unauthenticated.', 401);
    }

    json_success([
        'user' => auth_user_payload($session),
        'profile' => auth_profile_payload($session),
        'csrfToken' => csrf_token_for_session($session),
    ]);
}

function require_authenticated_session(): array
{
    $session = current_session();

    if ($session === null) {
        json_error('Unauthenticated.', 401);
    }

    return $session;
}

function require_csrf_token(array $session): void
{
    $provided = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';

    if (!is_string($provided) || $provided === '') {
        json_error('CSRF token is required.', 403);
    }

    if (!hash_equals(csrf_token_for_session($session), $provided)) {
        json_error('Invalid CSRF token.', 403);
    }
}

function auth_json_body(): array
{
    $body = request_json_body();

    if (array_is_list($body)) {
        json_error('JSON body must be an object.', 400);
    }

    return $body;
}

function validate_email(mixed $value): string
{
    if (!is_string($value)) {
        json_error('Email is required.', 422);
    }

    $email = strtolower(trim($value));

    if (strlen($email) > 191 || filter_var($email, FILTER_VALIDATE_EMAIL) === false) {
        json_error('Enter a valid email address.', 422);
    }

    return $email;
}

function validate_password(mixed $value): string
{
    if (!is_string($value)) {
        json_error('Password is required.', 422);
    }

    $length = strlen($value);

    if ($length < 10 || $length > 255) {
        json_error('Password must be between 10 and 255 characters.', 422);
    }

    return $value;
}

function validate_handle(mixed $value): string
{
    if (!is_string($value)) {
        json_error('Handle is required.', 422);
    }

    $handle = strtolower(trim(ltrim($value, '@')));

    if (!preg_match('/^[a-z0-9](?:[a-z0-9_-]{1,38}[a-z0-9])$/', $handle)) {
        json_error('Handle must be 3-40 characters using letters, numbers, dashes, or underscores.', 422);
    }

    return $handle;
}

function validate_display_name(mixed $value): string
{
    if (!is_string($value)) {
        json_error('Display name is required.', 422);
    }

    $displayName = trim($value);
    $length = text_length($displayName);

    if ($length < 1 || $length > 120 || preg_match('/[\x00-\x1F\x7F]/', $displayName)) {
        json_error('Display name must be 1-120 visible characters.', 422);
    }

    return $displayName;
}

function text_length(string $value): int
{
    if (function_exists('mb_strlen')) {
        return mb_strlen($value);
    }

    return strlen($value);
}

function rate_limit_consume(string $action, string $identifier, int $maxAttempts, int $windowSeconds): void
{
    $identifierHash = hash('sha256', $action . '|' . $identifier);
    $cutoff = gmdate('Y-m-d H:i:s', time() - $windowSeconds);

    db_query(
        "INSERT INTO auth_rate_limits (action, identifier_hash, attempts, window_starts_at, last_attempt_at)
         VALUES (:action, :identifier_hash, 1, UTC_TIMESTAMP(), UTC_TIMESTAMP())
         ON DUPLICATE KEY UPDATE
           attempts = IF(window_starts_at < :cutoff_for_attempts, 1, attempts + 1),
           window_starts_at = IF(window_starts_at < :cutoff_for_window, UTC_TIMESTAMP(), window_starts_at),
           last_attempt_at = UTC_TIMESTAMP()",
        [
            'action' => $action,
            'identifier_hash' => $identifierHash,
            'cutoff_for_attempts' => $cutoff,
            'cutoff_for_window' => $cutoff,
        ]
    );

    $statement = db_query(
        'SELECT attempts, window_starts_at
         FROM auth_rate_limits
         WHERE action = :action
           AND identifier_hash = :identifier_hash
         LIMIT 1',
        [
            'action' => $action,
            'identifier_hash' => $identifierHash,
        ]
    );
    $row = $statement->fetch();

    if (is_array($row) && (int) $row['attempts'] > $maxAttempts) {
        json_error('Too many attempts. Please try again later.', 429);
    }
}

function create_session_for_user(int $userId): array
{
    cleanup_expired_sessions();

    $token = base64_url_encode(random_bytes(32));
    $tokenHash = hash_session_token($token);
    $expiresAt = time() + security_config_int('session_lifetime_seconds', 2592000);

    db_query(
        'INSERT INTO sessions (user_id, token_hash, user_agent, ip_address, expires_at, last_seen_at)
         VALUES (:user_id, :token_hash, :user_agent, :ip_address, :expires_at, UTC_TIMESTAMP())',
        [
            'user_id' => $userId,
            'token_hash' => $tokenHash,
            'user_agent' => substr((string) ($_SERVER['HTTP_USER_AGENT'] ?? ''), 0, 255),
            'ip_address' => packed_client_ip(),
            'expires_at' => gmdate('Y-m-d H:i:s', $expiresAt),
        ]
    );

    set_session_cookie($token, $expiresAt);

    $session = session_by_token_hash($tokenHash);

    if ($session === null) {
        throw new RuntimeException('Created session could not be loaded.');
    }

    return $session;
}

function current_session(): ?array
{
    $token = session_cookie_token();

    if ($token === null) {
        return null;
    }

    $session = session_by_token_hash(hash_session_token($token));

    if ($session === null) {
        clear_session_cookie();
        return null;
    }

    db_query(
        'UPDATE sessions
         SET last_seen_at = UTC_TIMESTAMP()
         WHERE id = :id',
        ['id' => (int) $session['session_id']]
    );

    return $session;
}

function session_by_token_hash(string $tokenHash): ?array
{
    $statement = db_query(
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
         WHERE s.token_hash = :token_hash
           AND s.expires_at > UTC_TIMESTAMP()
           AND u.status = 'active'
         LIMIT 1",
        ['token_hash' => $tokenHash]
    );

    $row = $statement->fetch();

    return is_array($row) ? $row : null;
}

function cleanup_expired_sessions(): void
{
    db_query('DELETE FROM sessions WHERE expires_at <= UTC_TIMESTAMP()');
}

function session_cookie_token(): ?string
{
    $cookie = $_COOKIE[session_cookie_name()] ?? null;

    if (!is_string($cookie) || $cookie === '') {
        return null;
    }

    return $cookie;
}

function set_session_cookie(string $token, int $expiresAt): void
{
    setcookie(session_cookie_name(), $token, [
        'expires' => $expiresAt,
        'path' => '/',
        'secure' => true,
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
}

function clear_session_cookie(): void
{
    setcookie(session_cookie_name(), '', [
        'expires' => time() - 3600,
        'path' => '/',
        'secure' => true,
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
}

function session_cookie_name(): string
{
    $name = (string) (api_config()['security']['cookie_name'] ?? 'thia_session');

    return preg_match('/^[A-Za-z0-9_-]+$/', $name) ? $name : 'thia_session';
}

function csrf_token_for_session(array $session): string
{
    $message = implode('|', [
        'csrf',
        (string) $session['session_id'],
        (string) $session['user_id'],
        (string) $session['token_hash'],
    ]);

    return base64_url_encode(hash_hmac('sha256', $message, csrf_secret(), true));
}

function csrf_secret(): string
{
    $secret = (string) (api_config()['security']['csrf_secret'] ?? '');

    if ($secret === '') {
        $secret = 'development-csrf-secret-change-me';
    }

    return $secret;
}

function auth_user_payload(array $row): array
{
    return [
        'id' => (int) $row['user_id'],
        'handle' => (string) $row['handle'],
        'email' => (string) $row['email'],
        'role' => (string) $row['role'],
        'status' => (string) ($row['status'] ?? 'active'),
        'displayName' => (string) $row['display_name'],
        'avatarUrl' => $row['avatar_url'] ?? null,
    ];
}

function auth_profile_payload(array $row): array
{
    return [
        'displayName' => (string) $row['display_name'],
        'bio' => (string) ($row['bio'] ?? ''),
        'location' => (string) ($row['location'] ?? ''),
        'avatarUrl' => $row['avatar_url'] ?? null,
        'links' => json_array_from_string($row['links'] ?? null),
        'traits' => json_array_from_string($row['traits'] ?? null),
    ];
}

function json_array_from_string(?string $value): array
{
    if ($value === null || $value === '') {
        return [];
    }

    try {
        $decoded = json_decode($value, true, 512, JSON_THROW_ON_ERROR);
    } catch (JsonException) {
        return [];
    }

    return is_array($decoded) ? array_values($decoded) : [];
}

function hash_session_token(string $token): string
{
    return hash('sha256', $token);
}

function security_config_int(string $key, int $default): int
{
    $value = api_config()['security'][$key] ?? $default;

    return is_numeric($value) ? max(1, (int) $value) : $default;
}

function client_ip_address(): string
{
    return (string) ($_SERVER['REMOTE_ADDR'] ?? '0.0.0.0');
}

function packed_client_ip(): ?string
{
    $packed = @inet_pton(client_ip_address());

    return $packed === false ? null : $packed;
}

function base64_url_encode(string $bytes): string
{
    return rtrim(strtr(base64_encode($bytes), '+/', '-_'), '=');
}
