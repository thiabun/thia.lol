<?php

declare(strict_types=1);

require_once __DIR__ . '/auth.php';
require_once __DIR__ . '/db.php';

function setup_dispatch(array $segments, string $method): void
{
    if (count($segments) === 2 && $segments[1] === 'thia') {
        if ($method !== 'POST') {
            json_error('Method not allowed.', 405);
        }

        setup_activate_thia();
    }

    json_error('Not found.', 404);
}

function setup_activate_thia(): void
{
    setup_require_token();

    $body = auth_json_body();
    $email = validate_email($body['email'] ?? null);
    $password = validate_password($body['password'] ?? null);

    $statement = db_query(
        "UPDATE users
         SET email = :email,
             password_hash = :password_hash,
             role = 'admin',
             status = 'active'
         WHERE handle = 'thia'
         LIMIT 1",
        [
            'email' => $email,
            'password_hash' => password_hash($password, PASSWORD_DEFAULT),
        ]
    );

    if ($statement->rowCount() < 1) {
        json_error('Seeded thia account was not found.', 404);
    }

    json_success([
        'activated' => true,
        'handle' => 'thia',
    ]);
}

function setup_require_token(): void
{
    $expected = api_config()['security']['account_setup_token'] ?? '';

    if (!is_string($expected) || trim($expected) === '') {
        json_error('Account setup is disabled.', 404);
    }

    $provided = $_SERVER['HTTP_X_SETUP_TOKEN'] ?? '';

    if (!is_string($provided) || !hash_equals($expected, $provided)) {
        json_error('Invalid setup token.', 403);
    }
}
