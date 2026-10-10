# Action Required: Client Recaps and Instant Alerts

Manual steps that must be completed by a human.

## Before Implementation

- [ ] **Review and approve the spec** (`requirements.md`, `implementation-plan.md`), including the recommended instant-alert set and the added `lead_needs_reply` alert.
- [ ] **Answer the open questions** at the bottom of `requirements.md` (phone number in WhatsApp, quiet hours, who edits settings, agency copy).
- [ ] **Decide on the phone-line booking gap:** Robben's line tells callers "booked" but writes nothing to his calendar (`voice/booking_tool.py:277` is demo-only). Either accept "please confirm" callback alerts for now, or schedule real voice booking first.

## Submit the WhatsApp templates (WhatsApp Manager)

Do this early: approval takes minutes to 48 hours, and a rejection means a reworded resubmit.

- [ ] **Confirm the sender:** in WhatsApp Manager, check which number `WHATSAPP_PHONE_NUMBER_ID` points to, that its display name reads "Lead Awaker" (approved), and that the business is verified (messaging limit of at least 1,000 business-initiated conversations a day).
- [ ] **Create 6 templates**, each with category **Utility** and three languages (Dutch `nl`, English `en`, Portuguese (BR) `pt_BR`), copying header, body, footer and button exactly from `requirements.md`:
  - `la_daily_recap`
  - `la_appointment_booked`
  - `la_appointment_rescheduled`
  - `la_appointment_cancelled`
  - `la_callback_requested`
  - `la_lead_needs_reply`
- [ ] **For every template:** footer `Lead Awaker`; one button of type **Visit website**, **Dynamic** URL `https://app.leadawaker.com/go/{{1}}`, sample `https://app.leadawaker.com/go/k7Q2mX9a`; button text per language from the spec; fill every body sample value from the spec's Samples row.
- [ ] **Do not tick** "allow category change" (or Meta may silently move a template to Marketing at about 3x the price). If Meta suggests Marketing, reword rather than accept.
- [ ] **Record approval** (template name, language, status) and tell the implementer; WhatsApp sending stays off until all 18 are approved.
- [ ] **Add `WHATSAPP_APP_SECRET`** to `automations/.env` if not done yet, so inbound replies from recipients are signature-checked.

## During Implementation

- [ ] **Confirm Robben's recipients:** email (is `poaa@robbenrosmalen.nl` right, or a sales inbox?), WhatsApp number(s) with names (Thijs on `+31681764763`?), and get Thijs's explicit OK to receive WhatsApp updates from Lead Awaker (tick the consent box only after that).
- [ ] **Confirm Robben's language and time:** Dutch, 18:00 Europe/Amsterdam, email + WhatsApp, all five instant alerts on.
- [ ] **Coordinate with the `server/email.ts` restyle:** once it lands, confirm the layout export the recap emails will use.

## After Implementation

- [ ] **Send a test** of each type to your own email and phone from the "Recaps & alerts" card before switching Robben on.
- [ ] **Flip `CLIENT_ALERTS_WHATSAPP_ENABLED=true`** in `automations/.env` and restart the engine (`./preflight.sh && pm2 restart leadawaker-engine --update-env`).
- [ ] **Watch the first three recaps** in Automation Logs (workflow `client_alerts`) and the delivery statuses.
- [ ] **Check the Meta bill** after the first month against the estimate (about $5 per recipient a month).
