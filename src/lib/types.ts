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
  mediaUrl?: string;
};

export type DiscoverItem = {
  id: number;
  label: string;
  description: string;
  count: string;
  kind: "thread" | "person" | "room";
};
