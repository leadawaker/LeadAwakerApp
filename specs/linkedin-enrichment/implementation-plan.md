# Implementation Plan: LinkedIn Enrichment Python Port

## Overview

Port the N8N LinkedIn Scraper workflow into two Python modules: a reusable tool (`tools/linkedin_enrichment.py`) and a scheduled automation (`src/automations/prospect_enrichment.py`). Add DB helpers and register the job in the scheduler.

## Phase 1: Configuration & DB Helpers

Add env vars, config fields, and Prospects DB query helpers.

### Tasks
- [ ] Add env vars to `/home/gabriel/automations/.env`: `ANTHROPIC_API_KEY`, `RAPIDAPI_KEYS` (comma-separated), `ENRICHMENT_INTERVAL_SECONDS`, `ENRICHMENT_BATCH_SIZE`
- [ ] Add corresponding fields to `src/config.py` Settings class
- [ ] Create `tools/db/prospects.py` with DB helper functions

### Technical Details

**New `.env` vars:**
```
# LinkedIn Enrichment
ANTHROPIC_API_KEY=<user must provide>
RAPIDAPI_KEYS=3151d846bcmsh4068a37e405191dp1a3c41jsn99d301850d4b,c1fe8071d3mshfa9946603f677cep1d6bbdjsn64a922e904f2,06bc8022a9msh598ca926729df0dp183e98jsn1deea604dcc3,b3cde0ae99msh9c3b39e58c03975p10fc69jsn5e029ed958e2,4a1cbc36dcmshad124087e401269p11000cjsnc9117a77c45c,024361ce8bmsh312c4b6124df9bdp1405bajsn545c8baa9702,74a134ef70msh2b5e26da773938ep1a10c0jsn942c9b47a18e,1b329e2721msh01ae00d2ecda84ap1758efjsne22edc692f49,e7cace8c95mshab154e643c766f0p13b5c8jsn8d6100118170,66f75ad8fbmsh833ab15b49e304bp197186jsnd876f614c0f3,2073ba5a96mshbb87de516bb11b4p15324cjsnb27c515c6ef1,f6c6447d23msh12d9a39814bed95p1a3b10jsn00a2f97e0189
ENRICHMENT_INTERVAL_SECONDS=3600
ENRICHMENT_BATCH_SIZE=5
```

**New `src/config.py` fields:**
```python
anthropic_api_key: str = ""
rapidapi_keys: str = ""  # comma-separated, split at runtime
enrichment_interval_seconds: int = 3600
enrichment_batch_size: int = 5
```

**`tools/db/prospects.py` functions:**
```python
async def get_unenriched_prospects(limit: int) -> list[dict]:
    """SELECT * FROM Prospects WHERE enrichment_status IS NULL LIMIT $1"""

async def update_prospect_enrichment(prospect_id: int, data: dict) -> None:
    """UPDATE Prospects SET photo_url, headline, connection_count, follower_count,
       top_post, ai_summary, conversation_starters, enrichment_status, enriched_at,
       notes WHERE id=$1"""
```

**DB schema reference (Prospects table):**
- `contact_linkedin` (text) - LinkedIn profile URL or username (input for enrichment)
- `photo_url` (text) - profile picture URL (written by enrichment)
- `headline` (text) - LinkedIn headline (e.g. "Mid-Market AE @ HubSpot")
- `connection_count` (integer) - LinkedIn connections
- `follower_count` (integer) - LinkedIn followers
- `top_post` (text) - Most engaging post (best conversation starter)
- `ai_summary` (text) - Claude-generated professional summary (3-5 sentences)
- `conversation_starters` (text) - Actionable outreach hooks based on profile + posts
- `enrichment_status` (text) - 'enriched' | 'failed' | NULL
- `enriched_at` (timestamp)
- `notes` (text) - raw enrichment dump (positions, education, full post list) + human notes
- `contact_name` (text) - for display/logging
- `company` (text) - for display/logging

## Phase 2: LinkedIn Enrichment Tool

Create `tools/linkedin_enrichment.py` with the three core functions.

### Tasks
- [ ] Implement `_extract_username(url_or_username: str) -> str` to parse LinkedIn username from URL or pass through raw username
- [ ] Implement `scrape_linkedin_profile(username: str) -> dict | None` with RapidAPI cascade
- [ ] Implement `generate_profile_summary(profile_data: dict) -> str` using Anthropic Claude API

### Technical Details

**Username extraction:**
```python
def _extract_username(url_or_username: str) -> str:
    """Extract username from LinkedIn URL or return as-is if already a username."""
    match = re.search(r"linkedin\.com/in/([^/?]+)", url_or_username)
    return match.group(1) if match else url_or_username.strip().strip("/")
```

**RapidAPI cascade logic:**
```python
RAPIDAPI_URL = "https://professional-network-data.p.rapidapi.com/profile-data-connection-count-posts"

for key in rapidapi_keys:
    headers = {
        "x-rapidapi-key": key,
        "x-rapidapi-host": "professional-network-data.p.rapidapi.com",
    }
    resp = await client.get(RAPIDAPI_URL, params={"username": username}, headers=headers)
    if resp.status_code == 200 and resp.json().get("data"):
        return resp.json()
    # 429 or error -> try next key
```
- Each key has 50 credits/month = 600 total (12 keys)
- Endpoint returns: `data.username`, `data.summary`, `data.headline`, `data.geo`, `data.educations[]`, `data.fullPositions[]`, `data.skills[]`, `data.projects`, `data.profilePicture`, `data.firstName`, `data.lastName`
- Also returns: `posts[]` (with `.text`, `.likeCount`, `.totalReactionCount`, `.postUrl`, `.postedAt`), `follower`

**Profile data extraction (matching N8N "Lead Enrichment1" node):**
```python
{
    "username": data["username"],
    "full_name": f"{data['firstName']} {data['lastName']}",
    "headline": data["headline"],
    "summary": data["summary"],
    "location": f"{data['geo']['city']}, {data['geo']['country']}",
    "profile_picture": data["profilePicture"],
    "linkedin_url": f"https://www.linkedin.com/in/{data['username']}",
    "followers": response.get("follower"),
    "educations": data.get("educations", [])[:3],
    "positions": data.get("fullPositions", [])[:4],
    "skills": data.get("skills", []),
    "projects": data.get("projects", {}).get("items", [])[:5],
    "recent_posts": response.get("posts", [])[:4],
}
```

**Claude AI Summary prompt:**
```
You are analyzing a LinkedIn profile for a CRM prospect enrichment system.
Given the following LinkedIn profile data, write a concise professional summary (3-5 sentences)
that highlights: their current role, industry expertise, company size/type, and any notable
achievements or interests that could be relevant for business outreach.

Full Name: {full_name}
Headline: {headline}
Location: {location}
Summary: {summary}
Education: {formatted_education}
Positions: {formatted_positions}
Projects: {formatted_projects}
Followers: {followers}
Recent Posts: {formatted_posts}
Skills: {formatted_skills}
```
- Use `anthropic.AsyncAnthropic` client
- Model: `claude-haiku-4-5-20251001` (cheapest, fast, sufficient for summaries)
- Max tokens: 300

## Phase 3: Scheduled Automation

Create `src/automations/prospect_enrichment.py` and register it in the scheduler.

### Tasks
- [ ] Create `src/automations/prospect_enrichment.py` with `run()` async function
- [ ] Register the job in `src/scheduler/jobs.py` with configurable interval
- [ ] Add `tools/db/prospects.py` to `tools/db/__init__.py` if needed

### Technical Details

**`prospect_enrichment.py` flow:**
```python
async def run():
    exec_id = new_execution_id()
    prospects = await get_unenriched_prospects(settings.enrichment_batch_size)

    if not prospects:
        return  # nothing to do, no log needed

    for prospect in prospects:
        linkedin_raw = prospect["contact_linkedin"]

        if not linkedin_raw:
            continue  # skip prospects without LinkedIn (don't mark as failed)

        username = _extract_username(linkedin_raw)

        # Step 1: Scrape profile
        async with AsyncLogStep("prospect_enrichment", "scrape_profile",
                                workflow_execution_id=exec_id, step_number=1) as step:
            profile = await scrape_linkedin_profile(username)
            step.output = "success" if profile else "all_keys_exhausted"

        if not profile:
            await update_prospect_enrichment(prospect["id"], {
                "enrichment_status": "failed",
                "notes": "All RapidAPI keys exhausted or profile not found",
            })
            continue

        # Step 2: AI Summary
        async with AsyncLogStep("prospect_enrichment", "generate_summary",
                                workflow_execution_id=exec_id, step_number=2) as step:
            summary = await generate_profile_summary(profile)
            step.output = summary[:100] if summary else "failed"

        # Step 3: Write to DB
        async with AsyncLogStep("prospect_enrichment", "update_prospect",
                                workflow_execution_id=exec_id, step_number=3) as step:
            top_post = pick_top_post(profile["recent_posts"])  # highest totalReactionCount
            starters = generate_conversation_starters(profile, summary)
            raw_notes = format_raw_enrichment_notes(profile)
            await update_prospect_enrichment(prospect["id"], {
                "photo_url": profile["profile_picture"],
                "headline": profile["headline"],
                "connection_count": profile.get("connections"),
                "follower_count": profile.get("followers"),
                "top_post": top_post,
                "ai_summary": summary,
                "conversation_starters": starters,
                "enrichment_status": "enriched",
                "enriched_at": "NOW()",
                "notes": raw_notes,
            })
            step.output = f"prospect_id={prospect['id']}"
```

**Scheduler registration in `src/scheduler/jobs.py`:**
```python
from src.automations.prospect_enrichment import run as prospect_enrichment_run

scheduler.add_job(
    prospect_enrichment_run,
    trigger=IntervalTrigger(seconds=settings.enrichment_interval_seconds),
    id="prospect_enrichment",
    name="Prospect Enrichment",
    replace_existing=True,
)
```

**Structured fields (first-class columns):**
- `headline` -> profile["headline"]
- `connection_count` -> response["connection"]
- `follower_count` -> response["follower"]
- `top_post` -> post with highest totalReactionCount, formatted as "{reaction_count} reactions: {text[:200]}"
- `ai_summary` -> Claude-generated summary (3-5 sentences)
- `conversation_starters` -> Claude-generated outreach hooks (numbered list, 3-4 items)

**Raw notes format (appended to existing notes for detailed reference):**
```
--- LinkedIn Enrichment ({date}) ---
Location: {location}
Experience: {formatted_positions}
Education: {formatted_education}
Skills: {all_skills}
Recent Posts: {all_posts_with_engagement}
```

**`generate_conversation_starters` prompt (add to Claude call):**
```
Also generate 3-4 numbered conversation starters for business outreach.
Each should reference a specific detail from their profile or posts
and connect it to Lead Awaker's database reactivation service.
Keep each starter to 1-2 sentences.
```

## Phase 4: Manual Trigger API Endpoint

Expose an API endpoint to trigger enrichment for a specific prospect on demand.

### Tasks
- [ ] Add POST `/api/prospects/{id}/enrich` endpoint in the FastAPI app
- [ ] Reuses the same tool functions from `tools/linkedin_enrichment.py`

### Technical Details

**Endpoint:** `POST /api/prospects/{prospect_id}/enrich`
- Fetches the prospect by ID
- Runs the same enrichment pipeline (find URL -> scrape -> summarize -> write)
- Returns the enrichment result as JSON
- Logged to Automation_Logs with workflow_name `prospect_enrichment_manual`

Register in `src/api/` or directly in `src/main.py` alongside existing routes.
