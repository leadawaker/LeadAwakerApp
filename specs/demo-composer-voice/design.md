# Browser demo: composer controls + voice memos

Status: **design settled 2026-08-13. Not built yet.**
Date: 2026-08-12, decisions 2026-08-13
Surface: `client/public/premium/demo.html` (the `/demo/<token>` page), plus
`server/routes/demo.ts` (proxy) and `automations/src/webhooks/web_demo_routes.py` (engine).

Two questions from Gabriel:

1. Restart sits under the text editor. Would a menu in the top header be better, especially on mobile?
2. When the input is empty, should the composer offer a mic and accept a voice memo, rendered as a
   little player with the transcription underneath, like the CRM does?

Short answers: **yes to moving Restart into the header** (with one addition so the finished state does
not lose its call to action), and **yes to voice memos** (the engine already does all the hard parts;
this is mostly a UI job plus one endpoint).

## Decisions (Gabriel, 2026-08-13)

1. **Header control is labelled on desktop, icon only on mobile.** "↺ Restart" while there is room, the
   icon alone below 700px.
2. **The menu carries a human CTA.** A quiet "talk to a human" link under the restart options, alongside
   the WhatsApp handoff. It reaches **Gabriel himself**, not a booking page and not the campaign's
   simulated calendar: WhatsApp on +31 6 84446349 and email to gabriel@leadawaker.com, both prefilled
   with which demo the visitor is looking at. See the section below.
3. **Voice memos cap at 30 seconds.** Timer turns amber at 25.
4. **The mic sits in the send button's slot**, morphing to the send arrow as soon as anything is typed.
   Confirmed as designed below.
5. **The mic is not advertised.** Placeholder text stays as it is and there is no first-run hint: a
   microphone in the send position is a universally read affordance, and the composer stays clean. If
   usage turns out to be low, a hint is a one line change later.

---

## Part 1: where Restart belongs

### What is there now

`.restart-anchor` sits beside the input in the composer row (demo.html:677). It opens a popover holding
the real content: the two scenario buttons on an invited link, the "run it in WhatsApp instead" handoff,
and the restarts-left count. Below 560px the button drops to its own full width row under the input
(demo.html:397-403). When the demo finishes the editor is removed and Restart becomes a centred
full width button (demo.html:260-262).

Three problems, in order of how much they cost:

1. **On mobile it is the loudest thing on the page.** A full width pill under the composer outweighs the
   send button, on a page whose entire job is to get the visitor to send one more message.
2. **It steals vertical space** exactly where mobile has none: the header already wraps to two rows,
   the tracker takes a third, and the keyboard eats half of what is left.
3. **It is a menu wearing a button's clothes.** It holds three unrelated things (scenario switch,
   WhatsApp handoff, quota). That is page level chrome, not a composer action.

### Options

**A. Header anchored, responsive label (recommended).** One control at the right end of `.hdr-inner`.
Desktop keeps a labelled ghost pill ("↺ Restart") so discoverability does not drop. Below 700px the
label is hidden by CSS and it becomes an icon only button. The popover content is unchanged; it just
drops down from the header instead of up from the composer. On phones it renders as a bottom sheet
instead (see below). Composer row becomes input + mic + send, nothing else.

**B. Icon only, still beside the composer.** Shrink it to a 34px circle matching `.send`, sitting left
of the input. Smallest diff. Still eats composer width on mobile, still puts a meta control in the
primary action row, and the popover still opens into the keyboard.

**C. Bottom sheet only, triggered from a floating button.** Nice on mobile, odd on desktop, and adds a
control that floats over the transcript.

Recommendation: **A**, with C's presentation applied to A under 700px. Same markup, different CSS: the
popover switches to `position: fixed; left/right/bottom: 0` with rounded top corners, a slide up
animation and a dimmed backdrop. Roughly 30 lines of CSS, and it puts the choices under the thumb
rather than at the top of the screen, which is where a header anchored popover would land.

Icon: `⋯` (horizontal ellipsis) or `⋮` rather than `☰`. A hamburger promises navigation; there is no
navigation on this page. On desktop the word "Restart" carries the meaning anyway.

### The one thing that must not regress

When `s.done` is true the composer disappears and Restart is currently the only control left, which is
correct: "run it again" is the right next action at the end of a demo. If Restart moves into a header
icon, that moment loses its call to action.

So: **the done state gets an explicit primary button inside the recap**, at the end of
`recapContentHtml()`, reading "Run it again" (plus the WhatsApp handoff line under it). The header menu
still works, but the payoff screen keeps a real button. This is a small addition to a function that
already renders in both the desktop aside and the mobile in-stream card, so both surfaces get it free.

### Files touched

- `client/public/premium/demo.html`: move `.restart-anchor` markup from the composer into `.hdr-inner`,
  add the responsive label rule, add the bottom sheet media query, add the done state button in
  `recapContentHtml()`, delete `.composer.is-done` rules that exist only to centre the lone button.
- Nothing server side. `restartOptions`, `restartsUsed/Max` and `waLink` are already in the state payload.

### The human CTA (confirmed in scope)

The menu also carries a quiet "talk to a human" link, which the page currently offers nowhere outside
the recap. It sits under the pop-rule with the WhatsApp handoff, in the same muted foot text, so it
never competes with the restart options above it.

**Destination is Gabriel directly, not a booking page and not the campaign.** This is the one link on
the page that steps out of the simulation: the visitor is a prospect Gabriel sent the demo to, and
"talk to a human" means reach Gabriel. Two ways, WhatsApp first because it matches the medium the
product is about, email second:

- **WhatsApp:** `https://wa.me/31684446349` (from +31 6 84446349, E.164 without the leading zero).
- **Email:** `mailto:gabriel@leadawaker.com`.

It must NOT use the per-campaign chain (`calendar_link_override` then `booking_url` then
`calendar_link`) that `campaign_launcher.py:299` and the in-demo booking flow use. That chain points at
whichever calendar the demo is simulating: on campaign 60 it resolves to the isolated demo account (52),
so a prospect asking for a human would land on a fake calendar. The two links look interchangeable and
are not.

**Prefill both with who is asking.** The page already knows the token and the company on the state
payload, so the WhatsApp link carries `?text=Hi Gabriel, I'm looking at the <company> demo` and the
mailto carries `?subject=Demo: <company>`. Gabriel gets the context in the first message instead of a
cold "hi". URL-encode both, and fall back to a bare link when `company` is empty.

**Naming, because there are now two WhatsApp links in one menu.** The existing handoff continues the
demo on the demo's own number, driven by an AI; the new one is a real person. They cannot both read as
"WhatsApp". So: the handoff keeps "Run it in WhatsApp instead", and the human line names him,
"Message Gabriel on WhatsApp". A separator rule between the demo controls and the human line reinforces
that one of them leaves the demo.

**Exposure, noted not argued (Gabriel's call, 2026-08-13):** the page is `noindex, nofollow` and tokens
are unguessable, but public homepage demo sessions do mint tokens, so the number is effectively
published. Hardcode neither number nor address in `demo.html`: both come down on the state payload
next to `waLink`, so changing them later is a server edit, not a static rebuild and redeploy.

---

## Part 2: voice memos in the composer

### Why this is the strongest idea on the page

The demo currently proves "the AI replies well to typed messages". Every chatbot demo on the internet
proves that. Real WhatsApp leads in home improvement send **voice notes**, constantly, because they are
driving or standing on a roof. A prospect who rambles for fifteen seconds and watches a clean structured
brief come out of it has seen the actual product, not a chat widget.

Secondary effect, and probably the bigger one commercially: on a phone, typing a realistic "reply as if
you were the lead" is work. Speaking is not. More visitors will complete enough turns to reach the recap,
which is where the demo actually sells.

The risk to manage: a bad transcript in a noisy room makes the AI look stupid. Showing the transcription
under the player fixes this. The visitor reads what the AI heard and blames their own mumbling, not the
product. That is exactly the CRM's existing treatment, so the answer to Gabriel's question is yes, and
for a reason beyond consistency.

### What already exists (this is why it is cheap)

The engine's inbound pipeline already handles audio end to end, for WhatsApp:

- `inbound_handler.py:190` branches on `content_type.startswith("audio/")`, sets `msg_type = "voice_note"`,
  calls `transcribe_audio_bytes()` (Groq `whisper-large-v3-turbo`), writes
  `Content = "[Voice Note]: <transcript>"` and `attachment = "data:<type>;base64,..."`, with a
  fallback line when transcription fails so the AI can still respond.
- `web_demo_routes.py:380` already builds a webhook payload carrying `num_media`, `media_bytes_0` and
  `media_content_type_0`. Those slots are filled with zeros/empties today; `process_inbound` reads
  exactly those keys.

So the AI pipeline needs **no changes at all**. Fill in three fields and a browser voice note walks the
same path a WhatsApp one does. Free side effect: it lands in the CRM inbox as a `voice_note` interaction
with the player and transcript already rendering (`ChatBubble.tsx:169-192`).

### Composer UX

Follow WhatsApp exactly, because every visitor already knows it and this is a one-time surface with no
room for learning:

| State | Right hand button | Rest of composer |
|---|---|---|
| Input empty | **Mic** (wine circle, same 34px as send) | placeholder unchanged |
| Any text typed | **Send arrow** (morphs, no layout shift) | normal |
| Recording | **Send arrow** | composer swaps to the recording bar |
| Sending | disabled | as today |

Recording bar: trash icon on the left (cancel, discards), a pulsing red dot with a `mm:ss` timer, a live
level meter, send arrow on the right. **Tap to start, tap to stop**, not hold to talk: hold is a mobile
idiom that is awkward with a mouse, and a first time visitor will not discover it. WhatsApp Web uses tap
for the same reason.

Caps: **30 seconds** hard stop, timer turning amber at 25. Demo answers are short, and the cap keeps the
payload and the Whisper bill small (a 30 second Opus note is roughly 30 to 60KB, so 40 to 80KB base64).
A voice note counts as one turn against `MAX_TURNS_PER_SESSION`, same as a typed message, no change
needed there.

No mic, permission denied, or an insecure context: hide the mic button entirely and leave the send arrow
in place. Never render a button that cannot work. (Both hosts are HTTPS, so `getUserMedia` is available;
this is only about a user who declines the prompt.)

### The bubble

Visitor's own message, wine bubble as today, containing:

1. A play/pause circle plus static waveform bars plus `0:12` elapsed/total.
2. The transcript underneath in italic at reduced opacity, exactly as `ChatBubble.tsx` renders a
   `[Voice Note]:` message.

Waveform: generate it from a hash of the message id, like `VoiceMemoPlayer.tsx` does for its instant
bars. Real `AudioContext` decoding is not worth it here. Skip the CRM's 1x/1.5x/2x speed toggle; nobody
re-listens to their own eight second memo at double speed.

Optimistic render matters: the bubble appears the instant recording stops, playing from the local blob,
with a shimmer where the transcript will land. Whisper takes one to three seconds. The demo's whole
claim is that this feels instant, so the visitor must never watch a spinner where their own message
should be.

### Backend plan

**Constraint discovered while researching:** the Express proxy at `server/routes/demo.ts:456` re-serialises
every POST as JSON with a hardcoded `content-type: application/json`, and only allows the suffixes
`""`, `message`, `restart`, `recap`. Multipart cannot pass through it, and the allowlist is a deliberate
security property (it stops the route being an open proxy into every engine endpoint). Rewriting it to
stream multipart is more surgery on a security sensitive file than this feature is worth.

So: **send the audio as base64 inside JSON.**

1. `POST /api/web-demo/{token}/voice` with `{ audio: "data:audio/webm;base64,...", durationMs }`.
   Add `voice` and `audio` to `WEB_DEMO_SUFFIXES`.
2. **Body limit.** `express.json()` defaults to 100kb. A 30 second Opus note is roughly 30 to 60KB raw,
   so 40 to 80KB base64, which is already over that default on the long end, and a browser that falls
   back to a less efficient codec will blow past it. Mount a 2mb limit on this path only, and reject
   anything over 1.5MB in the handler before it reaches the engine.
3. Engine handler decodes the data URL and builds the same `webhook_data` as `/message`, with
   `num_media: 1`, `media_bytes_0: <bytes>`, `media_content_type_0: <normalised>`, `body: ""`. Nothing
   else changes.
4. `voice_service.py` `ext_map` (both copies, lines 120 and 182) needs `audio/webm: ".webm"`, and the
   content type must be normalised first: Chrome reports `audio/webm;codecs=opus`, which misses the map
   today and silently falls back to `.ogg`. Safari reports `audio/mp4`, already mapped. **Verify Groq
   accepts `.webm`** before building; if not, the fallback is to record as `audio/ogg` where supported
   and transcode on the Pi, which would be a real cost increase and should change the decision.
5. Optional, three lines, worth it: pass the lead's language to `transcribe_audio_bytes` as a Whisper
   hint. Dutch transcription accuracy on short clips improves noticeably with a language hint.

**Playback after a reload.** Do not put the base64 data URL in the state payload: the page polls the full
state every 1.6 to 6 seconds (demo.html:875-908) and two voice notes would make every poll roughly a
megabyte. Instead `_load_messages` returns `id`, `kind: "voice"` and the transcript with the
`[Voice Note]: ` prefix stripped, and the page fetches the audio lazily from
`GET /api/web-demo/{token}/audio?id=<interaction_id>` returning `{ dataUrl }` (JSON, so the existing
proxy passes it through unchanged), only when the visitor actually presses play on a bubble whose blob
is not already in the page's local cache. In the normal case (same tab, they just recorded it) there is
no fetch at all.

### Frontend gotchas specific to this file

These are the things that will break if they are not designed for up front:

1. **`render()` rebuilds the whole tree** (`root.innerHTML = ...`, demo.html:634). An `<audio>` element
   inside a bubble is destroyed on every poll that changes anything, killing playback mid-sentence.
   Fix: one singleton `<audio>` appended to `document.body`, playback state in module scope, and
   `render()` paints the play/pause state onto the bubble carrying the matching `data-mid`. This is the
   same shape as the existing `popOpen` workaround, and it mirrors the CRM's global `_activeAudio`
   manager (`VoiceMemoPlayer.tsx:5-23`).
2. **A poll landing mid recording** rebuilds the composer under the visitor. Fix: while recording,
   `render()` sets a `needsRender` flag and returns; the timer updates by direct DOM write; the flag is
   flushed when recording stops. Again, the `setPop()` precedent (demo.html:717).
3. **`signature()`** (demo.html:497) compares stage, done, turn count, message count and last message
   text. When a voice bubble's transcript arrives, all of those can be unchanged if the AI has not replied
   yet. Add the last message's `id` and a `kind` marker, or the transcript will not paint until the next
   real change.
4. **MIME detection:** `MediaRecorder.isTypeSupported("audio/webm;codecs=opus")`, else `audio/mp4`
   (Safari), else hide the mic.
5. **iOS Safari** has `MediaRecorder` from 14.3 and produces `audio/mp4`. This must be tested on a real
   iPhone, since phones are where Gabriel demos.
6. `URL.revokeObjectURL` on the local blob once the server copy takes over, and on restart.

### Files touched

- `client/public/premium/demo.html`: mic/send morph, recording bar, recorder logic, singleton audio
  player, voice bubble renderer, render suppression while recording, `signature()` fix.
- `server/routes/demo.ts`: two new allowlisted suffixes, per route body limit, size guard.
- `automations/src/webhooks/web_demo_routes.py`: `POST /{token}/voice`, `GET /{token}/audio`,
  `_load_messages` returning id/kind/attachment presence.
- `automations/tools/voice_service.py`: content type normalisation, `webm` in both `ext_map` copies,
  optional language hint.

---

## Deliberately not in scope

- **The AI replying with voice.** The stack has TTS (Fish, ElevenLabs), and "the AI answers by voice too"
  would demo well, but it adds latency, cost and a per language voice matrix to a page whose promise is
  speed. Separate decision.
- **Real waveform decoding**, playback speed control, and scrubbing. The CRM has them because people
  review real conversations there. Nobody scrubs their own demo memo.
- **Storing duration server side.** Threading a new field through the shared `create_interaction` path
  for a cosmetic timer is not worth it. The timer appears once the audio loads.

## Open questions

None. All four are answered in the Decisions block at the top. Next step is the implementation plan.
