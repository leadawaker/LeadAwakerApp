-- Add Contact 2 columns to Prospects table
ALTER TABLE "Prospects"
  ADD COLUMN IF NOT EXISTS "contact2_name" text,
  ADD COLUMN IF NOT EXISTS "contact2_role" text,
  ADD COLUMN IF NOT EXISTS "contact2_email" varchar,
  ADD COLUMN IF NOT EXISTS "contact2_phone" varchar,
  ADD COLUMN IF NOT EXISTS "contact2_linkedin" text;
