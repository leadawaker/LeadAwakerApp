import { useCallback, useEffect, useRef, useState } from "react";
import { useIsMobile } from "@/hooks/useIsMobile";
import { DEFAULT_FILTERS, type SessionFilters, type SessionSort } from "../../sessionsView";

export type SessionsView = "table" | "folders";

/** The one right-hand panel the Sessions tab can have open: the create flow, or a prospect's detail. */
export type SessionsPanel = { kind: "create" } | { kind: "detail"; key: string } | null;

/** How long a row stays tinted after it was added or changed. */
const FLASH_MS = 4000;

/**
 * Everything the Sessions tab remembers while it is open: search, filters, sort, view,
 * the open panel and the row to flash. DemosPage owns it (one call) and hands it to the
 * topbar and the body, so it also survives a switch to another tab.
 */
export function useSessionsState() {
  const isPhone = useIsMobile(768);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<SessionFilters>(DEFAULT_FILTERS);
  const [sort, setSort] = useState<SessionSort>("newest");
  // Folders suit a phone (cards, not a wide table); the table suits everything else.
  const [view, setView] = useState<SessionsView>(() => (isPhone ? "folders" : "table"));
  const [panel, setPanel] = useState<SessionsPanel>(null);
  const [highlightKey, setHighlightKey] = useState<string | null>(null);

  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const flash = useCallback((key: string) => {
    window.clearTimeout(timer.current);
    setHighlightKey(key);
    timer.current = window.setTimeout(() => setHighlightKey(null), FLASH_MS);
  }, []);

  return { search, setSearch, filters, setFilters, sort, setSort, view, setView, panel, setPanel, highlightKey, flash };
}

export type SessionsState = ReturnType<typeof useSessionsState>;
