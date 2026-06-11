# Session C — LeadDetailPanel Full Decomposition

Read `specs/structural-debt/README.md` first (ownership boundaries, hard rules, no tsc).
Read `specs/structural-debt/session-b-summary.md` for what was already extracted.

**Why:** `LeadDetailPanel.tsx` is down from 2,237 to 1,278 lines after Session B.
Session B extracted self-contained JSX sections (Timeline, Score, Tags, Notes) and all
pure helpers/types into `features/leads/components/leadDetail/`. What remains is ~30
state vars and their handlers, plus 6 JSX sections that cannot be meaningfully extracted
until their state moves out. This session finishes the job.

## Current state (read before doing anything)

File: `client/src/features/leads/components/LeadDetailPanel.tsx` (~1,278 lines)

Already extracted (barrel at `leadDetail/index.ts`):
- `types.ts`, `format.ts`, `badges.tsx`, `atoms.tsx`, `ScorePanel.tsx`
- `LeadInteractionTimeline.tsx`, `LeadScoreSection.tsx`, `LeadTagsSection.tsx`,
  `LeadNotesSection.tsx`

Still inline — JSX sections:
- Contact / identity block (name, phone, email, company)
- Status + stage selector (dropdown + pipeline stage bar)
- DNC section (do-not-contact toggle + reason)
- Bump-progress section (bump cadence timeline/indicators)
- Booking section (calendar link, booking status)
- AI-insights section (AI memory, context flags)
- Assignment section (owner, account assignment)

Still inline — state and handlers (read the file to get exact names and line numbers;
the list below is approximate):
- Tags: `showTagDropdown`, `loadingTags`, `leadTags`, `availableTags`, `removingTagId`,
  `addingTag`, `handleAddTag`, `handleRemoveTag` → candidate for `useLeadTags`
- Notes: `localNotes`, `notesDirty`, `notesSaved`, `notesOriginalRef`,
  `handleSaveNotes`, save-timer/debounce → candidate for `useLeadNotes`
- Voice recording: all `mediaRecorder`, `audioChunks`, `isRecording`, `audioURL`,
  `handleStartRecording`, `handleStopRecording`, `handleSendVoice` vars →
  candidate for `useVoiceRecording`
- DNC: dnc toggle state and mutation call → candidate for `useLeadDnc`
- Stage: stage selector open state, stage-change handler → candidate for `useLeadStage`

## Milestone 1 — Inventory (no edits)

Read `LeadDetailPanel.tsx` in full. Produce a map:
- Every `useState`, `useRef`, `useEffect`, `useCallback`, `useMutation` call with its
  line number and logical group (tags / notes / voice / dnc / stage / other)
- Every JSX section with its start/end line and which state vars it reads

Save as `specs/structural-debt/session-c-inventory.md`. Do not change any code in M1.

## Milestone 2 — Extract state hooks (one at a time)

For each hook, in this order (lowest-risk first):

1. `useLeadDnc(leadId, currentDnc)` — typically just 1–3 state vars + 1 mutation
2. `useLeadStage(leadId, currentStage)` — stage open-state + mutation
3. `useLeadTags(leadId)` — fetches available tags, manages add/remove, returns derived lists
4. `useVoiceRecording()` — browser MediaRecorder state, fully self-contained
5. `useLeadNotes(leadId, initialNotes)` — localNotes, dirty/saved flags, debounced save

For each hook:
1. Create `features/leads/components/leadDetail/<hookName>.ts`
2. Move state/handler code **verbatim** into the hook, adjusting only what's needed
   to compile (adding return statement, accepting props that were previously in scope).
3. In `LeadDetailPanel.tsx`, replace the extracted lines with a single hook call.
4. Export the new hook from `leadDetail/index.ts`.
5. Verify: reload the Leads page on `app.leadawaker.com`, exercise the feature
   (toggle DNC, change stage, add/remove a tag, record voice, save notes). Watch
   `pm2 logs` for errors.
6. Commit: `refactor(ui): extract <hookName> from LeadDetailPanel`

## Milestone 3 — Extract remaining JSX sections

After the hooks are out, the remaining JSX sections can be extracted as components.
For each section:

1. Create `features/leads/components/leadDetail/<SectionName>.tsx`
2. Move JSX **verbatim** (use `sed -n 'M,Np'` if the block contains special chars).
3. Prop signature = the exact variables the block read (now coming from hooks above).
4. Replace the block in LeadDetailPanel with `<SectionName ... />`.
5. Add to barrel `leadDetail/index.ts`.
6. Verify + commit: `refactor(ui): extract <SectionName> from LeadDetailPanel`

Target order (contact → status/stage → dnc → bump → booking → ai-insights → assignment).
If a section interleaves state still living in the panel, stop and flag it in the summary
rather than doing a partial extraction. Correctness beats LOC reduction.

## Final summary must include

- M1 inventory table (state vars mapped to hooks)
- Final line count of LeadDetailPanel.tsx
- Any section you could not extract and why
- Notes for future: anything surprising or non-obvious discovered while moving code

## Hard rules (repeat from README)

- No tsc, no `npm run dev`. Verify via `pm2 logs` + live page.
- Commit per hook/section. Working tree always green.
- Move verbatim. No improvements, no renames, no style fixes while moving.
- Keep the `leadDetail/index.ts` barrel up to date after every extraction so
  LeadDetailPanel.tsx only ever imports from `./leadDetail`.
