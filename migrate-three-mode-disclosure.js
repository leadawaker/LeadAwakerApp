// Run with: node --env-file=.env migrate-three-mode-disclosure.js
// npm run db:push cannot be used here: it requires a TTY.
//
// Three-mode ai_disclosure migration + the live-bug data fix it depends on.
//
// 1. ai_disclosure 'on' -> 'opener'. Campaign 60 is the only 'on' row, so the
//    blast radius is one row. The engine ALSO keeps 'on' as a permanent alias
//    in normalize_ai_disclosure() (see src/automations/_helpers.py) because the
//    failure mode of an unrecognised value is "off" = silent non-disclosure,
//    which is the exact compliance bug this work exists to fix. Migrating is
//    the primary fix; the alias is the safety net, not a substitute.
//
// 2. THE LIVE BUG. Campaign 60 ("Universal Demo", the public leadawaker.com
//    demo) was set to ai_disclosure='on' and disclosed NOWHERE AT ALL, because
//    its First_Message carries no {disclosure_clause} token and the render path
//    only ever SUBSTITUTES tokens, it never INJECTS them. Prompt 93's on-branch
//    then correctly told the model the opener had already disclosed and to skip
//    it, so neither message disclosed. This rewrites the opener so the token is
//    actually present, in both authored languages.
//
//    The rewritten opener is token-shaped so it reads correctly in ALL THREE
//    modes, because campaign 60 serves all three markets:
//      opener          -> "Hi Sam, this is Mark, the AI assistant at Acme. ..."
//      off / second_message -> "Hi Sam, this is Mark, from Acme. ..."
//    build_disclosure_clause() picks the wording; the sentence around it is
//    unchanged either way. {business} is dropped from the greeting because the
//    company name now arrives inside {disclosure_clause}, and naming it twice
//    in one sentence reads as broken.
//
// Idempotent: the UPDATEs are guarded by WHERE clauses that stop matching once
// applied, and each reports its row count.
import { Client } from "pg";

const SCHEMA = "p2mxx34fvbf3ll6";

const NEW_FIRST_MESSAGE_60 = JSON.stringify({
  en: "Hi {first_name}, this is {agent_name}, {disclosure_clause}. You reached out about your {project} a while back and it never went ahead. We were curious: is that still on your radar?",
  nl: "Hoi {first_name}, dit is {agent_name}, {disclosure_clause}. Je nam een tijd geleden contact met ons op over je {project}, maar het is er destijds niet van gekomen. We waren benieuwd: staat dat nog op de planning?",
});

const STATEMENTS = [
  [
    "migrate ai_disclosure 'on' -> 'opener'",
    `UPDATE "${SCHEMA}"."Campaigns" SET ai_disclosure = 'opener' WHERE ai_disclosure = 'on'`,
  ],
  [
    "campaign 60 First_Message gains {disclosure_clause} (THE LIVE BUG)",
    `UPDATE "${SCHEMA}"."Campaigns" SET "First_Message" = $1
       WHERE id = 60 AND "First_Message" NOT LIKE '%{disclosure_clause}%'`,
    [NEW_FIRST_MESSAGE_60],
  ],
];

(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();

  const before = await c.query(
    `SELECT id, name, ai_disclosure, "First_Message" FROM "${SCHEMA}"."Campaigns" ORDER BY id`
  );
  console.log("=== BEFORE ===");
  for (const r of before.rows) {
    console.log(`${r.id} ${r.name}: ai_disclosure=${r.ai_disclosure} has_token=${r.First_Message?.includes("{disclosure_clause}")}`);
  }

  for (const [label, sql, params] of STATEMENTS) {
    const res = await c.query(sql, params ?? []);
    console.log(`OK (${res.rowCount} row(s)): ${label}`);
  }

  const after = await c.query(
    `SELECT id, name, ai_disclosure, "First_Message" FROM "${SCHEMA}"."Campaigns" ORDER BY id`
  );
  console.log("=== AFTER ===");
  for (const r of after.rows) {
    console.log(`${r.id} ${r.name}: ai_disclosure=${r.ai_disclosure} has_token=${r.First_Message?.includes("{disclosure_clause}")}`);
  }

  await c.end();
  process.exit(0);
})().catch((e) => {
  console.error("FAILED:", e.message);
  process.exit(1);
});
