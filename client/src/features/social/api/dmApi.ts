// Comment-to-DM API (server/social/dmRoutes.ts). Agency only. The mode and the hourly cap are saved
// with saveSocialSettings (studioApi.ts).
import type { DmMode } from "@shared/socialStudio";
import { apiFetch } from "@/lib/apiUtils";
import { jsonInit, throwUnlessOk } from "./socialApi";

export interface DmRuleView { id: number; keyword: string; firstMessage: string; postId: number | null; aiFollowUp: boolean; active: boolean; updatedAt: string }

export interface DmStatus {
  mode: DmMode;
  /** What really happens: "live" needs the account's mode AND the server switch. */
  effectiveMode: DmMode;
  liveSwitch: boolean;
  webhookReady: boolean;
  hourlyCap: number;
  sentLastHour: number;
  rules: DmRuleView[];
  posts: { id: number; caption: string; publishedAt: string; permalink: string | null }[];
}

export interface DmLogView {
  id: number;
  kind: "private_reply" | "reply" | "inbound" | "opt_out" | "ai_follow_up";
  mode: "dry_run" | "live";
  status: "would_send" | "sending" | "sent" | "failed" | "skipped" | "received";
  reason: string | null;
  text: string | null;
  username: string | null;
  ruleId: number | null;
  leadId: number | null;
  createdAt: string;
}

export interface RuleBody { keyword: string; firstMessage: string; postId: number | null; aiFollowUp: boolean; active?: boolean }

const base = (accountId: number) => `/api/social/accounts/${accountId}/dm`;

export const dmStatusKey = (accountId: number) => ["social-dm", accountId] as const;
export const dmLogKey = (accountId: number) => ["social-dm-log", accountId] as const;

export async function fetchDmStatus(accountId: number): Promise<DmStatus> {
  return (await throwUnlessOk(await apiFetch(base(accountId)))).json();
}

export async function fetchDmLog(accountId: number, limit = 50): Promise<DmLogView[]> {
  return (await throwUnlessOk(await apiFetch(`${base(accountId)}/log?limit=${limit}`))).json();
}

export async function createDmRule(accountId: number, body: RuleBody): Promise<DmRuleView> {
  return (await throwUnlessOk(await apiFetch(`${base(accountId)}/rules`, jsonInit("POST", body)))).json();
}

export async function updateDmRule(accountId: number, ruleId: number, body: Partial<RuleBody>): Promise<DmRuleView> {
  return (await throwUnlessOk(await apiFetch(`${base(accountId)}/rules/${ruleId}`, jsonInit("PATCH", body)))).json();
}

export async function deleteDmRule(accountId: number, ruleId: number): Promise<void> {
  await throwUnlessOk(await apiFetch(`${base(accountId)}/rules/${ruleId}`, jsonInit("DELETE")));
}
