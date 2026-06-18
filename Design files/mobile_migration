# Lead Awaker — Mobile App Migration Guide (HTML/JS → React + TypeScript)

> **For Claude Code.** This document is the complete spec for porting the **mobile** Lead
> Awaker app (`Lead Awaker Mobile.html` + all `mobile-*.jsx`) into a production
> React + TypeScript codebase. Follow it top-to-bottom. The goal is a **pixel- and
> behavior-exact** copy — same layout, same shadows, same transitions, same data.
>
> The source is a browser-Babel prototype: every component is a global function, there
> are no imports/exports, styling is inline `style={{…}}` objects referencing CSS custom
> properties, and all data lives on `window.*`. This guide tells you exactly how to
> translate each of those patterns into idiomatic, typed React.

---

> **⚡ READ THIS FIRST — reconciliation note (2026-06).** The target project ships a
> canonical design system documented in **`UI_STANDARDS.md`** (rules/tokens/bans) and
> **`UI_PATTERNS.md`** (markup/primitives). **Those two files outrank this guide wherever
> they disagree.** The great news: the prototype was built on the *same* warm-bone
> neumorphic system, so most tokens already line up by name. The reconciliation in §0 and
> §0.5 below tells you exactly where to bind to existing project primitives/tokens instead
> of porting raw markup — follow it rather than the verbatim instructions in later
> sections when the two conflict. Net effect: **this is much less of a "port" and much
> more of a "compose against what already exists."**

---

## 0. The token bridge (your system already covers ~90% of it)

Your project runs **two token files in parallel** (per `UI_STANDARDS.md §2`, `§4.5`):

- **`variables.css`** — shadcn-style color *roles* (HSL): `--primary`, `--background`,
  `--foreground`, `--muted-foreground`, `--card`, etc.
- **`design-system.css`** — the warm-bone system: `--wine-tint`, `--wine-glow`,
  `--wine-grad`, `--surface`, `--bg-2`, `--ink-soft`, the radius tiers `--r-*`, spacing
  `--space-*`, shadows `--sh-*`, `--bottombar-h`, breakpoints `--bp-*`, and the
  `.neu-*` / `.glass*` / `.la-*` utility classes.

**The prototype's variable names were drawn from this same `design-system.css`.** So most
references in the ported components already resolve against your CSS with zero work. Only a
**small alias set** is needed — the handful of names the prototype used that your
`variables.css` exposes under a different (shadcn) name:

```css
/* src/styles/la-mobile-bridge.css — import ONCE after variables.css + design-system.css.
   Only the names that differ between the prototype and your canonical tokens. */
:root {
  /* prototype name → your canonical token */
  --wine:        hsl(var(--primary));            /* accent. Prefer --primary in new code */
  --wine-soft:   hsl(var(--brand-deep-blue));    /* or keep prototype #7A2E3E if unmapped */
  --bg:          hsl(var(--background));          /* #ECE7DD */
  --chrome:      var(--bg-2);                     /* prototype alias of bg-2 */
  --paper:       hsl(var(--card));                /* white / text-on-wine */
  --ink:         hsl(var(--foreground));          /* #1F1A14 */
  --mute:        hsl(var(--muted-foreground));    /* #6C6354 */
  --mute-2:      hsl(var(--muted-foreground) / 0.7);
  --line:        hsl(var(--border) / 0.55);       /* or your --line if present */
}
```

**Already defined in your `design-system.css` — do NOT re-declare, do NOT bridge** (the
prototype uses these names verbatim and they'll resolve as-is): `--wine-tint`, `--wine-glow`,
`--wine-grad`, `--surface`, `--card-bright`, `--bg-2`, `--ink-soft`, `--good`/`--good-tint`,
`--warn`/`--warn-tint`, all `--stage-*` (verify against `PIPELINE_STAGE_COLORS` in
`avatarUtils.ts` — that's the source of truth, §0.5), all `--r-*`, all `--space-*`, all
`--sh-*`, `--bottombar-h`, `--safe-top`/`--safe-bottom`, `--bp-*`.

> Reach for `--primary` (or the `primary` Tailwind color) in **new** code, per
> `UI_STANDARDS.md §2.1`. The `--wine` alias above exists only so the ported components
> render unchanged; once a screen is settled you may swap its `var(--wine)` refs to
> `hsl(var(--primary))` to align with house style.

> ⚠️ **The shadow tokens are computed, not literal.** They're derived via `calc()` from a
> directional-light model. Your `design-system.css` already defines `--sh-raised-*`,
> `--sh-inset-*`, `--sh-polished-*` and the light variables — so just reference them. **Do
> not** hand-translate to static `box-shadow` values; the neumorphic look breaks.

---

## 0.5 Reconciling with `UI_STANDARDS.md` + `UI_PATTERNS.md` (do this, not the verbatim port)

The prototype hand-rolls surfaces with `style={{…}}` and local helpers because it had no
component library. **Your project does.** `UI_STANDARDS.md §2.25` and `§9.2-2b` make it a
hard rule: *never hand-roll `rounded-*` / `shadow-*` / padding on a list row, card, panel,
or pill — compose the primitive.* So when this guide later says "port `MobCampaignCard`",
read it as **"render the same content through your `<ListCard>`."** Map as follows:

| Prototype construct | Compose this project primitive instead | Source |
|---|---|---|
| `.la-camp-card`, `MobCampaignCard`, `MTTaskRow`, `MLLeadRow`, `MCEventRow`, `MAListCard`, billing list cards | **`<ListCard selected interactive hoverShadow>`** | `@/components/crm/primitives` |
| `MTGroupBar`, `MLGroupBar`, `MCDayBar`, `MABrand`-group dividers | **`<GroupHeader label count>`** (`UI_PATTERNS.md §24`) | `@/components/crm/primitives` |
| `MobCard`, `MobSheet` body sections, kanban columns, widget shells | **`<SectionCard>`** | `@/components/crm/primitives` |
| `.la-status` pills, `MTStatusPill`, `MLTempBadge`, `MA*Pill`, stage chips | **`<Pill color tone>`** | `@/components/crm/primitives` |
| `IconBtn` (prototype, 38px) | **`IconBtn`** — `h-9 w-9`, icons `h-4 w-4` (the 36px ONE size rule, `UI_STANDARDS.md §4.1`/`§5.1`) | `@/components/ui/icon-btn` |
| `.la-seg` / `.la-seg-btn.on` switchers (List/Pipeline, Agenda/Board, Stats/Settings, Invoices/Expenses/Contracts) | **`<ViewTabBar tabs activeId onTabChange>`** | `@/components/ui/view-tab-bar` |
| Search field / `IconSearch` openers | **`<SearchPill value onChange open>`** | `@/components/ui/search-pill` |
| `MLAvatar`, `MTAvatar`, `MCAvatar`, `MAAvatar` + local color logic | **`<EntityAvatar size={36}>`** + `get*AvatarColor()` (`§23`) | `@/components/ui/entity-avatar`, `@/lib/avatarUtils` |
| Toolbar filter/sort/group buttons | **expand-on-hover pattern** `xBase`/`xDefault`/`xActive`/`xSpan` (`§28`) | `@/components/crm/primitives` |
| Local `getInitials`, local stage-color maps | Import `getInitials`, `PIPELINE_STAGE_COLORS`/`PIPELINE_HEX` from `avatarUtils.ts` | `@/lib/avatarUtils` |

**Keep the prototype's bespoke pieces** (no project primitive exists for them): `MobSheet`
(bottom sheet), `MobRecede` (background scale), `MobBottomNav` (5-tab bar), the SVG charts
(`PipelineDonut`, `TrendChart`, `MLScoreArc`, `HeatStrip`), the chat composer/bubbles, and
the screen scaffolds. Port these as real components — but build their *internal* rows/pills
out of the primitives above.

### Fonts — the prototype's serif is WRONG for your system
Prototype heading font is **Instrument Serif** (and `Yeseva One` for two Accounts brand
tiles). Your standard (`UI_STANDARDS.md §3`) mandates **Playfair Display** for *all*
headings, Manrope for body, Geist Mono for labels/data/pills — and "never override heading
font." **Action:** drop Instrument Serif / Yeseva One; let headings inherit Playfair Display
via your base layer. Map any prototype `font-family: var(--serif)` → your `--font-heading`.
Mono and body already match.

### Animation — reconcile to your tiers; mind the Raspberry Pi
- The prototype's sheet uses `360ms cubic-bezier(0.22,1,0.36,1)`. Your panel tier is
  **`--t-panel: 250ms`** with **`--ease-default: cubic-bezier(0.25,0.1,0.25,1)`**
  (`UI_STANDARDS.md §7`). Retime `MobSheet`/`MobRecede` to those tokens.
- `UI_STANDARDS.md §7.3`: **never `transition-all`** — the prototype uses it in places;
  convert each to explicit `transition: transform …, opacity …`. Only animate `transform`
  and `opacity`. **This app runs on Raspberry Pi — no heavy animations.** The `MobRecede`
  background-scale is borderline; keep it cheap (transform only) or drop it if it janks.
- Keep the **double-rAF sheet-open** pattern (§7 below) — that's a correctness trick for
  the entrance transition, not a "heavy animation."

### Data — these are view-model shapes, not shipping seed data
The prototype's `window.LA_*` mocks become **API data** in your app. Per `UI_STANDARDS.md
§9.1`, fetch through **`apiFetch`** (queries) / **`apiRequest`** (mutations) with React
Query — do **not** ship the mock `*-data.js` files. Use the TypeScript interfaces in §5 as
the **view-model types** your query layer maps server rows into (respecting real DB field
names like `Conversion_Status`, `Accounts_id` per `§9.1-6`). This matches how
`ACCOUNTS_MIGRATION.md` already says to handle `ACCOUNTS_DATA`.

### Sheets vs. the panel-first rule
`UI_STANDARDS.md §9.2-11` / `§14` bans backdrop **dialogs** for create/edit on desktop. The
mobile bottom sheet (`MobSheet`) is **explicitly allowed** — `§8` permits glass overlays for
"mobile bottom sheets," and a detail-view sheet isn't a create/edit dialog. So `MobSheet`
stays for mobile detail viewing. But any **create/edit form** reached on mobile should still
follow panel-first (a full-screen pushed panel), not a darkened modal.

### File placement — feature-based, not a flat `src/mobile/`
Your structure is `client/src/features/{domain}/` with shared chrome in
`components/ui` and `components/crm/primitives` (`§9.1-5`, `§13`). Put each mobile screen in
its domain feature folder (e.g. `features/leads/mobile/LeadsMobile.tsx`) rather than the
flat `src/mobile/` tree suggested in §1 — and reuse the existing `avatarUtils`, primitives,
and `IconBtn`/`ViewTabBar`/`SearchPill` instead of re-creating them.

---

## 1. Architecture translation map

| Prototype pattern | Target (React + TS) |
|---|---|
| `<script type="text/babel">` files, no modules | One `.tsx` module per file, ES `import`/`export` |
| `function MobStats() {…}` global | `export function MobStats(props: MobStatsProps) {…}` |
| `Object.assign(window, { MobStats, … })` | Named exports at top of declaration |
| Component read via implicit global | Explicit `import { MobStats } from './MobStats'` |
| `window.LA_DATA`, `window.LA_TASKS`, … | Typed modules in `src/data/*` (see §5) imported directly |
| `React.useState` (UMD global React) | `import { useState } from 'react'` |
| Inline `style={{ borderRadius: 'var(--r-card)' }}` | **Keep as-is** — valid React, valid TS |
| `className="la-seg la-seg--fill"` | **Keep as-is** — port `design-system.css` (§3) |
| Babel inline SVG icon factories | Typed `Icon` component + icon map (§4) |
| `requestAnimationFrame` double-rAF open pattern | Keep identical (§7) — it's load-bearing for transitions |
| `data.js` mutated in place | Treat as immutable; lift toggles to state (already done in source) |

**No behavioral changes.** Don't "improve" anything. Match the prototype.

### Suggested target structure
```
src/
  styles/
    tokens.css            ← yours (unchanged)
    la-tokens.css         ← the alias bridge (§0)
    design-system.css     ← ported verbatim from prototype (§3)
  data/
    types.ts              ← all interfaces (§5)
    campaigns.ts          ← was data.js  (export const LA_DATA)
    tasks.ts              ← was tasks-data.js
    leads.ts              ← was leads-data.js  (incl. getDetail)
    calendar.ts           ← was calendar-data.js
    billing.ts            ← was billing-data.js
    accounts.ts           ← was accounts-data.js
  components/
    Icon.tsx              ← Icon + icon set (§4)
    primitives.tsx        ← StatusPill, etc. (shared from components.jsx)
  mobile/
    MobileApp.tsx         ← was mobile-app.jsx (root router)
    shell/                ← was mobile-shell.jsx
      MobBottomNav.tsx
      MobListBar.tsx
      MobDetailBar.tsx
      IconBtn.tsx
      MobSheet.tsx
      MobRecede.tsx
    campaigns/            ← mobile-app.jsx + mobile-detail.jsx screens
    tasks/                ← mobile-tasks.jsx
    leads/                ← mobile-leads.jsx
    calendar/             ← mobile-calendar.jsx
    billing/              ← mobile-billing.jsx + mobile-billing-app.jsx
    accounts/             ← mobile-accounts.jsx
    device/
      AndroidDevice.tsx   ← android-frame.jsx (preview frame only — see §9)
```

---

## 2. Design tokens (port or bridge — §0)

These are the prototype's `:root` values. Reconcile each against your `tokens.css`.

### Color
```
--bg #ECE7DD            page ground (warm light)
--bg-2 #E4DCCC          nav/chrome, deeper frame
--chrome #E4DCCC        alias of bg-2
--paper #FFFFFF         elevated paper / text-on-wine
--surface #FBF8F2       near-white raised chips/buttons
--card #FFFFFF          white cards
--card-bright #FFFFFF   polished hero base

--ink #1F1A14           primary text
--ink-soft #322B22      slightly softer ink
--mute #6C6354          secondary text
--mute-2 #948A77        tertiary text / faint borders

--line rgba(110,95,65,0.14)        hairline divider
--line-strong rgba(110,95,65,0.24) stronger divider

--wine #5E2230          accent / active state
--wine-soft #7A2E3E
--wine-tint rgba(94,34,48,0.08)    soft accent bg (inactive raised)
--wine-glow rgba(94,34,48,0.18)
--wine-grad linear-gradient(145deg,#6E2638,#4B1A26)   the one primary-action gradient

--good #2F9461  / --good-tint rgba(47,148,97,0.12)
--warn #DA9426  / --warn-tint rgba(218,148,38,0.13)
```

### Pipeline stage colors (used by Leads + Calendar avatars/bars)
```
--stage-new #6C5A8C   --stage-contacted #547BB0  --stage-responded #3F8E8E
--stage-multi #5E8E5E --stage-qualified #B58F3E  --stage-booked #C48A2F
--stage-closed #6E7A5E --stage-lost #A24B3F      --stage-dnd #9D8E76
```

### Radii — six semantic tiers (snap every corner to one)
```
--r-flush 6px   --r-button 8px   --r-surface 11px
--r-card 16px   --r-panel 22px   --r-pill 999px
```
> In JSX/TSX inline styles, ALWAYS quote: `borderRadius: 'var(--r-card)'`. Unquoted is a
> syntax error.

### Spacing — 8px base
```
--space-xxs 4   --space-xs 8   --space-sm 12   --space-md 16
--space-lg 20   --space-xl 24  --space-xxl 32  --space-section 80
```

### Typography
```
--serif "Instrument Serif", "Newsreader", Georgia, serif
--sans  "Manrope", ui-sans-serif, system-ui, sans-serif
--mono  "Geist Mono", ui-monospace, monospace
```
Plus `"Yeseva One"` is used for two brand tiles in Accounts (`MABrandTile`,
`MADetailHeader` logo). Load these (the prototype uses one Google Fonts `@import` — keep
it, or self-host for production).

### Mobile shell
```
--bottombar-h 64px
--safe-top    env(safe-area-inset-top, 0px)
--safe-bottom env(safe-area-inset-bottom, 0px)
```

### Breakpoints (reference values — CSS media queries can't read custom props)
```
--bp-phone 768   --bp-tablet 1024   --bp-desktop 1240   --bp-wide 1680
```

---

## 3. `design-system.css` — port these classes VERBATIM

The components lean on a set of global classes. **Copy `design-system.css` into the
project unchanged** (after bridging tokens per §0). The critical, do-not-rewrite blocks:

1. **The shadow `:root` block** — `--sh-raised-crisp/medium/large`, `--sh-inset-*`,
   `--sh-polished-*`. These are `calc()` expressions over the light model
   (`--lx`, `--ly`, `--d-*-o`, `--d-*-b`, `--light-strength`). Port the light variables
   too. Static box-shadows will NOT match.
2. **`.la-app`** — the screen background + `::before`/`::after` directional-light
   gradients + `isolation` stacking. Every detail sheet body uses
   `className="la-app"`.
3. **Surface utilities** — `.neu-raised`, `.neu-raised-crisp`, `.neu-raised-large`,
   `.neu-inset`, `.neu-inset-crisp`, `.neu-polished`, `.neu-polished-large`.
   (CLAUDE.md note: these are **frozen** — don't tokenize their literal radii.)
4. **`.glass` / `.glass-strong`** — used in the Billing client-view banner.
5. **Buttons** — `.btn-neu`, `.btn-wine`, `.btn-ghost`, and the compact
   `.la-btn` family (`--wine`, `--soft`, `--inset`, `--icon`, `--lg`, `--pill`).
6. **Segmented control** — `.la-seg`, `.la-seg-btn`(`.on`), modifiers `--pill`, `--fill`.
   This is the universal mobile tab/switcher; every screen uses it.
7. **Type primitives** — `.eyebrow`(`.eyebrow-sm`), `.serif`, `.italic`, `.wine`,
   `.mute`, `.mute-2`.
8. **Misc** — `.row`, `.rule`, `.dot`, `.divider-v`, `.la-camp-card`(`.active`),
   `.la-mono-tile`(`.wine`/`.inactive`), `.la-status` pills, `.la-pulse` (the LIVE dot),
   `.la-switcher`, `.la-profile*`.

> The desktop-only blocks at the bottom of the file (`.bold-*`, `.col-*`, `.bold-hero`)
> are NOT needed for the mobile app — you may drop them.

In React, these classes are applied via `className`. JSX `className`/style stays
identical to the prototype — no change required.

---

## 4. Icons

`components.jsx` defines a base `Icon` and ~40 icon factories (`IconCampaigns`,
`IconLeads`, `IconCal`, `IconChev`, `IconSpark`, `IconBell`, `IconSearch`, `IconWA`,
`IconPhone`, `IconActivity`, `IconSettings`, `IconMore`, `IconTasks`, `IconLayers`,
`IconFilter`, `IconSort`, `IconSwap`, `IconPlus`, `IconChats`, `IconProspect`,
`IconCadence`, `IconAuto`, `IconAccts`, `IconBilling`, `IconLibrary`, …).

Port the base as a typed component; keep each icon a thin wrapper so call sites
(`<IconChev size={16} />`) are unchanged:

```tsx
// Icon.tsx
import type { ReactNode } from 'react';

export interface IconProps {
  size?: number;
  strokeWidth?: number;
  fill?: string;
  style?: React.CSSProperties;
  className?: string;
}

export const Icon = ({ d, size = 18, strokeWidth = 1.5, fill = 'none', ...rest }:
  IconProps & { d: ReactNode }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke="currentColor"
       strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" {...rest}>
    {d}
  </svg>
);

export const IconChev = (p: IconProps) => <Icon {...p} d={<path d="m9 6 6 6-6 6" />} />;
// …copy every factory's path data verbatim from components.jsx…
```

Several screens define **local** glyphs to avoid name collisions (the prototype runs all
files in one global scope). In modules these collisions disappear, but **keep the local
glyphs as-is** to stay exact — they have hand-tuned stroke widths:
- `mobile-tasks.jsx`: `MTCheckGlyph`, `MTClock`
- `mobile-leads.jsx`: `MLPlusGlyph`, `MLListGlyph`, `MLPipeGlyph`, `MLSendGlyph`
- `mobile-calendar.jsx`: `MCVideoGlyph`, `MCPhoneGlyph`, `MCClockGlyph`, `MCSparkGlyph`,
  `MCReschedGlyph`, `MCCheckGlyph`, `MCArrowGlyph`, `MCChevL`, `MCChevR`
- `mobile-accounts.jsx`: `MAIArrow`, `MAIFile`, `MAIBook`, `MAIMic`, `MAILink`, `MAIEye`,
  `MAICopy`, `MAIEdit`, `MAIShare`, `MAIPlay`, `MAIUp`, `MAIUsers`, `MAIGrid`

---

## 5. Data layer + TypeScript interfaces

Each `*-data.js` becomes a typed module exporting one constant. **Read the actual
`data.js`, `tasks-data.js`, `leads-data.js`, `calendar-data.js`, `billing-data.js`,
`accounts-data.js` files for exact values and copy them in full** — the interfaces below
are derived from how the components consume the data and are your type targets. Verify
field-by-field against the source while porting.

```ts
// ─── campaigns.ts (was data.js → window.LA_DATA) ───
export type CampaignStatus = 'active' | 'paused' | 'inactive';
export interface Campaign {
  id: string; mono: string; name: string; client: string;
  status: CampaignStatus; section: 'active' | 'inactive'; active: boolean;
  channel: string; dailyLimit: string; activeHours: string;
  owner: string; ownerInit: string;
}
export interface AiInsight { title: string; body: string; }
export interface CampaignData {
  campaigns: Campaign[];
  active: Campaign;            // the live monitor campaign
  aiTLDR: string;
  aiAnalysis: AiInsight[];
  heat: number[];             // HeatStrip input
  nowLabel: string;
  nextSend: unknown;          // shape per NextSendCard (from layout-bold.jsx)
  recent: unknown[];          // RecentRow
  activity: unknown[];        // UpcomingRow
  followUp: { cadence: unknown };  // CadenceLadder
  upNext: { date: string }[]; // FutureRow
}

// ─── tasks.ts (was tasks-data.js → window.LA_TASKS) ───
export type TaskStatus = 'todo' | 'inprogress' | 'waiting' | 'done';
export interface Person { name: string; short: string; ini: string; color: string; }
export interface Task {
  id: string; title: string; sub: string;
  category: string; priority: string; who: string;
  due: string;                // ISO yyyy-mm-dd
  status: TaskStatus;
  sched?: { day: string; start: string; end: string };
}
export interface TasksData {
  today: string;
  people: Record<string, Person>;
  STATUS: Record<string, { label: string; color: string; tint: string }>;
  CATEGORY: Record<string, { label: string; color: string }>;
  PRIORITY: Record<string, { label: string; color: string }>;
  tasks: Task[];
}

// ─── leads.ts (was leads-data.js → window.LEADS_DATA) ───
export type Temp = 'Hot' | 'Warm' | 'Lukewarm' | 'Cold';
export interface PipelineStage { key: string; label: string; color: string; star?: boolean; }
export interface ChatMsg { id?: number; dir: 'in' | 'out' | 'div'; text: string; time: string; }
export interface Lead {
  id: string; name: string; ini: string; stage: string; stageIdx: number;
  score: number; temp: Temp; ago: string;
  demo?: boolean; campaign?: string; grp: 'week' | 'month';
  lastMsg?: { dir: 'in' | 'out'; text: string; time: string };
}
export interface LeadSummary {
  ready: boolean; outcome: string; sentiment: string; headline: string;
  points: { text: string; tone: 'good' | 'warn' | 'neutral' }[];
  nextStep: string; topics: string[];
}
export interface LeadDetail extends Lead {
  lastActivity: string;
  booking?: { day: string; mon: string; d: number; start: string; end: string;
              via: string; likelihood: number; conf: string };
  messages: ChatMsg[];
  summary?: LeadSummary;
  scoreBreakdown: { label: string; value: number; max: number; color: string; note: string }[];
  scoreHistory: number[];
  contact: { firstName: string; phone: string; email: string; source: string; created: string };
  account: string; note: string;
}
export interface LeadsData {
  pipeline: PipelineStage[];
  leads: Lead[];
  getDetail(id: string): LeadDetail;
}

// ─── calendar.ts (was calendar-data.js → window.LA_CAL) ───
export type EventStatus = 'booked' | 'noshow' | 'rescheduled';
export interface CalEvent {
  id: string; iso: string; leadId: string; leadName: string; ini: string;
  stage: string; type: string; campaign: string;
  start: string; end: string; via: 'Phone' | 'Video';
  likelihood: number; status: EventStatus;
}
export interface CalendarData {
  today: string; weekStart: string; monthAnchor: string;
  stats: { value: string; delta?: string; label: string }[];
  events: CalEvent[];
}

// ─── billing.ts (was billing-data.js → window.LA_BILLING) ───
export type InvoiceStatus = 'draft' | 'sent' | 'overdue' | 'paid';
export type ContractStatus = 'draft' | 'sent' | 'active' | 'signed';
export interface Invoice { id: string; client: string; status: InvoiceStatus;
  amount: number; due: string; issued: string; }
export interface Expense { id: string; desc: string; supplier: string; date: string;
  total: number; excl: number; vat: number; btw: number;
  cur: 'EUR' | 'USD'; ded: boolean; y: number; }
export interface Contract { id: string; client: string; title: string;
  status: ContractStatus; value: number; term: string; start?: string; }
export interface Notif { id: string; unread: boolean; group: 'week' | 'older';
  /* + type/meta fields consumed by NotifRow */ }
export interface BillingData {
  today: string;
  clients: Record<string, { name: string /* + fields */ }>;
  invoices: Invoice[]; expenses: Expense[]; contracts: Contract[];
  notifications: Notif[];
}

// ─── accounts.ts (was accounts-data.js → window.ACCOUNTS_DATA) ───
export interface AccountListItem { id: string; mono: string; name: string;
  type?: string; members: number; }
export interface AccountDetail {
  id: string; mono: string; name: string; status: string; type: string; niche: string;
  overview: { status: string; type: string; niche: string };
  contact: { email: string; phone: string; website: string; address: string };
  schedule: { timezone: string; language: string; hoursOpen: string; hoursClose: string;
              dailySends: string; optOut: string };
  meta: { description: string };
  campaigns: { id: string; mono: string; name: string; status: string;
               channel: string; leads: number; resp: number }[];
  contracts: { id: string; name: string; status: 'active'|'pending'|'expired';
               value: string; renewal: string }[];
  team: { id: string; init: string; name: string; email: string; role: string }[];
  voices: { lang: string; flag: string; ready: boolean; sample?: string }[];
  twilio: { fields: IntegrationField[] };
  instagram: { fields: IntegrationField[] };
  comingSoon: { key: string; init: string; label: string }[];
}
export interface IntegrationField { label: string; value: string;
  mono?: boolean; secret?: boolean; copy?: boolean; }
export interface AccountsData {
  accountsList: { group: string; items: AccountListItem[] }[];
  detail: AccountDetail;
}
```

> **Load-order dependency (calendar):** in the prototype `calendar-data.js` runs an IIFE
> that reads `window.LEADS_DATA.leads` to enrich its events, then sets `window.LA_CAL`. It
> bails (`if (!window.LEADS_DATA) return;`) if leads aren't loaded yet. In TS this becomes
> an explicit import: `calendar.ts` must `import { LEADS_DATA } from './leads'` and build
> its events from that — so leads is a hard dependency of calendar. `MCDetailBody` and
> `mcStageColor` also call into `LEADS_DATA` at render time (`getDetail`, `pipeline`), so
> both modules must be available wherever Calendar mounts.

> **Shared-helper note (billing):** `mobile-billing.jsx` calls `window.bExpenseGroups`,
> `window.bSums`, and formatters `bEur`, `bEur0`, `bMoney`, `bDate` — these live in
> `billing-components.jsx` / `billing-views.jsx`. Port those helpers into
> `src/data/billing.ts` (or a `billing-utils.ts`) and import them. Likewise the billing
> detail bodies `InvoiceDetail`, `ExpenseDetail`, `ContractDetail`, the status pills
> `BInvoiceStatus`/`BContractStatus`, `BAvatar`, `NotifRow`, and the `BI*` icon set come
> from those desktop files — bring them across too (Billing reuses the desktop detail
> components inside the mobile sheet).

---

## 6. Component inventory (by screen)

Every component below is a global function in the prototype; make each an exported
function with a typed props interface. Names in **bold** are the screen roots mounted by
the router.

### Shell (`mobile-shell.jsx`)
| Component | Props | Notes |
|---|---|---|
| `MobBottomNav` | `active: TabKey; onTab(k): void` | 5-tab grid; wine pill on active. Tabs: Campaigns, Leads, Calendar, Tasks, More. |
| `MobListBar` | `onSearch?()` | Campaigns top bar (agency switcher + title + filter/sort). |
| `MobDetailBar` | `campaign; tab; setTab; onBack` | Campaign detail header + Stats/Settings `.la-seg`. |
| `IconBtn` | `Ic; onClick?; dot?` | Round 38px raised icon button (reused everywhere). |
| `MobSheet` | `open; onClose; children` | **Bottom sheet** — scrim + rise-from-bottom panel, drag handle. Self-manages mount/unmount so exit animates. See §7. |
| `MobRecede` | `open; children` | Scales the screen behind a sheet to 0.96. |
| `MobPlaceholder` | `label; Ic` | Not-yet-designed tab fallback. |

### Root (`mobile-app.jsx`)
- **`MobileApp`** — bottom-tab router. State `tab`. Renders one screen + `MobBottomNav`.
  Billing & Accounts are sub-screens reached from More; keep More lit while on them
  (`active={(tab==='Billing'||tab==='Accounts') ? 'More' : tab}`).
- `MobCampaignsScreen` — owns the campaign detail sheet (open via `MobSheet`).
- `MobListScreen` — grouped Active/Inactive campaign list + FAB.
- `MobCampaignCard` — full-width campaign row (`.la-camp-card`).
- `MobDetailBody` — detail sheet body; tab between `MobStats` / `MobSettings`.
- `MobMore` — the More menu (profile card + grouped links; Billing/Accounts route out).

### Campaign detail (`mobile-detail.jsx`)
- `MobStats` — single-column scroll: polished hero, AI Read (expandable), Key Metrics
  grid, Trend, Pipeline (donut + bars), Heat strip, NOW card, NEXT card. Reuses
  `BigMetric`, `TrendChart`, `PipelineDonut`, `PipelineBars`, `HeatStrip`, `NextSendCard`,
  `RecentRow`, `UpcomingRow`, `FutureRow`, `CadenceLadder`, `TimeToggle` from the desktop
  `layout-bold.jsx`/`components.jsx` — **port those too**.
- `MobSettings` — Campaign field list + Automation toggles + save/preview buttons.
- `MobCard` (`pad?`, `style?`), `MobSectionLabel` (`right?`), `MetaItem`, `MobToggle`.

### Tasks (`mobile-tasks.jsx`) — root **`MobTasksScreen`**
State: `view` (agenda|board), `filter`, `who`, `doneIds:Set`, `sel`, `open`.
Helpers: `mtParse/mtAdd/mtDue/mtTime/mtGroup` (UTC date math — copy exactly).
Pieces: `MTAvatar`, `MTStatusPill`, `MTCheckbox`, `MTDue`, `MTTaskRow`, `MTGroupBar`,
`MTBoardCard`, `MTField`, `MTDetailBody`, `MTTasksBar`, `MTFilters`.
Board columns: `['todo','inprogress','waiting','done']`. Detail opens in `MobSheet`.

### Leads (`mobile-leads.jsx`) — root **`MobLeadsScreen`**
State: `view` (list|pipeline), `filter`, `peekOn`, `sel`, `open`.
Pieces: `mlStage`, `MLAvatar`, `MLTempBadge` (+`ML_TEMP` map), `MLScoreArc` (SVG donut),
`MLPipelineBar`, `MLPeek`, `MLLeadRow`, `MLGroupBar`, `MLBoardCard`, `MLChatMsg`,
`MLSummary`, `MLScore` (SVG sparkline), `MLInfo`, `MLDetailBody` (Chat/Summary/Score/Info
tabs + composer), `MLLeadsBar`, `MLFilters`. Detail via `getDetail(id)`.

### Calendar (`mobile-calendar.jsx`) — root **`MobCalendarScreen`**
State: `view` (agenda|month), `filter`, `weekOffset`, `sel`, `open`.
Helpers: `mcParse/mcISO/mcAdd/mcHM/mcTime`, `mcIntent`, `mcStatus`, `mcStageColor`.
Pieces: `MCAvatar`, `MCAITag`, `MCIntentDot`, `MCEventRow`, `MCDayBar`, `MCMonthGrid`
(Monday-led 6-week grid, tap a day → agenda), `MCField`, `MCDetailBody` (pulls
`LEADS_DATA.getDetail(ev.leadId)` for the AI summary), `MCCalendarBar` (+week nav),
`MCFilters` (stat strip + intent chips).

### Billing (`mobile-billing.jsx` + `mobile-billing-app.jsx`) — root **`MobileBilling`** (`embedded?` prop)
State: `role` (admin|client), `tab` (invoices|expenses|contracts), `view` (list|table),
`filter`, `sel`, `notifOpen`, `notifs`.
Pieces: `MBSegment`, `MBViewToggle`, `MBTopBar`, `MBStatStrip`, `MBChips`, `MBSection`,
`MBInvoiceCard/List/Table`, `MBExpenseCard/List/Table`, `MBContractCard/List/Table`,
`MBTableScroll`, `MBDetailSheet`, `MBNotifSheet`, `MBBottomNav`, and the
`mbStatCards`/`mbChipCount` logic. **When `embedded` is true** (mounted inside
`MobileApp`), it hides its own bottom nav and lowers the FAB. Keep that prop.

### Accounts (`mobile-accounts.jsx`) — root **`MobAccountsScreen`** (`onBack` prop)
State: `sel`, `open`. Pieces: `MARolePill`, `MAContractPill`, `MAConnectedPill`,
`MABrandTile`, `MAAvatar`, `MAListBar`, `MAListCard`, `MAListScreen`, `MADetailHeader`,
`MATabBar` (horizontal-scroll underline tabs — NOT `.la-seg`), `MAFieldRows`, `MAOverview`,
`MACampaignRow`, `MAContractRow`, `MATeamRow`/`MATeamRowFirst`, `MAVoiceRow`,
`MAIntegrationField`, `MAIntegrationCard`, `MAOverview`, `MATeamTab`, `MAIntegrationsTab`,
`MADetailBody`. Tabs: Overview · Campaigns · Contracts · Team · Integrations.

---

## 7. Transitions & interaction patterns (load-bearing — copy exactly)

1. **Open-a-sheet double rAF.** Every list→detail opener does:
   ```js
   const open = (item) => { setSel(item);
     requestAnimationFrame(() => requestAnimationFrame(() => setOpen(true))); };
   ```
   The nested rAFs let the sheet mount at `translateY(100%)` for one frame before
   transitioning to `0`, so the rise animates. **Keep both rAFs.** In React 18 this still
   works; do not replace with `setTimeout(0)`.

2. **`MobSheet` self-managed exit.** It renders while `render` is true, sets `vis` to
   drive opacity/transform, and flips `render=false` on `onTransitionEnd` when closing.
   Easing: `cubic-bezier(0.22, 1, 0.36, 1)`, 360ms. Scrim `rgba(31,26,20,0.32)`.
   Panel: `top:18px`, `borderRadius: var(--r-panel) var(--r-panel) 0 0`, drag handle at top.

3. **`MobRecede`** scales the underlying screen to `0.96` from `transformOrigin:'50% 0%'`
   with the same easing — gives the iOS-style "card behind" depth.

4. **Toggle/segmented active state** is `.la-seg-btn.on` (wine + raised). Filter chips use
   inline wine bg when active. Don't unify them — they're intentionally different controls.

5. **No router/URL.** Navigation is component state only. If you add React Router, keep
   the in-memory state machine identical; don't let URL changes remount and lose the
   sheet animation.

---

## 8. Reflow / responsive rules

- The app is a **single-pane phone screen**, fixed conceptual width 412px (the Android
  frame). All screens are `position:absolute; inset:0; display:flex; flex-direction:column`
  with a fixed top bar, a `flex:1; overflow-y:auto` body, and (where present) a FAB and
  the bottom nav.
- Horizontal-scroll regions (filter chips, stat strips, kanban boards, billing tables)
  use `overflowX:'auto'; scrollbarWidth:'none'`. Preserve the hidden scrollbar.
- Bottom padding on scroll bodies is ~`90px` when a FAB+nav overlap, else ~`24–28px`.
- Safe-area: bottom nav pads `calc(10px + var(--safe-bottom))`. Keep for notch devices.
- For a **real responsive site** (not a framed preview), drop the `AndroidDevice` wrapper
  (§9) and let `MobileApp` fill the viewport — it's already self-contained at `100%/100%`.

---

## 9. The Android device frame (`android-frame.jsx`)

`AndroidDevice` is a **preview chrome only** (bezel, status bar, gesture nav, optional
Gboard). In the prototype it wraps `<MobileApp/>` at width 412. For your production
website you almost certainly **do not** want it — render `MobileApp` directly into your
mobile layout/route. Port `AndroidDevice` only if you keep a device-preview surface
(e.g. a marketing or QA page). It has no dependency on the design system (uses its own
Material palette `MD_C`).

---

## 10. Migration checklist

- [ ] **Read `UI_STANDARDS.md` + `UI_PATTERNS.md` first** — they outrank this guide (§0.5).
- [ ] Add only the small alias set (§0); confirm `--wine-tint`/`--r-*`/`--space-*`/`--sh-*`
      already resolve from your `design-system.css` (don't re-declare them).
- [ ] Verify `--stage-*` against `PIPELINE_STAGE_COLORS` in `avatarUtils.ts` (code wins).
- [ ] **Headings = Playfair Display** (NOT Instrument Serif/Yeseva One — §0.5). Body
      Manrope, labels/data Geist Mono — all already in your system.
- [ ] **Compose primitives, don't hand-roll** (§0.5 table): `<ListCard>`, `<GroupHeader>`,
      `<SectionCard>`, `<Pill>`, `IconBtn` (36px), `<ViewTabBar>`, `<SearchPill>`,
      `<EntityAvatar>`. Reserve verbatim ports for `MobSheet`/`MobRecede`/`MobBottomNav`/charts.
- [ ] **Data via `apiFetch`/`apiRequest` + React Query** — §5 interfaces are view-model
      types, NOT shipped seed data (§0.5).
- [ ] Retime sheet/recede to `--t-panel`/`--ease-default`; kill every `transition-all`;
      transform+opacity only (Raspberry Pi perf, §0.5).
- [ ] Place screens in `features/{domain}/mobile/`, not a flat `src/mobile/` (§0.5).
- [ ] Port `Icon` + all icon factories + per-screen local glyphs (§4).
- [ ] Port the six data modules with the §5 interfaces; **diff against source `*-data.js`**.
- [ ] Port shared desktop pieces the mobile screens import: `StatusPill`, `BigMetric`,
      `TrendChart`, `PipelineDonut`, `PipelineBars`, `HeatStrip`, `NextSendCard`,
      `RecentRow`, `UpcomingRow`, `FutureRow`, `CadenceLadder`, `TimeToggle`; billing
      `InvoiceDetail`/`ExpenseDetail`/`ContractDetail`, `BAvatar`, `NotifRow`, `BI*` icons,
      formatters `bEur/bEur0/bMoney/bDate`, `bExpenseGroups`, `bSums`.
- [ ] Port shell: `MobBottomNav`, `MobSheet`, `MobRecede`, `IconBtn`, bars.
- [ ] Port each screen root + pieces (§6), keeping the double-rAF open pattern (§7).
- [ ] Wire `MobileApp` router; confirm Billing `embedded` + Accounts `onBack` behavior.
- [ ] Confirm every `borderRadius`/`padding` CSS-var value is a **quoted string** in TSX.
- [ ] Visual diff each screen against the prototype at 412px width.

---

## 11. Gotchas (from the prototype's own notes)

- **Quote CSS vars in inline styles:** `borderRadius: 'var(--r-card)'` ✅ —
  `borderRadius: var(--r-card)` ✗ (compile error).
- **Don't tokenize `.neu-*`/`.glass-*` radii** — they're frozen literal px on purpose.
- **Sub-6px micro-radii stay literal** (tiny badges use `borderRadius: 3`).
- **Don't convert vertical selection lists (Settings nav, More menu) into `.la-seg`** —
  those are lists, not tab bars. `.la-seg` is only for 2–4 horizontal switchers.
- **Name collisions:** the prototype prefixes per-screen helpers (`MT*`, `ML*`, `MC*`,
  `MA*`, `MB*`) precisely because everything shared one global scope. In modules you can
  keep or drop the prefixes — but if you keep multiple style objects, never name one
  generically; collisions were the original sin this avoids.
- **The `--cream` bug:** an earlier version used a dead `--cream` token for selected
  segments; it's fixed by routing through `.la-seg-btn.on`. Don't reintroduce `--cream`.
