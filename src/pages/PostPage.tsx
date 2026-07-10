import {
  ArrowLeft,
  LoaderCircle,
  MessageCircle,
  Radio,
  UserRound,
  WifiOff,
} from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { PageMeta } from "../components/PageMeta";
import {
  PostCard,
  ReplyComposer,
} from "../components/social/PostCard";
import { Avatar } from "../components/ui/Avatar";
import { Badge } from "../components/ui/Badge";
import { Button, ButtonLink } from "../components/ui/Button";
import { Panel } from "../components/ui/Panel";
import { CompactStateNotice, RouteStateNotice } from "../components/ui/RouteState";
import {
  getPost,
  getPostReplies,
  postCanonicalPath,
  roomCanonicalPath,
} from "../lib/api";
import { formatCountWithUnit } from "../lib/pluralize";
import { applyProfileThemeToRoot } from "../lib/profileThemes";
import { roomAllowsPosting } from "../lib/postRules";
import type { Post } from "../lib/types";
import { useAuth } from "../lib/useAuth";
import { pageEntrance } from "../lib/motionPresets";

export function PostPage() {
  const { csrfToken, runWithAuth, status } = useAuth();
  const { handle: routeHandle = "", profileHandle = "", postId = "" } = useParams();
  const handle = (profileHandle || routeHandle).replace(/^@/, "");
  const navigate = useNavigate();
  const replyComposerRef = useRef<HTMLDivElement>(null);
  const postIdentifier = useMemo(
    () => (/^(?:[0-9]+|[a-z][a-z0-9_-]{7,31})$/i.test(postId) ? postId : undefined),
    [postId],
  );
  const [post, setPost] = useState<Post | undefined>();
  const [replies, setReplies] = useState<Post[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [repliesLoading, setRepliesLoading] = useState(false);
  const [repliesError, setRepliesError] = useState<string>();
  const [replyComposerOpen, setReplyComposerOpen] = useState(true);
  const canReply = roomAllowsPosting(post?.room);

  useEffect(() => {
    return applyProfileThemeToRoot(post?.profile?.profileThemeConfig);
  }, [post?.profile?.profileThemeConfig]);

  useEffect(() => {
    if (!postIdentifier) {
      return;
    }

    let active = true;

    queueMicrotask(() => {
      if (!active) {
        return;
      }

      setLoading(true);
      setError(undefined);
      setPost(undefined);
      setReplies([]);
      setReplyComposerOpen(true);

      getPost(postIdentifier)
        .then((nextPost) => {
          if (!active) {
            return;
          }

          setPost(nextPost);

          if (handle.toLowerCase() !== nextPost.author.handle.toLowerCase()) {
            navigate(postCanonicalPath(nextPost), { replace: true });
          }
        })
        .catch((loadError) => {
          if (active) {
            setError(
              loadError instanceof Error ? loadError.message : "Post could not load.",
            );
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
  }, [handle, navigate, postIdentifier]);

  useEffect(() => {
    if (!post) {
      return;
    }

    let active = true;

    queueMicrotask(() => {
      if (!active) {
        return;
      }

      setRepliesLoading(true);
      setRepliesError(undefined);

      getPostReplies(post.id)
        .then((items) => {
          if (active) {
            setReplies(items);
          }
        })
        .catch((loadError) => {
          if (active) {
            setRepliesError(
              loadError instanceof Error ? loadError.message : "Replies could not load.",
            );
          }
        })
        .finally(() => {
          if (active) {
            setRepliesLoading(false);
          }
        });
    });

    return () => {
      active = false;
    };
  }, [post]);

  function focusReplyComposer() {
    setReplyComposerOpen(true);
    window.requestAnimationFrame(() => {
      replyComposerRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    });
  }

  function handleReplyCreated(reply: Post) {
    setReplies((current) => [...current, reply]);
    setPost((current) =>
      current ? { ...current, commentCount: current.commentCount + 1 } : current,
    );
  }

  if (!postIdentifier) {
    return <PostUnavailableNotice handle={handle} text="Post not found." />;
  }

  if (loading) {
    return (
      <motion.div
        className="mx-auto flex w-full max-w-5xl flex-col gap-4"
        variants={pageEntrance}
        initial="hidden"
        animate="show"
      >
        <PageMeta
          title="Post"
          description="Loading a post on thia.lol."
          path={`/@${handle}/posts/${postIdentifier}`}
        />
        <RouteStateNotice
          icon={LoaderCircle}
          kind="loading"
          title="Loading post"
          text="Fetching this thread."
        />
      </motion.div>
    );
  }

  if (error || !post) {
    return <PostUnavailableNotice handle={handle} text={error ?? "Post not found."} />;
  }

  return (
    <motion.div
      className="mx-auto w-full max-w-6xl space-y-4"
      variants={pageEntrance}
      initial="hidden"
      animate="show"
      data-testid="post-page"
    >
      <PageMeta
        title={`${post.author.displayName} on thia.lol`}
        description={post.body}
        path={postCanonicalPath(post)}
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <ButtonLink
          to={`/@${post.author.handle}`}
          variant="ghost"
          size="sm"
          icon={<ArrowLeft aria-hidden="true" size={16} />}
        >
          @{post.author.handle}
        </ButtonLink>
        <Badge tone="cool">{formatCountWithUnit(post.commentCount, "reply")}</Badge>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,42rem)_minmax(16rem,1fr)] lg:items-start">
        <main className="min-w-0 space-y-4">
          <section data-testid="post-focus-area">
            <PostCard
              post={post}
              disableThreadModal
              onReplyAction={focusReplyComposer}
            />
          </section>

          {canReply ? (
            <section ref={replyComposerRef} aria-label="Reply composer">
              {status === "authenticated" && replyComposerOpen ? (
                <ReplyComposer
                  autoFocus
                  csrfToken={csrfToken}
                  parentPostId={post.id}
                  runWithAuth={runWithAuth}
                  onCancel={() => setReplyComposerOpen(false)}
                  onCreated={handleReplyCreated}
                />
              ) : status === "authenticated" ? (
                <Panel className="flex items-center justify-between gap-3 p-3">
                  <p className="text-sm text-muted">Reply composer is closed.</p>
                  <Button
                    type="button"
                    size="sm"
                    icon={<MessageCircle aria-hidden="true" size={15} />}
                    onClick={() => setReplyComposerOpen(true)}
                  >
                    Reply
                  </Button>
                </Panel>
              ) : (
                <Panel className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-muted">Log in to reply.</p>
                  <ButtonLink to="/login" size="sm" variant="secondary">
                    Log in
                  </ButtonLink>
                </Panel>
              )}
            </section>
          ) : null}

          <section className="space-y-3" aria-label="Replies">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold text-text">Replies</h2>
              <span className="text-sm text-muted">{replies.length}</span>
            </div>
            {repliesLoading ? (
              <CompactStateNotice
                icon={LoaderCircle}
                kind="loading"
                title="Loading replies"
                text="Fetching replies."
              />
            ) : null}
            {repliesError ? (
              <CompactStateNotice
                icon={WifiOff}
                kind="error"
                title="Replies unavailable"
                text={repliesError}
              />
            ) : null}
            {!repliesLoading && !repliesError && replies.length === 0 ? (
              <CompactStateNotice
                centered
                icon={MessageCircle}
                title="No replies yet"
                text="No replies yet."
              />
            ) : null}
            {replies.map((reply, index) => (
              <PostCard
                key={reply.id}
                post={reply}
                index={index}
                disableThreadModal
              />
            ))}
          </section>
        </main>

        <aside className="space-y-3 lg:sticky lg:top-20" aria-label="Post context">
          <Panel className="p-4">
            <div className="flex items-center gap-3">
              <Avatar user={post.author} />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-text">
                  {post.author.displayName}
                </p>
                <Link
                  to={`/@${post.author.handle}`}
                  className="text-sm text-muted underline-offset-4 hover:text-accent-strong hover:underline"
                >
                  @{post.author.handle}
                </Link>
              </div>
            </div>
            {post.profile?.bio ? (
              <p className="mt-3 line-clamp-4 text-sm leading-6 text-muted">
                {post.profile.bio}
              </p>
            ) : null}
            <ButtonLink
              to={`/@${post.author.handle}`}
              variant="secondary"
              size="sm"
              className="mt-3 w-full"
              icon={<UserRound aria-hidden="true" size={15} />}
            >
              Profile
            </ButtonLink>
          </Panel>

          {post.room ? (
            <Panel className="p-4">
              <div className="flex items-center gap-2">
                <Radio aria-hidden="true" size={16} className="text-muted" />
                <h2 className="min-w-0 truncate text-sm font-semibold text-text">
                  {post.room.name}
                </h2>
              </div>
              <p className="mt-1 text-sm text-muted">/{post.room.slug}</p>
              <ButtonLink
                to={roomCanonicalPath(post.room)}
                variant="secondary"
                size="sm"
                className="mt-3 w-full"
              >
                Room
              </ButtonLink>
            </Panel>
          ) : null}

          <Panel className="p-4">
            <h2 className="text-sm font-semibold text-text">Thread</h2>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              <ThreadMetric label="Replies" value={post.commentCount} />
              <ThreadMetric label="Glows" value={post.likeCount} />
              <ThreadMetric label="Echoes" value={post.reblogCount ?? 0} />
            </div>
          </Panel>
        </aside>
      </div>
    </motion.div>
  );
}

function PostUnavailableNotice({
  handle,
  text,
}: {
  handle: string;
  text: string;
}) {
  return (
    <motion.div
      className="mx-auto flex w-full max-w-4xl flex-col gap-6"
      variants={pageEntrance}
      initial="hidden"
      animate="show"
    >
      <PageMeta
        title="Post not found"
        description="This post is not available on thia.lol."
        path={handle ? `/@${handle}` : "/discover"}
      />
      <RouteStateNotice
        icon={WifiOff}
        kind="error"
        title="Post not available"
        text={text}
        actions={
          <ButtonLink to="/discover" size="sm" variant="secondary">
            Back to Discover
          </ButtonLink>
        }
      />
    </motion.div>
  );
}

function ThreadMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-card border border-line bg-canvas/45 p-2">
      <p className="text-base font-semibold text-text">{value}</p>
      <p className="mt-0.5 text-[0.68rem] font-medium uppercase tracking-[0.08em] text-muted">
        {label}
      </p>
    </div>
  );
}
