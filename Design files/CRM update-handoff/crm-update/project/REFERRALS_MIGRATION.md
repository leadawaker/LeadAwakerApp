# Referrals Page — Migration Guide (HTML/JSX → React + TypeScript)

This document is a handoff for migrating the **Referrals Page** prototype into your production React/TypeScript CRM. It is written to be pasted directly into a Claude Code session so the migration happens in one pass without breaking your existing wiring.

> **What you built here is presentation-only.** No real API calls, no real WhatsApp sends, no real Google review hooks. Every value comes from a static `REF_DATA` object and every action is a no-op. Your job in the real app is to keep the **markup + styles** and swap the **data + handlers** for what your backend already has.

---

## 1. What the page is

A two-view Referral funnel workspace — board and list — with a persistent detail panel:

```
┌─────────────────────────────────────────────────────────────────────────┐
│ HEADER  Referrals  [Board][List]    🔔3  ✦ Referral ask · On  [W][M][Q]│  ← height 64
├─────────────────────────────────────────────────────────────────────────┤
│ KPI STRIP  Asks sent · Names received · Converted · Conversion rate     │  ← ~100px
│ MODEL RIBBON  "Happy customers are asked for a referral…"               │  ← ~40px
├──────────────────────────────────────────────────────┬──────────────────┤
│                                                      │  DETAIL PANEL    │
│  BOARD view (flex 3 columns):                        │  clamp(360–440px)│
│    Asked           Received          Converted       │                  │
│    (AUTO)          (YOU)             (YOU)           │  Referral chain  │
│    invite sent     name came back    booked          │  What they sent  │
│    <RefCard/>      <RefCard/>        <RefCard/>      │  Contact         │
│                                                      │  The ask message │
│  OR                                                  │  Timeline        │
│                                                      │  Action bar      │
│  LIST view (full-width table):                       │                  │
│    Referrer | Referred | Contact | Stage | Updated   │                  │
│                                                      │                  │
└──────────────────────────────────────────────────────┴──────────────────┘
```

The funnel has three stages:
- **Asked** — the engine sent an invite on WhatsApp; waiting for a name (AUTO)
- **Received** — a name (and usually a contact) came back; a human must work it (YOU)
- **Converted** — the referred person booked a job; human-marked

The detail panel is always visible on desktop. It shows the referral chain, the original WhatsApp thread reply, and the next-action buttons appropriate to the current stage.

---

## 2. File map (prototype → suggested target)

| Prototype file | Role | Suggested target |
|---|---|---|
| `Referrals Page.html` | Shell: React/Babel bootstrap + Tweaks panel | `app/referrals/page.tsx` — drop the Tweaks panel & Babel |
| `referrals-app.jsx` | Entire page: `ReferralsPage`, `RefKpi`, `RefCard`, `RefColumn`, `RefListView`, `RefDetail`, `RefAvatar`, `RefStars`, `RefChannelChip`, `RefNotifRow`, `RefNotifPopover` | `features/referrals/` (split into files below) |
| `referrals-data.js` | Static seed `window.REF_DATA` | Delete — replace with your API hooks (see §4) |
| `components.jsx` | `Sidebar`, icon set, `IconGift`, `IconCheck` | **Already shared in your app** — see §6 |
| `design-system.css` | Tokens + component classes | Map onto your `tokens.css` — see §5 |

### Suggested file split inside `features/referrals/`

| File | Components |
|---|---|
| `ReferralsPage.tsx` | `ReferralsPage` (shell, owns view/activeId/notifs state) |
| `BoardView.tsx` | `RefColumn`, `RefCard` (all three card variants) |
| `ListView.tsx` | `RefListView` |
| `DetailPanel.tsx` | `RefDetail`, `RefAvatar`, `RefStars`, `RefChannelChip` |
| `NotifPopover.tsx` | `RefNotifPopover`, `RefNotifRow` |
| `KpiStrip.tsx` | `RefKpi` (×4 KPI cards) |
| `atoms.tsx` | `RefAvatar`, `RefStars`, `RefChannelChip`, inline icons |

---

## 3. Component tree

```
<ReferralsPage>                          // owns: view, time, activeId, notifs, notifOpen
├─ <Sidebar active="Referrals" badges={{ Referrals: received.length }} />
└─ column
   ├─ <PageHeader>                       // height 64
   │    "Referrals" eyebrow
   │    <la-seg>  Board | List  </la-seg>
   │    <NotifBell unread={unread} onClick />  → <RefNotifPopover />
   │    referral-ask status pill (config.enabled ? 'On' : 'Off')
   │    <la-seg>  Week | Month | Quarter  </la-seg>
   │  </PageHeader>
   │
   ├─ <KpiStrip />                       // asks sent · names received · converted · rate
   │
   ├─ model ribbon                       // "Happy customers are asked…"
   │
   └─ row (fills height)
      ├─ (view === 'board')  <BoardView stages referrals activeId onSelect />
      │    <RefColumn stage items activeId onSelect />  ×3
      │      <RefCard r active onClick />  (variant by r.status)
      │
      └─ (view === 'list')   <RefListView stages referrals activeId onSelect />
      │
      └─ <DetailPanel (flex 0 0 clamp(360px,30vw,440px))>
           <RefDetail r config />
         </DetailPanel>
```

---

## 4. Data model (TypeScript interfaces)

Replace `REF_DATA` with these. Field names mirror `referrals-data.js` exactly.

### 4.1 Referral

```ts
type ReferralStatus  = 'asked' | 'received' | 'converted';
type ContactType     = 'email' | 'phone';
type Channel         = 'whatsapp' | 'sms';
type ReferralLang    = 'nl' | 'en' | string;
type IncentiveFaming = 'neutral' | 'reward' | 'charity';

interface Referral {
  id:              string;
  status:          ReferralStatus;
  channel:         Channel;
  lang:            ReferralLang;

  // Referrer (the happy customer who was asked)
  referrer:        string;
  refIni:          string;         // 2-letter initials (derived)
  refRating:       1 | 2 | 3 | 4 | 5;
  refJob:          string;         // job they had done, e.g. 'Garden decking'

  // Ask timestamps
  askedAgo:        string;         // '6h' | '1d' | '4d'
  askedDate:       string;         // '23 Jun'
  followUp:        boolean;        // has a follow-up nudge been sent?

  // Referred person (populated once status !== 'asked')
  referred?:       string;         // null for asked
  refdIni?:        string;
  refdJob?:        string;         // job the referred person wants
  contact?:        string;         // phone or email
  contactType?:    ContactType;
  reply?:          string;         // the referrer's WhatsApp reply text

  // Stage timestamps (present once stage is reached)
  receivedAgo?:    string;
  receivedDate?:   string;
  convertedAgo?:   string;
  convertedDate?:  string;

  // Extra context
  note?:           string;         // agent note on the referred person
}
```

### 4.2 Stage

```ts
interface Stage {
  key:    ReferralStatus;
  label:  string;          // 'Asked' | 'Received' | 'Converted'
  color:  string;          // CSS var — 'var(--stage-contacted)' | 'var(--wine)' | 'var(--good)'
  owner:  'engine' | 'you';
  desc:   string;          // column subtitle
  star?:  boolean;         // true for Converted (green inset tray)
}
```

### 4.3 Referral config

```ts
interface ReferralConfig {
  enabled:  boolean;
  framing:  IncentiveFaming;
  reward:   string;        // e.g. '€50 credit' — shown only when framing === 'reward'
  channel:  Channel;
  business: string;        // business display name used in the ask message
}
```

### 4.4 KPIs

```ts
interface ReferralKpis {
  asksSent:        number;
  namesReceived:   number;
  converted:       number;
  conversionRate:  number;   // % of asks that converted  (derived: converted / asksSent * 100)
}
```

### 4.5 Notifications

```ts
type NotifType = 'referral_received' | 'referral_converted' | 'referral_asked';

interface ReferralNotif {
  id:     string;
  type:   NotifType;
  refId:  string | null;   // links to Referral.id — null for system events
  title:  string;
  body:   string;
  time:   string;          // '4h ago'
  unread: boolean;
}
```

### 4.6 The ask-message builder (copy this logic exactly)

```ts
function buildAsk(referral: Referral, config: ReferralConfig): string {
  const first = referral.referrer.split(/\s+/)[0];
  const nl = referral.lang === 'nl';
  let base = nl
    ? `Hoi ${first}, bedankt voor je mooie review! Ken je iemand die ook ${referral.refJob.toLowerCase()} of ander werk nodig heeft? Stuur dit bericht gerust door of laat hun naam achter.`
    : `Hi ${first}, thanks for the lovely review! Know anyone who could use ${referral.refJob.toLowerCase()} or similar work? Forward this message, or just send us their name.`;
  if (config.framing === 'reward')
    base += nl
      ? ` Als dank krijg je ${config.reward} op je volgende klus. 🙏`
      : ` As a thank-you, we'll add ${config.reward} to your next job. 🙏`;
  if (config.framing === 'charity')
    base += nl
      ? ` Voor elke aanmelding die boekt doneren we €25 aan een goed doel.`
      : ` For every referral that books, we donate €25 to charity.`;
  return base;
}
```

This is rendered in the detail panel under "The ask" for `status === 'asked'` referrals. The framing (neutral / reward / charity) and reward amount come from `ReferralConfig`, which is set in the Reputation Settings tab (`settings.referral`). If your app stores the config server-side, fetch it with `useReferralConfig()`.

---

## 5. Design tokens → your `tokens.css`

Same mapping as `ACCOUNTS_MIGRATION.md §5`. Key tokens specific to this page:

| Token | Used for |
|---|---|
| `--stage-contacted` | "Asked" stage color (the column dot, stage pill, `AUTO` label) |
| `--wine` | "Received" stage color, referral action CTAs |
| `--good` | "Converted" stage color, WhatsApp channel chip, conversion indicators |
| `--warn` | "Nudged" follow-up badge on Asked cards |
| `--wine-tint` | Active notification background, active board card outline |
| `--good-tint` | Converted column tray background |

The `RefCard` for "received" uses a double inset shadow to convey urgency (it's the human's move):
```ts
boxShadow: 'var(--sh-raised-crisp), inset 0 0 0 1.5px rgba(94,34,48,0.18)'
```
Keep this as-is or alias it — it's intentional visual hierarchy.

---

## 6. Shared chrome

- **`Sidebar`**: pass `active="Referrals"` and `badges={{ Referrals: received.length }}`. The badge is the count of `status === 'received'` referrals (names that came back and need a human).
- **`IconGift`**, **`IconCheck`**: from `components.jsx` / your shared icon library.
- **Inline icons** (`RfStar`, `RfWA`, `RfMail`, `RfPhone`, `RfArrow`, `RfCheck`, `RfClock`, `RfBell`, `RfGiftSm`) are defined locally in `referrals-app.jsx`. Move them to your icon system or keep them file-local.
- The page header (height 64, border-bottom) follows the same pattern as every other page. If you have a shared `<PageHeader>`, mount the Board/List seg + notifications bell + referral-ask pill + time seg in its `actions` slot.

---

## 7. State that lives at the top level

```ts
// Board vs list
const [view, setView] = useState<'board' | 'list'>('board');

// Time filter — currently drives display only (no data filtering in prototype)
// In production: pass to useReferrals({ period: time })
const [time, setTime] = useState<'week' | 'month' | 'qtr'>('month');

// Selected referral (highlights card + drives detail panel)
const [activeId, setActiveId] = useState<string | null>(initialId);
const active = referrals.find(r => r.id === activeId) ?? null;

// Notification bell
const [notifs, setNotifs] = useState<ReferralNotif[]>(initialNotifs);
const [notifOpen, setNotifOpen] = useState(false);
const unread = notifs.filter(n => n.unread).length;
```

`initialId`: default-select the freshest `status === 'received'` referral — the item most urgently needing a human. Fall back to the first referral if none are received.

---

## 8. Where to wire your existing functionality

| UI | Prototype state | Wire to |
|---|---|---|
| **Board cards / list rows** | `REF_DATA.referrals` | `useReferrals({ period?, status? })` → `Referral[]` |
| **KPI strip** | `REF_DATA.kpis` | `useReferralKpis({ period })` → `ReferralKpis` (or derive from the referrals list) |
| **Notification bell** | `REF_DATA.notifications` | `useReferralNotifications()` + mark-read mutation |
| **Notification click** — opens the linked referral | local `setActiveId(n.refId)` | same, but also close the popover |
| **Mark all read** | local `setNotifs(...)` | `useMarkAllNotifsRead()` |
| **"Send a nudge"** (Asked card action bar) | no-op | `useSendNudge(referralId)` → POST WhatsApp follow-up |
| **"Cancel ask"** | no-op | `useCancelReferralAsk(referralId)` |
| **"Message {name}"** (Received card action bar) | no-op | open your WhatsApp compose flow with `referral.contact` |
| **"Mark converted"** | no-op | `useMarkConverted(referralId)` → moves card to Converted column |
| **"Dismiss"** (Received) | no-op | `useDismissReferral(referralId)` |
| **Referral ask config** (`config`) | `REF_DATA.config` (+ Tweaks `framing` prop) | `useReferralConfig()` — this config is set in the **Reputation Settings** tab (`settings.referral`), not on this page |
| **Time filter** (Week / Month / Quarter) | local `useState('month')` | pass as `period` param to `useReferrals` and `useReferralKpis` |

---

## 9. Responsive behaviour

The detail panel uses `clamp(360px, 30vw, 440px)`. On a 1280px viewport that's ~384px, comfortable beside a 3-column board. Below about 900px the board columns get too narrow — add a breakpoint where the detail panel hides and tapping a card opens it fullscreen (or as a drawer). The prototype does not implement this; you will need to add it.

The list view is a CSS grid with `gridTemplateColumns: '1.4fr 1.4fr 1fr 0.9fr 0.7fr'`. On tablet, collapse the Contact and Updated columns.

---

## 10. Gotchas

- **`buildAsk` depends on `config.framing` and `config.reward`.** The framing shown in the "The ask" section of the detail panel must stay in sync with what the Reputation Settings tab saved. If the user changes the framing in Settings and you don't refetch the config, the detail panel will show a stale ask. Use a shared query (`useReferralConfig()`) rather than prop-drilling from the reputation page.
- **The `refId` on notifications links to the board.** When a user clicks a notification, `setActiveId(n.refId)` and `setNotifOpen(false)`. In production, also mark the notification read. If `n.refId` points to a referral that was deleted or converted and is no longer in the list, handle the null case gracefully.
- **Board vs list share the same `activeId`.** Switching views should not reset the selection — the same card stays highlighted in both views. This is intentional.
- **Three card variants for one `<RefCard>` component.** Each `status` renders a very different layout. Keep the three branches inside one component (as the prototype does) — they share avatar, stars, and timestamp logic. Don't split into three separate files.
- **Conversion is human-triggered.** The `converted` status is never set automatically — a human presses "Mark converted". Your mutation must optimistically update the board column and invalidate the KPI query.
- **The `--stage-contacted` color** (blue) is used for the Asked column. Make sure this token is defined in your `tokens.css`. Its value is `#547BB0` (or the nearest blue in your palette).
- **Drop Babel-in-browser & Tweaks panel.** The Tweaks panel in `Referrals Page.html` drives light angle, intensity, depth scale, density, display font, and `framing` (incentive framing). In production: fix the light/depth CSS vars in `tokens.css`, and source `framing` from the database via `useReferralConfig()`.
- **`window.*` → ES imports.** Replace every `Object.assign(window, {...})` with `export`, and implicit globals (`Sidebar`, `Icon`, `IconGift`, …) with `import`.

---

## 11. Suggested Claude Code prompt

> Migrate the Referrals page from the prototype into our app. Read
> `referrals-app.jsx` for the markup and `REFERRALS_MIGRATION.md` for the plan.
>
> Create `features/referrals/` with the files listed in §2. Use the TypeScript
> interfaces in §4.
>
> Replace `REF_DATA` with:
> - `useReferrals({ period? })` → `Referral[]`
> - `useReferralKpis({ period })` → `ReferralKpis`
> - `useReferralNotifications()` → `ReferralNotif[]` + `useMarkNotifRead(id)`
> - `useReferralConfig()` → `ReferralConfig` (sourced from reputation settings)
>
> Copy the `buildAsk(referral, config)` function from §4.6 exactly — it builds the
> WhatsApp ask preview shown in the detail panel.
>
> Default-select the freshest `status === 'received'` referral on mount.
>
> Reuse our shared `<Sidebar>` and `<PageHeader>` — do not re-implement chrome.
> Map `design-system.css` tokens onto our `tokens.css` per §5. Keep `.la-btn` /
> `.la-seg` / `.neu-*` class names (alias if needed). Preserve the double-inset
> shadow on Received cards (`var(--sh-raised-crisp), inset 0 0 0 1.5px rgba(94,34,48,0.18)`).
>
> Wire the action buttons in §8 to our existing handlers; leave a typed `on*` prop
> for each so I can connect any that are ambiguous. Don't ship the Tweaks panel
> or Babel.
