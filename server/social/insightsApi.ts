// Instagram insights, read-only (GET only): the profile counts, the recent media, a media item's
// insights and an account's totals for one day. A batch of metrics that Meta refuses (an unknown or
// unsupported metric fails the whole request) is asked again one metric at a time, so each refused
// metric becomes a recorded skip with Meta's reason. Tokens never go into errors or logs, and the
// paging URLs Meta returns (they carry the token) are never kept or printed.
import { IG_GRAPH, IgApiError, type IgDeps } from "./instagramApi";
import { MEDIA_FIELDS, PROFILE_FIELDS } from "./insightsMetrics";

export interface IgMedia {
  id: string;
  mediaType: string | null;
  productType: string | null;
  permalink: string | null;
  caption: string;
  postedAt: Date | null;
  likeCount: number | null;
  commentsCount: number | null;
}

export interface MetricResult { values: Record<string, number>; skipped: Record<string, string> }

async function get(deps: Pick<IgDeps, "fetch">, path: string, params: Record<string, string>, token: string): Promise<any> {
  const q = new URLSearchParams(params).toString();
  let res: Response;
  try {
    res = await deps.fetch(`${IG_GRAPH}${path}?${q}`, { method: "GET", headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(20_000) });
  } catch (e: any) {
    throw new IgApiError(`Instagram request failed: ${e?.name === "TimeoutError" ? "timeout" : "network error"}`, undefined, "network");
  }
  let data: any = null;
  try { data = await res.json(); } catch { /* not JSON */ }
  if (!res.ok || data?.error) {
    const err = data?.error;
    throw new IgApiError(String(err?.message ?? `Instagram API error (HTTP ${res.status})`).slice(0, 300), err?.code, res.status >= 500 && !err?.code ? "network" : "http");
  }
  return data;
}

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v)) ? Number(v) : null);

export async function getProfileCounts(deps: Pick<IgDeps, "fetch">, igUserId: string, token: string): Promise<{ followers: number | null; mediaCount: number | null }> {
  const r = await get(deps, `/${igUserId}`, { fields: PROFILE_FIELDS }, token);
  return { followers: num(r?.followers_count), mediaCount: num(r?.media_count) };
}

export function parseMediaList(body: unknown): IgMedia[] {
  const items = Array.isArray((body as any)?.data) ? (body as any).data : [];
  return items.filter((m: any) => m?.id).map((m: any) => {
    const t = typeof m.timestamp === "string" ? Date.parse(m.timestamp) : NaN;
    return {
      id: String(m.id),
      mediaType: typeof m.media_type === "string" ? m.media_type : null,
      productType: typeof m.media_product_type === "string" ? m.media_product_type : null,
      permalink: typeof m.permalink === "string" ? m.permalink : null,
      caption: typeof m.caption === "string" ? m.caption : "",
      postedAt: Number.isFinite(t) ? new Date(t) : null,
      likeCount: num(m.like_count),
      commentsCount: num(m.comments_count),
    };
  });
}

/** The newest media, one page. paging.next is dropped on purpose (it carries the token). */
export async function listRecentMedia(deps: Pick<IgDeps, "fetch">, igUserId: string, token: string, limit: number): Promise<IgMedia[]> {
  return parseMediaList(await get(deps, `/${igUserId}/media`, { fields: MEDIA_FIELDS, limit: String(Math.min(100, Math.max(1, limit))) }, token));
}

/** { data: [{ name, values: [{ value }] } | { name, total_value: { value } }] } -> name: number. */
export function parseInsights(body: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  for (const row of Array.isArray((body as any)?.data) ? (body as any).data : []) {
    if (typeof row?.name !== "string") continue;
    const v = num(row.total_value?.value) ?? num(Array.isArray(row.values) ? row.values[row.values.length - 1]?.value : undefined);
    if (v !== null) out[row.name] = v;
  }
  return out;
}

/**
 * Asks for all metrics at once; when Meta refuses the batch with a request error, asks each one alone
 * so the good ones still come back and each refused one is skipped with its reason. A network or
 * server problem is thrown (the next run tries again), never turned into skips.
 */
export async function fetchMetrics(
  call: (metrics: string[]) => Promise<unknown>,
  metrics: readonly string[],
): Promise<MetricResult> {
  const result: MetricResult = { values: {}, skipped: {} };
  if (metrics.length === 0) return result;
  try {
    const values = parseInsights(await call([...metrics]));
    for (const m of metrics) {
      if (m in values) result.values[m] = values[m];
      else result.skipped[m] = "not returned";
    }
    return result;
  } catch (err) {
    if (!(err instanceof IgApiError) || err.kind === "network") throw err;
    if (metrics.length === 1) {
      result.skipped[metrics[0]] = err.message;
      return result;
    }
  }
  for (const m of metrics) {
    try {
      const v = parseInsights(await call([m]));
      if (m in v) result.values[m] = v[m];
      else result.skipped[m] = "not returned";
    } catch (err) {
      if (!(err instanceof IgApiError) || err.kind === "network") throw err;
      result.skipped[m] = err.message;
    }
  }
  return result;
}

export function getMediaInsights(deps: Pick<IgDeps, "fetch">, mediaId: string, token: string, metrics: readonly string[]): Promise<MetricResult> {
  return fetchMetrics((m) => get(deps, `/${mediaId}/insights`, { metric: m.join(",") }, token), metrics);
}

/** One day's totals (UTC day), as Meta's total_value for that day. */
export function getAccountDayTotals(deps: Pick<IgDeps, "fetch">, igUserId: string, token: string, metrics: readonly string[], day: string): Promise<MetricResult> {
  const since = Math.floor(Date.parse(`${day}T00:00:00Z`) / 1000);
  const until = since + 86_400;
  return fetchMetrics(
    (m) => get(deps, `/${igUserId}/insights`, { metric: m.join(","), period: "day", metric_type: "total_value", since: String(since), until: String(until) }, token),
    metrics,
  );
}
