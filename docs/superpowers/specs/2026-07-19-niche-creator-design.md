# Niche Creator — Design Spec (2026-07-19)

## Goal

Let Gabriel create a fully working niche from the campaign settings Behavior tab: type a niche name (e.g. "Dentists"), and AI generates a complete Niche_Vocabulary row plus fills the campaign's Business/AI fields. The niche dropdown becomes self-service: new niches appear in it immediately, and each option can be removed with an inline x. The existing Generate button relocates from the detail-view toolbar to the settings footer.

Primary use case: a prospect from a new vertical (dentist, gym) shows interest; a demo campaign for their niche should take about a minute of setup instead of hand-writing vocabulary rows in Settings → Niche Words.

## Decisions (locked with Gabriel)

- **Full row depth**: generation produces everything a curated niche has — 5 term groups (en+nl), 4 example packs (en+nl), 3 business templates. Not a thin stub.
- **Delete guard**: deleting a niche is blocked (409) if any campaign currently uses it; the error names the blocking campaigns. Otherwise confirm-then-delete. `__default__` is never listed or deletable.
- **Old Generate button**: fully replaces the Prev-nav ("← Start") button in the settings footer, on every tab. Styled flat: token-based paper/white background, no border, no shadow, not neumorphic. Prev navigation is dropped (section tabs at the top remain).
- **Model chain**: Claude via subscription first (`claude -p --model sonnet`, 60s timeout), fallback OpenAI `gpt-5.4-mini`. Groq is skipped for this call (8B model is unreliable for large structured JSON).
- **Orchestration**: client-driven two-step — create the niche row, then reuse the existing `/api/campaigns/:id/generate` to fill campaign fields.

## Architecture

### 1. Server — niche row generation

`POST /api/niche-vocabulary/generate` (requireAgency), body `{ niche: string }`.

- Normalize the name (trim, Title Case). If a row with that niche already exists, return it with `{ existed: true }` — no regeneration.
- System prompt stored in Prompt_Library as `use_case: "niche_row_generator"` with a hardcoded fallback constant (same pattern as Prompt 91 / `NICHE_GENERATOR_SYSTEM_FALLBACK`). Editable from the Prompts UI.
- The prompt asks for one JSON object matching the Niche_Vocabulary shape used by `storage.setNicheVocabulary` (the same `both`-languages payload the Niche Words management PUT sends): 5 term groups as word arrays (nl base columns + `_en` columns), 4 example packs as `{en, nl}` text blocks (question_bank, bad_examples, objection_examples, scenario_examples), 3 templates as `{en, nl}` (company_name_template, description_template, kb_template). Packs may reference `{project_term}`, `{advisor_term}`, `{proposal_term}` placeholders like the curated rows do.
- Generation helper: extend `aiTextHelper.ts` so the Claude path accepts an optional model + timeout (`sonnet`, 60s here; existing callers keep `haiku`/30s). New exported function (e.g. `completeTextLarge`) with the Claude → OpenAI chain; OpenAI call uses `NICHE_GENERATOR_MODEL` (gpt-5.4-mini) with `max_completion_tokens` ~3500 and no temperature.
- Validation: parse JSON (strip fences), validate field-by-field. Missing/invalid fields are stored empty — the engine's per-field `__default__` fallback covers them at runtime. Only hard-fail (502 + toast) when the terms groups are unusable.
- Save via existing `storage.setNicheVocabulary(niche, both)`. Response: `{ niche, existed: false, warnings: string[] }` (warnings list any fields that came back empty).

### 2. Server — delete guard

Extend `DELETE /api/niche-vocabulary/:niche`:

- New storage helper returns campaigns where `niche = :niche` (id + name).
- If non-empty → 409 `{ message, campaigns: [{id, name}] }`.
- `__default__` → 400.
- The Settings → Niche Words delete path gets the same guard for free (same endpoint).

### 3. Client — NicheSelect (BehaviorSectionFields.tsx)

- Each option row gets a small x on the right (ghost until hover). Click: `stopPropagation`, confirm dialog, `DELETE`, refetch `/api/niches`. 409 → destructive toast listing the blocking campaign names.
- Bottom of the dropdown: a "+ New niche…" row that swaps to an inline text input. On confirm:
  1. `POST /api/niche-vocabulary/generate` — button shows spinner + "Creating niche…" (expect 20-60s).
  2. Refetch `/api/niches`, call `onChange(newNiche)` — this fires the existing `onNicheChange` template auto-fill.
  3. `POST /api/campaigns/:id/generate` with `{ niche }` to fill empty Business/AI fields bilingually (existing endpoint, existing fill-empty/translate semantics).
  4. Refresh the campaign query (reuse the refresh path the old toolbar button used) and toast the `filledFields`/`translatedFields` summary; include generation `warnings` if any.
- `existed: true` short-circuits to step 2 (just select it).
- If NicheSelect grows past ~150 lines with this, extract it to its own file next to BehaviorSectionFields.

### 4. Client — Generate button relocation

- Remove the Generate popover block from `DetailViewToolbar.tsx` (the `activeTab === "configurations"` popover), keeping the rest of the toolbar intact.
- In `CampaignSettingsLayout.tsx`, replace the Prev-nav button (lines ~159-166) with the Generate button + popover, preserving current behavior (niche input only when fields are empty, same endpoint, same toasts). The `needsNiche`/`hasEmptyFields` logic moves with it.
- Styling: flat — background `var(--paper)` (or equivalent token; never hardcoded white), no border, no box-shadow, mono uppercase label like the other footer buttons, wine-colored icon allowed. Works in both themes.

### 5. i18n

New strings in `client/src/locales/{en,nl}/campaigns.json`: create-niche row label, input placeholder, creating state, delete confirm, delete-blocked toast, generation-failed toast, warnings summary. No hardcoded strings.

## Error handling

- Claude CLI unreachable/timeout → OpenAI fallback transparently; both fail → 502, toast, no row written.
- Campaign field fill failing after row creation is non-fatal: the niche exists and is selected; toast tells Gabriel to hit Generate (footer) to retry the fill.
- Autosave interplay: `/generate` patches the DB row directly; the client must refetch and remount draft state afterward (same as the old toolbar flow). Verify the `niche` field is in the `buildDraft()` whitelist in `useCampaignDetail.ts` (known silent-save gotcha).

## Testing

1. Create "Dentists" on a test demo campaign: row appears in dropdown + Settings → Niche Words; shape matches a curated row (spot-check term arrays en+nl, packs `{en,nl}`, templates).
2. Engine check: campaign with the new niche resolves terms via `get_niche_terms` (no kitchen fallback).
3. Delete guard: deleting a niche used by a campaign → 409 toast with campaign name; unused niche → confirm + gone from dropdown.
4. Duplicate create → selects existing, no second row.
5. Footer Generate button: fill/translate behavior unchanged, flat style, light + dark themes, all tabs.
6. Claude-path failure simulation (bad CLAUDE_BIN) → OpenAI fallback still produces a valid row.

## Out of scope

- The universal homepage demo (campaign 60) — unchanged; it keeps its per-lead generated persona.
- pt localization (product is en+nl).
- Editing generated niches (Settings → Niche Words already covers it).
