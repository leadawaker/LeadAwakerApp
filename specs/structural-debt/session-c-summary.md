# Session C — LeadDetailPanel Full Decomposition (Summary)

## Outcome

`LeadDetailPanel.tsx`: **1,279 → 516 lines** (60% reduction). It is now a thin
composition: workspace/score wiring, a few derived values, the header + action-button
row, and a body that renders extracted section components. All ~30 state vars and their
handlers now live in 5 hooks; all 6 remaining inline JSX blocks are now components.

## M1 — Inventory

See `session-c-inventory.md` for the full state→hook map and JSX section table.

## M2 — State hooks extracted (in order)

| Hook | File | Owns |
|------|------|------|
| `useLeadDnc(leadId, lead)` | `leadDetail/useLeadDnc.ts` | opted-out toggle, dnc reason, sync effect, 2 mutations |
| `useLeadStage(leadId, lead)` | `leadDetail/useLeadStage.ts` | conversion status, saving/saved flags, **localAiSummary** (Booked refetch), sync effect, mutation |
| `useLeadTags(leadId, open)` | `leadDetail/useLeadTags.ts` | lead tags + available tags, 2 fetch effects, add/remove, derived `unassignedTags` |
| `useVoiceRecording(leadId, notesSink)` | `leadDetail/useVoiceRecording.ts` | MediaRecorder state, cleanup effect, start/stop, transcription→notes |
| `useLeadNotes(leadId, lead)` | `leadDetail/useLeadNotes.ts` | local notes buffer, dirty/saved, sync effect, save mutation |

Each was a verbatim move + single hook call, committed separately.

## M3 — JSX sections extracted

| Component | File |
|-----------|------|
| `LeadContactSection` | `leadDetail/LeadContactSection.tsx` |
| `LeadStatusSection` | `leadDetail/LeadStatusSection.tsx` |
| `LeadDncSection` | `leadDetail/LeadDncSection.tsx` |
| `LeadBumpSection` | `leadDetail/LeadBumpSection.tsx` |
| `LeadActivitySection` | `leadDetail/LeadActivitySection.tsx` |
| `LeadBookingSection` | `leadDetail/LeadBookingSection.tsx` |
| `LeadAiInsightsSection` | `leadDetail/LeadAiInsightsSection.tsx` |
| `LeadAssignmentSection` | `leadDetail/LeadAssignmentSection.tsx` |

The conditional sections (Bump, Booking, AI Insights) kept their render guards by
returning `null` early inside the component rather than wrapping the call site.

## Sections NOT extracted (left inline, intentionally)

- **Header + action-button row** (bump / reset / demo-reset / ai-send buttons): these
  read `leadId`, `fullName`, `resetScoreToZero`, `toast`, and fire one-off `apiFetch`
  calls. Tightly coupled to the panel's score hook and toast; low value to extract.
  Left inline (~130 lines).
- **Lead Scores, Notes, Tags, Interaction Timeline**: already extracted in Session B,
  unchanged this session.

## Notes for future / surprises

- **Voice ↔ Notes coupling:** `startVoiceRecording` appends the transcription into the
  notes buffer, so `useVoiceRecording` takes a `notesSink` ({ setLocalNotes, setNotesDirty,
  setNotesSaved, notesOriginalRef }). The notes hook must be called before the voice hook
  so the sink exists. This is the one cross-hook dependency.
- **Temporal dead zone:** `leadId` had to be moved up above the voice hook call. Watch
  declaration order if anything else starts consuming `leadId` early.
- **`localAiSummary` lives in `useLeadStage`**, not a notes/ai hook, because it is only
  ever populated by the Booked-stage refetch. `LeadAiInsightsSection` reads it via prop.
- **Big import prune:** moving the JSX out left ~40 dead imports (most lucide icons,
  Select/Switch/Textarea/Button, all the `atoms`/`badges`/`format` helpers). These were
  removed from `LeadDetailPanel.tsx`; the helpers now import from the barrel inside each
  section component. The panel's only remaining lucide imports are the 5 action-button icons.
- Verified via Vite dev-server transform (HTTP 200, valid JS) on all changed modules;
  server healthy (`/api/health` 200). No tsc run (Pi constraint).
