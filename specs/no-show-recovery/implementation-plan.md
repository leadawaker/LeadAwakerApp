# Implementation Plan: No-Show Recovery

## Overview

Client-facing no-show reporting (3 placements, one dialog, 3 reasons), reason-mapped follow-up automations in the Python engine, a new 2-step recovery ladder, and a 48h post-call autonomous AI window with classifier-routed behavior afterwards.

Two repos are touched: **LeadAwakerApp** (schema, Express route, UI) and **/home/gabriel/automations** (engine endpoint, follow-up flows, scheduler job, window logic). Engine changes need `pm2 restart leadawaker-engine --update-env`; Express/client hot-reload via tsx watch.

## Phase 1: Schema + claim API

Store the claim on the lead and expose one authenticated endpoint.

### Tasks
- [ ] Add claim columns to Leads: `no_show_reason` (text), `no_show_reported_at` (timestamptz), `no_show_reported_by` (bigint, user id), `no_show_followup_stage` (integer, for the Phase 3 ladder)
- [ ] Mirror the new columns in `shared/schema.ts` (leads table, camelCase mappings)
- [ ] Add Express route `POST /api/leads/:id/no-show` in `server/routes/leads.ts` (validation + persist + fire-and-forget engine call)

### Technical Details

DDL (run with a direct `pg` script, `node --env-file=.env`; `npm run db:push` fails without a TTY on the Pi):

```sql
ALTER TABLE "Leads"
  ADD COLUMN IF NOT EXISTS no_show_reason text,
  ADD COLUMN IF NOT EXISTS no_show_reported_at timestamptz,
  ADD COLUMN IF NOT EXISTS no_show_reported_by bigint,
  ADD COLUMN IF NOT EXISTS no_show_followup_stage integer;
```

`shared/schema.ts` additions next to the existing `noShow: boolean("no_show")` (~line 710):

```ts
noShowReason: text("no_show_reason"),
noShowReportedAt: timestamp("no_show_reported_at", { withTimezone: true }),
noShowReportedBy: bigint("no_show_reported_by", { mode: "number" }),
noShowFollowupStage: integer("no_show_followup_stage"),
```

Express route (copy the proxy pattern from `server/routes/leads.ts:391-401`, the reschedule-reengage route):
- `requireAuth`, resolve lead, enforce account scoping like sibling routes.
- Validate: body `reason` in `{"not_interested","wants_other_time","no_reason"}` (400 otherwise); lead `conversionStatus === "Booked"` (409 `not_booked`); `bookedCallDate` in the past (409 `call_not_past`); `now <= bookedCallDate + 48h` (409 `window_expired`); `noShow` not already true (409 `already_reported`).
- Persist via storage layer (add method in `server/storage/leads.ts`, keep the `storage` barrel as the consumer API): `no_show=true, no_show_reason, no_show_reported_at=new Date(), no_show_reported_by=req.user.id` (timestamps server-side with `new Date()`, never ISO strings from client).
- Fire-and-forget `fetch(`${getEngineUrl()}/api/leads/${leadId}/no-show`, {method:"POST", body: JSON.stringify({reason})})`, same error-tolerant pattern as the rebook route.

## Phase 2: Engine follow-up dispatch

One engine endpoint that maps reason to flow.

### Tasks
- [ ] Add `POST /api/leads/{lead_id}/no-show` endpoint in `src/main.py` (mirror the `reschedule_reengage` endpoint shape: validate reason, `asyncio.create_task`, return immediately)
- [ ] Create `src/automations/no_show_recovery.py` with the dispatcher + the `no_reason` check-in sender [complex]
  - [ ] `not_interested` branch: `update_lead_status(lead_id, conversion_status="Lost", automation_status="completed")` + `apply_event_tags(..., "lead_lost", workflow="no_show_recovery")`, no outbound message
  - [ ] `wants_other_time` branch: `await trigger_reschedule_reengage(lead_id, "no_show")` (existing flow, sends rebook link)
  - [ ] `no_reason` branch: AI-drafted gentle check-in (no booking link), set `no_show_followup_stage=1`, reset `automation_status='active'` so the lead's reply gets a normal AI turn
- [ ] Add Prompt_Library global prompt for the check-in message (key e.g. `no_show_checkin`), en + nl guidance, tone: "we had elkaar niet te pakken, druk dagje? nog steeds interesse?" — no link, one question
- [ ] Skip-guards in the dispatcher: `opted_out`, `manual_takeover`, DNC status → log and do nothing
- [ ] Reset claim state on rebooking: in `src/webhooks/booking_routes.py`, the BOOKING_CREATED lead update (~line 520) also clears `no_show=False, no_show_reason=None, no_show_reported_at=None, no_show_reported_by=None, no_show_followup_stage=None`. Without this a rebooked lead can never be claimed again (409 already_reported) and a stale ladder could message after a successful rebook

### Technical Details

- Follow `reschedule_reengage.py` as the template: `get_global_prompt` for the drafting prompt, `generate_response` to draft, `validate_output` guardrail, `send_message`, `create_interaction(triggered_by="no_show_recovery")`, `increment_message_count`, all steps wrapped in `AsyncLogStep`/`log_step` (mandatory per automations CLAUDE.md).
- Localize by `lead.language` (lead-first, the established resolution order).
- The check-in must NOT include the booking link. `_FALLBACK` copies (used when drafting fails), en: "Hi {first_name}, looks like we missed each other for our call. Busy day? Still interested?" nl: "Hoi {first_name}, we hadden elkaar net niet te pakken voor ons gesprek. Druk dagje? Is er nog interesse?"
- Read `/home/gabriel/automations/CLAUDE.md` before implementing this phase.

## Phase 3: 24h ladder step (scheduler)

Second message with the booking link if the lead never replied to the check-in.

### Tasks
- [ ] Add `no_show_followup` scheduler job (register alongside the existing jobs in the scheduler setup in `src/main.py`; 15-min interval is fine)
- [ ] Job logic: select leads with `no_show_followup_stage=1` AND `no_show_reason='no_reason'` AND last outbound > 24h ago AND no inbound since the check-in; send booking-link message (reuse `get_or_create_booking_link`), set stage=2 (terminal)
- [ ] Stop conditions: any inbound from the lead clears the ladder (set stage=2 without sending; the normal AI conversation owns the thread from there); skip-guards same as Phase 2

### Technical Details

- "No inbound since check-in" check: compare latest inbound `Interactions.created_at` for the lead against `no_show_reported_at` (or the check-in interaction timestamp).
- Booking-link message can reuse the `reschedule_reengage` drafting prompt with reason hint `no_show`, or a static localized template; keep it one message, link included.
- Scheduler registration follows the existing pattern (see `scheduler.registered` list: campaign_launcher, bump_scheduler, booking_reminder, ...). All steps logged via `AsyncLogStep`.

## Phase 4: 48h autonomous window

Time-box the post-completion AI, and keep the system autonomous after the window closes.

### Tasks
- [ ] In the completed-lead path of `src/automations/ai_conversation.py`: allow the normal AI turn only while `now <= booked_call_date + 48h` (for leads that were Booked; non-booked completed leads keep today's behavior) [complex]
  - [ ] Within window: unchanged (classic/Live turn, [SILENT] available to classic)
  - [ ] Past window: run a cheap rebook-intent check on the inbound (Groq ladder, same client pattern as `detect_conversation_end` in `tools/ai_service.py`); on rebook intent → `trigger_reschedule_reengage(lead_id, "lead_requested")`; otherwise send nothing
- [ ] Past-window, no-intent case: create a user notification ("lead resurfaced after closed conversation") via the engine's own `tools.notification_service.notify()` (persists + SSE + telegram/web-push, already user-scoped). Recipient: account owner via the `owner_email` join pattern in `inbound_handler._notify_lead_responded`
- [ ] Add `detect_rebook_intent(text) -> bool` to `tools/ai_service.py` (same conservative style + Groq fallback ladder as `detect_conversation_end`)

### Technical Details

- Locate the completed-lead handling via the existing `automation_status == 'completed'` checks in `ai_conversation.py` (the Live eligibility gate at ~line 194 and the classic courtesy-reply path). The window check gates BOTH.
- Notification: the engine writes notifications the Express side broadcasts; follow the existing engine→CRM notification pattern used by booking notifications. Verify the SSE scope bug note: user-scoped delivery only.
- Rebook-intent classifier prompt: answer `rebook` only for explicit requests to reschedule/rebook/new time; `other` for everything else; when in doubt `other`.

## Phase 5: UI (one dialog, three placements)

### Tasks
- [ ] Create shared `NoShowDialog` component in `client/src/features/leads/components/` (radio group with the 3 reasons, confirm/cancel, TanStack mutation to `POST /api/leads/:id/no-show`, invalidate lead queries on success) [complex]
- [ ] Add button + claimed-state badge to `LeadBookingSection.tsx` (next to the existing rebook button; same visibility rule)
- [ ] Add button to calendar booking detail (`client/src/features/calendar/components/DesktopCalendarDetail.tsx`) for past-start bookings of Booked leads within the window
- [ ] Add row action on the Contacts page table/pipeline for Booked leads (same visibility rule)
- [ ] i18n strings in `client/src/locales/{en,nl}/leads.json` (+ `calendar.json` for the calendar placement): button label, dialog title, 3 reason labels, confirm, claimed badge, window-expired tooltip
- [ ] Shared visibility helper (booked + call past + within 48h + not yet claimed) exported from the leads feature so all three placements use identical logic

### Technical Details

- Lazy-load the dialog if it pulls weight; pages are lazy everywhere per architecture conventions.
- Styling: tokens only (dark mode live), follow `UI_STANDARDS.md`; shadcn `Dialog` + `RadioGroup` per `UI_PATTERNS.md`.
- Claimed badge copy: reason label + relative date; show reporting user only for Owner role.
- Mobile: same button in the mobile lead detail variant if it renders `LeadBookingSection`; otherwise defer mobile to a follow-up.
- Suggested visibility helper:

```ts
export function canReportNoShow(lead: Lead, now = new Date()): boolean {
  if (lead.conversionStatus !== "Booked" || lead.noShow) return false;
  if (!lead.bookedCallDate) return false;
  const call = new Date(lead.bookedCallDate);
  return call < now && now.getTime() - call.getTime() <= 48 * 3600 * 1000;
}
```
