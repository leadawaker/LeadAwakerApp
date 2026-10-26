# Client phone instructions and scoped prompt changes (ElevenLabs)

Date: 2026-10-26
Status: draft for Gabriel's approval (builder check done, its questions settled below as my calls). Builds on
`2026-10-25-voice-call-review-and-prompt-coach-design.md` (the call review, change cards, draft,
Test draft and coach that are live in the Voice tab today).

## Why

The ElevenLabs prompt (`Prompt_Library` rows `eleven_layer_nl` id 130 and `eleven_layer_en` id 131) is
shared by every ElevenLabs line. Today only Robben's test line runs on ElevenLabs, but more clients will
follow, and Gabriel does not want a fix for one client to break another.

Gabriel's goal, in his words: the overall prompt should be amazing, and the individual aspects per client
should be amazing too, on top of the global structure.

Most client-specific things already live outside the shared prompt:

- **Settings per account** (`Account_Communication_Profile.setup`): intake questions, hours, tone words,
  formal address, pronunciation, screening, handoff name.
- **Tools per line**: car stock search, car details, RDW plate lookup (and a planned Marktplaats lookup).
  The shared prompt holds one general line per tool, shown only when the line has that tool (`{?flag}`).
- **Knowledge base per account** (`Account_Knowledge_Base`): facts such as trade-in, warranty, test drive.
  The WhatsApp AI reads the same entries (`conversation/context_injection.py`), so a change there also
  changes chat.

What is missing is a place for **phone behaviour rules that belong to one client** ("ask for the plate
before talking trade-in value", "never promise a delivery date"). Today they could only go in the shared
prompt.

## Goals

1. **Client phone instructions.** Each account gets its own instruction text for the ElevenLabs phone
   agent, injected into that account's calls only, edited in the Voice tab through the same draft, Test
   draft and Save to live flow as the shared prompt.
2. **Every proposed change says where it belongs**, and the review and the coach choose:
   - **All clients**: the shared prompt (find/replace on the NL and EN rows, as today).
   - **Only this client**: the account's client instructions.
   - **Knowledge**: an account knowledge base entry (edit an entry or add one).
   - **Setting**: a change to an account setting (for example an intake question). Accept writes it
     (whitelisted settings only, with Undo).
3. **Knowledge base history with a rewind.** Every change to a knowledge base entry made through the CRM
   keeps the previous text, and any earlier version can be restored.
4. The rules document (`server/voice/elevenPromptRules.md`) gains a section on how to pick where a change
   belongs, used by the review, the coach and the two skills.
5. **Remove the unused "extra instructions" field** (Gabriel, 2026-10-26: "it isn't used for anything").
   No account has any text in it. Remove the Voice tab card (`PromptSection.tsx` `promptExtra`), the
   `extraInstructions` patch field and its read in `server/storage/voiceLines.ts` / `routes/voice-line.ts`
   / `voiceApi.ts`, and the engine reads (`client_setup.py:222`, `client_setup_slots.py:170`). The
   template engine keeps knowing the `extra` mark and flag (always empty) so the live shared rows, which
   still contain `{?extra}` lines, never show braces; those dead lines can go later through a normal draft.
6. **Review a period that matches a prompt version.** The date picker gets a one-click "since the last
   Save to live" start (the latest `Prompt_Versions` save of the shared rows or this account's client row),
   because calls do not record which prompt they ran on and a review across a big change mixes two prompts.
7. **The review knows what changed.** The review prompt gets the list of prompt saves (shared and client,
   with dates and the titles of the cards that went live with them) and knowledge or setting cards
   accepted in or before the period, so it can say whether a change helped and does not propose it again.
8. **Show the reach of a shared change.** "All clients" cards and the Save to live button say how many
   ElevenLabs lines read the shared prompt (today 1). Cheap, and it keeps the shared risk visible once
   there are more clients.

## Non-goals

- Per-client copies of the whole shared prompt. Copies drift apart and a fix to one never reaches the
  others. Anti-goal: anything that lets two clients' prompts diverge silently.
- GPT Live and Grok lines. Their "extra instructions" field stays as it is.
- Settings outside the whitelist below (hours, transfer number, voice, live switch, follow-up, number)
  are never written by a card: for those a setting card stays a note.
- A per-niche layer (rules for every car dealer). Not needed with one client; the card scope is a list of
  kinds so a "niche" kind can be added later.
- Automatic changes of any kind. Gabriel accepts or rejects every card, and nothing reaches the shared or
  client prompt without his Save to live.
- A per-language client text. One client instruction text per account (see below).

## Decisions

### Gabriel's

- Shared prompt plus a client layer, and cards labeled by where they belong (approved in chat, 2026-10-26).
- Knowledge cards can do both: Accept writes the knowledge base entry straight away (no draft, since chat
  reads it too), and the card also shows the text so it can be copied by hand. Because Accept writes live,
  there must be a rewind (Gabriel asked for one).
- Setting cards can be applied too, not only copied (Gabriel, 2026-10-26: "I would really like the power to
  set the card also").
- Remove GPT Live's unused "extra instructions" field.

### My calls (Claude), for Gabriel to check

1. **Where the client instructions are stored.** One `Prompt_Library` row per account, `use_case =
   'eleven_client'`, `Accounts_id = <account>`, `status = 'active'`. The engine must look it up by
   account: today `voice_prompt_store.py` caches rows `DISTINCT ON (use_case)` and reads drafts by
   use_case only (lines 62-70, 105-116), which would mix accounts up. Either key the cache and the draft
   lookup by account, or make the use_case per account (`eleven_client_<accountId>`); builder's choice. This reuses the existing draft
   table (`Voice_Prompt_Drafts`, keyed by prompt row), the version history (`Prompt_Versions`), the
   find/replace change cards and Save to live, instead of building them again for a new field. The row is
   created on first use (first draft save or first accepted card), with empty text.
2. **One text per account, not per language.** Written in whatever language Gabriel writes it (Robben:
   Dutch). The same text goes into the NL and the EN prompt for that account's calls. The model handles a
   Dutch rule inside an English prompt; a second text per language would double the upkeep for little gain.
3. **Separate from GPT Live's "extra instructions".** That field (`setup.voice.extraInstructions`) was
   written for GPT Live and is deliberately kept out of ElevenLabs (`eleven_prompt_input.py`). It stays
   that way.
4. **Where it goes in the prompt: placed by code, not by a mark in the shared rows.** The engine inserts
   the client section into the built prompt itself: right before the `# Guardrails` heading when the
   prompt has one, else at the end. Heading "# Afspraken van dit bedrijf" (NL prompt) / "# This
   business's own rules" (EN prompt), then one fixed sentence saying these rules win over the general
   ones above but never over the guardrails, then the client text. No section when the text is empty.
   Reason: if the client text hung on a mark in the shared rows, an edit to the shared prompt that drops
   the mark would silently switch every client's rules off, the exact drift this design is meant to
   prevent. The existing `{?extra}` tone line and the `extra` mark stay as they are (always empty for
   ElevenLabs).
5. **No change to the shared rows is needed** for this feature. The heading and fixed sentence live in
   the engine's code (both languages), with a test.
6. **Knowledge base history.** A new table (for example `Knowledge_Base_Versions`: id, kb id, account id,
   title, content, category, campaign_ids, min_inbound_messages, action `edit|delete|restore|card`,
   changed_by, created_at).
   A snapshot of the old entry is written before every CRM change to an entry: the existing PATCH and
   DELETE routes in `server/routes/accounts.ts`, and a knowledge card's Accept. A new entry made by a card
   records its creation so Undo can remove it. The Knowledge section of the Voice tab gets a History per
   entry with Restore (Restore itself is versioned). Deleted entries are listed under the history too and
   can be restored with their old id, so cards and Undo keep pointing at them. History and Restore follow
   the existing knowledge edit rights (`requireAgency`, as the PATCH and DELETE routes) and show wherever
   the knowledge panel (`KBPanel`) shows, including the account's own Knowledge tab. An accepted knowledge
   card shows Undo, which restores the snapshot it made; if the entry changed again since, Undo says so
   and asks before overwriting.
7. **Knowledge card operations.** Two kinds: edit an existing entry (entry id plus find/replace inside its
   content, with the same "find must occur exactly once" check as prompt cards) or add a new entry (title
   plus content). No delete from a card. The stock entry (title starting "Current stock") is never a
   target. A new entry gets a category the model picks from the account's existing categories (the
   builder sets a default when there are none), `campaign_ids` null (all campaigns, like most entries) and
   the default `min_inbound_messages`. Editing an entry keeps its campaign limits and other fields.
8. **Client card operations.** Find/replace on the client text like shared cards, plus an "add" operation
   (append a new rule) so a card works when the client text is empty or the rule is new. Accepted client
   cards go into the client draft; Save to live promotes them.
9. **Setting cards.** A setting card names one whitelisted setting and its full new value, typed so the
   server can validate it with the same rules as the Voice tab's own save (`VoiceLinePatch`):
   greeting, intake questions, pronunciation list, after-hours behaviour, and the screening switches.
   The card shows the old and new value. Accept writes it through the existing voice line save, live at
   once like a Voice tab edit (no draft), stores the previous value on the card, and offers Undo (which
   asks before overwriting when the setting changed again since). Reject as usual. A proposal for any other
   setting is shown as a note with Done / Reject. The card checks on Accept that the old value still
   matches; if not it is stale, like a prompt card.
10. **Draft card.** The ElevenLabs draft card (today: NL and EN tabs) gets a third tab for the client text,
    labeled with the account's name. Save to live saves the shared drafts and this account's client draft
    (never another account's). Discard drops the shared drafts and this account's client draft together.
    The shared drafts are global, so a Discard also drops shared changes accepted from another account's
    review; the card already says the prompt is shared by every ElevenLabs line.
11. **Test draft.** A Test draft call uses the shared drafts and this account's client draft (each falls
    back to its live text when there is no draft), so Gabriel hears the combination before saving. Today
    the browser door answers 409 when there is no shared draft (`webhooks/eleven_browser_routes.py`
    168-172): it must accept a call when only the client draft exists.
12. **How the review and coach choose.** The rules document gets a section "Where a change belongs":
    a behaviour that would be right for any business goes to all clients; a behaviour only this business
    wants goes to the client text; a fact (prices, procedures, opening details, policies) goes to
    knowledge; something a setting already controls goes to a setting card. A shared change proposed from
    one client's calls must be written generically (no names, cars, brands, numbers), as the rules already
    require. Each review keeps the cap of `MAX_PROPOSALS` (5) cards in total across all kinds.
13. **The rules document size cap.** It is at about 29.3k of a 30k-character test cap. The builder may
    trim it or raise the cap; the review prompt's total size matters more than this number.

## Where things show in the Voice tab

- **Draft card**: tabs NL, EN, and the client (for example "Robben"). Version history per tab. The client
  tab shows a character counter with a soft cap (the builder picks it, around 3,000 characters): every
  client rule makes the prompt longer, and it is already above ElevenLabs' advised size.
- **Improve the prompt card** (folded rows, unchanged layout): each change card shows a scope pill:
  "All clients", "Only Robben", "Knowledge", "Setting". Knowledge cards show the entry title and the diff
  (or the new entry), and after Accept an Undo. Setting cards show old and new value, Accept / Reject and
  then Undo (a note-only setting card shows Done / Reject).
- **Knowledge section**: History per entry with Restore.

## Constraints

- Owner only, like the rest of the review and coach routes.
- i18n for every string (en, nl, pt-BR), no em dashes in any copy.
- Files under 500 lines; engine files too (a test enforces 500 on some engine files).
- Engine (`~/automations`, Python) does not hot-reload: preflight, then restart only with no live call.
  The engine lives on branch `feature/dbr-scoping-mode`; commit the engine changes there.
- The engine reads the client row through the same 30-second cache as the shared rows; a missing or empty
  client row means no client section.
- Existing cards (all shared) keep working: their scope is "All clients".
- New tables are created by an additive SQL script (no NocoDB; hand-edit `shared/schema.ts`).

## Left to the builder

- Column names, the shape of the scope field on `Voice_Prompt_Suggestions`, and how knowledge targets are
  stored (new columns vs a JSON column). Note `prompts_id` and `language` are NOT NULL today: knowledge
  and setting cards have neither, and client cards have no language.
- How the review's JSON schema expresses the kinds, and how invalid proposals are counted (as today:
  dropped and counted, never failing the run).
- The exact heading and sentence of the new prompt section in NL and EN (must follow the rules document).
- Whether the coach's call index and context also show the client text (it should see it).
- Test coverage, following the existing node:test and pytest suites.
