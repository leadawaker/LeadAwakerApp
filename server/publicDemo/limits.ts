// Persistent limits for the public website demo. Everything is in Postgres so
// a restart forgets nothing, and the engine can read the same numbers.
import { createHash } from "crypto";
import { pool } from "../db";
import { getPublicDemoSettings } from "./settings";

const S = `"p2mxx34fvbf3ll6"`;
const REQ = `${S}."Public_Demo_Requests"`;
const SPEND = `${S}."Public_Demo_Spend"`;
/** Today's ledger row, on the Amsterdam calendar. */
const TODAY = `(now() AT TIME ZONE 'Europe/Amsterdam')::date`;

export function hashIp(ip: string): string {
  return createHash("sha256").update(`${ip}|${process.env.INTERNAL_API_KEY || ""}`).digest("hex");
}

export async function ipRequestsToday(ipHash: string): Promise<number> {
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS n FROM ${REQ} WHERE ip_hash = $1 AND created_at > now() - interval '24 hours'`,
    [ipHash],
  );
  return rows[0]?.n ?? 0;
}

/** This phone's latest usable demo within the cooldown, if any. */
export async function phoneRecentDemo(
  phone: string,
  excludeToken: string,
): Promise<{ token: string; leadId: number | null; domain: string } | null> {
  const { phoneCooldownDays } = await getPublicDemoSettings();
  const { rows } = await pool.query(
    `SELECT token, lead_id, domain FROM ${REQ}
     WHERE phone = $1 AND token <> $2 AND status IN ('ready', 'completed')
       AND created_at > now() - make_interval(days => $3)
     ORDER BY created_at DESC LIMIT 1`,
    [phone, excludeToken, phoneCooldownDays],
  );
  const r = rows[0];
  return r ? { token: r.token, leadId: r.lead_id, domain: r.domain } : null;
}

/** A persona already built for this domain and language, within the cache window. */
export async function domainCachedPersona(
  domain: string,
  language: string,
): Promise<{ persona: Record<string, unknown>; companyName: string | null } | null> {
  const { domainCacheDays } = await getPublicDemoSettings();
  const { rows } = await pool.query(
    `SELECT persona, company_name FROM ${REQ}
     WHERE domain = $1 AND language = $2 AND persona IS NOT NULL
       AND status IN ('ready', 'completed')
       AND ready_at > now() - make_interval(days => $3)
     ORDER BY ready_at DESC LIMIT 1`,
    [domain, language, domainCacheDays],
  );
  const r = rows[0];
  return r ? { persona: r.persona, companyName: r.company_name } : null;
}

export async function spendToday(): Promise<{ eur: number; built: number; alertSentAt: Date | null }> {
  const { rows } = await pool.query(
    `SELECT est_cost_eur, demos_built, budget_alert_sent_at FROM ${SPEND} WHERE day = ${TODAY}`,
  );
  const r = rows[0];
  return {
    eur: r ? Number(r.est_cost_eur) : 0,
    built: r ? Number(r.demos_built) : 0,
    alertSentAt: r?.budget_alert_sent_at ?? null,
  };
}

/** Add estimated spend to today's ledger (and to the request, if given). */
export async function addSpend(eur: number, opts: { built?: boolean; token?: string } = {}): Promise<void> {
  const amount = Math.max(0, Number(eur) || 0);
  await pool.query(
    `INSERT INTO ${SPEND} (day, est_cost_eur, demos_built) VALUES (${TODAY}, $1, $2)
     ON CONFLICT (day) DO UPDATE SET est_cost_eur = ${SPEND}.est_cost_eur + $1,
                                     demos_built = ${SPEND}.demos_built + $2`,
    [amount, opts.built ? 1 : 0],
  );
  if (opts.token && amount > 0) {
    await pool.query(`UPDATE ${REQ} SET est_cost_eur = est_cost_eur + $1 WHERE token = $2`, [amount, opts.token]);
  }
}

export async function isOverBudget(): Promise<boolean> {
  const [{ dailyBudgetEur }, spend] = await Promise.all([getPublicDemoSettings(), spendToday()]);
  return spend.eur >= dailyBudgetEur;
}

export async function isOverDailyDemoCap(): Promise<boolean> {
  const [{ maxDemosPerDay }, spend] = await Promise.all([getPublicDemoSettings(), spendToday()]);
  return spend.built >= maxDemosPerDay;
}

/** Marks today's budget alert as sent; true only for the caller that set it. */
export async function claimBudgetAlert(): Promise<boolean> {
  const { rowCount } = await pool.query(
    `UPDATE ${SPEND} SET budget_alert_sent_at = now() WHERE day = ${TODAY} AND budget_alert_sent_at IS NULL`,
  );
  return (rowCount ?? 0) > 0;
}
