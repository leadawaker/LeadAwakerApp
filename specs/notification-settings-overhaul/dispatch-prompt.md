# Dispatch Prompt — Spec 2: Notification Settings Overhaul

Implement the **notification-settings-overhaul** feature in the LeadAwaker CRM (`/home/gabriel/LeadAwakerApp`). This spans the React CRM, the Express server, AND the Python engine.

## Orient first (do this before any code)
- Invoke the **leadawaker-dev** skill.
- Read root `CLAUDE.md`, `/home/gabriel/automations/CLAUDE.md` (you will edit the Python engine), and all three files in `specs/notification-settings-overhaul/` — the source of truth.
- Read both notifiers before coding: Express `server/notification-dispatcher.ts` AND Python `/home/gabriel/automations/tools/notification_service.py` (`notify()` + `DEFAULT_TYPE_CHANNELS`). Read the booking caller `/home/gabriel/automations/src/webhooks/booking_routes.py` (~line 623-645).

## THE critical architecture fact (the whole point of this spec)
There are **two independent notification systems**. **Real Cal.diy bookings flow through the PYTHON `notify()`**, which today notifies ONLY the account owner (`u.email = a.owner_email`). The Express `leads.ts:201` path only fires on manual CRM status flips and only to agency.
- The **email channel + multi-recipient logic must be implemented in PYTHON** (Phases 2 & 3). The Express dispatcher gets the email channel only for parity on the flows it owns — it is NOT the booking path.
- The frontend toast comes from **DB persistence + `/api/notifications` refetch** on an `/api/interactions/stream` ping — NOT a notification SSE event. So "fix the recipient rows," not the SSE bus.
- Do not re-introduce the wrong premise that "clients get nothing" — the owner already gets in-app/push; the gaps are: no email anywhere, non-owner client users missed, agency missed on real bookings.

## Critical project rules (non-negotiable)
- **Never run `npx tsc --noEmit`** unless asked (OOMs the Pi). Server + Python engine: verify via `pm2 logs`. The Python engine may need a manual restart after new modules.
- **Add the `email_enabled` column via a direct `pg` script** (`node --env-file=.env`) — not `db:push` (no TTY).
- **i18n**: new settings strings in `client/src/locales/{en,nl,pt}/settings.json`.
- Both notifiers read the SAME `Notification_Preferences` table — keep the channel-merge order identical (type default ← user override ← global toggle).
- Reuse existing SMTP senders: Express `sendRawEmail` (`server/email.ts`), Python's existing SMTP helper. Do NOT add a second transport.

## Build it phase by phase
`implementation-plan.md` Phases 1→4: (1) schema `email_enabled` + types, (2) email channel in BOTH dispatchers, (3) Python booking recipients (all Viewers + agency, deduped), (4) role-aware UI (clients: only Booked+Campaign-finished, Email+Push columns, no Telegram, no standalone push card). Check off each `- [ ]`.

## Parallel-dispatch coordination
**ai-rescheduling** also edits `server/routes/leads.ts` and the Python engine — coordinate / expect conflicts there. The booking-branding spec's organizer-email suppression is independent of this (don't touch Cal.diy here).
