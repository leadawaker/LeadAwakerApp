# Campaign Settings — Business Tab Redesign

## Context

The campaign settings tab (`CampaignSettingsLayout.tsx`, reached via `CampaignStageEditor` → `CampaignDetailView`/`MobileCampaignDetailPanel`) renders full-width with no max-width cap, and the Business tab (`BusinessSectionFields.tsx`) has grown a few rough edges: a fixed 3-objection playbook with separate objection/answer boxes, a First Message editor with clunky Edit/Preview text buttons, a hint line under Demo Lead Name that's no longer needed, and a raised wine-styled "AI →" nav button that's visually heavier than it should be. This redesign tightens the layout and reworks these pieces without touching the underlying data model (all fields keep their existing names/DB columns).

`isEditing` is confirmed hardcoded to `true` (`useCampaignDetail.ts:359`) — there is no view/edit mode toggle in practice, every field is always live-editable. The First Message click-to-edit behavior is therefore a new, independent local-state toggle scoped to that one field, unrelated to `isEditing`.

## Changes

### 1. Settings tab max-width + centering

`CampaignSettingsLayout.tsx`'s outer container gets `max-w-[1386px] mx-auto` added (matching the app's existing content-width cap convention), so on wide screens the whole two-column (nav + content card) layout centers instead of stretching edge to edge.

### 2. Demo Lead Name field cleanup

In `BusinessSectionFields.tsx`:
- Remove the `description={t("config.launchNameHint")}` prop from the `InfoRow` — no more helper line under the field.
- Change the `config.launchName` string itself (en/nl) from "Demo lead name" to "Demo lead name (empty = current name)", so the guidance lives in the label instead of a separate hint line.
- Delete the now-unused `launchNameHint` key from both locale files.

### 3. Objection Playbook — dynamic list, shared box, remove button

Replace the fixed `[0, 1, 2].map(...)` rendering with a real dynamic array (1–5 rows):

- **Data:** `objectionRows()` still reads `draft.objection_playbook ?? campaign.objection_playbook`, but instead of always returning exactly 3 slots, it returns the actual stored array, defaulting to a single empty row `[{ objection: "", answer: "" }]` when empty/undefined.
- **Row layout:** each row is one `neu-inset-crisp` container (same visual pattern as `ProfileWizard.tsx`'s Q&A grid, `renderGrid()` lines 454-477): objection `<input>` on top, answer `<textarea>` below, separated by `borderBottom: 1px solid var(--line)` — one shared box instead of two separately-bordered `EditText` fields. Placeholder text keeps its current light/muted color in both halves.
- **Remove button:** rows after the first get an absolutely-positioned `X` icon button (top-right corner, `la-btn la-btn--soft la-btn--icon`, 22×22px, `lucide-react`'s `X` at size 12) — identical pattern to `ProfileWizard.tsx:468-476`. Row 1 never shows a remove button (can't delete down to zero rows).
- **Add button:** below the list, `la-btn la-btn--inset` + `Plus` icon (size 13), label reuses/extends the existing add-button i18n convention. Hidden (or disabled) once the array reaches 5 rows.
- **Delete behavior:** splice-and-renumber — deleting row 2 of 3 shifts what was row 3 up to become row 2 (array `filter`, no gap-preserving logic), matching `ProfileWizard`'s existing remove handler.
- **Placeholders:** extend `OBJECTION_PLACEHOLDER_KEYS` from 3 entries to 5 (`config.objectionPlaceholder` through `objectionPlaceholder5`), adding 2 new example placeholder strings per locale (en/nl) continuing the existing price/competitor/stalling-style examples.
- **Remove the hint line:** delete the `description={t("config.objectionPlaybookHint")}` prop on the Objection Playbook `InfoRow`, and delete the `objectionPlaybookHint` key from both locale files (per explicit instruction — the "Up to 3 objections..." copy goes away entirely, not replaced).

### 4. First Message editor — click-to-edit, blur-to-preview, icon-only Templates button

Current behavior: explicit "Edit Opener"/"Preview" text buttons toggle `rawEditOpen`, plus a "Templates" text button in both states.

New behavior:
- The preview `<div>` (currently just displaying `previewText`) becomes clickable: `onClick` sets a new local `firstMessageFocused` state to `true`, which swaps in the raw-template `<textarea>` (same `EditText` multiline component, autoFocused) in place of the preview text — no separate button needed to enter edit mode.
- The textarea's `onBlur` sets `firstMessageFocused` back to `false`, reverting to the (now-updated) preview. Since `onTextChange` already writes into `draft.First_Message` on every keystroke and the surrounding campaign-detail hook already autosaves `draft` on its existing debounce, blur doesn't need its own explicit save call — reverting the view is sufficient.
- The "Edit Opener" / "Preview" text buttons are removed entirely.
- The "Templates" button becomes an icon-only button (`LayoutTemplate` icon from `lucide-react`, not a pen/edit icon — that's reserved for the in-popup template-row editing which already uses `Pencil`), absolutely positioned top-right of the First Message box (wrapper gets `position: relative`). It's visible in both preview and edit state, one click away at all times.
- `CopyButton` stays but only rendered in edit state, placed bottom-left under the textarea (since the old button row that used to hold it is gone).

### 5. Business tab field reordering

Within `BusinessSectionFields.tsx`'s grid, reorder into a "business info, then interaction" structure:

1. Company name | Demo Lead Name
2. Service | USP
3. Knowledge Base (full width)
4. First Message (full width)
5. Agent name | AI Conversation Style
6. Objection Playbook (full width, last)

No field is removed or changed in data terms, only render order.

### 6. "AI Style Override" → "AI Conversation Style" label rename

Change the display string only: `config.aiStyleOverride` value changes from "AI Style Override" to "AI Conversation Style" (en) and the nl equivalent. Internal variable/prop/DB names (`ai_style_override`, `AI_STYLE_OPTIONS`, etc.) are untouched.

### 7. Bottom "AI →" nav button de-emphasized

In `CampaignSettingsLayout.tsx`'s Prev/Next footer, the `Next` button (currently `la-btn la-btn--wine`, raised with `--sh-raised-crisp` shadow) becomes a transparent-background button: no box-shadow, no border, colored text (mono-uppercase, matching existing typography) that shifts on hover. It remains a real `<button>` element for accessibility/click-target purposes, just stripped of the wine "raised CTA" chrome. The center "Launch Campaign" WhatsApp button and the "← Prev" button are untouched.

## Out of scope

- No changes to `AISectionFields.tsx` or `BehaviorSectionFields.tsx` content/order.
- No changes to the `OpenerTemplatePicker.tsx` popup's own internals (its `Pencil` edit-row icon stays as-is).
- No backend/schema changes — `objection_playbook` is already a JSON array column; only the client's fixed-3 rendering assumption changes.
- No changes to mobile/`compact` layout beyond what naturally follows from the reordered grid (still responsive, no new compact-only logic needed).
