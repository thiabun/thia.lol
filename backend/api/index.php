<?php

declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

$path = trim(parse_url($_SERVER['REQUEST_URI'] ?? '/api', PHP_URL_PATH), '/');
$path = preg_replace('#^api/?#', '', $path);

if ($path === '' || $path === 'health') {
    json_response([
        'ok' => true,
        'service' => 'thia.lol api',
        'status' => 'skeleton',
        'routes' => [
            '/api/health',
            '/api/posts',
            '/api/discover',
            '/api/rooms',
            '/api/profiles/{handle}',
        ],
    ]);
}

json_response([
    'ok' => false,
    'error' => 'Not implemented yet',
    'path' => $path,
], 404);
