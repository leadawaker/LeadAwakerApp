import { useEffect, useSyncExternalStore } from "react";

/**
 * Registry for the list-panel fold button (`ListPanelFooter`). A page with a list
 * panel calls `useListPanelFold(true)`; the button renders only while some page has
 * registered. It flips the shared `useListPanelState` between full and compact.
 */
let count = 0;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

export function useListPanelFold(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    count += 1;
    emit();
    return () => {
      count -= 1;
      emit();
    };
  }, [enabled]);
}

/** True while the page on screen has a list panel to fold. */
export function useActiveListPanelFold(): boolean {
  return useSyncExternalStore(subscribe, () => count > 0, () => false);
}
