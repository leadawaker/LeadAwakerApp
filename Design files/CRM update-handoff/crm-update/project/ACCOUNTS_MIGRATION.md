# Accounts Page — Migration Guide (HTML/JSX → React + TypeScript)

This document is a handoff for migrating the **Accounts page** prototype in this
project into your production React/TypeScript CRM. It is written to be pasted (or
referenced) directly into a Claude Code session so the migration happens in **one
pass** without breaking your existing wiring.

> **What you built here is presentation-only.** No data fetching, no real button
> handlers, no routing. Every value comes from a static `ACCOUNTS_DATA` object and
> every action is a no-op. Your job in the real app is to keep the **markup +
> styles** and swap the **data + handlers** for what your CRM already has.

---

## 1. What the page is

A master–detail Accounts workspace:

```
┌──────────────────────────────────────────────────────────────────────┐
│ TOPBAR  Accounts (n)  Overview · Integrations · Knowledge   🔍 ⛃ Edit ⋯│  ← ONE continuous bar: title + tabs + actions, no dividers
├───────────┬──────────────────────────────────────────────────────────┤
│  RAIL     │ ░ IDENTITY CARD  ◧ Lead Awaker ·Active·  [metachips ×4] ░  │  ← white raised card; key metrics = chips
│ +Create   ├──────────────────────────────────────────────────────────┤
│ accounts  │ TAB BODY (scrolls)                                         │
│  list     │   Overview → reflows 2-col ⇄ 4-col by width               │
│           │   Integrations (Voice Clone folded in) / Knowledge         │
└───────────┴──────────────────────────────────────────────────────────┘
```

Three tabs: **Overview · Integrations · Knowledge**. Voice Clone is a *section
inside Integrations* (not its own tab). The identity card sits at the top of the
scroll area (persistent across tabs) as a white `neu-raised` card; the four key
metrics render as **metachips** on its right.

Two responsive states for the **Overview** tab:

| Mode | Trigger | Layout |
|---|---|---|
| **Regular** | detail width `< 1450px` | Account Details (2-col) on top → row of `Campaigns` \| `Team + Contracts` |
| **Ultra-wide** | detail width `≥ 1450px` | 4 columns: **A** Details + Integrations(+Voice) · **B** Campaigns · **C** Team + Contracts · **D** Knowledge Base |

`Contracts` always sits **under** `Team`. Key metrics live as **metachips in the
identity card** (never a wide panel), so they stay compact at any width.

---

## 2. File map (prototype → suggested target)

| Prototype file | Role | Suggested target |
|---|---|---|
| `Accounts Page.html` | Shell: React/Babel bootstrap + Tweaks panel | `app/accounts/page.tsx` (your route) — **drop the Tweaks panel & Babel** |
| `accounts-workspace.jsx` | The page: `TopBar`, `Rail`, `IdentityHeader`, section panels, `Overview*`, `AccountsWorkspace` | `features/accounts/` (one file per component) |
| `accounts-components.jsx` | Reusable atoms: `Panel`, `FieldRow`, `CampaignRow`, `ContractRow`, `TeamRow`, `VoiceRow`, `IntegrationField`, `BrandTile`, pills | `features/accounts/components/` |
| `accounts-kb.jsx` | Knowledge Base: `KBPanel`, `KBCategory`, `KBEntry`, `KBForm`, `ScopePicker`, `ScopeChip`, `InjectChip` | `features/accounts/knowledge/` |
| `accounts-data.js` | Static seed `window.ACCOUNTS_DATA` | Delete — replace with your API types/queries (see §4) |
| `components.jsx` | Shared chrome: `Sidebar`, `StatusPill`, `Icon`, icon set | **Already shared in your app** — see §6 |
| `design-system.css` | Tokens + `.la-btn` / `.la-seg` / `.neu-*` | Map onto your `tokens.css` — see §5 |

The prototype shares components via `Object.assign(window, {...})` at the bottom of
each file (Babel-in-browser has no module scope). In React/TS, replace those with
normal `export` / `import`.

---

## 3. Component tree

```
<AccountsWorkspace>                      // owns: activeTab, ultra (from useUltraWide)
├─ <Sidebar active="Accounts"/>          // SHARED chrome — do not re-implement (§6)
└─ column
   ├─ <TopBar tab setTab count/>         // ONE continuous bar: title + tabs + search/filter + Edit account + ⋯
   └─ row
      ├─ <Rail data/>                    // + Create account button, then grouped accounts list (AccountRailCard)
      └─ scroll-area (ref = detailRef → ResizeObserver)
         ├─ <IdentityCard d metrics/>    // white neu-raised card: avatar + name + status + niche + <MetaChip/>×4
         └─ <TabContent tab ultra d/>
            ├─ overview      → <OverviewRegular/> | <OverviewUltra/>
            ├─ integrations  → <IntegrationsPanel fieldCols={3}/>   // Voice Clone section folded in
            └─ knowledge     → <KBPanel/>                          // see §4.1
```

**Section panels** (all take `{ d }` = the account): `AccountDetailsPanel`,
`CampaignsPanel`, `TeamPanel`, `ContractsPanel`, `IntegrationsPanel` (renders the
Voice Clone section when `withVoice`), `KBPanel`. They are pure presentational
components — give each the data slice it needs and an `onAction` callback set (see §7).

### The responsive hook (keep this — it's already real React)

```ts
function useUltraWide(ref: React.RefObject<HTMLElement>, override: 'auto'|'regular'|'ultra' = 'auto') {
  const [w, setW] = React.useState(0);
  React.useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(es => { for (const e of es) setW(e.contentRect.width); });
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, [ref]);
  if (override === 'regular') return false;
  if (override === 'ultra')   return true;
  return w >= 1450; // ULTRA_AT — detail-area width, not viewport
}
```

`override` exists only so the prototype's Tweaks panel can force a mode. In
production you can drop the param and just `return w >= 1450`, or expose it as a
user preference. **The breakpoint is the detail area's own width** (via
ResizeObserver), not the viewport — so it stays correct regardless of sidebar/rail
collapse state. If you prefer pure CSS, this maps cleanly to a
`@container (min-width: 1450px)` query on the scroll-area (`container-type: inline-size`).

---

## 4. Data model (TypeScript interfaces)

Replace `ACCOUNTS_DATA` with these. Field names mirror the prototype's
`accounts-data.js` exactly — rename to match your API and update the components'
prop access in the same pass.

```ts
type Status   = 'active' | 'paused' | 'inactive';
type Contract = 'active' | 'pending' | 'expired';

interface AccountSummary {        // rail row
  id: number; name: string; mono: string;      // mono = 2-letter avatar text
  type: string | null;                          // e.g. 'AGENCY' (null = ungrouped)
  status: Status; members: number; ago: string; // ago = humanized last-activity
  active?: boolean;                              // currently-selected
}
interface AccountGroup { group: string; items: AccountSummary[]; }

interface Campaign {
  id: number; name: string; mono: string; channel: string;  // 'WhatsApp'
  status: Status; leads: number; resp: number;               // resp = response %
  contract: string | null; ends?: string;
}
interface ContractRow {
  id: string; name: string; status: Contract;
  value: string; start: string; renewal: string;            // value = '$2,500'
}
interface TeamMember { id: string; name: string; email: string; role: 'Owner'|'Admin'|string; init: string; }
interface Voice  { lang: 'EN'|'PT'|'NL'|string; flag: string; ready: boolean; sample: string|null; updated?: string; }
interface IntegrationField { label: string; value: string; mono?: boolean; secret?: boolean; copy?: boolean; wrap?: boolean; }
interface Integration { connected: boolean; fields: IntegrationField[]; }

interface AccountDetail {
  id: number; name: string; mono: string; type: string; niche: string; status: Status;
  overview:  { status: string; type: string; niche: string };
  contact:   { email: string; phone: string; website: string; address: string };
  schedule:  { timezone: string; language: string; hoursOpen: string; hoursClose: string; dailySends: string; optOut: string };
  meta:      { taxId: string; description: string };
  campaigns: Campaign[];
  contracts: ContractRow[];
  team:      TeamMember[];
  knowledge: KnowledgeBase;                                 // see §4.1
  voices:    Voice[];                                       // rendered inside Integrations
  twilio:    Integration;
  instagram: Integration;
  comingSoon:{ key: string; label: string; init: string }[];
}
```

### 4.1 Knowledge Base

Entries the AI injects into a lead conversation. `scope` decides **which campaigns**
see an entry; `injectAfter` decides **when** it enters the prompt — `'always'`, or
after N inbound messages (the screenshots' `4msg` / `3msg` chips).

```ts
type InjectAfter = 'always' | '1' | '2' | '3' | '4' | '5';
type Scope = 'all' | 'hidden' | number[];   // number[] = campaign ids it's limited to

interface KBEntry { id: string; title: string; body: string; scope: Scope; injectAfter: InjectAfter; }
interface KBCategory {
  key: string; label: string;
  icon: 'services'|'faq'|'team'|'hours'|'policies'|'pricing'|'location'|'testimonials';
  entries: KBEntry[];
}
interface KnowledgeBase {
  count: number;                              // total entries (header badge)
  injectOptions: InjectAfter[];               // segmented control options
  available: { key: string; label: string }[]; // categories not yet added (“+ Pricing” chips)
  categories: KBCategory[];
}
```

The `ScopeChip` renders `all`→“All” (wine), `hidden`→“Hidden” (muted),
`number[]`→“C1+C3” (amber, positional index into `campaigns`). `InjectChip` renders
`"4msg"` (violet) and nothing for `'always'`. The `KBForm` composer writes a new
`KBEntry`: category select + title + body + `ScopePicker` (all / hidden / per-campaign
checkboxes) + inject-after segmented. Wire its **Save** to your create-entry mutation.

### Key metrics are **derived**, not stored

```ts
function deriveMetrics(d: AccountDetail) {
  const avgResp = Math.round(d.campaigns.reduce((s,c)=>s+c.resp,0) / d.campaigns.length);
  const activeContracts = d.contracts.filter(c=>c.status==='active').length;
  return [
    { key:'campaigns', label:'Campaigns',    value:d.campaigns.length, sub:'all active',            accent:'var(--wine)' },
    { key:'response',  label:'Avg response', value:`${avgResp}%`,      sub:'across all',            accent:'var(--good)' },
    { key:'contracts', label:'Contracts',    value:d.contracts.length, sub:`${activeContracts} active`, accent:'var(--stage-contacted)' },
    { key:'team',      label:'Team',         value:d.team.length,      sub:'1 owner',               accent:'var(--mute)' },
  ];
}
```

If your API already returns aggregate stats, feed them straight into `MetaChip`
instead of deriving — the chip only needs `{ label, value, sub, accent }`.

---

## 5. Design tokens → your `tokens.css`

The prototype's tokens live in `design-system.css`. Yours use "similar terms" —
map them with this table. **Do a find-and-replace per row**, then delete
`design-system.css`. Don't touch the `.neu-*` shadow recipes' raw px values; just
re-point the color/space/radius vars.

| Prototype var | Value | Role → map to your token |
|---|---|---|
| `--wine` / `--wine-grad` | `#5E2230` / gradient | primary accent / primary button fill |
| `--bg` | `#ECE7DD` | page ground |
| `--bg-2` | `#E4DCCC` | sidebar / secondary ground |
| `--surface` | `#F5F1E8` | raised card surface |
| `--card` | `#FFFFFF` | brightest cards |
| `--ink` / `--ink-soft` | `#1F1A14` / `#322B22` | primary / softened text |
| `--mute` / `--mute-2` | `#6C6354` / `#948A77` | secondary / tertiary text |
| `--line` / `--line-strong` | warm alphas | hairlines / stronger borders |
| `--good` / `--good-tint` | `#2F9461` | active/positive (status pills) |
| `--warn` / `--warn-tint` | `#DA9426` | pending/paused |
| `--stage-contacted` | `#547BB0` | the Contracts metachip accent (any blue works) |
| `--r-flush…--r-pill` | `6→999px` | radius scale |
| `--space-xxs…--space-3xl` | `4→28px` | spacing scale |
| `--sh-inset-crisp` / `--sh-raised-*` | shadows | neumorphic depth — keep as-is |
| `--serif` / `--mono` / `--sans` | font stacks | display / mono / body fonts |

**Component classes you must carry over** (or alias to your equivalents):
`.la-btn` (+ `--wine` `--soft` `--inset` `--icon` `--lg`), `.la-seg` + `.la-seg-btn.on`
(the tab control), `.la-status` (status pill), `.la-camp-card` (rail/list row),
`.la-mono-tile` (avatar tile), `.neu-raised` / `.neu-inset` / `.neu-inset-crisp`
(card shells), `.eyebrow` / `.eyebrow-sm`, `.row` / `.rule` / `.divider-v` / `.dot`.

---

## 6. Shared chrome (Sidebar / TopBar)

You mentioned you're bundling the left toolbar into a single shared module used by
every page. **Do that here too:**

- **`Sidebar`** in `components.jsx` is a stand-in. Delete it and render your
  existing shared sidebar; just pass it `active="Accounts"` (or your route key).
- **`TopBar`** is page-specific (it owns the tabs + Edit/⋯ actions), but its
  *outer shell* (height 60, border, the left "Accounts (n)" cell that aligns over
  the rail) should match your global header rhythm. If you have a shared
  `<PageHeader>`, mount the tabs + actions as its `children` / `actions` slots
  rather than re-styling.
- The 60px header height and the rail width (`290px`) are shared constants
  (`RAIL_W`, header `60`). Hoist them to your layout config so the TopBar's left
  cell stays pixel-aligned over the rail if either changes.

---

## 7. Where to wire your existing functionality

Every interactive element is currently inert. Hook points, in priority order:

| UI | Prototype state | Wire to |
|---|---|---|
| Rail account click | none | route to `/accounts/:id` (or set selected id) → refetch `AccountDetail` |
| TopBar tabs | `useState('overview')` | keep local, or sync to `?tab=` query param |
| **Edit account** / panel **Edit** | no-op | your account edit modal/route |
| Field rows (`FieldRow`) | display only | if inline-editable, make them controlled inputs; `dropdown` ones are selects |
| **Search / Filter** (TopBar icons) | no-op | filter the rail list query |
| `New` / `Invite` / `Add` (panel actions) | no-op | your create-campaign / invite-member / add-contract flows |
| Integration **Edit** + 👁/⧉ on fields | no-op | your secrets reveal + copy-to-clipboard + connection editor |
| Voice **Play / Upload** (in Integrations) | no-op | audio player + upload to your voice-clone service |
| KB **Add entry** → `KBForm` **Save** | local-only form state | create-entry mutation (title, body, category, `scope`, `injectAfter`) |
| KB entry hover **edit / delete** | no-op | update / delete entry |
| KB **+ category** chips (`available`) | no-op | create-category, then it leaves `available` |
| **Create account** (rail) | no-op | your create-account flow |

Pattern: give each panel an `on*` callback prop (`onEditAccount`, `onAddCampaign`,
`onInviteMember`, …) rather than wiring deep inside. Keeps the panels pure and
testable.

---

## 8. Gotchas

- **Drop Babel-in-browser & the Tweaks panel.** They're prototype scaffolding.
  The Tweaks panel (`tweaks-panel.jsx`) drives light/density/font/width-mode — none
  of it ships. The light-angle CSS vars (`--lx`, `--light-*`, `--depth-scale`) are
  set from Tweaks; in production set them once in `tokens.css` to your chosen values.
- **`window.*` sharing → ES imports.** Replace every `Object.assign(window, {...})`
  with `export`, and the implicit globals (`Icon`, `StatusPill`, `Panel`…) with
  `import`.
- **Inline CSS-var strings.** The prototype writes `style={{ borderRadius: 'var(--r-card)' }}`
  (quoted). That's valid in TSX too — keep the quotes. Bare `var(--x)` is a syntax error.
- **Font-swap flash.** `--serif` is Instrument Serif (loaded late). Headings may
  reflow on first paint; preload the font or set `font-display: optional` in prod.
- **One primary action per view.** The design system allows a single `.la-btn--wine`
  per surface — here it's **Edit account** in the TopBar. Keep panel actions `--soft`/`--inset`.
- **Status vocab.** `Status` (account/campaign) and `Contract` status are different
  enums with different pills (`StatusPill` vs `ContractPill`). Don't merge them.

---

## 9. Suggested Claude Code prompt

> Migrate the Accounts page from the prototype into our app. Read
> `accounts-workspace.jsx` and `accounts-components.jsx` for the markup, and
> `ACCOUNTS_MIGRATION.md` for the plan. Create `features/accounts/` with one
> component per file (TopBar, Rail, IdentityHeader, MetaChip, the section panels,
> OverviewRegular, OverviewUltra, AccountsWorkspace) as `.tsx`, using the
> interfaces in §4. Replace `ACCOUNTS_DATA` with our `useAccount(id)` query and the
> rail with `useAccounts()`. Reuse our shared `<Sidebar>` and `<PageHeader>` — do
> not re-implement chrome. Map `design-system.css` tokens onto our `tokens.css`
> per §5; keep `.la-btn`/`.la-seg`/`.neu-*` class names (alias if needed). Keep
> `useUltraWide` (detail-width ResizeObserver, breakpoint 1450). Wire the action
> buttons in §7 to our existing handlers; leave a typed `on*` prop for each so I
> can connect any that are ambiguous. Don't ship the Tweaks panel or Babel.

---

*Generated alongside `Accounts Page.html`. The mobile version lives in
`Lead Awaker Mobile.html` → More → Accounts (`mobile-accounts.jsx`) and shares the
same `AccountDetail` model.*
