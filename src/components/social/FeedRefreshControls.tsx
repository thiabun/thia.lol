import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "../ui/Button";
import { IconButton } from "../ui/IconButton";
import { StatusChip } from "../ui/StatusChip";
import { cn } from "../../lib/classNames";

type FeedRefreshControlsProps = {
  className?: string;
  disabled?: boolean;
  lastLoadedAt: number | undefined;
  onRefresh: () => Promise<void> | void;
  refreshError: Error | undefined;
  refreshing: boolean;
  testId?: string;
};

export function FeedRefreshControls({
  className,
  disabled = false,
  lastLoadedAt,
  onRefresh,
  refreshError,
  refreshing,
  testId = "feed-refresh-controls",
}: FeedRefreshControlsProps) {
  return (
    <div className={cn("space-y-2", className)} data-testid={testId}>
      <div className="flex flex-wrap items-center gap-2">
        <IconButton
          label={refreshing ? "Refreshing" : "Refresh"}
          size="md"
          disabled={disabled || refreshing}
          icon={
            <RefreshCw
              aria-hidden="true"
              size={16}
              className={refreshing ? "animate-spin motion-reduce:animate-none" : undefined}
            />
          }
          onClick={() => void onRefresh()}
        />

        {lastLoadedAt ? (
          <StatusChip
            tone={refreshing ? "loading" : "success"}
            data-testid={`${testId}-updated`}
            aria-live="polite"
          >
            {refreshing ? "Refreshing..." : formatLoadedAt(lastLoadedAt)}
          </StatusChip>
        ) : null}
      </div>

      {refreshError ? (
        <div
          className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-card border border-rose/30 bg-rose/10 px-3 py-2 text-sm text-rose-ink"
          data-testid={`${testId}-error`}
          role="status"
        >
          <AlertCircle aria-hidden="true" size={15} />
          <span>Could not refresh.</span>
          <Button
            type="button"
            variant="quiet"
            size="sm"
            className="min-h-0 px-1 py-0 text-rose-ink hover:text-rose-ink"
            onClick={() => void onRefresh()}
          >
            Retry
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function formatLoadedAt(timestamp: number) {
  const seconds = Math.max(0, Math.round((Date.now() - timestamp) / 1000));

  if (seconds < 60) {
    return "Updated just now";
  }

  const minutes = Math.round(seconds / 60);

  if (minutes < 60) {
    return `Updated ${minutes}m ago`;
  }

  const hours = Math.round(minutes / 60);

  return `Updated ${hours}h ago`;
}
