# FILE_MAP — LeadAwakerApp Quick Reference

Read this file to locate any component without running grep/glob searches.

> **Future Claude:** If you discover a file that's missing, mislabeled, or outdated here — add it, correct it, or remove it. This file only has value if it stays accurate and complete.

---

## Pages (route-level)

### Post-Login App Pages
| Page | Path | Notes |
|------|------|-------|
| App shell wrapper | `pages/app.tsx` | Authenticated layout root, role-based routing |
| Leads | `pages/AppLeads.tsx` | Wraps `features/leads/pages/LeadsPage` |
| Campaigns (landing) | `pages/AppCampaigns.tsx` | Wraps `features/campaigns/pages/CampaignsPage` — **default landing page** |
| Conversations | `pages/Conversations.tsx` | WhatsApp inbox — three-panel layout |
| Calendar | `pages/Calendar.tsx` | Booking / time slots |
| Accounts | `pages/AppAccounts.tsx` | Wraps `features/accounts/pages/AccountsPage` — agency admin only |
| Accounts (redirect) | `pages/Accounts.tsx` | Redirects to AppAccounts |
| Tags | `pages/Tags.tsx` | Tag CRUD — agency admin only |
| Prompt Library | `pages/PromptLibrary.tsx` | AI prompt templates — agency admin only |
| Automation Logs | `pages/AutomationLogs.tsx` | n8n execution history — agency admin only |
| Settings | `pages/Settings.tsx` | Account-level settings, includes Billing section |
| Docs | `pages/Docs.tsx` | In-app Operator Manual + Client Guide |
| Lead Detail (standalone) | `pages/LeadDetail.tsx` | Full-page lead view |
| Billing | `pages/Billing.tsx` | Standalone billing route wrapper |
| Invoices | `pages/Invoices.tsx` | Standalone invoices route |
| Opportunities | `pages/Opportunities.tsx` | Redirects to `/leads` |
| Accept Invite | `pages/AcceptInvite.tsx` | Invite acceptance flow |

### Public / Pre-Login Pages (do not modify)
| Page | Path |
|------|------|
| Home / Landing | `pages/home.tsx` |
| Login | `pages/login.tsx` |
| About | `pages/about.tsx` |
| Services | `pages/services.tsx` |
| Book Demo | `pages/book-demo.tsx` |
| Privacy Policy | `pages/privacy-policy.tsx` |
| Terms of Service | `pages/terms-of-service.tsx` |
| Canvas | `pages/canvas.tsx` |
| Not Found | `pages/not-found.tsx` |

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
| LeadsCardView | `components/LeadsCardView.tsx` | D365-style split-pane list view (default) |
| LeadsKanban | `components/LeadsKanban.tsx` | Drag-drop kanban columns |
| LeadsInlineTable | `components/LeadsInlineTable.tsx` | Virtualized table view |
| LeadDetailPanel | `components/LeadDetailPanel.tsx` | Full slide-over Sheet (edit + timeline) |
| LeadInfoPanel | `components/LeadInfoPanel.tsx` | 288px right sidebar (table/kanban) |
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
| CampaignListView | `components/CampaignListView.tsx` | Left panel card list |
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
| BillingPage | `pages/BillingPage.tsx` | Feature page — tabs for contracts/invoices/expenses |
| BillingListView | `components/BillingListView.tsx` | **Master list** — tab switching between all billing types |
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

## Documentation Index

| Doc | Purpose |
|-----|---------|
| `CLAUDE.md` | Project overview, critical rules, tech stack |
| `UI_STANDARDS.md` | Design system — colors, spacing, typography, coding rules |
| `UI_PATTERNS.md` | Implementation patterns — exact markup, component anatomy |
| `FILE_MAP.md` | This file — quick component lookup |
| `EXPENSES.md` | Expenses feature: DB, BTW/VAT, PDF parsing, architecture |
