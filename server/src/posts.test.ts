import { describe, expect, it } from "vitest";

import {
  buildDiscoverFeedQuery,
  buildHomeFeedQuery,
  buildPeopleToWatchQuery,
  buildPublicPostsQuery,
  buildPublicProfileReblogsQuery,
  normalizePostIdentifier,
  postCanonicalPath,
  type PostDetailPayload,
} from "./posts.js";
import type { ProfileSchemaCapabilities } from "./profiles.js";

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
  hasRoomSoftDeleteColumn: true,
  hasPostPublicIdColumn: true,
  hasPostReblogs: true,
  hasTextEntities: true,
  hasProfileModules: true,
  hasProfileModuleLayoutColumns: true,
  hasProfileModulePinnedColumn: true,
  hasBadges: true,
  hasUserBadges: true,
  hasProfileIntegrationAccounts: true,
  hasProfileIntegrationMetadataCache: true,
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
  it("matches PHP public post list constraints and viewer state joins", () => {
    const sql = buildPublicPostsQuery(capabilities, 42);

    expect(sql).toContain("AND p.parent_id IS NULL");
    expect(sql).toContain("current_like.user_id = 42");
    expect(sql).toContain("viewer_follows_author.follower_id = 42");
    expect(sql).toContain("pr.visibility = 'public'");
    expect(sql).toContain("OR u.id = 42");
    expect(sql).toContain("profile_posts.room_id IS NULL");
    expect(sql).toContain("profile_post_rooms.visibility = 'public'");
    expect(sql).toContain("profile_post_rooms.deleted_at IS NULL");
  });

  it("matches PHP home feed ranking and relationship filters", () => {
    const sql = buildHomeFeedQuery(capabilities, 42);

    expect(sql).toContain("feed_rank_score DESC, p.created_at DESC, p.id DESC");
    expect(sql).toContain("home_reblog_follows.follower_id = 42");
    expect(sql).toContain("CASE WHEN u.id = 42 THEN -45 ELSE 0 END");
    expect(sql).toContain("FROM user_mutes feed_mutes");
    expect(sql).toContain("feed_mutes.muter_id = 42");
    expect(sql).not.toContain("NULLAND");
  });

  it("matches PHP discover ranking and public wrapper constraints", () => {
    const sql = buildDiscoverFeedQuery(capabilities, null);

    expect(sql).toContain("feed_rank_score DESC, p.created_at DESC, p.id DESC");
    expect(sql).toContain("LEAST(COALESCE(room_posts.post_count, 0), 10)");
    expect(sql).toContain("TIMESTAMPDIFF(HOUR, p.created_at, UTC_TIMESTAMP()) <= 6");
    expect(sql).not.toContain("FROM user_mutes feed_mutes");
  });

  it("separates logged-in discover feed filters from preceding SQL", () => {
    const sql = buildDiscoverFeedQuery(capabilities, 42);

    expect(sql).toContain("p.parent_id IS NULL AND NOT EXISTS");
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
    expect(sql).toContain("discover_rank_score DESC");
    expect(sql).toContain("LIMIT 24");
  });
});
