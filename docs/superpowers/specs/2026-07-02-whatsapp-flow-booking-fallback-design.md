# In-Chat WhatsApp Flow Booking (Fallback)

**Date:** 2026-07-02
**Status:** Deferred — blocked on Twilio (see Blocker below). Not scheduled; revisit only if the blocker clears.
**Service:** Python automation engine (`/home/gabriel/automations/`) + Meta WhatsApp Business Platform

## Blocker (2026-07-02)

This spec requires a data-exchange WhatsApp Flow (live availability + booking creation via our own encrypted endpoint), which requires registering an RSA public key against the client's WABA via Meta's Graph API (`POST /{WABA-ID}/whatsapp_business_encryption`) and authoring/publishing the Flow JSON.

Every client WhatsApp number is provisioned through Twilio (one number per account, per `Accounts.twilio_account_sid` etc.). Twilio does not expose this encryption step, or a Meta Graph API access token scoped to the client's WABA, anywhere in its Senders or Content API. Confirmed two ways:

- **Codebase audit:** no client-scoped Meta access token exists anywhere in the system. The only Meta token (`whatsapp_access_token` in `automations/src/config.py`) is a single global token for LeadAwaker's own direct Cloud API number, unrelated to Twilio-provisioned client WABAs. `Accounts` has no WABA ID field at all.
- **Twilio inquiry:** asked Twilio directly; their (AI-generated, unverified) response confirmed no API/token access is granted for WABAs Twilio provisions. Whether the underlying Meta Business Portfolio created during Embedded Signup grants standing *manual* login access to WhatsApp Manager is unresolved (their answer was internally inconsistent on this point), but even if it does, that only enables a per-client manual click-through, not the automated one-click provisioning this needs to be worth building. Not pursuing manual verification since it doesn't change the decision either way.

**Decision:** skip this build. Continue with the white-label booking domain work (`specs/caldiy-custom-domains/`, already built) as the fallback-link fix instead — it's fully automatable today and doesn't depend on Twilio/Meta access we don't have.

**Revisit only if:** Twilio adds native support for WhatsApp Business Encryption key registration via their API, or LeadAwaker moves client WABA provisioning off Twilio to direct Meta Cloud API (like the LeadAwaker house number already is).

## Context

Verbal conversational booking is the primary path (AI proposes day, then time). The current fallback, when the lead rejects all offered days/times, is to paste the external Cal.diy link. That link takes the lead out of WhatsApp into a browser and reads as an "ugly link."

WhatsApp **Flows** render native, multi-screen forms **inside** WhatsApp (drawn by the WhatsApp client from a JSON schema, no browser). In data-exchange mode, each screen can pull live data from our endpoint. Research (2026-07-02) confirmed:

- There is **no native calendar-event API** on the Business Cloud API (the person-to-person "Events" feature, expanded to 1:1 chats in April 2025, is consumer-app only and not exposed to the API).
- A **"Book an Appointment" Flow** is the supported in-chat booking mechanism, wired to our own endpoint.

## Goal

Replace the external-link fallback with an in-WhatsApp Flow that lets the lead book directly, fed by real Cal.diy availability, when the verbal flow stalls. Stays fully in-app, no browser, no email prompt.

## Non-Goals

- Not the primary path. Verbal booking stays primary; the Flow is the fallback only.
- No reschedule or cancel inside the Flow (those stay in the conversational tools). A "manage booking" Flow is a possible later addition.
- No email capture. The lead's identity is already known from our DB.

## Design

### Trigger

In the `slot_booking.py` fallback branch (lead rejects all offered days/times), send a Flow interactive message instead of (or ahead of) the booking link. Gate behind a per-account/campaign opt-in flag, since Flows require per-account Meta setup.

### Flow structure (three native screens)

1. **Day picker:** available days from Cal.diy (via the data-exchange endpoint).
2. **Time picker:** times for the chosen day.
3. **Review and confirm:** on submit, the endpoint creates the Cal.diy booking and updates the lead, reusing the same logic as `_create_booking_from_slot`.

### Data-exchange endpoint (new)

An encrypted Flow endpoint (public HTTPS) in the engine's webhook service:

- Handles Meta's request/response encryption (business private key + Meta public key).
- Serves availability to the day/time screens.
- On the final screen action, creates the booking and updates the lead.

### Identity

The Flow is launched from our message to a known lead, so `lead_id` travels in the `flow_token` / action payload. We book against the known lead. No email screen.

### Confirmation and reminders

After the booking, send the confirmation in chat (reuse the existing confirmation copy, including the calling number). The reminder ladder from the reminders/cancel spec applies automatically, since it keys off `booked_call_date`.

## Open Build Decisions (resolve at implementation)

- Per-account Flow provisioning vs. one shared Flow with account routing via `flow_token`.
- Meta app review / publish requirements and timeline before the Flow can go live.
- Availability caching to keep the day/time screens responsive.

## Dependencies

- A Meta WhatsApp Business app with Flows enabled.
- Reuses Cal.diy availability and booking (`caldiy_api`) and `_resolve_booking_target`.
- Sequenced **after** the reminders/cancel spec (bigger infra: encrypted endpoint + Meta review).

## Risks

- Real infrastructure and a Meta review gate make this materially larger than the reminders/cancel work. Treat as its own project.

## Testing

- Flow endpoint encryption round-trip.
- Availability rendering on the day/time screens.
- Booking-creation parity with the verbal path (same lead updates, same `booked_at`, same confirmation).
