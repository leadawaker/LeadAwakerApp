// Creates the Socials thumbnail creator tables (reference images, saved styles, generated thumbnails)
// and adds the cover columns to Social_Posts.
// Purely additive and idempotent: CREATE ... IF NOT EXISTS and ADD COLUMN IF NOT EXISTS only, no row is touched.
// Run: node --env-file=.env script/create-social-thumbnail-tables.mjs
import pg from "pg";

const SCHEMA = "p2mxx34fvbf3ll6"; // nocodb pgSchema (matches shared/schema.ts)
const S = `"${SCHEMA}"`;

const sql = `
CREATE TABLE IF NOT EXISTS ${S}."Social_Thumbnail_Refs" (
  "id" serial PRIMARY KEY,
  "accounts_id" integer NOT NULL,
  "kind" text NOT NULL,
  "label" text NOT NULL DEFAULT '',
  "file_path" text NOT NULL,
  "mime_type" text NOT NULL,
  "created_by_user_id" integer,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "social_thumbnail_refs_accounts_id_idx" ON ${S}."Social_Thumbnail_Refs" ("accounts_id");

CREATE TABLE IF NOT EXISTS ${S}."Social_Thumbnail_Styles" (
  "id" serial PRIMARY KEY,
  "accounts_id" integer NOT NULL,
  "name" text NOT NULL,
  "kind" text NOT NULL,
  "prompt" text NOT NULL DEFAULT '',
  "format" text NOT NULL DEFAULT 'reel',
  "ref_ids" integer[] NOT NULL DEFAULT '{}',
  "created_by_user_id" integer,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "social_thumbnail_styles_accounts_id_idx" ON ${S}."Social_Thumbnail_Styles" ("accounts_id");

CREATE TABLE IF NOT EXISTS ${S}."Social_Thumbnails" (
  "id" serial PRIMARY KEY,
  "accounts_id" integer NOT NULL,
  "batch_id" text NOT NULL,
  "style_id" integer,
  "script_id" integer,
  "post_id" integer,
  "kind" text NOT NULL,
  "format" text NOT NULL,
  "title" text NOT NULL DEFAULT '',
  "prompt" text NOT NULL DEFAULT '',
  "full_prompt" text NOT NULL DEFAULT '',
  "ref_ids" integer[] NOT NULL DEFAULT '{}',
  "status" text NOT NULL DEFAULT 'generating',
  "error" text,
  "file_path" text,
  "model" text,
  "starred" boolean NOT NULL DEFAULT false,
  "created_by_user_id" integer,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "social_thumbnails_accounts_id_idx" ON ${S}."Social_Thumbnails" ("accounts_id", "created_at");

-- Edited versions: the thumbnail they came from, and whether the edit was approved yet.
ALTER TABLE ${S}."Social_Thumbnails" ADD COLUMN IF NOT EXISTS "parent_id" integer;
ALTER TABLE ${S}."Social_Thumbnails" ADD COLUMN IF NOT EXISTS "review" text;

-- A post's Reel cover: its own copy of a generated thumbnail (server/social/postRoutes.ts).
ALTER TABLE ${S}."Social_Posts" ADD COLUMN IF NOT EXISTS "cover_thumbnail_id" integer;
ALTER TABLE ${S}."Social_Posts" ADD COLUMN IF NOT EXISTS "cover_public_id" text;
ALTER TABLE ${S}."Social_Posts" ADD COLUMN IF NOT EXISTS "cover_path" text;
CREATE UNIQUE INDEX IF NOT EXISTS "social_posts_cover_public_id_idx" ON ${S}."Social_Posts" ("cover_public_id") WHERE "cover_public_id" IS NOT NULL;
`;

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  await client.query(sql);
  console.log("Social thumbnail tables ready.");
} finally {
  await client.end();
}
