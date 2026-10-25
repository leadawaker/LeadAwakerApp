// Creates the voice call review and prompt coach tables: weekly/manual AI reviews of ElevenLabs phone calls,
// the change cards (suggestions) they and the coach chat propose, the per-prompt draft text, and the coach chat
// history. Purely additive and idempotent: CREATE ... IF NOT EXISTS only, no existing table or row is touched.
// Every table is inert until the new code reads it.
// Run: node --env-file=.env script/create-voice-review-tables.mjs
import pg from "pg";

const SCHEMA = "p2mxx34fvbf3ll6"; // nocodb pgSchema (matches shared/schema.ts)
const S = `"${SCHEMA}"`;

const sql = `
-- ─── Reviews (one per account and week, or a manual run over a chosen period) ───
CREATE TABLE IF NOT EXISTS ${S}."Voice_Reviews" (
  "id" serial PRIMARY KEY,
  "accounts_id" integer NOT NULL,
  "kind" text NOT NULL,
  "week_key" text,
  "period_start" timestamptz NOT NULL,
  "period_end" timestamptz NOT NULL,
  "status" text NOT NULL DEFAULT 'running',
  "attempts" integer NOT NULL DEFAULT 1,
  "stats" jsonb NOT NULL DEFAULT '{}',
  "report" jsonb,
  "error" text,
  "model" text,
  "started_at" timestamptz NOT NULL DEFAULT now(),
  "finished_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "voice_reviews_weekly_week" ON ${S}."Voice_Reviews" ("accounts_id", "week_key") WHERE "kind" = 'weekly';
CREATE INDEX IF NOT EXISTS "voice_reviews_account_created_idx" ON ${S}."Voice_Reviews" ("accounts_id", "created_at");

-- ─── Change cards (find/replace proposals on a prompt row, from a review or from the coach chat) ───
CREATE TABLE IF NOT EXISTS ${S}."Voice_Prompt_Suggestions" (
  "id" serial PRIMARY KEY,
  "accounts_id" integer NOT NULL,
  "source" text NOT NULL,
  "review_id" integer,
  "coach_message_id" integer,
  "prompts_id" integer NOT NULL,
  "language" text NOT NULL,
  "title" text NOT NULL,
  "reason" text NOT NULL,
  "find_text" text NOT NULL,
  "replace_text" text NOT NULL,
  "mirror_prompts_id" integer,
  "mirror_find_text" text,
  "mirror_replace_text" text,
  "evidence_call_ids" text[] NOT NULL DEFAULT '{}',
  "status" text NOT NULL DEFAULT 'proposed',
  "status_note" text,
  "decided_by" text,
  "decided_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "voice_prompt_suggestions_account_status_idx" ON ${S}."Voice_Prompt_Suggestions" ("accounts_id", "status");

-- ─── Drafts (one per prompt row: the working copy that "Save to live" publishes) ───
CREATE TABLE IF NOT EXISTS ${S}."Voice_Prompt_Drafts" (
  "id" serial PRIMARY KEY,
  "prompts_id" integer NOT NULL,
  "use_case" text NOT NULL,
  "draft_text" text NOT NULL,
  "base_text" text NOT NULL,
  "accepted_ids" integer[] NOT NULL DEFAULT '{}',
  "updated_by" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "voice_prompt_drafts_prompt" ON ${S}."Voice_Prompt_Drafts" ("prompts_id");

-- ─── Coach chat history (per account) ───
CREATE TABLE IF NOT EXISTS ${S}."Voice_Coach_Messages" (
  "id" serial PRIMARY KEY,
  "accounts_id" integer NOT NULL,
  "role" text NOT NULL,
  "content" text NOT NULL,
  "suggestion_ids" integer[] NOT NULL DEFAULT '{}',
  "created_by" text,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "voice_coach_messages_account_created_idx" ON ${S}."Voice_Coach_Messages" ("accounts_id", "created_at");
`;

const TABLES = ["Voice_Reviews", "Voice_Prompt_Suggestions", "Voice_Prompt_Drafts", "Voice_Coach_Messages"];

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
try {
  await pool.query(sql);
  const { rows } = await pool.query(
    `SELECT table_name, count(*)::int AS columns FROM information_schema.columns
     WHERE table_schema = $1 AND table_name = ANY($2) GROUP BY table_name ORDER BY table_name`,
    [SCHEMA, TABLES],
  );
  for (const r of rows) console.log(`${r.table_name}: ${r.columns} columns`);
  const idx = await pool.query(
    `SELECT indexname FROM pg_indexes WHERE schemaname = $1 AND tablename = ANY($2) ORDER BY 1`,
    [SCHEMA, TABLES],
  );
  console.log("indexes:", idx.rows.map((r) => r.indexname).join(", "));
} finally {
  await pool.end();
}
