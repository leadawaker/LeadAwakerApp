/**
 * Pure helpers for a demo lead's `demo_niche` blob and for choosing which of a
 * token's two lead rows speaks for it. No db import, so tests can load it.
 */

/**
 * Parse a lead's demo_niche blob defensively. A blob written by a fallback
 * mint, or hand-edited, must not take a reader down with it: an unparseable
 * persona reads as "nothing set" everywhere this is called.
 */
export function parseDemoNiche(raw: string | null | undefined): Record<string, unknown> {
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
export function resolveDemoScenario(niche: Record<string, unknown>): "inquired" | "deciding" {
  const str = (v: unknown) => (typeof v === "string" ? v : "");
  return ["quoted", "deciding", "decision"].includes(
    (str(niche.lead_stage) || str(niche.scenario)).toLowerCase(),
  )
    ? "deciding"
    : "inquired";
}

/**
 * Which of a token's lead rows the presenter panel reads from.
 *
 * Every token has up to two leads: `web-demo:<token>` (created by the engine on
 * the first browser visit) and `wa-demo:<token>` (created at mint). The browser
 * row is the one the panel steers, so it wins when it exists; before the first
 * open only the WhatsApp row exists and it stands in. Undefined when neither
 * does.
 */
export function pickConfigRow<T extends { channelIdentifier: string | null; createdAt: Date | null }>(
  rows: T[],
): T | undefined {
  return (
    rows.find((r) => (r.channelIdentifier ?? "").startsWith("web-demo:")) ??
    rows.find((r) => (r.channelIdentifier ?? "").startsWith("wa-demo:"))
  );
}

/**
 * The blob keys that describe the LINK rather than the Client: which service it
 * demos, which prospect it belongs to, and a voice link's chosen voice and
 * locale. A Client or language switch replaces the persona but keeps these, or
 * the next switch no longer knows what kind of link it is editing.
 */
export const BOOKKEEPING_KEYS = ["service", "prospect_group", "voice", "voice_locale"] as const;

/**
 * One lead row's next `demo_niche` blob for a panel edit.
 *
 * Without `replaceNiche` the edit merges into the row's own blob. With it the
 * blob is replaced wholesale (a different Client is a different business), but
 * the row keeps its own BOOKKEEPING_KEYS: those are about the link, not part of
 * the Client. `aiDisclosure` "" is a real value: it clears the override back to
 * the campaign's own setting.
 */
export function mergeDemoNiche(
  own: Record<string, unknown>,
  patch: { companyName?: string; aiDisclosure?: string; replaceNiche?: Record<string, unknown> },
): Record<string, unknown> {
  const niche: Record<string, unknown> = patch.replaceNiche ? { ...patch.replaceNiche } : { ...own };
  if (patch.replaceNiche) {
    for (const k of BOOKKEEPING_KEYS) {
      if (own[k] !== undefined) niche[k] = own[k];
    }
  }
  if (patch.companyName !== undefined) niche.company_name = patch.companyName;
  if (patch.aiDisclosure !== undefined) niche.ai_disclosure = patch.aiDisclosure;
  return niche;
}
