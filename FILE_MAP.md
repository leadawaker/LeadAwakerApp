# FILE_MAP — LeadAwakerApp Quick Reference

Read this file to locate any component without running grep/glob searches.

> **Future Claude:** If you discover a file that's missing, mislabeled, or outdated here — add it, correct it, or remove it. This file only has value if it stays accurate and complete.

---

## Pages (route-level)

### Post-Login App Pages
| Page | Path | Notes |
|------|------|-------|
| App shell wrapper | `client/src/pages/app.tsx` | Authenticated layout root |
| Dashboard | `client/src/pages/AppDashboard.tsx` | KPI cards, charts |
| Leads | `client/src/pages/AppLeads.tsx` | Wraps leads feature |
| Campaigns | `client/src/pages/AppCampaigns.tsx` | Wraps campaigns feature |
| Conversations (Chats) | `client/src/pages/Conversations.tsx` | WhatsApp inbox |
| Calendar | `client/src/pages/Calendar.tsx` | Booking / time slots |
| Accounts | `client/src/pages/AppAccounts.tsx` | Agency admin only |
| Accounts (alt) | `client/src/pages/Accounts.tsx` | |
| Users | `client/src/pages/Users.tsx` | User management, invites — admin only |
| Tags | `client/src/pages/Tags.tsx` | Tag CRUD — admin only |
| Prompt Library | `client/src/pages/PromptLibrary.tsx` | AI prompt templates — admin only |
| Automation Logs | `client/src/pages/AutomationLogs.tsx` | n8n execution history — admin only |
| Settings | `client/src/pages/Settings.tsx` | Account-level settings |
| Lead Detail (standalone) | `client/src/pages/LeadDetail.tsx` | Full-page lead view |

### Public / Pre-Login Pages (do not modify)
| Page | Path |
|------|------|
| Home / Landing | `client/src/pages/home.tsx` |
| Login | `client/src/pages/login.tsx` |
| About | `client/src/pages/about.tsx` |
| Services | `client/src/pages/services.tsx` |
| Book Demo | `client/src/pages/book-demo.tsx` |
| Privacy Policy | `client/src/pages/privacy-policy.tsx` |
| Terms of Service | `client/src/pages/terms-of-service.tsx` |
| Canvas | `client/src/pages/canvas.tsx` |
| Not Found | `client/src/pages/not-found.tsx` |

---

## App Shell & Navigation

| Component | Path | Notes |
|-----------|------|-------|
| CrmShell (main layout) | `client/src/components/crm/CrmShell.tsx` | Sidebar + topbar wrapper, layout offsets |
| RightSidebar | `client/src/components/crm/RightSidebar.tsx` | Nav, collapse, DbStatusIndicator |
| Topbar | `client/src/components/crm/Topbar.tsx` | Search, bell, theme toggle, profile |
| DbStatusIndicator | `client/src/components/crm/DbStatusIndicator.tsx` | 34px circle + status dot badge |

---

## Leads Feature (`client/src/features/leads/`)

| Component | Path | Notes |
|-----------|------|-------|
| LeadsPage (feature page) | `…/pages/LeadsPage.tsx` | |
| LeadsTable (container) | `…/components/LeadsTable.tsx` | View switching, filters, search, data |
| LeadsCardView (list view) | `…/components/LeadsCardView.tsx` | Left list + right detail pane (default) |
| LeadsKanban | `…/components/LeadsKanban.tsx` | Drag-drop kanban columns |
| LeadsInlineTable | `…/components/LeadsInlineTable.tsx` | Virtualized table view content |
| LeadDetailPanel | `…/components/LeadDetailPanel.tsx` | Full slide-over Sheet (edit + timeline) |
| LeadInfoPanel | `…/components/LeadInfoPanel.tsx` | 288px right sidebar (table/kanban) |
| LeadFilters | `…/components/LeadFilters.tsx` | Filter UI |
| BulkActionsToolbar | `…/components/BulkActionsToolbar.tsx` | Bulk select actions bar |
| CsvImportWizard | `…/components/CsvImportWizard.tsx` | CSV lead import flow |
| useLeadsData | `…/hooks/useLeadsData.ts` | Main leads data hook |
| leadsApi | `…/api/leadsApi.ts` | API calls for leads |

---

## Campaigns Feature (`client/src/features/campaigns/`)

| Component | Path | Notes |
|-----------|------|-------|
| CampaignsPage | `…/pages/CampaignsPage.tsx` | |
| CampaignListView | `…/components/CampaignListView.tsx` | Left panel list |
| CampaignDetailView | `…/components/CampaignDetailView.tsx` | Right panel detail |
| CampaignDetailPanel | `…/components/CampaignDetailPanel.tsx` | Slide-over / panel variant |
| CampaignCardGrid | `…/components/CampaignCardGrid.tsx` | Grid card layout |
| CampaignsTable | `…/components/CampaignsTable.tsx` | |
| CampaignsInlineTable | `…/components/CampaignsInlineTable.tsx` | |
| useCampaignsData | `…/hooks/useCampaignsData.ts` | |
| campaignsApi | `…/api/campaignsApi.ts` | |

---

## Conversations Feature (`client/src/features/conversations/`)

| Component | Path | Notes |
|-----------|------|-------|
| InboxPanel | `…/components/InboxPanel.tsx` | Left conversation list |
| ChatPanel | `…/components/ChatPanel.tsx` | WhatsApp message thread |
| ContactSidebar | `…/components/ContactSidebar.tsx` | Right contact info panel |
| useConversationsData | `…/hooks/useConversationsData.ts` | |
| conversationsApi | `…/api/conversationsApi.ts` | |

---

## Accounts Feature (`client/src/features/accounts/`)

| Component | Path | Notes |
|-----------|------|-------|
| AccountsPage | `…/pages/AccountsPage.tsx` | |
| AccountListView | `…/components/AccountListView.tsx` | Left list + right detail pane (default view) |
| AccountDetailView | `…/components/AccountDetailView.tsx` | Right panel detail |
| AccountsInlineTable | `…/components/AccountsInlineTable.tsx` | Inline table view (new, replaces legacy DataTable) |
| AccountsTable | `…/components/AccountsTable.tsx` | Legacy — wraps DataTable (kept, no longer used by AccountsPage) |
| AccountCreateDialog | `…/components/AccountCreateDialog.tsx` | |
| AccountDetailsDialog | `…/components/AccountDetailsDialog.tsx` | Edit slide-over panel |
| useAccountsData | `…/hooks/useAccountsData.ts` | |
| accountsApi | `…/api/accountsApi.ts` | |

---

## Users Feature (`client/src/features/users/`)

| Component | Path | Notes |
|-----------|------|-------|
| UsersPage | `…/pages/UsersPage.tsx` | Container: data, dialogs, view orchestration |
| UsersListView | `…/components/UsersListView.tsx` | D365-style split pane — user cards (left) + detail (right) |
| UsersInlineTable | `…/components/UsersInlineTable.tsx` | Table view with group collapse + column visibility |

---

## Shared UI Components

| Component | Path | Notes |
|-----------|------|-------|
| IconBtn | `client/src/components/ui/icon-btn.tsx` | Standard 34px circle button (use for all icon actions) |
| All shadcn/ui components | `client/src/components/ui/` | Button, Dialog, Sheet, DropdownMenu, etc. |

---

## Hooks (`client/src/hooks/`)

| Hook | File | Notes |
|------|------|-------|
| useSession | `useSession.ts` | Auth session, user role, workspace |
| useWorkspace | `useWorkspace.ts` | Account/workspace context |
| useHealthCheck | `useHealthCheck.ts` | DB connectivity polling |
| useLeads | `useLeads.ts` | |
| useApiData | `useApiData.ts` | Generic data fetching wrapper |
| useDashboardRefreshInterval | `useDashboardRefreshInterval.ts` | |
| useTheme | `useTheme.ts` | Dark mode toggle |
| use-mobile | `use-mobile.tsx` | Responsive breakpoint detection |
| use-toast | `use-toast.ts` | Toast notifications |

---

## Styling & Tokens

| File | Path | Notes |
|------|------|-------|
| Global CSS + utilities | `client/src/index.css` | CSS vars, `@utility icon-circle-*`, brand vars |
| Design tokens reference | `memory/DESIGN_TOKENS.md` | Colors, pipeline stages, icon-circle spec (on-demand) |
| Frontend design rules | `frontend.md` (project root) | Guardrails, icon circle standard |

---

## Data & API (`client/src/lib/`)

| File | Path | Notes |
|------|------|-------|
| apiFetch helper | `client/src/lib/apiUtils.ts` | Use for standard GET requests |
| queryClient + apiRequest | `client/src/lib/queryClient.ts` | Use for mutations / TanStack Query |
| utils | `client/src/lib/utils.ts` | `cn()` and general helpers |
| Type models | `client/src/types/models.ts` | Lead, Campaign, Account, User types |
| Full DB schema | `/home/gabriel/LEADAWAKER_DATABASE_SCHEMA.md` | 11 tables, 315+ columns |
