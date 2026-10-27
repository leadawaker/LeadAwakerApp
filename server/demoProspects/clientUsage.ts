/**
 * What a persona (a Niche_Vocabulary row) is used by, as pure functions over
 * lead rows. No db import: server/demo-clients.ts and the delete route load the
 * rows (loadDemoLeadsLite) and pass them in.
 */
import { isLinkExpired } from "@shared/demoTokenTtl";
import { parseDemoNiche } from "../demoNicheBlob";
import type { DemoLeadLite } from "../demoSessionsFold";

const str = (v: unknown) => (typeof v === "string" ? v : "");

interface TokenSides {
  wa?: DemoLeadLite;
  web?: DemoLeadLite;
}

const time = (d: Date | null) => (d ? new Date(d).getTime() : 0);

/**
 * How many live demo links run on each persona, keyed by the persona's niche.
 *
 * A link is one token with up to two lead rows (wa-demo: from the mint, web-demo:
 * from the first browser open). The persona is read from the newest row that
 * names one, since a panel switch rewrites the browser row's blob and the demo
 * is dressed as that persona from then on. The lifetime is the same call the
 * Demos page makes (see foldDemoLeads): the service comes from the mint row, a
 * lone browser row counts its first open as the mint, and either row's revoke
 * marker ends the link.
 */
export function liveTokensByClient(leads: DemoLeadLite[], now: number): Map<string, number> {
  const sides = new Map<string, TokenSides>();
  for (const lead of leads) {
    const ident = lead.channelIdentifier ?? "";
    const isWeb = ident.startsWith("web-demo:");
    if (!isWeb && !ident.startsWith("wa-demo:")) continue;
    const token = ident.slice(ident.indexOf(":") + 1);
    if (!token) continue;
    const side = sides.get(token) ?? {};
    side[isWeb ? "web" : "wa"] = lead;
    sides.set(token, side);
  }

  const counts = new Map<string, number>();
  for (const { wa, web } of sides.values()) {
    const rows = [wa, web].filter((r): r is DemoLeadLite => !!r).sort((a, b) => time(b.createdAt) - time(a.createdAt));
    let client = "";
    for (const row of rows) {
      client = str(parseDemoNiche(row.demoNiche).client_niche).trim();
      if (client) break;
    }
    if (!client) continue;
    const mint = wa ?? web;
    const expired = isLinkExpired(
      {
        service: str(parseDemoNiche(mint?.demoNiche).service),
        mintedAt: mint?.createdAt ?? null,
        openedAt: web?.createdAt ?? null,
        revokedAt: wa?.demoRevokedAt ?? web?.demoRevokedAt ?? null,
      },
      now,
    );
    if (!expired) counts.set(client, (counts.get(client) ?? 0) + 1);
  }
  return counts;
}

/** Where a persona came from: built from the business's own site, or written by hand or from a niche. */
export function clientSource(row: { websiteUrl: string | null }): "website" | "manual" {
  return (row.websiteUrl ?? "").trim() ? "website" : "manual";
}
