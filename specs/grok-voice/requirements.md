# Grok voice as a second phone engine

Built 2026-10-19. Goal: test xAI's Grok voice (grok-voice-3.0) and OpenAI GPT-Live side by side on the same phone line, with different voices and prompts, without changing what real callers hear.

## How a call picks its engine

- The conference bridge (`automations/src/automations/voice/telnyx_bridge.py`) decides per call, before it dials the AI leg (`voice_engines.choose`).
- **Testers:** Demos page > Settings > Voice > **Engine tests** (`Demo_Settings` voice row, `engineTests`). Each tester phone number picks:
  - the engine (GPT-Live or Grok)
  - the voice (that engine's own ids; empty keeps the line's voice)
  - the prompt (Grok only): "Same as GPT-Live" or "Lean (xAI style)"
  - reasoning (Grok only): on (xAI default) or off
- **Lines:** `XAI_VOICE_LINES` in the engine `.env` puts every caller of a number on Grok (for a number set aside for it).
- Everyone else keeps GPT-Live. Grok is only dialed when xAI is set up for the dialed number (`XAI_VOICE_NUMBERS` and the rest of the xAI settings). Otherwise the call stays on GPT-Live and the engine logs `voice.engine.xai_unavailable`.
- A tester's calls are marked `is_test`, which keeps them out of the client's figures and recaps.
- Only conference-route lines can switch. Today that is `+31738519847`, lent to Robben. A number on the direct FQDN connection goes straight to OpenAI.

## The call

- The bridge dials `sip:<our number>@sip.voice.x.ai;transport=tls` with a SIP digest login. xAI then posts `realtime.call.incoming` to `POST /voice/xai/incoming` (Standard Webhooks signature).
- Setup is the same as on GPT-Live's door (`phone_voice_routes._start_call`, engine "xai"): routing, persona, caller memory, real Cal.diy diary, screened transfer, recording notice, office sound.
- `xai_call.XaiCall` subclasses `PhoneCall` and speaks xAI's Realtime events on `wss://api.x.ai/v1/realtime?call_id=`.
- Greeting, turns, tools, silence check-ins, transfer and wrap-up are PhoneCall's own. Mid-call notes go in as the next reply's instructions.
- Our call id is `xai_<call_id>`. Cost is priced at $0.08/min (`call_costs.LIVE_PER_MIN`).
- Telnyx records the Grok leg (xAI keeps nothing). `Voice_Calls.recording_ref` stores the recording, and the Voice Calls player plays it.

## The prompt

GPT-Live is two models (a voice layer, and a backend with the tools); Grok is one. `xai_session.build_xai_session` makes Grok's session from the GPT-Live session the door already built:

- **Same as GPT-Live** (`standard`):
  - the exact voice layer the GPT-Live call gets (Prompt_Library 117 for nl)
  - one line on top saying "the backend" is her own tools
  - a tools section in the call's language (`xai_copy.py`) and the client's settings
  - the full stock list (fuel, power, lease) the backend used to hold
- **Lean** (`voice_xai_layer_{locale}`, Prompt_Library rows 126-129, code copy `xai_prompts.py`): written to xAI's prompting guide.
  - Fixed `##` sections: role, objective, flow, guardrails, voice and style. The headings are in the call's language.
  - Much shorter, without GPT-Live workaround lines.
  - Pronunciation goes through xAI's `replace` map instead of a sentence.
  - The Den Bosch line is kept word for word.
  - Editable in the prompt editor, with a preview of what Grok hears.
- Tool descriptions and tool-result details reach the speaking model, so they are in the call's language (nl, pt-BR; en as is).

## Open, to settle on the first real calls

- Whether xAI takes TLS without SRTP. If the AI leg fails, set `XAI_SIP_MEDIA_ENCRYPTION=SRTP`, or `XAI_SIP_TRANSPORT=TCP`.
- Whether xAI passes our X- headers. If not, `voice.xai.bridge_matched` shows the fallback was used.
- How the socket ends when the caller hangs up (`voice.xai.bridge_gone` covers it).
- Dutch speech recognition: `language_hint` "nl" is not on xAI's list.
- The genders of xAI's newer voices: `scripts/xai_register_number.py --voices` reads them once the key is set.
