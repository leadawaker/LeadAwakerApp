# Speed-to-Lead — Implementation Plan

> Paths verified against the current tree (this session). Engine = `/home/gabriel/automations/`,
> CRM = `/home/gabriel/LeadAwakerApp/`. Builds on the `campaign_type` foundation already shipped by
> the Reputation spec (`specs/reputation-management/`).

## Architecture decision: reuse + inline dispatch, NOT duplication

Same principle as Reputation: do **not** fork the reactivation scripts. Speed-to-Lead is almost
entirely **reuse** — the only genuinely new behavior is firing the first message *inline* instead of
on the poll, plus a cold-template opener.

- **Do not touch** `ai_conversation.py`, `bump_scheduler.py`, or `campaign_launcher.py`. The inline
  first-touch **reuses** `campaign_launcher._render_first_message` (import it) and
  `send_service.send_message` — it does not modify the launcher.
- **Outbound first-touch is a new, self-contained module** (`speed_to_lead.py`) next to
  `reputation_scheduler.py`. It renders + sends + claims + logs. No scheduler job is registered
  (unlike Reputation): speed-to-lead is **event-driven**, fired from the intake request, not polled.
- **Inbound is the shared funnel and is left alone.** Once a speed-to-lead lead replies, the existing
  `inbound_handler.py` default path → `run_ai_conversation()` is exactly what we want. **No inbound
  dispatch branch is added** (this differs from Reputation, which needed one to intercept replies).
- **Intake reuses the existing adapters layer** (`src/api/adapters/`) and its `tools/db/lead_intake`
  primitives (auth, campaign validation, E.164, `check_duplicate_phone`, `insert_intake_lead`). The
  only edit to existing adapters is a **small dispatch branch**: after insert, if the campaign is
  `speed_to_lead`, schedule the inline first-touch.

Net: reactivation/reputation logic is isolated and unchanged; the only edits to existing code are the
intake dispatch branch and a new adapter. All new behavior lives in new files.

## Phase 0 — `campaign_type` foundation (already done)

Shipped by the Reputation spec. **No work here.** Confirm only:
- `Campaigns.campaignType` exists (default `'reactivation'`, schema.ts:352).
- The value `'speed_to_lead'` is an accepted `campaign_type` (it is text; just create campaigns with
  it). No migration needed — `lead_source` (`Leads.Source`) and `Accounts.webhook_secret` already
  exist too.

## Phase 1 — Inline first-touch dispatch (the core new work)

**a) New module** — `src/automations/speed_to_lead.py`, `async def fire_first_touch(lead_id, campaign,
account, exec_id)`:

1. **Claim the lead** — `claim_lead_for_first_send(lead_id)` (existing, `tools/db/leads.py`). If it
   returns falsy, the `campaign_launcher` poll already took it → **no-op and return** (double-send
   guard, FR-4).
2. **Render the opener** — reuse `campaign_launcher._render_first_message(lead=, campaign=,
   first_message_template=campaign["First_Message"], ...)`. (Imported, not modified.)
3. **Send via the template channel** (FR-3) — cold first-touch needs an approved template, sent from
   the **client's own WhatsApp number** (provider: **Twilio** — one Twilio number per client in their
   subaccount, serving both WhatsApp + SMS; see `specs/channel-fallback/`). SMS fallback / `sms_first`
   come from that cross-cutting spec.
   - **Twilio WhatsApp** clients (the default for real clients): `send_message(channel="whatsapp",
     whatsapp_template_sid=campaign["twilio_first_message_template_sid"],
     whatsapp_template_variables={...}, phone=...)`, passing the account's own
     `twilio_account_sid` / `twilio_auth_token` / `twilio_default_from_number` /
     `twilio_messaging_service_sid` (from the Accounts row) so the opener is sent **from the
     client's number**, not ours. `tools/send_service.py` already threads these through.
   - **WhatsApp Cloud** (our number — for demos / our own outreach): `send_template_message(phone=,
     template_name=, language=, ...)` (`tools/whatsapp_cloud.py`). The rendered body fills the
     template's body variables.
   - Pick the channel from the campaign's `channel` field (default `sms`; speed-to-lead campaigns are
     `whatsapp`/`whatsapp_cloud`).
4. **Persist state server-side** — set `first_message_sent_at = NOW()`, `automation_status='active'`
   (mirror what `campaign_launcher` does post-send), record an outbound interaction
   (`create_interaction`).
5. **Log each step** — `AsyncLogStep("speed_to_lead", "<step>", workflow_execution_id=exec_id,
   accounts_id=, campaigns_id=, leads_id=)`. Steps: `claim`, `render`, `send_template`, `mark_active`.

No scheduler registration (`src/scheduler/jobs.py` untouched) — this is fired inline, not polled.

**Design note — why keep `queued` + claim, instead of "never queue speed-to-lead leads":** an
alternative is to have `insert_intake_lead` set a non-`queued` status for speed-to-lead so the poll
never selects them (no race at all). We deliberately keep them `queued` and rely on the atomic claim
because **the poll then becomes a free durability fallback**: FastAPI `BackgroundTasks` runs
in-process *after* the 200 response, so if the engine restarts/crashes in that window the inline send
is lost — but the lead is still `queued`, and the next launcher poll sends it (≤60s worst case)
instead of it being stranded. The claim guarantees exactly one send; the queue guarantees the send is
never dropped. (If `claim_lead_for_first_send` semantics make a clean atomic claim awkward, fall back
to the "never queue" variant — but then add an explicit retry sweep.)

**b) Intake dispatch branch** — in each existing adapter (`src/api/adapters/facebook.py`,
`ghl.py`, `hubspot.py`, `instagram.py`), immediately after the successful `insert_intake_lead(...)`:

```
if campaign_id is not None:
    campaign = await get_campaign_with_account(campaign_id)   # already used elsewhere
    if (campaign or {}).get("campaign_type") == "speed_to_lead":
        background_tasks.add_task(fire_first_touch, lead_id, campaign, account, exec_id)
# else: leave automation_status='queued' → campaign_launcher poll handles it as today
```

- Add `background_tasks: BackgroundTasks` to each adapter's route signature (FastAPI injects it). The
  webhook returns its existing 200 JSON immediately; the send runs after the response (FR-2,
  burst-safe NFR).
- This is the **only** edit to the existing adapters — a guarded branch. Non-`speed_to_lead`
  campaigns are completely unaffected (still queue for the poll).
- Factor the branch into a tiny shared helper (e.g. `speed_to_lead.maybe_dispatch(lead_id,
  campaign_id, account, background_tasks, exec_id)`) so all four adapters call one line, not copy.
- **Alternative considered — dispatch from the single chokepoint (`insert_intake_lead`):** all
  adapters already funnel through `insert_intake_lead`, so putting the dispatch there would cover
  current *and future* adapters with zero per-adapter edits. Rejected because `insert_intake_lead` is
  a DB-layer helper with no `BackgroundTasks` handle, and firing a paid WhatsApp send from inside a
  DB insert is a layering smell. The per-adapter one-liner keeps the send at the route layer (where
  `BackgroundTasks` is injected) and stays explicit. Revisit if the adapter count grows.

**c) Verification of Phase 1:** seed a `speed_to_lead` campaign with an approved template + a lead via
the FB adapter → first WhatsApp fires within seconds (Automation Logs `speed_to_lead`), and the
launcher poll does **not** double-send. A `reactivation` campaign through the same adapter still
queues for the poll (unchanged).

## Phase 2 — Generic form / Zapier adapter

**New adapter** — `src/api/adapters/form.py` (the strategy doc's `inbound_lead_routes.py`), mounted
under the existing `/api/leads/intake` prefix and registered in `src/main.py` (`include_router`):

- `POST /api/leads/intake/form?key=<webhook_secret>&campaign_id=<id>` accepting a normalized JSON body
  `{ first_name?, last_name?, full_name?, phone, email?, source? }`.
- Reuse the **same primitives** as the source adapters (do **not** copy the legal `intake_routes.py`):
  `get_account_by_api_key(key)` → auth; `validate_campaign_ownership(campaign_id, account_id)`;
  `_normalize_phone` (lift the shared helper or move it to `tools`); `check_duplicate_phone`;
  `insert_intake_lead(..., source=source or "website_form")`.
- Same Phase-1 dispatch branch (`maybe_dispatch`) for inline first-touch.
- Same `AsyncLogStep("lead_intake", "form_create_lead", ...)` logging.
- Document the per-source `source` convention (`website_form`, `zapier:<name>`) so reporting is clean.

(FB/IG/GHL/HubSpot already have adapters — this just adds the "any form / Zapier" path.)

## Phase 3 — Account / campaign settings (the only UI in this spec)

No schema change. A small settings surface so onboarding doesn't require DB edits:

- **Inbound setup panel** (account settings, modeled on
  `features/accounts/components/KnowledgeBasePanel.tsx`): show the account's `webhook_secret` (the
  API key, read-only / regenerate), the **intake webhook URLs** (one per source:
  `…/api/leads/intake/{facebook,instagram,ghl,hubspot,form}?key=…&campaign_id=…`), and an
  **inbound-campaign picker** that fills `campaign_id` (the campaign the source maps to). Tokens only
  (no hardcoded hex), i18n in the `accounts` namespace, right-panel/inline (never a backdrop dialog).
- **Campaign settings**: surface `campaign_type` (select including `speed_to_lead`), the cold-open
  **template reference** (`twilio_first_message_template_sid` for Twilio; a Cloud `template_name` +
  `language` if/when that field is added), and the persona/booking-mode fields (existing).
- **Lead card/detail**: show `Source` (small chip) so clients see attribution. i18n the label.

The richer Speed-to-Lead workspace (source dashboard / inbound feed), if built, is integrated later
from the Claude Design output — not here.

## Files touched (representative)

**New (engine):** `src/automations/speed_to_lead.py` (inline first-touch + `maybe_dispatch`),
`src/api/adapters/form.py` (generic form/Zapier adapter).
**Edited (engine, minimal):** `src/api/adapters/facebook.py`, `ghl.py`, `hubspot.py`,
`instagram.py` (one-line dispatch branch + `BackgroundTasks` param each); `src/main.py` (register the
form adapter). **Not touched:** `ai_conversation.py`, `bump_scheduler.py`, `campaign_launcher.py`,
`inbound_handler.py`, `src/scheduler/jobs.py`.
**CRM schema:** none required (fields already present). **CRM UI/server:** inbound-setup +
campaign-type settings under `features/accounts/` & `features/campaigns/`, `Source` chip in
`features/leads/`; existing `accounts`/`campaigns`/`leads` routes+storage already accept these fields.

## Verification (end-to-end)

1. **No migration needed** — confirm `campaign_type`, `Source`, `webhook_secret` columns exist
   (`\d "Campaigns"`, `\d "Leads"`, `\d "Accounts"`).
2. **Reactivation/Reputation regression:** an intake on a `reactivation` campaign still sets
   `automation_status='queued'` and is sent by the poll (Automation Logs `campaign_launcher`,
   unchanged); a reputation lead reply still routes to `reputation_handler`.
3. **Speed-to-Lead happy path:** seed a `speed_to_lead` campaign (approved template) → POST a lead via
   the FB adapter → opener fires inline within seconds (Automation Logs `speed_to_lead`: `claim` →
   `render` → `send_template` → `mark_active`), sent from the client's own number; reply
   "yes, tell me more" (en) / "ja, vertel me meer" (nl) → handled by `run_ai_conversation()`
   (normal qualification/booking).
4. **Double-send guard:** force the poll to run concurrently → only one opener is sent (claim wins).
5. **Dedup:** POST the same phone twice → second returns `duplicate`, no second message.
6. **Cold-template enforced:** with no approved template configured, the opener is **not** sent as
   free-text — it errors/logs clearly (never a silent free-text cold send).
7. **Generic form adapter:** POST `/api/leads/intake/form` → deduped lead with `Source='website_form'`
   + inline first-touch on a `speed_to_lead` campaign.
8. `pm2 restart leadawaker-engine --update-env` picks up the new module + adapter (engine has
   `watch:false`; Python edits are not live until restart). The Express server auto-reloads via pm2
   watch.
