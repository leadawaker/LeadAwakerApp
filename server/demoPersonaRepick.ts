/**
 * Re-picking a running demo's persona from a saved Client: the one place that
 * knows how. The presenter panel's `PATCH /api/demo/:token/config` and a
 * prospect's settings edit (demoProspects/applySettings.ts) both rebuild a
 * link's persona this way, so a Client switch, a language switch and a settings
 * edit can never diverge.
 *
 * Two steps, because the callers need the first on its own to refuse a bad
 * request before touching anything: resolveRepickClient (does the Client exist,
 * and does it speak the language) and repickPersona (build the blob).
 */

import { clientLanguages, demoClientToContext, getDemoClient, type ClientRow, type DemoLang } from "./demo-clients";
import type { DemoMarket, DemoScenario } from "./demo-session";
import { BOOKKEEPING_KEYS } from "./demoNicheBlob";
import { socialSnapshotFields } from "./demoSocial/snapshot";

/**
 * Can this Client be demoed in this language?
 *
 * A Client stores its opener (and the phrases substituted into it) per
 * language, and only the languages someone actually generated or typed. Running
 * one in a language it lacks used to fall back across languages and splice, for
 * example, a Portuguese noun phrase into an English opener. See clientLanguages().
 *
 * Every caller here does something different with a "no" (the admin mint says
 * so, the VIP command regenerates, the public page uses its own template), so
 * this returns the answer rather than a response.
 */
export function clientSupportsLanguage(row: Parameters<typeof clientLanguages>[0], language: DemoLang): boolean {
  const langs = clientLanguages(row);
  // Empty means unrestricted: the curated niche packs have word lists but no
  // opener in any language, so there is nothing to splice.
  return langs.length === 0 || langs.includes(language);
}

export type RepickClient =
  | { ok: true; row: ClientRow }
  | { ok: false; reason: "no_client" | "language"; message: string };

/**
 * The saved Client a persona is re-picked from, when it exists and speaks
 * `lang`. The messages name the fix, so callers surface them verbatim.
 */
export async function resolveRepickClient(clientNiche: string, lang: DemoLang): Promise<RepickClient> {
  const row = await getDemoClient(clientNiche);
  if (!row) return { ok: false, reason: "no_client", message: `No saved Client named "${clientNiche}".` };
  if (!clientSupportsLanguage(row, lang)) {
    const have = clientLanguages(row).map((l) => l.toUpperCase()).join(", ");
    return {
      ok: false,
      reason: "language",
      message: `"${row.niche}" has no ${lang.toUpperCase()} version. It only exists in ${have}. Add the ${lang.toUpperCase()} opener fields on the Clients tab, or switch this demo to ${have}.`,
    };
  }
  return { ok: true, row };
}

export type RepickResult =
  | { ok: true; ctx: Record<string, unknown> }
  | { ok: false; reason: "no_persona" | "social"; message: string };

/**
 * The persona blob for a link, built from `row` in `lang`.
 *
 * `social` says the link is the Instagram demo, whose post, opener and source
 * live in the blob rather than in the Client's context, so they are re-added
 * here (generated from the Client's own context, never the prospect's company:
 * the post may be saved to the shared Client row). `companyName` is the company
 * the link ends up with; it decides the post's handle and replaces the Client's
 * company in the blob.
 *
 * `carry` is a blob whose link bookkeeping (BOOKKEEPING_KEYS: service, group,
 * voice) is copied onto the result, for a caller that replaces a link's persona
 * and has no per-row merge of its own. A caller that rewrites each row from its
 * own blob (rewriteBlob) leaves it out.
 */
export async function repickPersona(input: {
  row: ClientRow;
  lang: DemoLang;
  scenario: DemoScenario;
  market?: DemoMarket;
  social: boolean;
  companyName?: string;
  carry?: Record<string, unknown>;
}): Promise<RepickResult> {
  const { row, lang, scenario, market, social, companyName, carry } = input;
  const ctx = demoClientToContext(row, lang, scenario, market) as Record<string, unknown> | null;
  if (!ctx) {
    // Vocabulary-only rows (the pre-existing curated niches) have word lists
    // but no persona.
    return {
      ok: false,
      reason: "no_persona",
      message: `"${row.niche}" has no saved persona yet. Generate one for this niche instead.`,
    };
  }
  // Remembered so the picker reopens showing this Client as current instead of
  // falling back to "Campaign default". Inert to the engine:
  // _overlay_demo_niche_onto_campaign copies an explicit key list onto the
  // campaign dict, so a key it does not name is simply ignored.
  ctx.client_niche = row.niche;
  if (social) {
    try {
      Object.assign(ctx, await socialSnapshotFields(row, lang, { ...ctx }, companyName || undefined));
    } catch (err) {
      console.error("[social-demo] post generation failed", row.niche, (err as Error).message);
      return { ok: false, reason: "social", message: "Could not write the Instagram post. Try again." };
    }
  }
  if (companyName) ctx.company_name = companyName;
  // Mint-time bookkeeping is not part of the Client; keep it, or the next
  // switch no longer knows what kind of link this is.
  for (const k of BOOKKEEPING_KEYS) {
    if (carry?.[k] !== undefined) ctx[k] = carry[k];
  }
  return { ok: true, ctx };
}
