/**
 * What a Home dashboard request may see. Pure, like voiceCallsAccess: clients
 * and impersonation are pinned to one account on the server, whatever the
 * query string says.
 */
import { isHomePeriod } from "@shared/homePeriod";
import { HOME_CHANNELS, type HomeChannel, type HomePeriod } from "@shared/homeTypes";
import { decideScope, type VoiceAccess } from "./voiceCallsAccess";

export interface HomeQuery {
  accountId: number | null; period: HomePeriod; campaignId: number | null;
  /** Home's channel switcher. null = all channels. Only the overview reads it. */
  channel: HomeChannel | null;
}

function positiveInt(v: unknown): number | null {
  const n = Number(typeof v === "string" || typeof v === "number" ? v : NaN);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

export function resolveHomeQuery(
  access: VoiceAccess,
  q: { accountId?: unknown; period?: unknown; campaignId?: unknown; channel?: unknown },
  /** scopeToAccount's lock (a user off account 1, or view-as). Wins over the role and the query string. */
  forcedAccountId?: number | null,
): HomeQuery {
  // "live" is always allowed, so decideScope cannot refuse here.
  const scope = decideScope(access, { accountId: q.accountId });
  const accountId = typeof forcedAccountId === "number" ? forcedAccountId
    : scope.ok ? scope.accountId : access.lockedAccountId;
  return {
    accountId,
    period: isHomePeriod(q.period) ? q.period : "all",
    campaignId: positiveInt(q.campaignId),
    channel: (HOME_CHANNELS as readonly unknown[]).includes(q.channel) ? (q.channel as HomeChannel) : null,
  };
}
