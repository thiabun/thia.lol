import type { CSSProperties, ReactNode } from "react";
import { motion } from "motion/react";
import { cn } from "../../lib/classNames";
import { defaultProfileLayoutPreset } from "../../lib/profileLayoutPresets";
import {
  profileGridModuleSizeSpan,
  type ProfileGridModuleSize,
} from "../../lib/profileModuleRegistry";
import type { ProfileLayoutPreset } from "../../lib/types";
import { cardEntrance } from "../../lib/motionPresets";

type ProfileGridProps = {
  children: ReactNode;
  className?: string | undefined;
  layoutPreset?: ProfileLayoutPreset | undefined;
  maxColumns?: 2 | 6;
  maxRows?: 9;
  testId?: string | undefined;
};

export function ProfileGrid({
  children,
  className,
  layoutPreset = defaultProfileLayoutPreset,
  maxColumns = 6,
  maxRows = 9,
  testId = "profile-grid",
}: ProfileGridProps) {
  const gridStyle = {
    "--profile-grid-gap": layoutPreset === "compact" ? "0.5rem" : "0.75rem",
    "--profile-grid-row-size": "8rem",
    "--profile-grid-row-budget": String(maxRows),
  } as CSSProperties;

  return (
    <div
      className={cn(
        "grid min-w-0 grid-cols-1 md:grid-cols-2 md:auto-rows-[minmax(var(--profile-grid-row-size),auto)]",
        layoutPreset === "compact" ? "gap-2" : "gap-3",
        maxColumns === 6 ? "lg:grid-cols-6" : undefined,
        className,
      )}
      data-profile-canvas-columns={maxColumns}
      data-profile-canvas-rows={maxRows}
      data-profile-layout-preset={layoutPreset}
      data-testid={testId}
      style={gridStyle}
    >
      {children}
    </div>
  );
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
  size?: ProfileGridModuleSize | string | undefined;
  testId?: string | undefined;
};

export function ProfileGridModule({
  children,
  className,
  size = "1x1",
  testId,
}: ProfileGridModuleProps) {
  const span = profileGridModuleSizeSpan(size);

  return (
    <div
      className={cn("min-w-0", profileGridModuleSizeClass(span.size), className)}
      data-profile-grid-column-span={span.columns}
      data-profile-grid-row-span={span.rows}
      data-profile-grid-size={span.size}
      data-testid={testId}
    >
      {children}
    </div>
  );
}

function profileGridModuleSizeClass(size: ProfileGridModuleSize): string {
  if (size === "3x1") {
    return "md:col-span-2 lg:col-span-3";
  }

  if (size === "3x2") {
    return "md:col-span-2 md:row-span-2 lg:col-span-3";
  }

  if (size === "3x3") {
    return "md:col-span-2 md:row-span-3 lg:col-span-3";
  }

  if (size === "2x1") {
    return "md:col-span-2";
  }

  if (size === "1x2") {
    return "md:row-span-2";
  }

  if (size === "1x3") {
    return "md:row-span-3";
  }

  if (size === "2x2") {
    return "md:col-span-2 md:row-span-2";
  }

  if (size === "2x3") {
    return "md:col-span-2 md:row-span-3";
  }

  return "";
}
