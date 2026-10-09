// server/storage/automationDiary.ts
// Diary queries for the Automations page + per-client tab (specs/automation-overview).
// Diary rows are Automation_Logs with kind = 'action'.
import { sql } from "drizzle-orm";
import { db } from "../db";
import { type ActionCounts, type DiaryLine, type DiaryPage } from "@shared/automationTypes";
import { buildClientLines, type GateInputs } from "../automations/clientGates";

const T = sql.raw(`"p2mxx34fvbf3ll6"."Automation_Logs"`);
const REASON = sql.raw(`COALESCE(NULLIF(skipped_reason, ''), NULLIF(output_data, ''), NULLIF(error_code, ''))`);

function toCounts(r: any): ActionCounts {
  return {
    success: Number(r.success ?? 0),
    failed: Number(r.failed ?? 0),
    skipped: Number(r.skipped ?? 0),
    lastActionAt: r.last_action_at ? new Date(r.last_action_at).toISOString() : null,
    topFailureReason: r.top_reason ?? null,
  };
}

export const automationDiaryStorage = {
  async getActionCountsByWorkflow(sinceHours: number): Promise<Map<string, ActionCounts>> {
    const res = await db.execute(sql`
      WITH win AS (
        SELECT workflow_name, status, ${REASON} AS reason FROM ${T}
        WHERE kind = 'action' AND created_at > NOW() - make_interval(hours => ${sinceHours})
      ),
      last AS (
        SELECT workflow_name, MAX(created_at) AS last_action_at FROM ${T}
        WHERE kind = 'action' GROUP BY workflow_name
      ),
      reasons AS (
        SELECT DISTINCT ON (workflow_name) workflow_name, reason AS top_reason
        FROM (SELECT workflow_name, reason, COUNT(*) AS n FROM win WHERE status = 'Failure' AND reason IS NOT NULL GROUP BY 1, 2) x
        ORDER BY workflow_name, n DESC
      )
      SELECT l.workflow_name,
        COUNT(*) FILTER (WHERE w.status = 'Success') AS success,
        COUNT(*) FILTER (WHERE w.status = 'Failure') AS failed,
        COUNT(*) FILTER (WHERE w.status = 'Skipped') AS skipped,
        l.last_action_at, r.top_reason
      FROM last l
      LEFT JOIN win w ON w.workflow_name = l.workflow_name
      LEFT JOIN reasons r ON r.workflow_name = l.workflow_name
      GROUP BY l.workflow_name, l.last_action_at, r.top_reason
    `);
    return new Map((res.rows as any[]).map((r) => [r.workflow_name, toCounts(r)]));
  },

  async getActionCountsForAccount(accountId: number, sinceDays: number): Promise<Map<string, ActionCounts>> {
    const res = await db.execute(sql`
      WITH win AS (
        SELECT workflow_name, "Campaigns_id" AS campaign_id, status, created_at, ${REASON} AS reason FROM ${T}
        WHERE kind = 'action' AND "Accounts_id" = ${accountId}
          AND created_at > NOW() - make_interval(days => ${sinceDays})
      ),
      reasons AS (
        SELECT DISTINCT ON (workflow_name, campaign_id) workflow_name, campaign_id, reason AS top_reason
        FROM (SELECT workflow_name, campaign_id, reason, COUNT(*) AS n FROM win WHERE status = 'Failure' AND reason IS NOT NULL GROUP BY 1, 2, 3) x
        ORDER BY workflow_name, campaign_id, n DESC
      )
      SELECT w.workflow_name, w.campaign_id,
        COUNT(*) FILTER (WHERE w.status = 'Success') AS success,
        COUNT(*) FILTER (WHERE w.status = 'Failure') AS failed,
        COUNT(*) FILTER (WHERE w.status = 'Skipped') AS skipped,
        MAX(w.created_at) AS last_action_at,
        MAX(r.top_reason) AS top_reason
      FROM win w
      LEFT JOIN reasons r ON r.workflow_name = w.workflow_name AND r.campaign_id IS NOT DISTINCT FROM w.campaign_id
      GROUP BY w.workflow_name, w.campaign_id
    `);
    return new Map((res.rows as any[]).map((r) => [`${r.workflow_name}|${r.campaign_id ?? ""}`, toCounts(r)]));
  },

  async getDiaryPage(opts: { names: string[]; accountId?: number; failedOnly?: boolean; page: number; limit: number }): Promise<DiaryPage> {
    const offset = (opts.page - 1) * opts.limit;
    const res = await db.execute(sql`
      SELECT l.id, l.created_at, l.workflow_name, l.step_name, l.status, ${REASON} AS reason, l.metadata,
        l."Accounts_id" AS account_id, a.name AS account_name,
        l."Campaigns_id" AS campaign_id, c.name AS campaign_name,
        l."Leads_id" AS lead_id,
        NULLIF(TRIM(CONCAT_WS(' ', ld.first_name, ld.last_name)), '') AS lead_name
      FROM ${T} l
      LEFT JOIN "p2mxx34fvbf3ll6"."Accounts" a ON a.id = l."Accounts_id"
      LEFT JOIN "p2mxx34fvbf3ll6"."Campaigns" c ON c.id = l."Campaigns_id"
      LEFT JOIN "p2mxx34fvbf3ll6"."Leads" ld ON ld.id = l."Leads_id"
      WHERE l.kind = 'action'
        AND l.workflow_name IN (${sql.join(opts.names.map((n) => sql`${n}`), sql`, `)})
        ${opts.accountId ? sql`AND l."Accounts_id" = ${opts.accountId}` : sql``}
        ${opts.failedOnly ? sql`AND l.status = 'Failure'` : sql``}
      ORDER BY l.created_at DESC NULLS LAST, l.id DESC
      LIMIT ${opts.limit + 1} OFFSET ${offset}
    `);
    const rows = res.rows as any[];
    const lines: DiaryLine[] = rows.slice(0, opts.limit).map((r) => {
      let meta: any = null;
      try { meta = r.metadata ? JSON.parse(r.metadata) : null; } catch { meta = null; }
      return {
        id: Number(r.id),
        createdAt: new Date(r.created_at).toISOString(),
        automationId: r.workflow_name,
        action: r.step_name,
        outcome: r.status === "Failure" ? "failed" : r.status === "Skipped" ? "skipped" : "success",
        reason: r.reason ?? null,
        accountId: r.account_id ?? null, accountName: r.account_name ?? null,
        campaignId: r.campaign_id ?? null, campaignName: r.campaign_name ?? null,
        leadId: r.lead_id ?? null, leadName: r.lead_name ?? null,
        interactionId: typeof meta?.interaction_id === "number" ? meta.interaction_id : null,
        voiceCallId: typeof meta?.voice_call_id === "number" ? meta.voice_call_id : null,
      };
    });
    return { lines, page: opts.page, hasMore: rows.length > opts.limit };
  },

  async getGateInputs(accountId: number): Promise<GateInputs> {
    const [acc] = (await db.execute(sql`
      SELECT id, enable_reputation_management, enable_review_response, missed_call_enabled, missed_call_number
      FROM "p2mxx34fvbf3ll6"."Accounts" WHERE id = ${accountId}
    `)).rows as any[];
    const campaigns = (await db.execute(sql`
      SELECT c.id, c.name, c.status, c.campaign_type, c.max_bumps,
        c.bump_1_delay_hours, c.bump_2_delay_hours, c.bump_3_delay_hours, c.bump_4_delay_hours,
        c.use_ai_bumps, c.channel_mode, c.fallback_channel, c.daily_lead_limit,
        c.active_hours_start::text AS active_hours_start, c.active_hours_end::text AS active_hours_end,
        EXISTS (SELECT 1 FROM ${T} l WHERE l.kind = 'action' AND l."Campaigns_id" = c.id AND l.created_at > NOW() - INTERVAL '7 days') AS had_activity,
        (SELECT COUNT(*) FROM "p2mxx34fvbf3ll6"."Leads" ld WHERE ld."Campaigns_id" = c.id AND ld.automation_status = 'active')::int AS active_leads
      FROM "p2mxx34fvbf3ll6"."Campaigns" c WHERE c."Accounts_id" = ${accountId}
      ORDER BY c.id
    `)).rows as any[];
    const voice = (await db.execute(sql`
      SELECT phone_number, enabled, transfer_number FROM "p2mxx34fvbf3ll6"."Voice_Numbers" WHERE accounts_id = ${accountId}
    `)).rows as any[];
    const widgets = (await db.execute(sql`
      SELECT enabled FROM "p2mxx34fvbf3ll6"."Widget_Configs" WHERE "Accounts_id" = ${accountId}
    `)).rows as any[];
    const [prof] = (await db.execute(sql`
      SELECT setup->'stock'->>'feedUrl' AS feed_url FROM "p2mxx34fvbf3ll6"."Account_Communication_Profile"
      WHERE "Accounts_id" = ${accountId} LIMIT 1
    `)).rows as any[];
    return {
      account: {
        id: accountId,
        enableReputationManagement: acc?.enable_reputation_management ?? null,
        enableReviewResponse: acc?.enable_review_response ?? null,
        missedCallEnabled: acc?.missed_call_enabled ?? null,
        missedCallNumber: acc?.missed_call_number ?? null,
      },
      campaigns: campaigns.map((c) => ({
        id: c.id, name: c.name ?? `#${c.id}`, status: c.status, campaignType: c.campaign_type,
        maxBumps: c.max_bumps == null ? null : Number(c.max_bumps),
        bumpDelaysHours: [c.bump_1_delay_hours, c.bump_2_delay_hours, c.bump_3_delay_hours, c.bump_4_delay_hours].map((v) => (v == null ? null : Number(v))),
        useAiBumps: c.use_ai_bumps, channelMode: c.channel_mode, fallbackChannel: c.fallback_channel,
        dailyLeadLimit: c.daily_lead_limit == null ? null : Number(c.daily_lead_limit),
        activeHoursStart: c.active_hours_start, activeHoursEnd: c.active_hours_end,
        hadActivity7d: !!c.had_activity, activeLeads: Number(c.active_leads ?? 0),
      })),
      voiceNumbers: voice.map((v) => ({ phoneNumber: v.phone_number, enabled: !!v.enabled, transferNumber: v.transfer_number })),
      widgets: widgets.map((w) => ({ enabled: w.enabled })),
      stockFeedUrl: prof?.feed_url || null,
    };
  },

  async getClientsOnCounts(): Promise<Map<string, number>> {
    const ids = ((await db.execute(sql`
      SELECT id FROM "p2mxx34fvbf3ll6"."Accounts" WHERE id <> 1 AND COALESCE(LOWER(status), 'active') NOT IN ('inactive', 'archived', 'deleted')
    `)).rows as any[]).map((r) => Number(r.id));
    const out = new Map<string, number>();
    for (const id of ids) {
      const lines = buildClientLines(await automationDiaryStorage.getGateInputs(id));
      const onIds = new Set(lines.filter((l) => l.state !== "off").map((l) => l.automationId));
      onIds.forEach((a) => out.set(a, (out.get(a) ?? 0) + 1));
    }
    return out;
  },
};
