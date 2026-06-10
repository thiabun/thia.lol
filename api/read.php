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
    ];
    $stats = $stats ?? [
        'posts' => (int) ($row['post_count'] ?? 0),
        'replies' => (int) ($row['profile_reply_count'] ?? 0),
        'rooms' => (int) ($row['room_count'] ?? 0),
        'echoes' => (int) ($row['profile_echo_count'] ?? $row['echo_count'] ?? 0),
    ];
    $stats['followers'] = (int) $social['followerCount'];
    $stats['following'] = (int) $social['followingCount'];
    $stats['moots'] = (int) $social['mootCount'];

    return [
        'user' => user_payload($row),
        'bio' => (string) ($row['bio'] ?? ''),
        'location' => (string) ($row['location'] ?? ''),
        'avatarUrl' => $row['avatar_url'] ?? null,
        'links' => json_array_value($row['links'] ?? null),
        'traits' => json_array_value($row['traits'] ?? null),
        'stats' => $stats,
        'followerCount' => (int) $social['followerCount'],
        'followingCount' => (int) $social['followingCount'],
        'mootCount' => (int) $social['mootCount'],
        'isFollowing' => (bool) $social['isFollowing'],
        'isFollowedBy' => (bool) $social['isFollowedBy'],
        'isMoot' => (bool) $social['isMoot'],
        'createdAt' => $row['profile_created_at'] ?? null,
        'updatedAt' => $row['profile_updated_at'] ?? null,
    ];
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
        'live' => (bool) ($row['room_is_live'] ?? false),
        'accent' => (string) ($row['room_accent'] ?? ''),
        'visibility' => (string) ($row['room_visibility'] ?? 'public'),
        'createdBy' => ($row['room_created_by'] ?? null) === null
            ? null
            : (int) $row['room_created_by'],
        'owner' => $owner,
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
    ];
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

function user_follows_table_exists(): bool
{
    static $exists = null;

    if (is_bool($exists)) {
        return $exists;
    }

    $statement = db_query(
        "SELECT COUNT(*) AS table_count
         FROM INFORMATION_SCHEMA.TABLES
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'user_follows'"
    );
    $row = $statement->fetch();
    $exists = is_array($row) && (int) ($row['table_count'] ?? 0) > 0;

    return $exists;
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
            ) AS follower_count,
            (
                SELECT COUNT(*)
                FROM user_follows following
                INNER JOIN users following_users ON following_users.id = following.following_id
                WHERE following.follower_id = :profile_user_id_following
                  AND following_users.status = 'active'
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
            ) AS is_followed_by",
        [
            'profile_user_id_following' => $profileUserId,
            'viewer_user_id_following' => $viewerUserId,
            'profile_user_id_followed_by' => $profileUserId,
            'viewer_user_id_followed_by' => $viewerUserId,
        ]
    )->fetch();

    if (is_array($relationship)) {
        $context['isFollowing'] = (bool) ($relationship['is_following'] ?? false);
        $context['isFollowedBy'] = (bool) ($relationship['is_followed_by'] ?? false);
        $context['isMoot'] = $context['isFollowing'] && $context['isFollowedBy'];
    }

    return $context;
}

function fetch_profile_by_handle(string $handle): ?array
{
    $statement = db_query(
        "SELECT
            u.id AS user_id,
            u.handle,
            u.status AS user_status,
            p.display_name,
            p.bio,
            p.location,
            p.avatar_url,
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
                    OR profile_post_rooms.visibility = 'public'
                  )
            ) AS post_count,
            (
                SELECT COUNT(*)
                FROM posts profile_replies
                LEFT JOIN rooms profile_reply_rooms ON profile_reply_rooms.id = profile_replies.room_id
                WHERE profile_replies.author_id = u.id
                  AND profile_replies.parent_id IS NOT NULL
                  AND profile_replies.visibility = 'public'
                  AND profile_replies.status = 'published'
                  AND profile_replies.deleted_at IS NULL
                  AND (
                    profile_replies.room_id IS NULL
                    OR profile_reply_rooms.visibility = 'public'
                  )
            ) AS profile_reply_count,
            (
                SELECT COUNT(*)
                FROM rooms profile_rooms
                WHERE profile_rooms.created_by = u.id
                  AND profile_rooms.visibility = 'public'
            ) AS room_count,
            (
                SELECT COUNT(*)
                FROM post_reactions echoes
                INNER JOIN posts echo_posts ON echo_posts.id = echoes.post_id
                WHERE echo_posts.author_id = u.id
                  AND echo_posts.visibility = 'public'
                  AND echo_posts.status = 'published'
                  AND echo_posts.deleted_at IS NULL
                  AND echoes.type = 'echo'
            ) AS echo_count
        FROM users u
        INNER JOIN profiles p ON p.user_id = u.id
        WHERE u.handle = :handle
        LIMIT 1",
        ['handle' => $handle]
    );

    $row = $statement->fetch();

    return is_array($row) ? $row : null;
}

function fetch_public_rooms(): array
{
    $statement = db_query(
        "SELECT
            rooms.id AS room_id,
            rooms.slug AS room_slug,
            rooms.name AS room_name,
            rooms.summary AS room_summary,
            rooms.mood AS room_mood,
            rooms.member_count AS room_member_count,
            rooms.is_live AS room_is_live,
            rooms.accent AS room_accent,
            rooms.visibility AS room_visibility,
            rooms.created_by AS room_created_by,
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
        ORDER BY room_posts.latest_activity_at DESC, rooms.is_live DESC, rooms.name ASC"
    );

    return array_map('room_payload', $statement->fetchAll());
}

function fetch_public_room_by_slug(string $slug): ?array
{
    $statement = db_query(
        "SELECT
            rooms.id AS room_id,
            rooms.slug AS room_slug,
            rooms.name AS room_name,
            rooms.summary AS room_summary,
            rooms.mood AS room_mood,
            rooms.member_count AS room_member_count,
            rooms.is_live AS room_is_live,
            rooms.accent AS room_accent,
            rooms.visibility AS room_visibility,
            rooms.created_by AS room_created_by,
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
        LIMIT 1",
        ['slug' => $slug]
    );

    $row = $statement->fetch();

    return is_array($row) ? room_payload($row) : null;
}

function post_select_sql(string $whereClause): string
{
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
        pr.links,
        pr.traits,
        pr.created_at AS profile_created_at,
        pr.updated_at AS profile_updated_at,
        COALESCE(profile_posts.post_count, 0) AS post_count,
        COALESCE(profile_replies.reply_count, 0) AS profile_reply_count,
        COALESCE(profile_rooms.room_count, 0) AS room_count,
        COALESCE(profile_echoes.echo_count, 0) AS profile_echo_count,
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
        current_like.user_id AS current_like_user_id
    FROM posts p
    INNER JOIN users u ON u.id = p.author_id
    INNER JOIN profiles pr ON pr.user_id = u.id
    LEFT JOIN rooms r ON r.id = p.room_id
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
            OR profile_post_rooms.visibility = 'public'
          )
        GROUP BY author_id
    ) profile_posts ON profile_posts.author_id = u.id
    LEFT JOIN (
        SELECT author_id, COUNT(*) AS reply_count
        FROM posts profile_replies
        LEFT JOIN rooms profile_reply_rooms ON profile_reply_rooms.id = profile_replies.room_id
        WHERE profile_replies.visibility = 'public'
          AND profile_replies.parent_id IS NOT NULL
          AND profile_replies.status = 'published'
          AND profile_replies.deleted_at IS NULL
          AND (
            profile_replies.room_id IS NULL
            OR profile_reply_rooms.visibility = 'public'
          )
        GROUP BY author_id
    ) profile_replies ON profile_replies.author_id = u.id
    LEFT JOIN (
        SELECT created_by, COUNT(*) AS room_count
        FROM rooms
        WHERE visibility = 'public'
        GROUP BY created_by
    ) profile_rooms ON profile_rooms.created_by = u.id
    LEFT JOIN (
        SELECT echo_posts.author_id, COUNT(*) AS echo_count
        FROM post_reactions echoes
        INNER JOIN posts echo_posts ON echo_posts.id = echoes.post_id
        WHERE echoes.type = 'echo'
          AND echo_posts.visibility = 'public'
          AND echo_posts.status = 'published'
          AND echo_posts.deleted_at IS NULL
        GROUP BY echo_posts.author_id
    ) profile_echoes ON profile_echoes.author_id = u.id
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
        WHERE reply_posts.parent_id IS NOT NULL
          AND reply_posts.visibility = 'public'
          AND reply_posts.status = 'published'
          AND reply_posts.deleted_at IS NULL
          AND (reply_posts.room_id IS NULL OR reply_rooms.visibility = 'public')
        GROUP BY reply_posts.parent_id
    ) replies ON replies.parent_id = p.id
    LEFT JOIN post_reactions current_like
        ON current_like.post_id = p.id
       AND current_like.user_id = :current_user_id
       AND current_like.type = 'glow'
    WHERE p.visibility = 'public'
      AND p.status = 'published'
      AND p.deleted_at IS NULL
      AND (p.room_id IS NULL OR r.visibility = 'public')
      {$whereClause}
    ORDER BY p.created_at DESC, p.id DESC
    LIMIT 50";
}

function fetch_public_posts(): array
{
    $statement = db_query(
        post_select_sql('AND p.parent_id IS NULL'),
        ['current_user_id' => current_request_user_id()]
    );

    return array_map('post_payload', $statement->fetchAll());
}

function fetch_public_room_posts(string $slug): array
{
    $statement = db_query(
        post_select_sql('AND r.slug = :slug AND p.parent_id IS NULL'),
        [
            'slug' => $slug,
            'current_user_id' => current_request_user_id(),
        ]
    );

    return array_map('post_payload', $statement->fetchAll());
}

function fetch_public_profile_posts(string $handle): array
{
    $statement = db_query(
        post_select_sql('AND u.handle = :handle AND p.parent_id IS NULL'),
        [
            'handle' => $handle,
            'current_user_id' => current_request_user_id(),
        ]
    );

    return array_map('post_payload', $statement->fetchAll());
}

function fetch_public_profile_replies(string $handle): array
{
    $statement = db_query(
        post_select_sql('AND u.handle = :handle AND p.parent_id IS NOT NULL'),
        [
            'handle' => $handle,
            'current_user_id' => current_request_user_id(),
        ]
    );

    return array_map('post_payload', $statement->fetchAll());
}

function fetch_public_profile_rooms(string $handle): array
{
    $statement = db_query(
        "SELECT
            rooms.id AS room_id,
            rooms.slug AS room_slug,
            rooms.name AS room_name,
            rooms.summary AS room_summary,
            rooms.mood AS room_mood,
            rooms.member_count AS room_member_count,
            rooms.is_live AS room_is_live,
            rooms.accent AS room_accent,
            rooms.visibility AS room_visibility,
            rooms.created_by AS room_created_by,
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
            ) AS public_rooms,
            (
                SELECT COUNT(*)
                FROM posts stat_posts
                LEFT JOIN rooms stat_rooms ON stat_rooms.id = stat_posts.room_id
                WHERE stat_posts.visibility = :post_visibility
                  AND stat_posts.status = :post_status
                  AND stat_posts.deleted_at IS NULL
                  AND (
                    stat_posts.room_id IS NULL
                    OR stat_rooms.visibility = :room_visibility
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
                    OR reaction_rooms.visibility = :reaction_room_visibility
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

function profiles_show(string $handle): void
{
    $profile = fetch_profile_by_handle(normalize_handle($handle));

    if ($profile === null) {
        json_error('Profile not found.', 404);
    }

    json_success(profile_payload(
        $profile,
        null,
        profile_social_context((int) $profile['user_id'], current_request_user_id())
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
