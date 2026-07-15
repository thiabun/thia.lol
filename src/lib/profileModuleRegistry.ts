import type {
  ProfileLayoutPreset,
  ProfileModule,
  ProfileModuleType,
  UserBadge,
} from "./types";

export const PROFILE_CANVAS_VERSION = 2;
export const PROFILE_CANVAS_DESKTOP_COLUMNS = 12;
export const PROFILE_CANVAS_DESKTOP_ROWS = 16;
export const PROFILE_CANVAS_MOBILE_COLUMNS = 6;
export const PROFILE_CANVAS_MOBILE_ROWS = 32;
export const PROFILE_CANVAS_MAX_MODULE_COLUMNS = 6;
export const PROFILE_CANVAS_MAX_MODULE_ROWS = 6;
export const PROFILE_CANVAS_ACTIVITY_MAX_MODULE_ROWS = 10;
export const PROFILE_CANVAS_PROFILE_INFO_COLUMNS = 8;

type ProfileGridColumnSpan = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
type ProfileGridRowSpan = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

export type ProfileGridModuleSize =
  `${ProfileGridColumnSpan}x${ProfileGridRowSpan}`;

export type ProfileGridModuleSpan = {
  columns: ProfileGridColumnSpan;
  rows: ProfileGridRowSpan;
  size: ProfileGridModuleSize;
};

export type ProfileModulePurpose =
  | "identity"
  | "status"
  | "navigation"
  | "showcase"
  | "media"
  | "activity"
  | "integration";

export type ProfileModuleDensity = "glance" | "summary" | "rich";

export type ProfileModuleFreshness = "static" | "recent" | "live" | "cached";

export type ProfileModulePrimaryAction =
  | "none"
  | "profile"
  | "open"
  | "navigate"
  | "inspect";

export type ProfileModuleEmptyPolicy =
  | "always-render"
  | "hide-public"
  | "owner-compact";

export type ProfileModuleSpanRole = "glance" | "summary" | "rich" | "hero";
export type ProfileModulePresentationTier =
  | "micro"
  | "compact"
  | "standard"
  | "spacious"
  | "showcase";

export type ProfileModulePresentation = {
  allowInternalScroll: boolean;
  isSingleRow: boolean;
  isSlim: boolean;
  preferLargeMedia: boolean;
  showDescription: boolean;
  showSecondaryText: boolean;
  span: ProfileGridModuleSpan;
  spanRole: ProfileModuleSpanRole;
  tier: ProfileModulePresentationTier;
};

export type ProfileModuleCategory =
  | "video"
  | "music"
  | "images"
  | "info"
  | "projects";

export const PROFILE_ACTIVITY_MAX_ROW_SPAN =
  PROFILE_CANVAS_ACTIVITY_MAX_MODULE_ROWS;

export type ProfileModuleRegistryEntry = {
  allowedSizes: readonly ProfileGridModuleSize[];
  category: ProfileModuleCategory;
  defaultSize: ProfileGridModuleSize;
  description: string;
  density: ProfileModuleDensity;
  emptyPolicy: ProfileModuleEmptyPolicy;
  fallbackTitle: string;
  freshness: ProfileModuleFreshness;
  label: string;
  primaryAction: ProfileModulePrimaryAction;
  purpose: ProfileModulePurpose;
};

const fallbackProfileModule: ProfileModuleRegistryEntry = {
  allowedSizes: ["1x1"],
  category: "info",
  defaultSize: "1x1",
  description: "A compact profile module.",
  density: "glance",
  emptyPolicy: "hide-public",
  fallbackTitle: "Module",
  freshness: "static",
  label: "Module",
  primaryAction: "none",
  purpose: "status",
};

function sizes(columns: number[], rows: number[]): ProfileGridModuleSize[] {
  const result: ProfileGridModuleSize[] = [];

  columns.forEach((column) => {
    rows.forEach((row) => {
      const size = profileGridModuleSpanSize(column, row);

      if (size) {
        result.push(size);
      }
    });
  });

  return result;
}

function uniqueSizes(
  ...groups: readonly (readonly ProfileGridModuleSize[])[]
): ProfileGridModuleSize[] {
  return Array.from(new Set(groups.flat()));
}

const wideSlimOneRowSizes = ["5x1", "6x1", "8x1"] as const;
const wideSlimTwoRowSizes = ["5x2", "6x2", "8x2"] as const;
const wideSlimSizes = uniqueSizes(wideSlimOneRowSizes, wideSlimTwoRowSizes);
const wideTwoRowSizes = [...wideSlimTwoRowSizes];
const uploadedImageSizes = uniqueSizes(
  sizes([1, 2, 3, 4, 5, 6], [1, 2, 3, 4, 5, 6]),
  wideTwoRowSizes,
);
const placeholderEnvelopeSizes = sizes(
  [1, 2, 3, 4, 5, 6, 7, 8],
  [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
);
const gallerySlideshowSizes = uniqueSizes(
  sizes([2, 3, 4, 5, 6], [2, 3, 4, 5, 6]),
  wideTwoRowSizes,
);
const textSizes = uniqueSizes(sizes([3, 4], [2, 3, 4, 5]), wideSlimSizes);
const connectionSizes = uniqueSizes(
  ["2x2", "2x3", "3x2", "4x2", "3x3", "3x4"],
  wideSlimSizes,
);
const badgeSizes = uniqueSizes(["2x2", "3x2"], wideSlimSizes);
const providerCardSizes = uniqueSizes(["3x2", "4x3", "6x4"], wideTwoRowSizes);
const videoCardSizes = uniqueSizes(["4x3", "6x4"], wideTwoRowSizes);
const musicSongSizes = uniqueSizes(
  ["2x1", "2x2", "3x2", "4x2", "4x3", "4x4"],
  wideSlimSizes,
);
const playlistSizes = uniqueSizes(["3x2", "4x3", "3x6", "4x6"], wideTwoRowSizes);
const activitySizes = uniqueSizes(["3x4", "4x6", "6x10"], [
  "5x2",
  "6x2",
  "8x2",
  "8x3",
]);

export const profileModuleRegistry = {
  placeholder: {
    allowedSizes: placeholderEnvelopeSizes,
    category: "info",
    defaultSize: "1x1",
    description: "Draft selection envelope.",
    density: "glance",
    emptyPolicy: "hide-public",
    fallbackTitle: "Blank module",
    freshness: "static",
    label: "Blank",
    primaryAction: "none",
    purpose: "status",
  },
  profile_info: {
    allowedSizes: ["3x2", "3x3", "4x3", "6x3", "8x3", "8x4"],
    category: "info",
    defaultSize: "8x3",
    description: "Core identity, actions, stats, and essential links.",
    density: "rich",
    emptyPolicy: "always-render",
    fallbackTitle: "Profile info",
    freshness: "static",
    label: "Profile info",
    primaryAction: "profile",
    purpose: "identity",
  },
  about: {
    allowedSizes: textSizes,
    category: "info",
    defaultSize: "3x2",
    description: "A short profile introduction.",
    density: "summary",
    emptyPolicy: "hide-public",
    fallbackTitle: "About",
    freshness: "static",
    label: "About",
    primaryAction: "inspect",
    purpose: "status",
  },
  custom_text: {
    allowedSizes: textSizes,
    category: "info",
    defaultSize: "3x2",
    description: "A compact note or update.",
    density: "glance",
    emptyPolicy: "hide-public",
    fallbackTitle: "Note",
    freshness: "static",
    label: "Text",
    primaryAction: "none",
    purpose: "status",
  },
  text: {
    allowedSizes: textSizes,
    category: "info",
    defaultSize: "3x2",
    description: "A focused text block.",
    density: "summary",
    emptyPolicy: "hide-public",
    fallbackTitle: "Text",
    freshness: "static",
    label: "Text",
    primaryAction: "none",
    purpose: "status",
  },
  links: {
    allowedSizes: connectionSizes,
    category: "info",
    defaultSize: "3x2",
    description: "Platform-aware safe links and connections.",
    density: "summary",
    emptyPolicy: "hide-public",
    fallbackTitle: "Connections",
    freshness: "static",
    label: "Connections",
    primaryAction: "open",
    purpose: "navigation",
  },
  connections: {
    allowedSizes: connectionSizes,
    category: "info",
    defaultSize: "3x2",
    description: "Platform-aware safe links and connections.",
    density: "summary",
    emptyPolicy: "hide-public",
    fallbackTitle: "Connections",
    freshness: "static",
    label: "Connections",
    primaryAction: "open",
    purpose: "navigation",
  },
  featured_badges: {
    allowedSizes: badgeSizes,
    category: "info",
    defaultSize: "2x2",
    description: "A shelf of earned visible badges.",
    density: "summary",
    emptyPolicy: "hide-public",
    fallbackTitle: "Badge showcase",
    freshness: "static",
    label: "Badges",
    primaryAction: "inspect",
    purpose: "showcase",
  },
  badge_display: {
    allowedSizes: badgeSizes,
    category: "info",
    defaultSize: "2x2",
    description: "A shelf of earned visible badges.",
    density: "summary",
    emptyPolicy: "hide-public",
    fallbackTitle: "Badge display",
    freshness: "static",
    label: "Badge display",
    primaryAction: "inspect",
    purpose: "showcase",
  },
  featured_post: {
    allowedSizes: ["3x4", "4x5"],
    category: "info",
    defaultSize: "3x4",
    description: "A selected post highlight.",
    density: "rich",
    emptyPolicy: "hide-public",
    fallbackTitle: "Featured post",
    freshness: "recent",
    label: "Featured post",
    primaryAction: "navigate",
    purpose: "activity",
  },
  featured_room: {
    allowedSizes: ["3x1", "4x2"],
    category: "info",
    defaultSize: "3x1",
    description: "A selected room highlight.",
    density: "summary",
    emptyPolicy: "hide-public",
    fallbackTitle: "Featured room",
    freshness: "static",
    label: "Featured room",
    primaryAction: "navigate",
    purpose: "navigation",
  },
  activity: {
    allowedSizes: activitySizes,
    category: "info",
    defaultSize: "4x6",
    description: "Posts, replies, and rooms.",
    density: "rich",
    emptyPolicy: "hide-public",
    fallbackTitle: "Feed",
    freshness: "recent",
    label: "Feed",
    primaryAction: "navigate",
    purpose: "activity",
  },
  gallery_media: {
    allowedSizes: gallerySlideshowSizes,
    category: "images",
    defaultSize: "2x2",
    description: "A compact strip of selected uploaded media.",
    density: "rich",
    emptyPolicy: "hide-public",
    fallbackTitle: "Gallery",
    freshness: "static",
    label: "Gallery",
    primaryAction: "inspect",
    purpose: "media",
  },
  uploaded_image: {
    allowedSizes: uploadedImageSizes,
    category: "images",
    defaultSize: "2x2",
    description: "A single uploaded image.",
    density: "rich",
    emptyPolicy: "hide-public",
    fallbackTitle: "Image",
    freshness: "static",
    label: "Image",
    primaryAction: "inspect",
    purpose: "media",
  },
  gallery_slideshow: {
    allowedSizes: gallerySlideshowSizes,
    category: "images",
    defaultSize: "3x3",
    description: "A slideshow of uploaded images.",
    density: "rich",
    emptyPolicy: "hide-public",
    fallbackTitle: "Slideshow",
    freshness: "static",
    label: "Gallery slideshow",
    primaryAction: "inspect",
    purpose: "media",
  },
  gallery_feed: {
    allowedSizes: uniqueSizes(["3x6", "4x6"], wideTwoRowSizes),
    category: "images",
    defaultSize: "3x6",
    description: "A vertical feed of uploaded images.",
    density: "rich",
    emptyPolicy: "hide-public",
    fallbackTitle: "Gallery feed",
    freshness: "static",
    label: "Gallery feed",
    primaryAction: "inspect",
    purpose: "media",
  },
  creator_live: {
    allowedSizes: uniqueSizes(["2x1", "3x2", "4x3", "5x3", "6x4"], wideTwoRowSizes),
    category: "video",
    defaultSize: "3x2",
    description: "A static creator or channel card.",
    density: "summary",
    emptyPolicy: "hide-public",
    fallbackTitle: "Creator",
    freshness: "cached",
    label: "Creator",
    primaryAction: "open",
    purpose: "integration",
  },
  twitch_channel: {
    allowedSizes: uniqueSizes(
      ["2x1", "3x2"],
      wideTwoRowSizes,
      ["4x3", "5x3", "6x4", "8x6"],
    ),
    category: "video",
    defaultSize: "3x2",
    description: "Twitch status, stream, or stream with chat.",
    density: "rich",
    emptyPolicy: "hide-public",
    fallbackTitle: "Twitch channel",
    freshness: "live",
    label: "Twitch channel",
    primaryAction: "open",
    purpose: "integration",
  },
  youtube_video: {
    allowedSizes: uniqueSizes(["3x4"], videoCardSizes),
    category: "video",
    defaultSize: "4x3",
    description: "A featured YouTube video or Short.",
    density: "rich",
    emptyPolicy: "hide-public",
    fallbackTitle: "YouTube video",
    freshness: "cached",
    label: "YouTube video",
    primaryAction: "open",
    purpose: "integration",
  },
  youtube_stream: {
    allowedSizes: uniqueSizes(["4x3", "5x3", "6x4"], wideTwoRowSizes),
    category: "video",
    defaultSize: "4x3",
    description: "A YouTube stream card.",
    density: "rich",
    emptyPolicy: "hide-public",
    fallbackTitle: "YouTube stream",
    freshness: "live",
    label: "YouTube stream",
    primaryAction: "open",
    purpose: "integration",
  },
  youtube_playlist: {
    allowedSizes: uniqueSizes(["4x3", "5x3", "2x4", "3x6"], wideTwoRowSizes),
    category: "video",
    defaultSize: "4x3",
    description: "A YouTube playlist card.",
    density: "rich",
    emptyPolicy: "hide-public",
    fallbackTitle: "YouTube playlist",
    freshness: "cached",
    label: "YouTube playlist",
    primaryAction: "open",
    purpose: "integration",
  },
  uploaded_video: {
    allowedSizes: uniqueSizes(["4x3", "6x4", "4x6"], wideTwoRowSizes),
    category: "video",
    defaultSize: "4x3",
    description: "An uploaded video module.",
    density: "rich",
    emptyPolicy: "hide-public",
    fallbackTitle: "Video",
    freshness: "static",
    label: "Video upload",
    primaryAction: "inspect",
    purpose: "media",
  },
  music: {
    allowedSizes: musicSongSizes,
    category: "music",
    defaultSize: "3x2",
    description: "A single song from Spotify, YouTube, Apple Music, or upload.",
    density: "summary",
    emptyPolicy: "hide-public",
    fallbackTitle: "Music",
    freshness: "static",
    label: "Music",
    primaryAction: "inspect",
    purpose: "media",
  },
  music_playlist: {
    allowedSizes: playlistSizes,
    category: "music",
    defaultSize: "4x3",
    description: "A playlist from Spotify, YouTube, Apple Music, or uploads.",
    density: "rich",
    emptyPolicy: "hide-public",
    fallbackTitle: "Playlist",
    freshness: "static",
    label: "Playlist",
    primaryAction: "inspect",
    purpose: "media",
  },
  spotify_song: {
    allowedSizes: musicSongSizes,
    category: "music",
    defaultSize: "3x2",
    description: "A Spotify song player.",
    density: "summary",
    emptyPolicy: "hide-public",
    fallbackTitle: "Spotify song",
    freshness: "cached",
    label: "Spotify song",
    primaryAction: "open",
    purpose: "integration",
  },
  apple_music_song: {
    allowedSizes: musicSongSizes,
    category: "music",
    defaultSize: "3x2",
    description: "An Apple Music song player.",
    density: "summary",
    emptyPolicy: "hide-public",
    fallbackTitle: "Apple Music song",
    freshness: "cached",
    label: "Apple Music song",
    primaryAction: "open",
    purpose: "integration",
  },
  youtube_music_song: {
    allowedSizes: musicSongSizes,
    category: "music",
    defaultSize: "3x2",
    description: "A YouTube Music song player.",
    density: "summary",
    emptyPolicy: "hide-public",
    fallbackTitle: "YouTube Music song",
    freshness: "cached",
    label: "YouTube Music song",
    primaryAction: "open",
    purpose: "integration",
  },
  spotify_playlist: {
    allowedSizes: playlistSizes,
    category: "music",
    defaultSize: "4x3",
    description: "A Spotify playlist module.",
    density: "rich",
    emptyPolicy: "hide-public",
    fallbackTitle: "Spotify playlist",
    freshness: "cached",
    label: "Spotify playlist",
    primaryAction: "open",
    purpose: "integration",
  },
  apple_music_playlist: {
    allowedSizes: playlistSizes,
    category: "music",
    defaultSize: "4x3",
    description: "An Apple Music playlist module.",
    density: "rich",
    emptyPolicy: "hide-public",
    fallbackTitle: "Apple Music playlist",
    freshness: "cached",
    label: "Apple Music playlist",
    primaryAction: "open",
    purpose: "integration",
  },
  youtube_music_playlist: {
    allowedSizes: playlistSizes,
    category: "music",
    defaultSize: "4x3",
    description: "A YouTube Music playlist module.",
    density: "rich",
    emptyPolicy: "hide-public",
    fallbackTitle: "YouTube Music playlist",
    freshness: "cached",
    label: "YouTube Music playlist",
    primaryAction: "open",
    purpose: "integration",
  },
  spotify_artist: {
    allowedSizes: musicSongSizes,
    category: "music",
    defaultSize: "3x2",
    description: "A Spotify artist card.",
    density: "rich",
    emptyPolicy: "hide-public",
    fallbackTitle: "Spotify artist",
    freshness: "cached",
    label: "Spotify artist",
    primaryAction: "open",
    purpose: "integration",
  },
  apple_music_artist: {
    allowedSizes: musicSongSizes,
    category: "music",
    defaultSize: "3x2",
    description: "An Apple Music artist card.",
    density: "rich",
    emptyPolicy: "hide-public",
    fallbackTitle: "Apple Music artist",
    freshness: "cached",
    label: "Apple Music artist",
    primaryAction: "open",
    purpose: "integration",
  },
  youtube_music_artist: {
    allowedSizes: musicSongSizes,
    category: "music",
    defaultSize: "3x2",
    description: "A YouTube Music artist card.",
    density: "rich",
    emptyPolicy: "hide-public",
    fallbackTitle: "YouTube Music artist",
    freshness: "cached",
    label: "YouTube Music artist",
    primaryAction: "open",
    purpose: "integration",
  },
  github_repo: {
    allowedSizes: providerCardSizes,
    category: "projects",
    defaultSize: "3x2",
    description: "A GitHub repository card.",
    density: "rich",
    emptyPolicy: "hide-public",
    fallbackTitle: "GitHub repo",
    freshness: "cached",
    label: "GitHub repo",
    primaryAction: "open",
    purpose: "integration",
  },
} satisfies Record<ProfileModuleType, ProfileModuleRegistryEntry>;

export type ProfileModuleCatalogItem = {
  category: ProfileModuleCategory;
  description: string;
  label: string;
  type: ProfileModuleType;
};

export const profileModuleCatalog: ProfileModuleCatalogItem[] = (
  [
    "twitch_channel",
    "youtube_video",
    "youtube_stream",
    "youtube_playlist",
    "uploaded_video",
    "music",
    "music_playlist",
    "uploaded_image",
    "gallery_slideshow",
    "gallery_feed",
    "text",
    "badge_display",
    "connections",
    "activity",
    "featured_post",
    "featured_room",
    "github_repo",
  ] as ProfileModuleType[]
).map((type) => {
  const definition = getProfileModuleDefinition(type);

  return {
    category: definition.category,
    description: definition.description,
    label: definition.label,
    type,
  };
});

const profileModuleSizeLabels: Partial<
  Record<ProfileModuleType, Partial<Record<ProfileGridModuleSize, string>>>
> = {
  profile_info: {
    "4x3": "Large",
    "6x3": "Wide",
    "8x3": "Pinned",
    "8x4": "Expanded",
  },
  connections: {
    "2x2": "Compact",
    "2x3": "Stack",
    "3x2": "Rows",
    "4x2": "Wide rows",
    "5x1": "Slim row",
    "6x1": "Wide strip",
    "8x1": "Full strip",
    "5x2": "Slim rows",
    "6x2": "Wide rows",
    "8x2": "Full rows",
    "3x3": "Grid",
    "3x4": "Tall grid",
  },
  links: {
    "2x2": "Compact",
    "2x3": "Stack",
    "3x2": "Rows",
    "4x2": "Wide rows",
    "5x1": "Slim row",
    "6x1": "Wide strip",
    "8x1": "Full strip",
    "5x2": "Slim rows",
    "6x2": "Wide rows",
    "8x2": "Full rows",
    "3x3": "Grid",
    "3x4": "Tall grid",
  },
  activity: {
    "5x2": "Slim feed",
    "6x2": "Wide feed",
    "8x2": "Full feed",
    "8x3": "Full preview",
    "3x4": "Compact",
    "4x6": "Roomy",
    "6x10": "Full",
  },
  music: {
    "2x1": "Mini",
    "2x2": "Compact",
    "3x2": "Player",
    "4x2": "Wide player",
    "5x1": "Slim player",
    "6x1": "Wide strip",
    "8x1": "Full strip",
    "5x2": "Slim player",
    "6x2": "Wide player",
    "8x2": "Full player",
    "4x3": "Player",
    "4x4": "Large player",
  },
  music_playlist: {
    "3x2": "Compact playlist",
    "4x3": "Player",
    "5x2": "Slim list",
    "6x2": "Wide list",
    "8x2": "Full strip",
    "3x6": "Tall playlist",
    "4x6": "Roomy playlist",
  },
  spotify_song: {
    "2x1": "Mini",
    "2x2": "Compact",
    "3x2": "Player",
    "4x2": "Wide player",
    "5x1": "Slim player",
    "6x1": "Wide strip",
    "8x1": "Full strip",
    "5x2": "Slim player",
    "6x2": "Wide player",
    "8x2": "Full player",
    "4x3": "Player",
    "4x4": "Large player",
  },
  apple_music_song: {
    "2x1": "Mini",
    "2x2": "Compact",
    "3x2": "Player",
    "4x2": "Wide player",
    "5x1": "Slim player",
    "6x1": "Wide strip",
    "8x1": "Full strip",
    "5x2": "Slim player",
    "6x2": "Wide player",
    "8x2": "Full player",
    "4x3": "Player",
    "4x4": "Large player",
  },
  youtube_music_song: {
    "2x1": "Mini",
    "2x2": "Compact",
    "3x2": "Player",
    "4x2": "Wide player",
    "5x1": "Slim player",
    "6x1": "Wide strip",
    "8x1": "Full strip",
    "5x2": "Slim player",
    "6x2": "Wide player",
    "8x2": "Full player",
    "4x3": "Player",
    "4x4": "Large player",
  },
  twitch_channel: {
    "2x1": "Status",
    "3x2": "Status",
    "4x3": "Stream",
    "5x3": "Stream",
    "6x4": "Stream + chat",
    "8x6": "Desktop stream + chat",
  },
  youtube_video: {
    "3x4": "Short",
    "4x3": "Video",
    "6x4": "Video",
  },
  youtube_stream: {
    "4x3": "Stream",
    "5x3": "Stream",
    "6x4": "Stream + chat",
  },
  youtube_playlist: {
    "4x3": "Thumbnail",
    "5x3": "Thumbnail",
    "2x4": "Playlist",
    "3x6": "Playlist",
  },
  uploaded_video: {
    "4x3": "Video",
    "6x4": "Wide",
    "4x6": "Tall",
  },
  gallery_feed: {
    "3x6": "Feed",
    "4x6": "Wide feed",
  },
  featured_room: {
    "3x1": "Compact",
    "4x2": "Room card",
  },
  github_repo: {
    "3x2": "Card",
    "4x3": "Details",
    "6x4": "Showcase",
  },
};

export const profileModuleTypes = Object.keys(
  profileModuleRegistry,
) as ProfileModuleType[];

export function isProfileModuleType(value: unknown): value is ProfileModuleType {
  return (
    typeof value === "string" &&
    Object.hasOwn(profileModuleRegistry, value)
  );
}

export function getProfileModuleDefinition(
  type: ProfileModuleType,
): ProfileModuleRegistryEntry {
  return profileModuleRegistry[type] ?? fallbackProfileModule;
}

export function profileModuleAllowedSizes(
  type: ProfileModuleType,
): readonly ProfileGridModuleSize[] {
  return getProfileModuleDefinition(type).allowedSizes;
}

export function profileModuleNearestAllowedSize(
  type: ProfileModuleType,
  requestedSize: ProfileGridModuleSize,
): ProfileGridModuleSize {
  const allowedSizes = profileModuleAllowedSizes(type);

  if (type === "creator_live" && requestedSize === "3x5") {
    return "5x3";
  }

  if (allowedSizes.includes(requestedSize)) {
    return requestedSize;
  }

  const requested = profileGridModuleSizeSpan(requestedSize);
  const requestedArea = requested.columns * requested.rows;

  return (
    allowedSizes
      .map((size, index) => {
        const span = profileGridModuleSizeSpan(size);

        return {
          areaDistance: Math.abs(span.columns * span.rows - requestedArea),
          distance:
            Math.abs(span.columns - requested.columns) +
            Math.abs(span.rows - requested.rows),
          index,
          size,
        };
      })
      .sort(
        (first, second) =>
          first.distance - second.distance ||
          first.areaDistance - second.areaDistance ||
          first.index - second.index,
      )[0]?.size ?? getProfileModuleDefinition(type).defaultSize
  );
}

export function profileModuleTwitchDisplayModeForSize(
  size: ProfileGridModuleSize,
): "stream_status" | "stream" | "stream_chat" {
  const span = profileGridModuleSizeSpan(size);

  if (span.columns >= 6 && span.rows >= 4) {
    return "stream_chat";
  }

  if (span.columns >= 4 && span.rows >= 3) {
    return "stream";
  }

  return "stream_status";
}

export function profileModuleSizeLabel(
  type: ProfileModuleType,
  size: ProfileGridModuleSize,
): string {
  return profileModuleSizeLabels[type]?.[size] ?? `${size.replace("x", " x ")}`;
}

export function profileModuleFallbackTitle(type: ProfileModuleType): string {
  return getProfileModuleDefinition(type).fallbackTitle;
}

export function profileModuleGridSize(
  module: ProfileModule,
  layoutPreset: ProfileLayoutPreset = "balanced",
  index = 0,
): ProfileGridModuleSize {
  void layoutPreset;
  void index;
  const definition = getProfileModuleDefinition(module.type);
  const layoutSize = module.layout
    ? profileGridModuleSpanSize(module.layout.colSpan, module.layout.rowSpan)
    : undefined;

  if (layoutSize && definition.allowedSizes.includes(layoutSize)) {
    return layoutSize;
  }

  if (layoutSize) {
    return profileModuleNearestAllowedSize(module.type, layoutSize);
  }

  const requestedSize = normalizeProfileGridModuleSize(module.config.canvasSize);

  if (requestedSize && definition.allowedSizes.includes(requestedSize)) {
    return requestedSize;
  }

  return definition.defaultSize;
}

export function profileModuleGridSpan(
  module: ProfileModule,
  layoutPreset: ProfileLayoutPreset = "balanced",
  index = 0,
): ProfileGridModuleSpan {
  const span = profileGridModuleSizeSpan(
    profileModuleGridSize(module, layoutPreset, index),
  );

  if (module.type === "activity") {
    return clampProfileGridModuleSpan(span, PROFILE_ACTIVITY_MAX_ROW_SPAN);
  }

  return span;
}

export function profileModuleSpanRole(
  size: ProfileGridModuleSize | undefined,
): ProfileModuleSpanRole {
  const span = profileGridModuleSizeSpan(size);

  if (span.rows <= 1) {
    return span.columns >= 5 ? "summary" : "glance";
  }

  if (span.rows <= 2 && span.columns >= 5) {
    return "summary";
  }

  if (span.rows >= 4 || span.columns >= 5) {
    return "hero";
  }

  if ((span.columns >= 3 && span.rows >= 2) || span.rows >= 3) {
    return "rich";
  }

  if (span.columns >= 3) {
    return "summary";
  }

  return "glance";
}

export function profileModuleSizeIsCompact(
  size: ProfileGridModuleSize | undefined,
): boolean {
  return profileModuleSpanRole(size) === "glance";
}

export function profileModuleSizeHasRoomForDetails(
  size: ProfileGridModuleSize | undefined,
): boolean {
  const spanRole = profileModuleSpanRole(size);

  return spanRole === "summary" || spanRole === "rich" || spanRole === "hero";
}

export function profileModulePresentation(
  size: ProfileGridModuleSize | undefined,
): ProfileModulePresentation {
  const span = profileGridModuleSizeSpan(size);
  const spanRole = profileModuleSpanRole(size);
  const isSingleRow = span.rows <= 1;
  const isSlim = span.columns >= 5 && span.rows <= 2;
  const tier: ProfileModulePresentationTier = isSingleRow
    ? span.columns <= 4
      ? "micro"
      : "compact"
    : span.rows <= 2
      ? span.columns <= 2
        ? "compact"
        : "standard"
      : span.rows >= 6 || (span.columns >= 6 && span.rows >= 4)
        ? "showcase"
        : span.rows >= 3 || span.columns >= 5
          ? "spacious"
          : "standard";
  const showSecondaryText =
    tier === "standard" || tier === "spacious" || tier === "showcase";
  const showDescription = tier === "spacious" || tier === "showcase";

  return {
    allowInternalScroll: showSecondaryText,
    isSingleRow,
    isSlim,
    preferLargeMedia: tier === "spacious" || tier === "showcase",
    showDescription,
    showSecondaryText,
    span,
    spanRole,
    tier,
  };
}

export function clampProfileGridModuleSpan(
  span: ProfileGridModuleSpan,
  maxRows: ProfileGridModuleSpan["rows"],
): ProfileGridModuleSpan {
  return {
    ...span,
    rows: normalizeProfileGridRowSpan(Math.min(span.rows, maxRows)),
    size: `${span.columns}x${normalizeProfileGridRowSpan(
      Math.min(span.rows, maxRows),
    )}` as ProfileGridModuleSize,
  };
}

export function normalizeProfileGridModuleSize(
  value: unknown,
  fallback?: ProfileGridModuleSize,
): ProfileGridModuleSize | undefined {
  if (typeof value !== "string") {
    return fallback;
  }

  const match = value.trim().match(/^([1-8])x(10|[1-9])$/);

  if (!match) {
    return fallback;
  }

  return `${match[1]}x${match[2]}` as ProfileGridModuleSize;
}

export function profileGridModuleSizeSpan(
  value: unknown,
): ProfileGridModuleSpan {
  const size = normalizeProfileGridModuleSize(value, "1x1") ?? "1x1";
  const parts = size.split("x").map(Number);
  const rawColumns = parts[0] ?? 1;
  const rawRows = parts[1] ?? 1;

  return {
    columns: normalizeProfileGridColumnSpan(rawColumns),
    rows: normalizeProfileGridRowSpan(rawRows),
    size,
  };
}

export function profileGridModuleSpanSize(
  columns: number,
  rows: number,
): ProfileGridModuleSize | undefined {
  return normalizeProfileGridModuleSize(`${columns}x${rows}`);
}

function normalizeProfileGridColumnSpan(value: number): ProfileGridColumnSpan {
  if (value <= 1) {
    return 1;
  }

  if (value <= 2) {
    return 2;
  }

  if (value <= 3) {
    return 3;
  }

  if (value <= 4) {
    return 4;
  }

  if (value <= 5) {
    return 5;
  }

  if (value <= 6) {
    return 6;
  }

  if (value <= 7) {
    return 7;
  }

  return 8;
}

function normalizeProfileGridRowSpan(value: number): ProfileGridRowSpan {
  if (value <= 1) {
    return 1;
  }

  if (value <= 2) {
    return 2;
  }

  if (value <= 3) {
    return 3;
  }

  if (value <= 4) {
    return 4;
  }

  if (value <= 5) {
    return 5;
  }

  if (value <= 6) {
    return 6;
  }

  if (value <= 7) {
    return 7;
  }

  if (value <= 8) {
    return 8;
  }

  if (value <= 9) {
    return 9;
  }

  return 10;
}

export function profileModuleHasContent(
  module: ProfileModule,
  badges: UserBadge[],
): boolean {
  if (module.type === "profile_info" || module.type === "activity") {
    return true;
  }

  if (module.visibility === "draft" || module.config.configured === false) {
    return false;
  }

  if (module.type === "links" || module.type === "connections") {
    return (module.config.links ?? []).length > 0;
  }

  if (
    module.type === "about" ||
    module.type === "custom_text" ||
    module.type === "text"
  ) {
    return Boolean(
      module.config.body?.trim() ||
        module.config.statusText?.trim() ||
        module.config.workingOn?.trim(),
    );
  }

  if (module.type === "featured_badges" || module.type === "badge_display") {
    return profileModuleBadges(module, badges).length > 0;
  }

  if (
    module.type === "gallery_media" ||
    module.type === "uploaded_image" ||
    module.type === "gallery_slideshow" ||
    module.type === "gallery_feed"
  ) {
    return (module.config.mediaItems ?? []).length > 0 || Boolean(module.config.url);
  }

  if (
    module.type === "creator_live" ||
    getProfileModuleDefinition(module.type).purpose === "integration"
  ) {
    return Boolean(module.config.url?.trim() || module.config.integration);
  }

  if (module.type === "uploaded_video") {
    return Boolean(module.config.video);
  }

  if (module.type === "music" || getProfileModuleDefinition(module.type).category === "music") {
    return Boolean(
      module.config.audio ||
        module.config.url?.trim() ||
        module.config.integration ||
        (module.config.tracks ?? []).length > 0,
    );
  }

  if (module.type === "featured_post" || module.type === "featured_room") {
    return true;
  }

  return typeof module.config.body === "string" && module.config.body.trim() !== "";
}

export function profileModuleBadges(
  module: ProfileModule,
  badges: UserBadge[],
): UserBadge[] {
  const selectedIds = new Set(module.config.userBadgeIds ?? []);

  if (selectedIds.size === 0) {
    return [];
  }

  return badges.filter((badge) => selectedIds.has(badge.id));
}

export function renderableProfileModules(
  modules: ProfileModule[],
  badges: UserBadge[],
): ProfileModule[] {
  return modules.filter(
    (module) => isProfileModuleType(module.type) && profileModuleHasContent(module, badges),
  );
}

export function profileModuleSummary(module: ProfileModule): string {
  if (module.type === "music_playlist") {
    const count = module.config.tracks?.length ?? 0;

    return count === 1 ? "1 song" : `${count} songs`;
  }

  if (module.type === "links" || module.type === "connections") {
    const count = module.config.links?.length ?? 0;
    return count === 1 ? "1 link" : `${count} links`;
  }

  if (module.type === "featured_badges" || module.type === "badge_display") {
    const count = module.config.userBadgeIds?.length ?? 0;
    return count === 1 ? "1 selected badge" : `${count} selected badges`;
  }

  if (
    module.type === "gallery_media" ||
    module.type === "uploaded_image" ||
    module.type === "gallery_slideshow" ||
    module.type === "gallery_feed"
  ) {
    const count = module.config.mediaItems?.length ?? 0;
    return count === 1 ? "1 media item" : `${count} media items`;
  }

  if (
    module.type === "creator_live" ||
    getProfileModuleDefinition(module.type).purpose === "integration"
  ) {
    return module.config.description?.trim() || module.config.url || getProfileModuleDefinition(module.type).description;
  }

  if (module.type === "uploaded_video" && module.config.video) {
    return module.config.video.title ?? module.config.label ?? "Uploaded video";
  }

  if (module.config.audio) {
    return module.config.audio.title ?? module.config.label ?? "Uploaded audio";
  }

  if (
    module.type === "activity" ||
    module.type === "profile_info" ||
    module.type === "featured_post" ||
    module.type === "featured_room"
  ) {
    return getProfileModuleDefinition(module.type).description;
  }

  const body = (
    module.config.statusText ??
    module.config.workingOn ??
    module.config.body ??
    ""
  ).trim();

  if (!body) {
    return getProfileModuleDefinition(module.type).description;
  }

  return body.length > 96 ? `${body.slice(0, 93)}...` : body;
}
