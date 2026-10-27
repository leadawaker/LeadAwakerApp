/**
 * Pure rules for rewriting a prospect's links after its settings are edited:
 * whether an edit needs the persona rebuilt from the Client, and what each
 * lead row's next `demo_niche` blob is. No db import, so tests can load it;
 * the queries and the Client lookups are in ./applySettings.ts.
 */

import type { DemoProspectSettings } from "@shared/demoProspects";
import { BOOKKEEPING_KEYS, parseDemoNiche } from "../demoNicheBlob";
import { tokenOf } from "./rows";

export { BOOKKEEPING_KEYS };

/** Any of the six settings differs. */
export function settingsChanged(prev: DemoProspectSettings, next: DemoProspectSettings): boolean {
  return (
    prev.firstName !== next.firstName ||
    prev.companyName !== next.companyName ||
    prev.clientNiche !== next.clientNiche ||
    prev.language !== next.language ||
    prev.aiDisclosure !== next.aiDisclosure ||
    prev.market !== next.market
  );
}

/**
 * The persona (opener, knowledge, vocabulary) is built from the Client in a
 * language and market, so a different Client, language or market means a new
 * persona. A name, company or disclosure edit leaves it alone. With no Client
 * there is nothing to rebuild from.
 */
export function needsRebuild(prev: DemoProspectSettings, next: DemoProspectSettings): boolean {
  return (
    next.clientNiche !== "" &&
    (prev.clientNiche !== next.clientNiche || prev.language !== next.language || prev.market !== next.market)
  );
}

/**
 * One lead row's next blob. `rebuilt` is the persona freshly built from the
 * Client (null when the edit did not need one), and replaces the row's persona
 * wholesale while the row keeps its own link bookkeeping. The company name is
 * the prospect's when it has one, otherwise whatever the base carries (the
 * Client's own on a rebuild); the disclosure is written even when cleared ("")
 * because that is how the campaign's own setting comes back; the market always
 * follows the settings.
 */
export function rewriteBlob(
  blob: Record<string, unknown>,
  next: DemoProspectSettings,
  rebuilt: Record<string, unknown> | null,
): Record<string, unknown> {
  const base: Record<string, unknown> = rebuilt ? { ...rebuilt, client_niche: next.clientNiche } : { ...blob };
  if (rebuilt) {
    for (const k of BOOKKEEPING_KEYS) {
      if (blob[k] !== undefined) base[k] = blob[k];
    }
  }
  if (next.companyName) base.company_name = next.companyName;
  base.ai_disclosure = next.aiDisclosure;
  base.market = next.market;
  return base;
}

export interface LeadRewrite {
  leadId: number;
  token: string;
  firstName: string;
  language: string;
  /** The row's next blob, serialised for the column. */
  demoNiche: string;
}

/**
 * The write for every existing lead row (WhatsApp and browser) of each token,
 * in token order. A token that has only one row yields one entry; each row is
 * rewritten from its own blob, so the two surfaces keep their own differences.
 */
export function planTokenRewrites(
  leads: { id: number; channelIdentifier: string | null; demoNiche: string | null }[],
  tokens: string[],
  next: DemoProspectSettings,
  rebuiltFor: (blob: Record<string, unknown>) => Record<string, unknown> | null,
): LeadRewrite[] {
  const plan: LeadRewrite[] = [];
  for (const token of tokens) {
    for (const lead of leads) {
      if (tokenOf(lead.channelIdentifier) !== token) continue;
      const blob = parseDemoNiche(lead.demoNiche);
      plan.push({
        leadId: lead.id,
        token,
        firstName: next.firstName,
        language: next.language,
        demoNiche: JSON.stringify(rewriteBlob(blob, next, rebuiltFor(blob))),
      });
    }
  }
  return plan;
}
