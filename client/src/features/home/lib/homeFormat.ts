export type Trend = { dir: "up" | "down" | "flat"; pct: number } | null;

/** Change vs the previous period. null when there is nothing to compare with. */
export function trendOf(c: { value: number; previous: number }): Trend {
  if (!c.previous) return null;
  const pct = Math.round(((c.value - c.previous) / c.previous) * 100);
  if (!Number.isFinite(pct)) return null;
  return { dir: pct > 0 ? "up" : pct < 0 ? "down" : "flat", pct: Math.abs(pct) };
}

/** 134 -> "2m 14s", 45 -> "45s", 0 -> "0s". */
export function formatDuration(seconds: number | null | undefined): string {
  const s = Math.max(0, Math.round(Number(seconds) || 0));
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
}

/** Whole percent, or null when the denominator is zero. */
export function rateOf(part: number, whole: number): number | null {
  return whole > 0 ? Math.round((part / whole) * 100) : null;
}

/** Bar widths as percentages of the largest value; all zero stays zero. */
export function barWidths(values: number[]): number[] {
  const max = Math.max(0, ...values);
  return values.map((v) => (max > 0 ? Math.round((v / max) * 100) : 0));
}
