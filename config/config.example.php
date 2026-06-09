<?php

declare(strict_types=1);

return [
    'app' => [
        'name' => 'thia.lol API',
        'environment' => 'production',
        'debug' => false,
    ],
    'security' => [
        'cookie_name' => 'thia_session',
        'cookie_domain' => '',
        'csrf_secret' => 'replace-with-a-long-random-secret',
        'account_setup_token' => '',
        'migration_token' => '',
        'session_lifetime_seconds' => 2592000,
        'login_rate_limit_attempts' => 8,
        'login_rate_limit_window_seconds' => 900,
        'register_rate_limit_attempts' => 5,
        'register_rate_limit_window_seconds' => 3600,
    ],
    'database' => [
        'host' => 'localhost',
        'port' => 3306,
        'name' => 'cpanel_database_name',
        'user' => 'cpanel_database_user',
        'password' => 'replace-me',
        'charset' => 'utf8mb4',
    ],
];
