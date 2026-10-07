# Voice calls: Callers view

Status: FINAL, approved for build 2026-10-06. Builds on `specs/voice-calls-demo-tab/` (built).

## Goal

A second way to look at `/platform/voice-calls`: one row per **person** Sara spoke to instead of one
row per call. For each person: how many calls, how it went, what it created (lead, booking), and two
actions: **Call back** (a human dials) and **Push to HubSpot** (Owner only).

## Decisions (2026-10-06)

| Topic | Decision |
|---|---|
| Placement | A `Calls | Callers` segmented control. It is independent of `Live | Demo`: Live/Demo picks the data (Owner only), Calls/Callers picks the view (everyone with access). |
| Access | Unchanged rule. Clients see callers from their own account's Live calls only. Demo callers are Owner only. Enforced server-side with the existing `resolveVoiceAccess` / `decideScope`. |
| Grouping | By `leads_id` (every call has one today). Calls without a lead group by `caller_number`; calls with neither are left out of Callers. Web demo and phone door never share a lead today, so no cross-surface merge. |
| "What it created" | Lead chip (opens `/platform/contacts/:id`) and a booking chip with the slot from the call. No task chip: nothing creates lead tasks and Tasks is agency only. No Calendar link: voice bookings do not reach the Calendar (separate gap, not in scope). |
| Call back | Human action. `tel:` link plus a WhatsApp (`wa.me`) link. A click logs an Interaction on the lead ("called back by X") so the row shows who called back and when. DND and out-of-hours show a warning first and need a second click. |
| HubSpot | Owner only. New engine endpoint reusing `tools/hubspot_enricher.py` `HubSpotClient`. Company found by name (persona or lead company) or created, else a fixed "Voice callers" company. Contact updated if the lead already has `hubspot_contact_id`, else matched by email then phone, else created. A note with the call recaps is best-effort. The id is stored on the lead so a re-push updates, never duplicates. |

## Data

- New column `Leads.hubspot_contact_id text null` (direct `pg` migration, idempotent).
- Call-back record: an `Interactions` row with `type = 'call_back'`, `direction = 'internal'`
  (never `outbound`, which the existing `/api/interactions` route delivers to the lead's channel),
  `ai_generated = false`, `Users_id` and `Who` from the session user, written by a dedicated route.
- DND = `Leads.opted_out` true, or `dnc_reason` not null, or `Conversion_Status = 'DND'`.
- Out of hours = now is outside the account's `business_hours_start`/`business_hours_end` on its
  `open_days`, in `Accounts.timezone`. Unknown hours means not out of hours (no false warnings).

## API contract

```ts
export interface VoiceCaller {
  key: string;                     // "lead:<id>" or "num:<number>"
  leadsId: number | null;
  name: string | null;             // lead name, else latest call summary name
  phone: string | null;            // lead phone ('web' becomes null), else caller_number
  email: string | null;            // Owner only, else null
  callCount: number;
  lastCallAt: string;              // ISO
  lastCallId: string;
  latestOutcome: VoiceOutcome;
  bestOutcome: VoiceOutcome;       // rank: booked > transferred > callback > other > hung_up
  bookedSlot: string | null;       // most recent booked call
  bookedIso: string | null;
  personaCompany: string | null;   // latest call's persona, Demo only
  leadStatus: string | null;
  dnd: boolean;
  outOfHours: boolean;
  hubspotContactId: string | null; // Owner only, else null
  lastCalledBackAt: string | null;
  lastCalledBackBy: string | null;
  accountId: number;
  accountName: string | null;      // agency only
}
```

- `GET /api/voice-calls/callers?scope=live|demo&accountId` returns `{ callers: VoiceCaller[] }`,
  sorted by `lastCallAt` desc, same scope/403 rules as the calls list. Aggregated over the same
  filtered call set (all calls in scope, not just the latest 200).
- `POST /api/voice-calls/callers/:leadsId/call-back` body `{ channel: "phone" | "whatsapp" }`
  returns `{ lastCalledBackAt, lastCalledBackBy }`. 404 when the lead has no call the user may see.
- `POST /api/voice-calls/callers/:leadsId/hubspot` (Owner only, else 403) returns
  `{ contactId, url, noteCreated }`; 502 with `{ message }` when HubSpot fails.
- Engine: `POST /voice/hubspot/push-caller` (requires `X-Internal-Key`), body
  `{ contact_id?, first_name?, last_name?, email?, phone?, company_name?, recap_lines: string[] }`,
  returns `{ contact_id, url, note_created }`. URL form:
  `https://app-eu1.hubspot.com/contacts/148429886/record/0-1/<id>`.

## UI

- Topbar: `Calls | Callers` `la-seg` for everyone with access; Owner also keeps `Live | Demo`.
  The view choice is remembered in localStorage (`la.voiceCalls.view`). Stats strip stays.
- Callers list (348px column, same look as call rows): avatar tinted by `bestOutcome`, title =
  caller name else number (masked in Presenting), second line = persona company (Demo) and
  "N calls", time of last call, `OutcomePill` for `latestOutcome`. Small "called back" marker when
  `lastCalledBackAt` is set.
- Caller detail pane: raised header card with name, number, chips (Lead, Booking slot), the two
  action buttons, then a list of that person's calls (newest first, outcome pill, duration, date).
  Clicking a call opens the existing `VoiceCallDetail` below the header.
- Call back button: when `dnd` or `outOfHours`, the first click shows an inline warning with
  "Call anyway"; otherwise it opens the `tel:` link and logs. A small WhatsApp icon button does the
  same for `https://wa.me/<digits>`. No number on file: buttons disabled with a tooltip.
- HubSpot button (Owner only): states "Push to HubSpot", "Pushing", "In HubSpot" (link opens the
  contact in a new tab, button becomes "Update HubSpot"), "Failed, retry".
- Empty state for Callers: reuses the scope's empty state text.
- i18n en/nl/pt (Brazilian), tokens only, files under 500 lines.

## Out of scope

Bulk actions, exports, wiring voice bookings into the Calendar, creating tasks from calls,
per-client HubSpot connections.
