import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";

/* ── Theme context (shared state across all consumers) ─────────────────── */

interface ThemeCtx {
  isDark: boolean;
  toggleTheme: () => void;
  setIsDark: (v: boolean) => void;
}

const ThemeContext = createContext<ThemeCtx | null>(null);

/**
 * Provider — mount once near the app root (e.g. inside App or CrmShell).
 * All useTheme() consumers will share the same isDark state.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [isDark, setIsDark] = useState(() => {
    const stored = localStorage.getItem("theme");
    if (stored === "dark") return true;
    if (stored === "light") return false;
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    localStorage.setItem("theme", isDark ? "dark" : "light");
  }, [isDark]);

  const toggleTheme = useCallback(() => setIsDark((prev) => !prev), []);

  return (
    <ThemeContext value={{ isDark, toggleTheme, setIsDark }}>
      {children}
    </ThemeContext>
  );
}

/**
 * Hook to consume the shared theme state.
 * Must be rendered inside a <ThemeProvider>.
 */
export function useTheme(): ThemeCtx {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within a ThemeProvider");
  return ctx;
}
