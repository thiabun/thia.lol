import { createContext } from "react";
import type { ThemeName } from "./types";

export const themeLabels: Record<ThemeName, string> = {
  sunveil: "Sunveil",
  frostveil: "Frostveil",
};

export type ThemeContextValue = {
  theme: ThemeName;
  themeLabel: string;
  setTheme: (theme: ThemeName) => void;
  toggleTheme: () => void;
};

export const ThemeContext = createContext<ThemeContextValue | undefined>(
  undefined,
);
