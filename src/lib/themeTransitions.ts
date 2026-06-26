type RootThemeTransitionOptions = {
  animate?: boolean;
};

const rootThemeTransitionDurationMs = 560;
let rootThemeTransitionTimer: number | undefined;

export function withRootThemeTransition(
  update: () => void,
  options: RootThemeTransitionOptions = {},
) {
  beginRootThemeTransition(options);
  update();
}

export function beginRootThemeTransition(
  options: RootThemeTransitionOptions = {},
) {
  if (typeof document === "undefined" || typeof window === "undefined") {
    return;
  }

  if (options.animate === false || prefersReducedMotion()) {
    return;
  }

  const root = document.documentElement;

  if (rootThemeTransitionTimer !== undefined) {
    window.clearTimeout(rootThemeTransitionTimer);
  }

  root.dataset.themeTransition = "true";

  rootThemeTransitionTimer = window.setTimeout(() => {
    delete root.dataset.themeTransition;
    rootThemeTransitionTimer = undefined;
  }, rootThemeTransitionDurationMs);
}

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
