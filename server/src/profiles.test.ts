import { describe, expect, it } from "vitest";

import {
  buildProfileBadgesQuery,
  buildProfileByHandleQuery,
  buildProfileFollowListQuery,
  buildPublicProfileModulesQuery,
  buildPublicProfileRoomsQuery,
  followUserCardPayloadFromRow,
  normalizeProfileHandle,
  profileBadgesPayloadFromRows,
  profileIntegrationCachePayload,
  profileIntegrationGeneratedCardPayload,
  profileIntegrationNormalizeUrl,
  profileModuleLayoutPayload,
  profilePayloadFromRow,
  profilePayloadWithFeatured,
  type FollowUserRow,
  type ProfileIntegrationCacheRow,
  type ProfileModuleRow,
  type ProfileRow,
  type ProfileSchemaCapabilities,
  type ProfileSocialContext,
  type UserBadgeRow,
} from "./profiles.js";

const fullCapabilities: ProfileSchemaCapabilities = {
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

const social: ProfileSocialContext = {
  followerCount: 14,
  followingCount: 27,
  mootCount: 14,
  starCount: 2,
  isFollowing: false,
  isFollowedBy: false,
  isMoot: false,
  isStarred: false,
  isFollowRequestPending: false,
  isBlocked: false,
  isMuted: false,
};

function profileRow(overrides: Partial<ProfileRow> = {}): ProfileRow {
  return {
    user_id: 1,
    handle: "thia",
    user_status: "active",
    display_name: "Thia Bun",
    bio: "Founder profile.",
    location: "Oslo",
    avatar_url: "/uploads/avatar.png",
    banner_url: "/uploads/banner.png",
    profile_accent: "sunveil",
    profile_background: "/uploads/background.png",
    profile_background_video_url: "/uploads/background.mp4",
    profile_background_video_poster_url: "/uploads/background-poster.jpg",
    profile_background_blur: "heavy",
    profile_theme: "sunveil",
    profile_theme_config_json: '{"mode":"preset","preset":"sunveil"}',
    profile_layout_preset: "showcase",
    profile_canvas_version: "2",
    profile_canvas_glass_opacity: "80",
    visibility: "public",
    featured_post_id: "76",
    featured_room_id: "3",
    links: '[{"platform":"website","url":"https://thia.lol"}]',
    traits: '["builder"]',
    profile_created_at: "2026-06-01 10:00:00",
    profile_updated_at: "2026-06-22 10:00:00",
    post_count: "6",
    profile_reply_count: "8",
    room_count: "3",
    profile_like_count: "25",
    star_count: "2",
    ...overrides,
  } as ProfileRow;
}

describe("profile preview handle normalization", () => {
  it("matches PHP public profile handle constraints", () => {
    expect(normalizeProfileHandle("Thia")).toBe("thia");
    expect(normalizeProfileHandle("%40Thia")).toBe("thia");
    expect(normalizeProfileHandle("thia_bun-1")).toBe("thia_bun-1");
    expect(normalizeProfileHandle("")).toBeNull();
    expect(normalizeProfileHandle("bad!")).toBeNull();
    expect(normalizeProfileHandle("a".repeat(41))).toBeNull();
  });
});

describe("profile preview payload mapping", () => {
  it("maps the PHP profile detail payload shape", () => {
    expect(profilePayloadFromRow(profileRow(), social, [])).toMatchObject({
      user: {
        id: 1,
        handle: "thia",
        displayName: "Thia Bun",
        initials: "TB",
        aura: "frost",
        avatarUrl: "/uploads/avatar.png",
      },
      bio: "Founder profile.",
      location: "Oslo",
      avatarUrl: "/uploads/avatar.png",
      bannerUrl: "/uploads/banner.png",
      profileAccent: "sunveil",
      profileBackground: "/uploads/background.png",
      profileBackgroundVideo: "/uploads/background.mp4",
      profileBackgroundVideoPoster: "/uploads/background-poster.jpg",
      profileBackgroundBlur: "heavy",
      profileTheme: "sunveil",
      profileThemeConfig: {
        mode: "preset",
        preset: "sunveil",
      },
      profileLayoutPreset: "showcase",
      profileCanvasVersion: 2,
      profileCanvasGlass: 80,
      visibility: "public",
      isPrivate: false,
      viewerCanView: true,
      featuredPostId: 76,
      featuredRoomId: 3,
      links: [
        {
          platform: "website",
          url: "https://thia.lol",
        },
      ],
      traits: ["builder"],
      stats: {
        posts: 6,
        replies: 8,
        rooms: 3,
        echoes: 25,
        followers: 14,
        following: 27,
        moots: 14,
        stars: 2,
      },
      followerCount: 14,
      followingCount: 27,
      mootCount: 14,
      starCount: 2,
      isFollowing: false,
      isFollowedBy: false,
      isMoot: false,
      isStarred: false,
      isFollowRequestPending: false,
      isBlocked: false,
      isMuted: false,
      createdAt: "2026-06-01 10:00:00",
      updatedAt: "2026-06-22 10:00:00",
    });
  });

  it("uses PHP defaults for malformed JSON and nullable featured IDs", () => {
    const payload = profilePayloadWithFeatured(
      profileRow({
        featured_post_id: null,
        featured_room_id: "",
        links: "not-json",
        traits: '{"one":"builder"}',
        profile_theme_config_json: '{"mode":"unknown"}',
        profile_layout_preset: "bad",
        profile_background_blur: "bad",
        profile_canvas_glass_opacity: "999",
      }),
      social,
      [],
      null,
      null,
    );

    expect(payload.featuredPostId).toBeNull();
    expect(payload.featuredRoomId).toBeNull();
    expect(payload.featuredPost).toBeNull();
    expect(payload.featuredRoom).toBeNull();
    expect(payload.links).toEqual([]);
    expect(payload.traits).toEqual(["builder"]);
    expect(payload.profileThemeConfig).toBeNull();
    expect(payload.profileLayoutPreset).toBe("balanced");
    expect(payload.profileBackgroundBlur).toBe("medium");
    expect(payload.profileCanvasGlass).toBe(92);
  });

  it("validates custom theme colors like PHP", () => {
    const payload = profilePayloadFromRow(
      profileRow({
        profile_theme_config_json:
          '{"mode":"custom","colors":{"canvas":"#ffffff","canvasSoft":"#eeeeee","surface":"#dddddd","surfaceStrong":"#cccccc","text":"#111111","muted":"#222222","line":"#333333","lineStrong":"#444444","accent":"#abcdef","accentInk":"#123456","accentStrong":"#654321","focus":"#fedcba"}}',
      }),
      social,
      [],
    );

    expect(payload.profileThemeConfig).toEqual({
      mode: "custom",
      colors: {
        canvas: "#FFFFFF",
        canvasSoft: "#EEEEEE",
        surface: "#DDDDDD",
        surfaceStrong: "#CCCCCC",
        text: "#111111",
        muted: "#222222",
        line: "#333333",
        lineStrong: "#444444",
        accent: "#ABCDEF",
        accentInk: "#123456",
        accentStrong: "#654321",
        focus: "#FEDCBA",
      },
    });
  });

  it("redacts private profile content for unauthenticated preview reads", () => {
    const payload = profilePayloadWithFeatured(
      profileRow({
        visibility: "private",
      }),
      social,
      [
        {
          type: "mention",
          start: 0,
          length: 5,
          text: "@thia",
        },
      ],
      {} as never,
      {} as never,
    );

    expect(payload.viewerCanView).toBe(false);
    expect(payload.isPrivate).toBe(true);
    expect(payload.bio).toBe("");
    expect(payload.bioEntities).toEqual([]);
    expect(payload.location).toBe("");
    expect(payload.profileBackground).toBeNull();
    expect(payload.profileBackgroundVideo).toBeNull();
    expect(payload.profileBackgroundVideoPoster).toBeNull();
    expect(payload.links).toEqual([]);
    expect(payload.traits).toEqual([]);
    expect(payload.featuredPost).toBeNull();
    expect(payload.featuredRoom).toBeNull();
  });
});

describe("profile extras payload mapping", () => {
  it("maps visible badge grants with featured fallback like PHP", () => {
    const rows: UserBadgeRow[] = [
      {
        user_badge_id: "8",
        user_badge_user_id: "1",
        user_badge_badge_id: "2",
        user_badge_reason: null,
        user_badge_earned_at: "2026-06-10 10:00:00",
        user_badge_featured_order: null,
        user_badge_is_visible: "1",
        badge_id: "2",
        badge_key: "early_user",
        badge_name: "Early User",
        badge_description: "Early platform era.",
        badge_rarity: "rare",
        badge_source: "admin-granted",
        badge_icon: "calendar-days",
        badge_accent: "sunveil",
        badge_is_active: "1",
        badge_created_at: "2026-06-10 09:00:00",
        user_id: "1",
        handle: "thia",
        display_name: "Thia Bun",
        avatar_url: "/uploads/avatar.png",
        grantor_user_id: null,
        grantor_handle: null,
        grantor_display_name: null,
        grantor_avatar_url: null,
      } as UserBadgeRow,
    ];

    expect(profileBadgesPayloadFromRows(rows)).toEqual({
      badges: [
        {
          id: 8,
          badge: {
            id: 2,
            badgeKey: "early_user",
            name: "Early User",
            description: "Early platform era.",
            rarity: "rare",
            source: "admin-granted",
            icon: "calendar-days",
            accent: "sunveil",
            isActive: true,
            createdAt: "2026-06-10 09:00:00",
          },
          reason: null,
          earnedAt: "2026-06-10 10:00:00",
          featuredOrder: null,
          isVisible: true,
          grantedBy: null,
          user: {
            id: 1,
            handle: "thia",
            displayName: "Thia Bun",
            initials: "TB",
            aura: "frost",
            avatarUrl: "/uploads/avatar.png",
          },
        },
      ],
      featuredBadges: [
        expect.objectContaining({
          id: 8,
        }),
      ],
    });
  });

  it("maps compact follow cards and bio snippets like PHP", () => {
    const payload = followUserCardPayloadFromRow({
        user_id: "2",
        handle: "friend",
        display_name: null,
        avatar_url: null,
        bio: ` ${"hello ".repeat(40)} `,
        followed_at: "2026-06-20 10:00:00",
        is_following: "1",
        is_followed_by: "1",
      } as FollowUserRow);

    expect(payload).toMatchObject({
      handle: "friend",
      displayName: "friend",
      initials: "F",
      avatarUrl: null,
      isFollowing: true,
      isMoot: true,
    });
    expect(Buffer.from(payload.bioSnippet, "utf8")).toHaveLength(140);
    expect(payload.bioSnippet).toMatch(/hello\.\.\.$/);
  });

  it("normalizes supported module layouts and rejects unsupported spans", () => {
    expect(
      profileModuleLayoutPayload({
        id: "1",
        user_id: "1",
        type: "profile_info",
        title: null,
        config_json: "{}",
        visibility: "public",
        position: "1",
        grid_column: "99",
        grid_row: "99",
        grid_col_span: "8",
        grid_row_span: "3",
        grid_pinned: "1",
        status: "active",
        schema_version: "1",
        created_at: null,
        updated_at: null,
      } as ProfileModuleRow),
    ).toEqual({
      column: 5,
      row: 14,
      colSpan: 8,
      rowSpan: 3,
    });

    expect(
      profileModuleLayoutPayload({
        id: "1",
        user_id: "1",
        type: "featured_room",
        title: null,
        config_json: "{}",
        visibility: "public",
        position: "1",
        grid_column: "1",
        grid_row: "1",
        grid_col_span: "8",
        grid_row_span: "8",
        grid_pinned: "0",
        status: "active",
        schema_version: "1",
        created_at: null,
        updated_at: null,
      } as ProfileModuleRow),
    ).toBeNull();
  });
});

describe("profile preview SQL", () => {
  it("matches PHP public account and profile constraints", () => {
    const query = buildProfileByHandleQuery(fullCapabilities);

    expect(query).toContain("WHERE u.handle = ?");
    expect(query).toContain("u.status = 'active'");
    expect(query).toContain("account_deletion_requests public_account_deletions");
    expect(query).toContain("p.visibility,");
  });

  it("matches PHP profile rooms owner, public, soft-delete, and ordering constraints", () => {
    const query = buildPublicProfileRoomsQuery(fullCapabilities);

    expect(query).toContain("WHERE owner.handle = ?");
    expect(query).toContain("rooms.visibility IN ('public', 'view_only')");
    expect(query).toContain("rooms.deleted_at IS NULL");
    expect(query).toContain("ORDER BY rooms.created_at DESC, rooms.name ASC");
  });

  it("matches PHP public module filters, layout fallbacks, and ordering constraints", () => {
    const query = buildPublicProfileModulesQuery(fullCapabilities);

    expect(query).toContain("FROM profile_modules");
    expect(query).toContain("AND (visibility = 'public' OR type = 'activity')");
    expect(query).toContain("AND status = 'active'");
    expect(query).toContain("grid_column, grid_row, grid_col_span, grid_row_span");
    expect(query).toContain("ORDER BY position ASC, id ASC");
  });

  it("matches PHP visible active badge grant constraints", () => {
    const query = buildProfileBadgesQuery();

    expect(query).toContain("FROM user_badges ub");
    expect(query).toContain("INNER JOIN badges b ON b.id = ub.badge_id");
    expect(query).toContain("ub.is_visible = 1");
    expect(query).toContain("b.is_active = 1");
    expect(query).toContain("ub.user_id = ?");
    expect(query).toContain("ub.earned_at DESC");
  });

  it("matches PHP follow list filters, blocked-pair filtering, order, and limit", () => {
    const query = buildProfileFollowListQuery("followers", fullCapabilities);

    expect(query).toContain("FROM user_follows follows");
    expect(query).toContain("INNER JOIN users u ON u.id = follows.follower_id");
    expect(query).toContain("WHERE follows.following_id = ?");
    expect(query).toContain("u.status = 'active'");
    expect(query).toContain("FROM user_blocks pair_blocks");
    expect(query).toContain("ORDER BY follows.created_at DESC, u.handle ASC");
    expect(query).toContain("LIMIT 100");
  });

  it("matches PHP public post, room, soft-delete, and active-user constraints", () => {
    const query = buildProfileByHandleQuery(fullCapabilities);

    expect(query).toContain("profile_posts.parent_id IS NULL");
    expect(query).toContain("profile_posts.visibility = 'public'");
    expect(query).toContain("profile_posts.status = 'published'");
    expect(query).toContain("profile_posts.deleted_at IS NULL");
    expect(query).toContain("profile_replies.parent_id IS NOT NULL");
    expect(query).toContain("profile_rooms.visibility IN ('public', 'view_only')");
    expect(query).toContain("profile_rooms.deleted_at IS NULL");
    expect(query).toContain("profile_star_users.status = 'active'");
    expect(query).toContain("FROM user_blocks pair_blocks");
  });

  it("uses schema fallbacks for older profile storage", () => {
    const query = buildProfileByHandleQuery({
      ...fullCapabilities,
      hasAccountDeletionRequests: false,
      hasProfileCustomizationColumns: false,
      hasProfileBackgroundVideoColumns: false,
      hasProfileBackgroundBlurColumn: false,
      hasProfileLayoutPresetColumn: false,
      hasProfileCanvasVersionColumn: false,
      hasProfileCanvasGlassColumn: false,
      hasProfileThemeConfigColumn: false,
      hasProfileFeaturedColumns: false,
      hasProfileVisibilityColumn: false,
      hasProfileStars: false,
      hasUserBlocks: false,
      hasRoomSoftDeleteColumn: false,
      hasRoomAccessRequests: false,
    });

    expect(query).toContain("NULL AS banner_url");
    expect(query).toContain("NULL AS featured_post_id");
    expect(query).toContain("'public' AS visibility");
    expect(query).toContain("0 AS star_count");
    expect(query).not.toContain("account_deletion_requests");
    expect(query).not.toContain("pair_blocks");
    expect(query).not.toContain("profile_rooms.deleted_at IS NULL");
  });
});

describe("profile integration payloads", () => {
  it("generates YouTube iframe embeds when cached rows have empty embed JSON", () => {
    const payload = profileIntegrationCachePayload({
      provider: "youtube",
      resource_type: "video",
      resource_id: "watch123",
      resource_key: "youtube:video:watch123",
      source_url: "https://www.youtube.com/watch?v=watch123",
      metadata_json: JSON.stringify({
        title: "Build log",
        subtitle: "YouTube",
      }),
      embed_json: null,
      api_backed: 0,
      fetched_at: "2026-06-24 12:00:00",
      expires_at: null,
      stale_at: null,
      error_message: null,
    } as ProfileIntegrationCacheRow);

    expect(payload).toMatchObject({
      provider: "youtube",
      resourceType: "video",
      embed: {
        type: "iframe",
        src: "https://www.youtube-nocookie.com/embed/watch123",
        title: "YouTube embed",
      },
    });
  });

  it("generates YouTube iframe cards from normalized URLs when cache is missing", () => {
    const normalized = profileIntegrationNormalizeUrl(
      "https://www.youtube.com/playlist?list=PL123",
      "youtube",
    );

    expect(normalized).not.toBeNull();
    expect(profileIntegrationGeneratedCardPayload(normalized!)).toMatchObject({
      provider: "youtube",
      resourceType: "playlist",
      sourceUrl: "https://www.youtube.com/playlist?list=PL123",
      metadata: {
        title: "YouTube playlist",
        subtitle: "YouTube",
      },
      embed: {
        type: "iframe",
        src: "https://www.youtube-nocookie.com/embed/videoseries?list=PL123",
      },
      apiBacked: false,
    });
  });
});
