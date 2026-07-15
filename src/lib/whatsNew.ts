export const WHATS_NEW_STORAGE_KEY = "thia.whatsNew.lastSeenRelease:v1";

export function whatsNewStorageKey(userId?: number): string {
  return `${WHATS_NEW_STORAGE_KEY}:${userId === undefined ? "anonymous" : `user:${userId}`}`;
}

export type WhatsNewGroupId = "new" | "improved" | "fixed";

export type WhatsNewIconName =
  | "activity"
  | "coffee"
  | "compass"
  | "layers"
  | "link"
  | "message"
  | "music"
  | "palette"
  | "play"
  | "refresh"
  | "share"
  | "smartphone"
  | "sparkles"
  | "wrench";

export type WhatsNewItem = {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly icon: WhatsNewIconName;
};

export type WhatsNewGroup = {
  readonly id: WhatsNewGroupId;
  readonly label: string;
  readonly items: readonly WhatsNewItem[];
};

export type WhatsNewRelease = {
  readonly id: string;
  readonly boundary: string;
  readonly title: string;
  readonly sinceLabel: string;
  readonly supportingLine: string;
  readonly groups: readonly WhatsNewGroup[];
};

export const CURRENT_WHATS_NEW_RELEASE = {
  id: "2026-07-15",
  boundary: "2026-07-10",
  title: "What’s New in thia.lol",
  sinceLabel: "Since July 10",
  supportingLine:
    "Profiles, posting, sharing, and the mobile experience all received a substantial polish pass.",
  groups: [
    {
      id: "new",
      label: "New",
      items: [
        {
          id: "profile-theme",
          title: "Profile Theme follows you",
          description:
            "Choose Profile Theme to carry your profile colors, background, and glass treatment through the signed-in site.",
          icon: "palette",
        },
        {
          id: "connections-hub",
          title: "Connections has one home",
          description:
            "Manage Spotify, YouTube, Twitch, and GitHub from one focused settings page; linked accounts can power profile modules and suggestions.",
          icon: "link",
        },
      ],
    },
    {
      id: "improved",
      label: "Improved",
      items: [
        {
          id: "public-home",
          title: "A clearer welcome to thia.lol",
          description:
            "The signed-out home now explains the place plainly and highlights real starter communities and fresh public posts.",
          icon: "compass",
        },
        {
          id: "mobile-profile-editor",
          title: "Profiles are mobile-native",
          description:
            "Public modules form a full-width vertical stack, while owners get touch-friendly editing that preserves desktop placement.",
          icon: "smartphone",
        },
        {
          id: "kofi-support",
          title: "A quieter way to support the site",
          description:
            "A compact Ko-fi control opens a closable support panel without taking over the page, with a softer mobile treatment.",
          icon: "coffee",
        },
        {
          id: "profile-studio",
          title: "Profile Studio, rebuilt for desktop",
          description:
            "A focused toolbar, tool rail, contextual inspector, preview mode, and clearer save status make profile editing easier to follow.",
          icon: "wrench",
        },
        {
          id: "threads-and-composer",
          title: "Threads feel like one conversation",
          description:
            "Thread pages now show one continuous conversation tree, and posts and replies share the same formatting, preview, GIF, music, and media tools.",
          icon: "message",
        },
        {
          id: "mobile-workspaces",
          title: "Mobile workspaces use the whole screen",
          description:
            "Chat and rooms use focused list-to-detail flows; the dock, sheets, media, and Twitch modules stay touch-friendly and contained.",
          icon: "smartphone",
        },
        {
          id: "provider-embeds",
          title: "Rich links stay useful",
          description:
            "Approved music and video providers keep their rich embeds while ordinary links remain lightweight and predictable.",
          icon: "play",
        },
        {
          id: "profile-share-images",
          title: "Profile sharing matches the profile",
          description:
            "Share images now use the real profile theme, background treatment, identity, and visible modules instead of a generic card.",
          icon: "share",
        },
        {
          id: "adaptive-modules",
          title: "Modules fit their content better",
          description:
            "Connections, Activity, and Twitch adjust to their available space, while lighter editor previews keep larger canvases responsive.",
          icon: "layers",
        },
      ],
    },
    {
      id: "fixed",
      label: "Fixed",
      items: [
        {
          id: "autosave-conflicts",
          title: "Safer profile autosave",
          description:
            "New modules persist reliably, in-flight saves finish before publish, conflicts recover safely, and failures stay visible.",
          icon: "refresh",
        },
        {
          id: "deleted-singletons",
          title: "Deleted modules can come back",
          description:
            "Single-instance modules can be added again after an older copy was deleted, without leaving the editor stuck.",
          icon: "sparkles",
        },
        {
          id: "legacy-profile-repair",
          title: "Older profiles repair cleanly",
          description:
            "Legacy module identifiers, unsupported sizes, and overlapping placements are repaired, while the retired generic Featured module no longer blocks editing.",
          icon: "wrench",
        },
        {
          id: "spotify-callback",
          title: "More reliable Spotify connections",
          description:
            "Spotify callbacks now complete cleanly even when optional profile details cannot be loaded.",
          icon: "music",
        },
        {
          id: "focused-video",
          title: "Focused video behaves properly",
          description:
            "Only the most visible video autoplays muted; off-screen videos pause, and profile music keeps priority.",
          icon: "play",
        },
        {
          id: "activity-share-capture",
          title: "Activity shares render consistently",
          description:
            "Activity modules now settle correctly before profile share images are captured, avoiding incomplete results.",
          icon: "activity",
        },
      ],
    },
  ],
} as const satisfies WhatsNewRelease;

export function hasSeenCurrentWhatsNewRelease(userId?: number): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    return (
      window.localStorage.getItem(whatsNewStorageKey(userId)) ===
      CURRENT_WHATS_NEW_RELEASE.id
    );
  } catch {
    return false;
  }
}

export function markCurrentWhatsNewReleaseSeen(userId?: number): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(
      whatsNewStorageKey(userId),
      CURRENT_WHATS_NEW_RELEASE.id,
    );
  } catch {
    // Storage can be unavailable in privacy-restricted browsing contexts.
  }
}
