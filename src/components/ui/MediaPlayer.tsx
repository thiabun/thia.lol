import { ExternalLink, Music2, Pause, Play } from "lucide-react";
import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../../lib/classNames";

export type MediaPlayerLayout = "compact" | "row" | "rich";
export type MediaPlayerVariant = "surface" | "soft";

type MediaPlayerTestIds = {
  artwork?: string;
  artworkFrame?: string;
  openLink?: string;
  playButton?: string;
  progressBar?: string;
  progressTime?: string;
  status?: string;
};

type MediaPlayerRootProps = Omit<HTMLAttributes<HTMLDivElement>, "children"> &
  Record<`data-${string}`, boolean | number | string | undefined>;

type MediaPlayerProps = {
  artworkAlt?: string;
  artworkUrl?: string | null;
  children?: ReactNode;
  className?: string;
  disabled?: boolean;
  href?: string | null;
  ignoreThreadOpen?: boolean;
  layout?: MediaPlayerLayout;
  onPlayToggle: () => void;
  openLabel?: string;
  playing: boolean;
  playLabel?: string;
  pauseLabel?: string;
  progressAriaLabel: string;
  progressLabel: string;
  progressPercent: number;
  rootProps?: MediaPlayerRootProps;
  statusLabel: string;
  subtitle?: string | null;
  testIdPrefix: string;
  testIds?: MediaPlayerTestIds;
  title: string;
  variant?: MediaPlayerVariant;
};

export function MediaPlayer({
  artworkAlt = "",
  artworkUrl,
  children,
  className,
  disabled = false,
  href,
  ignoreThreadOpen = false,
  layout = "row",
  onPlayToggle,
  openLabel,
  pauseLabel,
  playing,
  playLabel,
  progressAriaLabel,
  progressLabel,
  progressPercent,
  rootProps,
  statusLabel,
  subtitle,
  testIdPrefix,
  testIds,
  title,
  variant = "surface",
}: MediaPlayerProps) {
  const compact = layout === "compact";
  const rich = layout === "rich";
  const ids = {
    artwork: testIds?.artwork ?? `${testIdPrefix}-artwork`,
    artworkFrame: testIds?.artworkFrame ?? `${testIdPrefix}-artwork-frame`,
    openLink: testIds?.openLink ?? `${testIdPrefix}-open-link`,
    playButton: testIds?.playButton ?? `${testIdPrefix}-play-button`,
    progressBar: testIds?.progressBar ?? `${testIdPrefix}-progress-bar`,
    progressTime: testIds?.progressTime ?? `${testIdPrefix}-progress-time`,
    root: rootProps?.["data-testid"] ?? `${testIdPrefix}-player`,
    status: testIds?.status ?? `${testIdPrefix}-status`,
  };

  return (
    <>
      <div
        {...rootProps}
        className={cn(
          "relative isolate min-w-0 overflow-hidden rounded-card border border-line text-left shadow-inner-soft transition duration-fluid ease-fluid",
          variant === "soft" ? "bg-canvas/62" : "bg-surface/74",
          "hover:border-line-strong",
          rich ? "flex h-full min-h-0" : undefined,
          className,
          rootProps?.className,
        )}
        data-testid={ids.root}
      >
        <div
          className={cn(
            "flex min-h-0 w-full min-w-0 items-center",
            compact ? "gap-2 p-2" : rich ? "gap-3 p-3 sm:gap-4 sm:p-4" : "gap-3 p-2.5 sm:p-3",
          )}
        >
          <span
            className={cn(
              "grid shrink-0 place-items-center overflow-hidden rounded-card border border-line bg-canvas/68 text-muted shadow-inner-soft",
              compact ? "size-12" : rich ? "size-16 sm:size-20" : "size-16",
            )}
            data-testid={ids.artworkFrame}
          >
            {artworkUrl ? (
              <img
                alt={artworkAlt}
                className="size-full object-cover"
                decoding="async"
                loading="lazy"
                src={artworkUrl}
                data-testid={ids.artwork}
              />
            ) : (
              <Music2 aria-hidden="true" size={compact ? 19 : 22} />
            )}
          </span>

          <div className="grid min-w-0 flex-1 gap-2">
            <div className="min-w-0">
              <span
                className={cn(
                  "block font-semibold leading-snug text-text",
                  compact ? "truncate text-sm" : "line-clamp-2 text-sm sm:text-base",
                )}
              >
                {title}
              </span>
              {subtitle ? (
                <span className="mt-0.5 block truncate text-xs leading-5 text-muted">
                  {subtitle}
                </span>
              ) : null}
            </div>

            <div className="flex min-w-0 items-center gap-2.5">
              <button
                type="button"
                className={cn(
                  "grid shrink-0 place-items-center rounded-full border border-accent/28 bg-accent text-accent-contrast shadow-soft transition duration-fluid ease-fluid",
                  "hover:-translate-y-0.5 hover:bg-accent-strong hover:shadow-lift focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
                  "disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:translate-y-0",
                  compact ? "size-8" : "size-9",
                )}
                aria-label={playing ? (pauseLabel ?? `Pause ${title}`) : (playLabel ?? `Play ${title}`)}
                data-thread-open-ignore={ignoreThreadOpen ? true : undefined}
                data-testid={ids.playButton}
                disabled={disabled}
                onClick={onPlayToggle}
              >
                {playing ? (
                  <Pause aria-hidden="true" size={compact ? 15 : 17} />
                ) : (
                  <Play aria-hidden="true" size={compact ? 15 : 17} />
                )}
              </button>

              <div className="grid min-w-0 flex-1 gap-1">
                <div className="h-1.5 overflow-hidden rounded-full bg-line/72">
                  <div
                    className="h-full rounded-full bg-accent transition-[width] duration-fluid ease-fluid"
                    role="progressbar"
                    aria-label={progressAriaLabel}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(progressPercent)}
                    style={{ width: `${progressPercent}%` }}
                    data-testid={ids.progressBar}
                  />
                </div>
                <span
                  className="truncate text-xs font-medium tabular-nums leading-none text-muted"
                  data-testid={ids.progressTime}
                >
                  {progressLabel}
                </span>
              </div>

              {href ? (
                <a
                  aria-label={openLabel ?? `Open ${title}`}
                  className={cn(
                    "grid size-8 shrink-0 place-items-center rounded-control border border-line bg-surface/72 text-muted shadow-inner-soft transition duration-fluid ease-fluid",
                    "hover:border-line-strong hover:bg-surface hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
                  )}
                  data-thread-open-ignore={ignoreThreadOpen ? true : undefined}
                  data-testid={ids.openLink}
                  href={href}
                  rel="noopener noreferrer"
                  target={href.startsWith("/") ? undefined : "_blank"}
                >
                  <ExternalLink aria-hidden="true" size={15} />
                </a>
              ) : null}
            </div>
          </div>
        </div>

        <span className="sr-only" data-testid={ids.status}>
          {statusLabel}
        </span>
      </div>
      {children ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute size-px overflow-hidden opacity-0"
          tabIndex={-1}
        >
          {children}
        </div>
      ) : null}
    </>
  );
}
