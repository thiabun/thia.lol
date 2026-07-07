import {
  type PropsWithChildren,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { ThemeName } from "./types";
import { ThemeContext, themeLabels, type ThemeContextValue } from "./themeContext";
import { beginRootThemeTransition } from "./themeTransitions";

const storageKey = "thia.lol.theme";

function normalizeStoredTheme(value: string | null | undefined): ThemeName | null {
  if (value === "light" || value === "sunveil") {
    return "light";
  }

  if (value === "dark" || value === "frostveil") {
    return "dark";
  }

  return null;
}

export function ThemeProvider({ children }: PropsWithChildren) {
  const [theme, setThemeState] = useState<ThemeName>(() => {
    if (typeof window === "undefined") {
      return "light";
    }

    const stored = normalizeStoredTheme(window.localStorage.getItem(storageKey));
    if (stored) {
      return stored;
    }

    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  });

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme =
      theme === "dark" ? "dark" : "light";
    window.localStorage.setItem(storageKey, theme);
  }, [theme]);

  const setTheme = useCallback(
    (nextTheme: ThemeName) => {
      if (nextTheme !== theme) {
        beginRootThemeTransition();
      }

      setThemeState(nextTheme);
    },
    [theme],
  );

  const toggleTheme = useCallback(() => {
    beginRootThemeTransition();
    setThemeState((current) =>
      current === "light" ? "dark" : "light",
    );
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      themeLabel: themeLabels[theme],
      setTheme,
      toggleTheme,
    }),
    [setTheme, theme, toggleTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
