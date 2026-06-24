import { Writable } from "node:stream";

import { describe, expect, it, vi } from "vitest";

import { buildApp, nodeApiLoggerOptions, requestIdHeader } from "./app.js";
import {
  BadgeStorageNotReadyError,
  type BadgePayload,
  type BadgesRepository,
} from "./badges.js";
import type {
  DiscoverPersonPayload,
  HomeFeedPayload,
  PostDetailPayload,
  PostsRepository,
} from "./posts.js";
import {
  PrivateStorageNotReadyError,
  type AuthSessionPayload,
  type FollowRequestPayload,
  type MyPostPayload,
  type NotificationsPayload,
  type OnboardingStatePayload,
  type PrivateReadsRepository,
  type SettingsPayload,
} from "./private.js";
import type {
  FollowUserCardPayload,
  PostPayload,
  ProfileBadgesPayload,
  ProfileModulePayload,
  ProfilePayload,
  ProfilesRepository,
} from "./profiles.js";
import { RoomStorageNotReadyError, type RoomMemberPayload, type RoomPayload, type RoomsRepository } from "./rooms.js";
import type { SearchPayload, SearchRepository } from "./search.js";
import type { RequestSession, SessionsRepository } from "./sessions.js";
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

const roomMember: RoomMemberPayload = {
  id: 5,
  role: "owner",
  joinedAt: "2026-06-20 09:00:00",
  user: {
    id: 1,
    handle: "thia",
    displayName: "Thia",
    initials: "T",
    aura: "frost",
    avatarUrl: null,
  },
};

function roomsRepositoryMock(overrides: Partial<RoomsRepository> = {}): RoomsRepository {
  return {
    listPublicRooms: vi.fn().mockResolvedValue([room]),
    getPublicRoom: vi.fn().mockResolvedValue(room),
    getPublicRoomMembers: vi.fn().mockResolvedValue([roomMember]),
    ...overrides,
  };
}

const publicBadge: BadgePayload = {
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
};

function badgesRepositoryMock(overrides: Partial<BadgesRepository> = {}): BadgesRepository {
  return {
    listPublicBadges: vi.fn().mockResolvedValue([publicBadge]),
    ...overrides,
  };
}

const searchPayload: SearchPayload = {
  query: "thia",
  minQueryLength: 2,
  results: {
    profiles: [
      {
        user: roomMember.user,
        bioSnippet: "Founder profile.",
      },
    ],
    rooms: [room],
  },
};

function searchRepositoryMock(overrides: Partial<SearchRepository> = {}): SearchRepository {
  return {
    search: vi.fn().mockResolvedValue(searchPayload),
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

const post: PostPayload = {
  id: 99,
  publicId: "pc359fe2da759",
  body: "A public post.",
  bodyEntities: [],
  mood: "sunveil",
  mediaUrl: null,
  visibility: "public",
  status: "published",
  parentId: null,
  deletedAt: null,
  createdAt: "2026-06-23 10:00:00",
  updatedAt: "2026-06-23 10:00:00",
  author: profile.user,
  profile,
  room,
  commentCount: 1,
  reactions: {
    glow: 2,
    echo: 0,
    hush: 0,
  },
  likeCount: 2,
  likedByCurrentUser: false,
  reblogCount: 1,
  rebloggedByMe: false,
  rebloggedByCurrentUser: false,
  rebloggedBy: null,
  rebloggedAt: null,
  socialContext: {
    authorRelationship: null,
    likedByFollowedCount: 0,
  },
};

const postDetail: PostDetailPayload = {
  ...post,
  canonicalPath: "/@thia/posts/pc359fe2da759",
  canonicalUrl: "https://thia.lol/@thia/posts/pc359fe2da759",
};

const personToWatch: DiscoverPersonPayload = {
  handle: "friend",
  displayName: "Friend",
  initials: "F",
  avatarUrl: null,
  bioSnippet: "Public friend.",
  isFollowing: false,
  isMoot: false,
  postCount: 4,
  followerCount: 2,
  starCount: 1,
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

function postsRepositoryMock(overrides: Partial<PostsRepository> = {}): PostsRepository {
  return {
    listPublicPosts: vi.fn().mockResolvedValue([post]),
    getPublicPost: vi.fn().mockResolvedValue(postDetail),
    listPostReplies: vi.fn().mockResolvedValue([post]),
    listRoomPosts: vi.fn().mockResolvedValue([post]),
    listProfilePosts: vi.fn().mockResolvedValue([post]),
    listProfileReplies: vi.fn().mockResolvedValue([post]),
    listProfileReblogs: vi.fn().mockResolvedValue([post]),
    getHomeFeed: vi.fn().mockResolvedValue({
      posts: [post],
      personalized: false,
    } satisfies HomeFeedPayload),
    listDiscoverPosts: vi.fn().mockResolvedValue([post]),
    listPeopleToWatch: vi.fn().mockResolvedValue([personToWatch]),
    ...overrides,
  };
}

const session: RequestSession = {
  sessionId: 7,
  userId: 42,
  tokenHash: "hash",
  handle: "viewer",
  role: "member",
};

function sessionsRepositoryMock(overrides: Partial<SessionsRepository> = {}): SessionsRepository {
  return {
    currentSession: vi.fn().mockResolvedValue(session),
    ...overrides,
  };
}

const authPayload: AuthSessionPayload = {
  user: {
    id: 42,
    handle: "viewer",
    email: "viewer@example.test",
    role: "member",
    status: "active",
    displayName: "Viewer",
    avatarUrl: null,
  },
  profile: {
    displayName: "Viewer",
    bio: "",
    location: "",
    avatarUrl: null,
    links: [],
    traits: [],
  },
  csrfToken: "csrf-token",
};

const settingsPayload: SettingsPayload = {
  account: {
    id: 42,
    handle: "viewer",
    email: "viewer@example.test",
    displayName: "Viewer",
    status: "active",
    handleChange: {
      canChange: true,
      nextAllowedAt: null,
    },
  },
  privacy: {
    profileVisibility: "public",
  },
  preferences: {
    analyticsConsent: false,
    personalizationConsent: true,
    richEmbedsConsent: true,
    autoplayMediaConsent: false,
    sensitiveContentVisible: false,
    notifications: {},
    emailNotifications: [],
    pushNotifications: [],
  },
  twoFactor: {
    enabled: false,
    backupCodeCount: 0,
    encryptionConfigured: false,
    encryptionAvailable: true,
  },
  deletion: null,
};

const onboardingPayload: OnboardingStatePayload = {
  steps: ["profile"],
  completedSteps: ["profile"],
  skippedSteps: [],
  providerLinks: {},
  finishedAt: null,
  dismissedAt: null,
  createdAt: "2026-06-20 10:00:00",
  updatedAt: "2026-06-22 10:00:00",
};

const notificationsPayload: NotificationsPayload = {
  notifications: [
    {
      id: 8,
      type: "follow",
      createdAt: "2026-06-22 10:00:00",
      readAt: null,
      actor: roomMember.user,
      post: null,
      room: null,
      targetUrl: "/@thia",
      data: null,
    },
  ],
  unreadCount: 1,
};

const followRequest: FollowRequestPayload = {
  id: 12,
  createdAt: "2026-06-22 10:00:00",
  user: roomMember.user,
  bioSnippet: "Founder profile.",
};

const myPost: MyPostPayload = {
  id: 99,
  publicId: "pc359fe2da759",
  kind: "post",
  body: "A public post.",
  mediaUrl: null,
  status: "published",
  deletedAt: null,
  createdAt: "2026-06-23 10:00:00",
};

function privateReadsRepositoryMock(overrides: Partial<PrivateReadsRepository> = {}): PrivateReadsRepository {
  return {
    authSessionPayload: vi.fn().mockReturnValue(authPayload),
    getSettings: vi.fn().mockResolvedValue(settingsPayload),
    getOnboardingState: vi.fn().mockResolvedValue(onboardingPayload),
    getNotifications: vi.fn().mockResolvedValue(notificationsPayload),
    getFollowRequests: vi.fn().mockResolvedValue([followRequest]),
    getMyPosts: vi.fn().mockResolvedValue([myPost]),
    ...overrides,
  };
}

function capturedLogger() {
  const chunks: string[] = [];
  const stream = new Writable({
    write(chunk, _encoding, callback) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk.toString("utf8") : String(chunk));
      callback();
    },
  });

  return {
    logger: {
      ...nodeApiLoggerOptions("info"),
      stream,
    },
    output: () => chunks.join(""),
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

  it("adds request ids to all Node responses", async () => {
    const app = buildApp();
    const response = await app.inject({
      method: "GET",
      url: "/health",
      headers: {
        "x-thia-request-id": "req-hardening-0001",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers[requestIdHeader.toLowerCase()]).toBe("req-hardening-0001");
  });

  it("logs sanitized route failures with request ids and generic JSON responses", async () => {
    const capture = capturedLogger();
    const databaseError = Object.assign(
      new Error("SELECT password FROM users WHERE token = 'secret-token'"),
      {
        code: "ER_PARSE_ERROR",
        errno: 1064,
        sql: "SELECT password FROM users",
        sqlMessage: "near secret-token",
        sqlState: "42000",
      },
    );
    const repository = postsRepositoryMock({
      listPublicPosts: vi.fn().mockRejectedValue(databaseError),
    });
    const app = buildApp({
      logger: capture.logger,
      postsRepository: repository,
    });
    const response = await app.inject({
      method: "GET",
      url: "/posts?token=secret-token",
      headers: {
        "x-thia-request-id": "req-hardening-0002",
        authorization: "Bearer secret-token",
        cookie: "thia_session=secret-cookie",
      },
    });
    await app.close();
    const logs = capture.output();

    expect(response.statusCode).toBe(500);
    expect(response.headers[requestIdHeader.toLowerCase()]).toBe("req-hardening-0002");
    expect(response.json()).toEqual({
      ok: false,
      error: "Internal server error.",
    });
    expect(logs).toContain("Node API route failed");
    expect(logs).toContain("posts.index");
    expect(logs).toContain("req-hardening-0002");
    expect(logs).toContain("ER_PARSE_ERROR");
    expect(logs).toContain("42000");
    expect(logs).toContain("/posts?token=[redacted]");
    expect(logs).not.toContain("secret-token");
    expect(logs).not.toContain("secret-cookie");
    expect(logs).not.toContain("SELECT password");
  });
});

describe("Node API private preview routes", () => {
  it("returns unauthenticated JSON when no current session exists", async () => {
    const app = buildApp({
      privateReadsRepository: privateReadsRepositoryMock(),
      sessionsRepository: sessionsRepositoryMock({
        currentSession: vi.fn().mockResolvedValue(null),
      }),
    });
    const response = await app.inject({
      method: "GET",
      url: "/auth/me",
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({
      ok: false,
      error: "Unauthenticated.",
    });
  });

  it("returns the PHP-compatible auth session wrapper", async () => {
    const repository = privateReadsRepositoryMock();
    const app = buildApp({
      privateReadsRepository: repository,
      sessionsRepository: sessionsRepositoryMock(),
    });
    const response = await app.inject({
      method: "GET",
      url: "/auth/me",
      headers: {
        cookie: "thia_session=session-token",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(repository.authSessionPayload).toHaveBeenCalledWith(session);
    expect(response.json()).toEqual({
      ok: true,
      data: authPayload,
    });
  });

  it("returns private read payloads through PHP-style wrappers", async () => {
    const repository = privateReadsRepositoryMock();
    const app = buildApp({
      privateReadsRepository: repository,
      sessionsRepository: sessionsRepositoryMock(),
    });

    for (const [path, payload] of [
      ["/me/settings", settingsPayload],
      ["/me/onboarding", onboardingPayload],
      ["/me/follow-requests", [followRequest]],
      ["/notifications", notificationsPayload],
    ] as const) {
      const response = await app.inject({
        method: "GET",
        url: path,
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        ok: true,
        data: payload,
      });
    }
  });

  it("normalizes my-post kind filters like PHP settings", async () => {
    const repository = privateReadsRepositoryMock();
    const app = buildApp({
      privateReadsRepository: repository,
      sessionsRepository: sessionsRepositoryMock(),
    });

    await app.inject({
      method: "GET",
      url: "/me/posts?kind=replies",
    });
    await app.inject({
      method: "GET",
      url: "/me/posts?kind=unknown",
    });

    expect(repository.getMyPosts).toHaveBeenNthCalledWith(1, session.userId, "replies");
    expect(repository.getMyPosts).toHaveBeenNthCalledWith(2, session.userId, "all");
  });

  it("maps private storage-not-ready errors to PHP-compatible 503s", async () => {
    const repository = privateReadsRepositoryMock({
      getNotifications: vi
        .fn()
        .mockRejectedValue(new PrivateStorageNotReadyError("Notification storage is not ready. Run pending migrations.")),
    });
    const app = buildApp({
      privateReadsRepository: repository,
      sessionsRepository: sessionsRepositoryMock(),
    });
    const response = await app.inject({
      method: "GET",
      url: "/notifications",
    });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({
      ok: false,
      error: "Notification storage is not ready. Run pending migrations.",
    });
  });

  it("returns generic JSON 500s for private repository failures", async () => {
    const repository = privateReadsRepositoryMock({
      getSettings: vi.fn().mockRejectedValue(new Error("raw setting failure")),
    });
    const app = buildApp({
      privateReadsRepository: repository,
      sessionsRepository: sessionsRepositoryMock(),
    });
    const response = await app.inject({
      method: "GET",
      url: "/me/settings",
    });

    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({
      ok: false,
      error: "Internal server error.",
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

describe("Node API room member preview route", () => {
  it("returns public room members in the PHP success wrapper", async () => {
    const repository = roomsRepositoryMock();
    const app = buildApp({
      roomsRepository: repository,
    });
    const response = await app.inject({
      method: "GET",
      url: "/rooms/general/members",
    });

    expect(response.statusCode).toBe(200);
    expect(repository.getPublicRoomMembers).toHaveBeenCalledWith("general");
    expect(response.json()).toEqual({
      ok: true,
      data: [roomMember],
    });
  });

  it("returns 400 for invalid room member slugs", async () => {
    const repository = roomsRepositoryMock();
    const app = buildApp({
      roomsRepository: repository,
    });
    const response = await app.inject({
      method: "GET",
      url: "/rooms/nope!/members",
    });

    expect(response.statusCode).toBe(400);
    expect(repository.getPublicRoomMembers).not.toHaveBeenCalled();
    expect(response.json()).toEqual({
      ok: false,
      error: "Invalid room slug.",
    });
  });

  it("returns 404 for missing public rooms", async () => {
    const repository = roomsRepositoryMock({
      getPublicRoomMembers: vi.fn().mockResolvedValue(null),
    });
    const app = buildApp({
      roomsRepository: repository,
    });
    const response = await app.inject({
      method: "GET",
      url: "/rooms/missing/members",
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({
      ok: false,
      error: "Room not found.",
    });
  });

  it("returns 503 when room membership storage is not ready", async () => {
    const repository = roomsRepositoryMock({
      getPublicRoomMembers: vi.fn().mockRejectedValue(new RoomStorageNotReadyError()),
    });
    const app = buildApp({
      roomsRepository: repository,
    });
    const response = await app.inject({
      method: "GET",
      url: "/rooms/general/members",
    });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({
      ok: false,
      error: "Room membership storage is not ready. Run pending migrations.",
    });
  });

  it("returns JSON 500 without raw room member repository details", async () => {
    const repository = roomsRepositoryMock({
      getPublicRoomMembers: vi.fn().mockRejectedValue(new Error("sensitive member detail")),
    });
    const app = buildApp({
      roomsRepository: repository,
    });
    const response = await app.inject({
      method: "GET",
      url: "/rooms/general/members",
    });

    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({
      ok: false,
      error: "Internal server error.",
    });
  });
});

describe("Node API search preview route", () => {
  it("returns search results in the PHP success wrapper", async () => {
    const repository = searchRepositoryMock();
    const app = buildApp({
      searchRepository: repository,
    });
    const response = await app.inject({
      method: "GET",
      url: "/search?q=thia",
    });

    expect(response.statusCode).toBe(200);
    expect(repository.search).toHaveBeenCalledWith("thia", null);
    expect(response.json()).toEqual({
      ok: true,
      data: searchPayload,
    });
  });

  it("resolves optional sessions for search reads", async () => {
    const searchRepository = searchRepositoryMock();
    const sessionsRepository = sessionsRepositoryMock();
    const app = buildApp({
      searchRepository,
      sessionsRepository,
    });
    const response = await app.inject({
      method: "GET",
      url: "/search?q=thia",
      headers: {
        cookie: "thia_session=token",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(sessionsRepository.currentSession).toHaveBeenCalledWith("thia_session=token");
    expect(searchRepository.search).toHaveBeenCalledWith("thia", 42);
  });

  it("treats repeated q parameters like PHP's non-string query fallback", async () => {
    const repository = searchRepositoryMock();
    const app = buildApp({
      searchRepository: repository,
    });
    const response = await app.inject({
      method: "GET",
      url: "/search?q=thia&q=general",
    });

    expect(response.statusCode).toBe(200);
    expect(repository.search).toHaveBeenCalledWith("", null);
  });

  it("returns JSON 500 without raw search repository details", async () => {
    const repository = searchRepositoryMock({
      search: vi.fn().mockRejectedValue(new Error("sensitive search detail")),
    });
    const app = buildApp({
      searchRepository: repository,
    });
    const response = await app.inject({
      method: "GET",
      url: "/search?q=thia",
    });

    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({
      ok: false,
      error: "Internal server error.",
    });
  });
});

describe("Node API badge preview route", () => {
  it("returns public badge definitions in the PHP success wrapper", async () => {
    const repository = badgesRepositoryMock();
    const app = buildApp({
      badgesRepository: repository,
    });
    const response = await app.inject({
      method: "GET",
      url: "/badges",
    });

    expect(response.statusCode).toBe(200);
    expect(repository.listPublicBadges).toHaveBeenCalledOnce();
    expect(response.json()).toEqual({
      ok: true,
      data: [publicBadge],
    });
  });

  it("returns 503 when badge storage is not ready", async () => {
    const repository = badgesRepositoryMock({
      listPublicBadges: vi.fn().mockRejectedValue(new BadgeStorageNotReadyError()),
    });
    const app = buildApp({
      badgesRepository: repository,
    });
    const response = await app.inject({
      method: "GET",
      url: "/badges",
    });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({
      ok: false,
      error: "Badge storage is not ready. Run pending migrations.",
    });
  });

  it("returns JSON 500 without raw badge repository details", async () => {
    const repository = badgesRepositoryMock({
      listPublicBadges: vi.fn().mockRejectedValue(new Error("sensitive badge detail")),
    });
    const app = buildApp({
      badgesRepository: repository,
    });
    const response = await app.inject({
      method: "GET",
      url: "/badges",
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

describe("Node API post and feed preview routes", () => {
  it("returns public posts in the PHP success wrapper", async () => {
    const repository = postsRepositoryMock();
    const app = buildApp({
      postsRepository: repository,
    });
    const response = await app.inject({
      method: "GET",
      url: "/posts",
    });

    expect(response.statusCode).toBe(200);
    expect(repository.listPublicPosts).toHaveBeenCalledWith(null);
    expect(response.json()).toEqual({
      ok: true,
      data: [post],
    });
  });

  it("resolves optional sessions for post reads", async () => {
    const postsRepository = postsRepositoryMock();
    const sessionsRepository = sessionsRepositoryMock();
    const app = buildApp({
      postsRepository,
      sessionsRepository,
    });
    const response = await app.inject({
      method: "GET",
      url: "/posts",
      headers: {
        cookie: "thia_session=token",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(sessionsRepository.currentSession).toHaveBeenCalledWith("thia_session=token");
    expect(postsRepository.listPublicPosts).toHaveBeenCalledWith(42);
  });

  it("returns post details with canonical fields", async () => {
    const repository = postsRepositoryMock();
    const app = buildApp({
      postsRepository: repository,
      publicBaseUrl: "https://thia.lol",
    });
    const response = await app.inject({
      method: "GET",
      url: "/posts/pc359fe2da759",
    });

    expect(response.statusCode).toBe(200);
    expect(repository.getPublicPost).toHaveBeenCalledWith("pc359fe2da759", null, "https://thia.lol");
    expect(response.json()).toEqual({
      ok: true,
      data: postDetail,
    });
  });

  it("returns 404 for invalid post identifiers", async () => {
    const repository = postsRepositoryMock();
    const app = buildApp({
      postsRepository: repository,
    });
    const response = await app.inject({
      method: "GET",
      url: "/posts/nope",
    });

    expect(response.statusCode).toBe(404);
    expect(repository.getPublicPost).not.toHaveBeenCalled();
    expect(response.json()).toEqual({
      ok: false,
      error: "Not found.",
    });
  });

  it("returns 404 for unknown valid posts", async () => {
    const repository = postsRepositoryMock({
      getPublicPost: vi.fn().mockResolvedValue(null),
    });
    const app = buildApp({
      postsRepository: repository,
    });
    const response = await app.inject({
      method: "GET",
      url: "/posts/pc359fe2da759",
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({
      ok: false,
      error: "Post not found.",
    });
  });

  it("returns post replies for numeric parent ids", async () => {
    const repository = postsRepositoryMock();
    const app = buildApp({
      postsRepository: repository,
    });
    const response = await app.inject({
      method: "GET",
      url: "/posts/99/replies",
    });

    expect(response.statusCode).toBe(200);
    expect(repository.listPostReplies).toHaveBeenCalledWith(99, null);
    expect(response.json()).toEqual({
      ok: true,
      data: [post],
    });
  });

  it("returns 404 for unknown reply parent posts", async () => {
    const repository = postsRepositoryMock({
      listPostReplies: vi.fn().mockResolvedValue(null),
    });
    const app = buildApp({
      postsRepository: repository,
    });
    const response = await app.inject({
      method: "GET",
      url: "/posts/99/replies",
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({
      ok: false,
      error: "Post not found.",
    });
  });

  it("returns public room posts", async () => {
    const repository = postsRepositoryMock();
    const app = buildApp({
      postsRepository: repository,
    });
    const response = await app.inject({
      method: "GET",
      url: "/rooms/general/posts",
    });

    expect(response.statusCode).toBe(200);
    expect(repository.listRoomPosts).toHaveBeenCalledWith("general", null);
    expect(response.json()).toEqual({
      ok: true,
      data: [post],
    });
  });

  it("returns public profile post collections", async () => {
    const repository = postsRepositoryMock();
    const app = buildApp({
      postsRepository: repository,
    });

    for (const [path, methodName] of [
      ["/profiles/thia/posts", "listProfilePosts"],
      ["/profiles/thia/replies", "listProfileReplies"],
      ["/profiles/thia/reblogs", "listProfileReblogs"],
    ] as const) {
      const response = await app.inject({
        method: "GET",
        url: path,
      });

      expect(response.statusCode).toBe(200);
      expect(repository[methodName]).toHaveBeenCalledWith("thia", null);
      expect(response.json()).toEqual({
        ok: true,
        data: [post],
      });
    }
  });

  it("returns home feed and discover feed wrappers", async () => {
    const postsRepository = postsRepositoryMock();
    const app = buildApp({
      postsRepository,
      roomsRepository: roomsRepositoryMock(),
    });
    const home = await app.inject({
      method: "GET",
      url: "/feed/home",
    });
    const discover = await app.inject({
      method: "GET",
      url: "/feed/discover",
    });

    expect(home.statusCode).toBe(200);
    expect(home.json()).toEqual({
      ok: true,
      data: {
        posts: [post],
        personalized: false,
      },
    });
    expect(discover.statusCode).toBe(200);
    expect(discover.json()).toEqual({
      ok: true,
      data: {
        posts: [post],
        activeRooms: [room],
        peopleToWatch: [personToWatch],
      },
    });
  });

  it("returns JSON 500 without raw post repository details", async () => {
    const repository = postsRepositoryMock({
      listPublicPosts: vi.fn().mockRejectedValue(new Error("sensitive post detail")),
    });
    const app = buildApp({
      postsRepository: repository,
    });
    const response = await app.inject({
      method: "GET",
      url: "/posts",
    });

    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({
      ok: false,
      error: "Internal server error.",
    });
  });
});
