# Requirements: Cal.diy Per-Client Email Branding

## What and Why

Booking confirmation emails currently show the Cal.diy logo and "Cal.diy" in the footer, regardless of which client's booking page was used. This creates a white-label gap: leads see "Cal.diy" instead of the client's business name and logo.

This feature makes every booking email look like it came from the client directly:
- Logo in the email header = client's account logo (same one used for their avatar in LeadAwaker)
- FROM name = client's business name (e.g., "Sandbox Client Booking" instead of "LeadAwaker Booking")
- Footer brand name = client's business name instead of "Cal.diy"
- Organizer confirmation emails suppressed (clients get 100s of bookings; noise suppressed in favor of LeadAwaker's in-app notification via the existing booking webhook)

## Acceptance Criteria

- [ ] Attendee confirmation email header shows the client's logo instead of the Cal.diy logo
- [ ] Attendee email FROM name is "[Client Name] Booking" (e.g., "Sandbox Client Booking")
- [ ] Email footer shows client business name instead of "Cal.diy"
- [ ] Organizer (client) does NOT receive a per-booking confirmation email from Cal.diy
- [ ] LeadAwaker booking webhook still fires normally (lead flips to Booked in CRM)
- [ ] New accounts provisioned via `provision-leadawaker-user.ts` automatically get their logo + name set
- [ ] If the account has no logo, email falls back to LeadAwaker default logo

## Out of Scope

- Per-client brand color customization (nice-to-have, can be added later)
- Cancel/reschedule email branding (same mechanism — trivial to extend once base is done)
- Attendee reminder emails

## Dependencies

- Cal.diy booking automation must be provisioned (see `specs/` — already built)
- Account `logoUrl` field already exists in LeadAwaker `Accounts` table (`logo_url` column)
- Cal.diy runs as a self-hosted Next.js app at `cal.leadawaker.com` — rebuilding it is required after template changes
