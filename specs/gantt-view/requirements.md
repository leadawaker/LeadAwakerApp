# Requirements: Task Gantt View

## What it does

A new "Gantt" view mode for the Tasks page that visualizes tasks as horizontal bars on a timeline. The left panel shows the task tree hierarchy (reusing logic from the existing tree view), while the right panel renders a scrollable time axis with bars representing each task's start-to-end duration.

This lets Gabriel see at a glance which tasks overlap, how long each takes, and how the tree structure maps onto a schedule.

## Why

- The kanban, table, and tree views show hierarchy and status but not **time layout**
- A Gantt reveals scheduling conflicts, gaps, and critical-path bottlenecks
- Parent-child relationships double as implicit dependencies: seeing the parent bar span its children's range makes planning intuitive
- `timeEstimate` already exists but has no visual representation today

## Acceptance criteria

### Schema
- [ ] New `start_date` column (nullable timestamp with timezone) added to the Tasks table
- [ ] Migration applied without data loss
- [ ] API routes (GET/PATCH) expose and accept `startDate`
- [ ] Insert/update Zod schemas updated

### View integration
- [ ] "Gantt" tab appears in the ViewSwitcher alongside Kanban, Table, and Tree
- [ ] `VIEW_MODES` in `types.ts` includes `"gantt"`
- [ ] View mode persists to localStorage like the other views
- [ ] Mobile: Gantt tab visible in the compact mobile switcher (horizontal scroll for timeline)

### Gantt layout
- [ ] Left panel: task tree with expand/collapse (matches tree view hierarchy)
- [ ] Right panel: horizontal scrollable timeline with day/week/month granularity toggle
- [ ] Task bars colored by category color (fallback to status color)
- [ ] Bar width = duration from `startDate` to `dueDate`
- [ ] Tasks without dates shown as a dot or zero-width marker at "unscheduled" section
- [ ] Parent task bars auto-span from earliest child start to latest child end (summary bars)
- [ ] Today marker: vertical red/accent line on the timeline

### Interaction
- [ ] Click a bar to open the task detail (same `onTaskClick` pattern as tree view)
- [ ] Hover shows tooltip with: title, start date, due date, duration, status
- [ ] Zoom controls: day / week / month granularity
- [ ] Timeline scrolls horizontally, task list scrolls vertically (synced)

### Toolbar compatibility
- [ ] All existing toolbar filters work (status, category, tags, date range, search, sort)
- [ ] Tree ancestor preservation logic applies (same as current tree view filtering)

### i18n
- [ ] "Gantt" view label translated in en, nl, pt locale files
- [ ] Tooltip labels and zoom controls translated

## Related features / dependencies
- **Tree view** (`TasksTreeView.tsx`): Gantt left panel reuses `buildTree()`, expand/collapse, category colors
- **Task schema** (`shared/schema.ts`): needs `startDate` column addition
- **ViewSwitcher** (`ViewSwitcher.tsx`): needs "gantt" added to tabs
- **Types** (`types.ts`): `VIEW_MODES` array
- **TasksPage** (`TasksPage.tsx`): needs Gantt view wiring in desktop and mobile render branches
