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

assert_true(profile_featured_nullable_input_id(null, 'Featured post') === null, 'null featured id mismatch');
assert_true(profile_featured_nullable_input_id('', 'Featured post') === null, 'empty featured id mismatch');
assert_true(profile_featured_nullable_input_id(42, 'Featured post') === 42, 'integer featured id mismatch');
assert_true(profile_featured_nullable_input_id('42', 'Featured room') === 42, 'string featured id mismatch');

profile_featured_reject_unknown_keys(
    [
        'featuredPostId' => 42,
        'featuredRoomId' => null,
    ],
    ['featuredPostId', 'featuredRoomId']
);

echo "profile featured regression ok\n";
