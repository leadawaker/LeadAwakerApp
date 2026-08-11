// Run with: node --env-file=.env migrate-demo-client-persona-columns.js
// npm run db:push cannot be used here: it requires a TTY.
//
// Adds the Niche_Vocabulary columns that turn a niche row into a saved demo
// persona (a "Client"): specs/demo-persona-library/plan.md, phase 1.
//
// These were applied to the live Pi database by hand while phase 1 was being
// built, so on that box this script is a verified no-op. It exists because
// nothing else records them: a fresh database built from this repo would get
// the schema.ts declarations with no matching table, and every Clients query
// would fail on a missing column.
//
// scoping_ladder and opener_phrase are in the list even though they predate
// this feature. They were created by the universal-demo work through raw SQL
// and never declared in schema.ts or any migration, so a rebuild is missing
// them too. IF NOT EXISTS makes including them free.
//
// Additive and idempotent: every column is nullable with a default, no
// backfill. An untouched row reads as an empty slot, which is exactly what the
// pre-existing curated niche rows should look like to the Clients tab: word
// lists with no persona, listed but not deletable.

import { Client } from "pg";

const SCHEMA = "p2mxx34fvbf3ll6";
const TABLE = "Niche_Vocabulary";

// Per-language text slots ({en,nl,pt}), read through pick() with fallback.
const TEXT_SLOTS = [
  "scoping_ladder",
  "opener_phrase",
  "niche_label",
  "service_name",
  "usp",
  "niche_question",
  "first_message",
  "lead_context",
  "when_label",
];

// Portuguese term lists. nl is the bare column and en is the _en suffix, both
// of which already existed; without these a re-picked Brazilian Client came
// back speaking Dutch.
const TERM_LISTS = [
  "project_terms_pt",
  "proposal_terms_pt",
  "decision_terms_pt",
  "advisor_terms_pt",
  "visit_terms_pt",
];

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  for (const col of TEXT_SLOTS) {
    await client.query(
      `ALTER TABLE "${SCHEMA}"."${TABLE}" ADD COLUMN IF NOT EXISTS ${col} jsonb DEFAULT '{}'::jsonb`,
    );
  }

  for (const col of TERM_LISTS) {
    await client.query(
      `ALTER TABLE "${SCHEMA}"."${TABLE}" ADD COLUMN IF NOT EXISTS ${col} jsonb DEFAULT '[]'::jsonb`,
    );
  }

  // Does this niche close on a call or an on-site visit? Part of the persona
  // rather than the run, so it lives on the row.
  await client.query(
    `ALTER TABLE "${SCHEMA}"."${TABLE}" ADD COLUMN IF NOT EXISTS booking_mode_call boolean DEFAULT false`,
  );

  // Was this row saved by minting a demo, or is it one of the curated niche
  // packs that real campaigns read? Only the former may be deleted from the
  // Clients tab. This is an explicit flag and not an inference: every curated
  // row already carries description_template (the campaign business-profile
  // pre-fill seeded them), so "has a description" does NOT distinguish them,
  // and a delete guard built on that predicate would have let the tab remove
  // all 16 shared vocabularies.
  await client.query(
    `ALTER TABLE "${SCHEMA}"."${TABLE}" ADD COLUMN IF NOT EXISTS is_demo_client boolean DEFAULT false`,
  );

  // Backfill: a saved Client always has an opener, and no curated row does
  // (first_message is new in this migration, so nothing predating it can have
  // one). That makes this safe to run on the live table, where phase 1 already
  // saved Clients through the hand-applied columns.
  const { rowCount } = await client.query(
    `UPDATE "${SCHEMA}"."${TABLE}"
        SET is_demo_client = true
      WHERE is_demo_client IS NOT TRUE
        AND coalesce(first_message::text, '{}') <> '{}'`,
  );
  console.log(`backfilled is_demo_client on ${rowCount} row(s) with an opener.`);

  const expected = [...TEXT_SLOTS, ...TERM_LISTS, "booking_mode_call", "is_demo_client"];
  const { rows } = await client.query(
    `SELECT column_name, data_type, column_default
       FROM information_schema.columns
      WHERE table_schema = $1
        AND table_name = $2
        AND column_name = ANY($3)
      ORDER BY column_name`,
    [SCHEMA, TABLE, expected],
  );
  console.table(rows);

  const got = rows.map((r) => r.column_name);
  const missing = expected.filter((c) => !got.includes(c));
  if (missing.length) {
    throw new Error(`still missing on ${TABLE}: ${missing.join(", ")}`);
  }

  console.log(`OK: all ${expected.length} persona columns present on ${TABLE}.`);
  await client.end();
}

main().catch((err) => {
  console.error(err.message);
  process.exitCode = 1;
});
