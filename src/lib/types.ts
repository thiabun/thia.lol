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
  featuredPostId?: number | null;
  featuredRoomId?: number | null;
  featuredPost?: Post | null;
  featuredRoom?: Room | null;
  links: ProfileExternalConnection[];
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
  blockedByMe?: boolean;
  mutedByMe?: boolean;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type ProfileConnectionPlatform =
  | "website"
  | "youtube"
  | "twitch"
  | "tiktok"
  | "instagram"
  | "x"
  | "bluesky"
  | "github"
  | "discord"
  | "spotify";

export type ProfileExternalConnection = {
  platform: ProfileConnectionPlatform;
  label: string;
  value: string;
  url: string | null;
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

export type BadgeRarity = "common" | "rare" | "epic" | "legendary" | "founder";

export type BadgeDefinition = {
  id: number;
  badgeKey: string;
  name: string;
  description: string | null;
  rarity: BadgeRarity;
  source: string;
  icon: string | null;
  accent: string | null;
  isActive: boolean;
  createdAt?: string | null;
};

export type UserBadge = {
  id: number;
  badge: BadgeDefinition;
  reason: string | null;
  earnedAt: string;
  featuredOrder: number | null;
  isVisible: boolean;
  grantedBy: User | null;
  user?: User;
};

export type ProfileBadgesResult = {
  badges: UserBadge[];
  featuredBadges: UserBadge[];
};

export type ProfileModuleType = "about" | "links" | "featured_badges" | "custom_text";

export type ProfileModuleVisibility = "public" | "hidden" | "draft";

export type ProfileModuleStatus = "active" | "hidden" | "deleted";

export type ProfileModuleLink = {
  label: string;
  url: string;
};

export type ProfileModuleConfig = {
  body?: string;
  link?: ProfileModuleLink;
  links?: ProfileModuleLink[];
  userBadgeIds?: number[];
};

export type ProfileModule = {
  id: number;
  type: ProfileModuleType;
  title: string | null;
  config: ProfileModuleConfig;
  visibility: ProfileModuleVisibility;
  position: number;
  status: ProfileModuleStatus;
  schemaVersion: number;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type Room = {
  id: number;
  slug: string;
  name: string;
  summary: string;
  description?: string;
  mood: string;
  members: number;
  memberCount: number;
  live: boolean;
  accent: string;
  iconUrl?: string | null;
  bannerUrl?: string | null;
  rules?: string;
  visibility?: string;
  createdBy?: number | null;
  owner?: User | null;
  joinedByMe?: boolean;
  myRoomRole?: "owner" | "moderator" | "member" | null;
  postCount: number;
  latestActivityAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type RoomMemberRole = "owner" | "moderator" | "member";

export type RoomMember = {
  id: number;
  role: RoomMemberRole;
  joinedAt?: string | null;
  user: User;
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

export type SearchProfileResult = {
  user: User;
  bioSnippet: string;
};

export type SearchResults = {
  query: string;
  minQueryLength: number;
  results: {
    profiles: SearchProfileResult[];
    rooms: Room[];
  };
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

export type ChatMoot = User;

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
  | "message"
  | "badge_granted";

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
  data?: Record<string, unknown> | null;
};

export type NotificationsResult = {
  notifications: NotificationItem[];
  unreadCount: number;
};
