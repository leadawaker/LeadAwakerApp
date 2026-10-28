/**
 * Pure refusals for the Demos page's write paths. A public website demo is the
 * visitor's own: the agency can add notes to it and delete it, nothing else
 * (no settings edit, no new link in its group, no re-mint). A link that was
 * already replaced (revoked) cannot be replaced again. No db import, so tests
 * can load it; ./applySettings.ts, ./linkOps.ts and the create-link route apply
 * these.
 */

import type { DemoProspectSettings } from "@shared/demoProspects";
import { PUBLIC_DEMO_SOURCE } from "@shared/demoTokenTtl";
import type { DemoLeadLite } from "../demoSessionsFold";
import { tokenOf, tokensInGroup } from "./rows";

/** The six per-prospect settings a patch may carry (notes and the website are separate fields). */
export const SETTING_KEYS = ["firstName", "companyName", "clientNiche", "language", "aiDisclosure", "market"] as const;

export type SettingsPatch = Partial<DemoProspectSettings> & { notes?: string; websiteUrl?: string };

/** What the 409 `public_demo` answers say, by what was attempted. */
export const PUBLIC_DEMO_MESSAGES = {
  remint: "A public website demo cannot be re-minted.",
  edit: "A public website demo's settings cannot be edited. Notes and delete are still allowed.",
  mint: "A public website demo cannot be given new links.",
} as const;

/** Any of these lead rows came from the public website form. */
export const holdsPublicDemo = (rows: { source: string | null }[]): boolean =>
  rows.some((r) => r.source === PUBLIC_DEMO_SOURCE);

/** The prospect group owns a token with a row from the public website form. */
export function groupHoldsPublicDemo(demoLeads: DemoLeadLite[], group: string): boolean {
  const owned = new Set(tokensInGroup(demoLeads, group));
  return holdsPublicDemo(demoLeads.filter((l) => owned.has(tokenOf(l.channelIdentifier))));
}

/**
 * The patch changes a setting or the website, as opposed to notes alone. A
 * field repeated with its current value is no change. `currentWebsiteUrl` is
 * what the prospect shows now ("" when none).
 */
export function editsPublicDemoSettings(prev: DemoProspectSettings, patch: SettingsPatch, currentWebsiteUrl: string): boolean {
  if (SETTING_KEYS.some((k) => patch[k] !== undefined && patch[k] !== prev[k])) return true;
  return patch.websiteUrl !== undefined && patch.websiteUrl !== currentWebsiteUrl;
}

/**
 * Why a link's rows cannot be re-minted, null when they can. A public demo is
 * named before a revoked one; one revoked row is enough (a replaced link has
 * both rows stamped, and minting again would leave a second live link nobody
 * was told about).
 */
export function remintRefusal(rows: DemoLeadLite[]): "missing" | "public_demo" | "revoked" | null {
  if (!rows.length) return "missing";
  if (holdsPublicDemo(rows)) return "public_demo";
  if (rows.some((r) => r.demoRevokedAt)) return "revoked";
  return null;
}
