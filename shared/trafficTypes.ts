// Response shapes for the Owner-only Traffic page (/platform/traffic):
// Google Search Console numbers, index status, and the site's own visit counter.

export const TRAFFIC_PERIODS = [7, 28, 90] as const;
export type TrafficDays = (typeof TRAFFIC_PERIODS)[number];

// ─── Google Search (Search Console) ───────────────────────────────────────

export interface SearchTotals {
  clicks: number;
  impressions: number;
  /** Impression-weighted average position, null when there were no impressions. */
  position: number | null;
}

export interface SearchRow {
  clicks: number;
  impressions: number;
  position: number | null;
}

export interface SearchData {
  /** Google's days (Pacific time), YYYY-MM-DD. The end is about two days back. */
  range: { start: string; end: string };
  totals: SearchTotals;
  previous: SearchTotals;
  daily: { date: string; clicks: number; impressions: number }[];
  queries: (SearchRow & { query: string })[];
  pages: (SearchRow & { path: string; lang: "en" | "nl" | "pt" })[];
  /** ISO 3166-1 alpha-3, lowercase, as Search Console returns it. */
  countries: (SearchRow & { country: string })[];
  /** Hostnames other than the public site that Google is showing (app., api., cal.). */
  otherHosts: { host: string; clicks: number; impressions: number; pages: number }[];
  fetchedAt: string;
}

/** Why Search Console could not be read: no Google login on the server, a login
 *  without Search Console access, or anything else (Google down, quota). */
export type SearchUnavailable = "no_credentials" | "no_access" | "error";

export type SearchResponse =
  | ({ connected: true } & SearchData)
  | { connected: false; reason: SearchUnavailable };

// ─── Index status ─────────────────────────────────────────────────────────

/** Google's coverage states folded into the ones the page explains. */
export type IndexReason =
  | "indexed"
  | "unknown"       // Google has never seen the URL
  | "discovered"    // known, not crawled yet
  | "crawled"       // crawled, left out of the index
  | "redirect"
  | "noindex"
  | "duplicate"
  | "not_found"
  | "blocked"
  | "other";

export interface IndexRow {
  url: string;
  path: string;
  indexed: boolean;
  reason: IndexReason;
  /** Google's own wording, shown as is when `reason` is "other". */
  coverage: string;
  lastCrawl: string | null;
  /** Link to this URL's inspection in Search Console. */
  link: string | null;
}

export interface SitemapStatus {
  url: string;
  lastSubmitted: string | null;
  lastDownloaded: string | null;
  pending: boolean;
  errors: number;
  warnings: number;
}

export type IndexResponse =
  | { connected: true; rows: IndexRow[]; sitemap: SitemapStatus | null; fetchedAt: string }
  | { connected: false; reason: SearchUnavailable };

// ─── The site's own visit counter ─────────────────────────────────────────

export type TrafficChannel = "ai" | "search" | "social" | "email" | "referral" | "campaign" | "direct";

export interface VisitTotals {
  /** Arrivals: page views that did not come from another page of the site. */
  visits: number;
  views: number;
  /** Visits sent by an AI assistant (ChatGPT, Perplexity, Claude, ...). */
  ai: number;
}

export interface VisitsResponse {
  days: TrafficDays;
  /** When the first visit was ever recorded; null = the counter has seen nothing yet. */
  since: string | null;
  totals: VisitTotals;
  previous: VisitTotals;
  /** One entry per day (Europe/Amsterdam), oldest first, zero-filled. */
  daily: { date: string; visits: number; views: number }[];
  /** `label` is a brand or hostname; null for the "direct" channel. */
  sources: { channel: TrafficChannel; label: string | null; visits: number }[];
  pages: { path: string; views: number; visits: number }[];
  languages: { key: string; visits: number }[];
  devices: { key: string; visits: number }[];
  timezones: { key: string; visits: number }[];
}
