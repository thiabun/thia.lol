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

$migration = file_text('backend/database/migrations/20260621_0003_add_profile_stars.sql');
$schema = file_text('backend/database/schema.sql');
$router = file_text('api/index.php');
$follows = file_text('api/follows.php');
$read = file_text('api/read.php');
$posts = file_text('api/posts.php');
$types = file_text('src/lib/types.ts');
$api = file_text('src/lib/api.ts');
$profilePage = file_text('src/pages/ProfilePage.tsx');
$discoverPage = file_text('src/pages/DiscoverPage.tsx');

foreach ([$migration, $schema] as $sql) {
    assert_contains($sql, 'CREATE TABLE IF NOT EXISTS profile_stars', 'profile_stars table missing');
    assert_contains($sql, 'starrer_id BIGINT UNSIGNED NOT NULL', 'starrer_id column missing');
    assert_contains($sql, 'starred_user_id BIGINT UNSIGNED NOT NULL', 'starred_user_id column missing');
    assert_contains($sql, 'PRIMARY KEY (starrer_id, starred_user_id)', 'profile star unique pair missing');
    assert_contains($sql, 'KEY profile_stars_starred_user_id_idx (starred_user_id)', 'star count index missing');
    assert_contains($sql, 'KEY profile_stars_created_at_idx (created_at)', 'profile star created_at index missing');
    assert_contains($sql, 'FOREIGN KEY (starrer_id) REFERENCES users(id)', 'starrer foreign key missing');
    assert_contains($sql, 'FOREIGN KEY (starred_user_id) REFERENCES users(id)', 'starred user foreign key missing');
    assert_contains($sql, 'ON DELETE CASCADE', 'profile stars should cascade on deleted users');
}

assert_contains($router, "'star'", 'profile star route is not dispatched');

assert_contains($follows, 'function profile_star_create', 'star create endpoint missing');
assert_contains($follows, 'function profile_star_delete', 'star delete endpoint missing');
assert_contains($follows, 'require_authenticated_session();', 'star endpoint auth guard missing');
assert_contains($follows, 'require_csrf_token($session);', 'star endpoint CSRF guard missing');
assert_contains($follows, 'require_profile_stars_table();', 'star storage readiness guard missing');
assert_contains($follows, 'You cannot star yourself.', 'self-star rejection missing');
assert_contains($follows, 'You cannot unstar yourself.', 'self-unstar rejection missing');
assert_contains($follows, 'INSERT IGNORE INTO profile_stars', 'duplicate star dedupe missing');
assert_contains($follows, 'DELETE FROM profile_stars', 'unstar deletion missing');
assert_contains($follows, 'reject_blocked_star($viewerUserId, $targetUserId);', 'blocked star enforcement missing');
assert_contains($follows, 'Unblock this member before starring.', 'viewer-block star error missing');
assert_contains($follows, 'You cannot star this member.', 'target-blocked star error missing');
assert_contains($follows, 'profile_star_response', 'star response wrapper missing');
assert_contains($follows, "'isStarred'", 'star response state missing');
assert_contains($follows, "'starCount'", 'star response count missing');

assert_contains($read, 'function profile_stars_table_exists', 'profile stars table helper missing');
assert_contains($read, 'function profile_star_count_sql', 'profile star count helper missing');
assert_contains($read, 'function profile_stars_aggregate_sql', 'profile star aggregate helper missing');
assert_contains($read, "profile_star_users.status = 'active'", 'star counts must require active starrers');
assert_contains($read, "pair_not_blocked_sql('profile_star_counts.starrer_id', 'profile_star_counts.starred_user_id')", 'star counts must exclude blocked pairs');
assert_contains($read, "\$stats['stars'] = (int) \$social['starCount'];", 'profile stats stars missing');
assert_contains($read, "'isStarred' => (bool) \$social['isStarred']", 'profile isStarred missing');
assert_contains($read, "COALESCE(profile_stars.star_count, 0) AS star_count", 'post/discover star count select missing');
assert_contains($read, 'discover_rank_score DESC', 'discover people blended ranking missing');
assert_contains($read, 'COALESCE(profile_stars.star_count, 0) * 12', 'discover ranking must boost stars');
assert_contains($read, 'profile_modules.module_count', 'discover ranking profile module quality missing');
assert_contains($read, 'featured_badges.badge_count', 'discover ranking featured badge quality missing');
assert_contains($read, "u.handle NOT REGEXP '^smoketest[0-9]+$'", 'discover people smoke user exclusion missing');
assert_true(
    !str_contains($read, 'AND viewer_follows.following_id IS NULL'),
    'discover people should not hard-exclude already-followed profiles'
);

assert_contains($posts, "profile_stars_aggregate_sql()", 'post mutation payloads must expose embedded profile stars');
assert_contains($posts, "COALESCE(profile_stars.star_count, 0) AS star_count", 'post mutation star count select missing');

assert_contains($types, 'starCount: number;', 'frontend star count type missing');
assert_contains($types, 'isStarred: boolean;', 'frontend isStarred type missing');
assert_contains($types, 'stars: number;', 'frontend stars stat type missing');
assert_contains($api, 'export function starProfile', 'star API helper missing');
assert_contains($api, 'export function unstarProfile', 'unstar API helper missing');
assert_contains($api, 'normalizeProfileStarResult', 'star API response normalization missing');
assert_contains($profilePage, 'data-testid="profile-star-button"', 'profile star button hook missing');
assert_contains($profilePage, 'handleStarToggle', 'profile star handler missing');
assert_contains($profilePage, '{ label: "Stars", value: profile.stats.stars }', 'profile-info stars stat missing');
assert_contains($discoverPage, 'person.starCount', 'discover people star count missing');

echo "profile stars regression source checks ok\n";
