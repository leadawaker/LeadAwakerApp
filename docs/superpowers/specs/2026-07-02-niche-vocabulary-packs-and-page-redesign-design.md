# Niche Vocabulary Packs & Niches Page Redesign — Design

**Date:** 2026-07-02
**Status:** Approved design, pending implementation plan
**Owner:** Gabriel, build by Claude

## Problem

The Discovery Prompt (Prompt 93, v8.7+) re-themes itself per niche by substituting four "example pack" placeholders (`{niche_question_bank}`, `{niche_bad_examples}`, `{niche_objection_examples}`, `{niche_scenario_examples}`) from the `Niche_Vocabulary` table. Of the 16 niches, only `Kitchens` has real pack content; the other 15 silently inherit the `__default__` row, which is a de-kitchened, tokenized copy of the Kitchens content — vocabulary-safe but not scenario-accurate (financing/payback framing for solar, permits/seasonal windows for landscaping, etc. never surface). Separately, `Kitchens` and `__default__`'s `en` columns are filled with the *same Dutch text* as their `nl` columns, so any English-language campaign gets Dutch phrasing.

On the UI side, the "Niche Words" management page stacks every niche as a fully-expanded card in one long scroll, and "add niche" is a `<select>` restricted to a hardcoded 16-item list, so a real custom niche can never be created. The campaign settings' niche picker (`BehaviorSectionFields.tsx`) is a second, independent hardcoded 16-item list, so even if a custom niche existed in `Niche_Vocabulary`, no campaign could select it.

## Goals

1. Give all 16 niches real, niche-specific example-pack content in both English and Dutch, so nothing depends on `__default__` for correctness.
2. Fix the `en`/`nl` duplication bug on `Kitchens`/`__default__` while touching this table.
3. Redesign the Niches management page as a left-rail/right-detail split (one niche visible at a time), matching the pattern already used elsewhere in this same file.
4. Replace the fixed-list niche pickers (both the vocabulary page's "add niche" and the campaign settings niche picker) with a flow that supports genuinely custom niches end-to-end.

## Out of Scope

- Persisted custom ordering for the niche list (dropping the old manual "featured niches first" order in favor of alphabetical).
- An icon picker for custom niches (they fall back to a generic icon, same as today's default behavior for any unmapped name).
- pt-BR translations (dropped product-wide, EN/NL only).
- Rewriting Prompt 93's fixed skeleton text itself — only the four substituted pack fields change.
- Automated tests (none exist for this area; verified manually per project convention).

## Part 1 — Content backfill

### Which rows change

Fill from scratch: Bathrooms, Countertops, Flooring, General Contracting, HVAC, Interior Design, Landscaping, Moving Services, Painting, Pest Control, Pool Installation, Roofing, Solar Panels, Wellness, Windows & Doors (15 niches, confirmed via direct DB query to have empty `question_bank`/`bad_examples`/`objection_examples`/`scenario_examples` for both languages).

Fix in place: `Kitchens` and `__default__` — rewrite only the `en` side of all four fields with real English; `nl` side is untouched (it's already the correct, tuned content).

### Structural contract (why this isn't free-form writing)

Verified against the live Prompt 93 text — each field lands at a fixed point in the skeleton and later sections reference it by name, so every niche's content must reuse the same categories/numbering as the existing Kitchens content, not just be "similarly themed":

- **`niche_bad_examples`** — inserted directly after "Bad examples:" in §4.9 (question-quality rule). A handful of presumptuous/leading questions to avoid, in the niche's domain.
- **`niche_question_bank`** — inserted at the end of STEP 3, before STEP 4. Must keep Kitchens' five sub-parts: preferred open questions for a bare status, price-framed-status reframing examples, the general good-question bank, the "I need to think about it" special case, and the "not now" special case.
- **`niche_objection_examples`** — inserted inside STEP 4. Must keep exactly these named categories, because STEP 5 and STEP 6 reference them by name ("the commitment-check phrasings in Step 4", "the relevance phrasings in Step 4"): Price, Cheaper competitor, Reframe after a second objection, Closing after two clear rejections, Commitment check (buying signal), Advisor relevance — price difference, Advisor relevance — remaining questions.
- **`niche_scenario_examples`** — opens "# 6. SCENARIO PLAYBOOK". Must number its entries `6.1`–`6.7` since `6.8` (booking confirmed) and `6.9` (goodbye) are hardcoded immediately after in the base prompt. Categories: Timing issue, Situation outside our control, AI accusation, Pricing and deals, Unknown/detailed question, a niche-flavored "committed elsewhere" scenario (Kitchens' version: "purchased elsewhere" from another kitchen supplier), Data question ("where did you get my details?").

### Language & market grounding

Both `en` and `nl` describe the same Dutch business reality (Euro pricing, BTW, gemeente vergunningen, VvE, subsidy schemes like ISDE/Warmtefonds/salderingsregeling where relevant to the niche) — `en` is a natural English rendering for an English-speaking prospect dealing with a Dutch business, not a different (e.g. US-market) scenario set, and not a literal duplicate of the Dutch text.

### Drafting approach

Content is drafted by a small number of parallel subagents (3–4 niches each), each briefed with the current Kitchens row as its structural template and told to replace the specifics with realistic, niche-appropriate reasoning (real objections, real cost/timeline drivers, real permits/subsidies) rather than swapping nouns. I review each niche's draft for plausibility and tone before it's written to the database.

### Delivery mechanism

All 15 target rows already exist in `Niche_Vocabulary` (word terms are filled in; only the four pack columns are empty jsonb `{nl:"",en:""}`), so this is an `UPDATE`, not an `INSERT`. Delivered via a one-off Node script (`node --env-file=.env`, direct `pg` pool — same pattern already used for `db:push` on this box, since it lacks a TTY) that sets the four jsonb columns per niche. No schema changes.

### Verification

Re-run the discovery query (per-niche boolean check of whether each pack column is non-empty for both languages) and confirm all 16 named niches are now fully populated in both languages (plus `__default__`'s `en` side).

## Part 2 — Niches page redesign

**File:** `client/src/features/prompts/components/NicheVocabularyPanel.tsx` (currently 500 lines — will be split to stay under the file-size guideline).

- **Locale:** `vocabulary.title` ("Niche Words") → "Niches" in `client/src/locales/{en,nl}/prompts.json`. This single key drives both the tab label and the lang-toggle `aria-label`, so no other string changes are needed.
- **Layout:** replace the single stacked-cards scroll with the same left-rail/right-detail split this file already uses for its Campaign/System prompt tabs — a `w-[var(--toolbar-w)]` bordered rail of `ListCard`-style rows on the left, one niche's full detail panel on the right. `__default__` is pinned first in the rail, labeled "Default (fallback)" (client-side pin, independent of API sort order); the rest follow alphabetically as returned by the API.
- **Split:** extract a `NicheListRail` component for the left column; the existing `NicheCard` body (templates, packs, word groups) becomes the right-panel detail view, logic otherwise unchanged. `TemplateField`/`WordGroup` helpers are untouched.
- **Selection:** new `selectedNiche` state, defaulting to the first non-default niche alphabetically (falls back to `__default__` only if that's the sole row). Mobile follows the same list/detail toggle pattern (`mobileView`) already used elsewhere in this file.
- **Delete:** same confirm-dialog trash icon, now in the right panel's header (single niche visible at a time) instead of per-card.
- **Add niche:** the `NICHE_OPTIONS`-restricted `<select>` is replaced with a free-text input + the existing "Add niche" button (same busy/disabled/dedup behavior — trim, non-empty, not already in the current list).

## Part 3 — Campaign niche picker becomes dynamic

**Files:** `server/routes/accounts.ts`, `server/storage/accounts.ts`, `client/src/features/campaigns/components/settings/BehaviorSectionFields.tsx`.

- New route `GET /api/niches` (`requireAuth`, not `requireAgency` — campaign settings are edited by non-agency client users too) returning niche names only (`string[]`, excludes `__default__`, alphabetical).
- New lightweight storage method selecting just the `niche` column (not the full jsonb payload used by `listNicheVocabularies`).
- `BehaviorSectionFields.tsx`'s `NicheSelect` fetches this list instead of reading the hardcoded `NICHE_ORDER` array, so a niche created on the Niches page is immediately selectable on any campaign. `NICHE_ICONS` stays as a bonus lookup (unmapped/custom names fall back to a generic icon, mirroring the Niches page's own fallback). The old manual "featured niches first" order is dropped in favor of alphabetical, per Out of Scope.

## Manual verification plan

- Re-run the DB pack-completeness check after the backfill script runs.
- In-browser: confirm the tab reads "Niches", confirm typing a brand-new niche name and clicking Add creates it (no dropdown, no restriction to the old 16), confirm that same new niche now appears in a campaign's niche picker immediately, confirm the rail shows one niche selected at a time with `__default__` pinned first.
