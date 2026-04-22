# Implementation Plan — Legal Demo Mock Intake Form

## Architecture at a glance

```
WhatsApp convo (campaign 59)
      ↓ AI sends link
https://webhooks.leadawaker.com/book/{token}
      ↓ booking_link_redirect() sees campaign_id == 59
      ↓ first hit: Groq extraction → Booking_Links.intake_data
      ↓ 302 redirect
https://app.leadawaker.com/intake/{token}
      ↓ GET /api/intake/{token} → returns { firm, lead, prefill }
      ↓ modal opens, lead edits, taps submit
      ↓ POST /api/intake/{token}/submit
      ↓ sets Interactions.status, logs step, sends WhatsApp confirmation
      ↓ { ok: true }
Success toast → "Back to WhatsApp" → wa.me/31627458300
```

**Host split:**
- Backend (redirect + `/api/intake/*`): Python FastAPI engine at `webhooks.leadawaker.com`. Same host as `/book/{token}`, reuses lead/campaign/booking-link helpers and Twilio send path.
- Frontend (`/intake/{token}` page): CRM React app at `app.leadawaker.com`. Same repo as `/try`, tsx watch hot-reload, no login required for this route.

---

## Phase 1 — Database migration

### File: manual SQL (no migration framework in this project)

```sql
ALTER TABLE p2mxx34fvbf3ll6."Booking_Links"
  ADD COLUMN intake_data JSONB,
  ADD COLUMN intake_submitted_at TIMESTAMPTZ;
```

- `intake_data`: holds the Groq-extracted JSON. Null means "not extracted yet."
- `intake_submitted_at`: null means "not submitted yet." Non-null value makes the endpoint idempotent and drives the "already submitted" read-only state.

Run via `sudo -u postgres psql -d nocodb` directly. No Drizzle schema file to update on the Python side. The Express app's [shared/schema.ts](../../shared/schema.ts) only lists `Booking_Links` if it's imported elsewhere — grep first; if present, add matching column definitions.

---

## Phase 2 — Python intake extraction helper

### New file: `/home/gabriel/automations/tools/intake_extractor.py`

```python
"""
Groq-based extraction of personal-injury case intake fields from a lead's
WhatsApp conversation history.

Demo-only. Scoped to campaign 59 (Summit Injury Law).
"""
import json
import logging
from typing import Optional

from tools.voice_service import _get_groq_client

logger = logging.getLogger("intake_extractor")

# Keep this list tight. Every field added costs demo reliability.
_FIELDS = [
    "incident_type",   # "car accident" | "slip and fall" | "workplace" | "medical malpractice" | "other"
    "incident_date",   # ISO YYYY-MM-DD if lead said something like "March", else null
    "injury_status",   # "in treatment" | "recovered" | "just starting"
    "jurisdiction",    # free text (e.g. "Amsterdam", "California", "NL")
]

_SYSTEM_PROMPT = """You extract personal-injury case intake details from a WhatsApp conversation between a lead (the victim) and a law firm's AI assistant.

Return ONLY a JSON object with exactly these keys: incident_type, incident_date, injury_status, jurisdiction.

Rules:
- incident_type: one of "car accident", "slip and fall", "workplace", "medical malpractice", "other". Use your best guess from context. If nothing was said, return null.
- incident_date: ISO YYYY-MM-DD if stated explicitly; approximate month (e.g. "2026-03-01" for "March") if only month given; null if nothing was said.
- injury_status: one of "in treatment", "recovered", "just starting". Null if not mentioned.
- jurisdiction: free text city/region/country. Null if not mentioned.
- Never invent details. If the conversation is too short or off-topic, return all nulls.
- Respond with raw JSON only. No prose, no markdown fences."""


async def extract_intake(ai_memory: list[dict]) -> dict:
    """
    Given a lead's ai_memory (list of {ts, in, out} turns), extract
    structured intake fields. Returns a dict with the 4 keys, any of
    which may be None.

    Never raises. On any failure returns a dict of nulls — the UI handles
    blank fields gracefully.
    """
    fallback = {k: None for k in _FIELDS}
    if not ai_memory:
        return fallback

    # Flatten to a compact transcript the model can actually read.
    transcript_lines = []
    for turn in ai_memory[-20:]:  # last 20 turns is plenty for a demo convo
        if turn.get("in"):
            transcript_lines.append(f"LEAD: {turn['in']}")
        if turn.get("out"):
            transcript_lines.append(f"BOT: {turn['out']}")
    transcript = "\n".join(transcript_lines)

    try:
        groq = _get_groq_client()
        resp = await groq.chat.completions.create(
            model="llama-3.3-70b-versatile",  # fast + reliable for structured extraction
            messages=[
                {"role": "system", "content": _SYSTEM_PROMPT},
                {"role": "user", "content": transcript},
            ],
            temperature=0,
            response_format={"type": "json_object"},
            max_completion_tokens=200,
        )
        raw = resp.choices[0].message.content or "{}"
        parsed = json.loads(raw)
        return {k: parsed.get(k) for k in _FIELDS}
    except Exception:
        logger.exception("Groq intake extraction failed; returning nulls")
        return fallback
```

**Why Groq, not the primary LLM provider:** Same client already used for voice transcription and telegram bots in this repo. Fast (sub-2s), cheap, and failure modes are well-understood here.

**Why `response_format=json_object`:** Prevents markdown-fenced JSON that would need regex cleanup.

**Why `llama-3.3-70b-versatile`:** Already a known-good model in this repo. Small extraction task — more model is overkill.

---

## Phase 3 — Extend Booking_Links helpers

### File: `/home/gabriel/automations/tools/db/booking_links.py`

Add two functions at the bottom:

```python
async def save_intake_data(token: str, intake_data: dict) -> None:
    """Cache extraction result on the Booking_Links row."""
    import json
    pool = get_pool()
    async with pool.acquire() as conn:
        await conn.execute(
            f'UPDATE {fq(Table.BOOKING_LINKS)} SET intake_data = $1::jsonb WHERE token = $2',
            json.dumps(intake_data), token,
        )


async def mark_intake_submitted(token: str) -> bool:
    """
    Idempotent: sets intake_submitted_at if null, returns True on first set,
    False if already submitted.
    """
    pool = get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            f'UPDATE {fq(Table.BOOKING_LINKS)} '
            f'SET intake_submitted_at = now() '
            f'WHERE token = $1 AND intake_submitted_at IS NULL '
            f'RETURNING token',
            token,
        )
    return row is not None
```

---

## Phase 4 — Branch the redirect for campaign 59

### File: `/home/gabriel/automations/src/webhooks/booking_routes.py` — modify `booking_link_redirect` (line 993)

At the top of the function, after `lead = await get_lead(link["lead_id"])`, add:

```python
# Campaign-59 branch: legal demo uses a mock intake form, not Cal.com.
campaign_account = await get_campaign_with_account(
    link.get("campaigns_id") or (lead or {}).get("Campaigns_id")
)
if campaign_account and campaign_account.get("id") == 59:
    # On first hit, extract case intake from the conversation and cache it.
    if link.get("intake_data") is None:
        from tools.intake_extractor import extract_intake
        from tools.db.booking_links import save_intake_data
        from tools.db.automation_logs import AsyncLogStep

        async with AsyncLogStep(
            step_name="DemoIntakeExtracted",
            lead_id=lead["id"] if lead else None,
            campaign_id=59,
        ):
            ai_memory = (lead or {}).get("ai_memory") or []
            if isinstance(ai_memory, str):
                ai_memory = json.loads(ai_memory)
            intake = await extract_intake(ai_memory)
            await save_intake_data(token, intake)

    return RedirectResponse(
        url=f"https://app.leadawaker.com/intake/{token}",
        status_code=302,
    )

# ─── existing Cal.com flow continues below unchanged ───
```

**Important:** `get_campaign_with_account` is already imported in the file; verify with grep before assuming.

**Don't break other campaigns:** the campaign-59 branch returns early. Every other campaign falls through to the existing Cal.com logic. No behavior change for solar/gym/dental/coaching.

---

## Phase 5 — FastAPI endpoints

### File: `/home/gabriel/automations/src/webhooks/intake_routes.py` (new)

```python
"""Legal demo intake endpoints — read + submit the mock intake form."""
import logging
from fastapi import APIRouter, HTTPException, Request

from tools.db.booking_links import get_booking_link, mark_intake_submitted
from tools.db.leads import get_lead, update_lead_status  # verify name exists
from tools.db.campaigns import get_campaign_with_account
from tools.db.automation_logs import AsyncLogStep
from tools.whatsapp_sender import send_whatsapp_text  # verify name exists

logger = logging.getLogger("intake_routes")
router = APIRouter()

_LEGAL_CAMPAIGN_ID = 59
_FIRM_NAME = "Summit Injury Law"
_PARALEGAL_NAME = "Marcus Chen"


@router.get("/api/intake/{token}")
async def get_intake(token: str):
    link = await get_booking_link(token)
    if not link:
        raise HTTPException(status_code=404, detail="Link not found")

    lead = await get_lead(link["lead_id"])
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")

    campaign = await get_campaign_with_account(lead.get("Campaigns_id"))
    if not campaign or campaign.get("id") != _LEGAL_CAMPAIGN_ID:
        raise HTTPException(status_code=404, detail="Intake not available for this lead")

    intake = link.get("intake_data") or {}
    return {
        "firm_name": _FIRM_NAME,
        "paralegal_name": _PARALEGAL_NAME,
        "already_submitted": link.get("intake_submitted_at") is not None,
        "prefill": {
            "first_name": lead.get("first_name") or "",
            "last_name": lead.get("last_name") or "",
            "phone": lead.get("phone") or "",
            "incident_type": intake.get("incident_type"),
            "incident_date": intake.get("incident_date"),
            "injury_status": intake.get("injury_status"),
            "jurisdiction": intake.get("jurisdiction"),
        },
    }


@router.post("/api/intake/{token}/submit")
async def submit_intake(token: str, request: Request):
    body = await request.json()

    link = await get_booking_link(token)
    if not link:
        raise HTTPException(status_code=404, detail="Link not found")

    lead = await get_lead(link["lead_id"])
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")

    campaign = await get_campaign_with_account(lead.get("Campaigns_id"))
    if not campaign or campaign.get("id") != _LEGAL_CAMPAIGN_ID:
        raise HTTPException(status_code=400, detail="Not a legal demo lead")

    first_submit = await mark_intake_submitted(token)
    if not first_submit:
        # Idempotent — second click returns ok without re-sending WhatsApp.
        return {"ok": True, "already_submitted": True}

    # Log + status + WhatsApp confirmation — all demo-facing, all non-blocking on failure.
    async with AsyncLogStep(
        step_name="DemoIntakeSubmitted",
        lead_id=lead["id"],
        campaign_id=_LEGAL_CAMPAIGN_ID,
    ):
        await update_lead_status(lead["id"], "DemoIntakeSubmitted")
        confirmation = (
            f"Got it {lead.get('first_name') or 'there'}. Your intake is "
            f"with {_PARALEGAL_NAME} now — he'll call you within 30 minutes."
        )
        try:
            await send_whatsapp_text(to=lead["phone"], body=confirmation, campaign_id=_LEGAL_CAMPAIGN_ID)
        except Exception:
            logger.exception("Intake WhatsApp confirmation send failed")

    return {"ok": True}
```

### Register the router

Find the FastAPI app bootstrap (likely in `/home/gabriel/automations/src/webhooks/__main__.py` or similar). Add:

```python
from src.webhooks.intake_routes import router as intake_router
app.include_router(intake_router)
```

**Open question — function names:** `update_lead_status`, `send_whatsapp_text`, `AsyncLogStep`, `get_campaign_with_account` are inferred from the existing codebase but the exact names need verification. The implementing agent must grep for each before writing the imports. If the canonical name differs, use the canonical one.

---

## Phase 6 — Frontend intake page

### File: `/home/gabriel/LeadAwakerApp/client/src/pages/intake-demo.tsx` (new)

Key shape:

```tsx
// Route: /intake/:token
// Mobile-first. Background is a blurred mock "Summit Injury Law" landing page.
// On top: a modal with the pre-filled form.

type IntakeData = {
  firm_name: string;
  paralegal_name: string;
  already_submitted: boolean;
  prefill: {
    first_name: string;
    last_name: string;
    phone: string;
    incident_type: string | null;
    incident_date: string | null;
    injury_status: string | null;
    jurisdiction: string | null;
  };
};

// Page flow:
// 1. Fetch GET /api/intake/{token}. Loading → skeleton shimmer.
// 2. Error → "This link is no longer active. Contact your paralegal."
// 3. already_submitted=true → success state immediately (no form).
// 4. Render modal with fields:
//    - First name (pre-filled, editable)
//    - Last name (pre-filled, editable)
//    - Phone (pre-filled, editable, tel input)
//    - Incident type (select: car accident / slip and fall / workplace / medical malpractice / other, pre-selected)
//    - Incident date (date input, pre-filled)
//    - Injury status (radio: in treatment / recovered / just starting, pre-selected)
//    - Jurisdiction (text, pre-filled)
//    - Consent checkbox: "I understand this is a free case evaluation and that no attorney-client relationship is created until a retainer agreement is signed."
//    - Submit button (full width, disabled until consent checked).
// 5. On submit → POST /api/intake/{token}/submit → success state.
// 6. Success state: green check, "{paralegal_name} will call you within 30 minutes.", "Return to WhatsApp" button linking to wa.me/31627458300.
```

**Styling:** reuse Tailwind + shadcn patterns from [try-demo.tsx](../../client/src/pages/try-demo.tsx). Green submit button matches the `/try` page (`#25D366` → `#20BC5A`).

**Background mock:** static JSX, no real assets. Header with "Summit Injury Law" wordmark, hero line ("No fee unless we win. Free case evaluation."), dummy contact footer. All behind a `backdrop-blur-sm bg-black/30` overlay to push the modal forward. No real logos, photos, or addresses.

**i18n:** stub `client/src/locales/{en,nl,pt}/intakeDemo.json` with all user-facing strings. Only EN needs to be translated for Phase 2 (campaign is English-only). Other languages can be "TODO" placeholders.

**Route registration:** add to `client/src/App.tsx` in the `!isAppArea` branch (same branch as `/try`), since the intake page is a public consumer-facing flow, not part of the logged-in CRM.

---

## Phase 7 — Verification

Run in this order:

1. **DB migration applied:** `\d p2mxx34fvbf3ll6."Booking_Links"` shows `intake_data` and `intake_submitted_at`.
2. **Redirect branch:** create a fake campaign-59 lead with a populated ai_memory, hit `https://webhooks.leadawaker.com/book/{token}` in a browser, confirm 302 to `https://app.leadawaker.com/intake/{token}`. Confirm a second hit does NOT re-run extraction (check `Automation_Logs` — should only have one `DemoIntakeExtracted` step for this token).
3. **Other campaigns still redirect to Cal.com:** repeat with a campaign-47 (solar) token, confirm Cal.com behavior is unchanged.
4. **GET endpoint:** `curl https://webhooks.leadawaker.com/api/intake/{token}` returns the expected JSON shape with 4 extracted fields populated.
5. **Form renders pre-filled:** load `/intake/{token}` on a phone-width viewport, confirm all pre-fill fields show.
6. **Submit flow:** tap submit, confirm:
   - POST `/api/intake/{token}/submit` returns `{ ok: true }`.
   - WhatsApp confirmation arrives at the lead's number within 10 seconds.
   - `Interactions.status` for this lead = `DemoIntakeSubmitted`.
   - `Automation_Logs` shows `DemoIntakeSubmitted` step.
   - Reloading the page shows the "already submitted" read-only state.
   - Re-submitting via curl returns `{ ok: true, already_submitted: true }` without sending a second WhatsApp.
7. **Full end-to-end:** start fresh on `/try`, run the legal demo conversation to the booking step in WhatsApp, tap the link, submit the form, verify everything above from a real user path.

---

## Dispatch order (Pi RAM discipline)

1. **DB migration** (5s, one SQL).
2. **Python extractor + booking_links helpers + redirect branch** — single engine restart at the end.
3. **Python intake endpoints + router registration** — same engine restart as step 2.
4. **Frontend page + i18n stubs + route registration** — Vite HMR handles it, no restart.

Do not run step 2 and step 4 concurrently. RAM is tight.

---

## Follow-ups (NOT in this spec)

- Promote `booking_mode = 'form'` to a real configurable field on Campaigns with `intake_url`, `intake_fields` JSON schema. Retrofit campaign 59 to use it, retire the hardcoded `== 59` branch.
- Dutch- and Portuguese-language intake pages.
- Real firm integration (Clio, MyCase, Litify).
- Analytics: form-open rate, field-edit rate, abandonment rate, submission rate.
- More demo verticals that use the form pattern (insurance, mortgage).
- Swap the blurred mock background for per-client real branding when a real PI firm signs.

---

## Rollback

If the feature breaks, the single revert is:

```python
# In booking_link_redirect, remove the campaign-59 early-return branch.
# Everything else is additive (new column, new routes, new page) — dead code if the branch is gone.
```

DB migration is safe to leave in place; the new columns are nullable and unused elsewhere.
