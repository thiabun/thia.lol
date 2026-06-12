<?php

declare(strict_types=1);

function assert_true(bool $condition, string $message): void
{
    if (!$condition) {
        fwrite(STDERR, $message . PHP_EOL);
        exit(1);
    }
}

$readSource = file_get_contents(dirname(__DIR__, 2) . '/api/read.php');
$postsSource = file_get_contents(dirname(__DIR__, 2) . '/api/posts.php');

assert_true(is_string($readSource), 'could not read api/read.php');
assert_true(is_string($postsSource), 'could not read api/posts.php');

assert_true(
    str_contains($readSource, "function profile_received_likes_count_sql"),
    'profile likes count helper is missing'
);
assert_true(
    str_contains($readSource, "function profile_received_likes_aggregate_sql"),
    'profile likes aggregate helper is missing'
);
assert_true(
    substr_count($readSource, "profile_likes.type = 'glow'") >= 2,
    'profile likes helpers must count glow likes'
);
assert_true(
    !str_contains($readSource, "echoes.type = 'echo'"),
    'profile endpoint must not use echo reactions for the Likes stat'
);
assert_true(
    str_contains($readSource, "public_post_visible_sql('profile_like_posts', 'profile_like_rooms')"),
    'profile likes must use public post visibility filtering'
);
assert_true(
    str_contains($readSource, "post_ancestor_visibility_sql('profile_like_posts')"),
    'profile likes must exclude replies under hidden ancestors'
);
assert_true(
    str_contains($readSource, "profile_received_likes_count_sql('u.id') . \" AS profile_like_count"),
    'profile show query must expose profile_like_count'
);
assert_true(
    str_contains($readSource, "COALESCE(profile_likes.like_count, 0) AS profile_like_count"),
    'read post payloads must expose embedded profile_like_count'
);
assert_true(
    str_contains($postsSource, "COALESCE(profile_likes.like_count, 0) AS profile_like_count"),
    'post mutation payloads must expose embedded profile_like_count'
);
assert_true(
    str_contains($postsSource, "profile_received_likes_aggregate_sql()"),
    'post mutation payloads must share the profile likes aggregate query'
);

echo "profile likes regression ok\n";
