// Which posts in the Insights table are "high performers": views at least twice the median views of
// the account's posts that have views. Fewer than 4 such posts is too little to call anything high.
// A zero median would make 2 x median = 0 and flag every post, so the bar is at least 1 view.

export const HIGHLIGHT_MIN_POSTS = 4;
export const HIGHLIGHT_FACTOR = 2;

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** The views a post needs to count as a high performer, or null when there are too few posts. */
export function highlightThreshold(views: number[]): number | null {
  if (views.length < HIGHLIGHT_MIN_POSTS) return null;
  const m = median(views);
  return m === null ? null : Math.max(HIGHLIGHT_FACTOR * m, 1);
}

/** igMediaIds of the high performers. Posts without a views value are ignored. */
export function highPerformers(posts: { igMediaId: string; metrics: Record<string, number> }[]): Set<string> {
  const withViews = posts.filter((p) => Number.isFinite(p.metrics.views));
  const bar = highlightThreshold(withViews.map((p) => p.metrics.views));
  const out = new Set<string>();
  if (bar === null) return out;
  for (const p of withViews) if (p.metrics.views >= bar) out.add(p.igMediaId);
  return out;
}
