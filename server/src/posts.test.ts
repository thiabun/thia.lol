import type { Pool } from "mysql2/promise";
import { describe, expect, it, vi } from "vitest";

import {
  buildDiscoverFeedQuery,
  buildHomeFeedQuery,
  buildPeopleToWatchQuery,
  buildPublicPostsByIdsQuery,
  buildPublicPostsQuery,
  buildPublicProfileReblogsQuery,
  createPostsRepository,
  diversifyDiscoverPosts,
  normalizePostIdentifier,
  postCanonicalPath,
  shuffleAdjacentChunks,
  shuffleFeedPostsByFreshness,
  type PostDetailPayload,
} from "./posts.js";
import type { PostPayload, ProfileSchemaCapabilities } from "./profiles.js";

const capabilities: ProfileSchemaCapabilities = {
  hasAccountDeletionRequests: true,
  hasUserFollows: true,
  hasUserFollowRequests: true,
  hasUserBlocks: true,
  hasUserMutes: true,
  hasProfileStars: true,
  hasProfileCustomizationColumns: true,
  hasProfileBackgroundVideoColumns: true,
  hasProfileBackgroundBlurColumn: true,
  hasProfileLayoutPresetColumn: true,
  hasProfileCanvasVersionColumn: true,
  hasProfileCanvasGlassColumn: true,
  hasProfileThemeConfigColumn: true,
  hasProfileFeaturedColumns: true,
  hasProfileVisibilityColumn: true,
  hasRoomMemberships: true,
  hasRoomCustomizationColumns: true,
  hasRoomThemeColumns: true,
  hasLegacyRoomAccentColumn: false,
  hasRoomSoftDeleteColumn: true,
  hasPostPublicIdColumn: true,
  hasPostMediaMetadataColumns: true,
  hasPostReblogs: true,
  hasTextEntities: true,
  hasProfileModules: true,
  hasProfileModuleLayoutColumns: true,
  hasProfileModulePinnedColumn: true,
  hasBadges: true,
  hasUserBadges: true,
  hasProfileIntegrationAccounts: true,
  hasProfileIntegrationMetadataCache: true,
  hasRoomAccessRequests: true,
};

describe("post preview route helpers", () => {
  it("matches PHP public post identifier normalization", () => {
    expect(normalizePostIdentifier("PC359FE2DA759")).toBe("pc359fe2da759");
    expect(normalizePostIdentifier("99")).toBe("99");
    expect(normalizePostIdentifier("short")).toBeNull();
    expect(normalizePostIdentifier("bad!")).toBeNull();
  });

  it("builds canonical post paths from public ids", () => {
    expect(
      postCanonicalPath({
        id: 99,
        publicId: "pc359fe2da759",
        body: "",
        bodyEntities: [],
        mood: "",
        mediaUrl: null,
        visibility: "public",
        status: "published",
        parentId: null,
        deletedAt: null,
        createdAt: null,
        updatedAt: null,
        author: {
          id: 1,
          handle: "thia",
          displayName: "Thia",
          initials: "T",
          aura: "frost",
          avatarUrl: null,
        },
        profile: {} as PostDetailPayload["profile"],
        room: null,
        commentCount: 0,
        reactions: {
          glow: 0,
          echo: 0,
          hush: 0,
        },
        likeCount: 0,
        likedByCurrentUser: false,
        reblogCount: 0,
        rebloggedByMe: false,
        rebloggedByCurrentUser: false,
        rebloggedBy: null,
        rebloggedAt: null,
        socialContext: {
          authorRelationship: null,
          likedByFollowedCount: 0,
        },
      }),
    ).toBe("/@thia/posts/pc359fe2da759");
  });
});

describe("post preview SQL", () => {
  it("builds one viewer-aware query for a bounded set of native Post ids", () => {
    const sql = buildPublicPostsByIdsQuery(capabilities, 42, 3);

    expect(sql).toContain("AND p.id IN (?, ?, ?)");
    expect(sql).toContain("pr.visibility = 'public'");
    expect(sql).toContain("OR u.id = 42");
    expect(sql).toContain("LIMIT 3");
    expect(sql).not.toContain("LIMIT 50");
    expect(() => buildPublicPostsByIdsQuery(capabilities, 42, 0)).toThrow("batch size is invalid");
  });

  it("matches PHP public post list constraints and viewer state joins", () => {
    const sql = buildPublicPostsQuery(capabilities, 42);

    expect(sql).toContain("AND p.parent_id IS NULL");
    expect(sql).toContain("current_like.user_id = 42");
    expect(sql).toContain("viewer_follows_author.follower_id = 42");
    expect(sql).toContain("pr.visibility = 'public'");
    expect(sql).toContain("OR u.id = 42");
    expect(sql).toContain("profile_posts.room_id IS NULL");
    expect(sql).toContain("profile_post_rooms.visibility IN ('public', 'view_only')");
    expect(sql).toContain("profile_post_rooms.deleted_at IS NULL");
  });

  it("matches PHP home feed ranking and relationship filters", () => {
    const sql = buildHomeFeedQuery(capabilities, 42);

    expect(sql).toContain("feed_rank_score DESC, p.created_at DESC, p.id DESC");
    expect(sql).toContain("home_reblog_follows.follower_id = 42");
    expect(sql).toContain("CASE WHEN u.id = 42 THEN 125 ELSE 0 END");
    expect(sql).not.toContain("CASE WHEN u.id = 42 THEN -45 ELSE 0 END");
    expect(sql).toContain("feed_viewer_room_membership.user_id = 42");
    expect(sql).toContain("CASE WHEN feed_viewer_room_membership.id IS NULL THEN 0 ELSE 55 END");
    expect(sql).toContain("COALESCE(followed_likes.followed_like_count, 0) * 8");
    expect(sql).toContain("FROM user_mutes feed_mutes");
    expect(sql).toContain("feed_mutes.muter_id = 42");
    expect(sql).not.toContain("NULLAND");
  });

  it("matches PHP discover ranking and public wrapper constraints", () => {
    const sql = buildDiscoverFeedQuery(capabilities, null);

    expect(sql).toContain("feed_rank_score DESC, p.created_at DESC, p.id DESC");
    expect(sql).toContain("LEAST(COALESCE(room_posts.post_count, 0), 8)");
    expect(sql).toContain("COALESCE(replies.reply_count, 0) * 5");
    expect(sql).toContain("BETWEEN 1 AND 3 THEN 16");
    expect(sql).toContain("TIMESTAMPDIFF(HOUR, p.created_at, UTC_TIMESTAMP()) <= 6 THEN 34");
    expect(sql).not.toContain("feed_viewer_room_membership");
    expect(sql).not.toContain("FROM user_mutes feed_mutes");
  });

  it("separates logged-in discover feed filters from preceding SQL", () => {
    const sql = buildDiscoverFeedQuery(capabilities, 42);

    expect(sql).toContain("p.parent_id IS NULL AND NOT EXISTS");
    expect(sql).toContain("feed_viewer_room_membership.user_id = 42");
    expect(sql).toContain("CASE WHEN feed_viewer_room_membership.id IS NULL THEN 0 ELSE 10 END");
    expect(sql).toContain("COALESCE(followed_likes.followed_like_count, 0) * 4");
    expect(sql).not.toContain("NULLAND");
    expect(sql).toContain("FROM user_mutes feed_mutes");
  });

  it("matches PHP profile reblog query joins and ordering", () => {
    const sql = buildPublicProfileReblogsQuery(capabilities, null);

    expect(sql).toContain("INNER JOIN post_reblogs profile_reblogs ON profile_reblogs.post_id = p.id");
    expect(sql).toContain("profile_reblogger.handle = ?");
    expect(sql).toContain("profile_reblogs.created_at DESC, profile_reblogs.id DESC");
  });

  it("matches PHP people-to-watch filters and ordering", () => {
    const sql = buildPeopleToWatchQuery(capabilities, 42);

    expect(sql).toContain("p.visibility = 'public'");
    expect(sql).toContain("u.handle NOT REGEXP '^smoketest[0-9]+$'");
    expect(sql).toContain("u.id <> 42");
    expect(sql).toContain("profile_modules.module_count");
    expect(sql).toContain("featured_badges.badge_count");
    expect(sql).toContain("WHEN viewer_follows.following_id IS NOT NULL THEN -60");
    expect(sql).toContain("BETWEEN 1 AND 4 THEN 18");
    expect(sql).toContain("LEAST(COALESCE(profile_posts.post_count, 0), 18) * 3");
    expect(sql).toContain("discover_rank_score DESC");
    expect(sql).toContain("LIMIT 24");
  });

  it("diversifies the top discover window by author and room", () => {
    const posts = [
      discoverPost(1, 1, 10),
      discoverPost(2, 1, 10),
      discoverPost(3, 1, 10),
      discoverPost(4, 1, 10),
      discoverPost(5, 2, 10),
      discoverPost(6, 3, 10),
      discoverPost(7, 4, 10),
      discoverPost(8, 5, 20),
    ];

    const diversified = diversifyDiscoverPosts(posts, 5);

    expect(diversified.slice(0, 5).map((post) => post.id)).toEqual([1, 2, 3, 5, 8]);
    expect(diversified.slice(0, 5).filter((post) => post.author.id === 1)).toHaveLength(3);
    expect(diversified.slice(0, 5).filter((post) => post.room?.id === 10)).toHaveLength(4);
  });

  it("keeps fresher feed bands ahead of older posts while shuffling", () => {
    const nowMs = Date.parse("2026-07-09T12:00:00Z");
    const posts = [
      discoverPost(1, 1, null, "2026-06-30T12:00:00Z"),
      discoverPost(2, 2, null, "2026-07-05T12:00:00Z"),
      discoverPost(3, 3, null, "2026-07-08T00:00:00Z"),
      discoverPost(4, 4, null, "2026-07-09T08:00:00Z"),
      discoverPost(5, 5, null, null),
    ];

    const shuffled = shuffleFeedPostsByFreshness(posts, nowMs, () => 0.99);

    expect(shuffled.map((post) => post.id)).toEqual([4, 3, 2, 1, 5]);
  });

  it("shuffles same-band feed posts only inside adjacent chunks", () => {
    const nowMs = Date.parse("2026-07-09T12:00:00Z");
    const posts = Array.from({ length: 6 }, (_, index) =>
      discoverPost(index + 1, index + 1, null, "2026-07-09T11:00:00Z"),
    );

    const shuffled = shuffleFeedPostsByFreshness(posts, nowMs, () => 0);

    expect(shuffled.map((post) => post.id)).toEqual([2, 3, 4, 1, 6, 5]);
    expect(shuffled.slice(0, 4).map((post) => post.id).sort()).toEqual([1, 2, 3, 4]);
    expect(shuffled.slice(4).map((post) => post.id).sort()).toEqual([5, 6]);
  });

  it("lightly shuffles adjacent people candidates without crossing chunks", () => {
    const shuffled = shuffleAdjacentChunks(["a", "b", "c", "d", "e"], 4, () => 0);

    expect(shuffled).toEqual(["b", "c", "d", "a", "e"]);
  });

  it("does not emit malformed viewer-aware SQL joins", () => {
    const queries = [
      buildPublicPostsQuery(capabilities, 42),
      buildHomeFeedQuery(capabilities, 42),
      buildDiscoverFeedQuery(capabilities, 42),
      buildPeopleToWatchQuery(capabilities, 42),
    ];

    for (const sql of queries) {
      expect(sql).not.toContain("NULLAND");
      expect(sql).not.toContain(")AND");
      expect(sql).not.toContain("42AND");
    }
  });

  it("bulk-hydrates distinct Posts without per-Post entity or attachment queries", async () => {
    const calls: Array<{ sql: string; params: unknown[] }> = [];
    const execute = vi.fn(async (sqlValue: unknown, paramsValue: unknown[] = []) => {
      const sql = String(sqlValue);
      const params = [...paramsValue];
      calls.push({ sql, params });

      if (sql.includes("INFORMATION_SCHEMA.TABLES") || sql.includes("INFORMATION_SCHEMA.COLUMNS")) {
        return [[{ table_count: 1, column_count: 1 }], []];
      }

      if (sql.includes("FROM posts p")) {
        return [[postRow(2), postRow(1)], []];
      }

      if (sql.includes("FROM text_entities e")) {
        return [[], []];
      }

      if (sql.includes("FROM post_attachments")) {
        return [[{
          id: 91,
          post_id: 1,
          position: 0,
          kind: "image",
          url: "/uploads/media/native-post.webp",
          mime: "image/webp",
          size_bytes: 4000,
          width: 1200,
          height: 900,
          duration_seconds: null,
          poster_url: null,
          provider: null,
          resource_type: null,
          resource_id: null,
          resource_key: null,
          source_url: null,
          card_json: null,
          created_at: "2026-07-16 01:00:00",
          updated_at: "2026-07-16 01:00:00",
        }], []];
      }

      throw new Error(`Unexpected Post batch query: ${sql}`);
    });
    const repository = createPostsRepository({ execute } as unknown as Pool);

    const posts = await repository.getPublicPostsByIds([1, 2, 1], 42, "https://thia.lol/");

    expect([...posts.keys()]).toEqual([2, 1]);
    expect(posts.get(1)).toMatchObject({
      id: 1,
      canonicalUrl: "https://thia.lol/@author-1/posts/p0000001",
      attachments: [{ kind: "image", width: 1200, height: 900 }],
    });
    expect(calls.filter(({ sql }) => sql.includes("FROM posts p"))).toHaveLength(1);
    expect(calls.filter(({ sql }) => sql.includes("FROM text_entities e"))).toHaveLength(2);
    expect(calls.filter(({ sql }) => sql.includes("FROM post_attachments"))).toHaveLength(1);
    expect(calls.find(({ sql }) => sql.includes("FROM posts p"))?.params).toEqual([1, 2]);
  });
});

function discoverPost(
  id: number,
  authorId: number,
  roomId: number | null,
  createdAt: string | null = "2026-07-09T12:00:00Z",
): PostPayload {
  return {
    id,
    createdAt,
    author: {
      id: authorId,
      handle: `author-${authorId}`,
      displayName: `Author ${authorId}`,
      initials: "A",
      aura: "frost",
      avatarUrl: null,
    },
    room: roomId === null
      ? null
      : {
          id: roomId,
          slug: `room-${roomId}`,
          name: `Room ${roomId}`,
        },
  } as PostPayload;
}

function postRow(id: number): Record<string, unknown> {
  return {
    post_id: id,
    post_public_id: `p000000${id}`,
    post_parent_id: null,
    post_body: `Post ${id}`,
    post_body_format: "plain",
    post_content_version: 1,
    post_mood: "warm",
    post_media_url: null,
    post_media_type: null,
    post_media_mime: null,
    post_media_poster_url: null,
    post_visibility: "public",
    post_status: "published",
    post_deleted_at: null,
    post_created_at: "2026-07-16 01:00:00",
    post_updated_at: "2026-07-16 01:00:00",
    user_id: 100 + id,
    handle: `author-${id}`,
    display_name: `Author ${id}`,
    bio: "",
    location: "",
    avatar_url: null,
    profile_visibility: "public",
    links: null,
    traits: null,
    profile_created_at: "2026-07-16 01:00:00",
    profile_updated_at: "2026-07-16 01:00:00",
    room_id: null,
    reaction_glow_count: 0,
    reaction_echo_count: 0,
    reaction_hush_count: 0,
    reply_count: 0,
    current_like_user_id: null,
    current_viewer_user_id: 42,
    current_user_follows_author: 0,
    author_follows_current_user: 0,
    followed_like_count: 0,
    reblog_count: 0,
    current_reblog_user_id: null,
    reblogged_by_user_id: null,
    reblogged_by_handle: null,
    reblogged_by_display_name: null,
    reblogged_by_avatar_url: null,
    reblogged_at: null,
  };
}
