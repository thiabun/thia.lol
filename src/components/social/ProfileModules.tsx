import { Sparkles } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "../../lib/classNames";
import {
  profileModuleBadges,
  profileModuleFallbackTitle,
  profileModuleGridSize,
  renderableProfileModules,
} from "../../lib/profileModuleRegistry";
import {
  defaultProfileLayoutPreset,
  profileLayoutMaxColumns,
} from "../../lib/profileLayoutPresets";
import type {
  BadgeRarity,
  ProfileLayoutPreset,
  ProfileModule,
  UserBadge,
} from "../../lib/types";
import { ApiStateNotice } from "../ui/ApiStateNotice";
import { CompactStateNotice } from "../ui/RouteState";
import { ProfileGrid, ProfileGridModule } from "./ProfileGrid";

type ProfileModulesSectionProps = {
  badges: UserBadge[];
  error: unknown;
  isOwnProfile: boolean;
  layoutPreset?: ProfileLayoutPreset | undefined;
  loading: boolean;
  modules: ProfileModule[];
  renderModuleContent?: ProfileModuleContentRenderer | undefined;
};

export function ProfileModulesSection({
  badges,
  error,
  isOwnProfile,
  layoutPreset = defaultProfileLayoutPreset,
  loading,
  modules,
  renderModuleContent,
}: ProfileModulesSectionProps) {
  const renderableModules = renderableProfileModules(modules, badges);

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
    <section
      aria-label="Profile modules"
      className="border-t border-line pt-4"
      data-testid="profile-modules"
    >
      {loading ? (
        <ApiStateNotice
          kind="loading"
          title="Loading modules"
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
        <CompactStateNotice
          icon={Sparkles}
          title="No modules yet"
          text="Customize profile to add modules."
          className="border border-dashed border-line bg-canvas/45"
        />
      ) : null}

      {!loading && !error && renderableModules.length > 0 ? (
        <ProfileModuleGrid
          modules={renderableModules}
          badges={badges}
          layoutPreset={layoutPreset}
          renderModuleContent={renderModuleContent}
        />
      ) : null}
    </section>
  );
}

type ProfileModuleContentRenderer = (module: ProfileModule) => ReactNode | undefined;

type ProfileModuleGridProps = {
  badges: UserBadge[];
  layoutPreset?: ProfileLayoutPreset | undefined;
  maxColumns?: 2 | 3;
  modules: ProfileModule[];
  renderModuleContent?: ProfileModuleContentRenderer | undefined;
};

export function ProfileModuleGrid({
  badges,
  layoutPreset = defaultProfileLayoutPreset,
  maxColumns,
  modules,
  renderModuleContent,
}: ProfileModuleGridProps) {
  const renderableModules = renderableProfileModules(modules, badges);
  const resolvedMaxColumns = maxColumns ?? profileLayoutMaxColumns(layoutPreset);

  if (renderableModules.length === 0) {
    return (
      <ProfileGrid
        layoutPreset={layoutPreset}
        maxColumns={resolvedMaxColumns}
        testId="profile-module-grid"
      >
        <ProfileGridModule size="wide">
          <div className="rounded-card border border-dashed border-line bg-canvas/45 p-4 text-sm text-muted">
            No module content to preview.
          </div>
        </ProfileGridModule>
      </ProfileGrid>
    );
  }

  return (
    <ProfileGrid
      layoutPreset={layoutPreset}
      maxColumns={resolvedMaxColumns}
      testId="profile-module-grid"
    >
      {renderableModules.map((module, index) => (
        <ProfileGridModule
          key={`${module.type}-${module.id}`}
          size={profileModuleGridSize(module, layoutPreset, index)}
          testId={`profile-grid-module-${module.type}`}
        >
          {renderModuleContent?.(module) ?? (
            <ProfileModuleCard module={module} badges={badges} />
          )}
        </ProfileGridModule>
      ))}
    </ProfileGrid>
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
      className="h-full min-w-0 rounded-card border border-line bg-surface/68 p-3"
      data-testid={`profile-module-${module.type}`}
    >
      <h3 className="text-sm font-semibold text-text">{title}</h3>
      <ProfileModuleContent module={module} badges={badges} />
    </article>
  );
}

function ProfileModuleContent({ badges, module }: ProfileModuleCardProps) {
  if (module.type === "activity") {
    return (
      <p className="mt-2 text-sm leading-6 text-muted">
        Feed, replies, and rooms appear here on the public profile.
      </p>
    );
  }

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
