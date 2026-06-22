<?php

declare(strict_types=1);

$root = dirname(__DIR__, 2);
$roomsSource = file_get_contents($root . '/api/rooms.php');

function rooms_assert(bool $condition, string $message): void
{
    if (!$condition) {
        fwrite(STDERR, $message . PHP_EOL);
        exit(1);
    }
}

rooms_assert(is_string($roomsSource), 'rooms source should be readable');
rooms_assert(str_contains($roomsSource, 'function room_body_alias_value'), 'room updates should use a nullable-safe body alias helper');
rooms_assert(str_contains($roomsSource, "room_body_alias_value(\$body, 'iconUrl', 'icon_url')"), 'room icon URL updates should preserve explicit null camelCase values');
rooms_assert(str_contains($roomsSource, "room_body_alias_value(\$body, 'bannerUrl', 'banner_url')"), 'room banner URL updates should preserve explicit null camelCase values');
rooms_assert(str_contains($roomsSource, "room_body_alias_value(\$body, 'summary', 'description')"), 'room summaries should use nullable-safe summary/description aliases');
rooms_assert(!str_contains($roomsSource, "\$body['iconUrl'] ?? \$body['icon_url']"), 'room icon URL updates should not fall through to missing snake_case aliases');
rooms_assert(!str_contains($roomsSource, "\$body['bannerUrl'] ?? \$body['banner_url']"), 'room banner URL updates should not fall through to missing snake_case aliases');

echo "rooms regression ok\n";
