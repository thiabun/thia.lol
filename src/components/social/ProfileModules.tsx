import {
  BadgeCheck,
  ExternalLink,
  Globe,
  Music2,
  Move,
  Pause,
  Play,
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

const PROFILE_CANVAS_COLUMNS = 6;
const PROFILE_CANVAS_ROWS = 12;

type ProfileModulesSectionProps = {
  badges: UserBadge[];
  error: unknown;
  isOwnProfile: boolean;
  layoutPreset?: ProfileLayoutPreset | undefined;
  loading: boolean;
  musicAutoplay?: ProfileMusicAutoplayRequest | undefined;
  modules: ProfileModule[];
  editing?: ProfileModuleGridEditing | undefined;
  renderModuleContent?: ProfileModuleContentRenderer | undefined;
};

export type ProfileMusicAutoplayRequest = {
  requestId: number;
  targetModuleId: number;
};

export function ProfileModulesSection({
  badges,
  error,
  isOwnProfile,
  layoutPreset = defaultProfileLayoutPreset,
  loading,
  musicAutoplay,
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
          musicAutoplay={musicAutoplay}
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
  musicAutoplay?: ProfileMusicAutoplayRequest | undefined;
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
  musicAutoplay,
  modules,
  renderModuleContent,
}: ProfileModuleGridProps) {
  const renderableModules = editing
    ? modules.filter((module) => isProfileModuleType(module.type))
    : renderableProfileModules(modules, badges);
  const resolvedMaxColumns = maxColumns ?? profileLayoutMaxColumns(layoutPreset);
  const gridRef = useRef<HTMLDivElement | null>(null);
  const lastDragLayoutRef = useRef<ProfileModuleLayout | undefined>(undefined);
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

      if (
        lastDragLayoutRef.current &&
        profileCanvasLayoutsMatch(lastDragLayoutRef.current, layout)
      ) {
        return;
      }

      lastDragLayoutRef.current = layout;
      activeEditing.onMoveModule(activeDragState.moduleId, layout);
    }

    function handlePointerUp() {
      setDragState(undefined);
      lastDragLayoutRef.current = undefined;
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
    lastDragLayoutRef.current = layout;
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
        const musicAutoplayRequestId =
          musicAutoplay?.targetModuleId === module.id ? musicAutoplay.requestId : 0;
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
                ? "rounded-card transition-[filter,opacity,box-shadow] duration-fluid ease-fluid"
                : undefined,
              editing && module.visibility !== "public" ? "opacity-55" : undefined,
              editing && dragState?.moduleId === module.id
                ? "z-20 scale-[1.012] opacity-85 drop-shadow-2xl"
                : undefined,
              selected
                ? "ring-2 ring-focus ring-offset-2 ring-offset-canvas"
                : undefined,
            )}
            layout={safeLayout}
            dragging={editing && dragState?.moduleId === module.id}
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
                <ProfileModuleCard
                  module={module}
                  badges={badges}
                  editing={Boolean(editing)}
                  musicAutoplayRequestId={musicAutoplayRequestId}
                  size={span.size}
                />
              )}
          </ProfileGridModule>
        );
      })}
    </ProfileGrid>
  );
}

function profileCanvasLayoutsMatch(
  first: ProfileModuleLayout,
  second: ProfileModuleLayout,
): boolean {
  return (
    first.column === second.column &&
    first.row === second.row &&
    first.colSpan === second.colSpan &&
    first.rowSpan === second.rowSpan
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
  const columnWidth = rect.width / PROFILE_CANVAS_COLUMNS;
  const rowHeight = Math.max(1, rect.height / PROFILE_CANVAS_ROWS);
  const rawColumn = Math.floor((clientX - rect.left) / columnWidth) + 1;
  const rawRow = Math.floor((clientY - rect.top) / rowHeight) + 1;

  return {
    column: Math.min(
      PROFILE_CANVAS_COLUMNS - colSpan + 1,
      Math.max(1, rawColumn),
    ),
    row: Math.min(PROFILE_CANVAS_ROWS - rowSpan + 1, Math.max(1, rawRow)),
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
  editing?: boolean | undefined;
  musicAutoplayRequestId?: number | undefined;
  module: ProfileModule;
  size?: ProfileGridModuleSize | undefined;
};

export function ProfileModuleCard({
  badges,
  editing = false,
  musicAutoplayRequestId = 0,
  module,
  size = "1x1",
}: ProfileModuleCardProps) {
  const title = module.title ?? profileModuleFallbackTitle(module.type);
  const definition = getProfileModuleDefinition(module.type);
  const compact = profileModuleSizeIsCompact(size);
  const hasDetails = profileModuleSizeHasRoomForDetails(size);
  const spanRole = profileModuleSpanRole(size);

  return (
    <article
      className={cn(
        "grid h-full min-h-0 min-w-0 overflow-hidden rounded-card focus-within:border-line-strong",
        editing
          ? "grid-rows-[auto_1fr] gap-2 border border-line bg-surface/58 p-3 shadow-soft backdrop-blur-veil"
          : "grid-rows-[1fr] border border-transparent bg-transparent p-0 shadow-none",
      )}
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
      {editing ? (
        <header className="min-w-0">
        <h3 className="truncate text-sm font-semibold text-text">{title}</h3>
        </header>
      ) : null}
      <div className="min-h-0 min-w-0 overflow-hidden">
        <ProfileModuleContent
          module={module}
          musicAutoplayRequestId={musicAutoplayRequestId}
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
  musicAutoplayRequestId = 0,
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
        musicAutoplayRequestId={musicAutoplayRequestId}
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
  musicAutoplayRequestId = 0,
  module,
}: {
  fallbackLabel: string;
  icon: ReactNode;
  musicAutoplayRequestId?: number | undefined;
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
        autoplayRequestId={musicAutoplayRequestId}
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
  autoplayRequestId = 0,
  fallbackLabel,
  icon,
  integration,
  module,
}: {
  autoplayRequestId?: number | undefined;
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
  const primaryEmbed = integration.embed;
  const showPrimaryEmbed = Boolean(
    primaryEmbed && displayMode !== "stream_status",
  );
  const primaryEmbedSrc = primaryEmbed
    ? profileIntegrationEmbedSrc(integration)
    : undefined;
  const primaryEmbedHeight = profileIntegrationEmbedHeight(integration);
  const twitchChatSrc =
    displayMode === "stream_chat" ? twitchChatEmbedSrc(integration) : undefined;
  const showTwitchStreamChat = Boolean(
    twitchChatSrc && showPrimaryEmbed && primaryEmbed,
  );

  if (showPrimaryEmbed && primaryEmbed && integration.provider === "spotify") {
    return (
      <SpotifyMusicPlayer
        autoplayRequestId={autoplayRequestId}
        fallbackLabel={fallbackLabel}
        icon={icon}
        integration={integration}
        module={module}
      />
    );
  }

  if (showTwitchStreamChat && primaryEmbed && primaryEmbedSrc && twitchChatSrc) {
    return (
      <div className="h-full min-h-0 overflow-hidden rounded-card border border-line bg-canvas/55">
        <div className="grid h-full min-h-0 md:grid-cols-5">
          <iframe
            className="block h-full min-h-[220px] w-full bg-transparent md:col-span-3"
            title={primaryEmbed.title}
            src={primaryEmbedSrc}
            height={360}
            loading="lazy"
            referrerPolicy="strict-origin-when-cross-origin"
            allow={primaryEmbed.allow}
            sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-forms"
            allowFullScreen
            data-profile-embed-provider={integration.provider}
            data-testid={`profile-integration-embed-${integration.provider}`}
          />
          <iframe
            className="block h-full min-h-[220px] w-full border-t border-line bg-surface md:col-span-2 md:border-l md:border-t-0"
            title="Twitch chat"
            src={twitchChatSrc}
            height={360}
            loading="lazy"
            referrerPolicy="strict-origin-when-cross-origin"
            sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-forms"
            data-testid="profile-integration-embed-twitch-chat"
          />
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "overflow-hidden rounded-card border border-line bg-canvas/55",
        twitchChatSrc && showPrimaryEmbed
          ? "flex h-full min-h-0 flex-col"
          : undefined,
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
      {showPrimaryEmbed && primaryEmbed ? (
        <iframe
          className={cn(
            "block w-full border-t border-line bg-transparent",
            twitchChatSrc ? "min-h-0 flex-1" : undefined,
          )}
          title={primaryEmbed.title}
          src={primaryEmbedSrc}
          height={twitchChatSrc ? 260 : primaryEmbedHeight}
          loading="lazy"
          referrerPolicy="strict-origin-when-cross-origin"
          allow={primaryEmbed.allow}
          sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-forms"
          allowFullScreen
          data-profile-embed-provider={integration.provider}
          data-testid={`profile-integration-embed-${integration.provider}`}
        />
      ) : null}
    </div>
  );
}

type SpotifyIframeApi = {
  createController: (
    element: HTMLElement,
    options: {
      height: string;
      theme?: "0" | "1";
      uri: string;
      width: string;
    },
    callback: (controller: SpotifyEmbedController) => void,
  ) => void;
};

type SpotifyEmbedController = {
  addListener?: (
    event: "playback_started" | "playback_update",
    listener: (event: SpotifyPlaybackEvent) => void,
  ) => void;
  destroy?: () => void;
  pause?: () => Promise<void> | void;
  play?: () => Promise<void> | void;
  removeListener?: (
    event: "playback_started" | "playback_update",
    listener: (event: SpotifyPlaybackEvent) => void,
  ) => void;
  resume?: () => Promise<void> | void;
  togglePlay?: () => Promise<void> | void;
};

type SpotifyPlaybackEvent = {
  data?: {
    duration?: number;
    isBuffering?: boolean;
    isPaused?: boolean;
    playingURI?: string;
    position?: number;
  };
};

type SpotifyPlaybackProgress = {
  duration: number;
  isBuffering: boolean;
  isPaused: boolean;
  known: boolean;
  position: number;
};

const emptySpotifyPlaybackProgress: SpotifyPlaybackProgress = {
  duration: 0,
  isBuffering: false,
  isPaused: true,
  known: false,
  position: 0,
};

declare global {
  interface Window {
    __thiaSpotifyIframeApi?: SpotifyIframeApi | undefined;
    onSpotifyIframeApiReady?: ((api: SpotifyIframeApi) => void) | undefined;
  }
}

let spotifyIframeApiPromise: Promise<SpotifyIframeApi> | undefined;

function SpotifyMusicPlayer({
  autoplayRequestId,
  fallbackLabel,
  icon,
  integration,
  module,
}: {
  autoplayRequestId: number;
  fallbackLabel: string;
  icon: ReactNode;
  integration: ProfileIntegrationCard;
  module: ProfileModule;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const controllerRef = useRef<SpotifyEmbedController | undefined>(undefined);
  const lastAutoplayRequestRef = useRef(0);
  const removePlaybackListenersRef = useRef<(() => void) | undefined>(undefined);
  const [controllerReady, setControllerReady] = useState(false);
  const [controllerReadyVersion, setControllerReadyVersion] = useState(0);
  const [playbackProgress, setPlaybackProgress] = useState<SpotifyPlaybackProgress>(
    emptySpotifyPlaybackProgress,
  );
  const [playing, setPlaying] = useState(false);
  const [fallback, setFallback] = useState(false);
  const metadata = integration.metadata;
  const title = metadata.title ?? module.config.label ?? fallbackLabel;
  const subtitle = metadata.subtitle ?? platformDisplayName(integration.provider);
  const description = metadata.description ?? module.config.description;
  const fetchedAt =
    integration.apiBacked && (metadata.live || metadata.recentLabel)
      ? metadata.liveFetchedAt ?? metadata.recentFetchedAt
      : undefined;
  const playerTitle = integration.embed?.title ?? `${title} on Spotify`;
  const playerHeight = profileIntegrationEmbedHeight(integration);
  const uri = spotifyIntegrationUri(integration);

  useEffect(() => {
    const container = containerRef.current;

    if (!container || !uri) {
      setFallback(true);
      return undefined;
    }

    let canceled = false;
    setFallback(false);
    setControllerReady(false);
    setPlaying(false);
    setPlaybackProgress(emptySpotifyPlaybackProgress);
    removePlaybackListenersRef.current?.();
    removePlaybackListenersRef.current = undefined;
    controllerRef.current = undefined;
    container.replaceChildren();

    loadSpotifyIframeApi()
      .then((api) => {
        if (canceled) {
          return;
        }

        api.createController(
          container,
          {
            height: String(playerHeight),
            theme: "0",
            uri,
            width: "100%",
          },
          (controller) => {
            if (canceled) {
              controller.destroy?.();
              return;
            }

            controllerRef.current = controller;
            removePlaybackListenersRef.current = attachSpotifyPlaybackListeners(
              controller,
              (progress) => {
                if (canceled) {
                  return;
                }

                setPlaybackProgress(progress);
                setPlaying(!progress.isPaused && !progress.isBuffering);
              },
            );
            decorateSpotifyEmbedIframe(container, integration, playerHeight, playerTitle);
            setControllerReady(true);
            setControllerReadyVersion((version) => version + 1);
          },
        );
      })
      .catch(() => {
        if (!canceled) {
          setFallback(true);
        }
      });

    return () => {
      canceled = true;
      removePlaybackListenersRef.current?.();
      removePlaybackListenersRef.current = undefined;
      controllerRef.current?.destroy?.();
      controllerRef.current = undefined;
      setControllerReady(false);
      container.replaceChildren();
    };
  }, [integration, playerHeight, playerTitle, uri]);

  useEffect(() => {
    if (!playing || !playbackProgress.known || playbackProgress.duration <= 0) {
      return undefined;
    }

    const interval = window.setInterval(() => {
      setPlaybackProgress((progress) => {
        if (
          progress.isPaused ||
          progress.isBuffering ||
          !progress.known ||
          progress.duration <= 0 ||
          progress.position >= progress.duration
        ) {
          return progress;
        }

        return {
          ...progress,
          position: Math.min(progress.duration, progress.position + 1000),
        };
      });
    }, 1000);

    return () => window.clearInterval(interval);
  }, [playbackProgress.duration, playbackProgress.known, playing]);

  useEffect(() => {
    const controller = controllerRef.current;

    if (
      !controller ||
      autoplayRequestId <= 0 ||
      lastAutoplayRequestRef.current === autoplayRequestId
    ) {
      return;
    }

    lastAutoplayRequestRef.current = autoplayRequestId;
    void playSpotifyEmbed(controller).then((played) => {
      if (played) {
        setPlaying(true);
      }
    });
  }, [autoplayRequestId, controllerReadyVersion]);

  async function handlePlaybackToggle() {
    const controller = controllerRef.current;

    if (!controller) {
      return;
    }

    const nextPlaying = await toggleSpotifyPlayback(controller, playing);

    if (nextPlaying !== undefined) {
      setPlaying(nextPlaying);
    }
  }

  const progressPercent = spotifyPlaybackProgressPercent(playbackProgress);
  const statusText = fallback
    ? "Open to play"
    : playbackProgress.isBuffering
      ? "Buffering"
      : playing
        ? "Playing"
        : "Ready";
  const progressLabel = playbackProgress.known
    ? `${formatSpotifyPlaybackTime(playbackProgress.position)} / ${formatSpotifyPlaybackTime(
        playbackProgress.duration,
      )}`
    : statusText;

  return (
    <div
      className="overflow-hidden rounded-card border border-line bg-canvas/55"
      data-testid="profile-spotify-custom-player"
    >
      <div className="relative isolate min-h-32 overflow-hidden p-3">
        {metadata.imageUrl ? (
          <img
            alt=""
            aria-hidden="true"
            className="absolute inset-0 -z-20 size-full object-cover opacity-20 blur-2xl"
            decoding="async"
            loading="lazy"
            src={metadata.imageUrl}
          />
        ) : null}
        <div className="absolute inset-0 -z-10 bg-canvas/72" />
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-card border border-line bg-surface/70 text-text shadow-soft">
            {metadata.imageUrl ? (
              <img
                alt=""
                className="size-full object-cover"
                decoding="async"
                loading="lazy"
                src={metadata.imageUrl}
                data-testid="profile-spotify-artwork"
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
            {description ? (
              <span className="mt-1 line-clamp-2 block text-xs leading-5 text-muted">
                {description}
              </span>
            ) : null}
          </span>
          <a
            className="grid size-9 shrink-0 place-items-center rounded-card border border-line bg-canvas/65 text-muted transition duration-fluid ease-fluid hover:border-line-strong hover:bg-surface hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            href={integration.sourceUrl}
            rel="noopener noreferrer"
            target="_blank"
            aria-label="Open in Spotify"
          >
            <ExternalLink aria-hidden="true" size={16} />
          </a>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <button
            type="button"
            className="grid size-11 shrink-0 place-items-center rounded-full border border-line bg-accent text-accent-contrast shadow-soft transition duration-fluid ease-fluid hover:-translate-y-0.5 hover:shadow-lift focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:translate-y-0"
            onClick={handlePlaybackToggle}
            disabled={fallback || !controllerReady}
            aria-label={playing ? "Pause Spotify music" : "Play Spotify music"}
            data-testid="profile-spotify-play-button"
          >
            {playing ? (
              <Pause aria-hidden="true" size={18} />
            ) : (
              <Play aria-hidden="true" size={18} />
            )}
          </button>
          <div className="min-w-0 flex-1">
            <div className="h-1.5 overflow-hidden rounded-full bg-line">
              <div
                className="h-full rounded-full bg-accent transition-[width] duration-fluid ease-fluid"
                data-testid="profile-spotify-progress-bar"
                role="progressbar"
                aria-label="Spotify playback progress"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(progressPercent)}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <div className="mt-1 flex items-center justify-between gap-3 text-[0.7rem] font-semibold uppercase text-muted">
              <span className="truncate">{integrationLabel(integration)}</span>
              <span data-testid="profile-spotify-progress-time">{progressLabel}</span>
            </div>
          </div>
        </div>
        <div
          className="pointer-events-none absolute size-px overflow-hidden opacity-0"
          aria-hidden="true"
          data-testid="profile-spotify-provider-frame"
        >
          <div ref={containerRef} />
        </div>
      </div>
    </div>
  );
}

function loadSpotifyIframeApi(): Promise<SpotifyIframeApi> {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return Promise.reject(new Error("Spotify embeds require a browser."));
  }

  if (window.__thiaSpotifyIframeApi) {
    return Promise.resolve(window.__thiaSpotifyIframeApi);
  }

  if (spotifyIframeApiPromise) {
    return spotifyIframeApiPromise;
  }

  const promise = new Promise<SpotifyIframeApi>((resolve, reject) => {
    const existingCallback = window.onSpotifyIframeApiReady;
    const timeout = window.setTimeout(() => {
      reject(new Error("Spotify embed API did not load."));
    }, 10000);

    window.onSpotifyIframeApiReady = (api) => {
      window.clearTimeout(timeout);
      window.__thiaSpotifyIframeApi = api;
      existingCallback?.(api);
      resolve(api);
    };

    const existingScript = document.querySelector<HTMLScriptElement>(
      'script[data-thia-spotify-iframe-api="true"]',
    );

    if (existingScript) {
      existingScript.addEventListener("error", () => {
        window.clearTimeout(timeout);
        reject(new Error("Spotify embed API failed to load."));
      }, { once: true });
      return;
    }

    const script = document.createElement("script");
    script.async = true;
    script.dataset.thiaSpotifyIframeApi = "true";
    script.src = "https://open.spotify.com/embed/iframe-api/v1";
    script.addEventListener("error", () => {
      window.clearTimeout(timeout);
      reject(new Error("Spotify embed API failed to load."));
    }, { once: true });
    document.body.appendChild(script);
  }).catch((error) => {
    spotifyIframeApiPromise = undefined;
    throw error;
  });
  spotifyIframeApiPromise = promise;

  return promise;
}

function decorateSpotifyEmbedIframe(
  container: HTMLElement,
  integration: ProfileIntegrationCard,
  height: number,
  title: string,
) {
  window.requestAnimationFrame(() => {
    const iframe = container.querySelector("iframe");

    if (!iframe) {
      return;
    }

    iframe.className = "block w-full bg-transparent";
    iframe.dataset.profileEmbedProvider = integration.provider;
    iframe.dataset.testid = `profile-integration-embed-${integration.provider}`;
    iframe.height = String(height);
    iframe.loading = "lazy";
    iframe.referrerPolicy = "strict-origin-when-cross-origin";
    iframe.title = title;
    iframe.setAttribute(
      "allow",
      integration.embed?.allow ?? "autoplay; encrypted-media; picture-in-picture; fullscreen",
    );
    iframe.setAttribute(
      "sandbox",
      "allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-forms",
    );
    iframe.allowFullscreen = true;
  });
}

function attachSpotifyPlaybackListeners(
  controller: SpotifyEmbedController,
  onProgress: (progress: SpotifyPlaybackProgress) => void,
): () => void {
  if (!controller.addListener) {
    return () => {};
  }

  const handlePlaybackUpdate = (event: SpotifyPlaybackEvent) => {
    onProgress(spotifyPlaybackProgressFromEvent(event));
  };

  controller.addListener("playback_update", handlePlaybackUpdate);

  return () => {
    controller.removeListener?.("playback_update", handlePlaybackUpdate);
  };
}

function spotifyPlaybackProgressFromEvent(
  event: SpotifyPlaybackEvent,
): SpotifyPlaybackProgress {
  const rawDuration = event.data?.duration;
  const duration =
    typeof rawDuration === "number" && Number.isFinite(rawDuration)
      ? Math.max(0, rawDuration)
      : 0;
  const rawPosition = event.data?.position;
  const position =
    typeof rawPosition === "number" && Number.isFinite(rawPosition)
      ? Math.min(duration, Math.max(0, rawPosition))
      : 0;

  return {
    duration,
    isBuffering: event.data?.isBuffering === true,
    isPaused: event.data?.isPaused !== false,
    known: duration > 0,
    position,
  };
}

function spotifyPlaybackProgressPercent(progress: SpotifyPlaybackProgress): number {
  if (!progress.known || progress.duration <= 0) {
    return 0;
  }

  return Math.min(100, Math.max(0, (progress.position / progress.duration) * 100));
}

function formatSpotifyPlaybackTime(value: number): string {
  const totalSeconds = Math.max(0, Math.floor(value / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

async function playSpotifyEmbed(controller: SpotifyEmbedController): Promise<boolean> {
  try {
    if (controller.play) {
      await controller.play();
      return true;
    }

    if (controller.resume) {
      await controller.resume();
      return true;
    }

    await controller.togglePlay?.();
    return true;
  } catch {
    // Browser/provider autoplay policy can still block this even after consent.
    return false;
  }
}

async function toggleSpotifyPlayback(
  controller: SpotifyEmbedController,
  playing: boolean,
): Promise<boolean | undefined> {
  try {
    if (playing && controller.pause) {
      await controller.pause();
      return false;
    }

    if (controller.togglePlay) {
      await controller.togglePlay();
      return !playing;
    }

    return (await playSpotifyEmbed(controller)) ? true : undefined;
  } catch {
    return undefined;
  }
}

function spotifyIntegrationUri(integration: ProfileIntegrationCard): string | undefined {
  if (
    integration.provider !== "spotify" ||
    !["track", "album", "playlist"].includes(integration.resourceType)
  ) {
    return undefined;
  }

  return `spotify:${integration.resourceType}:${integration.resourceId}`;
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
