# US SMS: A2P 10DLC through Telnyx (research 2026-10-31)

Status: researched, not built. Waiting on Gabriel's go and a first US client.

## Can Lead Awaker register clients itself?
Yes. Telnyx acts as the registration provider; we register one Brand per client
and one Campaign per use case under our own Telnyx account, all by API. No ISV
application or ISV fee found. Needs a Level 2 verified Telnyx account with
messaging. Open questions for 10dlcquestions@telnyx.com: what `isReseller` /
`resellerId` do, and whether 10DLC works inside managed sub-accounts.

## What we have today
- Two-way SMS runs on Twilio only (account's Twilio number, inbound
  `/webhooks/sms/inbound`). Reactivation can send SMS-only or WhatsApp with SMS
  fallback (CRM: Reactivation > Channel & schedule).
- Telnyx SMS (`tools/telnyx_messaging.py`) is one-way from an alphanumeric
  sender name. The US does not allow alphanumeric senders, and there is no
  inbound Telnyx SMS route.
- CRM number ordering (`server/numberRequests/telnyxOrder.ts`) is NL, voice only,
  no `messaging_profile_id`.

## Build order (each step usable on its own)
1. Telnyx two-way SMS in the engine: send from a number on a messaging profile,
   inbound webhook (`message.received`) into `process_inbound`, delivery status.
2. Number purchase for US: search `GET /available_phone_numbers` (country US,
   features sms+voice), order `POST /number_orders` with `connection_id` and a
   per-client `messaging_profile_id` (`POST /messaging_profiles`,
   whitelisted_destinations ["US"]).
3. "US texting" panel on Accounts > Integrations:
   - Brand: `POST /v2/10dlc/brand` (entityType, displayName, companyName, ein,
     address, website, email, vertical; webhookURL). Sole proprietors (no EIN):
     entityType SOLE_PROPRIETOR + mobile phone, then OTP: `POST/PUT
     /10dlc/brand/{id}/smsOtp`, the client types the code into the panel.
   - Campaign: `POST /10dlc/campaignBuilder` (brandId, usecase e.g. MIXED or
     CUSTOMER_CARE, description, sample1..5, messageFlow, optin/optout/help
     messages and keywords). Only samples are editable afterwards.
   - Assign numbers: `POST /10dlc/phoneNumberAssignmentByProfile`
     {messagingProfileId, campaignId}.
   - Status: webhooks `10dlc.brand.update`, `10dlc.campaign.update`,
     `10dlc.phone_number.update` into a status row per account.
4. Toll-free alternative (no TCR fees): `POST /messaging_tollfree/verification/requests`.

## Costs and time
Brand ~$4 once, campaign review $15 per submission, campaign $10/month
(sole proprietor $2, low volume $1.50), first 3 months charged upfront.
Number $1/month, SMS ~$0.004 + carrier fee. Brand instant, vetting 1-7 days,
campaign review 5-10 business days: plan 1-2 weeks per client.

## Compliance
SMS needs its own consent (a WhatsApp opt-in does not count). Reactivating old
leads by SMS is marketing under the TCPA: prior express written consent, STOP/HELP
handling, business named in the first message (Reactivation > First message >
"Add an opt-out line"), opt-in records kept 4+ years. Get a legal check before the
first US reactivation.
