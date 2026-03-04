import { useState, useEffect, useCallback } from "react";

/**
 * Like useState, but persists the value to localStorage under the given key.
 * Works for primitives, arrays, and plain objects (anything JSON-serializable).
 *
 * @param key        localStorage key
 * @param fallback   default value when nothing is stored (or stored value is invalid)
 * @param validate   optional guard — if it returns false the stored value is ignored
 */
export function usePersistedState<T>(
  key: string,
  fallback: T,
  validate?: (v: unknown) => boolean,
): [T, (v: T | ((prev: T) => T)) => void] {
  const [value, setValueRaw] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return fallback;
      const parsed = JSON.parse(raw);
      if (validate && !validate(parsed)) return fallback;
      return parsed as T;
    } catch {
      return fallback;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch { /* quota / SSR — ignore */ }
  }, [key, value]);

  const setValue = useCallback(
    (v: T | ((prev: T) => T)) => setValueRaw(v),
    [],
  );

  return [value, setValue];
}
