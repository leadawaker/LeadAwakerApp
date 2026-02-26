import { useState, useEffect, useCallback, useRef } from "react";

/**
 * Persists selection state (by ID) to localStorage so it survives page navigation.
 * On mount, restores the previously selected item from the items array.
 * Supports both direct value and updater function patterns for the setter.
 */
export function usePersistedSelection<T>(
  key: string,
  idExtractor: (item: T) => number | string,
  items: T[],
): [T | null, (item: T | null | ((prev: T | null) => T | null)) => void] {
  const idRef = useRef(idExtractor);
  idRef.current = idExtractor;

  const [selected, setSelectedRaw] = useState<T | null>(null);

  // Restore selection when items become available
  useEffect(() => {
    if (items.length === 0) return;
    const storedId = localStorage.getItem(key);
    if (!storedId) return;

    // If current selection matches stored, sync with latest data
    if (selected) {
      const currentId = String(idRef.current(selected));
      if (currentId === storedId) {
        const refreshed = items.find((i) => String(idRef.current(i)) === storedId);
        if (refreshed && refreshed !== selected) setSelectedRaw(refreshed);
        return;
      }
    }

    // No current selection — restore from storage
    const found = items.find((i) => String(idRef.current(i)) === storedId);
    if (found) setSelectedRaw(found);
  }, [items, key, selected]);

  const setSelected = useCallback(
    (itemOrUpdater: T | null | ((prev: T | null) => T | null)) => {
      if (typeof itemOrUpdater === "function") {
        const updater = itemOrUpdater as (prev: T | null) => T | null;
        setSelectedRaw((prev) => {
          const next = updater(prev);
          if (next) {
            localStorage.setItem(key, String(idRef.current(next)));
          } else {
            localStorage.removeItem(key);
          }
          return next;
        });
      } else {
        setSelectedRaw(itemOrUpdater);
        if (itemOrUpdater) {
          localStorage.setItem(key, String(idRef.current(itemOrUpdater)));
        } else {
          localStorage.removeItem(key);
        }
      }
    },
    [key],
  );

  return [selected, setSelected];
}
