# Multilingual Campaign Context Fields — Requirements

## Goal

Campaign context fields should hold **both English and Dutch** versions. The value
**sent to the prompt** is always in the **campaign's language** (so the Dutch AI gets
Dutch text, not "translated English"), while the **dropdown labels an operator reads**
follow the **CRM UI language**. The **Generate** button fills empty fields from a niche
*and* translates fields that exist in only one language into the other.

Driver: Finn screenshares the setup with Dutch clients. The operator must read the form
in their own UI language while the campaign still feeds the AI the right-language content.

## Decisions (confirmed with Gabriel)

- **Languages: English + Dutch only** (`en`, `nl`). Portuguese campaigns keep
  single-language behavior for now; the model must not break for `pt`.
- **Storage: JSON-per-field.** Each context field stores `{"en": "...", "nl": "..."}`.
  Stored **inside the existing `text` columns as a JSON string** → **no DB migration**
  (important: `npm run db:push` can't run on the Pi). Legacy plain-string values stay
  valid and migrate to JSON on first edit/generate.
- **Spec first**, then implement in **committed stages** (work-loss history → never leave
  large changes uncommitted).
- **Generate button → icon-only** (Sparkles, no "Generate" word). Click opens the panel;
  type a niche → AI fills only the **empty** fields (in both languages) **and** translates
  any single-language fields into the other. If there are **no empty fields**, the niche
  input is hidden — pressing the button just **translates**.

## Field scope

**Context fields that become multilingual** (`{en, nl}` JSON):

| Field (db) | UI label | Type |
|---|---|---|
| `campaign_usp` | USP | dropdown (enum) |
| `ai_style_override` | AI Style | dropdown (enum) |
| `what_lead_did` | Stage of Sales Process | dropdown (enum) |
| `service_name` | Service | dropdown (enum) |
| `description` | Business Description | free-text |
| `kb` | Knowledge Base | free-text |
| `niche_question` | Niche Question | free-text |
| `ai_role` | AI Role | free-text |

**Explicitly excluded** (stay as-is): `first_message`, `bump_*_template` (engine
translates the opener downstream — per `fieldLocale.ts` doc), `agent_name`,
`company_name`, `inquiry_timeframe`, `inquiries_source` (language-neutral), and the
`language` dropdown itself (already shows friendly labels).

## Display rules

- **Dropdown fields** (usp, ai_style, what_lead_did, service): the picker shows options
  in the **UI language**; selecting stores **both** `en`+`nl` values via the
  index-aligned option maps in `fieldLocale.ts`; the card shows the value in the **UI
  language** label. Prompt receives the **campaign-language** value.
- **Free-text fields** (description, kb, niche_question, ai_role): display/edit the
  **campaign-language** variant (it's authored content, not a label). Both variants are
  stored; Generate/Translate fills the other. Prompt receives the campaign-language variant.

> Open confirm (see action-required.md): free-text shows the *campaign-language* variant
> rather than the UI-language one. Translating arbitrary business prose to the UI locale
> just for display would be misleading/expensive, so we show the real stored content.

## Dropdown UX (fix in this work)

- The current localized dropdowns (USP, AI Style — wired today with `EditCombo`) use a
  native HTML `<datalist>`: the **chevron looks different** from the other selects and
  **clicking it doesn't open the options**. Replace `EditCombo` with a **proper combobox**:
  - clicking the field/chevron **opens the suggestion list**,
  - chevron + styling **match `EditSelect`** (consistent look across all dropdowns),
  - the user can still **type a custom value** (pick-or-type),
  - keyboard + click selection, closes on outside-click/Escape.
- **Extensibility:** option lists live only in `fieldLocale.ts` (one place per field, aligned
  `en`/`nl`). Adding more options = appending to those arrays — no component changes. Gabriel
  plans to grow these lists.

## Behavioral requirements

1. **No data loss / backward compatible.** Existing campaigns (plain-string fields,
   English) keep working in the CRM and the engine. A plain string is treated as the value
   for *both* languages until translated; on next save it becomes `{en, nl}`.
2. **Engine correctness.** `ai_conversation.py` and any other readers must resolve a field
   to the campaign-language string, accepting either a legacy plain string or `{en, nl}`
   JSON. Default to `en`, then the other language, then raw string.
3. **Dropdown options stay index-aligned** across `en`/`nl` in `fieldLocale.ts` so a
   selection maps 1:1 between languages. `what_lead_did` and `service_name` need new
   aligned `nl` option arrays added.
4. **Generate** (one action): empty fields → AI-generate `{en, nl}` from the niche;
   single-language fields → translate to fill the missing language. Niche optional when
   nothing is empty.
5. **Brazilian PT** is unaffected for now (single-language path preserved).

## Out of scope (this iteration)

- Portuguese multilingual storage/generation.
- Translating the immutable opener / bump templates.
- A standalone "translate everything" batch tool beyond the Generate button.
