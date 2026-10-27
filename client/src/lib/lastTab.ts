/**
 * The last tab a user opened on a page, per user and per page (every page tab bar;
 * React pages usually go through hooks/useLastTab.ts).
 * The first visit opens on `fallback` (each page passes its own default tab). Storage can be missing or throw
 * (private windows, blocked site data), so every access is guarded.
 */
export type Store = Pick<Storage, "getItem" | "setItem">;

export function store(): Store | null {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
}

export function currentUserKey(s: Store | null): string {
  try {
    return s?.getItem("leadawaker_user_id") || s?.getItem("leadawaker_user_email") || "anon";
  } catch {
    return "anon";
  }
}

export function lastTabKey(user: string, page: string): string {
  return `la.lastTab.${user}.${page}`;
}

export function readLastTab<T extends string>(page: string, allowed: readonly T[], fallback: T, s: Store | null = store()): T {
  try {
    const v = s?.getItem(lastTabKey(currentUserKey(s), page));
    return allowed.includes(v as T) ? (v as T) : fallback;
  } catch {
    return fallback;
  }
}

export function writeLastTab(page: string, tab: string, s: Store | null = store()): void {
  try {
    s?.setItem(lastTabKey(currentUserKey(s), page), tab);
  } catch {
    /* the tab just is not remembered */
  }
}
