# Bump System Overhaul — Design

## Overview

The bump system (static templates + AI-generated follow-ups) works structurally but has gaps: no proven default cadence, no per-campaign control over AI bump tone, a stall bug when a template is blank, a UI toggle that doesn't do what it implies, and no handling for leads who stall mid-booking. This spec adopts Dan Wardrope's 4-message cadence as the default, gives campaigns control over AI bump angles, fixes the stall bug, and adds a booking-aware path so a lead who named a day but not a time gets nudged toward finishing the booking instead of a generic "still there?" message.

This applies to all campaigns, not just the discovery demo. Discovery demo is the first campaign to adopt it.

## Goals

- Adopt a proven, niche-agnostic default bump cadence (Wardrope: curiosity → diagnosis → hypothesis → goodbye)
- Let each campaign customize the AI bump angle per stage, not just the static template
- Fix the stall bug where a blank bump template freezes the lead in the queue forever
- Make the "First Message voice note" toggle actually gate correctly, and put it where it belongs
- Handle the specific case of a lead who named a booking day but never confirmed a time, then went quiet
- Treat the Contact Later reengagement template as AI guidance content, not a canned line

## Non-goals

- Sentiment classification, objection-pattern libraries, or GIF/meme bumps — deferred until there's real client data to justify them (noted for later, not designed here)
- Status-specific bump matrices beyond what already exists (AI bumps already gate on Conversion_Status + response count)
- Any change to the Contact Later trigger/tag mechanism itself — it already works correctly

## Current State (verified in code)

- `bump_scheduler.py` sends static templates by default; switches to AI-generated bumps once a lead has `Conversion_Status` in `{Multiple Responses, Qualified}` and 3+ inbound messages
- AI bump angles (`_STAGE_ANGLES` in `ai_bump_generator.py`) are hardcoded, four stages, campaign-agnostic
- If `bump_N_template` is empty for the next stage, `_process_lead` logs a warning and returns *without* advancing `current_bump_stage` or setting `next_action_at` — the lead gets re-evaluated every 5 minutes indefinitely and later bumps never fire
- `max_bumps` defaults to 3 in the engine, 4 in the UI edit field — mismatched
- The AI bump prompt has a hardcoded rule: never include booking/calendar links or CTAs — bumps are re-engagement only, no exception
- Contact Later re-engagement (`_handle_contact_later_reengagement`) already runs before normal bump logic and exits early — no conflict with anything in this spec. `reengagement_bump_template` is already woven into the AI prompt as a "starter," and only sent verbatim if AI generation fails outright
- "First Message voice note" toggle (`first_message_voice_note`) works in the engine but only checks channel === WhatsApp — not gated on the overall voice system (`voice_reply_mode`). It lives in the Business tab (`BusinessSectionFields.tsx`); voice-related settings live in the AI tab (`AISectionFields.tsx`), where `voice_reply_mode` and `reengagement_bump_template` are already shown
- Leads that book successfully get `automation_status = "completed"`, which already excludes them from `get_active_leads_due()` — bumps never fire for booked leads, no new work needed there
- `calcom_service.get_available_slots()` already exists, returns real availability, and documents itself as "returns [] on error, caller should fall back to the booking link"

## Design

### 1. Default bump cadence (Wardrope)

New campaigns get these as default `bump_1_template` through `bump_4_template`, and the discovery demo campaign gets them filled in directly:

- B1: "Hi {first_name}! Just checking in, I figured you got busy before."
- B2: "{first_name}, what's holding you back from {service}?"
- B3: "Is it a trust thing?"
- B4: "I won't bother you anymore {first_name}. If you ever need to discuss {service}, I will be here for you :)"

`max_bumps` default is aligned to 4 in both the engine and the UI (currently 3 vs 4).

### 2. Per-bump AI angle fields

Four new campaign columns, following the existing `bump_N_template` naming convention:

- `bump1AiPrompt: text("bump_1_ai_prompt")`
- `bump2AiPrompt: text("bump_2_ai_prompt")`
- `bump3AiPrompt: text("bump_3_ai_prompt")`
- `bump4AiPrompt: text("bump_4_ai_prompt")`

Each gets a textarea in the campaign settings UI, placed next to its corresponding `bump_N_template` field. `ai_bump_generator.py`'s `_STAGE_ANGLES` dict becomes the fallback: if the campaign field is empty, use the current hardcoded angle for that stage; if filled, use the campaign's text instead.

### 3. Fix the empty-template stall

In `_process_lead`, when `template_key` resolves to an empty/missing template and AI generation didn't produce a body either, the stage still advances: `current_bump_stage` is set to `next_stage` and `next_action_at` is pushed forward using that stage's delay, exactly as if a message had been sent — just with no send performed and no interaction logged. This means a campaign can leave B3 blank and the lead still reaches B4 on schedule instead of stalling forever.

### 4. First Message voice toggle — move and fix gating

- Move the `first_message_voice_note` field from `BusinessSectionFields.tsx` to `AISectionFields.tsx`, grouped with `voice_reply_mode`
- Update its label/description to something accurate: "Send the first message as a voice note instead of text" (not implying it controls whether the first message sends at all)
- In `campaign_launcher.py:316`, gate the voice send on `voice_reply_mode != "off"` in addition to the existing WhatsApp-channel check, so toggling it on only works when the overall voice system is enabled

Note: `bump_scheduler.py` has the identical gap (bump voice notes also only check channel === WhatsApp, not `voice_reply_mode`). Same fix applies there for consistency, but it's out of scope unless requested — flagging it here so it isn't lost.

### 5. Contact Later reengagement content

No structural change. Fill in the discovery demo campaign's `reengagement_bump_template` with example/theme content for the AI to riff on, written as a natural message (since it's also the verbatim fallback if AI generation fails), e.g.: "Hi {first_name}! You mentioned this timing would work better for you, so here I am, is now a good moment?" The field's job is to seed tone and topic, not to be a locked script.

### 6. Booking-aware bumps (the Tuesday case)

**Trigger, set during the live conversation (`ai_conversation.py`):** when the AI's reply proposes concrete time slots for a day the lead named but didn't confirm, write a new lead field:

- `pendingBookingContext: text("pending_booking_context")` — a JSON string: `{"day": "2026-07-07", "offered_slots": ["2026-07-07T10:00", "2026-07-07T14:00"], "timezone": "Europe/Amsterdam"}`

This is overwritten every time the AI proposes new slots (so if the lead renegotiates to a different day, the field reflects the latest state) and cleared to `null` when the booking is confirmed.

**Bump path (`bump_scheduler.py`):** before falling into the normal AI-bump or template-bump branches, check `if lead.get("pending_booking_context"):`. If present:

1. Parse the stored day/timezone. If the day has already passed, advance to the next available day instead of reusing it.
2. Call `calcom_service.get_available_slots()` live for the relevant window — never reuse the stored `offered_slots` values as the source of truth, they're only the trigger.
3. If live slots come back non-empty: generate a bump that re-offers the fresh slots plus the booking link as a fallback ("Would Wednesday 10:00 or 15:00 still work? Or grab any time here: {link}"). This is the one bump case exempted from the standing "never include booking links" rule.
4. If the calcom call fails or returns empty (no API key, no availability, integration not configured): fall back to the generic re-engagement wording with the booking link only, no invented times.
5. Leads that already booked never reach this path — they've already dropped out of `get_active_leads_due()` via `automation_status = "completed"`.

**Conversation-side change (`ai_conversation.py`):** when a lead names a day without a time, the AI's default reply offers 2-3 real slots pulled from live availability for that day, instead of asking an open "what time works?" question.

### Edge cases and resolutions

| Case | Resolution |
|---|---|
| Original day/slots have passed by bump time | Live refetch targets the next available day; phrasing acknowledges the shift |
| Slot taken by someone else in the meantime | Never an issue — always refetch live, never reuse cached slots |
| Lead already booked (link or another channel) while bump was pending | Already excluded via `automation_status = "completed"`, no new handling needed |
| Lead renegotiated a different day before ghosting | `pending_booking_context` is overwritten on each new slot-offer turn, always reflects latest state |
| Calendar API down or returns no slots | Fall back to generic wording + booking link only |
| Campaign has no calendar integration configured | Same fallback, detected before attempting the call |
| Timezone mismatch | Reuse whatever timezone resolution the main conversation flow already uses for the lead |

## Data Model Changes

Campaigns table (4 new columns):
- `bump_1_ai_prompt`, `bump_2_ai_prompt`, `bump_3_ai_prompt`, `bump_4_ai_prompt` (text, nullable)

Leads table (1 new column):
- `pending_booking_context` (text, nullable, JSON string)

## Testing / Verification

- Manually verify the empty-template stall fix: blank a bump template on a test campaign, confirm the lead advances to the next stage on schedule instead of being reprocessed every cycle
- Verify `max_bumps` default alignment between UI and engine
- Verify the First Message voice toggle only sends voice when `voice_reply_mode != "off"`
- Exercise the booking-aware path against a test lead: name a day, don't confirm a time, let the bump fire, confirm it offers live (not stale) slots
- Exercise the calendar-down fallback by pointing at a campaign with no calcom integration configured
