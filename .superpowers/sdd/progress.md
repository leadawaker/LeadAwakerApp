# SDD Progress Ledger — booking-availability-onboarding

Plan: docs/superpowers/plans/2026-07-13-booking-availability-onboarding.md
Mode: direct on main (no worktree) — pm2 watches this directory.
Pre-existing uncommitted WIP present at start (unrelated to this plan, left alone
per Gabriel's explicit instruction): shared/schema.ts (channel-fallback default),
MeetingTypeCard.tsx (autosave-pattern rewrite — this IS the pattern AvailabilityCard
mirrors), communicationProfile.json en/nl, CalendarConnectCard.tsx, IntegrationsPanel.tsx,
MissedCallCard.tsx, WhatsAppPreview.tsx, CommunicationProfilePanel.tsx, plus several
untracked files (home-en.yaml, login-filled.yaml, migrate-drop-communication-profile-deadcols.js,
process-en.png/nl.png, specs/channel-fallback/, specs/whatsapp-quality-auto-throttle/).
This plan's commits will land in the same dirty files where they overlap (schema.ts,
MeetingTypeCard's sibling AvailabilityCard, communicationProfile.json) — not reverting
or isolating the pre-existing WIP.

Base before Task 1: (recorded per-task since files are already dirty — each task
records its own start point via git diff scoped to files it touches)
Task 1: complete (commit c9df8fb3, review clean/Approved). Diff also contained
pre-existing unrelated channel-fallback WIP in the same file (expected, left alone).
Task 2: complete (no commit — live DB mutation only, run directly by controller
per risk-review confirmation with Gabriel, not delegated to a subagent).
Deviation from plan: real table is "p2mxx34fvbf3ll6"."Accounts" (NocoDB custom
schema, quoted capital-A table), not plain "accounts" as the plan's script
assumed — first attempt failed with "relation accounts does not exist",
corrected and re-run successfully. Verified via direct SELECT: all account rows
show timezone=Europe/Amsterdam, open_days=[1,2,3,4,5], min_booking_notice_hours=16,
default_call_duration_minutes=30. Temp script removed after use (never committed).
Task 3: complete (automations repo, commits e038f6d + fix 9a824e8, review clean/
Approved after one fix round). Deviation from brief: get_campaign_with_account()
in tools/db/campaigns.py builds campaign_account from an explicit hand-maintained
column allowlist, not a.* — min_booking_notice_hours had to be added there too
(1 line), or the feature would have silently no-op'd forever despite passing
pm2-log verification. Implementer correctly stopped and escalated rather than
guessing; controller independently verified before approving. Reviewer then
caught a real bug in the plan's own Step 2 code: `x.get(...) or 16` silently
discards a client-configured 0 ("no minimum notice", a documented valid value,
reachable via the Task 8 UI's 0-168 range) since 0 is falsy in Python. Fixed to
`is None` check, re-reviewed clean. Both automations-repo commits verified via
live pm2 reload + direct DB functional check.
Task 4: complete (commit 2ee21225, review clean/Approved).
Task 5: complete (caldiy repo, commit ffcc076, review clean/Approved — review
completed directly by controller after two subagent reviewer dispatches both
hit identical permission-prompt denials before reading any files; controller
independently verified every claim: diff content, upstream day-merge behavior
in node_modules/@calcom/lib/availability.ts, and git status for the unstaged
pre-commit-hook side effects). Same pre-existing-WIP pattern as Tasks 1/3/4:
_schedule.ts and resync-schedule.ts already had an unrelated "manual busy
blocks" feature on disk before this task; openDays contribution correctly
isolated and minimal. Live-verified via 3 scenarios against sandbox account 47
(Mon-Sat, default-unset, mid-week exclusion), each confirmed via direct
Availability table query, sandbox restored afterward.
Task 6: complete (commit fd476931, review clean/Approved).
Task 7: complete (commit b848d25f, review clean/Approved). Diff also contained
pre-existing unrelated done.nextSteps WIP in the same locale files (expected,
left alone, correctly not flagged by reviewer).
Task 8: complete (commits b8b3afc2 + fix 4d281dc2, review clean/Approved with
one Minor fixed: undefined --wine-fg CSS token replaced with the real --paper
token per .btn-wine's established precedent, verified directly by controller
post-fix, no re-review dispatched since it was Minor-only and a 1-line change).
Task 9: complete (commit a34ecdc9, review clean/Approved). Live playwright-cli
walkthrough on sandbox account 47 confirmed Availability step at position 3/6,
functional day-toggles/time/duration/notice fields, PATCH 200s, persistence
after reload, 0 console errors. Reviewer independently sanity-checked the
step-position math against the diff's array ordering. Minor FYI (not a defect):
CommunicationProfilePanel read-only summary doesn't show an Availability card
yet — flagged as a possible future follow-up, correctly left out of scope.
Task 10: complete (verification-only, no commit). Scope adjusted from the plan's
original text (which assumed a real lead/campaign to test through) after
investigation found sandbox account 47 has zero campaigns and no active
campaign anywhere in the DB has a booking_url set — confirmed with Gabriel,
switched to direct-logic verification instead of live WhatsApp conversation.
All 4 items PASS: (1) notice-floor logic incl. the previously-broken 0-hours
case, tested via standalone script against the real Task-3 code; (2) Saturday/
day-filtering, covered by Task 5's existing live-DB evidence, not re-run to
avoid redundant churn on sandbox infra; (3) call-duration fallback chain,
verified against live DB values on 3 real accounts; (4) backward compatibility,
confirmed all existing accounts show correct un-migrated defaults. No new bugs.
One minor structural note (duration fallback also uses || not ??) judged not
a real concern since 0-minute calls aren't a meaningful value, unlike the
0-hours-notice case that was actually fixed in Task 3.

ALL 10 TASKS COMPLETE. Proceeding to final whole-branch review.
Final whole-branch review: complete (most-capable-model subagent, spanned all
3 repos via 3 separate review packages). Verdict: Ready to merge, With fixes.
0 Critical. Confirmed cross-repo integration solid end-to-end: LA_OPEN_DAYS
comma-format + day-numbering match between caldiy.ts and resync-schedule.ts;
min_booking_notice_hours column name matches the raw asyncpg key Python reads;
AvailabilityCard's snake_case PATCH bodies round-trip correctly through
fromDbKeys/insertAccountsSchema; live DB backfill confirmed consistent with
shared/schema.ts; both spec-documented "known gaps" (weekday hardcoding,
timezone) confirmed genuinely resolved in all 3 repos, not just one.
1 Important: server-side PATCH/POST /api/accounts never enforced the spec's
documented 0-168h/5-240min clamps (only client-side UI clamped) - an
out-of-range minBookingNoticeHours could push window_start past the engine's
fixed 8-day window_end, silently zeroing all offered slots for an account.
1 Minor (bundled into the same fix): AvailabilityCard's toggleDay allowed
deselecting every day, causing a silent 3-way inconsistency between DB/caldiy-
schedule/UI. Both fixed in commit 8c1b0006, re-reviewed and confirmed correct
(traced concrete clamp/guard values including the 0-survives-clamp case).

PLAN COMPLETE. All 10 tasks + final review + 1 fix round done. 0 Critical/
Important issues outstanding. Feature spans LeadAwakerApp (8 commits:
c9df8fb3..8c1b0006), automations (2 commits: e038f6d, 9a824e8), caldiy
(1 commit: ffcc076). Two real bugs caught and fixed during the process
(Task 3's zero-notice truthy bug, this final review's missing server clamp),
both would have shipped silently broken/unenforced without the review loops.
