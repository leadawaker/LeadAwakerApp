# Requirements: Task Manager

## What It Does

A task management system embedded in Lead Awaker that lets agency and subaccount users track follow-ups, calls, reviews, and admin tasks linked to leads, campaigns, and accounts. Tasks surface as a dedicated page in the sidebar nav and are accessible to all user roles (with scoping).

## Why

Currently there's no way to track operational to-dos inside Lead Awaker. Users juggle follow-ups, call reminders, and review tasks outside the platform. A built-in task manager closes this loop — especially for operators managing multiple accounts.

## Core Concepts

- **Task types:** `follow_up`, `call`, `review`, `admin`, `custom`
- **Statuses:** `todo` → `in_progress` → `done` | `cancelled`
- **Priorities:** `low`, `medium`, `high`, `urgent`
- **Relationships:** Each task belongs to an Account. Optionally linked to a Campaign, Lead, and/or User (assignee).
- **Denormalized names:** `account_name`, `campaign_name`, `lead_name`, `assignee_name` stored on the row for fast display without joins.

## Acceptance Criteria

### Navigation & Routing
- [ ] Tasks appears in the sidebar nav — **agency-only** (`agencyOnly: true`)
- [ ] Route: `/agency/tasks` only (no subaccount route)
- [ ] Nav position: after Accounts, before Leads
- [ ] All API routes use `requireAgency` guard

### Views — Split-Pane Layout (List + Table)
- [ ] **List view** (default): left panel with virtualized task cards + right detail panel on click
- [ ] **Table view**: full-width virtualized table with inline status/priority editing
- [ ] ViewTabBar toggle: `List | Table` (same pattern as Leads)
- [ ] Toolbar: [+ Add] [Search] [Sort] [Filter] [Group] — expand-on-hover buttons per §28

### Task Cards (Left Panel — List View)
- [ ] Show: priority indicator (colored dot/bar), title, task type icon, due date, assignee avatar, account name
- [ ] Card states: default `bg-card`, hover `bg-card-hover`, selected `bg-[#FFF9D9]`
- [ ] Overdue tasks: red due-date text or subtle red left-border accent
- [ ] Gap: `gap-[3px]` between cards, `p-[3px]` on scroll container

### Task Detail Panel (Right Side)
- [ ] Panel-first pattern (§14): no modal dialogs for edit
- [ ] Editable fields: title, description, status, priority, task type, due date, reminder, assignee
- [ ] Linked entity chips: click to navigate to the related Lead, Campaign, or Account
- [ ] Created/updated timestamps at bottom
- [ ] Delete with inline popover confirmation (§30)

### Create Task
- [ ] "+" button opens right-panel create form (not a dialog)
- [ ] Required: title, account
- [ ] Optional: description, campaign, lead, assignee, priority, type, due date, reminder

### Sorting & Filtering
- [ ] Sort by: due date, priority, created date, status, title
- [ ] Filter by: status, priority, task type, assignee, account, campaign
- [ ] Group by: status (default), priority, task type, assignee, account
- [ ] Search: fuzzy match on title, description, lead name, account name

### API (CRUD)
- [ ] `GET /api/tasks` — list all (`requireAgency`)
- [ ] `POST /api/tasks` — create (`requireAgency`)
- [ ] `PATCH /api/tasks/:id` — update (`requireAgency`)
- [ ] `DELETE /api/tasks/:id` — delete (`requireAgency`)
- [ ] Query params: `?status=todo&assignee=4&sort=due_date&order=asc`

### Dark Mode
- [ ] Full dark mode support following NIGHT_MODE.md patterns

## Dependencies

- **Database:** `Tasks` table already exists in PostgreSQL (matches `shared/schema.ts`)
- **Schema:** `tasks` + `insertTaskSchema` + `Task` + `InsertTask` types already defined
- **No new npm packages required**

## Related Features

- **Leads:** Tasks can link to a lead (`Leads_id`) — future: show task count on lead cards
- **Campaigns:** Tasks can link to a campaign (`Campaigns_id`)
- **Calendar:** Future integration — show tasks with `due_date` on the calendar view
