/**
 * The Demos page's index, as a pure fold over lead rows.
 *
 * Split from demoSessionsList.ts (which owns the database query) so tests can
 * import this without loading ./db. Nothing here reads the clock or builds a
 * link on its own: the caller passes `now` and `linksFor`.
 */

import { PUBLIC_DEMO_SOURCE, isLinkExpired } from "@shared/demoTokenTtl";
import { parseDemoNiche, resolveDemoScenario } from "./demoNicheBlob";

/** One row on the Demos page: a token, with both of its surfaces. */
export type DemoSessionRow = {
  token: string;
  /** Both links, built by the caller rather than reassembled in the page. The
   *  WhatsApp one carries the demo number, which lives in demo-session.ts and
   *  deliberately nowhere else: a second copy drifts, and the failure mode is
   *  a prospect tapping through to a dead number. */
  demoUrl: string;
  whatsappUrl: string;
  firstName: string;
  language: string;
  companyName: string;
  clientNiche: string;
  /** "inquired" (no quote) or "deciding" (quote), from the browser lead if it
   *  exists, since that is the surface the panel steers. */
  scenario: string;
  /** Which offered service this link demos ("dbr", "voice", ...), and which
   *  prospect's set of links it belongs to. Both are stamped at mint time and
   *  never edited afterwards, so they come from the wa-demo lead (the row
   *  minting created). Empty on links minted before the Demos page grouped by
   *  prospect; those stand alone, which is what the page renders them as. */
  service: string;
  prospectGroup: string;
  /** The AI disclosure override ("off", "opener", "second_message"), "" for the
   *  campaign default. The browser row wins, since that is the surface the
   *  panel steers. */
  aiDisclosure: string;
  /** The EN market ("uk", "us", "nl"), "" for the language default. Browser
   *  row wins. */
  market: string;
  invited: boolean;
  /** Minted by a visitor on the landing page's website demo
   *  (specs/public-website-demo), not by Gabriel. */
  publicDemo: boolean;
  campaignId: number | null;
  createdAt: Date | null;
  /** When the link was revoked (re-minted or deleted), from either row. */
  revokedAt: Date | null;
  /** Revoked, or past its lifetime (see shared/demoTokenTtl.ts). */
  expired: boolean;
  /** The prospect's homepage screenshot (specs/website-widget), when this demo
   *  was built from a website URL. A file name served by /api/site-shot/:file;
   *  empty for every demo minted from a typed persona. */
  screenshot: string;
  /** The site that screenshot came from, shown under the row. */
  websiteUrl: string;
  /** The prospect's phone when either lead has one (a WhatsApp demo, a
   *  verified website demo), to prefill the demo phone call. Empty otherwise. */
  phone: string;
  /** Per surface. `opened` is whether the lead row exists at all: the browser
   *  row is created on first visit, so its absence means the link was never
   *  clicked, which is the single most useful thing this page reports. */
  browser: DemoSurfaceRow;
  whatsapp: DemoSurfaceRow;
};

export type DemoSurfaceRow = {
  opened: boolean;
  /** WHEN the prospect first opened it. The engine creates this lead row on
   *  first visit and never before, so its createdAt is the click itself, not an
   *  approximation of it. Null when the link was never opened. */
  openedAt: Date | null;
  replies: number;
  /** Their most recent inbound message, so a stalled demo is distinguishable
   *  from a live one. */
  lastAt: Date | null;
  status: string;
};

/** The columns of a demo lead that the fold reads. */
export interface DemoLeadLite {
  id: number;
  channelIdentifier: string | null;
  firstName: string | null;
  language: string | null;
  demoNiche: string | null;
  demoInvited: boolean | null;
  source: string | null;
  phone: string | null;
  campaignsId: number | null;
  createdAt: Date | null;
  conversionStatus: string | null;
  demoRevokedAt: Date | null;
}

export type ReplyCounts = Map<number, { n: number; first: Date | null; last: Date | null }>;

const str = (v: unknown) => (typeof v === "string" ? v : "");

/** The two lead rows behind one token, with their parsed blobs. */
type TokenRows = {
  wa?: { lead: DemoLeadLite; niche: Record<string, unknown> };
  web?: { lead: DemoLeadLite; niche: Record<string, unknown> };
};

/**
 * Every demo link, newest first, one row per token.
 *
 * Both surfaces are folded into one row because they are one link: minting
 * writes the `wa-demo:` lead immediately and the engine adds the `web-demo:`
 * one on first open, so listing the raw leads would show every demo twice and
 * make "did they open it?" impossible to read.
 */
export function foldDemoLeads(
  rows: DemoLeadLite[],
  replies: ReplyCounts,
  opts: { now: number; linksFor: (token: string) => { demoUrl: string; whatsappUrl: string } },
): DemoSessionRow[] {
  const byToken = new Map<string, DemoSessionRow>();
  const sides = new Map<string, TokenRows>();
  for (const lead of rows) {
    const ident = String(lead.channelIdentifier || "");
    const isWeb = ident.startsWith("web-demo:");
    const token = ident.slice(ident.indexOf(":") + 1);
    if (!token) continue;
    // A landing-page website demo nobody verified yet is a form submission,
    // not a demo: leave it out until a phone has claimed it.
    const isPublic = lead.source === PUBLIC_DEMO_SOURCE;
    if (isPublic && !lead.phone) continue;

    const niche = parseDemoNiche(lead.demoNiche);
    const counts = replies.get(lead.id as number) || { n: 0, first: null, last: null };

    // "Opened" means something different on each surface, and conflating them
    // makes the column useless. The BROWSER lead is created by the engine on
    // first visit, so the row existing IS the open. The WHATSAPP lead is
    // created at MINT time by createPendingDemoLead, so its existence says
    // only that the link was made, and reporting that as an open marked every
    // link ever minted as opened. There, the open is the prospect's first
    // inbound message, which is exactly what pressing send on a wa.me link
    // produces.
    const surface: DemoSurfaceRow = isWeb
      ? {
          opened: true,
          openedAt: (lead.createdAt as Date) ?? null,
          replies: counts.n,
          lastAt: counts.last,
          status: String(lead.conversionStatus || ""),
        }
      : {
          opened: counts.n > 0,
          openedAt: counts.first,
          replies: counts.n,
          lastAt: counts.last,
          status: String(lead.conversionStatus || ""),
        };

    const side = sides.get(token) ?? {};
    side[isWeb ? "web" : "wa"] = { lead, niche };
    sides.set(token, side);

    let row = byToken.get(token);
    if (!row) {
      row = {
        token,
        ...opts.linksFor(token),
        firstName: lead.firstName || "",
        language: (lead.language || "en").toLowerCase(),
        companyName: str(niche.company_name),
        clientNiche: str(niche.client_niche),
        scenario: "inquired",
        service: str(niche.service),
        prospectGroup: str(niche.prospect_group),
        aiDisclosure: "",
        market: "",
        invited: !!lead.demoInvited,
        publicDemo: isPublic,
        campaignId: lead.campaignsId ?? null,
        createdAt: (lead.createdAt as Date) ?? null,
        revokedAt: null,
        expired: false,
        screenshot: str(niche.screenshot),
        websiteUrl: str(niche.website_url),
        phone: "",
        browser: { opened: false, openedAt: null, replies: 0, lastAt: null, status: "" },
        whatsapp: { opened: false, openedAt: null, replies: 0, lastAt: null, status: "" },
      };
      byToken.set(token, row);
    }

    if (!row.phone && lead.phone) row.phone = String(lead.phone);

    if (isWeb) {
      row.browser = surface;
      // The browser lead is the one the presenter panel steers, so its persona
      // is the authority on what the demo currently IS. The wa-demo row keeps
      // whatever it was minted with and would report a stale company after a
      // panel edit.
      if (str(niche.company_name)) row.companyName = str(niche.company_name);
      if (str(niche.client_niche)) row.clientNiche = str(niche.client_niche);
      if (!row.screenshot && str(niche.screenshot)) row.screenshot = str(niche.screenshot);
      if (!row.websiteUrl && str(niche.website_url)) row.websiteUrl = str(niche.website_url);
      row.scenario = resolveDemoScenario(niche);
    } else {
      row.whatsapp = surface;
      // Minting creates this row, so it owns the fields the link was born with.
      row.invited = !!lead.demoInvited;
      if (str(niche.service)) row.service = str(niche.service);
      if (str(niche.prospect_group)) row.prospectGroup = str(niche.prospect_group);
      row.createdAt = (lead.createdAt as Date) ?? row.createdAt;
      if (!row.firstName) row.firstName = lead.firstName || "";
      if (!row.companyName) row.companyName = str(niche.company_name);
      if (!row.clientNiche) row.clientNiche = str(niche.client_niche);
      // Stamped at mint time from the Client row, so the wa-demo lead is the
      // authority; the browser row only fills it in when minting predated this.
      if (str(niche.screenshot)) row.screenshot = str(niche.screenshot);
      if (str(niche.website_url)) row.websiteUrl = str(niche.website_url);
    }
  }

  // Fields that need both rows at once, settled after the fold so the result
  // does not depend on which row the query returned first.
  for (const [token, row] of byToken) {
    const { wa, web } = sides.get(token) ?? {};
    // The browser row steers the demo, so its value wins when it has one.
    row.aiDisclosure = str(web?.niche.ai_disclosure) || str(wa?.niche.ai_disclosure);
    row.market = str(web?.niche.market) || str(wa?.niche.market);
    row.revokedAt = wa?.lead.demoRevokedAt ?? web?.lead.demoRevokedAt ?? null;
    row.expired = isLinkExpired(
      {
        // Stamped on the wa-demo row at mint; "" (untagged, older links) reads
        // as a 7 day chat link. A lone browser row has no mint row to ask.
        service: str((wa ?? web)?.niche.service),
        // A lone browser row counts its first open as the mint, which is what
        // the engine's "oldest row" reading does.
        mintedAt: (wa ?? web)?.lead.createdAt ?? null,
        openedAt: web?.lead.createdAt ?? null,
        revokedAt: row.revokedAt,
      },
      opts.now,
    );
  }

  return Array.from(byToken.values()).sort(
    (a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0),
  );
}
