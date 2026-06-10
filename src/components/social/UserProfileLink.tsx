import type { MouseEventHandler, ReactNode } from "react";
import { Link } from "react-router";
import { cn } from "../../lib/classNames";
import type { User } from "../../lib/types";
import { Avatar } from "../ui/Avatar";

type ProfileLinkUser = Pick<
  User,
  "handle" | "displayName" | "initials" | "aura" | "avatarUrl"
>;

function profilePath(handle: string): string {
  return `/@${handle}`;
}

type InlineUserProfileLinkProps = {
  user: Pick<User, "handle" | "displayName">;
  children?: ReactNode;
  className?: string;
  onClick?: MouseEventHandler<HTMLAnchorElement>;
};

export function InlineUserProfileLink({
  children,
  className,
  onClick,
  user,
}: InlineUserProfileLinkProps) {
  return (
    <Link
      to={profilePath(user.handle)}
      className={cn(
        "font-medium text-text underline-offset-4 hover:text-accent-strong hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
        className,
      )}
      onClick={onClick}
    >
      {children ?? `${user.displayName} (@${user.handle})`}
    </Link>
  );
}

type UserIdentityLinkProps = {
  user: ProfileLinkUser;
  avatarSize?: "sm" | "md" | "lg";
  className?: string;
  avatarClassName?: string;
  showAvatar?: boolean;
  subtitle?: ReactNode;
  onClick?: MouseEventHandler<HTMLAnchorElement>;
};

export function UserIdentityLink({
  avatarClassName,
  avatarSize = "sm",
  className,
  onClick,
  showAvatar = true,
  subtitle,
  user,
}: UserIdentityLinkProps) {
  return (
    <Link
      to={profilePath(user.handle)}
      aria-label={`${user.displayName}'s profile`}
      className={cn(
        "group flex min-w-0 items-center gap-3 rounded-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
        className,
      )}
      onClick={onClick}
    >
      {showAvatar ? (
        <Avatar
          user={user}
          size={avatarSize}
          {...(avatarClassName ? { className: avatarClassName } : {})}
        />
      ) : null}
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold text-text group-hover:text-accent-strong group-hover:underline">
          {user.displayName}
        </span>
        {subtitle === null ? null : (
          <span className="block truncate text-xs text-muted">
            {subtitle ?? `@${user.handle}`}
          </span>
        )}
      </span>
    </Link>
  );
}
