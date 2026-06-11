# Session C — Milestone 1 Inventory (LeadDetailPanel.tsx)

File: `client/src/features/leads/components/LeadDetailPanel.tsx` (1,279 lines at start).

## State / refs / hooks (with line numbers and logical group)

| Line | Declaration | Group |
|------|-------------|-------|
| 111 | `interactions` | timeline (extracted section) |
| 112 | `loadingInteractions` | timeline |
| 113 | `tagEvents` | timeline |
| 114 | `localStatus` | stage |
| 115 | `savingStatus` | stage |
| 116 | `stageSaved` | stage |
| 117 | `localAiSummary` | stage/ai (set by stage→Booked refetch; read by AI Insights) |
| 120 | `leadTags` | tags |
| 121 | `availableTags` | tags |
| 122 | `loadingTags` | tags |
| 123 | `addingTag` | tags |
| 124 | `removingTagId` | tags |
| 125 | `showTagDropdown` | tags |
| 128 | `useScoreBreakdown(...)` | score (already a hook) |
| 132 | `localNotes` | notes |
| 133 | `notesDirty` | notes |
| 134 | `savingNotes` | notes |
| 135 | `notesSaved` | notes |
| 136 | `notesOriginalRef` | notes |
| 139 | `isRecordingVoice` | voice |
| 140 | `recordingSeconds` | voice |
| 141 | `mediaRecorderRef` | voice |
| 142 | `recordingChunksRef` | voice |
| 143 | `recordingTimerRef` | voice |
| 144 | `transcribing` | voice |
| 149 | `localManualTakeover` | manual-takeover |
| 150 | `savingManualTakeover` | manual-takeover |
| 153 | `localOptedOut` | dnc |
| 154 | `localDncReason` | dnc |
| 155 | `savingDnc` | dnc |
| 156 | `dncSaved` | dnc |
| 157 | `showDncReason` | dnc |
| 342 | `campaigns` | campaigns (agency contact block) |

## Effects

| Line | Purpose | Group |
|------|---------|-------|
| 162 | sync `localStatus` on lead change | stage |
| 169 | sync notes on lead change | notes |
| 178 | cleanup voice recorder on unmount | voice |
| 186 | sync `localManualTakeover` on lead change | manual-takeover |
| 191 | sync DNC fields on lead change | dnc |
| 200 | fetch interactions when panel opens | timeline |
| 234 | fetch tag events | timeline |
| 245 | fetch lead tags | tags |
| 280 | fetch available tags | tags |
| 344 | fetch campaigns (agency only) | campaigns |

## Handlers / derived

| Line | Name | Group |
|------|------|-------|
| 297 | `handleAddTag` | tags |
| 322 | `handleRemoveTag` | tags |
| 364 | `unassignedTags` (derived) | tags |
| 369 | `handleStageChange` | stage (writes `localAiSummary`) |
| 409 | `handleNotesSave` | notes |
| 432 | `startVoiceRecording` | voice (also writes notes setters + `notesOriginalRef`) |
| 506 | `stopVoiceRecording` | voice |
| 517 | `handleManualTakeoverChange` | manual-takeover |
| 539 | `handleInlineFieldSave` | other (contact inline edits) |
| 548 | `handleDncChange` | dnc |
| 579 | `handleDncReasonSave` | dnc |

## JSX sections (start/end line, state read)

| Section | Lines | Reads |
|---------|-------|-------|
| Header (name, autoStatus, view-full) | 638–673 | `fullName`, `autoStatus`, `handleViewFull` |
| Pipeline bar | 675–680 | `convStatus` |
| Action buttons (bump/reset/demo/ai-send) | 682–761 | `leadId`, `fullName`, `resetScoreToZero`, `toast` |
| Contact info (inline edit + campaign) | 766–858 | `lead`, `handleInlineFieldSave`, `isAgencyPanel`, `campaigns`, `demoNicheCtx` |
| Status (stage dropdown + manual takeover) | 860–955 | `convStatus`, `savingStatus`, `stageSaved`, `handleStageChange`, `localManualTakeover`, `savingManualTakeover`, `handleManualTakeoverChange`, `autoStatus` |
| Lead Scores | 957–964 | already `LeadScoreSection` |
| DNC | 966–1023 | `localOptedOut`, `savingDnc`, `dncSaved`, `showDncReason`, `localDncReason`, `handleDncChange`, `handleDncReasonSave`, `setLocalDncReason` |
| Bump progress | 1025–1090 | `lead` bump fields, `fmtDateTime` |
| Activity | 1092–1109 | `lead` activity fields, `responseRate`, `daysInactive` |
| Booking | 1111–1179 | `lead` booking fields, `accountTimezone` |
| AI Insights | 1181–1214 | `localAiSummary`, `lead.ai_summary/ai_sentiment/ai_memory` |
| Notes | 1216–1233 | already `LeadNotesSection` (voice + notes state) |
| Tags | 1235–1247 | already `LeadTagsSection` |
| Timeline | 1249–1254 | already `LeadInteractionTimeline` |
| Assignment | 1256–1274 | `lead`, `convStatus`, `priority` |

## Coupling notes (important for extraction)

- **Voice ↔ Notes:** `startVoiceRecording` (L432) writes into notes state
  (`setLocalNotes`, `setNotesDirty`, `setNotesSaved`, `notesOriginalRef`). `useVoiceRecording`
  must accept these notes setters/ref as params, OR receive an `onTranscription(text)` callback.
  Plan: pass the notes setters + ref into `useVoiceRecording` so the move stays verbatim.
- **Stage → AI summary:** `handleStageChange` writes `localAiSummary` (consumed by AI Insights
  JSX). `useLeadStage` must own `localAiSummary` and return it, since AI Insights reads it.
- `handleInlineFieldSave` (L539) is generic and used by the contact block (not a hook target).

## Hook extraction plan (order)

1. `useLeadDnc(leadId, lead)` — L153–157 state, L191 effect, L548 + L579 handlers
2. `useLeadStage(leadId, lead)` — L114–117 state, L162 effect, L369 handler (owns `localAiSummary`)
3. `useLeadTags(leadId, open)` — L120–125 state, L245 + L280 effects, L297/L322 handlers, L364 derived
4. `useVoiceRecording(leadId, { setLocalNotes, setNotesDirty, setNotesSaved, notesOriginalRef })`
   — L139–144 state/refs, L178 effect, L432/L506 handlers
5. `useLeadNotes(leadId, lead)` — L132–136 state, L169 effect, L409 handler
