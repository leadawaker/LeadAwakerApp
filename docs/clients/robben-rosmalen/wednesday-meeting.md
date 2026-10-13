# Robben Rosmalen: Wednesday 2026-10-14 meeting prep

Updated 2026-10-13, after the upload link, the automatic number order and the two WhatsApp options were built.

The goal: leave with the agreement signed, his number ordered, WhatsApp connected the way he prefers, and Thijs knowing exactly how his phone works with Sophie. Forwarding goes live only once Telnyx has approved his own number (about two days after he submits his documents).

## Before Wednesday (Gabriel, in the CRM and docs)

**Paperwork**
- [ ] Fill the blanks in `partnership-trial.md`: Robben's KvK number and the start and end dates. Lead Awaker's details are filled in. Print two copies.
- [ ] Check `processing-agreement.md` (the DPA), drafted 2026-10-12. Open points: the Telnyx entity and region, and accepting Groq's and Resend's data processing terms. Print two copies.
- [ ] Call Thijs: ask him to try Sophie on 073 851 9847, and tell him you come by on Wednesday.
- [ ] Send him the upload link right after the call (message in `specs/receptionist-channels/robben-number-request.md`). If he submits today, Telnyx's two-day check is running before you arrive.
- [ ] Before sending: on his account, Integrations > Phone > "Documents for their own number", press "Show numbers in stock", pick a number if you care which one, and switch on "Order this number the moment the client submits". The area code is already set to 073.

**His account (Accounts id 53)**
- [ ] Clean up test data from his test calls on 073 851 9847: since 2026-10-12 they create **real** leads in his account, and any booking lands in his Cal.diy (`robben-rosmalen` on cal.leadawaker.com). Delete the test leads, and cancel the test bookings in Cal.diy.
- [ ] Decide whether to keep the 3 browser test calls under "Recent test calls". They are useful to show him how a call looks.
- [ ] Alerts and recaps: add Thijs as a recipient (email, and WhatsApp once he opts in). Today only Gabriel gets them.
- [ ] Phone line tab: check that every readiness item is green. Check the handoff settings with his answers on Wednesday.
- [ ] Do one test run of "Connect with Meta" with a number of your own before Wednesday. Neither button has been run against Meta yet.
- [ ] Create his CRM login (client user, none exists yet), so it is ready to hand over at the end of the meeting.
- [ ] Delete the redundant Voice_Numbers row 2 (`browser-test:robben`) once his own number is attached.
- [ ] Stock: check the feed (`robbenrosmalen.nl/aanbod/feed/`) still matches his site, so Sophie names the right cars when he tests.

**Know the answers he will ask about**
- [ ] What it costs per month (the agreement says around €40, with a check-in above €75).
- [ ] What happens when he is on holiday, after hours, or when Sophie does not know an answer.

## What we need from him

1. The documents for the number, through the upload link: company details, KvK extract, ID copy, and a recent bill for the Den Bosch address. If he has not done it by Wednesday, do it together on his phone: it takes three minutes.
2. Which provider his 073 line is with, and whether it is VoIP (forwarding in a web portal) or a classic line.
3. Which provider his mobile is with.
4. Which calls Sophie should take:
   - only the calls he misses;
   - also after hours;
   - everything on 073.
5. Handoff: who gets a call Sophie passes on (him on 06 81 76 47 63?), and when (always, or only during opening hours). On a passed-on call, he hears a short summary first and presses 1 to take it.
6. His choice for WhatsApp (the two options on the WhatsApp card under Integrations):
   - **Keep WhatsApp on his phone.** The number must be on the WhatsApp Business app, not the normal WhatsApp. He sees every chat and can answer himself.
   - **A separate number for the assistant.** A number that is not on WhatsApp yet; his own WhatsApp stays untouched.
7. For either option: his Facebook login at hand, and the phone with that WhatsApp number. He logs in himself in Meta's window on your laptop. Which number does he want customers to message: the 073 line or his mobile?
8. If he keeps WhatsApp on his phone, who should Sophie answer: everyone, or only new contacts?
9. Which calendar he uses. He connects it himself in his Cal.diy account, because only the owner can approve Google's consent screen.
10. The SMS sender name (max 11 characters, for example "Robben") and the WhatsApp display name ("Robben Rosmalen").
11. Rules Sophie must follow:
    - Can she name prices?
    - Trade-in: what does she promise?
    - What should she never say?

## What to teach him

**Forwarding on his mobile** (a setting on his phone network, set once):
- `**004*<Sophie's number>#` then the call button forwards **every missed call**: no answer, busy and unreachable.
- `*#61#` checks whether it is on.
- `##004#` switches it off again.
- His phone still rings first. Pressing **decline** sends that one caller to Sophie straight away.
- Do not use "forward everything" (`**21*`): then his phone never rings, and Sophie cannot pass calls back to him.

**Forwarding on 073**
- If it is VoIP, it is set in his provider's portal, not with a code. Do it together.

**How Sophie behaves**
- She speaks Dutch, says she is a digital assistant, and keeps answers short.
- She knows the stock from his website and the details in his account.
- She books viewings and test drives in his calendar.
- She takes a message when she cannot help.
- Passed-on calls: his phone rings, he hears who it is and why, and presses 1 to take the call.
- After each call he gets a recap: the caller, what they wanted, and what was agreed.

**WhatsApp, if he keeps it on his phone**
- Sophie answers his WhatsApp chats; he sees everything in his own app.
- When he replies to a customer himself, Sophie goes quiet in that chat.
- To hand a chat back to her, he sends `/go` in that chat. The customer sees that message too, so the quieter way is to let it hand back by itself after the waiting time you set (2, 4 or 24 hours).
- He has to open WhatsApp on that phone at least every two weeks, or Meta drops the link.

**How to give feedback**
- In the first weeks: a WhatsApp to Gabriel with the time of the call and what went wrong. We review calls together and adjust.

**The CRM** (hand the login over at the end)
- Calls with transcript and recording, leads, bookings, the daily recap.

## Wednesday agenda (about an hour)

1. Ten minutes: he calls Sophie himself on speaker. Fix nothing on the spot; write down what he wants changed.
2. Go through and sign `partnership-trial.md` and the DPA.
3. Number: check that his documents are in and the order is out (Integrations > Phone). If not, he fills in the upload page now.
4. WhatsApp: he picks an option, you press "Connect with Meta", he logs in with Facebook and follows Meta's steps. Then set "Who the assistant answers" and the hand-back time together.
5. Connect his calendar in Cal.diy.
6. Show him the forwarding codes. Set them only once his own number is approved and attached. If Telnyx has already approved it by Wednesday, press "Attach to this account" and set the forwarding on the spot.
7. Hand over the CRM login and show the calls page.
