import type { ReactNode } from "react";
import { Link, type LinkProps } from "react-router";
import { motion } from "motion/react";
import { cn } from "../../lib/classNames";
import { buttonTap } from "../../lib/motionPresets";
import type { HTMLMotionProps } from "motion/react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "quiet" | "danger";
type ButtonSize = "sm" | "md" | "icon";

const base =
  "items-center justify-center gap-2 font-medium transition duration-fluid ease-fluid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:pointer-events-none disabled:opacity-50";

const defaultDisplay = "inline-flex";
const displayClassPattern =
  /(^|\s)(hidden|block|inline|inline-block|flex|inline-flex|grid|inline-grid)(\s|$)/;

const variants: Record<ButtonVariant, string> = {
  primary:
    "bg-accent text-accent-contrast shadow-soft hover:bg-accent-strong",
  secondary:
    "border border-line/86 bg-surface/72 text-text shadow-inner-soft hover:border-line-strong hover:bg-surface/92",
  ghost:
    "text-muted hover:bg-surface-strong/68 hover:text-text",
  quiet: "text-text underline-offset-4 hover:text-accent-strong hover:underline",
  danger:
    "border border-rose/35 bg-rose/15 text-rose-ink shadow-inner-soft hover:border-rose/55 hover:bg-rose/20",
};

const sizes: Record<ButtonSize, string> = {
  sm: "min-h-8 px-2.5 text-sm",
  md: "min-h-10 px-3 text-sm",
  icon: "size-9 p-0",
};

const shapes: Record<ButtonSize, string> = {
  sm: "rounded-control",
  md: "rounded-control",
  icon: "rounded-full",
};

type ButtonProps = Omit<HTMLMotionProps<"button">, "children"> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
  children?: ReactNode;
};

export function Button({
  className,
  variant = "primary",
  size = "md",
  icon,
  children,
  whileHover,
  whileTap,
  ...props
}: ButtonProps) {
  const isInteractive = !props.disabled;
  const resolvedWhileHover = whileHover;
  const resolvedWhileTap = whileTap ?? (isInteractive ? buttonTap : undefined);
  const motionProps = {
    ...(resolvedWhileHover ? { whileHover: resolvedWhileHover } : {}),
    ...(resolvedWhileTap ? { whileTap: resolvedWhileTap } : {}),
  };
  const displayClass =
    typeof className === "string" && displayClassPattern.test(className)
      ? undefined
      : defaultDisplay;

  return (
    <motion.button
      className={cn(
        displayClass,
        base,
        shapes[size],
        variants[variant],
        sizes[size],
        className,
      )}
      {...motionProps}
      {...props}
    >
      {icon}
      {children}
    </motion.button>
  );
}

type ButtonLinkProps = LinkProps & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
};

export function ButtonLink({
  className,
  variant = "primary",
  size = "md",
  icon,
  children,
  ...props
}: ButtonLinkProps) {
  const displayClass =
    typeof className === "string" && displayClassPattern.test(className)
      ? undefined
      : defaultDisplay;

  return (
    <Link
      className={cn(
        displayClass,
        base,
        shapes[size],
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {icon}
      {children}
    </Link>
  );
}
