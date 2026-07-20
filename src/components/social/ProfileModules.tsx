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
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
} from "react";
import { AnimatePresence, motion } from "motion/react";
import { cn } from "../../lib/classNames";
import {
  getProfileModuleDefinition,
  PROFILE_CANVAS_DESKTOP_COLUMNS,
  PROFILE_CANVAS_DESKTOP_ROWS,
  isProfileModuleType,
  profileModulePresentation,
  profileModuleBadges,
  profileModuleFallbackTitle,
  profileModuleGridSize,
  profileModuleGridSpan,
  profileModuleHasContent,
  profileModuleSpanRole,
  profileModuleTwitchDisplayModeForSize,
  profileGridModuleSizeSpan,
  renderableProfileModules,
  type ProfileGridModuleSize,
  type ProfileModuleFreshness,
  type ProfileModulePresentation,
  type ProfileModulePresentationTier,
} from "../../lib/profileModuleRegistry";
import {
  defaultProfileLayoutPreset,
  profileLayoutMaxColumns,
} from "../../lib/profileLayoutPresets";
import { profileCanvasGlassTreatment } from "../../lib/profileVisualTreatments";
import {
  attachSpotifyPlaybackListeners,
  emptySpotifyPlaybackProgress,
  formatSpotifyPlaybackTime,
  loadSpotifyIframeApi,
  playSpotifyEmbed,
  spotifyPlaybackProgressPercent,
  spotifyResourceUri,
  toggleSpotifyPlayback,
  type SpotifyEmbedController,
  type SpotifyPlaybackProgress,
} from "../../lib/spotifyIframe";
import type {
  BadgeRarity,
  ProfileCanvasMovementContext,
  ProfileLayoutPreset,
  ProfileIntegrationCard,
  ProfileModule,
  ProfileModuleLayout,
  ProfileModuleLink,
  ProfileModuleMediaItem,
  ProfileModulePlaylistTrack,
  ProfileModuleUploadedAudio,
  ProfileModuleUploadedVideo,
  ProfileConnectionPlatform,
  UserBadge,
} from "../../lib/types";
import { ApiStateNotice } from "../ui/ApiStateNotice";
import { FocusAutoplayVideo } from "../ui/FocusAutoplayVideo";
import { MediaPlayer, type MediaPlayerLayout } from "../ui/MediaPlayer";
import { CompactStateNotice } from "../ui/RouteState";
import { SegmentedControl } from "../ui/SegmentedControl";
import { ProfileGrid, ProfileGridModule } from "./ProfileGrid";
import { ProfileConnectionIcon } from "./ProfileConnectionIcon";
import { RichText } from "./RichText";

const PROFILE_CANVAS_COLUMNS = PROFILE_CANVAS_DESKTOP_COLUMNS;
const PROFILE_CANVAS_ROWS = PROFILE_CANVAS_DESKTOP_ROWS;
const PROFILE_MUSIC_AUTOPLAY_VOLUME = 0.42;

function isProfileShareCaptureMode(): boolean {
  return (
    typeof window !== "undefined" &&
    (window.location.pathname === "/share-render" ||
      window.location.pathname.startsWith("/share-render/"))
  );
}

type AlbumArtworkTextTone = "black" | "white";

type ProfileModulesSectionProps = {
  badges: UserBadge[];
  canvasGlass?: number | undefined;
  error: unknown;
  isOwnProfile: boolean;
  layoutPreset?: ProfileLayoutPreset | undefined;
  loading: boolean;
  musicAutoplay?: ProfileMusicAutoplayRequest | undefined;
  modules: ProfileModule[];
  editing?: ProfileModuleGridEditing | undefined;
  renderModuleContent?: ProfileModuleContentRenderer | undefined;
};

export type ProfileModuleRenderMode = "canvas" | "mobile-stack";

const mobileProfileMediaQuery = "(max-width: 1023px)";

function subscribeToMobileProfile(
  onStoreChange: () => void,
): () => void {
  const query = window.matchMedia(mobileProfileMediaQuery);
  query.addEventListener("change", onStoreChange);

  return () => query.removeEventListener("change", onStoreChange);
}

function mobileProfileSnapshot(): boolean {
  return window.matchMedia(mobileProfileMediaQuery).matches;
}

function serverMobileProfileSnapshot(): boolean {
  return false;
}

function useMobileProfilePresentation(): boolean {
  return useSyncExternalStore(
    subscribeToMobileProfile,
    mobileProfileSnapshot,
    serverMobileProfileSnapshot,
  );
}

function useAlbumArtworkTextTone(
  imageUrl: string | undefined,
  enabled: boolean,
): AlbumArtworkTextTone {
  const [sample, setSample] = useState<{
    imageUrl: string;
    tone: AlbumArtworkTextTone;
  } | null>(null);

  useEffect(() => {
    if (!enabled || !imageUrl || typeof window === "undefined") {
      return undefined;
    }

    let cancelled = false;
    const image = new Image();
    const artworkUrl = new URL(imageUrl, window.location.href);

    if (artworkUrl.origin !== window.location.origin) {
      image.crossOrigin = "anonymous";
    }

    image.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        const width = 24;
        const height = 24;
        canvas.width = width;
        canvas.height = height;

        const context = canvas.getContext("2d", { willReadFrequently: true });
        if (!context) {
          return;
        }

        context.drawImage(image, 0, 0, width, height);
        const sampleTop = Math.floor(height * 0.42);
        const pixels = context.getImageData(0, sampleTop, width, height - sampleTop).data;
        let totalLuminance = 0;
        let sampleCount = 0;

        for (let index = 0; index < pixels.length; index += 4) {
          const alpha = pixels[index + 3] ?? 0;

          if (alpha < 32) {
            continue;
          }

          const red = pixels[index] ?? 0;
          const green = pixels[index + 1] ?? 0;
          const blue = pixels[index + 2] ?? 0;
          totalLuminance += 0.2126 * red + 0.7152 * green + 0.0722 * blue;
          sampleCount += 1;
        }

        if (!cancelled) {
          const averageLuminance = sampleCount > 0 ? totalLuminance / sampleCount : 0;
          setSample({
            imageUrl,
            tone: averageLuminance >= 148 ? "black" : "white",
          });
        }
      } catch {
        if (!cancelled) {
          setSample({ imageUrl, tone: "white" });
        }
      }
    };

    image.onerror = () => {
      if (!cancelled) {
        setSample({ imageUrl, tone: "white" });
      }
    };
    image.src = artworkUrl.href;

    return () => {
      cancelled = true;
    };
  }, [enabled, imageUrl]);

  return enabled && imageUrl && sample?.imageUrl === imageUrl ? sample.tone : "white";
}

function albumArtworkTextClass(tone: AlbumArtworkTextTone): string {
  return tone === "black" ? "text-black" : "text-white";
}

function albumArtworkMutedTextClass(tone: AlbumArtworkTextTone): string {
  return tone === "black" ? "text-black/75" : "text-white/80";
}

function albumArtworkOverlayClass(tone: AlbumArtworkTextTone): string {
  return tone === "black" ? "bg-white/42" : "bg-black/46";
}

function albumArtworkControlSurfaceClass(tone: AlbumArtworkTextTone): string {
  return tone === "black"
    ? "border-black/15 bg-white/55 text-black"
    : "border-white/20 bg-black/42 text-white";
}

export type ProfileMusicAutoplayRequest = {
  requestId: number;
  targetModuleId: number;
};

export function ProfileModulesSection({
  badges,
  canvasGlass,
  error,
  isOwnProfile,
  layoutPreset = defaultProfileLayoutPreset,
  loading,
  musicAutoplay,
  modules,
  editing,
  renderModuleContent,
}: ProfileModulesSectionProps) {
  const mobilePresentation = useMobileProfilePresentation();
  const availableModules = editing
    ? modules.filter((module) => isProfileModuleType(module.type))
    : renderableProfileModules(modules, badges);
  const renderableModules = mobilePresentation
    ? sortProfileModulesForMobileStack(availableModules)
    : sortProfileModulesForCanvas(availableModules);

  if (!loading && !error && renderableModules.length === 0 && !isOwnProfile) {
    return null;
  }

  return (
    <section
      aria-label="Profile canvas"
      className="min-w-0"
      data-profile-presentation={mobilePresentation ? "mobile-stack" : "canvas"}
      data-testid="profile-modules"
    >
      {loading ? (
        <ApiStateNotice
          className="mb-3"
          kind="loading"
          title="Loading modules"
          text="Loading modules."
        />
      ) : null}

      {!loading && error ? (
        <ApiStateNotice
          className="mb-3"
          kind="error"
          title="Profile modules are not available"
          text="The profile basics are still here. Try refreshing in a moment."
        />
      ) : null}

      {renderableModules.length > 0 ? (
        mobilePresentation ? (
          <div
            className="min-w-0 w-full"
            data-profile-mobile-stack="true"
            data-testid="profile-module-grid"
          >
            <ProfileModuleMobileStack
              badges={badges}
              canvasGlass={canvasGlass}
              modules={renderableModules}
              musicAutoplay={musicAutoplay}
              renderModuleContent={renderModuleContent}
            />
          </div>
        ) : (
          <ProfileModuleGrid
            modules={renderableModules}
            badges={badges}
            canvasGlass={canvasGlass}
            editing={editing}
            layoutPreset={layoutPreset}
            musicAutoplay={musicAutoplay}
            renderModuleContent={renderModuleContent}
          />
        )
      ) : (
        <>
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

type ProfileModuleMobileStackProps = {
  badges: UserBadge[];
  canvasGlass?: number | undefined;
  modules: ProfileModule[];
  musicAutoplay?: ProfileMusicAutoplayRequest | undefined;
  renderModuleContent?: ProfileModuleContentRenderer | undefined;
};

function ProfileModuleMobileStack({
  badges,
  canvasGlass = 58,
  modules,
  musicAutoplay,
  renderModuleContent,
}: ProfileModuleMobileStackProps) {
  const captureMode = isProfileShareCaptureMode();
  const { moduleSurfacePercent, normalizedGlass } =
    profileCanvasGlassTreatment(canvasGlass);

  return (
    <div
      className="grid min-w-0 w-full grid-cols-[minmax(0,1fr)] gap-3"
      data-profile-canvas-glass={normalizedGlass}
      data-testid="profile-module-stack"
      style={
        {
          "--profile-module-glass-alpha": `${moduleSurfacePercent}%`,
        } as CSSProperties
      }
    >
      {modules.map((module) => {
        const size = profileModuleMobileStackSize(module);
        const musicAutoplayRequestId =
          musicAutoplay?.targetModuleId === module.id
            ? musicAutoplay.requestId
            : undefined;

        return (
          <div
            className={cn(
              "min-w-0 w-full overflow-hidden rounded-card",
              profileModuleMobileStackHeightClass(module),
            )}
            data-profile-mobile-module={module.type}
            data-profile-grid-module="true"
            data-profile-grid-size={size}
            data-render-deferred={captureMode ? undefined : "profile-module"}
            data-testid={`profile-grid-module-${module.type}`}
            key={module.id}
          >
            {renderModuleContent?.(module, size, "mobile-stack") ?? (
              <ProfileModuleCard
                badges={badges}
                module={module}
                musicAutoplayRequestId={musicAutoplayRequestId}
                presentationMode="mobile-stack"
                size={size}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function profileModuleMobileStackSize(
  module: ProfileModule,
): ProfileGridModuleSize {
  if (module.type === "activity") {
    return "6x10";
  }

  if (module.type === "profile_info") {
    return "6x4";
  }

  const twitchDisplayMode = profileModuleEffectiveTwitchDisplayMode(module);

  if (twitchDisplayMode === "stream_chat") {
    return "6x5";
  }

  if (twitchDisplayMode === "stream") {
    return "6x4";
  }

  if (module.type === "creator_live" || module.type === "uploaded_video") {
    return "6x5";
  }

  if (
    module.type === "gallery_media" ||
    module.type === "gallery_slideshow" ||
    module.type === "gallery_feed" ||
    module.type === "uploaded_image"
  ) {
    return "6x4";
  }

  if (
    module.type === "music" ||
    module.type === "music_playlist"
  ) {
    return "6x3";
  }

  return "6x2";
}

function profileModuleMobileStackHeightClass(module: ProfileModule): string {
  if (module.type === "profile_info") {
    return "min-h-[17rem]";
  }

  if (module.type === "activity") {
    return "h-[min(38rem,70dvh)] min-h-[28rem]";
  }

  const twitchDisplayMode = profileModuleEffectiveTwitchDisplayMode(module);

  if (twitchDisplayMode === "stream_chat") {
    return "h-[clamp(34rem,78dvh,46rem)]";
  }

  if (twitchDisplayMode === "stream" || module.type === "uploaded_video") {
    return "h-[22rem]";
  }

  if (module.type === "creator_live" && !profileModuleUsesTwitchLayout(module)) {
    return "h-[22rem]";
  }

  if (
    module.type === "gallery_media" ||
    module.type === "gallery_slideshow" ||
    module.type === "gallery_feed" ||
    module.type === "uploaded_image"
  ) {
    return "min-h-[18rem]";
  }

  if (
    module.type === "music" ||
    module.type === "music_playlist"
  ) {
    return "min-h-[10rem]";
  }

  return "min-h-24";
}

function profileModuleUsesTwitchLayout(module: ProfileModule): boolean {
  return (
    module.type === "twitch_channel" ||
    (module.type === "creator_live" &&
      (module.config.platform === "twitch" ||
        module.config.sourceMode === "twitch" ||
        module.config.integration?.provider === "twitch" ||
        module.config.displayMode === "stream_status" ||
        module.config.displayMode === "stream" ||
        module.config.displayMode === "stream_chat"))
  );
}

function profileModuleEffectiveTwitchDisplayMode(
  module: ProfileModule,
): "stream_status" | "stream" | "stream_chat" | undefined {
  return profileModuleUsesTwitchLayout(module)
    ? profileModuleTwitchDisplayModeForSize(profileModuleGridSize(module))
    : undefined;
}

type ProfileModuleGridProps = {
  badges: UserBadge[];
  canvasGlass?: number | undefined;
  editing?: ProfileModuleGridEditing | undefined;
  layoutPreset?: ProfileLayoutPreset | undefined;
  maxColumns?: 6 | 12;
  musicAutoplay?: ProfileMusicAutoplayRequest | undefined;
  modules: ProfileModule[];
  renderModuleContent?: ProfileModuleContentRenderer | undefined;
};

type ProfileModuleGridEditing = {
  selectedModuleId?: number | undefined;
  onDeselectModule: () => void;
  onMoveModule: (
    moduleId: number,
    layout: ProfileModuleLayout,
    movementContext?: ProfileCanvasMovementContext,
  ) => void;
  onSelectModule: (module: ProfileModule) => void;
  renderSelectedControls?: (
    module: ProfileModule,
    size: ProfileGridModuleSize,
  ) => ReactNode;
};

export function ProfileModuleGrid({
  badges,
  canvasGlass,
  editing,
  layoutPreset = defaultProfileLayoutPreset,
  maxColumns,
  musicAutoplay,
  modules,
  renderModuleContent,
}: ProfileModuleGridProps) {
  const captureMode = isProfileShareCaptureMode();
  const renderableModules = sortProfileModulesForCanvas(
    editing
      ? modules.filter((module) => isProfileModuleType(module.type))
      : renderableProfileModules(modules, badges),
  );
  const resolvedMaxColumns = maxColumns ?? profileLayoutMaxColumns(layoutPreset);
  const gridRef = useRef<HTMLDivElement | null>(null);
  const lastDragLayoutRef = useRef<ProfileModuleLayout | undefined>(undefined);
  const suppressModuleClickRef = useRef(false);
  const [dragState, setDragState] = useState<
    | {
        moduleId: number;
        colSpan: number;
        pointerOffsetX: number;
        pointerOffsetY: number;
        rowSpan: number;
        startLayout: ProfileModuleLayout;
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

      if (!grid || !profileGridSupportsDesktopCanvas()) {
        return;
      }

      const layout = profileCanvasLayoutFromPoint(
        grid,
        event.clientX,
        event.clientY,
        activeDragState.colSpan,
        activeDragState.rowSpan,
        activeDragState.pointerOffsetX,
        activeDragState.pointerOffsetY,
      );

      if (
        lastDragLayoutRef.current &&
        profileCanvasLayoutsMatch(lastDragLayoutRef.current, layout)
      ) {
        return;
      }

      lastDragLayoutRef.current = layout;
      activeEditing.onMoveModule(activeDragState.moduleId, layout, {
        anchorModuleId: activeDragState.moduleId,
        from: {
          column: activeDragState.startLayout.column,
          row: activeDragState.startLayout.row,
        },
        to: {
          column: layout.column,
          row: layout.row,
        },
      });
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
        canvasGlass={canvasGlass}
        fitRowsToContent={!editing}
        layoutPreset={layoutPreset}
        maxColumns={resolvedMaxColumns}
        testId="profile-module-grid"
      >
        <ProfileGridModule deferRender={!captureMode} size="wide">
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
    if (
      !editing ||
      event.button !== 0 ||
      !profileGridSupportsDesktopCanvas() ||
      module.pinned
    ) {
      return;
    }

    event.preventDefault();
    suppressModuleClickRef.current = true;
    editing.onSelectModule(module);
    lastDragLayoutRef.current = layout;
    const moduleElement = event.currentTarget.closest<HTMLElement>(
      '[data-profile-grid-module="true"]',
    );
    const moduleRect = moduleElement?.getBoundingClientRect();
    setDragState({
      moduleId: module.id,
      colSpan: layout.colSpan,
      pointerOffsetX: moduleRect ? event.clientX - moduleRect.left : 0,
      pointerOffsetY: moduleRect ? event.clientY - moduleRect.top : 0,
      rowSpan: layout.rowSpan,
      startLayout: layout,
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
      canvasGlass={canvasGlass}
      fitRowsToContent={!editing}
      gridRef={gridRef}
      layoutPreset={layoutPreset}
      maxColumns={resolvedMaxColumns}
      onClick={handleGridClick}
      testId="profile-module-grid"
    >
      {renderableModules.map((module, index) => {
        const span = profileModuleGridSpan(module, layoutPreset, index);
        const definition = getProfileModuleDefinition(module.type);
        const freshness = profileModulePresentationFreshness(
          module,
          definition.freshness,
        );
        const spanRole = profileModuleSpanRole(span.size);
        const modulePresentation = profileModulePresentation(span.size);
        const selected = editing?.selectedModuleId === module.id;
        const selectedControls = selected
          ? editing?.renderSelectedControls?.(module, span.size)
          : undefined;
        const keepControlsInsideModule = span.columns >= 4 || span.rows >= 3;
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
              editing && module.pinned ? "outline outline-1 outline-line-strong" : undefined,
              editing && dragState?.moduleId === module.id
                ? "z-20 scale-[1.012] opacity-85 drop-shadow-2xl"
                : undefined,
              selected
                ? "z-30 ring-2 ring-focus ring-offset-2 ring-offset-canvas"
                : undefined,
            )}
            layout={safeLayout}
            deferRender={!captureMode}
            dragging={editing && dragState?.moduleId === module.id}
            pinned={module.pinned}
            presentation={{
              compact:
                modulePresentation.tier === "micro" ||
                modulePresentation.tier === "compact",
              density: definition.density,
              emptyPolicy: definition.emptyPolicy,
              freshness,
              primaryAction: definition.primaryAction,
              purpose: definition.purpose,
              spanRole,
              tier: modulePresentation.tier,
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
                  "absolute right-2 top-2 z-20 grid size-8 place-items-center rounded-control border border-line bg-surface/90 text-text shadow-soft backdrop-blur-veil transition duration-fluid ease-fluid hover:border-line-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-60",
                  module.pinned ? "cursor-not-allowed" : "cursor-grab active:cursor-grabbing",
                  selected ? "ring-1 ring-focus/35" : undefined,
                )}
                aria-label={
                  module.pinned
                    ? `${profileModuleFallbackTitle(module.type)} module is pinned`
                    : `Drag ${profileModuleFallbackTitle(module.type)} module`
                }
                title={
                  module.pinned
                    ? `${profileModuleFallbackTitle(module.type)} is pinned`
                    : `Drag ${profileModuleFallbackTitle(module.type)}`
                }
                disabled={module.pinned}
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
            <div
              className={cn(
                "h-full min-h-0 min-w-0",
                editing ? "pointer-events-none select-none" : undefined,
              )}
              aria-hidden={editing ? true : undefined}
              data-profile-module-content-interactive={editing ? "false" : "true"}
              data-testid={`profile-grid-module-content-${module.id}`}
              inert={editing ? true : undefined}
            >
              {renderModuleContent?.(module, span.size, "canvas") ?? (
                <ProfileModuleCard
                  module={module}
                  badges={badges}
                  editing={Boolean(editing)}
                  musicAutoplayRequestId={musicAutoplayRequestId}
                  size={span.size}
                />
              )}
            </div>
            <AnimatePresence initial={false}>
              {selectedControls ? (
                <motion.div
                  className={cn(
                    "absolute left-1/2 top-[calc(100%+0.65rem)] z-50 w-[min(30rem,calc(100vw-2rem))] -translate-x-1/2 max-md:fixed max-md:inset-x-3 max-md:bottom-[calc(5.75rem+env(safe-area-inset-bottom))] max-md:top-auto max-md:w-auto max-md:translate-x-0",
                    keepControlsInsideModule
                      ? "lg:left-auto lg:right-2 lg:top-2 lg:w-[min(30rem,calc(100%-1rem))] lg:translate-x-0"
                      : undefined,
                  )}
                  data-profile-edit-control="true"
                  data-profile-module-settings-popover="true"
                  data-testid="profile-selected-module-popover"
                  initial={{ opacity: 0, scale: 0.96, y: -8 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96, y: -8 }}
                  transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                >
                  {selectedControls}
                </motion.div>
              ) : null}
            </AnimatePresence>
          </ProfileGridModule>
        );
      })}
    </ProfileGrid>
  );
}

function profileModuleCanvasPriority(module: ProfileModule): number {
  if (module.type === "profile_info") {
    return 0;
  }

  if (module.type === "activity") {
    return 2;
  }

  return 1;
}

function sortProfileModulesForCanvas(modules: ProfileModule[]): ProfileModule[] {
  return [...modules].sort((first, second) => {
    const priority =
      profileModuleCanvasPriority(first) - profileModuleCanvasPriority(second);

    if (priority !== 0) {
      return priority;
    }

    return (
      (first.layout?.row ?? Number.MAX_SAFE_INTEGER) -
        (second.layout?.row ?? Number.MAX_SAFE_INTEGER) ||
      (first.layout?.column ?? Number.MAX_SAFE_INTEGER) -
        (second.layout?.column ?? Number.MAX_SAFE_INTEGER) ||
      first.position - second.position ||
      first.id - second.id
    );
  });
}

function sortProfileModulesForMobileStack(
  modules: ProfileModule[],
): ProfileModule[] {
  return [...modules].sort((first, second) => {
    const priority =
      profileModuleCanvasPriority(first) - profileModuleCanvasPriority(second);

    if (priority !== 0) {
      return priority;
    }

    return first.position - second.position || first.id - second.id;
  });
}

function profileGridSupportsDesktopCanvas(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(min-width: 1024px)").matches
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
  pointerOffsetX: number,
  pointerOffsetY: number,
): ProfileModuleLayout {
  const rect = grid.getBoundingClientRect();
  const styles = window.getComputedStyle(grid);
  const paddingLeft = Number.parseFloat(styles.paddingLeft) || 0;
  const paddingTop = Number.parseFloat(styles.paddingTop) || 0;
  const paddingRight = Number.parseFloat(styles.paddingRight) || 0;
  const columnGap = Number.parseFloat(styles.columnGap) || 0;
  const rowGap = Number.parseFloat(styles.rowGap) || columnGap;
  const activeColumns =
    Number.parseInt(styles.getPropertyValue("--profile-grid-active-columns"), 10) ||
    PROFILE_CANVAS_COLUMNS;
  const contentWidth = Math.max(1, grid.clientWidth - paddingLeft - paddingRight);
  const cellSize = Math.max(
    1,
    (contentWidth - columnGap * (activeColumns - 1)) / activeColumns,
  );
  const stepX = cellSize + columnGap;
  const stepY = cellSize + rowGap;
  const moduleLeft = clientX - pointerOffsetX;
  const moduleTop = clientY - pointerOffsetY;
  const rawColumn = Math.round((moduleLeft - rect.left - paddingLeft) / stepX) + 1;
  const rawRow = Math.round((moduleTop - rect.top - paddingTop) / stepY) + 1;

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

function profileModulePresentationFreshness(
  module: ProfileModule,
  fallback: ProfileModuleFreshness,
): ProfileModuleFreshness {
  return module.config.integration ? "cached" : fallback;
}

type ProfileModuleContentRenderer = (
  module: ProfileModule,
  size: ProfileGridModuleSize,
  mode: ProfileModuleRenderMode,
) => ReactNode | undefined;

type ProfileModuleCardProps = {
  badges: UserBadge[];
  editing?: boolean | undefined;
  musicAutoplayRequestId?: number | undefined;
  module: ProfileModule;
  presentationMode?: ProfileModuleRenderMode | undefined;
  size?: ProfileGridModuleSize | undefined;
};

export function ProfileModuleCard({
  badges,
  editing = false,
  musicAutoplayRequestId = 0,
  module,
  presentationMode = "canvas",
  size = "1x1",
}: ProfileModuleCardProps) {
  const title = module.title ?? profileModuleFallbackTitle(module.type);
  const definition = getProfileModuleDefinition(module.type);
  const presentation = profileModulePresentation(size);
  const { spanRole } = presentation;
  const slim = presentation.isSlim;
  const compact = profilePresentationIsCompact(presentation.tier);
  const publicSurface = module.type === "gallery_media";
  const transparentCollectionSurface =
    module.type === "links" ||
    module.type === "connections" ||
    module.type === "featured_badges" ||
    module.type === "badge_display";
  const showEditingHeader =
    editing && !compact && !slim && !transparentCollectionSurface;

  return (
    <article
      className={cn(
        "grid h-full min-h-0 min-w-0 overflow-hidden rounded-card focus-within:border-line-strong",
        presentationMode === "canvas" ? "profile-grid-scaled-content" : "w-full",
        editing
          ? transparentCollectionSurface
            ? "grid-rows-[1fr] border border-transparent bg-transparent p-0 shadow-none"
            : compact
              ? "grid-rows-[1fr] border border-line bg-surface/58 p-2 shadow-soft backdrop-blur-veil"
              : slim
                ? "grid-rows-[1fr] border border-line bg-surface/58 p-2 shadow-soft backdrop-blur-veil"
                : "grid-rows-[auto_1fr] gap-2 border border-line bg-surface/58 p-3 shadow-soft backdrop-blur-veil"
          : publicSurface
            ? "grid-rows-[1fr] border border-line bg-surface/58 p-3 shadow-soft backdrop-blur-veil"
            : "grid-rows-[1fr] border border-transparent bg-transparent p-0 shadow-none",
      )}
      data-profile-module-action={definition.primaryAction}
      data-profile-module-compact={String(compact)}
      data-profile-module-density={definition.density}
      data-profile-module-empty-policy={definition.emptyPolicy}
      data-profile-module-freshness={definition.freshness}
      data-profile-module-fit-tier={presentation.tier}
      data-profile-module-purpose={definition.purpose}
      data-profile-module-render-mode={presentationMode}
      data-profile-module-shell="true"
      data-profile-module-span-role={spanRole}
      data-profile-module-tier={presentation.tier}
      data-profile-module-transparent-surface={
        transparentCollectionSurface ? "true" : undefined
      }
      data-testid={`profile-module-${module.type}`}
    >
      {showEditingHeader ? (
        <header className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-text">{title}</h3>
        </header>
      ) : null}
      <div className="min-h-0 min-w-0 overflow-hidden">
        <ProfileModuleContent
          module={module}
          editing={editing}
          musicAutoplayRequestId={musicAutoplayRequestId}
          badges={badges}
          presentation={presentation}
          presentationMode={presentationMode}
          size={size}
        />
      </div>
    </article>
  );
}

function ProfileModuleContent({
  badges,
  editing,
  musicAutoplayRequestId = 0,
  module,
  presentation,
  presentationMode,
  size,
}: Omit<ProfileModuleCardProps, "editing"> & {
  editing: boolean;
  presentation: ProfileModulePresentation;
  presentationMode: ProfileModuleRenderMode;
}) {
  const moduleCategory = getProfileModuleDefinition(module.type).category;
  const { span, spanRole } = presentation;
  const slim = presentation.isSlim;
  const singleRow = presentation.isSingleRow;
  const compact = profilePresentationIsCompact(presentation.tier);
  const hasDetails = presentation.showSecondaryText;

  if (module.type === "activity") {
    return (
      <p className={cn("text-sm text-muted", slim ? "truncate leading-5" : "leading-6")}>
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

  if (module.type === "links" || module.type === "connections") {
    const links = module.config.links ?? [];
    const connectionLayout = profileModuleConnectionLayout(span.size);
    const visibleCapacity =
      links.length > connectionLayout.capacity
        ? connectionLayout.capacity - 1
        : connectionLayout.capacity;
    const visibleLinks = links.slice(0, visibleCapacity);
    const hiddenCount = Math.max(0, links.length - visibleLinks.length);
    const renderedSlotCount = visibleLinks.length + (hiddenCount > 0 ? 1 : 0);

    if (presentationMode === "mobile-stack") {
      return (
        <div
          className="grid min-w-0 gap-2 overflow-visible"
          data-profile-module-visible-links={links.length}
          data-profile-connections-compact="mobile-rows"
        >
          {links.map((link) => (
            <ProfileModuleLinkCompactRow
              key={`${link.label}-${link.url}`}
              link={link}
            />
          ))}
        </div>
      );
    }

    if (connectionLayout.variant === "chips") {
      return (
        <div
          className="flex h-full min-w-0 items-center gap-2 overflow-hidden"
          data-profile-module-visible-links={visibleLinks.length}
          data-profile-connections-compact="wide-chips"
        >
          {visibleLinks.map((link) => (
            <ProfileModuleLinkWideChip
              key={`${link.label}-${link.url}`}
              link={link}
            />
          ))}
          {hiddenCount > 0 ? (
            <span
              className="inline-flex h-9 shrink-0 items-center rounded-full border border-dashed border-line bg-canvas/45 px-3 text-xs font-semibold text-muted"
              data-testid="profile-connections-overflow-count"
            >
              +{hiddenCount}
            </span>
          ) : null}
        </div>
      );
    }

    if (connectionLayout.variant === "icons") {
      return (
        <div
          className="grid h-full min-h-0 min-w-0 content-start place-items-center gap-1.5 overflow-hidden"
          data-profile-module-visible-links={visibleLinks.length}
          data-profile-connections-compact="icon-grid"
          style={{
            gridTemplateColumns: `repeat(${connectionLayout.columns}, minmax(0, 1fr))`,
          }}
        >
          {visibleLinks.map((link) => (
            <ProfileModuleConnectionIconOnly
              key={`${link.label}-${link.url}`}
              link={link}
            />
          ))}
          {hiddenCount > 0 ? (
            <span
              className="grid size-9 shrink-0 place-items-center rounded-full border border-dashed border-line bg-canvas/45 text-xs font-semibold text-muted"
              data-testid="profile-connections-overflow-count"
            >
              +{hiddenCount}
            </span>
          ) : null}
        </div>
      );
    }

    return (
      <div
        className={cn(
          "grid h-full min-h-0 min-w-0 gap-1.5 overflow-hidden",
        )}
        data-profile-module-visible-links={visibleLinks.length}
        data-profile-connections-compact="dense-rows"
        style={{
          gridTemplateColumns: `repeat(${connectionLayout.columns}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${Math.max(
            1,
            Math.ceil(renderedSlotCount / connectionLayout.columns),
          )}, minmax(0, 1fr))`,
        }}
      >
        {visibleLinks.map((link) => (
          <ProfileModuleLinkCompactRow
            key={`${link.label}-${link.url}`}
            link={link}
            dense
          />
        ))}
        {hiddenCount > 0 ? (
          <span
            className="flex h-full min-h-0 min-w-0 items-center justify-center rounded-card border border-dashed border-line bg-canvas/45 px-1.5 text-xs font-semibold text-muted"
            data-testid="profile-connections-overflow-count"
          >
            +{hiddenCount}
          </span>
        ) : null}
      </div>
    );
  }

  if (module.type === "featured_badges" || module.type === "badge_display") {
    const selectedBadges = profileModuleBadges(module, badges);
    const visibleBadges = compact
      ? selectedBadges.slice(0, presentation.tier === "micro" ? 2 : 3)
      : slim
        ? selectedBadges.slice(0, singleRow ? 4 : 6)
        : selectedBadges;
    const hiddenCount = Math.max(0, selectedBadges.length - visibleBadges.length);

    if (slim && !singleRow) {
      return (
        <div
          className="grid h-full min-h-0 min-w-0 grid-cols-2 gap-1.5 overflow-hidden"
          data-profile-module-visible-badges={visibleBadges.length}
          style={{
            gridTemplateRows: `repeat(${Math.max(
              1,
              Math.ceil(visibleBadges.length / 2),
            )}, minmax(0, 1fr))`,
          }}
        >
          {visibleBadges.map((userBadge, index) => (
            <span
              key={userBadge.id}
              className={cn(
                "inline-flex h-full min-h-0 min-w-0 items-center gap-1.5 overflow-hidden rounded-control border px-2 text-xs font-semibold",
                rarityChipClass(userBadge.badge.rarity),
              )}
              title={userBadge.badge.description ?? userBadge.badge.name}
            >
              <BadgeCheck aria-hidden="true" size={13} className="shrink-0" />
              <span className="min-w-0 flex-1 truncate">
                {userBadge.badge.name}
              </span>
              {index === visibleBadges.length - 1 && hiddenCount > 0 ? (
                <span className="shrink-0 rounded-full border border-dashed border-current/40 px-1.5 py-0.5 text-[0.62rem]">
                  +{hiddenCount}
                </span>
              ) : null}
            </span>
          ))}
        </div>
      );
    }

    if (slim) {
      return (
        <div
          className="flex h-full min-w-0 items-center gap-2 overflow-hidden"
          data-profile-module-visible-badges={visibleBadges.length}
        >
          {visibleBadges.map((userBadge) => (
            <span
              key={userBadge.id}
              className={cn(
                "inline-flex h-9 min-w-0 flex-1 basis-0 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold",
                rarityChipClass(userBadge.badge.rarity),
              )}
              title={userBadge.badge.description ?? userBadge.badge.name}
            >
              <BadgeCheck aria-hidden="true" size={13} className="shrink-0" />
              <span className="min-w-0 truncate">{userBadge.badge.name}</span>
            </span>
          ))}
          {hiddenCount > 0 ? (
            <span className="inline-flex h-9 shrink-0 items-center rounded-full border border-dashed border-line bg-canvas/45 px-3 text-xs font-semibold text-muted">
              +{hiddenCount}
            </span>
          ) : null}
        </div>
      );
    }

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

  if (
    module.type === "gallery_media" ||
    module.type === "uploaded_image" ||
    module.type === "gallery_slideshow" ||
    module.type === "gallery_feed"
  ) {
    const mediaItems = module.config.mediaItems ?? [];

    if (module.type === "uploaded_image" || module.type === "gallery_media") {
      return (
        <ProfileImageModulePhoto
          item={mediaItems[0]}
          showCaption={hasDetails}
        />
      );
    }

    if (module.type === "gallery_slideshow") {
      return (
        <ProfileImageModuleSlideshow
          items={mediaItems}
          showCaption={hasDetails}
        />
      );
    }

    const visibleMediaItems = compact ? mediaItems.slice(0, 1) : mediaItems;

    if (presentationMode === "mobile-stack") {
      return (
        <div
          className="grid min-w-0 grid-cols-2 gap-2 overflow-visible"
          data-profile-module-visible-media={mediaItems.length}
        >
          {mediaItems.map((item, index) => (
            <figure
              className={cn(
                "aspect-square min-w-0 overflow-hidden rounded-card border border-line bg-canvas/55",
                item.caption
                  ? "grid grid-rows-[minmax(0,1fr)_auto]"
                  : undefined,
              )}
              key={`${item.url}:${index}`}
            >
              <img
                alt=""
                className="h-full min-h-0 w-full object-cover"
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

    return (
      <div
        className={cn(
          "grid max-h-full min-w-0 auto-rows-fr gap-2 overflow-y-auto pr-1",
          spanRole === "glance"
            ? "grid-cols-1"
            : spanRole === "hero"
              ? "grid-cols-3"
              : "grid-cols-2",
        )}
        data-profile-module-visible-media={visibleMediaItems.length}
        data-profile-module-internal-scroll="true"
      >
        {visibleMediaItems.map((item, index) => (
          <figure
            key={`${item.url}:${index}`}
            className={cn(
              "min-h-0 min-w-0 overflow-hidden rounded-card border border-line bg-canvas/55",
              spanRole === "hero" && index === 0 ? "col-span-2 row-span-2" : undefined,
              item.caption && hasDetails
                ? "grid grid-rows-[minmax(0,1fr)_auto]"
                : undefined,
            )}
          >
            <img
              alt=""
              className="h-full min-h-0 w-full object-cover"
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

  if (
    module.type === "creator_live" ||
    moduleCategory === "video" ||
    module.type === "github_repo"
  ) {
    if (module.type === "uploaded_video" && module.config.video) {
      return (
        <UploadedVideoPlayer
          fallbackLabel="Uploaded video"
          module={module}
          size={size}
          video={module.config.video}
        />
      );
    }

    return (
      <ProfileModuleStaticCard
        icon={<Radio aria-hidden="true" size={17} />}
        editing={editing}
        module={module}
        presentationMode={presentationMode}
        size={size}
        fallbackLabel="Creator channel"
      />
    );
  }

  if (module.type === "music" || moduleCategory === "music") {
    if (module.type === "music_playlist") {
      return (
        <MusicPlaylistPlayer
          fallbackLabel="Playlist"
          module={module}
          autoplayRequestId={musicAutoplayRequestId}
          size={size}
        />
      );
    }

    if (module.config.audio) {
      return (
        <UploadedAudioPlayer
          audio={module.config.audio}
          fallbackLabel="Uploaded track"
          module={module}
          autoplayRequestId={musicAutoplayRequestId}
          size={size}
        />
      );
    }

    return (
      <ProfileModuleStaticCard
        icon={<Music2 aria-hidden="true" size={17} />}
        editing={editing}
        musicAutoplayRequestId={musicAutoplayRequestId}
        module={module}
        presentationMode={presentationMode}
        size={size}
        fallbackLabel="Music link"
      />
    );
  }

  const markdownTextModule =
    module.type === "about" ||
    module.type === "custom_text" ||
    module.type === "text";

  return (
    <div
      className={cn(
        "max-h-full space-y-2",
        slim || !presentation.allowInternalScroll
          ? "overflow-hidden pr-0"
          : "overflow-y-auto pr-1",
      )}
    >
      {module.config.body ? (
        <RichText
          markdown={markdownTextModule}
          text={module.config.body}
          entities={module.textEntities?.body}
          showEmbeds={!compact && !slim}
          className={cn(
            "block break-words text-sm leading-6 text-muted",
            slim
              ? singleRow
                ? "line-clamp-1 leading-5"
                : "line-clamp-2 leading-5"
              : markdownTextModule
                ? "space-y-2"
                : "whitespace-pre-wrap",
            compact && !slim
              ? "line-clamp-2"
              : presentation.tier === "showcase"
                ? "line-clamp-none"
                : presentation.tier === "spacious"
                  ? "line-clamp-6"
                  : spanRole === "summary" && !slim
                ? "line-clamp-4"
                : undefined,
          )}
        />
      ) : null}
      {presentation.showSecondaryText && module.config.statusText ? (
        <p
          className={cn(
            "rounded-card bg-canvas/55 px-3 py-2 text-sm leading-5 text-text",
            slim ? "line-clamp-1" : "line-clamp-2",
          )}
        >
          {module.config.statusText}
        </p>
      ) : null}
      {presentation.showSecondaryText && module.config.workingOn ? (
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
      {presentation.tier !== "micro" && module.config.link ? (
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

function ProfileImageModulePhoto({
  item,
  showCaption,
}: {
  item: ProfileModuleMediaItem | undefined;
  showCaption: boolean;
}) {
  if (!item) {
    return null;
  }

  return (
    <figure className="relative h-full min-h-0 min-w-0 overflow-hidden rounded-card border border-line bg-canvas/55">
      <img
        alt=""
        className="absolute inset-0 size-full object-cover"
        decoding="async"
        loading="lazy"
        src={item.url}
        data-testid="profile-image-module-photo"
      />
      {item.caption && showCaption ? (
        <figcaption className="absolute inset-x-0 bottom-0 truncate bg-canvas/78 px-3 py-2 text-xs font-semibold text-text backdrop-blur">
          {item.caption}
        </figcaption>
      ) : null}
    </figure>
  );
}

function ProfileImageModuleSlideshow({
  items,
  showCaption,
}: {
  items: ProfileModuleMediaItem[];
  showCaption: boolean;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const safeActiveIndex =
    items.length > 0 ? Math.min(activeIndex, items.length - 1) : 0;
  const activeItem = items[safeActiveIndex] ?? items[0];

  useEffect(() => {
    if (items.length <= 1) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      setActiveIndex((index) => (index + 1) % items.length);
    }, 5000);

    return () => window.clearInterval(timer);
  }, [activeIndex, items.length]);

  if (!activeItem) {
    return null;
  }

  return (
    <div
      className="relative h-full min-h-0 min-w-0 overflow-hidden rounded-card border border-line bg-canvas/55"
      data-testid="profile-slideshow-module"
    >
      <AnimatePresence mode="wait">
        <motion.figure
          key={activeItem.url}
          className="absolute inset-0"
          initial={{ opacity: 0.35, scale: 1.015 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 1.01 }}
          transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
          data-testid="profile-slideshow-slide"
        >
          <img
            alt=""
            className="size-full object-cover"
            decoding="async"
            loading="lazy"
            src={activeItem.url}
          />
          {activeItem.caption && showCaption ? (
            <figcaption className="absolute inset-x-0 bottom-0 truncate bg-canvas/78 px-3 py-2 text-xs font-semibold text-text backdrop-blur">
              {activeItem.caption}
            </figcaption>
          ) : null}
        </motion.figure>
      </AnimatePresence>
      {items.length > 1 ? (
        <div className="absolute inset-x-0 bottom-2 z-10 flex justify-center gap-1.5 px-3">
          {items.map((item, index) => (
            <button
              key={`${item.url}:${index}`}
              type="button"
              className={cn(
                "size-2.5 rounded-full border border-white/45 bg-white/45 shadow-soft transition duration-fluid ease-fluid hover:scale-110 hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
                index === safeActiveIndex ? "w-5 bg-white" : undefined,
              )}
              aria-label={`Show slide ${index + 1}`}
              aria-current={index === safeActiveIndex ? "true" : undefined}
              data-testid={`profile-slideshow-dot-${index}`}
              onClick={() => setActiveIndex(index)}
            />
          ))}
        </div>
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
  const definition = getProfileModuleDefinition(type);

  if (type === "links" || type === "connections") {
    return "Select to add connections";
  }

  if (type === "about" || type === "text") {
    return "Select to add an intro";
  }

  if (type === "custom_text") {
    return "Select to add text";
  }

  if (type === "featured_badges" || type === "badge_display") {
    return "Select to add badges";
  }

  if (definition.category === "images") {
    return "Select to add media";
  }

  if (definition.category === "video" || type === "github_repo") {
    return "Select to add a creator link";
  }

  if (definition.category === "music") {
    return "Select to add music";
  }

  return `Select to edit ${profileModuleFallbackTitle(type).toLowerCase()}`;
}

type ProfileModuleConnectionLayout = {
  capacity: number;
  columns: number;
  variant: "chips" | "icons" | "rows";
};

const profileModuleConnectionLayouts: Partial<
  Record<ProfileGridModuleSize, ProfileModuleConnectionLayout>
> = {
  "2x2": { capacity: 16, columns: 4, variant: "icons" },
  "2x3": { capacity: 6, columns: 1, variant: "rows" },
  "3x2": { capacity: 4, columns: 2, variant: "rows" },
  "4x2": { capacity: 6, columns: 3, variant: "rows" },
  "3x3": { capacity: 6, columns: 2, variant: "rows" },
  "3x4": { capacity: 8, columns: 2, variant: "rows" },
  "5x1": { capacity: 3, columns: 1, variant: "chips" },
  "6x1": { capacity: 3, columns: 1, variant: "chips" },
  "8x1": { capacity: 4, columns: 1, variant: "chips" },
  "5x2": { capacity: 6, columns: 3, variant: "rows" },
  "6x2": { capacity: 8, columns: 4, variant: "rows" },
  "8x2": { capacity: 10, columns: 5, variant: "rows" },
};

function profileModuleConnectionLayout(
  size: ProfileGridModuleSize,
): ProfileModuleConnectionLayout {
  return (
    profileModuleConnectionLayouts[size] ?? {
      capacity: 4,
      columns: 1,
      variant: "rows",
    }
  );
}

function ProfileModuleLinkCompactRow({
  dense = false,
  link,
}: {
  dense?: boolean | undefined;
  link: ProfileModuleLink;
}) {
  const platform = normalizeModuleConnectionPlatform(link.platform);
  const platformLabel = moduleLinkPlatformLabel(link);
  const label = platform ? platformLabel : link.label || platformLabel;
  const identity = profileModuleConnectionIdentity(link, platformLabel);
  const secondaryIdentity =
    identity && identity.toLocaleLowerCase() !== label.toLocaleLowerCase()
      ? identity
      : undefined;

  return (
    <a
      className={cn(
        "group flex min-w-0 items-center overflow-hidden rounded-card border border-line bg-canvas/30 transition duration-fluid ease-fluid hover:border-line-strong hover:bg-surface/64 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
        dense
          ? "h-full min-h-9 gap-2 px-2 py-1 text-xs"
          : "min-h-11 gap-2 px-2 py-1.5 text-sm",
      )}
      href={link.url}
      rel="noopener noreferrer"
      target="_blank"
      title={secondaryIdentity ? `${label}: ${secondaryIdentity}` : label}
    >
      <span
        className={cn(
          "grid shrink-0 place-items-center rounded-full border border-line bg-surface/62 text-text",
          dense ? "size-6" : "size-8",
        )}
      >
        {platform ? (
          <ProfileConnectionIcon platform={platform} size={dense ? 13 : 15} />
        ) : (
          <Globe aria-hidden="true" size={dense ? 13 : 15} />
        )}
      </span>
      <span className="flex min-w-0 flex-1 flex-col justify-center overflow-hidden">
        <span
          className="truncate font-semibold leading-tight text-text"
          data-profile-connection-platform={platform ?? "custom"}
        >
          {label}
        </span>
        {secondaryIdentity ? (
          <span
            className={cn(
              "truncate font-medium leading-tight text-muted",
              dense ? "text-[0.65rem]" : "text-xs",
            )}
            data-profile-connection-identity={platform ?? "custom"}
          >
            {secondaryIdentity}
          </span>
        ) : null}
      </span>
      <ExternalLink
        aria-hidden="true"
        size={dense ? 12 : 14}
        className="shrink-0 text-muted transition duration-fluid group-hover:text-text"
      />
    </a>
  );
}

function ProfileModuleLinkWideChip({
  link,
}: {
  link: ProfileModuleLink;
}) {
  const platform = normalizeModuleConnectionPlatform(link.platform);
  const label = link.label || moduleLinkPlatformLabel(link);

  return (
    <a
      className="group inline-flex h-9 min-w-0 flex-1 basis-0 items-center gap-2 rounded-full border border-line bg-canvas/55 px-2.5 text-sm transition duration-fluid ease-fluid hover:border-line-strong hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      href={link.url}
      rel="noopener noreferrer"
      target="_blank"
      title={label}
    >
      <span className="grid size-6 shrink-0 place-items-center rounded-full border border-line bg-surface/62 text-text">
        {platform ? (
          <ProfileConnectionIcon platform={platform} size={13} />
        ) : (
          <Globe aria-hidden="true" size={13} />
        )}
      </span>
      <span className="min-w-0 flex-1 truncate font-semibold text-text">
        {label}
      </span>
    </a>
  );
}

function ProfileModuleConnectionIconOnly({
  link,
}: {
  link: ProfileModuleLink;
}) {
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
  editing = false,
  fallbackLabel,
  icon,
  musicAutoplayRequestId = 0,
  module,
  presentationMode = "canvas",
  size,
}: {
  editing?: boolean | undefined;
  fallbackLabel: string;
  icon: ReactNode;
  musicAutoplayRequestId?: number | undefined;
  module: ProfileModule;
  presentationMode?: ProfileModuleRenderMode | undefined;
  size?: ProfileGridModuleSize | undefined;
}) {
  const url = module.config.url;
  const presentation = profileModulePresentation(size);
  const micro = presentation.tier === "micro";
  const compactTile =
    micro ||
    (presentation.span.columns <= 2 && presentation.span.rows <= 2);

  if (!url) {
    return null;
  }

  if (module.config.integration) {
    return (
      <ProfileIntegrationRichCard
        fallbackLabel={fallbackLabel}
        icon={icon}
        integration={module.config.integration}
        editing={editing}
        autoplayRequestId={musicAutoplayRequestId}
        module={module}
        presentationMode={presentationMode}
        size={size}
      />
    );
  }

  if (compactTile) {
    return (
      <a
        className={cn(
          "relative isolate h-full min-h-0 min-w-0 overflow-hidden rounded-card border border-line bg-canvas/55 p-2 transition duration-fluid ease-fluid hover:border-line-strong hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
          micro ? "flex items-center gap-2" : "flex flex-col justify-end gap-2",
        )}
        data-profile-static-card-tier={presentation.tier}
        href={url}
        rel="noopener noreferrer"
        target="_blank"
        title={module.config.label ?? fallbackLabel}
      >
        {!micro ? <span className="absolute inset-0 -z-10 bg-canvas/35" /> : null}
        <span
          className={cn(
            "grid shrink-0 place-items-center rounded-card border border-line bg-surface/80 text-text",
            micro ? "size-9" : "size-11 shadow-soft",
          )}
        >
          {icon}
        </span>
        <span className={cn("min-w-0", micro ? "flex-1" : "w-full")}>
          <span
            className={cn(
              "block truncate font-semibold text-text",
              micro ? "text-xs" : "text-sm",
            )}
          >
            {module.config.label ?? fallbackLabel}
          </span>
          {presentation.showSecondaryText ? (
            <span className="block truncate text-[0.68rem] text-muted">
              {module.config.platform
                ? platformDisplayName(module.config.platform)
                : moduleLinkPreview(url)}
            </span>
          ) : null}
        </span>
      </a>
    );
  }

  return (
    <a
      className="flex h-full min-h-0 min-w-0 items-center gap-3 rounded-card border border-line bg-canvas/55 p-3 transition duration-fluid ease-fluid hover:border-line-strong hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      data-profile-static-card-tier={presentation.tier}
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
        {presentation.showSecondaryText ? (
          <span className="mt-0.5 block truncate text-xs text-muted">
            {module.config.platform ? platformDisplayName(module.config.platform) : moduleLinkPreview(url)}
          </span>
        ) : null}
        {presentation.showSecondaryText && module.config.description ? (
          <span className="mt-1 line-clamp-2 block text-sm leading-5 text-muted">
            {module.config.description}
          </span>
        ) : null}
      </span>
      <ExternalLink aria-hidden="true" size={15} className="shrink-0 text-muted" />
    </a>
  );
}

function UploadedVideoPlayer({
  fallbackLabel,
  module,
  size,
  video,
}: {
  fallbackLabel: string;
  module: ProfileModule;
  size?: ProfileGridModuleSize | undefined;
  video: ProfileModuleUploadedVideo;
}) {
  const presentation = profileModulePresentation(size);
  const compact = profilePresentationIsCompact(presentation.tier);
  const title = video.title ?? module.config.label ?? fallbackLabel;

  return (
    <div
      className="grid h-full min-h-0 overflow-hidden rounded-card border border-line bg-black"
      data-testid="profile-uploaded-video-player"
      data-profile-uploaded-video-layout={compact ? "compact" : "player"}
      data-profile-uploaded-video-tier={presentation.tier}
    >
      <FocusAutoplayVideo
        className="size-full min-h-0 bg-black object-contain"
        loop={module.config.autoplay === true}
        poster={video.posterUrl}
        title={title}
        data-testid="profile-uploaded-video-element"
      >
        <source src={video.url} type={video.mime} />
      </FocusAutoplayVideo>
    </div>
  );
}

function UploadedAudioPlayer({
  audio,
  autoplayRequestId = 0,
  fallbackLabel,
  module,
  size,
}: {
  audio: ProfileModuleUploadedAudio;
  autoplayRequestId?: number | undefined;
  fallbackLabel: string;
  module: ProfileModule;
  size?: ProfileGridModuleSize | undefined;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lastAutoplayRequestRef = useRef(0);
  const [duration, setDuration] = useState(audio.duration ?? 0);
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const presentation = profileModulePresentation(size);
  const compactPlayer = profilePresentationIsCompact(presentation.tier);
  const title = audio.title ?? module.config.label ?? fallbackLabel;
  const subtitle = presentation.showSecondaryText
    ? module.config.description ?? null
    : null;
  const progressPercent =
    duration > 0 ? Math.min(100, Math.max(0, (position / duration) * 100)) : 0;
  const layout = profileMusicPlayerLayout(presentation);
  const progressLabel = profileUploadedAudioProgressLabel(
    position,
    duration,
    playing,
    presentation.tier,
  );

  useEffect(() => {
    const element = audioRef.current;

    if (!element) {
      return undefined;
    }

    const mediaElement = element;

    function syncMetadata() {
      if (Number.isFinite(mediaElement.duration) && mediaElement.duration > 0) {
        setDuration(mediaElement.duration);
      }
    }

    function syncTime() {
      setPosition(
        Number.isFinite(mediaElement.currentTime) ? mediaElement.currentTime : 0,
      );
    }

    function syncPlaying() {
      setPlaying(!mediaElement.paused && !mediaElement.ended);
    }

    mediaElement.addEventListener("loadedmetadata", syncMetadata);
    mediaElement.addEventListener("timeupdate", syncTime);
    mediaElement.addEventListener("play", syncPlaying);
    mediaElement.addEventListener("pause", syncPlaying);
    mediaElement.addEventListener("ended", syncPlaying);
    syncMetadata();
    syncTime();
    syncPlaying();

    return () => {
      mediaElement.removeEventListener("loadedmetadata", syncMetadata);
      mediaElement.removeEventListener("timeupdate", syncTime);
      mediaElement.removeEventListener("play", syncPlaying);
      mediaElement.removeEventListener("pause", syncPlaying);
      mediaElement.removeEventListener("ended", syncPlaying);
    };
  }, [audio.url]);

  useEffect(() => {
    const element = audioRef.current;

    if (
      !element ||
      autoplayRequestId <= 0 ||
      lastAutoplayRequestRef.current === autoplayRequestId
    ) {
      return;
    }

    lastAutoplayRequestRef.current = autoplayRequestId;
    element.volume = PROFILE_MUSIC_AUTOPLAY_VOLUME;
    void element.play().catch(() => {
      setPlaying(false);
    });
  }, [autoplayRequestId]);

  async function handlePlaybackToggle() {
    const element = audioRef.current;

    if (!element) {
      return;
    }

    if (playing) {
      element.pause();
      return;
    }

    try {
      await element.play();
    } catch {
      setPlaying(false);
    }
  }

  return (
    <MediaPlayer
      className="h-full"
      density={presentation.tier}
      layout={layout}
      onPlayToggle={handlePlaybackToggle}
      pauseLabel="Pause uploaded music"
      playLabel="Play uploaded music"
      playing={playing}
      progressAriaLabel="Uploaded music playback progress"
      progressLabel={progressLabel}
      progressPercent={progressPercent}
      rootProps={{
        "data-profile-uploaded-audio-layout": layout,
        "data-profile-uploaded-audio-tier": presentation.tier,
      }}
      showOpenLink={!compactPlayer}
      showSubtitle={presentation.showSecondaryText}
      statusLabel={playing ? "Playing" : "Ready"}
      subtitle={subtitle}
      testIdPrefix="profile-uploaded-audio"
      title={title}
    >
      <audio
        ref={audioRef}
        className="sr-only"
        preload="metadata"
        src={audio.url}
      />
    </MediaPlayer>
  );
}

function MusicPlaylistPlayer({
  autoplayRequestId = 0,
  fallbackLabel,
  integration,
  module,
  size,
}: {
  autoplayRequestId?: number | undefined;
  fallbackLabel: string;
  integration?: ProfileIntegrationCard | undefined;
  module: ProfileModule;
  size?: ProfileGridModuleSize | undefined;
}) {
  const captureMode = isProfileShareCaptureMode();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const spotifyContainerRef = useRef<HTMLDivElement | null>(null);
  const spotifyControllerRef = useRef<SpotifyEmbedController | undefined>(undefined);
  const removeSpotifyListenersRef = useRef<(() => void) | undefined>(undefined);
  const lastAutoplayRequestRef = useRef(0);
  const [activeIndex, setActiveIndex] = useState(0);
  const [duration, setDuration] = useState(0);
  const [position, setPosition] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [playerVersion, setPlayerVersion] = useState(0);
  const [spotifyReadyVersion, setSpotifyReadyVersion] = useState(0);
  const [spotifyProgress, setSpotifyProgress] = useState<SpotifyPlaybackProgress>(
    emptySpotifyPlaybackProgress,
  );
  const presentation = profileModulePresentation(size);
  const compactPlayer = profilePresentationIsCompact(presentation.tier);
  const richPlayer = presentation.preferLargeMedia;
  const tracks = profilePlaylistTracks(module, integration, fallbackLabel);
  const activeTrack = tracks[Math.min(activeIndex, Math.max(0, tracks.length - 1))];
  const metadata = integration?.metadata;
  const title = metadata?.title ?? module.config.label ?? fallbackLabel;
  const subtitle =
    metadata?.subtitle ??
    (module.config.sourceMode === "upload" ? "Uploaded playlist" : "Playlist");
  const artworkUrl = metadata?.imageUrl ?? null;
  const spotifyUri =
    integration?.provider === "spotify" && integration.resourceType === "playlist"
      ? spotifyResourceUri(integration)
      : undefined;
  const youtubePlayable =
    integration?.provider === "youtube" &&
    integration.embed &&
    integration.resourceType === "playlist";
  const localAudio = activeTrack?.audio;
  const hasLocalAudio = Boolean(localAudio);
  const providerPlayable = Boolean(spotifyUri || youtubePlayable);
  const canPlay = Boolean(hasLocalAudio || providerPlayable);
  const progress =
    localAudio && duration > 0
      ? Math.min(100, Math.max(0, (position / duration) * 100))
      : spotifyUri
        ? spotifyPlaybackProgressPercent(spotifyProgress)
        : playing
          ? 100
          : 0;
  const progressLabel = profilePlaylistProgressLabel({
    activeTrack,
    duration,
    playing,
    position,
    spotifyProgress,
    tier: presentation.tier,
  });
  const youtubeEmbedSrc = integration && youtubePlayable
    ? youtubeMusicEmbedSrc(integration, playing, playerVersion)
    : undefined;

  const playPlaylist = useCallback(async () => {
    const element = audioRef.current;

    if (hasLocalAudio && element) {
      element.volume = PROFILE_MUSIC_AUTOPLAY_VOLUME;

      try {
        await element.play();
      } catch {
        setPlaying(false);
      }

      return;
    }

    const spotifyController = spotifyControllerRef.current;

    if (spotifyController) {
      const played = await playSpotifyEmbed(spotifyController);

      if (played) {
        setPlaying(true);
      }

      return;
    }

    if (youtubePlayable) {
      setPlaying(true);
      setPlayerVersion((version) => version + 1);
    }
  }, [hasLocalAudio, youtubePlayable]);

  useEffect(() => {
    const element = audioRef.current;

    if (!element || !localAudio) {
      setDuration(activeTrack?.duration ?? 0);
      setPosition(0);
      return undefined;
    }

    const mediaElement = element;

    function syncMetadata() {
      if (Number.isFinite(mediaElement.duration) && mediaElement.duration > 0) {
        setDuration(mediaElement.duration);
      } else {
        setDuration(activeTrack?.duration ?? 0);
      }
    }

    function syncTime() {
      setPosition(
        Number.isFinite(mediaElement.currentTime) ? mediaElement.currentTime : 0,
      );
    }

    function syncPlaying() {
      setPlaying(!mediaElement.paused && !mediaElement.ended);
    }

    mediaElement.addEventListener("loadedmetadata", syncMetadata);
    mediaElement.addEventListener("timeupdate", syncTime);
    mediaElement.addEventListener("play", syncPlaying);
    mediaElement.addEventListener("pause", syncPlaying);
    mediaElement.addEventListener("ended", syncPlaying);
    syncMetadata();
    syncTime();
    syncPlaying();

    return () => {
      mediaElement.removeEventListener("loadedmetadata", syncMetadata);
      mediaElement.removeEventListener("timeupdate", syncTime);
      mediaElement.removeEventListener("play", syncPlaying);
      mediaElement.removeEventListener("pause", syncPlaying);
      mediaElement.removeEventListener("ended", syncPlaying);
    };
  }, [activeTrack?.duration, localAudio]);

  useEffect(() => {
    if (captureMode) {
      return undefined;
    }

    const container = spotifyContainerRef.current;

    if (!container || !spotifyUri) {
      return undefined;
    }

    let canceled = false;
    spotifyControllerRef.current = undefined;
    removeSpotifyListenersRef.current?.();
    removeSpotifyListenersRef.current = undefined;
    container.replaceChildren();

    loadSpotifyIframeApi()
      .then((api) => {
        if (canceled) {
          return;
        }

        api.createController(
          container,
          {
            height: "152",
            theme: "0",
            uri: spotifyUri,
            width: "100%",
          },
          (controller) => {
            if (canceled) {
              controller.destroy?.();
              return;
            }

            spotifyControllerRef.current = controller;
            removeSpotifyListenersRef.current = attachSpotifyPlaybackListeners(
              controller,
              (nextProgress) => {
                if (canceled) {
                  return;
                }

                setSpotifyProgress(nextProgress);
                setPlaying(!nextProgress.isPaused && !nextProgress.isBuffering);
              },
            );
            setSpotifyReadyVersion((version) => version + 1);
          },
        );
      })
      .catch(() => undefined);

    return () => {
      canceled = true;
      removeSpotifyListenersRef.current?.();
      removeSpotifyListenersRef.current = undefined;
      spotifyControllerRef.current?.destroy?.();
      spotifyControllerRef.current = undefined;
      container.replaceChildren();
    };
  }, [captureMode, spotifyUri]);

  useEffect(() => {
    if (!playing || !spotifyProgress.known || spotifyProgress.duration <= 0) {
      return undefined;
    }

    const interval = window.setInterval(() => {
      setSpotifyProgress((progressState) => {
        if (
          progressState.isPaused ||
          progressState.isBuffering ||
          !progressState.known ||
          progressState.duration <= 0 ||
          progressState.position >= progressState.duration
        ) {
          return progressState;
        }

        return {
          ...progressState,
          position: Math.min(progressState.duration, progressState.position + 1000),
        };
      });
    }, 1000);

    return () => window.clearInterval(interval);
  }, [playing, spotifyProgress.duration, spotifyProgress.known]);

  useEffect(() => {
    if (
      autoplayRequestId <= 0 ||
      lastAutoplayRequestRef.current === autoplayRequestId
    ) {
      return;
    }

    lastAutoplayRequestRef.current = autoplayRequestId;
    void playPlaylist();
  }, [autoplayRequestId, playPlaylist, spotifyReadyVersion]);

  async function handlePlaybackToggle() {
    const element = audioRef.current;

    if (localAudio && element) {
      if (playing) {
        element.pause();
        return;
      }

      await playPlaylist();
      return;
    }

    const spotifyController = spotifyControllerRef.current;

    if (spotifyController) {
      const nextPlaying = await toggleSpotifyPlayback(spotifyController, playing);

      if (nextPlaying !== undefined) {
        setPlaying(nextPlaying);
      }

      return;
    }

    if (youtubePlayable) {
      setPlaying((current) => !current);
      setPlayerVersion((version) => version + 1);
    }
  }

  return (
    <div
      className="flex h-full min-h-0 overflow-hidden rounded-card border border-line bg-surface/74 shadow-inner-soft"
      data-profile-capture-embed-fallback={
        captureMode && integration?.provider === "spotify"
          ? "spotify"
          : captureMode && integration?.provider === "youtube"
            ? "youtube"
            : undefined
      }
      data-profile-music-playlist-tier={presentation.tier}
      data-testid="profile-music-playlist-player"
    >
      <div
        className={cn(
          "flex min-h-0 w-full min-w-0",
          compactPlayer ? "flex-col gap-2 p-2" : "flex-col gap-3 p-3",
          richPlayer ? "sm:p-4" : undefined,
        )}
      >
        <div className="flex min-w-0 items-center gap-3">
          <span
            className={cn(
              "grid shrink-0 place-items-center overflow-hidden rounded-card border border-line bg-canvas/68 text-muted shadow-inner-soft",
              compactPlayer ? "size-12" : "size-16",
            )}
            data-testid="profile-music-playlist-artwork-frame"
          >
            {artworkUrl ? (
              <img
                alt=""
                className="size-full object-cover"
                decoding="async"
                loading="lazy"
                src={artworkUrl}
              />
            ) : (
              <Music2 aria-hidden="true" size={compactPlayer ? 19 : 22} />
            )}
          </span>
          <div className="grid min-w-0 flex-1 gap-2">
            <div className="min-w-0">
              <span
                className={cn(
                  "block truncate font-semibold text-text",
                  compactPlayer ? "text-sm" : "text-base",
                )}
              >
                {title}
              </span>
              {presentation.showSecondaryText ? (
                <span className="mt-0.5 block truncate text-xs leading-5 text-muted">
                  {subtitle}
                  {tracks.length > 0 ? ` · ${tracks.length} songs` : ""}
                </span>
              ) : null}
            </div>
            <div className="flex min-w-0 items-center gap-2.5">
              <button
                type="button"
                className="grid size-9 shrink-0 place-items-center rounded-full border border-accent/28 bg-accent text-accent-contrast shadow-soft transition duration-fluid ease-fluid hover:-translate-y-0.5 hover:bg-accent-strong hover:shadow-lift focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:translate-y-0"
                aria-label={playing ? "Pause playlist" : "Play playlist"}
                data-testid="profile-music-playlist-play-button"
                disabled={!canPlay}
                onClick={handlePlaybackToggle}
              >
                {playing ? (
                  <Pause aria-hidden="true" size={17} />
                ) : (
                  <Play aria-hidden="true" size={17} />
                )}
              </button>
              <div className="grid min-w-0 flex-1 gap-1">
                <div className="h-1.5 overflow-hidden rounded-full bg-line/72">
                  <div
                    className="h-full rounded-full bg-accent transition-[width] duration-fluid ease-fluid"
                    role="progressbar"
                    aria-label="Playlist playback progress"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(progress)}
                    style={{ width: `${progress}%` }}
                    data-testid="profile-music-playlist-progress-bar"
                  />
                </div>
                <span
                  className="truncate text-xs font-medium tabular-nums leading-none text-muted"
                  data-testid="profile-music-playlist-progress-time"
                >
                  {progressLabel}
                </span>
              </div>
              {integration?.sourceUrl ? (
                <a
                  aria-label={`Open ${title}`}
                  className="grid size-8 shrink-0 place-items-center rounded-control border border-line bg-surface/72 text-muted shadow-inner-soft transition duration-fluid ease-fluid hover:border-line-strong hover:bg-surface hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                  data-testid="profile-music-playlist-open-link"
                  href={integration.sourceUrl}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  <ExternalLink aria-hidden="true" size={15} />
                </a>
              ) : null}
            </div>
          </div>
        </div>
        <div
          className={cn(
            "min-h-0 flex-1 overflow-y-auto overscroll-contain rounded-card border border-line bg-canvas/48",
            compactPlayer ? "max-h-28" : undefined,
          )}
          data-testid="profile-music-playlist-track-list"
          data-profile-module-internal-scroll="true"
        >
          {tracks.map((track, index) => {
            const selected = index === activeIndex;

            return (
              <button
                type="button"
                className={cn(
                  "flex min-h-10 w-full min-w-0 items-center gap-2 border-b border-line/70 px-2.5 py-2 text-left last:border-b-0 transition duration-fluid ease-fluid hover:bg-surface/70 focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-focus",
                  selected ? "bg-surface/82" : undefined,
                )}
                data-profile-music-playlist-track-selected={selected ? "true" : undefined}
                data-testid="profile-music-playlist-track"
                key={track.id ?? track.audio?.url ?? track.sourceUrl ?? `${track.title}-${index}`}
                onClick={() => setActiveIndex(index)}
              >
                <span className="w-5 shrink-0 text-center text-[0.68rem] font-semibold tabular-nums text-muted">
                  {index + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-text">
                    {track.title}
                  </span>
                  {presentation.showSecondaryText ? (
                    <span className="block truncate text-xs text-muted">
                      {track.artist ?? profilePlaylistProviderLabel(integration)}
                    </span>
                  ) : null}
                </span>
                <span className="shrink-0 text-xs tabular-nums text-muted">
                  {profilePlaylistTrackDurationLabel(track)}
                </span>
              </button>
            );
          })}
        </div>
      </div>
      {localAudio ? (
        <audio
          ref={audioRef}
          className="sr-only"
          preload="metadata"
          src={localAudio.url}
          data-testid="profile-music-playlist-audio"
        />
      ) : null}
      {spotifyUri && !captureMode ? (
        <div
          className="pointer-events-none absolute size-px overflow-hidden opacity-0"
          aria-hidden="true"
          data-testid="profile-music-playlist-provider-frame"
        >
          <div ref={spotifyContainerRef} />
        </div>
      ) : null}
      {youtubeEmbedSrc && !captureMode ? (
        <iframe
          key={youtubeEmbedSrc}
          className="pointer-events-none absolute size-px opacity-0"
          title={integration?.embed?.title ?? `${title} on YouTube Music`}
          src={youtubeEmbedSrc}
          loading="lazy"
          referrerPolicy="strict-origin-when-cross-origin"
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-forms"
          allowFullScreen
          data-profile-embed-provider="youtube"
          data-testid="profile-music-playlist-youtube-embed"
        />
      ) : null}
    </div>
  );
}

function ProfileIntegrationRichCard({
  autoplayRequestId = 0,
  fallbackLabel,
  icon,
  integration,
  module,
  presentationMode = "canvas",
  size,
}: {
  autoplayRequestId?: number | undefined;
  editing?: boolean | undefined;
  fallbackLabel: string;
  icon: ReactNode;
  integration: ProfileIntegrationCard;
  module: ProfileModule;
  presentationMode?: ProfileModuleRenderMode | undefined;
  size?: ProfileGridModuleSize | undefined;
}) {
  const captureMode = isProfileShareCaptureMode();
  const metadata = integration.metadata;
  const title = metadata.title ?? module.config.label ?? fallbackLabel;
  const subtitle = integrationLabel(integration);
  const fetchedAt =
    integration.apiBacked && (metadata.live || metadata.recentLabel)
      ? metadata.liveFetchedAt ?? metadata.recentFetchedAt
      : undefined;
  const displayMode =
    integration.provider === "twitch"
      ? profileModuleTwitchDisplayModeForSize(profileModuleGridSize(module))
      : module.config.displayMode;
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
  const span = profileGridModuleSizeSpan(size);
  const showTwitchStreamChat = Boolean(
    twitchChatSrc &&
      showPrimaryEmbed &&
      primaryEmbed &&
      span.columns >= 6 &&
      span.rows >= 4,
  );
  const twitchStreamChatGridColumns = span.columns >= 8 ? 8 : 6;
  const twitchStreamChatStreamColumns = span.columns >= 8 ? 6 : 4;
  const twitchStreamChatColumnStyle = {
    gridTemplateColumns:
      span.columns >= 8
        ? "minmax(0, 5.75fr) minmax(min(22rem, 31%), 2.25fr)"
        : "minmax(0, 4fr) minmax(min(19rem, 36%), 2fr)",
  } satisfies CSSProperties;
  const presentation = profileModulePresentation(size);
  const micro = presentation.tier === "micro";
  const compactTile = micro || presentation.span.rows <= 2;
  const compactTextTone = useAlbumArtworkTextTone(
    metadata.imageUrl ?? undefined,
    compactTile,
  );
  const compactTextClass = albumArtworkTextClass(compactTextTone);
  const compactMutedTextClass = albumArtworkMutedTextClass(compactTextTone);
  const twitchEmbedSandbox =
    "allow-storage-access-by-user-activation allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-modals allow-forms";
  const [mobileTwitchPanel, setMobileTwitchPanel] = useState<"stream" | "chat">(
    "stream",
  );

  if (isArtistModuleIntegration(module, integration)) {
    return (
      <ProfileIntegrationArtistCard
        fallbackLabel={fallbackLabel}
        icon={icon}
        integration={integration}
        module={module}
        size={size}
      />
    );
  }

  if (isPlaylistModuleIntegration(module, integration)) {
    return (
      <MusicPlaylistPlayer
        autoplayRequestId={autoplayRequestId}
        fallbackLabel={fallbackLabel}
        integration={integration}
        module={module}
        size={size}
      />
    );
  }

  if (showPrimaryEmbed && primaryEmbed && integration.provider === "spotify") {
    return (
      <SpotifyMusicPlayer
        autoplayRequestId={autoplayRequestId}
        fallbackLabel={fallbackLabel}
        icon={icon}
        integration={integration}
        module={module}
        size={size}
      />
    );
  }

  if (
    showPrimaryEmbed &&
    primaryEmbed &&
    primaryEmbedSrc &&
    integration.provider === "youtube" &&
    getProfileModuleDefinition(module.type).category === "music" &&
    integration.resourceType === "video"
  ) {
    return (
      <YouTubeMusicPlayer
        autoplayRequestId={autoplayRequestId}
        fallbackLabel={fallbackLabel}
        icon={icon}
        integration={integration}
        module={module}
        size={size}
      />
    );
  }

  if (compactTile) {
    return (
      <a
        className="relative isolate flex h-full min-h-0 min-w-0 items-end overflow-hidden rounded-card border border-line bg-canvas/55 p-2 transition duration-fluid ease-fluid hover:border-line-strong hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        data-profile-music-text-tone={compactTextTone}
        data-profile-integration-card-tier={presentation.tier}
        href={integration.sourceUrl}
        rel="noopener noreferrer"
        target="_blank"
        title={title}
      >
        {metadata.imageUrl ? (
          <img
            alt=""
            aria-hidden="true"
            className="absolute inset-0 -z-20 size-full object-cover"
            decoding="async"
            loading="lazy"
            src={metadata.imageUrl}
          />
        ) : null}
        <span
          className={cn(
            "absolute inset-0 -z-10",
            albumArtworkOverlayClass(compactTextTone),
          )}
        />
        <span
          className={cn(
            "grid shrink-0 place-items-center rounded-card border shadow-soft",
            albumArtworkControlSurfaceClass(compactTextTone),
            micro ? "size-8" : "size-10",
          )}
        >
          {icon}
        </span>
        <span className="ml-2 min-w-0 flex-1">
          <span
            className={cn(
              "block truncate font-semibold",
              compactTextClass,
              micro ? "text-xs" : "text-sm",
            )}
            data-profile-music-title="true"
          >
            {title}
          </span>
          {presentation.showSecondaryText ? (
            <span className={cn("block truncate text-[0.68rem]", compactMutedTextClass)}>
              {subtitle}
            </span>
          ) : null}
        </span>
      </a>
    );
  }

  if (
    integration.provider === "twitch" &&
    showPrimaryEmbed &&
    metadata.live === false &&
    Boolean(metadata.liveFetchedAt)
  ) {
    return (
      <TwitchOfflineSurface
        imageUrl={metadata.imageUrl}
        sourceUrl={integration.sourceUrl}
        title={title}
      />
    );
  }

  if (showTwitchStreamChat && primaryEmbed && primaryEmbedSrc && twitchChatSrc) {
    if (presentationMode === "mobile-stack") {
      const showChat = mobileTwitchPanel === "chat";

      return (
        <div
          className="flex h-full min-h-0 flex-col gap-2 overflow-hidden rounded-card bg-transparent"
          data-profile-twitch-chat-columns="mobile-switch"
          data-profile-twitch-embed-surface="true"
        >
          <SegmentedControl
            activeId={mobileTwitchPanel}
            ariaLabel="Twitch view"
            className="w-full shrink-0 [&>button]:flex-1"
            items={[
              { id: "stream", label: "Stream" },
              { id: "chat", label: "Chat" },
            ]}
            onChange={setMobileTwitchPanel}
            testId="profile-twitch-mobile-tabs"
          />
          {captureMode ? (
            <ProfileEmbedCaptureSurface
              className="block min-h-0 min-w-0 flex-1 w-full rounded-card"
              imageUrl={showChat ? undefined : metadata.imageUrl}
              kind={showChat ? "chat" : "video"}
              label={showChat ? "Twitch chat" : title}
              provider="twitch"
            />
          ) : (
            <DeferredTwitchIframe
              className={cn(
                "block min-h-0 min-w-0 flex-1 w-full rounded-card border-0",
                showChat ? "bg-surface" : "bg-black",
              )}
              title={showChat ? "Twitch chat" : primaryEmbed.title}
              src={showChat ? twitchChatSrc : primaryEmbedSrc}
              height={360}
              allow={showChat ? undefined : primaryEmbed.allow}
              sandbox={twitchEmbedSandbox}
              allowFullScreen={!showChat}
              testId={
                showChat
                  ? "profile-integration-embed-twitch-chat"
                  : "profile-integration-embed-twitch"
              }
            />
          )}
        </div>
      );
    }

    return (
      <div
        className="h-full min-h-0 overflow-hidden rounded-card bg-transparent"
        data-profile-twitch-chat-columns="2"
        data-profile-twitch-embed-surface="true"
        data-profile-twitch-grid-columns={twitchStreamChatGridColumns}
        data-profile-twitch-stream-columns={twitchStreamChatStreamColumns}
      >
        <div
          className="profile-twitch-embed-grid grid h-full min-h-0 gap-2"
          style={twitchStreamChatColumnStyle}
        >
          {captureMode ? (
            <ProfileEmbedCaptureSurface
              className="profile-twitch-embed-frame block h-full min-h-0 min-w-0 w-full rounded-card"
              imageUrl={metadata.imageUrl}
              kind="video"
              label={title}
              provider="twitch"
            />
          ) : (
            <DeferredTwitchIframe
              className="profile-twitch-embed-frame block h-full min-h-0 min-w-0 w-full rounded-card border-0 bg-black"
              title={primaryEmbed.title}
              src={primaryEmbedSrc}
              height={360}
              allow={primaryEmbed.allow}
              sandbox={twitchEmbedSandbox}
              allowFullScreen
              testId={`profile-integration-embed-${integration.provider}`}
            />
          )}
          {captureMode ? (
            <ProfileEmbedCaptureSurface
              className="profile-twitch-embed-frame block h-full min-h-0 min-w-0 w-full rounded-card"
              kind="chat"
              label="Twitch chat"
              provider="twitch"
            />
          ) : (
            <DeferredTwitchIframe
              className="profile-twitch-embed-frame block h-full min-h-0 min-w-0 w-full rounded-card border-0 bg-surface"
              title="Twitch chat"
              src={twitchChatSrc}
              height={360}
              sandbox={twitchEmbedSandbox}
              testId="profile-integration-embed-twitch-chat"
            />
          )}
        </div>
      </div>
    );
  }

  if (
    showPrimaryEmbed &&
    primaryEmbed &&
    primaryEmbedSrc &&
    (integration.provider === "twitch" || integration.provider === "youtube")
  ) {
    return (
      <div className="profile-media-embed-surface h-full min-h-0 overflow-hidden rounded-card bg-black">
        {captureMode ? (
          <ProfileEmbedCaptureSurface
            className="profile-media-embed-frame block h-full min-h-0 w-full rounded-card"
            imageUrl={metadata.imageUrl}
            kind="video"
            label={title}
            provider={integration.provider}
          />
        ) : integration.provider === "twitch" ? (
          <DeferredTwitchIframe
            className="profile-media-embed-frame block h-full min-h-0 w-full rounded-card border-0 bg-black"
            title={primaryEmbed.title}
            src={primaryEmbedSrc ?? primaryEmbed.src}
            height={primaryEmbedHeight}
            allow={primaryEmbed.allow}
            sandbox={twitchEmbedSandbox}
            allowFullScreen
            testId="profile-integration-embed-twitch"
          />
        ) : (
          <iframe
            className="profile-media-embed-frame block h-full min-h-0 w-full rounded-card border-0 bg-black"
            title={primaryEmbed.title}
            src={primaryEmbedSrc}
            height={primaryEmbedHeight}
            loading="lazy"
            referrerPolicy="strict-origin-when-cross-origin"
            allow={primaryEmbed.allow}
            sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-forms"
            allowFullScreen
            data-profile-embed-provider={integration.provider}
            data-profile-media-only-embed="true"
            data-testid={`profile-integration-embed-${integration.provider}`}
          />
        )}
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
      data-profile-integration-card-tier={presentation.tier}
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
          {presentation.showSecondaryText && metadata.description ? (
            <span className="mt-1 line-clamp-2 block text-sm leading-5 text-muted">
              {metadata.description}
            </span>
          ) : null}
        </span>
        <ExternalLink aria-hidden="true" size={15} className="shrink-0 text-muted" />
      </a>
      {showPrimaryEmbed && primaryEmbed ? (
        captureMode ? (
          <ProfileGenericEmbedCaptureSurface
            height={twitchChatSrc ? 260 : primaryEmbedHeight}
            imageUrl={metadata.imageUrl}
            label={title}
            provider={integration.provider}
          />
        ) : integration.provider === "twitch" ? (
          <DeferredTwitchIframe
            className={cn(
              "block w-full border-t border-line bg-transparent",
              twitchChatSrc ? "min-h-0 flex-1" : undefined,
            )}
            title={primaryEmbed.title}
            src={primaryEmbedSrc ?? primaryEmbed.src}
            height={twitchChatSrc ? 260 : primaryEmbedHeight}
            allow={primaryEmbed.allow}
            sandbox={twitchEmbedSandbox}
            allowFullScreen
            testId="profile-integration-embed-twitch"
          />
        ) : (
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
        )
      ) : null}
    </div>
  );
}

function DeferredTwitchIframe({
  allow,
  allowFullScreen = false,
  className,
  height,
  sandbox,
  src,
  testId,
  title,
}: {
  allow?: string | undefined;
  allowFullScreen?: boolean;
  className: string;
  height: number;
  sandbox: string;
  src: string;
  testId: string;
  title: string;
}) {
  const placeholderRef = useRef<HTMLButtonElement>(null);
  const [shouldLoad, setShouldLoad] = useState(false);

  useEffect(() => {
    const placeholder = placeholderRef.current;

    if (shouldLoad || !placeholder) {
      return;
    }

    if (typeof IntersectionObserver === "undefined") {
      const frame = window.setTimeout(() => setShouldLoad(true), 0);

      return () => window.clearTimeout(frame);
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          observer.disconnect();
          setShouldLoad(true);
        }
      },
      { rootMargin: "320px 0px" },
    );

    observer.observe(placeholder);

    return () => observer.disconnect();
  }, [shouldLoad]);

  if (shouldLoad) {
    return (
      <iframe
        className={className}
        title={title}
        src={src}
        height={height}
        loading="lazy"
        referrerPolicy="strict-origin-when-cross-origin"
        allow={allow}
        sandbox={sandbox}
        allowFullScreen={allowFullScreen}
        data-profile-embed-provider="twitch"
        data-testid={testId}
      />
    );
  }

  const usesFlexibleHeight = className.includes("h-full") || className.includes("flex-1");

  return (
    <button
      ref={placeholderRef}
      type="button"
      className={cn(
        className,
        "group grid place-items-center border border-line bg-canvas/78 text-center text-text transition duration-fluid ease-fluid hover:border-line-strong hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
      )}
      style={usesFlexibleHeight ? undefined : { height }}
      aria-label={`Load ${title}`}
      data-testid="profile-twitch-deferred"
      onClick={() => setShouldLoad(true)}
    >
      <span className="inline-flex items-center gap-2 rounded-control bg-surface/88 px-3 py-2 text-sm font-semibold shadow-soft">
        <Radio aria-hidden="true" size={16} />
        Load Twitch
      </span>
    </button>
  );
}

function TwitchOfflineSurface({
  imageUrl,
  sourceUrl,
  title,
}: {
  imageUrl?: string | null | undefined;
  sourceUrl: string;
  title: string;
}) {
  return (
    <div
      className="relative isolate flex h-full min-h-0 items-center justify-center overflow-hidden rounded-card border border-line bg-canvas/78 p-5 text-center text-text"
      data-profile-twitch-embed-surface="offline"
      data-testid="profile-twitch-offline"
    >
      {imageUrl ? (
        <img
          alt=""
          aria-hidden="true"
          className="absolute inset-0 -z-20 size-full object-cover opacity-35"
          decoding="async"
          loading="lazy"
          src={imageUrl}
        />
      ) : null}
      <span className="absolute inset-0 -z-10 bg-gradient-to-b from-canvas/45 to-canvas/95" />
      <div className="max-w-sm">
        <span className="mx-auto grid size-11 place-items-center rounded-full border border-line bg-surface/85 text-accent-strong shadow-soft">
          <Radio aria-hidden="true" size={20} />
        </span>
        <p className="mt-3 text-base font-semibold">{title} is offline</p>
        <p className="mt-1 text-sm leading-5 text-muted">
          The player will return here when the channel is live.
        </p>
        <a
          className="app-control mt-4 inline-flex min-h-10 items-center justify-center gap-2 rounded-control border border-line bg-surface px-3 text-sm font-semibold text-text transition duration-fluid ease-fluid hover:border-line-strong hover:bg-surface-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          href={sourceUrl}
          rel="noopener noreferrer"
          target="_blank"
        >
          Open Twitch
          <ExternalLink aria-hidden="true" size={15} />
        </a>
      </div>
    </div>
  );
}

function ProfileGenericEmbedCaptureSurface({
  height,
  imageUrl,
  label,
  provider,
}: {
  height: number;
  imageUrl?: string | null | undefined;
  label: string;
  provider: ProfileIntegrationCard["provider"];
}) {
  return (
    <div
      aria-label={`${label} static preview`}
      className="relative flex w-full items-center gap-3 overflow-hidden border-t border-line bg-canvas/58 p-3 text-text"
      data-profile-capture-embed-fallback={provider}
      data-profile-embed-provider={provider}
      role="img"
      style={{ height }}
    >
      {imageUrl ? (
        <img
          alt=""
          aria-hidden="true"
          className="aspect-square h-full max-h-[112px] shrink-0 rounded-card object-cover shadow-soft"
          decoding="async"
          loading="eager"
          src={imageUrl}
        />
      ) : (
        <span className="grid size-14 shrink-0 place-items-center rounded-card border border-line bg-surface/72 text-accent-strong shadow-soft">
          <Music2 aria-hidden="true" size={24} />
        </span>
      )}
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold">{label}</span>
        <span className="mt-1 block text-xs font-medium text-muted">
          {platformDisplayName(provider)}
        </span>
      </span>
    </div>
  );
}

function ProfileEmbedCaptureSurface({
  className,
  imageUrl,
  kind,
  label,
  provider,
}: {
  className?: string | undefined;
  imageUrl?: string | null | undefined;
  kind: "chat" | "video";
  label: string;
  provider: "twitch" | "youtube";
}) {
  const providerLabel = provider === "youtube" ? "YouTube" : "Twitch";

  return (
    <div
      aria-label={`${label} static preview`}
      className={cn(
        "relative isolate overflow-hidden border-0",
        kind === "chat" ? "bg-surface text-text" : "bg-black text-white",
        className,
      )}
      data-profile-capture-embed-fallback={kind}
      data-profile-embed-provider={provider}
      role="img"
    >
      {kind === "video" && imageUrl ? (
        <img
          alt=""
          aria-hidden="true"
          className="absolute inset-0 -z-20 size-full object-cover opacity-72"
          decoding="async"
          loading="eager"
          src={imageUrl}
        />
      ) : null}
      {kind === "video" ? (
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-black/18 via-black/28 to-black/68" />
      ) : (
        <>
          <div className="absolute inset-0 -z-20 bg-surface" />
          <div className="absolute inset-x-0 top-0 -z-10 h-10 border-b border-line bg-surface-strong/76" />
        </>
      )}
      <div
        className={cn(
          "flex size-full min-h-0 min-w-0 items-center justify-center p-3",
          kind === "video" ? "flex-col gap-2" : "gap-2",
        )}
      >
        <span
          className={cn(
            "grid shrink-0 place-items-center rounded-full border shadow-soft",
            kind === "video"
              ? "size-10 border-white/25 bg-black/38 text-white backdrop-blur"
              : "size-8 border-line bg-canvas/72 text-muted",
          )}
        >
          {kind === "video" ? (
            <Play aria-hidden="true" className="translate-x-px" size={18} />
          ) : (
            <Radio aria-hidden="true" size={15} />
          )}
        </span>
        <span
          className={cn(
            "min-w-0 max-w-full truncate font-semibold",
            kind === "video" ? "text-sm text-white" : "text-xs text-muted",
          )}
        >
          {kind === "video" ? label : providerLabel}
          {kind === "chat" ? " chat" : ""}
        </span>
      </div>
    </div>
  );
}

function ProfileIntegrationArtistCard({
  fallbackLabel,
  icon,
  integration,
  module,
  size = "4x3",
}: {
  fallbackLabel: string;
  icon: ReactNode;
  integration: ProfileIntegrationCard;
  module: ProfileModule;
  size?: ProfileGridModuleSize | undefined;
}) {
  const metadata = integration.metadata;
  const presentation = profileModulePresentation(size);
  const compact =
    profilePresentationIsCompact(presentation.tier) ||
    presentation.span.rows <= 2;
  const spacious =
    presentation.tier === "showcase" ||
    presentation.span.rows >= 4;
  const title = metadata.title ?? module.config.label ?? fallbackLabel;
  const subtitle = metadata.subtitle ?? platformDisplayName(integration.provider);
  const description = metadata.description ?? module.config.description;
  const stats = profileIntegrationArtistStats(integration);
  const visibleStats = compact ? [] : stats.slice(0, spacious ? 4 : 3);
  const genres = profileIntegrationArtistGenres(integration);
  const visibleGenres = genres.slice(0, spacious ? 4 : 2);

  if (presentation.span.rows === 1) {
    return (
      <a
        className="group relative isolate flex h-full min-h-0 min-w-0 items-center gap-2 overflow-hidden rounded-card border border-line bg-canvas/80 px-2 transition duration-fluid ease-fluid hover:border-line-strong hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        href={integration.sourceUrl}
        rel="noopener noreferrer"
        target="_blank"
        data-profile-artist-card-layout="compact"
        data-profile-artist-card-tier={presentation.tier}
        data-testid="profile-integration-artist-card"
      >
        {metadata.imageUrl ? (
          <img
            alt=""
            className="absolute inset-0 -z-30 size-full object-cover transition duration-fluid ease-fluid group-hover:scale-[1.025]"
            decoding="async"
            loading="lazy"
            src={metadata.imageUrl}
            data-testid="profile-integration-artist-image"
          />
        ) : (
          <span className="absolute inset-0 -z-30 grid place-items-center bg-[radial-gradient(circle_at_30%_25%,color-mix(in_oklab,var(--accent)_24%,transparent),transparent_42%),linear-gradient(135deg,color-mix(in_oklab,var(--canvas)_94%,transparent),color-mix(in_oklab,var(--surface)_78%,transparent))] text-muted">
            {icon}
          </span>
        )}
        <span className="absolute inset-0 -z-20 bg-[linear-gradient(90deg,rgba(0,0,0,0.82)_0%,rgba(0,0,0,0.48)_72%,rgba(0,0,0,0.3)_100%)]" />
        <span className="relative z-10 min-w-0 flex-1 text-white drop-shadow-[0_1px_10px_rgba(0,0,0,0.55)]">
          <span
            className="block truncate text-sm font-semibold"
            data-testid="profile-integration-artist-title"
          >
            {title}
          </span>
          {presentation.span.columns >= 5 ? (
            <span className="block truncate text-xs font-medium text-white/78">
              {subtitle}
            </span>
          ) : null}
        </span>
        <ExternalLink
          aria-hidden="true"
          className="relative z-10 shrink-0 text-white"
          size={16}
        />
      </a>
    );
  }

  return (
    <a
      className={cn(
        "group relative isolate flex h-full min-h-0 min-w-0 overflow-hidden rounded-card border border-line bg-canvas/80 transition duration-fluid ease-fluid hover:border-line-strong hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
        compact ? "items-end p-3" : "items-end p-4",
      )}
      href={integration.sourceUrl}
      rel="noopener noreferrer"
      target="_blank"
      data-profile-artist-card-layout={compact ? "compact" : spacious ? "spacious" : "standard"}
      data-profile-artist-card-tier={presentation.tier}
      data-testid="profile-integration-artist-card"
    >
      {metadata.imageUrl ? (
        <img
          alt=""
          className="absolute inset-0 -z-30 size-full object-cover transition duration-fluid ease-fluid group-hover:scale-[1.025]"
          decoding="async"
          loading="lazy"
          src={metadata.imageUrl}
          data-testid="profile-integration-artist-image"
        />
      ) : (
        <span className="absolute inset-0 -z-30 grid place-items-center bg-[radial-gradient(circle_at_30%_25%,color-mix(in_oklab,var(--accent)_24%,transparent),transparent_42%),linear-gradient(135deg,color-mix(in_oklab,var(--canvas)_94%,transparent),color-mix(in_oklab,var(--surface)_78%,transparent))] text-muted">
          {icon}
        </span>
      )}
      <span className="absolute inset-0 -z-20 bg-[linear-gradient(180deg,rgba(0,0,0,0.06)_0%,rgba(0,0,0,0.28)_42%,rgba(0,0,0,0.82)_100%)]" />
      <span className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_18%_18%,rgba(255,255,255,0.2),transparent_34%),linear-gradient(90deg,rgba(0,0,0,0.46),transparent_58%)] opacity-80" />
      <span
        className={cn(
          "relative z-10 flex min-w-0 flex-1 flex-col text-white drop-shadow-[0_1px_10px_rgba(0,0,0,0.55)]",
          compact ? "gap-2" : spacious ? "gap-3" : "gap-2.5",
        )}
      >
        <span className="flex min-w-0 items-start gap-3">
          <span className={cn("min-w-0 flex-1", spacious ? "max-w-[68%]" : undefined)}>
            <span
              className={cn(
                "block truncate font-semibold",
                compact ? "text-base" : spacious ? "text-3xl" : "text-2xl",
              )}
              data-testid="profile-integration-artist-title"
            >
              {title}
            </span>
            <span
              className={cn(
                "mt-0.5 block truncate font-medium text-white/78",
                compact ? "text-xs" : "text-sm",
              )}
            >
              {subtitle}
            </span>
          </span>
          <span
            className={cn(
              "grid shrink-0 place-items-center rounded-card border border-white/30 bg-black/30 text-white shadow-soft backdrop-blur transition duration-fluid ease-fluid group-hover:-translate-y-0.5 group-hover:bg-white/20",
              compact ? "size-9" : "size-11",
            )}
            aria-label={`Open ${title}`}
          >
            <ExternalLink aria-hidden="true" size={17} />
          </span>
        </span>

        {presentation.showDescription && description ? (
          <span
            className={cn(
              "block max-w-[42rem] text-sm leading-5 text-white/82",
              spacious ? "line-clamp-3" : "line-clamp-2",
            )}
          >
            {description}
          </span>
        ) : null}

        {visibleGenres.length > 0 ? (
          <span
            className={cn(
              "flex min-w-0 flex-wrap gap-1.5",
              compact ? "hidden" : undefined,
            )}
            data-testid="profile-integration-artist-genres"
          >
            {visibleGenres.map((genre) => (
              <span
                key={genre}
                className="max-w-full truncate rounded-full border border-white/20 bg-black/25 px-2.5 py-1 text-xs font-semibold text-white/82 backdrop-blur"
              >
                {genre}
              </span>
            ))}
          </span>
        ) : null}

        {visibleStats.length > 0 ? (
          <span
            className={cn(
              "mt-auto flex min-w-0 flex-wrap gap-2",
              compact ? "gap-1.5" : undefined,
            )}
            data-testid="profile-integration-artist-stats"
          >
            {visibleStats.map((stat) => (
              <span
                key={`${stat.key}:${stat.value}`}
                className="min-w-0 rounded-control border border-white/20 bg-black/30 px-2.5 py-1 text-xs font-semibold text-white/74 backdrop-blur"
                data-testid={`profile-integration-artist-stat-${stat.key}`}
              >
                <span className="text-white">{stat.value}</span>{" "}
                <span>{stat.label}</span>
              </span>
            ))}
          </span>
        ) : null}
      </span>
    </a>
  );
}

function YouTubeMusicPlayer({
  autoplayRequestId,
  fallbackLabel,
  icon,
  integration,
  module,
  size = "2x1",
}: {
  autoplayRequestId: number;
  fallbackLabel: string;
  icon: ReactNode;
  integration: ProfileIntegrationCard;
  module: ProfileModule;
  size?: ProfileGridModuleSize | undefined;
}) {
  const captureMode = isProfileShareCaptureMode();
  const lastAutoplayRequestRef = useRef(0);
  const [playing, setPlaying] = useState(false);
  const [playerVersion, setPlayerVersion] = useState(0);
  const metadata = integration.metadata;
  const title = metadata.title ?? module.config.label ?? fallbackLabel;
  const subtitle = metadata.subtitle ?? "YouTube Music";
  const description = metadata.description ?? module.config.description;
  const presentation = profileModulePresentation(size);
  const microPlayer = presentation.tier === "micro";
  const compactPlayer = profilePresentationIsCompact(presentation.tier);
  const richPlayer = presentation.preferLargeMedia;
  const playerLayout = profileMusicPlayerLayout(presentation);
  const compactTextTone = useAlbumArtworkTextTone(
    metadata.imageUrl ?? undefined,
    compactPlayer,
  );
  const compactTextClass = albumArtworkTextClass(compactTextTone);
  const compactMutedTextClass = albumArtworkMutedTextClass(compactTextTone);
  const embedSrc = youtubeMusicEmbedSrc(integration, playing, playerVersion);

  useEffect(() => {
    if (
      autoplayRequestId <= 0 ||
      lastAutoplayRequestRef.current === autoplayRequestId
    ) {
      return;
    }

    lastAutoplayRequestRef.current = autoplayRequestId;
    setPlaying(true);
    setPlayerVersion((version) => version + 1);
  }, [autoplayRequestId]);

  function handlePlaybackToggle() {
    setPlaying((current) => !current);
    setPlayerVersion((version) => version + 1);
  }

  return (
    <div
      className="flex h-full min-h-0 overflow-hidden rounded-card border border-line bg-canvas/55 shadow-inner-soft"
      data-profile-capture-embed-fallback={captureMode ? "youtube" : undefined}
      data-profile-youtube-music-layout={playerLayout}
      data-profile-youtube-music-tier={presentation.tier}
      data-profile-youtube-music-text-tone={compactPlayer ? compactTextTone : undefined}
      data-testid="profile-youtube-music-player"
    >
      <div
        className={cn(
          "relative isolate flex h-full min-h-0 w-full overflow-hidden",
          compactPlayer
            ? "flex-col justify-end p-2"
            : richPlayer
              ? "flex-col gap-3 p-3 sm:p-4"
              : "items-center gap-3 p-3",
        )}
      >
        {metadata.imageUrl && !microPlayer ? (
          <img
            alt=""
            aria-hidden="true"
            className={cn(
              "absolute inset-0 -z-20 size-full object-cover blur-2xl",
              compactPlayer ? "opacity-35" : "opacity-20",
            )}
            decoding="async"
            loading="lazy"
            src={metadata.imageUrl}
          />
        ) : null}
        <div
          className={cn(
            "absolute inset-0 -z-10",
            compactPlayer ? albumArtworkOverlayClass(compactTextTone) : "bg-canvas/72",
          )}
        />
        <div
          className={cn(
            "min-w-0",
            compactPlayer
              ? "contents"
              : richPlayer
                ? "flex min-h-0 flex-1 items-center gap-4"
                : "flex min-w-0 flex-1 items-center gap-3",
          )}
        >
          <span
            className={cn(
              "grid shrink-0 place-items-center overflow-hidden border border-line/80 bg-surface/70 text-text shadow-soft",
              compactPlayer
                ? "absolute inset-0 -z-10 size-full rounded-card opacity-80"
                : richPlayer
                  ? "size-20 rounded-card sm:size-24 lg:size-28"
                  : "size-14 rounded-card",
            )}
          >
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
          <span
            className={cn(
              "min-w-0",
              compactPlayer ? "relative z-10" : "flex-1",
            )}
          >
            <span
              className={cn(
                "block truncate font-semibold",
                compactPlayer
                  ? cn("text-xs", compactTextClass)
                  : "text-sm text-text",
              )}
            >
              {title}
            </span>
            {presentation.showSecondaryText ? (
              <span className="mt-0.5 block truncate text-xs text-muted">
                {subtitle}
              </span>
            ) : null}
            {presentation.showDescription && description ? (
              <span
                className={cn(
                  "mt-1 block text-xs leading-5 text-muted",
                  richPlayer ? "line-clamp-2" : "line-clamp-1",
                )}
              >
                {description}
              </span>
            ) : null}
          </span>
          {!compactPlayer ? (
            <a
              className="grid size-9 shrink-0 place-items-center rounded-card border border-line bg-canvas/65 text-muted transition duration-fluid ease-fluid hover:border-line-strong hover:bg-surface hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
              href={integration.sourceUrl}
              rel="noopener noreferrer"
              target="_blank"
              aria-label="Open in YouTube Music"
            >
              <ExternalLink aria-hidden="true" size={16} />
            </a>
          ) : null}
        </div>
        {captureMode ? (
          richPlayer ? (
            <ProfileEmbedCaptureSurface
              className="min-h-0 w-full flex-1 rounded-card"
              imageUrl={metadata.imageUrl}
              kind="video"
              label={title}
              provider="youtube"
            />
          ) : null
        ) : richPlayer ? (
          <iframe
            key={embedSrc}
            className="min-h-0 w-full flex-1 rounded-card border-0 bg-black"
            title={integration.embed?.title ?? `${title} on YouTube Music`}
            src={embedSrc}
            loading="lazy"
            referrerPolicy="strict-origin-when-cross-origin"
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-forms"
            allowFullScreen
            data-profile-embed-provider="youtube"
            data-testid="profile-integration-embed-youtube"
          />
        ) : (
          <iframe
            key={embedSrc}
            className="pointer-events-none absolute size-px opacity-0"
            title={integration.embed?.title ?? `${title} on YouTube Music`}
            src={embedSrc}
            loading="lazy"
            referrerPolicy="strict-origin-when-cross-origin"
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-forms"
            allowFullScreen
            data-profile-embed-provider="youtube"
            data-testid="profile-integration-embed-youtube"
          />
        )}
        <div
          className={cn(
            "relative z-10 flex min-w-0 items-center gap-3",
            compactPlayer ? "mt-2" : richPlayer ? "mt-auto" : "w-[42%] min-w-36 max-w-72",
          )}
        >
          <button
            type="button"
            className={cn(
              "grid shrink-0 place-items-center rounded-full border border-accent/35 bg-accent/90 text-accent-contrast shadow-soft transition duration-fluid ease-fluid hover:-translate-y-0.5 hover:bg-accent hover:shadow-lift focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
              compactPlayer ? "size-8" : "size-10",
            )}
            onClick={handlePlaybackToggle}
            aria-label={playing ? "Stop YouTube Music" : "Play YouTube Music"}
            data-testid="profile-youtube-music-play-button"
          >
            {playing ? (
              <Pause aria-hidden="true" size={compactPlayer ? 15 : 18} />
            ) : (
              <Play aria-hidden="true" size={compactPlayer ? 15 : 18} />
            )}
          </button>
          <div className="min-w-0 flex-1">
            <div
              className={cn(
                "h-1 overflow-hidden rounded-full",
                compactPlayer
                  ? compactTextTone === "black"
                    ? "bg-black/25"
                    : "bg-white/30"
                  : "bg-line",
              )}
            >
              <div
                className={cn(
                  "h-full rounded-full bg-accent transition-[width] duration-fluid ease-fluid",
                  playing ? "w-full" : "w-0",
                )}
                role="progressbar"
                aria-label="YouTube Music playback state"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={playing ? 100 : 0}
              />
            </div>
            <div
              className={cn(
                "mt-1 flex items-center justify-between gap-3 text-[0.68rem] font-semibold uppercase tracking-[0.08em]",
                compactPlayer ? compactMutedTextClass : "text-muted",
              )}
            >
              {!compactPlayer ? <span className="truncate">YouTube Music</span> : null}
              <span>{playing ? "Playing" : "Ready"}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SpotifyMusicPlayer({
  autoplayRequestId,
  fallbackLabel,
  icon,
  integration,
  module,
  size = "2x1",
}: {
  autoplayRequestId: number;
  fallbackLabel: string;
  icon: ReactNode;
  integration: ProfileIntegrationCard;
  module: ProfileModule;
  size?: ProfileGridModuleSize | undefined;
}) {
  const captureMode = isProfileShareCaptureMode();
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
  const presentation = profileModulePresentation(size);
  const microPlayer = presentation.tier === "micro";
  const compactPlayer = profilePresentationIsCompact(presentation.tier);
  const richPlayer = presentation.preferLargeMedia;
  const playerLayout = profileMusicPlayerLayout(presentation);
  const compactTextTone = useAlbumArtworkTextTone(
    metadata.imageUrl ?? undefined,
    compactPlayer,
  );
  const compactTextClass = albumArtworkTextClass(compactTextTone);
  const compactMutedTextClass = albumArtworkMutedTextClass(compactTextTone);
  const uri = spotifyResourceUri(integration);

  useEffect(() => {
    if (captureMode) {
      return undefined;
    }

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
  }, [captureMode, integration, playerHeight, playerTitle, uri]);

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
  const progressLabel = profileSpotifyProgressLabel(
    playbackProgress,
    statusText,
    presentation.tier,
  );

  return (
    <div
      className="flex h-full min-h-0 overflow-hidden rounded-card border border-line bg-canvas/55 shadow-inner-soft"
      data-profile-capture-embed-fallback={captureMode ? "spotify" : undefined}
      data-profile-spotify-layout={playerLayout}
      data-profile-spotify-tier={presentation.tier}
      data-profile-spotify-text-tone={compactPlayer ? compactTextTone : undefined}
      data-testid="profile-spotify-custom-player"
    >
      <div
        className={cn(
          "relative isolate flex h-full min-h-0 w-full overflow-hidden",
          compactPlayer
            ? "flex-col justify-end p-2"
            : richPlayer
              ? "flex-col gap-3 p-3 sm:p-4"
              : "items-center gap-3 p-3",
        )}
      >
        {metadata.imageUrl && !microPlayer ? (
          <img
            alt=""
            aria-hidden="true"
            className={cn(
              "absolute inset-0 -z-20 size-full object-cover blur-2xl",
              compactPlayer ? "opacity-35" : "opacity-20",
            )}
            decoding="async"
            loading="lazy"
            src={metadata.imageUrl}
          />
        ) : null}
        <div
          className={cn(
            "absolute inset-0 -z-10",
            compactPlayer && !microPlayer
              ? albumArtworkOverlayClass(compactTextTone)
              : "bg-canvas/72",
          )}
        />
        <div
          className={cn(
            "min-w-0",
            compactPlayer
              ? "contents"
              : richPlayer
                ? "flex min-h-0 flex-1 items-center gap-4"
                : "flex min-w-0 flex-1 items-center gap-3",
          )}
        >
          {!microPlayer ? (
            <span
              className={cn(
                "grid shrink-0 place-items-center overflow-hidden border border-line/80 bg-surface/70 text-text shadow-soft",
                compactPlayer
                  ? "absolute inset-0 -z-10 size-full rounded-card opacity-80"
                  : richPlayer
                    ? "size-20 rounded-card sm:size-24 lg:size-28"
                    : "size-14 rounded-card",
              )}
              data-testid="profile-spotify-artwork-frame"
            >
              <SpotifyArtwork
                fallbackIcon={icon}
                imageUrl={metadata.imageUrl ?? undefined}
              />
            </span>
          ) : null}
          <span
            className={cn(
              "min-w-0",
              compactPlayer ? "relative z-10" : "flex-1",
            )}
          >
            <span
              className={cn(
                "block truncate font-semibold",
                compactPlayer
                  ? cn("text-xs", compactTextClass)
                  : "text-sm text-text",
              )}
              data-profile-spotify-title={compactPlayer ? "true" : undefined}
            >
              {title}
            </span>
            {presentation.showSecondaryText ? (
              <span className="mt-0.5 block truncate text-xs text-muted">
                {subtitle}
                {fetchedAt ? ` · ${formatIntegrationAge(fetchedAt)}` : ""}
              </span>
            ) : null}
            {presentation.showDescription && description ? (
              <span
                className={cn(
                  "mt-1 block text-xs leading-5 text-muted",
                  richPlayer ? "line-clamp-3" : "line-clamp-1",
                )}
              >
                {description}
              </span>
            ) : null}
          </span>
          {!compactPlayer ? (
            <a
              className="grid size-9 shrink-0 place-items-center rounded-card border border-line bg-canvas/65 text-muted transition duration-fluid ease-fluid hover:border-line-strong hover:bg-surface hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
              href={integration.sourceUrl}
              rel="noopener noreferrer"
              target="_blank"
              aria-label="Open in Spotify"
            >
              <ExternalLink aria-hidden="true" size={16} />
            </a>
          ) : null}
        </div>
        <div
          className={cn(
            "relative z-10 flex min-w-0 items-center gap-3",
            compactPlayer
              ? "mt-2"
              : richPlayer
                ? "mt-auto"
                : "w-[42%] min-w-36 max-w-72",
          )}
        >
          <button
            type="button"
            className={cn(
              "grid shrink-0 place-items-center rounded-full border border-accent/35 bg-accent/90 text-accent-contrast shadow-soft transition duration-fluid ease-fluid hover:-translate-y-0.5 hover:bg-accent hover:shadow-lift focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:translate-y-0",
              compactPlayer ? "size-8" : "size-10",
              captureMode ? "pointer-events-none" : undefined,
            )}
            onClick={captureMode ? undefined : handlePlaybackToggle}
            disabled={!captureMode && (fallback || !controllerReady)}
            aria-disabled={captureMode ? true : undefined}
            aria-label={playing ? "Pause Spotify music" : "Play Spotify music"}
            data-testid="profile-spotify-play-button"
            tabIndex={captureMode ? -1 : undefined}
          >
            {playing ? (
              <Pause aria-hidden="true" size={compactPlayer ? 15 : 18} />
            ) : (
              <Play aria-hidden="true" size={compactPlayer ? 15 : 18} />
            )}
          </button>
          <div className="min-w-0 flex-1">
            <div
              className={cn(
                "h-1 overflow-hidden rounded-full",
                compactPlayer
                  ? compactTextTone === "black"
                    ? "bg-black/25"
                    : "bg-white/30"
                  : "bg-line",
              )}
            >
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
            <div
              className={cn(
                "mt-1 flex items-center justify-between gap-3 text-[0.68rem] font-semibold uppercase tracking-[0.08em]",
                compactPlayer ? compactMutedTextClass : "text-muted",
              )}
            >
              {!compactPlayer ? (
                <span className="truncate">{integrationLabel(integration)}</span>
              ) : null}
              <span data-testid="profile-spotify-progress-time">{progressLabel}</span>
            </div>
          </div>
        </div>
        {!captureMode ? (
          <div
            className="pointer-events-none absolute size-px overflow-hidden opacity-0"
            aria-hidden="true"
            data-testid="profile-spotify-provider-frame"
          >
            <div ref={containerRef} />
          </div>
        ) : null}
      </div>
    </div>
  );
}

function SpotifyArtwork({
  fallbackIcon,
  imageUrl,
}: {
  fallbackIcon: ReactNode;
  imageUrl?: string | undefined;
}) {
  if (!imageUrl) {
    return <>{fallbackIcon}</>;
  }

  return (
    <img
      alt=""
      aria-hidden="true"
      className="size-full object-cover"
      decoding="async"
      loading="lazy"
      src={imageUrl}
      data-testid="profile-spotify-artwork"
    />
  );
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

function formatMediaTime(value: number): string {
  const totalSeconds = Math.max(0, Math.floor(value));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds
      .toString()
      .padStart(2, "0")}`;
  }

  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function profilePresentationIsCompact(
  tier: ProfileModulePresentationTier,
): boolean {
  return tier === "micro" || tier === "compact";
}

function profileMusicPlayerLayout(
  presentation: ProfileModulePresentation,
): MediaPlayerLayout {
  if (profilePresentationIsCompact(presentation.tier)) {
    return "compact";
  }

  return presentation.preferLargeMedia ? "rich" : "row";
}

function profileUploadedAudioProgressLabel(
  position: number,
  duration: number,
  playing: boolean,
  tier: ProfileModulePresentationTier,
): string {
  if (tier === "micro") {
    return "";
  }

  if (duration > 0) {
    return tier === "compact"
      ? formatMediaTime(position)
      : `${formatMediaTime(position)} / ${formatMediaTime(duration)}`;
  }

  return playing ? "Playing" : "Ready";
}

function profilePlaylistTracks(
  module: ProfileModule,
  integration: ProfileIntegrationCard | undefined,
  fallbackLabel: string,
): ProfileModulePlaylistTrack[] {
  if ((module.config.tracks ?? []).length > 0) {
    return module.config.tracks ?? [];
  }

  const statTracks = profilePlaylistTracksFromStats(integration?.metadata.stats);

  if (statTracks.length > 0) {
    return statTracks;
  }

  if (integration) {
    return [
      {
        id: integration.resourceKey,
        title: integration.metadata.title ?? module.config.label ?? fallbackLabel,
        artist: integration.metadata.subtitle ?? profilePlaylistProviderLabel(integration),
        sourceUrl: integration.sourceUrl,
      },
    ];
  }

  return [
    {
      title: module.config.label ?? fallbackLabel,
    },
  ];
}

function profilePlaylistTracksFromStats(
  stats: ProfileIntegrationCard["metadata"]["stats"] | undefined,
): ProfileModulePlaylistTrack[] {
  if (!stats || typeof stats !== "object" || !Array.isArray(stats.tracks)) {
    return [];
  }

  return stats.tracks
    .slice(0, 50)
    .map((track) => {
      if (!track || typeof track !== "object" || Array.isArray(track)) {
        return undefined;
      }

      const record = track as Record<string, unknown>;
      const title = profilePlaylistTrackText(record.title, 90);

      if (!title) {
        return undefined;
      }

      const artist = profilePlaylistTrackText(record.artist, 90);
      const id = profilePlaylistTrackText(record.id, 80);
      const sourceUrl = profilePlaylistTrackUrl(record.sourceUrl);
      const duration =
        typeof record.duration === "number" &&
        Number.isFinite(record.duration) &&
        record.duration > 0
          ? Math.min(60 * 60 * 4, record.duration)
          : undefined;

      return {
        title,
        ...(artist ? { artist } : {}),
        ...(duration ? { duration } : {}),
        ...(id ? { id } : {}),
        ...(sourceUrl ? { sourceUrl } : {}),
      };
    })
    .filter(
      (track): track is ProfileModulePlaylistTrack => track !== undefined,
    );
}

function profilePlaylistTrackText(
  value: unknown,
  maxLength: number,
): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.replace(/\s+/g, " ").trim();

  return trimmed !== "" && Array.from(trimmed).length <= maxLength
    ? trimmed
    : undefined;
}

function profilePlaylistTrackUrl(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  try {
    const url = new URL(value);

    return url.protocol === "https:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

function profilePlaylistProviderLabel(
  integration: ProfileIntegrationCard | undefined,
): string {
  if (!integration) {
    return "Playlist";
  }

  return platformDisplayName(integration.provider);
}

function profilePlaylistTrackDurationLabel(
  track: ProfileModulePlaylistTrack,
): string {
  const duration = track.duration ?? track.audio?.duration ?? 0;

  return duration > 0 ? formatMediaTime(duration) : "";
}

function profilePlaylistProgressLabel({
  activeTrack,
  duration,
  playing,
  position,
  spotifyProgress,
  tier,
}: {
  activeTrack: ProfileModulePlaylistTrack | undefined;
  duration: number;
  playing: boolean;
  position: number;
  spotifyProgress: SpotifyPlaybackProgress;
  tier: ProfileModulePresentationTier;
}): string {
  if (spotifyProgress.known) {
    return profileSpotifyProgressLabel(spotifyProgress, playing ? "Playing" : "Ready", tier);
  }

  const trackDuration = duration || activeTrack?.duration || activeTrack?.audio?.duration || 0;

  if (trackDuration > 0) {
    return tier === "compact" || tier === "micro"
      ? formatMediaTime(position)
      : `${formatMediaTime(position)} / ${formatMediaTime(trackDuration)}`;
  }

  return playing ? "Playing" : "Ready";
}

function profileSpotifyProgressLabel(
  progress: SpotifyPlaybackProgress,
  statusText: string,
  tier: ProfileModulePresentationTier,
): string {
  if (!progress.known) {
    return statusText;
  }

  if (tier === "micro" || tier === "compact") {
    return formatSpotifyPlaybackTime(progress.position);
  }

  return `${formatSpotifyPlaybackTime(progress.position)} / ${formatSpotifyPlaybackTime(
    progress.duration,
  )}`;
}

function youtubeMusicEmbedSrc(
  integration: ProfileIntegrationCard,
  autoplay: boolean,
  version: number,
): string {
  const src = integration.embed?.src ?? integration.sourceUrl;

  try {
    const url = new URL(src);

    if (url.hostname === "www.youtube-nocookie.com") {
      url.searchParams.set("enablejsapi", "1");
      url.searchParams.set("playsinline", "1");
      url.searchParams.set("rel", "0");
      url.searchParams.set("autoplay", autoplay ? "1" : "0");
      url.searchParams.set(
        "origin",
        typeof window === "undefined" ? "https://thia.lol" : window.location.origin,
      );
      url.searchParams.set("thiaPlayer", String(version));
      return url.toString();
    }
  } catch {
    return src;
  }

  return src;
}

function profileIntegrationEmbedSrc(integration: ProfileIntegrationCard): string {
  const src = integration.embed?.src ?? integration.sourceUrl;

  if (integration.provider !== "spotify" && integration.provider !== "twitch") {
    return src;
  }

  try {
    const url = new URL(src);

    if (
      integration.provider === "spotify" &&
      url.hostname === "open.spotify.com" &&
      url.pathname.startsWith("/embed/")
    ) {
      url.searchParams.set("theme", "0");
      return url.toString();
    }

    if (integration.provider === "twitch" && url.hostname === "player.twitch.tv") {
      const parent =
        typeof window === "undefined" || !window.location.hostname
          ? "thia.lol"
          : window.location.hostname;
      url.searchParams.set("parent", parent);
      url.searchParams.set("muted", "true");
      url.searchParams.set("autoplay", "false");
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

function isArtistModuleIntegration(
  module: ProfileModule,
  integration: ProfileIntegrationCard,
): boolean {
  return module.type.endsWith("_artist") || integration.resourceType === "artist";
}

function isPlaylistModuleIntegration(
  module: ProfileModule,
  integration: ProfileIntegrationCard,
): boolean {
  return (
    getProfileModuleDefinition(module.type).category === "music" &&
    (module.type === "music_playlist" ||
      module.type.endsWith("_playlist") ||
      integration.resourceType === "playlist")
  );
}

function profileIntegrationArtistStats(
  integration: ProfileIntegrationCard,
): Array<{ key: string; label: string; value: string }> {
  const stats = integration.metadata.stats ?? {};
  const items: Array<{ key: string; label: string; value: string }> = [];

  if (typeof stats.listeners === "number" || typeof stats.listeners === "string") {
    items.push({
      key: "listeners",
      label: "monthly listeners",
      value: formatCompactStat(stats.listeners),
    });
  }

  if (typeof stats.followers === "number" || typeof stats.followers === "string") {
    items.push({ key: "followers", label: "followers", value: formatCompactStat(stats.followers) });
  }

  if (typeof stats.subscribers === "number" || typeof stats.subscribers === "string") {
    items.push({
      key: "subscribers",
      label: "subscribers",
      value: formatCompactStat(stats.subscribers),
    });
  }

  if (typeof stats.views === "number" || typeof stats.views === "string") {
    items.push({ key: "views", label: "views", value: formatCompactStat(stats.views) });
  }

  if (typeof stats.popularity === "number" || typeof stats.popularity === "string") {
    items.push({
      key: "popularity",
      label: "popularity",
      value: `${formatCompactStat(stats.popularity)}/100`,
    });
  }

  return items;
}

function profileIntegrationArtistGenres(integration: ProfileIntegrationCard): string[] {
  const stats = integration.metadata.stats ?? {};
  const genres = stats.genres;

  if (typeof genres !== "string") {
    return [];
  }

  return genres
    .split(",")
    .map((genre) => genre.trim())
    .filter(Boolean);
}

function formatCompactStat(value: string | number): string {
  const numericValue =
    typeof value === "number" ? value : Number.parseFloat(value.replace(/,/g, ""));

  if (!Number.isFinite(numericValue)) {
    return String(value);
  }

  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: numericValue >= 1000 ? 1 : 0,
    notation: numericValue >= 1000 ? "compact" : "standard",
  }).format(numericValue);
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

function profileModuleConnectionIdentity(
  link: ProfileModuleLink,
  platformLabel: string,
): string | undefined {
  const platform = normalizeModuleConnectionPlatform(link.platform);
  const configuredLabel = link.label.trim();
  const configuredIdentity =
    configuredLabel &&
    configuredLabel.toLocaleLowerCase() !== platformLabel.toLocaleLowerCase()
      ? configuredLabel
      : undefined;

  try {
    const url = new URL(link.url);
    const host = url.hostname.replace(/^www\./, "");
    const segments = url.pathname
      .split("/")
      .filter(Boolean)
      .map(decodeModuleLinkSegment);
    const first = segments[0];
    const second = segments[1];
    const handle = (value: string | undefined) => {
      const normalized = value?.replace(/^@/, "").trim();

      return normalized ? `@${normalized}` : undefined;
    };

    if (!platform) {
      return moduleLinkPreview(link.url) || configuredIdentity;
    }

    if (platform === "website") {
      return configuredIdentity ?? host;
    }

    if (!profileModuleConnectionHostMatches(platform, host)) {
      return configuredIdentity ?? moduleLinkPreview(link.url);
    }

    if (["github", "instagram", "twitch", "x"].includes(platform)) {
      return handle(first) ?? configuredIdentity;
    }

    if (platform === "tiktok") {
      return handle(first) ?? configuredIdentity;
    }

    if (platform === "bluesky") {
      return handle(first === "profile" ? second : first) ?? configuredIdentity;
    }

    if (platform === "youtube") {
      if (first?.startsWith("@")) {
        return handle(first);
      }

      if (first === "user" || first === "c") {
        return handle(second) ?? configuredIdentity;
      }

      return configuredIdentity ?? (first === "channel" ? second : undefined);
    }

    if (platform === "spotify") {
      return configuredIdentity ?? (first === "user" ? second : segments.at(-1));
    }

    return configuredIdentity ?? moduleLinkPreview(link.url);
  } catch {
    return configuredIdentity;
  }
}

function decodeModuleLinkSegment(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function profileModuleConnectionHostMatches(
  platform: string,
  host: string,
): boolean {
  const platformHosts: Partial<Record<string, string[]>> = {
    bluesky: ["bsky.app"],
    github: ["github.com"],
    instagram: ["instagram.com"],
    spotify: ["open.spotify.com"],
    tiktok: ["tiktok.com"],
    twitch: ["twitch.tv"],
    x: ["x.com", "twitter.com"],
    youtube: ["youtube.com", "youtu.be"],
  };
  const expectedHosts = platformHosts[platform];

  return (
    !expectedHosts ||
    expectedHosts.some(
      (expectedHost) =>
        host === expectedHost || host.endsWith(`.${expectedHost}`),
    )
  );
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
    return "border-cool/40 bg-cool/15 text-cool-ink";
  }

  if (rarity === "epic") {
    return "border-rose/40 bg-rose/15 text-rose-ink";
  }

  if (rarity === "rare") {
    return "border-leaf/40 bg-leaf/15 text-leaf-ink";
  }

  return "border-line bg-canvas/65 text-text";
}
