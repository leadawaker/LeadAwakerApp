# Structural Debt Cleanup — Master Summary (2026-06-11)

Two parallel sessions (A: server, B: frontend) ran on the same working tree on the Pi.
All work landed linearly on `perf/optimizations`, fast-forward merged to `main`, and
pushed to Vercel production. 21 total commits, zero behavior/visual/API change intended.

---

## Session A — Server (completed)

Full detail: `specs/structural-debt/session-a-summary.md`

### Routes extraction

`server/routes.ts` (6,574 lines, 208 endpoint registrations) was **fully orphaned** —
`server/index.ts` already wired `server/routes/index.ts`, so routes.ts was serving
nothing. Discovery: 202 of those 208 registrations were stale duplicates of live
endpoints already in `server/routes/*.ts`. The 6 endpoints that existed ONLY in routes.ts
(cadence queue, contact form, comment-counts) were dead in production (SPA catch-all
returned HTML 200). All 6 were moved to the correct domain files and verified live via
`curl`. routes.ts deleted.

### Storage split

`server/storage.ts` (1,809 lines, 174 methods, one monolithic `DatabaseStorage` class)
split into 11 domain modules under `server/storage/`:

`accounts`, `prospects`, `campaigns`, `leads`, `interactions`, `automation`,
`notifications`, `billing`, `tasks`, `agents`, `misc` + `types.ts`

`server/storage.ts` is now a 78-line barrel that composes all modules and re-exports
the same `storage` object with identical method names. Zero consumer import changes.
The `IStorage` interface and empty `DatabaseStorage` class were dropped (nothing imported
either). Dead methods flagged (not removed): `getAiFilesByMessageId`,
`getAutomationLogs`, `getAutomationLogsByAccountId`, `getProspects`,
`getPushSubscriptionByEndpoint`, `getTasksByAccountId`. Known N+1 flagged (not fixed):
`reorderSubtasks` in `server/storage/tasks.ts:207`.

### Settings.tsx split

`client/src/pages/Settings.tsx` (1,748 lines) extracted to `client/src/features/settings/`:

- `types.ts` — UserProfile, NotificationPreferences, PushDevice, helpers
- `components/SettingsFields.tsx` — Field, PasswordField
- `components/ProfileSection.tsx` — profile form, avatar, password, language, Gmail
- `components/NotificationsSection.tsx` — Telegram, push, per-type overrides
- `components/DashboardSection.tsx` — auto-refresh
- `components/SettingsMobileHub.tsx` — mobile hub + theme/language/social

Settings.tsx is now 223 lines (thin nav + composition). Two minor behavior notes:
notification prefs now load on tab open (not page load); unsaved edits no longer
survive tab switches (sections unmount).

---

## Session B — Frontend (completed)

Full detail: `specs/structural-debt/session-b-summary.md`

### Key finding / pivot

The plan assumed Prompts/Tags had copy-pasted filter/sort/group **state**. Reality: every
list page already centralizes its own state using enum-based sorts and heterogeneous
persisted filters threaded to 3-4 children. The genuinely duplicated thing is the
**filter → sort → group → flatten algorithm** (the `useMemo` body), not the state shape.

Pivot (approved): stateless helpers rather than a state-owning hook. The `useEntityList`
hook and `EntityListView` shell were still built (available for future greenfield pages)
but existing pages adopted only the stateless helpers.

### Shared infrastructure (`client/src/components/crm/entityList/`)

- `buildEntityRows.ts` — `buildEntityRows<T,R>(opts)` + `groupItemsToMap<T>()`.
  Stateless filter→sort→group→flatten. `groupItemsToMap` accepts an optional `orderGroups`
  callback for custom group-key sequences (used by Prospects for status/priority/date buckets).
- `useEntityList.ts` — state-owning hook (search, multi-select FilterState, SortConfig,
  groupBy, groupDirection, `usePersistedSelection`). Available; not adopted by existing pages.
- `EntityListView.tsx` — grouped ListCard/GroupHeader shell with toolbar + detail slots.
- `index.ts` — barrel re-exporting all three.

### List-pipeline migrations

| Page | What changed | Commit |
|---|---|---|
| Tags (`TagsPage.tsx`) | `tableFlatItems` useMemo → `buildEntityRows` | `19cab92b` |
| Prompts (`PromptsPage.tsx`) | `groupedRows` useMemo → `groupItemsToMap` | `531ea9e7` |
| Prospects (`useProspectListFiltering.ts`) | `flatItems` useMemo → `buildEntityRows` + `orderGroups` | `a3634486` |
| Billing (`BillingListView.tsx`) | `flatItems` useMemo → `buildEntityRows` + `DATE_GROUP_ORDER` | `9ed0c61f` |
| Billing (`ExpensesListView.tsx`) | `groupedItems` useMemo → `buildEntityRows` | `9ed0c61f` |

Not migrated (intentionally): `InvoicesInlineTable` (nested year→quarter tree, not flat),
`ContractsInlineTable` (sort-only, no grouping), Leads list views, Accounts list view.

### LeadDetailPanel split (`features/leads/components/leadDetail/`)

Panel: **2,237 → 1,278 lines** (-43%). JSX moved byte-for-byte via `sed` to preserve
special chars. New files in `leadDetail/`:

| File | Contents |
|---|---|
| `types.ts` | `Interaction`, `TagData`, `LeadTagEntry` interfaces |
| `format.ts` | `fmtDate`, `fmtDateTime`, `formatAiMemory`, context fns, `PIPELINE_STAGES` |
| `badges.tsx` | `STATUS_COLORS`, `StatusBadge`, `PriorityBadge`, `SentimentBadge` |
| `atoms.tsx` | `InfoRow`, `SectionTitle`, `InlineEditField` (self-contained with hooks) |
| `ScorePanel.tsx` | `ScoreArcPanel`, `ScoreDetailBar` |
| `LeadInteractionTimeline.tsx` | Full timeline: synthetic status events, msg/tag/status |
| `LeadScoreSection.tsx` | Score arc + tier + sub-score bars + AI summary block |
| `LeadTagsSection.tsx` | Tag add/remove UI, dropdown, loading states |
| `LeadNotesSection.tsx` | Voice recording, textarea, save indicators, demo-campaign block |
| `index.ts` | Barrel re-exporting all above |

Remaining inline (needs state extraction first): contact/identity, status/stage selector,
DNC, bump-progress, booking, AI-insights, assignment sections + ~30 state vars/handlers.

---

## What was NOT done (deferred)

> Update (2026-06-12): Sessions C and D are COMPLETE — see `session-c-summary.md`
> (LeadDetailPanel 1,279 → 516 lines: 5 state hooks + 8 section components) and the
> session D summary (Leads/Accounts row pipelines migrated onto `buildEntityRows`,
> commits `43ab2829`/`56c6cfc2`/`27f675ee`). Only the dead storage methods remain.

| Deferred item | Spec |
|---|---|
| Dead storage methods (6 flagged in Session A) | `session-a-summary.md` |

> Update (2026-06-11, post-merge review): the `reorderSubtasks` N+1 was subsequently FIXED by the
> perf session (single CASE-expression UPDATE, commit `5aa96c08`) — no longer deferred. The same
> session also capped the no-arg `getAutomationLogs` at 5K rows, but that method has zero callers
> (it is one of the 6 dead methods above).

---

## FILE_MAP.md coverage

Session B updated FILE_MAP.md at M5 to include: `entityList/` infrastructure, updated
`LeadDetailPanel` row (now composition + `leadDetail/` subfolder), `leadDetail/` subfolder
rows, Session A server moves (routes.ts deleted, storage.ts barrel, Settings thin
composition + `features/settings/components/`).
