# Requirements: LinkedIn Enrichment Python Port

## What & Why

Port the N8N LinkedIn Scraper workflow to the Python WAT automation engine. The N8N workflow currently: (1) finds a LinkedIn profile URL via Google Custom Search, (2) scrapes the profile via RapidAPI with cascading API keys, (3) generates an AI summary via Gemini. The Python port drops Google CSE (prospects already have a `contactLinkedin` URL/username), replaces Gemini with Claude, writes results directly to the Prospects DB table (instead of Google Sheets), and runs as a scheduled job that auto-enriches prospects with `enrichment_status IS NULL`.

This eliminates the N8N dependency, brings enrichment into the same automation engine as all other jobs (logging, monitoring, scheduling), and gives 600 free enrichments/month via RapidAPI key rotation (12 keys x 50 credits each).

## Core Pipeline

1. **Extract LinkedIn username** - Parse username from the prospect's `contactLinkedin` field (URL or raw username)
2. **RapidAPI Profile Scrape** - Hit `professional-network-data.p.rapidapi.com/profile-data-connection-count-posts` with cascading 12 API keys (50 credits each)
3. **Claude AI Summary** - Generate a concise professional summary from the scraped profile data
4. **DB Write** - Update the Prospects row with enrichment results

## Acceptance Criteria

- [ ] `tools/linkedin_enrichment.py` exists with two public async functions: `scrape_linkedin_profile()`, `generate_profile_summary()`
- [ ] Helper `_extract_username(url_or_username: str) -> str` parses LinkedIn username from URL or passes through raw username
- [ ] 12 RapidAPI keys cascade: if one returns an error (rate limit/quota), try the next
- [ ] Claude API (via Anthropic SDK) generates the AI summary, not GPT or Gemini
- [ ] `src/automations/prospect_enrichment.py` is a scheduled job registered in `src/scheduler/jobs.py`
- [ ] Job queries prospects where `enrichment_status IS NULL` and `contactLinkedin IS NOT NULL`
- [ ] On success: writes `photoUrl`, `enrichmentStatus='enriched'`, `enrichedAt` to the Prospects row, plus structured enrichment data to `notes`
- [ ] On failure: writes `enrichmentStatus='failed'` with error details
- [ ] Prospects with no `contactLinkedin` are skipped (not marked as failed)
- [ ] All steps logged via `AsyncLogStep` / `log_step` to Automation_Logs
- [ ] Configurable batch size and interval via `.env` settings
- [ ] `tools/db/prospects.py` provides DB query helpers for the Prospects table

## Dependencies

- Anthropic Python SDK (`anthropic`) for Claude API
- `httpx` for async HTTP calls to RapidAPI
- Existing: `asyncpg` pool, `AsyncLogStep`, `src/config.py`

## Related

- N8N source: `/home/gabriel/LeadAwakerApp/n8n automations/Linkedin_Scraper.json`
- Memory: `project_outreach_strategy.md` (enrichment strategy decisions)
- Schema: `shared/schema.ts` lines 83-127 (Prospects table)
