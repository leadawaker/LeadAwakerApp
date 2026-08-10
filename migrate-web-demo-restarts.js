// Run with: node --env-file=.env migrate-web-demo-restarts.js
// npm run db:push cannot be used here: it requires a TTY.
//
// Adds Leads.demo_restarts for the browser demo page (/demo/<token>).
//
// A restart DELETES the session's interactions rather than archiving them,
// because the AI's conversation history is read straight from Interactions and
// filtering archived rows would mean a change in the shared conversation path
// that every real campaign also runs through. That makes the interaction count
// useless as a cost ceiling, so the counter lives on the lead instead, where a
// wipe cannot reach it. src/webhooks/web_demo_routes.py caps it at MAX_RESTARTS.
//
// Additive with a default of 0: every existing lead reads as "never restarted",
// which is true.

import { Client } from "pg";

const SCHEMA = "p2mxx34fvbf3ll6";

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  await client.query(
    `ALTER TABLE "${SCHEMA}"."Leads"
       ADD COLUMN IF NOT EXISTS demo_restarts integer NOT NULL DEFAULT 0`,
  );

  const { rows } = await client.query(
    `SELECT column_name, data_type, column_default, is_nullable
       FROM information_schema.columns
      WHERE table_schema = $1 AND table_name = 'Leads' AND column_name = 'demo_restarts'`,
    [SCHEMA],
  );
  console.table(rows);
  if (!rows.length) throw new Error("demo_restarts was not created");

  console.log("OK: Leads.demo_restarts present.");
  await client.end();
}

main().catch((err) => {
  console.error(err.message);
  process.exitCode = 1;
});
