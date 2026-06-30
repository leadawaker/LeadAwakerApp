# Contacts Table + Interactions Model (Slice 2)

**Status:** In Progress — 2a (cosmetics/labels/mobile nav), 2b (pagination+fold), and
2c (sort/filter/group expansion + Service dimension) BUILT. Contacts-page detail rework
BUILT (summary-first, Contact card hidden for clients, Notes at bottom, Created in header,
Mark-served hidden on Contacts). **Deferred from 2c:** the optional "Service" *column* in
`LeadsInlineTable`'s column-visibility menu (group-by-Service + filter-by-Service shipped;
the column itself is the only spec-"optional" piece left). Remaining: 2d (client page model).
**Date:** 2026-06-26
**Follows:** [`specs/conversations-contacts-split/requirements.md`](../conversations-contacts-split/requirements.md) (Slice 1 = page split + nav, BUILT).
**Touches:** `LeadsInlineTable` (table view), `LeadDetailView` (right panel), `LeadsTable`
(mode wiring), `RightSidebar` (mobile nav), routing, i18n.

This slice covers everything raised in the 2026-06-26 review: the client-facing
**Interactions** page, the **Service** dimension + a full sort/filter/group set on the
Contacts table, four table bugs/cosmetics, the right-panel glass removal, and mobile nav.

---

## 1. Naming & page model

| Audience | Page | Label | Shows |
|----------|------|-------|-------|
| Owner / Admin | the chat workspace | **Chats** | full chat balloons |
| Client | the same workspace | **Interactions** | **summaries only** (no balloons), as today |
| Owner / Admin | the directory | **Contacts** | Table + Pipeline |
| Client | the directory | **Contacts** | Pipeline-first (privacy-safe: cards show summary + score, never balloons) |

- Rename the page formerly specced as "Conversations" → **Chats** (owner/admin). Same
  route `/platform/conversations` (keep the route id; only the label changes), or rename
  to `/platform/chats` with a redirect (decide at build; label change is the user-visible ask).
- **Clients are no longer gated out** of this page (reverses Slice-1's agency-only gate).
  Clients see it titled **Interactions** and get the summary view that already exists for
  them. The permission layer (balloons vs summary) is the existing client behaviour, now
  surfaced as its own page instead of being hidden.
- **Future / open:** for some services (e.g. Speed-to-Lead) we may show clients the *real*
  chat, not just a summary. Per-service visibility flag — not built this slice, noted so the
  visibility layer is designed to be per-`campaign_type`, not a single global on/off.

### Client Contacts page — DECIDED
Clients get **both** Interactions and Contacts on **desktop**; Contacts defaults to **Pipeline**
(not Table). On **mobile**, clients get **Interactions only** — no separate Contacts tab (the
mobile view's built-in list/kanban toggle still reaches the pipeline from within Interactions).

---

## 2. Service dimension (the "missing service section")

A contact's **service = its campaign's `campaign_type`** (Reactivation, Speed-to-Lead,
Missed-Call, AI-widget, …). Surface it as a first-class axis in the Contacts table:

- **Column:** optional "Service" column (in the column-visibility menu).
- **Group by:** Service.
- **Filter by:** Service (multi-select; only services the account has activated — see Slice-1 §6 gating).
- **Sort:** not primary, but Service can be a group order.

Data: leads don't carry `campaign_type` directly; derive it via the lead's campaign →
`campaignsById`. Extend the campaigns fetch in `LeadsTable` to include `campaign_type`
(today it stores `{ name, accountId, bookingMode }`; add `campaignType`).

---

## 3. Full sort / filter / group set ("everything sensible")

Current table only offers: sort {recent, oldest, name, score}; filter {status, account,
campaign}; group {status, campaign, account, none}. Expand to:

| Axis | Options |
|------|---------|
| **Sort** | Recent · Oldest · Name A–Z / Z–A · Score ↑/↓ · **Last activity** · **Created date** |
| **Filter** | Status · **Service** · **Source** · **Tags** · Account · Campaign · **Has phone** · **Has email** · **Score range** (e.g. ≥70) |
| **Group** | Status · **Service** · **Source** · Campaign · Account · **Tag** · None |

- "Last activity" = `last_interaction_at` / `last_message_received_at` fallback chain
  (already used elsewhere in the file).
- Source = `l.source`. Tags = existing `leadTagsInfo`. Score range = numeric ≥ threshold.
- Reuse `buildEntityRows()` (already the table's engine) — these are mostly new
  `comparator` / `predicate` / `groupKeyOf` branches + new dropdown entries, not new plumbing.
- Keep persisted prefs (`TABLE_PREFS_KEY`) back-compatible (additive keys).

---

## 4. Table bug fixes & cosmetics

All in `LeadsInlineTable.tsx`.

1. **Frozen column overlap (bug).** Sticky cells fall back to `transparent` when a row is
   neither hovered nor selected (`rowBg = isHighlighted ? card : var(--row-bg, transparent)`,
   ~line 832), so right-scrolled columns show *through* the frozen Name column + its toggle.
   **Fix:** sticky cells (checkbox + Name) get an **always-opaque** background matching the
   row/table surface (and the select-all/Name header cells likewise), so sliding columns are
   hidden beneath them. Verify in both light and dark.

2. **Group fold + pagination (bug).** Pagination counts lead items across *all* groups
   including collapsed ones (`paginatedItems` loop, ~lines 677–699), while collapsed groups
   are skipped at render (~line 818). Folding "New" (page-1 leads) leaves page 1 visually
   empty and later groups never appear. **Fix:** paginate over **visible** lead items only —
   exclude collapsed-group leads from the page index/count (and from `totalPages`), so folding
   re-flows the pages.

3. **Group header colour.** Headers use a desaturated gray-blue tint (`hexToTint`, ~line 25 →
   `groupBg`). **Fix:** use the **normal neutral background** (current `var(--bg)` / surface
   token), not the tint — flat and quiet, matching the rest of the table.

4. **Pagination footer colour.** Footer is `bg-muted` (~line 1105). **Fix:** match the
   **table background** (the surface the user likes — same token the table body sits on), so
   the footer reads as part of the table.

---

## 5. Right panel — remove glass on the AI-summary mini-panel

The selected-lead right panel is otherwise fine. The Conversation / AI-summary container uses
`glass-strong` (`LeadDetailView.tsx` ~line 424). The mobile version reads better without it.
**Fix:** drop the glass treatment on this mini-panel; use the plain card/surface (flat),
matching mobile. (Per memory: never add `position` to `.glass`; here we're *removing* the
glass class entirely, which is safe.)

---

## 6. Mobile navigation

Bottom bar + "More" page (`RightSidebar.tsx` mobile section + `MobileMorePage`).

1. **Home button on the left of the bottom bar.** Add Home as the left-most bottom-bar tab
   (it currently lives elsewhere). Re-balance the 5 slots.
2. **Contacts in "More".** Add a Contacts entry to the mobile More menu (the bottom bar has no
   room for it on desktop-parity). Owner/admin only if §1 keeps Contacts agency+client; for
   clients it's omitted (their Interactions page is their contacts).
3. **Clients:** Interactions is the primary tab and *is* their contacts — no separate Contacts
   tab or More entry for clients.

Proposed client bottom bar: `Home · Interactions · Calendar · Accounts · More`.
Proposed agency bottom bar: `Home · Chats · Calendar · Tasks · More` (Contacts via More).

---

## 7. Build slices (proposed sequencing)

- **2a — Quick wins (low risk):** group-header colour, footer colour, frozen-column opacity,
  glass removal, Chats/Interactions label, mobile Home button. Mostly cosmetic/1-liners.
- **2b — Pagination + fold fix:** the one real logic bug; isolated to `paginatedItems`.
- **2c — Sort/filter/group expansion + Service dimension:** the meaty build; additive branches.
- **2d — Client page model:** Interactions page for clients + Contacts decision (§1) + mobile
  More/Contacts gating.

## 8. Open items
1. Client Contacts page (§1) — confirm "both on desktop, Interactions-only on mobile".
2. Route id: keep `/platform/conversations` (label only) vs rename to `/platform/chats`.
3. Per-service client chat visibility (§1 future) — design later.
4. Activated-services gating of the Service filter/column (depends on Slice-1 §6, not built).
