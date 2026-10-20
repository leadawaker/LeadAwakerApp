# Client mobile polish: design

Written 2026-10-20 from Gabriel's walkthrough of the phone app (as himself and as client Thijs) and two rounds of answers. Builds on Client Mode (`specs/client-mode/`), which is done and reviewed. Items marked *(my call)* are decisions made on Gabriel's behalf; everything else he said or chose.

## Why

Thijs Robben (account 53, role Manager, Dutch, receptionist service: phone + website chat, no reactivation, no WhatsApp sender) starts using the CRM now, mostly on his phone. Gabriel found the phone app:
- hard to read: bone buttons on a bone background;
- duplicated: calls show in Chats and in Calls, and statistics sit on Home and on the pages;
- full of dead ends: no way back from Pipeline, a Settings button that does nothing, a List button that does nothing;
- outdated next to the recently built My Account page.

**Success:**
- **Thijs**, on his phone in Dutch:
  - opens Calls and Chats and finds the same system in both: Stats first, then his people, one clear status per person and per call;
  - answers his website chats;
  - sees his calendar and opens his account;
  - never meets something duplicated, agency-ish or unreadable.
- **Thijs is alerted** when a website or WhatsApp chat needs him.
- **Gabriel gets a WhatsApp** when a client writes to him or when someone else uses one of his demos.
- **The recap email's agenda shows the week's real appointments**, and each call in the email opens straight in the CRM.

**Non-goals:**
- a desktop redesign (desktop changes only where this document says so);
- new features beyond this list;
- the deferred Client Mode minors (open-days editing etc.).

**Anti-goals (a failure even if it works):**
- Thijs sees agency chrome or English on a Dutch screen;
- an agency workflow breaks;
- a human reply that silently never reaches the person;
- Gabriel gets a WhatsApp for his own demo test;
- dark mode breaks.

## Constraints

- **Mobile changes are additive** (`max-md:` / `md:hidden` / `useIsMobile`). Desktop layout stays unless a section says "desktop too".
- **Tokens only.** No raw hex in components, and dark mode must work. Follow `UI_STANDARDS.md` and the `leadawaker-dev` skill. New colours go in `client/src/styles/variables.css` only.
- **i18n:** every string goes through i18n in en, nl and pt (pt is Brazilian).
- **Verification:**
  - Never run `tsc`.
  - The Pi dev server reloads on save. Verify on https://app.leadawaker.com, logged in as Owner, and use "view as" Manager 53 for client checks.
  - One browser at a time, and close it afterwards.
- **Shared working tree:** it holds other sessions' uncommitted work. No commits (Gabriel commits selectively), and no same-file parallel edits.
- **Leads files:** Gabriel approved taking over the uncommitted Leads rebuild (`features/leads/**`, `hooks/usePagedLeads.ts`, `server/storage/leadsPage.ts`, `server/routes/leadsPage.ts`). Build on top of it and never revert it.
- **Python engine** (`/home/gabriel/automations`): read its `CLAUDE.md` before touching it. Restart `leadawaker-engine` only when no call is live (check first). Otherwise list the restart in `action-required.md`.

## A. Phone shell (everyone)

- **A1. Darker chrome.** These use one new, deeper sand token in light mode (e.g. `--chrome-deep`; the exact value is the builder's call):
  - the mobile header (`MobileListHeader` and every other mobile page header, Home and My profile included);
  - the bottom bar;
  - the More page background.

  It must be clearly darker than `--bg`/`--surface`, so the bone raised buttons and cards on top stand out, and text on it must pass WCAG AA. Dark mode keeps today's dark surfaces: it may go one step deeper, never lighter.
- **A2. Bottom bar.**
  - Unselected items: muted ink icon and label on the dark sand.
  - Selected item: a filled wine pill (`var(--wine)`) with bone icon and label. No raised chip.
- **A3. Header tab switchers** must read clearly on the darker header: bone raised segments, with wine text on the active one. Every page tab gets an icon next to its label (see C5, D3).
- **A4. Size and position pass at 390px.**
  - Bottom-bar icons are 22px, with labels at least 10px.
  - Tap targets are at least 44px.
  - Header icon buttons are the 36px `IconBtn`.
  - Safe-area padding is consistent.
  - Pages covered: Home, Calls, Chats, Calendar, Leads, Account, More, My profile and Docs.
- **A5. Inset fields** are always crisp (`neu-inset-crisp`) on mobile.

## B. Navigation

- **B1. "Voice calls" becomes "Calls" everywhere, desktop too.** That covers:
  - the `sidebar.voiceCalls` values in en/nl/pt;
  - the desktop nav bar;
  - mobile More;
  - the Command Palette;
  - the page title.

  Keep the `labelKey` section filter in `RightSidebar.tsx` working.
- **B2. Client bottom bar:** Home, Calls (only when `voiceLive`), Calendar, Chats, More.
  - Chats shows only when the account has website chat or WhatsApp (`services.website || services.whatsapp`). Without it, the bar is Home, Calls, Calendar, Leads, More. *(My call.)*
- **B3. Client More page, top to bottom:**
  1. The Lead Awaker logo: `logo-v2.svg` on `--logo-plate` in light mode, `logo-v2-dark.svg` in dark.
  2. Account (today called "Receptionist").
  3. Leads.
  4. Billing (when invoices exist).
  5. Campaigns (only with reactivation, as today; account 53 has none).
  6. Help: Documentation, Message Gabriel.
  7. Utility tiles: Language, Theme, Alerts.
  8. Bottom panel: My profile, Logout. The separate Settings row goes.
- **B4. "Receptionist" becomes "Account"** for clients everywhere, desktop too (`myAccountLabelKey`): en "Account", nl "Account", pt "Conta".
- **B5. Client desktop nav (desktop too):** Home, Calls, Chats, Leads, Calendar, Account, Billing, Campaigns. Same gates as today, plus the Chats gate from B2.
- **B6. Agency bottom bar:** Home, Calls, Chats, Tasks, More. Calendar moves to the agency More page.
- **B7. Agency More page:**
  - Campaigns is removed (it stays on desktop).
  - Calendar is added.
  - "Voice calls" becomes "Calls".
  - The logo goes at the top.
  - Prompt Library, Automation logs, Traffic, Documentation and Support inbox stay.
- **B8. Code tidy-up.** Pure rules stay in `components/crm/navGates.ts`, with their node tests updated. Remove the duplicated `CLIENT_ICON` map (one shared map).
- **B9. Remember the last tab.** Calls and Chats open on Stats the first time. After that each page opens on the last tab that user visited, stored per user and per page.

## P. One status system for calls and chats

Gabriel asked whether a call or a person could have more than one tag, and wants one unified system.
- **A call has exactly one outcome pill,** because it ended one way: Booked, Callback, Transferred, Answered, Hung up. The builder maps the current outcome values onto these.
- **A person has exactly one stage pill**, in People and in Chats alike, in the receptionist vocabulary: New inquiry, Answered, Booked, Done. *(My call.)*
  - They also get a small "Needs you" marker while something waits on the client: a callback asked for, or a chat waiting for a reply.
  - No stack of tags.
- **The same Pill component and token colours** are used across Calls, Chats, Leads and the recap email. Booked looks the same everywhere.
- **Lead Tags** (the `Tags` table) are not shown on client lists. A tag whose name equals a stage is hidden everywhere, because it is redundant.

## O. Home is the overview

- **O1. Home keeps only the Overview tab** for accounts on the receptionist services.
  - The Phone tab moves to Calls › Stats (D8).
  - The Website and WhatsApp tabs move to Chats › Stats (C6).
  - Reactivation, Reputation and Social stay on Home until those pages get a Stats tab of their own. They don't apply to Thijs. *(My call.)*
- **O2. Overview "Recent activity" gets icons** per event type (call, chat, booking, callback, transfer), coloured from tokens, so it scans at a glance.
- **O3. The welcome checklist** uses the new names (Calls, Chats, Account) and points at the new Stats tabs where it mentions figures.

## C. Chats

- **C1. Calls out of Chats.** The Chats list (`mode="conversations"`, `GET /api/leads/page`) only returns leads with a chat: `chat_channel_eff IS NOT NULL` in `server/storage/leadsPage.ts`.
  - A caller who later chatted stays.
  - The counts agree with the list.
- **C2. Calls inside a thread.** When a thread belongs to a lead who also called, each call shows as one compact line ("Call · 2:05 · Open") that opens the call on the Calls page, never as a full transcript. *(How it looks is the builder's call.)*
- **C3. Clients get `/platform/chat`.**
  - The redirect for non-agency users goes.
  - On a lead, clients see the real conversation instead of the summary card.
  - They can reply and take over from the AI (Gabriel chose read and reply).
- **C4. Reply path** (investigated 2026-10-20):
  - **Use the Chats page composer** (`ChatPanelMain.tsx` ~385-400), which saves `manual_takeover: true` before sending.
    - The lead-card `ConversationWidget` only sets local state, so the AI keeps talking. Fix it as well: its "Bypass AI" text promises a pause that never happens.
  - **Website chat already works end to end.**
    - The reply is stored, and the widget poll marks it `human` with the sender's `full_name_1`.
    - The engine stops AI turns while `manual_takeover` is set.
    - The visitor sees the reply when they open the chat again in the same browser.
  - **For clients only, show the reply box only when the person can be reached:**
    - the lead's `channel_identifier` starts with `web:` / `web-demo:`; or
    - the account has its own WhatsApp sender (`WhatsApp_Senders`).
    - Otherwise a short note says why.
    - Agency users keep today's behaviour, including sending from Lead Awaker's own number.
  - **Hide the voice-memo button for clients.**
  - **Security (ships with C3):**
    - `POST /api/interactions` (`server/routes/conversations.ts:119`) has only `requireAuth`. It must check that the lead belongs to the user's account (unless the user is agency) and refuse Viewers.
    - `PATCH /api/leads/:id` has no field allowlist. Limit non-agency users to the fields the client UI sends (at least `manual_takeover`).
  - **The replying user's `full_name_1` is what the visitor sees.** Thijs's user must have it set (list in `action-required.md`).
- **C5. Page tabs mirror Calls: [chart] Stats · [chat] Chats.** *(My recommendation; Gabriel asked.)*
  - Chats is one list.
  - When the account has both website chat and WhatsApp, a channel filter (All / Website / WhatsApp, with icons) sits above the list.
  - With one channel there is no channel filter.
  - Today's All / Website / WhatsApp tabs (`ChatChannelTabs`) are replaced by this.
- **C6. Chats › Stats** is Home's Website and WhatsApp tabs moved here, with a channel switch inside when both are on. It gets the same visual care as O2: icons, clear tiles.
- **C7. Remove the "List" button** from the Chats header. It does nothing; Chats is always the list.
- **C8. Avatar square:** a small channel badge (website or WhatsApp icon) shows only when the account has both channels on.
- **C9. Row:**
  - The name, with the last message beneath it.
  - Where a row names a website person or sender as "Website", it says "Visitor" instead.
  - The stage pill and "Needs you" marker from P.
- **C10. AI summary.** It sits collapsed at the top of each conversation, for website and WhatsApp alike (`LeadSummaryCard` / `ai_summary`). The builder verifies it is still generated for receptionist chats, in the user's language, and fixes it if not.
- **C11. Filter menu:**
  - "Type" is renamed "Channel", with channel icons.
  - The Tags section is folded by default.
  - Stage-named tags are hidden (P).
  - Fewer options overall: the builder lists what stays.

## D. Calls page

- **D1. Raised rows.** Every row is a raised card matching the Chats rows (`la-camp-card` / `ListCard` mobile tile), not only the active one. This applies to the calls list and the people list.
- **D2. Date groups** (in the account timezone): Today, Yesterday, This week, Last week, then one group per month ("October 2026").
  - Used by the calls list and by the people list (using each person's latest call).
  - Today there are only Today and Earlier (`listOptions.ts` `groupCalls`).
- **D3. Tabs with icons:** [chart] Stats · [users] People, plus [list] All calls for the agency only.
  - Clients get Stats and People.
  - First visit opens Stats; after that, the last tab visited (B9).
  - Live/Demo stays agency-only.
  - Opening a person shows all their calls with summary and transcript.
- **D3a. No 200-call ceiling.** *(My call.)*
  - A person's calls come from a server query per person, not from the latest 200.
  - A call opened by id (E3) is fetched by id when it isn't in the loaded list.
- **D4. The people list gets the same menus as the calls list:**
  - search by name, number or company;
  - filter by outcome and date range;
  - group by date, outcome or none;
  - sort by latest or most calls.
- **D5. Search review.**
  - Number search matches across formats (`0612…`, `+31612…`, `612…`).
  - Search sits behind an icon in the header.
  - Fix the misleading "Rolling 7 days" comment in `voiceCallsApi.ts`.
- **D6. Opening one call from outside** (an email or an in-app notification) goes through `/go/<code>?call=<call_id>` and GoLink (E2/E3). For clients it opens the person with that call expanded.
- **D7. Row text stays readable:** name, number or company, duration, and the outcome pill (P). No truncated pill text at 390px.
- **D8. Calls › Stats** is Home's Phone tab moved here, with icons and clear tiles (same care as O2).

## E. Recap email (engine + CRM renderer)

How it works today (investigated 2026-10-20):
- **Pipeline.** The engine `src/automations/client_alerts/recap.py` runs daily (account 53 at 18:00 Europe/Amsterdam) and gathers its facts in `recap_data.py`. It POSTs them to the CRM `/api/internal/client-alerts/email`. The CRM renders them in `server/clientAlerts/renderEmail.ts` `renderRecap`, with `server/emailComponents.ts`.
- **Recipients.** The only email recipient is leadawaker@gmail.com, and there are no WhatsApp recipients.

The work:
- **E1. The agenda card is empty although appointments exist.** Gabriel sees appointments planned this week, but the card reads "Agenda deze week / Afspraken van vandaag t/m zondag / Nog geen afspraken ingepland".
  - Find out why (compare the agenda query's table, status filters, date window, timezone, account and `is_test` with where those bookings actually live) and fix it.
  - The "past week" figures also skip `is_test` data.
- **E2. Each call row gets an "Open" link: `/go/<recapCode>?call=<call_id>`.**
  - The existing `/go/:code` route already handles login, the return trip and the account check.
  - Changes needed:
    - `summarize` keeps `call_id` (today it drops it);
    - `CallRow` gets a `url`;
    - `GoLink.linkTarget` passes `call` through;
    - the `login.html` return whitelist allows `call`;
    - the server checks that the call belongs to the code's account.
  - The look is the builder's call: the word "Open" with an arrow, or the call icon as the link. It follows the approved client-email design (`project_client_email_design_2026_10_13` memory and its colour rules).
  - The "All N calls" link also goes through `/go/<code>`.
- **E3. The Calls page honours the selected call** handed over by GoLink (`selectVoiceCallId`), as D6 describes.

## F. My profile (phone)

- **F1. My profile is one full-screen page with tabs:** Profile, Notifications, Preferences.
  - Appearance (theme and language) leaves it, because those are More tiles.
  - Preferences keeps timezone and landing page, plus Owner tools for the Owner.
- **F2. Fewer raised separators.** One surface per tab, with sections split by spacing and a small heading, not a stack of raised cards. Inputs are crisp inset.
- **F3. Desktop Settings keeps its look.** Only shared components may change underneath it.
- **F4. The dead Settings link goes** (B3).
  - Root cause: the More overlay only closes on a route change.
  - Any remaining link that points at the current route must close the overlay itself.

## G. Leads page (phone)

- **G1. Search is an icon button** in the topbar. It expands on tap and collapses when empty and blurred (reuse the `MobileListHeader` pattern). Today it is a fixed 180px box in `LeadsTopbarParts.tsx`.
- **G2. The Table / Pipeline switch is always visible on mobile, for clients too.**
  - Today `showTabs={isAgencyUser}` hides it in Pipeline.
  - Clients on mobile open in Table.
  - Desktop shows the switch to clients as well.
- **G3. Pipeline on mobile:**
  - no Compact toggle;
  - empty columns folded by default;
  - no Fold toggle on mobile, unless the builder finds one is needed.
- **G4. Pipeline columns:**
  - Receptionist-only accounts (`hasReactivation` false) see exactly four: New inquiry, Answered, Booked, Done.
  - Accounts with reactivation keep today's columns.
- **G5. Filters.** The two scrolling segment rows become one compact row:
  - a Filter button that opens a bottom sheet with Stage (first), Channel (with icons), Needs reply and Next appointments;
  - removable chips for active filters.
- **G6. The channel shows clearly on lead cards:** the glyph plus a readable label, not 8.5px mono.
- **G7. Leftover agency chrome is hidden for clients:** the campaign column, "+", the gear and the account id.
- **G8. Pills follow P.**

## H. Client guide (Docs)

- **H1. `features/docs/ClientGuide.tsx` gets illustrations drawn as code** (inline SVG/React, tokens, dark-mode safe, translated):
  - a phone mock of the bottom bar with labels;
  - the call flow: call comes in, the receptionist answers, then booked / callback / transferred, and you get an alert and the recap;
  - the Stats / People tabs;
  - a sample recap email card;
  - a map of the Account page;
  - visual "add to home screen" steps.

  Short paragraphs, step cards and icons. No screenshots, because they go stale.
- **H2. The text follows the new names:** Calls, Chats, Account, and Leads under More.
  - It says Thijs can reply under Chats, and is alerted when a chat needs him.
  - Keep the softened claims from Client Mode.

## I. Alerts

- **I1. Chat handoffs alert the client.**
  - When the AI hands a website-chat or WhatsApp conversation to a human, the client (Thijs) is alerted through his own alert channels: the existing client alerts `on_handoff` (email / WhatsApp / CRM).
  - Phone calls are excluded: the receptionist books, takes a callback or transfers by itself.
  - Verify the existing path covers chat handoffs, and fix it if not.
  - Gabriel is not alerted for client handoffs.
- **I2. Gabriel gets a WhatsApp when:**
  - **(a) a client writes in Message Gabriel;**
  - **(b) someone else uses one of his demos:**
    - which demos: the website demo (chat or the "try Sara" voice) and the demo links he sends out (demo pages, voice demo links);
    - how often: one alert per new demo session, not per message;
    - his own tests never alert. Skip when the browser carries his marker (reuse the Traffic page's `?notrack=1` browser marker, and/or a logged-in Owner session in the same browser). Skip calls from his own numbers too. *(The exact detection is the builder's call, but it must cover both web and phone.)*
  - **Sending:** Lead Awaker's WhatsApp Cloud sender with an approved utility template. Reuse one that fits (e.g. `la_lead_needs_reply`, already approved). Otherwise create a new template and list its approval in `action-required.md`.
- **I3. The Notifications tab** (agency) shows WhatsApp (number, on/off per event) instead of the Telegram block.
- **I4. Telegram keeps running** until a real WhatsApp alert has reached Gabriel. Switching it off is then one step listed in `action-required.md`, not done automatically.

## J. Automation logs

- **J1. Gabriel says it "wouldn't open".** It is `OwnerOnly`, and every route uses `requireOwner`, which blocks while viewing as someone.
  - Reproduce as Owner, both normally and while viewing as Manager 53.
  - Make it open for the real logged-in Owner in both cases.
  - Make sure it never appears to a real client.

## K. Message Gabriel (support)

- **K1. Prove it end to end and fix what breaks:**
  1. Manager 53 (view-as or a test client) sends a message.
  2. It shows in Gabriel's Support inbox.
  3. He replies, and the client sees the reply.
  4. The WhatsApp alert (I2a) fires.

  The support tables are empty today: the feature has never been used.

## Order

Thijs's screens first, in case he logs in soon:
1. A, B, P, O, C1, C3, C4 (with its security fixes), C5, D1-D3a, D8, G. Chats appears in the bar together with C3.
2. C2, C6-C11, D4-D7, F, H, E.
3. I, J, K.

## Left to the builder

- the exact sand value;
- the illustration style within the design system;
- the compact call line in threads;
- empty states;
- the demo-test detection method;
- anything marked "builder's call".

## Still on Gabriel (unchanged from Client Mode)

- Thijs's login email (and his full name on the user, see C4).
- Which account 53 leads are tests.
- An engine restart when no call is live.
- Restoring the handoff number to Thijs's +31681764763.
