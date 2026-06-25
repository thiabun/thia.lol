<?php

declare(strict_types=1);

require_once __DIR__ . '/read.php';

$baseUrl = rtrim((string) (api_config()['app']['base_url'] ?? 'https://thia.lol'), '/');
$urls = [
    sitemap_url($baseUrl, '/', null, 'daily'),
    sitemap_url($baseUrl, '/discover', null, 'hourly'),
    sitemap_url($baseUrl, '/search', null, 'weekly'),
    sitemap_url($baseUrl, '/rooms', null, 'daily'),
    sitemap_url($baseUrl, '/terms', null, 'monthly'),
    sitemap_url($baseUrl, '/privacy', null, 'monthly'),
    sitemap_url($baseUrl, '/community-guidelines', null, 'monthly'),
    sitemap_url($baseUrl, '/copyright', null, 'monthly'),
    sitemap_url($baseUrl, '/moderation', null, 'monthly'),
];

try {
    foreach (sitemap_profile_rows() as $row) {
        $urls[] = sitemap_url(
            $baseUrl,
            '/@' . rawurlencode((string) $row['handle']),
            $row['updated_at'] ?? $row['created_at'] ?? null,
            'weekly'
        );
    }

    foreach (sitemap_room_rows() as $row) {
        $urls[] = sitemap_url(
            $baseUrl,
            '/rooms/' . rawurlencode((string) $row['slug']),
            $row['updated_at'] ?? $row['created_at'] ?? null,
            'daily'
        );
    }

    foreach (sitemap_post_rows() as $row) {
        $identifier = (string) ($row['public_id'] ?? $row['id']);
        $urls[] = sitemap_url(
            $baseUrl,
            '/@' . rawurlencode((string) $row['handle']) . '/posts/' . rawurlencode($identifier),
            $row['updated_at'] ?? $row['created_at'] ?? null,
            'weekly'
        );
    }
} catch (Throwable) {
    // Keep a valid sitemap for crawlers even if database-backed rows are temporarily unavailable.
}

header('Content-Type: application/xml; charset=utf-8');
header('X-Content-Type-Options: nosniff');
echo "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n";
echo "<urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\">\n";

foreach ($urls as $url) {
    echo "  <url>\n";
    echo '    <loc>' . sitemap_escape($url['loc']) . "</loc>\n";

    if ($url['lastmod'] !== null) {
        echo '    <lastmod>' . sitemap_escape($url['lastmod']) . "</lastmod>\n";
    }

    echo '    <changefreq>' . sitemap_escape($url['changefreq']) . "</changefreq>\n";
    echo "  </url>\n";
}

echo "</urlset>\n";

function sitemap_url(string $baseUrl, string $path, ?string $lastmod, string $changefreq): array
{
    return [
        'loc' => $baseUrl . $path,
        'lastmod' => sitemap_lastmod($lastmod),
        'changefreq' => $changefreq,
    ];
}

function sitemap_profile_rows(): array
{
    $visibilityFilter = profile_visibility_column_exists() ? "AND p.visibility = 'public'" : '';

    return db_query(
        "SELECT u.handle, p.created_at, p.updated_at
         FROM users u
         INNER JOIN profiles p ON p.user_id = u.id
         WHERE " . user_publicly_available_sql('u') . "
           {$visibilityFilter}
         ORDER BY p.updated_at DESC
         LIMIT 1000"
    )->fetchAll();
}

function sitemap_room_rows(): array
{
    return db_query(
        "SELECT slug, created_at, updated_at
         FROM rooms
         WHERE visibility IN ('public', 'view_only')
           " . room_not_deleted_sql('rooms') . "
         ORDER BY updated_at DESC
         LIMIT 1000"
    )->fetchAll();
}

function sitemap_post_rows(): array
{
    $profileVisibilityFilter = profile_visibility_column_exists() ? "AND pr.visibility = 'public'" : '';
    $publicIdSelect = posts_public_id_column_exists() ? 'p.public_id' : 'NULL AS public_id';

    return db_query(
        "SELECT p.id, {$publicIdSelect}, p.created_at, p.updated_at, u.handle
         FROM posts p
         INNER JOIN users u ON u.id = p.author_id
         INNER JOIN profiles pr ON pr.user_id = u.id
         LEFT JOIN rooms r ON r.id = p.room_id
         WHERE p.visibility = 'public'
           AND p.status = 'published'
           AND p.deleted_at IS NULL
           AND " . user_publicly_available_sql('u') . "
           {$profileVisibilityFilter}
           AND (p.room_id IS NULL OR (r.visibility IN ('public', 'view_only') " . room_not_deleted_sql('r') . "))
         ORDER BY p.updated_at DESC
         LIMIT 1000"
    )->fetchAll();
}

function sitemap_lastmod(?string $value): ?string
{
    if (!is_string($value) || trim($value) === '') {
        return null;
    }

    $timestamp = strtotime($value);

    return $timestamp === false ? null : gmdate('Y-m-d', $timestamp);
}

function sitemap_escape(string $value): string
{
    return htmlspecialchars($value, ENT_XML1 | ENT_QUOTES, 'UTF-8');
}
