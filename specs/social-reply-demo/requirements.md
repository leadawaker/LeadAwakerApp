# Social Reply Demo (Instagram comment to DM): Requirements

**Status:** built 2026-09-25, see action-required.md.
**Owner:** Gabriel. **Related:** [specs/speed-to-lead](../speed-to-lead/), [specs/website-widget](../website-widget/), [specs/demo-surface-split](../demo-surface-split/), `project_speed_to_lead_demo_and_site_scrape_2026_09_01`.

## Why

The "Socials" service already sits in the Demos table with no campaign behind it
(`client/src/features/demos/services.ts:46`, `campaignId: null`). This fills it.

The pitch: a business runs an Instagram post that says "Comment ROOF and we'll DM you".
Someone comments, and within seconds the AI is in their DMs, qualifying and booking.
The demo lets a prospect live that from the lead's side: scroll a feed, find a post
made for *their* business, comment the word, and land in a DM conversation with the
same AI, booking flow and CRM inbox as every other service.

## What exists already (do not rebuild)

| Capability | Where |
|---|---|
| Minting a per-prospect demo link from a Client persona | `POST /api/demo/create-link`, `server/routes/demo.ts:582-704`, Demos page `NewDemoForm.tsx` / `ProspectDemoPanel.tsx` |
| Service registry (one list for mint panel + Demos table) | `client/src/features/demos/services.ts` |
| Persona generation (company, vocabulary, opener, per language) | `server/demo-session.ts`, `server/demoGenerator/providers.ts` |
| Client persona library (Niche_Vocabulary rows) | `server/demo-clients.ts`, `shared/schema.ts:337-455` |
| Server-rendered demo page on the Pi, keyed by token | `/widget-demo/:token`, `server/routes/widget.ts:479-511` (the template for this page) |
| Browser chat transport: lazy lead, opener, post-then-poll, restart, recap, audio | `/api/web-demo/:token/:suffix?` proxy (`server/routes/demo.ts:1022-1099`) to engine `src/webhooks/web_demo_routes.py` |
| Opener rendering with persona overlay, per language | `render_demo_first_message`, `automations/src/automations/demo_recap.py:198` |
| Inbound AI turn, booking, handoff, owner takeover | `inbound_handler.process_inbound` to `ai_conversation.run_ai_conversation` |
| Stage tracker, recap panel, confetti, presenter menu | `client/public/premium/demo/{tracker,recap,confetti,admin}.js` |
| Prompt borrowing between campaigns | `Campaigns.prompt_campaign_id` (widget campaign 68 borrows 67's prompt 108) |
| First-reply notification to Gabriel | `server/demo-reply-notifier.ts` |

## Decisions (made in chat, 2026-09-23)

1. **Same creation flow.** Minted from the Demos page like every other service: pick or
   generate a Client, pick a language, click Socials. No separate configuration page.
2. **AI-generated post image**, generated once per Client and cached, never per page view.
3. **Generated per Client, per language:** post caption, trigger word, DM opener line.
4. **Speed to Lead engine, its own prompt.** The commenter is a warm lead who raised
   their hand on a specific offer, which is Speed to Lead's situation, not prompt 93's
   cold discovery. A new prompt is derived from prompt 108 and given the post as context.
5. **Light theme, Instagram-like look.** White background, Instagram's light-mode
   layout and palette, not the dark look in the reference screenshots. No official
   Instagram logo or icons (trademark): a script-font "Instagram" and generic icons,
   as in the reference video.
6. **Feed of three posts:** a hardcoded static post above, the generated post, a
   hardcoded static post below.
7. **Decorative DM inbox** with other people's conversations, with photos.
8. **Everything follows the token's language** (`en`, `nl`, `pt`): generated copy,
   static posts, inbox names and snippets, page chrome. Portuguese is always Brazilian.
9. **Conversion works the same** as the other chat demos (tracker, booking, recap,
   confetti, presenter menu), and the thread appears on the CRM Chats page.

## Functional requirements

### A. Minting

- **A1.** `services.ts` "socials" gets a real campaign (new demo campaign, referred to
  here as **campaign S**; the id is assigned when it is created) and a `socialPage: true`
  flag, handled the same way `widgetPage` is: `serviceCopyUrl` and `serviceOpenUrl`
  return `/social-demo/<token>` on the CRM host, and `serviceOf` places an untagged
  campaign-S link in the socials column.
- **A2.** Minting a socials link for a Client in language L makes sure that Client has a
  **social post** for L (section B). If it exists, it is reused. If not, the TEXT is
  generated during the mint (a few seconds, the mint button already shows a spinner)
  and the IMAGE is started in the background, so the mint never waits 10 to 60 seconds
  or hits a proxy timeout. The page reads the image live and shows the fallback (B5)
  until it exists. Socials needs a Client: a mint without one is refused.
- **A3.** The social post is copied into the lead's `demo_niche` snapshot at mint, like
  every other persona field, so a link already sent keeps showing the post it was sent
  with. The image is the one exception: it is read live from the Client (as the widget
  page reads its screenshot live), so a regenerated image reaches links already sent.
- **A4.** Campaign S is flagged as a persona demo campaign so the engine's persona
  overlay (`is_persona_demo_campaign`) applies to its opener and prompt.

### B. The generated post

- **B1.** One generation call (same provider layer as persona generation) produces, in
  language L, from the Client's existing persona and knowledge:
  - `handle`: an Instagram-style username for the business (lowercase, no spaces).
  - `caption`: 1 to 3 sentences an owner would really post, naming the service and the
    area, ending the way these posts do. One emoji at most.
  - `keyword`: one short uppercase word tied to the service (ROOF, KEUKEN, TELHADO).
    ASCII letters only, 3 to 10 characters, so it is easy to type on a phone.
  - `cta_line`: the "Comment KEYWORD and we'll DM you to ..." line, containing the keyword.
  - `dm_opener`: the first DM line: thanks them for commenting, gives the agent's name
    and the company, asks how they are. Uses the persona's `agent_name` and
    `company_name` as tokens, not baked-in text, so the existing opener rendering and
    disclosure clause apply.
  - `offer`: one short phrase naming what the post offers, used as prompt context.
  - `image_prompt`: an English description of a realistic photo for this business
    (the work, the tradesperson, the product), with no text, logos or watermarks.
  - `likes`: a plausible like count for a small local business.
- **B2.** The image is generated from `image_prompt` with the OpenAI Images API
  (`OPENAI_API_KEY` is already set on the Pi), square, compressed to WebP at display
  size, stored next to the site screenshots and served the same way. One image per
  Client, shared by all languages (it carries no text).
- **B3.** Stored on the Client row, per language for the text and once for the image,
  so every future mint for that Client is instant.
- **B4.** The Client editor on the Demos page gets a **Social post** section: shows the
  post, lets Gabriel edit caption / keyword / opener per language, and has a
  "Regenerate image" and a "Regenerate text" button.
- **B5.** If image generation fails, the mint still succeeds. The post shows the
  Client's website screenshot when one exists, otherwise a plain branded placeholder,
  and the editor shows the failure with the regenerate button.

### C. The page: `/social-demo/:token`

Server-rendered on the Pi, same pattern as `/widget-demo/:token`: validates the token,
loads the persona and language, reads the image live, renders HTML with `no-store`.
Not on Vercel. Static assets (logo, icons, static post images, inbox avatars) are
committed WebP/SVG files at display size.

**C1. Feed view** (first screen). A phone-width Instagram feed, centred on desktop:
- Top bar with the Instagram logo and the two header icons.
- A "Scroll down to start the demo" pill that disappears once the user scrolls.
- **Static post 1**, then the **generated post**, then **static post 2**. Each post has
  the real anatomy: avatar + handle + "Sponsored" or not, square image, like / comment /
  share / save icons, like count, handle + caption, "Add a comment..." row.
- The generated post shows the Client's handle with a "Sponsored" label, its image,
  caption, and below the caption the `cta_line` in a highlighted box, as in the reference.
- Bottom tab bar (home, search, create, reels, profile), decorative.
- Only the generated post's comment field works. Its placeholder hints at the keyword.

**C2. Commenting.** The user types into the comment field and taps Post.
- Matching is forgiving: case-insensitive, trimmed, accents and trailing punctuation
  ignored, and the keyword anywhere in the comment counts ("roof please" works).
- On a match: the comment appears under the post as the user's own, then after a short
  beat a DM notification slides in, and tapping it (or waiting about two seconds) opens
  the DM view. Only now does the page call the engine, so the opener is created at
  comment time, not page load.
- On no match: the comment still appears, and a small hint under it repeats the keyword.

**C3. DM view.**
- Desktop (wide): Instagram's web Direct layout. Left: "Direct" header, Primary /
  General tabs, the business's thread on top, then the decorative inbox rows. Right:
  the thread with the business's avatar, name and "Active now", the stage tracker
  under the header, bubbles, and a composer ("Message...").
- Phone (narrow): straight into the thread, with a back arrow to the inbox list.
- Bubbles in Instagram's light-mode style: the business in light grey on the left, the
  user in Instagram blue/purple on the right, typing dots while the AI replies.
- The thread uses the existing web-demo transport unchanged (`/api/web-demo/:token`
  opener, message, poll, restart). Transport is NOT separated from rendering today (it
  lives inside `main.js`, and `widget.js` has its own copy), so this build creates
  `client/public/premium/demo/transport.js` and the new page uses it. Moving `main.js`
  and `widget.js` onto it is a follow-up, kept out of this build so the live demo and
  widget are not touched. The pure render modules (`chat.js`, `tracker.js`,
  `recap.js`, `confetti.js`, `admin.js`) are reused as they are.
- The page must not call the engine before the comment (the first GET creates the lead
  and sends the opener). The server-rendered page tells the client whether the thread
  has started (the web-demo lead exists and has an inbound message); if so, a reload
  opens straight in the DM view.
- Booking links, the tracker, the recap panel, confetti on booking and the presenter
  ⋯ menu behave exactly as on `/demo/<token>`.
- Restart (presenter menu) wipes the thread and returns to the feed view, so the demo
  can be run again from the comment.
- Voice memos: included only if the reused chat module gives them for free. Not a
  requirement for v1.

**C4. Decorative inbox.** Eight rows per language: a photo avatar, a first name and
last name native to that language (Dutch names for `nl`, Brazilian names for `pt`),
a short everyday last-message snippet in that language, a relative time, and an unread
dot on some. Fixed content, the same for every demo in that language, never clickable.
The avatar photos are generated once and committed; they are shared across languages
only where the face fits the names (otherwise one set per language).

**C5. Static posts.** Two fixed posts per language, each by a believable local
personal account native to that language (an English home baker, a Dutch one, a
Brazilian one, and a second everyday account per language). Images generated once and
committed. Captions written natively per language, not translated.

**C6. Language.** Every string on the page (chrome, hints, notification, "Active now",
tabs, placeholders, inbox, static captions) comes from a per-language table in the
page's own code, following the landing-page/demo convention (this page is outside the
React app, so react-i18next does not apply). Unknown language falls back to English.

**C7. Branding.** Instagram-like, not Instagram's own marks, as in the reference video:
- The word "Instagram" set in a free script Google Font (Grand Hotel or similar), not
  the official wordmark artwork.
- No camera glyph logo anywhere, and no official Instagram icon artwork. Header and
  bottom-bar icons are simple generic outline shapes (the reference uses plain rounded
  squares). Post actions use generic heart, speech bubble, paper plane and bookmark
  outlines, which are not Instagram-specific.
- Instagram's light-mode palette (white ground, black text, grey secondary text, blue
  links and Post button) and the gradient ring on avatars, since colours and layout
  are not the protected marks.
The page is standalone: `UI_STANDARDS.md` does not apply (same as the landing page and
the widget demo page).

### D. Engine and prompt

- **D1.** Campaign S: a persona demo campaign on the same account as the other service
  demos, `campaign_type = 'social_reply'`, with booking configured like campaign 67.
- **D2.** Its `First_Message` per language renders the persona's `dm_opener`. If the
  persona has none (a lead minted before the post existed), a fixed per-language
  template is used: thanks for commenting on the post, it's {agent_name} from
  {company_name}, how is your day going.
- **D3.** No copied prompt (amended 2026-09-23 after reading 108). Prompt 108 already
  describes this lead ("contacted {company_name} moments ago, through the website or an
  ad ... warm, expecting a reply"), and the resolver has no include mechanism, so a copy
  would be 45k characters that drift from 108. Instead:
  - Campaign S borrows 108 through `prompt_campaign_id = 67`, like the widget campaign.
  - 108 gains ONE block guarded by `{{#if lead_source == "social_comment"}}`, inert for
    every other campaign, that says: the lead commented the keyword on the company's
    Instagram post about `offer`, got the opener in DM, and is replying; they raised
    their hand for that offer, so do not ask why they got in touch, pick up from the
    post; Instagram DMs are short and casual, one question per message. The post
    context is the new variable `{social_context}`.
  - The post context also feeds `{lead_context}` (via `enquiry_context`), so the
    scoping ladder skips what the post already says.
  Everything else (qualification, booking, handoff, objections) is 108's. Written
  following `feedback_prompt_editing_verbatim_and_conditionals` and
  `feedback_prompt_rules_cheapest_compliant_output`. Evaluated on several niches and
  all three languages, never tuned on one conversation. If that evaluation shows the
  block is not enough, a separate prompt is a follow-up decision, not part of this build.
- **D4.** No change to the web-demo transport or `process_inbound`. The lead keeps the
  existing `web-demo:<token>` channel identifier. The Instagram identity comes from the
  campaign type, which avoids touching the surface-split logic.

### E. CRM

- **E1.** The thread appears on the Chats page like every other web-demo lead (it is a
  normal Leads + Interactions row), including owner takeover.
- **E2.** `getConversationType` (`client/src/features/leads/components/conversationType.ts`)
  gets an `instagram` type, derived from `campaign_type = 'social_reply'`, with an
  Instagram icon and label in the Chats page type filter (all three locales).
- **E3.** The first-reply notification (`demo-reply-notifier.ts`) fires for these leads
  with no change, since it keys on the `web-demo:` prefix. Verify, do not assume.

## Out of scope

- Real Instagram / Meta API integration (real comment webhooks, real DMs). This is a
  simulation for sales demos only.
- A WhatsApp side for this demo (no `wa-demo` handoff link from the DM view).
- Stories, reels, or more than one generated post.
- Letting the prospect choose the keyword or the image on the page.

## Risks and notes

- **Instagram trademark.** Avoided by design (C7): no official logo or icon artwork,
  only the name in a generic script font and a similar layout and palette. The page
  still must never pass itself off as Instagram: it is `noindex`, not linked from the
  public site, and carries a small "Demo by Lead Awaker" mark.
- **Image cost and latency.** One image per Client (about $0.04 to $0.20 depending on
  quality) plus 10 to 60 seconds at first mint. Acceptable because it is once per
  Client, and the mint shows progress.
- **Image quality.** Generated images can come out uncanny (hands, text). The image
  prompt forbids text; the regenerate button (B4) is the fix for a bad one.
- **Stale page JS.** Demo pages have no cache busting and Cloudflare caches static
  paths (see `feedback_demo_page_render_and_static_cache`,
  `project_widget_restart_unread_2026_09_21`). Version the page's module URLs.
- **Prompt 108 is live.** It serves campaigns 67 and 68. The new block is inert unless
  `lead_source == "social_comment"`, and the CRM autosave can silently revert a SQL
  write to a prompt that is open in a tab (`feedback_prompt93_editing_workflow`): close
  it first, then re-read the row after writing.

## Acceptance

1. From the Demos page, pick a Client with no social post, choose `nl`, click Socials:
   the mint takes longer once, then opens `/social-demo/<token>`.
2. The feed shows Dutch static post, the Client's generated post with a fitting photo,
   Dutch caption and keyword, Dutch static post below. No English anywhere on the page.
3. Typing the keyword in lower case with a trailing "!" opens the DM view with the
   Dutch opener from the Client's agent and company.
4. Replying gets a warm, post-aware answer in Dutch, the tracker advances, and booking
   works end to end with confetti and recap.
5. The same thread is visible on the CRM Chats page under the Instagram type, and the
   first-reply notification fired.
6. Minting a second `nl` link for the same Client is instant and shows the same image.
   Minting `pt` generates text only and reuses the image.
7. Restart from the presenter menu returns to the feed and the demo runs again.
8. On a phone-width screen the whole flow works one-handed, with no horizontal scroll.
