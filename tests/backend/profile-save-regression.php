<?php

declare(strict_types=1);

require_once dirname(__DIR__, 2) . '/api/profile.php';

function assert_true(bool $condition, string $message): void
{
    if (!$condition) {
        fwrite(STDERR, $message . PHP_EOL);
        exit(1);
    }
}

$legacyNoopPayload = [
    'displayName' => 'Thia',
    'bio' => 'Founder profile for thia.lol.',
    'location' => 'Oslo',
    'avatarUrl' => null,
    'bannerUrl' => null,
    'profileBackground' => null,
    'profileAccent' => null,
    'profileTheme' => null,
    'profileLayoutPreset' => 'compact',
    'links' => ['https://thia.lol/'],
];

$withCustomization = profile_update_statement_for_body($legacyNoopPayload, 123, true, true);
assert_true(in_array('avatar_url = :avatar_url', $withCustomization['updates'], true), 'avatar_url update missing');
assert_true(in_array('banner_url = :banner_url', $withCustomization['updates'], true), 'banner_url update missing');
assert_true(in_array('profile_layout_preset = :profile_layout_preset', $withCustomization['updates'], true), 'profile_layout_preset update missing');
assert_true(array_key_exists('avatar_url', $withCustomization['params']), 'avatar_url param missing');
assert_true($withCustomization['params']['avatar_url'] === null, 'avatar_url null was not preserved');
assert_true($withCustomization['params']['banner_url'] === null, 'banner_url null was not preserved');
assert_true($withCustomization['params']['profile_layout_preset'] === 'compact', 'profile_layout_preset param mismatch');
assert_true(is_string($withCustomization['params']['links']), 'links param was not JSON encoded');

$withoutCustomization = profile_update_statement_for_body($legacyNoopPayload, 123, false, true);
assert_true(in_array('avatar_url = :avatar_url', $withoutCustomization['updates'], true), 'avatar_url update missing without customization columns');
assert_true(!in_array('banner_url = :banner_url', $withoutCustomization['updates'], true), 'banner_url should be omitted without customization columns');
assert_true(!array_key_exists('banner_url', $withoutCustomization['params']), 'banner_url param should be omitted without customization columns');

$snakeCasePayload = [
    'display_name' => 'Thia',
    'avatar_url' => null,
    'banner_url' => null,
    'profile_background' => null,
    'profile_accent' => null,
    'profile_theme' => null,
    'profile_layout_preset' => 'showcase',
    'links' => [
        [
            'platform' => 'github',
            'value' => 'thiabun',
            'url' => 'https://github.com/thiabun',
        ],
    ],
];

$snakeCase = profile_update_statement_for_body($snakeCasePayload, 123, true, true);
assert_true($snakeCase['params']['display_name'] === 'Thia', 'display_name param mismatch');
assert_true($snakeCase['params']['avatar_url'] === null, 'snake_case avatar null was not preserved');
assert_true($snakeCase['params']['profile_layout_preset'] === 'showcase', 'snake_case profile_layout_preset mismatch');

echo "profile save regression ok\n";
