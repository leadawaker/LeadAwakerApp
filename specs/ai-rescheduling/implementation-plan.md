# Implementation Plan: AI Rescheduling + "Reschedule Call" Button

## Overview

Add a manual reschedule action on the lead booking section (Cal.com native reschedule flow) and an
AI re-engage rescheduling automation in the Python engine. Guarantee rebooks never double-count for
billing/metrics. Handle cancellations cleanly. Most of the webhook plumbing already exists
(`BOOKING_RESCHEDULED`/`BOOKING_CANCELLED`, `calcom_booking_uid`, reschedule counters) — this wires
the entry points and the AI flow.

---

## Phase 1: "Reschedule call" button (manual path)

### Tasks

- [x] Expose `calcom_booking_uid` on the lead in the client API if not already returned (added to shared/schema.ts; toDbKeys serializes it as snake_case automatically)
- [x] Add a "Reschedule call" action to [LeadBookingSection.tsx](client/src/features/leads/components/leadDetail/LeadBookingSection.tsx)
  - [x] A button that opens a small menu/popover: **"Pick a new time"** and **"Let AI rebook"**
  - [x] "Pick a new time" opens the Cal.com reschedule URL in a new tab: `https://cal.leadawaker.com/reschedule/${lead.calcom_booking_uid}`
  - [x] "Let AI rebook" POSTs to `/api/leads/{id}/reschedule-reengage` (Express proxies to engine) with reason `client_requested`
  - [x] Inline warning text: "Don't move this call by editing your own calendar — it won't sync. Use this button."
  - [x] i18n strings → `client/src/locales/{en,nl,pt}/leads.json`
- [x] Disable/hide "Pick a new time" if `calcom_booking_uid` is missing (older bookings); fall back to "Let AI rebook"

### Technical Details

- **Cal.com reschedule URL:** `{webappUrl}/reschedule/{bookingUid}` redirects to the booking page in
  reschedule mode; completing it cancels the old slot and creates the new one, firing
  `BOOKING_RESCHEDULED`. The webhook's existing reschedule path
  (`booking_routes.py` ~line 668: "Updates booked_call_date and calcom_booking_uid") then updates the
  lead in place. No new webhook code needed for the happy path — verify it increments
  `re_scheduled_count` and sets `previous_booked_call_date`.
- The Cal.diy public URL is the same base used for the booking link in the provision script
  (`${webappUrl}/${username}/30min`); reuse that base for `/reschedule/`.
- Keep the booking section's existing display (it already renders previous date + reschedule count).

---

## Phase 2: AI re-engage rescheduling automation (Python)

### Tasks

- [x] Add an engine endpoint `POST /api/leads/{id}/reschedule-reengage` (body: `{ reason }`) in `src/main.py`
- [x] Implement the rescheduling flow in `src/automations/reschedule_reengage.py`
  - [x] Load the lead, its campaign, and the full conversation history
  - [x] Compose a context-aware re-engagement message via Prompt_Library `system:reschedule-reengage` (prompt id=99)
  - [x] Send it on the lead's active channel (WhatsApp), reusing the existing send path
  - [x] Sets `previous_booked_call_date` and increments `re_scheduled_count` before sending (so rebook-via-link is idempotent)
  - [x] Log every step to `Automation_Logs` via `AsyncLogStep`
- [x] Wire the frontend "Let AI rebook" button (Phase 1) to `/api/leads/{id}/reschedule-reengage` via Express proxy

### Two reschedule mechanisms (do not conflate)

| Path | How it fires | Webhook handler | Increments `re_scheduled_count`? |
|------|--------------|-----------------|----------------------------------|
| "Pick a new time" (Cal.com `/reschedule/{uid}`) | `BOOKING_RESCHEDULED` | `_handle_reschedule` | Yes (handler does it) |
| AI rebook via booking link | fresh `BOOKING_CREATED` (new UID) | `_handle_booking` + auto-cancel-previous | No — the AI flow must set it |

### Technical Details

- Read `/home/gabriel/automations/CLAUDE.md` first. Reuse `ai_conversation.py` send + the
  re-engagement/bump machinery rather than building a new sender.
- **Prompt source of truth:** create the `system:reschedule-reengage` prompt in Prompt_Library;
  `_load_prompt()` reads Prompt_Library first. [[feedback_prompt_source_of_truth]]
- The prompt should: acknowledge the change neutrally (don't blame the lead), reference the prior
  agreed intent, and ask for a new time / re-share the booking link. en + nl only
  (pt-BR dropped from campaign content). [[project_campaign_locales_en_nl]]
- `reason` values: `client_requested`, `no_show`, `lead_requested`, `cancelled` — shape the opening
  line per reason.

---

## Phase 3: Billing — durable booking signal (NOT a per-event guard)

Verified: bookings are counted as `COUNT(*) FILTER (WHERE "Conversion_Status" = 'Booked')`
(`/home/gabriel/automations/tools/db/leads.py:304`) — by lead status, not by events. So rebooks
already can't double-count (same lead, still `Booked`). The real risk is the *opposite*: a
cancellation flipping the lead out of `Booked` silently erases the charge. This phase makes the
billable signal durable.

### Tasks

- [x] Decided durable signal: `billable_booking` boolean column (set TRUE on first `BOOKING_CREATED`, never cleared)
- [x] Added `billable_booking` column to DB; backfilled 22 existing booked leads; added to Drizzle schema
- [x] `_handle_booking` now sets `billable_booking=True` on every new booking
- [x] `get_campaign_lead_metrics` now returns both `bookings_count` (live, for analytics) and `billable_bookings_count` (durable, for billing)
- [x] Verified: `_handle_reschedule` updates in place (`Conversion_Status` stays `Booked`) — lead never transiently leaves Booked
- [ ] Confirm test: book → reschedule twice → cancel → billable count for that lead is still 1 (manual verification needed)

### Technical Details

- The webhook sets `is_reschedule = (trigger == "BOOKING_RESCHEDULED")` and auto-cancels the previous
  booking when a lead rebooks via the link (`booking_routes.py:377`). The auto-cancel emits a
  `BOOKING_CANCELLED` for the *old* UID — Phase 4 must ignore that one for status/billing.
- Keep analytics (no-show rate, reschedule rate) separate from the billable count; only the billable
  count needs the durable signal.

---

## Phase 4: Cancellation handling

### Tasks

- [x] Distinguish the two cancellation sources: if `cancelled_uid != lead.calcom_booking_uid`, it's an auto-cancel of the previous slot → skip all state changes
- [x] On auto-cancel-of-previous: logs `skipped` and returns immediately
- [x] WHO cancelled distinction: `client_cancelled_booking` boolean column on Leads (set by CRM before calling Cal.diy); webhook checks it — client-cancel → `Responded/active`, lead-cancel → `Cancelled/inactive`; flag reset to False after use
- [x] CRM "Cancel call" button on `LeadBookingSection.tsx` (inside Reschedule popover, with two-step confirm); calls `POST /api/leads/:id/cancel-booking` → Express → Python engine → sets flag + calls Cal.diy API to cancel
- [x] Lead-cancel: `Conversion_Status=Cancelled`, `automation_status=inactive`; `billable_booking` and `booking_confirmed_at_` preserved
- [x] Client-cancel: `Conversion_Status=Responded`, `automation_status=active`; `billable_booking` and `booking_confirmed_at_` preserved
- [ ] Optional auto-trigger AI re-engage on genuine cancel (deferred — per-campaign flag not yet added)

### Technical Details

- The webhook already branches on `action == "cancel"`; extend it to detect the reschedule-driven
  auto-cancel (it just cancelled `old_uid` itself at `booking_routes.py:392`) and skip state changes
  for it, so only a genuine cancellation changes lead state.
- **Do not clear `booking_confirmed_at` / `billable_booking` on cancel** — that is the charge anchor.
  Only `Conversion_Status` and the display fields move.
- Keep all changes logged to `Automation_Logs`.
