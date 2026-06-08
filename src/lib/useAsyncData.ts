import { useEffect, useState } from "react";

type AsyncState<T> = {
  data: T | undefined;
  loading: boolean;
  error: Error | undefined;
  usingFallback: boolean;
};

export function useAsyncData<T>(
  load: () => Promise<T>,
  fallback?: T,
): AsyncState<T> {
  const [state, setState] = useState<AsyncState<T>>({
    data: fallback,
    loading: true,
    error: undefined,
    usingFallback: false,
  });

  useEffect(() => {
    let active = true;

    queueMicrotask(() => {
      if (active) {
        setState({
          data: fallback,
          loading: true,
          error: undefined,
          usingFallback: false,
        });
      }
    });

    load()
      .then((data) => {
        if (active) {
          setState({ data, loading: false, error: undefined, usingFallback: false });
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setState({
            data: fallback,
            loading: false,
            error: error instanceof Error ? error : new Error("Unknown error"),
            usingFallback: fallback !== undefined,
          });
        }
      });

    return () => {
      active = false;
    };
  }, [fallback, load]);

  return state;
}
