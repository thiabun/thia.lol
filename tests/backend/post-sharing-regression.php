<?php

declare(strict_types=1);

$root = dirname(__DIR__, 2);

$postsSource = file_get_contents($root . '/api/posts.php');
$chatSource = file_get_contents($root . '/api/chat.php');
$readSource = file_get_contents($root . '/api/read.php');
$shareRendererSource = file_get_contents($root . '/api/post-share.php');
$profileShareRendererSource = file_get_contents($root . '/api/profile-share.php');
$indexSource = file_get_contents($root . '/api/index.php');
$htaccessSource = file_get_contents($root . '/public/.htaccess');
$apiHtaccessSource = file_get_contents($root . '/api/.htaccess');
$shareSceneSource = file_get_contents($root . '/src/components/share/ShareCardScene.tsx');
$shareCaptureSource = file_get_contents($root . '/src/lib/shareCardCapture.ts');
$shareRenderPageSource = file_get_contents($root . '/src/pages/ShareRenderPage.tsx');
$postShareModalSource = file_get_contents($root . '/src/components/social/PostShareModal.tsx');
$profileShareModalSource = file_get_contents($root . '/src/components/social/ProfileShareModal.tsx');
$migrationSource = file_get_contents($root . '/api/migrations/20260621_0001_add_message_attachments.sql');
$publicIdMigrationSource = file_get_contents($root . '/api/migrations/20260621_0002_add_post_public_ids.sql');

function assert_true(bool $condition, string $message): void
{
    if (!$condition) {
        fwrite(STDERR, $message . PHP_EOL);
        exit(1);
    }
}

assert_true(is_string($migrationSource), 'message attachment migration should be readable');
assert_true(str_contains($migrationSource, 'CREATE TABLE IF NOT EXISTS message_attachments'), 'message attachments table should be idempotent');
assert_true(str_contains($migrationSource, 'message_id BIGINT UNSIGNED NOT NULL'), 'message attachments should belong to messages');
assert_true(str_contains($migrationSource, 'post_id BIGINT UNSIGNED NULL'), 'post attachments should store post ids');
assert_true(str_contains($migrationSource, 'ON DELETE CASCADE'), 'message attachments should cascade when messages are deleted');
assert_true(str_contains($migrationSource, 'ON DELETE SET NULL'), 'post attachments should degrade when posts are removed');
assert_true(is_string($publicIdMigrationSource), 'post public id migration should be readable');
assert_true(str_contains($publicIdMigrationSource, 'ADD COLUMN public_id VARCHAR(16)'), 'posts should get public ids');
assert_true(str_contains($publicIdMigrationSource, "CONCAT('p', LOWER(HEX(RANDOM_BYTES(6))))"), 'existing posts should be backfilled with randomized ids');
assert_true(str_contains($publicIdMigrationSource, 'posts_public_id_unique'), 'post public ids should be unique');

assert_true(is_string($readSource), 'read source should be readable');
assert_true(str_contains($readSource, 'function fetch_public_post_payload_by_id_or_null'), 'public post lookup should have non-throwing helper');
assert_true(str_contains($readSource, 'function fetch_public_post_payload_by_identifier_or_null'), 'public post lookup should support public ids');
assert_true(str_contains($readSource, "'publicId' => post_row_public_id"), 'post payloads should expose public ids');
assert_true(str_contains($readSource, 'function post_canonical_path'), 'canonical post paths should be centralized');
assert_true(str_contains($readSource, 'post_public_identifier($post)'), 'canonical post paths should use public ids');
assert_true(str_contains($readSource, 'function profile_canonical_path'), 'canonical profile paths should be centralized');
assert_true(str_contains($readSource, 'function profile_share_card_path'), 'profile share-card paths should be centralized');
assert_true(str_contains($readSource, 'function post_share_summary_payload'), 'chat attachments should use a typed post summary');
assert_true(str_contains($readSource, "post_select_sql(\n            'AND p.id = :post_id'"), 'public numeric post lookup should use shared visibility SQL');
assert_true(str_contains($readSource, "post_select_sql(\n                'AND p.public_id = :post_public_id'"), 'public id lookup should use shared visibility SQL');

assert_true(is_string($postsSource), 'posts source should be readable');
assert_true(str_contains($postsSource, "segments[2] === 'share-card.png'"), 'share-card PNG route should be registered');
assert_true(str_contains($postsSource, "segments[2] === 'shares'"), 'share-to-message route should be registered');
assert_true(str_contains($postsSource, 'function posts_show'), 'public post GET endpoint should be registered');
assert_true(str_contains($postsSource, 'require_csrf_token($session)'), 'share-to-message must stay CSRF protected');
assert_true(str_contains($postsSource, 'require_message_attachments_table()'), 'typed sharing should require attachment storage');
assert_true(str_contains($postsSource, 'chat_users_are_moots($senderUserId, $recipientUserId)'), 'share recipients should be moots');
assert_true(str_contains($postsSource, 'chat_pair_block_state($senderUserId, $recipientUserId)'), 'share recipients should respect block pairs');
assert_true(str_contains($postsSource, 'count($recipientIds) > 10'), 'share-to-message should cap recipient count');
assert_true(str_contains($postsSource, 'text_length($note) > 500'), 'share notes should have a bounded length');
assert_true(str_contains($postsSource, "header('Content-Type: image/png')"), 'share-card endpoint should return PNG content');
assert_true(str_contains($postsSource, "stale-while-revalidate=86400"), 'share-card endpoint should send crawler-friendly cache headers');
assert_true(str_contains($postsSource, "header('Content-Disposition: inline')"), 'share-card endpoint should render inline for crawlers');
assert_true(str_contains($postsSource, 'posts_share_card_fallback'), 'share-card endpoint should have a fallback image path');
assert_true(!str_contains($postsSource, "share_card_cached_png_response(\$cachedPath, \$headOnly);\n    }\n\n    posts_share_card_fallback(\$headOnly);"), 'share-card endpoints should not fall through to the generic lockup before drawing cached/profile cards');
assert_true(str_contains($postsSource, 'function profile_share_card(string $handle): void'), 'profile share-card endpoint should be implemented');
assert_true(str_contains($postsSource, 'profile_viewer_can_view_row($profileRow, null)'), 'profile share cards should not expose private profiles');
assert_true(str_contains($postsSource, 'SHARE_CARD_LOGICAL_WIDTH = 1200'), 'share cards should keep the standard preview aspect width');
assert_true(str_contains($postsSource, 'SHARE_CARD_LOGICAL_HEIGHT = 630'), 'share cards should keep the standard preview aspect height');
assert_true(str_contains($postsSource, 'SHARE_CARD_RENDER_SCALE = 2'), 'share-card cache should store 2x PNG captures');
assert_true(str_contains($postsSource, "SHARE_CARD_CACHE_RENDER_VERSION = 'mosaic-v6'"), 'share-card cache should include a render-version key so stale card designs are bypassed');
assert_true(str_contains($postsSource, 'SHARE_CARD_MAX_UPLOAD_BYTES = 33554432'), 'share-card cache upload should allow high-resolution browser-rendered PNGs');
assert_true(str_contains($postsSource, 'Share card image must be 32 MB or smaller.'), 'share-card upload limit error should match the high-resolution cache allowance');
assert_true(str_contains($postsSource, 'function posts_share_card_cache_create'), 'post share cards should expose an authenticated cache upload endpoint');
assert_true(str_contains($postsSource, 'function profile_share_card_cache_create'), 'profile share cards should expose an authenticated cache upload endpoint');
assert_true(str_contains($postsSource, "share_card_cache_path('post'"), 'post share-card endpoint should check cached screenshots first');
assert_true(str_contains($postsSource, "share_card_cache_path('profile'"), 'profile share-card endpoint should check cached screenshots first');
assert_true(str_contains($postsSource, 'share_card_cached_png_response'), 'share-card endpoints should serve cached PNG screenshots directly');
assert_true(str_contains($postsSource, "require_csrf_token(\$session)"), 'share-card cache uploads should require CSRF');
assert_true(str_contains($postsSource, 'Only the post author can publish this share card preview.'), 'post cache uploads should be author-only');
assert_true(str_contains($postsSource, 'Only the profile owner can publish this share card preview.'), 'profile cache uploads should be owner-only');
assert_true(str_contains($postsSource, "(\$imageSize['mime'] ?? '') !== 'image/png'"), 'share-card cache upload should require PNG data');
assert_true(str_contains($postsSource, 'posts_share_card_width()'), 'share-card cache upload should validate rendered width');
assert_true(str_contains($postsSource, 'posts_share_card_height()'), 'share-card cache upload should validate rendered height');
assert_true(str_contains($postsSource, 'Share card must be a 2400x1260 PNG.'), 'share-card cache upload should enforce the high-resolution output size');
assert_true(str_contains($postsSource, '/uploads/share-cards/'), 'share-card cache should store public deterministic PNG assets');
assert_true(str_contains($postsSource, 'function share_card_image_proxy'), 'share-card rendering should have a safe image proxy for CORS-safe capture');
assert_true(str_contains($postsSource, '$parts = parse_url($mediaUrl);'), 'share-card local media proxy should tolerate absolute URLs and cache-bust query strings');
assert_true(str_contains($postsSource, 'posts_share_card_fetch_allowlisted_provider_image($url)'), 'share-card proxy should reuse allowlisted provider image fetching');
assert_true(str_contains($postsSource, 'CURLOPT_FOLLOWLOCATION => false'), 'share-card proxy fetches should not follow redirects');
assert_true(str_contains($postsSource, "in_array(\$mime, ['image/jpeg', 'image/png', 'image/webp', 'image/gif'], true)"), 'share-card proxy should return only safe browser image MIME types');
assert_true(str_contains($postsSource, 'posts_share_card_fallback($headOnly);'), 'missing cached screenshots should fall back to a generic branded image');
assert_true(str_contains($postsSource, 'function posts_share_card_wrapped_text_lines'), 'share-card text wrapping should expose measurable line clamping');
assert_true(str_contains($postsSource, 'function posts_share_card_ellipsize_line'), 'share-card text wrapping should ellipsize overflow text');
assert_true(str_contains($postsSource, 'profile_share_card_module_config_for_preview'), 'fallback profile share-card module previews should reuse public module enrichment when available');
assert_true(!str_contains($postsSource, 'profile_module_config($type, $config, $userId)'), 'profile share-card previews should not run strict save-time module normalization');
assert_true(str_contains($postsSource, 'profile_share_card_cached_integration_for_module'), 'profile share-card previews should use cached integration metadata only');
assert_true(str_contains($postsSource, 'profile_share_card_module_url_can_resolve'), 'profile share-card cached integration enrichment should preflight URLs before cache lookups');
assert_true(!str_contains($postsSource, 'profile_integration_card_for_module($config, $userId)'), 'profile share-card previews should not resolve provider metadata live');
assert_true(str_contains($postsSource, 'profile_share_card_module_integration'), 'profile share-card module previews should read stored integration metadata');
assert_true(str_contains($postsSource, 'profile_share_card_module_stats'), 'profile share-card module previews should expose provider stats metadata');
assert_true(!str_contains($postsSource, "strtoupper((string) \$module['label'])"), 'profile share-card module tiles should not render repeated uppercase category labels');
assert_true(str_contains($postsSource, '$shouldDrawTitle = $title !=='), 'image share-card tiles should decide whether a real title is visible');
assert_true(str_contains($postsSource, 'if ($shouldDrawTitle) {'), 'image share-card tiles should only draw the bottom title shade when text is visible');
assert_true(str_contains($postsSource, 'function profile_share_card_module_kind'), 'profile module previews should classify visual preview kinds');
assert_true(str_contains($postsSource, 'profile_share_card_draw_image_preview'), 'image modules should render through a visual image preview path');
assert_true(str_contains($postsSource, 'profile_share_card_draw_text_preview'), 'text modules should render through a text-card preview path');
assert_true(str_contains($postsSource, 'profile_share_card_draw_player_preview'), 'music/video modules should render through a player-style preview path');
assert_true(str_contains($postsSource, 'profile_share_card_draw_feed_preview'), 'activity modules should render through a feed preview path');
assert_true(str_contains($postsSource, 'profile_share_card_draw_list_preview'), 'link/project modules should render through a list preview path');
assert_true(str_contains($postsSource, 'profile_share_card_module_url_can_resolve'), 'profile share-card cached integration enrichment should preflight URLs before cache lookups');
assert_true(str_contains($postsSource, 'posts_share_card_draw_cover_safe_image'), 'profile module previews should render safe local or provider artwork');
assert_true(str_contains($postsSource, 'posts_share_card_provider_image_url_is_allowed'), 'profile module previews should allow only known provider image hosts');
assert_true(str_contains($postsSource, "'i.scdn.co'"), 'profile module previews should support Spotify provider artwork');
assert_true(str_contains($postsSource, "'i.ytimg.com'"), 'profile module previews should support YouTube provider thumbnails');
assert_true(str_contains($postsSource, "'static-cdn.jtvnw.net'"), 'profile module previews should support Twitch provider artwork');
assert_true(str_contains($postsSource, 'profile_share_card_activity_items'), 'activity previews should use recent public post snippets');
assert_true(str_contains($postsSource, 'profile_share_card_plain_text'), 'text previews should strip markdown into safe plain text for GD drawing');
assert_true(str_contains($postsSource, 'posts_share_card_draw_cover_uploaded_image'), 'profile share cards should render cover-style uploaded images');
assert_true(str_contains($postsSource, 'posts_generate_public_id'), 'new posts should generate public ids');
assert_true(
    substr_count($postsSource, 'INSERT INTO posts (public_id, author_id, room_id, parent_id, body, mood, media_url, visibility, status)') >= 2,
    'new posts and replies should both generate public ids when the public id column exists'
);
assert_true(str_contains($postsSource, "if (!is_string(\$mediaUrl) || \$mediaUrl === '') {\n        return false;\n    }"), 'missing post media should not draw a placeholder thumbnail');
assert_true(str_contains($postsSource, 'posts_share_card_load_image($path)'), 'valid uploaded media should render through the safe-original image loader');
assert_true(str_contains($postsSource, "'image/jpeg'"), 'share cards should render JPEG thumbnails');

assert_true(is_string($shareSceneSource), 'share-card React scene should be readable');
assert_true(str_contains($shareSceneSource, 'data-share-card-canvas="true"'), 'share-card scenes should expose a stable capture canvas hook');
assert_true(str_contains($shareSceneSource, 'data-share-card-ready="true"'), 'share-card scenes should mark themselves ready for capture');
assert_true(str_contains($shareSceneSource, 'SHARE_CARD_RENDER_VERSION = "mosaic-v6"'), 'browser-rendered share-card scene version should match the backend cache version');
assert_true(str_contains($shareSceneSource, 'h-[630px] w-[1200px]'), 'share-card scenes should render at 1200x630 CSS pixels');
assert_true(str_contains($shareSceneSource, 'src="/brand/thia-lockup-frostveil.png"'), 'browser-rendered cards should render the real thia.lol lockup');
assert_true(str_contains($shareSceneSource, 'data-share-card-brand="true"'), 'browser-rendered cards should expose a branded lockup hook');
assert_true(str_contains($shareSceneSource, 'h-[96px]'), 'browser-rendered card lockup should be visibly larger');
assert_true(str_contains($shareSceneSource, 'rounded-[34px]'), 'browser-rendered cards should use polished rounded surfaces');
assert_true(str_contains($shareSceneSource, 'shadow-[0_32px_90px_rgba(0,0,0,0.42)]'), 'browser-rendered cards should use soft diffusion shadows');
assert_true(str_contains($shareSceneSource, 'shareCardImageProxyUrl'), 'browser-rendered cards should proxy images to avoid canvas taint');
assert_true(str_contains($shareSceneSource, 'isProfileShareModuleEligible'), 'profile share-card scenes should filter module eligibility before rendering');
assert_true(str_contains($shareSceneSource, 'module.type !== "activity"'), 'profile share-card scenes should exclude Feed/activity modules');
assert_true(str_contains($shareSceneSource, 'ImageModulePreview'), 'profile share-card scenes should render image modules as image-first tiles');
assert_true(str_contains($shareSceneSource, 'ConnectionsModulePreview'), 'profile share-card scenes should render configured connection links');
assert_true(str_contains($shareSceneSource, 'MusicModulePreview'), 'profile share-card scenes should render static music player previews');
assert_true(str_contains($shareSceneSource, 'data-share-card-module-type'), 'profile share-card scenes should expose module type hooks');
assert_true(str_contains($shareSceneSource, 'data-share-card-post-author-avatar'), 'post share-card scenes should mark the actual post author avatar');
assert_true(str_contains($shareSceneSource, 'data-share-card-post-media'), 'post share-card scenes should mark the actual post media preview');
assert_true(str_contains($shareSceneSource, 'ProfileShareCard'), 'profile share-card scene should render profile cards');
assert_true(str_contains($shareSceneSource, 'PostShareCard'), 'post share-card scene should render post cards');
assert_true(str_contains($shareSceneSource, 'ModulePreview'), 'profile share-card scene should render module previews from real module data');
assert_true(str_contains($shareSceneSource, 'PostPreviewTile'), 'post share-card scene should render media/link preview surfaces');
assert_true(str_contains($shareSceneSource, 'IdentityRow'), 'share-card scene should render avatar-backed identity rows');
assert_true(str_contains($shareSceneSource, 'Metric'), 'post share-card scene should render real post metrics');
assert_true(str_contains($shareSceneSource, 'ProfileMetric'), 'profile share-card scene should render real profile stats');
assert_true(str_contains($shareSceneSource, 'RichText'), 'share-card scenes should reuse safe rich text rendering');
assert_true(str_contains($shareCaptureSource, 'pixelRatio: SHARE_CARD_PIXEL_RATIO'), 'share-card capture should render at 2x pixel ratio');
assert_true(str_contains($shareCaptureSource, 'includeQueryParams: true'), 'share-card capture must keep proxied image query params distinct');
assert_true(str_contains($shareCaptureSource, 'canvasWidth: SHARE_CARD_WIDTH * SHARE_CARD_PIXEL_RATIO'), 'share-card capture should output high-resolution PNG width');
assert_true(str_contains($shareCaptureSource, 'canvasHeight: SHARE_CARD_HEIGHT * SHARE_CARD_PIXEL_RATIO'), 'share-card capture should output high-resolution PNG height');
assert_true(str_contains($shareCaptureSource, 'waitForShareCardCanvas'), 'share-card capture should wait for the render scene to be ready');
assert_true(str_contains($shareCaptureSource, 'waitForImages'), 'share-card capture should wait for proxied images before screenshotting');
assert_true(str_contains($shareRenderPageSource, 'ShareRenderPostPage'), 'share-render page source should expose a post card scene');
assert_true(str_contains($shareRenderPageSource, 'ShareRenderProfilePage'), 'share-render page source should expose a profile card scene');
assert_true(str_contains($shareRenderPageSource, 'getProfileModules'), 'profile share-render scene should load public modules');
assert_true(str_contains($shareRenderPageSource, 'getProfilePosts'), 'profile share-render scene should load post snippets for feed previews');
assert_true(str_contains($postShareModalSource, 'captureShareCard'), 'post share modal should generate browser-rendered PNGs');
assert_true(str_contains($postShareModalSource, 'postShareCardCacheUpload'), 'post share modal should publish generated PNGs to the cache endpoint');
assert_true(str_contains($profileShareModalSource, 'captureShareCard'), 'profile share modal should generate browser-rendered PNGs');
assert_true(str_contains($profileShareModalSource, 'profileShareCardCacheUpload'), 'profile share modal should publish generated PNGs to the cache endpoint');

assert_true(is_string($chatSource), 'chat source should be readable');
assert_true(str_contains($chatSource, 'function chat_insert_message'), 'chat message creation should be reusable');
assert_true(str_contains($chatSource, 'function chat_notify_message'), 'post shares should create normal message notifications');
assert_true(str_contains($chatSource, "'attachments' => !\$deleted ? chat_message_attachments"), 'message payloads should expose typed attachments');
assert_true(str_contains($chatSource, 'post_share_summary_payload($post)'), 'message attachments should hydrate post summaries');
assert_true(str_contains($chatSource, 'post === null ? null'), 'unavailable attached posts should degrade to null');

assert_true(is_string($shareRendererSource), 'post share renderer should be readable');
assert_true(str_contains($shareRendererSource, '<meta property="og:type" content="article" />'), 'share renderer should emit article Open Graph type');
assert_true(str_contains($shareRendererSource, '<meta property="og:title"'), 'share renderer should emit og:title');
assert_true(str_contains($shareRendererSource, '<meta property="og:description"'), 'share renderer should emit og:description');
assert_true(str_contains($shareRendererSource, '<meta property="og:url"'), 'share renderer should emit og:url');
assert_true(str_contains($shareRendererSource, '<meta property="og:image"'), 'share renderer should emit og:image');
assert_true(str_contains($shareRendererSource, '<meta property="og:image:secure_url"'), 'share renderer should emit og:image:secure_url');
assert_true(str_contains($shareRendererSource, '<meta property="og:image:type" content="image/png" />'), 'share renderer should emit PNG image type');
assert_true(str_contains($shareRendererSource, '<meta name="twitter:image"'), 'share renderer should emit twitter:image');
assert_true(str_contains($shareRendererSource, "post_share_page_https_url(post_public_base_url() . post_share_card_path(\$post) . '?v=' . post_share_page_card_version(\$post))"), 'share renderer should use absolute HTTPS versioned share-card images');
assert_true(str_contains($shareRendererSource, 'post_share_page_card_version($post)'), 'post share metadata should version cached screenshot URLs');
assert_true(str_contains($shareRendererSource, "'mosaic-v6'"), 'post share metadata version should include the browser-rendered card version');
assert_true(str_contains($shareRendererSource, 'post_share_page_fallback_html'), 'share renderer should include a no-JS fallback body');
assert_true(str_contains($shareRendererSource, '<noscript>'), 'share renderer should insert fallback HTML before hydration');
assert_true(str_contains($shareRendererSource, 'post_share_page_escape'), 'share renderer should escape metadata');
assert_true(str_contains($shareRendererSource, 'header(\'Location: \' . post_canonical_path($post), true, 302)'), 'stale handles should redirect safely');
assert_true(str_contains($shareRendererSource, 'post_public_identifier($post)'), 'numeric permalink returns should redirect to public id URLs');

assert_true(is_string($profileShareRendererSource), 'profile share renderer should be readable');
assert_true(str_contains($profileShareRendererSource, '<meta property="og:type" content="profile" />'), 'profile share renderer should emit profile Open Graph type');
assert_true(str_contains($profileShareRendererSource, '<meta property="profile:username"'), 'profile share renderer should emit profile username metadata');
assert_true(str_contains($profileShareRendererSource, '<meta property="og:image"'), 'profile share renderer should emit og:image');
assert_true(str_contains($profileShareRendererSource, '<meta name="twitter:image"'), 'profile share renderer should emit twitter:image');
assert_true(str_contains($profileShareRendererSource, "profile_share_page_https_url(post_public_base_url() . profile_share_page_card_image_path(\$profile) . '?v=' . profile_share_page_card_version(\$profile))"), 'profile share renderer should use absolute HTTPS versioned share-card images');
assert_true(str_contains($profileShareRendererSource, 'profile_share_page_card_version($profile)'), 'profile share metadata should version cached screenshot URLs');
assert_true(str_contains($profileShareRendererSource, 'profile_share_page_cached_card_path'), 'profile share metadata should inspect cached rendered card files');
assert_true(str_contains($profileShareRendererSource, 'profile_share_page_cached_card_url_path'), 'profile share metadata should point crawlers directly at cached rendered cards when available');
assert_true(str_contains($profileShareRendererSource, 'filemtime($cachedCardPath)'), 'profile share metadata should change when the rendered card cache changes');
assert_true(str_contains($profileShareRendererSource, "'mosaic-v6'"), 'profile share metadata version should include the browser-rendered card version');
assert_true(str_contains($profileShareRendererSource, 'profile_viewer_can_view_row($profileRow, null)'), 'profile share renderer should hide private profile metadata');
assert_true(str_contains($profileShareRendererSource, 'profile_share_page_fallback_html'), 'profile share renderer should include a no-JS fallback body');

assert_true(is_string($indexSource), 'API index should be readable');
assert_true(str_contains($indexSource, "segments[2] === 'share-card.png'"), 'profile share-card API route should be registered');
assert_true(str_contains($indexSource, 'profile_share_card($segments[1])'), 'profile share-card API route should call the renderer');
assert_true(str_contains($indexSource, 'share_card_image_proxy()'), 'API index should register the share-card image proxy route');
assert_true(str_contains($indexSource, 'profile_share_card_cache_create($segments[1])'), 'API index should register profile share-card cache uploads');
assert_true(str_contains($profileShareModalSource, 'await generateProfileCard({ publish: true, silent: true })'), 'profile copy sharing should wait for the rendered card publish attempt before copying');

assert_true(is_string($htaccessSource), 'public htaccess should be readable');
assert_true(str_contains($htaccessSource, 'api/post-share.php?handle=$1&postId=$2'), 'post permalink rewrite should target the share renderer');
assert_true(str_contains($htaccessSource, 'api/profile-share.php?handle=$1'), 'profile permalink rewrite should target the profile share renderer');
assert_true(str_contains($htaccessSource, 'REQUEST_URI} ^/api'), 'API exclusion should remain ahead of SPA rewrite');
assert_true(is_string($apiHtaccessSource), 'API htaccess should be readable');
assert_true(str_contains($apiHtaccessSource, '^(?:post-share|profile-share|sitemap)\.php$'), 'API htaccess should allow metadata/sitemap scripts to execute instead of rewriting them to index.php');

echo "post sharing regression ok\n";
