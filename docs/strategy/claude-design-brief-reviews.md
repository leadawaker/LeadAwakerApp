# Claude Design Brief — Reputation Workspace (incl. Reviews / public review response)

> **Purpose:** a self-contained brief to hand to Claude Design for the **Reputation workspace**, with
> the new **Reviews** tab (public review monitoring + AI reply) as the centerpiece. Paste this as the
> design prompt. Engineering specs: `specs/reputation-management/` (generation half),
> `specs/channel-fallback/`, `specs/messaging-provisioning/`. The review-response **back-end** is in
> development in a separate session (Google Business Profile API + AI reply); this brief covers the
> front-end only.

## What we're designing

Lead Awaker is an AI WhatsApp lead-reactivation + reputation platform for premium service businesses
(home improvement, in the Netherlands). **Reputation management has two halves:**

1. **Generation** (already built) — after a job, ask the customer for feedback over WhatsApp; route
   happy ones to the Google review link, intercept unhappy ones privately before they post.
2. **Response** (new — design this) — monitor the reviews already public on Google, and reply to them
   (especially negatives) with an AI-drafted, human-approved response.

Design these as **one Reputation workspace with three tabs: `Overview` · `Reviews` · `Feedback`.**
`Reviews` is the new surface and the default landing.

## Non-negotiable design language (read first)

This is **not** a generic CRM. Personality: **Linear/Stripe** — confident, minimal, data-dense,
calm-premium. Match the existing app exactly:

- **Palette:** warm-bone neumorphic with a deep **wine** accent (`--primary` #5E2230) on bone
  (`#ECE7DD`) with white raised cards. **Tokens only — never hardcode hex.**
- **Depth via neumorphic shadows, not borders** (`neu-raised`, `neu-inset`, `neu-polished`). Radius
  tiers `--r-button/surface/card/panel/pill`. 8px spacing scale.
- **Type:** Playfair Display (headings + big metric numbers), Manrope (body), Geist Mono (eyebrows,
  labels, data, status pills).
- **No backdrop dialogs.** Create/edit = inline right-panel; menus = popover; `Dialog` only for
  destructive confirms. Dropdowns/popovers are solid `bg-white`.
- **Compose existing primitives:** `ListCard`, `GroupHeader`, `SectionCard`, `Pill`, `ViewTabBar`,
  `SearchPill`, `IconBtn`, `EntityAvatar`. Page shell = `.la-page` + `.la-page-header`.
- **Mobile-first** (the app has a real mobile shell): below 768px, list → full-screen detail (no
  backdrop), composer as a glass bottom sheet, sticky primary CTA, safe-area insets.
- **Calm, not alarm:** negatives use **wine** (brand emphasis), not panic-red; positives a calm
  emerald (`--chart-2`); neutral muted; stars colored by value.
- **Language:** Dutch-first market. Sample/placeholder copy in **en + nl**. AI replies are generated
  in the **reviewer's own language** (so a Dutch review gets a Dutch reply).

## Workspace shell

`.la-page` + `.la-page-header` with a `ViewTabBar`: **Overview · Reviews · Feedback.** A "Needs reply"
count badge on the Reviews tab and the nav item. Content-width cap, full-height columns
(`overflow-hidden` + `min-h-0` parents, scroll children `min-h-0 overflow-y-auto`).

---

## Tab 1 — Reviews (the hero) — two-pane "review inbox"

Mirror the conversations/leads split-pane: left list panel (`w-[340px]`, `ListCard`) + right detail.
It's a triage tool → **default filter "Needs reply", sorted lowest-rating-first.**

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  Reviews          ★ 4.6 · 128 reviews     [All] [Needs reply •7] [Replied]     │ topbar
│                                              🔎   ↕ Sort   ▾ Google             │
├────────────────────────────┬─────────────────────────────────────────────────┤
│ NEEDS REPLY · 7            │  Jan de Vries           ★☆☆☆☆      Google ↗       │
│ ┌────────────────────────┐ │  2 days ago                                       │
│ │▎JD Jan de Vries  ★☆☆☆☆ │ │  ───────────────────────────────────────────────  │
│ │   "Kitchen install was │ │  "Kitchen install was delayed three weeks and no  │
│ │    delayed three…"     │ │   one called me back. Very disappointed."         │
│ │   Google · 2d   •Needs │ │                                                   │
│ └────────────────────────┘ │  ┌ AI-DRAFTED REPLY — REVIEW BEFORE POSTING ─────┐ │
│ ┌────────────────────────┐ │  │ Dag Jan, onze welgemeende excuses voor de     │ │
│ │ MB Mariska B.  ★★★★★    │ │  │ vertraging en het uitblijven van contact…     │ │
│ │   "Super netjes werk…" │ │  │ [ editable textarea — neu-inset well ]        │ │
│ │   Google · 3d   •Repl. │ │  │ Tone: (Apologetic)(Grateful)(Pro)   ↻ Regen   │ │
│ └────────────────────────┘ │  └───────────────────────────────────────────────┘ │
│ ┌────────────────────────┐ │  [ Post reply ]   Save draft    Escalate ⚑ + note │
│ │ …                      │ │  ─────────────────────────────────────────────────│
│ └────────────────────────┘ │  ● Received 2d → ● AI drafted 2d → ○ Posted        │
└────────────────────────────┴─────────────────────────────────────────────────┘
```

**Topbar:** title "Reviews" (Playfair) · rating summary chip `★ 4.6 · 128 reviews` (Geist Mono) ·
segmented tabs `All / Needs reply / Replied / Negative` (default Needs reply) · platform filter popover
(Google now; multi-platform later) · sort popover (Newest / Lowest rating first) · `SearchPill`.

**Left list card** (compose `ListCard`): reviewer avatar/initial (`EntityAvatar`), name (16px
`font-heading` semibold), star rating colored by sentiment, 2-line snippet (muted), platform glyph +
relative time (Geist Mono), status `Pill` (Needs reply / Drafted / Replied / Ignored), and a **wine
left-accent stripe for 1–2★**. Selected = white card + `--sh-raised-crisp`.

**Right detail — the AI composer is the centerpiece** (this is the demo moment):
- Header: reviewer, full ★ rating, platform + **"View on Google ↗"** (`ExternalLink`), date.
- Full review text in a quoted `SectionCard`.
- **Composer card:** eyebrow (Geist Mono) "AI-DRAFTED REPLY — REVIEW BEFORE POSTING"; AI draft
  pre-filled in an editable `neu-inset` well with a **"thinking" shimmer** while generating; **tone
  preset pills** (Apologetic / Grateful / Professional / Concise) + Regenerate (`RefreshCw`); subtle
  length guidance.
- Actions: **"Post reply"** (`--wine-grad` CTA) · "Save draft" · "Mark handled / ignore". For
  negatives, an extra row: **"Escalate to manager" + a private internal note** (not posted) + a small
  "make it right" nudge.
- **Status timeline** (compact vertical): Received → AI drafted → Posted by [user] (date). If already
  replied, show the posted reply with an **Edit** option (Google allows editing a reply).

**Principle:** AI drafts appear automatically (especially for negatives); the human edits and posts in
one click. **Never auto-post.** Make the composer feel fast and confident.

---

## Tab 2 — Overview (proof / reporting)

Reuse the existing Claude-design metric-card style (Playfair serif numbers, `PanelShell`/`SectionHead`).
North star = **respond fast + rating up** (the reputation equivalent of "Calls Booked").

```
┌──────────────────────────────────────────────────────────────┐
│  Overview                                                      │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐           │
│  │  AVG RATING  │ │ MEDIAN REPLY │ │  REPLY RATE  │           │
│  │   4.6 ▲0.2   │ │    23 min    │ │     94%      │  ← serif   │
│  └──────────────┘ └──────────────┘ └──────────────┘           │
│  ┌─────────────────────────────┐ ┌──────────────────────────┐ │
│  │ Rating over time (wine line)│ │ Needs reply · 7    → go   │ │
│  └─────────────────────────────┘ └──────────────────────────┘ │
│  Sentiment split (pos/neu/neg bar) · Reviews this month + spark│
└──────────────────────────────────────────────────────────────┘
```

Cards: **average rating** (big Playfair + trend), **median response time** (the speed story),
reply rate %, reviews-this-month + sparkline, sentiment split bar, a **"Needs reply" CTA card** that
jumps to the triage, and a rating-over-time line (`--chart-1` wine).

---

## Tab 3 — Feedback (the existing generation half — keep light)

This is the already-built WhatsApp feedback-ask / private-interception side. Design it as a queue:
served customers asked for feedback, with the **negative-interception queue** front and center
(unhappy customers caught before they post → routed to a manager). A funnel (served → asked →
positive→review link / negative→intercepted) and a feedback stream. This tab can reuse the same list +
detail pattern as Reviews. (Lower priority than the Reviews tab; include for completeness so the
workspace is whole.)

---

## Shared patterns to design once, reuse everywhere

1. **Channel / sender status pill** (recurs across Reputation, Speed-to-Lead, and the messaging setup
   panel): **SMS ready** (emerald) · **WhatsApp: pending Meta review** (amber) · **WhatsApp: approved**
   (emerald) · **rejected** (wine). This makes the "live on SMS while WhatsApp is in Meta review"
   reality visible. (A `MessagingCard` with these pills is already built in the accounts Integrations
   panel — match it.)
2. **AI-drafts-then-human-approves** — the signature interaction (review replies, and any AI-generated
   copy). Always show the "AI-drafted — review before posting" label + edit + regenerate.
3. **Platform glyph + platform filter** — every review card carries its source glyph (Google now) so
   adding Trustpilot/Facebook later needs no redesign. (Don't show Yelp — no API reply.)
4. **Source chip** (if lead surfaces are in scope) — small attribution chip on lead cards
   (Facebook / Instagram / Website form / Zapier) from the speed-to-lead work.

## States

- **Not connected:** a "Connect Google Business Profile" card mirroring the calendar OAuth connect
  card (button + explainer) — this is the back-end OAuth hook.
- **Connected, no reviews yet:** friendly empty state.
- **All caught up:** a satisfying "All caught up ✓" when nothing needs a reply.
- **Generating / posting:** thinking shimmer on the composer; optimistic update on post with the
  timeline advancing.

## Notifications

New negative review → in-app notification + a badge on the Reputation nav item and the "Needs reply"
tab. (Engineering: `broadcastToUser`, never `broadcast`.)

---

## Delta vs the original reputation brief (what changed this session)

- **Two structural changes:** (1) Reputation is now a **3-tab workspace** (was just the feedback
  queue) with the new **Reviews** tab; (2) a **shared WhatsApp-pending / SMS-ready status pill**.
- **Provider locked: Twilio** (one number per client, WhatsApp + SMS). The messaging setup is a
  one-click "Set up messaging" card (already built) — design work here is just pill/status consistency.
- **Channel modes** (WhatsApp only / WhatsApp→SMS / SMS-first) + a per-message channel glyph, if
  campaign config screens are in scope.
- **Language:** en + nl for sample copy; AI replies match the reviewer's language.
