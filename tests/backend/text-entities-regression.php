<?php

declare(strict_types=1);

$configPath = sys_get_temp_dir() . '/thia-text-entities-test-config.php';
$key = base64_encode(str_repeat('t', SODIUM_CRYPTO_SECRETBOX_KEYBYTES));

file_put_contents(
    $configPath,
    "<?php return ['database' => ['host' => 'localhost', 'name' => 'test', 'user' => 'test'], 'app' => ['environment' => 'development', 'base_url' => 'https://thia.lol'], 'security' => ['integration_encryption_key' => '{$key}'], 'integrations' => ['twitch' => ['embed_parent' => 'thia.lol']]];"
);
putenv('THIA_CONFIG_PATH=' . $configPath);

require_once dirname(__DIR__, 2) . '/api/text_entities.php';

$textEntitiesSource = file_get_contents(dirname(__DIR__, 2) . '/api/text_entities.php');
$postsSource = file_get_contents(dirname(__DIR__, 2) . '/api/posts.php');
$chatSource = file_get_contents(dirname(__DIR__, 2) . '/api/chat.php');
$profileSource = file_get_contents(dirname(__DIR__, 2) . '/api/profile.php');
$profileModulesSource = file_get_contents(dirname(__DIR__, 2) . '/api/profile_modules.php');
$readSource = file_get_contents(dirname(__DIR__, 2) . '/api/read.php');
$notificationsSource = file_get_contents(dirname(__DIR__, 2) . '/api/notifications.php');

function assert_true(bool $condition, string $message): void
{
    if (!$condition) {
        fwrite(STDERR, $message . PHP_EOL);
        exit(1);
    }
}

assert_true(text_entity_trim_url_token('https://example.com/path),') === 'https://example.com/path', 'trailing punctuation should trim from URLs');
assert_true(text_entity_trim_url_token('https://example.com/(kept)') === 'https://example.com/(kept)', 'balanced URL parentheses should be preserved');
assert_true(text_entity_normalize_https_url('http://example.com') === null, 'non-HTTPS URLs should be rejected');
assert_true(text_entity_normalize_https_url('https://user:pass@example.com') === null, 'credentialed URLs should be rejected');
assert_true(text_entity_normalize_https_url('https://EXAMPLE.com') === 'https://example.com/', 'HTTPS URLs should normalize host and root slash');
assert_true(text_entity_url_is_safe_for_fetch('https://127.0.0.1/path') === false, 'private IPv4 hosts should not be fetched');
assert_true(text_entity_url_is_safe_for_fetch('https://[::1]/path') === false, 'private IPv6 hosts should not be fetched');

$fallback = text_entity_fallback_card('https://example.com/notes');
assert_true($fallback['provider'] === 'website', 'generic fallback card provider mismatch');
assert_true($fallback['embed'] === null, 'generic fallback cards must not embed arbitrary frames');
assert_true($fallback['metadata']['subtitle'] === 'example.com', 'generic fallback card host mismatch');

$metadata = text_entity_html_metadata(
    '<!doctype html><html><head><title>Fallback title</title><meta property="og:title" content="OG title"><meta name="description" content="Plain &amp; safe"><meta property="og:image" content="/card.jpg"></head></html>',
    'https://example.com/post'
);
assert_true($metadata['title'] === 'OG title', 'Open Graph title should win');
assert_true($metadata['description'] === 'Plain & safe', 'metadata text should decode entities');
assert_true($metadata['imageUrl'] === 'https://example.com/card.jpg', 'relative card images should normalize to HTTPS');

assert_true(is_string($textEntitiesSource), 'text entity source should be readable');
assert_true(str_contains($textEntitiesSource, 'TEXT_ENTITY_LINK_CARD_LIMIT = 3'), 'link card limit should stay capped at three');
assert_true(str_contains($textEntitiesSource, 'preg_match_all(\'#https://'), 'parser should only link explicit HTTPS URLs');
assert_true(str_contains($textEntitiesSource, 'text_entity_resolved_mentions'), 'mention parser should resolve handles');
assert_true(str_contains($textEntitiesSource, "u.status = 'active'"), 'mentions should resolve active users only');
assert_true(str_contains($textEntitiesSource, 'text_entity_range_overlaps'), 'mentions inside URLs should be skipped');
assert_true(str_contains($textEntitiesSource, 'text_entity_existing_mention_user_ids'), 'mention notifications should compare previous mentions');
assert_true(str_contains($textEntitiesSource, 'isset($notified[$targetUserId])'), 'mention notifications should dedupe targets per write');
assert_true(str_contains($textEntitiesSource, 'text_entity_pair_blocked'), 'mention notifications should respect block pairs');
assert_true(str_contains($textEntitiesSource, 'CURLOPT_FOLLOWLOCATION => false'), 'generic card fetch must not follow redirects');
assert_true(str_contains($textEntitiesSource, 'FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE'), 'generic card fetch must reject private and reserved hosts');
assert_true(str_contains($textEntitiesSource, 'DNS_AAAA'), 'generic card fetch should check IPv6 answers');
assert_true(str_contains($textEntitiesSource, 'if (($card[\'provider\'] ?? null) === \'github\')'), 'GitHub cards should never expose iframe embeds');

assert_true(is_string($postsSource), 'posts source should be readable');
assert_true(str_contains($postsSource, "text_entities_store_for_content('post'"), 'posts should persist body entities');
assert_true(str_contains($postsSource, "'notifyMentions' => true"), 'public posts and replies should notify mentions');

assert_true(is_string($chatSource), 'chat source should be readable');
assert_true(str_contains($chatSource, "text_entities_store_for_content('message'"), 'messages should persist body entities');
assert_true(str_contains($chatSource, "'notifyMentions' => false"), 'direct messages must not create mention notifications');

assert_true(is_string($profileSource), 'profile source should be readable');
assert_true(str_contains($profileSource, "text_entities_store_for_content('profile'"), 'profile bios should persist entities');
assert_true(str_contains($profileSource, "'targetUrl' => '/@'"), 'profile bio mentions should target the profile');

assert_true(is_string($profileModulesSource), 'profile modules source should be readable');
assert_true(str_contains($profileModulesSource, "text_entities_store_for_content('profile_module'"), 'profile text modules should persist entities');
assert_true(str_contains($profileModulesSource, '$visibility !== \'public\''), 'hidden profile module entities should be removed');

assert_true(is_string($readSource), 'read source should be readable');
assert_true(str_contains($readSource, "'bodyEntities'"), 'post payloads should expose body entities');
assert_true(str_contains($readSource, "'bioEntities'"), 'profile payloads should expose bio entities');

assert_true(is_string($notificationsSource), 'notifications source should be readable');
assert_true(str_contains($notificationsSource, "'mention'"), 'notification type allowlist should include mentions');
assert_true(str_contains($notificationsSource, '$type === \'mention\''), 'mention notifications should use stored target URLs');

echo "text entities regression ok\n";
