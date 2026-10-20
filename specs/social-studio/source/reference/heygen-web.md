# HeyGen web app workflow (checked 2026-10-17)

We use the web app with plan credits, not the API (API wallet is too expensive).

## Voice inside HeyGen
- HeyGen's ElevenLabs engine offers **V2 and V3 only, not v4**. Pick V3 under "Advanced: Voice Engine Selection" (better for Portuguese, supports tags).
- V3 tags work in HeyGen ("voice tags"). A tag tends to last until the next tag, so keep them rare. Some users report tags being ignored or showing up in captions: check captions after render.
- Pauses: type `/` then Add Pause. Commas = short break, periods = longer.
- Pronunciation: double-click a word, then Pronunciation (use for Mounjaro if needed).
- Voice Director (`/`): tone presets, documented for HeyGen voices, unclear for ElevenLabs.

## Alternative: v4 audio from ElevenLabs
- Generate in the ElevenLabs web app with `eleven_v4`, download MP3, upload it in the Avatar IV **Photo to Video** flow (lip-syncs your file).
- Do NOT use AI Studio's "Mirror Voice" upload: it re-speaks the line in the assigned voice.
- Downside: one continuous take, no per-scene look changes (unless edited together afterwards).

## Engine choice
- **Avatar IV**: works with photo avatars, ~16 credits/min. Our default.
- **Avatar V**: ~48 credits/min (3x), and per HeyGen's help center it does not support photo avatars (needs a video-recorded digital twin). If the editor offers it for his look anyway, test one video before switching.

## One shot vs scenes
- Default: paste the whole script into ONE scene, no custom motion prompt. Avatar IV generates its own natural movement for the full clip (up to ~180s), and it matches his real videos, which are single takes.
- The ~10s limit only applies to custom motion prompts (and they bill 2:1). Only split into scenes (alternating looks, one gesture prompt each) if the one-shot result looks stiff or repetitive.
- Expressiveness: Normal to start. Quality mode = 2x credits.
- Cost: ~16 credits/min for a photo look (custom motion bills 2:1). 883 credits is roughly 25 to 55 videos depending on settings.
- Captions: Subtitle panel, check pt-BR accuracy.

## Skills
- heygen-com/skills (official, GitHub): heygen-avatar, heygen-video, heygen-translate. Runs via API or HeyGen MCP over OAuth (plan credits, "trial-scale", untested). Thin on scripting.
