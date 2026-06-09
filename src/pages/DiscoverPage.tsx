import { Hash, Radio, Sparkles, UserRound } from "lucide-react";
import { useMemo, useState } from "react";
import { PageMeta } from "../components/PageMeta";
import { PostCard } from "../components/social/PostCard";
import { ApiStateNotice } from "../components/ui/ApiStateNotice";
import { Badge } from "../components/ui/Badge";
import { Panel } from "../components/ui/Panel";
import { Avatar } from "../components/ui/Avatar";
import { AmbientImage } from "../components/ui/AmbientImage";
import { SearchField } from "../components/ui/Field";
import { deletePost, getFeed, updatePost } from "../lib/api";
import { canDeletePost, canHidePost } from "../lib/postPermissions";
import type { Post } from "../lib/types";
import { useAsyncData } from "../lib/useAsyncData";
import { useAuth } from "../lib/useAuth";
import { discoverItems, posts as fallbackPosts, users } from "../data/mockData";

const icons = {
  thread: Hash,
  person: UserRound,
  room: Radio,
};

export function DiscoverPage() {
  const { csrfToken, user } = useAuth();
  const postsState = useAsyncData(getFeed, fallbackPosts);
  const [removedPostIds, setRemovedPostIds] = useState<Set<number>>(() => new Set());
  const [pendingPostId, setPendingPostId] = useState<number | undefined>();
  const [postActionError, setPostActionError] = useState<string | undefined>();
  const feedPosts = postsState.data ?? fallbackPosts;
  const visiblePosts = useMemo(
    () => feedPosts.filter((post) => !removedPostIds.has(post.id)),
    [feedPosts, removedPostIds],
  );

  async function handleDeletePost(post: Post) {
    if (!csrfToken) {
      setPostActionError("Your session needs to refresh before deleting.");
      return;
    }

    setPendingPostId(post.id);
    setPostActionError(undefined);

    try {
      await deletePost(post.id, csrfToken);
      markPostRemoved(post.id);
    } catch (caught) {
      setPostActionError(caught instanceof Error ? caught.message : "Post could not be deleted.");
    } finally {
      setPendingPostId(undefined);
    }
  }

  async function handleHidePost(post: Post) {
    if (!csrfToken) {
      setPostActionError("Your session needs to refresh before hiding.");
      return;
    }

    setPendingPostId(post.id);
    setPostActionError(undefined);

    try {
      await updatePost(post.id, { status: "hidden" }, csrfToken);
      markPostRemoved(post.id);
    } catch (caught) {
      setPostActionError(caught instanceof Error ? caught.message : "Post could not be hidden.");
    } finally {
      setPendingPostId(undefined);
    }
  }

  function markPostRemoved(postId: number) {
    setRemovedPostIds((current) => new Set(current).add(postId));
  }

  return (
    <div className="space-y-6">
      <PageMeta
        title="Discover"
        description="Find rooms, people, and recent posts across thia.lol."
        path="/discover"
      />
      <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Panel className="p-5 sm:p-6">
          <Badge tone="cool">discover</Badge>
          <h1 className="mt-4 text-3xl font-semibold tracking-normal text-text">
            Find rooms, people, and recent posts.
          </h1>
          <SearchField
            id="discover-search"
            label="Search"
            placeholder="Search people, rooms, posts"
            className="mt-5"
          />
        </Panel>

        <Panel className="overflow-hidden">
          <AmbientImage className="aspect-[16/10] w-full" />
          <div className="p-5">
            <p className="text-sm font-semibold text-text">Browse around</p>
            <p className="mt-2 text-sm leading-6 text-muted">
              A few good places to start, from active rooms to friendly profiles.
            </p>
          </div>
        </Panel>
      </section>

      {postsState.loading ? (
        <ApiStateNotice
          kind="loading"
          title="Loading recent posts"
          text="Fresh posts are on the way."
        />
      ) : null}

      {postsState.usingFallback ? (
        <ApiStateNotice
          kind="fallback"
          title="Showing a saved view"
          text="Recent posts are taking a moment to refresh."
        />
      ) : null}

      {postActionError ? (
        <p className="rounded-card border border-rose/30 bg-rose/15 p-3 text-sm text-rose-ink">
          {postActionError}
        </p>
      ) : null}

      <section aria-label="Recent public posts">
        <div className="mb-3 flex items-center justify-between gap-4">
          <h2 className="text-xl font-semibold text-text">Recent posts</h2>
          <Badge tone="warm">public</Badge>
        </div>
        <div className="space-y-4">
          {visiblePosts.map((post, index) => (
            <PostCard
              key={post.id}
              post={post}
              index={index}
              canDelete={canDeletePost(user, post)}
              canHide={canHidePost(user)}
              actionPending={pendingPostId === post.id}
              onDelete={(targetPost) => void handleDeletePost(targetPost)}
              onHide={(targetPost) => void handleHidePost(targetPost)}
            />
          ))}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4" aria-label="Discovery">
        {discoverItems.map((item) => {
          const Icon = icons[item.kind];
          return (
            <Panel key={item.id} interactive className="p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="grid size-11 place-items-center rounded-card bg-surface-strong text-accent-strong">
                  <Icon aria-hidden="true" size={19} />
                </div>
                <Badge>{item.count}</Badge>
              </div>
              <h2 className="mt-5 text-lg font-semibold text-text">{item.label}</h2>
              <p className="mt-2 text-sm leading-6 text-muted">{item.description}</p>
            </Panel>
          );
        })}
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between gap-4">
          <h2 className="text-xl font-semibold text-text">Quiet operators</h2>
          <Badge tone="rose">
            <Sparkles aria-hidden="true" size={13} />
            curated
          </Badge>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {users.map((user) => (
            <Panel key={user.id} interactive className="p-4">
              <div className="flex items-center gap-3">
                <Avatar user={user} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-text">
                    {user.displayName}
                  </p>
                  <p className="truncate text-sm text-muted">@{user.handle}</p>
                </div>
              </div>
            </Panel>
          ))}
        </div>
      </section>
    </div>
  );
}
