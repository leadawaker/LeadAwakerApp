// Creates the Instagram connect + scheduled publishing tables and the
// Accounts.social_enabled flag. Purely additive and idempotent.
// Run: node --env-file=.env script/create-social-tables.mjs
import pg from "pg";

const SCHEMA = "p2mxx34fvbf3ll6"; // nocodb pgSchema (matches shared/schema.ts)

const sql = `
ALTER TABLE "${SCHEMA}"."Accounts" ADD COLUMN IF NOT EXISTS "social_enabled" boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS "${SCHEMA}"."Social_Connections" (
  "id" serial PRIMARY KEY,
  "accounts_id" integer NOT NULL,
  "provider" text NOT NULL,
  "external_user_id" text,
  "username" text,
  "profile_picture_url" text,
  "account_type" text,
  "access_token_enc" text,
  "scopes" jsonb NOT NULL DEFAULT '[]',
  "token_expires_at" timestamptz,
  "token_refreshed_at" timestamptz,
  "status" text NOT NULL DEFAULT 'connected',
  "last_error" text,
  "expiry_warned_at" timestamptz,
  "connected_by_user_id" integer,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
-- Added in Task 5 fix round 1: Meta's deauthorize / data-deletion callbacks may send the app-scoped id (/me "id").
ALTER TABLE "${SCHEMA}"."Social_Connections" ADD COLUMN IF NOT EXISTS "app_scoped_user_id" text;
CREATE UNIQUE INDEX IF NOT EXISTS "social_connections_account_provider" ON "${SCHEMA}"."Social_Connections" ("accounts_id", "provider");
CREATE UNIQUE INDEX IF NOT EXISTS "social_connections_external_connected" ON "${SCHEMA}"."Social_Connections" ("provider", "external_user_id") WHERE "status" <> 'disconnected';

CREATE TABLE IF NOT EXISTS "${SCHEMA}"."Social_Posts" (
  "id" serial PRIMARY KEY,
  "accounts_id" integer NOT NULL,
  "connection_id" integer,
  "media_type" text NOT NULL DEFAULT 'REELS',
  "video_path" text,
  "video_public_id" text,
  "video_ext" text,
  "video_duration_s" real,
  "video_width" integer,
  "video_height" integer,
  "video_bytes" bigint,
  "caption" text NOT NULL DEFAULT '',
  "share_to_feed" boolean NOT NULL DEFAULT true,
  "is_ai_generated" boolean NOT NULL DEFAULT true,
  "scheduled_at" timestamptz NOT NULL,
  "requires_approval" boolean NOT NULL DEFAULT true,
  "approval_status" text NOT NULL DEFAULT 'pending',
  "approval_note" text,
  "approved_by_user_id" integer,
  "approved_at" timestamptz,
  "approval_waived_by_user_id" integer,
  "approval_waived_at" timestamptz,
  "approval_reminder_sent_at" timestamptz,
  "status" text NOT NULL DEFAULT 'scheduled',
  "ig_container_id" text,
  "publishing_started_at" timestamptz,
  "ig_media_id" text,
  "permalink" text,
  "attempts" integer NOT NULL DEFAULT 0,
  "last_error" text,
  "published_at" timestamptz,
  "created_by_user_id" integer,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "social_posts_video_public_id" ON "${SCHEMA}"."Social_Posts" ("video_public_id");
CREATE INDEX IF NOT EXISTS "social_posts_status_scheduled_idx" ON "${SCHEMA}"."Social_Posts" ("status", "scheduled_at");
CREATE INDEX IF NOT EXISTS "social_posts_accounts_id_idx" ON "${SCHEMA}"."Social_Posts" ("accounts_id");
`;

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
try {
  await pool.query(sql);
  const { rows } = await pool.query(
    `SELECT table_name, column_name, data_type FROM information_schema.columns
     WHERE table_schema = $1 AND ((table_name IN ('Social_Connections','Social_Posts'))
       OR (table_name = 'Accounts' AND column_name = 'social_enabled'))
     ORDER BY table_name, ordinal_position`,
    [SCHEMA],
  );
  for (const r of rows) console.log(`${r.table_name}.${r.column_name} (${r.data_type})`);
  const idx = await pool.query(
    `SELECT indexname FROM pg_indexes WHERE schemaname = $1 AND tablename IN ('Social_Connections','Social_Posts') ORDER BY 1`,
    [SCHEMA],
  );
  console.log("indexes:", idx.rows.map((r) => r.indexname).join(", "));
} finally {
  await pool.end();
}
