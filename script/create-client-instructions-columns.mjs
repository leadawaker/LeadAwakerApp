// Adds the columns that let a change card in Voice_Prompt_Suggestions target more than a find/replace on a shared
// prompt row: a scope (shared prompt, one client's phone instructions, a knowledge entry, a Voice tab setting), an
// edit op (replace or add), the knowledge entry it touches with what Undo needs, and the setting key with its
// old and new value. prompts_id and language lose NOT NULL because client, knowledge and setting cards have no
// shared prompt row or language. Purely additive and idempotent: ADD COLUMN IF NOT EXISTS only, and DROP NOT NULL
// is a no-op once dropped. Every existing row keeps its values and reads as scope 'shared', edit_op 'replace'.
// Run: node --env-file=.env script/create-client-instructions-columns.mjs
import pg from "pg";

const SCHEMA = "p2mxx34fvbf3ll6"; // nocodb pgSchema (matches shared/schema.ts)
const T = `"${SCHEMA}"."Voice_Prompt_Suggestions"`;

const sql = `
ALTER TABLE ${T}
  ADD COLUMN IF NOT EXISTS "scope" text NOT NULL DEFAULT 'shared',   -- shared | client | knowledge | setting
  ADD COLUMN IF NOT EXISTS "edit_op" text NOT NULL DEFAULT 'replace', -- replace | add
  ADD COLUMN IF NOT EXISTS "kb_id" integer,                          -- the entry edited, or the entry an add card created
  ADD COLUMN IF NOT EXISTS "kb_title" text,                          -- the entry's title when proposed, or the new title
  ADD COLUMN IF NOT EXISTS "kb_category" text,                       -- add: the new entry's category
  ADD COLUMN IF NOT EXISTS "kb_prev_title" text,                     -- edit: the entry as it was right before Accept, for Undo
  ADD COLUMN IF NOT EXISTS "kb_prev_content" text,
  ADD COLUMN IF NOT EXISTS "setting_key" text,
  ADD COLUMN IF NOT EXISTS "setting_old" jsonb,                      -- the value the card was made against, and what Undo writes back
  ADD COLUMN IF NOT EXISTS "setting_new" jsonb;
ALTER TABLE ${T} ALTER COLUMN "prompts_id" DROP NOT NULL;
ALTER TABLE ${T} ALTER COLUMN "language" DROP NOT NULL;
`;

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
try {
  await pool.query(sql);
  const { rows } = await pool.query(
    `SELECT count(*)::int AS columns FROM information_schema.columns WHERE table_schema = $1 AND table_name = $2`,
    [SCHEMA, "Voice_Prompt_Suggestions"],
  );
  console.log(`Voice_Prompt_Suggestions: ${rows[0].columns} columns`);
} finally {
  await pool.end();
}
