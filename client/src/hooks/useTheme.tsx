import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";

/* ── Theme context (shared state across all consumers) ─────────────────── */

export type ThemeMode = "light" | "dark" | "system";

interface ThemeCtx {
  /** Effective resolved value — true when the .dark class is applied */
  isDark: boolean;
  /** The user's chosen mode: explicit light/dark, or follow the OS */
  themeMode: ThemeMode;
  setThemeMode: (m: ThemeMode) => void;
  /** Back-compat: flips between light and dark (never selects system) */
  toggleTheme: () => void;
  /** Back-compat: sets an explicit light/dark mode */
  setIsDark: (v: boolean) => void;
  /** When true, .dark follows OS prefers-color-scheme instead of the CRM choice */
  publicMode: boolean;
  setPublicMode: (v: boolean) => void;
}

const ThemeContext = createContext<ThemeCtx | null>(null);

const systemPrefersDark = () => window.matchMedia("(prefers-color-scheme: dark)").matches;

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themeMode, setThemeModeState] = useState<ThemeMode>(() => {
    const stored = localStorage.getItem("theme");
    if (stored === "dark" || stored === "light" || stored === "system") return stored;
    // Old format: stored as "true"/"false" booleans
    if (stored === "true") return "dark";
    if (stored === "false") return "light";
    return "system";
  });

  const [publicMode, setPublicMode] = useState(false);
  const [systemDark, setSystemDark] = useState(systemPrefersDark);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const followSystem = publicMode || themeMode === "system";
  const isDark = followSystem ? systemDark : themeMode === "dark";

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
    if (!publicMode) localStorage.setItem("theme", themeMode);
  }, [isDark, themeMode, publicMode]);

  const setThemeMode = useCallback((m: ThemeMode) => setThemeModeState(m), []);
  const toggleTheme = useCallback(
    () => setThemeModeState((prev) => (prev === "dark" ? "light" : "dark")),
    [],
  );
  const setIsDark = useCallback((v: boolean) => setThemeModeState(v ? "dark" : "light"), []);

  return (
    <ThemeContext value={{ isDark, themeMode, setThemeMode, toggleTheme, setIsDark, publicMode, setPublicMode }}>
      {children}
    </ThemeContext>
  );
}

export function useTheme(): ThemeCtx {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within a ThemeProvider");
  return ctx;
}
