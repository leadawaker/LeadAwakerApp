/**
 * Parse users.preferences (a JSON string in the DB, sometimes already an object)
 * into a plain object. Anything missing, malformed or not an object becomes `{}`.
 */
export function parsePrefs(raw: string | Record<string, unknown> | null | undefined): Record<string, any> {
  try {
    const v = typeof raw === "string" ? JSON.parse(raw || "{}") : raw;
    return v && typeof v === "object" && !Array.isArray(v) ? v : {};
  } catch {
    return {};
  }
}
