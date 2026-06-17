import {
  BadgeCheck,
  ExternalLink,
  Globe,
  Music2,
  Move,
  Radio,
  Sparkles,
} from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
} from "react";
import { cn } from "../../lib/classNames";
import {
  getProfileModuleDefinition,
  isProfileModuleType,
  profileModuleBadges,
  profileModuleFallbackTitle,
  profileModuleGridSpan,
  profileModuleHasContent,
  profileModuleSizeHasRoomForDetails,
  profileModuleSizeIsCompact,
  profileModuleSpanRole,
  renderableProfileModules,
  type ProfileGridModuleSize,
  type ProfileModuleSpanRole,
} from "../../lib/profileModuleRegistry";
import {
  defaultProfileLayoutPreset,
  profileLayoutMaxColumns,
} from "../../lib/profileLayoutPresets";
import type {
  BadgeRarity,
  ProfileLayoutPreset,
  ProfileIntegrationCard,
  ProfileModule,
  ProfileModuleLayout,
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
  editing?: ProfileModuleGridEditing | undefined;
  renderModuleContent?: ProfileModuleContentRenderer | undefined;
};

export function ProfileModulesSection({
  badges,
  error,
  isOwnProfile,
  layoutPreset = defaultProfileLayoutPreset,
  loading,
  modules,
  editing,
  renderModuleContent,
}: ProfileModulesSectionProps) {
  const renderableModules = editing
    ? modules.filter((module) => isProfileModuleType(module.type))
    : renderableProfileModules(modules, badges);

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
          editing={editing}
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
              title="Blank canvas"
              text="Add a module when this profile needs another clear signal."
              className="border border-dashed border-line bg-canvas/45"
            />
          ) : null}
        </>
      )}
    </section>
  );
}

type ProfileModuleGridProps = {
  badges: UserBadge[];
  editing?: ProfileModuleGridEditing | undefined;
  layoutPreset?: ProfileLayoutPreset | undefined;
  maxColumns?: 2 | 6;
  modules: ProfileModule[];
  renderModuleContent?: ProfileModuleContentRenderer | undefined;
};

type ProfileModuleGridEditing = {
  selectedModuleId?: number | undefined;
  onDeselectModule: () => void;
  onMoveModule: (moduleId: number, layout: ProfileModuleLayout) => void;
  onSelectModule: (module: ProfileModule) => void;
  renderSelectedControls?: (
    module: ProfileModule,
    size: ProfileGridModuleSize,
  ) => ReactNode;
};

export function ProfileModuleGrid({
  badges,
  editing,
  layoutPreset = defaultProfileLayoutPreset,
  maxColumns,
  modules,
  renderModuleContent,
}: ProfileModuleGridProps) {
  const renderableModules = editing
    ? modules.filter((module) => isProfileModuleType(module.type))
    : renderableProfileModules(modules, badges);
  const resolvedMaxColumns = maxColumns ?? profileLayoutMaxColumns(layoutPreset);
  const gridRef = useRef<HTMLDivElement | null>(null);
  const suppressModuleClickRef = useRef(false);
  const [dragState, setDragState] = useState<
    | {
        moduleId: number;
        colSpan: number;
        rowSpan: number;
      }
    | undefined
  >();

  useEffect(() => {
    if (!dragState || !editing) {
      return undefined;
    }

    const activeDragState = dragState;
    const activeEditing = editing;

    function handlePointerMove(event: globalThis.PointerEvent) {
      const grid = gridRef.current;

      if (!grid || window.innerWidth < 1024) {
        return;
      }

      const layout = profileCanvasLayoutFromPoint(
        grid,
        event.clientX,
        event.clientY,
        activeDragState.colSpan,
        activeDragState.rowSpan,
      );

      activeEditing.onMoveModule(activeDragState.moduleId, layout);
    }

    function handlePointerUp() {
      setDragState(undefined);
      suppressModuleClickRef.current = true;
      window.setTimeout(() => {
        suppressModuleClickRef.current = false;
      }, 350);
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp, { once: true });
    window.addEventListener("pointercancel", handlePointerUp, { once: true });

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
    };
  }, [dragState, editing]);

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

  function handleModuleDragStart(
    event: PointerEvent<HTMLButtonElement>,
    module: ProfileModule,
    layout: ProfileModuleLayout,
  ) {
    if (!editing || event.button !== 0 || window.innerWidth < 1024) {
      return;
    }

    event.preventDefault();
    suppressModuleClickRef.current = true;
    editing.onSelectModule(module);
    setDragState({
      moduleId: module.id,
      colSpan: layout.colSpan,
      rowSpan: layout.rowSpan,
    });
  }

  function handleEditingModuleClick(
    event: MouseEvent<HTMLDivElement>,
    module: ProfileModule,
  ) {
    if (!editing) {
      return;
    }

    if (suppressModuleClickRef.current) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    const target = event.target;

    if (
      target instanceof HTMLElement &&
      target.closest('[data-profile-edit-control="true"]')
    ) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    editing.onSelectModule(module);
  }

  function handleGridClick(event: MouseEvent<HTMLDivElement>) {
    if (!editing || event.target !== event.currentTarget) {
      return;
    }

    editing.onDeselectModule();
  }

  return (
    <ProfileGrid
      gridRef={gridRef}
      layoutPreset={layoutPreset}
      maxColumns={resolvedMaxColumns}
      onClick={handleGridClick}
      testId="profile-module-grid"
    >
      {renderableModules.map((module, index) => {
        const span = profileModuleGridSpan(module, layoutPreset, index);
        const definition = getProfileModuleDefinition(module.type);
        const spanRole = profileModuleSpanRole(span.size);
        const selected = editing?.selectedModuleId === module.id;
        const selectedContent = selected
          ? editing?.renderSelectedControls?.(module, span.size)
          : undefined;
        const safeLayout =
          module.layout &&
          module.layout.colSpan === span.columns &&
          module.layout.rowSpan === span.rows
            ? module.layout
            : null;

        return (
          <ProfileGridModule
            key={`${module.type}-${module.id}`}
            className={cn(
              "relative",
              editing
                ? "rounded-card transition duration-fluid ease-fluid"
                : undefined,
              editing && module.visibility !== "public" ? "opacity-55" : undefined,
              editing && dragState?.moduleId === module.id
                ? "z-20 scale-[1.01] opacity-80 shadow-lift"
                : undefined,
              selected
                ? "ring-2 ring-focus ring-offset-2 ring-offset-canvas"
                : undefined,
            )}
            layout={safeLayout}
            presentation={{
              compact: profileModuleSizeIsCompact(span.size),
              density: definition.density,
              emptyPolicy: definition.emptyPolicy,
              freshness: definition.freshness,
              primaryAction: definition.primaryAction,
              purpose: definition.purpose,
              spanRole,
            }}
            selected={selected}
            size={span.size}
            testId={`profile-grid-module-${module.type}`}
            onClickCapture={
              editing ? (event) => handleEditingModuleClick(event, module) : undefined
            }
          >
            {editing && dragState?.moduleId === module.id ? (
              <div
                className="pointer-events-none absolute inset-1 z-10 rounded-card border-2 border-dashed border-focus bg-focus/10"
                data-testid="profile-canvas-placement-preview"
              />
            ) : null}
            {editing ? (
              <button
                type="button"
                className={cn(
                  "absolute right-2 top-2 z-20 grid size-8 cursor-grab place-items-center rounded-control border border-line bg-surface/90 text-text shadow-soft backdrop-blur-veil transition duration-fluid ease-fluid hover:border-line-strong active:cursor-grabbing focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
                  selected ? "ring-1 ring-focus/35" : undefined,
                )}
                aria-label={`Drag ${profileModuleFallbackTitle(module.type)} module`}
                title={`Drag ${profileModuleFallbackTitle(module.type)}`}
                data-profile-edit-control="true"
                data-testid={`profile-canvas-drag-handle-${module.id}`}
                onClick={() => editing.onSelectModule(module)}
                onPointerDown={(event) =>
                  handleModuleDragStart(event, module, safeLayout ?? {
                    column: 1,
                    row: 1,
                    colSpan: span.columns,
                    rowSpan: span.rows,
                  })
                }
              >
                <Move aria-hidden="true" size={15} />
              </button>
            ) : null}
            {selectedContent ??
              renderModuleContent?.(module, span.size) ?? (
                <ProfileModuleCard module={module} badges={badges} size={span.size} />
              )}
          </ProfileGridModule>
        );
      })}
    </ProfileGrid>
  );
}

function profileCanvasLayoutFromPoint(
  grid: HTMLDivElement,
  clientX: number,
  clientY: number,
  colSpan: number,
  rowSpan: number,
): ProfileModuleLayout {
  const rect = grid.getBoundingClientRect();
  const columnWidth = rect.width / 6;
  const rowHeight = Math.max(1, rect.height / 9);
  const rawColumn = Math.floor((clientX - rect.left) / columnWidth) + 1;
  const rawRow = Math.floor((clientY - rect.top) / rowHeight) + 1;

  return {
    column: Math.min(6 - colSpan + 1, Math.max(1, rawColumn)),
    row: Math.min(9 - rowSpan + 1, Math.max(1, rawRow)),
    colSpan,
    rowSpan,
  };
}

type ProfileModuleContentRenderer = (
  module: ProfileModule,
  size: ProfileGridModuleSize,
) => ReactNode | undefined;

type ProfileModuleCardProps = {
  badges: UserBadge[];
  module: ProfileModule;
  size?: ProfileGridModuleSize | undefined;
};

export function ProfileModuleCard({ badges, module, size = "1x1" }: ProfileModuleCardProps) {
  const title = module.title ?? profileModuleFallbackTitle(module.type);
  const definition = getProfileModuleDefinition(module.type);
  const compact = profileModuleSizeIsCompact(size);
  const hasDetails = profileModuleSizeHasRoomForDetails(size);
  const spanRole = profileModuleSpanRole(size);

  return (
    <article
      className="grid h-full min-h-0 min-w-0 grid-rows-[auto_1fr] gap-2 overflow-hidden rounded-card border border-line bg-surface/58 p-3 shadow-soft backdrop-blur-veil focus-within:border-line-strong"
      data-profile-module-action={definition.primaryAction}
      data-profile-module-compact={String(compact)}
      data-profile-module-density={definition.density}
      data-profile-module-empty-policy={definition.emptyPolicy}
      data-profile-module-freshness={definition.freshness}
      data-profile-module-purpose={definition.purpose}
      data-profile-module-shell="true"
      data-profile-module-span-role={spanRole}
      data-testid={`profile-module-${module.type}`}
    >
      <header className="min-w-0">
        <h3 className="truncate text-sm font-semibold text-text">{title}</h3>
      </header>
      <div className="min-h-0 min-w-0 overflow-hidden">
        <ProfileModuleContent
          module={module}
          badges={badges}
          compact={compact}
          hasDetails={hasDetails}
          spanRole={spanRole}
        />
      </div>
    </article>
  );
}

function ProfileModuleContent({
  badges,
  compact,
  hasDetails,
  module,
  spanRole,
}: ProfileModuleCardProps & {
  compact: boolean;
  hasDetails: boolean;
  spanRole: ProfileModuleSpanRole;
}) {
  if (module.type === "activity") {
    return (
      <p className="text-sm leading-6 text-muted">
        Feed, replies, and rooms appear here on the public profile.
      </p>
    );
  }

  if (module.type === "profile_info") {
    return (
      <p className="text-sm leading-6 text-muted">
        Core profile identity appears here.
      </p>
    );
  }

  if (!profileModuleHasContent(module, badges)) {
    return <ProfileModuleEmptyPrompt module={module} />;
  }

  if (module.type === "links") {
    const links = module.config.links ?? [];
    const visibleLinks = compact ? links.slice(0, 6) : links;
    const hiddenCount = Math.max(0, links.length - visibleLinks.length);

    if (compact) {
      return (
        <div
          className="flex max-h-full min-w-0 flex-wrap content-start gap-2 overflow-hidden"
          data-profile-module-visible-links={visibleLinks.length}
          data-profile-connections-compact="icons"
        >
          {visibleLinks.map((link) => (
            <ProfileModuleConnectionIconOnly
              key={`${link.label}-${link.url}`}
              link={link}
            />
          ))}
          {hiddenCount > 0 ? (
            <span className="grid size-9 shrink-0 place-items-center rounded-full border border-dashed border-line bg-canvas/45 text-xs font-semibold text-muted">
              +{hiddenCount}
            </span>
          ) : null}
        </div>
      );
    }

    return (
      <div
        className={cn(
          "grid max-h-full min-w-0 gap-2 overflow-y-auto pr-1",
          spanRole === "rich" || spanRole === "hero" ? "sm:grid-cols-2" : "grid-cols-1",
        )}
        data-profile-module-visible-links={visibleLinks.length}
        data-profile-connections-compact="rows"
      >
        {visibleLinks.map((link) => (
          <ProfileModuleLinkCard
            key={`${link.label}-${link.url}`}
            link={link}
          />
        ))}
        {hiddenCount > 0 ? (
          <span className="inline-flex min-h-10 items-center rounded-card border border-dashed border-line bg-canvas/45 px-3 text-sm font-semibold text-muted">
            +{hiddenCount} more
          </span>
        ) : null}
      </div>
    );
  }

  if (module.type === "featured_badges") {
    const selectedBadges = profileModuleBadges(module, badges);
    const visibleBadges = compact ? selectedBadges.slice(0, 4) : selectedBadges;
    const hiddenCount = Math.max(0, selectedBadges.length - visibleBadges.length);

    return (
      <div
        className="grid max-h-full min-w-0 gap-2 overflow-y-auto pr-1 sm:grid-cols-2"
        data-profile-module-visible-badges={visibleBadges.length}
      >
        {visibleBadges.map((userBadge) => (
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
        {hiddenCount > 0 ? (
          <span className="inline-flex items-center rounded-control border border-dashed border-line bg-canvas/45 px-3 py-2 text-sm font-semibold text-muted">
            +{hiddenCount} more
          </span>
        ) : null}
      </div>
    );
  }

  if (module.type === "gallery_media") {
    const mediaItems = module.config.mediaItems ?? [];
    const visibleMediaItems = compact ? mediaItems.slice(0, 2) : mediaItems;

    return (
      <div
        className={cn(
          "grid max-h-full min-w-0 gap-2 overflow-y-auto pr-1",
          spanRole === "glance"
            ? "grid-cols-1"
            : spanRole === "hero"
              ? "grid-cols-3"
              : "grid-cols-2",
        )}
        data-profile-module-visible-media={visibleMediaItems.length}
      >
        {visibleMediaItems.map((item) => (
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
            {item.caption && hasDetails ? (
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
    <div className="max-h-full space-y-2 overflow-y-auto pr-1">
      {module.config.body ? (
        <p
          className={cn(
            "break-words text-sm leading-6 text-muted",
            compact ? "line-clamp-2" : "line-clamp-4",
          )}
        >
          {module.config.body}
        </p>
      ) : null}
      {module.config.statusText ? (
        <p className="line-clamp-2 rounded-card bg-canvas/55 px-3 py-2 text-sm leading-5 text-text">
          {module.config.statusText}
        </p>
      ) : null}
      {module.config.workingOn ? (
        <p
          className={cn(
            "text-sm leading-6 text-muted",
            compact ? "line-clamp-1" : "line-clamp-2",
          )}
        >
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

function ProfileModuleEmptyPrompt({ module }: { module: ProfileModule }) {
  return (
    <div className="flex h-full min-h-0 items-center rounded-card border border-dashed border-line bg-canvas/38 px-3 py-2 text-sm font-semibold text-muted">
      <span className="line-clamp-2">{profileModuleEmptyPrompt(module.type)}</span>
    </div>
  );
}

function profileModuleEmptyPrompt(type: ProfileModule["type"]): string {
  if (type === "links") {
    return "Select to add connections";
  }

  if (type === "about") {
    return "Select to add an intro";
  }

  if (type === "custom_text") {
    return "Select to add text";
  }

  if (type === "featured_badges") {
    return "Select to add badges";
  }

  if (type === "gallery_media") {
    return "Select to add media";
  }

  if (type === "creator_live") {
    return "Select to add a creator link";
  }

  if (type === "music") {
    return "Select to add music";
  }

  return `Select to edit ${profileModuleFallbackTitle(type).toLowerCase()}`;
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

function ProfileModuleConnectionIconOnly({ link }: { link: ProfileModuleLink }) {
  const platform = normalizeModuleConnectionPlatform(link.platform);
  const label = link.label || moduleLinkPlatformLabel(link);

  return (
    <a
      className="grid size-9 shrink-0 place-items-center rounded-full border border-line bg-canvas/55 text-text transition duration-fluid ease-fluid hover:border-line-strong hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      href={link.url}
      rel="noopener noreferrer"
      target="_blank"
      aria-label={label}
      title={label}
    >
      {platform ? (
        <ProfileConnectionIcon platform={platform} size={16} />
      ) : (
        <Globe aria-hidden="true" size={16} />
      )}
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

  if (module.config.integration) {
    return (
      <ProfileIntegrationRichCard
        fallbackLabel={fallbackLabel}
        icon={icon}
        integration={module.config.integration}
        module={module}
      />
    );
  }

  return (
    <a
      className="flex min-w-0 items-center gap-3 rounded-card border border-line bg-canvas/55 p-3 transition duration-fluid ease-fluid hover:border-line-strong hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
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

function ProfileIntegrationRichCard({
  fallbackLabel,
  icon,
  integration,
  module,
}: {
  fallbackLabel: string;
  icon: ReactNode;
  integration: ProfileIntegrationCard;
  module: ProfileModule;
}) {
  const metadata = integration.metadata;
  const title = metadata.title ?? module.config.label ?? fallbackLabel;
  const subtitle = integrationLabel(integration);
  const fetchedAt =
    integration.apiBacked && (metadata.live || metadata.recentLabel)
      ? metadata.liveFetchedAt ?? metadata.recentFetchedAt
      : undefined;
  const displayMode = module.config.displayMode;
  const showPrimaryEmbed = Boolean(
    integration.embed && displayMode !== "stream_status",
  );
  const primaryEmbedSrc = integration.embed
    ? profileIntegrationEmbedSrc(integration)
    : undefined;
  const primaryEmbedHeight = profileIntegrationEmbedHeight(integration);
  const twitchChatSrc =
    displayMode === "stream_chat" ? twitchChatEmbedSrc(integration) : undefined;

  return (
    <div
      className={cn(
        "overflow-hidden rounded-card border border-line bg-canvas/55",
        twitchChatSrc ? "flex h-full min-h-0 flex-col" : undefined,
      )}
    >
      <a
        className="flex min-w-0 items-center gap-3 p-3 transition duration-fluid ease-fluid hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        href={integration.sourceUrl}
        rel="noopener noreferrer"
        target="_blank"
      >
        <span className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-card border border-line bg-surface/80 text-text">
          {metadata.imageUrl ? (
            <img
              alt=""
              className="size-full object-cover"
              decoding="async"
              loading="lazy"
              src={metadata.imageUrl}
            />
          ) : (
            icon
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-text">
            {title}
          </span>
          <span className="mt-0.5 block truncate text-xs text-muted">
            {subtitle}
            {fetchedAt ? ` · ${formatIntegrationAge(fetchedAt)}` : ""}
          </span>
          {metadata.description ? (
            <span className="mt-1 line-clamp-2 block text-sm leading-5 text-muted">
              {metadata.description}
            </span>
          ) : null}
        </span>
        <ExternalLink aria-hidden="true" size={15} className="shrink-0 text-muted" />
      </a>
      {showPrimaryEmbed && integration.embed ? (
        <iframe
          className={cn(
            "block w-full border-t border-line bg-transparent",
            twitchChatSrc ? "min-h-0 flex-1" : undefined,
          )}
          title={integration.embed.title}
          src={primaryEmbedSrc}
          height={twitchChatSrc ? 260 : primaryEmbedHeight}
          loading="lazy"
          referrerPolicy="strict-origin-when-cross-origin"
          allow={integration.embed.allow}
          sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-forms"
          allowFullScreen
          data-profile-embed-provider={integration.provider}
          data-testid={`profile-integration-embed-${integration.provider}`}
        />
      ) : null}
      {twitchChatSrc ? (
        <iframe
          className="block min-h-0 flex-1 border-t border-line bg-surface"
          title="Twitch chat"
          src={twitchChatSrc}
          height={320}
          loading="lazy"
          referrerPolicy="strict-origin-when-cross-origin"
          sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-forms"
          data-testid="profile-integration-embed-twitch-chat"
        />
      ) : null}
    </div>
  );
}

function profileIntegrationEmbedSrc(integration: ProfileIntegrationCard): string {
  const src = integration.embed?.src ?? integration.sourceUrl;

  if (integration.provider !== "spotify") {
    return src;
  }

  try {
    const url = new URL(src);

    if (url.hostname === "open.spotify.com" && url.pathname.startsWith("/embed/")) {
      url.searchParams.set("theme", "0");
      return url.toString();
    }
  } catch {
    return src;
  }

  return src;
}

function profileIntegrationEmbedHeight(integration: ProfileIntegrationCard): number {
  if (integration.provider === "spotify") {
    if (integration.resourceType === "track") {
      return 80;
    }

    return 152;
  }

  if (integration.provider === "apple_music") {
    return 152;
  }

  return integration.embed?.height ?? 180;
}

function twitchChatEmbedSrc(integration: ProfileIntegrationCard): string | undefined {
  if (integration.provider !== "twitch" || integration.resourceType !== "channel") {
    return undefined;
  }

  const parent =
    typeof window === "undefined" || !window.location.hostname
      ? "thia.lol"
      : window.location.hostname;

  return `https://www.twitch.tv/embed/${encodeURIComponent(
    integration.resourceId,
  )}/chat?parent=${encodeURIComponent(parent)}&darkpopout`;
}

function integrationLabel(integration: ProfileIntegrationCard): string {
  if (
    integration.apiBacked &&
    integration.metadata.live &&
    integration.metadata.liveFetchedAt
  ) {
    return `Live now on ${platformDisplayName(integration.provider)}`;
  }

  if (
    integration.apiBacked &&
    integration.metadata.recentLabel &&
    integration.metadata.recentFetchedAt
  ) {
    return `${integration.metadata.recentLabel} · ${platformDisplayName(integration.provider)}`;
  }

  if (integration.apiBacked) {
    return platformDisplayName(integration.provider);
  }

  return `${platformDisplayName(integration.provider)} link`;
}

function formatIntegrationAge(value: string): string {
  const timestamp = Date.parse(value);

  if (!Number.isFinite(timestamp)) {
    return "";
  }

  const minutes = Math.max(0, Math.round((Date.now() - timestamp) / 60000));

  if (minutes < 1) {
    return "now";
  }

  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  return `${Math.round(minutes / 60)}h ago`;
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
