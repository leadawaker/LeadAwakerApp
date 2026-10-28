/**
 * A prospect's settings edit, applied to every link it owns.
 *
 * The edit is rewritten into every token of the group, on both the WhatsApp
 * and the browser lead row, so links that were already sent pick it up. The
 * rules (what needs a rebuild, what each row's next blob is) are pure and live
 * in ./personaRewrite.ts; this file is the lookups and writes around them.
 */

import { db } from "../db";
import { leads } from "@shared/schema";
import { eq } from "drizzle-orm";
import type { DemoProspectDto, DemoProspectSettings, ProspectSettingsResult } from "@shared/demoProspects";
import type { ClientRow } from "../demo-clients";
import { parseDemoNiche, resolveDemoScenario } from "../demoNicheBlob";
import { repickPersona, resolveRepickClient, type RepickResult } from "../demoPersonaRepick";
import { isSocialBlob } from "../demoSocial/snapshot";
import { needsRebuild, planTokenRewrites, settingsChanged, settingsToSave, type LeadRewrite } from "./personaRewrite";
import { PUBLIC_DEMO_MESSAGES, SETTING_KEYS, editsPublicDemoSettings, holdsPublicDemo, type SettingsPatch } from "./linkGuards";
import { normalizeSettings, settingsFromLeads, tokenOf, tokensInGroup } from "./rows";
import { getProspect, loadDemoLeadsLite, upsertProspect } from "./store";

export type ProspectPatch = SettingsPatch;

export type ApplyProspectResult =
  | { ok: true; result: ProspectSettingsResult }
  | { ok: false; status: 404 | 409; message: string; code?: "public_demo" };

const settingsOf = (s: DemoProspectSettings | DemoProspectDto): DemoProspectSettings => ({
  firstName: s.firstName,
  companyName: s.companyName,
  clientNiche: s.clientNiche,
  language: s.language,
  aiDisclosure: s.aiDisclosure,
  market: s.market,
});

/** The patch laid over the current settings: an omitted field is left as it is. */
function mergeSettings(prev: DemoProspectSettings, patch: ProspectPatch): DemoProspectSettings {
  const merged: Record<string, unknown> = { ...prev };
  for (const k of SETTING_KEYS) {
    if (patch[k] !== undefined) merged[k] = patch[k];
  }
  return normalizeSettings(merged as unknown as DemoProspectSettings);
}

/**
 * What a rebuilt persona depends on in a link's blob: the quote/no-quote side
 * and whether it is the Instagram demo. Two rows with the same answer get the
 * same rebuilt persona, so it is built once per answer, not once per row.
 */
const personaKey = (blob: Record<string, unknown>) => `${resolveDemoScenario(blob)}:${isSocialBlob(blob)}`;

/** One token's rows in one transaction: both surfaces change together or not at all. */
async function writeTokenRows(rows: LeadRewrite[]): Promise<void> {
  await db.transaction(async (tx) => {
    for (const r of rows) {
      await tx
        .update(leads)
        .set({ firstName: r.firstName, language: r.language, demoNiche: r.demoNiche, updatedAt: new Date() })
        .where(eq(leads.id, r.leadId));
    }
  });
}

/**
 * Apply an edit to the prospect `group` (a uuid, or `token:<token>` for a
 * legacy link that never had one).
 *
 * The current settings are the prospect's row, else read back from the links
 * the group already holds, else there is no such prospect (404). A different
 * Client, language or market rebuilds each link's persona from the Client, which
 * must exist and speak the language; any other edit changes only what it names.
 * A link whose persona cannot be rebuilt (the Instagram post failed) is listed
 * in `failedTokens` and left as it was, and then the row keeps its OLD settings
 * so repeating the same edit retries them. The row is always saved, so a legacy
 * group gains its row and notes alone save.
 *
 * A group that holds a public website demo takes notes only: any other change
 * is refused with 409 `public_demo` before anything is read or written.
 */
export async function applyProspectSettings(group: string, patch: ProspectPatch): Promise<ApplyProspectResult> {
  const demoLeads = await loadDemoLeadsLite();
  const tokens = tokensInGroup(demoLeads, group);
  const owned = new Set(tokens);
  const groupLeads = demoLeads.filter((l) => owned.has(tokenOf(l.channelIdentifier)));

  const existing = await getProspect(group);
  if (!existing && !groupLeads.length) return { ok: false, status: 404, message: "No prospect with that key." };

  const prev = existing ? settingsOf(existing) : settingsFromLeads(groupLeads);
  if (holdsPublicDemo(groupLeads) && editsPublicDemoSettings(prev, patch, existing?.websiteUrl ?? "")) {
    return { ok: false, status: 409, code: "public_demo", message: PUBLIC_DEMO_MESSAGES.edit };
  }
  const next = mergeSettings(prev, patch);

  const rebuild = needsRebuild(prev, next);
  let client: ClientRow | undefined;
  if (rebuild) {
    const found = await resolveRepickClient(next.clientNiche, next.language);
    if (!found.ok) return { ok: false, status: found.reason === "no_client" ? 404 : 409, message: found.message };
    client = found.row;
  }

  const updatedTokens: string[] = [];
  const failedTokens: { token: string; message: string }[] = [];

  if (settingsChanged(prev, next) && tokens.length) {
    // Build every persona first: nothing is written until the whole request is
    // known to be good, so a refusal never leaves the links half edited.
    const rebuilt = new Map<string, RepickResult>();
    if (rebuild && client) {
      for (const token of tokens) {
        for (const lead of groupLeads.filter((l) => tokenOf(l.channelIdentifier) === token)) {
          const blob = parseDemoNiche(lead.demoNiche);
          const key = personaKey(blob);
          let result = rebuilt.get(key);
          if (!result) {
            result = await repickPersona({
              row: client,
              lang: next.language,
              scenario: resolveDemoScenario(blob),
              market: next.market || undefined,
              social: isSocialBlob(blob),
              companyName: next.companyName || undefined,
            });
            rebuilt.set(key, result);
          }
          if (result.ok) continue;
          // The Client has no persona at all: a refusal of the whole edit.
          if (result.reason === "no_persona") return { ok: false, status: 409, message: result.message };
          if (!failedTokens.some((f) => f.token === token)) failedTokens.push({ token, message: result.message });
        }
      }
    }

    const failed = new Set(failedTokens.map((f) => f.token));
    const plan = planTokenRewrites(
      groupLeads,
      tokens.filter((t) => !failed.has(t)),
      next,
      (blob) => {
        const result = rebuild ? rebuilt.get(personaKey(blob)) : undefined;
        return result?.ok ? result.ctx : null;
      },
    );

    for (const token of tokens) {
      const rows = plan.filter((r) => r.token === token);
      if (!rows.length) continue;
      try {
        await writeTokenRows(rows);
        updatedTokens.push(token);
      } catch (err) {
        console.error("[demo-prospects] settings rewrite failed", token, (err as Error).message);
        failedTokens.push({ token, message: "Could not save this link. Try again." });
      }
    }
  }

  // Notes and website always save. The settings only when every link took them
  // (see settingsToSave), so a failed link can be retried by repeating the edit.
  const prospect = await upsertProspect(group, {
    ...settingsToSave(prev, next, failedTokens.length),
    notes: patch.notes,
    websiteUrl: patch.websiteUrl,
  });
  return { ok: true, result: { prospect, updatedTokens, failedTokens } };
}
