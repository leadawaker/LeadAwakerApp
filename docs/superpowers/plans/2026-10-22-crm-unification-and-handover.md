# CRM unification and partner handover

Started 2026-10-22. Goal: one consistent UI across the CRM and a clean, safe repo (plus the automations engine repo) for Gabriel's partner developer, Mike. Both will work in one repo on branches.

## Decisions (Gabriel, 2026-10-22)

- Every page is built from the same parts: one topbar (title, Stats pill, tabs, round search, action icons), one list card (Chats behaviour: flat unless selected), one side-tab menu (`SectionRail`), one right-hand panel for create/edit (no Dialogs except destructive confirmations), one width rule (list pages left-aligned, single-column pages centered with `.la-page-center`).
- One home per thing: a lead opens in one place. Each channel page (Calls, Chats, Social) is Stats | work | Settings for that channel. Accounts is the business and its connections (overview, integrations, team, alerts). Settings is the person (profile, security, preferences, notifications, users, client billing). Alerts decides which events are sent and to whom.
- Phone and chat receptionist settings move from Accounts into the Calls and Chats pages, per account. One-time plumbing (numbers, WhatsApp, calendar, integrations) stays in Accounts > Integrations.
- Billing: agency keeps the Billing page (invoicing clients is work). Clients see their invoices in Settings > Billing.
- Reactivation (today's Campaigns page) becomes a service shown per account, like Reputation, instead of a core nav item.
- Unfinished pages are hidden until finished.
- Mike gets both repos: LeadAwakerApp and the automations engine. The marketing landing page is not part of the platform and moves to its own repo.

## Wave 1 (done 2026-10-22, not yet committed)

- [x] Calls page: Chats-style list cards, history first in People, test switch in the header, summary de-dup, unread calls badge, Stats | Calls pill with People | All calls, single Settings entry in the profile menu
- [x] Settings: Users (was Team), side tabs (Profile, Security, Preferences, Notifications, Users, Billing for clients), 2FA folded, Account tab removed, client notifications point to Alerts
- [x] Layout: `.la-page-center` on Home, Stats, Demos, Social; Leads topbar single row with quick-filter dropdown; Social Insights split off
- [x] Repo hygiene: secrets out of tracked files, clutter and dead code deleted, README + .env.example, portable paths, CLAUDE.md fixes

## Wave 2 (in progress)

- [x] Phone and Chat settings into the Calls and Chats pages (Settings item next to Stats, `?view=settings&account=`); Accounts keeps Overview, Integrations, Alerts; `?tab=voice` / `?tab=chat` redirect; client nav "My receptionist" becomes "My account" (2026-10-22)
- [x] Clients see every service on Accounts > Overview (Phone, WhatsApp, Website chat, Reactivation, Reputation, Social), the ones they don't have greyed out; a live service opens where it lives (phone: Calls > Settings). The agency list has the same six rows; "Text campaigns" became Reactivation and no longer counts the receptionist's own campaigns (2026-10-22)
- [x] Shared topbar parts (`PageTopbar`, `ExpandingSearch`, `TopbarTabs`, `TopbarIconButton` in `components/crm/primitives/`) on 13 pages incl. Style B (Prospects, Outreach inbox, Prompts); Calls, Leads and transcript searches are all `ExpandingSearch`; nav "Reactivation" and the Campaigns title share one key; documented in UI_PATTERNS §0/§17 (2026-10-22)
- [x] Left from the topbar work: Accounts topbar now on `PageTopbar`; Outreach inbox translated; AI agents hidden, contact detail page retired (wave 3)
- [x] UI_STANDARDS.md rewritten to describe the current style (350 lines; Manrope headings, no serif; `.la-camp-card` is the list card, `ListCard` legacy) (2026-10-22)
- [x] FILE_MAP.md regenerated after wave 4 (621 lines; new sections for Calls, Calendar, Social, Demos, and an "Unused code" list) (2026-10-22)
- [x] Automations repo for Mike: secrets out of tracked files, `tools/paths.py`, README, `.env.example`, `requirements.txt` fixed, CLAUDE.md fixes (2026-10-22)
- [ ] Automations, blocked on the other session's uncommitted files: Manager alerts fix (`client_alerts/crm.py:39` and `voice/call_screening.py:176`, `role = 'Viewer'` becomes `role IN ('Manager', 'Viewer')`), outbound audio path in `src/main.py:152-153`, `db_host` default in `src/config.py`
- [ ] Gabriel: revoke the Telegram bot tokens (notification bot, `TELEGRAM_CRM_BOT_TOKEN`, the `test_voice.sh` bot, the deleted bots) and the Anthropic token found in the engine repo; decide which engine clutter goes and whether the prospecting tools and voice clone go to Mike

## Wave 3 (done 2026-10-22, not yet committed)

Also in this wave: remove `AccountDetailView` and unused `account.*` keys; Accounts topbar onto `PageTopbar`; Outreach inbox strings; `ListCard` takes the `.la-camp-card` look; `PIPELINE_HEX` and `--stage-qualified` agree. Hidden pages keep their routes so Gabriel can still open them by URL. `client/src/legacy` waits for the landing page split.

- [x] Cleanup (2026-10-22): `AccountDetailView`, `KnowledgeBasePanel` and five dead `accountDetailWidgets/` files deleted, with ~45 unused locale keys; Accounts topbar on the shared parts; Outreach inbox strings translated; `ListCard` renders `.la-camp-card` (Outreach prospect rows moved onto it); Qualified is green everywhere (`--stage-qualified` = `PIPELINE_HEX`, new `--sand` token for the ochre studio tag)
- [ ] Follow-up: the lead-chat code in `InboxPanel` that the Outreach inbox never shows is still English; delete it or translate it

- [x] Dialogs to right panels: edit user, prompt form, calendar block (also replaces its create Popover), contract upload, CSV import, prospect email; new shared `RightPanel` primitive (UI_PATTERNS §14.2.1). Add user / campaign to account lived only in the dead `AccountDetailView` (2026-10-22)
- [ ] Gabriel: contract upload panel has no button that opens it. Add one (Billing > Contracts), or delete it?
- [ ] Follow-up: move the 5 reference panels (Contract, Invoice, Expense, Account, Prospect create) onto `RightPanel`; `BookAppointmentPopover` is still a create form in a Popover
- [x] "Open a lead" goes to one place: `/platform/chat?lead=<id>` via `lib/leadLink.ts`; `/platform/leads` and `/platform/contacts/:id` redirect, `/platform/opportunities` goes to the pipeline. Dead `LeadDetail.tsx`, `LeadDetailPanel.tsx` (+ its `leadDetail/` folder) and `SearchModal.tsx` deleted (2026-10-22)
- [x] Nested CRM URLs fixed: App.tsx used `/platform/:rest*`, which matches one segment, so `/platform/prospects/:id`, `/platform/contacts/:id` and `/platform/ai-agents/:id` showed Not found. Now `/platform/*` (same for the `/agency` and `/subaccount` redirects); `/test-table` removed (2026-10-22)
- [ ] Left from lead home: the `"all"` mode in LeadsPage/LeadsTable; server go-links in `clientAlerts.ts` and the engine still say `/platform/leads` (they work through the redirect)
- [x] Page titles one size (the two off-size ones now 20px bold; the Home greeting stays a 32px hero) (2026-10-22)
- [x] Side tabs (`SectionRail`) on Demo settings (one tile per service), Campaign settings (Business, AI, Behavior, self-contained so it moves to Accounts in wave 4) and Automation logs (service tiles with failure counts, also used by Accounts' client automations). SectionRail gained counts, `aria-controls` and label truncation (2026-10-22)
- [x] The campaign detail panel was dead code: deleted in wave 4
- [x] Hide unfinished pages: Cadence out of the nav and command palette; Speed to Lead and Missed calls out of the nav, command palette, mobile More, landing-page picker and Settings switches, routes Owner-only; AI agents already had no way in. List in a comment above `navItems` in RightSidebar (2026-10-22)
- [ ] Gabriel: is the Lead Awaker AI widget finished? It is still visible

## Wave 4: the Campaigns page retires (Gabriel, 2026-10-22; low priority, no reactivation clients yet; done 2026-10-22, not yet committed)

A campaign stays as data (every lead belongs to one and the engine reads its fields); only the page goes. Today the live campaigns are the receptionist's own (Robben, the Lead Awaker website), none is a real reactivation. The other six are demo campaigns on account 1 (Universal, XP Coach, Speed to Lead, Website Widget, Reputation, Social Reply).

Pre-check (done 2026-10-22): the Campaigns page is today the only place to edit (a) the receptionist campaign's engine fields that Chats > Settings does not show (AI model, temperature, role, style, conversation and booking mode, message and voice-note debounce, typos, AI disclosure, opt-out notice, objection playbook, AI bumps, stop on response) and (b) the six demo campaigns. So the one campaign settings component opens from three places, each where that kind of campaign lives:

- [x] Accounts > Reactivation tab (agency; shown when the account has a reactivation campaign, `?tab=reactivation` always works): campaign picker, status and Activate/Pause (with the preflight check), the shared settings screen, New campaign in a right panel (name only). Deep links `&campaign=`, `&section=`, `&new=1`. The Services row opens it, also when off (2026-10-22)
- [x] Chats > Settings > Advanced (Owner only, `?section=advanced`): AI model and role, conversation and booking mode, typos, text and voice-note wait, AI disclosure, opt-out line, AI bumps, stop on response, objection playbook (every one checked against the engine; `ai_temperature` is not a column, style is already "Tone" in Behaviour) (2026-10-22)
- [x] Demos > Settings: each service tile shows the full settings of the campaign it runs on (DBR 60, Speed 67, Widget 68, Reputation 69, Socials 70; Quote points at DBR); a Demo campaigns tile holds the rest (XP Coach, 58) (2026-10-22)
- [ ] Gabriel: Advanced offers booking mode Not set / Call agent / Qualifying, the two values the engine acts on (the Campaigns page writes "Sales Call" / "Direct Booking", which only reach the prompt when `booking_mode_call` is empty). Confirm. Also: keep the three reactivation-only fields (opt-out, AI bumps, stop on response) in Advanced, or drop them?
- [ ] pt `campaigns.json` misses many keys the campaign settings screen uses (partly English in pt, as on the Campaigns page)
- [x] Home > Reactivation: AI summary and A/B result when one campaign is picked (clients can refresh the summary); Open campaign (agency) and New campaign go to Accounts > Reactivation (2026-10-22)
- [x] Accounts > Overview drops the Campaigns panel everywhere; `CampaignsPanel.tsx` and its data fetch deleted (2026-10-22)
- [x] Reactivation left the nav (agency, client, mobile More, command palette and its campaign search, landing-page picker); `/platform/campaigns` is AgencyOnly by URL. The AgencyOnly/OwnerOnly guards and the Calls guard now send people Home, not to Campaigns. Chats follow-up copy points at Accounts > Reactivation (2026-10-22)
- [x] Dead `CampaignDetailPanel.tsx`, its `detailPanelWidgets/` and `onEditCampaign` plumbing deleted; unused nav keys and `hasReactivation` removed; UI_STANDARDS §3.6/§6 and UI_PATTERNS §21 describe where things live now (2026-10-22)
- [ ] Gabriel: the shared settings screen shows the demo "Launch Campaign" WhatsApp button (`/start <id>`) on real reactivation campaigns too. Hide it there? And is a name enough for New campaign, or should it also ask language or channel?
- [ ] Still pointing at the hidden Campaigns page (agency only, works by URL): automation change links of kind `campaign_section` (`automation/changeLinks.ts`), the Chats > Settings empty state ("no receptionist campaign yet": Campaigns is still the only place to create one), and the campaign list in a user's detail view (SettingsTeamSection)

## After the waves

- [ ] 87 client files have no importers (FILE_MAP "Unused code"): campaign tags section and `columns/`, `CampaignExecutionHistory`, all of `features/tags/`, `conversations/ChatPanel` + `ChatPanelMain`, 13 in `components/crm/`, ~35 unused shadcn/ui files. Delete the app code (keep shadcn/ui), in its own commit
- [ ] Commit today's work in reviewable chunks (proposal below), then the handover steps

## Handover (needs Gabriel for the outward-facing steps)

- [x] Campaign routes scoped to the caller's account (2026-10-22). Before this, any logged-in client could read another account's A/B stats and metrics history, create a campaign on any account, run the AI summary on any campaign, and run the agency's Generate tools (which overwrite campaign fields). Fixed with `ownsAccount()` in `server/routes/campaigns.ts`; Generate and Generate demo now need agency access, and writing metrics history too
- [x] Invite takeover closed (2026-10-22): `GET /api/users/:id` returned any account's users with `preferences.invite_token`, so a client could accept a pending invite (an Admin one meant agency access). Now scoped like the users list, and the read routes send `invite_pending` instead of the token (and drop `encryptedClaudeApiKey`)
- [x] Same gap closed in ~20 more routes (2026-10-22): lead demo reset / AI send / bump, lead create, bulk update and tags, CSV import campaign, calendar sync/cancel/blocks/freebusy/working hours, account knowledge, lead score history (`canWriteLead`, `ownsAccount` and `requireAccountAccess`, helpers in `server/routes/_helpers.ts`); demo create-link, niche-context and the Twilio voice token are agency only. Callers checked in the client and the engine; engine reads smoke-tested with the internal key; not yet tested with a real client login
- [x] Admin role could be given to a client-account user (invite and PATCH took any role with any account, and `requireAgency` admits every Admin): users.ts now refuses Owner/Admin on a non-agency account, and only an Owner can invite an Owner. Nobody had it (1 Owner, 2 Managers)
- [ ] Route follow-ups: some routes still use `req.user!` and 500 on internal-key calls (cancel-booking, score breakdown/history, GET/DELETE/mark-served `/api/leads/:id`, PATCH `blocks/:id`, which also lets Viewers edit); POST `/api/leads` skips the client field whitelist; attaching a tag doesn't check the tag's account (55 tags have none); reset-demo, ai-send and trigger-bump have no live callers (make them agency only?)
- [ ] Production should not be a Vite dev server on the open internet. On 2026-10-22 at 17:33 a scanner probed app.leadawaker.com for `.env` and `/proc/self/environ` (Vite file-read tricks). Nothing leaked: Vite 7.3.2 answered 403 and the rest got the app's HTML. For the handover: serve built files in production, or put app.leadawaker.com behind Cloudflare Access
- [x] Rotated INTERNAL_API_KEY, the owner password, the `leadawaker` and `caldiy` Postgres passwords (the caldiy one was in a tracked spec) (2026-10-31). Still to do by hand: the booking Worker's `INTERNAL_KEY` secret (`wrangler secret put INTERNAL_KEY`, wrangler is not logged in on the Pi)
- [x] `.claude/settings.json` trimmed: no rm, sudo, pkill, tsc, dev server or build auto-allows (2026-10-31)
- [ ] Landing page to its own repo and Vercel project: move the logos the app borrows from `client/public/premium/` into the app first; decide domains/routing for leadawaker.com vs the app frontend, `/demo/:token` and `/voice-demo`; marketing scripts, `proposals/` and the lead-magnet and proposal skills move with it
- [ ] Business material out of the platform repo: `docs/clients/`, `docs/strategy/`, client prompts in `docs/voice-demo/`, proposals, lead-magnet PDFs
- [ ] Workflow: `main` protected, feature branches with pull requests, a staging branch with its own Vercel preview so nobody ships to production by accident
- [ ] Fresh repo with one starting commit (drops the secrets in history and the 3 GB .git), then invite Mike to both repos. Done 2026-10-31: private `leadawaker/crm` and `leadawaker/engine`, one commit each, without `docs/clients`, `docs/strategy`, `docs/voice-demo`, the AI voice research, the lead-magnet PDFs, the voice clone and the engine's root one-off test scripts. Left: switch the Pi and Vercel over to them on the day Mike starts (they are a snapshot, the old repos keep moving until then), and invite Mike
