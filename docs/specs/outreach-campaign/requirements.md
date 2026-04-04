# Outreach Campaign System — Full Spec

## Overview

Transform the LeadAwaker CRM from a static prospect database into a full outreach campaign system with email integration, interaction tracking, pipeline automation, and task creation. This builds on the existing WAT automation framework at `/home/gabriel/automations/` and the Interactions table (47 columns) already in the DB.

---

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│  LeadAwaker CRM (React + Express)                        │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────┐ │
│  │ Pipeline     │  │ Detail Panel │  │ Template Picker │ │
│  │ Kanban View  │  │ + Timeline   │  │ (already built) │ │
│  └──────┬───────┘  └──────┬───────┘  └────────┬────────┘ │
│         │                 │                    │          │
│  ┌──────┴─────────────────┴────────────────────┴────────┐│
│  │              Express API Layer                        ││
│  │  /api/interactions  /api/prospects  /api/tasks        ││
│  │  POST /api/webhooks/gmail  (push notifications)       ││
│  └──────────────────────┬───────────────────────────────┘│
└─────────────────────────┼────────────────────────────────┘
                          │
┌─────────────────────────┼────────────────────────────────┐
│  PostgreSQL (nocodb)     │                                │
│  ┌──────────┐ ┌─────────┴──┐ ┌────────┐ ┌─────────────┐ │
│  │Prospects │ │Interactions│ │ Tasks  │ │ Templates   │ │
│  └──────────┘ └────────────┘ └────────┘ └─────────────┘ │
└──────────────────────────────────────────────────────────┘
                          │
┌─────────────────────────┼────────────────────────────────┐
│  Gmail Integration (webhook-based, NOT polling)          │
│  - Gmail push notifications via Google Pub/Sub           │
│  - POST /api/webhooks/gmail receives new email events    │
│  - Handler fetches changed messages, syncs to            │
│    Interactions table                                    │
│  - Fallback: on-demand sync when prospect panel opens    │
└──────────────────────────────────────────────────────────┘
```

---

## Part 1: Pipeline Stages Update

### Current stages (7):
`new → contacted → responded → call_booked → proposal_sent → won → lost`

### New stages (9):
`new → contacted → responded → call_booked → demo_given → proposal_sent → negotiating → won → lost`

**Stage definitions:**
| Stage | Color | Meaning | Auto-actions |
|-------|-------|---------|-------------|
| `new` | Gray | Fresh prospect, not yet reached | — |
| `contacted` | Amber | First outreach sent | Set `first_contacted_at`, create "Follow up with {company}" task |
| `responded` | Blue | They replied | Log interaction, notify Gabriel |
| `call_booked` | Violet | Discovery/demo call scheduled | Create "Call with {company}" task with date |
| `demo_given` | Indigo | Call happened, awaiting decision | Create "Send proposal to {company}" task |
| `proposal_sent` | Pink | Contract/proposal sent | Create "Follow up on proposal: {company}" task (5 day follow-up) |
| `negotiating` | Orange | In active discussion | — |
| `won` | Emerald | Deal closed | Create "Onboard {company}" task |
| `lost` | Gray | Dead — reason tracked in notes | — |

**Files to modify:**
- `client/src/features/prospects/components/OutreachPipelineView.tsx` — add 2 new columns

---

## Part 2: Prospect Detail Panel with Interaction Timeline

### Design: Expandable Side Panel
When user clicks a prospect name/row in **any view** (table, pipeline, follow-ups), a slide-over panel opens from the right (60% width on desktop, full on mobile).

### Panel Layout:
```
┌─────────────────────────────────────────────┐
│ ← Back    SolarDenBosch BV         Edit  ✕  │
│ ─────────────────────────────────────────── │
│ Status: [contacted ▼]  Priority: [high ▼]   │
│ Niche: Solar  City: 's-Hertogenbosch        │
│ ─────────────────────────────────────────── │
│                                             │
│ [Overview] [Interactions] [Tasks] [Notes]    │
│                                             │
│ ┌─ INTERACTIONS TAB ──────────────────────┐ │
│ │                                         │ │
│ │  📤 Mar 12 — Email sent (first contact) │ │
│ │  "Hi Jan, I noticed SolarDenBosch..."   │ │
│ │                                         │ │
│ │  📥 Mar 14 — Email reply                │ │
│ │  "Thanks for reaching out, I'd be..."   │ │
│ │  📎 brochure.pdf                        │ │
│ │                                         │ │
│ │  📞 Mar 15 — Call (30 min)              │ │
│ │  Notes: "Interested in reactivation..." │ │
│ │                                         │ │
│ │  [+ Add interaction]                    │ │
│ └─────────────────────────────────────────┘ │
│                                             │
│ ┌─ TASKS TAB ─────────────────────────────┐ │
│ │  ☐ Send proposal to SolarDenBosch       │ │
│ │  ☑ Follow up after first contact        │ │
│ └─────────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
```

### Tabs:
1. **Overview** — existing ProspectDetailView fields (contact info, location, etc.)
2. **Interactions** — chronological timeline of ALL interaction types (email, SMS, call, note) in one unified view
3. **Tasks** — tasks linked to this prospect
4. **Notes** — free-form notes (existing field, bigger textarea)

### Interaction Timeline Features:
- Direction icon: 📤 outbound / 📥 inbound / 📞 call / 📝 manual note
- Truncated preview (2 lines), expandable on click
- Attachment badges with download links
- "Add interaction" button for manual entries (call notes, meeting notes)
- Cleanup: checkbox select + bulk delete
- Pagination: load 20 at a time, "Load more" button

### New files:
- `client/src/features/prospects/components/ProspectSlidePanel.tsx` — panel shell with tabs
- `client/src/features/prospects/components/InteractionTimeline.tsx` — timeline component
- `client/src/features/prospects/components/ProspectTasks.tsx` — tasks linked to prospect

---

## Part 3: Interaction API Endpoints

### Lookup strategy: prospect_id → email-based matching

The API uses `prospect_id` as the input, but resolves it to email-based matching under the hood:

```
GET /api/interactions?prospect_id=123
```

**Backend logic:**
1. Fetch prospect by ID → get all email addresses (`contact_email`, `contact2_email`, `email`)
2. Query Interactions where sender/recipient matches ANY of those emails
3. Return unified timeline sorted by `sent_at DESC`

**SQL equivalent:**
```sql
SELECT * FROM "Interactions"
WHERE metadata->>'from_email' IN (prospect.contact_email, prospect.contact2_email, prospect.email)
   OR metadata->>'to_email' IN (prospect.contact_email, prospect.contact2_email, prospect.email)
ORDER BY sent_at DESC
```

This ensures: if Gabriel emails the CEO and later the salesperson replies, both show up in both prospects' timelines.

### Endpoints:
- `GET /api/interactions?prospect_id=X` — fetch interactions by prospect's emails
- `POST /api/interactions` — create manual interaction (call note, meeting note)
- `DELETE /api/interactions/:id` — delete single interaction
- `POST /api/interactions/bulk-delete` — bulk delete (for cleanup)

### Single Interactions table:
Do NOT create a separate table. Use the existing Interactions table (47 columns).
- `type` column distinguishes: "email", "sms", "whatsapp", "call", "note"
- Unused SMS/Twilio columns stay NULL for email rows
- All interaction types show in one chronological timeline — that's the CRM value

### DB changes:
- Add `prospect_id` as optional FK (for direct 1:1 links when unambiguous)
- Store `from_email` and `to_email` in `metadata` JSON for email matching
- Index on `prospect_id` for fast lookups

---

## Part 4: Gmail Integration (Webhook-based)

### Approach: Gmail Push Notifications via Google Pub/Sub

**NOT polling/cron.** Instead:
1. Set up Google Cloud Pub/Sub topic
2. Call `gmail.users.watch()` to subscribe Gabriel's inbox
3. Google pushes notification to `POST /api/webhooks/gmail` on new/changed emails
4. Webhook handler fetches only the new/changed messages and syncs to Interactions table

**Fallback:** If Pub/Sub is complex to set up, use on-demand sync — triggered when a prospect detail panel is opened (lazy-fetch emails for that prospect's email addresses using `gog` CLI).

### Pipeline stage filtering for sync:
- **Exclude `new`** — haven't contacted them yet, nothing to sync
- **Exclude `lost`** — dead prospects, no need to keep pulling
- **Include all others** — contacted, responded, call_booked, demo_given, proposal_sent, negotiating, won (even won — ongoing client communication matters)

### Sync handler logic:
1. Incoming email notification → extract sender/recipient
2. Match sender/recipient against all prospect email columns (`email`, `contact_email`, `contact2_email`)
3. If matches multiple prospects (e.g., shared info@ address): link to all, or flag for manual assignment
4. Insert Interaction record:
   - `type`: "email"
   - `direction`: "inbound" or "outbound"
   - `Content`: email body (truncated to 5000 chars)
   - `status`: "delivered"
   - `sent_at`: email date
   - `metadata`: `{"subject": "...", "gmail_id": "...", "thread_id": "...", "from_email": "...", "to_email": "...", "attachments": [...]}`
5. Update prospect's `last_contacted_at` if newer

### Check `gog` CLI capabilities:
- `gog` may not support `watch()` or Pub/Sub
- If not → use direct Gmail API calls with existing OAuth credentials
- Or fallback to on-demand sync (fetch when panel opens)

---

## Part 5: Auto-Task Creation on Pipeline Changes

### Server-side logic in `server/routes.ts`:

When `PATCH /api/prospects/:id` updates `outreach_status`, the API creates a task automatically:

| From | To | Task Created |
|------|------|-------------|
| any | `contacted` | "Follow up with {company}" — due in 3 days |
| any | `call_booked` | "Call with {company}" — due date from prospect |
| any | `demo_given` | "Send proposal to {company}" — due in 2 days |
| any | `proposal_sent` | "Follow up on proposal: {company}" — due in 5 days |
| any | `won` | "Onboard {company} — set up campaign" — due in 3 days |

### Task properties:
- `status`: "todo"
- `priority`: matches prospect priority
- `tags`: `["Outreach", "{niche}"]`
- `account_id`: 1 (Lead Awaker)
- Parent task: linked to Revenue goal tree (#176)

### Files to modify:
- `server/routes.ts` — add task creation logic in prospect PATCH handler
- `server/storage.ts` — reuse existing `createTask()` method

---

## Part 6: Template Picker UI

**Already built** — backend (DB table + API routes) is complete. 6 niche templates inserted.

Keep as-is. No changes needed.

---

## Part 7: Interaction Cleanup

### In the Interaction Timeline:
- Checkbox on each interaction
- "Select all" / "Select older than X months" helper
- Bulk delete button with confirmation
- Attachment-specific cleanup: "Delete attachments only" (keeps text record)

### Cleanup strategy:
- Interactions older than 6 months: auto-archive (flag, don't delete)
- Attachments older than 3 months: offer cleanup via CRM button
- Manual bulk delete from the Interaction Timeline UI

---

## Implementation Order (Parallel Agent Strategy)

### Wave 1 (parallel — all independent):
1. **Agent A**: Pipeline stages update — add `demo_given` + `negotiating` to OutreachPipelineView.tsx
2. **Agent B**: Auto-task creation in `server/routes.ts` (prospect PATCH handler)
3. **Agent C**: Interaction API endpoints (GET/POST/DELETE by prospect_id with email-based matching)
4. **Agent D**: ProspectSlidePanel + InteractionTimeline + ProspectTasks UI components

### Wave 2 (depends on Wave 1):
5. **Agent E**: Gmail webhook endpoint + sync handler (or on-demand sync fallback)
6. **Agent F**: Wire InteractionTimeline to real API + cleanup UI

### Wave 3 (final):
7. Set up Gmail push notification (Pub/Sub) or implement fallback sync strategy
8. i18n for all new components (EN/PT/NL)
9. End-to-end testing

---

## DB Changes Needed

### Interactions table — add column:
```sql
ALTER TABLE p2mxx34fvbf3ll6."Interactions"
ADD COLUMN IF NOT EXISTS prospect_id integer;

CREATE INDEX IF NOT EXISTS interactions_prospect_id_idx
ON p2mxx34fvbf3ll6."Interactions" (prospect_id);
```

### Drizzle schema update:
Add `prospectId: integer("prospect_id")` to interactions table definition.

---

## Files Summary

| File | Action | Agent |
|------|--------|-------|
| `OutreachPipelineView.tsx` | Modify — add 2 stages | A |
| `server/routes.ts` | Modify — auto-task creation + interaction endpoints | B+C |
| `server/storage.ts` | Modify — interaction queries by prospect emails | B+C |
| `shared/schema.ts` | Modify — add prospect_id to interactions | C |
| `ProspectSlidePanel.tsx` | Create | D |
| `InteractionTimeline.tsx` | Create | D |
| `ProspectTasks.tsx` | Create | D |
| `ProspectsPage.tsx` | Modify — wire slide panel trigger | D |
| `ProspectsInlineTable.tsx` | Modify — click handler for slide panel | D |
| i18n files (en/pt/nl) | Modify — new keys | Wave 3 |
