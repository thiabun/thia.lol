import type {
  ProfileLayoutPreset,
  ProfileModule,
  ProfileModuleType,
  UserBadge,
} from "./types";

export type ProfileGridModuleSize =
  | "1x1"
  | "2x1"
  | "3x1"
  | "4x1"
  | "6x1"
  | "1x2"
  | "2x2"
  | "3x2"
  | "4x2"
  | "6x2"
  | "1x3"
  | "2x3"
  | "3x3"
  | "4x3"
  | "5x3"
  | "6x3"
  | "3x4"
  | "6x5"
  | "3x6";

export type ProfileGridModuleSpan = {
  columns: 1 | 2 | 3 | 4 | 5 | 6;
  rows: 1 | 2 | 3 | 4 | 5 | 6;
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

export const PROFILE_ACTIVITY_MAX_ROW_SPAN = 6;

export type ProfileModuleRegistryEntry = {
  allowedSizes: readonly ProfileGridModuleSize[];
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

export const profileModuleRegistry = {
  profile_info: {
    allowedSizes: ["3x3", "4x3", "6x3", "3x2", "2x2", "2x1"],
    defaultSize: "3x2",
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
    allowedSizes: ["1x1", "2x1", "3x1"],
    defaultSize: "2x1",
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
    allowedSizes: ["1x1", "2x1"],
    defaultSize: "1x1",
    description: "A compact note or update.",
    density: "glance",
    emptyPolicy: "hide-public",
    fallbackTitle: "Note",
    freshness: "static",
    label: "Text",
    primaryAction: "none",
    purpose: "status",
  },
  links: {
    allowedSizes: ["1x1", "2x1", "3x1", "2x2"],
    defaultSize: "2x1",
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
    allowedSizes: ["1x1", "2x1"],
    defaultSize: "2x1",
    description: "A shelf of earned visible badges.",
    density: "summary",
    emptyPolicy: "hide-public",
    fallbackTitle: "Badge showcase",
    freshness: "static",
    label: "Badges",
    primaryAction: "inspect",
    purpose: "showcase",
  },
  featured_post: {
    allowedSizes: ["2x1", "3x1", "2x2", "3x2"],
    defaultSize: "3x2",
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
    allowedSizes: ["1x1", "2x1", "3x1"],
    defaultSize: "2x1",
    description: "A selected room highlight.",
    density: "summary",
    emptyPolicy: "hide-public",
    fallbackTitle: "Featured room",
    freshness: "static",
    label: "Featured room",
    primaryAction: "navigate",
    purpose: "navigation",
  },
  gallery_media: {
    allowedSizes: ["1x1", "2x1", "2x2", "3x2", "3x3"],
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
  creator_live: {
    allowedSizes: ["1x1", "2x1", "2x2", "3x2", "3x3", "4x3", "5x3", "6x5"],
    defaultSize: "2x1",
    description: "A static creator or channel card.",
    density: "summary",
    emptyPolicy: "hide-public",
    fallbackTitle: "Creator",
    freshness: "cached",
    label: "Creator",
    primaryAction: "open",
    purpose: "integration",
  },
  music: {
    allowedSizes: ["1x1", "2x1", "3x1", "3x2"],
    defaultSize: "2x1",
    description: "A link-first music card.",
    density: "summary",
    emptyPolicy: "hide-public",
    fallbackTitle: "Music",
    freshness: "cached",
    label: "Music",
    primaryAction: "open",
    purpose: "integration",
  },
  activity: {
    allowedSizes: ["2x2", "3x2", "3x3", "3x4", "3x6"],
    defaultSize: "3x3",
    description: "Feed, replies, and rooms.",
    density: "rich",
    emptyPolicy: "hide-public",
    fallbackTitle: "Activity",
    freshness: "recent",
    label: "Activity",
    primaryAction: "navigate",
    purpose: "activity",
  },
} satisfies Record<ProfileModuleType, ProfileModuleRegistryEntry>;

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

export function profileModuleFallbackTitle(type: ProfileModuleType): string {
  return getProfileModuleDefinition(type).fallbackTitle;
}

export function profileModuleGridSize(
  module: ProfileModule,
  layoutPreset: ProfileLayoutPreset = "balanced",
  index = 0,
): ProfileGridModuleSize {
  const definition = getProfileModuleDefinition(module.type);
  const layoutSize = module.layout
    ? profileGridModuleSpanSize(module.layout.colSpan, module.layout.rowSpan)
    : undefined;

  if (layoutSize && definition.allowedSizes.includes(layoutSize)) {
    return layoutSize;
  }

  const requestedSize = normalizeProfileGridModuleSize(module.config.canvasSize);

  if (requestedSize && definition.allowedSizes.includes(requestedSize)) {
    return requestedSize;
  }

  if (module.type === "profile_info") {
    return module.config.hasBanner ? "3x3" : "3x2";
  }

  if (layoutPreset === "compact") {
    return module.type === "about" ||
      module.type === "activity" ||
      module.type === "featured_post" ||
      module.type === "featured_room"
      ? definition.allowedSizes.includes("2x1")
        ? "2x1"
        : definition.defaultSize
      : definition.defaultSize;
  }

  if (
    layoutPreset === "showcase" &&
    index === 0 &&
    module.type === "featured_post"
  ) {
    return definition.allowedSizes.includes("3x2") ? "3x2" : definition.defaultSize;
  }

  if (
    layoutPreset === "showcase" &&
    index === 0 &&
    module.type === "about"
  ) {
    return definition.allowedSizes.includes("3x1") ? "3x1" : definition.defaultSize;
  }

  if (module.type === "links" && (module.config.links?.length ?? 0) > 4) {
    return "2x1";
  }

  if (
    module.type === "featured_badges" &&
    (module.config.userBadgeIds?.length ?? 0) > 6
  ) {
    return "2x1";
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
  if (
    size === "3x3" ||
    size === "4x3" ||
    size === "5x3" ||
    size === "6x3" ||
    size === "3x4" ||
    size === "6x5" ||
    size === "3x6"
  ) {
    return "hero";
  }

  if (size === "2x2" || size === "3x2" || size === "1x3" || size === "2x3") {
    return "rich";
  }

  if (size === "3x1") {
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

export function clampProfileGridModuleSpan(
  span: ProfileGridModuleSpan,
  maxRows: ProfileGridModuleSpan["rows"],
): ProfileGridModuleSpan {
  return {
    ...span,
    rows: normalizeProfileGridRowSpan(Math.min(span.rows, maxRows)),
  };
}

export function normalizeProfileGridModuleSize(
  value: unknown,
  fallback?: ProfileGridModuleSize,
): ProfileGridModuleSize | undefined {
  if (value === "3x5") {
    return "5x3";
  }

  if (
    value === "1x1" ||
    value === "2x1" ||
    value === "3x1" ||
    value === "4x1" ||
    value === "6x1" ||
    value === "1x2" ||
    value === "2x2" ||
    value === "3x2" ||
    value === "4x2" ||
    value === "6x2" ||
    value === "1x3" ||
    value === "2x3" ||
    value === "3x3" ||
    value === "4x3" ||
    value === "5x3" ||
    value === "6x3" ||
    value === "3x4" ||
    value === "6x5" ||
    value === "3x6"
  ) {
    return value;
  }

  return fallback;
}

export function profileGridModuleSizeSpan(
  value: unknown,
): ProfileGridModuleSpan {
  const size = normalizeProfileGridModuleSize(value, "1x1") ?? "1x1";

  if (size === "2x1") {
    return { columns: 2, rows: 1, size };
  }

  if (size === "1x2") {
    return { columns: 1, rows: 2, size };
  }

  if (size === "4x1") {
    return { columns: 4, rows: 1, size };
  }

  if (size === "6x1") {
    return { columns: 6, rows: 1, size };
  }

  if (size === "2x2") {
    return { columns: 2, rows: 2, size };
  }

  if (size === "3x1") {
    return { columns: 3, rows: 1, size };
  }

  if (size === "3x2") {
    return { columns: 3, rows: 2, size };
  }

  if (size === "4x2") {
    return { columns: 4, rows: 2, size };
  }

  if (size === "6x2") {
    return { columns: 6, rows: 2, size };
  }

  if (size === "1x3") {
    return { columns: 1, rows: 3, size };
  }

  if (size === "2x3") {
    return { columns: 2, rows: 3, size };
  }

  if (size === "3x3") {
    return { columns: 3, rows: 3, size };
  }

  if (size === "4x3") {
    return { columns: 4, rows: 3, size };
  }

  if (size === "5x3") {
    return { columns: 5, rows: 3, size };
  }

  if (size === "6x3") {
    return { columns: 6, rows: 3, size };
  }

  if (size === "3x4") {
    return { columns: 3, rows: 4, size };
  }

  if (size === "6x5") {
    return { columns: 6, rows: 5, size };
  }

  if (size === "3x6") {
    return { columns: 3, rows: 6, size };
  }

  return { columns: 1, rows: 1, size };
}

export function profileGridModuleSpanSize(
  columns: number,
  rows: number,
): ProfileGridModuleSize | undefined {
  const size = `${columns}x${rows}`;

  return normalizeProfileGridModuleSize(size);
}

function normalizeProfileGridRowSpan(value: number): ProfileGridModuleSpan["rows"] {
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

  return 6;
}

export function profileModuleHasContent(
  module: ProfileModule,
  badges: UserBadge[],
): boolean {
  if (module.type === "profile_info") {
    return true;
  }

  if (module.type === "links") {
    return (module.config.links ?? []).length > 0;
  }

  if (module.type === "about") {
    return Boolean(
      module.config.body?.trim() ||
        module.config.statusText?.trim() ||
        module.config.workingOn?.trim(),
    );
  }

  if (module.type === "featured_badges") {
    return profileModuleBadges(module, badges).length > 0;
  }

  if (module.type === "gallery_media") {
    return (module.config.mediaItems ?? []).length > 0;
  }

  if (module.type === "creator_live" || module.type === "music") {
    return Boolean(module.config.url?.trim());
  }

  if (module.type === "activity") {
    return true;
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
  if (module.type === "links") {
    const count = module.config.links?.length ?? 0;
    return count === 1 ? "1 link" : `${count} links`;
  }

  if (module.type === "featured_badges") {
    const count = module.config.userBadgeIds?.length ?? 0;
    return count === 1 ? "1 selected badge" : `${count} selected badges`;
  }

  if (module.type === "gallery_media") {
    const count = module.config.mediaItems?.length ?? 0;
    return count === 1 ? "1 media item" : `${count} media items`;
  }

  if (module.type === "creator_live" || module.type === "music") {
    return module.config.description?.trim() || module.config.url || getProfileModuleDefinition(module.type).description;
  }

  if (module.type === "activity") {
    return getProfileModuleDefinition(module.type).description;
  }

  if (
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
