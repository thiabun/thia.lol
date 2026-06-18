import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEventHandler,
  type MutableRefObject,
  type ReactNode,
  type Ref,
} from "react";
import { motion } from "motion/react";
import type { MotionStyle } from "motion/react";
import { cn } from "../../lib/classNames";
import { defaultProfileLayoutPreset } from "../../lib/profileLayoutPresets";
import {
  PROFILE_CANVAS_DESKTOP_COLUMNS,
  PROFILE_CANVAS_DESKTOP_ROWS,
  PROFILE_CANVAS_MOBILE_COLUMNS,
  PROFILE_CANVAS_MOBILE_ROWS,
  profileGridModuleSizeSpan,
  type ProfileGridModuleSize,
} from "../../lib/profileModuleRegistry";
import type { ProfileLayoutPreset, ProfileModuleLayout } from "../../lib/types";
import { cardEntrance, softSpring } from "../../lib/motionPresets";

type ProfileGridProps = {
  children: ReactNode;
  className?: string | undefined;
  layoutPreset?: ProfileLayoutPreset | undefined;
  maxColumns?: 6 | 12;
  maxRows?: 16 | 32;
  gridRef?: Ref<HTMLDivElement> | undefined;
  onClick?: MouseEventHandler<HTMLDivElement> | undefined;
  testId?: string | undefined;
};

export function ProfileGrid({
  children,
  className,
  layoutPreset = defaultProfileLayoutPreset,
  maxColumns = PROFILE_CANVAS_DESKTOP_COLUMNS,
  maxRows = PROFILE_CANVAS_DESKTOP_ROWS,
  gridRef,
  onClick,
  testId = "profile-grid",
}: ProfileGridProps) {
  const localGridRef = useRef<HTMLDivElement | null>(null);
  const [activeColumnCount, setActiveColumnCount] = useState(1);
  const [activeRowBudget, setActiveRowBudget] = useState(maxRows);
  const [measuredCellSize, setMeasuredCellSize] = useState<number | undefined>();
  const setGridElement = useCallback(
    (element: HTMLDivElement | null) => {
      localGridRef.current = element;
      assignProfileGridRef(gridRef, element);
    },
    [gridRef],
  );

  useLayoutEffect(() => {
    const element = localGridRef.current;

    if (!element || typeof window === "undefined") {
      return undefined;
    }

    const updateCellSize = () => {
      const styles = window.getComputedStyle(element);
      const activeColumns = profileGridActiveColumnCount(maxColumns);
      const activeRows = profileGridActiveRowCount(maxRows);
      const columnGap = Number.parseFloat(styles.columnGap) || 0;
      const paddingLeft = Number.parseFloat(styles.paddingLeft) || 0;
      const paddingRight = Number.parseFloat(styles.paddingRight) || 0;
      const contentWidth = Math.max(
        1,
        element.clientWidth - paddingLeft - paddingRight,
      );
      const nextCellSize = Math.max(
        1,
        (contentWidth - columnGap * (activeColumns - 1)) / activeColumns,
      );

      setActiveColumnCount((current) =>
        current === activeColumns ? current : activeColumns,
      );
      setActiveRowBudget((current) =>
        current === activeRows ? current : activeRows,
      );
      setMeasuredCellSize((current) =>
        current !== undefined && Math.abs(current - nextCellSize) < 0.5
          ? current
          : nextCellSize,
      );
    };

    updateCellSize();

    const resizeObserver = new ResizeObserver(updateCellSize);
    resizeObserver.observe(element);
    window.addEventListener("resize", updateCellSize);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", updateCellSize);
    };
  }, [layoutPreset, maxColumns, maxRows]);

  const gridStyle = {
    "--profile-grid-gap": layoutPreset === "compact" ? "0.5rem" : "0.75rem",
    "--profile-grid-columns": String(maxColumns),
    "--profile-grid-active-columns": String(activeColumnCount),
    "--profile-grid-cell-size":
      measuredCellSize === undefined
        ? "calc((100% - (var(--profile-grid-active-columns) - 1) * var(--profile-grid-gap)) / var(--profile-grid-active-columns))"
        : `${measuredCellSize}px`,
    "--profile-grid-row-size": "var(--profile-grid-cell-size)",
    "--profile-grid-row-budget": String(activeRowBudget),
    gridTemplateColumns:
      "repeat(var(--profile-grid-active-columns), minmax(0, 1fr))",
    gridAutoRows: "var(--profile-grid-row-size)",
  } as CSSProperties;

  return (
    <div
      ref={setGridElement}
      className={cn(
        "profile-grid-canvas grid min-w-0 rounded-panel border border-line bg-surface/34 p-2 shadow-soft backdrop-blur-veil",
        layoutPreset === "compact" ? "gap-2" : "gap-3",
        className,
      )}
      data-profile-canvas-columns={maxColumns}
      data-profile-canvas-rows={activeRowBudget}
      data-profile-layout-preset={layoutPreset}
      data-testid={testId}
      onClick={onClick}
      style={gridStyle}
    >
      {children}
    </div>
  );
}

function profileGridActiveColumnCount(maxColumns: 6 | 12): number {
  if (typeof window === "undefined") {
    return maxColumns;
  }

  if (window.matchMedia("(min-width: 1024px)").matches) {
    return maxColumns;
  }

  return Math.min(PROFILE_CANVAS_MOBILE_COLUMNS, maxColumns);
}

function profileGridActiveRowCount(maxRows: 16 | 32): 16 | 32 {
  if (typeof window === "undefined") {
    return maxRows;
  }

  if (window.matchMedia("(min-width: 1024px)").matches) {
    return maxRows;
  }

  return PROFILE_CANVAS_MOBILE_ROWS;
}

function assignProfileGridRef(
  ref: Ref<HTMLDivElement> | undefined,
  element: HTMLDivElement | null,
) {
  if (!ref) {
    return;
  }

  if (typeof ref === "function") {
    ref(element);
    return;
  }

  (ref as MutableRefObject<HTMLDivElement | null>).current = element;
}

type ProfileGridSectionProps = {
  action?: ReactNode;
  children: ReactNode;
  className?: string | undefined;
  custom?: number | undefined;
  testId?: string | undefined;
  title: string;
};

export function ProfileGridSection({
  action,
  children,
  className,
  custom = 2,
  testId,
  title,
}: ProfileGridSectionProps) {
  return (
    <motion.section
      aria-label={title}
      className={cn("border-t border-line pt-4", className)}
      data-testid={testId}
      variants={cardEntrance}
      custom={custom}
      initial="hidden"
      animate="show"
    >
      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-text">{title}</h2>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {children}
    </motion.section>
  );
}

type ProfileGridModuleProps = {
  children: ReactNode;
  className?: string | undefined;
  dragging?: boolean | undefined;
  layout?: ProfileModuleLayout | null | undefined;
  presentation?:
    | {
        compact: boolean;
        density: string;
        emptyPolicy: string;
        freshness: string;
        primaryAction: string;
        purpose: string;
        spanRole: string;
      }
    | undefined;
  pinned?: boolean | undefined;
  selected?: boolean | undefined;
  size?: ProfileGridModuleSize | string | undefined;
  testId?: string | undefined;
  onClickCapture?: MouseEventHandler<HTMLDivElement> | undefined;
};

export function ProfileGridModule({
  children,
  className,
  dragging = false,
  layout,
  presentation,
  pinned = false,
  selected = false,
  size = "1x1",
  testId,
  onClickCapture,
}: ProfileGridModuleProps) {
  const span = profileGridModuleSizeSpan(size);
  const moduleStyle = {
    "--profile-grid-column": String(layout?.column ?? 1),
    "--profile-grid-row": String(layout?.row ?? 1),
    "--profile-grid-column-span": String(layout?.colSpan ?? span.columns),
    "--profile-grid-mobile-column-span": String(
      Math.min(PROFILE_CANVAS_MOBILE_COLUMNS, layout?.colSpan ?? span.columns),
    ),
    "--profile-grid-row-span": String(layout?.rowSpan ?? span.rows),
  } as CSSProperties;

  return (
    <motion.div
      layout
      transition={{
        layout: softSpring,
        opacity: { duration: 0.16, ease: "easeOut" },
        scale: { duration: 0.16, ease: "easeOut" },
      }}
      className={cn(
        "profile-grid-module relative min-h-0 min-w-0 scroll-mt-24 transform-gpu max-md:[aspect-ratio:var(--profile-grid-column-span)/var(--profile-grid-row-span)] md:h-full",
        profileGridModuleSizeClass(span.size),
        className,
      )}
      data-profile-grid-placement={layout ? "manual" : "auto"}
      data-profile-grid-module="true"
      data-profile-module-pinned={pinned ? "true" : undefined}
      data-profile-grid-column-span={span.columns}
      data-profile-grid-row-span={span.rows}
      data-profile-grid-size={span.size}
      data-profile-module-dragging={dragging ? "true" : undefined}
      data-profile-module-action={presentation?.primaryAction}
      data-profile-module-compact={
        presentation ? String(presentation.compact) : undefined
      }
      data-profile-module-density={presentation?.density}
      data-profile-module-empty-policy={presentation?.emptyPolicy}
      data-profile-module-freshness={presentation?.freshness}
      data-profile-module-purpose={presentation?.purpose}
      data-profile-module-selected={selected ? "true" : undefined}
      data-profile-module-span-role={presentation?.spanRole}
      data-testid={testId}
      onClickCapture={onClickCapture}
      style={moduleStyle as MotionStyle}
    >
      {children}
    </motion.div>
  );
}

function profileGridModuleSizeClass(size: ProfileGridModuleSize): string {
  void size;
  return "";
}
