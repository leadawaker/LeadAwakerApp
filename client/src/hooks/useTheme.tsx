import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";

/* ── Theme context (shared state across all consumers) ─────────────────── */

interface ThemeCtx {
  isDark: boolean;
  toggleTheme: () => void;
  setIsDark: (v: boolean) => void;
  /** When true, .dark follows OS prefers-color-scheme instead of the CRM toggle */
  publicMode: boolean;
  setPublicMode: (v: boolean) => void;
}

const ThemeContext = createContext<ThemeCtx | null>(null);

/**
 * Provider — mount once near the app root (e.g. inside App or CrmShell).
 * All useTheme() consumers will share the same isDark state.
 *
 * publicMode = true  → .dark on <html> follows system preference (public pages)
 * publicMode = false → .dark on <html> follows localStorage toggle (CRM)
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [isDark, setIsDark] = useState(() => {
    const stored = localStorage.getItem("theme");
    if (stored === "dark") return true;
    if (stored === "light") return false;
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });

  const [publicMode, setPublicMode] = useState(false);

  useEffect(() => {
    const root = document.documentElement;

    if (publicMode) {
      /* Public pages: follow system preference, ignore CRM toggle */
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      const apply = (dark: boolean) => {
        root.classList.toggle("dark", dark);
      };
      apply(mq.matches);
      const handler = (e: MediaQueryListEvent) => apply(e.matches);
      mq.addEventListener("change", handler);
      return () => mq.removeEventListener("change", handler);
    }

    /* CRM pages: follow the manual toggle stored in localStorage */
    root.classList.toggle("dark", isDark);
    localStorage.setItem("theme", isDark ? "dark" : "light");
  }, [isDark, publicMode]);

  const toggleTheme = useCallback(() => setIsDark((prev) => !prev), []);

  return (
    <ThemeContext value={{ isDark, toggleTheme, setIsDark, publicMode, setPublicMode }}>
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
