# Opt-In Calendar Invite (.ics) for Chat Bookings

**Date:** 2026-07-02
**Status:** Design (approved scope, pending partner confirmation before build)
**Service:** Python automation engine (`/home/gabriel/automations/`) + Express (`server/`) + Cloudflare booking-domain worker

## Context

A chat booking today leaves nothing on the lead's calendar: the lead usually has no email, so Cal.diy books against a fake `{lead_id}@noemail.leadawaker.com` address (`slot_booking.py::_create_booking_from_slot`), which means no invite, no `.ics`, no calendar entry. The only footprint is the AI's chat confirmation plus the reminder ladder.

Research (2026-07-02): there is no way to push a native WhatsApp calendar event via the Business Cloud API. The deliverable is an **`.ics`** (universal iCalendar file that every calendar app reads).

Trust concern: an unsolicited file attachment mid-chat can feel off. The design addresses this three ways: **opt-in only**, **the AI explains what it is**, and **delivery as a link on the client's own white-label booking domain** rather than a mystery file.

## Goal

After a chat booking, the AI **offers** a calendar invite. On the lead's yes, deliver an `.ics` (hosted on the client's booking domain) that one-taps the appointment into their phone calendar. No email required.

## Non-Goals

- Never sent by default or unsolicited.
- No email capture.

## Design

### The offer (opt-in)

The AI adds a natural offer to the booking confirmation, and only delivers on an affirmative reply. The wording names what it is, to remove the "why a file?" hesitation:

- **EN:** "Want me to send a calendar file so it saves to your phone automatically?" (on yes) "Here you go, just tap it and it adds the appointment for you."
- **NL:** "Zal ik een agenda-bestand sturen zodat het meteen in je agenda staat?" (on yes) "Alsjeblieft, tik erop en de afspraak staat er meteen in."

Implementation: extend the STAGE 3 confirmation guidance in the `[AVAILABLE SLOTS]` block so the AI offers it, and emit a `{{SEND_ICS}}` signal (mirroring the `{{SLOT_SELECTED}}` pattern) when the lead accepts. The engine detects the signal and sends the `.ics` link. Signal-based detection is preferred over heuristic yes-detection for reliability.

### `.ics` generation and hosting

- Generate an iCal `VEVENT`: summary, start/end (from `booked_call_date` + event-type duration), location (per `meeting_type`), organizer, and a description carrying the calling number.
- Host on the client's booking domain: `book.<clientdomain>/ics/<booking_uid>.ics`, tying into the existing custom-domains Cloudflare worker. Fall back to `api.leadawaker.com/calendar/ics/<uid>.ics` when the account has no custom domain.
- The endpoint serves `text/calendar` with `Content-Disposition: attachment; filename="booking.ics"`.

### Delivery

- Send the **link** in chat (not a file attachment), with the explanatory sentence. A link on the client's own domain reads as trustworthy and is universal across iPhone/Android/Google/Outlook.
- (Alternative, not the default: send as a document with filename `booking.ics` uploaded as `text/plain` per Meta's MIME allowlist. Kept as a fallback option only.)

### Ownership (which service does what)

- **Engine (Python):** owns the offer wording, the `{{SEND_ICS}}` signal detection, and sending the chat message that carries the link (the engine owns all WhatsApp sends).
- **Express (`server/routes/calendar.ts`):** owns the `.ics` endpoint. On `GET /calendar/ics/:uid` it generates the iCal from the lead's booking and serves `text/calendar`. No booking data is duplicated into the engine.
- **Cloudflare worker:** routes `book.<clientdomain>/ics/*` to the Express endpoint so the link is on the client's own domain.

## Dependencies

- Custom booking domains (already built) for on-brand hosting.
- `booked_call_date`, `calcom_booking_uid`, `meeting_type`, and the calling number.
- Event-type duration source (to compute the event end time).

## Open Decisions (resolve at implementation)

- Confirm event duration lookup (Cal.diy event-type length).
- Confirm the Cloudflare worker route for `book.<clientdomain>/ics/*`.

## Testing

- `.ics` validity across a real iPhone and Android handset (research flagged this as extension-driven client behavior, so verify on-device rather than trusting the transported MIME type).
- Link renders and one-tap "add to calendar" works.
- Opt-in only: no `.ics` is ever sent without an explicit yes.
