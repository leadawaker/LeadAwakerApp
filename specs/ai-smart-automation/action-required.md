# AI Smart Automation — Action Required

## Database Migration

### New table
```sql
CREATE TABLE "Account_Knowledge_Base" (
  id SERIAL PRIMARY KEY,
  account_id INTEGER NOT NULL REFERENCES "Accounts"(id),
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_akb_account_category ON "Account_Knowledge_Base"(account_id, category);
```

### Schema additions (Leads table)
```sql
ALTER TABLE "Leads" ADD COLUMN buying_signal_detected_at TIMESTAMP;
ALTER TABLE "Leads" ADD COLUMN buying_signal_type TEXT;
ALTER TABLE "Leads" ADD COLUMN handoff_reason TEXT;
ALTER TABLE "Leads" ADD COLUMN ai_detection_count INTEGER DEFAULT 0;
```

### Schema additions (Campaigns table)
```sql
ALTER TABLE "Campaigns" ADD COLUMN ai_bump_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE "Campaigns" ADD COLUMN buying_signal_response TEXT;
```

### Schema additions (Interactions table)
```sql
ALTER TABLE "Interactions" ADD COLUMN is_ai_generated BOOLEAN DEFAULT FALSE;
```

## Prompt Library Entries

### AI Bump System Prompt
- Use case: `system:ai-bump`
- Create default prompt for AI bump generation
- Make it editable via Prompt Library UI

### Buying Signal Classifier Prompt
- Use case: `system:buying-signal-classifier`
- Groq prompt for nuanced signal detection

### Admin Nightly Summary Prompt
- Use case: `system:campaign-summary-admin`
- Separate from existing `system:campaign-summary`

### Client Nightly Summary Prompt
- Use case: `system:campaign-summary-client`

## Configuration

### Cron jobs to register
- `nightly_campaign_summary`: midnight per account timezone
- `buying_signal_followup`: every 5 minutes (check for stale buying signals)

### Environment variables
- None new (reuses existing GROQ_API_KEY)

## Manual Steps

1. Run database migration after schema changes
2. Push migration via `npm run db:push`
3. Seed default knowledge base categories for existing accounts (optional)
4. Create prompt library entries for new system prompts
5. Restart automations engine: `pm2 restart leadawaker-engine`

## Future Task (Log for Later)

- **RAG Vector Search**: When structured knowledge base proves insufficient (50+ entries or document uploads needed), implement pgvector-based semantic search. Requires: `CREATE EXTENSION vector;`, embedding pipeline, similarity search endpoint.
