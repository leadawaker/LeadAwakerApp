# Reputation Workspace — Migration Guide (HTML/JSX → React + TypeScript)

This document is a handoff for migrating the **Reputation Workspace** prototype into your production React/TypeScript CRM. It is written to be pasted directly into a Claude Code session so the migration happens in one pass without breaking your existing wiring.

> **What you built here is presentation-only.** No real API calls, no actual Google OAuth, no real posting to Google. Every value comes from a static `REP_DATA` object and every action is a no-op. Your job in the real app is to keep the **markup + styles** and swap the **data + handlers** for what your backend already has.

---

## 1. What the page is

A three-tab Reputation workspace:

```
┌─────────────────────────────────────────────────────────────────────────┐
│ HEADER  Reputation  [Inbox 7] [Analytics] [Settings]  AUTO 4★  [G] [▶] │  ← height 64
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  TAB BODY (fills remaining height)                                      │
│                                                                         │
│  Inbox →    KPI strip (4 cards)                                         │
│             auto-mode info ribbon (conditional)                         │
│             ┌──────────────────┬───────────────────────────────────┐   │
│             │  LIST PANE       │  DETAIL PANE                      │   │
│             │  (width 348px)   │  (flex-1)                         │   │
│             │  view chips      │  review header                    │   │
│             │  search + sort   │  quoted review text               │   │
│             │  scrolling list  │  AI analysis card                 │   │
│             │                  │  AI composer (editable textarea)  │   │
│             │                  │  escalation row (negative only)   │   │
│             │                  │  status timeline                  │   │
│             │                  │  action bar (Post / Save / etc.)  │   │
│             └──────────────────┴───────────────────────────────────┘   │
│                                                                         │
│  Analytics → health score · 4 KPIs · attention card · rating chart     │
│              generation funnel · sentiment donut + distribution         │
│                                                                         │
│  Settings → 5 config panels (automation rule, reply voice, review       │
│             requests, referral ask, escalation)                         │
└─────────────────────────────────────────────────────────────────────────┘
```

Two operational modes driven by a single star-threshold setting:
- **Manual mode** (`threshold = 'never'`): every AI draft waits for approval
- **Auto mode** (`threshold = 4 | 5 | 3`): reviews at/above threshold are replied to automatically after a delay; exceptions (low-star, low-confidence) are held in the queue

The Inbox list shows two item types: **Google reviews** (primary) and **negative-feedback intercepts** (WhatsApp conversations caught before they become public reviews).

---

## 2. File map (prototype → suggested target)

| Prototype file | Role | Suggested target |
|---|---|---|
| `Reputation Workspace.html` | Shell: React/Babel bootstrap + Tweaks panel | `app/reputation/page.tsx` — drop the Tweaks panel & Babel |
| `reputation-app.jsx` | Page orchestrator: `RepWorkspace`, `RepInbox`, `RepInboxKPIs`, `RepAttentionHero`, `RepKpiCard`, `RepPlatformCard`, `RepConnectCard`, `RepCaughtUp`, `RepPopover`, `RepMenuItem` | `features/reputation/` |
| `reputation-components.jsx` | Shared atoms + review detail pane: `RepStars`, `RepAvatar`, `RepStatusPill`, `RepChannelPill`, `RepPlatformGlyph`, `RepSummaryChip`, `RepLangBadge`, `RepCard`, `RepLabel`, `RepListCard`, `RepComposer`, `RepAIAnalysis`, `RepTimeline`, `RepReviewDetail` | `features/reputation/components/` |
| `reputation-overview.jsx` | Analytics tab: `RepAnalytics`, `RepHealthCard`, `RepMetricCard`, `RepRatingChart`, `RepAttentionCard`, `RepAutoHandledCard`, `RepSentimentPie`, `RepDistribution`, `RepSLACard`, `RepGenerationFunnel`, `RepPanel` | `features/reputation/analytics.tsx` |
| `reputation-settings.jsx` | Settings tab: `RepSettings`, `RepToggle`, `RepSettingRow`, `RepSettingsPanel`, `RepStepper`, `RepTemplate`, `RepTokenRow`, `RepKeywordChips`, `RepTwoStep` | `features/reputation/settings.tsx` |
| `reputation-feedback.jsx` | Negative-feedback intercept pane: `RepFeedbackListCard`, `RepFeedbackDetail` | `features/reputation/feedback.tsx` |
| `reputation-data.js` | Static seed `window.REP_DATA` | Delete — replace with your API hooks (see §4) |
| `components.jsx` | Shared chrome: `Sidebar`, icon set, `IconSpark`, `IconCheck`, `IconSearch`, `IconSort`, `IconGift` | **Already shared in your app** — see §6 |
| `design-system.css` | Tokens + `.la-btn` / `.la-seg` / `.neu-*` | Map onto your `tokens.css` — see §5 |

The prototype shares components via `Object.assign(window, {...})` at the bottom of each file. In React/TS, replace those with normal `export` / `import`.

---

## 3. Component tree

```
<RepWorkspace>                            // owns: tab, auto rule, selection, badgeCount
├─ <Sidebar active="Reputation" badges={{ Reputation: badgeCount }} />
└─ column
   ├─ <PageHeader>                        // height 64
   │    "Reputation" eyebrow label
   │    <la-seg>  Inbox | Analytics | Settings  </la-seg>
   │    auto-mode pill  (conditional)
   │    <RepPlatformCard />               // Google Business Profile status + popover
   │    <button> Review queue </button>   // jumps to Inbox → "needs" view, first item
   │  </PageHeader>
   │
   ├─ (tab === 'inbox')     → <RepInbox state auto selection setSelection />
   ├─ (tab === 'analytics') → <RepAnalytics autoMode auto onOpenQueue />
   └─ (tab === 'settings')  → <RepSettings auto setAuto />
```

### RepInbox sub-tree

```
<RepInbox>
├─ <RepInboxKPIs />                        // 4 KPI cards (held / negative / auto-replied / coverage)
├─ auto-mode info ribbon (conditional)     // "4★+ replies post automatically…"
└─ row (flex, fills height)
   ├─ <list pane (width 348px)>
   │    view chips (needs / auto-replied / negative feedback / all)
   │    search input + sort popover
   │    scrolling list of <RepListCard /> | <RepFeedbackListCard />
   │  </list pane>
   └─ <detail pane (flex-1)>
        <RepAttentionHero />               // shown when nothing is selected
        OR
        <RepReviewDetail review />         // selected review
        OR
        <RepFeedbackDetail item />         // selected negative-feedback item
      </detail pane>
```

### RepReviewDetail sub-tree

```
<RepReviewDetail review autoPosted autoDelay>
├─ header: avatar + name + stars + status pill + platform + date + "View on Google"
├─ scroll body
│    quoted review text (neu-inset well)
│    (if replied)      posted-reply card
│    (if autoPosted)   auto-posted-reply card + audit trail
│    (if draft)        <RepAIAnalysis />  +  <RepComposer />
│    (if negative)     escalation row (make-it-right note + escalate-to-manager)
│    <RepTimeline />   status steps
└─ action bar
     Post reply | Save draft | Mark handled
     OR  Edit & repost | Undo post  (auto mode)
```

---

## 4. Data model (TypeScript interfaces)

Replace `REP_DATA` with these. Field names mirror the prototype's `reputation-data.js` exactly.

### 4.1 Reviews

```ts
type ReviewStatus    = 'needs' | 'drafted' | 'replied' | 'ignored';
type ReviewLang      = 'nl' | 'en' | string;
type ToneKey         = 'apologetic' | 'grateful' | 'professional' | 'concise';

interface ReviewAnalysis {
  issues: string[];          // themes / pain-points the AI detected
  reco:   string;            // recommended tone + posture, e.g. "Empathetic + ownership"
}

interface TimelineStep {
  key:   string;             // 'received' | 'drafted' | 'posted'
  label: string;
  who:   string | null;      // 'Google' | 'auto' | reviewer name | null
  ago:   string | null;      // '6h' | '2d' | null
  done:  boolean;
}

interface PostedReply {
  text: string;
  by:   string;              // user name or 'auto'
  ago:  string;
}

interface Review {
  id:          string;
  name:        string;       // reviewer display name
  ini:         string;       // 2-letter initials (derived)
  rating:      1 | 2 | 3 | 4 | 5;
  platform:    'google' | string;
  lang:        ReviewLang;
  ago:         string;       // '6h' | '2d' | '1w' — relative age for display
  date:        string;       // e.g. '23 Jun 2026'
  status:      ReviewStatus;
  job:         string;       // job type label (e.g. 'Badkamer renovatie')
  text:        string;       // full review text
  draft:       string | null;    // AI-drafted reply
  tone:        ToneKey | null;
  reply:       PostedReply | null; // null unless status === 'replied'
  timeline:    TimelineStep[];
  confidence:  number;       // 0–100 AI confidence in this draft
  analysis:    ReviewAnalysis | null;
  draftReady:  boolean;      // derived: status === 'needs' && !!draft
}
```

### 4.2 Negative feedback (intercepts)

```ts
type FeedbackStatus = 'open' | 'assigned' | 'resolved';

interface WAMessage {
  from: 'biz' | 'cust';
  ago:  string;
  text: string;
}

interface FeedbackNote {
  by:   string;
  ago:  string;
  text: string;
}

interface FeedbackItem {
  id:        string;
  name:      string;
  ini:       string;
  job:       string;
  ago:       string;
  sentiment: 'negative';
  lang:      ReviewLang;
  text:      string;         // the customer's complaint (from their WA message)
  status:    FeedbackStatus;
  assignee:  string | null;
  wa:        WAMessage[];    // WhatsApp thread
  notes:     FeedbackNote[];
}
```

### 4.3 Overview / Analytics

```ts
interface OverviewMetric {
  value: string;   // e.g. '4.6', '94'
  delta: string;   // e.g. '+0.2', '+6%'
  note:  string;   // e.g. 'vs last 90 days'
  suffix?: string;
  spark?: number[];
}

interface RatingSeries {
  rating:      number[];    // avg rating at each point
  volume:      number[];    // review count at each point
  axis:        string[];    // x-axis labels
  negatives:   number[];    // indices of points with negative reviews
  now:         number;      // last value (shown as label on chart)
  annotation:  string;      // e.g. '+0.2 vs previous 90 days'
}

interface Overview {
  health: {
    score: number; of: number; label: string; delta: string; note: string;
    drivers: { label: string; score: number }[];
  };
  metrics: {
    avgRating:   OverviewMetric;
    medianReply: OverviewMetric;
    replyRate:   OverviewMetric;
    thisMonth:   OverviewMetric;
  };
  ratingSeries: { week: RatingSeries; month: RatingSeries; quarter: RatingSeries };
  sentiment:    { positive: number; neutral: number; negative: number };
  distribution: { stars: number; count: number }[];   // 5→1
  responseSLA:  { band: string; pct: number; color: string }[];
}
```

### 4.4 Feedback generation funnel

```ts
interface FunnelStep {
  key:    string;
  label:  string;
  value:  number;
  pos?:   number;      // positive sub-value (shown in gold)
  neg?:   number;      // negative sub-value (shown in wine)
  combo?: boolean;     // gradient bar (both branches together)
  note?:  string;
}

interface FeedbackData {
  funnel:           FunnelStep[];
  referralAskRate:  { pct: number; asked: number; of: number; note: string };
  intercepted:      FeedbackItem[];   // the negative-interception queue
  routed:           { id: string; name: string; ini: string; job: string; ago: string; sentiment: 'positive'; clicked: boolean }[];
}
```

### 4.5 Settings / AutoRule

```ts
interface AutoRule {
  threshold:       'never' | 3 | 4 | 5;
  delay:           '15m' | '1h' | '2h';
  confidenceHold:  boolean;
  confidenceMin:   number;   // 0–100
  holdNegative:    boolean;  // 1–3★ always route to queue
}

interface RepSettings {
  auto:       AutoRule;
  reply: {
    toneBySentiment: { negative: ToneKey; neutral: ToneKey; positive: ToneKey };
    language:        'auto' | 'nl' | 'en';
    length:          'short' | 'standard' | 'detailed';
    signOff:         string;
    includeName:     boolean;
    guardrails: {
      noLegalFault:          boolean;
      noPublicComp:          boolean;
      noSpecificsEscalate:   boolean;
    };
  };
  request: {
    enabled:          boolean;
    channel:          'whatsapp' | 'sms';
    triggerDays:      number;
    followUp:         boolean;
    followUpDays:     number;
    frequencyCapDays: number;
    template:         string;
  };
  escalation: {
    onOneStar:       boolean;
    onLowConfidence: boolean;
    keywords:        string[];
    notifyChannel:   'email' | 'whatsapp' | 'slack';
    assignee:        string;
    dailyDigest:     boolean;
  };
  referral: {
    enabled:    boolean;
    askMin:     4 | 5;
    framing:    'neutral' | 'reward' | 'charity';
    reward:     string;
    delayDays:  number;
    channel:    'whatsapp' | 'sms';
    template:   string;
  };
}
```

### 4.6 Summary (derived, for KPI strip and badges)

```ts
interface RepSummary {
  avg:         number;   // average star rating
  count:       number;   // total reviews
  needsReply:  number;   // reviews with status === 'needs'
  negNeeds:    number;   // rating <= 2 && needs
  neuNeeds:    number;   // rating === 3 && needs
  posNeeds:    number;   // rating >= 4 && needs
  draftReady:  number;   // has a draft and needs reply
  replied:     number;   // status === 'replied'
  intercepted: number;   // feedback.intercepted.length
  oldestDays:  number;   // days since oldest unanswered review
  aiCoverage:  number;   // % of reviews that have an AI draft
}
```

### 4.7 The auto-posting predicate (copy this logic exactly)

```ts
function repAutoPosts(review: Review, auto: AutoRule): boolean {
  if (auto.threshold === 'never' || auto.threshold == null) return false;
  if ((review.rating ?? 0) < auto.threshold) return false;
  if (auto.holdNegative && review.rating <= 3) return false;
  if (auto.confidenceHold && review.confidence < auto.confidenceMin) return false;
  return true;
}
```

This predicate is the **single source of truth** for whether a review auto-posts or routes to the queue. It drives badge counts, list partitioning, the KPI strip, the attention hero, the analytics audit card, and the list-card "Auto-posted" tag. Do not duplicate the logic — import it everywhere.

---

## 5. Design tokens → your `tokens.css`

Same mapping as `ACCOUNTS_MIGRATION.md §5`. Key tokens specific to this page:

| Token | Value | Used for |
|---|---|---|
| `--wine` | `#5E2230` | Negative review sentiment, needs-reply status, wine KPI cards, auto-badge |
| `--wine-tint` | `rgba(94,34,48,0.08)` | Needs-reply backgrounds, AI composer header, auto-mode ribbon |
| `--wine-grad` | `linear-gradient(145deg,#6E2638,#4B1A26)` | Attention hero card, auto-mode composer badge |
| `--good` | `#2F9461` | Positive sentiment, "replied" status, high confidence, converted referrals |
| `--warn` | `#DA9426` | Neutral (3★) sentiment, "nudged" referral badge |
| `--stage-contacted` | `#547BB0` | Contacted/pending channel state |

The `rep-shimmer` and `rep-dots` CSS animations (in `Reputation Workspace.html`'s `<style>`) need to be moved to your global stylesheet or scoped to the composer component.

---

## 6. Shared chrome

- **`Sidebar`**: pass `active="Reputation"` and `badges={{ Reputation: badgeCount }}`. The badge count is `autoMode ? heldCount : summary.needsReply`.
- **`IconSpark`**, **`IconCheck`**, **`IconSearch`**, **`IconSort`**, **`IconGift`**, **`IconChats`**: these come from `components.jsx`. Import from your shared icon library.
- **Local icons** (`RIconExt`, `RIconRefresh`, `RIconFlag`, `RIconStarF`, `RIconEdit`, `RIconSend`, `RIconNote`, `RIconWA`, `RIconSms`, `RIconArrow`, `RIconClock`) are defined in `reputation-components.jsx`. These are R-prefixed to avoid collisions. Move them to your icon system or keep them as file-local.
- The page header (height 64, border-bottom) follows the same pattern as every other page. If you have a shared `<PageHeader>`, mount the tab seg + action buttons in its `actions` slot.

---

## 7. Where to wire your existing functionality

| UI | Prototype state | Wire to |
|---|---|---|
| **Google Business Profile connect** (`RepConnectCard`) | static button | Google OAuth → `useConnectGoogleBusiness()` |
| **Platform card** (`RepPlatformCard`) — shows connection status, last sync, future platforms | static | `useReputationPlatform()` → poll sync status |
| **Review list** (list pane) | `REP_DATA.reviews` | `useReviews({ status, platform })` |
| **View chip selection** (needs / auto-replied / neg feedback / all) | local `useState('needs')` | keep local; optionally sync to `?view=` param |
| **Search** (query filter) | local `useState('')` | filter client-side or add a `search` param to your query |
| **Sort** (lowest rating / newest) | local `useState('lowest')` | sort client-side |
| **`RepComposer`** — editable textarea + tone seg + Regenerate | local state only | `useGenerateDraft(reviewId, tone)` → POST to AI service |
| **Post reply** | no-op | `usePostReply(reviewId, text)` → POST to Google Business API |
| **Save draft** | no-op | `useSaveDraft(reviewId, text)` |
| **Mark handled** | no-op | `useMarkHandled(reviewId)` |
| **Edit & repost** / **Undo post** (auto mode) | no-op | `useEditReply` / `useUndoReply` |
| **Escalate to manager** | no-op | `useEscalate(reviewId, note)` |
| **View on Google** link | `href="#"` | `review.url` from your Google Business data |
| **Auto-reply rule** (`auto` state in `RepWorkspace`) | local state seeded from `REP_DATA.settings.auto` | `useAutoRule()` / `useUpdateAutoRule()` |
| **Settings tab save** | no-op | `useUpdateRepSettings(settings)` |
| **Feedback intercept list** (`feedback.intercepted`) | static | `useFeedbackIntercepts()` |
| **Feedback note add / assignee change** | no-op | `useAddFeedbackNote` / `useAssignFeedback` |
| **Analytics data** (`REP_DATA.overview`) | static | `useReputationAnalytics({ range })` |

Pattern: give each section component an `on*` callback prop (`onPostReply`, `onSaveDraft`, `onEscalate`, …) rather than wiring deep inside. Keeps the panels pure and testable.

---

## 8. State that lives at the top level

`RepWorkspace` owns three pieces of state that ripple everywhere — keep them at the top:

```ts
// Active tab
const [tab, setTab] = useState<'inbox' | 'analytics' | 'settings'>('inbox');

// Automation rule — drives badge, list partitioning, composer header, analytics
const [auto, setAuto] = useState<AutoRule>(settings.auto);
const autoMode = auto.threshold !== 'never';

// Selected inbox item (review or feedback intercept)
const [selection, setSelection] = useState<{ kind: 'review' | 'feedback'; id: string } | null>(initialSel);
```

`badgeCount` = `autoMode ? heldCount : summary.needsReply` — used in the Sidebar badge and the Inbox tab badge dot.

`initialSel` should be the newest held (exception) review — i.e. the lowest-rating review that does NOT auto-post under the current rule.

---

## 9. Gotchas

- **`repAutoPosts` is the source of truth.** Every place that decides "does this review go to the queue or auto-post?" must call this one function. Duplicating the logic causes badge counts to diverge from list contents.
- **Auto mode changes the entire Inbox UX.** In auto mode, the view chips change (Needs your attention / Auto-replied / Negative feedback / All), the KPI labels change (Held for your approval / Auto-replied today / Auto-reply rate), and the detail pane shows an "Auto-posted" card instead of the composer. Keep these branches in a single `autoMode` prop, not scattered conditions.
- **Two item types in the list.** The inbox list mixes `Review` and `FeedbackItem`. The selection state uses `{ kind, id }` to disambiguate. The detail pane checks `selection.kind` to render `RepReviewDetail` vs `RepFeedbackDetail`.
- **Shimmer + bounce animations** (`rep-shimmer`, `rep-dots`) are defined in the HTML `<style>` block, not in a JSX file. Move them to your CSS module or global stylesheet before deleting the HTML entry point.
- **Font-face flash.** `--serif` (Playfair Display / Instrument Serif) is loaded late. The serif large numbers in KPI cards and the attention hero reflow on first paint. Preload the font or set `font-display: optional`.
- **Drop Babel-in-browser & Tweaks panel.** The Tweaks panel in `Reputation Workspace.html` drives light angle, intensity, depth scale, density, display font, workspace state, landing tab, and automation rule. In production: fix the light/depth CSS vars in `tokens.css`, drop density (or use a user preference), and drive the automation rule from the database.
- **`window.*` → ES imports.** Replace every `Object.assign(window, {...})` with `export`, and implicit globals (`Icon`, `Sidebar`, `RepStars`, …) with `import`.

---

## 10. Suggested Claude Code prompt

> Migrate the Reputation Workspace from the prototype into our app. Read
> `reputation-app.jsx`, `reputation-components.jsx`, `reputation-overview.jsx`,
> `reputation-settings.jsx`, and `reputation-feedback.jsx` for the markup, and
> `REPUTATION_MIGRATION.md` for the plan.
>
> Create `features/reputation/` with one component per file. Use the TypeScript
> interfaces in §4. The `auto` rule state lives in `RepWorkspace` and is passed
> down as a prop — do not hoist it to global store unless your app already has a
> reputation slice.
>
> Replace `REP_DATA` with:
> - `useReviews({ status?, platform? })` → `Review[]`
> - `useFeedbackIntercepts()` → `FeedbackItem[]`
> - `useReputationAnalytics({ range })` → `Overview`
> - `useRepSettings()` / `useUpdateRepSettings()` for the Settings tab
>
> Copy the `repAutoPosts(review, auto)` predicate exactly from §4.7 — it must be
> the single source of truth for queue vs. auto-post decisions everywhere.
>
> Reuse our shared `<Sidebar>` and `<PageHeader>` — do not re-implement chrome.
> Map `design-system.css` tokens onto our `tokens.css` per §5. Keep `.la-btn` /
> `.la-seg` / `.neu-*` class names (alias if needed). Move `rep-shimmer` and
> `rep-dots` CSS animations to a scoped CSS module.
>
> Wire the action buttons in §7 to our existing handlers; leave a typed `on*` prop
> for each so I can connect any that are ambiguous. Don't ship the Tweaks panel
> or Babel.
