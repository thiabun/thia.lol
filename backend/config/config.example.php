<?php

declare(strict_types=1);

return [
    'database' => [
        'host' => 'localhost',
        'name' => 'cpanel_database_name',
        'user' => 'cpanel_database_user',
        'password' => 'replace-me',
        'charset' => 'utf8mb4',
    ],
    'app' => [
        'name' => 'thia.lol API',
        'environment' => 'development',
        'base_url' => 'https://thia.lol',
    ],
    'security' => [
        'migration_token' => '',
        'integration_encryption_key' => '',
    ],
    'push' => [
        'vapid_public_key' => '',
        'vapid_private_key' => '',
        'subject' => 'mailto:hello@thia.lol',
        'send_timeout_seconds' => 3,
    ],
    'integrations' => [
        'spotify' => [
            'client_id' => '',
            'client_secret' => '',
            'redirect_uri' => '',
        ],
        'apple_music' => [
            'developer_token' => '',
            'storefront' => 'us',
        ],
        'youtube' => [
            'client_id' => '',
            'client_secret' => '',
            'api_key' => '',
            'redirect_uri' => '',
        ],
        'twitch' => [
            'client_id' => '',
            'client_secret' => '',
            'redirect_uri' => '',
            'embed_parent' => 'thia.lol',
        ],
        'github' => [
            'client_id' => '',
            'client_secret' => '',
            'redirect_uri' => '',
        ],
    ],
];
