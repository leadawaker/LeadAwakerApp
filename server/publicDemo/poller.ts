// After a public website demo: tell Gabriel to call, optionally ask the
// visitor how it went, watch the budget, and clean up old requests.
// A poller for the same reason as demo-reply-notifier.ts: the WhatsApp side of
// the demo runs in the Python engine, which Express never sees.
import { db, pool } from "../db";
import { tasks } from "@shared/schema";
import { storage } from "../storage";
import { createAndDispatchNotification } from "../notification-dispatcher";
import { claimBudgetAlert, spendToday } from "./limits";
import { getPublicDemoSettings } from "./settings";
import { engineCall } from "./build";

const NOTIFICATION_TYPE = "public_demo_lead";
const POLL_MS = 60 * 1000;
const REQ = `"p2mxx34fvbf3ll6"."Public_Demo_Requests"`;
const LEADS = `"p2mxx34fvbf3ll6"."Leads"`;
const TASKS = `"p2mxx34fvbf3ll6"."Tasks"`;
/** Task defaults: Gabriel, on the agency account. */
const TASK_USER_ID = 4;
const AGENCY_ACCOUNT_ID = 1;
/** A verified visitor who never tried any channel is still worth a call. */
const UNUSED_AFTER_HOURS = 2;
const LANG_NAME: Record<string, string> = { en: "English", nl: "Dutch", pt: "Portuguese" };

async function agencyUsers() {
  return (await storage.getAppUsers()).filter((u: any) => u.accountsId === AGENCY_ACCOUNT_ID);
}

async function notifyAgency(title: string, body: string, link: string, leadId: number | null): Promise<void> {
  for (const user of await agencyUsers()) {
    try {
      await createAndDispatchNotification({
        type: NOTIFICATION_TYPE,
        title,
        body,
        userId: user.id!,
        accountId: AGENCY_ACCOUNT_ID,
        read: false,
        link,
        leadId,
      });
    } catch (err) {
      console.error("[PublicDemoPoller] notify failed for user", user.id, err);
    }
  }
}

async function completeFinishedDemos(): Promise<void> {
  const { whatsappIdleCompleteMinutes } = await getPublicDemoSettings();
  const { rows } = await pool.query(
    `SELECT r.id FROM ${REQ} r JOIN ${LEADS} l ON l.id = r.lead_id
     WHERE r.status = 'ready' AND r.completed_at IS NULL AND (
       r.voice_ended_at IS NOT NULL
       OR (r.chat_turns > 0 AND l.last_message_received_at < now() - make_interval(mins => $1))
       OR (r.voice_sessions = 0 AND r.chat_turns = 0 AND r.ready_at < now() - make_interval(hours => $2))
     )`,
    [whatsappIdleCompleteMinutes, UNUSED_AFTER_HOURS],
  );
  for (const { id } of rows) {
    // Claimed by the UPDATE, so a second process or pass can never repeat it.
    const claimed = await pool.query(
      `UPDATE ${REQ} SET status = 'completed', completed_at = now()
       WHERE id = $1 AND completed_at IS NULL RETURNING *`,
      [id],
    );
    const r = claimed.rows[0];
    if (r) await announce(r).catch((err) => console.error("[PublicDemoPoller] announce failed", id, err));
  }
}

async function announce(r: any): Promise<void> {
  const who = r.company_name || r.domain;
  const lang = LANG_NAME[r.language] || r.language;
  const minutes = Math.round((r.voice_seconds || 0) / 60);
  const tried =
    r.voice_sessions === 0 && r.chat_turns === 0
      ? "Verified but did not try the demo yet"
      : `Voice: ${r.voice_sessions} call(s), ${minutes} min. WhatsApp: ${r.chat_turns} message(s)`;
  const feedback = (r.feedback || "").trim();

  const description = [
    `Phone: ${r.phone}`,
    `Website: ${r.website_url}`,
    `Language: ${lang}`,
    tried,
    `Feedback: ${feedback || "none yet"}`,
    `Lead #${r.lead_id}`,
  ].join("\n");

  const now = new Date();
  const [task] = await db
    .insert(tasks)
    .values({
      accountsId: AGENCY_ACCOUNT_ID,
      leadsId: r.lead_id,
      assignedToUserId: TASK_USER_ID,
      createdByUserId: TASK_USER_ID,
      title: `Call ${who} about their demo`,
      description,
      status: "todo",
      priority: "high",
      taskType: "call",
      // Demo leads go cold fast: due within the next couple of hours.
      dueDate: new Date(now.getTime() + 2 * 3600 * 1000),
      leadName: who,
      createdAt: now,
      updatedAt: now,
    } as any)
    .returning({ id: tasks.id });
  await pool.query(`UPDATE ${REQ} SET followup_task_id = $1 WHERE id = $2`, [task.id, r.id]);

  await notifyAgency(
    `New demo lead: call ${who}`,
    `${r.domain}, ${lang}. ${feedback ? `“${feedback.slice(0, 160)}”` : "No feedback yet."} ${r.phone}`,
    `/tasks/${task.id}`,
    r.lead_id,
  );
}

async function sendFeedbackMessages(): Promise<void> {
  const { feedbackMessage } = await getPublicDemoSettings();
  if (!feedbackMessage.enabled) return;
  const { rows } = await pool.query(
    `SELECT r.id, r.lead_id FROM ${REQ} r
     JOIN ${LEADS} l ON l.id = r.lead_id
     LEFT JOIN ${TASKS} t ON t.id = r.followup_task_id
     WHERE r.status = 'completed' AND r.feedback_sent_at IS NULL
       AND r.completed_at < now() - make_interval(mins => $1)
       AND (t.id IS NULL OR t.status NOT IN ('done', 'cancelled'))
       AND l.last_message_received_at > now() - interval '23 hours'`,
    [feedbackMessage.delayMinutes],
  );
  for (const r of rows) {
    const claimed = await pool.query(
      `UPDATE ${REQ} SET feedback_sent_at = now() WHERE id = $1 AND feedback_sent_at IS NULL RETURNING id`,
      [r.id],
    );
    if (claimed.rowCount) await engineCall("notice", { lead_id: r.lead_id, kind: "feedback" });
  }
}

async function checkBudget(): Promise<void> {
  const [{ dailyBudgetEur }, spend] = await Promise.all([getPublicDemoSettings(), spendToday()]);
  if (spend.eur < dailyBudgetEur || spend.alertSentAt) return;
  if (!(await claimBudgetAlert())) return;
  await notifyAgency(
    "Public demo budget reached for today",
    `Estimated €${spend.eur.toFixed(2)} of €${dailyBudgetEur}. The landing page shows "book a call" until tomorrow.`,
    "/platform/demos",
    null,
  );
}

let lastRetentionDay = "";
async function retention(): Promise<void> {
  const day = new Date().toISOString().slice(0, 10);
  if (day === lastRetentionDay) return;
  lastRetentionDay = day;
  // Never verified: the request and its unclaimed pending lead.
  const stale = await pool.query(
    `DELETE FROM ${REQ} WHERE status = 'awaiting_phone' AND created_at < now() - interval '7 days' RETURNING lead_id`,
  );
  const leadIds = stale.rows.map((r) => r.lead_id).filter(Boolean);
  if (leadIds.length) {
    await pool.query(
      `DELETE FROM ${LEADS} WHERE id = ANY($1::int[]) AND automation_status = 'demo_pending' AND phone IS NULL`,
      [leadIds],
    );
  }
  // Old demos: keep the counts, drop the personal and scraped data.
  await pool.query(
    `UPDATE ${REQ} SET phone = NULL, persona = NULL, feedback = NULL
     WHERE created_at < now() - interval '90 days' AND (phone IS NOT NULL OR persona IS NOT NULL OR feedback IS NOT NULL)`,
  );
  if (stale.rowCount) console.log(`[PublicDemoPoller] retention removed ${stale.rowCount} unverified request(s)`);
}

export function startPublicDemoPoller(): void {
  const run = async () => {
    for (const step of [completeFinishedDemos, sendFeedbackMessages, checkBudget, retention]) {
      try {
        await step();
      } catch (err) {
        console.error(`[PublicDemoPoller] ${step.name} failed`, err);
      }
    }
  };
  setInterval(run, POLL_MS);
  console.log("[PublicDemoPoller] started (every 60s)");
}
