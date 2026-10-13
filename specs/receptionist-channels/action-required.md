# Action Required: Receptionist Channels

Manual steps that must be completed by a human.

## Before Implementation

- [ ] **Review and approve the spec** (`requirements.md`, `implementation-plan.md`).
- [ ] **Decide on real voice booking for client lines.** Robben's phone AI says "booked" but nothing reaches his calendar (`voice/booking_tool.py` `_book()` is demo-only). This needs its own spec. Until it is fixed, the after-call message sends the booking link instead of a confirmation.
- [ ] **Add Lead Awaker's own Meta app secret** to `automations/.env` as `WHATSAPP_APP_SECRET` (Meta App Dashboard > App settings > Basic > App secret), then restart the engine. Do this BEFORE connecting the first client: saving the first client sender switches the webhook to checking signatures, and without this value Lead Awaker's own inbound WhatsApp would be rejected.
- [x] **Generate `CHANNEL_SECRETS_KEY`** (done 2026-10-11, in both `.env` files)

## Robben meeting (Monday 2026-10-12)

- [ ] **Sign the contract and the verwerkersovereenkomst (DPA)** covering phone, WhatsApp and SMS messages to his customers.
- [ ] **Get added as admin ("full control") to his Meta Business portfolio**, or have him create one, with 2FA on. Confirm who owns the Facebook page.
- [ ] **Check that `073 - 88 87 88 3` is not on the WhatsApp or WhatsApp Business app.** If it is, it has to be deleted there first.
- [ ] **Connect his calendar.** Ask which calendar he uses (Google is assumed, not confirmed). He connects it himself in his booking account on `cal.leadawaker.com` (user `robben-rosmalen`): send him the link and the login, and do it together on the call. Only the calendar's owner can approve Google's consent screen. A CRM login is not needed for this step.
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

## Going live (code is built, 2026-10-11)

Everything in the engine is dormant until it restarts. Order matters:

1. [ ] OK the engine restart (`./preflight.sh && pm2 restart leadawaker-engine --update-env`). Preflight passed on 2026-10-11.
2. [ ] Only after the restart: write `prompt_124_reception_text_v1_2.txt` to Prompt_Library 124 (nobody may have the prompt open in the CRM). Before the restart it would show raw `{{ASK_CONTACT}}` text to visitors.
3. [ ] Set `handoff_on_first_request = true` on campaign 72.
4. [ ] Pick the wording in `voice_prompt_followup_line.md` (the "details follow on WhatsApp" line for the phone AI).
5. [x] SMS wording (2026-10-12): the SMS drops the template's "reply to this message" sentence and ends with "Questions or changes? Call {phone}." (`tools/channel_fallback.py`).
6. [ ] The engine repo has this work uncommitted, mixed with other uncommitted voice work in the same files. Commit it together when that work is ready.

## After Implementation

- [ ] **Known gap (2026-10-14): a reply from a number the caller gave lands on a new lead.** When a caller asks for the after-call WhatsApp on another number than they called from, the message goes there, but a reply from that number is matched by phone and becomes a new Leads row. The AI then answers without the call, the booking or the earlier chat. Fix later by linking the given number to the caller's lead (e.g. an alternate-phone lookup in the inbound lead resolution). Only matters once Robben's WhatsApp is connected, and only for callers who give another number.
- [ ] **Decide `VOICE_BOOKING_IS_REAL`** (`automations/src/automations/voice/after_call_rules.py`). Phone bookings on Robben's line are real since phone booking v2 (2026-10-13: call `live_u1_EYchJp3oMf7FYCahAQmXqGzm0GjPEm8o` booked 15 Oct 11:00, Cal.diy raised `appointment_booked` with source `phone`), and client lines book only in real mode. While the flag is off, a caller who booked gets the "link to plan your appointment" message instead of the confirmation.

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

  All were accepted as UTILITY, and all 24 were APPROVED when checked on 2026-10-11. Script: `submit_templates_2026_10_10.py`.
- A test alert (`la_lead_needs_reply`, en) was sent to Gabriel's WhatsApp `+55 47 7400-2162`; Meta accepted it. Its button points to `app.leadawaker.com/go/test0001`, which does not exist until client-recaps Phase 5 is built.
