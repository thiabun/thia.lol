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

$about = profile_module_config('about', ['body' => 'A concise personal note.'], 123);
assert_true($about['body'] === 'A concise personal note.', 'about body mismatch');

$activity = profile_module_config('activity', [], 123);
assert_true($activity === [], 'activity config should be empty');

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
