import { describe, expect, it } from "vitest";

import {
  buildSearchProfilesQuery,
  buildSearchRoomsQuery,
  normalizeSearchQuery,
  searchLikePattern,
  searchPayloadFromResults,
  searchProfilePayloadFromRow,
  type SearchProfileRow,
  type SearchSchemaCapabilities,
} from "./search.js";

const capabilities: SearchSchemaCapabilities = {
  hasAccountDeletionRequests: true,
  hasProfileVisibilityColumn: true,
  hasUserBlocks: true,
  hasUserMutes: true,
  hasRoomMemberships: true,
  hasRoomCustomizationColumns: true,
  hasRoomSoftDeleteColumn: true,
  hasRoomAccessRequests: true,
};

describe("search preview helpers", () => {
  it("normalizes query text like PHP", () => {
    expect(normalizeSearchQuery("  thia   bun  ")).toBe("thia bun");
    expect(normalizeSearchQuery(["thia"])).toBe("");
    expect(normalizeSearchQuery("x".repeat(81))).toHaveLength(80);
  });

  it("escapes LIKE wildcards and supports prefix or anywhere matching", () => {
    expect(searchLikePattern("th_a%", true)).toBe("th\\_a\\%%");
    expect(searchLikePattern("th_a%", false)).toBe("%th\\_a\\%%");
  });

  it("maps profile search rows to the PHP payload shape", () => {
    expect(
      searchProfilePayloadFromRow({
        user_id: "7",
        handle: "thia",
        display_name: "Thia Bun",
        avatar_url: null,
        bio: "  Founder   profile.  ",
        search_rank: 0,
      } as SearchProfileRow),
    ).toEqual({
      user: {
        id: 7,
        handle: "thia",
        displayName: "Thia Bun",
        initials: "TB",
        aura: "frost",
        avatarUrl: null,
      },
      bioSnippet: "Founder profile.",
    });
  });

  it("builds the short-query empty payload without database results", () => {
    expect(searchPayloadFromResults("t", [], [])).toEqual({
      query: "t",
      minQueryLength: 2,
      results: {
        profiles: [],
        rooms: [],
      },
    });
  });
});

describe("search preview SQL", () => {
  it("matches PHP profile search constraints for anonymous viewers", () => {
    const query = buildSearchProfilesQuery(capabilities, null);

    expect(query).toContain("FROM users u");
    expect(query).toContain("INNER JOIN profiles p ON p.user_id = u.id");
    expect(query).toContain("u.status = 'active'");
    expect(query).toContain("FROM account_deletion_requests public_account_deletions");
    expect(query).toContain("AND p.visibility = 'public'");
    expect(query).toContain("AND (NULL IS NULL OR u.id <> NULL)");
    expect(query).not.toContain("FROM user_mutes feed_mutes");
    expect(query).toContain("ORDER BY search_rank ASC, u.created_at DESC, u.id DESC");
    expect(query).toContain("LIMIT 8");
  });

  it("adds PHP viewer exclusion, block filters, and mute filters for logged-in viewers", () => {
    const query = buildSearchProfilesQuery(capabilities, 42);

    expect(query).toContain("AND (42 IS NULL OR u.id <> 42)");
    expect(query).toContain("FROM user_blocks pair_blocks");
    expect(query).toContain("pair_blocks.blocker_id = 42");
    expect(query).toContain("FROM user_mutes feed_mutes");
    expect(query).toContain("feed_mutes.muter_id = 42");
    expect(query).not.toContain("NULLAND");
  });

  it("matches PHP room search constraints and ordering", () => {
    const query = buildSearchRoomsQuery(capabilities);

    expect(query).toContain("FROM rooms");
    expect(query).toContain("rooms.visibility IN ('public', 'invite', 'view_only')");
    expect(query).toContain("AND rooms.deleted_at IS NULL");
    expect(query).toContain("COALESCE(room_member_counts.member_count, 0) AS room_member_count");
    expect(query).toContain("rooms.icon_url AS room_icon_url");
    expect(query).toContain("LOWER(COALESCE(rooms.summary, '')) LIKE ?");
    expect(query).toContain("ORDER BY search_rank ASC, room_posts.latest_activity_at DESC, rooms.name ASC");
    expect(query).toContain("LIMIT 8");
  });

  it("uses PHP-compatible room capability fallbacks", () => {
    const query = buildSearchRoomsQuery({
      ...capabilities,
      hasRoomMemberships: false,
      hasRoomCustomizationColumns: false,
      hasRoomSoftDeleteColumn: false,
      hasRoomAccessRequests: false,
    });

    expect(query).toContain("rooms.member_count AS room_member_count");
    expect(query).toContain("NULL AS room_icon_url");
    expect(query).not.toContain("room_member_counts");
    expect(query).not.toContain("rooms.deleted_at IS NULL");
  });
});
