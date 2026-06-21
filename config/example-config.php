<?php

declare(strict_types=1);

return [
    'app' => [
        'environment' => 'production',
        'base_url' => 'https://thia.lol',
    ],
    'database' => [
        'host' => 'localhost',
        'name' => '',
        'user' => '',
        'password' => '',
    ],
    'security' => [
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
            'redirect_uri' => 'https://thia.lol/api/integrations/spotify/callback',
        ],
        'apple_music' => [
            'developer_token' => '',
            'storefront' => 'us',
        ],
        'youtube' => [
            'client_id' => '',
            'client_secret' => '',
            'api_key' => '',
            'redirect_uri' => 'https://thia.lol/api/integrations/youtube/callback',
        ],
        'twitch' => [
            'client_id' => '',
            'client_secret' => '',
            'redirect_uri' => 'https://thia.lol/api/integrations/twitch/callback',
            'embed_parent' => 'thia.lol',
        ],
        'github' => [
            'client_id' => '',
            'client_secret' => '',
            'redirect_uri' => 'https://thia.lol/api/integrations/github/callback',
        ],
    ],
];
