# HeyGen API notes (checked 2026-10-17)

Account: Augusto's (Pro plan, ~883 web credits). API key in `/home/gabriel/Video/.env` (`HeyGen=`).

## Billing
- `GET /v3/users/me` returns `billing_type: wallet`, `remaining_balance: 0.0`. **The API key bills a separate prepaid USD wallet, not the web plan credits.**
- Top up from $5 at platform.heygen.com. Credits expire after 12 months.
- Rough API price: Avatar IV photo avatar ~$3/min (third-party figure, official rate card not verified).
- Web credits only reach the API via OAuth (HeyGen MCP or `heygen auth login --oauth`), which HeyGen calls "trial-scale". Not tested.
- In the web app, Avatar IV photo look = 16 credits/min, so 883 credits is ~55 one-minute videos.

## Avatar
- Photo avatar group "Augusto Fronza", 7 looks. No custom voice in HeyGen (voice lives in ElevenLabs).

## v3 endpoints (v2 is legacy, removed 2026-10-31)
- `GET /v3/avatars/looks` and `/v3/avatars/looks/{id}`: check `supported_api_engines`.
- `POST /v3/assets`: upload MP3/WAV (max 32 MB), returns asset id.
- `POST /v3/videos`: `type: "avatar"`, `avatar_id`, `audio_asset_id`, `engine: "avatar_iv"`, `aspect_ratio: "9:16"`, `resolution: "1080p"`, optional `caption`, `motion_prompt`, `expressiveness`, `callback_url`.
- `GET /v3/videos/{id}`: `video_url`, `captioned_video_url`, `subtitle_url` (presigned, expire).
- Concurrency 3 on Pro, 10 on API pay-as-you-go.

## Pipeline we plan to use
1. Script with v4 tags (this project).
2. ElevenLabs `eleven_v4` with Augusto's clone, MP3 out.
3. Upload MP3 to HeyGen, render photo avatar with Avatar IV, 9:16, captions.
4. Download MP4.

HeyGen's own ElevenLabs integration documents only `<break>`, not audio tags, so we generate the audio ourselves.

Docs: https://developers.heygen.com/llms.txt
