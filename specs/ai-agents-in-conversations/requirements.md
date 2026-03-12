# Requirements: AI Agents in Conversations

## What & Why

Integrate the two AI agents (Campaign Crafter, Code Runner) directly into the Conversations page as pinned chat entries, visible to agency admins. This replaces the separate `/agency/ai-agents` standalone page (which had a 404 bug and poor UX) with a seamlessly embedded experience inside the tool Gabriel already uses all day.

The floating Sophie widget (headphones button, top bar) gains a small "Switch agent →" link at the bottom (agency admin only) that navigates to Conversations and opens the relevant AI agent chat.

## Acceptance Criteria

1. **Pinned AI section in Conversations left panel** — agency admin only
   - A "AI Assistants" section header appears at the top of the InboxPanel, above all customer threads
   - Two rows: Campaign Crafter + Code Runner, each with avatar, name, and last message preview
   - Clicking a row selects that agent and opens its chat in the right panel
   - Active row is highlighted like a selected customer thread
   - Non-admin users do not see the section at all

2. **Agent chat in right panel**
   - When an AI agent row is selected, the right panel shows `AgentChatView` (not `ChatPanel` / `ContactSidebar`)
   - Header shows agent name, avatar, type badge, and "New Session" button
   - Code Runner shows green "Pi connected · live reload on" badge
   - Full streaming chat works (SSE, token-by-token, sub-agent pills, campaign update blocks)

3. **Sophie floating widget "Switch agent" link**
   - Bottom of Sophie's floating widget shows a small "Campaign Crafter →" and "Code Runner →" links (agency admin only)
   - Clicking navigates to `/agency/conversations` and sets the selected agent in state

4. **Remove AI Agents sidebar nav item**
   - Remove `AI Agents` from RightSidebar nav items
   - Remove the standalone `/agency/ai-agents` and `/agency/ai-agents/:agentId` routes from `pages/app.tsx`
   - Remove `AgentsPage` and `AgentChatPage` imports
   - Remove `"ai-agents"` from `agencyOnlyPaths` in RightSidebar

5. **Persistence**
   - Selected agent persists in sessionStorage so refreshing doesn't lose context
   - Switching between customer threads and back to an agent restores the agent chat

## Dependencies

- `server/aiAgents.ts` — already implemented (CLI spawn, SSE stream)
- `server/routes.ts` — AI agent endpoints already registered
- `client/src/features/ai-agents/components/AgentChatView.tsx` — already implemented
- `client/src/features/ai-agents/hooks/useAgentChat.ts` — already implemented
- `shared/schema.ts` — `aiAgents`, `aiSessions`, `aiMessages` tables already exist and seeded
