# Session prompt: build voice memos in the browser demo

Copy everything below the line into a fresh session.

---

Build **voice memos** for the browser demo page (`/demo/<token>`). This is Part 2 of an approved design;
Part 1 (moving Restart into a header menu) is a **separate session, do not touch it**. Both edit the same
composer row, so doing both here creates conflicts.

**Read first:**
- `specs/demo-composer-voice/design.md` is the approved design and the decision record. Start with the
  stale-references box at the top: the page was split into ES modules after the spec was written.
- `specs/demo-composer-voice/mockups.html` is a working prototype of the target interaction. Open it in a
  browser; section 02 records, transcribes and plays back. Match that behaviour.

## What to build

An empty composer offers a mic. Recording sends audio to the engine, which transcribes it through the
same path a WhatsApp voice note already takes, and the visitor's bubble shows a player with the
transcription underneath.

## Decisions already made, do not relitigate

1. The mic occupies the **send button's own slot** and morphs into the send arrow the moment anything is
   typed. One round button in the composer, no layout shift.
2. **Tap to start, tap to send.** Not hold-to-talk.
3. **30 second cap.** Timer turns amber at 25, hard stop at 30.
4. **Player first, transcript underneath**, matching the CRM's treatment in
   `client/src/features/conversations/components/chatView/ChatBubble.tsx:169`.
5. The mic is **not advertised** in the placeholder. No hint bubble.

## Port, do not invent: the CRM already solved half of this

The CRM has both halves of this feature, in two systems that were never joined. Read all three files
before you write anything. None can be imported (they are React and TypeScript; this page is
bundler-free vanilla ES modules), but the logic ports almost verbatim.

| Take from | What it gives you | Watch out for |
|---|---|---|
| `client/src/lib/voiceRecorder.ts` | The entire recorder: `getUserMedia`, `isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4"`, chunk collection, `onstop` to a Blob, stopping the tracks, the 1s timer with auto-stop at the cap, and `blobToBase64`. Its module-level singleton pattern is the right shape for this page too. | It is **dictation**, not messaging: it transcribes and writes to the clipboard, and never sends audio anywhere. Drop `useSyncExternalStore` and the clipboard path. Its cap is 300s; ours is 30. |
| `client/src/features/conversations/components/chatView/VoiceMemoPlayer.tsx` | The player treatment: hash-seeded waveform bars painted instantly, the rAF progress loop, and the global single-active-audio manager at lines 5-23, which is the same problem this page has for a different reason. | Skip the lazy `AudioContext` decode and the 1x/1.5x/2x speed control. Nobody re-listens to their own 8 second memo. |
| `client/src/features/conversations/components/chatView/ChatBubble.tsx:169-192` | The bubble layout to match: player on top, transcript italic and dimmed underneath, "Transcription unavailable" when it failed. | It reads `[Voice Note]: ` off the content; the engine change below strips that prefix server-side instead. |

Two questions an earlier draft of the spec left open are now **answered, do not re-litigate them**:

- **Groq accepts webm. No transcode, no pre-flight check.** `server/routes/user-settings.ts:96` has been
  posting browser webm straight to `whisper-large-v3-turbo` in production. It normalises with
  `rawMime.split(";")[0].trim()` and then maps to an extension: that is exactly the fix
  `voice_service.py` needs, already written in TypeScript, twelve lines from the Groq call.
- **The Express body limit needs no change.** `server/index.ts:34` already mounts
  `express.json({ limit: "20mb" })` globally.

## Order of work

1. **Engine** (`/home/gabriel/automations/`, read its own `CLAUDE.md` first):
   - `POST /web-demo/{token}/voice` in `src/webhooks/web_demo_routes.py`. Accept
     `{ audio: "data:audio/webm;base64,...", durationMs }`, decode, and build the **same
     `webhook_data` that `web_demo_message` already builds** (around line 380), except with
     `num_media: 1`, `media_bytes_0: <bytes>`, `media_content_type_0: <normalised>`, `body: ""`.
     `process_inbound` does the rest. Do not add anything to the AI pipeline.
   - `GET /web-demo/{token}/audio?id=<interaction_id>` returning `{ dataUrl }` as JSON, after checking
     the interaction belongs to that token's lead.
   - `_load_messages` (line 200) gains `id` and a `kind: "voice"` marker, and strips the
     `[Voice Note]: ` prefix out of `text`. **It must not return the base64 audio**: the page re-polls
     the whole conversation every 1.6 to 6 seconds.
2. **Transcription** (`/home/gabriel/automations/tools/voice_service.py`): add `audio/webm` to the
   `ext_map` in **both** copies (around lines 120 and 182), and normalise the content type first, since
   Chrome sends `audio/webm;codecs=opus` which misses the map and silently falls back to `.ogg`. Pass
   the lead's language to Whisper as a hint while you are in there; Dutch accuracy on short clips
   improves noticeably.
3. **Proxy** (`server/routes/demo.ts:526`): add `voice` and `audio` to `WEB_DEMO_SUFFIXES`. The body
   limit is already 20mb globally, so nothing to raise; do add a size guard in the handler (reject over
   1.5MB) so a crafted request cannot push 20mb of base64 into the engine. Do not rewrite the proxy to
   stream multipart: the allowlist and the JSON-only shape are deliberate security properties.
4. **Page** (`client/public/premium/demo/`):
   - Recorder UI and mic/send morph in `main.js` (composer markup is at 142-160, `wire()` at 235).
   - Voice bubble rendering in `chat.js` (`messagesHtml`, line 13).
   - Styles in `demo.css`. The mockup's CSS is a working reference, but follow the file's existing
     token vocabulary rather than pasting the mockup's frame colours.
5. **Copy**: every new user-facing string goes into `demo/copy.js` and through `t(key)`, in **all three
   packs** (`en`, `nl`, `pt`; Portuguese is Brazilian). Nothing hardcoded in English.

## Gotchas that will bite

- **`render()` rebuilds the whole tree** (`main.js:69`, `root.innerHTML = ...`). An `<audio>` element
  inside a bubble is destroyed on every poll, killing playback mid-sentence. Use one singleton `<audio>`
  on `document.body`, keep playback state at module scope, and have render paint the play/pause state
  onto the bubble with the matching `data-mid`. The `setPop()` workaround at `main.js:213` is the
  precedent for this shape.
- **A poll landing mid-recording** rebuilds the composer under the visitor. While recording, `render()`
  should set a "needs render" flag and return, with the timer updated by direct DOM write, flushing when
  recording stops.
- **`signature()`** (`format.js:61`) decides whether a poll re-renders. A transcript arriving can leave
  stage, done, turn count, message count and last-message text all unchanged, so the transcript never
  paints. Add the last message's id and kind.
- **MIME detection:** `MediaRecorder.isTypeSupported("audio/webm;codecs=opus")`, else `audio/mp4`
  (Safari), else hide the mic entirely. Never render a button that cannot work, and treat a denied
  permission the same way.
- **Optimistic render matters.** The bubble appears the instant recording stops, playing from the local
  blob, with a shimmer where the transcript will land. Do not make the visitor watch a spinner where
  their own message should be.
- `URL.revokeObjectURL` the local blob once the server copy takes over, and on restart.

## Verifying

- `node client/public/premium/demo/demo.test.mjs`. Those tests import the pure render modules and touch
  no DOM; add cases for whatever you add to `chat.js`, `format.js` and `copy.js`. `main.js` owns the DOM
  and is deliberately not imported, so recorder logic is verified in the browser, not there.
- The Express app auto-reloads (`pm2` watches `server` and `shared`). **The engine does not**: run
  `pm2 restart leadawaker-engine` after any Python edit.
- `demo.html` and `demo/*.js` are served straight from `client/public` in dev, so
  `app.leadawaker.com/demo/<token>` is live on save. Production goes through
  `script/build-premium.ts`, so check that any new file is picked up by it.
- Test on a **real iPhone**. Safari's `MediaRecorder` produces `audio/mp4` and phones are where this
  gets demoed.

## Constraints

- Never run `npx tsc --noEmit` unless Gabriel asks. Never `npm run dev`; the app runs under pm2.
- Do not commit or push unless Gabriel asks.
- The working tree has unrelated modified files in it. Leave them alone.
