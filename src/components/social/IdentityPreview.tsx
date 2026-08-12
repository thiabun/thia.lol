import { Avatar } from "../ui/Avatar";
import { cn } from "../../lib/classNames";

type IdentityPreviewProps = {
  className?: string | undefined;
  displayName: string;
  handle: string;
  label?: string | undefined;
  showUrl?: boolean | undefined;
};

export function IdentityPreview({
  className,
  displayName,
  handle,
  label = "Your public identity",
  showUrl = true,
}: IdentityPreviewProps) {
  const resolvedDisplayName = displayName.trim() || "Display Name";
  const resolvedHandle = normalizePreviewHandle(handle) || "handle";

  return (
    <div
      className={cn("flex min-w-0 items-center gap-3", className)}
      data-testid="identity-preview"
    >
      <Avatar
        accessibleLabel="Identity preview avatar"
        user={{
          aura: "ember",
          avatarUrl: null,
          displayName: resolvedDisplayName,
          initials: displayNameInitials(resolvedDisplayName),
        }}
        className="ring-2 ring-surface/80"
      />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold uppercase tracking-[0.1em] text-muted">
          {label}
        </p>
        <p
          className="mt-0.5 truncate text-base font-semibold leading-tight text-text"
          data-testid="identity-preview-display-name"
        >
          {resolvedDisplayName}
        </p>
        <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-sm text-muted">
          <span
            className="font-medium"
            data-testid="identity-preview-handle"
          >
            @{resolvedHandle}
          </span>
          {showUrl ? (
            <span
              className="min-w-0 truncate text-xs text-muted"
              data-testid="identity-preview-url"
            >
              thia.lol/@{resolvedHandle}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function normalizePreviewHandle(value: string): string {
  return value.trim().replace(/^@/u, "").toLowerCase();
}

function displayNameInitials(value: string): string {
  const initials = value
    .trim()
    .split(/\s+/u)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => Array.from(part)[0] ?? "")
    .join("")
    .toUpperCase();

  return initials || "?";
}
