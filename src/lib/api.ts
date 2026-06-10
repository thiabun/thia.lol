import type {
  DiscoverFeed,
  DiscoverPerson,
  HomeFeed,
  Post,
  Profile,
  ProfileConnection,
  PublicStats,
  ReactionCounts,
  Room,
} from "./types";
import { apiDelete, apiGet, apiPatch, apiPost } from "./apiClient";

type ApiRoom = Room & {
  description?: string;
  visibility?: string;
  createdBy?: number | null;
  postCount?: number;
  latestActivityAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

type ApiProfile = Profile & {
  avatarUrl?: string | null;
  createdAt?: string;
  updatedAt?: string;
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
};

export type UpdatePostInput = {
  body?: string;
  roomSlug?: string;
  parentId?: number | null;
  status?: "published" | "hidden" | "removed";
};

export type DeletePostResult = {
  id: number;
  status: "removed";
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

export type FollowRelationship = {
  isFollowing: boolean;
  isFollowedBy: boolean;
  isMoot: boolean;
  followerCount: number;
  followingCount: number;
  mootCount?: number;
};

export type ReportReason =
  | "spam"
  | "harassment"
  | "abuse"
  | "self_harm"
  | "illegal"
  | "other";

export type ModerationReportStatus =
  | "open"
  | "reviewing"
  | "resolved"
  | "dismissed";

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

export type ModerationReport = {
  id: number;
  reason: ReportReason;
  details: string | null;
  status: ModerationReportStatus;
  createdAt: string;
  updatedAt: string;
  reviewedAt: string | null;
  reporter: ModerationUser | null;
  reportedUser: ModerationUser | null;
  reviewedBy: ModerationUser | null;
  post: ModerationPost | null;
  actionCount: number;
};

export type CreateReportInput = {
  reason: ReportReason;
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
  input: Pick<CreatePostInput, "body">,
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

export function createReport(
  input: CreateReportInput,
  csrfToken: string,
): Promise<ModerationReport> {
  const body: Record<string, unknown> = { reason: input.reason };

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
  input: AdminActionInput & { status?: "resolved" | "dismissed" },
  csrfToken: string,
): Promise<ModerationReport> {
  return apiPost<ModerationReport>(
    `/admin/reports/${reportId}/resolve`,
    adminActionBody(input),
    csrfToken,
  );
}

function normalizeRoom(room: ApiRoom): Room {
  return {
    id: room.id,
    slug: room.slug,
    name: room.name,
    summary: room.summary ?? room.description ?? "",
    description: room.description ?? room.summary ?? "",
    mood: room.mood,
    members: room.members,
    live: room.live,
    accent: room.accent,
    visibility: room.visibility ?? "public",
    createdBy: room.createdBy ?? null,
    owner: room.owner ?? null,
    postCount: room.postCount ?? 0,
    latestActivityAt: room.latestActivityAt ?? null,
    createdAt: room.createdAt ?? null,
    updatedAt: room.updatedAt ?? null,
  };
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
    links: profile.links,
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
    rebloggedByCurrentUser: post.rebloggedByCurrentUser ?? false,
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

function formatRelativeTime(value: string): string {
  const parsed = new Date(value.includes("T") ? value : value.replace(" ", "T"));

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  const seconds = Math.round((parsed.getTime() - Date.now()) / 1000);
  const absSeconds = Math.abs(seconds);

  if (absSeconds < 60) {
    return "now";
  }

  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ["year", 60 * 60 * 24 * 365],
    ["month", 60 * 60 * 24 * 30],
    ["day", 60 * 60 * 24],
    ["hour", 60 * 60],
    ["minute", 60],
  ];

  const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  const [unit, divisor] =
    units.find(([, unitSeconds]) => absSeconds >= unitSeconds) ?? units.at(-1)!;

  return formatter.format(Math.round(seconds / divisor), unit);
}

function adminActionBody(
  input: AdminActionInput & { status?: "resolved" | "dismissed" },
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
