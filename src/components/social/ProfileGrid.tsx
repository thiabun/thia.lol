import type { ReactNode } from "react";
import { motion } from "motion/react";
import { cn } from "../../lib/classNames";
import { defaultProfileLayoutPreset } from "../../lib/profileLayoutPresets";
import type { ProfileGridModuleSize } from "../../lib/profileModuleRegistry";
import type { ProfileLayoutPreset } from "../../lib/types";
import { cardEntrance } from "../../lib/motionPresets";

type ProfileGridProps = {
  children: ReactNode;
  className?: string | undefined;
  layoutPreset?: ProfileLayoutPreset | undefined;
  maxColumns?: 2 | 3;
  testId?: string | undefined;
};

export function ProfileGrid({
  children,
  className,
  layoutPreset = defaultProfileLayoutPreset,
  maxColumns = 3,
  testId = "profile-grid",
}: ProfileGridProps) {
  return (
    <div
      className={cn(
        "grid min-w-0 grid-cols-1 md:grid-cols-2",
        layoutPreset === "compact" ? "gap-2" : "gap-3",
        maxColumns === 3 ? "xl:grid-cols-3" : undefined,
        className,
      )}
      data-profile-layout-preset={layoutPreset}
      data-testid={testId}
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
  size?: ProfileGridModuleSize;
  testId?: string | undefined;
};

export function ProfileGridModule({
  children,
  className,
  size = "small",
  testId,
}: ProfileGridModuleProps) {
  return (
    <div
      className={cn("min-w-0", profileGridModuleSizeClass(size), className)}
      data-profile-grid-size={size}
      data-testid={testId}
    >
      {children}
    </div>
  );
}

function profileGridModuleSizeClass(size: ProfileGridModuleSize): string {
  if (size === "feature") {
    return "md:col-span-2 xl:col-span-3";
  }

  if (size === "wide") {
    return "md:col-span-2";
  }

  if (size === "tall") {
    return "md:row-span-2";
  }

  return "";
}
