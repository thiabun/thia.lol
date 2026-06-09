import { discoverItems, profiles } from "../data/mockData";
import type {
  DiscoverItem,
  Post,
  Profile,
  PublicStats,
  ReactionCounts,
  Room,
} from "./types";
import { apiDelete, apiGet, apiPatch, apiPost } from "./apiClient";

type ApiRoom = Room & {
  visibility?: string;
  createdAt?: string;
  updatedAt?: string;
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
  return apiGet<ApiPost[]>("/posts").then((items) => items.map(normalizePost));
}

export function getDiscover(): Promise<DiscoverItem[]> {
  return Promise.resolve(discoverItems);
}

export function getRooms(): Promise<Room[]> {
  return apiGet<ApiRoom[]>("/rooms").then((items) => items.map(normalizeRoom));
}

export function getStats(): Promise<PublicStats> {
  return apiGet<PublicStats>("/stats");
}

export function getRoom(idOrSlug: string): Promise<Room | undefined> {
  return apiGet<ApiRoom>(`/rooms/${encodeURIComponent(idOrSlug)}`).then(normalizeRoom);
}

export function getProfile(handle: string): Promise<Profile> {
  const normalized = handle.replace(/^@/, "").toLowerCase();

  return apiGet<ApiProfile>(`/profiles/${encodeURIComponent(normalized)}`).then(
    normalizeProfile,
  );
}

export function createPost(
  input: CreatePostInput,
  csrfToken: string,
): Promise<Post> {
  return apiPost<ApiPost>("/posts", input, csrfToken).then(normalizePost);
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

export function getFallbackProfile(handle: string): Profile {
  const normalized = handle.replace(/^@/, "").toLowerCase();

  return (
    profiles.find((profile) => profile.user.handle === normalized) ??
    makeFallbackProfile(normalized)
  );
}

function makeFallbackProfile(handle: string): Profile {
  const cleanHandle = handle || "guest";
  const displayName = cleanHandle
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

  return {
    user: {
      id: 999,
      handle: cleanHandle,
      displayName: displayName || "Guest Profile",
      initials: (displayName || cleanHandle).slice(0, 2).toUpperCase(),
      aura: "tide",
    },
    bio: "A profile waiting for its first post.",
    location: "thia.lol",
    links: [],
    traits: ["new", "quiet", "unclaimed"],
    stats: { posts: 0, rooms: 0, echoes: 0 },
  };
}

function normalizeRoom(room: ApiRoom): Room {
  return {
    id: room.id,
    slug: room.slug,
    name: room.name,
    summary: room.summary,
    mood: room.mood,
    members: room.members,
    live: room.live,
    accent: room.accent,
  };
}

function normalizeProfile(profile: ApiProfile): Profile {
  return {
    user: profile.user,
    bio: profile.bio,
    location: profile.location,
    links: profile.links,
    traits: profile.traits,
    stats: profile.stats,
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
    reactions: post.reactions,
    likeCount: post.likeCount ?? post.reactions.glow,
    likedByCurrentUser: post.likedByCurrentUser ?? false,
  };

  if (post.mediaUrl) {
    normalized.mediaUrl = post.mediaUrl;
  }

  return normalized;
}

function makeFallbackRoom(): Pick<Room, "slug" | "name" | "accent"> {
  return {
    slug: "platform",
    name: "Platform",
    accent: "var(--accent-frost)",
  };
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
