// Rebuilding the last ~30 days of follower counts at the first backfill. The profile only gives today's
// followers_count, but Instagram's daily follower_count insight is the net change per day (followers
// gained minus lost), so: followers at the end of day D = today's count minus the net changes after D.
// Pure; the Graph call is getFollowerDailyChanges in insightsApi.ts. Spec: docs/superpowers/specs/2026-10-20-insights-design.md

const DAY_MS = 86_400_000;

/**
 * The day a daily value belongs to, from Meta's end_time. A day value is stamped with the END of its
 * 24 hours (Meta documents it as e.g. 2018-01-12T08:00:00+0000 for the day that began on 01-11), so the
 * day is the UTC date one day before end_time. UNVERIFIED against a live answer: it is kept in this one
 * function so it can be corrected in one place.
 */
export function dayOfEndTime(endTime: string): string | null {
  const t = Date.parse(endTime);
  return Number.isFinite(t) ? new Date(t - DAY_MS).toISOString().slice(0, 10) : null;
}

/** { data: [{ name: "follower_count", values: [{ value, end_time }] }] } -> net change per UTC day, or null when the metric is not in the answer. */
export function parseFollowerChanges(body: unknown): Record<string, number> | null {
  const rows = Array.isArray((body as any)?.data) ? (body as any).data : [];
  const row = rows.find((r: any) => r?.name === "follower_count");
  if (!row || !Array.isArray(row.values)) return null;
  const out: Record<string, number> = {};
  for (const v of row.values) {
    const day = typeof v?.end_time === "string" ? dayOfEndTime(v.end_time) : null;
    const n = typeof v?.value === "number" ? v.value : typeof v?.value === "string" && v.value.trim() !== "" ? Number(v.value) : NaN;
    if (day && Number.isFinite(n)) out[day] = (out[day] ?? 0) + n;
  }
  return out;
}

/**
 * End-of-day follower counts for the days before `today`, newest to oldest, from today's count and the
 * daily net changes (a missing day counts as 0 change). Covers every day from yesterday back to the
 * earliest day Meta answered for. Returns [] when there is nothing to derive from, and null when the
 * numbers do not add up (a count below 0), so the caller can skip instead of storing nonsense.
 */
export function deriveFollowerHistory(current: number, today: string, changes: Record<string, number>): { day: string; value: number }[] | null {
  const days = Object.keys(changes).filter((d) => d <= today).sort();
  if (days.length === 0) return [];
  // The end of yesterday is today's count minus whatever happened so far today.
  let running = current - (changes[today] ?? 0);
  const out: { day: string; value: number }[] = [];
  const first = days[0];
  for (let t = Date.parse(`${today}T00:00:00Z`) - DAY_MS; ; t -= DAY_MS) {
    const day = new Date(t).toISOString().slice(0, 10);
    if (day < first) break;
    if (!Number.isFinite(running) || running < 0) return null;
    out.push({ day, value: running });
    running -= changes[day] ?? 0;
  }
  return out;
}
