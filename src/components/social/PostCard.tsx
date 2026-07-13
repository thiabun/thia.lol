import {
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react";
import {
  EyeOff,
  Heart,
  MessageCircle,
  Repeat2,
  Share2,
  Trash2,
  WifiOff,
} from "lucide-react";
import { Link, useNavigate } from "react-router";
import { motion } from "motion/react";
import { Avatar } from "../ui/Avatar";
import { FocusAutoplayVideo } from "../ui/FocusAutoplayVideo";
import { MediaPlayer, type MediaPlayerLayout } from "../ui/MediaPlayer";
import { Panel } from "../ui/Panel";
import { InlineUserProfileLink } from "./UserProfileLink";
import { PostShareModal } from "./PostShareModal";
import { ReportForm } from "./ReportForm";
import { RichText } from "./RichText";
import {
  deletePost,
  likePost,
  postCanonicalPath,
  reblogPost,
  unreblogPost,
  unlikePost,
} from "../../lib/api";
import { cn } from "../../lib/classNames";
import {
  attachSpotifyPlaybackListeners,
  emptySpotifyPlaybackProgress,
  formatSpotifyPlaybackTime,
  loadSpotifyIframeApi,
  spotifyPlaybackProgressPercent,
  spotifyResourceUri,
  toggleSpotifyPlayback,
  type SpotifyEmbedController,
  type SpotifyPlaybackProgress,
} from "../../lib/spotifyIframe";
import {
  buttonHover,
  buttonTap,
  cardEntrance,
  cardHover,
  cardTap,
  pulsePop,
  softSpring,
} from "../../lib/motionPresets";
import type { Post, PostAttachment } from "../../lib/types";
import { useAuth } from "../../lib/useAuth";
import { canDeletePost } from "../../lib/postPermissions";

export type PostCardVariant = "feed" | "focus" | "reply";

export type PostCardProps = {
  post: Post;
  index?: number;
  variant?: PostCardVariant;
  depth?: number;
  highlighted?: boolean;
  canDelete?: boolean;
  canHide?: boolean;
  actionPending?: boolean;
  onDelete?: (post: Post) => void;
  onDeleted?: ((post: Post) => void) | undefined;
  onHide?: (post: Post) => void;
  onReplyAction?: () => void;
  staticCapture?: boolean;
};

export function PostCard({
  post,
  index = 0,
  variant = "feed",
  depth = 0,
  highlighted = false,
  canDelete = false,
  canHide = false,
  actionPending = false,
  onDelete,
  onDeleted,
  onHide,
  onReplyAction,
  staticCapture = false,
}: PostCardProps) {
  const navigate = useNavigate();
  const { runWithAuth, user } = useAuth();
  const effectiveCanDelete = canDelete || canDeletePost(user, post);
  const showActions = effectiveCanDelete || canHide;
  const [localDeletePending, setLocalDeletePending] = useState(false);
  const [localDeleteError, setLocalDeleteError] = useState<string>();
  const [locallyDeleted, setLocallyDeleted] = useState(false);
  const [finePointerHover, setFinePointerHover] = useState(false);
  const isNavigableFeed = variant === "feed";
  const canonicalPath = postCanonicalPath(post);

  useEffect(() => {
    const query = window.matchMedia("(hover: hover) and (pointer: fine)");
    const sync = () => setFinePointerHover(query.matches);

    sync();
    query.addEventListener("change", sync);

    return () => query.removeEventListener("change", sync);
  }, []);

  async function handleDeletePost(): Promise<boolean> {
    if (!effectiveCanDelete || actionPending || localDeletePending) {
      return false;
    }

    if (onDelete) {
      onDelete(post);
      return true;
    }

    setLocalDeletePending(true);
    setLocalDeleteError(undefined);

    try {
      await runWithAuth(
        (freshCsrfToken) => deletePost(post.id, freshCsrfToken),
        { retryOnCsrf: true },
      );
      setLocallyDeleted(true);
      onDeleted?.(post);
      return true;
    } catch (error) {
      setLocalDeleteError(
        error instanceof Error ? error.message : "Post could not be deleted.",
      );
      return false;
    } finally {
      setLocalDeletePending(false);
    }
  }

  function openCanonicalPost(options?: { compose?: boolean }) {
    if (options?.compose && onReplyAction) {
      onReplyAction();
      return;
    }

    navigate(canonicalPath, {
      state: options?.compose ? { openComposer: true } : undefined,
    });
  }

  function handleCardClick(event: ReactMouseEvent<HTMLElement>) {
    if (
      !isNavigableFeed ||
      isCardNavigationIgnoredTarget(event.target) ||
      isCardNavigationIgnoredEvent(event.nativeEvent)
    ) {
      return;
    }

    openCanonicalPost();
  }

  const cardMotionProps = !isNavigableFeed
    ? {}
    : {
        ...(finePointerHover ? { whileHover: cardHover } : {}),
        whileTap: cardTap,
      };

  if (locallyDeleted) {
    return null;
  }

  const content = (
    <>
      {post.rebloggedBy ? (
        <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-muted">
          <Repeat2 aria-hidden="true" size={14} />
          <span>
            <InlineUserProfileLink user={post.rebloggedBy}>
              @{post.rebloggedBy.handle}
            </InlineUserProfileLink>{" "}
            reblogged
          </span>
        </div>
      ) : null}

      <div className="flex min-w-0 items-start gap-3">
        <Link
          to={`/@${post.author.handle}`}
          aria-label={`${post.author.displayName}'s profile`}
          className={cn(
            "shrink-0 rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
            variant === "reply" && "origin-top-left scale-[0.92]",
          )}
        >
          <Avatar user={post.author} />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <Link
              to={`/@${post.author.handle}`}
              className="min-w-0 truncate text-sm font-semibold text-text underline-offset-4 hover:text-accent-strong hover:underline"
            >
              {post.author.displayName}
            </Link>
            <Link
              to={`/@${post.author.handle}`}
              className="truncate text-sm text-muted underline-offset-4 hover:text-accent-strong hover:underline"
            >
              @{post.author.handle}
            </Link>
            <span aria-hidden="true" className="text-muted/45">·</span>
            <Link
              to={canonicalPath}
              className="text-xs text-muted underline-offset-4 hover:text-accent-strong hover:underline"
              aria-label={`Open post from ${post.createdAt}`}
            >
              {post.createdAt}
            </Link>
          </div>
          <PostDestinationLine post={post} />
        </div>
      </div>

      <div
        data-testid="post-body-open-thread"
        className={cn(
          "block min-w-0 w-full max-w-full text-left",
          variant === "reply" ? "mt-2 pl-[3.25rem]" : "mt-3",
        )}
      >
        <RichText
          text={post.body}
          entities={post.bodyEntities}
          markdown={post.bodyFormat === "markdown"}
          staticEmbeds={staticCapture}
          className={cn(
            "block whitespace-pre-wrap break-words text-pretty text-text",
            variant === "focus"
              ? "text-base leading-7 sm:text-[1.0625rem] sm:leading-8"
              : "text-[0.95rem] leading-6",
          )}
        />
        <PostAttachments
          className="mt-3"
          maxHeightClass={
            variant === "focus"
              ? "max-h-[min(76vh,40rem)]"
              : "max-h-[min(70vh,34rem)]"
          }
          musicLayout={variant === "reply" ? "compact" : "responsive"}
          post={post}
          staticCapture={staticCapture}
        />
      </div>

      <div className={variant === "reply" ? "pl-[3.25rem]" : undefined}>
        <ReactionControls
          key={`${post.id}:${post.likeCount}:${post.likedByCurrentUser}:${post.reblogCount}:${post.rebloggedByMe}:${post.rebloggedByCurrentUser}`}
          post={post}
          commentCount={post.commentCount}
          initialLikeCount={post.likeCount}
          initiallyLiked={post.likedByCurrentUser}
          onReply={() => openCanonicalPost({ compose: true })}
          actions={
            showActions ? (
              <>
                {canHide ? (
                  <PostActionIconButton
                    label="Hide post"
                    disabled={actionPending}
                    icon={<EyeOff aria-hidden="true" size={15} />}
                    onClick={() => onHide?.(post)}
                  />
                ) : null}
                {effectiveCanDelete ? (
                  <PostActionIconButton
                    label={variant === "reply" ? "Delete reply" : "Delete post"}
                    disabled={actionPending || localDeletePending}
                    variant="danger"
                    icon={<Trash2 aria-hidden="true" size={15} />}
                    onClick={() => void handleDeletePost()}
                  />
                ) : null}
              </>
            ) : null
          }
        />
      </div>

      {localDeleteError ? (
        <p
          className={cn(
            "mt-3 rounded-card border border-rose/30 bg-rose/15 p-3 text-sm text-rose-ink",
            variant === "reply" && "ml-[3.25rem]",
          )}
        >
          {localDeleteError}
        </p>
      ) : null}
    </>
  );

  return (
    <motion.article
      id={`post-${post.id}`}
      aria-label={
        `Post by ${post.author.displayName}`
      }
      className={cn(
        "group relative mx-auto min-w-0 w-full",
        variant === "focus" ? "max-w-[44rem]" : "max-w-[38rem]",
        isNavigableFeed && "cursor-pointer",
        variant === "reply" && "py-3 pr-1",
        highlighted &&
          "rounded-panel ring-2 ring-accent/35 ring-offset-2 ring-offset-canvas",
      )}
      data-depth={depth}
      data-render-deferred={variant === "reply" ? "post-reply" : "post"}
      data-testid="post-card-open-thread"
      data-variant={variant}
      variants={cardEntrance}
      custom={index}
      initial="hidden"
      animate="show"
      onClick={handleCardClick}
      {...cardMotionProps}
    >
      {isNavigableFeed ? (
        <Link
          to={canonicalPath}
          className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-30 focus:rounded-control focus:bg-surface focus:px-3 focus:py-2 focus:text-sm focus:font-semibold focus:text-text focus:shadow-soft focus:outline-2 focus:outline-offset-2 focus:outline-focus"
        >
          Open thread by {post.author.displayName}
        </Link>
      ) : null}
      {variant === "reply" ? (
        content
      ) : (
        <Panel
          elevated={variant === "focus"}
          interactive={isNavigableFeed}
          className={cn(
            "min-w-0 max-w-full overflow-hidden p-3 sm:p-4",
            variant === "focus" && "p-4 sm:p-5",
          )}
        >
          {content}
        </Panel>
      )}
    </motion.article>
  );
}

const cardNavigationIgnoreSelector = [
  "a",
  "button",
  "input",
  "iframe",
  "video",
  "audio",
  "textarea",
  "select",
  "option",
  "label",
  "summary",
  "form",
  "[contenteditable='true']",
  "[role='button']",
  "[role='link']",
  "[data-thread-open-ignore]",
].join(",");

function isCardNavigationIgnoredEvent(event: Event) {
  return event.composedPath().some(
    (node) =>
      node instanceof Element && Boolean(node.closest(cardNavigationIgnoreSelector)),
  );
}

function isCardNavigationIgnoredTarget(target: EventTarget | null) {
  if (!(target instanceof Element)) {
    return true;
  }

  return Boolean(target.closest(cardNavigationIgnoreSelector));
}

function stopCardNavigationPropagation(event: ReactMouseEvent<HTMLElement>) {
  event.stopPropagation();
}


export type PostAttachmentsProps = {
  className?: string;
  maxHeightClass?: string;
  musicLayout?: PostMusicLayout;
  post: Post;
  staticCapture?: boolean;
  testId?: string;
};

type PostMusicLayout = "compact" | "responsive";

export function PostAttachments({
  className = "mt-4",
  maxHeightClass = "max-h-[min(70vh,34rem)]",
  musicLayout = "responsive",
  post,
  staticCapture = false,
  testId = "post-attachments",
}: PostAttachmentsProps) {
  const attachments = postAttachmentsForDisplay(post);
  const hasPlayerAttachment = attachments.some(isPostMusicAttachment);

  if (attachments.length === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        "grid min-w-0 w-full max-w-full gap-2",
        attachments.length > 1 && !hasPlayerAttachment ? "sm:grid-cols-2" : null,
        className,
      )}
      data-testid={testId}
    >
      {attachments.map((attachment, index) => (
        <PostAttachmentItem
          key={`${attachment.kind}-${attachment.url ?? attachment.sourceUrl ?? index}-${index}`}
          attachment={attachment}
          index={index}
          maxHeightClass={maxHeightClass}
          musicLayout={musicLayout}
          staticCapture={staticCapture}
          testId={`${testId}-${index}`}
        />
      ))}
    </div>
  );
}

function PostAttachmentItem({
  attachment,
  index,
  maxHeightClass,
  musicLayout,
  staticCapture,
  testId,
}: {
  attachment: PostAttachment;
  index: number;
  maxHeightClass: string;
  musicLayout: PostMusicLayout;
  staticCapture: boolean;
  testId: string;
}) {
  if (attachment.kind === "integration") {
    if (isPostMusicAttachment(attachment)) {
      if (staticCapture) {
        return (
          <PostStaticMusicAttachment
            attachment={attachment}
            index={index}
            layout={musicLayout}
            testId={testId}
          />
        );
      }

      return (
        <PostMusicPlayerAttachment
          attachment={attachment}
          index={index}
          layout={musicLayout}
          testId={testId}
        />
      );
    }

    return <PostIntegrationAttachment attachment={attachment} testId={testId} />;
  }

  if (attachment.kind === "gif") {
    const title = gifAttachmentTitle(attachment);

    return (
      <span
        className="block min-w-0 w-full max-w-full [contain:inline-size]"
        data-testid={testId}
      >
        <span
          className={cn(
            "flex w-fit max-w-full overflow-hidden rounded-card border border-line bg-canvas/70",
            maxHeightClass,
          )}
          style={postAttachmentAspectRatio(attachment)}
        >
          {attachment.url ? (
            <img
              src={attachment.url}
              alt={title}
              className={cn(
                "block min-w-0 max-w-full object-contain",
                postAttachmentAspectRatio(attachment) ? "size-full" : "h-auto w-auto",
                maxHeightClass,
              )}
              loading="lazy"
              decoding="async"
              data-testid={`${testId}-gif`}
            />
          ) : null}
        </span>
      </span>
    );
  }

  if (!attachment.url || attachment.url === "/ambient-veil.webp") {
    return null;
  }

  if (attachment.kind === "audio") {
    if (staticCapture) {
      return (
        <PostStaticMusicAttachment
          attachment={attachment}
          index={index}
          layout={musicLayout}
          testId={testId}
        />
      );
    }

    return (
      <PostMusicPlayerAttachment
        attachment={attachment}
        index={index}
        layout={musicLayout}
        testId={testId}
      />
    );
  }

  const isVideo = attachment.kind === "video";

  return (
    <span
      className="block min-w-0 w-full max-w-full [contain:inline-size]"
      data-thread-open-ignore={isVideo ? true : undefined}
      data-testid={testId}
      onClick={isVideo ? stopCardNavigationPropagation : undefined}
    >
      <span
        className={cn(
          "flex w-fit max-w-full overflow-hidden rounded-card border border-line bg-canvas/70",
          maxHeightClass,
        )}
        style={postAttachmentAspectRatio(attachment, isVideo)}
      >
        {isVideo && staticCapture ? (
          attachment.posterUrl ? (
            <img
              alt=""
              className="block size-full min-w-0 max-w-full bg-black object-contain"
              data-post-capture-video-poster="true"
              data-testid={`${testId}-video-poster`}
              decoding="async"
              loading="lazy"
              src={attachment.posterUrl}
            />
          ) : (
            <span
              className="grid size-full min-h-28 place-items-center bg-black text-xs font-semibold uppercase tracking-[0.14em] text-white/70"
              data-post-capture-video-fallback="true"
            >
              Video
            </span>
          )
        ) : isVideo ? (
          <FocusAutoplayVideo
            className="block size-full min-w-0 max-w-full bg-black object-contain"
            poster={attachment.posterUrl ?? undefined}
            data-testid={`${testId}-video`}
          >
            <source src={attachment.url} type={attachment.mime ?? (attachment.url.endsWith(".webm") ? "video/webm" : "video/mp4")} />
          </FocusAutoplayVideo>
        ) : (
          <img
            src={attachment.url}
            alt=""
            className={cn(
              "block min-w-0 max-w-full object-contain",
              postAttachmentAspectRatio(attachment) ? "size-full" : "h-auto w-auto",
              maxHeightClass,
            )}
            loading="lazy"
            decoding="async"
            data-testid={`${testId}-image`}
          />
        )}
      </span>
    </span>
  );
}

function postAttachmentAspectRatio(
  attachment: PostAttachment,
  videoFallback = false,
): { aspectRatio: string; width: string } | undefined {
  const width = attachment.width ?? 0;
  const height = attachment.height ?? 0;

  if (width > 0 && height > 0) {
    const ratio = width / height;

    return {
      aspectRatio: `${width} / ${height}`,
      width:
        ratio >= 1
          ? "100%"
          : `min(100%, calc(min(70vh, 34rem) * ${ratio}))`,
    };
  }

  return videoFallback
    ? { aspectRatio: "16 / 9", width: "100%" }
    : undefined;
}

function gifAttachmentTitle(attachment: PostAttachment): string {
  const card = attachment.card;

  if (card && typeof card === "object" && !Array.isArray(card)) {
    const title = (card as Record<string, unknown>).title;

    if (typeof title === "string" && title.trim() !== "") {
      return title.trim();
    }
  }

  return "KLIPY GIF";
}

type PostMusicAttachmentDetails = {
  description: string | null;
  href: string | null;
  imageUrl: string | null;
  provider: "mp3" | "spotify" | "youtube";
  providerLabel: string;
  resourceId: string | null;
  resourceType: string | null;
  subtitle: string | null;
  title: string;
  youtubeFrame: PostYouTubeMusicFrame | null;
};

type PostYouTubeMusicFrame = {
  allow: string;
  src: string;
  title: string;
};

type PostMusicPlayerShellProps = {
  children?: ReactNode;
  details: PostMusicAttachmentDetails;
  disabled?: boolean;
  layout: PostMusicLayout;
  onPlayToggle: () => void;
  playing: boolean;
  progressLabel: string;
  progressPercent: number;
  statusLabel: string;
  testId: string;
};

function PostMusicPlayerAttachment({
  attachment,
  index,
  layout,
  testId,
}: {
  attachment: PostAttachment;
  index: number;
  layout: PostMusicLayout;
  testId: string;
}) {
  const details = postMusicAttachmentDetails(attachment, index);

  if (details.provider === "spotify") {
    return (
      <PostSpotifyMusicAttachment
        details={details}
        layout={layout}
        testId={testId}
      />
    );
  }

  if (details.provider === "youtube") {
    return (
      <PostYouTubeMusicAttachment
        details={details}
        layout={layout}
        testId={testId}
      />
    );
  }

  if (attachment.kind !== "audio" || !attachment.url) {
    return null;
  }

  return (
    <PostAudioMusicAttachment
      attachment={attachment}
      audioUrl={attachment.url}
      details={details}
      layout={layout}
      testId={testId}
    />
  );
}

function PostStaticMusicAttachment({
  attachment,
  index,
  layout,
  testId,
}: {
  attachment: PostAttachment;
  index: number;
  layout: PostMusicLayout;
  testId: string;
}) {
  const details = postMusicAttachmentDetails(attachment, index);

  return (
    <div
      className="pointer-events-none"
      data-post-capture-music-fallback={details.provider}
    >
      <PostMusicPlayerShell
        details={details}
        layout={layout}
        onPlayToggle={inertPostCaptureAction}
        playing={false}
        progressLabel="Ready"
        progressPercent={0}
        statusLabel="Ready"
        testId={testId}
      />
    </div>
  );
}

function inertPostCaptureAction() {}

function PostAudioMusicAttachment({
  attachment,
  audioUrl,
  details,
  layout,
  testId,
}: {
  attachment: PostAttachment;
  audioUrl: string;
  details: PostMusicAttachmentDetails;
  layout: PostMusicLayout;
  testId: string;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [duration, setDuration] = useState(attachment.durationSeconds ?? 0);
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const progressPercent =
    duration > 0 ? Math.min(100, Math.max(0, (position / duration) * 100)) : 0;
  const progressLabel = duration > 0
    ? `${formatPostMediaTime(position)} / ${formatPostMediaTime(duration)}`
    : playing
      ? "Playing"
      : "Ready";

  useEffect(() => {
    const element = audioRef.current;

    if (!element) {
      return undefined;
    }

    const mediaElement = element;

    function syncMetadata() {
      if (Number.isFinite(mediaElement.duration) && mediaElement.duration > 0) {
        setDuration(mediaElement.duration);
      }
    }

    function syncTime() {
      setPosition(
        Number.isFinite(mediaElement.currentTime) ? mediaElement.currentTime : 0,
      );
    }

    function syncPlaying() {
      setPlaying(!mediaElement.paused && !mediaElement.ended);
    }

    mediaElement.addEventListener("loadedmetadata", syncMetadata);
    mediaElement.addEventListener("durationchange", syncMetadata);
    mediaElement.addEventListener("timeupdate", syncTime);
    mediaElement.addEventListener("play", syncPlaying);
    mediaElement.addEventListener("pause", syncPlaying);
    mediaElement.addEventListener("ended", syncPlaying);
    syncMetadata();
    syncTime();
    syncPlaying();

    return () => {
      mediaElement.removeEventListener("loadedmetadata", syncMetadata);
      mediaElement.removeEventListener("durationchange", syncMetadata);
      mediaElement.removeEventListener("timeupdate", syncTime);
      mediaElement.removeEventListener("play", syncPlaying);
      mediaElement.removeEventListener("pause", syncPlaying);
      mediaElement.removeEventListener("ended", syncPlaying);
    };
  }, [audioUrl]);

  async function handlePlaybackToggle() {
    const element = audioRef.current;

    if (!element) {
      return;
    }

    if (playing) {
      element.pause();
      return;
    }

    try {
      await element.play();
    } catch {
      setPlaying(false);
    }
  }

  return (
    <PostMusicPlayerShell
      details={details}
      layout={layout}
      onPlayToggle={handlePlaybackToggle}
      playing={playing}
      progressLabel={progressLabel}
      progressPercent={progressPercent}
      statusLabel={playing ? "Playing" : "Ready"}
      testId={testId}
    >
      <audio
        ref={audioRef}
        className="sr-only"
        data-thread-open-ignore
        data-testid={`${testId}-audio`}
        preload="metadata"
        src={audioUrl}
      >
        <source src={audioUrl} type={attachment.mime ?? "audio/mpeg"} />
      </audio>
    </PostMusicPlayerShell>
  );
}

function PostSpotifyMusicAttachment({
  details,
  layout,
  testId,
}: {
  details: PostMusicAttachmentDetails;
  layout: PostMusicLayout;
  testId: string;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const controllerRef = useRef<SpotifyEmbedController | undefined>(undefined);
  const removePlaybackListenersRef = useRef<(() => void) | undefined>(undefined);
  const [controllerReady, setControllerReady] = useState(false);
  const [playbackProgress, setPlaybackProgress] = useState<SpotifyPlaybackProgress>(
    emptySpotifyPlaybackProgress,
  );
  const [playing, setPlaying] = useState(false);
  const [fallback, setFallback] = useState(false);
  const uri = spotifyResourceUri(details);

  useEffect(() => {
    const container = containerRef.current;

    if (!container || !uri) {
      setFallback(true);
      return undefined;
    }

    let canceled = false;
    setFallback(false);
    setControllerReady(false);
    setPlaying(false);
    setPlaybackProgress(emptySpotifyPlaybackProgress);
    removePlaybackListenersRef.current?.();
    removePlaybackListenersRef.current = undefined;
    controllerRef.current = undefined;
    container.replaceChildren();

    loadSpotifyIframeApi()
      .then((api) => {
        if (canceled) {
          return;
        }

        api.createController(
          container,
          {
            height: "80",
            theme: "0",
            uri,
            width: "100%",
          },
          (controller) => {
            if (canceled) {
              controller.destroy?.();
              return;
            }

            controllerRef.current = controller;
            removePlaybackListenersRef.current = attachSpotifyPlaybackListeners(
              controller,
              (progress) => {
                if (canceled) {
                  return;
                }

                setPlaybackProgress(progress);
                setPlaying(!progress.isPaused && !progress.isBuffering);
              },
            );
            decoratePostSpotifyProviderFrame(container, details.title, testId);
            setControllerReady(true);
          },
        );
      })
      .catch(() => {
        if (!canceled) {
          setFallback(true);
        }
      });

    return () => {
      canceled = true;
      removePlaybackListenersRef.current?.();
      removePlaybackListenersRef.current = undefined;
      controllerRef.current?.destroy?.();
      controllerRef.current = undefined;
      setControllerReady(false);
      container.replaceChildren();
    };
  }, [details.title, testId, uri]);

  useEffect(() => {
    if (!playing || !playbackProgress.known || playbackProgress.duration <= 0) {
      return undefined;
    }

    const interval = window.setInterval(() => {
      setPlaybackProgress((progress) => {
        if (
          progress.isPaused ||
          progress.isBuffering ||
          !progress.known ||
          progress.duration <= 0 ||
          progress.position >= progress.duration
        ) {
          return progress;
        }

        return {
          ...progress,
          position: Math.min(progress.duration, progress.position + 1000),
        };
      });
    }, 1000);

    return () => window.clearInterval(interval);
  }, [playbackProgress.duration, playbackProgress.known, playing]);

  async function handlePlaybackToggle() {
    const controller = controllerRef.current;

    if (fallback || !controller) {
      openPostMusicHref(details.href);
      return;
    }

    const nextPlaying = await toggleSpotifyPlayback(controller, playing);

    if (nextPlaying !== undefined) {
      setPlaying(nextPlaying);
    }
  }

  const progressPercent = spotifyPlaybackProgressPercent(playbackProgress);
  const statusText = fallback
    ? "Open to play"
    : playbackProgress.isBuffering
      ? "Buffering"
      : !controllerReady
        ? "Loading"
        : playing
          ? "Playing"
          : "Ready";
  const progressLabel = playbackProgress.known
    ? `${formatSpotifyPlaybackTime(playbackProgress.position)} / ${formatSpotifyPlaybackTime(
        playbackProgress.duration,
      )}`
    : statusText;

  return (
    <PostMusicPlayerShell
      details={details}
      disabled={!controllerReady && !(fallback && details.href)}
      layout={layout}
      onPlayToggle={handlePlaybackToggle}
      playing={playing}
      progressLabel={progressLabel}
      progressPercent={progressPercent}
      statusLabel={statusText}
      testId={testId}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute size-px overflow-hidden opacity-0"
        data-testid={`${testId}-provider-frame-spotify`}
      >
        <div ref={containerRef} />
      </div>
    </PostMusicPlayerShell>
  );
}

function PostYouTubeMusicAttachment({
  details,
  layout,
  testId,
}: {
  details: PostMusicAttachmentDetails;
  layout: PostMusicLayout;
  testId: string;
}) {
  const [playing, setPlaying] = useState(false);
  const [playerVersion, setPlayerVersion] = useState(0);
  const frameSrc = details.youtubeFrame
    ? postYouTubeMusicFrameSrc(details.youtubeFrame.src, playing, playerVersion)
    : null;

  function handlePlaybackToggle() {
    if (!details.youtubeFrame) {
      openPostMusicHref(details.href);
      return;
    }

    setPlaying((current) => !current);
    setPlayerVersion((version) => version + 1);
  }

  return (
    <PostMusicPlayerShell
      details={details}
      disabled={!details.youtubeFrame && !details.href}
      layout={layout}
      onPlayToggle={handlePlaybackToggle}
      playing={playing}
      progressLabel={playing ? "Playing" : "Ready"}
      progressPercent={playing ? 100 : 0}
      statusLabel={playing ? "Playing" : "Ready"}
      testId={testId}
    >
      {details.youtubeFrame && frameSrc ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute size-px overflow-hidden opacity-0"
          data-testid={`${testId}-provider-frame-youtube`}
        >
          <iframe
            key={frameSrc}
            allow={details.youtubeFrame.allow}
            allowFullScreen
            className="block size-full border-0 bg-black"
            data-testid={`${testId}-provider-iframe-youtube`}
            loading="lazy"
            referrerPolicy="strict-origin-when-cross-origin"
            sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-forms"
            src={frameSrc}
            title={details.youtubeFrame.title}
          />
        </div>
      ) : null}
    </PostMusicPlayerShell>
  );
}

function PostMusicPlayerShell({
  children,
  details,
  disabled = false,
  layout,
  onPlayToggle,
  playing,
  progressLabel,
  progressPercent,
  statusLabel,
  testId,
}: PostMusicPlayerShellProps) {
  const playerLayout: MediaPlayerLayout = layout === "compact" ? "compact" : "row";

  return (
    <MediaPlayer
      artworkUrl={details.imageUrl}
      disabled={disabled}
      href={details.href}
      ignoreThreadOpen
      layout={playerLayout}
      onPlayToggle={onPlayToggle}
      playing={playing}
      progressAriaLabel={`${details.providerLabel} playback progress`}
      progressLabel={progressLabel}
      progressPercent={progressPercent}
      rootProps={{
        "data-post-music-layout": layout,
        "data-post-music-provider": details.provider,
      }}
      statusLabel={statusLabel}
      subtitle={details.subtitle ?? details.providerLabel}
      testIdPrefix={`${testId}-music`}
      title={details.title}
    >
      {children}
    </MediaPlayer>
  );
}

function PostIntegrationAttachment({
  attachment,
  testId,
}: {
  attachment: PostAttachment;
  testId: string;
}) {
  const card = attachmentCardObject(attachment.card);
  const metadata = attachmentCardObject(card?.metadata);
  const title = stringValue(metadata?.title) ?? stringValue(card?.title) ?? postIntegrationProviderLabel(attachment.provider);
  const subtitle = stringValue(metadata?.subtitle) ?? postIntegrationProviderLabel(attachment.provider);
  const imageUrl = stringValue(metadata?.imageUrl);
  const href = attachment.sourceUrl ?? stringValue(card?.sourceUrl) ?? "#";

  return (
    <a
      className="grid min-h-24 min-w-0 grid-cols-[4rem_minmax(0,1fr)] gap-3 rounded-card border border-line bg-canvas/70 p-3 text-left shadow-inner-soft transition duration-fluid hover:border-line-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      href={href}
      rel="noreferrer"
      target="_blank"
      data-thread-open-ignore
      data-testid={`${testId}-integration`}
    >
      <span className="grid size-16 overflow-hidden rounded-card border border-line bg-surface">
        {imageUrl ? (
          <img src={imageUrl} alt="" className="h-full w-full object-cover" loading="lazy" decoding="async" />
        ) : (
          <span className="grid place-items-center text-muted">
            <WifiOff aria-hidden="true" size={18} />
          </span>
        )}
      </span>
      <span className="min-w-0 self-center">
        <span className="block truncate text-sm font-semibold text-text">{title}</span>
        <span className="mt-1 block truncate text-xs text-muted">{subtitle}</span>
      </span>
    </a>
  );
}

function postAttachmentsForDisplay(post: Post): PostAttachment[] {
  if (post.attachments && post.attachments.length > 0) {
    return [...post.attachments].sort(
      (first, second) => (first.position ?? 0) - (second.position ?? 0),
    );
  }

  if (!post.mediaUrl) {
    return [];
  }

  const kind = post.mediaType === "video" || /\.(?:mp4|webm)$/iu.test(post.mediaUrl) ? "video" : "image";

  return [
    {
      position: 1,
      kind,
      url: post.mediaUrl,
      mime: post.mediaMime ?? null,
      posterUrl: post.mediaPosterUrl ?? null,
    },
  ];
}

function attachmentCardObject(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

function postIntegrationProviderLabel(provider: string | null | undefined): string {
  if (provider === "spotify") {
    return "Spotify";
  }

  if (provider === "youtube") {
    return "YouTube Music";
  }

  if (provider === "apple_music") {
    return "Apple Music";
  }

  return "Music";
}

function isPostMusicAttachment(attachment: PostAttachment): boolean {
  return attachment.kind === "audio" ||
    (attachment.kind === "integration" && isPostMusicProvider(attachment.provider));
}

function isPostMusicProvider(provider: string | null | undefined): provider is "spotify" | "youtube" {
  return provider === "spotify" || provider === "youtube";
}

function postMusicAttachmentDetails(
  attachment: PostAttachment,
  index: number,
): PostMusicAttachmentDetails {
  if (attachment.kind === "audio") {
    const fileLabel = attachmentFileLabel(attachment.url);

    return {
      description: null,
      href: safeAttachmentHref(attachment.url),
      imageUrl: null,
      provider: "mp3",
      providerLabel: "MP3",
      resourceId: null,
      resourceType: null,
      subtitle: fileLabel,
      title: `MP3 attachment ${index + 1}`,
      youtubeFrame: null,
    };
  }

  const card = attachmentCardObject(attachment.card);
  const metadata = attachmentCardObject(card?.metadata);
  const cardProvider = stringValue(card?.provider);
  const provider = isPostMusicProvider(attachment.provider)
    ? attachment.provider
    : isPostMusicProvider(cardProvider)
      ? cardProvider
      : "spotify";
  const providerLabel = postIntegrationProviderLabel(provider);
  const title = stringValue(metadata?.title) ?? stringValue(card?.title) ?? providerLabel;
  const rawSubtitle = stringValue(metadata?.subtitle);
  const subtitle =
    provider === "youtube" && rawSubtitle === "YouTube"
      ? providerLabel
      : rawSubtitle ?? providerLabel;
  const sourceUrl = attachment.sourceUrl ?? stringValue(card?.sourceUrl);
  const resourceType = stringValue(attachment.resourceType) ?? stringValue(card?.resourceType);
  const resourceId = stringValue(attachment.resourceId) ?? stringValue(card?.resourceId);

  return {
    description: stringValue(metadata?.description),
    href: safeAttachmentHref(sourceUrl),
    imageUrl: stringValue(metadata?.imageUrl),
    provider,
    providerLabel,
    resourceId,
    resourceType,
    subtitle,
    title,
    youtubeFrame: provider === "youtube"
      ? postYouTubeMusicFrameFromAttachment(card, title, resourceType, resourceId)
      : null,
  };
}

function postYouTubeMusicFrameFromAttachment(
  card: Record<string, unknown> | null,
  title: string,
  resourceType: string | null,
  resourceId: string | null,
): PostYouTubeMusicFrame | null {
  const cardEmbed = attachmentCardObject(card?.embed);
  const cardEmbedSrc = stringValue(cardEmbed?.src);
  const safeCardEmbedSrc = safePostYouTubeMusicFrameSrc(cardEmbedSrc);

  if (safeCardEmbedSrc) {
    return {
      allow: stringValue(cardEmbed?.allow) ?? defaultPostYouTubeMusicFrameAllow(),
      src: safeCardEmbedSrc,
      title: stringValue(cardEmbed?.title) ?? `${title} on YouTube Music`,
    };
  }

  if (!resourceType || !resourceId) {
    return null;
  }

  if (resourceType === "playlist") {
    return {
      allow: defaultPostYouTubeMusicFrameAllow(),
      src: `https://www.youtube-nocookie.com/embed/videoseries?list=${encodeURIComponent(resourceId)}`,
      title: `${title} on YouTube Music`,
    };
  }

  if (["video", "short", "shorts", "live"].includes(resourceType)) {
    return {
      allow: defaultPostYouTubeMusicFrameAllow(),
      src: `https://www.youtube-nocookie.com/embed/${encodeURIComponent(resourceId)}`,
      title: `${title} on YouTube Music`,
    };
  }

  return null;
}

function safePostYouTubeMusicFrameSrc(value: string | null): string | null {
  if (!value) {
    return null;
  }

  try {
    const url = new URL(value);

    if (
      url.protocol !== "https:" ||
      url.hostname !== "www.youtube-nocookie.com" ||
      url.username !== "" ||
      url.password !== ""
    ) {
      return null;
    }

    return url.toString();
  } catch {
    return null;
  }
}

function defaultPostYouTubeMusicFrameAllow(): string {
  return "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
}

function decoratePostSpotifyProviderFrame(
  container: HTMLElement,
  title: string,
  testId: string,
) {
  window.requestAnimationFrame(() => {
    const iframe = container.querySelector("iframe");

    if (!iframe) {
      return;
    }

    iframe.className = "block size-full border-0 bg-transparent";
    iframe.dataset.postMusicProvider = "spotify";
    iframe.dataset.testid = `${testId}-provider-iframe-spotify`;
    iframe.height = "80";
    iframe.loading = "lazy";
    iframe.referrerPolicy = "strict-origin-when-cross-origin";
    iframe.title = `${title} on Spotify`;
    iframe.setAttribute(
      "allow",
      "autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture",
    );
    iframe.setAttribute(
      "sandbox",
      "allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-forms",
    );
    iframe.allowFullscreen = true;
  });
}

function postYouTubeMusicFrameSrc(
  src: string,
  autoplay: boolean,
  version: number,
): string {
  try {
    const url = new URL(src);

    if (url.hostname === "www.youtube-nocookie.com") {
      url.searchParams.set("enablejsapi", "1");
      url.searchParams.set("playsinline", "1");
      url.searchParams.set("rel", "0");
      url.searchParams.set("autoplay", autoplay ? "1" : "0");
      url.searchParams.set(
        "origin",
        typeof window === "undefined" ? "https://thia.lol" : window.location.origin,
      );
      url.searchParams.set("thiaPostPlayer", String(version));
      return url.toString();
    }
  } catch {
    return src;
  }

  return src;
}

function formatPostMediaTime(value: number): string {
  const totalSeconds = Math.max(0, Math.floor(value));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds
      .toString()
      .padStart(2, "0")}`;
  }

  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function openPostMusicHref(href: string | null) {
  if (!href || typeof window === "undefined") {
    return;
  }

  const openedWindow = window.open(href, "_blank", "noopener,noreferrer");
  if (openedWindow) {
    openedWindow.opener = null;
  }
}

function safeAttachmentHref(value: string | null | undefined): string | null {
  const candidate = stringValue(value);

  if (!candidate) {
    return null;
  }

  if (candidate.startsWith("/")) {
    return candidate;
  }

  try {
    const url = new URL(candidate);

    if (
      (url.protocol === "https:" || url.protocol === "http:") &&
      url.username === "" &&
      url.password === ""
    ) {
      return url.toString();
    }
  } catch {
    return null;
  }

  return null;
}

function attachmentFileLabel(value: string | null | undefined): string | null {
  const candidate = stringValue(value);

  if (!candidate) {
    return null;
  }

  const path = candidate.split(/[?#]/u)[0] ?? "";
  const filename = path.split("/").filter(Boolean).at(-1);

  if (!filename) {
    return null;
  }

  try {
    return decodeURIComponent(filename);
  } catch {
    return filename;
  }
}
function PostDestinationLine({ post }: { post: Post }) {
  if (post.room) {
    return (
      <p className="mt-0.5 truncate text-xs text-muted">
        in{" "}
        <Link
          to={`/rooms/${post.room.slug}`}
          className="font-medium text-muted underline-offset-4 hover:text-accent-strong hover:underline"
        >
          {post.room.name}
        </Link>
      </p>
    );
  }

  return (
    <p className="mt-0.5 truncate text-xs text-muted">
      in{" "}
      <Link
        to={`/@${post.author.handle}`}
        className="font-medium text-muted underline-offset-4 hover:text-accent-strong hover:underline"
      >
        Profile feed
      </Link>
    </p>
  );
}

type ReactionControlsProps = {
  post: Post;
  commentCount: number;
  initialLikeCount: number;
  initiallyLiked: boolean;
  actions: ReactNode;
  onReply: () => void;
};

function ReactionControls({
  post,
  commentCount,
  initialLikeCount,
  initiallyLiked,
  actions,
  onReply,
}: ReactionControlsProps) {
  const { csrfToken, runWithAuth, status, user } = useAuth();
  const [likeCount, setLikeCount] = useState(initialLikeCount);
  const [liked, setLiked] = useState(initiallyLiked);
  const [reblogCount, setReblogCount] = useState(post.reblogCount ?? 0);
  const [reblogged, setReblogged] = useState(
    post.rebloggedByMe ?? post.rebloggedByCurrentUser ?? false,
  );
  const [likePending, setLikePending] = useState(false);
  const [likePulse, setLikePulse] = useState(0);
  const [likeError, setLikeError] = useState<string>();
  const [reblogPending, setReblogPending] = useState(false);
  const [reblogPulse, setReblogPulse] = useState(0);
  const [reblogError, setReblogError] = useState<string>();
  const [shareOpen, setShareOpen] = useState(false);
  const canReport = status !== "loading" && user?.id !== post.author.id;
  const canReblog =
    status === "authenticated" && Boolean(csrfToken) && user?.id !== post.author.id;

  async function handleLike() {
    if (likePending) {
      return;
    }

    const wasLiked = liked;
    const previousCount = likeCount;

    setLikeError(undefined);
    setLikePending(true);
    setLiked(!wasLiked);
    setLikeCount((current) => Math.max(0, current + (wasLiked ? -1 : 1)));

    if (!wasLiked) {
      setLikePulse((current) => current + 1);
    }

    try {
      const result = await runWithAuth(
        (freshCsrfToken) =>
          wasLiked
            ? unlikePost(post.id, freshCsrfToken)
            : likePost(post.id, freshCsrfToken),
        { retryOnCsrf: true },
      );

      setLikeCount(result.likeCount);
      setLiked(result.likedByCurrentUser);
    } catch (error) {
      setLikeCount(previousCount);
      setLiked(wasLiked);
      setLikeError(
        error instanceof Error ? error.message : "Could not update like.",
      );
    } finally {
      setLikePending(false);
    }
  }

  async function handleReblog() {
    if (reblogPending || !canReblog) {
      return;
    }

    const wasReblogged = reblogged;
    const previousCount = reblogCount;

    setReblogError(undefined);
    setReblogPending(true);
    setReblogged(!wasReblogged);
    setReblogCount((current) => Math.max(0, current + (wasReblogged ? -1 : 1)));

    if (!wasReblogged) {
      setReblogPulse((current) => current + 1);
    }

    try {
      const result = await runWithAuth(
        (freshCsrfToken) =>
          wasReblogged
            ? unreblogPost(post.id, freshCsrfToken)
            : reblogPost(post.id, freshCsrfToken),
        { retryOnCsrf: true },
      );

      setReblogCount(result.reblogCount);
      setReblogged(result.rebloggedByMe ?? result.rebloggedByCurrentUser ?? false);
    } catch (error) {
      setReblogCount(previousCount);
      setReblogged(wasReblogged);
      setReblogError(
        error instanceof Error ? error.message : "Could not update reblog.",
      );
    } finally {
      setReblogPending(false);
    }
  }

  return (
    <>
      <div
        className="mt-3 flex min-h-10 items-center gap-0.5 border-t border-line/55 pt-2 text-sm text-muted"
        data-testid="post-action-row"
      >
        <CommentButton
          count={commentCount}
          onClick={onReply}
        />
        <LikeButton
          count={likeCount}
          liked={liked}
          pending={likePending}
          pulseKey={likePulse}
          onClick={() => void handleLike()}
        />
        <ReblogButton
          count={reblogCount}
          disabled={!canReblog}
          disabledTitle={
            status === "authenticated" ? "You cannot reblog your own post" : "Log in to reblog"
          }
          pending={reblogPending}
          pulseKey={reblogPulse}
          reblogged={reblogged}
          onClick={() => void handleReblog()}
        />
        <PostActionIconButton
          label="Share post"
          icon={<Share2 aria-hidden="true" size={15} />}
          onClick={() => setShareOpen(true)}
        />
        {canReport || actions ? (
          <span className="ml-auto inline-flex items-center gap-0.5 border-l border-line/55 pl-1">
            {canReport ? (
              <ReportForm
                targetType="post"
                targetId={post.id}
                postId={post.id}
                reportedUserId={post.author.id}
                title="Report post"
                explainer="This reports the post to moderators."
                triggerMode="icon"
                triggerLabel="Report post"
                triggerClassName="size-11 rounded-control sm:size-9"
              />
            ) : null}
            {actions}
          </span>
        ) : null}
      </div>
      {likeError ? (
        <p className="mt-2 text-xs font-medium text-rose-ink">{likeError}</p>
      ) : null}
      {reblogError ? (
        <p className="mt-2 text-xs font-medium text-rose-ink">{reblogError}</p>
      ) : null}
      {shareOpen ? (
        <PostShareModal
          open={shareOpen}
          post={post}
          onClose={() => setShareOpen(false)}
        />
      ) : null}
    </>
  );
}

type CommentButtonProps = {
  count: number;
  onClick: () => void;
};

function CommentButton({ count, onClick }: CommentButtonProps) {
  return (
    <motion.button
      type="button"
      className="app-control inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-control px-2 text-sm leading-none text-muted transition duration-fluid ease-fluid hover:bg-surface-strong/70 hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus sm:min-h-9 sm:min-w-0"
      aria-label={`Open replies and reply. ${count} ${count === 1 ? "reply" : "replies"}.`}
      title="Reply"
      onClick={onClick}
      whileHover={buttonHover}
      whileTap={buttonTap}
    >
      <MessageCircle aria-hidden="true" size={16} />
      <span className="min-w-3 tabular-nums">{count}</span>
    </motion.button>
  );
}


type LikeButtonProps = {
  count: number;
  liked: boolean;
  pending: boolean;
  pulseKey: number;
  onClick: () => void;
};

function LikeButton({
  count,
  liked,
  pending,
  pulseKey,
  onClick,
}: LikeButtonProps) {
  return (
    <motion.button
      type="button"
      className={cn(
        "app-control inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-control px-2 text-sm leading-none transition duration-fluid ease-fluid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-wait sm:min-h-9 sm:min-w-0",
        liked
          ? "bg-rose/15 text-rose-ink"
          : "text-muted hover:bg-surface-strong/70 hover:text-text",
        pending && "opacity-70",
      )}
      aria-label={`${liked ? "Unlike" : "Like"} this post. ${count} ${count === 1 ? "like" : "likes"}.`}
      aria-pressed={liked}
      disabled={pending}
      title={liked ? "Unlike" : "Like"}
      onClick={onClick}
      whileHover={buttonHover}
      whileTap={buttonTap}
    >
      <motion.span
        key={pulseKey}
        aria-hidden="true"
        animate={liked ? pulsePop : { scale: 1, transition: softSpring }}
        className="grid place-items-center"
      >
        <Heart size={16} fill={liked ? "currentColor" : "none"} />
      </motion.span>
      <span className="min-w-3 tabular-nums">{count}</span>
    </motion.button>
  );
}

type ReblogButtonProps = {
  count: number;
  disabled: boolean;
  disabledTitle: string;
  pending: boolean;
  pulseKey: number;
  reblogged: boolean;
  onClick: () => void;
};

function ReblogButton({
  count,
  disabled,
  disabledTitle,
  pending,
  pulseKey,
  reblogged,
  onClick,
}: ReblogButtonProps) {
  return (
    <motion.button
      type="button"
      className={cn(
        "app-control inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-control px-2 text-sm leading-none transition duration-fluid ease-fluid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-55 sm:min-h-9 sm:min-w-0",
        reblogged
          ? "bg-leaf/15 text-leaf-ink"
          : "text-muted hover:bg-surface-strong/70 hover:text-text",
        pending && "cursor-wait opacity-70",
      )}
      aria-label={`${reblogged ? "Undo reblog" : "Reblog"} this post. ${count} ${count === 1 ? "reblog" : "reblogs"}.`}
      aria-pressed={reblogged}
      disabled={disabled || pending}
      title={disabled ? disabledTitle : reblogged ? "Undo reblog" : "Reblog"}
      onClick={onClick}
      whileHover={buttonHover}
      whileTap={buttonTap}
    >
      <motion.span
        key={pulseKey}
        aria-hidden="true"
        animate={
          reblogged
            ? { rotate: [0, -14, 10, 0], scale: [1, 1.2, 1], transition: softSpring }
            : { rotate: 0, scale: 1, transition: softSpring }
        }
        className="grid place-items-center"
      >
        <Repeat2 size={16} />
      </motion.span>
      <span className="min-w-3 tabular-nums">{count}</span>
    </motion.button>
  );
}

function PostActionIconButton({
  disabled,
  icon,
  label,
  onClick,
  variant = "ghost",
}: {
  disabled?: boolean;
  icon: ReactNode;
  label: string;
  onClick: () => void;
  variant?: "ghost" | "danger";
}) {
  const motionProps = disabled
    ? {}
    : { whileHover: buttonHover, whileTap: buttonTap };

  return (
    <motion.button
      type="button"
      className={cn(
        "app-control inline-flex size-11 items-center justify-center rounded-control transition duration-fluid ease-fluid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-wait disabled:opacity-55 sm:size-9",
        variant === "danger"
          ? "text-rose-ink hover:bg-rose/15"
          : "text-muted hover:bg-surface-strong hover:text-text",
      )}
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      {...motionProps}
    >
      {icon}
    </motion.button>
  );
}
