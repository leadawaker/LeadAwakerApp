# Tier-3 Voice Receptionist — Requirements

> Real-time, voice-to-voice AI receptionist that **answers a live phone call (or a browser
> click-to-talk session)**, speaks first, triages intent, answers from the Account Knowledge
> Base, books a real appointment mid-call, and streams the whole conversation into the CRM
> live. This is the "Tier 3 real-time AI phone answering" explicitly deferred as a **separate
> spec** by `specs/ai-receptionist/` (which covers only the WhatsApp text-back tiers).
>
> Strategy context: the playground demo proves the *voice*; this proves the *product*. The
> demo (Milestone 1) is built so it doubles as the MVP of the shipped product — not a throwaway.
> Related memory: `project_voice_demo_platform_decision_2026_07_23` (rent-not-build until a
> client bites), `project_ai_receptionist_reframe`, `project_gemini_live_voice_built`.

## The core idea (read first)

Everything on the CRM side already exists or is spec'd and is **channel-agnostic**: the per-lead
conversation thread, the `Interactions` log, live SSE updates, lead naming (phone -> real name),
KB injection, and Cal.diy booking. The **only genuinely new thing** is the **real-time voice
bridge**: a phone number, the live audio stream, and piping transcript + tool events back into
`Interactions`. That bridge *is* the Tier-3 product. So building the demo properly = building the
MVP of the real thing; the gap between demo and production is robustness and multi-tenancy, not
architecture.

## Architecture (decided)

**One brain, two front doors.** The OpenAI Realtime session (prompt + KB + Cal.diy tool + live
CRM logging) is **transport-agnostic**. A phone call over SIP and a browser click-to-talk over
WebRTC are two front doors to the same session brain and the same CRM logging path.

- **The brain:** an OpenAI Realtime session (`gpt-realtime`, the native voice validated in the
  playground), configured per-call with instructions + KB + tool declarations.
- **Phone door (SIP):** a US / US-toll-free number -> carrier SIP trunk (Telnyx for the demo;
  Twilio as a drop-in fallback if Telnyx verification stalls) -> OpenAI's SIP address
  (`sip:{project}@sip.api.openai.com`). OpenAI webhooks the Pi on an incoming call.
- **Web door (WebRTC):** a minimal click-to-talk page. The Pi mints a short-lived ephemeral
  token; the browser connects straight to OpenAI and fires `response.create` on open.
- **The Pi (automations engine):** control plane + logging only, **never in the media path**. A
  new realtime handler module, sibling to `src/webhooks/twilio_voice_mc_routes.py`.
- **The CRM (Express + React):** the existing Conversations per-lead thread, updating live via
  SSE (`broadcastToUser`). Near-zero UI change.
- **Source of truth:** a new `Prompt_Library` entry (the Brightside seed for the demo).

**Why OpenAI Realtime + SIP (not Twilio ConversationRelay):** ConversationRelay keeps the brain
in the Python engine but replaces the native `gpt-realtime` voice with Twilio STT + a separate
TTS voice — losing exactly the voice quality that sold the demo. OpenAI Realtime + SIP keeps the
playground voice; the CRM logging is bolted on via transcript/tool events. Carrier is
interchangeable because audio never touches the Pi.

## The speak-first win

The bare playground could not make the AI greet first (it waits for the user to speak). The real
build **fixes this for free on both doors**: on an inbound SIP call the Pi accepts and fires
`response.create` immediately; on the web door the page fires `response.create` on connect. Emma
opens with her greeting the instant it connects — a true "answering the phone" moment. So the
production path is a *better* demo than the playground, not just equal to it.

## Data flow

### Phone call (SIP)

1. Prospect dials the number -> carrier routes to OpenAI's SIP address.
2. OpenAI webhooks the Pi: "incoming call" (with a call id).
3. Pi accepts, loads the prompt + KB from the DB, builds and sends the session config
   (instructions, voice, language, Cal.diy tool), and fires `response.create` -> **Emma greets first**.
4. Audio is caller <-> OpenAI. The Pi subscribes to the session's **server-side events**
   (input/output transcripts, tool calls, session end).
5. On the first event, the Pi creates the Lead (formatted phone-number title, **never "Unknown"**)
   and writes each turn to `Interactions` -> SSE -> the CRM thread fills in **live**.
6. Booking intent -> OpenAI emits a tool call -> Pi calls Cal.diy -> returns the slot -> Emma
   confirms -> Pi logs **"Booked."**
7. Call ends -> Pi finalizes (status + summary).

### Web call (WebRTC)

Identical brain, one asymmetry: with WebRTC the browser talks **directly** to OpenAI, so
transcript/tool events arrive on the **browser's** data channel, not the Pi. The click-to-talk
page **forwards those events to a Pi relay endpoint**, which then does the same Lead +
`Interactions` + SSE write. Same destination, one extra hop.

**Shared invariant:** steps 5-7 (Lead + Interactions + SSE + Cal.diy) are identical for both
doors. Only how events *arrive* differs (server-side for SIP; via the relay for web).

## Components

Each a small unit with one job; most live in the automations engine.

1. **Session config builder** — assembles the session (instructions from the `Prompt_Library`
   entry + KB injection + voice + language + Cal.diy tool declaration). Shared by both doors.
2. **SIP call handler** — receives OpenAI's incoming-call webhook, accepts, sends the config,
   fires `response.create` (greet-first).
3. **Ephemeral token endpoint** — mints a short-lived `client_secret` for the web door
   (sets `OpenAI-Safety-Identifier`).
4. **Web relay endpoint** — receives transcript/tool events forwarded from the click-to-talk page.
5. **Event consumer / logger** — the shared heart: maps realtime events -> Lead (idempotent per
   call id) + `Interactions` writes -> SSE. Fed server-side for SIP, via the relay for web.
6. **Cal.diy tool executor** — handles the booking tool call, reuses the existing booking flow,
   returns the slot to the session.
7. **Click-to-talk page** — minimal WebRTC page: fetch token, connect, `response.create` on open,
   forward events to the relay.
8. **Prompt_Library entry** — the Brightside voice-receptionist prompt migrated from
   `docs/voice-demo/solar-receptionist-prompt.md`, source of truth (see
   `feedback_prompt_source_of_truth`).
9. **CRM rendering** — existing Conversations thread; add a "voice call" interaction type/badge.

## Error handling

- **Booking latency:** Emma says "let me check the diary" (filler) with a ~2s timeout on Cal.diy;
  on failure she offers to note it and have someone confirm — never dead air.
- **Web relay drops:** the call still works (audio is direct to OpenAI); only the live CRM view
  degrades. Log and continue, do not break the call.
- **Idempotent lead creation** per call id (no duplicate leads on repeated events).
- **SSE via `broadcastToUser`**, never `broadcast` (see `notification-sse-user-scope`).
- **Server-side timestamps** (`new Date()`) on `Interactions` (drizzle-zod rejects ISO strings).
- **Web-door abuse guard:** short-lived tokens + `OpenAI-Safety-Identifier` so the public demo
  link cannot be run up.

## Testing

- **Unit:** config builder (right prompt + KB assembled), event -> Interactions mapping, Cal.diy
  executor (mocked), lead idempotency.
- **Integration:** feed recorded realtime events to the consumer; assert Interactions + SSE fire.
- **Manual E2E (the demo itself):** call the number / open the web link -> Emma greets first ->
  transcript streams into the CRM thread live -> a booking writes to Cal.diy and shows "Booked."

## Scope

### Milestone 1 — the demo (build first)

- Both front doors: a US / toll-free number (SIP) **and** a browser click-to-talk link (WebRTC).
- Single tenant (Brightside Solar), **English**.
- Emma greets first; live transcript into the existing Conversations thread.
- **Real Cal.diy booking** mid-call, surfaced as "Booked".
- US/toll-free number chosen to dodge the UK-number proof-of-address bundle; the web link is the
  geography-proof fallback anyone can use from the US / UK / CAN / anywhere.

### Later milestones (spec'd, not built until a client bites)

- Multi-tenant provisioning (per-account number, prompt, KB, calendar).
- Dutch (and other languages) via the language dial.
- Owner real-time notification ("live call in progress").
- The `receptionist_posture` dial (secretary / balanced / sales).
- Production robustness, retries, observability.
- UK geographic number (client provides the address / regulatory bundle).

## Acceptance criteria

- A prospect can reach Emma via **both** a phone number and a browser link; **Emma speaks first**
  on both.
- The live conversation appears in the **existing per-lead Conversations thread** in real time,
  via SSE; the lead is titled by its formatted phone number, **never "Unknown"**.
- Emma answers from the **Account Knowledge Base** and behaves as a receptionist (triage, not
  hard-sell).
- A booking mid-call writes a **real Cal.diy appointment** and surfaces as **"Booked"** in the thread.
- The **Pi is never in the media path** (audio is caller/browser <-> OpenAI only).
- The demo prompt lives in **`Prompt_Library`** as the single source of truth.
- Existing WhatsApp reactivation + Tier-1/2 receptionist behavior is **not regressed**.

## Out of scope

- The WhatsApp text-back tiers (owned by `specs/ai-receptionist/`).
- Multi-tenant provisioning UI, language dial, posture dial, owner notifications (later milestones).
- Any change to the media architecture that would put audio through the Pi.
- New booking/calendar mechanics — reuse the existing Cal.diy flow as-is.

## Related features / dependencies

- **AI Receptionist (Tier 1/2)** — `specs/ai-receptionist/`; this is its deferred Tier-3 sibling.
- **Calendar / Cal.diy booking** — reused as-is (`project_engine_caldiy_bridge_2026_07_14`).
- **Conversations surface** — `features/conversations/`; the thread this streams into.
- **Prompt source of truth** — `Prompt_Library` (`feedback_prompt_source_of_truth`).
- **Notification SSE user-scope** — logging must SSE via `broadcastToUser`.
- **Demo prompt** — `docs/voice-demo/solar-receptionist-prompt.md` (Brightside seed).
