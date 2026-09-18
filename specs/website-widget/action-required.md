# Website Widget — Action Required

Built autonomously overnight 2026-09-12/13. Everything below is live on the Pi
(`app.leadawaker.com`) and committed, but **nothing is pushed to `main`**, so
leadawaker.com (Vercel) is untouched.

## Decisions left to you

### 1. Replace LeadConnector on /solar (one line, your call)
The GoHighLevel widget still owns the corner on the live landing page. Ours is
ready. When you want to swap it, in `client/public/premium/index.html:138-151`
replace the LeadConnector block with:

```html
<script src="https://api.leadawaker.com/widget/v1.js" data-key="YOUR_KEY" async></script>
```

First mint the key: Accounts → Lead Awaker → Integrations → Website chat →
Create widget, then set **allowed domains** to `leadawaker.com, www.leadawaker.com`
and pick the campaign that should answer. `contact-button.jsx` is the placeholder
component that was always meant to be replaced by this; it can then go.

I did not do this because it is a production marketing change on your live site.

### 2. Turn on WhatsApp first-time senders (per account)
A stranger texting a client's number is still dropped, exactly as before, until
you pick a campaign in **Integrations → WhatsApp from new contacts**. I set this
on account 1 while testing and then **reset it to empty**, so nothing is live.

Before enabling it on a real client, know what it means: anyone who texts that
number gets an AI reply and becomes a lead on that campaign.

### 3. The widget demo lives on the Pi, not Vercel
`/widget-demo/<token>` is server-rendered (it needs the demo session to know
which screenshot to show), so the link to send a prospect is
`https://app.leadawaker.com/widget-demo/<token>`. The existing `/demo/<token>`
page is unaffected and still served statically from Vercel.

If you want the widget demo on leadawaker.com too, that needs a `vercel.json`
rewrite to the API host. Small job, deliberately not done unattended.

## What is live and verified

| Thing | Where | Verified |
|---|---|---|
| Loader + launcher bubble | `GET /widget/v1.js` | Shadow DOM on a third-party page, no host CSS leakage |
| Chat frame | `GET /widget/frame?key=` | Per-key `frame-ancestors`, X-Frame-Options dropped |
| Conversation proxy | `/api/widget/:key/*` | Real AI reply in ~3s, lead created with NULL phone |
| Engine surface | `src/webhooks/widget_routes.py` | Lead on first message, greeting recorded, `web:` prefix |
| Guards | same | Foreign domain 403, bad visitor 400, oversize 413, unknown suffix 404, daily cap counted |
| Screenshots | `script/site-shot.cjs` | zonneplan.nl (cookie banner dismissed), dakmeesters.nl, 40-100KB WebP |
| Widget demo page | `/widget-demo/:token` | Real homepage backdrop + live Dutch AI reply |
| Demos-page thumbnails | Demos → Site column | Real image, lazy loaded |
| Setup card | Accounts → Integrations | Key minted, domains persisted, live preview renders |
| Inbound campaign picker | same | PATCH 200, persisted across reload |
| Regression | `/demo/<token>` | Unchanged: tracker, composer, same transcript |

## Test artefacts you may want to delete

- Demo session token `widgetdemotest01` ("Dakmeesters", campaign 68) — a working
  example of the widget demo. Open `/widget-demo/widgetdemotest01` to see it.
  The persona is invented; the screenshot is the real dakmeesters.nl homepage.
- Leads with `channel_identifier LIKE 'web:%'` on campaign 68 are my test chats.
- `uploads/site-shots/*.webp` — two captures. Gitignored.
- All widget keys I created have been deleted.

## Known gaps (deliberate, not bugs)

- **Voice memos in the widget**: the engine endpoint exists and works; the frame
  ships text-only. Turning it on is a composer change, not a backend one.
- **No "continue on WhatsApp" button yet.** The AI can ask for a phone number,
  but the handoff link is not built. This is the highest-value next addition:
  it is what keeps a widget conversation alive after the tab closes.
- **Screenshots are desktop-only** (1280x800 clipped to two screens). A phone
  backdrop would need a second capture.
- **The avatar in the thread** uses the demo page's `/avatars/images.jpeg`. Fine
  on our host; give clients their own before the widget goes on many sites.
- **Daily cap is per key**, not per visitor per day. A visitor turn cap exists
  separately (30 by default).
