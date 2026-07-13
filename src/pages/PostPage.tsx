import { ArrowLeft, LoaderCircle, MessageCircle, WifiOff } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import {
  Link,
  useLocation,
  useNavigate,
  useOutletContext,
  useParams,
} from "react-router";
import type { AppShellOutletContext } from "../components/layout/AppShell";
import { PageMeta } from "../components/PageMeta";
import { ThreadView } from "../components/social/ThreadView";
import { Button, ButtonLink } from "../components/ui/Button";
import { RouteStateNotice } from "../components/ui/RouteState";
import { getPost, postCanonicalPath } from "../lib/api";
import { pageEntrance } from "../lib/motionPresets";
import { applyProfileThemeToRoot } from "../lib/profileThemes";
import type { Post } from "../lib/types";

export function PostPage() {
  const { setMobileDockHidden } =
    useOutletContext<AppShellOutletContext>();
  const { handle: routeHandle = "", profileHandle = "", postId = "" } =
    useParams();
  const handle = (profileHandle || routeHandle).replace(/^@/, "");
  const location = useLocation();
  const navigate = useNavigate();
  const postIdentifier = useMemo(
    () =>
      /^(?:[0-9]+|[a-z][a-z0-9_-]{7,31})$/i.test(postId)
        ? postId
        : undefined,
    [postId],
  );
  const [requestedPost, setRequestedPost] = useState<Post>();
  const [ancestorPath, setAncestorPath] = useState<Post[]>([]);
  const [loadedIdentifier, setLoadedIdentifier] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const routeIsLoaded = loadedIdentifier === postIdentifier;
  const rootPost = routeIsLoaded
    ? ancestorPath[0] ?? requestedPost
    : undefined;

  useEffect(() => {
    setMobileDockHidden(true);

    return () => setMobileDockHidden(false);
  }, [setMobileDockHidden]);

  useEffect(() => {
    return applyProfileThemeToRoot(
      routeIsLoaded ? requestedPost?.profile?.profileThemeConfig : undefined,
    );
  }, [requestedPost?.profile?.profileThemeConfig, routeIsLoaded]);

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
      setLoadedIdentifier(undefined);
      setRequestedPost(undefined);
      setAncestorPath([]);

      void (async () => {
        try {
          const nextPost = await getPost(postIdentifier);
          const nextPath = await loadAncestorPath(nextPost);

          if (!active) {
            return;
          }

          setRequestedPost(nextPost);
          setAncestorPath(nextPath);

          const canonicalPath = postCanonicalPath(nextPost);

          if (
            handle.toLowerCase() !== nextPost.author.handle.toLowerCase() ||
            window.location.pathname !== canonicalPath
          ) {
            navigate(canonicalPath, { replace: true });
          }
        } catch (loadError) {
          if (active) {
            setError(
              loadError instanceof Error
                ? loadError.message
                : "Post could not load.",
            );
          }
        } finally {
          if (active) {
            setLoadedIdentifier(postIdentifier);
            setLoading(false);
          }
        }
      })();
    });

    return () => {
      active = false;
    };
  }, [handle, navigate, postIdentifier]);

  useEffect(() => {
    if (!requestedPost || ancestorPath.length < 2) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      document.getElementById(`post-${requestedPost.id}`)?.scrollIntoView({
        behavior: "auto",
        block: "center",
      });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [ancestorPath.length, requestedPost]);

  if (!postIdentifier) {
    return <PostUnavailableNotice handle={handle} text="Post not found." />;
  }

  if (loading || !routeIsLoaded) {
    return (
      <motion.div
        className="mx-auto flex w-full max-w-[46rem] flex-col gap-4"
        variants={pageEntrance}
        initial="hidden"
        animate="show"
      >
        <PageMeta
          title="Thread"
          description="Loading a conversation on thia.lol."
          path={`/@${handle}/posts/${postIdentifier}`}
        />
        <RouteStateNotice
          icon={LoaderCircle}
          kind="loading"
          title="Opening thread"
          text="Finding the conversation around this post."
        />
      </motion.div>
    );
  }

  if (error || !requestedPost || !rootPost) {
    return (
      <PostUnavailableNotice
        handle={handle}
        text={error ?? "Post not found."}
      />
    );
  }

  return (
    <motion.div
      className="mx-auto w-full max-w-[46rem] space-y-3 pb-6"
      variants={pageEntrance}
      initial="hidden"
      animate="show"
      data-testid="post-page"
    >
      <PageMeta
        title={`${requestedPost.author.displayName} on thia.lol`}
        description={requestedPost.body}
        path={postCanonicalPath(requestedPost)}
      />

      <header className="sticky top-0 z-20 -mx-2 flex min-h-14 items-center gap-3 border-b border-line/75 bg-canvas/88 px-2 py-2 backdrop-blur-veil sm:static sm:mx-0 sm:rounded-card sm:border sm:bg-surface/58 sm:px-3">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-11 sm:size-9"
          aria-label="Back"
          title="Back"
          icon={<ArrowLeft aria-hidden="true" size={18} />}
          onClick={() => {
            if (location.key !== "default") {
              navigate(-1);
            } else {
              navigate(`/@${rootPost.author.handle}`);
            }
          }}
        />
        <div className="min-w-0 flex-1">
          <h1 className="text-base font-semibold text-text">Thread</h1>
          <p className="truncate text-xs text-muted">
            Started by{" "}
            <Link
              to={`/@${rootPost.author.handle}`}
              className="font-medium text-text underline-offset-4 hover:text-accent-strong hover:underline"
            >
              @{rootPost.author.handle}
            </Link>
          </p>
        </div>
        <span className="inline-flex min-h-8 items-center gap-1.5 rounded-full bg-surface-strong/55 px-2.5 text-xs font-medium text-muted">
          <MessageCircle aria-hidden="true" size={14} />
          {replyCountLabel(rootPost.commentCount)}
        </span>
      </header>

      <ThreadView
        ancestorPath={ancestorPath}
        composePostId={
          (location.state as { openComposer?: boolean } | null)?.openComposer
            ? requestedPost.id
            : undefined
        }
        focusPostId={requestedPost.id}
        onRootDeleted={() =>
          navigate(`/@${rootPost.author.handle}`, { replace: true })
        }
        onRootPostChange={(nextRoot) => {
          setAncestorPath((current) =>
            current.map((item, index) => (index === 0 ? nextRoot : item)),
          );
          setRequestedPost((current) =>
            current?.id === nextRoot.id ? nextRoot : current,
          );
        }}
        rootPost={rootPost}
      />
    </motion.div>
  );
}

async function loadAncestorPath(post: Post) {
  const path = [post];
  const seen = new Set([post.id]);
  let current = post;

  while (current.parentId && path.length < 32) {
    if (seen.has(current.parentId)) {
      break;
    }

    try {
      const parent = await getPost(String(current.parentId));
      seen.add(parent.id);
      path.unshift(parent);
      current = parent;
    } catch {
      // A deleted or private ancestor must not hide the post that is available.
      break;
    }
  }

  return path;
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
      className="mx-auto flex w-full max-w-[46rem] flex-col gap-6"
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

function replyCountLabel(count: number) {
  return count === 1 ? "1 reply" : `${count} replies`;
}
