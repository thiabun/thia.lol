import { LoaderCircle } from "lucide-react";
import { useEffect, useRef } from "react";
import { Button } from "../ui/Button";

export function InfiniteFeedTrigger({
  hasMore,
  loading,
  loadMoreError,
  onLoadMore,
}: {
  hasMore: boolean;
  loading: boolean;
  loadMoreError?: Error | undefined;
  onLoadMore: () => Promise<void>;
}) {
  const triggerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const trigger = triggerRef.current;

    if (!trigger || !hasMore || loading || loadMoreError) {
      return;
    }

    if (!("IntersectionObserver" in window)) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          observer.disconnect();
          void onLoadMore();
        }
      },
      { rootMargin: "600px 0px" },
    );

    observer.observe(trigger);

    return () => observer.disconnect();
  }, [hasMore, loadMoreError, loading, onLoadMore]);

  if (!hasMore && !loading && !loadMoreError) {
    return null;
  }

  return (
    <div
      ref={triggerRef}
      className="flex min-h-16 flex-col items-center justify-center gap-2 py-2 text-center"
      data-testid="feed-pagination"
    >
      <div aria-live="polite" className="text-sm text-muted" role="status">
        {loading ? (
          <span className="inline-flex items-center gap-2">
            <LoaderCircle aria-hidden="true" className="animate-spin" size={16} />
            Loading more posts
          </span>
        ) : loadMoreError ? (
          "More posts could not be loaded."
        ) : (
          <span className="sr-only">More posts are available.</span>
        )}
      </div>
      {!loading ? (
        <Button type="button" variant="secondary" size="sm" onClick={() => void onLoadMore()}>
          {loadMoreError ? "Retry" : "Load more posts"}
        </Button>
      ) : null}
    </div>
  );
}
