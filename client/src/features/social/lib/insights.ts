// Pure helpers for the Insights section: the post table's columns and sorting, and number formats.
import type { PostInsight } from "../api/insightsApi";

export type PostColumn = "views" | "reach" | "likes" | "comments" | "shares" | "saved" | "ig_reels_avg_watch_time" | "reels_skip_rate";

/** In display order. Watch time is shown in seconds, skip rate as a percentage. */
export const POST_COLUMNS: PostColumn[] = ["views", "reach", "likes", "comments", "shares", "saved", "ig_reels_avg_watch_time", "reels_skip_rate"];

/** Highest first; a post without the metric goes last; ties by newest. */
export function sortPosts(posts: PostInsight[], by: PostColumn | "postedAt", dir: "desc" | "asc" = "desc"): PostInsight[] {
  const val = (p: PostInsight) => (by === "postedAt" ? (p.postedAt ? Date.parse(p.postedAt) : null) : p.metrics[by] ?? null);
  return [...posts].sort((a, b) => {
    const x = val(a);
    const y = val(b);
    if (x === null && y === null) return Date.parse(b.postedAt ?? "0") - Date.parse(a.postedAt ?? "0");
    if (x === null) return 1;
    if (y === null) return -1;
    return dir === "desc" ? y - x : x - y;
  });
}

/** 1,284 / 12.9K / 4.2M in the reader's language. */
export function compact(n: number | null | undefined, locale: string): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "–";
  return new Intl.NumberFormat(locale, { notation: n >= 10_000 ? "compact" : "standard", maximumFractionDigits: 1 }).format(n);
}

export function cell(col: PostColumn, v: number | undefined, locale: string): string {
  if (v === undefined) return "–";
  if (col === "ig_reels_avg_watch_time") return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(v / 1000)} s`;
  if (col === "reels_skip_rate") return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(v)}%`;
  return compact(v, locale);
}

/** Signed change, or nothing when there is no history yet. */
export function signed(n: number | null, locale: string): string | null {
  if (n === null) return null;
  const s = new Intl.NumberFormat(locale, { signDisplay: "exceptZero" }).format(n);
  return s;
}

/** A y-domain on round numbers around the data, with about `ticks` steps: 4,000 / 4,050 / 4,100, never 4,026 / 4,071. */
export function niceDomain(min: number, max: number, ticks = 3): { domain: [number, number]; ticks: number[] } {
  const span = Math.max(max - min, 1);
  const raw = span / ticks;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= raw) ?? 10 * pow;
  const lo = Math.max(0, Math.floor(min / step) * step);
  const hi = Math.ceil(max / step) * step + (Math.ceil(max / step) * step === max ? step : 0);
  const out: number[] = [];
  for (let v = lo; v <= hi + step / 1000; v += step) out.push(Math.round(v * 1000) / 1000);
  return { domain: [lo, hi], ticks: out };
}
