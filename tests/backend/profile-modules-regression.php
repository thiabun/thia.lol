<?php

declare(strict_types=1);

require_once dirname(__DIR__, 2) . '/api/profile_modules.php';

function assert_true(bool $condition, string $message): void
{
    if (!$condition) {
        fwrite(STDERR, $message . PHP_EOL);
        exit(1);
    }
}

function assert_module_config_rejected(string $type, array $config, string $expectedError): void
{
    $apiPath = dirname(__DIR__, 2) . '/api/profile_modules.php';
    $code = 'require ' . var_export($apiPath, true) . '; profile_module_config('
        . var_export($type, true)
        . ', '
        . var_export($config, true)
        . ', 123);';
    $output = shell_exec('php -r ' . escapeshellarg($code));

    assert_true(is_string($output), 'rejection subprocess did not return output');
    assert_true(str_contains($output, $expectedError), "expected rejection containing {$expectedError}");
}

$about = profile_module_config('about', ['body' => 'A concise personal note.'], 123);
assert_true($about['body'] === 'A concise personal note.', 'about body mismatch');

$aboutStatus = profile_module_config(
    'about',
    [
        'statusText' => 'Frostveil focus',
        'workingOn' => 'Expressive profile modules',
    ],
    123
);
assert_true($aboutStatus['statusText'] === 'Frostveil focus', 'about status mismatch');
assert_true($aboutStatus['workingOn'] === 'Expressive profile modules', 'about working-on mismatch');

$activity = profile_module_config('activity', [], 123);
assert_true($activity === [], 'activity config should be empty');

$featuredPost = profile_module_config('featured_post', [], 123);
assert_true($featuredPost === [], 'featured post config should be empty');

$featuredRoom = profile_module_config('featured_room', [], 123);
assert_true($featuredRoom === [], 'featured room config should be empty');

$customText = profile_module_config(
    'custom_text',
    [
        'body' => 'Plain text with an optional link.',
        'link' => [
            'label' => 'Personal site',
            'url' => 'https://example.com/about',
        ],
    ],
    123
);
assert_true($customText['link']['url'] === 'https://example.com/about', 'custom text link mismatch');

$links = profile_module_config(
    'links',
    [
        'links' => [
            ['label' => 'Site', 'url' => 'https://example.com'],
            ['label' => 'Site duplicate', 'url' => 'https://example.com/'],
            ['label' => 'GitHub', 'url' => 'https://github.com/thiabun'],
        ],
    ],
    123
);
assert_true(count($links['links']) === 2, 'links should be deduped by normalized URL');
assert_true($links['links'][0]['url'] === 'https://example.com/', 'root URL should normalize with slash');
assert_true($links['links'][1]['platform'] === 'github', 'link platform should be inferred');

$gallery = profile_module_config(
    'gallery_media',
    [
        'mediaItems' => [
            [
                'url' => '/uploads/media/2026/06/profile-gallery-one.webp',
                'caption' => 'Studio corner',
            ],
        ],
    ],
    123
);
assert_true($gallery['mediaItems'][0]['url'] === '/uploads/media/2026/06/profile-gallery-one.webp', 'gallery media URL mismatch');

$creator = profile_module_config(
    'creator_live',
    [
        'platform' => 'twitch',
        'label' => 'Find me live',
        'url' => 'https://www.twitch.tv/thiabun',
        'description' => 'Streams and build notes.',
    ],
    123
);
assert_true($creator['platform'] === 'twitch', 'creator platform mismatch');
assert_true($creator['label'] === 'Find me live', 'creator label mismatch');

$music = profile_module_config(
    'music',
    [
        'platform' => 'spotify',
        'label' => 'Focus playlist',
        'url' => 'https://open.spotify.com/playlist/profile-test',
        'description' => 'No autoplay.',
    ],
    123
);
assert_true($music['platform'] === 'spotify', 'music platform mismatch');
assert_true($music['url'] === 'https://open.spotify.com/playlist/profile-test', 'music URL mismatch');

assert_module_config_rejected(
    'links',
    [
        'links' => [
            ['label' => 'Unsafe', 'url' => 'javascript:alert(1)'],
        ],
    ],
    'Link URL is invalid.'
);
assert_module_config_rejected(
    'gallery_media',
    [
        'mediaItems' => [
            ['url' => 'https://example.com/not-an-upload.webp'],
        ],
    ],
    'Gallery image must come from the image upload endpoint.'
);
assert_module_config_rejected(
    'creator_live',
    [
        'platform' => 'github',
        'label' => 'Wrong host',
        'url' => 'https://www.twitch.tv/thiabun',
    ],
    'Creator link does not match the selected platform.'
);
assert_module_config_rejected(
    'music',
    [
        'platform' => 'spotify',
        'label' => 'Embed attempt',
        'url' => 'https://open.spotify.com/playlist/profile-test',
        'iframe' => '<iframe></iframe>',
    ],
    'Unsupported module field was provided.'
);

$payload = profile_module_payload(
    [
        'id' => 7,
        'user_id' => 123,
        'type' => 'custom_text',
        'title' => 'Note',
        'config_json' => json_encode($customText, JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES),
        'visibility' => 'public',
        'position' => 2,
        'status' => 'active',
        'schema_version' => 1,
        'created_at' => '2026-06-12 00:00:00',
        'updated_at' => '2026-06-12 00:00:00',
    ],
    false
);
assert_true($payload['schemaVersion'] === 1, 'schema version mismatch');
assert_true($payload['config']['body'] === $customText['body'], 'payload config mismatch');

echo "profile modules regression ok\n";
