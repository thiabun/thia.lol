import type {
  ProfileLayoutPreset,
  ProfileModule,
  ProfileModuleType,
  UserBadge,
} from "./types";

export type ProfileGridModuleSize = "small" | "wide" | "tall" | "feature";

type ProfileModuleRegistryEntry = {
  defaultSize: ProfileGridModuleSize;
  description: string;
  fallbackTitle: string;
  label: string;
};

const fallbackProfileModule: ProfileModuleRegistryEntry = {
  defaultSize: "small",
  description: "A compact profile module.",
  fallbackTitle: "Module",
  label: "Module",
};

export const profileModuleRegistry = {
  about: {
    defaultSize: "wide",
    description: "A short profile introduction.",
    fallbackTitle: "About",
    label: "About",
  },
  custom_text: {
    defaultSize: "small",
    description: "A compact note or update.",
    fallbackTitle: "Note",
    label: "Text",
  },
  links: {
    defaultSize: "small",
    description: "A safe list of external links.",
    fallbackTitle: "Links",
    label: "Links",
  },
  featured_badges: {
    defaultSize: "small",
    description: "A shelf of earned visible badges.",
    fallbackTitle: "Featured badges",
    label: "Badges",
  },
  featured: {
    defaultSize: "wide",
    description: "A selected post and room highlight.",
    fallbackTitle: "Featured",
    label: "Featured",
  },
  activity: {
    defaultSize: "wide",
    description: "Feed, replies, and rooms.",
    fallbackTitle: "Activity",
    label: "Activity",
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

export function profileModuleFallbackTitle(type: ProfileModuleType): string {
  return getProfileModuleDefinition(type).fallbackTitle;
}

export function profileModuleGridSize(
  module: ProfileModule,
  layoutPreset: ProfileLayoutPreset = "balanced",
  index = 0,
): ProfileGridModuleSize {
  if (layoutPreset === "compact") {
    return module.type === "about" ||
      module.type === "activity" ||
      module.type === "featured"
      ? "wide"
      : "small";
  }

  if (
    layoutPreset === "showcase" &&
    index === 0 &&
    (module.type === "about" || module.type === "featured")
  ) {
    return "feature";
  }

  if (module.type === "links" && (module.config.links?.length ?? 0) > 4) {
    return "wide";
  }

  if (
    module.type === "featured_badges" &&
    (module.config.userBadgeIds?.length ?? 0) > 6
  ) {
    return "wide";
  }

  return getProfileModuleDefinition(module.type).defaultSize;
}

export function profileModuleHasContent(
  module: ProfileModule,
  badges: UserBadge[],
): boolean {
  if (module.type === "links") {
    return (module.config.links ?? []).length > 0;
  }

  if (module.type === "featured_badges") {
    return profileModuleBadges(module, badges).length > 0;
  }

  if (module.type === "activity") {
    return true;
  }

  if (module.type === "featured") {
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

  if (module.type === "activity") {
    return getProfileModuleDefinition(module.type).description;
  }

  if (module.type === "featured") {
    return getProfileModuleDefinition(module.type).description;
  }

  const body = (module.config.body ?? "").trim();

  if (!body) {
    return getProfileModuleDefinition(module.type).description;
  }

  return body.length > 96 ? `${body.slice(0, 93)}...` : body;
}
