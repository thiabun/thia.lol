import { useEffect, useState } from "react";
import type {
  ProfileIntegrationAccount,
  ProfileIntegrationProvider,
} from "./api";
import {
  audioUploadFormatHelp,
  isAcceptedAudioUploadFile,
  isAcceptedVideoUploadFile,
  videoUploadFormatHelp,
} from "./mediaFormats";
import { connectionPlatformLabel } from "./profileConnections";
import {
  PROFILE_CANVAS_ACTIVITY_MAX_MODULE_ROWS,
  PROFILE_CANVAS_DESKTOP_COLUMNS,
  PROFILE_CANVAS_DESKTOP_ROWS,
  PROFILE_CANVAS_MAX_MODULE_ROWS,
  PROFILE_CANVAS_MOBILE_COLUMNS,
  PROFILE_CANVAS_MOBILE_ROWS,
  PROFILE_CANVAS_PROFILE_INFO_COLUMNS,
  getProfileModuleDefinition,
  profileGridModuleSizeSpan,
  profileGridModuleSpanSize,
  profileModuleAllowedSizes,
  profileModuleCatalog,
  profileModuleTwitchDisplayModeForSize,
  type ProfileGridModuleSize,
  type ProfileModuleCategory,
} from "./profileModuleRegistry";
import type {
  ProfileBackgroundBlur,
  ProfileExternalConnection,
  ProfileIntegrationCard,
  ProfileModule,
  ProfileModuleLayout,
  ProfileModuleLink,
} from "./types";

const PROFILE_CANVAS_COLUMNS = PROFILE_CANVAS_DESKTOP_COLUMNS;
const PROFILE_CANVAS_ROWS = PROFILE_CANVAS_DESKTOP_ROWS;
const PROFILE_MODULE_AUDIO_MAX_BYTES = 20971520;
const PROFILE_MODULE_VIDEO_MAX_BYTES = 100 * 1024 * 1024;

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

export function validateProfileModuleAudioFile(file: File): string | undefined {
  if (file.size <= 0) {
    return "Audio cannot be empty.";
  }

  if (file.size > PROFILE_MODULE_AUDIO_MAX_BYTES) {
    return "Audio must be 20 MB or smaller.";
  }

  if (!isAcceptedAudioUploadFile(file)) {
    return audioUploadFormatHelp;
  }

  return undefined;
}

export function validateProfileModuleVideoFile(file: File): string | undefined {
  if (file.size <= 0) {
    return "Video cannot be empty.";
  }

  if (file.size > PROFILE_MODULE_VIDEO_MAX_BYTES) {
    return "Video must be 100 MB or smaller.";
  }

  if (!isAcceptedVideoUploadFile(file)) {
    return videoUploadFormatHelp;
  }

  return undefined;
}

export function readMediaFileDuration(file: File): Promise<number | undefined> {
  if (typeof document === "undefined" || typeof URL === "undefined") {
    return Promise.resolve(undefined);
  }

  return new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(file);
    const element = file.type.startsWith("video/")
      ? document.createElement("video")
      : document.createElement("audio");
    const cleanup = () => {
      window.clearTimeout(timeout);
      URL.revokeObjectURL(objectUrl);
    };
    const timeout = window.setTimeout(() => {
      cleanup();
      resolve(undefined);
    }, 4000);

    element.preload = "metadata";
    element.onloadedmetadata = () => {
      const duration = Number.isFinite(element.duration) && element.duration > 0
        ? Math.round(element.duration * 1000) / 1000
        : undefined;

      cleanup();
      resolve(duration);
    };
    element.onerror = () => {
      cleanup();
      resolve(undefined);
    };
    element.src = objectUrl;
  });
}

export function sanitizeUploadedMediaTitle(fileName: string, fallback: string): string {
  const title = fileName
    .replace(/\.[^.]+$/, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return title ? title.slice(0, 60) : fallback;
}

export function formatUploadSize(size: number): string {
  if (!Number.isFinite(size) || size <= 0) {
    return "0 KB";
  }

  if (size >= 1048576) {
    return `${(size / 1048576).toFixed(size >= 10485760 ? 0 : 1)} MB`;
  }

  return `${Math.ceil(size / 1024)} KB`;
}

export function profileModuleLinkFromConnection(
  connection: ProfileExternalConnection,
): ProfileModuleLink | undefined {
  if (!connection.url) {
    return undefined;
  }

  return {
    label:
      connection.platform === "website"
        ? connection.label
        : connection.label || connectionPlatformLabel(connection.platform),
    platform: connection.platform,
    url: connection.url,
  };
}

export function blurLabel(blur: ProfileBackgroundBlur): string {
  return blur === "none" ? "None" : blur[0]!.toUpperCase() + blur.slice(1);
}

export function blurShortLabel(blur: ProfileBackgroundBlur): string {
  if (blur === "medium") {
    return "Med";
  }

  return blurLabel(blur);
}

export function profileCanvasCells(
  columns = PROFILE_CANVAS_COLUMNS,
  rows = PROFILE_CANVAS_ROWS,
): CanvasPoint[] {
  const cells: CanvasPoint[] = [];

  for (let row = 1; row <= rows; row += 1) {
    for (let column = 1; column <= columns; column += 1) {
      cells.push({ column, row });
    }
  }

  return cells;
}

export function profileCanvasRectFromPoints(
  first: CanvasPoint,
  second: CanvasPoint,
): ProfileModuleLayout {
  const column = Math.min(first.column, second.column);
  const row = Math.min(first.row, second.row);
  const colSpan = Math.abs(first.column - second.column) + 1;
  const rowSpan = Math.abs(first.row - second.row) + 1;

  return {
    column,
    row,
    colSpan,
    rowSpan,
  };
}

export function profileCanvasPointInRect(
  point: CanvasPoint,
  rect: ProfileModuleLayout,
): boolean {
  return (
    point.column >= rect.column &&
    point.column < rect.column + rect.colSpan &&
    point.row >= rect.row &&
    point.row < rect.row + rect.rowSpan
  );
}

export function profileCanvasRectsOverlap(
  first: ProfileModuleLayout,
  second: ProfileModuleLayout,
): boolean {
  return (
    first.column < second.column + second.colSpan &&
    first.column + first.colSpan > second.column &&
    first.row < second.row + second.rowSpan &&
    first.row + first.rowSpan > second.row
  );
}

function profileCanvasModulePriority(module: ProfileModule): number {
  if (module.type === "profile_info") {
    return 0;
  }

  if (module.type === "activity") {
    return 2;
  }

  return 1;
}

export function profileCanvasSortDraftModules(modules: ProfileModule[]): ProfileModule[] {
  return [...modules].sort((first, second) => {
    const priority = profileCanvasModulePriority(first) - profileCanvasModulePriority(second);

    if (priority !== 0) {
      return priority;
    }

    const firstLayout = first.layout ?? profileCanvasDefaultClientLayout(first, 0);
    const secondLayout = second.layout ?? profileCanvasDefaultClientLayout(second, 0);

    return (
      firstLayout.row - secondLayout.row ||
      firstLayout.column - secondLayout.column ||
      first.position - second.position ||
      first.id - second.id
    );
  });
}

export function useProfileCanvasEditorGridProjection(): {
  columns: 6 | 12;
  rows: 16 | 32;
  mobile: boolean;
} {
  const [mobile, setMobile] = useState(() =>
    typeof window === "undefined"
      ? false
      : window.matchMedia("(max-width: 1023px)").matches,
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const mediaQuery = window.matchMedia("(max-width: 1023px)");
    const syncProjection = () => setMobile(mediaQuery.matches);

    syncProjection();
    mediaQuery.addEventListener("change", syncProjection);

    return () => mediaQuery.removeEventListener("change", syncProjection);
  }, []);

  return mobile
    ? {
        columns: PROFILE_CANVAS_MOBILE_COLUMNS,
        rows: PROFILE_CANVAS_MOBILE_ROWS,
        mobile,
      }
    : {
        columns: PROFILE_CANVAS_COLUMNS,
        rows: PROFILE_CANVAS_ROWS,
        mobile,
      };
}

export function profileCanvasDesktopPointFromEditorPoint(
  point: CanvasPoint,
  mobile: boolean,
): CanvasPoint {
  if (!mobile) {
    return point;
  }

  const mobileRow = Math.min(
    PROFILE_CANVAS_MOBILE_ROWS,
    Math.max(1, point.row),
  );
  const desktopRow = Math.min(
    PROFILE_CANVAS_ROWS,
    Math.floor((mobileRow - 1) / 2) + 1,
  );
  const desktopColumn = Math.min(
    PROFILE_CANVAS_COLUMNS,
    Math.max(
      1,
      point.column + (mobileRow % 2 === 0 ? PROFILE_CANVAS_MOBILE_COLUMNS : 0),
    ),
  );

  return {
    column: desktopColumn,
    row: desktopRow,
  };
}

function profileCanvasEditorCellKeyFromDesktopPoint(
  point: CanvasPoint,
  mobile: boolean,
): string {
  if (!mobile) {
    return `${point.column}:${point.row}`;
  }

  const leftHalf = point.column <= PROFILE_CANVAS_MOBILE_COLUMNS;
  const column = leftHalf
    ? point.column
    : point.column - PROFILE_CANVAS_MOBILE_COLUMNS;
  const row = (point.row - 1) * 2 + (leftHalf ? 1 : 2);

  return `${column}:${row}`;
}

export function profileCanvasOccupiedEditorCellKeysForLayout(
  layout: ProfileModuleLayout,
  mobile: boolean,
): Set<string> {
  const occupied = new Set<string>();

  for (let row = layout.row; row < layout.row + layout.rowSpan; row += 1) {
    for (
      let column = layout.column;
      column < layout.column + layout.colSpan;
      column += 1
    ) {
      occupied.add(
        profileCanvasEditorCellKeyFromDesktopPoint({ column, row }, mobile),
      );
    }
  }

  return occupied;
}

export function profileCanvasDesktopRectFromEditorPoints(
  first: CanvasPoint,
  second: CanvasPoint,
  mobile: boolean,
): ProfileModuleLayout {
  return profileCanvasRectFromPoints(
    profileCanvasDesktopPointFromEditorPoint(first, mobile),
    profileCanvasDesktopPointFromEditorPoint(second, mobile),
  );
}

export function profileCanvasDefaultClientLayout(
  module: ProfileModule,
  index: number,
): ProfileModuleLayout {
  const span = profileGridModuleSizeSpan(
    module.config.canvasSize ?? getProfileModuleDefinition(module.type).defaultSize,
  );

  return {
    column: module.type === "profile_info" ? 3 : 1,
    row:
      module.type === "profile_info"
        ? 1
        : module.type === "activity"
          ? 4
          : index + 1,
    colSpan: span.columns,
    rowSpan: span.rows,
  };
}

export function profileCanvasLayoutFromPointer(
  grid: HTMLDivElement,
  clientX: number,
  clientY: number,
  colSpan: number,
  rowSpan: number,
  pointerOffsetX: number,
  pointerOffsetY: number,
  mobile = false,
): ProfileModuleLayout {
  const rect = grid.getBoundingClientRect();
  const styles = window.getComputedStyle(grid);
  const paddingLeft = Number.parseFloat(styles.paddingLeft) || 0;
  const paddingTop = Number.parseFloat(styles.paddingTop) || 0;
  const paddingRight = Number.parseFloat(styles.paddingRight) || 0;
  const columnGap = Number.parseFloat(styles.columnGap) || 0;
  const rowGap = Number.parseFloat(styles.rowGap) || columnGap;
  const contentWidth = Math.max(1, grid.clientWidth - paddingLeft - paddingRight);
  const activeColumns = mobile
    ? PROFILE_CANVAS_MOBILE_COLUMNS
    : PROFILE_CANVAS_COLUMNS;
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
  const point = mobile
    ? profileCanvasDesktopPointFromEditorPoint(
        {
          column: Math.min(
            PROFILE_CANVAS_MOBILE_COLUMNS,
            Math.max(1, rawColumn),
          ),
          row: Math.min(PROFILE_CANVAS_MOBILE_ROWS, Math.max(1, rawRow)),
        },
        true,
      )
    : {
        column: rawColumn,
        row: rawRow,
      };

  return {
    column: Math.min(
      PROFILE_CANVAS_COLUMNS - colSpan + 1,
      Math.max(1, point.column),
    ),
    row: Math.min(PROFILE_CANVAS_ROWS - rowSpan + 1, Math.max(1, point.row)),
    colSpan,
    rowSpan,
  };
}

function profileCanvasEditorPointFromPointer(
  grid: HTMLDivElement,
  clientX: number,
  clientY: number,
  mobile = false,
): CanvasPoint {
  const rect = grid.getBoundingClientRect();
  const styles = window.getComputedStyle(grid);
  const paddingLeft = Number.parseFloat(styles.paddingLeft) || 0;
  const paddingTop = Number.parseFloat(styles.paddingTop) || 0;
  const paddingRight = Number.parseFloat(styles.paddingRight) || 0;
  const columnGap = Number.parseFloat(styles.columnGap) || 0;
  const rowGap = Number.parseFloat(styles.rowGap) || columnGap;
  const contentWidth = Math.max(1, grid.clientWidth - paddingLeft - paddingRight);
  const activeColumns = mobile
    ? PROFILE_CANVAS_MOBILE_COLUMNS
    : PROFILE_CANVAS_COLUMNS;
  const cellSize = Math.max(
    1,
    (contentWidth - columnGap * (activeColumns - 1)) / activeColumns,
  );
  const stepX = cellSize + columnGap;
  const stepY = cellSize + rowGap;
  const rawColumn =
    Math.round((clientX - rect.left - paddingLeft) / stepX) + 1;
  const rawRow = Math.round((clientY - rect.top - paddingTop) / stepY) + 1;
  const editorPoint = {
    column: Math.min(activeColumns, Math.max(1, rawColumn)),
    row: Math.min(
      mobile ? PROFILE_CANVAS_MOBILE_ROWS : PROFILE_CANVAS_ROWS,
      Math.max(1, rawRow),
    ),
  };

  return mobile
    ? profileCanvasDesktopPointFromEditorPoint(editorPoint, true)
    : editorPoint;
}

export function profileCanvasResizeLayoutFromPointer(
  grid: HTMLDivElement,
  clientX: number,
  clientY: number,
  startLayout: ProfileModuleLayout,
  direction: ProfileCanvasResizeDirection,
  type: ProfileModule["type"],
  mobile = false,
): { layout: ProfileModuleLayout; size: ProfileGridModuleSize } {
  const point = profileCanvasEditorPointFromPointer(grid, clientX, clientY, mobile);
  const startEndColumn = startLayout.column + startLayout.colSpan - 1;
  const startEndRow = startLayout.row + startLayout.rowSpan - 1;
  const rawColumn =
    direction.includes("west")
      ? Math.min(startEndColumn, Math.max(1, point.column))
      : startLayout.column;
  const rawEndColumn =
    direction.includes("east")
      ? Math.max(startLayout.column, Math.min(PROFILE_CANVAS_COLUMNS, point.column))
      : startEndColumn;
  const rawRow =
    direction.includes("north")
      ? Math.min(startEndRow, Math.max(1, point.row))
      : startLayout.row;
  const rawEndRow =
    direction.includes("south")
      ? Math.max(startLayout.row, Math.min(PROFILE_CANVAS_ROWS, point.row))
      : startEndRow;
  const rawLayout = {
    column: rawColumn,
    row: rawRow,
    colSpan: Math.max(1, rawEndColumn - rawColumn + 1),
    rowSpan: Math.max(1, rawEndRow - rawRow + 1),
  };

  return profileCanvasNearestResizeLayout(type, startLayout, rawLayout, direction);
}

function profileCanvasNearestResizeLayout(
  type: ProfileModule["type"],
  startLayout: ProfileModuleLayout,
  rawLayout: ProfileModuleLayout,
  direction: ProfileCanvasResizeDirection,
): { layout: ProfileModuleLayout; size: ProfileGridModuleSize } {
  const horizontalOnly =
    (direction === "east" || direction === "west") &&
    !direction.includes("north") &&
    !direction.includes("south");
  const verticalOnly =
    (direction === "north" || direction === "south") &&
    !direction.includes("east") &&
    !direction.includes("west");
  const startEndColumn = startLayout.column + startLayout.colSpan - 1;
  const startEndRow = startLayout.row + startLayout.rowSpan - 1;
  const candidates = profileModuleAllowedSizes(type)
    .map((size) => {
      const span = profileGridModuleSizeSpan(size);
      const column = direction.includes("west")
        ? startEndColumn - span.columns + 1
        : startLayout.column;
      const row = direction.includes("north")
        ? startEndRow - span.rows + 1
        : startLayout.row;
      const layout = {
        column,
        row,
        colSpan: span.columns,
        rowSpan: span.rows,
      };

      return { layout, size };
    })
    .filter(({ layout }) =>
      layout.column >= 1 &&
      layout.row >= 1 &&
      layout.column + layout.colSpan - 1 <= PROFILE_CANVAS_COLUMNS &&
      layout.row + layout.rowSpan - 1 <= PROFILE_CANVAS_ROWS
    );
  const fallbackSize =
    profileGridModuleSpanSize(startLayout.colSpan, startLayout.rowSpan) ??
    getProfileModuleDefinition(type).defaultSize;
  const fallback = {
    layout: startLayout,
    size: fallbackSize,
  };

  return (
    candidates.sort((first, second) => {
      const firstScore = profileCanvasResizeCandidateScore(
        first.layout,
        rawLayout,
        startLayout,
        horizontalOnly,
        verticalOnly,
      );
      const secondScore = profileCanvasResizeCandidateScore(
        second.layout,
        rawLayout,
        startLayout,
        horizontalOnly,
        verticalOnly,
      );

      return firstScore - secondScore;
    })[0] ?? fallback
  );
}

function profileCanvasResizeCandidateScore(
  layout: ProfileModuleLayout,
  rawLayout: ProfileModuleLayout,
  startLayout: ProfileModuleLayout,
  horizontalOnly: boolean,
  verticalOnly: boolean,
): number {
  return (
    Math.abs(layout.colSpan - rawLayout.colSpan) * 12 +
    Math.abs(layout.rowSpan - rawLayout.rowSpan) * 12 +
    Math.abs(layout.column - rawLayout.column) * 3 +
    Math.abs(layout.row - rawLayout.row) * 3 +
    (horizontalOnly && layout.rowSpan !== startLayout.rowSpan ? 100 : 0) +
    (verticalOnly && layout.colSpan !== startLayout.colSpan ? 100 : 0)
  );
}

type ProfileCanvasSelectionFit = {
  enabled: boolean;
  exactSize?: ProfileGridModuleSize | undefined;
  noteSize?: ProfileGridModuleSize | undefined;
  sortSize: ProfileGridModuleSize;
  warning?: "too-large" | "too-small" | undefined;
};

type ProfileCanvasSelectionExample = {
  category: ProfileModuleCategory;
  label: string;
  type: ProfileModule["type"];
};

const profileCanvasSelectionExampleLimit = 4;
const profileCanvasSelectionExampleCategoryPriority: Record<
  ProfileModuleCategory,
  number
> = {
  music: 0,
  info: 1,
  images: 2,
  video: 3,
  projects: 4,
};
const profileCanvasSelectionExampleTypePriority: Partial<
  Record<ProfileModule["type"], number>
> = {
  music: 0,
  text: 1,
  uploaded_image: 2,
  twitch_channel: 3,
  uploaded_video: 4,
  youtube_video: 5,
  activity: 6,
  connections: 7,
  badge_display: 8,
  featured_room: 9,
  featured_post: 10,
  github_repo: 11,
};

function profileCanvasAllowedSizesByArea(
  type: ProfileModule["type"],
): ProfileGridModuleSize[] {
  return [...profileModuleAllowedSizes(type)].sort((first, second) => {
    const firstSpan = profileGridModuleSizeSpan(first);
    const secondSpan = profileGridModuleSizeSpan(second);

    return (
      firstSpan.columns * firstSpan.rows -
        secondSpan.columns * secondSpan.rows ||
      firstSpan.columns - secondSpan.columns ||
      firstSpan.rows - secondSpan.rows
    );
  });
}

export function profileCanvasSelectionSize(
  selection: ProfileModuleLayout,
): ProfileGridModuleSize | undefined {
  return profileGridModuleSpanSize(
    Math.min(PROFILE_CANVAS_PROFILE_INFO_COLUMNS, selection.colSpan),
    Math.min(PROFILE_CANVAS_ACTIVITY_MAX_MODULE_ROWS, selection.rowSpan),
  );
}

export function profileCanvasExactSizeForSelection(
  type: ProfileModule["type"],
  selection: ProfileModuleLayout,
): ProfileGridModuleSize | undefined {
  const selectionSize = profileCanvasSelectionSize(selection);

  if (selectionSize && profileModuleAllowedSizes(type).includes(selectionSize)) {
    return selectionSize;
  }

  return undefined;
}

export function profileCanvasFitForSelection(
  type: ProfileModule["type"],
  selection: ProfileModuleLayout,
): ProfileCanvasSelectionFit {
  const allowedSizes = profileCanvasAllowedSizesByArea(type);
  const fallbackSize = getProfileModuleDefinition(type).defaultSize;
  const smallestSize = allowedSizes[0] ?? fallbackSize;
  const largestSize = allowedSizes[allowedSizes.length - 1] ?? fallbackSize;
  const exactSize = profileCanvasExactSizeForSelection(type, selection);

  if (exactSize) {
    return {
      enabled: true,
      exactSize,
      sortSize: exactSize,
    };
  }

  const smallestSpan = profileGridModuleSizeSpan(smallestSize);
  const largestSpan = profileGridModuleSizeSpan(largestSize);
  const allowedSpans = allowedSizes.map(profileGridModuleSizeSpan);
  const minColumns = Math.min(...allowedSpans.map((span) => span.columns));
  const minRows = Math.min(...allowedSpans.map((span) => span.rows));
  const maxColumns = Math.max(...allowedSpans.map((span) => span.columns));
  const maxRows = Math.max(...allowedSpans.map((span) => span.rows));
  const selectionArea = selection.colSpan * selection.rowSpan;
  const smallestArea = smallestSpan.columns * smallestSpan.rows;
  const largestArea = largestSpan.columns * largestSpan.rows;
  const warning =
    selectionArea < smallestArea ||
    selection.colSpan < minColumns ||
    selection.rowSpan < minRows
      ? "too-small"
      : selectionArea > largestArea ||
          selection.colSpan > maxColumns ||
          selection.rowSpan > maxRows
        ? "too-large"
        : "too-large";

  return {
    enabled: false,
    noteSize: warning === "too-small" ? smallestSize : largestSize,
    sortSize: warning === "too-small" ? smallestSize : largestSize,
    warning,
  };
}

function profileCanvasSelectionExampleRank(type: ProfileModule["type"]): number {
  return profileCanvasSelectionExampleTypePriority[type] ?? 100;
}

function profileModulePickerLabel(type: ProfileModule["type"]): string {
  return profileModuleCatalog.find((item) => item.type === type)?.label ?? type;
}

export function profileCanvasSelectionExamples(
  selection: ProfileModuleLayout,
): ProfileCanvasSelectionExample[] {
  const ranked = profileModuleCatalog
    .map((item) => ({
      ...item,
      fit: profileCanvasFitForSelection(item.type, selection),
    }))
    .filter((item) => item.fit.exactSize)
    .sort(
      (first, second) =>
        profileCanvasSelectionExampleRank(first.type) -
          profileCanvasSelectionExampleRank(second.type) ||
        profileCanvasSelectionExampleCategoryPriority[first.category] -
          profileCanvasSelectionExampleCategoryPriority[second.category] ||
        first.label.localeCompare(second.label),
    );
  const picked: ProfileCanvasSelectionExample[] = [];
  const usedCategories = new Set<ProfileModuleCategory>();

  for (const item of ranked) {
    if (usedCategories.has(item.category)) {
      continue;
    }

    picked.push({
      category: item.category,
      label: profileModulePickerLabel(item.type),
      type: item.type,
    });
    usedCategories.add(item.category);

    if (picked.length >= profileCanvasSelectionExampleLimit) {
      return picked;
    }
  }

  for (const item of ranked) {
    if (picked.some((example) => example.type === item.type)) {
      continue;
    }

    picked.push({
      category: item.category,
      label: profileModulePickerLabel(item.type),
      type: item.type,
    });

    if (picked.length >= profileCanvasSelectionExampleLimit) {
      break;
    }
  }

  return picked;
}

export function profileCanvasDefaultConfigForModule(
  type: ProfileModule["type"],
  size: ProfileGridModuleSize,
  integrationLinks: ProfileModuleLink[] = [],
): ProfileModule["config"] {
  const definition = getProfileModuleDefinition(type);
  const base = {
    canvasSize: size,
    configured: profileCanvasModuleIsIntrinsicallyConfigured(type),
  };

  if (type === "connections" || type === "links") {
    return profileCanvasConfigWithIntegrationLinks(
      { ...base, links: [] },
      integrationLinks,
    );
  }

  if (type === "badge_display" || type === "featured_badges") {
    return { ...base, userBadgeIds: [] };
  }

  if (definition.category === "images") {
    return { ...base, mediaItems: [] };
  }

  if (definition.category === "video") {
    if (type === "uploaded_video") {
      return { ...base, sourceMode: "upload" };
    }

    const config = {
      ...base,
      platform: type.startsWith("youtube") ? "youtube" : "twitch",
      sourceMode: type.startsWith("youtube") ? "youtube" : "twitch",
    };

    return type === "twitch_channel"
      ? {
          ...config,
          displayMode: profileModuleTwitchDisplayModeForSize(size),
        }
      : config;
  }

  if (definition.category === "music") {
    if (type === "music_playlist") {
      return { ...base, platform: "custom", sourceMode: "upload", tracks: [] };
    }

    if (type === "music") {
      return { ...base, platform: "custom", sourceMode: "upload" };
    }

    const provider = type.startsWith("apple")
      ? "apple_music"
      : type.startsWith("youtube")
        ? "youtube_music"
        : "spotify";

    return { ...base, platform: provider, sourceMode: provider };
  }

  if (type === "github_repo") {
    return { ...base, platform: "github", sourceMode: "github", displayMode: "project" };
  }

  return base;
}

export function profileCanvasModuleIsIntrinsicallyConfigured(
  type: ProfileModule["type"],
): boolean {
  return (
    type === "profile_info" ||
    type === "activity" ||
    type === "featured_post" ||
    type === "featured_room"
  );
}

export function profileCanvasModuleIsConfiguredForEditor(module: ProfileModule): boolean {
  if (module.type === "placeholder") {
    return false;
  }

  return (
    profileCanvasModuleIsIntrinsicallyConfigured(module.type) ||
    module.config.configured !== false
  );
}

type ProfileCanvasAutofillConfig = {
  config: ProfileModule["config"];
  resolve?: {
    provider?: ProfileIntegrationProvider;
    url: string;
  };
};

export function profileCanvasAutofillConfigForModule(
  type: ProfileModule["type"],
  size: ProfileGridModuleSize,
  baseConfig: ProfileModule["config"],
  integrationAccounts: ProfileIntegrationAccount[],
): ProfileCanvasAutofillConfig {
  if (type !== "twitch_channel") {
    return { config: baseConfig };
  }

  const account = profileCanvasConnectedIntegrationAccount(
    integrationAccounts,
    "twitch",
  );
  const sourceUrl = account
    ? profileCanvasIntegrationAccountUrl(account)
    : undefined;

  if (!sourceUrl || !account) {
    return { config: baseConfig };
  }

  const label =
    account.displayName ??
    profileCanvasIntegrationAccountHandle(account) ??
    "Twitch stream";
  const config = {
    ...baseConfig,
    configured: true,
    displayMode: profileCanvasTwitchDisplayModeForSize(size),
    label,
    platform: "twitch",
    sourceMode: "twitch",
    url: sourceUrl,
  };

  return {
    config,
    resolve: {
      provider: "twitch",
      url: sourceUrl,
    },
  };
}

export function profileCanvasConfigWithIntegrationCard(
  config: ProfileModule["config"],
  card: ProfileIntegrationCard,
): ProfileModule["config"] {
  const nextConfig: ProfileModule["config"] = {
    ...config,
    configured: true,
    integration: card,
    platform: card.provider,
    url: card.sourceUrl,
  };

  if (card.metadata.description) {
    nextConfig.description = card.metadata.description;
  }

  if (card.metadata.title) {
    nextConfig.label = card.metadata.title;
  }

  return nextConfig;
}

export function profileCanvasTwitchDisplayModeForSize(
  size: ProfileGridModuleSize,
): "stream_status" | "stream" | "stream_chat" {
  return profileModuleTwitchDisplayModeForSize(size);
}

function profileCanvasConnectedIntegrationAccount(
  integrationAccounts: ProfileIntegrationAccount[],
  provider: ProfileIntegrationProvider,
): ProfileIntegrationAccount | undefined {
  return integrationAccounts.find(
    (account) => account.provider === provider && !account.revokedAt,
  );
}

export function profileCanvasConnectionLinksFromIntegrationAccounts(
  integrationAccounts: ProfileIntegrationAccount[],
): ProfileModuleLink[] {
  return integrationAccounts
    .filter((account) => !account.revokedAt)
    .map(profileCanvasConnectionLinkFromIntegrationAccount)
    .filter((link): link is ProfileModuleLink => Boolean(link));
}

function profileCanvasConnectionLinkFromIntegrationAccount(
  account: ProfileIntegrationAccount,
): ProfileModuleLink | undefined {
  const url = profileCanvasIntegrationAccountUrl(account);

  if (!url) {
    return undefined;
  }

  return {
    label:
      account.displayName ??
      profileCanvasIntegrationAccountHandle(account) ??
      profileCanvasProviderLabel(account.provider),
    platform: profileCanvasConnectionPlatformForProvider(account.provider),
    url,
  };
}

export function profileCanvasIntegrationAccountUrl(
  account: ProfileIntegrationAccount,
): string | undefined {
  const handle = profileCanvasIntegrationAccountHandle(account);

  if (account.provider === "github" && handle) {
    return `https://github.com/${encodeURIComponent(handle.replace(/^@/, ""))}`;
  }

  if (account.provider === "twitch" && handle) {
    return `https://www.twitch.tv/${encodeURIComponent(handle.replace(/^@/, ""))}`;
  }

  if (account.provider === "youtube") {
    const rawHandle = account.providerHandle?.trim();

    if (rawHandle && /^@[A-Za-z0-9_.-]+$/.test(rawHandle)) {
      return `https://www.youtube.com/${rawHandle}`;
    }

    if (account.providerAccountId) {
      return `https://www.youtube.com/channel/${encodeURIComponent(
        account.providerAccountId,
      )}`;
    }
  }

  if (account.provider === "spotify" && account.providerAccountId) {
    return `https://open.spotify.com/user/${encodeURIComponent(
      account.providerAccountId,
    )}`;
  }

  return undefined;
}

export function profileCanvasIntegrationAccountHandle(
  account: ProfileIntegrationAccount,
): string | undefined {
  const handle = account.providerHandle?.trim() || account.displayName?.trim();

  if (handle) {
    return handle;
  }

  return account.providerAccountId?.trim() || undefined;
}

export function profileCanvasProviderLabel(provider: ProfileIntegrationProvider): string {
  const labels: Record<ProfileIntegrationProvider, string> = {
    apple_music: "Apple Music",
    github: "GitHub",
    spotify: "Spotify",
    twitch: "Twitch",
    youtube: "YouTube",
  };

  return labels[provider];
}

export function profileIntegrationProviderFromParam(
  value: string | null,
): ProfileIntegrationProvider | undefined {
  return value === "spotify" ||
    value === "apple_music" ||
    value === "youtube" ||
    value === "twitch" ||
    value === "github"
    ? value
    : undefined;
}

function profileCanvasConnectionPlatformForProvider(
  provider: ProfileIntegrationProvider,
): string {
  return provider === "apple_music" ? "website" : provider;
}

export function profileCanvasModulesWithIntegrationLinks(
  modules: ProfileModule[],
  integrationLinks: ProfileModuleLink[],
): ProfileModule[] {
  if (integrationLinks.length === 0) {
    return modules;
  }

  let changed = false;
  const nextModules = modules.map((module) => {
    if (module.type !== "connections" && module.type !== "links") {
      return module;
    }

    const config = profileCanvasConfigWithIntegrationLinks(
      module.config,
      integrationLinks,
    );

    if (config === module.config) {
      return module;
    }

    changed = true;

    return {
      ...module,
      config,
      visibility: config.configured === false ? module.visibility : "public",
    };
  });

  return changed ? nextModules : modules;
}

function profileCanvasConfigWithIntegrationLinks(
  config: ProfileModule["config"],
  integrationLinks: ProfileModuleLink[],
): ProfileModule["config"] {
  if (integrationLinks.length === 0) {
    return config;
  }

  const links = [...(config.links ?? [])];
  const seen = new Set(links.map(profileCanvasConnectionLinkKey));
  let changed = false;

  integrationLinks.forEach((link) => {
    const key = profileCanvasConnectionLinkKey(link);

    if (seen.has(key)) {
      return;
    }

    seen.add(key);
    links.push(link);
    changed = true;
  });

  if (!changed) {
    return config;
  }

  const nextConfig: ProfileModule["config"] = {
    ...config,
    links,
  };

  if (links.length > 0) {
    nextConfig.configured = true;
  }

  return nextConfig;
}

function profileCanvasConnectionLinkKey(link: ProfileModuleLink): string {
  return `${link.platform ?? "website"}:${link.url.toLowerCase()}`;
}

export function profileCanvasProviderForModule(
  type: ProfileModule["type"],
): ProfileIntegrationProvider | undefined {
  if (type === "github_repo") {
    return "github";
  }

  if (type === "twitch_channel") {
    return "twitch";
  }

  if (type.startsWith("youtube_")) {
    return "youtube";
  }

  if (type.startsWith("spotify_")) {
    return "spotify";
  }

  if (type.startsWith("apple_music_")) {
    return "apple_music";
  }

  return undefined;
}

export function profileCanvasResolveDraftCollisions(
  modules: ProfileModule[],
  anchorModuleId?: number,
  fallbackToAuto = false,
): ProfileModule[] {
  const occupied = new Set<string>();
  const result = new Map<number, ProfileModule>();
  const active = [...modules]
    .filter((module) => module.status !== "deleted")
    .sort((first, second) => {
      if (first.pinned !== second.pinned) {
        return first.pinned ? -1 : 1;
      }

      if (anchorModuleId !== undefined) {
        if (first.id === anchorModuleId && second.id !== anchorModuleId) {
          return -1;
        }

        if (second.id === anchorModuleId && first.id !== anchorModuleId) {
          return 1;
        }
      }

      const priority = profileCanvasModulePriority(first) - profileCanvasModulePriority(second);

      if (priority !== 0) {
        return priority;
      }

      const firstLayout = first.layout ?? profileCanvasDefaultClientLayout(first, 0);
      const secondLayout = second.layout ?? profileCanvasDefaultClientLayout(second, 0);

      return (
        firstLayout.row - secondLayout.row ||
        firstLayout.column - secondLayout.column ||
        first.position - second.position ||
        first.id - second.id
      );
    });

  active.forEach((module, index) => {
    const requested = profileCanvasClampLayout(
      module.layout ?? profileCanvasDefaultClientLayout(module, index),
      module.type,
    );
    const availableLayout = profileCanvasLayoutFits(requested, occupied)
      ? requested
      : profileCanvasNextAvailableLayout(requested, occupied);
    const layout = availableLayout ?? (fallbackToAuto ? null : requested);

    if (layout) {
      profileCanvasOccupyLayout(layout, occupied);
    }
    result.set(module.id, { ...module, layout });
  });

  return modules.map((module) => result.get(module.id) ?? module);
}

export function profileCanvasClampLayout(
  layout: ProfileModuleLayout,
  type: ProfileModule["type"],
): ProfileModuleLayout {
  const maxSpan = profileCanvasMaxSpanForType(type);
  const colSpan = Math.min(maxSpan.columns, Math.max(1, layout.colSpan));
  const rowSpan = Math.min(maxSpan.rows, Math.max(1, layout.rowSpan));

  return {
    column: Math.min(PROFILE_CANVAS_COLUMNS - colSpan + 1, Math.max(1, layout.column)),
    row: Math.min(PROFILE_CANVAS_ROWS - rowSpan + 1, Math.max(1, layout.row)),
    colSpan,
    rowSpan,
  };
}

export function clampProfileModuleLayout(
  layout: ProfileModuleLayout,
): ProfileModuleLayout {
  const colSpan = Math.max(
    1,
    Math.min(PROFILE_CANVAS_PROFILE_INFO_COLUMNS, layout.colSpan),
  );
  const rowSpan = Math.max(
    1,
    Math.min(PROFILE_CANVAS_MAX_MODULE_ROWS, layout.rowSpan),
  );

  return {
    column: Math.max(
      1,
      Math.min(PROFILE_CANVAS_COLUMNS - colSpan + 1, layout.column),
    ),
    row: Math.max(1, Math.min(PROFILE_CANVAS_ROWS - rowSpan + 1, layout.row)),
    colSpan,
    rowSpan,
  };
}

function profileCanvasMaxSpanForType(type: ProfileModule["type"]): {
  columns: number;
  rows: number;
} {
  return profileModuleAllowedSizes(type).reduce(
    (max, size) => {
      const span = profileGridModuleSizeSpan(size);

      return {
        columns: Math.max(max.columns, span.columns),
        rows: Math.max(max.rows, span.rows),
      };
    },
    { columns: 1, rows: 1 },
  );
}

function profileCanvasLayoutFits(
  layout: ProfileModuleLayout,
  occupied: Set<string>,
): boolean {
  if (
    layout.column < 1 ||
    layout.row < 1 ||
    layout.column + layout.colSpan - 1 > PROFILE_CANVAS_COLUMNS ||
    layout.row + layout.rowSpan - 1 > PROFILE_CANVAS_ROWS
  ) {
    return false;
  }

  for (let row = layout.row; row < layout.row + layout.rowSpan; row += 1) {
    for (
      let column = layout.column;
      column < layout.column + layout.colSpan;
      column += 1
    ) {
      if (occupied.has(`${column}:${row}`)) {
        return false;
      }
    }
  }

  return true;
}

export function profileCanvasResizeBlockedByPinned(
  modules: ProfileModule[],
  moduleId: number,
  layout: ProfileModuleLayout,
): boolean {
  return modules.some((module, index) => {
    if (!module.pinned || module.id === moduleId || module.status === "deleted") {
      return false;
    }

    return profileCanvasRectsOverlap(
      layout,
      module.layout ?? profileCanvasDefaultClientLayout(module, index),
    );
  });
}

function profileCanvasOccupyLayout(
  layout: ProfileModuleLayout,
  occupied: Set<string>,
) {
  for (let row = layout.row; row < layout.row + layout.rowSpan; row += 1) {
    for (
      let column = layout.column;
      column < layout.column + layout.colSpan;
      column += 1
    ) {
      occupied.add(`${column}:${row}`);
    }
  }
}

function profileCanvasNextAvailableLayout(
  layout: ProfileModuleLayout,
  occupied: Set<string>,
): ProfileModuleLayout | undefined {
  const maxColumn = PROFILE_CANVAS_COLUMNS - layout.colSpan + 1;
  const maxRow = PROFILE_CANVAS_ROWS - layout.rowSpan + 1;

  for (let row = 1; row <= maxRow; row += 1) {
    for (let column = 1; column <= maxColumn; column += 1) {
      const candidate = { ...layout, column, row };

      if (profileCanvasLayoutFits(candidate, occupied)) {
        return candidate;
      }
    }
  }

  return undefined;
}
