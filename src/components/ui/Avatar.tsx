import { cn } from "../../lib/classNames";
import type { User } from "../../lib/types";

type AvatarProps = {
  user: Pick<User, "displayName" | "initials" | "aura">;
  size?: "sm" | "md" | "lg";
  className?: string;
};

const sizes = {
  sm: "size-9 text-xs",
  md: "size-11 text-sm",
  lg: "size-20 text-xl",
};

const auras: Record<string, string> = {
  sunlit: "from-warm via-surface to-leaf",
  ember: "from-rose via-warm to-surface",
  frost: "from-cool via-surface to-leaf",
  tide: "from-leaf via-cool to-surface",
};

export function Avatar({ user, size = "md", className }: AvatarProps) {
  return (
    <div
      aria-label={user.displayName}
      role="img"
      className={cn(
        "grid shrink-0 place-items-center rounded-full border border-white/35 bg-gradient-to-br text-text shadow-soft",
        sizes[size],
        auras[user.aura] ?? auras.tide,
        className,
      )}
      title={user.displayName}
    >
      <span className="font-semibold">{user.initials}</span>
    </div>
  );
}
