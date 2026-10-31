// Chats > Settings: give the website chat its own campaign. A receptionist
// account's WhatsApp (Accounts.inbound_campaign_id) and website widget
// (Widget_Configs.Campaigns_id) may share one campaign; the engine already picks
// them separately, so a copy of that campaign pointed at by the widget is all
// it takes. The copy starts identical (prompt_id included), so nothing changes
// for visitors until it is edited. WhatsApp keeps the original and its leads.
import type { Express } from "express";
import { requireAgency } from "../auth";
import { pool } from "../db";
import { wrapAsync } from "./_helpers";

const S = "p2mxx34fvbf3ll6";
// Not copied: the row's identity and bookkeeping, and the figures the engine and nightly jobs write.
const SKIP = new Set([
  "id", "created_at", "updated_at", "created_by", "updated_by", "nc_order", "name", "ai_summary", "ai_summary_generated_at",
  "total_cost", "total_leads_targeted", "total_messages_sent", "total_responses_received", "last_metrics_calculated_at",
]);

export function registerChatSplitRoutes(app: Express): void {
  app.post("/api/accounts/:id/chat/split-website", requireAgency, wrapAsync(async (req, res) => {
    const accountId = Number(req.params.id);
    if (!Number.isSafeInteger(accountId) || accountId <= 0) return res.status(400).json({ message: "Bad account id" });

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const acc = await client.query(`SELECT inbound_campaign_id FROM ${S}."Accounts" WHERE id = $1 FOR UPDATE`, [accountId]);
      const shared = Number(acc.rows[0]?.inbound_campaign_id) || 0;
      const widgets = await client.query(
        `SELECT id FROM ${S}."Widget_Configs" WHERE "Accounts_id" = $1 AND "Campaigns_id" = $2`, [accountId, shared],
      );
      if (!shared || widgets.rowCount === 0) {
        await client.query("ROLLBACK");
        return res.status(409).json({ message: "WhatsApp and the website chat do not share a campaign" });
      }
      const cols = (await client.query(
        `SELECT column_name FROM information_schema.columns WHERE table_schema = $1 AND table_name = 'Campaigns' ORDER BY ordinal_position`, [S],
      )).rows.map((r) => r.column_name as string).filter((c) => !SKIP.has(c));
      const list = cols.map((c) => `"${c}"`).join(", ");
      const copy = await client.query(
        `INSERT INTO ${S}."Campaigns" (name, created_at, updated_at, ${list})
         SELECT COALESCE(name, '') || ' · Website', now(), now(), ${list} FROM ${S}."Campaigns" WHERE id = $1
         RETURNING id`,
        [shared],
      );
      const newId = Number(copy.rows[0].id);
      await client.query(
        `UPDATE ${S}."Widget_Configs" SET "Campaigns_id" = $1 WHERE "Accounts_id" = $2 AND "Campaigns_id" = $3`,
        [newId, accountId, shared],
      );
      await client.query("COMMIT");
      res.status(201).json({ campaignId: newId, whatsappCampaignId: shared });
    } catch (e) {
      await client.query("ROLLBACK").catch(() => {});
      throw e;
    } finally {
      client.release();
    }
  }));
}
