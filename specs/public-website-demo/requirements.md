# Requirements: Public Website Demo ("Hear Sara answer for your business")

## What and why

Feedback from prospects: a demo built around *their own* business is a game changer. Today that only exists as an agency-only flow on the Demos page (`POST /api/demo/clients/from-website`). This feature puts a self-serve version on the landing page (leadawaker.com):

1. The visitor enters their website address.
2. They verify their phone number by sending a prefilled WhatsApp message to the demo number. This is free, cannot be faked, and gives us the lead.
3. Only after verification, Sara reads their website and becomes their receptionist.
4. They try her three ways: by voice in the browser (main option), in the same WhatsApp chat, or by calling the demo phone number (only from the verified number).
5. Sara recaps the conversation at the end of the voice demo and asks how they liked it. Gabriel is notified and gets a task to call them himself.

The system must be safe to expose publicly: spammers, bots and attackers must not be able to burn tokens, reach internal services, or make Gabriel's phone ring.

## Decisions already made (Gabriel, 2026-10-07)

- Phone verification comes first, before any paid work (scrape, persona generation, voice).
- Verification is done by the visitor sending a prefilled WhatsApp message (no SMS codes).
- Allowed countries: Netherlands (+31), United Kingdom (+44), Brazil (+55).
- The recap happens inside the voice demo itself (Sara summarises at the end of the call), not as a separate WhatsApp message.
- Follow-up: Sara asks for feedback at the end of the demo, and Gabriel calls the lead himself (notification + task).
- Browser voice is the main demo; the WhatsApp chat and the phone call are secondary.

## Acceptance criteria

### Landing page
- [ ] A new section on `client/public/site/index.html` (and the NL and PT pages) with a website field, a consent checkbox and a Cloudflare Turnstile check.
- [ ] After submitting, the page shows a WhatsApp button on mobile and a QR code plus button on desktop, both opening `wa.me` with the prefilled code message.
- [ ] The page detects verification automatically (polling) and moves on without a refresh.
- [ ] While Sara reads the site, the page shows a "Sara is reading {domain}" state. When ready it shows the company name she found and three actions: "Talk to her now" (browser voice, opens in a modal), "Chat on WhatsApp", "Or call her: {demo number}".
- [ ] Clear states for: number not allowed (country), limit reached, daily budget reached ("Book a demo instead" with the booking link), site could not be read.
- [ ] All copy in EN, NL and PT (Brazilian). Copy says "digital assistant", never "AI".

### Verification and gating
- [ ] No scrape, persona generation, or voice session runs for a request whose phone is not verified.
- [ ] Senders from countries other than +31, +44, +55 get one polite fixed message (no AI) and the request is marked `blocked_country`.
- [ ] One public demo per phone number per 30 days. A repeat request from the same phone reconnects to their existing demo instead of building a new one.
- [ ] One website build per domain per 30 days. Later requests for the same domain reuse the stored brief.
- [ ] Max 3 demo requests per IP per day (persistent, survives restarts).
- [ ] Global caps: max demos built per day, and a daily estimated-spend budget (default EUR 10). When either is hit, the landing section switches to "Book a demo instead" and Gabriel gets one notification.
- [ ] A kill switch (`publicDemo.enabled`) turns the whole feature off instantly, without a deploy.
- [ ] All limits live in `Demo_Settings` (service `public_demo`) and are editable without code changes.

### Security
- [ ] The website reader refuses private, loopback, link-local, multicast and reserved IPs (IPv4 and IPv6), IP-literal hosts, ports other than 80/443, and non-http(s) schemes. Every redirect hop is re-checked. DNS is resolved once and the checked IP is the one connected to.
- [ ] Downloads are capped (2 MB per page, HTML only, max 6 pages, 15 s per page). TLS verification stays on for public requests. The paid Firecrawl fallback is not used for public requests.
- [ ] Scraped text is passed to the summariser as clearly delimited data; the generated brief is length-capped and checked by the existing guardrails before it reaches Sara's prompt.
- [ ] In a public demo, Sara cannot transfer calls (`transfer_to_human` disabled), cannot send email, and books only into the isolated demo calendar, max 1 booking per demo.
- [ ] Voice sessions for public demos are limited server-side (max minutes per session and max sessions per demo), not only by the browser.
- [ ] Public demo LLM spend runs on a separate OpenAI project key with a hard monthly budget set in the OpenAI dashboard, so the worst case is bounded by OpenAI even if our limits fail.

### After the demo
- [ ] At the end of a public voice demo, Sara recaps what she understood and would log for the business, then asks how they liked it. Their answer is saved on the lead.
- [ ] When a public demo completes (voice ended, or WhatsApp chat idle for 30 min), Gabriel gets a notification ("New demo lead: call {name}, {company}") and a Task "Call {name} about their demo", due today, with the phone number, website, language and a link to the lead.
- [ ] Optional setting `feedbackMessage.enabled` (default off): if on, Sara sends one WhatsApp message 2 hours after the demo asking how they liked it, unless Gabriel has already marked the task done.
- [ ] Public demo leads are identifiable in the CRM (source `Public Website Demo`) and visible on the Demos page sessions table.

### Privacy
- [ ] The consent checkbox links to the privacy policy and states that we will contact them about the demo by WhatsApp or phone.
- [ ] Public demo requests that never verified are deleted after 7 days; unconverted demo data after 90 days.

## Related features and dependencies

- Demo client from website: `server/routes/demo.ts:245` (`/api/demo/clients/from-website`), `server/demoWebsiteClient.ts` (`buildClientFromSite`), engine `src/api/site_kb.py` and `tools/site_kb.py`.
- Demo tokens and pending leads: `server/demo-session.ts` (`generateToken`, `createPendingDemoLead`, `buildWhatsAppLink`, `checkRateLimit`).
- WhatsApp claim flow: engine `src/webhooks/whatsapp_cloud_routes.py` (`_extract_demo_token`, `_find_pending_demo_lead_by_token`, `_claim_demo_lead`), sticky sessions in `tools/db/leads.py`.
- Browser voice: `client/src/pages/voice-demo.tsx`, `client/src/features/voiceDemo/useLiveCall.ts`, engine `src/webhooks/live_voice_routes.py`, `src/automations/voice/rate_limit.py`.
- Phone door: engine `src/webhooks/phone_voice_routes.py` (`caller_number`, `find_demo_lead`), `src/automations/voice/phone_transfer.py`.
- Notifications: `server/notification-dispatcher.ts` (`createAndDispatchNotification`), template `server/demo-reply-notifier.ts`.
- Landing page pipeline: `script/import-site-artifact.py`, `script/build-site-nl.py`, artifact https://claude.ai/artifact/BK1Swsn85qmPvSnXaT1scG.
- Specs this builds on: `specs/demo-client-generator/`, `specs/demo-surface-split/`, `specs/voice-receptionist/`, `specs/phone-screened-transfer/`.

## Out of scope (v1)

- SMS or email verification for visitors without WhatsApp.
- Showing the visitor's own logo or a screenshot of their site (the screenshot and logo fetchers are skipped for public requests, they would need the same SSRF hardening).
- Outbound calls from Sara to the visitor.
- Languages other than EN, NL, PT.
