<?php

declare(strict_types=1);

require_once __DIR__ . '/db.php';

function normalize_handle(string $handle): string
{
    $normalized = strtolower(ltrim(rawurldecode($handle), '@'));

    if (!preg_match('/^[a-z0-9_-]{1,40}$/', $normalized)) {
        json_error('Invalid profile handle.', 400);
    }

    return $normalized;
}

function normalize_slug(string $slug): string
{
    $normalized = strtolower(rawurldecode($slug));

    if (!preg_match('/^[a-z0-9-]{1,80}$/', $normalized)) {
        json_error('Invalid room slug.', 400);
    }

    return $normalized;
}

function json_array_value(?string $value): array
{
    if ($value === null || $value === '') {
        return [];
    }

    try {
        $decoded = json_decode($value, true, 512, JSON_THROW_ON_ERROR);
    } catch (JsonException) {
        return [];
    }

    return is_array($decoded) ? array_values($decoded) : [];
}

function initials_from_name(string $displayName): string
{
    $words = preg_split('/\s+/', trim($displayName)) ?: [];
    $letters = [];

    foreach ($words as $word) {
        if ($word !== '') {
            $letters[] = strtoupper(substr($word, 0, 1));
        }

        if (count($letters) === 2) {
            break;
        }
    }

    if ($letters === []) {
        return 'TH';
    }

    return implode('', $letters);
}

function user_payload(array $row): array
{
    $displayName = (string) ($row['display_name'] ?? $row['handle']);

    return [
        'id' => (int) $row['user_id'],
        'handle' => (string) $row['handle'],
        'displayName' => $displayName,
        'initials' => initials_from_name($displayName),
        'aura' => (string) ($row['aura'] ?? 'frost'),
        'avatarUrl' => $row['avatar_url'] ?? null,
    ];
}

function profile_payload(array $row, ?array $stats = null, ?array $social = null): array
{
    $social = $social ?? [
        'followerCount' => (int) ($row['follower_count'] ?? 0),
        'followingCount' => (int) ($row['following_count'] ?? 0),
        'mootCount' => (int) ($row['moot_count'] ?? 0),
        'isFollowing' => (bool) ($row['is_following'] ?? false),
        'isFollowedBy' => (bool) ($row['is_followed_by'] ?? false),
        'isMoot' => (bool) ($row['is_moot'] ?? false),
        'isBlocked' => (bool) ($row['is_blocked'] ?? false),
        'isMuted' => (bool) ($row['is_muted'] ?? false),
    ];
    $stats = $stats ?? [
        'posts' => (int) ($row['post_count'] ?? 0),
        'replies' => (int) ($row['profile_reply_count'] ?? 0),
        'rooms' => (int) ($row['room_count'] ?? 0),
        'echoes' => (int) ($row['profile_like_count'] ?? $row['profile_echo_count'] ?? $row['echo_count'] ?? 0),
    ];
    $stats['followers'] = (int) $social['followerCount'];
    $stats['following'] = (int) $social['followingCount'];
    $stats['moots'] = (int) $social['mootCount'];

    return [
        'user' => user_payload($row),
        'bio' => (string) ($row['bio'] ?? ''),
        'location' => (string) ($row['location'] ?? ''),
        'avatarUrl' => $row['avatar_url'] ?? null,
        'bannerUrl' => $row['banner_url'] ?? null,
        'profileAccent' => $row['profile_accent'] ?? null,
        'profileBackground' => $row['profile_background'] ?? null,
        'profileTheme' => $row['profile_theme'] ?? null,
        'featuredPostId' => profile_featured_nullable_id($row['featured_post_id'] ?? null),
        'featuredRoomId' => profile_featured_nullable_id($row['featured_room_id'] ?? null),
        'links' => json_array_value($row['links'] ?? null),
        'traits' => json_array_value($row['traits'] ?? null),
        'stats' => $stats,
        'followerCount' => (int) $social['followerCount'],
        'followingCount' => (int) $social['followingCount'],
        'mootCount' => (int) $social['mootCount'],
        'isFollowing' => (bool) $social['isFollowing'],
        'isFollowedBy' => (bool) $social['isFollowedBy'],
        'isMoot' => (bool) $social['isMoot'],
        'isBlocked' => (bool) ($social['isBlocked'] ?? false),
        'isMuted' => (bool) ($social['isMuted'] ?? false),
        'createdAt' => $row['profile_created_at'] ?? null,
        'updatedAt' => $row['profile_updated_at'] ?? null,
    ];
}

function profile_payload_with_featured(
    array $row,
    ?array $stats = null,
    ?array $social = null,
    ?int $viewerUserId = null
): array {
    $payload = profile_payload($row, $stats, $social);
    $profileUserId = (int) $row['user_id'];

    $payload['featuredPost'] = fetch_profile_featured_post(
        $row['featured_post_id'] ?? null,
        $profileUserId,
        $viewerUserId
    );
    $payload['featuredRoom'] = fetch_profile_featured_room(
        $row['featured_room_id'] ?? null,
        $profileUserId,
        $viewerUserId
    );

    return $payload;
}

function profile_featured_nullable_id(mixed $value): ?int
{
    if ($value === null || $value === '') {
        return null;
    }

    $id = (int) $value;

    return $id > 0 ? $id : null;
}

function room_payload(array $row): array
{
    $summary = (string) ($row['room_summary'] ?? '');
    $owner = null;

    if (($row['owner_user_id'] ?? null) !== null) {
        $owner = user_payload([
            'user_id' => $row['owner_user_id'],
            'handle' => $row['owner_handle'],
            'display_name' => $row['owner_display_name'],
            'avatar_url' => $row['owner_avatar_url'] ?? null,
        ]);
    }

    return [
        'id' => (int) $row['room_id'],
        'slug' => (string) $row['room_slug'],
        'name' => (string) $row['room_name'],
        'summary' => $summary,
        'description' => $summary,
        'mood' => (string) ($row['room_mood'] ?? ''),
        'members' => (int) ($row['room_member_count'] ?? 0),
        'memberCount' => (int) ($row['room_member_count'] ?? 0),
        'live' => (bool) ($row['room_is_live'] ?? false),
        'accent' => (string) ($row['room_accent'] ?? ''),
        'iconUrl' => $row['room_icon_url'] ?? null,
        'bannerUrl' => $row['room_banner_url'] ?? null,
        'rules' => (string) ($row['room_rules'] ?? ''),
        'visibility' => (string) ($row['room_visibility'] ?? 'public'),
        'createdBy' => ($row['room_created_by'] ?? null) === null
            ? null
            : (int) $row['room_created_by'],
        'owner' => $owner,
        'joinedByMe' => (bool) ($row['current_room_joined'] ?? false),
        'myRoomRole' => $row['current_room_role'] ?? null,
        'postCount' => (int) ($row['room_post_count'] ?? 0),
        'latestActivityAt' => $row['room_latest_activity_at'] ?? null,
        'createdAt' => $row['room_created_at'] ?? null,
        'updatedAt' => $row['room_updated_at'] ?? null,
    ];
}

function nullable_room_payload(array $row): ?array
{
    if ($row['room_id'] === null) {
        return null;
    }

    return room_payload($row);
}

function post_payload(array $row): array
{
    $profile = profile_payload($row);
    $likeCount = (int) ($row['reaction_glow_count'] ?? 0);
    $isCurrentUser = (int) ($row['user_id'] ?? 0) > 0
        && (int) ($row['user_id'] ?? 0) === (int) ($row['current_viewer_user_id'] ?? -1);
    $isFollowingAuthor = (bool) ($row['current_user_follows_author'] ?? false);
    $isFollowedByAuthor = (bool) ($row['author_follows_current_user'] ?? false);
    $authorRelationship = null;

    if ($isCurrentUser) {
        $authorRelationship = 'self';
    } elseif ($isFollowingAuthor && $isFollowedByAuthor) {
        $authorRelationship = 'moot';
    } elseif ($isFollowingAuthor) {
        $authorRelationship = 'following';
    }

    return [
        'id' => (int) $row['post_id'],
        'body' => (string) $row['post_body'],
        'mood' => (string) ($row['post_mood'] ?? ''),
        'mediaUrl' => $row['post_media_url'] ?? null,
        'visibility' => (string) $row['post_visibility'],
        'status' => (string) $row['post_status'],
        'parentId' => $row['post_parent_id'] === null ? null : (int) $row['post_parent_id'],
        'deletedAt' => $row['post_deleted_at'] ?? null,
        'createdAt' => $row['post_created_at'],
        'updatedAt' => $row['post_updated_at'],
        'author' => $profile['user'],
        'profile' => $profile,
        'room' => nullable_room_payload($row),
        'commentCount' => (int) ($row['reply_count'] ?? 0),
        'reactions' => [
            'glow' => $likeCount,
            'echo' => (int) ($row['reaction_echo_count'] ?? 0),
            'hush' => (int) ($row['reaction_hush_count'] ?? 0),
        ],
        'likeCount' => $likeCount,
        'likedByCurrentUser' => isset($row['current_like_user_id']) && $row['current_like_user_id'] !== null,
        'reblogCount' => (int) ($row['reblog_count'] ?? 0),
        'rebloggedByMe' => isset($row['current_reblog_user_id']) && $row['current_reblog_user_id'] !== null,
        'rebloggedByCurrentUser' => isset($row['current_reblog_user_id']) && $row['current_reblog_user_id'] !== null,
        'rebloggedBy' => reblog_context_user_payload($row),
        'rebloggedAt' => $row['reblogged_at'] ?? null,
        'socialContext' => [
            'authorRelationship' => $authorRelationship,
            'likedByFollowedCount' => (int) ($row['followed_like_count'] ?? 0),
        ],
    ];
}

function reblog_context_user_payload(array $row): ?array
{
    if (($row['reblogged_by_user_id'] ?? null) === null || ($row['reblogged_by_handle'] ?? null) === null) {
        return null;
    }

    return user_payload([
        'user_id' => $row['reblogged_by_user_id'],
        'handle' => $row['reblogged_by_handle'],
        'display_name' => $row['reblogged_by_display_name'] ?? $row['reblogged_by_handle'],
        'avatar_url' => $row['reblogged_by_avatar_url'] ?? null,
    ]);
}

function current_request_user_id(): ?int
{
    static $userId = false;

    if ($userId !== false) {
        return $userId;
    }

    if (!function_exists('current_session')) {
        $userId = null;
        return null;
    }

    $session = current_session();
    $userId = $session === null ? null : (int) $session['user_id'];

    return $userId;
}

function database_table_exists(string $tableName): bool
{
    static $cache = [];

    if (!preg_match('/^[a-zA-Z0-9_]+$/', $tableName)) {
        return false;
    }

    if (array_key_exists($tableName, $cache)) {
        return (bool) $cache[$tableName];
    }

    $statement = db_query(
        "SELECT COUNT(*) AS table_count
         FROM INFORMATION_SCHEMA.TABLES
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = :table_name",
        ['table_name' => $tableName]
    );
    $row = $statement->fetch();
    $cache[$tableName] = is_array($row) && (int) ($row['table_count'] ?? 0) > 0;

    return (bool) $cache[$tableName];
}

function user_follows_table_exists(): bool
{
    return database_table_exists('user_follows');
}

function post_reblogs_table_exists(): bool
{
    return database_table_exists('post_reblogs');
}

function user_blocks_table_exists(): bool
{
    return database_table_exists('user_blocks');
}

function user_mutes_table_exists(): bool
{
    return database_table_exists('user_mutes');
}

function room_memberships_table_exists(): bool
{
    return database_table_exists('room_memberships');
}

function database_column_exists(string $tableName, string $columnName): bool
{
    static $cache = [];

    if (!preg_match('/^[a-zA-Z0-9_]+$/', $tableName) || !preg_match('/^[a-zA-Z0-9_]+$/', $columnName)) {
        return false;
    }

    $cacheKey = "{$tableName}.{$columnName}";

    if (array_key_exists($cacheKey, $cache)) {
        return (bool) $cache[$cacheKey];
    }

    $statement = db_query(
        "SELECT COUNT(*) AS column_count
         FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = :table_name
           AND COLUMN_NAME = :column_name",
        [
            'table_name' => $tableName,
            'column_name' => $columnName,
        ]
    );
    $row = $statement->fetch();
    $cache[$cacheKey] = is_array($row) && (int) ($row['column_count'] ?? 0) > 0;

    return (bool) $cache[$cacheKey];
}

function profile_customization_columns_exist(): bool
{
    return database_column_exists('profiles', 'banner_url')
        && database_column_exists('profiles', 'profile_accent')
        && database_column_exists('profiles', 'profile_background')
        && database_column_exists('profiles', 'profile_theme');
}

function profile_featured_columns_exist(): bool
{
    return database_column_exists('profiles', 'featured_post_id')
        && database_column_exists('profiles', 'featured_room_id');
}

function profile_customization_select_sql(string $alias): string
{
    if (profile_customization_columns_exist()) {
        return "{$alias}.banner_url,
            {$alias}.profile_accent,
            {$alias}.profile_background,
            {$alias}.profile_theme,";
    }

    return "NULL AS banner_url,
            NULL AS profile_accent,
            NULL AS profile_background,
            NULL AS profile_theme,";
}

function profile_featured_select_sql(string $alias): string
{
    if (profile_featured_columns_exist()) {
        return "{$alias}.featured_post_id,
            {$alias}.featured_room_id,";
    }

    return "NULL AS featured_post_id,
            NULL AS featured_room_id,";
}

function room_customization_columns_exist(): bool
{
    return database_column_exists('rooms', 'icon_url')
        && database_column_exists('rooms', 'banner_url')
        && database_column_exists('rooms', 'rules');
}

function room_soft_delete_column_exists(): bool
{
    return database_column_exists('rooms', 'deleted_at');
}

function room_not_deleted_sql(string $alias): string
{
    return room_soft_delete_column_exists() ? " AND {$alias}.deleted_at IS NULL" : '';
}

function public_post_visible_sql(string $postAlias, string $roomAlias): string
{
    return "{$postAlias}.visibility = 'public'
        AND {$postAlias}.status = 'published'
        AND {$postAlias}.deleted_at IS NULL
        AND (
            {$postAlias}.room_id IS NULL
            OR ({$roomAlias}.visibility = 'public' " . room_not_deleted_sql($roomAlias) . ")
        )";
}

function profile_received_likes_count_sql(string $authorSql): string
{
    return "(SELECT COUNT(*)
            FROM post_reactions profile_likes
            INNER JOIN posts profile_like_posts ON profile_like_posts.id = profile_likes.post_id
            LEFT JOIN rooms profile_like_rooms ON profile_like_rooms.id = profile_like_posts.room_id
            " . post_ancestor_visibility_joins_sql('profile_like_posts') . "
            WHERE profile_like_posts.author_id = {$authorSql}
              AND profile_likes.type = 'glow'
              AND " . public_post_visible_sql('profile_like_posts', 'profile_like_rooms') . "
              AND " . post_ancestor_visibility_sql('profile_like_posts') . ")";
}

function profile_received_likes_aggregate_sql(): string
{
    return "SELECT profile_like_posts.author_id, COUNT(*) AS like_count
        FROM post_reactions profile_likes
        INNER JOIN posts profile_like_posts ON profile_like_posts.id = profile_likes.post_id
        LEFT JOIN rooms profile_like_rooms ON profile_like_rooms.id = profile_like_posts.room_id
        " . post_ancestor_visibility_joins_sql('profile_like_posts') . "
        WHERE profile_likes.type = 'glow'
          AND " . public_post_visible_sql('profile_like_posts', 'profile_like_rooms') . "
          AND " . post_ancestor_visibility_sql('profile_like_posts') . "
        GROUP BY profile_like_posts.author_id";
}

function pair_not_blocked_sql(string $firstUserSql, string $secondUserSql): string
{
    if (!user_blocks_table_exists()) {
        return '';
    }

    return " AND NOT EXISTS (
        SELECT 1
        FROM user_blocks pair_blocks
        WHERE (pair_blocks.blocker_id = {$firstUserSql} AND pair_blocks.blocked_id = {$secondUserSql})
           OR (pair_blocks.blocker_id = {$secondUserSql} AND pair_blocks.blocked_id = {$firstUserSql})
    )";
}

function viewer_feed_relationship_filter_sql(?int $viewerUserId, string $authorUserSql = 'u.id', bool $includeMutes = true): string
{
    if ($viewerUserId === null) {
        return '';
    }

    $viewerSql = (string) $viewerUserId;
    $filters = pair_not_blocked_sql($viewerSql, $authorUserSql);

    if ($includeMutes && user_mutes_table_exists()) {
        $filters .= " AND NOT EXISTS (
            SELECT 1
            FROM user_mutes feed_mutes
            WHERE feed_mutes.muter_id = {$viewerSql}
              AND feed_mutes.muted_id = {$authorUserSql}
        )";
    }

    return $filters;
}

function post_ancestor_visibility_joins_sql(string $postAlias): string
{
    return "LEFT JOIN posts parent_post ON parent_post.id = {$postAlias}.parent_id
    LEFT JOIN rooms parent_post_room ON parent_post_room.id = parent_post.room_id
    LEFT JOIN posts grandparent_post ON grandparent_post.id = parent_post.parent_id
    LEFT JOIN rooms grandparent_post_room ON grandparent_post_room.id = grandparent_post.room_id
    LEFT JOIN posts great_grandparent_post ON great_grandparent_post.id = grandparent_post.parent_id
    LEFT JOIN rooms great_grandparent_post_room ON great_grandparent_post_room.id = great_grandparent_post.room_id";
}

function post_ancestor_visibility_sql(string $postAlias): string
{
    $parentVisible = public_post_visible_sql('parent_post', 'parent_post_room');
    $grandparentVisible = public_post_visible_sql('grandparent_post', 'grandparent_post_room');
    $greatGrandparentVisible = public_post_visible_sql('great_grandparent_post', 'great_grandparent_post_room');

    return "(
        {$postAlias}.parent_id IS NULL
        OR (
            parent_post.id IS NOT NULL
            AND {$parentVisible}
            AND (
                parent_post.parent_id IS NULL
                OR (
                    grandparent_post.id IS NOT NULL
                    AND {$grandparentVisible}
                    AND (
                        grandparent_post.parent_id IS NULL
                        OR (
                            great_grandparent_post.id IS NOT NULL
                            AND {$greatGrandparentVisible}
                            AND great_grandparent_post.parent_id IS NULL
                        )
                    )
                )
            )
        )
    )";
}

function room_customization_select_sql(string $alias): string
{
    if (room_customization_columns_exist()) {
        return "{$alias}.icon_url AS room_icon_url,
            {$alias}.banner_url AS room_banner_url,
            {$alias}.rules AS room_rules,";
    }

    return "NULL AS room_icon_url,
            NULL AS room_banner_url,
            NULL AS room_rules,";
}

function room_membership_count_select_sql(string $alias): string
{
    if (room_memberships_table_exists()) {
        return "COALESCE(room_member_counts.member_count, 0) AS room_member_count,";
    }

    return "{$alias}.member_count AS room_member_count,";
}

function room_membership_count_join_sql(string $alias): string
{
    if (!room_memberships_table_exists()) {
        return '';
    }

    return "LEFT JOIN (
            SELECT room_id, COUNT(*) AS member_count
            FROM room_memberships
            WHERE banned_at IS NULL
            GROUP BY room_id
        ) room_member_counts ON room_member_counts.room_id = {$alias}.id";
}

function room_viewer_membership_select_sql(): string
{
    if (room_memberships_table_exists()) {
        return "viewer_room_membership.role AS current_room_role,
            IF(viewer_room_membership.id IS NULL, 0, 1) AS current_room_joined,";
    }

    return "NULL AS current_room_role,
            0 AS current_room_joined,";
}

function room_viewer_membership_join_sql(string $alias, ?int $viewerUserId): string
{
    if (!room_memberships_table_exists()) {
        return '';
    }

    $viewerSql = $viewerUserId === null ? '0' : (string) $viewerUserId;

    return "LEFT JOIN room_memberships viewer_room_membership
            ON viewer_room_membership.room_id = {$alias}.id
           AND viewer_room_membership.user_id = {$viewerSql}
           AND viewer_room_membership.banned_at IS NULL";
}

function profile_social_context(int $profileUserId, ?int $viewerUserId = null): array
{
    $context = [
        'followerCount' => 0,
        'followingCount' => 0,
        'mootCount' => 0,
        'isFollowing' => false,
        'isFollowedBy' => false,
        'isMoot' => false,
        'isBlocked' => false,
        'isMuted' => false,
    ];

    if (!user_follows_table_exists()) {
        return $context;
    }

    $statement = db_query(
        "SELECT
            (
                SELECT COUNT(*)
                FROM user_follows followers
                INNER JOIN users follower_users ON follower_users.id = followers.follower_id
                WHERE followers.following_id = :profile_user_id_followers
                  AND follower_users.status = 'active'
                  " . pair_not_blocked_sql('followers.follower_id', 'followers.following_id') . "
            ) AS follower_count,
            (
                SELECT COUNT(*)
                FROM user_follows following
                INNER JOIN users following_users ON following_users.id = following.following_id
                WHERE following.follower_id = :profile_user_id_following
                  AND following_users.status = 'active'
                  " . pair_not_blocked_sql('following.follower_id', 'following.following_id') . "
            ) AS following_count,
            (
                SELECT COUNT(*)
                FROM user_follows moots
                INNER JOIN user_follows reciprocal
                  ON reciprocal.follower_id = moots.following_id
                 AND reciprocal.following_id = moots.follower_id
                INNER JOIN users moot_users ON moot_users.id = moots.following_id
                WHERE moots.follower_id = :profile_user_id_moots
                  AND moot_users.status = 'active'
                  " . pair_not_blocked_sql('moots.follower_id', 'moots.following_id') . "
            ) AS moot_count",
        [
            'profile_user_id_followers' => $profileUserId,
            'profile_user_id_following' => $profileUserId,
            'profile_user_id_moots' => $profileUserId,
        ]
    );
    $row = $statement->fetch();

    if (is_array($row)) {
        $context['followerCount'] = (int) ($row['follower_count'] ?? 0);
        $context['followingCount'] = (int) ($row['following_count'] ?? 0);
        $context['mootCount'] = (int) ($row['moot_count'] ?? 0);
    }

    if ($viewerUserId === null || $viewerUserId === $profileUserId) {
        return $context;
    }

    $blockSelect = user_blocks_table_exists()
        ? ",
            EXISTS (
                SELECT 1
                FROM user_blocks
                WHERE blocker_id = :viewer_user_id_blocked
                  AND blocked_id = :profile_user_id_blocked
            ) AS is_blocked,
            EXISTS (
                SELECT 1
                FROM user_blocks
                WHERE blocker_id = :profile_user_id_blocked_by
                  AND blocked_id = :viewer_user_id_blocked_by
            ) AS is_blocked_by"
        : ",
            0 AS is_blocked,
            0 AS is_blocked_by";
    $muteSelect = user_mutes_table_exists()
        ? ",
            EXISTS (
                SELECT 1
                FROM user_mutes
                WHERE muter_id = :viewer_user_id_muted
                  AND muted_id = :profile_user_id_muted
            ) AS is_muted"
        : ",
            0 AS is_muted";
    $relationshipParams = [
        'profile_user_id_following' => $profileUserId,
        'viewer_user_id_following' => $viewerUserId,
        'profile_user_id_followed_by' => $profileUserId,
        'viewer_user_id_followed_by' => $viewerUserId,
    ];

    if (user_blocks_table_exists()) {
        $relationshipParams += [
            'viewer_user_id_blocked' => $viewerUserId,
            'profile_user_id_blocked' => $profileUserId,
            'profile_user_id_blocked_by' => $profileUserId,
            'viewer_user_id_blocked_by' => $viewerUserId,
        ];
    }

    if (user_mutes_table_exists()) {
        $relationshipParams += [
            'viewer_user_id_muted' => $viewerUserId,
            'profile_user_id_muted' => $profileUserId,
        ];
    }

    $relationship = db_query(
        "SELECT
            EXISTS (
                SELECT 1
                FROM user_follows
                WHERE follower_id = :viewer_user_id_following
                  AND following_id = :profile_user_id_following
            ) AS is_following,
            EXISTS (
                SELECT 1
                FROM user_follows
                WHERE follower_id = :profile_user_id_followed_by
                  AND following_id = :viewer_user_id_followed_by
            ) AS is_followed_by
            {$blockSelect}
            {$muteSelect}",
        $relationshipParams
    )->fetch();

    if (is_array($relationship)) {
        $isBlocked = (bool) ($relationship['is_blocked'] ?? false);
        $isBlockedBy = (bool) ($relationship['is_blocked_by'] ?? false);

        $context['isBlocked'] = $isBlocked;
        $context['isMuted'] = (bool) ($relationship['is_muted'] ?? false);
        $context['isFollowing'] = !$isBlocked && !$isBlockedBy && (bool) ($relationship['is_following'] ?? false);
        $context['isFollowedBy'] = !$isBlocked && !$isBlockedBy && (bool) ($relationship['is_followed_by'] ?? false);
        $context['isMoot'] = $context['isFollowing'] && $context['isFollowedBy'];
    }

    return $context;
}

function fetch_profile_by_handle(string $handle): ?array
{
    $customizationSelect = profile_customization_select_sql('p');
    $featuredSelect = profile_featured_select_sql('p');
    $statement = db_query(
        "SELECT
            u.id AS user_id,
            u.handle,
            u.status AS user_status,
            p.display_name,
            p.bio,
            p.location,
            p.avatar_url,
            {$customizationSelect}
            {$featuredSelect}
            p.links,
            p.traits,
            p.created_at AS profile_created_at,
            p.updated_at AS profile_updated_at,
            (
                SELECT COUNT(*)
                FROM posts profile_posts
                LEFT JOIN rooms profile_post_rooms ON profile_post_rooms.id = profile_posts.room_id
                WHERE profile_posts.author_id = u.id
                  AND profile_posts.parent_id IS NULL
                  AND profile_posts.visibility = 'public'
                  AND profile_posts.status = 'published'
                  AND profile_posts.deleted_at IS NULL
                  AND (
                    profile_posts.room_id IS NULL
                    OR (profile_post_rooms.visibility = 'public' " . room_not_deleted_sql('profile_post_rooms') . ")
                  )
            ) AS post_count,
            (
                SELECT COUNT(*)
                FROM posts profile_replies
                LEFT JOIN rooms profile_reply_rooms ON profile_reply_rooms.id = profile_replies.room_id
                " . post_ancestor_visibility_joins_sql('profile_replies') . "
                WHERE profile_replies.author_id = u.id
                  AND profile_replies.parent_id IS NOT NULL
                  AND " . public_post_visible_sql('profile_replies', 'profile_reply_rooms') . "
                  AND " . post_ancestor_visibility_sql('profile_replies') . "
            ) AS profile_reply_count,
            (
                SELECT COUNT(*)
                FROM rooms profile_rooms
                WHERE profile_rooms.created_by = u.id
                  AND profile_rooms.visibility = 'public'
                  " . room_not_deleted_sql('profile_rooms') . "
            ) AS room_count,
            " . profile_received_likes_count_sql('u.id') . " AS profile_like_count
        FROM users u
        INNER JOIN profiles p ON p.user_id = u.id
        WHERE u.handle = :handle
        LIMIT 1",
        ['handle' => $handle]
    );

    $row = $statement->fetch();

    return is_array($row) ? $row : null;
}

function fetch_profile_featured_post(mixed $postId, int $profileUserId, ?int $viewerUserId = null): ?array
{
    $featuredPostId = profile_featured_nullable_id($postId);

    if ($featuredPostId === null) {
        return null;
    }

    $statement = db_query(
        post_select_sql(
            'AND p.id = :post_id
             AND p.author_id = :profile_user_id'
                . viewer_feed_relationship_filter_sql($viewerUserId, 'u.id'),
            'p.created_at DESC, p.id DESC',
            '',
            $viewerUserId
        ),
        [
            'post_id' => $featuredPostId,
            'profile_user_id' => $profileUserId,
        ]
    );
    $row = $statement->fetch();

    return is_array($row) ? post_payload($row) : null;
}

function fetch_profile_featured_room(mixed $roomId, int $profileUserId, ?int $viewerUserId = null): ?array
{
    $featuredRoomId = profile_featured_nullable_id($roomId);

    if ($featuredRoomId === null) {
        return null;
    }

    $viewerProfileFilter = viewer_feed_relationship_filter_sql($viewerUserId, (string) $profileUserId);
    $viewerOwnerFilter = viewer_feed_relationship_filter_sql($viewerUserId, 'owner.id');
    $statement = db_query(
        "SELECT
            rooms.id AS room_id,
            rooms.slug AS room_slug,
            rooms.name AS room_name,
            rooms.summary AS room_summary,
            rooms.mood AS room_mood,
            " . room_membership_count_select_sql('rooms') . "
            rooms.is_live AS room_is_live,
            rooms.accent AS room_accent,
            " . room_customization_select_sql('rooms') . "
            rooms.visibility AS room_visibility,
            rooms.created_by AS room_created_by,
            " . room_viewer_membership_select_sql() . "
            owner.id AS owner_user_id,
            owner.handle AS owner_handle,
            owner_profile.display_name AS owner_display_name,
            owner_profile.avatar_url AS owner_avatar_url,
            COALESCE(room_posts.post_count, 0) AS room_post_count,
            room_posts.latest_activity_at AS room_latest_activity_at,
            rooms.created_at AS room_created_at,
            rooms.updated_at AS room_updated_at
        FROM rooms
        LEFT JOIN users owner ON owner.id = rooms.created_by
        LEFT JOIN profiles owner_profile ON owner_profile.user_id = owner.id
        " . room_membership_count_join_sql('rooms') . "
        " . room_viewer_membership_join_sql('rooms', $viewerUserId) . "
        LEFT JOIN (
            SELECT
                room_id,
                SUM(parent_id IS NULL) AS post_count,
                MAX(created_at) AS latest_activity_at
            FROM posts
            WHERE room_id IS NOT NULL
              AND visibility = 'public'
              AND status = 'published'
              AND deleted_at IS NULL
            GROUP BY room_id
        ) room_posts ON room_posts.room_id = rooms.id
        WHERE rooms.id = :room_id
          AND rooms.visibility = 'public'
          " . room_not_deleted_sql('rooms') . "
          AND " . profile_featured_room_eligibility_sql($profileUserId, 'rooms') . "
          {$viewerProfileFilter}
          {$viewerOwnerFilter}
        LIMIT 1",
        ['room_id' => $featuredRoomId]
    );
    $row = $statement->fetch();

    return is_array($row) ? room_payload($row) : null;
}

function profile_featured_room_eligibility_sql(int $profileUserId, string $roomAlias): string
{
    $profileUserSql = (string) $profileUserId;
    $membershipSql = '';

    if (room_memberships_table_exists()) {
        $membershipSql = " OR EXISTS (
            SELECT 1
            FROM room_memberships featured_room_memberships
            WHERE featured_room_memberships.room_id = {$roomAlias}.id
              AND featured_room_memberships.user_id = {$profileUserSql}
              AND featured_room_memberships.banned_at IS NULL
              AND featured_room_memberships.role IN ('owner', 'moderator', 'member')
        )";
    }

    return "({$roomAlias}.created_by = {$profileUserSql}{$membershipSql})";
}

function fetch_public_rooms(): array
{
    $viewerUserId = current_request_user_id();
    $statement = db_query(
        "SELECT
            rooms.id AS room_id,
            rooms.slug AS room_slug,
            rooms.name AS room_name,
            rooms.summary AS room_summary,
            rooms.mood AS room_mood,
            " . room_membership_count_select_sql('rooms') . "
            rooms.is_live AS room_is_live,
            rooms.accent AS room_accent,
            " . room_customization_select_sql('rooms') . "
            rooms.visibility AS room_visibility,
            rooms.created_by AS room_created_by,
            " . room_viewer_membership_select_sql() . "
            owner.id AS owner_user_id,
            owner.handle AS owner_handle,
            owner_profile.display_name AS owner_display_name,
            owner_profile.avatar_url AS owner_avatar_url,
            COALESCE(room_posts.post_count, 0) AS room_post_count,
            room_posts.latest_activity_at AS room_latest_activity_at,
            rooms.created_at AS room_created_at,
            rooms.updated_at AS room_updated_at
        FROM rooms
        LEFT JOIN users owner ON owner.id = rooms.created_by
        LEFT JOIN profiles owner_profile ON owner_profile.user_id = owner.id
        " . room_membership_count_join_sql('rooms') . "
        " . room_viewer_membership_join_sql('rooms', $viewerUserId) . "
        LEFT JOIN (
            SELECT
                room_id,
                SUM(parent_id IS NULL) AS post_count,
                MAX(created_at) AS latest_activity_at
            FROM posts
            WHERE room_id IS NOT NULL
              AND visibility = 'public'
              AND status = 'published'
              AND deleted_at IS NULL
            GROUP BY room_id
        ) room_posts ON room_posts.room_id = rooms.id
        WHERE rooms.visibility = 'public'
          " . room_not_deleted_sql('rooms') . "
        ORDER BY room_posts.latest_activity_at DESC, rooms.is_live DESC, rooms.name ASC"
    );

    return array_map('room_payload', $statement->fetchAll());
}

function fetch_public_room_by_slug(string $slug): ?array
{
    $viewerUserId = current_request_user_id();
    $statement = db_query(
        "SELECT
            rooms.id AS room_id,
            rooms.slug AS room_slug,
            rooms.name AS room_name,
            rooms.summary AS room_summary,
            rooms.mood AS room_mood,
            " . room_membership_count_select_sql('rooms') . "
            rooms.is_live AS room_is_live,
            rooms.accent AS room_accent,
            " . room_customization_select_sql('rooms') . "
            rooms.visibility AS room_visibility,
            rooms.created_by AS room_created_by,
            " . room_viewer_membership_select_sql() . "
            owner.id AS owner_user_id,
            owner.handle AS owner_handle,
            owner_profile.display_name AS owner_display_name,
            owner_profile.avatar_url AS owner_avatar_url,
            COALESCE(room_posts.post_count, 0) AS room_post_count,
            room_posts.latest_activity_at AS room_latest_activity_at,
            rooms.created_at AS room_created_at,
            rooms.updated_at AS room_updated_at
        FROM rooms
        LEFT JOIN users owner ON owner.id = rooms.created_by
        LEFT JOIN profiles owner_profile ON owner_profile.user_id = owner.id
        " . room_membership_count_join_sql('rooms') . "
        " . room_viewer_membership_join_sql('rooms', $viewerUserId) . "
        LEFT JOIN (
            SELECT
                room_id,
                SUM(parent_id IS NULL) AS post_count,
                MAX(created_at) AS latest_activity_at
            FROM posts
            WHERE room_id IS NOT NULL
              AND visibility = 'public'
              AND status = 'published'
              AND deleted_at IS NULL
            GROUP BY room_id
        ) room_posts ON room_posts.room_id = rooms.id
        WHERE rooms.slug = :slug
          AND rooms.visibility = 'public'
          " . room_not_deleted_sql('rooms') . "
        LIMIT 1",
        ['slug' => $slug]
    );

    $row = $statement->fetch();

    return is_array($row) ? room_payload($row) : null;
}

function post_select_sql(
    string $whereClause,
    string $orderClause = 'p.created_at DESC, p.id DESC',
    string $extraSelect = '',
    ?int $viewerUserId = null,
    string $extraJoins = ''
): string
{
    $viewerSql = $viewerUserId === null ? 'NULL' : (string) $viewerUserId;
    $hasFollows = user_follows_table_exists();
    $hasReblogs = post_reblogs_table_exists();
    $followSelect = $hasFollows
        ? "IF(viewer_follows_author.following_id IS NULL, 0, 1) AS current_user_follows_author,
        IF(author_follows_viewer.follower_id IS NULL, 0, 1) AS author_follows_current_user,
        COALESCE(followed_likes.followed_like_count, 0) AS followed_like_count,"
        : "0 AS current_user_follows_author,
        0 AS author_follows_current_user,
        0 AS followed_like_count,";
    $followJoins = $hasFollows
        ? "LEFT JOIN user_follows viewer_follows_author
        ON viewer_follows_author.follower_id = {$viewerSql}
       AND viewer_follows_author.following_id = u.id
    LEFT JOIN user_follows author_follows_viewer
        ON author_follows_viewer.follower_id = u.id
       AND author_follows_viewer.following_id = {$viewerSql}
    LEFT JOIN (
        SELECT reactions.post_id, COUNT(*) AS followed_like_count
        FROM post_reactions reactions
        INNER JOIN user_follows followed_reactors
            ON followed_reactors.following_id = reactions.user_id
           AND followed_reactors.follower_id = {$viewerSql}
        WHERE reactions.type = 'glow'
        GROUP BY reactions.post_id
    ) followed_likes ON followed_likes.post_id = p.id"
        : "";
    $reblogSelect = $hasReblogs
        ? "COALESCE(reblogs.reblog_count, 0) AS reblog_count,
        current_reblog.user_id AS current_reblog_user_id,"
        : "0 AS reblog_count,
        NULL AS current_reblog_user_id,";
    $reblogJoins = $hasReblogs
        ? "LEFT JOIN (
        SELECT post_id, COUNT(*) AS reblog_count
        FROM post_reblogs
        GROUP BY post_id
    ) reblogs ON reblogs.post_id = p.id
    LEFT JOIN post_reblogs current_reblog
        ON current_reblog.post_id = p.id
       AND current_reblog.user_id = {$viewerSql}"
        : "";
    $resolvedExtraSelect = trim($extraSelect) === '' ? '' : ",\n        {$extraSelect}";
    $profileCustomizationSelect = profile_customization_select_sql('pr');

    return "SELECT
        p.id AS post_id,
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
        {$profileCustomizationSelect}
        pr.links,
        pr.traits,
        pr.created_at AS profile_created_at,
        pr.updated_at AS profile_updated_at,
        COALESCE(profile_posts.post_count, 0) AS post_count,
        COALESCE(profile_replies.reply_count, 0) AS profile_reply_count,
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
        r.created_by AS room_created_by,
        owner.id AS owner_user_id,
        owner.handle AS owner_handle,
        owner_profile.display_name AS owner_display_name,
        owner_profile.avatar_url AS owner_avatar_url,
        COALESCE(room_posts.post_count, 0) AS room_post_count,
        room_posts.latest_activity_at AS room_latest_activity_at,
        r.created_at AS room_created_at,
        r.updated_at AS room_updated_at,
        COALESCE(reactions.glow_count, 0) AS reaction_glow_count,
        COALESCE(reactions.echo_count, 0) AS reaction_echo_count,
        COALESCE(reactions.hush_count, 0) AS reaction_hush_count,
        COALESCE(replies.reply_count, 0) AS reply_count,
        current_like.user_id AS current_like_user_id,
        {$viewerSql} AS current_viewer_user_id,
        {$followSelect}
        {$reblogSelect}
        1 AS feed_row_marker{$resolvedExtraSelect}
    FROM posts p
    INNER JOIN users u ON u.id = p.author_id
    INNER JOIN profiles pr ON pr.user_id = u.id
    LEFT JOIN rooms r ON r.id = p.room_id
    " . post_ancestor_visibility_joins_sql('p') . "
    LEFT JOIN users owner ON owner.id = r.created_by
    LEFT JOIN profiles owner_profile ON owner_profile.user_id = owner.id
    LEFT JOIN (
        SELECT
            room_id,
            SUM(parent_id IS NULL) AS post_count,
            MAX(created_at) AS latest_activity_at
        FROM posts
        WHERE room_id IS NOT NULL
          AND visibility = 'public'
          AND status = 'published'
          AND deleted_at IS NULL
        GROUP BY room_id
    ) room_posts ON room_posts.room_id = r.id
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
        SELECT profile_replies.author_id AS author_id, COUNT(*) AS reply_count
        FROM posts profile_replies
        LEFT JOIN rooms profile_reply_rooms ON profile_reply_rooms.id = profile_replies.room_id
        " . post_ancestor_visibility_joins_sql('profile_replies') . "
        WHERE profile_replies.parent_id IS NOT NULL
          AND " . public_post_visible_sql('profile_replies', 'profile_reply_rooms') . "
          AND " . post_ancestor_visibility_sql('profile_replies') . "
        GROUP BY profile_replies.author_id
    ) profile_replies ON profile_replies.author_id = u.id
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
       AND current_like.user_id = {$viewerSql}
       AND current_like.type = 'glow'
    {$followJoins}
    {$reblogJoins}
    {$extraJoins}
    WHERE " . public_post_visible_sql('p', 'r') . "
      AND u.status = 'active'
      AND " . post_ancestor_visibility_sql('p') . "
      {$whereClause}
    ORDER BY {$orderClause}
    LIMIT 50";
}

function reblog_score_sql(): string
{
    return post_reblogs_table_exists() ? 'COALESCE(reblogs.reblog_count, 0)' : '0';
}

function relationship_score_sql(int $followBonus, int $mootBonus): string
{
    if (!user_follows_table_exists()) {
        return '0';
    }

    return "CASE
        WHEN viewer_follows_author.following_id IS NOT NULL
         AND author_follows_viewer.follower_id IS NOT NULL THEN {$mootBonus}
        WHEN viewer_follows_author.following_id IS NOT NULL THEN {$followBonus}
        ELSE 0
    END";
}

function discover_rank_score_sql(): string
{
    $relationshipScore = relationship_score_sql(8, 12);
    $reblogScore = reblog_score_sql();

    // Discover is broad public ranking: engagement + recent activity + freshness,
    // with gentle age decay and only small current-viewer social bonuses.
    return "(
        COALESCE(reactions.glow_count, 0) * 3
        + COALESCE(replies.reply_count, 0) * 4
        + {$reblogScore} * 5
        + LEAST(COALESCE(room_posts.post_count, 0), 10)
        + {$relationshipScore}
        + CASE
            WHEN TIMESTAMPDIFF(HOUR, p.created_at, UTC_TIMESTAMP()) <= 6 THEN 30
            WHEN TIMESTAMPDIFF(HOUR, p.created_at, UTC_TIMESTAMP()) <= 24 THEN 18
            WHEN TIMESTAMPDIFF(HOUR, p.created_at, UTC_TIMESTAMP()) <= 72 THEN 8
            ELSE 0
          END
        - LEAST(40, TIMESTAMPDIFF(HOUR, p.created_at, UTC_TIMESTAMP()) / 6)
    )";
}

function home_rank_score_sql(?int $viewerUserId): string
{
    if ($viewerUserId === null) {
        return discover_rank_score_sql();
    }

    $viewerSql = (string) $viewerUserId;
    $relationshipScore = relationship_score_sql(80, 120);
    $reblogScore = reblog_score_sql();
    $followedReblogScore = post_reblogs_table_exists() && user_follows_table_exists()
        ? "CASE WHEN EXISTS (
            SELECT 1
            FROM post_reblogs home_reblogs
            INNER JOIN user_follows home_reblog_follows
                ON home_reblog_follows.following_id = home_reblogs.user_id
               AND home_reblog_follows.follower_id = {$viewerSql}
            WHERE home_reblogs.post_id = p.id
        ) THEN 70 ELSE 0 END"
        : '0';

    // Home favors chosen social context first, then recent conversation.
    // A small own-post penalty keeps one member's posts from overwhelming Home.
    return "(
        {$relationshipScore}
        + {$followedReblogScore}
        + CASE WHEN u.id = {$viewerSql} THEN -45 ELSE 0 END
        + COALESCE(reactions.glow_count, 0) * 3
        + COALESCE(replies.reply_count, 0) * 4
        + {$reblogScore} * 5
        + LEAST(COALESCE(room_posts.post_count, 0), 12)
        + CASE
            WHEN TIMESTAMPDIFF(HOUR, p.created_at, UTC_TIMESTAMP()) <= 24 THEN 24
            WHEN TIMESTAMPDIFF(HOUR, p.created_at, UTC_TIMESTAMP()) <= 72 THEN 12
            WHEN TIMESTAMPDIFF(HOUR, p.created_at, UTC_TIMESTAMP()) <= 168 THEN 6
            ELSE 0
          END
        - LEAST(35, TIMESTAMPDIFF(HOUR, p.created_at, UTC_TIMESTAMP()) / 8)
    )";
}

function followed_reblog_context_select_sql(?int $viewerUserId): string
{
    if ($viewerUserId === null || !post_reblogs_table_exists() || !user_follows_table_exists()) {
        return "NULL AS reblogged_by_user_id,
        NULL AS reblogged_by_handle,
        NULL AS reblogged_by_display_name,
        NULL AS reblogged_by_avatar_url,
        NULL AS reblogged_at";
    }

    $viewerSql = (string) $viewerUserId;

    return "(SELECT reblog_user.id
            FROM post_reblogs feed_reblogs
            INNER JOIN user_follows feed_reblog_follows
                ON feed_reblog_follows.following_id = feed_reblogs.user_id
               AND feed_reblog_follows.follower_id = {$viewerSql}
            INNER JOIN users reblog_user ON reblog_user.id = feed_reblogs.user_id
            WHERE feed_reblogs.post_id = p.id
              AND reblog_user.status = 'active'
            ORDER BY feed_reblogs.created_at DESC, feed_reblogs.id DESC
            LIMIT 1) AS reblogged_by_user_id,
        (SELECT reblog_user.handle
            FROM post_reblogs feed_reblogs
            INNER JOIN user_follows feed_reblog_follows
                ON feed_reblog_follows.following_id = feed_reblogs.user_id
               AND feed_reblog_follows.follower_id = {$viewerSql}
            INNER JOIN users reblog_user ON reblog_user.id = feed_reblogs.user_id
            WHERE feed_reblogs.post_id = p.id
              AND reblog_user.status = 'active'
            ORDER BY feed_reblogs.created_at DESC, feed_reblogs.id DESC
            LIMIT 1) AS reblogged_by_handle,
        (SELECT reblogger_profile.display_name
            FROM post_reblogs feed_reblogs
            INNER JOIN user_follows feed_reblog_follows
                ON feed_reblog_follows.following_id = feed_reblogs.user_id
               AND feed_reblog_follows.follower_id = {$viewerSql}
            INNER JOIN users reblog_user ON reblog_user.id = feed_reblogs.user_id
            INNER JOIN profiles reblogger_profile ON reblogger_profile.user_id = reblog_user.id
            WHERE feed_reblogs.post_id = p.id
              AND reblog_user.status = 'active'
            ORDER BY feed_reblogs.created_at DESC, feed_reblogs.id DESC
            LIMIT 1) AS reblogged_by_display_name,
        (SELECT reblogger_profile.avatar_url
            FROM post_reblogs feed_reblogs
            INNER JOIN user_follows feed_reblog_follows
                ON feed_reblog_follows.following_id = feed_reblogs.user_id
               AND feed_reblog_follows.follower_id = {$viewerSql}
            INNER JOIN users reblog_user ON reblog_user.id = feed_reblogs.user_id
            INNER JOIN profiles reblogger_profile ON reblogger_profile.user_id = reblog_user.id
            WHERE feed_reblogs.post_id = p.id
              AND reblog_user.status = 'active'
            ORDER BY feed_reblogs.created_at DESC, feed_reblogs.id DESC
            LIMIT 1) AS reblogged_by_avatar_url,
        (SELECT feed_reblogs.created_at
            FROM post_reblogs feed_reblogs
            INNER JOIN user_follows feed_reblog_follows
                ON feed_reblog_follows.following_id = feed_reblogs.user_id
               AND feed_reblog_follows.follower_id = {$viewerSql}
            INNER JOIN users reblog_user ON reblog_user.id = feed_reblogs.user_id
            WHERE feed_reblogs.post_id = p.id
              AND reblog_user.status = 'active'
            ORDER BY feed_reblogs.created_at DESC, feed_reblogs.id DESC
            LIMIT 1) AS reblogged_at";
}

function fetch_public_posts(): array
{
    $viewerUserId = current_request_user_id();
    $statement = db_query(
        post_select_sql('AND p.parent_id IS NULL', 'p.created_at DESC, p.id DESC', '', $viewerUserId)
    );

    return array_map('post_payload', $statement->fetchAll());
}

function fetch_home_feed(): array
{
    $viewerUserId = current_request_user_id();
    $scoreSql = home_rank_score_sql($viewerUserId);
    $statement = db_query(
        post_select_sql(
            'AND p.parent_id IS NULL' . viewer_feed_relationship_filter_sql($viewerUserId),
            'feed_rank_score DESC, p.created_at DESC, p.id DESC',
            "{$scoreSql} AS feed_rank_score,
            " . followed_reblog_context_select_sql($viewerUserId),
            $viewerUserId
        )
    );

    return array_map('post_payload', $statement->fetchAll());
}

function fetch_discover_posts(): array
{
    $scoreSql = discover_rank_score_sql();
    $viewerUserId = current_request_user_id();
    $statement = db_query(
        post_select_sql(
            'AND p.parent_id IS NULL' . viewer_feed_relationship_filter_sql($viewerUserId),
            'feed_rank_score DESC, p.created_at DESC, p.id DESC',
            "{$scoreSql} AS feed_rank_score",
            $viewerUserId
        )
    );

    return array_map('post_payload', $statement->fetchAll());
}

function fetch_public_room_posts(string $slug): array
{
    $viewerUserId = current_request_user_id();
    $statement = db_query(
        post_select_sql(
            'AND r.slug = :slug AND p.parent_id IS NULL',
            'p.created_at DESC, p.id DESC',
            '',
            $viewerUserId
        ),
        [
            'slug' => $slug,
        ]
    );

    return array_map('post_payload', $statement->fetchAll());
}

function fetch_public_profile_posts(string $handle): array
{
    $viewerUserId = current_request_user_id();
    $statement = db_query(
        post_select_sql(
            'AND u.handle = :handle AND p.parent_id IS NULL',
            'p.created_at DESC, p.id DESC',
            '',
            $viewerUserId
        ),
        [
            'handle' => $handle,
        ]
    );

    return array_map('post_payload', $statement->fetchAll());
}

function fetch_public_profile_replies(string $handle): array
{
    $viewerUserId = current_request_user_id();
    $statement = db_query(
        post_select_sql(
            'AND u.handle = :handle AND p.parent_id IS NOT NULL',
            'p.created_at DESC, p.id DESC',
            '',
            $viewerUserId
        ),
        [
            'handle' => $handle,
        ]
    );

    return array_map('post_payload', $statement->fetchAll());
}

function fetch_public_profile_reblogs(string $handle): array
{
    if (!post_reblogs_table_exists()) {
        json_error('Reblog storage is not ready. Run pending migrations.', 503);
    }

    $viewerUserId = current_request_user_id();
    $statement = db_query(
        post_select_sql(
            "AND profile_reblogger.handle = :handle
             AND profile_reblogger.status = 'active'",
            'profile_reblogs.created_at DESC, profile_reblogs.id DESC',
            "profile_reblogger.id AS reblogged_by_user_id,
            profile_reblogger.handle AS reblogged_by_handle,
            profile_reblogger_profile.display_name AS reblogged_by_display_name,
            profile_reblogger_profile.avatar_url AS reblogged_by_avatar_url,
            profile_reblogs.created_at AS reblogged_at",
            $viewerUserId,
            'INNER JOIN post_reblogs profile_reblogs ON profile_reblogs.post_id = p.id
            INNER JOIN users profile_reblogger ON profile_reblogger.id = profile_reblogs.user_id
            INNER JOIN profiles profile_reblogger_profile ON profile_reblogger_profile.user_id = profile_reblogger.id'
        ),
        [
            'handle' => $handle,
        ]
    );

    return array_map('post_payload', $statement->fetchAll());
}

function fetch_public_profile_rooms(string $handle): array
{
    $viewerUserId = current_request_user_id();
    $statement = db_query(
        "SELECT
            rooms.id AS room_id,
            rooms.slug AS room_slug,
            rooms.name AS room_name,
            rooms.summary AS room_summary,
            rooms.mood AS room_mood,
            " . room_membership_count_select_sql('rooms') . "
            rooms.is_live AS room_is_live,
            rooms.accent AS room_accent,
            " . room_customization_select_sql('rooms') . "
            rooms.visibility AS room_visibility,
            rooms.created_by AS room_created_by,
            " . room_viewer_membership_select_sql() . "
            owner.id AS owner_user_id,
            owner.handle AS owner_handle,
            owner_profile.display_name AS owner_display_name,
            owner_profile.avatar_url AS owner_avatar_url,
            COALESCE(room_posts.post_count, 0) AS room_post_count,
            room_posts.latest_activity_at AS room_latest_activity_at,
            rooms.created_at AS room_created_at,
            rooms.updated_at AS room_updated_at
        FROM rooms
        INNER JOIN users owner ON owner.id = rooms.created_by
        LEFT JOIN profiles owner_profile ON owner_profile.user_id = owner.id
        " . room_membership_count_join_sql('rooms') . "
        " . room_viewer_membership_join_sql('rooms', $viewerUserId) . "
        LEFT JOIN (
            SELECT
                room_id,
                SUM(parent_id IS NULL) AS post_count,
                MAX(created_at) AS latest_activity_at
            FROM posts
            WHERE room_id IS NOT NULL
              AND visibility = 'public'
              AND status = 'published'
              AND deleted_at IS NULL
            GROUP BY room_id
        ) room_posts ON room_posts.room_id = rooms.id
        WHERE owner.handle = :handle
          AND rooms.visibility = 'public'
          " . room_not_deleted_sql('rooms') . "
        ORDER BY rooms.created_at DESC, rooms.name ASC",
        ['handle' => $handle]
    );

    return array_map('room_payload', $statement->fetchAll());
}

function fetch_public_stats(): array
{
    $statement = db_query(
        "SELECT
            (
                SELECT COUNT(*)
                FROM rooms
                WHERE visibility = :public_visibility
                  " . room_not_deleted_sql('rooms') . "
            ) AS public_rooms,
            (
                SELECT COUNT(*)
                FROM posts stat_posts
                LEFT JOIN rooms stat_rooms ON stat_rooms.id = stat_posts.room_id
                WHERE stat_posts.visibility = :post_visibility
                  AND stat_posts.parent_id IS NULL
                  AND stat_posts.status = :post_status
                  AND stat_posts.deleted_at IS NULL
                  AND (
                    stat_posts.room_id IS NULL
                    OR (stat_rooms.visibility = :room_visibility " . room_not_deleted_sql('stat_rooms') . ")
                  )
            ) AS public_posts,
            (
                SELECT COUNT(*)
                FROM users
                WHERE status = :user_status
            ) AS active_users,
            (
                SELECT COUNT(*)
                FROM post_reactions reactions
                INNER JOIN posts reaction_posts ON reaction_posts.id = reactions.post_id
                LEFT JOIN rooms reaction_rooms ON reaction_rooms.id = reaction_posts.room_id
                WHERE reactions.type = :reaction_type
                  AND reaction_posts.visibility = :reaction_post_visibility
                  AND reaction_posts.status = :reaction_post_status
                  AND reaction_posts.deleted_at IS NULL
                  AND (
                    reaction_posts.room_id IS NULL
                    OR (reaction_rooms.visibility = :reaction_room_visibility " . room_not_deleted_sql('reaction_rooms') . ")
                  )
            ) AS total_reactions",
        [
            'public_visibility' => 'public',
            'post_visibility' => 'public',
            'post_status' => 'published',
            'room_visibility' => 'public',
            'user_status' => 'active',
            'reaction_type' => 'glow',
            'reaction_post_visibility' => 'public',
            'reaction_post_status' => 'published',
            'reaction_room_visibility' => 'public',
        ]
    );

    $row = $statement->fetch();

    return [
        'publicRooms' => (int) ($row['public_rooms'] ?? 0),
        'publicPosts' => (int) ($row['public_posts'] ?? 0),
        'activeUsers' => (int) ($row['active_users'] ?? 0),
        'totalReactions' => (int) ($row['total_reactions'] ?? 0),
    ];
}

function discover_person_payload(array $row): array
{
    $displayName = (string) ($row['display_name'] ?? $row['handle']);
    $isFollowing = (bool) ($row['is_following'] ?? false);
    $isFollowedBy = (bool) ($row['is_followed_by'] ?? false);

    return [
        'handle' => (string) $row['handle'],
        'displayName' => $displayName,
        'initials' => initials_from_name($displayName),
        'avatarUrl' => $row['avatar_url'] ?? null,
        'bioSnippet' => profile_bio_snippet($row['bio'] ?? null),
        'isFollowing' => $isFollowing,
        'isMoot' => $isFollowing && $isFollowedBy,
        'postCount' => (int) ($row['post_count'] ?? 0),
        'followerCount' => (int) ($row['follower_count'] ?? 0),
    ];
}

function profile_bio_snippet(mixed $bio): string
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

function fetch_people_to_watch(): array
{
    $viewerUserId = current_request_user_id();
    $viewerSql = $viewerUserId === null ? 'NULL' : (string) $viewerUserId;
    $hasFollows = user_follows_table_exists();
    $followSelect = $hasFollows
        ? "IF(viewer_follows.following_id IS NULL, 0, 1) AS is_following,
        IF(viewer_followed_by.follower_id IS NULL, 0, 1) AS is_followed_by,
        COALESCE(followers.follower_count, 0) AS follower_count,"
        : "0 AS is_following,
        0 AS is_followed_by,
        0 AS follower_count,";
    $followJoins = $hasFollows
        ? "LEFT JOIN (
            SELECT following_id, COUNT(*) AS follower_count
            FROM user_follows
            GROUP BY following_id
        ) followers ON followers.following_id = u.id
        LEFT JOIN user_follows viewer_follows
            ON viewer_follows.follower_id = {$viewerSql}
           AND viewer_follows.following_id = u.id
        LEFT JOIN user_follows viewer_followed_by
            ON viewer_followed_by.follower_id = u.id
           AND viewer_followed_by.following_id = {$viewerSql}"
        : "";
    $excludeFollowed = $hasFollows
        ? "AND viewer_follows.following_id IS NULL"
        : "";
    $relationshipFilter = viewer_feed_relationship_filter_sql($viewerUserId);

    $statement = db_query(
        "SELECT
            u.id AS user_id,
            u.handle,
            p.display_name,
            p.avatar_url,
            p.bio,
            {$followSelect}
            COALESCE(profile_posts.post_count, 0) AS post_count,
            profile_posts.latest_post_at
         FROM users u
         INNER JOIN profiles p ON p.user_id = u.id
         LEFT JOIN (
            SELECT
                posts.author_id,
                COUNT(*) AS post_count,
                MAX(posts.created_at) AS latest_post_at,
                COALESCE(SUM(reaction_counts.glow_count), 0) AS like_count
            FROM posts
            LEFT JOIN rooms post_rooms ON post_rooms.id = posts.room_id
            LEFT JOIN (
                SELECT post_id, SUM(type = 'glow') AS glow_count
                FROM post_reactions
                GROUP BY post_id
            ) reaction_counts ON reaction_counts.post_id = posts.id
            WHERE posts.parent_id IS NULL
              AND posts.visibility = 'public'
              AND posts.status = 'published'
              AND posts.deleted_at IS NULL
              AND (posts.room_id IS NULL OR (post_rooms.visibility = 'public' " . room_not_deleted_sql('post_rooms') . "))
            GROUP BY posts.author_id
         ) profile_posts ON profile_posts.author_id = u.id
         {$followJoins}
         WHERE u.status = 'active'
           AND ({$viewerSql} IS NULL OR u.id <> {$viewerSql})
           {$excludeFollowed}
           {$relationshipFilter}
           AND COALESCE(profile_posts.post_count, 0) > 0
         ORDER BY
            profile_posts.latest_post_at DESC,
            profile_posts.like_count DESC,
            u.created_at DESC
         LIMIT 6"
    );

    return array_map('discover_person_payload', $statement->fetchAll());
}

function fetch_discover_feed(): array
{
    return [
        'posts' => fetch_discover_posts(),
        'activeRooms' => array_slice(fetch_public_rooms(), 0, 6),
        'peopleToWatch' => fetch_people_to_watch(),
    ];
}

function profiles_show(string $handle): void
{
    $profile = fetch_profile_by_handle(normalize_handle($handle));

    if ($profile === null) {
        json_error('Profile not found.', 404);
    }

    $viewerUserId = current_request_user_id();

    json_success(profile_payload_with_featured(
        $profile,
        null,
        profile_social_context((int) $profile['user_id'], $viewerUserId),
        $viewerUserId
    ));
}

function profile_posts_index(string $handle): void
{
    $normalizedHandle = normalize_handle($handle);

    if (fetch_profile_by_handle($normalizedHandle) === null) {
        json_error('Profile not found.', 404);
    }

    json_success(fetch_public_profile_posts($normalizedHandle));
}

function profile_replies_index(string $handle): void
{
    $normalizedHandle = normalize_handle($handle);

    if (fetch_profile_by_handle($normalizedHandle) === null) {
        json_error('Profile not found.', 404);
    }

    json_success(fetch_public_profile_replies($normalizedHandle));
}

function profile_reblogs_index(string $handle): void
{
    $normalizedHandle = normalize_handle($handle);

    if (fetch_profile_by_handle($normalizedHandle) === null) {
        json_error('Profile not found.', 404);
    }

    json_success(fetch_public_profile_reblogs($normalizedHandle));
}

function profile_rooms_index(string $handle): void
{
    $normalizedHandle = normalize_handle($handle);

    if (fetch_profile_by_handle($normalizedHandle) === null) {
        json_error('Profile not found.', 404);
    }

    json_success(fetch_public_profile_rooms($normalizedHandle));
}

function rooms_index(): void
{
    json_success(fetch_public_rooms());
}

function rooms_show(string $slug): void
{
    $room = fetch_public_room_by_slug(normalize_slug($slug));

    if ($room === null) {
        json_error('Room not found.', 404);
    }

    json_success($room);
}

function posts_index(): void
{
    json_success(fetch_public_posts());
}

function home_feed_index(): void
{
    json_success([
        'posts' => fetch_home_feed(),
        'personalized' => current_request_user_id() !== null,
    ]);
}

function discover_feed_index(): void
{
    json_success(fetch_discover_feed());
}

function stats_index(): void
{
    json_success(fetch_public_stats());
}

function room_posts_index(string $slug): void
{
    $normalizedSlug = normalize_slug($slug);

    if (fetch_public_room_by_slug($normalizedSlug) === null) {
        json_error('Room not found.', 404);
    }

    json_success(fetch_public_room_posts($normalizedSlug));
}
