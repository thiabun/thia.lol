<?php

declare(strict_types=1);

if (getenv('THIA_CONFIG_PATH') === false) {
    $fallbackConfigPath = sys_get_temp_dir() . '/thia-profile-modules-test-config.php';
    $key = base64_encode(str_repeat('m', SODIUM_CRYPTO_SECRETBOX_KEYBYTES));

    file_put_contents(
        $fallbackConfigPath,
        "<?php return ['database' => ['host' => 'localhost', 'name' => 'test', 'user' => 'test'], 'app' => ['environment' => 'development', 'base_url' => 'https://thia.lol'], 'security' => ['integration_encryption_key' => '{$key}'], 'integrations' => ['twitch' => ['embed_parent' => 'thia.lol']]];"
    );
    putenv('THIA_CONFIG_PATH=' . $fallbackConfigPath);
}

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

$connectionHandles = profile_module_config(
    'connections',
    [
        'links' => [
            ['label' => 'GitHub', 'platform' => 'github', 'url' => 'thiabun'],
            ['label' => 'Twitch', 'platform' => 'twitch', 'url' => '@thiabun'],
            ['label' => 'Site', 'platform' => 'website', 'url' => 'example.com'],
            ['label' => 'Bluesky', 'platform' => 'bluesky', 'url' => 'thiabun.bsky.social'],
        ],
    ],
    123
);
assert_true($connectionHandles['links'][0]['url'] === 'https://github.com/thiabun', 'GitHub handle should normalize to a profile URL');
assert_true($connectionHandles['links'][1]['url'] === 'https://www.twitch.tv/thiabun', 'Twitch handle should normalize to a profile URL');
assert_true($connectionHandles['links'][2]['url'] === 'https://example.com/', 'Website domain should normalize to HTTPS');
assert_true($connectionHandles['links'][3]['url'] === 'https://bsky.app/profile/thiabun.bsky.social', 'Bluesky handle should normalize to a profile URL');

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
        'displayMode' => 'stream_chat',
        'sourceMode' => 'twitch',
    ],
    123
);
assert_true($creator['platform'] === 'twitch', 'creator platform mismatch');
assert_true($creator['label'] === 'Find me live', 'creator label mismatch');
assert_true($creator['displayMode'] === 'stream_chat', 'creator display mode mismatch');
assert_true($creator['sourceMode'] === 'twitch', 'creator source mode mismatch');

$music = profile_module_config(
    'music',
    [
        'platform' => 'spotify',
        'label' => 'Focus playlist',
        'url' => 'https://open.spotify.com/playlist/profile-test',
        'description' => 'No autoplay.',
        'displayMode' => 'embed',
        'sourceMode' => 'spotify',
    ],
    123
);
assert_true($music['platform'] === 'spotify', 'music platform mismatch');
assert_true($music['url'] === 'https://open.spotify.com/playlist/profile-test', 'music URL mismatch');
assert_true($music['displayMode'] === 'embed', 'music display mode mismatch');
assert_true($music['sourceMode'] === 'spotify', 'music source mode mismatch');

$emptyAbout = profile_module_config('about', [], 123);
assert_true($emptyAbout === [], 'empty about module should be valid for owner placement');

$emptyCustomText = profile_module_config('custom_text', [], 123);
assert_true($emptyCustomText === [], 'empty text module should be valid for owner placement');

$emptyLinks = profile_module_config('links', ['links' => []], 123);
assert_true($emptyLinks === ['links' => []], 'empty links module should be valid for owner placement');

$emptyGallery = profile_module_config('gallery_media', ['mediaItems' => []], 123);
assert_true($emptyGallery === ['mediaItems' => []], 'empty gallery module should be valid for owner placement');

$emptyCreator = profile_module_config('creator_live', ['platform' => 'github'], 123);
assert_true($emptyCreator === ['platform' => 'github'], 'empty creator module should preserve safe platform hint');

$emptyMusic = profile_module_config('music', [], 123);
assert_true($emptyMusic === [], 'empty music module should be valid for owner placement');
$draftActivityConfig = profile_module_config('activity', ['configured' => false, 'canvasSize' => '4x6'], 123);
assert_true(($draftActivityConfig['configured'] ?? null) === true, 'activity should normalize as configured');
assert_true(($draftActivityConfig['canvasSize'] ?? null) === '4x6', 'activity should preserve normalized draft canvas size');

assert_true(is_string($profileModulesSource), 'profile modules source should be readable');
assert_true(str_contains($profileModulesSource, 'function profile_modules_restore'), 'restore endpoint should exist');
assert_true(str_contains($profileModulesSource, 'includeDeleted'), 'includeDeleted editor library read should exist');
assert_true(str_contains($profileModulesSource, 'restoreFeaturedPostId'), 'featured post restore snapshot should exist');
assert_true(str_contains($profileModulesSource, 'profile_canvas_reflow_existing_modules'), 'restore should reflow canvas placements');
assert_true(str_contains($profileModulesSource, 'profile_canvas_draft_commit'), 'draft commit endpoint should exist');
assert_true(str_contains($profileModulesSource, 'profile_canvas_glass_opacity'), 'canvas glass preference should persist');
assert_true(str_contains($profileModulesSource, 'PROFILE_CANVAS_PLACEHOLDER_MODULE_TYPE'), 'draft placeholder type should exist');
assert_true(str_contains($profileModulesSource, '=== PROFILE_CANVAS_PLACEHOLDER_MODULE_TYPE) {'), 'draft commit should skip placeholders');
assert_true(str_contains($profileModulesSource, 'OR type = :activity_type'), 'public module read should recover active hidden activity modules');

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
        'type' => 'text',
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
assert_true($layoutPayload['layout']['column'] === 10, 'layout column should clamp into 12 columns');
assert_true($layoutPayload['layout']['row'] === 14, 'layout row should clamp into 16 rows');

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
        'type' => 'text',
    ],
    true
);
assert_true($clampedPlacement['column'] === 10, 'placement column should clamp');
assert_true($clampedPlacement['row'] === 14, 'placement row should clamp');

$largeProfileInfoPlacement = profile_canvas_module_placement(
    [
        'id' => 11,
        'column' => 1,
        'row' => 1,
        'colSpan' => 8,
        'rowSpan' => 3,
    ],
    [
        'id' => 11,
        'type' => 'profile_info',
    ],
    true
);
assert_true($largeProfileInfoPlacement['colSpan'] === 8, 'profile info should allow the 8-column exception');
assert_true($largeProfileInfoPlacement['rowSpan'] === 3, 'profile info should allow 3 rows');

$largeActivityPlacement = profile_canvas_module_placement(
    [
        'id' => 12,
        'column' => 10,
        'row' => 14,
        'colSpan' => 4,
        'rowSpan' => 6,
    ],
    [
        'id' => 12,
        'type' => 'activity',
    ],
    true
);
assert_true($largeActivityPlacement['colSpan'] === 4, 'activity should allow 4 columns');
assert_true($largeActivityPlacement['rowSpan'] === 6, 'activity should allow 6 rows');
assert_true($largeActivityPlacement['column'] === 9, 'large activity column should clamp inside the canvas');
assert_true($largeActivityPlacement['row'] === 11, 'large activity row should clamp inside the canvas');

$hiddenActivityPlacement = profile_canvas_module_placement(
    [
        'id' => 14,
        'column' => 1,
        'row' => 4,
        'colSpan' => 3,
        'rowSpan' => 4,
    ],
    [
        'id' => 14,
        'type' => 'activity',
    ],
    false
);
assert_true($hiddenActivityPlacement['visible'] === true, 'activity placement should stay visible');

$streamChatPlacement = profile_canvas_module_placement(
    [
        'id' => 13,
        'column' => 4,
        'row' => 8,
        'colSpan' => 5,
        'rowSpan' => 3,
    ],
    [
        'id' => 13,
        'type' => 'creator_live',
    ],
    true
);
assert_true($streamChatPlacement['colSpan'] === 5, 'creator stream chat should allow 5 columns');
assert_true($streamChatPlacement['rowSpan'] === 3, 'creator stream chat should allow 3 rows');
assert_true($streamChatPlacement['column'] === 4, 'creator stream chat column should fit inside the wider canvas');
assert_true($streamChatPlacement['row'] === 8, 'creator stream chat row should fit inside the canvas');

$legacyStreamChatPlacement = profile_canvas_module_placement(
    [
        'id' => 14,
        'column' => 1,
        'row' => 1,
        'colSpan' => 3,
        'rowSpan' => 5,
    ],
    [
        'id' => 14,
        'type' => 'creator_live',
    ],
    true
);
assert_true($legacyStreamChatPlacement['colSpan'] === 5, 'legacy creator stream chat should normalize to 5 columns');
assert_true($legacyStreamChatPlacement['rowSpan'] === 3, 'legacy creator stream chat should normalize to 3 rows');

$largeStreamChatPlacement = profile_canvas_module_placement(
    [
        'id' => 15,
        'column' => 3,
        'row' => 8,
        'colSpan' => 6,
        'rowSpan' => 4,
    ],
    [
        'id' => 15,
        'type' => 'creator_live',
    ],
    true
);
assert_true($largeStreamChatPlacement['colSpan'] === 6, 'creator stream chat should allow 6 columns');
assert_true($largeStreamChatPlacement['rowSpan'] === 4, 'creator stream chat should allow 4 rows');
assert_true($largeStreamChatPlacement['column'] === 3, 'large creator stream chat column should fit inside the wider canvas');
assert_true($largeStreamChatPlacement['row'] === 8, 'large creator stream chat row should fit inside the canvas');

$mediumStreamChatPlacement = profile_canvas_module_placement(
    [
        'id' => 16,
        'column' => 1,
        'row' => 1,
        'colSpan' => 4,
        'rowSpan' => 3,
    ],
    [
        'id' => 16,
        'type' => 'creator_live',
    ],
    true
);
assert_true($mediumStreamChatPlacement['colSpan'] === 4, 'creator stream chat should allow 4 columns');
assert_true($mediumStreamChatPlacement['rowSpan'] === 3, 'creator stream chat should allow 3 rows');
assert_true(profile_canvas_span_allowed('links', 3, 2), 'links should allow 3x2');
assert_true(profile_canvas_span_allowed('connections', 2, 2), 'connections should allow 2x2');
assert_true(profile_canvas_span_allowed('connections', 2, 3), 'connections should allow 2x3');
assert_true(profile_canvas_span_allowed('custom_text', 3, 2), 'text should allow 3x2');
assert_true(profile_canvas_span_allowed('text', 4, 5), 'specific text module should allow 4x5');
assert_true(profile_canvas_span_allowed('gallery_media', 4, 3), 'gallery should allow 4x3');
assert_true(profile_canvas_span_allowed('uploaded_image', 6, 6), 'uploaded image should allow 6x6');
assert_true(!profile_canvas_span_allowed('uploaded_image', 7, 1), 'uploaded image should reject spans wider than 6');
assert_true(profile_canvas_span_allowed('twitch_channel', 8, 6), 'Twitch channel should allow desktop 8x6 stream chat');
assert_true(!profile_canvas_span_allowed('youtube_stream', 8, 6), 'YouTube stream should still reject 8x6');
assert_true(profile_canvas_span_allowed('youtube_video', 6, 4), 'YouTube video should allow 6x4');
assert_true(profile_canvas_span_allowed('github_repo', 6, 4), 'GitHub repo should allow 6x4');
assert_true(profile_canvas_span_allowed('music', 3, 2), 'legacy music should allow 3x2');
assert_true(profile_canvas_span_allowed('music', 2, 2), 'legacy music should allow 2x2');
assert_true(profile_canvas_span_allowed('spotify_song', 2, 2), 'Spotify song should allow 2x2');
assert_true(profile_canvas_span_allowed('activity', 6, 10), 'activity should allow 6x10');
assert_true(profile_canvas_span_allowed('featured_badges', 2, 2), 'badges should allow 2x2');
assert_true(!profile_canvas_span_allowed('profile_info', 2, 2), 'profile info should hide legacy 2x2');
assert_true(profile_canvas_span_allowed('profile_info', 8, 3), 'profile info should allow the 8x3 pinned size');

assert_true(profile_canvas_background_blur('none') === 'none', 'none blur mismatch');
assert_true(profile_canvas_background_blur('heavy') === 'heavy', 'heavy blur mismatch');
assert_true(profile_canvas_glass_opacity(0) === 0, 'canvas glass should allow solid lower bound');
assert_true(profile_canvas_glass_opacity('92') === 92, 'canvas glass should allow clear upper bound');
assert_true(profile_canvas_draft_module_type('placeholder') === 'placeholder', 'draft placeholder type should validate');
assert_true(profile_canvas_span_allowed('placeholder', 6, 6), 'placeholder should allow 6x6 draft envelopes');
assert_true(profile_canvas_span_allowed('placeholder', 6, 10), 'placeholder should allow 6x10 draft envelopes');
assert_true(profile_canvas_span_allowed('placeholder', 8, 10), 'placeholder should allow 8-wide draft envelopes');

$twitchConnectionLink = profile_module_link_for_integration_account([
    'provider' => 'twitch',
    'providerAccountId' => '123',
    'providerHandle' => 'thiabun',
    'displayName' => 'Thia',
    'revokedAt' => null,
]);
assert_true($twitchConnectionLink['platform'] === 'twitch', 'Twitch integration connection platform mismatch');
assert_true($twitchConnectionLink['url'] === 'https://www.twitch.tv/thiabun', 'Twitch integration connection URL mismatch');

$placeholderDraft = profile_canvas_draft_modules(
    [
        [
            'id' => -42,
            'type' => 'placeholder',
            'title' => null,
            'config' => ['configured' => false, 'placeholder' => true, 'canvasSize' => '3x2'],
            'visibility' => 'public',
            'position' => 1,
            'pinned' => true,
            'layout' => ['column' => 2, 'row' => 3, 'colSpan' => 3, 'rowSpan' => 2],
            'status' => 'active',
        ],
    ],
    123
);
assert_true($placeholderDraft[0]['type'] === 'placeholder', 'placeholder draft type mismatch');
assert_true($placeholderDraft[0]['visibility'] === 'draft', 'placeholder visibility should force draft');
assert_true($placeholderDraft[0]['pinned'] === true, 'placeholder should preserve draft pin state');
assert_true($placeholderDraft[0]['config']['placeholder'] === true, 'placeholder config marker mismatch');
assert_true($placeholderDraft[0]['layout']['colSpan'] === 3, 'placeholder layout columns mismatch');

$activityDraft = profile_canvas_draft_modules(
    [
        [
            'id' => 15,
            'type' => 'activity',
            'title' => null,
            'config' => ['canvasSize' => '3x4'],
            'visibility' => 'hidden',
            'position' => 1,
            'pinned' => false,
            'layout' => ['column' => 1, 'row' => 4, 'colSpan' => 3, 'rowSpan' => 4],
            'status' => 'active',
        ],
    ],
    123
);
assert_true($activityDraft[0]['visibility'] === 'public', 'activity draft visibility should normalize to public');
assert_php_rejected(
    'profile_module_type("placeholder");',
    'Choose a supported module type.'
);

assert_php_rejected(
    'profile_canvas_background_blur("blur(999px)");',
    'Choose a supported background blur.'
);
assert_php_rejected(
    'profile_canvas_module_placement(["id" => 1, "column" => 1, "row" => 1, "colSpan" => 1, "rowSpan" => 1], ["id" => 1, "type" => "music"], true);',
    'Canvas span is not allowed for this module.'
);
assert_true(profile_canvas_pinned(true) === true, 'boolean pinned state should be accepted');
assert_php_rejected(
    'profile_canvas_pinned("yes");',
    'Canvas module pin state is invalid.'
);
assert_php_rejected(
    'profile_canvas_movement_context(["anchorModuleId" => 2, "from" => ["column" => 1, "row" => 1], "to" => ["column" => 2, "row" => 1]], 1);',
    'Canvas movement context anchor does not match the canvas anchor.'
);

$pushedPlacements = profile_canvas_push_collisions(
    [
        ['id' => 1, 'type' => 'twitch_channel', 'column' => 1, 'row' => 1, 'colSpan' => 2, 'rowSpan' => 1, 'visible' => true],
        ['id' => 2, 'type' => 'spotify_song', 'column' => 2, 'row' => 1, 'colSpan' => 2, 'rowSpan' => 1, 'visible' => true],
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
        ['id' => 1, 'type' => 'twitch_channel', 'column' => 5, 'row' => 1, 'colSpan' => 2, 'rowSpan' => 1, 'visible' => true],
        ['id' => 2, 'type' => 'spotify_song', 'column' => 4, 'row' => 1, 'colSpan' => 2, 'rowSpan' => 1, 'visible' => true],
        ['id' => 3, 'type' => 'music', 'column' => 1, 'row' => 1, 'colSpan' => 2, 'rowSpan' => 1, 'visible' => true],
    ],
    1
);
$leftPushedModule = array_values(array_filter($leftPushPlacements, fn (array $placement): bool => $placement['id'] === 2))[0];
assert_true($leftPushedModule['column'] === 3 && $leftPushedModule['row'] === 1, 'colliding module should try left on the same row when right is unavailable');

$downwardPushPlacements = profile_canvas_push_collisions(
    [
        ['id' => 1, 'type' => 'twitch_channel', 'column' => 5, 'row' => 1, 'colSpan' => 2, 'rowSpan' => 1, 'visible' => true],
        ['id' => 2, 'type' => 'spotify_song', 'column' => 5, 'row' => 1, 'colSpan' => 2, 'rowSpan' => 1, 'visible' => true],
        ['id' => 3, 'type' => 'music', 'column' => 1, 'row' => 1, 'colSpan' => 2, 'rowSpan' => 1, 'visible' => true, 'pinned' => true],
        ['id' => 4, 'type' => 'creator_live', 'column' => 3, 'row' => 1, 'colSpan' => 2, 'rowSpan' => 1, 'visible' => true, 'pinned' => true],
        ['id' => 5, 'type' => 'twitch_channel', 'column' => 7, 'row' => 1, 'colSpan' => 2, 'rowSpan' => 1, 'visible' => true, 'pinned' => true],
        ['id' => 6, 'type' => 'spotify_song', 'column' => 9, 'row' => 1, 'colSpan' => 2, 'rowSpan' => 1, 'visible' => true, 'pinned' => true],
        ['id' => 7, 'type' => 'twitch_channel', 'column' => 11, 'row' => 1, 'colSpan' => 2, 'rowSpan' => 1, 'visible' => true, 'pinned' => true],
    ],
    1
);
$downwardPushedModule = array_values(array_filter($downwardPushPlacements, fn (array $placement): bool => $placement['id'] === 2))[0];
assert_true($downwardPushedModule['column'] === 5 && $downwardPushedModule['row'] === 2, 'colliding module should move downward only after same-row fits fail');

$directionalPushPlacements = profile_canvas_push_collisions(
    [
        ['id' => 1, 'type' => 'twitch_channel', 'column' => 3, 'row' => 1, 'colSpan' => 2, 'rowSpan' => 1, 'visible' => true],
        ['id' => 2, 'type' => 'spotify_song', 'column' => 3, 'row' => 1, 'colSpan' => 2, 'rowSpan' => 1, 'visible' => true],
    ],
    1,
    ['anchorModuleId' => 1, 'from' => ['column' => 2, 'row' => 1], 'to' => ['column' => 3, 'row' => 1]]
);
$directionalPushedModule = array_values(array_filter($directionalPushPlacements, fn (array $placement): bool => $placement['id'] === 2))[0];
assert_true($directionalPushedModule['column'] === 1 && $directionalPushedModule['row'] === 1, 'collider should move opposite the drag direction after half overlap');

$halfOverlapPlacements = profile_canvas_push_collisions(
    [
        ['id' => 1, 'type' => 'uploaded_image', 'column' => 3, 'row' => 1, 'colSpan' => 1, 'rowSpan' => 1, 'visible' => true],
        ['id' => 2, 'type' => 'twitch_channel', 'column' => 3, 'row' => 1, 'colSpan' => 2, 'rowSpan' => 1, 'visible' => true],
    ],
    1,
    ['anchorModuleId' => 1, 'from' => ['column' => 2, 'row' => 1], 'to' => ['column' => 3, 'row' => 1]]
);
$halfOverlapAnchor = array_values(array_filter($halfOverlapPlacements, fn (array $placement): bool => $placement['id'] === 1))[0];
assert_true($halfOverlapAnchor['column'] === 2, 'anchor should not displace a collider before crossing half of it');

$pinnedPlacements = profile_canvas_push_collisions(
    [
        ['id' => 1, 'type' => 'twitch_channel', 'column' => 3, 'row' => 1, 'colSpan' => 2, 'rowSpan' => 1, 'visible' => true],
        ['id' => 2, 'type' => 'spotify_song', 'column' => 3, 'row' => 1, 'colSpan' => 2, 'rowSpan' => 1, 'visible' => true, 'pinned' => true],
    ],
    1,
    ['anchorModuleId' => 1, 'from' => ['column' => 2, 'row' => 1], 'to' => ['column' => 3, 'row' => 1]]
);
$pinnedModule = array_values(array_filter($pinnedPlacements, fn (array $placement): bool => $placement['id'] === 2))[0];
$pinnedAnchor = array_values(array_filter($pinnedPlacements, fn (array $placement): bool => $placement['id'] === 1))[0];
assert_true($pinnedModule['column'] === 3 && $pinnedModule['pinned'] === true, 'pinned module should remain fixed');
assert_true($pinnedAnchor['column'] === 5, 'dragged module should settle past a pinned obstacle when room exists');

$upwardPushPlacements = profile_canvas_push_collisions(
    [
        ['id' => 1, 'type' => 'twitch_channel', 'column' => 11, 'row' => 16, 'colSpan' => 2, 'rowSpan' => 1, 'visible' => true],
        ['id' => 2, 'type' => 'spotify_song', 'column' => 11, 'row' => 16, 'colSpan' => 2, 'rowSpan' => 1, 'visible' => true],
        ['id' => 3, 'type' => 'music', 'column' => 1, 'row' => 16, 'colSpan' => 2, 'rowSpan' => 1, 'visible' => true, 'pinned' => true],
        ['id' => 4, 'type' => 'creator_live', 'column' => 3, 'row' => 16, 'colSpan' => 2, 'rowSpan' => 1, 'visible' => true, 'pinned' => true],
        ['id' => 5, 'type' => 'twitch_channel', 'column' => 5, 'row' => 16, 'colSpan' => 2, 'rowSpan' => 1, 'visible' => true, 'pinned' => true],
        ['id' => 6, 'type' => 'spotify_song', 'column' => 7, 'row' => 16, 'colSpan' => 2, 'rowSpan' => 1, 'visible' => true, 'pinned' => true],
        ['id' => 7, 'type' => 'twitch_channel', 'column' => 9, 'row' => 16, 'colSpan' => 2, 'rowSpan' => 1, 'visible' => true, 'pinned' => true],
    ],
    1
);
$upwardPushedModule = array_values(array_filter($upwardPushPlacements, fn (array $placement): bool => $placement['id'] === 2))[0];
assert_true($upwardPushedModule['column'] === 11 && $upwardPushedModule['row'] === 15, 'colliding module should move upward when downward space is unavailable');

assert_php_rejected(
    '$items = []; for ($i = 1; $i <= 65; $i++) { $items[] = ["id" => $i, "type" => "profile_info", "column" => 1, "row" => 1, "colSpan" => 3, "rowSpan" => 3, "visible" => true]; } profile_canvas_push_collisions($items, 1);',
    'Canvas layout does not fit the 12 by 16 grid.'
);

assert_true(str_contains($profileModulesSource, 'grid_pinned'), 'profile module API should persist pinned layout state');

echo "profile modules regression ok\n";
