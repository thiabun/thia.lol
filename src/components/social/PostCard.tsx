import {
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { EyeOff, Flag, Heart, MessageCircle, Send, Trash2, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { AmbientImage } from "../ui/AmbientImage";
import { Avatar } from "../ui/Avatar";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { SelectField, TextareaField } from "../ui/Field";
import { Panel } from "../ui/Panel";
import {
  createReport,
  createPostReply,
  getPostReplies,
  likePost,
  unlikePost,
  type ReportReason,
} from "../../lib/api";
import { cn } from "../../lib/classNames";
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
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 210, damping: 26, delay: index * 0.04 }}
    >
      <Panel interactive className="overflow-hidden p-4 sm:p-5">
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
              <Badge tone={post.mood === "frostveil" ? "cool" : "warm"}>
                {post.room.name}
              </Badge>
              <Badge>{post.mood}</Badge>
            </div>
          </div>
        </div>

        <p className="mt-4 text-pretty text-base leading-7 text-text">{post.body}</p>

        {post.mediaUrl ? (
          <div className="mt-4 overflow-hidden rounded-card border border-line bg-canvas">
            {post.mediaUrl === "/ambient-veil.webp" ? (
              <AmbientImage className="aspect-[16/9] w-full" />
            ) : (
              <img
                src={post.mediaUrl}
                alt=""
                className="aspect-[16/9] w-full object-cover"
                loading="lazy"
                decoding="async"
              />
            )}
          </div>
        ) : null}

        <ReactionControls
          key={`${post.id}:${post.likeCount}:${post.likedByCurrentUser}:${post.commentCount}`}
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
  const { csrfToken, user } = useAuth();
  const [likeCount, setLikeCount] = useState(initialLikeCount);
  const [liked, setLiked] = useState(initiallyLiked);
  const [commentCount, setCommentCount] = useState(post.commentCount);
  const [threadOpen, setThreadOpen] = useState(false);
  const [likePending, setLikePending] = useState(false);
  const [likePulse, setLikePulse] = useState(0);
  const [likeError, setLikeError] = useState<string>();
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState<ReportReason>("spam");
  const [reportDetails, setReportDetails] = useState("");
  const [reportPending, setReportPending] = useState(false);
  const [reportMessage, setReportMessage] = useState<string>();
  const [reportError, setReportError] = useState<string>();
  const canReport = Boolean(csrfToken) && user?.id !== post.author.id;

  async function handleLike() {
    if (likePending) {
      return;
    }

    if (!csrfToken) {
      setLikeError("Log in to like posts.");
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
      const result = wasLiked
        ? await unlikePost(post.id, csrfToken)
        : await likePost(post.id, csrfToken);

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

  async function handleReportSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!csrfToken) {
      setReportError("Sign in to report.");
      return;
    }

    const details = reportDetails.trim();
    setReportPending(true);
    setReportError(undefined);
    setReportMessage(undefined);

    try {
      await createReport(
        {
          postId: post.id,
          reportedUserId: post.author.id,
          reason: reportReason,
          ...(details ? { details } : {}),
        },
        csrfToken,
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
          <SelectField
            id={`report-reason-${post.id}`}
            label="Reason"
            value={reportReason}
            options={reportReasonOptions}
            onChange={(event) => setReportReason(event.target.value as ReportReason)}
          />
          <TextareaField
            id={`report-details-${post.id}`}
            label="Details"
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
              Submit
            </Button>
          </div>
        </form>
      ) : null}
      <ThreadModal
        open={threadOpen}
        post={post}
        csrfToken={csrfToken}
        onClose={() => setThreadOpen(false)}
        onReplyCreated={() => setCommentCount((current) => current + 1)}
      />
    </>
  );
}

const reportReasonOptions: Array<{ value: ReportReason; label: string }> = [
  { value: "spam", label: "Spam" },
  { value: "harassment", label: "Harassment" },
  { value: "abuse", label: "Abuse" },
  { value: "self_harm", label: "Self-harm" },
  { value: "illegal", label: "Illegal content" },
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
      whileTap={{ scale: 0.94 }}
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
  csrfToken: string | undefined;
  onClose: () => void;
  onReplyCreated: (post: Post) => void;
};

function ThreadModal({
  open,
  post,
  csrfToken,
  onClose,
  onReplyCreated,
}: ThreadModalProps) {
  const titleId = useId();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [replies, setReplies] = useState<Post[]>([]);
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string>();
  const canSubmit = Boolean(csrfToken) && body.trim().length > 0 && !submitting;

  useEffect(() => {
    if (!open) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.setTimeout(() => textareaRef.current?.focus(), 120);

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
      setMessage(undefined);

      getPostReplies(post.id)
        .then((items) => {
          if (active) {
            setReplies(items);
          }
        })
        .catch(() => {
          if (active) {
            setMessage("Replies could not load right now.");
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
      setMessage("Log in to reply.");
      return;
    }

    const trimmedBody = body.trim();

    if (!trimmedBody) {
      return;
    }

    setSubmitting(true);
    setMessage(undefined);

    try {
      const reply = await createPostReply(post.id, { body: trimmedBody }, csrfToken);
      setReplies((current) => [...current, reply]);
      setBody("");
      onReplyCreated(reply);
      window.setTimeout(() => textareaRef.current?.focus(), 60);
    } catch {
      setMessage("Reply could not be posted right now.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-50 grid place-items-center bg-text/28 px-4 py-6 backdrop-blur-veil"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
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
            className="flex max-h-[min(760px,calc(100vh-2rem))] w-full max-w-2xl flex-col overflow-hidden rounded-panel border border-line bg-surface shadow-lift"
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 260, damping: 28 }}
          >
            <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3 sm:px-5">
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

              <form className="mt-4 border-b border-line pb-4" onSubmit={handleSubmit}>
                <TextareaField
                  ref={textareaRef}
                  id={`reply-composer-${post.id}`}
                  label="Reply"
                  hideLabel
                  rows={4}
                  maxLength={2000}
                  className="min-h-28 bg-canvas/55"
                  placeholder="Write your reply"
                  value={body}
                  disabled={submitting}
                  onChange={(event) => setBody(event.currentTarget.value)}
                />
                <div className="mt-3 flex items-center justify-between gap-3">
                  <span className="text-xs text-muted">{body.length}/2000</span>
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

              {message ? (
                <p className="mt-3 rounded-card border border-rose/30 bg-rose/15 p-3 text-sm text-rose-ink">
                  {message}
                </p>
              ) : null}

              <div className="mt-4 space-y-3">
                {loading ? (
                  <p className="text-sm text-muted">Loading replies...</p>
                ) : null}
                {!loading && replies.length === 0 ? (
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
          <p className="mt-2 text-pretty text-sm leading-6 text-text">{post.body}</p>
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
      whileTap={{ scale: 0.94 }}
    >
      <motion.span
        key={pulseKey}
        aria-hidden="true"
        animate={liked ? { scale: [1, 1.28, 1] } : { scale: 1 }}
        transition={{ type: "spring", stiffness: 420, damping: 18 }}
        className="grid place-items-center"
      >
        <Heart size={15} fill={liked ? "currentColor" : "none"} />
      </motion.span>
      <span>{liked ? "Liked" : "Like"}</span>
      <span className="tabular-nums">{count}</span>
    </motion.button>
  );
}
