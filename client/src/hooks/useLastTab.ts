import { useCallback, useEffect, useState } from "react";
import { readLastTab, writeLastTab } from "@/lib/lastTab";

/**
 * A page's open tab, remembered per user and page (lib/lastTab.ts), so leaving
 * the page and coming back lands on the same tab. `linked` (a link's ?tab=)
 * wins over the remembered tab and is remembered itself. A remembered tab that
 * is not in `allowed` opens `fallback`. Pages that hide tabs per role still
 * check the returned tab against what this user may see.
 */
export function useLastTab<T extends string>(
  page: string,
  allowed: readonly T[],
  fallback: T,
  linked?: T | null,
): [T, (tab: T) => void] {
  const [tab, setTabState] = useState<T>(() => linked ?? readLastTab(page, allowed, fallback));
  useEffect(() => {
    if (linked) writeLastTab(page, linked);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const setTab = useCallback((next: T) => {
    setTabState(next);
    writeLastTab(page, next);
  }, [page]);
  return [tab, setTab];
}
