# Implementation Plan: Gmail Integration

## Phase 1: OAuth + Token Management (Backend)

### 1.1 Install dependencies
- Add `googleapis` (Google APIs Node.js client) to `package.json`
- Add `crypto` usage for token encryption (Node built-in)

### 1.2 Create `server/gmail.ts` (Gmail service module)
- OAuth2 client setup using existing credentials from env vars:
  - `GOOGLE_CLIENT_ID` = (set in .env)
  - `GOOGLE_CLIENT_SECRET` = (set in .env)
  - `GOOGLE_REDIRECT_URI` = `https://app.leadawaker.com/api/gmail/oauth/callback`
- Functions: `getAuthUrl()`, `exchangeCode(code)`, `refreshToken(token)`, `getGmailClient()`
- Token encryption/decryption using `GMAIL_TOKEN_SECRET` env var (AES-256-GCM)

### 1.3 Add `GmailSyncState` to schema
- New table in `shared/schema.ts`
- Stores encrypted OAuth tokens, `lastHistoryId`, `lastFullSyncAt`
- Single-row table (one Gmail account)

### 1.4 Add OAuth routes to `server/routes.ts`
- `GET /api/gmail/oauth/authorize` — redirects to Google consent screen
- `GET /api/gmail/oauth/callback` — exchanges code, stores encrypted tokens, redirects to settings
- `GET /api/gmail/oauth/status` — returns connection status (connected/disconnected, email)
- `POST /api/gmail/oauth/disconnect` — removes tokens

### 1.5 Settings UI
- New "Email Integration" section in Settings page
- "Connect Gmail" button (triggers OAuth flow)
- Shows connected account email when connected
- "Disconnect" button

**Files touched:**
- `shared/schema.ts` (new table)
- `server/gmail.ts` (new file)
- `server/routes.ts` (new routes)
- `client/src/features/settings/` (UI addition)
- `.env` (new env vars)

---

## Phase 2: Email Sync Engine (Backend)

### 2.1 Create `server/gmail-sync.ts`
- `syncEmails()` function:
  1. Get Gmail client with valid tokens
  2. If no `lastHistoryId`: do initial sync (last 30 days via `messages.list` with `after:` query)
  3. If has `lastHistoryId`: incremental sync via `history.list`
  4. For each new message: fetch full message, parse headers/body
  5. Match to prospect by email address (check `email`, `contactEmail`, `contact2Email`)
  6. Create Interaction record if not already synced (dedup on `gmailMessageId` in metadata)
  7. Update `lastHistoryId`

### 2.2 Email parser utility
- `parseGmailMessage(message)` function:
  - Extract: `from`, `to`, `cc`, `subject`, `date`, `messageId`, `threadId`, `inReplyTo`
  - Extract body: prefer HTML part, fallback to plain text
  - Detect direction: outbound if `from` contains `gabriel@leadawaker.com` or `leadawaker@gmail.com`
  - Count attachments (metadata only, no download)

### 2.3 Prospect email matching
- `matchProspectByEmail(email)` function:
  - Query prospects where `email`, `contactEmail`, or `contact2Email` matches sender/recipient
  - Handle case-insensitive matching
  - Return prospect ID or null (unmatched emails are skipped)

### 2.4 Background polling
- `setInterval` in server startup: run `syncEmails()` every 5 minutes
- Graceful error handling (log + continue on failure, don't crash server)
- SSE broadcast when new email interactions are created (existing `interactions/stream`)

### 2.5 Storage layer additions
- `getInteractionByGmailMessageId(messageId)` — for dedup check
- `getGmailSyncState()` / `upsertGmailSyncState(data)`

**Files touched:**
- `server/gmail-sync.ts` (new file)
- `server/storage.ts` (new methods)
- `server/index.ts` or `server/routes.ts` (start polling on boot)

---

## Phase 3: Email History UI (Frontend)

### 3.1 Update InteractionTimeline for email display
- Email interactions already render via `InteractionTimeline.tsx`
- Enhance email cards:
  - Show subject line (from `metadata.subject`)
  - Show snippet/preview (first 120 chars of content)
  - Direction badge: "Sent" (indigo) / "Received" (gray)
  - Expand/collapse for full HTML body (rendered in sandboxed iframe or `dangerouslySetInnerHTML` with sanitization)
  - Thread grouping: visually indent replies in same `conversationThreadId`

### 3.2 Email count badge
- Show email count in prospect detail tabs/header
- Fetch count from interactions API (filter by `type=email, prospectId=X`)

### 3.3 API endpoint for email interactions
- Existing `GET /api/interactions?prospect_id=X` already works
- Add optional `type=email` filter parameter if not already supported

**Files touched:**
- `client/src/features/prospects/components/InteractionTimeline.tsx`
- `client/src/features/prospects/components/ProspectDetailView.tsx` (badge/tab)
- `server/routes.ts` (filter enhancement if needed)

---

## Phase 4: Compose + Send (Frontend + Backend)

### 4.1 Gmail send API route
- `POST /api/gmail/send` — body: `{ to, subject, htmlBody, replyToMessageId?, threadId? }`
  - Builds MIME message with:
    - `From: Gabriel Barbosa Fronza <gabriel@leadawaker.com>`
    - HTML body + branded signature appended
    - `In-Reply-To` and `References` headers if replying
    - `threadId` for threading replies in Gmail
  - Sends via `gmail.users.messages.send`
  - Creates Interaction record immediately
  - Updates prospect status fields (`lastContactedAt`, `followUpCount`, etc.)
  - Returns created interaction

### 4.2 Branded HTML signature
- Port signature from outreach-email skill to a shared constant/template
- Signature HTML:
  ```html
  <table cellpadding="0" cellspacing="0" style="font-family:Arial,sans-serif;font-size:13px;color:#333;margin-top:20px;border-top:2px solid #4F46E5;padding-top:12px">
    <tr>
      <td style="padding-right:16px">
        <img src="https://app.leadawaker.com/5.SideLogo.svg" alt="Lead Awaker" width="120" style="display:block">
      </td>
      <td>
        <strong style="font-size:14px">Gabriel Barbosa Fronza</strong><br>
        <a href="https://www.leadawaker.com" style="color:#4F46E5;text-decoration:none">www.leadawaker.com</a><br>
        <span style="color:#666">WhatsApp: (+47) 97400-2162</span>
      </td>
    </tr>
  </table>
  ```

### 4.3 Compose modal component
- `EmailComposeModal.tsx` in `client/src/features/prospects/components/`
- Props: `prospect`, `replyTo?` (for reply context)
- Fields:
  - **To:** pre-filled, dropdown with prospect's emails (email, contactEmail, contact2Email)
  - **Subject:** free text (pre-filled if reply: "Re: ...")
  - **Body:** textarea or lightweight rich text (start simple: textarea with Markdown preview, upgrade later)
  - **Template selector:** dropdown pulling from `OutreachTemplates` (channel=email)
  - **Variable substitution:** replace `{{name}}`, `{{company}}`, `{{niche}}` with prospect fields
- Buttons: "Send" (calls `/api/gmail/send`), "Cancel"
- On success: close modal, show toast, refetch interactions

### 4.4 Wire compose into prospect detail
- "Send Email" button in `ProspectDetailView.tsx` header actions
- "Reply" button on each received email in `InteractionTimeline.tsx`
- Both open `EmailComposeModal` with appropriate context

### 4.5 Prospect auto-status update (server-side)
- In the `/api/gmail/send` handler:
  - If prospect `status` is "New" → update to "Contacted"
  - Set `firstContactedAt` if null
  - Update `lastContactedAt` to now
  - Set `contactMethod` = "email"
  - Increment `followUpCount`
  - Set `outreachStatus` = "email_sent"

**Files touched:**
- `server/routes.ts` (send endpoint)
- `server/gmail.ts` (send function)
- `client/src/features/prospects/components/EmailComposeModal.tsx` (new file)
- `client/src/features/prospects/components/ProspectDetailView.tsx` (send button)
- `client/src/features/prospects/components/InteractionTimeline.tsx` (reply button)
- `client/src/locales/{en,nl,pt}/prospects.json` (i18n strings)

---

## Phase 5: Polish + Error Handling

### 5.1 Token expiry handling
- If Gmail API returns 401: attempt token refresh
- If refresh fails: mark as disconnected, show banner in CRM
- Notification to Gabriel via existing toast system

### 5.2 Sync status indicator
- Small status pill on Prospects page: "Gmail connected" (green) / "Disconnected" (red)
- Last sync timestamp tooltip

### 5.3 Manual sync trigger
- "Sync Now" button in Settings email section
- Calls `POST /api/gmail/sync` to trigger immediate sync

### 5.4 Error states
- Compose modal: show send errors inline
- Sync failures: log to console, don't crash the poll loop
- Rate limiting: Gmail API quota is 250 units/second (very generous for single-user)

---

## Execution Order & Estimates

| Phase | Description | Complexity |
|-------|-------------|------------|
| 1 | OAuth + Token Management | Medium |
| 2 | Email Sync Engine | High (core logic) |
| 3 | Email History UI | Low (extends existing) |
| 4 | Compose + Send | Medium |
| 5 | Polish + Error Handling | Low |

**Recommended approach:** Build phases 1-4 sequentially. Phase 5 can be done incrementally.

**Parallel subagent opportunity:** Phase 3 (frontend) and Phase 2 (backend sync) can be built in parallel once Phase 1 is complete. Phase 4 backend (send route) and Phase 4 frontend (compose modal) can also be parallelized.
