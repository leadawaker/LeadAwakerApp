# Lead Awaker CRM: UI Standards

> The source of truth for every UI change in the CRM: what to use and what never to do. Exact
> markup and props live in [`UI_PATTERNS.md`](UI_PATTERNS.md). If code and this file disagree,
> check `client/src/styles/` and `client/src/components/crm/primitives/`, then fix whichever is wrong.
> The marketing site (`client/public/site/`, `client/public/premium/`) is not the CRM.

Goal: one consistent UI. Every page is built from the same few parts, so a new page looks like it
was always there. Calm, warm, data-dense: wine accent on warm paper, soft neumorphic depth.

---

## 1. How to build a page (checklist)

1. **Shell.** Outer div `.la-page`. Header is `<PageTopbar>`. Never hand-write a header bar.
2. **Topbar parts, left to right:** title (same i18n key as the nav label), optional `count`,
   then `left`: the `PillSwitch` (work | Settings on Calls and Chats), `TopbarTabs` for views,
   the list fold button. Then `right`: selection actions, `ExpandingSearch`, `TopbarIconButton`
   menus, and the wine `+` (`TopbarIconButton primary`) last.
3. **List?** List panel on the left, `w-full lg:w-[var(--toolbar-w)] lg:shrink-0`, scrolling in
   `.la-list-area > .la-cards`. Rows are Chats-style cards: `.la-camp-card` plus `.active` when
   selected. Minimizing uses `useListPanelState` and the `CompactEntityRail` parts.
4. **Sections?** Use `SectionLayout` + `SectionRail` + `SectionHeader` (side tabs), as in Settings and Accounts.
5. **Create or edit?** A right-hand panel (or a `MobileSheet` on phones). No `Dialog`.
6. **Width.** List page: `max-w-[1386px] mr-auto` on the outer flex child. Single-column page:
   `.la-page-center` on the content column inside the scroll container.
7. **Colors and depth** only from tokens and the `neu-*` utilities. Check the page in dark mode.
8. **Phone.** Check below 768px. Mobile changes are additive and respect safe-area insets.
9. **Strings.** Every visible string, `aria-label`, `title` and placeholder goes through `t()` in en, nl and pt.
10. **Where does it live?** One home per thing (section 6). Don't add a second place to open a lead.

---

## 2. Tokens

### 2.1 Where they live

| File | Holds |
|------|-------|
| `client/src/styles/variables.css` | **Every color**, light and dark (`:root` and `:root.dark`). The only file allowed to define a color. |
| `client/src/styles/design-system.css` | Geometry: radius tiers, spacing, shadow shapes (`--sh-*`), type classes, component classes (`.la-btn`, `.la-seg`, `.la-page`...). Never a color value. |
| `client/src/styles/neu.css` | Neumorphic surface utilities (`.neu-raised`, `.neu-inset`, `.glass`...). |
| `client/src/styles/tokens.css` | Maps tokens into Tailwind (`bg-card`, `text-primary`, `bg-popover`, `text-muted-foreground`...). |
| `client/src/styles/components.css` | Shared list classes (`.la-list-area`, `.la-cards`, `.la-camp-card`, `.la-mono-tile`). |

**The dials** at the top of `variables.css` drive everything: `--brand-h/-s/-l` (deep wine `#5E2230`
in light, brightened `#B14A5C` in dark) and `--ground-h/-s` with `--ground-page/-panel/-chrome`
(the warm paper grounds). A rebrand is a change to the dials, not to components.

**Two formats, never mixed:**
- Channel triples (`--background`, `--primary`, `--muted`, `--border`, `--foreground`...): use as
  `hsl(var(--primary))`, `hsl(var(--primary) / 0.2)` or the Tailwind class (`bg-primary`).
- Full colors (`--bg`, `--surface`, `--card`, `--wine`, `--ink`, `--line`...): use as `var(--wine)`.
  `hsl(var(--wine))` is a bug.

### 2.2 Color roles

| Token | Use |
|-------|-----|
| `--bg` / `bg-background` | Page ground (very light warm paper). Also the fill of inset wells. |
| `--surface` | Topbar, toolbars, list panels, raised chips and soft buttons. |
| `--bg-2` / `--chrome` | Nav rail. `--chrome-deep` and `--chrome-deep-ink` for phone chrome. |
| `--card` / `bg-card` | White cards: the selected list card, detail sections, tiles. |
| `--muted`, `--bone`, `--input` | Secondary fills, writing surfaces, input fills. |
| `--line`, `--line-strong` | Hairlines and dividers. Prefer depth over borders. |
| `--ink`, `--ink-soft`, `--mute`, `--mute-2` | Text: primary, secondary, muted, tertiary (or `text-foreground`, `text-muted-foreground`). |
| `--primary`, `--wine` | The brand accent: active states, links, focus, the one primary action. |
| `--wine-soft` | Hover on wine. |
| `--wine-tint`, `--wine-glow` | 8% and 18% wine washes: hover, applied filters, emphasis. |
| `--wine-grad` | The one primary-action gradient (`.la-btn--wine`). |
| `--on-wine` | Text and icons on a filled wine surface. |
| `--good`, `--warn`, `--destructive`, `--success` | Status. `--good-tint`, `--warn-tint` for soft backgrounds. |
| `--highlight-active/-selected/-hover` | Warm amber tints. Legacy selection color; don't use for list cards. |
| `--stage-new` ... `--stage-dnd` | Pipeline stages, the source of truth. In JS use `PIPELINE_HEX` (same values, for charts that need hex) and `getLeadStatusAvatarColor` from `lib/avatarUtils.ts`. Change both together. |
| `--sand` | An ochre for palettes that need one (studio tags). Not a stage. |
| `CAMPAIGN_STATUS_HEX`, `ACCOUNT_STATUS_HEX` | Campaign and account status colors (`lib/avatarUtils.ts`). |
| `--chart-1` ... `--chart-5`, `--chart-wine` | Chart series. `--chart-wine` is the wine that reads as a data mark. |

**Dark mode is live** (warm charcoal). `useTheme` toggles `<html class="dark">`; colors switch in
`variables.css` and shadow shapes in `design-system.css`. Anything that bypasses tokens breaks
in dark mode, so check every new surface in both themes.

**Retired:** the indigo/blue and yellow palettes. `--brand-indigo` (and the other `--brand-*`
names) still exists only as an alias that resolves to wine. New code uses `--primary`.

### 2.3 Radius and spacing

Radius tiers: `--r-flush` 6px (wells, tracks), `--r-button` 8px (buttons, chips), `--r-surface` 11px
(seg tracks, balloons), `--r-card` 16px (cards and panels with a header), `--r-panel` 22px (hero bands,
largest floating surfaces), `--r-pill` 999px (pills, round buttons, `rounded-full`).
List cards use `--list-card-radius` (12px). The shadcn `--radius` is 24px and `rounded-sm/md/lg/xl`
all resolve to it on purpose. Never invent a radius in px.

Spacing scale (8px base): `--space-xxs` 4, `--space-xs` 8, `--space-sm` 12, `--space-md` 16,
`--space-lg` 20, `--space-xl` 24, `--space-xxl` 32, `--space-section` 80 (editorial bands only).

### 2.4 Depth (neumorphic shadows)

Depth comes from shadows, not borders. Use the utilities or the tokens, never Tailwind `shadow-*`.

| Utility (`neu.css`) | Token | Use |
|---------------------|-------|-----|
| `.neu-raised-crisp` | `--sh-raised-crisp` | Small raised things: selected card, soft buttons, chips |
| `.neu-raised` | `--sh-raised-medium` | Standard panels, `SectionRail` |
| `.neu-raised-large` | `--sh-raised-large` | Hero bands, big floating surfaces |
| `.neu-inset-super-crisp` | `--sh-inset-super-crisp` | Shallowest well: seg tracks, small icon wells, tags |
| `.neu-inset-crisp` | `--sh-inset-crisp` | Inputs, the open search field, pressed states |
| `.neu-inset` | `--sh-inset-medium` | Deeper wells |
| `.neu-polished`, `.neu-polished-large` | `--sh-polished-*` | Hero surfaces with a lit edge, the active nav item |
| `.glass`, `.glass-strong` | | Overlays only: phone sheets, profile menu, tweak panels |

Raised sits above the ground, inset is pressed into it. The shadow colors (`--neu-dark`, `--neu-light`)
switch for dark mode by themselves. Popovers and menus use the solid `bg-popover`, not glass.

### 2.5 Typography

| Role | Face | How |
|------|------|-----|
| Body and UI text | Manrope | `font-sans` / `var(--sans)` (the default) |
| Headings and titles | Manrope bold | `h1` to `h6` get `font-heading font-bold tracking-tight` from `base.css` |
| Labels and data | Geist Mono | `var(--mono)`, `.eyebrow`, `.eyebrow-sm`, and built into `.la-btn`, `.la-seg-btn`, `.la-status` |

- **No serif in the CRM** (decided 2026-10-15). `--serif`, `--display`, `.serif` and `.display` are
  legacy aliases that render Manrope. Don't use them in new code. The font imports still load
  other faces (Playfair Display, Instrument Serif, Yeseva One): never use them in the CRM.
- Page titles: one size, 20px, rendered by `PageTopbar`. Card names and widget titles: see UI_PATTERNS §25.
- Mono is for eyebrows, labels, timestamps, counts, IDs, status pills and compact buttons. Not for sentences.

### 2.6 Motion

- Never `transition-all`. Name the properties: `transition: background-color 150ms, color 150ms`.
  Hover and press take 120 to 180ms, panels and sheets about 250ms.
- Animate `transform` and `opacity`, not layout (`width`, `height`, `margin`). The app runs on a Raspberry Pi.
- List entrance: `animate-card-enter` (or `animate-fade-in` on virtualized rows). Card selection scrolls smoothly (UI_PATTERNS §29).

---

## 3. Components

Import primitives from `@/components/crm/primitives`. Markup and props: UI_PATTERNS §0, §13, §17.

### 3.1 The topbar

| Part | What it is |
|------|------------|
| `PageTopbar` | The 60px `.la-page-header` bar: `title`, `count`, `left`, `right`, `desktopOnly` (when the page has its own phone header), `scroll` (crowded bars on phones). |
| `PillSwitch` | Round pill switch for page modes: Calls \| Settings, Chats \| Settings, Live \| Demo. Examples: `CallsPageTabs`, `ChatsPageTabs`. |
| `TopbarTabs` | View tabs inside the work area (`la-seg` track, mono items, 13px icons). |
| `ExpandingSearch` | The one search: a 36px round icon that opens into a pill field. `TranscriptSearch` (Calls) and the Leads `TopbarSearch` wrap it. Never add another search control. |
| `TopbarIconButton` | Icon action: soft `la-btn la-btn--icon` with tooltip, `active` (wine dot when a filter, sort or group is set), `primary` (the wine `+`), `danger`. |

Menus opened from the right side use `align="end"`. Phone headers use `MobileListHeader` and may keep their own pattern.

### 3.2 Tabs and switches

- Page modes: `PillSwitch`. Views: `TopbarTabs`. Section menus down the side: `SectionRail` (3.6), never a hand-made menu.
- Inside a panel, a hand-written `.la-seg` with `.la-seg-btn` items (`.on` for the active one) is fine.
  Modifiers: `--pill`, `--fill`, `--lg`, `--touch` (readable, 36px-tall items on phones).
- Page tabs and section rails remember the last tab per user: `useLastTab` (`hooks/useLastTab.ts`, on `lib/lastTab.ts`).
  A link's `?tab=` / `?section=` wins; a stored tab the user may not see falls back to the default.
- A page-level account picker (agency) sits in the topbar right after the tabs, never in a row above the content.
  Calls and Chats > Settings portal it there through `ReceptionistSettings`' `pickerSlot`.

### 3.3 Buttons

`.la-btn` plus one surface modifier, plus optional shape modifiers (`design-system.css`):

| Class | Use |
|-------|-----|
| `.la-btn--wine` | The one primary action per view. |
| `.la-btn--soft` | Secondary actions. Add `.on` for an applied filter or a toggled state. |
| `.la-btn--inset` | Recessed utility button on the ground. |
| `.la-btn--plain` | Text-only wine button. |
| `.la-btn--icon` | Icon-only square, 32px. `TopbarIconButton` uses it. |
| `.la-btn--lg`, `.la-btn--pill` | Larger label; fully round corners. |

- **Interactive circles are 36px** (`h-9 w-9`), with 16px icons (`h-4 w-4`). No sm/md/lg variants.
  For a round icon-only button outside the topbar use `IconBtn` (`components/ui/icon-btn.tsx`).
  Square icon actions (`.la-btn--icon`) stay 32px. Never make them round (`la-btn--icon la-btn--pill`).
- Every clickable thing has hover, focus-visible (the global `--ring` outline), active and disabled states.

### 3.4 The list card (Chats behaviour)

One list card everywhere: **flat until selected.**
- Markup: `.la-camp-card`, plus `.active` on the selected row, inside `.la-list-area > .la-cards` (3px gap).
- At rest: transparent, `--wine-tint` on hover. Selected: `--card` white, `--sh-raised-crisp`, and a
  3px wine bar on the left. A `.la-mono-tile` inside goes inset while the card is not active.
- On phones every card is raised and the gap grows to 10px. The CSS does this, add nothing.
- References: `VoiceCallListCard` (Calls), `LeadListCard` (Chats), `WorkspaceAccountCard` (Accounts).
- `<ListCard>` renders the same `.la-camp-card` look for rows with free-form content (it drops the
  class's flex row and pads itself, or not with `padded={false}`). Used by `EntityListView`, the
  Outreach inbox prospect rows, `ThreadList` and the studio `ScriptCard`. `hoverShadow` is a no-op now.
- Tables: rows are `.la-lead-row` (add `.is-selected`), `h-[52px]`.

### 3.5 Minimizing the list

- `useListPanelState()` (`hooks/useListPanelState.ts`) is the one shared state for every list page:
  `"full" | "compact" | "hidden"`, remembered across pages.
- The fold button sits in the topbar `left` slot: a `TopbarIconButton` with `PanelLeftClose` / `PanelLeft`,
  or `ListPanelToggleButton` to cycle all three states.
- In `"compact"` the list becomes an avatar rail built from `components/crm/CompactEntityRail`
  (`COMPACT_RAIL_WIDTH`, `useCompactHoverCard`, `CompactHoverCardPortal` shows the full card on hover).
  Example: `CompactCallRail` on Calls.

### 3.6 Side tabs for sections

From `@/features/accounts/components/workspace/SectionRail`:
- `SectionLayout`: a 220px sticky rail beside the open section on desktop, a grid above it on phones (`stacked`).
- `SectionRail`: one tile per section (icon, label, one-line detail, optional state dot `on` / `pending` / `off`).
  The open tile is white with a wine bar.
- `SectionHeader`: the numbered heading at the top of a section.
- Used by:
  - Settings (`pages/Settings.tsx`).
  - Calls > Settings and Chats > Settings: the receptionist settings (`receptionist/ReceptionistSettings`,
    `voice/VoiceTab` + `VoiceRail`, `chat/ChatTab`).
  - Accounts > Alerts (`alerts/AlertsTab`) and Accounts > Automations (`ClientAutomationsTab`, via `AutomationRail`).
  - Automation logs (`pages/AutomationLogs.tsx`, via `features/automation/components/AutomationRail`).
  - Demo settings (`features/demos/components/DemoSettingsTab`).
  - Campaign settings (`features/campaigns/components/settings/CampaignSettingsLayout`, inside
    `CampaignStageEditor`). Self-contained, so it opens the same in Accounts > Reactivation, Demos > Settings
    and on the hidden Campaigns page.

### 3.7 Create and edit: right-hand panel

- Create, add and edit open a panel inside the layout, with no backdrop. On phones, a full-screen panel or `MobileSheet`.
- Anatomy: header (title + close), scrolling body, sticky footer (Cancel, Save). UI_PATTERNS §14.
- Wrap the form body in `.neu-panel`: inputs and selects become inset wells. Standalone inputs use `.neu-input`.
- References: `ContractCreatePanel`, `InvoiceCreatePanel`, `ExpenseCreatePanel`, `AccountCreatePanel`, `ProspectCreatePanel`.

### 3.8 Dialogs, popovers, menus

- **Dialogs only for destructive confirmations** ("Delete this account?"), with `AlertDialog`.
- Lighter confirmations: the inline confirm popover (UI_PATTERNS §30).
- Option menus, filters and sorts: `Popover` or `DropdownMenu`. They paint `bg-popover`, which is
  white in light mode and charcoal in dark. Never force `bg-white` on them.

### 3.9 Other shared parts

| Part | Use |
|------|-----|
| `GroupHeader` | Sticky divider in grouped lists (label + count). UI_PATTERNS §24. |
| `SectionCard` | Detail sections, widget shells, kanban columns. |
| `Pill` | Label or status badge in a soft tint of a color. |
| `.la-status` + `.dot` | Mono status pill. Modifiers `.active-s`, `.paused`, `.inactive`. |
| `EntityAvatar` | Every person or account circle, colored from `avatarUtils.ts`. UI_PATTERNS §23. |
| `.eyebrow` | Mono uppercase label above a value or section. |

`ToolbarButton`, the `xBase` / `xDefault` / `xActive` strings, `SearchPill`, `ViewTabBar` and
`ToolbarPill` are the retired Style B toolbar (UI_PATTERNS §28). Don't use them in new code.

---

## 4. Layout

### 4.1 Page shell

- `CrmShell` adds no padding. Every page starts with `.la-page` (full-height flex column) and a
  `PageTopbar`. No negative-margin hacks.
- Full-height columns: the parent gets `overflow-hidden min-h-0`, each column `min-h-0 overflow-y-auto`.
- Don't let a parent clip a card's shadow. Keep the `min-h-0` chain intact, and never put the selected
  card's shadow inside its own `overflow-hidden` wrapper. Reference: `DesktopCalendar.tsx`.

### 4.2 Width

- **List pages** (a list panel beside a detail panel: Chats, Leads, Calls, Accounts, Billing, Calendar): `max-w-[1386px] mr-auto` on the **outer flex child**, never an inner wrapper. In a grid,
  cap the column instead: `minmax(0,1386px)`.
- **Single-column pages** (Stats, Demos, Social, settings-style pages): `.la-page-center`
  on the content column **inside** the scroll container, so the scrollbar stays at the window edge.
- Details and the mistakes to avoid: `docs/content-width-cap.md`.
- List panel width: `--toolbar-w` (300px).

### 4.3 Breakpoints and mobile

Breakpoint tokens (they mirror the values used in media queries and JS, which can't read them):
`--bp-phone` 768px (below it: the phone app), `--bp-tablet` 1024px, `--bp-desktop` 1240px, `--bp-wide` 1680px.

- **Breakpoint 768px.** Tailwind `md:` / `max-md:`, `@media (max-width: 767px)`, and
  `useIsMobile(768)` from `hooks/useIsMobile.ts` (always pass 768: its default is 640).
- **Additive only.** A mobile fix never changes the desktop layout. Use `max-md:`, `md:hidden` or a media query.
- **Safe areas.** Use `--safe-top` and `--safe-bottom` (the env insets). Clear the bottom tab bar with `--bottombar-h`.
- Phone parts: `MobileListHeader`, `MobileTabSeg`, `MobileHeaderIconBtn`, `MobileSheet` (the Back button closes it first).
- Detail views open full screen with a back button. Touch targets are at least 36px.

---

## 5. Code conventions that touch the UI

- Data: `apiFetch` (`lib/apiUtils.ts`) for reads, `apiRequest` (`lib/queryClient.ts`) for mutations. Never raw `fetch()`.
- Features live in `client/src/features/{domain}/`. Pages are `React.lazy` imports (see `CLAUDE.md`).
- List pipelines: `buildEntityRows()` / `groupItemsToMap()` from `components/crm/entityList/`.
- Reuse the shadcn components in `components/ui/`. No new npm packages without Gabriel's approval.

---

## 6. One home per thing

- **A lead opens in one place:** the Chats page detail, `/platform/chat?lead=<id>`. Link to it with
  `leadPath()` or navigate with `openLead()`, both from `lib/leadLink.ts`. The old `/platform/leads` and
  `/platform/contacts/:id` only redirect there. Don't add another lead detail route.
- **Channel pages** (Calls, Chats) are **work | Settings** for that channel, as a `PillSwitch`
  in the topbar. Their figures live on the one Stats page (`/platform/home`); Socials keeps its own Insights. Per-account receptionist settings live in the channel's Settings view
  (`?view=settings&account=`).
- **Accounts** is the business and its connections: Overview, Reactivation (agency only, when the
  account has a reactivation campaign), Integrations, Alerts, Automations (owner only). One-time
  plumbing (numbers, WhatsApp, calendar, integrations) stays in Accounts > Integrations.
- **Campaigns** are data, not a page. Each kind of campaign is edited where it lives: Accounts >
  Reactivation (reactivation campaigns) and Demos > Settings (the demo campaigns) open the one campaign
  settings screen (`CampaignStageEditor`); Chats > Settings > Advanced (`chat/ChatAdvanced`) edits the
  receptionist campaign's engine fields with the same `formFields` inputs. The old Campaigns page is
  retired: out of the nav, agency only at `/platform/campaigns` by URL.
- **Settings** is the person: Profile, Security, Preferences, Notifications, Users, and Billing for clients.
- **Alerts** decides which events are sent and to whom.
- A page title uses the same i18n string as its nav label. Unfinished pages stay hidden until they are finished.

---

## 7. i18n

- Every user-facing string goes through `t()`: labels, toasts, empty states, placeholders, `aria-label`, `title`, `alt`.
- Locales: `client/src/locales/en/`, `nl/`, `pt/` (`pt` is Brazilian Portuguese). Add the key to all three.
- No text in module-level constants or helper functions that run outside a component. Store keys and translate them at render.

---

## 8. Bans

1. **No raw colors in components:** no hex, no `rgb()`, no `bg-white`, no `text-black`, no Tailwind
   palette colors (`blue-500`, `indigo-600`, `yellow-400`, `gray-*`). Use tokens. Hex belongs only in
   `variables.css` and the status maps in `avatarUtils.ts`.
2. **No `transition-all`.**
3. **No Tailwind shadows** (`shadow-sm`, `shadow-md`, `shadow-lg`). Use the `neu-*` utilities or `--sh-*` tokens.
4. **No `Dialog` for create, edit, add or menus.** Dialogs are for destructive confirmations only.
5. **No hand-rolled page parts:** no hand-written header bar, second search control, custom tab track,
   custom side menu or custom list-card shell. Use the parts in section 3.
6. **No serif faces** in the CRM, and no `.serif`, `.display`, `--serif` or `--display` in new code.
7. **No size variants** for buttons or circles. Circles are 36px with 16px icons.
8. **No hardcoded strings.**
9. **No mixed color formats** (`hsl(var(--wine))`, `var(--primary)` used as a color).
10. **No retired styles:** indigo, blue or lime/yellow accents, `--brand-*` aliases in new code, Style B toolbars.
11. **No desktop changes for a mobile fix,** and no width cap on an inner wrapper.
12. **No glass or blur behind functional UI** (popovers, menus, forms). Glass is for phone sheets and overlays.

---

## 9. Known debt

Fix these when you touch a file. Don't copy them.
- `bg-white` in about 100 files, `transition-all` in about 24, `shadow-md` in about 19, and `Dialog`s
  for create/edit (Wave 3 of the handover plan lists them).
- `IconBtn`'s selected state reads `--brand-indigo` (it renders wine).

---

## 10. File map

| What | Where |
|------|-------|
| Colors (light + dark) | `client/src/styles/variables.css` |
| Geometry, shadows, component classes | `client/src/styles/design-system.css` |
| Neumorphic utilities | `client/src/styles/neu.css` |
| List classes | `client/src/styles/components.css` |
| Primitives | `client/src/components/crm/primitives/` (`index.ts`) |
| Side tabs | `client/src/features/accounts/components/workspace/SectionRail.tsx` |
| List minimize | `client/src/hooks/useListPanelState.ts`, `client/src/components/crm/CompactEntityRail/` |
| Phone parts | `client/src/components/crm/mobile/` |
| Markup and props | `UI_PATTERNS.md` |
| Width rule | `docs/content-width-cap.md` |
| Agreed decisions | `docs/superpowers/plans/2026-10-22-crm-unification-and-handover.md` |
