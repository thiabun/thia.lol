import { describe, expect, it, vi } from "vitest";

import { buildApp } from "./app.js";
import type {
  FollowUserCardPayload,
  ProfileBadgesPayload,
  ProfileModulePayload,
  ProfilePayload,
  ProfilesRepository,
} from "./profiles.js";
import type { RoomPayload, RoomsRepository } from "./rooms.js";
import type { PublicStatsPayload, StatsRepository } from "./stats.js";

const room: RoomPayload = {
  id: 1,
  slug: "general",
  name: "General",
  summary: "Public room for general posts.",
  description: "Public room for general posts.",
  mood: "warm",
  members: 3,
  memberCount: 3,
  live: false,
  accent: "var(--accent-sun)",
  iconUrl: null,
  bannerUrl: null,
  rules: "",
  visibility: "public",
  createdBy: 1,
  owner: {
    id: 1,
    handle: "thia",
    displayName: "Thia",
    initials: "T",
    aura: "frost",
    avatarUrl: null,
  },
  joinedByMe: false,
  myRoomRole: null,
  postCount: 4,
  latestActivityAt: "2026-06-23 10:00:00",
  createdAt: "2026-06-20 10:00:00",
  updatedAt: "2026-06-22 10:00:00",
};

function roomsRepositoryMock(overrides: Partial<RoomsRepository> = {}): RoomsRepository {
  return {
    listPublicRooms: vi.fn().mockResolvedValue([room]),
    getPublicRoom: vi.fn().mockResolvedValue(room),
    ...overrides,
  };
}

const publicStats: PublicStatsPayload = {
  publicRooms: 4,
  publicPosts: 12,
  activeUsers: 3,
  totalReactions: 8,
};

function statsRepositoryMock(overrides: Partial<StatsRepository> = {}): StatsRepository {
  return {
    getPublicStats: vi.fn().mockResolvedValue(publicStats),
    ...overrides,
  };
}

const profile: ProfilePayload = {
  user: {
    id: 1,
    handle: "thia",
    displayName: "Thia",
    initials: "T",
    aura: "frost",
    avatarUrl: null,
  },
  bio: "Founder profile.",
  bioEntities: [],
  location: "",
  avatarUrl: null,
  bannerUrl: null,
  profileAccent: null,
  profileBackground: null,
  profileBackgroundVideo: null,
  profileBackgroundVideoPoster: null,
  profileBackgroundBlur: "medium",
  profileTheme: null,
  profileThemeConfig: null,
  profileLayoutPreset: "balanced",
  profileCanvasVersion: 2,
  profileCanvasGlass: 58,
  visibility: "public",
  isPrivate: false,
  viewerCanView: true,
  featuredPostId: null,
  featuredRoomId: null,
  links: [],
  traits: [],
  stats: {
    posts: 6,
    replies: 8,
    rooms: 3,
    echoes: 25,
    followers: 14,
    following: 27,
    moots: 14,
    stars: 0,
  },
  followerCount: 14,
  followingCount: 27,
  mootCount: 14,
  starCount: 0,
  isFollowing: false,
  isFollowedBy: false,
  isMoot: false,
  isStarred: false,
  isFollowRequestPending: false,
  isBlocked: false,
  isMuted: false,
  createdAt: "2026-06-01 10:00:00",
  updatedAt: "2026-06-22 10:00:00",
  featuredPost: null,
  featuredRoom: null,
};

const profileModule: ProfileModulePayload = {
  id: 11,
  type: "profile_info",
  title: null,
  config: {
    canvasSize: "8x3",
  },
  visibility: "public",
  position: 1,
  pinned: true,
  layout: {
    column: 3,
    row: 1,
    colSpan: 8,
    rowSpan: 3,
  },
  status: "active",
  schemaVersion: 1,
  createdAt: "2026-06-16 18:19:39",
  updatedAt: "2026-06-23 09:40:32",
};

const profileBadges: ProfileBadgesPayload = {
  badges: [
    {
      id: 1,
      badge: {
        id: 1,
        badgeKey: "founder",
        name: "Founder",
        description: "Founder badge",
        rarity: "founder",
        source: "admin-granted",
        icon: "sparkles",
        accent: "founder",
        isActive: true,
        createdAt: "2026-06-10 10:00:00",
      },
      reason: null,
      earnedAt: "2026-06-10 10:00:00",
      featuredOrder: 1,
      isVisible: true,
      grantedBy: null,
      user: {
        id: 1,
        handle: "thia",
        displayName: "Thia",
        initials: "T",
        aura: "frost",
        avatarUrl: null,
      },
    },
  ],
  featuredBadges: [],
};

const followCard: FollowUserCardPayload = {
  handle: "friend",
  displayName: "Friend",
  initials: "F",
  avatarUrl: null,
  bioSnippet: "Public friend.",
  isFollowing: false,
  isMoot: false,
};

function profilesRepositoryMock(overrides: Partial<ProfilesRepository> = {}): ProfilesRepository {
  return {
    getPublicProfile: vi.fn().mockResolvedValue(profile),
    getPublicProfileRooms: vi.fn().mockResolvedValue([room]),
    getPublicProfileModules: vi.fn().mockResolvedValue([profileModule]),
    getPublicProfileBadges: vi.fn().mockResolvedValue(profileBadges),
    getPublicProfileFollowers: vi.fn().mockResolvedValue([followCard]),
    getPublicProfileFollowing: vi.fn().mockResolvedValue([followCard]),
    ...overrides,
  };
}

describe("Node API health routes", () => {
  it("returns the PHP-compatible DB-free health payload", async () => {
    const app = buildApp();
    const response = await app.inject({
      method: "GET",
      url: "/health",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      ok: true,
      service: "thia.lol api",
      status: "ok",
    });
    expect(response.json()).toHaveProperty("time");
  });

  it("adds database health when db=1 succeeds", async () => {
    const checkDatabase = vi.fn().mockResolvedValue(undefined);
    const app = buildApp({
      checkDatabase,
    });
    const response = await app.inject({
      method: "GET",
      url: "/health?db=1",
    });

    expect(response.statusCode).toBe(200);
    expect(checkDatabase).toHaveBeenCalledOnce();
    expect(response.json()).toMatchObject({
      ok: true,
      database: {
        ok: true,
      },
    });
  });

  it("returns 503 when database health fails", async () => {
    const checkDatabase = vi.fn().mockRejectedValue(new Error("offline"));
    const app = buildApp({
      checkDatabase,
    });
    const response = await app.inject({
      method: "GET",
      url: "/health?db=1",
    });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({
      ok: false,
      error: "Database connection failed.",
      database: {
        ok: false,
      },
    });
  });

  it("returns JSON 404 for unknown routes", async () => {
    const app = buildApp();
    const response = await app.inject({
      method: "GET",
      url: "/missing",
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({
      ok: false,
      error: "Not found.",
    });
  });
});

describe("Node API room preview routes", () => {
  it("returns public rooms in the PHP success wrapper", async () => {
    const repository = roomsRepositoryMock();
    const app = buildApp({
      roomsRepository: repository,
    });
    const response = await app.inject({
      method: "GET",
      url: "/rooms",
    });

    expect(response.statusCode).toBe(200);
    expect(repository.listPublicRooms).toHaveBeenCalledOnce();
    expect(response.json()).toEqual({
      ok: true,
      data: [room],
    });
  });

  it("returns a public room by slug", async () => {
    const repository = roomsRepositoryMock();
    const app = buildApp({
      roomsRepository: repository,
    });
    const response = await app.inject({
      method: "GET",
      url: "/rooms/general",
    });

    expect(response.statusCode).toBe(200);
    expect(repository.getPublicRoom).toHaveBeenCalledWith("general");
    expect(response.json()).toEqual({
      ok: true,
      data: room,
    });
  });

  it("normalizes room slugs before lookup", async () => {
    const repository = roomsRepositoryMock();
    const app = buildApp({
      roomsRepository: repository,
    });
    const response = await app.inject({
      method: "GET",
      url: "/rooms/General",
    });

    expect(response.statusCode).toBe(200);
    expect(repository.getPublicRoom).toHaveBeenCalledWith("general");
  });

  it("returns 400 for invalid room slugs", async () => {
    const repository = roomsRepositoryMock();
    const app = buildApp({
      roomsRepository: repository,
    });
    const response = await app.inject({
      method: "GET",
      url: "/rooms/nope!",
    });

    expect(response.statusCode).toBe(400);
    expect(repository.getPublicRoom).not.toHaveBeenCalled();
    expect(response.json()).toEqual({
      ok: false,
      error: "Invalid room slug.",
    });
  });

  it("returns 404 for unknown public rooms", async () => {
    const repository = roomsRepositoryMock({
      getPublicRoom: vi.fn().mockResolvedValue(null),
    });
    const app = buildApp({
      roomsRepository: repository,
    });
    const response = await app.inject({
      method: "GET",
      url: "/rooms/missing",
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({
      ok: false,
      error: "Room not found.",
    });
  });

  it("returns JSON 500 without raw repository details", async () => {
    const repository = roomsRepositoryMock({
      listPublicRooms: vi.fn().mockRejectedValue(new Error("sensitive stack detail")),
    });
    const app = buildApp({
      roomsRepository: repository,
    });
    const response = await app.inject({
      method: "GET",
      url: "/rooms",
    });

    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({
      ok: false,
      error: "Internal server error.",
    });
  });
});

describe("Node API stats preview route", () => {
  it("returns public stats in the PHP success wrapper", async () => {
    const repository = statsRepositoryMock();
    const app = buildApp({
      statsRepository: repository,
    });
    const response = await app.inject({
      method: "GET",
      url: "/stats",
    });

    expect(response.statusCode).toBe(200);
    expect(repository.getPublicStats).toHaveBeenCalledOnce();
    expect(response.json()).toEqual({
      ok: true,
      data: publicStats,
    });
  });

  it("returns JSON 500 without raw stats repository details", async () => {
    const repository = statsRepositoryMock({
      getPublicStats: vi.fn().mockRejectedValue(new Error("sensitive stats detail")),
    });
    const app = buildApp({
      statsRepository: repository,
    });
    const response = await app.inject({
      method: "GET",
      url: "/stats",
    });

    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({
      ok: false,
      error: "Internal server error.",
    });
  });
});

describe("Node API profile preview route", () => {
  it("returns a public profile in the PHP success wrapper", async () => {
    const repository = profilesRepositoryMock();
    const app = buildApp({
      profilesRepository: repository,
    });
    const response = await app.inject({
      method: "GET",
      url: "/profiles/thia",
    });

    expect(response.statusCode).toBe(200);
    expect(repository.getPublicProfile).toHaveBeenCalledWith("thia");
    expect(response.json()).toEqual({
      ok: true,
      data: profile,
    });
  });

  it("normalizes profile handles before lookup", async () => {
    const repository = profilesRepositoryMock();
    const app = buildApp({
      profilesRepository: repository,
    });
    const response = await app.inject({
      method: "GET",
      url: "/profiles/%40Thia",
    });

    expect(response.statusCode).toBe(200);
    expect(repository.getPublicProfile).toHaveBeenCalledWith("thia");
  });

  it("returns 400 for invalid profile handles", async () => {
    const repository = profilesRepositoryMock();
    const app = buildApp({
      profilesRepository: repository,
    });
    const response = await app.inject({
      method: "GET",
      url: "/profiles/nope!",
    });

    expect(response.statusCode).toBe(400);
    expect(repository.getPublicProfile).not.toHaveBeenCalled();
    expect(response.json()).toEqual({
      ok: false,
      error: "Invalid profile handle.",
    });
  });

  it("returns 404 for unknown public profiles", async () => {
    const repository = profilesRepositoryMock({
      getPublicProfile: vi.fn().mockResolvedValue(null),
    });
    const app = buildApp({
      profilesRepository: repository,
    });
    const response = await app.inject({
      method: "GET",
      url: "/profiles/missing",
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({
      ok: false,
      error: "Profile not found.",
    });
  });

  it("returns private profile shells from the repository", async () => {
    const privateProfile: ProfilePayload = {
      ...profile,
      bio: "",
      bioEntities: [],
      visibility: "private",
      isPrivate: true,
      viewerCanView: false,
      links: [],
      traits: [],
      featuredPost: null,
      featuredRoom: null,
    };
    const repository = profilesRepositoryMock({
      getPublicProfile: vi.fn().mockResolvedValue(privateProfile),
    });
    const app = buildApp({
      profilesRepository: repository,
    });
    const response = await app.inject({
      method: "GET",
      url: "/profiles/thia",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      ok: true,
      data: privateProfile,
    });
  });

  it("returns JSON 500 without raw profile repository details", async () => {
    const repository = profilesRepositoryMock({
      getPublicProfile: vi.fn().mockRejectedValue(new Error("sensitive profile detail")),
    });
    const app = buildApp({
      profilesRepository: repository,
    });
    const response = await app.inject({
      method: "GET",
      url: "/profiles/thia",
    });

    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({
      ok: false,
      error: "Internal server error.",
    });
  });
});

describe("Node API profile extras preview routes", () => {
  const routes: Array<{
    path: string;
    methodName: keyof ProfilesRepository;
    publicData: unknown;
    privateData: unknown;
  }> = [
    {
      path: "/profiles/thia/rooms",
      methodName: "getPublicProfileRooms",
      publicData: [room],
      privateData: [],
    },
    {
      path: "/profiles/thia/modules",
      methodName: "getPublicProfileModules",
      publicData: [profileModule],
      privateData: [],
    },
    {
      path: "/profiles/thia/badges",
      methodName: "getPublicProfileBadges",
      publicData: profileBadges,
      privateData: {
        badges: [],
        featuredBadges: [],
      },
    },
    {
      path: "/profiles/thia/followers",
      methodName: "getPublicProfileFollowers",
      publicData: [followCard],
      privateData: [],
    },
    {
      path: "/profiles/thia/following",
      methodName: "getPublicProfileFollowing",
      publicData: [followCard],
      privateData: [],
    },
  ];

  it.each(routes)("returns %s in the PHP success wrapper", async ({ path, methodName, publicData }) => {
    const repository = profilesRepositoryMock();
    const app = buildApp({
      profilesRepository: repository,
    });
    const response = await app.inject({
      method: "GET",
      url: path,
    });

    expect(response.statusCode).toBe(200);
    expect(repository[methodName]).toHaveBeenCalledWith("thia");
    expect(response.json()).toEqual({
      ok: true,
      data: publicData,
    });
  });

  it.each(routes)("returns 400 for invalid handles on %s", async ({ path, methodName }) => {
    const repository = profilesRepositoryMock();
    const app = buildApp({
      profilesRepository: repository,
    });
    const response = await app.inject({
      method: "GET",
      url: path.replace("/thia/", "/nope!/"),
    });

    expect(response.statusCode).toBe(400);
    expect(repository[methodName]).not.toHaveBeenCalled();
    expect(response.json()).toEqual({
      ok: false,
      error: "Invalid profile handle.",
    });
  });

  it.each(routes)("returns 404 for missing profiles on %s", async ({ path, methodName }) => {
    const repository = profilesRepositoryMock({
      [methodName]: vi.fn().mockResolvedValue(null),
    });
    const app = buildApp({
      profilesRepository: repository,
    });
    const response = await app.inject({
      method: "GET",
      url: path,
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({
      ok: false,
      error: "Profile not found.",
    });
  });

  it.each(routes)("returns private-profile public data for %s", async ({ path, methodName, privateData }) => {
    const repository = profilesRepositoryMock({
      [methodName]: vi.fn().mockResolvedValue(privateData),
    });
    const app = buildApp({
      profilesRepository: repository,
    });
    const response = await app.inject({
      method: "GET",
      url: path,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      ok: true,
      data: privateData,
    });
  });

  it.each(routes)("returns JSON 500 without raw repository details for %s", async ({ path, methodName }) => {
    const repository = profilesRepositoryMock({
      [methodName]: vi.fn().mockRejectedValue(new Error("sensitive profile extras detail")),
    });
    const app = buildApp({
      profilesRepository: repository,
    });
    const response = await app.inject({
      method: "GET",
      url: path,
    });

    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({
      ok: false,
      error: "Internal server error.",
    });
  });
});
