import { describe, expect, it } from "vitest";

import {
  buildProfileByHandleQuery,
  normalizeProfileHandle,
  profilePayloadFromRow,
  profilePayloadWithFeatured,
  type ProfileRow,
  type ProfileSchemaCapabilities,
  type ProfileSocialContext,
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
  hasRoomSoftDeleteColumn: true,
  hasPostPublicIdColumn: true,
  hasPostReblogs: true,
  hasTextEntities: true,
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

describe("profile preview SQL", () => {
  it("matches PHP public account and profile constraints", () => {
    const query = buildProfileByHandleQuery(fullCapabilities);

    expect(query).toContain("WHERE u.handle = ?");
    expect(query).toContain("u.status = 'active'");
    expect(query).toContain("account_deletion_requests public_account_deletions");
    expect(query).toContain("p.visibility,");
  });

  it("matches PHP public post, room, soft-delete, and active-user constraints", () => {
    const query = buildProfileByHandleQuery(fullCapabilities);

    expect(query).toContain("profile_posts.parent_id IS NULL");
    expect(query).toContain("profile_posts.visibility = 'public'");
    expect(query).toContain("profile_posts.status = 'published'");
    expect(query).toContain("profile_posts.deleted_at IS NULL");
    expect(query).toContain("profile_replies.parent_id IS NOT NULL");
    expect(query).toContain("profile_rooms.visibility = 'public'");
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
