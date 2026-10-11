# Action Required: Receptionist Channels

Manual steps that must be completed by a human.

## Before Implementation

- [ ] **Review and approve the spec** (`requirements.md`, `implementation-plan.md`).
- [ ] **Decide on real voice booking for client lines.** Robben's phone AI says "booked" but nothing reaches his calendar (`voice/booking_tool.py` `_book()` is demo-only). This needs its own spec. Until it is fixed, the after-call message sends the booking link instead of a confirmation.
- [ ] **Generate `CHANNEL_SECRETS_KEY`** (`openssl rand -base64 32`) and add the same value to `LeadAwakerApp/.env` and `automations/.env`. It encrypts each client's WhatsApp token and app secret.

## Robben meeting (Monday)

- [ ] **Sign the contract and the verwerkersovereenkomst (DPA)** covering phone, WhatsApp and SMS messages to his customers.
- [ ] **Get added as admin ("full control") to his Meta Business portfolio**, or have him create one, with 2FA on. Confirm who owns the Facebook page.
- [ ] **Check that `073 - 88 87 88 3` is not on the WhatsApp or WhatsApp Business app.** If it is, it has to be deleted there first.
- [ ] **Agree the SMS sender name** (proposal: `Robben`, max 11 characters) and the WhatsApp display name (must match his brand, e.g. "Robben Rosmalen").
- [ ] **Later, for Meta business verification (not needed to start):** a recent KvK extract (Dutch version). Unverified accounts can start up to 250 conversations a day; replies are not capped.

## During Implementation

- [ ] **Buy the Telnyx `085` number** for Robben's voice line under his company details (rep name, company name, contact phone, Dutch address; no documents). Ask Robben's provider to forward 073 to it.
- [ ] **Create a Telnyx messaging profile** with alphanumeric sender enabled.
  - Webhook URL: `https://webhooks.leadawaker.com/webhooks/telnyx/messaging`.
  - Copy its id to `automations/.env` as `TELNYX_MESSAGING_PROFILE_ID`, and the account public key as `TELNYX_PUBLIC_KEY`.
- [ ] **In Robben's Meta portfolio, create:**
  1. An app (type Business) with the WhatsApp product.
  2. The WABA and the phone number 073, verified by **voice call**. If 073 forwards to the AI line at that moment, read the spoken code from the call transcript on the Voice Calls page. Turn off robocall screening on the line for those minutes, because Meta's call can look like a robocall.
  3. A two-step PIN (6 digits; keep it in the password manager).
  4. A system user (admin) with a permanent token that has `whatsapp_business_messaging` and `whatsapp_business_management`, with the WABA assigned.
  5. A webhook subscription: callback `https://webhooks.leadawaker.com/webhooks/whatsapp`, verify token = `WHATSAPP_VERIFY_TOKEN`, fields `messages` and `message_template_status_update`.
  6. Your own card in Billing Hub as the WABA payment method.
- [ ] **Paste** WABA id, phone number id, app id, app secret and token into the new WhatsApp card on Robben's account page, click "Test connection", then "Submit all" for the templates (nl, en).
- [ ] **OK the engine restarts** for Phases 2, 3, 5 and 6 (a restart drops live calls).

## After Implementation

- [ ] **Test with a fresh phone number** that is not a lead anywhere:
  1. A WhatsApp to 073 gets an AI reply from 073.
  2. A call to the 085 line with "do not book" gets the follow-up WhatsApp after about 30 seconds.
  3. A landline caller gets nothing.
  4. A number not on WhatsApp gets the SMS from "Robben".
- [ ] **Switch Robben's widget and WhatsApp campaigns to Dutch** (Phase 8.1).
- [ ] **Check the Meta spend after the first month** in WhatsApp Manager > Insights and in Billing Hub, and re-bill Robben.

## Done on 2026-10-10 (for reference)

- Widget for Robben configured and tested (campaign 72, prompt 124 v1.1, Widget_Configs 10). A test booking that reached Robben's Cal.diy was cancelled the same minute; the test leads were deleted.
- 24 templates submitted to Lead Awaker's own WABA (`2383356682144521`, number +31 6 27458300, verified):
  - the 18 `la_*` alert templates from `specs/client-recaps/`;
  - 6 `reception_*` templates (en, nl), submitted as an approval check only.

  All were accepted as UTILITY. At first check, 6 were already approved: `la_lead_needs_reply` en and pt_BR, `la_appointment_booked` en, `la_appointment_cancelled` en, `la_daily_recap` en, `reception_call_booked` nl. The rest were pending. Script: `submit_templates_2026_10_10.py`.
- A test alert (`la_lead_needs_reply`, en) was sent to Gabriel's WhatsApp `+55 47 7400-2162`; Meta accepted it. Its button points to `app.leadawaker.com/go/test0001`, which does not exist until client-recaps Phase 5 is built.
