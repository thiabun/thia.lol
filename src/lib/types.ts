export type ThemeName = "sunveil" | "frostveil";

export type User = {
  id: number;
  handle: string;
  displayName: string;
  initials: string;
  aura: string;
  avatarUrl?: string | null;
};

export type Profile = {
  user: User;
  bio: string;
  location: string;
  bannerUrl?: string | null;
  profileAccent?: string | null;
  profileBackground?: string | null;
  profileTheme?: string | null;
  links: string[];
  traits: string[];
  stats: {
    posts: number;
    replies: number;
    rooms: number;
    echoes: number;
    followers: number;
    following: number;
    moots: number;
  };
  followerCount: number;
  followingCount: number;
  mootCount: number;
  isFollowing: boolean;
  isFollowedBy: boolean;
  isMoot: boolean;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type ProfileConnection = {
  handle: string;
  displayName: string;
  initials: string;
  avatarUrl?: string | null;
  bioSnippet: string;
  isFollowing: boolean;
  isMoot: boolean;
};

export type Room = {
  id: number;
  slug: string;
  name: string;
  summary: string;
  description?: string;
  mood: string;
  members: number;
  live: boolean;
  accent: string;
  visibility?: string;
  createdBy?: number | null;
  owner?: User | null;
  postCount: number;
  latestActivityAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type ReactionCounts = {
  glow: number;
  echo: number;
  hush: number;
};

export type PublicStats = {
  publicRooms: number;
  publicPosts: number;
  activeUsers: number;
  totalReactions: number;
};

export type Post = {
  id: number;
  author: User;
  room: Pick<Room, "slug" | "name" | "accent">;
  body: string;
  createdAt: string;
  mood: string;
  parentId?: number | null;
  commentCount: number;
  reactions: ReactionCounts;
  likeCount: number;
  likedByCurrentUser: boolean;
  reblogCount?: number;
  rebloggedByMe?: boolean;
  rebloggedByCurrentUser?: boolean;
  rebloggedBy?: User | null;
  rebloggedAt?: string | null;
  socialContext?: {
    authorRelationship?: "self" | "following" | "moot" | null;
    likedByFollowedCount: number;
  };
  mediaUrl?: string;
};

export type DiscoverPerson = ProfileConnection & {
  postCount: number;
  followerCount: number;
};

export type HomeFeed = {
  posts: Post[];
  personalized: boolean;
};

export type DiscoverFeed = {
  posts: Post[];
  activeRooms: Room[];
  peopleToWatch: DiscoverPerson[];
};

export type ChatMessage = {
  id: number;
  conversationId: number;
  body: string;
  deletedAt: string | null;
  createdAt: string;
  sender: User;
};

export type ChatLastMessage = Pick<ChatMessage, "id" | "body" | "createdAt" | "sender">;

export type ChatConversation = {
  id: number;
  type: "direct";
  createdAt: string;
  updatedAt: string | null;
  lastMessageAt: string | null;
  lastReadAt: string | null;
  mutedAt: string | null;
  archivedAt: string | null;
  unreadCount: number;
  otherParticipant: User;
  lastMessage: ChatLastMessage | null;
};

export type ChatMessagesResult = {
  conversation: ChatConversation;
  messages: ChatMessage[];
};

export type NotificationType =
  | "follow"
  | "moot"
  | "like"
  | "reply"
  | "reblog"
  | "message";

export type NotificationPostSummary = {
  id: number;
  bodySnippet: string;
  author: User | null;
  createdAt?: string | null;
};

export type NotificationItem = {
  id: number;
  type: NotificationType;
  createdAt: string;
  readAt: string | null;
  actor: User | null;
  post: NotificationPostSummary | null;
  room: Room | null;
  targetUrl: string;
};

export type NotificationsResult = {
  notifications: NotificationItem[];
  unreadCount: number;
};
