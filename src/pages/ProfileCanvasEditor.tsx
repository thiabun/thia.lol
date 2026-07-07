import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Check,
  FolderGit2,
  ImagePlus,
  Info,
  MoreHorizontal,
  Minus,
  Move,
  Music2,
  Pencil,
  Pin,
  PinOff,
  Plus,
  Save,
  Sparkles,
  Trash2,
  Upload,
  Video,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { MarkdownEditor } from "../components/social/MarkdownEditor";
import { MentionTextarea } from "../components/social/MentionTextarea";
import {
  ProfileConnectionIcon,
  type ProfileConnectionIconPlatform,
} from "../components/social/ProfileConnectionIcon";
import { ProfileGrid, ProfileGridModule } from "../components/social/ProfileGrid";
import { Avatar } from "../components/ui/Avatar";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { ImageCropModal } from "../components/ui/ImageCropModal";
import { ModalSheet } from "../components/ui/ModalSheet";
import { cn } from "../lib/classNames";
import {
  imageUploadAccept,
  videoUploadAccept,
  videoUploadFormatHelp,
} from "../lib/mediaFormats";
import {
  connectionPlatformLabel,
  maxProfileConnections,
  profileConnectionPlatforms,
  validateProfileConnectionDraft,
} from "../lib/profileConnections";
import {
  PROFILE_CANVAS_ACTIVITY_MAX_MODULE_ROWS,
  PROFILE_CANVAS_PROFILE_INFO_COLUMNS,
  getProfileModuleDefinition,
  normalizeProfileGridModuleSize,
  profileGridModuleSizeSpan,
  profileGridModuleSpanSize,
  profileModuleAllowedSizes,
  profileModuleCatalog,
  profileModuleFallbackTitle,
  profileModulePresentation,
  profileModuleSizeLabel,
  type ProfileGridModuleSize,
  type ProfileModuleCategory,
} from "../lib/profileModuleRegistry";
import { safeProfileImageUrl } from "../lib/profileMedia";
import type {
  Profile,
  ProfileBackgroundBlur,
  ProfileConnectionPlatform,
  ProfileIntegrationCard,
  ProfileModule,
  ProfileModuleLayout,
  ProfileModuleLink,
} from "../lib/types";
import type {
  ProfileCanvasDraftState,
  ProfileIntegrationAccount,
  ProfileIntegrationProvider,
  ProfileIntegrationProviderStatus,
  UploadedAudio,
  UploadedVideo,
} from "../lib/api";
import type { ProfileCanvasDraftAutosaveState } from "./ProfilePage";
import {
  formatUploadSize,
  ProfileAppearanceControls,
  ProfileCanvasBackgroundControls,
  profileCanvasAutofillConfigForModule,
  profileCanvasCells,
  profileCanvasClampLayout,
  profileCanvasConfigWithIntegrationCard,
  profileCanvasConnectionLinksFromIntegrationAccounts,
  profileCanvasDefaultClientLayout,
  profileCanvasDefaultConfigForModule,
  profileCanvasDesktopPointFromEditorPoint,
  profileCanvasDesktopRectFromEditorPoints,
  profileCanvasExactSizeForSelection,
  profileCanvasFitForSelection,
  profileCanvasLayoutFromPointer,
  profileCanvasModulesWithIntegrationLinks,
  profileCanvasModuleIsConfiguredForEditor,
  profileCanvasOccupiedEditorCellKeysForLayout,
  profileCanvasPointInRect,
  profileCanvasRectFromPoints,
  profileCanvasResizeBlockedByPinned,
  profileCanvasResizeLayoutFromPointer,
  profileCanvasResolveDraftCollisions,
  profileCanvasRectsOverlap,
  profileCanvasSelectionExamples,
  profileCanvasSelectionSize,
  profileCanvasSortDraftModules,
  profileCanvasProviderForModule,
  profileCanvasProviderLabel,
  profileModuleLinkFromConnection,
  readMediaFileDuration,
  sanitizeUploadedMediaTitle,
  useProfileCanvasEditorGridProjection,
  validateProfileModuleAudioFile,
  validateProfileModuleVideoFile,
} from "./ProfilePage";

type ProfileDirectCanvasEditorProps = {
  autosaveError?: string | undefined;
  autosaveState: ProfileCanvasDraftAutosaveState;
  busy: boolean;
  draft: ProfileCanvasDraftState;
  error?: string | undefined;
  guideOpen: boolean;
  integrationAccounts: ProfileIntegrationAccount[];
  integrationProviders: ProfileIntegrationProviderStatus[];
  modules: ProfileModule[];
  onBackgroundBlurChange: (blur: ProfileBackgroundBlur) => void;
  onCancel: () => void;
  onCanvasGlassChange: (canvasGlass: number) => void;
  onChange: (updater: (draft: ProfileCanvasDraftState) => ProfileCanvasDraftState) => void;
  onClearBackground: () => void;
  onConnectProvider: (provider: ProfileIntegrationProvider) => void;
  onGuideComplete: () => void;
  onGuideDismiss: () => void;
  onGuideOpen: () => void;
  onModuleAudioUpload: (file: File) => Promise<UploadedAudio>;
  onModuleImagePrepare: (file: File) => Promise<File>;
  onImageUpload: (
    file: File,
    purpose: "avatar" | "banner" | "profile_background",
  ) => void;
  onModuleImageUpload: (file: File) => Promise<string>;
  onModuleVideoUpload: (file: File) => Promise<UploadedVideo>;
  onNewDraftModuleId: () => number;
  onProfileDraftChange: (updater: (profile: Profile) => Profile) => void;
  onRenderModuleContent: (
    module: ProfileModule,
    size: ProfileGridModuleSize,
  ) => ReactNode | undefined;
  onResolveIntegrationMetadata: (input: {
    provider?: ProfileIntegrationProvider;
    url: string;
  }) => Promise<ProfileIntegrationCard>;
  onSave: () => void;
  onVideoUpload: (file: File) => void;
  profile: Profile;
  uploading?: "backgroundImage" | "backgroundVideo" | "avatar" | "banner" | undefined;
};

type CanvasPoint = { column: number; row: number };

type ProfileCanvasResizeDirection =
  | "north"
  | "east"
  | "south"
  | "west"
  | "north-east"
  | "south-east"
  | "south-west"
  | "north-west";

type ProfileCanvasResizeState = {
  direction: ProfileCanvasResizeDirection;
  moduleId: number;
  previewLayout: ProfileModuleLayout;
  size: ProfileGridModuleSize;
  startLayout: ProfileModuleLayout;
  valid: boolean;
};

type ProfileCanvasDragState = {
  moduleId: number;
  pointerOffsetX: number;
  pointerOffsetY: number;
  previewLayout: ProfileModuleLayout;
  size: ProfileGridModuleSize;
  startLayout: ProfileModuleLayout;
  valid: boolean;
};

const profileCanvasResizeDirections: ProfileCanvasResizeDirection[] = [
  "north",
  "east",
  "south",
  "west",
  "north-east",
  "south-east",
  "south-west",
  "north-west",
];

const profileCanvasResizeDirectionLabels: Record<
  ProfileCanvasResizeDirection,
  string
> = {
  north: "top edge",
  east: "right edge",
  south: "bottom edge",
  west: "left edge",
  "north-east": "top right corner",
  "south-east": "bottom right corner",
  "south-west": "bottom left corner",
  "north-west": "top left corner",
};

const profileEditorCoachmarkSteps = [
  {
    title: "Set the stage",
    body: "Use background, appearance, and glass controls to set the mood before you place modules.",
    target: "Background",
  },
  {
    title: "Pick a space",
    body: "Select two cells to choose where your first module lives.",
    target: "Grid",
  },
  {
    title: "Choose a module",
    body: "The picker shows modules that fit your selected space, so start with one useful piece.",
    target: "Picker",
  },
  {
    title: "Configure it",
    body: "Use settings to write, upload, connect, or adjust the module before returning to the canvas.",
    target: "Settings",
  },
  {
    title: "Save the canvas",
    body: "Drafts autosave while you work. Use Save when the public profile should get this layout.",
    target: "Save",
  },
] as const;

function ProfileEditorCoachmarkTour({
  className,
  index,
  onIndexChange,
  onComplete,
  onDismiss,
  open,
}: {
  className?: string | undefined;
  index: number;
  onIndexChange: (index: number) => void;
  onComplete: () => void;
  onDismiss: () => void;
  open: boolean;
}) {
  const step = profileEditorCoachmarkSteps[index] ?? profileEditorCoachmarkSteps[0]!;
  const last = index >= profileEditorCoachmarkSteps.length - 1;

  if (!open) {
    return null;
  }

  return (
    <motion.div
      className={cn(
        "rounded-card border border-focus/45 bg-surface/94 p-4 shadow-lift backdrop-blur-veil",
        className,
      )}
      role="dialog"
      aria-label="Profile editor guide"
      data-testid="profile-editor-guide"
      data-profile-editor-guide-step={step.target.toLowerCase()}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Badge tone="cool">{step.target}</Badge>
          <h2 className="mt-2 text-lg font-semibold text-text">{step.title}</h2>
          <p className="mt-1 max-w-2xl text-sm font-medium leading-6 text-muted">
            {step.body}
          </p>
        </div>
        <p className="text-xs font-semibold text-muted">
          {index + 1}/{profileEditorCoachmarkSteps.length}
        </p>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          data-testid="profile-editor-guide-dismiss"
          onClick={() => {
            onIndexChange(0);
            onDismiss();
          }}
        >
          Skip guide
        </Button>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={index === 0}
            data-testid="profile-editor-guide-back"
            onClick={() => onIndexChange(Math.max(0, index - 1))}
          >
            Back
          </Button>
          <Button
            type="button"
            size="sm"
            data-testid={last ? "profile-editor-guide-done" : "profile-editor-guide-next"}
            icon={
              last ? (
                <Check aria-hidden="true" size={15} />
              ) : (
                <ArrowRight aria-hidden="true" size={15} />
              )
            }
            onClick={() => {
              if (last) {
                onIndexChange(0);
                onComplete();
                return;
              }

              onIndexChange(Math.min(profileEditorCoachmarkSteps.length - 1, index + 1));
            }}
          >
            {last ? "Done" : "Next"}
          </Button>
        </div>
      </div>
    </motion.div>
  );
}

function profileEditorCoachmarkPositionClass(
  target: (typeof profileEditorCoachmarkSteps)[number]["target"],
): string {
  if (target === "Background") {
    return "absolute left-4 top-4 z-50 max-w-sm";
  }

  if (target === "Grid") {
    return "absolute left-[44%] top-[43%] z-50 w-[min(23rem,calc(100%-2rem))]";
  }

  if (target === "Picker") {
    return "absolute right-4 top-4 z-50 max-w-sm";
  }

  if (target === "Settings") {
    return "absolute bottom-4 right-4 z-50 max-w-sm";
  }

  return "absolute right-4 top-4 z-50 max-w-sm";
}

function ProfileCanvasSelectionExamples({
  selection,
}: {
  selection: ProfileModuleLayout;
}) {
  const examples = profileCanvasSelectionExamples(selection);
  const size = profileCanvasSelectionSize(selection);
  const span = size
    ? profileGridModuleSizeSpan(size)
    : {
        columns: Math.min(8, Math.max(1, selection.colSpan)),
        rows: Math.min(10, Math.max(1, selection.rowSpan)),
      };
  const tiny = span.columns <= 2 || span.rows <= 1;
  const roomy = span.columns >= 3 && span.rows >= 2;

  return (
    <div
      className={cn(
        "absolute inset-0 flex min-h-0 min-w-0 flex-col items-center justify-center overflow-hidden text-center",
        tiny ? "gap-1 p-1" : "gap-2 p-2",
      )}
      data-testid="profile-canvas-selection-examples"
    >
      {!tiny && size ? (
        <motion.p
          className="max-w-full truncate rounded-full border border-focus/35 bg-canvas/72 px-2 py-0.5 text-[0.68rem] font-semibold uppercase text-text shadow-soft"
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.14 }}
        >
          Fits {size}
        </motion.p>
      ) : null}
      <div
        className={cn(
          "flex max-h-full max-w-full flex-wrap items-center justify-center overflow-hidden",
          tiny ? "gap-1" : "gap-1.5",
        )}
      >
        <AnimatePresence initial={false} mode="popLayout">
          {examples.length > 0 ? (
            examples.map((example, index) => (
              <motion.span
                key={example.type}
                layout
                className={cn(
                  "min-w-0 max-w-full border border-line bg-surface/88 text-text shadow-soft backdrop-blur-veil",
                  roomy
                    ? "inline-flex h-7 items-center gap-1.5 rounded-full px-2 text-xs font-semibold"
                    : "grid size-7 place-items-center rounded-full",
                )}
                data-testid={`profile-canvas-selection-example-${example.type}`}
                initial={{ opacity: 0, scale: 0.88, y: 5 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: -4 }}
                transition={{
                  delay: Math.min(index * 0.025, 0.08),
                  duration: 0.16,
                  ease: "easeOut",
                  layout: { type: "spring", stiffness: 430, damping: 32 },
                }}
              >
                <ProfileModulePickerIcon
                  category={example.category}
                  disabled={false}
                  type={example.type}
                />
                {roomy ? (
                  <span className="max-w-[7rem] truncate">{example.label}</span>
                ) : (
                  <span className="sr-only">{example.label}</span>
                )}
              </motion.span>
            ))
          ) : (
            <motion.span
              key="empty"
              className="max-w-full truncate rounded-full border border-line bg-surface/88 px-2 py-1 text-[0.68rem] font-semibold text-muted shadow-soft backdrop-blur-veil"
              data-testid="profile-canvas-selection-examples-empty"
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.92 }}
              transition={{ duration: 0.14 }}
            >
              No exact fit
            </motion.span>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function profileCanvasCommitPendingDragPreview(
  grid: HTMLDivElement | null,
  state: ProfileCanvasDragState | undefined,
  point: { clientX: number; clientY: number } | undefined,
  mobile: boolean,
): ProfileCanvasDragState | undefined {
  if (!grid || !state || !point) {
    return state;
  }

  return {
    ...state,
    previewLayout: profileCanvasLayoutFromPointer(
      grid,
      point.clientX,
      point.clientY,
      state.startLayout.colSpan,
      state.startLayout.rowSpan,
      state.pointerOffsetX,
      state.pointerOffsetY,
      mobile,
    ),
  };
}

function profileCanvasCommitPendingResizePreview(
  grid: HTMLDivElement | null,
  state: ProfileCanvasResizeState | undefined,
  point: { clientX: number; clientY: number } | undefined,
  modules: ProfileModule[],
  mobile: boolean,
): ProfileCanvasResizeState | undefined {
  if (!grid || !state || !point) {
    return state;
  }

  const moduleType =
    modules.find((module) => module.id === state.moduleId)?.type ?? "placeholder";
  const next = profileCanvasResizeLayoutFromPointer(
    grid,
    point.clientX,
    point.clientY,
    state.startLayout,
    state.direction,
    moduleType,
    mobile,
  );

  return {
    ...state,
    previewLayout: next.layout,
    size: next.size,
    valid: !profileCanvasResizeBlockedByPinned(modules, state.moduleId, next.layout),
  };
}

export function ProfileDirectCanvasEditor({
  autosaveError,
  autosaveState,
  busy,
  draft,
  error,
  guideOpen,
  integrationAccounts,
  integrationProviders,
  modules,
  onBackgroundBlurChange,
  onCancel,
  onCanvasGlassChange,
  onChange,
  onClearBackground,
  onConnectProvider,
  onGuideComplete,
  onGuideDismiss,
  onGuideOpen,
  onModuleAudioUpload,
  onModuleImagePrepare,
  onImageUpload,
  onModuleImageUpload,
  onModuleVideoUpload,
  onNewDraftModuleId,
  onProfileDraftChange,
  onResolveIntegrationMetadata,
  onSave,
  onVideoUpload,
  profile,
  uploading,
}: ProfileDirectCanvasEditorProps) {
  const gridRef = useRef<HTMLDivElement | null>(null);
  const editorGrid = useProfileCanvasEditorGridProjection();
  const [selectionStart, setSelectionStart] = useState<CanvasPoint | undefined>();
  const [selectionHover, setSelectionHover] = useState<CanvasPoint | undefined>();
  const [pickerModuleId, setPickerModuleId] = useState<number | undefined>();
  const [settingsModuleId, setSettingsModuleId] = useState<number | undefined>();
  const [selectedMobileModuleId, setSelectedMobileModuleId] = useState<
    number | undefined
  >();
  const [mobileMoveModuleId, setMobileMoveModuleId] = useState<number | undefined>();
  const [guideStepIndex, setGuideStepIndex] = useState(0);
  const [dragState, setDragState] = useState<ProfileCanvasDragState | undefined>();
  const [resizeState, setResizeState] = useState<
    ProfileCanvasResizeState | undefined
  >();
  const dragStateRef = useRef<ProfileCanvasDragState | undefined>(undefined);
  const dragFrameRef = useRef<number | undefined>(undefined);
  const dragPendingPointRef = useRef<
    { clientX: number; clientY: number } | undefined
  >(undefined);
  const resizeStateRef = useRef<ProfileCanvasResizeState | undefined>(undefined);
  const resizeFrameRef = useRef<number | undefined>(undefined);
  const resizePendingPointRef = useRef<
    { clientX: number; clientY: number } | undefined
  >(undefined);
  const sortedModules = useMemo(
    () =>
      profileCanvasSortDraftModules(
        modules.filter((module) => module.status !== "deleted"),
      ),
    [modules],
  );
  const editorCells = useMemo(
    () => profileCanvasCells(editorGrid.columns, editorGrid.rows),
    [editorGrid.columns, editorGrid.rows],
  );
  const occupiedEditorCellKeys = useMemo(() => {
    const occupied = new Set<string>();

    sortedModules.forEach((draftModule, index) => {
      if (profileCanvasModuleYieldsToNewSelection(draftModule)) {
        return;
      }

      const layout =
        draftModule.layout ?? profileCanvasDefaultClientLayout(draftModule, index);

      profileCanvasOccupiedEditorCellKeysForLayout(
        layout,
        editorGrid.mobile,
      ).forEach((key) => occupied.add(key));
    });

    return occupied;
  }, [editorGrid.mobile, sortedModules]);
  const pickerModule = sortedModules.find((module) => module.id === pickerModuleId);
  const settingsModule = sortedModules.find((module) => module.id === settingsModuleId);
  const selectedMobileModule = editorGrid.mobile
    ? sortedModules.find((module) => module.id === selectedMobileModuleId)
    : undefined;
  const integrationConnectionLinks = useMemo(
    () => profileCanvasConnectionLinksFromIntegrationAccounts(integrationAccounts),
    [integrationAccounts],
  );
  const autosaveMessage =
    autosaveState === "error"
      ? autosaveError ?? "Canvas draft could not save."
      : autosaveState === "saving"
        ? "Saving draft..."
        : autosaveState === "pending"
          ? "Draft pending..."
          : autosaveState === "saved"
            ? "Draft saved."
          : "Draft autosaves.";
  const guideStep =
    profileEditorCoachmarkSteps[guideStepIndex] ?? profileEditorCoachmarkSteps[0]!;
  const guideTarget = guideOpen ? guideStep.target : undefined;
  const updateDraftModules = useCallback(
    (updater: (currentModules: ProfileModule[]) => ProfileModule[]) => {
      onChange((currentDraft) => ({
        ...currentDraft,
        modules: updater(currentDraft.modules),
      }));
    },
    [onChange],
  );

  function handleGuideOpen() {
    setGuideStepIndex(0);
    onGuideOpen();
  }

  useEffect(() => {
    if (integrationConnectionLinks.length === 0) {
      return;
    }

    const nextModules = profileCanvasModulesWithIntegrationLinks(
      modules,
      integrationConnectionLinks,
    );

    if (nextModules === modules) {
      return;
    }

    onChange((currentDraft) => ({
      ...currentDraft,
      modules: profileCanvasModulesWithIntegrationLinks(
        currentDraft.modules,
        integrationConnectionLinks,
      ),
    }));
  }, [integrationConnectionLinks, modules, onChange]);

  const updateDragState = useCallback((nextState: ProfileCanvasDragState | undefined) => {
    dragStateRef.current = nextState;
    setDragState(nextState);
  }, []);
  const activeDragModuleId = dragState?.moduleId;

  useEffect(() => {
    if (activeDragModuleId === undefined) {
      return undefined;
    }

    function handlePointerMove(event: globalThis.PointerEvent) {
      const grid = gridRef.current;
      const activeDragState = dragStateRef.current;

      if (!grid || !activeDragState) {
        return;
      }

      if (dragFrameRef.current !== undefined) {
        window.cancelAnimationFrame(dragFrameRef.current);
      }

      const { clientX, clientY } = event;
      dragPendingPointRef.current = { clientX, clientY };

      dragFrameRef.current = window.requestAnimationFrame(() => {
        dragFrameRef.current = undefined;
        const pendingPoint = dragPendingPointRef.current;
        const currentState = dragStateRef.current;
        const currentGrid = gridRef.current;

        if (!currentGrid || !currentState || !pendingPoint) {
          return;
        }

        const nextLayout = profileCanvasLayoutFromPointer(
          currentGrid,
          pendingPoint.clientX,
          pendingPoint.clientY,
          currentState.startLayout.colSpan,
          currentState.startLayout.rowSpan,
          currentState.pointerOffsetX,
          currentState.pointerOffsetY,
          editorGrid.mobile,
        );

        updateDragState({
          ...currentState,
          previewLayout: nextLayout,
        });
      });
    }

    function handlePointerUp() {
      const finalState = profileCanvasCommitPendingDragPreview(
        gridRef.current,
        dragStateRef.current,
        dragPendingPointRef.current,
        editorGrid.mobile,
      );

      if (finalState?.valid) {
        updateDraftModules((currentModules) =>
          profileCanvasResolveDraftCollisions(
            currentModules.map((module) =>
              module.id === finalState.moduleId
                ? { ...module, layout: finalState.previewLayout }
                : module,
            ),
            finalState.moduleId,
          ),
        );
      }

      if (dragFrameRef.current !== undefined) {
        window.cancelAnimationFrame(dragFrameRef.current);
        dragFrameRef.current = undefined;
      }

      dragPendingPointRef.current = undefined;
      updateDragState(undefined);
    }

    function handlePointerCancel() {
      if (dragFrameRef.current !== undefined) {
        window.cancelAnimationFrame(dragFrameRef.current);
        dragFrameRef.current = undefined;
      }

      dragPendingPointRef.current = undefined;
      updateDragState(undefined);
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp, { once: true });
    window.addEventListener("pointercancel", handlePointerCancel, { once: true });

    return () => {
      if (dragFrameRef.current !== undefined) {
        window.cancelAnimationFrame(dragFrameRef.current);
        dragFrameRef.current = undefined;
      }
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerCancel);
    };
  }, [
    activeDragModuleId,
    editorGrid.mobile,
    updateDraftModules,
    updateDragState,
  ]);

  const updateResizeState = useCallback((nextState: ProfileCanvasResizeState | undefined) => {
    resizeStateRef.current = nextState;
    setResizeState(nextState);
  }, []);
  const activeResizeModuleId = resizeState?.moduleId;

  useEffect(() => {
    if (activeResizeModuleId === undefined) {
      return undefined;
    }

    function handlePointerMove(event: globalThis.PointerEvent) {
      const grid = gridRef.current;
      const activeResizeState = resizeStateRef.current;

      if (!grid || !activeResizeState) {
        return;
      }

      if (resizeFrameRef.current !== undefined) {
        window.cancelAnimationFrame(resizeFrameRef.current);
      }

      const { clientX, clientY } = event;
      resizePendingPointRef.current = { clientX, clientY };

      resizeFrameRef.current = window.requestAnimationFrame(() => {
        resizeFrameRef.current = undefined;
        const pendingPoint = resizePendingPointRef.current;
        const currentGrid = gridRef.current;
        const currentResizeState = resizeStateRef.current;

        if (!currentGrid || !currentResizeState || !pendingPoint) {
          return;
        }

        const moduleType =
          modules.find((module) => module.id === currentResizeState.moduleId)?.type ??
          "placeholder";
        const next = profileCanvasResizeLayoutFromPointer(
          currentGrid,
          pendingPoint.clientX,
          pendingPoint.clientY,
          currentResizeState.startLayout,
          currentResizeState.direction,
          moduleType,
          editorGrid.mobile,
        );
        const valid = !profileCanvasResizeBlockedByPinned(
          modules,
          currentResizeState.moduleId,
          next.layout,
        );

        updateResizeState({
          ...currentResizeState,
          previewLayout: next.layout,
          size: next.size,
          valid,
        });
      });
    }

    function handlePointerUp() {
      const finalState = profileCanvasCommitPendingResizePreview(
        gridRef.current,
        resizeStateRef.current,
        resizePendingPointRef.current,
        modules,
        editorGrid.mobile,
      );

      if (finalState?.valid) {
        updateDraftModules((currentModules) =>
          profileCanvasResolveDraftCollisions(
            currentModules.map((item) => {
              if (item.id !== finalState.moduleId) {
                return item;
              }

              return {
                ...item,
                config: {
                  ...item.config,
                  canvasSize: finalState.size,
                },
                layout: finalState.previewLayout,
              };
            }),
            finalState.moduleId,
          ),
        );
      }

      if (resizeFrameRef.current !== undefined) {
        window.cancelAnimationFrame(resizeFrameRef.current);
        resizeFrameRef.current = undefined;
      }

      resizePendingPointRef.current = undefined;
      updateResizeState(undefined);
    }

    function handlePointerCancel() {
      if (resizeFrameRef.current !== undefined) {
        window.cancelAnimationFrame(resizeFrameRef.current);
        resizeFrameRef.current = undefined;
      }

      resizePendingPointRef.current = undefined;
      updateResizeState(undefined);
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp, { once: true });
    window.addEventListener("pointercancel", handlePointerCancel, { once: true });

    return () => {
      if (resizeFrameRef.current !== undefined) {
        window.cancelAnimationFrame(resizeFrameRef.current);
        resizeFrameRef.current = undefined;
      }
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerCancel);
    };
  }, [
    editorGrid.mobile,
    modules,
    activeResizeModuleId,
    updateDraftModules,
    updateResizeState,
  ]);

  function handleCellClick(point: CanvasPoint) {
    if (editorGrid.mobile && mobileMoveModuleId !== undefined) {
      const movingModule = sortedModules.find(
        (module) => module.id === mobileMoveModuleId,
      );

      if (!movingModule?.layout) {
        setMobileMoveModuleId(undefined);
        return;
      }

      const layoutPoint = profileCanvasDesktopPointFromEditorPoint(
        point,
        editorGrid.mobile,
      );
      const nextLayout = profileCanvasClampLayout(
        {
          ...movingModule.layout,
          column: layoutPoint.column,
          row: layoutPoint.row,
        },
        movingModule.type,
      );
      const blockedByPinned = profileCanvasResizeBlockedByPinned(
        sortedModules,
        movingModule.id,
        nextLayout,
      );

      if (blockedByPinned) {
        setSelectionStart(point);
        setSelectionHover(point);
        return;
      }

      updateDraftModules((currentModules) =>
        profileCanvasResolveDraftCollisions(
          currentModules.map((module) =>
            module.id === movingModule.id
              ? { ...module, layout: nextLayout }
              : module,
          ),
          movingModule.id,
        ),
      );
      setMobileMoveModuleId(undefined);
      setSelectedMobileModuleId(movingModule.id);
      setSelectionStart(undefined);
      setSelectionHover(undefined);
      return;
    }

    setSelectedMobileModuleId(undefined);

    if (!selectionStart) {
      setSelectionStart(point);
      setSelectionHover(point);
      return;
    }

    const rect = profileCanvasDesktopRectFromEditorPoints(
      selectionStart,
      point,
      editorGrid.mobile,
    );
    const blocked = sortedModules.some((draftModule) => {
      if (profileCanvasModuleYieldsToNewSelection(draftModule)) {
        return false;
      }

      return profileCanvasRectsOverlap(
        rect,
        draftModule.layout ?? profileCanvasDefaultClientLayout(draftModule, 0),
      );
    });

    if (blocked) {
      setSelectionHover(point);
      return;
    }

    const id = onNewDraftModuleId();
    const colSpan = Math.min(PROFILE_CANVAS_PROFILE_INFO_COLUMNS, rect.colSpan);
    const rowSpan = Math.min(PROFILE_CANVAS_ACTIVITY_MAX_MODULE_ROWS, rect.rowSpan);
    const size = profileGridModuleSpanSize(colSpan, rowSpan) ?? "1x1";
    const blankModule: ProfileModule = {
      id,
      type: "placeholder",
      title: null,
      config: { canvasSize: size, configured: false, placeholder: true },
      visibility: "draft",
      position: modules.length + 1,
      pinned: false,
      layout: {
        column: rect.column,
        row: rect.row,
        colSpan,
        rowSpan,
      },
      status: "active",
      schemaVersion: 1,
      createdAt: null,
      updatedAt: null,
    };

    updateDraftModules((currentModules) =>
      profileCanvasResolveDraftCollisions([...currentModules, blankModule], id),
    );
    setMobileMoveModuleId(undefined);
    setSelectedMobileModuleId(id);
    setSettingsModuleId(undefined);
    setPickerModuleId(id);
    setSelectionStart(undefined);
    setSelectionHover(undefined);
  }

  async function handleChooseModule(type: ProfileModule["type"]) {
    const module = pickerModule;

    if (!module?.layout) {
      return;
    }

    const size = profileCanvasExactSizeForSelection(type, module.layout);

    if (!size) {
      return;
    }

    const span = profileGridModuleSizeSpan(size);
    const autofill = profileCanvasAutofillConfigForModule(
      type,
      size,
      profileCanvasDefaultConfigForModule(type, size, integrationConnectionLinks),
      integrationAccounts,
    );

    updateDraftModules((currentModules) =>
      profileCanvasResolveDraftCollisions(
        currentModules.map((item) =>
          item.id === module.id
            ? {
                ...item,
                type,
                title: null,
                config: autofill.config,
                visibility: autofill.config.configured === false ? "draft" : "public",
                layout: {
                  ...item.layout!,
                  colSpan: span.columns,
                  rowSpan: span.rows,
                },
              }
            : item,
        ),
        module.id,
      ),
    );
    setPickerModuleId(undefined);
    setSelectedMobileModuleId(module.id);
    setSettingsModuleId(undefined);
    window.setTimeout(() => setSettingsModuleId(module.id), 0);

    if (!autofill.resolve) {
      return;
    }

    try {
      const card = await onResolveIntegrationMetadata(autofill.resolve);

      updateDraftModules((currentModules) =>
        currentModules.map((item) =>
          item.id === module.id && item.type === type
            ? {
                ...item,
                config: profileCanvasConfigWithIntegrationCard(item.config, card),
                visibility: "public",
              }
            : item,
        ),
      );
    } catch {
      // The saved URL still lets the backend regenerate a safe fallback card.
    }
  }

  function handleModuleConfig(module: ProfileModule, config: ProfileModule["config"]) {
    updateDraftModules((currentModules) =>
      currentModules.map((item) =>
        item.id === module.id
          ? {
              ...item,
              config,
              visibility: config.configured === false ? "draft" : "public",
            }
          : item,
      ),
    );
  }

  function handleRemoveModule(module: ProfileModule) {
    updateDraftModules((currentModules) =>
      module.id < 0
        ? currentModules.filter((item) => item.id !== module.id)
        : currentModules.map((item) =>
            item.id === module.id
              ? { ...item, status: "deleted", visibility: "hidden" }
              : item,
          ),
    );
    setPickerModuleId((current) => (current === module.id ? undefined : current));
    setSettingsModuleId(undefined);
    setSelectedMobileModuleId((current) =>
      current === module.id ? undefined : current,
    );
    setMobileMoveModuleId((current) => (current === module.id ? undefined : current));
  }

  function handleTogglePin(module: ProfileModule) {
    updateDraftModules((currentModules) =>
      currentModules.map((item) =>
        item.id === module.id ? { ...item, pinned: !item.pinned } : item,
      ),
    );
  }

  function handleResizeModule(
    module: ProfileModule,
    size: ProfileGridModuleSize,
  ) {
    const span = profileGridModuleSizeSpan(size);

    updateDraftModules((currentModules) =>
      profileCanvasResolveDraftCollisions(
        currentModules.map((item, index) => {
          if (item.id !== module.id) {
            return item;
          }

          const layout =
            item.layout ?? profileCanvasDefaultClientLayout(item, index);

          return {
            ...item,
            config: {
              ...item.config,
              canvasSize: size,
            },
            layout: {
              ...layout,
              colSpan: span.columns,
              rowSpan: span.rows,
            },
          };
        }),
        module.id,
      ),
    );
  }

  function handleResizePointerStart(
    module: ProfileModule,
    layout: ProfileModuleLayout,
    direction: ProfileCanvasResizeDirection,
    event: ReactPointerEvent<HTMLButtonElement>,
  ) {
    if (module.pinned || event.button !== 0) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    updateDragState(undefined);
    const size =
      profileGridModuleSpanSize(layout.colSpan, layout.rowSpan) ??
      getProfileModuleDefinition(module.type).defaultSize;

    updateResizeState({
      direction,
      moduleId: module.id,
      previewLayout: layout,
      size,
      startLayout: layout,
      valid: true,
    });
  }

  const selectedMobilePlaceholder = selectedMobileModule?.type === "placeholder";
  const selectedMobileTitle = selectedMobileModule
    ? selectedMobilePlaceholder
      ? "Blank module"
      : profileCanvasModulePreviewTitle(selectedMobileModule)
    : "";
  const selectedMobileCanRemove =
    selectedMobileModule !== undefined && selectedMobileModule.type !== "profile_info";
  const selectedMobileMoveActive =
    selectedMobileModule !== undefined && mobileMoveModuleId === selectedMobileModule.id;
  const selectedMobileMoveDisabled = selectedMobileModule?.pinned === true;
  const selectedMobilePinLabel = selectedMobileModule
    ? selectedMobileModule.pinned
      ? `Unpin ${selectedMobileTitle}`
      : `Pin ${selectedMobileTitle}`
    : "";
  const selectedMobileMoveLabel = selectedMobileModule
    ? selectedMobileMoveActive
      ? `Stop moving ${selectedMobileTitle}`
      : `Move ${selectedMobileTitle}`
    : "";
  const selectedMobileSettingsLabel = selectedMobileModule
    ? selectedMobilePlaceholder
      ? "Add module"
      : `Edit ${selectedMobileTitle}`
    : "";
  const selectedMobileRemoveLabel = selectedMobileModule
    ? selectedMobilePlaceholder
      ? "Delete blank module"
      : `Remove ${selectedMobileTitle}`
    : "";
  const selectionRect =
    selectionStart && selectionHover
      ? profileCanvasRectFromPoints(selectionStart, selectionHover)
      : undefined;
  const selectionLayoutRect =
    selectionStart && selectionHover
      ? profileCanvasDesktopRectFromEditorPoints(
          selectionStart,
          selectionHover,
          editorGrid.mobile,
        )
      : undefined;
  const selectionBlocked = Boolean(
    selectionLayoutRect &&
      sortedModules.some((draftModule) => {
        if (profileCanvasModuleYieldsToNewSelection(draftModule)) {
          return false;
        }

        return profileCanvasRectsOverlap(
          selectionLayoutRect,
          draftModule.layout ?? profileCanvasDefaultClientLayout(draftModule, 0),
        );
      }),
  );
  const selectionPreviewRect = selectionBlocked ? undefined : selectionRect;

  return (
    <section
      className="space-y-3"
      data-testid="profile-canvas-editor"
      data-profile-editor-input-mode={editorGrid.mobile ? "touch" : "pointer"}
      data-profile-editor-render-mode="light"
      aria-label="Profile canvas editor"
    >
      <div
        className="space-y-2 lg:max-w-xl"
        data-testid="profile-canvas-editor-toolbar"
      >
        <div
          className={cn(
            "grid grid-cols-2 gap-2 rounded-card",
            guideTarget === "Background"
              ? "outline outline-2 outline-focus/70 ring-4 ring-focus/15"
              : undefined,
          )}
          data-testid={
            guideTarget === "Background"
              ? "profile-editor-guide-target-highlight"
              : undefined
          }
        >
          <ProfileCanvasBackgroundControls
            backgroundBlur={draft.backgroundBlur}
            compact
            profile={profile}
            uploading={uploading}
            onBackgroundBlurChange={onBackgroundBlurChange}
            onClear={onClearBackground}
            onImageUpload={(file) => onImageUpload(file, "profile_background")}
            onVideoUpload={onVideoUpload}
          />
          <ProfileAppearanceControls
            compact
            profile={profile}
            onProfileDraftChange={onProfileDraftChange}
          />
        </div>
        <label className="flex min-h-9 items-center gap-2 rounded-control border border-line bg-surface/72 px-2 text-xs font-semibold text-text shadow-soft backdrop-blur-veil">
          <span className="shrink-0">Glass</span>
          <span
            aria-hidden="true"
            className="size-3.5 shrink-0 rounded-[0.25rem] border border-line-strong bg-surface-strong shadow-inner-soft"
          />
          <input
            className="min-w-0 flex-1 accent-[var(--app-accent)]"
            type="range"
            min={0}
            max={92}
            value={draft.canvasGlass}
            data-testid="profile-canvas-glass-slider"
            onChange={(event) =>
              onCanvasGlassChange(Number(event.currentTarget.value))
            }
          />
          <span
            aria-hidden="true"
            className="size-3.5 shrink-0 rounded-[0.25rem] border border-line-strong bg-transparent shadow-inner-soft"
          />
        </label>
        <div className="flex items-center gap-1.5">
          <p
            className={cn(
              "min-w-0 flex-1 truncate text-xs font-semibold",
              autosaveState === "error" ? "text-rose-ink" : "text-muted",
            )}
            role={autosaveState === "error" ? "alert" : "status"}
          >
            {autosaveMessage}
          </p>
          <Button
            type="button"
            size="icon"
            variant="secondary"
            aria-label="Open editor guide"
            title="Guide"
            icon={<Sparkles aria-hidden="true" size={16} />}
            data-testid="profile-editor-guide-button"
            onClick={handleGuideOpen}
          />
          <Button
            type="button"
            size="icon"
            variant="secondary"
            aria-label="Cancel profile canvas edits"
            title="Cancel"
            disabled={busy}
            icon={<X aria-hidden="true" size={16} />}
            onClick={onCancel}
          />
          <Button
            type="button"
            size="sm"
            disabled={busy}
            className={cn(
              "shrink-0 px-3",
              guideTarget === "Save"
                ? "outline outline-2 outline-focus/70 ring-4 ring-focus/15"
                : undefined,
            )}
            icon={<Save aria-hidden="true" size={16} />}
            data-testid="profile-canvas-save-button"
            onClick={onSave}
          >
            Save
          </Button>
        </div>
      </div>
      {error ? (
        <p
          className="rounded-card border border-rose/30 bg-rose/12 p-3 text-sm font-medium text-rose-ink"
          role="alert"
        >
          {error}
        </p>
      ) : null}
      <ProfileGrid
        canvasGlass={draft.canvasGlass}
        gridRef={gridRef}
        className="relative overflow-hidden"
        maxColumns={editorGrid.columns}
        maxRows={editorGrid.rows}
        testId="profile-canvas-direct-grid"
      >
        {guideTarget === "Grid" ? (
          <ProfileGridModule
            className="pointer-events-none z-20 rounded-[1.1rem] border border-focus/80 bg-focus/14 shadow-glow"
            deferRender={false}
            layout={{ column: 5, row: 5, colSpan: 3, rowSpan: 2 }}
            layoutAnimation={false}
            size="3x2"
            testId="profile-editor-guide-target-highlight"
          >
            <div className="h-full rounded-[1.1rem] border border-focus/40 bg-focus/10" />
          </ProfileGridModule>
        ) : null}
        <div
          className={cn(
            "pointer-events-auto absolute inset-2 z-0 grid",
            editorGrid.mobile ? "gap-2" : "gap-3",
          )}
          style={{
            gridTemplateColumns: `repeat(${editorGrid.columns}, minmax(0, 1fr))`,
            gridTemplateRows: `repeat(${editorGrid.rows}, minmax(0, 1fr))`,
          }}
          onMouseLeave={() => {
            if (selectionStart && !editorGrid.mobile) {
              setSelectionHover(selectionStart);
            }
          }}
        >
          {editorGrid.mobile ? (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 z-0 grid gap-2"
              data-testid="profile-canvas-grid-backdrop"
              style={{
                gridTemplateColumns: `repeat(${editorGrid.columns}, minmax(0, 1fr))`,
                gridTemplateRows: `repeat(${editorGrid.rows}, minmax(0, 1fr))`,
              }}
            >
              {editorCells.map((point) => (
                <span
                  key={`backdrop-${point.column}:${point.row}`}
                  className="rounded-card border border-line/45 bg-surface/18"
                  data-testid="profile-canvas-grid-backdrop-cell"
                  style={{
                    gridColumn: point.column,
                    gridRow: point.row,
                  }}
                />
              ))}
            </div>
          ) : null}
          <AnimatePresence initial={false}>
            {selectionPreviewRect ? (
              <motion.div
                layout
                className="pointer-events-auto relative z-20 cursor-pointer overflow-hidden rounded-[1.1rem] border border-focus/80 bg-focus/20 shadow-glow backdrop-blur-veil"
                aria-label="Create module in selected grid area"
                data-testid="profile-canvas-selection-preview"
                role="button"
                tabIndex={0}
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{
                  layout: { type: "spring", stiffness: 420, damping: 34 },
                  opacity: { duration: 0.12 },
                  scale: { duration: 0.16 },
                }}
                style={{
                  gridColumn: `${selectionPreviewRect.column} / span ${selectionPreviewRect.colSpan}`,
                  gridRow: `${selectionPreviewRect.row} / span ${selectionPreviewRect.rowSpan}`,
                }}
                onClick={() => {
                  if (selectionHover) {
                    handleCellClick(selectionHover);
                  }
                }}
                onKeyDown={(event) => {
                  if (!selectionHover || (event.key !== "Enter" && event.key !== " ")) {
                    return;
                  }

                  event.preventDefault();
                  handleCellClick(selectionHover);
                }}
              >
                <ProfileCanvasSelectionExamples selection={selectionPreviewRect} />
              </motion.div>
            ) : null}
          </AnimatePresence>
          {editorCells.map((point) => {
            const selected = selectionStart &&
              point.column === selectionStart.column &&
              point.row === selectionStart.row;
            const inPreview = selectionPreviewRect
              ? profileCanvasPointInRect(point, selectionPreviewRect)
              : false;
            const previewHasArea = Boolean(
              selectionPreviewRect &&
                (selectionPreviewRect.colSpan > 1 || selectionPreviewRect.rowSpan > 1),
            );
            const coveredByModule = occupiedEditorCellKeys.has(
              `${point.column}:${point.row}`,
            );

            if (coveredByModule || (inPreview && previewHasArea)) {
              return null;
            }

            return (
              <button
                key={`${point.column}:${point.row}`}
                type="button"
                className={cn(
                  "relative z-10 min-h-0 touch-manipulation rounded-card border border-line/55 bg-surface/20 transition-colors duration-fluid ease-fluid focus-visible:z-30 focus-visible:outline-2 focus-visible:outline-focus",
                  !editorGrid.mobile
                    ? "hover:scale-[1.03] hover:border-line-strong hover:bg-surface/42"
                    : undefined,
                  selected && selectionBlocked
                    ? "z-30 border-rose bg-rose/25 shadow-[0_0_0_4px_color-mix(in_oklab,var(--accent-rose)_18%,transparent)]"
                    : undefined,
                  selected && !selectionBlocked
                    ? "z-30 border-focus bg-focus/35 shadow-glow"
                    : undefined,
                )}
                aria-label={`Select grid point column ${point.column}, row ${point.row}`}
                data-testid={`profile-canvas-cell-${point.column}-${point.row}`}
                style={{
                  gridColumn: point.column,
                  gridRow: point.row,
                }}
                onClick={() => handleCellClick(point)}
                onMouseEnter={() => {
                  if (selectionStart && !editorGrid.mobile) {
                    setSelectionHover(point);
                  }
                }}
              />
            );
          })}
        </div>
        <AnimatePresence initial={false}>
          {dragState ? (
            <ProfileGridModule
              className={cn(
                "pointer-events-none z-30 rounded-card border border-focus/80 bg-focus/18 shadow-glow backdrop-blur-veil",
                dragState.valid
                  ? undefined
                  : "border-rose/80 bg-rose/18 shadow-[0_0_0_4px_color-mix(in_oklab,var(--accent-rose)_16%,transparent)]",
              )}
              deferRender={false}
              layout={dragState.previewLayout}
              layoutAnimation={false}
              size={dragState.size}
              testId="profile-canvas-drag-preview"
            >
              <div
                className="grid h-full min-h-0 place-items-center rounded-card border border-current/35 text-xs font-semibold text-text/80"
                data-profile-canvas-drag-valid={dragState.valid ? "true" : "false"}
              >
                Move
              </div>
            </ProfileGridModule>
          ) : null}
          {resizeState ? (
            <ProfileGridModule
              className={cn(
                "pointer-events-none z-30 rounded-card",
                resizeState.valid
                  ? "border border-focus/90 bg-focus/18 shadow-glow"
                  : "border border-rose/80 bg-rose/18 shadow-[0_0_0_4px_color-mix(in_oklab,var(--accent-rose)_16%,transparent)]",
              )}
              deferRender={false}
              layout={resizeState.previewLayout}
              layoutAnimation={false}
              size={resizeState.size}
              testId="profile-canvas-resize-preview"
            >
              <div
                className="grid h-full min-h-0 place-items-center rounded-card border border-current/35 text-xs font-semibold text-text/80 backdrop-blur-veil"
                data-profile-canvas-resize-valid={resizeState.valid ? "true" : "false"}
              >
                {resizeState.size}
              </div>
            </ProfileGridModule>
          ) : null}
        </AnimatePresence>
        {sortedModules.map((module) => {
          const layout = module.layout ?? profileCanvasDefaultClientLayout(module, 0);
          const size =
            profileGridModuleSpanSize(layout.colSpan, layout.rowSpan) ??
            getProfileModuleDefinition(module.type).defaultSize;
          const placeholder = module.type === "placeholder";
          const configured = profileCanvasModuleIsConfiguredForEditor(module);
          const placeholderMicro =
            placeholder && layout.colSpan <= 1 && layout.rowSpan <= 1;
          const placeholderSmall =
            placeholder &&
            !placeholderMicro &&
            (layout.colSpan <= 2 || layout.rowSpan <= 1);
          const placeholderLabel = placeholderMicro
            ? "Add"
            : placeholderSmall
              ? "Add module"
              : "Click to add module";
          const moduleTitle = profileModuleFallbackTitle(module.type);
          const selectedMobile = editorGrid.mobile && selectedMobileModuleId === module.id;
          const pinLabel = module.pinned
            ? `Unpin ${placeholder ? "blank module" : moduleTitle}`
            : `Pin ${placeholder ? "blank module" : moduleTitle}`;
          const removable = module.type !== "profile_info";
          const removeLabel = placeholder
            ? "Delete blank module"
            : `Remove ${moduleTitle}`;
          const editControlSize = placeholderMicro ? "size-6" : "size-8";
          const editControlIconSize = placeholderMicro ? 12 : 15;

          return (
            <ProfileGridModule
              key={module.id}
              className={cn(
                "z-10 rounded-card transition duration-fluid ease-fluid",
                profileCanvasModuleYieldsToNewSelection(module)
                  ? "pointer-events-none"
                  : undefined,
                configured ? "backdrop-blur-veil" : undefined,
                module.pinned
                  ? "outline outline-2 outline-rose/70 ring-2 ring-rose/20"
                  : undefined,
                selectedMobile
                  ? "outline outline-2 outline-focus/85 ring-4 ring-focus/18"
                  : undefined,
                editorGrid.mobile && mobileMoveModuleId === module.id
                  ? "outline outline-2 outline-accent/80 ring-4 ring-accent/18"
                  : undefined,
              )}
              deferRender={false}
              data-profile-canvas-preview-blurred={configured ? "true" : undefined}
              layout={layout}
              layoutAnimation={false}
              pinned={module.pinned}
              selected={selectedMobile}
              size={size}
              testId={`profile-canvas-module-${module.id}`}
            >
              <div
                className={cn(
                  "relative h-full min-h-0 cursor-grab rounded-card active:cursor-grabbing",
                  configured
                    ? "overflow-hidden border border-line-strong bg-surface/90 p-2 shadow-inner-soft"
                    : undefined,
                )}
                onClick={(event) => {
                  if (!editorGrid.mobile) {
                    return;
                  }

                  const target = event.target;

                  if (
                    target instanceof HTMLElement &&
                    target.closest('[data-profile-edit-control="true"]')
                  ) {
                    return;
                  }

                  event.stopPropagation();
                  setSelectionStart(undefined);
                  setSelectionHover(undefined);
                  setSelectedMobileModuleId(module.id);
                }}
                onPointerDown={(event) => {
                  const target = event.target;

                  if (
                    editorGrid.mobile ||
                    module.pinned ||
                    event.button !== 0 ||
                    (target instanceof HTMLElement &&
                      target.closest('[data-profile-edit-control="true"]'))
                  ) {
                    return;
                  }

                  const rect = event.currentTarget.getBoundingClientRect();
                  const dragSize =
                    profileGridModuleSpanSize(layout.colSpan, layout.rowSpan) ??
                    getProfileModuleDefinition(module.type).defaultSize;

                  updateDragState({
                    moduleId: module.id,
                    pointerOffsetX: event.clientX - rect.left,
                    pointerOffsetY: event.clientY - rect.top,
                    previewLayout: layout,
                    size: dragSize,
                    startLayout: layout,
                    valid: true,
                  });
                }}
              >
                {placeholder ? (
                  <div
                    className={cn(
                      "grid h-full min-h-0 w-full place-items-center overflow-hidden rounded-card border border-dashed border-line-strong bg-surface/62 text-center shadow-soft backdrop-blur-veil",
                      placeholderMicro
                        ? "p-1"
                        : placeholderSmall
                          ? "p-2"
                          : "p-4",
                    )}
                    data-testid={`profile-canvas-blank-module-${module.id}`}
                  >
                    <button
                      type="button"
                      className={cn(
                        "min-w-0 max-w-full rounded-card text-center transition duration-fluid ease-fluid hover:scale-[1.02] focus-visible:outline-2 focus-visible:outline-focus",
                        placeholderMicro
                          ? "px-1 py-0.5"
                          : placeholderSmall
                            ? "px-2 py-1"
                            : "px-3 py-2",
                      )}
                      data-profile-edit-control="true"
                      data-testid={`profile-canvas-add-module-${module.id}`}
                      onClick={() => {
                        if (editorGrid.mobile) {
                          setSelectionStart(undefined);
                          setSelectionHover(undefined);
                          setSelectedMobileModuleId(module.id);
                          return;
                        }

                        setSettingsModuleId(undefined);
                        setPickerModuleId(module.id);
                      }}
                    >
                      <span
                        className={cn(
                          "mx-auto grid place-items-center rounded-full border border-line bg-canvas/80 text-accent-strong",
                          placeholderMicro
                            ? "size-8"
                            : placeholderSmall
                              ? "size-9"
                              : "size-11",
                        )}
                      >
                        <Plus
                          aria-hidden="true"
                          size={placeholderMicro ? 16 : placeholderSmall ? 18 : 22}
                        />
                      </span>
                      <span
                        className={cn(
                          "block max-w-full break-words font-semibold text-text",
                          placeholderMicro
                            ? "mt-1 text-[0.68rem] leading-3"
                            : placeholderSmall
                              ? "mt-1.5 text-xs leading-4"
                              : "mt-3 text-sm",
                        )}
                      >
                        {placeholderLabel}
                      </span>
                      <span
                        className={cn(
                          "block font-medium text-muted",
                          placeholderMicro
                            ? "sr-only"
                            : placeholderSmall
                              ? "mt-0.5 text-[0.68rem]"
                              : "mt-1 text-xs",
                        )}
                      >
                        {profileModuleSizeLabel("placeholder", size)}
                      </span>
                    </button>
                  </div>
                ) : (
                  <div
                    className={cn(
                      "h-full min-h-0 min-w-0 overflow-hidden rounded-card",
                      "pointer-events-none select-none",
                    )}
                    data-profile-canvas-module-configured={
                      configured ? "true" : "false"
                    }
                    data-profile-module-content-interactive="false"
                    data-profile-canvas-module-frame="light"
                    data-profile-editor-render-mode="light"
                    data-testid={`profile-canvas-module-content-${module.id}`}
                    inert
                  >
                    <ProfileCanvasModulePreview
                      module={module}
                      mobile={editorGrid.mobile}
                      size={size}
                    />
                  </div>
                )}
              </div>
              {!editorGrid.mobile ? (
                <ProfileCanvasResizeHandles
                  compact={placeholderMicro}
                  disabled={module.pinned}
                  layout={layout}
                  module={module}
                  onResizeStart={handleResizePointerStart}
                />
              ) : null}
              {!editorGrid.mobile ? (
                <div
                  className={cn(
                    "absolute right-1.5 top-1.5 z-50 flex items-center gap-1",
                    placeholderMicro ? "right-1 top-1 gap-0.5" : undefined,
                  )}
                  data-profile-edit-control="true"
                >
                  {removable ? (
                    <button
                      type="button"
                      className={cn(
                        "grid place-items-center rounded-full border border-line bg-surface/92 text-rose-ink shadow-soft backdrop-blur-veil transition hover:border-line-strong focus-visible:outline-2 focus-visible:outline-focus",
                        editControlSize,
                      )}
                      aria-label={removeLabel}
                      title={removeLabel}
                      data-profile-edit-control="true"
                      data-testid={
                        placeholder
                          ? `profile-canvas-delete-placeholder-${module.id}`
                          : `profile-canvas-remove-module-${module.id}`
                      }
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        handleRemoveModule(module);
                      }}
                    >
                      <Trash2 aria-hidden="true" size={editControlIconSize} />
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className={cn(
                      "grid place-items-center rounded-full border border-line bg-surface/92 text-text shadow-soft backdrop-blur-veil transition hover:border-line-strong focus-visible:outline-2 focus-visible:outline-focus",
                      module.pinned ? "border-rose/50 bg-rose/18 text-rose-ink" : undefined,
                      editControlSize,
                    )}
                    aria-label={pinLabel}
                    aria-pressed={module.pinned}
                    title={pinLabel}
                    data-testid={`profile-canvas-pin-module-${module.id}`}
                    onClick={() => handleTogglePin(module)}
                  >
                    {module.pinned ? (
                      <PinOff aria-hidden="true" size={editControlIconSize} />
                    ) : (
                      <Pin aria-hidden="true" size={editControlIconSize} />
                    )}
                  </button>
                </div>
              ) : null}
              {!placeholder ? (
                <button
                  type="button"
                  className={cn(
                    "absolute left-1/2 top-1/2 z-30 size-12 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-line bg-surface/92 text-text shadow-lift backdrop-blur-veil transition duration-fluid ease-fluid hover:scale-105 hover:border-line-strong focus-visible:outline-2 focus-visible:outline-focus",
                    editorGrid.mobile ? "hidden" : "grid",
                  )}
                  aria-label={`Edit ${moduleTitle}`}
                  title={`Edit ${moduleTitle}`}
                  data-profile-edit-control="true"
                  data-testid={`profile-canvas-edit-module-${module.id}`}
                  onClick={() => setSettingsModuleId(module.id)}
                >
                  <MoreHorizontal aria-hidden="true" size={24} />
                </button>
              ) : null}
            </ProfileGridModule>
          );
        })}
        <ProfileEditorCoachmarkTour
          className={profileEditorCoachmarkPositionClass(guideStep.target)}
          index={guideStepIndex}
          open={guideOpen}
          onComplete={onGuideComplete}
          onDismiss={onGuideDismiss}
          onIndexChange={setGuideStepIndex}
        />
      </ProfileGrid>
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 opacity-0">
        {sortedModules.map((module) => (
          <ProfileCanvasMediaContractPreview
            key={`media-contract-${module.id}`}
            module={module}
          />
        ))}
      </div>
      {editorGrid.mobile && selectedMobileModule ? (
        <div
          className="fixed bottom-20 left-3 right-3 z-50 mx-auto flex max-w-[30rem] items-center gap-2 rounded-card border border-line-strong bg-surface/94 p-2 shadow-lift backdrop-blur-veil"
          data-profile-edit-control="true"
          data-testid="profile-canvas-selected-actions"
        >
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold text-text">
              {selectedMobileTitle}
            </p>
            <p className="truncate text-[0.68rem] font-medium text-muted">
              {selectedMobileMoveActive ? "Tap a grid square to move" : "Selected"}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              className={cn(
                "grid size-9 touch-manipulation place-items-center rounded-full border border-line bg-canvas/70 text-text shadow-soft transition hover:border-line-strong focus-visible:outline-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-45",
                selectedMobileMoveActive ? "border-focus/60 bg-focus/18" : undefined,
              )}
              aria-label={selectedMobileMoveLabel}
              aria-pressed={selectedMobileMoveActive}
              title={
                selectedMobileMoveDisabled
                  ? "Unpin before moving"
                  : selectedMobileMoveActive
                    ? "Stop moving"
                    : "Move"
              }
              disabled={selectedMobileMoveDisabled}
              data-testid="profile-canvas-selected-move"
              onClick={() => {
                setSelectionStart(undefined);
                setSelectionHover(undefined);
                setMobileMoveModuleId((current) =>
                  current === selectedMobileModule.id
                    ? undefined
                    : selectedMobileModule.id,
                );
              }}
            >
              <Move aria-hidden="true" size={16} />
            </button>
            <button
              type="button"
              className="grid size-9 touch-manipulation place-items-center rounded-full border border-line bg-canvas/70 text-text shadow-soft transition hover:border-line-strong focus-visible:outline-2 focus-visible:outline-focus"
              aria-label={selectedMobileSettingsLabel}
              title={selectedMobilePlaceholder ? "Add" : "Edit"}
              data-testid="profile-canvas-selected-settings"
              onClick={() => {
                setMobileMoveModuleId(undefined);
                if (selectedMobilePlaceholder) {
                  setSettingsModuleId(undefined);
                  setPickerModuleId(selectedMobileModule.id);
                  return;
                }

                setPickerModuleId(undefined);
                setSettingsModuleId(selectedMobileModule.id);
              }}
            >
              {selectedMobilePlaceholder ? (
                <Plus aria-hidden="true" size={17} />
              ) : (
                <Pencil aria-hidden="true" size={15} />
              )}
            </button>
            <button
              type="button"
              className={cn(
                "grid size-9 touch-manipulation place-items-center rounded-full border border-line bg-canvas/70 text-text shadow-soft transition hover:border-line-strong focus-visible:outline-2 focus-visible:outline-focus",
                selectedMobileModule.pinned
                  ? "border-rose/50 bg-rose/18 text-rose-ink"
                  : undefined,
              )}
              aria-label={selectedMobilePinLabel}
              aria-pressed={selectedMobileModule.pinned}
              title={selectedMobileModule.pinned ? "Unpin" : "Pin"}
              data-testid="profile-canvas-selected-pin"
              onClick={() => handleTogglePin(selectedMobileModule)}
            >
              {selectedMobileModule.pinned ? (
                <PinOff aria-hidden="true" size={15} />
              ) : (
                <Pin aria-hidden="true" size={15} />
              )}
            </button>
            {selectedMobileCanRemove ? (
              <button
                type="button"
                className="grid size-9 touch-manipulation place-items-center rounded-full border border-line bg-canvas/70 text-rose-ink shadow-soft transition hover:border-line-strong focus-visible:outline-2 focus-visible:outline-focus"
                aria-label={selectedMobileRemoveLabel}
                title={selectedMobilePlaceholder ? "Delete" : "Remove"}
                data-testid="profile-canvas-selected-delete"
                onClick={() => handleRemoveModule(selectedMobileModule)}
              >
                <Trash2 aria-hidden="true" size={15} />
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
      <ModulePickerModal
        module={pickerModule}
        onChoose={handleChooseModule}
        onClose={() => setPickerModuleId(undefined)}
      />
      <ModuleSettingsModal
        integrationAccounts={integrationAccounts}
        integrationProviders={integrationProviders}
        module={settingsModule}
        profile={profile}
        uploading={uploading}
        onClose={() => setSettingsModuleId(undefined)}
        onRemove={handleRemoveModule}
        onResize={handleResizeModule}
        onConnectProvider={onConnectProvider}
        onModuleAudioUpload={onModuleAudioUpload}
        onModuleImagePrepare={onModuleImagePrepare}
        onModuleImageUpload={onModuleImageUpload}
        onModuleVideoUpload={onModuleVideoUpload}
        onProfileImageUpload={onImageUpload}
        onProfileDraftChange={onProfileDraftChange}
        onUpdateConfig={handleModuleConfig}
      />
    </section>
  );
}

const ProfileCanvasModulePreview = memo(function ProfileCanvasModulePreview({
  mobile,
  module,
  size,
}: {
  mobile: boolean;
  module: ProfileModule;
  size: ProfileGridModuleSize;
}) {
  const category = profileCanvasModulePreviewCategory(module.type);
  const title = profileCanvasModulePreviewTitle(module);
  const presentation = profileModulePresentation(size);
  const subtitle = profileCanvasModulePreviewSubtitle(
    module,
    size,
    presentation.showSecondaryText,
  );
  const imageUrl = profileCanvasModulePreviewImage(module);
  const span = profileGridModuleSizeSpan(size);
  const micro = mobile && (span.columns <= 1 || span.rows <= 1);
  const tiny =
    mobile && !micro && span.columns <= 2 && span.rows <= 2;
  const compact =
    mobile &&
    !micro &&
    !tiny &&
    (span.columns <= 3 || span.rows <= 2);
  const slim = !mobile && (span.rows <= 1 || (span.columns >= 5 && span.rows <= 2));
  const previewRole = micro
    ? "micro"
    : tiny
      ? "tiny"
      : compact
        ? "compact"
        : slim
          ? "slim"
          : "full";
  const configured = profileCanvasModuleIsConfiguredForEditor(module);
  const showImageBackground = Boolean(imageUrl && !slim && !micro && !tiny);
  const showImageTile = Boolean(imageUrl && (slim || compact));
  const showIcon = !imageUrl || showImageBackground || !micro;
  const showTitle = !micro;
  const showSubtitle = Boolean(subtitle) && (!mobile || (!tiny && !compact));
  const showSize = !mobile;

  if (micro || tiny || compact) {
    return (
      <div
        className={cn(
          "relative h-full min-h-0 w-full overflow-hidden rounded-card border border-line bg-canvas/60 text-text shadow-inner-soft",
          micro
            ? "grid place-items-center p-1"
            : tiny
              ? "grid place-items-center p-1.5 text-center"
              : "flex items-center gap-1.5 p-1.5",
        )}
        data-profile-canvas-preview-role={previewRole}
        data-profile-editor-render-mode="light"
        data-profile-editor-preview-mobile="true"
        data-testid={`profile-canvas-light-preview-${module.id}`}
      >
        {imageUrl && micro ? (
          <img
            alt=""
            className="pointer-events-none absolute inset-0 size-full select-none object-cover opacity-75"
            loading="lazy"
            src={imageUrl}
          />
        ) : null}
        {showImageTile ? (
          <img
            alt=""
            className="pointer-events-none size-8 shrink-0 select-none rounded-[0.6rem] border border-line object-cover"
            loading="lazy"
            src={imageUrl}
          />
        ) : null}
        {showIcon ? (
          <span
            className={cn(
              "relative z-10 grid shrink-0 place-items-center rounded-[0.6rem] border border-line bg-surface/78 text-text shadow-soft",
              micro ? "size-8" : tiny ? "size-9" : "size-8",
              imageUrl && micro ? "bg-canvas/80 backdrop-blur-veil" : undefined,
            )}
          >
            <ProfileModulePickerIcon
              category={category}
              disabled={false}
              type={module.type}
            />
          </span>
        ) : null}
        {showTitle ? (
          <span
            className={cn(
              "relative z-10 min-w-0 font-semibold text-text",
              tiny
                ? "mt-1 block max-w-full truncate text-[0.68rem] leading-3"
                : "block flex-1 truncate text-[0.72rem] leading-4",
            )}
            data-testid={`profile-canvas-preview-title-${module.id}`}
          >
            {title}
          </span>
        ) : null}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative h-full min-h-0 w-full overflow-hidden rounded-card border border-line bg-canvas/60 text-text shadow-inner-soft",
        slim ? "flex items-center gap-2 p-2" : "p-3",
      )}
      data-profile-canvas-preview-role={previewRole}
      data-profile-editor-render-mode="light"
      data-profile-editor-preview-mobile={mobile ? "true" : undefined}
      data-testid={`profile-canvas-light-preview-${module.id}`}
    >
      {imageUrl ? (
        <img
          alt=""
          className={cn(
            "pointer-events-none select-none rounded-card object-cover",
            slim
              ? "size-12 shrink-0 border border-line"
              : "absolute inset-0 size-full opacity-45",
          )}
          loading="lazy"
          src={imageUrl}
        />
      ) : null}
      {showImageBackground ? (
        <div className="absolute inset-0 bg-gradient-to-br from-canvas/92 via-canvas/70 to-canvas/38" />
      ) : null}
      <div
        className={cn(
          "relative z-10 min-w-0",
          slim ? "flex flex-1 items-center gap-2" : "flex h-full flex-col",
        )}
      >
        <span
          className={cn(
            "grid shrink-0 place-items-center rounded-card border border-line bg-surface/78 text-text shadow-soft",
            slim ? "size-9" : "size-10",
          )}
        >
          <ProfileModulePickerIcon
            category={category}
            disabled={false}
            type={module.type}
          />
        </span>
        <span className={cn("min-w-0", slim ? "flex-1" : "mt-3")}>
          <span
            className={cn(
              "block truncate font-semibold text-text",
              slim ? "text-xs" : "text-sm",
            )}
          >
            {title}
          </span>
          {showSubtitle ? (
            <span
              className={cn(
                "block truncate font-medium text-muted",
                slim ? "text-[0.68rem]" : "mt-1 text-xs",
              )}
            >
              {subtitle}
            </span>
          ) : null}
        </span>
        {showSize ? (
          <span
            className={cn(
              "shrink-0 rounded-full border px-2 py-0.5 text-[0.62rem] font-semibold uppercase tracking-[0.08em]",
              configured
                ? "border-line bg-surface/70 text-muted"
                : "border-focus/40 bg-focus/15 text-text",
              slim ? "ml-auto" : "mt-auto self-start",
            )}
          >
            {size}
          </span>
        ) : null}
      </div>
    </div>
  );
});

function profileCanvasModuleYieldsToNewSelection(module: ProfileModule): boolean {
  return module.type === "activity" && !module.pinned;
}

function ProfileCanvasMediaContractPreview({
  module,
}: {
  module: ProfileModule;
}) {
  if (module.config.video?.url) {
    const video = module.config.video;

    return (
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-0"
        data-profile-uploaded-video-layout="editor-preview"
        data-testid="profile-uploaded-video-player"
      >
        <span
          className="size-full"
          data-testid="profile-uploaded-video-element"
          data-profile-uploaded-video-poster={video.posterUrl}
          data-profile-uploaded-video-src={video.url}
          data-profile-uploaded-video-type={video.mime}
        />
      </div>
    );
  }

  if (module.config.audio?.url) {
    const audio = module.config.audio;

    return (
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-0"
        data-profile-uploaded-audio-layout="editor-preview"
        data-profile-uploaded-audio-src={audio.url}
        data-testid="profile-uploaded-audio-player"
      />
    );
  }

  return null;
}

function profileCanvasModulePreviewCategory(
  type: ProfileModule["type"],
): ProfileModuleCategory {
  return profileModuleCatalog.find((item) => item.type === type)?.category ?? "info";
}

function profileCanvasModulePreviewTitle(module: ProfileModule): string {
  const title =
    module.title?.trim() ||
    module.config.label?.trim() ||
    module.config.integration?.metadata.title?.trim() ||
    module.config.audio?.title?.trim() ||
    module.config.video?.title?.trim();

  return title || profileModulePickerLabel(module.type);
}

function profileCanvasModulePreviewSubtitle(
  module: ProfileModule,
  size: ProfileGridModuleSize,
  showSecondaryText = true,
): string {
  if (!profileCanvasModuleIsConfiguredForEditor(module)) {
    return `Draft ${profileModuleSizeLabel(module.type, size)}`;
  }

  if (module.config.body?.trim()) {
    return profileCanvasPlainTextSnippet(module.config.body, 72);
  }

  if (!showSecondaryText) {
    return "";
  }

  if (module.config.integration) {
    const provider = profileCanvasProviderLabel(module.config.integration.provider);
    const subtitle = module.config.integration.metadata.subtitle?.trim();

    return subtitle ? `${provider} · ${subtitle}` : provider;
  }

  if (module.config.audio) {
    return module.config.description?.trim() || "";
  }

  if (module.config.video) {
    return "Uploaded video";
  }

  if (module.config.mediaItems?.length) {
    const count = module.config.mediaItems.length;

    return count === 1 ? "1 photo" : `${count} photos`;
  }

  if (module.config.links?.length) {
    const count = module.config.links.length;

    return count === 1 ? "1 link" : `${count} links`;
  }

  return profileModuleSizeLabel(module.type, size);
}

function profileCanvasModulePreviewImage(
  module: ProfileModule,
): string | undefined {
  const candidates = [
    module.config.mediaItems?.[0]?.url,
    module.config.integration?.metadata.imageUrl ?? undefined,
  ];

  for (const candidate of candidates) {
    const safeUrl = safeProfileImageUrl(candidate);

    if (safeUrl) {
      return safeUrl;
    }
  }

  return undefined;
}

function profileCanvasPlainTextSnippet(value: string, maxLength: number): string {
  const stripped = value
    .replace(/```[\s\S]*?```/g, " code ")
    .replace(/\[([^\]]+)\]\(https?:\/\/[^)]+\)/g, "$1")
    .replace(/[*_`>#-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (stripped.length <= maxLength) {
    return stripped;
  }

  return `${stripped.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

function ProfileCanvasResizeHandles({
  compact,
  disabled,
  layout,
  module,
  onResizeStart,
}: {
  compact: boolean;
  disabled: boolean;
  layout: ProfileModuleLayout;
  module: ProfileModule;
  onResizeStart: (
    module: ProfileModule,
    layout: ProfileModuleLayout,
    direction: ProfileCanvasResizeDirection,
    event: ReactPointerEvent<HTMLButtonElement>,
  ) => void;
}) {
  return (
    <div
      className="absolute inset-0 z-20 pointer-events-none"
      data-profile-edit-control="true"
    >
      {profileCanvasResizeDirections.map((direction) => {
        const title = disabled
          ? "Unpin this module before resizing"
          : `Resize from ${profileCanvasResizeDirectionLabels[direction]}`;

        return (
          <button
            key={direction}
            type="button"
            className={cn(
              "pointer-events-auto absolute grid place-items-center rounded-full border border-line bg-surface/95 text-text shadow-soft backdrop-blur-veil transition duration-fluid ease-fluid hover:scale-110 hover:border-line-strong hover:bg-surface focus-visible:outline-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100",
              profileCanvasResizeHandleClass(direction, compact),
            )}
            aria-label={title}
            disabled={disabled}
            title={title}
            data-profile-edit-control="true"
            data-testid={`profile-canvas-resize-handle-${module.id}-${direction}`}
            onPointerDown={(event) =>
              onResizeStart(module, layout, direction, event)
            }
          >
            <span className="size-1.5 rounded-full bg-current" />
          </button>
        );
      })}
    </div>
  );
}

function profileCanvasResizeHandleClass(
  direction: ProfileCanvasResizeDirection,
  compact: boolean,
): string {
  const edgeLength = compact ? "w-5" : "w-7";
  const edgeThickness = compact ? "h-2" : "h-2.5";
  const sideLength = compact ? "h-5" : "h-7";
  const sideThickness = compact ? "w-2" : "w-2.5";
  const cornerSize = compact ? "size-3" : "size-3.5";

  if (direction === "north") {
    return `${edgeLength} ${edgeThickness} left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 cursor-ns-resize`;
  }

  if (direction === "south") {
    return `${edgeLength} ${edgeThickness} bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 cursor-ns-resize`;
  }

  if (direction === "east") {
    return `${sideThickness} ${sideLength} right-0 top-1/2 -translate-y-1/2 translate-x-1/2 cursor-ew-resize`;
  }

  if (direction === "west") {
    return `${sideThickness} ${sideLength} left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize`;
  }

  if (direction === "north-east") {
    return `${cornerSize} right-0 top-0 -translate-y-1/2 translate-x-1/2 cursor-nesw-resize`;
  }

  if (direction === "south-east") {
    return `${cornerSize} bottom-0 right-0 translate-x-1/2 translate-y-1/2 cursor-nwse-resize`;
  }

  if (direction === "south-west") {
    return `${cornerSize} bottom-0 left-0 -translate-x-1/2 translate-y-1/2 cursor-nesw-resize`;
  }

  return `${cornerSize} left-0 top-0 -translate-x-1/2 -translate-y-1/2 cursor-nwse-resize`;
}

function ModulePickerModal({
  module,
  onChoose,
  onClose,
}: {
  module: ProfileModule | undefined;
  onChoose: (type: ProfileModule["type"]) => Promise<void> | void;
  onClose: () => void;
}) {
  const [activeCategory, setActiveCategory] =
    useState<ProfileModuleCategory>("video");
  const handleClose = useCallback(() => {
    setActiveCategory("video");
    onClose();
  }, [onClose]);
  const handleChoose = useCallback(
    (type: ProfileModule["type"]) => {
      setActiveCategory("video");
      onChoose(type);
    },
    [onChoose],
  );

  const pickerItems = useMemo(() => {
    if (!module?.layout) {
      return [];
    }

    return profileModuleCatalog
      .filter((item) => item.category === activeCategory)
      .map((item) => {
        const fit = profileCanvasFitForSelection(item.type, module.layout!);
        const sortSpan = profileGridModuleSizeSpan(fit.sortSize);

        return {
          ...item,
          enabled: fit.enabled,
          fittingSize: fit.exactSize,
          noteSize: fit.noteSize,
          sortArea: sortSpan.columns * sortSpan.rows,
          warning: fit.warning,
        };
      })
      .sort(
        (first, second) =>
          Number(!first.enabled) - Number(!second.enabled) ||
          first.sortArea - second.sortArea ||
          first.label.localeCompare(second.label),
      );
  }, [activeCategory, module]);

  return (
    <ModalSheet
      open={Boolean(module)}
      onClose={handleClose}
      title="Add module"
      description="Pick a tool for this space."
      size="md"
      testId="profile-module-picker"
    >
      {module?.layout ? (
        <div className="space-y-3">
          <div
            className="flex gap-1 overflow-x-auto rounded-card border border-line bg-canvas/45 p-1"
            role="tablist"
            aria-label="Module categories"
          >
            {profileModulePickerCategories.map(({ category, icon: Icon, label }) => {
              const active = activeCategory === category;

              return (
                <button
                  key={category}
                  type="button"
                  className={cn(
                    "inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-control px-2.5 text-xs font-semibold transition duration-fluid ease-fluid focus-visible:outline-2 focus-visible:outline-focus",
                    active
                      ? "bg-surface text-text shadow-soft"
                      : "text-muted hover:bg-surface/56 hover:text-text",
                  )}
                  role="tab"
                  aria-selected={active}
                  onClick={() => setActiveCategory(category)}
                >
                  <Icon aria-hidden="true" size={15} />
                  {label}
                </button>
              );
            })}
          </div>
          <div className="grid gap-2">
            {pickerItems.map((item) => {
              const label = profileModulePickerLabel(item.type);
              const accessibleLabel = profileModulePickerAccessibleLabel(item.type);

              return (
                <button
                  key={item.type}
                  type="button"
                  className={cn(
                    "flex min-h-14 min-w-0 items-center gap-3 rounded-card border border-line bg-canvas/45 px-3 py-2 text-left transition duration-fluid ease-fluid hover:border-line-strong hover:bg-surface/70 focus-visible:outline-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:hover:border-line disabled:hover:bg-canvas/45",
                    !item.enabled ? "opacity-55" : undefined,
                  )}
                  disabled={!item.enabled}
                  aria-label={accessibleLabel}
                  data-testid={`profile-module-picker-${item.type}`}
                  onClick={() => handleChoose(item.type)}
                >
                  <span
                    className={cn(
                      "grid size-9 shrink-0 place-items-center rounded-card border border-line bg-surface/75 text-text",
                      !item.enabled ? "blur-[0.8px]" : undefined,
                    )}
                  >
                    <ProfileModulePickerIcon
                      category={item.category}
                      disabled={!item.enabled}
                      type={item.type}
                    />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span
                      className={cn(
                        "block truncate text-sm font-semibold text-text",
                        !item.enabled ? "blur-[0.7px]" : undefined,
                      )}
                    >
                      {label}
                    </span>
                    <span className="mt-0.5 block truncate text-xs font-medium text-muted">
                      {item.enabled && item.fittingSize ? (
                        profileModuleSizeLabel(item.type, item.fittingSize)
                      ) : (
                        <>
                          <span className="block">
                            {item.warning === "too-large"
                              ? "Selection too large."
                              : "Selection too small."}
                          </span>
                          {item.noteSize ? (
                            <span className="block text-[0.68rem]">
                              ({item.noteSize})
                            </span>
                          ) : null}
                        </>
                      )}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </ModalSheet>
  );
}

const profileModulePickerCategories = [
  { category: "video", icon: Video, label: "Video" },
  { category: "music", icon: Music2, label: "Music" },
  { category: "images", icon: ImagePlus, label: "Images" },
  { category: "info", icon: Info, label: "Info" },
  { category: "projects", icon: FolderGit2, label: "Projects" },
] satisfies {
  category: ProfileModuleCategory;
  icon: typeof Video;
  label: string;
}[];

const profileModulePickerDisplayLabels: Partial<
  Record<ProfileModule["type"], string>
> = {
  apple_music_artist: "Artist",
  apple_music_playlist: "Playlist",
  apple_music_song: "Music",
  github_repo: "Repository",
  music: "MP3",
  spotify_artist: "Artist",
  spotify_playlist: "Playlist",
  spotify_song: "Music",
  twitch_channel: "Stream",
  youtube_music_artist: "Artist",
  youtube_music_playlist: "Playlist",
  youtube_music_song: "Music",
  youtube_playlist: "Playlist",
  youtube_stream: "Stream",
  youtube_video: "Video",
};

const profileModulePickerAccessibleLabels: Partial<
  Record<ProfileModule["type"], string>
> = {
  apple_music_artist: "Apple Music artist",
  apple_music_playlist: "Apple Music playlist",
  apple_music_song: "Apple Music song",
  github_repo: "GitHub repository",
  music: "MP3 music upload",
  spotify_artist: "Spotify artist",
  spotify_playlist: "Spotify playlist",
  spotify_song: "Spotify song",
  twitch_channel: "Twitch stream",
  youtube_music_artist: "YouTube Music artist",
  youtube_music_playlist: "YouTube Music playlist",
  youtube_music_song: "YouTube Music song",
  youtube_playlist: "YouTube playlist",
  youtube_stream: "YouTube stream",
  youtube_video: "YouTube video",
};

function profileModulePickerLabel(type: ProfileModule["type"]): string {
  return profileModulePickerDisplayLabels[type] ?? getProfileModuleDefinition(type).label;
}

function profileModulePickerAccessibleLabel(type: ProfileModule["type"]): string {
  return profileModulePickerAccessibleLabels[type] ?? profileModulePickerLabel(type);
}

function profileModulePickerBrand(
  type: ProfileModule["type"],
): ProfileConnectionIconPlatform | undefined {
  if (type.startsWith("apple_music_")) {
    return "apple_music";
  }

  if (type === "github_repo") {
    return "github";
  }

  if (type.startsWith("spotify_")) {
    return "spotify";
  }

  if (type === "twitch_channel") {
    return "twitch";
  }

  if (type.startsWith("youtube_")) {
    return "youtube";
  }

  return undefined;
}

function ProfileModulePickerIcon({
  category,
  disabled,
  type,
}: {
  category: ProfileModuleCategory;
  disabled: boolean;
  type: ProfileModule["type"];
}) {
  const brand = profileModulePickerBrand(type);
  const iconClassName = disabled ? "opacity-80" : undefined;

  if (brand) {
    return (
      <ProfileConnectionIcon
        className={iconClassName}
        platform={brand}
        size={16}
      />
    );
  }

  const props = {
    "aria-hidden": true,
    className: iconClassName,
    "data-testid": `profile-module-picker-icon-${type}`,
    size: 16,
  } as const;

  if (category === "video") {
    return <Video {...props} />;
  }

  if (category === "music") {
    return <Music2 {...props} />;
  }

  if (category === "images") {
    return <ImagePlus {...props} />;
  }

  if (category === "projects") {
    return <FolderGit2 {...props} />;
  }

  if (category === "info") {
    return <Info {...props} />;
  }

  return <Sparkles {...props} />;
}

function ModuleSettingsModal({
  integrationAccounts,
  integrationProviders,
  module,
  onClose,
  onConnectProvider,
  onModuleAudioUpload,
  onModuleImagePrepare,
  onModuleImageUpload,
  onModuleVideoUpload,
  onProfileImageUpload,
  onProfileDraftChange,
  onRemove,
  onResize,
  onUpdateConfig,
  profile,
  uploading,
}: {
  integrationAccounts: ProfileIntegrationAccount[];
  integrationProviders: ProfileIntegrationProviderStatus[];
  module: ProfileModule | undefined;
  onClose: () => void;
  onConnectProvider: (provider: ProfileIntegrationProvider) => void;
  onModuleAudioUpload: (file: File) => Promise<UploadedAudio>;
  onModuleImagePrepare: (file: File) => Promise<File>;
  onModuleImageUpload: (file: File) => Promise<string>;
  onModuleVideoUpload: (file: File) => Promise<UploadedVideo>;
  onProfileImageUpload: (
    file: File,
    purpose: "avatar" | "banner" | "profile_background",
  ) => void;
  onProfileDraftChange: (updater: (profile: Profile) => Profile) => void;
  onRemove: (module: ProfileModule) => void;
  onResize: (module: ProfileModule, size: ProfileGridModuleSize) => void;
  onUpdateConfig: (module: ProfileModule, config: ProfileModule["config"]) => void;
  profile: Profile;
  uploading?: "backgroundImage" | "backgroundVideo" | "avatar" | "banner" | undefined;
}) {
  const definition = module ? getProfileModuleDefinition(module.type) : undefined;
  const provider = module ? profileCanvasProviderForModule(module.type) : undefined;
  const providerStatus = provider
    ? integrationProviders.find((item) => item.provider === provider)
    : undefined;
  const connectedAccount = provider
    ? integrationAccounts.find(
        (item) => item.provider === provider && !item.revokedAt,
      )
    : undefined;
  const showConnectPrompt = Boolean(
    provider && providerStatus?.oauthEnabled && !connectedAccount,
  );
  const providerLabel = provider ? profileCanvasProviderLabel(provider) : undefined;
  const [moduleAudioUploading, setModuleAudioUploading] = useState(false);
  const [moduleAudioError, setModuleAudioError] = useState<string | undefined>();
  const [moduleImageUploading, setModuleImageUploading] = useState(false);
  const [moduleImageError, setModuleImageError] = useState<string | undefined>();
  const [moduleVideoUploading, setModuleVideoUploading] = useState(false);
  const [moduleVideoError, setModuleVideoError] = useState<string | undefined>();
  const [connectionPlatform, setConnectionPlatform] =
    useState<ProfileConnectionPlatform>("website");
  const [connectionValue, setConnectionValue] = useState("");
  const [connectionError, setConnectionError] = useState<string | undefined>();
  const [connectionFormOpen, setConnectionFormOpen] = useState(false);
  const [moduleImageCropQueue, setModuleImageCropQueue] = useState<File[]>([]);
  const profileInfoAvatarInputRef = useRef<HTMLInputElement | null>(null);
  const profileInfoBannerInputRef = useRef<HTMLInputElement | null>(null);
  const connectionLinks = module?.config.links ?? [];
  const canAddConnection = connectionLinks.length < maxProfileConnections;
  const moduleMediaItems = module?.config.mediaItems ?? [];
  const singlePhotoImageModule = module
    ? profileModuleStoresSinglePhoto(module.type)
    : false;
  const visibleModuleMediaItems = singlePhotoImageModule
    ? moduleMediaItems.slice(0, 1)
    : moduleMediaItems;
  const moduleMediaMaxItems = singlePhotoImageModule ? 1 : 6;
  const moduleMediaSlots = Math.max(0, moduleMediaMaxItems - moduleMediaItems.length);
  const canUploadModuleImage = singlePhotoImageModule || moduleMediaSlots > 0;
  const activeModuleImageCropFile = moduleImageCropQueue[0];
  const allowedSizes =
    module && module.type !== "placeholder"
      ? [...profileModuleAllowedSizes(module.type)]
      : [];
  const layoutSize = module?.layout
    ? profileGridModuleSpanSize(module.layout.colSpan, module.layout.rowSpan)
    : undefined;
  const currentSize =
    layoutSize ??
    normalizeProfileGridModuleSize(module?.config.canvasSize) ??
    definition?.defaultSize ??
    allowedSizes[0];
  const currentSizeIndex = currentSize
    ? allowedSizes.indexOf(currentSize)
    : -1;
  const resolvedSizeIndex =
    currentSizeIndex >= 0
      ? currentSizeIndex
      : definition
        ? allowedSizes.indexOf(definition.defaultSize)
        : -1;
  const previousSize =
    resolvedSizeIndex > 0 ? allowedSizes[resolvedSizeIndex - 1] : undefined;
  const nextSize =
    resolvedSizeIndex >= 0 && resolvedSizeIndex < allowedSizes.length - 1
      ? allowedSizes[resolvedSizeIndex + 1]
      : undefined;
  const showMusicUrlField = Boolean(
    module &&
      definition?.category === "music" &&
      (module.type !== "music" || module.config.url?.trim()),
  );

  function updateModuleConfig(nextConfig: ProfileModule["config"]) {
    if (!module) {
      return;
    }

    onUpdateConfig(module, nextConfig);
  }

  function configWithContent(
    patch: ProfileModule["config"],
    configured: boolean,
    removeKeys: (keyof ProfileModule["config"])[] = [],
  ): ProfileModule["config"] {
    const canvasSize = module?.config.canvasSize;
    const nextConfig = {
      ...module?.config,
      ...patch,
      configured,
      ...(canvasSize ? { canvasSize } : {}),
    };

    removeKeys.forEach((key) => {
      delete nextConfig[key];
    });

    return nextConfig;
  }

  function handleUrlConfig(value: string) {
    if (!module || !definition) {
      return;
    }

    const trimmed = value.trim();
    const configured = trimmed.length > 0;
    const label = module.config.label ?? profileModuleFallbackTitle(module.type);

    if (module.type === "connections" || module.type === "links") {
      updateModuleConfig(
        configWithContent(
          {
            links: configured
              ? [{ label, platform: "website", url: trimmed }]
              : [],
          },
          configured,
        ),
      );
      return;
    }

    updateModuleConfig(
      configWithContent(
        {
          label,
          url: trimmed,
        },
        configured,
        definition.category === "music" ? ["audio", "integration"] : ["video", "integration"],
      ),
    );
  }

  function handleProfileInfoImageInput(
    event: ChangeEvent<HTMLInputElement>,
    purpose: "avatar" | "banner",
  ) {
    const file = event.currentTarget.files?.[0];

    if (file) {
      onProfileImageUpload(file, purpose);
    }

    event.currentTarget.value = "";
  }

  function handleClose() {
    setConnectionPlatform("website");
    setConnectionValue("");
    setConnectionError(undefined);
    setConnectionFormOpen(false);
    setModuleAudioError(undefined);
    setModuleVideoError(undefined);
    setModuleImageCropQueue([]);
    onClose();
  }

  function updateConnectionLinks(nextLinks: ProfileModuleLink[]) {
    updateModuleConfig(
      configWithContent(
        {
          links: profileModuleUniqueConnectionLinks(nextLinks).slice(
            0,
            maxProfileConnections,
          ),
        },
        nextLinks.length > 0,
      ),
    );
  }

  function handleAddConnection() {
    if (!module) {
      return;
    }

    const result = profileModuleConnectionLinkFromDraft(
      connectionPlatform,
      connectionValue,
    );

    if ("error" in result) {
      setConnectionError(result.error);
      return;
    }

    const nextLinks = profileModuleUniqueConnectionLinks([
      ...connectionLinks,
      result.link,
    ]);

    updateConnectionLinks(nextLinks);
    setConnectionValue("");
    setConnectionError(undefined);
    setConnectionFormOpen(false);
  }

  function handleRemoveConnection(index: number) {
    updateConnectionLinks(connectionLinks.filter((_, itemIndex) => itemIndex !== index));
  }

  function handleMoveConnection(index: number, direction: -1 | 1) {
    const nextIndex = index + direction;

    if (nextIndex < 0 || nextIndex >= connectionLinks.length) {
      return;
    }

    const nextLinks = [...connectionLinks];
    const [item] = nextLinks.splice(index, 1);

    if (!item) {
      return;
    }

    nextLinks.splice(nextIndex, 0, item);
    updateConnectionLinks(nextLinks);
  }

  function handleRemoveModuleImage(index: number) {
    if (!module) {
      return;
    }

    const mediaItems = moduleMediaItems.filter(
      (_, itemIndex) => itemIndex !== index,
    );

    updateModuleConfig(
      configWithContent(
        {
          mediaItems,
        },
        mediaItems.length > 0,
      ),
    );
  }

  async function handleModuleVideoSelection(file: File | undefined) {
    if (!module || !file || moduleVideoUploading) {
      return;
    }

    const validationError = validateProfileModuleVideoFile(file);

    if (validationError) {
      setModuleVideoError(validationError);
      return;
    }

    setModuleVideoUploading(true);
    setModuleVideoError(undefined);

    try {
      const [upload, duration] = await Promise.all([
        onModuleVideoUpload(file),
        readMediaFileDuration(file),
      ]);
      const title = sanitizeUploadedMediaTitle(file.name, "Uploaded video");
      const video = {
        mime: upload.mime,
        ...(upload.posterUrl ? { posterUrl: upload.posterUrl } : {}),
        size: upload.size,
        title,
        type: upload.type,
        uploadedAt: new Date().toISOString(),
        url: upload.url,
        ...(duration ? { duration } : {}),
      };

      updateModuleConfig(
        configWithContent(
          {
            displayMode: "video",
            label: title,
            sourceMode: "upload",
            video,
          },
          true,
          ["url", "integration", "platform"],
        ),
      );
    } catch (error) {
      setModuleVideoError(
        error instanceof Error ? error.message : "Could not upload this video.",
      );
    } finally {
      setModuleVideoUploading(false);
    }
  }

  async function handleModuleAudioSelection(file: File | undefined) {
    if (!module || !file || moduleAudioUploading) {
      return;
    }

    const validationError = validateProfileModuleAudioFile(file);

    if (validationError) {
      setModuleAudioError(validationError);
      return;
    }

    setModuleAudioUploading(true);
    setModuleAudioError(undefined);

    try {
      const [upload, duration] = await Promise.all([
        onModuleAudioUpload(file),
        readMediaFileDuration(file),
      ]);
      const title = sanitizeUploadedMediaTitle(file.name, "Uploaded track");
      const audio = {
        mime: upload.mime,
        size: upload.size,
        title,
        type: upload.type,
        uploadedAt: new Date().toISOString(),
        url: upload.url,
        ...(duration ? { duration } : {}),
      };

      updateModuleConfig(
        configWithContent(
          {
            audio,
            displayMode: "player",
            label: title,
            platform: "custom",
            sourceMode: "upload",
          },
          true,
          ["url", "integration"],
        ),
      );
    } catch (error) {
      setModuleAudioError(
        error instanceof Error ? error.message : "Could not upload this MP3.",
      );
    } finally {
      setModuleAudioUploading(false);
    }
  }

  function handleRemoveModuleVideo() {
    if (!module) {
      return;
    }

    updateModuleConfig(
      configWithContent(
        {},
        false,
        ["video", "url", "integration"],
      ),
    );
  }

  function handleRemoveModuleAudio() {
    if (!module) {
      return;
    }

    updateModuleConfig(
      configWithContent(
        {},
        false,
        ["audio", "integration"],
      ),
    );
  }

  async function handleModuleImageSelection(files: FileList | null) {
    if (!module || !files || !canUploadModuleImage) {
      return;
    }

    const selectedFiles: File[] = [];
    const selectionLimit = singlePhotoImageModule ? 1 : moduleMediaSlots;

    for (const file of Array.from(files).slice(0, selectionLimit)) {
      try {
        selectedFiles.push(await onModuleImagePrepare(file));
      } catch (error) {
        setModuleImageError(error instanceof Error ? error.message : "Image could not be prepared.");
        continue;
      }
    }

    if (selectedFiles.length === 0) {
      return;
    }

    setModuleImageError(undefined);
    setModuleImageCropQueue(selectedFiles);
  }

  async function handleCroppedModuleImage(croppedFile: File) {
    if (!module) {
      return;
    }

    setModuleImageUploading(true);
    setModuleImageError(undefined);

    try {
      const url = await onModuleImageUpload(croppedFile);
      const mediaItems = singlePhotoImageModule
        ? [{ url }]
        : [
            ...(module.config.mediaItems ?? []),
            { url },
          ].slice(0, moduleMediaMaxItems);

      updateModuleConfig(
        configWithContent(
          {
            mediaItems,
          },
          mediaItems.length > 0,
        ),
      );
    } catch (error) {
      setModuleImageError(
        error instanceof Error ? error.message : "Could not upload this image.",
      );
    } finally {
      setModuleImageUploading(false);
      setModuleImageCropQueue((queue) => queue.slice(1));
    }
  }

  return (
    <ModalSheet
      open={Boolean(module)}
      onClose={handleClose}
      title={module ? profileModuleFallbackTitle(module.type) : "Module settings"}
      description={definition?.description}
      size="md"
      testId="profile-module-settings"
      footer={
        module ? (
          <div className="flex items-center justify-end gap-2">
            {module.type !== "profile_info" ? (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="border-rose/35 bg-rose/12 text-rose-ink hover:border-rose/60"
                icon={<Trash2 aria-hidden="true" size={16} />}
                onClick={() => onRemove(module)}
              >
                Remove
              </Button>
            ) : null}
            <Button
              type="button"
              size="sm"
              icon={<Check aria-hidden="true" size={16} />}
              data-testid="profile-module-settings-done"
              onClick={onClose}
            >
              Done
            </Button>
          </div>
        ) : undefined
      }
    >
      {module && definition ? (
        <div className="space-y-4">
          {allowedSizes.length > 1 && currentSize ? (
            <div
              className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-line bg-canvas/38 p-3"
              data-testid="profile-module-size-stepper"
            >
              <p className="text-xs font-semibold uppercase text-muted">Size</p>
              <div className="inline-flex min-h-10 items-center overflow-hidden rounded-control border border-line bg-surface/70 shadow-inner-soft">
                <button
                  type="button"
                  className="grid size-10 place-items-center text-muted transition hover:bg-surface hover:text-text focus-visible:outline-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label="Shrink module"
                  disabled={!previousSize}
                  data-testid="profile-module-size-decrease"
                  onClick={() => {
                    if (previousSize) {
                      onResize(module, previousSize);
                    }
                  }}
                >
                  <Minus aria-hidden="true" size={16} />
                </button>
                <span
                  className="min-w-24 border-x border-line px-3 text-center text-sm font-semibold text-text"
                  data-testid="profile-module-size-current"
                >
                  {profileModuleSizeLabel(module.type, currentSize)}
                  <span className="ml-1 text-xs font-medium text-muted">
                    {currentSize}
                  </span>
                </span>
                <button
                  type="button"
                  className="grid size-10 place-items-center text-muted transition hover:bg-surface hover:text-text focus-visible:outline-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label="Grow module"
                  disabled={!nextSize}
                  data-testid="profile-module-size-increase"
                  onClick={() => {
                    if (nextSize) {
                      onResize(module, nextSize);
                    }
                  }}
                >
                  <Plus aria-hidden="true" size={16} />
                </button>
              </div>
            </div>
          ) : null}
          {module.type === "profile_info" ? (
            <div className="space-y-3">
              <div
                className="overflow-hidden rounded-card border border-line bg-canvas/38"
                data-testid="profile-info-media-settings"
              >
                <input
                  ref={profileInfoAvatarInputRef}
                  className="sr-only"
                  type="file"
                  accept={imageUploadAccept}
                  data-testid="profile-info-modal-avatar-input"
                  disabled={Boolean(uploading)}
                  onChange={(event) => handleProfileInfoImageInput(event, "avatar")}
                />
                <input
                  ref={profileInfoBannerInputRef}
                  className="sr-only"
                  type="file"
                  accept={imageUploadAccept}
                  data-testid="profile-info-modal-banner-input"
                  disabled={Boolean(uploading)}
                  onChange={(event) => handleProfileInfoImageInput(event, "banner")}
                />
                <div
                  className="group/profile-banner relative min-h-32 overflow-hidden bg-surface/55"
                  data-profile-banner-treatment="cover"
                  data-testid="profile-info-preview-banner"
                >
                  {safeProfileImageUrl(profile.bannerUrl) ? (
                    <img
                      alt=""
                      className="absolute inset-0 size-full object-cover object-center"
                      src={safeProfileImageUrl(profile.bannerUrl)}
                      data-testid="profile-info-preview-banner-image"
                    />
                  ) : (
                    <div className="absolute inset-0 bg-gradient-to-br from-accent/20 via-cool/12 to-leaf/14" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-b from-canvas/18 via-canvas/5 to-canvas/46" />
                  <button
                    type="button"
                    className="absolute inset-0 z-10 grid place-items-center text-text transition focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-70"
                    aria-label="Change profile banner"
                    title="Change profile banner"
                    data-testid="profile-info-banner-edit-overlay"
                    disabled={Boolean(uploading)}
                    onClick={() => profileInfoBannerInputRef.current?.click()}
                  >
                    <span className="inline-flex translate-y-1 items-center gap-2 rounded-full border border-white/20 bg-black/48 px-3 py-2 text-sm font-semibold text-white opacity-0 shadow-soft backdrop-blur transition group-hover/profile-banner:translate-y-0 group-hover/profile-banner:opacity-100 group-focus-within/profile-banner:translate-y-0 group-focus-within/profile-banner:opacity-100">
                      <Pencil aria-hidden="true" size={16} />
                      {uploading === "banner" ? "Uploading" : "Change Banner"}
                    </span>
                  </button>
                  <div className="absolute bottom-2 left-2 z-20 flex items-end gap-2">
                    <button
                      type="button"
                      className="group/profile-avatar relative rounded-full transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-70"
                      aria-label="Change profile avatar"
                      title="Change profile avatar"
                      data-testid="profile-info-avatar-edit-overlay"
                      disabled={Boolean(uploading)}
                      onClick={() => profileInfoAvatarInputRef.current?.click()}
                    >
                      <Avatar
                        user={profile.user}
                        size="lg"
                        className="size-16 border-[3px] border-surface shadow-soft"
                      />
                      <span className="absolute inset-0 grid place-items-center rounded-full bg-black/52 text-white opacity-0 backdrop-blur-[2px] transition group-hover/profile-avatar:opacity-100 group-focus-visible/profile-avatar:opacity-100">
                        <Pencil aria-hidden="true" size={20} />
                      </span>
                      {uploading === "avatar" ? (
                        <span className="absolute inset-x-0 bottom-1 text-center text-[0.6rem] font-bold uppercase tracking-wide text-white">
                          Uploading
                        </span>
                      ) : null}
                    </button>
                    <div className="mb-1 min-w-0">
                      <p className="truncate text-sm font-semibold text-text">
                        {profile.user.displayName}
                      </p>
                      <p className="truncate text-xs font-medium text-muted">
                        @{profile.user.handle}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="grid gap-2 p-2 sm:grid-cols-2">
                  <button
                    type="button"
                    className="inline-flex min-h-8 items-center justify-center gap-1.5 rounded-control border border-line bg-surface/62 px-2.5 text-xs font-semibold text-text transition hover:border-line-strong focus-visible:outline-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-60"
                    title="Change profile avatar"
                    disabled={Boolean(uploading)}
                    onClick={() => profileInfoAvatarInputRef.current?.click()}
                  >
                    <ImagePlus aria-hidden="true" size={14} />
                    {uploading === "avatar" ? "Uploading" : "Avatar"}
                  </button>
                  <button
                    type="button"
                    className="inline-flex min-h-8 items-center justify-center gap-1.5 rounded-control border border-line bg-surface/62 px-2.5 text-xs font-semibold text-text transition hover:border-line-strong focus-visible:outline-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-60"
                    title="Change profile banner"
                    disabled={Boolean(uploading)}
                    onClick={() => profileInfoBannerInputRef.current?.click()}
                  >
                    <ImagePlus aria-hidden="true" size={14} />
                    {uploading === "banner" ? "Uploading" : "Banner"}
                  </button>
                </div>
              </div>
              <label className="block">
                <span className="text-xs font-semibold uppercase text-muted">
                  Display name
                </span>
                <input
                  className="mt-1 min-h-11 w-full rounded-control border border-line bg-canvas/45 px-3 text-sm font-semibold text-text outline-none transition focus:border-line-strong focus:outline-2 focus:outline-focus"
                  value={profile.user.displayName}
                  data-testid="profile-info-modal-display-name"
                  onChange={(event) => {
                    const displayName = event.currentTarget.value;
                    onProfileDraftChange((currentProfile) => ({
                      ...currentProfile,
                      user: {
                        ...currentProfile.user,
                        displayName,
                      },
                    }));
                  }}
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold uppercase text-muted">
                  Bio
                </span>
                <MentionTextarea
                  className="mt-1 min-h-24 w-full resize-none rounded-control border border-line bg-canvas/45 px-3 py-2 text-sm leading-6 text-text outline-none transition focus:border-line-strong focus:outline-2 focus:outline-focus"
                  value={profile.bio}
                  data-testid="profile-info-modal-bio"
                  onValueChange={(bio) => {
                    onProfileDraftChange((currentProfile) => ({
                      ...currentProfile,
                      bio,
                    }));
                  }}
                />
              </label>
            </div>
          ) : null}
          {module.type === "about" ||
          module.type === "text" ||
          module.type === "custom_text" ? (
            <MarkdownEditor
              value={module.config.body ?? ""}
              entities={module.textEntities?.body}
              textareaTestId="profile-module-settings-body"
              onValueChange={(body) => {
                updateModuleConfig(
                  configWithContent({ body }, body.trim().length > 0),
                );
              }}
            />
          ) : null}
          {module.type === "connections" || module.type === "links" ? (
            <div
              className="space-y-3"
              data-testid="profile-connections-settings"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-semibold uppercase text-muted">
                  Connections
                </p>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={!canAddConnection}
                  icon={<Plus aria-hidden="true" size={15} />}
                  data-testid="profile-connection-add-open-button"
                  onClick={() => {
                    setConnectionFormOpen((open) => !open);
                    setConnectionError(undefined);
                  }}
                >
                  Add
                </Button>
              </div>
              {connectionLinks.length > 0 ? (
                <div
                  className="grid gap-2"
                  data-testid="profile-connection-settings-list"
                >
                  {connectionLinks.map((link, index) => {
                    const platform =
                      profileModuleConnectionPlatform(link.platform);
                    const platformLabel = connectionPlatformLabel(platform);

                    return (
                      <div
                        key={`${link.url}:${index}`}
                        className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-card border border-line bg-canvas/38 p-2"
                        data-testid={`profile-connection-settings-row-${index}`}
                      >
                        <span className="grid size-9 shrink-0 place-items-center rounded-full border border-line bg-surface/72 text-text">
                          <ProfileConnectionIcon platform={platform} size={17} />
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-text">
                            {link.label || platformLabel}
                          </p>
                          <p className="truncate text-xs font-medium text-muted">
                            {platformLabel} · {profileModuleConnectionPreview(link.url)}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            className="grid size-8 place-items-center rounded-control border border-line bg-surface/72 text-muted transition hover:border-line-strong hover:text-text focus-visible:outline-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-45"
                            aria-label={`Move ${link.label || platformLabel} up`}
                            disabled={index === 0}
                            data-testid={`profile-connection-move-up-${index}`}
                            onClick={() => handleMoveConnection(index, -1)}
                          >
                            <ArrowUp aria-hidden="true" size={15} />
                          </button>
                          <button
                            type="button"
                            className="grid size-8 place-items-center rounded-control border border-line bg-surface/72 text-muted transition hover:border-line-strong hover:text-text focus-visible:outline-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-45"
                            aria-label={`Move ${link.label || platformLabel} down`}
                            disabled={index === connectionLinks.length - 1}
                            data-testid={`profile-connection-move-down-${index}`}
                            onClick={() => handleMoveConnection(index, 1)}
                          >
                            <ArrowDown aria-hidden="true" size={15} />
                          </button>
                          <button
                            type="button"
                            className="grid size-8 place-items-center rounded-control border border-rose/35 bg-rose/12 text-rose-ink transition hover:border-rose/60 focus-visible:outline-2 focus-visible:outline-focus"
                            aria-label={`Remove ${link.label || platformLabel}`}
                            data-testid={`profile-connection-remove-${index}`}
                            onClick={() => handleRemoveConnection(index)}
                          >
                            <Trash2 aria-hidden="true" size={15} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="rounded-card border border-dashed border-line bg-canvas/38 px-3 py-2 text-sm font-medium text-muted">
                  No connections yet.
                </p>
              )}
              {connectionFormOpen && canAddConnection ? (
                <div
                  className="space-y-3 rounded-card border border-line bg-canvas/35 p-3"
                  data-testid="profile-connection-add-form"
                >
                  <div
                    className="grid grid-cols-5 gap-2"
                    aria-label="Connection platform"
                  >
                    {profileConnectionPlatforms.map((platformOption) => (
                      <button
                        key={platformOption.value}
                        type="button"
                        className="grid min-h-11 place-items-center rounded-control border border-line bg-surface/58 text-muted transition hover:border-line-strong hover:text-text focus-visible:outline-2 focus-visible:outline-focus aria-pressed:border-focus aria-pressed:bg-focus/18 aria-pressed:text-text"
                        aria-label={platformOption.label}
                        aria-pressed={connectionPlatform === platformOption.value}
                        title={platformOption.label}
                        data-testid={`profile-connection-platform-${platformOption.value}`}
                        onClick={() => {
                          setConnectionPlatform(platformOption.value);
                          setConnectionError(undefined);
                        }}
                      >
                        <ProfileConnectionIcon
                          platform={platformOption.value}
                          size={18}
                        />
                      </button>
                    ))}
                  </div>
                  <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                    <label className="block min-w-0">
                      <span className="sr-only">
                        {connectionPlatformLabel(connectionPlatform)} handle or link
                      </span>
                      <input
                        className="min-h-11 w-full rounded-control border border-line bg-canvas/55 px-3 text-sm text-text outline-none transition placeholder:text-muted focus:border-line-strong focus:outline-2 focus:outline-focus"
                        value={connectionValue}
                        placeholder={
                          profileConnectionPlatforms.find(
                            (item) => item.value === connectionPlatform,
                          )?.placeholder ?? "Handle or link"
                        }
                        data-testid="profile-connection-value-input"
                        onChange={(event) => {
                          setConnectionValue(event.currentTarget.value);
                          setConnectionError(undefined);
                        }}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            handleAddConnection();
                          }
                        }}
                      />
                    </label>
                    <Button
                      type="button"
                      size="sm"
                      icon={<Plus aria-hidden="true" size={15} />}
                      data-testid="profile-connection-add-button"
                      onClick={handleAddConnection}
                    >
                      Add
                    </Button>
                  </div>
                  {connectionError ? (
                    <p
                      className="text-xs font-semibold text-rose-ink"
                      role="alert"
                    >
                      {connectionError}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}
          {module.type === "uploaded_video" ? (
            <div
              className="space-y-3"
              data-testid="profile-video-module-settings"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-semibold uppercase text-muted">Video file</p>
                <label
                  className={cn(
                    "inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-control border border-line bg-canvas/45 px-3 text-sm font-semibold text-text transition hover:border-line-strong focus-within:outline-2 focus-within:outline-focus",
                    moduleVideoUploading ? "pointer-events-none opacity-50" : undefined,
                  )}
                  data-profile-edit-control="true"
                  title={module.config.video ? "Replace video" : "Upload video"}
                >
                  <Upload aria-hidden="true" size={16} />
                  {moduleVideoUploading ? "Uploading" : module.config.video ? "Replace" : "Upload"}
                  <input
                    className="sr-only"
                    type="file"
                    accept={videoUploadAccept}
                    data-testid="profile-module-settings-video-input"
                    disabled={moduleVideoUploading}
                    onChange={(event) => {
                      void handleModuleVideoSelection(event.currentTarget.files?.[0]);
                      event.currentTarget.value = "";
                    }}
                  />
                </label>
              </div>
              {module.config.video ? (
                <div
                  className="overflow-hidden rounded-card border border-line bg-black"
                  data-testid="profile-module-video-preview"
                >
                  <video
                    className="aspect-video w-full bg-black object-contain"
                    controls
                    playsInline
                    poster={module.config.video.posterUrl}
                    preload="metadata"
                  >
                    <source src={module.config.video.url} type={module.config.video.mime} />
                  </video>
                  <div className="flex items-center justify-between gap-3 border-t border-line bg-canvas/70 px-3 py-2">
                    <p className="min-w-0 truncate text-sm font-semibold text-text">
                      {module.config.video.title ?? module.config.label ?? "Uploaded video"}
                    </p>
                    <button
                      type="button"
                      className="grid size-8 shrink-0 place-items-center rounded-control border border-rose/35 bg-rose/12 text-rose-ink transition hover:border-rose/60 focus-visible:outline-2 focus-visible:outline-focus"
                      aria-label="Remove video"
                      data-testid="profile-module-video-remove"
                      onClick={handleRemoveModuleVideo}
                    >
                      <Trash2 aria-hidden="true" size={15} />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid min-h-28 place-items-center rounded-card border border-dashed border-line bg-canvas/35 px-3 text-center text-sm font-medium text-muted">
                  {videoUploadFormatHelp}
                </div>
              )}
              {moduleVideoError ? (
                <p className="text-xs font-semibold text-rose-ink" role="alert">
                  {moduleVideoError}
                </p>
              ) : null}
            </div>
          ) : definition.category === "music" ? (
            <div className="space-y-3">
              {module.type === "music" ? (
                <div
                  className="space-y-3 rounded-card border border-line bg-canvas/35 p-3"
                  data-testid="profile-audio-module-settings"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-semibold uppercase text-muted">MP3 upload</p>
                    <label
                      className={cn(
                        "inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-control border border-line bg-surface/62 px-3 text-sm font-semibold text-text transition hover:border-line-strong focus-within:outline-2 focus-within:outline-focus",
                        moduleAudioUploading ? "pointer-events-none opacity-50" : undefined,
                      )}
                      data-profile-edit-control="true"
                      title={module.config.audio ? "Replace MP3" : "Upload MP3"}
                    >
                      <Upload aria-hidden="true" size={16} />
                      {moduleAudioUploading ? "Uploading" : module.config.audio ? "Replace" : "Upload"}
                      <input
                        className="sr-only"
                        type="file"
                        accept="audio/mpeg,.mp3"
                        data-testid="profile-module-settings-audio-input"
                        disabled={moduleAudioUploading}
                        onChange={(event) => {
                          void handleModuleAudioSelection(event.currentTarget.files?.[0]);
                          event.currentTarget.value = "";
                        }}
                      />
                    </label>
                  </div>
                  {module.config.audio ? (
                    <div
                      className="flex min-w-0 items-center gap-3 rounded-card border border-line bg-surface/62 p-3"
                      data-testid="profile-module-audio-preview"
                    >
                      <span className="grid size-10 shrink-0 place-items-center rounded-card border border-line bg-canvas/70 text-text">
                        <Music2 aria-hidden="true" size={18} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-text">
                          {module.config.audio.title ?? module.config.label ?? "Uploaded track"}
                        </p>
                        <p className="truncate text-xs font-medium text-muted">
                          MP3 · {formatUploadSize(module.config.audio.size)}
                        </p>
                      </div>
                      <button
                        type="button"
                        className="grid size-8 shrink-0 place-items-center rounded-control border border-rose/35 bg-rose/12 text-rose-ink transition hover:border-rose/60 focus-visible:outline-2 focus-visible:outline-focus"
                        aria-label="Remove MP3"
                        data-testid="profile-module-audio-remove"
                        onClick={handleRemoveModuleAudio}
                      >
                        <Trash2 aria-hidden="true" size={15} />
                      </button>
                    </div>
                  ) : (
                    <p className="rounded-card border border-dashed border-line bg-canvas/38 px-3 py-2 text-sm font-medium text-muted">
                      Upload a custom MP3.
                    </p>
                  )}
                  {moduleAudioError ? (
                    <p className="text-xs font-semibold text-rose-ink" role="alert">
                      {moduleAudioError}
                    </p>
                  ) : null}
                </div>
              ) : null}
              {showMusicUrlField ? (
                <label className="block">
                  <span className="text-xs font-semibold uppercase text-muted">
                    Music link
                  </span>
                  <input
                    className="mt-1 min-h-11 w-full rounded-control border border-line bg-canvas/45 px-3 text-sm text-text outline-none transition focus:border-line-strong focus:outline-2 focus:outline-focus"
                    value={module.config.url ?? ""}
                    placeholder="https://"
                    data-testid="profile-module-settings-url"
                    onChange={(event) => handleUrlConfig(event.currentTarget.value)}
                  />
                </label>
              ) : null}
            </div>
          ) : definition.category === "video" || module.type === "github_repo" ? (
            <label className="block">
              <span className="text-xs font-semibold uppercase text-muted">
                {module.type === "github_repo" ? "Repo link" : "Media link"}
              </span>
              <input
                className="mt-1 min-h-11 w-full rounded-control border border-line bg-canvas/45 px-3 text-sm text-text outline-none transition focus:border-line-strong focus:outline-2 focus:outline-focus"
                value={module.config.url ?? ""}
                placeholder="https://"
                data-testid="profile-module-settings-url"
                onChange={(event) => handleUrlConfig(event.currentTarget.value)}
              />
            </label>
          ) : null}
          {definition.category === "images" ? (
            <div
              className="space-y-3"
              data-testid="profile-image-module-settings"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-semibold uppercase text-muted">
                  {singlePhotoImageModule ? "Photo" : "Photos"}
                </p>
                <label
                  className={cn(
                    "inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-control border border-line bg-canvas/45 px-3 text-sm font-semibold text-text transition hover:border-line-strong focus-within:outline-2 focus-within:outline-focus",
                    !canUploadModuleImage || moduleImageUploading
                      ? "pointer-events-none opacity-50"
                      : undefined,
                  )}
                  data-profile-edit-control="true"
                  title={singlePhotoImageModule && moduleMediaItems.length > 0 ? "Replace photo" : "Add photos"}
                >
                  <ImagePlus aria-hidden="true" size={16} />
                  {moduleImageUploading
                    ? "Uploading"
                    : singlePhotoImageModule && moduleMediaItems.length > 0
                      ? "Replace"
                      : "Add"}
                  <input
                    className="sr-only"
                    type="file"
                    accept={imageUploadAccept}
                    multiple={!singlePhotoImageModule}
                    data-testid="profile-module-settings-image-input"
                    disabled={moduleImageUploading || !canUploadModuleImage}
                    onChange={(event) => {
                      void handleModuleImageSelection(event.currentTarget.files);
                      event.currentTarget.value = "";
                    }}
                  />
                </label>
              </div>
              {visibleModuleMediaItems.length > 0 ? (
                <div
                  className="grid grid-cols-3 gap-2"
                  data-testid="profile-module-media-list"
                >
                  {visibleModuleMediaItems.map((item, index) => (
                    <figure
                      key={`${item.url}:${index}`}
                      className="group relative aspect-square min-w-0 overflow-hidden rounded-card border border-line bg-canvas/45"
                      data-testid={`profile-module-media-item-${index}`}
                    >
                      <img
                        alt=""
                        className="size-full object-cover"
                        src={item.url}
                      />
                      <button
                        type="button"
                        className="absolute right-1.5 top-1.5 grid size-7 place-items-center rounded-full border border-rose/35 bg-canvas/84 text-rose-ink opacity-95 shadow-soft transition hover:border-rose/60 focus-visible:outline-2 focus-visible:outline-focus"
                        aria-label={`Remove photo ${index + 1}`}
                        data-testid={`profile-module-media-remove-${index}`}
                        onClick={() => handleRemoveModuleImage(index)}
                      >
                        <Trash2 aria-hidden="true" size={14} />
                      </button>
                    </figure>
                  ))}
                </div>
              ) : (
                <div className="grid min-h-28 place-items-center rounded-card border border-dashed border-line bg-canvas/35 px-3 text-center text-sm font-medium text-muted">
                  Add cropped photos.
                </div>
              )}
              <p className="text-xs font-medium text-muted">
                {moduleMediaItems.length}/6
                {moduleImageCropQueue.length > 0
                  ? ` · ${moduleImageCropQueue.length} crop queued`
                  : ""}
              </p>
              {moduleImageError ? (
                <p className="text-xs font-semibold text-rose-ink" role="alert">
                  {moduleImageError}
                </p>
              ) : null}
            </div>
          ) : null}
          {showConnectPrompt && provider ? (
            <div className="rounded-card border border-line bg-canvas/45 p-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-text">Connect</p>
                  <p className="mt-1 text-xs font-medium text-muted">
                    Connect {providerLabel} for authenticated provider data.
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  data-testid={`profile-integration-connect-${provider}`}
                  onClick={() => onConnectProvider(provider)}
                >
                  Connect
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
      <ImageCropModal
        open={Boolean(activeModuleImageCropFile)}
        file={activeModuleImageCropFile}
        purpose="post_media"
        busy={moduleImageUploading}
        onClose={() => setModuleImageCropQueue([])}
        onApply={handleCroppedModuleImage}
      />
    </ModalSheet>
  );
}

function profileModuleConnectionPlatform(
  value: string | undefined,
): ProfileConnectionPlatform {
  return profileConnectionPlatforms.some((item) => item.value === value)
    ? (value as ProfileConnectionPlatform)
    : "website";
}

function profileModuleConnectionPreview(url: string): string {
  try {
    const parsedUrl = new URL(url);
    return `${parsedUrl.hostname.replace(/^www\./, "")}${parsedUrl.pathname === "/" ? "" : parsedUrl.pathname}`;
  } catch {
    return url;
  }
}

function profileModuleStoresSinglePhoto(type: ProfileModule["type"]): boolean {
  return type === "uploaded_image" || type === "gallery_media";
}

function profileModuleUniqueConnectionLinks(
  links: ProfileModuleLink[],
): ProfileModuleLink[] {
  const seen = new Set<string>();
  const uniqueLinks: ProfileModuleLink[] = [];

  for (const link of links) {
    const key = link.url.trim().toLowerCase();

    if (!key || seen.has(key)) {
      continue;
    }

    seen.add(key);
    uniqueLinks.push(link);
  }

  return uniqueLinks;
}

function profileModuleConnectionLinkFromDraft(
  platform: ProfileConnectionPlatform,
  value: string,
): { link: ProfileModuleLink } | { error: string } {
  const result = validateProfileConnectionDraft(platform, value);

  if ("error" in result) {
    return { error: result.error };
  }

  const link = profileModuleLinkFromConnection(result.connection);

  if (!link) {
    return { error: "Connection must resolve to a safe link." };
  }

  return { link };
}
