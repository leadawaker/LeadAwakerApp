-- Add enrichment columns to Prospects table
ALTER TABLE p2mxx34fvbf3ll6."Prospects"
  ADD COLUMN IF NOT EXISTS headline TEXT,
  ADD COLUMN IF NOT EXISTS connection_count INTEGER,
  ADD COLUMN IF NOT EXISTS follower_count INTEGER,
  ADD COLUMN IF NOT EXISTS top_post TEXT,
  ADD COLUMN IF NOT EXISTS ai_summary TEXT,
  ADD COLUMN IF NOT EXISTS conversation_starters TEXT;
