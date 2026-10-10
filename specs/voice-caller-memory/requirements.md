# Requirements: Voice Caller Memory

## What and why

Today every phone call to Sara starts from zero. The engine knows the caller's number at call start, but only the backend (delegation) prompt sees it, as one line, and nothing looks up earlier calls. A caller who rang yesterday has to explain their situation again, and a caller whose line dropped mid-call has to start over. That is the experience that makes callers hate phone bots.

Voice Caller Memory lets Sara recognise a number that has called this business before and pick up from what she already knows:

- **Returning caller:** she checks the name lightly ("Hi, is this Gabriel again?"), then uses the recap of their last calls instead of re-asking.
- **Dropped call:** if their previous call was cut off less than 15 minutes ago, she says so and offers to carry on where it stopped, using the last lines of that call.
- **Name onto the lead:** a name given on a call is written to the lead, so the CRM stops showing "+31 6..." as the lead's name.

## Scope decisions (agreed with Gabriel, 2026-10-08)

| Decision | Choice |
|---|---|
| History source | Voice calls only (`Voice_Calls` + their transcripts). WhatsApp and other channel history is out of scope. |
| History window | Last 90 days, same business account (and same persona on the shared demo line). Never across accounts. |
| Name use | Confirm lightly in the greeting ("is this X again?"). Yes: use name and history. No: ask who it is and treat them as a new caller. |
| No name known | Skip the name, still use the history ("welcome back, is this about the roof repair?"). |
| Dropped-call window | 15 minutes. |
| Name on lead | Write the recap name to `Leads.first_name` only while it still holds the phone-number placeholder. A real name is never overwritten. |
| Doors | Phone door only (`/voice/phone/incoming`). Browser `/voice-demo` door is a follow-up. |

### Which name she checks

Most recent non-empty recap name (`Voice_Calls.summary.name`) within the window, else the lead's real first name. Real data shows why the recap wins: lead 354 is Danique's number, but the last three calls from it were Gabriel. She asks "is this Gabriel again?", and a "no" sorts it out.

### Prompt placement (change from the first proposal)

The first proposal put a `{caller_context}` placeholder into the 10 Prompt_Library voice rows. Instead, the caller block is **appended at the end of the voice layer**, the same way today's date line already is (`_voice_today`), and appended to the greeting instruction. Reasons: no CRM-owned rows need editing, an edited row cannot silently drop the memory, and for a first-time caller nothing changes at all. The greeting sentence and the voice-layer block are written in the call's own language (an English sentence pulls her accent); the copy lives in code per language (like `_HANDOFF_*` and `_DISCLOSURE_LINES`), written in each locale's own language and kept lean (see `feedback_voice_prompt_lean_openai_check`). Moving the copy into Prompt_Library rows is a possible follow-up if Gabriel wants to tune it by ear.

## Acceptance criteria

1. A first-time caller (no prior call from this number on this account in 90 days) gets exactly today's instructions and greeting: no added text.
2. A returning caller with a known name hears a greeting that checks the name in one short question. After a yes, Sara refers to what they discussed last time without re-asking it.
3. A returning caller without a known name gets a welcome-back greeting and Sara uses the previous topic, without inventing a name.
4. When the caller says they are not the named person, Sara asks who she is speaking with and does not bring up the previous calls' details.
5. A call that ended with the caller dropping off (no goodbye from either side) or Sara hanging up on silence, with at least 3 turns, followed by a new call from the same number within 15 minutes: Sara opens by saying the line seemed to drop and offers to continue from where it stopped, and she knows the last lines of that call.
6. Every phone call stores why it ended in `Voice_Calls.end_reason`.
7. After a call where the caller gave a name, a lead whose `first_name` is still the phone number placeholder shows that name. A lead with a real name keeps it.
8. History never crosses accounts. On the demo line it never crosses personas.
9. A failure in the memory lookup never breaks or delays the call beyond the lookup itself: the call proceeds as a first-time call and a warning is logged.
10. The backend (delegation) model gets the same facts in English, so a booking or reschedule request can use them.

## Related features and dependencies

- Phone door: `project_voice_phone_door_2026_10_03`, engine `src/webhooks/phone_voice_routes.py`, `src/automations/voice/phone_call.py`.
- Voice prompts in Prompt_Library rows 113-122: `project_voice_layer_prompts_in_library_2026_10_06`.
- Call recap: `src/automations/voice/call_recap.py` (`summary` = `{name, outcome, items[{intent, interest, notes}]}`).
- CRM Callers view (`server/storage/voiceCallers.ts`) displays the lead's name first, so the name write-back improves it with no CRM code change.
- Engine runs with pm2 watch disabled: changes need `./preflight.sh && pm2 restart leadawaker-engine --update-env`.

## Out of scope (follow-ups)

- Browser `/voice-demo` door memory (typed caller number).
- Showing `end_reason` ("Cut off") in the CRM call detail.
- WhatsApp / lead-thread history in calls.
- Moving the caller-block copy into Prompt_Library rows.
- A per-line "remember callers" toggle (relevant if Gabriel's own number being recognised gets in the way of live sales demos).
