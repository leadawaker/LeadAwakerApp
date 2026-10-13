import { sql } from "drizzle-orm";
import { db } from "../db";
import type { HomeServices } from "@shared/homeTypes";
import {
  T, acct, dbrCampaignSql, liveCallSql, liveLeadSql, receptionistLeadSql, reputationCampaignSql, socialCampaignSql,
} from "./homeSql";

async function getHomeServices(accountId: number | null): Promise<HomeServices> {
  // A tab also shows on activity in the last 90 days, so history does not vanish
  // when a service is switched off or disconnects.
  const recentMessages = (channel: "whatsapp" | "website") => sql`
    EXISTS (SELECT 1 FROM ${T.interactions} i
            JOIN ${T.leads} l ON l.id = i."Leads_id"
            LEFT JOIN ${T.campaigns} c ON c.id = l."Campaigns_id"
            WHERE ${acct('i."Accounts_id"', accountId)} AND i.channel = ${channel}
              AND i.created_at > now() - interval '90 days' AND ${liveLeadSql} AND ${receptionistLeadSql})`;
  const result = await db.execute(sql`
    SELECT
      (EXISTS (SELECT 1 FROM ${T.voiceNumbers} n
               WHERE n.enabled = true AND n.client_niche IS NOT NULL AND ${acct("n.accounts_id", accountId)})
       OR EXISTS (SELECT 1 FROM ${T.voiceCalls} vc
                  WHERE ${acct("vc.accounts_id", accountId)} AND vc.started_at > now() - interval '90 days' AND ${liveCallSql})) AS phone,
      (EXISTS (SELECT 1 FROM ${T.accounts} a
               WHERE ${acct("a.id", accountId)} AND a.inbound_campaign_id IS NOT NULL
                 AND (a.whatsapp_sender_status = 'approved'
                      OR EXISTS (SELECT 1 FROM ${T.whatsappSenders} s WHERE s.accounts_id = a.id AND s.status = 'connected')))
       OR ${recentMessages("whatsapp")}) AS whatsapp,
      (EXISTS (SELECT 1 FROM ${T.widgetConfigs} w
               WHERE w.enabled = true AND jsonb_array_length(COALESCE(w.allowed_domains, '[]'::jsonb)) > 0
                 AND ${acct('w."Accounts_id"', accountId)})
       OR ${recentMessages("website")}) AS website,
      EXISTS (SELECT 1 FROM ${T.campaigns} c
              WHERE ${acct('c."Accounts_id"', accountId)} AND ${dbrCampaignSql}) AS reactivation,
      -- Reputation: review requests switched on with a real campaign, or Google reviews connected.
      (EXISTS (SELECT 1 FROM ${T.campaigns} c JOIN ${T.accounts} a ON a.id = c."Accounts_id"
               WHERE ${acct('c."Accounts_id"', accountId)} AND ${reputationCampaignSql}
                 AND a.enable_reputation_management = true)
       OR EXISTS (SELECT 1 FROM ${T.calendarConnections} g
                  WHERE g.provider = 'gbp' AND g.external_id IS NOT NULL
                    AND ${acct("g.account_id", accountId)})) AS reputation,
      -- Social: an Instagram account connected and a real social campaign.
      EXISTS (SELECT 1 FROM ${T.campaigns} c JOIN ${T.accounts} a ON a.id = c."Accounts_id"
              WHERE ${acct('c."Accounts_id"', accountId)} AND ${socialCampaignSql}
                AND a.instagram_access_token IS NOT NULL) AS social,
      EXISTS (SELECT 1 FROM ${T.accounts} a
              WHERE ${acct("a.id", accountId)} AND COALESCE(a.sms_sender_id, '') <> '') AS sms
  `);
  const r = (result.rows as Record<string, unknown>[])[0] ?? {};
  // All accounts: the agency sees every tab, whether or not any account has the service yet.
  const all = accountId === null;
  return {
    phone: all || r.phone === true,
    whatsapp: all || r.whatsapp === true,
    website: all || r.website === true,
    reactivation: all || r.reactivation === true,
    reputation: all || r.reputation === true,
    social: all || r.social === true,
    sms: r.sms === true,
  };
}

export const homeServicesStorage = { getHomeServices };
