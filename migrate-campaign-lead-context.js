// Run with: node --env-file=.env migrate-campaign-lead-context.js
// npm run db:push cannot be used here: it requires a TTY.
//
// Adds Campaigns.lead_context, the campaign-level default for the free-text
// specifics a lead's record carries ("enquired about 3 windows through the
// website, no quote was sent").
//
// Leads.lead_context already exists (the DBR scoping-mode migration added it)
// and the engine reads it. This adds the campaign-level fallback so a demo, or
// any campaign whose whole list shares one story, can set the sentence once
// instead of stamping it on every row. Precedence in tools/ai_service.py is
// lead-first, campaign-second, matching what_lead_did.
//
// Why it is NOT what_lead_did: that column is a dropdown the engine
// keyword-matches in derive_lead_stage() to pick the prompt's stage branch.
// Free text there returns no stage and silently switches those branches off.
// One field classifies, the other describes.
//
// Additive and idempotent: no backfill, no default. A NULL simply means the
// prompt's {lead_context} renders empty, which is the pre-existing behaviour.

import { Client } from "pg";

const SCHEMA = "p2mxx34fvbf3ll6";

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  await client.query(
    `ALTER TABLE "${SCHEMA}"."Campaigns" ADD COLUMN IF NOT EXISTS lead_context text`,
  );

  const { rows } = await client.query(
    `SELECT table_name, column_name, data_type
       FROM information_schema.columns
      WHERE table_schema = $1
        AND column_name = 'lead_context'
      ORDER BY table_name`,
    [SCHEMA],
  );
  console.table(rows);

  const expected = ["Campaigns", "Leads"];
  const got = rows.map((r) => r.table_name);
  const missing = expected.filter((t) => !got.includes(t));
  if (missing.length) {
    throw new Error(`lead_context missing on: ${missing.join(", ")}`);
  }

  console.log("OK: lead_context present on Campaigns and Leads.");
  await client.end();
}

main().catch((err) => {
  console.error(err.message);
  process.exitCode = 1;
});
