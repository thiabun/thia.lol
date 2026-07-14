import {
  type PropsWithChildren,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { ThemeName, ThemePreference } from "./types";
import {
  ThemeContext,
  themeLabels,
  themePreferenceLabels,
  type ThemeContextValue,
} from "./themeContext";
import { beginRootThemeTransition } from "./themeTransitions";

const storageKey = "thia.lol.theme";
const standardThemeStorageKey = "thia.lol.theme.standard";

function normalizeStoredThemePreference(
  value: string | null | undefined,
): ThemePreference | null {
  if (value === "light" || value === "sunveil") {
    return "light";
  }

  if (value === "dark" || value === "frostveil") {
    return "dark";
  }

  if (value === "profile") {
    return "profile";
  }

  return null;
}

function normalizeStoredStandardTheme(
  value: string | null | undefined,
): ThemeName | null {
  const normalized = normalizeStoredThemePreference(value);
  return normalized === "light" || normalized === "dark" ? normalized : null;
}

function readStoredValue(key: string) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStoredValue(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Storage can be unavailable in hardened or private browsing contexts.
  }
}

type ThemeState = {
  preference: ThemePreference;
  theme: ThemeName;
};

function initialThemeState(): ThemeState {
  if (typeof window === "undefined") {
    return { preference: "light", theme: "light" };
  }

  const preference = normalizeStoredThemePreference(
    readStoredValue(storageKey),
  );
  const systemTheme: ThemeName = window.matchMedia(
    "(prefers-color-scheme: dark)",
  ).matches
    ? "dark"
    : "light";
  const storedStandardTheme = normalizeStoredStandardTheme(
    readStoredValue(standardThemeStorageKey),
  );
  const theme =
    preference === "light" || preference === "dark"
      ? preference
      : (storedStandardTheme ?? systemTheme);

  return {
    preference: preference ?? theme,
    theme,
  };
}

export function ThemeProvider({ children }: PropsWithChildren) {
  const [{ preference: themePreference, theme }, setThemeState] =
    useState<ThemeState>(initialThemeState);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.dataset.themeChoice = themePreference;
    if (!document.documentElement.dataset.profileTheme) {
      document.documentElement.style.colorScheme =
        theme === "dark" ? "dark" : "light";
    }
    writeStoredValue(storageKey, themePreference);
    writeStoredValue(standardThemeStorageKey, theme);
  }, [theme, themePreference]);

  const setThemePreference = useCallback(
    (nextPreference: ThemePreference) => {
      const nextTheme =
        nextPreference === "profile" ? theme : nextPreference;

      if (nextPreference !== themePreference || nextTheme !== theme) {
        beginRootThemeTransition();
      }

      setThemeState({ preference: nextPreference, theme: nextTheme });
    },
    [theme, themePreference],
  );

  const toggleTheme = useCallback(() => {
    beginRootThemeTransition();
    setThemeState((current) => {
      const nextTheme = current.theme === "light" ? "dark" : "light";
      return { preference: nextTheme, theme: nextTheme };
    });
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      themeLabel: themeLabels[theme],
      themePreference,
      themePreferenceLabel: themePreferenceLabels[themePreference],
      setTheme: setThemePreference,
      setThemePreference,
      toggleTheme,
    }),
    [setThemePreference, theme, themePreference, toggleTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
