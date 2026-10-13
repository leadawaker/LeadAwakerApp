# Voice prompt line for the after-call WhatsApp (Phase 5, task 5.6)

Status: PROPOSAL, waiting for Gabriel's approval. Nothing in `Prompt_Library` was changed.

## What this is

When the after-call follow-up is on for an account, the receptionist asks the caller whether she may send the details to this number on WhatsApp. The message goes out only when the caller says yes (rule 6 in requirements.md, the recap's `whatsapp_consent`). This file holds the exact sentence per language, which prompt rows get it, and how it is switched on and off.

Changed 2026-10-13 from "announce" to "ask": the caller's spoken yes is the opt-in Meta asks for before a business starts a WhatsApp conversation, and a caller who says no gets nothing.

## How it is gated (a variable, not prose)

The sentence is not written into the prompt rows. The rows get a placeholder, `{followup}`, and the engine fills it per call:

- with the sentence, when all three hold for this call:
  1. the caller ID is a mobile number, Dutch or foreign (`tools/phone_kind.py`, `can_message`); a landline caller is never asked,
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

In the code now (`followup_line.py`, `_TEXT`):

| Locale | Sentence |
|---|---|
| en-GB, en-US | When the caller has an appointment time or wants to plan one, ask whether you may send the details to this number on WhatsApp. |
| nl | Als de beller een afspraaktijd heeft of er een wil plannen, vraag dan of je de gegevens via WhatsApp naar dit nummer mag sturen. |
| pt-BR | Quando a pessoa tiver um horário marcado ou quiser marcar um, pergunte se você pode mandar os detalhes pelo WhatsApp para este número. |
| pt-PT | Quando a pessoa tiver uma hora marcada ou quiser marcar uma, pergunte se pode enviar os detalhes por WhatsApp para este número. |

Why this wording:

- "the details", not "a confirmation" or "the link": in v1 a client-line call gets the booking link (`VOICE_BOOKING_IS_REAL = False`), later a confirmation. "The details" is true for both, so the sentence does not change when that flag flips.
- No calendar invite or address is promised: neither is in the message.
- No reminder is promised: the reminder template exists but nothing sends it after a phone call yet. When it does, add "and a reminder" here so the same yes covers it.
- "this number" makes the caller check it: someone on a borrowed phone says so.
- It is an intent, not a script, so she phrases it in her own words. What she does on a no needs no line: the engine simply sends nothing.

The earlier options A ("you can mention the details will follow") and B ("a message with the link follows") announced the message without asking. They are replaced.

## Check against the prompt rules

Checked against the house rules in memory (`feedback_voice_prompt_lean_openai_check`, `feedback_voice_native_language_only`):

- One sentence, no new section, placed next to the handoff lines where she already decides what happens after the call.
- Phrased as what to do ("ask whether"), with no "never" rule.
- One short question, asked once the time or wish is clear, so it fits the rule to keep replies to one or two sentences.
- One version per language, each written in that language, Brazilian for pt-BR. No English reaches a Dutch or Portuguese call.
- It does not conflict with "say an appointment is booked once the backend has confirmed it": it speaks about the message, not about the booking.

Not done: a fresh read of OpenAI's GPT-Live prompting guide (developers.openai.com/api/docs/guides/live and live-prompting). Do that before the row edit, and listen to at least a few test calls per language before trusting the wording (one sample is not enough).

## How to test after approval

1. Save the row edit for one locale (117, Dutch).
2. Open the prompt editor preview for a client with the switch off: the rendered prompt must not mention WhatsApp.
3. With the switch on, WhatsApp connected and a call from a mobile number: `voice.phone.accepted` in the engine log, and she asks about WhatsApp when an appointment comes up.
4. Say yes: the call's recap (`Voice_Calls.summary`) has `"whatsapp_consent": "yes"` and the message arrives about 30 seconds after hanging up.
5. Call again and say no: `Call_Followup_Log` gets `skipped` / `consent_declined` and nothing arrives.
6. A call from a landline on the same line: she does not ask.
