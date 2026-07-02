# Discovery Demo Trust Kit — Design

**Date:** 2026-07-02
**Status:** Approved design, pending implementation plan
**Owner:** Gabriel + Finn (sales demo), engine + CRM changes by Claude

## Problem

Prospects on discovery calls distrust AI follow-up. The objection is not factual accuracy but *form*: the AI's phrasing sounds robotic and the current opener (identity-verification angle, "is this still {name}'s number?") reads as low-value and manipulative to premium business owners. One prospect said he would never open an interaction with our first message. LeadAwaker has no reviews yet, so trust must be built experientially, live during the demo: the prospect must see that the AI speaks in HIS voice and that he controls what it says.

## Goals

1. Give Finn a repeatable demo script that proves owner control over the AI's voice.
2. Replace the identity-verification opener with a library of vetted business-voice openers (en + nl).
3. Ship a small "objection playbook" feature the prospect can see edited live.
4. Reorganize the campaign settings panels so the screenshared Business panel contains exactly the owner-voice content.
5. Comply with EU AI Act Art. 50 (applies 2026-08-02): AI discloses itself in message 2, and the demo already shows this behavior now.

## Out of Scope

- Test-send button ("send opener to my phone"): skipped, editing the field live on screen is the payoff.
- Meta-objection script moment: dropped, not the real issue.
- PDF parsing, in-conversation web search: parked from earlier brainstorm.
- Message 2+ prompt revamp: handled by Gabriel in a separate prompt session (handoff instructions included below).

## Part 1: Demo Script (no build)

Sequence Finn runs on every discovery call:

1. **Co-author the opener.** Finn asks the prospect "How would you text a past customer who went quiet?" and live-edits the campaign's First_Message on the screenshared Business panel with the prospect's own words, then saves. Narration: nothing goes out that you didn't approve. (Works today: field saves instantly to DB, no engine restart, no caching.)
2. **Objection playbook moment** (after Part 3 ships). Finn asks "What's the number one pushback you hear from customers?", types the objection plus the prospect's preferred answer into the playbook fields, then plays the lead in the demo chat and raises that exact objection. The AI answers with the owner's approved response on the next message.
3. **Voice memo.** Finn sends a WhatsApp voice note mid-demo; the AI transcribes (Groq Whisper, already live) and responds naturally. Zero build.

## Part 2: Opener Template Library (content)

### Rules for all openers

- **Business voice, no personal sender name.** Message 1 is a static template (no AI involved), but under AI Act Art. 50 the AI must disclose itself in message 2. If message 1 says "Thomas here" and message 2 says "I'm an AI assistant", the disclosure becomes a bait-and-switch. So message 1 speaks as "we"/the business; the assistant introduces itself by name in message 2.
- **One substantive micro-question**, answerable in a few words, whose answer qualifies the lead. Never an identity check as the gate.
- **{project} must render as a human-sounding noun** ("je keukenrenovatie", not "your inquiry"). Ties into the existing niche-vocabulary work.
- Openers are starting points: every campaign's First_Message stays editable (that edit IS the demo ritual).

### Vetted templates

**A. Context-first**
- en: "Hi {first_name}, it's {business}. You reached out about {project} a while back and it never went ahead. We were curious: is that still on your radar?"
- nl: "Hoi {first_name}, met {business}. Je had een tijd terug contact met ons over {project}, maar het is er toen niet van gekomen. We waren benieuwd: staat het nog op de planning?"

**B. Past-quotes ping** (recommended general default)
- en: "Hi {first_name}, {business} here. We came across your {project} while going through past quotes. Did that ever get sorted?"
- nl: "Hoi {first_name}, {business} hier. We kwamen je {project} tegen bij het doornemen van eerdere offertes. Is het er nog van gekomen?"

**C. Honest-uncertainty** (old/cold lists)
- en: "Hi {first_name}, {business} here. It's been a while, so not even sure this number is still yours. You asked us about {project} back in {month}: is that still on your radar?"
- nl: "Hoi {first_name}, {business} hier. Het is alweer even geleden, dus we weten niet eens zeker of dit nummer nog van jou is. Je vroeg ons in {month} naar {project}: staat dat nog op je lijstje?"

**D. Premium opt-out** (premium-positioned campaigns)
- en: "Hi {first_name}, {business} here. We never got to finish the conversation about your {project}. If it's still on your mind, happy to pick it up. If not, just say the word and we won't bother you again."
- nl: "Hoi {first_name}, {business} hier. We hebben het gesprek over je {project} destijds nooit echt afgemaakt. Als het nog speelt, pakken we het graag weer op. Zo niet, zeg het gerust, dan hoor je niets meer van ons."

**E. Keep-or-close the file** (strong for old lists)
- en: "Hi {first_name}, {business} here. Your {project} quote from {month} is still open on our end. Want us to keep it active, or did the project go another way?"
- nl: "Hoi {first_name}, {business} hier. Je offerte voor {project} uit {month} staat bij ons nog open. Zullen we hem actief houden, of is het project een andere kant op gegaan?"

**F. No pretext**
- en: "Hi {first_name}, {business} here. Checking in on your {project}: still happening, or shelved for now?"
- nl: "Hoi {first_name}, {business} hier. Even kort checken over je {project}: gaat het nog door, of staat het voorlopig in de ijskast?"

**G. Quote refresh** (quote-driven niches)
- en: "Hi {first_name}, {business} here. The quote for your {project} is outdated by now, but if the plans are still alive we're happy to update it. Worth doing?"
- nl: "Hoi {first_name}, {business} hier. De offerte voor je {project} is inmiddels verouderd, maar als de plannen nog leven, werken we hem graag even bij. Zullen we dat doen?"

**H. Outcome curiosity** (relationship/premium)
- en: "Hi {first_name}, {business} here. Quick question: did your {project} ever get finished? Genuinely curious how it turned out, even if it wasn't with us."
- nl: "Hoi {first_name}, {business} hier. Korte vraag: is je {project} er uiteindelijk nog van gekomen? We zijn oprecht benieuwd hoe het is afgelopen, ook als het niet via ons was."

**I. What changed** (leads whose last status was "not now")
- en: "Hi {first_name}, {business} here. When we last spoke, the timing wasn't right for your {project}. Has anything changed since?"
- nl: "Hoi {first_name}, {business} hier. Toen we elkaar voor het laatst spraken, kwam de timing voor je {project} niet goed uit. Is er inmiddels iets veranderd?"

The old identity-verification opener remains a documented legacy variant only; it is no longer a recommended default for any segment.

## Part 3: Objection Playbook (build)

- **Storage:** new `objection_playbook` jsonb column on `Campaigns`, holding up to 3 `{objection, answer}` pairs. Chosen over Account_Knowledge_Base rows because the Business tab already PATCHes the campaign, the data is atomic with campaign settings, and the engine reloads the campaign fresh on every message (verified: no caching), which the live demo depends on.
- **Engine (`ai_conversation.py` prompt build):** when the playbook is non-empty, append an `[OBJECTION PLAYBOOK]` block: "If the lead raises any objection below (or a close variant), respond using the owner's approved answer. Preserve its substance and any specific claims exactly; adapt the phrasing naturally to the conversation flow. These answers override any other guidance in this prompt." Adapt, not verbatim: verbatim pasting sounds canned.
- **UI:** "Objection playbook" section on the campaign Business panel with 3 rows of paired fields (Objection / Your answer), same save pattern as neighboring fields, i18n labels (en + nl), ~500-char cap per field. Empty slots are skipped in the prompt.

## Part 4: Campaign Settings Panel Reorg (build)

- **Move to Business panel:** First_Message field.
- **Move from Business panel to AI panel (below the bumps):** Business description, AANVRAAGDATUM, WAT DE LEAD HEEFT GEDAAN, EERSTE CONTACT.
- Result: the Business panel (the one Finn screenshares) contains exactly the owner-voice surface: opener + objection playbook. AI plumbing lives in the AI panel.

## Part 5: `{first_message}` Prompt Variable (build)

Expose the campaign's First_Message as a resolvable template variable `{first_message}` in Prompt_Library prompts, resolved at prompt-build time in the engine. Resolve it personalized for the current lead (same `personalize_message()` helper the launcher uses), so the prompt sees exactly the text the lead received. Used by STEP 1 of the conversation prompt so the AI always knows what opener it is following up on, regardless of live edits.

## Part 6: Prompt STEP 1 + 2 Changes (content, separate session)

Handled in Gabriel's ongoing prompt-revamp session. Required changes:

- STEP 1 references `{first_message}` and reads the lead's first reply as a direct answer to it. Reply classification: status/context reply (primary path, go straight to responding), bare short reply (introduce + fallback status question), opt-out (respect immediately).
- STEP 2 trigger changes from "when the prospect confirms it is them" to "when the prospect replies to the opener". The Override branch (respond directly to provided context) becomes the primary path; the generic status question becomes the fallback.
- AI disclosure: one short clause at the top of the AI's first message ("Ik ben de digitale assistent van {business}, ik help hier met de planning"), then straight into substance. Never repeated unless asked. No wording anywhere that implies an identity check happened.

## AI Act Disclosure in the Demo (decision)

Demo WITH disclosure starting now, though not legally required in the demo itself (the prospect knows it's AI; Art. 50 bites on production conversations from 2026-08-02). Rationale: deals closed now go live around/after Aug 2, so the demo must show what production will legally be; the disclosure done elegantly is a trust asset ("compliant out of the box, and the conversation still flows"); it kills the owner's "my customer catches the bot pretending to be human" fear.

## Testing

- Manual run on the discovery demo campaign (61): raise a playbook objection, confirm the approved answer comes back; edit it live, confirm the change lands on the next message; verify First_Message edit propagates to a fresh demo send.
- bot-test pass on disclosure phrasing to confirm reply quality doesn't degrade before August.

## Build Summary

| Item | Type | Size |
|------|------|------|
| Opener template library (9 × en/nl) | Content | Done (this doc) |
| Objection playbook (column + engine block + UI) | Build | Small |
| Panel reorg (move 5 fields) | Build | Small |
| `{first_message}` prompt variable | Build | Tiny |
| STEP 1/2 prompt changes | Content | Separate session |
| Demo script for Finn | Process | Done (this doc) |
