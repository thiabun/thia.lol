import type { DiscoverItem, Post, Profile, Room, User } from "../lib/types";

export const users: User[] = [
  {
    id: 1,
    handle: "mira",
    displayName: "Mira Vale",
    initials: "MV",
    aura: "sunlit",
  },
  {
    id: 2,
    handle: "sol",
    displayName: "Sol Anka",
    initials: "SA",
    aura: "ember",
  },
  {
    id: 3,
    handle: "thia",
    displayName: "Thia",
    initials: "TH",
    aura: "frost",
  },
  {
    id: 4,
    handle: "ior",
    displayName: "Ior Rune",
    initials: "IR",
    aura: "tide",
  },
];

const mira = users[0]!;
const sol = users[1]!;
const thia = users[2]!;
const ior = users[3]!;

export const rooms: Room[] = [
  {
    id: 1,
    slug: "soft-launch",
    name: "Soft Launch",
    summary: "A room for early notes, platform rituals, and what the day is asking for.",
    mood: "quietly busy",
    members: 284,
    live: true,
    accent: "var(--accent-sun)",
  },
  {
    id: 2,
    slug: "moon-table",
    name: "Moon Table",
    summary: "Slow conversation, night work, tender critique, and tiny finished things.",
    mood: "low blue",
    members: 138,
    live: true,
    accent: "var(--accent-frost)",
  },
  {
    id: 3,
    slug: "garden-protocol",
    name: "Garden Protocol",
    summary: "Designing care into tools, communities, defaults, and daily interfaces.",
    mood: "green room",
    members: 402,
    live: false,
    accent: "var(--accent-leaf)",
  },
  {
    id: 4,
    slug: "afterglow",
    name: "Afterglow",
    summary: "Music, fragments, long reads, and warm proof that people are still here.",
    mood: "honey static",
    members: 319,
    live: false,
    accent: "var(--accent-rose)",
  },
];

const softLaunch = rooms[0]!;
const moonTable = rooms[1]!;
const gardenProtocol = rooms[2]!;
const afterglow = rooms[3]!;

export const profiles: Profile[] = [
  {
    user: mira,
    bio: "Builds small luminous systems for people who prefer interfaces with a pulse.",
    location: "Lisbon",
    links: ["mira.design", "soft-launch"],
    traits: ["systems", "ambient UX", "notes"],
    stats: { posts: 128, rooms: 6, echoes: 2400 },
  },
  {
    user: sol,
    bio: "Host of slow rooms, collector of unfinished songs, usually making tea.",
    location: "Reykjavik",
    links: ["sol.audio"],
    traits: ["music", "rituals", "rooms"],
    stats: { posts: 86, rooms: 12, echoes: 1800 },
  },
  {
    user: thia,
    bio: "A secondary profile on the platform, present without making the whole room about her.",
    location: "Oslo",
    links: ["thia.lol"],
    traits: ["frontend", "soft systems", "moon notes"],
    stats: { posts: 42, rooms: 3, echoes: 940 },
  },
  {
    user: ior,
    bio: "Writes about protocols, weather, and the strange mercy of better defaults.",
    location: "Tallinn",
    links: ["ior.works"],
    traits: ["protocols", "essays", "ice"],
    stats: { posts: 203, rooms: 9, echoes: 3600 },
  },
];

export const posts: Post[] = [
  {
    id: 1,
    author: mira,
    room: softLaunch,
    body: "The nicest launch state might be one where the platform feels awake before it asks anyone to perform.",
    createdAt: "18m",
    mood: "sunveil",
    reactions: { glow: 42, echo: 12, hush: 8 },
    likeCount: 0,
    likedByCurrentUser: false,
    mediaUrl: "/ambient-veil.webp",
  },
  {
    id: 2,
    author: ior,
    room: gardenProtocol,
    body: "A good room has affordances for entering, leaving, returning, and being forgiven for being quiet.",
    createdAt: "44m",
    mood: "garden",
    reactions: { glow: 81, echo: 19, hush: 22 },
    likeCount: 0,
    likedByCurrentUser: false,
  },
  {
    id: 3,
    author: thia,
    room: moonTable,
    body: "Tonight's note: make the interface feel like it notices pressure without demanding speed.",
    createdAt: "1h",
    mood: "frostveil",
    reactions: { glow: 64, echo: 16, hush: 31 },
    likeCount: 0,
    likedByCurrentUser: false,
  },
  {
    id: 4,
    author: sol,
    room: afterglow,
    body: "Pinned a small loop for anyone writing after midnight. It does not solve the work. It makes the work kinder.",
    createdAt: "2h",
    mood: "afterglow",
    reactions: { glow: 117, echo: 34, hush: 12 },
    likeCount: 0,
    likedByCurrentUser: false,
  },
];

export const discoverItems: DiscoverItem[] = [
  {
    id: 1,
    label: "Easygoing rooms",
    description: "Spaces for slower conversations and small updates.",
    count: "24 threads",
    kind: "thread",
  },
  {
    id: 2,
    label: "Post ideas",
    description: "Prompts, drafts, and rooms where unfinished thoughts can land.",
    count: "18 rooms",
    kind: "room",
  },
  {
    id: 3,
    label: "Quiet operators",
    description: "People shaping the platform through curation, hosting, and repair.",
    count: "82 people",
    kind: "person",
  },
  {
    id: 4,
    label: "Solarized socials",
    description: "Warm interfaces, humane defaults, and conversations with less glare.",
    count: "31 posts",
    kind: "thread",
  },
];
