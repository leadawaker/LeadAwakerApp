# Clients tab: autosave, entry actions, categorized grid, emoji

Date: 2026-08-12
Status: approved, ready for planning

## Problem

The Clients tab (Campaigns → Clients, `ClientsTab.tsx` / `ClientEditor.tsx`) is the
saved demo-persona library ("a Client IS a `Niche_Vocabulary` row"). Three things
are wrong with it today:

1. Editing a Client requires clicking Save, and the only way to delete one is a
   button buried in the editor's own header — inconsistent with the rest of the
   app, where campaign settings already autosave.
2. The grid is a flat, unsorted `auto-fill` of cards. With 23+ niches (and
   growing) there's no way to scan it — "impossible to find anything."
3. A card shows only its friendly label and company name. The niche key, the
   row id, and any visual distinctiveness (an emoji) are invisible, so two
   similarly-labeled Clients are hard to tell apart at a glance.

## Scope

Touches: `ClientEditor.tsx`, `ClientsTab.tsx`, `CampaignListView.tsx`,
`demoClientsApi.ts`, `server/routes/demo.ts`, `server/demo-clients.ts`,
`server/demo-session.ts`, `shared/schema.ts`, a new
`migrate-demo-client-category-emoji.js`, and a live update to Prompt_Library row
`universal_demo_niche_generator`.

Out of scope: the separate "New niche…" creator used by Campaign Settings'
`NicheSelect` (`server/nicheGenerator.ts`, Prompt_Library row
`niche_row_generator`). That path is for the discovery-demo picker, which is
being phased out — it keeps working exactly as it does today, with no
emoji/category.

## 1. Autosave

`ClientEditor.tsx` currently holds `text`/`terms` in local draft state, a
`dirty` flag, and a Save button that calls `update.mutate(...)`. Replace this
with the same debounced-autosave shape already proven in
`useCampaignDetail.ts` (campaign settings, "1.5s debounce, no Save button"):

- On any draft change, (re)start a 1.5s timer; on fire, PATCH if the draft
  still differs from the last-saved snapshot.
- Flush the pending save immediately when the component unmounts or the
  `niche` prop changes (switching to another Client), mirroring
  `useCampaignDetail`'s `prevCampaignIdRef` flush-on-switch logic — otherwise a
  same-session edit made right before navigating away is silently lost.
- Replace the Save button with the same subtle "Saving…" indicator
  (`RefreshCw` spin + text) used in `DetailViewToolbar.tsx`, shown next to the
  header title.
- The Delete button in the editor's own header is removed entirely (see §2).

## 2. Topbar "..." menu (Duplicate / Delete)

`CampaignListView.tsx`'s full-width desktop topbar (the one that already shows
`ShareButton` for demo campaigns, line ~654) gets a `MoreHorizontal` icon
button immediately to its left. It only renders when:

- `detailTab === "clients"`, and
- a specific Client is open in the editor (not the bare list).

This requires lifting "which Client is open" out of `ClientsTab`'s local
`useState` up into `CampaignListView`, passed down as a controlled prop
(`selectedClientNiche` / `onSelectClient`), the same way `selectedCampaign` is
already managed.

Clicking it opens a `DropdownMenu` (the same component already used for the
Filter/Sort buttons on this exact topbar) with two items:

- **Duplicate** (`Copy` icon) — always available.
- **Delete** (`Trash2` icon, destructive style) — only shown when the open
  Client has `isDemoClient: true`, same gate `ClientEditor` uses today. Clicking
  it opens the existing `ConfirmDelete` dialog (unchanged), just triggered from
  here instead of the old header button.

## 3. Duplicate

Clicking Duplicate opens a small inline prompt for the new Client's `niche`
(the unique key — there's no rename field today, so a copy needs a name up
front).

New endpoint:

```
POST /api/demo/clients/:niche/duplicate
Body: { newNiche: string }
```

`requireAgency`, mirrors the existing PATCH/DELETE routes in
`server/routes/demo.ts`. Server-side (`server/demo-clients.ts`):

- 404 if the source niche doesn't exist.
- 409 if `newNiche` (trimmed) already exists.
- Otherwise inserts a new row keyed on `newNiche`, copying every text field,
  every term-group column, `bookingModeCall`, `category`, and `emoji` from the
  source — always with `isDemoClient: true`, even when the source is a curated
  (non-deletable) row. That's deliberate: duplicating a curated niche pack is
  how you'd get an editable, deletable copy of it.

On success: invalidate the Clients list query and open the new Client.

## 4. Combined title

Both the editor header and each grid card currently show only a fragment of a
Client's identity (editor: bare `niche`; card: `label` as title, `companyName`
as subtitle). Both become one line:

```
{emoji} {niche} — {label} — {companyName} — #{id}
```

with graceful omission:
- Drop the `— {label}` segment when `label` (which already falls back to
  `niche` server-side, see `pick(...) || r.niche` in `listDemoClients`) equals
  `niche` — otherwise a Client with no custom label reads as
  "kitchens — kitchens — ...".
- Drop the `— {companyName}` segment when empty.

`EditableDemoClient` (the shape `ClientEditor` fetches) doesn't currently
carry `label`/`companyName` as top-level fields — only per-language
`text.nicheLabel` / `text.companyNameTemplate`. `demoClientToEditable()` gains
`label`/`companyName` computed the same way `listDemoClients()` already does
(`pick(..., "en") || niche`), so the editor doesn't reimplement the
language-fallback logic.

## 5. Category + emoji — schema

`Niche_Vocabulary` is a NocoDB-managed Postgres table
(schema `p2mxx34fvbf3ll6`). This codebase's established way to extend it is a
standalone script using raw SQL (`migrate-demo-client-persona-columns.js`
is the precedent — `npm run db:push` needs a TTY the Pi doesn't have for this
table). New script `migrate-demo-client-category-emoji.js`:

```sql
ALTER TABLE "p2mxx34fvbf3ll6"."Niche_Vocabulary" ADD COLUMN IF NOT EXISTS category text;
ALTER TABLE "p2mxx34fvbf3ll6"."Niche_Vocabulary" ADD COLUMN IF NOT EXISTS emoji text;
```

Both nullable, no default — an unset Client is simply "Uncategorized" (§7),
not an error state. Declared in `shared/schema.ts` (`category: text("category")`,
`emoji: text("emoji")`) to match, following the existing column-then-script
order in that file.

## 6. Backfill

The same script backfills every one of the 23 existing rows (confirmed live via
a direct query against `Niche_Vocabulary`, excluding `__default__`). Taxonomy
grounded in what's actually there today, not invented in the abstract:

| Category | Niches |
|---|---|
| **Home & Trades** | Doors and Windows company 🚪, General Contracting 🏗️, Landscaping 🌳, loft conversions 🪜, loft insulation 🌡️, orangeries and garden rooms 🏡, Roofing 🏠, Windows & Doors 🪟 |
| **Kitchens & Interiors** | Bathrooms 🛁, Countertops 🪨, Flooring 🪵, Interior Design 🛋️, Kitchens 🍳, Painting 🎨 |
| **Climate & Energy** | HVAC ❄️, solar energy installer ☀️, solar energy installer uk ☀️, solar energy installer us ☀️, Solar Panels ☀️ |
| **Home Services** | Moving Services 📦, Pest Control 🐜, Pool Installation 🏊 |
| **Wellness & Leisure** | Amusement Park 🎡, Wellness 🧘 |

The script only sets `category`/`emoji` when the column is currently `NULL`
(`WHERE category IS NULL`), so it's safe to re-run and never overwrites a
manual edit made between authoring this script and running it.

## 7. Editing category + emoji, and grouping

`ClientEditor` gains two small fields near the header (not buried in the long
Persona section, since these are identity attributes like `nicheLabel`):

- **Category**: a creatable `Select`, mirroring the inline-create pattern
  already used by `NicheSelect.tsx` (a dropdown listing every distinct
  category currently in use, plus a "New category…" row at the bottom). Unlike
  `NicheSelect`, this needs no server round-trip to "create" — typing a new
  value just sets the field; it becomes a selectable option for the next
  Client the moment this one saves.
- **Emoji**: a plain text input (1-2 grapheme clusters).

`ClientsTab` groups the filtered card list by `category` using the existing
`GroupHeader` primitive (the same one Leads/Tasks use for their grouped
views), sorted alphabetically by category name, with an "Uncategorized"
section last for any row with a null category. Search continues to filter
across all groups (a group with zero matches after filtering is simply not
rendered). No separate filter/quick-jump control — grouping is the fix for
"impossible to find anything."

## 8. Generator prompt update (Clients persona minter only)

`generateNicheContext()` (`server/demo-session.ts`) is the model call behind
minting a demo persona (Share dialog / `/generate`), backed by Prompt_Library
row `universal_demo_niche_generator` with an in-file fallback constant
(`NICHE_GENERATOR_SYSTEM_FALLBACK`) — both must be updated together, per this
codebase's known gotcha that the DB row is the actual source of truth in
production and the in-file copy only fires if that read fails.

Changes:

- The JSON contract gains two keys: `emoji` (one representative emoji) and
  `category` (a short category name).
- Before the request is sent, `generateNicheContext()` queries the distinct
  non-null `category` values currently in `Niche_Vocabulary` and appends them
  to the system prompt as a preference list: reuse one of these if it
  genuinely fits the niche; only invent a new one if none do. This keeps
  AI-assigned categories from fragmenting the taxonomy seeded in §6 (e.g. a
  new "dental implants" niche should not invent "Dental" when "Health &
  Wellness" — if that's what's live at generation time — already fits).
- `NicheContext` gains optional `emoji`/`category` fields; the response parser
  extracts them the same way it already extracts the other ~20 keys.
- `saveDemoClient()` writes `emoji`/`category` onto the row **only if the
  column is currently null** — re-picking/re-generating an existing Client (a
  documented saveDemoClient behavior: it's an upsert that merges new content
  in) must never clobber a value a human already set in the editor.
- The live Prompt_Library row is updated to match the new fallback text, not
  just the in-file constant — otherwise nothing changes in production (per
  the "Prompt Library is source of truth" project convention).

## Data flow summary

```
Mint a demo  →  generateNicheContext()  →  { ...persona, emoji, category }
                                          →  saveDemoClient()  →  Niche_Vocabulary row
                                                                   (emoji/category only if null)

Duplicate    →  POST /clients/:niche/duplicate  →  copies emoji/category verbatim

Manual edit  →  ClientEditor autosave  →  PATCH  →  updateDemoClient()  →  row
```

## Explicitly not building

- No filter/quick-jump control next to search (grouping alone, per decision).
- No category/emoji support in the Campaign Settings "New niche…" flow
  (`nicheGenerator.ts` / `niche_row_generator`) — out of scope, that flow feeds
  the discovery-demo picker being phased out.
- No emoji picker UI (plain text input) — an emoji picker component doesn't
  exist in this codebase yet and isn't worth introducing for a ~24-row list.
