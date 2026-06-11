import type {
  BadgeDefinition,
  DiscoverFeed,
  DiscoverPerson,
  ChatConversation,
  ChatMessage,
  ChatMessagesResult,
  ChatMoot,
  HomeFeed,
  NotificationItem,
  NotificationsResult,
  Post,
  Profile,
  ProfileBadgesResult,
  ProfileConnection,
  ProfileExternalConnection,
  PublicStats,
  ReactionCounts,
  Room,
  RoomMember,
  UserBadge,
} from "./types";
import { apiDelete, apiGet, apiPatch, apiPost, apiUpload } from "./apiClient";
import { formatRelativeTime } from "./dates";
import { normalizeProfileConnection } from "./profileConnections";

type ApiRoom = Room & {
  description?: string;
  visibility?: string;
  memberCount?: number;
  createdBy?: number | null;
  iconUrl?: string | null;
  bannerUrl?: string | null;
  rules?: string;
  joinedByMe?: boolean;
  myRoomRole?: Room["myRoomRole"];
  postCount?: number;
  latestActivityAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

type ApiProfile = Profile & {
  avatarUrl?: string | null;
  createdAt?: string;
  updatedAt?: string;
  links?: unknown[];
};

type ApiBadgeDefinition = BadgeDefinition;

type ApiUserBadge = UserBadge;

type ApiProfileBadgesResult = ProfileBadgesResult;

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

export type CreatePostInput = {
  body: string;
  roomSlug?: string;
  parentId?: number;
  mediaUrl?: string | null;
};

export type UpdatePostInput = {
  body?: string;
  roomSlug?: string;
  parentId?: number | null;
  mediaUrl?: string | null;
  status?: "published" | "hidden" | "removed";
};

export type ImageUploadPurpose =
  | "avatar"
  | "banner"
  | "profile_background"
  | "post_media"
  | "room_icon"
  | "room_banner";

export type UploadedImage = {
  url: string;
  width: number;
  height: number;
  mime: "image/webp";
  type: "image/webp";
  size: number;
  purpose: ImageUploadPurpose;
};

export type UpdateProfileInput = {
  displayName?: string;
  bio?: string | null;
  location?: string | null;
  avatarUrl?: string | null;
  bannerUrl?: string | null;
  profileBackground?: string | null;
  profileAccent?: string | null;
  profileTheme?: string | null;
  links?: ProfileExternalConnection[];
  traits?: string[];
};

export type RoomInput = {
  name: string;
  slug?: string;
  summary: string;
  mood?: string | null;
  accent?: string | null;
  iconUrl?: string | null;
  bannerUrl?: string | null;
  rules?: string | null;
};

export type UpdateFeaturedBadgesInput = {
  featuredBadgeIds: number[];
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

export type ReactionType = keyof ReactionCounts;

export type ReactionResult = {
  postId: number;
  reactions: ReactionCounts;
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

export type FollowRelationship = {
  isFollowing: boolean;
  isFollowedBy: boolean;
  isMoot: boolean;
  followerCount: number;
  followingCount: number;
  mootCount?: number;
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

export type ReportReason = ReportCategory;

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
  reason: ReportReason;
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

export function getFeed(): Promise<Post[]> {
  return apiGet<ApiPost[]>("/posts").then((items) =>
    items.filter(isVisiblePost).map(normalizePost),
  );
}

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

export function joinRoom(slug: string, csrfToken: string): Promise<Room> {
  return apiPost<ApiRoom>(
    `/rooms/${encodeURIComponent(slug)}/join`,
    {},
    csrfToken,
  ).then(normalizeRoom);
}

export function leaveRoom(slug: string, csrfToken: string): Promise<Room> {
  return apiDelete<ApiRoom>(
    `/rooms/${encodeURIComponent(slug)}/join`,
    csrfToken,
  ).then(normalizeRoom);
}

export function getRoomMembers(slug: string): Promise<RoomMember[]> {
  return apiGet<RoomMember[]>(`/rooms/${encodeURIComponent(slug)}/members`);
}

export function addRoomModerator(
  slug: string,
  handle: string,
  csrfToken: string,
): Promise<RoomMember[]> {
  return apiPost<RoomMember[]>(
    `/rooms/${encodeURIComponent(slug)}/moderators`,
    { handle },
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
    { handle },
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

  return apiPost<FollowRelationship>(
    `/profiles/${encodeURIComponent(normalized)}/follow`,
    {},
    csrfToken,
  );
}

export function unfollowProfile(
  handle: string,
  csrfToken: string,
): Promise<FollowRelationship> {
  const normalized = normalizeHandle(handle);

  return apiDelete<FollowRelationship>(
    `/profiles/${encodeURIComponent(normalized)}/follow`,
    csrfToken,
  );
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

export function updateMyProfile(
  input: UpdateProfileInput,
  csrfToken: string,
): Promise<Profile> {
  return apiPatch<ApiProfile>("/me/profile", input, csrfToken).then(normalizeProfile);
}

export function createPost(
  input: CreatePostInput,
  csrfToken: string,
): Promise<Post> {
  return apiPost<ApiPost>("/posts", input, csrfToken).then(normalizePost);
}

export function getPostReplies(postId: number): Promise<Post[]> {
  return apiGet<ApiPost[]>(`/posts/${postId}/replies`).then((items) =>
    items.filter(isVisiblePost).map(normalizePost),
  );
}

export function createPostReply(
  postId: number,
  input: Pick<CreatePostInput, "body" | "mediaUrl">,
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

export function addReaction(
  postId: number,
  type: ReactionType,
  csrfToken: string,
): Promise<ReactionCounts> {
  return apiPost<ReactionResult>(
    `/posts/${postId}/reactions`,
    { type },
    csrfToken,
  ).then((result) => result.reactions);
}

export function removeReaction(
  postId: number,
  type: ReactionType,
  csrfToken: string,
): Promise<ReactionCounts> {
  return apiDelete<ReactionResult>(
    `/posts/${postId}/reactions/${encodeURIComponent(type)}`,
    csrfToken,
  ).then((result) => result.reactions);
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
  );
}

export function sendChatMessage(
  conversationId: number,
  body: string,
  csrfToken: string,
): Promise<ChatMessage> {
  return apiPost<ChatMessage>(
    `/chat/conversations/${conversationId}/messages`,
    { body },
    csrfToken,
  );
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
    accent: room.accent || "var(--accent-sun)",
    iconUrl: room.iconUrl ?? null,
    bannerUrl: room.bannerUrl ?? null,
    rules: room.rules ?? "",
    visibility: room.visibility ?? "public",
    createdBy: room.createdBy ?? null,
    owner: room.owner ?? null,
    joinedByMe: room.joinedByMe ?? false,
    myRoomRole: room.myRoomRole ?? null,
    postCount: room.postCount ?? 0,
    latestActivityAt: room.latestActivityAt ?? null,
    createdAt: room.createdAt ?? null,
    updatedAt: room.updatedAt ?? null,
  };
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

  if (input.accent !== undefined) {
    body.accent = input.accent || undefined;
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

  body.visibility = "public";

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
    location: profile.location,
    bannerUrl: profile.bannerUrl ?? null,
    profileAccent: profile.profileAccent ?? null,
    profileBackground: profile.profileBackground ?? null,
    profileTheme: profile.profileTheme ?? null,
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
    },
    followerCount: profile.followerCount ?? profile.stats.followers ?? 0,
    followingCount: profile.followingCount ?? profile.stats.following ?? 0,
    mootCount: profile.mootCount ?? profile.stats.moots ?? 0,
    isFollowing: profile.isFollowing ?? false,
    isFollowedBy: profile.isFollowedBy ?? false,
    isMoot: profile.isMoot ?? false,
    createdAt: profile.createdAt ?? null,
    updatedAt: profile.updatedAt ?? null,
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
  };
}

function normalizePost(post: ApiPost): Post {
  const normalized: Post = {
    id: post.id,
    author: post.author,
    room: post.room ? normalizeRoom(post.room) : makeFallbackRoom(),
    body: post.body,
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
    socialContext: post.socialContext ?? {
      authorRelationship: null,
      likedByFollowedCount: 0,
    },
  };

  if (post.mediaUrl) {
    normalized.mediaUrl = post.mediaUrl;
  }

  return normalized;
}

function normalizeNotification(notification: NotificationItem): NotificationItem {
  return {
    ...notification,
    room: notification.room ? normalizeRoom(notification.room) : null,
  };
}

function makeFallbackRoom(): Pick<Room, "slug" | "name" | "accent"> {
  return {
    slug: "profile",
    name: "Profile feed",
    accent: "var(--accent-frost)",
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
