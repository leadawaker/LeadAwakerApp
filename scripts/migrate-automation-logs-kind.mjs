// One-off: adds the diary marker column + partial indexes (specs/automation-overview).
// Run: node scripts/migrate-automation-logs-kind.mjs
import pg from "pg";
import fs from "node:fs";

const env = Object.fromEntries(
  fs.readFileSync(new URL("../.env", import.meta.url), "utf8")
    .split("\n").filter((l) => /^DATABASE_URL=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).replace(/^"|"$/g, "")]),
);
const client = new pg.Client({ connectionString: process.env.DATABASE_URL || env.DATABASE_URL });
const T = `"p2mxx34fvbf3ll6"."Automation_Logs"`;

await client.connect();
try {
  await client.query(`ALTER TABLE ${T} ADD COLUMN IF NOT EXISTS kind text`);
  await client.query(`CREATE INDEX IF NOT EXISTS automation_logs_action_account_idx ON ${T} ("Accounts_id", created_at DESC) WHERE kind = 'action'`);
  await client.query(`CREATE INDEX IF NOT EXISTS automation_logs_action_workflow_idx ON ${T} (workflow_name, created_at DESC) WHERE kind = 'action'`);
  const dup = await client.query(`
    SELECT indexname, indexdef FROM pg_indexes
    WHERE schemaname = 'p2mxx34fvbf3ll6' AND tablename = 'Automation_Logs' AND indexdef ILIKE '%(created_at)%'`);
  console.log("created_at indexes:", dup.rows);
  console.log("done");
} finally {
  await client.end();
}
