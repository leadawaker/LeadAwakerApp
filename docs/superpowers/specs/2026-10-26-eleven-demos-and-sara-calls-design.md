# ElevenLabs demos, voice pickers and Sara calls

Date: 2026-10-26. Branch `feat/eleven-demo-calls` in both repos (CRM = /home/gabriel/LeadAwakerApp, ENG = /home/gabriel/automations).

## Why

Gabriel demos the AI receptionist to prospects (Dutch, UK, US, Brazilian). GPT-Live sounds poor in Dutch; ElevenLabs is much better and is what his only client (Robben) hears. He wants every demo on one engine (ElevenLabs), a switch back to GPT-Live, proper voices per language, and two ways to demo by phone: Sara calls the prospect, or Gabriel calls the prospect and brings Sara in.

## Decisions (made by Gabriel or defaulted overnight, flagged with *)

- Engine switch: one for minted demos (Demo_Settings `voice.demoEngine`), one for the homepage public demo (Demo_Settings `public_demo.voiceEngine`). Values `"elevenlabs" | "gpt-live"`. Missing = `"elevenlabs"`.
- ElevenLabs demo locales: `nl`, `en-GB`, `en-US`, `pt-BR`. `pt-PT` uses the pt-BR voices.
- Voices (already added to the ElevenLabs account 2026-10-26):
  - nl male: Vincent `49dczJmfGX7RoeudoOPi` (default), Thijs (Customer Care) `Fs2nBbDlyMuvoYRAvGXB`, Thomas `tvFp0BgJPrEXGoDhDIA4`, Thijmen `I24feWrdk6aykmpq7IQ9`, Marcèles `fzC7H9Y1bPn3gzVLtghe`
  - nl female: Jasmijn `PWSsuWP2rj5xoCLT1qsQ` (default*), Joyce `5sOQIpQbG4XwqbEbuGNB`, Mette `L8qZJEV989Y3D0xnaVCa`, Mia `qpYcCnnbKrqp5HBM19ou`
  - en-GB male: Archer (Conversational) `Fahco4VZzobUeiPqni1S` (default), Ash `7DPK3BeItL9bXzJuCOEn`, Archer `L0Dsvb3SLTyegXwtm47J`, Alexander `mZ8K1MPRiT5wDQaasg3i`
  - en-GB female: Charlotte `6fZce9LFNG3iEITDfqZZ` (default), Shelby `rfkTsdZrVWEVhDycUYn9`, Jodi `FF59babHL8N8gfTgtBMT`, Clara `0ggs85h7hrWz8ExXnsBc`
  - en-US female: Alexandra `kdmDKE6EkgrWrrykO9Qt` (default), Cassidy `56AoDkrOh6qfVPDXZ7Pt`
  - en-US male: Mark (Natural) `UgBBYS2sOqTuMpoF3BR0` (default), Mark (Casual) `1SM7GgM6IMuvQlz2BwM3`, Brian `Gubgw9l4dtIoQA9YZHgx`
  - pt-BR male: Kaique `Hmn4B9B77pf6ttydteJ8` (default), Muhammad `MjS9ecoVZlOFzvnemirW`, Sávio `blPx0tvsvee8CuFd63lX`, Caetano `j9PnwdnroKT9pucVv8tl`
  - pt-BR female: Roberta `RGymW84CSmfVugnA5tvA` (default), Raquel `GDzHdQOi6jjf8zaXhCYD`
  - The other 20 Dutch voices stay on the account (slots were not a problem) but leave the catalog. Lines whose stored voice is no longer in the catalog fall back by gender, as today.
- Demo default voice per locale: Demo_Settings `voice.elevenVoices[locale]`; if unset, the female default of that locale (agent persona names are female by default).
- Per-demo voice: chosen in the +New Demo form, stored in the persona (`leads.demo_niche`) as `voice` and `voice_locale`.
- Outbound caller ID: `VOICE_PHONE_DEMO_NUMBER` (+31738519847). A UK/BR number can be added later.
- Gabriel's phones for bridge calls: primary `+31684446349`, backup `+31737044356`, chosen in settings (`voice.ownerPhone`, `voice.ownerPhoneBackup`, `voice.ownerPhoneUse: "primary"|"backup"`).
- *ElevenLabs agent auth stays off tonight: the design doc's open question (does it break inbound SIP?) is untested and the test line must keep working. Flagged for Gabriel.

## Engine (ENG) contract

### Voice catalog
`src/automations/voice/eleven_voices.py` gets a per-locale catalog `LOCALE_VOICES: dict[str, dict[str, tuple[label, gender]]]` and `LOCALE_DEFAULTS: dict[str, dict[gender, voice_id]]` from the list above. `ELEVEN_VOICES` becomes the union (so `gender()`/`pick()`/`for_line()` keep working; the nl defaults used by `DEFAULT_VOICE` must stay valid ids in the union). A helper `demo_voice(locale, chosen) -> voice_id` returns `chosen` if it is in that locale's list, else the settings default for the locale, else the locale's female default.

### Public endpoints (no internal key; token-gated)
1. `GET /voice/demo-context?token=` additionally returns `engine` (resolved: public token → `public_demo.voiceEngine`, else `voice.demoEngine`; default `"elevenlabs"`) and `voice` (persona `voice` or null).
2. `GET /voice/eleven/demo/options` → `{locales: [{id, label}], voices: {<locale>: [{id, label, gender, preview_url|null}]}, defaults: {<locale>: voice_id}}`. `defaults` already applies the settings overrides.
3. `POST /voice/eleven/demo/session` body `{token, password?, admin_pass?, locale, voice?, caller_number?, timezone?}`.
   - 404 unknown token; 401 bad password (minted demos: same rule as `/voice/live/session`: `valid_voice_password` or a valid admin pass; public demos need no password); 429 rate limit (`check_voice_rate_limit`) or public limits (`public_demo_voice.reserve`); 409 too many concurrent ElevenLabs demo sessions (cap 3, separate from the staff browser-test cap); 503 ElevenLabs not configured.
   - Builds the call like the staff browser session but from the demo persona (company, agent, business, kb rows, locale, voice), no client line, demo diary, marked as a demo call (not a test call of a client line), never notifying any client.
   - 200 → `{conversation_token, conversation_id, call_id, session_key, overrides, agent_name, max_seconds}`. `overrides` is the SDK shape used by the staff test (`{agent:{prompt:{prompt},firstMessage,language},tts:{voiceId}}`). `max_seconds`: public → from `reserve`; minted → `voice.maxCallMinutes`*60, default 600.
4. `POST /voice/eleven/demo/session/{call_id}/started` and `/release`, body `{session_key}` (403 on a wrong key). Same semantics as the staff test routes (started arms the time limit; release frees an unstarted slot and a public reservation).

### Demo calls by phone (X-Internal-Key, called only by the CRM relay)
- `POST /voice/demo-calls` body `{token, to_number (E.164), mode: "sara"|"bridge", owner_number? (bridge only, E.164), locale?, voice?}` → `201 {id, ...status}`. 400 bad number / missing owner number in bridge mode; 404 unknown token; 409 another demo call is active (cap 1); 503 Telnyx or ElevenLabs not configured.
- `GET /voice/demo-calls/{id}` → `{id, mode, status: "dialing_owner"|"dialing_prospect"|"live"|"ended"|"failed", legs: {owner, prospect, ai}: "idle"|"dialing"|"answered"|"ended"|"failed"|"busy"|"no_answer"|"voicemail", sara_in: bool, error: str|null, started_at, ended_at}`.
- `POST /voice/demo-calls/{id}/sara` body `{action: "join"|"leave"}` (bridge mode; 409 if the prospect leg is not answered yet).
- `POST /voice/demo-calls/{id}/end` hangs up every leg.
- Mode `sara`: Telnyx dials the prospect from the demo number (answering-machine detection on: a machine ends the call with leg status `voicemail`). On answer: dial the ElevenLabs SIP leg (same `eleven_leg` mechanism as inbound), conference prospect + AI. Sara opens with an outbound first message (below).
- Mode `bridge`: dial the owner first. On owner answer: create the conference with the owner, then dial the prospect from the demo number. On prospect answer: join. `sara join` dials the AI leg into the conference with the bridge first message; `leave` hangs up the AI leg only.
- Any time the prospect leg ends, end the call. In bridge mode the owner leg ending ends the call too. Hard cap 20 minutes.
- The AI leg's init (`/voice/eleven/init`) must resolve to the demo persona of `token` (carried on the in-memory bridge/demo-call state, e.g. via the `X-Bridge-Id` header), NOT to the line wired to +31738519847 (Robben). Caller number for the call record = the prospect's number. No client notifications, no client-line booking.
- First messages (copy per language nl/en/pt; adapt to the agent name and company):
  - `sara` (outbound): nl "Hoi, met {agent}, de AI-receptionist die Lead Awaker voor {company} heeft gemaakt. Je kunt me alles vragen wat een klant zou vragen. Waarmee kan ik je helpen?" (en/pt equivalents)
  - `bridge` join: nl "Hoi, {agent} hier, de receptioniste van {company}. Waarmee kan ik helpen?" (en/pt equivalents)
- Webhooks for these legs arrive on the same Telnyx app webhook (`/voice/phone/telnyx`); route them by a new `client_state` role so the inbound bridge logic is untouched.

## CRM contract

- `PUT /api/demo-settings/voice` zod schema accepts `demoEngine`, `elevenVoices` (record locale → voice id), `ownerPhone`, `ownerPhoneBackup` (E.164 via `forgetE164`), `ownerPhoneUse`.
- Public demo settings accept `voiceEngine`.
- `POST /api/demo/create-link` accepts optional `voice` (string ≤ 40) and `voiceLocale` (`nl|en-GB|en-US|pt-BR`), stored in the persona blob as `voice` and `voice_locale`.
- New relay `server/routes/voiceDemoCalls.ts` (requireAgency), pattern of `voiceElevenTest.ts`: `POST /api/voice/demo-calls` (adds `owner_number` from settings in bridge mode), `GET /api/voice/demo-calls/:id`, `POST /api/voice/demo-calls/:id/sara`, `POST /api/voice/demo-calls/:id/end`.
- Demos > Settings > Voice tile: engine switch for minted demos; ElevenLabs default voice per locale (with preview play); owner phones + which one to use. Public demo tile: engine switch for the homepage.
- +New Demo form: voice picker for the demo's locale (language + market → `nl`, `en-GB` (uk or nl market), `en-US` (us), `pt-BR`), listing ElevenLabs or GPT-Live voices depending on `demoEngine`; empty = settings default.
- `/voice-demo`: if demo-context says `engine === "elevenlabs"`, run the call through a new `useElevenDemoCall` hook (same return shape as `useLiveCall` so PhonePanel/TranscriptPanel/CrmPanel stay) and list ElevenLabs voices in the voice picker. Missing `engine` (old engine) = GPT-Live.
- Demo phone calls UI (`DemoCallControls`): on the minted voice demo row (ProspectDemoPanel after minting, and the voice ServiceCell in the sessions table). Phone field (prefilled with the lead's phone when known), buttons "Sara calls now" and "Call me + prospect", live status of each leg (polling every 1.5 s while active), "Bring Sara in" / "Take Sara out", "End call". All text in demos.json (en/nl/pt).

## Out of scope (later)

Caller-ID matching on Sara's inbound number, unknown-caller receptionist flow, the test line dashboard, UK/BR numbers, ElevenLabs cost in the public demo daily budget (it counts sessions and minutes, not ElevenLabs cost), "stay in the caller's language" prompt rule.
