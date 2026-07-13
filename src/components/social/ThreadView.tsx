import { LoaderCircle, MessageCircle, WifiOff } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getPostReplies } from "../../lib/api";
import { cn } from "../../lib/classNames";
import { roomAllowsPosting } from "../../lib/postRules";
import type { Post } from "../../lib/types";
import { useAuth } from "../../lib/useAuth";
import { Button, ButtonLink } from "../ui/Button";
import { CompactStateNotice } from "../ui/RouteState";
import { PostCard } from "./PostCard";
import { UnifiedComposer } from "./UnifiedComposer";

type ThreadViewProps = {
  ancestorPath: Post[];
  composePostId?: number | undefined;
  focusPostId: number;
  onRootDeleted?: (() => void) | undefined;
  onRootPostChange?: ((post: Post) => void) | undefined;
  rootPost: Post;
};

/**
 * A thread is rendered as one continuous conversation tree. The known ancestor
 * path is kept visible immediately while the remaining reply branches load.
 */
export function ThreadView({
  ancestorPath,
  composePostId,
  focusPostId,
  onRootDeleted,
  onRootPostChange,
  rootPost,
}: ThreadViewProps) {
  const pathById = useMemo(
    () => new Map(ancestorPath.map((post, index) => [post.id, index])),
    [ancestorPath],
  );

  return (
    <section
      aria-label="Thread conversation"
      className="mx-auto w-full max-w-[46rem]"
      data-testid="thread-view"
    >
      <ThreadNode
        key={rootPost.id}
        autoExpand
        composePostId={composePostId}
        depth={0}
        focusPostId={focusPostId}
        onDeleted={onRootDeleted}
        onPostChange={onRootPostChange}
        pathById={pathById}
        pathPosts={ancestorPath}
        post={rootPost}
        root
      />
    </section>
  );
}

type ThreadNodeProps = {
  autoExpand?: boolean;
  composePostId?: number | undefined;
  depth: number;
  focusPostId: number;
  onDeleted?: (() => void) | undefined;
  onPostChange?: ((post: Post) => void) | undefined;
  pathById: Map<number, number>;
  pathPosts: Post[];
  post: Post;
  root?: boolean;
};

function ThreadNode({
  autoExpand = false,
  composePostId,
  depth,
  focusPostId,
  onDeleted,
  onPostChange,
  pathById,
  pathPosts,
  post,
  root = false,
}: ThreadNodeProps) {
  const { status } = useAuth();
  const composerRef = useRef<HTMLDivElement>(null);
  const repliesRequestPendingRef = useRef(false);
  const pathIndex = pathById.get(post.id);
  const knownChild =
    pathIndex === undefined ? undefined : pathPosts[pathIndex + 1];
  const [currentPost, setCurrentPost] = useState(post);
  const [replies, setReplies] = useState<Post[]>(() =>
    knownChild ? [knownChild] : [],
  );
  const [repliesLoaded, setRepliesLoaded] = useState(false);
  const [repliesLoading, setRepliesLoading] = useState(false);
  const [repliesError, setRepliesError] = useState<string>();
  const [composerOpen, setComposerOpen] = useState(
    (root && (!composePostId || composePostId === post.id)) ||
      composePostId === post.id,
  );
  const canReply = roomAllowsPosting(currentPost.room);
  const hasReplies = currentPost.commentCount > 0 || replies.length > 0;
  const highlighted = currentPost.id === focusPostId;

  const loadReplies = useCallback(async () => {
    if (repliesRequestPendingRef.current || repliesLoaded) {
      return;
    }

    repliesRequestPendingRef.current = true;
    setRepliesLoading(true);
    setRepliesError(undefined);

    try {
      const items = await getPostReplies(currentPost.id);
      setReplies((known) => mergeReplies(items, known));
      setRepliesLoaded(true);
    } catch (error) {
      setRepliesError(
        error instanceof Error ? error.message : "Replies could not load.",
      );
    } finally {
      repliesRequestPendingRef.current = false;
      setRepliesLoading(false);
    }
  }, [currentPost.id, repliesLoaded]);

  useEffect(() => {
    if (!autoExpand && !knownChild) {
      return;
    }

    let active = true;

    queueMicrotask(() => {
      if (active) {
        void loadReplies();
      }
    });

    return () => {
      active = false;
    };
  }, [autoExpand, knownChild, loadReplies]);

  function openComposer() {
    if (!canReply) {
      return;
    }

    if (!repliesLoaded && !repliesLoading) {
      void loadReplies();
    }

    setComposerOpen(true);
    window.requestAnimationFrame(() => {
      composerRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    });
  }

  function handleReplyCreated(reply: Post) {
    setReplies((current) => mergeReplies(current, [reply]));
    setRepliesLoaded(true);
    const nextPost = {
      ...currentPost,
      commentCount: currentPost.commentCount + 1,
    };
    setCurrentPost(nextPost);
    onPostChange?.(nextPost);
    setComposerOpen(false);
  }

  const node = (
    <>
      <PostCard
        post={currentPost}
        depth={depth}
        highlighted={highlighted && !root}
        variant={root ? "focus" : "reply"}
        onDeleted={onDeleted}
        onReplyAction={openComposer}
      />

      {canReply && composerOpen ? (
        <div
          ref={composerRef}
          className={cn(root ? "mt-3" : "mt-2")}
          id={root ? "reply-composer" : undefined}
        >
          {status === "authenticated" ? (
            <UnifiedComposer
              autoFocus={!root}
              className={cn(!root && "bg-surface/55")}
              mode="reply"
              parentPostId={currentPost.id}
              onCancel={() => setComposerOpen(false)}
              onCreated={handleReplyCreated}
            />
          ) : (
            <div className="flex flex-col gap-3 rounded-card border border-line/80 bg-surface/55 p-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted">
                Join the conversation as yourself.
              </p>
              <ButtonLink to="/login" size="sm" variant="secondary">
                Log in to reply
              </ButtonLink>
            </div>
          )}
        </div>
      ) : null}

      {hasReplies && !repliesLoaded && !repliesLoading ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="mt-2 min-h-11 text-muted sm:min-h-8"
          icon={<MessageCircle aria-hidden="true" size={15} />}
          onClick={() => void loadReplies()}
        >
          Show {replyCountLabel(currentPost.commentCount)}
        </Button>
      ) : null}

      {repliesLoading ? (
        <div className="mt-2 flex items-center gap-2 px-2 py-1 text-sm text-muted" role="status">
          <LoaderCircle aria-hidden="true" className="animate-spin" size={15} />
          Loading replies
        </div>
      ) : null}

      {repliesError ? (
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-card border border-rose/25 bg-rose/10 px-3 py-2 text-sm text-rose-ink">
          <span className="inline-flex items-center gap-2">
            <WifiOff aria-hidden="true" size={15} />
            Replies are unavailable.
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => void loadReplies()}
          >
            Try again
          </Button>
        </div>
      ) : null}

      {root && repliesLoaded && replies.length === 0 ? (
        <CompactStateNotice
          centered
          className="mt-3"
          icon={MessageCircle}
          title="A quiet thread"
          text="Be the first reply."
        />
      ) : null}

      {replies.length > 0 ? (
        <div
          className={cn(
            "relative mt-2 space-y-1",
            depth < 3 ? "ml-4 pl-3 sm:ml-7 sm:pl-4" : "ml-2 pl-2",
            "before:pointer-events-none before:absolute before:inset-y-0 before:left-0 before:w-px before:bg-line/65",
          )}
          data-testid={root ? "thread-replies" : undefined}
        >
          {replies.map((reply) => {
            const isKnownBranch = knownChild?.id === reply.id;

            return (
              <ThreadNode
                key={reply.id}
                autoExpand={isKnownBranch}
                composePostId={composePostId}
                depth={depth + 1}
                focusPostId={focusPostId}
                onDeleted={() => {
                  setReplies((current) =>
                    current.filter((item) => item.id !== reply.id),
                  );
                  const nextPost = {
                    ...currentPost,
                    commentCount: Math.max(0, currentPost.commentCount - 1),
                  };
                  setCurrentPost(nextPost);
                  onPostChange?.(nextPost);
                }}
                pathById={pathById}
                pathPosts={pathPosts}
                post={reply}
              />
            );
          })}
        </div>
      ) : null}
    </>
  );

  if (root) {
    return node;
  }

  return (
    <div
      className={cn(
        "relative py-2",
        highlighted && "scroll-mt-24",
      )}
      data-thread-depth={depth}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -left-3 top-8 h-px w-3 bg-line/65 sm:-left-4 sm:w-4"
      />
      {node}
    </div>
  );
}

function mergeReplies(preferred: Post[], fallback: Post[]) {
  const byId = new Map<number, Post>();

  for (const post of [...preferred, ...fallback]) {
    if (!byId.has(post.id)) {
      byId.set(post.id, post);
    }
  }

  return [...byId.values()];
}

function replyCountLabel(count: number) {
  if (count === 1) {
    return "1 reply";
  }

  return `${count} replies`;
}
