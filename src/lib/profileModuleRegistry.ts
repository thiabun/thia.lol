import type { ProfileModule, ProfileModuleType, UserBadge } from "./types";

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
} satisfies Record<ProfileModuleType, ProfileModuleRegistryEntry>;

export function getProfileModuleDefinition(
  type: ProfileModuleType,
): ProfileModuleRegistryEntry {
  return profileModuleRegistry[type] ?? fallbackProfileModule;
}

export function profileModuleFallbackTitle(type: ProfileModuleType): string {
  return getProfileModuleDefinition(type).fallbackTitle;
}

export function profileModuleGridSize(module: ProfileModule): ProfileGridModuleSize {
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
  return modules.filter((module) => profileModuleHasContent(module, badges));
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

  const body = (module.config.body ?? "").trim();

  if (!body) {
    return getProfileModuleDefinition(module.type).description;
  }

  return body.length > 96 ? `${body.slice(0, 93)}...` : body;
}
