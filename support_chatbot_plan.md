# Support Chatbot Widget — Implementation Plan

## Overview

Add a customer service chatbot button (headphones icon) next to the `?` help button in the Topbar. Clicking it opens a white popover with a chat interface connected to an n8n webhook for AI responses. Conversations persist to DB with 7-day auto-cleanup. Includes "Speak to Agent" escalation that triggers both in-app notifications and a Telegram webhook.

---

## Architecture Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| AI backend | n8n webhook | User will wire AI logic in n8n; we build passthrough |
| Persistence | New `Support_Messages` table | Keeps support chat separate from lead Interactions |
| Auto-cleanup | 7-day TTL via Express startup task | Simple, no external cron needed |
| Escalation | In-app notification + Telegram webhook | Dual notification per user request |
| Chat UI | Popover panel from Topbar button | Lightweight, always accessible |
| Prompt storage | Prompt Library entry (seeded) | Centralized, editable from existing UI |

---

## Tasks

### 1. Database: `Support_Messages` table

**File:** `shared/schema.ts`

```sql
Support_Messages (
  id            SERIAL PRIMARY KEY,
  session_id    TEXT NOT NULL,          -- groups messages per chat session
  user_id       INTEGER NOT NULL,       -- logged-in user who opened widget
  account_id    INTEGER,                -- account scoping
  role          TEXT NOT NULL,          -- 'user' | 'assistant' | 'system'
  content       TEXT NOT NULL,
  created_at    TIMESTAMP DEFAULT NOW(),
  escalated     BOOLEAN DEFAULT FALSE   -- flagged when "speak to agent" triggered
)
```

Add Drizzle schema definition + `InsertSupportMessage` / `SupportMessage` types.

### 2. Database: `Support_Sessions` table

```sql
Support_Sessions (
  id            SERIAL PRIMARY KEY,
  session_id    TEXT NOT NULL UNIQUE,
  user_id       INTEGER NOT NULL,
  account_id    INTEGER,
  status        TEXT DEFAULT 'active',  -- 'active' | 'escalated' | 'closed'
  created_at    TIMESTAMP DEFAULT NOW(),
  escalated_at  TIMESTAMP,
  closed_at     TIMESTAMP
)
```

### 3. Backend API endpoints

**File:** `server/routes.ts` + `server/storage.ts`

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `POST /api/support-chat/sessions` | POST | Create new chat session |
| `GET /api/support-chat/sessions/active` | GET | Get user's active session (if any) |
| `POST /api/support-chat/messages` | POST | Send message + forward to n8n webhook |
| `GET /api/support-chat/messages/:sessionId` | GET | Fetch message history for session |
| `POST /api/support-chat/escalate` | POST | Escalate session → create notification + trigger Telegram webhook |
| `DELETE /api/support-chat/cleanup` | Internal | Startup task: delete messages/sessions older than 7 days |

**n8n webhook flow (POST /api/support-chat/messages):**
1. Save user message to DB
2. Forward `{ sessionId, message, systemPrompt, history }` to configurable n8n webhook URL (env var `SUPPORT_CHAT_WEBHOOK_URL`)
3. n8n processes → returns AI response
4. Save AI response to DB
5. Return both messages to frontend

**Escalation flow (POST /api/support-chat/escalate):**
1. Update session status to `'escalated'`
2. Create in-app notification via `storage.createNotification()` with type `'escalation'`
3. Fire-and-forget POST to Telegram webhook URL (env var `SUPPORT_CHAT_TELEGRAM_WEBHOOK_URL`) with session details
4. Return success

### 4. Prompt Library seed entry

**Insert via API or migration:**

```
Name:           "Lead Awaker Support Bot"
System Message: (see §7 below — full prompt)
Model:          "chatgpt-5.2-instant"
Max Tokens:     400
Temperature:    0.6
Status:         active
Use Case:       "customer-support"
Notes:          "System prompt for the in-app support chatbot widget. Edit here to update bot behavior."
```

Add `"chatgpt-5.2-instant"` to `MODEL_OPTIONS` in `features/prompts/types.ts`.

### 5. Frontend: Topbar button

**File:** `client/src/components/crm/Topbar.tsx`

- Add `Headphones` icon import from `lucide-react`
- Place new `IconBtn` immediately before the `?` help button
- Wrap in `Popover` (shadcn/ui) — opens the chat widget
- Tooltip: "Customer Support"

### 6. Frontend: `SupportChatWidget` component

**File:** `client/src/components/crm/SupportChatWidget.tsx`

Single component rendered inside the Popover. Structure:

```
┌─────────────────────────────┐  ← White popover, 360×480px
│  Sophie — Support        ✕  │  ← Header with bot name + close
├─────────────────────────────┤
│                             │
│  ○ Hi! I'm Sophie, your    │  ← AI welcome message
│    Lead Awaker assistant.   │
│                             │
│           How can I help? ● │  ← User message (right-aligned)
│                             │
│  ○ Sure! Lead scoring...    │  ← AI response (left-aligned)
│                             │
│                             │
├─────────────────────────────┤
│  🎧 Speak to Agent         │  ← Escalation button (subtle, bottom)
├─────────────────────────────┤
│  [Type a message...]   [→]  │  ← Input + send button
└─────────────────────────────┘
```

**Behavior:**
- On first open: creates session via `POST /api/support-chat/sessions`
- Shows welcome message (hardcoded, not from API)
- User types → sends to `POST /api/support-chat/messages` → displays AI response
- Loading state: typing indicator dots while waiting for n8n response
- "Speak to Agent": confirmation dialog → calls escalation endpoint → shows "An agent has been notified" message in chat
- Session persists across popover open/close (same session until page refresh or 7-day expiry)
- Uses existing `apiFetch` for all API calls

**Hook:** `useSupportChat.ts` — manages session state, message list, send/receive, escalation.

### 7. System Prompt (for Prompt Library)

```
You are Sophie, the Lead Awaker support assistant. You help clients understand and get the most out of Lead Awaker — an AI-powered WhatsApp lead reactivation platform that converts inactive leads into booked calls.

PERSONALITY
- Friendly, concise, and professional
- Use simple language — no technical jargon unless the user is technical
- Keep responses under 300 tokens

PLATFORM KNOWLEDGE
1. Campaigns — Create WhatsApp outreach campaigns targeting inactive leads with AI-powered messaging sequences
2. Lead Pipeline — Visual Kanban board tracking leads: New → Contacted → Engaged → Interested → Call Booked → Converted
3. AI Conversations — Automated WhatsApp messages that engage leads naturally, with smart follow-up bumps
4. Lead Scoring — Automatic 0-100 scoring based on engagement signals, response quality, and conversion likelihood
5. Manual Takeover — Human agents can take over any AI conversation at any time and hand back to AI when done
6. Calendar — View and manage scheduled calls and follow-ups with leads
7. Analytics — Campaign performance, conversion rates, cost-per-lead, ROI tracking
8. Tags — Organize and segment leads with custom color-coded tags
9. Billing — Track expenses, invoices, and campaign costs with BTW/VAT support

WHAT YOU CAN HELP WITH
- Explaining how any feature works
- Guiding through common workflows (creating campaigns, managing leads, reading analytics)
- Suggesting best practices for lead reactivation
- Clarifying what pipeline stages mean and when leads move between them
- Explaining how AI conversations and bump sequences work

WHAT YOU CANNOT DO
- Access or modify account data, leads, or campaigns directly
- Process payments or change billing information
- Make promises about specific conversion rates or results
- Discuss other clients' accounts or data

ESCALATION RULES — Suggest "Speak to Agent" when:
- User explicitly asks for a human
- You cannot resolve the issue after 2-3 exchanges on the same topic
- The question involves billing disputes, account deletion, or sensitive changes
- User reports a bug or technical issue you cannot diagnose
- User is visibly frustrated

GUARDRAILS
- Stay strictly on Lead Awaker topics. Politely redirect off-topic questions.
- Never fabricate features that don't exist
- If unsure, say "I'm not sure about that — would you like me to connect you with an agent?"
- Maximum response length: 300 tokens
```

### 8. Notification system integration

**File:** `client/src/components/crm/NotificationCenter.tsx`

Add `'escalation'` type to the notification type config:
```ts
escalation: {
  icon: Headphones,
  color: "text-orange-600",
  bgColor: "bg-orange-100/60"
}
```

### 9. Auto-cleanup (7-day TTL)

**File:** `server/routes.ts` (or `server/index.ts`)

On server startup, run cleanup query:
```sql
DELETE FROM "Support_Messages" WHERE created_at < NOW() - INTERVAL '7 days';
DELETE FROM "Support_Sessions" WHERE created_at < NOW() - INTERVAL '7 days';
```

Also runs daily via a `setInterval(cleanup, 24 * 60 * 60 * 1000)` in the server process.

---

## Environment Variables (new)

```env
SUPPORT_CHAT_WEBHOOK_URL=https://your-n8n.com/webhook/support-chat
SUPPORT_CHAT_TELEGRAM_WEBHOOK_URL=https://your-n8n.com/webhook/support-telegram
```

Both are optional — if not set, chatbot returns a fallback message ("Support is being configured") and Telegram notification is skipped.

---

## File Ownership Summary

| File | Action |
|------|--------|
| `shared/schema.ts` | Add 2 new tables |
| `server/storage.ts` | Add CRUD methods for support chat |
| `server/routes.ts` | Add 5 new endpoints + cleanup task |
| `client/src/features/prompts/types.ts` | Add model option |
| `client/src/components/crm/Topbar.tsx` | Add headphones button + Popover |
| `client/src/components/crm/SupportChatWidget.tsx` | **NEW** — chat widget UI |
| `client/src/hooks/useSupportChat.ts` | **NEW** — chat state/API hook |
| `client/src/components/crm/NotificationCenter.tsx` | Add escalation type |

---

## What's NOT in scope (future)

- Agent responding via the widget (agent would message via Conversations page for now)
- WebSocket real-time updates (polling is fine for MVP)
- File/image attachments in support chat
- Chat rating/feedback system
- Multi-language support
