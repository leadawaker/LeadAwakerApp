// Run with: node --env-file=.env patch-prompt91-quote-context.mjs
//
// Prompt 91 (Niche Context Generator) is the LIVE source for demo persona
// generation; the copy in server/demo-session.ts is only the fallback for when
// the row cannot be loaded. Phase 1b needs the generator to emit an example
// quote, so both have to change and this patches the row.
//
// Renames lead_context -> enquiry_context and adds quote_context. Archives the
// current text to a timestamped file first, the same way every prompt-93 edit
// does, because there is no version history on this row (version is NULL).
//
// Fails loudly if the anchor text is not found: a silent no-op here would leave
// the generator emitting a key nothing reads.

import { Client } from "pg";
import fs from "fs";

const SCHEMA = "p2mxx34fvbf3ll6";
const ID = 91;

const OLD_KEY_LINE =
  "- lead_context: ONE short sentence, in the output language, describing what this lead already told the business when they first got in touch.";

const NEW_KEY_LINE =
  "- enquiry_context: ONE short sentence, in the output language, describing what this lead already told the business when they first got in touch.";

const QUOTE_SPEC = `
- quote_context: the quote this lead is already sitting on, for the version of this conversation where one was sent. 2-4 short lines in the output language, newline-separated: a total amount in the currency of the output language's market, plausible for this niche and this job size; 2-4 line items naming the scope a real quote for this niche would itemise; and a RELATIVE date, never an absolute one ("sent about five months ago", not "sent 12 March 2026"). Optionally name the role who signs off. It must describe the SAME job as enquiry_context, priced: do not invent a different project, and do not restate the enquiry sentence.`;

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  const { rows } = await client.query(
    `SELECT prompt_text FROM "${SCHEMA}"."Prompt_Library" WHERE id = $1`,
    [ID],
  );
  if (!rows.length) throw new Error(`prompt ${ID} not found`);
  const before = rows[0].prompt_text;

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const archive = `specs/demo-persona-library/prompt91-${stamp}.txt`;
  fs.writeFileSync(archive, before);
  console.log(`archived ${before.length} chars to ${archive}`);

  if (before.includes("quote_context")) {
    console.log("quote_context already present, nothing to do");
    await client.end();
    return;
  }
  if (!before.includes(OLD_KEY_LINE)) {
    throw new Error(
      "anchor not found: the lead_context spec line has changed. Re-read the row before patching.",
    );
  }

  // Rename in place, then append the quote spec directly after that line so the
  // two contexts read as a pair in the key list.
  const renamed = before.replace(OLD_KEY_LINE, NEW_KEY_LINE);
  const lineEnd = renamed.indexOf("\n", renamed.indexOf(NEW_KEY_LINE));
  const after = renamed.slice(0, lineEnd) + QUOTE_SPEC + renamed.slice(lineEnd);

  if (after.includes("- lead_context:")) {
    throw new Error("lead_context still referenced after the rename");
  }

  await client.query(
    `UPDATE "${SCHEMA}"."Prompt_Library" SET prompt_text = $1, updated_at = now() WHERE id = $2`,
    [after, ID],
  );

  console.log(`patched prompt ${ID}: ${before.length} -> ${after.length} chars`);
  console.log("enquiry_context:", after.includes("- enquiry_context:"));
  console.log("quote_context:  ", after.includes("- quote_context:"));
  await client.end();
}

main().catch((err) => {
  console.error(err.message);
  process.exitCode = 1;
});
