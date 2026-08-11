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

## Phases

### Phase 1 — save and re-pick personas (START HERE, self-contained)

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

### Phase 1b — every Client carries an example quote (Gabriel, 2026-08-11)

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

## State at the time of writing
- Prompt 93 live at **v8.25**. Patch modules 01-10 in `/home/gabriel/automations/scripts/prompt93/`.
  Apply with `NODE_PATH=/home/gabriel/LeadAwakerApp/node_modules node --env-file=/home/gabriel/LeadAwakerApp/.env apply_edit.js ./NN-name.js "label"`.
- Campaigns: 60 Universal Demo (terra, disclosure off), 61 Discovery Demo - Quotes
  (disclosure opener), 65 Upsell, 66 DBR. 58/61/65/66 still on `gpt-5.6-sol`.
- Both repos committed through: CRM `cbe62c19` (branch merge), engine `828c32b`.
- UNCOMMITTED AND NOT OURS — leave alone: `demo_recap.py`, `AiSummaryView.tsx`,
  `locales/{en,nl}/leads.json` (another session's demo-recap + Brazilian PT work),
  and the hubspot/outreach tooling files in the engine repo.

## Landed in parallel on 2026-08-11 (verified, not taken on trust)

A third session shipped three things that touch this spec. All verified against live
state, not accepted from its report:

- **`Campaigns.lead_context`** exists as a column. Sits where Service used to in Business
  Setup; Service moved to the AI section. Precedence is lead-first then campaign-second,
  matching `what_lead_did`. The generator now emits it too (prompt row 91 updated), so a
  saved Client should carry it: **add it to the Clients table in phase 1.**
- **Browser demo at `/demo/<token>`**, routed through `/api/web-demo/:token/:suffix?`
  (`server/routes/demo.ts:241`). A visitor message is packed into the same payload the
  WhatsApp webhook builds and handed to the same `process_inbound`, so browser transcripts
  land in the CRM identically. **Consequence for this spec: "send a prospect a demo" now
  has two surfaces, and the Clients picker must serve both.** The URL points at
  leadawaker.com, so on the Pi test with `app.leadawaker.com/demo/<token>`.
- **A real bug it caught:** the niche overlay was gated on a `wa-demo:` prefix, so a
  personalised BROWSER link would have opened with the right first message and then held
  the entire conversation in campaign 60's solar vocabulary. Same gate was wrong in the
  retention purge and the post-booking vCard. Fixed there.

Pre-existing test failures, confirmed NOT caused by this session's work: 5 failures in
`tests/test_day_followup.py` and `tests/test_slot_signal.py`, stale fakes against
`raise_on_error` in the Cal.diy booking code (from commit 2070a83). Reproduced identically
against the pre-change `booking_execution.py`, so the link-fallback edit is not implicated.

Its open item is now CLOSED: the Portuguese disclosure rendered the English phrase
"digital assistant" inside Portuguese text. Gabriel asked for "assistente de IA da
{empresa}". Fixed in prompt 93 v8.25 (patch module 10): the term is now named per
language (en "digital assistant", nl "digitale assistent", pt "assistente de IA") instead
of a rule saying not to drop the English words "in any language", which pt read literally
while the Dutch example localised. Verified: with ai_disclosure=second_message the
resolved prompt carries the pt term and neither of the other two.
NOTE the OPENER side was already correct and needed no change:
`_DISCLOSURE_CLAUSE_ON["pt"]` in `_helpers.py` is "o assistente de IA da {company}".

## Still open / backlog
- `/model` and `/wait` write the SHARED campaign row: one `/model luna` repoints the
  public homepage demo for every visitor, permanently. Reported, unfixed.
- Save-time guard: nothing stops an `opener`-mode campaign whose First_Message lacks
  `{disclosure_clause}` from disclosing nowhere. 61 and 66 both hit this.
- `_LANG_NAMES` in `_helpers.py` / `ai_service.py` still says "Portuguese", not
  "Brazilian Portuguese" (another session is fixing the demo_recap copy of this).
- kb price deflection: point at outcomes rather than inventing figures.
- `/scenario` will need `upsell` back as a third option once phase 2 lands (it was cut to
  two on 2026-08-11, before the upsell type was agreed).
