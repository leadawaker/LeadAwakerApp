/**
 * Which saved personas are unused home-improvement demos that the persona prune
 * script may delete (Builder decision 18). Pure: script/demo-personas-prune.ts
 * loads the rows and passes them in, so the rules are tested without a database.
 */
import { parseDemoNiche } from "../demoNicheBlob";
import type { DemoLeadLite } from "../demoSessionsFold";

/** The categories the old home-improvement demo personas were filed under. */
export const HOME_IMPROVEMENT_CATEGORIES = [
  "Home & Trades",
  "Kitchens & Interiors",
  "Home Services",
  "Climate & Energy",
  "Marcenaria & Móveis",
] as const;

export interface PruneCandidateInput {
  niche: string;
  label: string;
  category: string | null;
  isDemoClient: boolean;
  isLive: boolean;
  websiteUrl: string | null;
}

/**
 * Personas safe to delete: a demo persona (not a curated pack, not a live voice
 * client) in a home-improvement category that was never built from a website,
 * has no live link, and is not the persona of any Demo_Prospects row. Input
 * order is kept. `tokensEver` is how many links were ever minted on it, for
 * the dry run's list.
 *
 * @param liveTokens    live links per persona niche (liveTokensByClient)
 * @param prospectClients niches that a Demo_Prospects row points at
 * @param everTokens    links ever minted per persona niche (tokensEverByClient)
 */
export function selectPrunablePersonas(
  clients: PruneCandidateInput[],
  liveTokens: Map<string, number>,
  prospectClients: Set<string>,
  everTokens: Map<string, number>,
): { niche: string; label: string; category: string; tokensEver: number }[] {
  const categories: readonly string[] = HOME_IMPROVEMENT_CATEGORIES;
  const out: { niche: string; label: string; category: string; tokensEver: number }[] = [];
  for (const c of clients) {
    const category = (c.category ?? "").trim();
    if (!c.isDemoClient || c.isLive) continue;
    if ((c.websiteUrl ?? "").trim()) continue;
    if (!categories.includes(category)) continue;
    if ((liveTokens.get(c.niche) ?? 0) > 0) continue;
    if (prospectClients.has(c.niche)) continue;
    out.push({ niche: c.niche, label: c.label, category, tokensEver: everTokens.get(c.niche) ?? 0 });
  }
  return out;
}

const time = (d: Date | null) => (d ? new Date(d).getTime() : 0);

/**
 * Links ever minted per persona niche, expired and revoked ones included. A
 * link is one token with up to two lead rows; its persona is the newest row
 * that names one, as liveTokensByClient reads it.
 */
export function tokensEverByClient(leads: DemoLeadLite[]): Map<string, number> {
  const rowsByToken = new Map<string, DemoLeadLite[]>();
  for (const lead of leads) {
    const ident = lead.channelIdentifier ?? "";
    if (!ident.startsWith("wa-demo:") && !ident.startsWith("web-demo:")) continue;
    const token = ident.slice(ident.indexOf(":") + 1);
    if (!token) continue;
    const rows = rowsByToken.get(token) ?? [];
    rows.push(lead);
    rowsByToken.set(token, rows);
  }

  const counts = new Map<string, number>();
  for (const rows of rowsByToken.values()) {
    rows.sort((a, b) => time(b.createdAt) - time(a.createdAt));
    for (const row of rows) {
      const raw = parseDemoNiche(row.demoNiche).client_niche;
      const client = typeof raw === "string" ? raw.trim() : "";
      if (client) {
        counts.set(client, (counts.get(client) ?? 0) + 1);
        break;
      }
    }
  }
  return counts;
}
