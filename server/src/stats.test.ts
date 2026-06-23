import { describe, expect, it } from "vitest";

import {
  buildPublicStatsQuery,
  statsPayloadFromRow,
  type StatsRow,
  type StatsSchemaCapabilities,
} from "./stats.js";

const fullCapabilities: StatsSchemaCapabilities = {
  hasRoomSoftDeleteColumn: true,
};

describe("stats preview payload mapping", () => {
  it("maps DB string and number values to the PHP public stats shape", () => {
    const payload = statsPayloadFromRow({
      public_rooms: "4",
      public_posts: 12,
      active_users: "3",
      total_reactions: null,
    } as StatsRow);

    expect(payload).toEqual({
      publicRooms: 4,
      publicPosts: 12,
      activeUsers: 3,
      totalReactions: 0,
    });
  });
});

describe("stats preview SQL", () => {
  it("matches PHP's public stats constraints", () => {
    const query = buildPublicStatsQuery(fullCapabilities);

    expect(query).toContain("FROM rooms");
    expect(query).toContain("visibility = ?");
    expect(query).toContain("rooms.deleted_at IS NULL");
    expect(query).toContain("stat_posts.parent_id IS NULL");
    expect(query).toContain("stat_posts.status = ?");
    expect(query).toContain("stat_posts.deleted_at IS NULL");
    expect(query).toContain("FROM users");
    expect(query).toContain("WHERE status = ?");
    expect(query).toContain("FROM post_reactions reactions");
    expect(query).toContain("reactions.type = ?");
    expect(query).toContain("reaction_posts.status = ?");
    expect(query).toContain("reaction_posts.deleted_at IS NULL");
  });

  it("omits room soft-delete filters when the column is unavailable", () => {
    const query = buildPublicStatsQuery({
      hasRoomSoftDeleteColumn: false,
    });

    expect(query).not.toContain("rooms.deleted_at IS NULL");
    expect(query).not.toContain("stat_rooms.deleted_at IS NULL");
    expect(query).not.toContain("reaction_rooms.deleted_at IS NULL");
    expect(query).toContain("stat_posts.deleted_at IS NULL");
    expect(query).toContain("reaction_posts.deleted_at IS NULL");
  });
});
