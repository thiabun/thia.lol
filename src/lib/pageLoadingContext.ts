import {
  createContext,
  useContext,
  useEffect,
  useRef,
} from "react";

export type PageLoadingContextValue = {
  registerTask: () => () => void;
};

export const PageLoadingContext = createContext<PageLoadingContextValue>({
  registerTask: () => () => undefined,
});

export function useRegisterPageLoadTask() {
  return useContext(PageLoadingContext).registerTask;
}

export function usePageLoadSignal(active: boolean, label?: string) {
  const registerTask = useRegisterPageLoadTask();
  const finishTaskRef = useRef<(() => void) | undefined>(undefined);

  useEffect(() => {
    if (!active) {
      finishTaskRef.current?.();
      finishTaskRef.current = undefined;
      return undefined;
    }

    finishTaskRef.current?.();
    finishTaskRef.current = registerTask();

    return () => {
      finishTaskRef.current?.();
      finishTaskRef.current = undefined;
    };
  }, [active, label, registerTask]);
}
