# SDD Progress Ledger — niche-creator

Plan: docs/superpowers/plans/2026-07-19-niche-creator.md
Branch: feature/gbp-currency-uk-visitors (NOT main; plan commits already land here)
Mode: direct in working tree (no worktree) — pm2 watches this directory.
File prefix for briefs/reports/diffs: `nc-`
Previous plan's ledger archived at progress-booking-availability-DONE.md

Pre-existing uncommitted WIP in files this plan touches (left alone, out of scope,
will ride along in scoped commits): server/aiTextHelper.ts (OPENAI_MODEL gpt-4o-mini
-> gpt-5.4-mini + max_completion_tokens), server/routes/accounts.ts,
client/src/locales/{en,nl}/campaigns.json, CampaignSettingsLayout.tsx, plus many
unrelated files elsewhere in the tree.

Pre-flight plan scan: no blocking contradictions. Verified before dispatch:
- OPENAI_MODEL in aiTextHelper.ts is already "gpt-5.4-mini" -> Task 1's use of
  OPENAI_MODEL satisfies the Global Constraint about NICHE_GENERATOR_MODEL. No conflict.
- storage.listNicheNames / setNicheVocabulary / setNicheTemplate / deleteNicheVocabulary
  all exist in server/storage/accounts.ts.
- campaigns table has a `niche` text column in shared/schema.ts -> Task 4 uses the
  Drizzle form, not the raw-SQL fallback.
- Task 1 Step 3's verification is a smoke module-load check only (cannot fail);
  real end-to-end verification of completeTextLarge happens in Task 2. Accepted.

Base before Task 1: 1972e107

Task 1: complete (commit 4931c20c, review clean/Approved). Diff also contained the
pre-existing unrelated gpt-5.4-mini WIP in the same file (expected, left alone,
correctly not flagged). Reviewer ⚠️ resolved by controller: the brief's Step 3
module-load check is inconclusive (node can't import .ts directly, dist/ fallback
doesn't exist) — accepted, since Task 2 exercises completeTextLarge end-to-end for
real. Minor for final-review triage: completeTextLarge's OpenAI fallback body
duplicates ~20 lines of tryOpenAI's request/error shape (plan-supplied code).
Task 2: complete (commits 0b978bd0 + fix 5ec2817d, review clean/Approved after one
fix round). Verified live: real Claude-sonnet generation for throwaway niche
"Dentists" produced genuinely dentist-specific bilingual content (warnings: []),
row inspected in the live DB then deleted; this was also the first real exercise
of Task 1's completeTextLarge (Claude leg confirmed working, ~48s; OpenAI fallback
leg still unexercised since Claude never failed). Reviewer found a real
plan-mandated gap: hard-fail passed if ANY ONE of the 10 term slots was non-empty
and warnings only covered the 7 template fields, so an English-only row persisted
as a clean success. Escalated to Gabriel per plan-contradiction rule; he chose
"tighten warnings": hard-fail now requires BOTH languages to have terms, and all
10 term-group slots emit "lang.group" warnings. Re-reviewed clean (reviewer traced
all 3 cases through the shipped code, since the fixer had only tested a hand-copied
mirror). Minor for final-review triage: setNicheVocabulary + setNicheTemplate are
two unguarded sequential awaits with no transaction (a DB blip between them leaves
vocabulary persisted without templates, and rejects instead of returning null).
Task 3: complete (commits 1024cc4c + fix 6642af2f, review clean/Approved after one
fix round). Route POST /api/niche-vocabulary/generate inserted before the DELETE;
requireAgency+wrapAsync usage matches sibling routes; 400 empty/400 __default__/
502 hard-fail/existed:true short-circuit all present; warnings passed through
unchanged. Reviewer found the plan's ASCII-only \w title-case regex broke dedup
for accented first letters ("économie" vs "Économie" → two rows) — fixed to
\p{L}[^\s]*/gu (verified: both accented casings now collapse to one string, ASCII
dedup unchanged); this strengthens the plan's own stated dedup goal so not
escalated. TWO reviewer findings adjudicated as non-issues by controller:
(1) error-key "message" vs siblings' "error" — FALSE POSITIVE, Task 6's UI reads
err.message (nc-task-6-brief.md:93), so "message" is correct for the real consumer;
changing it would break Task 6. Left as-is. (2) report's hyphenated-casing self-
verification claim was factually wrong but the actual output still dedups
correctly (cosmetic only). Fix diff (1 line) verified inline by controller.
Minor for final-review triage: no upper length bound on niche before the ~50s
paid generation call (agency-only auth limits exposure).
Task 4: complete (commit c4928a3c, review clean/Approved). campaignsUsingNiche
added to campaignsStorage (Drizzle form; reviewer confirmed it landed inside the
object storage.ts:72 spreads, so no runtime-undefined risk); DELETE route now
guards __default__ (400) -> in-use (409 with {message, campaigns}) -> delete.
Reviewer ⚠️ resolved by controller with a live DB query: all 3 in-use campaign
niches (Kitchens, Roofing, Solar Panels) match a Niche_Vocabulary key EXACTLY,
not just case-insensitively, and the UI only writes values picked from that same
list -- so eq()'s case-sensitive comparison has no false-negative path today.
Known-and-accepted: the 409 guard itself is only exercised for real via the UI in
Task 6 (the brief's Step 4 is a data-existence SELECT, not a guard test); the
implementer's report overstated this as "correct/no concerns".
Task 7: complete (commit 347d97e1, reviewed directly by controller — a pure-data
JSON diff, verified with real commands rather than a reviewer dispatch: commit
scoped to the 2 locale files, 13-key niche block added at top level in both,
en/nl key sets identical, {{niche}} interpolation intact in both, escaped quotes
valid JSON, zero untranslated (en===nl) strings, no reformatting of the rest of
the files). Executed OUT OF ORDER (before Tasks 5-6) on purpose so those tasks'
browser checks exercise real translations instead of inline defaultValue
fallbacks. Diff also contained pre-existing unrelated useAccountKb/useAccountKbHint
WIP in the same files (expected, left alone).
Task 5: complete (commit 0ae9c994, review clean/Approved, 0 Critical/Important).
DEVIATION authorized by Gabriel: the brief's Step 7 browser verification was
SKIPPED entirely (he declined the playwright dispatch twice, then chose
"subagent, no browser check"). Verification was therefore static only: greps
proving every symbol removed from DetailViewToolbar is unreferenced and every
retained import still used, the onGenerated chain traced hop-by-hop
(CampaignDetailView -> DetailViewBody -> CampaignStageEditor ->
CampaignSettingsLayout -> CampaignGenerateButton, identically typed), all 12
toolbar.* keys confirmed present in both en and nl, and clean Vite HMR recompiles.
Reviewer independently re-traced the lifted handleGenerate against the removed
original line by line and found zero behavior drift, and read past the diff's
truncation point to confirm Launch + Next are byte-identical and only Prev was
replaced. RUNTIME-UNVERIFIED, Gabriel must eyeball: footer button placement/
spacing + mobile wrap, popover open/focus behavior at the new location, the real
POST /api/campaigns/:id/generate + toast, light/dark rendering of the new flat
button, and whether onRefresh visibly refreshes the panel after generating.
Minor for final-review triage: the component's keys still live under the
toolbar.* namespace though it's no longer in a toolbar; needless (campaign as any)
cast at CampaignGenerateButton.tsx:398.
Task 6: IN PROGRESS. First dispatch returned BLOCKED (correctly): the plan's
per-option delete button cannot work as written, because Radix SelectItem fires
handleSelect() on onPointerUp for mouse input (verified independently by the
controller at node_modules/@radix-ui/react-select/dist/index.mjs:864-865), which
runs BEFORE the nested button's onClick — so the brief's onClick-only
stopPropagation/preventDefault would select the niche and close the dropdown
instead of deleting it. Not escalated to Gabriel: the plan's REQUIREMENT (an x
that deletes without selecting) is unambiguous and only its example code is
wrong, so hardening serves the plan rather than contradicting it (same reasoning
as Task 3's regex fix). Implementer resumed via SendMessage with two authorized
deviations: (1) intercept onPointerDown/onPointerUp as well as onClick on the
delete button; (2) fix the pre-existing broken lookups t("selectNichePlaceholder")
and t("nicheLoadError"), which resolve to nothing because those keys actually live
nested under config.* — carry them across correctly rather than preserving a
user-visible bug during the extraction (lookup-path fix only, no new locale keys).
Browser verification skipped per Gabriel's standing choice for the UI tasks.
Task 6: complete (commit cf41be61). REVIEW PERFORMED DIRECTLY BY CONTROLLER: the
subagent reviewer stalled on a blocked file read after 5 tool calls without
producing a verdict, so rather than re-spawn into the same denial the controller
verified every claim first-hand. Findings: (a) delete-button hardening is CORRECT
-- Radix index.mjs:867 onPointerDown sets pointerTypeRef, :864 onPointerUp calls
handleSelect for mouse (both stopped by the button), and :861 onClick only selects
when pointerType !== "mouse" while :870 onPointerMove sets it to "mouse" on the
hover needed to reveal the x, so mouse AND touch are doubly guarded; (b) both
fixed key paths config.selectNichePlaceholder / config.nicheLoadError confirmed
present in en and nl, and the old root-level lookups confirmed absent (the
pre-existing bug was real); (c) BehaviorSectionFields.tsx fully cleaned -- only
the NicheSelect import (line 12) and usage (line 52) remain, no orphaned
Loader2/apiFetch/useToast/Select refs; (d) new file 191 lines, all strings via
t(), no pt, tokens not hex.
Controller-found risk the implementer did NOT flag: Radix index.mjs:874 focuses an
item on pointermove for mouse, so if the pointer drifts over the options while
typing in the inline create input, focus jumps to an option and keystrokes become
typeahead. Unresolvable statically -- TOP item for Gabriel to click.
Other runtime-unverified / Minor for final triage: existed:true responses still
toast "Niche created" (misleading); the ~50s spinner lives inside SelectContent so
closing the dropdown mid-generation leaves no progress indication anywhere; the
delete x is mouse-only (Radix items are tabIndex -1, the nested button is
unreachable by keyboard despite its aria-label); window.confirm fires inside an
open Radix popover.

ALL 7 TASKS COMPLETE. Proceeding to final whole-branch review.

FINAL WHOLE-BRANCH REVIEW: complete (opus, range 1972e107..cf41be61, 9 commits).
VERDICT: NOT READY. 3 Critical + 4 Important. All 4 earlier fixes confirmed
still present and not partially undone in the final state.
Controller independently VERIFIED the two most consequential Criticals:
- C3 (duplicate vocabulary rows) CONFIRMED against live data: Niche_Vocabulary
  contains "HVAC"; the /\p{L}[^\s]*/gu title-caser maps both "hvac" and "HVAC"
  to "Hvac", which is NOT in existingNames -> a second row is generated and
  inserted alongside HVAC. Controller ALSO found a bug the reviewer did not
  state: the reserved-name guard runs AFTER title-casing, and "__default__"
  title-cases to "__Default__", so `niche === "__default__"` never matches and
  the guard is dead code.
- C1 (autosave wipes AI-filled fields) CONFIRMED by reading the hook: buildDraft
  is useCallback(..., []) so its identity is stable, and the resync effect at
  useCampaignDetail.ts:351 deps on [campaignId, buildDraft] only -> refetching
  the SAME campaign never rebuilds the draft; doSave then PATCHes the whole
  stale draft with ""->null. NUANCE the reviewer missed: this wipe path is
  PRE-EXISTING (the old toolbar Generate button had it too, since onRefresh
  can't rebuild the draft either) -- the niche creator makes it far more
  reachable but did not introduce it.
- C2 (half-created niche unrepairable: terms persisted, templates missing, and
  existed:true short-circuits every retry so the AI never re-runs) NOT
  independently re-verified by controller; reasoning read as sound.
Important: 4 (Claude prose preamble defeats the OpenAI fallback because
stripFences only strips at offset 0 and a parse failure returns null instead of
falling through); 5 (delete guard eq() case-sensitive, becomes a real hole once
C3 lands); 6 (NicheSelect renders in commonFields, so NON-AGENCY users see
"+ New niche..." and the x, both of which 403); 7 (onNicheChange fires twice on
create -> two concurrent template fetches).
Known-Minor triage from the reviewer: fix now = the two unguarded awaits (C2)
and the existed:true "Niche created" toast; acceptable = OpenAI duplication,
length cap (fold into the C3 edit), spinner-inside-SelectContent, mouse-only
delete x, toolbar.* namespace.
STOPPED HERE pending Gabriel's decision on the fix wave. Nothing further
dispatched. Branch left at cf41be61.

FIX WAVE: complete (commits c6038f44 server-side + 1acf40fb client-side).
NOTE: two UNRELATED commits from outside this session (20d7529e privacy policy,
2b1ef2f1 landing copy) landed on this branch between cf41be61 and the fix wave.
Re-review (opus, range 2b1ef2f1..1acf40fb): 7 of 8 findings + both fold-ins
CONFIRMED CLOSED, with independent verification of each (case-insensitive match
returns the STORED name; reserved guard now runs on raw lower-cased input before
title-casing; real db.transaction threaded via an optional executor param through
setNicheVocabulary/setNicheTemplate, with the ~50s AI call outside the tx; brace
scanner handles nesting/strings/escapes and falls through to OpenAI; isAgency
reuses the existing useWorkspace isOwner signal; double-call removed).
BUT the Critical-3 fix introduced a NEW CRITICAL of the same class, caught by the
re-review and independently confirmed by the controller: applyGeneratedFields
merged EVERY draft key, while /api/campaigns/:id/generate's "nothing to do" path
(routes/campaigns.ts:1090) returns `ex`, the row read at REQUEST START. So
picking a niche on an already-bilingual campaign merged the OLD niche into both
draft and originalDraft -> the select snapped back silently, no toast (both
filledFields and translatedFields empty), no PATCH. Same mechanism also
discarded unsaved local edits made during the ~50s call.
FIXED INLINE BY CONTROLLER (commit be1a1b75, not delegated -- small and precise):
merge restricted to the 8 GENERATED_FIELD_KEYS the endpoint actually writes
(verified all 8 exist in buildDraft under exactly those names), and `?? ""`
changed to `?? d[key]` so non-string draft defaults (ab_split_ratio 50, booleans)
aren't coerced. Also fixed the Minor ilike wildcard hole: campaignsUsingNiche
took its value from a URL path segment, so DELETE /api/niche-vocabulary/% matched
every campaign (verified live: ilike '%' -> 3 rows, lower()=lower() -> 0).
Verified: both files parse via esbuild; 5/5 merge scenarios pass incl. the exact
regression case; live DB probe confirms the wildcard fix.
REMAINING (logged, not fixed): first-{ scanner can pick a brace inside a prose
preamble (fails safe, burns one extra OpenAI call); duplicate OpenAI call when
Claude returns null and OpenAI's own output fails to parse; dead onNicheChange
prop still threaded from BehaviorSectionFields.

BROWSER VERIFICATION: performed live via playwright-cli against app.leadawaker.com
(logged in as leadawaker@gmail.com, real campaign #58 "Home Improvement Campaign",
niche=Kitchens). Read-only session -- did not click Create, did not confirm any
delete. Confirmed via live DB check afterward: Niche_Vocabulary still 17 rows,
campaign 58 niche still "Kitchens" -- nothing mutated.
Results, closing out the "Must Be Clicked" list from the final review:
1. TOP RISK (typeahead swallowing input) -- PASSES. Typed "Solar Panels" (12 chars)
   into the inline create input while the Radix SelectContent was open; all 12
   landed in the textbox verbatim, dropdown stayed open with all 17 options still
   listed, Create button correctly went from disabled to enabled. Typeahead did
   NOT steal focus or characters.
2. Delete-button pointer interception -- PASSES. Clicked "Remove niche" on
   Roofing; got a real confirm() dialog reading exactly 'Delete niche "Roofing"?'
   -- the click did NOT select Roofing or close the dropdown first. Dismissed
   without confirming; combobox still read "Kitchens" after.
3. Generate/Translate footer button (Task 5) -- PASSES. Renders as a flat button
   in the footer left slot next to Launch Campaign + "AI ->"; clicking opens a
   real popover with translated hint text ("Type a niche - AI fills empty
   fields..."), no raw i18n keys, Create/submit correctly disabled until a value
   is entered. Verified in both light and dark theme (toggled the real .dark
   class + localStorage, not a fake data-theme attr) -- dark renders cleanly,
   proper --paper/--wine tokens, no unstyled flashes.
4. isAgency gating (Important 6) -- confirmed positively for the Owner path: all
   agency-only affordances (per-option Remove-niche buttons, "New niche..." row)
   render for this Owner session. Non-agency (isAgency=false) path still
   unexercised -- would need a client-role login to click.
5. Console: 0 errors, 0 warnings across the entire session (login, tab switches,
   dropdown open, typing, delete-cancel, theme toggle).
Still genuinely unexercised: a real ~50s generate call end-to-end (Create was
never clicked, by design, to avoid AI cost + live writes), the 409 in-use-niche
path, a 502 failure path, and the non-agency render path.
