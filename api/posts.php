<?php

declare(strict_types=1);

require_once __DIR__ . '/auth.php';
require_once __DIR__ . '/notifications.php';
require_once __DIR__ . '/read.php';
require_once __DIR__ . '/text_entities.php';
require_once __DIR__ . '/chat.php';

function posts_dispatch(array $segments, string $method): void
{
    if (count($segments) === 1 && $method === 'POST') {
        posts_create();
    }

    if (count($segments) === 3 && preg_match('/^\d+$/', $segments[1]) === 1 && $segments[2] === 'replies') {
        if ($method === 'GET') {
            posts_replies_index((int) $segments[1]);
        }

        if ($method === 'POST') {
            posts_reply_create((int) $segments[1]);
        }

        json_error('Method not allowed.', 405);
    }

    if (count($segments) === 3 && preg_match('/^\d+$/', $segments[1]) === 1 && $segments[2] === 'like') {
        if ($method === 'POST') {
            posts_like_create((int) $segments[1]);
        }

        if ($method === 'DELETE') {
            posts_like_delete((int) $segments[1]);
        }

        json_error('Method not allowed.', 405);
    }

    if (count($segments) === 3 && preg_match('/^\d+$/', $segments[1]) === 1 && $segments[2] === 'reblog') {
        if ($method === 'POST') {
            posts_reblog_create((int) $segments[1]);
        }

        if ($method === 'DELETE') {
            posts_reblog_delete((int) $segments[1]);
        }

        json_error('Method not allowed.', 405);
    }

    if (count($segments) === 3 && preg_match('/^\d+$/', $segments[1]) === 1 && $segments[2] === 'reactions') {
        if ($method === 'POST') {
            posts_reaction_create((int) $segments[1]);
        }

        json_error('Method not allowed.', 405);
    }

    if (count($segments) === 4 && preg_match('/^\d+$/', $segments[1]) === 1 && $segments[2] === 'reactions') {
        if ($method === 'DELETE') {
            posts_reaction_delete((int) $segments[1], $segments[3]);
        }

        json_error('Method not allowed.', 405);
    }

    if (count($segments) === 3 && post_route_identifier_is_valid($segments[1]) && $segments[2] === 'share-card.png') {
        if ($method === 'GET' || $method === 'HEAD') {
            posts_share_card($segments[1]);
        }

        json_error('Method not allowed.', 405);
    }

    if (count($segments) === 3 && post_route_identifier_is_valid($segments[1]) && $segments[2] === 'share-card-cache') {
        if ($method === 'POST') {
            posts_share_card_cache_create($segments[1]);
        }

        json_error('Method not allowed.', 405);
    }

    if (
        count($segments) === 4 &&
        post_route_identifier_is_valid($segments[1]) &&
        $segments[2] === 'shares' &&
        $segments[3] === 'messages'
    ) {
        if ($method === 'POST') {
            posts_share_messages_create($segments[1]);
        }

        json_error('Method not allowed.', 405);
    }

    if (count($segments) === 2 && post_route_identifier_is_valid($segments[1])) {
        if ($method === 'GET' || $method === 'HEAD') {
            posts_show($segments[1]);
        }

        if (preg_match('/^\d+$/', $segments[1]) === 1 && $method === 'PATCH') {
            posts_update((int) $segments[1]);
        }

        if (preg_match('/^\d+$/', $segments[1]) === 1 && $method === 'DELETE') {
            posts_delete((int) $segments[1]);
        }
    }

    if (in_array($method, ['POST', 'PATCH', 'DELETE'], true)) {
        json_error('Method not allowed.', 405);
    }
}

function posts_show(string $postIdentifier): void
{
    $post = fetch_public_post_payload_by_identifier($postIdentifier, current_request_user_id());
    $post['canonicalPath'] = post_canonical_path($post);
    $post['canonicalUrl'] = post_canonical_url($post);

    json_success($post);
}

function posts_create(): void
{
    $session = require_authenticated_session();
    require_csrf_token($session);

    $body = request_json_body();
    $postBody = validate_post_body($body['body'] ?? null);
    $roomId = resolve_room_id($body);
    $parentId = resolve_parent_id($body['parentId'] ?? $body['parent_id'] ?? null);
    $mood = validate_optional_text($body['mood'] ?? null, 80, 'Mood');
    $mediaUrl = validate_post_media_url($body['mediaUrl'] ?? $body['media_url'] ?? null);

    $params = [
        'author_id' => (int) $session['user_id'],
        'room_id' => $roomId,
        'parent_id' => $parentId,
        'body' => $postBody,
        'mood' => $mood ?? 'sunveil',
        'media_url' => $mediaUrl,
        'visibility' => 'public',
        'status' => 'published',
    ];

    if (posts_public_id_column_exists()) {
        $params['public_id'] = posts_generate_public_id();
        db_query(
            'INSERT INTO posts (public_id, author_id, room_id, parent_id, body, mood, media_url, visibility, status)
             VALUES (:public_id, :author_id, :room_id, :parent_id, :body, :mood, :media_url, :visibility, :status)',
            $params
        );
    } else {
        db_query(
            'INSERT INTO posts (author_id, room_id, parent_id, body, mood, media_url, visibility, status)
             VALUES (:author_id, :room_id, :parent_id, :body, :mood, :media_url, :visibility, :status)',
            $params
        );
    }

    $postId = (int) db()->lastInsertId();
    text_entities_store_for_content('post', $postId, 'body', $postBody, (int) $session['user_id'], [
        'notifyMentions' => true,
        'postId' => $postId,
        'roomId' => $roomId,
    ]);

    json_success(fetch_post_payload_by_id($postId, (int) $session['user_id']), 201);
}

function posts_replies_index(int $postId): void
{
    require_reactable_post($postId);

    $statement = db_query(
        post_payload_select_sql(
            "p.parent_id = :parent_id
             AND p.visibility = 'public'
             AND p.status = 'published'
             AND p.deleted_at IS NULL
             AND (p.room_id IS NULL OR (r.visibility = 'public' " . room_not_deleted_sql('r') . "))",
            'ORDER BY p.created_at ASC, p.id ASC LIMIT 100'
        ),
        [
            'parent_id' => $postId,
            'current_user_id' => current_request_user_id(),
        ]
    );

    json_success(array_map('post_payload', $statement->fetchAll()));
}

function posts_reply_create(int $postId): void
{
    $session = require_authenticated_session();
    require_csrf_token($session);

    $parent = fetch_replyable_post_record($postId);

    if ($parent === null) {
        json_error('Post not found.', 404);
    }

    $body = request_json_body();
    $postBody = validate_post_body($body['body'] ?? null);
    $mediaUrl = validate_post_media_url($body['mediaUrl'] ?? $body['media_url'] ?? null);

    $params = [
        'author_id' => (int) $session['user_id'],
        'room_id' => $parent['room_id'] === null ? null : (int) $parent['room_id'],
        'parent_id' => $postId,
        'body' => $postBody,
        'mood' => $parent['mood'] ?? 'sunveil',
        'media_url' => $mediaUrl,
        'visibility' => 'public',
        'status' => 'published',
    ];

    if (posts_public_id_column_exists()) {
        $params['public_id'] = posts_generate_public_id();
        db_query(
            'INSERT INTO posts (public_id, author_id, room_id, parent_id, body, mood, media_url, visibility, status)
             VALUES (:public_id, :author_id, :room_id, :parent_id, :body, :mood, :media_url, :visibility, :status)',
            $params
        );
    } else {
        db_query(
            'INSERT INTO posts (author_id, room_id, parent_id, body, mood, media_url, visibility, status)
             VALUES (:author_id, :room_id, :parent_id, :body, :mood, :media_url, :visibility, :status)',
            $params
        );
    }

    $replyId = (int) db()->lastInsertId();
    text_entities_store_for_content('post', $replyId, 'body', $postBody, (int) $session['user_id'], [
        'notifyMentions' => true,
        'postId' => $replyId,
        'roomId' => $parent['room_id'] === null ? null : (int) $parent['room_id'],
    ]);
    $parentAuthorId = (int) $parent['author_id'];
    $actorId = (int) $session['user_id'];

    if ($parentAuthorId !== $actorId) {
        notification_create(
            $parentAuthorId,
            $actorId,
            'reply',
            $postId,
            $parent['room_id'] === null ? null : (int) $parent['room_id'],
            ['replyId' => $replyId],
            false
        );
    }

    json_success(fetch_post_payload_by_id($replyId, (int) $session['user_id']), 201);
}

function posts_update(int $postId): void
{
    $session = require_authenticated_session();
    require_csrf_token($session);

    $post = fetch_post_record($postId);

    if ($post === null) {
        json_error('Post not found.', 404);
    }

    $body = request_json_body();
    $updates = [];
    $params = ['id' => $postId];
    $isModerator = is_moderator_session($session);
    $isAuthor = (int) $post['author_id'] === (int) $session['user_id'];
    $updatedPostBody = null;

    if (array_key_exists('body', $body)) {
        if (!$isAuthor) {
            json_error('Only the author can edit this post.', 403);
        }

        if ((string) $post['status'] === 'removed') {
            json_error('Removed posts cannot be edited.', 409);
        }

        $updates[] = 'body = :body';
        $updatedPostBody = validate_post_body($body['body']);
        $params['body'] = $updatedPostBody;
    }

    if (array_key_exists('roomSlug', $body) || array_key_exists('roomId', $body) || array_key_exists('room_id', $body)) {
        if (!$isAuthor) {
            json_error('Only the author can move this post.', 403);
        }

        $updates[] = 'room_id = :room_id';
        $params['room_id'] = resolve_room_id($body);
    }

    if (array_key_exists('parentId', $body) || array_key_exists('parent_id', $body)) {
        if (!$isAuthor) {
            json_error('Only the author can update the parent post.', 403);
        }

        $parentId = resolve_parent_id($body['parentId'] ?? $body['parent_id']);

        if ($parentId === $postId) {
            json_error('A post cannot be its own parent.', 422);
        }

        $updates[] = 'parent_id = :parent_id';
        $params['parent_id'] = $parentId;
    }

    if (array_key_exists('mediaUrl', $body) || array_key_exists('media_url', $body)) {
        if (!$isAuthor) {
            json_error('Only the author can update this post image.', 403);
        }

        $updates[] = 'media_url = :media_url';
        $params['media_url'] = validate_post_media_url($body['mediaUrl'] ?? $body['media_url']);
    }

    if (array_key_exists('status', $body)) {
        if (!$isModerator) {
            json_error('Only moderators can change post status.', 403);
        }

        $status = validate_post_status($body['status']);

        if ($status === 'removed') {
            $updates[] = 'deleted_at = CURRENT_TIMESTAMP()';
        } elseif ((string) $post['status'] === 'removed') {
            $updates[] = 'deleted_at = NULL';
        }

        $updates[] = 'status = :status';
        $params['status'] = $status;
    }

    if ($updates === []) {
        json_error('No supported post updates were provided.', 422);
    }

    if (!$isAuthor && !$isModerator) {
        json_error('You cannot update this post.', 403);
    }

    $sql = sprintf(
        'UPDATE posts SET %s, updated_at = CURRENT_TIMESTAMP() WHERE id = :id',
        implode(', ', $updates)
    );
    db_query($sql, $params);

    if ($updatedPostBody !== null) {
        text_entities_store_for_content('post', $postId, 'body', $updatedPostBody, (int) $session['user_id'], [
            'notifyMentions' => true,
            'postId' => $postId,
            'roomId' => $post['room_id'] === null ? null : (int) $post['room_id'],
        ]);
    }

    json_success(fetch_post_payload_by_id($postId, (int) $session['user_id']));
}

function posts_delete(int $postId): void
{
    $session = require_authenticated_session();
    require_csrf_token($session);

    $post = fetch_post_record($postId);

    if ($post === null) {
        json_error('Post not found.', 404);
    }

    $isAuthor = (int) $post['author_id'] === (int) $session['user_id'];

    if (!$isAuthor && !is_moderator_session($session)) {
        json_error('You cannot delete this post.', 403);
    }

    db_query(
        "UPDATE posts
         SET status = 'removed',
             deleted_at = CURRENT_TIMESTAMP(),
             updated_at = CURRENT_TIMESTAMP()
         WHERE id = :id",
        ['id' => $postId]
    );
    $statement = db_query(
        'SELECT deleted_at
         FROM posts
         WHERE id = :id
         LIMIT 1',
        ['id' => $postId]
    );
    $deletedPost = $statement->fetch();

    json_success([
        'id' => $postId,
        'status' => 'removed',
        'deletedAt' => is_array($deletedPost) ? $deletedPost['deleted_at'] : null,
    ]);
}

function posts_share_messages_create(string $postIdentifier): void
{
    $session = require_authenticated_session();
    require_csrf_token($session);
    require_chat_tables();
    require_chat_follows_table();
    require_message_attachments_table();

    $senderUserId = (int) $session['user_id'];
    $post = fetch_public_post_payload_by_identifier($postIdentifier, $senderUserId);
    $postId = (int) $post['id'];
    $body = request_json_body();
    $recipientIds = validate_post_share_recipient_ids($body['recipientUserIds'] ?? null);
    $note = validate_post_share_note($body['note'] ?? null);
    $canonicalUrl = post_canonical_url($post);
    $messageBody = trim(($note === null ? 'Shared a post with you.' : $note) . "\n" . $canonicalUrl);
    $results = [];
    $successCount = 0;

    foreach ($recipientIds as $recipientUserId) {
        $recipient = post_share_fetch_recipient($recipientUserId);

        if ($recipient === null) {
            $results[] = post_share_result($recipientUserId, 'failed', 'Profile not found.');
            continue;
        }

        if ($recipientUserId === $senderUserId) {
            $results[] = post_share_result($recipientUserId, 'failed', 'Choose another member.');
            continue;
        }

        $blockState = chat_pair_block_state($senderUserId, $recipientUserId);

        if ($blockState['viewerBlocksTarget']) {
            $results[] = post_share_result($recipientUserId, 'failed', 'Unblock this member before messaging.');
            continue;
        }

        if ($blockState['targetBlocksViewer']) {
            $results[] = post_share_result($recipientUserId, 'failed', 'You cannot message this member.');
            continue;
        }

        if (!chat_users_are_moots($senderUserId, $recipientUserId)) {
            $results[] = post_share_result($recipientUserId, 'failed', 'Follow each other to chat.');
            continue;
        }

        $conversationId = chat_find_or_create_direct_conversation($senderUserId, $recipientUserId);
        $messageId = chat_insert_message($conversationId, $senderUserId, $messageBody, [
            [
                'type' => 'post',
                'postId' => $postId,
            ],
        ]);
        chat_notify_message($conversationId, $senderUserId, $messageId);
        $successCount++;

        $results[] = [
            'recipientUserId' => $recipientUserId,
            'recipient' => user_payload($recipient),
            'status' => 'sent',
            'conversationId' => $conversationId,
            'messageId' => $messageId,
        ];
    }

    json_success([
        'post' => post_share_summary_payload($post),
        'results' => $results,
        'sentCount' => $successCount,
        'failedCount' => count($results) - $successCount,
    ], 201);
}

function validate_post_share_recipient_ids(mixed $value): array
{
    if (!is_array($value)) {
        json_error('Choose at least one moot to share with.', 422);
    }

    $ids = [];

    foreach ($value as $rawId) {
        if (!is_int($rawId) && !(is_string($rawId) && preg_match('/^\d+$/', $rawId) === 1)) {
            json_error('Recipient ids must be numeric.', 422);
        }

        $id = (int) $rawId;

        if ($id <= 0) {
            json_error('Recipient ids must be numeric.', 422);
        }

        $ids[$id] = $id;
    }

    $recipientIds = array_values($ids);

    if ($recipientIds === []) {
        json_error('Choose at least one moot to share with.', 422);
    }

    if (count($recipientIds) > 10) {
        json_error('Share with up to 10 moots at once.', 422);
    }

    return $recipientIds;
}

function validate_post_share_note(mixed $value): ?string
{
    if ($value === null || $value === '') {
        return null;
    }

    if (!is_string($value)) {
        json_error('Share note must be text.', 422);
    }

    $note = trim($value);

    if ($note === '') {
        return null;
    }

    if (text_length($note) > 500) {
        json_error('Share note must be 500 characters or fewer.', 422);
    }

    return $note;
}

function post_share_fetch_recipient(int $recipientUserId): ?array
{
    $statement = db_query(
        "SELECT
            u.id AS user_id,
            u.handle,
            p.display_name,
            p.avatar_url
         FROM users u
         INNER JOIN profiles p ON p.user_id = u.id
         WHERE u.id = :user_id
           AND u.status = 'active'
         LIMIT 1",
        ['user_id' => $recipientUserId]
    );
    $recipient = $statement->fetch();

    return is_array($recipient) ? $recipient : null;
}

function post_share_result(int $recipientUserId, string $status, string $error): array
{
    return [
        'recipientUserId' => $recipientUserId,
        'status' => $status,
        'error' => $error,
    ];
}

const SHARE_CARD_LOGICAL_WIDTH = 1200;
const SHARE_CARD_LOGICAL_HEIGHT = 630;
const SHARE_CARD_RENDER_SCALE = 2;
const SHARE_CARD_CACHE_RENDER_VERSION = 'mosaic-v6';
const SHARE_CARD_MAX_UPLOAD_BYTES = 33554432;

function posts_share_card_s(int|float $value): int
{
    return (int) round($value * SHARE_CARD_RENDER_SCALE);
}

function posts_share_card_width(): int
{
    return posts_share_card_s(SHARE_CARD_LOGICAL_WIDTH);
}

function posts_share_card_height(): int
{
    return posts_share_card_s(SHARE_CARD_LOGICAL_HEIGHT);
}

function posts_share_card(string $postIdentifier): void
{
    $post = fetch_public_post_payload_by_identifier($postIdentifier, current_request_user_id());
    $headOnly = $_SERVER['REQUEST_METHOD'] === 'HEAD';
    $cachedPath = share_card_cache_path('post', post_public_identifier($post));

    if ($cachedPath !== null && is_file($cachedPath)) {
        share_card_cached_png_response($cachedPath, $headOnly);
    }

    if (!extension_loaded('gd') || !function_exists('imagecreatetruecolor')) {
        posts_share_card_fallback($headOnly);
    }

    posts_share_card_png_headers();

    if ($headOnly) {
        exit;
    }

    $image = imagecreatetruecolor(posts_share_card_width(), posts_share_card_height());

    if (!$image) {
        posts_share_card_fallback(false);
    }

    imageantialias($image, true);
    imagealphablending($image, true);
    $theme = profile_share_card_theme_colors($post['profile']['profileThemeConfig'] ?? null);
    $bg = posts_share_card_color($image, $theme['canvas'], [13, 31, 41]);
    $panel = posts_share_card_color_alpha($image, $theme['surface'], [22, 51, 61], 14);
    $line = posts_share_card_color_alpha($image, $theme['lineStrong'], [65, 126, 146], 32);
    $text = posts_share_card_color($image, $theme['text'], [232, 247, 248]);
    $muted = posts_share_card_color($image, $theme['muted'], [158, 192, 202]);
    $accent = posts_share_card_color($image, $theme['accent'], [244, 140, 173]);
    $mediaUrl = is_string($post['mediaUrl'] ?? null) ? (string) $post['mediaUrl'] : null;
    $linkCard = posts_share_card_first_rich_link_card($post);
    $linkImageUrl = is_string($linkCard['imageUrl'] ?? null) ? (string) $linkCard['imageUrl'] : null;
    $previewImageUrl = ($mediaUrl !== null && $mediaUrl !== '') ? $mediaUrl : $linkImageUrl;
    $panelLeft = posts_share_card_s(44);
    $panelTop = posts_share_card_s(96);
    $panelWidth = posts_share_card_s(1112);
    $panelHeight = posts_share_card_s(490);

    posts_share_card_draw_background_wash(
        $image,
        $theme,
        ($previewImageUrl !== null && $previewImageUrl !== '')
            ? $previewImageUrl
            : (is_string($post['author']['avatarUrl'] ?? null) ? (string) $post['author']['avatarUrl'] : null)
    );
    posts_share_card_draw_lockup($image);
    posts_share_card_draw_soft_shadow($image, $panelLeft, $panelTop, $panelWidth, $panelHeight, posts_share_card_s(30));
    posts_share_card_draw_rounded_rect($image, $panelLeft, $panelTop, $panelWidth, $panelHeight, posts_share_card_s(30), $panel);
    posts_share_card_stroke_rounded_rect($image, $panelLeft, $panelTop, $panelWidth, $panelHeight, posts_share_card_s(30), $line, posts_share_card_s(1));

    $fonts = posts_share_card_font_paths();
    $hasThumbnail = false;
    $mediaX = posts_share_card_s(770);
    $mediaY = posts_share_card_s(130);
    $mediaW = posts_share_card_s(316);
    $mediaH = posts_share_card_s(408);
    if ($previewImageUrl !== null && $previewImageUrl !== '') {
        $hasThumbnail = posts_share_card_draw_cover_safe_image_rounded(
            $image,
            $previewImageUrl,
            $mediaX,
            $mediaY,
            $mediaW,
            $mediaH,
            posts_share_card_s(26)
        );
        if ($hasThumbnail) {
            posts_share_card_stroke_rounded_rect($image, $mediaX, $mediaY, $mediaW, $mediaH, posts_share_card_s(26), $line, posts_share_card_s(1));
        }
    } elseif ($linkCard !== null) {
        $hasThumbnail = posts_share_card_draw_link_preview_tile($image, $fonts, $linkCard, $mediaX, $mediaY, $mediaW, $mediaH, $text, $muted, $accent, $line);
    }

    if (!$hasThumbnail && $linkCard !== null) {
        $hasThumbnail = posts_share_card_draw_link_preview_tile($image, $fonts, $linkCard, $mediaX, $mediaY, $mediaW, $mediaH, $text, $muted, $accent, $line);
    }
    $left = posts_share_card_s(92);
    $top = posts_share_card_s(76);
    $bodyWidth = $hasThumbnail ? posts_share_card_s(620) : posts_share_card_s(940);
    $avatarDrawn = posts_share_card_draw_avatar($image, $post, $left, $top + posts_share_card_s(52), posts_share_card_s(72));
    $identityLeft = $avatarDrawn ? $left + posts_share_card_s(92) : $left;
    $author = (string) ($post['author']['displayName'] ?? $post['author']['handle'] ?? 'thia.lol');
    $handle = '@' . (string) ($post['author']['handle'] ?? 'profile');
    $snippet = post_body_snippet((string) ($post['body'] ?? ''), 250);
    $canonical = post_canonical_path($post);
    $commentCount = (int) ($post['commentCount'] ?? 0);
    $likeCount = (int) ($post['reactions']['glow'] ?? 0);
    $echoCount = (int) ($post['reactions']['echo'] ?? 0);

    posts_share_card_text($image, $fonts, posts_share_card_s(39), $identityLeft, $top + posts_share_card_s(92), $text, $author);
    posts_share_card_text($image, $fonts, posts_share_card_s(22), $identityLeft, $top + posts_share_card_s(132), $muted, $handle);
    posts_share_card_wrapped_text($image, $fonts, posts_share_card_s(29), $left, $top + posts_share_card_s(194), $text, $snippet, $bodyWidth, 4, posts_share_card_s(42));
    posts_share_card_draw_stat_pills(
        $image,
        $fonts,
        [
            [$commentCount, 'Replies'],
            [$likeCount, 'Likes'],
            [$echoCount, 'Reposts'],
        ],
        $left,
        posts_share_card_s(486),
        $text,
        $muted,
        $accent
    );
    posts_share_card_text($image, $fonts, posts_share_card_s(18), $left, posts_share_card_s(538), $muted, $canonical);

    imagepng($image);
    exit;
}

function profile_share_card(string $handle): void
{
    $headOnly = $_SERVER['REQUEST_METHOD'] === 'HEAD';
    $profileRow = fetch_profile_by_handle(normalize_handle($handle));

    if (
        $profileRow === null
        || !profile_public_account_available($profileRow, null)
        || !profile_viewer_can_view_row($profileRow, null)
        || !extension_loaded('gd')
        || !function_exists('imagecreatetruecolor')
    ) {
        posts_share_card_fallback($headOnly);
    }

    posts_share_card_png_headers();

    if ($headOnly) {
        exit;
    }

    $profile = profile_payload_with_featured(
        $profileRow,
        null,
        profile_social_context((int) $profileRow['user_id'], null),
        null
    );
    $cachedPath = share_card_cache_path('profile', (string) ($profile['user']['handle'] ?? $handle));

    if ($cachedPath !== null && is_file($cachedPath)) {
        share_card_cached_png_response($cachedPath, $headOnly);
    }

    $modules = profile_share_card_modules((int) $profileRow['user_id']);
    $image = imagecreatetruecolor(posts_share_card_width(), posts_share_card_height());

    if (!$image) {
        posts_share_card_fallback(false);
    }

    imageantialias($image, true);
    imagealphablending($image, true);
    $theme = profile_share_card_theme_colors($profile['profileThemeConfig'] ?? null);
    $panel = posts_share_card_color_alpha($image, $theme['surface'], [22, 51, 61], 14);
    $panelSoft = posts_share_card_color_alpha($image, $theme['surfaceStrong'], [26, 60, 72], 18);
    $panelStrong = posts_share_card_color_alpha($image, $theme['canvas'], [9, 25, 34], 28);
    $line = posts_share_card_color_alpha($image, $theme['lineStrong'], [65, 126, 146], 30);
    $text = posts_share_card_color($image, $theme['text'], [232, 247, 248]);
    $muted = posts_share_card_color($image, $theme['muted'], [158, 192, 202]);
    $accent = posts_share_card_color($image, $theme['accent'], [88, 226, 224]);
    $backgroundUrl = $profile['profileBackground']
        ?? $profile['profileBackgroundVideoPoster']
        ?? $profile['bannerUrl']
        ?? $profile['user']['avatarUrl']
        ?? null;
    $panelLeft = posts_share_card_s(44);
    $panelTop = posts_share_card_s(96);
    $panelWidth = posts_share_card_s(1112);
    $panelHeight = posts_share_card_s(490);

    posts_share_card_draw_background_wash(
        $image,
        $theme,
        is_string($backgroundUrl) && $backgroundUrl !== '' ? $backgroundUrl : null
    );
    posts_share_card_draw_lockup($image);
    posts_share_card_draw_soft_shadow($image, $panelLeft, $panelTop, $panelWidth, $panelHeight, posts_share_card_s(30));
    posts_share_card_draw_rounded_rect($image, $panelLeft, $panelTop, $panelWidth, $panelHeight, posts_share_card_s(30), $panel);
    if (is_string($backgroundUrl) && $backgroundUrl !== '') {
        posts_share_card_draw_cover_safe_image_rounded(
            $image,
            $backgroundUrl,
            $panelLeft,
            $panelTop,
            $panelWidth,
            $panelHeight,
            posts_share_card_s(30),
            posts_share_card_s(1)
        );
        posts_share_card_draw_rounded_rect($image, $panelLeft, $panelTop, $panelWidth, $panelHeight, posts_share_card_s(30), $panelStrong);
    }

    posts_share_card_draw_rounded_rect($image, $panelLeft, $panelTop, $panelWidth, $panelHeight, posts_share_card_s(30), $panelSoft);
    posts_share_card_stroke_rounded_rect($image, $panelLeft, $panelTop, $panelWidth, $panelHeight, posts_share_card_s(30), $line, posts_share_card_s(1));

    $fonts = posts_share_card_font_paths();
    $left = posts_share_card_s(92);
    $top = posts_share_card_s(136);
    $leftColumnWidth = posts_share_card_s(540);
    $bioY = posts_share_card_s(246);
    $statsY = posts_share_card_s(392);
    $canonicalY = posts_share_card_s(538);
    $avatarDrawn = posts_share_card_draw_avatar(
        $image,
        ['author' => ['avatarUrl' => $profile['user']['avatarUrl'] ?? null]],
        $left,
        $top,
        posts_share_card_s(88)
    );
    $identityLeft = $avatarDrawn ? $left + posts_share_card_s(112) : $left;
    $displayName = (string) ($profile['user']['displayName'] ?? $profile['user']['handle'] ?? 'thia.lol');
    $profileHandle = '@' . (string) ($profile['user']['handle'] ?? 'profile');
    $description = profile_share_description($profile);
    $canonical = profile_canonical_path($profile);

    posts_share_card_text($image, $fonts, posts_share_card_s(40), $identityLeft, $top + posts_share_card_s(42), $text, $displayName);
    posts_share_card_text($image, $fonts, posts_share_card_s(23), $identityLeft, $top + posts_share_card_s(82), $muted, $profileHandle);
    posts_share_card_wrapped_text($image, $fonts, posts_share_card_s(24), $left, $bioY, $text, $description, $leftColumnWidth, 3, posts_share_card_s(34));
    profile_share_card_draw_stats($image, $fonts, $profile, $left, $statsY, $text, $muted, $leftColumnWidth);

    foreach (profile_share_card_module_layouts($modules) as $entry) {
        $module = $entry['module'];
        try {
            profile_share_card_draw_module_preview(
                $image,
                $fonts,
                $module,
                posts_share_card_s((int) $entry['x']),
                posts_share_card_s((int) $entry['y']),
                posts_share_card_s((int) $entry['w']),
                posts_share_card_s((int) $entry['h']),
                $text,
                $muted,
                $accent,
                $line
            );
        } catch (Throwable) {
            continue;
        }
    }

    posts_share_card_text($image, $fonts, posts_share_card_s(18), $left, $canonicalY, $muted, $canonical);

    imagepng($image);
    exit;
}

function posts_share_card_cache_create(string $postIdentifier): void
{
    $session = require_authenticated_session();
    require_csrf_token($session);
    $post = fetch_public_post_payload_by_identifier($postIdentifier, (int) $session['user_id']);
    $authorId = (int) ($post['author']['id'] ?? 0);

    if ($authorId !== (int) $session['user_id']) {
        json_error('Only the post author can publish this share card preview.', 403);
    }

    $url = share_card_store_uploaded_png('post', post_public_identifier($post));

    json_success([
        'url' => $url,
        'width' => posts_share_card_width(),
        'height' => posts_share_card_height(),
    ], 201);
}

function profile_share_card_cache_create(string $handle): void
{
    $session = require_authenticated_session();
    require_csrf_token($session);
    $profileRow = fetch_profile_by_handle(normalize_handle($handle));

    if (
        $profileRow === null
        || !profile_public_account_available($profileRow, null)
        || !profile_viewer_can_view_row($profileRow, (int) $session['user_id'])
    ) {
        json_error('Profile not found.', 404);
    }

    if ((int) ($profileRow['user_id'] ?? 0) !== (int) $session['user_id']) {
        json_error('Only the profile owner can publish this share card preview.', 403);
    }

    $url = share_card_store_uploaded_png('profile', (string) ($profileRow['handle'] ?? $handle));

    json_success([
        'url' => $url,
        'width' => posts_share_card_width(),
        'height' => posts_share_card_height(),
    ], 201);
}

function share_card_store_uploaded_png(string $kind, string $key): string
{
    $contentLength = (int) ($_SERVER['CONTENT_LENGTH'] ?? 0);

    if ($contentLength > SHARE_CARD_MAX_UPLOAD_BYTES) {
        json_error('Share card image must be 32 MB or smaller.', 413);
    }

    $file = $_FILES['card'] ?? null;

    if (!is_array($file) || (int) ($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
        json_error('Share card image is required.', 422);
    }

    $tmpName = (string) ($file['tmp_name'] ?? '');
    $size = (int) ($file['size'] ?? 0);

    if ($tmpName === '' || $size <= 0 || $size > SHARE_CARD_MAX_UPLOAD_BYTES || !is_uploaded_file($tmpName)) {
        json_error('Share card image is invalid.', 422);
    }

    $imageSize = @getimagesize($tmpName);

    if (
        !is_array($imageSize)
        || (string) ($imageSize['mime'] ?? '') !== 'image/png'
        || (int) ($imageSize[0] ?? 0) !== posts_share_card_width()
        || (int) ($imageSize[1] ?? 0) !== posts_share_card_height()
    ) {
        json_error('Share card must be a 2400x1260 PNG.', 422);
    }

    $path = share_card_cache_path($kind, $key);

    if ($path === null) {
        json_error('Share card target is invalid.', 422);
    }

    share_card_ensure_cache_directory(dirname($path));
    $temporaryPath = $path . '.' . bin2hex(random_bytes(6)) . '.tmp';

    if (!move_uploaded_file($tmpName, $temporaryPath)) {
        json_error('Share card image could not be stored.', 500);
    }

    @chmod($temporaryPath, 0644);

    if (!@rename($temporaryPath, $path)) {
        @unlink($temporaryPath);
        json_error('Share card image could not be published.', 500);
    }

    return share_card_cache_url($kind, $key);
}

function share_card_cache_path(string $kind, string $key): ?string
{
    $safeKind = match ($kind) {
        'post' => 'posts',
        'profile' => 'profiles',
        default => null,
    };

    if ($safeKind === null) {
        return null;
    }

    $safeKey = share_card_cache_key($key);

    if ($safeKey === null) {
        return null;
    }

    return dirname(__DIR__) . "/uploads/share-cards/{$safeKind}/{$safeKey}.png";
}

function share_card_cache_url(string $kind, string $key): string
{
    $safeKind = $kind === 'profile' ? 'profiles' : 'posts';
    $safeKey = share_card_cache_key($key) ?? 'card';

    return "/uploads/share-cards/{$safeKind}/{$safeKey}.png";
}

function share_card_cache_key(string $key): ?string
{
    $normalized = strtolower(trim($key));

    if (preg_match('/^[a-z0-9_-]{1,80}$/', $normalized) !== 1) {
        return null;
    }

    return $normalized . '-' . SHARE_CARD_CACHE_RENDER_VERSION;
}

function share_card_ensure_cache_directory(string $path): void
{
    $uploadsRoot = dirname(__DIR__) . '/uploads';

    if (!is_dir($uploadsRoot) && !mkdir($uploadsRoot, 0755, true) && !is_dir($uploadsRoot)) {
        json_error('Share card storage is not writable.', 500);
    }

    $htaccess = $uploadsRoot . '/.htaccess';
    $htaccessContents = "Options -Indexes\nAddType image/png .png\nAddType image/webp .webp\nAddType video/mp4 .mp4\nAddType video/webm .webm\nAddType audio/mpeg .mp3\n<IfModule mod_headers.c>\n  <FilesMatch \"\\.(?:png|webp|mp4|webm|mp3)$\">\n    Header set Cache-Control \"public, max-age=604800\"\n  </FilesMatch>\n</IfModule>\n<FilesMatch \"\\.(?:php|phtml|phar|cgi|pl|py|sh|shtml|html?|svg)$\">\n  Require all denied\n</FilesMatch>\n";
    $currentHtaccess = is_file($htaccess) ? file_get_contents($htaccess) : false;

    if (!is_string($currentHtaccess) || !str_contains($currentHtaccess, 'AddType image/png .png')) {
        @file_put_contents($htaccess, $htaccessContents, LOCK_EX);
    }

    if (!is_dir($path) && !mkdir($path, 0755, true) && !is_dir($path)) {
        json_error('Share card storage is not writable.', 500);
    }
}

function share_card_cached_png_response(string $path, bool $headOnly = false): void
{
    posts_share_card_png_headers();
    header('Content-Length: ' . (string) filesize($path));

    if (!$headOnly) {
        readfile($path);
    }

    exit;
}

function share_card_image_proxy(): void
{
    $headOnly = $_SERVER['REQUEST_METHOD'] === 'HEAD';
    $rawUrl = (string) ($_GET['url'] ?? '');
    $url = trim($rawUrl);

    if ($url === '') {
        http_response_code(404);
        exit;
    }

    $localPath = posts_share_card_media_path($url);

    if ($localPath !== null) {
        $size = @getimagesize($localPath);
        $mime = is_array($size) ? (string) ($size['mime'] ?? '') : '';

        if (!in_array($mime, ['image/jpeg', 'image/png', 'image/webp', 'image/gif'], true)) {
            http_response_code(404);
            exit;
        }

        header_remove('Content-Type');
        header('Content-Type: ' . $mime);
        header('Cache-Control: public, max-age=604800, stale-while-revalidate=86400');
        header('X-Content-Type-Options: nosniff');
        header('Content-Length: ' . (string) filesize($localPath));

        if (!$headOnly) {
            readfile($localPath);
        }

        exit;
    }

    $body = posts_share_card_fetch_allowlisted_provider_image($url);

    if ($body === null) {
        http_response_code(404);
        exit;
    }

    $size = @getimagesizefromstring($body);
    $mime = is_array($size) ? (string) ($size['mime'] ?? '') : '';

    if (!in_array($mime, ['image/jpeg', 'image/png', 'image/webp', 'image/gif'], true)) {
        http_response_code(404);
        exit;
    }

    header_remove('Content-Type');
    header('Content-Type: ' . $mime);
    header('Cache-Control: public, max-age=604800, stale-while-revalidate=86400');
    header('X-Content-Type-Options: nosniff');
    header('Content-Length: ' . (string) strlen($body));

    if (!$headOnly) {
        echo $body;
    }

    exit;
}

function post_route_identifier_is_valid(string $identifier): bool
{
    return normalize_post_public_identifier($identifier) !== null;
}

function posts_generate_public_id(): string
{
    for ($attempt = 0; $attempt < 8; $attempt++) {
        $publicId = 'p' . bin2hex(random_bytes(6));
        $statement = db_query(
            'SELECT id FROM posts WHERE public_id = :public_id LIMIT 1',
            ['public_id' => $publicId]
        );

        if ($statement->fetch() === false) {
            return $publicId;
        }
    }

    json_error('Could not create a post id. Try again.', 503);
}

function posts_share_card_png_headers(): void
{
    header_remove('Content-Type');
    header('Content-Type: image/png');
    header('Cache-Control: public, max-age=3600, stale-while-revalidate=86400');
    header('Content-Disposition: inline');
    header('X-Content-Type-Options: nosniff');
}

function posts_share_card_draw_background_wash($image, array $theme, ?string $imageUrl): void
{
    $width = posts_share_card_width();
    $height = posts_share_card_height();
    $base = posts_share_card_color($image, $theme['canvas'], [13, 31, 41]);
    $surface = posts_share_card_color_alpha($image, $theme['surface'], [22, 51, 61], 40);
    $surfaceStrong = posts_share_card_color_alpha($image, $theme['surfaceStrong'], [26, 60, 72], 76);
    $accent = posts_share_card_color_alpha($image, $theme['accent'], [88, 226, 224], 104);

    imagefilledrectangle($image, 0, 0, $width, $height, $base);

    if (is_string($imageUrl) && $imageUrl !== '') {
        $source = posts_share_card_load_safe_image_source($imageUrl);

        if ($source instanceof GdImage) {
            $wash = imagecreatetruecolor($width, $height);
            if ($wash) {
                imagealphablending($wash, true);
                imagefilledrectangle($wash, 0, 0, $width, $height, $base);
                posts_share_card_draw_cover_source($wash, $source, 0, 0, $width, $height);
                for ($i = 0; $i < 5; $i++) {
                    @imagefilter($wash, IMG_FILTER_GAUSSIAN_BLUR);
                }
                imagecopymerge($image, $wash, 0, 0, 0, 0, $width, $height, 32);
            }
        }
    }

    imagefilledellipse($image, posts_share_card_s(320), posts_share_card_s(160), posts_share_card_s(560), posts_share_card_s(360), $surface);
    imagefilledellipse($image, posts_share_card_s(920), posts_share_card_s(490), posts_share_card_s(640), posts_share_card_s(360), $accent);
    posts_share_card_draw_vertical_fade($image, 0, 0, $width, $height, $theme['canvas'], [13, 31, 41], 56, 18);
    imagefilledrectangle($image, 0, posts_share_card_s(540), $width, $height, $surfaceStrong);
}

function posts_share_card_draw_vertical_fade(
    $image,
    int $x,
    int $y,
    int $width,
    int $height,
    string $hex,
    array $fallback,
    int $alphaTop,
    int $alphaBottom
): void {
    $step = max(2, posts_share_card_s(2));
    for ($row = 0; $row < $height; $row += $step) {
        $progress = $height <= 1 ? 1 : $row / max(1, $height - 1);
        $alpha = (int) round($alphaTop + (($alphaBottom - $alphaTop) * $progress));
        $color = posts_share_card_color_alpha($image, $hex, $fallback, $alpha);
        imagefilledrectangle($image, $x, $y + $row, $x + $width, min($y + $height, $y + $row + $step), $color);
    }
}

function posts_share_card_draw_soft_shadow($image, int $x, int $y, int $width, int $height, int $radius): void
{
    for ($i = 4; $i >= 1; $i--) {
        $offset = posts_share_card_s($i * 3);
        $alpha = 118 - ($i * 8);
        $color = imagecolorallocatealpha($image, 0, 0, 0, $alpha);
        posts_share_card_draw_rounded_rect(
            $image,
            $x - $offset,
            $y + $offset,
            $width + ($offset * 2),
            $height + ($offset * 2),
            $radius + $offset,
            $color
        );
    }
}

function posts_share_card_draw_rounded_rect($image, int $x, int $y, int $width, int $height, int $radius, int $color): void
{
    $radius = max(0, min($radius, intdiv(min($width, $height), 2)));

    if ($radius <= 0) {
        imagefilledrectangle($image, $x, $y, $x + $width, $y + $height, $color);
        return;
    }

    $radiusSquared = $radius * $radius;

    for ($row = 0; $row <= $height; $row++) {
        $inset = 0;

        if ($row < $radius) {
            $dy = $radius - $row;
            $inset = (int) ceil($radius - sqrt(max(0, $radiusSquared - ($dy * $dy))));
        } elseif ($row > $height - $radius) {
            $dy = $row - ($height - $radius);
            $inset = (int) ceil($radius - sqrt(max(0, $radiusSquared - ($dy * $dy))));
        }

        imagefilledrectangle($image, $x + $inset, $y + $row, $x + $width - $inset, $y + $row, $color);
    }
}

function posts_share_card_stroke_rounded_rect(
    $image,
    int $x,
    int $y,
    int $width,
    int $height,
    int $radius,
    int $color,
    int $thickness = 1
): void {
    $oldThickness = 1;
    $thickness = max(1, $thickness);
    imagesetthickness($image, $thickness);
    $radius = max(0, min($radius, intdiv(min($width, $height), 2)));

    if ($radius <= 0) {
        imagerectangle($image, $x, $y, $x + $width, $y + $height, $color);
        imagesetthickness($image, $oldThickness);
        return;
    }

    imageline($image, $x + $radius, $y, $x + $width - $radius, $y, $color);
    imageline($image, $x + $radius, $y + $height, $x + $width - $radius, $y + $height, $color);
    imageline($image, $x, $y + $radius, $x, $y + $height - $radius, $color);
    imageline($image, $x + $width, $y + $radius, $x + $width, $y + $height - $radius, $color);
    imagearc($image, $x + $radius, $y + $radius, $radius * 2, $radius * 2, 180, 270, $color);
    imagearc($image, $x + $width - $radius, $y + $radius, $radius * 2, $radius * 2, 270, 360, $color);
    imagearc($image, $x + $radius, $y + $height - $radius, $radius * 2, $radius * 2, 90, 180, $color);
    imagearc($image, $x + $width - $radius, $y + $height - $radius, $radius * 2, $radius * 2, 0, 90, $color);
    imagesetthickness($image, $oldThickness);
}

function posts_share_card_draw_cover_safe_image_rounded(
    $image,
    string $imageUrl,
    int $targetX,
    int $targetY,
    int $targetWidth,
    int $targetHeight,
    int $radius,
    int $inset = 0
): bool {
    $source = posts_share_card_load_safe_image_source($imageUrl);

    if (!$source) {
        return false;
    }

    posts_share_card_draw_cover_source_rounded(
        $image,
        $source,
        $targetX + $inset,
        $targetY + $inset,
        max(1, $targetWidth - ($inset * 2)),
        max(1, $targetHeight - ($inset * 2)),
        max(0, $radius - $inset)
    );

    return true;
}

function posts_share_card_draw_cover_source_rounded(
    $image,
    GdImage $source,
    int $targetX,
    int $targetY,
    int $targetWidth,
    int $targetHeight,
    int $radius
): void {
    $tile = imagecreatetruecolor($targetWidth, $targetHeight);

    if (!$tile) {
        posts_share_card_draw_cover_source($image, $source, $targetX, $targetY, $targetWidth, $targetHeight);
        return;
    }

    imagealphablending($tile, false);
    imagesavealpha($tile, true);
    $transparent = imagecolorallocatealpha($tile, 0, 0, 0, 127);
    imagefilledrectangle($tile, 0, 0, $targetWidth, $targetHeight, $transparent);
    imagealphablending($tile, true);
    posts_share_card_draw_cover_source($tile, $source, 0, 0, $targetWidth, $targetHeight);

    $radius = max(0, min($radius, intdiv(min($targetWidth, $targetHeight), 2)));
    if ($radius > 0) {
        $r2 = $radius * $radius;
        for ($py = 0; $py < $radius; $py++) {
            for ($px = 0; $px < $radius; $px++) {
                $dx = $radius - $px;
                $dy = $radius - $py;
                if (($dx * $dx) + ($dy * $dy) <= $r2) {
                    continue;
                }
                imagesetpixel($tile, $px, $py, $transparent);
                imagesetpixel($tile, $targetWidth - $px - 1, $py, $transparent);
                imagesetpixel($tile, $px, $targetHeight - $py - 1, $transparent);
                imagesetpixel($tile, $targetWidth - $px - 1, $targetHeight - $py - 1, $transparent);
            }
        }
    }

    imagecopy($image, $tile, $targetX, $targetY, 0, 0, $targetWidth, $targetHeight);
}

function posts_share_card_first_rich_link_card(array $post): ?array
{
    $entities = is_array($post['bodyEntities'] ?? null) ? $post['bodyEntities'] : [];

    foreach ($entities as $entity) {
        if (!is_array($entity) || ($entity['type'] ?? null) !== 'link') {
            continue;
        }

        $link = is_array($entity['link'] ?? null) ? $entity['link'] : [];
        $card = is_array($link['card'] ?? null) ? $link['card'] : null;
        $url = is_string($link['url'] ?? null) ? (string) $link['url'] : '';

        if ($card === null && $url === '') {
            continue;
        }

        $metadata = is_array($card['metadata'] ?? null) ? $card['metadata'] : [];
        return [
            'url' => $url !== '' ? $url : (string) ($card['sourceUrl'] ?? ''),
            'provider' => is_string($card['provider'] ?? null) ? (string) $card['provider'] : 'website',
            'title' => profile_share_card_first_string([
                $metadata['title'] ?? null,
                $metadata['subtitle'] ?? null,
                $url,
            ]),
            'subtitle' => profile_share_card_first_string([
                $metadata['subtitle'] ?? null,
                $card['provider'] ?? null,
            ]),
            'description' => profile_share_card_first_string([
                $metadata['description'] ?? null,
            ]),
            'imageUrl' => profile_share_card_first_string([
                $metadata['imageUrl'] ?? null,
                $metadata['image'] ?? null,
                $metadata['thumbnailUrl'] ?? null,
            ]),
        ];
    }

    return null;
}

function posts_share_card_draw_link_preview_tile(
    $image,
    array $fonts,
    array $card,
    int $x,
    int $y,
    int $width,
    int $height,
    int $text,
    int $muted,
    int $accent,
    int $line
): bool {
    $surface = imagecolorallocatealpha($image, 8, 24, 32, 20);
    posts_share_card_draw_rounded_rect($image, $x, $y, $width, $height, posts_share_card_s(26), $surface);
    posts_share_card_stroke_rounded_rect($image, $x, $y, $width, $height, posts_share_card_s(26), $line, posts_share_card_s(1));

    $imageUrl = is_string($card['imageUrl'] ?? null) ? (string) $card['imageUrl'] : '';
    if ($imageUrl !== '') {
        posts_share_card_draw_cover_safe_image_rounded($image, $imageUrl, $x + posts_share_card_s(18), $y + posts_share_card_s(18), $width - posts_share_card_s(36), posts_share_card_s(190), posts_share_card_s(18));
    }

    posts_share_card_text($image, $fonts, posts_share_card_s(13), $x + posts_share_card_s(22), $y + posts_share_card_s(244), $accent, strtoupper(profile_share_card_platform_label((string) ($card['provider'] ?? 'website'))));
    posts_share_card_wrapped_text($image, $fonts, posts_share_card_s(20), $x + posts_share_card_s(22), $y + posts_share_card_s(280), $text, (string) ($card['title'] ?? 'Link'), $width - posts_share_card_s(44), 2, posts_share_card_s(28));
    $description = trim((string) ($card['description'] ?? $card['url'] ?? ''));
    if ($description !== '') {
        posts_share_card_wrapped_text($image, $fonts, posts_share_card_s(12), $x + posts_share_card_s(22), $y + posts_share_card_s(350), $muted, $description, $width - posts_share_card_s(44), 2, posts_share_card_s(20));
    }

    return true;
}

function posts_share_card_draw_stat_pills($image, array $fonts, array $stats, int $x, int $y, int $text, int $muted, int $accent): void
{
    $cursor = $x;
    foreach ($stats as [$value, $label]) {
        $valueText = (string) max(0, (int) $value);
        $labelText = (string) $label;
        $pillTextWidth = posts_share_card_text_width($fonts, posts_share_card_s(14), $valueText)
            + posts_share_card_text_width($fonts, posts_share_card_s(13), $labelText)
            + posts_share_card_s(38);
        $pillHeight = posts_share_card_s(32);
        $surface = imagecolorallocatealpha($image, 4, 18, 27, 52);
        posts_share_card_draw_rounded_rect($image, $cursor, $y - posts_share_card_s(22), $pillTextWidth, $pillHeight, intdiv($pillHeight, 2), $surface);
        posts_share_card_text($image, $fonts, posts_share_card_s(14), $cursor + posts_share_card_s(15), $y, $text, $valueText);
        posts_share_card_text($image, $fonts, posts_share_card_s(13), $cursor + posts_share_card_s(15) + posts_share_card_text_width($fonts, posts_share_card_s(14), $valueText) + posts_share_card_s(8), $y, $muted, $labelText);
        $cursor += $pillTextWidth + posts_share_card_s(10);
    }
}

function profile_share_card_module_layouts(array $modules): array
{
    $modules = array_slice($modules, 0, 4);
    $count = count($modules);

    if ($count <= 0) {
        return [];
    }

    if ($count === 1) {
        return [[
            'module' => $modules[0],
            'x' => 690,
            'y' => 136,
            'w' => 412,
            'h' => 316,
        ]];
    }

    if ($count === 2) {
        return [
            ['module' => $modules[0], 'x' => 690, 'y' => 136, 'w' => 250, 'h' => 316],
            ['module' => $modules[1], 'x' => 956, 'y' => 136, 'w' => 146, 'h' => 316],
        ];
    }

    $visualIndex = profile_share_card_best_visual_module_index($modules);
    if ($visualIndex > 0) {
        $visual = $modules[$visualIndex];
        array_splice($modules, $visualIndex, 1);
        array_unshift($modules, $visual);
    }

    $layouts = [
        ['module' => $modules[0], 'x' => 690, 'y' => 136, 'w' => 198, 'h' => 316],
        ['module' => $modules[1], 'x' => 904, 'y' => 136, 'w' => 198, 'h' => 150],
        ['module' => $modules[2], 'x' => 904, 'y' => 302, 'w' => 198, 'h' => 150],
    ];

    if (isset($modules[3])) {
        $layouts[] = ['module' => $modules[3], 'x' => 690, 'y' => 468, 'w' => 412, 'h' => 72];
    }

    return $layouts;
}

function profile_share_card_best_visual_module_index(array $modules): int
{
    foreach ($modules as $index => $module) {
        if (!is_array($module)) {
            continue;
        }

        $kind = (string) ($module['kind'] ?? '');
        if (in_array($kind, ['image', 'image_grid', 'slideshow', 'music', 'video', 'stream'], true) && is_string($module['imageUrl'] ?? null) && $module['imageUrl'] !== '') {
            return (int) $index;
        }
    }

    return 0;
}

function profile_share_card_theme_colors(mixed $config): array
{
    $fallback = [
        'canvas' => '#0D1F29',
        'surface' => '#16333D',
        'surfaceStrong' => '#1A3C48',
        'text' => '#E8F7F8',
        'muted' => '#9EC0CA',
        'lineStrong' => '#417E92',
        'accent' => '#58E2E0',
    ];

    if (!is_array($config)) {
        return $fallback;
    }

    if (($config['mode'] ?? null) === 'custom' && isset($config['colors']) && is_array($config['colors'])) {
        return [
            'canvas' => profile_share_card_hex_color($config['colors']['canvas'] ?? null, $fallback['canvas']),
            'surface' => profile_share_card_hex_color($config['colors']['surface'] ?? null, $fallback['surface']),
            'surfaceStrong' => profile_share_card_hex_color($config['colors']['surfaceStrong'] ?? null, $fallback['surfaceStrong']),
            'text' => profile_share_card_hex_color($config['colors']['text'] ?? null, $fallback['text']),
            'muted' => profile_share_card_hex_color($config['colors']['muted'] ?? null, $fallback['muted']),
            'lineStrong' => profile_share_card_hex_color($config['colors']['lineStrong'] ?? null, $fallback['lineStrong']),
            'accent' => profile_share_card_hex_color($config['colors']['accent'] ?? null, $fallback['accent']),
        ];
    }

    $preset = is_string($config['preset'] ?? null) ? (string) $config['preset'] : 'frostveil';
    $presets = [
        'sunveil' => [
            'canvas' => '#FFF6D8',
            'surface' => '#FFFDF2',
            'surfaceStrong' => '#F0E0B5',
            'text' => '#3F3324',
            'muted' => '#77694E',
            'lineStrong' => '#CDBB83',
            'accent' => '#E5B843',
        ],
        'roseveil' => [
            'canvas' => '#22151D',
            'surface' => '#3A202C',
            'surfaceStrong' => '#51283A',
            'text' => '#FFEAF1',
            'muted' => '#E7A8B9',
            'lineStrong' => '#B85C79',
            'accent' => '#F48CA2',
        ],
        'leafveil' => [
            'canvas' => '#10231D',
            'surface' => '#18362B',
            'surfaceStrong' => '#22513F',
            'text' => '#E4FFF2',
            'muted' => '#9BCDB7',
            'lineStrong' => '#4B9679',
            'accent' => '#63D99C',
        ],
        'violet' => [
            'canvas' => '#171627',
            'surface' => '#242141',
            'surfaceStrong' => '#312A5C',
            'text' => '#F1ECFF',
            'muted' => '#B6A9E2',
            'lineStrong' => '#7660C4',
            'accent' => '#BDA4FF',
        ],
        'ember' => [
            'canvas' => '#241713',
            'surface' => '#3A241C',
            'surfaceStrong' => '#573023',
            'text' => '#FFF0E4',
            'muted' => '#E0A984',
            'lineStrong' => '#B76541',
            'accent' => '#FF9E57',
        ],
        'ocean' => $fallback,
        'frostveil' => $fallback,
    ];

    return $presets[$preset] ?? $fallback;
}

function profile_share_card_hex_color(mixed $value, string $fallback): string
{
    if (is_string($value) && preg_match('/^#[0-9a-fA-F]{6}$/', $value) === 1) {
        return strtoupper($value);
    }

    return $fallback;
}

function posts_share_card_color($image, string $hex, array $fallback)
{
    [$red, $green, $blue] = posts_share_card_hex_to_rgb($hex, $fallback);

    return imagecolorallocate($image, $red, $green, $blue);
}

function posts_share_card_color_alpha($image, string $hex, array $fallback, int $alpha)
{
    [$red, $green, $blue] = posts_share_card_hex_to_rgb($hex, $fallback);

    return imagecolorallocatealpha($image, $red, $green, $blue, max(0, min(127, $alpha)));
}

function posts_share_card_hex_to_rgb(string $hex, array $fallback): array
{
    if (preg_match('/^#([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})$/', $hex, $matches) !== 1) {
        return $fallback;
    }

    return [hexdec($matches[1]), hexdec($matches[2]), hexdec($matches[3])];
}

function posts_share_card_fallback(bool $headOnly = false): void
{
    $paths = [
        dirname(__DIR__) . '/brand/thia-og.png',
        dirname(__DIR__) . '/public/brand/thia-og.png',
    ];

    foreach ($paths as $path) {
        if (is_file($path)) {
            posts_share_card_png_headers();

            if (!$headOnly) {
                readfile($path);
            }

            exit;
        }
    }

    header_remove('Content-Type');
    header('Content-Type: text/plain; charset=utf-8');
    http_response_code(503);

    if (!$headOnly) {
        echo 'Share card generation is unavailable.';
    }

    exit;
}

function profile_share_card_modules(int $userId): array
{
    if (!database_table_exists('profile_modules')) {
        return [];
    }

    try {
        $statement = db_query(
            'SELECT type, title, config_json, position
             FROM profile_modules
             WHERE user_id = :user_id
               AND visibility = :visibility
               AND status = :status
               AND type <> :profile_info
               AND type <> :placeholder
             ORDER BY position ASC, id ASC
             LIMIT 12',
            [
                'user_id' => $userId,
                'visibility' => 'public',
                'status' => 'active',
                'profile_info' => 'profile_info',
                'placeholder' => 'placeholder',
            ]
        );
    } catch (Throwable) {
        return [];
    }

    $modules = [];

    foreach ($statement->fetchAll() as $row) {
        $config = [];
        $decoded = json_decode((string) ($row['config_json'] ?? '{}'), true);

        if (is_array($decoded)) {
            $config = $decoded;
        }

        try {
            $type = (string) ($row['type'] ?? '');
            $config = profile_share_card_module_config_for_preview($type, $config, $userId);
            $preview = profile_share_card_module_preview(
                $type,
                is_string($row['title'] ?? null) ? (string) $row['title'] : null,
                $config,
                $userId
            );
        } catch (Throwable) {
            continue;
        }

        if ($preview !== null) {
            $modules[] = $preview;
        }
    }

    return $modules;
}

function profile_share_card_module_config_for_preview(string $type, array $config, int $userId): array
{
    if (!isset($config['integration'])) {
        $integration = profile_share_card_cached_integration_for_module($config);

        if ($integration !== null) {
            $config['integration'] = $integration;
        }
    }

    return $config;
}

function profile_share_card_cached_integration_for_module(array $config): ?array
{
    if (!profile_share_card_module_url_can_resolve($config['url'] ?? null)) {
        return null;
    }

    if (
        !function_exists('profile_integrations_storage_exists') ||
        !function_exists('profile_integration_provider_from_platform') ||
        !function_exists('profile_integration_normalize_url') ||
        !function_exists('profile_integration_cache_record') ||
        !function_exists('profile_integration_cache_payload')
    ) {
        return null;
    }

    try {
        if (!profile_integrations_storage_exists()) {
            return null;
        }

        $platform = is_string($config['platform'] ?? null) ? (string) $config['platform'] : null;
        $provider = profile_integration_provider_from_platform($platform);
        $normalized = profile_integration_normalize_url((string) $config['url'], $provider);

        if (!is_array($normalized)) {
            return null;
        }

        $record = profile_integration_cache_record($normalized['provider'], $normalized['resourceKey']);

        if ($record === null) {
            return null;
        }

        $stale = function_exists('profile_integration_cache_is_fresh')
            ? !profile_integration_cache_is_fresh($record)
            : false;

        return profile_integration_cache_payload($record, $stale);
    } catch (Throwable) {
        return null;
    }
}

function profile_share_card_module_url_can_resolve(mixed $value): bool
{
    if (!is_string($value)) {
        return false;
    }

    $trimmed = trim($value);

    if ($trimmed === '' || strlen($trimmed) > 500 || filter_var($trimmed, FILTER_VALIDATE_URL) === false) {
        return false;
    }

    return strtolower((string) parse_url($trimmed, PHP_URL_SCHEME)) === 'https';
}

function profile_share_card_module_preview(string $type, ?string $title, array $config, int $userId): ?array
{
    $label = profile_share_card_module_type_label($type);
    $kind = profile_share_card_module_kind($type);
    $name = trim($title ?? '');
    $body = '';
    $subtitle = '';
    $imageUrl = profile_share_card_module_image_url($type, $config);
    $imageUrls = profile_share_card_module_image_urls($type, $config);
    $items = [];
    $provider = null;
    $integration = profile_share_card_module_integration($config);
    $metadata = is_array($integration['metadata'] ?? null) ? $integration['metadata'] : [];

    $metadataTitle = profile_share_card_first_string([
        $metadata['title'] ?? null,
        $config['card']['metadata']['title'] ?? null,
        $config['link']['card']['metadata']['title'] ?? null,
    ]);

    if ($metadataTitle !== '') {
        $name = $metadataTitle;
    } elseif ($name === '') {
        $name = profile_share_card_module_title($type, $config, $label);
    }

    if (is_string($integration['provider'] ?? null)) {
        $provider = (string) $integration['provider'];
    } elseif (is_string($config['platform'] ?? null)) {
        $provider = (string) $config['platform'];
    } elseif (is_array($config['integration'] ?? null)) {
        $provider = (string) ($config['integration']['provider'] ?? 'Link');
    }

    $subtitle = profile_share_card_first_string([
        $metadata['subtitle'] ?? null,
        $metadata['recentLabel'] ?? null,
        $config['audio']['title'] ?? null,
        $config['video']['title'] ?? null,
    ]);

    if ($subtitle === '' && $provider !== null) {
        $subtitle = profile_share_card_platform_label($provider);
    }

    if (is_string($metadata['description'] ?? null)) {
        $body = post_body_snippet(profile_share_card_plain_text((string) $metadata['description']), 140);
    } elseif (is_string($config['body'] ?? null)) {
        $body = post_body_snippet(profile_share_card_plain_text((string) $config['body']), 140);
    } elseif (is_string($config['description'] ?? null)) {
        $body = post_body_snippet((string) $config['description'], 140);
    } elseif (is_string($config['statusText'] ?? null)) {
        $body = post_body_snippet((string) $config['statusText'], 140);
    }

    $stats = profile_share_card_module_stats($metadata);

    if ($kind === 'feed') {
        $items = profile_share_card_activity_items($userId);
    } elseif ($kind === 'links') {
        $items = profile_share_card_link_items($config);
    } elseif ($imageUrls !== []) {
        $items = array_map(
            static fn (string $url): array => ['imageUrl' => $url],
            array_slice($imageUrls, 0, 4)
        );
    }

    return [
        'kind' => $kind,
        'label' => $label,
        'title' => $name,
        'subtitle' => $subtitle,
        'body' => $body,
        'imageUrl' => $imageUrl,
        'items' => $items,
        'provider' => $provider,
        'stats' => $stats,
    ];
}

function profile_share_card_module_integration(array $config): ?array
{
    foreach ([
        $config['integration'] ?? null,
        $config['card'] ?? null,
        $config['link']['card'] ?? null,
    ] as $candidate) {
        if (is_array($candidate) && is_array($candidate['metadata'] ?? null)) {
            return $candidate;
        }
    }

    return null;
}

function profile_share_card_first_string(array $candidates): string
{
    foreach ($candidates as $candidate) {
        if (is_string($candidate) && trim($candidate) !== '') {
            return trim($candidate);
        }
    }

    return '';
}

function profile_share_card_module_stats(array $metadata): array
{
    $stats = is_array($metadata['stats'] ?? null) ? $metadata['stats'] : [];
    $items = [];

    foreach ([
        'listeners' => 'listeners',
        'followers' => 'followers',
        'subscribers' => 'subs',
        'views' => 'views',
        'popularity' => 'popularity',
    ] as $key => $label) {
        $value = $stats[$key] ?? null;

        if (!is_string($value) && !is_int($value) && !is_float($value)) {
            continue;
        }

        $valueText = is_numeric($value) ? profile_share_card_compact_number((float) $value) : trim((string) $value);

        if ($valueText === '') {
            continue;
        }

        $items[] = [
            'key' => $key,
            'label' => $label,
            'value' => $key === 'popularity' && is_numeric($value) ? $valueText . '/100' : $valueText,
        ];

        if (count($items) >= 2) {
            break;
        }
    }

    return $items;
}

function profile_share_card_compact_number(float $value): string
{
    if ($value >= 1000000000) {
        return rtrim(rtrim(number_format($value / 1000000000, 1), '0'), '.') . 'B';
    }

    if ($value >= 1000000) {
        return rtrim(rtrim(number_format($value / 1000000, 1), '0'), '.') . 'M';
    }

    if ($value >= 1000) {
        return rtrim(rtrim(number_format($value / 1000, 1), '0'), '.') . 'K';
    }

    return (string) (int) round($value);
}

function profile_share_card_module_kind(string $type): string
{
    return match (true) {
        $type === 'activity' => 'feed',
        $type === 'custom_text' || $type === 'text' || $type === 'about' => 'text',
        $type === 'gallery_slideshow' => 'slideshow',
        $type === 'gallery_feed' => 'image_grid',
        $type === 'uploaded_image' || $type === 'gallery_media' => 'image',
        $type === 'uploaded_video' || str_contains($type, 'video') => 'video',
        $type === 'music' || str_contains($type, 'music') || str_contains($type, 'artist') || str_contains($type, 'playlist') => 'music',
        $type === 'connections' || $type === 'links' => 'links',
        str_contains($type, 'github') => 'project',
        str_contains($type, 'twitch') => 'stream',
        default => 'card',
    };
}

function profile_share_card_module_type_label(string $type): string
{
    return match (true) {
        $type === 'activity' => 'Feed',
        $type === 'custom_text' || $type === 'text' => 'Text',
        $type === 'uploaded_image' || str_starts_with($type, 'gallery') => 'Image',
        $type === 'uploaded_video' || str_contains($type, 'video') => 'Video',
        $type === 'music' || str_contains($type, 'music') => 'Music',
        $type === 'connections' => 'Links',
        str_contains($type, 'twitch') => 'Stream',
        str_contains($type, 'github') => 'Project',
        default => 'Module',
    };
}

function profile_share_card_module_title(string $type, array $config, string $fallback): string
{
    foreach ([
        $config['label'] ?? null,
        $config['audio']['title'] ?? null,
        $config['video']['title'] ?? null,
        $config['link']['label'] ?? null,
        $config['integration']['metadata']['title'] ?? null,
        $config['integration']['displayName'] ?? null,
    ] as $value) {
        if (is_string($value) && trim($value) !== '') {
            return trim($value);
        }
    }

    if ($type === 'activity') {
        return 'Feed';
    }

    return $fallback;
}

function profile_share_card_module_image_url(string $type, array $config): ?string
{
    $imageUrls = profile_share_card_module_image_urls($type, $config);

    if ($imageUrls !== []) {
        return $imageUrls[0];
    }

    foreach ([
        $config['video']['posterUrl'] ?? null,
        $config['integration']['metadata']['image'] ?? null,
        $config['integration']['metadata']['imageUrl'] ?? null,
        $config['integration']['metadata']['thumbnailUrl'] ?? null,
        $config['imageUrl'] ?? null,
    ] as $value) {
        if (!is_string($value) || $value === '') {
            continue;
        }

        if (str_starts_with($value, '/uploads/media/') || posts_share_card_provider_image_url_is_allowed($value)) {
            return $value;
        }
    }

    return null;
}

function profile_share_card_module_image_urls(string $type, array $config): array
{
    if (
        !in_array($type, ['uploaded_image', 'gallery_media', 'gallery_slideshow', 'gallery_feed'], true)
        || !is_array($config['mediaItems'] ?? null)
    ) {
        return [];
    }

    $urls = [];

    foreach ($config['mediaItems'] as $item) {
        if (!is_array($item) || !is_string($item['url'] ?? null) || $item['url'] === '') {
            continue;
        }

        $url = (string) $item['url'];

        if (str_starts_with($url, '/uploads/media/')) {
            $urls[] = $url;
        }
    }

    return array_values(array_unique($urls));
}

function profile_share_card_link_items(array $config): array
{
    $links = $config['links'] ?? null;

    if (!is_array($links)) {
        return [];
    }

    $items = [];

    foreach ($links as $link) {
        if (!is_array($link)) {
            continue;
        }

        $label = trim((string) ($link['label'] ?? 'Link'));
        $platform = trim((string) ($link['platform'] ?? 'website'));
        $url = trim((string) ($link['url'] ?? ''));

        if ($url === '') {
            continue;
        }

        $items[] = [
            'title' => $label === '' ? profile_share_card_platform_label($platform) : $label,
            'subtitle' => profile_share_card_platform_label($platform),
            'platform' => $platform,
            'handle' => profile_share_card_connection_handle_from_url($platform, $url, $label),
            'url' => $url,
        ];

        if (count($items) >= 3) {
            break;
        }
    }

    return $items;
}

function profile_share_card_connection_handle_from_url(string $platform, string $url, string $label = ''): string
{
    $parts = parse_url($url);
    $path = trim((string) ($parts['path'] ?? ''), '/');
    $host = strtolower((string) ($parts['host'] ?? ''));
    $segments = $path === '' ? [] : explode('/', $path);
    $candidate = '';

    switch (strtolower($platform)) {
        case 'youtube':
            $candidate = (string) ($segments[0] ?? '');
            $candidate = ltrim($candidate, '@');
            break;
        case 'twitch':
        case 'github':
        case 'instagram':
        case 'x':
            $candidate = (string) ($segments[0] ?? '');
            break;
        case 'tiktok':
            $candidate = ltrim((string) ($segments[0] ?? ''), '@');
            break;
        case 'bluesky':
            $candidate = (string) ($segments[1] ?? $segments[0] ?? '');
            break;
        case 'discord':
            $candidate = (string) ($segments[0] ?? '');
            break;
        case 'spotify':
            $candidate = (string) ($segments[1] ?? $segments[0] ?? '');
            break;
        default:
            $candidate = preg_replace('/^www\./', '', $host) ?? $host;
            break;
    }

    $candidate = trim(rawurldecode($candidate));
    if ($candidate !== '') {
        return in_array(strtolower($platform), ['website', 'custom'], true) ? $candidate : '@' . ltrim($candidate, '@');
    }

    return trim($label);
}

function profile_share_card_activity_items(int $userId): array
{
    if (!database_table_exists('posts') || !database_table_exists('rooms')) {
        return [];
    }

    try {
        $statement = db_query(
            "SELECT p.body
             FROM posts p
             LEFT JOIN rooms r ON r.id = p.room_id
             WHERE p.author_id = :user_id
               AND p.parent_id IS NULL
               AND p.visibility = 'public'
               AND p.status = 'published'
               AND p.deleted_at IS NULL
               AND (
                 p.room_id IS NULL
                 OR (r.visibility = 'public' AND r.deleted_at IS NULL)
               )
             ORDER BY p.created_at DESC, p.id DESC
             LIMIT 3",
            ['user_id' => $userId]
        );
    } catch (Throwable) {
        return [];
    }

    $items = [];

    foreach ($statement->fetchAll() as $row) {
        $snippet = post_body_snippet((string) ($row['body'] ?? ''), 72);

        if ($snippet === '') {
            continue;
        }

        $items[] = [
            'title' => $snippet,
            'subtitle' => 'Post',
        ];
    }

    return $items;
}

function profile_share_card_plain_text(string $value): string
{
    $text = preg_replace('/```[\s\S]*?```/u', ' ', $value) ?? $value;
    $text = preg_replace('/`([^`]+)`/u', '$1', $text) ?? $text;
    $text = preg_replace('/\[([^\]]+)\]\(https:\/\/[^)\s]+\)/u', '$1', $text) ?? $text;
    $text = preg_replace('/^[#>\-*+\d.\s]+/um', '', $text) ?? $text;
    $text = str_replace(['**', '__', '*', '_', '~~'], '', $text);
    $text = strip_tags($text);

    return trim(preg_replace('/\s+/u', ' ', $text) ?? $text);
}

function profile_share_card_platform_label(string $platform): string
{
    return match (strtolower($platform)) {
        'apple_music' => 'Apple Music',
        'github' => 'GitHub',
        'spotify' => 'Spotify',
        'twitch' => 'Twitch',
        'youtube' => 'YouTube',
        default => ucfirst(str_replace('_', ' ', $platform)),
    };
}

function profile_share_card_draw_stats(
    $image,
    array $fonts,
    array $profile,
    int $x,
    int $y,
    int $text,
    int $muted,
    ?int $maxWidth = null
): void {
    $stats = [
        [(int) ($profile['followerCount'] ?? 0), 'Followers'],
        [(int) ($profile['followingCount'] ?? 0), 'Following'],
        [(int) ($profile['stats']['echoes'] ?? 0), 'Likes'],
        [(int) ($profile['starCount'] ?? 0), 'Stars'],
    ];
    $valueSize = posts_share_card_s($maxWidth === null ? 25 : 21);
    $labelSize = posts_share_card_s($maxWidth === null ? 17 : 14);
    $rowHeight = posts_share_card_s(32);
    $cursor = $x;
    $baseline = $y;

    foreach ($stats as [$value, $label]) {
        $valueText = (string) $value;
        $valueWidth = posts_share_card_text_width($fonts, $valueSize, $valueText);
        $labelWidth = posts_share_card_text_width($fonts, $labelSize, $label);
        $itemWidth = $valueWidth + posts_share_card_s(8) + $labelWidth + posts_share_card_s(28);

        if ($maxWidth !== null && $cursor > $x && $cursor + $itemWidth > $x + $maxWidth) {
            $cursor = $x;
            $baseline += $rowHeight;
        }

        posts_share_card_text($image, $fonts, $valueSize, $cursor, $baseline, $text, $valueText);
        posts_share_card_text($image, $fonts, $labelSize, $cursor + $valueWidth + posts_share_card_s(8), $baseline, $muted, $label);
        $cursor += $itemWidth;
    }
}

function profile_share_card_draw_module_preview(
    $image,
    array $fonts,
    array $module,
    int $x,
    int $y,
    int $width,
    int $height,
    int $text,
    int $muted,
    int $accent,
    int $line
): void {
    $surface = imagecolorallocatealpha($image, 9, 25, 34, 22);
    posts_share_card_draw_rounded_rect($image, $x, $y, $width, $height, posts_share_card_s(18), $surface);
    posts_share_card_stroke_rounded_rect($image, $x, $y, $width, $height, posts_share_card_s(18), $line, posts_share_card_s(1));

    $kind = (string) ($module['kind'] ?? 'card');

    if (in_array($kind, ['image', 'image_grid', 'slideshow'], true)) {
        profile_share_card_draw_image_preview($image, $fonts, $module, $x, $y, $width, $height, $text, $muted, $accent, $line);
        return;
    }

    if ($kind === 'text') {
        profile_share_card_draw_text_preview($image, $fonts, $module, $x, $y, $width, $height, $text, $muted, $accent);
        return;
    }

    if (in_array($kind, ['music', 'video', 'stream'], true)) {
        profile_share_card_draw_player_preview($image, $fonts, $module, $x, $y, $width, $height, $text, $muted, $accent, $line);
        return;
    }

    if ($kind === 'feed') {
        profile_share_card_draw_feed_preview($image, $fonts, $module, $x, $y, $width, $height, $text, $muted, $accent);
        return;
    }

    if (in_array($kind, ['links', 'project'], true)) {
        profile_share_card_draw_list_preview($image, $fonts, $module, $x, $y, $width, $height, $text, $muted, $accent, $line);
        return;
    }

    $imageUrl = $module['imageUrl'] ?? null;
    $textX = $x + posts_share_card_s(14);
    if (is_string($imageUrl) && $imageUrl !== '') {
        $thumbSize = posts_share_card_s(58);
        if (posts_share_card_draw_cover_safe_image_rounded($image, $imageUrl, $x + posts_share_card_s(12), $y + posts_share_card_s(14), $thumbSize, $thumbSize, posts_share_card_s(12))) {
            posts_share_card_stroke_rounded_rect($image, $x + posts_share_card_s(12), $y + posts_share_card_s(14), $thumbSize, $thumbSize, posts_share_card_s(12), $line, posts_share_card_s(1));
            $textX = $x + posts_share_card_s(82);
        }
    }

    posts_share_card_wrapped_text(
        $image,
        $fonts,
        posts_share_card_s(16),
        $textX,
        $y + posts_share_card_s(42),
        $text,
        (string) $module['title'],
        max(posts_share_card_s(60), $x + $width - $textX - posts_share_card_s(12)),
        1
    );

    $body = trim((string) ($module['body'] ?? $module['subtitle'] ?? ''));
    if ($body !== '') {
        posts_share_card_wrapped_text(
            $image,
            $fonts,
            posts_share_card_s(11),
            $textX,
            $y + posts_share_card_s(69),
            $muted,
            $body,
            max(posts_share_card_s(60), $x + $width - $textX - posts_share_card_s(12)),
            1
        );
    }
}

function profile_share_card_draw_image_preview(
    $image,
    array $fonts,
    array $module,
    int $x,
    int $y,
    int $width,
    int $height,
    int $text,
    int $muted,
    int $accent,
    int $line
): void {
    $items = is_array($module['items'] ?? null) ? $module['items'] : [];
    $imageUrls = [];

    foreach ($items as $item) {
        if (is_array($item) && is_string($item['imageUrl'] ?? null)) {
            $imageUrls[] = (string) $item['imageUrl'];
        }
    }

    if ($imageUrls === [] && is_string($module['imageUrl'] ?? null)) {
        $imageUrls[] = (string) $module['imageUrl'];
    }

    $title = trim((string) ($module['title'] ?? ''));
    $label = trim((string) ($module['label'] ?? ''));
    $shouldDrawTitle = $title !== '' && strcasecmp($title, $label) !== 0;

    if (count($imageUrls) <= 1) {
        if (($imageUrls[0] ?? null) && posts_share_card_draw_cover_safe_image_rounded($image, $imageUrls[0], $x, $y, $width, $height, posts_share_card_s(18), posts_share_card_s(1))) {
            if ($shouldDrawTitle) {
                $shade = imagecolorallocatealpha($image, 5, 18, 27, 52);
                posts_share_card_draw_rounded_rect($image, $x + posts_share_card_s(1), $y + $height - posts_share_card_s(52), $width - posts_share_card_s(2), posts_share_card_s(51), posts_share_card_s(16), $shade);
            }
        }
    } else {
        $gap = posts_share_card_s(4);
        $tileWidth = intdiv($width - posts_share_card_s(3) - $gap, 2);
        $tileHeight = intdiv($height - posts_share_card_s(3) - $gap, 2);

        foreach (array_slice($imageUrls, 0, 4) as $index => $imageUrl) {
            $tileX = $x + posts_share_card_s(2) + (($index % 2) * ($tileWidth + $gap));
            $tileY = $y + posts_share_card_s(2) + ((int) floor($index / 2) * ($tileHeight + $gap));
            posts_share_card_draw_cover_safe_image_rounded($image, $imageUrl, $tileX, $tileY, $tileWidth, $tileHeight, posts_share_card_s(12));
        }
    }

    if ($shouldDrawTitle) {
        posts_share_card_wrapped_text($image, $fonts, posts_share_card_s(15), $x + posts_share_card_s(12), $y + $height - posts_share_card_s(18), $text, $title, $width - posts_share_card_s(24), 1, posts_share_card_s(20));
    }

    if (($module['kind'] ?? '') === 'slideshow' && count($imageUrls) > 1) {
        $dotX = $x + $width - posts_share_card_s(34);
        $dotY = $y + $height - posts_share_card_s(20);
        for ($dot = 0; $dot < min(3, count($imageUrls)); $dot++) {
            imagefilledellipse($image, $dotX + ($dot * posts_share_card_s(9)), $dotY, posts_share_card_s(5), posts_share_card_s(5), $dot === 0 ? $accent : $muted);
        }
    }

    posts_share_card_stroke_rounded_rect($image, $x, $y, $width, $height, posts_share_card_s(18), $line, posts_share_card_s(1));
}

function profile_share_card_draw_text_preview(
    $image,
    array $fonts,
    array $module,
    int $x,
    int $y,
    int $width,
    int $height,
    int $text,
    int $muted,
    int $accent
): void {
    posts_share_card_draw_rounded_rect($image, $x + posts_share_card_s(14), $y + posts_share_card_s(16), posts_share_card_s(5), $height - posts_share_card_s(32), posts_share_card_s(3), $accent);
    posts_share_card_wrapped_text($image, $fonts, posts_share_card_s(17), $x + posts_share_card_s(30), $y + posts_share_card_s(44), $text, (string) $module['title'], $width - posts_share_card_s(46), 1, posts_share_card_s(24));

    $body = trim((string) ($module['body'] ?? ''));
    if ($body === '') {
        $body = 'Profile note';
    }

    posts_share_card_wrapped_text($image, $fonts, posts_share_card_s(11), $x + posts_share_card_s(30), $y + posts_share_card_s(76), $muted, $body, $width - posts_share_card_s(46), 2, posts_share_card_s(22));
}

function profile_share_card_draw_player_preview(
    $image,
    array $fonts,
    array $module,
    int $x,
    int $y,
    int $width,
    int $height,
    int $text,
    int $muted,
    int $accent,
    int $line
): void {
    $imageUrl = $module['imageUrl'] ?? null;
    $coverSize = min(posts_share_card_s(92), max(posts_share_card_s(56), $height - posts_share_card_s(46)));
    $coverDrawn = false;
    $coverX = $x + posts_share_card_s(14);
    $coverY = $y + posts_share_card_s(16);

    if (is_string($imageUrl) && $imageUrl !== '') {
        $coverDrawn = posts_share_card_draw_cover_safe_image_rounded($image, $imageUrl, $coverX, $coverY, $coverSize, $coverSize, posts_share_card_s(16));
    }

    if (!$coverDrawn) {
        $cover = imagecolorallocatealpha($image, 34, 86, 99, 20);
        posts_share_card_draw_rounded_rect($image, $coverX, $coverY, $coverSize, $coverSize, posts_share_card_s(16), $cover);
    }

    posts_share_card_stroke_rounded_rect($image, $coverX, $coverY, $coverSize, $coverSize, posts_share_card_s(16), $line, posts_share_card_s(1));
    $triangle = [
        $coverX + (int) round($coverSize * 0.42),
        $coverY + (int) round($coverSize * 0.34),
        $coverX + (int) round($coverSize * 0.42),
        $coverY + (int) round($coverSize * 0.66),
        $coverX + (int) round($coverSize * 0.68),
        $coverY + (int) round($coverSize * 0.50),
    ];
    imagefilledpolygon($image, $triangle, 3, $accent);

    $textX = $coverX + $coverSize + posts_share_card_s(16);
    $textWidth = max(posts_share_card_s(70), $x + $width - $textX - posts_share_card_s(14));
    posts_share_card_wrapped_text($image, $fonts, posts_share_card_s(16), $textX, $y + posts_share_card_s(38), $text, (string) $module['title'], $textWidth, 1, posts_share_card_s(22));

    $subtitle = trim((string) ($module['subtitle'] ?? ''));
    if ($subtitle === '') {
        $subtitle = (string) ($module['label'] ?? 'Open');
    }
    posts_share_card_wrapped_text($image, $fonts, posts_share_card_s(11), $textX, $y + posts_share_card_s(64), $muted, $subtitle, $textWidth, 1, posts_share_card_s(18));

    $stats = is_array($module['stats'] ?? null) ? $module['stats'] : [];
    $body = trim((string) ($module['body'] ?? ''));

    if ($stats !== []) {
        $statText = implode(' · ', array_map(
            static fn (array $item): string => trim((string) ($item['value'] ?? '') . ' ' . (string) ($item['label'] ?? '')),
            array_filter($stats, 'is_array')
        ));
        posts_share_card_wrapped_text($image, $fonts, posts_share_card_s(10), $textX, $y + posts_share_card_s(88), $accent, $statText, $textWidth, 1, posts_share_card_s(16));
    } elseif ($body !== '') {
        posts_share_card_wrapped_text($image, $fonts, posts_share_card_s(10), $textX, $y + posts_share_card_s(88), $muted, $body, $textWidth, 1, posts_share_card_s(16));
    }

    $barY = $y + $height - posts_share_card_s(28);
    posts_share_card_draw_rounded_rect($image, $x + posts_share_card_s(14), $barY, $width - posts_share_card_s(28), posts_share_card_s(5), posts_share_card_s(3), $line);
    posts_share_card_draw_rounded_rect($image, $x + posts_share_card_s(14), $barY, min($width - posts_share_card_s(28), posts_share_card_s(86)), posts_share_card_s(5), posts_share_card_s(3), $accent);
    posts_share_card_text($image, $fonts, posts_share_card_s(10), $x + posts_share_card_s(14), $y + $height - posts_share_card_s(10), $muted, strtoupper(profile_share_card_platform_label((string) ($module['provider'] ?? $module['label'] ?? 'Open'))));
}

function profile_share_card_draw_feed_preview(
    $image,
    array $fonts,
    array $module,
    int $x,
    int $y,
    int $width,
    int $height,
    int $text,
    int $muted,
    int $accent
): void {
    posts_share_card_wrapped_text($image, $fonts, posts_share_card_s(16), $x + posts_share_card_s(14), $y + posts_share_card_s(34), $text, (string) $module['title'], $width - posts_share_card_s(28), 1, posts_share_card_s(22));

    $items = is_array($module['items'] ?? null) ? $module['items'] : [];
    if ($items === []) {
        $items = [['title' => 'Recent profile posts appear here.', 'subtitle' => 'Post']];
    }

    $rowY = $y + posts_share_card_s(66);
    foreach (array_slice($items, 0, 2) as $item) {
        if (!is_array($item)) {
            continue;
        }

        posts_share_card_draw_rounded_rect($image, $x + posts_share_card_s(14), $rowY - posts_share_card_s(8), posts_share_card_s(5), posts_share_card_s(5), posts_share_card_s(3), $accent);
        posts_share_card_wrapped_text(
            $image,
            $fonts,
            posts_share_card_s(10),
            $x + posts_share_card_s(28),
            $rowY,
            $muted,
            (string) ($item['title'] ?? ''),
            $width - posts_share_card_s(42),
            1,
            posts_share_card_s(18)
        );
        $rowY += posts_share_card_s(28);
    }
}

function profile_share_card_draw_list_preview(
    $image,
    array $fonts,
    array $module,
    int $x,
    int $y,
    int $width,
    int $height,
    int $text,
    int $muted,
    int $accent,
    int $line
): void {
    posts_share_card_wrapped_text($image, $fonts, posts_share_card_s(16), $x + posts_share_card_s(14), $y + posts_share_card_s(34), $text, (string) $module['title'], $width - posts_share_card_s(28), 1, posts_share_card_s(22));

    $items = is_array($module['items'] ?? null) ? $module['items'] : [];
    if ($items === []) {
        $items = [[
            'title' => trim((string) ($module['body'] ?? $module['subtitle'] ?? 'Open link')),
            'subtitle' => (string) ($module['subtitle'] ?? 'Link'),
        ]];
    }

    $rowY = $y + posts_share_card_s(58);
    foreach (array_slice($items, 0, 2) as $item) {
        if (!is_array($item)) {
            continue;
        }

        $rowHeight = posts_share_card_s(34);
        $surface = imagecolorallocatealpha($image, 22, 51, 61, 24);
        posts_share_card_draw_rounded_rect($image, $x + posts_share_card_s(14), $rowY, $width - posts_share_card_s(28), $rowHeight, posts_share_card_s(17), $surface);
        $platform = is_string($item['platform'] ?? null) ? (string) $item['platform'] : 'website';
        profile_share_card_draw_connection_icon($image, $platform, $x + posts_share_card_s(22), $rowY + posts_share_card_s(7), posts_share_card_s(20), $accent, $text);
        $handle = trim((string) ($item['handle'] ?? ''));
        $label = $handle !== '' ? $handle : (string) ($item['title'] ?? 'Link');
        posts_share_card_wrapped_text($image, $fonts, posts_share_card_s(10), $x + posts_share_card_s(50), $rowY + posts_share_card_s(22), $text, $label, $width - posts_share_card_s(70), 1, posts_share_card_s(16));
        $rowY += posts_share_card_s(42);
    }
}

function profile_share_card_draw_connection_icon($image, string $platform, int $x, int $y, int $size, int $accent, int $text): void
{
    $platform = strtolower($platform);
    $brandColor = match ($platform) {
        'youtube' => imagecolorallocate($image, 255, 0, 0),
        'spotify' => imagecolorallocate($image, 30, 215, 96),
        'twitch' => imagecolorallocate($image, 145, 70, 255),
        'github' => imagecolorallocate($image, 36, 41, 47),
        'instagram' => imagecolorallocate($image, 225, 48, 108),
        'tiktok' => imagecolorallocate($image, 0, 242, 234),
        'x' => imagecolorallocate($image, 236, 245, 246),
        'discord' => imagecolorallocate($image, 88, 101, 242),
        'bluesky' => imagecolorallocate($image, 17, 133, 254),
        default => $accent,
    };

    posts_share_card_draw_rounded_rect($image, $x, $y, $size, $size, intdiv($size, 2), $brandColor);
    $cx = $x + intdiv($size, 2);
    $cy = $y + intdiv($size, 2);
    $ink = in_array($platform, ['x'], true) ? imagecolorallocate($image, 5, 18, 27) : $text;

    if ($platform === 'youtube') {
        imagefilledpolygon($image, [
            $x + (int) round($size * 0.42), $y + (int) round($size * 0.32),
            $x + (int) round($size * 0.42), $y + (int) round($size * 0.68),
            $x + (int) round($size * 0.70), $y + (int) round($size * 0.50),
        ], 3, $text);
        return;
    }

    if ($platform === 'spotify') {
        imagesetthickness($image, max(1, posts_share_card_s(1)));
        imagearc($image, $cx, $cy + (int) round($size * 0.05), (int) round($size * 0.70), (int) round($size * 0.42), 200, 340, imagecolorallocate($image, 4, 18, 27));
        imagearc($image, $cx, $cy + (int) round($size * 0.14), (int) round($size * 0.56), (int) round($size * 0.30), 205, 335, imagecolorallocate($image, 4, 18, 27));
        return;
    }

    $glyph = match ($platform) {
        'github' => 'GH',
        'twitch' => 'T',
        'instagram' => 'IG',
        'tiktok' => '♪',
        'x' => 'X',
        'discord' => 'D',
        'bluesky' => 'B',
        default => '↗',
    };
    $fontSize = posts_share_card_s(strlen($glyph) > 1 ? 7 : 10);
    $fonts = posts_share_card_font_paths();
    $textWidth = posts_share_card_text_width($fonts, $fontSize, $glyph);
    posts_share_card_text($image, $fonts, $fontSize, $cx - intdiv($textWidth, 2), $y + (int) round($size * 0.67), $ink, $glyph);
}

function posts_share_card_font_paths(): array
{
    $primary = posts_share_card_first_existing_path([
        __DIR__ . '/assets/fonts/NotoSans-Regular.ttf',
        '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
        '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf',
        '/System/Library/Fonts/Supplemental/Arial.ttf',
        '/Library/Fonts/Arial.ttf',
    ]);
    $emoji = posts_share_card_first_existing_path([
        __DIR__ . '/assets/fonts/NotoEmoji-Regular.ttf',
        '/usr/share/fonts/truetype/noto/NotoEmoji-Regular.ttf',
        '/usr/share/fonts/truetype/noto/NotoEmoji.ttf',
    ]);

    return [
        'primary' => $primary,
        'emoji' => $emoji,
    ];
}

function posts_share_card_first_existing_path(array $paths): ?string
{
    foreach ($paths as $path) {
        if (is_file($path)) {
            return $path;
        }
    }

    return null;
}

function posts_share_card_text($image, array $fonts, int $size, int $x, int $y, int $color, string $text): void
{
    $primaryFont = $fonts['primary'] ?? null;
    $emojiFont = $fonts['emoji'] ?? null;

    if ($primaryFont !== null && function_exists('imagettftext')) {
        $cursorX = $x;
        $textBuffer = '';
        $flushText = function () use ($image, $primaryFont, $size, $y, $color, &$cursorX, &$textBuffer): void {
            if ($textBuffer === '') {
                return;
            }

            @imagettftext($image, $size, 0, $cursorX, $y, $color, $primaryFont, $textBuffer);
            $cursorX += posts_share_card_ttf_text_width($primaryFont, $size, $textBuffer);
            $textBuffer = '';
        };

        foreach (posts_share_card_graphemes($text) as $grapheme) {
            if (!posts_share_card_is_emoji($grapheme)) {
                $textBuffer .= $grapheme;
                continue;
            }

            $flushText();

            if (posts_share_card_draw_emoji($image, $grapheme, $cursorX, $y, $size)) {
                $cursorX += posts_share_card_emoji_advance($size);
                continue;
            }

            $font = $emojiFont ?? $primaryFont;
            $result = @imagettftext($image, $size, 0, $cursorX, $y, $color, $font, $grapheme);

            if ($result === false && $font !== $primaryFont) {
                $result = @imagettftext($image, $size, 0, $cursorX, $y, $color, $primaryFont, $grapheme);
            }

            $cursorX += posts_share_card_ttf_text_width($font, $size, $grapheme);
        }

        $flushText();

        return;
    }

    imagestring($image, 5, $x, max(0, $y - 18), $text, $color);
}

function posts_share_card_wrapped_text(
    $image,
    array $fonts,
    int $size,
    int $x,
    int $y,
    int $color,
    string $text,
    int $maxWidth,
    int $maxLines,
    int $lineHeight = 42
): void {
    $lines = posts_share_card_wrapped_text_lines($fonts, $size, $text, $maxWidth, $maxLines);

    foreach ($lines as $index => $lineText) {
        posts_share_card_text($image, $fonts, $size, $x, $y + ($index * $lineHeight), $color, $lineText);
    }
}

function posts_share_card_wrapped_text_lines(
    array $fonts,
    int $size,
    string $text,
    int $maxWidth,
    int $maxLines
): array {
    $normalizedText = trim(preg_replace('/\s+/u', ' ', $text) ?? $text);

    if ($normalizedText === '' || $maxLines <= 0) {
        return [];
    }

    $words = preg_split('/\s+/', $normalizedText) ?: [];
    $lines = [];
    $line = '';

    foreach ($words as $word) {
        $candidate = trim($line . ' ' . $word);

        if ($line !== '' && posts_share_card_text_width($fonts, $size, $candidate) > $maxWidth) {
            $lines[] = $line;
            $line = $word;

            if (count($lines) >= $maxLines) {
                break;
            }

            continue;
        }

        $line = $candidate;
    }

    if ($line !== '' && count($lines) < $maxLines) {
        $lines[] = $line;
    }

    $lines = array_slice($lines, 0, $maxLines);

    foreach ($lines as $index => $lineText) {
        if (posts_share_card_text_width($fonts, $size, $lineText) > $maxWidth) {
            $lines[$index] = posts_share_card_ellipsize_line($fonts, $size, $lineText, $maxWidth);
        }
    }

    $renderedText = trim(implode(' ', $lines));

    if ($lines !== [] && $renderedText !== $normalizedText) {
        $lastIndex = count($lines) - 1;
        $lines[$lastIndex] = posts_share_card_ellipsize_line($fonts, $size, $lines[$lastIndex], $maxWidth);
    }

    return $lines;
}

function posts_share_card_ellipsize_line(array $fonts, int $size, string $line, int $maxWidth): string
{
    $suffix = '...';
    $line = rtrim($line, " \t\n\r\0\x0B.,;:-");

    while ($line !== '' && posts_share_card_text_width($fonts, $size, $line . $suffix) > $maxWidth) {
        if (function_exists('mb_substr') && function_exists('mb_strlen')) {
            $line = mb_substr($line, 0, max(0, mb_strlen($line, 'UTF-8') - 1), 'UTF-8');
        } else {
            $line = substr($line, 0, -1);
        }
    }

    return $line === '' ? $suffix : $line . $suffix;
}

function posts_share_card_text_width(array $fonts, int $size, string $text): int
{
    $primaryFont = $fonts['primary'] ?? null;

    if ($primaryFont !== null && function_exists('imagettfbbox')) {
        $width = 0;
        $textBuffer = '';
        $flushWidth = function () use ($primaryFont, $size, &$width, &$textBuffer): void {
            if ($textBuffer === '') {
                return;
            }

            $width += posts_share_card_ttf_text_width($primaryFont, $size, $textBuffer);
            $textBuffer = '';
        };

        foreach (posts_share_card_graphemes($text) as $grapheme) {
            if (posts_share_card_is_emoji($grapheme)) {
                $flushWidth();
                $width += posts_share_card_emoji_advance($size);
                continue;
            }

            $textBuffer .= $grapheme;
        }

        $flushWidth();

        return $width;
    }

    return strlen($text) * 10;
}

function posts_share_card_ttf_text_width(?string $font, int $size, string $text): int
{
    if ($font !== null && function_exists('imagettfbbox')) {
        $box = @imagettfbbox($size, 0, $font, $text);

        if (is_array($box)) {
            return abs((int) $box[2] - (int) $box[0]);
        }
    }

    return strlen($text) * 10;
}

function posts_share_card_graphemes(string $text): array
{
    if (function_exists('grapheme_extract')) {
        $clusters = [];
        $offset = 0;
        $length = strlen($text);

        while ($offset < $length) {
            $nextOffset = 0;
            $cluster = grapheme_extract($text, 1, GRAPHEME_EXTR_COUNT, $offset, $nextOffset);

            if (!is_string($cluster) || $cluster === '') {
                break;
            }

            $clusters[] = $cluster;
            $offset = $nextOffset;
        }

        if ($clusters !== []) {
            return $clusters;
        }
    }

    if (preg_match_all('/\X/u', $text, $matches) === false) {
        return str_split($text);
    }

    return $matches[0] ?? [];
}

function posts_share_card_is_emoji(string $text): bool
{
    $propertyMatch = @preg_match('/\p{Extended_Pictographic}|\p{Emoji_Presentation}|\x{FE0F}/u', $text);

    if ($propertyMatch === 1) {
        return true;
    }

    return preg_match('/[\x{1F000}-\x{1FAFF}\x{2600}-\x{27BF}]/u', $text) === 1;
}

function posts_share_card_draw_emoji($image, string $emoji, int $x, int $baselineY, int $textSize): bool
{
    $emojiImage = posts_share_card_emoji_image($emoji);

    if ($emojiImage === null) {
        return false;
    }

    $size = posts_share_card_emoji_size($textSize);
    $y = (int) round($baselineY - $size + max(3, $textSize * 0.12));

    imagecopyresampled(
        $image,
        $emojiImage,
        $x,
        $y,
        0,
        0,
        $size,
        $size,
        imagesx($emojiImage),
        imagesy($emojiImage)
    );

    return true;
}

function posts_share_card_emoji_image(string $emoji)
{
    static $cache = [];

    $key = posts_share_card_emoji_key($emoji);

    if ($key === null) {
        return null;
    }

    if (array_key_exists($key, $cache)) {
        return $cache[$key] ?: null;
    }

    $url = "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/{$key}.png";
    $body = posts_share_card_fetch_allowlisted_asset($url);

    if ($body === null) {
        $cache[$key] = false;
        return null;
    }

    $emojiImage = @imagecreatefromstring($body);
    $cache[$key] = $emojiImage ?: false;

    return $emojiImage ?: null;
}

function posts_share_card_emoji_key(string $emoji): ?string
{
    if (preg_match_all('/./us', $emoji, $matches) === false) {
        return null;
    }

    $codes = [];

    foreach ($matches[0] as $character) {
        $codepoint = function_exists('mb_ord')
            ? mb_ord($character, 'UTF-8')
            : (class_exists('IntlChar') ? IntlChar::ord($character) : null);

        if (!is_int($codepoint) || in_array($codepoint, [0xFE0E, 0xFE0F], true)) {
            continue;
        }

        $codes[] = strtolower(dechex($codepoint));
    }

    return $codes === [] ? null : implode('-', $codes);
}

function posts_share_card_fetch_allowlisted_asset(string $url): ?string
{
    if (!function_exists('curl_init')) {
        return null;
    }

    $parts = parse_url($url);

    if (
        ($parts['scheme'] ?? null) !== 'https'
        || ($parts['host'] ?? null) !== 'cdn.jsdelivr.net'
        || !str_starts_with((string) ($parts['path'] ?? ''), '/gh/twitter/twemoji@14.0.2/assets/72x72/')
    ) {
        return null;
    }

    $curl = curl_init($url);

    if ($curl === false) {
        return null;
    }

    curl_setopt_array($curl, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => false,
        CURLOPT_CONNECTTIMEOUT_MS => 700,
        CURLOPT_TIMEOUT_MS => 1200,
        CURLOPT_USERAGENT => 'thia.lol share-card',
    ]);

    $body = curl_exec($curl);
    $status = (int) curl_getinfo($curl, CURLINFO_RESPONSE_CODE);

    if (!is_string($body) || $status !== 200 || strlen($body) > 200000) {
        return null;
    }

    return $body;
}

function posts_share_card_emoji_size(int $textSize): int
{
    return max(18, (int) round($textSize * 1.18));
}

function posts_share_card_emoji_advance(int $textSize): int
{
    return posts_share_card_emoji_size($textSize) + 2;
}

function posts_share_card_draw_lockup($image): void
{
    if (!function_exists('imagecreatefrompng')) {
        return;
    }

    foreach ([
        dirname(__DIR__) . '/brand/thia-lockup-frostveil.png',
        dirname(__DIR__) . '/public/brand/thia-lockup-frostveil.png',
    ] as $path) {
        if (!is_file($path)) {
            continue;
        }

        $source = @imagecreatefrompng($path);

        if (!$source) {
            continue;
        }

        imagealphablending($source, true);
        $targetWidth = posts_share_card_s(160);
        $targetHeight = posts_share_card_s(72);
        $targetX = posts_share_card_s(24);
        $targetY = posts_share_card_s(12);
        imagecopyresampled(
            $image,
            $source,
            $targetX,
            $targetY,
            0,
            0,
            $targetWidth,
            $targetHeight,
            imagesx($source),
            imagesy($source)
        );
        return;
    }
}

function posts_share_card_draw_thumbnail($image, array $post): bool
{
    $mediaUrl = $post['mediaUrl'] ?? null;

    if (!is_string($mediaUrl) || $mediaUrl === '') {
        return false;
    }

    $path = posts_share_card_media_path($mediaUrl);

    if ($path === null) {
        return false;
    }

    $source = posts_share_card_load_image($path);

    if (!$source) {
        return false;
    }

    $sourceWidth = imagesx($source);
    $sourceHeight = imagesy($source);
    $targetX = posts_share_card_s(770);
    $targetY = posts_share_card_s(130);
    $targetWidth = posts_share_card_s(316);
    $targetHeight = posts_share_card_s(408);
    $sourceRatio = $sourceWidth / max(1, $sourceHeight);
    $targetRatio = $targetWidth / $targetHeight;

    if ($sourceRatio > $targetRatio) {
        $cropHeight = $sourceHeight;
        $cropWidth = (int) round($sourceHeight * $targetRatio);
        $cropX = (int) floor(($sourceWidth - $cropWidth) / 2);
        $cropY = 0;
    } else {
        $cropWidth = $sourceWidth;
        $cropHeight = (int) round($sourceWidth / $targetRatio);
        $cropX = 0;
        $cropY = (int) floor(($sourceHeight - $cropHeight) / 2);
    }

    imagecopyresampled(
        $image,
        $source,
        $targetX,
        $targetY,
        $cropX,
        $cropY,
        $targetWidth,
        $targetHeight,
        $cropWidth,
        $cropHeight
    );

    $line = imagecolorallocate($image, 65, 126, 146);
    posts_share_card_stroke_rounded_rect($image, $targetX, $targetY, $targetWidth, $targetHeight, posts_share_card_s(26), $line, posts_share_card_s(1));

    return true;
}

function posts_share_card_draw_cover_uploaded_image(
    $image,
    string $mediaUrl,
    int $targetX,
    int $targetY,
    int $targetWidth,
    int $targetHeight
): bool {
    $path = posts_share_card_media_path($mediaUrl);

    if ($path === null) {
        return false;
    }

    $source = posts_share_card_load_image($path);

    if (!$source) {
        return false;
    }

    posts_share_card_draw_cover_source($image, $source, $targetX, $targetY, $targetWidth, $targetHeight);

    return true;
}

function posts_share_card_draw_cover_safe_image(
    $image,
    string $imageUrl,
    int $targetX,
    int $targetY,
    int $targetWidth,
    int $targetHeight
): bool {
    $source = posts_share_card_load_safe_image_source($imageUrl);

    if (!$source) {
        return false;
    }

    posts_share_card_draw_cover_source($image, $source, $targetX, $targetY, $targetWidth, $targetHeight);

    return true;
}

function posts_share_card_load_safe_image_source(string $imageUrl): ?GdImage
{
    $path = posts_share_card_media_path($imageUrl);

    if ($path !== null) {
        return posts_share_card_load_image($path);
    }

    return posts_share_card_load_allowlisted_provider_image($imageUrl);
}

function posts_share_card_draw_cover_source(
    $image,
    GdImage $source,
    int $targetX,
    int $targetY,
    int $targetWidth,
    int $targetHeight
): void {
    $sourceWidth = imagesx($source);
    $sourceHeight = imagesy($source);
    $sourceRatio = $sourceWidth / max(1, $sourceHeight);
    $targetRatio = $targetWidth / max(1, $targetHeight);

    if ($sourceRatio > $targetRatio) {
        $cropHeight = $sourceHeight;
        $cropWidth = (int) round($sourceHeight * $targetRatio);
        $cropX = (int) floor(($sourceWidth - $cropWidth) / 2);
        $cropY = 0;
    } else {
        $cropWidth = $sourceWidth;
        $cropHeight = (int) round($sourceWidth / $targetRatio);
        $cropX = 0;
        $cropY = (int) floor(($sourceHeight - $cropHeight) / 2);
    }

    imagecopyresampled(
        $image,
        $source,
        $targetX,
        $targetY,
        $cropX,
        $cropY,
        $targetWidth,
        $targetHeight,
        $cropWidth,
        $cropHeight
    );
}

function posts_share_card_draw_avatar($image, array $post, int $x, int $y, int $size): bool
{
    $avatarUrl = $post['author']['avatarUrl'] ?? null;

    if (!is_string($avatarUrl) || $avatarUrl === '') {
        return false;
    }

    $path = posts_share_card_media_path($avatarUrl);

    if ($path === null) {
        return false;
    }

    $source = posts_share_card_load_image($path);

    if (!$source) {
        return false;
    }

    $sourceWidth = imagesx($source);
    $sourceHeight = imagesy($source);
    $cropSize = min($sourceWidth, $sourceHeight);
    $cropX = (int) floor(($sourceWidth - $cropSize) / 2);
    $cropY = (int) floor(($sourceHeight - $cropSize) / 2);
    $avatar = imagecreatetruecolor($size, $size);

    if (!$avatar) {
        return false;
    }

    imagealphablending($avatar, false);
    imagesavealpha($avatar, true);
    $transparent = imagecolorallocatealpha($avatar, 0, 0, 0, 127);
    imagefilledrectangle($avatar, 0, 0, $size, $size, $transparent);
    imagealphablending($avatar, true);
    imagecopyresampled(
        $avatar,
        $source,
        0,
        0,
        $cropX,
        $cropY,
        $size,
        $size,
        $cropSize,
        $cropSize
    );

    $radius = ($size - 1) / 2;
    $radiusSquared = $radius * $radius;

    for ($pixelY = 0; $pixelY < $size; $pixelY++) {
        for ($pixelX = 0; $pixelX < $size; $pixelX++) {
            $dx = $pixelX - $radius;
            $dy = $pixelY - $radius;

            if (($dx * $dx) + ($dy * $dy) > $radiusSquared) {
                imagesetpixel($avatar, $pixelX, $pixelY, $transparent);
            }
        }
    }

    imagecopy($image, $avatar, $x, $y, 0, 0, $size, $size);

    $line = imagecolorallocate($image, 65, 126, 146);
    imagesetthickness($image, max(1, posts_share_card_s(3)));
    imageellipse($image, $x + intdiv($size, 2), $y + intdiv($size, 2), $size - 2, $size - 2, $line);
    imagesetthickness($image, 1);

    return true;
}

function posts_share_card_media_path(string $mediaUrl): ?string
{
    $parts = parse_url($mediaUrl);

    if (is_array($parts)) {
        $host = strtolower(rtrim((string) ($parts['host'] ?? ''), '.'));
        $scheme = strtolower((string) ($parts['scheme'] ?? ''));

        if ($host !== '' || $scheme !== '') {
            $allowedHost = strtolower((string) parse_url(post_public_base_url(), PHP_URL_HOST));

            if ($scheme !== 'https' || $host !== $allowedHost) {
                return null;
            }
        }

        $mediaUrl = (string) ($parts['path'] ?? '');
    }

    if (preg_match('#^/uploads/media/[0-9]{4}/[0-9]{2}/[a-z0-9_-]+\.(?:jpe?g|png|webp|gif)$#', $mediaUrl) !== 1) {
        return null;
    }

    $relative = ltrim($mediaUrl, '/');
    $paths = [
        dirname(__DIR__) . '/' . $relative,
        dirname(__DIR__) . '/public/' . $relative,
    ];

    foreach ($paths as $path) {
        if (is_file($path)) {
            return $path;
        }
    }

    return null;
}

function posts_share_card_load_allowlisted_provider_image(string $imageUrl): ?GdImage
{
    $body = posts_share_card_fetch_allowlisted_provider_image($imageUrl);

    if ($body === null || !function_exists('imagecreatefromstring')) {
        return null;
    }

    $size = @getimagesizefromstring($body);

    if (!is_array($size)) {
        return null;
    }

    $mime = (string) ($size['mime'] ?? '');
    $width = (int) ($size[0] ?? 0);
    $height = (int) ($size[1] ?? 0);

    if (
        !in_array($mime, ['image/jpeg', 'image/png', 'image/webp', 'image/gif'], true)
        || $width <= 0
        || $height <= 0
        || $width > 4096
        || $height > 4096
    ) {
        return null;
    }

    $source = @imagecreatefromstring($body);

    return $source instanceof GdImage ? $source : null;
}

function posts_share_card_fetch_allowlisted_provider_image(string $imageUrl): ?string
{
    static $cache = [];

    $imageUrl = trim($imageUrl);

    if (!posts_share_card_provider_image_url_is_allowed($imageUrl) || !function_exists('curl_init')) {
        return null;
    }

    if (array_key_exists($imageUrl, $cache)) {
        return $cache[$imageUrl] ?: null;
    }

    $curl = curl_init($imageUrl);

    if ($curl === false) {
        $cache[$imageUrl] = false;
        return null;
    }

    curl_setopt_array($curl, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => false,
        CURLOPT_CONNECTTIMEOUT_MS => 800,
        CURLOPT_TIMEOUT_MS => 1800,
        CURLOPT_USERAGENT => 'thia.lol share-card',
        CURLOPT_HTTPHEADER => ['Accept: image/avif,image/webp,image/png,image/jpeg,image/gif;q=0.9,*/*;q=0.1'],
        CURLOPT_ENCODING => '',
    ]);

    if (defined('CURLOPT_PROTOCOLS_STR')) {
        @curl_setopt($curl, CURLOPT_PROTOCOLS_STR, 'https');
    } elseif (defined('CURLOPT_PROTOCOLS') && defined('CURLPROTO_HTTPS')) {
        @curl_setopt($curl, CURLOPT_PROTOCOLS, CURLPROTO_HTTPS);
    }

    $body = curl_exec($curl);
    $status = (int) curl_getinfo($curl, CURLINFO_RESPONSE_CODE);
    $contentType = strtolower((string) curl_getinfo($curl, CURLINFO_CONTENT_TYPE));
    curl_close($curl);

    if (
        !is_string($body)
        || $status !== 200
        || strlen($body) === 0
        || strlen($body) > 3000000
        || (
            $contentType !== ''
            && !str_starts_with($contentType, 'image/jpeg')
            && !str_starts_with($contentType, 'image/png')
            && !str_starts_with($contentType, 'image/webp')
            && !str_starts_with($contentType, 'image/gif')
        )
    ) {
        $cache[$imageUrl] = false;
        return null;
    }

    $cache[$imageUrl] = $body;

    return $body;
}

function posts_share_card_provider_image_url_is_allowed(string $imageUrl): bool
{
    $imageUrl = trim($imageUrl);

    if ($imageUrl === '' || strlen($imageUrl) > 1200) {
        return false;
    }

    $parts = parse_url($imageUrl);

    if (!is_array($parts) || strtolower((string) ($parts['scheme'] ?? '')) !== 'https') {
        return false;
    }

    if (isset($parts['user']) || isset($parts['pass'])) {
        return false;
    }

    $host = strtolower(rtrim((string) ($parts['host'] ?? ''), '.'));

    if ($host === '') {
        return false;
    }

    $exactHosts = [
        'avatars.githubusercontent.com',
        'i.scdn.co',
        'i.ytimg.com',
        'image-cdn-ak.spotifycdn.com',
        'img.youtube.com',
        'mosaic.scdn.co',
        'opengraph.githubassets.com',
        'static-cdn.jtvnw.net',
        'static-cdn.twitchcdn.net',
        'yt3.ggpht.com',
    ];

    if (in_array($host, $exactHosts, true)) {
        return true;
    }

    return $host === 'mzstatic.com' || str_ends_with($host, '.mzstatic.com');
}

function posts_share_card_load_image(string $path): ?GdImage
{
    $size = @getimagesize($path);

    if ($size === false) {
        return null;
    }

    $source = match ($size['mime'] ?? '') {
        'image/jpeg' => function_exists('imagecreatefromjpeg') ? @imagecreatefromjpeg($path) : false,
        'image/png' => function_exists('imagecreatefrompng') ? @imagecreatefrompng($path) : false,
        'image/webp' => function_exists('imagecreatefromwebp') ? @imagecreatefromwebp($path) : false,
        'image/gif' => function_exists('imagecreatefromgif') ? @imagecreatefromgif($path) : false,
        default => false,
    };

    return $source instanceof GdImage ? $source : null;
}

function posts_reaction_create(int $postId): void
{
    $session = require_authenticated_session();
    require_csrf_token($session);
    $post = fetch_reactable_post_record($postId);

    if ($post === null) {
        json_error('Post not found.', 404);
    }

    $body = request_json_body();
    $type = validate_reaction_type($body['type'] ?? null);

    $insert = db_query(
        'INSERT IGNORE INTO post_reactions (post_id, user_id, type)
         VALUES (:post_id, :user_id, :type)',
        [
            'post_id' => $postId,
            'user_id' => (int) $session['user_id'],
            'type' => $type,
        ]
    );

    if ($type === like_reaction_type() && $insert->rowCount() > 0) {
        notification_create(
            (int) $post['author_id'],
            (int) $session['user_id'],
            'like',
            $postId,
            $post['room_id'] === null ? null : (int) $post['room_id'],
            null,
            true
        );
    }

    json_success([
        'postId' => $postId,
        'reactions' => reaction_counts_for_post($postId),
    ]);
}

function posts_like_create(int $postId): void
{
    $session = require_authenticated_session();
    require_csrf_token($session);
    $post = fetch_reactable_post_record($postId);

    if ($post === null) {
        json_error('Post not found.', 404);
    }

    $insert = db_query(
        'INSERT IGNORE INTO post_reactions (post_id, user_id, type)
         VALUES (:post_id, :user_id, :type)',
        [
            'post_id' => $postId,
            'user_id' => (int) $session['user_id'],
            'type' => like_reaction_type(),
        ]
    );

    if ($insert->rowCount() > 0) {
        notification_create(
            (int) $post['author_id'],
            (int) $session['user_id'],
            'like',
            $postId,
            $post['room_id'] === null ? null : (int) $post['room_id'],
            null,
            true
        );
    }

    json_success(like_payload_for_post($postId, (int) $session['user_id']));
}

function posts_reblog_create(int $postId): void
{
    $session = require_authenticated_session();
    require_csrf_token($session);
    require_reblogs_table();
    $post = fetch_reactable_post_record($postId);

    if ($post === null) {
        json_error('Post not found.', 404);
    }

    $actorId = (int) $session['user_id'];
    $postAuthorId = (int) $post['author_id'];

    if ($postAuthorId === $actorId) {
        json_error('You cannot reblog your own post.', 409);
    }

    $insert = db_query(
        'INSERT IGNORE INTO post_reblogs (post_id, user_id)
         VALUES (:post_id, :user_id)',
        [
            'post_id' => $postId,
            'user_id' => $actorId,
        ]
    );

    if ($insert->rowCount() > 0) {
        notification_create(
            $postAuthorId,
            $actorId,
            'reblog',
            $postId,
            $post['room_id'] === null ? null : (int) $post['room_id'],
            null,
            true
        );
    }

    json_success(reblog_payload_for_post($postId, $actorId));
}

function posts_reblog_delete(int $postId): void
{
    $session = require_authenticated_session();
    require_csrf_token($session);
    require_reblogs_table();
    require_reactable_post($postId);

    $actorId = (int) $session['user_id'];

    db_query(
        'DELETE FROM post_reblogs
         WHERE post_id = :post_id
           AND user_id = :user_id',
        [
            'post_id' => $postId,
            'user_id' => $actorId,
        ]
    );

    json_success(reblog_payload_for_post($postId, $actorId));
}

function posts_reaction_delete(int $postId, string $rawType): void
{
    $session = require_authenticated_session();
    require_csrf_token($session);
    require_reactable_post($postId);

    $type = validate_reaction_type(rawurldecode($rawType));

    db_query(
        'DELETE FROM post_reactions
         WHERE post_id = :post_id
           AND user_id = :user_id
           AND type = :type',
        [
            'post_id' => $postId,
            'user_id' => (int) $session['user_id'],
            'type' => $type,
        ]
    );

    json_success([
        'postId' => $postId,
        'reactions' => reaction_counts_for_post($postId),
    ]);
}

function posts_like_delete(int $postId): void
{
    $session = require_authenticated_session();
    require_csrf_token($session);
    require_reactable_post($postId);

    db_query(
        'DELETE FROM post_reactions
         WHERE post_id = :post_id
           AND user_id = :user_id
           AND type = :type',
        [
            'post_id' => $postId,
            'user_id' => (int) $session['user_id'],
            'type' => like_reaction_type(),
        ]
    );

    json_success(like_payload_for_post($postId, (int) $session['user_id']));
}

function validate_post_media_url(mixed $value): ?string
{
    if ($value === null) {
        return null;
    }

    if (!is_string($value)) {
        json_error('Post image is invalid.', 422);
    }

    $trimmed = trim($value);

    if ($trimmed === '') {
        return null;
    }

    if (strlen($trimmed) > 255) {
        json_error('Post image URL is too long.', 422);
    }

    if (preg_match('#^/uploads/media/[0-9]{4}/[0-9]{2}/[a-z0-9_-]+\.(?:jpe?g|png|webp|gif)$#', $trimmed) !== 1) {
        json_error('Use Upload image to attach an image.', 422);
    }

    return $trimmed;
}

function reblog_payload_for_post(int $postId, int $userId): array
{
    $row = db_query(
        'SELECT
            COUNT(*) AS reblog_count,
            EXISTS (
                SELECT 1
                FROM post_reblogs current_reblog
                WHERE current_reblog.post_id = :current_post_id
                  AND current_reblog.user_id = :current_user_id
            ) AS reblogged_by_me
         FROM post_reblogs
         WHERE post_id = :post_id',
        [
            'current_post_id' => $postId,
            'current_user_id' => $userId,
            'post_id' => $postId,
        ]
    )->fetch();
    $reblogCount = is_array($row) ? (int) $row['reblog_count'] : 0;
    $rebloggedByMe = is_array($row) && (bool) $row['reblogged_by_me'];

    return [
        'postId' => $postId,
        'reblogCount' => $reblogCount,
        'rebloggedByMe' => $rebloggedByMe,
        'rebloggedByCurrentUser' => $rebloggedByMe,
    ];
}

function require_reblogs_table(): void
{
    if (!post_reblogs_table_exists()) {
        json_error('Reblog storage is not ready. Run pending migrations.', 503);
    }
}

function validate_post_body(mixed $value): string
{
    if (!is_string($value)) {
        json_error('Post body is required.', 422);
    }

    $body = trim($value);
    $length = text_length($body);

    if ($length < 1 || $length > 2000) {
        json_error('Post body must be between 1 and 2000 characters.', 422);
    }

    return $body;
}

function validate_optional_text(mixed $value, int $maxLength, string $label): ?string
{
    if ($value === null || $value === '') {
        return null;
    }

    if (!is_string($value)) {
        json_error($label . ' must be text.', 422);
    }

    $text = trim($value);

    if ($text === '') {
        return null;
    }

    if (text_length($text) > $maxLength) {
        json_error($label . ' is too long.', 422);
    }

    return $text;
}

function validate_post_status(mixed $value): string
{
    if (!is_string($value) || !in_array($value, ['published', 'hidden', 'removed'], true)) {
        json_error('Post status must be published, hidden, or removed.', 422);
    }

    return $value;
}

function validate_reaction_type(mixed $value): string
{
    $allowedTypes = ['glow', 'echo', 'hush'];

    if (!is_string($value) || !in_array($value, $allowedTypes, true)) {
        json_error('Reaction type must be glow, echo, or hush.', 422);
    }

    return $value;
}

function resolve_room_id(array $body): ?int
{
    if (array_key_exists('roomId', $body) || array_key_exists('room_id', $body)) {
        $roomId = $body['roomId'] ?? $body['room_id'];

        if (!is_int($roomId) && !(is_string($roomId) && preg_match('/^\d+$/', $roomId) === 1)) {
            json_error('Room id must be numeric.', 422);
        }

        return require_room_id((int) $roomId);
    }

    if (array_key_exists('roomSlug', $body) || array_key_exists('room_slug', $body)) {
        $roomSlug = $body['roomSlug'] ?? $body['room_slug'];

        if (!is_string($roomSlug)) {
            json_error('Room slug must be text.', 422);
        }

        return require_room_slug($roomSlug);
    }

    return null;
}

function require_room_id(int $roomId): int
{
    $statement = db_query(
        "SELECT id
         FROM rooms
         WHERE id = :id
           AND visibility = 'public'
           " . room_not_deleted_sql('rooms') . "
         LIMIT 1",
        ['id' => $roomId]
    );

    if (!$statement->fetch()) {
        json_error('Room not found.', 422);
    }

    return $roomId;
}

function require_room_slug(string $roomSlug): int
{
    $slug = normalize_slug($roomSlug);
    $statement = db_query(
        "SELECT id
         FROM rooms
         WHERE slug = :slug
           AND visibility = 'public'
           " . room_not_deleted_sql('rooms') . "
         LIMIT 1",
        ['slug' => $slug]
    );
    $room = $statement->fetch();

    if (!is_array($room)) {
        json_error('Room not found.', 422);
    }

    return (int) $room['id'];
}

function resolve_parent_id(mixed $value): ?int
{
    if ($value === null || $value === '') {
        return null;
    }

    if (!is_int($value) && !(is_string($value) && preg_match('/^\d+$/', $value) === 1)) {
        json_error('Parent id must be numeric.', 422);
    }

    $parentId = (int) $value;
    $statement = db_query(
        "SELECT id
         FROM posts p
         LEFT JOIN rooms r ON r.id = p.room_id
         " . post_ancestor_visibility_joins_sql('p') . "
         WHERE p.id = :id
           AND " . public_post_visible_sql('p', 'r') . "
           AND " . post_ancestor_visibility_sql('p') . "
         LIMIT 1",
        ['id' => $parentId]
    );

    if (!$statement->fetch()) {
        json_error('Parent post not found.', 422);
    }

    return $parentId;
}

function fetch_post_record(int $postId): ?array
{
    $statement = db_query(
        'SELECT id, author_id, room_id, parent_id, status
         FROM posts
         WHERE id = :id
         LIMIT 1',
        ['id' => $postId]
    );
    $post = $statement->fetch();

    return is_array($post) ? $post : null;
}

function require_reactable_post(int $postId): void
{
    if (fetch_reactable_post_record($postId) === null) {
        json_error('Post not found.', 404);
    }
}

function fetch_reactable_post_record(int $postId): ?array
{
    $statement = db_query(
        "SELECT p.id,
            p.author_id,
            p.room_id
         FROM posts p
         LEFT JOIN rooms r ON r.id = p.room_id
         " . post_ancestor_visibility_joins_sql('p') . "
         WHERE p.id = :id
           AND " . public_post_visible_sql('p', 'r') . "
           AND " . post_ancestor_visibility_sql('p') . "
         LIMIT 1",
        ['id' => $postId]
    );
    $post = $statement->fetch();

    return is_array($post) ? $post : null;
}

function fetch_replyable_post_record(int $postId): ?array
{
    $statement = db_query(
        "SELECT p.id, p.author_id, p.room_id, p.mood
         FROM posts p
         LEFT JOIN rooms r ON r.id = p.room_id
         " . post_ancestor_visibility_joins_sql('p') . "
         WHERE p.id = :id
           AND " . public_post_visible_sql('p', 'r') . "
           AND " . post_ancestor_visibility_sql('p') . "
         LIMIT 1",
        ['id' => $postId]
    );
    $post = $statement->fetch();

    return is_array($post) ? $post : null;
}

function reaction_counts_for_post(int $postId): array
{
    $statement = db_query(
        "SELECT
            COALESCE(SUM(type = 'glow'), 0) AS glow_count,
            COALESCE(SUM(type = 'echo'), 0) AS echo_count,
            COALESCE(SUM(type = 'hush'), 0) AS hush_count
         FROM post_reactions
         WHERE post_id = :post_id",
        ['post_id' => $postId]
    );
    $counts = $statement->fetch();

    return [
        'glow' => is_array($counts) ? (int) $counts['glow_count'] : 0,
        'echo' => is_array($counts) ? (int) $counts['echo_count'] : 0,
        'hush' => is_array($counts) ? (int) $counts['hush_count'] : 0,
    ];
}

function like_reaction_type(): string
{
    return 'glow';
}

function like_payload_for_post(int $postId, int $userId): array
{
    $statement = db_query(
        "SELECT
            COUNT(*) AS like_count,
            COALESCE(SUM(user_id = :liked_user_id), 0) AS liked_by_current_user
         FROM post_reactions
         WHERE post_id = :post_id
           AND type = :type",
        [
            'liked_user_id' => $userId,
            'post_id' => $postId,
            'type' => like_reaction_type(),
        ]
    );
    $row = $statement->fetch();

    return [
        'postId' => $postId,
        'likeCount' => is_array($row) ? (int) $row['like_count'] : 0,
        'likedByCurrentUser' => is_array($row) && (int) $row['liked_by_current_user'] > 0,
    ];
}

function fetch_post_payload_by_id(int $postId, ?int $currentUserId = null): array
{
    $statement = db_query(
        post_payload_select_sql('p.id = :id'),
        [
            'id' => $postId,
            'current_user_id' => $currentUserId,
        ]
    );
    $row = $statement->fetch();

    if (!is_array($row)) {
        json_error('Post not found.', 404);
    }

    return post_payload($row);
}

function post_payload_select_sql(string $whereClause, string $tailClause = 'LIMIT 1'): string
{
    $publicIdSelect = posts_public_id_column_exists()
        ? 'p.public_id AS post_public_id,'
        : 'NULL AS post_public_id,';

    return "SELECT
        p.id AS post_id,
        {$publicIdSelect}
        p.parent_id AS post_parent_id,
        p.body AS post_body,
        p.mood AS post_mood,
        p.media_url AS post_media_url,
        p.visibility AS post_visibility,
        p.status AS post_status,
        p.deleted_at AS post_deleted_at,
        p.created_at AS post_created_at,
        p.updated_at AS post_updated_at,
        u.id AS user_id,
        u.handle,
        pr.display_name,
        pr.bio,
        pr.location,
        pr.avatar_url,
        pr.links,
        pr.traits,
        pr.created_at AS profile_created_at,
        pr.updated_at AS profile_updated_at,
        COALESCE(profile_posts.post_count, 0) AS post_count,
        COALESCE(profile_rooms.room_count, 0) AS room_count,
        COALESCE(profile_likes.like_count, 0) AS profile_like_count,
        COALESCE(profile_stars.star_count, 0) AS star_count,
        r.id AS room_id,
        r.slug AS room_slug,
        r.name AS room_name,
        r.summary AS room_summary,
        r.mood AS room_mood,
        r.member_count AS room_member_count,
        r.is_live AS room_is_live,
        r.accent AS room_accent,
        r.visibility AS room_visibility,
        r.created_at AS room_created_at,
        r.updated_at AS room_updated_at,
        COALESCE(reactions.glow_count, 0) AS reaction_glow_count,
        COALESCE(reactions.echo_count, 0) AS reaction_echo_count,
        COALESCE(reactions.hush_count, 0) AS reaction_hush_count,
        COALESCE(replies.reply_count, 0) AS reply_count,
        current_like.user_id AS current_like_user_id
    FROM posts p
    INNER JOIN users u ON u.id = p.author_id
    INNER JOIN profiles pr ON pr.user_id = u.id
    LEFT JOIN rooms r ON r.id = p.room_id
    " . post_ancestor_visibility_joins_sql('p') . "
    LEFT JOIN (
        SELECT author_id, COUNT(*) AS post_count
        FROM posts profile_posts
        LEFT JOIN rooms profile_post_rooms ON profile_post_rooms.id = profile_posts.room_id
        WHERE profile_posts.visibility = 'public'
          AND profile_posts.parent_id IS NULL
          AND profile_posts.status = 'published'
          AND profile_posts.deleted_at IS NULL
          AND (
            profile_posts.room_id IS NULL
            OR (profile_post_rooms.visibility = 'public' " . room_not_deleted_sql('profile_post_rooms') . ")
          )
        GROUP BY author_id
    ) profile_posts ON profile_posts.author_id = u.id
    LEFT JOIN (
        SELECT created_by, COUNT(*) AS room_count
        FROM rooms
        WHERE visibility = 'public'
          " . room_not_deleted_sql('rooms') . "
        GROUP BY created_by
    ) profile_rooms ON profile_rooms.created_by = u.id
    LEFT JOIN (
        " . profile_received_likes_aggregate_sql() . "
    ) profile_likes ON profile_likes.author_id = u.id
    LEFT JOIN (
        " . profile_stars_aggregate_sql() . "
    ) profile_stars ON profile_stars.starred_user_id = u.id
    LEFT JOIN (
        SELECT
            post_id,
            SUM(type = 'glow') AS glow_count,
            SUM(type = 'echo') AS echo_count,
            SUM(type = 'hush') AS hush_count
        FROM post_reactions
        GROUP BY post_id
    ) reactions ON reactions.post_id = p.id
    LEFT JOIN (
        SELECT reply_posts.parent_id, COUNT(*) AS reply_count
        FROM posts reply_posts
        LEFT JOIN rooms reply_rooms ON reply_rooms.id = reply_posts.room_id
        " . post_ancestor_visibility_joins_sql('reply_posts') . "
        WHERE reply_posts.parent_id IS NOT NULL
          AND " . public_post_visible_sql('reply_posts', 'reply_rooms') . "
          AND " . post_ancestor_visibility_sql('reply_posts') . "
        GROUP BY reply_posts.parent_id
    ) replies ON replies.parent_id = p.id
    LEFT JOIN post_reactions current_like
        ON current_like.post_id = p.id
       AND current_like.user_id = :current_user_id
       AND current_like.type = 'glow'
    WHERE {$whereClause}
      AND " . post_ancestor_visibility_sql('p') . "
    {$tailClause}";
}

function is_moderator_session(array $session): bool
{
    return in_array((string) $session['role'], ['moderator', 'admin'], true);
}
