<?php

declare(strict_types=1);

return [
    'app' => [
        'name' => 'thia.lol',
        'environment' => 'test',
        'debug' => true,
        'base_url' => 'http://localhost:5173',
    ],
    'security' => [
        'cookie_name' => 'thia_lol_test_session',
        'cookie_domain' => '',
        'csrf_secret' => '',
        'account_setup_token' => '',
        'migration_token' => '',
        'session_lifetime_seconds' => 2592000,
        'login_rate_limit_attempts' => 8,
        'login_rate_limit_window_seconds' => 900,
        'register_rate_limit_attempts' => 5,
        'register_rate_limit_window_seconds' => 3600,
        'integration_encryption_key' => '',
    ],
    'database' => [
        'host' => '',
        'port' => 3306,
        'name' => '',
        'user' => '',
        'password' => '',
        'charset' => 'utf8mb4',
    ],
    'integrations' => [
        'spotify' => [
            'client_id' => '',
            'client_secret' => '',
            'redirect_uri' => 'http://localhost:5173/api/integrations/spotify/callback',
        ],
        'apple_music' => [
            'developer_token' => '',
            'storefront' => 'us',
        ],
        'youtube' => [
            'client_id' => '',
            'client_secret' => '',
            'api_key' => '',
            'redirect_uri' => 'http://localhost:5173/api/integrations/youtube/callback',
        ],
        'twitch' => [
            'client_id' => '',
            'client_secret' => '',
            'redirect_uri' => 'http://localhost:5173/api/integrations/twitch/callback',
            'embed_parent' => 'localhost',
        ],
        'github' => [
            'client_id' => '',
            'client_secret' => '',
            'redirect_uri' => 'http://localhost:5173/api/integrations/github/callback',
        ],
    ],
];
