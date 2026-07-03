# Implementation Plan: Gemini Live Voice

## Overview

Add a `tools/gemini_live_service.py` module to the automations engine that runs one asynchronous voice-to-voice turn against the Gemini Live API, persist inbound voice-memo audio so Live can hear the lead, branch `ai_conversation.py` on a new `Campaigns.voice_engine` column, and expose the setting in the CRM campaign settings panel.

## Phase 1: Live turn module + test route (engine)

Standalone, nothing wired into conversations yet — verifiable by curl.

### Tasks
- [ ] Install `google-genai` SDK into the automations venv and pin it in requirements
- [ ] Add config settings: `gemini_live_native_model`, `gemini_live_half_model` (verify current model IDs against ai.google.dev before hardcoding — names below are the last known and may have 3.x successors)
- [ ] Create `tools/gemini_live_service.py` with `async def live_voice_reply(...)` [complex]
  - [ ] Session open → send system instruction + history → send audio (or text) turn → collect audio + output transcript → close
  - [ ] ffmpeg helpers: OGG/Opus → PCM16 16kHz mono (input); 24kHz PCM → OGG/Opus (output, reuse `_pcm_or_wav_to_ogg` from `tools/tts_service.py`)
  - [ ] Voice selection from `tts_voice_id_{lang}` with safe fallback if the name isn't in the Live voice list
- [ ] Add `POST /api/voice/live-test` route in `src/api/voice.py` for manual verification
- [ ] Verify: curl the test route with a recorded OGG file for both `live_native` and `live_half`, confirm playable OGG reply + transcript

### Technical Details

```bash
cd /home/gabriel/automations && .venv/bin/pip install google-genai
```

`src/config.py` (next to the existing Gemini TTS block):
```python
    gemini_live_native_model: str = "gemini-2.5-flash-preview-native-audio-dialog"  # VERIFY current ID at build time
    gemini_live_half_model: str = "gemini-live-2.5-flash-preview"                   # VERIFY current ID at build time
```

`tools/gemini_live_service.py` interface (mirrors `synthesize_voice`'s dict-result convention):
```python
async def live_voice_reply(
    *,
    system_prompt: str,                  # rendered campaign prompt, voice_mode=on
    history: list[dict],                 # [{"role": "user"|"model", "text": str}, ...] chronological
    inbound_audio_path: str | None,      # lead's memo OGG on disk; None → fall back to inbound_text
    inbound_text: str,                   # transcript (always available — pipeline already produces it)
    voice_name: str,                     # Gemini prebuilt voice, e.g. "Kore"
    engine: str,                         # "live_native" | "live_half"
    language: str,                       # "en" | "nl" — set speech_config.language_code
) -> dict:
    # {"success", "audio_url", "local_path", "transcript", "model", "error"}
```

Live session shape (google-genai SDK):
```python
from google import genai
from google.genai import types

client = genai.Client(api_key=settings.gemini_api_key)
config = types.LiveConnectConfig(
    response_modalities=["AUDIO"],
    system_instruction=system_prompt,
    speech_config=types.SpeechConfig(
        voice_config=types.VoiceConfig(prebuilt_voice_config=types.PrebuiltVoiceConfig(voice_name=voice_name)),
    ),
    output_audio_transcription=types.AudioTranscriptionConfig(),   # transcript of the reply — REQUIRED
    input_audio_transcription=types.AudioTranscriptionConfig(),
)
async with client.aio.live.connect(model=model, config=config) as session:
    # 1. history as turns via session.send_client_content(turns=[...], turn_complete=False)
    # 2. inbound audio: session.send_realtime_input(audio=types.Blob(data=pcm16_bytes, mime_type="audio/pcm;rate=16000"))
    #    or, if no audio file: send transcript as a final text turn
    # 3. iterate session.receive(): accumulate data chunks (24kHz PCM) + output_transcription.text until turn_complete
```

Audio conversions:
```bash
# inbound: WhatsApp OGG/Opus -> PCM16 16kHz mono for Live input
ffmpeg -i in.ogg -f s16le -ac 1 -ar 16000 pipe:1
# outbound: Live's 24kHz PCM -> WAV wrap (wave module, rate=24000) -> existing _pcm_or_wav_to_ogg()
```

Guards: 90s overall timeout on the session; cap accumulated reply audio at ~60s; on any exception return `success=False` (caller falls back). Save output to the existing `OUTBOUND_AUDIO_DIR` so the public `/audio/outbound/` URL serving just works.

Test route:
```python
class LiveTestRequest(BaseModel):
    text: str | None = None
    audio_url: str | None = None      # e.g. a previous /audio/outbound/ file
    voice_id: str = "Kore"
    engine: str = "live_native"
    language: str = "en"
    system_prompt: str = "You are a friendly Dutch sales assistant. Reply in one short spoken sentence."
```

## Phase 2: Persist inbound voice-memo audio

Live needs the lead's real audio; today `inbound_handler.py` transcribes the bytes and drops them.

### Tasks
- [ ] Migration script `scripts/migrate_add_interactions_media_path.py`: `ALTER TABLE Interactions ADD COLUMN IF NOT EXISTS media_path text`
- [ ] In `inbound_handler.py` Step 4 (media processing): when `msg_type == "voice_note"`, write the audio bytes to `/home/gabriel/automations/.tmp/audio/inbound/{uuid}.ogg` and carry the path through to the interaction insert (`media_path`)
- [ ] Retention: extend the existing outbound-audio cleanup job (or add one) to also purge `.tmp/audio/inbound/` files older than 14 days

### Technical Details

- Bytes are already in hand at `inbound_handler.py:182` (`pre_downloaded_bytes`) or downloadable from `media_url_0` — save whichever was used for transcription, before the bytes go out of scope.
- The interaction insert for inbound messages happens earlier in the pipeline; pass `media_path` via the same dict that carries `Content`/`msg_type`, mirroring how `twilio_message_sid` flows. Follow the existing `create_interaction` column-add pattern.
- Content-type note: WhatsApp Cloud voice notes are `audio/ogg; codecs=opus` — store as-is (`.ogg`), no transcode needed for storage; the Phase 1 helper transcodes at use time.

## Phase 3: Engine wiring — campaign flag + conversation branch

### Tasks
- [ ] Migration script `scripts/migrate_add_campaign_voice_engine.py`: `ALTER TABLE Campaigns ADD COLUMN IF NOT EXISTS voice_engine text DEFAULT 'pipeline'`; include `voice_engine` in `get_campaign_with_account()`'s SELECT (tools/db/campaigns.py — same gotcha as tts_style: forgetting this starves the resolver)
- [ ] Extend `send_message()` in `tools/send_service.py` with `audio_url: str | None = None`: when set and `use_voice`, skip synthesis and send that URL directly (both whatsapp_cloud and Twilio voice branches)
- [ ] Branch in `ai_conversation.py` [complex]
  - [ ] After `_resolve_voice` decides a message goes as voice: if `campaign_account.get("voice_engine", "pipeline").startswith("live")` → call `live_voice_reply(...)` with the already-rendered system prompt, chat history, the inbound interaction's `media_path`, transcript, resolved voice + language
  - [ ] On success: send via `send_message(..., use_voice=True, audio_url=result["audio_url"])`; log the **transcript** as the outbound interaction Content (analysis layers unchanged)
  - [ ] On failure: log `ai_conversation.live_fallback` and continue through the existing pipeline path untouched
- [ ] Restart engine, end-to-end verify on a demo campaign (set campaign 61 `voice_engine='live_native'`, send a voice memo via the demo, confirm voice reply + transcript in inbox, then set it back)

### Technical Details

- The Live branch replaces only the *synthesis + wording* of voice messages. Multi-message splitting, `[voice]/[text]` smart tags, URL-as-text rule, and post-send analysis all still run off text: for a Live turn, the model produces ONE voice memo (matches prompt 93's "one flowing message" rule) — bypass the multi-bubble splitter for that turn.
- History source: `get_interactions_for_lead` already feeds the prompt builder; map the same rows to `[{"role": "user"|"model", "text": Content}]`, stripping the `[Voice Note]:` prefix.
- The rendered system prompt already exists in scope (built for the pipeline call) — reuse it, do not re-render.
- Fallback ordering: Live fails → the normal pipeline call happens exactly as today (the chat-model text was not yet generated at branch time, so nothing is wasted).
- `voice_engine` values: `pipeline` (default) | `live_native` | `live_half`. Resolve model from config per value.

## Phase 4: CRM settings UI

### Tasks
- [ ] `shared/schema.ts`: add `voiceEngine: text("voice_engine")` to the campaigns table
- [ ] Campaign settings panel: add a "Voice engine" select (Pipeline / Gemini Live — native / Gemini Live — half-cascade) in the same section as `voice_reply_mode`
- [ ] **Add `voice_engine` to `buildDraft()` in `useCampaignDetail.ts`** — settings fields not whitelisted there silently never save (documented gotcha)
- [ ] i18n keys in `client/src/locales/{en,nl}/campaigns.json` (label, three option labels, one-line hint that native sounds most human, half-cascade matches bump voices exactly)

### Technical Details

- Follow the existing `voice_reply_mode` select as the exact pattern (same component, same auto-save flow, 1.5s debounce — test clicks on real campaigns write immediately).
- Never run `tsc` after these edits (project rule); pm2 tsx watch hot-reloads the server, Vite the client.
