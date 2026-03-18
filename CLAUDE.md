# LeadAwaker CRM — Project Guidelines

## What This App Is

Lead Reactivation CRM for WhatsApp outreach. Core features: WhatsApp inbox (conversations), campaign manager, leads pipeline (kanban/table/list), task manager (kanban/table/tree/list/gantt), prospects pipeline, AI agents, and AI smart automation (contextual bumps, buying signal detection, business knowledge base, smart handoff, nightly summaries).

## Stack

- **Frontend:** React + TypeScript (Vite), TailwindCSS, TanStack Query, shadcn/ui
- **Backend:** Express + Drizzle ORM + PostgreSQL (running on Raspberry Pi via pm2)
- **Auth:** Session-based
- **i18n:** react-i18next, three locales: `en`, `nl`, `pt`

## Key Reference Files — Read Before Working

| File | Purpose |
|------|---------|
| `UI_STANDARDS.md` | Canonical design system — colors, spacing, typography, rules, bans |
| `UI_PATTERNS.md` | Implementation patterns with exact markup |
| `FILE_MAP.md` | Quick component/file lookup — saves you grep/glob time |
| `shared/schema.ts` | Drizzle ORM schema for all DB tables |
| `specs/<feature>/` | Feature specs: requirements.md, implementation-plan.md, action-required.md |

## Critical Rules

### Running the App
- App runs via **pm2** on host — never run `npm run dev`
- Verify changes: `pm2 logs` or check `app.leadawaker.com`
- TypeScript hook runs after every TS edit (tsc check) — always-on, cannot be bypassed

### i18n — No Hardcoded Strings
Every user-facing string must go through i18n. Locale files live in `client/src/locales/{en,nl,pt}/`. Current namespace files: `leads`, `campaigns`, `conversations`, `automation`, `prompts`, `accounts`, `settings`, `billing`, `calendar`, `tags`, `users`, `about`, `crm`, `common`, `tasks`, `prospects`.

### Timestamps — Never Send ISO Strings from Client
Drizzle-Zod generates `z.date()` for timestamp columns. ISO strings from client fail validation silently (data reverts with no error). Always set timestamps server-side using `new Date()` objects.

### No `process.exit()` in Error Handlers
Never use `process.exit()` in Vite or server error handlers — it kills the entire Express+API process. File changes are never lost on crash, only serving stops.

### Terminology
- "Leads page" = `LeadsCardView.tsx` (the card/list view with chat panel), NOT `LeadDetailPanel.tsx`

### Styling
- Follow `UI_STANDARDS.md` strictly. Check it before introducing new color values, spacing, or component patterns.
- Content-width cap: `max-w-[1386px] mr-auto` on outer flex child, never inner wrapper.
- Full-height columns: parent needs `overflow-hidden + min-h-0`, each column needs `min-h-0 overflow-y-auto`.

## Deployment

- `app.leadawaker.com` = Pi dev server (live on file save via tsx watch)
- `leadawaker.com` = Vercel production (auto-deploys from GitHub `main` after `git push`)
- `api.leadawaker.com` = Pi API (used by Vercel frontend via `VITE_API_URL`)

## Feature Specs

When working on a planned feature, check `specs/<feature-name>/` first:
- `requirements.md` — what it does and acceptance criteria
- `implementation-plan.md` — phased task list with file locations
- `action-required.md` — manual steps (migrations, backfills)
