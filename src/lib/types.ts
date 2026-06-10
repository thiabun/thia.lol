export type ThemeName = "sunveil" | "frostveil";

export type User = {
  id: number;
  handle: string;
  displayName: string;
  initials: string;
  aura: string;
};

export type Profile = {
  user: User;
  bio: string;
  location: string;
  links: string[];
  traits: string[];
  stats: {
    posts: number;
    rooms: number;
    echoes: number;
  };
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
  postCount: number;
  latestActivityAt?: string | null;
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
