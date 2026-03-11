# Implementation Plan: Task Manager

## Overview

Build a full Task Manager feature following the Leads split-pane pattern. The database table and Drizzle schema already exist — this is primarily API routes + frontend work. Three phases: API layer, core UI (list + detail), and table view + polish.

---

## Phase 1: API Routes + Data Layer

Add CRUD endpoints for tasks and create the frontend data hooks.

### Tasks
- [x] Add task CRUD routes to `server/routes.ts` following the Tags/Prompts pattern (GET list, POST create, PATCH update, DELETE)
- [x] Add storage methods to `server/storage.ts`: `getTasks`, `getTasksByAccountId`, `getTaskById`, `createTask`, `updateTask`, `deleteTask`
- [x] Create `client/src/features/tasks/api/tasksApi.ts` — TanStack Query hooks: `useTasks()`, `useCreateTask()`, `useUpdateTask()`, `useDeleteTask()`
- [x] Create `client/src/features/tasks/types.ts` — frontend interfaces + constants (STATUS_OPTIONS, PRIORITY_OPTIONS, TASK_TYPE_OPTIONS, sort/filter/group enums)

### Technical Details

**API routes** (add to `server/routes.ts`):
```ts
// GET /api/tasks — list with optional filters
app.get("/api/tasks", requireAuth, scopeToAccount, async (req, res) => { ... });
// POST /api/tasks — create
app.post("/api/tasks", requireAuth, async (req, res) => { ... });
// PATCH /api/tasks/:id — update
app.patch("/api/tasks/:id", requireAuth, async (req, res) => { ... });
// DELETE /api/tasks/:id — delete
app.delete("/api/tasks/:id", requireAuth, async (req, res) => { ... });
```

**Guards:** `requireAgency` on all routes. No subaccount access.

**Storage methods** — use Drizzle `eq()`, `and()`, `desc()` from existing patterns. Sort/filter server-side via query params.

**Frontend hooks file:** `client/src/features/tasks/api/tasksApi.ts`
```ts
export function useTasks(filters?) { return useQuery({ queryKey: ["/api/tasks", filters], ... }); }
export function useCreateTask() { return useMutation({ mutationFn: (data) => apiRequest("POST", "/api/tasks", data), ... }); }
```

**Folder structure:**
```
client/src/features/tasks/
├── api/
│   └── tasksApi.ts
├── components/
│   ├── TasksListView.tsx
│   ├── TasksTableView.tsx
│   ├── TaskCard.tsx
│   ├── TaskDetailPanel.tsx
│   └── TaskCreatePanel.tsx
├── pages/
│   └── TasksPage.tsx
└── types.ts
```

---

## Phase 2: Core UI — List View + Detail Panel + Create

Build the main Tasks page with split-pane list view, detail panel, and create panel.

### Tasks
- [x] Create `TasksPage.tsx` — split-pane layout, ViewTabBar (List|Table), toolbar with expand-on-hover buttons [complex]
  - [x] Left panel header per §16: title + count
  - [x] Controls row: ViewTabBar + [+] [Search] [Sort] [Filter] [Group] buttons
  - [x] viewMode state, selectedTaskId state, createMode state
- [x] Create `TaskCard.tsx` — left panel card per §15 [complex]
  - [x] Priority indicator (colored left border or dot)
  - [x] Task type icon (from lucide: PhoneForwarded, Phone, ClipboardCheck, Settings, Pencil)
  - [x] Title, due date (red if overdue), assignee EntityAvatar, account name chip
  - [x] Status mini-pill
  - [x] Card states: bg-card / bg-card-hover / bg-[#FFF9D9] selected
- [x] Create `TasksListView.tsx` — virtualized card list using @tanstack/react-virtual [complex]
  - [x] Sorting, filtering, grouping (client-side from useTasks data)
  - [x] Group headers (collapsible) when groupBy is active
  - [x] Search filtering on title/description/leadName/accountName
  - [x] Empty state
- [x] Create `TaskDetailPanel.tsx` — right panel for viewing/editing a task [complex]
  - [x] Panel anatomy per §14: header (title + close) → scrollable body → footer (save/cancel)
  - [x] Inline-editable fields: title, description (textarea), status (select), priority (select), type (select), due date (date picker), assignee (user dropdown)
  - [x] Linked entity chips: Lead, Campaign, Account — clickable to navigate
  - [x] Delete with popover confirmation
  - [x] Timestamps footer
- [x] Create `TaskCreatePanel.tsx` — right panel create form
  - [x] Same panel anatomy, fields pre-filled with defaults
  - [x] Account selector (required), optional Campaign/Lead/Assignee pickers
  - [x] Save → mutation → select new task → switch to detail panel
- [x] Add route to `client/src/pages/app.tsx`: `/agency/tasks` only (no subaccount route)
- [x] Add nav item to `RightSidebar.tsx`: Tasks with `ClipboardList` icon, `agencyOnly: true`, positioned after Accounts before Leads

### Technical Details

**Avatar colors for tasks** — add to `avatarUtils.ts`:
```ts
// Task type colors
TASK_TYPE_AVATAR_BG: { follow_up: "#DBEAFE", call: "#D1FAE5", review: "#FEF3C7", admin: "#F3E8FF", custom: "#F3F4F6" }
TASK_TYPE_AVATAR_TEXT: { follow_up: "#1E40AF", call: "#065F46", review: "#92400E", admin: "#6B21A8", custom: "#374151" }
```

**Priority colors** (left border on cards):
```ts
{ low: "#9CA3AF", medium: "#3B82F6", high: "#F59E0B", urgent: "#EF4444" }
```

**Task type icons** (lucide):
```ts
{ follow_up: PhoneForwarded, call: Phone, review: ClipboardCheck, admin: Settings, custom: Pencil }
```

**Left panel width:** `w-[340px]` (same as Leads, Conversations)
**Card gap:** `gap-[3px]`, container `p-[3px]`
**Virtualization:** `@tanstack/react-virtual` useVirtualizer, estimateSize 72px

---

## Phase 3: Table View + Polish

Add the table view alternate and final polish.

### Tasks
- [x] Create `TasksTableView.tsx` — full-width virtualized table [complex]
  - [x] Columns: checkbox, priority dot, title, type, status, assignee, account, due date, created
  - [x] Row height `h-[52px]` per standard
  - [x] Inline status/priority editing (click to cycle or dropdown)
  - [x] Row click → opens TaskDetailPanel as Sheet (slide-over)
  - [x] Sortable column headers
- [x] Add dark mode support to all task components (following NIGHT_MODE.md)
- [x] Add localStorage persistence for: viewMode, sort, filter, group preferences (key prefix: `tasks-`)
- [x] Wire up SearchPill in toolbar — open/close search with debounced filter

### Technical Details

**Table columns config:**
```ts
const COLUMNS = [
  { key: "priority", label: "", width: 40 },
  { key: "title", label: "Title", width: 280, sortable: true },
  { key: "taskType", label: "Type", width: 100 },
  { key: "status", label: "Status", width: 120, sortable: true },
  { key: "assigneeName", label: "Assignee", width: 140 },
  { key: "accountName", label: "Account", width: 140 },
  { key: "dueDate", label: "Due", width: 100, sortable: true },
  { key: "createdAt", label: "Created", width: 100, sortable: true },
];
```

**Table min-width:** 1060px
**Sheet width for detail:** `sm:max-w-[480px]`

**LocalStorage keys:**
- `tasks-view-mode` → "list" | "table"
- `tasks-sort` → "due_date_asc" | "priority_desc" | "created_desc" | ...
- `tasks-filter` → JSON string of active filters
- `tasks-group` → "status" | "priority" | "type" | "assignee" | "account" | "none"
