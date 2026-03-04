-- Add Instagram credentials to Accounts
ALTER TABLE "p2mxx34fvbf3ll6"."Accounts"
  ADD COLUMN IF NOT EXISTS instagram_access_token TEXT,
  ADD COLUMN IF NOT EXISTS instagram_user_id TEXT;

-- Add generic channel identifier to Leads
ALTER TABLE "p2mxx34fvbf3ll6"."Leads"
  ADD COLUMN IF NOT EXISTS channel_identifier TEXT;
