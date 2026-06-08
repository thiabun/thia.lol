import { discoverItems, posts, profiles, rooms } from "../data/mockData";
import type { DiscoverItem, Post, Profile, Room } from "./types";

const apiBase = "/api";

async function getJson<T>(path: string, fallback: T): Promise<T> {
  try {
    const response = await fetch(`${apiBase}${path}`, {
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      throw new Error(`API responded with ${response.status}`);
    }

    return (await response.json()) as T;
  } catch {
    return fallback;
  }
}

export function getFeed(): Promise<Post[]> {
  return getJson<Post[]>("/posts", posts);
}

export function getDiscover(): Promise<DiscoverItem[]> {
  return getJson<DiscoverItem[]>("/discover", discoverItems);
}

export function getRooms(): Promise<Room[]> {
  return getJson<Room[]>("/rooms", rooms);
}

export function getRoom(idOrSlug: string): Promise<Room | undefined> {
  const fallback = rooms.find(
    (room) => room.slug === idOrSlug || String(room.id) === idOrSlug,
  );

  return getJson<Room | undefined>(`/rooms/${encodeURIComponent(idOrSlug)}`, fallback);
}

export function getProfile(handle: string): Promise<Profile> {
  const normalized = handle.replace(/^@/, "").toLowerCase();
  const fallback =
    profiles.find((profile) => profile.user.handle === normalized) ??
    makeFallbackProfile(normalized);

  return getJson<Profile>(`/profiles/${encodeURIComponent(normalized)}`, fallback);
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
    bio: "A profile waiting for its first signal.",
    location: "thia.lol",
    links: [],
    traits: ["new", "quiet", "unclaimed"],
    stats: { posts: 0, rooms: 0, echoes: 0 },
  };
}
