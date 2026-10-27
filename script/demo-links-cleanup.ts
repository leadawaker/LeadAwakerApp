// Dead demo link cleanup. Dry run by default: SELECTs only, prints counts and lists.
//
//   npx tsx --env-file=.env script/demo-links-cleanup.ts                         (dry run)
//   npx tsx --env-file=.env script/demo-links-cleanup.ts --execute --confirm=<N> (deletes)
//
// N is the "tokens to delete" count the dry run printed. Selection rules live in
// server/demoProspects/cleanupPlan.ts (tested); the child tables come from
// server/demoProspects/purge.ts (mirrors the engine's demo_data_purge.py).
import { pool } from "../server/db";
import { loadDemoLeadsLite } from "../server/demoProspects/store";
import { DEMO_SCHEMA, countStatements } from "../server/demoProspects/purge";
import {
  executeGate,
  parseCleanupArgs,
  planDeadLinkCleanup,
  tokenFingerprint,
  type CleanupLead,
  type CleanupReason,
} from "../server/demoProspects/cleanupPlan";

const LIST_LIMIT = 50;
const REASONS: CleanupReason[] = ["expired", "deleted_campaign", "orphan_web"];

/** Inbound Interactions per lead id, in one grouped query. Counts either lead column, so a reply is never missed. */
async function inboundCounts(leadIds: number[]): Promise<Map<number, number>> {
  if (leadIds.length === 0) return new Map();
  const { rows } = await pool.query(
    `SELECT lead, count(*)::int AS n FROM (
       SELECT "Leads_id"::int AS lead FROM "${DEMO_SCHEMA}"."Interactions"
        WHERE direction = 'inbound' AND "Leads_id" = ANY($1::int[])
       UNION ALL
       SELECT "lead_id"::int AS lead FROM "${DEMO_SCHEMA}"."Interactions"
        WHERE direction = 'inbound' AND "lead_id" = ANY($1::int[]) AND "Leads_id" IS DISTINCT FROM "lead_id"
     ) replies GROUP BY lead`,
    [leadIds],
  );
  return new Map(rows.map((r: { lead: number; n: number }) => [Number(r.lead), Number(r.n)]));
}

/** Voice_Calls rows per lead id: a call to a demo number is an answer, so its token stays. */
async function voiceCallCounts(leadIds: number[]): Promise<Map<number, number>> {
  if (leadIds.length === 0) return new Map();
  const { rows } = await pool.query(
    `SELECT leads_id::int AS lead, count(*)::int AS n FROM "${DEMO_SCHEMA}"."Voice_Calls"
      WHERE leads_id = ANY($1::int[]) GROUP BY leads_id`,
    [leadIds],
  );
  return new Map(rows.map((r: { lead: number; n: number }) => [Number(r.lead), Number(r.n)]));
}

async function existingCampaignIds(): Promise<Set<number>> {
  const { rows } = await pool.query(`SELECT id FROM "${DEMO_SCHEMA}"."Campaigns"`);
  return new Set(rows.map((r: { id: number }) => Number(r.id)));
}

async function main(): Promise<number> {
  const args = parseCleanupArgs(process.argv.slice(2));
  if (args.error) {
    console.error(`${args.error}\nUsage: npx tsx --env-file=.env script/demo-links-cleanup.ts [--execute --confirm=<N>]`);
    return 1;
  }

  const lite = await loadDemoLeadsLite();
  const ids = lite.map((l) => l.id);
  const [inbound, calls, campaignIds] = await Promise.all([inboundCounts(ids), voiceCallCounts(ids), existingCampaignIds()]);
  // With no campaigns at all every token would read as a deleted campaign, so a
  // wrong database or schema must stop here rather than plan a wipe.
  if (campaignIds.size === 0) {
    console.error(
      "Aborting: the Campaigns table returned no rows, so every token would be planned as a deleted campaign. " +
        "Check DATABASE_URL and the schema before running this again. Nothing was deleted.",
    );
    return 1;
  }
  const leads: CleanupLead[] = lite.map((l) => ({
    ...l,
    inbound: inbound.get(l.id) ?? 0,
    voiceCalls: calls.get(l.id) ?? 0,
  }));
  const plan = planDeadLinkCleanup(leads, campaignIds, Date.now());

  const leadIds = plan.tokens.flatMap((t) => t.leadIds);
  console.log(args.execute ? "Demo link cleanup (EXECUTE)" : "Demo link cleanup (DRY RUN: nothing is deleted)");
  console.log(`tokens to delete: ${plan.tokens.length}`);
  for (const reason of REASONS) {
    console.log(`  ${reason}: ${plan.tokens.filter((t) => t.reason === reason).length}`);
  }
  console.log(`kept: replied ${plan.kept.replied}, public ${plan.kept.public}, live ${plan.kept.live}`);
  console.log(`lead rows to delete: ${leadIds.length}`);

  if (leadIds.length > 0) {
    console.log("rows per table:");
    for (const { table, sql } of countStatements()) {
      const { rows } = await pool.query(sql, [leadIds]);
      console.log(`  ${table}: ${rows[0]?.n ?? 0}`);
    }
    console.log(`first ${Math.min(LIST_LIMIT, plan.tokens.length)} of ${plan.tokens.length}:`);
    for (const t of plan.tokens.slice(0, LIST_LIMIT)) {
      console.log(`  ${tokenFingerprint(t.token)}  ${t.label}  (${t.reason})`);
    }
  }

  if (!args.execute) return 0;

  const gate = executeGate(args, plan.tokens.length);
  if (!gate.ok) {
    console.error(gate.message);
    return 1;
  }
  if (leadIds.length === 0) {
    console.log("Nothing to delete.");
    return 0;
  }
  // Loaded only here, so a dry run never pulls in the module that holds the DELETEs.
  const { deleteDemoLeads } = await import("../server/demoProspects/linkOps");
  const deleted = await deleteDemoLeads(leadIds);
  console.log("deleted:");
  for (const [table, n] of Object.entries(deleted)) console.log(`  ${table}: ${n}`);
  return 0;
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
