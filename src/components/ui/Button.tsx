import type { ReactNode } from "react";
import { Link, type LinkProps } from "react-router";
import { motion } from "motion/react";
import { cn } from "../../lib/classNames";
import { buttonHover, buttonTap } from "../../lib/motionPresets";
import type { HTMLMotionProps } from "motion/react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "quiet";
type ButtonSize = "sm" | "md" | "icon";

const base =
  "items-center justify-center gap-2 rounded-control font-medium transition duration-fluid ease-fluid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:pointer-events-none disabled:opacity-50";

const defaultDisplay = "inline-flex";
const displayClassPattern =
  /(^|\s)(hidden|block|inline|inline-block|flex|inline-flex|grid|inline-grid)(\s|$)/;

const variants: Record<ButtonVariant, string> = {
  primary:
    "bg-accent text-accent-ink shadow-soft hover:-translate-y-0.5 hover:shadow-lift motion-reduce:hover:translate-y-0",
  secondary:
    "border border-line bg-surface text-text shadow-soft hover:-translate-y-0.5 hover:border-line-strong motion-reduce:hover:translate-y-0",
  ghost:
    "text-muted hover:bg-surface-strong hover:text-text",
  quiet: "text-text underline-offset-4 hover:text-accent-strong hover:underline",
};

const sizes: Record<ButtonSize, string> = {
  sm: "min-h-9 px-3 text-sm",
  md: "min-h-11 px-4 text-sm",
  icon: "size-10 p-0",
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
  const resolvedWhileHover = whileHover ?? (isInteractive ? buttonHover : undefined);
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
      className={cn(displayClass, base, variants[variant], sizes[size], className)}
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
      className={cn(displayClass, base, variants[variant], sizes[size], className)}
      {...props}
    >
      {icon}
      {children}
    </Link>
  );
}
