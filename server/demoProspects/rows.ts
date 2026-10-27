/**
 * Pure helpers for the Demos page's prospect rows (Demo_Prospects): which
 * tokens belong to a prospect group, what a legacy group's settings were
 * minted with, and how a stored row becomes the DTO the panel reads. No db
 * import, so tests can load it; the queries live in ./store.ts.
 */

import type { DemoProspectRow } from "@shared/schema";
import type {
  AiDisclosure,
  DemoMarket,
  DemoProspectDto,
  DemoProspectSettings,
  ProspectLang,
} from "@shared/demoProspects";
import { parseDemoNiche } from "../demoNicheBlob";
import type { DemoLeadLite } from "../demoSessionsFold";

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

const LANGS: readonly string[] = ["en", "nl", "pt"];
const DISCLOSURES: readonly string[] = ["off", "opener", "second_message"];
const MARKETS: readonly string[] = ["uk", "us", "nl"];

/** "nl", "NL" and "pt-BR" read as a prospect language; anything else is unset. */
function asLang(v: unknown): ProspectLang | null {
  const base = str(v).toLowerCase().split(/[-_]/)[0];
  return LANGS.includes(base) ? (base as ProspectLang) : null;
}
const asDisclosure = (v: unknown): AiDisclosure => (DISCLOSURES.includes(str(v)) ? (str(v) as AiDisclosure) : "");
const asMarket = (v: unknown): DemoMarket => (MARKETS.includes(str(v)) ? (str(v) as DemoMarket) : "");

/** The token behind a demo lead's channel identifier, "" for any other lead. */
export function tokenOf(channelIdentifier: string | null): string {
  const m = /^(?:wa|web)-demo:(.+)$/.exec(channelIdentifier ?? "");
  return m ? m[1] : "";
}

/**
 * The tokens that belong to a prospect group, once each, in first-seen order.
 *
 * A token's group is the one stamped in its blob: the mint (WhatsApp) row's
 * stamp when it has one, else the browser row's, the same precedence the Demos
 * page applies (demoSessionsFold.ts). A link minted before groups existed has
 * no stamp; the page keys it `token:<token>` (see prospectRows.ts), and only an
 * unstamped token answers to that key, so editing a legacy link never reaches a
 * grouped token of the same name.
 */
export function tokensInGroup(
  leads: { channelIdentifier: string | null; demoNiche: string | null }[],
  group: string,
): string[] {
  const stamps = new Map<string, { wa: string; web: string }>();
  for (const lead of leads) {
    const token = tokenOf(lead.channelIdentifier);
    if (!token) continue;
    const stamp = stamps.get(token) ?? { wa: "", web: "" };
    const own = str(parseDemoNiche(lead.demoNiche).prospect_group);
    if ((lead.channelIdentifier ?? "").startsWith("wa-demo:")) stamp.wa = own;
    else stamp.web = own;
    stamps.set(token, stamp);
  }
  return Array.from(stamps)
    .filter(([token, s]) => (s.wa || s.web || `token:${token}`) === group)
    .map(([token]) => token);
}

/**
 * The settings of a legacy group that has no Demo_Prospects row yet, read back
 * from the links it already holds: the first non-empty value of each field,
 * browser rows first (the surface the presenter panel steers), the same rule
 * prospectRows.ts applies when it groups the page.
 */
export function settingsFromLeads(
  leads: {
    channelIdentifier: string | null;
    firstName: string | null;
    language: string | null;
    demoNiche: string | null;
  }[],
): DemoProspectSettings {
  const isWeb = (l: { channelIdentifier: string | null }) => (l.channelIdentifier ?? "").startsWith("web-demo:");
  const ordered = [...leads.filter(isWeb), ...leads.filter((l) => !isWeb(l))];

  const out = {
    firstName: "",
    companyName: "",
    clientNiche: "",
    language: null as ProspectLang | null,
    aiDisclosure: "" as AiDisclosure,
    market: "" as DemoMarket,
  };
  for (const lead of ordered) {
    const niche = parseDemoNiche(lead.demoNiche);
    out.firstName = out.firstName || str(lead.firstName);
    out.companyName = out.companyName || str(niche.company_name);
    out.clientNiche = out.clientNiche || str(niche.client_niche);
    out.language = out.language ?? asLang(lead.language);
    out.aiDisclosure = out.aiDisclosure || asDisclosure(niche.ai_disclosure);
    out.market = out.market || asMarket(niche.market);
  }
  return { ...out, language: out.language ?? "en" };
}

/** Trim the strings, and drop a market that does not apply (EN only). */
export function normalizeSettings(s: DemoProspectSettings): DemoProspectSettings {
  return {
    firstName: s.firstName.trim(),
    companyName: s.companyName.trim(),
    clientNiche: s.clientNiche.trim(),
    language: s.language,
    aiDisclosure: s.aiDisclosure,
    market: s.language === "en" ? s.market : "",
  };
}

/**
 * A stored row as the panel reads it. The website falls back to the Client's
 * (the row's own wins, since the prospect's site is what the panel shows); the
 * screenshot is always the Client's.
 */
export function prospectDto(
  row: DemoProspectRow,
  client: { screenshotPath: string | null; websiteUrl: string | null } | null,
): DemoProspectDto {
  const iso = (d: Date | null) => (d ? d.toISOString() : null);
  return {
    prospectGroup: row.prospectGroup,
    firstName: row.firstName,
    companyName: row.companyName,
    clientNiche: row.clientNiche,
    language: asLang(row.language) ?? "en",
    aiDisclosure: asDisclosure(row.aiDisclosure),
    market: asMarket(row.market),
    notes: row.notes,
    websiteUrl: row.websiteUrl || client?.websiteUrl || "",
    screenshot: client?.screenshotPath || "",
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}

const isWebRow = (l: DemoLeadLite) => (l.channelIdentifier ?? "").startsWith("web-demo:");
const hasBlob = (l: DemoLeadLite) => Object.keys(parseDemoNiche(l.demoNiche)).length > 0;
const timeOf = (l: DemoLeadLite) => l.createdAt?.getTime() ?? 0;

/** What a replacement link is minted from, read off the old token's rows. */
export interface RemintSource {
  firstName: string;
  language: string;
  campaignId: number;
  demoNiche: string;
  invited: boolean;
  source: string;
}

/**
 * What to mint a replacement link from, given the rows of one token.
 *
 * The persona (and so the name and language) comes from the newest row that
 * carries one, the browser row first: that is the surface the panel steers, so
 * its blob is what the demo currently is. The campaign, the invited flag and
 * the source come from the WhatsApp (mint) row, else the browser row. A browser
 * row's own source is "Web Demo", which describes the surface, not the mint, so
 * a mint row built from an orphan browser row is a plain "WhatsApp Demo".
 * Null when no row has a campaign: nothing to mint into.
 */
export function remintSource(rows: DemoLeadLite[]): RemintSource | null {
  const wa = rows.find((l) => !isWebRow(l) && l.campaignsId != null);
  const base = wa ?? rows.find((l) => isWebRow(l) && l.campaignsId != null);
  if (!base || base.campaignsId == null) return null;

  const persona = rows
    .filter(hasBlob)
    .sort((a, b) => Number(isWebRow(b)) - Number(isWebRow(a)) || timeOf(b) - timeOf(a))[0];
  const named = (pick: (l: DemoLeadLite) => string | null) =>
    [persona, wa, ...rows].map((l) => (l ? str(pick(l)) : "")).find(Boolean) ?? "";

  return {
    firstName: named((l) => l.firstName),
    language: named((l) => l.language) || "en",
    campaignId: base.campaignsId,
    demoNiche: persona?.demoNiche ?? "",
    invited: !!base.demoInvited,
    source: (wa && str(wa.source)) || "WhatsApp Demo",
  };
}
