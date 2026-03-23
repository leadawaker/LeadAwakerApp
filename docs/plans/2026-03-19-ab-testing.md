# A/B Testing Implementation Plan

**Goal:** Enable campaign-level A/B testing where leads are randomly assigned to prompt variant A or B, with metrics comparison in the CRM.
**Architecture:** Campaigns get ab_enabled + ab_split_ratio fields. Leads get ab_variant field assigned on first contact. Prompt_Library gets ab_variant field to distinguish A/B prompts. Stats computed via SQL aggregation on interactions joined to leads.
**Tech Stack:** PostgreSQL (schema), Python/FastAPI (engine), Express/TypeScript (API), React/Recharts (frontend)

---

### Task 1: Database Schema Changes

**Files:**
- Modify: PostgreSQL schema directly (NocoDB manages schema)
- Modify: `/home/gabriel/automations/tools/db/constants.py` (add column constants)
- Modify: `/home/gabriel/LeadAwakerApp/client/src/types/models.ts` (add Campaign type fields)

**Step 1:** Add columns to database
```sql
-- Campaigns table
ALTER TABLE p2mxx34fvbf3ll6."Campaigns"
  ADD COLUMN IF NOT EXISTS ab_enabled BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS ab_split_ratio INTEGER DEFAULT 50;

-- Prompt_Library table
ALTER TABLE p2mxx34fvbf3ll6."Prompt_Library"
  ADD COLUMN IF NOT EXISTS ab_variant VARCHAR(1);

-- Leads table
ALTER TABLE p2mxx34fvbf3ll6."Leads"
  ADD COLUMN IF NOT EXISTS ab_variant VARCHAR(1);
```

**Step 2:** Add constants to Python engine
```python
# In constants.py CampaignsCols class, add:
AB_ENABLED = "ab_enabled"
AB_SPLIT_RATIO = "ab_split_ratio"

# In PromptLibraryCols class, add:
AB_VARIANT = "ab_variant"

# In LeadsCols class, add:
AB_VARIANT = "ab_variant"
```

**Step 3:** Add fields to TypeScript Campaign type
```typescript
// In models.ts Campaign type, add:
ab_enabled?: boolean;
ab_split_ratio?: number;
```

**Step 4:** Verify columns exist
```bash
sudo -u postgres psql -d nocodb -c "SELECT ab_enabled, ab_split_ratio FROM p2mxx34fvbf3ll6.\"Campaigns\" LIMIT 1;"
sudo -u postgres psql -d nocodb -c "SELECT ab_variant FROM p2mxx34fvbf3ll6.\"Prompt_Library\" LIMIT 1;"
sudo -u postgres psql -d nocodb -c "SELECT ab_variant FROM p2mxx34fvbf3ll6.\"Leads\" LIMIT 1;"
```

---

### Task 2: Engine (Prompt Selection + Lead Assignment)

**Files:**
- Modify: `/home/gabriel/automations/tools/db/prompts.py` (add variant-aware query)
- Modify: `/home/gabriel/automations/src/automations/ai_conversation.py` (variant in _load_prompt)
- Modify: `/home/gabriel/automations/src/automations/inbound_handler.py` (assign variant on first contact)

**Step 1:** Add variant-aware prompt query in prompts.py
```python
async def get_prompt_for_campaign(campaign_id: int, use_case: str = "conversation", ab_variant: str | None = None) -> dict | None:
    pool = get_pool()
    if ab_variant:
        row = await pool.fetchrow(
            'SELECT * FROM p2mxx34fvbf3ll6."Prompt_Library" '
            'WHERE "Campaigns_id" = $1 AND use_case = $2 AND status = \'active\' '
            'AND ab_variant = $3 '
            'ORDER BY created_at DESC LIMIT 1',
            campaign_id, use_case, ab_variant
        )
    else:
        row = await pool.fetchrow(
            'SELECT * FROM p2mxx34fvbf3ll6."Prompt_Library" '
            'WHERE "Campaigns_id" = $1 AND use_case = $2 AND status = \'active\' '
            'AND (ab_variant IS NULL OR ab_variant = \'A\') '
            'ORDER BY ab_variant ASC NULLS FIRST, created_at DESC LIMIT 1',
            campaign_id, use_case
        )
    return dict(row) if row else None
```

**Step 2:** Update _load_prompt in ai_conversation.py to accept variant
```python
async def _load_prompt(campaign_id: int, account_id: int, ab_variant: str | None = None) -> dict:
    prompt = await get_prompt_for_campaign(campaign_id, "conversation", ab_variant=ab_variant)
    # ... rest stays the same
```

**Step 3:** Update the call site in run_ai_conversation (around line 212)
```python
lead_variant = lead.get("ab_variant")
prompt_cfg = await _load_prompt(campaign_id, account_id, ab_variant=lead_variant)
```

**Step 4:** Add variant assignment in inbound_handler.py
Find where lead is first processed. If lead has no ab_variant and campaign has ab_enabled:
```python
import random

# After loading campaign_account and lead:
if campaign_account.get("ab_enabled") and not lead.get("ab_variant"):
    split = campaign_account.get("ab_split_ratio", 50)
    variant = "B" if random.randint(1, 100) <= split else "A"
    await update_lead_fields(lead["id"], ab_variant=variant)
    lead["ab_variant"] = variant
```

**Step 5:** Verify by restarting engine
```bash
pm2 restart leadawaker-engine --update-env
```

---

### Task 3: API Endpoint for ab-stats

**Files:**
- Modify: `/home/gabriel/LeadAwakerApp/server/routes.ts` (add GET /api/campaigns/:id/ab-stats)

**Step 1:** Add the endpoint after existing campaign endpoints (~line 600)
```typescript
app.get("/api/campaigns/:id/ab-stats", requireAuth, async (req, res) => {
  const campaignId = parseInt(req.params.id);

  const stats = await pool.query(`
    SELECT
      l.ab_variant,
      COUNT(DISTINCT l.id) as leads,
      COUNT(DISTINCT CASE WHEN l.automation_status IN ('contacted','responded','multiple_responses','qualified','booked','closed') THEN l.id END) as contacted,
      COUNT(DISTINCT CASE WHEN l.automation_status IN ('responded','multiple_responses','qualified','booked','closed') THEN l.id END) as responded,
      COUNT(DISTINCT CASE WHEN l.automation_status IN ('booked','closed') THEN l.id END) as booked,
      COALESCE(AVG(CASE WHEN l.automation_status IN ('booked','closed') THEN i.msg_count END), 0) as avg_messages_to_book
    FROM p2mxx34fvbf3ll6."Leads" l
    LEFT JOIN (
      SELECT lead_id, COUNT(*) as msg_count
      FROM p2mxx34fvbf3ll6."Interactions"
      WHERE direction = 'inbound'
      GROUP BY lead_id
    ) i ON i.lead_id = l.id
    WHERE l."Campaigns_id" = $1
      AND l.ab_variant IS NOT NULL
    GROUP BY l.ab_variant
  `, [campaignId]);

  const campaign = await pool.query(
    'SELECT ab_enabled, ab_split_ratio FROM p2mxx34fvbf3ll6."Campaigns" WHERE id = $1',
    [campaignId]
  );

  // Build response with confidence calculation
  res.json({
    ab_enabled: campaign.rows[0]?.ab_enabled ?? false,
    split_ratio: campaign.rows[0]?.ab_split_ratio ?? 50,
    variants: stats.rows.reduce((acc, row) => {
      const total = parseInt(row.leads);
      const responded = parseInt(row.responded);
      const booked = parseInt(row.booked);
      acc[row.ab_variant] = {
        leads: total,
        contacted: parseInt(row.contacted),
        responded,
        response_rate: total > 0 ? responded / total : 0,
        booked,
        booking_rate: total > 0 ? booked / total : 0,
        avg_messages_to_book: parseFloat(row.avg_messages_to_book) || 0
      };
      return acc;
    }, {})
  });
});
```

**Step 2:** Verify endpoint
```bash
curl -s http://localhost:3001/api/campaigns/24/ab-stats -H "Authorization: Bearer TOKEN" | jq
```

---

### Task 4: Telegram /ab Command

**Files:**
- Modify: `/home/gabriel/automations/src/webhooks/telegram_crm_bot.py` (add /ab handler)

**Step 1:** Add "/ab" to ADMIN_COMMANDS set

**Step 2:** Add handler function
```python
async def _handle_ab_command(chat_id: int, args: str):
    """Handle /ab commands for A/B testing."""
    lead = await get_lead_by_channel_id(f"tg-{bot_name}:{chat_id}")
    if not lead:
        await send_msg(chat_id, "No lead found. Send /start first.")
        return

    campaign = await get_campaign(lead["Campaigns_id"])

    if not args:
        # Show status
        status = "ON" if campaign.get("ab_enabled") else "OFF"
        variant = lead.get("ab_variant", "not assigned")
        ratio = campaign.get("ab_split_ratio", 50)
        await send_msg(chat_id, f"A/B Testing: {status}\nYour variant: {variant}\nSplit: {100-ratio}% A / {ratio}% B")
        return

    parts = args.strip().split()
    sub = parts[0].lower()

    if sub == "on":
        await update_campaign(campaign["id"], ab_enabled=True)
        await send_msg(chat_id, "A/B testing enabled.")
    elif sub == "off":
        await update_campaign(campaign["id"], ab_enabled=False)
        await send_msg(chat_id, "A/B testing disabled.")
    elif sub == "ratio" and len(parts) > 1:
        ratio = int(parts[1])
        await update_campaign(campaign["id"], ab_split_ratio=ratio)
        await send_msg(chat_id, f"Split set to {100-ratio}% A / {ratio}% B.")
    elif sub == "switch":
        new_variant = "B" if lead.get("ab_variant") == "A" else "A"
        await update_lead_fields(lead["id"], ab_variant=new_variant)
        await send_msg(chat_id, f"Switched to variant {new_variant}.")
    elif sub == "stats":
        # Query stats and display
        await send_msg(chat_id, "Stats coming soon...")
```

**Step 3:** Route command in main handler
```python
if cmd == "/ab":
    args = text[3:].strip() if len(text) > 3 else ""
    background_tasks.add_task(_handle_ab_command, chat_id, args)
    return {"ok": True}
```

---

### Task 5: CRM A/B Card + Config Section

**Files:**
- Modify: `/home/gabriel/LeadAwakerApp/client/src/features/campaigns/components/CampaignDetailView.tsx`
- Modify: `/home/gabriel/LeadAwakerApp/client/src/locales/en/campaigns.json`
- Modify: `/home/gabriel/LeadAwakerApp/client/src/locales/pt/campaigns.json`
- Modify: `/home/gabriel/LeadAwakerApp/client/src/locales/nl/campaigns.json`

**Step 1:** Add i18n keys to all 3 locale files
```json
"abTesting": {
  "title": "A/B Test",
  "variantA": "A",
  "variantB": "B",
  "leads": "leads",
  "response": "response",
  "booking": "booking",
  "avgMsgs": "avg msgs",
  "winner": "Winner",
  "confidence": "Confidence",
  "needMore": "Need ~{{count}} more leads for 95%",
  "noTest": "No A/B test running",
  "splitLabel": "Split",
  "enabled": "A/B Testing",
  "splitRatio": "B Variant %"
}
```

**Step 2:** Create ABTestCard component inline in CampaignDetailView.tsx
- Conditionally renders instead of Activity card when campaign.ab_enabled
- Fetches /api/campaigns/:id/ab-stats
- Shows two variant cards side by side
- Shows winner + confidence
- Dual line chart (Recharts) for A vs B response rate over time

**Step 3:** Add A/B Testing section to Config tab
- Toggle for ab_enabled
- Number input for ab_split_ratio
- Read-only display of variant A and B prompt names

---

### Task 6: Thomas B Variant Prompts

**Files:**
- Database: Insert new Prompt_Library entries with ab_variant="B"
- Database: Update existing prompts to ab_variant="A"

**Step 1:** Mark existing Next Level prompts as variant A
```sql
UPDATE p2mxx34fvbf3ll6."Prompt_Library"
SET ab_variant = 'A'
WHERE id IN (33, 34);
```

**Step 2:** Create B variant prompts (research approach)

**Step 3:** Enable A/B testing on Next Level campaigns
```sql
UPDATE p2mxx34fvbf3ll6."Campaigns"
SET ab_enabled = true, ab_split_ratio = 50
WHERE id IN (24, 25);
```

---

### Task 7: End-to-End Test

**Step 1:** Via Telegram bot:
- /ab on (enable A/B)
- /ab switch (switch to variant B)
- /c1 (reset and trigger B variant first message)
- Verify B prompt is used in conversation

**Step 2:** Check CRM:
- Open campaign detail
- Verify A/B card shows instead of Activity
- Check stats display

---

## Execution Strategy

Tasks 1-2 are sequential (2 depends on 1).
Tasks 3, 4, 5 are independent after Task 2 (parallel subagents).
Task 6 depends on Task 1.
Task 7 depends on all above.

```
Task 1 (DB) → Task 2 (Engine) → [Task 3 (API) | Task 4 (Telegram) | Task 5 (CRM)] → Task 6 (Prompts) → Task 7 (Test)
```
