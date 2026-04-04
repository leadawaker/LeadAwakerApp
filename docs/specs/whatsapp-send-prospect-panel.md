# Spec: WhatsApp Send Button — Prospect Panel
**Task:** #499
**Depends on:** #400 (WhatsApp Cloud API setup)
**Estimated session:** 1 focused Claude session

---

## Goal

A user opens a prospect in the Prospect panel, sees their WhatsApp interaction history, and can send a new message without leaving the panel. The message is delivered via WhatsApp Cloud API and appears in the interaction timeline immediately.

---

## Scope

### In scope
- Compose + send UI inside the Prospect panel (inline, not a modal)
- Backend endpoint to send via WhatsApp Cloud API and save the Interaction record
- Optimistic update in InteractionTimeline after send
- Error state if send fails (e.g. invalid phone, API error)

### Out of scope
- Template message selector (free-text only for now)
- Message status webhooks (delivered/read ticks) — that's a separate task
- WhatsApp Cloud API credentials/setup — covered by #400

---

## Current State

- `InteractionTimeline.tsx` displays all interaction types including `whatsapp`, read-only
- `EmailComposeModal.tsx` is the reference pattern for compose UIs in this codebase
- `ManualSend.tsx` is the reference pattern for sending to Leads (same POST /api/interactions shape)
- No send button exists for WhatsApp anywhere in the Prospect panel
- `conversations.ts` has `POST /api/interactions` which saves records but does not call WhatsApp Cloud API

---

## UI Design

Add a compact composer below the WhatsApp section in the Prospect panel (`ProspectListView.tsx`).

Only show it when:
- The prospect has a `phone` field set
- There is at least 1 previous WhatsApp interaction (or always show if phone exists — simpler, pick one)

```
┌─────────────────────────────────────────┐
│  💬 WhatsApp                            │
│  [interaction history via timeline]     │
│                                         │
│  ┌───────────────────────────────────┐  │
│  │ Type a message...                 │  │
│  └───────────────────────────────────┘  │
│                                [Send →] │
└─────────────────────────────────────────┘
```

- Textarea: 2-3 rows, expands to 5 max
- Send button: disabled when empty or loading
- On send: clear textarea, show optimistic interaction card (direction: outbound, status: sending → sent)
- On error: show inline error, restore textarea content

---

## Backend

### New endpoint: `POST /api/prospects/:prospectId/whatsapp/send`

**Request:**
```json
{ "message": "string" }
```

**Steps:**
1. Fetch prospect by `prospectId`, get `phone`
2. Validate phone exists and is a valid WhatsApp number (basic format check)
3. Call WhatsApp Cloud API `messages` endpoint (use credentials from #400)
4. On API success: insert Interaction record with `type=whatsapp`, `direction=outbound`, `status=sent`, broadcast SSE
5. On API failure: return 502 with error detail

**Response (success):**
```json
{ "interaction": { ...saved record } }
```

Alternatively, reuse `POST /api/interactions` and have it call WhatsApp Cloud API when `type=whatsapp` and `direction=outbound`. Check with the existing code to pick the cleaner path.

---

## Frontend

### Files to touch
| File | Change |
|------|--------|
| `ProspectListView.tsx` | Add `WhatsAppComposer` below the interactions section |
| `InteractionTimeline.tsx` | Accept optional `onSendSuccess` callback or rely on SSE refresh |
| `prospectsApi.ts` | Add `sendWhatsAppMessage(prospectId, message)` function |

### New file
`/client/src/features/prospects/components/WhatsAppComposer.tsx`

Props:
```typescript
interface WhatsAppComposerProps {
  prospectId: number;
  prospectPhone: string | null;
  onSent: (interaction: Interaction) => void;
}
```

Internally calls `prospectsApi.sendWhatsAppMessage()`, handles loading/error state.

---

## Data Flow

```
User types → clicks Send
  → POST /api/prospects/:id/whatsapp/send
    → WhatsApp Cloud API call
    → INSERT into Interactions (type=whatsapp, direction=outbound, status=sent)
    → SSE broadcast
  → Frontend: optimistic card shown immediately
  → SSE event arrives: update card status to confirmed
```

---

## Acceptance Criteria

- [ ] Send button visible in Prospect panel when prospect has a phone number
- [ ] User can type and send a WhatsApp message
- [ ] Sent message appears in the InteractionTimeline as outbound
- [ ] Error message shown if WhatsApp API call fails
- [ ] No page reload or panel close required

---

## Reference Files

- `EmailComposeModal.tsx` — compose UI pattern
- `ManualSend.tsx` — send-to-Lead pattern (POST /api/interactions shape)
- `conversations.ts` — backend interactions routes
- `InteractionTimeline.tsx` — timeline display component
- `ProspectListView.tsx` — where to inject the composer (find the WhatsApp/interactions section)
