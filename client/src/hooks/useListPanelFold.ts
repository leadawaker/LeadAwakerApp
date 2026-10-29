import { useEffect, useRef, useSyncExternalStore } from "react";

/**
 * Registry for the list-panel fold controls (`ListPanelFoldButton` in the list
 * panel footer, `ListPanelUnfoldButton` at its edge while hidden). A page with a
 * list panel calls `useListPanelFold(true, ...)`; the controls render only while
 * some page has registered, and read the page's mode from here.
 *
 * - mode "cycle": full → compact → hidden → full (shared `useListPanelState`).
 * - mode "compact": full ↔ compact (Calls, Chats keep their list as a rail).
 * - `onToggle` + `hidden`: a page with its own local panel state (Speed to Lead).
 */
export type ListPanelFoldMode = "cycle" | "compact";

export interface ListPanelFoldEntry {
  id: number;
  mode: ListPanelFoldMode;
  /** Only for pages with their own panel state. */
  hidden?: boolean;
  toggle?: () => void;
}

const entries: ListPanelFoldEntry[] = [];
const listeners = new Set<() => void>();
let snapshot: ListPanelFoldEntry | null = null;
let seq = 0;

function emit() {
  snapshot = entries[entries.length - 1] ?? null;
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

export function useListPanelFold(
  enabled: boolean,
  opts: { mode?: ListPanelFoldMode; hidden?: boolean; onToggle?: () => void } = {},
) {
  const toggleRef = useRef(opts.onToggle);
  toggleRef.current = opts.onToggle;
  const mode = opts.mode ?? "cycle";
  const hidden = opts.hidden;
  const custom = !!opts.onToggle;

  useEffect(() => {
    if (!enabled) return;
    const entry: ListPanelFoldEntry = {
      id: ++seq,
      mode,
      hidden,
      toggle: custom ? () => toggleRef.current?.() : undefined,
    };
    entries.push(entry);
    emit();
    return () => {
      const i = entries.indexOf(entry);
      if (i >= 0) entries.splice(i, 1);
      emit();
    };
  }, [enabled, mode, hidden, custom]);
}

/** The registration of the page on screen, or null when it has no list panel. */
export function useActiveListPanelFold(): ListPanelFoldEntry | null {
  return useSyncExternalStore(subscribe, () => snapshot, () => null);
}
