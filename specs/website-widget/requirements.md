# Website Chat Widget — Requirements

**Status:** spec written 2026-09-12. Build in progress, autonomous session.
**Owner:** Gabriel. **Related:** [specs/speed-to-lead](../speed-to-lead/), [specs/ai-receptionist](../ai-receptionist/), `project_speed_to_lead_demo_and_site_scrape_2026_09_01`.

## Why

The inbound AI ("AI secretary") is built and proven on WhatsApp and on the demo surface.
The missing channel is the client's own website: a visitor lands, has a question, and
leaves. A widget captures that conversation with the same engine, the same booking, the
same handoff and the same CRM inbox as every other service.

Two audiences, one build:

1. **Lead Awaker itself.** Replace the rented GoHighLevel LeadConnector widget on
   `leadawaker.com/solar` with our own. Dogfood first, drop a dependency.
2. **Clients.** One snippet pasted into their site. Setup lives next to WhatsApp number
   setup in the account workspace, not in a new page.

And a sales surface that falls out of the same code:

3. **The widget demo.** A prospect sees *their own homepage* as a screenshot with our
   widget live on top, answering questions about their business.

## What exists already (do not rebuild)

| Capability | Where |
|---|---|
| Browser chat surface: post-then-poll, voice memos, typing, bubbles | `client/public/premium/demo/` (vanilla ES modules, no framework) |
| Engine web surface: lazy lead creation, opener, state, audio | `src/webhooks/web_demo_routes.py` |
| NULL-phone lead + `<surface>:<id>` in `channel_identifier` as routing key | `server/demo-session.ts:967`, `web_demo_routes.py:213` |
| No-transport send for web leads | `tools/send_service.py:275-294` |
| Inbound AI turn, debounce, handoff, manual takeover | `src/automations/inbound_handler.py` |
| Business knowledge from a URL | `tools/site_kb.py`, `POST /api/demo/clients/from-website` |
| Booking, reminders, no-show recovery | Cal.diy bridge, per account |

## Functional requirements

### A. The widget (client-facing)

- **A1.** A client pastes one `<script>` tag. No CSS, no markup, no framework assumptions.
- **A2.** The script renders a launcher bubble in a page corner and, on click, opens our
  chat in an **iframe**. The host page's CSS must not affect the widget and the widget's
  CSS must not affect the host page. (`demo.css` starts with a global `*` reset, so
  inlining the existing UI into the host document is not an option.)
- **A3.** The widget is keyed by a **public widget key** that maps to one account + one
  campaign. The key is public by design; security comes from domain allowlisting, not secrecy.
- **A4.** Per-key configuration: greeting line, accent colour, launcher position,
  agent display name, avatar, language, allowed domains, enabled flag.
- **A5.** First visitor message creates a Lead: NULL phone, `Source = 'Website Chat'`,
  `channel_identifier = 'web:<visitorId>'`, on the key's account + campaign. The visitor id
  is generated client-side and kept in `localStorage`, so a returning visitor keeps their thread.
- **A6.** The AI answers with the campaign's prompt and knowledge base, books via the
  account's calendar, and hands off to a human exactly as on WhatsApp.
- **A7.** Contact capture: the AI asks for a name and a phone/email when the conversation
  warrants it, and offers **"continue on WhatsApp"** so follow-ups survive the tab closing.
  Prompt-level behaviour, no new code path.
- **A8.** Threads appear in the CRM inbox like any other lead conversation, including
  owner take-over.

### B. Abuse and cost control (public endpoint, real money per turn)

- **B1.** Domain allowlist per key, enforced server-side on the iframe document
  (`Content-Security-Policy: frame-ancestors`) and checked against `Origin`/`Referer` on
  session creation. Today a global `frame-ancestors 'self'` blocks all embedding
  (`server/index.ts:56-60`); the widget path must be exempted per key.
- **B2.** Per-visitor turn cap and per-key daily message cap, both configurable, both
  defaulting to something a leaked key cannot bankrupt.
- **B3.** Per-IP rate limit on session creation, reusing the shape of `checkRateLimit`
  in `server/demo-session.ts:897`.
- **B4.** Message length cap and a total payload cap, mirroring the demo's 2000 chars
  and 1.5MB voice ceiling.
- **B5.** A disabled key answers 403 and the widget renders nothing.

### C. The widget demo (prospect-facing)

- **C1.** Given a prospect's URL, capture a screenshot of their homepage, headless, once,
  at demo-creation time. Never on page view.
- **C2.** Dismiss cookie banners before capture (ranked accept-then-dismiss text match,
  across frames); scroll to trigger lazy images; tolerate broken certificates.
- **C3.** Store as WebP and serve from the API origin, because the demo page is static on
  Vercel while the capture happens on the Pi.
- **C4.** The demo page shows the screenshot as a non-interactive backdrop in a browser
  chrome frame, with the real widget live on top.
- **C5.** A "refresh screenshot" action for when the prospect redesigns.
- **C6.** The same image doubles as the row thumbnail on the Demos page.
- **C7.** These pages stay unlisted and private to a one-to-one demo. No public index.

### D. Client setup UI

- **D1.** A "Website chat" card in the account workspace, beside the WhatsApp/messaging
  cards, not a new page: campaign picker, domains, greeting, colour, enable toggle,
  live preview, and a copy-snippet button.
- **D2.** Editing a key takes effect without a redeploy of the client's site.

### E. WhatsApp first-time senders (the sibling gap)

- **E1.** An inbound WhatsApp message from a number matching no Lead currently dies at
  `inbound_handler.py:133`. It must instead create a Lead on the account's designated
  inbound campaign and let the AI answer.
- **E2.** Which campaign receives strangers is explicit per account, never guessed.
- **E3.** If no inbound campaign is designated, keep today's behaviour (log and drop).
  Silence is better than a wrong account answering.

## Non-goals

- Real-time transport (WebSocket/SSE). Polling is proven and good enough.
- Co-browsing, screen sharing, file upload from the visitor.
- A separate widget analytics dashboard. Existing CRM metrics cover it.
- Rendering the prospect's live site in an iframe for the demo. Blocked by their headers.
- Replacing LeadConnector on the live /solar page. That is a production marketing change
  and stays Gabriel's call (see action-required.md).

## Acceptance

- [ ] The widget loads on a page that is not ours, opens, and gets an AI reply.
- [ ] That conversation appears as a lead + interactions in the CRM.
- [ ] A key restricted to domain X refuses to run on domain Y.
- [ ] A prospect demo page shows their real homepage with a working widget on top.
- [ ] A stranger texting a client's WhatsApp number gets an AI reply and becomes a lead.
- [ ] Nothing about the existing /demo/<token> surface changes behaviour.
