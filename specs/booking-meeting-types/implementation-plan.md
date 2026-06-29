# Booking Meeting Types & Calling Number — Implementation Plan

Spec: [requirements.md](./requirements.md). Self-approved 2026-06-28.

## Architecture summary

Two new account-level fields (`meeting_type`, `calling_number`) become the single source of truth.
Two UI surfaces write them (Integrations panel + onboarding wizard). On save, the account is
re-provisioned to Cal.diy; the provision script maps the fields to the EventType's `location`
object and — new — updates `locations` in place for existing clients so changes apply without a
Cal.diy rebuild.

```
Integrations panel ─┐
                    ├─► PATCH account (meetingType, callingNumber) ─► re-provision ─► Cal.diy EventType.locations
Onboarding wizard ──┘
```

## Task list (ordered)

### 1. Schema + DB column
- `shared/schema.ts`: add to the Accounts table
  - `meetingType: text("meeting_type").default("phone_call")` — `phone_call | whatsapp_call`
  - `callingNumber: text("calling_number")` — nullable.
- Add the columns via a direct `pg` SQL script run with `node --env-file=.env` (db:push has no TTY
  on the Pi). `ALTER TABLE "Accounts" ADD COLUMN ...` with the same default.
- Confirm the account insert/update Zod schema picks the new text fields up (text only — no
  timestamp/ISO concerns).

### 2. Server: persist + re-provision on change
- `server/routes/accounts.ts`: the account PATCH/update route already accepts account fields; ensure
  `meetingType` + `callingNumber` are in the allowed update set.
- After a successful update **where meetingType or callingNumber changed**, call
  `provisionCaldiyForAccount(accountId)` (re-provision) — mirror how `businessHours` changes trigger
  `resyncCaldiySchedule`. Fire-and-forget, best-effort (never block the response).
- Validation: if `meetingType = phone_call`, require a non-empty `callingNumber`; if
  `whatsapp_call`, ignore/clear it. Validate at the route with Zod.

### 3. Provisioning: pass fields + map to Cal.diy location
- `server/calendar/caldiy.ts` (`provisionCaldiyForAccount`): add env vars
  - `LA_MEETING_TYPE: account.meetingType || "phone_call"`
  - `...(account.callingNumber ? { LA_CALLING_NUMBER: account.callingNumber } : {})`
  - For WhatsApp call, pass the account's WhatsApp number (resolve the existing WhatsApp messaging
    number field) as `LA_WHATSAPP_NUMBER`.
- `caldiy/scripts/provision-leadawaker-user.ts`:
  - Read `LA_MEETING_TYPE`, `LA_CALLING_NUMBER`, `LA_WHATSAPP_NUMBER`.
  - Build a `buildLocation()` helper returning the Cal.diy `location` object:
    - `phone_call` → `[{ type: "userPhone", hostPhoneNumber: callingNumber }]`
    - `whatsapp_call` → custom-label location showing **"WhatsApp call"** + the WhatsApp number.
      **VERIFY** the exact Cal.diy location object/label against `packages/app-store/locations.ts`
      (the `DefaultEventLocationTypeEnum`) and confirm the page/email/event render the label.
  - **New: update existing EventTypes.** Today the `if (!eventType)` branch only sets `locations`
    on *create*. Add an `else` branch that updates the existing EventType's `locations` to the
    freshly built object, so re-provisioning an existing client applies the change live.

### 4. Integrations panel UI
- Add a focused sub-component (do NOT inflate the 911-line `IntegrationsPanel.tsx`), e.g.
  `client/src/features/accounts/components/workspace/MeetingTypeCard.tsx`:
  - Four options (segmented control or radio cards): Phone call, WhatsApp call (active);
    Google Meet, Zoom (disabled + "Coming soon" badge).
  - Conditional **Calling number** field shown only for Phone call (international format).
  - Saves via the existing account-update mutation used by the panel; on success the server
    re-provisions (Task 2).
- Follow `UI_STANDARDS.md` tokens; reuse existing panel card/field patterns.

### 5. Onboarding wizard step
- `client/src/features/accounts/components/workspace/communication/ProfileWizard.tsx`: add a
  meeting-type question (+ conditional calling-number field) writing the **same account fields**
  (not the comm-profile table). Reuse the `MeetingTypeCard` control if practical to avoid
  duplication.

### 6. i18n
- Add keys to `client/src/locales/{en,nl,pt}/accounts.json`: option labels, "Coming soon" badge,
  calling-number label + helper/placeholder, validation message. PT = Brazilian PT.

### 7. Verification (manual, on the Pi)
- Set a sandbox account to Phone call + a number → confirm a new booking's page, **attendee email**,
  and **calendar event** read *"Phone call — we'll call you from <number>"*.
- Switch to WhatsApp call → confirm the "WhatsApp call" label renders and no calling-number field
  shows in the panel.
- Confirm Meet/Zoom are disabled with the badge.
- Confirm the onboarding-wizard selection persists and round-trips to the panel.
- Confirm changing the setting on an existing client applies **without** a Cal.diy rebuild (live
  EventType update), only the re-provision call.

## Risks / notes
- **WhatsApp-call location object is the one unknown** — verify against Cal.diy's location enum
  early (Task 3) before building UI on top of it. If Cal.diy has no clean custom-label option, fall
  back to `userPhone` with the WhatsApp number and a label override, or a `link`/`somewhereElse`
  type. Decide during Task 3.
- Re-provision is best-effort; a failure must not break the account save (log + continue), matching
  existing Cal.diy fire-and-forget behaviour.
- No Cal.diy rebuild in the change path — only DB/EventType updates via the provision script.

## Out of scope (tracked elsewhere)
- Spec B: conversational booking, vCard, post-booking copy, T-1h reminder, reschedule verify.
- Spec C: client reviews on the booking page.
