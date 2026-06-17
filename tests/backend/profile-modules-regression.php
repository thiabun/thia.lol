<?php

declare(strict_types=1);

require_once dirname(__DIR__, 2) . '/api/profile_modules.php';

$profileModulesSource = file_get_contents(dirname(__DIR__, 2) . '/api/profile_modules.php');

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

function assert_php_rejected(string $code, string $expectedError): void
{
    $apiPath = dirname(__DIR__, 2) . '/api/profile_modules.php';
    $output = shell_exec('php -r ' . escapeshellarg('require ' . var_export($apiPath, true) . '; ' . $code));

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

$profileInfo = profile_module_config('profile_info', [], 123);
assert_true($profileInfo === [], 'profile info config should be empty');

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
assert_true(is_string($profileModulesSource), 'profile modules source should be readable');
assert_true(str_contains($profileModulesSource, 'function profile_modules_restore'), 'restore endpoint should exist');
assert_true(str_contains($profileModulesSource, 'includeDeleted'), 'includeDeleted editor library read should exist');
assert_true(str_contains($profileModulesSource, 'restoreFeaturedPostId'), 'featured post restore snapshot should exist');
assert_true(str_contains($profileModulesSource, 'profile_canvas_reflow_existing_modules'), 'restore should reflow canvas placements');

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
assert_true($payload['layout'] === null, 'payload layout should default to null');

$layoutPayload = profile_module_payload(
    [
        'id' => 8,
        'user_id' => 123,
        'type' => 'activity',
        'title' => 'Activity',
        'config_json' => '{}',
        'visibility' => 'public',
        'position' => 3,
        'grid_column' => 99,
        'grid_row' => 99,
        'grid_col_span' => 3,
        'grid_row_span' => 3,
        'status' => 'active',
        'schema_version' => 1,
        'created_at' => '2026-06-12 00:00:00',
        'updated_at' => '2026-06-12 00:00:00',
    ],
    false
);
assert_true($layoutPayload['layout']['column'] === 4, 'layout column should clamp into 6 columns');
assert_true($layoutPayload['layout']['row'] === 7, 'layout row should clamp into 9 rows');

$invalidLayoutPayload = profile_module_payload(
    [
        'id' => 9,
        'user_id' => 123,
        'type' => 'music',
        'title' => 'Music',
        'config_json' => '{"platform":"spotify","label":"Focus","url":"https://open.spotify.com/playlist/profile-test"}',
        'visibility' => 'public',
        'position' => 4,
        'grid_column' => 1,
        'grid_row' => 1,
        'grid_col_span' => 3,
        'grid_row_span' => 3,
        'status' => 'active',
        'schema_version' => 1,
        'created_at' => '2026-06-12 00:00:00',
        'updated_at' => '2026-06-12 00:00:00',
    ],
    false
);
assert_true($invalidLayoutPayload['layout'] === null, 'invalid saved layout should fall back safely');

$retiredPayload = profile_modules_payload(
    [
        [
            'id' => 10,
            'user_id' => 123,
            'type' => 'featured',
            'title' => 'Retired',
            'config_json' => '{}',
            'visibility' => 'public',
            'position' => 5,
            'status' => 'active',
            'schema_version' => 1,
            'created_at' => '2026-06-12 00:00:00',
            'updated_at' => '2026-06-12 00:00:00',
        ],
    ],
    false
);
assert_true($retiredPayload === [], 'retired modules should be ignored safely');

$clampedPlacement = profile_canvas_module_placement(
    [
        'id' => 8,
        'column' => 99,
        'row' => 99,
        'colSpan' => 3,
        'rowSpan' => 3,
    ],
    [
        'id' => 8,
        'type' => 'activity',
    ],
    true
);
assert_true($clampedPlacement['column'] === 4, 'placement column should clamp');
assert_true($clampedPlacement['row'] === 7, 'placement row should clamp');
assert_true(profile_canvas_background_blur('none') === 'none', 'none blur mismatch');
assert_true(profile_canvas_background_blur('heavy') === 'heavy', 'heavy blur mismatch');

assert_php_rejected(
    'profile_canvas_background_blur("blur(999px)");',
    'Choose a supported background blur.'
);
assert_php_rejected(
    'profile_canvas_module_placement(["id" => 1, "column" => 1, "row" => 1, "colSpan" => 3, "rowSpan" => 3], ["id" => 1, "type" => "music"], true);',
    'Canvas span is not allowed for this module.'
);

$pushedPlacements = profile_canvas_push_collisions(
    [
        ['id' => 1, 'type' => 'about', 'column' => 1, 'row' => 1, 'colSpan' => 2, 'rowSpan' => 1, 'visible' => true],
        ['id' => 2, 'type' => 'links', 'column' => 2, 'row' => 1, 'colSpan' => 2, 'rowSpan' => 1, 'visible' => true],
        ['id' => 3, 'type' => 'music', 'column' => 1, 'row' => 1, 'colSpan' => 2, 'rowSpan' => 1, 'visible' => false],
    ],
    1
);
assert_true($pushedPlacements[0]['id'] === 1, 'anchor module should stay first');
assert_true($pushedPlacements[0]['column'] === 1 && $pushedPlacements[0]['row'] === 1, 'anchor layout should be kept');
assert_true($pushedPlacements[1]['id'] === 2, 'colliding visible module should remain visible');
assert_true($pushedPlacements[1]['column'] === 3 && $pushedPlacements[1]['row'] === 1, 'colliding module should push sideways first');
assert_true($pushedPlacements[2]['id'] === 3 && $pushedPlacements[2]['visible'] === false, 'hidden module should not occupy cells');

$leftPushPlacements = profile_canvas_push_collisions(
    [
        ['id' => 1, 'type' => 'about', 'column' => 5, 'row' => 1, 'colSpan' => 2, 'rowSpan' => 1, 'visible' => true],
        ['id' => 2, 'type' => 'links', 'column' => 4, 'row' => 1, 'colSpan' => 2, 'rowSpan' => 1, 'visible' => true],
        ['id' => 3, 'type' => 'music', 'column' => 1, 'row' => 1, 'colSpan' => 2, 'rowSpan' => 1, 'visible' => true],
    ],
    1
);
$leftPushedModule = array_values(array_filter($leftPushPlacements, fn (array $placement): bool => $placement['id'] === 2))[0];
assert_true($leftPushedModule['column'] === 3 && $leftPushedModule['row'] === 1, 'colliding module should try left on the same row when right is unavailable');

$downwardPushPlacements = profile_canvas_push_collisions(
    [
        ['id' => 1, 'type' => 'about', 'column' => 5, 'row' => 1, 'colSpan' => 2, 'rowSpan' => 1, 'visible' => true],
        ['id' => 2, 'type' => 'links', 'column' => 5, 'row' => 1, 'colSpan' => 2, 'rowSpan' => 1, 'visible' => true],
        ['id' => 3, 'type' => 'music', 'column' => 1, 'row' => 1, 'colSpan' => 2, 'rowSpan' => 1, 'visible' => true],
        ['id' => 4, 'type' => 'creator_live', 'column' => 3, 'row' => 1, 'colSpan' => 2, 'rowSpan' => 1, 'visible' => true],
    ],
    1
);
$downwardPushedModule = array_values(array_filter($downwardPushPlacements, fn (array $placement): bool => $placement['id'] === 2))[0];
assert_true($downwardPushedModule['column'] === 5 && $downwardPushedModule['row'] === 2, 'colliding module should move downward only after same-row fits fail');

assert_php_rejected(
    '$items = []; for ($i = 1; $i <= 7; $i++) { $items[] = ["id" => $i, "type" => "profile_info", "column" => 1, "row" => 1, "colSpan" => 3, "rowSpan" => 3, "visible" => true]; } profile_canvas_push_collisions($items, 1);',
    'Canvas layout does not fit the 6 by 9 grid.'
);

echo "profile modules regression ok\n";
