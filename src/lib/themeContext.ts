import { createContext } from "react";
import type { ThemeName, ThemePreference } from "./types";

export const themeLabels: Record<ThemeName, string> = {
  light: "Light",
  dark: "Dark",
};

export const themePreferenceLabels: Record<ThemePreference, string> = {
  ...themeLabels,
  profile: "Profile Theme",
};

export type ThemeContextValue = {
  theme: ThemeName;
  themeLabel: string;
  themePreference: ThemePreference;
  themePreferenceLabel: string;
  setTheme: (theme: ThemePreference) => void;
  setThemePreference: (theme: ThemePreference) => void;
  toggleTheme: () => void;
};

export const ThemeContext = createContext<ThemeContextValue | undefined>(
  undefined,
);
