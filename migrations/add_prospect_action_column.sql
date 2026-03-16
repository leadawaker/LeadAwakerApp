-- Add Action column to Prospects table
ALTER TABLE "p2mxx34fvbf3ll6"."Prospects"
  ADD COLUMN IF NOT EXISTS "action" text;
