<?php

declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/read.php';

header_remove('Content-Type');

$rawHandle = (string) ($_GET['handle'] ?? '');
$rawPostIdentifier = (string) ($_GET['postId'] ?? '');

if (preg_match('/^[a-z0-9_-]{1,40}$/i', $rawHandle) !== 1 || normalize_post_public_identifier($rawPostIdentifier) === null) {
    post_share_page_not_found();
}

$post = fetch_public_post_payload_by_identifier_or_null($rawPostIdentifier, null);

if ($post === null) {
    post_share_page_not_found();
}

$currentHandle = (string) ($post['author']['handle'] ?? '');
$currentIdentifier = post_public_identifier($post);

if (strtolower($rawHandle) !== strtolower($currentHandle) || strtolower($rawPostIdentifier) !== strtolower($currentIdentifier)) {
    header('Location: ' . post_canonical_path($post), true, 302);
    exit;
}

post_share_page_render($post);

function post_share_page_render(array $post): void
{
    $authorName = (string) ($post['author']['displayName'] ?? $post['author']['handle'] ?? 'thia.lol');
    $authorHandle = (string) ($post['author']['handle'] ?? 'profile');
    $title = "{$authorName} on thia.lol";
    $description = post_body_snippet((string) ($post['body'] ?? ''), 220);
    $canonicalUrl = post_share_page_https_url(post_canonical_url($post));
    $imageUrl = post_share_page_https_url(post_public_base_url() . post_share_card_path($post) . '?v=' . post_share_page_card_version($post));
    $imageAlt = "Post by @{$authorHandle} on thia.lol.";
    $createdAt = (string) ($post['createdAt'] ?? '');

    $meta = [
        '<meta name="description" content="' . post_share_page_escape($description) . '" />',
        '<meta name="theme-color" content="#223454" />',
        '<meta property="og:site_name" content="thia.lol" />',
        '<meta property="og:type" content="article" />',
        '<meta property="og:title" content="' . post_share_page_escape($title) . '" />',
        '<meta property="og:description" content="' . post_share_page_escape($description) . '" />',
        '<meta property="og:url" content="' . post_share_page_escape($canonicalUrl) . '" />',
        '<meta property="og:image" content="' . post_share_page_escape($imageUrl) . '" />',
        '<meta property="og:image:secure_url" content="' . post_share_page_escape($imageUrl) . '" />',
        '<meta property="og:image:type" content="image/png" />',
        '<meta property="og:image:width" content="2400" />',
        '<meta property="og:image:height" content="1260" />',
        '<meta property="og:image:alt" content="' . post_share_page_escape($imageAlt) . '" />',
        '<meta name="twitter:card" content="summary_large_image" />',
        '<meta name="twitter:title" content="' . post_share_page_escape($title) . '" />',
        '<meta name="twitter:description" content="' . post_share_page_escape($description) . '" />',
        '<meta name="twitter:image" content="' . post_share_page_escape($imageUrl) . '" />',
        '<meta name="twitter:image:alt" content="' . post_share_page_escape($imageAlt) . '" />',
        '<link rel="canonical" href="' . post_share_page_escape($canonicalUrl) . '" />',
        '<title>' . post_share_page_escape($title) . '</title>',
    ];

    if ($createdAt !== '') {
        $meta[] = '<meta property="article:published_time" content="' . post_share_page_escape(post_share_page_iso_date($createdAt)) . '" />';
    }

    post_share_page_emit_shell(
        implode("\n    ", $meta),
        post_share_page_fallback_html($title, $description, $canonicalUrl, $imageUrl, $imageAlt)
    );
}

function post_share_page_not_found(): void
{
    http_response_code(404);
    $title = 'Post not found | thia.lol';
    $description = 'This post is not available on thia.lol.';
    $canonicalUrl = post_share_page_https_url(post_public_base_url() . '/discover');
    $imageUrl = post_share_page_https_url(post_public_base_url() . '/brand/thia-og.png');
    $imageAlt = 'thia.lol bunny mark and wordmark.';
    $meta = implode("\n    ", [
        '<meta name="description" content="' . post_share_page_escape($description) . '" />',
        '<meta name="theme-color" content="#223454" />',
        '<meta property="og:site_name" content="thia.lol" />',
        '<meta property="og:type" content="website" />',
        '<meta property="og:title" content="' . post_share_page_escape($title) . '" />',
        '<meta property="og:description" content="' . post_share_page_escape($description) . '" />',
        '<meta property="og:url" content="' . post_share_page_escape($canonicalUrl) . '" />',
        '<meta property="og:image" content="' . post_share_page_escape($imageUrl) . '" />',
        '<meta property="og:image:secure_url" content="' . post_share_page_escape($imageUrl) . '" />',
        '<meta property="og:image:type" content="image/png" />',
        '<meta property="og:image:width" content="2400" />',
        '<meta property="og:image:height" content="1260" />',
        '<meta property="og:image:alt" content="' . post_share_page_escape($imageAlt) . '" />',
        '<meta name="twitter:card" content="summary_large_image" />',
        '<meta name="twitter:title" content="' . post_share_page_escape($title) . '" />',
        '<meta name="twitter:description" content="' . post_share_page_escape($description) . '" />',
        '<meta name="twitter:image" content="' . post_share_page_escape($imageUrl) . '" />',
        '<meta name="twitter:image:alt" content="' . post_share_page_escape($imageAlt) . '" />',
        '<link rel="canonical" href="' . post_share_page_escape($canonicalUrl) . '" />',
        '<title>' . post_share_page_escape($title) . '</title>',
    ]);

    post_share_page_emit_shell(
        $meta,
        post_share_page_fallback_html($title, $description, $canonicalUrl, $imageUrl, $imageAlt)
    );
}

function post_share_page_emit_shell(string $metaHtml, string $fallbackHtml = ''): void
{
    header('Content-Type: text/html; charset=utf-8');
    header('Cache-Control: no-cache, no-store, must-revalidate');
    header('X-Content-Type-Options: nosniff');

    $indexPath = dirname(__DIR__) . '/index.html';
    $html = is_file($indexPath) ? file_get_contents($indexPath) : false;

    if (!is_string($html) || $html === '') {
        $body = $fallbackHtml === ''
            ? '<div id="root"></div>'
            : '<noscript>' . $fallbackHtml . '</noscript><div id="root"></div>';
        echo "<!doctype html><html lang=\"en\"><head><meta charset=\"UTF-8\" /><meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\" />{$metaHtml}</head><body>{$body}</body></html>";
        exit;
    }

    $html = preg_replace('/\s*<title\b[^>]*>.*?<\/title>\s*/is', "\n", $html);
    $html = preg_replace('/\s*<meta\b(?=[^>]*(?:name|property)=["\'](?:description|theme-color|og:[^"\']+|twitter:[^"\']+)["\'])[^>]*>\s*/is', "\n", $html);
    $html = preg_replace('/\s*<link\b(?=[^>]*rel=["\']canonical["\'])[^>]*>\s*/is', "\n", $html);
    $html = preg_replace('/<\/head>/i', "    {$metaHtml}\n  </head>", $html, 1);

    if ($fallbackHtml !== '') {
        $html = preg_replace('/<body([^>]*)>/i', '<body$1><noscript>' . $fallbackHtml . '</noscript>', $html, 1);
    }

    echo $html;
    exit;
}

function post_share_page_fallback_html(
    string $title,
    string $description,
    string $canonicalUrl,
    string $imageUrl,
    string $imageAlt
): string {
    return '<main>'
        . '<a href="' . post_share_page_escape($canonicalUrl) . '">'
        . '<img src="' . post_share_page_escape($imageUrl) . '" width="2400" height="1260" alt="' . post_share_page_escape($imageAlt) . '" />'
        . '</a>'
        . '<h1>' . post_share_page_escape($title) . '</h1>'
        . '<p>' . post_share_page_escape($description) . '</p>'
        . '<p><a href="' . post_share_page_escape($canonicalUrl) . '">Open post on thia.lol</a></p>'
        . '</main>';
}

function post_share_page_https_url(string $url): string
{
    $url = trim($url);

    if (str_starts_with($url, '//')) {
        return 'https:' . $url;
    }

    return preg_replace('#^http://#i', 'https://', $url) ?? $url;
}

function post_share_page_escape(string $value): string
{
    return htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

function post_share_page_iso_date(string $value): string
{
    $timestamp = strtotime($value);

    if ($timestamp === false) {
        return $value;
    }

    return gmdate('c', $timestamp);
}

function post_share_page_card_version(array $post): string
{
    $basis = implode('|', [
        'mosaic-v3',
        (string) ($post['publicId'] ?? $post['id'] ?? ''),
        (string) ($post['updatedAt'] ?? ''),
        (string) ($post['mediaUrl'] ?? ''),
    ]);

    return substr(hash('sha256', $basis), 0, 16);
}
