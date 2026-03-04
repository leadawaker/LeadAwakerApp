import { useState, useMemo, useCallback, useRef } from "react";

/**
 * Persists selection state (by ID) to localStorage so it survives page navigation.
 * Derives the selected object synchronously from the items array — no extra render
 * cycle when items first arrive, preventing visible "pop" on initial load.
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

  // Derive the selected object synchronously — same render as items arriving
  const selected = useMemo(() => {
    if (!selectedId || items.length === 0) return null;
    return items.find((i) => String(idRef.current(i)) === selectedId) ?? null;
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
