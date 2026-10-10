// Reads Google Search Console for the Owner-only Traffic page (/platform/traffic).
//
// Auth is the Google login stored on this machine by
// `gcloud auth application-default login` (it must include the Search Console
// scope). That is Gabriel's own Google login, not a service account, so a new
// login without the scope, or a revoked one, turns the page's Google half off;
// the routes answer `connected: false` and the page says how to fix it.
//
// Google's numbers run about two days behind and change slowly, so results are
// kept in memory for a few hours.
import { readFile } from "node:fs/promises";
import path from "node:path";
import { google } from "googleapis";
import type {
  IndexReason, IndexResponse, IndexRow, SearchData, SearchResponse, SearchRow, SearchTotals, SearchUnavailable,
  SitemapStatus, TrafficDays,
} from "@shared/trafficTypes";

const PROPERTY = "sc-domain:leadawaker.com";
const SITE_ORIGIN = "https://www.leadawaker.com";
const SITEMAP_URL = `${SITE_ORIGIN}/sitemap.xml`;
// The public site, with or without "www". Everything else on the domain
// (app., api., cal.) is not meant to be in Google and is reported separately.
const SITE_PAGE_RE = "^https?://(www\\.)?leadawaker\\.com/";
const API = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(PROPERTY)}`;
const INSPECT_URL = "https://searchconsole.googleapis.com/v1/urlInspection/index:inspect";

const SEARCH_TTL_MS = 3 * 60 * 60 * 1000;
const INDEX_TTL_MS = 12 * 60 * 60 * 1000;
// One inspection takes Google about 7 seconds, so they run a few at a time.
const INSPECT_CONCURRENCY = 4;

const auth = new google.auth.GoogleAuth({ scopes: ["https://www.googleapis.com/auth/webmasters.readonly"] });

async function call<T>(url: string, body?: unknown): Promise<T> {
  const client = await auth.getClient();
  const res = await client.request<T>({ url, method: body ? "POST" : "GET", data: body, timeout: 45_000 });
  return res.data;
}

function unavailable(err: unknown): SearchUnavailable {
  const e = err as { message?: string; status?: number; response?: { status?: number } };
  const status = e?.status ?? e?.response?.status;
  const message = String(e?.message || "");
  if (/could not load the default credentials/i.test(message)) return "no_credentials";
  if (status === 401 || status === 403 || /invalid_grant|insufficient/i.test(message)) return "no_access";
  return "error";
}

// ─── cache ────────────────────────────────────────────────────────────────
// The promise is cached, not the value, so two requests arriving together
// share one round of Google calls. A failure is not kept.
const cache = new Map<string, { at: number; value: Promise<unknown> }>();

function cached<T>(key: string, ttlMs: number, fresh: boolean, load: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && !fresh && Date.now() - hit.at < ttlMs) return hit.value as Promise<T>;
  const value = load();
  cache.set(key, { at: Date.now(), value });
  value.catch(() => { if (cache.get(key)?.value === value) cache.delete(key); });
  return value;
}

// ─── dates ────────────────────────────────────────────────────────────────
// Search Console days are Pacific-time days, written YYYY-MM-DD.

function addDays(day: string, n: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function latestCompleteDay(): string {
  const pacificToday = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles" }).format(new Date());
  return addDays(pacificToday, -2);
}

// ─── search analytics ─────────────────────────────────────────────────────

interface ApiRow { keys: string[]; clicks: number; impressions: number; position: number }

function query(start: string, end: string, dimension: string, rowLimit: number, onSite = true): Promise<ApiRow[]> {
  return call<{ rows?: ApiRow[] }>(`${API}/searchAnalytics/query`, {
    startDate: start,
    endDate: end,
    dimensions: [dimension],
    rowLimit,
    dimensionFilterGroups: [{
      filters: [{ dimension: "page", operator: onSite ? "includingRegex" : "excludingRegex", expression: SITE_PAGE_RE }],
    }],
  }).then((data) => data.rows ?? []);
}

/** Sums rows; the position is weighted by impressions, as Search Console does. */
function total(rows: SearchRow[]): SearchTotals {
  let clicks = 0;
  let impressions = 0;
  let weighted = 0;
  for (const r of rows) {
    clicks += r.clicks;
    impressions += r.impressions;
    weighted += (r.position ?? 0) * r.impressions;
  }
  return { clicks, impressions, position: impressions > 0 ? weighted / impressions : null };
}

const toRow = (r: ApiRow): SearchRow => ({ clicks: r.clicks, impressions: r.impressions, position: r.impressions > 0 ? r.position : null });

/** Most clicked first; with so many zero-click rows, most shown breaks the tie. */
const byClicks = (a: SearchRow, b: SearchRow) => b.clicks - a.clicks || b.impressions - a.impressions;

function pageLang(pathname: string): "en" | "nl" | "pt" {
  if (pathname === "/nl" || pathname.startsWith("/nl/")) return "nl";
  if (pathname === "/pt" || pathname.startsWith("/pt/")) return "pt";
  return "en";
}

async function loadSearch(days: TrafficDays): Promise<SearchData> {
  const end = latestCompleteDay();
  const start = addDays(end, -(days - 1));
  const previousStart = addDays(start, -days);

  const [byDate, byQuery, byPage, byCountry, offSite] = await Promise.all([
    query(previousStart, end, "date", days * 2),
    query(start, end, "query", 25),
    query(start, end, "page", 100),
    query(start, end, "country", 10),
    query(start, end, "page", 200, false),
  ]);

  const perDay = new Map(byDate.map((r) => [r.keys[0], r]));
  const daily = Array.from({ length: days }, (_, i) => {
    const date = addDays(start, i);
    const r = perDay.get(date);
    return { date, clicks: r?.clicks ?? 0, impressions: r?.impressions ?? 0 };
  });

  // "/nl" and "/nl/" are the same page to a reader; Google lists both.
  const pages = new Map<string, SearchRow[]>();
  for (const r of byPage) {
    let pathname = "/";
    try { pathname = new URL(r.keys[0]).pathname.replace(/(.)\/+$/, "$1"); } catch { continue; }
    pages.set(pathname, [...(pages.get(pathname) ?? []), toRow(r)]);
  }

  const hosts = new Map<string, { host: string; clicks: number; impressions: number; pages: number }>();
  for (const r of offSite) {
    let host = "";
    try { host = new URL(r.keys[0]).hostname; } catch { continue; }
    const h = hosts.get(host) ?? { host, clicks: 0, impressions: 0, pages: 0 };
    h.clicks += r.clicks;
    h.impressions += r.impressions;
    h.pages += 1;
    hosts.set(host, h);
  }

  return {
    range: { start, end },
    totals: total(byDate.filter((r) => r.keys[0] >= start).map(toRow)),
    previous: total(byDate.filter((r) => r.keys[0] < start).map(toRow)),
    daily,
    queries: byQuery.map((r) => ({ query: r.keys[0], ...toRow(r) })).sort(byClicks),
    pages: [...pages.entries()]
      .map(([pathname, rows]) => ({ path: pathname, lang: pageLang(pathname), ...total(rows) }))
      .sort(byClicks)
      .slice(0, 25),
    countries: byCountry.map((r) => ({ country: r.keys[0], ...toRow(r) })).sort(byClicks),
    otherHosts: [...hosts.values()].sort((a, b) => b.impressions - a.impressions),
    fetchedAt: new Date().toISOString(),
  };
}

export async function getSearchOverview(days: TrafficDays, fresh = false): Promise<SearchResponse> {
  try {
    return { connected: true, ...(await cached(`search:${days}`, SEARCH_TTL_MS, fresh, () => loadSearch(days))) };
  } catch (err) {
    console.error("[traffic] Search Console read failed:", err instanceof Error ? err.message : err);
    return { connected: false, reason: unavailable(err) };
  }
}

// ─── index status ─────────────────────────────────────────────────────────

/** The pages we ask Google to index: the <loc> entries of the site's sitemap. */
async function sitemapUrls(): Promise<string[]> {
  let xml: string;
  try {
    xml = await readFile(path.resolve("client/public/sitemap.xml"), "utf-8");
  } catch {
    xml = await (await fetch(SITEMAP_URL, { signal: AbortSignal.timeout(10_000) })).text();
  }
  return [...new Set([...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => m[1]))];
}

function indexReason(verdict: string, coverage: string): IndexReason {
  const c = coverage.toLowerCase();
  if (verdict === "PASS") return "indexed";
  if (c.includes("unknown to google")) return "unknown";
  if (c.includes("discovered")) return "discovered";
  if (c.includes("crawled")) return "crawled";
  if (c.includes("redirect")) return "redirect";
  if (c.includes("noindex")) return "noindex";
  if (c.includes("duplicate") || c.includes("canonical")) return "duplicate";
  if (c.includes("404") || c.includes("not found")) return "not_found";
  if (c.includes("robots.txt")) return "blocked";
  return "other";
}

interface Inspection {
  inspectionResult?: {
    inspectionResultLink?: string;
    indexStatusResult?: { verdict?: string; coverageState?: string; lastCrawlTime?: string };
  };
}

async function inspect(url: string): Promise<IndexRow> {
  const pathname = new URL(url).pathname;
  try {
    const data = await call<Inspection>(INSPECT_URL, { inspectionUrl: url, siteUrl: PROPERTY });
    const status = data.inspectionResult?.indexStatusResult ?? {};
    const coverage = status.coverageState ?? "";
    const reason = indexReason(status.verdict ?? "", coverage);
    return {
      url, path: pathname, indexed: reason === "indexed", reason, coverage,
      lastCrawl: status.lastCrawlTime ?? null,
      link: data.inspectionResult?.inspectionResultLink ?? null,
    };
  } catch (err) {
    // A login problem fails every page the same way: let the caller report it once.
    if (unavailable(err) !== "error") throw err;
    return { url, path: pathname, indexed: false, reason: "other", coverage: "", lastCrawl: null, link: null };
  }
}

async function loadIndex(): Promise<{ rows: IndexRow[]; sitemap: SitemapStatus | null; fetchedAt: string }> {
  const urls = await sitemapUrls();
  const rows: IndexRow[] = new Array(urls.length);
  let next = 0;
  const worker = async () => {
    while (next < urls.length) {
      const i = next++;
      rows[i] = await inspect(urls[i]);
    }
  };
  const [sitemaps] = await Promise.all([
    call<{ sitemap?: any[] }>(`${API}/sitemaps`),
    ...Array.from({ length: Math.min(INSPECT_CONCURRENCY, urls.length) }, worker),
  ]);

  const entry = (sitemaps.sitemap ?? []).find((s) => s.path === SITEMAP_URL) ?? null;
  return {
    rows,
    sitemap: entry && {
      url: entry.path,
      lastSubmitted: entry.lastSubmitted ?? null,
      lastDownloaded: entry.lastDownloaded ?? null,
      pending: Boolean(entry.isPending),
      errors: Number(entry.errors ?? 0),
      warnings: Number(entry.warnings ?? 0),
    },
    fetchedAt: new Date().toISOString(),
  };
}

export async function getIndexStatus(fresh = false): Promise<IndexResponse> {
  try {
    return { connected: true, ...(await cached("index", INDEX_TTL_MS, fresh, loadIndex)) };
  } catch (err) {
    console.error("[traffic] Search Console index check failed:", err instanceof Error ? err.message : err);
    return { connected: false, reason: unavailable(err) };
  }
}
