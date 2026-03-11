# Implementation Plan: Automation Logs Visual Redesign

## Overview
Transform the Automation Logs page from a flat step-level table into a visual operations dashboard with execution grouping, segmented progress bars, type-specific avatars, and a split-pane Pipeline view — all purely client-side, no backend changes.

---

## Phase 1: Data Layer & Registry
Set up the automation type system and execution grouping logic. No UI changes yet.

### Tasks
- [ ] Create automation type registry with pattern-based workflow name resolution
- [ ] Add automation avatar color maps to `avatarUtils.ts` (light + dark pairs + getter)
- [ ] Create `useExecutionGroups` hook to group flat log rows into execution structures

### Technical Details

**New file: `client/src/features/automation/automationRegistry.ts`**
```ts
interface AutomationType {
  id: string;           // e.g. "messaging", "ai_conversation", "error_handler"
  label: string;        // e.g. "Messaging", "AI Conversation"
  description: string;
  icon: LucideIcon;     // Bot, PhoneOutgoing, AlertTriangle, MessageSquare, Workflow, etc.
  patterns: RegExp[];   // keyword patterns matched against workflow_name
}
```
- `resolveAutomationType(workflowName: string): AutomationType` — iterates patterns, returns first match or fallback
- Pattern matching uses broad keywords: `/message|whatsapp|sms|contact/i` for messaging, `/error|handler|fallback/i` for error handling, `/score|rating|qualify/i` for scoring, `/bot|ai|agent|awaker/i` for AI workflows
- Fallback type: `{ id: "generic", label: "Workflow", icon: Workflow }`

**Modify: `client/src/lib/avatarUtils.ts`** — add after prompt avatar section:
- `AUTOMATION_AVATAR_BG` / `AUTOMATION_AVATAR_TEXT` (light)
- `AUTOMATION_AVATAR_BG_DARK` / `AUTOMATION_AVATAR_TEXT_DARK` (dark)
- `getAutomationTypeAvatarColor(typeId: string): { bg: string; text: string }`
- Color scheme per type: blue (AI/bot), green (messaging/outreach), rose (error), amber (scoring), gray (generic)

**New file: `client/src/features/automation/hooks/useExecutionGroups.ts`**
```ts
interface ExecutionStep {
  id: number;
  stepName: string;
  stepNumber: number;
  status: string;            // normalized ("error" → "failed")
  executionTimeMs: number | null;
  errorCode: string | null;
  inputData: string | null;
  outputData: string | null;
  retryCount: number | null;
  createdAt: string;
  raw: any;                  // original row
}

interface ExecutionGroup {
  executionId: string;        // workflow_execution_id or fallback
  workflowName: string;
  automationType: AutomationType;
  steps: ExecutionStep[];     // sorted by stepNumber ASC
  overallStatus: "success" | "failed" | "running" | "partial";
  totalDurationMs: number;
  failedStep: ExecutionStep | null;
  leadName: string | null;
  accountName: string | null;
  campaignName: string | null;
  lead: any; account: any; campaign: any;
  latestTimestamp: string;
}
```
- Group by `workflow_execution_id` (null → single-step group using row `id`)
- Sort steps by `step_number` ASC, tiebreak on `created_at`
- `overallStatus`: any failed → "failed", any started/waiting/retrying → "running", all success/skipped → "success", else "partial"
- `failedStep`: first step with status "failed" or "error"

---

## Phase 2: Progress Bar Component
Build the reusable segmented progress bar.

### Tasks
- [ ] Create `ExecutionProgressBar` component with compact and standard variants

### Technical Details

**New file: `client/src/features/automation/components/ExecutionProgressBar.tsx`**
```tsx
interface ExecutionProgressBarProps {
  steps: ExecutionStep[];
  compact?: boolean;   // table row (h-1.5) vs card (h-2)
  className?: string;
}
```
- Container: `rounded-full overflow-hidden flex gap-px`
- Each segment: `flex-1 min-w-[4px]` with inline `backgroundColor`
- Status → color (light/dark):
  - success: `#10B981` / `#059669`
  - failed: `#F43F5E` / `#E11D48`
  - skipped: `#D1D5DB` / `#4B5563`
  - waiting: `#F59E0B` / `#D97706`
  - retrying: `#6366F1` / `#4F46E5`
  - started: `#3B82F6` / `#2563EB`
- Dark mode via `isDarkMode()` from avatarUtils
- `title` attribute per segment: `"${stepName} — ${status} (${time})"`

---

## Phase 3: Table View Upgrades
Add avatars and progress bars to the existing table, plus the ViewTabBar.

### Tasks
- [ ] Add ViewTabBar (Table | Pipeline) to toolbar row [complex]
  - [ ] Add view state and tab definitions (icons: `Table2`, `GitBranch`)
  - [ ] Place between title block and search pill
  - [ ] Conditional rendering based on active view
- [ ] Upgrade Workflow column with automation type avatar [complex]
  - [ ] Merge `EntityAvatar` (size 36) into Workflow cell with type sublabel
  - [ ] Widen column from 160→200
  - [ ] Resolve automation type per row via registry
- [ ] Add Pipeline column with compact progress bar
  - [ ] New column definition after Step (width 120)
  - [ ] Build execution lookup map from `useExecutionGroups`
  - [ ] Render `ExecutionProgressBar compact` per row

### Technical Details

**Modify: `client/src/pages/AutomationLogs.tsx`**

ViewTabBar integration:
```tsx
import { ViewTabBar, type TabDef } from "@/components/ui/view-tab-bar";
import { Table2, GitBranch } from "lucide-react";

const VIEW_TABS: TabDef[] = [
  { id: "table", label: "Table", icon: Table2 },
  { id: "pipeline", label: "Pipeline", icon: GitBranch },
];
const [viewMode, setViewMode] = useState<"table" | "pipeline">("table");
```

Workflow cell upgrade (inside table row render):
```tsx
<td style={{ width: 200 }}>
  <div className="flex items-center gap-2 min-w-0">
    <EntityAvatar name={automationType.label} bgColor={color.bg} textColor={color.text} size={36} />
    <div className="min-w-0">
      <span className="text-[13px] font-medium text-foreground truncate block">{workflowName}</span>
      <span className="text-[10px] text-muted-foreground truncate block">{automationType.label}</span>
    </div>
  </div>
</td>
```

Pipeline column: renders `<ExecutionProgressBar steps={executionGroup.steps} compact />` looked up from a `Map<string, ExecutionGroup>` keyed by `workflow_execution_id`.

---

## Phase 4: Pipeline View (Split-Pane)
Build the new grouped execution view with step timeline.

### Tasks
- [ ] Create PipelineView component with left panel execution list [complex]
  - [ ] Scrollable card list following card standard (gap-[3px], p-[3px])
  - [ ] Each card: EntityAvatar + workflow name + relative time + compact progress bar + status pill + lead name + step count
  - [ ] Card states: bg-card / bg-card-hover / selected bg-[#FFF9D9]
  - [ ] Selection state management
- [ ] Create right panel step timeline [complex]
  - [ ] Header: workflow name, overall status pill, total duration, entity links
  - [ ] Vertical timeline: step number circles + connecting line (border-l-2, color per status)
  - [ ] Step rows: name, status badge (reuse STATUS_CONFIG), execution time
  - [ ] Expandable error details for failed steps (error_code, input/output JSON)
  - [ ] Empty state when no execution selected
- [ ] Wire PipelineView into AutomationLogs page
  - [ ] Pass filtered execution groups to PipelineView
  - [ ] Ensure all toolbar filters apply to pipeline view

### Technical Details

**New file: `client/src/features/automation/components/PipelineView.tsx`**

Left panel: `w-[340px] shrink-0 flex flex-col bg-muted rounded-lg overflow-hidden`
- Scroll area: `overflow-y-auto p-[3px]` with `gap-[3px]` between cards
- Card height: auto, `p-3`
- Row 1: avatar + name + timestamp (right-aligned)
- Row 2: `ExecutionProgressBar` standard
- Row 3: status pill + lead name + "N steps" label

Right panel: `flex-1 min-w-0 flex flex-col bg-muted rounded-lg overflow-hidden`
- Header section: `px-4 py-3 border-b border-border/20`
- Timeline container: `overflow-y-auto px-4 py-3`
- Each step node:
  - Left gutter: `w-8` with step number in colored circle + vertical line below
  - Content: step name (13px), status badge (reuse STATUS_CONFIG markup), exec time (11px mono)
  - Error expansion: same markup as current table error expansion (error_code pill, input/output pre blocks)

**Modify: `client/src/pages/AutomationLogs.tsx`**
```tsx
{viewMode === "table" ? (
  /* existing table + pagination */
) : (
  <PipelineView executions={filteredExecutionGroups} />
)}
```

---

## File Summary

| Action | File |
|--------|------|
| Create | `client/src/features/automation/automationRegistry.ts` |
| Create | `client/src/features/automation/hooks/useExecutionGroups.ts` |
| Create | `client/src/features/automation/components/ExecutionProgressBar.tsx` |
| Create | `client/src/features/automation/components/PipelineView.tsx` |
| Modify | `client/src/lib/avatarUtils.ts` |
| Modify | `client/src/pages/AutomationLogs.tsx` |
