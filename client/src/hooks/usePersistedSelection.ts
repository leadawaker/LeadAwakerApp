import { useState, useMemo, useCallback, useRef, useEffect } from "react";

/**
 * Persists selection state (by ID) to localStorage so it survives page navigation.
 * Derives the selected object synchronously from the items array — no extra render
 * cycle when items first arrive, preventing visible "pop" on initial load.
 *
 * Listens for external localStorage changes (via "persisted-selection" custom events)
 * so that e.g. the search popover can select a lead/campaign/prospect from outside.
 */
export function usePersistedSelection<T>(
  key: string,
  idExtractor: (item: T) => number | string,
  items: T[],
): [T | null, (item: T | null | ((prev: T | null) => T | null)) => void] {
  const idRef = useRef(idExtractor);
  idRef.current = idExtractor;
  const itemsRef = useRef(items);
  itemsRef.current = items;

  // Store only the ID in state — initialized synchronously from localStorage
  const [selectedId, setSelectedId] = useState<string | null>(() => {
    try { return localStorage.getItem(key); } catch { return null; }
  });

  // Listen for external selection changes (e.g. from search popover)
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.key === key) {
        setSelectedId(detail.id);
      }
    };
    window.addEventListener("persisted-selection", handler);
    return () => window.removeEventListener("persisted-selection", handler);
  }, [key]);

  // Derive the selected object synchronously — same render as items arriving.
  // Stabilize the reference: only return a new object when the data actually changed,
  // not just because the items array was re-fetched with identical content.
  const prevSelectedRef = useRef<T | null>(null);
  const selected = useMemo(() => {
    if (!selectedId || items.length === 0) { prevSelectedRef.current = null; return null; }
    const found = items.find((i) => String(idRef.current(i)) === selectedId) ?? null;
    if (found && prevSelectedRef.current && JSON.stringify(found) === JSON.stringify(prevSelectedRef.current)) {
      return prevSelectedRef.current;
    }
    prevSelectedRef.current = found;
    return found;
  }, [selectedId, items]);

  const setSelected = useCallback(
    (itemOrUpdater: T | null | ((prev: T | null) => T | null)) => {
      if (typeof itemOrUpdater === "function") {
        const updater = itemOrUpdater as (prev: T | null) => T | null;
        setSelectedId((prevId) => {
          // Reconstruct prev object from current items to pass to updater
          const prevItem = prevId
            ? itemsRef.current.find((i) => String(idRef.current(i)) === prevId) ?? null
            : null;
          const next = updater(prevItem);
          if (next) {
            const nextId = String(idRef.current(next));
            try { localStorage.setItem(key, nextId); } catch {}
            return nextId;
          } else {
            try { localStorage.removeItem(key); } catch {}
            return null;
          }
        });
      } else {
        if (itemOrUpdater) {
          const nextId = String(idRef.current(itemOrUpdater));
          try { localStorage.setItem(key, nextId); } catch {}
          setSelectedId(nextId);
        } else {
          try { localStorage.removeItem(key); } catch {}
          setSelectedId(null);
        }
      }
    },
    [key],
  );

  return [selected, setSelected];
}

/**
 * Set a persisted selection from outside the component that owns it.
 * Updates localStorage AND dispatches a custom event so the hook picks it up immediately.
 */
export function setPersistedSelection(key: string, id: string | number) {
  const idStr = String(id);
  localStorage.setItem(key, idStr);
  window.dispatchEvent(new CustomEvent("persisted-selection", { detail: { key, id: idStr } }));
}
