// Run with: node --env-file=.env migrate-demo-invited-flag.js
// npm run db:push cannot be used here: it requires a TTY.
//
// Phase 1c of specs/demo-persona-library/plan.md, the one piece of DATA the
// phase needs that does not exist yet.
//
// An invited WhatsApp demo lead and a public homepage one are indistinguishable
// today: both carry Source = 'WhatsApp Demo' and a wa-demo:<hex>
// channel_identifier. Restarting the demo as a different scenario must be
// offered ONLY on links Gabriel minted, so the mint has to mark them.
//
// A column rather than a channel_identifier prefix: the prefix is already load
// bearing in several places (is_demo_channel, the sticky-session lookup, the
// browser-demo surface guard at web_demo_routes.py:339), and widening what it
// encodes would put a behaviour switch inside a string every one of those
// call sites parses.
//
// Backfilled false for every existing row, which is the safe direction: an old
// invited lead loses an offer it never had, where the reverse would show a
// public visitor a menu meant for a prospect on a sales call.

import { Client } from "pg";

const SCHEMA = "p2mxx34fvbf3ll6";

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  await client.query(
    `ALTER TABLE "${SCHEMA}"."Leads"
       ADD COLUMN IF NOT EXISTS demo_invited boolean NOT NULL DEFAULT false`,
  );

  const { rows } = await client.query(
    `SELECT count(*)::int AS total,
            count(*) FILTER (WHERE demo_invited)::int AS invited
       FROM "${SCHEMA}"."Leads"`,
  );
  console.log(`demo_invited present. ${rows[0].total} leads, ${rows[0].invited} marked invited.`);

  const col = await client.query(
    `SELECT data_type, column_default FROM information_schema.columns
      WHERE table_schema = $1 AND table_name = 'Leads' AND column_name = 'demo_invited'`,
    [SCHEMA],
  );
  if (!col.rows.length) throw new Error("demo_invited was not created");
  console.log("OK:", col.rows[0].data_type, "default", col.rows[0].column_default);

  await client.end();
}

main().catch((err) => {
  console.error(err.message);
  process.exitCode = 1;
});
