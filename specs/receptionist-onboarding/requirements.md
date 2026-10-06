# Receptionist onboarding: requirements

## Why

The onboarding wizard on the Accounts page (Communication tab) was built for
WhatsApp lead reactivation (DBR). New clients buy the AI receptionist on more
channels: phone (voice), the website widget and inbound WhatsApp. First client:
Robben Rosmalen (car dealer, 's-Hertogenbosch), who takes all of them.

Gabriel fills the wizard in together with the client on a call. Self-serve by
the client comes later, so wording stays plain enough for a client to follow,
but nothing client-facing (logins, save-and-resume links) is built now.

## What

One wizard, not one per service. A first step ticks the services the client
takes; each ticked service adds its own section. Questions every channel
shares (tone, name, hours, booking, objections, facts) are asked once.

### Sections, in order

| Section | Shown | Steps |
|---|---|---|
| Services | always | tick: Voice receptionist, Website chat, WhatsApp assistant, Lead reactivation |
| Identity and Style, Words, Availability, Booking, Sales, Facts | always | unchanged |
| Facts (new step) | always | Live stock feed: feed URL + notes, skippable |
| Handoff | always | (1) who gets called and alerted: name + mobile number. (2) when may the AI ring them live (anytime / during open hours / never, take a message), daily recap on/off + time |
| Voice | voice ticked | (1) forwarding: which line (company line / mobile / both), both numbers, landline provider, forward when (no answer / busy / unreachable / always), with the mobile dial codes shown. (2) sound: voice + language + greeting. (3) pronunciation list: word, say it as. (4) after hours: take a message / book a callback / ring the owner for serious buyers |
| Website chat | widget ticked | the existing Website chat card (create key, domains, look, snippet) |
| WhatsApp | WhatsApp ticked | (1) number: new dedicated number (recommended) or the existing one (coexistence, later), and which WhatsApp app the existing number uses. (2) connect: the existing Messaging card (Twilio + Embedded Signup) and the Inbound WhatsApp card |

GDPR and the processing agreement belong in the contract, not here.

### Storage

- `Account_Communication_Profile.services` (jsonb string array): the ticked services.
- `Account_Communication_Profile.setup` (jsonb): handoff, voice, whatsapp and stock answers.
- Steps that embed an existing card keep writing where that card writes (widget config, Accounts, Twilio).

### Summary view

The summary shows the ticked services and a row per new step, with the same
click-to-edit behaviour. Widget and WhatsApp rows show live status (widget
domains set, WhatsApp sender status).

## Out of scope (next phase: "set this up")

The engine does not read `setup` yet. Wiring comes after onboarding:
- per-account handoff number feeding `Voice_Numbers.transfer_number` and owner alerts
- owner alerts on WhatsApp + "took over" pause, daily recap via template
- pronunciation, greeting and after-hours rules reaching the phone prompt
- hourly stock sync from `setup.stock.feedUrl` into the KB
- client self-serve onboarding
