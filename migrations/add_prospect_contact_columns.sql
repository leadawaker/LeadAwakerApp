-- Add contact person columns to Prospects table
ALTER TABLE "p2mxx34fvbf3ll6"."Prospects"
  ADD COLUMN IF NOT EXISTS "contact_name" TEXT,
  ADD COLUMN IF NOT EXISTS "contact_role" TEXT,
  ADD COLUMN IF NOT EXISTS "contact_email" VARCHAR,
  ADD COLUMN IF NOT EXISTS "contact_phone" VARCHAR,
  ADD COLUMN IF NOT EXISTS "contact_linkedin" TEXT;
