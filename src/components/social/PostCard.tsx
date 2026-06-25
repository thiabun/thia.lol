import {
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
  EyeOff,
  Heart,
  ImagePlus,
  LoaderCircle,
  MessageCircle,
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
import { ImageCropModal } from "../ui/ImageCropModal";
import { ModalSheet } from "../ui/ModalSheet";
import { Panel } from "../ui/Panel";
import { CompactStateNotice } from "../ui/RouteState";
import { InlineUserProfileLink } from "./UserProfileLink";
import { MentionTextarea } from "./MentionTextarea";
import { PostShareModal } from "./PostShareModal";
import { ReportForm } from "./ReportForm";
import { RichText } from "./RichText";
import {
  deletePost,
  createPostReply,
  getPostReplies,
  likePost,
  reblogPost,
  unreblogPost,
  unlikePost,
  uploadImage,
} from "../../lib/api";
import { cn } from "../../lib/classNames";
import { validateImageCropFile } from "../../lib/imageCrop";
import { imageUploadAccept } from "../../lib/mediaFormats";
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
import type { Post } from "../../lib/types";
import { useAuth } from "../../lib/useAuth";
import { canDeletePost } from "../../lib/postPermissions";

type PostCardProps = {
  post: Post;
  index?: number;
  canDelete?: boolean;
  canHide?: boolean;
  actionPending?: boolean;
  onDelete?: (post: Post) => void;
  onHide?: (post: Post) => void;
};

export function PostCard({
  post,
  index = 0,
  canDelete = false,
  canHide = false,
  actionPending = false,
  onDelete,
  onHide,
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
    setThreadComposerOpen(Boolean(options?.compose && canReplyToPost));
    setThreadOpen(true);
  }

  function handleCardClick(event: ReactMouseEvent<HTMLElement>) {
    if (isThreadOpenIgnoredTarget(event.target)) {
      return;
    }

    openThread();
  }

  function handleCardKeyDown(event: ReactKeyboardEvent<HTMLElement>) {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    if (isThreadOpenIgnoredTarget(event.target)) {
      return;
    }

    event.preventDefault();
    openThread();
  }

  const cardMotionProps = threadOpen
    ? {}
    : { whileHover: cardHover, whileTap: cardTap };

  if (locallyDeleted) {
    return null;
  }

  return (
    <>
      <motion.article
        id={`post-${post.id}`}
        aria-label={`Open thread by ${post.author.displayName}`}
        className="group mx-auto w-full max-w-[38rem] cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-focus"
        data-testid="post-card-open-thread"
        tabIndex={0}
        variants={cardEntrance}
        custom={index}
        initial="hidden"
        animate="show"
        onClick={handleCardClick}
        onKeyDown={handleCardKeyDown}
        {...cardMotionProps}
      >
        <Panel className="overflow-hidden p-4 transition duration-fluid ease-fluid group-hover:border-line-strong group-hover:shadow-lift sm:p-5">
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
            className="mt-4 block w-full text-left"
          >
            <RichText
              text={post.body}
              entities={post.bodyEntities}
              className="block whitespace-pre-wrap break-words p-1 text-pretty text-base leading-7 text-text"
            />

            <PostMedia mediaUrl={post.mediaUrl} />
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

function isThreadOpenIgnoredTarget(target: EventTarget | null) {
  if (!(target instanceof Element)) {
    return true;
  }

  return Boolean(
    target.closest(
      [
        "a",
        "button",
        "input",
        "iframe",
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
      ].join(","),
    ),
  );
}

type PostMediaProps = {
  className?: string;
  maxHeightClass?: string;
  mediaUrl: string | null | undefined;
  testId?: string;
};

function PostMedia({
  className = "mt-4",
  maxHeightClass = "max-h-[min(70vh,34rem)]",
  mediaUrl,
  testId = "post-media",
}: PostMediaProps) {
  if (!mediaUrl || mediaUrl === "/ambient-veil.webp") {
    return null;
  }

  return (
    <span className={cn("block max-w-full", className)} data-testid={testId}>
      <span className="inline-flex w-fit max-w-full overflow-hidden rounded-card border border-line bg-canvas/70 align-top">
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
      </span>
    </span>
  );
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

function PostMetaChips({ post }: { post: Post }) {
  if (!post.room) {
    return null;
  }

  return (
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
  );
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
      className="inline-flex min-h-8 items-center gap-1.5 rounded-full px-2.5 text-sm leading-none transition duration-fluid ease-fluid hover:bg-surface-strong hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      aria-label={`Open replies. ${count} ${count === 1 ? "reply" : "replies"}.`}
      title="Replies"
      onClick={onClick}
      whileHover={buttonHover}
      whileTap={buttonTap}
    >
      <MessageCircle aria-hidden="true" size={15} />
      <span className="tabular-nums">{count}</span>
    </motion.button>
  );
}

type ReplyComposerProps = {
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

function ReplyComposer({
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
  const [mediaUrl, setMediaUrl] = useState<string | undefined>();
  const [pendingImageCrop, setPendingImageCrop] = useState<File | undefined>();
  const [uploadingImage, setUploadingImage] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | undefined>();
  const trimmedBody = body.trim();
  const canSubmit =
    Boolean(csrfToken) &&
    trimmedBody.length > 0 &&
    trimmedBody.length <= 2000 &&
    !submitting &&
    !uploadingImage;

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
            mediaUrl ? { body: trimmedBody, mediaUrl } : { body: trimmedBody },
            freshCsrfToken,
          ),
        { retryOnCsrf: true },
      );

      setBody("");
      setMediaUrl(undefined);
      setPendingImageCrop(undefined);
      onCreated(reply);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Reply could not be posted.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";

    if (!file) {
      return;
    }

    if (!csrfToken) {
      setMessage("Log in to upload an image.");
      return;
    }

    const validationError = validateImageCropFile(file);

    if (validationError) {
      setMessage(validationError);
      return;
    }

    setMessage(undefined);
    setPendingImageCrop(file);
  }

  async function uploadCroppedImage(file: File) {
    if (!csrfToken) {
      setMessage("Log in to upload an image.");
      throw new Error("Log in to upload an image.");
    }

    setUploadingImage(true);
    setMessage(undefined);

    try {
      const uploaded = await runWithAuth(
        (freshCsrfToken) => uploadImage(file, "post_media", freshCsrfToken),
        { retryOnCsrf: true },
      );
      setMediaUrl(uploaded.url);
      setPendingImageCrop(undefined);
      setMessage("Image attached.");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Image could not be uploaded.";
      setMessage(message);
      throw error;
    } finally {
      setUploadingImage(false);
    }
  }

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
      <label className="block" htmlFor={`reply-composer-${parentPostId}`}>
        <span className="mb-2 flex items-center gap-2 text-sm font-medium text-text">
          Reply
        </span>
        <MentionTextarea
          ref={textareaRef}
          id={`reply-composer-${parentPostId}`}
          rows={3}
          maxLength={2000}
          className="min-h-20 w-full resize-none rounded-card border border-line bg-surface/70 px-4 py-3 text-sm leading-6 text-text shadow-inner-soft outline-none transition duration-fluid placeholder:text-muted/70 focus:border-line-strong focus:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          placeholder="Write a reply"
          value={body}
          disabled={submitting}
          onValueChange={setBody}
        />
      </label>

      <PostMedia
        className="mt-3"
        maxHeightClass="max-h-56"
        mediaUrl={mediaUrl}
        testId="reply-composer-media"
      />

      {message ? (
        <p
          className={cn(
            "mt-3 rounded-card border p-3 text-sm",
            message === "Image attached."
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
          {mediaUrl ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={submitting || uploadingImage}
              icon={<Trash2 aria-hidden="true" size={15} />}
              onClick={() => setMediaUrl(undefined)}
            >
              Remove
            </Button>
          ) : null}
          <label className="inline-flex min-h-9 cursor-pointer items-center justify-center gap-2 rounded-control border border-line bg-surface px-3 text-sm font-medium text-text shadow-soft transition duration-fluid hover:border-line-strong focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-focus">
            <ImagePlus aria-hidden="true" size={15} />
            {uploadingImage ? "Uploading" : mediaUrl ? "Replace image" : "Upload image"}
            <input
              className="sr-only"
              type="file"
              accept={imageUploadAccept}
              disabled={submitting || uploadingImage}
              onChange={(event) => void handleImageChange(event)}
            />
          </label>
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
        busy={uploadingImage}
        onClose={() => setPendingImageCrop(undefined)}
        onApply={uploadCroppedImage}
      />
    </>
  );
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
            className="mt-3 block whitespace-pre-wrap break-words text-pretty text-base leading-7 text-text sm:text-[1.0625rem] sm:leading-8"
          />
          <PostMedia className="mt-3" mediaUrl={post.mediaUrl} />
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
            className="mt-2 block whitespace-pre-wrap break-words text-pretty text-sm leading-6 text-text"
          />
          <PostMedia className="mt-3" mediaUrl={reply.mediaUrl} />

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
        "inline-flex min-h-8 items-center gap-1.5 rounded-full px-2.5 text-sm leading-none transition duration-fluid ease-fluid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-wait",
        liked
          ? "bg-rose/20 text-rose-ink shadow-inner-soft"
          : "hover:bg-surface-strong hover:text-text",
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
        <Heart size={15} fill={liked ? "currentColor" : "none"} />
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
        "inline-flex min-h-8 items-center gap-1.5 rounded-full px-2.5 text-sm leading-none transition duration-fluid ease-fluid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-55",
        reblogged
          ? "bg-leaf/20 text-leaf-ink shadow-inner-soft"
          : "hover:bg-surface-strong hover:text-text",
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
        <Repeat2 size={15} />
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

function roomAllowsPosting(room: Post["room"] | null | undefined): boolean {
  if (room === null || room === undefined || !("viewerCanPost" in room)) {
    return true;
  }

  return room.viewerCanPost === true;
}
