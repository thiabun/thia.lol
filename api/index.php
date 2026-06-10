<?php

declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/auth.php';
require_once __DIR__ . '/read.php';
require_once __DIR__ . '/posts.php';
require_once __DIR__ . '/follows.php';
require_once __DIR__ . '/moderation.php';
require_once __DIR__ . '/migrations.php';
require_once __DIR__ . '/setup.php';

function health_response(): void
{
    $payload = [
        'ok' => true,
        'service' => 'thia.lol api',
        'status' => 'ok',
        'time' => gmdate('c'),
    ];

    if (($_GET['db'] ?? null) === '1') {
        require_once __DIR__ . '/db.php';

        try {
            db_query('SELECT 1 AS ok');
        } catch (Throwable $exception) {
            json_error('Database connection failed.', 503, $exception, [
                'database' => [
                    'ok' => false,
                ],
            ]);
        }

        $payload['database'] = [
            'ok' => true,
        ];
    }

    json_response($payload);
}

try {
    $route = api_route_path();
    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
    $segments = $route === '' ? [] : explode('/', $route);

    if ($method === 'OPTIONS') {
        json_response(['ok' => true]);
    }

    if (($segments[0] ?? null) === 'auth' && count($segments) === 2) {
        auth_dispatch($segments[1], $method);
    }

    if (($segments[0] ?? null) === 'posts' && in_array($method, ['GET', 'POST', 'PATCH', 'DELETE'], true)) {
        posts_dispatch($segments, $method);
    }

    if (
        ($segments[0] ?? null) === 'profiles' &&
        count($segments) === 3 &&
        in_array($segments[2], ['follow', 'followers', 'following'], true)
    ) {
        follows_dispatch($segments, $method);
    }

    if (($segments[0] ?? null) === 'reports') {
        reports_dispatch($segments, $method);
    }

    if (($segments[0] ?? null) === 'admin' && ($segments[1] ?? null) === 'auth') {
        auth_admin_dispatch($segments, $method);
    }

    if (($segments[0] ?? null) === 'admin' && ($segments[1] ?? null) === 'migrations') {
        migrations_dispatch($segments, $method);
    }

    if (($segments[0] ?? null) === 'admin') {
        admin_dispatch($segments, $method);
    }

    if (($segments[0] ?? null) === 'setup') {
        setup_dispatch($segments, $method);
    }

    if ($method !== 'GET' && $method !== 'HEAD') {
        json_error('Method not allowed.', 405);
    }

    if ($route === '' || $route === 'health') {
        health_response();
    }

    if (($segments[0] ?? null) === 'profiles' && count($segments) === 2) {
        profiles_show($segments[1]);
    }

    if (($segments[0] ?? null) === 'profiles' && count($segments) === 3 && $segments[2] === 'posts') {
        profile_posts_index($segments[1]);
    }

    if (($segments[0] ?? null) === 'profiles' && count($segments) === 3 && $segments[2] === 'replies') {
        profile_replies_index($segments[1]);
    }

    if (($segments[0] ?? null) === 'profiles' && count($segments) === 3 && $segments[2] === 'rooms') {
        profile_rooms_index($segments[1]);
    }

    if (($segments[0] ?? null) === 'rooms' && count($segments) === 1) {
        rooms_index();
    }

    if (($segments[0] ?? null) === 'rooms' && count($segments) === 2) {
        rooms_show($segments[1]);
    }

    if (($segments[0] ?? null) === 'rooms' && count($segments) === 3 && $segments[2] === 'posts') {
        room_posts_index($segments[1]);
    }

    if (($segments[0] ?? null) === 'feed' && count($segments) === 2 && $segments[1] === 'home') {
        home_feed_index();
    }

    if (($segments[0] ?? null) === 'feed' && count($segments) === 2 && $segments[1] === 'discover') {
        discover_feed_index();
    }

    if (($segments[0] ?? null) === 'posts' && count($segments) === 1) {
        posts_index();
    }

    if (($segments[0] ?? null) === 'stats' && count($segments) === 1) {
        stats_index();
    }

    json_error('Not found.', 404);
} catch (Throwable $exception) {
    json_error('Internal server error.', 500, $exception);
}
