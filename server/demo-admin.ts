/**
 * The presenter panel's and the Demos page's read/write of a running demo.
 *
 * Split out of demo-session.ts (which owns niche/persona GENERATION) because
 * this half is a different concern: editing sessions that already exist. The
 * Demos page's index lives in demoSessionsList.ts and is re-exported here.
 */

import { db } from "./db";
import { leads } from "@shared/schema";
import { eq, inArray } from "drizzle-orm";
import { mergeDemoNiche, parseDemoNiche, pickConfigRow, resolveDemoScenario } from "./demoNicheBlob";

// The Demos page's index moved to its own modules; kept importable from here.
export { listDemoSessions } from "./demoSessionsList";
export type { DemoSessionRow, DemoSurfaceRow } from "./demoSessionsList";

/**
 * Both lead rows of a token, in no particular order.
 *
 * Every token has two independent leads: `web-demo:<token>` for the page
 * (created by the engine on first visit) and `wa-demo:<token>` for WhatsApp
 * (created at mint). See specs/demo-surface-split. One of them may not exist
 * yet; callers 404 on an empty result rather than creating a row themselves.
 */
async function findDemoLeads(token: string) {
  return db
    .select()
    .from(leads)
    .where(inArray(leads.channelIdentifier, [`web-demo:${token}`, `wa-demo:${token}`]));
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
 * Read a demo's current settings.
 *
 * Reads the browser row when the page has been opened, else the WhatsApp row
 * (see pickConfigRow), so a link that was sent but never opened still has
 * settings to show. Undefined only when neither row exists.
 *
 * The engine's state payload already carries firstName, language and company,
 * but not the disclosure, the Client key, the campaign or the scenario. Rather
 * than widen a payload the page polls every 1.6-6s to serve a panel that opens
 * occasionally, this reads the row on demand.
 */
export async function getDemoConfig(token: string): Promise<DemoLeadConfig | undefined> {
  const lead = pickConfigRow(await findDemoLeads(token));
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

/** The demo's raw persona blob (the browser row's when it exists, else the
 *  WhatsApp row's), for callers that must know more than the panel's config
 *  (the Instagram demo's social keys). {} when neither row exists. */
export async function getDemoNiche(token: string): Promise<Record<string, unknown>> {
  const lead = pickConfigRow(await findDemoLeads(token));
  return parseDemoNiche(lead?.demoNiche);
}

/**
 * Apply the presenter panel's edits to BOTH of the token's lead rows.
 *
 * The two surfaces are one link, so a setting changed in the panel (name,
 * language, company, disclosure, a Client switch) has to land on the page and
 * on WhatsApp alike. A token that was never opened has only the WhatsApp row,
 * and the edit still applies to it.
 *
 * `demoNiche` holds the entire persona (vocabulary, scoping ladder, opener), so
 * the scalar fields MERGE into it, each row into its own blob. Overwriting the
 * blob to set one key would erase the persona and leave a demo that talks about
 * nothing.
 *
 * `replaceNiche` is the client-switch path, where replacing wholesale is the
 * intent: a different Client is a different business, not an edit to this one.
 * Each row still keeps its own mint-time bookkeeping (BOOKKEEPING_KEYS:
 * service, prospect_group, voice, voice_locale), which is about the link rather
 * than part of the Client. All the token's rows are written in one transaction.
 *
 * Returns how many lead rows were updated; zero means no such token.
 */
export async function updateDemoConfig(
  token: string,
  patch: {
    firstName?: string;
    language?: string;
    companyName?: string;
    aiDisclosure?: string;
    replaceNiche?: Record<string, unknown>;
  },
): Promise<number> {
  const rows = await findDemoLeads(token);

  const wantsNicheEdit =
    patch.replaceNiche !== undefined ||
    patch.companyName !== undefined ||
    patch.aiDisclosure !== undefined;

  // One transaction: the two surfaces are one link, so a failure on the second
  // row must not leave the first one edited.
  await db.transaction(async (tx) => {
    for (const lead of rows) {
      const values: Record<string, unknown> = { updatedAt: new Date() };
      if (patch.firstName !== undefined) values.firstName = patch.firstName;
      if (patch.language !== undefined) values.language = patch.language;

      if (wantsNicheEdit) {
        const niche = mergeDemoNiche(parseDemoNiche(lead.demoNiche), patch);
        values.demoNiche = JSON.stringify(niche);
      }

      await tx.update(leads).set(values as any).where(eq(leads.id, lead.id));
    }
  });
  return rows.length;
}

/**
 * Rename the prospect behind a link, on BOTH surfaces.
 *
 * A narrower edit than updateDemoConfig (name and company only, no persona
 * replace). It works on a link that has never been opened, which has no browser
 * lead: fixing a name on a link that was already sent is the case it exists for.
 *
 * Returns how many lead rows were touched; zero means no such token.
 */
export async function updateDemoIdentity(
  token: string,
  patch: { firstName?: string; companyName?: string },
): Promise<number> {
  const rows = await findDemoLeads(token);

  for (const lead of rows) {
    const values: Record<string, unknown> = { updatedAt: new Date() };
    if (patch.firstName !== undefined) values.firstName = patch.firstName;
    if (patch.companyName !== undefined) {
      // Merged, never replaced: the blob is the whole persona.
      const niche = parseDemoNiche(lead.demoNiche);
      niche.company_name = patch.companyName;
      values.demoNiche = JSON.stringify(niche);
    }
    await db.update(leads).set(values as any).where(eq(leads.id, lead.id));
  }
  return rows.length;
}
