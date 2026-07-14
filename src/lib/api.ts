import type {
  BadgeDefinition,
  DiscoverFeed,
  DiscoverPerson,
  ChatConversation,
  ChatMessage,
  ChatMessagesResult,
  ChatMoot,
  GifSearchResponse,
  HomeFeed,
  NotificationItem,
  NotificationsResult,
  Post,
  PostAttachment,
  PostShareSummary,
  Profile,
  ProfileBadgesResult,
  ProfileConnection,
  ProfileExternalConnection,
  ProfileBackgroundBlur,
  ProfileIntegrationCard,
  ProfileCanvasMovementContext,
  ProfileLayoutPreset,
  ProfileThemeConfig,
  ProfileModule,
  ProfileModuleConfig,
  ProfileModuleLayout,
  ProfileModuleMediaItem,
  ProfileModulePlaylistTrack,
  ProfileModuleStatus,
  ProfileModuleType,
  ProfileModuleUploadedAudio,
  ProfileModuleUploadedVideo,
  ProfileModuleVisibility,
  PublicStats,
  AdminGrowthMetrics,
  RichLinkCard,
  RichTextEntity,
  Room,
  RoomAccessRequest,
  RoomChannel,
  RoomChannelMessagesResult,
  RoomMember,
  RoomVisibility,
  SearchResults,
  User,
  UserBadge,
} from "./types";
import { apiDelete, apiGet, apiPatch, apiPost, apiUpload, apiUploadBlob } from "./apiClient";
import { formatRelativeTime } from "./dates";
import { normalizeProfileLayoutPreset } from "./profileLayoutPresets";
import { normalizeProfileConnection } from "./profileConnections";
import { normalizeProfileThemeConfig } from "./profileThemes";
import {
  PROFILE_CANVAS_DESKTOP_COLUMNS,
  PROFILE_CANVAS_DESKTOP_ROWS,
  PROFILE_CANVAS_VERSION,
  isProfileModuleType,
  profileGridModuleSizeSpan,
  profileModuleAllowedSizes,
} from "./profileModuleRegistry";

type ApiRoom = Omit<Room, "theme" | "themeConfig" | "rulesVersion" | "viewerCanJoin"> & {
  description?: string;
  visibility?: string;
  memberCount?: number;
  createdBy?: number | null;
  iconUrl?: string | null;
  bannerUrl?: string | null;
  rules?: string;
  rulesVersion?: number;
  theme?: string | null;
  themeConfig?: unknown;
  joinedByMe?: boolean;
  myRoomRole?: Room["myRoomRole"];
  viewerCanViewPosts?: boolean;
  viewerCanPost?: boolean;
  viewerCanReact?: boolean;
  viewerCanJoin?: boolean;
  viewerCanRequestAccess?: boolean;
  accessRequestStatus?: Room["accessRequestStatus"];
  pendingAccessRequestCount?: number | undefined;
  postCount?: number;
  latestActivityAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

type ApiProfile = Omit<
  Profile,
  | "featuredPost"
  | "featuredRoom"
  | "profileBackgroundBlur"
  | "profileLayoutPreset"
  | "profileCanvasVersion"
  | "profileCanvasGlass"
  | "profileThemeConfig"
> & {
  avatarUrl?: string | null;
  createdAt?: string;
  updatedAt?: string;
  featuredPostId?: number | null;
  featuredRoomId?: number | null;
  featuredPost?: ApiPost | null;
  featuredRoom?: ApiRoom | null;
  profileBackgroundVideo?: string | null;
  profileBackgroundVideoPoster?: string | null;
  profileBackgroundBlur?: string | null;
  profileLayoutPreset?: string | null;
  profileCanvasVersion?: number | string | null;
  profileCanvasGlass?: number | string | null;
  profileThemeConfig?: unknown;
  links?: unknown[];
  isBlocked?: boolean;
  isMuted?: boolean;
};

type ApiBadgeDefinition = BadgeDefinition;

type ApiUserBadge = UserBadge;

type ApiProfileBadgesResult = ProfileBadgesResult;

type ApiProfileModule = ProfileModule;

type ApiAdminBadgesResult = {
  badges: ApiBadgeDefinition[];
  recentGrants: ApiUserBadge[];
};

type ApiPost = Omit<Post, "room" | "createdAt"> & {
  createdAt: string;
  updatedAt?: string;
  profile?: ApiProfile;
  room: ApiRoom | null;
  parentId?: number | null;
  deletedAt?: string | null;
  visibility?: string;
  status?: string;
  canonicalPath?: string;
  canonicalUrl?: string;
};

type ApiPostShareSummary = Omit<PostShareSummary, "room"> & {
  room?: ApiRoom | null;
};

type ApiHomeFeed = {
  posts: ApiPost[];
  personalized: boolean;
};

type ApiDiscoverFeed = {
  posts: ApiPost[];
  activeRooms: ApiRoom[];
  peopleToWatch: DiscoverPerson[];
};

type ApiSearchResults = Omit<SearchResults, "results"> & {
  results: {
    profiles: SearchResults["results"]["profiles"];
    rooms: ApiRoom[];
  };
};

export type CreatePostInput = {
  body: string;
  bodyFormat?: "plain" | "markdown";
  contentVersion?: number;
  roomSlug?: string;
  parentId?: number;
  attachments?: PostAttachmentInput[];
  mediaUrl?: string | null;
  mediaType?: "image" | "video" | null;
  mediaMime?: string | null;
  mediaPosterUrl?: string | null;
};

export type UpdatePostInput = {
  body?: string;
  bodyFormat?: "plain" | "markdown";
  contentVersion?: number;
  roomSlug?: string;
  parentId?: number | null;
  attachments?: PostAttachmentInput[];
  mediaUrl?: string | null;
  mediaType?: "image" | "video" | null;
  mediaMime?: string | null;
  mediaPosterUrl?: string | null;
  status?: "published" | "hidden" | "removed";
};

export type PostAttachmentInput = Pick<
  PostAttachment,
  | "kind"
  | "url"
  | "mime"
  | "sizeBytes"
  | "width"
  | "height"
  | "durationSeconds"
  | "posterUrl"
  | "provider"
  | "resourceType"
  | "resourceId"
  | "resourceKey"
  | "sourceUrl"
  | "card"
>;

export type SharePostToMessagesInput = {
  recipientUserIds: number[];
  note?: string;
};

export type ChatMessageAttachmentInput = {
  type: "gif";
  provider: "klipy";
  resourceType: "gif";
  resourceId: string;
  resourceKey: string;
  url: string;
  mime: "image/gif";
  width?: number | null;
  height?: number | null;
  sourceUrl?: string | null;
  card?: Record<string, unknown> | unknown[] | null;
};

export type SharePostToMessagesResult = {
  post: PostShareSummary;
  results: Array<
    | {
        recipientUserId: number;
        recipient?: User;
        status: "sent";
        conversationId: number;
        messageId: number;
      }
    | {
        recipientUserId: number;
        status: "failed";
        error: string;
      }
  >;
  sentCount: number;
  failedCount: number;
};

export type ImageUploadPurpose =
  | "avatar"
  | "banner"
  | "profile_background"
  | "post_media"
  | "room_icon"
  | "room_banner";

export type VideoUploadPurpose = "profile_background" | "profile_module_video" | "post_media";

export type AudioUploadPurpose = "profile_music" | "post_media";
export type UploadedImageMime =
  | "image/jpeg"
  | "image/png"
  | "image/webp"
  | "image/gif";

export type UploadedImage = {
  url: string;
  width: number;
  height: number;
  mime: UploadedImageMime;
  type: UploadedImageMime;
  size: number;
  purpose: ImageUploadPurpose;
};

export type UploadedVideo = {
  url: string;
  mime: "video/mp4" | "video/webm";
  type: "video/mp4" | "video/webm";
  size: number;
  purpose: VideoUploadPurpose;
  posterUrl?: string;
  width?: number;
  height?: number;
  duration?: number;
};

export type UploadedAudio = {
  url: string;
  mime: "audio/mpeg";
  type: "audio/mpeg";
  size: number;
  purpose: AudioUploadPurpose;
  duration?: number;
};

export type UpdateProfileInput = {
  displayName?: string;
  bio?: string | null;
  location?: string | null;
  avatarUrl?: string | null;
  bannerUrl?: string | null;
  profileBackground?: string | null;
  profileBackgroundVideo?: string | null;
  profileBackgroundVideoPoster?: string | null;
  profileAccent?: string | null;
  profileTheme?: string | null;
  profileThemeConfig?: ProfileThemeConfig | null;
  profileLayoutPreset?: ProfileLayoutPreset;
  links?: ProfileExternalConnection[];
  traits?: string[];
};

export type UpdateProfileCanvasModuleInput = ProfileModuleLayout & {
  id: number;
  pinned?: boolean;
  visible: boolean;
};

export type UpdateProfileCanvasInput = {
  canvasVersion: typeof PROFILE_CANVAS_VERSION;
  anchorModuleId?: number | null;
  backgroundBlur?: ProfileBackgroundBlur;
  modules?: UpdateProfileCanvasModuleInput[];
  movementContext?: ProfileCanvasMovementContext | null;
};

export type UpdateProfileCanvasResult = {
  backgroundBlur: ProfileBackgroundBlur;
  canvasGlass: number;
  canvasVersion: typeof PROFILE_CANVAS_VERSION;
  modules: ProfileModule[];
};

export type ProfileCanvasDraftModule = ProfileModule & {
  draftId?: string;
};

export type ProfileCanvasDraftState = {
  backgroundBlur: ProfileBackgroundBlur;
  canvasGlass: number;
  canvasVersion: typeof PROFILE_CANVAS_VERSION;
  modules: ProfileCanvasDraftModule[];
  revision: string | null;
  selectedModuleId?: number | string | null;
  updatedAt?: string | null;
};

export type UpdateProfileCanvasDraftInput = Partial<
  Pick<ProfileCanvasDraftState, "backgroundBlur" | "canvasGlass" | "modules" | "selectedModuleId">
> & {
  canvasVersion: typeof PROFILE_CANVAS_VERSION;
  expectedRevision: string | null;
};

export type CreateProfileModuleInput = {
  type: ProfileModuleType;
  title?: string | null;
  config: ProfileModuleConfig;
  visibility?: ProfileModuleVisibility;
  status?: Exclude<ProfileModuleStatus, "deleted">;
};

export type UpdateProfileModuleInput = {
  title?: string | null;
  config?: ProfileModuleConfig;
  visibility?: ProfileModuleVisibility;
  status?: ProfileModuleStatus;
};

export type ProfileIntegrationProvider =
  | "spotify"
  | "apple_music"
  | "youtube"
  | "twitch"
  | "github";

export type ProfileIntegrationProviderStatus = {
  provider: ProfileIntegrationProvider;
  configured: boolean;
  oauthEnabled: boolean;
  linkSupported?: boolean;
  metadataEnabled?: boolean;
  missingConfigKeys?: string[];
};

export type ProfileIntegrationAccount = {
  provider: ProfileIntegrationProvider;
  providerAccountId: string;
  providerHandle?: string | null;
  displayName?: string | null;
  avatarUrl?: string | null;
  scopes: string[];
  tokenExpiresAt?: string | null;
  connectedAt?: string | null;
  refreshedAt?: string | null;
  revokedAt?: string | null;
  lastError?: string | null;
  errorAt?: string | null;
};

export type ProfileIntegrationsResult = {
  providers: ProfileIntegrationProviderStatus[];
  accounts: ProfileIntegrationAccount[];
};

export type ProfileIntegrationDiagnosticsProvider =
  ProfileIntegrationProviderStatus & {
    redirectUri?: string | null;
  };

export type ProfileIntegrationDiagnostics = {
  storageReady: boolean;
  encryptionConfigured: boolean;
  encryptionAvailable: boolean;
  cryptoMethod?: string | null;
  oauthStateExpiresIn: number;
  providers: ProfileIntegrationDiagnosticsProvider[];
};

export type ProfileIntegrationSuggestion = {
  id: string;
  label: string;
  description: string;
  sourceUrl: string;
  moduleType: ProfileModuleType;
  moduleTitle?: string | null;
  card?: ProfileIntegrationCard | null;
};

export type ProfileIntegrationSuggestionsResult = {
  provider: ProfileIntegrationProvider;
  status: ProfileIntegrationProviderStatus;
  account?: ProfileIntegrationAccount | null;
  items: ProfileIntegrationSuggestion[];
  message?: string | null;
  generatedAt?: string | null;
};

export type StartProfileIntegrationResult = {
  provider: ProfileIntegrationProvider;
  authorizationUrl: string;
  stateExpiresIn: number;
};

export type OnboardingStep =
  | "profile_basics"
  | "spotify"
  | "youtube"
  | "twitch"
  | "github"
  | "apple_music"
  | "profile_canvas"
  | "desktop_notifications";

export type OnboardingProviderLink = {
  provider: ProfileIntegrationProvider;
  url: string;
  resourceType: string;
  resourceId: string;
  savedAt?: string | null;
};

export type OnboardingState = {
  steps: OnboardingStep[];
  completedSteps: OnboardingStep[];
  skippedSteps: OnboardingStep[];
  providerLinks: Partial<Record<ProfileIntegrationProvider, OnboardingProviderLink>>;
  finishedAt?: string | null;
  dismissedAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type UpdateOnboardingInput =
  | { action: "complete_step" | "skip_step"; step: OnboardingStep }
  | { action: "save_provider_link"; provider: ProfileIntegrationProvider; url: string }
  | { action: "finish" | "dismiss" | "reset" };

export type RoomInput = {
  name: string;
  slug?: string;
  summary: string;
  mood?: string | null;
  theme?: string | null;
  themeConfig?: ProfileThemeConfig | null;
  iconUrl?: string | null;
  bannerUrl?: string | null;
  rules?: string | null;
  visibility?: RoomVisibility;
};

export type UpdateFeaturedBadgesInput = {
  featuredBadgeIds: number[];
};

export type UpdateProfileFeaturedInput = {
  featuredPostId?: number | null;
  featuredRoomId?: number | null;
};

export type AdminBadgesResult = {
  badges: BadgeDefinition[];
  recentGrants: UserBadge[];
};

export type GrantBadgeInput = {
  handle: string;
  badgeKey: string;
  reason?: string;
};

export type DeletePostResult = {
  id: number;
  status: "removed";
  deletedAt: string;
};

export type DeleteRoomResult = {
  slug: string;
  deletedAt: string;
};

export type LikeResult = {
  postId: number;
  likeCount: number;
  likedByCurrentUser: boolean;
};

export type ReblogResult = {
  postId: number;
  reblogCount: number;
  rebloggedByMe: boolean;
  rebloggedByCurrentUser?: boolean;
};

export type NotificationsReadResult = {
  ids?: number[];
  readAt: string;
  unreadCount: number;
};

export type ChatReadResult = {
  conversationId: number;
  readAt: string;
};

type ApiFollowRelationship = FollowRelationship & {
  isBlocked?: boolean;
  isMuted?: boolean;
};

type ApiProfileControlResult = Omit<ProfileControlResult, "relationship"> & {
  isBlocked?: boolean;
  isMuted?: boolean;
  relationship: ApiFollowRelationship;
};

type ApiRemoveFollowerResult = Omit<RemoveFollowerResult, "relationship"> & {
  relationship: ApiFollowRelationship;
};

type ApiProfileStarResult = Omit<ProfileStarResult, "relationship"> & {
  relationship: ApiFollowRelationship;
};

export type FollowRelationship = {
  isFollowing: boolean;
  isFollowedBy: boolean;
  isMoot: boolean;
  isStarred: boolean;
  isFollowRequestPending?: boolean;
  blockedByMe?: boolean;
  mutedByMe?: boolean;
  followerCount: number;
  followingCount: number;
  mootCount?: number;
  starCount: number;
};

export type ProfileControlResult = {
  isBlocked: boolean;
  isMuted: boolean;
  relationship: FollowRelationship;
};

export type RemoveFollowerResult = {
  removedFollower: boolean;
  relationship: FollowRelationship;
};

export type ProfileStarResult = {
  isStarred: boolean;
  starCount: number;
  relationship: FollowRelationship;
  stats?: {
    followers?: number;
    following?: number;
    moots?: number;
    stars?: number;
  };
};

export type AccountSettings = {
  account: {
    id: number;
    handle: string;
    email: string;
    displayName: string;
    status: string;
    handleChange: {
      canChange: boolean;
      nextAllowedAt: string | null;
    };
  };
  privacy: {
    profileVisibility: "public" | "private";
  };
  preferences: AccountPreferences;
  twoFactor: TwoFactorStatus;
  deletion: {
    requestedAt: string | null;
    scheduledFor: string | null;
    canceledAt: string | null;
    completedAt: string | null;
  } | null;
};

export type AccountDataExport = {
  schemaVersion: 1;
  generatedAt: string;
  account: Record<string, unknown> | null;
  profile: {
    details: Record<string, unknown> | null;
    modules: Record<string, unknown>[];
    canvasDraft: Record<string, unknown> | null;
    badges: Record<string, unknown>[];
  };
  preferences: {
    settings: Record<string, unknown> | null;
    onboarding: Record<string, unknown> | null;
  };
  deletion: Record<string, unknown> | null;
  content: {
    postsAndReplies: Record<string, unknown>[];
    attachments: Record<string, unknown>[];
    reactions: Record<string, unknown>[];
    reblogs: Record<string, unknown>[];
  };
  media: {
    profileMedia: Record<string, unknown> | null;
    postMedia: Record<string, unknown>[];
    attachments: Record<string, unknown>[];
  };
  rooms: {
    created: Record<string, unknown>[];
    memberships: Record<string, unknown>[];
  };
  relationships: {
    following: Record<string, unknown>[];
    followers: Record<string, unknown>[];
    blocks: Record<string, unknown>[];
    mutes: Record<string, unknown>[];
    stars: Record<string, unknown>[];
    followRequestsSent: Record<string, unknown>[];
    followRequestsReceived: Record<string, unknown>[];
  };
  messages: {
    sentMessages: Record<string, unknown>[];
  };
  moderation: {
    submittedReports: Record<string, unknown>[];
    accountReportStatuses: Record<string, unknown>[];
  };
  integrations: {
    accounts: Record<string, unknown>[];
  };
  purchases: {
    purchases: never[];
    note: string;
  };
  limits: {
    perSection: number;
    note: string;
  };
};

export type AccountPreferences = {
  analyticsConsent: boolean;
  personalizationConsent: boolean;
  richEmbedsConsent: boolean;
  autoplayMediaConsent: boolean;
  sensitiveContentVisible: boolean;
  notifications: Record<string, boolean>;
  emailNotifications: Record<string, boolean>;
  pushNotifications: Record<string, boolean>;
};

export type PushSubscriptionSummary = {
  id: number;
  endpointHash: string;
  userAgent?: string | null;
  lastSuccessAt?: string | null;
  lastErrorAt?: string | null;
  lastError?: string | null;
  failureCount: number;
  disabledAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type PushNotificationStatus = {
  supported: boolean;
  configured: boolean;
  storageReady: boolean;
  publicKey: string | null;
  subject: string;
  enabled: boolean;
  subscriptionCount: number;
  subscriptions: PushSubscriptionSummary[];
  diagnostics: {
    missingConfigKeys: string[];
    curlAvailable: boolean;
    opensslAvailable: boolean;
  };
  lastSend?: {
    attempted: number;
    sent: number;
    failed: number;
    disabled: number;
  };
};

export type PushSubscriptionInput = {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  userAgent?: string;
};

export type TwoFactorStatus = {
  enabled: boolean;
  backupCodeCount: number;
  encryptionConfigured: boolean;
  encryptionAvailable: boolean;
};

export type TwoFactorSetupResult = {
  setup: {
    manualSecret: string;
    otpauthUri: string;
  };
  twoFactor: TwoFactorStatus;
};

export type TwoFactorEnableResult = {
  twoFactor: TwoFactorStatus;
  backupCodes: string[];
};

export type FollowRequest = {
  id: number;
  createdAt: string;
  user: User;
  bioSnippet: string;
};

export type AccountPostSummary = {
  id: number;
  publicId?: string | null;
  kind: "post" | "reply";
  body: string;
  mediaUrl?: string | null;
  status: string;
  deletedAt?: string | null;
  createdAt?: string | null;
};

export type TwoFactorChallenge = {
  twoFactorRequired: true;
  challengeId: string;
  expiresAt: string;
};

export type ReportTargetType = "post" | "profile" | "room" | "message";

export type ReportCategory =
  | "harassment"
  | "hate"
  | "sexual_content"
  | "non_consensual_content"
  | "private_info"
  | "spam_or_scam"
  | "impersonation"
  | "copyright"
  | "violence_or_threats"
  | "self_harm"
  | "illegal_content"
  | "other";

export type ModerationReportStatus =
  | "open"
  | "reviewed"
  | "dismissed"
  | "actioned";

export type ModerationUser = {
  id: number;
  handle: string;
  displayName: string;
  role: string;
  status: string;
};

export type ModerationPost = {
  id: number;
  body: string;
  status: string;
  visibility: string;
  createdAt: string;
  author: ModerationUser | null;
};

export type ModerationRoom = {
  id: number;
  slug: string;
  name: string;
  summary: string;
  visibility: string;
  live: boolean;
  owner: ModerationUser | null;
};

export type ModerationMessage = {
  id: number;
  conversationId: number;
  body: string;
  deletedAt: string | null;
  createdAt: string;
  sender: ModerationUser | null;
};

export type ModerationReport = {
  id: number;
  targetType: ReportTargetType;
  targetId: number | null;
  category: ReportCategory;
  reason: ReportCategory;
  details: string | null;
  status: ModerationReportStatus;
  createdAt: string;
  updatedAt: string;
  reviewedAt: string | null;
  actionTaken: string | null;
  moderatorNote: string | null;
  reporter: ModerationUser | null;
  reportedUser: ModerationUser | null;
  reviewedBy: ModerationUser | null;
  post: ModerationPost | null;
  profile: ModerationUser | null;
  room: ModerationRoom | null;
  message: ModerationMessage | null;
  actionCount: number;
};

export type CreateReportInput = {
  targetType: ReportTargetType;
  targetId: number;
  category: ReportCategory;
  details?: string;
  postId?: number;
  reportedUserId?: number;
};

export type AdminActionInput = {
  reportId?: number;
  notes?: string;
};

export function getHomeFeed(): Promise<HomeFeed> {
  return apiGet<ApiHomeFeed>("/feed/home").then((feed) => ({
    posts: feed.posts.filter(isVisiblePost).map(normalizePost),
    personalized: feed.personalized,
  }));
}

export function getDiscoverFeed(): Promise<DiscoverFeed> {
  return apiGet<ApiDiscoverFeed>("/feed/discover").then((feed) => ({
    posts: feed.posts.filter(isVisiblePost).map(normalizePost),
    activeRooms: feed.activeRooms.filter(isVisibleRoom).map(normalizeRoom),
    peopleToWatch: feed.peopleToWatch.map(normalizeDiscoverPerson),
  }));
}

export function getRooms(): Promise<Room[]> {
  return apiGet<ApiRoom[]>("/rooms").then((items) =>
    items.filter(isVisibleRoom).map(normalizeRoom),
  );
}

export function getStats(): Promise<PublicStats> {
  return apiGet<PublicStats>("/stats");
}

export function getAdminGrowthMetrics(): Promise<AdminGrowthMetrics> {
  return apiGet<AdminGrowthMetrics>("/admin/growth");
}

export function getSearchResults(query: string): Promise<SearchResults> {
  const params = new URLSearchParams({ q: query.trim() });

  return apiGet<ApiSearchResults>(`/search?${params.toString()}`).then((result) => ({
    query: result.query,
    minQueryLength: result.minQueryLength,
    results: {
      profiles: result.results.profiles,
      rooms: result.results.rooms.filter(isVisibleRoom).map(normalizeRoom),
    },
  }));
}

export function getRoom(idOrSlug: string): Promise<Room | undefined> {
  return apiGet<ApiRoom>(`/rooms/${encodeURIComponent(idOrSlug)}`).then(normalizeRoom);
}

export function getRoomPosts(slug: string): Promise<Post[]> {
  return apiGet<ApiPost[]>(`/rooms/${encodeURIComponent(slug)}/posts`).then((items) =>
    items.filter(isVisiblePost).map(normalizePost),
  );
}

export function createRoom(input: RoomInput, csrfToken: string): Promise<Room> {
  return apiPost<ApiRoom>("/rooms", roomInputBody(input), csrfToken).then(normalizeRoom);
}

export function updateRoom(
  slug: string,
  input: Partial<RoomInput>,
  csrfToken: string,
): Promise<Room> {
  return apiPatch<ApiRoom>(
    `/rooms/${encodeURIComponent(slug)}`,
    roomInputBody(input),
    csrfToken,
  ).then(normalizeRoom);
}

export function joinRoom(slug: string, csrfToken: string, acceptedRulesVersion: number): Promise<Room> {
  return apiPost<ApiRoom>(
    `/rooms/${encodeURIComponent(slug)}/join`,
    { acceptedRules: true, acceptedRulesVersion },
    csrfToken,
  ).then(normalizeRoom);
}

export function leaveRoom(slug: string, csrfToken: string): Promise<Room> {
  return apiDelete<ApiRoom>(
    `/rooms/${encodeURIComponent(slug)}/join`,
    csrfToken,
  ).then(normalizeRoom);
}

export function requestRoomAccess(slug: string, csrfToken: string, acceptedRulesVersion: number): Promise<Room> {
  return apiPost<ApiRoom>(
    `/rooms/${encodeURIComponent(slug)}/access-requests`,
    { acceptedRules: true, acceptedRulesVersion },
    csrfToken,
  ).then(normalizeRoom);
}

export function cancelRoomAccessRequest(slug: string, csrfToken: string): Promise<Room> {
  return apiDelete<ApiRoom>(
    `/rooms/${encodeURIComponent(slug)}/access-requests/me`,
    csrfToken,
  ).then(normalizeRoom);
}

export function getRoomAccessRequests(slug: string): Promise<RoomAccessRequest[]> {
  return apiGet<RoomAccessRequest[]>(`/rooms/${encodeURIComponent(slug)}/access-requests`);
}

export function approveRoomAccessRequest(
  slug: string,
  requestId: number,
  csrfToken: string,
): Promise<RoomAccessRequest[]> {
  return apiPost<RoomAccessRequest[]>(
    `/rooms/${encodeURIComponent(slug)}/access-requests/${requestId}/approve`,
    {},
    csrfToken,
  );
}

export function denyRoomAccessRequest(
  slug: string,
  requestId: number,
  csrfToken: string,
): Promise<RoomAccessRequest[]> {
  return apiPost<RoomAccessRequest[]>(
    `/rooms/${encodeURIComponent(slug)}/access-requests/${requestId}/deny`,
    {},
    csrfToken,
  );
}

export function getRoomMembers(slug: string): Promise<RoomMember[]> {
  return apiGet<RoomMember[]>(`/rooms/${encodeURIComponent(slug)}/members`);
}

export function getRoomChannels(slug: string): Promise<RoomChannel[]> {
  return apiGet<RoomChannel[]>(`/rooms/${encodeURIComponent(slug)}/channels`);
}

export function createRoomChannel(
  slug: string,
  input: {
    name: string;
    slug?: string;
    description?: string | null;
    kind?: "chat" | "announcement";
    readOnly?: boolean;
  },
  csrfToken: string,
): Promise<RoomChannel> {
  return apiPost<RoomChannel>(
    `/rooms/${encodeURIComponent(slug)}/channels`,
    input,
    csrfToken,
  );
}

export function updateRoomChannel(
  roomSlug: string,
  channelSlug: string,
  input: Partial<Pick<RoomChannel, "name" | "description" | "position" | "kind" | "readOnly">> & {
    slug?: string;
    archived?: boolean;
  },
  csrfToken: string,
): Promise<RoomChannel> {
  return apiPatch<RoomChannel>(
    `/rooms/${encodeURIComponent(roomSlug)}/channels/${encodeURIComponent(channelSlug)}`,
    input,
    csrfToken,
  );
}

export function addRoomMember(
  slug: string,
  handle: string,
  csrfToken: string,
): Promise<RoomMember[]> {
  return apiPost<RoomMember[]>(
    `/rooms/${encodeURIComponent(slug)}/members`,
    { handle },
    csrfToken,
  );
}

export function removeRoomMember(
  slug: string,
  handle: string,
  csrfToken: string,
): Promise<RoomMember[]> {
  return apiDelete<RoomMember[]>(
    `/rooms/${encodeURIComponent(slug)}/members`,
    csrfToken,
    { handle },
  );
}

export function addRoomModerator(
  slug: string,
  handle: string,
  csrfToken: string,
): Promise<RoomMember[]> {
  return apiPost<RoomMember[]>(
    `/rooms/${encodeURIComponent(slug)}/moderators`,
    { handle: normalizeHandle(handle) },
    csrfToken,
  );
}

export function removeRoomModerator(
  slug: string,
  handle: string,
  csrfToken: string,
): Promise<RoomMember[]> {
  return apiDelete<RoomMember[]>(
    `/rooms/${encodeURIComponent(slug)}/moderators`,
    csrfToken,
    { handle: normalizeHandle(handle) },
  );
}

export function deleteRoom(
  slug: string,
  csrfToken: string,
): Promise<DeleteRoomResult> {
  return apiDelete<DeleteRoomResult>(`/rooms/${encodeURIComponent(slug)}`, csrfToken);
}

export function getProfile(handle: string): Promise<Profile> {
  const normalized = handle.replace(/^@/, "").toLowerCase();

  return apiGet<ApiProfile>(`/profiles/${encodeURIComponent(normalized)}`).then(
    normalizeProfile,
  );
}

export function getProfileModules(handle: string): Promise<ProfileModule[]> {
  const normalized = normalizeHandle(handle);

  return apiGet<ApiProfileModule[]>(
    `/profiles/${encodeURIComponent(normalized)}/modules`,
  ).then((items) =>
    items.filter(isApiProfileModule).map(normalizeProfileModule),
  );
}

export function getMyProfileModules(options: { includeDeleted?: boolean } = {}): Promise<ProfileModule[]> {
  const query = options.includeDeleted ? "?includeDeleted=1" : "";

  return apiGet<ApiProfileModule[]>(`/me/profile/modules${query}`).then((items) =>
    items.filter(isApiProfileModule).map(normalizeProfileModule),
  );
}

export function createProfileModule(
  input: CreateProfileModuleInput,
  csrfToken: string,
): Promise<ProfileModule[]> {
  return apiPost<ApiProfileModule[]>("/me/profile/modules", input, csrfToken).then(
    (items) => items.filter(isApiProfileModule).map(normalizeProfileModule),
  );
}

export function updateProfileModule(
  moduleId: number,
  input: UpdateProfileModuleInput,
  csrfToken: string,
): Promise<ProfileModule[]> {
  return apiPatch<ApiProfileModule[]>(
    `/me/profile/modules/${moduleId}`,
    input,
    csrfToken,
  ).then((items) => items.filter(isApiProfileModule).map(normalizeProfileModule));
}

export function deleteProfileModule(
  moduleId: number,
  csrfToken: string,
): Promise<ProfileModule[]> {
  return apiDelete<ApiProfileModule[]>(
    `/me/profile/modules/${moduleId}`,
    csrfToken,
  ).then((items) => items.filter(isApiProfileModule).map(normalizeProfileModule));
}

export function restoreProfileModule(
  moduleId: number,
  csrfToken: string,
): Promise<ProfileModule[]> {
  return apiPost<ApiProfileModule[]>(
    `/me/profile/modules/${moduleId}/restore`,
    {},
    csrfToken,
  ).then((items) => items.filter(isApiProfileModule).map(normalizeProfileModule));
}

export function updateProfileModuleOrder(
  moduleIds: number[],
  csrfToken: string,
): Promise<ProfileModule[]> {
  return apiPatch<ApiProfileModule[]>(
    "/me/profile/module-order",
    { moduleIds },
    csrfToken,
  ).then((items) => items.filter(isApiProfileModule).map(normalizeProfileModule));
}

export function updateProfileCanvas(
  input: UpdateProfileCanvasInput,
  csrfToken: string,
): Promise<UpdateProfileCanvasResult> {
  return apiPatch<{
    backgroundBlur?: string | null;
    canvasGlass?: number | string | null;
    canvasVersion?: number | string | null;
    modules?: ApiProfileModule[];
  }>("/me/profile/canvas", input, csrfToken).then((result) => ({
    backgroundBlur: normalizeProfileBackgroundBlur(result.backgroundBlur),
    canvasGlass: normalizeProfileCanvasGlass(result.canvasGlass),
    canvasVersion: PROFILE_CANVAS_VERSION,
    modules: Array.isArray(result.modules)
      ? result.modules.filter(isApiProfileModule).map(normalizeProfileModule)
      : [],
  }));
}

export function getProfileCanvasDraft(): Promise<ProfileCanvasDraftState> {
  return apiGet<ProfileCanvasDraftState>("/me/profile/canvas-draft").then(
    normalizeProfileCanvasDraftState,
  );
}

export function updateProfileCanvasDraft(
  input: UpdateProfileCanvasDraftInput,
  csrfToken: string,
): Promise<ProfileCanvasDraftState> {
  return apiPatch<ProfileCanvasDraftState>(
    "/me/profile/canvas-draft",
    profileCanvasDraftInputForWrite(input),
    csrfToken,
  ).then(normalizeProfileCanvasDraftState);
}

export function commitProfileCanvasDraft(
  expectedRevision: string | null,
  csrfToken: string,
): Promise<UpdateProfileCanvasResult> {
  return apiPost<{
    backgroundBlur?: string | null;
    canvasGlass?: number | string | null;
    canvasVersion?: number | string | null;
    modules?: ApiProfileModule[];
  }>("/me/profile/canvas-draft/commit", { expectedRevision }, csrfToken).then((result) => ({
    backgroundBlur: normalizeProfileBackgroundBlur(result.backgroundBlur),
    canvasGlass: normalizeProfileCanvasGlass(result.canvasGlass),
    canvasVersion: PROFILE_CANVAS_VERSION,
    modules: Array.isArray(result.modules)
      ? result.modules.filter(isApiProfileModule).map(normalizeProfileModule)
      : [],
  }));
}

export function rebaseProfileCanvasDraft(
  expectedRevision: string | null,
  csrfToken: string,
): Promise<ProfileCanvasDraftState> {
  return apiPost<ProfileCanvasDraftState>(
    "/me/profile/canvas-draft/rebase",
    { expectedRevision },
    csrfToken,
  ).then(normalizeProfileCanvasDraftState);
}

export function discardProfileCanvasDraft(
  expectedRevision: string | null,
  csrfToken: string,
): Promise<ProfileCanvasDraftState> {
  return apiDelete<ProfileCanvasDraftState>(
    "/me/profile/canvas-draft",
    csrfToken,
    { expectedRevision },
  ).then(normalizeProfileCanvasDraftState);
}

export function getMyProfileIntegrations(): Promise<ProfileIntegrationsResult> {
  return apiGet<ProfileIntegrationsResult>("/me/integrations").then(
    normalizeProfileIntegrationsResult,
  );
}

export function getProfileIntegrationDiagnostics(): Promise<ProfileIntegrationDiagnostics> {
  return apiGet<ProfileIntegrationDiagnostics>("/me/integrations/diagnostics").then(
    normalizeProfileIntegrationDiagnostics,
  );
}

export function startProfileIntegration(
  provider: ProfileIntegrationProvider,
  csrfToken: string,
  redirectPath = "/settings/connections",
): Promise<StartProfileIntegrationResult> {
  return apiPost<StartProfileIntegrationResult>(
    `/me/integrations/${provider}/start`,
    { redirectPath },
    csrfToken,
  ).then((result) => ({
    provider: normalizeProfileIntegrationProvider(result.provider) ?? provider,
    authorizationUrl:
      typeof result.authorizationUrl === "string" ? result.authorizationUrl : "",
    stateExpiresIn:
      typeof result.stateExpiresIn === "number" ? result.stateExpiresIn : 0,
  }));
}

export function disconnectProfileIntegration(
  provider: ProfileIntegrationProvider,
  csrfToken: string,
): Promise<ProfileIntegrationsResult> {
  return apiDelete<ProfileIntegrationsResult>(
    `/me/integrations/${provider}`,
    csrfToken,
  ).then(normalizeProfileIntegrationsResult);
}

export function getProfileIntegrationSuggestions(
  provider: ProfileIntegrationProvider,
): Promise<ProfileIntegrationSuggestionsResult> {
  return apiGet<ProfileIntegrationSuggestionsResult>(
    `/me/integrations/${provider}/suggestions`,
  ).then(normalizeProfileIntegrationSuggestionsResult);
}

export function resolveProfileIntegrationMetadata(
  input: { url: string; provider?: ProfileIntegrationProvider },
  csrfToken: string,
): Promise<ProfileIntegrationCard> {
  return apiPost<ProfileIntegrationCard>(
    "/me/integrations/metadata/resolve",
    input,
    csrfToken,
  ).then((result) => {
    const card = normalizeProfileIntegrationCard(result);

    if (!card) {
      throw new Error("Integration metadata response was invalid.");
    }

    return card;
  });
}

export function getOnboardingState(): Promise<OnboardingState> {
  return apiGet<OnboardingState>("/me/onboarding").then(normalizeOnboardingState);
}

export function updateOnboardingState(
  input: UpdateOnboardingInput,
  csrfToken: string,
): Promise<OnboardingState> {
  return apiPatch<OnboardingState>("/me/onboarding", input, csrfToken).then(
    normalizeOnboardingState,
  );
}

export function getProfilePosts(handle: string): Promise<Post[]> {
  const normalized = handle.replace(/^@/, "").toLowerCase();

  return apiGet<ApiPost[]>(
    `/profiles/${encodeURIComponent(normalized)}/posts`,
  ).then((items) => items.filter(isVisiblePost).map(normalizePost));
}

export function getProfileReplies(handle: string): Promise<Post[]> {
  const normalized = handle.replace(/^@/, "").toLowerCase();

  return apiGet<ApiPost[]>(
    `/profiles/${encodeURIComponent(normalized)}/replies`,
  ).then((items) => items.filter(isVisiblePost).map(normalizePost));
}

export function getProfileReblogs(handle: string): Promise<Post[]> {
  const normalized = handle.replace(/^@/, "").toLowerCase();

  return apiGet<ApiPost[]>(
    `/profiles/${encodeURIComponent(normalized)}/reblogs`,
  ).then((items) => items.filter(isVisiblePost).map(normalizePost));
}

export function getProfileRooms(handle: string): Promise<Room[]> {
  const normalized = handle.replace(/^@/, "").toLowerCase();

  return apiGet<ApiRoom[]>(
    `/profiles/${encodeURIComponent(normalized)}/rooms`,
  ).then((items) => items.map(normalizeRoom));
}

export function getProfileFollowers(handle: string): Promise<ProfileConnection[]> {
  const normalized = normalizeHandle(handle);

  return apiGet<ProfileConnection[]>(
    `/profiles/${encodeURIComponent(normalized)}/followers`,
  );
}

export function getProfileFollowing(handle: string): Promise<ProfileConnection[]> {
  const normalized = normalizeHandle(handle);

  return apiGet<ProfileConnection[]>(
    `/profiles/${encodeURIComponent(normalized)}/following`,
  );
}

export function getBadgeDefinitions(): Promise<BadgeDefinition[]> {
  return apiGet<ApiBadgeDefinition[]>("/badges").then((items) =>
    items.map(normalizeBadgeDefinition),
  );
}

export function getProfileBadges(handle: string): Promise<ProfileBadgesResult> {
  const normalized = normalizeHandle(handle);

  return apiGet<ApiProfileBadgesResult>(
    `/profiles/${encodeURIComponent(normalized)}/badges`,
  ).then(normalizeProfileBadgesResult);
}

export function updateFeaturedBadges(
  input: UpdateFeaturedBadgesInput,
  csrfToken: string,
): Promise<ProfileBadgesResult> {
  return apiPatch<ApiProfileBadgesResult>(
    "/me/badges/featured",
    input,
    csrfToken,
  ).then(normalizeProfileBadgesResult);
}

export function followProfile(
  handle: string,
  csrfToken: string,
): Promise<FollowRelationship> {
  const normalized = normalizeHandle(handle);

  return apiPost<ApiFollowRelationship>(
    `/profiles/${encodeURIComponent(normalized)}/follow`,
    {},
    csrfToken,
  ).then(normalizeFollowRelationship);
}

export function unfollowProfile(
  handle: string,
  csrfToken: string,
): Promise<FollowRelationship> {
  const normalized = normalizeHandle(handle);

  return apiDelete<ApiFollowRelationship>(
    `/profiles/${encodeURIComponent(normalized)}/follow`,
    csrfToken,
  ).then(normalizeFollowRelationship);
}

export function starProfile(
  handle: string,
  csrfToken: string,
): Promise<ProfileStarResult> {
  const normalized = normalizeHandle(handle);

  return apiPost<ApiProfileStarResult>(
    `/profiles/${encodeURIComponent(normalized)}/star`,
    {},
    csrfToken,
  ).then(normalizeProfileStarResult);
}

export function unstarProfile(
  handle: string,
  csrfToken: string,
): Promise<ProfileStarResult> {
  const normalized = normalizeHandle(handle);

  return apiDelete<ApiProfileStarResult>(
    `/profiles/${encodeURIComponent(normalized)}/star`,
    csrfToken,
  ).then(normalizeProfileStarResult);
}

export function blockProfile(
  handle: string,
  csrfToken: string,
): Promise<ProfileControlResult> {
  const normalized = normalizeHandle(handle);

  return apiPost<ApiProfileControlResult>(
    `/profiles/${encodeURIComponent(normalized)}/block`,
    {},
    csrfToken,
  ).then(normalizeProfileControlResult);
}

export function unblockProfile(
  handle: string,
  csrfToken: string,
): Promise<ProfileControlResult> {
  const normalized = normalizeHandle(handle);

  return apiDelete<ApiProfileControlResult>(
    `/profiles/${encodeURIComponent(normalized)}/block`,
    csrfToken,
  ).then(normalizeProfileControlResult);
}

export function muteProfile(
  handle: string,
  csrfToken: string,
): Promise<ProfileControlResult> {
  const normalized = normalizeHandle(handle);

  return apiPost<ApiProfileControlResult>(
    `/profiles/${encodeURIComponent(normalized)}/mute`,
    {},
    csrfToken,
  ).then(normalizeProfileControlResult);
}

export function unmuteProfile(
  handle: string,
  csrfToken: string,
): Promise<ProfileControlResult> {
  const normalized = normalizeHandle(handle);

  return apiDelete<ApiProfileControlResult>(
    `/profiles/${encodeURIComponent(normalized)}/mute`,
    csrfToken,
  ).then(normalizeProfileControlResult);
}

export function removeProfileFollower(
  handle: string,
  csrfToken: string,
): Promise<RemoveFollowerResult> {
  const normalized = normalizeHandle(handle);

  return apiDelete<ApiRemoveFollowerResult>(
    `/profiles/${encodeURIComponent(normalized)}/follower`,
    csrfToken,
  ).then((result) => ({
    ...result,
    relationship: normalizeFollowRelationship(result.relationship),
  }));
}

export function uploadImage(
  file: File,
  purpose: ImageUploadPurpose,
  csrfToken: string,
): Promise<UploadedImage> {
  const formData = new FormData();
  formData.set("file", file);
  formData.set("purpose", purpose);

  return apiUpload<UploadedImage>("/uploads/image", formData, csrfToken);
}

export async function previewImageUpload(
  file: File,
  purpose: ImageUploadPurpose,
  csrfToken: string,
): Promise<File> {
  const formData = new FormData();
  formData.set("file", file);
  formData.set("purpose", purpose);

  const blob = await apiUploadBlob("/uploads/image?preview=1", formData, csrfToken);
  const originalName = file.name.replace(/\.[^.]+$/u, "") || "image";

  return new File([blob], `${originalName}-preview.webp`, {
    lastModified: Date.now(),
    type: "image/webp",
  });
}

export function uploadVideo(
  file: File,
  purpose: VideoUploadPurpose,
  csrfToken: string,
): Promise<UploadedVideo> {
  const formData = new FormData();
  formData.set("file", file);
  formData.set("purpose", purpose);

  return apiUpload<UploadedVideo>("/uploads/video", formData, csrfToken);
}

export function uploadAudio(
  file: File,
  purpose: AudioUploadPurpose,
  csrfToken: string,
): Promise<UploadedAudio> {
  const formData = new FormData();
  formData.set("file", file);
  formData.set("purpose", purpose);

  return apiUpload<UploadedAudio>("/uploads/audio", formData, csrfToken);
}

export function getTrendingGifs(options: { cursor?: string | null; limit?: number } = {}): Promise<GifSearchResponse> {
  const params = new URLSearchParams();

  if (options.cursor) {
    params.set("pos", options.cursor);
  }

  if (options.limit) {
    params.set("limit", String(options.limit));
  }

  const query = params.toString();

  return apiGet<GifSearchResponse>(`/gifs/trending${query ? `?${query}` : ""}`);
}

export function searchGifs(
  query: string,
  options: { cursor?: string | null; limit?: number } = {},
): Promise<GifSearchResponse> {
  const params = new URLSearchParams({ q: query });

  if (options.cursor) {
    params.set("pos", options.cursor);
  }

  if (options.limit) {
    params.set("limit", String(options.limit));
  }

  return apiGet<GifSearchResponse>(`/gifs/search?${params.toString()}`);
}

export function getGif(id: string): Promise<GifSearchResponse["items"][number]> {
  return apiGet<GifSearchResponse["items"][number]>(`/gifs/${encodeURIComponent(id)}`);
}

export function registerGifShare(id: string, query?: string): Promise<{ registered: boolean }> {
  return apiPost<{ registered: boolean }>(
    `/gifs/${encodeURIComponent(id)}/share`,
    query ? { q: query } : {},
  );
}

export function updateMyProfile(
  input: UpdateProfileInput,
  csrfToken: string,
): Promise<Profile> {
  return apiPatch<ApiProfile>("/me/profile", input, csrfToken).then(normalizeProfile);
}

export function updateProfileFeaturedContent(
  input: UpdateProfileFeaturedInput,
  csrfToken: string,
): Promise<Profile> {
  return apiPatch<ApiProfile>("/me/profile/featured", input, csrfToken).then(
    normalizeProfile,
  );
}

export function getAccountSettings(): Promise<AccountSettings> {
  return apiGet<AccountSettings>("/me/settings");
}

export function updateAccountEmail(
  input: { email: string; currentPassword: string },
  csrfToken: string,
): Promise<AccountSettings> {
  return apiPatch<AccountSettings>("/me/account/email", input, csrfToken);
}

export function updateAccountHandle(
  input: { handle: string; currentPassword: string },
  csrfToken: string,
): Promise<AccountSettings> {
  return apiPatch<AccountSettings>(
    "/me/account/handle",
    { ...input, handle: normalizeHandle(input.handle) },
    csrfToken,
  );
}

export function updateAccountPassword(
  input: { currentPassword: string; newPassword: string },
  csrfToken: string,
): Promise<{ changed: boolean }> {
  return apiPatch<{ changed: boolean }>("/me/account/password", input, csrfToken);
}

export function updateAccountPrivacy(
  input: { profileVisibility: "public" | "private" },
  csrfToken: string,
): Promise<AccountSettings> {
  return apiPatch<AccountSettings>("/me/privacy", input, csrfToken);
}

export function updateAccountPreferences(
  input: AccountPreferences,
  csrfToken: string,
): Promise<AccountSettings> {
  return apiPatch<AccountSettings>("/me/preferences", input, csrfToken);
}

export function getPushNotificationStatus(): Promise<PushNotificationStatus> {
  return apiGet<PushNotificationStatus>("/me/push").then(normalizePushNotificationStatus);
}

export function savePushSubscription(
  input: PushSubscriptionInput,
  csrfToken: string,
): Promise<PushNotificationStatus> {
  return apiPost<PushNotificationStatus>("/me/push/subscriptions", input, csrfToken).then(
    normalizePushNotificationStatus,
  );
}

export function disablePushSubscription(
  input: { id?: number; endpoint?: string },
  csrfToken: string,
): Promise<PushNotificationStatus> {
  return apiDelete<PushNotificationStatus>("/me/push/subscriptions", csrfToken, input).then(
    normalizePushNotificationStatus,
  );
}

export function sendPushNotificationTest(
  csrfToken: string,
): Promise<PushNotificationStatus> {
  return apiPost<PushNotificationStatus>("/me/push/test", {}, csrfToken).then(
    normalizePushNotificationStatus,
  );
}

export function getFollowRequests(): Promise<FollowRequest[]> {
  return apiGet<FollowRequest[]>("/me/follow-requests");
}

export function approveFollowRequest(
  id: number,
  csrfToken: string,
): Promise<{ approved: boolean }> {
  return apiPost<{ approved: boolean }>(
    `/me/follow-requests/${encodeURIComponent(String(id))}/approve`,
    {},
    csrfToken,
  );
}

export function denyFollowRequest(
  id: number,
  csrfToken: string,
): Promise<{ denied: boolean }> {
  return apiDelete<{ denied: boolean }>(
    `/me/follow-requests/${encodeURIComponent(String(id))}`,
    csrfToken,
  );
}

export function getMyPosts(
  kind: "posts" | "replies" | "all" = "all",
): Promise<AccountPostSummary[]> {
  return apiGet<AccountPostSummary[]>(`/me/posts?kind=${encodeURIComponent(kind)}`);
}

export function deleteMyPosts(
  kind: "posts" | "replies" | "all",
  csrfToken: string,
): Promise<{ deletedCount: number; kind: string }> {
  return apiDelete<{ deletedCount: number; kind: string }>(
    `/me/posts?kind=${encodeURIComponent(kind)}`,
    csrfToken,
  );
}

export function startTwoFactorSetup(
  currentPassword: string,
  csrfToken: string,
): Promise<TwoFactorSetupResult> {
  return apiPost<TwoFactorSetupResult>(
    "/me/security/2fa/setup",
    { currentPassword },
    csrfToken,
  );
}

export function enableTwoFactor(
  code: string,
  csrfToken: string,
): Promise<TwoFactorEnableResult> {
  return apiPost<TwoFactorEnableResult>("/me/security/2fa/enable", { code }, csrfToken);
}

export function disableTwoFactor(
  currentPassword: string,
  csrfToken: string,
): Promise<{ twoFactor: TwoFactorStatus }> {
  return apiDelete<{ twoFactor: TwoFactorStatus }>("/me/security/2fa", csrfToken, {
    currentPassword,
  });
}

export function regenerateTwoFactorRecoveryCodes(
  currentPassword: string,
  csrfToken: string,
): Promise<{ backupCodes: string[]; twoFactor: TwoFactorStatus }> {
  return apiPost<{ backupCodes: string[]; twoFactor: TwoFactorStatus }>(
    "/me/security/2fa/recovery-codes",
    { currentPassword },
    csrfToken,
  );
}

export function verifyTwoFactorLogin(input: {
  challengeId: string;
  code: string;
}): Promise<import("./authTypes").AuthSession> {
  return apiPost<import("./authTypes").AuthSession>("/auth/2fa/verify", input);
}

export function scheduleAccountDeletion(
  currentPassword: string,
  reason: string,
  csrfToken: string,
): Promise<{ scheduled: boolean; scheduledFor: string }> {
  return apiDelete<{ scheduled: boolean; scheduledFor: string }>(
    "/me/account",
    csrfToken,
    { currentPassword, reason },
  );
}

export function cancelAccountDeletion(
  csrfToken: string,
): Promise<AccountSettings> {
  return apiPost<AccountSettings>("/me/account/deletion/cancel", {}, csrfToken);
}

export function requestAccountDataExport(
  currentPassword: string,
  csrfToken: string,
): Promise<AccountDataExport> {
  return apiPost<AccountDataExport>(
    "/me/data-export",
    { currentPassword },
    csrfToken,
  );
}

export function createPost(
  input: CreatePostInput,
  csrfToken: string,
): Promise<Post> {
  return apiPost<ApiPost>("/posts", input, csrfToken).then(normalizePost);
}

export function getPost(postId: number | string): Promise<Post> {
  return apiGet<ApiPost>(`/posts/${postId}`).then(normalizePost);
}

export function postPublicIdentifier(post: Pick<Post, "id" | "publicId">) {
  return post.publicId ?? String(post.id);
}

export function postCanonicalPath(post: Pick<Post, "id" | "publicId" | "author" | "canonicalPath">) {
  return post.canonicalPath ?? `/@${post.author.handle}/posts/${postPublicIdentifier(post)}`;
}

export function postCanonicalUrl(post: Pick<Post, "id" | "publicId" | "author" | "canonicalUrl" | "canonicalPath">) {
  if (post.canonicalUrl) {
    return post.canonicalUrl;
  }

  if (typeof window === "undefined") {
    return `https://thia.lol${postCanonicalPath(post)}`;
  }

  return new URL(postCanonicalPath(post), window.location.origin).toString();
}

export function postShareCardUrl(post: Pick<Post, "id" | "publicId">) {
  return `/api/posts/${postPublicIdentifier(post)}/share-card.png`;
}

export function postShareCardCacheUpload(
  post: Pick<Post, "id" | "publicId">,
  card: Blob,
  csrfToken: string,
): Promise<{ url: string; width: number; height: number }> {
  const body = new FormData();
  body.set(
    "card",
    card,
    `thia-post-${postPublicIdentifier(post)}.${shareCardBlobExtension(card)}`,
  );

  return apiUpload<{ url: string; width: number; height: number }>(
    `/posts/${postPublicIdentifier(post)}/share-card-cache`,
    body,
    csrfToken,
  );
}

export function profileCanonicalPath(profile: Pick<Profile, "user">) {
  return `/@${profile.user.handle}`;
}

export function profileCanonicalUrl(profile: Pick<Profile, "user">) {
  if (typeof window === "undefined") {
    return `https://thia.lol${profileCanonicalPath(profile)}`;
  }

  return new URL(profileCanonicalPath(profile), window.location.origin).toString();
}

export function profileShareCardUrl(profile: Pick<Profile, "user">) {
  return `/api/profiles/${encodeURIComponent(profile.user.handle)}/share-card.png`;
}

export function roomCanonicalPath(room: Pick<Room, "slug">) {
  return `/rooms/${room.slug}`;
}

export function roomCanonicalUrl(room: Pick<Room, "slug">) {
  if (typeof window === "undefined") {
    return `https://thia.lol${roomCanonicalPath(room)}`;
  }

  return new URL(roomCanonicalPath(room), window.location.origin).toString();
}

export function roomShareCardUrl(room: Pick<Room, "slug">) {
  return `/api/rooms/${encodeURIComponent(room.slug)}/share-card.png`;
}

function shareCardBlobExtension(card: Blob): "jpg" | "png" {
  return card.type === "image/jpeg" ? "jpg" : "png";
}

export function shareCardImageProxyUrl(url: string | null | undefined) {
  if (!url) {
    return undefined;
  }

  return `/api/share-card/image?url=${encodeURIComponent(url)}`;
}

export function sharePostToMessages(
  postId: number | string,
  input: SharePostToMessagesInput,
  csrfToken: string,
): Promise<SharePostToMessagesResult> {
  return apiPost<SharePostToMessagesResult>(
    `/posts/${postId}/shares/messages`,
    {
      recipientUserIds: input.recipientUserIds,
      ...(input.note !== undefined ? { note: input.note } : {}),
    },
    csrfToken,
  ).then((result) => ({
    ...result,
    post: normalizePostShareSummary(result.post as ApiPostShareSummary),
  }));
}

export function getPostReplies(postId: number): Promise<Post[]> {
  return apiGet<ApiPost[]>(`/posts/${postId}/replies`).then((items) =>
    items.filter(isVisiblePost).map(normalizePost),
  );
}

export function createPostReply(
  postId: number,
  input: Pick<
    CreatePostInput,
    "attachments" | "body" | "mediaUrl" | "mediaType" | "mediaMime" | "mediaPosterUrl"
  >,
  csrfToken: string,
): Promise<Post> {
  return apiPost<ApiPost>(`/posts/${postId}/replies`, input, csrfToken).then(
    normalizePost,
  );
}

export function updatePost(
  id: number,
  input: UpdatePostInput,
  csrfToken: string,
): Promise<Post> {
  return apiPatch<ApiPost>(`/posts/${id}`, input, csrfToken).then(normalizePost);
}

export function deletePost(
  id: number,
  csrfToken: string,
): Promise<DeletePostResult> {
  return apiDelete<DeletePostResult>(`/posts/${id}`, csrfToken);
}

export function likePost(
  postId: number,
  csrfToken: string,
): Promise<LikeResult> {
  return apiPost<LikeResult>(`/posts/${postId}/like`, {}, csrfToken);
}

export function unlikePost(
  postId: number,
  csrfToken: string,
): Promise<LikeResult> {
  return apiDelete<LikeResult>(`/posts/${postId}/like`, csrfToken);
}

export function reblogPost(
  postId: number,
  csrfToken: string,
): Promise<ReblogResult> {
  return apiPost<ReblogResult>(`/posts/${postId}/reblog`, {}, csrfToken);
}

export function unreblogPost(
  postId: number,
  csrfToken: string,
): Promise<ReblogResult> {
  return apiDelete<ReblogResult>(`/posts/${postId}/reblog`, csrfToken);
}

export function getNotifications(): Promise<NotificationsResult> {
  return apiGet<NotificationsResult>("/notifications").then((result) => ({
    notifications: result.notifications.map(normalizeNotification),
    unreadCount: result.unreadCount,
  }));
}

export function markNotificationRead(
  notificationId: number,
  csrfToken: string,
): Promise<NotificationsReadResult> {
  return apiPost<NotificationsReadResult>(
    `/notifications/${notificationId}/read`,
    {},
    csrfToken,
  );
}

export function markNotificationsRead(
  notificationIds: number[],
  csrfToken: string,
): Promise<NotificationsReadResult> {
  return apiPost<NotificationsReadResult>(
    "/notifications/read",
    { ids: notificationIds },
    csrfToken,
  );
}

export function markAllNotificationsRead(
  csrfToken: string,
): Promise<NotificationsReadResult> {
  return apiPost<NotificationsReadResult>("/notifications/read-all", {}, csrfToken);
}

export function getChatConversations(): Promise<ChatConversation[]> {
  return apiGet<ChatConversation[]>("/chat/conversations");
}

export function getChatMoots(): Promise<ChatMoot[]> {
  return apiGet<ChatMoot[]>("/chat/moots");
}

export function createChatConversation(
  input: { targetHandle?: string; targetUserId?: number },
  csrfToken: string,
): Promise<ChatConversation> {
  const body: Record<string, unknown> = {};

  if (input.targetHandle) {
    body.targetHandle = normalizeHandle(input.targetHandle);
  }

  if (input.targetUserId !== undefined) {
    body.targetUserId = input.targetUserId;
  }

  return apiPost<ChatConversation>("/chat/conversations", body, csrfToken);
}

export function getChatMessages(
  conversationId: number,
): Promise<ChatMessagesResult> {
  return apiGet<ChatMessagesResult>(
    `/chat/conversations/${conversationId}/messages`,
  ).then((result) => ({
    ...result,
    messages: result.messages.map(normalizeChatMessage),
  }));
}

export function sendChatMessage(
  conversationId: number,
  body: string,
  csrfToken: string,
  attachments: ChatMessageAttachmentInput[] = [],
): Promise<ChatMessage> {
  return apiPost<ChatMessage>(
    `/chat/conversations/${conversationId}/messages`,
    { body, attachments },
    csrfToken,
  ).then(normalizeChatMessage);
}

export function markChatConversationRead(
  conversationId: number,
  csrfToken: string,
): Promise<ChatReadResult> {
  return apiPost<ChatReadResult>(
    `/chat/conversations/${conversationId}/read`,
    {},
    csrfToken,
  );
}

export function getRoomChannelMessages(
  roomSlug: string,
  channelSlug: string,
): Promise<RoomChannelMessagesResult> {
  return apiGet<RoomChannelMessagesResult>(
    `/rooms/${encodeURIComponent(roomSlug)}/channels/${encodeURIComponent(channelSlug)}/messages`,
  ).then((result) => ({
    ...result,
    messages: result.messages.map(normalizeChatMessage),
  }));
}

export function sendRoomChannelMessage(
  roomSlug: string,
  channelSlug: string,
  body: string,
  csrfToken: string,
  attachments: ChatMessageAttachmentInput[] = [],
): Promise<ChatMessage> {
  return apiPost<ChatMessage>(
    `/rooms/${encodeURIComponent(roomSlug)}/channels/${encodeURIComponent(channelSlug)}/messages`,
    { body, attachments },
    csrfToken,
  ).then(normalizeChatMessage);
}

export function markRoomChannelRead(
  roomSlug: string,
  channelSlug: string,
  csrfToken: string,
): Promise<ChatReadResult> {
  return apiPost<ChatReadResult>(
    `/rooms/${encodeURIComponent(roomSlug)}/channels/${encodeURIComponent(channelSlug)}/read`,
    {},
    csrfToken,
  );
}

export function createReport(
  input: CreateReportInput,
  csrfToken: string,
): Promise<ModerationReport> {
  const body: Record<string, unknown> = {
    targetType: input.targetType,
    targetId: input.targetId,
    category: input.category,
  };

  if (input.details) {
    body.details = input.details;
  }

  if (input.postId !== undefined) {
    body.postId = input.postId;
  }

  if (input.reportedUserId !== undefined) {
    body.reportedUserId = input.reportedUserId;
  }

  return apiPost<ModerationReport>("/reports", body, csrfToken);
}

export function getAdminReports(): Promise<ModerationReport[]> {
  return apiGet<ModerationReport[]>("/admin/reports");
}

export function getAdminRooms(): Promise<Room[]> {
  return apiGet<ApiRoom[]>("/admin/rooms").then((items) => items.map(normalizeRoom));
}

export function getAdminBadges(): Promise<AdminBadgesResult> {
  return apiGet<ApiAdminBadgesResult>("/admin/badges").then((result) => ({
    badges: result.badges.map(normalizeBadgeDefinition),
    recentGrants: result.recentGrants.map(normalizeUserBadge),
  }));
}

export function grantAdminBadge(
  input: GrantBadgeInput,
  csrfToken: string,
): Promise<UserBadge> {
  return apiPost<ApiUserBadge>(
    "/admin/badges/grant",
    {
      handle: normalizeHandle(input.handle),
      badgeKey: input.badgeKey,
      reason: input.reason?.trim() || undefined,
    },
    csrfToken,
  ).then(normalizeUserBadge);
}

export function revokeAdminBadge(
  input: Pick<GrantBadgeInput, "handle" | "badgeKey">,
  csrfToken: string,
): Promise<{ revoked: boolean; handle: string; badge: BadgeDefinition }> {
  return apiPost<{ revoked: boolean; handle: string; badge: ApiBadgeDefinition }>(
    "/admin/badges/revoke",
    {
      handle: normalizeHandle(input.handle),
      badgeKey: input.badgeKey,
    },
    csrfToken,
  ).then((result) => ({
    ...result,
    badge: normalizeBadgeDefinition(result.badge),
  }));
}

export function hideAdminPost(
  postId: number,
  input: AdminActionInput,
  csrfToken: string,
): Promise<{ id: number; status: "hidden" }> {
  return apiPost<{ id: number; status: "hidden" }>(
    `/admin/posts/${postId}/hide`,
    adminActionBody(input),
    csrfToken,
  );
}

export function removeAdminPost(
  postId: number,
  input: AdminActionInput,
  csrfToken: string,
): Promise<{ id: number; status: "removed" }> {
  return apiPost<{ id: number; status: "removed" }>(
    `/admin/posts/${postId}/remove`,
    adminActionBody(input),
    csrfToken,
  );
}

export function suspendAdminUser(
  userId: number,
  input: AdminActionInput,
  csrfToken: string,
): Promise<ModerationUser> {
  return apiPost<ModerationUser>(
    `/admin/users/${userId}/suspend`,
    adminActionBody(input),
    csrfToken,
  );
}

export function resolveAdminReport(
  reportId: number,
  input: AdminActionInput & { status?: "reviewed" | "dismissed" | "actioned" },
  csrfToken: string,
): Promise<ModerationReport> {
  return apiPost<ModerationReport>(
    `/admin/reports/${reportId}/resolve`,
    adminActionBody(input),
    csrfToken,
  );
}

function normalizeRoom(room: ApiRoom): Room {
  const memberCount = room.memberCount ?? room.members ?? 0;
  const visibility = normalizeRoomVisibility(room.visibility);
  const joinedByMe = room.joinedByMe ?? false;
  const myRoomRole = room.myRoomRole ?? null;
  const themeConfig = normalizeProfileThemeConfig(room.themeConfig);
  const theme =
    typeof room.theme === "string"
      ? room.theme
      : themeConfig?.mode === "preset"
        ? themeConfig.preset
        : themeConfig?.mode === "custom"
          ? "custom"
          : null;
  const viewerCanViewPosts =
    room.viewerCanViewPosts ??
    (visibility === "public" ||
      visibility === "view_only" ||
      joinedByMe);
  const viewerCanPost =
    room.viewerCanPost ??
    (myRoomRole === "owner" ||
      myRoomRole === "moderator" ||
      (visibility !== "view_only" && joinedByMe));
  const viewerCanReact = room.viewerCanReact ?? viewerCanViewPosts;

  return {
    id: room.id,
    slug: room.slug,
    name: room.name,
    summary: room.summary ?? room.description ?? "",
    description: room.description ?? room.summary ?? "",
    mood: room.mood ?? "",
    members: memberCount,
    memberCount,
    live: room.live ?? false,
    theme,
    themeConfig,
    iconUrl: room.iconUrl ?? null,
    bannerUrl: room.bannerUrl ?? null,
    rules: room.rules ?? "",
    rulesVersion: Math.max(1, Number(room.rulesVersion) || 1),
    visibility,
    createdBy: room.createdBy ?? null,
    owner: room.owner ?? null,
    joinedByMe,
    myRoomRole,
    viewerCanViewPosts,
    viewerCanPost,
    viewerCanReact,
    viewerCanJoin: room.viewerCanJoin ?? (visibility === "public" && !joinedByMe),
    viewerCanRequestAccess: room.viewerCanRequestAccess ?? false,
    accessRequestStatus: room.accessRequestStatus ?? null,
    pendingAccessRequestCount: room.pendingAccessRequestCount,
    postCount: room.postCount ?? 0,
    latestActivityAt: room.latestActivityAt ?? null,
    createdAt: room.createdAt ?? null,
    updatedAt: room.updatedAt ?? null,
  };
}

function normalizeRoomVisibility(value: unknown): RoomVisibility {
  return value === "private" || value === "invite" || value === "view_only" ? value : "public";
}

function roomInputBody(input: Partial<RoomInput>): Record<string, unknown> {
  const body: Record<string, unknown> = {};

  if (input.name !== undefined) {
    body.name = input.name.trim();
  }

  if (input.slug !== undefined) {
    body.slug = input.slug.trim().toLowerCase();
  }

  if (input.summary !== undefined) {
    body.summary = input.summary.trim();
  }

  if (input.mood !== undefined) {
    body.mood = input.mood?.trim() || null;
  }

  if (input.theme !== undefined) {
    body.theme = input.theme || null;
  }

  if (input.themeConfig !== undefined) {
    body.themeConfig = input.themeConfig ?? null;
  }

  if (input.iconUrl !== undefined) {
    body.iconUrl = input.iconUrl || null;
  }

  if (input.bannerUrl !== undefined) {
    body.bannerUrl = input.bannerUrl || null;
  }

  if (input.rules !== undefined) {
    body.rules = input.rules?.trim() || null;
  }

  if (input.visibility !== undefined) {
    body.visibility = input.visibility;
  }

  return body;
}

function normalizeProfile(profile: ApiProfile): Profile {
  const isRetiredThiaProfile =
    profile.user.handle === "thia" &&
    (profile.bio ===
      "A secondary profile on the platform, present without making the whole room about her." ||
      profile.traits.includes("soft systems") ||
      profile.traits.includes("moon notes"));

  return {
    user: profile.user,
    bio: isRetiredThiaProfile ? "Founder profile for thia.lol." : profile.bio,
    bioEntities: isRetiredThiaProfile
      ? []
      : normalizeRichTextEntities(profile.bioEntities),
    location: profile.location,
    bannerUrl: profile.bannerUrl ?? null,
    profileAccent: profile.profileAccent ?? null,
    profileBackground: profile.profileBackground ?? null,
    profileBackgroundVideo: normalizeUploadedProfileVideoUrl(
      profile.profileBackgroundVideo,
    ),
    profileBackgroundVideoPoster: normalizeUploadedProfileImageUrl(
      profile.profileBackgroundVideoPoster,
    ),
    profileBackgroundBlur: normalizeProfileBackgroundBlur(
      profile.profileBackgroundBlur,
    ),
    profileTheme: profile.profileTheme ?? null,
    profileThemeConfig: normalizeProfileThemeConfig(profile.profileThemeConfig),
    profileLayoutPreset: normalizeProfileLayoutPreset(profile.profileLayoutPreset),
    profileCanvasVersion:
      Number(profile.profileCanvasVersion) === PROFILE_CANVAS_VERSION
        ? PROFILE_CANVAS_VERSION
        : PROFILE_CANVAS_VERSION,
    profileCanvasGlass: normalizeProfileCanvasGlass(profile.profileCanvasGlass),
    visibility: profile.visibility === "private" ? "private" : "public",
    isPrivate: profile.isPrivate ?? (profile.visibility === "private"),
    viewerCanView: profile.viewerCanView ?? true,
    featuredPostId: profile.featuredPostId ?? profile.featuredPost?.id ?? null,
    featuredRoomId: profile.featuredRoomId ?? profile.featuredRoom?.id ?? null,
    featuredPost: profile.featuredPost ? normalizePost(profile.featuredPost) : null,
    featuredRoom: profile.featuredRoom ? normalizeRoom(profile.featuredRoom) : null,
    links: Array.isArray(profile.links)
      ? profile.links
          .map((connection) => normalizeProfileConnection(connection))
          .filter(isProfileExternalConnection)
      : [],
    traits: isRetiredThiaProfile
      ? ["founder", "frontend", "moderation"]
      : profile.traits,
    stats: {
      posts: profile.stats.posts,
      replies: profile.stats.replies ?? 0,
      rooms: profile.stats.rooms,
      echoes: profile.stats.echoes,
      followers: profile.stats.followers ?? profile.followerCount ?? 0,
      following: profile.stats.following ?? profile.followingCount ?? 0,
      moots: profile.stats.moots ?? profile.mootCount ?? 0,
      stars: profile.stats.stars ?? profile.starCount ?? 0,
    },
    followerCount: profile.followerCount ?? profile.stats.followers ?? 0,
    followingCount: profile.followingCount ?? profile.stats.following ?? 0,
    mootCount: profile.mootCount ?? profile.stats.moots ?? 0,
    starCount: profile.starCount ?? profile.stats.stars ?? 0,
    isFollowing: profile.isFollowing ?? false,
    isFollowedBy: profile.isFollowedBy ?? false,
    isMoot: profile.isMoot ?? false,
    isStarred: profile.isStarred ?? false,
    isFollowRequestPending: profile.isFollowRequestPending ?? false,
    blockedByMe: profile.blockedByMe ?? profile.isBlocked ?? false,
    mutedByMe: profile.mutedByMe ?? profile.isMuted ?? false,
    createdAt: profile.createdAt ?? null,
    updatedAt: profile.updatedAt ?? null,
  };
}

function normalizeFollowRelationship(
  relationship: ApiFollowRelationship,
): FollowRelationship {
  return {
    isFollowing: relationship.isFollowing ?? false,
    isFollowedBy: relationship.isFollowedBy ?? false,
    isMoot: relationship.isMoot ?? false,
    isStarred: relationship.isStarred ?? false,
    isFollowRequestPending: relationship.isFollowRequestPending ?? false,
    blockedByMe: relationship.blockedByMe ?? relationship.isBlocked ?? false,
    mutedByMe: relationship.mutedByMe ?? relationship.isMuted ?? false,
    followerCount: relationship.followerCount ?? 0,
    followingCount: relationship.followingCount ?? 0,
    mootCount: relationship.mootCount ?? 0,
    starCount: relationship.starCount ?? 0,
  };
}

function normalizeProfileStarResult(result: ApiProfileStarResult): ProfileStarResult {
  const relationship = normalizeFollowRelationship(result.relationship);

  return {
    isStarred: result.isStarred ?? relationship.isStarred,
    starCount: result.starCount ?? relationship.starCount,
    relationship,
    stats: {
      followers: result.stats?.followers ?? relationship.followerCount,
      following: result.stats?.following ?? relationship.followingCount,
      moots: result.stats?.moots ?? relationship.mootCount ?? 0,
      stars: result.stats?.stars ?? relationship.starCount,
    },
  };
}

function normalizeProfileControlResult(
  result: ApiProfileControlResult,
): ProfileControlResult {
  const relationship = normalizeFollowRelationship(result.relationship);

  return {
    isBlocked: result.isBlocked ?? relationship.blockedByMe ?? false,
    isMuted: result.isMuted ?? relationship.mutedByMe ?? false,
    relationship,
  };
}

function isProfileExternalConnection(
  connection: ProfileExternalConnection | null,
): connection is ProfileExternalConnection {
  return connection !== null;
}

function normalizeProfileBadgesResult(
  result: ApiProfileBadgesResult,
): ProfileBadgesResult {
  return {
    badges: result.badges.map(normalizeUserBadge),
    featuredBadges: result.featuredBadges.map(normalizeUserBadge),
  };
}

function normalizeProfileBackgroundBlur(
  value: unknown,
): ProfileBackgroundBlur {
  return value === "none" ||
    value === "soft" ||
    value === "medium" ||
    value === "heavy"
    ? value
    : "medium";
}

function normalizeProfileCanvasGlass(value: unknown): number {
  const number =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim() !== ""
        ? Number(value)
        : 58;

  return Number.isFinite(number)
    ? Math.min(92, Math.max(0, Math.round(number)))
    : 58;
}

function normalizeProfileModule(
  module: ApiProfileModule,
  index = 0,
): ProfileModule {
  return {
    id: module.id,
    type: module.type,
    title: module.title ?? null,
    config: normalizeProfileModuleConfig(module.config),
    visibility: module.visibility,
    position: normalizeProfileModulePosition(module.position, index + 1),
    pinned: module.pinned === true,
    layout: normalizeProfileModuleLayout(module.layout, module.type),
    status: module.status,
    textEntities: normalizeTextEntitiesByField(module.textEntities),
    schemaVersion: module.schemaVersion ?? 1,
    createdAt: module.createdAt ?? null,
    updatedAt: module.updatedAt ?? null,
  };
}

function normalizeProfileModulePosition(value: unknown, fallback: number): number {
  const number =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim() !== ""
        ? Number(value)
        : fallback;

  return Number.isSafeInteger(number) && number > 0 ? number : fallback;
}

function normalizeProfileCanvasDraftState(
  state: ProfileCanvasDraftState,
): ProfileCanvasDraftState {
  return {
    backgroundBlur: normalizeProfileBackgroundBlur(state.backgroundBlur),
    canvasGlass:
      normalizeProfileCanvasGlass(state.canvasGlass),
    canvasVersion: PROFILE_CANVAS_VERSION,
    modules: Array.isArray(state.modules)
      ? state.modules.filter(isApiProfileModule).map(normalizeProfileModule)
      : [],
    revision: typeof state.revision === "string" ? state.revision : null,
    selectedModuleId:
      typeof state.selectedModuleId === "number" ||
      typeof state.selectedModuleId === "string"
        ? state.selectedModuleId
        : null,
    updatedAt: typeof state.updatedAt === "string" ? state.updatedAt : null,
  };
}

function profileCanvasDraftInputForWrite(
  input: UpdateProfileCanvasDraftInput,
): UpdateProfileCanvasDraftInput {
  if (!Array.isArray(input.modules)) {
    return input;
  }

  return {
    ...input,
    modules: input.modules.map(profileCanvasDraftModuleForWrite),
  };
}

function profileCanvasDraftModuleForWrite(
  module: ProfileCanvasDraftModule,
  index = 0,
): ProfileCanvasDraftModule {
  return {
    id: module.id,
    ...(typeof module.draftId === "string" ? { draftId: module.draftId } : {}),
    type: module.type,
    title: module.title,
    config: profileModuleConfigForWrite(module.type, module.config),
    visibility: module.visibility,
    position: normalizeProfileModulePosition(module.position, index + 1),
    pinned: module.pinned,
    layout: module.layout ?? null,
    status: module.status,
    schemaVersion: module.schemaVersion ?? 1,
    createdAt: module.createdAt ?? null,
    updatedAt: module.updatedAt ?? null,
  };
}

function profileModuleConfigForWrite(
  type: ProfileModuleType,
  config: ProfileModuleConfig,
): ProfileModuleConfig {
  const keys = new Set<keyof ProfileModuleConfig>(["canvasSize", "configured"]);

  if (type === "placeholder") {
    keys.add("placeholder");
    return pickProfileModuleConfig(config, keys);
  }

  if (type === "about" || type === "text") {
    keys.add("body");
    keys.add("statusText");
    keys.add("workingOn");
  } else if (type === "custom_text") {
    keys.add("body");
    keys.add("link");
  } else if (type === "links" || type === "connections") {
    keys.add("links");
  } else if (type === "featured_badges" || type === "badge_display") {
    keys.add("userBadgeIds");
  } else if (
    type === "gallery_media" ||
    type === "uploaded_image" ||
    type === "gallery_slideshow" ||
    type === "gallery_feed"
  ) {
    keys.add("mediaItems");
  } else if (type === "uploaded_video") {
    keys.add("label");
    keys.add("description");
    keys.add("displayMode");
    keys.add("sourceMode");
    keys.add("video");
    keys.add("autoplay");
  } else if (
    type === "creator_live" ||
    type === "twitch_channel" ||
    type === "youtube_video" ||
    type === "youtube_stream" ||
    type === "youtube_playlist" ||
    type === "github_repo"
  ) {
    keys.add("platform");
    keys.add("label");
    keys.add("url");
    keys.add("description");
    keys.add("displayMode");
    keys.add("sourceMode");
  } else if (
    type === "music" ||
    type === "music_playlist" ||
    type === "spotify_song" ||
    type === "apple_music_song" ||
    type === "youtube_music_song" ||
    type === "spotify_playlist" ||
    type === "apple_music_playlist" ||
    type === "youtube_music_playlist" ||
    type === "spotify_artist" ||
    type === "apple_music_artist" ||
    type === "youtube_music_artist"
  ) {
    keys.add("platform");
    keys.add("label");
    keys.add("url");
    keys.add("description");
    keys.add("displayMode");
    keys.add("sourceMode");
    keys.add("audio");
    keys.add("autoplay");
    keys.add("tracks");
  }

  return pickProfileModuleConfig(config, keys);
}

function pickProfileModuleConfig(
  config: ProfileModuleConfig,
  keys: Set<keyof ProfileModuleConfig>,
): ProfileModuleConfig {
  const writable: ProfileModuleConfig = {};

  keys.forEach((key) => {
    const value = config[key];

    if (value !== undefined) {
      Object.assign(writable, { [key]: value });
    }
  });

  return writable;
}

function isApiProfileModule(module: ApiProfileModule): boolean {
  return isProfileModuleType(module.type);
}

function normalizeProfileModuleLayout(
  layout: ProfileModule["layout"] | undefined,
  type: ProfileModule["type"],
): ProfileModuleLayout | null {
  if (!layout || typeof layout !== "object") {
    return null;
  }

  const column = normalizeCanvasInteger(layout.column);
  const row = normalizeCanvasInteger(layout.row);
  const colSpan = normalizeCanvasInteger(layout.colSpan);
  const rowSpan = normalizeCanvasInteger(layout.rowSpan);

  if (!column || !row || !colSpan || !rowSpan) {
    return null;
  }

  const maxSpan = profileModuleMaxAllowedSpan(type);

  return {
    column: Math.min(PROFILE_CANVAS_DESKTOP_COLUMNS, Math.max(1, column)),
    row: Math.min(PROFILE_CANVAS_DESKTOP_ROWS, Math.max(1, row)),
    colSpan: Math.min(maxSpan.columns, Math.max(1, colSpan)),
    rowSpan: Math.min(maxSpan.rows, Math.max(1, rowSpan)),
  };
}

function profileModuleMaxAllowedSpan(type: ProfileModule["type"]): {
  columns: number;
  rows: number;
} {
  return profileModuleAllowedSizes(type).reduce(
    (max, size) => {
      const span = profileGridModuleSizeSpan(size);

      return {
        columns: Math.max(max.columns, span.columns),
        rows: Math.max(max.rows, span.rows),
      };
    },
    { columns: 1, rows: 1 },
  );
}

function normalizeCanvasInteger(value: unknown): number | undefined {
  if (Number.isInteger(value)) {
    return value as number;
  }

  if (typeof value === "string" && /^-?\d+$/.test(value)) {
    return Number.parseInt(value, 10);
  }

  return undefined;
}

function normalizeProfileModuleConfig(config: ProfileModuleConfig): ProfileModuleConfig {
  const normalized: ProfileModuleConfig = {};
  const link = normalizeProfileModuleLink(config.link);
  const links = Array.isArray(config.links)
    ? config.links.map(normalizeProfileModuleLink).filter(isProfileModuleLink)
    : undefined;
  const mediaItems = Array.isArray(config.mediaItems)
    ? config.mediaItems
        .map(normalizeProfileModuleMediaItem)
        .filter(isProfileModuleMediaItem)
    : undefined;
  const userBadgeIds = Array.isArray(config.userBadgeIds)
    ? config.userBadgeIds.filter((id): id is number => Number.isInteger(id) && id > 0)
    : undefined;
  const integration = normalizeProfileIntegrationCard(config.integration);
  const audio = normalizeProfileModuleUploadedAudio(config.audio);
  const video = normalizeProfileModuleUploadedVideo(config.video);
  const tracks = normalizeProfileModulePlaylistTracks(config.tracks);

  if (audio) {
    normalized.audio = audio;
  }

  if (video) {
    normalized.video = video;
  }

  if (tracks.length > 0) {
    normalized.tracks = tracks;
  }

  if (typeof config.autoplay === "boolean") {
    normalized.autoplay = config.autoplay;
  }

  if (typeof config.body === "string") {
    normalized.body = config.body;
  }

  if (typeof config.statusText === "string") {
    normalized.statusText = config.statusText;
  }

  if (typeof config.workingOn === "string") {
    normalized.workingOn = config.workingOn;
  }

  if (typeof config.description === "string") {
    normalized.description = config.description;
  }

  if (typeof config.displayMode === "string") {
    normalized.displayMode = config.displayMode;
  }

  if (typeof config.label === "string") {
    normalized.label = config.label;
  }

  if (typeof config.platform === "string") {
    normalized.platform = config.platform;
  }

  if (typeof config.url === "string") {
    const safeUrl = normalizeProfileModuleExternalUrl(config.url);

    if (safeUrl) {
      normalized.url = safeUrl;
    }
  }

  if (typeof config.canvasSize === "string") {
    normalized.canvasSize = config.canvasSize;
  }

  if (typeof config.configured === "boolean") {
    normalized.configured = config.configured;
  }

  if (typeof config.sourceMode === "string") {
    normalized.sourceMode = config.sourceMode;
  }

  const restoreFeaturedPostId = config.restoreFeaturedPostId;
  const restoreFeaturedRoomId = config.restoreFeaturedRoomId;

  if (
    typeof restoreFeaturedPostId === "number" &&
    Number.isInteger(restoreFeaturedPostId) &&
    restoreFeaturedPostId > 0
  ) {
    normalized.restoreFeaturedPostId = restoreFeaturedPostId;
  }

  if (
    typeof restoreFeaturedRoomId === "number" &&
    Number.isInteger(restoreFeaturedRoomId) &&
    restoreFeaturedRoomId > 0
  ) {
    normalized.restoreFeaturedRoomId = restoreFeaturedRoomId;
  }

  if (link) {
    normalized.link = link;
  }

  if (links) {
    normalized.links = links;
  }

  if (mediaItems) {
    normalized.mediaItems = mediaItems;
  }

  if (userBadgeIds) {
    normalized.userBadgeIds = userBadgeIds;
  }

  if (integration) {
    normalized.integration = integration;
  }

  return normalized;
}

function normalizeProfileModuleLink(
  link: ProfileModuleConfig["link"],
): ProfileModuleConfig["link"] {
  if (!link || typeof link.label !== "string" || typeof link.url !== "string") {
    return undefined;
  }

  const safeUrl = normalizeProfileModuleExternalUrl(link.url);

  if (!safeUrl) {
    return undefined;
  }

  return {
    label: link.label,
    ...(typeof link.platform === "string" ? { platform: link.platform } : {}),
    url: safeUrl,
  };
}

function isProfileModuleLink(
  link: ProfileModuleConfig["link"],
): link is NonNullable<ProfileModuleConfig["link"]> {
  return link !== undefined;
}

function normalizeProfileModuleMediaItem(
  item: ProfileModuleMediaItem,
): ProfileModuleMediaItem | undefined {
  if (!item || typeof item.url !== "string") {
    return undefined;
  }

  if (!isUploadedProfileModuleMediaUrl(item.url)) {
    return undefined;
  }

  return {
    ...(typeof item.caption === "string" ? { caption: item.caption } : {}),
    url: item.url,
  };
}

function isProfileModuleMediaItem(
  item: ProfileModuleMediaItem | undefined,
): item is ProfileModuleMediaItem {
  return item !== undefined;
}

function normalizeProfileModuleUploadedAudio(
  audio: ProfileModuleConfig["audio"],
): ProfileModuleUploadedAudio | undefined {
  if (!audio || typeof audio.url !== "string") {
    return undefined;
  }

  if (!isUploadedProfileModuleAudioUrl(audio.url)) {
    return undefined;
  }

  const mime = audio.mime === "audio/mpeg" || audio.type === "audio/mpeg"
    ? "audio/mpeg"
    : undefined;

  if (!mime || !Number.isFinite(audio.size) || audio.size <= 0) {
    return undefined;
  }

  return {
    url: audio.url,
    mime,
    type: mime,
    size: audio.size,
    ...(typeof audio.title === "string" && audio.title.trim() !== ""
      ? { title: audio.title }
      : {}),
    ...(typeof audio.duration === "number" && Number.isFinite(audio.duration) && audio.duration > 0
      ? { duration: audio.duration }
      : {}),
    ...(typeof audio.uploadedAt === "string" ? { uploadedAt: audio.uploadedAt } : {}),
  };
}

function normalizeProfileModulePlaylistTracks(
  tracks: ProfileModuleConfig["tracks"],
): ProfileModulePlaylistTrack[] {
  if (!Array.isArray(tracks)) {
    return [];
  }

  return tracks
    .slice(0, 50)
    .map(normalizeProfileModulePlaylistTrack)
    .filter(
      (track): track is ProfileModulePlaylistTrack => track !== undefined,
    );
}

function normalizeProfileModulePlaylistTrack(
  track: ProfileModulePlaylistTrack | undefined,
): ProfileModulePlaylistTrack | undefined {
  if (!track || typeof track !== "object") {
    return undefined;
  }

  const title = normalizeProfileModuleTrackText(track.title, 90);

  if (!title) {
    return undefined;
  }

  const artist = normalizeProfileModuleTrackText(track.artist, 90);
  const sourceUrl =
    typeof track.sourceUrl === "string"
      ? normalizeProfileModuleExternalUrl(track.sourceUrl)
      : undefined;
  const audio = normalizeProfileModuleUploadedAudio(track.audio);
  const duration =
    typeof track.duration === "number" &&
    Number.isFinite(track.duration) &&
    track.duration > 0
      ? Math.min(60 * 60 * 4, track.duration)
      : audio?.duration;
  const id = normalizeProfileModuleTrackText(track.id, 80);

  return {
    title,
    ...(artist ? { artist } : {}),
    ...(audio ? { audio } : {}),
    ...(duration ? { duration } : {}),
    ...(id ? { id } : {}),
    ...(sourceUrl ? { sourceUrl } : {}),
  };
}

function normalizeProfileModuleTrackText(
  value: unknown,
  maxLength: number,
): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.replace(/\s+/g, " ").trim();

  return trimmed !== "" && Array.from(trimmed).length <= maxLength
    ? trimmed
    : undefined;
}

function normalizeProfileModuleUploadedVideo(
  video: ProfileModuleConfig["video"],
): ProfileModuleUploadedVideo | undefined {
  if (!video || typeof video.url !== "string") {
    return undefined;
  }

  if (!isUploadedProfileModuleVideoUrl(video.url)) {
    return undefined;
  }

  const mime =
    video.mime === "video/mp4" || video.mime === "video/webm"
      ? video.mime
      : video.type === "video/mp4" || video.type === "video/webm"
        ? video.type
        : undefined;

  if (!mime || !Number.isFinite(video.size) || video.size <= 0) {
    return undefined;
  }

  return {
    url: video.url,
    mime,
    type: mime,
    size: video.size,
    ...(typeof video.title === "string" && video.title.trim() !== ""
      ? { title: video.title }
      : {}),
    ...(typeof video.duration === "number" && Number.isFinite(video.duration) && video.duration > 0
      ? { duration: video.duration }
      : {}),
    ...(typeof video.posterUrl === "string" && video.posterUrl.trim() !== ""
      ? { posterUrl: video.posterUrl }
      : {}),
    ...(typeof video.uploadedAt === "string" ? { uploadedAt: video.uploadedAt } : {}),
  };
}

function normalizeProfileModuleExternalUrl(value: string): string | undefined {
  try {
    const url = new URL(value);

    if (url.protocol !== "https:" || url.username || url.password) {
      return undefined;
    }

    return url.toString();
  } catch {
    return undefined;
  }
}

function isUploadedProfileModuleMediaUrl(value: string): boolean {
  return /^\/uploads\/media\/[0-9]{4}\/[0-9]{2}\/[a-z0-9_-]+\.(?:jpe?g|png|webp|gif)$/.test(value);
}

function isUploadedProfileModuleAudioUrl(value: string): boolean {
  return /^\/uploads\/media\/[0-9]{4}\/[0-9]{2}\/profile_music-[a-z0-9_-]+\.mp3$/.test(value);
}

function isUploadedProfileModuleVideoUrl(value: string): boolean {
  return /^\/uploads\/media\/[0-9]{4}\/[0-9]{2}\/profile_module_video-[a-z0-9_-]+\.(?:mp4|webm)$/.test(value);
}

function normalizeUploadedProfileImageUrl(value: unknown): string | null {
  return typeof value === "string" && isUploadedProfileModuleMediaUrl(value)
    ? value
    : null;
}

function normalizeUploadedProfileVideoUrl(value: unknown): string | null {
  return typeof value === "string" &&
    /^\/uploads\/media\/[0-9]{4}\/[0-9]{2}\/profile_background-[a-z0-9_-]+\.(?:mp4|webm)$/.test(
      value,
    )
    ? value
    : null;
}

function normalizeProfileIntegrationsResult(
  result: ProfileIntegrationsResult,
): ProfileIntegrationsResult {
  return {
    providers: Array.isArray(result.providers)
      ? result.providers
          .map(normalizeProfileIntegrationProviderStatus)
          .filter(isProfileIntegrationProviderStatus)
      : [],
    accounts: Array.isArray(result.accounts)
      ? result.accounts
          .map(normalizeProfileIntegrationAccount)
          .filter(isProfileIntegrationAccount)
      : [],
  };
}

function normalizeProfileIntegrationDiagnostics(
  result: ProfileIntegrationDiagnostics,
): ProfileIntegrationDiagnostics {
  return {
    storageReady: Boolean(result.storageReady),
    encryptionConfigured: Boolean(result.encryptionConfigured),
    encryptionAvailable: Boolean(result.encryptionAvailable),
    cryptoMethod: typeof result.cryptoMethod === "string" ? result.cryptoMethod : null,
    oauthStateExpiresIn:
      typeof result.oauthStateExpiresIn === "number" ? result.oauthStateExpiresIn : 0,
    providers: Array.isArray(result.providers)
      ? result.providers
          .map(normalizeProfileIntegrationDiagnosticsProvider)
          .filter(isProfileIntegrationDiagnosticsProvider)
      : [],
  };
}

function normalizeProfileIntegrationDiagnosticsProvider(
  value: ProfileIntegrationDiagnosticsProvider,
): ProfileIntegrationDiagnosticsProvider | undefined {
  const status = normalizeProfileIntegrationProviderStatus(value);

  if (!status) {
    return undefined;
  }

  return {
    ...status,
    redirectUri: typeof value.redirectUri === "string" ? value.redirectUri : null,
  };
}

function isProfileIntegrationDiagnosticsProvider(
  value: ProfileIntegrationDiagnosticsProvider | undefined,
): value is ProfileIntegrationDiagnosticsProvider {
  return value !== undefined;
}

function normalizeOnboardingState(value: OnboardingState): OnboardingState {
  return {
    steps: Array.isArray(value.steps)
      ? value.steps.map(normalizeOnboardingStep).filter(isOnboardingStep)
      : defaultOnboardingSteps,
    completedSteps: Array.isArray(value.completedSteps)
      ? value.completedSteps.map(normalizeOnboardingStep).filter(isOnboardingStep)
      : [],
    skippedSteps: Array.isArray(value.skippedSteps)
      ? value.skippedSteps.map(normalizeOnboardingStep).filter(isOnboardingStep)
      : [],
    providerLinks: normalizeOnboardingProviderLinks(value.providerLinks),
    finishedAt: typeof value.finishedAt === "string" ? value.finishedAt : null,
    dismissedAt: typeof value.dismissedAt === "string" ? value.dismissedAt : null,
    createdAt: typeof value.createdAt === "string" ? value.createdAt : null,
    updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : null,
  };
}

const defaultOnboardingSteps: OnboardingStep[] = [
  "profile_basics",
  "spotify",
  "youtube",
  "twitch",
  "github",
  "apple_music",
  "profile_canvas",
  "desktop_notifications",
];

function normalizeOnboardingStep(value: unknown): OnboardingStep | undefined {
  return value === "profile_basics" ||
    value === "spotify" ||
    value === "youtube" ||
    value === "twitch" ||
    value === "github" ||
    value === "apple_music" ||
    value === "profile_canvas" ||
    value === "desktop_notifications"
    ? value
    : undefined;
}

function isOnboardingStep(value: OnboardingStep | undefined): value is OnboardingStep {
  return value !== undefined;
}

function normalizeOnboardingProviderLinks(
  value: OnboardingState["providerLinks"],
): OnboardingState["providerLinks"] {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return {};
  }

  const links: OnboardingState["providerLinks"] = {};

  for (const [rawProvider, rawLink] of Object.entries(value)) {
    const provider = normalizeProfileIntegrationProvider(rawProvider);

    if (!provider || typeof rawLink !== "object" || rawLink === null) {
      continue;
    }

    const link = rawLink as Partial<OnboardingProviderLink>;

    if (
      link.provider !== provider ||
      typeof link.url !== "string" ||
      typeof link.resourceType !== "string" ||
      typeof link.resourceId !== "string"
    ) {
      continue;
    }

    links[provider] = {
      provider,
      url: link.url,
      resourceType: link.resourceType,
      resourceId: link.resourceId,
      savedAt: typeof link.savedAt === "string" ? link.savedAt : null,
    };
  }

  return links;
}

function normalizeProfileIntegrationProviderStatus(
  value: ProfileIntegrationProviderStatus,
): ProfileIntegrationProviderStatus | undefined {
  const provider = normalizeProfileIntegrationProvider(value.provider);

  if (!provider) {
    return undefined;
  }

  return {
    provider,
    configured: Boolean(value.configured),
    oauthEnabled: Boolean(value.oauthEnabled),
    linkSupported:
      typeof value.linkSupported === "boolean" ? value.linkSupported : true,
    metadataEnabled: Boolean(value.metadataEnabled),
    missingConfigKeys: Array.isArray(value.missingConfigKeys)
      ? value.missingConfigKeys.filter(
          (key): key is string => typeof key === "string" && key.trim() !== "",
        )
      : [],
  };
}

function isProfileIntegrationProviderStatus(
  value: ProfileIntegrationProviderStatus | undefined,
): value is ProfileIntegrationProviderStatus {
  return value !== undefined;
}

function normalizeProfileIntegrationAccount(
  value: ProfileIntegrationAccount,
): ProfileIntegrationAccount | undefined {
  const provider = normalizeProfileIntegrationProvider(value.provider);

  if (!provider || typeof value.providerAccountId !== "string") {
    return undefined;
  }

  return {
    provider,
    providerAccountId: value.providerAccountId,
    providerHandle:
      typeof value.providerHandle === "string" ? value.providerHandle : null,
    displayName: typeof value.displayName === "string" ? value.displayName : null,
    avatarUrl: typeof value.avatarUrl === "string" ? value.avatarUrl : null,
    scopes: Array.isArray(value.scopes)
      ? value.scopes.filter((scope): scope is string => typeof scope === "string")
      : [],
    tokenExpiresAt:
      typeof value.tokenExpiresAt === "string" ? value.tokenExpiresAt : null,
    connectedAt: typeof value.connectedAt === "string" ? value.connectedAt : null,
    refreshedAt: typeof value.refreshedAt === "string" ? value.refreshedAt : null,
    revokedAt: typeof value.revokedAt === "string" ? value.revokedAt : null,
    lastError: typeof value.lastError === "string" ? value.lastError : null,
    errorAt: typeof value.errorAt === "string" ? value.errorAt : null,
  };
}

function isProfileIntegrationAccount(
  value: ProfileIntegrationAccount | undefined,
): value is ProfileIntegrationAccount {
  return value !== undefined;
}

function normalizeProfileIntegrationProvider(
  value: unknown,
): ProfileIntegrationProvider | undefined {
  return value === "spotify" ||
    value === "apple_music" ||
    value === "youtube" ||
    value === "twitch" ||
    value === "github"
    ? value
    : undefined;
}

function normalizeProfileIntegrationSuggestionsResult(
  value: ProfileIntegrationSuggestionsResult,
): ProfileIntegrationSuggestionsResult {
  const provider = normalizeProfileIntegrationProvider(value.provider) ?? "spotify";
  const status =
    normalizeProfileIntegrationProviderStatus(value.status) ?? {
      provider,
      configured: false,
      oauthEnabled: false,
    };
  const account = value.account
    ? normalizeProfileIntegrationAccount(value.account)
    : null;

  return {
    provider,
    status,
    account: account ?? null,
    items: Array.isArray(value.items)
      ? value.items
          .map(normalizeProfileIntegrationSuggestion)
          .filter(isProfileIntegrationSuggestion)
      : [],
    message: typeof value.message === "string" ? value.message : null,
    generatedAt: typeof value.generatedAt === "string" ? value.generatedAt : null,
  };
}

function normalizeProfileIntegrationSuggestion(
  value: ProfileIntegrationSuggestion,
): ProfileIntegrationSuggestion | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const sourceUrl =
    typeof value.sourceUrl === "string"
      ? normalizeProfileModuleExternalUrl(value.sourceUrl)
      : undefined;
  const card = normalizeProfileIntegrationCard(value.card);

  if (
    typeof value.id !== "string" ||
    typeof value.label !== "string" ||
    !sourceUrl ||
    (value.moduleType !== "creator_live" && value.moduleType !== "music")
  ) {
    return undefined;
  }

  return {
    id: value.id,
    label: value.label,
    description:
      typeof value.description === "string" ? value.description : "",
    sourceUrl,
    moduleType: value.moduleType,
    moduleTitle:
      typeof value.moduleTitle === "string" ? value.moduleTitle : null,
    card: card ?? null,
  };
}

function isProfileIntegrationSuggestion(
  value: ProfileIntegrationSuggestion | undefined,
): value is ProfileIntegrationSuggestion {
  return value !== undefined;
}

function normalizeProfileIntegrationCard(
  value: unknown,
): ProfileIntegrationCard | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const card = value as ProfileIntegrationCard;
  const provider = normalizeProfileIntegrationProvider(card.provider);
  const sourceUrl =
    typeof card.sourceUrl === "string"
      ? normalizeProfileModuleExternalUrl(card.sourceUrl)
      : undefined;

  if (
    !provider ||
    !sourceUrl ||
    typeof card.resourceId !== "string" ||
    typeof card.resourceKey !== "string" ||
    typeof card.resourceType !== "string"
  ) {
    return undefined;
  }

  return {
    provider,
    resourceType: card.resourceType,
    resourceId: card.resourceId,
    resourceKey: card.resourceKey,
    sourceUrl,
    metadata: normalizeProfileIntegrationMetadata(card.metadata),
    embed: normalizeProfileIntegrationEmbed(card.embed) ?? null,
    apiBacked: Boolean(card.apiBacked),
    fetchedAt: typeof card.fetchedAt === "string" ? card.fetchedAt : null,
    expiresAt: typeof card.expiresAt === "string" ? card.expiresAt : null,
    staleAt: typeof card.staleAt === "string" ? card.staleAt : null,
    stale: Boolean(card.stale),
    lastError: typeof card.lastError === "string" ? card.lastError : null,
  };
}

function normalizeProfileIntegrationMetadata(
  value: ProfileIntegrationCard["metadata"],
): ProfileIntegrationCard["metadata"] {
  const metadata =
    value && typeof value === "object"
      ? value
      : ({} as ProfileIntegrationCard["metadata"]);

  return {
    title: typeof metadata.title === "string" ? metadata.title : null,
    subtitle: typeof metadata.subtitle === "string" ? metadata.subtitle : null,
    description:
      typeof metadata.description === "string" ? metadata.description : null,
    imageUrl:
      typeof metadata.imageUrl === "string" &&
      normalizeProfileModuleExternalUrl(metadata.imageUrl)
        ? metadata.imageUrl
        : null,
    live: Boolean(metadata.live),
    liveFetchedAt:
      typeof metadata.liveFetchedAt === "string" ? metadata.liveFetchedAt : null,
    recentLabel:
      typeof metadata.recentLabel === "string" ? metadata.recentLabel : null,
    recentFetchedAt:
      typeof metadata.recentFetchedAt === "string"
        ? metadata.recentFetchedAt
        : null,
    stats:
      metadata.stats && typeof metadata.stats === "object"
        ? metadata.stats
        : {},
  };
}

function normalizeProfileIntegrationEmbed(
  value: ProfileIntegrationCard["embed"] | undefined,
): ProfileIntegrationCard["embed"] {
  if (!value || value.type !== "iframe" || typeof value.src !== "string") {
    return null;
  }

  const safeSrc = normalizeProfileIntegrationEmbedSrc(value.src);

  if (!safeSrc || typeof value.title !== "string") {
    return null;
  }

  return {
    type: "iframe",
    src: safeSrc,
    title: value.title,
    ...(typeof value.allow === "string" ? { allow: value.allow } : {}),
    ...(typeof value.height === "number"
      ? { height: Math.min(360, Math.max(120, value.height)) }
      : {}),
  };
}

function normalizeProfileIntegrationEmbedSrc(value: string): string | undefined {
  try {
    const url = new URL(value);
    const allowedHosts = new Set([
      "open.spotify.com",
      "embed.music.apple.com",
      "www.youtube-nocookie.com",
      "player.twitch.tv",
    ]);

    if (url.protocol !== "https:" || !allowedHosts.has(url.hostname)) {
      return undefined;
    }

    return url.toString();
  } catch {
    return undefined;
  }
}

function normalizeUserBadge(userBadge: ApiUserBadge): UserBadge {
  return {
    ...userBadge,
    badge: normalizeBadgeDefinition(userBadge.badge),
    reason: userBadge.reason ?? null,
    featuredOrder: userBadge.featuredOrder ?? null,
    isVisible: userBadge.isVisible ?? true,
    grantedBy: userBadge.grantedBy ?? null,
  };
}

function normalizeBadgeDefinition(badge: ApiBadgeDefinition): BadgeDefinition {
  return {
    ...badge,
    description: badge.description ?? null,
    icon: badge.icon ?? null,
    accent: badge.accent ?? null,
    isActive: badge.isActive ?? true,
    createdAt: badge.createdAt ?? null,
  };
}

function normalizeHandle(handle: string): string {
  return handle.replace(/^@/, "").toLowerCase();
}

function normalizeDiscoverPerson(person: DiscoverPerson): DiscoverPerson {
  const isRetiredThiaProfile =
    person.handle === "thia" &&
    person.bioSnippet ===
      "A secondary profile on the platform, present without making the whole room about her.";

  return {
    ...person,
    bioSnippet: isRetiredThiaProfile
      ? "Founder profile for thia.lol."
      : person.bioSnippet,
    starCount: person.starCount ?? 0,
  };
}

function normalizeTextEntitiesByField(value: unknown): { body?: RichTextEntity[] } {
  if (!value || typeof value !== "object") {
    return {};
  }

  const body = normalizeRichTextEntities((value as { body?: unknown }).body);

  return body.length > 0 ? { body } : {};
}

function normalizeRichTextEntities(value: unknown): RichTextEntity[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map(normalizeRichTextEntity)
    .filter((entity): entity is RichTextEntity => entity !== undefined)
    .sort((first, second) => first.start - second.start);
}

function normalizeRichTextEntity(value: unknown): RichTextEntity | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const entity = value as {
    type?: unknown;
    start?: unknown;
    length?: unknown;
    text?: unknown;
    mention?: { handle?: unknown; user?: unknown };
    link?: { url?: unknown; card?: unknown };
  };

  if (
    typeof entity.start !== "number" ||
    typeof entity.length !== "number" ||
    entity.start < 0 ||
    entity.length <= 0 ||
    typeof entity.text !== "string"
  ) {
    return undefined;
  }

  if (
    entity.type === "mention" &&
    entity.mention &&
    typeof entity.mention.handle === "string" &&
    isUserLike(entity.mention.user)
  ) {
    return {
      type: "mention",
      start: entity.start,
      length: entity.length,
      text: entity.text,
      mention: {
        handle: entity.mention.handle,
        user: entity.mention.user,
      },
    };
  }

  if (
    entity.type === "link" &&
    entity.link &&
    typeof entity.link.url === "string"
  ) {
    const url = normalizeProfileModuleExternalUrl(entity.link.url);

    if (!url) {
      return undefined;
    }

    const card = normalizeRichLinkCard(entity.link.card);

    return {
      type: "link",
      start: entity.start,
      length: entity.length,
      text: entity.text,
      link: {
        url,
        ...(card ? { card } : {}),
      },
    };
  }

  return undefined;
}

function isUserLike(value: unknown): value is User {
  if (!value || typeof value !== "object") {
    return false;
  }

  const user = value as User;

  return (
    typeof user.id === "number" &&
    typeof user.handle === "string" &&
    typeof user.displayName === "string" &&
    typeof user.initials === "string" &&
    typeof user.aura === "string"
  );
}

function normalizeRichLinkCard(value: unknown): RichLinkCard | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const provider = (value as { provider?: unknown }).provider;

  if (provider !== "website") {
    const integration = normalizeProfileIntegrationCard(value);
    return integration ? { ...integration } : undefined;
  }

  const card = value as RichLinkCard;
  const sourceUrl =
    typeof card.sourceUrl === "string"
      ? normalizeProfileModuleExternalUrl(card.sourceUrl)
      : undefined;

  if (
    !sourceUrl ||
    typeof card.resourceType !== "string" ||
    typeof card.resourceId !== "string" ||
    typeof card.resourceKey !== "string"
  ) {
    return undefined;
  }

  return {
    provider: "website",
    resourceType: card.resourceType,
    resourceId: card.resourceId,
    resourceKey: card.resourceKey,
    sourceUrl,
    metadata: normalizeProfileIntegrationMetadata(card.metadata),
    embed: null,
    apiBacked: Boolean(card.apiBacked),
    fetchedAt: typeof card.fetchedAt === "string" ? card.fetchedAt : null,
    expiresAt: typeof card.expiresAt === "string" ? card.expiresAt : null,
    staleAt: typeof card.staleAt === "string" ? card.staleAt : null,
    stale: Boolean(card.stale),
    lastError: typeof card.lastError === "string" ? card.lastError : null,
  };
}

function normalizePost(post: ApiPost): Post {
  const normalized: Post = {
    id: post.id,
    author: post.author,
    room: post.room ? normalizeRoom(post.room) : null,
    body: post.body,
    bodyFormat: post.bodyFormat === "markdown" ? "markdown" : "plain",
    contentVersion: typeof post.contentVersion === "number" && Number.isFinite(post.contentVersion)
      ? post.contentVersion
      : 1,
    bodyEntities: normalizeRichTextEntities(post.bodyEntities),
    createdAt: formatRelativeTime(post.createdAt),
    mood: post.mood,
    parentId: post.parentId ?? null,
    commentCount: post.commentCount ?? 0,
    reactions: post.reactions,
    likeCount: post.likeCount ?? post.reactions.glow,
    likedByCurrentUser: post.likedByCurrentUser ?? false,
    reblogCount: post.reblogCount ?? 0,
    rebloggedByMe: post.rebloggedByMe ?? post.rebloggedByCurrentUser ?? false,
    rebloggedByCurrentUser: post.rebloggedByCurrentUser ?? post.rebloggedByMe ?? false,
    rebloggedBy: post.rebloggedBy ?? null,
    rebloggedAt: post.rebloggedAt ?? null,
    updatedAt: post.updatedAt ?? null,
    socialContext: post.socialContext ?? {
      authorRelationship: null,
      likedByFollowedCount: 0,
    },
  };

  if (post.profile) {
    normalized.profile = normalizeProfile(post.profile);
  }

  if (post.publicId) {
    normalized.publicId = post.publicId;
  }

  if (post.canonicalPath) {
    normalized.canonicalPath = post.canonicalPath;
  }

  if (post.canonicalUrl) {
    normalized.canonicalUrl = post.canonicalUrl;
  }

  if (post.mediaUrl) {
    normalized.mediaUrl = post.mediaUrl;
    normalized.mediaType = post.mediaType ?? (/\.(?:mp4|webm)$/iu.test(post.mediaUrl) ? "video" : "image");
    normalized.mediaMime = post.mediaMime ?? null;
    normalized.mediaPosterUrl = post.mediaPosterUrl ?? null;
  }

  normalized.attachments = normalizePostAttachments(post.attachments);

  return normalized;
}

function normalizePostAttachments(value: unknown): PostAttachment[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((attachment, index) => normalizePostAttachment(attachment, index + 1))
    .filter((attachment): attachment is PostAttachment => attachment !== undefined);
}

function normalizePostAttachment(value: unknown, fallbackPosition: number): PostAttachment | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return undefined;
  }

  const attachment = value as Record<string, unknown>;
  const kind = attachment.kind;

  if (kind !== "image" && kind !== "video" && kind !== "audio" && kind !== "integration" && kind !== "gif") {
    return undefined;
  }

  const position = typeof attachment.position === "number" && Number.isFinite(attachment.position)
    ? attachment.position
    : fallbackPosition;
  const card = ("card" in attachment && attachment.card !== undefined ? attachment.card : null) as Exclude<
    PostAttachment["card"],
    undefined
  >;

  return {
    ...(typeof attachment.id === "number" ? { id: attachment.id } : {}),
    position,
    kind,
    url: typeof attachment.url === "string" ? attachment.url : null,
    mime: typeof attachment.mime === "string" ? attachment.mime : null,
    sizeBytes: numberOrNull(attachment.sizeBytes),
    width: numberOrNull(attachment.width),
    height: numberOrNull(attachment.height),
    durationSeconds: numberOrNull(attachment.durationSeconds),
    posterUrl: typeof attachment.posterUrl === "string" ? attachment.posterUrl : null,
    provider: typeof attachment.provider === "string" ? attachment.provider : null,
    resourceType: typeof attachment.resourceType === "string" ? attachment.resourceType : null,
    resourceId: typeof attachment.resourceId === "string" ? attachment.resourceId : null,
    resourceKey: typeof attachment.resourceKey === "string" ? attachment.resourceKey : null,
    sourceUrl: typeof attachment.sourceUrl === "string" ? attachment.sourceUrl : null,
    card,
    createdAt: typeof attachment.createdAt === "string" ? attachment.createdAt : null,
    updatedAt: typeof attachment.updatedAt === "string" ? attachment.updatedAt : null,
  };
}

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function normalizePostShareSummary(post: ApiPostShareSummary): PostShareSummary {
  return {
    ...post,
    attachments: normalizePostAttachments(post.attachments),
    room: post.room ? normalizeRoom(post.room) : null,
  };
}

function normalizeChatMessage(message: ChatMessage): ChatMessage {
  return {
    ...message,
    bodyEntities: normalizeRichTextEntities(message.bodyEntities),
    attachments: (message.attachments ?? []).map((attachment) =>
      attachment.type === "post"
        ? {
            type: "post",
            post: attachment.post
              ? normalizePostShareSummary(attachment.post as ApiPostShareSummary)
              : null,
          }
        : attachment,
    ),
  };
}

function normalizeNotification(notification: NotificationItem): NotificationItem {
  return {
    ...notification,
    room: notification.room ? normalizeRoom(notification.room) : null,
  };
}

function normalizePushNotificationStatus(value: PushNotificationStatus): PushNotificationStatus {
  const subscriptions = Array.isArray(value.subscriptions)
    ? value.subscriptions.map(normalizePushSubscriptionSummary)
    : [];
  const diagnostics =
    typeof value.diagnostics === "object" && value.diagnostics !== null
      ? value.diagnostics
      : {
          missingConfigKeys: [],
          curlAvailable: false,
          opensslAvailable: false,
        };

  const normalized: PushNotificationStatus = {
    supported: Boolean(value.supported),
    configured: Boolean(value.configured),
    storageReady: Boolean(value.storageReady),
    publicKey: typeof value.publicKey === "string" ? value.publicKey : null,
    subject: typeof value.subject === "string" ? value.subject : "",
    enabled: Boolean(value.enabled),
    subscriptionCount:
      typeof value.subscriptionCount === "number"
        ? value.subscriptionCount
        : subscriptions.filter((subscription) => !subscription.disabledAt).length,
    subscriptions,
    diagnostics: {
      missingConfigKeys: Array.isArray(diagnostics.missingConfigKeys)
        ? diagnostics.missingConfigKeys.filter(
            (key): key is string => typeof key === "string",
          )
        : [],
      curlAvailable: Boolean(diagnostics.curlAvailable),
      opensslAvailable: Boolean(diagnostics.opensslAvailable),
    },
  };

  if (typeof value.lastSend === "object" && value.lastSend !== null) {
    normalized.lastSend = {
      attempted: Number(value.lastSend.attempted ?? 0),
      sent: Number(value.lastSend.sent ?? 0),
      failed: Number(value.lastSend.failed ?? 0),
      disabled: Number(value.lastSend.disabled ?? 0),
    };
  }

  return normalized;
}

function normalizePushSubscriptionSummary(
  value: PushSubscriptionSummary,
): PushSubscriptionSummary {
  return {
    id: Number(value.id),
    endpointHash: String(value.endpointHash ?? ""),
    userAgent: typeof value.userAgent === "string" ? value.userAgent : null,
    lastSuccessAt:
      typeof value.lastSuccessAt === "string" ? value.lastSuccessAt : null,
    lastErrorAt: typeof value.lastErrorAt === "string" ? value.lastErrorAt : null,
    lastError: typeof value.lastError === "string" ? value.lastError : null,
    failureCount: Number(value.failureCount ?? 0),
    disabledAt: typeof value.disabledAt === "string" ? value.disabledAt : null,
    createdAt: typeof value.createdAt === "string" ? value.createdAt : null,
    updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : null,
  };
}

const retiredStarterPostBodies = new Set([
  "The nicest launch state might be one where the platform feels awake before it asks anyone to perform.",
  "A good room has affordances for entering, leaving, returning, and being forgiven for being quiet.",
  "Tonight's note: make the interface feel like it notices pressure without demanding speed.",
  "Pinned a small loop for anyone writing after midnight. It does not solve the work. It makes the work kinder.",
]);

function isVisiblePost(post: ApiPost): boolean {
  return !retiredStarterPostBodies.has(post.body);
}

const retiredStarterRoomSlugs = new Set([
  "soft-launch",
  "moon-table",
  "garden-protocol",
  "afterglow",
]);

function isVisibleRoom(room: ApiRoom): boolean {
  return !retiredStarterRoomSlugs.has(room.slug);
}

function adminActionBody(
  input: AdminActionInput & { status?: "reviewed" | "dismissed" | "actioned" },
): Record<string, unknown> {
  const body: Record<string, unknown> = {};

  if (input.reportId !== undefined) {
    body.reportId = input.reportId;
  }

  if (input.notes) {
    body.notes = input.notes;
  }

  if (input.status) {
    body.status = input.status;
  }

  return body;
}
