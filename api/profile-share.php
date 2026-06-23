<?php

declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/read.php';

header_remove('Content-Type');

$rawHandle = (string) ($_GET['handle'] ?? '');

if (preg_match('/^[a-z0-9_-]{1,40}$/i', $rawHandle) !== 1) {
    profile_share_page_not_found();
}

$profileRow = fetch_profile_by_handle(normalize_handle($rawHandle));

if (
    $profileRow === null
    || !profile_public_account_available($profileRow, null)
    || !profile_viewer_can_view_row($profileRow, null)
) {
    profile_share_page_not_found();
}

$profile = profile_payload_with_featured(
    $profileRow,
    null,
    profile_social_context((int) $profileRow['user_id'], null),
    null
);
$currentHandle = (string) ($profile['user']['handle'] ?? '');

if (strtolower($rawHandle) !== strtolower($currentHandle)) {
    header('Location: ' . profile_canonical_path($profile), true, 302);
    exit;
}

profile_share_page_render($profile);

function profile_share_page_render(array $profile): void
{
    $displayName = (string) ($profile['user']['displayName'] ?? $profile['user']['handle'] ?? 'thia.lol');
    $handle = (string) ($profile['user']['handle'] ?? 'profile');
    $title = "{$displayName} (@{$handle}) | thia.lol";
    $description = profile_share_description($profile);
    $canonicalUrl = profile_share_page_https_url(profile_canonical_url($profile));
    $imagePath = profile_share_page_card_image_path($profile);
    $imageType = profile_share_page_card_image_type($imagePath);
    $imageUrl = profile_share_page_https_url(post_public_base_url() . $imagePath . '?v=' . profile_share_page_card_version($profile));
    $imageAlt = "Profile card for @{$handle} on thia.lol.";

    $meta = implode("\n    ", [
        '<meta name="description" content="' . profile_share_page_escape($description) . '" />',
        '<meta name="theme-color" content="#223454" />',
        '<meta property="og:site_name" content="thia.lol" />',
        '<meta property="og:type" content="profile" />',
        '<meta property="profile:username" content="' . profile_share_page_escape($handle) . '" />',
        '<meta property="og:title" content="' . profile_share_page_escape($title) . '" />',
        '<meta property="og:description" content="' . profile_share_page_escape($description) . '" />',
        '<meta property="og:url" content="' . profile_share_page_escape($canonicalUrl) . '" />',
        '<meta property="og:image" content="' . profile_share_page_escape($imageUrl) . '" />',
        '<meta property="og:image:secure_url" content="' . profile_share_page_escape($imageUrl) . '" />',
        '<meta property="og:image:type" content="' . profile_share_page_escape($imageType) . '" />',
        '<meta property="og:image:width" content="2400" />',
        '<meta property="og:image:height" content="1260" />',
        '<meta property="og:image:alt" content="' . profile_share_page_escape($imageAlt) . '" />',
        '<meta name="twitter:card" content="summary_large_image" />',
        '<meta name="twitter:title" content="' . profile_share_page_escape($title) . '" />',
        '<meta name="twitter:description" content="' . profile_share_page_escape($description) . '" />',
        '<meta name="twitter:image" content="' . profile_share_page_escape($imageUrl) . '" />',
        '<meta name="twitter:image:alt" content="' . profile_share_page_escape($imageAlt) . '" />',
        '<link rel="canonical" href="' . profile_share_page_escape($canonicalUrl) . '" />',
        '<title>' . profile_share_page_escape($title) . '</title>',
    ]);

    profile_share_page_emit_shell(
        $meta,
        profile_share_page_fallback_html($title, $description, $canonicalUrl, $imageUrl, $imageAlt, 'Open profile on thia.lol')
    );
}

function profile_share_page_not_found(): void
{
    http_response_code(404);
    $title = 'Profile not found | thia.lol';
    $description = 'This profile is not available on thia.lol.';
    $canonicalUrl = profile_share_page_https_url(post_public_base_url() . '/discover');
    $imageUrl = profile_share_page_https_url(post_public_base_url() . '/brand/thia-og.png');
    $imageAlt = 'thia.lol bunny mark and wordmark.';
    $meta = implode("\n    ", [
        '<meta name="description" content="' . profile_share_page_escape($description) . '" />',
        '<meta name="theme-color" content="#223454" />',
        '<meta property="og:site_name" content="thia.lol" />',
        '<meta property="og:type" content="website" />',
        '<meta property="og:title" content="' . profile_share_page_escape($title) . '" />',
        '<meta property="og:description" content="' . profile_share_page_escape($description) . '" />',
        '<meta property="og:url" content="' . profile_share_page_escape($canonicalUrl) . '" />',
        '<meta property="og:image" content="' . profile_share_page_escape($imageUrl) . '" />',
        '<meta property="og:image:secure_url" content="' . profile_share_page_escape($imageUrl) . '" />',
        '<meta property="og:image:type" content="image/png" />',
        '<meta property="og:image:width" content="2400" />',
        '<meta property="og:image:height" content="1260" />',
        '<meta property="og:image:alt" content="' . profile_share_page_escape($imageAlt) . '" />',
        '<meta name="twitter:card" content="summary_large_image" />',
        '<meta name="twitter:title" content="' . profile_share_page_escape($title) . '" />',
        '<meta name="twitter:description" content="' . profile_share_page_escape($description) . '" />',
        '<meta name="twitter:image" content="' . profile_share_page_escape($imageUrl) . '" />',
        '<meta name="twitter:image:alt" content="' . profile_share_page_escape($imageAlt) . '" />',
        '<link rel="canonical" href="' . profile_share_page_escape($canonicalUrl) . '" />',
        '<title>' . profile_share_page_escape($title) . '</title>',
    ]);

    profile_share_page_emit_shell(
        $meta,
        profile_share_page_fallback_html($title, $description, $canonicalUrl, $imageUrl, $imageAlt, 'Open thia.lol')
    );
}

function profile_share_page_emit_shell(string $metaHtml, string $fallbackHtml = ''): void
{
    header('Content-Type: text/html; charset=utf-8');
    header('Cache-Control: no-cache, no-store, must-revalidate');
    header('X-Content-Type-Options: nosniff');

    $indexPath = dirname(__DIR__) . '/index.html';
    $html = is_file($indexPath) ? file_get_contents($indexPath) : false;

    if (!is_string($html) || $html === '') {
        echo "<!doctype html><html lang=\"en\"><head><meta charset=\"UTF-8\" /><meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\" />{$metaHtml}</head><body><noscript>{$fallbackHtml}</noscript><div id=\"root\"></div></body></html>";
        exit;
    }

    $html = preg_replace('/\s*<title\b[^>]*>.*?<\/title>\s*/is', "\n", $html);
    $html = preg_replace('/\s*<meta\b(?=[^>]*(?:name|property)=["\'](?:description|theme-color|og:[^"\']+|profile:[^"\']+|twitter:[^"\']+)["\'])[^>]*>\s*/is', "\n", $html);
    $html = preg_replace('/\s*<link\b(?=[^>]*rel=["\']canonical["\'])[^>]*>\s*/is', "\n", $html);
    $html = preg_replace('/<\/head>/i', "    {$metaHtml}\n  </head>", $html, 1);
    $html = preg_replace('/<body([^>]*)>/i', '<body$1><noscript>' . $fallbackHtml . '</noscript>', $html, 1);

    echo $html;
    exit;
}

function profile_share_page_fallback_html(
    string $title,
    string $description,
    string $canonicalUrl,
    string $imageUrl,
    string $imageAlt,
    string $linkLabel
): string {
    return '<main>'
        . '<a href="' . profile_share_page_escape($canonicalUrl) . '">'
        . '<img src="' . profile_share_page_escape($imageUrl) . '" width="2400" height="1260" alt="' . profile_share_page_escape($imageAlt) . '" />'
        . '</a>'
        . '<h1>' . profile_share_page_escape($title) . '</h1>'
        . '<p>' . profile_share_page_escape($description) . '</p>'
        . '<p><a href="' . profile_share_page_escape($canonicalUrl) . '">' . profile_share_page_escape($linkLabel) . '</a></p>'
        . '</main>';
}

function profile_share_page_https_url(string $url): string
{
    $url = trim($url);

    if (str_starts_with($url, '//')) {
        return 'https:' . $url;
    }

    return preg_replace('#^http://#i', 'https://', $url) ?? $url;
}

function profile_share_page_escape(string $value): string
{
    return htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

function profile_share_page_card_version(array $profile): string
{
    $cachedCardPath = profile_share_page_cached_card_path((string) ($profile['user']['handle'] ?? ''));
    $cachedCardMtime = ($cachedCardPath !== null && is_file($cachedCardPath))
        ? (string) ((int) filemtime($cachedCardPath))
        : 'uncached';
    $basis = implode('|', [
        'mosaic-v6',
        $cachedCardMtime,
        (string) ($profile['user']['handle'] ?? ''),
        (string) ($profile['updatedAt'] ?? ''),
        (string) ($profile['profileBackground'] ?? ''),
        (string) ($profile['bannerUrl'] ?? ''),
        (string) ($profile['user']['avatarUrl'] ?? ''),
    ]);

    return substr(hash('sha256', $basis), 0, 16);
}

function profile_share_page_card_image_path(array $profile): string
{
    $handle = (string) ($profile['user']['handle'] ?? '');
    $cachedCardPath = profile_share_page_cached_card_path($handle);

    if ($cachedCardPath !== null && is_file($cachedCardPath)) {
        $cachedCardUrlPath = profile_share_page_cached_card_url_path($handle);

        if ($cachedCardUrlPath !== null) {
            return $cachedCardUrlPath;
        }
    }

    return profile_share_card_path($profile);
}

function profile_share_page_card_image_type(string $path): string
{
    $extension = strtolower(pathinfo(parse_url($path, PHP_URL_PATH) ?: $path, PATHINFO_EXTENSION));

    return ($extension === 'jpg' || $extension === 'jpeg') ? 'image/jpeg' : 'image/png';
}

function profile_share_page_cached_card_path(string $handle): ?string
{
    $normalized = strtolower(trim($handle));

    if (preg_match('/^[a-z0-9_-]{1,80}$/', $normalized) !== 1) {
        return null;
    }

    return dirname(__DIR__) . '/uploads/share-cards/profiles/' . $normalized . '-mosaic-v6.jpg';
}

function profile_share_page_cached_card_url_path(string $handle): ?string
{
    $normalized = strtolower(trim($handle));

    if (preg_match('/^[a-z0-9_-]{1,80}$/', $normalized) !== 1) {
        return null;
    }

    return '/uploads/share-cards/profiles/' . rawurlencode($normalized . '-mosaic-v6.jpg');
}
