# Prospect Chat Tab -- Requirements

## Overview

Add a "Prospects" tab to the Conversations page showing all email/WhatsApp conversations with prospects in a unified chat interface. Agency-only visibility.

## Key Decisions

- **Flat timeline** per prospect (no email thread grouping). All messages to/from a prospect in one chronological stream.
- **Reply in thread by default** (auto-fill threadId + replyToMessageId). "New message" button for fresh subject lines.
- **Mixed channels**: email + WhatsApp in one timeline, distinguished by channel badge on each bubble.
- **Read/unread tracking**: add `is_read` boolean to Interactions. Inbound = unread by default. Mark read on conversation open. Tab shows unread count.
- **Replaces Support tab** in the conversations page tab bar.

## What to Build

### 1. Conversations Page -- Prospects Tab

- New tab: "Prospects" (icon: briefcase or building)
- Only visible for agency users (accountsId === 1)
- Conversation list on left: one entry per prospect with latest message preview
- Sorted by latest interaction timestamp DESC
- Unread badge per prospect (count of is_read=false inbound interactions)
- Click -> opens chat panel on right

### 2. Chat Panel -- Email Bubble Variant

- Email bubbles: subject line as subtle header above body
- Channel badge on each bubble (envelope icon for email, WhatsApp icon for WhatsApp)
- Outbound = right side, Inbound = left side
- Existing chat bubble styling (reuse streak logic, tails, spacing)
- Truncate long emails with "Show more" expand

### 3. Reply Box

- Default: reply in same Gmail thread
- Auto-populates: to (prospect contact_email), threadId, replyToMessageId (from last inbound)
- "New message" button: clears thread context, shows subject field
- Sends via POST /api/gmail/send

### 4. Prospects Page -- Click Handler Fix

- Clicking a sent interaction (currently shows "something went wrong")
- Should navigate to: /conversations?tab=prospects&prospectId={id}
- Conversations page reads query param, opens Prospects tab, selects that prospect

### 5. DB Change -- is_read Column

```sql
ALTER TABLE p2mxx34fvbf3ll6."Interactions"
ADD COLUMN IF NOT EXISTS is_read boolean DEFAULT true;

-- Mark all existing inbound prospect emails as read (historical)
UPDATE p2mxx34fvbf3ll6."Interactions"
SET is_read = true
WHERE prospect_id IS NOT NULL;
```

Gmail sync handler: set is_read = false for inbound emails (direction = 'inbound').

### 6. API Endpoints

- `GET /api/prospects/conversations` -- list prospects with latest interaction + unread count
- `GET /api/prospects/:id/interactions` -- paginated interactions for a prospect (20 per page)
- `PATCH /api/interactions/mark-read` -- mark interactions as read (body: { prospectId, interactionIds })

## What NOT to Build

- No compose-from-scratch in the Prospects tab (use /outreach-email skill or email_outreach.py)
- No prospect status controls in chat panel (keep on Prospects page)
- No duplicate prospect detail panel (just a small header: name + company + status badge)
- No separate email vs WhatsApp tabs within a prospect conversation

## Files to Modify

| File | Change |
|------|--------|
| ConversationsPage.tsx | Add Prospects tab, agency-only visibility |
| ChatPanel.tsx (or new ProspectChatPanel.tsx) | Email bubble variant with subject header + channel badge |
| InteractionTimeline.tsx | Reuse for prospect chat (or create ProspectTimeline.tsx) |
| server/routes.ts | 3 new API endpoints |
| server/storage.ts | Query functions for prospect conversations |
| shared/schema.ts | Add is_read to interactions |
| gmail-sync.ts | Set is_read=false for inbound |
| ProspectsPage.tsx | Fix click handler to navigate to conversations |

## Data Flow

```
Gmail sync (every 5min) -> Interactions (prospect_id, is_read=false for inbound)
                                |
                                v
Conversations Page [Prospects tab] -> GET /api/prospects/conversations
   |                                    (prospects with unread counts)
   v
Click prospect -> GET /api/prospects/:id/interactions
   |               (paginated, chronological)
   v
Chat panel renders bubbles (email with subject header, WhatsApp plain)
   |
   v
Reply -> POST /api/gmail/send (with threadId for threading)
   |
   v
PATCH /api/interactions/mark-read (on conversation open)
```
