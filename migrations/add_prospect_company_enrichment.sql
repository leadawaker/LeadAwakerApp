-- Company-level enrichment fields (AI-generated summary + categorized tabs)
ALTER TABLE p2mxx34fvbf3ll6."Prospects"
  ADD COLUMN IF NOT EXISTS company_summary text,
  ADD COLUMN IF NOT EXISTS company_services text,
  ADD COLUMN IF NOT EXISTS company_products text,
  ADD COLUMN IF NOT EXISTS company_history text,
  ADD COLUMN IF NOT EXISTS company_enrichment_status text DEFAULT 'new',
  ADD COLUMN IF NOT EXISTS company_enriched_at timestamp with time zone;

-- Structured top posts for carousel UI (jsonb): [{title, date, reactions, url?}]
ALTER TABLE p2mxx34fvbf3ll6."Prospects"
  ADD COLUMN IF NOT EXISTS top_post_data jsonb,
  ADD COLUMN IF NOT EXISTS contact2_top_post_data jsonb;
