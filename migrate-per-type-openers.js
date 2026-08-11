// Run with: node --env-file=.env migrate-per-type-openers.js
// npm run db:push cannot be used here: it requires a TTY.
//
// Phase 2 of specs/demo-persona-library/plan.md: one opener per conversation
// type, instead of one opener for both.
//
// The demo has always sent the SAME first message whether the lead had a quote
// or not, which is wrong in opposite directions. A lead who only ever enquired
// does not know the company well enough to be addressed as a known contact, so
// the opener has to verify identity first. A lead sitting on a quote already
// knows exactly who is writing, so verifying identity there reads as amnesia.
//
// Two columns, both additive, nothing existing reinterpreted:
//
// 1. Campaigns.first_message_scoping — the opener used when conversation_mode
//    resolves to "scoping" (no quote exists yet). First_Message stays exactly
//    what it is today: the universal fallback, and the decision-mode opener.
//    That direction was chosen deliberately. Campaign 60's current text is
//    already the decision shape ("you reached out and it never went ahead"),
//    the public homepage form defaults to the quoted scenario, and every other
//    campaign in the system has one opener and should keep behaving identically
//    until someone fills this column in. A campaign that never sets it loses
//    nothing.
//
// 2. Opener_Templates.type — scoping | decision | both. The picker filters to
//    the type being edited so the operator is not handed a "your quote is still
//    open" opener for a lead who was never quoted. "both" is a real answer, not
//    a cop-out: most of the 11 archetypes name neither an enquiry nor a quote
//    and work either way. Only the ones that commit are typed.
//
// Also seeds template L (the identity-verification opener the plan specifies)
// and fills campaign 60's new column with its disclosure-carrying variant.
// Without both, picking "Inquiry" in the UI would show a near-empty library and
// send the decision opener anyway, which is the bug this phase exists to fix.

import { Client } from "pg";

const SCHEMA = "p2mxx34fvbf3ll6";
const UNIVERSAL_DEMO_CAMPAIGN_ID = 60;

// Typed only where the copy commits to a quote existing (or not). Everything
// else stays "both" — see the note above.
const TEMPLATE_TYPES = {
  B: "decision", // "going through past quotes"
  E: "decision", // "your quote is still open on our end"
  G: "decision", // "the quote for your project is outdated by now"
  C: "scoping",  // "not even sure this number is still yours / you once asked"
  K: "scoping",  // "since your project inquiry"
};

// The scoping archetype the plan asks for: identity verification, because a lead
// who only ever filled in a form does not recognise the sender. Uses {business}
// like its 11 siblings; the campaign-level copy below carries the disclosure
// clause instead (none of the library templates do — see the save-time-guard
// item in the plan's backlog).
const TEMPLATE_L = {
  id: "L",
  sort_order: 12,
  type: "scoping",
  title_en: "Identity check (never quoted)",
  title_nl: "Identiteitscheck (nooit geofferteerd)",
  body_en:
    "Hi {first_name}, {business} here. Are you the same {first_name} who reached out about your {project} a while back? We never did get a quote over to you.",
  body_nl:
    "Hoi {first_name}, {business} hier. Ben jij dezelfde {first_name} die een tijd geleden contact opnam over je {project}? We hebben je toen nooit een offerte gestuurd.",
};

// Campaign 60's scoping opener. Same shape as template L plus {agent_name} and
// {disclosure_clause}, matching the existing First_Message on that row.
const CAMPAIGN_60_SCOPING = {
  en: "Hi {first_name}, this is {agent_name}, {disclosure_clause}. Are you the same {first_name} who reached out to us about your {project} a while back? We never did get a quote over to you.",
  nl: "Hoi {first_name}, dit is {agent_name}, {disclosure_clause}. Ben jij dezelfde {first_name} die een tijd geleden contact met ons opnam over je {project}? We hebben je toen nooit een offerte gestuurd.",
};

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  await client.query(
    `ALTER TABLE "${SCHEMA}"."Campaigns" ADD COLUMN IF NOT EXISTS first_message_scoping text`,
  );
  await client.query(
    `ALTER TABLE "${SCHEMA}"."Opener_Templates" ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'both'`,
  );
  console.log("columns ok");

  for (const [id, type] of Object.entries(TEMPLATE_TYPES)) {
    const r = await client.query(
      `UPDATE "${SCHEMA}"."Opener_Templates" SET type = $1, updated_at = now() WHERE id = $2`,
      [type, id],
    );
    console.log(`  ${id} -> ${type}${r.rowCount ? "" : "  (NOT FOUND)"}`);
  }

  const t = TEMPLATE_L;
  await client.query(
    `INSERT INTO "${SCHEMA}"."Opener_Templates"
       (id, sort_order, type, title_en, title_nl, body_en, body_nl, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, now())
     ON CONFLICT (id) DO NOTHING`,
    [t.id, t.sort_order, t.type, t.title_en, t.title_nl, t.body_en, t.body_nl],
  );

  // Never overwrite an authored opener: a re-run must not clobber an edit made
  // in the UI between now and then.
  const camp = await client.query(
    `UPDATE "${SCHEMA}"."Campaigns"
        SET first_message_scoping = $1, updated_at = now()
      WHERE id = $2 AND coalesce(first_message_scoping, '') = ''`,
    [JSON.stringify(CAMPAIGN_60_SCOPING), UNIVERSAL_DEMO_CAMPAIGN_ID],
  );
  console.log(`campaign ${UNIVERSAL_DEMO_CAMPAIGN_ID} scoping opener: ${camp.rowCount ? "set" : "already authored, left alone"}`);

  const check = await client.query(
    `SELECT id, type, title_en FROM "${SCHEMA}"."Opener_Templates" ORDER BY sort_order`,
  );
  console.log("\ntemplates:");
  for (const r of check.rows) console.log(`  [${r.id}] ${r.type.padEnd(9)} ${r.title_en}`);

  const c60 = await client.query(
    `SELECT first_message_scoping IS NOT NULL AS has_scoping FROM "${SCHEMA}"."Campaigns" WHERE id = $1`,
    [UNIVERSAL_DEMO_CAMPAIGN_ID],
  );
  if (!c60.rows[0]?.has_scoping) throw new Error("campaign 60 has no first_message_scoping");
  console.log("\nOK");

  await client.end();
}

main().catch((err) => {
  console.error(err.message);
  process.exitCode = 1;
});
