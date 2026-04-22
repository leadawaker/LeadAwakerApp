# Action Required — Legal Demo Mock Intake Form

## Manual steps Gabriel must confirm or do

### 1. Confirm LLM budget tolerance
Each first-hit adds one Groq call (~200 tokens out, sub-2s). For a demo-only feature, unlimited. For safety, add a cost guard later if this ever moves to a real-volume client.

### 2. Decide on Dutch / Portuguese intake in Phase 2
The spec ships English-only. Campaign 59 is English. If you want NL/PT intake pages before real Dutch/Portuguese prospects see the demo, scope adds ~30 min (mirror the strings in the other two locale files).

### 3. Confirm paralegal name and tone for the confirmation message
Current: "Got it {first_name}. Your intake is with Marcus Chen now — he'll call you within 30 minutes." ← default. Change before ship if Marcus Chen doesn't feel right.

### 4. Confirm `app.leadawaker.com/intake/{token}` as the frontend host
Spec uses the Pi CRM app (same repo as `/try`). If later you want it on `leadawaker.com/intake/...` (Vercel marketing site), the Python redirect URL and the frontend repo both have to change.

### 5. Decide whether to expose the mock intake URL directly for demo calls
On a sales call, Gabriel might want to share the intake page link live without running the WhatsApp flow first. That would need an admin route like `/api/demo/intake-preview/{campaign_id}` that mints a fake token. Not in Phase 2 scope.

## Manual DB migration

Run this once, before Phase 2 code ships:

```sql
ALTER TABLE p2mxx34fvbf3ll6."Booking_Links"
  ADD COLUMN intake_data JSONB,
  ADD COLUMN intake_submitted_at TIMESTAMPTZ;
```

Safe to run in production. Both columns nullable, no data backfill needed.

## Pre-ship sanity checks for the implementing agent

Before starting Phase 2 build:

1. Grep `tools/db/leads.py` for `update_lead_status` — confirm the exact function name. If different, update the spec.
2. Grep `/home/gabriel/automations/tools/` for the WhatsApp outbound helper — confirm the exact function name (likely `send_whatsapp_text`, `send_message`, or similar).
3. Grep for `AsyncLogStep` — confirm the import path and required kwargs.
4. Grep `/home/gabriel/automations/src/webhooks/` for the FastAPI app bootstrap — confirm where to register `intake_router`.
5. Grep `/home/gabriel/LeadAwakerApp/client/src/App.tsx` for the `!isAppArea` branch — confirm the public route section where `/intake/:token` should mount.

If any of these don't match the spec's assumptions, fix the spec before writing code. Don't let the spec drift from reality.
