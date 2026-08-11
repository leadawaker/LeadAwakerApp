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
1. `/generate` and the homepage form INSERT into `Niche_Vocabulary` instead of only
   writing `leads.demo_niche`. Add the missing columns listed above.
2. A persona picker when creating a demo link: choose a saved niche or generate a fresh
   one. **Company name overridable at pick time**, so "Hoffman Puxadores" is a field edit,
   not a regeneration.
Touches neither the opener nor the campaign structure, so nothing still under discussion
gets locked in.

### Phase 2 — campaign type + per-type openers
3. Type toggle on campaign 60: **inquiry / quotes / upsell**. Replaces the
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
6. Archive (NOT delete) campaigns 61, 65, 66. All three are already `Draft`.
   61 has 14 leads and possibly shared links; 65 and 66 have never had a single lead.

## Explicit non-goals
- Do NOT add the type toggle to campaigns 61/65/66. That builds the redundancy instead of
  removing it, and it is why 61's broken opener went unnoticed for months.
- Do NOT delete any campaign.

## State at the time of writing
- Prompt 93 live at **v8.24**. Patch modules 01-09 in `/home/gabriel/automations/scripts/prompt93/`.
  Apply with `NODE_PATH=/home/gabriel/LeadAwakerApp/node_modules node --env-file=/home/gabriel/LeadAwakerApp/.env apply_edit.js ./NN-name.js "label"`.
- Campaigns: 60 Universal Demo (terra, disclosure off), 61 Discovery Demo - Quotes
  (disclosure opener), 65 Upsell, 66 DBR. 58/61/65/66 still on `gpt-5.6-sol`.
- Both repos committed through: CRM `cbe62c19` (branch merge), engine `828c32b`.
- UNCOMMITTED AND NOT OURS — leave alone: `demo_recap.py`, `AiSummaryView.tsx`,
  `locales/{en,nl}/leads.json` (another session's demo-recap + Brazilian PT work),
  and the hubspot/outreach tooling files in the engine repo.

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
