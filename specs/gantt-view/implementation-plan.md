# Implementation Plan: Task Gantt View

## Overview

Add a Gantt chart view to the Tasks page. The Gantt is a split-panel layout: a collapsible task tree on the left, and a horizontal scrollable timeline on the right showing bars for each task's date range. Requires a `startDate` column in the schema and a new `TasksGanttView` component.

## Phase 1: Schema & API (startDate column)
Add the `startDate` field to the Tasks table so each task can have an explicit start date.

### Tasks
- [ ] Add `startDate` column to the `tasks` table definition in `shared/schema.ts` as `timestamp("start_date", { withTimezone: true })` (nullable, right after `dueDate`)
- [ ] Add `startDate` to `insertTaskSchema` with `z.coerce.date().nullish()`
- [ ] Write SQL migration file `migrations/add_task_start_date.sql`: `ALTER TABLE "p2mxx34fvbf3ll6"."Tasks" ADD COLUMN "start_date" TIMESTAMPTZ;`
- [ ] Run migration against the database
- [ ] Verify the GET `/api/tasks` response includes `startDate` (it should automatically since Drizzle selects all columns)
- [ ] Verify PATCH `/api/tasks/:id` accepts `startDate` in the body

### Technical Details
- Schema file: `shared/schema.ts` lines 893-926 (tasks table definition)
- Migration pattern: see existing files in `migrations/` directory
- The API routes in `server/routes.ts` use the insert schema for validation, so adding to the Zod schema is sufficient
- No backend route changes needed: the existing generic update handler picks up new fields from the schema

## Phase 2: Type system & ViewSwitcher wiring
Register the Gantt as a valid view mode and add it to the view switcher UI.

### Tasks
- [ ] Add `"gantt"` to `VIEW_MODES` array in `client/src/features/tasks/types.ts` (line 148)
- [ ] Add Gantt tab to `VIEW_TABS` in `ViewSwitcher.tsx` with icon `GanttChart` (from lucide-react) and tKey `"views.gantt"`
- [ ] Add i18n keys for all three locales:
  - `client/src/locales/en/tasks.json`: `"views.gantt": "Gantt"`
  - `client/src/locales/nl/tasks.json`: `"views.gantt": "Gantt"`
  - `client/src/locales/pt/tasks.json`: `"views.gantt": "Gantt"`
- [ ] Add tooltip i18n keys for all three locales:
  - `"gantt.today": "Today"`, `"gantt.unscheduled": "Unscheduled"`, `"gantt.noDate": "No dates set"`
  - `"gantt.zoomDay": "Day"`, `"gantt.zoomWeek": "Week"`, `"gantt.zoomMonth": "Month"`

### Technical Details
- `VIEW_MODES` is currently `["kanban", "table", "tree"] as const` at line 148 of `types.ts`
- `ViewSwitcher.tsx` maps `VIEW_TABS` to `ViewTabBar` tabs
- Lucide has a `GanttChart` icon (aliased as `GanttChartSquare` in some versions, verify with import)
- The `ViewMode` type is derived from `VIEW_MODES`, so adding to the array automatically updates the type

## Phase 3: TasksGanttView component [complex]
Build the main Gantt chart component. This is the largest phase.

### Tasks
- [ ] Create `client/src/features/tasks/components/TasksGanttView.tsx` [complex]
  - [ ] Left panel: task tree list using `buildTree()` from tree view, with expand/collapse and category icons
  - [ ] Right panel: timeline header (date labels) + bar rows
  - [ ] Zoom state: `"day" | "week" | "month"` with toggle buttons in a small toolbar above the timeline
  - [ ] Today marker: vertical accent line
  - [ ] Synced vertical scroll between left panel and right panel
  - [ ] Horizontal scroll on the right panel only
- [ ] Implement bar rendering logic:
  - [ ] Bar position: `left = (startDate - viewStart) * pxPerUnit`, `width = (dueDate - startDate) * pxPerUnit`
  - [ ] Fallback: if no `startDate` but has `dueDate` and `timeEstimate`, compute `startDate = dueDate - timeEstimate`
  - [ ] Fallback: if only `dueDate`, render as a diamond/milestone marker
  - [ ] Fallback: if no dates at all, collect into "Unscheduled" section below the timeline
  - [ ] Summary bars for parents: span from min(child starts) to max(child ends), rendered as a thinner/darker bar
- [ ] Implement hover tooltip (title, dates, duration, status) using a simple absolute-positioned div
- [ ] Implement click handler: calls `onTaskClick(taskId)` same as tree view

### Technical Details
- Reuse `buildTree()` and `TreeNode` type from `TasksTreeView.tsx` (consider extracting to a shared util)
- Column widths per zoom level:
  - Day: 40px per day
  - Week: 120px per week (about 17px/day)
  - Month: 160px per month (about 5px/day)
- Left panel width: 280px (fixed, resizable later)
- Use `useRef` + `onScroll` to sync vertical scroll between left and right panels
- Bar height: 24px with 4px gap, nested inside a row that matches the tree node height
- Category colors from `categoryColorMap` (same as tree view)
- Status-based fallback colors: `STATUS_COLORS` from `types.ts`
- Today marker: `position: absolute; left: todayOffset; top: 0; bottom: 0; width: 2px; background: var(--brand-indigo)`
- Timeline header: sticky top, shows date/week/month labels depending on zoom
- Flatten the tree into a visible-rows array (respecting expand/collapse) to map tree nodes to bar rows

## Phase 4: Page integration
Wire the Gantt view into TasksPage alongside the existing views.

### Tasks
- [ ] Import `TasksGanttView` in `TasksPage.tsx`
- [ ] Add Gantt rendering branch in the desktop view area (after tree view block, around line 741)
- [ ] Add Gantt rendering branch in the mobile view area (around line 672)
- [ ] Pass same props pattern: `tasks={filteredTasks}`, `searchQuery`, `onTaskClick`
- [ ] Apply the ancestor-preservation filter logic for Gantt (same `viewMode === "tree"` block, extend to `viewMode === "gantt"`)
- [ ] Ensure the Gantt zoom controls toolbar is only visible when `viewMode === "gantt"` (render inside the GanttView component, not in the page toolbar)

### Technical Details
- TasksPage.tsx desktop render section: lines 709-748
- TasksPage.tsx mobile render section: lines 653-695
- The ancestor-preservation logic is at lines 264-280, currently gated on `viewMode === "tree"` -- add `|| viewMode === "gantt"`
- Props interface should match: `{ tasks: Task[]; searchQuery?: string; onTaskClick?: (taskId: number) => void; }`

## Phase 5: Polish & edge cases
Handle visual edge cases and mobile adaptation.

### Tasks
- [ ] Empty state: when no tasks have dates, show a message encouraging the user to set start/due dates
- [ ] Auto-scroll to today on mount (timeline should center on today's date)
- [ ] Mobile: make left panel collapsible (toggle button) so the timeline can use full width
- [ ] Dark mode: ensure bar colors, grid lines, and header work in dark mode
- [ ] Keyboard: left/right arrow to scroll timeline when focused
- [ ] Add `startDate` field to the tree view's `InlineEditPanel` so users can set start dates from any view
- [ ] Add `startDate` column option to the table view's column visibility list
