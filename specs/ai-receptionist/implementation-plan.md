# Implementation Plan: AI Receptionist

## Overview

Turn the built missed-call engine into the **AI Receptionist** product. The engine (voice webhooks,
`fire_first_touch` reuse, voicemail transcription) and the per-account provisioning card already exist
(`specs/missed-call-textback/`). This plan adds: (1) the receptionist conversation prompt + a
per-campaign posture dial, (2) the lead-naming model, (3) the unified conversation inbox (missed-call
threads live in the Conversations page, filtered by service-type tabs, no bespoke inbox), (4) the
per-service client-visibility policy (receptionist = full interactions + take-over; reactivation =
summaries), (5) the AI Receptionist Dashboard + Settings page rebuilt on the Speed-to-Lead skeleton
(retiring the standalone Speed-to-Lead route and absorbing its dashboard + settings), (6) the owner
real-time notification, (7) the daily-cap fix, and (8) the rename/positioning.

**Architecture decisions (do not deviate):**
- **Rename the product, not the code.** Nav/route/copy → "AI Receptionist"; `campaign_type =
  'missed_call'` stays the engine routing key; `speed_to_lead.fire_first_touch` stays the shared opener.
- **Reuse the engine.** New persona prompt over existing infra; no new conversation engine, no booking
  rework.
- **One inbox, not three.** All AI WhatsApp threads live in `features/conversations/`, filtered by
  service tabs. Do NOT build a receptionist inbox; the `features/voice/` inbox tab is dropped.
- **Receptionist page = Dashboard + Settings hub**, built on the Speed-to-Lead skeleton. The standalone
  Speed-to-Lead route is retired and its components salvaged (not deleted blindly).
- **Channel-agnostic.** Keep shapes generic ("inbound conversation", `source`) so speed-to-lead
  web-leads fold in later with no rebuild.
- **Engine work is Python** (`/home/gabriel/automations/`); schema + server + UI are in `LeadAwakerApp`.

---

## Phase 1: Lead naming model (never "Unknown")

### Tasks
- [ ] In the engine inbound WhatsApp handler, read `ProfileName` from the Twilio payload and, when the
      lead has no first/last name, persist it (never overwrite a real captured name). [complex]
- [ ] Add a `leadDisplayName(lead)` resolver in the client and use it for every missed-call lead title
      (Conversations thread rows + header, lead lists).
- [ ] Format the phone number for display (E.164 → grouped) in the resolver.
- [ ] Add a "Missed call" source badge in the thread row when `source === 'missed_call'`.

### Technical Details

**Engine — capture `ProfileName`.** ProfileName is **not** parsed today, and inbound is parsed by
`parse_inbound_webhook(form_dict)` (called from `src/webhooks/twilio_routes.py`), not raw in
`inbound_handler.py`. So: extend `parse_inbound_webhook` to surface `form_dict.get("ProfileName")`, then
thread it into `inbound_handler` and persist with the real helper `update_lead_fields` (there is **no**
`update_lead_name`):
```python
profile_name = parsed.get("profile_name")  # newly surfaced by parse_inbound_webhook
if profile_name and not (lead.get("first_name") or "").strip():
    await update_lead_fields(lead_id, first_name=profile_name)  # never clobber a real name
```
Set names server-side only. Do not touch the opener path (cold template already does
`{"1": first_name or "there"}`).

**Client — `client/src/features/conversations/utils/displayName.ts`** (or extend
`conversationHelpers.ts`):
```ts
export function leadDisplayName(l: { name?: string|null; firstName?: string|null; phone: string }): string {
  const n = (l.name ?? l.firstName ?? "").trim();
  return n || formatPhone(l.phone);   // never "Unknown"
}
```

---

## Phase 2: Receptionist conversation prompt + posture dial + cap fix (engine)

### Tasks
- [ ] Add a `system:ai-receptionist` `Prompt_Library` entry (en + nl) with the triage structure below.
      [complex]
- [ ] Route `missed_call` campaigns to the receptionist prompt in `ai_conversation.py`'s `_load_prompt`
      (by `campaign_type`), falling back to the campaign's own prompt if set.
- [ ] Add `Campaigns.receptionist_posture` (text, default `'balanced'`); inject it into the prompt to
      tune booking-eagerness and into the handoff threshold (sales = late handoff, secretary = early).
- [ ] **Fix the daily-cap scoping** in `twilio_voice_mc_routes.py`: count new missed-call leads/day per
      account, not every outbound interaction.

### Technical Details

**Receptionist prompt** (`Prompt_Library` key `system:ai-receptionist`, per-locale): Role (front desk
for {business}, customer just called, follow up by WhatsApp, brief, in {locale}); Hard rules (never
invent facts outside `{knowledge_base}`, never hard-sell, identify intent first, close a wrong number
politely); Intent triage (classify `SCHEDULE|QUESTION|BUY|COMPLAINT|WRONG_NUMBER|OTHER`, then branch);
Booking (offer when intent allows, reuse `booking_mode`/calendar); Name capture (ask naturally if
unknown); Posture (`{receptionist_posture}`); Knowledge (`{knowledge_base}` from
`Account_Knowledge_Base`). Source of truth is `Prompt_Library` (memory
`feedback_prompt_source_of_truth`); `_load_prompt()` reads it first — add a `campaign_type ==
'missed_call'` branch.

**`Campaigns.receptionist_posture`** — add to `shared/schema.ts`; create the column via a direct `pg`
script (no TTY for db:push, memory `drizzle-push-needs-tty`):
```sql
ALTER TABLE <schema>."Campaigns" ADD COLUMN IF NOT EXISTS receptionist_posture text DEFAULT 'balanced';
```

**Daily-cap fix** (`_under_daily_cap`, ~line 122). Re-scope to today's missed-call lead creations, keyed
on `account_id`:
```python
count = await conn.fetchval(
    f'SELECT COUNT(*) FROM {fq(Table.LEADS)} '
    f'WHERE "Accounts_id" = $1 AND source = \'missed_call\' '
    f"  AND created_at >= date_trunc('day', NOW())", account_id)
```
Pass `account_id` through; keep the generous default (100/day); update the docstring.

---

## Phase 3: Conversations as the unified inbox (service tabs + missed-call rendering)

All AI WhatsApp threads live in the existing Conversations page, filtered by service.

### Tasks
- [ ] Add **service-type tabs** to the Conversations topbar (All / Reactivation / AI Receptionist; built
      to add Speed-to-Lead later) that filter threads by `campaign_type`. [complex]
- [ ] Surface missed-call leads in the Conversations thread list (confirm they are not currently filtered
      out) with `leadDisplayName` titles and the "Missed call" badge.
- [ ] Render a missed-call thread's transcribed voicemail as a labeled "[Voicemail]" **text bubble**
      (the engine stores it as a `type="voicemail"` inbound interaction). Do **NOT** use
      `VoiceMemoPlayer` — the raw audio is deleted per GDPR, so there is no audio to play, only the
      transcript.
- [ ] Keep the thread-list/row components keyed on a generic shape (`source`, `campaign_type`), not
      `missed_call`-only fields.

### Technical Details

- Conversations data flows through `features/conversations/hooks/useConversationsData.ts` +
  `api/conversationsApi.ts`; the thread list is `components/inboxPanel/ThreadList.tsx`, the chat is
  `components/chatView/ChatPanelMain.tsx`. Add a `service`/`campaign_type` filter param to the data hook
  and the topbar tabs (mirror the existing Inbox/Unread/Prospects tab pattern in
  `components/inboxPanel/`).
- The voicemail interaction is stored by the engine as `type="voicemail", direction="inbound",
  content="[Voicemail] …"`; render it as a transcript bubble (styled distinctly so it reads as a
  voicemail, not a chat reply). No audio file exists.
- Follow the page-shell layout rule (CrmShell has no padding; `.la-page` + `.la-page-header`; memory
  `feedback_page_shell_layout`).

---

## Phase 4: Per-service visibility + owner take-over

Receptionist threads are fully visible to clients (reactivation stays summaries), and an owner can take
over a thread and hand it back to the AI. The receptionist is autonomous by default; take-over is
optional.

### Tasks
- [ ] Make client visibility **per-service**: a `campaign_type == 'missed_call'` thread shows a client
      the **full interactions**; reactivation stays on the existing summary feed. Unblock receptionist
      threads for clients if still gated. [complex]
- [ ] **Owner take-over:** when a human sends from the chat panel (text / attachment / voice memo), set
      `leads.manual_takeover = true` so the engine pauses the AI on that lead.
- [ ] **"Resume AI" button + endpoint:** clears `manual_takeover` **and** triggers an immediate AI turn
      on the latest unanswered lead message; if the last message was the owner's, only clears the flag.
      [complex]
- [ ] Add a **per-thread summary header** ("Caller asked about X, AI booked Tuesday") above the thread.

### Technical Details

- **Visibility switch** keys off `campaign_type` (the same discriminator as the topbar tabs). The client
  reactivation summary feed is the `Conversion_Status IN ('Booked','Qualified','Lost')` rollup in
  `server/routes/conversations.ts` (~lines 305-335); receptionist threads must instead return the full
  `/api/interactions`. Enforce both server-side (do not withhold receptionist interactions from a client
  session: `accountsId !== 1`) and client-side (render full thread vs summary by service).
- **Take-over flag:** the manual send paths are `sendToChannel` / `sendVoiceToChannel` /
  `sendPhotoToChannel` in `conversations.ts`. Set `manual_takeover = true` in those handlers (human send
  only — the AI sends via the engine's `send_message`, a different path, so it won't trip the flag).
  The engine already honors the flag (`inbound_handler.py:332` Step-8 guard skips the AI).
- **Resume:** add an Express endpoint that clears `manual_takeover` (storage already clears it elsewhere,
  e.g. `leads.ts:818/857`) and then calls the engine to run one AI turn on the lead's current state
  (reuse `run_ai_conversation`; confirm/add an engine entrypoint to trigger a turn on demand). Only fire
  the turn when the last interaction is an unanswered inbound (lead) message.
- **Summary header:** reuse the booked-call summary if present, else a cheap one-line per-thread summary.

---

## Phase 5: AI Receptionist page (Dashboard + Settings) on the Speed-to-Lead skeleton

Rebuild the receptionist page as a configure + measure hub; retire the standalone Speed-to-Lead route.

### Tasks
- [ ] Build the AI Receptionist page on the Speed-to-Lead skeleton: a **campaigns-by-account list panel**
      + a **topbar (tabs + search)** + a **tabbed detail view (Dashboard / Settings)**. [complex]
- [ ] Salvage only the **single-channel-relevant** Speed-to-Lead cards (`MedianFirstTouchCard`,
      `ResponseDistributionCard`, `LiveFirstTouchFeed`, `AiOperationsInsights`, `PerformanceDashboard`,
      `TotalLeadsCard`) + `SpeedToLeadSettings`; wire to real metrics (replace `mockSpeedToLeadCampaigns`
      / `VOICE_DASH`). **Skip `LeadSourcesCard` and `ChannelMixCard`** (multi-source/multi-channel —
      nothing to show for a single WhatsApp/missed-call channel; add them when web-leads fold in).
- [ ] Add the **First Message editor** (writes `Campaigns.First_Message`); block/warn on empty (it
      silently no-ops `fire_first_touch`).
- [ ] Add the **posture dial** (`receptionist_posture`: secretary / balanced / sales) with one-line
      descriptions, saved on the campaign.
- [ ] Surface the missed-call provisioning (enable, greeting record/upload/TTS, voicemail toggle, forward
      code) by reusing `MissedCallCard.tsx` logic in the Settings tab.
- [ ] Add a metrics endpoint `GET /api/receptionist/metrics?accountId=&campaignId=&range=` →
      `{ missedCalls, textBacks, replyRate, booked, needsOwner }` (storage methods in the leads /
      interactions domain modules; do not inline SQL). Definitions: `missedCalls` = `missed_call` leads
      in range; `booked` = `Conversion_Status = 'Booked'`; `needsOwner` = `manual_takeover = true`;
      `replyRate` = leads with an inbound reply ÷ text-backs sent.
- [ ] **Retire** `/platform/speed-to-lead`: remove the route, redirect to the receptionist; keep the
      salvaged components (do not delete blindly).

### Technical Details

- Skeleton source: `client/src/features/speed-to-lead/pages/SpeedToLeadPage.tsx` (list panel + topbar +
  detail), `SpeedToLeadListPanel.tsx`, `SpeedToLeadTopbar.tsx`, `SpeedToLeadDetailView.tsx`. Generalize
  copy/labels to "AI Receptionist" and "inbound"; the list is `missed_call` campaigns by account now,
  built to add `speed_to_lead` campaigns later.
- `First_Message` is read by `fire_first_touch`; empty → opener bails (the #1 review finding). Saving
  empty must block or hard-warn.
- All copy via i18n; reuse/extend the existing `missedCall.*` block in `accounts.json` and the relevant
  namespaces. Campaign content stays en/nl only; UI chrome keeps all three locales.
- Route is lazy (`client/src/pages/app.tsx`); retiring the Speed-to-Lead route = replace its element with
  a redirect to the receptionist route.

---

## Phase 6: Owner real-time notification

### Tasks
- [ ] Add a **"missed call arrived"** notification: when a missed call comes in, notify the owner.
- [ ] Use `broadcastToUser` (never `broadcast`), per the notification SSE user-scope rule.
- [ ] Copy: "Missed call from {displayName}, the AI is handling it."

### Technical Details

- **AI-initiated handoff already notifies.** The engine sets `manual_takeover` and calls
  `notify_manual_takeover` (`inbound_handler.py:675`) when `handoff_detector` decides a human is needed,
  so the "needs you" path exists. What should *trigger* it for a receptionist is an open product
  decision (see action-required); the recommended default triggers are in requirements.md.
- **Owner-initiated take-over does NOT notify** (the owner is the one acting).
- This phase only adds the **missed-call-arrived** notification. The dispatch is in the engine
  (`twilio_voice_mc_routes.py` `_handle_missed_call`); confirm how the engine triggers CRM notifications
  today (likely a Notifications row the Express SSE broadcasts) and write that row scoped to the owner.
- Recipients default to the account owner; configurable later from the Settings tab.

---

## Phase 7: Rename + nav/route + positioning

### Tasks
- [ ] Page title → **"AI Receptionist"** (replaces the `features/voice/` "Missed Calls" title).
- [ ] Nav label + route → `/platform/receptionist`; keep redirects from `/platform/missed-calls` and
      `/platform/speed-to-lead`. Lazy-loaded per the routing convention.
- [ ] Update service-card / homepage copy to "AI Receptionist", outcome-framed.
- [ ] Do **not** rename `campaign_type='missed_call'`, the `missed_call` source, or
      `speed_to_lead.fire_first_touch`.

### Technical Details

- Folder names (`features/voice/`, `features/speed-to-lead/`) can stay; product name is a UI/label
  concern. Note the rename + speed-to-lead retirement in `FILE_MAP.md`.

---

## Dependencies / ordering

- Phase 1 (naming) + Phase 2 (prompt + cap) are independent; can run in parallel.
- Phase 3 (Conversations service tabs) blocks Phase 4 (visibility policy) — both are the operate surface.
- Phase 5 (receptionist page) is independent of 3/4 (it is the configure/measure surface) and can run in
  parallel, but the metrics endpoint it adds is reused by the dashboard.
- Phase 6 (notification) can ship with an owner-default first.
- Phase 7 (rename + retire route) is last so paths do not churn mid-build.
