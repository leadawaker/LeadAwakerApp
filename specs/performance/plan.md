# Performance Plan — Single Session

Goal: make the app load and respond faster on real devices and reduce load on the Pi. Source: full-codebase audit (2026-06-11), section "Performance". Pure performance work, no visual changes, no feature changes.

## Hard rules

1. **Never run tsc, never run `npm run build` or `vite build` on the Pi, never run `npm run dev`.** The app runs via pm2 (tsx watch). Verify in the browser on `app.leadawaker.com` and via `pm2 logs leadawaker --lines 50`.
2. Bundle-size verification happens on **Vercel**: work on a branch, push it, and read the Vercel preview deployment's build output for chunk sizes. Never push `main` without Gabriel's go-ahead (that deploys production).
3. Commit per milestone: `perf: ...`.

## Coordination with the structural-debt sessions

If `specs/structural-debt/` Sessions A/B are running or pending (check `git log` for `refactor(server):` / `refactor(ui):` commits):
- **Milestone 1 touches `server/storage.ts`**, owned by structural Session A. If A has not finished its storage split (its Milestone 3), either do this plan's Milestone 1 *after* A finishes, or skip it and leave a note. Never edit storage.ts concurrently with A.
- Milestone 4 touches `client/src/pages/app.tsx` and `vite.config.ts` — owned by neither structural session; safe.
- Milestone 2 (`shared/schema.ts`) is off-limits to both structural sessions; safe.
- Milestones 3 and 5 touch deletions/assets/package.json; safe.

## Milestone 1 — Server quick fixes (storage.ts — see coordination note)

1. **Fix N+1 in `reorderSubtasks`** (`server/storage.ts` ~line 1565): currently one UPDATE per subtask in a for-loop. Replace with a single statement (SQL `CASE WHEN id = ... THEN idx` update, or one query per drag using `unnest`). Verify by dragging subtasks in the Tasks page and checking pm2 logs.
2. **Default LIMIT on non-paginated fallbacks**: `getLeads()`, `getInteractions()`, `getAutomationLogs()` fetch entire tables when no page params arrive. Before changing anything, **inventory client callers** (grep `api/leads`, `api/interactions`, `api/automation-logs` in `client/src`): the kanban/pipeline views may legitimately need all leads for an account. Where a full set is genuinely needed, keep it but cap with a sane hard limit (e.g. 5,000) and log a warning when hit; where the client only renders a window, add a real default LIMIT and pass explicit params from the client. Do not silently truncate data the UI expects — that class of bug looks like "data disappeared".

## Milestone 2 — Database indexes

Add to `shared/schema.ts`:
- `interactions.direction` (filtered for inbound/outbound constantly)
- `leads.conversion_status` (pipeline grouping)

Confirm with `EXPLAIN` on the live DB (read-only psql) that the target queries currently seq-scan and use the index afterwards. Generate the migration with drizzle-kit; apply during a quiet moment (small DB, plain `CREATE INDEX` is fine; if any table exceeds ~100k rows use `CONCURRENTLY` manually). Coordinate with Gabriel before applying — this touches the live database the Python automations engine also uses.

## Milestone 3 — Dead weight removal (dev rebuild speed + repo hygiene)

These were validated as safe in the audit, but re-verify zero importers (grep) before each deletion:
1. Move `client/src/migration/` (22MB, referenced only in comments) → `docs/migration-archive/`, or delete (it's in git history).
2. Delete verified orphans: `client/src/pages/PromptLibrary.tsx`, `pages/Tags.tsx`, `pages/SetupProfile.tsx`, `pages/AppLeads.tsx`, `components/crm/LeadsTable.tsx`, `lib/pwa.ts`; remove the phantom `"login"` namespace from `client/src/i18n.ts`.
3. Delete root-level test screenshots (`pipeline-*.png`, `login-*.png`, `leads-view.png`, `after-login.png`, `automation-*.png`) and `test-results/`; add patterns to `.gitignore`.
4. `client/src/legacy/` (3.6MB): check whether any legacy route is still registered in the router. If yes, ask Gabriel before deleting; if no route reaches it, delete the folder plus `styles/legacy-glitch.css`, and for `styles/legacy-stars.css` first move the viewport-height utilities (`h-svh`, `min-h-svh`, ...) into `styles/utilities.css` since those ARE used app-wide.

## Milestone 4 — Route-level code splitting (biggest user-facing win)

The entire CRM ships as one ~4.8MB JS file. `client/src/pages/app.tsx` already imports `Suspense` but every page is a static import.

1. Convert page-level imports in `app.tsx` to `React.lazy(() => import(...))`. Note several pages are **named exports** (`LeadsPage`, `BillingPage`, `AgentsPage`) — wrap with `.then(m => ({ default: m.X }))`. Keep `CrmShell`, providers, and the auth gate eager.
2. One `<Suspense>` fallback inside the shell (use the existing `Loader2` spinner pattern so navigation doesn't flash white).
3. `vite.config.ts`: add `build.rollupOptions.output.manualChunks` for heavy shared vendors so they don't duplicate across route chunks: `recharts`, `framer-motion`, radix-ui, `xlsx`/file-parsing libs (check actual heavy deps via the Vercel build report).
4. Lazy-load `three.js`: `components/ui/dotted-surface.tsx` is imported by `pages/faq.tsx` (eager today). Make the dotted-surface a `React.lazy` import inside faq, or replace with CSS. ~600KB saved from the main path.
5. Move `puppeteer` and `playwright-cli` from `dependencies` to `devDependencies` in package.json (server never imports them at runtime — verify with grep first).

**Verification:** on the Pi dev server, navigate between pages with the browser network tab open and confirm per-route chunk requests + no Suspense flash loops. Then push the branch and read chunk sizes from the Vercel preview build log. Test the preview URL: login, Leads, Campaigns, Billing, Tasks, Settings, AI agent chat (SSE), language switch. Target: initial JS under ~1.5MB.

## Milestone 5 — Asset compression

`client/src/assets/` is 15MB and files are imported via `@/assets` in active components (Vite hashes them into the bundle output), so they must be compressed **in place**, not moved to `public/`:
1. Grep importers per asset; delete the unreferenced ones (likely candidates: `Gemini_Generated_Image_*.png`, `Project (20260508053902).png`, `Screenshot_*.jpg` — verify first).
2. Convert remaining large PNGs (7 files are 1.6–1.8MB each: `step-1-*.png`, `profile.png`, ...) to WebP or compressed PNG at their actual display size (`cwebp` or `sharp` via npx). Update import extensions where changed.
3. Visually verify every page that shows the touched image.

## Out of scope (other plans)

- Generic DataTable consolidation, giant-file splits → `specs/structural-debt/`
- Dark mode hardcoded colors, billing reskin → reskin work
- Twilio webhook verification, CSP → security fixes

## Final summary must include

- Before/after bundle sizes from the Vercel preview build
- Which fallback queries got LIMITs and which were capped instead, with caller evidence
- Deleted files list and total MB removed
- Anything skipped due to structural-session conflicts
