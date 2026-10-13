# Requirements: Receptionist Channels (WhatsApp, SMS fallback, after-call follow-up, shared memory)

## What and Why

Robben Rosmalen (Accounts id 53) is the first real client of the AI voice receptionist. Gabriel wants to sell the same receptionist on two more doors: the website chat widget and WhatsApp. The widget is configured and working (campaign 72, prompt 124, Widget_Configs 10). WhatsApp and the glue between the channels are not.

This feature makes the receptionist one assistant across three doors (phone, WhatsApp, website chat) for any client, starting with Robben:

1. **Per-client WhatsApp, directly on Meta's Cloud API** (no Twilio). Each client has their own WhatsApp Business account and number, owned by the client, connected to our engine.
2. **WhatsApp templates managed from the CRM**: the standard receptionist templates are submitted to the client's WhatsApp account through the API and their approval status is shown on the account page. Nobody has to open Meta's WhatsApp Manager.
3. **SMS fallback via Telnyx** for numbers that are not on WhatsApp, as a one-way alphanumeric sender (for example `Robben`).
4. **After-call WhatsApp follow-up**: 30 seconds after a phone call ends, the caller gets a WhatsApp message (booking confirmation, or the booking link), with SMS fallback.
5. **Shared memory between phone and WhatsApp**: the text AI knows what was said on the last phone call, and the voice AI knows what was said on WhatsApp.
6. **Website chat contact capture**: when Sophie asks for contact details, the widget shows a small form (name, plus phone or email) instead of relying on the open chat. What the visitor fills in or types is saved on the lead and on the calendar booking.
7. **Immediate handoff on reception campaigns**: a first request for a person is a real handoff (callback), not the current "try to help first".

Twilio is no longer the WhatsApp path for new clients (Gabriel's decision, 2026-10-10). The Twilio code stays in place but receives no new work.

## Fixed decisions (Gabriel, 2026-10-09/10)

- **Direct Meta Cloud API per client.** Onboarding: the client adds Gabriel as an admin ("full control") to their Meta Business portfolio. Gabriel creates, inside the client's portfolio: a Meta app, the WhatsApp Business account (WABA), the phone number, and a system user with a permanent token. The CRM stores those details per account. Lead Awaker is not a Meta Tech Provider; no Embedded Signup.
- **Robben's WhatsApp number is his landline `073 - 88 87 88 3`**, registered on the WhatsApp Business Platform with voice-call verification. It keeps working for normal calls. If the verification call is forwarded to the AI line, the spoken code is read from the call transcript on the Voice Calls page.
- **Voice line: a Telnyx `085` number** bought in Lead Awaker's Telnyx account with Robben's company details (no documents needed for 085). Robben's 073 forwards to it.
- **Billing:** Gabriel's own card on the client's WABA (Meta Billing Hub), re-billed to the client. Spend is visible per client in WhatsApp Manager > Insights and in Billing Hub. Since 2026-10-01 each number gets 1,000 free service messages a month; templates are billed per message.
- **SMS fallback:** Telnyx alphanumeric sender (one-way, max 11 characters, no NL registration). Because the recipient cannot reply, every SMS ends with how to reach the business (a "call us" line; the WhatsApp "reply to this message" sentence is cut).
- **After-call follow-up timing and rules:** see "After-call follow-up rules" below.
- **Alerts to the business owner** (handoff, callback, booking) come from Lead Awaker's own WhatsApp number and are specified separately in `specs/client-recaps/`. For the pilot, Robben's alerts go to Gabriel (+55 47 7400-2162). Every alert sent is logged and visible in the CRM, whichever number sends it. Sending alerts from the client's own WhatsApp number is a later, per-account option (see client-recaps, "Later: choose the sending number").

## After-call follow-up rules

Sent 30 seconds after a client-line phone call ends, when ALL of these hold:

1. The account has after-call follow-up switched on (Voice tab).
2. The call is on a client line (not the demo line, not a browser test, not a probe call).
3. Caller ID is an E.164 Dutch mobile number (`+316…`). Withheld numbers, landlines and `+3197` M2M numbers are skipped. Foreign mobile numbers: skipped in v1.
4. The call was not screened out (sales pitch, robocall, abuse), the caller is not blocked, the recap intent is not `do_not_contact`, and the lead is not opted out.
5. The call had at least 2 caller turns (an immediate hang-up gets nothing).

**Which message:**

- Booking made or changed on this call: `reception_call_booked` (always sent, even if a follow-up went out earlier the same day, because it carries new information).
- Otherwise: `reception_call_followup` with the lead's booking link. At most one of these per lead per 24 hours, so a caller whose line dropped and who calls straight back does not get two identical messages.
- If the caller sent us a WhatsApp message in the last 24 hours (service window open), send the same content as a normal free-form text instead of a paid template.

**Fallback:** if WhatsApp reports the number is not on WhatsApp (Cloud API error 131026, or the equivalent undeliverable status), send the same content once by SMS from the account's alphanumeric sender, ending with the business phone number.

**Expectation in the call:** the voice prompt gets one line so Sophie says the details will follow on WhatsApp when it fits.

## Templates

Customer-facing templates live in a catalog in the engine (single source of truth), are submitted per client WABA, in the client's languages. Category UTILITY. First set (approval-checked on Lead Awaker's own WABA on 2026-10-10, ids in action-required.md):

| Name | Variables | EN body |
|---|---|---|
| `reception_call_booked` | 1 first name, 2 business name, 3 date and time | Hi {{1}}, thanks for calling {{2}}. Your appointment is confirmed for {{3}}. Need to change it? Just reply to this message. |
| `reception_call_followup` | 1 first name, 2 business name, 3 booking link | Hi {{1}}, thanks for calling {{2}}. Here is the link to plan your appointment: {{3}} Any questions? Just reply to this message. |
| `reception_appointment_reminder` | 1 first name, 2 business name, 3 date and time | Hi {{1}}, a reminder of your appointment with {{2}} on {{3}}. Can't make it? Reply to this message and we will find another time. |

NL bodies are in the catalog (`automations/src/automations/whatsapp_templates/catalog.py`, Phase 4). Business-initiated sends outside the 24-hour window (bumps, reminders, no-show recovery, reschedule re-engage, buying-signal follow-up) use the catalog's template for that purpose or are skipped and logged; they never send free text outside the window.

## Shared memory between phone and WhatsApp

- **Text AI:** when a lead has phone calls in the last 30 days, the conversation prompt gets a `[RECENT PHONE CALLS]` block: when, what they wanted, the outcome, any booked time. Raw spoken turns (Interactions `type='voice_call'`) no longer appear as chat history.
- **Voice AI:** at call start, caller memory also reads this caller's WhatsApp and website messages from the last 30 days, as a one-line summary per conversation, inside the existing 1.5 s lookup budget. A WhatsApp-only contact calling for the first time is recognised.
- Same person = same Leads row: the lead lookup on every inbound path is scoped to the account (today `get_lead_by_phone` matches across all accounts).

## Acceptance Criteria

- [ ] An account can be connected to its own WhatsApp number from the account page (WABA id, phone number id, app id, app secret, system-user token), with a "Test connection" check. Tokens are stored encrypted.
- [ ] An inbound WhatsApp message to a client's number creates or finds the lead **in that account**, runs that account's inbound campaign, and the reply goes out from the client's number. Messages to Lead Awaker's own number behave exactly as today.
- [ ] Webhook signatures are verified per app secret; an unsigned or wrongly signed POST is rejected once any secret is configured.
- [ ] The account page lists the receptionist templates per language with Meta status (pending, approved, rejected with reason) and has Submit / Resubmit. Status updates arrive by webhook and by a manual "Refresh".
- [ ] Outside the 24-hour window, the engine sends an approved template or skips and logs; it never attempts free text.
- [ ] A WhatsApp send to a number that is not on WhatsApp falls back once to Telnyx SMS from the account's alphanumeric sender, and the lead's `resolved_channel` becomes `sms`.
- [ ] 30 seconds after an eligible call, the caller gets the right follow-up, following every rule above; ineligible calls get nothing; each decision is written to Automation_Logs.
- [ ] The text AI on WhatsApp can answer "what did we discuss on the phone?" correctly, and the voice AI greets a WhatsApp-only contact as known.
- [ ] When the AI asks a widget visitor for contact details, a form (name, phone or email) appears in the chat. Submitting it, or typing the details instead, saves them on the lead (phone in E.164) and on the Cal.diy booking attendee.
- [ ] On a reception campaign, the first "I want to talk to a person" hands off immediately (lead paused for the AI, owner alerted).
- [ ] Robben (account 53): WhatsApp campaign live on his 073, widget campaign 72 in Dutch, Voice_Numbers row pointed at his campaign, follow-up switched on.

## Dependencies and related work

- `specs/client-recaps/` (alerts and daily recap to the business owner, from Lead Awaker's number). Its 18 `la_*` templates were submitted on 2026-10-10. Build it alongside this spec; Phase 7 here relies on its `lead_needs_reply` / `callback_requested` alerts.
- **Real voice booking on client lines is a blocker for `reception_call_booked`.** `automations/src/automations/voice/booking_tool.py` `_book()` books only into the demo diary; on Robben's line, callers hear "booked" and nothing reaches his calendar (found 2026-10-09, see client-recaps). Until a separate spec fixes it, the follow-up treats a voice "booking" as a request and sends `reception_call_followup`.
- `specs/voice-caller-memory/` (caller memory, extended in Phase 6).
- `specs/website-widget/` (widget; Phase 7 adds contact capture).
- Existing channel fallback: `automations/tools/channel_fallback.py`, `Leads.resolved_channel`.

## Out of scope

- Embedded Signup / becoming a Meta Tech Provider (revisit at roughly 5+ clients).
- Two-way SMS (needs a +3197 number per client).
- Buying or porting numbers from the CRM.
- Marketing templates and outbound campaigns on the new WhatsApp path (reception only in v1).
- Merging a widget lead into an existing phone/WhatsApp lead with the same number (v1 saves the phone only).
- Removing the Twilio code.
