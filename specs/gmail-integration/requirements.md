# Requirements: Gmail Integration (Full OAuth)

## What It Does

Connects the LeadAwaker CRM to Gmail via OAuth 2.0, turning the Prospects page into a real outreach CRM. Users can view email history per prospect, compose and send branded HTML emails, and have emails automatically synced into the Interactions table.

## Why

Currently, outreach emails are sent via the `gog` CLI or manually in Gmail. There's no visibility into email history from inside the CRM, no way to compose from the prospect detail panel, and no automatic sync. This creates context-switching between Gmail and the CRM, and means the Interactions timeline is incomplete (only manually-logged emails appear).

## Sending Address

- **OAuth account:** `leadawaker@gmail.com` (Google Workspace)
- **Send-as alias:** `gabriel@leadawaker.com` (verified in Gmail settings)
- **All outbound emails sent as:** `Gabriel Barbosa Fronza <gabriel@leadawaker.com>`

## Acceptance Criteria

### 1. OAuth Flow (Server-Side)
- Server stores OAuth tokens (access + refresh) encrypted in the database or a secure file
- Uses existing Google Cloud OAuth app (client ID: `180647451078-...`)
- Scopes required: `gmail.modify` (covers read, send, modify labels; avoids full `mail.google.com`)
- Admin-only OAuth connect/disconnect flow in Settings page
- Token auto-refresh on expiry (no manual re-auth needed unless revoked)

### 2. Email Sync (Server → DB)
- Background job polls Gmail API every 5 minutes for new messages
- Matches emails to prospects by email address (`email`, `contactEmail`, `contact2Email` fields)
- Creates Interaction records with:
  - `type`: "email"
  - `direction`: "inbound" or "outbound"
  - `content`: email body (HTML stored, plain text fallback)
  - `metadata`: JSON with `{ gmailMessageId, gmailThreadId, subject, from, to, cc, snippet, labels, attachmentCount }`
  - `sentAt`: email date
  - `prospectId`: matched prospect ID
  - `conversationThreadId`: Gmail thread ID (groups replies together)
  - `status`: "delivered" for outbound, "received" for inbound
- Deduplication: skip emails already synced (check `metadata->gmailMessageId`)
- Only syncs emails from the last 30 days on first sync, then incremental via `historyId`

### 3. Email History in Prospect Detail
- New "Emails" tab or section in `ProspectDetailView` / `InteractionTimeline`
- Shows all email interactions (sent + received) in chronological order
- Each email card displays: subject, snippet/preview, date, direction indicator (sent/received)
- Click to expand full email body (rendered HTML)
- Thread grouping: emails in the same Gmail thread are visually grouped
- Badge count showing unread/total emails

### 4. Compose Email from CRM
- "Send Email" button in prospect detail panel
- Opens a compose modal/panel with:
  - **To:** pre-filled from prospect's `contactEmail` (or `email`, with dropdown for alternates)
  - **Subject:** free text input, or pre-filled from template
  - **Body:** rich text editor (basic formatting: bold, italic, links, lists)
  - **Template selector:** dropdown to insert from OutreachTemplates table
  - **Signature:** auto-appended branded HTML signature (matching outreach-email skill):
    ```
    ────────────────────
    Gabriel Barbosa Fronza
    www.leadawaker.com
    WhatsApp: (+47) 97400-2162
    [Lead Awaker logo]
    ```
  - **Send / Save Draft** buttons
- Sends via Gmail API (not SMTP), using the `gabriel@leadawaker.com` send-as alias
- On send: creates Interaction record immediately (no wait for sync)
- Supports reply-to: when viewing a received email, "Reply" button opens compose with `In-Reply-To` and `References` headers set

### 5. Template Integration
- Compose modal has a "Use Template" button
- Pulls from `OutreachTemplates` table (filtered by `channel = 'email'`)
- Template body inserted into editor, subject line pre-filled
- Variables supported: `{{name}}`, `{{company}}`, `{{niche}}` (resolved from prospect fields)

### 6. Prospect Status Auto-Update
- When an email is sent to a prospect with status "New", auto-update to "Contacted"
- Set `firstContactedAt` if null, update `lastContactedAt`
- Set `contactMethod` to "email"
- Increment `followUpCount` on subsequent sends
- Update `outreachStatus` to "email_sent"

## Non-Goals (Out of Scope)

- Multi-user Gmail (only Gabriel's account for now)
- Attachment sending/viewing (Phase 2)
- Email scheduling (send later)
- Bulk email campaigns from CRM (use automation engine for that)
- Email open/click tracking (covered by DIY email service spec)
- Integration with Leads (only Prospects for now; Leads use WhatsApp)

## Dependencies

- Google Cloud OAuth credentials (already exist: `180647451078-...`)
- `googleapis` npm package (Gmail API client)
- `gmail.modify` scope authorized for `leadawaker@gmail.com`
- Branded signature HTML (exists in outreach-email skill)

## Schema Changes

### New columns on Interactions table
None required. The existing schema already supports everything:
- `type` = "email"
- `direction` = "inbound" / "outbound"
- `metadata` (JSON) stores Gmail-specific fields
- `conversationThreadId` stores Gmail thread ID
- `prospectId` links to prospect
- `sentAt`, `status`, `content` all exist

### New table: `GmailSyncState`
Tracks sync cursor to avoid re-processing:
```
gmail_sync_state
  id: integer (PK)
  account_email: varchar (unique)
  last_history_id: varchar
  last_full_sync_at: timestamp
  oauth_tokens_encrypted: text
  created_at: timestamp
  updated_at: timestamp
```

## Related Features

- `specs/diy-email-service/` (Python automation engine email; complementary, not overlapping)
- `InteractionTimeline.tsx` (existing component; will display email interactions)
- `OutreachTemplates` table (template source for compose)
- `outreach-email` skill (signature format reference, outreach copy patterns)
