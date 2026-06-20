import { MessageCircle, WifiOff } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { PageMeta } from "../components/PageMeta";
import { PostCard } from "../components/social/PostCard";
import { ButtonLink } from "../components/ui/Button";
import { RouteHeader, RouteStateNotice } from "../components/ui/RouteState";
import { getPost, getPostReplies, postCanonicalPath } from "../lib/api";
import { pageEntrance } from "../lib/motionPresets";
import type { Post } from "../lib/types";
import { motion } from "motion/react";

export function PostPage() {
  const { handle: routeHandle = "", profileHandle = "", postId = "" } = useParams();
  const handle = (profileHandle || routeHandle).replace(/^@/, "");
  const navigate = useNavigate();
  const numericPostId = useMemo(
    () => (/^\d+$/.test(postId) ? Number(postId) : undefined),
    [postId],
  );
  const [post, setPost] = useState<Post | undefined>();
  const [replies, setReplies] = useState<Post[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [repliesLoading, setRepliesLoading] = useState(false);
  const [repliesError, setRepliesError] = useState<string>();

  useEffect(() => {
    if (!numericPostId) {
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

      getPost(numericPostId)
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
  }, [handle, navigate, numericPostId]);

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

  if (!numericPostId) {
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
          path="/discover"
        />
        <RouteHeader
          badge="Post"
          title="Post not found"
          description="This post may have been removed or made unavailable."
        />
        <RouteStateNotice
          icon={WifiOff}
          kind="error"
          title="Post not available"
          text="Post not found."
          actions={
            <ButtonLink to="/discover" size="sm" variant="secondary">
              Back to Discover
            </ButtonLink>
          }
        />
      </motion.div>
    );
  }

  if (loading) {
    return (
      <motion.div
        className="mx-auto flex w-full max-w-4xl flex-col gap-6"
        variants={pageEntrance}
        initial="hidden"
        animate="show"
      >
        <PageMeta
          title="Post"
          description="Loading a post on thia.lol."
          {...(numericPostId ? { path: `/@${handle}/posts/${numericPostId}` } : {})}
        />
        <RouteHeader
          badge="Post"
          title="Loading post"
          description="Fetching the thread."
        />
        <RouteStateNotice
          icon={MessageCircle}
          title="Loading post"
          text="Fetching this post."
        />
      </motion.div>
    );
  }

  if (error || !post) {
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
          path="/discover"
        />
        <RouteHeader
          badge="Post"
          title="Post not found"
          description="This post may have been removed or made unavailable."
        />
        <RouteStateNotice
          icon={WifiOff}
          kind="error"
          title="Post not available"
          text={error ?? "Post not found."}
          actions={
            <ButtonLink to="/discover" size="sm" variant="secondary">
              Back to Discover
            </ButtonLink>
          }
        />
      </motion.div>
    );
  }

  return (
    <motion.div
      className="mx-auto flex w-full max-w-4xl flex-col gap-6"
      variants={pageEntrance}
      initial="hidden"
      animate="show"
    >
      <PageMeta
        title={`${post.author.displayName} on thia.lol`}
        description={post.body}
        path={postCanonicalPath(post)}
      />
      <RouteHeader
        badge="Post"
        title="Post"
        description={`Shared by @${post.author.handle}.`}
        meta={
          <Link
            to={`/@${post.author.handle}`}
            className="text-sm font-semibold text-accent-strong underline-offset-4 hover:underline"
          >
            View {post.author.displayName}'s profile
          </Link>
        }
      />

      <PostCard post={post} />

      <section className="mx-auto w-full max-w-[38rem] space-y-4" aria-label="Replies">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-text">Replies</h2>
          <span className="text-sm text-muted">{replies.length}</span>
        </div>
        {repliesLoading ? (
          <RouteStateNotice
            icon={MessageCircle}
            title="Loading replies"
            text="Fetching replies."
          />
        ) : null}
        {repliesError ? (
          <RouteStateNotice
            icon={WifiOff}
            kind="error"
            title="Replies unavailable"
            text={repliesError}
          />
        ) : null}
        {!repliesLoading && !repliesError && replies.length === 0 ? (
          <RouteStateNotice
            icon={MessageCircle}
            title="No replies yet"
            text="This post does not have replies yet."
          />
        ) : null}
        {replies.map((reply, index) => (
          <PostCard key={reply.id} post={reply} index={index} />
        ))}
      </section>
    </motion.div>
  );
}
