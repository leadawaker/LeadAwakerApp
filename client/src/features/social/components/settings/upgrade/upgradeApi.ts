// "Upgrade with AI" API (server/social/settingsUpgradeRoutes.ts). Agency only; nothing here saves.
import { apiFetch } from "@/lib/apiUtils";
import { jsonInit, throwUnlessOk } from "../../../api/socialApi";
import type { UpgradeField } from "./upgradeState";

const base = (accountId: number) => `/api/social/accounts/${accountId}/settings/upgrade`;

export const upgradeCaptionsKey = (accountId: number) => ["social-upgrade-captions", accountId] as const;

export async function fetchUpgradeCaptionCount(accountId: number): Promise<{ count: number }> {
  return (await throwUnlessOk(await apiFetch(`${base(accountId)}/captions`))).json();
}

/** Sends one video file raw; the server pulls its audio, transcribes it and keeps nothing. */
export async function transcribeUpgradeVideo(accountId: number, file: File): Promise<{ text: string; durationS: number }> {
  const res = await apiFetch(`${base(accountId)}/video`, { method: "POST", headers: { "Content-Type": file.type || "video/mp4" }, body: file });
  return (await throwUnlessOk(res)).json();
}

export interface UpgradeBody { field: UpgradeField; currentText: string; notes: string; useCaptions: boolean; transcripts: string[]; uiLanguage: string }

export async function runUpgrade(accountId: number, body: UpgradeBody): Promise<{ text: string; changes: string[]; captionsUsed: number }> {
  return (await throwUnlessOk(await apiFetch(base(accountId), jsonInit("POST", body)))).json();
}
