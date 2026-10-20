# Client Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A client login (Thijs Robben, Manager on account 53) sees a clean, Dutch, working CRM about his own business: no test data, no agency chrome, editable alerts and hours, a welcome checklist and a receptionist guide.

**Architecture:**
- Server: test data is flagged on `Leads.is_test` and `Voice_Calls.is_test`, and filtered in the existing SQL fragments and scoped routes. Client permissions come from one pure module (`clientEditAccess.ts`).
- Client: the client UI branches on `isAgencyUser` from `useWorkspace`. Nav decisions live in one pure module (`navGates.ts`). The agency paths are left as they are.

**Tech Stack:** React + Vite + react-i18next, Express + Drizzle + PostgreSQL (schema `p2mxx34fvbf3ll6`), node:test via `npx tsx --test`, Python engine at `/home/gabriel/automations` (pytest).

**Spec:** `specs/client-mode/requirements.md` (read it first; this plan argues from it). Gabriel's manual steps: `specs/client-mode/action-required.md`.

## Global Constraints

**Working tree and process**
- The working tree carries many sessions' uncommitted work. Make small targeted Edits only.
- Never reformat, rewrite or revert a file you did not create.
- Do NOT commit; Gabriel commits.
- Never run `tsc`. pm2 + tsx watch reloads on save. After any server edit, check `pm2 logs leadawaker --lines 20 --nostream --err`.
- Don't touch the leads WIP files (`usePagedLeads.ts`, `LeadsTable.tsx`, the lead detail components), except the additive `is_test` lines named in Task 1.

**Copy and i18n**
- Every user-facing string goes through i18n in `client/src/locales/{en,nl,pt}/`. PT is Brazilian.
- Dutch copy is natural, not literal. The receptionist is "Frank" only through data (the account's agent name), never hardcoded.

**Styling and components**
- Use tokens only: no raw hex in components, no `bg-white`/`text-black`, no `transition-all`.
- 36px icon buttons via `IconBtn`.
- Primitives from `components/crm/primitives/`.
- No Dialog for anything except destructive confirmations.
- Mobile changes are additive (`max-md:` / `@media (max-width: 767px)`). The desktop layout stays the same unless the spec says otherwise.
- Keep files under ~500 lines; split when a file you create would pass that.

**Roles**
- Client mode = `!isAgencyUser` (`client/src/hooks/useWorkspace.ts`).
- Manager may edit hours and alerts. Viewer is read-only.
- The Owner impersonating a client sees client mode.

**Verification**
- Owner "View as client" via `POST /api/auth/impersonate {role:"Manager", accountId:53}` on `https://app.leadawaker.com` (secure cookie, so not localhost), plus playwright-cli at 1440×900 and 390×844, in EN and NL (`localStorage.leadawaker_lang`).
- Always `playwright-cli close` afterwards.

**Engine**
- Read `/home/gabriel/automations/CLAUDE.md` before editing.
- Never restart `leadawaker-engine` while a call may be live: real Robben callers are on the line. Leave the restart to Gabriel (action-required).

## Review Focus

1. **The Owner impersonating Viewer on 53** must get no Edit for hours and no editable alerts, on both server (403) and UI. Pin it in Task 4's `accountEditLevel` tests.
2. **A client sending extra fields** in the hours PATCH (`status`, `maxDailySends`, `accountsId`) gets a 403, and nothing is written. Pin it in Task 4's `pickClientAccountPatch` tests.
3. **A client deep-linking to a test lead or call** (`/api/leads/:id`, `/api/voice-calls/:id`, `/api/interactions?leadId=`) gets a 404. The Owner gets 200 for the same ids. Pin it in Task 1's route check.
4. **A Dutch client with an empty `leadawaker_lang`** after login lands in Dutch. A user who already picked a language keeps it. Pin it in Task 11's `languageFromPrefs` tests and the hydrate rule.
5. **Alert recipients matching** ignores case and spaces in emails, and formatting in phone numbers (`+31 6 81 76 47 63` vs `+31681764763`). Pin it in Task 9's `buildChecklist` tests.

---

### Task 1: Test-data flags and filters, plus the Owner toggle

**Files:**
- Create: `migrate-add-is-test-flags.js` (repo root, same pattern as the other `migrate-*.js`, `pg` client, schema `p2mxx34fvbf3ll6`)
- Modify:
  - `shared/schema.ts` (leads table and voice calls table)
  - `server/storage/homeSql.ts` (`liveLeadSql`, `liveCallSql`)
  - `server/routes/voiceCallsAccess.ts`
  - `server/storage/voiceCalls.ts` (live scope where-clause, item shape, new setter)
  - `server/routes/voice-calls.ts`
  - `server/routes/leads.ts` (`GET /api/leads`, `GET /api/leads/:id`: additive filter only)
  - `server/storage/leadsPage.ts` (scope: additive filter only)
  - the interactions route that serves `GET /api/interactions?leadId=`
  - `client/src/features/voiceCalls/components/VoiceCallDetail.tsx` (or the header/sidebar it renders)
  - `client/src/features/voiceCalls/api/voiceCallsApi.ts`
  - `client/src/locales/{en,nl,pt}/` (voice calls namespace)
- Test: `server/routes/voiceCallsAccess.test.ts` (extend)

**Interfaces:**
- Produces:
  - Columns `is_test boolean NOT NULL DEFAULT false` on `"Leads"` and `"Voice_Calls"`.
  - Drizzle `isTest` on both tables.
  - `hidesTestData(access: VoiceAccess): boolean`.
  - `storage.setCallTestFlag(callId: string, isTest: boolean): Promise<boolean>`, which sets the call's flag and its lead's flag when `leads_id` is set.
  - `PATCH /api/voice-calls/:callId/test` with body `{ isTest: boolean }`. Owner only (`access.isOwner`), otherwise 403.
  - The voice call item gains `isTest: boolean`.

- [ ] **Step 1: Write the failing test.** In `voiceCallsAccess.test.ts`, add the test `"test data is hidden from clients and impersonation, never from agency"`. Assert `hidesTestData` returns:
  - false for Owner (`role "Owner", accountsId 1`);
  - false for `role "Admin"`;
  - true for `role "Manager", accountsId 53`;
  - true for Owner with `impersonatedAccountId 53`;
  - false for Owner with `impersonatedRole "Admin"`.
- [ ] **Step 2: Run it and confirm it fails.** `npx tsx --test server/routes/voiceCallsAccess.test.ts` should FAIL with `hidesTestData` not exported.
- [ ] **Step 3: Implement `hidesTestData(access: VoiceAccess): boolean`** as `!access.isAgency` in `voiceCallsAccess.ts`.
- [ ] **Step 4: Run it and confirm it passes.** Same command; PASS.
- [ ] **Step 5: Write and run the migration.** `node --env-file=.env migrate-add-is-test-flags.js` should print both columns added (`ADD COLUMN IF NOT EXISTS`, so it is idempotent). Add `isTest: boolean("is_test").notNull().default(false)` to both Drizzle tables.
- [ ] **Step 6: Filter Home for everyone.**
  - `liveLeadSql` gets `AND COALESCE(l.is_test, false) = false`.
  - `liveCallSql` gets `AND COALESCE(vc.is_test, false) = false`, and `dl.is_test = true` added to the existing lead `NOT EXISTS` condition.
- [ ] **Step 7: Filter the client-facing lists when `hidesTestData`.**
  - Voice calls live scope, list, stats and single call: a call is hidden when `vc.is_test` or its lead's `is_test` is set.
  - `/api/leads` list: excludes `is_test`.
  - `/api/leads/:id`: 404.
  - `/api/leads/page` scope: excludes.
  - `/api/interactions?leadId=` for a test lead: 404.
  - For leads routes that use `scopeToAccount` rather than `VoiceAccess`, build the access with `resolveVoiceAccess` from `req.user` and `req.session.impersonation`, as `voice-calls.ts accessOf` does.
- [ ] **Step 8: Add the setter and the route.** Implement `setCallTestFlag` and `PATCH /api/voice-calls/:callId/test`, and return `isTest` on items. Check with `pm2 logs leadawaker --lines 20 --nostream --err`: no new errors.
- [ ] **Step 9: Add the Owner toggle UI.**
  - In the voice call detail, show a small "Test data" switch only when the viewer is Owner and not impersonating.
  - It calls the PATCH and invalidates the call list and detail queries.
  - Label keys: en "Test data (hidden from the client)", plus nl and pt.
- [ ] **Step 10: Verify.**
  - As Owner, mark one call as test.
  - Impersonate Manager 53. The call is gone from Calls and Home, and `GET /api/voice-calls/<id>` returns 404.
  - Stop impersonating. It's visible again in Calls.
  - Unmark it.

### Task 2: Calls open for clients, and the real phone number

**Files:**
- Modify:
  - `server/storage/voiceCalls.ts` (`getVoiceCapabilities`)
  - `server/storage/voiceCallsSql.ts` (if a helper is added)
  - `server/storage/voiceLines.ts` (`loadState` number read)
- Test: the existing phone normaliser test `shared/phoneE164.test.ts`, only if the read fix uses that helper.

**Interfaces:**
- Produces: `getVoiceCapabilities(access)` returns `live: true` for a client when the account has an enabled client line OR at least one call matching `liveCallSql` in the last 90 days, the same rule as `server/storage/homeServices.ts`.

- [ ] **Step 1: Update the capabilities rule** as above. Reuse `liveCallSql` and the `homeServices` 90-day window rather than copying them.
- [ ] **Step 2: Find out why the Phone tab misses the line.** Find why `loadState` misses Voice_Numbers id 1 for account 53: read its `phone_number` format with a single-row config select, not a lead or call read. Fix the read so it accepts that format, normalising in SQL or JS with the existing E.164 helper. Do not edit the row.
- [ ] **Step 3: Verify.** Impersonate Manager 53.
  - `GET /api/voice-calls/capabilities` returns `{"live":true,"demo":false}`.
  - The nav shows Calls.
  - A Home → Phone → Recent calls row opens that call's detail.
  - Accounts › Phone and the header strip show the number, not "No number attached yet".

### Task 3: Home numbers, labels and layout

**Files:**
- Create:
  - `shared/homeOutcome.ts`
  - `shared/homeOutcome.test.ts`
- Modify:
  - `server/storage/homePhone.ts`
  - `server/storage/homeOverview.ts`
  - `server/storage/homeSql.ts` (shared bookings fragment, if extracted)
  - `client/src/features/home/tabs/PhoneTab.tsx`
  - `client/src/features/home/tabs/OverviewTab.tsx` (lines ~95 and ~110)
  - `client/src/features/home/pages/HomePage.tsx` (tab pill row ~105)
  - `client/src/styles/design-system.css` (`.la-seg` block ~574-605)
  - the home row components/types for the call headline
  - `client/src/locales/{en,nl,pt}/home.json`

**Interfaces:**
- Consumes: `deriveOutcome` from `shared/voiceOutcome.ts`, which the Voice calls page already uses for null-outcome rows.
- Produces:
  - `HomeOutcome = "booked" | "transferred" | "callback" | "hung_up" | "answered"`.
  - `classifyHomeOutcome(row: { outcome: string | null; transferOutcome: string | null; bookedIso: string | null; intents: string[]; durationSeconds: number | null; hasSummary: boolean; abandoned: boolean }): HomeOutcome`.
  - CSS modifier `.la-seg--touch`, which only changes anything below 768px.

- [ ] **Step 1: Write the failing tests.** In `shared/homeOutcome.test.ts`:
  - "booked wins over everything": `outcome "booked"` plus `transferOutcome "failed"` gives `"booked"`.
  - "a failed transfer is a callback".
  - "a leave_message intent is a callback".
  - "outcome callback is a callback".
  - "hung up stays hung up".
  - "a null-outcome legacy row gets the derived outcome": use the same inputs as an existing `voiceOutcome.test.ts` case and expect its result mapped. `"other"` maps to `"answered"`.
  - "a plain answered call is answered".
- [ ] **Step 2: Run them and confirm they fail.** `npx tsx --test shared/homeOutcome.test.ts` should FAIL with the module not found.
- [ ] **Step 3: Implement `classifyHomeOutcome`.** The order is booked, then transferred (`transferOutcome === "completed"` or `outcome === "transferred"`), then callback (the `needsCallbackSql` rules in JS), then hung_up, then answered. Null `outcome` goes through `deriveOutcome` first.
- [ ] **Step 4: Run them and confirm they pass.** Same command; PASS.
- [ ] **Step 5: Unify the server numbers.**
  - Phone's Booked tile uses the Overview bookings definition filtered to phone channel (`homeOverview.ts` already groups by `booking_channel`). Extract it once and call it from both.
  - The Phone callback tile uses `needsCallbackSql`.
  - The outcome list classifies the period's rows in JS with `classifyHomeOutcome`.
  - The key `other` becomes `answered`.
  - Recent calls and Recent activity rows gain `headline: string | null`, the one-line summary the Voice calls inbox already shows per call.
- [ ] **Step 6: Update the client.**
  - The out-of-hours stat uses a new standalone label key `phone.outOfHoursLabel` (en "Calls outside office hours").
  - The reply-speed card is hidden when `!isAgencyUser`.
  - The outcome label is `answered` (en "Questions answered").
  - Rows show `headline` as the sub line when present.
  - `items-stretch` becomes `items-start` on the three grids.
  - The Home tab row gets `la-seg--touch`, and `.la-seg--touch .la-seg-btn` under `@media (max-width: 767px)` gets 11px text and at least 36px height.
- [ ] **Step 7: Verify.**
  - Owner on account 53, period "This month": Overview bookings equals the Phone Booked tile, and Overview callbacks equals the Phone callback tile.
  - At 1440 there's no tall empty chart card.
  - At 390 the tabs are readable.
  - In NL every new label is Dutch.

### Task 4: Client edits (hours, alerts) and "Request a change"

**Files:**
- Create:
  - `server/routes/clientEditAccess.ts`
  - `server/routes/clientEditAccess.test.ts`
  - `client/src/lib/founderChat.ts`
  - `client/src/components/crm/RequestChangeNote.tsx`
- Modify:
  - `server/routes/accounts.ts` (PATCH ~119)
  - `server/routes/clientAlerts.ts` (GET `canEdit` ~150, PATCH ~153, test send ~167)
  - `client/src/components/crm/CrmShell.tsx` (listener ~113-123, widget mount ~349-375)
  - `client/src/components/crm/SupportChatWidget.tsx` (input state ~116)
  - `client/src/features/accounts/pages/AccountsPage.tsx` (~148-150)
  - `client/src/features/accounts/components/AccountDetailsPanel.tsx`
  - `client/src/features/accounts/components/workspace/alerts/AlertsTab.tsx` (banner ~77-81)
  - `client/src/features/accounts/components/workspace/chat/ChatTab.tsx` (~128) and `chat/chatAtoms.tsx` (`ReadOnlyNote`)
  - the Voice/Phone tab and the Integrations panel (read-only note)
  - `client/src/locales/{en,nl,pt}/crm.json`

**Interfaces:**
- Produces:
  - `type EditLevel = "agency" | "client" | "none"`.
  - `accountEditLevel(input: { role: string; accountsId: number | null; impersonatedRole?: string | null; impersonatedAccountId?: number | null }, targetAccountId: number): EditLevel`.
  - `CLIENT_ACCOUNT_FIELDS = ["businessHoursStart", "businessHoursEnd", "openDays"] as const`.
  - `pickClientAccountPatch(body: Record<string, unknown>): { ok: true; patch: Record<string, unknown> } | { ok: false; disallowed: string[] }`.
  - `openFounderChat(draft?: string): void`, which dispatches `open-founder-chat` with `detail.draft`.
  - `<RequestChangeNote area={string} />`.

- [ ] **Step 1: Write the failing tests** in `clientEditAccess.test.ts`:
  - Owner on 53 gives `"agency"`.
  - Admin gives `"agency"`.
  - Manager 53 on 53 gives `"client"`.
  - Manager 53 on 52 gives `"none"`.
  - Viewer 53 on 53 gives `"none"`.
  - Owner impersonating Manager 53 on 53 gives `"client"`.
  - Owner impersonating Viewer 53 gives `"none"`.
  - Owner impersonating Admin gives `"agency"`.
  - `pickClientAccountPatch({ businessHoursStart: "09:00", businessHoursEnd: "18:00" })` is ok with both keys.
  - `pickClientAccountPatch({ businessHoursStart: "09:00", status: "Inactive", maxDailySends: 9 })` gives `{ ok: false, disallowed: ["status", "maxDailySends"] }`.
  - `pickClientAccountPatch({})` gives `{ ok: false, disallowed: [] }` (nothing to save).
- [ ] **Step 2: Run them and confirm they fail.** `npx tsx --test server/routes/clientEditAccess.test.ts` should FAIL with the module not found.
- [ ] **Step 3: Implement both functions.** `impersonatedRole` wins over `role` when present. `accountsId === 1` counts as agency.
- [ ] **Step 4: Run them and confirm they pass.** Same command; PASS.
- [ ] **Step 5: Update the server routes.**
  - `PATCH /api/accounts/:id` moves from `requireAgency` to `requireAuth` plus `accountEditLevel`.
  - `"none"` gets a 403.
  - `"client"` goes through `pickClientAccountPatch`, applied after `fromDbKeys`, and gets a 403 with `disallowed`.
  - `"agency"` is unchanged.
  - The alert-settings PATCH and test send allow any level except `"none"`.
  - GET `canEdit` is `level !== "none"`.
  - Check the pm2 error log.
- [ ] **Step 6: Update the client.**
  - For a client with `userRole === "Manager"`, `AccountsPage` passes an `onSave` that sends only the hours fields.
  - `AccountDetailsPanel` lets a Manager edit only the opening hours; everything else stays read-only.
  - `AlertsTab` follows the server `canEdit`.
- [ ] **Step 7: Add the founder-chat draft.**
  - The CrmShell listener stores `detail.draft`.
  - `SupportChatWidget` gets `initialDraft?: string`, seeds `input` when it changes, then clears it.
  - `RequestChangeNote` renders one line (en "Lead Awaker looks after these settings for you.") and a button (en "Request a change").
  - The draft reads en "Hi Gabriel, I'd like to change something under {{area}}: ".
  - It replaces `ReadOnlyNote` and the AlertsTab inline banner. It's also added to the read-only Phone and Integrations tabs.
- [ ] **Step 8: Verify.**
  - Impersonate Manager 53: change hours, reload, and the change stays. Restore the original hours.
  - Add then remove a test recipient.
  - "Request a change" on Chat opens the founder chat with the draft filled in. Do not send it.
  - Impersonate Viewer 53: no hours Edit, alerts read-only, and `curl` PATCH returns 403.

### Task 5: Client nav

**Files:**
- Create:
  - `client/src/components/crm/navGates.ts`
  - `client/src/components/crm/navGates.test.ts`
  - `client/src/components/crm/useClientNavFacts.ts`
- Modify:
  - `client/src/components/crm/RightSidebar.tsx`: nav items ~250-309, Home ~505, sections ~597-657, bottom bar ~349-358. Additive client branch; agency arrays unchanged.
  - `client/src/components/crm/mobile/MobileMorePage.tsx` (~132-150, ~238-279)
  - `client/src/components/crm/CommandPalette.tsx` (~84-97): clients only get `clientNavItems` pages
  - `client/src/locales/{en,nl,pt}/crm.json` (`sidebar.*`)

**Interfaces:**
- Consumes: `useWorkspace`, `useVoiceCapabilities`, `useHomeServices(accountId)` (`.reactivation`, `.phone`, `.website`), and `fetchInvoices(accountId)`.
- Produces:
  - `interface ClientNavFacts { voiceLive: boolean; hasInvoices: boolean; hasReactivation: boolean; hasReceptionist: boolean }`.
  - `type ClientNavKey = "home" | "calls" | "leads" | "calendar" | "myReceptionist" | "billing" | "campaigns"`.
  - `clientNavItems(f): ClientNavKey[]`.
  - `clientBottomBar(f): ClientNavKey[]`.
  - `clientMoreItems(f): ClientNavKey[]`.
  - `myAccountLabelKey(f): "sidebar.myReceptionist" | "sidebar.myAccount"`.
  - `useClientNavFacts(): ClientNavFacts`.

- [ ] **Step 1: Write the failing tests:**
  - All facts false gives `["home","leads","calendar","myReceptionist"]`.
  - Voice live, invoices and reactivation all true gives `["home","calls","leads","calendar","myReceptionist","billing","campaigns"]`.
  - The bottom bar is always `["home","leads","calendar","myReceptionist"]`.
  - More with voice and invoices gives `["calls","billing"]`.
  - The label key is `myAccount` when `hasReceptionist` is false.
- [ ] **Step 2: Run them and confirm they fail.** `npx tsx --test client/src/components/crm/navGates.test.ts` should FAIL. The module must import nothing, so it runs under node.
- [ ] **Step 3: Implement `navGates.ts` and `useClientNavFacts`.** The invoices query is enabled only when `!isAgencyUser`.
- [ ] **Step 4: Run them and confirm they pass.** Same command; PASS.
- [ ] **Step 5: Render the client nav.** When `!isAgencyUser`:
  - The desktop nav renders `clientNavItems` as one flat list with no section headings. The SETUP block is not rendered.
  - `myReceptionist` links `/platform/accounts`, `calls` links `/platform/voice-calls`, `leads` links `/platform/contacts`.
  - The bottom bar uses `clientBottomBar` plus More. The `myReceptionist` short label key is `sidebar.myReceptionistShort`.
  - MobileMorePage lists `clientMoreItems`, then Guide and "Chat with Gabriel".
  - Copy (en): "My receptionist", "Receptionist", "My account", "Calls". Add nl and pt.
- [ ] **Step 6: Verify.**
  - Impersonate Manager 53 at 1440: Home, Calls, Leads, Calendar, My receptionist, with no headings, no Billing and no Campaigns.
  - At 390, the bottom bar shows Home, Leads, Calendar, Receptionist, More, and More holds Calls.
  - As Owner, the nav is identical to before.

### Task 6: My receptionist page (Accounts workspace, client view)

**Files:**
- Modify (all under `client/src/features/accounts/components/`):
  - `workspace/AccountsTopBar.tsx` (~75-178)
  - `workspace/AccountsWorkspace.tsx` (list panel ~361, client mobile layout ~161-232)
  - `workspace/IdentityCard.tsx` (~104-147)
  - `workspace/OverviewTab.tsx` (~57-118)
  - `AccountDetailsPanel.tsx` (fields ~46-96)
  - `workspace/CampaignsPanel.tsx`
  - the Team, Contracts and Invoices panels
  - `workspace/IntegrationsPanel.tsx` (booking page card)
  - `client/src/locales/{en,nl,pt}/accounts.json`

**Interfaces:**
- Consumes: `myAccountLabelKey` and `useClientNavFacts` from Task 5; the `.la-seg--touch` CSS from Task 3; `RequestChangeNote` from Task 4.
- Produces: `IdentityCard` and the panels accept `clientView: boolean`, which is `!isAgencyUser`.

- [ ] **Step 1: Update the desktop page for clients.**
  - The topbar title is `t(myAccountLabelKey(facts))`.
  - Hide the count, list-collapse, search, filter, sort and group, and the list rail.
- [ ] **Step 2: Update the identity card for clients.** The subtitle drops type, niche and `#id`, and there's no logo upload.
- [ ] **Step 3: Update the Overview tab for clients (desktop and mobile).**
  - Hide `OnboardingEntry`.
  - `OverviewMobile` passes `readOnly` to `AccountDetailsPanel` (the mobile Save bug).
  - `AccountDetailsPanel` hides Status, Niche, Daily sends, Opt-out keyword and Tax ID.
  - Hide the Campaigns panel unless `hasReactivation`, and never show "+ New".
  - The Team panel hides Invite.
  - Contracts and Invoices render only when they have rows, with no Add.
- [ ] **Step 4: Fix the mobile tab row for clients.** The tab row moves to its own full-width row under the title, with `la-seg--touch`.
- [ ] **Step 5: Fix the booking-page badge.** It shows "Connected" only when the calendar is connected; otherwise it shows a "Waiting for your calendar" status (new key).
- [ ] **Step 6: Verify.** Impersonate Manager 53.
  - At 1440 and 390, every hidden item is gone.
  - All five tabs are fully visible on mobile.
  - Mobile Account details has no Edit except for hours.
  - In NL there's no English.
  - As Owner, the page is unchanged.

### Task 7: Calendar

**Files:**
- Create:
  - `client/src/features/calendar/lib/calendarView.ts`
  - `client/src/features/calendar/lib/calendarView.test.ts`
- Modify:
  - `client/src/pages/Calendar.tsx` (~34, ~68-72)
  - `client/src/features/calendar/components/DesktopCalendarHeader.tsx` (`CenterHeader` ~94-108)
  - `DesktopCalendarMonthAgenda.tsx` (~54)
  - `DesktopCalendarDetail.tsx` (~127-130)
  - `DesktopCalendarToolbar.tsx` (~187, ~263, ~285, ~361)
  - `desktopCalendarShared.tsx` (~169)
  - `client/src/locales/{en,nl,pt}/calendar.json`

**Interfaces:**
- Produces:
  - `type CalendarView = "month" | "week" | "list"`.
  - `isCalendarView(v: unknown): v is CalendarView`.
  - `defaultCalendarView(width: number): CalendarView`: `"list"` below 768, else `"week"`.

- [ ] **Step 1: Write the failing tests:**
  - `defaultCalendarView(390) === "list"`.
  - `defaultCalendarView(767) === "list"`.
  - `defaultCalendarView(768) === "week"`.
  - `isCalendarView("list") === true`.
  - `isCalendarView("day") === false`.
- [ ] **Step 2: Run them and confirm they fail.** `npx tsx --test client/src/features/calendar/lib/calendarView.test.ts`.
- [ ] **Step 3: Implement both, and use them** in Calendar.tsx's `usePersistedState`.
- [ ] **Step 4: Run them and confirm they pass.**
- [ ] **Step 5: Fix the header overlap.** The month pills move into normal flow, and hide when the header can't fit them. No overlap at 1024, 1280, 1440 or 1700 wide.
- [ ] **Step 6: Hide agency-only bits for clients.**
  - Pass `isAgencyUser` the way `canSeeConversation` is passed.
  - Clients get no score ring (agenda card and detail) and no group/sort by campaign.
  - The search placeholder key is `search.placeholderClient` (en "Search by name").
- [ ] **Step 7: Verify.**
  - Impersonate Manager 53: at 1440 there's no overlap or score ring; at 390 the calendar opens as the list.
  - As Owner, everything is unchanged except the overlap fix.

### Task 8: Client guide (Docs)

**Files:**
- Create:
  - `client/src/features/docs/ClientGuide.tsx`, plus a sibling sections file if it would pass ~500 lines.
  - `client/src/features/docs/ReactivationGuide.tsx`: the current `ClientGuide` from `Docs.tsx` (~439-777), moved unchanged.
- Modify:
  - `client/src/pages/Docs.tsx` (~439-777 removed, ~818-897 render; ~870 key fix)
  - `client/src/locales/{en,nl,pt}/docs.json` (new `clientGuide.*` tree)

**Interfaces:**
- Consumes: `useHomeServices`. The account's agent name comes from the same hook the Chat tab's Behaviour row uses (shows "Frank · Dutch"). The company name comes from the current account.
- Produces: `<ClientGuide agentName={string | null} companyName={string} hasPhone={boolean} hasWebsite={boolean} />`.

- [ ] **Step 1: Move the old guide.** Move the old `ClientGuide` into `ReactivationGuide.tsx` with no content change. `Docs.tsx` renders `ReactivationGuide` for clients only when `hasReactivation`.
- [ ] **Step 2: Write `ClientGuide`.** Use the eight sections from spec §7.
  - It shows only the phone or website sections the account has.
  - `{{name}}` falls back to the key `clientGuide.yourReceptionist`.
  - Section 6 states what he can change (hours, alerts, replying to leads, rescheduling or cancelling bookings, busy blocks) and how to request anything else.
  - Write the copy in en, then natural nl and Brazilian pt.
- [ ] **Step 3: Fix the founder button key.** `tc("messageFounder")` becomes `tc("sidebar.messageFounder")`.
- [ ] **Step 4: Verify.**
  - Impersonate Manager 53 in NL: the guide talks about Frank, the phone, website chat and recaps, with no Campaigns or Tasks and no raw keys.
  - As Owner, the operator manual is unchanged.

### Task 9: Welcome and Getting-started checklist

**Files:**
- Create:
  - `client/src/features/home/onboarding/checklist.ts`
  - `client/src/features/home/onboarding/checklist.test.ts`
  - `client/src/features/home/onboarding/useOnboarding.ts`
  - `client/src/features/home/onboarding/WelcomeChecklistCard.tsx`
- Modify:
  - `client/src/features/home/pages/HomePage.tsx` (scroll area ~125)
  - the accounts workspace mount (mark `receptionist` visited)
  - the voice call detail mount (mark `call` visited)
  - `client/public/manifest.json`
  - `client/src/locales/{en,nl,pt}/home.json`

**Interfaces:**
- Consumes:
  - `patchPreferences` (`client/src/features/settings/components/prefsSave.ts`).
  - The alert-settings GET (recipients) from Task 4's route.
  - The agent name source from Task 8.
- Produces:
  - `interface OnboardingPrefs { dismissed?: boolean; visited?: { receptionist?: boolean; call?: boolean }; installed?: boolean }`.
  - `type ChecklistKey = "details" | "alerts" | "call" | "install"`.
  - `buildChecklist(i: { prefs: OnboardingPrefs; recipients: { email?: string | null; phone?: string | null }[]; userEmail: string | null; userPhone: string | null; standalone: boolean }): { items: { key: ChecklistKey; done: boolean }[]; allDone: boolean; visible: boolean }`.
  - `useOnboarding(): { checklist: ReturnType<typeof buildChecklist>; markVisited(k: "receptionist" | "call"): void; markInstalled(): void; dismiss(): void }`.

- [ ] **Step 1: Write the failing tests:**
  - With empty prefs and no recipients, all four items are false and `visible` is true.
  - `"alerts"` is done when a recipient is `" Thijs@Robben.NL "` and `userEmail` is `"thijs@robben.nl"`.
  - `"alerts"` is done when a recipient phone is `"+31 6 81 76 47 63"` and `userPhone` is `"+31681764763"`.
  - `"install"` is done when `standalone` is true.
  - `visible` is false when `dismissed`.
  - `visible` is false and `allDone` is true when all four are done.
  - Items come in the order details, alerts, call, install.
- [ ] **Step 2: Run them and confirm they fail.** `npx tsx --test client/src/features/home/onboarding/checklist.test.ts`.
- [ ] **Step 3: Implement `buildChecklist`.** `details` is done from `visited.receptionist`, and `call` from `visited.call`.
- [ ] **Step 4: Run them and confirm they pass.**
- [ ] **Step 5: Implement `useOnboarding`.**
  - It writes the whole merged `onboarding` object through `patchPreferences({ onboarding })`.
  - `standalone` comes from `matchMedia("(display-mode: standalone)")` or `navigator.standalone`.
  - Mark visits on the accounts workspace and voice call detail mounts, for clients only.
- [ ] **Step 6: Build `WelcomeChecklistCard`.** Use the primitives.
  - The welcome line: en "Welcome, {{firstName}}. {{agentName}} answers for {{company}}."
  - Two short lines on where calls, chats and bookings appear, plus a guide link.
  - Each item navigates: details goes to `/platform/accounts`; alerts goes to the Alerts tab; call goes to `/platform/voice-calls` when voice is live, otherwise `/platform/contacts`; install expands iOS and Android steps with a "Done" button.
  - A close button calls `dismiss()`.
  - Render it at the top of Home's scroll area when `!isAgencyUser` and `visible`.
- [ ] **Step 7: Update the manifest.**
  - `theme_color` matches `index.html` (`#5E2230`).
  - Add `"id": "/platform"`, `"scope": "/"` and `"start_url": "/platform"`.
- [ ] **Step 8: Verify.** Impersonate Manager 53 at 390 and 1440.
  - The card shows Frank and Robben Rosmalen.
  - Opening My receptionist and a call ticks those items.
  - Closing it removes it after a reload.
  - Afterwards, clear `onboarding` from the Owner's own preferences with `patchPreferences({ onboarding: null })`: impersonation writes to Gabriel's user row.

### Task 10: First login, language, logo, Dutch leftovers, and Thijs's user

**Files:**
- Create:
  - `client/src/lib/userLanguage.ts`
  - `client/src/lib/userLanguage.test.ts`
- Modify:
  - `client/src/pages/AcceptInvite.tsx` (~123-124)
  - `client/src/hooks/useSession.ts` (~58, next to `hydrateLandingPage`)
  - `client/src/pages/app.tsx` (~131, if hydrate is also called there)
  - `client/src/components/crm/RightSidebar.tsx` (~458, logo)
  - `client/src/styles/variables.css` (new `--logo-plate` token; light value matches the login.html sand bar `rgba(218,213,199,.72)`, transparent in `.dark`)
  - `server/routes/users.ts` (`/api/users/invite` ~120)
  - the components showing raw "Active", "Dutch", 12-hour times and "Skip to main content" on client screens
  - the locale files

**Interfaces:**
- Produces:
  - `languageFromPrefs(raw: unknown): "en" | "nl" | "pt" | null`. It accepts a JSON string or an object, and reads `language`, then `lang`.
  - `/api/users/invite` accepts `sendEmail?: boolean` (default true).

- [ ] **Step 1: Write the failing tests:**
  - `languageFromPrefs('{"lang":"nl"}') === "nl"`.
  - `languageFromPrefs({ language: "pt", lang: "nl" }) === "pt"`.
  - `languageFromPrefs('{"lang":"de"}') === null`.
  - `languageFromPrefs("not json") === null`.
  - `languageFromPrefs(null) === null`.
- [ ] **Step 2: Run them and confirm they fail.** `npx tsx --test client/src/lib/userLanguage.test.ts`.
- [ ] **Step 3: Implement it and wire the hydrate step.** When `localStorage.leadawaker_lang` is empty and `languageFromPrefs(user.preferences)` is set, store it and `i18n.changeLanguage` it. An existing choice always wins.
- [ ] **Step 4: Run them and confirm they pass.**
- [ ] **Step 5: Fix first login and the logo.**
  - `AcceptInvite` navigates to `resolveLandingPath()`. Delete the "tour" comment.
  - In the light theme, the nav logo `logo-v2.svg` sits on a `var(--logo-plate)` rounded bar. The dark theme is unchanged, and the logo itself isn't edited.
- [ ] **Step 6: Clean up Dutch leftovers.** Translate status values, the language display name, 24-hour times for nl and pt in Account details and Home, and the skip link. Then impersonate Manager 53 in NL, read each client page's text with `playwright-cli eval "document.querySelector('main').innerText"`, and translate whatever English is left.
- [ ] **Step 7: Add `sendEmail: false`** to the invite route. It still creates the Invited row and token, but skips `trySendInvite`. Check the pm2 error log.
- [ ] **Step 8: Create Thijs's user.** Wait until Gabriel has confirmed the email (action-required). As Owner, call `POST /api/users/invite` with `sendEmail: false`, full name "Thijs Robben", role Manager, account 53, `lang: "nl"`, and the confirmed email, using the route's own field names. Check the row in Settings › Team. Do NOT press Resend.

### Task 11: Engine filters (Python)

**Files:**
- Modify:
  - `/home/gabriel/automations/src/automations/client_alerts/live_calls.py` (`IS_LIVE_SQL`)
  - `/home/gabriel/automations/src/automations/client_alerts/recap_data.py` (lead filters ~65-70 and the appointments query)
- Test: `/home/gabriel/automations/tests/test_client_alerts_v2.py` (extend)

- [ ] **Step 1: Write the failing test:** `test_live_sql_excludes_test_data`, asserting `"is_test"` appears in `IS_LIVE_SQL`, and that the recap queries' SQL strings contain `l.is_test`.
- [ ] **Step 2: Run it and confirm it fails.** `cd /home/gabriel/automations && python -m pytest tests/test_client_alerts_v2.py -k test_live_sql_excludes_test_data -q` should FAIL.
- [ ] **Step 3: Update the SQL.**
  - `IS_LIVE_SQL` gets `AND COALESCE(v.is_test, false) = false AND NOT EXISTS (SELECT 1 FROM <Leads> tl WHERE tl.id = v.leads_id AND tl.is_test = true)`.
  - The recap lead filters get `AND COALESCE(l.is_test, false) = false`.
  - Keep the `homeSql.liveCallSql` mirror in step with it (Task 1).
- [ ] **Step 4: Run the client-alert tests.** `python -m pytest tests/test_client_alerts.py tests/test_client_alerts_v2.py tests/test_client_alerts_ledger.py -q` should all PASS.
- [ ] **Step 5: Don't restart the engine.** Add "restart leadawaker-engine when no call is live" to `specs/client-mode/action-required.md`.

### Task 12: Full client walkthrough

- [ ] **Step 1: Walk every client page as Thijs.** Impersonate Manager 53. At 1440×900 and 390×844, in EN and NL, screenshot Home (all tabs), Calls, Calendar, My receptionist (all five tabs), the Guide, More (mobile) and Settings.
- [ ] **Step 2: Check each screen against the spec's success test.**
  - No test data, agency words, dead buttons or English in NL.
  - A call opens.
  - The hours edit sticks.
  - The founder-chat draft opens.
  - The checklist ticks.
- [ ] **Step 3: Repeat as Viewer 53.** Everything is read-only, with the Request-a-change note.
- [ ] **Step 4: Check the Owner view.** Stop impersonating: the Owner nav, Accounts and Calendar are unchanged except the logo, the overlap and the Home numbers.
- [ ] **Step 5: Measure Home's load time.** Time each `/api/home/*` call once on account 53 (from the playwright session's network log). Note the slowest in action-required.md, and fix it only if one query is plainly the cause.
- [ ] **Step 6: Clean up.** `playwright-cli close`, clear the Owner's `onboarding` preference, and stop impersonating.
- [ ] **Step 7: Update the paperwork.** Update `specs/client-mode/action-required.md` with anything left for Gabriel, and write a project memory note for client mode.
