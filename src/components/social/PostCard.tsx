import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react";
import {
  ArrowDown,
  ArrowUp,
  EyeOff,
  Heart,
  ImagePlay,
  ImagePlus,
  LoaderCircle,
  MessageCircle,
  Music2,
  Repeat2,
  Send,
  Share2,
  Trash2,
  WifiOff,
} from "lucide-react";
import { Link } from "react-router";
import { AnimatePresence, motion } from "motion/react";
import { Avatar } from "../ui/Avatar";
import { Button, ButtonLink } from "../ui/Button";
import { FocusAutoplayVideo } from "../ui/FocusAutoplayVideo";
import { ImageCropModal } from "../ui/ImageCropModal";
import { MediaPlayer, type MediaPlayerLayout } from "../ui/MediaPlayer";
import { ModalSheet } from "../ui/ModalSheet";
import { Panel } from "../ui/Panel";
import { CompactStateNotice } from "../ui/RouteState";
import { InlineUserProfileLink } from "./UserProfileLink";
import { GifPicker } from "./GifPicker";
import { MarkdownEditor } from "./MarkdownEditor";
import { PostShareModal } from "./PostShareModal";
import { ReportForm } from "./ReportForm";
import { RichText } from "./RichText";
import {
  deletePost,
  createPostReply,
  getProfileIntegrationSuggestions,
  getPostReplies,
  likePost,
  reblogPost,
  previewImageUpload,
  resolveProfileIntegrationMetadata,
  startProfileIntegration,
  unreblogPost,
  unlikePost,
  uploadAudio,
  uploadImage,
  uploadVideo,
} from "../../lib/api";
import { cn } from "../../lib/classNames";
import { prepareImageFileForCrop } from "../../lib/imageCrop";
import {
  audioUploadFormatHelp,
  imageUploadFormatHelp,
  isAcceptedImageUploadFile,
  isAcceptedAudioUploadFile,
  isAcceptedVideoUploadFile,
  isLikelyVideoUploadFile,
  visualMediaUploadAccept,
  videoUploadFormatHelp,
} from "../../lib/mediaFormats";
import {
  postMediaDraftFromAudio,
  postMediaDraftFromGif,
  postMediaDraftFromImage,
  postMediaDraftFromIntegration,
  postMediaDraftFromVideo,
  postMediaInputFromDraft,
  type PostMediaDraft,
  type PostVisualMediaDraft,
} from "../../lib/postMedia";
import { roomAllowsPosting } from "../../lib/postRules";
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
import type { AuthStatus } from "../../lib/authTypes";
import type { GifSearchResult, Post, PostAttachment } from "../../lib/types";
import { useAuth } from "../../lib/useAuth";
import { canDeletePost } from "../../lib/postPermissions";
import type { PostMusicAttachmentProvider } from "./PostMusicAttachmentPicker";
import { PostMusicAttachmentPicker } from "./PostMusicAttachmentPicker";

type PostCardProps = {
  post: Post;
  index?: number;
  canDelete?: boolean;
  canHide?: boolean;
  actionPending?: boolean;
  disableThreadModal?: boolean;
  onDelete?: (post: Post) => void;
  onHide?: (post: Post) => void;
  onReplyAction?: () => void;
};

export function PostCard({
  post,
  index = 0,
  canDelete = false,
  canHide = false,
  actionPending = false,
  disableThreadModal = false,
  onDelete,
  onHide,
  onReplyAction,
}: PostCardProps) {
  const { csrfToken, runWithAuth, status, user } = useAuth();
  const effectiveCanDelete = canDelete || canDeletePost(user, post);
  const showActions = effectiveCanDelete || canHide;
  const [commentCount, setCommentCount] = useState(post.commentCount);
  const [threadOpen, setThreadOpen] = useState(false);
  const [threadComposerOpen, setThreadComposerOpen] = useState(false);
  const [localDeletePending, setLocalDeletePending] = useState(false);
  const [localDeleteError, setLocalDeleteError] = useState<string>();
  const [locallyDeleted, setLocallyDeleted] = useState(false);
  const canReplyToPost = roomAllowsPosting(post.room);

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

  function openThread(options?: { compose?: boolean }) {
    if (disableThreadModal) {
      if (options?.compose) {
        onReplyAction?.();
      }
      return;
    }

    setThreadComposerOpen(Boolean(options?.compose && canReplyToPost));
    setThreadOpen(true);
  }

  function handleCardClick(event: ReactMouseEvent<HTMLElement>) {
    if (disableThreadModal) {
      return;
    }

    if (isThreadOpenIgnoredTarget(event.target) || isThreadOpenIgnoredEvent(event.nativeEvent)) {
      return;
    }

    openThread();
  }

  function handleCardKeyDown(event: ReactKeyboardEvent<HTMLElement>) {
    if (disableThreadModal) {
      return;
    }

    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    if (isThreadOpenIgnoredTarget(event.target)) {
      return;
    }

    event.preventDefault();
    openThread();
  }

  const cardMotionProps = threadOpen || disableThreadModal
    ? {}
    : { whileHover: cardHover, whileTap: cardTap };

  if (locallyDeleted) {
    return null;
  }

  return (
    <>
      <motion.article
        id={`post-${post.id}`}
        aria-label={
          disableThreadModal
            ? `Post by ${post.author.displayName}`
            : `Open thread by ${post.author.displayName}`
        }
        className={cn(
          "group mx-auto w-full max-w-[38rem] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-focus",
          disableThreadModal ? "cursor-default" : "cursor-pointer",
        )}
        data-render-deferred="post"
        data-testid="post-card-open-thread"
        tabIndex={disableThreadModal ? undefined : 0}
        variants={cardEntrance}
        custom={index}
        initial="hidden"
        animate="show"
        onClick={handleCardClick}
        onKeyDown={handleCardKeyDown}
        {...cardMotionProps}
      >
        <Panel className="overflow-hidden p-3 transition duration-fluid ease-fluid group-hover:border-line-strong group-hover:bg-surface/90 sm:p-4">
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
          <div className="flex items-start gap-3">
            <Link
              to={`/@${post.author.handle}`}
              aria-label={`${post.author.displayName}'s profile`}
              className="shrink-0 rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            >
              <Avatar user={post.author} />
            </Link>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <Link
                  to={`/@${post.author.handle}`}
                  className="text-sm font-semibold text-text underline-offset-4 hover:text-accent-strong hover:underline"
                >
                  {post.author.displayName}
                </Link>
                <Link
                  to={`/@${post.author.handle}`}
                  className="text-sm text-muted underline-offset-4 hover:text-accent-strong hover:underline"
                >
                  @{post.author.handle}
                </Link>
                <span className="text-muted/50">·</span>
                <span className="text-sm text-muted">{post.createdAt}</span>
                <PostMetaChips post={post} />
              </div>
            </div>
          </div>

          <div
            data-testid="post-body-open-thread"
            className="mt-3 block w-full text-left"
          >
            <RichText
              text={post.body}
              entities={post.bodyEntities}
              markdown={post.bodyFormat === "markdown"}
              className="block whitespace-pre-wrap break-words text-pretty text-[0.95rem] leading-6 text-text"
            />

            <PostAttachments post={post} />
          </div>

          <ReactionControls
            key={`${post.id}:${post.likeCount}:${post.likedByCurrentUser}:${post.reblogCount}:${post.rebloggedByMe}:${post.rebloggedByCurrentUser}:${post.commentCount}`}
            post={post}
            commentCount={commentCount}
            initialLikeCount={post.likeCount}
            initiallyLiked={post.likedByCurrentUser}
            onOpenThread={() => openThread({ compose: true })}
            actions={
              showActions ? (
                <>
                  {canHide ? (
                    <PostActionIconButton
                      label="Hide post"
                      disabled={actionPending}
                      variant="ghost"
                      icon={<EyeOff aria-hidden="true" size={15} />}
                      onClick={() => onHide?.(post)}
                    />
                  ) : null}
                  {effectiveCanDelete ? (
                    <PostActionIconButton
                      label="Delete post"
                      disabled={actionPending || localDeletePending}
                      variant="ghost"
                      icon={<Trash2 aria-hidden="true" size={15} />}
                      onClick={() => void handleDeletePost()}
                    />
                  ) : null}
                </>
              ) : null
            }
          />
          {localDeleteError ? (
            <p className="mt-3 rounded-card border border-rose/30 bg-rose/15 p-3 text-sm text-rose-ink">
              {localDeleteError}
            </p>
          ) : null}
        </Panel>
      </motion.article>
      {threadOpen ? (
        <ThreadModal
          open={threadOpen}
          post={{ ...post, commentCount }}
          authStatus={status}
          csrfToken={csrfToken}
          initialComposerOpen={threadComposerOpen}
          runWithAuth={runWithAuth}
          canDeleteRoot={effectiveCanDelete}
          actionPending={actionPending || localDeletePending}
          onClose={() => setThreadOpen(false)}
          onRootDelete={async () => {
            const deleted = await handleDeletePost();

            if (deleted) {
              setThreadOpen(false);
            }
          }}
          onReplyCreated={() => setCommentCount((current) => current + 1)}
          onReplyDeleted={() => setCommentCount((current) => Math.max(0, current - 1))}
        />
      ) : null}
    </>
  );
}

const threadOpenIgnoreSelector = [
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

function isThreadOpenIgnoredEvent(event: Event) {
  return event.composedPath().some(
    (node) =>
      node instanceof Element && Boolean(node.closest(threadOpenIgnoreSelector)),
  );
}

function isThreadOpenIgnoredTarget(target: EventTarget | null) {
  if (!(target instanceof Element)) {
    return true;
  }

  return Boolean(target.closest(threadOpenIgnoreSelector));
}

function stopThreadOpenPropagation(event: ReactMouseEvent<HTMLElement>) {
  event.stopPropagation();
}

type PostMediaProps = {
  className?: string;
  maxHeightClass?: string;
  mediaMime?: string | null | undefined;
  mediaPosterUrl?: string | null | undefined;
  mediaType?: "image" | "video" | null | undefined;
  mediaUrl: string | null | undefined;
  testId?: string;
};

function PostMedia({
  className = "mt-4",
  maxHeightClass = "max-h-[min(70vh,34rem)]",
  mediaMime,
  mediaPosterUrl,
  mediaType,
  mediaUrl,
  testId = "post-media",
}: PostMediaProps) {
  if (!mediaUrl || mediaUrl === "/ambient-veil.webp") {
    return null;
  }

  const isVideo = mediaType === "video" || /\.(?:mp4|webm)$/iu.test(mediaUrl);

  return (
    <span className={cn("block max-w-full", className)} data-testid={testId}>
      <span
        className="inline-flex w-fit max-w-full overflow-hidden rounded-card border border-line bg-canvas/70 align-top"
        data-thread-open-ignore={isVideo ? true : undefined}
        onClick={isVideo ? stopThreadOpenPropagation : undefined}
      >
        {isVideo ? (
          <FocusAutoplayVideo
            className={cn("block h-auto max-w-full bg-black object-contain", maxHeightClass)}
            poster={mediaPosterUrl ?? undefined}
            data-testid={`${testId}-video`}
          >
            <source src={mediaUrl} type={mediaMime ?? (mediaUrl.endsWith(".webm") ? "video/webm" : "video/mp4")} />
          </FocusAutoplayVideo>
        ) : (
          <img
            src={mediaUrl}
            alt=""
            className={cn(
              "block h-auto max-w-full object-contain",
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

type PostAttachmentsProps = {
  className?: string;
  maxHeightClass?: string;
  musicLayout?: PostMusicLayout;
  post: Post;
  testId?: string;
};

type PostMusicLayout = "compact" | "responsive";

function PostAttachments({
  className = "mt-4",
  maxHeightClass = "max-h-[min(70vh,34rem)]",
  musicLayout = "responsive",
  post,
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
        "grid max-w-full gap-2",
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
  testId,
}: {
  attachment: PostAttachment;
  index: number;
  maxHeightClass: string;
  musicLayout: PostMusicLayout;
  testId: string;
}) {
  if (attachment.kind === "integration") {
    if (isPostMusicAttachment(attachment)) {
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
        className="inline-flex w-fit max-w-full overflow-hidden rounded-card border border-line bg-canvas/70 align-top"
        data-testid={testId}
      >
        {attachment.url ? (
          <img
            src={attachment.url}
            alt={title}
            className={cn("block h-auto max-w-full object-contain", maxHeightClass)}
            loading="lazy"
            decoding="async"
            data-testid={`${testId}-gif`}
          />
        ) : null}
      </span>
    );
  }

  if (!attachment.url || attachment.url === "/ambient-veil.webp") {
    return null;
  }

  if (attachment.kind === "audio") {
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
      className="inline-flex w-fit max-w-full overflow-hidden rounded-card border border-line bg-canvas/70 align-top"
      data-thread-open-ignore={isVideo ? true : undefined}
      data-testid={testId}
      onClick={isVideo ? stopThreadOpenPropagation : undefined}
    >
      {isVideo ? (
        <FocusAutoplayVideo
          className={cn("block h-auto max-w-full bg-black object-contain", maxHeightClass)}
          poster={attachment.posterUrl ?? undefined}
          data-testid={`${testId}-video`}
        >
          <source src={attachment.url} type={attachment.mime ?? (attachment.url.endsWith(".webm") ? "video/webm" : "video/mp4")} />
        </FocusAutoplayVideo>
      ) : (
        <img
          src={attachment.url}
          alt=""
          className={cn("block h-auto max-w-full object-contain", maxHeightClass)}
          loading="lazy"
          decoding="async"
          data-testid={`${testId}-image`}
        />
      )}
    </span>
  );
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
      className="grid min-h-24 min-w-0 grid-cols-[4rem_1fr] gap-3 rounded-card border border-line bg-canvas/70 p-3 text-left shadow-inner-soft transition duration-fluid hover:border-line-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
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

/*
 * The older implementation rendered ThreadModal inside the animated article.
 * Because React events bubble through portals, modal hover could still toggle
 * card hover motion. Keep the portal mounted as a sibling of the card.
 */
function ThreadAvatarRail({
  user,
  href,
  ariaLabel,
  hasBranch = false,
  branchClassName,
}: {
  user: Post["author"];
  href: string;
  ariaLabel: string;
  hasBranch?: boolean;
  branchClassName?: string;
}) {
  return (
    <div
      className="relative flex min-h-12 justify-center"
      data-testid="thread-avatar-rail"
    >
      {hasBranch ? (
        <span
          className={cn(
            "pointer-events-none absolute left-1/2 top-6 h-px -translate-x-full bg-line/55",
            branchClassName ?? "w-5",
          )}
          aria-hidden="true"
          data-testid="thread-rail-branch"
        />
      ) : null}
      <Link
        to={href}
        aria-label={ariaLabel}
        className="relative z-10 grid size-12 shrink-0 place-items-center rounded-full bg-canvas ring-4 ring-canvas focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        data-testid="thread-avatar-bubble"
      >
        <Avatar user={user} />
      </Link>
    </div>
  );
}

const threadRailLineClass =
  "pointer-events-none absolute z-0 w-px -translate-x-1/2 bg-line/55";

const metaChipClass =
  "inline-flex min-h-5 items-center rounded-full border px-1.5 text-[0.68rem] font-medium leading-none";
const roomMetaChipClass = "border-warm/25 bg-warm/10 text-warm-ink";
const coolMetaChipClass = "border-cool/25 bg-cool/10 text-cool-ink";
const leafMetaChipClass = "border-leaf/25 bg-leaf/10 text-leaf-ink";
const roseMetaChipClass = "border-rose/25 bg-rose/10 text-rose-ink";

function PostMetaChips({ post }: { post: Post }) {
  const chips = postContextChips(post);

  if (!post.room && chips.length === 0) {
    return null;
  }

  return (
    <span className="contents">
      {chips.map((chip) => (
        <span key={chip.label} className="contents">
          <span className="text-muted/50">·</span>
          <span className={cn(metaChipClass, chip.className)}>{chip.label}</span>
        </span>
      ))}
      {post.room ? (
        <span className="contents">
          <span className="text-muted/50">·</span>
          <Link
            to={`/rooms/${post.room.slug}`}
            title={`Posted in ${post.room.name}`}
            className={cn(
              metaChipClass,
              roomMetaChipClass,
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
            )}
          >
            {post.room.name}
          </Link>
        </span>
      ) : null}
    </span>
  );
}

function postContextChips(post: Post) {
  const chips: Array<{ className: string; label: string }> = [];
  const relationship = post.socialContext?.authorRelationship;

  if (relationship === "moot") {
    chips.push({ className: leafMetaChipClass, label: "Moot" });
  } else if (relationship === "following") {
    chips.push({ className: coolMetaChipClass, label: "Following" });
  }

  if ((post.socialContext?.likedByFollowedCount ?? 0) > 0) {
    chips.push({ className: coolMetaChipClass, label: "Liked by follows" });
  }

  if (isRecentPostLabel(post.createdAt)) {
    chips.push({ className: roseMetaChipClass, label: "Recent" });
  }

  return chips;
}

function isRecentPostLabel(createdAt: string) {
  return createdAt === "now" || /(?:minute|minutes) ago/u.test(createdAt);
}

type ReactionControlsProps = {
  post: Post;
  commentCount: number;
  initialLikeCount: number;
  initiallyLiked: boolean;
  actions: ReactNode;
  onOpenThread: () => void;
  compact?: boolean;
};

function ReactionControls({
  post,
  commentCount,
  initialLikeCount,
  initiallyLiked,
  actions,
  onOpenThread,
  compact = false,
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
        className={cn(
          "mt-4 flex flex-wrap items-center gap-2 text-sm text-muted",
          compact ? "mt-3 gap-x-2 gap-y-1" : null,
        )}
      >
        <CommentButton
          count={commentCount}
          onClick={onOpenThread}
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
          variant="ghost"
          icon={<Share2 aria-hidden="true" size={15} />}
          onClick={() => setShareOpen(true)}
        />
        {canReport || actions ? (
          <span
            className={cn(
              "inline-flex items-center gap-2",
              compact ? "w-full justify-end sm:ml-auto sm:w-auto" : "ml-auto",
            )}
          >
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
                triggerSize="compact"
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
      className="inline-flex min-h-10 items-center gap-2 rounded-full border border-line bg-surface/80 px-4 text-base leading-none text-muted shadow-soft transition duration-fluid ease-fluid hover:border-line-strong hover:bg-surface-strong hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      aria-label={`Open replies. ${count} ${count === 1 ? "reply" : "replies"}.`}
      title="Replies"
      onClick={onClick}
      whileHover={buttonHover}
      whileTap={buttonTap}
    >
      <MessageCircle aria-hidden="true" size={17} />
      <span className="tabular-nums">{count}</span>
    </motion.button>
  );
}

export type ReplyComposerProps = {
  parentPostId: number;
  csrfToken: string | undefined;
  runWithAuth: <T>(
    task: (csrfToken: string) => Promise<T>,
    options?: { retryOnCsrf?: boolean },
  ) => Promise<T>;
  autoFocus?: boolean;
  className?: string;
  onCancel: () => void;
  onCreated: (reply: Post) => void;
};

export function ReplyComposer({
  parentPostId,
  csrfToken,
  runWithAuth,
  autoFocus = false,
  className,
  onCancel,
  onCreated,
}: ReplyComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [body, setBody] = useState("");
  const [media, setMedia] = useState<PostMediaDraft[]>([]);
  const [gifPickerOpen, setGifPickerOpen] = useState(false);
  const [musicPickerOpen, setMusicPickerOpen] = useState(false);
  const [pendingImageCrop, setPendingImageCrop] = useState<File | undefined>();
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | undefined>();
  const trimmedBody = body.trim();
  const canSubmit =
    Boolean(csrfToken) &&
    trimmedBody.length > 0 &&
    trimmedBody.length <= 2000 &&
    !submitting &&
    !uploadingMedia;
  const canAddMedia = media.length < maxPostComposerAttachments;

  useEffect(() => {
    if (autoFocus) {
      window.setTimeout(() => textareaRef.current?.focus(), 60);
    }
  }, [autoFocus]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!csrfToken) {
      setMessage("Log in to reply.");
      return;
    }

    if (trimmedBody.length === 0) {
      setMessage("Reply cannot be empty.");
      return;
    }

    if (trimmedBody.length > 2000) {
      setMessage("Reply must be 2000 characters or fewer.");
      return;
    }

    setSubmitting(true);
    setMessage(undefined);

    try {
      const reply = await runWithAuth(
        (freshCsrfToken) =>
          createPostReply(
            parentPostId,
            { body: trimmedBody, ...postMediaInputFromDraft(media) },
            freshCsrfToken,
          ),
        { retryOnCsrf: true },
      );

      setBody("");
      setMedia([]);
      setGifPickerOpen(false);
      setMusicPickerOpen(false);
      setPendingImageCrop(undefined);
      onCreated(reply);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Reply could not be posted.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleMediaChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";

    if (!file) {
      return;
    }

    if (!csrfToken) {
      setMessage("Log in to upload media.");
      return;
    }

    if (!canAddMedia) {
      setMessage(`Replies can include up to ${maxPostComposerAttachments} attachments.`);
      return;
    }

    if (isLikelyVideoUploadFile(file)) {
      await uploadVideoMedia(file);
      return;
    }

    if (!isAcceptedImageUploadFile(file)) {
      setMessage(`${imageUploadFormatHelp} ${videoUploadFormatHelp}`);
      return;
    }

    setUploadingMedia(true);
    setMessage(undefined);

    try {
      const prepared = await runWithAuth(
        (freshCsrfToken) =>
          prepareImageFileForCrop(file, "post_media", (sourceFile, purpose) =>
            previewImageUpload(sourceFile, purpose, freshCsrfToken),
          ),
        { retryOnCsrf: true },
      );
      setPendingImageCrop(prepared);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Image could not be prepared.");
    } finally {
      setUploadingMedia(false);
    }
  }

  async function uploadVideoMedia(file: File) {
    const validationError = validatePostVideoFile(file);

    if (validationError) {
      setMessage(validationError);
      return;
    }

    setUploadingMedia(true);
    setMessage(undefined);

    try {
      const uploaded = await runWithAuth(
        (freshCsrfToken) => uploadVideo(file, "post_media", freshCsrfToken),
        { retryOnCsrf: true },
      );
      appendMedia(postMediaDraftFromVideo(uploaded));
      setPendingImageCrop(undefined);
      setMessage("Media attached.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Video could not be uploaded.");
    } finally {
      setUploadingMedia(false);
    }
  }

  async function createAudioAttachmentDraft(file: File): Promise<PostMediaDraft> {
    const validationError = validatePostAudioFile(file);

    if (validationError) {
      setMessage(validationError);
      throw new Error(validationError);
    }

    setUploadingMedia(true);
    setMessage(undefined);

    try {
      const uploaded = await runWithAuth(
        (freshCsrfToken) => uploadAudio(file, "post_media", freshCsrfToken),
        { retryOnCsrf: true },
      );
      setPendingImageCrop(undefined);
      return postMediaDraftFromAudio(uploaded);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Audio could not be uploaded.");
      throw error;
    } finally {
      setUploadingMedia(false);
    }
  }

  const resolveMusicAttachmentDraft = useCallback(
    async (input: {
      provider?: PostMusicAttachmentProvider;
      url: string;
    }): Promise<PostMediaDraft> => {
      const card = await runWithAuth(
        (freshCsrfToken) => resolveProfileIntegrationMetadata(input, freshCsrfToken),
        { retryOnCsrf: true },
      );

      return postMediaDraftFromIntegration(card);
    },
    [runWithAuth],
  );

  const connectMusicProvider = useCallback(
    async (provider: PostMusicAttachmentProvider) => {
      const redirectPath = `${window.location.pathname}${window.location.search}`;
      const result = await runWithAuth(
        (freshCsrfToken) =>
          startProfileIntegration(provider, freshCsrfToken, redirectPath),
        { retryOnCsrf: true },
      );

      if (result.authorizationUrl) {
        window.location.assign(result.authorizationUrl);
      }
    },
    [runWithAuth],
  );

  const loadMusicSuggestions = useCallback(
    (provider: PostMusicAttachmentProvider) =>
      getProfileIntegrationSuggestions(provider),
    [],
  );

  async function uploadCroppedImage(file: File) {
    if (!csrfToken) {
      setMessage("Log in to upload media.");
      throw new Error("Log in to upload media.");
    }

    setUploadingMedia(true);
    setMessage(undefined);

    try {
      const uploaded = await runWithAuth(
        (freshCsrfToken) => uploadImage(file, "post_media", freshCsrfToken),
        { retryOnCsrf: true },
      );
      appendMedia(postMediaDraftFromImage(uploaded));
      setPendingImageCrop(undefined);
      setMessage("Media attached.");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Image could not be uploaded.";
      setMessage(message);
      throw error;
    } finally {
      setUploadingMedia(false);
    }
  }

  function appendMedia(draft: PostMediaDraft) {
    setMedia((current) =>
      current.length >= maxPostComposerAttachments ? current : [...current, draft],
    );
  }

  function handleMusicAttachmentAdd(draft: PostMediaDraft) {
    appendMedia(draft);
    setMessage("Music attached.");
    setMusicPickerOpen(false);
  }

  function handleGifAttachmentAdd(gif: GifSearchResult) {
    if (!canAddMedia) {
      setMessage(`Replies can include up to ${maxPostComposerAttachments} attachments.`);
      return;
    }

    appendMedia(postMediaDraftFromGif(gif));
    setMessage("GIF attached.");
    setGifPickerOpen(false);
  }

  function moveMediaAttachment(index: number, offset: -1 | 1) {
    setMedia((current) => movePostMediaDraft(current, index, index + offset));
  }

  const firstVisualMedia = media.find(isVisualPostMediaDraft);

  return (
    <>
      <form
        className={cn(
          "rounded-card border border-line bg-canvas/45 p-3 shadow-inner-soft",
          className,
        )}
        data-testid="reply-composer"
        onSubmit={(event) => void handleSubmit(event)}
      >
      <MarkdownEditor
        ref={textareaRef}
        label="Reply"
        maxLength={2000}
        minHeightClassName="min-h-28"
        placeholder="Write with Markdown, @mentions, and HTTPS links."
        renderedClassName="text-sm leading-6"
        testIdPrefix="reply-composer-markdown"
        textareaTestId={`reply-composer-${parentPostId}`}
        value={body}
        disabled={submitting}
        onValueChange={setBody}
      />

      <PostMusicAttachmentPicker
        attachmentCount={media.length}
        disabled={submitting || uploadingMedia || !csrfToken}
        limitMessage={`Replies can include up to ${maxPostComposerAttachments} attachments.`}
        loadSuggestions={loadMusicSuggestions}
        maxAttachments={maxPostComposerAttachments}
        onAddAttachment={handleMusicAttachmentAdd}
        onClose={() => setMusicPickerOpen(false)}
        onConnectProvider={connectMusicProvider}
        onResolveMusicUrl={resolveMusicAttachmentDraft}
        onUploadAudio={createAudioAttachmentDraft}
        open={musicPickerOpen}
      />

      {gifPickerOpen ? (
        <GifPicker className="mt-3" onSelect={handleGifAttachmentAdd} />
      ) : null}

      <PostMedia
        className="mt-3"
        maxHeightClass="max-h-56"
        mediaMime={firstVisualMedia?.mime}
        mediaPosterUrl={firstVisualMedia?.posterUrl}
        mediaType={firstVisualMedia?.type ?? null}
        mediaUrl={firstVisualMedia?.url}
        testId="reply-composer-media"
      />
      {media.length > 1 || (media[0] && !isVisualPostMediaDraft(media[0])) ? (
        <PostAttachmentDraftList
          attachments={media}
          disabled={submitting || uploadingMedia}
          onMove={(index, offset) => moveMediaAttachment(index, offset)}
          onRemove={(index) => setMedia((current) => current.filter((_, itemIndex) => itemIndex !== index))}
        />
      ) : null}

      {message ? (
        <p
          className={cn(
            "mt-3 rounded-card border p-3 text-sm",
            message === "Media attached." ||
            message === "GIF attached."
              ? "border-leaf/30 bg-leaf/15 text-leaf-ink"
              : "border-rose/30 bg-rose/15 text-rose-ink",
          )}
        >
          {message}
        </p>
      ) : null}

      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <span className="text-xs text-muted" aria-live="polite">
          {body.length}/2000
        </span>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {media.length > 0 ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={submitting || uploadingMedia}
              icon={<Trash2 aria-hidden="true" size={15} />}
              onClick={() => setMedia([])}
            >
              Remove all
            </Button>
          ) : null}
          <label className="inline-flex min-h-9 cursor-pointer items-center justify-center gap-2 rounded-control border border-line bg-surface px-3 text-sm font-medium text-text shadow-soft transition duration-fluid hover:border-line-strong focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-focus">
            <ImagePlus aria-hidden="true" size={15} />
            {uploadingMedia
              ? "Uploading"
              : media.length > 0
                ? "Add media"
                : "Upload media"}
            <input
              className="sr-only"
              type="file"
              accept={visualMediaUploadAccept}
              disabled={submitting || uploadingMedia || !canAddMedia}
              onChange={(event) => void handleMediaChange(event)}
            />
          </label>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={submitting || uploadingMedia || !canAddMedia || !csrfToken}
            icon={<ImagePlay aria-hidden="true" size={15} />}
            onClick={() => setGifPickerOpen((current) => !current)}
          >
            GIF
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={submitting || uploadingMedia || !canAddMedia || !csrfToken}
            icon={<Music2 aria-hidden="true" size={15} />}
            onClick={() => setMusicPickerOpen((current) => !current)}
          >
            Music
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={submitting}
            onClick={onCancel}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            size="sm"
            disabled={!canSubmit}
            icon={<Send aria-hidden="true" size={15} />}
          >
            {submitting ? "Sending..." : "Send"}
          </Button>
        </div>
      </div>
      </form>
      <ImageCropModal
        open={Boolean(pendingImageCrop)}
        file={pendingImageCrop}
        purpose="post_media"
        busy={uploadingMedia}
        onClose={() => setPendingImageCrop(undefined)}
        onApply={uploadCroppedImage}
      />
    </>
  );
}

const maxPostComposerAttachments = 8;

type PostAttachmentDraftListProps = {
  attachments: PostMediaDraft[];
  disabled: boolean;
  onMove: (index: number, offset: -1 | 1) => void;
  onRemove: (index: number) => void;
};

function PostAttachmentDraftList({
  attachments,
  disabled,
  onMove,
  onRemove,
}: PostAttachmentDraftListProps) {
  return (
    <div className="mt-3 grid gap-2" data-testid="reply-composer-attachments">
      {attachments.map((attachment, index) => (
        <div
          key={`${postMediaDraftKey(attachment)}-${index}`}
          className="flex min-w-0 items-center gap-3 rounded-card border border-line bg-canvas/45 p-2"
          data-testid="reply-composer-attachment"
        >
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold uppercase tracking-[0.08em] text-muted">
              {attachment.type === "audio"
                ? "MP3"
                : attachment.type === "integration"
                  ? providerLabel(attachment.provider)
                  : attachment.type === "gif"
                    ? "KLIPY GIF"
                  : attachment.type}
            </p>
            {attachment.type === "audio" ? (
              <audio className="mt-1 w-full" controls preload="metadata">
                <source src={attachment.url} type={attachment.mime} />
              </audio>
            ) : attachment.type === "integration" ? (
              <p className="truncate text-sm text-text">
                {attachment.card.metadata.title ?? providerLabel(attachment.provider)}
              </p>
            ) : attachment.type === "gif" ? (
              <p className="truncate text-sm text-text">GIF attachment</p>
            ) : (
              <p className="truncate text-sm text-text">Attachment {index + 1}</p>
            )}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 rounded-full"
            disabled={disabled || index === 0}
            aria-label={`Move attachment ${index + 1} earlier`}
            title="Move earlier"
            onClick={() => onMove(index, -1)}
          >
            <ArrowUp aria-hidden="true" size={14} />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 rounded-full"
            disabled={disabled || index === attachments.length - 1}
            aria-label={`Move attachment ${index + 1} later`}
            title="Move later"
            onClick={() => onMove(index, 1)}
          >
            <ArrowDown aria-hidden="true" size={14} />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 rounded-full"
            disabled={disabled}
            aria-label={`Remove attachment ${index + 1}`}
            title="Remove attachment"
            onClick={() => onRemove(index)}
          >
            <Trash2 aria-hidden="true" size={14} />
          </Button>
        </div>
      ))}
    </div>
  );
}

function movePostMediaDraft(
  attachments: PostMediaDraft[],
  fromIndex: number,
  toIndex: number,
): PostMediaDraft[] {
  if (toIndex < 0 || toIndex >= attachments.length || fromIndex === toIndex) {
    return attachments;
  }

  const next = [...attachments];
  const [item] = next.splice(fromIndex, 1);

  if (item === undefined) {
    return attachments;
  }

  next.splice(toIndex, 0, item);

  return next;
}

function isVisualPostMediaDraft(
  attachment: PostMediaDraft,
): attachment is PostVisualMediaDraft {
  return attachment.type === "image" || attachment.type === "video";
}

function postMediaDraftKey(attachment: PostMediaDraft): string {
  return attachment.type === "integration" || attachment.type === "gif"
    ? attachment.resourceKey
    : attachment.url;
}

function providerLabel(provider: "spotify" | "youtube"): string {
  return provider === "spotify" ? "Spotify" : "YouTube";
}

type ThreadModalProps = {
  open: boolean;
  post: Post;
  authStatus: AuthStatus;
  csrfToken: string | undefined;
  initialComposerOpen: boolean;
  runWithAuth: <T>(
    task: (csrfToken: string) => Promise<T>,
    options?: { retryOnCsrf?: boolean },
  ) => Promise<T>;
  canDeleteRoot: boolean;
  actionPending: boolean;
  onClose: () => void;
  onRootDelete: () => void | Promise<void>;
  onReplyCreated: (post: Post) => void;
  onReplyDeleted: (post: Post) => void;
};

function ThreadModal({
  open,
  post,
  authStatus,
  csrfToken,
  initialComposerOpen,
  runWithAuth,
  canDeleteRoot,
  actionPending,
  onClose,
  onRootDelete,
  onReplyCreated,
  onReplyDeleted,
}: ThreadModalProps) {
  const canReplyToThread = roomAllowsPosting(post.room);
  const [replies, setReplies] = useState<Post[]>([]);
  const [composerOpen, setComposerOpen] = useState(initialComposerOpen && canReplyToThread);
  const [modalCommentCount, setModalCommentCount] = useState(post.commentCount);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string>();
  const isCheckingAuth = authStatus === "loading";
  const isAuthenticated = authStatus === "authenticated" && Boolean(csrfToken);
  const replyCountLabel = `${modalCommentCount} ${
    modalCommentCount === 1 ? "reply" : "replies"
  }`;

  useEffect(() => {
    if (!open) {
      return;
    }

    let active = true;

    queueMicrotask(() => {
      if (!active) {
        return;
      }

      setLoading(true);
      setLoadError(undefined);

      getPostReplies(post.id)
        .then((items) => {
          if (active) {
            setReplies(items);
          }
        })
        .catch(() => {
          if (active) {
            setReplies([]);
            setLoadError("Replies could not load right now.");
          }
        })
        .finally(() => {
          if (active) {
            setLoading(false);
          }
        });
    });

    return () => {
      active = false;
    };
  }, [open, post.id]);

  function handleReplyCreated(reply: Post) {
    setReplies((current) => [...current, reply]);
    setModalCommentCount((current) => current + 1);
    setComposerOpen(false);
    onReplyCreated(reply);
  }

  function handleReplyDeleted(reply: Post) {
    setReplies((current) => current.filter((item) => item.id !== reply.id));
    setModalCommentCount((current) => Math.max(0, current - 1));
    onReplyDeleted(reply);
  }

  return (
    <ModalSheet
      open={open}
      onClose={onClose}
      title="Thread"
      description={`@${post.author.handle} · ${replyCountLabel}`}
      closeLabel="Close thread"
      testId="thread-modal"
      size="xl"
      mobile="full"
      headerAlign="center"
      panelClassName="sm:max-h-[min(820px,calc(100dvh-3rem))]"
      bodyClassName="px-3 py-4 sm:px-5 lg:px-7 lg:py-6"
    >
              <div
                className="mx-auto max-w-3xl overflow-hidden rounded-panel border border-line bg-canvas/24 shadow-inner-soft"
                data-testid="thread-conversation"
              >
                <ParentPostPreview
                  post={post}
                  hasReplyConnector={loading || replies.length > 0}
                  actionRow={
                    <ReactionControls
                      post={post}
                      commentCount={modalCommentCount}
                      initialLikeCount={post.likeCount}
                      initiallyLiked={post.likedByCurrentUser}
                      onOpenThread={() => {
                        if (canReplyToThread) {
                          setComposerOpen(true);
                        }
                      }}
                      compact
                      actions={
                        canDeleteRoot ? (
                          <PostActionIconButton
                            label="Delete post"
                            disabled={actionPending}
                            variant="ghost"
                            icon={<Trash2 aria-hidden="true" size={15} />}
                            onClick={onRootDelete}
                          />
                        ) : null
                      }
                    />
                  }
                />

                {isAuthenticated && composerOpen && canReplyToThread ? (
                  <div className="border-b border-line/70 px-4 py-3 sm:px-5">
                    <ReplyComposer
                      autoFocus
                      parentPostId={post.id}
                      csrfToken={csrfToken}
                      runWithAuth={runWithAuth}
                      onCancel={() => setComposerOpen(false)}
                      onCreated={handleReplyCreated}
                    />
                  </div>
                ) : canReplyToThread && isCheckingAuth ? (
                  <div className="border-b border-line/70 px-4 py-3 sm:px-5">
                    <ThreadStateNotice
                      kind="loading"
                      title="Checking session"
                      text="Confirming you can reply."
                    />
                  </div>
                ) : canReplyToThread && !isAuthenticated ? (
                  <div className="flex flex-col gap-3 border-b border-line/70 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                    <p className="text-sm text-muted">Log in to reply.</p>
                    <ButtonLink to="/login" size="sm" onClick={onClose}>
                      Log in
                    </ButtonLink>
                  </div>
                ) : null}

                <div className="px-4 sm:px-5">
                  {loading ? (
                    <ThreadStateNotice
                      kind="loading"
                      title="Loading replies"
                      text="Fetching this thread."
                    />
                  ) : null}
                  {loadError ? (
                    <ThreadStateNotice
                      kind="error"
                      title="Replies are not available"
                      text={loadError}
                    />
                  ) : null}
                  {!loading && !loadError && replies.length === 0 ? (
                    <ThreadStateNotice
                      title="No replies yet"
                      text="Start the conversation with a reply."
                    />
                  ) : null}
                  <div data-testid="thread-replies">
                    <AnimatePresence initial={false}>
                      {replies.map((reply, replyIndex) => (
                        <ReplyPreview
                          key={reply.id}
                          reply={reply}
                          index={replyIndex}
                          siblingCount={replies.length}
                          onDeleted={handleReplyDeleted}
                        />
                      ))}
                    </AnimatePresence>
                  </div>
                </div>
              </div>
    </ModalSheet>
  );
}

function ParentPostPreview({
  post,
  hasReplyConnector,
  actionRow,
}: {
  post: Post;
  hasReplyConnector: boolean;
  actionRow: ReactNode;
}) {
  return (
    <article
      className="relative border-b border-line/70 bg-surface/36 px-4 pb-3 pt-5 sm:px-5 sm:pt-6"
      data-testid="thread-root-post"
    >
      {hasReplyConnector ? (
        <span
          className={cn(
            threadRailLineClass,
            "bottom-0 left-[2.375rem] top-11 sm:left-11 sm:top-12",
          )}
          aria-hidden="true"
          data-testid="thread-rail-line-after"
        />
      ) : null}
      <div className="grid grid-cols-[2.75rem_1fr] gap-3 sm:grid-cols-[3rem_1fr]">
        <ThreadAvatarRail
          user={post.author}
          href={`/@${post.author.handle}`}
          ariaLabel={`${post.author.displayName}'s profile`}
        />
        <div className="min-w-0 pb-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <Link
              to={`/@${post.author.handle}`}
              className="text-sm font-semibold text-text underline-offset-4 hover:text-accent-strong hover:underline"
            >
              {post.author.displayName}
            </Link>
            <Link
              to={`/@${post.author.handle}`}
              className="text-sm text-muted underline-offset-4 hover:text-accent-strong hover:underline"
            >
              @{post.author.handle}
            </Link>
            <span className="text-muted/50">·</span>
            <span className="text-sm text-muted">{post.createdAt}</span>
            <PostMetaChips post={post} />
          </div>
          <RichText
            text={post.body}
            entities={post.bodyEntities}
            markdown={post.bodyFormat === "markdown"}
            className="mt-3 block whitespace-pre-wrap break-words text-pretty text-base leading-7 text-text sm:text-[1.0625rem] sm:leading-8"
          />
          <PostAttachments className="mt-3" post={post} />
          <div data-testid="thread-root-actions">{actionRow}</div>
        </div>
      </div>
    </article>
  );
}

function ThreadStateNotice({
  kind = "neutral",
  text,
  title,
}: {
  kind?: "neutral" | "loading" | "error";
  text: string;
  title: string;
}) {
  const Icon =
    kind === "loading" ? LoaderCircle : kind === "error" ? WifiOff : MessageCircle;

  return (
    <CompactStateNotice
      centered
      className="my-3 rounded-card bg-surface/50"
      testId="thread-state"
      icon={Icon}
      kind={kind}
      title={title}
      text={text}
    />
  );
}

type ReplyPreviewProps = {
  reply: Post;
  depth?: number;
  index: number;
  siblingCount: number;
  onDeleted: (reply: Post) => void;
};

function ReplyPreview({
  reply,
  depth = 0,
  index,
  siblingCount,
  onDeleted,
}: ReplyPreviewProps) {
  const { csrfToken, runWithAuth, status, user } = useAuth();
  const [composerOpen, setComposerOpen] = useState(false);
  const [childrenOpen, setChildrenOpen] = useState(false);
  const [childReplies, setChildReplies] = useState<Post[]>([]);
  const [childrenLoading, setChildrenLoading] = useState(false);
  const [childrenError, setChildrenError] = useState<string>();
  const [deletePending, setDeletePending] = useState(false);
  const [deleteError, setDeleteError] = useState<string>();
  const [localCommentCount, setLocalCommentCount] = useState(reply.commentCount);
  const isAuthenticated = status === "authenticated" && Boolean(csrfToken);
  const allowDelete = canDeletePost(user, reply);
  const canReplyToReply = roomAllowsPosting(reply.room);
  const canNest = depth < 3;
  const hasNextVisibleSibling = index < siblingCount - 1;
  const hasVisibleNestedReplies = childrenOpen && childReplies.length > 0;
  const hasSameDepthLineBefore = depth === 0 || index > 0;
  const hasLineAfter = hasNextVisibleSibling || hasVisibleNestedReplies;

  async function loadChildren() {
    if (childrenLoading || childReplies.length > 0) {
      setChildrenOpen((open) => !open);
      return;
    }

    setChildrenOpen(true);
    setChildrenLoading(true);
    setChildrenError(undefined);

    try {
      setChildReplies(await getPostReplies(reply.id));
    } catch {
      setChildrenError("Replies could not load right now.");
    } finally {
      setChildrenLoading(false);
    }
  }

  async function handleDeleteReply() {
    if (!allowDelete || deletePending) {
      return;
    }

    setDeletePending(true);
    setDeleteError(undefined);

    try {
      await runWithAuth(
        (freshCsrfToken) => deletePost(reply.id, freshCsrfToken),
        { retryOnCsrf: true },
      );
      onDeleted(reply);
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : "Reply could not be deleted.");
    } finally {
      setDeletePending(false);
    }
  }

  function handleNestedReplyCreated(child: Post) {
    setChildReplies((current) => [...current, child]);
    setChildrenOpen(true);
    setComposerOpen(false);
    setLocalCommentCount((current) => current + 1);
  }

  function handleNestedReplyDeleted(child: Post) {
    setChildReplies((current) => current.filter((item) => item.id !== child.id));
    setLocalCommentCount((current) => Math.max(0, current - 1));
  }

  return (
    <motion.article
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ type: "spring", stiffness: 260, damping: 26 }}
      className={cn(
        "relative py-2.5 first:pt-3 last:pb-3 sm:py-3",
        depth > 0 && nestedReplyOffsetClass(depth),
      )}
      data-render-deferred="post-reply"
      data-testid="thread-reply-item"
    >
      {hasSameDepthLineBefore ? (
        <span
          className={cn(
            threadRailLineClass,
            "left-[1.375rem] top-0 h-9 sm:left-6",
          )}
          aria-hidden="true"
          data-testid="thread-rail-line-before"
        />
      ) : null}
      {hasLineAfter ? (
        <span
          className={cn(
            threadRailLineClass,
            "bottom-0 left-[1.375rem] top-9 sm:left-6",
          )}
          aria-hidden="true"
          data-testid="thread-rail-line-after"
        />
      ) : null}
      <div className="grid grid-cols-[2.75rem_1fr] gap-3 sm:grid-cols-[3rem_1fr]">
        <ThreadAvatarRail
          user={reply.author}
          href={`/@${reply.author.handle}`}
          ariaLabel={`${reply.author.displayName}'s profile`}
          hasBranch={depth > 0}
          branchClassName={threadBranchClass(depth)}
        />
        <div
          className="min-w-0 py-1"
          data-testid="thread-reply-content"
        >
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <Link
              to={`/@${reply.author.handle}`}
              className="text-sm font-semibold text-text underline-offset-4 hover:text-accent-strong hover:underline"
            >
              {reply.author.displayName}
            </Link>
            <Link
              to={`/@${reply.author.handle}`}
              className="text-sm text-muted underline-offset-4 hover:text-accent-strong hover:underline"
            >
              @{reply.author.handle}
            </Link>
            <span className="text-muted/50">·</span>
            <span className="text-sm text-muted">{reply.createdAt}</span>
          </div>
          <RichText
            text={reply.body}
            entities={reply.bodyEntities}
            markdown={reply.bodyFormat === "markdown"}
            className="mt-2 block whitespace-pre-wrap break-words text-pretty text-sm leading-6 text-text"
          />
          <PostAttachments className="mt-3" musicLayout="compact" post={reply} />

          <div data-testid="thread-reply-actions">
            <ReactionControls
              post={reply}
              commentCount={localCommentCount}
              initialLikeCount={reply.likeCount}
              initiallyLiked={reply.likedByCurrentUser}
              onOpenThread={() => {
                if (canReplyToReply) {
                  setComposerOpen(true);
                }
              }}
              compact
              actions={
                allowDelete ? (
                  <PostActionIconButton
                    label="Delete reply"
                    disabled={deletePending}
                    variant="ghost"
                    icon={<Trash2 aria-hidden="true" size={15} />}
                    onClick={() => void handleDeleteReply()}
                  />
                ) : null
              }
            />
          </div>

          {deleteError ? (
            <p className="mt-2 text-xs font-medium text-rose-ink">
              {deleteError}
            </p>
          ) : null}

          {canNest && (localCommentCount > 0 || childReplies.length > 0) ? (
            <div className="mt-2" data-testid="thread-nested-toggle">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => void loadChildren()}
              >
                {childrenOpen ? "Hide replies" : `Show ${localCommentCount} ${localCommentCount === 1 ? "reply" : "replies"}`}
              </Button>
            </div>
          ) : null}

          {childrenError ? (
            <CompactStateNotice
              className="mt-2"
              icon={WifiOff}
              kind="error"
              title="Nested replies are not available"
              text={childrenError}
            />
          ) : null}
          {childrenLoading ? (
            <CompactStateNotice
              className="mt-2"
              icon={LoaderCircle}
              kind="loading"
              title="Loading nested replies"
              text="Fetching the next replies."
            />
          ) : null}
        </div>
      </div>

      {isAuthenticated && composerOpen && canReplyToReply ? (
        <div className="mt-2 grid grid-cols-[2.75rem_1fr] gap-3 sm:grid-cols-[3rem_1fr]">
          <span aria-hidden="true" />
          <ReplyComposer
            autoFocus
            parentPostId={reply.id}
            csrfToken={csrfToken}
            runWithAuth={runWithAuth}
            onCancel={() => setComposerOpen(false)}
            onCreated={handleNestedReplyCreated}
          />
        </div>
      ) : null}

      {childrenOpen && childReplies.length > 0 ? (
        <div data-testid="thread-nested-replies">
          {childReplies.map((child, childIndex) => (
            <ReplyPreview
              key={child.id}
              reply={child}
              depth={depth + 1}
              index={childIndex}
              siblingCount={childReplies.length}
              onDeleted={handleNestedReplyDeleted}
            />
          ))}
        </div>
      ) : null}
    </motion.article>
  );
}

function nestedReplyOffsetClass(depth: number) {
  if (depth === 1) {
    return "ml-4 sm:ml-8";
  }

  if (depth === 2) {
    return "ml-6 sm:ml-12";
  }

  return "ml-8 sm:ml-14";
}

function threadBranchClass(depth: number) {
  if (depth === 1) {
    return "w-4 sm:w-8";
  }

  if (depth === 2) {
    return "w-6 sm:w-12";
  }

  return "w-8 sm:w-14";
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
        "inline-flex min-h-10 items-center gap-2 rounded-full border px-4 text-base leading-none shadow-soft transition duration-fluid ease-fluid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-wait",
        liked
          ? "border-rose/25 bg-rose/24 text-rose-ink shadow-inner-soft"
          : "border-line bg-surface/80 text-muted hover:border-line-strong hover:bg-surface-strong hover:text-text",
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
        <Heart size={17} fill={liked ? "currentColor" : "none"} />
      </motion.span>
      <span className="tabular-nums">{count}</span>
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
        "inline-flex min-h-10 items-center gap-2 rounded-full border px-4 text-base leading-none shadow-soft transition duration-fluid ease-fluid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-55",
        reblogged
          ? "border-leaf/25 bg-leaf/24 text-leaf-ink shadow-inner-soft"
          : "border-line bg-surface/80 text-muted hover:border-line-strong hover:bg-surface-strong hover:text-text",
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
        <Repeat2 size={17} />
      </motion.span>
      <span className="tabular-nums">{count}</span>
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
        "inline-flex size-8 items-center justify-center rounded-full transition duration-fluid ease-fluid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-wait disabled:opacity-55",
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

function validatePostVideoFile(file: File): string | undefined {
  if (file.size <= 0) {
    return "Video cannot be empty.";
  }

  if (file.size > 100 * 1024 * 1024) {
    return "Video must be 100 MB or smaller.";
  }

  if (!isAcceptedVideoUploadFile(file)) {
    return videoUploadFormatHelp;
  }

  return undefined;
}

function validatePostAudioFile(file: File): string | undefined {
  if (file.size <= 0) {
    return "Audio cannot be empty.";
  }

  if (file.size > 20 * 1024 * 1024) {
    return "Audio must be 20 MB or smaller.";
  }

  if (!isAcceptedAudioUploadFile(file)) {
    return audioUploadFormatHelp;
  }

  return undefined;
}
