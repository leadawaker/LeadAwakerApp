# Booking Meeting Types & Calling Number — Requirements

**Status:** Draft (design approved 2026-06-28)
**Domain:** CRM (Express + Integrations panel) + Cal.diy provisioning
**Related specs:** `caldiy-email-branding` (done), `caldiy-ical-calendar`, Spec B = *conversational-booking-and-reminders* (separate), Spec C = *booking-page-reviews* (separate, lowest priority)

## Problem

Every provisioned Cal.diy client is hardcoded to a single meeting type: `userPhone` with no
number (`provision-leadawaker-user.ts` → `locations: [{ type: "userPhone" }]`), so the booking
confirmation, email, and calendar event show a bare "Phone call" label. Two gaps:

1. **No choice of how the booked call happens.** Different clients want a phone call, a WhatsApp
   call, or (later) a video call. There is no way to configure this per client.
2. **The calling number is never shown.** The client calls leads from a dedicated voice number
   that differs from the WhatsApp messaging number. Leads don't recognise the incoming number, so
   pickup rates suffer. The booking should display *"Phone call — we'll call you from 06…"* so the
   lead can save the contact and answer.

## Goal

Let each client be configured with a **meeting type** and, for phone calls, a **calling number**.
These are account-level settings, editable in the Integrations panel and selectable during the
onboarding wizard. The values flow through provisioning into the Cal.diy `location` object so the
booking page, confirmation email, and calendar event all reflect the right meeting type and number.

## Scope

### In scope (Phase 1)
- **Meeting-type selector** with four options:
  - **Phone call** (active) — reveals a **Calling number** field.
  - **WhatsApp call** (active) — reuses the existing WhatsApp messaging number; no extra number field.
  - **Google Meet** (disabled, "Coming soon" badge).
  - **Zoom** (disabled, "Coming soon" badge).
- **Account-level storage**: `meetingType` + `callingNumber` columns on the Accounts table.
- **Two edit surfaces, one source of truth**:
  - Integrations panel control (primary).
  - A step/field in the onboarding wizard (`ProfileWizard.tsx`) so the choice is made during
    client onboarding. Both write the same account fields.
- **Provisioning wiring**: Express (`server/calendar/caldiy.ts`) passes the new fields as env vars
  → `provision-leadawaker-user.ts` builds the correct Cal.diy `location` object. The existing
  re-provision path updates the live EventType's `locations` so a settings change takes effect
  without a Cal.diy rebuild.
- **i18n**: all new strings in `accounts` namespace (en/nl/pt).

### Out of scope
- Conversational booking, vCard, post-booking copy, reminders → **Spec B**.
- Client reviews on the booking page → **Spec C** (lowest priority).
- Google Meet / Zoom backends (the options are UI-only "Coming soon" in Phase 1).
- Changing the WhatsApp messaging number model (reused as-is).

## Functional Requirements

### FR1 — Meeting-type selection
- Default for existing/new accounts: **Phone call** (preserves current behaviour, now with a number).
- Selecting **Phone call** shows a required **Calling number** field (international format, e.g. `+31 6 …`).
- Selecting **WhatsApp call** hides the calling-number field; the booked call uses the account's
  existing WhatsApp number.
- **Google Meet** and **Zoom** are visible but disabled, with a "Coming soon" badge; not selectable.

### FR2 — Storage
- New Accounts columns: `meeting_type` (text: `phone_call` | `whatsapp_call`) and
  `calling_number` (text, nullable; required only when `meeting_type = phone_call`).
- Created via a direct `pg` SQL script (db:push has no TTY on the Pi) per project convention.

### FR3 — Provisioning → Cal.diy location mapping
- **Phone call** → `userPhone` with `hostPhoneNumber` = `callingNumber`, so the confirmation/email/
  event render *"Phone call — we'll call you from <number>"*.
- **WhatsApp call** → a custom-label location displaying **"WhatsApp call"** + the WhatsApp number.
  (The exact Cal.diy location object + label is finalised in implementation against Cal.diy's
  location enum; verify the page/email/event render the intended label.)
- Re-provisioning an existing client updates `EventType.locations` in place (re-provision path
  already exists) so changes apply live.

### FR4 — Onboarding wizard
- Add a meeting-type question (+ conditional calling-number field) to `ProfileWizard.tsx`.
- Writes the same account-level fields as the Integrations panel; no separate storage.

### FR5 — i18n
- All labels, the "Coming soon" badge, and the calling-number helper text go through the
  `accounts` namespace in en, nl, and pt (Brazilian PT).

## Non-Functional / Constraints
- Follow `UI_STANDARDS.md`; reuse existing Integrations-panel patterns (the file is already ~911
  lines — add the control as a small focused sub-component, do not inflate the monolith).
- No Cal.diy rebuild required for a settings change (handled via the live re-provision path).
- Never send ISO timestamp strings from the client (project rule); these fields are text only.

## Acceptance Criteria
1. In the Integrations panel, switching a client to **Phone call** + a number and re-provisioning
   makes a new booking's confirmation page, email, and calendar event read *"Phone call — we'll
   call you from <number>"*.
2. Switching to **WhatsApp call** + re-provisioning makes the booking render the "WhatsApp call"
   label tied to the WhatsApp number; no calling-number field is shown in the panel.
3. **Google Meet** and **Zoom** appear disabled with a "Coming soon" badge and cannot be selected.
4. The same selection is available and persists when set via the onboarding wizard.
5. All new strings render correctly in en/nl/pt.

## Open Implementation Questions (resolve during planning)
- Exact Cal.diy location object/label for the WhatsApp-call custom location (verify against
  Cal.diy's location enum + how the page/email/event render it).
- Whether the calling-number field should validate against libphonenumber (Cal.diy already bundles
  it) or accept free text.
