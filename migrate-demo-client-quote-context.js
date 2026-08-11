// Run with: node --env-file=.env migrate-demo-client-quote-context.js
// npm run db:push cannot be used here: it requires a TTY.
//
// Phase 1b of specs/demo-persona-library/plan.md: split the Client's single
// context field in two.
//
// Why one field cannot work. A Client is meant to be REUSED across conversation
// types, and the prompt reads {lead_context} for two different jobs:
//
//   scoping  (no quote exists yet) -> ladder pre-fill: skip the slots the lead
//                                     already answered when they enquired
//   decision (a quote was sent)    -> change detection: reference the actual
//                                     quote, its line items and its date
//
// Store an enquiry there and flip the persona to quoted, and the AI talks about
// an enquiry in a conversation about a quote. Store a quote instead and the
// scoping ladder gets pre-filled with line items from a quote that by
// definition does not exist yet. So the row holds BOTH, and the engine puts the
// right one into the single {lead_context} variable based on conversation_mode
// (src/automations/conversation/prompt_builder.py).
//
// lead_context is RENAMED rather than dropped and re-added: it is the same
// field, narrowed to the enquiry half. Verified empty on every row before
// writing this, so nothing is being reinterpreted in place.
//
// Note this renames the column on Niche_Vocabulary ONLY. Campaigns.lead_context
// and Leads.lead_context keep their names: those are the real per-campaign and
// per-lead overrides the engine resolves lead-first, campaign-second, and they
// are not part of a demo persona.

import { Client } from "pg";

const SCHEMA = "p2mxx34fvbf3ll6";
const TABLE = "Niche_Vocabulary";

async function has(client, column) {
  const { rows } = await client.query(
    `SELECT 1 FROM information_schema.columns
      WHERE table_schema = $1 AND table_name = $2 AND column_name = $3`,
    [SCHEMA, TABLE, column],
  );
  return rows.length > 0;
}

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  const hasOld = await has(client, "lead_context");
  const hasNew = await has(client, "enquiry_context");

  if (hasOld && !hasNew) {
    await client.query(
      `ALTER TABLE "${SCHEMA}"."${TABLE}" RENAME COLUMN lead_context TO enquiry_context`,
    );
    console.log("renamed lead_context -> enquiry_context");
  } else if (!hasNew) {
    // Fresh database: migrate-demo-client-persona-columns.js has not run, or
    // ran a version that never created the old name.
    await client.query(
      `ALTER TABLE "${SCHEMA}"."${TABLE}" ADD COLUMN enquiry_context jsonb DEFAULT '{}'::jsonb`,
    );
    console.log("created enquiry_context");
  } else {
    console.log("enquiry_context already present, nothing to rename");
  }

  await client.query(
    `ALTER TABLE "${SCHEMA}"."${TABLE}" ADD COLUMN IF NOT EXISTS quote_context jsonb DEFAULT '{}'::jsonb`,
  );

  const { rows } = await client.query(
    `SELECT column_name, data_type, column_default
       FROM information_schema.columns
      WHERE table_schema = $1 AND table_name = $2
        AND column_name IN ('enquiry_context', 'quote_context', 'lead_context')
      ORDER BY column_name`,
    [SCHEMA, TABLE],
  );
  console.table(rows);

  const got = rows.map((r) => r.column_name);
  for (const col of ["enquiry_context", "quote_context"]) {
    if (!got.includes(col)) throw new Error(`${col} missing on ${TABLE}`);
  }
  if (got.includes("lead_context")) {
    throw new Error(`lead_context still on ${TABLE}: the rename did not take`);
  }

  console.log("OK: enquiry_context + quote_context present, lead_context gone.");
  await client.end();
}

main().catch((err) => {
  console.error(err.message);
  process.exitCode = 1;
});
