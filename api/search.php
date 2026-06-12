<?php

declare(strict_types=1);

require_once __DIR__ . '/read.php';

const SEARCH_MIN_QUERY_LENGTH = 2;
const SEARCH_RESULT_LIMIT = 8;

function search_dispatch(array $segments, string $method): void
{
    if (($segments[0] ?? null) !== 'search' || count($segments) !== 1) {
        json_error('Not found.', 404);
    }

    if ($method !== 'GET' && $method !== 'HEAD') {
        json_error('Method not allowed.', 405);
    }

    search_index();
}

function search_index(): void
{
    $query = search_query_from_request($_GET['q'] ?? '');

    if (search_text_length($query) < SEARCH_MIN_QUERY_LENGTH) {
        json_success([
            'query' => $query,
            'minQueryLength' => SEARCH_MIN_QUERY_LENGTH,
            'results' => [
                'profiles' => [],
                'rooms' => [],
            ],
        ]);
    }

    json_success([
        'query' => $query,
        'minQueryLength' => SEARCH_MIN_QUERY_LENGTH,
        'results' => [
            'profiles' => search_profiles($query),
            'rooms' => search_rooms($query),
        ],
    ]);
}

function search_query_from_request(mixed $value): string
{
    if (!is_string($value)) {
        return '';
    }

    $query = trim(preg_replace('/\s+/', ' ', $value) ?? $value);

    if (search_text_length($query) > 80) {
        $query = search_substr($query, 0, 80);
    }

    return $query;
}

function search_profiles(string $query): array
{
    $viewerUserId = current_request_user_id();
    $viewerSql = $viewerUserId === null ? 'NULL' : (string) $viewerUserId;
    $relationshipFilter = viewer_feed_relationship_filter_sql($viewerUserId);
    $likePrefix = search_like_pattern($query, true);
    $likeAnywhere = search_like_pattern($query, false);

    $statement = db_query(
        "SELECT
            u.id AS user_id,
            u.handle,
            p.display_name,
            p.avatar_url,
            p.bio,
            CASE
                WHEN LOWER(u.handle) = :exact THEN 0
                WHEN LOWER(u.handle) LIKE :handle_prefix THEN 1
                WHEN LOWER(p.display_name) LIKE :display_prefix THEN 2
                WHEN LOWER(u.handle) LIKE :handle_anywhere THEN 3
                WHEN LOWER(p.display_name) LIKE :display_anywhere THEN 4
                ELSE 5
            END AS search_rank
         FROM users u
         INNER JOIN profiles p ON p.user_id = u.id
         WHERE u.status = 'active'
           AND ({$viewerSql} IS NULL OR u.id <> {$viewerSql})
           {$relationshipFilter}
           AND (
                LOWER(u.handle) LIKE :handle_match
                OR LOWER(p.display_name) LIKE :display_match
                OR LOWER(COALESCE(p.bio, '')) LIKE :bio_match
           )
         ORDER BY search_rank ASC, u.created_at DESC, u.id DESC
         LIMIT " . SEARCH_RESULT_LIMIT,
        [
            'exact' => strtolower($query),
            'handle_prefix' => $likePrefix,
            'display_prefix' => $likePrefix,
            'handle_anywhere' => $likeAnywhere,
            'display_anywhere' => $likeAnywhere,
            'handle_match' => $likeAnywhere,
            'display_match' => $likeAnywhere,
            'bio_match' => $likeAnywhere,
        ]
    );

    return array_map('search_profile_payload', $statement->fetchAll());
}

function search_rooms(string $query): array
{
    $likePrefix = search_like_pattern($query, true);
    $likeAnywhere = search_like_pattern($query, false);

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
            NULL AS current_room_joined,
            NULL AS current_room_role,
            owner.id AS owner_user_id,
            owner.handle AS owner_handle,
            owner_profile.display_name AS owner_display_name,
            owner_profile.avatar_url AS owner_avatar_url,
            COALESCE(room_posts.post_count, 0) AS room_post_count,
            room_posts.latest_activity_at AS room_latest_activity_at,
            rooms.created_at AS room_created_at,
            rooms.updated_at AS room_updated_at,
            CASE
                WHEN LOWER(rooms.slug) = :exact THEN 0
                WHEN LOWER(rooms.slug) LIKE :slug_prefix THEN 1
                WHEN LOWER(rooms.name) LIKE :name_prefix THEN 2
                WHEN LOWER(rooms.slug) LIKE :slug_anywhere THEN 3
                WHEN LOWER(rooms.name) LIKE :name_anywhere THEN 4
                ELSE 5
            END AS search_rank
        FROM rooms
        LEFT JOIN users owner ON owner.id = rooms.created_by
        LEFT JOIN profiles owner_profile ON owner_profile.user_id = owner.id
        " . room_membership_count_join_sql('rooms') . "
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
          AND (
                LOWER(rooms.slug) LIKE :slug_match
                OR LOWER(rooms.name) LIKE :name_match
                OR LOWER(COALESCE(rooms.summary, '')) LIKE :summary_match
          )
        ORDER BY search_rank ASC, room_posts.latest_activity_at DESC, rooms.name ASC
        LIMIT " . SEARCH_RESULT_LIMIT,
        [
            'exact' => strtolower($query),
            'slug_prefix' => $likePrefix,
            'name_prefix' => $likePrefix,
            'slug_anywhere' => $likeAnywhere,
            'name_anywhere' => $likeAnywhere,
            'slug_match' => $likeAnywhere,
            'name_match' => $likeAnywhere,
            'summary_match' => $likeAnywhere,
        ]
    );

    return array_map('room_payload', $statement->fetchAll());
}

function search_profile_payload(array $row): array
{
    $displayName = (string) ($row['display_name'] ?? $row['handle']);

    return [
        'user' => user_payload([
            'user_id' => $row['user_id'],
            'handle' => $row['handle'],
            'display_name' => $displayName,
            'avatar_url' => $row['avatar_url'] ?? null,
        ]),
        'bioSnippet' => profile_bio_snippet($row['bio'] ?? null),
    ];
}

function search_like_pattern(string $query, bool $prefixOnly): string
{
    $escaped = addcslashes(strtolower($query), "\\%_");

    return $prefixOnly ? "{$escaped}%" : "%{$escaped}%";
}

function search_text_length(string $value): int
{
    if (function_exists('mb_strlen')) {
        return mb_strlen($value);
    }

    return strlen($value);
}

function search_substr(string $value, int $start, int $length): string
{
    if (function_exists('mb_substr')) {
        return mb_substr($value, $start, $length);
    }

    return substr($value, $start, $length);
}
