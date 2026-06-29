# Implementation Plan: Cal.diy Per-Client Email Branding

## Overview

Add `brandLogoUrl` and `brandName` to Cal.diy's `User` table. Thread those fields through the `CalendarEvent` object into the React Email templates so every booking confirmation renders the client's own logo and name. Suppress the organizer confirmation email via EventType metadata. Update the LeadAwaker provision script to write these fields at account creation time.

Cal.diy must be rebuilt and restarted after template changes.

---

## Phase 1: Cal.diy DB — add brand fields to User

Add two nullable columns to the Cal.diy `User` table via a raw SQL migration (Prisma migrations cannot be run interactively on the Pi; use psql directly).

### Tasks

- [x] Run SQL to add `brandLogoUrl` and `brandName` to `"User"` table
- [x] Update Cal.diy Prisma schema file to declare the new fields (keeps schema.prisma in sync; no migration needed since columns already exist)

### Technical Details

**SQL to run (psql against caldiy DB):**
```sql
ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "brandLogoUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "brandName"    TEXT;
```

Run with:
```bash
PGPASSWORD=9bc4d97599fd5d3a0187ec31bd3f450e3756fad11de6a915 \
  psql -h 127.0.0.1 -U caldiy -d caldiy \
  -c 'ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "brandLogoUrl" TEXT, ADD COLUMN IF NOT EXISTS "brandName" TEXT;'
```

**Prisma schema file:** `/home/gabriel/caldiy/packages/prisma/schema.prisma`
Find the `model User` block and add:
```prisma
brandLogoUrl String?
brandName    String?
```

---

## Phase 2: Thread brand fields into CalendarEvent

The email templates receive a `CalendarEvent` object. Add optional brand fields to that type, then populate them when building the event for a booking so they flow into the email renderer.

### Tasks

- [x] Add `brandLogoUrl?: string` and `brandName?: string` to the `CalendarEvent` interface [complex]
  - [x] Edit `/home/gabriel/caldiy/packages/types/Calendar.d.ts` — add fields to `CalendarEvent` interface (around line 197)
  - [x] Find where `CalendarEvent` is built from a booking (in `packages/features/bookings/lib/handleNewBooking/` or `EventManager.ts`) and populate the fields by looking up the organizer's User row's `brandLogoUrl`/`brandName`
- [x] Verify `formattedCalEvent` in `email-manager.ts` passes the new fields through (check `formatCalEvent` in `packages/lib/CalEventParser.ts`)

### Technical Details

**CalendarEvent type** (`packages/types/Calendar.d.ts`, around line 197 near `hideCalendarEventDetails`):
```ts
brandLogoUrl?: string;
brandName?: string;
```

**Where CalendarEvent is assembled for a booking:**
Look in `packages/features/bookings/lib/handleNewBooking/` for where `organizer` and `calEvent` are constructed. The organizer's User row is already fetched there — add:
```ts
calEvent.brandLogoUrl = organizerUser.brandLogoUrl ?? undefined;
calEvent.brandName    = organizerUser.brandName    ?? undefined;
```

**CalEventParser** (`packages/lib/CalEventParser.ts`) — check `formatCalEvent()` to confirm new fields pass through. They should automatically if they are top-level on CalendarEvent.

---

## Phase 3: Patch email templates

Three files need changes:

1. `EmailBodyLogo` — accept optional `logoUrl` and render the client logo instead of the Cal.diy logo
2. `BaseScheduledEmail` — pass `calEvent.brandLogoUrl` down to `EmailBodyLogo`
3. `email-manager.ts` email FROM name — derive from `calEvent.brandName` when present

### Tasks

- [x] Patch `EmailBodyLogo` to accept optional `logoUrl` and `altText` props [complex]
  - [x] Edit `/home/gabriel/caldiy/packages/emails/src/components/EmailBodyLogo.tsx`
  - [x] Change signature to `EmailBodyLogo({ logoUrl, altText }: { logoUrl?: string; altText?: string })`
  - [x] Use `logoUrl ?? \`${WEBAPP_URL}/emails/logo.png\`` as image src; use `altText ?? ""` as alt
- [x] Pass `calEvent.brandLogoUrl` from `BaseScheduledEmail` to `EmailBodyLogo`
  - [x] Edit `/home/gabriel/caldiy/packages/emails/src/templates/BaseScheduledEmail.tsx`
  - [x] Locate where `<EmailBodyLogo />` is rendered (or where it's imported via `BaseEmailHtml`) and pass props
  - [x] May need to thread through `BaseEmailHtml` props if `EmailBodyLogo` is rendered inside it — trace the call chain first
- [x] Set FROM name per client in outgoing email
  - [x] Edit `/home/gabriel/caldiy/packages/emails/email-manager.ts`
  - [x] In `sendScheduledEmails()`, before calling `sendEmail(...)`, read `calEvent.brandName`
  - [x] Pass it as the mailer `from` display name: `"${calEvent.brandName} Booking" <noreply@leadawaker.com>`
  - [x] Find where nodemailer `from` is set — likely in `/home/gabriel/caldiy/packages/emails/lib/sendEmail.ts` or similar; make it accept an optional override

### Technical Details

**EmailBodyLogo current implementation** (fully read before editing):
`/home/gabriel/caldiy/packages/emails/src/components/EmailBodyLogo.tsx`

The component is referenced inside `BaseEmailHtml`. Trace how `BaseEmailHtml` calls it — it may need a new `brandLogoUrl` prop threaded through:
```tsx
// BaseEmailHtml.tsx — add to props:
brandLogoUrl?: string;
brandName?: string;

// Then pass to EmailBodyLogo:
<EmailBodyLogo logoUrl={props.brandLogoUrl} altText={props.brandName} />
```

**Mailer FROM field:**
Find the nodemailer transport call in `/home/gabriel/caldiy/packages/emails/lib/` (likely `sendEmail.ts`). The `from` field is set from `process.env.EMAIL_FROM` + `EMAIL_FROM_NAME`. Add an optional `fromName` override parameter:
```ts
export const sendEmail = async (cb: () => GeneratedEmailType, fromName?: string) => {
  // ...
  from: `"${fromName ?? process.env.EMAIL_FROM_NAME}" <${process.env.EMAIL_FROM}>`,
```

---

## Phase 4: Suppress organizer confirmation email

Cal.diy already has a `hostEmailDisabled` parameter in `sendScheduledEmails()` and an `eventTypeDisableHostEmail(eventTypeMetadata)` check. Use the EventType `metadata` JSON column to set `disableStandardEmails.confirmation.host = true` so the organizer never receives a per-booking email.

> **Scope note (avoid over-suppressing):** this suppresses ONLY Cal.diy's own organizer confirmation email. It is independent of the LeadAwaker Python booking webhook, which sends its own WhatsApp/confirmation messages and (after the notification overhaul) the in-app/email booking notification — those are NOT affected. That's the intent: the client gets the clean LeadAwaker booking notification instead of a redundant Cal.diy email. Keep `confirmation.attendee = false` so the lead still receives their branded confirmation email.

### Tasks

- [x] Update `provision-leadawaker-user.ts` to set `metadata` on the EventType at creation time
- [x] For existing sandbox EventType (id=6), patch via SQL

### Technical Details

**EventType metadata field** — Cal.com uses `EventTypeMetaDataSchema` from `packages/prisma/zod-utils.ts`. The relevant field:
```ts
disableStandardEmails: {
  confirmation: { host: true, attendee: false }
}
```

**In `provision-leadawaker-user.ts`** — when creating the EventType, add:
```ts
metadata: {
  disableStandardEmails: {
    confirmation: { host: true, attendee: false }
  }
}
```

**SQL fix for existing sandbox EventType (id=6):**
```sql
UPDATE "EventType"
SET metadata = jsonb_set(
  COALESCE(metadata, '{}'::jsonb),
  '{disableStandardEmails}',
  '{"confirmation": {"host": true, "attendee": false}}'
)
WHERE id = 6;
```

Run with the caldiy psql credentials.

**Verify** `eventTypeDisableHostEmail()` in `packages/emails/email-manager.ts` reads this field — it calls `eventTypeMetadata?.disableStandardEmails?.confirmation?.host`. Confirm the metadata flows from `getEventTypesFromDB.ts` into the `sendScheduledEmails` call.

---

## Phase 5: Update provision script + build

Wire the LeadAwaker account's `logoUrl` and `name` into the Cal.diy User at provision time, then rebuild Cal.diy.

### Tasks

- [x] Update `provision-leadawaker-user.ts` to write `brandLogoUrl` and `brandName` on User create/update
- [x] Update `inject-calendar-credential.sh` / relevant script to also handle existing users missing the brand fields (upsert approach)
- [x] Rebuild Cal.diy and restart pm2

### Technical Details

**In `provision-leadawaker-user.ts`**, the env vars to add:
- `LA_BRAND_LOGO_URL` — the account's `logoUrl` from LeadAwaker
- `LA_BRAND_NAME` — the account's `name`

In the user creation block:
```ts
data: {
  // ...existing fields...
  brandLogoUrl: process.env.LA_BRAND_LOGO_URL || null,
  brandName: process.env.LA_BRAND_NAME || null,
}
```

For existing users (re-provision path), add an `update` block:
```ts
await prisma.user.update({
  where: { id: user.id },
  data: {
    brandLogoUrl: process.env.LA_BRAND_LOGO_URL || undefined,
    brandName: process.env.LA_BRAND_NAME || undefined,
  },
});
```

**In `server/calendar/caldiy.ts`** (`provisionCaldiyForAccount`), pass the new env vars:
```ts
LA_BRAND_LOGO_URL: account.logoUrl || "",
LA_BRAND_NAME: account.name || "",
```

**Rebuild Cal.diy:**
```bash
cd /home/gabriel/caldiy
npm run build   # or the turbo build command
pm2 restart caldiy --update-env
```

Note: Cal.diy build takes 5-10 minutes on the Pi. Run in a tmux session.

---

## Rebuild Note

Every change to `packages/emails/` requires a Cal.diy rebuild for the templates to take effect. The rebuild compiles React Email templates to HTML strings at build time. Changes to `provision-leadawaker-user.ts` (a script run at runtime) do not require a rebuild.
