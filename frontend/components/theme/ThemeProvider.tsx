"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

export type Theme = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

interface ThemeContextType {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: "system",
  resolvedTheme: "dark",
  setTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("system");
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>("dark");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Read stored preference or default to system
    const stored = (localStorage.getItem("mg_theme") as Theme) || "system";
    setThemeState(stored);

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const computeResolved = (t: Theme): ResolvedTheme => {
      if (t === "system") {
        return mediaQuery.matches ? "dark" : "light";
      }
      return t;
    };

    const initialResolved = computeResolved(stored);
    setResolvedTheme(initialResolved);
    document.documentElement.setAttribute("data-theme", initialResolved);
    setMounted(true);

    const handleSystemChange = () => {
      if (theme === "system") {
        const newResolved = mediaQuery.matches ? "dark" : "light";
        setResolvedTheme(newResolved);
        document.documentElement.setAttribute("data-theme", newResolved);
      }
    };

    mediaQuery.addEventListener("change", handleSystemChange);
    return () => mediaQuery.removeEventListener("change", handleSystemChange);
  }, [theme]);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    localStorage.setItem("mg_theme", newTheme);

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const newResolved: ResolvedTheme =
      newTheme === "system"
        ? mediaQuery.matches
          ? "dark"
          : "light"
        : newTheme;

    setResolvedTheme(newResolved);
    document.documentElement.setAttribute("data-theme", newResolved);
  };

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
