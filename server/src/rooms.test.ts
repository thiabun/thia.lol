import type { Pool } from "mysql2/promise";
import { describe, expect, it, vi } from "vitest";

import {
  buildPublicRoomMemberRoomQuery,
  buildPublicRoomMembersQuery,
  buildPublicRoomBySlugQuery,
  buildPublicRoomsByIdsQuery,
  buildPublicRoomsBySlugsQuery,
  buildPublicRoomsQuery,
  createRoomsRepository,
  initialsFromName,
  normalizeRoomSlug,
  roomMemberPayloadFromRow,
  roomPayloadFromRow,
  roomStorageReady,
  type RoomMemberRow,
  type RoomRow,
  type RoomSchemaCapabilities,
} from "./rooms.js";

const fullCapabilities: RoomSchemaCapabilities = {
  hasRoomMemberships: true,
  hasRoomCustomizationColumns: true,
  hasRoomThemeColumns: true,
  hasLegacyRoomAccentColumn: false,
  hasRoomSoftDeleteColumn: true,
  hasRoomAccessRequests: true,
  hasRoomRulesVersionColumn: true,
  hasRoomInvitations: true,
};

function roomRow(overrides: Partial<RoomRow> = {}): RoomRow {
  return {
    room_id: 7,
    room_slug: "general",
    room_name: "General",
    room_summary: "Public room for general posts.",
    room_mood: "warm",
    room_member_count: "12",
    room_is_live: 0,
    room_theme: "sunveil",
    room_theme_config_json: '{"mode":"preset","preset":"sunveil"}',
    room_legacy_accent: null,
    room_icon_url: "/uploads/rooms/general.png",
    room_banner_url: null,
    room_rules: null,
    room_rules_version: 1,
    room_visibility: "public",
    room_created_by: "42",
    current_room_role: null,
    current_room_joined: 0,
    current_viewer_signed_in: 0,
    current_viewer_is_admin: 0,
    current_room_access_request_status: null,
    current_room_invitation_status: null,
    owner_user_id: "42",
    owner_handle: "thia",
    owner_display_name: "Thia Bun",
    owner_avatar_url: null,
    room_post_count: "5",
    room_latest_activity_at: "2026-06-23 11:00:00",
    room_created_at: "2026-06-20 09:00:00",
    room_updated_at: "2026-06-22 10:00:00",
    ...overrides,
  } as RoomRow;
}

function roomMemberRow(overrides: Partial<RoomMemberRow> = {}): RoomMemberRow {
  return {
    id: "9",
    role: "moderator",
    joined_at: "2026-06-21 11:00:00",
    user_id: "42",
    handle: "thia",
    display_name: "Thia Bun",
    avatar_url: null,
    ...overrides,
  } as RoomMemberRow;
}

describe("room preview payload mapping", () => {
  it("maps the PHP room payload shape", () => {
    expect(roomPayloadFromRow(roomRow())).toEqual({
      id: 7,
      slug: "general",
      name: "General",
      summary: "Public room for general posts.",
      description: "Public room for general posts.",
      mood: "warm",
      members: 12,
      memberCount: 12,
      live: false,
      theme: "glinda",
      themeConfig: { mode: "preset", preset: "glinda" },
      iconUrl: "/uploads/rooms/general.png",
      bannerUrl: null,
      rules: "",
      rulesVersion: 1,
      visibility: "public",
      createdBy: 42,
      owner: {
        id: 42,
        handle: "thia",
        displayName: "Thia Bun",
        initials: "TB",
        aura: "frost",
        avatarUrl: null,
      },
      joinedByMe: false,
      myRoomRole: null,
      viewerCanViewPosts: true,
      viewerCanPost: false,
      viewerCanReact: false,
      viewerCanJoin: false,
      viewerCanRequestAccess: false,
      accessRequestStatus: null,
      postCount: 5,
      latestActivityAt: "2026-06-23 11:00:00",
      createdAt: "2026-06-20 09:00:00",
      updatedAt: "2026-06-22 10:00:00",
    });
  });

  it("keeps unauthenticated room defaults and nullable media fields stable", () => {
    const payload = roomPayloadFromRow(
      roomRow({
        room_member_count: null,
        room_icon_url: null,
        room_banner_url: null,
        room_rules: null,
        room_post_count: null,
        owner_user_id: null,
        owner_handle: null,
        owner_display_name: null,
        owner_avatar_url: null,
      }),
    );

    expect(payload.members).toBe(0);
    expect(payload.memberCount).toBe(0);
    expect(payload.iconUrl).toBeNull();
    expect(payload.bannerUrl).toBeNull();
    expect(payload.rules).toBe("");
    expect(payload.owner).toBeNull();
    expect(payload.joinedByMe).toBe(false);
    expect(payload.myRoomRole).toBeNull();
    expect(payload.postCount).toBe(0);
  });

  it("requires an active membership before public room posting", () => {
    expect(
      roomPayloadFromRow(
        roomRow({
          current_viewer_signed_in: 1,
          current_room_joined: 0,
          current_room_role: null,
        }),
      ).viewerCanPost,
    ).toBe(false);
    expect(
      roomPayloadFromRow(
        roomRow({
          current_viewer_signed_in: 1,
          current_room_joined: 1,
          current_room_role: "member",
        }),
      ).viewerCanPost,
    ).toBe(true);
  });

  it("lets a pending invitee review and join a private room without exposing its posts", () => {
    expect(
      roomPayloadFromRow(
        roomRow({
          room_visibility: "private",
          current_viewer_signed_in: 1,
          current_room_invitation_status: "pending",
        }),
      ),
    ).toMatchObject({
      viewerCanJoin: true,
      viewerCanViewPosts: false,
      viewerCanPost: false,
      viewerCanRequestAccess: false,
    });
  });

  it("lets former invite-room members reopen an approved access request", () => {
    expect(
      roomPayloadFromRow(
        roomRow({
          room_visibility: "invite",
          current_viewer_signed_in: 1,
          current_room_access_request_status: "approved",
        }),
      ).viewerCanRequestAccess,
    ).toBe(true);
  });

  it("derives a preset theme from legacy room accents before migration", () => {
    expect(
      roomPayloadFromRow(
        roomRow({
          room_theme: null,
          room_theme_config_json: null,
          room_legacy_accent: "var(--accent-leaf)",
        }),
      ),
    ).toMatchObject({
      theme: "leafveil",
      themeConfig: { mode: "preset", preset: "leafveil" },
    });
  });

  it("normalizes slugs with the same public room constraints as PHP", () => {
    expect(normalizeRoomSlug("General")).toBe("general");
    expect(normalizeRoomSlug("room-123")).toBe("room-123");
    expect(normalizeRoomSlug("bad_slug")).toBeNull();
    expect(normalizeRoomSlug("")).toBeNull();
  });

  it("generates initials with the PHP fallback", () => {
    expect(initialsFromName("Thia Bun")).toBe("TB");
    expect(initialsFromName("thia")).toBe("T");
    expect(initialsFromName("   ")).toBe("TH");
  });

  it("maps room member payloads like PHP", () => {
    expect(roomMemberPayloadFromRow(roomMemberRow())).toEqual({
      id: 9,
      role: "moderator",
      joinedAt: "2026-06-21 11:00:00",
      user: {
        id: 42,
        handle: "thia",
        displayName: "Thia Bun",
        initials: "TB",
        aura: "frost",
        avatarUrl: null,
      },
    });
  });

  it("falls back unknown room member roles to member", () => {
    expect(roomMemberPayloadFromRow(roomMemberRow({ role: "admin" })).role).toBe("member");
  });
});

describe("room preview SQL", () => {
  it("batches Room ids and slugs with the exact viewer-aware detail visibility rules", () => {
    const viewer = { userId: 17, role: "member" };
    const idsQuery = buildPublicRoomsByIdsQuery(2, fullCapabilities, viewer);
    const slugsQuery = buildPublicRoomsBySlugsQuery(3, fullCapabilities, viewer);

    for (const query of [idsQuery, slugsQuery]) {
      expect(query).toContain("AND (rooms.visibility <> 'private'");
      expect(query).toContain("viewer_room_membership.id IS NOT NULL");
      expect(query).toContain("viewer_room_invitation.status = 'pending'");
      expect(query).toContain("AND rooms.deleted_at IS NULL");
    }
    expect(idsQuery).toContain("WHERE rooms.id IN (?, ?)");
    expect(slugsQuery).toContain("WHERE rooms.slug IN (?, ?, ?)");
    expect(() => buildPublicRoomsByIdsQuery(0, fullCapabilities, viewer)).toThrow("batch size is invalid");
  });

  it("orders public rooms like the PHP endpoint", () => {
    expect(buildPublicRoomsQuery(fullCapabilities)).toContain(
      "ORDER BY room_posts.latest_activity_at DESC, rooms.is_live DESC, rooms.name ASC",
    );
  });

  it("uses schema capability fallbacks for older room storage", () => {
    const query = buildPublicRoomsQuery({
      hasRoomMemberships: false,
      hasRoomCustomizationColumns: false,
      hasRoomThemeColumns: false,
      hasLegacyRoomAccentColumn: true,
      hasRoomSoftDeleteColumn: false,
      hasRoomAccessRequests: false,
      hasRoomRulesVersionColumn: false,
      hasRoomInvitations: false,
    });

    expect(query).toContain("rooms.member_count AS room_member_count");
    expect(query).toContain("rooms.accent AS room_legacy_accent");
    expect(query).toContain("NULL AS room_icon_url");
    expect(query).not.toContain("room_member_counts");
    expect(query).not.toContain("rooms.deleted_at IS NULL");
  });

  it("builds a parameterized room detail query", () => {
    const query = buildPublicRoomBySlugQuery(fullCapabilities, { userId: 17, role: "member" });

    expect(query).toContain("WHERE rooms.slug = ?");
    expect(query).toContain("AND (rooms.visibility <> 'private'");
    expect(query).toContain("LEFT JOIN room_invitations viewer_room_invitation");
    expect(query).toContain("viewer_room_invitation.status = 'pending'");
    expect(query).toContain("AND rooms.deleted_at IS NULL");
    expect(query).toContain("LIMIT 1");
  });

  it("builds room member queries with PHP visibility and ordering constraints", () => {
    const roomQuery = buildPublicRoomMemberRoomQuery(fullCapabilities, { userId: 17, role: "member" });
    const membersQuery = buildPublicRoomMembersQuery();

    expect(roomQuery).toContain("WHERE rooms.slug = ?");
    expect(roomQuery).toContain("rooms.visibility IN ('public', 'view_only')");
    expect(roomQuery).not.toContain("room_invitations");
    expect(roomQuery).toContain("deleted_at IS NULL");
    expect(membersQuery).toContain("FROM room_memberships memberships");
    expect(membersQuery).toContain("memberships.banned_at IS NULL");
    expect(membersQuery).toContain("users.status = 'active'");
    expect(membersQuery).toContain("FIELD(memberships.role, 'owner', 'moderator', 'member')");
    expect(membersQuery).toContain("LIMIT 100");
  });

  it("requires full room v2 storage for room members like PHP", () => {
    expect(roomStorageReady(fullCapabilities)).toBe(true);
    expect(
      roomStorageReady({
        hasRoomMemberships: true,
        hasRoomCustomizationColumns: true,
        hasRoomThemeColumns: true,
        hasLegacyRoomAccentColumn: false,
        hasRoomSoftDeleteColumn: false,
        hasRoomAccessRequests: true,
        hasRoomRulesVersionColumn: true,
        hasRoomInvitations: true,
      }),
    ).toBe(false);
  });

  it("loads multiple distinct Room attachments in one repository query", async () => {
    const calls: Array<{ sql: string; params: unknown[] }> = [];
    const execute = vi.fn(async (sqlValue: unknown, paramsValue: unknown[] = []) => {
      const sql = String(sqlValue);
      const params = [...paramsValue];
      calls.push({ sql, params });

      if (sql.includes("INFORMATION_SCHEMA.TABLES") || sql.includes("INFORMATION_SCHEMA.COLUMNS")) {
        return [[{ table_count: 1, column_count: 1 }], []];
      }

      if (sql.includes("WHERE rooms.id IN (?, ?)")) {
        return [[
          roomRow(),
          roomRow({ room_id: 8, room_slug: "moon-garden", room_name: "Moon Garden" }),
        ], []];
      }

      throw new Error(`Unexpected Room batch query: ${sql}`);
    });
    const repository = createRoomsRepository({ execute } as unknown as Pool);

    const rooms = await repository.getPublicRoomsByIds([7, 8, 7], { userId: 17, role: "member" });

    expect([...rooms.keys()]).toEqual([7, 8]);
    expect(rooms.get(8)).toMatchObject({ slug: "moon-garden", name: "Moon Garden" });
    const roomQueries = calls.filter(({ sql }) => sql.includes("WHERE rooms.id IN"));
    expect(roomQueries).toHaveLength(1);
    expect(roomQueries[0]?.params).toEqual([7, 8]);
  });
});
