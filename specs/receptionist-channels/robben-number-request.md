# Robben: his own number and WhatsApp

Updated 2026-10-14. Everything below runs from his account in the CRM (Accounts id 53).

## The number

- **Choice: 073** (Den Bosch). In stock, $1 up front + $1 a month, needs documents. 085 is also possible (no documents), but Telnyx has none in stock, so it has to be requested.
- Callers never see this number. His 073 line and his mobile forward to it.

**Steps**
1. Integrations > Phone > "Documents for their own number": pick a number ("Show numbers in stock") and switch on "Order this number the moment the client submits".
2. He fills in his upload page (3 minutes): company details, KvK extract, ID copy, a bill for the Den Bosch address under 3 months old. Files go straight to Telnyx.
   Get his link with "Copy link" on that same card (it is private, so it stays out of this repo).
3. His Submit places the order. Telnyx checks it in about two days.
4. When approved, the same card shows "Attach to this account". Press it, put his mobile back as the transfer number on the Phone line tab, and set the forwarding.
5. Switch the lent number 073 851 9847 back to Lead Awaker's Sara.

## WhatsApp

Integrations > Messaging > WhatsApp card > "Connect with Meta". He logs in with Facebook in Meta's window and picks one:
- **Keep it on his phone:** the number must be on the WhatsApp Business app. He scans a QR code. His own replies pause Sophie in that chat.
- **A separate number:** a number not on WhatsApp yet. Meta sends a code by SMS or voice call.

Then, on the "How the assistant answers" card: who Sophie answers, and the hand-back time (4 hours).

No documents for Meta to start. Meta's business verification (KvK extract) is optional, done later by him in his own Meta account, and only raises sending limits.

## Forwarding (only once his own number is attached)

- Mobile: `**004*<his new number>#` forwards missed calls only. Check with `*#61#`, switch off with `##004#`.
- 073 line: if it is VoIP, set it in his provider's portal.

## Message to send

> Hi Thijs! Your AI receptionist is ready to try: call 073 851 9847 and she answers as Robben Rosmalen. Tell me what you think, good and bad.
>
> To put her on your own lines she gets a number in your company's name. Please fill in this page (about 3 minutes, your documents go straight to the phone carrier):
> [his upload link]
>
> You need a recent KvK extract, a copy of your passport or ID card, and an energy, internet or phone bill for the Den Bosch address (under 3 months old).
