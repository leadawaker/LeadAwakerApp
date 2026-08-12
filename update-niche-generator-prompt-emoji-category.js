// Run with: node --env-file=.env update-niche-generator-prompt-emoji-category.js
//
// Adds the emoji + category keys to the LIVE Prompt_Library row that backs
// generateNicheContext() (server/demo-session.ts). Prompt_Library is the
// actual source of truth in production — NICHE_GENERATOR_SYSTEM_FALLBACK only
// fires if this DB read fails — so editing the in-file constant alone (done in
// the prior commit) does not change what a real demo generates until this
// script also runs.
//
// Idempotent: no-ops if the row already documents the "emoji" key.

import { Client } from "pg";

const USE_CASE = "universal_demo_niche_generator";

const ANCHOR =
  /(advisor_term, project_term, proposal_term, visit_term and decision_term MUST be in the output language and natural for the niche\.\n)/;

const NEW_LINES =
  `- emoji: ONE emoji that best represents this niche visually (e.g. "☀️" for solar, "🍳" for kitchens). Return a single emoji character, no text.\n` +
  `- category: a short category name (1-3 words) grouping this niche with similar ones (e.g. "Climate & Energy", "Kitchens & Interiors"). If the caller lists EXISTING CATEGORIES below, reuse one of them when it genuinely fits this niche; only invent a new one if none do.\n`;

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  try {
    const { rows } = await client.query(
      `SELECT id, prompt_text FROM "p2mxx34fvbf3ll6"."Prompt_Library" WHERE use_case = $1 LIMIT 1`,
      [USE_CASE],
    );
    if (rows.length === 0) {
      throw new Error(`No Prompt_Library row with use_case="${USE_CASE}". Nothing to update.`);
    }
    const { id, prompt_text: text } = rows[0];

    if (text.includes("- emoji:")) {
      console.log(`Row ${id} already documents the emoji key. No-op.`);
      return;
    }

    if (!ANCHOR.test(text)) {
      throw new Error(
        `Could not find the decision_term anchor sentence in row ${id}'s prompt_text. ` +
          `The live row has drifted from NICHE_GENERATOR_SYSTEM_FALLBACK — edit it by hand in the Prompt Library UI instead, ` +
          `pasting in:\n\n${NEW_LINES}`,
      );
    }

    const updated = text.replace(ANCHOR, (match) => match + NEW_LINES);

    await client.query(`UPDATE "p2mxx34fvbf3ll6"."Prompt_Library" SET prompt_text = $1 WHERE id = $2`, [updated, id]);
    console.log(`Updated Prompt_Library row ${id} (${USE_CASE}) with emoji + category keys.`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exitCode = 1;
});
