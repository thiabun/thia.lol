import {
  type PropsWithChildren,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { ThemeName } from "./types";
import { ThemeContext, themeLabels, type ThemeContextValue } from "./themeContext";

const storageKey = "thia.lol.theme";

export function ThemeProvider({ children }: PropsWithChildren) {
  const [theme, setThemeState] = useState<ThemeName>(() => {
    if (typeof window === "undefined") {
      return "sunveil";
    }

    const stored = window.localStorage.getItem(storageKey);
    if (stored === "sunveil" || stored === "frostveil") {
      return stored;
    }

    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "frostveil"
      : "sunveil";
  });

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme =
      theme === "frostveil" ? "dark" : "light";
    window.localStorage.setItem(storageKey, theme);
  }, [theme]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      themeLabel: themeLabels[theme],
      setTheme: setThemeState,
      toggleTheme: () =>
        setThemeState((current) =>
          current === "sunveil" ? "frostveil" : "sunveil",
        ),
    }),
    [theme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
