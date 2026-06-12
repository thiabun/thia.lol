<?php

declare(strict_types=1);

function assert_true(bool $condition, string $message): void
{
    if (!$condition) {
        fwrite(STDERR, $message . PHP_EOL);
        exit(1);
    }
}

function file_text(string $relativePath): string
{
    $path = dirname(__DIR__, 2) . '/' . $relativePath;
    $contents = file_get_contents($path);

    assert_true(is_string($contents), "Could not read {$relativePath}");

    return $contents;
}

function assert_contains(string $haystack, string $needle, string $message): void
{
    assert_true(str_contains($haystack, $needle), $message);
}

function assert_matches(string $pattern, string $text, string $message): void
{
    assert_true(preg_match($pattern, $text) === 1, $message);
}

$migration = file_text('backend/database/migrations/20260611_0001_add_user_blocks_and_mutes.sql');
$schema = file_text('backend/database/schema.sql');
$router = file_text('api/index.php');
$follows = file_text('api/follows.php');
$chat = file_text('api/chat.php');
$read = file_text('api/read.php');

foreach ([$migration, $schema] as $sql) {
    assert_contains($sql, 'CREATE TABLE IF NOT EXISTS user_blocks', 'user_blocks table missing');
    assert_contains($sql, 'blocker_id BIGINT UNSIGNED NOT NULL', 'blocker_id missing');
    assert_contains($sql, 'blocked_id BIGINT UNSIGNED NOT NULL', 'blocked_id missing');
    assert_contains($sql, 'PRIMARY KEY (blocker_id, blocked_id)', 'user_blocks uniqueness missing');
    assert_contains($sql, 'KEY user_blocks_blocked_id_idx (blocked_id)', 'blocked_id lookup index missing');
    assert_contains($sql, 'KEY user_blocks_created_at_idx (created_at)', 'user_blocks created_at index missing');
    assert_contains($sql, 'FOREIGN KEY (blocker_id) REFERENCES users(id)', 'blocker foreign key missing');
    assert_contains($sql, 'FOREIGN KEY (blocked_id) REFERENCES users(id)', 'blocked foreign key missing');

    assert_contains($sql, 'CREATE TABLE IF NOT EXISTS user_mutes', 'user_mutes table missing');
    assert_contains($sql, 'muter_id BIGINT UNSIGNED NOT NULL', 'muter_id missing');
    assert_contains($sql, 'muted_id BIGINT UNSIGNED NOT NULL', 'muted_id missing');
    assert_contains($sql, 'PRIMARY KEY (muter_id, muted_id)', 'user_mutes uniqueness missing');
    assert_contains($sql, 'KEY user_mutes_muted_id_idx (muted_id)', 'muted_id lookup index missing');
    assert_contains($sql, 'KEY user_mutes_created_at_idx (created_at)', 'user_mutes created_at index missing');
    assert_contains($sql, 'FOREIGN KEY (muter_id) REFERENCES users(id)', 'muter foreign key missing');
    assert_contains($sql, 'FOREIGN KEY (muted_id) REFERENCES users(id)', 'muted foreign key missing');
    assert_matches('/ON DELETE CASCADE[\s\S]*ON DELETE CASCADE/', $sql, 'safe cascade behavior missing');
}

assert_contains($router, "['follow', 'followers', 'following', 'block', 'mute', 'follower']", 'profile control routes not dispatched');

assert_contains($follows, 'function profile_block_create', 'block create endpoint missing');
assert_contains($follows, 'function profile_block_delete', 'block delete endpoint missing');
assert_contains($follows, 'function profile_mute_create', 'mute create endpoint missing');
assert_contains($follows, 'function profile_mute_delete', 'mute delete endpoint missing');
assert_contains($follows, 'function profile_follower_delete', 'remove follower endpoint missing');
assert_contains($follows, 'require_authenticated_session();', 'auth guard missing');
assert_contains($follows, 'require_csrf_token($session);', 'CSRF guard missing');
assert_contains($follows, 'require_user_blocks_table();', 'block storage readiness guard missing');
assert_contains($follows, 'require_user_mutes_table();', 'mute storage readiness guard missing');
assert_contains($follows, 'You cannot block yourself.', 'self-block rejection missing');
assert_contains($follows, 'You cannot mute yourself.', 'self-mute rejection missing');
assert_contains($follows, 'INSERT IGNORE INTO user_blocks', 'idempotent block insert missing');
assert_contains($follows, 'INSERT IGNORE INTO user_mutes', 'idempotent mute insert missing');
assert_contains($follows, 'DELETE FROM user_follows', 'follow cleanup missing from block/remove-follower');
assert_contains($follows, 'viewer_follows_target', 'block should remove viewer-to-target follow');
assert_contains($follows, 'target_follows_viewer', 'block should remove target-to-viewer follow');
assert_contains($follows, 'WHERE follower_id = :target_user_id', 'remove follower should delete only target-to-viewer row');
assert_contains($follows, 'AND following_id = :viewer_user_id', 'remove follower should target current user follower row');
assert_contains($follows, 'reject_blocked_follow($viewerUserId, $targetUserId);', 'blocked follow enforcement missing');
assert_contains($follows, 'Unblock this member before following.', 'current-user block follow error missing');
assert_contains($follows, 'You cannot follow this member.', 'target-blocked follow error missing');
assert_contains($follows, 'profile_control_response', 'relationship response wrapper missing');

assert_contains($read, 'isBlocked', 'profile relationship block state missing');
assert_contains($read, 'isMuted', 'profile relationship mute state missing');
assert_contains($read, 'viewer_feed_relationship_filter_sql', 'feed mute/block filter helper missing');
assert_contains($read, 'fetch_home_feed', 'home feed function missing');
assert_contains($read, 'fetch_discover_posts', 'discover feed function missing');
assert_contains($read, 'FROM user_mutes feed_mutes', 'mute feed filtering missing');
assert_contains($read, 'FROM user_blocks pair_blocks', 'block relationship filtering missing');

assert_contains($chat, 'reject_blocked_chat($viewerUserId, $targetUserId);', 'chat conversation block enforcement missing');
assert_contains($chat, "reject_blocked_chat(\$viewerUserId, (int) \$conversation['otherParticipant']['id']);", 'chat message send block enforcement missing');
assert_contains($chat, 'chat_blocked_pair_filter_sql', 'chat moot picker block filter missing');
assert_contains($chat, 'Unblock this member before messaging.', 'current-user block chat error missing');
assert_contains($chat, 'You cannot message this member.', 'target-blocked chat error missing');

echo "block/mute/remove-follower foundation source checks ok\n";
