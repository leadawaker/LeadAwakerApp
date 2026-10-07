import { desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "../db";
import { accounts, interactions, leads, voiceCalls } from "@shared/schema";
import type { VoiceOutcome } from "@shared/voiceOutcome";
import { itemColumns, scopeWhere, toItem, type VoiceCallListItem, type VoiceScope } from "./voiceCalls";
import { bestOutcome, isDnd, isOutOfHours } from "./voiceCallersLogic";

/** One row per person Sara spoke to (spec "API contract"). */
export interface VoiceCaller {
  key: string;
  leadsId: number | null;
  name: string | null;
  phone: string | null;
  email: string | null;
  callCount: number;
  lastCallAt: string;
  lastCallId: string;
  latestOutcome: VoiceOutcome;
  bestOutcome: VoiceOutcome;
  bookedSlot: string | null;
  bookedIso: string | null;
  personaCompany: string | null;
  leadStatus: string | null;
  dnd: boolean;
  outOfHours: boolean;
  hubspotContactId: string | null;
  lastCalledBackAt: string | null;
  lastCalledBackBy: string | null;
  accountId: number;
  accountName: string | null;
}

export interface CallerLead {
  leadsId: number;
  /** The account the action is logged under: the lead's, else its calls'. */
  accountId: number;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  email: string | null;
  hubspotContactId: string | null;
  /** The calls of this lead the user may see, newest first. */
  calls: VoiceCallListItem[];
}

export interface CallBackRecord {
  lastCalledBackAt: string;
  lastCalledBackBy: string | null;
}

const CALL_BACK_TYPE = "call_back";

const leadColumns = {
  id: leads.id,
  accountsId: leads.accountsId,
  firstName: leads.firstName,
  lastName: leads.lastName,
  phone: leads.phone,
  email: leads.email,
  optedOut: leads.optedOut,
  dncReason: leads.dncReason,
  conversionStatus: leads.conversionStatus,
  hubspotContactId: leads.hubspotContactId,
};
type LeadRow = { [K in keyof typeof leadColumns]: unknown } & { id: number | null };

/** The demo stores the placeholder "web" as phone: that is not a number. */
function realPhone(v: unknown): string | null {
  return typeof v === "string" && v.trim() !== "" && v.trim() !== "web" ? v : null;
}

/**
 * Demo and phone-door leads are created with the caller's number (or the
 * placeholder "web") as first name: that is not a name, so the recap name wins.
 */
function fullName(first: unknown, last: unknown): string | null {
  const name = [first, last].filter((s) => typeof s === "string" && s.trim()).join(" ").trim();
  if (!name || name.toLowerCase() === "web" || /^[\d\s+()\-.]+$/.test(name)) return null;
  return name;
}

async function latestCallBacks(leadIds: number[]): Promise<Map<number, CallBackRecord>> {
  const out = new Map<number, CallBackRecord>();
  if (!leadIds.length) return out;
  const result = await db.execute(sql`
    SELECT DISTINCT ON (${interactions.leadsId}) ${interactions.leadsId} AS leads_id,
           ${interactions.who} AS who, ${interactions.createdAt} AS created_at
    FROM ${interactions}
    WHERE ${interactions.type} = ${CALL_BACK_TYPE}
      AND ${inArray(interactions.leadsId, leadIds)}
    ORDER BY ${interactions.leadsId}, ${interactions.createdAt} DESC, ${interactions.id} DESC
  `);
  for (const r of result.rows as Array<{ leads_id: number; who: string | null; created_at: string | Date }>) {
    out.set(Number(r.leads_id), {
      lastCalledBackAt: new Date(r.created_at).toISOString(),
      lastCalledBackBy: r.who ?? null,
    });
  }
  return out;
}

interface Group {
  key: string;
  leadsId: number | null;
  rawNumber: string | null;
  calls: VoiceCallListItem[]; // newest first
}

export const voiceCallersStorage = {
  /**
   * Aggregates every call in scope (no row cap) into callers, newest caller
   * first. The scope/account filter is the same `scopeWhere` as the calls list,
   * so a client can only ever aggregate their own account's Live calls.
   */
  async listVoiceCallers(opts: {
    scope: VoiceScope;
    accountId: number | null;
    isOwner: boolean;
    includeAccountName: boolean;
  }): Promise<VoiceCaller[]> {
    const rows = await db
      .select(itemColumns(opts.includeAccountName))
      .from(voiceCalls)
      .where(scopeWhere(opts.scope, opts.accountId))
      .orderBy(desc(voiceCalls.startedAt), desc(voiceCalls.id));

    const groups = new Map<string, Group>();
    for (const r of rows) {
      const leadsId = r.call.leadsId;
      const rawNumber = realPhone(r.call.callerNumber);
      const key = leadsId !== null ? `lead:${leadsId}` : rawNumber ? `num:${rawNumber}` : null;
      if (!key) continue;
      let g = groups.get(key);
      if (!g) groups.set(key, (g = { key, leadsId, rawNumber, calls: [] }));
      g.calls.push(toItem(r.call, r));
    }
    if (!groups.size) return [];

    const leadIds = Array.from(groups.values()).flatMap((g) => (g.leadsId !== null ? [g.leadsId] : []));
    const accountIds = Array.from(new Set(Array.from(groups.values()).map((g) => g.calls[0].accountId)));
    const [leadRows, accountRows, callBacks] = await Promise.all([
      leadIds.length
        ? db.select(leadColumns).from(leads).where(inArray(leads.id, leadIds))
        : Promise.resolve([] as LeadRow[]),
      db
        .select({
          id: accounts.id,
          start: accounts.businessHoursStart,
          end: accounts.businessHoursEnd,
          openDays: accounts.openDays,
          timezone: accounts.timezone,
        })
        .from(accounts)
        .where(inArray(accounts.id, accountIds)),
      latestCallBacks(leadIds),
    ]);
    const leadById = new Map(leadRows.map((l) => [Number(l.id), l as LeadRow]));
    const hoursById = new Map(accountRows.map((a) => [Number(a.id), a]));
    const now = new Date();

    return Array.from(groups.values()).map((g): VoiceCaller => {
      const latest = g.calls[0];
      const lead = g.leadsId !== null ? leadById.get(g.leadsId) : undefined;
      const booked = g.calls.find((c) => c.bookedSlot || c.bookedIso);
      const hours = hoursById.get(latest.accountId);
      const callBack = g.leadsId !== null ? callBacks.get(g.leadsId) : undefined;
      const summaryName = g.calls.find((c) => c.callerName)?.callerName ?? null;
      const callNumber = g.rawNumber ?? g.calls.find((c) => c.callerNumber)?.callerNumber ?? null;
      return {
        key: g.key,
        leadsId: g.leadsId,
        name: (lead && fullName(lead.firstName, lead.lastName)) ?? summaryName,
        phone: (lead && realPhone(lead.phone)) ?? realPhone(callNumber),
        email: opts.isOwner && lead && typeof lead.email === "string" && lead.email ? lead.email : null,
        callCount: g.calls.length,
        lastCallAt: latest.startedAt,
        lastCallId: latest.callId,
        latestOutcome: latest.outcome,
        bestOutcome: bestOutcome(g.calls.map((c) => c.outcome)),
        bookedSlot: booked?.bookedSlot ?? null,
        bookedIso: booked?.bookedIso ?? null,
        personaCompany: latest.personaCompany,
        leadStatus: lead && typeof lead.conversionStatus === "string" ? lead.conversionStatus : null,
        dnd: lead ? isDnd(lead) : false,
        outOfHours: hours ? isOutOfHours(hours, now) : false,
        hubspotContactId:
          opts.isOwner && lead && typeof lead.hubspotContactId === "string" ? lead.hubspotContactId : null,
        lastCalledBackAt: callBack?.lastCalledBackAt ?? null,
        lastCalledBackBy: callBack?.lastCalledBackBy ?? null,
        accountId: latest.accountId,
        accountName: latest.accountName,
      };
    });
  },

  /**
   * The lead behind a caller, only when the user may see at least one of its
   * calls (demo calls need allowDemo, a locked account must own the call).
   * Undefined otherwise, so the route answers 404 without leaking existence.
   */
  async getCallerLead(
    leadsId: number,
    opts: { scope?: VoiceScope; accountId: number | null; allowDemo: boolean },
  ): Promise<CallerLead | undefined> {
    const rows = await db
      .select(itemColumns(false))
      .from(voiceCalls)
      .where(eq(voiceCalls.leadsId, leadsId))
      .orderBy(desc(voiceCalls.startedAt), desc(voiceCalls.id));
    const visible = rows.filter((r) => {
      if (r.isDemo && !opts.allowDemo) return false;
      if (opts.scope && (r.isDemo ? "demo" : "live") !== opts.scope) return false;
      return opts.accountId === null || r.call.accountsId === opts.accountId;
    });
    if (!visible.length) return undefined;
    const [lead] = await db.select(leadColumns).from(leads).where(eq(leads.id, leadsId));
    if (!lead) return undefined;
    const leadAccount = typeof lead.accountsId === "number" ? lead.accountsId : null;
    // A locked user acts under their own account, whatever the lead row says.
    const accountId = opts.accountId ?? leadAccount ?? visible[0].call.accountsId;
    return {
      leadsId,
      accountId,
      firstName: lead.firstName ?? null,
      lastName: lead.lastName ?? null,
      phone: realPhone(lead.phone),
      email: typeof lead.email === "string" && lead.email ? lead.email : null,
      hubspotContactId: lead.hubspotContactId ?? null,
      calls: visible.map((r) => toItem(r.call, r)),
    };
  },

  /** Logs a human call back. Internal direction: never delivered to the lead. */
  async logCallBack(input: {
    leadsId: number;
    accountId: number;
    usersId: number | null;
    who: string;
    content: string;
  }): Promise<CallBackRecord> {
    const now = new Date();
    const [row] = await db
      .insert(interactions)
      .values({
        createdAt: now,
        updatedAt: now,
        leadsId: input.leadsId,
        accountsId: input.accountId,
        usersId: input.usersId,
        who: input.who,
        type: CALL_BACK_TYPE,
        direction: "internal",
        content: input.content,
        aiGenerated: false,
      } as typeof interactions.$inferInsert)
      .returning({ createdAt: interactions.createdAt, who: interactions.who });
    return {
      lastCalledBackAt: (row?.createdAt ?? now).toISOString(),
      lastCalledBackBy: row?.who ?? input.who,
    };
  },

  async setLeadHubspotContactId(leadsId: number, contactId: string): Promise<void> {
    await db
      .update(leads)
      .set({ hubspotContactId: contactId, updatedAt: new Date() } as Partial<typeof leads.$inferInsert>)
      .where(eq(leads.id, leadsId));
  },
};
