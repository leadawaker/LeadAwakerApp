# Robben: what to ask for his AI phone number

Checked 2026-10-12 against Telnyx's live requirements and stock.

## First, the one thing to understand

Callers never see the new number. They keep calling his numbers as they do today: the general line `073 - 88 87 88 3` and Thijs's mobile `06 81 76 47 63`. Those numbers forward to the new one. So the choice between 085 and 073 is about paperwork and stock, not about how it looks to his customers.

Both types can be a forwarding target. A forward from a Dutch mobile to an 085 or 073 number is billed as an ordinary national call, which most bundles include. He should check his own plan.

## 085, 073 or 097?

All three are registered in **his** company's name. For 085 and 097 Gabriel can fill in the form himself, because no documents are needed.

| | 085 (national) | 073 (Den Bosch) | 097 (Dutch "machine" number) |
|---|---|---|---|
| What Telnyx needs | Company legal name, a contact name and phone number, and any Dutch address. **No documents.** | KvK extract, ID of a representative, and proof of an address in the 073 area that is less than 3 months old. | A contact name and phone number, and an address. **No documents.** |
| In stock at Telnyx today | **None.** We have to ask Telnyx to source one. | Yes, for example +31 73 851 9861 ($1 up front, $1 a month). | Yes, for example +31 97 010 285 309 ($2 up front, $3 a month). |
| Can be forwarded to | Yes | Yes | Yes, but some Dutch mobile plans charge 097 outside the bundle or block it. Check with his provider first. |
| Receives SMS | No | No | Yes |

**Decision (2026-10-13):** go with 073. It is in stock, the upload page and the automatic order are built for it, and his Den Bosch address matches the area code. 085 stays an option for later clients if Telnyx gets stock.

## WhatsApp and Meta's code call

Meta verifies the number that goes **on WhatsApp**, not the new AI number. Since 2026-10-12 the WhatsApp card (Integrations > Messaging) offers two ways, both through Meta's own window:

- **Keep WhatsApp on his phone:** the number must already be on the WhatsApp Business app. No code call is needed; he scans a QR code in the app.
- **A separate number for the assistant:** a number that is not on WhatsApp yet. Meta sends a code by SMS or voice call. For a landline choose "voice call"; he picks up and reads out the 6-digit code. If that line already forwards to Sophie, the code is in the call transcript instead.

Meta's own paperwork (business verification, with a KvK extract) is not part of our pages. He does it inside his Meta business account, and it is not needed to start.

## What to ask him

**For the number (Telnyx):**
1. The full legal company name, exactly as in KvK (for example "Robben Rosmalen B.V."), and the KvK number.
2. Who represents the company (full name), and a phone number Telnyx can reach.
3. Is Afrikalaan 17a, 5232 BD 's-Hertogenbosch the registered address?
4. Only if we go for 073:
   - A recent KvK extract (PDF from kvk.nl).
   - A colour copy of the representative's passport or ID card. Front and back for an ID card. He may black out the BSN.
   - An energy, internet or phone bill for the Den Bosch address, less than 3 months old.

**For forwarding:**

5. Who is the provider of `073 - 88 87 88 3`, and is it a fixed line or VoIP (a web portal)? On VoIP, forwarding is set in the portal, not with a code.
6. Who is the provider of his mobile?
7. Which calls should Sara take? The options are:
   - only the calls he misses;
   - also after hours;
   - everything on the general line.

**On the Wednesday list (`docs/clients/robben-rosmalen/wednesday-meeting.md`):**

8. Contract and verwerkersovereenkomst (DPA).
9. His WhatsApp choice, and his Facebook login for Meta's window.
10. Which calendar he uses.
11. The SMS sender name and the WhatsApp display name.

## How he hands the documents in

He uses a private upload page. His link (created 2026-10-13, area code 073 already set):

https://app.leadawaker.com/number-docs/wKHUNaLwrjkx0LIsplpfwbe-?lang=nl

- He fills in the company details and uploads the three documents. The files go straight to Telnyx; we keep no copy.
- On his account under Integrations > Phone you can pick the number and switch on "Order this number the moment the client submits". With that on, his Submit places the order in his company's name. Without it, you press "Order the number now" afterwards.
- Telnyx then checks the documents (two days for our own 073). When it is approved, the card shows "Attach to this account".
- This page handles Telnyx only. It does not send anything to Meta.

## Ready-to-send message

> Hi Thijs! Good news: your AI receptionist is ready to try. You can call her today on 073 851 9847, and she answers as Robben Rosmalen. Please try her out and tell me what you think, good and bad.
>
> To put her on your own lines, she gets a phone number in your company's name. The phone carrier has to check who the number belongs to, so please fill in this page (about 3 minutes, your documents go straight to the carrier):
> https://app.leadawaker.com/number-docs/wKHUNaLwrjkx0LIsplpfwbe-?lang=nl
>
> You will need a recent KvK extract, a copy of your passport or ID card, and an energy, internet or phone bill for the Den Bosch address (no older than 3 months).
>
> On Wednesday I'd like to come by to sign the agreement and set up your phone and WhatsApp together. Does that work for you?
