// Adds the in-person visit columns: four on Accounts (the CRM's Visits card) and two on
// Calendar_Connections (the provisioned Cal.diy "visit" event type). The engine selects the
// Accounts four in get_campaign_with_account, so any database built from the repo needs them.
// db:push needs a TTY on the Pi, so we ALTER directly. Idempotent: safe to run again.
// Types and defaults match shared/schema.ts (accounts, calendarConnections).
// Run: node --env-file=.env scripts/add-visit-columns.mjs
import pg from "pg";

const SCHEMA = "p2mxx34fvbf3ll6"; // nocodb pgSchema (matches shared/schema.ts)

// lock_timeout: even a no-op ALTER queues for the table lock, and on a live database a
// queued ALTER would block every other query behind it. Give up after 5 s instead.
const sql = `
SET lock_timeout = '5s';

ALTER TABLE "${SCHEMA}"."Accounts"
  ADD COLUMN IF NOT EXISTS "visits_enabled" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "visit_title" text,
  ADD COLUMN IF NOT EXISTS "visit_duration_minutes" integer NOT NULL DEFAULT 60,
  ADD COLUMN IF NOT EXISTS "visit_address" text;

ALTER TABLE "${SCHEMA}"."Calendar_Connections"
  ADD COLUMN IF NOT EXISTS "caldiy_visit_event_type_id" integer,
  ADD COLUMN IF NOT EXISTS "caldiy_visit_event_type_slug" text;
`;

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

try {
  await pool.query(sql);
  const { rows } = await pool.query(
    `SELECT table_name, column_name, data_type, is_nullable, column_default
     FROM information_schema.columns
     WHERE table_schema = $1
       AND ((table_name = 'Accounts'
             AND column_name IN ('visits_enabled','visit_title','visit_duration_minutes','visit_address'))
         OR (table_name = 'Calendar_Connections'
             AND column_name IN ('caldiy_visit_event_type_id','caldiy_visit_event_type_slug')))
     ORDER BY table_name, column_name`,
    [SCHEMA],
  );
  for (const r of rows) {
    console.log(
      `  ${r.table_name}.${r.column_name}: ${r.data_type}, ${r.is_nullable === "NO" ? "not null" : "nullable"}` +
        (r.column_default ? `, default ${r.column_default}` : ""),
    );
  }
  console.log(`✅ Visit columns ready (${rows.length} of 6 present)`);
  if (rows.length !== 6) process.exitCode = 1;
} catch (err) {
  console.error("❌ Failed:", err.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
