// Creates the Socials studio tables (settings, topics, scripts, HeyGen pulls) and the comment-to-DM
// tables (rules, webhook events, DM log, opt-outs). Purely additive and idempotent: CREATE ... IF NOT
// EXISTS only, no existing table or row is touched. Every table is inert until the new code reads it.
// Run: node --env-file=.env script/create-social-studio-tables.mjs
import pg from "pg";

const SCHEMA = "p2mxx34fvbf3ll6"; // nocodb pgSchema (matches shared/schema.ts)
const S = `"${SCHEMA}"`;

const sql = `
-- ─── Studio (Phase B) ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ${S}."Social_Settings" (
  "id" serial PRIMARY KEY,
  "accounts_id" integer NOT NULL,
  "caption_style" text NOT NULL DEFAULT '',
  "voice_guide" text NOT NULL DEFAULT '',
  "about_me" text NOT NULL DEFAULT '',
  "dm_mode" text NOT NULL DEFAULT 'off',
  "dm_hourly_cap" integer NOT NULL DEFAULT 20,
  "updated_by_user_id" integer,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "social_settings_accounts_id" ON ${S}."Social_Settings" ("accounts_id");

CREATE TABLE IF NOT EXISTS ${S}."Social_Topics" (
  "id" serial PRIMARY KEY,
  "accounts_id" integer NOT NULL,
  "text" text NOT NULL,
  "source" text NOT NULL DEFAULT 'typed',
  "status" text NOT NULL DEFAULT 'new',
  "script_id" integer,
  "created_by_user_id" integer,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "social_topics_accounts_id_idx" ON ${S}."Social_Topics" ("accounts_id");

CREATE TABLE IF NOT EXISTS ${S}."Social_Scripts" (
  "id" serial PRIMARY KEY,
  "accounts_id" integer NOT NULL,
  "title" text NOT NULL,
  "body" text NOT NULL DEFAULT '',
  "status" text NOT NULL DEFAULT 'idea',
  "topic_id" integer,
  "post_id" integer,
  "video_upload_id" text,
  "heygen_video_id" text,
  "review_status" text NOT NULL DEFAULT 'none',
  "review_note" text,
  "reviewed_by_user_id" integer,
  "reviewed_at" timestamptz,
  "seed_key" text,
  "created_by_user_id" integer,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "social_scripts_accounts_id_idx" ON ${S}."Social_Scripts" ("accounts_id");
CREATE UNIQUE INDEX IF NOT EXISTS "social_scripts_account_seed_key" ON ${S}."Social_Scripts" ("accounts_id", "seed_key") WHERE "seed_key" IS NOT NULL;

CREATE TABLE IF NOT EXISTS ${S}."Social_Heygen_Pulls" (
  "id" serial PRIMARY KEY,
  "accounts_id" integer NOT NULL,
  "heygen_video_id" text NOT NULL,
  "script_id" integer,
  "upload_id" text NOT NULL,
  "pulled_by_user_id" integer,
  "pulled_at" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "social_heygen_pulls_account_video" ON ${S}."Social_Heygen_Pulls" ("accounts_id", "heygen_video_id");

-- ─── Comment-to-DM (Phase C) ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ${S}."Social_Dm_Rules" (
  "id" serial PRIMARY KEY,
  "accounts_id" integer NOT NULL,
  "post_id" integer,
  "ig_media_id" text,
  "keyword" text NOT NULL,
  "keyword_norm" text NOT NULL,
  "first_message" text NOT NULL,
  "ai_follow_up" boolean NOT NULL DEFAULT false,
  "active" boolean NOT NULL DEFAULT true,
  "created_by_user_id" integer,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "social_dm_rules_accounts_id_idx" ON ${S}."Social_Dm_Rules" ("accounts_id");

CREATE TABLE IF NOT EXISTS ${S}."Social_Webhook_Events" (
  "id" serial PRIMARY KEY,
  "event_key" text NOT NULL,
  "field" text NOT NULL,
  "accounts_id" integer,
  "ig_user_id" text,
  "outcome" text,
  "received_at" timestamptz NOT NULL DEFAULT now(),
  "processed_at" timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS "social_webhook_events_key" ON ${S}."Social_Webhook_Events" ("event_key");

CREATE TABLE IF NOT EXISTS ${S}."Social_Dm_Log" (
  "id" serial PRIMARY KEY,
  "accounts_id" integer NOT NULL,
  "rule_id" integer,
  "comment_id" text,
  "ig_user_id" text,
  "username" text,
  "kind" text NOT NULL,
  "mode" text NOT NULL,
  "status" text NOT NULL,
  "reason" text,
  "text" text,
  "lead_id" integer,
  "interaction_id" integer,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "social_dm_log_account_created_idx" ON ${S}."Social_Dm_Log" ("accounts_id", "created_at");
CREATE UNIQUE INDEX IF NOT EXISTS "social_dm_log_one_private_reply" ON ${S}."Social_Dm_Log" ("accounts_id", "comment_id") WHERE "kind" = 'private_reply';

CREATE TABLE IF NOT EXISTS ${S}."Social_Dm_Opt_Outs" (
  "id" serial PRIMARY KEY,
  "accounts_id" integer NOT NULL,
  "ig_user_id" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "social_dm_opt_outs_account_user" ON ${S}."Social_Dm_Opt_Outs" ("accounts_id", "ig_user_id");
`;

const TABLES = [
  "Social_Settings", "Social_Topics", "Social_Scripts", "Social_Heygen_Pulls",
  "Social_Dm_Rules", "Social_Webhook_Events", "Social_Dm_Log", "Social_Dm_Opt_Outs",
];

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
