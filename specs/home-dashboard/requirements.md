# Requirements: Home as the Receptionist Dashboard

## What & Why

Home (`/platform/home`) is the first page of the app, and today it is dead:

- Every number and row is hardcoded sample data (`client/src/features/home/data.ts`). The page makes no API calls.
- Only the Owner can open it. Admins and clients are redirected to Campaigns.
- What it does show is built around database reactivation (DBR): the Reactivation card, the sample rows, and all three Quick Actions. Phone, WhatsApp and Website, which are what the product now sells, appear nowhere.

Home becomes the **Receptionist dashboard**: one page where a client (and Gabriel, for any account) sees what the receptionist did, on real data, with one tab per service and an Overview that adds them up. The question it answers is "what did my receptionist do for me, and does anyone need me?"

## Decisions (agreed with Gabriel, 2026-10-12)

1. **Audience: clients and the agency.** Clients see their own account. Owner and Admins see any account through the account switcher, or all accounts combined.
2. **Fix the data at the source.** The engine stamps every message and every booking with its real channel, and old rows are backfilled once. The dashboard reads clean columns and does not guess.
3. **Tabs: Overview, Phone, WhatsApp, Website, Reactivation, Reputation, Social.** Overview opens first. Reputation and Social were added on 2026-10-12: the AI receptionist is the main focus, DBR is a strong second offer, and Reputation and Social Media Manager are services too.
4. **SMS is not a tab.** It is a one-way fallback today, so it is a block inside the WhatsApp tab and a row in the Overview channel split.
5. **Tabs for services that are not live are hidden.** In the "all accounts" view every tab shows.
6. **Home is the default landing page for everyone.** A personal landing-page preference is kept.
7. **The old Home sections are removed:** the sample Reputation and Speed to Lead cards, the Explore panel, the Quick Actions row, the sample data. Campaign quick actions move into the Reactivation tab. Reputation returns as a real tab (decision 3).
8. **One noir illustration per tab,** in The Report's style, shown in a wide dark banner at the top of each tab.
9. **Layout** follows the ChatGPT exploration in `reference/` (round 2, "emphasis on the hero number"), with the changes listed under Layout.

## What

### Data model changes

| Change | Where | Written by | Backfill |
|---|---|---|---|
| `Interactions.channel` (`phone`, `whatsapp`, `sms`, `website`, `email`, `other`) | new column, indexed with `accounts_id` + `created_at` | engine, on every insert | once, from `type`, `triggered_by`, the lead's `channel_identifier` prefix, `Source`, `resolved_channel` and the campaign's `channel` |
| `Leads.booking_channel` (`phone`, `whatsapp`, `sms`, `website`, `booking_page`) | new column | engine, at the moment a booking is made | once, from `Voice_Calls.booked_iso`, `Client_Alert_Log.payload.source`, then lead source |
| Stream (receptionist or DBR) | no column | derived | see "Receptionist or DBR" below |

Why a column and not inference: `Interactions.type` defaults to `"SMS"` in the engine (`automations/tools/db/interactions.py:18`), inbound text is stamped `"SMS"` whatever the transport, and AI replies pass no type. Counting by `type` over-counts SMS badly.

### Receptionist or DBR

`campaign_type` cannot decide this on its own. It defaults to `'reactivation'`, and on live data (checked 2026-10-12) the only two non-demo "reactivation" campaigns are the website and phone campaigns of Lead Awaker (71) and Robben (72). So:

- A **receptionist campaign** is one wired to a receptionist surface: a `Widget_Configs` row, a `Voice_Numbers` row, or an account's `inbound_campaign_id` or `missed_call_campaign_id`.
- A **DBR campaign** has `campaign_type = 'reactivation'`, is not a demo, and is not a receptionist campaign.
- A lead is DBR when its campaign is a DBR campaign. Every other lead, including one with no campaign, is receptionist.

Leads on a Reputation campaign (`campaign_type = 'reputation'`) or a Social campaign (`social_reply`, or channel `instagram`) belong to those services and are not counted in the receptionist numbers either.

This is one shared SQL fragment in the CRM. Nothing in the engine's routing changes.

`Interactions.type` is left alone. Other code reads it, and changing its meaning is out of scope.

Known limits, accepted for v1:

- A lead holds one current booking. A booking counts once, at `COALESCE(booked_at, booking_confirmed_at_)`. A cancelled booking drops out, because cancelling clears both the date and `booked_at`.
- `booked_at` was never written for bookings made on the public booking page (27 of 85 booked leads have none). The engine now sets it there too, and the backfill fills old rows from `booking_confirmed_at_`.
- An AI reschedule in chat rewrites `booked_at`, which moves that booking into the reschedule's period. Left as is.
- Backfilled `booking_channel` cannot tell WhatsApp from SMS for old engine-booked chats. Those are labelled `whatsapp`.

### Which tabs show

One endpoint returns the live services for the account in scope:

| Tab | Live when |
|---|---|
| Phone | an enabled `Voice_Numbers` row for the account with `client_niche` set (NULL means the agency demo line) |
| WhatsApp | `WhatsApp_Senders.status = 'connected'`, or the legacy Twilio sender is approved, and `inbound_campaign_id` is set |
| Website | a `Widget_Configs` row that is `enabled` with at least one allowed domain |
| Reactivation | at least one DBR campaign (see "Receptionist or DBR") |
| Reputation | review requests switched on (`enable_reputation_management`) with a non-demo reputation campaign, or Google Business Profile connected |
| Social | an Instagram account connected and a non-demo social campaign (`social_reply`, or channel `instagram`) |
| Overview | always |

The SMS block inside WhatsApp shows when `Accounts.sms_sender_id` is set or any SMS was sent in the period.

An account with no live service sees Overview with an empty state that points to account setup (agency) or says setup is in progress (client).

### Scope, period and access

- **Account scope:** the account switcher. Clients are locked to their own account on the server. `0` means all accounts and is agency-only.
- **Access rule:** a pure, tested helper modelled on `server/routes/voiceCallsAccess.ts`.
- **Demo traffic is excluded everywhere:** demo calls (`isDemoSql`), demo campaigns (`is_demo`), demo leads (`wa-demo:`, `web-demo:` identifiers, demo sources).
- **Period:** this month (default), last 7 days, last 30 days, last month. Every headline number also returns the previous period of the same length for the change figure. Day boundaries use the account's timezone; the all-accounts view uses the agency timezone.

### Tab content

Every number below is counted in SQL on the server. No tab downloads lead or message lists to count in the browser.

**Overview**

- Banner: conversations handled in the period, change vs previous period.
- Tiles: Bookings, Callbacks requested, New contacts, Waiting on you.
- By channel: Phone, WhatsApp, Website (conversations and bookings each), SMS (messages sent).
- Needs attention: leads waiting on a person, calls that need a callback, failed transfers. Each row links to the lead or the call.
- Conversations per day.
- Recent activity: bookings, calls, new chats, follow-ups and transfers, newest first. This is its own query. The old `/api/activity-feed` is not reused: it builds English sentences in SQL, includes automation log rows clients should not see, and has a fixed 7-day window.

Definitions follow the daily client recap (`automations/src/automations/client_alerts/recap_data.py`) so the dashboard and the recap email agree:

- **Conversation:** a live call, or a distinct receptionist lead with at least one inbound non-phone message in the period.
- **New contact:** a lead counted as a conversation whose `created_at` is inside the period.
- **Callback:** a live call that needs one, by the engine's own rule (`call_needs_callback`): not booked, and either the outcome is `callback`, the caller left a message, or the transfer failed.
- **Waiting on you:** leads in manual takeover with no human reply since their last inbound message, plus callbacks from the last 7 days. Not tied to the period: it is the current to-do list.

The recap reads callbacks and handoffs from `Client_Alert_Log`, which only exists since alerts went live (3 rows on 2026-10-12). The dashboard applies the same rules to the source tables, so earlier weeks are covered too.

**Phone**

- Banner: calls answered.
- Tiles: Calls, Booked, Transferred (failed transfers shown as a sub-figure), Average length (calls of 10 seconds or more).
- Calls per day.
- Outcomes: booked, callback, transferred, hung up, other.
- Two facts: share of calls outside office hours; sales calls and robocalls screened out.
- Recent calls, each opening the call on the Voice Calls page (through the page's existing "selected call" hand-off, since calls have no URL of their own).

**WhatsApp**

- Banner: WhatsApp conversations.
- Tiles: Conversations, Messages (in and out), Bookings, Handed to a person.
- Conversations per day.
- After-call follow-ups sent (from `Call_Followup_Log`).
- SMS fallback block: sent, delivered, failed, and the share of follow-ups that fell back to SMS.
- Number health: connected or not, quality rating.
- Recent conversations, each linking to the lead.

**Website**

- Banner: chats started.
- Tiles: Chats started, Contacts captured, Capture rate, Bookings.
- Chats per day.
- Recent chats, each linking to the lead.

"Contact captured" means a `web:` lead that has a phone or an email.

**Reactivation**

- Banner: bookings from reactivation.
- Tiles: Leads contacted, Reply rate, Bookings, Cost per booking.
- Campaign picker: all campaigns (default) or one.
- Replies and bookings per day, and the pipeline as bars (leads per stage).
- "Open campaign" links to the campaign page, where the detailed panels already live.
- Actions: New campaign, Import leads. Agency only, as today.

The existing campaign panels are not reused here. They are built for one campaign and count in the browser from full lead and message lists, which breaks the rule above.

**Reputation**

- Banner: new Google reviews.
- Tiles: Average rating, Replies posted, Waiting for your reply, Review requests sent.
- Rating mix (5 to 1 stars), reviews per day, recent reviews.

**Social**

- Banner: conversations from Instagram.
- Tiles: Conversations, Messages, Bookings, Booking rate.
- Conversations per day, recent conversations.

State on 2026-10-12: neither has real data. No account has connected Google Business Profile (0 reviews stored), the only reputation campaign and the only social campaign are demos, and there is no Social Media Manager product beyond the Instagram comment-to-DM demo (no posting or scheduling, no comment or follower data). Both tabs are built on real queries with proper empty states, show only in the all-accounts view today, and fill in the day a client goes live.

### Layout

Base: ChatGPT round 2, direction 2 (`reference/chatgpt-round-2.webp`). Changes:

1. **No duplicate number.** The banner carries the headline figure, so the first tile is not the same figure again (the mockups show 214 twice).
2. **"Waiting on you" is the one wine-filled tile** (as in round 1, direction 2). When it is zero it is an ordinary tile.
3. **Needs attention moves up,** beside By channel, directly under the tiles (as in round 1, direction 3). Rows are full-size and readable, not a small table. The chart and recent activity sit below.
4. **Outcomes are horizontal bars, not a donut.** Five slices in close wine tints cannot be told apart, and bars match the By channel block.
5. **Illustrations are flat grainy screenprint,** not the rendered 3D look in the mockups.
6. **Dark mode** follows round 2, direction 3: the same banner, cards on warm charcoal.

Structure of every tab: greeting and date, tab row with the period picker on the right, banner, tiles, then two columns of panels.

Build rules (from `UI_STANDARDS.md`):

- `.la-page` shell, content capped at `max-w-[1386px] mr-auto`.
- Tabs are the shared `la-seg` control with `role="tablist"`. The open tab stays in the URL as `?tab=`, so a refresh or a shared link reopens it.
- Tokens only. The banner's dark surface gets its own tokens in `variables.css`, identical in light and dark mode.
- `StatCard`, `PanelShell`, `SectionHead` and the other primitives are reused. No hand-rolled cards. `StatCard` gains a `filled` option for the wine tile.
- Charts follow the dataviz skill: thin ink or wine lines, no gridline clutter.
- Mobile (below 768px): tabs scroll horizontally, banner is shorter with the image cropped behind the number, tiles two across, panels stacked.
- Each tab is its own lazy chunk so opening Home does not load five dashboards.

### Illustrations

Seven images, one series, from The Report's generator (`script/report/gen-images.cjs` pattern, house noir STYLE string):

| Tab | Scene |
|---|---|
| Overview | a reception desk with a small brass bell |
| Phone | a desk telephone ringing under a single lamp |
| WhatsApp | a mobile phone glowing on a bedside table |
| Website | a lit shop window on a dark street |
| Reactivation | a dusty filing cabinet with one drawer open |
| Reputation | a framed certificate above a shelf with five brass stars |
| Social | an old twin-lens camera on a tripod with blank square prints |

- Landscape, subject on the right, the left half calm and dark so cream text sits on it.
- Checked together on one contact sheet, and approved by Gabriel, before they go into the page.
- Compressed to WebP at display size, in `client/src/assets/home/`. The three old mascot images are deleted.

### Cleanup

- `OwnerOnly` comes off the Home route (the component stays, other routes use it). The nav bar, the mobile bottom bar, the command palette and the landing-page picker show Home to all roles. `/platform/dashboard` redirects to Home.
- `defaultLandingPath()` returns Home for every role.
- Deleted from `features/home/`: `data.ts`, `icons.tsx`, `hooks/useHomeMetrics.ts`, and the components `PulseStrip`, `NorthStarCell`, `Sparkline`, `ExplorePanel`, `NeedsAttention`, `ActivitySidebar`, `atoms`. Also the orphans `hooks/useDashboardWidgetPrefs.ts` and `components/crm/BookedCallsKpi.tsx`.
- `FILE_MAP.md` updated.
- The existing `home` namespace (`en`, `nl`, `pt` Brazilian) is rewritten with the new strings.

## Out of scope

- Website visits, widget opens and a visit-to-chat rate. Nothing counts these per account yet.
- Cost per channel (WhatsApp template spend, SMS spend, voice minutes).
- A bookings table with full booking history.
- An SMS tab, any upsell panel.
- Building the Social Media Manager product itself (posting, scheduling, comment and follower analytics). The Social tab only reports Instagram conversations.
- Changing what `Interactions.type` means.
- The mock Missed Calls and Speed to Lead pages.

## Risks

- **Engine restart.** Stamping needs one. The engine has unreleased receptionist-channels work with its own go-live order (`specs/receptionist-channels/action-required.md`, "Going live"). The restart follows that order and needs Gabriel's go-ahead.
- **Backfill accuracy.** Old messages are classified by inference. The backfill reports its counts per channel per account for a sanity check before the dashboard goes live to clients.
- **Clients seeing new numbers.** These must agree with the recap emails they already get. Same definitions, checked against one account (Robben, 53) before release.
- **Pi load.** Aggregate queries run on every tab open. They are indexed and limited to the selected period.

## Success criteria

- A client logs in, lands on Home, and sees only their live services, on real numbers that match their recap.
- Gabriel switches account and the tabs and numbers follow. "All accounts" sums correctly.
- No sample data is left on the page, and no demo traffic is counted.
- A WhatsApp message sent today is counted as WhatsApp, and an SMS fallback as SMS.
- The page is correct in light and dark mode, at phone width, and in en, nl and pt.
