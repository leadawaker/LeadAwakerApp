-- Email tracking table for open/click/unsubscribe tracking
-- Run: psql -U leadawaker -d nocodb < migrations/add_email_tracking_table.sql

-- Use the correct schema
SET search_path TO p2mxx34fvbf3ll6;

CREATE TABLE IF NOT EXISTS email_tracking (
  id SERIAL PRIMARY KEY,
  tracking_id TEXT UNIQUE NOT NULL,
  prospect_id INTEGER,
  campaign_id INTEGER,
  to_email TEXT NOT NULL,
  subject TEXT,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  unsubscribed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_email_tracking_tracking_id ON email_tracking(tracking_id);
CREATE INDEX IF NOT EXISTS idx_email_tracking_prospect_id ON email_tracking(prospect_id);
