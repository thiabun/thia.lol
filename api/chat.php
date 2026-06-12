<?php

declare(strict_types=1);

require_once __DIR__ . '/auth.php';
require_once __DIR__ . '/notifications.php';
require_once __DIR__ . '/read.php';

const CHAT_MESSAGE_MAX_LENGTH = 2000;

function chat_dispatch(array $segments, string $method): void
{
    if (($segments[0] ?? null) !== 'chat') {
        json_error('Not found.', 404);
    }

    if (count($segments) === 2 && $segments[1] === 'conversations') {
        if ($method === 'GET' || $method === 'HEAD') {
            chat_conversations_index();
        }

        if ($method === 'POST') {
            chat_conversations_create();
        }

        json_error('Method not allowed.', 405);
    }

    if (count($segments) === 2 && $segments[1] === 'moots') {
        if ($method === 'GET' || $method === 'HEAD') {
            chat_moots_index();
        }

        json_error('Method not allowed.', 405);
    }

    if (
        count($segments) === 4 &&
        $segments[1] === 'conversations' &&
        preg_match('/^\d+$/', $segments[2]) === 1 &&
        $segments[3] === 'messages'
    ) {
        if ($method === 'GET' || $method === 'HEAD') {
            chat_messages_index((int) $segments[2]);
        }

        if ($method === 'POST') {
            chat_messages_create((int) $segments[2]);
        }

        json_error('Method not allowed.', 405);
    }

    if (
        count($segments) === 4 &&
        $segments[1] === 'conversations' &&
        preg_match('/^\d+$/', $segments[2]) === 1 &&
        $segments[3] === 'read' &&
        $method === 'POST'
    ) {
        chat_conversation_read((int) $segments[2]);
    }

    json_error('Not found.', 404);
}

function chat_conversations_index(): void
{
    $session = require_authenticated_session();
    require_chat_tables();

    $viewerUserId = (int) $session['user_id'];
    $statement = db_query(
        "SELECT
            c.id,
            c.type,
            c.created_at,
            c.updated_at,
            c.last_message_at,
            viewer_member.last_read_at,
            viewer_member.muted_at,
            viewer_member.archived_at,
            other_user.id AS other_user_id,
            other_user.handle AS other_handle,
            other_profile.display_name AS other_display_name,
            other_profile.avatar_url AS other_avatar_url,
            last_message.id AS last_message_id,
            last_message.body AS last_message_body,
            last_message.created_at AS last_message_created_at,
            last_sender.id AS last_sender_user_id,
            last_sender.handle AS last_sender_handle,
            last_sender_profile.display_name AS last_sender_display_name,
            last_sender_profile.avatar_url AS last_sender_avatar_url,
            (
                SELECT COUNT(*)
                FROM messages unread_messages
                WHERE unread_messages.conversation_id = c.id
                  AND unread_messages.sender_id <> :viewer_user_id_unread
                  AND unread_messages.deleted_at IS NULL
                  AND (
                    viewer_member.last_read_at IS NULL
                    OR unread_messages.created_at > viewer_member.last_read_at
                  )
            ) AS unread_count
         FROM conversation_members viewer_member
         INNER JOIN conversations c ON c.id = viewer_member.conversation_id
         INNER JOIN conversation_members other_member
            ON other_member.conversation_id = c.id
           AND other_member.user_id <> viewer_member.user_id
         INNER JOIN users other_user ON other_user.id = other_member.user_id
         INNER JOIN profiles other_profile ON other_profile.user_id = other_user.id
         LEFT JOIN messages last_message
            ON last_message.id = (
                SELECT newest_message.id
                FROM messages newest_message
                WHERE newest_message.conversation_id = c.id
                  AND newest_message.deleted_at IS NULL
                ORDER BY newest_message.created_at DESC, newest_message.id DESC
                LIMIT 1
            )
         LEFT JOIN users last_sender ON last_sender.id = last_message.sender_id
         LEFT JOIN profiles last_sender_profile ON last_sender_profile.user_id = last_sender.id
         WHERE viewer_member.user_id = :viewer_user_id
           AND c.type = 'direct'
           AND other_user.status = 'active'
         ORDER BY COALESCE(c.last_message_at, c.created_at) DESC, c.id DESC
         LIMIT 100",
        [
            'viewer_user_id' => $viewerUserId,
            'viewer_user_id_unread' => $viewerUserId,
        ]
    );

    json_success(array_map('chat_conversation_payload', $statement->fetchAll()));
}

function chat_moots_index(): void
{
    $session = require_authenticated_session();
    require_chat_follows_table();

    $viewerUserId = (int) $session['user_id'];
    $blockFilter = chat_blocked_pair_filter_sql($viewerUserId, 'u.id');
    $statement = db_query(
        "SELECT
            u.id AS user_id,
            u.handle,
            p.display_name,
            p.avatar_url,
            mine.created_at AS followed_at,
            reciprocal.created_at AS followed_by_at
         FROM user_follows mine
         INNER JOIN user_follows reciprocal
            ON reciprocal.follower_id = mine.following_id
           AND reciprocal.following_id = mine.follower_id
         INNER JOIN users u ON u.id = mine.following_id
         INNER JOIN profiles p ON p.user_id = u.id
         WHERE mine.follower_id = :viewer_user_id
           AND u.status = 'active'
           {$blockFilter}
         ORDER BY p.display_name ASC, u.handle ASC
         LIMIT 100",
        ['viewer_user_id' => $viewerUserId]
    );

    json_success(array_map(
        static fn (array $row): array => user_payload($row),
        $statement->fetchAll()
    ));
}

function chat_conversations_create(): void
{
    $session = require_authenticated_session();
    require_csrf_token($session);
    require_chat_tables();
    require_chat_follows_table();

    $body = request_json_body();
    $viewerUserId = (int) $session['user_id'];
    $target = chat_target_user_from_body($body);
    $targetUserId = (int) $target['user_id'];

    if ($viewerUserId === $targetUserId) {
        json_error('Choose another member to message.', 422);
    }

    reject_blocked_chat($viewerUserId, $targetUserId);

    if (!chat_users_are_moots($viewerUserId, $targetUserId)) {
        json_error('Follow each other to chat.', 403);
    }

    $conversationId = chat_find_or_create_direct_conversation($viewerUserId, $targetUserId);

    json_success(chat_fetch_conversation_for_user($conversationId, $viewerUserId), 201);
}

function chat_messages_index(int $conversationId): void
{
    $session = require_authenticated_session();
    require_chat_tables();
    $viewerUserId = (int) $session['user_id'];
    $conversation = chat_fetch_conversation_for_user($conversationId, $viewerUserId);

    $statement = db_query(
        "SELECT
            m.id,
            m.conversation_id,
            m.sender_id AS sender_user_id,
            m.body,
            m.deleted_at,
            m.created_at,
            sender.handle AS sender_handle,
            sender_profile.display_name AS sender_display_name,
            sender_profile.avatar_url AS sender_avatar_url
         FROM messages m
         INNER JOIN users sender ON sender.id = m.sender_id
         INNER JOIN profiles sender_profile ON sender_profile.user_id = sender.id
         WHERE m.conversation_id = :conversation_id
         ORDER BY m.created_at ASC, m.id ASC
         LIMIT 100",
        ['conversation_id' => $conversationId]
    );

    json_success([
        'conversation' => $conversation,
        'messages' => array_map('chat_message_payload', $statement->fetchAll()),
    ]);
}

function chat_messages_create(int $conversationId): void
{
    $session = require_authenticated_session();
    require_csrf_token($session);
    require_chat_tables();

    $viewerUserId = (int) $session['user_id'];
    $conversation = chat_fetch_conversation_for_user($conversationId, $viewerUserId);
    reject_blocked_chat($viewerUserId, (int) $conversation['otherParticipant']['id']);

    $body = request_json_body();
    $messageBody = chat_message_body_from_request($body);

    $pdo = db();
    $pdo->beginTransaction();

    try {
        $insert = $pdo->prepare(
            'INSERT INTO messages (conversation_id, sender_id, body)
             VALUES (:conversation_id, :sender_id, :body)'
        );
        $insert->execute([
            'conversation_id' => $conversationId,
            'sender_id' => $viewerUserId,
            'body' => $messageBody,
        ]);

        $messageId = (int) $pdo->lastInsertId();

        $updateConversation = $pdo->prepare(
            'UPDATE conversations
             SET last_message_at = CURRENT_TIMESTAMP,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = :conversation_id'
        );
        $updateConversation->execute(['conversation_id' => $conversationId]);

        $updateRead = $pdo->prepare(
            'UPDATE conversation_members
             SET last_read_at = CURRENT_TIMESTAMP
             WHERE conversation_id = :conversation_id
               AND user_id = :user_id'
        );
        $updateRead->execute([
            'conversation_id' => $conversationId,
            'user_id' => $viewerUserId,
        ]);

        $pdo->commit();
    } catch (Throwable $exception) {
        $pdo->rollBack();
        throw $exception;
    }

    foreach (chat_conversation_recipient_ids($conversationId, $viewerUserId) as $recipientId) {
        notification_create(
            $recipientId,
            $viewerUserId,
            'message',
            null,
            null,
            [
                'conversationId' => $conversationId,
                'messageId' => $messageId,
            ],
            false
        );
    }

    json_success(chat_fetch_message($messageId), 201);
}

function chat_conversation_read(int $conversationId): void
{
    $session = require_authenticated_session();
    require_csrf_token($session);
    require_chat_tables();
    $viewerUserId = (int) $session['user_id'];
    chat_fetch_conversation_for_user($conversationId, $viewerUserId);

    $readAt = current_database_timestamp();
    db_query(
        'UPDATE conversation_members
         SET last_read_at = :read_at
         WHERE conversation_id = :conversation_id
           AND user_id = :user_id',
        [
            'read_at' => $readAt,
            'conversation_id' => $conversationId,
            'user_id' => $viewerUserId,
        ]
    );

    json_success([
        'conversationId' => $conversationId,
        'readAt' => $readAt,
    ]);
}

function chat_target_user_from_body(array $body): array
{
    $targetUserId = null;

    if (isset($body['targetUserId'])) {
        if (!is_int($body['targetUserId']) && !(is_string($body['targetUserId']) && preg_match('/^\d+$/', $body['targetUserId']) === 1)) {
            json_error('Target user id must be numeric.', 422);
        }

        $targetUserId = (int) $body['targetUserId'];
    }

    $targetHandle = null;

    foreach (['targetHandle', 'handle'] as $key) {
        if (isset($body[$key]) && is_string($body[$key]) && trim($body[$key]) !== '') {
            $targetHandle = normalize_handle($body[$key]);
            break;
        }
    }

    if ($targetUserId === null && $targetHandle === null) {
        json_error('Choose someone to message.', 422);
    }

    if ($targetUserId !== null) {
        $statement = db_query(
            "SELECT
                u.id AS user_id,
                u.handle,
                u.status AS user_status,
                p.display_name,
                p.avatar_url
             FROM users u
             INNER JOIN profiles p ON p.user_id = u.id
             WHERE u.id = :user_id
             LIMIT 1",
            ['user_id' => $targetUserId]
        );
        $target = $statement->fetch();
    } else {
        $target = fetch_profile_by_handle($targetHandle);
    }

    if (!is_array($target) || (string) ($target['user_status'] ?? 'active') !== 'active') {
        json_error('Profile not found.', 404);
    }

    return $target;
}

function chat_find_or_create_direct_conversation(int $viewerUserId, int $targetUserId): int
{
    [$firstUserId, $secondUserId] = chat_ordered_direct_pair($viewerUserId, $targetUserId);

    $pdo = db();
    $pdo->beginTransaction();

    try {
        $insertConversation = $pdo->prepare(
            "INSERT IGNORE INTO conversations (type, direct_user_one_id, direct_user_two_id)
             VALUES ('direct', :first_user_id, :second_user_id)"
        );
        $insertConversation->execute([
            'first_user_id' => $firstUserId,
            'second_user_id' => $secondUserId,
        ]);

        $selectConversation = $pdo->prepare(
            "SELECT id
             FROM conversations
             WHERE type = 'direct'
               AND direct_user_one_id = :first_user_id
               AND direct_user_two_id = :second_user_id
             LIMIT 1"
        );
        $selectConversation->execute([
            'first_user_id' => $firstUserId,
            'second_user_id' => $secondUserId,
        ]);
        $conversation = $selectConversation->fetch();

        if (!is_array($conversation)) {
            throw new RuntimeException('Direct conversation could not be created.');
        }

        $conversationId = (int) $conversation['id'];
        $insertMember = $pdo->prepare(
            'INSERT IGNORE INTO conversation_members (conversation_id, user_id)
             VALUES (:conversation_id, :user_id)'
        );

        foreach ([$viewerUserId, $targetUserId] as $userId) {
            $insertMember->execute([
                'conversation_id' => $conversationId,
                'user_id' => $userId,
            ]);
        }

        $pdo->commit();
    } catch (Throwable $exception) {
        $pdo->rollBack();
        throw $exception;
    }

    return $conversationId;
}

function chat_fetch_conversation_for_user(int $conversationId, int $viewerUserId): array
{
    $statement = db_query(
        "SELECT
            c.id,
            c.type,
            c.created_at,
            c.updated_at,
            c.last_message_at,
            viewer_member.last_read_at,
            viewer_member.muted_at,
            viewer_member.archived_at,
            other_user.id AS other_user_id,
            other_user.handle AS other_handle,
            other_profile.display_name AS other_display_name,
            other_profile.avatar_url AS other_avatar_url,
            last_message.id AS last_message_id,
            last_message.body AS last_message_body,
            last_message.created_at AS last_message_created_at,
            last_sender.id AS last_sender_user_id,
            last_sender.handle AS last_sender_handle,
            last_sender_profile.display_name AS last_sender_display_name,
            last_sender_profile.avatar_url AS last_sender_avatar_url,
            (
                SELECT COUNT(*)
                FROM messages unread_messages
                WHERE unread_messages.conversation_id = c.id
                  AND unread_messages.sender_id <> :viewer_user_id_unread
                  AND unread_messages.deleted_at IS NULL
                  AND (
                    viewer_member.last_read_at IS NULL
                    OR unread_messages.created_at > viewer_member.last_read_at
                  )
            ) AS unread_count
         FROM conversation_members viewer_member
         INNER JOIN conversations c ON c.id = viewer_member.conversation_id
         INNER JOIN conversation_members other_member
            ON other_member.conversation_id = c.id
           AND other_member.user_id <> viewer_member.user_id
         INNER JOIN users other_user ON other_user.id = other_member.user_id
         INNER JOIN profiles other_profile ON other_profile.user_id = other_user.id
         LEFT JOIN messages last_message
            ON last_message.id = (
                SELECT newest_message.id
                FROM messages newest_message
                WHERE newest_message.conversation_id = c.id
                  AND newest_message.deleted_at IS NULL
                ORDER BY newest_message.created_at DESC, newest_message.id DESC
                LIMIT 1
            )
         LEFT JOIN users last_sender ON last_sender.id = last_message.sender_id
         LEFT JOIN profiles last_sender_profile ON last_sender_profile.user_id = last_sender.id
         WHERE viewer_member.user_id = :viewer_user_id
           AND c.id = :conversation_id
           AND c.type = 'direct'
         LIMIT 1",
        [
            'conversation_id' => $conversationId,
            'viewer_user_id' => $viewerUserId,
            'viewer_user_id_unread' => $viewerUserId,
        ]
    );

    $conversation = $statement->fetch();

    if (!is_array($conversation)) {
        json_error('Conversation not found.', 404);
    }

    return chat_conversation_payload($conversation);
}

function chat_fetch_message(int $messageId): array
{
    $statement = db_query(
        "SELECT
            m.id,
            m.conversation_id,
            m.sender_id AS sender_user_id,
            m.body,
            m.deleted_at,
            m.created_at,
            sender.handle AS sender_handle,
            sender_profile.display_name AS sender_display_name,
            sender_profile.avatar_url AS sender_avatar_url
         FROM messages m
         INNER JOIN users sender ON sender.id = m.sender_id
         INNER JOIN profiles sender_profile ON sender_profile.user_id = sender.id
         WHERE m.id = :message_id
         LIMIT 1",
        ['message_id' => $messageId]
    );

    $message = $statement->fetch();

    if (!is_array($message)) {
        json_error('Message not found.', 404);
    }

    return chat_message_payload($message);
}

function chat_message_body_from_request(array $body): string
{
    if (!isset($body['body']) || !is_string($body['body'])) {
        json_error('Message body is required.', 422);
    }

    $messageBody = trim($body['body']);

    if ($messageBody === '') {
        json_error('Message body is required.', 422);
    }

    if (strlen($messageBody) > CHAT_MESSAGE_MAX_LENGTH) {
        json_error('Message body must be 2000 characters or fewer.', 422);
    }

    return $messageBody;
}

function chat_conversation_recipient_ids(int $conversationId, int $senderUserId): array
{
    $statement = db_query(
        'SELECT user_id
         FROM conversation_members
         WHERE conversation_id = :conversation_id
           AND user_id <> :sender_user_id',
        [
            'conversation_id' => $conversationId,
            'sender_user_id' => $senderUserId,
        ]
    );

    return array_map(static fn (array $row): int => (int) $row['user_id'], $statement->fetchAll());
}

function chat_users_are_moots(int $firstUserId, int $secondUserId): bool
{
    $statement = db_query(
        'SELECT
            EXISTS (
                SELECT 1
                FROM user_follows
                WHERE follower_id = :first_user_id
                  AND following_id = :second_user_id
            ) AS first_follows_second,
            EXISTS (
                SELECT 1
                FROM user_follows
                WHERE follower_id = :second_user_id_again
                  AND following_id = :first_user_id_again
            ) AS second_follows_first',
        [
            'first_user_id' => $firstUserId,
            'second_user_id' => $secondUserId,
            'second_user_id_again' => $secondUserId,
            'first_user_id_again' => $firstUserId,
        ]
    );

    $row = $statement->fetch();

    return is_array($row) &&
        (bool) ($row['first_follows_second'] ?? false) &&
        (bool) ($row['second_follows_first'] ?? false);
}

function reject_blocked_chat(int $viewerUserId, int $targetUserId): void
{
    $state = chat_pair_block_state($viewerUserId, $targetUserId);

    if ($state['viewerBlocksTarget']) {
        json_error('Unblock this member before messaging.', 409);
    }

    if ($state['targetBlocksViewer']) {
        json_error('You cannot message this member.', 403);
    }
}

function chat_pair_block_state(int $viewerUserId, int $targetUserId): array
{
    $state = [
        'viewerBlocksTarget' => false,
        'targetBlocksViewer' => false,
    ];

    if (!user_blocks_table_exists()) {
        return $state;
    }

    $row = db_query(
        'SELECT
            EXISTS (
                SELECT 1
                FROM user_blocks
                WHERE blocker_id = :viewer_user_id
                  AND blocked_id = :target_user_id
            ) AS viewer_blocks_target,
            EXISTS (
                SELECT 1
                FROM user_blocks
                WHERE blocker_id = :target_user_id_again
                  AND blocked_id = :viewer_user_id_again
            ) AS target_blocks_viewer',
        [
            'viewer_user_id' => $viewerUserId,
            'target_user_id' => $targetUserId,
            'target_user_id_again' => $targetUserId,
            'viewer_user_id_again' => $viewerUserId,
        ]
    )->fetch();

    if (!is_array($row)) {
        return $state;
    }

    return [
        'viewerBlocksTarget' => (bool) ($row['viewer_blocks_target'] ?? false),
        'targetBlocksViewer' => (bool) ($row['target_blocks_viewer'] ?? false),
    ];
}

function chat_blocked_pair_filter_sql(int $viewerUserId, string $targetUserSql): string
{
    if (!user_blocks_table_exists()) {
        return '';
    }

    $viewerSql = (string) $viewerUserId;

    return " AND NOT EXISTS (
        SELECT 1
        FROM user_blocks chat_pair_blocks
        WHERE (chat_pair_blocks.blocker_id = {$viewerSql} AND chat_pair_blocks.blocked_id = {$targetUserSql})
           OR (chat_pair_blocks.blocker_id = {$targetUserSql} AND chat_pair_blocks.blocked_id = {$viewerSql})
    )";
}

function chat_ordered_direct_pair(int $firstUserId, int $secondUserId): array
{
    return $firstUserId < $secondUserId
        ? [$firstUserId, $secondUserId]
        : [$secondUserId, $firstUserId];
}

function chat_conversation_payload(array $row): array
{
    $lastMessage = null;

    if (($row['last_message_id'] ?? null) !== null) {
        $lastMessage = [
            'id' => (int) $row['last_message_id'],
            'body' => (string) ($row['last_message_body'] ?? ''),
            'createdAt' => $row['last_message_created_at'],
            'sender' => chat_user_payload($row, 'last_sender'),
        ];
    }

    return [
        'id' => (int) $row['id'],
        'type' => (string) $row['type'],
        'createdAt' => $row['created_at'],
        'updatedAt' => $row['updated_at'] ?? null,
        'lastMessageAt' => $row['last_message_at'] ?? null,
        'lastReadAt' => $row['last_read_at'] ?? null,
        'mutedAt' => $row['muted_at'] ?? null,
        'archivedAt' => $row['archived_at'] ?? null,
        'unreadCount' => (int) ($row['unread_count'] ?? 0),
        'otherParticipant' => chat_user_payload($row, 'other'),
        'lastMessage' => $lastMessage,
    ];
}

function chat_message_payload(array $row): array
{
    return [
        'id' => (int) $row['id'],
        'conversationId' => (int) $row['conversation_id'],
        'body' => $row['deleted_at'] === null ? (string) $row['body'] : '',
        'deletedAt' => $row['deleted_at'] ?? null,
        'createdAt' => $row['created_at'],
        'sender' => chat_user_payload($row, 'sender'),
    ];
}

function chat_user_payload(array $row, string $prefix): array
{
    return user_payload([
        'user_id' => $row[$prefix . '_user_id'],
        'handle' => $row[$prefix . '_handle'],
        'display_name' => $row[$prefix . '_display_name'] ?? $row[$prefix . '_handle'],
        'avatar_url' => $row[$prefix . '_avatar_url'] ?? null,
    ]);
}

function require_chat_tables(): void
{
    foreach (['conversations', 'conversation_members', 'messages'] as $tableName) {
        if (!database_table_exists($tableName)) {
            json_error('Chat storage is not ready. Run pending migrations.', 503);
        }
    }
}

function require_chat_follows_table(): void
{
    if (!database_table_exists('user_follows')) {
        json_error('Follow storage is not ready. Run pending migrations.', 503);
    }
}
