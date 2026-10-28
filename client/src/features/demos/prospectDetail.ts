// What the prospect detail panel computes from a row. Pure: only `import type`, so it loads in tests.
import type { DemoProspectSettings, ProspectSettingsResult } from "@shared/demoProspects";
import type { ProspectRow } from "./prospectRows";

/** The six settings the panel edits, as the row holds them. */
export function settingsOf(row: ProspectRow): DemoProspectSettings {
  return {
    firstName: row.firstName,
    companyName: row.companyName,
    clientNiche: row.clientNiche,
    language: row.language,
    aiDisclosure: row.aiDisclosure,
    market: row.market,
  };
}

/**
 * The PATCH body for an edited form: only the fields that differ from the row, names trimmed
 * (the server trims them too). The row keeps the OLD settings after a partial failure (R25), so
 * the same edit yields the same patch again and pressing Save retries it.
 */
export function changedSettings(row: ProspectRow, draft: DemoProspectSettings): Partial<DemoProspectSettings> {
  const next: DemoProspectSettings = { ...draft, firstName: draft.firstName.trim(), companyName: draft.companyName.trim() };
  const current = settingsOf(row);
  const patch: Partial<DemoProspectSettings> = {};
  for (const key of Object.keys(current) as (keyof DemoProspectSettings)[]) {
    if (next[key] !== current[key]) Object.assign(patch, { [key]: next[key] });
  }
  return patch;
}

/** The counts line: every link the prospect was ever sent, how many were opened, and all replies. History included. */
export function prospectCounts(row: ProspectRow): { links: number; opened: number; replies: number } {
  const all = [...Object.values(row.byService), ...row.extra, ...row.history];
  return {
    links: all.length,
    opened: all.filter((s) => s.browser.opened || s.whatsapp.opened).length,
    replies: row.replies,
  };
}

/** Each distinct failure message once: a persona without the new language fails every link the same way. */
export function failedMessages(failed: ProspectSettingsResult["failedTokens"]): string[] {
  return [...new Set(failed.map((f) => f.message))];
}
