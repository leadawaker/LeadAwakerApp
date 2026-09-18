# Website Chat Widget — Implementation Plan

Spec: [requirements.md](./requirements.md). Written 2026-09-12 from three exploration passes
over `server/routes/demo.ts`, `src/webhooks/web_demo_routes.py`, `client/public/premium/demo/`
and `src/automations/inbound_handler.py`.

## The load-bearing insight

The demo chat surface is already the widget, minus packaging. The production-proven pattern is:

> a Leads row with **NULL phone**, `channel_identifier = '<surface>:<id>'` as the routing key,
> an early return in `send_message` that skips transport for that prefix, `Interactions` as the
> message bus, and the browser polling `GET state`.

`tools/send_service.py:285` already does this for `web-demo:` and the comment there says the
early return must precede every real branch "because a web-demo lead has no phone and any
transport would either crash or, worse, message someone else's number". The widget adds a
second prefix, `web:`, and reuses everything else.

The second insight: **an iframe gives us CSS isolation for free**, so the existing
`demo.css` global reset and `chat.js` renderer can be reused verbatim inside the frame
instead of rewritten with scoped styles.

## Architecture

```
client's website
  └─ <script src="https://api.leadawaker.com/widget/v1.js" data-key="wk_live_xxx">
       └─ launcher bubble (shadow DOM, ~4KB, no deps)
            └─ <iframe src="https://api.leadawaker.com/widget/frame?key=wk_live_xxx">
                 └─ our chat UI (reuses premium/demo chat.js, format.js, icons.js, copy.js)
                      └─ POST /api/widget/:key/message   ──┐
                      └─ GET  /api/widget/:key  (poll)     │ Express resolves the key,
                                                           │ then proxies to the engine
                 engine /widget/* ◄────────────────────────┘
                      └─ lead (NULL phone, channel_identifier='web:<visitorId>')
                      └─ process_inbound → AI → Interactions → poll picks it up
```

Everything is served from **one origin** (the API host), so the widget needs no CORS at all:
the loader is a cross-origin `<script>` (always allowed) and every fetch happens inside the
iframe, which is same-origin with the API. The only cross-origin control needed is
`frame-ancestors`, which today is globally `'self'` (`server/index.ts:56-60`) and must be
relaxed per key.

## Phases

### Phase 1 — Data model
- [ ] `widget_configs` table in `shared/schema.ts`: account, campaign, `public_key` (unique),
      enabled, allowed domains (jsonb string[]), greeting, accent colour, launcher position,
      agent name, avatar, language, `max_turns_per_visitor`, `max_messages_per_day`,
      `messages_today` + `messages_day` (rolling daily cap), timestamps.
- [ ] `accounts.inbound_campaign_id` — the campaign that answers WhatsApp strangers (phase 6).
      Explicit per account, mirroring `missed_call_campaign_id`. Never guessed.
- [ ] `niche_vocabulary.website_url` / `screenshot_path` / `screenshot_at` for the demo backdrop.
- [ ] Apply with a direct `pg` script (`db:push` needs a TTY on this box).

### Phase 2 — Server: key resolution, guards, proxy (`server/routes/widget.ts`)
- [ ] `GET /widget/v1.js` — the loader, cached, no auth.
- [ ] `GET /widget/frame?key=` — the chat document. Sets
      `Content-Security-Policy: frame-ancestors <allowed domains>` for that key, injects the
      key's public config, and refuses (403 page) when the key is disabled or unknown.
- [ ] `ALL /api/widget/:key/:suffix?` — suffix allowlist `["", "message", "voice", "audio"]`,
      GET/POST only, mirroring the hardened demo proxy at `server/routes/demo.ts:963`.
      Resolves the key to account + campaign + caps and passes them to the engine as
      pre-resolved ids, so the engine never reads widget config itself.
- [ ] Guards: `Origin`/`Referer` against the allowlist, per-IP rate limit on first contact
      (reusing the `checkRateLimit` shape from `server/demo-session.ts:897`), per-visitor turn
      cap, per-key daily message cap, 2000-char message cap, 1.5MB voice cap.
- [ ] Register in `server/routes/index.ts`.

### Phase 3 — Engine: the `web:` surface (`src/webhooks/widget_routes.py`)
- [ ] Router `/widget`, modelled on `web_demo_routes.py` but without token TTL, restarts,
      bumps, recap or invite logic: `GET /widget/{visitor}` (state), `POST /widget/{visitor}/message`,
      `GET /widget/{visitor}/audio`.
- [ ] Lead creation on first message: `insert_intake_lead(account_id, channel_identifier='web:<id>',
      campaign_id=…, source='Website Chat')` under `pg_advisory_xact_lock`, the same serialization
      `web_demo_routes.py:239` uses because `channel_identifier` has no unique index.
      `automation_status='active'` (NOT `queued`: the campaign launcher must never cold-open it).
- [ ] Queue the turn through `process_inbound` with `resolved_lead_id/campaign_id/account_id`,
      exactly as the demo does.
- [ ] `tools/send_service.py`: extend the no-transport early return to `web:` alongside `web-demo:`.
- [ ] Mount in `src/main.py`.

### Phase 4 — The widget client (`client/public/widget/`)
- [ ] `v1.js` loader: shadow-DOM launcher bubble, open/close, unread dot, mobile full-screen,
      `postMessage` handshake for height + close, `localStorage` visitor id, honours
      `prefers-reduced-motion`. No dependencies, no host-page CSS leakage.
- [ ] `frame.html` + `widget.js`: the chat, importing `/premium/demo/{chat,format,icons,copy,voice}.js`
      and `demo.css`, plus a small `widget.css` for the compact frame and per-key accent colour
      (`--d-accent` is the single seam, `demo.css:8-24`).
- [ ] Excluded by construction: `admin.js`, `recap.js`, `tracker.js`, `confetti.js`, restart,
      bump, the demo's WhatsApp handoff line and the Lead Awaker header branding.
- [ ] Poll cadence copied from the demo: 1600ms pending, 6000ms idle.

### Phase 5 — The prospect demo (screenshot backdrop)
- [ ] `script/site-shot.cjs`: headless capture, proven tonight on the Pi. Cookie banners via a
      ranked accept-then-dismiss text match across frames, lazy-load scroll, `ignoreHTTPSErrors`,
      1280x800 viewport clipped to two screens, PNG → `cwebp` → WebP in `uploads/site-shots/`.
      Run out-of-process, concurrency 1, because this box also runs the app.
- [ ] `POST /api/site-shot` (agency-only) to capture/refresh; `GET /api/site-shot/:file` to serve.
- [ ] `/widget-demo/:token` page: the screenshot in browser chrome, non-interactive, with the
      widget live on top. The frame accepts `token=` (demo session) as well as `key=` (client),
      so the demo reuses the existing demo caps and persona with no second code path.
- [ ] Capture automatically when a demo client is created from a website URL.
- [ ] Demos page: show the screenshot as the row thumbnail.

### Phase 6 — WhatsApp first-time senders
- [ ] `src/webhooks/twilio_routes.py`: pass the account already resolved for signature
      validation (`get_account_by_twilio_sid`) into `process_inbound` as `resolved_account_id`,
      with a fallback lookup of the receiving number against `accounts.twilio_default_from_number`.
      Today that resolved account is computed and thrown away.
- [ ] `src/automations/inbound_handler.py:133`: when no lead matches and the resolved account has
      `inbound_campaign_id`, create the lead (`insert_intake_lead`, `source='inbound_whatsapp'`,
      `automation_status='active'`, counts 0, `manual_takeover=false`) and continue the pipeline.
      With no designated campaign, keep today's drop.
- [ ] Name the lead from the WhatsApp `ProfileName` when present, else the formatted number.
      Never "Unknown" (the AI Receptionist naming rule).

### Phase 7 — Client setup UI
- [ ] `WebsiteChatCard.tsx` in `features/accounts/components/workspace/`, beside the messaging
      cards: campaign picker, domains, greeting, accent colour, enable toggle, live preview,
      copy-snippet button, plus the inbound-campaign picker from phase 6.
- [ ] CRUD routes under the existing accounts/messaging surface.
- [ ] i18n in `accounts.json` for en/nl/pt. No hardcoded strings.

### Phase 8 — Verify and hand over
- [ ] Widget on a local page that is not the app, end to end, with a real AI reply.
- [ ] The conversation appears in the CRM as a lead + interactions.
- [ ] A key restricted to one domain refuses another.
- [ ] Demo page renders a real homepage with a working widget.
- [ ] Regression: `/demo/<token>` unchanged.
- [ ] `action-required.md` for the decisions left to Gabriel.

## Deliberate non-changes

- `/solar` keeps the LeadConnector widget. Swapping it is a production marketing change and
  belongs to Gabriel, not to an unattended session. The snippet will be ready.
- No push to `main`. Vercel auto-deploys from it.
- `resolve_channel` is untouched. The web surface is decided by the `channel_identifier`
  prefix, before channel resolution, exactly as the demo surface is.
