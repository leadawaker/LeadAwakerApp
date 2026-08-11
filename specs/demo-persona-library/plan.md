# Demo persona library — agreed plan (Gabriel, 2026-08-11)

## The decision

**One demo campaign. Personas in a library. Campaign rows reserved for real clients.**

Gabriel's framing, which is the point of the whole thing: *"is not about having or not
having leads, is just about ease of use."* He used to have a Supabase system where every
lead pointed at a reusable client record. Today a generated demo persona is written to
`leads.demo_niche` and dies with that lead: it cannot be reused, cannot be applied to
another lead, and cannot be re-sent to a prospect. So today the only way to reuse a niche
is to create a campaign for it, which is what made the campaign list feel redundant.

Why a campaign row is the wrong container for a persona: a real client needs its own
campaign because it needs its own booking calendar, account, billing and number. None of
that varies between demos. The campaign row is right for a customer and wrong for a niche.

## Naming and placement (Gabriel, 2026-08-11)

**`Niche_Vocabulary` is renamed "Clients" in the UI**, and moves to a **third tab on the
Campaigns page**. It is no longer part of the Prompts page.

- Today it renders as `NicheVocabularyPanel`, mounted at
  `client/src/features/prompts/components/PromptsListView.tsx:1147`. Move it out.
- The Campaigns page currently has two detail tabs:
  `CampaignDetailTab = "summary" | "configurations"`
  (`client/src/features/campaigns/pages/CampaignsPage.tsx:23`, persisted under the
  `campaigns-detail-tab` localStorage key). Add `"clients"` as the third.
- Rename in the UI and in new code. The DB table name can stay `Niche_Vocabulary` to
  avoid a migration across the engine's `_PACK_COLS` reads; if it is renamed, the engine
  side (`tools/db/niche_vocabulary.py`, the overlay in `prompt_builder.py`) has to move
  with it in the same change.
- "Clients" is the right word because that is what these rows model: the business the
  demo is pretending to be. It is also why they do NOT belong on the Prompts page.

## Company name: per Client AND per lead (answering Gabriel's question)

**Both, and that already works.** Keep it that way.

- The **Client** row carries the default via `company_name_template`.
- The **lead** keeps its override in `demo_niche.company_name`, which the overlay applies
  on top (`_overlay_demo_niche_onto_campaign` `_set`s it over the campaign's own), and
  which `/companyname` and the Share dialog already write.
- So: pick the "Ferragens" Client, its default company fills in, override it to
  "Hoffman Puxadores" for that one prospect, and the saved Client is untouched. The next
  prospect in the same niche starts from the default again.
- `build_disclosure_clause` reads the same company chain, so the disclosure sentence
  renames along with it. No extra wiring needed.

## What ALREADY EXISTS (verified 2026-08-11, do not rebuild)

- **`Niche_Vocabulary`** — the persona library, already built. 17 rows, 23 columns:
  `niche, project_terms, proposal_terms, decision_terms, advisor_terms, visit_terms,
  (+ _en variants), company_name_template, description_template, kb_template,
  question_bank, bad_examples, objection_examples, scenario_examples, scoping_ladder,
  opener_phrase`. Rows: `__default__`, Kitchens, Bathrooms, Landscaping, Solar Panels,
  Roofing, Countertops, Flooring, General Contracting, HVAC, Windows & Doors, Painting,
  Pest Control, Pool Installation, Moving Services, Wellness, Interior Design.
  Already has CRUD in Settings ("Niche Words").
- **`Opener_Templates`** — 11 templates A-K, already editable through
  `client/src/features/campaigns/components/settings/OpenerTemplatePicker.tsx`.
  Columns: `id, sort_order, title_en, title_nl, body_en, body_nl, updated_at`.
  NO type column yet — that is the gap for phase 2.
- **The generator already emits almost exactly the Niche_Vocabulary shape**
  (`generateNicheContext` in `server/demo-session.ts`). Mapping is mechanical:
  `project_term`→`project_terms`, `business_description`→`description_template`,
  `kb`→`kb_template`, `niche_question_bank`→`question_bank`,
  `niche_objection_examples`→`objection_examples`, `company_name`→`company_name_template`.
  Not in the table yet and needed: `first_message`, `service_name`, `usp`,
  `niche_question`.
- **Per-lead personas already work** via `_overlay_demo_niche_onto_campaign`
  (`src/automations/conversation/prompt_builder.py`). The library adds REUSE, not new
  capability. Say so honestly — it is an ergonomics change, which is what was asked for.

## Where each control lives (decided 2026-08-11, post-compaction)

Gabriel asked whether the Business tab should come back for campaign 60 now that the
Clients library exists. It should not, and the reasoning generalises into a rule for the
whole demo surface.

**The split is "who is this demo for" (durable) vs "run it now" (transient).**

- **Clients tab** = where a persona is authored and kept. This is the resurrected Business
  tab, promoted to first-class and detached from the campaign row.
- **AI tab on campaign 60** = the run strip. Client picker, demo lead name, scenario,
  opener + template picker, agent name. Everything touched in the minute before a link is
  sent, nothing that is authored.

**1. The scenario picker moves to the AI tab, beside the demo lead name, and MUST be
transient.** Do NOT reuse `conversation_mode_override`
(`settings/BehaviorSectionFields.tsx:123`): it is a column on the Campaigns row, so
flipping it on campaign 60 repoints the PUBLIC homepage demo permanently, for every
visitor. Same footgun as `/model` and `/wait` (already in Still Open below). Model it on
`launchName` instead: local state that rides along into the Launch button's `/start`
message and into the Share dialog's minted link. WhatsApp `/scenario` is already safe
because it writes per lead and then resets and replays (`demo_commands.py:875`).

**2. The Business tab does NOT come back on campaign 60, and nothing gets deleted
either.** Its fields are, near enough one for one, the Client row. Restoring them on 60
would create a second place to edit the same thing, where the edits hit the SHARED
campaign row and get overwritten by `_overlay_demo_niche_onto_campaign` on the next demo
anyway: the original "persona dies with the lead" problem with extra steps. It stays
hidden on 60 (`CampaignSettingsLayout.tsx:71`) and stays fully present on real client
campaigns, where it is the only surface that configures company/service/USP/KB/language
for a paying client. It simply stops being part of the demo story.

Related: the tab's demo rationale is a dead sales motion. The code still describes
First_Message as "the field Finn live-edits on screenshare during the demo"
(`BusinessSectionFields.tsx:338`, trust kit Part 1). Finn is Friday-only coaching now and
the demo is a post-call CTA link, not a narrated screenshare. Comment is stale, behaviour
is fine, do not rip it out on this pass.

**3. The objection playbook does NOT go on the Client row.** Gabriel: it is spectacle for
a prospect, and "we adjust to your answers during onboarding" covers it. It also costs
nothing to drop, because it was never in the demo generation path in the first place:

- `generateNicheContext` emits `niche_objection_examples` (`server/demo-session.ts:214`,
  written at `:626`) plus objection rebuttals folded into the `kb` line. BOTH are already
  Niche_Vocabulary columns (`objection_examples`, `kb_template`), so per-Client objection
  handling already exists and already survives.
- `Campaigns.objection_playbook` is a separate campaign-level field, read from the
  campaign row by `ai_conversation.py:443` via `_format_objection_playbook_block`.
  Campaign 60's own playbook stays as the shared generic backstop.

So: no new column, no editor, no phase 1 scope change. Recorded only so a later session
does not "notice the gap" and add it back.

## A Client is ENGLISH, except its terms (tested 2026-08-11)

Gabriel asked whether a Client needs content per language at all, or whether one
English persona can serve every demo and let the AI translate live. Tested rather than
reasoned about, because it decides how much work every new Client costs.

**Test:** generated an English-only Client ("bespoke staircase joinery"), minted a demo
from it with `language: nl`, ran a real conversation through the browser demo.

**Result:** the AI's reply was native Dutch with correct trade vocabulary ("een open eiken
trap naar de eerste verdieping", "van de afgewerkte vloer beneden tot de afgewerkte vloer
boven") produced from an ENGLISH kb and an ENGLISH scoping ladder. The model read English
and wrote Dutch. It reached for "trap" itself without being given the word.

**The one leak, in the opener: "Je nam een tijd geleden contact met ons op over je
staircase".** `{project_term}` is substituted verbatim by `render_demo_first_message`
(`demo_recap.py`), which carries an explicit do-not-retranslate rule. No model sees it.

Note what was NOT the problem: the opener TEMPLATE rendered correct Dutch, because it
comes from campaign 60's bilingual `First_Message`, not from the Client.

**So the rule for the library:**

| Client field | Language |
|---|---|
| `kb_template`, `description_template`, `scoping_ladder`, `question_bank`, `objection_examples`, `usp`, `niche_question`, `lead_context` | **English only.** The model translates. Do not generate these per language. |
| the five term lists (project/proposal/decision/advisor/visit) | **Per language.** Substituted verbatim into the opener. Five short words. |
| the opener itself | Per language, but campaign-level today. Phase 2's job. |

This is why the `*_pt` term columns added in phase 1 earn their place and the parallel
`*_pt` TEXT columns would not have. It also means a new Client costs one generation plus
five words per extra language, not a full second generation.

Corollary, recorded so it is not rediscovered: the engine's `Niche_Vocabulary` reader
normalises `pt` to `en` (`_norm_lang`, changed by the language session on 2026-08-11), so
the `*_pt` columns are invisible to THAT path. Demos are unaffected, because demo terms
travel in `demo_niche` through `_overlay_demo_niche_onto_campaign` and never through the
vocabulary lookup. It only matters if a Client is ever consumed outside the demo path.

## Phases

### Phase 1 — save and re-pick personas — **DONE 2026-08-11**

Shipped in `94a1f1c3`, `c5476d6a`, `47de0fcb`. What exists now:

- Generating a persona from `/create-link` or `/generate` SAVES it as a Client. Not from
  the public homepage form: anonymous traffic would bury the real personas (decided with
  Gabriel). Fallback contexts are not saved either, since they carry no niche detail.
- `demoClientToContext` rebuilds a full NicheContext from a saved row and re-applies the
  per-run half, so a re-picked demo is indistinguishable from a fresh one. Verified
  end to end, including a pt/en merge on one row.
- `GET/PATCH/DELETE /api/demo/clients[/:niche]`, all `requireAuth`.
- The **Clients tab** on the Campaigns page (agency-only, third tab), with the editor
  split English-persona / per-language-terms per the finding above.
- The **Share dialog** takes a saved Client instead of a typed niche.

Columns added beyond what this plan originally listed, each for round-trip fidelity:
`niche_label` and `booking_mode_call` (read by the engine overlay), `when_label`, and the
five `*_pt` term columns. Term lists are UNIONED on save so a generated word cannot
flatten a curated synonym list; the editor REPLACES them, because a human editing a list
has to be able to remove a word.

Left for later, deliberately: `/generate` from WhatsApp accepts `clientNiche` server-side
but the engine does not yet send it (it would need to match free text against saved
Client names). Everything else in phase 1 is reachable from the UI.

**Known data issue, not introduced here:** the `Kitchens` Client carries company name
"Hoffman Puxadores" in both slots, left by an earlier session's live test of `create-link`
before the override-is-not-saved rule existed. Harmless but wrong; fix it by hand in the
Clients tab. The current code cannot reproduce it.

#### Review pass — `3b5f59b2` (2026-08-11)

`/code-review` on the phase-1 diff found seven holes, all fixed and verified against the
running server. Two are worth carrying forward as facts rather than as changelog:

- **A curated niche pack is NOT distinguishable by content.** The delete guard was first
  written as "no description and no opener means it is vocabulary-only", the same predicate
  `demoClientToContext` uses. Querying the live table killed that: all 16 curated rows have
  `description_template`, seeded by the campaign business-profile pre-fill, so the guard
  would have authorised deleting every shared vocabulary in the database. There is now an
  explicit `is_demo_client` column, set on INSERT only. Not on update, because minting a
  demo whose niche matches a curated pack writes onto that shared row (exactly how
  `Kitchens` got its demo company name) without making the row disposable.
- **The same finding makes one branch dead.** Since every curated row has a description,
  `demoClientToContext` never returns null in practice and the re-pick 409 cannot fire on
  today's data. Re-picking a curated niche gives a persona built from its curated
  description and ladder, which is a better demo than generating from scratch. Left as is.

Also fixed: the CRUD was `requireAuth` on a table with no `accountsId` (now `requireAgency`),
`updateDemoClient` wrote caller-supplied keys straight into a Drizzle `.set()`, `put()` threw
on an absent optional field and `saveDemoClient`'s catch swallowed it (one missing field lost
the entire Client), the Share dialog's `reset()` left `savedClient` set, and a stale
localStorage `detailTab` could strand a non-agency user on an empty panel.

**The migration now exists**: `migrate-demo-client-persona-columns.js`. The persona columns
were applied to the Pi by hand while phase 1 was being built and recorded nowhere, so a
database rebuilt from this repo would have had the `schema.ts` declarations and no columns.
It is idempotent and verified as a no-op on the live table.

One review finding did **not** hold. The three campaign-context generators were flagged as
truncating because `gpt-5.4-mini` spends reasoning tokens against `max_completion_tokens`.
Measured first: 0 reasoning tokens and 3-4s on all three. The 485-890 reasoning tokens and
15.6-20.1s in this file's comments are `gpt-5.6-luna`, which only `generateNicheContext`
uses. Budgets were raised anyway in `323b0a76` for margin on variable-length `kb`, but the
abort windows were left alone. **Do not generalise the luna measurements to mini.**

### Phase 1 — original scope (kept for reference)

**Scope shrank on 2026-08-11.** A parallel session shipped the "generate a fresh persona
for this prospect" half: `POST /api/demo/create-link` already accepts
`{ niche, companyName, scenario, aiDisclosure, language, firstName, campaignId }`, runs
`generateNicheContext`, applies `companyName` over the result, and returns a browser link
plus a WhatsApp link. Verified live against Hoffman Puxadores (Portuguese, correct
Brazilian second-message disclosure, real hardware ladder). **Do not rebuild that.**

What is still missing is the part Gabriel actually complained about: the generated persona
is written to `leads.demo_niche` and dies there. So phase 1 is now only:

1. **Persist.** `create-link`, `/generate` and the homepage form INSERT the generated
   context into the Clients table as well as onto the lead. Add the columns it emits that
   the table lacks: `first_message`, `service_name`, `usp`, `niche_question`,
   and `lead_context` (new, see below).
2. **Re-pick.** The Share dialog and `/generate` accept an existing Client instead of a
   free-text niche, skipping generation entirely. Company name stays an override field on
   top of the picked Client (see the section above).
3. **The Clients tab** on the Campaigns page: list, edit, delete, and "use for a demo".

Touches neither the opener nor the campaign structure, so nothing still under discussion
gets locked in.

### Phase 1b — every Client carries an example quote — **DONE 2026-08-11**

Shipped in `ecdf34b7` (CRM) and automations `3bdc5e6` (engine). Prompt 91 patched in
place, prompt 93 at **8.29**. Both patch scripts are committed and idempotent, and both
archive the previous text into `specs/demo-persona-library/`.

What exists now:

- `Niche_Vocabulary.lead_context` is RENAMED to `enquiry_context`, and `quote_context` is
  new. Verified empty on every row before the rename, so nothing was reinterpreted in
  place. `Campaigns.lead_context` and `Leads.lead_context` keep their names: those are the
  real per-campaign and per-lead overrides and are not part of a persona.
- Prompt 91 emits both. Checked against two live generations rather than assumed: English
  "bespoke orangeries" gave £58,400 with foundations / shell / plastering as line items;
  Dutch "dakkapellen" gave €12.850 with a prefab dakkapel and HR++ ramen. Currency follows
  the output language's market and both dates came out relative, as the spec demands.
- The engine picks the half at overlay time (`_overlay_demo_niche_onto_campaign`), deriving
  the mode from the SAME inputs `ai_service` uses moments later, so the two cannot
  disagree. Falls back to the enquiry when a Client has no quote, and still reads the old
  single `lead_context` key for demo leads minted before the split.
- Prompt 93's decision branch has its first-ever `{lead_context}` plus the three
  change-detection questions. The scoping `{lead_context}` was left exactly where it was.

**The generator writes the quote in the demo's language, not in English.** This looks like
it contradicts the "a Client is ENGLISH, except its terms" finding above, and it does not:
that finding is about what the MODEL READS at conversation time. `quote_context` is
generated once per language slot alongside the rest of the persona, so it costs nothing
extra, and a figure carries a currency symbol that is market-specific rather than
language-specific. Left as generated.

**Original scope, kept for reference:**

**Each generated Client also gets a plausible quote for its niche, editable in the UI.**

Why this is not cosmetic. Three sessions independently found the same gap: the quote
demo is thinner than the DBR demo, and it is a DATA problem, not prompt craft. On a
quote-reactivation conversation the AI can never say "the £8,400 for the two French doors
we sent you in March" because no quote data exists anywhere: the Leads table has 86
columns and zero matching `quote|amount|price|value|deal|proposal|line_item|scope|
budget|estimat`. The DBR flow ends with a seven-field brief; the quote flow ends with a
status.

IGNORE the "0 of 662 leads have lead_context" figure that earlier notes leaned on.
Gabriel, 2026-08-11: the current leads are seeded rows for showcasing the CRM. Emptiness
across them is not evidence of anything, and it should not be used to argue for a
per-lead write path.

What to generate, per Client:
- a total amount in the Client's currency, plausible for that niche and job size
- 2-4 line items with the scope a real quote would name
- a quote date, expressed relatively ("March", "about five months ago")
- optionally the decision-maker's role, since it feeds change detection

### WHERE lead_context LIVES (Gabriel's call, 2026-08-11)

**The Client/campaign level is the real home. Per-lead is an override that stays empty
for demos.**

- The example quote is stored on the **Client** row and read from there. One niche, one
  quote, reused by every demo built from it. It belongs beside the ladder and the
  vocabulary, which are already Client-level for exactly the same reason.
- **Do NOT copy it down onto the lead** when a demo is created. Universal-demo leads keep
  `lead_context` EMPTY so the Client value is what resolves. Copying it down would create
  two places holding the same sentence and guarantee they drift.
- The engine's existing precedence (lead-first, campaign-second) already does the right
  thing: empty lead falls through to the Client/campaign value.
- Per-lead stays available for a REAL client whose imported rows carry genuine per-row
  quote detail. That is a production concern, not a demo one.

**Therefore OUT OF SCOPE here:** the per-lead write path (a field on the lead panel, a
column in the lead import). Earlier notes proposed it as the priority. It is not needed
for any demo, and the seeded-lead figure that motivated it is not evidence.

Requirements:
- **Editable in the UI.** Generated is a starting point, never the final word. Same edit
  affordance as the rest of the Clients tab.

### TWO fields on the Client, ONE variable at render time

**CORRECTION to an earlier note in this file: the current placement of `{lead_context}`
is NOT a defect, and it must NOT be moved.** It appears once, at prompt 93 line 315,
inside `{{#if conversation_mode == "scoping"}}`: *"Skip any slot the prospect already
answered unprompted, and any slot already covered by {lead_context}."* That is the LADDER
PRE-FILL use and it is correct. Moving it out would make the ladder re-ask things the
lead already volunteered. The engine's own comment states the dual intent: *"quote detail
in decision mode, ladder pre-fill in scoping mode"*. Only the decision half was ever
written; the scoping half works.

The real problem is REUSE, and it is why one stored field cannot work. A Client is meant
to be reused across types. If "Ferragens" stores *"enquired via the site about black
handles"* and the same persona is flipped to quoted, the AI references an enquiry in a
conversation about a quote; store the quote instead and the scoping ladder gets pre-filled
with line items from a quote that by definition does not exist yet.

So:
- **`enquiry_context`** on the Client — what they said when they came in. Ladder pre-fill.
- **`quote_context`** on the Client — the example quote: total, line items, relative date,
  decision-maker role. Change detection.
- The ENGINE picks which one to put in `{lead_context}` based on `conversation_mode`.
  One prompt variable, so the scoping side needs NO change; the decision branch gains its
  first-ever `{lead_context}` reference. Archive-then-patch like every other p93 edit.
- The per-lead override sits on top of whichever was selected, and stays empty for demos.

**DONE ALREADY (engine 94462bf): `/scenario` now resets and replays.** Gabriel:
*"ideally when we switch between inquired/quoted, the demo will restart from scratch."*
This is what makes the two-field design safe: a transcript can never straddle both modes,
so the two fields can never both be live in one conversation. It also becomes mandatory
once phase 2's per-type openers land, since the opener itself changes with the type.

Worth pairing with it (small, same area): decision mode has NO change-detection
questions. Its block is verbatim the original Step 3 text. Two or three questions belong
there: has the scope moved, has the timing moved, is the same person deciding.
Deliberately NOT a ladder, because §4.6 already forbids re-litigating a quote and eight
questions would read as "we lost your file".

### Phase 1c — restart the demo as a DIFFERENT scenario (both surfaces)

**Spec it for WhatsApp too. Gabriel asked, and the "wait for the browser page" argument
is now out of date.**

That argument was: restart is a button on a page you control, so building the WhatsApp
version first means building it twice. The browser page HAS shipped, and the picture
underneath it is different from what that argument assumed.

**What is already built (verified 2026-08-11, `src/webhooks/web_demo_routes.py`):**
- `Leads.demo_restarts` column, live and in use.
- `MAX_RESTARTS = 5` with a 429 when exceeded (`:345`).
- A real reset: DELETE the lead's Interactions, null `ai_memory` / `ai_summary`, set
  `Conversion_Status='New'`, bump the counter, re-fire the opener (`:347-362`).
- A surface guard: refuses with `claimed_by_whatsapp` when `channel_identifier` does not
  start with `web-demo:` (`:339`).

**What is built on NEITHER surface: restarting as a different scenario.** The browser
restart replays the SAME scenario. The comment at `web_demo_routes.py:67` even says the
cap is sized so a prospect can try "three different scenarios", so the intent was there
and the implementation only ever reset. So this is not "port the browser feature to
WhatsApp". The feature does not exist yet anywhere, and the reset half is already shared.

**Build the core ONCE, surface-agnostic**, and give it two thin triggers:
`restart_demo(lead, scenario | None)` = cap check, wipe, set `what_has_the_lead_done`
from the scenario, re-fire the opener. Extract it from `web_demo_routes.py`; do not
duplicate it into `demo_commands.py`. Triggers: a button/picker on the page, a digit
reply on WhatsApp.

**WhatsApp trigger: plain digits, NOT `/1 /2 /3`.** A prospect will not naturally type a
slash command; slashes are the VIP idiom and teaching them to a stranger mid-demo is
friction. The collision risk (a lead answering "2" to "how many bathrooms?") is solved by
only accepting a bare digit when the conversation is in a TERMINAL state, which is
exactly when the offer is shown. Outside that window a digit is just conversation.

**The offer line MUST be translated**, en/nl/pt, keyed off the lead's language. Same
pattern as `build_disclosure_clause` in `_helpers.py`: a per-language table, not an
English string with a translation bolted on. It is the last thing a prospect reads.

**TWO options, not three: 1 = inquired (DBR, no quote yet) · 2 = quoted.**
Upsell was added and then reverted on 2026-08-11 (engine 504f21d, CRM 1ffd9530) — see
"Upsell is deferred" below. Note `/scenario` already resets and replays (engine 94462bf),
so its behaviour and the restart core's are the same thing: unify them.

**The one piece of DATA that genuinely does not exist: the invited flag.** An invited
WhatsApp lead and a public homepage lead are indistinguishable today. Both carry
`Source = 'WhatsApp Demo'` and a `wa-demo:<hex>` channel_identifier. Restart must be
offered ONLY on links Gabriel minted, never on public homepage sessions, so `create-link`
has to mark them. Add a flag or a distinct identifier prefix at mint time. Everything
else in this phase is wiring; this is the only new fact.

**Cap: keep ONE number and ONE column.** `MAX_RESTARTS = 5` on `demo_restarts` already
works and is per link, which is the right unit. A "3 per phone per 24h" rule needs a
timestamp column and a phone-level rollup for no benefit a per-link total does not
already give.

## Upsell is DEFERRED, deliberately (Gabriel, 2026-08-11)

Added and reverted the same day. Do not re-add it as a toggle value or a dropdown
option; if it comes back it comes back as its own conversation flow.

Why: `derive_lead_stage` maps an existing customer to the `owner` stage, and
`derive_conversation_mode` sends `owner` to **decision**. Decision mode is written
entirely around "you are holding our quote, what is stopping you": it references a
quote that does not exist for an upsell lead, §4.6 forbids re-litigating a quote that
was never sent, and the price-is-not-an-objection rules assume a quoted price. The
honest shape of an upsell conversation is scoping-WITH-history (they own panels, you
are scoping a battery), i.e. a third prompt-93 branch and a third flow to write and
test. Gabriel: "it sounds like a whole can of worms tbh". Correct, and out of scope.

KEPT from the reverted work, on purpose: `"cliente existente"` in the `owner` keyword
list (`tools/ai_service.py`). Independent correctness fix. Without it any Portuguese
existing-customer phrasing fell through to unclassified, which resolves to SCOPING, so
a lead who had already bought would be walked through a fresh scoping ladder. Campaign
65 and the `/campaign upsell` alias are untouched and still reachable.

## DEFERRED: demo-as-them from a prospect's website URL (Gabriel, 2026-08-11)

Paste the prospect's URL, generate the demo as THEIR firm, mint the link. Gabriel's
call after seeing the shape: *"it does look pretty complicated, maybe defer it actually."*
Not rejected, parked. Two findings worth keeping so it is not re-estimated from zero:

- **The scraper exists and is better than a naive fetch.** `_scrape_homepage(url)` at
  `tools/prospect_enricher.py:546` (aiohttp + browser headers + redirects), with
  `_extract_internal_links` doing priority-scored internal crawling, BeautifulSoup/lxml
  parsing, and Firecrawl keys already configured (`_firecrawl_keys`). Firecrawl is
  exactly the answer to the "JS-rendered pages return an empty shell / sites block
  scraping" risk that was flagged as the main danger. So the input side is mostly a
  mapping job onto the shape `generateCampaignContext` already consumes, not new
  infrastructure.
- It stays deferred anyway because it only pays off if the demo becomes the CTA in cold
  outreach rather than something shown after a discovery call. That sequencing is not
  settled, and phase 1 (reusable Clients) is the prerequisite either way: a per-URL demo
  that cannot be saved and re-picked has the same dead-end problem this whole spec exists
  to fix.

## FIXED: testing a link no longer destroys it (engine fb22f9c)

Demo claims are first-writer-wins (`_claim_demo_lead`), so testing a minted link with
your own phone attached it to the lead and the prospect was then refused silently.
A link could be tested OR sent, never both.

Gabriel's call: his own numbers test without claiming. Implemented as a HANDOVER rather
than a skip, because a demo lead with no phone cannot be replied to: a VIP-held link is
released to the prospect on their first message, with the test conversation deleted so
they do not open their "personalised" demo halfway through someone else's chat. One
direction only, VIP -> prospect; the reverse would let a mistyped token hijack a live
conversation. Verified end to end on a throwaway lead, then deleted.

Still open on the same code path, and worth doing together in phase 1c: the **invited
flag**. An invited WhatsApp lead and a public homepage visitor are indistinguishable
(both `Source = 'WhatsApp Demo'`, both `wa-demo:<hex>`), and restart must be offered only
on minted links.

## SETTLED: the demo is a POST-CALL CTA (Gabriel, 2026-08-11)

*"I was thinking about sending the demo as a CTA after phone calls with prospects
really."* This closes the sequencing question left open above, and it has consequences:

- It CONFIRMS deferring the URL-scraping "demo-as-them" feature. Its entire justification
  was cold outreach, where a generic demo sent to a kitchen firm gets ignored. After a
  call you already know their niche, their company and their words, and typing the niche
  is faster than scraping it.
- It raises the value of phase 1. Many calls land in the same niche, so a saved,
  re-pickable Client is used constantly rather than occasionally.
- It makes the Share flow the critical path: generate or pick, edit anything wrong, test,
  send, all within a few minutes of hanging up. Optimise THAT, not bulk generation.

## ONE generation path, not two (clarifying a confusion this file caused)

There is no separate "generate a Client" button distinct from the Share button. Phase 1
step 1 persists EVERY generated context into the Clients table, whichever entry point
produced it: the Share dialog, `/generate` on WhatsApp, or the homepage form. The Share
button is therefore "generate (or pick) a Client, then mint a link from it", and anything
it generates is selectable again afterwards. Wording in an earlier draft implied two
paths; there is one.

### Phase 2 — campaign type + per-type openers
3. Type toggle on campaign 60: **inquiry / quotes**. (Upsell deferred, see below.)
   Replaces the
   scoping/decision picker (Gabriel: "I don't think that I will switch it tbh" — the
   type words are the ones he actually uses). `conversation_mode` stays the engine-side
   token; the toggle is its front end.
4. **The opener must stay an editable UI field. NOT hardcoded.** Gabriel was explicit.
   `Opener_Templates` gains a `type` column, the picker filters to the current type, and
   campaign 60 holds one opener per type. The second message already varies by type
   through prompt 93's `conversation_mode` branch, so that half is done.
   - inquiry/DBR opener does IDENTITY VERIFICATION: "Hi, this is Mark from Solar Energy
     Solutions. Are you the same Nick who reached out about solar panels a few months
     ago?" Second message asks whether they are still interested.
   - quotes opener does NOT verify identity (they already know you): current shape.
     Second message asks where they are in the decision.

### Phase 3 — disclosure placement + archiving
5. Move the AI disclosure control to the FIRST settings tab, with a "what changes"
   reveal on click. Gabriel picked **explicit picker in the UI** over language-derived:
   language must stop implying jurisdiction, so a UK-style no-disclosure conversation can
   be shown in Dutch.
   **Partly done already:** `create-link` takes an `aiDisclosure` argument, so the
   per-demo override exists at the API. What is missing is the UI control and killing the
   language→jurisdiction default in `server/demo-session.ts` (`en→off / nl→opener /
   pt→second_message`).
6. Archive (NOT delete) campaigns 61, 65, 66. All three are already `Draft`.
   61 has 14 leads and possibly shared links; 65 and 66 have never had a single lead.

## Explicit non-goals
- Do NOT add the type toggle to campaigns 61/65/66. That builds the redundancy instead of
  removing it, and it is why 61's broken opener went unnoticed for months.
- Do NOT delete any campaign.

## State at the time of writing (refreshed 2026-08-11, pre-compaction)

- **Prompt 93 live at v8.26** (Prompt_Versions archived through v8.25), 42289 chars.
  Patch modules 01-11 in `/home/gabriel/automations/scripts/prompt93/`. Apply with:
  `cd scripts/prompt93 && NODE_PATH=/home/gabriel/LeadAwakerApp/node_modules \
   node --env-file=/home/gabriel/LeadAwakerApp/.env apply_edit.js ./NN-name.js "label"`
  (NODE_PATH is required: `pg` lives in the CRM's node_modules, not the engine's.)
  Module 11 is another session's English-only-body pass. VERIFIED after it landed: all
  six of this session's prompt changes survived it (`assistente de IA`, the manager line,
  §6.3d, the closing-question variant, the precedence line, `immediate_callback`).
- Campaigns: 60 Universal Demo (terra, disclosure off), 61 Discovery Demo - Quotes
  (opener), 65 Upsell, 66 DBR. 58/61/65/66 still pin `gpt-5.6-sol`; Gabriel flips those
  in the UI himself now that the picker offers the 5.6 family.
- Engine committed through `fb22f9c`, CRM through the docs commit that follows this edit.
- UNCOMMITTED AND NOT OURS — leave alone: `tools/hubspot_enricher.py`,
  `tools/CHANGELOG-OUTREACH.md`, `tools/OUTREACH-TOOLS.md`, `tools/PRE-CALL-SIGNALS.md`,
  `tools/leadiq_to_hubspot.py` (engine); `specs/dbr-scoping-mode/implementation-plan.md`,
  `demo-page.png`, `docs/AI VOICE RESEARCH/` (CRM).

### Shipped this session, beyond the plan itself
- `/campaign universal|quote|upsell|dbr` name aliases (ids still work).
- `/scenario` cut to inquired|quoted, and it now RESETS and replays.
- Campaign 61's opener given `{agent_name}` + `{disclosure_clause}` (it had neither).
- Manager line verbatim in disclosure-off, with a decision-mode closing-question variant.
- §6.3d "speak to someone right now": promises a callback + sends the contact card,
  gated on `immediate_callback` (derived from `is_demo`).
- Booking: link fallback when the availability lookup fails, instead of a dead-end stall.
- The Cal.diy engine-credentials endpoint, recovered by merging
  `feature/gbp-currency-uk-visitors`. Slots verified live: 79 for the demo account, 95
  for account 1. Also brought `/uk` `/us` `/nl` routes with it.
- Persona commands work on generator-less leads and on campaign 61.
- `extract_project_brief` no longer fabricates a brief from decision transcripts.
- VIP test-then-send handover (`fb22f9c`).

## Still open / backlog
- `/model` and `/wait` write the SHARED campaign row: one `/model luna` repoints the
  public homepage demo for every visitor, permanently. Reported, unfixed.
- Save-time guard: nothing stops an `opener`-mode campaign whose First_Message lacks
  `{disclosure_clause}` from disclosing nowhere. 61 and 66 both hit this.
- ~~Brazilian Portuguese in the language tables~~ CLOSED by another session, and better
  than planned: consolidated into ONE `_LANGUAGE_NAMES` in `tools/lang_field.py`
  instead of the three duplicated tables. Do not re-fix.
- kb price deflection: point at outcomes rather than inventing figures.
- `/scenario` will need `upsell` back as a third option once phase 2 lands (it was cut to
  two on 2026-08-11, before the upsell type was agreed).
