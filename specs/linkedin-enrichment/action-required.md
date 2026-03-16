# Action Required: LinkedIn Enrichment Python Port

Manual steps that must be completed by a human.

## Before Implementation

- [ ] **Get Anthropic API key** - Needed for Claude AI summary calls. Create at console.anthropic.com, add as `ANTHROPIC_API_KEY` in `/home/gabriel/automations/.env`
- [ ] **Install `anthropic` package** - Run `pip install anthropic` (or add to requirements.txt) in the automations virtualenv
- [ ] **Install `httpx`** - Run `pip install httpx` if not already installed (for async HTTP calls to RapidAPI)

## During Implementation

- [x] **Verify RapidAPI keys are still active** - Tested 2026-03-15: original key 1 exhausted and dropped, replaced with new key (`...2f49`) + added key 9 (`...8170`). All 12 keys verified working (600 credits/month)


## After Implementation

- [ ] **Restart automations engine** - `pm2 restart leadawaker-engine` to pick up new scheduler job
- [ ] **Test with one prospect** - Use the manual trigger endpoint to enrich a single known prospect (e.g., one of the 4 Solar Den Bosch contacts) and verify data appears in CRM
- [ ] **Disable N8N workflow** - Once Python port is verified working, deactivate the N8N LinkedIn Scraper to avoid double enrichment
