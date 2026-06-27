# AI Employee Service Architecture — Design

**Date:** 2026-06-27
**Status:** Approved design (pre-implementation). This is a product/positioning + service-boundary
design, not a build plan. No code yet.
**Context:** Resolves where the new **Referrals** work belongs, and reframes the full service roster
around a single coherent model. Related: `specs/ai-receptionist/`, `docs/strategy/`,
memory `project_ai_receptionist_reframe.md`, `project_multiservice_hulk_strategy.md`.

---

## The question this answers

Referrals was first built (in Cloud Design) tied to the Reputation service. That raised a chain of
questions: should referrals be its own service? Could a client want referrals without reputation?
Should referrals merge into AI Receptionist (since Receptionist already absorbs speed-to-lead +
missed-calls)? This doc resolves all of it into one service map.

## The core idea

**One shared conversation engine. Four services. Each service is a job a real business already
understands — sold as an outcome (a noun), staffed by an AI in that role (a job title), which can
carry a human name (the persona).**

Three naming layers, used consistently:

| Layer | Example | What it is |
|---|---|---|
| **Service** | "Reception" | The outcome the client buys (a noun) |
| **AI role** | "Receptionist" | The job the AI performs (a job title) |
| **Persona** | "Thomas" / "Sophie" | The human name on the AI (optional flavor) |

So a client *buys Reception* and *gets a Receptionist* (who may be named Thomas).

## Governing principles

These two rules generate the whole map. When a new capability or edge case appears, apply them
rather than re-litigating boundaries:

1. **Direction decides the service.**
   - A customer contacts the business (inbound) → **Reception**.
   - The business reaches out to existing customers (outbound) → **Loyalty**.
   - Shared capabilities (booking, review-request) are used by whichever service the interaction
     belongs to. Never duplicated, never double-fired.

2. **Takeover follows visibility.** A human can only take over a conversation they can see. Services
   where the client sees full threads *and* the person on the other end has direct relationship value
   get human take-over. Summary-only services do not.

## Why NOT merge everything into "AI Receptionist"

The merge was tempting on four axes (simpler SKU count, conceptual unity, shared tech, less sprawl),
but it strains on the one that matters: **a receptionist is inbound-reactive by definition.**
Speed-to-lead and missed-call fold into Reception cleanly because they're the same posture with a
different doorbell (web form vs phone call). Referrals/repeat/reviews invert every part of that —
they're *outbound, to people who already bought*. Different demand, different consent/compliance
posture, different data dependency (a customer list + a "good experience" trigger), different ROI
story.

Resolution: keep the metaphor honest by splitting **who the AI is** (the role) from **what jobs it
does** (the services). Inbound is the **Reception** job; outbound-to-customers is the **Loyalty**
job. Both sit under one "AI Employee / AI team" umbrella, so sales can still say *"your AI receptionist
also follows up with past customers"* — one hire, multiple jobs you can switch on independently.

---

## The Service Map

*One shared conversation engine. Four services. Each is a job a real business already understands.*

| Service *(what you buy)* | The AI *(the role)* | Direction | What it does, in one line |
|---|---|---|---|
| **Reactivation** | Sales Rep *(persona: Thomas/Sophie/Closer)* | Outbound → cold leads | Wakes up the client's old, dormant leads and books them |
| **Reception** | Receptionist | Inbound → new contacts | Answers missed calls & web leads instantly, qualifies, books, escalates to a human only when needed |
| **Loyalty** | Loyalty Manager | Outbound → past customers | Turns happy customers into referrals, repeat bookings & review requests |
| **Reputation** | Reputation Manager | Inbound → reviews | Requests reviews, monitors what lands, replies with on-brand AI |

### Shared capabilities (one engine, reused across services)

| Capability | Reactivation | Reception | Loyalty | Reputation |
|---|:--:|:--:|:--:|:--:|
| Conversational AI (qualify, answer, book) | ✅ | ✅ | ✅ | — |
| **Booking** (calendar) | ✅ | ✅ | ✅ | — |
| **Review request** *(one switch, fires once)* | — | — | ✅ | ✅ |
| Review monitoring + AI reply | — | — | — | ✅ |
| **Human take-over** | — *(summaries only)* | ✅ optional | ✅ | ✅ *(override reply)* |

---

## Key boundary decisions (the reasoning, so it isn't re-opened)

### Referrals lives in Loyalty, not Reputation
A referral ask doesn't improve a reputation — it generates a new lead. It's mechanically identical to
a review request (outbound to a happy customer after a delay), but its *outcome* is acquisition, not
reviews. It belongs with the other proactive existing-customer plays.

### Review-request is a SHARED capability, surfaced in both Loyalty and Reputation
It is *not* owned by one service. Requesting reviews is genuinely part of both managing loyalty and
managing reputation. So it is one engine feature with **one source-of-truth config**, exposed on both
the Loyalty page and the Reputation page (same switch, two doors). This serves every buyer scenario:

- **Loyalty only, no AI replies:** gets review-requests (+ referrals + repeat), never touches monitoring.
- **Reputation only:** gets review-requests + monitoring/reply — because asking *is* part of reputation.
- **Both:** the request is the *same* switch shown in both places, so it **fires once** (no double-message).

This is strictly better than assigning an owner: giving it only to Loyalty starves Reputation of any
way to *get* reviews; giving it only to Reputation risks double-sending against Loyalty's outreach.

### Rebook / repeat: direction splits it
- A customer **calls in** to rebook → an inbound, so **Reception** handles it as normal booking. It
  doesn't matter that they're an existing customer; the doorbell rang.
- The business **reaches out** to a due customer → **Loyalty's** outbound rebook nudge.

The booking engine is shared; direction decides which service owns the interaction.

### Human take-over, per service (takeover follows visibility)
- **Reactivation — none.** Clients see *summaries, not threads*, so there's nothing to take over; and
  it's high-volume fully-automated outreach where a human stepping in defeats the pitch.
- **Reception — optional.** Clients see full interactions; these are live, often high-value inbound
  prospects. The owner can grab any conversation (the boss picking up a line). Plumbing already built
  (`manual_takeover` + Resume AI).
- **Loyalty — yes (most important).** These are *existing customers* the business has already earned;
  full visibility + high relationship value means the owner reasonably wants to handle a valued or
  complaining customer personally.
- **Reputation — yes (override).** AI auto-replies, but for a brutal review the owner overrides the
  draft and writes it himself.

---

## What is already built (do not rebuild)

- **Reception engine + provisioning:** `automations/src/webhooks/twilio_voice_mc_routes.py`,
  `server/routes/missedCall.ts`, `MissedCallCard.tsx`, `Accounts.missed_call_*`,
  `campaign_type='missed_call'`. Speed-to-lead reuses `speed_to_lead.fire_first_touch`.
- **Reception take-over plumbing:** `leads.manual_takeover` honored at `inbound_handler.py:332`;
  owner notify via `notify_manual_takeover` (`inbound_handler.py:675`).
- **Reactivation:** the existing reactivation product (summary-only client visibility rollup at
  `conversations.ts` ~305-335).
- **Reputation v2:** public Google review monitoring + AI reply (recent commits).
- **Referrals page:** drafted in Cloud Design (currently associated with Reputation; per this design
  it should move under Loyalty).

## Out of scope for this design

This document defines the **service boundaries, naming, and shared-capability model** only. It does
**not** plan the Loyalty build, the referral campaign mechanics, the review-request shared-config
implementation, or any UI. Each service gets its own spec → plan → implementation cycle. The immediate
next candidate is the **Loyalty** service (home for referrals).

## Open / deferred items

- **Final word for "Loyalty Manager" role:** "Loyalty" is locked as the service noun. The role/AI
  title and any small-business-friendlier service synonyms (Customer / Relationship / Loyalty) can be
  finalized at Loyalty-spec time.
- **Reactivation persona vs role surfacing:** "Sales Rep" is the role; whether the UI surfaces the
  persona name (Thomas/Sophie) or the generic role is a per-campaign display choice, not a boundary
  question.
