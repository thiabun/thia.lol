<?php

declare(strict_types=1);

require_once __DIR__ . '/read.php';
require_once __DIR__ . '/notifications.php';
require_once __DIR__ . '/integrations.php';

const TEXT_ENTITY_LINK_CARD_LIMIT = 3;
const TEXT_ENTITY_URL_MAX_LENGTH = 1000;
const TEXT_ENTITY_CONTENT_TYPES = ['post', 'message', 'profile', 'profile_module'];
const TEXT_ENTITY_FIELD_MAX_LENGTH = 40;
const TEXT_ENTITY_HTTP_USER_AGENT = 'thia.lol link preview';
const TEXT_ENTITY_HTTP_MAX_BYTES = 131072;

function text_entities_table_exists(): bool
{
    try {
        return database_table_exists('text_entities');
    } catch (Throwable) {
        return false;
    }
}

function text_entities_for_content(string $contentType, int $contentId, string $fieldName): array
{
    if (!text_entities_table_exists()) {
        return [];
    }

    $statement = db_query(
        "SELECT
            e.id,
            e.entity_type,
            e.entity_start,
            e.entity_length,
            e.text_value,
            e.url,
            e.card_json,
            target_user.id AS target_user_id,
            target_user.handle AS target_handle,
            target_profile.display_name AS target_display_name,
            target_profile.avatar_url AS target_avatar_url
         FROM text_entities e
         LEFT JOIN users target_user ON target_user.id = e.target_user_id
         LEFT JOIN profiles target_profile ON target_profile.user_id = target_user.id
         WHERE e.content_type = :content_type
           AND e.content_id = :content_id
           AND e.field_name = :field_name
         ORDER BY e.entity_start ASC, e.id ASC",
        [
            'content_type' => $contentType,
            'content_id' => $contentId,
            'field_name' => $fieldName,
        ]
    );

    return array_values(array_filter(array_map('text_entity_payload', $statement->fetchAll())));
}

function text_entities_store_for_content(
    string $contentType,
    int $contentId,
    string $fieldName,
    string $text,
    int $actorUserId,
    array $options = []
): array {
    if (!text_entities_table_exists()) {
        return [];
    }

    text_entity_validate_content_type($contentType);
    text_entity_validate_field_name($fieldName);

    $previousMentionUserIds = text_entity_existing_mention_user_ids($contentType, $contentId, $fieldName);
    $entities = text_entities_parse($text);

    db_query(
        'DELETE FROM text_entities
         WHERE content_type = :content_type
           AND content_id = :content_id
           AND field_name = :field_name',
        [
            'content_type' => $contentType,
            'content_id' => $contentId,
            'field_name' => $fieldName,
        ]
    );

    foreach ($entities as $entity) {
        db_query(
            'INSERT INTO text_entities
                (content_type, content_id, field_name, entity_type, entity_start, entity_length, text_value, target_user_id, url, card_json)
             VALUES
                (:content_type, :content_id, :field_name, :entity_type, :entity_start, :entity_length, :text_value, :target_user_id, :url, :card_json)',
            [
                'content_type' => $contentType,
                'content_id' => $contentId,
                'field_name' => $fieldName,
                'entity_type' => $entity['type'],
                'entity_start' => $entity['start'],
                'entity_length' => $entity['length'],
                'text_value' => $entity['text'],
                'target_user_id' => $entity['targetUserId'] ?? null,
                'url' => $entity['url'] ?? null,
                'card_json' => isset($entity['card'])
                    ? json_encode($entity['card'], JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE)
                    : null,
            ]
        );
    }

    if (($options['notifyMentions'] ?? false) === true) {
        text_entities_notify_mentions(
            $entities,
            $previousMentionUserIds,
            $actorUserId,
            is_int($options['postId'] ?? null) ? (int) $options['postId'] : null,
            is_int($options['roomId'] ?? null) ? (int) $options['roomId'] : null,
            is_string($options['targetUrl'] ?? null) ? (string) $options['targetUrl'] : null
        );
    }

    return $entities;
}

function text_entities_delete_for_content(string $contentType, int $contentId, string $fieldName): void
{
    if (!text_entities_table_exists()) {
        return;
    }

    db_query(
        'DELETE FROM text_entities
         WHERE content_type = :content_type
           AND content_id = :content_id
           AND field_name = :field_name',
        [
            'content_type' => $contentType,
            'content_id' => $contentId,
            'field_name' => $fieldName,
        ]
    );
}

function text_entities_parse(string $text): array
{
    $linkMatches = text_entity_link_matches($text);
    $linkRanges = [];
    $links = [];
    $seenUrls = [];
    $cardCount = 0;

    foreach ($linkMatches as $match) {
        $url = text_entity_normalize_https_url($match['text']);

        if ($url === null) {
            continue;
        }

        $urlKey = strtolower($url);
        $isUniqueUrl = !isset($seenUrls[$urlKey]);

        if ($isUniqueUrl) {
            $seenUrls[$urlKey] = true;
        }

        $linkRanges[] = ['startByte' => $match['startByte'], 'endByte' => $match['endByte']];
        $card = null;

        if ($isUniqueUrl && $cardCount < TEXT_ENTITY_LINK_CARD_LIMIT) {
            $card = text_entity_card_for_url($url);
            $cardCount += 1;
        }

        $entity = [
            'type' => 'link',
            'start' => text_entity_utf16_offset($text, $match['startByte']),
            'length' => text_entity_utf16_length($match['text']),
            'text' => $match['text'],
            'url' => $url,
        ];

        if ($card !== null) {
            $entity['card'] = $card;
        }

        $links[] = $entity;
    }

    $mentions = text_entity_resolved_mentions($text, $linkRanges);
    $entities = array_merge($links, $mentions);
    usort($entities, static fn (array $a, array $b): int => $a['start'] <=> $b['start']);

    return $entities;
}

function text_entity_payload(array $row): ?array
{
    $type = (string) $row['entity_type'];
    $payload = [
        'type' => $type,
        'start' => (int) $row['entity_start'],
        'length' => (int) $row['entity_length'],
        'text' => (string) $row['text_value'],
    ];

    if ($type === 'mention') {
        if (($row['target_user_id'] ?? null) === null || ($row['target_handle'] ?? null) === null) {
            return null;
        }

        $payload['mention'] = [
            'handle' => (string) $row['target_handle'],
            'user' => user_payload([
                'user_id' => $row['target_user_id'],
                'handle' => $row['target_handle'],
                'display_name' => $row['target_display_name'] ?? $row['target_handle'],
                'avatar_url' => $row['target_avatar_url'] ?? null,
            ]),
        ];
    }

    if ($type === 'link') {
        if (!is_string($row['url'] ?? null)) {
            return null;
        }

        $payload['link'] = [
            'url' => (string) $row['url'],
        ];

        $card = text_entity_card_from_json($row['card_json'] ?? null);

        if ($card !== null) {
            $payload['link']['card'] = $card;
        }
    }

    return $payload;
}

function text_entity_existing_mention_user_ids(string $contentType, int $contentId, string $fieldName): array
{
    $statement = db_query(
        "SELECT DISTINCT target_user_id
         FROM text_entities
         WHERE content_type = :content_type
           AND content_id = :content_id
           AND field_name = :field_name
           AND entity_type = 'mention'
           AND target_user_id IS NOT NULL",
        [
            'content_type' => $contentType,
            'content_id' => $contentId,
            'field_name' => $fieldName,
        ]
    );

    $ids = [];

    foreach ($statement->fetchAll() as $row) {
        $ids[(int) $row['target_user_id']] = true;
    }

    return $ids;
}

function text_entities_notify_mentions(
    array $entities,
    array $previousMentionUserIds,
    int $actorUserId,
    ?int $postId,
    ?int $roomId,
    ?string $targetUrl
): void {
    $notified = [];

    foreach ($entities as $entity) {
        if (($entity['type'] ?? null) !== 'mention' || !isset($entity['targetUserId'])) {
            continue;
        }

        $targetUserId = (int) $entity['targetUserId'];

        if (
            $targetUserId === $actorUserId ||
            isset($notified[$targetUserId]) ||
            isset($previousMentionUserIds[$targetUserId]) ||
            text_entity_pair_blocked($actorUserId, $targetUserId)
        ) {
            continue;
        }

        $notified[$targetUserId] = true;
        notification_create(
            $targetUserId,
            $actorUserId,
            'mention',
            $postId,
            $roomId,
            [
                'targetUrl' => $targetUrl,
                'mentionedHandle' => $entity['mention']['handle'] ?? null,
            ],
            false
        );
    }
}

function text_entity_pair_blocked(int $firstUserId, int $secondUserId): bool
{
    if (!user_blocks_table_exists()) {
        return false;
    }

    $row = db_query(
        'SELECT EXISTS (
            SELECT 1
            FROM user_blocks
            WHERE (blocker_id = :first_user_id AND blocked_id = :second_user_id)
               OR (blocker_id = :second_user_id_again AND blocked_id = :first_user_id_again)
        ) AS blocked',
        [
            'first_user_id' => $firstUserId,
            'second_user_id' => $secondUserId,
            'second_user_id_again' => $secondUserId,
            'first_user_id_again' => $firstUserId,
        ]
    )->fetch();

    return is_array($row) && (bool) ($row['blocked'] ?? false);
}

function text_entity_link_matches(string $text): array
{
    $result = [];
    $seenRanges = [];

    preg_match_all('/\[[^\]\r\n]{1,200}\]\((https:\/\/[^\s<>"\')]+)\)/i', $text, $markdownMatches, PREG_OFFSET_CAPTURE);

    foreach ($markdownMatches[1] ?? [] as $match) {
        text_entity_add_link_match($result, $seenRanges, (string) $match[0], (int) $match[1]);
    }

    preg_match_all('#https://[^\s<>"\']+#i', $text, $matches, PREG_OFFSET_CAPTURE);

    foreach ($matches[0] ?? [] as $match) {
        text_entity_add_link_match($result, $seenRanges, (string) $match[0], (int) $match[1]);
    }

    usort($result, static fn (array $a, array $b): int => $a['startByte'] <=> $b['startByte']);

    return $result;
}

function text_entity_add_link_match(array &$result, array &$seenRanges, string $raw, int $startByte): void
{
    $trimmed = text_entity_trim_url_token($raw);

    if ($trimmed === '') {
        return;
    }

    $endByte = $startByte + strlen($trimmed);
    $rangeKey = $startByte . ':' . $endByte;

    if (isset($seenRanges[$rangeKey])) {
        return;
    }

    $seenRanges[$rangeKey] = true;
    $result[] = [
        'text' => $trimmed,
        'startByte' => $startByte,
        'endByte' => $endByte,
    ];
}

function text_entity_trim_url_token(string $value): string
{
    $trimmed = rtrim($value, ".,!?;:");

    while ($trimmed !== '' && preg_match('/[)\]}]$/', $trimmed) === 1) {
        $last = substr($trimmed, -1);
        $open = match ($last) {
            ')' => '(',
            ']' => '[',
            '}' => '{',
            default => '',
        };

        if ($open !== '' && substr_count($trimmed, $open) >= substr_count($trimmed, $last)) {
            break;
        }

        $trimmed = substr($trimmed, 0, -1);
    }

    return $trimmed;
}

function text_entity_resolved_mentions(string $text, array $linkRanges): array
{
    preg_match_all('/(?<![A-Za-z0-9_])@([A-Za-z0-9][A-Za-z0-9_-]{1,38}[A-Za-z0-9])/', $text, $matches, PREG_OFFSET_CAPTURE);
    $candidates = [];

    foreach ($matches[0] ?? [] as $index => $match) {
        $mentionText = (string) $match[0];
        $startByte = (int) $match[1];
        $endByte = $startByte + strlen($mentionText);

        if (text_entity_range_overlaps($startByte, $endByte, $linkRanges)) {
            continue;
        }

        $handle = strtolower((string) ($matches[1][$index][0] ?? ''));

        if ($handle === '') {
            continue;
        }

        $candidates[] = [
            'handle' => $handle,
            'text' => $mentionText,
            'start' => text_entity_utf16_offset($text, $startByte),
            'length' => text_entity_utf16_length($mentionText),
        ];
    }

    if ($candidates === []) {
        return [];
    }

    $profiles = text_entity_profiles_for_handles(array_values(array_unique(array_column($candidates, 'handle'))));
    $result = [];
    $seenRanges = [];

    foreach ($candidates as $candidate) {
        $profile = $profiles[$candidate['handle']] ?? null;

        if ($profile === null) {
            continue;
        }

        $rangeKey = $candidate['start'] . ':' . $candidate['length'];

        if (isset($seenRanges[$rangeKey])) {
            continue;
        }

        $seenRanges[$rangeKey] = true;
        $result[] = [
            'type' => 'mention',
            'start' => $candidate['start'],
            'length' => $candidate['length'],
            'text' => $candidate['text'],
            'targetUserId' => (int) $profile['user']['id'],
            'mention' => [
                'handle' => (string) $profile['user']['handle'],
                'user' => $profile['user'],
            ],
        ];
    }

    return $result;
}

function text_entity_profiles_for_handles(array $handles): array
{
    $handles = array_values(array_filter($handles, static fn (string $handle): bool => preg_match('/^[a-z0-9_-]{3,40}$/', $handle) === 1));

    if ($handles === []) {
        return [];
    }

    $placeholders = [];
    $params = [];

    foreach ($handles as $index => $handle) {
        $key = 'handle_' . $index;
        $placeholders[] = ':' . $key;
        $params[$key] = $handle;
    }

    $statement = db_query(
        sprintf(
            "SELECT
                u.id AS user_id,
                u.handle,
                p.display_name,
                p.avatar_url
             FROM users u
             INNER JOIN profiles p ON p.user_id = u.id
             WHERE u.status = 'active'
               AND u.handle IN (%s)",
            implode(', ', $placeholders)
        ),
        $params
    );

    $profiles = [];

    foreach ($statement->fetchAll() as $row) {
        $user = user_payload($row);
        $profiles[(string) $user['handle']] = [
            'user' => $user,
        ];
    }

    return $profiles;
}

function text_entity_range_overlaps(int $startByte, int $endByte, array $ranges): bool
{
    foreach ($ranges as $range) {
        if ($startByte < (int) $range['endByte'] && $endByte > (int) $range['startByte']) {
            return true;
        }
    }

    return false;
}

function text_entity_card_for_url(string $url): ?array
{
    $providerCard = text_entity_provider_card_for_url($url);

    if ($providerCard !== null) {
        return $providerCard;
    }

    return text_entity_generic_card_for_url($url);
}

function text_entity_provider_card_for_url(string $url): ?array
{
    try {
        $card = profile_integrations_storage_exists()
            ? profile_integration_resolve_url($url, null, current_request_user_id())
            : profile_integration_generated_card($url);
    } catch (Throwable) {
        $card = profile_integration_generated_card($url);
    }

    if (!is_array($card)) {
        return null;
    }

    if (($card['provider'] ?? null) === 'github') {
        $card['embed'] = null;
    }

    return $card;
}

function text_entity_generic_card_for_url(string $url): array
{
    $fallback = text_entity_fallback_card($url);

    if (!text_entity_url_is_safe_for_fetch($url) || !function_exists('curl_init')) {
        return $fallback;
    }

    $html = text_entity_fetch_html($url);

    if ($html === null) {
        return $fallback;
    }

    $metadata = text_entity_html_metadata($html, $url);

    return array_merge($fallback, [
        'metadata' => array_merge($fallback['metadata'], $metadata),
        'apiBacked' => true,
        'fetchedAt' => gmdate('c'),
    ]);
}

function text_entity_fallback_card(string $url): array
{
    $host = (string) (parse_url($url, PHP_URL_HOST) ?: $url);

    return [
        'provider' => 'website',
        'resourceType' => 'url',
        'resourceId' => hash('sha256', $url),
        'resourceKey' => 'website:url:' . hash('sha256', $url),
        'sourceUrl' => $url,
        'metadata' => [
            'title' => $host,
            'subtitle' => $host,
            'description' => null,
            'imageUrl' => null,
            'live' => false,
            'stats' => [],
        ],
        'embed' => null,
        'apiBacked' => false,
        'fetchedAt' => gmdate('c'),
        'expiresAt' => gmdate('c', time() + PROFILE_INTEGRATION_TTL_SECONDS),
        'staleAt' => gmdate('c', time() + PROFILE_INTEGRATION_STALE_SECONDS),
    ];
}

function text_entity_fetch_html(string $url): ?string
{
    $buffer = '';
    $curl = curl_init($url);

    if ($curl === false) {
        return null;
    }

    curl_setopt_array($curl, [
        CURLOPT_FOLLOWLOCATION => false,
        CURLOPT_RETURNTRANSFER => false,
        CURLOPT_TIMEOUT => 5,
        CURLOPT_CONNECTTIMEOUT => 3,
        CURLOPT_HTTPHEADER => [
            'Accept: text/html,application/xhtml+xml',
            'User-Agent: ' . TEXT_ENTITY_HTTP_USER_AGENT,
        ],
        CURLOPT_WRITEFUNCTION => static function ($curlHandle, string $chunk) use (&$buffer): int {
            $remaining = TEXT_ENTITY_HTTP_MAX_BYTES - strlen($buffer);

            if ($remaining <= 0) {
                return 0;
            }

            $buffer .= substr($chunk, 0, $remaining);

            return strlen($chunk);
        },
    ]);

    $ok = curl_exec($curl);
    $status = (int) curl_getinfo($curl, CURLINFO_RESPONSE_CODE);
    $contentType = strtolower((string) curl_getinfo($curl, CURLINFO_CONTENT_TYPE));

    if ($ok === false || $status < 200 || $status >= 300 || !str_contains($contentType, 'text/html')) {
        return null;
    }

    return $buffer === '' ? null : $buffer;
}

function text_entity_html_metadata(string $html, string $url): array
{
    $title = text_entity_html_title($html);
    $metadata = [
        'title' => text_entity_html_meta($html, ['og:title', 'twitter:title']) ?? $title,
        'subtitle' => (string) (parse_url($url, PHP_URL_HOST) ?: 'Website'),
        'description' => text_entity_html_meta($html, ['og:description', 'twitter:description', 'description']),
        'imageUrl' => text_entity_normalize_card_image_url(
            text_entity_html_meta($html, ['og:image', 'twitter:image']),
            $url
        ),
        'live' => false,
        'stats' => [],
    ];

    if (!is_string($metadata['title']) || trim($metadata['title']) === '') {
        $metadata['title'] = $metadata['subtitle'];
    }

    return $metadata;
}

function text_entity_html_title(string $html): ?string
{
    if (preg_match('/<title[^>]*>(.*?)<\/title>/is', $html, $match) !== 1) {
        return null;
    }

    return text_entity_clean_meta_text($match[1]);
}

function text_entity_html_meta(string $html, array $names): ?string
{
    foreach ($names as $name) {
        $quoted = preg_quote($name, '/');

        if (
            preg_match('/<meta\b[^>]*(?:property|name)=["\']' . $quoted . '["\'][^>]*content=["\']([^"\']+)["\'][^>]*>/is', $html, $match) === 1 ||
            preg_match('/<meta\b[^>]*content=["\']([^"\']+)["\'][^>]*(?:property|name)=["\']' . $quoted . '["\'][^>]*>/is', $html, $match) === 1
        ) {
            return text_entity_clean_meta_text($match[1]);
        }
    }

    return null;
}

function text_entity_clean_meta_text(?string $value): ?string
{
    if ($value === null) {
        return null;
    }

    $decoded = trim(html_entity_decode(strip_tags($value), ENT_QUOTES | ENT_HTML5, 'UTF-8'));

    if ($decoded === '') {
        return null;
    }

    return text_entity_substr(preg_replace('/\s+/', ' ', $decoded) ?? $decoded, 0, 240);
}

function text_entity_normalize_card_image_url(?string $value, string $baseUrl): ?string
{
    if ($value === null || trim($value) === '') {
        return null;
    }

    $candidate = trim($value);

    if (str_starts_with($candidate, '//')) {
        $candidate = 'https:' . $candidate;
    } elseif (str_starts_with($candidate, '/')) {
        $parts = parse_url($baseUrl);
        $candidate = 'https://' . strtolower((string) ($parts['host'] ?? '')) . $candidate;
    }

    $url = text_entity_normalize_https_url($candidate);

    if ($url === null || preg_match('/\.svg(?:[?#]|$)/i', (string) parse_url($url, PHP_URL_PATH)) === 1) {
        return null;
    }

    return $url;
}

function text_entity_normalize_https_url(string $value): ?string
{
    $trimmed = trim($value);

    if (
        $trimmed === '' ||
        strlen($trimmed) > TEXT_ENTITY_URL_MAX_LENGTH ||
        filter_var($trimmed, FILTER_VALIDATE_URL) === false
    ) {
        return null;
    }

    $parts = parse_url($trimmed);

    if (
        !is_array($parts) ||
        strtolower((string) ($parts['scheme'] ?? '')) !== 'https' ||
        !isset($parts['host']) ||
        isset($parts['user']) ||
        isset($parts['pass'])
    ) {
        return null;
    }

    $url = 'https://' . strtolower((string) $parts['host']);

    if (isset($parts['port'])) {
        $url .= ':' . (int) $parts['port'];
    }

    $url .= $parts['path'] ?? '/';

    if (isset($parts['query']) && $parts['query'] !== '') {
        $url .= '?' . $parts['query'];
    }

    if (isset($parts['fragment']) && $parts['fragment'] !== '') {
        $url .= '#' . $parts['fragment'];
    }

    return $url;
}

function text_entity_url_is_safe_for_fetch(string $url): bool
{
    $host = strtolower((string) parse_url($url, PHP_URL_HOST));

    if ($host === '' || $host === 'localhost' || str_ends_with($host, '.local')) {
        return false;
    }

    if (text_entity_host_is_private_ip($host)) {
        return false;
    }

    $addresses = gethostbynamel($host);

    if ($addresses === false || $addresses === []) {
        return false;
    }

    foreach ($addresses as $address) {
        if (text_entity_host_is_private_ip($address)) {
            return false;
        }
    }

    if (function_exists('dns_get_record')) {
        foreach (dns_get_record($host, DNS_AAAA) ?: [] as $record) {
            if (
                isset($record['ipv6']) &&
                is_string($record['ipv6']) &&
                text_entity_host_is_private_ip($record['ipv6'])
            ) {
                return false;
            }
        }
    }

    return true;
}

function text_entity_host_is_private_ip(string $host): bool
{
    if (filter_var($host, FILTER_VALIDATE_IP) === false) {
        return false;
    }

    return filter_var(
        $host,
        FILTER_VALIDATE_IP,
        FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE
    ) === false;
}

function text_entity_card_from_json(mixed $value): ?array
{
    if (!is_string($value) || trim($value) === '') {
        return null;
    }

    try {
        $decoded = json_decode($value, true, 512, JSON_THROW_ON_ERROR);
    } catch (JsonException) {
        return null;
    }

    return is_array($decoded) ? $decoded : null;
}

function text_entity_utf16_offset(string $text, int $byteOffset): int
{
    return text_entity_utf16_length(substr($text, 0, $byteOffset));
}

function text_entity_utf16_length(string $value): int
{
    if (!function_exists('mb_convert_encoding') || !preg_match('//u', $value)) {
        return strlen($value);
    }

    preg_match_all('/./us', $value, $matches);
    $length = 0;

    foreach ($matches[0] ?? [] as $char) {
        $encoded = mb_convert_encoding($char, 'UCS-4BE', 'UTF-8');
        $codepoint = unpack('N', $encoded)[1] ?? 0;
        $length += $codepoint > 0xFFFF ? 2 : 1;
    }

    return $length;
}

function text_entity_substr(string $value, int $start, int $length): string
{
    if (function_exists('mb_substr')) {
        return mb_substr($value, $start, $length);
    }

    return substr($value, $start, $length);
}

function text_entity_validate_content_type(string $value): void
{
    if (!in_array($value, TEXT_ENTITY_CONTENT_TYPES, true)) {
        throw new InvalidArgumentException('Unsupported text entity content type.');
    }
}

function text_entity_validate_field_name(string $value): void
{
    if ($value === '' || strlen($value) > TEXT_ENTITY_FIELD_MAX_LENGTH || preg_match('/^[a-zA-Z0-9_]+$/', $value) !== 1) {
        throw new InvalidArgumentException('Unsupported text entity field name.');
    }
}
