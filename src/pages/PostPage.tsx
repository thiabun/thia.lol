import { ArrowLeft, LoaderCircle, WifiOff } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import {
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
import { distinctContextText } from "../lib/displayText";
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

      <header
        className="sticky top-0 z-20 -mx-2 flex min-h-11 items-center border-b border-line/75 bg-canvas/88 px-2 py-1 backdrop-blur-veil sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0"
        aria-label="Thread navigation"
      >
        <h1 className="sr-only">Thread</h1>
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
  const usefulText = distinctContextText(
    text,
    "Post not available",
    "Post not found",
  );

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
        {...(usefulText ? { text: usefulText } : {})}
        actions={
          <ButtonLink to="/discover" size="sm" variant="secondary">
            Back to Discover
          </ButtonLink>
        }
      />
    </motion.div>
  );
}
