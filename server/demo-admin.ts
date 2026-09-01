/**
 * The Demos page and the presenter panel's read/write of a running demo.
 *
 * Split out of demo-session.ts (which owns niche/persona GENERATION) because
 * this half is a different concern: listing and editing sessions that already
 * exist. Keeping them in one file was making demo-session.ts the wrong place
 * to look for either job.
 */

import { db } from "./db";
import { leads, interactions } from "@shared/schema";
import { eq, and, or, like, desc, inArray, count, max, min } from "drizzle-orm";
import { buildDemoPageLink, buildWhatsAppLink } from "./demo-session";

/**
 * The BROWSER demo's lead row for a token.
 *
 * Every token has two independent leads: `web-demo:<token>` for the page and
 * `wa-demo:<token>` for WhatsApp (see specs/demo-surface-split). The presenter
 * panel edits the browser one only, which is what makes it structurally
 * incapable of disturbing a WhatsApp demo. Reaching for the wrong prefix here
 * would edit the other surface and leave the page unchanged, a failure that
 * looks exactly like the write silently not happening.
 *
 * Undefined when the page has never been opened: the engine creates this row on
 * first visit, so callers 404 rather than creating it themselves.
 */
async function findWebDemoLead(token: string) {
  const [row] = await db
    .select()
    .from(leads)
    .where(eq(leads.channelIdentifier, `web-demo:${token}`))
    .limit(1);
  return row;
}

/**
 * Parse a lead's demo_niche blob defensively. A blob written by a fallback
 * mint, or hand-edited, must not take a reader down with it: an unparseable
 * persona reads as "nothing set" everywhere this is called.
 */
function parseDemoNiche(raw: string | null | undefined): Record<string, unknown> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

/**
 * The quote/no-quote axis, read from lead_stage rather than a `scenario` key,
 * because a scenario restart never writes one: restart_demo patches
 * what_lead_did and lead_stage (demo_restart.py:253), so a reader keying off
 * `scenario` would keep reporting the value the link was minted with while the
 * conversation had already switched underneath it.
 *
 * Two vocabularies land in this field and both must be accepted:
 * demoClientToContext writes the CRM's "inquired"/"deciding", the engine's
 * restart writes its own "inquired"/"quoted". Everything that is not the
 * quoted half means no quote.
 */
function resolveDemoScenario(niche: Record<string, unknown>): "inquired" | "deciding" {
  const str = (v: unknown) => (typeof v === "string" ? v : "");
  return ["quoted", "deciding", "decision"].includes(
    (str(niche.lead_stage) || str(niche.scenario)).toLowerCase(),
  )
    ? "deciding"
    : "inquired";
}

/** What the presenter panel opens showing. */
export type DemoLeadConfig = {
  firstName: string;
  language: string;
  companyName: string;
  aiDisclosure: string;
  clientNiche: string;
  campaignId: number | null;
  scenario: string;
  market: string;
};

/**
 * Read the browser demo's current settings.
 *
 * The engine's state payload already carries firstName, language and company,
 * but not the disclosure, the Client key, the campaign or the scenario. Rather
 * than widen a payload the page polls every 1.6-6s to serve a panel that opens
 * occasionally, this reads the row on demand.
 */
export async function getWebDemoConfig(token: string): Promise<DemoLeadConfig | undefined> {
  const lead = await findWebDemoLead(token);
  if (!lead) return undefined;

  const niche = parseDemoNiche(lead.demoNiche);
  const str = (v: unknown) => (typeof v === "string" ? v : "");

  return {
    firstName: lead.firstName || "",
    language: (lead.language || "en").toLowerCase(),
    companyName: str(niche.company_name),
    aiDisclosure: str(niche.ai_disclosure),
    // Stamped by both mint paths (create-link and the panel's own PATCH) so a
    // re-picked Client shows as the current selection instead of the picker
    // opening on "Campaign default". Links minted before this key existed
    // report empty, which reads correctly as "not set from the library".
    clientNiche: str(niche.client_niche),
    campaignId: lead.campaignsId ?? null,
    scenario: resolveDemoScenario(niche),
    market: str(niche.market),
  };
}

/**
 * Apply the presenter panel's edits to the browser demo's lead.
 *
 * `demoNiche` holds the entire persona (vocabulary, scoping ladder, opener), so
 * the scalar fields MERGE into it. Overwriting the blob to set one key would
 * erase the persona and leave a demo that talks about nothing.
 *
 * `replaceNiche` is the client-switch path, where replacing wholesale is the
 * intent: a different Client is a different business, not an edit to this one.
 */
export async function updateWebDemoConfig(
  token: string,
  patch: {
    firstName?: string;
    language?: string;
    companyName?: string;
    aiDisclosure?: string;
    replaceNiche?: Record<string, unknown>;
  },
): Promise<boolean> {
  const lead = await findWebDemoLead(token);
  if (!lead) return false;

  const values: Record<string, unknown> = { updatedAt: new Date() };
  if (patch.firstName !== undefined) values.firstName = patch.firstName;
  if (patch.language !== undefined) values.language = patch.language;

  const wantsNicheEdit =
    patch.replaceNiche !== undefined ||
    patch.companyName !== undefined ||
    patch.aiDisclosure !== undefined;

  if (wantsNicheEdit) {
    const niche = patch.replaceNiche ? { ...patch.replaceNiche } : parseDemoNiche(lead.demoNiche);
    if (patch.companyName !== undefined) niche.company_name = patch.companyName;
    // "" clears a per-session override back to the campaign's own
    // ai_disclosure column: the engine's overlay skips empty values, so
    // writing "" here is what "Campaign default" actually means, not a
    // no-op. See NicheContext.ai_disclosure in demo-session.ts.
    if (patch.aiDisclosure !== undefined) niche.ai_disclosure = patch.aiDisclosure;
    values.demoNiche = JSON.stringify(niche);
  }

  await db.update(leads).set(values as any).where(eq(leads.id, lead.id));
  return true;
}

/** One row on the Demos page: a token, with both of its surfaces. */
export type DemoSessionRow = {
  token: string;
  /** Both links, built here rather than reassembled in the page. The WhatsApp
   *  one carries the demo number, which lives in demo-session.ts and
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
  invited: boolean;
  campaignId: number | null;
  createdAt: Date | null;
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

/**
 * Every demo link, newest first, one row per token.
 *
 * Both surfaces are folded into one row because they are one link: minting
 * writes the `wa-demo:` lead immediately and the engine adds the `web-demo:`
 * one on first open, so listing the raw leads would show every demo twice and
 * make "did they open it?" impossible to read.
 *
 * Reply counts come from one grouped Interactions query rather than a per-row
 * lookup: at 200 tokens the naive version is 400 round trips.
 */
export async function listDemoSessions(limit = 200): Promise<DemoSessionRow[]> {
  const rows = await db
    .select()
    .from(leads)
    .where(
      or(
        like(leads.channelIdentifier, "wa-demo:%"),
        like(leads.channelIdentifier, "web-demo:%"),
      ),
    )
    .orderBy(desc(leads.id))
    // Two surfaces per token, so the row budget is double the token budget.
    .limit(limit * 2);

  if (!rows.length) return [];

  const replyCounts = new Map<number, { n: number; first: Date | null; last: Date | null }>();
  const ids = rows.map((r) => r.id as number);
  const counted = await db
    .select({
      leadsId: interactions.leadsId,
      n: count(),
      // First inbound is when a WhatsApp demo actually began (see below); last
      // is how recently it moved.
      first: min(interactions.createdAt),
      last: max(interactions.createdAt),
    })
    .from(interactions)
    .where(and(inArray(interactions.leadsId, ids), eq(interactions.direction, "inbound")))
    .groupBy(interactions.leadsId);
  for (const c of counted) {
    replyCounts.set(c.leadsId as number, {
      n: Number(c.n) || 0,
      first: (c.first as Date) ?? null,
      last: (c.last as Date) ?? null,
    });
  }

  const byToken = new Map<string, DemoSessionRow>();
  for (const lead of rows) {
    const ident = String(lead.channelIdentifier || "");
    const isWeb = ident.startsWith("web-demo:");
    const token = ident.slice(ident.indexOf(":") + 1);
    if (!token) continue;

    const niche = parseDemoNiche(lead.demoNiche);
    const str = (v: unknown) => (typeof v === "string" ? v : "");
    const counts = replyCounts.get(lead.id as number) || { n: 0, first: null, last: null };

    // "Opened" means something different on each surface, and conflating them
    // makes the column useless. The BROWSER lead is created by the engine on
    // first visit, so the row existing IS the open. The WHATSAPP lead is
    // created at MINT time by createPendingDemoLead, so its existence says
    // only that the link was made — reporting that as an open marked every
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

    let row = byToken.get(token);
    if (!row) {
      row = {
        token,
        demoUrl: buildDemoPageLink({ token }),
        whatsappUrl: buildWhatsAppLink({ token }),
        firstName: lead.firstName || "",
        language: (lead.language || "en").toLowerCase(),
        companyName: str(niche.company_name),
        clientNiche: str(niche.client_niche),
        scenario: "inquired",
        invited: !!lead.demoInvited,
        campaignId: lead.campaignsId ?? null,
        createdAt: (lead.createdAt as Date) ?? null,
        browser: { opened: false, openedAt: null, replies: 0, lastAt: null, status: "" },
        whatsapp: { opened: false, openedAt: null, replies: 0, lastAt: null, status: "" },
      };
      byToken.set(token, row);
    }

    if (isWeb) {
      row.browser = surface;
      // The browser lead is the one the presenter panel steers, so its persona
      // is the authority on what the demo currently IS. The wa-demo row keeps
      // whatever it was minted with and would report a stale company after a
      // panel edit.
      if (str(niche.company_name)) row.companyName = str(niche.company_name);
      if (str(niche.client_niche)) row.clientNiche = str(niche.client_niche);
      row.scenario = resolveDemoScenario(niche);
    } else {
      row.whatsapp = surface;
      // Minting creates this row, so it owns the fields the link was born with.
      row.invited = !!lead.demoInvited;
      row.createdAt = (lead.createdAt as Date) ?? row.createdAt;
      if (!row.firstName) row.firstName = lead.firstName || "";
      if (!row.companyName) row.companyName = str(niche.company_name);
      if (!row.clientNiche) row.clientNiche = str(niche.client_niche);
    }
  }

  return Array.from(byToken.values())
    .sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0))
    .slice(0, limit);
}
