import { Sparkles } from "lucide-react";
import { motion } from "motion/react";
import { cn } from "../../lib/classNames";
import { cardEntrance } from "../../lib/motionPresets";
import type { BadgeRarity, ProfileModule, UserBadge } from "../../lib/types";
import { ApiStateNotice } from "../ui/ApiStateNotice";
import { EmptyState } from "../ui/EmptyState";

type ProfileModulesSectionProps = {
  badges: UserBadge[];
  error: unknown;
  isOwnProfile: boolean;
  loading: boolean;
  modules: ProfileModule[];
};

export function ProfileModulesSection({
  badges,
  error,
  isOwnProfile,
  loading,
  modules,
}: ProfileModulesSectionProps) {
  const renderableModules = modules.filter((module) =>
    profileModuleHasContent(module, badges),
  );

  if (loading && !isOwnProfile) {
    return null;
  }

  if (error && !isOwnProfile) {
    return null;
  }

  if (!loading && !error && renderableModules.length === 0 && !isOwnProfile) {
    return null;
  }

  return (
    <motion.section
      aria-label="Personal space"
      className="border-t border-line pt-4"
      data-testid="profile-modules"
      variants={cardEntrance}
      custom={2}
      initial="hidden"
      animate="show"
    >
      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-text">Personal space</h2>
        </div>
      </div>

      {loading ? (
        <ApiStateNotice
          kind="loading"
          title="Loading personal space"
          text="Loading modules."
        />
      ) : null}

      {!loading && error ? (
        <ApiStateNotice
          kind="error"
          title="Profile modules are not available"
          text="Try refreshing in a moment."
        />
      ) : null}

      {!loading && !error && renderableModules.length === 0 ? (
        <EmptyState
          icon={Sparkles}
          title="No modules yet"
          text="Customize profile to add modules."
        />
      ) : null}

      {!loading && !error && renderableModules.length > 0 ? (
        <ProfileModuleGrid modules={renderableModules} badges={badges} />
      ) : null}
    </motion.section>
  );
}

type ProfileModuleGridProps = {
  badges: UserBadge[];
  modules: ProfileModule[];
};

export function ProfileModuleGrid({ badges, modules }: ProfileModuleGridProps) {
  const renderableModules = modules.filter((module) =>
    profileModuleHasContent(module, badges),
  );

  if (renderableModules.length === 0) {
    return (
      <div className="rounded-card border border-dashed border-line bg-canvas/45 p-4 text-sm text-muted">
        No module content to preview.
      </div>
    );
  }

  return (
    <div className="grid min-w-0 gap-3 md:grid-cols-2">
      {renderableModules.map((module) => (
        <ProfileModuleCard key={module.id} module={module} badges={badges} />
      ))}
    </div>
  );
}

type ProfileModuleCardProps = {
  badges: UserBadge[];
  module: ProfileModule;
};

export function ProfileModuleCard({ badges, module }: ProfileModuleCardProps) {
  const title = module.title ?? profileModuleFallbackTitle(module.type);

  return (
    <article
      className="min-w-0 rounded-card border border-line bg-surface/72 p-3"
      data-testid={`profile-module-${module.type}`}
    >
      <h3 className="text-sm font-semibold text-text">{title}</h3>
      <ProfileModuleContent module={module} badges={badges} />
    </article>
  );
}

function ProfileModuleContent({ badges, module }: ProfileModuleCardProps) {
  if (module.type === "links") {
    return (
      <div className="mt-2 flex min-w-0 flex-wrap gap-2">
        {(module.config.links ?? []).map((link) => (
          <a
            key={`${link.label}-${link.url}`}
            className="min-w-0 rounded-control border border-line bg-canvas/55 px-3 py-1.5 text-sm font-semibold text-text transition duration-fluid ease-fluid hover:border-line-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            href={link.url}
            rel="noreferrer"
            target="_blank"
          >
            <span className="block max-w-full truncate">{link.label}</span>
          </a>
        ))}
      </div>
    );
  }

  if (module.type === "featured_badges") {
    const selectedBadges = profileModuleBadges(module, badges);

    return (
      <div className="mt-2 flex min-w-0 flex-wrap gap-2">
        {selectedBadges.map((userBadge) => (
          <span
            key={userBadge.id}
            className={cn(
              "inline-flex min-w-0 items-center gap-2 rounded-control border px-3 py-1.5 text-sm font-semibold",
              rarityChipClass(userBadge.badge.rarity),
            )}
          >
            <span className="min-w-0 truncate">{userBadge.badge.name}</span>
          </span>
        ))}
      </div>
    );
  }

  return (
    <div className="mt-2 space-y-2">
      {module.config.body ? (
        <p className="break-words text-sm leading-6 text-muted">{module.config.body}</p>
      ) : null}
      {module.config.link ? (
        <a
          className="inline-flex max-w-full rounded-control border border-line bg-canvas/55 px-3 py-1.5 text-sm font-semibold text-text transition duration-fluid ease-fluid hover:border-line-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          href={module.config.link.url}
          rel="noreferrer"
          target="_blank"
        >
          <span className="min-w-0 truncate">{module.config.link.label}</span>
        </a>
      ) : null}
    </div>
  );
}

function profileModuleHasContent(
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

function profileModuleBadges(module: ProfileModule, badges: UserBadge[]): UserBadge[] {
  const selectedIds = new Set(module.config.userBadgeIds ?? []);

  if (selectedIds.size === 0) {
    return [];
  }

  return badges.filter((badge) => selectedIds.has(badge.id));
}

function profileModuleFallbackTitle(type: ProfileModule["type"]): string {
  if (type === "about") {
    return "About";
  }

  if (type === "links") {
    return "Links";
  }

  if (type === "featured_badges") {
    return "Featured badges";
  }

  return "Note";
}

function rarityChipClass(rarity: BadgeRarity): string {
  if (rarity === "founder") {
    return "border-warm/40 bg-warm/15 text-warm-ink";
  }

  if (rarity === "legendary") {
    return "border-frostveil/40 bg-frostveil/15 text-frostveil-ink";
  }

  if (rarity === "epic") {
    return "border-rose/40 bg-rose/15 text-rose-ink";
  }

  if (rarity === "rare") {
    return "border-leaf/40 bg-leaf/15 text-leaf-ink";
  }

  return "border-line bg-canvas/65 text-text";
}
