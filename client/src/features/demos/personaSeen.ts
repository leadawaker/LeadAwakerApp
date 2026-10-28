// Pure: which persona cards this user has already looked at. The page keeps the
// map in localStorage (try/catch there); nothing here touches storage.

/** Card key (persona niche or special key) to when this user last opened it (ISO). */
export type SeenMap = Record<string, string>;

/** Entries older than this are dropped on write: past the 7-day window, an old seen time changes nothing. */
export const SEEN_KEEP_MS = 14 * 24 * 60 * 60 * 1000;

/** `demos.personaSeen.<userId>`, `demos.personaSeen.anon` without one. */
export function seenStorageKey(userId: string | null | undefined): string {
  return `demos.personaSeen.${userId || "anon"}`;
}

/** Never throws: null, bad JSON, arrays and non-objects give {}; entries whose value is not a parseable date string are dropped. */
export function parseSeen(raw: string | null): SeenMap {
  if (!raw) return {};
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return {};
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) return {};
  const out: SeenMap = {};
  for (const [key, value] of Object.entries(data)) {
    if (typeof value === "string" && Number.isFinite(Date.parse(value))) out[key] = value;
  }
  return out;
}

/** A new map (input untouched) with `key` set to now, minus entries older than now - SEEN_KEEP_MS. */
export function markSeen(map: SeenMap, key: string, now: number): SeenMap {
  const out: SeenMap = {};
  for (const [k, v] of Object.entries(map)) {
    if (now - Date.parse(v) <= SEEN_KEEP_MS) out[k] = v;
  }
  out[key] = new Date(now).toISOString();
  return out;
}
