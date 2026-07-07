import { Writable } from "node:stream";

import { describe, expect, it, vi } from "vitest";

import type {
  AuthLogoutResult,
  AuthRepository,
  AuthSessionResult,
  TwoFactorChallengePayload,
  TwoFactorEnablePayload,
  TwoFactorRecoveryCodesPayload,
  TwoFactorSetupPayload,
  TwoFactorStatusPayload,
} from "./auth.js";
import { buildApp, nodeApiLoggerOptions, requestIdHeader } from "./app.js";
import {
  BadgeStorageNotReadyError,
  type BadgePayload,
  type BadgesRepository,
} from "./badges.js";
import {
  ContentRouteError,
  ContentStorageNotReadyError,
  type ContentMutationsRepository,
  type FollowRelationshipPayload,
  type PostShareMessagesPayload,
  type ProfileControlPayload,
  type ProfileStarPayload,
  type RemoveFollowerPayload,
} from "./content.js";
import {
  EditorRouteError,
  EditorStorageNotReadyError,
  type AccountDeletionSchedulePayload,
  type AccountPasswordPayload,
  type EditorRepository,
  type MyPostsDeletePayload,
  type ProfileCanvasDraftState,
  type ProfileCanvasUpdatePayload,
} from "./editor.js";
import {
  IntegrationRouteError,
  IntegrationStorageNotReadyError,
  type IntegrationCardPayload,
  type IntegrationDiagnosticsPayload,
  type IntegrationOAuthStartPayload,
  type IntegrationOwnerPayload,
  type IntegrationSuggestionsPayload,
  type IntegrationsRepository,
} from "./integrations.js";
import {
  GrowthRouteError,
  type AdminGrowthMetricsPayload,
  type GrowthRepository,
} from "./growth.js";
import type {
  DiscoverPersonPayload,
  HomeFeedPayload,
  PostDetailPayload,
  PostsRepository,
} from "./posts.js";
import {
  PrivateRouteError,
  PrivateStorageNotReadyError,
  type AccountDataExportPayload,
  type AuthSessionPayload,
  type FollowRequestPayload,
  type MyPostPayload,
  type NotificationsReadAllPayload,
  type NotificationsReadPayload,
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
import type { ShareCardService } from "./share-cards.js";
import type { RequestSession, SessionsRepository } from "./sessions.js";
import type { ShareShellService } from "./share-shells.js";
import type { PublicStatsPayload, StatsRepository } from "./stats.js";
import type { UploadService } from "./uploads.js";

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
  theme: "glinda",
  themeConfig: { mode: "preset", preset: "glinda" },
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
  mood: "glinda",
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

const relationshipPayload: FollowRelationshipPayload = {
  isFollowing: true,
  isFollowedBy: false,
  isMoot: false,
  isFollowRequestPending: false,
  isBlocked: false,
  isMuted: false,
  followerCount: 15,
  followingCount: 27,
  mootCount: 14,
  starCount: 3,
  isStarred: false,
};

const profileControlPayload: ProfileControlPayload = {
  isBlocked: true,
  isMuted: false,
  relationship: {
    ...relationshipPayload,
    isFollowing: false,
    isBlocked: true,
  },
};

const profileStarPayload: ProfileStarPayload = {
  isStarred: true,
  starCount: 4,
  relationship: {
    ...relationshipPayload,
    isStarred: true,
    starCount: 4,
  },
  stats: {
    followers: 15,
    following: 27,
    moots: 14,
    stars: 4,
  },
};

const removeFollowerPayload: RemoveFollowerPayload = {
  removedFollower: true,
  relationship: relationshipPayload,
};

const postSharePayload: PostShareMessagesPayload = {
  post: {
    id: post.id,
    publicId: post.publicId,
    canonicalPath: "/@thia/posts/pc359fe2da759",
    canonicalUrl: "https://thia.lol/@thia/posts/pc359fe2da759",
    bodySnippet: "A public post.",
    createdAt: post.createdAt,
    mediaUrl: null,
    author: post.author,
    room,
  },
  results: [
    {
      recipientUserId: 43,
      recipient: {
        id: 43,
        handle: "friend",
        displayName: "Friend",
        initials: "F",
        aura: "frost",
        avatarUrl: null,
      },
      status: "sent",
      conversationId: 5,
      messageId: 9,
    },
  ],
  sentCount: 1,
  failedCount: 0,
};

function contentMutationsRepositoryMock(overrides: Partial<ContentMutationsRepository> = {}): ContentMutationsRepository {
  return {
    followProfile: vi.fn().mockResolvedValue(relationshipPayload),
    unfollowProfile: vi.fn().mockResolvedValue(relationshipPayload),
    blockProfile: vi.fn().mockResolvedValue(profileControlPayload),
    unblockProfile: vi.fn().mockResolvedValue(profileControlPayload),
    muteProfile: vi.fn().mockResolvedValue(profileControlPayload),
    unmuteProfile: vi.fn().mockResolvedValue(profileControlPayload),
    starProfile: vi.fn().mockResolvedValue(profileStarPayload),
    unstarProfile: vi.fn().mockResolvedValue(profileStarPayload),
    removeFollower: vi.fn().mockResolvedValue(removeFollowerPayload),
    approveFollowRequest: vi.fn().mockResolvedValue({ approved: true }),
    denyFollowRequest: vi.fn().mockResolvedValue({ denied: true }),
    createPost: vi.fn().mockResolvedValue(post),
    createReply: vi.fn().mockResolvedValue(post),
    updatePost: vi.fn().mockResolvedValue(post),
    deletePost: vi.fn().mockResolvedValue({
      id: 99,
      status: "removed",
      deletedAt: "2026-06-24 10:00:00",
    }),
    likePost: vi.fn().mockResolvedValue({
      postId: 99,
      likeCount: 3,
      likedByCurrentUser: true,
    }),
    unlikePost: vi.fn().mockResolvedValue({
      postId: 99,
      likeCount: 2,
      likedByCurrentUser: false,
    }),
    reblogPost: vi.fn().mockResolvedValue({
      postId: 99,
      reblogCount: 2,
      rebloggedByMe: true,
      rebloggedByCurrentUser: true,
    }),
    unreblogPost: vi.fn().mockResolvedValue({
      postId: 99,
      reblogCount: 1,
      rebloggedByMe: false,
      rebloggedByCurrentUser: false,
    }),
    reactToPost: vi.fn().mockResolvedValue({
      postId: 99,
      reactions: {
        glow: 2,
        echo: 1,
        hush: 0,
      },
    }),
    deletePostReaction: vi.fn().mockResolvedValue({
      postId: 99,
      reactions: {
        glow: 2,
        echo: 0,
        hush: 0,
      },
    }),
    sharePostToMessages: vi.fn().mockResolvedValue(postSharePayload),
    createRoom: vi.fn().mockResolvedValue(room),
    updateRoom: vi.fn().mockResolvedValue(room),
    deleteRoom: vi.fn().mockResolvedValue({
      slug: "general",
      deletedAt: "2026-06-24T10:00:00.000Z",
    }),
    joinRoom: vi.fn().mockResolvedValue(room),
    leaveRoom: vi.fn().mockResolvedValue(room),
    addRoomModerator: vi.fn().mockResolvedValue([roomMember]),
    removeRoomModerator: vi.fn().mockResolvedValue([roomMember]),
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

function uploadServiceMock(overrides: Partial<UploadService> = {}): UploadService {
  return {
    store: vi.fn().mockResolvedValue({
      url: "/uploads/media/2026/06/post_media-upload.webp",
      mime: "image/webp",
      type: "image/webp",
      size: 4,
      purpose: "post_media",
      mediaType: "image",
    }),
    previewImage: vi.fn().mockResolvedValue({
      body: Buffer.from("WEBP"),
      contentType: "image/webp",
      width: 2,
      height: 2,
    }),
    ...overrides,
  };
}

function multipartPayload(fields: Record<string, string>, file: { filename: string; contentType: string; body: Buffer }) {
  const boundary = "----thia-node-test-boundary";
  const chunks: Buffer[] = [];

  for (const [name, value] of Object.entries(fields)) {
    chunks.push(
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`,
        "utf8",
      ),
    );
  }

  chunks.push(
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${file.filename}"\r\nContent-Type: ${file.contentType}\r\n\r\n`,
      "utf8",
    ),
    file.body,
    Buffer.from(`\r\n--${boundary}--\r\n`, "utf8"),
  );

  return {
    body: Buffer.concat(chunks),
    contentType: `multipart/form-data; boundary=${boundary}`,
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

const authSessionResult: AuthSessionResult = {
  payload: authPayload,
  cookie: "thia_session=session-token; Path=/; Secure; HttpOnly; SameSite=Lax",
};

const authLogoutResult: AuthLogoutResult = {
  loggedOut: true,
  cookies: [
    "thia_session=; Expires=Wed, 01 Jan 2025 00:00:00 GMT; Path=/; Secure; HttpOnly; SameSite=Lax",
  ],
};

const twoFactorChallenge: TwoFactorChallengePayload = {
  twoFactorRequired: true,
  challengeId: "challenge-id",
  expiresAt: "2026-06-24 12:00:00",
};

const twoFactorSetupPayload: TwoFactorSetupPayload = {
  setup: {
    manualSecret: "ABCDEFGHIJKLMNOP",
    otpauthUri: "otpauth://totp/thia.lol%3Aviewer%40example.test?secret=ABCDEFGHIJKLMNOP&issuer=thia.lol",
  },
  twoFactor: {
    enabled: false,
    backupCodeCount: 0,
    encryptionConfigured: true,
    encryptionAvailable: true,
  },
};

const twoFactorEnablePayload: TwoFactorEnablePayload = {
  twoFactor: {
    enabled: true,
    backupCodeCount: 10,
    encryptionConfigured: true,
    encryptionAvailable: true,
  },
  backupCodes: ["ABC123DEF4"],
};

const twoFactorStatusPayload: TwoFactorStatusPayload = {
  twoFactor: {
    enabled: false,
    backupCodeCount: 0,
    encryptionConfigured: true,
    encryptionAvailable: true,
  },
};

const twoFactorRecoveryCodesPayload: TwoFactorRecoveryCodesPayload = {
  backupCodes: ["DEF123ABC4"],
  twoFactor: {
    enabled: true,
    backupCodeCount: 10,
    encryptionConfigured: true,
    encryptionAvailable: true,
  },
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

const notificationsReadPayload: NotificationsReadPayload = {
  ids: [8],
  readAt: "2026-06-24 10:00:00",
  unreadCount: 0,
};

const notificationsReadAllPayload: NotificationsReadAllPayload = {
  readAt: "2026-06-24 10:00:00",
  unreadCount: 0,
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

const accountDataExportPayload: AccountDataExportPayload = {
  schemaVersion: 1,
  generatedAt: "2026-06-26 12:00:00",
  account: {
    id: 42,
    handle: "viewer",
    email: "viewer@example.test",
    role: "member",
    status: "active",
  },
  profile: {
    details: {
      display_name: "Viewer",
      visibility: "public",
    },
    modules: [],
    canvasDraft: null,
    badges: [],
  },
  preferences: {
    settings: {
      analytics_consent: 0,
    },
    onboarding: null,
  },
  deletion: null,
  content: {
    postsAndReplies: [
      {
        id: 99,
        body: "A public post.",
      },
    ],
    attachments: [],
    reactions: [],
    reblogs: [],
  },
  media: {
    profileMedia: null,
    postMedia: [],
    attachments: [],
  },
  rooms: {
    created: [],
    memberships: [],
  },
  relationships: {
    following: [],
    followers: [],
    blocks: [],
    mutes: [],
    stars: [],
    followRequestsSent: [],
    followRequestsReceived: [],
  },
  messages: {
    sentMessages: [],
  },
  moderation: {
    submittedReports: [],
    accountReportStatuses: [],
  },
  integrations: {
    accounts: [
      {
        provider: "github",
        provider_handle: "viewer",
      },
    ],
  },
  purchases: {
    purchases: [],
    note: "No purchase history.",
  },
  limits: {
    perSection: 500,
    note: "Large sections are capped per export request.",
  },
};

function privateReadsRepositoryMock(overrides: Partial<PrivateReadsRepository> = {}): PrivateReadsRepository {
  return {
    authSessionPayload: vi.fn().mockReturnValue(authPayload),
    csrfTokenForSession: vi.fn().mockReturnValue("csrf-token"),
    getSettings: vi.fn().mockResolvedValue(settingsPayload),
    getOnboardingState: vi.fn().mockResolvedValue(onboardingPayload),
    getNotifications: vi.fn().mockResolvedValue(notificationsPayload),
    getFollowRequests: vi.fn().mockResolvedValue([followRequest]),
    getMyPosts: vi.fn().mockResolvedValue([myPost]),
    exportAccountData: vi.fn().mockResolvedValue(accountDataExportPayload),
    markNotificationsRead: vi.fn().mockResolvedValue(notificationsReadPayload),
    markAllNotificationsRead: vi.fn().mockResolvedValue(notificationsReadAllPayload),
    updateOnboardingState: vi.fn().mockResolvedValue(onboardingPayload),
    updatePrivacy: vi.fn().mockResolvedValue(settingsPayload),
    updatePreferences: vi.fn().mockResolvedValue(settingsPayload),
    ...overrides,
  };
}

const integrationOwnerPayload: IntegrationOwnerPayload = {
  providers: [
    {
      provider: "github",
      configured: true,
      oauthEnabled: true,
      linkSupported: true,
      metadataEnabled: true,
      missingConfigKeys: [],
    },
  ],
  accounts: [],
};

const integrationDiagnosticsPayload: IntegrationDiagnosticsPayload = {
  storageReady: true,
  encryptionConfigured: true,
  encryptionAvailable: true,
  cryptoMethod: "openssl",
  oauthStateExpiresIn: 600,
  providers: [
    {
      provider: "github",
      configured: true,
      oauthEnabled: true,
      linkSupported: true,
      metadataEnabled: true,
      missingConfigKeys: [],
      redirectUri: "https://thia.lol/api/integrations/github/callback",
    },
  ],
};

const integrationStartPayload: IntegrationOAuthStartPayload = {
  provider: "github",
  authorizationUrl: "https://github.com/login/oauth/authorize?state=state",
  stateExpiresIn: 600,
};

const integrationCardPayload: IntegrationCardPayload = {
  provider: "github",
  resourceType: "repo",
  resourceId: "thiabun/thia.lol",
  resourceKey: "github:repo:thiabun/thia.lol",
  sourceUrl: "https://github.com/thiabun/thia.lol",
  metadata: {
    title: "thiabun/thia.lol",
    subtitle: "GitHub repository",
    description: null,
    imageUrl: null,
    live: false,
    liveFetchedAt: null,
    recentLabel: null,
    recentFetchedAt: null,
    stats: {},
  },
  embed: null,
  apiBacked: false,
  fetchedAt: "2026-06-24T10:00:00.000Z",
  expiresAt: "2026-06-24T11:00:00.000Z",
  staleAt: "2026-06-25T10:00:00.000Z",
};

const integrationSuggestionsPayload: IntegrationSuggestionsPayload = {
  provider: "github",
  status: integrationOwnerPayload.providers[0]!,
  account: null,
  items: [],
  message: "Connect this provider to see suggestions, or paste a supported URL.",
  generatedAt: "2026-06-24T10:00:00.000Z",
};

function integrationsRepositoryMock(overrides: Partial<IntegrationsRepository> = {}): IntegrationsRepository {
  return {
    ownerIndex: vi.fn().mockResolvedValue(integrationOwnerPayload),
    diagnostics: vi.fn().mockResolvedValue(integrationDiagnosticsPayload),
    startOAuth: vi.fn().mockResolvedValue(integrationStartPayload),
    oauthCallback: vi.fn().mockResolvedValue({ location: "https://thia.lol/settings?integrationStatus=connected" }),
    disconnect: vi.fn().mockResolvedValue(integrationOwnerPayload),
    suggestions: vi.fn().mockResolvedValue(integrationSuggestionsPayload),
    resolveMetadata: vi.fn().mockResolvedValue(integrationCardPayload),
    ...overrides,
  };
}

function shareShellServiceMock(overrides: Partial<ShareShellService> = {}): ShareShellService {
  return {
    postShare: vi.fn().mockResolvedValue({
      kind: "html",
      statusCode: 200,
      html: "<!doctype html><title>Post</title><meta property=\"og:title\" content=\"Post\" />",
    }),
    profileShare: vi.fn().mockResolvedValue({
      kind: "html",
      statusCode: 200,
      html: "<!doctype html><title>Profile</title><meta property=\"og:title\" content=\"Profile\" />",
    }),
    roomShare: vi.fn().mockResolvedValue({
      kind: "html",
      statusCode: 200,
      html: "<!doctype html><title>Room</title><meta property=\"og:title\" content=\"Room\" />",
    }),
    ...overrides,
  };
}

function shareCardServiceMock(overrides: Partial<ShareCardService> = {}): ShareCardService {
  return {
    postCard: vi.fn().mockResolvedValue({
      body: Buffer.from("PNG"),
      contentType: "image/png",
      cacheControl: "public, max-age=1800",
    }),
    profileCard: vi.fn().mockResolvedValue({
      body: Buffer.from("PNG"),
      contentType: "image/png",
      cacheControl: "public, max-age=1800",
    }),
    roomCard: vi.fn().mockResolvedValue({
      body: Buffer.from("ROOM"),
      contentType: "image/png",
      cacheControl: "public, max-age=1800",
    }),
    cachePostCard: vi.fn().mockResolvedValue({
      url: "/uploads/share-cards/posts/card.png",
      width: 2400,
      height: 1260,
    }),
    cacheProfileCard: vi.fn().mockResolvedValue({
      url: "/uploads/share-cards/profiles/card.png",
      width: 2400,
      height: 1260,
    }),
    proxyImage: vi.fn().mockResolvedValue(null),
    ...overrides,
  };
}

const growthMetrics: AdminGrowthMetricsPayload = {
  windowDays: 30,
  totalSignups: 5,
  attributedSignups: 3,
  bySource: [{ key: "thia.lol", count: 3 }],
  byCampaign: [{ key: "profile-share", count: 2 }],
  byShareKind: [{ key: "profile", count: 2 }],
  topSharedEntities: [{ shareKind: "profile", shareRef: "thia", count: 2 }],
};

function growthRepositoryMock(overrides: Partial<GrowthRepository> = {}): GrowthRepository {
  return {
    adminMetrics: vi.fn().mockResolvedValue(growthMetrics),
    ...overrides,
  };
}

const canvasUpdatePayload: ProfileCanvasUpdatePayload = {
  backgroundBlur: "medium",
  canvasGlass: 58,
  canvasVersion: 2,
  modules: [profileModule],
};

const canvasDraftPayload: ProfileCanvasDraftState = {
  backgroundBlur: "medium",
  canvasGlass: 58,
  canvasVersion: 2,
  modules: [profileModule],
  selectedModuleId: null,
  updatedAt: "2026-06-24 12:00:00",
};

const myPostsDeletePayload: MyPostsDeletePayload = {
  deletedCount: 3,
  kind: "posts",
};

const accountPasswordPayload: AccountPasswordPayload = {
  changed: true,
};

const accountDeletionPayload: AccountDeletionSchedulePayload = {
  scheduled: true,
  scheduledFor: "2026-07-24 12:00:00",
};

function editorRepositoryMock(overrides: Partial<EditorRepository> = {}): EditorRepository {
  return {
    updateProfile: vi.fn().mockResolvedValue(profile),
    updateFeaturedProfile: vi.fn().mockResolvedValue(profile),
    listOwnerModules: vi.fn().mockResolvedValue([profileModule]),
    createModule: vi.fn().mockResolvedValue([profileModule]),
    updateModule: vi.fn().mockResolvedValue([profileModule]),
    deleteModule: vi.fn().mockResolvedValue([profileModule]),
    restoreModule: vi.fn().mockResolvedValue([profileModule]),
    updateModuleOrder: vi.fn().mockResolvedValue([profileModule]),
    updateCanvas: vi.fn().mockResolvedValue(canvasUpdatePayload),
    getCanvasDraft: vi.fn().mockResolvedValue(canvasDraftPayload),
    updateCanvasDraft: vi.fn().mockResolvedValue(canvasDraftPayload),
    deleteCanvasDraft: vi.fn().mockResolvedValue(canvasDraftPayload),
    commitCanvasDraft: vi.fn().mockResolvedValue(canvasUpdatePayload),
    updateFeaturedBadges: vi.fn().mockResolvedValue(profileBadges),
    deleteMyPosts: vi.fn().mockResolvedValue(myPostsDeletePayload),
    updateAccountEmail: vi.fn().mockResolvedValue(settingsPayload),
    updateAccountHandle: vi.fn().mockResolvedValue(settingsPayload),
    updateAccountPassword: vi.fn().mockResolvedValue(accountPasswordPayload),
    scheduleAccountDeletion: vi.fn().mockResolvedValue(accountDeletionPayload),
    cancelAccountDeletion: vi.fn().mockResolvedValue(settingsPayload),
    ...overrides,
  };
}

function authRepositoryMock(overrides: Partial<AuthRepository> = {}): AuthRepository {
  return {
    login: vi.fn().mockResolvedValue(authSessionResult),
    register: vi.fn().mockResolvedValue(authSessionResult),
    logout: vi.fn().mockResolvedValue(authLogoutResult),
    verifyTwoFactor: vi.fn().mockResolvedValue(authSessionResult),
    setupTwoFactor: vi.fn().mockResolvedValue(twoFactorSetupPayload),
    enableTwoFactor: vi.fn().mockResolvedValue(twoFactorEnablePayload),
    disableTwoFactor: vi.fn().mockResolvedValue(twoFactorStatusPayload),
    regenerateTwoFactorRecoveryCodes: vi.fn().mockResolvedValue(twoFactorRecoveryCodesPayload),
    csrfTokenForSession: vi.fn().mockReturnValue("csrf-token"),
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

  it("requires authentication before CSRF for private mutations", async () => {
    const repository = privateReadsRepositoryMock();
    const app = buildApp({
      privateReadsRepository: repository,
      sessionsRepository: sessionsRepositoryMock({
        currentSession: vi.fn().mockResolvedValue(null),
      }),
    });
    const response = await app.inject({
      method: "POST",
      url: "/notifications/read",
      payload: {
        id: 8,
      },
    });

    expect(response.statusCode).toBe(401);
    expect(repository.markNotificationsRead).not.toHaveBeenCalled();
    expect(response.json()).toEqual({
      ok: false,
      error: "Unauthenticated.",
    });
  });

  it("requires a PHP-compatible CSRF header for private mutations", async () => {
    const repository = privateReadsRepositoryMock();
    const app = buildApp({
      privateReadsRepository: repository,
      sessionsRepository: sessionsRepositoryMock(),
    });

    const missing = await app.inject({
      method: "POST",
      url: "/notifications/read",
      payload: {
        id: 8,
      },
    });
    const invalid = await app.inject({
      method: "POST",
      url: "/notifications/read",
      headers: {
        "x-csrf-token": "wrong",
      },
      payload: {
        id: 8,
      },
    });

    expect(missing.statusCode).toBe(403);
    expect(missing.json()).toEqual({
      ok: false,
      error: "CSRF token is required.",
    });
    expect(invalid.statusCode).toBe(403);
    expect(invalid.json()).toEqual({
      ok: false,
      error: "Invalid CSRF token.",
    });
    expect(repository.markNotificationsRead).not.toHaveBeenCalled();
  });

  it("creates account data exports through the PHP success wrapper", async () => {
    const repository = privateReadsRepositoryMock();
    const app = buildApp({
      privateReadsRepository: repository,
      sessionsRepository: sessionsRepositoryMock(),
    });
    const response = await app.inject({
      method: "POST",
      url: "/me/data-export",
      headers: {
        "x-csrf-token": "csrf-token",
      },
      payload: {
        currentPassword: "correct-password",
      },
    });
    const text = response.body;

    expect(response.statusCode).toBe(200);
    expect(repository.exportAccountData).toHaveBeenCalledWith(session, {
      currentPassword: "correct-password",
    });
    expect(response.json()).toEqual({
      ok: true,
      data: accountDataExportPayload,
    });
    expect(text).not.toContain("password_hash");
    expect(text).not.toContain("token_hash");
    expect(text).not.toContain("access_token_cipher");
    expect(text).not.toContain("refresh_token_cipher");
  });

  it("requires authentication and CSRF before account data export", async () => {
    const unauthenticatedRepository = privateReadsRepositoryMock();
    const unauthenticatedApp = buildApp({
      privateReadsRepository: unauthenticatedRepository,
      sessionsRepository: sessionsRepositoryMock({
        currentSession: vi.fn().mockResolvedValue(null),
      }),
    });
    const unauthenticated = await unauthenticatedApp.inject({
      method: "POST",
      url: "/me/data-export",
      payload: {
        currentPassword: "correct-password",
      },
    });
    const repository = privateReadsRepositoryMock();
    const app = buildApp({
      privateReadsRepository: repository,
      sessionsRepository: sessionsRepositoryMock(),
    });
    const missingCsrf = await app.inject({
      method: "POST",
      url: "/me/data-export",
      payload: {
        currentPassword: "correct-password",
      },
    });
    const invalidCsrf = await app.inject({
      method: "POST",
      url: "/me/data-export",
      headers: {
        "x-csrf-token": "wrong",
      },
      payload: {
        currentPassword: "correct-password",
      },
    });

    expect(unauthenticated.statusCode).toBe(401);
    expect(unauthenticated.json()).toEqual({
      ok: false,
      error: "Unauthenticated.",
    });
    expect(missingCsrf.statusCode).toBe(403);
    expect(missingCsrf.json()).toEqual({
      ok: false,
      error: "CSRF token is required.",
    });
    expect(invalidCsrf.statusCode).toBe(403);
    expect(invalidCsrf.json()).toEqual({
      ok: false,
      error: "Invalid CSRF token.",
    });
    expect(unauthenticatedRepository.exportAccountData).not.toHaveBeenCalled();
    expect(repository.exportAccountData).not.toHaveBeenCalled();
  });

  it("maps account data export password failures to safe JSON", async () => {
    const repository = privateReadsRepositoryMock({
      exportAccountData: vi.fn().mockRejectedValue(new PrivateRouteError("Current password is incorrect.", 403)),
    });
    const app = buildApp({
      privateReadsRepository: repository,
      sessionsRepository: sessionsRepositoryMock(),
    });
    const response = await app.inject({
      method: "POST",
      url: "/me/data-export",
      headers: {
        "x-csrf-token": "csrf-token",
      },
      payload: {
        currentPassword: "wrong-password",
      },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({
      ok: false,
      error: "Current password is incorrect.",
    });
  });

  it("marks selected notifications read through the PHP success wrapper", async () => {
    const repository = privateReadsRepositoryMock();
    const app = buildApp({
      privateReadsRepository: repository,
      sessionsRepository: sessionsRepositoryMock(),
    });
    const response = await app.inject({
      method: "POST",
      url: "/notifications/read",
      headers: {
        "x-csrf-token": "csrf-token",
      },
      payload: {
        id: "8",
        ids: [8, "8"],
      },
    });

    expect(response.statusCode).toBe(200);
    expect(repository.markNotificationsRead).toHaveBeenCalledWith(42, [8]);
    expect(response.json()).toEqual({
      ok: true,
      data: notificationsReadPayload,
    });
  });

  it("marks all notifications read through the PHP success wrapper", async () => {
    const repository = privateReadsRepositoryMock();
    const app = buildApp({
      privateReadsRepository: repository,
      sessionsRepository: sessionsRepositoryMock(),
    });
    const response = await app.inject({
      method: "POST",
      url: "/notifications/read-all",
      headers: {
        "x-csrf-token": "csrf-token",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(repository.markAllNotificationsRead).toHaveBeenCalledWith(42);
    expect(response.json()).toEqual({
      ok: true,
      data: notificationsReadAllPayload,
    });
  });

  it("marks one notification read from the path id", async () => {
    const repository = privateReadsRepositoryMock();
    const app = buildApp({
      privateReadsRepository: repository,
      sessionsRepository: sessionsRepositoryMock(),
    });
    const response = await app.inject({
      method: "POST",
      url: "/notifications/8/read",
      headers: {
        "x-csrf-token": "csrf-token",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(repository.markNotificationsRead).toHaveBeenCalledWith(42, [8]);
  });

  it("updates onboarding, privacy, and preferences through private mutation wrappers", async () => {
    const repository = privateReadsRepositoryMock();
    const app = buildApp({
      privateReadsRepository: repository,
      sessionsRepository: sessionsRepositoryMock(),
    });

    const onboarding = await app.inject({
      method: "PATCH",
      url: "/me/onboarding",
      headers: {
        "x-csrf-token": "csrf-token",
      },
      payload: {
        action: "complete_step",
        step: "profile_basics",
      },
    });
    const privacy = await app.inject({
      method: "PATCH",
      url: "/me/privacy",
      headers: {
        "x-csrf-token": "csrf-token",
      },
      payload: {
        profileVisibility: "private",
      },
    });
    const preferences = await app.inject({
      method: "PATCH",
      url: "/me/preferences",
      headers: {
        "x-csrf-token": "csrf-token",
      },
      payload: {
        notifications: {
          likes: false,
        },
      },
    });

    expect(onboarding.statusCode).toBe(200);
    expect(privacy.statusCode).toBe(200);
    expect(preferences.statusCode).toBe(200);
    expect(repository.updateOnboardingState).toHaveBeenCalledWith(42, {
      action: "complete_step",
      step: "profile_basics",
    });
    expect(repository.updatePrivacy).toHaveBeenCalledWith(session, {
      profileVisibility: "private",
    });
    expect(repository.updatePreferences).toHaveBeenCalledWith(session, {
      notifications: {
        likes: false,
      },
    });
  });

  it("maps private mutation validation and storage failures to PHP-compatible JSON", async () => {
    const repository = privateReadsRepositoryMock({
      updateOnboardingState: vi
        .fn()
        .mockRejectedValue(new PrivateStorageNotReadyError("Onboarding storage is not ready. Run pending migrations.")),
    });
    const app = buildApp({
      privateReadsRepository: repository,
      sessionsRepository: sessionsRepositoryMock(),
    });
    const invalidIds = await app.inject({
      method: "POST",
      url: "/notifications/read",
      headers: {
        "x-csrf-token": "csrf-token",
      },
      payload: {
        ids: "8",
      },
    });
    const storage = await app.inject({
      method: "PATCH",
      url: "/me/onboarding",
      headers: {
        "x-csrf-token": "csrf-token",
      },
      payload: {
        action: "reset",
      },
    });

    expect(invalidIds.statusCode).toBe(422);
    expect(invalidIds.json()).toEqual({
      ok: false,
      error: "Notification ids must be an array.",
    });
    expect(storage.statusCode).toBe(503);
    expect(storage.json()).toEqual({
      ok: false,
      error: "Onboarding storage is not ready. Run pending migrations.",
    });
  });

  it("returns PHP-compatible JSON body errors for malformed mutation payloads", async () => {
    const repository = privateReadsRepositoryMock();
    const app = buildApp({
      privateReadsRepository: repository,
      sessionsRepository: sessionsRepositoryMock(),
    });
    const malformed = await app.inject({
      method: "PATCH",
      url: "/me/preferences",
      headers: {
        "content-type": "application/json",
        "x-csrf-token": "csrf-token",
      },
      payload: "{",
    });
    const scalar = await app.inject({
      method: "PATCH",
      url: "/me/preferences",
      headers: {
        "content-type": "application/json",
        "x-csrf-token": "csrf-token",
      },
      payload: '"nope"',
    });

    expect(malformed.statusCode).toBe(400);
    expect(malformed.json()).toEqual({
      ok: false,
      error: "Invalid JSON body.",
    });
    expect(scalar.statusCode).toBe(400);
    expect(scalar.json()).toEqual({
      ok: false,
      error: "JSON body must be an object.",
    });
  });
});

describe("Node API profile/account editor preview routes", () => {
  it("requires authentication before CSRF for editor mutations", async () => {
    const repository = editorRepositoryMock();
    const app = buildApp({
      editorRepository: repository,
      privateReadsRepository: privateReadsRepositoryMock(),
      sessionsRepository: sessionsRepositoryMock({
        currentSession: vi.fn().mockResolvedValue(null),
      }),
    });
    const response = await app.inject({
      method: "PATCH",
      url: "/me/profile",
      payload: {
        displayName: "Viewer",
      },
    });

    expect(response.statusCode).toBe(401);
    expect(repository.updateProfile).not.toHaveBeenCalled();
    expect(response.json()).toEqual({
      ok: false,
      error: "Unauthenticated.",
    });
  });

  it("requires a PHP-compatible CSRF header for editor mutations", async () => {
    const repository = editorRepositoryMock();
    const app = buildApp({
      editorRepository: repository,
      privateReadsRepository: privateReadsRepositoryMock(),
      sessionsRepository: sessionsRepositoryMock(),
    });
    const missing = await app.inject({
      method: "PATCH",
      url: "/me/profile",
      payload: {
        displayName: "Viewer",
      },
    });
    const invalid = await app.inject({
      method: "PATCH",
      url: "/me/profile",
      headers: {
        "x-csrf-token": "wrong",
      },
      payload: {
        displayName: "Viewer",
      },
    });

    expect(missing.statusCode).toBe(403);
    expect(missing.json()).toEqual({
      ok: false,
      error: "CSRF token is required.",
    });
    expect(invalid.statusCode).toBe(403);
    expect(invalid.json()).toEqual({
      ok: false,
      error: "Invalid CSRF token.",
    });
    expect(repository.updateProfile).not.toHaveBeenCalled();
  });

  it("serves profile editor mutations through PHP-style wrappers", async () => {
    const repository = editorRepositoryMock();
    const app = buildApp({
      editorRepository: repository,
      privateReadsRepository: privateReadsRepositoryMock(),
      sessionsRepository: sessionsRepositoryMock(),
    });

    for (const [method, path, payload, expectedStatus] of [
      ["PATCH", "/me/profile", { displayName: "Viewer" }, 200],
      ["PATCH", "/me/profile/featured", { featuredPostId: null, featuredRoomId: null }, 200],
      ["POST", "/me/profile/modules", { type: "custom_text", title: "Note", config: { body: "Hello" } }, 201],
      ["PATCH", "/me/profile/modules/11", { title: "Note" }, 200],
      ["DELETE", "/me/profile/modules/11", {}, 200],
      ["POST", "/me/profile/modules/11/restore", {}, 200],
      ["PATCH", "/me/profile/module-order", { moduleIds: [11] }, 200],
      ["PATCH", "/me/profile/canvas", { backgroundBlur: "medium" }, 200],
      ["PATCH", "/me/profile/canvas-draft", { backgroundBlur: "soft" }, 200],
      ["DELETE", "/me/profile/canvas-draft", {}, 200],
      ["POST", "/me/profile/canvas-draft/commit", {}, 200],
      ["PATCH", "/me/badges/featured", { featuredBadgeIds: [1] }, 200],
      ["DELETE", "/me/posts?kind=posts", {}, 200],
    ] as const) {
      const response = await app.inject({
        method,
        url: path,
        headers: {
          "x-csrf-token": "csrf-token",
        },
        payload,
      });

      expect(response.statusCode).toBe(expectedStatus);
      expect(response.json()).toHaveProperty("ok", true);
    }

    expect(repository.updateProfile).toHaveBeenCalledWith(session, { displayName: "Viewer" });
    expect(repository.updateFeaturedProfile).toHaveBeenCalledWith(session, {
      featuredPostId: null,
      featuredRoomId: null,
    });
    expect(repository.createModule).toHaveBeenCalledWith(session, {
      type: "custom_text",
      title: "Note",
      config: {
        body: "Hello",
      },
    });
    expect(repository.updateModule).toHaveBeenCalledWith(session, 11, { title: "Note" });
    expect(repository.deleteModule).toHaveBeenCalledWith(session, 11);
    expect(repository.restoreModule).toHaveBeenCalledWith(session, 11);
    expect(repository.updateModuleOrder).toHaveBeenCalledWith(session, { moduleIds: [11] });
    expect(repository.updateCanvas).toHaveBeenCalledWith(session, { backgroundBlur: "medium" });
    expect(repository.updateCanvasDraft).toHaveBeenCalledWith(session, { backgroundBlur: "soft" });
    expect(repository.deleteCanvasDraft).toHaveBeenCalledWith(session);
    expect(repository.commitCanvasDraft).toHaveBeenCalledWith(session);
    expect(repository.updateFeaturedBadges).toHaveBeenCalledWith(session, { featuredBadgeIds: [1] });
    expect(repository.deleteMyPosts).toHaveBeenCalledWith(42, "posts");
  });

  it("serves profile editor reads through PHP-style wrappers", async () => {
    const repository = editorRepositoryMock();
    const app = buildApp({
      editorRepository: repository,
      sessionsRepository: sessionsRepositoryMock(),
    });
    const modules = await app.inject({
      method: "GET",
      url: "/me/profile/modules?includeDeleted=1",
    });
    const draft = await app.inject({
      method: "GET",
      url: "/me/profile/canvas-draft",
    });

    expect(modules.statusCode).toBe(200);
    expect(modules.json()).toEqual({
      ok: true,
      data: [profileModule],
    });
    expect(repository.listOwnerModules).toHaveBeenCalledWith(42, true);
    expect(draft.statusCode).toBe(200);
    expect(draft.json()).toEqual({
      ok: true,
      data: canvasDraftPayload,
    });
  });

  it("serves account editor mutations and clears cookies for account deletion", async () => {
    const repository = editorRepositoryMock();
    const app = buildApp({
      editorRepository: repository,
      privateReadsRepository: privateReadsRepositoryMock(),
      publicBaseUrl: "https://thia.lol",
      sessionCookieDomain: ".thia.lol",
      sessionCookieName: "thia_session",
      sessionsRepository: sessionsRepositoryMock(),
    });

    for (const [method, path, payload] of [
      ["PATCH", "/me/account/email", { email: "viewer2@example.test", currentPassword: "correct-password" }],
      ["PATCH", "/me/account/handle", { handle: "viewer2", currentPassword: "correct-password" }],
      ["PATCH", "/me/account/password", { currentPassword: "correct-password", newPassword: "new-correct-password" }],
      ["POST", "/me/account/deletion/cancel", {}],
    ] as const) {
      const response = await app.inject({
        method,
        url: path,
        headers: {
          "x-csrf-token": "csrf-token",
          "x-forwarded-host": "thia.lol",
          "x-forwarded-proto": "https",
        },
        payload,
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toHaveProperty("ok", true);
    }

    const deletion = await app.inject({
      method: "DELETE",
      url: "/me/account",
      headers: {
        "x-csrf-token": "csrf-token",
        "x-forwarded-host": "thia.lol",
        "x-forwarded-proto": "https",
      },
      payload: {
        currentPassword: "correct-password",
      },
    });

    expect(deletion.statusCode).toBe(200);
    expect(deletion.headers["set-cookie"]).toEqual(expect.arrayContaining([
      expect.stringContaining("thia_session=;"),
    ]));
    expect(deletion.json()).toEqual({
      ok: true,
      data: accountDeletionPayload,
    });
    expect(repository.updateAccountEmail).toHaveBeenCalled();
    expect(repository.updateAccountHandle).toHaveBeenCalled();
    expect(repository.updateAccountPassword).toHaveBeenCalled();
    expect(repository.cancelAccountDeletion).toHaveBeenCalledWith(session);
    expect(repository.scheduleAccountDeletion).toHaveBeenCalledWith(session, {
      currentPassword: "correct-password",
    });
  });

  it("maps editor validation and storage errors to PHP-compatible JSON", async () => {
    const repository = editorRepositoryMock({
      updateProfile: vi.fn().mockRejectedValue(new EditorRouteError("Display name is required.", 422)),
      listOwnerModules: vi
        .fn()
        .mockRejectedValue(new EditorStorageNotReadyError("Profile module storage is not ready. Run pending migrations.")),
    });
    const app = buildApp({
      editorRepository: repository,
      privateReadsRepository: privateReadsRepositoryMock(),
      sessionsRepository: sessionsRepositoryMock(),
    });
    const invalid = await app.inject({
      method: "PATCH",
      url: "/me/profile",
      headers: {
        "x-csrf-token": "csrf-token",
      },
      payload: {
        displayName: "",
      },
    });
    const storage = await app.inject({
      method: "GET",
      url: "/me/profile/modules",
    });

    expect(invalid.statusCode).toBe(422);
    expect(invalid.json()).toEqual({
      ok: false,
      error: "Display name is required.",
    });
    expect(storage.statusCode).toBe(503);
    expect(storage.json()).toEqual({
      ok: false,
      error: "Profile module storage is not ready. Run pending migrations.",
    });
  });
});

describe("Node API auth preview mutation routes", () => {
  it("logs in with a PHP-compatible auth wrapper and session cookie", async () => {
    const repository = authRepositoryMock();
    const app = buildApp({
      authRepository: repository,
      publicBaseUrl: "https://thia.lol",
    });
    const response = await app.inject({
      method: "POST",
      url: "/auth/login",
      headers: {
        "x-forwarded-for": "203.0.113.5",
        "x-forwarded-host": "thia.lol",
        "x-forwarded-proto": "https",
        "user-agent": "vitest",
      },
      payload: {
        email: "viewer@example.test",
        password: "correct-password",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["set-cookie"]).toBe(authSessionResult.cookie);
    expect(repository.login).toHaveBeenCalledWith(
      {
        email: "viewer@example.test",
        password: "correct-password",
      },
      expect.objectContaining({
        ipAddress: "203.0.113.5",
        host: "thia.lol",
        secure: true,
        userAgent: "vitest",
      }),
    );
    expect(response.json()).toEqual({
      ok: true,
      data: authPayload,
    });
  });

  it("returns a two-factor challenge without setting a session cookie", async () => {
    const repository = authRepositoryMock({
      login: vi.fn().mockResolvedValue(twoFactorChallenge),
    });
    const app = buildApp({
      authRepository: repository,
    });
    const response = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: {
        email: "viewer@example.test",
        password: "correct-password",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["set-cookie"]).toBeUndefined();
    expect(response.json()).toEqual({
      ok: true,
      data: twoFactorChallenge,
    });
  });

  it("registers with HTTP 201 and a session cookie", async () => {
    const repository = authRepositoryMock();
    const app = buildApp({
      authRepository: repository,
    });
    const response = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: {
        email: "new@example.test",
        password: "correct-password",
        handle: "new_user",
        displayName: "New User",
        attribution: {
          source: "thia.lol",
          medium: "share",
          campaign: "profile-share",
          shareKind: "profile",
          shareRef: "thia",
          referrerHost: null,
          landingPath: "/@thia",
        },
      },
    });

    expect(response.statusCode).toBe(201);
    expect(response.headers["set-cookie"]).toBe(authSessionResult.cookie);
    expect(repository.register).toHaveBeenCalledWith(
      expect.objectContaining({
        attribution: expect.objectContaining({
          source: "thia.lol",
          shareKind: "profile",
          shareRef: "thia",
        }),
      }),
      expect.any(Object),
    );
    expect(response.json()).toEqual({
      ok: true,
      data: authPayload,
    });
  });

  it("logs out and clears session cookies", async () => {
    const repository = authRepositoryMock();
    const app = buildApp({
      authRepository: repository,
    });
    const response = await app.inject({
      method: "POST",
      url: "/auth/logout",
      headers: {
        cookie: "thia_session=session-token",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["set-cookie"]).toEqual(authLogoutResult.cookies);
    expect(repository.logout).toHaveBeenCalled();
    expect(response.json()).toEqual({
      ok: true,
      data: {
        loggedOut: true,
      },
    });
  });

  it("verifies a two-factor challenge and creates a session", async () => {
    const repository = authRepositoryMock();
    const app = buildApp({
      authRepository: repository,
    });
    const response = await app.inject({
      method: "POST",
      url: "/auth/2fa/verify",
      payload: {
        challengeId: "challenge-id",
        code: "123456",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["set-cookie"]).toBe(authSessionResult.cookie);
    expect(repository.verifyTwoFactor).toHaveBeenCalledWith(
      {
        challengeId: "challenge-id",
        code: "123456",
      },
      expect.any(Object),
    );
  });

  it("requires auth and CSRF for protected two-factor settings mutations", async () => {
    const repository = authRepositoryMock();
    const app = buildApp({
      authRepository: repository,
      sessionsRepository: sessionsRepositoryMock({
        currentSession: vi.fn().mockResolvedValue(null),
      }),
    });
    const unauthenticated = await app.inject({
      method: "POST",
      url: "/me/security/2fa/setup",
      payload: {
        currentPassword: "correct-password",
      },
    });
    const authenticatedApp = buildApp({
      authRepository: repository,
      sessionsRepository: sessionsRepositoryMock(),
    });
    const missingCsrf = await authenticatedApp.inject({
      method: "POST",
      url: "/me/security/2fa/setup",
      payload: {
        currentPassword: "correct-password",
      },
    });

    expect(unauthenticated.statusCode).toBe(401);
    expect(unauthenticated.json()).toEqual({
      ok: false,
      error: "Unauthenticated.",
    });
    expect(missingCsrf.statusCode).toBe(403);
    expect(missingCsrf.json()).toEqual({
      ok: false,
      error: "CSRF token is required.",
    });
  });

  it("serves protected two-factor settings mutations through PHP-style wrappers", async () => {
    const repository = authRepositoryMock();
    const app = buildApp({
      authRepository: repository,
      sessionsRepository: sessionsRepositoryMock(),
    });

    for (const [method, path, payload, expected] of [
      ["POST", "/me/security/2fa/setup", { currentPassword: "correct-password" }, twoFactorSetupPayload],
      ["POST", "/me/security/2fa/enable", { code: "123456" }, twoFactorEnablePayload],
      ["DELETE", "/me/security/2fa", { currentPassword: "correct-password" }, twoFactorStatusPayload],
      ["POST", "/me/security/2fa/recovery-codes", { currentPassword: "correct-password" }, twoFactorRecoveryCodesPayload],
    ] as const) {
      const response = await app.inject({
        method,
        url: path,
        headers: {
          "x-csrf-token": "csrf-token",
        },
        payload,
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        ok: true,
        data: expected,
      });
    }

    expect(repository.setupTwoFactor).toHaveBeenCalledWith(session, { currentPassword: "correct-password" });
    expect(repository.enableTwoFactor).toHaveBeenCalledWith(session, { code: "123456" });
    expect(repository.disableTwoFactor).toHaveBeenCalledWith(session, { currentPassword: "correct-password" });
    expect(repository.regenerateTwoFactorRecoveryCodes).toHaveBeenCalledWith(session, { currentPassword: "correct-password" });
  });
});

describe("Node API integrations and share shell routes", () => {
  it("returns authenticated integration owner state", async () => {
    const repository = integrationsRepositoryMock();
    const app = buildApp({
      integrationsRepository: repository,
      sessionsRepository: sessionsRepositoryMock(),
    });
    const response = await app.inject({
      method: "GET",
      url: "/me/integrations",
      headers: {
        cookie: "thia_session=token",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(repository.ownerIndex).toHaveBeenCalledWith(session);
    expect(response.json()).toEqual({
      ok: true,
      data: integrationOwnerPayload,
    });
  });

  it("requires CSRF for integration mutations", async () => {
    const app = buildApp({
      integrationsRepository: integrationsRepositoryMock(),
      privateReadsRepository: privateReadsRepositoryMock(),
      sessionsRepository: sessionsRepositoryMock(),
    });
    const response = await app.inject({
      method: "POST",
      url: "/me/integrations/github/start",
      headers: {
        cookie: "thia_session=token",
      },
      payload: {
        redirectPath: "/settings",
      },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({
      ok: false,
      error: "CSRF token is required.",
    });
  });

  it("starts provider OAuth with CSRF and returns created payload", async () => {
    const repository = integrationsRepositoryMock();
    const app = buildApp({
      integrationsRepository: repository,
      privateReadsRepository: privateReadsRepositoryMock(),
      sessionsRepository: sessionsRepositoryMock(),
    });
    const response = await app.inject({
      method: "POST",
      url: "/me/integrations/github/start",
      headers: {
        cookie: "thia_session=token",
        "x-csrf-token": "csrf-token",
      },
      payload: {
        redirectPath: "/settings",
      },
    });

    expect(response.statusCode).toBe(201);
    expect(repository.startOAuth).toHaveBeenCalledWith(session, "github", { redirectPath: "/settings" });
    expect(response.json()).toEqual({
      ok: true,
      data: integrationStartPayload,
    });
  });

  it("returns storage-not-ready for integration storage failures", async () => {
    const app = buildApp({
      integrationsRepository: integrationsRepositoryMock({
        ownerIndex: vi.fn().mockRejectedValue(new IntegrationStorageNotReadyError()),
      }),
      sessionsRepository: sessionsRepositoryMock(),
    });
    const response = await app.inject({
      method: "GET",
      url: "/me/integrations",
      headers: {
        cookie: "thia_session=token",
      },
    });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({
      ok: false,
      error: "Profile integration storage is not ready. Run pending migrations.",
    });
  });

  it("returns integration route errors without raw details", async () => {
    const app = buildApp({
      integrationsRepository: integrationsRepositoryMock({
        resolveMetadata: vi.fn().mockRejectedValue(new IntegrationRouteError("Choose a supported integration URL.", 422)),
      }),
      privateReadsRepository: privateReadsRepositoryMock(),
      sessionsRepository: sessionsRepositoryMock(),
    });
    const response = await app.inject({
      method: "POST",
      url: "/me/integrations/metadata/resolve",
      headers: {
        cookie: "thia_session=token",
        "x-csrf-token": "csrf-token",
      },
      payload: {
        url: "https://example.com",
      },
    });

    expect(response.statusCode).toBe(422);
    expect(response.json()).toEqual({
      ok: false,
      error: "Choose a supported integration URL.",
    });
  });

  it("redirects integration callbacks to the app", async () => {
    const repository = integrationsRepositoryMock();
    const app = buildApp({
      integrationsRepository: repository,
    });
    const response = await app.inject({
      method: "GET",
      url: "/integrations/github/callback?state=abc&code=def",
    });

    expect(response.statusCode).toBe(303);
    expect(response.headers.location).toBe("https://thia.lol/settings?integrationStatus=connected");
    expect(repository.oauthCallback).toHaveBeenCalledWith("github", { state: "abc", code: "def" });
  });

  it("serves post and profile share HTML shells", async () => {
    const service = shareShellServiceMock();
    const app = buildApp({
      shareShellService: service,
    });
    const postResponse = await app.inject({
      method: "GET",
      url: "/post-share.php?handle=thia&postId=pc359fe2da759",
    });
    const profileResponse = await app.inject({
      method: "GET",
      url: "/profile-share.php?handle=thia",
    });
    const canonicalPostResponse = await app.inject({
      method: "GET",
      url: "/@thia/posts/pc359fe2da759",
    });
    const canonicalProfileResponse = await app.inject({
      method: "GET",
      url: "/@thia",
    });
    const canonicalPostSlashResponse = await app.inject({
      method: "GET",
      url: "/@thia/posts/pc359fe2da759/",
    });
    const canonicalProfileSlashResponse = await app.inject({
      method: "GET",
      url: "/@thia/",
    });
    const roomResponse = await app.inject({
      method: "GET",
      url: "/room-share.php?slug=general",
    });

    expect(postResponse.statusCode).toBe(200);
    expect(postResponse.headers["content-type"]).toContain("text/html");
    expect(postResponse.headers["cache-control"]).toBe("no-cache, no-store, must-revalidate");
    expect(postResponse.body).toContain("og:title");
    expect(profileResponse.statusCode).toBe(200);
    expect(profileResponse.body).toContain("Profile");
    expect(canonicalPostResponse.statusCode).toBe(200);
    expect(canonicalPostResponse.body).toContain("Post");
    expect(canonicalProfileResponse.statusCode).toBe(200);
    expect(canonicalProfileResponse.body).toContain("Profile");
    expect(canonicalPostSlashResponse.statusCode).toBe(200);
    expect(canonicalProfileSlashResponse.statusCode).toBe(200);
    expect(roomResponse.statusCode).toBe(200);
    expect(roomResponse.body).toContain("Room");
    expect(service.postShare).toHaveBeenNthCalledWith(1, { handle: "thia", postId: "pc359fe2da759" });
    expect(service.profileShare).toHaveBeenNthCalledWith(1, { handle: "thia" });
    expect(service.postShare).toHaveBeenNthCalledWith(2, { handle: "thia", postId: "pc359fe2da759" });
    expect(service.profileShare).toHaveBeenNthCalledWith(2, { handle: "thia" });
    expect(service.postShare).toHaveBeenNthCalledWith(3, { handle: "thia", postId: "pc359fe2da759" });
    expect(service.profileShare).toHaveBeenNthCalledWith(3, { handle: "thia" });
    expect(service.roomShare).toHaveBeenCalledWith({ slug: "general" });
  });

  it("serves share shell redirects", async () => {
    const app = buildApp({
      shareShellService: shareShellServiceMock({
        postShare: vi.fn().mockResolvedValue({
          kind: "redirect",
          statusCode: 302,
          location: "/@thia/posts/pc359fe2da759",
        }),
      }),
    });
    const response = await app.inject({
      method: "GET",
      url: "/post-share.php?handle=Thia&postId=99",
    });

    expect(response.statusCode).toBe(302);
    expect(response.headers.location).toBe("/@thia/posts/pc359fe2da759");
  });
});

describe("Node API growth preview route", () => {
  it("returns admin-only aggregate growth metrics", async () => {
    const repository = growthRepositoryMock();
    const app = buildApp({
      growthRepository: repository,
      sessionsRepository: sessionsRepositoryMock(),
    });
    const response = await app.inject({
      method: "GET",
      url: "/admin/growth",
      headers: {
        cookie: "thia_session=token",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(repository.adminMetrics).toHaveBeenCalledWith(session);
    expect(response.json()).toEqual({
      ok: true,
      data: growthMetrics,
    });
  });

  it("rejects growth metrics for non-admin sessions", async () => {
    const app = buildApp({
      growthRepository: growthRepositoryMock({
        adminMetrics: vi.fn().mockRejectedValue(new GrowthRouteError("Admin access required.", 403)),
      }),
      sessionsRepository: sessionsRepositoryMock(),
    });
    const response = await app.inject({
      method: "GET",
      url: "/admin/growth",
      headers: {
        cookie: "thia_session=token",
      },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({
      ok: false,
      error: "Admin access required.",
    });
  });
});

describe("Node API social and content mutation preview routes", () => {
  it("requires authentication before CSRF for content mutations", async () => {
    const repository = contentMutationsRepositoryMock();
    const app = buildApp({
      contentMutationsRepository: repository,
      privateReadsRepository: privateReadsRepositoryMock(),
      sessionsRepository: sessionsRepositoryMock({
        currentSession: vi.fn().mockResolvedValue(null),
      }),
    });
    const response = await app.inject({
      method: "POST",
      url: "/posts",
      payload: {
        body: "Hello Node.",
      },
    });

    expect(response.statusCode).toBe(401);
    expect(repository.createPost).not.toHaveBeenCalled();
    expect(response.json()).toEqual({
      ok: false,
      error: "Unauthenticated.",
    });
  });

  it("requires a PHP-compatible CSRF header for content mutations", async () => {
    const repository = contentMutationsRepositoryMock();
    const app = buildApp({
      contentMutationsRepository: repository,
      privateReadsRepository: privateReadsRepositoryMock(),
      sessionsRepository: sessionsRepositoryMock(),
    });
    const missing = await app.inject({
      method: "POST",
      url: "/profiles/thia/follow",
      payload: {},
    });
    const invalid = await app.inject({
      method: "POST",
      url: "/profiles/thia/follow",
      headers: {
        "x-csrf-token": "wrong",
      },
      payload: {},
    });

    expect(missing.statusCode).toBe(403);
    expect(missing.json()).toEqual({
      ok: false,
      error: "CSRF token is required.",
    });
    expect(invalid.statusCode).toBe(403);
    expect(invalid.json()).toEqual({
      ok: false,
      error: "Invalid CSRF token.",
    });
    expect(repository.followProfile).not.toHaveBeenCalled();
  });

  it("serves social graph mutations through PHP-style wrappers", async () => {
    const repository = contentMutationsRepositoryMock();
    const app = buildApp({
      contentMutationsRepository: repository,
      privateReadsRepository: privateReadsRepositoryMock(),
      sessionsRepository: sessionsRepositoryMock(),
    });

    for (const [method, path] of [
      ["POST", "/profiles/thia/follow"],
      ["DELETE", "/profiles/thia/follow"],
      ["POST", "/profiles/thia/block"],
      ["DELETE", "/profiles/thia/block"],
      ["POST", "/profiles/thia/mute"],
      ["DELETE", "/profiles/thia/mute"],
      ["POST", "/profiles/thia/star"],
      ["DELETE", "/profiles/thia/star"],
      ["DELETE", "/profiles/thia/follower"],
    ] as const) {
      const response = await app.inject({
        method,
        url: path,
        headers: {
          "x-csrf-token": "csrf-token",
        },
        payload: {},
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toHaveProperty("ok", true);
    }

    expect(repository.followProfile).toHaveBeenCalledWith("thia", 42);
    expect(repository.unfollowProfile).toHaveBeenCalledWith("thia", 42);
    expect(repository.blockProfile).toHaveBeenCalledWith("thia", 42);
    expect(repository.unblockProfile).toHaveBeenCalledWith("thia", 42);
    expect(repository.muteProfile).toHaveBeenCalledWith("thia", 42);
    expect(repository.unmuteProfile).toHaveBeenCalledWith("thia", 42);
    expect(repository.starProfile).toHaveBeenCalledWith("thia", 42);
    expect(repository.unstarProfile).toHaveBeenCalledWith("thia", 42);
    expect(repository.removeFollower).toHaveBeenCalledWith("thia", 42);
  });

  it("serves follow request decisions through PHP-style wrappers", async () => {
    const repository = contentMutationsRepositoryMock();
    const app = buildApp({
      contentMutationsRepository: repository,
      privateReadsRepository: privateReadsRepositoryMock(),
      sessionsRepository: sessionsRepositoryMock(),
    });
    const approve = await app.inject({
      method: "POST",
      url: "/me/follow-requests/12/approve",
      headers: {
        "x-csrf-token": "csrf-token",
      },
      payload: {},
    });
    const deny = await app.inject({
      method: "DELETE",
      url: "/me/follow-requests/12",
      headers: {
        "x-csrf-token": "csrf-token",
      },
      payload: {},
    });

    expect(approve.statusCode).toBe(200);
    expect(approve.json()).toEqual({
      ok: true,
      data: {
        approved: true,
      },
    });
    expect(deny.statusCode).toBe(200);
    expect(deny.json()).toEqual({
      ok: true,
      data: {
        denied: true,
      },
    });
    expect(repository.approveFollowRequest).toHaveBeenCalledWith(12, 42);
    expect(repository.denyFollowRequest).toHaveBeenCalledWith(12, 42);
  });

  it("serves post mutations with PHP-compatible status codes", async () => {
    const repository = contentMutationsRepositoryMock();
    const app = buildApp({
      contentMutationsRepository: repository,
      privateReadsRepository: privateReadsRepositoryMock(),
      sessionsRepository: sessionsRepositoryMock(),
    });

    for (const [method, path, expectedStatus] of [
      ["POST", "/posts", 201],
      ["POST", "/posts/99/replies", 201],
      ["PATCH", "/posts/99", 200],
      ["DELETE", "/posts/99", 200],
      ["POST", "/posts/99/like", 200],
      ["DELETE", "/posts/99/like", 200],
      ["POST", "/posts/99/reblog", 200],
      ["DELETE", "/posts/99/reblog", 200],
      ["POST", "/posts/99/reactions", 200],
      ["DELETE", "/posts/99/reactions/echo", 200],
      ["POST", "/posts/pc359fe2da759/shares/messages", 201],
    ] as const) {
      const response = await app.inject({
        method,
        url: path,
        headers: {
          "x-csrf-token": "csrf-token",
        },
        payload: method === "DELETE" ? {} : { body: "Hello Node.", type: "echo", recipientUserIds: [43] },
      });

      expect(response.statusCode).toBe(expectedStatus);
      expect(response.json()).toHaveProperty("ok", true);
    }

    expect(repository.createPost).toHaveBeenCalledWith(session, expect.objectContaining({ body: "Hello Node." }));
    expect(repository.createReply).toHaveBeenCalledWith(session, 99, expect.any(Object));
    expect(repository.updatePost).toHaveBeenCalledWith(session, 99, expect.any(Object));
    expect(repository.deletePost).toHaveBeenCalledWith(session, 99);
    expect(repository.likePost).toHaveBeenCalledWith(99, 42);
    expect(repository.unlikePost).toHaveBeenCalledWith(99, 42);
    expect(repository.reblogPost).toHaveBeenCalledWith(99, session);
    expect(repository.unreblogPost).toHaveBeenCalledWith(99, session);
    expect(repository.reactToPost).toHaveBeenCalledWith(99, 42, expect.any(Object));
    expect(repository.deletePostReaction).toHaveBeenCalledWith(99, 42, "echo");
    expect(repository.sharePostToMessages).toHaveBeenCalledWith("pc359fe2da759", 42, expect.any(Object));
  });

  it("passes post media metadata through create, reply, and update mutations", async () => {
    const repository = contentMutationsRepositoryMock();
    const app = buildApp({
      contentMutationsRepository: repository,
      privateReadsRepository: privateReadsRepositoryMock(),
      sessionsRepository: sessionsRepositoryMock(),
    });
    const videoMedia = {
      body: "Video post.",
      mediaUrl: "/uploads/media/2026/06/post_media-abcdef1234567890abcdef1234567890.mp4",
      mediaType: "video",
      mediaMime: "video/mp4",
      mediaPosterUrl: "/uploads/media/2026/06/post_media-abcdef1234567890abcdef1234567890-poster.webp",
    };
    const imageMedia = {
      body: "Image reply.",
      mediaUrl: "/uploads/media/2026/06/post_media-fedcba0987654321fedcba0987654321.webp",
      mediaType: "image",
      mediaMime: "image/webp",
      mediaPosterUrl: null,
    };

    const create = await app.inject({
      method: "POST",
      url: "/posts",
      headers: {
        "x-csrf-token": "csrf-token",
      },
      payload: videoMedia,
    });
    const reply = await app.inject({
      method: "POST",
      url: "/posts/99/replies",
      headers: {
        "x-csrf-token": "csrf-token",
      },
      payload: imageMedia,
    });
    const update = await app.inject({
      method: "PATCH",
      url: "/posts/99",
      headers: {
        "x-csrf-token": "csrf-token",
      },
      payload: videoMedia,
    });

    expect(create.statusCode).toBe(201);
    expect(reply.statusCode).toBe(201);
    expect(update.statusCode).toBe(200);
    expect(repository.createPost).toHaveBeenCalledWith(session, videoMedia);
    expect(repository.createReply).toHaveBeenCalledWith(session, 99, imageMedia);
    expect(repository.updatePost).toHaveBeenCalledWith(session, 99, videoMedia);
  });

  it("passes ordered post attachments through create, reply, and update mutations", async () => {
    const repository = contentMutationsRepositoryMock();
    const app = buildApp({
      contentMutationsRepository: repository,
      privateReadsRepository: privateReadsRepositoryMock(),
      sessionsRepository: sessionsRepositoryMock(),
    });
    const attachmentPost = {
      body: "Markdown **post** with music.",
      bodyFormat: "markdown",
      contentVersion: 3,
      attachments: [
        {
          kind: "audio",
          url: "/uploads/media/2026/06/post_media-fedcba0987654321fedcba0987654321.mp3",
          mime: "audio/mpeg",
          sizeBytes: 4096,
          durationSeconds: 33.5,
        },
        {
          kind: "integration",
          provider: "spotify",
          resourceType: "track",
          resourceId: "spotify-track",
          resourceKey: "spotify:track:spotify-track",
          sourceUrl: "https://open.spotify.com/track/spotify-track",
          card: {
            title: "Track title",
            subtitle: "Artist",
          },
        },
      ],
    };

    const create = await app.inject({
      method: "POST",
      url: "/posts",
      headers: {
        "x-csrf-token": "csrf-token",
      },
      payload: attachmentPost,
    });
    const reply = await app.inject({
      method: "POST",
      url: "/posts/99/replies",
      headers: {
        "x-csrf-token": "csrf-token",
      },
      payload: attachmentPost,
    });
    const update = await app.inject({
      method: "PATCH",
      url: "/posts/99",
      headers: {
        "x-csrf-token": "csrf-token",
      },
      payload: attachmentPost,
    });

    expect(create.statusCode).toBe(201);
    expect(reply.statusCode).toBe(201);
    expect(update.statusCode).toBe(200);
    expect(repository.createPost).toHaveBeenCalledWith(session, attachmentPost);
    expect(repository.createReply).toHaveBeenCalledWith(session, 99, attachmentPost);
    expect(repository.updatePost).toHaveBeenCalledWith(session, 99, attachmentPost);
  });

  it("serves MP3 uploads as authenticated post media", async () => {
    const uploadService = uploadServiceMock({
      store: vi.fn().mockResolvedValue({
        url: "/uploads/media/2026/06/post_media-audio.mp3",
        mime: "audio/mpeg",
        type: "audio/mpeg",
        size: 8,
        purpose: "post_media",
        mediaType: "audio",
      }),
    });
    const app = buildApp({
      privateReadsRepository: privateReadsRepositoryMock(),
      sessionsRepository: sessionsRepositoryMock(),
      uploadService,
    });
    const multipart = multipartPayload(
      { purpose: "post_media" },
      { filename: "post.mp3", contentType: "audio/mpeg", body: Buffer.from([0xff, 0xfb, 0x90, 0x64]) },
    );
    const response = await app.inject({
      method: "POST",
      url: "/uploads/audio",
      headers: {
        "content-type": multipart.contentType,
        cookie: "thia_session=token",
        "x-csrf-token": "csrf-token",
      },
      payload: multipart.body,
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toEqual({
      ok: true,
      data: {
        url: "/uploads/media/2026/06/post_media-audio.mp3",
        mime: "audio/mpeg",
        type: "audio/mpeg",
        size: 8,
        purpose: "post_media",
        mediaType: "audio",
      },
    });
    expect(uploadService.store).toHaveBeenCalledWith("audio", expect.any(Object));
  });

  it("serves image preview conversion as an authenticated WebP blob", async () => {
    const uploadService = uploadServiceMock();
    const app = buildApp({
      privateReadsRepository: privateReadsRepositoryMock(),
      sessionsRepository: sessionsRepositoryMock(),
      uploadService,
    });
    const multipart = multipartPayload(
      { purpose: "post_media" },
      { filename: "crop-source.tiff", contentType: "image/tiff", body: Buffer.from("TIFF") },
    );
    const unauthenticated = await buildApp({
      privateReadsRepository: privateReadsRepositoryMock(),
      sessionsRepository: sessionsRepositoryMock({ currentSession: vi.fn().mockResolvedValue(null) }),
      uploadService,
    }).inject({
      method: "POST",
      url: "/uploads/image?preview=1",
      headers: {
        "content-type": multipart.contentType,
      },
      payload: multipart.body,
    });
    const missingCsrf = await app.inject({
      method: "POST",
      url: "/uploads/image?preview=1",
      headers: {
        "content-type": multipart.contentType,
        cookie: "thia_session=token",
      },
      payload: multipart.body,
    });
    const converted = await app.inject({
      method: "POST",
      url: "/uploads/image?preview=1",
      headers: {
        "content-type": multipart.contentType,
        cookie: "thia_session=token",
        "x-csrf-token": "csrf-token",
      },
      payload: multipart.body,
    });

    expect(unauthenticated.statusCode).toBe(401);
    expect(missingCsrf.statusCode).toBe(403);
    expect(converted.statusCode).toBe(200);
    expect(converted.headers["content-type"]).toContain("image/webp");
    expect(converted.headers["cache-control"]).toBe("no-store");
    expect(converted.body).toBe("WEBP");
    expect(uploadService.previewImage).toHaveBeenCalledOnce();
  });

  it("serves room mutations through PHP-style wrappers", async () => {
    const repository = contentMutationsRepositoryMock();
    const app = buildApp({
      contentMutationsRepository: repository,
      privateReadsRepository: privateReadsRepositoryMock(),
      sessionsRepository: sessionsRepositoryMock(),
    });

    for (const [method, path, expectedStatus] of [
      ["POST", "/rooms", 201],
      ["PATCH", "/rooms/general", 200],
      ["DELETE", "/rooms/general", 200],
      ["POST", "/rooms/general/join", 200],
      ["DELETE", "/rooms/general/join", 200],
      ["POST", "/rooms/general/moderators", 200],
      ["DELETE", "/rooms/general/moderators", 200],
    ] as const) {
      const response = await app.inject({
        method,
        url: path,
        headers: {
          "x-csrf-token": "csrf-token",
        },
        payload: {
          name: "General",
          summary: "General public discussion.",
          handle: "friend",
        },
      });

      expect(response.statusCode).toBe(expectedStatus);
      expect(response.json()).toHaveProperty("ok", true);
    }

    expect(repository.createRoom).toHaveBeenCalled();
    expect(repository.updateRoom).toHaveBeenCalledWith(session, "general", expect.any(Object));
    expect(repository.deleteRoom).toHaveBeenCalledWith(session, "general");
    expect(repository.joinRoom).toHaveBeenCalledWith(session, "general");
    expect(repository.leaveRoom).toHaveBeenCalledWith(session, "general");
    expect(repository.addRoomModerator).toHaveBeenCalledWith(session, "general", expect.any(Object));
    expect(repository.removeRoomModerator).toHaveBeenCalledWith(session, "general", expect.any(Object));
  });

  it("maps content validation and storage errors to PHP-compatible JSON", async () => {
    const repository = contentMutationsRepositoryMock({
      createPost: vi.fn().mockRejectedValue(new ContentRouteError("Post body is required.", 422)),
      createRoom: vi
        .fn()
        .mockRejectedValue(new ContentStorageNotReadyError("Room membership storage is not ready. Run pending migrations.")),
    });
    const app = buildApp({
      contentMutationsRepository: repository,
      privateReadsRepository: privateReadsRepositoryMock(),
      sessionsRepository: sessionsRepositoryMock(),
    });
    const invalid = await app.inject({
      method: "POST",
      url: "/posts",
      headers: {
        "x-csrf-token": "csrf-token",
      },
      payload: {},
    });
    const storage = await app.inject({
      method: "POST",
      url: "/rooms",
      headers: {
        "x-csrf-token": "csrf-token",
      },
      payload: {},
    });

    expect(invalid.statusCode).toBe(422);
    expect(invalid.json()).toEqual({
      ok: false,
      error: "Post body is required.",
    });
    expect(storage.statusCode).toBe(503);
    expect(storage.json()).toEqual({
      ok: false,
      error: "Room membership storage is not ready. Run pending migrations.",
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

  it("serves public room share cards", async () => {
    const service = shareCardServiceMock();
    const app = buildApp({
      shareCardService: service,
    });
    const response = await app.inject({
      method: "GET",
      url: "/rooms/general/share-card.png",
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toContain("image/png");
    expect(response.body).toBe("ROOM");
    expect(service.roomCard).toHaveBeenCalledWith("general");
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
    expect(repository.search).toHaveBeenCalledWith("thia", null, null);
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
    expect(searchRepository.search).toHaveBeenCalledWith("thia", 42, "member");
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
    expect(repository.search).toHaveBeenCalledWith("", null, null);
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
    expect(repository.listRoomPosts).toHaveBeenCalledWith("general", null, null);
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

  it("passes viewer context into discover rooms when a session exists", async () => {
    const postsRepository = postsRepositoryMock();
    const roomsRepository = roomsRepositoryMock();
    const sessionsRepository = sessionsRepositoryMock();
    const app = buildApp({
      postsRepository,
      roomsRepository,
      sessionsRepository,
    });
    const response = await app.inject({
      method: "GET",
      url: "/feed/discover",
      headers: {
        cookie: "thia_session=token",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(postsRepository.listDiscoverPosts).toHaveBeenCalledWith(42);
    expect(postsRepository.listPeopleToWatch).toHaveBeenCalledWith(42);
    expect(roomsRepository.listPublicRooms).toHaveBeenCalledWith({
      role: "member",
      userId: 42,
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
