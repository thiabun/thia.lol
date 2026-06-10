import { useEffect, useState } from "react";

type AsyncState<T> = {
  data: T | undefined;
  loading: boolean;
  error: Error | undefined;
};

export function useAsyncData<T>(load: () => Promise<T>): AsyncState<T> {
  const [state, setState] = useState<AsyncState<T>>({
    data: undefined,
    loading: true,
    error: undefined,
  });

  useEffect(() => {
    let active = true;

    queueMicrotask(() => {
      if (active) {
        setState({
          data: undefined,
          loading: true,
          error: undefined,
        });
      }
    });

    load()
      .then((data) => {
        if (active) {
          setState({ data, loading: false, error: undefined });
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setState({
            data: undefined,
            loading: false,
            error: error instanceof Error ? error : new Error("Unknown error"),
          });
        }
      });

    return () => {
      active = false;
    };
  }, [load]);

  return state;
}
