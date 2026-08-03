// One-off: set bilingual {"en","nl"} bump templates on demo campaigns 60 (Universal)
// and 61 (Discovery). Run AFTER the engine restart so resolve_demo_template is live.
//   node --env-file=.env migrate-demo-bump-bilingual.js
import pkg from "pg";
const { Client } = pkg;

const SCHEMA = "p2mxx34fvbf3ll6";

// Bumps 1/3/4 are niche-neutral. Bump 2 is also kept niche-neutral: these are
// only the fallback (demo bumps are AI-first, and the AI reshapes tone/phrasing
// per niche). A {project_term} placeholder here could only make the fallback
// sound wrong for recurring/membership niches (yoga, gym, SaaS), so it's dropped.
const BUMPS = {
  bump_1_template: { en: "Hi {first_name}! Just checking in, I figured you got busy before.", nl: "Hoi {first_name}! Even een berichtje, ik denk dat je het druk had." },
  bump_2_template: { en: "What's holding you back from moving forward?", nl: "Wat houdt je nog tegen?" },
  bump_3_template: { en: "Is it a trust thing?", nl: "Is het een kwestie van vertrouwen?" },
  bump_4_template: { en: "I won't bother you anymore {first_name}. If you ever need to discuss it in the future, I will be here for you :)", nl: "Ik zal je niet langer lastigvallen {first_name}. Mocht je er in de toekomst nog eens over willen praten, dan weet je me te vinden :)" },
};

const C60 = BUMPS; // Universal Demo
const C61 = BUMPS; // Discovery Demo

async function apply(client, id, fields) {
  for (const [col, val] of Object.entries(fields)) {
    await client.query(
      `UPDATE ${SCHEMA}."Campaigns" SET "${col}" = $1 WHERE id = $2`,
      [JSON.stringify(val), id],
    );
  }
}

const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  await apply(client, 60, C60);
  await apply(client, 61, C61);
  const { rows } = await client.query(
    `SELECT id, bump_1_template, bump_2_template FROM ${SCHEMA}."Campaigns" WHERE id IN (60, 61) ORDER BY id`,
  );
  console.log(JSON.stringify(rows, null, 2));
  console.log("OK: campaigns 60/61 bilingual bump templates set");
} finally {
  await client.end();
}
