# FILE_MAP — LeadAwakerApp Quick Reference

Read this file to locate any component without running grep/glob searches.

> **Future Claude:** If you discover a file that's missing, mislabeled, or outdated here — add it, correct it, or remove it. This file only has value if it stays accurate and complete.

---

## Pages (route-level)

### Post-Login App Pages

CRM routes are registered in `pages/app.tsx`; top-level routes in `App.tsx`. **Every route component is `React.lazy`** — new pages must be added the same way (lazy import + route), never as static imports.

| Page | Path | Notes |
|------|------|-------|
| App shell wrapper | `pages/app.tsx` | Authenticated layout root, role-based routing, all routes lazy |
| Leads | `features/leads/pages/LeadsPage.tsx` | Imported directly in app.tsx (no pages/ wrapper) |
| Campaigns (landing) | `pages/AppCampaigns.tsx` | Wraps `features/campaigns/pages/CampaignsPage` — **default landing page** |
| Outreach Inbox | `pages/OutreachInbox.tsx` | Prospect chat (replaced the retired Chats page) |
| Prospects | `pages/AppProspects.tsx` | Wraps `features/prospects/pages/ProspectsPage` |
| Cadence | `pages/AppCadence.tsx` | Outreach cadence queue |
| Calendar | `pages/Calendar.tsx` | Booking / time slots |
| Accounts | `pages/AppAccounts.tsx` | Wraps `features/accounts/pages/AccountsPage` — agency admin only |
| Tasks | `features/tasks/pages/TasksPage.tsx` | Imported directly in app.tsx |
| Billing | `features/billing/pages/BillingPage.tsx` | Imported directly in app.tsx (invoices/contracts/expenses) |
| Prompt Library | `features/prompts/pages/PromptsPage.tsx` | Imported directly in app.tsx |
| AI Agents | `features/ai-agents/pages/AgentsPage.tsx` + `AgentChatPage.tsx` | Imported directly in app.tsx |
| Automation Logs | `pages/AutomationLogs.tsx` | Python automation-engine logs — agency admin only |
| Settings | `pages/Settings.tsx` | Thin composition; sections live in `features/settings/components/{ProfileSection,NotificationsSection,DashboardSection,SettingsMobileHub,SettingsFields}.tsx` + `features/settings/types.ts` |
| Docs | `pages/Docs.tsx` | In-app Operator Manual + Client Guide |
| Lead Detail (standalone) | `pages/LeadDetail.tsx` | Full-page lead view |
| Prospect Detail (standalone) | `pages/ProspectDetail.tsx` | Full-page prospect view |
| Invoices (redirect) | `pages/Invoices.tsx` | Redirects to billing |
| Opportunities (redirect) | `pages/Opportunities.tsx` | Redirects to leads |
| Accounts (test) | `pages/Accounts.tsx` | Mounted at `/test-table` only |
| Accept Invite | `pages/AcceptInvite.tsx` | Invite acceptance flow |

> Deleted — do not look for: `pages/Conversations.tsx`, `pages/AppLeads.tsx`, `pages/Tags.tsx`, `pages/PromptLibrary.tsx`, `pages/SetupProfile.tsx`, `pages/Billing.tsx`, `components/crm/LeadsTable.tsx`, `lib/pwa.ts`, `server/routes.ts`, `client/src/migration/`.

### Public / Pre-Login Pages

The marketing site (leadawaker.com landing) is static files in `client/public/premium/` — see its own FILE_MAP. The old React marketing pages live in `client/src/legacy/` (served at `/legacy` only). Top-level public routes (`App.tsx`, all lazy):

| Page | Path | Notes |
|------|------|-------|
| FAQ | `pages/faq.tsx` | `/about` redirects here |
| Cases | `pages/cases.tsx` | `/services` redirects here |
| Book Call | `pages/book-call.tsx` | |
| Intake Demo | `pages/intake-demo.tsx` | `/intake/:token` |
| Legacy Home | `legacy/LegacyRoute.tsx` | `/legacy` |
| Privacy Policy | `pages/privacy-policy.tsx` | |
| Terms of Service | `pages/terms-of-service.tsx` | |
| Canvas | `pages/canvas.tsx` | |
| Not Found | `pages/not-found.tsx` | |

> All paths below are relative to `client/src/`. `…/` = the feature's base directory.

---

## App Shell & Navigation (`components/crm/`)

| Component | File | Notes |
|-----------|------|-------|
| CrmShell | `CrmShell.tsx` | Sidebar + topbar wrapper, layout offsets |
| RightSidebar | `RightSidebar.tsx` | Nav, collapse, DbStatusIndicator |
| Topbar | `Topbar.tsx` | Search, bell, theme toggle, profile, ? help menu |
| SettingsPanel | `SettingsPanel.tsx` | Settings drawer (account settings sidebar) |
| NotificationCenter | `NotificationCenter.tsx` | Bell dropdown — message, takeover, booking, campaign notifications |
| CommandPalette | `CommandPalette.tsx` | Cmd+K global search across leads/campaigns/accounts |
| SupportChatWidget | `SupportChatWidget.tsx` | Full support chat with doodle bg, draw/emoji tools |
| SupportChat | `SupportChat.tsx` | Support chat trigger/launcher |
| AgendaWidget | `AgendaWidget.tsx` | Calendar upcoming-items widget |
| ActivityFeed | `ActivityFeed.tsx` | Timeline feed for detail panels |
| BookedCallsKpi | `BookedCallsKpi.tsx` | KPI card component |
| CampaignPerformanceCards | `CampaignPerformanceCards.tsx` | Dashboard metric cards |
| DateRangeFilter | `DateRangeFilter.tsx` | Shared date range filter |
| SearchModal | `SearchModal.tsx` | Global search modal |
| DbStatusIndicator | `DbStatusIndicator.tsx` | 34px circle + status dot badge |
| ConnectionBanner | `ConnectionBanner.tsx` | DB connectivity indicator |
| DataEmptyState | `DataEmptyState.tsx` | Shared empty-state placeholder |
| entityList/ | `primitives/` sibling `entityList/` | Shared list infra: `buildEntityRows()`/`groupItemsToMap()` (stateless filter→sort→group→flatten helpers used by Tags/Prompts/Prospects/Billing list views) + `useEntityList`/`EntityListView` (state-owning hook + card-list shell, available for future use) |
| ApiErrorFallback | `ApiErrorFallback.tsx` | API error display |
| ErrorBoundary | `ErrorBoundary.tsx` | React error boundary |
| ChangePasswordDialog | `ChangePasswordDialog.tsx` | Password change form |
| PageTransition | `PageTransition.tsx` | Route transition wrapper |

**Legacy/Specialized CRM Components** (not commonly modified):
`HelpMenu`, `NotificationsPanel`, `ManualSend`, `ChatBubble`, `LeadCard`, `LeadsTable` (CRM-level wrapper), `InteractionsChat`, `FiltersBar`, `ViewTabStrip`

---

## Leads Feature (`features/leads/`)

| Component | File | Notes |
|-----------|------|-------|
| LeadsPage | `pages/LeadsPage.tsx` | Feature page wrapper |
| LeadsTable | `components/LeadsTable.tsx` | **Main container** — view switching, filters, search, data |
| LeadsCardView | `components/LeadsCardView.tsx` | D365-style split-pane **list view** — also contains `LeadDetailView` (desktop detail panel) and `MobileLeadDetailPanel` (mobile full-screen overlay). **Edit lead detail for list view here, NOT in LeadDetailPanel.tsx.** |
| LeadsKanban | `components/LeadsKanban.tsx` | Drag-drop kanban columns |
| LeadsInlineTable | `components/LeadsInlineTable.tsx` | Virtualized table view |
| LeadDetailPanel | `components/LeadDetailPanel.tsx` | Full slide-over Sheet used in **table view, kanban, calendar, and opportunities only** — NOT used in list view. Now a composition; sections/helpers live in `components/leadDetail/` |
| leadDetail/ | `components/leadDetail/` | Sections + helpers split out of LeadDetailPanel: `types.ts`, `format.ts` (date/AI-memory/score-context), `badges.tsx`, `atoms.tsx` (InfoRow/SectionTitle/InlineEditField), `ScorePanel.tsx`, `LeadInteractionTimeline.tsx`, `LeadScoreSection.tsx`, `LeadTagsSection.tsx`, `LeadNotesSection.tsx`, `index.ts` (barrel) |
| LeadFilters | `components/LeadFilters.tsx` | Filter UI |
| PipelineToolbar | `components/PipelineToolbar.tsx` | Kanban pipeline toolbar (legacy ToolbarPill usage) |
| CsvImportWizard | `components/CsvImportWizard.tsx` | CSV lead import flow |
| OpportunitiesPage | `pages/OpportunitiesPage.tsx` | Opportunities sub-view |
| useLeadsData | `hooks/useLeadsData.ts` | Main leads data hook |
| leadsApi | `api/leadsApi.ts` | API calls for leads |

---

## Campaigns Feature (`features/campaigns/`)

| Component | File | Notes |
|-----------|------|-------|
| CampaignsPage | `pages/CampaignsPage.tsx` | Feature page — split-pane |
| CampaignListView | `components/CampaignListView.tsx` | Left panel card list + top bar |
| CampaignListCard | `components/CampaignListCard.tsx` | CampaignListCard, GroupHeader, ListSkeleton |
| CampaignFilterSheet | `components/CampaignFilterSheet.tsx` | Mobile filter bottom sheet |
| CampaignDetailView | `components/CampaignDetailView.tsx` | Right panel — Summary/Config/Tags tabs |
| CampaignDetailPanel | `components/CampaignDetailPanel.tsx` | Slide-over panel variant |
| CampaignsInlineTable | `components/CampaignsInlineTable.tsx` | Table view |
| CampaignTagsSection | `components/CampaignTagsSection.tsx` | Tags tab in detail view |
| useCampaignsData | `hooks/useCampaignsData.ts` | |
| useCampaignTags | `hooks/useCampaignTags.ts` | Tag management for campaign |
| campaignsApi | `api/campaignsApi.ts` | |

---

## Conversations Feature (`features/conversations/`)

| Component | File | Notes |
|-----------|------|-------|
| InboxPanel | `components/InboxPanel.tsx` | Left conversation list |
| ChatPanel | `components/ChatPanel.tsx` | WhatsApp message thread |
| ContactSidebar | `components/ContactSidebar.tsx` | Right contact info panel |
| useConversationsData | `hooks/useConversationsData.ts` | |
| conversationsApi | `api/conversationsApi.ts` | |
| conversationHelpers | `utils/conversationHelpers.ts` | Formatting/utility functions |

---

## Accounts Feature (`features/accounts/`)

| Component | File | Notes |
|-----------|------|-------|
| AccountsPage | `pages/AccountsPage.tsx` | Feature page — split-pane |
| AccountListView | `components/AccountListView.tsx` | Left list + right detail pane |
| AccountDetailView | `components/AccountDetailView.tsx` | Right panel detail |
| AccountsInlineTable | `components/AccountsInlineTable.tsx` | Table view |
| AccountsTable | `components/AccountsTable.tsx` | Legacy DataTable wrapper (kept) |
| AccountCreateDialog | `components/AccountCreateDialog.tsx` | |
| AccountCreatePanel | `components/AccountCreatePanel.tsx` | Panel-style creation form |
| AccountDetailsDialog | `components/AccountDetailsDialog.tsx` | Edit panel |
| useAccountsData | `hooks/useAccountsData.ts` | |
| accountsApi | `api/accountsApi.ts` | |

---

## Billing Feature (`features/billing/`)

| Component | File | Notes |
|-----------|------|-------|
| BillingPage | `pages/BillingPage.tsx` | Feature page — desktop renders `workspace/BillingWorkspace`, mobile renders `mobile/MobileBillingView`. Owns data hooks, persisted selection, new-item notifications, account filter |
| **BillingWorkspace** | `components/workspace/BillingWorkspace.tsx` | **Desktop shell (current)** — topbar + 3-state list panel + inline detail/create area. Mirrors the Accounts workspace pattern. Owns search/sort/filter/group/viewMode/panelMode |
| BillingTopBar | `components/workspace/BillingTopBar.tsx` | Campaigns-chrome topbar: tabs, fold, search, filter/sort/group, date+view (expenses), `+ New`, `⋯` |
| BillingListPanel | `components/workspace/BillingListPanel.tsx` | Left list panel (full/compact/hidden) — renders per-tab list cards, grouping, pagination, compact rail + hover card |
| Invoice/Contract/ExpenseListCard | `components/workspace/*ListCard.tsx` | Wine/paper list cards (serif amount, status pill) |
| Invoice/Contract/ExpenseDetailPanel | `components/workspace/*DetailPanel.tsx` | Inline detail. Invoice = full reskin; Contract/Expense wrap the (already-wine) `*DetailView` full-height |
| BillingStatCards / CompactBillingCard | `components/workspace/*.tsx` | Per-tab stat chips (BStat port) · compact-rail tile |
| workspace atoms/formAtoms/adapters | `components/workspace/{atoms,formAtoms,adapters}.ts(x)` | Prototype primitive ports (StatusPill/StatCard/DedBadge…, F* form atoms, status/expense grouping helpers) + `useBillingEdit.ts` |
| BillingListView | `components/BillingListView.tsx` | **LEGACY desktop master list** — replaced by BillingWorkspace; now only referenced by dead `{Invoices,Contracts,Expenses}Page.tsx` (unrouted). Pending deletion after verification |
| ContractsInlineTable | `components/ContractsInlineTable.tsx` | Contracts table |
| ContractDetailView | `components/ContractDetailView.tsx` | Contract detail panel |
| ContractCreatePanel | `components/ContractCreatePanel.tsx` | Contract creation form (reference panel implementation) |
| ContractUploadDialog | `components/ContractUploadDialog.tsx` | Contract file upload |
| ContractCard | `components/ContractCard.tsx` | Contract card in list |
| InvoicesInlineTable | `components/InvoicesInlineTable.tsx` | Invoices table |
| InvoiceDetailView | `components/InvoiceDetailView.tsx` | Invoice detail panel |
| InvoiceCreatePanel | `components/InvoiceCreatePanel.tsx` | Invoice creation form |
| InvoiceCreateDialog | `components/InvoiceCreateDialog.tsx` | Invoice creation dialog |
| InvoiceCard | `components/InvoiceCard.tsx` | Invoice card in list |
| ExpensesView | `components/ExpensesView.tsx` | Expenses main view |
| ExpensesListView | `components/ExpensesListView.tsx` | Expenses list |
| ExpenseDetailView | `components/ExpenseDetailView.tsx` | Expense detail panel |
| ExpenseCreatePanel | `components/ExpenseCreatePanel.tsx` | Expense creation form |
| ExpenseCreateDialog | `components/ExpenseCreateDialog.tsx` | Expense creation dialog |
| useContractsData | `hooks/useContractsData.ts` | |
| useInvoicesData | `hooks/useInvoicesData.ts` | |
| contractsApi | `api/contractsApi.ts` | |
| invoicesApi | `api/invoicesApi.ts` | |
| expensesApi | `api/expensesApi.ts` | |
| types | `types.ts` | Billing-specific TypeScript types |
| contractTemplate | `utils/contractTemplate.ts` | Contract template utilities |

---

## Tags Feature (`features/tags/`)

| Component | File | Notes |
|-----------|------|-------|
| TagsPage | `pages/TagsPage.tsx` | Feature page |
| TagsCardView | `components/TagsCardView.tsx` | Card view |
| TagsInlineTable | `components/TagsInlineTable.tsx` | Table view |
| TagsToolbar | `components/TagsToolbar.tsx` | Toolbar |
| ColorPicker | `components/ColorPicker.tsx` | Tag color picker |
| DeleteTagDialog | `components/DeleteTagDialog.tsx` | Delete confirmation |
| useTagsData | `hooks/useTagsData.ts` | |
| types | `types/index.ts` | Tag type definitions |

---

## Prompts Feature (`features/prompts/`)

| Component | File | Notes |
|-----------|------|-------|
| PromptsPage | `pages/PromptsPage.tsx` | Feature page |
| PromptsListView | `components/PromptsListView.tsx` | Split-pane list view |
| PromptsCardView | `components/PromptsCardView.tsx` | Card view |
| PromptsInlineTable | `components/PromptsInlineTable.tsx` | Table view |
| PromptsToolbar | `components/PromptsToolbar.tsx` | Toolbar |
| PromptFormDialog | `components/PromptFormDialog.tsx` | Create/edit form |
| DeletePromptDialog | `components/DeletePromptDialog.tsx` | Delete confirmation |
| types | `types.ts` | Prompt type definitions |

---

## Users Feature (`features/users/`)

| Component | File | Notes |
|-----------|------|-------|
| SettingsTeamSection | `components/SettingsTeamSection.tsx` | Team management in Settings page |
| UsersInlineTable | `components/UsersInlineTable.tsx` | Table view with group collapse |
| types | `types.ts` | User type definitions |

---

## Shared UI Components (`components/ui/`)

### Custom Components (project-specific)
| Component | File | Notes |
|-----------|------|-------|
| IconBtn | `icon-btn.tsx` | Standard 36px circle button — use for all icon actions |
| EntityAvatar | `entity-avatar.tsx` | Lead/Account/Campaign/User avatars — single source of truth |
| ViewTabBar | `view-tab-bar.tsx` | List\|Table\|Kanban tab switcher |
| SearchPill | `search-pill.tsx` | Expandable search input pill |
| ToolbarPill | `toolbar-pill.tsx` | **DEPRECATED** — use expand-on-hover pattern (§28) |
| Skeleton | `skeleton.tsx` | Loading skeleton components |
| Field | `field.tsx` | Form field wrapper |
| DonutChart | `donut-chart.tsx` | Chart visualization |
| ColorPickerWidget | `color-picker-widget.tsx` | Tag color picker (full) |
| DoodlePatterns | `doodle-patterns.tsx` | Chat background patterns |
| GitHubCalendar | `git-hub-calendar.tsx` | Calendar heatmap |
| InputGroup | `input-group.tsx` | Input with icons |
| ButtonGroup | `button-group.tsx` | Grouped buttons |
| Sidebar | `sidebar.tsx` | Sidebar layout component |

### shadcn/ui (standard library)
All standard shadcn/ui components are in `components/ui/`: `alert-dialog`, `avatar`, `badge`, `button`, `calendar`, `card`, `checkbox`, `command`, `dialog`, `drawer`, `dropdown-menu`, `form`, `input`, `label`, `popover`, `progress`, `scroll-area`, `select`, `separator`, `sheet`, `slider`, `sonner`, `switch`, `table`, `tabs`, `textarea`, `toast`, `tooltip`, and more.

---

## Hooks (`hooks/`)

| Hook | File | Notes |
|------|------|-------|
| useSession | `useSession.ts` | Auth session, user role, workspace |
| useWorkspace | `useWorkspace.ts` | Account/workspace context |
| useHealthCheck | `useHealthCheck.ts` | DB connectivity polling |
| useApiData | `useApiData.ts` | Generic data fetching wrapper |
| useLeads | `useLeads.ts` | Lead data wrapper |
| useTheme | `useTheme.ts` | Dark mode toggle |
| useActivityFeed | `useActivityFeed.ts` | Activity feed data |
| useSupportChat | `useSupportChat.ts` | Support chat widget state |
| useChatDoodle | `useChatDoodle.ts` | Chat doodle canvas state |
| usePersistedSelection | `usePersistedSelection.ts` | Persist selected lead/campaign |
| useDashboardWidgetPrefs | `useDashboardWidgetPrefs.ts` | Widget preferences storage |
| useDashboardRefreshInterval | `useDashboardRefreshInterval.ts` | Dashboard refresh timer |
| use-toast | `use-toast.ts` | Toast notifications |

---

## Data & API (`lib/`)

| File | Path | Notes |
|------|------|-------|
| apiFetch | `lib/apiUtils.ts` | Use for standard GET requests |
| queryClient + apiRequest | `lib/queryClient.ts` | Use for mutations / TanStack Query |
| utils | `lib/utils.ts` | `cn()` and general helpers |
| avatarUtils | `lib/avatarUtils.ts` | **Avatar colors, initials, PIPELINE_HEX** — single source of truth |
| pageAccents | `lib/pageAccents.ts` | Page-specific color/accent utilities |

---

## Styling & Tokens

| File | Path | Notes |
|------|------|-------|
| Global CSS + utilities | `client/src/index.css` | CSS vars, brand vars, custom utilities |
| UI Standards | `UI_STANDARDS.md` | Rules, tokens, bans, design decisions |
| UI Patterns | `UI_PATTERNS.md` | Implementation patterns, exact markup |
| Type models | `client/src/types/models.ts` | Lead, Campaign, Account, User TS types |
| DB schema reference | `shared/schema.ts` | Drizzle ORM schema definitions |

---

## Tasks Feature (`features/tasks/`)

| Component | File | Notes |
|-----------|------|-------|
| TasksPage | `pages/TasksPage.tsx` | Thin orchestrator — data/SSE, mobile vs desktop switch |
| DesktopTasksView | `components/DesktopTasksView.tsx` | Desktop: top-bar controls + merged board/calendar + shared drag + detail modal |
| MobileTasksView | `components/MobileTasksView.tsx` | Mobile: agenda/board views + mobile panels |
| TasksBoardView | `components/TasksBoardView.tsx` | Kanban columns by status (droppable; drag handled by parent) |
| TasksBoardCard | `components/TasksBoardCard.tsx` | Kanban/board task card |
| TasksWeekCalendar | `components/TasksWeekCalendar.tsx` | Compact week agenda (droppable days); exports week date helpers |
| TaskDetailPanel | `components/TaskDetailPanel.tsx` | Task detail (glass modal on desktop) |
| TaskDetailSections | `components/TaskDetailSections.tsx` | Comments / attachments / subtasks sections |
| MobileTaskCreatePanel | `components/MobileTaskCreatePanel.tsx` | Task creation (mobile) |
| MobileTaskDetailPanel | `components/MobileTaskDetailPanel.tsx` | Task detail (mobile) |
| MobileTaskListCard | `components/MobileTaskListCard.tsx` | Mobile task cards + `MTAvatar`/`MTGroupBar`/date helpers |
| taskViewUtils | `lib/taskViewUtils.ts` | Shared `loadLocal`/`saveLocal`/`applyDesktopFilter`/`AVATAR_BG`/`DesktopFilter` |
| TagVisibilityContext | `context/TagVisibilityContext.tsx` | Tag visibility toggle state |
| types | `types.ts` | `Task`, `ViewMode`, `STATUS_COLORS`, sort/category types |

---

## Automation Feature (`features/automation/`)

| Component | File | Notes |
|-----------|------|-------|
| PipelineView | `components/PipelineView.tsx` | Automation logs pipeline view — shown on the AutomationLogs page |
| ExecutionProgressBar | `components/ExecutionProgressBar.tsx` | Progress bar for in-progress execution groups |
| useExecutionGroups | `hooks/useExecutionGroups.ts` | Groups log entries by `workflow_execution_id` for timeline display |
| automationRegistry | `automationRegistry.ts` | Maps workflow names → icons, labels, descriptions — add new automation types here |

---

## AI Agents Feature (`features/ai-agents/`)

| Component | File | Notes |
|-----------|------|-------|
| AgentsPage | `pages/AgentsPage.tsx` | Feature page |
| AgentChatPage | `pages/AgentChatPage.tsx` | Full-page chat view |
| AgentChatView | `components/AgentChatView.tsx` | Chat messages + streaming UI |
| AgentChatWidget | `components/AgentChatWidget.tsx` | Floating widget version |
| AgentConversationList | `components/AgentConversationList.tsx` | Conversation list panel |
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

## Prospects Feature (`features/prospects/`)

| Component | File | Notes |
|-----------|------|-------|
| ProspectsPage | `pages/ProspectsPage.tsx` | Feature page |
| AppProspects | `pages/AppProspects.tsx` *(in `pages/`)* | Route wrapper |
| ProspectListView | `components/ProspectListView.tsx` | Split-pane list view |
| ProspectsInlineTable | `components/ProspectsInlineTable.tsx` | **Reference implementation** for inline-editable tables |
| OutreachPipelineView | `components/OutreachPipelineView.tsx` | Outreach pipeline kanban |
| ProspectDetailView | `components/ProspectDetailView.tsx` | Right panel detail |
| ProspectSlidePanel | `components/ProspectSlidePanel.tsx` | Slide-over panel |
| ProspectCreatePanel | `components/ProspectCreatePanel.tsx` | Creation form |
| InteractionTimeline | `components/InteractionTimeline.tsx` | Outreach interaction history |
| ProspectTasks | `components/ProspectTasks.tsx` | Tasks linked to a prospect |
| OutreachTemplatesView | `components/OutreachTemplatesView.tsx` | Outreach message templates |
| useProspectsData | `hooks/useProspectsData.ts` | Prospects data hook |
| prospectsApi | `api/prospectsApi.ts` | API calls for prospects |
| outreachTemplatesApi | `api/outreachTemplatesApi.ts` | API calls for outreach templates |

---

## Server (`server/`)

| Area | File | Notes |
|------|------|-------|
| Routing | `routes/index.ts` + domain files in `routes/` | `routes.ts` (monolith) was **deleted** — routing now lives here |
| Storage | `storage.ts` (barrel) | Methods live in `storage/{accounts,prospects,campaigns,leads,interactions,automation,notifications,billing,tasks,agents,misc,types}.ts` |

---

## Documentation Index

| Doc | Purpose |
|-----|---------|
| `CLAUDE.md` | Project overview, critical rules, tech stack, key reference files |
| `UI_STANDARDS.md` | Design system — colors, spacing, typography, coding rules |
| `UI_PATTERNS.md` | Implementation patterns — exact markup, component anatomy |
| `FILE_MAP.md` | This file — quick component lookup |
| `EXPENSES.md` | Expenses feature: DB, BTW/VAT, PDF parsing, architecture |
| `specs/<feature>/` | Feature specs: requirements.md, implementation-plan.md, action-required.md |
| `/home/gabriel/automations/CLAUDE.md` | Python automation engine — WAT architecture, bump/campaign launcher, AI conversation pipeline, guardrails, logging patterns |
