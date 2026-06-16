# Multilingual Campaign Context Fields — Implementation Plan

Each phase leaves the app working and is **committed before the next** (work-loss history).
`tsx watch` hot-reloads; never run `tsc`. JSON lives in the existing `text` columns — **no
`db:push`**.

## Core data shape

A context field is one of:
- legacy plain string `"Made in Germany"` (pre-existing), or
- JSON string `'{"en":"...","nl":"..."}'`.

Shared helper module `shared/langField.ts` (importable by client + server):
```ts
export type Lang = "en" | "nl";
export type LangField = { en?: string; nl?: string };
export function parseLangField(raw: unknown): LangField        // string|JSON -> {en,nl}; plain string -> {en:str} (mirrored)
export function resolveLang(raw: unknown, lang: Lang): string  // pick lang, fallback en -> other -> ""
export function setLang(raw: unknown, lang: Lang, val: string): string // returns JSON string for storage
export function isFilled(raw: unknown, lang: Lang): boolean
```
Rule: a bare string is treated as `{en: str}` **and** as the value for any language until a
real translation exists (so legacy/PT campaigns are unaffected).

---

## Phase 1 — Shared helper + engine read (backend-safe, no UI change)

- **`shared/langField.ts`** — the helper above (+ unit-style sanity via `node -e`).
- **Python engine** (`/home/gabriel/automations/`): add `tools/lang_field.py`
  `resolve_lang(raw, lang)` mirroring the TS logic (accept str or JSON dict). Update every
  reader of the scoped fields to resolve against the campaign's `language`:
  - `src/automations/ai_conversation.py` (prompt build — primary), and any
    `config.get("campaign_usp"/"ai_style_override"/"niche_question"/"kb"/"ai_role"/
    "what_lead_did"/"service_name"/"description")` site found via grep
    (telegram_demo_bot.py, booking_routes.py, etc.).
  - Campaign language via existing `config.get("language")` → map to `en`/`nl`, else `en`.
- **Back-compat:** plain strings resolve unchanged → existing campaigns keep working.
- Commit: `feat(engine): resolve campaign context fields per language (JSON-or-string)`.

## Phase 2 — fieldLocale: aligned options for all dropdowns

- Extend `client/src/features/campaigns/components/settings/fieldLocale.ts`:
  - Add index-aligned `nl` arrays for **`WHAT_LEAD_DID_OPTIONS`** and
    **`SERVICE_OPTIONS`** (en lists already live inline in the section files — move them here).
  - Keep `USP_OPTIONS`/`AI_STYLE_OPTIONS` (already aligned).
  - Add `optionIndex(field, value)` (find a stored value in any language's list) and
    `optionLabel(field, value, lang)` (stored value → label in `lang`) + `optionStore(field,
    label, displayLang, en, nl)` returning `{en, nl}` JSON for a picked option.
- No behavior change yet. Commit: `chore(campaigns): centralize aligned dropdown option maps in fieldLocale`.

## Phase 3 — Frontend display/edit (UI-language dropdowns, campaign-language free-text)

- **New `LocalizedCombo` component** (replaces the datalist-based `EditCombo`; delete
  `EditCombo.tsx` once unused). A real combobox, **not** `<datalist>`:
  - input + a **chevron that opens** a popover list (Radix Popover or a small controlled
    list), styled to **match `EditSelect`** (same chevron, height, `la-input`/`neu-input`
    look) so all dropdowns are visually consistent — fixes the "different chevron / won't
    open" bug.
  - **pick-or-type**: click an option to select, or type a custom value (kept verbatim).
  - keyboard nav (↑/↓/Enter), close on outside-click/Escape, `autoFocus` support.
  - props: `value`, `onChange`, `options` (display-lang list), `placeholder`, `autoFocus`.
- **Wiring** for the four dropdown fields:
  - render options from `OPTIONS[uiLang]` (UI locale via `i18n.language`),
  - show the current value mapped to `uiLang` via `optionLabel(...)`,
  - on change write the field as `{en, nl}` JSON via `optionStore(...)`.
- **BusinessSectionFields / AISectionFields / BehaviorSectionFields**:
  - Dropdowns (usp, ai_style, what_lead_did, service) → `LocalizedCombo`, display = `uiLang`,
    store = `{en,nl}`.
  - Free-text (description, kb, niche_question, ai_role) → display/edit
    `resolveLang(value, campaignLang)`; on change `setLang(value, campaignLang, text)`.
  - `value=` (read display) and `editChild` `onChange` go through the helpers.
- **InfoRow display value** uses the same resolver so cards read correctly.
- Commit: `feat(campaigns): UI-language dropdowns + campaign-language free-text (multilingual fields)`.

## Phase 4 — Generate endpoint: multilingual fill + translate

- **`generateCampaignContext`** (server): return `{en, nl}` for each generated context field
  (one model call producing both, or generate `en` then translate → `nl`). Keep cost low:
  single structured prompt returning both languages.
- **Endpoint** `POST /api/campaigns/:id/generate` (supersede/extend `generate-demo`):
  1. For **empty** scoped fields (empty in *both* langs) → fill `{en, nl}` from `niche`.
  2. For fields **filled in only one** lang → translate to the missing lang.
  3. `niche` optional; required only if step 1 has work. Return `{filledFields, translatedFields}`.
  - Dropdown fields: pick a valid option and store both aligned languages (no free AI text).
- Back-compat: legacy `generate-demo` route kept as alias or updated in the toolbar.
- Commit: `feat(campaigns): generate fills + translates context fields in en+nl`.

## Phase 5 — Generate button UX (icon-only + smart panel)

- **DetailViewToolbar**: button becomes icon-only (`Sparkles`, aria-label/title
  "Generate", no text). Popover:
  - If empty fields exist → show niche input + run (fill + translate).
  - If none empty → hide input, show a single **Translate** action (fills missing langs).
  - Toast reports filled + translated field names.
- i18n: add `toolbar.generate`/`toolbar.translate`/hints to `en`/`nl`/`pt` (Brazilian PT).
- Commit: `feat(campaigns): icon-only Generate with translate-only mode`.

## Phase 6 — Verify + document

- pm2 logs clean; transform-check changed modules. Manual on app.leadawaker.com:
  - Campaign **61 (Dutch)**: USP/AI-style/stage/service read in your **UI** language; free-text
    shows Dutch content; switching the campaign language swaps free-text to the other lang.
  - Generate on a half-filled campaign fills the blanks (en+nl) and translates the rest.
  - Engine: send a test message on a Dutch campaign → prompt contains Dutch USP/role
    (verify via engine logs).
  - Legacy English-only campaign still works unchanged.
- Update `FILE_MAP.md` + memory note. Commit docs.

## Risks / notes

- **Engine is the source of truth for prompt content** — Phase 1 must ship and be verified
  before the frontend starts writing JSON, or a Dutch campaign could feed raw JSON into a
  prompt. Order matters: engine-read tolerant first.
- `pt` campaigns: resolver falls back to `en`/raw; no `nl`/`pt` generation. Acceptable per scope.
- AI cost: one generate now emits two languages — keep to a single structured call.
- Keep `fieldLocale` option lists **index-aligned** or the dropdown mapping breaks.
