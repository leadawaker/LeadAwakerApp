# DBR Scoping Mode + Browser Demo Page — Requirements

**Status:** designed, not built
**Date:** 2026-08-08
**Spans two repos:** `LeadAwakerApp` (CRM, landing page) and `/home/gabriel/automations` (Python engine, Prompt 93)

---

## 1. Problem

Database reactivation (DBR) campaigns currently run **Prompt 93 "Discovery Prompt"**, which is a
quote-reactivation prompt. Campaign 58 owns it; because `_load_prompt()` falls back to the
account-level prompt, campaigns 60, 61, 65 and 66 inherit it too.

Prompt 93's core rules are designed to **stop the AI from asking more questions**:

| Rule | Effect |
|------|--------|
| §4.3 Decision Completion Rule | Once status + reason + next step are known, stop diagnosing and close. "The burden of proof is on asking the next question, not on stopping." |
| §4.4 Status Acceptance Rule | "Still comparing" / "on hold" are complete answers |
| §4.8 Anti-interrogation rule | Never more than three diagnostic questions in a row |
| §5 Step 3 | Goal is to understand the *decision process* |
| §5 Step 5 | Buying signals are all comparison-flavoured (prefers our concept, only issue is the price difference) |

For a quote lead this is correct craft. For a DBR lead it collapses immediately: "yeah I was
interested but not right now" already contains status, reason and next step, so §4.3 fires on turn
one and the AI jumps to the booking offer. **This is why DBR conversations book too fast.** It is
not a tuning problem; it is the wrong flow.

### The underlying asymmetry

| | Quote reactivation | Database reactivation |
|---|---|---|
| Business already has | The spec | A name and a phone number |
| The unknown is | The **decision** | The **project** |
| Correct AI job | Diagnose the decision | Build the brief |
| Prompt 93 today | Correct | Wrong |

A benchmark DBR conversation (UK double-glazing, observed 2026-08-08) asks nine consecutive
questions building a quote-ready brief: quantity, composition, door sub-type, window type, frame
material, glazing spec, scope of work, timing, budget, with a currency clarification. It never once
asks where the lead is in a decision. By the end the installer receives a **scoped job**, not "a
call". Under Prompt 93 today, that conversation would be a rule violation.

### Secondary problems in scope

- **No per-lead context field.** `Leads` has no place for quote specifics. On a quote campaign the
  AI can never say "the £8,400 for the two French doors we sent in March", only gesture vaguely at
  "the quote".
- **Precedence inversion.** `tools/ai_service.py:564` resolves campaign-first, lead-second.
  `src/automations/_helpers.py:71` resolves lead-first, campaign-second. The conversation path and
  the bump path disagree, so a per-lead value is silently discarded in conversations.
- **Multi-message replies cost money.** `_parse_ai_response` accepts up to 4 balloons per reply.
  Each balloon is a separately billed Twilio message. A DBR flow runs 8-10 turns instead of 3, so
  the cost compounds. With AI disclosure in the first reply (EU), the human-typing illusion buys
  little.
- **Demo replies are delayed.** `_calculate_typing_delay` applies a character-proportional delay
  before every reply. Across a 10-turn demo this loses prospects mid-flow. Campaign 61 is already
  exempted via a hardcoded `if campaign_id == 61` in `conversation/outbound.py:164`.
- **The demo is WhatsApp-only.** Desktop prospects who click a demo link with no WhatsApp on that
  machine hit a dead end. This blocks using the demo as a cold-outreach lead magnet.
- **AI disclosure is not controllable.** `Campaigns.ai_disclosure` exists, has a CRM toggle, and is
  passed to the prompt as a variable, but Prompt 93 ignores it and discloses unconditionally in the
  first reply. There is no way to run the disclosure-free opener in the UK or US, and no way to
  disclose *before* the interaction as the EU now requires.
- (`Campaigns.niche_question` is also unreferenced by Prompt 93, but that is **deliberate, not a
  bug**: it belongs to the archived Prompt 67 and the ladder supersedes it. See §3.9 rejections.)

---

## 2. Scope

### In

1. Prompt 93 scoping mode (Step 3 fork, §4.3/§4.8 carve-out, redefined Step 5 signal)
2. Per-niche `scoping_ladder` data for the 16 existing niches + on-the-fly generation for demo niches
3. Per-lead `lead_context` field, precedence fix, `{lead_context}` prompt variable
4. `max_messages_per_reply` campaign setting, default 1
5. Instant replies for demo campaigns (removes the campaign-61 hardcode)
6. Browser demo page (link-only, token-gated) with stage tracker and recap panel
7. AI disclosure mode: wire the existing `ai_disclosure` toggle into Prompt 93, move disclosure
   into the opener, and author disclosure-on / disclosure-off opener and second-message variants.
   Applies to **both** scoping and decision mode. Includes fixing the generated opener so it stops
   concatenating `{niche}` + `{service_name}` (§3.8).
8. Five rules ported from archived Prompt 67 (provenance + opt-out, role-limiting identity,
   feasibility humility, no dumping the business description, relative-day confirmations), one
   existing rule widened, plus the deflect-once rule for the direct AI question. See §3.9.
9. Demo booking behaviour: keep the slot flow, add a demo-only "call now" terminal state, route to
   the demo account, suppress all confirmation emails, keep `billable_booking` false, and render the
   contact hand-off inline in the browser. See §3.10.

### Out (queued as follow-ups)

- Quote-reactivation change-detection flow (needs `lead_context` to exist first: this spec builds
  the field, a later spec builds the flow)
- Full structured-brief capture into CRM lead records and booking payloads. This spec captures
  filled ladder slots only far enough to render the demo recap panel.
- Demo-as-them generation from a prospect's website URL. **Ranked next after this spec:** if the
  demo becomes the cold-outreach lead magnet, a demo carrying the prospect's own company name is
  what makes it work.
- WhatsApp `RESTART` command for invited demo links. Superseded for now by the restart button on
  the browser page.
- **Production instant-callback close** for clients with a sales floor. Stronger than any slot when
  the client has staff to answer, but it needs real handoff machinery (routing, availability,
  fallback when nobody picks up). Worth a task; not this spec. Note the **demo** version of this
  close *is* in scope (§3.10), because there the advisor is Gabriel and it needs only a
  notification.
- Dutch-only inline examples in the Prompt 93 body (Steps 2, 5, 6). Real issue, separate job.
- Past-customer (`owner`) demo scenario on the homepage toggle. Dropped by request.

---

## 3. Design

### 3.1 One prompt, branched. Not a second prompt.

`resolve_conditional_blocks` (`tools/ai_service.py:109`) strips every non-matching `{{#if}}` block
**before** the API call. A DBR-only Step 3 therefore costs zero tokens on a quote campaign, and
vice versa. The size of Prompt 93 is a maintenance concern, not a runtime one.

About 90% of Prompt 93 is machinery that must behave identically in both modes: language rules,
voice mode, live voice, the entire booking apparatus (staged day-then-time flow, NO STALLING rule,
ALREADY-OFFERED TIMES rule, HONESTY rule on unlisted slots), the scenario playbook, booking
confirmation with `SLOT_SELECTED`, and the system signals. Those rules exist because of real
production bugs. Forking the prompt means the next booking bug gets fixed in one copy only.

If the file later becomes painful to edit, the correct refactor is **splitting by layer, not by
campaign type**: a core block (language, voice, booking, signals) plus one flow block per mode,
composed at render time using the same injection mechanism as `{niche_question_bank}`. Out of scope
here.

### 3.2 Mode selection

```
lead_stage        = derive_lead_stage( lead.what_has_the_lead_done      ← per-lead wins
                                       || campaign.what_lead_did )       ← campaign default

conversation_mode = campaign.conversation_mode_override                  ← if set
                  | "scoping"   when lead_stage ∈ { "inquired", "" }
                  | "decision"  when lead_stage ∈ { "quoted", "deciding", "visited", "declined" }

lead_stage == "owner" keeps its existing §3.5 block and runs decision-mode Step 3, unchanged.
```

`conversation_mode` is exposed to the prompt as a variable so `{{#if conversation_mode == "scoping"}}`
blocks resolve. `conversation_mode_override` is a new nullable campaign column, needed so demo
campaigns can force scoping regardless of stage.

**Precedence fix.** `tools/ai_service.py:564` changes to lead-first, matching
`src/automations/_helpers.py:71`. **Migration risk: none.** Verified 2026-08-08: 0 of 657 rows in
`Leads` have `what_has_the_lead_done` set, so no existing lead changes behaviour.

**Do not repurpose `what_has_the_lead_done` as free text.** It is the input to
`derive_lead_stage()`, which keyword-matches it to produce the token driving every §3.5 conditional
(inquired / visited / quoted / deciding / declined / owner). Free text such as "asked for a €3,400
quote for 2 doors and a window" matches none of the keywords (`"quote"` alone is not a keyword;
`"request a quote"` and `"received a quote"` are), returns `""`, and silently disables the stage
branches. The field stays a constrained dropdown. Narrative goes in `lead_context`.

### 3.3 The scoping ladder

An **ordered list of slots to fill**, not a script. Each slot carries a name, a purpose, and two or
three example phrasings in `{nl, en}`. The AI fills them in order, one question per turn, phrasing
each question against what the lead just said, and **skips any slot already answered unprompted or
pre-filled from `lead_context`**.

Order is cheapest-to-answer first, most-sensitive last. Budget is asked last, after several easy
answers have built momentum. Asking budget third kills the conversation.

Reference ladder (Windows & Doors):

| # | Slot | Purpose | Example (en) |
|---|------|---------|--------------|
| 1 | Still interested | Permission to continue | "are you still interested in having your windows or doors replaced?" |
| 2 | Quantity | Sizes the job | "how many windows or doors are you looking to replace?" |
| 3 | Composition | Splits the count | "what type are the three, and roughly what size?" |
| 4 | Sub-type | Quote-line detail | "are the doors front, back, French or patio?" |
| 5 | Material | Price driver | "are you thinking uPVC, aluminium or timber?" |
| 6 | Spec level | Price driver | "standard double glazing or triple?" |
| 7 | Scope | Labour driver | "straight replacement, or are any openings being altered?" |
| 8 | Timing | Urgency, priority | "when were you hoping to have the work done?" |
| 9 | Budget | Qualification | "do you have a budget range in mind for the two French doors and the casement window?" |

Two behaviours are explicit prompt rules, not left to the model:

- **Quote the brief back in the budget question.** "for the two French doors and the casement
  window", never "for the project". It proves the AI listened and makes the number concrete.
- **Ambiguity gets one immediate clarifying question.** Currency (€ vs £), metric vs imperial, and
  countable ambiguity ("3 windows" = three openings or three panes).

**Universal vs per-niche.** Slots 1, 8 and 9 (interest, timing, budget) are universal and live in
the prompt body. Slots 2-7 come from the per-niche ladder, so a niche with no ladder row still
produces a coherent short conversation instead of nothing.

**Completion and close.** The ladder is complete when every non-optional slot is filled or
explicitly skipped by the lead. Only then does Step 5 fire, using the existing booking machinery
unchanged: offer the call, wait for a clear yes, offer days, then times on the chosen day, link
only if nothing fits.

**Exit rules** (replacing the §4.8 protection that scoping mode disables):

1. Lead pushes back twice → stop laddering, move to close or offer space
2. Hard "not interested" → respect immediately, `[END]`
3. Lead asks their own question → answer it first, then resume at the slot where you stopped
4. Hard ceiling: 10 turns without completing → close on what you have

**Step 5 buying signal, scoping mode.** Redefined as "the brief is complete and the project is real
and near-term", replacing the comparison-flavoured signals (prefers our concept, only remaining
issue is price) which assume a quote exists.

### 3.4 Data model

**New: `Niche_Vocabulary.scoping_ladder`** — jsonb `{nl, en}`, injected as `{niche_scoping_ladder}`
inside the scoping branch. Same per-field `__default__` fallback as the existing packs
(`question_bank`, `bad_examples`, `objection_examples`, `scenario_examples`), so a niche row that
exists with an empty ladder still inherits the default rather than rendering thin.

**Slot shape.** Each slot in a ladder carries five fields:

| Field | Purpose |
|-------|---------|
| `key` | Stable id (`quantity`, `material`, `spec_level`) so slots can be marked filled, or pre-filled from `lead_context` |
| `purpose` | **What this answer changes in the quote.** The field that lets the AI skip, reorder, or recognise an already-given answer |
| `ask` | 2-3 example phrasings, `{nl, en}` |
| `options` | The closed set to offer ("front, back, French or patio") |
| `optional` / `depends_on` | Skippable when running long; or only asked when a prior slot held a given value |

The structure is trivial; the **domain knowledge is the feature**. What makes the benchmark
conversation sound like an employee is knowing that frame material and glazing spec are the price
drivers, and that "are any openings being altered" is what separates a straight swap from
structural work. A cold LLM reliably produces plausible-but-shallow ladders that circle budget and
timeline without touching a price driver. That failure mode is invisible until the conversation is
run.

**Authoring strategy (three tiers, no ladder written from scratch more than twice):**

| Tier | Method | Used by |
|------|--------|---------|
| 2 ladders (Windows & Doors, Kitchens) | Hand-written, validated with `/bot-test` | Production, **and as few-shot examples for the generator** |
| 14 remaining niches | Generated using the two hand-written ladders as few-shots, then human-reviewed and edited | Production campaigns in known niches |
| Any other niche | Generated live at demo-creation time | Demo links |

Seeding the generator with two worked examples of depth is what lifts output for an unseen niche
(e.g. dental implants, loft conversions) above generic. Do not generate the 14 before the 2 are
validated.

**Demo niches.** `generateNicheContext` in `server/demo-session.ts` already generates
`niche_question_bank` and `niche_objection_examples` for arbitrary niches and appends them to the
defaults. Extended to generate a `scoping_ladder` the same way, using the tier-1 ladders as
few-shots, so an unknown demo niche still ladders well.

**New: `Leads.lead_context`** — free text, per lead, imported alongside the lead list. Injected as
`{lead_context}` whenever present.

- Decision mode: the quote specifics the AI can reference by name
- Scoping mode: pre-fills known slots so the AI skips them ("enquired about 3 windows" → skip
  slot 2)

**New: `Campaigns.conversation_mode_override`** — nullable, `"scoping"` | `"decision"` | null.

**New: `Campaigns.max_messages_per_reply`** — integer, default 1.

**New: `Niche_Vocabulary.opener_phrase`** — jsonb `{nl, en}`, the natural plural phrase used in the
opener template ("new windows or doors" / "nieuwe kozijnen"). See §3.8 for why the opener stops
concatenating `{niche}` + `{service_name}`.

### 3.5 Message policy

Default to **one message per reply**. The prompt's multi-message instruction becomes conditional on
`max_messages_per_reply`. `_parse_ai_response` caps the parsed list at that value.

**One exemption, and it must survive:** the voice-mode rule (Prompt 93 line 51) requires URLs,
phone numbers and exact figures the lead needs to copy to go out as a **separate plain-text
message**, because a voice memo cannot carry a copyable link. The post-booking vCard already works
this way. Neither is subject to the cap.

### 3.6 Reply timing

Real campaigns keep the proportional typing delay, configurable per campaign as today
(`ai_min_delay_seconds` / `ai_max_delay_seconds`).

Demo campaigns reply instantly. The hardcoded `if campaign_id == 61` in
`src/automations/conversation/outbound.py:164` is replaced by an `is_demo`-driven zero-delay path,
so campaign 60 and every per-client demo campaign get it without another magic number. This covers
both the inter-message gap and the pre-reply typing delay.

Rationale: a demo is a product showcase, not a simulation. A DBR demo now runs 8+ turns; a
proportional delay on every turn loses prospects inside the exact flow meant to impress them.

### 3.7 Browser demo page

**Access: link-only.** The page opens only with a valid token minted from the CRM. No public entry
point. Abuse pressure is near zero, restart can be generous, and each link ties to a named prospect
so you can see who ran it and how far they got. The homepage keeps its current WhatsApp flow
unchanged.

**Where it lives:** the premium landing bundle (`client/public/premium/`), built by
`script/build-premium.ts`, same pattern as `login.html → /login`. It gets its own black palette and
the Lead Awaker logo without inheriting CRM tokens, CRM auth or CRM bundle weight. The landing page
already calls the demo API cross-origin, so that plumbing exists.

**Layout** (per the reference screenshot):

- Header: Lead Awaker logo left, stage tracker centre, demo-company pill right. For a personalised
  demo the pill shows *the prospect's own firm*, which does a lot of the selling by itself.
- Body: near-black. AI bubbles left with a small avatar mark, visitor bubbles right in accent fill.
  Timestamp under each bubble.
- Composer: full-width rounded input with an inline send icon, plus a **restart button** beside it.
  This is the restart capability, placed where it is easiest to control.

**Stage tracker.** NEW LEAD → RESPONDED → QUALIFIED → OBJECTIVE REACHED, driven entirely by signals
the engine already emits (Prompt 93 §7):

| Stage | Fires on |
|-------|----------|
| New lead | Session created, first message sent |
| Responded | First inbound message from the visitor |
| Qualified | `[QUALIFIED]` |
| Objective reached | `[BOOKED]` / `SLOT_SELECTED` |

This is the page's centrepiece: it narrates the value while the conversation happens, so the
prospect sees a pipeline moving rather than a clever chatbot.

**Transport: reuse the engine, do not fork it.** New channel identifier `web-demo:<token>`,
alongside the existing `wa-demo:`. The visitor's message hits a new engine endpoint that runs the
*same* `run_ai_conversation` pipeline; the send layer persists outbound messages as Interactions
instead of calling Twilio, and the page reads them back.

Rejected alternative: a standalone web-chat endpoint. That means re-implementing slot offering, the
no-stalling rule, the already-offered-times rule, booking confirmation and recap. All of that lives
in the pipeline. A side benefit of reuse: demo conversations appear in the CRM exactly like
WhatsApp ones, so real prospect transcripts are readable.

**Bubbles: written fresh, ~40 lines, in the premium design system.** Neither existing component
fits. `client/public/premium/conversation-card.jsx` (493 lines) is a scripted animation player with
pre-written message arrays and typing timings, not a live chat.
`client/src/components/crm/ChatBubble.tsx` (46 lines) is CRM-token styling wrapped around
`Interaction` types and DOMPurify. Copying the shape is cheaper than parameterising a CRM component
for a public marketing page, and it keeps the demo immune to CRM restyles.

**Recap window.** Spawns when the demo reaches a terminal state (booked via slots, booked via the
"call now" close, or `[END]`). An in-page overlay beside the chat, not a browser popup, since a real
`window.open()` gets blocked. Two blocks:

1. Conversation recap — reuses `_build_structured_summary` in
   `src/automations/demo_recap.py`, which already runs for WhatsApp demos
2. Rough spec — the filled ladder slots rendered as a list

Block 2 requires the engine to return filled slots as **data**, not only prose. This is the minimal
slice of structured-brief capture; the full CRM-side version stays out of scope.

**Link format.** The URL opens the page. The page carries a secondary "on your phone? run it in
WhatsApp instead" link handing off to the existing `wa.me` flow with the same token.

**Quality detail.** Capitalise the visitor's first name on input. The reference demo rendered "is
that the same bob", and that kind of seam breaks the spell.

**Disclosure at mint time.** The CRM's link-minting dialog carries an AI-disclosure toggle (§3.8),
so an EU-market demo and a UK/US-market demo can be sent from the same screen.

### 3.8 AI disclosure mode

**Current state.** `Campaigns.ai_disclosure` already exists, already has a CRM toggle
(`client/src/features/campaigns/components/settings/BehaviorSectionFields.tsx:104`), and is already
passed into the prompt as a variable (`tools/ai_service.py:632`, defaulting to `"off"`).
**Prompt 93 never reads it.** Step 2 hardcodes the disclosure clause as mandatory in the first
reply, unconditionally. The toggle is wired at both ends and does nothing in between.

Note `allow_ai_disclosure` in `tools/guardrails_service.py:209` is a *different* flag (it governs
whether the guardrail treats AI self-identification as a violation). Both need to agree, or the
guardrail will flag a compliant disclosed message.

**Change of location.** Disclosure moves from the first *reply* to the *opener*. This is stronger
legally (disclosure precedes the interaction rather than following it) and frees the first reply to
do sales work instead of admin.

**Two variants.**

*Disclosure off* (UK / US), the benchmark conversation unchanged:

> Hi it's {agent_name} from {company_name}, is that the same {first_name} who was interested in
> {service_name} a while ago?
>
> Ok, my manager asked me to reach out but I hate annoying people with unwanted phone calls, are
> you still interested in having your {project_term} replaced?

*Disclosure on* (EU):

> Hi {first_name}, this is {agent_name}, the AI assistant at {company_name}. Is that the same
> {first_name} who was interested in {service_name} a while back?
>
> Thanks for confirming. The team asked me to go back through our older enquiries, and I'd rather
> drop you a message than have someone ring you out of the blue. Are you still interested in having
> your {project_term} replaced?

**Why message 2 must be rewritten, not just re-prefixed.** The disclosure-off second message does
three jobs: it gives a reason for contact ("my manager asked me to reach out"), it preempts the
cold-call fear ("I hate annoying people with unwanted phone calls"), and it asks the interest
question. Two of those are human claims an AI cannot make. The disclosed variant preserves all
three, and job two gets *stronger*: the AI turns its own nature into the benefit, since a message
you can ignore beats a call you cannot.

**Two things the toggle does NOT control.** Proactive disclosure is toggleable. Answering a direct
"is this a bot?" honestly is not: it happens in both modes, always. Getting caught denying it is
worse than disclosing.

This means §6.3 of the scenario playbook ("AI accusation") needs a disclosure-off variant. Its
current text back-references a disclosure that never happened when the toggle is off:

> "That's right, **as I mentioned**, I'm the digital assistant for {company_name}."

**The exact behaviour for the disclosure-off variant is specified in §3.9 (deflect once, never deny
when pushed).** Both variants then follow the same rebuild-trust path: no pitch, no qualifying, no
call push in that message.

**Guardrail.** `validate_output(allow_ai_disclosure=...)` is set to **true whenever Prompt 93 is
driving the conversation**, in both disclosure modes. Rationale: the guardrail's regex was a
backstop for prompts with no disclosure handling of their own. Prompt 93 now owns disclosure policy
in three places (opener, Step 2, §6.3), and a disclosure-off campaign still needs to self-identify
when asked directly, so binding the flag to the toggle would block the §6.3 answer.

**Mechanics.**

- The opener is a template, so it takes a `{disclosure_clause}` variable: `"from {company_name}"`
  when off, `"the AI assistant at {company_name}"` when on. One `First_Message` template serves
  both markets. Confirm during implementation whether `First_Message` rendering runs through
  `resolve_conditional_blocks`; if it does not, the variable approach is required rather than
  merely preferred.
- Message 2 is AI-generated, so it becomes a `{{#if ai_disclosure == "on"}}` branch in Step 2 with
  its own framing guidance and examples.
- **When disclosure is on, Step 2's mandatory disclosure clause must be suppressed**, or the AI
  discloses twice. Step 1 path (b) ("identify {company_name} plainly using the one-line disclosure
  clause from STEP 2") needs the same treatment.
- Applies in **both** `scoping` and `decision` mode: this wraps Steps 1 and 2, which are shared.

**Defaults.** EU-market campaigns default to `on`. The EU AI Act's Article 50 transparency
obligations apply from 2 August 2026, so this is now live, not pending. UK and US campaigns default
to `off`.

**Opener template quality (both modes).** Since `{disclosure_clause}` puts us inside the opener
template anyway, fix a defect there at the same time. The current generated opener concatenates
`{niche}` and `{service_name}`, which names the **commercial arrangement instead of the thing the
lead wants**:

> ❌ "interested in Double glazing (windows and doors) supply and installation a while ago"
> ✅ "who was looking at new windows and doors a while back"

`"Supply and installation"` is one of the four `service_name` dropdown values
(`server/demo-session.ts:600`), and `generate-demo` hardcodes it as the generic default. Nobody has
ever described themselves as interested in supply and installation.

1. **The opener uses the niche's own project language, not `{niche}` + `{service_name}`.**
   `Niche_Vocabulary.project_terms` already carries it per niche, bilingual ("window" / "kozijnen",
   "kitchen" / "keuken", "solar panel" / "zonnepanelen").
2. **`service_name` remains background context for the AI, never in the opener sentence.** It
   genuinely matters downstream (whether the client fits or only supplies changes what "straight
   replacement" means and whether fitting is in scope), it is simply not how a person greets
   someone.
3. **New: `Niche_Vocabulary.opener_phrase`** — jsonb `{nl, en}`, a natural plural phrase for the
   opener ("new windows or doors" / "nieuwe kozijnen"), since `project_term` is singular.

Blast radius is narrower than it looks: real client campaigns have an authored `First_Message`, so a
human can write it well. The concatenation defect is specific to `generate-demo` and
`generateNicheContext`, which means **it only affects demos** — which is exactly where the
prospecting motion is about to point. It matters more than its size suggests.

**Per-link override for demos.** The disclosure choice must be selectable **per shareable link**,
not only per campaign, so one demo campaign serves both an EU prospect and a UK prospect. No new
column: the demo lead already carries a `demo_niche` JSON blob overlaid onto the campaign at runtime
by `_overlay_demo_niche_onto_campaign`, and the disclosure choice rides in that blob. Resolution is
lead-first, campaign-second, matching the `what_lead_did` precedence in §3.2. The CRM link-minting
dialog carries the toggle.

### 3.9 Adopted from Prompt 67 (archived n8n prompt)

Prompt 67 carries the "Instant AI agency" lineage. Five rules from it are worth porting into
Prompt 93; one is explicitly rejected.

**Port:**

1. **Provenance + opt-out in one line** (Prompt 67 line 139). New scenario in the playbook: when
   asked "how did you get my number", state what the lead did and bundle the opt-out in the same
   message. Reference phrasing: *"You made an enquiry via our website. If you no longer wish to hear
   from us, reply with the word delete."* Prompt 93 has an `opt_out_notice` campaign field but **no
   scenario for this question**, and it is far more common in DBR than in quote reactivation because
   the lead genuinely does not remember the enquiry. Trust-critical; belongs in the scoping playbook.
2. **Role-limiting identity** (line 112). Generalise §6.4's pricing deferral into a standing
   fallback: the agent handles admin and scheduling, the advisor handles specifics. Does three jobs
   at once: gives a legitimate reason not to know things (suppresses hallucination), never reads as
   evasive, and manufactures a reason to book.
3. **Feasibility humility** (line 137). Never assert a job is doable or affordable; the advisor
   evaluates. Matters far more in scoping mode, where the AI has just collected a full spec and
   budget and will be tempted to confirm it can be met. Correct register is the benchmark's
   *"I'm confident the team can help with that."*
4. **No dumping the business description** (line 144). Prompt 93 line 5 injects
   `{business_description}` into the role line with no guidance. Add: never paste or summarise the
   whole text; weave in one short relevant detail when the lead's situation matches. Matters most in
   scoping mode, where collected spec details give the AI something to hook a relevant detail onto.
5. **Relative-day booking confirmations** (line 76): render booked times as "tomorrow", "this
   Thursday", "next Monday" rather than a date string. Prompt 93 §6.8 currently uses "[datum en
   tijd]". Small warmth win.

**Widen an existing rule rather than add one.** Prompt 93 line 89 already bans reusing the same
acknowledging word, but scopes it to *consecutive sentences*. Prompt 67 scopes it to the whole
conversation. The distinction is immaterial at 3 turns and material at 10: the reference transcript
itself uses "Lovely" at turn 2 and turn 5, non-consecutive and still noticeable. Change the scope to
"anywhere in this conversation".

**Rejected:**

- Line 169, "include a typo in every other reply". `typo_count` already exists; that rate reads as
  sloppy rather than human, and it is incoherent alongside an AI disclosure.
- Line 161's numeric word budget (10-15 words, ~20 max). Prompt 93 line 82 already requires "short,
  concise and mobile-friendly" and line 83 caps replies at one question, which is what the ladder
  needs. Observed output is already short. Watch during `/bot-test` rather than legislate up front.
- Line 8's SPIN / Challenger framing. Naming a methodology makes models formulaic, and the ladder
  already *is* the situation-question structure SPIN describes.
- Line 30's `{niche_question}` pattern. The ladder is the niche question on steroids: a single
  client-defined question adds nothing on top of a 9-slot sequence and risks derailing its order.
  `Campaigns.niche_question` stays in the schema and the CRM (Prompt 67 uses it and may be revived),
  but Prompt 93 deliberately does not consume it. A client with a genuinely unusual qualifier is
  served by editing the niche ladder, not by a parallel variable.
- Nothing to take on emojis: Prompt 93 line 85 bans them outright, stricter than Prompt 67's one per
  conversation.

**Deflection structure for the AI question (both modes).** The reference implementation never denies
being an AI; it states something true and redirects ("I'm Sarah from The Nottingham Window Company.
Are you looking at windows, doors, or both?"). That structure is better than Prompt 93's current
§6.3, which over-explains. Adopt the structure, with a defined stopping point:

- **Deflect once:** restate who you are with, redirect to the outcome. No debate about what you are.
- **Never deny when pushed:** if asked a second time, confirm plainly and continue.

This applies in **both** disclosure modes and is not overridable by the `ai_disclosure` toggle.
Rationale, in order of real cost: (1) Meta's business messaging policy governs the WhatsApp number
that is the entire delivery channel, and a policy strike costs the channel rather than a deal;
(2) the product is sold to businesses to run against *their* customers under *their* brand, so demo
behaviour is read as product behaviour; (3) EU Art 50 applies from 2 August 2026 and California's
B.O.T. Act applies in the US. Deflect-once captures nearly all the engagement benefit of
non-disclosure without the caught-denying downside.

### 3.10 Demo booking behaviour

The staged slot flow is **kept** for the browser demo. Offering real days, then real times, then
confirming is the most convincing part of the demo: any chatbot can send a booking link, almost none
negotiate a calendar. Removing it would make the demo simpler and weaker.

Three isolation requirements:

1. **Route to the isolated demo account.** Browser-demo bookings land on Account 52 (already exists,
   static hours, no OAuth), not campaign 61's path, which books onto Gabriel's real synced calendar.
2. **No confirmation email to anyone.** No organizer notification, and no attendee email either:
   there is no real prospect email in a browser demo (demo leads use the
   `leadawaker+lead{id}@gmail.com` privacy pattern). The confirmation is the AI's in-chat message
   plus the recap panel, consistent with the existing conversational-booking approach. Overlaps with
   the queued `caldiy-email-branding` spec, which already lists organizer-email suppression.
3. **`billable_booking` must be false** on demo leads, or demo bookings appear in the billing view.

**Contact hand-off in the browser.** No vCard: it is clunky on desktop. Render a contact block
inline in the chat (company name, advisor name, number) with a `tel:` link (native on mobile
browsers) and a copy button. Same job as the WhatsApp vCard, native to the medium. **The number is
the same one the WhatsApp demo uses**, resolved the same way (`calling_number` → `account_phone`),
so there is one source of truth across both channels.

**"Call now" close in the demo.** Offered *in addition to* the slot flow, not instead of it, and it
is a **terminal state, not a real call**. The demo exists to show the conversation, not to produce
an appointment. When the prospect agrees to speak with an advisor now:

1. The lead is marked booked (same state the slot flow reaches)
2. The recap window spawns immediately

No notification, no availability gating, no handoff machinery. The prospect knows they are running a
demo, and the recap appearing immediately is what closes the loop, so there is no dangling
expectation of a phone ringing.

This is why the demo version is in scope while the production instant-callback close for clients
with a sales floor is not (§2): the production one has to actually connect someone.

---

## 4. Decisions made during design

| Decision | Choice | Why |
|---|---|---|
| Separate DBR prompt? | No, branch Prompt 93 | Conditionals are stripped pre-send (zero token cost); ~90% of the prompt is shared booking machinery that must not fork |
| DBR close | Booked calendar slot, existing machinery | Keeps slots, reminders and billable-bookings intact; the brief attaches as context |
| Store quote detail in `what_has_the_lead_done`? | No, new `lead_context` | That field is the `lead_stage` classifier input; free text silently disables every §3.5 branch |
| Multi-message replies | Cap at 1 by default | Per-message Twilio billing × 8-10 turns; AI disclosure removes the illusion's value |
| Demo reply timing | Instant | 10-turn demo loses prospects to delays |
| Browser demo access | Link-only, minted tokens | Near-zero abuse surface, generous restart, per-prospect attribution |
| Past-customer demo scenario | Dropped | Out of scope by request |
| Disclosure location | The opener, not the first reply | Disclosure precedes the interaction; frees the first reply for sales work |
| Opener wording | Niche project language, not `{niche}` + `{service_name}` | "Supply and installation" names the contract, not what the lead wants; affects demos specifically, which is where prospecting now points |
| Disclosure control | Existing `ai_disclosure` campaign toggle, plus a per-link override on demos | Column, CRM switch and prompt variable already exist; only the prompt branch is missing. Per-link rides the existing `demo_niche` overlay, no new column |
| Guardrail vs disclosure | `allow_ai_disclosure = true` whenever Prompt 93 drives | The prompt owns disclosure policy in three places; a disclosure-off campaign still must answer "is this a bot?" honestly |
| Direct "are you an AI?" | Deflect once, never deny when pushed. Not overridable by the toggle | Protects the WhatsApp channel (Meta policy), and demo behaviour is read as product behaviour by prospects buying it for their own customers |
| Demo booking | Keep the staged slot flow | Live calendar negotiation is the most convincing part of the demo; a booking link is what every chatbot does |
| Demo booking isolation | Account 52, no emails, not billable | Demo bookings must not touch the real calendar, inbox or billing view |
| Browser contact hand-off | Inline contact block with `tel:` + copy, same number as WhatsApp | vCard is clunky on desktop; `tel:` is native on mobile browsers; one number source across channels |
| "Call now" in the demo | In scope, demo only, terminal state with no real call | The demo shows the conversation; agreeing to a call marks booked and spawns the recap, same as the slot flow |
| Text word budget | Not added | Line 82 ("short, concise, mobile-friendly") and line 83 (one question per reply) already cover it; watch during `/bot-test` |

---

## 5. Risks and open items

- **Recap trigger threshold.** `RECAP_TRIGGER_TURN = 15` inbound messages in `demo_recap.py`. A
  9-slot ladder plus close lands around 10-12 turns, so the recap may not fire before the
  conversation ends. Re-tune once the ladder is live.
- **Ladder quality is the whole feature.** A weak ladder produces a worse conversation than today's
  prompt. The three-tier strategy in §3.4 keeps hand-authoring to two niches, but it makes those two
  load-bearing: they are both production ladders *and* the generator's few-shot examples, so a
  shallow tier-1 ladder degrades all 16. Validate both with `/bot-test` before generating anything.
- **Generated ladders need review, not trust.** The 14 tier-2 ladders are generated, then edited.
  Budget real review time: the failure mode (plausible questions that never touch a price driver)
  reads fine on the page and only shows up in conversation.
- **Scoping mode disables the anti-interrogation guard.** The four exit rules in §3.3 are the only
  thing preventing a genuine interrogation. They need explicit test coverage, particularly rule 3
  (lead asks their own question mid-ladder).
- **`lead_context` pre-fill is a model-judgement call.** The AI must map free text onto ladder slots
  and skip correctly. If unreliable, fall back to injecting `lead_context` as context only, without
  skip authority.
- **Demo conversations become Interactions.** Web demo transcripts land in the CRM alongside real
  leads. Confirm the demo filter in `server/routes/conversations.ts:139` (which special-cases
  `wa-demo:`) also covers `web-demo:`.
- **Disclosure-off is a market judgement, not a blanket default.** It is fine for the UK. In the US,
  California's B.O.T. Act requires bot disclosure when a bot is used to incentivise a commercial
  transaction with a California resident, so a US rollout needs a per-state or blanket-on decision
  rather than inheriting the UK setting. Flagged, not resolved here.
- **No migration risk on the disclosure change.** Confirmed 2026-08-08: no live client campaigns
  exist; every current campaign is a demo or a stand-in. The prompt currently discloses
  unconditionally and `ai_disclosure` defaults to `"off"`, so wiring the branch changes behaviour on
  paper, but there is no production traffic to protect.

---

## 6. Strategic context (why this ordering)

DBR is the better ongoing offer: a client's dead database is 10-50× the size of their open-quote
list and nobody works it. Consent ranks past customers > old enquiries > cold, so DBR should be
sold on past customers and old enquiries, not vaguely as "your old contacts".

Quote reactivation remains the better *first case study* (fast, obviously attributable). The
practical sequence with a new client is quote list in month one for fast wins, then the database as
the real programme.

The demo's role in the sale: **capability, not value.** It proves the AI works. Only a hell/heaven
probe establishes what the problem costs. A demo sent without a probe invites a price-first frame.
Three distinct jobs, in order:

1. Cold outreach: the demo link is the CTA. Goal is earning the call, not selling. Anyone who runs
   the full conversation is warm before first contact.
2. Discovery call: probe first, then run the demo live and walk through the mechanics, including
   how the ladder would be adapted for their trade. A prospect who co-designs it has bought it.
3. After the call: send the link so they can show the other decision-maker. The demo sells in the
   room you are not in.

This is why demo-as-them (the prospect's own company name and services) is ranked first among the
follow-ups.
