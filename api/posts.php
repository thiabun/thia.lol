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

    db_query(
        'INSERT INTO posts (author_id, room_id, parent_id, body, mood, media_url, visibility, status)
         VALUES (:author_id, :room_id, :parent_id, :body, :mood, :media_url, :visibility, :status)',
        [
            'author_id' => (int) $session['user_id'],
            'room_id' => $parent['room_id'] === null ? null : (int) $parent['room_id'],
            'parent_id' => $postId,
            'body' => $postBody,
            'mood' => $parent['mood'] ?? 'sunveil',
            'media_url' => $mediaUrl,
            'visibility' => 'public',
            'status' => 'published',
        ]
    );

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

function posts_share_card(string $postIdentifier): void
{
    $post = fetch_public_post_payload_by_identifier($postIdentifier, current_request_user_id());
    $headOnly = $_SERVER['REQUEST_METHOD'] === 'HEAD';

    if (!extension_loaded('gd') || !function_exists('imagecreatetruecolor')) {
        posts_share_card_fallback($headOnly);
    }

    posts_share_card_png_headers();

    if ($headOnly) {
        exit;
    }

    $image = imagecreatetruecolor(1200, 630);

    if (!$image) {
        posts_share_card_fallback(false);
    }

    imageantialias($image, true);
    $bg = imagecolorallocate($image, 13, 31, 41);
    $panel = imagecolorallocate($image, 22, 51, 61);
    $line = imagecolorallocate($image, 65, 126, 146);
    $text = imagecolorallocate($image, 232, 247, 248);
    $muted = imagecolorallocate($image, 158, 192, 202);
    $accent = imagecolorallocate($image, 244, 140, 173);

    imagefilledrectangle($image, 0, 0, 1200, 630, $bg);
    imagefilledrectangle($image, 44, 44, 1156, 586, $panel);
    imagerectangle($image, 44, 44, 1156, 586, $line);

    posts_share_card_draw_lockup($image);
    $hasThumbnail = posts_share_card_draw_thumbnail($image, $post);

    $fonts = posts_share_card_font_paths();
    $left = 92;
    $top = 92;
    $bodyWidth = $hasThumbnail ? 620 : 940;
    $author = (string) ($post['author']['displayName'] ?? $post['author']['handle'] ?? 'thia.lol');
    $handle = '@' . (string) ($post['author']['handle'] ?? 'profile');
    $snippet = post_body_snippet((string) ($post['body'] ?? ''), 250);
    $canonical = post_canonical_path($post);

    posts_share_card_text($image, $fonts, 38, $left, $top + 86, $text, $author);
    posts_share_card_text($image, $fonts, 22, $left, $top + 128, $muted, $handle);
    posts_share_card_wrapped_text($image, $fonts, 28, $left, $top + 190, $text, $snippet, $bodyWidth, 4);
    posts_share_card_text($image, $fonts, 18, $left, 538, $muted, $canonical);

    imagepng($image);
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
    header('Cache-Control: public, max-age=900');
    header('X-Content-Type-Options: nosniff');
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
    int $maxLines
): void {
    $words = preg_split('/\s+/', $text) ?: [];
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

    foreach (array_slice($lines, 0, $maxLines) as $index => $lineText) {
        if ($index === $maxLines - 1 && count($words) > count(preg_split('/\s+/', implode(' ', $lines)) ?: [])) {
            $lineText = rtrim($lineText, '.,;:- ') . '...';
        }

        posts_share_card_text($image, $fonts, $size, $x, $y + ($index * 42), $color, $lineText);
    }
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
        imagecopyresampled(
            $image,
            $source,
            86,
            70,
            0,
            0,
            158,
            70,
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

    if ($path === null || !function_exists('imagecreatefromwebp')) {
        return false;
    }

    $source = @imagecreatefromwebp($path);

    if (!$source) {
        return false;
    }

    $sourceWidth = imagesx($source);
    $sourceHeight = imagesy($source);
    $targetX = 770;
    $targetY = 104;
    $targetWidth = 316;
    $targetHeight = 408;
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
    imagerectangle($image, $targetX, $targetY, $targetX + $targetWidth, $targetY + $targetHeight, $line);

    return true;
}

function posts_share_card_media_path(string $mediaUrl): ?string
{
    if (preg_match('#^/uploads/media/[0-9]{4}/[0-9]{2}/[a-z0-9_-]+\.webp$#', $mediaUrl) !== 1) {
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

    if (preg_match('#^/uploads/media/[0-9]{4}/[0-9]{2}/[a-z0-9_-]+\.webp$#', $trimmed) !== 1) {
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
