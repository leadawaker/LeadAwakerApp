# Voice prompt line for the after-call WhatsApp (Phase 5, task 5.6)

Status: PROPOSAL, waiting for Gabriel's approval. Nothing in `Prompt_Library` was changed.

## What this is

When the after-call follow-up is on for an account, the receptionist may tell the caller that a WhatsApp message follows the call. This file proposes the exact sentence per language, which prompt rows get it, and how it is switched on and off.

## How it is gated (a variable, not prose)

The sentence is not written into the prompt rows. The rows get a placeholder, `{followup}`, and the engine fills it per call:

- with the sentence, when all three hold for this call:
  1. the caller ID is a Dutch mobile number (`+316` and 8 digits),
  2. the account's own WhatsApp number is connected (`WhatsApp_Senders.status = 'connected'`),
  3. the account's switch is on (`Accounts.after_call_followup_enabled`);
- with nothing otherwise.

So she never has to judge whether a message will come. A caller on a landline or with a withheld number, a call on the demo line, a browser test, and every account with the switch off: the sentence is simply not in her prompt.

Engine plumbing (already in the code, inert today):

- `automations/src/automations/voice/followup_line.py`: the sentences and `promises_followup(account_id, caller_number)`.
- `build_live_session_config(..., followup=...)` replaces `{followup}`.
- `phone_voice_routes.py` passes `followup=client_line and await promises_followup(...)`.

It is inert because no row contains `{followup}` yet, so the replace does nothing. The browser test door and the prompt preview pass nothing, so they render the placeholder as empty.

## Which rows

The five voice layer rows only. The greeting rows (114, 116, 118, 120, 122) stay as they are.

| Row | use_case | Sentence language |
|---|---|---|
| 113 | `voice_layer_en-GB` | English |
| 115 | `voice_layer_en-US` | English |
| 117 | `voice_layer_nl` | Dutch |
| 119 | `voice_layer_pt-BR` | Brazilian Portuguese |
| 121 | `voice_layer_pt-PT` | European Portuguese |

## The row edit

In each of the five rows, find the line that holds only `{handoff}` and change it to:

```
{handoff}{followup}
```

Nothing else changes. Written this way, a call without a follow-up leaves no blank line behind (the engine puts the line break in front of the sentence itself, the same way the unwanted-call lines are added).

The edit is live for real callers about 30 seconds after saving (the engine caches the rows for 30 seconds). Until an account has the switch on and WhatsApp connected, it changes nothing for anyone.

Do the edit in the CRM prompt editor, not by SQL (the editor's autosave can revert SQL writes).

## The sentence per language

Option A is the wording from the implementation plan. It is what the code holds today.

| Locale | Option A (in the code now) |
|---|---|
| en-GB, en-US | When you have given the caller a time or a link, you can mention that the details will follow on WhatsApp. |
| nl | Als je de beller een tijd of een link hebt gegeven, kun je zeggen dat de gegevens via WhatsApp volgen. |
| pt-BR | Quando você tiver passado um horário ou um link, pode dizer que os detalhes chegam pelo WhatsApp. |


Option B is recommended for v1. Reason: on the phone she cannot give a link, and in v1 a voice booking on a client line is not real yet, so the message every caller gets is the link to plan an appointment. Option A can lead her to say "the details of your appointment will follow" and the caller then receives a booking link instead of a confirmation. Option B says what really arrives.

| Locale | Option B (recommended for v1) |
|---|---|
| en-GB, en-US | When the caller wants an appointment, you can say that a WhatsApp message with the link to plan it follows right after the call. |
| nl | Als de beller een afspraak wil, kun je zeggen dat er direct na het gesprek een WhatsApp-bericht volgt met de link om die in te plannen. |
| pt-BR | Quando a pessoa quiser marcar um horário, você pode dizer que logo depois da ligação chega uma mensagem no WhatsApp com o link para agendar. |


To switch to option B, change the four strings in `followup_line.py` (`_TEXT`). When real voice booking on client lines exists and `VOICE_BOOKING_IS_REAL` is turned on, go back to option A or a wording that covers both.

## Check against the prompt rules

Checked against the house rules in memory (`feedback_voice_prompt_lean_openai_check`, `feedback_voice_native_language_only`):

- One sentence, no new section, placed next to the handoff lines where she already decides what happens after the call.
- Phrased as what to do ("you can say"), with no "never" rule.
- Permission, not an obligation: it does not compete with the rule to keep replies to one or two sentences.
- One version per language, each written in that language, Brazilian for pt-BR. No English reaches a Dutch or Portuguese call.
- It does not conflict with "say an appointment is booked once the backend has confirmed it": it speaks about the message, not about the booking.

Not done: a fresh read of OpenAI's GPT-Live prompting guide (developers.openai.com/api/docs/guides/live and live-prompting). Do that before the row edit, and listen to at least a few test calls per language before trusting the wording (one sample is not enough).

## How to test after approval

1. Save the row edit for one locale (117, Dutch).
2. Open the prompt editor preview for a client with the switch off: the rendered prompt must not mention WhatsApp.
3. With the switch on, WhatsApp connected and a call from a Dutch mobile number: `voice.phone.accepted` in the engine log, and she mentions the WhatsApp message when an appointment comes up.
4. A call from a landline on the same line: she does not mention it.
