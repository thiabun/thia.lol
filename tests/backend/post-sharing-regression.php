<?php

declare(strict_types=1);

$root = dirname(__DIR__, 2);

$postsSource = file_get_contents($root . '/api/posts.php');
$chatSource = file_get_contents($root . '/api/chat.php');
$readSource = file_get_contents($root . '/api/read.php');
$shareRendererSource = file_get_contents($root . '/api/post-share.php');
$htaccessSource = file_get_contents($root . '/public/.htaccess');
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
assert_true(str_contains($postsSource, 'posts_share_card_fallback'), 'share-card endpoint should have a fallback image path');
assert_true(str_contains($postsSource, 'posts_generate_public_id'), 'new posts should generate public ids');
assert_true(str_contains($postsSource, 'NotoSans-Regular.ttf'), 'share cards should use bundled UTF-8 text fonts');
assert_true(str_contains($postsSource, 'NotoEmoji-Regular.ttf'), 'share cards should use bundled emoji fonts');
assert_true(str_contains($postsSource, 'twemoji@14.0.2'), 'share cards should render emoji image fallbacks');
assert_true(str_contains($postsSource, 'thia-lockup-frostveil.png'), 'share cards should render the real thia.lol lockup');
assert_true(str_contains($postsSource, '$panelTop = 96'), 'share-card panel should sit below the top brand strip');
assert_true(str_contains($postsSource, "posts_share_card_draw_lockup(\$image);\n    imagefilledrectangle(\$image, \$panelLeft, \$panelTop"), 'share-card lockup should draw outside the post panel');
assert_true(str_contains($postsSource, '$targetX = 1116 - $targetWidth'), 'share-card lockup should be right aligned');
assert_true(str_contains($postsSource, '$targetY = 16'), 'share-card lockup should sit in the top brand strip');
assert_true(str_contains($postsSource, '$top = 76'), 'share-card text should remain contained after lowering the panel');
assert_true(str_contains($postsSource, '$hasThumbnail = posts_share_card_draw_thumbnail($image, $post)'), 'share cards should know whether real media was drawn');
assert_true(str_contains($postsSource, '$bodyWidth = $hasThumbnail ? 620 : 940'), 'share cards without media should use a wider text column');
assert_true(str_contains($postsSource, 'function posts_share_card_draw_thumbnail($image, array $post): bool'), 'thumbnail drawing should report whether real media rendered');
assert_true(str_contains($postsSource, "if (!is_string(\$mediaUrl) || \$mediaUrl === '') {\n        return false;\n    }"), 'missing post media should not draw a placeholder thumbnail');
assert_true(!str_contains($postsSource, 'imagefilledellipse'), 'share cards should not draw decorative placeholder blobs for posts without media');
assert_true(str_contains($postsSource, 'imagecreatefromwebp($path)'), 'valid uploaded media should still render as a WebP thumbnail');
assert_true(str_contains($postsSource, '$targetY = 130'), 'share-card media thumbnail should stay inside the lowered panel');
assert_true(str_contains($postsSource, "imagerectangle(\$image, \$targetX, \$targetY, \$targetX + \$targetWidth, \$targetY + \$targetHeight, \$line);\n\n    return true;"), 'thumbnail drawing should return true only after drawing real media');

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
assert_true(str_contains($shareRendererSource, 'post_share_page_escape'), 'share renderer should escape metadata');
assert_true(str_contains($shareRendererSource, 'header(\'Location: \' . post_canonical_path($post), true, 302)'), 'stale handles should redirect safely');
assert_true(str_contains($shareRendererSource, 'post_public_identifier($post)'), 'numeric permalink returns should redirect to public id URLs');

assert_true(is_string($htaccessSource), 'public htaccess should be readable');
assert_true(str_contains($htaccessSource, 'api/post-share.php?handle=$1&postId=$2'), 'post permalink rewrite should target the share renderer');
assert_true(str_contains($htaccessSource, 'REQUEST_URI} ^/api'), 'API exclusion should remain ahead of SPA rewrite');

echo "post sharing regression ok\n";
