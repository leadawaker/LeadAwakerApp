import type { DemoLang } from "@/features/campaigns/api/demoClientsApi";
import type { AiDisclosure, DemoMarket, DemoProspectDto } from "@shared/demoProspects";
import type { DemoSession } from "./api/demoSessionsApi";
import { serviceOf } from "./serviceOf";

// Pure: only `import type` from api files, so the row model loads in tests
// without the app's fetch layer.

export type LinkStatus = "never" | "opened" | "replied" | "expired";

/** Expired wins; then any reply; then opened on either surface; else never. */
export function linkStatus(s: DemoSession): LinkStatus {
  if (s.expired) return "expired";
  if (s.browser.replies + s.whatsapp.replies > 0) return "replied";
  if (s.browser.opened || s.whatsapp.opened) return "opened";
  return "never";
}

/** WhatsApp when its surface was opened, else the browser. */
export function linkChannel(s: DemoSession): "whatsapp" | "browser" {
  return s.whatsapp.opened ? "whatsapp" : "browser";
}

function time(iso: string | null | undefined): number {
  const t = iso ? Date.parse(iso) : NaN;
  return Number.isFinite(t) ? t : -Infinity;
}

function newer(a: string | null, b: string | null): string | null {
  return time(b) > time(a) ? b : a;
}

/** The newest of both surfaces' last message and first open, or null. */
export function lastActivity(s: DemoSession): string | null {
  return [s.browser.lastAt, s.browser.openedAt, s.whatsapp.lastAt, s.whatsapp.openedAt].reduce<string | null>(newer, null);
}

function newestFirst(a: DemoSession, b: DemoSession): number {
  const x = time(a.createdAt);
  const y = time(b.createdAt);
  return x === y ? 0 : y > x ? 1 : -1;
}

const LANGS: readonly DemoLang[] = ["en", "nl", "pt"];
const DISCLOSURES: readonly AiDisclosure[] = ["", "off", "opener", "second_message"];
const MARKETS: readonly DemoMarket[] = ["", "uk", "us", "nl"];

function oneOf<T extends string>(value: string, allowed: readonly T[], fallback: T): T {
  return (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

/**
 * One prospect on the Demos page: who they are, and the link they hold for
 * each service.
 *
 * The row's `key` doubles as the prospect group id used when minting a further
 * service from this row. For links minted before grouping existed there is no
 * group to join, so the key is derived from the token. It is deterministic, so
 * the new link's group matches the key this row is already computed under and
 * the two land in the same row on the next refetch.
 */
export interface ProspectRow {
  key: string;
  firstName: string;
  companyName: string;
  clientNiche: string;
  language: DemoLang;
  aiDisclosure: AiDisclosure;
  market: DemoMarket;
  notes: string;
  /** A Demo_Prospects record exists. False for legacy groups and lone tokens. */
  hasRecord: boolean;
  /** The prospect's homepage screenshot: the record's, else from whichever link
   *  in the row has one. Shown as the row's thumbnail, which is what makes a
   *  long list of demos scannable. */
  screenshot: string;
  websiteUrl: string;
  /** A landing-page website demo (specs/public-website-demo). */
  publicDemo: boolean;
  /** The newest link in the row ("when did I last send this prospect
   *  something"), else the prospect record's own creation time. */
  createdAt: string | null;
  /** Newest reply or first open over every link, history included. */
  lastActivityAt: string | null;
  /** Every token in the row, history included, so an edit reaches all of them. */
  tokens: string[];
  /** The newest non-revoked link per service. */
  byService: Record<string, DemoSession>;
  /** Non-revoked links with no column to sit in: an older duplicate of a
   *  service already filled, or a link on a campaign that is not one of the
   *  services. Kept rather than dropped, because a sent link must never vanish
   *  from this page. */
  extra: DemoSession[];
  /** Revoked links (re-minted or deleted ones), shown only in the detail panel. */
  history: DemoSession[];
  /** Over all links, history included. */
  replies: number;
  opened: boolean;
  /** Any non-revoked link. */
  hasLinks: boolean;
  /** Has links and every non-revoked link is expired. */
  expired: boolean;
}

function buildRow(key: string, record: DemoProspectDto | undefined, links: DemoSession[]): ProspectRow {
  const sorted = [...links].sort(newestFirst);
  const live = sorted.filter((s) => !s.revokedAt);
  const history = sorted.filter((s) => s.revokedAt);
  const ordered = [...live, ...history];

  const byService: Record<string, DemoSession> = {};
  const extra: DemoSession[] = [];
  for (const s of live) {
    const svc = serviceOf(s);
    // Newest wins the cell: a service minted twice shows the link sent last.
    if (svc && !byService[svc]) byService[svc] = s;
    else extra.push(s);
  }

  // Links in a row were minted from one form, so these agree. When they don't
  // (a rename that only reached some), the first non-empty value wins and the
  // row still renders something rather than an empty cell.
  const fromLinks = (pick: (s: DemoSession) => string | undefined): string => ordered.map(pick).find(Boolean) ?? "";

  return {
    key,
    firstName: record ? record.firstName : fromLinks((s) => s.firstName),
    companyName: record ? record.companyName : fromLinks((s) => s.companyName),
    clientNiche: record ? record.clientNiche : fromLinks((s) => s.clientNiche),
    language: oneOf(record ? record.language : fromLinks((s) => s.language), LANGS, "en"),
    aiDisclosure: oneOf(record ? record.aiDisclosure : fromLinks((s) => s.aiDisclosure), DISCLOSURES, ""),
    market: oneOf(record ? record.market : fromLinks((s) => s.market), MARKETS, ""),
    notes: record?.notes ?? "",
    hasRecord: !!record,
    screenshot: record?.screenshot || fromLinks((s) => s.screenshot),
    websiteUrl: record?.websiteUrl || fromLinks((s) => s.websiteUrl),
    publicDemo: ordered.some((s) => s.publicDemo),
    createdAt: sorted[0]?.createdAt ?? record?.createdAt ?? null,
    lastActivityAt: ordered.reduce<string | null>((acc, s) => newer(acc, lastActivity(s)), null),
    tokens: ordered.map((s) => s.token),
    byService,
    extra,
    history,
    replies: ordered.reduce((n, s) => n + s.browser.replies + s.whatsapp.replies, 0),
    opened: ordered.some((s) => s.browser.opened || s.whatsapp.opened),
    hasLinks: live.length > 0,
    expired: live.length > 0 && live.every((s) => s.expired),
  };
}

/**
 * The Demos page's rows: every prospect record (even with no links yet), plus
 * a row for each group or lone token that has links but no record.
 */
export function buildProspectRows(prospects: DemoProspectDto[], sessions: DemoSession[]): ProspectRow[] {
  const records = new Map<string, DemoProspectDto>();
  const linksByKey = new Map<string, DemoSession[]>();
  for (const p of prospects) {
    records.set(p.prospectGroup, p);
    linksByKey.set(p.prospectGroup, []);
  }
  for (const s of sessions) {
    const key = s.prospectGroup || `token:${s.token}`;
    const links = linksByKey.get(key);
    if (links) links.push(s);
    else linksByKey.set(key, [s]);
  }
  return Array.from(linksByKey, ([key, links]) => buildRow(key, records.get(key), links));
}

/** Rows from sessions alone. Kept until the last caller moves to buildProspectRows. */
export const groupProspects = (sessions: DemoSession[]): ProspectRow[] => buildProspectRows([], sessions);
