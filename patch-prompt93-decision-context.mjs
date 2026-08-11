// Run with: node --env-file=.env patch-prompt93-decision-context.mjs
//
// Phase 1b of specs/demo-persona-library/plan.md, prompt half.
//
// Two additive edits inside {{#if conversation_mode == "decision"}}:
//
// 1. Its first-ever {lead_context} reference. Until now the variable appeared
//    exactly once in the whole prompt, inside the SCOPING block, where it is
//    ladder pre-fill. The engine's own comment always described a dual intent
//    ("quote detail in decision mode, ladder pre-fill in scoping mode") but only
//    the scoping half was ever written. With the Client now storing an
//    enquiry_context and a quote_context, and prompt_builder choosing between
//    them by conversation_mode, the decision branch finally has real quote
//    detail to reference.
//
// 2. Change detection. The decision block is verbatim the original Step 3 text
//    and never asks what MOVED: scope, timing, or who decides. Three questions,
//    explicitly not a ladder, explicitly bounded by the existing rules (4.3
//    decision completion, 4.8 anti-interrogation, 4.6 do not re-litigate the
//    {visit_term}).
//
// The SCOPING {lead_context} is deliberately NOT touched. Moving it would make
// the ladder re-ask things the lead already volunteered.
//
// Archives before writing and fails loudly if an anchor is missing, because
// another session also edits this row.

import { Client } from "pg";
import fs from "fs";

const SCHEMA = "p2mxx34fvbf3ll6";
const ID = 93;
const NEW_VERSION = "8.29";

const ANCHOR = "Do not assume there is a deeper issue unless the prospect clearly indicates one.";

const INSERT = `

What they are already deciding on
{lead_context}
Those are the specifics of the {proposal_term} they received. Use them the way a colleague who just pulled up the file would: in passing, at most once, and only where it helps the prospect place the conversation. Do not read the {proposal_term} back line by line, do not re-justify the figure, and do not raise the total if the prospect is talking about something else. If nothing is filled in above, talk about the {proposal_term} without inventing details: a made-up amount is worse than no amount.

What may have changed since then
A {proposal_term} that has been sitting for a while usually stalls on something that moved, not on the price. Where the prospect's own answer opens the door, find out whether:
the scope has changed (something added, dropped or postponed),
the timing has moved (a date, a season, something they were waiting on),
the same person is still making the decision.
One of these per message at most, and none of them once you already understand status, reason and next step (4.3). They count towards the three-question limit in 4.8. This is not re-qualification: 4.6 still applies, so never make the prospect repeat what was already settled at the {visit_term}.`;

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  const { rows } = await client.query(
    `SELECT prompt_text, version FROM "${SCHEMA}"."Prompt_Library" WHERE id = $1`,
    [ID],
  );
  if (!rows.length) throw new Error(`prompt ${ID} not found`);
  const before = rows[0].prompt_text;
  console.log(`current version ${rows[0].version}, ${before.length} chars`);

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const archive = `specs/demo-persona-library/prompt93-${stamp}-v${rows[0].version}.txt`;
  fs.writeFileSync(archive, before);
  console.log(`archived to ${archive}`);

  if (before.includes("What may have changed since then")) {
    console.log("already patched, nothing to do");
    await client.end();
    return;
  }

  const decisionAt = before.indexOf('{{#if conversation_mode == "decision"}}');
  if (decisionAt < 0) throw new Error("decision block not found");
  const anchorAt = before.indexOf(ANCHOR, decisionAt);
  if (anchorAt < 0) throw new Error("anchor line not found inside the decision block");

  // Guard the invariant this edit depends on: exactly one {lead_context}
  // before the change, and it must be the scoping one.
  const occurrences = (before.match(/\{lead_context\}/g) || []).length;
  if (occurrences !== 1) {
    throw new Error(`expected exactly 1 {lead_context}, found ${occurrences}`);
  }
  const scopingAt = before.indexOf('{{#if conversation_mode == "scoping"}}');
  const existingAt = before.indexOf("{lead_context}");
  if (!(existingAt > scopingAt && existingAt < decisionAt)) {
    throw new Error("the existing {lead_context} is not where the scoping block is");
  }

  const cut = anchorAt + ANCHOR.length;
  const after = before.slice(0, cut) + INSERT + before.slice(cut);

  await client.query(
    `UPDATE "${SCHEMA}"."Prompt_Library"
        SET prompt_text = $1, version = $2, updated_at = now()
      WHERE id = $3`,
    [after, NEW_VERSION, ID],
  );

  console.log(`patched: ${before.length} -> ${after.length} chars, version ${NEW_VERSION}`);
  console.log("{lead_context} count now:", (after.match(/\{lead_context\}/g) || []).length);
  await client.end();
}

main().catch((err) => {
  console.error(err.message);
  process.exitCode = 1;
});
