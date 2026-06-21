<?php

declare(strict_types=1);

require_once __DIR__ . '/auth.php';
require_once __DIR__ . '/notifications.php';
require_once __DIR__ . '/read.php';

function follows_dispatch(array $segments, string $method): void
{
    if (count($segments) !== 3 || ($segments[0] ?? null) !== 'profiles') {
        json_error('Not found.', 404);
    }

    $handle = $segments[1];
    $action = $segments[2];

    if ($action === 'follow') {
        if ($method === 'POST') {
            profile_follow_create($handle);
        }

        if ($method === 'DELETE') {
            profile_follow_delete($handle);
        }

        json_error('Method not allowed.', 405);
    }

    if ($action === 'block') {
        if ($method === 'POST') {
            profile_block_create($handle);
        }

        if ($method === 'DELETE') {
            profile_block_delete($handle);
        }

        json_error('Method not allowed.', 405);
    }

    if ($action === 'mute') {
        if ($method === 'POST') {
            profile_mute_create($handle);
        }

        if ($method === 'DELETE') {
            profile_mute_delete($handle);
        }

        json_error('Method not allowed.', 405);
    }

    if ($action === 'star') {
        if ($method === 'POST') {
            profile_star_create($handle);
        }

        if ($method === 'DELETE') {
            profile_star_delete($handle);
        }

        json_error('Method not allowed.', 405);
    }

    if ($action === 'follower') {
        if ($method === 'DELETE') {
            profile_follower_delete($handle);
        }

        json_error('Method not allowed.', 405);
    }

    if ($action === 'followers') {
        if ($method === 'GET' || $method === 'HEAD') {
            profile_followers_index($handle);
        }

        json_error('Method not allowed.', 405);
    }

    if ($action === 'following') {
        if ($method === 'GET' || $method === 'HEAD') {
            profile_following_index($handle);
        }

        json_error('Method not allowed.', 405);
    }

    json_error('Not found.', 404);
}

function profile_follow_create(string $handle): void
{
    $session = require_authenticated_session();
    require_csrf_token($session);
    require_user_follows_table();

    $target = active_profile_for_follow($handle);
    $viewerUserId = (int) $session['user_id'];
    $targetUserId = (int) $target['user_id'];

    if ($viewerUserId === $targetUserId) {
        json_error('You cannot follow yourself.', 422);
    }

    reject_blocked_follow($viewerUserId, $targetUserId);

    $insert = db_query(
        'INSERT IGNORE INTO user_follows (follower_id, following_id)
         VALUES (:follower_id, :following_id)',
        [
            'follower_id' => $viewerUserId,
            'following_id' => $targetUserId,
        ]
    );

    if ($insert->rowCount() > 0) {
        notification_create($targetUserId, $viewerUserId, 'follow', null, null, null, true);

        if (is_mutual_follow($viewerUserId, $targetUserId)) {
            notification_create($viewerUserId, $targetUserId, 'moot', null, null, null, true);
            notification_create($targetUserId, $viewerUserId, 'moot', null, null, null, true);
        }
    }

    json_success(follow_relationship_response($targetUserId, $viewerUserId));
}

function profile_block_create(string $handle): void
{
    $session = require_authenticated_session();
    require_csrf_token($session);
    require_user_follows_table();
    require_user_blocks_table();

    $target = active_profile_for_follow($handle);
    $viewerUserId = (int) $session['user_id'];
    $targetUserId = (int) $target['user_id'];

    if ($viewerUserId === $targetUserId) {
        json_error('You cannot block yourself.', 422);
    }

    $pdo = db();
    $pdo->beginTransaction();

    try {
        $insert = $pdo->prepare(
            'INSERT IGNORE INTO user_blocks (blocker_id, blocked_id)
             VALUES (:blocker_id, :blocked_id)'
        );
        $insert->execute([
            'blocker_id' => $viewerUserId,
            'blocked_id' => $targetUserId,
        ]);

        $deleteFollows = $pdo->prepare(
            'DELETE FROM user_follows
             WHERE (follower_id = :viewer_follows_target AND following_id = :target_followed_by_viewer)
                OR (follower_id = :target_follows_viewer AND following_id = :viewer_followed_by_target)'
        );
        $deleteFollows->execute([
            'viewer_follows_target' => $viewerUserId,
            'target_followed_by_viewer' => $targetUserId,
            'target_follows_viewer' => $targetUserId,
            'viewer_followed_by_target' => $viewerUserId,
        ]);

        $pdo->commit();
    } catch (Throwable $exception) {
        $pdo->rollBack();
        throw $exception;
    }

    json_success(profile_control_response($targetUserId, $viewerUserId));
}

function profile_block_delete(string $handle): void
{
    $session = require_authenticated_session();
    require_csrf_token($session);
    require_user_blocks_table();

    $target = active_profile_for_follow($handle);
    $viewerUserId = (int) $session['user_id'];
    $targetUserId = (int) $target['user_id'];

    if ($viewerUserId === $targetUserId) {
        json_error('You cannot unblock yourself.', 422);
    }

    db_query(
        'DELETE FROM user_blocks
         WHERE blocker_id = :blocker_id
           AND blocked_id = :blocked_id',
        [
            'blocker_id' => $viewerUserId,
            'blocked_id' => $targetUserId,
        ]
    );

    json_success(profile_control_response($targetUserId, $viewerUserId));
}

function profile_mute_create(string $handle): void
{
    $session = require_authenticated_session();
    require_csrf_token($session);
    require_user_mutes_table();

    $target = active_profile_for_follow($handle);
    $viewerUserId = (int) $session['user_id'];
    $targetUserId = (int) $target['user_id'];

    if ($viewerUserId === $targetUserId) {
        json_error('You cannot mute yourself.', 422);
    }

    db_query(
        'INSERT IGNORE INTO user_mutes (muter_id, muted_id)
         VALUES (:muter_id, :muted_id)',
        [
            'muter_id' => $viewerUserId,
            'muted_id' => $targetUserId,
        ]
    );

    json_success(profile_control_response($targetUserId, $viewerUserId));
}

function profile_mute_delete(string $handle): void
{
    $session = require_authenticated_session();
    require_csrf_token($session);
    require_user_mutes_table();

    $target = active_profile_for_follow($handle);
    $viewerUserId = (int) $session['user_id'];
    $targetUserId = (int) $target['user_id'];

    if ($viewerUserId === $targetUserId) {
        json_error('You cannot unmute yourself.', 422);
    }

    db_query(
        'DELETE FROM user_mutes
         WHERE muter_id = :muter_id
           AND muted_id = :muted_id',
        [
            'muter_id' => $viewerUserId,
            'muted_id' => $targetUserId,
        ]
    );

    json_success(profile_control_response($targetUserId, $viewerUserId));
}

function profile_follower_delete(string $handle): void
{
    $session = require_authenticated_session();
    require_csrf_token($session);
    require_user_follows_table();

    $target = active_profile_for_follow($handle);
    $viewerUserId = (int) $session['user_id'];
    $targetUserId = (int) $target['user_id'];

    if ($viewerUserId === $targetUserId) {
        json_error('You cannot remove yourself as a follower.', 422);
    }

    $delete = db_query(
        'DELETE FROM user_follows
         WHERE follower_id = :target_user_id
           AND following_id = :viewer_user_id',
        [
            'target_user_id' => $targetUserId,
            'viewer_user_id' => $viewerUserId,
        ]
    );

    json_success([
        'removedFollower' => $delete->rowCount() > 0,
        'relationship' => follow_relationship_response($targetUserId, $viewerUserId),
    ]);
}

function profile_follow_delete(string $handle): void
{
    $session = require_authenticated_session();
    require_csrf_token($session);
    require_user_follows_table();

    $target = active_profile_for_follow($handle);
    $viewerUserId = (int) $session['user_id'];
    $targetUserId = (int) $target['user_id'];

    if ($viewerUserId === $targetUserId) {
        json_error('You cannot unfollow yourself.', 422);
    }

    db_query(
        'DELETE FROM user_follows
         WHERE follower_id = :follower_id
           AND following_id = :following_id',
        [
            'follower_id' => $viewerUserId,
            'following_id' => $targetUserId,
        ]
    );

    json_success(follow_relationship_response($targetUserId, $viewerUserId));
}

function profile_star_create(string $handle): void
{
    $session = require_authenticated_session();
    require_csrf_token($session);
    require_profile_stars_table();

    $target = active_profile_for_follow($handle);
    $viewerUserId = (int) $session['user_id'];
    $targetUserId = (int) $target['user_id'];

    if ($viewerUserId === $targetUserId) {
        json_error('You cannot star yourself.', 422);
    }

    reject_blocked_star($viewerUserId, $targetUserId);

    db_query(
        'INSERT IGNORE INTO profile_stars (starrer_id, starred_user_id)
         VALUES (:starrer_id, :starred_user_id)',
        [
            'starrer_id' => $viewerUserId,
            'starred_user_id' => $targetUserId,
        ]
    );

    json_success(profile_star_response($targetUserId, $viewerUserId));
}

function profile_star_delete(string $handle): void
{
    $session = require_authenticated_session();
    require_csrf_token($session);
    require_profile_stars_table();

    $target = active_profile_for_follow($handle);
    $viewerUserId = (int) $session['user_id'];
    $targetUserId = (int) $target['user_id'];

    if ($viewerUserId === $targetUserId) {
        json_error('You cannot unstar yourself.', 422);
    }

    db_query(
        'DELETE FROM profile_stars
         WHERE starrer_id = :starrer_id
           AND starred_user_id = :starred_user_id',
        [
            'starrer_id' => $viewerUserId,
            'starred_user_id' => $targetUserId,
        ]
    );

    json_success(profile_star_response($targetUserId, $viewerUserId));
}

function profile_followers_index(string $handle): void
{
    require_user_follows_table();
    $target = active_profile_for_follow($handle);

    json_success(profile_follow_list((int) $target['user_id'], 'followers', current_request_user_id()));
}

function profile_following_index(string $handle): void
{
    require_user_follows_table();
    $target = active_profile_for_follow($handle);

    json_success(profile_follow_list((int) $target['user_id'], 'following', current_request_user_id()));
}

function active_profile_for_follow(string $handle): array
{
    $profile = fetch_profile_by_handle(normalize_handle($handle));

    if ($profile === null || (string) ($profile['user_status'] ?? 'active') !== 'active') {
        json_error('Profile not found.', 404);
    }

    return $profile;
}

function require_user_follows_table(): void
{
    if (!user_follows_table_exists()) {
        json_error('Follow storage is not ready. Run pending migrations.', 503);
    }
}

function require_user_blocks_table(): void
{
    if (!user_blocks_table_exists()) {
        json_error('Block storage is not ready. Run pending migrations.', 503);
    }
}

function require_user_mutes_table(): void
{
    if (!user_mutes_table_exists()) {
        json_error('Mute storage is not ready. Run pending migrations.', 503);
    }
}

function require_profile_stars_table(): void
{
    if (!profile_stars_table_exists()) {
        json_error('Profile star storage is not ready. Run pending migrations.', 503);
    }
}

function follow_relationship_response(int $targetUserId, int $viewerUserId): array
{
    $context = profile_social_context($targetUserId, $viewerUserId);

    return [
        'isFollowing' => (bool) $context['isFollowing'],
        'isFollowedBy' => (bool) $context['isFollowedBy'],
        'isMoot' => (bool) $context['isMoot'],
        'isBlocked' => (bool) ($context['isBlocked'] ?? false),
        'isMuted' => (bool) ($context['isMuted'] ?? false),
        'followerCount' => (int) $context['followerCount'],
        'followingCount' => (int) $context['followingCount'],
        'mootCount' => (int) $context['mootCount'],
        'starCount' => (int) $context['starCount'],
        'isStarred' => (bool) $context['isStarred'],
    ];
}

function profile_star_response(int $targetUserId, int $viewerUserId): array
{
    $relationship = follow_relationship_response($targetUserId, $viewerUserId);

    return [
        'isStarred' => (bool) $relationship['isStarred'],
        'starCount' => (int) $relationship['starCount'],
        'relationship' => $relationship,
        'stats' => [
            'followers' => (int) $relationship['followerCount'],
            'following' => (int) $relationship['followingCount'],
            'moots' => (int) $relationship['mootCount'],
            'stars' => (int) $relationship['starCount'],
        ],
    ];
}

function profile_control_response(int $targetUserId, int $viewerUserId): array
{
    $relationship = follow_relationship_response($targetUserId, $viewerUserId);

    return [
        'isBlocked' => (bool) $relationship['isBlocked'],
        'isMuted' => (bool) $relationship['isMuted'],
        'relationship' => $relationship,
    ];
}

function reject_blocked_follow(int $viewerUserId, int $targetUserId): void
{
    $state = user_pair_block_state($viewerUserId, $targetUserId);

    if ($state['viewerBlocksTarget']) {
        json_error('Unblock this member before following.', 409);
    }

    if ($state['targetBlocksViewer']) {
        json_error('You cannot follow this member.', 403);
    }
}

function reject_blocked_star(int $viewerUserId, int $targetUserId): void
{
    $state = user_pair_block_state($viewerUserId, $targetUserId);

    if ($state['viewerBlocksTarget']) {
        json_error('Unblock this member before starring.', 409);
    }

    if ($state['targetBlocksViewer']) {
        json_error('You cannot star this member.', 403);
    }
}

function user_pair_block_state(int $viewerUserId, int $targetUserId): array
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

function is_mutual_follow(int $followerId, int $followingId): bool
{
    $statement = db_query(
        'SELECT 1
         FROM user_follows
         WHERE follower_id = :following_id
           AND following_id = :follower_id
         LIMIT 1',
        [
            'follower_id' => $followerId,
            'following_id' => $followingId,
        ]
    );

    return (bool) $statement->fetch();
}

function profile_follow_list(int $targetUserId, string $kind, ?int $viewerUserId): array
{
    $joinColumn = $kind === 'followers' ? 'follower_id' : 'following_id';
    $targetColumn = $kind === 'followers' ? 'following_id' : 'follower_id';

    $blockedFilter = pair_not_blocked_sql('follows.follower_id', 'follows.following_id');
    $statement = db_query(
        "SELECT
            u.id AS user_id,
            u.handle,
            p.display_name,
            p.avatar_url,
            p.bio,
            follows.created_at AS followed_at,
            EXISTS (
                SELECT 1
                FROM user_follows viewer_following
                WHERE viewer_following.follower_id = :viewer_user_id_following
                  AND viewer_following.following_id = u.id
            ) AS is_following,
            EXISTS (
                SELECT 1
                FROM user_follows viewer_followed_by
                WHERE viewer_followed_by.follower_id = u.id
                  AND viewer_followed_by.following_id = :viewer_user_id_followed_by
            ) AS is_followed_by
         FROM user_follows follows
         INNER JOIN users u ON u.id = follows.$joinColumn
         INNER JOIN profiles p ON p.user_id = u.id
         WHERE follows.$targetColumn = :target_user_id
           AND u.status = 'active'
           {$blockedFilter}
         ORDER BY follows.created_at DESC, u.handle ASC
         LIMIT 100",
        [
            'target_user_id' => $targetUserId,
            'viewer_user_id_following' => $viewerUserId,
            'viewer_user_id_followed_by' => $viewerUserId,
        ]
    );

    return array_map('follow_user_card_payload', $statement->fetchAll());
}

function follow_user_card_payload(array $row): array
{
    $displayName = (string) ($row['display_name'] ?? $row['handle']);
    $isFollowing = (bool) ($row['is_following'] ?? false);
    $isFollowedBy = (bool) ($row['is_followed_by'] ?? false);

    return [
        'handle' => (string) $row['handle'],
        'displayName' => $displayName,
        'initials' => initials_from_name($displayName),
        'avatarUrl' => $row['avatar_url'] ?? null,
        'bioSnippet' => follow_bio_snippet($row['bio'] ?? null),
        'isFollowing' => $isFollowing,
        'isMoot' => $isFollowing && $isFollowedBy,
    ];
}

function follow_bio_snippet(mixed $bio): string
{
    if (!is_string($bio)) {
        return '';
    }

    $trimmed = trim(preg_replace('/\s+/', ' ', $bio) ?? $bio);

    if (strlen($trimmed) <= 140) {
        return $trimmed;
    }

    return rtrim(substr($trimmed, 0, 137)) . '...';
}
