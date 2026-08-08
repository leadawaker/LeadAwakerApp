// Run with: node --env-file=.env scripts/migrations/2026-08-dbr-scoping-mode.js
// npm run db:push cannot be used here: it requires a TTY.
import { Client } from "pg";

const SCHEMA = "p2mxx34fvbf3ll6";

const STATEMENTS = [
  `ALTER TABLE "${SCHEMA}"."Niche_Vocabulary" ADD COLUMN IF NOT EXISTS scoping_ladder jsonb`,
  `ALTER TABLE "${SCHEMA}"."Niche_Vocabulary" ADD COLUMN IF NOT EXISTS opener_phrase jsonb`,
  `ALTER TABLE "${SCHEMA}"."Leads" ADD COLUMN IF NOT EXISTS lead_context text`,
  `ALTER TABLE "${SCHEMA}"."Campaigns" ADD COLUMN IF NOT EXISTS conversation_mode_override text`,
  `ALTER TABLE "${SCHEMA}"."Campaigns" ADD COLUMN IF NOT EXISTS max_messages_per_reply integer DEFAULT 1`,
];

(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();
  for (const sql of STATEMENTS) {
    await c.query(sql);
    console.log("OK:", sql.slice(0, 80));
  }
  await c.end();
  process.exit(0);
})().catch((e) => {
  console.error("FAILED:", e.message);
  process.exit(1);
});
