# Dispatch Prompt — Spec 1: Calendar Manual Blocks

Implement the **calendar-manual-blocks** feature in the LeadAwaker CRM (`/home/gabriel/LeadAwakerApp`).

## Orient first (do this before any code)
- Invoke the **leadawaker-dev** skill.
- Read root `CLAUDE.md` and `specs/calendar-manual-blocks/` — all three files are the source of truth:
  - `requirements.md` — what + why + acceptance criteria
  - `implementation-plan.md` — phased tasks + technical details (FOLLOW THIS)
  - `action-required.md` — manual steps (do the ones you can; flag the rest)
- This feature reuses the Cal.diy schedule-resync plumbing: `server/calendar/caldiy.ts` (`resyncCaldiySchedule`) and `/home/gabriel/caldiy/scripts/_schedule.ts` (`availabilityFromHours`). Read both before Phase 3.

## Critical project rules (non-negotiable)
- **Never run `npx tsc --noEmit`** unless explicitly asked — it OOMs the Pi. The server auto-reloads via pm2 watch on `server/`+`shared/` saves (~5-8s); never run `npm run dev`.
- **Create the new `calendar_blocks` table via a direct `pg` script** (`node --env-file=.env`) — `npm run db:push` fails on the Pi (no TTY).
- **Timestamps server-side only** (`new Date()` objects). Drizzle-Zod `z.date()` silently rejects ISO strings from the client.
- **i18n**: every user-facing string goes through react-i18next (`client/src/locales/{en,nl,pt}/calendar.json`). No hardcoded strings.
- **Styling**: follow `UI_STANDARDS.md`; use design tokens, no raw hex / `bg-white`.

## The review findings already baked into the spec — DO NOT regress them
These edge cases are real bugs if skipped (see implementation-plan.md Phase 3 "Edge cases"):
1. **Timezone**: blocks are entered in the account timezone; availability rows use the `setUTCHours` wall-clock-as-UTC convention. Subtract intervals in the schedule tz, emit rows with the same convention as `availabilityFromHours`.
2. **Multi-day / cross-midnight blocks** split into one override-row set per calendar date.
3. **No business hours set** → derive the working window from the resolved `DEFAULT_SCHEDULE` fallback, not an empty window.
4. **Block fully covering the window** → emit the single "unavailable" override (verify Cal.com's exact unavailable-row shape — see action-required.md).

## Build it phase by phase
Work through `implementation-plan.md` Phases 1→4, checking off each `- [ ]`. Verify via `pm2 logs` / the booking page, not tsc.

## Parallel-dispatch coordination
If **caldiy-ical-calendar** is being built at the same time, both touch `server/calendar/caldiy.ts` and the caldiy `scripts/` dir — expect a possible merge conflict there; keep your edits additive and isolated to the resync path.
