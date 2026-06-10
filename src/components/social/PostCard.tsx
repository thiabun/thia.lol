import {
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  EyeOff,
  Flag,
  Heart,
  MessageCircle,
  Repeat2,
  Send,
  Trash2,
  X,
} from "lucide-react";
import { createPortal } from "react-dom";
import { Link } from "react-router";
import { AnimatePresence, motion } from "motion/react";
import { Avatar } from "../ui/Avatar";
import { Badge } from "../ui/Badge";
import { Button, ButtonLink } from "../ui/Button";
import { SelectField, TextareaField } from "../ui/Field";
import { Panel } from "../ui/Panel";
import {
  createReport,
  createPostReply,
  getPostReplies,
  likePost,
  reblogPost,
  unreblogPost,
  unlikePost,
  type ReportCategory,
} from "../../lib/api";
import { cn } from "../../lib/classNames";
import {
  buttonHover,
  buttonTap,
  cardEntrance,
  cardHover,
  cardTap,
  modalOverlay,
  modalPanel,
  pulsePop,
  softSpring,
} from "../../lib/motionPresets";
import type { AuthStatus } from "../../lib/authTypes";
import type { Post } from "../../lib/types";
import { useAuth } from "../../lib/useAuth";

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
  const showActions = canDelete || canHide;

  return (
    <motion.article
      id={`post-${post.id}`}
      className="group"
      variants={cardEntrance}
      custom={index}
      initial="hidden"
      animate="show"
      whileHover={cardHover}
      whileTap={cardTap}
    >
      <Panel className="overflow-hidden p-4 transition duration-fluid ease-fluid group-hover:border-line-strong group-hover:shadow-lift sm:p-5">
        {post.rebloggedBy ? (
          <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-muted">
            <Repeat2 aria-hidden="true" size={14} />
            <span>@{post.rebloggedBy.handle} reblogged</span>
          </div>
        ) : null}
        <div className="flex items-start gap-3">
          <Avatar user={post.author} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <h2 className="text-sm font-semibold text-text">
                {post.author.displayName}
              </h2>
              <span className="text-sm text-muted">@{post.author.handle}</span>
              <span className="text-muted/50">·</span>
              <span className="text-sm text-muted">{post.createdAt}</span>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge tone="warm">{post.room.name}</Badge>
              <PostSocialProof post={post} />
            </div>
          </div>
        </div>

        <p className="mt-4 text-pretty text-base leading-7 text-text">{post.body}</p>

        {post.mediaUrl && post.mediaUrl !== "/ambient-veil.webp" ? (
          <div className="mt-4 overflow-hidden rounded-card border border-line bg-canvas">
            <img
              src={post.mediaUrl}
              alt=""
              className="aspect-[16/9] w-full object-cover"
              loading="lazy"
              decoding="async"
            />
          </div>
        ) : null}

        <ReactionControls
          key={`${post.id}:${post.likeCount}:${post.likedByCurrentUser}:${post.reblogCount}:${post.rebloggedByMe}:${post.rebloggedByCurrentUser}:${post.commentCount}`}
          post={post}
          initialLikeCount={post.likeCount}
          initiallyLiked={post.likedByCurrentUser}
          actions={
            showActions ? (
              <>
                {canHide ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={actionPending}
                    icon={<EyeOff aria-hidden="true" size={15} />}
                    onClick={() => onHide?.(post)}
                  >
                    Hide
                  </Button>
                ) : null}
                {canDelete ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={actionPending}
                    icon={<Trash2 aria-hidden="true" size={15} />}
                    onClick={() => onDelete?.(post)}
                  >
                    Delete
                  </Button>
                ) : null}
              </>
            ) : null
          }
        />
      </Panel>
    </motion.article>
  );
}

function PostSocialProof({ post }: { post: Post }) {
  const relationship = post.socialContext?.authorRelationship;
  const followedLikeCount = post.socialContext?.likedByFollowedCount ?? 0;

  return (
    <>
      {relationship === "moot" ? <Badge tone="leaf">Moot</Badge> : null}
      {relationship === "following" ? <Badge tone="cool">Following</Badge> : null}
      {relationship === "self" ? <Badge>You</Badge> : null}
      {followedLikeCount > 0 ? (
        <Badge tone="warm">
          Liked by {followedLikeCount === 1 ? "someone you follow" : "people you follow"}
        </Badge>
      ) : null}
    </>
  );
}

type ReactionControlsProps = {
  post: Post;
  initialLikeCount: number;
  initiallyLiked: boolean;
  actions: ReactNode;
};

function ReactionControls({
  post,
  initialLikeCount,
  initiallyLiked,
  actions,
}: ReactionControlsProps) {
  const { csrfToken, runWithAuth, status, user } = useAuth();
  const [likeCount, setLikeCount] = useState(initialLikeCount);
  const [liked, setLiked] = useState(initiallyLiked);
  const [reblogCount, setReblogCount] = useState(post.reblogCount ?? 0);
  const [reblogged, setReblogged] = useState(
    post.rebloggedByMe ?? post.rebloggedByCurrentUser ?? false,
  );
  const [commentCount, setCommentCount] = useState(post.commentCount);
  const [threadOpen, setThreadOpen] = useState(false);
  const [likePending, setLikePending] = useState(false);
  const [likePulse, setLikePulse] = useState(0);
  const [likeError, setLikeError] = useState<string>();
  const [reblogPending, setReblogPending] = useState(false);
  const [reblogPulse, setReblogPulse] = useState(0);
  const [reblogError, setReblogError] = useState<string>();
  const [reportOpen, setReportOpen] = useState(false);
  const [reportCategory, setReportCategory] = useState<ReportCategory>("harassment");
  const [reportDetails, setReportDetails] = useState("");
  const [reportPending, setReportPending] = useState(false);
  const [reportMessage, setReportMessage] = useState<string>();
  const [reportError, setReportError] = useState<string>();
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

  async function handleReportSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const details = reportDetails.trim();
    setReportPending(true);
    setReportError(undefined);
    setReportMessage(undefined);

    try {
      await runWithAuth((freshCsrfToken) =>
        createReport(
          {
            targetType: "post",
            targetId: post.id,
            postId: post.id,
            reportedUserId: post.author.id,
            category: reportCategory,
            ...(details ? { details } : {}),
          },
          freshCsrfToken,
        ),
      );
      setReportMessage("Report sent.");
      setReportDetails("");
      setReportOpen(false);
    } catch (error) {
      setReportError(
        error instanceof Error ? error.message : "Could not create report.",
      );
    } finally {
      setReportPending(false);
    }
  }

  return (
    <>
      <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-muted">
        <CommentButton
          count={commentCount}
          onClick={() => setThreadOpen(true)}
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
        {canReport || actions ? (
          <span className="ml-auto inline-flex items-center gap-2">
            {canReport ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={reportPending}
                icon={<Flag aria-hidden="true" size={15} />}
                onClick={() => {
                  setReportError(undefined);
                  setReportMessage(undefined);
                  setReportOpen((open) => !open);
                }}
              >
                Report
              </Button>
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
      {reportMessage ? (
        <p className="mt-2 text-xs font-medium text-leaf-ink">{reportMessage}</p>
      ) : null}
      {reportError ? (
        <p className="mt-2 text-xs font-medium text-rose-ink">{reportError}</p>
      ) : null}
      {reportOpen ? (
        <form
          className="mt-3 space-y-3 rounded-card border border-line bg-canvas/45 p-3"
          onSubmit={(event) => void handleReportSubmit(event)}
        >
          <h3 className="text-sm font-semibold text-text">Report post</h3>
          <p className="text-xs leading-5 text-muted">
            Reports are reviewed against the{" "}
            <Link
              to="/community-guidelines"
              className="font-medium text-text underline-offset-4 hover:text-accent-strong hover:underline"
            >
              Community Guidelines
            </Link>
            . The{" "}
            <Link
              to="/moderation"
              className="font-medium text-text underline-offset-4 hover:text-accent-strong hover:underline"
            >
              Moderation Policy
            </Link>{" "}
            explains possible actions.
            {reportCategory === "copyright" ? (
              <>
                {" "}
                For rights concerns, see the{" "}
                <Link
                  to="/copyright"
                  className="font-medium text-text underline-offset-4 hover:text-accent-strong hover:underline"
                >
                  Copyright Policy
                </Link>
                .
              </>
            ) : null}
          </p>
          <SelectField
            id={`report-category-${post.id}`}
            label="What's wrong?"
            value={reportCategory}
            options={reportCategoryOptions}
            onChange={(event) =>
              setReportCategory(event.target.value as ReportCategory)
            }
          />
          <TextareaField
            id={`report-details-${post.id}`}
            label="Add details"
            rows={3}
            maxLength={2000}
            value={reportDetails}
            placeholder="Optional context for moderators"
            onChange={(event) => setReportDetails(event.target.value)}
          />
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={reportPending}
              onClick={() => setReportOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={reportPending}>
              Report
            </Button>
          </div>
        </form>
      ) : null}
      <ThreadModal
        open={threadOpen}
        post={post}
        authStatus={status}
        csrfToken={csrfToken}
        runWithAuth={runWithAuth}
        onClose={() => setThreadOpen(false)}
        onReplyCreated={() => setCommentCount((current) => current + 1)}
      />
    </>
  );
}

const reportCategoryOptions: Array<{ value: ReportCategory; label: string }> = [
  { value: "harassment", label: "Harassment" },
  { value: "hate", label: "Hate or abuse" },
  { value: "sexual_content", label: "Sexual content" },
  { value: "non_consensual_content", label: "Non-consensual content" },
  { value: "private_info", label: "Private information" },
  { value: "spam_or_scam", label: "Spam or scam" },
  { value: "impersonation", label: "Impersonation" },
  { value: "copyright", label: "Copyright" },
  { value: "violence_or_threats", label: "Violence or threats" },
  { value: "self_harm", label: "Self-harm" },
  { value: "illegal_content", label: "Illegal content" },
  { value: "other", label: "Other" },
];

type CommentButtonProps = {
  count: number;
  onClick: () => void;
};

function CommentButton({ count, onClick }: CommentButtonProps) {
  return (
    <motion.button
      type="button"
      className="inline-flex min-h-9 items-center gap-2 rounded-full px-3 transition duration-fluid ease-fluid hover:bg-surface-strong hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      aria-label={`Open replies. ${count} ${count === 1 ? "reply" : "replies"}.`}
      title="Replies"
      onClick={onClick}
      whileHover={buttonHover}
      whileTap={buttonTap}
    >
      <MessageCircle aria-hidden="true" size={15} />
      <span>Reply</span>
      <span className="tabular-nums">{count}</span>
    </motion.button>
  );
}

type ThreadModalProps = {
  open: boolean;
  post: Post;
  authStatus: AuthStatus;
  csrfToken: string | undefined;
  runWithAuth: <T>(
    task: (csrfToken: string) => Promise<T>,
    options?: { retryOnCsrf?: boolean },
  ) => Promise<T>;
  onClose: () => void;
  onReplyCreated: (post: Post) => void;
};

function ThreadModal({
  open,
  post,
  authStatus,
  csrfToken,
  runWithAuth,
  onClose,
  onReplyCreated,
}: ThreadModalProps) {
  const titleId = useId();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [replies, setReplies] = useState<Post[]>([]);
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loadError, setLoadError] = useState<string>();
  const [submitError, setSubmitError] = useState<string>();
  const canSubmit = Boolean(csrfToken) && body.trim().length > 0 && !submitting;
  const isCheckingAuth = authStatus === "loading";
  const isAuthenticated = authStatus === "authenticated" && Boolean(csrfToken);

  useEffect(() => {
    if (!open) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose, open]);

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
      setSubmitError(undefined);

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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!csrfToken) {
      setSubmitError("Log in to reply.");
      return;
    }

    const trimmedBody = body.trim();

    if (!trimmedBody) {
      return;
    }

    setSubmitting(true);
    setSubmitError(undefined);

    try {
      const reply = await runWithAuth((freshCsrfToken) =>
        createPostReply(post.id, { body: trimmedBody }, freshCsrfToken),
        { retryOnCsrf: true },
      );
      setReplies((current) => [...current, reply]);
      setBody("");
      onReplyCreated(reply);
      window.setTimeout(() => textareaRef.current?.focus(), 60);
    } catch {
      setSubmitError("Reply could not be posted right now.");
    } finally {
      setSubmitting(false);
    }
  }

  const modal = (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-50 grid place-items-center bg-text/28 px-3 py-4 backdrop-blur-veil sm:px-4 sm:py-6"
          variants={modalOverlay}
          initial="hidden"
          animate="show"
          exit="exit"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              onClose();
            }
          }}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            data-testid="thread-modal"
            className="flex max-h-[calc(100dvh-2rem)] w-full max-w-2xl flex-col overflow-hidden rounded-panel border border-line bg-surface shadow-lift sm:max-h-[min(760px,calc(100dvh-3rem))]"
            variants={modalPanel}
          >
            <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-line bg-surface/95 px-4 py-3 backdrop-blur-veil sm:px-5">
              <h2 id={titleId} className="text-base font-semibold text-text">
                Thread
              </h2>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Close thread"
                title="Close"
                icon={<X aria-hidden="true" size={18} />}
                onClick={onClose}
              />
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
              <ParentPostPreview post={post} />

              {isAuthenticated ? (
                <form className="mt-4 border-b border-line pb-4" onSubmit={handleSubmit}>
                  <TextareaField
                    ref={textareaRef}
                    id={`reply-composer-${post.id}`}
                    label="Reply"
                    rows={4}
                    maxLength={2000}
                    className="min-h-28 bg-canvas/55"
                    placeholder="Write a reply"
                    value={body}
                    disabled={submitting}
                    onChange={(event) => setBody(event.currentTarget.value)}
                  />
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <span className="text-xs text-muted" aria-live="polite">
                      {body.length}/2000
                    </span>
                    <Button
                      type="submit"
                      size="sm"
                      disabled={!canSubmit}
                      icon={<Send aria-hidden="true" size={15} />}
                    >
                      {submitting ? "Replying..." : "Reply"}
                    </Button>
                  </div>
                </form>
              ) : isCheckingAuth ? (
                <div className="mt-4 border-b border-line pb-4">
                  <p className="rounded-card border border-line bg-canvas/45 p-4 text-sm text-muted">
                    Checking session...
                  </p>
                </div>
              ) : (
                <div className="mt-4 flex flex-col gap-3 border-b border-line pb-4 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-muted">Log in to reply.</p>
                  <ButtonLink to="/login" size="sm" onClick={onClose}>
                    Log in
                  </ButtonLink>
                </div>
              )}

              {submitError ? (
                <p className="mt-3 rounded-card border border-rose/30 bg-rose/15 p-3 text-sm text-rose-ink">
                  {submitError}
                </p>
              ) : null}

              <div className="mt-4 space-y-3">
                {loading ? (
                  <p className="rounded-card border border-line bg-canvas/45 p-4 text-sm text-muted">
                    Loading replies...
                  </p>
                ) : null}
                {loadError ? (
                  <p className="rounded-card border border-rose/30 bg-rose/15 p-4 text-sm text-rose-ink">
                    {loadError}
                  </p>
                ) : null}
                {!loading && !loadError && replies.length === 0 ? (
                  <p className="rounded-card border border-line bg-canvas/45 p-4 text-sm text-muted">
                    No replies yet.
                  </p>
                ) : null}
                <AnimatePresence initial={false}>
                  {replies.map((reply) => (
                    <ReplyPreview key={reply.id} reply={reply} />
                  ))}
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );

  if (typeof document === "undefined") {
    return null;
  }

  return createPortal(modal, document.body);
}

function ParentPostPreview({ post }: { post: Post }) {
  return (
    <div className="rounded-card border border-line bg-canvas/45 p-4">
      <div className="flex items-start gap-3">
        <Avatar user={post.author} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-sm font-semibold text-text">
              {post.author.displayName}
            </span>
            <span className="text-sm text-muted">@{post.author.handle}</span>
            <span className="text-muted/50">·</span>
            <span className="text-sm text-muted">{post.createdAt}</span>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge tone="warm">{post.room.name}</Badge>
          </div>
          <p className="mt-2 text-pretty text-sm leading-6 text-text">{post.body}</p>
          {post.mediaUrl && post.mediaUrl !== "/ambient-veil.webp" ? (
            <div className="mt-3 overflow-hidden rounded-card border border-line bg-canvas">
              <img
                src={post.mediaUrl}
                alt=""
                className="aspect-[16/9] w-full object-cover"
                loading="lazy"
                decoding="async"
              />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function ReplyPreview({ reply }: { reply: Post }) {
  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ type: "spring", stiffness: 260, damping: 26 }}
      className="rounded-card border border-line bg-canvas/35 p-4"
    >
      <div className="flex items-start gap-3">
        <Avatar user={reply.author} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-sm font-semibold text-text">
              {reply.author.displayName}
            </span>
            <span className="text-sm text-muted">@{reply.author.handle}</span>
            <span className="text-muted/50">·</span>
            <span className="text-sm text-muted">{reply.createdAt}</span>
          </div>
          <p className="mt-2 text-pretty text-sm leading-6 text-text">{reply.body}</p>
        </div>
      </div>
    </motion.article>
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
        "inline-flex min-h-9 items-center gap-2 rounded-full px-3 transition duration-fluid ease-fluid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-wait",
        liked
          ? "bg-rose/20 text-rose-ink shadow-inner-soft"
          : "hover:bg-surface-strong hover:text-text",
        pending && "opacity-70",
      )}
      aria-label={`${liked ? "Unlike" : "Like"} this post. ${count} ${count === 1 ? "like" : "likes"}.`}
      aria-pressed={liked}
      disabled={pending}
      title={liked ? "Liked" : "Like"}
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
      <span>{liked ? "Liked" : "Like"}</span>
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
        "inline-flex min-h-9 items-center gap-2 rounded-full px-3 transition duration-fluid ease-fluid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-55",
        reblogged
          ? "bg-leaf/20 text-leaf-ink shadow-inner-soft"
          : "hover:bg-surface-strong hover:text-text",
        pending && "cursor-wait opacity-70",
      )}
      aria-label={`${reblogged ? "Undo reblog" : "Reblog"} this post. ${count} ${count === 1 ? "reblog" : "reblogs"}.`}
      aria-pressed={reblogged}
      disabled={disabled || pending}
      title={disabled ? disabledTitle : reblogged ? "Reblogged" : "Reblog"}
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
      <span>{reblogged ? "Reblogged" : "Reblog"}</span>
      <span className="tabular-nums">{count}</span>
    </motion.button>
  );
}
