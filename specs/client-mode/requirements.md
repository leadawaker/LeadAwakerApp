# Requirements: Client Mode (first client login, Robben Rosmalen)

## What & Why

Gabriel is giving his first client a login: **Thijs Robben, Robben Rosmalen (Accounts id 53)**, a premium used-car dealer in 's-Hertogenbosch. Robben is a **receptionist client**: "Frank" answers his phone and his website chat and books showroom visits. He has no reactivation campaign.

An audit on 2026-10-18 (Owner "View as client", Manager on account 53, desktop 1440px and phone 390px, EN and NL) showed the CRM still feels like an agency tool for him:

- Some things are broken: calls on Home open nothing, Edit on mobile doesn't save, the invite lands on "Reactivation", and the logo is unreadable.
- He sees agency language: Admin, Accounts, Setup, Campaigns, account lists, "#53" and internal fields.
- His dashboard is full of Gabriel's test calls, and the Overview and Phone tabs disagree on bookings and callbacks.
- He can't change anything himself, not even who gets his daily recap.
- The guide describes a different product.

**Goal:** the first time Thijs logs in, on his phone or laptop and in Dutch, everything he sees is about his business, every number makes sense, every click goes somewhere, and he knows what to do next.

**Success test:** Gabriel logs in as Thijs ("View as client", Manager on 53) on desktop and phone, in Dutch. He finds no test data, no agency words, no dead buttons and no English. He can open a call, add himself to the recap, change his opening hours, and request a change from Gabriel.

## Decisions (agreed with Gabriel, 2026-10-18)

1. **Test data is hidden from clients, not deleted.** The Owner still sees it.
2. **Clients can edit their alerts and their opening hours.** Recipients, daily recap and instant alerts are theirs. Everything about what Frank knows and says stays with Gabriel, reached through a "Request a change" button.
3. **Onboarding = a welcome and a checklist on Home,** not a modal or a step-by-step wizard. Setup was already done in the onboarding call.
4. **Thijs's login is created but not sent.** He is a Manager on account 53 with Dutch as his language. Gabriel sends the invite himself from Settings › Team.

## Decided by Claude (Gabriel can override while reviewing)

- Client mode applies to **every non-agency login** (Manager and Viewer). The agency view (Owner/Admin) does not change.
- Manager can edit alerts and hours. Viewer stays read-only.
- The client nav is a flat list with no section headings (details in section 3).
- Reply speed ("202 ms") is hidden from clients. It's a technical number with no action attached.
- The Leads page itself is **not** in scope. Another session is rebuilding it (`usePagedLeads`, `LeadsTable.tsx`, the `/api/leads/page` route). It gets its own client-mode review once that lands.

## Goals

### 1. Hide test data from clients

- Add `Leads.is_test boolean NOT NULL DEFAULT false`. Calls follow through `leads_id`, and bookings live on the lead, so this one flag covers leads, calls and bookings.
  - `Voice_Calls.is_test` is added too, because some test calls may have no lead. A call is hidden when its own flag or its lead's flag is set (Claude's call).
- Client views skip test data. This is keyed on the effective role, so the Owner impersonating a client sees the filtered view, while Owner and Admin themselves see everything in lists. **Home and the recap leave test data out for everyone**, because they are business numbers (Claude's call). These need the filter:
  - Home: `liveLeadSql` and `liveCallSql` in `server/storage/homeSql.ts`, which cover every `/api/home/*` endpoint.
  - The voice calls live scope (`scopeWhere` in `server/storage/voiceCalls.ts`). Do NOT put it in `isDemoSql`, or test calls would appear in the Owner's Demo tab.
  - `/api/leads`, which the Calendar uses, and the leads-page scope (`server/storage/leadsPage.ts`), as one small additive line in the other session's file.
  - `/api/leads/:id` and `/api/interactions?leadId=`, which return 404 for a client asking for a test lead.
- **The Owner keeps seeing everything.**
- The Owner gets a "Test data" toggle in the **Voice call detail** on the Voice calls page. It marks that call's lead (Claude's call: most test data is calls, and the lead detail files belong to the leads rebuild).
- A toggle in the lead detail comes later, once the leads rebuild has landed.
- Engine (`/home/gabriel/automations`, read its CLAUDE.md first): the daily recap (`client_alerts/recap_data.py`) and the live-calls alert query (`client_alerts/live_calls.py`) skip `is_test` leads.
- One-off data step: mark Gabriel's test leads on account 53 (see action-required.md).

### 2. Calls open for clients

- `getVoiceCapabilities` (`server/storage/voiceCalls.ts`) returns `live: true` for a client when the account has an enabled client line **or** a live call in the last 90 days, the same rule `homeServices` uses. Then the Voice calls page, its nav item and every Home call row work for Robben.
- Accounts › Phone shows the number that actually answers his calls. Today it says "No number attached yet" because `loadState` (`server/storage/voiceLines.ts`) needs a strict E.164 `phone_number` on an `accounts_id = 53` row. The builder finds out why the lent row (Voice_Numbers id 1) doesn't match and fixes the read, not the row.

### 3. Client nav (desktop nav bar, mobile bottom bar, mobile More page)

- **Desktop, top to bottom:**
  - Home
  - Calls (only when voice capabilities are live)
  - Leads
  - Calendar
  - My receptionist (the Accounts workspace)
  - Billing (only when the account has at least one invoice)
  - Campaigns (only when `useHomeServices().reactivation` is true)
- There are no "Engage / Admin / Setup" headings for clients.
- "My receptionist" becomes "My account" when the account has neither phone nor website service.
- **Mobile bottom bar:** Home, Leads, Calendar, My receptionist (short label), More.
- **Mobile More page:**
  - Calls, Billing and Campaigns, with the same gates as desktop. This fixes today's gap: Billing is missing on mobile.
  - Guide (Docs).
  - "Chat with Gabriel".
- Gates go in `navVisibility.ts` (`NavGate` and `useNavGateContext`) and are shared by RightSidebar, MobileMorePage, CommandPalette and landingPage.
- New i18n keys go in `crm.json` for en, nl and pt.

### 4. My receptionist page (Accounts workspace, client view)

**Desktop:**
- Hide the account list rail, search, filter, sort and group, and the "#count".
- The title is the nav label.

**Identity card:**
- Drop "CLIENT" and "#53" from the subtitle, and the niche (it's in English).
- No logo-upload affordance.
- The header strip shows the real phone number (see goal 2).

**Overview tab:**
- Hide the Onboarding card.
- In Account details, show contact details (email, phone, website, address), timezone, language, description and **opening hours (editable for Manager)**.
- Hide Status, Niche, Daily sends, Opt-out keyword and Tax ID.
- Campaigns panel: hidden unless the account has reactivation; never show "+ New".
- Team panel: show members, hide Invite.
- Contracts and Invoices: shown only when they have rows, with no Add buttons.

**Mobile:**
- The same rules.
- Fix the Edit-that-doesn't-save bug: `OverviewMobile` passes no `readOnly` (`OverviewTab.tsx` ~line 89).
- Put the tab row on its own full-width row under the title (as the agency mobile sheet does), so "Alerts" is never cut off.

**Hours editing:**
- `PATCH /api/accounts/:id` accepts a Manager on his own account, with the body limited to the hours fields (`businessHoursStart`, `businessHoursEnd`, plus open days if that column exists). Anything else gets a 403.
- The existing Cal.diy resync keeps running.

**Alerts tab:**
- `PATCH /api/accounts/:id/alert-settings` and its test send allow a Manager on his own account.
- `canEdit` follows the same rule.

**Request a change:**
- One shared `RequestChangeNote` replaces both read-only banners (`chat/chatAtoms.tsx ReadOnlyNote` and the inline one in `alerts/AlertsTab.tsx`). Every tab a client can't edit gets it: Phone, Chat, and Integrations if it's read-only.
- Its button opens the founder chat with a prefilled draft naming the tab. To support that, `open-founder-chat` accepts `detail.draft`, CrmShell stores it, and `SupportChatWidget` seeds its input.

**Integrations tab:**
- The Booking page badge must not say "Connected" while its own text says it needs a calendar to work.

### 5. Home

- **Consistent numbers:**
  - Bookings everywhere uses the Overview definition (bookings on live leads in the period). The Phone tab's Booked tile is that number filtered to phone.
  - Callbacks everywhere uses `needsCallbackSql`.
  - The Phone outcome list is worked out in this order: booked, transferred, callback, hung up, then everything else.
  - "Other" is renamed to say what it is: calls where Frank answered the caller's questions ("Questions answered").
  - Old rows with a null outcome get the same derived outcome the Voice calls page gives them.
  - Bookings and callbacks match between Overview and Phone for any period.
- **Phone tab:**
  - The out-of-hours stat gets a standalone label ("Calls outside office hours", then 43%).
  - Reply speed is hidden for non-agency users.
- **Layout:**
  - "Conversations per day" and "Calls per day" stop stretching to the height of the list beside them (`items-start`, or let the chart fill).
  - On mobile, the Overview/Phone/Website tab pills are a readable, tappable size (`.la-seg` below 768px or `.la-seg--lg`; don't touch the desktop size).
- **Recent activity and Recent calls:** each call row shows its one-line call summary when one exists, falling back to today's label.
- **Welcome and checklist** (goal 8) sit at the top of Home for client users.

### 6. Calendar

- **Desktop topbar:** the month pills never overlap the date title or the arrows at any width from 1024px up. They go into normal flow, or hide below a width.
- **Mobile:** opens in the List view by default. "list" becomes a valid stored value (`usePersistedState` in `pages/Calendar.tsx`), and the default is list below 768px.
- **For clients:**
  - Hide the lead-score ring (agenda card and detail).
  - The search placeholder says "Search by name".
  - Hide the group/sort-by-campaign options.

### 7. Guide (Docs)

- New client guide component (e.g. `client/src/features/docs/ClientGuide.tsx`) with a new `docs.clientGuide.*` key tree in en, nl and pt. The old `ClientGuide` in `Docs.tsx` is replaced, and `Docs.tsx` shrinks.
- Written for a receptionist client, using his receptionist's name from the account's agent name ("your receptionist" if empty). Sections:
  1. Welcome: what you'll find where (Home, Calls, Leads, Calendar, My receptionist).
  2. How {{name}} answers your phone: calls, transfers, callbacks, bookings and visits.
  3. Website chat.
  4. Your daily recap and alerts, including adding yourself.
  5. Calendar: bookings and busy blocks.
  6. What you can change, and how to request other changes.
  7. Put the CRM on your phone.
  8. FAQ.
- The current reactivation sections (campaigns, lead score, conversations) only appear when the account has reactivation.
- Fix the raw key on the founder button: `tc("messageFounder")` → `tc("sidebar.messageFounder")`.
- The Owner/Admin operator manual stays as it is.

### 8. Welcome and Getting-started checklist

- **One card at the top of Home** for non-agency users (and the Owner while impersonating a client, so Gabriel can test). It is not a Dialog: UI_STANDARDS allows Dialog only for destructive confirmations.
- **The welcome part:**
  - "Welcome, {{firstName}}. {{agentName}} answers for {{company}}."
  - Two short lines on where calls, chats and bookings show up.
  - A link to the guide.
- **Checklist items.** Each one navigates when clicked, and each ticks itself off:
  1. **Check your business details:** ticks when he has opened My receptionist.
  2. **Add yourself to the recap and alerts:** ticks when the account's alert recipients include his email or phone.
  3. **Open your first call or chat:** ticks when he has opened a voice call or a lead conversation.
  4. **Put the CRM on your phone:**
     - Shows iOS steps (Share › Add to Home Screen) and Android steps (menu › Install app).
     - Ticks when the app runs in standalone display mode, or when he taps "Done".
- **The card can be closed.** It disappears for good once all items are done, or when closed.
- **State** lives in `Users.preferences` under `onboarding` (`{ dismissed, visited: { receptionist, call } , installed }`), saved through the existing self-save (`patchPreferences`, `PATCH /api/users/:id` `preferencesPatch`).
- **Install polish:** `public/manifest.json` gets the wine `theme_color` (matching index.html), plus `id` and `scope`.

### 9. First login, language and logo

- `AcceptInvite.tsx` lands on `resolveLandingPath()` (Home), not `/platform/campaigns`. Remove the stale "tour will start automatically" comment.
- **The saved language wins:** on session load, if the user's preferences hold `language` or `lang` and `leadawaker_lang` is not set, set it before rendering (next to `hydrateLandingPage`).
- **Dutch leftovers** a client sees get translated:
  - Status values ("Active").
  - The language name ("Dutch").
  - 24-hour times in NL and PT.
  - The "Skip to main content" link.
  - Anything else found on the client screens in NL.
- **Logo:** `logo-v2-light.svg` stays deleted (Gabriel, 2026-10-12: "must never come back"). In the light-theme nav bar (`RightSidebar.tsx` ~458), put `logo-v2.svg` on a sand bar, the way `public/login.html` and `NumberDocs.tsx` already do, so the white "LEAD" letters read. Use tokens, and don't redraw or recolour the logo. Dark theme stays as it is.

### 10. Thijs's login

- `POST /api/users/invite` accepts `sendEmail: false`. The user row is created (status Invited, `preferences.lang = "nl"`) without an email.
- Create: Thijs Robben, role Manager, account 53, Dutch, with the email Gabriel confirms (see action-required.md).
- Gabriel later uses Resend in Settings › Team. It makes a new 72h token and sends the Dutch email.

## Non-goals

- The Leads page (being rebuilt in another session). Calendar and Home only link to it.
- A modal or full-screen wizard, product tours, tooltips.
- Letting clients edit knowledge, greeting, behaviour, voice or campaigns.
- Clients inviting colleagues.
- Billing page redesign. It only appears once an invoice exists.
- Fixing the impersonation gaps (route guards reading localStorage role). Real client logins are unaffected.
- Auto-marking Gabriel's future test calls as test. He uses the Owner toggle.
- Home load time (5 to 9 s of "LOADING" on the Pi). Measure it once and note the result in action-required.md; only fix it if one query is plainly the cause.

## Anti-goals (would be a failure even if it "works")

- Any change to what the Owner/Admin sees, other than the logo, the Home numbers fix and the new Owner test toggle.
- A client being able to change any account or receptionist setting beyond hours and alerts, or see another account's data. Day-to-day actions a Manager can already do stay as they are (Claude's call), and the guide describes them: replying to a lead, rescheduling or cancelling a booking in the Calendar, adding busy blocks.
- Test data deleted or hidden from the Owner.
- English text on a Dutch client screen.
- Desktop layout changes made in the name of mobile. Mobile changes stay additive (`md:` / `max-md:`), per the leadawaker-dev rules.

## Constraints

- **Concurrent sessions:** RightSidebar, AccountsWorkspace, accounts OverviewTab, AlertsTab, AccountsTopBar, IdentityCard, IntegrationsPanel, HomePage, PhoneTab, the calendar files, the design-system/components CSS and the crm/accounts locale files all carry uncommitted work from other sessions.
  - Make small targeted Edits.
  - Never rewrite those files, revert or format them, or commit anyone else's hunks.
  - Don't touch the leads WIP files. The exception is small additive `is_test` filter lines in `server/storage/leadsPage.ts` and `server/routes/leads.ts` (`/api/leads`, `/api/leads/:id`).
- **Platform rules:**
  - No `tsc` unless Gabriel asks.
  - The app runs under pm2 with tsx watch.
  - Max 4 parallel agents.
  - Watch `pm2 logs leadawaker` after server edits.
- **DB change:** add the column with a small `pg` script (db:push needs a TTY), following the `migrate-*.js` pattern in the repo root.
- **Design:**
  - i18n for every string in en, nl and pt (Brazilian PT).
  - Use tokens; no raw hex or `bg-white`.
  - No `transition-all`.
  - Use the primitives in `components/crm/primitives/`.
  - Keep files under ~500 lines.
- **Verification:** Owner "View as client" (Manager, account 53) plus playwright at 1440×900 and 390×844, in EN and NL. Close browsers afterwards.

## Left to the builder

- The Owner/Admin operator manual in Docs is untouched. Only the client guide changes.
- Exact component split, file names and i18n key names.
- Exact Dutch and Portuguese wording (natural, not literal; PT is Brazilian).
- How the "opened a call" and "opened My receptionist" visits are recorded (a preferences patch on first visit is fine).
- How to fix the calendar pill overlap (in-flow layout or hide below a width).
- Whether Recent activity summaries come from the existing call summary field or the recap text, whichever already exists per call.
