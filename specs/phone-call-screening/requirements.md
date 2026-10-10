# Phone line: transfer modes, office sound, unwanted calls

Status: BUILT 2026-10-08 (engine 837a64b, app commit alongside this file).
Follows `specs/phone-screened-transfer/`.

## What Gabriel asked for

1. Choose per line how callers are put through, so a line can be tested with and
   without the screened (conference) wiring.
2. The office sound as its own switch, no longer the same thing as the wiring.
3. Wiring follows the settings automatically, for every line, not by hand.
4. Before ringing the owner, Sara asks once who is calling and what it is about.
5. Mike Foroodi's spam rules, adapted: sales pitches, robocalls and abuse, each a
   per-account switch, all on by default. Abuse: one warning, then end. Two
   strikes (decided 2026-10-08): the first abusive call from a number is only
   noted ('warned'); a second within 30 days blocks it 14 days. Every strike
   sends the account's users (and agency Owners/Admins) a `voice_abuse` CRM
   notification. Unblock/Clear in the card. Silence stays on the existing timer.

## Settings (Account_Communication_Profile.setup)

| Key | Values | Default |
|---|---|---|
| `handoff.mode` | `screened` / `direct` / `off` | `screened` |
| `voice.officeSound` | boolean | false |
| `screening.{sales,robocalls,abuse}` | boolean | true (missing = on) |

## Wiring rule (engine `line_wiring.py`)

A number is on the Telnyx conference route when its account wants a screened
transfer and has a transfer number, or wants the office sound. Otherwise direct.
The CRM calls `POST /voice/phone/wiring/sync {account_id}` after every Voice tab
save; the result (or error) comes back on the PUT response as `wiring`.

| Mode | Office sound | Route | What a transfer does |
|---|---|---|---|
| screened | any | conference | brief + press 1; anything else back to Sara |
| direct | on | conference | connected on answer, no brief; no answer back to Sara |
| direct | off | direct | blind REFER, Sara leaves; no answer = voicemail |
| off | any | per office sound | nobody put through; callback |

Every call on the conference route is two Telnyx legs for its whole length.

## Unwanted calls (engine `call_screening.py`)

- Prompt lines per switch, after the handoff paragraph, in en/nl/pt-BR/pt-PT.
- Backend `end_call` gains `kind`: `sales_pitch` | `robocall` | `abuse`.
- `robocall` and `abuse` may end without her goodbye; `sales_pitch` still needs
  it (she is told to say it). Each is noted on the transcript
  (`[Call ended: robocall]`) and stored as `Voice_Calls.end_reason`.
- `abuse` inserts a `Voice_Blocked_Callers` row: reason `warned` (blocks
  nothing, blocked_until = now) on the first strike, reason `abuse` (14 days)
  on a second strike within 30 days. The phone door rejects a blocked number
  with 486 before answering. A failed lookup lets the call in.
- Sales rule is narrow: someone offering this business their own product, not
  someone asking about what this business offers. First wording listed example
  industries ("leads, marketing") and turned away a solar client asking about
  "our lead campaign" on Lead Awaker's own line; the examples were removed.

## CRM

- Voice tab Transfer card: mode chips; number/name hidden when off; waiting
  choice only for screened.
- Number card: Office sound switch (saves on flip) and the wiring error, if any.
- New "Unwanted calls" card: three switches and the blocked list with Unblock
  (`GET/DELETE /api/accounts/:id/voice/blocked[/:blockId]`).
- Demos > Settings > Voice office sound switch now writes account 1's
  `voice.officeSound` and syncs, instead of moving the number itself.

## Verified live (probe calls, 2026-10-08)

Ask-first then press 1 (connected); decline with office sound off (no
ambience, callback booked); robocall ended silently in ~10 s; abuse warned,
ended, blocked, next call rejected, unblock via API; sales pitch declined;
solar client about "our lead campaign" treated as a customer after the fix;
wiring flipped direct/conference by saving modes.

## Open

- Twice the front model said "I'll see if he's free" and no transfer started
  (no tool call). `voice.phone.backend_said` now logs backend text replies to
  find out which side drops it.
- Browser door ("Try her out") has no screening: phone only.
- Not tested live: direct mode (unit tests only), a real handset, real robocalls.
