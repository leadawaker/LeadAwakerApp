# Demo Client Generator v2: Requirements

> Spec only. Redesigns the "build a Client" flow on the Demos page (`/platform/demos`,
> `NewDemoForm`). Engine = `/home/gabriel/automations/`, CRM = `/home/gabriel/LeadAwakerApp/`.
> Out of scope: the voice demo (`client/src/features/voiceDemo/`, `voice/live_session_config.py`),
> which another session is editing.

## Why

Gabriel keeps cleaning up Clients this flow produces. Root causes, verified 2026-09-19:

1. **Silent generic fallback gets saved.** `routes/demo.ts:289-291` falls back to
   `buildFallbackNicheContext` (`demo-session.ts:661`) when the model returns null, then saves it
   (`routes/demo.ts:307`). Live evidence: Niche_Vocabulary 67 "HAYAI SUZUKI" and 65 "Real Coaching Co."
   carry the fallback opener ("Hi, this is {agent_name} from our motorcycles team...") and the 3-slot
   `buildGenericScopingLadder` (`demo-session.ts:213`).
2. **One model call does everything with no human steer.** Row 91 must guess the offer, the lead's
   situation and the booking goal at once. When it guesses wrong the whole Client is wrong.
3. **Language.** The form defaults to `en` (`NewDemoForm.tsx:40`). The scrape translates the site into
   that language (`tools/site_kb.py:88`) and generation writes only that language
   (`demo-clients.ts:248-250`), so a Brazilian site was first saved as an English Client (HAYAI
   SUZUKI; its later pt slots are fallback text too, so it needs a real regeneration, not only a
   missing language).
4. **Scope questions don't lead** (see Row 91 review below).
5. **Typed niche on the Demos page is dead UI.** `NewDemoForm` keeps `niche` state (`:39`, input `:216-223`)
   but never sends it: `ProspectDemoPanel` only takes `clientNiche` (`ProspectDemoPanel.tsx:18-29`).

## Decisions (made by Gabriel, do not re-open)

### D1. Provider toggle, Claude first
- The New Demo form gets a provider control: **Claude (subscription)**, default, model **Opus**
  (Sonnet option), and **OpenAI**. The choice persists per browser (localStorage, try/catch).
- Claude runs through the existing CLI helper (`server/aiTextHelper.ts` `tryClaude()` `:30`).
- OpenAI is the automatic fallback when Claude errors, times out or returns JSON that fails to parse
  or validate. The UI states which provider actually produced the result.
- Timeouts sized for Opus (see plan). Long work runs as a background job, because
  `app.leadawaker.com` sits behind a Cloudflare tunnel (`~/.cloudflared/config.yml`), which returns
  524 on any request that runs past ~100s.

### D2. Directions step before full generation
Applies to both the website scrape and a typed niche (and the pasted-notes escape hatch).
- A small, fast call returns **exactly 3 direction cards**. Each card has exactly:
  - **Offer**: the service or product the demo is about.
  - **Lead situation**: what the lead did before we contact them.
  - **Booking goal**: what the AI books (call with a specialist, showroom visit, test drive, ...).
  - **Scope outline**: 4-5 scope questions, in order.
- Gabriel picks one card, may add a free-text note, or asks for 3 new directions (the previous set is
  sent along so the new ones differ).
- Full generation runs from the picked card plus note. The card is the brief: offer drives
  `service_name`/`opener_phrase`/`niche_label`, lead situation drives `enquiry_context`, booking goal
  drives `booking_mode_call`/`advisor_term`/`visit_term`, the outline becomes `scoping_ladder` slots in
  the same order.
- Cards are written in English (Gabriel's working language); generated fields are written natively
  per demo language.

### D3. Fail loudly
- The Demos-page flow never saves `buildFallbackNicheContext` output. A failed directions or
  generation call shows the error and a Retry button; nothing is written to Niche_Vocabulary.
- `from-website` returns an error status on generation failure instead of falling back.
- Unchanged: the public homepage flow (`routes/demo.ts:471`) and the VIP `/generate` command
  (`:728`) keep their fallback because no human is there to retry; they already never save it.

### D4. Lean prompts
Every prompt involved (new directions prompt, row 91, site_kb summarizer) is rewritten lean and checked
against OpenAI's GPT-5 prompting guidance (cookbook "GPT-5 prompting guide"): one instruction per
concern, no contradictions for the model to reconcile, rules phrased as what to do, minimal
ALL-CAPS/"MUST" emphasis (newer models over-apply it), few examples (they get copied). Each rewrite
notes which guideline each line serves and what it replaces.

## Row 91 review (read-only, live row, 13,021 chars, updated 2026-09-07)

### Cut or merge
| Row 91 lines | What | Action and why |
|---|---|---|
| 10 | `what_lead_did` spec (~500 chars) | **Cut.** Dead output: `applyDemoDefaults` overwrites it from the scenario (`demo-session.ts:185`). |
| 91 | `second_message` spec | **Cut.** Not in `NicheContext`, not saved, not read by the engine. |
| 35-90 | Two ladder formats branched on `booking_mode_call` (PRICE-DRIVER 3-4 slots vs BOOKING-LOGISTICS 5-7), two worked examples, repeated bans (~5.5k chars, 40% of the prompt) | **Replace** with one ladder section driven by the picked direction (below). The booking goal now arrives in the brief, so the model no longer branches on its own guess. |
| 83, 88, 89 | Timing / still-interested / budget rules stated three times ("banned outright", "however natural") | **Merge** into one positive line: interest and timing are asked by the conversation prompt (Prompt 93 STEP 3 items 1 and 3), so the ladder starts after them; budget only as the last slot when price varies with scope (matches Prompt 93 item 4). |
| 90 | Brazilian-PT word list, Dutch "je", label translations inside the ladder paragraph | **Move out.** It governs every field, not just the ladder. Code appends a short per-language style block, one per language, written in that language (OpenAI advice: prompt in the output language). Label names (Doel/Vraag/Opties, Objetivo/Pergunta/Opções) stay, in that block. |
| 9 | `booking_mode_call` decision heuristic | **Simplify** to "true when the booking goal is a call with a specialist". The card decides it. |
| 12 | `kb` 4-6 invented facts | **Keep for typed niche only.** On the website path the scraped KB overwrites it (`routes/demo.ts:296-305`); the prompt says "when SITE FACTS are given, base every fact on them". |
| 30-34 | `first_message` fixed shape + tokens | **Keep** (engine depends on `{agent_name}`, `{disclosure_clause}`, `{first_name}`). Rephrase the "NEVER use the commercial arrangement" line positively: "name what the customer wants in their own words". |
| all | ALL-CAPS EXACTLY/ONLY/NEVER/ALWAYS | **Remove** emphasis; state each rule once. |

Target: under 6k chars including the new ladder section.

### Why the current ladders "don't lead well"
Evidence: Moniz de Sá (id 66) asks car type, test drive, driving licence, trade-in, finance documents,
store region; VANDERBEEK (64) asks six spec questions ending in budget.
1. **Framed as a form for the company, not a path for the lead.** Row 91 defines a slot as "ONE fact
   the company needs to quote" and orders slots "cheapest-to-answer first". Nothing ties a slot to the
   booking goal, so the conversation collects data and then has to pivot cold to "shall I book a
   call?". Prompt 93 needs the ladder to build relevance before the offer (Prompt 93 ~line 405).
2. **Nothing to build on.** Prompt 93 tells the AI "Build each question on the answer you just
   received" (~line 253), but each generated Ask is a standalone question with no link to the previous
   answer, so the AI can only bolt a generic acknowledgement onto the next form field.
3. **Questions the lead can't answer yet.** The PRICE-DRIVER rule ("two biggest price drivers")
   produces spec questions (worktop material, page count, custom functionality) that a lead who has
   not talked to anyone answers with "not sure", a dead end. The BOOKING-LOGISTICS branch produces
   admin questions (licence, documents, insurance) that give the lead no reason to book.
4. **Purpose lines serve the quote, not the conversation.** "Purpose: scales labour and materials" gives
   the AI nothing to say back to the lead that makes the next question or the booking feel worth it.
5. **No motivation slot.** No slot asks what the lead is after now or what matters most to them, which
   is the material Prompt 93's closing step uses to make the booking feel relevant.

### Replacement ladder guidance (drop-in for row 91 lines 35-90)
```
scoping_ladder: the scope questions from the chosen direction, turned into 4 or 5 slots in the
same order. Together they walk the lead from where they are now to the booking goal.
- Slot 1 picks up the lead's situation and asks what they are after now, in everyday words.
- The middle slots ask the two or three things that most change what the {advisor_term} would
  propose or which appointment gets booked. Write each so someone who has not researched it can
  answer in a few words, and give 2 to 4 everyday options.
- The last slot asks what matters most to them in the result (for example price, speed or
  finish), which is what makes the booking worth their time. When the price varies with size,
  materials or quantity, a budget question can be the final slot instead.
- Each Ask reads naturally straight after the previous answer and may refer back to it.
- Interest and timing are asked by the conversation itself, so the ladder begins after them.
Format each slot as:
SLOT 1 - <short name>
Purpose: <what this answer changes in what gets proposed or booked>
Ask: "<one question, as a colleague of this business would text it>"
Options: <2 to 4 options, or "open">
```
The slot format and labels stay identical, so the engine (`prompt_builder.py:354`) and Prompt 93 need
no change. The per-language block supplies translated labels.

## Recommendation: Pending confirmation

Spec'd so it can ship right after D1-D4; Gabriel has not approved it yet.

- **R1. Scrape in the site's own language.** Remove the translation line (`tools/site_kb.py:88`).
  Detect the site language from `<html lang>` on the homepage (fallback: a `site_language` field the
  summarizer returns). The form prefills the demo language from it; Gabriel can override.
- **R2. Always English plus the demo language.** When the demo language is nl or pt, generate English
  and that language in parallel, each natively (not translated) from the same picked direction.
  The KB is stored per language the same way (`kb_template` is already `{en,nl,pt}`).
- **R3. "Add language" on existing Clients.** A Clients-tab action fills missing nl/pt (or en) fields
  for an existing Client from its stored brief, without re-creating it (for Clients that are good in
  one language; HAYAI SUZUKI needs a full regeneration first).
- **R4. Fix `clientLanguages()`** (`demo-clients.ts:185`). Today it checks `first_message` only. A
  language counts only when `first_message`, `scoping_ladder`, `opener_phrase` and `kb_template` are
  all non-empty for it; the Clients tab shows a partial language as a warning.

## Acceptance

- Website URL, pasted notes and typed niche each show 3 direction cards within ~30s (Sonnet) and
  never save anything before a card is picked.
- Picking a card plus note produces a Client whose ladder has 4-5 slots in the card's order.
- Killing the Claude CLI (or forcing bad JSON) produces an OpenAI result labelled "via OpenAI";
  killing both produces a visible error with Retry and no new Niche_Vocabulary row.
- Provider choice survives a page reload.
- No request on this flow runs longer than 90s (jobs are polled).
- Pending R1-R4: a Brazilian site yields a Client with en and pt, and an en-only Client gains pt
  via "Add language" without losing its en fields.
