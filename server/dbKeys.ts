import { getTableColumns } from "drizzle-orm";

// Memoize key maps per table — tables are module-level constants so WeakMap
// keys are stable for the process lifetime. This avoids rebuilding on every call.
const keyMapCache = new WeakMap<object, Record<string, string>>();
const reverseKeyMapCache = new WeakMap<object, Record<string, string>>();

/**
 * Build a map of JS camelCase key → DB snake_case column name for a Drizzle table.
 */
function buildKeyMap(table: any): Record<string, string> {
  if (keyMapCache.has(table)) return keyMapCache.get(table)!;
  const columns = getTableColumns(table);
  const map: Record<string, string> = {};
  for (const [jsKey, col] of Object.entries(columns)) {
    map[jsKey] = (col as any).name; // .name is the actual DB column name
  }
  keyMapCache.set(table, map);
  return map;
}

/**
 * Build the reverse map: DB snake_case column name → JS camelCase key.
 */
function buildReverseKeyMap(table: any): Record<string, string> {
  if (reverseKeyMapCache.has(table)) return reverseKeyMapCache.get(table)!;
  const columns = getTableColumns(table);
  const map: Record<string, string> = {};
  for (const [jsKey, col] of Object.entries(columns)) {
    map[(col as any).name] = jsKey;
  }
  reverseKeyMapCache.set(table, map);
  return map;
}

/**
 * Convert a single row object's keys from camelCase JS property names
 * to the actual DB column names defined in the Drizzle schema.
 *
 * Returns null/undefined as-is so callers don't need to guard.
 */
export function toDbKeys(
  row: Record<string, unknown> | null | undefined,
  table: any,
): Record<string, unknown> | null | undefined {
  if (row == null) return row;
  const keyMap = buildKeyMap(table);
  const result: Record<string, unknown> = {};
  for (const [jsKey, value] of Object.entries(row)) {
    const dbKey = keyMap[jsKey] ?? jsKey; // fall back to original key if not in map
    result[dbKey] = value;
  }
  return result;
}

/**
 * Convert an array of row objects from camelCase JS property names
 * to the actual DB column names defined in the Drizzle schema.
 */
export function toDbKeysArray(
  rows: Record<string, unknown>[] | null | undefined,
  table: any,
): Record<string, unknown>[] {
  if (!rows) return [];
  return rows.map((row) => toDbKeys(row, table) as Record<string, unknown>);
}

/**
 * Convert an incoming request body's keys from DB column names (snake_case)
 * back to the camelCase JS property names expected by Drizzle/Zod schemas.
 */
export function fromDbKeys(
  body: Record<string, unknown> | null | undefined,
  table: any,
): Record<string, unknown> {
  if (!body) return {};
  const reverseMap = buildReverseKeyMap(table);
  const result: Record<string, unknown> = {};
  for (const [dbKey, value] of Object.entries(body)) {
    const jsKey = reverseMap[dbKey] ?? dbKey; // fall back to original key if not in map
    result[jsKey] = value;
  }
  return result;
}
