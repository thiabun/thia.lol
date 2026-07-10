import type { ReactNode } from "react";
import { motion, type HTMLMotionProps } from "motion/react";
import { cn } from "../../lib/classNames";
import { buttonTap } from "../../lib/motionPresets";

type IconButtonVariant = "surface" | "ghost" | "accent" | "danger";
type IconButtonSize = "sm" | "md";

const variants: Record<IconButtonVariant, string> = {
  surface:
    "border border-line bg-surface/78 text-text shadow-inner-soft hover:border-line-strong hover:bg-surface",
  ghost: "text-muted hover:bg-surface-strong/70 hover:text-text",
  accent:
    "border border-accent/35 bg-accent text-accent-contrast shadow-soft hover:bg-accent-strong",
  danger:
    "border border-rose/35 bg-rose/15 text-rose-ink shadow-inner-soft hover:border-rose/55 hover:bg-rose/20",
};

const sizes: Record<IconButtonSize, string> = {
  sm: "size-8",
  md: "size-9",
};

type IconButtonProps = Omit<HTMLMotionProps<"button">, "children"> & {
  icon: ReactNode;
  label: string;
  size?: IconButtonSize;
  variant?: IconButtonVariant;
};

export function IconButton({
  className,
  icon,
  label,
  size = "md",
  title,
  type = "button",
  variant = "surface",
  whileTap,
  ...props
}: IconButtonProps) {
  const tapProps =
    whileTap !== undefined
      ? { whileTap }
      : !props.disabled
        ? { whileTap: buttonTap }
        : {};

  return (
    <motion.button
      aria-label={label}
      className={cn(
        "app-control inline-grid shrink-0 touch-manipulation place-items-center rounded-full transition duration-fluid ease-fluid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:pointer-events-none disabled:opacity-50",
        variants[variant],
        sizes[size],
        className,
      )}
      title={title ?? label}
      type={type}
      {...tapProps}
      {...props}
    >
      {icon}
    </motion.button>
  );
}
