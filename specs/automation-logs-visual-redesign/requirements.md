# Requirements: Automation Logs Visual Redesign

## What & Why

The Automation Logs page (`/agency/automation-logs`) is currently a flat table of individual step rows — useful for forensic debugging but hard to scan operationally. This redesign makes the page visually meaningful by:

- **Grouping steps into executions** so you see workflows, not isolated rows
- **Showing a segmented progress bar** per execution so you instantly see where a pipeline broke
- **Assigning type-specific avatars** to different automation types for fast visual scanning
- **Adding a Pipeline view** alongside the existing Table view for a split-pane operations dashboard

All data already exists in the `Automation_Logs` table (`workflow_execution_id`, `step_name`, `step_number`, `status`, etc.). This is a pure frontend reshaping — zero backend changes.

## Acceptance Criteria

### Automation Type Registry
- [ ] Client-side registry resolves `workflow_name` strings into typed categories using keyword pattern matching
- [ ] Each type has: unique ID, label, description, Lucide icon, color palette
- [ ] Unknown workflow names gracefully fall back to a generic type
- [ ] Registry is easily extensible — adding a new type = adding one entry

### Segmented Progress Bar
- [ ] Renders a horizontal bar with one segment per step in an execution
- [ ] Segments are color-coded by status (emerald=success, rose=failed, gray=skipped, amber=waiting, indigo=retrying, blue=started)
- [ ] Tooltip on each segment shows step name, status, and execution time
- [ ] Compact variant for table rows, standard variant for cards
- [ ] Dark mode colors adjust correctly

### Type-Specific Avatars
- [ ] Each automation type renders a distinct `EntityAvatar` with its own color pair (light + dark)
- [ ] Colors follow the existing `avatarUtils.ts` pattern (4 maps + getter function)
- [ ] Avatar shows initials derived from the type label (e.g., "LA" for Lead Awaker)

### Both Views (Table + Pipeline)
- [ ] `ViewTabBar` toggle between Table and Pipeline in the toolbar
- [ ] **Table view (upgraded):** Workflow column includes avatar + type sublabel; new Pipeline column shows compact progress bar
- [ ] **Pipeline view (new):** Split-pane — left panel lists execution cards, right panel shows step timeline for selected execution
- [ ] All existing filters (search, campaign, status, date) apply to both views
- [ ] Failed steps in Pipeline view expand to show error code, input/output data

### Edge Cases
- [ ] Rows without `workflow_execution_id` render as single-step executions
- [ ] Rows without `step_number` fall back to `created_at` ordering
- [ ] Empty state when no logs exist works in both views

## Dependencies
- `EntityAvatar` component (`components/ui/entity-avatar.tsx`)
- `ViewTabBar` component (`components/ui/view-tab-bar.tsx`)
- `avatarUtils.ts` color system (`lib/avatarUtils.ts`)
- `STATUS_CONFIG` already defined in `AutomationLogs.tsx`
- Lucide React icons (already installed)
- No new npm packages required
