import {
  BadgeCheck,
  ExternalLink,
  Globe,
  Music2,
  Radio,
  Sparkles,
} from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "../../lib/classNames";
import {
  profileModuleBadges,
  profileModuleFallbackTitle,
  profileModuleGridSpan,
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
  ProfileModuleLink,
  ProfileConnectionPlatform,
  UserBadge,
} from "../../lib/types";
import { ApiStateNotice } from "../ui/ApiStateNotice";
import { CompactStateNotice } from "../ui/RouteState";
import { ProfileGrid, ProfileGridModule } from "./ProfileGrid";
import { ProfileConnectionIcon } from "./ProfileConnectionIcon";

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
      aria-label="Profile canvas"
      className="min-w-0"
      data-testid="profile-modules"
    >
      {renderableModules.length > 0 ? (
        <ProfileModuleGrid
          modules={renderableModules}
          badges={badges}
          layoutPreset={layoutPreset}
          renderModuleContent={renderModuleContent}
        />
      ) : (
        <>
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

          {!loading && !error ? (
            <CompactStateNotice
              icon={Sparkles}
              title="No modules yet"
              text="Profile customization is being rebuilt for P3."
              className="border border-dashed border-line bg-canvas/45"
            />
          ) : null}
        </>
      )}
    </section>
  );
}

type ProfileModuleContentRenderer = (module: ProfileModule) => ReactNode | undefined;

type ProfileModuleGridProps = {
  badges: UserBadge[];
  layoutPreset?: ProfileLayoutPreset | undefined;
  maxColumns?: 2 | 6;
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
          size={profileModuleGridSpan(module, layoutPreset, index).size}
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

  if (module.type === "profile_info") {
    return (
      <p className="mt-2 text-sm leading-6 text-muted">
        Core profile identity appears here.
      </p>
    );
  }

  if (module.type === "links") {
    return (
      <div className="mt-3 grid min-w-0 gap-2 sm:grid-cols-2">
        {(module.config.links ?? []).map((link) => (
          <ProfileModuleLinkCard
            key={`${link.label}-${link.url}`}
            link={link}
          />
        ))}
      </div>
    );
  }

  if (module.type === "featured_badges") {
    const selectedBadges = profileModuleBadges(module, badges);

    return (
      <div className="mt-3 grid min-w-0 gap-2 sm:grid-cols-2">
        {selectedBadges.map((userBadge) => (
          <span
            key={userBadge.id}
            className={cn(
              "inline-flex min-w-0 items-center gap-2 rounded-control border px-3 py-2 text-sm font-semibold",
              rarityChipClass(userBadge.badge.rarity),
            )}
            title={userBadge.badge.description ?? userBadge.badge.name}
          >
            <BadgeCheck aria-hidden="true" size={15} className="shrink-0" />
            <span className="min-w-0 truncate">{userBadge.badge.name}</span>
          </span>
        ))}
      </div>
    );
  }

  if (module.type === "gallery_media") {
    const mediaItems = module.config.mediaItems ?? [];

    return (
      <div className="mt-3 grid max-h-72 min-w-0 grid-cols-2 gap-2 overflow-y-auto pr-1">
        {mediaItems.map((item) => (
          <figure
            key={item.url}
            className="min-w-0 overflow-hidden rounded-card border border-line bg-canvas/55"
          >
            <img
              alt=""
              className="aspect-square size-full object-cover"
              decoding="async"
              loading="lazy"
              src={item.url}
            />
            {item.caption ? (
              <figcaption className="truncate px-2 py-1.5 text-xs text-muted">
                {item.caption}
              </figcaption>
            ) : null}
          </figure>
        ))}
      </div>
    );
  }

  if (module.type === "creator_live") {
    return (
      <ProfileModuleStaticCard
        icon={<Radio aria-hidden="true" size={17} />}
        module={module}
        fallbackLabel="Creator channel"
      />
    );
  }

  if (module.type === "music") {
    return (
      <ProfileModuleStaticCard
        icon={<Music2 aria-hidden="true" size={17} />}
        module={module}
        fallbackLabel="Music link"
      />
    );
  }

  return (
    <div className="mt-2 space-y-2">
      {module.config.body ? (
        <p className="break-words text-sm leading-6 text-muted">{module.config.body}</p>
      ) : null}
      {module.config.statusText ? (
        <p className="rounded-card bg-canvas/55 px-3 py-2 text-sm leading-5 text-text">
          {module.config.statusText}
        </p>
      ) : null}
      {module.config.workingOn ? (
        <p className="text-sm leading-6 text-muted">
          <span className="font-semibold text-text">Working on:</span>{" "}
          {module.config.workingOn}
        </p>
      ) : null}
      {module.config.link ? (
        <a
          className="inline-flex max-w-full rounded-control border border-line bg-canvas/55 px-3 py-1.5 text-sm font-semibold text-text transition duration-fluid ease-fluid hover:border-line-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          href={module.config.link.url}
          rel="noopener noreferrer"
          target="_blank"
        >
          <span className="min-w-0 truncate">{module.config.link.label}</span>
        </a>
      ) : null}
    </div>
  );
}

function ProfileModuleLinkCard({ link }: { link: ProfileModuleLink }) {
  const platform = normalizeModuleConnectionPlatform(link.platform);
  const platformLabel = moduleLinkPlatformLabel(link);
  const preview = moduleLinkPreview(link.url);

  return (
    <a
      className="group flex min-w-0 items-center gap-2 rounded-card border border-line bg-canvas/55 p-2 text-sm transition duration-fluid ease-fluid hover:border-line-strong hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      href={link.url}
      rel="noopener noreferrer"
      target="_blank"
    >
      <span className="grid size-8 shrink-0 place-items-center rounded-full border border-line bg-surface/80 text-text">
        {platform ? (
          <ProfileConnectionIcon platform={platform} size={15} />
        ) : (
          <Globe aria-hidden="true" size={15} />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold text-text">{link.label}</span>
        <span className="block truncate text-xs text-muted">
          {platformLabel}
          {preview ? ` · ${preview}` : ""}
        </span>
      </span>
      <ExternalLink
        aria-hidden="true"
        size={14}
        className="shrink-0 text-muted transition duration-fluid group-hover:text-text"
      />
    </a>
  );
}

function ProfileModuleStaticCard({
  fallbackLabel,
  icon,
  module,
}: {
  fallbackLabel: string;
  icon: ReactNode;
  module: ProfileModule;
}) {
  const url = module.config.url;

  if (!url) {
    return null;
  }

  return (
    <a
      className="mt-3 flex min-w-0 items-center gap-3 rounded-card border border-line bg-canvas/55 p-3 transition duration-fluid ease-fluid hover:border-line-strong hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      href={url}
      rel="noopener noreferrer"
      target="_blank"
    >
      <span className="grid size-10 shrink-0 place-items-center rounded-card border border-line bg-surface/80 text-text">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-text">
          {module.config.label ?? fallbackLabel}
        </span>
        <span className="mt-0.5 block truncate text-xs text-muted">
          {module.config.platform ? platformDisplayName(module.config.platform) : moduleLinkPreview(url)}
        </span>
        {module.config.description ? (
          <span className="mt-1 line-clamp-2 block text-sm leading-5 text-muted">
            {module.config.description}
          </span>
        ) : null}
      </span>
      <ExternalLink aria-hidden="true" size={15} className="shrink-0 text-muted" />
    </a>
  );
}

const knownConnectionPlatforms = new Set<ProfileConnectionPlatform>([
  "website",
  "youtube",
  "twitch",
  "tiktok",
  "instagram",
  "x",
  "bluesky",
  "github",
  "discord",
  "spotify",
]);

function normalizeModuleConnectionPlatform(
  value: string | undefined,
): ProfileConnectionPlatform | undefined {
  return value && knownConnectionPlatforms.has(value as ProfileConnectionPlatform)
    ? (value as ProfileConnectionPlatform)
    : undefined;
}

function moduleLinkPlatformLabel(link: ProfileModuleLink): string {
  const platform = normalizeModuleConnectionPlatform(link.platform);

  if (platform) {
    return platformDisplayName(platform);
  }

  return platformDisplayName(link.platform ?? "custom");
}

function platformDisplayName(platform: string): string {
  const labels: Record<string, string> = {
    apple_music: "Apple Music",
    bandcamp: "Bandcamp",
    bluesky: "Bluesky",
    custom: "Custom link",
    discord: "Discord",
    github: "GitHub",
    instagram: "Instagram",
    soundcloud: "SoundCloud",
    spotify: "Spotify",
    tiktok: "TikTok",
    twitch: "Twitch",
    website: "Website",
    x: "X / Twitter",
    youtube: "YouTube",
    youtube_music: "YouTube Music",
  };

  return labels[platform] ?? "Link";
}

function moduleLinkPreview(value: string): string {
  try {
    const url = new URL(value);
    const host = url.hostname.replace(/^www\./, "");
    const path = url.pathname.replace(/\/$/, "");

    if (!path || path === "/") {
      return host;
    }

    const leaf = path.split("/").filter(Boolean).at(-1);
    return leaf ? `${host}/${leaf}` : host;
  } catch {
    return "";
  }
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
