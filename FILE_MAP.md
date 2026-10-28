# FILE_MAP: LeadAwakerApp Quick Reference

Read this file to locate any component without running grep/glob searches.

> **Future Claude:** If you discover a file that's missing, mislabeled, or outdated here, add it, correct it, or remove it. This file only has value if it stays accurate and complete.

> Regenerated 2026-10-22 against the tree, after the Campaigns page retired. Files with no importers are listed under "Unused code" near the end: don't build on them.

---

## Pages (route-level)

### Post-Login App Pages

CRM routes are registered in `pages/app.tsx`; top-level routes in `App.tsx`. **Every route component is `React.lazy`**: new pages must be added the same way (lazy import + route), never as static imports. Pages hidden until finished keep their routes; the list, and how to bring one back, is the comment above `navItems` in `components/crm/RightSidebar.tsx`.

| Page | Path | Notes |
|------|------|-------|
| App shell wrapper | `pages/app.tsx` | Authenticated layout root, all routes lazy. Guards: `AgencyOnly`, `OwnerOnly`, `ServicePageGuard`, `VoiceCallsGuard` (anyone turned away goes Home). `/platform` opens the user's landing page (`lib/landingPage.ts`, Home by default) |
| Stats (was Home) | `features/home/pages/HomePage.tsx` | `/platform/home`, every role, shown as "Stats" in the nav. One page, no tabs: a row of tall service cards (`features/home/stats/ServiceCards.tsx` on `components/ServiceCard.tsx`: picture, main number, trend, sparkline, two smaller numbers, Open), one per service that is on (phone, WhatsApp, website, reactivation, reputation, social), then the overview grid (`features/home/stats/OverviewGrid.tsx`: By channel + Conversations per day, Recent activity with a Calls / WhatsApp switch, Needs attention). An old `?tab=` link scrolls to its card. Data from `features/home/api/homeApi.ts` (`/api/home/*`, server pins clients to their account); helpers in `features/home/lib/{homeFormat,openCall,recentChannels}.ts`; shared parts in `features/home/components/{ServiceCard,BarList,DayChart,RowList,EmptyState}.tsx`; first-run checklist in `features/home/onboarding/`; styles in `features/home/home.css`. Server and shared files: see Home Dashboard |
| Calls | `features/voiceCalls/pages/VoiceCallsPage.tsx` | `/platform/voice-calls`. Owner: Live and Demo; a client with a voice line: their own Live calls. Calls \| Settings (see Calls Feature); the figures are on the Stats page |
| Chats | `features/leads/pages/LeadsPage.tsx` (`mode="conversations"`) | `/platform/chat`. Every AI chat with the lead beside it. **The one place a lead opens:** `/platform/chat?lead=<id>`, built with `leadPath()` (or navigate with `openLead()`) from `lib/leadLink.ts`. Chats \| Settings; the figures are on the Stats page |
| Leads | `features/leads/pages/LeadsPage.tsx` (`mode="contacts"`) | `/platform/contacts`: the lead directory (Table + Pipeline). `/platform/leads` and `/platform/contacts/:id` redirect to Chats; `/platform/opportunities` goes to `/platform/contacts` |
| Calendar | `pages/Calendar.tsx` | Bookings and busy blocks (see Calendar Feature) |
| Social | `features/social/pages/SocialPage.tsx` | `/platform/social`. Agency always; client users once the agency switched Social on (see Social Feature) |
| Accounts | `pages/AppAccounts.tsx` | Wraps `pages/Accounts.tsx`, which re-exports `features/accounts/pages/AccountsPage`. Agency: every client; a client sees their own account as "My receptionist" / "My account" |
| Billing | `features/billing/pages/BillingPage.tsx` | Imported directly in app.tsx (invoices/contracts/expenses). Clients also see it as Settings > Billing |
| Tasks | `features/tasks/pages/TasksPage.tsx` | Imported directly in app.tsx, agency only |
| Prompt Library | `features/prompts/pages/PromptsPage.tsx` | Imported directly in app.tsx, agency only |
| Demos | `features/demos/pages/DemosPage.tsx` | `/platform/demos`, Owner only (see Demos Feature) |
| Automation Logs | `pages/AutomationLogs.tsx` | Automations overview (service side tabs, health, diary panel), Owner only |
| Socials > Thumbnails | `features/social/components/thumbnails/` | Thumbnail creator tab of the Socials page (`ThumbnailsSection` = composer + gallery, `ThumbnailComposer`, `ThumbnailGallery`, `ReferencePicker`). API `features/social/api/thumbnailsApi.ts`, rules `features/social/lib/thumbnails.ts`, shared `shared/socialThumbnails.ts`. Server: `server/social/thumbnailRoutes.ts` (deps-injected, tested), `thumbnailPrompt.ts` (prompt + crop), `thumbnailImage.ts` (OpenAI provider, on only with `OPENAI_API_KEY`), wiring `server/routes/socialThumbnails.ts`, storage `server/storage/socialThumbnails.ts`. Tables: `script/create-social-thumbnail-tables.mjs`. Files in `uploads/social-thumbnails/`. Edit a finished cover (pencil on a gallery card): `EditThumbnail.tsx`, route `POST .../thumbnails/:id/edit`; versions keep `parent_id` and wait as `review = pending` until approved (reject deletes). Suggest titles: `TitleSuggestions.tsx` under the title field, route `POST .../thumbnail-titles` (`server/social/thumbnailTitleRoutes.ts` + `thumbnailTitles.ts`, Claude via `claudeJson`). Delete asks twice (`lib/useTapAgain.ts`, `StyleChip.tsx`). Reel cover: `components/CoverPicker.tsx` in the post sheet; the post keeps its own copy under `<uploads>/<account>/covers/`, public at `/media/social/cover/<id>.jpg`, sent to Instagram as `cover_url` (`Social_Posts.cover_*`, columns added by the same script) |
| Traffic | `features/traffic/pages/TrafficPage.tsx` | `/platform/traffic`, Owner only: the public site's visitors + Google Search Console (see Traffic Feature) |
| Reputation | `features/reputation/ReputationPage.tsx` | `/platform/reputation`, behind `ServicePageGuard service="reputation"`. Components in `features/reputation/components/`, mock data in `data.ts`, live reads in `live.ts` |
| Settings | `pages/Settings.tsx` | Thin composition on `SectionRail` side tabs: Profile, Security, Preferences, Notifications, Users, and Billing for clients. Sections in `features/settings/components/{ProfileTab,SecurityTab,PreferencesTab,NotificationsSection,SettingsCard,SettingsFields,MyProfileGate}.tsx` + `features/settings/types.ts`; Users is `features/users/components/SettingsTeamSection.tsx` |
| Docs | `pages/Docs.tsx` | In-app Operator Manual + Client Guide (parts in `features/docs/`) |
| Outreach Inbox | `pages/OutreachInbox.tsx` | `/platform/outreach-inbox`, agency only: prospect chat, built on `features/conversations/` |
| Prospects | `pages/AppProspects.tsx` | Wraps `features/prospects/pages/ProspectsPage`, agency only |
| Prospect Detail (standalone) | `pages/ProspectDetail.tsx` | `/platform/prospects/:id`, full-page prospect view |
| Campaigns (retired) | `pages/AppCampaigns.tsx` | Wraps `features/campaigns/pages/CampaignsPage`. Out of the nav; agency only at `/platform/campaigns` by URL. Campaigns are edited where they live now (see Campaigns Feature) |
| Hidden until finished | `pages/AppCadence.tsx`, `features/speed-to-lead/pages/SpeedToLeadPage.tsx`, `features/voice/VoicePage.tsx`, `features/ai-agents/pages/{AgentsPage,AgentChatPage}.tsx` | Cadence (`/platform/cadence`, agency), Speed to Lead (`/platform/speed-to-lead`, Owner, mock data), Missed calls (`/platform/missed-calls`, Owner, mock data), AI agents (`/platform/ai-agents`, agency). No way in except the URL |
| Redirects | `pages/app.tsx` | `/platform/dashboard` to Home, `/platform/conversations` to Chats, `/platform/users` to Settings > Users, `/platform/tags` to Home, `/platform/{invoices,expenses,contracts}` to Billing |

> Deleted, do not look for: `pages/Conversations.tsx`, `pages/AppLeads.tsx`, `pages/Tags.tsx`, `pages/PromptLibrary.tsx`, `pages/SetupProfile.tsx`, `pages/Billing.tsx`, `pages/Invoices.tsx`, `pages/LeadDetail.tsx`, `pages/Opportunities.tsx`, `components/crm/{LeadsTable,CampaignPerformanceCards,Topbar,SettingsPanel,SearchModal,ChangePasswordDialog}.tsx`, `components/ui/chart.tsx`, `lib/pwa.ts`, `server/routes.ts`, `features/invoices/` (entire dir), `features/billing/pages/{InvoicesPage,ContractsPage,ExpensesPage}.tsx`, `features/billing/components/{BillingListView,InvoiceCard,ContractCard,InvoiceCreateDialog}.tsx`, `features/leads/components/{LeadDetailPanel.tsx,leadDetail/,PipelineToolbar.tsx}`, `features/leads/pages/OpportunitiesPage.tsx`, `features/campaigns/components/{CampaignDetailPanel.tsx,detailPanelWidgets/,CampaignsInlineTable.tsx}`, `features/accounts/components/{AccountListView,AccountDetailView}.tsx`, `CampaignsPanel.tsx`, `KnowledgeBasePanel`, `features/tags/pages/TagsPage.tsx`, `features/prospects/components/ProspectSlidePanel.tsx`, `hooks/useDashboardRefreshInterval.ts`, `features/demos/components/{NewDemoForm,ProspectDemoPanel,DemoVoicePicker,DemoSessionsTable,ServiceCell}.tsx`. `client/src/migration/` holds only reference images and one `.md` (no code).

### Public / Pre-Login Pages

The marketing site (leadawaker.com landing) is static files in `client/public/site/` and `client/public/premium/` (see its own FILE_MAP). The old React marketing pages live in `client/src/legacy/` (served at `/legacy` only). The login page is the static `client/public/login.html`. Top-level public routes (`App.tsx`, all lazy):

| Page | Path | Notes |
|------|------|-------|
| FAQ | `pages/faq.tsx` | `/about` redirects here |
| Cases | `pages/cases.tsx` | `/services` redirects here |
| Book Call | `pages/book-call.tsx` | |
| Intake Demo | `pages/intake-demo.tsx` | `/intake/:token` |
| Voice Demo | `pages/voice-demo.tsx` | `/voice-demo`: the in-browser call demo, parts in `features/voiceDemo/` |
| Review Demo | `pages/review-demo.tsx` | `/review-demo`, parts in `features/reviewDemo/` |
| Accept Invite | `pages/AcceptInvite.tsx` | `/accept-invite` |
| Reset Password | `pages/ResetPassword.tsx` | `/reset-password` |
| Go link | `pages/GoLink.tsx` | `/go/:code`: the button in every client alert and recap; resolves the code, preselects the lead or call, opens the page |
| Number docs | `pages/NumberDocs.tsx` | `/number-docs/:token`: a client hands in what the carrier needs to register a number (no login) |
| Legacy Home | `legacy/LegacyRoute.tsx` | `/legacy`, `/dbr` |
| Privacy Policy | `client/public/premium/privacy.html` | Static page (NL, EN, PT) served at /privacy-policy; the old in-app URLs redirect to it |
| Terms of Service | `pages/terms-of-service.tsx` | |
| Canvas | `pages/canvas.tsx` | |
| Not Found | `pages/not-found.tsx` | |

> All paths below are relative to `client/src/`. `…/` = the feature's base directory.

---

## App Shell & Navigation (`components/crm/`)

| Component | File | Notes |
|-----------|------|-------|
| CrmShell | `CrmShell.tsx` | Nav bar + page area wrapper, layout offsets (adds no padding); mounts `ImpersonationBanner` and the founder inbox panel |
| RightSidebar | `RightSidebar.tsx` | The nav bar (it sits on the left despite the name): nav items, sections, collapse, profile menu, mobile bottom bar. The comment above `navItems` lists the hidden pages |
| navGates | `navGates.ts` (+ `navGates.test.ts`) | Pure rules for the client nav, bottom bar and More page from `ClientNavFacts`. Test: `npx tsx --test client/src/components/crm/navGates.test.ts` |
| useClientNavFacts | `useClientNavFacts.ts` | The facts those rules read: voice line, invoices, receptionist, chats, social |
| navVisibility / navIcons | `navVisibility.ts`, `navIcons.ts` | One visibility rule set for the nav bar, More page and command palette; one icon per page |
| mobile/ | `mobile/` | `MobileListHeader` (+ `MobileHeaderIconBtn`, `MobileDrawerOption`), `MobileSheet`, `MobileMorePage` (phone More tab), `MobileAgencySwitcher` |
| NotificationCenter | `NotificationCenter.tsx` | Bell dropdown: message, takeover, booking, campaign notifications. Phone version: `MobileNotificationsPanel.tsx` |
| CommandPalette | `CommandPalette.tsx` | Cmd+K: pages, leads and accounts (campaign search removed with the Campaigns page) |
| SupportChatWidget | `SupportChatWidget.tsx` (+ `SupportChatHeader`, `SupportChatInput`, `SupportChatHelpers`) | Support chat with doodle bg, draw/emoji tools |
| FounderInbox | `FounderInbox.tsx` | Gabriel's inbox for the support chats clients start (`/api/support-chat/founder/*`) |
| RequestChangeNote | `RequestChangeNote.tsx` | Clients' read-only note: Lead Awaker looks after this; opens the founder chat with a draft (`lib/founderChat.ts`) |
| ImpersonationBanner | `ImpersonationBanner.tsx` | "Viewing as" banner |
| AiSummaryView | `AiSummaryView.tsx` | Shared renderer for AI conversation summaries (lead close, demo recap) |
| StatusPill | `status/StatusPill.tsx`, `status/statusPill.ts` (+ test) | The one status pill for calls, people and chats |
| ListPanelToggleButton | `ListPanelToggleButton.tsx` | Cycles the list panel full / compact / hidden (`hooks/useListPanelState.ts`) |
| CompactEntityRail/ | `CompactEntityRail/` | The minimized list rail: `COMPACT_RAIL_WIDTH`, `useCompactHoverCard`, `CompactHoverCardPortal`, `CompactTabPuck`, `CompactSearchOverlay` |
| entityList/ | `entityList/` | Shared list infra: `buildEntityRows()`/`groupItemsToMap()` (stateless filter, sort, group, flatten helpers used by Prompts/Prospects/Billing/Leads/Accounts list views) + `useEntityList`/`EntityListView` (state-owning hook + card-list shell, available for future use) |
| DateRangeFilter | `DateRangeFilter.tsx` | Shared date range filter |
| ConnectionBanner | `ConnectionBanner.tsx` | DB connectivity indicator |
| DataEmptyState | `DataEmptyState.tsx` | Shared empty-state placeholder |
| ApiErrorFallback | `ApiErrorFallback.tsx` | API error display |
| ErrorBoundary | `ErrorBoundary.tsx` | React error boundary |
| PageTransition | `PageTransition.tsx` | Route transition wrapper |
| BotPhotoCropModal | `BotPhotoCropModal.tsx` | Crop the AI agent's photo |

### Primitives (`components/crm/primitives/`, import from `@/components/crm/primitives`)

UI_STANDARDS §3 says when to use each; UI_PATTERNS §0, §13, §14.2.1 and §17 have the markup.

| Component | File | Notes |
|-----------|------|-------|
| PageTopbar | `PageTopbar.tsx` | The one page topbar: 60px `.la-page-header`, title, `count`, `left`, `right` |
| TopbarTabs | `TopbarTabs.tsx` | View tabs (`la-seg` track) |
| TopbarIconButton | `TopbarIconButton.tsx` | Icon action with tooltip; `active` (wine dot), `primary` (the wine `+`), `danger` |
| ExpandingSearch | `ExpandingSearch.tsx` | The one search control: a round icon that opens into a pill field |
| PillSwitch | `PillSwitch.tsx` | Page modes: Calls \| Settings, Live \| Demo |
| RightPanel | `RightPanel.tsx` | Create/edit panel shell: header + close, `.neu-panel` body, Cancel/Save footer; full screen on phones |
| ListCard | `ListCard.tsx` | The `.la-camp-card` row for free-form content |
| GroupHeader | `GroupHeader.tsx` | Sticky divider in grouped lists |
| SectionCard / Pill | `SectionCard.tsx`, `Pill.tsx` | Detail sections and widget shells; label/status badge |
| ToolbarButton | `ToolbarButton.tsx`, `toolbarButtonClasses.ts` | The retired Style B toolbar (`xBase`, `xDefault`, `xSpan`). Don't use in new code |

---

## Leads Feature (`features/leads/`)

One workspace, two pages: Chats (`mode="conversations"`) and Leads (`mode="contacts"`).

| Component | File | Notes |
|-----------|------|-------|
| LeadsPage | `pages/LeadsPage.tsx` | Hosts the workspace in a mode (the `"all"` mode is legacy) |
| LeadsTable | `components/LeadsTable.tsx` | **Main container**: mode and view switching, filters, search, data |
| LeadsCardView | `components/LeadsCardView.tsx` | Facade; the list view lives in `components/cardView/LeadsCardViewMain.tsx` |
| cardView/ | `components/cardView/` | The Chats list view: `LeadsListPanel` (list panel, compact rail, mobile list), `LeadListCard` + `CompactLeadCard`, `LeadsDesktopToolbar` (topbar), `ChatsPageTabs` (Chats \| Settings), `ChatsSideView` (the Settings view), `ChatChannelTabs`, `LeadDetailView` (desktop detail: `ConversationWidget`, `ContactWidget`, `DetailWidgets`, `ScoreWidgets`, `LeadRecap`, `LeadSummaryCard`), `MobileViews` (`MobileLeadDetailPanel` and the phone list), `PipelineLeadPanel` (lead panel in the Pipeline view), `MiniChat`, `ThreadCallLine` / `threadCalls.ts` (calls inside a chat thread) |
| LeadsKanban | `components/LeadsKanban.tsx` | Drag-drop pipeline columns |
| LeadsInlineTable | `components/LeadsInlineTable.tsx` | Virtualized table view (`leadsTableConfig.ts`) |
| Topbars | `components/{LeadsTableTopbar,LeadsPipelineTopbar,LeadsTopbarParts}.tsx` | Table and Pipeline view topbars and their shared parts |
| LeadsQuickFilters | `components/LeadsQuickFilters.tsx` | View switch (All / Needs reply / Next appointments) + channel switch |
| CsvImportWizard | `components/CsvImportWizard.tsx` | CSV lead import flow (right panel beside the table) |
| NoShowDialog | `components/NoShowDialog.tsx` | No-show claim, from the lead booking section, calendar detail and contacts row |
| hooks | `components/{useLeadsFilters,useLeadsLookups,useLeadsSelection}.ts` | Filter state, lookups, bulk selection |
| usePagedLeads | `hooks/usePagedLeads.ts` | **Main data hook**: `GET /api/leads/page`, paged, with the server's counts |
| lib | `lib/leadDisplay.ts`, `lib/serverRows.ts` | Shown stage, colour and last-contact line; server page to list rows with group headers |
| conversationType / chatChannel | `components/conversationType.ts` (+ test), `components/chatChannel.ts` | Chat type and channel helpers |
| leadsApi | `api/leadsApi.ts` | API calls for leads |
| leadLink | `lib/leadLink.ts` (in `client/src/lib/`) | `leadPath()`, `openLead()`, `readLeadParam()`, `LEAD_HOME_PATH`: every "open this lead" link |

---

## Calls Feature (`features/voiceCalls/`)

| Component | File | Notes |
|-----------|------|-------|
| VoiceCallsPage | `pages/VoiceCallsPage.tsx` | Page shell: Calls, Settings (`accounts/.../receptionist/ReceptionistSettings`, the phone receptionist's settings) |
| CallsPageTabs | `components/CallsPageTabs.tsx`, `components/callsTabs.ts` | Calls \| Settings, then (agency) People \| All calls |
| VoiceCallsTopbar | `components/VoiceCallsTopbar.tsx` (+ `VoiceCallsMobileTopbar`, `VoiceCallsMenus`, `WeekSummary`, `TranscriptSearch`, `ScopeSwitch`, `AccountFilter`, `PresentingToggle`) | Topbar and its menus |
| VoiceCallsInbox | `components/VoiceCallsInbox.tsx` | Call list beside the call detail |
| VoiceCallListCard / CompactCallRail | `components/VoiceCallListCard.tsx`, `components/CompactCallRail.tsx` | List card (the UI_STANDARDS 3.4 reference) and minimized rail |
| VoiceCallDetail | `components/VoiceCallDetail.tsx` | One call: `CallHeader`, `CallSidebar` (`CallRecap`, `CallSummaryBody`), `CallReviewPanel` (the call review plus transcript search, follow-scroll, recording notes, receipts, agency delegation chips via `CallEventChip`), `CallBackButton`, `HubspotPushButton`. `CallConversation` + `CallPlayer` + `CallTranscript` (+ `useCallAudio`, `turnTimes`) now serve only the Calendar's appointment detail |
| Call review | `review/` | Shared by the Calls page detail and the Voice tab test panel: `CallReviewView` (test panel layout, `useReviewSeek`, `ReviewStatusLine`), `ReviewSummary`, `ReviewWaveform` (+ `MarkerTrack`, `waveStyle.ts`, `speakerWave.ts`: one-channel recordings coloured by speaker, two channels as lanes), `ReviewTranscript`, `TranscriptBubble`, `ToolTag` / `toolTags.ts` / `useToolLabel`, `UnderstoodCard`, `useCallReview` (review query + cached recording), `reviewMath.ts`, `highlight.tsx`, `useFitInColumn`. Server: `routes/voiceCallReview.ts` + `routes/voiceCallReviewView.ts` (who sees what) |
| People view | `components/{CallersInbox,CallerListCard,CallerDetail}.tsx`, `callers.ts` | One row per caller (agency) |
| api | `api/voiceCallsApi.ts` | Queries, incl. `useVoiceCapabilities` (who may see Live / Demo) |
| helpers | `status.ts`, `format.ts`, `dateGroups.ts`, `maskIdentity.ts`, `phoneMatch.ts`, `summaryGroups.ts`, `turnTimes.ts`, `listOptions.ts`, `localPref.ts`, `useCallAudio.ts`, `usePresenting.ts`, `recordingNote.ts` | Tests sit beside them (`*.test.ts`) |

---

## Campaigns Feature (`features/campaigns/`)

The Campaigns page is retired (agency only by URL). A campaign stays as data: every lead belongs to one and the Python engine reads its fields. Each kind is edited where it lives:
- Accounts > Reactivation (reactivation campaigns): `features/accounts/components/workspace/reactivation/`
- Demos > Settings (the demo campaigns): `features/demos/components/DemoCampaignSettings.tsx`
- Chats > Settings > Advanced (the receptionist campaign's engine fields): `features/accounts/components/workspace/chat/ChatAdvanced.tsx`

| Component | File | Notes |
|-----------|------|-------|
| CampaignStageEditor | `components/CampaignStageEditor.tsx` | **The one campaign settings screen**: wraps `settings/CampaignSettingsLayout` (own `SectionRail`: Business, AI, Behavior) with agency gating and niche-template auto-fill |
| settings/ | `components/settings/` | `CampaignSettingsLayout`, `{Business,AI,Behavior}SectionFields`, `AiDisclosureField`, `ObjectionPlaybookField`, `NicheSelect`, `OpenerTemplatePicker`, `CampaignGenerateButton`, `fieldLocale.ts` |
| formFields/ | `components/formFields/` | Field inputs shared by every settings home (`EditText`, `EditSelect`, `EditNumber`, `EditToggle`, `EditDate`, `InfoRow`, `ContractSelect`, `LocalizedCombo`...) + `campaignFormatters.ts` |
| useCampaignDetail | `components/useCampaignDetail.ts` | Data, draft and 1.5s autosave behind the settings screen |
| useCampaignById | `hooks/useCampaignById.ts` | One campaign by id for the hosts outside the Campaigns page (Accounts > Reactivation, Home > Reactivation, Demos) |
| useCampaignAiSummary | `hooks/useCampaignAiSummary.ts` | The AI summary and its refresh; used by `useCampaignDetail` and Home > Reactivation |
| campaignWrites | `lib/campaignWrites.ts` | Side writes on save/create: niche-template sync, default tags (cloned from the most-tagged campaign) |
| campaignsApi | `api/campaignsApi.ts` | Incl. preflight (launch readiness) |
| demoClientsApi / openerTemplatesApi | `api/demoClientsApi.ts`, `api/openerTemplatesApi.ts` | Demo persona library; opener templates |
| demoMode | `demoMode.ts` | The conversation type a demo runs as |
| CampaignsPage (retired) | `pages/CampaignsPage.tsx` | Split-pane: `CampaignListView` (+ `CampaignListCard`, `CompactCampaignCard`, `CampaignFilterSheet`, `MobileCampaignDetailPanel`), `CampaignDetailView` (facade for `components/detailView/`: Summary is `CampaignMetricsPanel` + `metricsWidgets/`, Configurations is `CampaignStageEditor`, Clients is the persona library). `useCampaignsData` loads the list |
| Demo personas | `components/clients/` | The persona library: the "Demo personas" tab of the Demos page (`DemosPage.tsx`, passes `showActions`) and the Clients tab of the hidden Campaigns page. `ClientsTab` is the shell (list + panel, filter by language, search); `ClientsHero`; `ClientCategorySection`; `ClientEditor` (autosave, three views: persona / wording / media) with `clientDraft.ts`, `ClientEditorSections`, `ClientPanelHeader`, `ClientSection`, `ClientScreenshot`, `SocialPostSection`, `CategorySelect`, `ClientActionsMenu`, `clientDisplay.ts`. `LiveClientView` is the read-only view of a live persona, linking to Calls > Settings. Styles: scoped `.dp-*` in `clients.css`, reusing `.am-*` from `features/automation/automation.css`. i18n `campaigns` namespace, `clients.*` |

---

## Conversations Feature (`features/conversations/`)

Today this is the Outreach inbox's chat, plus chat parts the Chats page reuses.

| Component | File | Notes |
|-----------|------|-------|
| InboxPanel | `components/InboxPanel.tsx` (+ `inboxPanel/`) | Thread list (Outreach inbox) |
| ProspectChatPanel | `components/ProspectChatPanel.tsx` | Prospect message thread |
| ProspectDetailSidebar | `components/ProspectDetailSidebar.tsx` | Prospect info beside the thread |
| ProspectInboxControls | `components/ProspectInboxControls.tsx` | Topbar filters for the Outreach inbox |
| TemplatePicker / UncontactedProspectPicker | `components/*.tsx` | Message templates; start a chat with a new prospect |
| chatView/ | `components/chatView/` | Chat atoms and utils the Chats page's `ConversationWidget` and `MiniChat` reuse (`atoms`, `utils`, `ChatBubble`, `AttachmentPreview`, `VoiceMemoPlayer`, `ImageLightbox`) |
| ContactSidebar | `components/ContactSidebar.tsx` | Only its `STAGE_ICON` map is still used |
| hooks | `hooks/useConversationsData.ts`, `hooks/useProspectConversations.ts` | Types + data |
| conversationsApi | `api/conversationsApi.ts` | `sendMessage` and friends |
| conversationHelpers | `utils/conversationHelpers.ts` | Formatting/utility functions |

---

## Accounts Feature (`features/accounts/`)

The business and its connections. Tabs: Overview, Reactivation (agency, when the account has a reactivation campaign), Integrations, Alerts, Automations (owner). Onboarding opens from Overview. The receptionist is tuned in Calls > Settings and Chats > Settings, from files in this feature.

| Component | File | Notes |
|-----------|------|-------|
| AccountsPage | `pages/AccountsPage.tsx` (+ `pages/pageWidgets/`) | Feature page: data, selection, list prefs |
| AccountsWorkspace | `components/workspace/AccountsWorkspace.tsx` | **Desktop shell**: topbar, list panel, header (`IdentityCard`), tabs (`ACCOUNT_TABS`) |
| AccountsTopBar / AccountsListPanel | `components/workspace/{AccountsTopBar,AccountsListPanel,WorkspaceAccountCard,CompactAccountCard}.tsx` | Topbar, list panel, list cards |
| OverviewTab | `components/workspace/OverviewTab.tsx` | Routes each tab to its component. Overview: `AccountDetailsPanel`, `ServicesPanel` (one row per service), `TeamPanel`, `ContractsPanel`, `InvoicesPanel`, `ConnectionsOverview` |
| Reactivation tab | `components/workspace/reactivation/` | `AccountReactivationTab` (picker, the campaign list Home > Reactivation shows), `ReactivationCampaignSettings` (status, Activate/Pause, the settings screen), `NewCampaignPanel` (right panel), `reactivationLink.ts` (`?tab=reactivation&campaign=&section=&new=1`) |
| Integrations tab | `components/workspace/IntegrationsPanel.tsx` | `ConnectionsOverview` tiles beside the open group: `PhoneConnection`, `VoiceSettingsSection`, `whatsapp/` (Cloud API, templates, behaviour), `WebsiteChatCard`, `WidgetAppearance`, `CalendarConnectCard`, `MeetingTypeCard`, `MessagingCards`, `CustomDomainGuide` |
| Alerts tab | `components/workspace/alerts/AlertsTab.tsx` | Recipients, daily recap, instant alerts, test send, on `SectionRail` |
| Automations tab | `features/automation/components/ClientAutomationsTab.tsx` | Per-client automations, on `AutomationRail` |
| Onboarding | `components/workspace/communication/` | `CommunicationProfilePanel`, `ProfileWizard`, `ServiceSteps`, `CallNotes`, `useCommunicationProfile`; `voiceWriteThrough.ts` (wizard save also PUTs `/api/accounts/:id/voice`, fire-and-forget) |
| SectionRail | `components/workspace/SectionRail.tsx` | `SectionLayout` + `SectionRail` + `SectionHeader`: the shared side tabs (UI_STANDARDS 3.6) |
| ReceptionistSettings | `components/workspace/receptionist/ReceptionistSettings.tsx`, `settingsLink.ts` | The Settings view of Calls (phone) and Chats (chat): account chooser, then `VoiceTab` or `ChatTab`. URL contract `?view=settings&account=&section=&focus=` |
| Phone settings | `components/workspace/voice/` | `VoiceTab` + `VoiceRail` (sections: overview, prompt & test, knowledge, call, after), `NumberCard` / `NumberOrderPlan` / `NumberDocsCard`, `PersonaCard`, `AgentVoiceCard` / `VoicePicker`, `TransferCard` (hold music: `HoldMusicPicker`, `holdMusic.ts`), `PromptSection` + `TestCard` (Owner), `ReadinessList` + `readiness.ts` (the header's phone-figure hover), `ReuseCards` (`AvailabilityCard` hours + `KBPanel`), `VoiceStatsRow`. Data: `voiceApi.ts`, `useVoiceLine.ts`, `useVoiceStats.ts`, `voicePromptsApi.ts`. Agency edits, clients read-only. i18n `voiceTab` |
| Chat settings | `components/workspace/chat/` | `ChatTab` (on `SectionRail`): `ChatOverview`, `ChatGreeting`, `ChatBehaviour`, `ChatFollowUp`, `ChatAdvanced` (Owner: the receptionist campaign's engine fields); data in `useChatCampaign.ts`, parts in `chatAtoms.tsx` |
| Knowledge base | `components/workspace/knowledge/` | `KBPanel`, `KBForm`, `KBCategory`, `useKnowledgeBase` |
| AccountCreatePanel | `components/AccountCreatePanel.tsx` | New account (right panel) |
| AccountCreateDialog / AccountDetailsDialog | `components/AccountCreateDialog.tsx`, `components/AccountDetailsDialog.tsx` | Only their types are used (`NewAccountForm`, `AccountRow`); the dialogs are never rendered |
| ReputationSettingsPanel | `components/ReputationSettingsPanel.tsx` | Used by the Reputation page's connection view |
| useAccountsData | `hooks/useAccountsData.ts` | |
| accountsApi | `api/accountsApi.ts` (+ `calendarApi`, `emailSenderApi`, `messagingApi`, `reviewsApi`, `widgetApi`) | |

---

## Billing Feature (`features/billing/`)

| Component | File | Notes |
|-----------|------|-------|
| BillingPage | `pages/BillingPage.tsx` | Feature page: desktop renders `components/workspace/BillingWorkspace.tsx`, mobile renders `components/mobile/MobileBillingView.tsx`. Owns data hooks, persisted selection, new-item notifications, account filter. `BillingContent` is reused by Settings > Billing |
| **BillingWorkspace** | `components/workspace/BillingWorkspace.tsx` | **Desktop shell**: topbar + 3-state list panel + inline detail/create area. Owns search/sort/filter/group/viewMode/panelMode |
| BillingTopBar | `components/workspace/BillingTopBar.tsx` | Tabs, fold, search, filter/sort/group, date+view (expenses), `+ New`, `⋯` |
| BillingListPanel | `components/workspace/BillingListPanel.tsx` | Left list panel (full/compact/hidden): per-tab list cards, grouping, pagination, compact rail + hover card |
| Invoice/Contract/ExpenseListCard | `components/workspace/*ListCard.tsx` | List cards (amount, status pill) |
| Invoice/Contract/ExpenseDetailPanel | `components/workspace/*DetailPanel.tsx` | Inline detail. Contract/Expense wrap `ContractDetailView` / the expense detail |
| BillingStatCards / CompactBillingCard | `components/workspace/*.tsx` | Per-tab stat chips, compact-rail tile |
| workspace atoms/adapters | `components/workspace/{atoms,adapters}.ts(x)` | StatusPill/StatCard/DedBadge and the status/expense grouping helpers |
| Mobile | `components/mobile/{MobileBillingView,MobileDetailSheets,mobilePrimitives}.tsx` | Phone billing |
| ContractsInlineTable | `components/ContractsInlineTable.tsx` | Contracts table |
| ContractDetailView | `components/ContractDetailView.tsx` | Contract detail |
| ContractCreatePanel | `components/ContractCreatePanel.tsx` | Contract creation form (reference panel implementation) |
| ContractUploadPanel | `components/ContractUploadPanel.tsx` | Contract PDF upload (right panel; nothing opens it yet) |
| InvoicesInlineTable | `components/InvoicesInlineTable.tsx` | Invoices table |
| InvoiceCreatePanel | `components/InvoiceCreatePanel.tsx` | Invoice creation form |
| ExpensesView / ExpensesListView | `components/ExpensesView.tsx`, `components/ExpensesListView.tsx` | Expenses |
| ExpenseCreatePanel | `components/ExpenseCreatePanel.tsx` | Expense creation form |
| ExpenseCreateDialog | `components/ExpenseCreateDialog.tsx` | Expense creation on phones (still a Dialog) |
| useContractsData / useInvoicesData | `hooks/*.ts` | |
| contractsApi / invoicesApi / expensesApi | `api/*.ts` | |
| types | `types.ts` | Billing-specific TypeScript types |
| contractTemplate | `utils/contractTemplate.ts` | Contract template utilities |
| invoiceDocument | `utils/invoiceDocument.ts` | Printable A4 invoice (EN/NL/PT), sender details, `printInvoice()`; logo at `client/public/invoice-logo.svg` |

---

## Calendar Feature (`features/calendar/` + `pages/Calendar.tsx`)

| Component | File | Notes |
|-----------|------|-------|
| DesktopCalendar | `components/DesktopCalendar.tsx` | Toolbar + agenda, week/month grid and detail panels (`DesktopCalendarHeader`, `DesktopCalendarToolbar`, `DesktopCalendarWeek`, `DesktopCalendarMonthAgenda`, `DesktopCalendarDetail`, `desktopCalendarShared`) |
| BlockPanel | `components/BlockPanel.tsx` | Create or edit a busy block (right panel; `MobileSheet` on phones) |
| BookAppointmentPopover | `components/BookAppointmentPopover.tsx` | Book an appointment (still a create form in a Popover) |
| hooks | `hooks/useCalendar{Appointments,Blocks,FreeBusy,WorkingHours}.ts` | |
| lib | `lib/calendarView.ts` (+ test), `lib/calendarDesign.ts`, `calendarPageUtils.ts` | |

---

## Social Feature (`features/social/`)

| Component | File | Notes |
|-----------|------|-------|
| SocialPage | `pages/SocialPage.tsx` | Account picker (agency), sections from `lib/socialPage.ts` (Posts, Studio, Comments, Settings; Insights sits apart, like Stats). Connect and the on/off switch stay in Accounts > Integrations |
| Posts | `components/SocialTab.tsx` | Calendar (`SocialCalendar`) + scheduled Reels by state, `PostSheet` / `PostCard`, `CaptionWriter`, `InstagramConnectCard`, `VideoLightbox` |
| ManagerHome | `components/ManagerHome.tsx` | The client's phone home: topic ideas, scripts to answer, videos to approve |
| Studio | `components/studio/` | `StudioSection`: Ideas, Scripts, the selected script (`ScriptPanel`, `ScriptCard`), tags, HeyGen picker |
| Insights | `components/insights/` | `InsightsSection`, tiles, charts, posts table |
| Comments | `components/comments/` | Comment-to-DM rules and log (agency) |
| Settings | `components/SocialSettingsSection.tsx`, `components/settings/` | The three texts the AI works from; `settings/upgrade/` |
| api | `api/{socialApi,studioApi,insightsApi,dmApi,tagsApi}.ts` | |
| lib | `lib/*.ts` | Pure logic with tests beside it |

---

## Demos Feature (`features/demos/`)

| Component | File | Notes |
|-----------|------|-------|
| DemosPage | `pages/DemosPage.tsx` | `PageTopbar` with tabs Sessions, Clients, Settings; "+ New demo" opens the create panel (a `RightPanel`) |
| Sessions | `components/sessions/` | `SessionsBody` (table or folder view, filters), `SessionsTopbarActions`, `SessionsFilterMenu`, `useSessionsState`, `useSessionsData` |
| Table | `components/table/` | `SessionsTable` > `ProspectTableRow`: `LinkCell`, `DbrQuoteCell`, `OtherCell`, `LinkStatusPill`, `LinkActionsPopover` (+ `linkActions.ts`), `SiteThumb`. Delete asks in `components/DeleteConfirmDialog.tsx` |
| Folders and detail | `components/folders/`, `components/detail/` | Folder view cards (`ProspectFolders`, `ProspectCard`) and the prospect panel (`ProspectDetailPanel`, `ProspectLinksList`, `OtherLinks` for live links outside the service columns, `ProspectNotes`, `ProspectSettingsForm`, hidden for a public website demo). Beside them: `notesSaver.ts` (ordered notes sends, so a delete never overtakes a note), `prospectDetail.ts` (counts and settings from a row), `serviceOf.ts` (which column a link belongs in), `touchTargets.ts` (the 44px phone classes) |
| Create panel | `components/create/`, `components/form/` | `CreateDemoPanel` with `ExistingClientFields`, `WebsiteScanFields`, `ScanProgress`, `ScanReviewStep`; shared fields `ClientPicker`, `LanguageSeg`, `MoreOptions`, `ProductListEditor`. The half-filled form survives in `createDraft.ts` + `useDemoDraft.ts` (localStorage); progress steps in `scanSteps.ts` |
| Row model | `prospectRows.ts`, `sessionsView.ts`, `tableColumns.ts` | One prospect per row (links, expiry, filters, sort, columns). Tests beside them |
| DemoSettingsTab | `components/DemoSettingsTab.tsx` | One `SectionRail` tile per service (from `services.ts`); the voice tile holds `EngineTestSettings`, `PublicDemoSettings` |
| DemoCampaignSettings | `components/DemoCampaignSettings.tsx` | Each service tile's demo campaign in the shared settings screen (`CampaignStageEditor` via `useCampaignById`); a Demo campaigns tile holds the rest |
| api | `api/{demoSessionsApi,demoProspectsApi,demoScanApi,demoSettingsApi,demoLogosApi,publicDemoApi}.ts` | |
| Demo personas | `features/campaigns/components/clients/` | See Campaigns Feature |
| Server: prospects | `server/demoProspects/` | `rows.ts` (grouping, settings), `linkGuards.ts` (public website demos take notes and delete only; a revoked link is not re-minted), `store.ts` (`Demo_Prospects` + `loadDemoLeadsLite`), `personaRewrite.ts` + `applySettings.ts` (a settings edit rewrites every token), `purge.ts` + `linkOps.ts` (delete, revoke, re-mint), `clientUsage.ts` (live links per persona), `cleanupPlan.ts`, `personaPrune.ts`. Routes `server/routes/demoProspects.ts` (+ `demoProspectSchemas.ts`), `server/routes/demoPersonas.ts` (from-niche, translate) |
| Server: scan | `server/demoSiteFacts.ts`, `server/demoClientProducts.ts`, `shared/{demoProducts,demoTokenTtl,demoProspects}.ts` | Site facts into the generator, products / stock URL / city / phone on the Client, link lifetime (7 days chat, 14 days voice), shared types |
| One-off scripts | `script/demo-links-cleanup.ts`, `script/demo-clients-rescan.ts`, `script/demo-personas-prune.ts`, `script/create-demos-redesign-columns.mjs` | Cleanup, re-scan and prune are dry runs by default (`--execute --confirm=<N>` to act); the columns script is additive DDL |

---

## Tags (`features/tags/`)

No page any more (`/platform/tags` redirects Home) and nothing imports this folder. Campaign tags are created with the campaign (`features/campaigns/lib/campaignWrites.ts`).

---

## Prompts Feature (`features/prompts/`)

| Component | File | Notes |
|-----------|------|-------|
| PromptsPage | `pages/PromptsPage.tsx` | Feature page (phones: `MobilePromptsView`) |
| PromptsListView | `components/PromptsListView.tsx` | Split-pane list view: area tabs (Chat, Voice, CRM, Social, Test, Reputation, Niche Words), 380px list with a Demo switch, `PromptEditorPanel` with the preview beside it by default, `NicheVocabularyPanel` (`niche/`) |
| promptList parts | `components/promptList/` | `PromptListCard` (card, compact rail, group header, Demo chip), `PromptCategoryTabs` (+ list strip), `PromptDetailHeader` (area select, Demo toggle), `PromptListControls` (sort/filter/group), `PromptVersionControls` (font, save version, history), `usePromptVersions` |
| Areas | `promptCategories.ts` | `Prompt_Library.category` / `is_demo`, use_case fallback, area colors, `isVoiceUseCase` (voice_*, eleven_*) |
| PromptPreviewSections | `components/PromptPreviewSections.tsx` | Heading-folding preview body shared by the normal and the voice preview |
| PromptsInlineTable | `components/PromptsInlineTable.tsx` | Table view |
| PromptsToolbar | `components/PromptsToolbar.tsx` | Toolbar |
| PromptFormPanel | `components/PromptFormPanel.tsx` (+ `.css`) | Create/edit form (right panel) |
| PromptEditorPanel | `components/PromptEditorPanel.tsx` (+ `PromptCodeEditor`, `PromptVariableAutocomplete`, `VoicePreviewPane`: engine render per real account, sent as accountId) | Prompt editor; also opened from the hidden Campaigns page |
| DeletePromptDialog | `components/DeletePromptDialog.tsx` | Delete confirmation |
| utils | `utils/{promptDecorations,resolveVariables}.ts` | |
| types | `types.ts` | Prompt type definitions, `MODEL_OPTIONS` |

---

## Users Feature (`features/users/`)

| Component | File | Notes |
|-----------|------|-------|
| SettingsTeamSection | `components/SettingsTeamSection.tsx` | Settings > Users: team management, form state and saves |
| EditUserPanel | `components/EditUserPanel.tsx` | "Edit profile" form (right panel) |
| UsersCardGrid / UsersInlineTable | `components/*.tsx` | Card and table views with group collapse |
| TwoFactorResetButton | `components/TwoFactorResetButton.tsx` | Owner "Reset 2FA" |
| types | `types.ts` | User type definitions |

---

## Shared UI Components (`components/ui/`)

### Custom Components (project-specific)
| Component | File | Notes |
|-----------|------|-------|
| IconBtn | `icon-btn.tsx` | Standard 36px circle button: use for round icon actions outside the topbar |
| EntityAvatar | `entity-avatar.tsx` | Lead/Account/Campaign/User avatars: single source of truth |
| Skeleton | `skeleton.tsx` | Loading skeleton components (incl. the side-tab skeleton) |
| ViewTabBar | `view-tab-bar.tsx` | Retired Style B tab switcher (still in the Outreach inbox and the leads list panel) |
| SearchPill | `search-pill.tsx` | Retired Style B search (use `ExpandingSearch`) |
| DonutChart | `donut-chart.tsx` | Chart visualization |
| ColorPickerWidget / gradient-tester | `color-picker-widget.tsx`, `gradient-tester.tsx` | Background gradient tools (support chat, shell) |
| DoodlePatterns | `doodle-patterns.tsx` | Chat background patterns |
| CollapsibleSection / SimpleSelect | `collapsible-section.tsx`, `simple-select.tsx` | Used by Prospects |
| PullToRefreshIndicator | `PullToRefreshIndicator.tsx` | Phone pull-to-refresh |
| iPhone frame / DottedSurface | `iphone-16-pro.tsx`, `dotted-surface.tsx` | Voice demo phone; FAQ background |

### shadcn/ui (standard library)
All standard shadcn/ui components are in `components/ui/`: `alert-dialog`, `avatar`, `badge`, `button`, `card`, `checkbox`, `command`, `dialog`, `dropdown-menu`, `hover-card`, `input`, `label`, `popover`, `progress`, `radio-group`, `scroll-area`, `select`, `separator`, `sheet`, `slider`, `switch`, `table`, `textarea`, `toast`, `toaster`, `tooltip`. Many more are installed but unused (see Unused code).

---

## Hooks (`hooks/`)

| Hook | File | Notes |
|------|------|-------|
| useSession | `useSession.ts` | Auth session, user role, workspace |
| useWorkspace | `useWorkspace.ts` | Account/workspace context (`isAgencyUser`, `currentAccountId`) |
| useIsMobile | `useIsMobile.ts` | Always pass 768 (its default is 640). `use-mobile.tsx` is the shadcn copy |
| useListPanelState | `useListPanelState.ts` | The one shared list state: full / compact / hidden |
| usePersistedState / usePersistedSelection | `usePersistedState.ts`, `usePersistedSelection.ts` | localStorage-backed state; persisted selected lead/campaign |
| useApiData | `useApiData.ts` | Generic data fetching wrapper (incl. `useCampaignMetrics`) |
| useTheme | `useTheme.tsx` | Dark mode toggle |
| useNotificationStream | `useNotificationStream.ts` | Real-time notifications (SSE) |
| useImpersonation | `useImpersonation.ts` | View-as |
| useServicePageToggles | `useServicePageToggles.ts` | Owner switches for the hidden service pages |
| useSupportChat / useFounderChat | `useSupportChat.ts`, `useFounderChat.ts` | Support chat widget; founder chat |
| useChatDoodle / useBgSlots | `useChatDoodle.ts`, `useBgSlots.ts` | Chat doodle and background slots |
| useClaudeApiKey | `useClaudeApiKey.ts` | AI agents' API key setup |
| others | `useCountry`, `useDeleteAction`, `useFKeyScrollToSelected`, `usePullToRefresh`, `useRotatingLabel`, `useScoreBreakdown` | |
| use-toast | `use-toast.ts` | Toast notifications |

---

## Data & API (`lib/`)

| File | Path | Notes |
|------|------|-------|
| apiFetch | `lib/apiUtils.ts` | Use for standard GET requests |
| queryClient + apiRequest | `lib/queryClient.ts` | Use for mutations / TanStack Query |
| utils | `lib/utils.ts` | `cn()` and general helpers |
| avatarUtils | `lib/avatarUtils.ts` | **Avatar colors, initials, PIPELINE_HEX, status hex maps**: single source of truth |
| leadLink | `lib/leadLink.ts` | The lead's one home: `leadPath()` / `openLead()` (`/platform/chat?lead=<id>`) |
| landingPage | `lib/landingPage.ts` | Per-user landing page, `LANDING_OPTIONS` |
| lastTab | `lib/lastTab.ts` (+ test), `hooks/useLastTab.ts` | The tab a user last opened on a page, per user: Calls, Chats, Settings, Accounts, Billing, Demos, Socials, Reputation, Docs, Prompt Library, Missed calls, Speed to lead, and the section rails of Calls / Chats > Settings, Accounts > Alerts and Demos > Settings. A link (?tab=, ?section=, ?view=settings) still wins |
| userPrefs / userLanguage / languages | `lib/{userPrefs,userLanguage,languages}.ts` | `Users.preferences` parsing, saved language, UI languages |
| founderChat | `lib/founderChat.ts` | Open the founder chat with a draft |
| pageAccents | `lib/pageAccents.ts` | Per-page accent color map |
| others | `lib/{businessInitials,haptics,richTextUtils,voiceRecorder}.ts(x)` | |

---

## Styling & Tokens

| File | Path | Notes |
|------|------|-------|
| Global CSS entry | `client/src/index.css` | Font imports + Tailwind + imports every file in `styles/` |
| Colors (light + dark) | `client/src/styles/variables.css` | The only file allowed to define a color |
| Geometry, shadows, component classes | `client/src/styles/design-system.css` | |
| Neumorphic utilities | `client/src/styles/neu.css` | |
| Tailwind token map | `client/src/styles/tokens.css` | |
| List classes | `client/src/styles/components.css` | `.la-list-area`, `.la-cards`, `.la-camp-card`, `.la-mono-tile` |
| UI Standards | `UI_STANDARDS.md` | Rules, tokens, bans, design decisions |
| UI Patterns | `UI_PATTERNS.md` | Implementation patterns, exact markup |
| Type models | `client/src/types/models.ts` | Lead, Campaign, Account, User TS types |
| DB schema reference | `shared/schema.ts` | Drizzle ORM schema definitions |

---

## Tasks Feature (`features/tasks/`)

| Component | File | Notes |
|-----------|------|-------|
| TasksPage | `pages/TasksPage.tsx` | Thin orchestrator: data/SSE, mobile vs desktop switch |
| DesktopTasksView | `components/DesktopTasksView.tsx` | Desktop: top-bar controls + merged board/calendar + shared drag + detail modal |
| MobileTasksView | `components/MobileTasksView.tsx` | Mobile: agenda/board views + mobile panels (`MobileTaskWeekStrip`) |
| TasksBoardView | `components/TasksBoardView.tsx` | Kanban columns by status (droppable; drag handled by parent) |
| TasksBoardCard | `components/TasksBoardCard.tsx` | Kanban/board task card |
| TasksWeekCalendar | `components/TasksWeekCalendar.tsx` | Compact week agenda (droppable days); exports week date helpers |
| TaskDetailPanel | `components/TaskDetailPanel.tsx` | Task detail (glass modal on desktop) |
| TaskDetailSections / ActivitySection | `components/TaskDetailSections.tsx`, `components/ActivitySection.tsx` | Comments / attachments / subtasks / activity |
| MobileTaskCreatePanel | `components/MobileTaskCreatePanel.tsx` | Task creation (mobile) |
| MobileTaskDetailPanel | `components/MobileTaskDetailPanel.tsx` | Task detail (mobile) |
| MobileTaskListCard | `components/MobileTaskListCard.tsx` | Mobile task cards + `MTAvatar`/`MTGroupBar`/date helpers |
| taskViewUtils | `lib/taskViewUtils.ts` | Shared `loadLocal`/`saveLocal`/`applyDesktopFilter`/`AVATAR_BG`/`DesktopFilter` |
| TagVisibilityContext | `context/TagVisibilityContext.tsx` | Tag visibility toggle state |
| tasksApi | `api/tasksApi.ts` | |
| types | `types.ts` | `Task`, `ViewMode`, `STATUS_COLORS`, sort/category types |

---

## Automation Feature (`features/automation/`)

| Component | File | Notes |
|-----------|------|-------|
| api | `api.ts` | Query hooks: `useAutomationsOverview`, `useAutomationDiary`, `useClientAutomations` |
| labels | `labels.ts` | i18n label helpers: `automationName`, `triggerLabel`, `actionLabel`, `reasonLabel`, `summaryText`, `timeAgo` |
| status | `status.ts` | Health folded into 4 buckets (fine / needs a look / broken / waiting), colors, service icons, pulse sums |
| changeLinks | `changeLinks.ts` | Where to fix an automation; kind `campaign_section` still opens the hidden Campaigns page |
| automation.css | `automation.css` | Scoped `.am-*` styles: status dot, pulse bars, row grid (container queries), diary timeline |
| AutomationRail | `components/AutomationRail.tsx` | Service side tabs (`SectionRail`) with failure counts, for Automation logs and the per-client tab |
| ClientAutomationsTab | `components/ClientAutomationsTab.tsx` (+ `ClientLineRow`) | Accounts > Automations |
| OverviewHero | `components/OverviewHero.tsx` | Page hero: one-sentence verdict, bucket counts, 24h pulse |
| ServiceSection | `components/ServiceSection.tsx` | One service card with header verdict and its rows |
| AutomationRow | `components/AutomationRow.tsx` | One automation row (status, trigger, mini pulse, 24h actions, clients, last activity) |
| PulseBars / HealthDot | `components/PulseBars.tsx`, `components/HealthDot.tsx` | 24 hourly bars; breathing status dot |
| DiaryTimeline | `components/DiaryTimeline.tsx` | Diary lines grouped by day on a timeline rail |
| DiaryPanel | `components/DiaryPanel.tsx` | Per-automation diary (paged, failures-only filter, opens lead); reused by the per-client tab |
| ClearFailuresButton | `components/ClearFailuresButton.tsx` | Resolve failures |
| automationCatalogue | `shared/automationCatalogue.ts` | Catalogue of every automation: service group, trigger, `SERVICE_ORDER`, `findEntry` |
| automationTypes | `shared/automationTypes.ts` | Overview / diary / per-client response types |
| server automations | `server/automations/*`, `server/routes/automation.ts` | Health rules, per-client gates, overview and per-client builders (Owner-only routes) |
| automationDiary | `server/storage/automationDiary.ts` | Diary read/write storage (90-day retention) |

---

## Home Dashboard (`features/home/` + server)

Client files are in the Home row of the pages table above. Server and shared files:

| Component | File | Notes |
|-----------|------|-------|
| routes | `server/routes/home.ts`, `server/routes/homeScope.ts` | `GET /api/home/{services,overview,phone,whatsapp,website,reactivation,reputation,social}` plus `/api/home/reactivation/live`; `homeScope` resolves account + period (clients, view-as and any user off account 1 are locked to their own account; junk period falls back to `month`). Tests: `homeScope.test.ts` |
| Home storage | `server/storage/home{Services,Overview,Phone,Messaging,Website,Reactivation,ReactivationLive,Reputation,Social}.ts` | One `getHome*` method each (spread into the `storage` barrel) |
| homeSql | `server/storage/homeSql.ts` | Shared SQL fragments (live lead, live call, receptionist stream, needs callback, human reply), table names, period bounds in the account timezone. Fixed aliases: `i` Interactions, `l` Leads, `c` Campaigns, `vc` Voice_Calls |
| homePeriod | `shared/homePeriod.ts` | Period to date range (`periodDates`, `eachDay`, `todayIn`, `isHomePeriod`). Tests: `homePeriod.test.ts` |
| homeTypes | `shared/homeTypes.ts` | Response shapes for the endpoints, `HomePeriod`, `HomeChannel` |
| interactionChannel | `server/storage/interactionChannel.ts` | `manualReplyChannel`: the `Interactions.channel` stamp for a reply typed in the CRM (the engine stamps its own rows). Tests: `interactionChannel.test.ts` |

---

## Traffic Feature (`features/traffic/`)

Who finds the public site (www.leadawaker.com). Owner only, nav bar under Backend.

| Component | File | Notes |
|-----------|------|-------|
| TrafficPage | `pages/TrafficPage.tsx` | Page shell: period switch (7/28/90 days), refresh, two columns |
| api | `api.ts` | `useVisits`, `useSearch`, `useIndexStatus`, `refreshTraffic` (skips the server cache) |
| format | `format.ts` | Numbers, dates, country / language / time-zone names |
| StatStrip | `components/StatStrip.tsx` | Visits, AI-assistant visits, Google clicks, times shown, each vs the period before |
| VisitorsCard | `components/VisitorsCard.tsx` | The site's own counter: per day, sources, pages, language / device / time zone |
| SearchCard | `components/SearchCard.tsx` | Search Console: per day, searches, pages, countries |
| IndexCard | `components/IndexCard.tsx` | Each sitemap page's index status + other hostnames Google shows |
| parts | `components/parts.tsx` | `CardHead`, `Block`, `DayBars`, `RankList` |
| traffic.css | `traffic.css` | Scoped `.tf-*` styles (container queries: `tf-page`, `tf-card`) |
| trafficTypes | `shared/trafficTypes.ts` | Response shapes for the three endpoints |
| routes | `server/routes/traffic.ts` | `GET /api/traffic/{visits,search,index}` (Owner) + public `POST /api/site/visit` |
| searchConsole | `server/traffic/searchConsole.ts` | Search Console reads (server's Google login, in-memory cache: 3h / 12h) |
| sources, visit | `server/traffic/{sources,visit}.ts` | Referrer/utm to channel + name (on read); payload checks for the counter. Tests: `traffic.test.ts` |
| siteVisits | `server/storage/siteVisits.ts` | `Site_Visits` table: record, overview, 25-month prune |
| visit.js | `client/public/site/visit.js` | The counter's beacon. Its tag is added at build by `script/build-site.ts` (`COUNT_VISITS`, off until the privacy policy mentions it) |

---

## AI Agents Feature (`features/ai-agents/`)

Hidden until finished: the pages open by URL only. The floating widget (`AgentChatWidget`) is still visible.

| Component | File | Notes |
|-----------|------|-------|
| AgentsPage | `pages/AgentsPage.tsx` | Feature page |
| AgentChatPage | `pages/AgentChatPage.tsx` | Full-page chat view |
| AgentChatView | `components/AgentChatView.tsx` | Chat messages + streaming UI |
| AgentChatWidget | `components/AgentChatWidget.tsx` (+ `AgentChatWidgetHeader`, `agentWidgetUtils`) | Floating widget version |
| ConversationPanel / ConversationTabs / AgentPicker | `components/*.tsx` | Widget conversations and agent choice |
| AgentSettingsSheet | `components/AgentSettingsSheet.tsx` | Agent settings slide-over |
| SubAgentPill | `components/SubAgentPill.tsx` | Sub-agent status pill |
| MarkdownRenderer | `components/MarkdownRenderer.tsx` | Markdown output renderer |
| ModelSwitcher | `components/ModelSwitcher.tsx` | Claude model selector |
| ThinkingToggle | `components/ThinkingToggle.tsx` | Extended thinking toggle |
| ElementPickerOverlay | `components/ElementPickerOverlay.tsx` | DOM element picker overlay for agent context |
| useAgentChat | `hooks/useAgentChat.ts` | Chat state, streaming, session management |
| useElementPicker | `hooks/useElementPicker.ts` | Element picker interaction logic |
| usePageContext | `hooks/usePageContext.ts` | Current page context for agent |
| chatSyncBus | `hooks/chatSyncBus.ts` | Cross-component chat event bus |

---

## Two-Factor Authentication (`specs/two-factor-auth/`)
Login stops after the password when the user has a method; the session is issued only after `/api/auth/2fa/verify`.

| File | Purpose |
|------|---------|
| `server/twoFactor/pending.ts` | Pending-2FA session state, `finishLogin`, `toSafeUser`, `stripSecrets`, step-up |
| `server/twoFactor/{totp,backupCodes,emails,factors,crypto,rateLimit}.ts` | TOTP (RFC 6238, no dependency), backup codes, 2FA emails, factor checks |
| `server/twoFactor/{trustedDevice,policy,audit,webauthn}.ts` | 30-day trusted-device cookie `la_td`, require-2FA policy + enrollment middleware, audit log writer, WebAuthn config |
| `server/storage/twoFactor.ts` | Raw-SQL storage for all 2FA tables (Users TOTP columns, passkeys, backup codes, devices, policy, events) |
| `server/routes/twoFactor.ts` / `server/routes/twoFactorPasskeys.ts` | `/api/auth/2fa/*`: verify, status, step-up, TOTP, email, backup codes, devices, passkeys |
| `server/routes/twoFactorAdmin.ts` | Owner only: `/api/admin/security-policy`, per-account override, user 2FA reset, security events |
| `scripts/migrate-two-factor.mjs` | Idempotent migration for every 2FA table and column |
| `client/public/login.html` | Static login page, includes the second-step panel (plain JS, en/nl/pt) |
| `client/src/features/settings/components/TwoFactorCard.tsx` | Settings > Profile card (methods, backup codes, trusted devices) |
| `client/src/features/settings/components/{TwoFactorPolicyCard,SecurityLogCard}.tsx` | Owner cards in Settings > Preferences |
| `client/src/features/settings/twoFactor/` | Panels (TOTP, email, passkey, backup, step-up), `useTwoFactor`, `TwoFactorNotice` (grace toast / forced redirect) |
| `client/src/features/users/components/TwoFactorResetButton.tsx` | Owner "Reset 2FA" in the team user detail panel |

## Prospects Feature (`features/prospects/`)

| Component | File | Notes |
|-----------|------|-------|
| ProspectsPage | `pages/ProspectsPage.tsx` | Feature page |
| AppProspects | `pages/AppProspects.tsx` *(in `pages/`)* | Route wrapper |
| ProspectListView | `components/ProspectListView.tsx` (+ `ProspectListCards`, `useProspectListFiltering`) | Split-pane list view |
| ProspectsInlineTable | `components/ProspectsInlineTable.tsx` | **Reference implementation** for inline-editable tables (`useInlineEditing`) |
| OutreachPipelineView | `components/OutreachPipelineView.tsx` | Outreach pipeline kanban |
| ProspectDetailView | `components/ProspectDetailView.tsx` (+ `ProspectDetailHeader`, `ProspectDetailPanels`, `CompanyTab`, `ContactTab`) | Right panel detail |
| EmailComposePanel | `components/EmailComposePanel.tsx` | Compose an email to a prospect (right panel) |
| Composers | `components/{EmailComposer,WhatsAppComposer,LinkedInComposer,MessageGenerator,PhoneDialer}.tsx` | Outreach messages |
| Enrichment | `components/{EnrichDropdown,EnrichmentPanel,CompanyAuditSection,StructuredBrief,PostsCarousel}.tsx` | Company research |
| ProspectCreatePanel | `components/ProspectCreatePanel.tsx` | Creation form |
| OutreachTimeline | `components/OutreachTimeline.tsx` | Outreach interaction history |
| ProspectTasks | `components/ProspectTasks.tsx` | Tasks linked to a prospect |
| OutreachTemplatesView | `components/OutreachTemplatesView.tsx` | Outreach message templates |
| useProspectsData / useProspectsPaginated | `hooks/*.ts` | Prospects data hooks |
| prospectsApi | `api/prospectsApi.ts` | API calls for prospects |
| outreachTemplatesApi | `api/outreachTemplatesApi.ts` | API calls for outreach templates |

---

## Smaller Features

| Feature | Files | Notes |
|---------|-------|-------|
| Reputation | `features/reputation/` | Reputation page (see pages table) |
| Speed to Lead | `features/speed-to-lead/` | Hidden page, mock data (`data/mockMetrics.ts`) |
| Missed calls | `features/voice/` | Hidden page, mock data; `components/atoms.tsx` (`MonoLabel`) is also used by Calls |
| Cadence | `features/cadence/` | Hidden page: outreach cold-call queue |
| Docs | `features/docs/` | `ClientGuide`, `ReactivationGuide`, `docParts`, `illustrations/` for `pages/Docs.tsx` |
| Voice demo | `features/voiceDemo/` | The public `/voice-demo` page: `engine.ts`, `useLiveCall.ts`, phone/transcript/CRM panels |
| Review demo | `features/reviewDemo/` | The public `/review-demo` page |

---

## Unused code (no importers, checked 2026-10-22)

Nothing reachable from `main.tsx` imports these. Delete them or wire them up; don't build on them.

- `components/crm/`: `ActivityFeed`, `AgendaWidget`, `ChatBubble`, `DbStatusIndicator`, `FiltersBar`, `HelpMenu`, `InteractionsChat`, `LeadCard`, `ManualSend`, `MobileSupportPanel`, `NotificationsPanel`, `SupportChat`, `ViewTabStrip`
- `components/`: `LeadDetailLayout.tsx`, `LeadReactivationAnimation.tsx`, `siriOrb/SiriOrb.tsx`
- `features/campaigns/`: `components/CampaignExecutionHistory.tsx`, `components/CampaignTagsSection.tsx` + `hooks/useCampaignTags.ts`, `components/columns/` (all four files)
- `features/leads/`: `components/{LeadCard,LeadFilters,LeadsFiltersBar,LeadsListRow}.tsx`, `hooks/useLeadsData.ts`
- `features/conversations/`: `components/ChatPanel.tsx`, `components/chatView/{ChatPanelMain,runWrappers}.tsx`
- `features/tags/` (the whole folder)
- `features/accounts/`: `components/{AccountsInlineTable,AccountsTable}.tsx`, `components/workspace/useUltraWide.ts`
- `features/billing/components/{InvoiceDetailView,ExpenseDetailView}.tsx`
- `features/prompts/components/{PromptsCardView,PromptSearchBar}.tsx`
- `features/prospects/components/{InteractionTimeline,ProspectBusinessIdeas}.tsx`
- `features/ai-agents/components/AgentConversationList.tsx`
- `hooks/`: `useActivityFeed`, `useCurrency`, `useHealthCheck`, `useLeads`, `useMediaQuery`, `useSwipeGesture`
- `components/ui/`: `accordion`, `alert`, `aspect-ratio`, `aurora-background`, `background-paths`, `breadcrumb`, `button-group`, `calendar`, `carousel`, `collapsible`, `context-menu`, `design-token-panel`, `drawer`, `empty`, `falling-pattern`, `field`, `form`, `git-hub-calendar`, `input-group`, `input-otp`, `item`, `kbd`, `menubar`, `navigation-menu`, `pagination`, `resizable`, `sidebar`, `sonner`, `spinner`, `tabs`, `testimonial-carousel`, `toggle-group`, `toggle`, `toolbar-pill`

---

## Server (`server/`)

| Area | File | Notes |
|------|------|-------|
| Routing | `server/routes/index.ts` + domain files in `server/routes/` | `routes.ts` (monolith) was **deleted**: routing lives here. Account scoping helpers (`ownsAccount`, `canWriteLead`, `accountIdFor`) in `server/routes/_helpers.ts` |
| Storage | `server/storage.ts` (barrel) | Methods live in `server/storage/` domain modules: `{accounts,prospects,campaigns,leads,leadsPage,interactions,automation,notifications,billing,tasks,agents,calendar,misc,types}.ts`, plus `home*`, `voice*`, `social*`, `twoFactor`, `siteVisits` |

---

## Documentation Index

| Doc | Purpose |
|-----|---------|
| `CLAUDE.md` | Project overview, critical rules, tech stack, key reference files |
| `README.md` | The overall picture and how to run it |
| `UI_STANDARDS.md` | Design system: colors, spacing, typography, coding rules |
| `UI_PATTERNS.md` | Implementation patterns: exact markup, component anatomy |
| `FILE_MAP.md` | This file: quick component lookup |
| `EXPENSES.md` | Expenses feature: DB, BTW/VAT, PDF parsing, architecture |
| `docs/superpowers/plans/2026-10-22-crm-unification-and-handover.md` | The handover plan and its decisions |
| `specs/<feature>/` | Feature specs: requirements.md, implementation-plan.md, action-required.md |
| `/home/gabriel/automations/CLAUDE.md` | Python automation engine: WAT architecture, bump/campaign launcher, AI conversation pipeline, guardrails, logging patterns |
