# Voice calls: Callers tab

Status: SCOPING ONLY, not scheduled. Date: 2026-10-06.
Depends on `specs/voice-calls-demo-tab/requirements.md` being built first (outcome enum, persona,
account scoping, `scope` tab control).

## Goal

A third tab on `/platform/voice-calls` listing **everyone Sara has spoken to**, one row per person
rather than per call. For each person: what their calls created (lead, booking, task), how it went,
and an action to **push to HubSpot** or **call back**.

## Who sees it

Same access model as the Demo tab spec. Clients see only people from their own account's Live calls.
Owner sees Demo callers as well, behind the same `scope` switch. No demo person ever reaches a client.
Decided 2026-10-06: Push to HubSpot is Owner-only for now. Call back is useful to both.

## Row (one per person)

- Identity: name (else number), masked by Presenting mode for the Owner.
- Grouping key: `leads_id` when present, else normalized `caller_number`. Web demo callers use made-up
  numbers, so they only merge via lead.
- Call count and last call time.
- Latest outcome pill, plus a best-outcome indicator across all their calls.
- **What it created**, as small chips linking out:
  - Lead (link to the Leads page card)
  - Booking (slot, link to Calendar)
  - Task (link to Tasks)
  - Interaction thread count
- Action cell: `Push to HubSpot`, `Call back`.

## Detail pane

Reuses the call detail layout: a person header, a timeline of their calls (each expandable to the
existing recap, player and transcript), and an "Outcomes created" card.

## Actions

### Push to HubSpot
- Creates or updates a HubSpot contact (and optionally a note with the recap and a link back to the
  call) via the existing HubSpot MCP/API credentials.
- Must be idempotent: store the HubSpot contact id on the lead, never duplicate.
- Shows state on the row: not pushed, pushed (with link), failed (with retry).

### Call back (decided 2026-10-06: a human action for now)
- A person calls the lead back. The button opens the number in the user's dialer (`tel:` link) and
  offers a WhatsApp shortcut. Sara does not place the call.
- Optionally logs the attempt as an interaction on the lead, so the row shows "called back by X, time".
- Out-of-hours and DND leads show a warning before the dial link is offered (PECR and Dutch
  cold-calling rules already recorded in memory: consent matters).
- No engine work needed, so the CALLBACK_NOW gap is no longer a prerequisite.
- A later version could let Sara place the callback, which would need an engine entry point.

## What must exist before this can be built

1. `Voice_Calls.leads_id` reliably set for client lines (true for web demo and phone door today).
2. A per-lead link to bookings and tasks queryable from a lead id (bookings and tasks both reference
   the lead, to be confirmed during planning).
3. A HubSpot contact id field on `Leads` (new column) and a server-side push function.
4. Decision on Callers data model: a SQL view grouping `Voice_Calls` by caller, or an on-read
   aggregation. Recommendation: on-read aggregation, no new table, until volume says otherwise.

## Open questions for Gabriel

- Should demo callers be merged across the two surfaces (web demo and phone door) when the lead matches?

## Out of scope for this spec

Bulk actions, exports, a dedicated Callers analytics view.
