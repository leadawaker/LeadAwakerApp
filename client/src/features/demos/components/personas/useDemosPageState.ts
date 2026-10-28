import { useCallback, useEffect, useRef, useState } from "react";
import { DEFAULT_SORT, type SessionSort } from "../../sessionsView";

/** The one right-hand panel the Demos page can have open: the create flow, or a prospect's detail. */
export type DemosPanel = { kind: "create" } | { kind: "detail"; key: string } | null;

/** How long a row stays tinted once it is on screen. */
const FLASH_MS = 4000;
/**
 * How long a new row's highlight waits for its table: the card opens first (a persona shows a
 * skeleton while it loads), and the Demos tab restarts the timer with FLASH_MS when the row is there.
 */
export const FLASH_WAIT_MS = 15000;

/**
 * Everything the Demos page remembers while it is open: the open card, the Needs follow-up
 * toggle, the Demos tab's sort, the open right-hand panel and the row to flash. DemosPage owns
 * it (one call) and hands it to the topbar and the body, so it also survives a switch to Settings.
 */
export function useDemosPageState() {
  /** Open card: a persona niche, NO_PERSONA_KEY, WEBSITE_KEY, or null. */
  const [selected, setSelected] = useState<string | null>(null);
  const [followUp, setFollowUp] = useState(false);
  /** The Demos tab table's sort, shared by every persona. */
  const [sort, setSort] = useState<SessionSort>(DEFAULT_SORT);
  const [panel, setPanel] = useState<DemosPanel>(null);
  const [highlightKey, setHighlightKey] = useState<string | null>(null);

  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const flash = useCallback((rowKey: string, ms: number = FLASH_MS) => {
    window.clearTimeout(timer.current);
    setHighlightKey(rowKey);
    timer.current = window.setTimeout(() => setHighlightKey(null), ms);
  }, []);

  return { selected, setSelected, followUp, setFollowUp, sort, setSort, panel, setPanel, highlightKey, flash };
}

export type DemosPageState = ReturnType<typeof useDemosPageState>;
