# Action Required: Client Recaps and Instant Alerts

Manual steps that must be completed by a human.

## Before Implementation

- [x] **Review and approve the spec** (`requirements.md`, `implementation-plan.md`), including the recommended instant-alert set and the added `lead_needs_reply` alert.
- [x] **Answer the open questions** at the bottom of `requirements.md` (phone number in WhatsApp, quiet hours, who edits settings, agency copy).
- [x] **Decide on the phone-line booking gap:** (decided 2026-10-12: real voice booking is being built; no "please confirm" variant) Robben's line tells callers "booked" but writes nothing to his calendar (`voice/booking_tool.py:277` is demo-only). Either accept "please confirm" callback alerts for now, or schedule real voice booking first.

## Submit the WhatsApp templates (WhatsApp Manager)

Do this early: approval takes minutes to 48 hours, and a rejection means a reworded resubmit.

- [ ] **Confirm the sender:** in WhatsApp Manager, check which number `WHATSAPP_PHONE_NUMBER_ID` points to, that its display name reads "Lead Awaker" (approved), and that the business is verified (messaging limit of at least 1,000 business-initiated conversations a day).
- [x] **Create 6 templates**, each with category **Utility** and three languages (Dutch `nl`, English `en`, Portuguese (BR) `pt_BR`), copying header, body, footer and button exactly from `requirements.md`:
  - `la_daily_recap`
  - `la_appointment_booked`
  - `la_appointment_rescheduled`
  - `la_appointment_cancelled`
  - `la_callback_requested`
  - `la_lead_needs_reply`
- [ ] **For every template:** footer `Lead Awaker`; one button of type **Visit website**, **Dynamic** URL `https://app.leadawaker.com/go/{{1}}`, sample `https://app.leadawaker.com/go/k7Q2mX9a`; button text per language from the spec; fill every body sample value from the spec's Samples row.
- [ ] **Do not tick** "allow category change" (or Meta may silently move a template to Marketing at about 3x the price). If Meta suggests Marketing, reword rather than accept.
- [x] **Record approval** (all 18 APPROVED 2026-10-11) (template name, language, status) and tell the implementer; WhatsApp sending stays off until all 18 are approved.
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

## Going live (code built 2026-10-12)

1. [ ] The engine restart for receptionist-channels (its `action-required.md`, "Going live", step 1) also starts this feature: the recap and sweeper jobs, the booking / call / handoff hooks, the reply guard and the test route. No separate restart needed. `CLIENT_ALERTS_WHATSAPP_ENABLED` stays false until step 4.
2. [ ] Run the engine migration only if the table is missing (it was created on 2026-10-12): `.venv/bin/python scripts/migrate_add_client_alert_log.py`.
3. [ ] Robben (account 53), Accounts > Robben Rosmalen > Recaps & alerts: add the email recipient and Thijs's WhatsApp number (the "Add Thijs (+31681764763)" button uses the handoff contact), tick consent only after his OK, language Dutch (or "Same as the account"), recap 18:00. The first save creates the alerts block, which switches the daily recap on.
4. [ ] Send a test email and a test WhatsApp from the card (to your own number first: add yourself as a recipient, test, remove), then set `CLIENT_ALERTS_WHATSAPP_ENABLED=true` in `automations/.env` and restart the engine again.
