# Implementation Plan: AI Agents in Conversations

## Overview

Embed Campaign Crafter and Code Runner as pinned entries at the top of the Conversations inbox. The right panel renders `AgentChatView` when an agent is selected. The Sophie floating widget gets a small "switch agent" footer link. The standalone AI Agents page and sidebar nav item are removed.

---

## Phase 1: Remove standalone AI Agents page

Remove the now-unused sidebar nav item and routes.

### Tasks
- [x] In `client/src/components/crm/RightSidebar.tsx`:
  - Remove the `{ href: "${prefix}/ai-agents", ... BotMessageSquare ... agencyOnly: true }` nav item object from `navItems`
  - Remove `BotMessageSquare` from lucide-react import (if no longer used elsewhere)
  - Remove `"ai-agents"` from `agencyOnlyPaths` array
  - Remove `"ai-agents": t("sidebar.aiAgents")` from `PAGE_LABELS`
  - Remove `"AI Agents"` from the Backend section filter array
- [x] In `client/src/pages/app.tsx`:
  - Remove `import { AgentsPage }` and `import { AgentChatPage }` lines
  - Remove the four routes: `/agency/ai-agents`, `/agency/ai-agents/:agentId`, `/subaccount/ai-agents`, `/subaccount/ai-agents/:agentId`

### Technical Details
```
Files: client/src/components/crm/RightSidebar.tsx, client/src/pages/app.tsx
No new files needed. Purely subtractive changes.
```

---

## Phase 2: Add agent selection state to Conversations page

Introduce a `selectedAgentId: number | null` state that coexists with `selectedLeadId`. When an agent is selected, lead selection is deselected and vice versa.

### Tasks
- [x] In `client/src/pages/Conversations.tsx`:
  - Add `selectedAgentId` state (number | null), persisted to `sessionStorage` key `"selected-agent-id"`
  - Add setter `setSelectedAgentId` that clears `selectedLeadId` when setting a non-null agent
  - Modify `handleSelectLead` to also call `setSelectedAgentId(null)` when a lead is selected
  - Add a handler `handleSelectAgent(agentId: number)` that sets `selectedAgentId(agentId)` and `setSelectedLeadId(null)` and on mobile sets `mobileView("chat")`
  - Expose `selectedAgentId` and `handleSelectAgent` as props down to `InboxPanel`

### Technical Details
```tsx
// In Conversations.tsx, near other selectedLeadId state:
const [selectedAgentId, setSelectedAgentIdRaw] = useState<number | null>(() => {
  try {
    const stored = sessionStorage.getItem("selected-agent-id");
    return stored ? Number(stored) : null;
  } catch { return null; }
});
const setSelectedAgentId = (id: number | null) => {
  setSelectedAgentIdRaw(id);
  try {
    if (id) sessionStorage.setItem("selected-agent-id", String(id));
    else sessionStorage.removeItem("selected-agent-id");
  } catch {}
};

const handleSelectAgent = (agentId: number) => {
  setSelectedAgentId(agentId);
  setSelectedLeadId(null);
  setMobileView("chat");
};
```

---

## Phase 3: Fetch AI agents in Conversations page

Fetch the list of agents from `/api/ai-agents` and pass it down.

### Tasks
- [x] In `client/src/pages/Conversations.tsx`:
  - Add a `useQuery` for `/api/ai-agents` (only when `isAgencyUser`)
  - Store result as `aiAgents: AiAgent[]`
  - Pass `aiAgents`, `selectedAgentId`, `onSelectAgent` as props to `InboxPanel`

### Technical Details
```tsx
import type { AiAgent } from "@/../../shared/schema"; // or define inline type

const { data: aiAgents = [] } = useQuery<AiAgent[]>({
  queryKey: ["/api/ai-agents"],
  queryFn: async () => {
    const res = await apiFetch("/api/ai-agents");
    if (!res.ok) return [];
    return res.json();
  },
  enabled: isAgencyUser,
  staleTime: 60_000,
});
```
AiAgent type needed: `{ id: number; name: string; type: string; photoUrl: string | null; enabled: boolean }`
Define inline in Conversations.tsx to avoid deep import complexity.

---

## Phase 4: Pinned AI Assistants section in InboxPanel [complex]

Add a non-scrollable pinned section at the top of the inbox list showing AI agent rows.

### Tasks
- [x] Add props to `InboxPanelProps` in `InboxPanel.tsx`:
  ```ts
  aiAgents?: { id: number; name: string; type: string; photoUrl: string | null }[];
  selectedAgentId?: number | null;
  onSelectAgent?: (id: number) => void;
  ```
- [x] Render a pinned "AI Assistants" section above the virtualised thread list
  - Only renders if `aiAgents.length > 0`
  - Section header: small label "AI Assistants" with a `BotMessageSquare` icon
  - One row per agent: avatar (type-specific icon or photoUrl), name, type chip
  - Row active state: same `bg-accent` highlight as selected thread
  - Divider line below section before customer threads begin
- [x] Agent row avatar logic:
  - `campaign_crafter` → `MessageSquare` icon in indigo circle
  - `code_runner` → `Zap` icon in green circle
  - `custom` → `Bot` icon in gray circle
  - If `photoUrl` set → show image instead of icon

### Technical Details
```tsx
// Pinned section renders OUTSIDE the virtualiser, above the scroll container
{aiAgents && aiAgents.length > 0 && onSelectAgent && (
  <div className="shrink-0 border-b border-border/50">
    <div className="px-3 py-1.5 flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
      <BotMessageSquare className="h-3 w-3" />
      AI Assistants
    </div>
    {aiAgents.map((agent) => (
      <AgentInboxRow
        key={agent.id}
        agent={agent}
        isSelected={selectedAgentId === agent.id}
        onClick={() => onSelectAgent(agent.id)}
      />
    ))}
  </div>
)}
```
Place this block just before the virtualiser's `<div ref={parentRef}>` container.

---

## Phase 5: Right panel renders AgentChatView when agent selected [complex]

When `selectedAgentId` is non-null, the right panel shows the agent chat instead of the normal ChatPanel + ContactSidebar.

### Tasks
- [x] In `client/src/pages/Conversations.tsx`:
  - Add `const isAgentSelected = selectedAgentId !== null`
  - In the JSX where `ChatPanel` is rendered, add a conditional:
    - If `isAgentSelected` → render `<AgentChatInConversations agentId={selectedAgentId} />`
    - Else → render the existing `ChatPanel` + `ContactSidebar` layout
  - Create `AgentChatInConversations` as a small local wrapper component or import `AgentChatView` directly
- [x] The agent chat panel should fill the same space as `ChatPanel` (`flex-1 min-h-0 overflow-hidden`)
- [x] On mobile: when `mobileView === "chat"` and `isAgentSelected`, show the agent chat. Back button calls `handleSelectAgent(null)` → goes back to inbox

### Technical Details
```tsx
// In the right panel area of Conversations.tsx JSX:
{isAgentSelected ? (
  <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
    <AgentChatView
      agentId={selectedAgentId!}
      onBack={() => { setSelectedAgentId(null); setMobileView("inbox"); }}
    />
  </div>
) : (
  /* existing ChatPanel + ContactSidebar */
)}
```
Note: `AgentChatView` already accepts `agentId` and calls `useAgentChat.initialize(agentId)` internally.
Check current `AgentChatView` props and adjust if needed — it may currently receive the full agent object. If so, pass `aiAgents.find(a => a.id === selectedAgentId)`.

---

## Phase 6: Sophie widget "Switch agent" footer link

Add a small footer to the Sophie floating widget (agency admin only) with quick links to each AI agent.

### Tasks
- [x] In `client/src/components/crm/SupportChatWidget.tsx` (the main widget component):
  - Accept optional prop `aiAgents?: { id: number; name: string }[]` and `onOpenAgent?: (id: number) => void`
  - If `isAgencyUser && aiAgents.length > 0`, render a thin footer bar below the input area:
    ```
    Switch to: [Campaign Crafter →]  [Code Runner →]
    ```
  - Each link calls `onOpenAgent(id)` which navigates to `/agency/conversations` and sets `selectedAgentId`
- [x] In `client/src/components/crm/Topbar.tsx` (or wherever the widget is mounted):
  - Pass `aiAgents` and `onOpenAgent` down to `SupportChatWidget`
  - `onOpenAgent` implementation: `setLocation("/agency/conversations")` + store agent id in sessionStorage so Conversations page picks it up on mount

### Technical Details
```tsx
// Footer in SupportChatWidget (inside the section, below input bar):
{isAgencyUser && aiAgents && aiAgents.length > 0 && (
  <div className="px-3 py-1.5 border-t border-border/40 flex items-center gap-2 flex-wrap">
    <span className="text-[11px] text-muted-foreground">Switch to:</span>
    {aiAgents.map(a => (
      <button key={a.id} onClick={() => onOpenAgent?.(a.id)}
        className="text-[11px] text-brand-indigo hover:underline">
        {a.name} →
      </button>
    ))}
  </div>
)}

// onOpenAgent in the widget parent (Topbar or CrmShell):
const handleOpenAgent = (agentId: number) => {
  sessionStorage.setItem("selected-agent-id", String(agentId));
  setLocation(isAgencyUser ? "/agency/conversations" : "/subaccount/conversations");
  // close the sophie widget
};
```
The Conversations page already reads `sessionStorage("selected-agent-id")` on mount (from Phase 2).

---

## Phase 7: Wire up InboxPanel props in Conversations.tsx

Pass all new props through from Conversations.tsx to InboxPanel.

### Tasks
- [x] Pass `aiAgents`, `selectedAgentId`, `onSelectAgent={handleSelectAgent}` to `<InboxPanel>`
- [x] Update mobile header in Conversations.tsx: when `isAgentSelected`, show agent name instead of lead name
- [x] Run `npx tsc --noEmit` and fix any type errors

### Technical Details
```tsx
// In <InboxPanel ... /> JSX:
aiAgents={isAgencyUser ? aiAgents : []}
selectedAgentId={selectedAgentId}
onSelectAgent={handleSelectAgent}
```
Update `InboxTab` type if needed — agent selection is NOT a tab, it's a separate selection state coexisting with the tab.

---

## Phase 8: i18n cleanup

Remove the now-unused `sidebar.aiAgents` translation key (optional — leaving it doesn't break anything but it's dead code).

### Tasks
- [x] Remove `"aiAgents"` key from `client/src/locales/en/crm.json`, `pt/crm.json`, `nl/crm.json` under the `sidebar` object
