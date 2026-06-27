# AI Receptionist — Requirements

> Reframes and expands `specs/missed-call-textback/` from a single "missed-call text-back"
> feature into the **AI Receptionist** product: a channel-agnostic inbound receptionist that
> answers when a human cannot, triages intent, books appointments, and escalates to the owner.
> The engine + provisioning (missed-call channel) is already built; this spec adds the
> **conversation design, the lead-naming model, the surfaces, the client-visibility policy, and the
> positioning**. Strategy context: `docs/strategy/strategy.md`, `docs/strategy/speed-to-lead.md`.

## The reframe (read first)

"Missed-Call Text-Back" describes a trigger, not a product, and it benchmarks us against €50/mo
Twilio-reseller auto-texters. What we actually built is an AI that **answers, knows the business,
qualifies, books into the real calendar, and escalates only when it needs a human.** That is a hire,
not a text-back. We rename the product to **AI Receptionist** and position by outcome (booked
customers recovered), anchored against a human front-desk hire.

The differentiator, in one line: **most tools notify, ours resolves.**

**Channel-agnostic by design.** Missed-call and speed-to-lead are the same product from the customer's
point of view ("an inbound arrives, respond instantly, qualify, book"), differing only in the doorbell
(a phone call vs a web form). The engine already proves this: the missed-call webhook reuses
`speed_to_lead.fire_first_touch` verbatim. The standalone Speed-to-Lead page is **retired** and its
dashboard + settings are **absorbed** into the AI Receptionist as the first folding-in of a second
channel. Only the missed-call trigger is wired now; the receptionist is built to host web-leads next.

## Conversation design (the core decision)

The AI Receptionist is a **front-desk receptionist that triages, not a closer that pushes a deal.**
Inbound intent is heterogeneous (the caller drives), so the AI's first job is to discover intent and
route, not to sell a predetermined offer.

**Posture: receptionist-first triage.** On the lead's reply, the AI:

1. **Greets and discovers intent** ("Hi, you just called {business}, sorry we missed you. What can I
   help you with?").
2. **Routes by intent:**
   - **Schedule** → book it (the primary win; uses the existing booking machinery).
   - **Question** → answer from the Account Knowledge Base, then offer a next step.
   - **Buy / high intent** → qualify lightly, then book a call or hand to the owner.
   - **Wrong number / spam** → politely close; do not pester.
   - **Complaint / complex / angry / explicit human request** → hand off and notify the owner.

**Booking is the primary "win" outcome.** When intent allows, the AI's default proactive move is to
offer a booking (a call, a showroom visit, a consult, a quote visit). Booking reuses the existing flow.

**Posture is a per-campaign dial, not a global mode** (`receptionist_posture`: secretary / balanced /
sales) tuning booking-eagerness and handoff-aggressiveness.

**The prompt carries the weight.** Heavier than reactivation (which knows its goal): explicit
intent-classification, per-intent branches, KB grounding, a booking path, a handoff trigger, and the
restraint to not sell a wrong number. A new persona prompt over existing infra (`Prompt_Library`, KB
injection, `booking_mode`, handoff detector), not a new engine.

## Lead naming (never "Unknown")

A missed-call lead arrives with only a phone number. The display name resolves in three upgrades:

1. **On call:** the formatted phone number as the title (e.g. "+31 6 1234 5678") + a "Missed call" badge.
2. **On first WhatsApp reply:** upgrade to the WhatsApp profile name (`ProfileName` on the Twilio
   inbound payload, currently captured nowhere — new work).
3. **In conversation:** upgrade to the real name once the AI captures it.

Never render "Unknown". `features/voice/types.ts` already models `name: string | null` (null → phone).

## Surface design (settled)

Three surfaces, with a clean split between **operating conversations** and **configuring/measuring a
service**:

### 1. Conversations (the chats page) = operate every AI chat

The single operational inbox for **all** two-way AI WhatsApp threads (reactivation, missed-call, and
later speed-to-lead web-leads), differentiated by **service-type tabs in the topbar** that filter which
service the chats belong to. There is **no bespoke receptionist inbox**: the `features/voice/` inbox tab
is dropped, not rebuilt. Conversations is already the mature surface (`features/conversations/`:
`ChatPanel`, `ThreadList`, and a `VoiceMemoPlayer` for voicemail playback). A missed-call thread renders
its transcribed voicemail inline via that player and uses `leadDisplayName` for its title.

### 2. AI Receptionist page = configure + measure inbound

A **Dashboard + Settings** hub (no inbox), built on the **Speed-to-Lead page skeleton**
(`features/speed-to-lead/`: a campaigns-by-account list panel + a topbar with tabs + search + a tabbed
detail view). It absorbs Speed-to-Lead's dashboard cards (`MedianFirstTouchCard`,
`ResponseDistributionCard`, `ChannelMixCard`, `LeadSourcesCard`, `LiveFirstTouchFeed`,
`AiOperationsInsights`) and `SpeedToLeadSettings`, plus the missed-call provisioning from
`MissedCallCard` (enable, greeting record/upload/TTS, voicemail toggle, forward code), plus the **First
Message** editor and the **posture dial**. The standalone `/platform/speed-to-lead` route is retired.

### 3. Reputation = stays separate

Different data (public reviews, not lead conversations) and a different job, so it keeps its own inbox.

This matches how reactivation already works: its chats live in Conversations; its config/metrics live on
the Campaigns page. The receptionist follows the same rule.

## Client visibility + owner take-over (decided)

Clients **already have access to the chats page** (recently unblocked). Visibility is **per service**,
switched by the service tabs:

- **AI Receptionist → full interactions.** Clients see the complete conversation (it is their own
  inbound customer). If receptionist threads are still gated to a summary, **unblock them** so clients
  see the full chat.
- **Reactivation → summaries-only (unchanged).** The existing client summary feed (the
  `Conversion_Status IN ('Booked','Qualified','Lost')` rollup in `server/routes/conversations.ts`
  ~lines 305-335) stays as-is.

**The receptionist runs fully autonomously.** Manual interaction is an **owner option, never a
requirement**: the agency/Gabriel never has to touch a lead. The AI handles the conversation end to end
unless a human chooses to step in.

**Owner take-over mechanics (the owner's choice):**

1. The owner **jumps in** by sending anything from the chat panel (text, attachment, or voice memo).
   That manual send (through `sendToChannel` / `sendVoiceToChannel` / `sendPhotoToChannel` in
   `conversations.ts`) sets `leads.manual_takeover = true`, which **pauses the AI** (the engine's
   `inbound_handler.py` Step-8 guard already skips the AI while `manual_takeover` is set).
2. While paused, the lead's replies are stored and shown to the owner in real time, but the AI stays
   silent.
3. The owner hands control back with a **"Resume AI" button**, which clears `manual_takeover` **and
   triggers an immediate AI turn on the latest unanswered lead message** (so the AI replies right away to
   what the lead just said). If the last message was the owner's, it only clears the flag and the AI
   resumes on the lead's next reply. Clearing the flag alone is NOT enough: the AI only runs on the
   inbound webhook, so the resume action must explicitly kick off a turn.

## Owner notifications & the two handoff paths

Two distinct paths set `manual_takeover`; do not confuse them:

- **AI-initiated handoff** (already built): the engine's `handoff_detector` decides the AI needs a human,
  sets `manual_takeover = true`, and notifies the owner via `notify_manual_takeover`. **What should
  trigger this for a receptionist is an open product decision** (undecided). Recommended default
  triggers: an explicit request for a human, a complaint or anger, anything outside the knowledge base,
  or a high-stakes/complex ask. The `receptionist_posture` dial tunes how eagerly (secretary = escalate
  early, sales = escalate late).
- **Owner-initiated take-over** (this build): the owner sends a message (above). **No notification** —
  the owner is the one acting.

Plus a **"missed call arrived" notification**: when a missed call comes in, notify the owner ("Missed
call from {name}, the AI is handling it"). All owner notifications use `broadcastToUser` (never
`broadcast`).

## What is already built (do not rebuild)

From `specs/missed-call-textback/` (Phases 1-5, mostly done): engine voice webhooks
(`twilio_voice_mc_routes.py`), per-account provisioning (`MissedCallCard.tsx` + `server/routes/
missedCall.ts`), schema (`Accounts.missed_call_*`), `campaign_type = 'missed_call'`, approved-ready
en/nl opener bodies (`templates.md`). The Conversations chat surface
(`features/conversations/`) and the Speed-to-Lead skeleton (`features/speed-to-lead/`) also exist.

## What this spec adds

1. **Receptionist conversation prompt + posture dial** (engine/prompt).
2. **Lead naming** — `ProfileName` capture in the engine + a `leadDisplayName` resolver in the UI.
3. **Conversations service filter** — service-type topbar tabs; render missed-call threads (voicemail
   inline) in the unified inbox.
4. **Per-service client-visibility policy** — receptionist = full interactions + take-over; reactivation
   = summaries; both with a summary header.
5. **AI Receptionist page (Dashboard + Settings)** — rebuilt on the Speed-to-Lead skeleton; absorb its
   dashboard + settings; add the First Message editor and posture dial; surface missed-call
   provisioning. Retire the standalone Speed-to-Lead route.
6. **Owner real-time notification.**
7. **Correctness fix** — the daily-cap scoping bug.
8. **Rename/positioning** — nav label/route to "AI Receptionist"; keep `campaign_type='missed_call'` as
   the code routing key (rename product, not code).

## Acceptance criteria

- A missed-call lead **never displays "Unknown"**: formatted phone → WhatsApp profile name on reply →
  real name once captured.
- On reply, the AI behaves as a **receptionist** (identifies intent, answers from KB, offers a booking
  when intent allows, hands off + notifies the owner for hard cases, does not hard-sell a wrong number).
- **Booking** uses the existing flow and surfaces as "Booked".
- All AI WhatsApp threads (reactivation + missed-call) live in **Conversations**, filtered by
  **service-type topbar tabs**; missed-call threads play their voicemail inline. No separate receptionist
  inbox exists.
- **Client visibility is per-service:** a client viewing a receptionist thread sees the **full
  interactions and can take over**; a reactivation thread still shows **summaries only**. Both show a
  per-thread summary header.
- The **AI Receptionist page** is a Dashboard + Settings hub (campaigns-by-account list + tabs), with the
  absorbed Speed-to-Lead dashboard + settings, the **First Message** editor (empty First Message is
  blocked/warned because it no-ops the opener), the **posture dial**, and the missed-call provisioning.
- The standalone **`/platform/speed-to-lead` route is retired** (its components are salvaged, not
  deleted blindly).
- When a missed call arrives, the **owner is notified in real time** and can take over the thread.
- The **daily-cap** counts only **new missed-call leads/day per account**, not every outbound message.
- Reactivation, Reputation, and Speed-to-Lead behavior is not regressed
  (`ai_conversation.py`, `speed_to_lead.maybe_dispatch` untouched).
- The surface is **channel-agnostic**: folding speed-to-lead web-leads in later needs no inbox rebuild.

## Out of scope

- **Wiring a second intake channel** (speed-to-lead web-leads / web-form / WhatsApp inbound) into the
  receptionist — the surface is built for it, but actually routing it is a later slice.
- **Tier 3 real-time AI phone answering** — separate spec.
- **Homepage receptionist services panel** — later, in the home-hub pass.
- **New booking/calendar mechanics** — reuse the existing flow as-is.

## Related features / dependencies

- **Missed-Call Text-Back** (`specs/missed-call-textback/`) — the engine + provisioning foundation.
- **Speed-to-Lead** (`specs/speed-to-lead/`) — its page is retired and its dashboard/settings absorbed;
  shares `fire_first_touch`.
- **Conversations/Contacts split** (`specs/conversations-contacts-split/`) — the chats page this inbox
  extends with service tabs.
- **Contacts table + Interactions** (`specs/contacts-table-and-interactions/`) — the client-Interactions
  un-gating the per-service visibility policy builds on.
- **Reputation** (`features/reputation/`) — separate; not merged.
- **Notification SSE user-scope** — owner notification must use `broadcastToUser`.
