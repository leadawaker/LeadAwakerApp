/**
 * Number search that ignores how a number is written (pure, for node:test).
 * "0612…", "+31612…", "0031612…" and "612…" all find a call stored as
 * "+31 6 12…" or "0612…": leading zeros (trunk 0, 00 prefix) are dropped, and
 * a query typed with a country code also matches without it.
 */
export function phoneMatches(stored: string | null | undefined, query: string): boolean {
  const s = (stored ?? "").replace(/\D/g, "").replace(/^0+/, "");
  const q = query.replace(/\D/g, "").replace(/^0+/, "");
  if (!s || !q) return false;
  if (s.includes(q)) return true;
  if (!/^\s*(\+|00)/.test(query)) return false;
  // "+31 612…" against a number stored without its country code: try 1-3 digit codes,
  // keeping at least 6 digits so a short query does not match everything.
  for (let cc = 1; cc <= 3; cc++) {
    const rest = q.slice(cc);
    if (rest.length >= 6 && s.includes(rest)) return true;
  }
  return false;
}
