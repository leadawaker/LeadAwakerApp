# Legal Demo Mock Intake Form

## Goal

The legal personal-injury demo (campaign 59, Summit Injury Law) currently ends the same way as every other demo: AI sends a Cal.com link, lead picks a time. That booking pattern doesn't match how real personal-injury firms actually intake leads. PI firms use **case-intake forms**, not calendar scheduling — a victim fills a short form, a paralegal calls them back within 30 minutes.

Match the demo to the real-world flow. Replace Cal.com with a pre-filled intake form that opens in a popup, already populated with what the AI extracted from the WhatsApp conversation. Lead confirms, taps submit, gets a WhatsApp confirmation. No new calendar entry, no Cal.com.

This is a demo-only feature. It is not a real intake system. No Clio / MyCase / Litify integration.

## Why this matters

1. Makes the legal demo feel real, because the flow matches how PI intake actually works.
2. Shows prospects watching the demo that Lead Awaker can hand off in different shapes — not just "book a call." Preempts the "we don't use Cal.com" objection.
3. Sets up a future generalization: `booking_mode = 'form'` as a first-class feature that any non-calendar client (insurance, mortgage, legal, medspa) can use.

## Scope — Phase 2 (this spec)

- `Booking_Links.intake_data` JSONB column caches Groq-extracted fields.
- On first `/book/{token}` hit for a campaign-59 lead: run Groq extraction over `leads.ai_memory`, persist, redirect to `/intake/{token}`.
- On subsequent hits: skip extraction, redirect straight.
- `/intake/{token}` is a React page in the CRM app with a modal popup over a mock law-firm landing page.
- Modal has pre-filled editable fields: name, phone, incident type, incident date, injury status, jurisdiction, consent checkbox.
- Submit fires Python POST, which logs to `Automation_Logs`, sets `Interactions.status = DemoIntakeSubmitted`, sends a WhatsApp confirmation message back to the lead, returns `{ ok: true }`.
- Frontend shows a success state ("Marcus Chen will call within 30 min") with a "Back to WhatsApp" button.

## Out of scope

- Real Clio / MyCase / Litify webhook integration.
- Promoting `booking_mode = 'form'` to a generic configurable feature.
- Real paralegal SMS/email routing.
- Analytics on intake abandonment vs completion.
- Server-side validation beyond "token exists and belongs to a campaign-59 demo lead."
- Dutch- and Portuguese-language intake pages (English-only for Phase 2; i18n keys stubbed but EN-only rendered — the campaign is English anyway).

## Acceptance criteria

1. On `/try`, picking the "Accident claim reactivation" demo and completing the WhatsApp conversation through the booking step sends a link of the form `https://webhooks.leadawaker.com/book/{token}` — unchanged from today.
2. Tapping that link on a phone redirects (302) to `https://app.leadawaker.com/intake/{token}`, not Cal.com.
3. The redirect target page loads in under 2 seconds on a warm cache. First-hit may take 3-6 seconds due to the Groq call.
4. The intake modal opens pre-filled with at minimum: name, phone, `company_name` (header), plus whichever of `incident_type`, `incident_date`, `injury_status`, `jurisdiction` the Groq pass was able to extract. Blank fields are editable and have placeholder text.
5. Submitting the form triggers a WhatsApp message from the campaign 59 Twilio number to the lead's phone that reads (EN): "Got it {first_name}. Your intake is with Marcus Chen now — he'll call you within 30 minutes."
6. The WhatsApp confirmation arrives within 10 seconds of submit.
7. `Interactions` row for this lead shows `status = DemoIntakeSubmitted` after submit.
8. `Automation_Logs` shows two new step names: `DemoIntakeExtracted` (on first redirect) and `DemoIntakeSubmitted` (on form submit).
9. Re-opening the link after submit shows a "Intake already submitted" read-only state. Idempotent: no duplicate WhatsApp sends, no duplicate status writes.
10. All other demos (solar, gym, dental, coaching) still redirect to Cal.com. Campaign-59 branch does not leak.

## Success definition

Phase 2 ships when Gabriel can demo the legal flow end-to-end on a phone, have the form open with at least 4 of the 6 fields pre-filled correctly, submit, and see the WhatsApp confirmation arrive. First real prospect demo within 2 days of ship.
