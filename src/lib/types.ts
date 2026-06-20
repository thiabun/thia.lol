export type ThemeName = "sunveil" | "frostveil";

export type ProfileLayoutPreset = "balanced" | "compact" | "showcase";

export type ProfileBackgroundBlur = "none" | "soft" | "medium" | "heavy";

export type User = {
  id: number;
  handle: string;
  displayName: string;
  initials: string;
  aura: string;
  avatarUrl?: string | null;
};

export type RichLinkCard = Omit<ProfileIntegrationCard, "provider"> & {
  provider: ProfileIntegrationCard["provider"] | "website";
};

export type RichTextEntity =
  | {
      type: "mention";
      start: number;
      length: number;
      text: string;
      mention: {
        handle: string;
        user: User;
      };
    }
  | {
      type: "link";
      start: number;
      length: number;
      text: string;
      link: {
        url: string;
        card?: RichLinkCard | null;
      };
    };

export type TextEntitiesByField = {
  body?: RichTextEntity[];
};

export type Profile = {
  user: User;
  bio: string;
  bioEntities?: RichTextEntity[];
  location: string;
  bannerUrl?: string | null;
  profileAccent?: string | null;
  profileBackground?: string | null;
  profileBackgroundVideo?: string | null;
  profileBackgroundVideoPoster?: string | null;
  profileBackgroundBlur: ProfileBackgroundBlur;
  profileTheme?: string | null;
  profileLayoutPreset: ProfileLayoutPreset;
  profileCanvasVersion: 1 | 2;
  profileCanvasGlass: number;
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

export type ProfileModuleType =
  | "placeholder"
  | "profile_info"
  | "about"
  | "links"
  | "featured_badges"
  | "featured_post"
  | "featured_room"
  | "gallery_media"
  | "creator_live"
  | "music"
  | "custom_text"
  | "activity"
  | "twitch_channel"
  | "youtube_video"
  | "youtube_stream"
  | "youtube_playlist"
  | "uploaded_video"
  | "spotify_song"
  | "apple_music_song"
  | "youtube_music_song"
  | "spotify_playlist"
  | "apple_music_playlist"
  | "youtube_music_playlist"
  | "spotify_artist"
  | "apple_music_artist"
  | "youtube_music_artist"
  | "uploaded_image"
  | "gallery_slideshow"
  | "gallery_feed"
  | "text"
  | "badge_display"
  | "connections"
  | "github_repo";

export type ProfileModuleVisibility = "public" | "hidden" | "draft";

export type ProfileModuleStatus = "active" | "hidden" | "deleted";

export type ProfileModuleLink = {
  label: string;
  platform?: string;
  url: string;
};

export type ProfileModuleMediaItem = {
  caption?: string;
  url: string;
};

export type ProfileModuleUploadedAudio = {
  duration?: number;
  mime: "audio/mpeg";
  size: number;
  title?: string;
  type: "audio/mpeg";
  uploadedAt?: string;
  url: string;
};

export type ProfileModuleUploadedVideo = {
  duration?: number;
  mime: "video/mp4" | "video/webm";
  size: number;
  title?: string;
  type: "video/mp4" | "video/webm";
  uploadedAt?: string;
  url: string;
};

export type ProfileIntegrationEmbed = {
  allow?: string;
  height?: number;
  src: string;
  title: string;
  type: "iframe";
};

export type ProfileIntegrationCard = {
  apiBacked: boolean;
  embed: ProfileIntegrationEmbed | null;
  expiresAt?: string | null;
  fetchedAt?: string | null;
  lastError?: string | null;
  metadata: {
    description?: string | null;
    imageUrl?: string | null;
    live?: boolean;
    liveFetchedAt?: string | null;
    recentFetchedAt?: string | null;
    recentLabel?: string | null;
    stats?: Record<string, string | number | null>;
    subtitle?: string | null;
    title?: string | null;
  };
  provider: "spotify" | "apple_music" | "youtube" | "twitch" | "github";
  resourceId: string;
  resourceKey: string;
  resourceType: string;
  sourceUrl: string;
  stale?: boolean;
  staleAt?: string | null;
};

export type ProfileModuleConfig = {
  audio?: ProfileModuleUploadedAudio;
  autoplay?: boolean;
  body?: string;
  canvasSize?: string;
  configured?: boolean;
  description?: string;
  displayMode?: string;
  hasBanner?: boolean;
  integration?: ProfileIntegrationCard;
  label?: string;
  link?: ProfileModuleLink;
  links?: ProfileModuleLink[];
  mediaItems?: ProfileModuleMediaItem[];
  platform?: string;
  placeholder?: boolean;
  restoreFeaturedPostId?: number;
  restoreFeaturedRoomId?: number;
  sourceMode?: string;
  statusText?: string;
  userBadgeIds?: number[];
  url?: string;
  video?: ProfileModuleUploadedVideo;
  workingOn?: string;
};

export type ProfileModuleLayout = {
  column: number;
  row: number;
  colSpan: number;
  rowSpan: number;
};

export type ProfileCanvasMovementContext = {
  anchorModuleId: number;
  from: Pick<ProfileModuleLayout, "column" | "row">;
  to: Pick<ProfileModuleLayout, "column" | "row">;
};

export type ProfileModule = {
  id: number;
  type: ProfileModuleType;
  title: string | null;
  config: ProfileModuleConfig;
  visibility: ProfileModuleVisibility;
  position: number;
  pinned: boolean;
  layout?: ProfileModuleLayout | null;
  status: ProfileModuleStatus;
  textEntities?: TextEntitiesByField;
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
  bodyEntities?: RichTextEntity[];
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
  updatedAt?: string | null;
  canonicalPath?: string;
  canonicalUrl?: string;
  socialContext?: {
    authorRelationship?: "self" | "following" | "moot" | null;
    likedByFollowedCount: number;
  };
  mediaUrl?: string;
};

export type PostShareSummary = {
  id: number;
  canonicalPath: string;
  canonicalUrl: string;
  bodySnippet: string;
  createdAt?: string | null;
  mediaUrl?: string | null;
  author: User;
  room?: Pick<Room, "slug" | "name" | "accent"> | null;
};

export type ChatMessageAttachment =
  | {
      type: "post";
      post: PostShareSummary | null;
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
  bodyEntities?: RichTextEntity[];
  attachments?: ChatMessageAttachment[];
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
  | "mention"
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
