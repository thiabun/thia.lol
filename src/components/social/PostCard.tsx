import { useState, type FormEvent, type ReactNode } from "react";
import { EyeOff, Flag, MessageCircle, Repeat2, Sparkles, Trash2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { motion } from "motion/react";
import { AmbientImage } from "../ui/AmbientImage";
import { Avatar } from "../ui/Avatar";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { SelectField, TextareaField } from "../ui/Field";
import { Panel } from "../ui/Panel";
import {
  addReaction,
  createReport,
  removeReaction,
  type ReactionType,
  type ReportReason,
} from "../../lib/api";
import { cn } from "../../lib/classNames";
import type { Post, ReactionCounts } from "../../lib/types";
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
          key={`${post.id}:${post.reactions.glow}:${post.reactions.echo}:${post.reactions.hush}`}
          postId={post.id}
          reportedUserId={post.author.id}
          initialCounts={post.reactions}
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
  postId: number;
  reportedUserId: number;
  initialCounts: ReactionCounts;
  actions: ReactNode;
};

function ReactionControls({
  postId,
  reportedUserId,
  initialCounts,
  actions,
}: ReactionControlsProps) {
  const { csrfToken, user } = useAuth();
  const [reactionCounts, setReactionCounts] = useState<ReactionCounts>(
    initialCounts,
  );
  const [activeReactions, setActiveReactions] = useState<Set<ReactionType>>(
    () => new Set(),
  );
  const [pendingReactions, setPendingReactions] = useState<Set<ReactionType>>(
    () => new Set(),
  );
  const [reactionError, setReactionError] = useState<string>();
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState<ReportReason>("spam");
  const [reportDetails, setReportDetails] = useState("");
  const [reportPending, setReportPending] = useState(false);
  const [reportMessage, setReportMessage] = useState<string>();
  const [reportError, setReportError] = useState<string>();
  const canReport = Boolean(csrfToken) && user?.id !== reportedUserId;

  async function handleReaction(type: ReactionType) {
    if (pendingReactions.has(type)) {
      return;
    }

    if (!csrfToken) {
      setReactionError("Sign in to react.");
      return;
    }

    const wasActive = activeReactions.has(type);
    const previousCounts = reactionCounts;
    const previousActive = new Set(activeReactions);

    setReactionError(undefined);
    setPendingReactions((current) => addToSet(current, type));
    setActiveReactions((current) => toggleInSet(current, type, !wasActive));
    setReactionCounts((current) =>
      adjustReactionCount(current, type, wasActive ? -1 : 1),
    );

    try {
      const nextCounts = wasActive
        ? await removeReaction(postId, type, csrfToken)
        : await addReaction(postId, type, csrfToken);

      setReactionCounts(nextCounts);
    } catch (error) {
      setReactionCounts(previousCounts);
      setActiveReactions(previousActive);
      setReactionError(
        error instanceof Error ? error.message : "Could not update reaction.",
      );
    } finally {
      setPendingReactions((current) => removeFromSet(current, type));
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
          postId,
          reportedUserId,
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
        <Reaction
          type="glow"
          icon={Sparkles}
          label="Glow"
          count={reactionCounts.glow}
          active={activeReactions.has("glow")}
          pending={pendingReactions.has("glow")}
          onClick={() => void handleReaction("glow")}
        />
        <Reaction
          type="echo"
          icon={Repeat2}
          label="Echo"
          count={reactionCounts.echo}
          active={activeReactions.has("echo")}
          pending={pendingReactions.has("echo")}
          onClick={() => void handleReaction("echo")}
        />
        <Reaction
          type="hush"
          icon={MessageCircle}
          label="Hush"
          count={reactionCounts.hush}
          active={activeReactions.has("hush")}
          pending={pendingReactions.has("hush")}
          onClick={() => void handleReaction("hush")}
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
      {reactionError ? (
        <p className="mt-2 text-xs font-medium text-rose-ink">{reactionError}</p>
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
            id={`report-reason-${postId}`}
            label="Reason"
            value={reportReason}
            options={reportReasonOptions}
            onChange={(event) => setReportReason(event.target.value as ReportReason)}
          />
          <TextareaField
            id={`report-details-${postId}`}
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

type ReactionProps = {
  type: ReactionType;
  icon: LucideIcon;
  label: string;
  count: number;
  active: boolean;
  pending: boolean;
  onClick: () => void;
};

function Reaction({
  type,
  icon: Icon,
  label,
  count,
  active,
  pending,
  onClick,
}: ReactionProps) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex min-h-9 items-center gap-2 rounded-full px-3 transition duration-fluid ease-fluid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-wait",
        active
          ? "bg-surface-strong text-text shadow-inner-soft"
          : "hover:bg-surface-strong hover:text-text",
        pending && "opacity-70",
      )}
      aria-label={`${active ? "Remove" : "Add"} ${label}. ${count} total.`}
      aria-pressed={active}
      disabled={pending}
      title={label}
      onClick={onClick}
      data-reaction-type={type}
    >
      <Icon aria-hidden="true" size={15} />
      <span>{count}</span>
    </button>
  );
}

function adjustReactionCount(
  counts: ReactionCounts,
  type: ReactionType,
  delta: number,
): ReactionCounts {
  return {
    ...counts,
    [type]: Math.max(0, counts[type] + delta),
  };
}

function addToSet<T>(set: Set<T>, value: T): Set<T> {
  const next = new Set(set);
  next.add(value);
  return next;
}

function removeFromSet<T>(set: Set<T>, value: T): Set<T> {
  const next = new Set(set);
  next.delete(value);
  return next;
}

function toggleInSet<T>(set: Set<T>, value: T, enabled: boolean): Set<T> {
  return enabled ? addToSet(set, value) : removeFromSet(set, value);
}
