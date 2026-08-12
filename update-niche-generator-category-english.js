// Run with: node --env-file=.env update-niche-generator-category-english.js
//
// Patches the LIVE Prompt_Library row that backs generateNicheContext()
// (server/demo-session.ts) so the `category` field the model returns is
// always written in English, regardless of the demo's output language.
// Without this, a non-English demo (e.g. Portuguese) mints a
// language-local category name ("Ciclismo & Mobilidade") instead of
// reusing one of the English category names already seeded in the DB
// ("Climate & Energy" etc.), fragmenting the Clients grid's grouping.
//
// Mirrors update-niche-generator-prompt-emoji-category.js's pattern (same
// connection, same table/schema/use_case), which already ran once for the
// emoji+category keys and is idempotent on "- emoji:" already being
// present — so it will NOT add this sentence on a re-run. This is a
// separate, new patch, idempotent on its OWN sentence instead.
//
// Prompt_Library is the actual production source of truth — the in-file
// NICHE_GENERATOR_SYSTEM_FALLBACK constant in server/demo-session.ts only
// fires if this DB read fails — so editing the in-file constant alone does
// not change what a real demo generates until this script also runs.

import { Client } from "pg";

const USE_CASE = "universal_demo_niche_generator";
const SCHEMA = "p2mxx34fvbf3ll6";
const TABLE = "Prompt_Library";

const IDEMPOTENCY_MARKER = "Always write the category in English";

// Stable anchor substring inside the live row's `- category:` bullet line.
// Deliberately a substring, not the full line: the live row's exact
// category-bullet text may have drifted slightly in formatting from the
// in-file NICHE_GENERATOR_SYSTEM_FALLBACK constant.
const ANCHOR_SUBSTRING = "a short category name (1-3 words) grouping this niche";

const APPEND_SENTENCE =
  ' Always write the category in English, regardless of the output language — it is an internal grouping key, never shown to the lead.';

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  try {
    const { rows } = await client.query(
      `SELECT id, prompt_text FROM "${SCHEMA}"."${TABLE}" WHERE use_case = $1 LIMIT 1`,
      [USE_CASE],
    );
    if (rows.length === 0) {
      throw new Error(`No Prompt_Library row with use_case="${USE_CASE}". Nothing to update.`);
    }
    const { id, prompt_text: text } = rows[0];

    if (text.includes(IDEMPOTENCY_MARKER)) {
      console.log(`Row ${id} already contains "${IDEMPOTENCY_MARKER}". No-op.`);
      return;
    }

    const anchorIndex = text.indexOf(ANCHOR_SUBSTRING);
    if (anchorIndex === -1) {
      throw new Error(
        `Could not find the anchor substring "${ANCHOR_SUBSTRING}" in Prompt_Library row ${id}'s ` +
          `prompt_text. The live row has drifted too far to safely auto-patch — edit it by hand in the ` +
          `Prompt Library UI instead, appending this sentence to the end of the "- category:" bullet's line ` +
          `(before its trailing newline):\n\n${APPEND_SENTENCE.trim()}`,
      );
    }

    // Find the end of the LINE containing the anchor (up to, but not
    // including, the newline that ends it), and insert the sentence there.
    let lineEnd = text.indexOf("\n", anchorIndex);
    if (lineEnd === -1) lineEnd = text.length;

    const updated = text.slice(0, lineEnd) + APPEND_SENTENCE + text.slice(lineEnd);

    await client.query(`UPDATE "${SCHEMA}"."${TABLE}" SET prompt_text = $1 WHERE id = $2`, [updated, id]);
    console.log(`Updated Prompt_Library row ${id} (${USE_CASE}): category bullet now requires English output.`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exitCode = 1;
});
