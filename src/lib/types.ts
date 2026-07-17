export type ThemeName = "light" | "dark";

export type ThemePreference = ThemeName | "profile";

export type ProfileLayoutPreset = "balanced" | "compact" | "showcase";

export type ProfileBackgroundBlur = "none" | "soft" | "medium" | "heavy";

export type ProfileThemeColorKey =
  | "canvas"
  | "canvasSoft"
  | "surface"
  | "surfaceStrong"
  | "text"
  | "muted"
  | "line"
  | "lineStrong"
  | "accent"
  | "accentInk"
  | "accentStrong"
  | "focus";

export type ProfileThemeColors = Record<ProfileThemeColorKey, string>;

export type ProfileThemeConfig =
  | {
      mode: "preset";
      preset: string;
    }
  | {
      mode: "custom";
      colors: ProfileThemeColors;
    };

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
  profileThemeConfig?: ProfileThemeConfig | null;
  profileLayoutPreset: ProfileLayoutPreset;
  profileCanvasVersion: 1 | 2;
  profileCanvasGlass: number;
  visibility: "public" | "private";
  isPrivate: boolean;
  viewerCanView: boolean;
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
    stars: number;
  };
  followerCount: number;
  followingCount: number;
  mootCount: number;
  starCount: number;
  isFollowing: boolean;
  isFollowedBy: boolean;
  isMoot: boolean;
  isStarred: boolean;
  isFollowRequestPending?: boolean;
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
  | "music_playlist"
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

export type ProfileModulePlaylistTrack = {
  artist?: string;
  audio?: ProfileModuleUploadedAudio;
  duration?: number;
  id?: string;
  sourceUrl?: string;
  title: string;
};

export type ProfileModuleUploadedVideo = {
  duration?: number;
  mime: "video/mp4" | "video/webm";
  posterUrl?: string;
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
    stats?: Record<string, unknown>;
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
  tracks?: ProfileModulePlaylistTrack[];
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
  canonicalPath?: string;
  canonicalUrl?: string;
  summary: string;
  description?: string;
  mood: string;
  members: number;
  memberCount: number;
  live: boolean;
  theme: string | null;
  themeConfig: ProfileThemeConfig | null;
  iconUrl?: string | null;
  bannerUrl?: string | null;
  rules?: string;
  rulesVersion: number;
  visibility: RoomVisibility;
  createdBy?: number | null;
  owner?: User | null;
  joinedByMe?: boolean;
  myRoomRole?: "owner" | "moderator" | "member" | null;
  viewerCanViewPosts: boolean;
  viewerCanPost: boolean;
  viewerCanReact: boolean;
  viewerCanJoin: boolean;
  viewerCanRequestAccess: boolean;
  accessRequestStatus?: RoomAccessRequestStatus | null;
  pendingAccessRequestCount?: number | undefined;
  postCount: number;
  latestActivityAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type RoomVisibility = "public" | "private" | "invite" | "view_only";

export type RoomAccessRequestStatus = "pending" | "approved" | "denied" | "canceled";

export type RoomMemberRole = "owner" | "moderator" | "member";

export type RoomMember = {
  id: number;
  role: RoomMemberRole;
  joinedAt?: string | null;
  user: User;
};

export type RoomChannel = {
  id: number;
  roomId: number;
  slug: string;
  name: string;
  description?: string | null;
  position: number;
  kind: "chat" | "announcement";
  readOnly: boolean;
  archivedAt?: string | null;
  conversationId: number;
  unreadCount: number;
  lastMessageAt?: string | null;
  viewerCanPost: boolean;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type RoomAccessRequest = {
  id: number;
  status: RoomAccessRequestStatus;
  createdAt?: string | null;
  updatedAt?: string | null;
  reviewedAt?: string | null;
  requester: User;
  reviewedBy?: User | null;
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

export type GrowthShareKind = "profile" | "post" | "room";

export type GrowthAttribution = {
  source: string | null;
  medium: string | null;
  campaign: string | null;
  shareKind: GrowthShareKind | null;
  shareRef: string | null;
  referrerHost: string | null;
  landingPath: string | null;
};

export type AdminGrowthMetricBucket = {
  key: string;
  count: number;
};

export type AdminGrowthSharedEntityMetric = {
  shareKind: GrowthShareKind;
  shareRef: string;
  count: number;
};

export type AdminGrowthMetrics = {
  windowDays: number;
  totalSignups: number;
  attributedSignups: number;
  bySource: AdminGrowthMetricBucket[];
  byCampaign: AdminGrowthMetricBucket[];
  byShareKind: AdminGrowthMetricBucket[];
  topSharedEntities: AdminGrowthSharedEntityMetric[];
};

export type Post = {
  id: number;
  publicId?: string;
  author: User;
  profile?: Profile;
  room: Pick<Room, "slug" | "name" | "theme" | "themeConfig"> | null;
  body: string;
  bodyFormat?: "plain" | "markdown";
  contentVersion?: number;
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
  mediaType?: "image" | "video" | null;
  mediaMime?: string | null;
  mediaPosterUrl?: string | null;
  attachments?: PostAttachment[];
};

export type PostAttachment = {
  id?: number;
  position: number;
  kind: "image" | "video" | "audio" | "integration" | "gif";
  url?: string | null;
  mime?: string | null;
  sizeBytes?: number | null;
  width?: number | null;
  height?: number | null;
  durationSeconds?: number | null;
  posterUrl?: string | null;
  provider?: "spotify" | "youtube" | "apple_music" | string | null;
  resourceType?: string | null;
  resourceId?: string | null;
  resourceKey?: string | null;
  sourceUrl?: string | null;
  card?: ProfileIntegrationCard | RichLinkCard | Record<string, unknown> | unknown[] | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type GifAttachment = {
  provider: "klipy";
  resourceType: "gif";
  resourceId: string;
  resourceKey: string;
  url: string;
  previewUrl?: string;
  mime: "image/gif";
  width?: number | null;
  height?: number | null;
  sourceUrl?: string | null;
  title?: string;
  card?: Record<string, unknown> | unknown[] | null;
};

export type GifSearchResult = GifAttachment & {
  id: string;
  title: string;
};

export type GifSearchResponse = {
  available: boolean;
  provider: "klipy";
  query: string | null;
  next: string | null;
  items: GifSearchResult[];
};

export type PostShareSummary = {
  id: number;
  publicId?: string;
  canonicalPath: string;
  canonicalUrl: string;
  bodySnippet: string;
  createdAt?: string | null;
  mediaUrl?: string | null;
  mediaType?: "image" | "video" | null;
  mediaMime?: string | null;
  mediaPosterUrl?: string | null;
  attachments?: PostAttachment[];
  author: User;
  room?: Pick<Room, "slug" | "name" | "theme" | "themeConfig"> | null;
};

export type ChatMessageAttachment =
  | {
      type: "post";
      post: Post | null;
    }
  | {
      type: "room";
      room: Room | null;
    }
  | {
      type: "media";
      media: PostAttachment;
    }
  | {
      type: "gif";
      gif: GifAttachment;
    };

export type DiscoverPerson = ProfileConnection & {
  postCount: number;
  followerCount: number;
  starCount: number;
};

export type HomeFeed = {
  nextCursor: string | null;
  posts: Post[];
  personalized: boolean;
};

export type DiscoverFeed = {
  nextCursor: string | null;
  posts: Post[];
  activeRooms: Room[];
  peopleToWatch: DiscoverPerson[];
};

export type SearchProfileResult = {
  user: User;
  bioSnippet: string;
};

export type SearchPostResult = {
  id: number;
  publicId: string;
  canonicalPath: string;
  bodySnippet: string;
  createdAt: string | null;
  author: User;
  room: { name: string; slug: string } | null;
};

export type SearchResults = {
  query: string;
  minQueryLength: number;
  results: {
    profiles: SearchProfileResult[];
    rooms: Room[];
    posts: SearchPostResult[];
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

export type ChatLastMessage = Pick<ChatMessage, "id" | "body" | "createdAt" | "sender"> & {
  previewText?: string;
};

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

export type RoomChannelMessagesResult = {
  channel: RoomChannel;
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
