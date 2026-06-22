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

assert_true(str_contains($profileModulesSource, 'ensure_profile_feed_module($userId);'), 'blank profile built-ins should ensure the default Feed module');
assert_true(str_contains($profileModulesSource, "PROFILE_ACTIVITY_MODULE_TYPE => 'Feed'"), 'activity module label should be Feed');
assert_true(str_contains($profileModulesSource, "PROFILE_ACTIVITY_MODULE_TYPE => '4x6'"), 'activity default size should be roomy');
assert_true(str_contains($profileModulesSource, 'function profile_activity_module_payload'), 'public blank profiles should expose a synthetic Feed payload');
assert_true(str_contains($profileModulesSource, 'profile_module_preference_exists_including_deleted($userId, PROFILE_ACTIVITY_MODULE_TYPE)'), 'deleted Feed preferences should block automatic recreation');
assert_true(str_contains($profileModulesSource, 'profile_upgrade_default_feed_module($userId);'), 'blank profiles with old default activity should upgrade to roomy Feed');
assert_true(str_contains($profileModulesSource, "'selectedModuleId', 'updatedAt'"), 'canvas draft save should accept returned updatedAt round-trips');

$about = profile_module_config('about', ['body' => 'A concise personal note.'], 123);
assert_true($about['body'] === 'A concise personal note.', 'about body mismatch');

$aboutWithRenderFlag = profile_module_config('about', ['body' => 'A concise personal note.', 'placeholder' => true], 123);
assert_true($aboutWithRenderFlag['body'] === 'A concise personal note.', 'render-only placeholder flags should not block module saves');

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
assert_true(profile_canvas_default_size('activity', 0) === '4x6', 'activity should default to the roomy Feed size');
assert_true(profile_module_type_label('activity') === 'Feed', 'activity module should be labeled Feed');

$defaultFeedPayload = profile_activity_module_payload(2);
assert_true($defaultFeedPayload['title'] === 'Feed', 'synthetic activity payload should be titled Feed');
assert_true($defaultFeedPayload['layout']['colSpan'] === 4, 'synthetic Feed should use roomy columns');
assert_true($defaultFeedPayload['layout']['rowSpan'] === 6, 'synthetic Feed should use roomy rows');
assert_true($defaultFeedPayload['layout']['column'] === 5, 'synthetic Feed should be centered below profile info');
assert_true($defaultFeedPayload['layout']['row'] === 4, 'synthetic Feed should sit below profile info');
assert_true(
    profile_feed_module_looks_default([
        'title' => null,
        'config_json' => '{}',
        'grid_column' => null,
        'grid_row' => null,
        'grid_col_span' => 3,
        'grid_row_span' => 4,
    ]),
    'partial old activity spans should be treated as default Feed'
);
assert_true(
    profile_feed_module_looks_default([
        'title' => null,
        'config_json' => '{}',
        'grid_column' => null,
        'grid_row' => null,
        'grid_col_span' => null,
        'grid_row_span' => null,
    ]),
    'missing old activity layout should be treated as default Feed'
);
assert_true(
    profile_feed_module_looks_default([
        'title' => 'Feed',
        'config_json' => '{}',
        'grid_column' => 5,
        'grid_row' => 4,
        'grid_col_span' => 4,
        'grid_row_span' => 6,
    ]),
    'centered default Feed layouts should stay upgrade-safe'
);
assert_true(
    !profile_feed_module_looks_default([
        'title' => 'Custom feed',
        'config_json' => '{}',
        'grid_column' => null,
        'grid_row' => null,
        'grid_col_span' => null,
        'grid_row_span' => null,
    ]),
    'custom activity titles should block automatic Feed upgrades'
);
assert_true(
    !profile_feed_module_looks_default([
        'title' => null,
        'config_json' => '{}',
        'grid_column' => 2,
        'grid_row' => 5,
        'grid_col_span' => 6,
        'grid_row_span' => 10,
    ]),
    'custom activity layouts should block automatic Feed upgrades'
);

$profileInfo = profile_module_config('profile_info', [], 123);
assert_true($profileInfo === [], 'profile info config should be empty');

$featuredPost = profile_module_config('featured_post', [], 123);
assert_true($featuredPost === [], 'featured post config should be empty');

$featuredPostWithRestoreSnapshot = profile_module_config('featured_post', ['restoreFeaturedPostId' => 42], 123);
assert_true($featuredPostWithRestoreSnapshot === [], 'featured post restore snapshots should not block canvas saves');

$featuredRoom = profile_module_config('featured_room', [], 123);
assert_true($featuredRoom === [], 'featured room config should be empty');

$featuredRoomWithRestoreSnapshot = profile_module_config('featured_room', ['restoreFeaturedRoomId' => 24], 123);
assert_true($featuredRoomWithRestoreSnapshot === [], 'featured room restore snapshots should not block canvas saves');

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
            [
                'url' => '/uploads/media/2026/06/profile-gallery-two.webp',
                'caption' => 'Second photo',
            ],
        ],
    ],
    123
);
assert_true($gallery['mediaItems'][0]['url'] === '/uploads/media/2026/06/profile-gallery-one.webp', 'gallery media URL mismatch');
assert_true(count($gallery['mediaItems']) === 1, 'legacy gallery should normalize to one photo');

$uploadedImage = profile_module_config(
    'uploaded_image',
    [
        'mediaItems' => [
            ['url' => '/uploads/media/2026/06/profile-image-one.webp'],
            ['url' => '/uploads/media/2026/06/profile-image-two.webp'],
        ],
    ],
    123
);
assert_true(count($uploadedImage['mediaItems']) === 1, 'uploaded image should normalize to one photo');
assert_true($uploadedImage['mediaItems'][0]['url'] === '/uploads/media/2026/06/profile-image-one.webp', 'uploaded image should keep the first photo');

$slideshow = profile_module_config(
    'gallery_slideshow',
    [
        'mediaItems' => [
            ['url' => '/uploads/media/2026/06/profile-slide-one.webp'],
            ['url' => '/uploads/media/2026/06/profile-slide-two.webp'],
        ],
    ],
    123
);
assert_true(count($slideshow['mediaItems']) === 2, 'slideshow should keep multiple photos');

$galleryFeed = profile_module_config(
    'gallery_feed',
    [
        'mediaItems' => [
            ['url' => '/uploads/media/2026/06/profile-feed-one.webp'],
            ['url' => '/uploads/media/2026/06/profile-feed-two.webp'],
        ],
    ],
    123
);
assert_true(count($galleryFeed['mediaItems']) === 2, 'gallery feed should keep multiple photos');

$safeOriginalGallery = profile_module_config(
    'gallery_feed',
    [
        'mediaItems' => [
            ['url' => '/uploads/media/2026/06/profile-feed-one.jpg'],
            ['url' => '/uploads/media/2026/06/profile-feed-two.png'],
            ['url' => '/uploads/media/2026/06/profile-feed-three.gif'],
        ],
    ],
    123
);
assert_true(count($safeOriginalGallery['mediaItems']) === 3, 'gallery feed should accept safe original image extensions');

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

$uploadedMusic = profile_module_config(
    'music',
    [
        'platform' => 'custom',
        'label' => 'My MP3',
        'description' => 'Uploaded track.',
        'displayMode' => 'player',
        'sourceMode' => 'upload',
        'audio' => [
            'url' => '/uploads/media/2026/06/profile_music-audio123.mp3',
            'mime' => 'audio/mpeg',
            'type' => 'audio/mpeg',
            'size' => 123456,
            'title' => 'My MP3',
            'duration' => 123.4567,
            'uploadedAt' => '2026-06-19T12:00:00Z',
        ],
        'autoplay' => true,
    ],
    123
);
assert_true($uploadedMusic['audio']['url'] === '/uploads/media/2026/06/profile_music-audio123.mp3', 'uploaded audio URL mismatch');
assert_true($uploadedMusic['audio']['duration'] === 123.457, 'uploaded audio duration should round');
assert_true($uploadedMusic['sourceMode'] === 'upload', 'uploaded music source mode mismatch');
assert_true($uploadedMusic['autoplay'] === true, 'uploaded music autoplay mismatch');

$emptyUploadMusic = profile_module_config(
    'music',
    [
        'platform' => 'custom',
        'sourceMode' => 'upload',
    ],
    123
);
assert_true($emptyUploadMusic['platform'] === 'custom', 'empty upload music platform mismatch');
assert_true($emptyUploadMusic['sourceMode'] === 'upload', 'empty upload music source mode mismatch');

$uploadedVideo = profile_module_config(
    'uploaded_video',
    [
        'label' => 'Launch clip',
        'description' => 'Uploaded video.',
        'displayMode' => 'video',
        'sourceMode' => 'upload',
        'video' => [
            'url' => '/uploads/media/2026/06/profile_module_video-video123.mp4',
            'mime' => 'video/mp4',
            'type' => 'video/mp4',
            'size' => 345678,
            'title' => 'Launch clip',
            'duration' => 42,
        ],
    ],
    123
);
assert_true($uploadedVideo['video']['url'] === '/uploads/media/2026/06/profile_module_video-video123.mp4', 'uploaded video URL mismatch');
assert_true($uploadedVideo['sourceMode'] === 'upload', 'uploaded video source mode mismatch');

$legacyWebmVideo = profile_module_config(
    'uploaded_video',
    [
        'sourceMode' => 'upload',
        'video' => [
            'url' => '/uploads/media/2026/06/profile_module_video-legacy.webm',
            'mime' => 'video/webm',
            'size' => 345678,
        ],
    ],
    123
);
assert_true($legacyWebmVideo['video']['type'] === 'video/webm', 'legacy WebM video metadata should remain valid');

$emptyAbout = profile_module_config('about', [], 123);
assert_true($emptyAbout === [], 'empty about module should be valid for owner placement');

$richAbout = profile_module_config(
    'about',
    ['body' => "## About me\n\n- Safe Markdown\n- https://example.com"],
    123
);
assert_true(
    $richAbout['body'] === "## About me\n\n- Safe Markdown\n- https://example.com",
    'about body should preserve safe Markdown line breaks'
);

$emptyCustomText = profile_module_config('custom_text', [], 123);
assert_true($emptyCustomText === [], 'empty text module should be valid for owner placement');

$richCustomText = profile_module_config(
    'custom_text',
    ['body' => "## Favorite notes\n\n- Safe Markdown\n- https://example.com"],
    123
);
assert_true(
    $richCustomText['body'] === "## Favorite notes\n\n- Safe Markdown\n- https://example.com",
    'custom text rich body should preserve Markdown line breaks'
);

$richLegacyText = profile_module_config(
    'text',
    ['body' => "Line one\nLine two"],
    123
);
assert_true($richLegacyText['body'] === "Line one\nLine two", 'legacy text body should preserve line breaks');

$longRichText = profile_module_config('custom_text', ['body' => str_repeat('a', 900)], 123);
assert_true(strlen($longRichText['body']) === 900, 'custom text should allow richer body length');

$longAboutText = profile_module_config('about', ['body' => str_repeat('a', 900)], 123);
assert_true(strlen($longAboutText['body']) === 900, 'about text should allow richer body length');

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
assert_true(str_contains($profileModulesSource, 'profile_module_uploaded_audio'), 'uploaded audio module metadata should be validated');
assert_true(str_contains($profileModulesSource, 'profile_module_uploaded_video_config'), 'uploaded video module config should be file-backed');

assert_module_config_rejected(
    'custom_text',
    ['body' => '<script>alert(1)</script>'],
    'Module text must be plain text.'
);
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
assert_module_config_rejected(
    'music',
    [
        'audio' => [
            'url' => 'https://example.com/track.mp3',
            'mime' => 'audio/mpeg',
            'size' => 123,
        ],
    ],
    'Audio file must come from the audio upload endpoint.'
);
assert_module_config_rejected(
    'uploaded_video',
    [
        'url' => 'https://example.com/video.mp4',
    ],
    'Unsupported module field was provided.'
);
assert_module_config_rejected(
    'uploaded_video',
    [
        'video' => [
            'url' => '/uploads/media/2026/06/profile_background-not-module.mp4',
            'mime' => 'video/mp4',
            'size' => 123,
        ],
    ],
    'Video file must come from the video upload endpoint.'
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

$draftModulesWithTextEntities = profile_canvas_draft_modules(
    [
        [
            'id' => 31,
            'type' => 'custom_text',
            'title' => 'Note',
            'config' => ['body' => 'Already parsed text.'],
            'visibility' => 'public',
            'position' => 1,
            'pinned' => false,
            'layout' => ['column' => 1, 'row' => 4, 'colSpan' => 3, 'rowSpan' => 2],
            'status' => 'active',
            'textEntities' => [
                'body' => [
                    [
                        'type' => 'mention',
                        'start' => 0,
                        'length' => 5,
                        'text' => '@thia',
                    ],
                ],
            ],
            'schemaVersion' => 1,
        ],
    ],
    123
);
assert_true($draftModulesWithTextEntities[0]['config']['body'] === 'Already parsed text.', 'draft module should preserve body while accepting computed text entities');
assert_true(!array_key_exists('textEntities', $draftModulesWithTextEntities[0]), 'draft module save should not persist computed text entities');

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
assert_true(profile_canvas_span_allowed('links', 8, 1), 'links should allow full-width slim rows');
assert_true(profile_canvas_span_allowed('connections', 2, 2), 'connections should allow 2x2');
assert_true(profile_canvas_span_allowed('connections', 2, 3), 'connections should allow 2x3');
assert_true(profile_canvas_span_allowed('connections', 8, 2), 'connections should allow full-width row stacks');
assert_true(profile_canvas_span_allowed('custom_text', 3, 2), 'text should allow 3x2');
assert_true(profile_canvas_span_allowed('text', 4, 5), 'specific text module should allow 4x5');
assert_true(profile_canvas_span_allowed('text', 8, 1), 'text should allow full-width slim strips');
assert_true(profile_canvas_span_allowed('gallery_media', 4, 3), 'gallery should allow 4x3');
assert_true(profile_canvas_span_allowed('gallery_media', 8, 2), 'gallery should allow full-width slim previews');
assert_true(profile_canvas_span_allowed('uploaded_image', 6, 6), 'uploaded image should allow 6x6');
assert_true(profile_canvas_span_allowed('uploaded_image', 8, 2), 'uploaded image should allow full-width slim previews');
assert_true(!profile_canvas_span_allowed('uploaded_image', 7, 1), 'uploaded image should reject spans wider than 6');
assert_true(profile_canvas_span_allowed('twitch_channel', 8, 6), 'Twitch channel should allow desktop 8x6 stream chat');
assert_true(!profile_canvas_span_allowed('youtube_stream', 8, 6), 'YouTube stream should still reject 8x6');
assert_true(profile_canvas_span_allowed('youtube_video', 6, 4), 'YouTube video should allow 6x4');
assert_true(profile_canvas_span_allowed('youtube_video', 8, 2), 'YouTube video should allow full-width slim players');
assert_true(profile_canvas_span_allowed('github_repo', 6, 4), 'GitHub repo should allow 6x4');
assert_true(profile_canvas_span_allowed('github_repo', 8, 2), 'GitHub repo should allow full-width slim cards');
assert_true(profile_canvas_span_allowed('music', 3, 2), 'legacy music should allow 3x2');
assert_true(profile_canvas_span_allowed('music', 2, 2), 'legacy music should allow 2x2');
assert_true(profile_canvas_span_allowed('music', 8, 1), 'legacy music should allow full-width slim players');
assert_true(profile_canvas_span_allowed('spotify_song', 2, 2), 'Spotify song should allow 2x2');
assert_true(profile_canvas_span_allowed('spotify_song', 8, 2), 'Spotify song should allow full-width slim players');
assert_true(profile_canvas_span_allowed('spotify_artist', 8, 2), 'Spotify artist should allow full-width slim cards');
assert_true(profile_canvas_span_allowed('activity', 6, 10), 'activity should allow 6x10');
assert_true(profile_canvas_span_allowed('activity', 8, 2), 'activity should allow slim full-width feed previews');
assert_true(profile_canvas_span_allowed('activity', 8, 3), 'activity should allow medium full-width feed previews');
assert_true(profile_canvas_span_allowed('featured_badges', 2, 2), 'badges should allow 2x2');
assert_true(profile_canvas_span_allowed('featured_badges', 8, 1), 'badges should allow full-width slim shelves');
assert_true(!profile_canvas_span_allowed('profile_info', 2, 2), 'profile info should hide legacy 2x2');
assert_true(profile_canvas_span_allowed('profile_info', 8, 3), 'profile info should allow the 8x3 pinned size');

$wideMusicPlacement = profile_canvas_module_placement(
    ['id' => 88, 'column' => 1, 'row' => 2, 'colSpan' => 8, 'rowSpan' => 1],
    ['id' => 88, 'type' => 'music'],
    true
);
assert_true($wideMusicPlacement['colSpan'] === 8, 'wide music placement should not clamp to 6 columns');
assert_true($wideMusicPlacement['rowSpan'] === 1, 'wide music placement should preserve slim row span');

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
