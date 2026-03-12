# Autoforge Bug Tracker

## BUG-001: Done-Count Fluctuation Loop (2026-03-09)

**Status:** RESOLVED
**Resolution:** Run 1 agent / 1 feature at a time, keep `tsc` on, use `journal_mode=DELETE`
**Severity:** High — agents wasted an entire night re-verifying passing features

### Symptom
Features cycle between "passing" and "in-progress" indefinitely. DB shows 60/90 but progress stalls — count oscillates (62→58→60→58→60).

### Root Cause (Primary): `tsc` Cascade Failures

`npx tsc --noEmit` runs on the **entire project** after each feature verification. A single type error in a shared file cascades and **fails ALL features**, not just the one being worked on.

This was the primary cause of the done-count fluctuation:
1. Agent implements Feature A → introduces a type error in a shared file
2. Autoforge runs `tsc --noEmit` to verify → entire project fails type check
3. Previously-passing Features B, C, D all get marked as failing
4. Agent pivots to "fix" B, C, D → may break A in the process
5. Loop repeats indefinitely

With **multiple concurrent agents**, this is catastrophic — each agent's changes can cascade failures to every other agent's features. With **1 agent / 1 feature**, the agent fixes its own errors before moving on, so the cascade doesn't happen.

### Root Cause (Secondary): WAL Stale Reads

SQLite WAL mode caused stale reads between separate agent processes:
1. Agent A marks feature passing → write goes to WAL file
2. Agent B opens fresh connection → reads main DB (not yet checkpointed)
3. Agent B thinks feature isn't passing → re-verifies and re-marks

This compounded the `tsc` cascade issue but was not the primary driver. Confirmed by the fact that fluctuation continued even with 1 agent (ruling out WAL as sole cause).

### What We Tried (Chronological)
1. **WAL checkpointing cron** (every 10 min) — did not fix it
2. **Reduced to 1 agent** — fluctuation continued, ruling out WAL as sole cause
3. **Manual inspection** — after ~100 re-sync commits, agent was not changing source code, just re-verifying endlessly
4. **Manual fix** — stopped Autoforge, marked features #39, #40, #43, #44 as passing (code was correct, implemented in commits `c227876` and `8e0399f`)

### Resolution
1. **`journal_mode=DELETE`** — eliminates WAL stale-read risk entirely for multi-process scenarios
2. **1 agent / 1 feature at a time** — prevents `tsc` cascade failures across agents; the single agent fixes its own type errors before moving on
3. **Keep `tsc` on** — type checking is valuable; the cascade problem only manifests with concurrent agents

### Lessons
1. **`tsc --noEmit` is project-global** — one error fails everything. This is by design, but it means concurrent agents sabotage each other through shared type state
2. **WAL was a secondary issue, not the primary one** — the fluctuation continued with 1 agent, proving `tsc` cascades were the real driver
3. **Shared files = feature conflicts** — features modifying the same component (e.g., `LeadsCardView.tsx`) can break each other during implementation
4. **Check the re-sync commits** — if they're not changing source code, the agent is just spinning. Look at git diffs, not DB status
5. **Don't trust the count alone** — "60/90 done" looks like progress, but watch the trend, not the snapshot
6. **Know what you changed** — we almost blamed Autoforge upstream when we made the WAL switch ourselves
