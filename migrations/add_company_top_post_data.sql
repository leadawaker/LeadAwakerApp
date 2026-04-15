-- Structured top posts from the company LinkedIn page (carousel UI in Company Summary tab)
-- Shape: [{title, date, reactions, url}]
ALTER TABLE p2mxx34fvbf3ll6."Prospects"
  ADD COLUMN IF NOT EXISTS company_top_post_data jsonb;
