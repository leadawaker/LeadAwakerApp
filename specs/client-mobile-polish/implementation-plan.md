# Client mobile polish: implementation plan

Written 2026-10-20 from `requirements.md` (same folder) and `specs/client-mode/`.
Gabriel approved every "my call" / recommendation in the requirements, and decided the sand:
**a light sand, clearly darker than today's ground, so the white neumorphic highlights stay visible.**

Status legend: [x] done on `feat/client-mobile-polish` · [ ] not started · [~] partly done (see note).

## Round 1 (this branch): Thijs's screens

### Step 1. Colours (A1, A2, A3, A5)

Files: `client/src/styles/variables.css`, `client/src/styles/components.css`.

- [x] New tokens, defined once in `variables.css`:
  - `--chrome-deep` light: `hsl(38 30% 84%)` (≈ `#DDD3C3`). Page ground is 98.5% L and today's
    nav rail is 90% L, so 84% L is clearly darker, still light enough for the `#FFF` highlight of
    `--sh-raised-crisp` to read.
  - `--chrome-deep-ink` light: `#5A5244` (muted ink on the sand, 5.3:1, passes AA for 10px labels;
    `--mute` would only reach ~4:1 there).
  - `--on-wine`: bone `#FBF8F2`, for icon + label on the filled wine pill.
  - Dark mode: `--chrome-deep: hsl(30 12% 11%)` (one step deeper than today's 14% bottom bar,
    never lighter), `--chrome-deep-ink: var(--mute)`, `--on-wine` unchanged.
- [x] Utility classes in `components.css`, all scoped to `max-width: 767px` so desktop is untouched:
  `.la-m-chrome` (header/bar background), `.la-m-seg` (bone raised segments, wine text on the
  active one), `.la-hit` (36px visual, 44px tap target), `.la-m-crisp` (inset fields crisp).
- [x] Apply: `MobileListHeader`, Home header, More page (topbar + body), bottom bar,
  `MobileTabSeg`, `AccountsWorkspace` mobile header, Settings mobile header.

### Step 2. Navigation (B1-B8, F4)

Files: `navGates.ts` (+ test), `useClientNavFacts.ts`, `RightSidebar.tsx`, `MobileMorePage.tsx`,
new `navIcons.ts`, `pages/app.tsx`, `CommandPalette.tsx`, locales `crm.json`.

- [x] B1: `sidebar.voiceCalls` = "Calls" / "Gesprekken" / "Chamadas"; Calls page title follows.
  `labelKey: "Voice calls"` (internal filter key) is left alone so the section filter keeps working.
- [x] B4: `sidebar.myReceptionist` and `myReceptionistShort` = Account / Account / Conta.
- [x] Facts: `ClientNavFacts.hasChats = services.website || services.whatsapp`.
- [x] B2: client bottom bar = Home, Calls (voiceLive), Calendar, Chats (hasChats) else Leads, More.
- [x] B5: client desktop nav = Home, Calls, Chats, Leads, Calendar, Account, Billing, Campaigns.
- [x] B3: client More = logo, Account, Leads (when not in the bar), Billing, Campaigns, Help
  (Documentation, Message Gabriel), tiles (Language, Theme, Alerts), bottom panel (My profile,
  Logout). Settings row removed.
- [x] B6: agency bottom bar = Home, Calls (voice caps), Chats, Tasks, More.
- [x] B7: agency More: logo on top, Campaigns removed, Calendar added, "Calls" label.
- [x] B8: one shared icon map (`navIcons.ts`) for RightSidebar + More; pure rules in `navGates.ts`
  with node tests (`npx tsx --test client/src/components/crm/navGates.test.ts`).
- [x] F4: any More link to the current route closes the overlay itself.
- [x] B9: `lastTab.ts` stores the last tab per user and per page (`la.lastTab.<userId>.<page>`),
  default Stats. Used by Calls and Chats.

### Step 3. One status system (P)

Files: new `client/src/components/crm/status/` (`statusPill.ts` pure + test, `StatusPill.tsx`),
`features/voiceCalls/components/OutcomePill.tsx`, lead list cards, locales `common.json`.

- [x] Call outcome (exactly one): Booked, Callback, Transferred, Answered, Hung up.
  Mapping: `booked → Booked`, `callback → Callback`, `transferred → Transferred`,
  `hung_up → Hung up`, `other → Answered` (Frank answered the questions).
- [x] Person stage (exactly one): New inquiry (`rx_new`), Answered (`rx_answered`),
  Booked (`Booked`), Done (`rx_done`). DBR stages keep their own labels for reactivation leads.
- [x] "Needs you" marker: callback asked for (calls) or `needs_reply` (chats).
- [x] One `StatusPill` with token colours (`--stage-*`), used by calls rows, people rows and chat rows.
- [x] Stage-named tags hidden everywhere (`isStageTag`), Lead Tags hidden on client lists.
- [ ] Recap email pills (Round 2, E).

### Step 4. Home is the overview (O1-O3)

Files: `features/home/pages/HomePage.tsx`, `OverviewTab.tsx`, new `features/home/stats/StatsPanel.tsx`,
`WelcomeChecklistCard.tsx`, locales `home.json`.

- [x] O1: `visibleTabs` drops phone / website / whatsapp (they live in Calls › Stats and Chats › Stats).
  Old `?tab=phone` links fall back to Overview. The "by channel" rows link to the new Stats tabs.
- [x] `StatsPanel` = period select + the moved tab body (PhoneTab, or WebsiteTab/WhatsappTab with a
  channel switch when both are on), lazy-loaded, reusable from Calls and Chats.
- [x] O2: Recent activity rows get a coloured icon per event type (call, chat, booking, callback,
  transfer, follow-up) via a new `icon` slot on `RowList`.
- [x] O3: welcome checklist uses Calls / Chats / Account and points figures to the Stats tabs.

### Step 5. Calls page (D1-D3a, D8)

Files: `features/voiceCalls/**`, `server/routes/voice-calls.ts`, `server/storage/voiceCalls.ts`.

- [x] D3: tabs with icons: [chart] Stats · [users] People · [list] All calls (agency only).
  Clients get Stats and People. Live/Demo stays Owner-only. First visit opens Stats (B9).
- [x] D8: Stats tab renders `StatsPanel` with the phone body.
- [x] D1: every calls/people row is a raised card (`ListCard`-matching tokens), not only the active one.
- [x] D2: date groups in the account timezone: Today, Yesterday, This week, Last week, then one
  group per month. Pure `dateGroups.ts` + node test. People are grouped by their latest call.
- [x] D3a: `GET /api/voice-calls?leadId=` / `?number=` returns one person's calls (no 200 cap),
  `CallerDetail` uses it. A deep-linked call (`selected-voice-call-id`) opens the person on
  People for clients, the call on All calls for the agency, and is fetched by id if not loaded.
- [x] D5 (small part): the misleading "Rolling 7 days" comment is fixed. Search behind an icon was
  already the case on mobile.

### Step 6. Chats (C1, C3, C4, C5, C7)

Files: `server/storage/leadsPage.ts`, `server/routes/leadsPage.ts`, `server/routes/conversations.ts`,
`server/routes/leads.ts`, new `server/routes/leadWriteAccess.ts` (+ test), `pages/app.tsx`,
`features/leads/**` (Chats mode), `ConversationWidget.tsx`.

- [x] C1: `chatsOnly=1` → `d.chat_channel_eff IS NOT NULL` in the base filter, so the list and every
  count agree. Chats mode always sends it.
- [x] C3: `/platform/chat` opens for clients (redirect removed); on Chats a client sees the real
  conversation, not the summary card.
- [x] C4 security:
  - `POST /api/interactions`: lead must exist and belong to the effective account (agency excepted);
    the interaction's `accountsId` is forced to the lead's; Viewers (and Owner viewing as Viewer)
    get 403.
  - `PATCH /api/leads/:id`: effective account check (impersonation aware); non-agency users are
    limited to `firstName, lastName, phone, email, notes, conversionStatus, pipelineStage,
    manualTakeover, teamMembers`; anything else is 403. Viewers get 403.
  - Pure rules in `leadWriteAccess.ts` with node tests.
- [x] C4 composer: `ConversationWidget` saves `manual_takeover: true` before sending (the "pause the
  AI" promise now holds), strings go through i18n, voice memo hidden for clients, and for clients
  the reply box only shows when the person is reachable (`web:` / `web-demo:` identifier, or the
  account has its own WhatsApp sender, new `GET /api/whatsapp-senders/has-own`); otherwise a short
  note says why.
- [x] C5: tabs [chart] Stats · [chat] Chats; Stats renders `StatsPanel` (website/whatsapp).
  The All/Website/WhatsApp tabs become a channel filter above the list, only when both channels are on.
- [x] C7: the dead "List" button is gone from the Chats header.

### Step 7. Leads (G1-G8)

Files: `LeadsTopbarParts.tsx`, `LeadsTableTopbar.tsx`, `LeadsPipelineTopbar.tsx`, `LeadsTable.tsx`,
`LeadsKanban.tsx`, `LeadsQuickFilters.tsx`, lead cards.

- [x] G1: `TopbarSearch` collapses to an icon button on mobile, expands on tap, collapses when empty
  and blurred.
- [x] G2: Table / Pipeline switch visible for clients (desktop and mobile); clients on mobile open in Table.
- [x] G3: mobile pipeline: no Compact toggle, no Fold toggle, empty columns folded by default.
- [x] G4: receptionist-only accounts see exactly New inquiry, Answered, Booked, Done.
- [x] G5: on mobile the two segment rows become one row: a Filter button (bottom sheet with Stage,
  Channel with icons, Needs reply, Next appointments) and removable chips.
- [x] G6: channel shows as glyph + readable label on lead cards.
- [x] G7: campaign column, "+", gear and account id hidden for clients.
- [x] G8: pills follow Step 3.

### Verification (Round 1)

- Unit tests only (no live app, no tsc, per instructions):
  `npx tsx --test client/src/components/crm/navGates.test.ts client/src/components/crm/status/statusPill.test.ts client/src/features/voiceCalls/dateGroups.test.ts server/routes/leadWriteAccess.test.ts client/src/lib/lastTab.test.ts`
- `npx vite build` must pass (it is the Vercel build).
- Gabriel's visual check on app.leadawaker.com (Owner, then "view as" Manager 53, 390px, NL, light + dark):
  see `action-required.md`.

## Round 2 (not on this branch)

C2 call lines in threads, C6 Stats polish, C8-C11 rows/filters/summary, D4-D7, F (My profile), H (guide
illustrations), E (recap email agenda + Open links; touches the Python engine).

## Round 3 (not on this branch)

I (alerts, WhatsApp to Gabriel, Notifications tab), J (Automation logs while viewing as), K (Message Gabriel
end to end). These touch the Python engine and the Pi.
