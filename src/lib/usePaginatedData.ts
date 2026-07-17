import { useCallback, useEffect, useRef, useState } from "react";

type PaginatedPayload = {
  nextCursor: string | null;
};

type PaginatedDataState<T> = {
  data: T | undefined;
  error: Error | undefined;
  lastLoadedAt: number | undefined;
  loading: boolean;
  loadingMore: boolean;
  loadMoreError: Error | undefined;
  refreshError: Error | undefined;
  refreshing: boolean;
};

export type PaginatedDataResult<T> = PaginatedDataState<T> & {
  hasMore: boolean;
  loadMore: () => Promise<void>;
  reload: () => Promise<void>;
};

export function usePaginatedData<T extends PaginatedPayload>(
  loadPage: (cursor?: string) => Promise<T>,
  mergePages: (current: T, next: T) => T,
): PaginatedDataResult<T> {
  const mountedRef = useRef(true);
  const requestIdRef = useRef(0);
  const [state, setState] = useState<PaginatedDataState<T>>({
    data: undefined,
    error: undefined,
    lastLoadedAt: undefined,
    loading: true,
    loadingMore: false,
    loadMoreError: undefined,
    refreshError: undefined,
    refreshing: false,
  });

  const reload = useCallback(async () => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    setState((current) => ({
      ...current,
      error: current.data === undefined ? undefined : current.error,
      loading: current.data === undefined,
      loadingMore: false,
      loadMoreError: undefined,
      refreshError: undefined,
      refreshing: current.data !== undefined,
    }));

    try {
      const data = await loadPage();

      if (mountedRef.current && requestIdRef.current === requestId) {
        setState({
          data,
          error: undefined,
          lastLoadedAt: Date.now(),
          loading: false,
          loadingMore: false,
          loadMoreError: undefined,
          refreshError: undefined,
          refreshing: false,
        });
      }
    } catch (error: unknown) {
      if (mountedRef.current && requestIdRef.current === requestId) {
        const resolvedError = resolveError(error);

        setState((current) =>
          current.data === undefined
            ? {
                data: undefined,
                error: resolvedError,
                lastLoadedAt: undefined,
                loading: false,
                loadingMore: false,
                loadMoreError: undefined,
                refreshError: undefined,
                refreshing: false,
              }
            : {
                ...current,
                loading: false,
                refreshError: resolvedError,
                refreshing: false,
              },
        );
      }
    }
  }, [loadPage]);

  const nextCursor = state.data?.nextCursor ?? null;
  const loadMore = useCallback(async () => {
    if (!nextCursor || state.loading || state.loadingMore || state.refreshing) {
      return;
    }

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setState((current) => ({
      ...current,
      loadingMore: true,
      loadMoreError: undefined,
    }));

    try {
      const next = await loadPage(nextCursor);

      if (mountedRef.current && requestIdRef.current === requestId) {
        setState((current) => ({
          ...current,
          data: current.data === undefined ? next : mergePages(current.data, next),
          error: undefined,
          lastLoadedAt: Date.now(),
          loadingMore: false,
          loadMoreError: undefined,
        }));
      }
    } catch (error: unknown) {
      if (mountedRef.current && requestIdRef.current === requestId) {
        setState((current) => ({
          ...current,
          loadingMore: false,
          loadMoreError: resolveError(error),
        }));
      }
    }
  }, [loadPage, mergePages, nextCursor, state.loading, state.loadingMore, state.refreshing]);

  useEffect(() => {
    mountedRef.current = true;
    let active = true;

    queueMicrotask(() => {
      if (active) {
        void reload();
      }
    });

    return () => {
      active = false;
      mountedRef.current = false;
      requestIdRef.current += 1;
    };
  }, [reload]);

  return {
    ...state,
    hasMore: nextCursor !== null,
    loadMore,
    reload,
  };
}

function resolveError(error: unknown): Error {
  return error instanceof Error ? error : new Error("Unknown error");
}
