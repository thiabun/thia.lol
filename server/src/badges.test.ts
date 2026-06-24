import { describe, expect, it } from "vitest";

import {
  badgePayloadFromRow,
  badgeStorageReady,
  buildPublicBadgesQuery,
  type BadgeRow,
} from "./badges.js";

describe("badge preview payload mapping", () => {
  it("maps the PHP public badge payload shape", () => {
    const payload = badgePayloadFromRow({
      badge_id: "7",
      badge_key: "founder",
      badge_name: "Founder",
      badge_description: "Early member.",
      badge_rarity: "founder",
      badge_source: "admin-granted",
      badge_icon: "sparkles",
      badge_accent: "gold",
      badge_is_active: "1",
      badge_created_at: "2026-06-10 10:00:00",
    } as BadgeRow);

    expect(payload).toEqual({
      id: 7,
      badgeKey: "founder",
      name: "Founder",
      description: "Early member.",
      rarity: "founder",
      source: "admin-granted",
      icon: "sparkles",
      accent: "gold",
      isActive: true,
      createdAt: "2026-06-10 10:00:00",
    });
  });

  it("falls back to common rarity and inactive boolean defaults like PHP", () => {
    const payload = badgePayloadFromRow({
      badge_id: 8,
      badge_key: "custom",
      badge_name: "Custom",
      badge_description: null,
      badge_rarity: "unexpected",
      badge_source: "system",
      badge_icon: null,
      badge_accent: null,
      badge_is_active: "0",
      badge_created_at: null,
    } as BadgeRow);

    expect(payload.rarity).toBe("common");
    expect(payload.isActive).toBe(false);
    expect(payload.description).toBeNull();
    expect(payload.createdAt).toBeNull();
  });
});

describe("badge preview SQL", () => {
  it("matches PHP public badge constraints and ordering", () => {
    const query = buildPublicBadgesQuery();

    expect(query).toContain("FROM badges b");
    expect(query).toContain("WHERE b.is_active = 1");
    expect(query).toContain("WHEN 'founder' THEN 1");
    expect(query).toContain("WHEN 'common' THEN 5");
    expect(query).toContain("ORDER BY");
    expect(query).toContain("b.name ASC");
  });

  it("requires both badge tables like PHP storage readiness", () => {
    expect(
      badgeStorageReady({
        hasBadges: true,
        hasUserBadges: true,
      }),
    ).toBe(true);
    expect(
      badgeStorageReady({
        hasBadges: true,
        hasUserBadges: false,
      }),
    ).toBe(false);
  });
});
