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

- [ ] Expose `calcom_booking_uid` on the lead in the client API if not already returned (verify the
      leads serializer includes it; Python writes it, the frontend needs it to build the reschedule URL)
- [ ] Add a "Reschedule call" action to [LeadBookingSection.tsx](client/src/features/leads/components/leadDetail/LeadBookingSection.tsx)
  - [ ] A button that opens a small menu/popover: **"Pick a new time"** and **"Let AI rebook"**
  - [ ] "Pick a new time" opens the Cal.com reschedule URL in a new tab: `${CALDIY_WEBAPP_URL}/reschedule/${lead.calcom_booking_uid}`
  - [ ] "Let AI rebook" POSTs to a new engine endpoint (Phase 2) with the lead id + reason `client_requested`
  - [ ] Inline warning text: "Don't move this call by editing your own calendar — it won't sync. Use this button."
  - [ ] i18n strings → `client/src/locales/{en,nl,pt}/leads.json`
- [ ] Disable/hide "Pick a new time" if `calcom_booking_uid` is missing (older bookings); fall back to "Let AI rebook"

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

- [ ] Add an engine endpoint `POST /api/leads/{id}/reschedule-reengage` (body: `{ reason }`) that
      kicks off the rescheduling flow for one lead [complex]
- [ ] Implement the rescheduling flow in a new module (e.g. `src/automations/reschedule_reengage.py`)
  - [ ] Load the lead, its campaign, and the full conversation history
  - [ ] Compose a context-aware re-engagement message via a new Prompt_Library entry
        `system:reschedule-reengage` (NOT the campaign field), passing the conversation + `reason`
  - [ ] Send it on the lead's active channel (WhatsApp), reusing the existing send path
  - [ ] Re-arm the lead for re-engagement using the contact-later mechanism (transient tag + unfreeze
        on reply) so the AI continues the booking conversation and re-shares the booking link
  - [ ] Log every step to `Automation_Logs` via `log_step` / `AsyncLogStep`
- [ ] Wire the frontend "Let AI rebook" button (Phase 1) to this endpoint

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

## Phase 3: Billing / metrics guard (no double-count)

### Tasks

- [ ] Audit how bookings are counted for invoicing/metrics in
      `src/automations/metrics_aggregator.py` and any billing rollup
- [ ] Ensure only the FIRST `BOOKING_CREATED` per lead counts; `BOOKING_RESCHEDULED` (and the
      auto-cancel of the prior booking) must NOT increment the booking count [complex]
  - [ ] If counting is derived from a status flip to Booked, guard on `oldStatus !== "Booked"`
        (already the pattern in `server/routes/leads.ts:202`) so a reschedule that stays Booked
        doesn't recount
  - [ ] If counting is derived from booking rows/events, filter out `is_reschedule` events and
        cancellations-from-reschedule
- [ ] Add/confirm a test: book → reschedule twice → booking count for that lead is exactly 1

### Technical Details

- The webhook already sets `is_reschedule = (trigger == "BOOKING_RESCHEDULED")` and auto-cancels the
  previous booking (`booking_routes.py:377` "Auto-cancel previous booking if lead rebooks via the
  same link"). Use `is_reschedule` as the guard signal.
- Confirm the auto-cancel's `BOOKING_CANCELLED` for the superseded slot does not decrement/►flip the
  lead away from Booked (it shouldn't, because the new slot's reschedule update lands).

---

## Phase 4: Cancellation handling

### Tasks

- [ ] Define lead state on a genuine `BOOKING_CANCELLED` (not the auto-cancel-of-previous during a
      reschedule): clear/struck the booked call, set an appropriate status (e.g. back to a follow-up
      state), record a `booking_cancelled_at`
- [ ] Distinguish the two cancellation sources in the webhook: auto-cancel-of-previous (part of a
      reschedule, no lead state change) vs. a real cancellation (update lead state)
- [ ] Optional, behind a per-campaign flag: a real cancellation auto-triggers the Phase 2 AI
      re-engage flow with `reason = "cancelled"`

### Technical Details

- The webhook already branches on `action == "cancel"`; extend it to differentiate the
  reschedule-driven auto-cancel (the `old_uid` it just cancelled itself, `booking_routes.py:392`)
  from an externally-initiated cancellation, so only the latter changes lead state.
- Keep all changes logged to `Automation_Logs`.
