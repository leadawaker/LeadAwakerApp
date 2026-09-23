# Review Demo (Reputation service) : Requirements

Status: design approved in chat 2026-09-23, spec awaiting review.

## Goal

A sales demo for the Reputation service that works for any demo client Gabriel generates (website
scrape or typed niche). Two phones side by side:

- **Customer's phone** (left): the viewer types as a recent customer. The business's AI checks in,
  asks what they liked, asks for a 1-5 rating, and asks for a Google review.
- **Manager's phone** (right): a lock screen that stays silent until a human is actually needed,
  then shows the notifications a real manager would get.

Reference: six screenshots Gabriel shared on 2026-09-23 ("Manchester Roofs" demo by a third party).
We match that look, add a WhatsApp skin, and replace the scripted replies with the live AI.

## Decisions already made (and why)

| Decision | Choice | Why |
|---|---|---|
| Page type | Standalone page, minted per demo client | Same shape as `/voice-demo` |
| Input | Viewer types free text, live AI answers | Gabriel wants a real AI, not a template |
| AI backend | The **real engine** via the existing web-demo path | One brain for demo and product, so they cannot drift |
| Content | From the createclient persona (`leads.demo_niche`) | Same source every other demo uses |
| Rating logic | 5 stars: send the review link. 4 or less: offer a manager callback **and** the review link | Hiding the link from unhappy customers is review gating (banned by Google's policy) |
| Engine fix | In scope | The demo must show what the product really does |
| Manager-phone trigger | Driven by state the engine already returns to the page | Both phones are on one page; no SSE needed |
| Channel toggle | SMS and WhatsApp skins, nearly invisible switch | Gabriel's call: it should not distract a prospect |
| Review auto-reply | Shown as a demo beat, using the real drafter | Reputation v2 already drafts replies (`review_drafter.py`) |

## What exists today (verified 2026-09-23)

- **Browser chat to engine:** `/demo/<token>` already talks to the engine. Express proxies
  `/api/web-demo/:token/:suffix?` (`server/routes/demo.ts:1022`) to
  `src/webhooks/web_demo_routes.py`, which feeds `process_inbound` and the page polls for replies
  (`GET /{token}`, `POST /{token}/message`, `POST /{token}/restart`). Web-demo leads have
  `channel_identifier = web-demo:<token>`, which `send_service.send_message` short-circuits, so
  nothing is ever sent to a real phone.
- **Reputation routing:** `inbound_handler.py` Step 11.6 sends leads on a `campaign_type='reputation'`
  campaign to `reputation_handler.handle_reply`.
- **Reputation handler today:** single shot. Classifies one reply as positive, negative or neutral
  and sends one template. Positive gets the link. Negative gets the link plus a manager alert and
  handoff (already fixed for gating). **Neutral gets no link** (still a gating gap). Templates exist
  in EN and NL only, no PT.
- **Blast radius:** zero live campaigns with `campaign_type='reputation'`, zero reputation prompts
  in `Prompt_Library`. Replacing the handler touches no client.
- **Service registry:** `client/src/features/demos/services.ts` already has a `reputation` entry
  with `campaignId: null` (shown as "soon").
- **Review replies:** `review_drafter._draft_reply(review)` drafts owner replies for Reputation v2.

## Scope

### 1. Engine: reputation becomes a real conversation

Replace the single-shot classify-and-template flow in `reputation_handler.py` with a multi-turn AI
conversation.

- **Prompt:** new `Prompt_Library` row, `use_case = 'reputation_conversation'`, loaded the same way
  the other prompts are. One version per language (EN, NL, PT-BR), each written in its own language.
  It receives the business persona (company name, service, agent name), the customer's first name,
  and the transcript.
- **Conversation shape** (a guide for the prompt, not a script): confirm it is the right person and
  the right job, ask what they liked, ask for a 1-5 rating, then act on the rating. One short
  question per message.
- **Model output:** JSON `{ reply, rating, action }` where `rating` is 1-5 or null and `action` is
  one of `continue | offer_review | send_review_link | offer_callback | close`.
- **Compliance lives in code, not the prompt:**
  - The review URL is never written by the model. When `action = send_review_link`, the handler
    appends the account's `google_review_url`. The model cannot invent or omit a link.
  - Once a rating of 4 or less is captured, the handler makes sure the review link is offered in
    that same reply (alongside the callback offer), whatever the model returned.
  - The neutral dead end goes away: every rated customer can reach the link.
- **Side effects, kept from today:** tags (`reputation_positive`, `review_requested`,
  `reputation_negative`), manager alert + `manual_takeover` for 4 or less, the referral ask behind
  `enable_referral_ask`.
- **New lead fields:** `review_rating` (integer, 1-5, null until given) and `review_outcome`
  (text: `link_sent | callback_requested | declined | null`). The CRM can show them later; the demo
  reads them now.
- **Opener:** the reputation feedback ask ("Hey {first_name}, it's {agent} from {company}. Are you
  the same person who recently had {service} done with us?"), in the lead's language.
  `demo_recap.render_demo_first_message` gets a reputation branch so the browser demo opens with it.

### 2. Engine: two small web-demo additions

- `GET /{token}` state gains a `reputation` block when the lead's campaign is reputation type:
  `{ rating, outcome, managerAlerted }`. The page drives the manager phone from this.
- `POST /{token}/review-draft` with `{ stars, text }`: calls the review drafter on that text and
  returns `{ draft }`. Uses the same drafting code as Reputation v2, nothing new. Rate limited like
  the other web-demo routes. Express's suffix allowlist gets `review-draft` added.

### 3. Demo campaign and account

- New demo campaign, `campaign_type = 'reputation'`, on the isolated demo account (Account 52), so
  nothing lands on a real client or alerts a real manager.
- That account's `google_review_url` is a fake link (`https://g.page/r/demo-business/review`). The
  page intercepts clicks on it and opens the review popup instead of leaving the page.
- `reputation_alert_target` empty on that account, so the demo never sends a real alert.
- Customer first name for the demo: a fixed name per language (EN "Jamie", NL "Sanne",
  PT "Juliana"), set on the web-demo lead when it is created for this campaign.

### 4. Frontend: the page

Route `/review-demo?token=<token>` (lazy import in `client/src/App.tsx`, same as `/voice-demo`).
Thin page file `client/src/pages/review-demo.tsx` plus `client/src/features/reviewDemo/`:

| File | Job |
|---|---|
| `CustomerPhone.tsx` | Phone frame, header (avatar, agent name, channel line), message list, composer, typing dots |
| `bubbles/SmsBubble.tsx` | iMessage look: grey incoming, green outgoing (SMS), rounded tails |
| `bubbles/WhatsAppBubble.tsx` | WhatsApp look: wallpaper, white/green bubbles, ticks, time stamps |
| `ManagerPhone.tsx` | Lock screen (lock icon, clock, date, "Silent until a human is actually needed", business name) and the notification stack |
| `ReviewPopup.tsx` | Google review modal: business name, stars, text box, "Post review", "Demo only, nothing is posted publicly" |
| `useReviewDemo.ts` | Polls web-demo state, sends messages, restart, the review-draft call, derives manager-phone events |
| `copy.ts` | EN/NL/PT strings, same pattern as `features/voiceDemo/copy.ts` |

Behaviour:

- **Channel toggle:** tapping the small channel line under the contact name ("Text Message · SMS" /
  "WhatsApp") flips the skin. `?ch=wa` or `?ch=sms` sets the start value so Gabriel can pre-pick.
  No visible switch otherwise.
- **Review link:** clicking the demo review URL in a bubble opens `ReviewPopup`. Stars default to 5,
  the viewer can change them.
- **Manager phone events**, in order, each an iOS-style banner that slides in:
  1. Rating 4 or less: "{first_name} gave {n} stars: needs a call" with the customer's last message.
  2. Review posted in the popup: "New {n}-star review from {first_name}" with the review text.
  3. Then: "AI drafted a reply. Tap to approve." Tapping it shows the draft from `/review-draft`
     with Approve / Edit buttons (approve just marks it approved in the demo; nothing is posted).
- **Replay demo** button after the review is posted, calling the existing `restart` endpoint.
- Captions under each phone ("The customer's phone / You're texting as the customer", "The
  manager's phone / {company} stays silent until it matters").
- Mobile: phones stack vertically, manager phone second.
- Dark background and phone chrome are page-local styling, like the voice demo. The chat skins
  deliberately copy iMessage and WhatsApp colours, which is the one allowed exception to the CRM
  token rule because they are mockups of other apps.

### 5. Demos page wiring

- `services.ts`: set the reputation entry's `campaignId` to the new demo campaign and add a
  `reviewPage?: boolean` flag. `serviceCopyUrl` / `serviceOpenUrl` build
  `/review-demo?token=<token>` for it, the way `voice` does.
- `ProspectDemoPanel.tsx` gets the matching branch so the Reputation button mints and opens the page.
- Done means: clicking the Reputation button on the Demos page opens a working review demo for that
  client.

## Out of scope

- "Watch the next 30 days" time-lapse from the reference.
- Posting anything to Google, real or demo.
- The Reputation workspace screen in the CRM, and showing `review_rating` in CRM views.
- The `reputation_scheduler` send timing for real campaigns (unchanged, it just sends the new opener).

## Risks

- **Engine down means a silent demo.** The page shows the same "assistant is offline" state the
  web demo already uses.
- **Debounce delay.** `process_inbound` waits for the campaign's debounce window before answering.
  The demo campaign gets a short debounce so replies feel live.
- **Model returns bad JSON.** The handler falls back to `action = continue` with the raw text as the
  reply, and logs it. Compliance rules still apply because they run in code.
- **Prompt tuning.** Test each language across ratings 1 through 5 and a "not me / wrong job" answer
  before calling it done. Never tune against one conversation.

## Verification

1. Engine: run a web-demo conversation per language for ratings 5, 4, 3 and 1, plus a decline.
   Check tags, `review_rating`, `review_outcome`, manager alert only on 4 or less, and that every
   rated path offers the link.
2. Page (playwright-cli, then close the browser): both skins, toggle via the channel line and via
   `?ch=`, popup opens from the link, all three manager banners fire in the right cases, draft
   appears, Replay resets both phones, mobile stacking.
3. Demos page: the Reputation button mints and opens the page for a freshly generated client.
