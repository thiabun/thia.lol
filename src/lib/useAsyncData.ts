import { useCallback, useEffect, useRef, useState } from "react";
import { useRegisterPageLoadTask } from "./pageLoadingContext";

type AsyncState<T> = {
  data: T | undefined;
  error: Error | undefined;
  lastLoadedAt: number | undefined;
  loading: boolean;
  refreshError: Error | undefined;
  refreshing: boolean;
  reload: () => Promise<void>;
};

export function useAsyncData<T>(load: () => Promise<T>): AsyncState<T> {
  const registerPageLoadTask = useRegisterPageLoadTask();
  const mountedRef = useRef(true);
  const requestIdRef = useRef(0);
  const [state, setState] = useState<Omit<AsyncState<T>, "reload">>({
    data: undefined,
    error: undefined,
    lastLoadedAt: undefined,
    loading: true,
    refreshError: undefined,
    refreshing: false,
  });

  const reload = useCallback(async () => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    setState((current) => {
      const hasLoadedData = current.data !== undefined;

      return {
        ...current,
        error: hasLoadedData ? current.error : undefined,
        loading: !hasLoadedData,
        refreshError: undefined,
        refreshing: hasLoadedData,
      };
    });

    try {
      const data = await load();

      if (mountedRef.current && requestIdRef.current === requestId) {
        setState({
          data,
          error: undefined,
          lastLoadedAt: Date.now(),
          loading: false,
          refreshError: undefined,
          refreshing: false,
        });
      }
    } catch (error: unknown) {
      if (mountedRef.current && requestIdRef.current === requestId) {
        const resolvedError =
          error instanceof Error ? error : new Error("Unknown error");

        setState((current) => {
          if (current.data === undefined) {
            return {
              data: undefined,
              error: resolvedError,
              lastLoadedAt: undefined,
              loading: false,
              refreshError: undefined,
              refreshing: false,
            };
          }

          return {
            ...current,
            loading: false,
            refreshError: resolvedError,
            refreshing: false,
          };
        });
      }
    }
  }, [load]);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    const finishPageLoadTask = registerPageLoadTask();
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    queueMicrotask(() => {
      if (active && requestIdRef.current === requestId) {
        setState({
          data: undefined,
          error: undefined,
          lastLoadedAt: undefined,
          loading: true,
          refreshError: undefined,
          refreshing: false,
        });
      }
    });

    load()
      .then((data) => {
        if (active && requestIdRef.current === requestId) {
          setState({
            data,
            error: undefined,
            lastLoadedAt: Date.now(),
            loading: false,
            refreshError: undefined,
            refreshing: false,
          });
        }
      })
      .catch((error: unknown) => {
        if (active && requestIdRef.current === requestId) {
          setState({
            data: undefined,
            error: error instanceof Error ? error : new Error("Unknown error"),
            lastLoadedAt: undefined,
            loading: false,
            refreshError: undefined,
            refreshing: false,
          });
        }
      })
      .finally(finishPageLoadTask);

    return () => {
      active = false;
      finishPageLoadTask();
    };
  }, [load, registerPageLoadTask]);

  return { ...state, reload };
}
