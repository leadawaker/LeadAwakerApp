# Booking & Calendar Specs — Build Order

Specs designed in the 2026-06-27 Cal.diy booking follow-up session, ordered by build priority.
All are **written but not yet built**. Older specs in this directory (reputation, receptionist,
contacts, etc.) are not part of this list — several are already built.

| # | Spec | What | Cal.diy rebuild? |
|---|------|------|------------------|
| 1 | [calendar-manual-blocks](calendar-manual-blocks/) | Drop busy blocks on the LeadAwaker Calendar page; hides those slots on the booking page. Works for no-calendar clients (the onboarding unblocker) and is additive for connected ones. | No |
| 2 | [notification-settings-overhaul](notification-settings-overhaul/) | Role-aware notifications (clients see only Booked + Campaign finished), new **email** channel, remove standalone push card, and fix the bug where clients currently get NO booking notification/toast. | No |
| 3 | [ai-rescheduling](ai-rescheduling/) | "Reschedule call" button (Cal.com native reschedule) + AI re-engage automation to rebook a lead. Rebooks never double-bill. Revenue protection + differentiator. | No |
| 4 | [caldiy-ical-calendar](caldiy-ical-calendar/) | Apple / iCal (CalDAV) as a 3rd connect option. Free/busy sync; write-back recommended ON for Apple (else bookings never show in their calendar). Covers Apple Calendar users. | No |
| 5 | [caldiy-email-branding](caldiy-email-branding/) | Per-client logo + business name in booking emails; suppress organizer confirmation email. Batched last because it requires a Cal.diy rebuild (~5-10 min on the Pi). | Yes |

## Rationale for the order

1. **Manual blocks first** — standalone, no rebuild, and the only way no-calendar / unsupported-calendar clients can convey availability. Removes the biggest onboarding friction.
2. **Notification overhaul second** — fixes a live bug (clients receive nothing on a booking) and adds the email channel most clients will actually use.
3. **AI rescheduling third** — protects booking revenue and is a real differentiator; most webhook plumbing already exists, so the lift is mostly the AI flow + the button.
4. **iCal fourth** — real but smaller segment (Apple users); no rebuild.
5. **Email branding last** — high polish value but gated behind the one Cal.diy rebuild, so batch it with any other future Cal.diy template change.
